// 💳🐾 Stripe i Sklep Mini — darowizny (Payment Link), plan zasobów Mini, zlecenie dnia stada (3 propozycje), produkcja
// przyjętej propozycji krok po kroku (TRELLIS → Meshy obraz3d → rig + akcje → 3 obrazy wariantów → pakiet), zgoda na
// kredyty, zakup przez Stripe Checkout i pobranie tylko opłaconego. Atrapy Stripe, Meshy i Pracowni; prawdziwy dysk i zip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzStripe, trybKlucza, formularz, LINK_STRIPE } from '../services/Stripe.js';
import { utworzSklepMini, zamontujTrasySklepu, planZasobow, rodzinyBryl, odczytajPropozycjeMini, odczytajWarianty, rzadkoscZTekstu, BUDZET_PRODUKCJI, CENY } from '../services/SklepMini.js';
import { spakujKatalog } from '../services/PaczkiGier.js';
import { czyWizytowka } from '../services/StrazMostu.js';
import VaultService from '../services/VaultService.js';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'sklep-mini-'));

/** Atrapa API Stripe: zapisuje zapytania, oddaje to, co Stripe. */
function atrapaStripe() {
    const zapytania = [];
    const sesje = new Map();
    let n = 0;
    const fetch = async (url, o = {}) => {
        const u = new URL(url);
        const cialo = Object.fromEntries(new URLSearchParams(o.body ?? ''));
        zapytania.push({ metoda: o.method, sciezka: u.pathname, cialo, auth: o.headers?.Authorization });
        const ok = (d) => ({ ok: true, status: 200, json: async () => d });
        if (u.pathname === '/v1/products') return ok({ id: `prod_${++n}` });
        if (u.pathname === '/v1/prices') return ok({ id: `price_${++n}` });
        if (u.pathname === '/v1/payment_links') return ok({ id: `plink_${++n}`, url: `https://buy.stripe.com/test_dar${n}` });
        if (u.pathname.startsWith('/v1/payment_links/')) return ok({ id: u.pathname.split('/').pop(), active: false });
        if (u.pathname === '/v1/checkout/sessions') {
            const id = `cs_test_${'a'.repeat(20)}${++n}`;
            sesje.set(id, { id, payment_status: 'unpaid', amount_total: Number(cialo['line_items[0][price_data][unit_amount]']), currency: cialo['line_items[0][price_data][currency]'], metadata: { pakiet: cialo['metadata[pakiet]'] }, livemode: false });
            return ok({ id, url: `https://checkout.stripe.com/c/pay/${id}` });
        }
        if (u.pathname.startsWith('/v1/checkout/sessions/')) {
            const s = sesje.get(decodeURIComponent(u.pathname.split('/').pop()));
            return s ? ok(s) : { ok: false, status: 404, json: async () => ({ error: { message: 'No such checkout.session' } }) };
        }
        return { ok: false, status: 404, json: async () => ({ error: { message: 'nieznana ścieżka' } }) };
    };
    return { fetch, zapytania, sesje };
}

test('Stripe: tryb z przedrostka klucza, formularz w kształcie Stripe', () => {
    assert.equal(trybKlucza('sk_test_' + 'x'.repeat(24)), 'test');
    assert.equal(trybKlucza('rk_live_' + 'x'.repeat(24)), 'live');
    assert.equal(trybKlucza('pk_live_' + 'x'.repeat(24)), null);   // klucz publiczny to nie klucz tajny
    const f = formularz({ line_items: [{ price: 'p_1', quantity: 1 }], custom_unit_amount: { enabled: true, minimum: 100 }, puste: null });
    assert.equal(f.get('line_items[0][price]'), 'p_1');
    assert.equal(f.get('custom_unit_amount[enabled]'), 'true');
    assert.equal(f.has('puste'), false);
});

test('Skarbiec zna Stripe (klucz tajny, krytyczny)', () => {
    assert.deepEqual(VaultService.SERVICE_CATALOG.stripe.fields, ['secret_key']);
    assert.equal(VaultService.SERVICE_CATALOG.stripe.security, 'CRITICAL');
});

