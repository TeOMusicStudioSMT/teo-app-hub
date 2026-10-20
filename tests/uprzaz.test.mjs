// 🧬 Harness² po katedralnemu — zmiany uprzęży z zamkniętych rodzajów, Propose–Probe–Compose na tym samym materiale
// (atrapa modelu i Jev), zeszyt lekcji z dowodami, ✓ Suwerena, aktywna uprząż w scenariuszu Zebrra News, trasy HTTP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzUprzaz, zamontujTrasyUprzezy, zadanieZebrraNews, oczyscZmiane, blokUprzezy, zloz, odczytajPropozycje, twardeNews, pytaniaJevNews, ocenyZJev, ocenySedziegoLokalnego, wynikWersji, promptPropozycji } from '../services/Uprzaz.js';
import { promptScenariusza, utworzZebrraNews } from '../services/ZebrraNews.js';

const ODCINEK = {
    id: 'n-0000beef', dzien: '2026-10-20', jezyk: 'en', narrator: 'zebra', wspolprowadzacy: ['lew'], stan: 'studio', utworzono: '2026-10-20T08:00:00Z',
    newsy: [
        { tytul: 'Amelia Earhart plane wreckage identified as trees', opis: 'Researchers say the expedition was still worthwhile despite coming up empty-handed.', zrodlo: 'ABC News (Australia)', dziedzina: 'kultura', region: 'Oceania' },
        { tytul: 'Japan launches mission to Mars moon Phobos', opis: 'A five-year uncrewed mission to collect samples.', zrodlo: 'Al Jazeera', dziedzina: 'kosmos', region: 'space' },
        { tytul: 'Alberta voters back remaining in Canada', opis: 'Early referendum results on Tuesday.', zrodlo: 'NPR', dziedzina: 'polityka', region: 'North America' },
    ],
};
const PUENTA = 'Say the twist of the headline in plain words';
const scen = (dobry) => [
    'INTRO: Welcome to Zebrra News.',
    dobry ? 'NEWS 1: The famous wreckage turned out to be just trees, yet the team says the trip was worth it. Reports ABC News Australia.'
        : 'NEWS 1: Researchers believe the identification was still valuable for a great mystery. Reports ABC News Australia.',
    'NEWS 2: Japan launched a five-year mission to bring samples from Phobos. Reports Al Jazeera.',
    'NEWS 3: Alberta voted to stay in Canada. Reports NPR.',
    'OUTRO: Good evening.',
].join('\n');

/** Atrapa modelu: ulepszacz, sędzia i scenarzysta rozpoznani po systemie; dobra puenta tylko z dodatkiem PUENTA. */
function atrapa({ zlyJson = 0 } = {}) {
    const wolania = [];
    const chat = async (model, system, user, opcje = {}) => {
        wolania.push({ model, system, user, opcje });
        if (/ulepszaczem UPRZĘŻY/.test(system)) {
            if (zlyJson-- > 0) return { tekst: 'nie wiem' };
            return { tekst: JSON.stringify({ kandydaci: [
                { nazwa: 'puenta', zmiany: [{ rodzaj: 'zasada', tresc: PUENTA, dlaczego: 'NEWS 1 rozmyty' }] },
                { nazwa: 'zrodla', zmiany: [{ rodzaj: 'wskazowka', tresc: 'Name the newsroom once at the end of each story', dlaczego: 'źródła' }, { rodzaj: 'magia', tresc: 'xxxxxxxxxx' }] },
            ] }) };
        }
        if (/surowym sędzią/.test(system)) {
            const wersje = [...user.matchAll(/=== WERSJA ([A-Z]) ===\n([\s\S]*?)(?=\n\n=== WERSJA|\n\nDla każdej)/g)];
            const puenty = Object.fromEntries(wersje.map(([, l, t]) => [l, [/turned out/.test(t) ? 1 : 0, 1, 1]]));
            const naj = wersje.find(([, , t]) => /turned out/.test(t))?.[1] ?? 'A';
            return { tekst: JSON.stringify({ puenty, najlepsza: naj, dlaczego: 'puenta' }) };
        }
        return { tekst: scen(system.includes(PUENTA)) };
    };
    return { chat, wolania };
}
const news = (odc = ODCINEK) => ({ lista: async () => [odc], wczytaj: async (id) => { if (id !== odc.id) throw new Error('Nie ma takiego odcinka.'); return structuredClone(odc); } });
const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'uprzaz-'));

