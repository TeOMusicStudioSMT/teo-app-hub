// 🔭 Zwiadowca HF i 🎲 Pionek: kandydaci z HuggingFace dla Dyrygenta (pobranie tylko po akceptacji) i gry w Projekcie Stada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as Zwiadowca from '../services/ZwiadowcaHF.js';
import * as ProjektStada from '../services/ProjektStada.js';
import * as Persony from '../services/Persony.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'zwiadowca-'));
const json = (d, status = 200) => ({ ok: status === 200, status, json: async () => d, text: async () => (typeof d === 'string' ? d : JSON.stringify(d)) });
// Limit 15 s: w pełnym zestawie testy idą równolegle i zwiad w tle bywa wolniejszy niż w pojedynkę.
const czekaj = async (warunek) => { for (let i = 0; i < 1500 && !(await warunek()); i++) await new Promise((r) => setTimeout(r, 10)); };

test('Zwiadowca: kwantyzacja z nazwy pliku i wybór pliku mieszczącego się w VRAM (pliki dzielone liczone razem)', () => {
    assert.equal(Zwiadowca.kwant('Qwen3-8B-Q4_K_M.gguf'), 'Q4_K_M');
    assert.equal(Zwiadowca.kwant('bielik-11b-v2.3-instruct.Q8_0.gguf'), 'Q8_0');
    assert.equal(Zwiadowca.kwant('model-IQ4_XS.gguf'), 'IQ4_XS');
    assert.equal(Zwiadowca.kwant('model-f16.gguf'), 'F16');
    assert.equal(Zwiadowca.kwant('README.md'), null);
    const pliki = [
        { path: 'm-Q8_0.gguf', size: 9e9 },
        { path: 'm-Q4_K_M-00001-of-00002.gguf', lfs: { size: 3e9 } }, { path: 'm-Q4_K_M-00002-of-00002.gguf', lfs: { size: 2.5e9 } },
        { path: 'm-Q2_K.gguf', size: 3e9 },
        { path: 'mmproj-f16.gguf', size: 1e9 },
    ];
    assert.deepEqual(Zwiadowca.wybierzPlik(pliki, 12), { kwant: 'Q4_K_M', gb: 5.5, plik: 'm-Q4_K_M-00001-of-00002.gguf' });
    assert.equal(Zwiadowca.wybierzPlik(pliki, 4).kwant, 'Q2_K', 'Q4_K_M (5,5 GB) nie mieści się w 4 GB → mniejszy');
    assert.equal(Zwiadowca.wybierzPlik(pliki, 2), null, 'nic się nie mieści → brak kandydata');
    assert.equal(Zwiadowca.nazwaOllamy('speakleash/Bielik-11B-v2.3-Instruct-GGUF', 'Q4_K_M'), 'hf.co/speakleash/Bielik-11B-v2.3-Instruct-GGUF:Q4_K_M');
    assert.ok(Zwiadowca.wOllamie('a/b', ['hf.co/a/b:Q8_0', 'gemma4']));
    assert.ok(!Zwiadowca.wOllamie('a/b', ['hf.co/a/bb:Q4_K_M']));
});

/** Atrapa HuggingFace + Ollamy: dwa repo z GGUF, jedno już w Ollamie, jedno bez pliku mieszczącego się w karcie. */
function siec({ pull = [] } = {}) {
    const wolania = [];
    return {
        wolania,
        fetch: async (url, init = {}) => {
            wolania.push([init.method ?? 'GET', url]);
            if (url.endsWith('/api/tags')) return json({ models: [{ name: 'hf.co/juz/jest:Q4_K_M' }] });
            if (url.includes('/api/models?search=')) return json([{ id: 'nowy/Model-8B-GGUF', downloads: 900, likes: 30 }, { id: 'juz/jest', downloads: 5000 }, { id: 'wielki/Model-70B-GGUF', downloads: 100 }, { id: 'zle id' }]);
            if (url.includes('/api/models/nowy/Model-8B-GGUF/tree/main')) return json([{ type: 'file', path: 'Model-8B-Q4_K_M.gguf', size: 5e9 }, { type: 'file', path: 'Model-8B-Q8_0.gguf', size: 8.7e9 }]);
            if (url.includes('/api/models/wielki/Model-70B-GGUF/tree/main')) return json([{ type: 'file', path: 'Model-70B-Q4_K_M.gguf', size: 42e9 }]);
            if (url.endsWith('/raw/main/README.md')) return json('# Model 8B\nDobry w kodzie i po polsku.');
            if (url.endsWith('/api/pull')) {
                const linie = pull.map((l) => JSON.stringify(l) + '\n');
                return { ok: true, status: 200, body: (async function* () { for (const l of linie) yield Buffer.from(l); })() };
            }
            return json({}, 404);
        },
    };
}

