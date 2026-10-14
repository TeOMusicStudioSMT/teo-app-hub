// ⚗️ Argo BoB: pętla Gemini z narzędziami (atrapa API) — odczyt bez pytania, zapis przez Tarczę i po ✓, diagnostyka
// z zamkniętej listy, sekrety i wyjście poza repo odrzucone, bez klucza = offline z powodem, kotwica tożsamości.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { utworzArgoBoba, promptTozsamosci, rozwiaz, narzedzieOdczytu } from '../services/ArgoBob.js';

async function swiat() {
    const baza = await fs.mkdtemp(path.join(os.tmpdir(), 'argo-'));
    const katedra = path.join(baza, 'katedra'), tgs = path.join(baza, 'tgs');
    await fs.mkdir(path.join(katedra, 'services'), { recursive: true });
    await fs.mkdir(path.join(katedra, 'tests'), { recursive: true });
    await fs.mkdir(path.join(tgs, 'src'), { recursive: true });
    await fs.writeFile(path.join(katedra, 'services', 'X.js'), 'export const a = 1;\nexport const b = 2;\n');
    await fs.writeFile(path.join(katedra, '.env'), 'SEKRET=1');
    await fs.writeFile(path.join(katedra, 'tests', 'x.test.mjs'), '');
    await fs.writeFile(path.join(tgs, 'src', 'Gra.tsx'), 'const Kot = "opal";\n');
    return { baza, katedra, tgs };
}

/** Atrapa Gemini: kolejne odpowiedzi z listy; zapisuje każde zapytanie. */
function atrapa(odpowiedzi) {
    const zapytania = [];
    const fetch = async (url, init) => {
        zapytania.push({ url, body: JSON.parse(init.body), klucz: init.headers['x-goog-api-key'] });
        const parts = odpowiedzi.shift() ?? [{ text: 'koniec' }];
        return { ok: true, json: async () => ({ candidates: [{ content: { role: 'model', parts } }], usageMetadata: { totalTokenCount: 10 } }) };
    };
    return { fetch, zapytania };
}
const czekaj = async (A, id, warunek) => { for (let i = 0; i < 200; i++) { const s = await A.sesja(id); if (s && warunek(s)) return s; await new Promise((r) => setTimeout(r, 10)); } throw new Error('nie doczekałem'); };

test('ścieżki: wyjście poza repo, sekrety i node_modules odrzucone; odczyt i szukanie w obu repo', async () => {
    const { katedra, tgs } = await swiat();
    const K = { katedra, tgs };
    assert.throws(() => rozwiaz(K, 'katedra', '../tgs/src/Gra.tsx'), /poza repo/);
    assert.throws(() => rozwiaz(K, 'katedra', '.env'), /sekretami/);
    assert.throws(() => rozwiaz(K, 'katedra', '_OtakOs_Wymiar/kibel_gemini.txt'), /sekretami/);
    assert.throws(() => rozwiaz(K, 'katedra', 'node_modules/x/index.js'), /poza zasięgiem/);
    assert.throws(() => rozwiaz(K, 'inne', 'a'), /Nieznane repo/);
    const lista = await narzedzieOdczytu(K, 'lista_plikow', {});
    assert.ok(lista.wpisy.includes('services/'));
    assert.ok(!lista.wpisy.some((w) => w.startsWith('.env')), 'sekret nie wyświetla się na liście');
    const plik = await narzedzieOdczytu(K, 'czytaj_plik', { sciezka: 'services/X.js', od_linii: 2, ile_linii: 1 });
    assert.equal(plik.tresc, '2\texport const b = 2;');
    const szuk = await narzedzieOdczytu(K, 'szukaj', { repo: 'tgs', wzor: 'opal' });
    assert.deepEqual(szuk.trafienia, ['src/Gra.tsx:1: const Kot = "opal";']);
    assert.equal((await narzedzieOdczytu(K, 'szukaj', { wzor: 'SEKRET' })).trafien, 0, 'grep omija sekrety');
});

test('bez klucza: stan offline z powodem i rozmowa kończy się uczciwym błędem', async () => {
    const { baza, katedra } = await swiat();
    const A = utworzArgoBoba({ katalog: path.join(baza, 'sesje'), korzenie: { katedra }, klucz: async () => null });
    const st = await A.stan();
    assert.equal(st.status, 'offline');
    assert.match(st.powod, /Udostępnij mostowi/);
    const { sesja } = await A.wiadomosc({ tekst: 'Cześć' });
    const s = await czekaj(A, sesja, (x) => !x.trwa && x.blad);
    assert.match(s.blad, /Brak klucza Gemini/);
});