test('zmiany: zamknięte rodzaje, skill i styl tylko z istniejących list, blok tekstu, złożenie bez dubli', () => {
    assert.throws(() => oczyscZmiane({ rodzaj: 'magia', tresc: 'cokolwiek długiego' }), /nieznany rodzaj/);
    assert.throws(() => oczyscZmiane({ rodzaj: 'zasada', tresc: 'krótko' }), /bez treści/);
    assert.throws(() => oczyscZmiane({ rodzaj: 'skill', ref: 'nie/ma' }, { skille: [{ id: 'a/b', opis: 'x' }] }), /nie istnieje/);
    const sk = oczyscZmiane({ rodzaj: 'skill', ref: 'a/b', tresc: 'model pisze bzdury' }, { skille: [{ id: 'a/b', opis: 'opis skilla' }] });
    assert.equal(sk.tresc, 'opis skilla', 'treść skilla z katalogu, nie od modelu');
    const st = oczyscZmiane({ rodzaj: 'styl', ref: '2' }, { zasadyStylu: ['jedna', 'Krótko i ciepło.'] });
    assert.equal(st.tresc, 'Krótko i ciepło.');
    assert.throws(() => oczyscZmiane({ rodzaj: 'styl', ref: 9 }, { zasadyStylu: ['x'] }), /nie istnieje/);
    const z = oczyscZmiane({ rodzaj: 'zasada', tresc: PUENTA });
    assert.match(blokUprzezy([z, st]), /DODATKI UPRZĘŻY[\s\S]*- ZASADA: Say the twist[\s\S]*- STYL SUWERENA: Krótko/);
    assert.equal(blokUprzezy([]), '');
    assert.equal(zloz([z], [z, st], [st]).length, 2);
});

test('propozycje: JSON → ≤ k kandydatów, złe zmiany odpadają z powodem, duble i to, co już jest, pomijane', () => {
    const t = JSON.stringify({ kandydaci: [
        { nazwa: 'a', zmiany: [{ rodzaj: 'zasada', tresc: PUENTA }] },
        { nazwa: 'dubel', zmiany: [{ rodzaj: 'zasada', tresc: PUENTA }] },
        { nazwa: 'zly', zmiany: [{ rodzaj: 'magia', tresc: 'xxxxxxxxxx' }] },
        { nazwa: 'b', zmiany: [{ rodzaj: 'persona', tresc: 'Zlat speaks humbly about serious news' }] },
    ] });
    const r = odczytajPropozycje(`<think>hm</think>${t}`, { k: 3 });
    assert.deepEqual(r.kandydaci.map((k) => k.nazwa), ['a', 'b']);
    assert.ok(r.odrzucone.some((x) => /nieznany rodzaj/.test(x)));
    assert.throws(() => odczytajPropozycje(t, { k: 2, bazowe: [oczyscZmiane({ rodzaj: 'zasada', tresc: PUENTA }), oczyscZmiane({ rodzaj: 'persona', tresc: 'Zlat speaks humbly about serious news' })] }), /żadnej poprawnej/);
    assert.throws(() => odczytajPropozycje('nie json', {}), /JSON/);
    const p = promptPropozycji({ zadanie: { nazwa: 'Z', opis: 'o' }, czesci: 'c', baza: { tekst: 'x', uwagi: ['NEWS 1: puenta rozmyta'] }, lekcje: [{ efekt: 'zaszkodzila', delta: -0.2, zmiana: { rodzaj: 'zasada', tresc: 'stara' } }], k: 2 });
    assert.match(p.user, /NIE proponuj ponownie[\s\S]*stara/);
    assert.match(p.system, /Nie piszesz odpowiedzi na zadanie/, 'bez wzorcowych odpowiedzi');
});

test('twarde sprawdziany i sędziowie: format/liczby konieczne, źródła punktowane, Jev noul+choice, sędzia lokalny', () => {
    const ok = twardeNews(scen(true), ODCINEK);
    assert.equal(ok.ok, true); assert.equal(ok.punkty, 1);
    assert.equal(twardeNews('INTRO: x\nOUTRO: y', ODCINEK).ok, false);
    const liczby = twardeNews(scen(true).replace('five-year', '7-year'), ODCINEK);
    assert.equal(liczby.ok, false); assert.match(liczby.bledy[0], /liczby spoza/);
    const bezZrodla = twardeNews(scen(true).replace('Reports NPR.', ''), ODCINEK);
    assert.ok(bezZrodla.ok && bezZrodla.punkty < 1 && bezZrodla.bledy.some((b) => /NEWS 3: brak źródła/.test(b)));
    const w = [{ tekst: scen(false) }, { tekst: scen(true) }];
    const { questions, state } = pytaniaJevNews(ODCINEK, w);
    assert.equal(Object.keys(questions).length, 2 * 3 + 1);
    assert.equal(questions.najlepsza.type, 'choice'); assert.match(state.wersja_B, /turned out/);
    const oc = ocenyZJev({ answers: { p_A_1: { noul: 0.1 }, p_A_2: { noul: 0.9 }, p_A_3: { noul: 0.8 }, p_B_1: { noul: 0.9 }, p_B_2: { noul: 0.9 }, p_B_3: { noul: 0.8 }, najlepsza: { probabilities: { A: 0.2, B: 0.8 } } } }, ODCINEK, w);
    assert.ok(wynikWersji(ok, oc[1]) > wynikWersji(ok, oc[0]));
    assert.equal(wynikWersji(liczby, oc[1]), -1, 'twardy błąd przegrywa zawsze');
    const lok = ocenySedziegoLokalnego('{"puenty":{"A":[0,1,1],"B":[1,1,1]},"najlepsza":"B"}', ODCINEK, w);
    assert.deepEqual(lok.oceny.map((o) => o.wybor), [0, 1]);
    assert.throws(() => ocenySedziegoLokalnego('{"najlepsza":"Z"}', ODCINEK, w), /spoza wersji/);
});