test('Darowizny: bez klucza odmowa wprost; z kluczem produkt + cena „ile chcesz” + Payment Link (donate); wyłączenie', async () => {
    const kat = await tmp();
    const a = atrapaStripe();
    let klucz = null;
    const s = utworzStripe({ klucz: async () => klucz, katalog: kat, fetch: a.fetch });
    await assert.rejects(s.wlaczDarowizny({}), /Brak klucza Stripe/);
    assert.equal(a.zapytania.length, 0);
    klucz = 'sk_test_' + 'k'.repeat(24);
    const d = await s.wlaczDarowizny({ waluta: 'usd', sugerowana: 5, minimum: 1 });
    assert.match(d.link, LINK_STRIPE);
    assert.equal(d.tryb, 'test');
    const cena = a.zapytania.find((z) => z.sciezka === '/v1/prices').cialo;
    assert.equal(cena['custom_unit_amount[enabled]'], 'true');
    assert.equal(cena['custom_unit_amount[minimum]'], '100');
    assert.equal(cena['custom_unit_amount[preset]'], '500');
    assert.equal(a.zapytania.find((z) => z.sciezka === '/v1/payment_links').cialo.submit_type, 'donate');
    assert.equal(a.zapytania[0].auth, `Bearer ${klucz}`);
    assert.deepEqual(await s.publiczne(), { link: d.link, waluta: 'usd', sugerowana: 5, tryb: 'test' });
    assert.equal(JSON.stringify(JSON.parse(await fs.readFile(path.join(kat, 'stripe.json'), 'utf8'))).includes(klucz), false, 'klucz nie trafia na dysk');
    await s.wylaczDarowizny();
    assert.equal(await s.publiczne(), null);
    assert.equal(a.zapytania.at(-1).cialo.active, 'false');
});

test('Plan zasobów, rodziny i odczyt odpowiedzi stada', () => {
    const lista = [
        { id: 'a', utworzono: '1', zObrazu: 'o1', stan: 'gotowe', galaz: 'mini-teogochi' },
        { id: 'b', utworzono: '2', ulepsza: 'a', stan: 'gotowe', tekstury: true, chmura: { rodzaj: 'obraz3d' } },
        { id: 'c', utworzono: '3', ulepsza: 'b', stan: 'gotowe', tekstury: true, chmura: { rodzaj: 'rig' }, ruchy: [{ ruch: 'chod', glb: 'ruch-chod.glb' }, { ruch: 'akcje', glb: 'ruch-akcje.glb', akcje: [1] }] },
        { id: 'x', utworzono: '0', stan: 'gotowe' },
    ];
    const r = rodzinyBryl(lista);
    assert.equal(r.length, 2);
    const mini = r.find((x) => x.klucz === 'a');
    assert.deepEqual(mini.obrazy, ['o1']);
    const p = planZasobow(mini, { obrazyWariantow: 1 });
    assert.equal(p.meshy && p.ruch && p.akcje, true);
    assert.equal(p.najlepsza, 'c');
    assert.deepEqual(p.braki, ['obrazy wariantów 1/3']);
    assert.equal(planZasobow(mini, { obrazyWariantow: 3 }).gotowy, true);
    const goly = planZasobow({ wersje: [lista[0]] });
    assert.equal(goly.meshy, false);
    assert.equal(goly.braki.length, 4);

    assert.equal(rzadkoscZTekstu('Legendary'), 'legendarny');
    const odp = '1. Iskrzak | pospolity | Mały ognisty stworek na dwóch nogach z płomiennym ogonem i ciepłą pomarańczową sierścią.\nZły format\n2. Mgiełka | EPICKI | Półprzezroczysty duszek mgły z opalowym okiem i srebrzystymi łapkami, lekki jak para.\n3. Iskrzak | rzadki | dubel nazwy, odrzucony mimo dobrego opisu tutaj.\n4. Dąbek | mityczny | Pradawny korzenny stworek z mchem na ramionach i świecącymi żywicą oczami.';
    const nowe = odczytajPropozycjeMini(odp);
    assert.deepEqual(nowe.map((x) => [x.nazwa, x.rzadkosc]), [['Iskrzak', 'pospolity'], ['Mgiełka', 'epicki'], ['Dąbek', 'mityczny']]);
    assert.equal(odczytajWarianty('WARIANT: Lodowy | Ten sam stworek w barwach lodu, szronowa sierść i niebieskie oczy.\nkrótko | za krótko').length, 1);
});

