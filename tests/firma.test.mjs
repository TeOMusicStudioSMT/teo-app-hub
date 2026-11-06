// 🏢 Firma: profil biznesu, Skarbnik (Stripe + wpisy, progi Kleinunternehmera), Mecenas (szkice z nagłówkiem ENTWURF).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzFirme, stanProgu, PROFIL_COR_TEO } from '../services/Firma.js';
import { SCIEZKI_TYLKO_LOKALNE } from '../services/StrazMostu.js';

const srodowisko = async (sprzedaz = []) => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'firma-'));
    return { F: utworzFirme({ katalog: kat, sprzedazStripe: async () => sprzedaz, teraz: () => Date.parse('2026-11-06T12:00:00Z') }), kat };
};

test('profil: pusty = niezałożony; Cor-TeO zapisany; złe dane odrzucone', async () => {
    const { F } = await srodowisko();
    assert.equal((await F.profil()).zalozony, false);
    await assert.rejects(F.ustawProfil({ nazwa: 'X' }), /nazwę/);
    await assert.rejects(F.ustawProfil({ ...PROFIL_COR_TEO, kraj: 'Niemcy' }), /dwuliterowy/);
    const p = await F.ustawProfil({ ...PROFIL_COR_TEO, domeny: ['https://teo.center/', 'qr.teo.center', 'zła domena'] });
    assert.equal(p.zalozony, true); assert.deepEqual(p.domeny, ['teo.center', 'qr.teo.center']);
    assert.deepEqual(p.progi, { poprzedniRok: 25_000, biezacyRok: 100_000 });
});

test('Skarbnik: Stripe + wpisy, rok po roku, inne waluty osobno, progi § 19 UStG', async () => {
    const { F } = await srodowisko([
        { sesja: 'cs_1', oplacona: true, kwota: 9, waluta: 'usd', kiedy: '2026-10-01T10:00:00Z', rodzaj: 'mini' },
        { sesja: 'cs_2', oplacona: true, kwota: 3, waluta: 'eur', kiedy: '2026-10-02T10:00:00Z', rodzaj: 'ksiega-48h' },
        { sesja: 'cs_3', oplacona: false, kwota: 99, waluta: 'eur', kiedy: '2026-10-03T10:00:00Z' },
    ]);
    await F.ustawProfil(PROFIL_COR_TEO);
    await F.dodajPozycje({ data: '2026-11-01', rodzaj: 'przychod', kwota: 20_000, waluta: 'EUR', opis: 'Shopify wypłata' });
    await F.dodajPozycje({ data: '2026-11-02', rodzaj: 'koszt', kwota: 150, opis: 'Printful' });
    await F.dodajPozycje({ data: '2025-12-01', rodzaj: 'przychod', kwota: 24_000, opis: 'rok wcześniej' });
    await assert.rejects(F.dodajPozycje({ data: '2026-13', rodzaj: 'przychod', kwota: 1 }), /Data/);
    const s = await F.skarbnik(2026);
    assert.equal(s.przychody, 20_003); assert.equal(s.koszty, 150); assert.equal(s.wynik, 19_853);
    assert.deepEqual(s.inneWaluty, { 'USD przychod': 9 });
    assert.equal(s.kleinunternehmer.poprzedniRok.stan, 'blisko');   // 24 000 z 25 000
    assert.equal(s.kleinunternehmer.biezacyRok.stan, 'ok');
    assert.equal(stanProgu(26_000, 25_000).stan, 'przekroczony');
});

test('Mecenas: szkic z nagłówkiem ENTWURF, braki danych wprost, plik w firma/prawo', async () => {
    const { F, kat } = await srodowisko();
    await F.ustawProfil(PROFIL_COR_TEO);
    const m = await F.mecenas('impressum', 'de');
    assert.match(m.tekst, /ENTWURF/); assert.match(m.tekst, /§ 5 DDG/); assert.match(m.tekst, /§ 19 UStG/);
    assert.ok(m.braki.includes('e-mail'));
    assert.ok((await fs.readFile(path.join(kat, 'firma', 'prawo', 'impressum-de.md'), 'utf8')).includes('Cor-TeO'));
    assert.match((await F.mecenas('agb', 'en')).tekst, /DRAFT/);
    await assert.rejects(F.mecenas('whitepaper'), /Dokument/);
});

test('Straż: /api/firma tylko przy maszynie', () => {
    assert.ok(SCIEZKI_TYLKO_LOKALNE.some((p) => '/api/firma/profil'.startsWith(p)));
});

test('telefon w Impressum i Datenschutz; whitepaper czytany z docs/', async () => {
    const { F } = await srodowisko();
    await F.ustawProfil({ ...PROFIL_COR_TEO, telefon: '+49 123 456' });
    assert.match((await F.mecenas('impressum', 'de')).tekst, /Telefon: \+49 123 456/);
    assert.match((await F.mecenas('datenschutz', 'en')).tekst, /Phone: \+49 123 456/);
    const w = await F.whitepaper();
    assert.equal(w.plik, 'docs/whitepaper-grv.md'); assert.match(w.tekst, /GRV/);
});
