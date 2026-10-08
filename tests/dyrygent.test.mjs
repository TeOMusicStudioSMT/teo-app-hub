/** Dyrygent (dobór modeli do zadań) i Kuźnia Soup (własny model TeOgochi z jego pracy). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as Dyrygent from '../services/Dyrygent.js';
import * as KuzniaSoup from '../services/KuzniaSoup.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dyrygent-'));
const TAGI = { models: [
    { name: 'gemma4:e2b', size: 2.1e9, details: { family: 'gemma', parameter_size: '2B', quantization_level: 'Q4_K_M' } },
    { name: 'qwen3.5:9b', size: 6.6e9, details: { family: 'qwen', parameter_size: '9B', quantization_level: 'Q4_K_M' } },
    { name: 'teogochi-kodeks:latest', size: 4.1e9, details: { family: 'qwen', parameter_size: '7B' } },
] };
/** Projekt z pracą: Kodeks pisał na qwen, Joanna na gemmie; Sędzia 8/10, a runda 1 miała 6/10. */
const PROJEKTY = [{
    id: 'forge', nazwa: 'Forge Fashion', wizja: 'Gra RPG-fashion z Marketplace GRV.', runda: 2, rundy: 2,
    oceny: [{ runda: 1, ocena: 6 }, { runda: 2, ocena: 8 }],
    kroki: [
        { agent: 'kodeks', imie: 'Kodeks', zadanie: 'Gra: pętla', stan: 'gotowe', model: 'qwen3.5:9b', runda: 2, wklad: 'Pętla v2', wersje: [{ runda: 1, wklad: 'Pętla v1' }], szkice: [{ runda: 2, przed: 'szkic', po: 'Pętla v2' }] },
        { agent: 'joanna', imie: 'Joanna', zadanie: 'Muzyka', stan: 'gotowe', model: 'gemma4:e2b', runda: 2, wklad: 'Motyw' },
        { agent: 'kupiec', imie: 'Kupiec', zadanie: 'Merch', stan: 'blad', model: 'gemma4:e2b', wklad: null },
    ],
}, { id: 'stary', nazwa: 'Bez ocen', wizja: 'W', kroki: [{ agent: 'kodeks', imie: 'Kodeks', zadanie: 'Gra', stan: 'gotowe', model: 'qwen3.5:9b', wklad: 'bez oceny' }] }];

test('katalog: modele Ollamy + karta Suwerena + własny model z Kuźni + praca w stadzie (średnia ocena)', async () => {
    const katalogWymiar = tmp();
    Dyrygent.skonfiguruj({
        katalogWymiar, tagi: async () => TAGI, projekty: async () => PROJEKTY,
        modeleAgentow: async () => ({ joanna: 'gemma4:e2b' }), wykute: async () => [{ agent: 'kodeks', model: 'teogochi-kodeks' }],
    });
    await Dyrygent.ustawKarte('qwen3.5:9b', { opis: 'Rozumowanie i kod', mocne: 'kod, scalanie' });
    await assert.rejects(Dyrygent.ustawKarte('x; rm -rf', { opis: 'x' }), /Zła nazwa/);
    const k = await Dyrygent.katalog();
    // Kolejność idzie za ocenami Sędziego-Jev (krok 1, 2026-10-08) — stare oceny lokalnego Sędziego nie wynoszą modelu; przy remisie mniejszy.
    assert.deepEqual(k.map((m) => m.nazwa), ['gemma4:e2b', 'teogochi-kodeks:latest', 'qwen3.5:9b']);
    const qwen = k.find((m) => m.nazwa === 'qwen3.5:9b');
    assert.deepEqual(qwen.karta, { opis: 'Rozumowanie i kod', mocne: ['kod', 'scalanie'] });
    assert.deepEqual(qwen.praca, { wkladow: 2, ocen: 1, srednia: 8, ocenJev: 0, sredniaJev: null });   // projekt bez oceny liczy się do wkładów, nie do średniej
    assert.deepEqual(k[0].agenci, ['joanna']);
    const wlasny = k.find((m) => m.nazwa === 'teogochi-kodeks:latest');
    assert.deepEqual(wlasny.praca, { wkladow: 0, ocen: 0, srednia: null, ocenJev: 0, sredniaJev: null });
    assert.equal(wlasny.wlasny, 'kodeks');
    assert.equal(wlasny.rozmiarGB, 4.1);
});

