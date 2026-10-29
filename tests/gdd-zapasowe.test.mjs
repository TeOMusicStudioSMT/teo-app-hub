// ↻ Zapasowe modele produkcji GDD: zadanie, które padło na głównym modelu, próbuje następnego; model, który zrobił
// zadanie, prowadzi dalej. Suweren 2026-10-06: „…nie umie innych spróbować… może Dyrygent do tego nie dobiera”.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import Gdd from '../services/Gdd.js';

test('listaZapasowych: bez dubli, bez głównego, najwyżej 3', () => {
    assert.deepEqual(Gdd.listaZapasowych('a', ['b', 'a', 'b', '', 'c', 'd', 'e']), ['b', 'c', 'd']);
    assert.deepEqual(Gdd.listaZapasowych('a', null), []);
});

async function projekt(zadan) {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'gdd-zap-'));
    await fs.mkdir(path.join(kat, 'gra'), { recursive: true });
    const g = { wersja: 1, tytul: 'Teterhia', gatunek: 'RPG', silnik: 'three', sekcje: {}, galezie: [], historia: [],
        kamienie: [{ id: 'k1', tytul: 'Wędrowiec', opis: 'ruch', zadania: Array.from({ length: zadan }, (_, i) => ({ id: `z${i}`, tresc: `zadanie ${i}`, stan: 'czeka' })) }] };
    await fs.writeFile(path.join(kat, 'gra', 'gdd.json'), JSON.stringify(g));
    return kat;
}
async function koniec(id) { for (let i = 0; i < 200; i++) { const p = Gdd.produkcja(id); if (p && p.stan !== 'trwa') return p; await new Promise((r) => setTimeout(r, 5)); } throw new Error('produkcja nie skończyła'); }

function atrapaStudia(dobre) {
    const zadania = new Map(); const wywolania = []; const dziedzictwa = [];
    return { wywolania, dziedzictwa, appStudio: {
        async buduj(_p, { model, dziedzictwo }) { dziedzictwa.push(dziedzictwo); const id = `t${zadania.size}`; const m = dziedzictwo?.spa ? `${model}+spa` : model; wywolania.push(m); zadania.set(id, { stan: dobre.has(m) ? 'gotowe' : 'blad', wynik: dobre.has(m) ? { ok: true, rundy: 1, sekundy: 1 } : { ok: false, powod: 'Oddałeś 2 pliki IDENTYCZNE' } }); return { id }; },
        zadanie: (id) => zadania.get(id),
    } };
}

test('główny pada → zapasowy robi zadanie i prowadzi dalej', async () => {
    const kat = await projekt(3);
    const a = atrapaStudia(new Set(['qwen2.5-coder:7b']));
    Gdd.skonfiguruj({ katalog: kat, appStudio: a.appStudio, odstepSondazuMs: 1, szyna: null });
    const start = await Gdd.realizuj('gra', { model: 'hf.co/x/Qwen3-Coder-30B:IQ1_M', zapasowe: ['claude:claude-sonnet-5-5', 'qwen2.5-coder:7b'] });
    assert.deepEqual(start.zapasowe, ['claude:claude-sonnet-5-5', 'qwen2.5-coder:7b']);
    const p = await koniec('gra');
    assert.equal(p.stan, 'gotowe');
    assert.equal(p.zrobione, 3);
    assert.deepEqual(a.wywolania, ['hf.co/x/Qwen3-Coder-30B:IQ1_M', 'claude:claude-sonnet-5-5', 'qwen2.5-coder:7b', 'qwen2.5-coder:7b', 'qwen2.5-coder:7b'], 'zadanie 1 przez łańcuch, potem już działający model');
    assert.equal(p.model, 'qwen2.5-coder:7b');
    assert.ok(p.kroki.some((k) => /próbuję zapasowym: qwen2\.5-coder:7b/.test(k.tekst)));
    const g = JSON.parse(await fs.readFile(path.join(kat, 'gra', 'gdd.json'), 'utf8'));
    assert.ok(g.kamienie[0].zadania.every((z) => z.stan === 'gotowe'));
});

test('wszystkie modele padły → stop, zadanie z błędem, reszta czeka; bez zapasowych jak dawniej', async () => {
    const kat = await projekt(2);
    const a = atrapaStudia(new Set());
    Gdd.skonfiguruj({ katalog: kat, appStudio: a.appStudio, odstepSondazuMs: 1, szyna: null });
    await Gdd.realizuj('gra', { model: 'm1', zapasowe: ['m2'] });
    const p = await koniec('gra');
    assert.equal(p.stan, 'blad');
    assert.deepEqual(a.wywolania, ['m1', 'm2', 'm1+spa'], 'po łańcuchu jedno spokojne podejście głównego modelu');
    assert.ok(p.kroki.some((k) => /🛁 SPA nie pomogło/.test(k.tekst)));
    assert.ok(p.kroki.some((k) => /na wszystkich 2 modelach/.test(k.tekst)));
    const g = JSON.parse(await fs.readFile(path.join(kat, 'gra', 'gdd.json'), 'utf8'));
    assert.deepEqual(g.kamienie[0].zadania.map((z) => z.stan), ['blad', 'czeka']);
});