/** Atrapy Assetów 3D (Pracownia + bryły) i Meshy na prawdziwym dysku. */
async function swiat(kat) {
    const assety = new Map(), obrazy = new Map(), zadania = new Map();
    let n = 0;
    const plikA = (id, p) => path.join(kat, 'a', id, p);
    const zapiszPlik = async (p, t) => { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, t); };
    const api = {
        lista: async () => [...assety.values()],
        meta: async (id) => assety.get(id) ?? null,
        listaObrazow: async () => [...obrazy.values()],
        metaObrazu: async (id) => obrazy.get(id) ?? null,
        plikObrazu: (id) => (fsSync.existsSync(path.join(kat, 'o', id, 'obraz.png')) ? path.join(kat, 'o', id, 'obraz.png') : null),
        sciezkaPliku: (id, p) => (fsSync.existsSync(plikA(id, p)) ? plikA(id, p) : null),
        zadanie: (id) => zadania.get(id) ?? null,
        obraz: async ({ opis, galaz }) => {
            const id = `ob${++n}`;
            obrazy.set(id, { id, opis, galaz, stan: 'gotowe', promptObrazu: `EN ${opis.slice(0, 20)}`, utworzono: String(n) });
            await zapiszPlik(path.join(kat, 'o', id, 'obraz.png'), `png ${id}`);
            zadania.set(`z${n}`, { stan: 'gotowe' });
            return { zadanie: `z${n}`, obraz: id };
        },
        generuj: async ({ zObrazu, opis }) => {
            const id = `br${++n}`;
            assety.set(id, { id, zObrazu, opis, galaz: 'mini-teogochi', stan: 'gotowe', utworzono: String(n) });
            await zapiszPlik(plikA(id, 'model.glb'), 'glb trellis'); await zapiszPlik(plikA(id, 'obraz.png'), 'png');
            zadania.set(`z${n}`, { stan: 'gotowe' });
            return { zadanie: `z${n}`, asset: id };
        },
    };
    const zlecone = [];
    const chZad = new Map();
    const chmura = {
        wycen: async (_id, z) => ({ zlecenie: z, kredyty: z.rodzaj === 'obraz3d' ? 30 : 5 + 3 * z.akcje.length, wystarczy: true, saldo: 500 }),
        zlec: async (id, z, { zgodaKredyty }) => {
            zlecone.push({ id, rodzaj: z.rodzaj, zgodaKredyty });
            const nid = `${id}-${z.rodzaj}`;
            const v = { id: nid, ulepsza: id, opis: assety.get(id).opis, stan: 'gotowe', tekstury: true, chmura: { rodzaj: z.rodzaj }, utworzono: String(++n) };
            await zapiszPlik(plikA(nid, 'model.glb'), `glb ${z.rodzaj}`); await zapiszPlik(plikA(nid, 'obraz.png'), 'png');
            if (z.rodzaj === 'rig') {
                v.ruchy = [{ ruch: 'chod', glb: 'ruch-chod.glb' }, { ruch: 'bieg', glb: 'ruch-bieg.glb' }, { ruch: 'akcje', glb: 'ruch-akcje.glb', akcje: z.akcje }];
                for (const r of v.ruchy) await zapiszPlik(plikA(nid, r.glb), `ruch ${r.ruch}`);
            }
            assety.set(nid, v);
            const zid = `ch-${n}`;
            chZad.set(zid, { stan: 'gotowe' });
            return { id: zid };
        },
        zadanie: (id) => chZad.get(id) ?? null,
        zestaw: async () => [{ id: 11 }, { id: 12 }, { id: 13 }],
    };
    const pisz = async (system) => (/warianty/i.test(system)
        ? 'WARIANT: Lodowy | Ten sam stworek w barwach lodu, szronowa sierść i błękitne oczy.\nWARIANT: Leśny | Ten sam stworek w mchu i korze, z listkiem na głowie i zielonymi oczami.\nWARIANT: Nocny | Ten sam stworek w granacie nocy z gwiazdkami na sierści i srebrnym okiem.'
        : 'Iskrzak | pospolity | Mały ognisty stworek na dwóch nogach z płomiennym ogonem i ciepłą sierścią.\nMgiełka | epicki | Półprzezroczysty duszek mgły z opalowym okiem i srebrzystymi łapkami.\nDąbek | legendarny | Pradawny korzenny stworek z mchem na ramionach i oczami z żywicy.');
    return { api, chmura, pisz, zlecone, assety };
}