test('Zwiadowca: zwiad → nowy kandydat z opinią i meldunek na szynie; już pobrane i za duże pominięte; bez pobierania', async () => {
    const s = siec();
    const szyna = [];
    Zwiadowca.skonfiguruj({
        katalog: tmp(), fetch: s.fetch, vramGB: 12, wlaczony: true,
        pisz: async ({ prompt }) => { assert.match(prompt, /Dobry w kodzie/); return 'Nada się Kodeksowi do kodu po polsku.\ndruga linia'; },
        szyna: { nadaj: async (z) => { szyna.push(z); } },
    });
    await assert.rejects(Zwiadowca.zwiad({ zapytania: ['<script>'] }), /Podaj słowa/);
    const z = await Zwiadowca.zwiad({ zapytania: ['coder'] });
    assert.equal(z.sondaz, '/api/zwiadowca/sondaz');
    await assert.rejects(Zwiadowca.zwiad({ zapytania: ['coder'] }), /już jest w terenie/);
    await czekaj(() => Zwiadowca.sondaz().stan !== 'trwa');
    assert.equal(Zwiadowca.sondaz().stan, 'gotowe', Zwiadowca.sondaz().blad ?? '');
    const { kandydaci } = await Zwiadowca.kandydaci();
    assert.deepEqual(kandydaci.map((k) => [k.repo, k.kwant, k.gb, k.stan, k.ollama]), [['nowy/Model-8B-GGUF', 'Q4_K_M', 5, 'nowy', 'hf.co/nowy/Model-8B-GGUF:Q4_K_M']]);
    assert.equal(kandydaci[0].opinia, 'Nada się Kodeksowi do kodu po polsku.');
    assert.match(szyna.at(-1).tresc, /1 nowych modeli z HuggingFace czeka na akceptację \(np\. nowy\/Model-8B-GGUF Q4_K_M 5 GB\)/);
    assert.ok(!s.wolania.some(([, u]) => u.endsWith('/api/pull')), 'zwiad niczego nie pobiera');

    // Drugi zwiad nie melduje tego samego jeszcze raz.
    await Zwiadowca.zwiad({ zapytania: ['coder'] });
    await czekaj(() => Zwiadowca.sondaz().stan !== 'trwa');
    assert.equal((await Zwiadowca.kandydaci()).kandydaci.length, 1);
    assert.match(szyna.at(-1).tresc, /bez nowych modeli/);
});