test('Propose–Probe–Compose: ta sama treść dla wersji, zwycięzca do ✓, zeszyt z dowodami, ✓ → aktywna w scenariuszu Zebrra News', async () => {
    const kat = await tmp();
    const { chat, wolania } = atrapa();
    const decyzje = [], wiesci = [];
    const U = utworzUprzaz({ katalog: kat, chat, zadania: [zadanieZebrraNews({ news: news(), modelDla: async () => 'model-zebry' })], jajo: { decyzja: async (d) => decyzje.push(d), wiesc: async (w) => wiesci.push(w) } });
    const p0 = await U.uruchom({ zadanie: 'zebrra-news-scenariusz', material: ODCINEK.id, k: 2, glebokosc: 2 });
    await U.czekaj();
    const p = await U.przebieg(p0.id);
    assert.equal(p.stan, 'gotowy', p.powod);
    const r1 = p.rundy[0];
    assert.equal(r1.wersje.length, 3);
    assert.equal(r1.sedzia.kto, 'model lokalny (model-zebry)');
    assert.match(r1.sedzia.uwaga, /model lokalny/, 'bez Jev — uczciwa adnotacja');
    assert.deepEqual(r1.zwyciezcy, ['B']);
    assert.ok(r1.propozycje.odrzucone.some((x) => /magia/.test(x)));
    const scenariusze = wolania.filter((w) => /FORMAT \(każda linia/.test(w.system));
    assert.ok(scenariusze.every((w) => w.user === scenariusze[0].user && w.model === 'model-zebry' && w.opcje.temperatura === 0.3), 'to samo zadanie, ten sam model i temperatura');
    assert.ok(p.propozycja, 'nowa uprząż');
    assert.equal(p.rundy.length, 2, 'druga runda od zwycięzcy, potem nic lepszego = koniec');
    const lekcje = await U.lekcje();
    const puenta = lekcje.find((l) => l.zmiana.tresc === PUENTA);
    assert.equal(puenta.efekt, 'pomogla');
    assert.equal(puenta.dowod.przebieg, p.id); assert.equal(puenta.dowod.wersja, 'B');
    // lekcje z rundy 1 trafiły do Propose w rundzie 2
    assert.match(wolania.filter((w) => /ulepszaczem/.test(w.system))[1].user, /ZESZYT LEKCJI[\s\S]*pomogła/);
    assert.equal(wiesci.length, 1);
    // przed ✓ nic nie działa
    assert.equal(await U.aktywna('zebrra-news-scenariusz'), null);
    const u = await U.przyjmij(p.propozycja);
    assert.equal(u.stan, 'aktywna');
    assert.equal(decyzje[0].werdykt, 'przyjeta');
    const akt = await U.aktywna('zebrra-news-scenariusz');
    assert.match(akt.blok, /Say the twist/);
    assert.match(promptScenariusza(ODCINEK, { uprzaz: akt.blok }).system, /DODATKI UPRZĘŻY[\s\S]*FORMAT/);
    // serwis News bierze aktywną uprząż przy pisaniu scenariusza
    let systemNews = '';
    const N = utworzZebrraNews({ katalog: kat, katalogMontazy: async () => kat, chat: async (_m, sys) => { if (/FORMAT \(każda/.test(sys)) systemNews = sys; return { tekst: /redaktorem/.test(sys) ? '' : scen(true) }; }, uprzaz: (z) => U.aktywna(z), fetch: async () => { throw new Error('bez sieci'); } });
    const plik = path.join(kat, 'zebrra-news', ODCINEK.id, 'odcinek.json');
    await fs.mkdir(path.dirname(plik), { recursive: true });
    await fs.writeFile(plik, JSON.stringify({ ...ODCINEK, scenariusz: null }), 'utf8');
    await N.ponow(ODCINEK.id);
    await N.czekaj();
    assert.match(systemNews, /DODATKI UPRZĘŻY[\s\S]*Say the twist/, 'scenariusz News pisany z aktywną uprzężą');
    assert.equal((await N.wczytaj(ODCINEK.id)).uprzaz, u.id, 'odcinek pamięta, z jaką uprzężą powstał');
    // drugi przebieg startuje od aktywnej
    const p2 = await U.uruchom({ zadanie: 'zebrra-news-scenariusz', material: ODCINEK.id, k: 1 });
    assert.equal(p2.start.uprzaz, u.id);
    await U.czekaj();
    assert.equal((await U.wycofaj('zebrra-news-scenariusz')).stan, 'wycofana');
    assert.equal(await U.aktywna('zebrra-news-scenariusz'), null);
});

test('Propose: zły JSON = jedna poprawka; brak zwycięzcy = brak propozycji; Jev zamiast sędziego lokalnego', async () => {
    const kat = await tmp();
    const { chat, wolania } = atrapa({ zlyJson: 1 });
    const jevPyt = [];
    const jev = { stan: () => ({ maKlucz: true }), zapytaj: async ({ questions }) => { jevPyt.push(questions); const a = {}; for (const k of Object.keys(questions)) a[k] = k === 'najlepsza' ? { probabilities: Object.fromEntries(Object.keys(questions.najlepsza.criteria).map((l) => [l, 1 / Object.keys(questions.najlepsza.criteria).length])) } : { noul: 0.5 }; return { model: 'jev-latest', answers: a }; } };
    const U = utworzUprzaz({ katalog: kat, chat, jev, zadania: [zadanieZebrraNews({ news: news() })] });
    const p0 = await U.uruchom({ zadanie: 'zebrra-news-scenariusz', material: ODCINEK.id, k: 2 });
    await U.czekaj();
    const p = await U.przebieg(p0.id);
    assert.equal(p.stan, 'gotowy', p.powod);
    assert.equal(wolania.filter((w) => /ulepszaczem/.test(w.system)).length, 2, 'zły JSON → druga próba z powodem');
    assert.equal(p.rundy[0].sedzia.kto, 'Jev (jev-latest)');
    assert.equal(wolania.filter((w) => /surowym sędzią/.test(w.system)).length, 0, 'z kluczem Jev model lokalny nie sędziuje');
    assert.ok(jevPyt.length >= 2);
    assert.equal(p.propozycja, null, 'Jev nie widzi różnicy → nic do ✓');
    assert.ok((await U.lekcje()).every((l) => l.efekt === 'bez-zmian'));
    await assert.rejects(U.uruchom({ zadanie: 'nie-ma', material: 'x' }), /Nie ma zadania/);
    await assert.rejects(U.przyjmij('u-zle'), /Złe id/);
});

test('trasy HTTP: stan, materiały, przebieg, ✓/✖, wycofaj', async () => {
    const kat = await tmp();
    const { chat } = atrapa();
    const U = utworzUprzaz({ katalog: kat, chat, zadania: [zadanieZebrraNews({ news: news() })] });
    const app = express(); app.use(express.json()); zamontujTrasyUprzezy(app, U);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    try {
        const j = async (m, u, b) => (await fetch(`${baza}${u}`, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
        const st = await j('GET', '/api/uprzaz');
        assert.equal(st.zadania[0].id, 'zebrra-news-scenariusz'); assert.equal(st.jev, false);
        assert.equal((await j('GET', '/api/uprzaz/materialy/zebrra-news-scenariusz')).materialy[0].id, ODCINEK.id);
        const r = await j('POST', '/api/uprzaz/przebieg', { zadanie: 'zebrra-news-scenariusz', material: ODCINEK.id, k: 2 });
        assert.equal(r.success, true);
        await U.czekaj();
        const p = (await j('GET', `/api/uprzaz/przebieg/${r.przebieg.id}`)).przebieg;
        assert.ok(p.propozycja);
        const odrz = await j('POST', `/api/uprzaz/${p.propozycja}/odrzuc`, { uwagi: 'za mało' });
        assert.equal(odrz.uprzaz.stan, 'odrzucona');
        assert.equal((await j('POST', `/api/uprzaz/${p.propozycja}/przyjmij`)).success, false, 'odrzuconej nie przyjmiesz');
        assert.equal((await j('POST', '/api/uprzaz/przebieg', { zadanie: 'zebrra-news-scenariusz', material: 'n-ffffffff' })).success, false);
        assert.equal((await j('POST', '/api/uprzaz/wycofaj', { zadanie: 'zebrra-news-scenariusz' })).uprzaz, null);
    } finally { srv.close(); }
});