test('Dzień stada → 3 propozycje; przyjęcie tylko ze zgodą; produkcja do pakietu na stronie; zakup i pobranie tylko opłaconego', async () => {
    const kat = await tmp();
    const w = await swiat(kat);
    const a = atrapaStripe();
    const stripe = utworzStripe({ klucz: async () => 'sk_test_' + 'k'.repeat(24), katalog: kat, fetch: a.fetch });
    const teraz = () => Date.parse('2026-10-13T08:00:00Z');
    const sklep = utworzSklepMini({ katalog: path.join(kat, 'sklep'), assety: w.api, chmura: w.chmura, stripe, pisz: w.pisz, spakuj: spakujKatalog, teraz, czytajKlipy: async (p) => (p.includes('akcje') ? ['Idle', 'Jump'] : ['Walking']) });

    await sklep.krok();   // dzień: 3 propozycje do kolejki GPU
    let st = await sklep.stan();
    assert.equal(st.dzien.propozycje.ok, true);
    assert.equal(st.propozycje.length, 3);
    for (let i = 0; i < 8; i++) await sklep.krok();   // rysowanie po kolei (jedno zadanie GPU naraz)
    st = await sklep.stan();
    assert.deepEqual(st.propozycje.map((p) => p.stan), ['czeka', 'czeka', 'czeka']);
    await sklep.krok();
    assert.equal((await sklep.stan()).dzien.data, '2026-10-13', 'drugi raz tego dnia nie pisze');

    const p = st.propozycje.find((x) => x.nazwa === 'Mgiełka');
    await assert.rejects(sklep.przyjmij(p.id, { zgodaKredyty: 10 }), /potwierdź kwotę/);
    await sklep.przyjmij(p.id, { rzadkosc: 'legendarny', zgodaKredyty: BUDZET_PRODUKCJI });
    for (let i = 0; i < 20; i++) await sklep.krok();
    st = await sklep.stan();
    const gotowa = st.propozycje.find((x) => x.id === p.id);
    assert.equal(gotowa.stan, 'gotowa', JSON.stringify(gotowa.historia));
    assert.deepEqual(w.zlecone.map((z) => [z.rodzaj, z.zgodaKredyty]), [['obraz3d', 30], ['rig', 14]]);
    assert.ok(gotowa.wydano <= BUDZET_PRODUKCJI);
    const pk = st.pakiety.find((x) => x.id === gotowa.pakiet);
    assert.equal(pk.stan, 'wystawiony');
    assert.equal(pk.cena, CENY.legendarny);
    assert.equal(pk.obrazow, 3);
    assert.equal(pk.klipow, 4);
    const plan = st.plany.find((x) => x.klucz === gotowa.korzen);
    assert.equal(plan.gotowy, true);

    const pub = await sklep.publiczne();
    assert.equal(pub.mini.length, 1);
    assert.equal(pub.mini[0].cena, 9);
    assert.equal(pub.mini[0].obraz, `/wizytowka/sklep/${pk.id}/okladka.png`);

    // trasy publiczne
    const app = express(); app.use(express.json());
    zamontujTrasySklepu(app, { sklep, stripe, adres: async () => 'https://katedra.example.org' });
    const srv = app.listen(0);
    const baza = `http://127.0.0.1:${srv.address().port}`;
    try {
        assert.equal((await fetch(`${baza}/wizytowka/sklep/pk-00000000/kup`, { method: 'POST' })).status, 404);
        const k = await (await fetch(`${baza}/wizytowka/sklep/${pk.id}/kup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ powrot: 'https://otakos.wtf/' }) })).json();
        assert.match(k.url, /^https:\/\/checkout\.stripe\.com\//);
        const sesja = a.zapytania.find((z) => z.sciezka === '/v1/checkout/sessions').cialo;
        assert.equal(sesja['line_items[0][price_data][unit_amount]'], '900', 'cenę liczy most z rzadkości');
        assert.equal(sesja.success_url, 'https://katedra.example.org/wizytowka/sklep/odbior?sesja={CHECKOUT_SESSION_ID}');
        assert.equal(sesja.cancel_url, 'https://otakos.wtf/');
        const id = [...a.sesje.keys()][0];
        assert.equal((await fetch(`${baza}/wizytowka/sklep/pobierz?sesja=${id}`)).status, 402, 'nieopłacona = brak pliku');
        a.sesje.get(id).payment_status = 'paid';
        const strona = await (await fetch(`${baza}/wizytowka/sklep/odbior?sesja=${id}`)).text();
        assert.match(strona, /Mgiełka/);
        const zip = await fetch(`${baza}/wizytowka/sklep/pobierz?sesja=${id}`);
        assert.equal(zip.status, 200);
        const bajty = Buffer.from(await zip.arrayBuffer());
        assert.equal(bajty.readUInt32LE(0), 0x04034b50);
        for (const n of ['model.glb', 'ruch-akcje.glb', 'wariant-3.png', 'propozycje.json', 'karta.json', 'CZYTAJ.txt']) assert.ok(bajty.includes(Buffer.from(n)), n);
        assert.equal((await stripe.stan()).sprzedanych, 1);
        await sklep.wystawPakiet(pk.id, false);
        assert.equal((await fetch(`${baza}/wizytowka/sklep/${pk.id}/kup`, { method: 'POST' })).status, 404, 'wycofany nie do kupienia');
    } finally { srv.close(); }
});

test('Utknięcie: płatny krok przerwany restartem nie rusza sam drugi raz; wznowienie = nowa zgoda', async () => {
    const kat = await tmp();
    const w = await swiat(kat);
    const teraz = () => Date.parse('2026-10-13T08:00:00Z');
    const opcje = { katalog: path.join(kat, 'sklep'), assety: w.api, chmura: w.chmura, pisz: w.pisz, spakuj: spakujKatalog, teraz, czytajKlipy: async () => [] };
    const sklep = utworzSklepMini(opcje);
    for (let i = 0; i < 8; i++) await sklep.krok();
    const p = (await sklep.stan()).propozycje[0];
    await sklep.przyjmij(p.id, { zgodaKredyty: BUDZET_PRODUKCJI });
    // Meshy zlecone, ale wynik nie dotarł, a most wstał od nowa (zadanie w pamięci zgubione)
    w.chmura.zlec = async (id, z, o) => { w.zlecone.push({ id, rodzaj: z.rodzaj, zgodaKredyty: o.zgodaKredyty }); return { id: 'ch-zgubione' }; };
    await sklep.krok(); await sklep.krok();   // bryła TRELLIS → Image-to-3D
    assert.equal(w.zlecone.length, 1);
    await sklep.krok();
    const po = (await sklep.stan()).propozycje.find((x) => x.id === p.id);
    assert.equal(po.stan, 'utknela');
    assert.match(po.blad, /restartem/);
    await sklep.krok();
    assert.equal(w.zlecone.length, 1, 'bez nowej zgody nic nie idzie do Meshy');
    await assert.rejects(sklep.wznow(p.id, {}), /potwierdź kwotę/);
    const wz = await sklep.wznow(p.id, { zgodaKredyty: BUDZET_PRODUKCJI });
    assert.equal(wz.budzet, 30 + BUDZET_PRODUKCJI);
});

test('Straż wpuszcza bez klucza tylko zakup, okładkę, odbiór i pobranie sklepu', () => {
    const req = (method, p) => ({ method, path: p });
    assert.equal(czyWizytowka(req('POST', '/wizytowka/sklep/pk-0123abcd/kup')), true);
    assert.equal(czyWizytowka(req('GET', '/wizytowka/sklep/pk-0123abcd/okladka.png')), true);
    assert.equal(czyWizytowka(req('GET', '/wizytowka/sklep/odbior')), true);
    assert.equal(czyWizytowka(req('GET', '/wizytowka/sklep/pobierz')), true);
    assert.equal(czyWizytowka(req('GET', '/wizytowka/sklep/pk-0123abcd/pakiet.zip')), false);
    assert.equal(czyWizytowka(req('POST', '/api/sklep-mini/dzien')), false);
    assert.equal(czyWizytowka(req('POST', '/api/stripe/darowizny')), false);
});