test('☁️ chmura po chmurze: główny z chmury → inna chmura przed lokalnym; wybór Suwerena pierwszy', () => {
    const dost = ['claude:claude-haiku-5-5', 'claude:claude-sonnet-5-5', 'claude:claude-opus-5-5', 'gemini:gemini-3.8-flash', 'gemini:gemini-3.5-flash'];
    const ling = 'hf.co/mradermacher/Ling-3.0-tiny:Q4_K_M';
    // nic z chmury nie zaznaczone → najmocniejszy Gemini (inny dostawca), potem Opus; Ling na końcu
    assert.deepEqual(Gdd.zapasoweChmuraPoChmurze('claude:claude-sonnet-5-5', [ling], dost), ['gemini:gemini-3.8-flash', 'claude:claude-opus-5-5', ling]);
    // Suweren zaznaczył Opusa → jego wybór, lokalny dalej po chmurze
    assert.deepEqual(Gdd.zapasoweChmuraPoChmurze('claude:claude-sonnet-5-5', [ling, 'claude:claude-opus-5-5'], dost), ['claude:claude-opus-5-5', ling]);
    // główny lokalny → bez zmian
    assert.deepEqual(Gdd.zapasoweChmuraPoChmurze('qwen2.5-coder:7b', [ling], dost), [ling]);
    // Gemini główny → Opus (inna głowa), słabszych Gemini nie bierze
    assert.deepEqual(Gdd.zapasoweChmuraPoChmurze('gemini:gemini-3.8-flash', [], dost), ['claude:claude-opus-5-5']);
});

test('☁️ produkcja: Sonnet pada → Gemini z mostu robi zadanie, Ling nietknięty', async () => {
    const kat = await projekt(1);
    const a = atrapaStudia(new Set(['gemini:gemini-3.8-flash']));
    Gdd.skonfiguruj({ katalog: kat, appStudio: a.appStudio, odstepSondazuMs: 1, szyna: null, modeleChmury: async () => ['claude:claude-sonnet-5-5', 'gemini:gemini-3.8-flash'] });
    const start = await Gdd.realizuj('gra', { model: 'claude:claude-sonnet-5-5', zapasowe: ['ling:tiny'] });
    assert.deepEqual(start.zapasowe, ['gemini:gemini-3.8-flash', 'ling:tiny']);
    const p = await koniec('gra');
    assert.equal(p.stan, 'gotowe');
    assert.deepEqual(a.wywolania, ['claude:claude-sonnet-5-5', 'gemini:gemini-3.8-flash']);
    Gdd.skonfiguruj({ modeleChmury: undefined });
});

test('🛁 SPA: łańcuch poległ, spokojne podejście głównego modelu robi zadanie', async () => {
    const kat = await projekt(1);
    const a = atrapaStudia(new Set(['m1+spa']));
    Gdd.skonfiguruj({ katalog: kat, appStudio: a.appStudio, odstepSondazuMs: 1, szyna: null });
    await Gdd.realizuj('gra', { model: 'm1', zapasowe: ['m2'] });
    const p = await koniec('gra');
    assert.equal(p.stan, 'gotowe');
    assert.deepEqual(a.wywolania, ['m1', 'm2', 'm1+spa']);
    assert.ok(p.kroki.some((k) => /🛁 SPA pomogło/.test(k.tekst)));
});

test('🛁 SPA = kąpiel BEZ kodu: model mówi słowami (bez plików i sędziów), „Aha” bez bloków kodu idzie do podejścia po kąpieli', async () => {
    const kat = await projekt(1);
    const a = atrapaStudia(new Set(['m1+spa']));
    const kapiele = [];
    const pisz = async ({ system, prompt, model }) => {
        kapiele.push({ system, prompt, model });
        return { tekst: '<think>hmm</think>Zadanie potrzebuje tylko oceny tekstu.\nWcześniej pisałem atrapy bez wywołania.\n```ts\nexport const x = 1;\n```\nNajmniejszy ruch: jeden nowy plik, który słucha złożenia próby.' };
    };
    Gdd.skonfiguruj({ katalog: kat, appStudio: a.appStudio, odstepSondazuMs: 1, szyna: null, pisz });
    await Gdd.realizuj('gra', { model: 'm1', zapasowe: ['m2'] });
    const p = await koniec('gra');
    Gdd.skonfiguruj({ pisz: null });
    assert.equal(p.stan, 'gotowe');
    assert.equal(kapiele.length, 1, 'jedna kąpiel, tylko po porażce całego łańcucha');
    assert.equal(kapiele[0].model, 'm1');
    assert.match(kapiele[0].system, /NIE jest praca/);
    assert.match(kapiele[0].system, /Nie piszesz kodu/);
    assert.match(kapiele[0].prompt, /NIE rób go teraz/);
    assert.match(kapiele[0].prompt, /pliki IDENTYCZNE/, 'jedna przeszkoda — ostatni błąd');
    const poSpa = a.dziedzictwa.at(-1);
    assert.equal(poSpa.spa, true);
    assert.doesNotMatch(poSpa.aha, /think|```|export const/, 'z kąpieli wychodzą słowa, nie kod');
    assert.match(poSpa.aha, /jeden nowy plik/);
    assert.ok(p.kroki.some((k) => /🛁 SPA — kąpiel bez kodu/.test(k.tekst)));
    assert.ok(p.kroki.some((k) => /💡 Aha z kąpieli/.test(k.tekst)));
    assert.ok(p.kroki.some((k) => /🌅 Po SPA/.test(k.tekst)));
    assert.equal(Gdd.odczytajAha('```js\nx\n```'), null, 'sam kod = bez Aha');
});