test('dobierz: tylko modele z katalogu i agenci z zadania — zmyślenia odrzucone z powodem', async () => {
    let zapytanie;
    Dyrygent.skonfiguruj({
        katalogWymiar: tmp(), tagi: async () => TAGI, projekty: async () => [], modeleAgentow: async () => ({}), wykute: async () => [{ agent: 'kodeks', model: 'teogochi-kodeks' }],
        model: () => 'gemma4:e2b',
        pisz: async (o) => { zapytanie = o; return 'Proponuję tak:\n{"przydzial":[{"agent":"kodeks","model":"teogochi-kodeks","powod":"własny model"},{"agent":"joanna","model":"gpt-9","powod":"x"},{"agent":"szpieg","model":"gemma4:e2b"},{"agent":"joanna","model":"gemma4:e2b","powod":"krótki wkład"}]}\nPowodzenia!'; },
    });
    await assert.rejects(Dyrygent.dobierz({ zadanie: 'gra', agenci: [{ id: 'kodeks' }] }), /Opisz zadanie/);
    const w = await Dyrygent.dobierz({ zadanie: 'Forge Fashion: gra RPG-fashion', agenci: [{ id: 'kodeks', imie: 'Kodeks', zadanie: 'Gra: pętla' }, { id: 'joanna', imie: 'Joanna' }] });
    assert.deepEqual(w.przydzial, [{ agent: 'kodeks', model: 'teogochi-kodeks:latest', powod: 'własny model' }, { agent: 'joanna', model: 'gemma4:e2b', powod: 'krótki wkład' }]);
    assert.deepEqual(w.odrzucone.map((o) => o.powod), ['nie ma takiego modelu w Katedrze', 'nie ma takiego TeOgochi w zadaniu']);
    assert.match(zapytanie.prompt, /teogochi-kodeks:latest — WŁASNY model TeOgochi „kodeks" \(wykuty z jego pracy\) — fakty: ŚREDNI 7B, rodzina qwen, 4\.1 GB/);
    assert.match(zapytanie.prompt, /- kodeks — Kodeks: Gra \[WYMAGANIE ROLI: model do kodu albo co najmniej 7 mld/);
    assert.match(zapytanie.system, /WYŁĄCZNIE modele z KATALOGU/);
});

test('Kuźnia Soup: SFT tylko z dobrze ocenionej pracy, pary z pętli i z rund, w których ocena wzrosła', () => {
    const { sft, pary, pominiete } = KuzniaSoup.zbierz(PROJEKTY, { agent: 'kodeks', kartaRoli: 'KARTA Kodeksa', prog: 7 });
    assert.equal(sft.length, 1);
    assert.deepEqual(sft[0].messages.map((m) => m.role), ['system', 'user', 'assistant']);
    assert.match(sft[0].messages[0].content, /^KARTA Kodeksa/);
    assert.match(sft[0].messages[1].content, /PROJEKT: Forge Fashion\nWIZJA SUWERENA:\nGra RPG-fashion[^]*TWOJE ZADANIE \(Kodeks\):\nGra: pętla/);
    assert.equal(sft[0].messages[2].content, 'Pętla v2');
    assert.deepEqual(pary.map((p) => [p.chosen, p.rejected]), [['Pętla v2', 'szkic'], ['Pętla v2', 'Pętla v1']]);
    assert.deepEqual(pominiete, { bezOceny: 1, slabe: 0 });
    assert.equal(KuzniaSoup.zbierz(PROJEKTY, { agent: 'kodeks', prog: 9 }).sft.length, 0, 'próg 9 — 8/10 za mało');
});

test('Kuźnia Soup: odmawia bez bazy i przy za małej liczbie próbek; przy dość — pliki + soup.yaml; wykucie woła Soup po kolei', async () => {
    const katalog = tmp();
    const duzo = Array.from({ length: 9 }, (_, i) => ({ ...PROJEKTY[0], id: `p${i}`, nazwa: `P${i}` }));
    const wolania = [];
    KuzniaSoup.skonfiguruj({
        katalog, projekty: async () => PROJEKTY, karta: async () => ({ imie: 'Kodeks', tresc: 'KARTA Kodeksa' }), baza: '', istnieje: () => false,
        uruchom: async (pol, argi, { naLinie }) => { wolania.push([pol, ...argi]); naLinie('ok'); return 0; },
    });
    await assert.rejects(KuzniaSoup.przygotuj('kodeks'), /model bazowy/);
    await assert.rejects(KuzniaSoup.przygotuj('kodeks', { baza: 'Qwen/Qwen2.5-3B-Instruct' }), /Za mało dobrej pracy Kodeks do kucia: 1 wkładów z oceną ≥ 7\/10 \(potrzeba 8\)/);
    KuzniaSoup.skonfiguruj({ projekty: async () => duzo });
    const info = await KuzniaSoup.przygotuj('kodeks', { baza: 'Qwen/Qwen2.5-3B-Instruct' });
    assert.deepEqual([info.sft, info.pary], [9, 18]);
    const dir = path.join(katalog, 'kodeks');
    assert.equal(fs.readFileSync(path.join(dir, 'sft.jsonl'), 'utf8').trim().split('\n').length, 9);
    const yaml = fs.readFileSync(path.join(dir, 'soup.yaml'), 'utf8');
    assert.match(yaml, /base: "Qwen\/Qwen2.5-3B-Instruct"\ntask: sft\ndata:\n  train: .\/sft.jsonl\n  format: chatml\n  val_split: 0/);

    const z = await KuzniaSoup.wykuj('kodeks', { baza: 'Qwen/Qwen2.5-3B-Instruct' });
    await assert.rejects(KuzniaSoup.wykuj('kodeks', { baza: 'x/y' }), /już kuje/);
    for (let i = 0; i < 100 && KuzniaSoup.sondaz(z.id).stan === 'trwa'; i++) await new Promise((r) => setTimeout(r, 10));
    assert.equal(KuzniaSoup.sondaz(z.id).stan, 'gotowe');
    assert.deepEqual(wolania.map((w) => w.slice(0, 3)), [['soup', '--no-telemetry', 'train'], ['soup', '--no-telemetry', 'export'], ['soup', '--no-telemetry', 'deploy']]);
    assert.ok(wolania[2].includes('teogochi-kodeks') && wolania[2].includes('KARTA Kodeksa'));
    assert.deepEqual((await KuzniaSoup.wykute()).map((w) => [w.agent, w.model]), [['kodeks', 'teogochi-kodeks']]);
});

test('Kuźnia Soup: błąd Soup (np. brak karty graficznej) zostaje w zadaniu z etapem, bez udawania modelu', async () => {
    const duzo = Array.from({ length: 8 }, (_, i) => ({ ...PROJEKTY[0], id: `q${i}` }));
    KuzniaSoup.skonfiguruj({ katalog: tmp(), projekty: async () => duzo, uruchom: async (pol, argi) => (argi[1] === 'train' ? 1 : 0) });
    const z = await KuzniaSoup.wykuj('kodeks', { baza: 'Qwen/Qwen2.5-3B-Instruct' });
    for (let i = 0; i < 100 && KuzniaSoup.sondaz(z.id).stan === 'trwa'; i++) await new Promise((r) => setTimeout(r, 10));
    const s = KuzniaSoup.sondaz(z.id);
    assert.equal(s.stan, 'blad');
    assert.match(s.blad, /trening \(LoRA\): Soup zakończył się kodem 1/);
    assert.equal(KuzniaSoup.biezace(), null, 'po błędzie Kuźnia jest wolna');
});

test('Kuźnia Soup: szuka Soup po kolei — OTAKOS_SOUP → Katedra → pipx (~/.local/bin) → PATH', () => {
    const win = KuzniaSoup.kandydaciSoup({ platforma: 'win32', dom: 'C:\\Users\\arkad', srodowisko: 'D:\\Katedra\\_OtakOs_AI\\kuznia-soup', zEnv: '' });
    assert.deepEqual(win.map((k) => [k.zrodlo, k.sciezka]), [
        ['Katedra', 'D:\\Katedra\\_OtakOs_AI\\kuznia-soup\\venv\\Scripts\\soup.exe'],
        ['pipx (~/.local/bin)', 'C:\\Users\\arkad\\.local\\bin\\soup.exe'],
    ]);
    const lin = KuzniaSoup.kandydaciSoup({ platforma: 'linux', dom: '/home/a', srodowisko: '/k/kuznia-soup', zEnv: '/opt/soup' });
    assert.deepEqual(lin.map((k) => k.sciezka), ['/opt/soup', '/k/kuznia-soup/venv/bin/soup', '/home/a/.local/bin/soup']);

    KuzniaSoup.skonfiguruj({ soup: null, platforma: 'linux', srodowisko: '/k/kuznia-soup', istnieje: () => false });
    assert.equal(KuzniaSoup.znajdzSoup().zrodlo, process.env.OTAKOS_SOUP ? 'OTAKOS_SOUP' : 'PATH');
    if (!process.env.OTAKOS_SOUP) {
        KuzniaSoup.skonfiguruj({ istnieje: (p) => p.endsWith(path.join('.local', 'bin', 'soup')) });
        assert.equal(KuzniaSoup.znajdzSoup().zrodlo, 'pipx (~/.local/bin)');
        KuzniaSoup.skonfiguruj({ istnieje: () => true });
        assert.deepEqual(KuzniaSoup.znajdzSoup(), { polecenie: '/k/kuznia-soup/venv/bin/soup', zrodlo: 'Katedra' }, 'Katedra przed pipx');
    }
    KuzniaSoup.skonfiguruj({ istnieje: () => false });
});

test('Kuźnia Soup: cache HuggingFace i pip w Katedrze, telemetria off; własne HF_HOME Suwerena wygrywa', () => {
    KuzniaSoup.skonfiguruj({ srodowisko: '/k/kuznia-soup' });
    const e = KuzniaSoup.envKuzni({ PATH: '/bin' });
    assert.deepEqual([e.PATH, e.SOUP_TELEMETRY, e.HF_HOME, e.PIP_CACHE_DIR], ['/bin', '0', path.join('/k/kuznia-soup', 'hf'), path.join('/k/kuznia-soup', 'pip-cache')]);
    assert.equal(KuzniaSoup.envKuzni({ HF_HOME: '/moje/hf' }).HF_HOME, '/moje/hf');
});

test('Kuźnia Soup: koło PyTorch ze sterownika i karta graficzna z soup doctor', () => {
    assert.equal(KuzniaSoup.koloTorch('| NVIDIA-SMI 576.02   Driver Version: 576.02   CUDA Version: 12.9 |'), 'cu128');
    assert.equal(KuzniaSoup.koloTorch('CUDA Version: 13.1'), 'cu130');
    assert.equal(KuzniaSoup.koloTorch('CUDA Version: 12.4'), 'cu124');
    assert.equal(KuzniaSoup.koloTorch('CUDA Version: 11.2'), 'cu118');
    assert.equal(KuzniaSoup.koloTorch('bez karty'), null);
    assert.equal(KuzniaSoup.gpuZDoktora(['Python:   3.12.9', 'CUDA:     available (v12.8)']), 'cuda');
    assert.equal(KuzniaSoup.gpuZDoktora(['Backend:  CPU only']), 'cpu');
    assert.equal(KuzniaSoup.gpuZDoktora(['torch not installed']), 'cpu');
    assert.equal(KuzniaSoup.gpuZDoktora(['coś innego']), null);
});

const czekajNaKuznie = async (id) => {
    for (let i = 0; i < 200 && KuzniaSoup.sondaz(id).stan === 'trwa'; i++) await new Promise((r) => setTimeout(r, 10));
    return KuzniaSoup.sondaz(id);
};

test('Kuźnia Soup: instalacja w Katedrze — Python 3.12 (py), nvidia-smi → cu128, venv → pip → torch CUDA → soup-cli[train] → sprawdzenie', async () => {
    const srodowisko = tmp();
    const wolania = [];
    let srodowiskoPip = null;
    KuzniaSoup.skonfiguruj({
        srodowisko, platforma: 'win32', istnieje: () => false,
        uruchom: async (pol, argi, { naLinie, env }) => {
            wolania.push([pol, ...argi]);
            if (argi.includes('soup-cli[train]')) srodowiskoPip = env;
            if (pol === 'py') { if (argi[0] === '-3.12') naLinie('3 12'); else return 1; }
            else if (pol === 'nvidia-smi') naLinie('Driver Version: 576.02   CUDA Version: 12.9');
            else if (argi.includes('import torch;print(torch.__version__, torch.cuda.is_available())')) naLinie('2.8.0+cu128 True');
            else if (argi.includes('version')) naLinie('soup 0.75.1');
            else naLinie('ok');
            return 0;
        },
    });
    await assert.rejects(KuzniaSoup.instaluj({ cuda: 'cu999' }), /Nie znam koła PyTorch/);
    const z = await KuzniaSoup.instaluj();
    assert.match(z.sondaz, /^\/api\/kuznia-soup\/zadanie\/kz-.+\/sondaz$/);
    await assert.rejects(KuzniaSoup.instaluj(), /zajęta/);
    const s = await czekajNaKuznie(z.id);
    assert.equal(s.stan, 'gotowe', s.blad ?? '');
    assert.match(s.podsumowanie, /CUDA/);
    const venv = path.join(srodowisko, 'venv');
    const py = path.join(venv, 'Scripts', 'python.exe');
    const bezSprawdzenia = wolania.filter((w) => !(w[0] === 'py' && w.includes('-c')));
    assert.deepEqual(bezSprawdzenia, [
        ['nvidia-smi'],
        ['py', '-3.12', '-m', 'venv', venv],
        [py, '-m', 'pip', 'install', '--upgrade', 'pip'],
        [py, '-m', 'pip', 'install', 'torch', '--index-url', 'https://download.pytorch.org/whl/cu128'],
        [py, '-m', 'pip', 'install', 'soup-cli[train]'],
        [py, '-c', 'import torch;print(torch.__version__, torch.cuda.is_available())'],
        [path.join(venv, 'Scripts', 'soup.exe'), '--no-telemetry', 'version'],
    ]);
    assert.equal(srodowiskoPip.PIP_CACHE_DIR, process.env.PIP_CACHE_DIR || path.join(srodowisko, 'pip-cache'), 'cache pip w Katedrze');
    assert.equal(KuzniaSoup.biezace(), null);
});

test('Kuźnia Soup: Python położony w Katedrze (_OtakOs_AI/python312) idzie przed `py` — Live-USB bez rejestru', async () => {
    const wolania = [];
    const wKatedrze = path.join(process.cwd(), '_OtakOs_AI', 'python312', 'python.exe');
    KuzniaSoup.skonfiguruj({
        srodowisko: tmp(), platforma: 'win32', istnieje: (p) => p === wKatedrze,
        uruchom: async (pol, argi, { naLinie }) => { wolania.push([pol, ...argi]); naLinie(pol === wKatedrze ? '3 12' : 'ok'); return pol === wKatedrze || !argi.includes('-c') ? 0 : 1; },
    });
    const s = await czekajNaKuznie((await KuzniaSoup.instaluj({ cuda: 'cpu' })).id);
    assert.equal(wolania[0][0], wKatedrze);
    assert.deepEqual(wolania[1].slice(0, 3), [wKatedrze, '-m', 'venv']);
    assert.ok(!wolania.some((w) => w[0] === 'py'), 'py nie był potrzebny');
    assert.equal(s.stan, 'gotowe', s.blad ?? '');
});

test('Kuźnia Soup: instalacja bez Pythona 3.10–3.12 odmawia wprost (3.13 się nie liczy), niczego nie instaluje', async () => {
    const wolania = [];
    KuzniaSoup.skonfiguruj({
        srodowisko: tmp(), platforma: 'win32', istnieje: () => false,
        uruchom: async (pol, argi, { naLinie }) => { wolania.push([pol, ...argi]); naLinie('3 13'); return 0; },
    });
    const s = await czekajNaKuznie((await KuzniaSoup.instaluj({ cuda: 'cpu' })).id);
    assert.equal(s.stan, 'blad');
    assert.match(s.blad, /Nie ma Pythona 3\.10–3\.12/);
    assert.ok(wolania.every((w) => w.includes('-c')), 'tylko pytania o wersję, żadnego pip');
});

test('Dyrygent na Jev: jedno zapytanie, choice na każdego TeOgochi z opcjami = modele katalogu (bez embeddingów); pewność w powodzie', async () => {
    let zapytanie;
    Dyrygent.skonfiguruj({
        katalogWymiar: tmp(), tagi: async () => ({ models: [...TAGI.models, { name: 'nomic-embed-text:latest', size: 2.7e8, details: {} }] }),
        projekty: async () => [], modeleAgentow: async () => ({}), wykute: async () => [{ agent: 'kodeks', model: 'teogochi-kodeks' }],
        pisz: async () => { throw new Error('model nie powinien być pytany'); },
        jev: {
            stan: () => ({ maKlucz: true }),
            zapytaj: async (z) => {
                zapytanie = z;
                return { model: 'jev-1.13.0', answers: {
                    a0: { type: 'choice', choice: 'teogochi-kodeks:latest', confidence: 0.62, probabilities: { 'teogochi-kodeks:latest': 0.62, 'qwen3.5:9b': 0.3, 'gemma4:e2b': 0.08 } },
                    a1: { type: 'choice', choice: 'gemma4:e2b', confidence: 0.8, probabilities: { 'gemma4:e2b': 0.8, 'qwen3.5:9b': 0.2 } },
                } };
            },
        },
    });
    try {
        const w = await Dyrygent.dobierz({ zadanie: 'Zbuduj quest Kustosza w grze', szybko: true, agenci: [{ id: 'kodeks', imie: 'Kodeks', dziedzina: 'kod' }, { id: 'joanna', imie: 'Joanna', dziedzina: 'muzyka' }] });
        assert.equal(w.silnik, 'jev');
        assert.equal(w.model, 'jev-1.13.0');
        assert.deepEqual(w.przydzial.map((p) => [p.agent, p.model]), [['kodeks', 'teogochi-kodeks:latest'], ['joanna', 'gemma4:e2b']]);
        assert.match(w.przydzial[0].powod, /pewność 0\.62; drugi wybór qwen3\.5:9b \(0\.30\)/);
        assert.deepEqual(Object.keys(zapytanie.questions), ['a0', 'a1']);
        assert.equal(zapytanie.questions.a0.type, 'choice');
        assert.ok(!('nomic-embed-text:latest' in zapytanie.questions.a0.criteria), 'embeddingi nie są instrumentem');
        assert.match(zapytanie.questions.a0.criteria['teogochi-kodeks:latest'], /WŁASNY model TeOgochi „kodeks"/);
        assert.match(zapytanie.questions.a1.instructions.teogochi, /joanna — Joanna \(muzyka\)/);
    } finally { Dyrygent.skonfiguruj({ jev: null }); }
});

test('Dyrygent na Jev padł — dobiera lokalny model, błąd Jev w odpowiedzi', async () => {
    Dyrygent.skonfiguruj({
        katalogWymiar: tmp(), tagi: async () => TAGI, projekty: async () => [], modeleAgentow: async () => ({}), wykute: async () => [],
        model: () => 'qwen3.5:9b',
        pisz: async () => '{"przydzial":[{"agent":"kodeks","model":"qwen3.5:9b","powod":"kod"}]}',
        jev: { stan: () => ({ maKlucz: true }), zapytaj: async () => { throw new Error('Jev HTTP 529'); } },
    });
    try {
        const w = await Dyrygent.dobierz({ zadanie: 'Zbuduj quest', agenci: [{ id: 'kodeks', imie: 'Kodeks' }] });
        assert.equal(w.silnik, 'model');
        assert.match(w.jevBlad, /529/);
        assert.deepEqual(w.przydzial.map((p) => p.model), ['qwen3.5:9b']);
    } finally { Dyrygent.skonfiguruj({ jev: null }); }
});

test('reguła scalających: Reżyser/Kronikarz bez modeli ≤ 4B — w opcjach Jev i po lokalnym modelu (2026-10-08)', async () => {
    const MALE = { models: [...TAGI.models, { name: 'spark-4b:latest', size: 2.5e9, details: { parameter_size: '4.11B' } }] };
    // 1) Jev: Reżyser nie widzi modeli ≤ 4B, Kodeks widzi wszystkie
    let zapytanie;
    Dyrygent.skonfiguruj({
        katalogWymiar: tmp(), tagi: async () => MALE, projekty: async () => [], modeleAgentow: async () => ({}), wykute: async () => [],
        jev: { stan: () => ({ maKlucz: true }), zapytaj: async (z) => { zapytanie = z; return { model: 'jev', answers: { a0: { choice: 'qwen3.5:9b', confidence: 0.7, probabilities: {} }, a1: { choice: 'spark-4b:latest', confidence: 0.6, probabilities: {} } } }; } },
    });
    try {
        await Dyrygent.dobierz({ zadanie: 'Biblia gry', agenci: [{ id: 'rezyser', imie: 'Reżyser' }, { id: 'kodeks', imie: 'Kodeks' }] });
        assert.ok(!('spark-4b:latest' in zapytanie.questions.a0.criteria) && !('gemma4:e2b' in zapytanie.questions.a0.criteria), 'Reżyser: bez ≤ 4B (spark 4.11B, gemma 2B)');
        assert.ok('qwen3.5:9b' in zapytanie.questions.a0.criteria);
        // Kodeks (krok 2): model do kodu albo ≥ 7 mld — spark 4B i gemma 2B odpadają z jego opcji
        assert.ok(!('spark-4b:latest' in zapytanie.questions.a1.criteria) && 'qwen3.5:9b' in zapytanie.questions.a1.criteria, 'Kodeks: bez 4B');
    } finally { Dyrygent.skonfiguruj({ jev: null }); }

    // 2) lokalny model dał Kronikarzowi 2B → podmiana na większy z powodem; Kodeks bez zmian
    Dyrygent.skonfiguruj({
        katalogWymiar: tmp(), tagi: async () => MALE, projekty: async () => [], modeleAgentow: async () => ({}), wykute: async () => [], jev: null, model: () => 'm',
        pisz: async () => '{"przydzial":[{"agent":"kronikarz","model":"gemma4:e2b","powod":"szybki"},{"agent":"kodeks","model":"spark-4b:latest","powod":"mały"}]}',
    });
    const w = await Dyrygent.dobierz({ zadanie: 'Kronika', agenci: [{ id: 'kronikarz', imie: 'Kronikarz' }, { id: 'kodeks', imie: 'Kodeks' }] });
    assert.notEqual(w.przydzial[0].model, 'gemma4:e2b');
    assert.ok(['qwen3.5:9b', 'teogochi-kodeks:latest'].includes(w.przydzial[0].model));
    assert.match(w.przydzial[0].powod, /reguła scalających: gemma4:e2b ma ≤ 4B, a Kronikarz skleja pracę stada/);
    assert.notEqual(w.przydzial[1].model, 'spark-4b:latest', 'Kodeks na 4B → reguła roli');
    assert.match(w.przydzial[1].powod, /reguła roli: spark-4b:latest \(MAŁY 4B\) za mały — Kodeks pisze kod gry/);

    // 3) agent oznaczony scala:true też podlega; brak większych modeli → zostaje, z powodem
    const tylkoMale = [{ nazwa: 'gemma4:e2b', parametry: '2B', kwantyzacja: 'Q4_K_M' }];
    const r = Dyrygent.regulaScalajacych([{ agent: 'ogrodnik', model: 'gemma4:e2b', powod: 'x' }], [{ id: 'ogrodnik', imie: 'Ogrodnik', scala: true }], tylkoMale);
    assert.equal(r[0].model, 'gemma4:e2b');
    assert.match(r[0].powod, /nie ma modelu większego niż 4B/);
});

test('krok 1 — równe szanse: karta z faktów, cechy z nazwy, oceny Sędziego-Jev osobno od starych lokalnych', () => {
    assert.deepEqual(Dyrygent.cechyZNazwy('hf.co/x/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q4_K_M'), ['model do kodu', 'dostrojony do poleceń', 'MoE — aktywna tylko część parametrów']);
    assert.deepEqual(Dyrygent.cechyZNazwy('hf.co/ItsOkayNow/Spark-X2.5-4B-Heretic-GGUF:Q4_K_M'), ['odblokowany (bez cenzury)']);
    assert.equal(Dyrygent.kartaZFaktow({ nazwa: 'gemma4:12B', parametry: '11.9B', rodzina: 'gemma4', kwantyzacja: 'Q4_K_M', rozmiarGB: 7.6 }), 'DUŻY 11.9B, rodzina gemma4, kwantyzacja Q4_K_M, 7.6 GB');
    const st = Dyrygent.statystyki([
        { oceny: [{ ocena: 9.8, kto: 'Wektor' }], kroki: [{ model: 'spark', stan: 'gotowe' }] },
        { oceny: [{ ocena: 6, kto: 'Wektor' }, { ocena: 7.2, kto: 'Jev + Wektor' }], kroki: [{ model: 'gemma', stan: 'gotowe' }] },
    ]);
    assert.deepEqual(st.spark, { wkladow: 1, ocen: 1, srednia: 9.8, ocenJev: 0, sredniaJev: null });
    assert.deepEqual(st.gemma, { wkladow: 1, ocen: 1, srednia: 7.2, ocenJev: 1, sredniaJev: 7.2 });
    assert.match(Dyrygent.opisPracy(st.spark), /oceny tylko od dawnego lokalnego Sędziego \(zawyżone — nie porównuj/);
    assert.doesNotMatch(Dyrygent.opisPracy(st.spark), /9\.8/, 'zawyżona liczba nie idzie do Dyrygenta');
    assert.match(Dyrygent.opisPracy(st.gemma), /Sędziego-Jev 7\.2\/10 \(1 ocen\)/);
    assert.match(Dyrygent.liniaKatalogu({ nazwa: 'ornith:latest', parametry: '9.0B', rodzina: 'qwen35', praca: { wkladow: 0 } }), /^- ornith:latest — fakty: DUŻY 9B, rodzina qwen35 — jeszcze nie pracował/);
});

test('krok 2 — reguły ról: Wektor ≥ 8B, Kodeks koderski albo ≥ 7B, własny model zawsze; zwykła rola bez wymagań', () => {
    const kat = [
        { nazwa: 'spark:4b', parametry: '4.11B', praca: {} }, { nazwa: 'mistral:latest', parametry: '7.2B', praca: {} },
        { nazwa: 'qwen2.5-coder:7b', parametry: '7.6B', praca: {} }, { nazwa: 'gemma4:12B', parametry: '11.9B', praca: {} },
        { nazwa: 'teogochi-wektor', parametry: '2B', wlasny: 'wektor', praca: {} },
    ];
    const agenci = [{ id: 'wektor', imie: 'Wektor' }, { id: 'kodeks', imie: 'Kodeks' }, { id: 'joanna', imie: 'Joanna' }, { id: 'straznik', imie: 'Strażnik' }];
    const r = Dyrygent.regulyRol([
        { agent: 'wektor', model: 'mistral:latest', powod: 'x' }, { agent: 'kodeks', model: 'spark:4b', powod: 'x' },
        { agent: 'joanna', model: 'spark:4b', powod: 'x' }, { agent: 'straznik', model: 'gemma4:12B', powod: 'x' },
    ], agenci, kat);
    assert.equal(r[0].model, 'teogochi-wektor', 'Wektor: mistral 7,2B < 8 → jego własny model');
    assert.equal(r[1].model, 'qwen2.5-coder:7b', 'Kodeks: koderski najpierw');
    assert.equal(r[2].model, 'spark:4b', 'Joanna bez wymagań');
    assert.equal(r[3].model, 'gemma4:12B');
    assert.equal(Dyrygent.spelnia(kat[0], Dyrygent.wymaganiaRoli({ id: 'kodeks' })), false);
    assert.equal(Dyrygent.spelnia({ nazwa: 'nieznany' }, Dyrygent.wymaganiaRoli({ id: 'wektor' })), true, 'nieznany rozmiar — nie zgadujemy');
});

test('krok 3 — Jev zawęża do 3, większy model lokalny rozstrzyga z listy; spoza listy = zostaje wstępny; limit modeli', async () => {
    let doRozstrzygniecia;
    Dyrygent.skonfiguruj({
        katalogWymiar: tmp(), tagi: async () => TAGI, projekty: async () => [], modeleAgentow: async () => ({}), wykute: async () => [],
        model: () => 'gemma4:e2b',
        pisz: async (o) => { doRozstrzygniecia = o; return '{"przydzial":[{"agent":"joanna","model":"qwen3.5:9b","powod":"muzyka z tekstem potrzebuje rozumu"},{"agent":"kupiec","model":"gpt-9","powod":"x"}]}'; },
        jev: { stan: () => ({ maKlucz: true }), zapytaj: async () => ({ model: 'jev-1.13.0', answers: {
            a0: { choice: 'gemma4:e2b', confidence: 0.8, probabilities: { 'gemma4:e2b': 0.8, 'qwen3.5:9b': 0.15, 'teogochi-kodeks:latest': 0.05 } },
            a1: { choice: 'gemma4:e2b', confidence: 0.7, probabilities: { 'gemma4:e2b': 0.7, 'qwen3.5:9b': 0.3 } },
        } }) },
    });
    try {
        const w = await Dyrygent.dobierz({ zadanie: 'Koncert na wyspie', agenci: [{ id: 'joanna', imie: 'Joanna' }, { id: 'kupiec', imie: 'Kupiec' }] });
        assert.equal(w.silnik, 'jev+model');
        assert.equal(w.model, 'jev-1.13.0 → qwen3.5:9b', 'rozstrzyga największy lokalny ≥ 7B (model Dyrygenta ma 2B)');
        assert.deepEqual(w.krotkie.joanna.map((k) => k.model), ['gemma4:e2b', 'qwen3.5:9b', 'teogochi-kodeks:latest']);
        assert.deepEqual(w.przydzial.map((p) => [p.agent, p.model]), [['joanna', 'qwen3.5:9b'], ['kupiec', 'gemma4:e2b']]);
        assert.match(w.przydzial[0].powod, /muzyka z tekstem potrzebuje rozumu \(wstępnie 0\.15\)/);
        assert.match(w.przydzial[1].powod, /rozstrzygający nie wybrał — zostaje wstępny/);
        assert.ok(w.odrzucone.some((o) => o.agent === 'kupiec' && /spoza listy/.test(o.powod)));
        assert.match(doRozstrzygniecia.prompt, /joanna — Joanna\n    · gemma4:e2b \(wstępnie 0\.8\) — MAŁY 2B/);
    } finally { Dyrygent.skonfiguruj({ jev: null }); }

    const krotkie = { a: [{ model: 'm1' }], b: [{ model: 'm2' }], c: [{ model: 'm3' }], d: [{ model: 'm4' }, { model: 'm1' }] };
    const og = Dyrygent.ograniczDoModeli([{ agent: 'a', model: 'm1', powod: '' }, { agent: 'a2', model: 'm1', powod: '' }, { agent: 'b', model: 'm2', powod: '' }, { agent: 'c', model: 'm3', powod: '' }, { agent: 'd', model: 'm4', powod: '' }], krotkie, [], 3);
    assert.equal(og.find((p) => p.agent === 'd').model, 'm1');
    assert.match(og.find((p) => p.agent === 'd').powod, /limit 3 modeli na kartę: m4 → m1/);
    assert.equal(new Set(og.map((p) => p.model)).size, 3);
});

test('limit modeli chroni model do kodu wybrany Kodeksowi', () => {
    const og = Dyrygent.ograniczDoModeli([
        { agent: 'a', model: 'ornith', powod: '' }, { agent: 'b', model: 'ornith', powod: '' }, { agent: 'c', model: 'mistral', powod: '' },
        { agent: 'd', model: 'mistral', powod: '' }, { agent: 'e', model: 'apus', powod: '' }, { agent: 'f', model: 'apus', powod: '' },
        { agent: 'kodeks', model: 'qwen2.5-coder:7b', powod: '' },
    ], { e: [{ model: 'apus' }, { model: 'ornith' }], f: [{ model: 'ornith' }] }, [], 3);
    assert.equal(og.find((p) => p.agent === 'kodeks').model, 'qwen2.5-coder:7b');
    assert.equal(new Set(og.map((p) => p.model)).size, 3);
});