test('Zwiadowca: akceptacja → ollama pull hf.co/…, karta modelu dla Dyrygenta; odrzucony znika z listy', async () => {
    const s = siec({ pull: [{ status: 'pulling manifest' }, { status: 'pulling abc', total: 100, completed: 50 }, { status: 'success' }] });
    const karty = [];
    Zwiadowca.skonfiguruj({ katalog: tmp(), fetch: s.fetch, pisz: async () => 'Dla Kodeksa.', szyna: null, ustawKarte: async (n, k) => { karty.push([n, k.opis]); } });
    await Zwiadowca.zwiad({ zapytania: ['coder'] });
    await czekaj(() => Zwiadowca.sondaz().stan !== 'trwa');
    const [k] = (await Zwiadowca.kandydaci()).kandydaci;
    const w = await Zwiadowca.akceptuj(k.id);
    assert.equal(w.ollama, 'hf.co/nowy/Model-8B-GGUF:Q4_K_M');
    await czekaj(async () => (await Zwiadowca.kandydaci()).kandydaci[0].stan !== 'pobiera');
    assert.equal((await Zwiadowca.kandydaci()).kandydaci[0].stan, 'pobrany');
    const pull = s.wolania.find(([m, u]) => m === 'POST' && u.endsWith('/api/pull'));
    assert.ok(pull, 'pull do Ollamy');
    assert.deepEqual(karty, [['hf.co/nowy/Model-8B-GGUF:Q4_K_M', 'Dla Kodeksa.']]);
    await assert.rejects(Zwiadowca.akceptuj(k.id), /już jest w Ollamie/);

    // Pobieranie urwane → stan „blad" z powodem; odrzucenie chowa kandydata.
    const s2 = siec({ pull: [{ status: 'pulling manifest' }, { error: 'pull model manifest: file does not exist' }] });
    Zwiadowca.skonfiguruj({ katalog: tmp(), fetch: s2.fetch, pisz: null, ustawKarte: null });
    await Zwiadowca.zwiad({ zapytania: ['coder'] });
    await czekaj(() => Zwiadowca.sondaz().stan !== 'trwa');
    const [k2] = (await Zwiadowca.kandydaci()).kandydaci;
    await Zwiadowca.akceptuj(k2.id);
    await czekaj(async () => (await Zwiadowca.kandydaci()).kandydaci[0].stan === 'blad');
    assert.match((await Zwiadowca.kandydaci()).kandydaci[0].blad, /file does not exist/);
    await Zwiadowca.odrzuc(k2.id);
    assert.equal((await Zwiadowca.kandydaci()).kandydaci.length, 0);
    assert.equal((await Zwiadowca.kandydaci({ wszystkie: true })).kandydaci[0].stan, 'odrzucony');
});

test('Zwiadowca: HuggingFace nieosiągalny → błąd wprost, a nie „bez nowych modeli"', async () => {
    const szyna = [];
    Zwiadowca.skonfiguruj({ katalog: tmp(), fetch: async (u) => (u.endsWith('/api/tags') ? json({ models: [] }) : json({}, 403)), szyna: { nadaj: async (z) => { szyna.push(z); } }, pisz: null });
    await Zwiadowca.zwiad({ zapytania: ['coder', 'polish'] });
    await czekaj(() => Zwiadowca.sondaz().stan !== 'trwa');
    assert.equal(Zwiadowca.sondaz().stan, 'blad');
    assert.match(Zwiadowca.sondaz().blad, /HuggingFace nieosiągalny \(HuggingFace: HTTP 403/);
    assert.match(szyna.at(-1).tresc, /zwiad przerwany/);
});

test('Pionek: w zespole pisze GDD i linię GRA:, Kodeks dostaje technikę; bez Pionka Kodeks jak dotąd; obaj mają karty roli', async () => {
    const z = ProjektStada.zaplanuj([{ id: 'pionek', imie: 'Pionek' }, { id: 'kodeks', imie: 'Kodeks' }, { id: 'rezyser', imie: 'Reżyser' }]);
    const zad = Object.fromEntries(z.filter((k) => !k.synteza).map((k) => [k.agent, k.zadanie]));
    assert.match(zad.pionek, /GRA: nazwa gry/);
    assert.equal(zad.kodeks, ProjektStada.KODEKS_Z_PIONKIEM);
    assert.doesNotMatch(zad.kodeks, /„GRA: nazwa/);
    const bez = ProjektStada.zaplanuj([{ id: 'kodeks', imie: 'Kodeks' }, { id: 'rezyser', imie: 'Reżyser' }]);
    assert.match(bez.find((k) => k.agent === 'kodeks').zadanie, /GRA: nazwa gry/);
    for (const id of ['pionek', 'zwiadowca']) {
        const k = await Persony.karta(id);
        assert.ok(k && k.tresc.includes('## Żelazne zasady'), `karta ${id}`);
    }
});