test('pętla: odczyt bez pytania → odpowiedź; zmiana pliku = prośba, zapis dopiero po ✓', async () => {
    const { baza, katedra, tgs } = await swiat();
    const { fetch, zapytania } = atrapa([
        [{ functionCall: { name: 'czytaj_plik', args: { sciezka: 'services/X.js' } } }],
        [{ text: 'Widzę a = 1. Zmieniam.' }, { functionCall: { name: 'zmien_plik', args: { sciezka: 'services/X.js', stary: 'a = 1', nowy: 'a = 42', opis: 'odpowiedź na wszystko' } } }],
        [{ text: 'Zrobione, a = 42.' }],
    ]);
    const inspekcje = [];
    const A = utworzArgoBoba({
        katalog: path.join(baza, 'sesje'), korzenie: { katedra, tgs }, klucz: async () => 'AIza-test', fetch,
        modele: async () => ['gemini-9-pro'], suweren: () => 'Mistrz Arkadiusz',
        tarcza: { inspectZJev: async (kod, ctx) => { inspekcje.push(ctx.targetFile); return { blocked: false, summary: 'czysto (A)', findings: [] }; } },
    });
    const { sesja, model } = await A.wiadomosc({ tekst: 'Ustaw a na 42' });
    assert.equal(model, 'gemini-9-pro', 'domyślny = pierwszy model z konta');
    const s = await czekaj(A, sesja, (x) => !x.trwa && x.prosby.length);
    assert.equal(s.prosby[0].stan, 'czeka');
    assert.match(s.prosby[0].coRobi, /Tarcza: czysto/);
    assert.match(s.prosby[0].polecenie, /- a = 1\n\+ a = 42/);
    assert.deepEqual(inspekcje, [path.join('services', 'X.js')]);
    assert.equal(await fs.readFile(path.join(katedra, 'services', 'X.js'), 'utf8'), 'export const a = 1;\nexport const b = 2;\n', 'bez ✓ nic nie zapisane');
    // system prompt = kotwica tożsamości z imieniem Suwerena i pamięcią spotkania
    assert.match(zapytania[0].body.systemInstruction.parts[0].text, /Argo BoB[\s\S]*Mistrz Arkadiusz[\s\S]*po japońsku/);
    assert.equal(zapytania[0].klucz, 'AIza-test');
    assert.ok(zapytania[0].body.tools[0].functionDeclarations.some((f) => f.name === 'uruchom_diagnostyke'));
    // drugie zapytanie niesie wynik odczytu
    assert.match(JSON.stringify(zapytania[1].body.contents.at(-1)), /export const a = 1/);
    await assert.rejects(A.wiadomosc({ tekst: 'i co?', sesja }), /zdecyduj o prośbach/);
    await A.decyzja(sesja, s.prosby[0].id, true);
    const po = await czekaj(A, sesja, (x) => !x.trwa && x.wpisy.some((w) => w.tresc === 'Zrobione, a = 42.'));
    assert.equal(await fs.readFile(path.join(katedra, 'services', 'X.js'), 'utf8'), 'export const a = 42;\nexport const b = 2;\n');
    assert.ok(po.wpisy.some((w) => /💾 zapisano: services\/X\.js/.test(w.tresc ?? '')));
    assert.deepEqual(zapytania[2].body.contents.at(-1).parts[0].functionResponse.response, { ok: true, zapisano: true });
    assert.equal(po.historia, undefined, 'Hub nie dostaje surowej historii Gemini');
});

