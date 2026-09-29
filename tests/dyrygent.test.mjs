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
    assert.deepEqual(k.map((m) => m.nazwa), ['gemma4:e2b', 'qwen3.5:9b', 'teogochi-kodeks:latest']);   // lepiej oceniane pierwsze, przy remisie mniejszy
    assert.deepEqual(k[1].karta, { opis: 'Rozumowanie i kod', mocne: ['kod', 'scalanie'] });
    assert.deepEqual(k[1].praca, { wkladow: 2, ocen: 1, srednia: 8 });                                  // projekt bez oceny liczy się do wkładów, nie do średniej
    assert.deepEqual(k[0].agenci, ['joanna']);
    assert.deepEqual(k[2].praca, { wkladow: 0, ocen: 0, srednia: null });                             // jeszcze nie pracował — ostatni
    assert.equal(k[2].wlasny, 'kodeks');
    assert.equal(k[2].rozmiarGB, 4.1);
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
    assert.match(zapytanie.prompt, /teogochi-kodeks:latest \(7B, 4\.1 GB\) — WŁASNY model TeOgochi „kodeks"/);
    assert.match(zapytanie.prompt, /- kodeks — Kodeks: Gra/);
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
    KuzniaSoup.skonfiguruj({
        srodowisko, platforma: 'win32', istnieje: () => false,
        uruchom: async (pol, argi, { naLinie }) => {
            wolania.push([pol, ...argi]);
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
    assert.equal(KuzniaSoup.biezace(), null);
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
