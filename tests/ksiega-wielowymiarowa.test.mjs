// 🌿🌌 Żywa Księga Wielowymiarowa: dzienne wpisy, 3 wypożyczenia = na stałe, gałęzie z innej Katedry.
// Dwie Katedry na prawdziwym HTTP (główna „teo” i czytelnika „ola”), prawdziwe klucze ed25519, prawdziwa Wypożyczalnia;
// atrapy: Stripe, rejestr otakos.wtf, model Kronikarza, Paleta. Prawdziwego portalu i płatności tu nie ma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzWypozyczalnie, zamontujTrasyWypozyczalni } from '../services/WypozyczalniaKsiag.js';
import { utworzKsiegeWielowymiarowa, zamontujTrasyKsiegiWielowymiarowej, trescGalezi, listaSesji, odczytajGalaz, WYPOZYCZEN_NA_STALE } from '../services/KsiegaWielowymiarowa.js';
import { SCIEZKA_TEOSTORY, SCIEZKA_GALEZI_KSIEGI, czyDlaSparowanych } from '../services/StrazMostu.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const strona = (n, t) => ({ pageNumber: n, chapterTitle: `Act ${n}`, narrativeText: t, dialogueLines: [], imageUrl: PNG });
const PLATNA = { id: 'velvet-booth', title: 'Velvet Booth for Two', author: 'Elara & Kael', language: 'en', sourceType: 'opodysk', pages: [strona(1, 'Neon hums in amber light, wiping down the counter of the night.'), strona(2, 'You walk in, shaking off the cold, carrying stories that were never told.')] };
const DARMOWA = { id: 'legenda', title: 'Legenda 0.00G', author: 'TeO', language: 'pl', pages: [strona(1, 'Dawno temu każda myśl miała swoją wagę, a każde pytanie kosztowało.')] };
const klucze = () => { const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519'); return { pub: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), podpisz: async (t) => crypto.sign(null, Buffer.from(t, 'utf8'), privateKey).toString('base64') }; };
const DLUGI = 'Deszcz ustał dopiero nad ranem, kiedy ostatnia filiżanka przestała krążyć nad stołem. '.repeat(6);

test('czyste: lista sesji, podpisywana treść gałęzi, odczyt rozdziału od modelu, Straż', () => {
    assert.deepEqual(listaSesji('cs_test_aaaaaaaa, cs_test_aaaaaaaa,x,cs_test_bbbbbbbb'), ['cs_test_aaaaaaaa', 'cs_test_bbbbbbbb']);
    assert.equal(listaSesji(Array.from({ length: 20 }, (_, i) => `cs_test_${String(i).padStart(8, '0')}`)).length, 8);
    const z = { nick: 'ola', ksiega: 'velvet-booth', tytul: 'T', tekst: 'abc', czas: 5 };
    assert.equal(trescGalezi(z), `otakos-galaz\nola\nvelvet-booth\nT\n${crypto.createHash('sha256').update('abc').digest('hex')}\n5`);
    assert.notEqual(trescGalezi(z), trescGalezi({ ...z, tekst: 'abd' }), 'zmiana tekstu łamie podpis');
    assert.deepEqual(odczytajGalaz(`<think>hm</think>{"tytul":"Świt nad barem","tekst":"${DLUGI}"}`), { tytul: 'Świt nad barem', tekst: DLUGI.trim() });
    assert.throws(() => odczytajGalaz('{"tytul":"x","tekst":"krótko"}'), /za krótki/);
    assert.throws(() => odczytajGalaz('nie json'), /bez tytułu/);
    for (const p of ['/wizytowka/teostory/zywe', '/wizytowka/teostory/velvet-booth/wpisy', '/wizytowka/teostory/velvet-booth/wpis/w-0a1b2c3d.png', '/wizytowka/teostory/velvet-booth/wpis/w-0a1b2c3d.mp3']) assert.ok(SCIEZKA_TEOSTORY.test(p), p);
    assert.ok(!SCIEZKA_TEOSTORY.test('/wizytowka/teostory/velvet-booth/wpis/../../x.png'));
    assert.ok(SCIEZKA_GALEZI_KSIEGI.test('/wizytowka/teostory/velvet-booth/galaz'));
    assert.equal(czyDlaSparowanych('/api/zywe-wpisy/velvet-booth'), false, 'dopisywanie wpisów tylko przy Katedrze');
});

test('żywe wpisy, 3 wypożyczenia = na stałe, gałąź z innej Katedry przez ✓ w Izbie (dwie Katedry, HTTP)', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wielowymiar-'));
    let zegar = Date.parse('2026-11-14T10:00:00Z');
    // Stripe: cs_velvet_* = opłacone wypożyczenia „velvet-booth”, cs_inna_* = inna księga, reszta nieopłacona
    let pytanStripe = 0;
    const stripe = { sprawdzSesje: async (id) => { pytanStripe++; return { id, oplacona: /^cs_(velvet|inna)_/.test(id), pakiet: id.startsWith('cs_inna_') ? 'inna-ksiega' : 'velvet-booth', rodzaj: 'ksiega-48h', powrot: null, kwota: 1.99, waluta: 'eur', tryb: 'test' }; } };
    const rejestr = new Map();
    const katedraZRejestru = async (n) => { const k = rejestr.get(n); if (!k) throw new Error('brak w rejestrze'); return k; };
    const wiesci = [];

    // ── Główna Katedra „teo” ──
    const W = utworzWypozyczalnie({ katalog: path.join(tmp, 'teo'), stripe, teraz: () => zegar, naStale: (id, s) => K.naStale(id, s) });
    const rysowane = [];
    const K = utworzKsiegeWielowymiarowa({ katalog: path.join(tmp, 'teo'), wypozyczalnia: W, stripe, teraz: () => zegar, nick: async () => 'teo', katedra: katedraZRejestru, wiesc: (t) => wiesci.push(t),
        rysuj: async (o) => { rysowane.push(o); const p = path.join(tmp, 'flux.png'); await fs.writeFile(p, Buffer.from(PNG.split(',')[1], 'base64')); return p; } });
    const app = express(); app.use(express.json({ limit: '50mb' })); zamontujTrasyWypozyczalni(app, W); zamontujTrasyKsiegiWielowymiarowej(app, K);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    // ── Katedra czytelnika „ola” ──
    const ola = klucze(); rejestr.set('ola', { nick: 'ola', klucz: ola.pub });
    const prosbyModelu = [];
    const KO = utworzKsiegeWielowymiarowa({ katalog: path.join(tmp, 'ola'), wypozyczalnia: { katalogPelny: async () => [], czytaj: async () => { throw new Error('nie tu'); } }, teraz: () => zegar,
        nick: async () => 'ola', podpisz: ola.podpisz, pisz: async (system, prompt) => { prosbyModelu.push({ system, prompt }); return JSON.stringify({ tytul: 'Okno po deszczu', tekst: DLUGI }); } });
    const appO = express(); appO.use(express.json()); zamontujTrasyKsiegiWielowymiarowej(appO, KO);
    const srvO = appO.listen(0); const bazaO = `http://127.0.0.1:${srvO.address().port}`;
    const zadaj = (b, m, s, c) => fetch(b + s, { method: m, headers: { 'Content-Type': 'application/json' }, ...(c ? { body: JSON.stringify(c) } : {}) }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));
    try {
        await W.publikuj({ book: PLATNA, rentalTier: 'rental_48h', cenaEur: 1.99 });
        await W.publikuj({ book: DARMOWA, rentalTier: 'demo' });

        // ── 1. żywe wpisy ──
        assert.equal((await zadaj(baza, 'POST', '/api/zywe-wpisy/nie-ma-takiej', { tytul: 'x', tekst: 'a'.repeat(30) })).status, 404);
        assert.equal((await zadaj(baza, 'POST', '/api/zywe-wpisy/velvet-booth', { tytul: '', tekst: 'a'.repeat(30) })).success, false);
        const w1 = (await zadaj(baza, 'POST', '/api/zywe-wpisy/velvet-booth', { tytul: 'Dzień pierwszy', tekst: 'Rano w loży została jedna filiżanka i ślad po deszczu na szybie.', obraz: PNG })).wpis;
        zegar += 24 * 3600e3;
        const w2 = (await zadaj(baza, 'POST', '/api/zywe-wpisy/velvet-booth', { tytul: 'Dzień drugi', tekst: 'Kael wrócił po płaszcz, którego nikt nie ruszył od tamtej nocy.', ilustruj: true, opisObrazu: 'a coat on a brass hook' })).wpis;
        assert.deepEqual([w1.nr, w2.nr], [1, 2]); assert.match(w1.obraz, /^w-[0-9a-f]{8}\.png$/); assert.match(w2.obraz, /\.png$/);
        assert.match(rysowane[0].prompt, /^a coat on a brass hook, painterly storybook illustration/);
        // portal: licznik i tytuły dla każdego, TREŚĆ tylko z dostępem
        const gosc = await zadaj(baza, 'GET', '/wizytowka/teostory/velvet-booth/wpisy');
        assert.equal(gosc.licznik, 2); assert.equal(gosc.dostep, false); assert.equal(gosc.ostatni, w2.kiedy);
        assert.deepEqual(gosc.wpisy.map((x) => [x.tytul, x.tekst, x.obraz]), [['Dzień pierwszy', undefined, undefined], ['Dzień drugi', undefined, undefined]]);
        const placacy = await zadaj(baza, 'GET', '/wizytowka/teostory/velvet-booth/wpisy?sesja=cs_velvet_00000001');
        assert.equal(placacy.dostep, true); assert.match(placacy.wpisy[0].tekst, /jedna filiżanka/);
        assert.equal(placacy.wpisy[0].obraz, `/wizytowka/teostory/velvet-booth/wpis/${w1.obraz}`);
        assert.equal((await fetch(baza + placacy.wpisy[0].obraz)).status, 200);
        assert.equal((await fetch(`${baza}/wizytowka/teostory/velvet-booth/wpis/w-ffffffff.png`)).status, 404);
        assert.deepEqual((await zadaj(baza, 'GET', '/wizytowka/teostory/zywe')).ksiegi, { 'velvet-booth': { wpisow: 2, ostatni: w2.kiedy, galezi: 0 } });
        // księga darmowa: treść wpisu dla każdego
        await K.dodajWpis('legenda', { tytul: 'Dopisek', tekst: 'Iskra w pamięci komputera zapaliła się po raz drugi.' });
        assert.match((await zadaj(baza, 'GET', '/wizytowka/teostory/legenda/wpisy')).wpisy[0].tekst, /Iskra/);

        // ── 2. trzy wypożyczenia = na stałe ──
        assert.equal(WYPOZYCZEN_NA_STALE, 3);
        const dwie = await zadaj(baza, 'GET', '/wizytowka/teostory/velvet-booth/wpisy?sesje=cs_velvet_00000001,cs_velvet_00000002,cs_velvet_00000002,cs_inna_00000001,cs_zla_000000001');
        assert.deepEqual(dwie.czytelnik, { demo: false, wypozyczen: 2, potrzeba: 3, naStale: false, galaz: false }, 'powtórka, inna księga i nieopłacona sesja się nie liczą');
        assert.equal(dwie.dostep, false);
        const TRZY = 'cs_velvet_00000001,cs_velvet_00000002,cs_velvet_00000003';
        const stale = await zadaj(baza, 'GET', `/wizytowka/teostory/velvet-booth/wpisy?sesje=${TRZY}`);
        assert.deepEqual(stale.czytelnik, { demo: false, wypozyczen: 3, potrzeba: 3, naStale: true, galaz: true });
        assert.equal(stale.dostep, true);
        // po wygaśnięciu wszystkich 48 h księga dalej się otwiera — bez terminu
        zegar += 30 * 24 * 3600e3;
        const czyt = await zadaj(baza, 'GET', `/wizytowka/teostory/velvet-booth/czytaj?sesja=cs_velvet_00000003&sesje=${TRZY}`);
        assert.equal(czyt.success, true, czyt.message); assert.equal(czyt.naStale, true); assert.equal(czyt.dostepDo, null); assert.equal(czyt.ksiega.pages.length, 2);
        // odczyt „na stałe” nie rusza zegara 48 h: trzecia sesja podana SAMA startuje dopiero teraz, trzy dni później wygasa — a z kompletem trzech księga dalej się otwiera
        assert.equal((await zadaj(baza, 'GET', '/wizytowka/teostory/velvet-booth/czytaj?sesja=cs_velvet_00000003')).status, 200);
        zegar += 3 * 24 * 3600e3;
        assert.equal((await zadaj(baza, 'GET', '/wizytowka/teostory/velvet-booth/czytaj?sesja=cs_velvet_00000003')).status, 410, 'sama trzecia sesja po 48 h wygasła');
        assert.equal((await zadaj(baza, 'GET', `/wizytowka/teostory/velvet-booth/czytaj?sesja=cs_velvet_00000003&sesje=${TRZY}`)).naStale, true);
        assert.equal((await zadaj(baza, 'GET', '/wizytowka/teostory/velvet-booth/czytaj?sesja=cs_velvet_00000001&sesje=cs_velvet_00000001,cs_velvet_00000002,cs_zla_000000001')).status, 410);
        // sprawdzone sesje pamiętamy — drugie pytanie nie idzie do Stripe; pamięć przeżywa restart (plik)
        const przed = pytanStripe;
        await K.czytelnik('velvet-booth', listaSesji(TRZY));
        assert.equal(pytanStripe, przed);
        assert.deepEqual(Object.keys(JSON.parse(await fs.readFile(path.join(tmp, 'teo', 'na-stale.json'), 'utf8')).sesje).sort().slice(0, 3), ['cs_inna_00000001', 'cs_velvet_00000001', 'cs_velvet_00000002']);

        // ── 3. gałąź z Katedry „ola” ──
        // bez trzech wypożyczeń druk jest odmówiony (Kronikarz nawet nie rusza)
        const bezPrawa = await zadaj(bazaO, 'POST', '/api/galezie-ksiag/drukuj', { baza, ksiega: 'velvet-booth', sesje: ['cs_velvet_00000001'] });
        assert.equal(bezPrawa.success, false); assert.equal(prosbyModelu.length, 0);
        const druk = await zadaj(bazaO, 'POST', '/api/galezie-ksiag/drukuj', { baza, ksiega: 'velvet-booth', sesje: TRZY.split(','), wskazowka: 'niech pójdą nad rzekę' });
        assert.equal(druk.success, true, druk.message);
        assert.equal(druk.galaz.tytul, 'Okno po deszczu'); assert.equal(druk.galaz.stan, 'wydrukowana');
        // Kronikarz dostał treść księgi i żywe wpisy głównej osi
        assert.match(prosbyModelu[0].prompt, /Velvet Booth for Two/); assert.match(prosbyModelu[0].prompt, /You walk in, shaking off the cold/);
        assert.match(prosbyModelu[0].prompt, /Dzień drugi: Kael wrócił po płaszcz/); assert.match(prosbyModelu[0].prompt, /niech pójdą nad rzekę/);
        assert.equal((await zadaj(bazaO, 'GET', '/api/galezie-ksiag')).galezie.length, 1);
        assert.equal((await zadaj(bazaO, 'POST', '/api/galezie-ksiag/drukuj', { baza: 'http://zlo.example', ksiega: 'velvet-booth' })).success, false, 'obcy adres http — odmowa');

        const wys = await zadaj(bazaO, 'POST', `/api/galezie-ksiag/${druk.galaz.id}/wyslij`);
        assert.equal(wys.success, true, wys.message); assert.equal(wys.galaz.stan, 'wyslana'); assert.equal(wys.galaz.uGlownej, 'do_zgody');
        assert.match(wiesci.at(-1), /Katedra „ola” przysłała gałąź do księgi „Velvet Booth for Two”/);
        // to samo zgłoszenie drugi raz = ta sama pozycja
        await zadaj(bazaO, 'POST', `/api/galezie-ksiag/${druk.galaz.id}/wyslij`);
        assert.equal((await K.pelne('velvet-booth')).galezie.length, 1);
        // przed ✓ portal gałęzi nie pokazuje
        assert.deepEqual((await zadaj(baza, 'GET', `/wizytowka/teostory/velvet-booth/wpisy?sesje=${TRZY}`)).galezie, []);

        // podszywacz (inny klucz niż w rejestrze), nieznana Katedra, stare zgłoszenie, brak prawa, własny nick — odrzucone
        const zlodziej = klucze();
        const zgl = async (zm, kto = ola) => { const z = { nick: 'ola', ksiega: 'velvet-booth', tytul: 'Inna gałąź', tekst: `${DLUGI} Koniec.`, czas: zegar, ...zm }; z.podpis = zm.podpis ?? await kto.podpisz(trescGalezi(z)); return zadaj(baza, 'POST', '/wizytowka/teostory/velvet-booth/galaz', { ...z, sesje: zm.sesje ?? TRZY.split(',') }); };
        assert.equal((await zgl({}, zlodziej)).status, 403);
        assert.equal((await zgl({ nick: 'duch' })).status, 403);
        assert.match((await zgl({ czas: zegar - 2 * 3600e3 })).message, /nieświeże/);
        assert.equal((await zgl({ sesje: ['cs_velvet_00000001'] })).status, 403, 'bez księgi na stałe');
        rejestr.set('teo', { nick: 'teo', klucz: ola.pub });
        assert.match((await zgl({ nick: 'teo' })).message, /od tej samej Katedry/);
        const zmieniony = { nick: 'ola', ksiega: 'velvet-booth', tytul: 'Inna gałąź', tekst: `${DLUGI} Koniec.`, czas: zegar };
        const podpis = await ola.podpisz(trescGalezi(zmieniony));
        assert.equal((await zadaj(baza, 'POST', '/wizytowka/teostory/velvet-booth/galaz', { ...zmieniony, tekst: `${DLUGI} Podmienione.`, podpis, sesje: TRZY.split(',') })).status, 403, 'tekst podmieniony po podpisie');
        assert.equal((await K.pelne('velvet-booth')).galezie.length, 1);
        // księga darmowa: gałąź bez wypożyczeń
        const zd = { nick: 'ola', ksiega: 'legenda', tytul: 'Druga iskra', tekst: DLUGI, czas: zegar }; zd.podpis = await ola.podpisz(trescGalezi(zd));
        assert.equal((await zadaj(baza, 'POST', '/wizytowka/teostory/legenda/galaz', zd)).success, true);

        // Izba zgód: dwie gałęzie czekają; ✓ jednej, ✕ drugiej
        const izba = await K.zrodloIzby.czekajace();
        assert.equal(izba.length, 2); assert.deepEqual(izba[0].akcje.map((a) => [a.id, a.zdalnie]), [['przyjmij', true], ['odrzuc', true]]);
        const velvet = izba.find((x) => x.id.startsWith('velvet-booth~'));
        assert.match(velvet.tytul, /od Katedry ola: Okno po deszczu/);
        await K.zrodloIzby.decyduj(velvet.id, 'przyjmij', {});
        await K.zrodloIzby.decyduj(izba.find((x) => x.id.startsWith('legenda~')).id, 'odrzuc', { powod: 'nie ten ton' });
        assert.equal((await K.zrodloIzby.czekajace()).length, 0);
        // portal: przełącznik wymiarów — główna oś (wpisy) i gałąź z Katedry „ola”; bez dostępu sam tytuł
        const wymiary = await zadaj(baza, 'GET', `/wizytowka/teostory/velvet-booth/wpisy?sesje=${TRZY}`);
        assert.equal(wymiary.wpisy.length, 2); assert.equal(wymiary.katedr, 1);
        assert.deepEqual(wymiary.galezie.map((g) => [g.nick, g.tytul, g.tekst.length > 300]), [['ola', 'Okno po deszczu', true]]);
        assert.deepEqual((await zadaj(baza, 'GET', '/wizytowka/teostory/velvet-booth/wpisy')).galezie.map((g) => [g.nick, g.tytul, g.tekst]), [['ola', 'Okno po deszczu', undefined]]);
        assert.deepEqual((await zadaj(baza, 'GET', '/wizytowka/teostory/legenda/wpisy')).galezie, [], 'odrzucona gałąź się nie pokazuje');
        assert.equal((await zadaj(baza, 'GET', '/wizytowka/teostory/zywe')).ksiegi['velvet-booth'].galezi, 1);

        // usunięcie wpisu sprząta załącznik; strona drukarni się serwuje
        await zadaj(baza, 'DELETE', `/api/zywe-wpisy/velvet-booth/${w1.id}`);
        assert.equal((await fetch(`${baza}/wizytowka/teostory/velvet-booth/wpis/${w1.obraz}`)).status, 404);
        assert.match(await (await fetch(`${bazaO}/api/galezie-ksiag/drukarnia?baza=x&ksiega=y`)).text(), /Drukarnia gałęzi/);
    } finally { srv.close(); srvO.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});