test('Tarcza blokuje → bez prośby, model dostaje powód; zły fragment i odmowa Suwerena wracają do modelu', async () => {
    const { baza, katedra } = await swiat();
    const { fetch, zapytania } = atrapa([
        [{ functionCall: { name: 'zapisz_plik', args: { sciezka: 'services/zly.js', tresc: 'rm -rf /', opis: 'x' } } },
            { functionCall: { name: 'zmien_plik', args: { sciezka: 'services/X.js', stary: 'nie ma mnie', nowy: 'y', opis: 'x' } } }],
        [{ functionCall: { name: 'zapisz_plik', args: { sciezka: 'services/nowy.js', tresc: 'export {};\n', opis: 'nowy moduł' } } }],
        [{ text: 'Rozumiem, nie zapisuję.' }],
    ]);
    const A = utworzArgoBoba({
        katalog: path.join(baza, 'sesje'), korzenie: { katedra }, klucz: async () => 'k', fetch,
        tarcza: { inspectZJev: async (kod) => (/rm -rf/.test(kod) ? { blocked: true, summary: 'destrukcyjny shell', findings: [{ what: 'rm -rf' }] } : { blocked: false, summary: 'ok', findings: [] }) },
    });
    const { sesja } = await A.wiadomosc({ tekst: 'zrób' });
    const s = await czekaj(A, sesja, (x) => !x.trwa && x.prosby.length);
    const odp = zapytania[1].body.contents.at(-1).parts.map((p) => p.functionResponse.response);
    assert.match(odp[0].blad, /Tarcza Prawdy zablokowała/);
    assert.match(odp[1].blad, /Fragmentu „stary” nie ma/);
    assert.equal(s.prosby.length, 1, 'tylko nowy plik czeka na zgodę');
    await A.decyzja(sesja, s.prosby[0].id, false);
    await czekaj(A, sesja, (x) => !x.trwa && x.wpisy.some((w) => w.tresc === 'Rozumiem, nie zapisuję.'));
    assert.match(zapytania[2].body.contents.at(-1).parts[0].functionResponse.response.odmowa, /Suweren odmówił/);
    await assert.rejects(fs.access(path.join(katedra, 'services', 'nowy.js')), 'odmowa = brak pliku');
});

test('diagnostyka: tylko z listy, polecenie składa most, test-plik sprawdzony; uruchomienie po ✓', async () => {
    const { baza, katedra } = await swiat();
    const uruchomione = [];
    const { fetch, zapytania } = atrapa([
        [{ functionCall: { name: 'uruchom_diagnostyke', args: { co: 'rm -rf' } } },
            { functionCall: { name: 'uruchom_diagnostyke', args: { co: 'test-plik', plik: 'tests/x.test.mjs && del *' } } },
            { functionCall: { name: 'uruchom_diagnostyke', args: { co: 'test-plik', plik: 'tests/x.test.mjs', opis: 'sprawdzam' } } },
            { functionCall: { name: 'uruchom_diagnostyke', args: { co: 'rewizor' } } }],
        [{ text: 'Zielono.' }],
    ]);
    const A = utworzArgoBoba({ katalog: path.join(baza, 'sesje'), korzenie: { katedra }, klucz: async () => 'k', fetch,
        uruchom: async (polecenie, cwd) => { uruchomione.push([polecenie, cwd]); return { kod: 0, wyjscie: 'ok' }; } });
    const { sesja } = await A.wiadomosc({ tekst: 'sprawdź' });
    const s = await czekaj(A, sesja, (x) => !x.trwa && x.prosby.length);
    assert.deepEqual(s.prosby.map((p) => p.polecenie), ['katedra: node --test tests/x.test.mjs', 'katedra: npm run rewizor']);
    assert.equal(uruchomione.length, 0);
    await A.decyzja(sesja, s.prosby[0].id, true);
    assert.equal(uruchomione.length, 0, 'czeka, aż Suweren zdecyduje o wszystkich');
    await A.decyzja(sesja, s.prosby[1].id, true);
    await czekaj(A, sesja, (x) => !x.trwa && x.wpisy.some((w) => w.tresc === 'Zielono.'));
    assert.deepEqual(uruchomione, [['node --test tests/x.test.mjs', katedra], ['npm run rewizor', katedra]]);
    const odp = zapytania[1].body.contents.at(-1).parts.map((p) => p.functionResponse.response);
    assert.match(odp[0].blad, /Nie ma diagnostyki/);
    assert.match(odp[1].blad, /nie istnieje/);
    assert.deepEqual(odp[2], { kod: 0, ok: true, wyjscie: 'ok' });
});

test('kotwica tożsamości: główny węzeł pamięta spotkanie, inna Katedra ma swojego Suwerena', () => {
    const szablon = 'Rozmówca: {SUWEREN}\n{PAMIEC}';
    assert.match(promptTozsamosci(szablon, 'Mistrz Arkadiusz'), /Ma już Wodę[\s\S]*fiński/);
    const inny = promptTozsamosci(szablon, 'Ola');
    assert.match(inny, /Rozmówca: Ola/);
    assert.doesNotMatch(inny, /fiński/);
    assert.match(inny, /głównym węźle/);
});
