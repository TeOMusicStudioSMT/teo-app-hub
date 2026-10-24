// ☀️ Poranny brief Katedry — fakty z tras → trzy sekcje, zapowiedź do kanału Mistrza, raz na dzień.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { zlozBrief, czytajBledyMostu, briefJakoTekst, utworzPorannyBrief } from '../services/PorannyBrief.js';

const TERAZ = Date.parse('2026-10-24T07:00:00Z');
const godz = (h) => new Date(TERAZ - h * 3600_000).toISOString();

const DANE = {
    publikacje: { publikacje: [
        { etap: 'do_akceptacji', tytul: '🎪 TeO Game Show🎪: Nu', utworzono: godz(2) },
        { etap: 'opublikowana', tytul: 'Short Nu', wyslano: godz(5), zrodlo: { format: 'shorts' }, kanalNazwa: 'TeO Univers Studio' },
        { etap: 'opublikowana', tytul: 'Wieczór Tańca', wyslano: godz(10), kanalNazwa: 'Zebrra Sports' },
        { etap: 'opublikowana', tytul: 'Stary film', wyslano: godz(60) },
        { etap: 'blad', tytul: 'Padł', blad: 'quotaExceeded', utworzono: godz(3) },
        { etap: 'blad', tytul: 'Bardzo stary błąd', blad: 'x', utworzono: godz(24 * 10) },
        { etap: 'limit', tytul: 'Czeka na limit' },
    ] },
    programy: {
        '/api/zebrra-news': { odcinki: [{ stan: 'studio', dzien: '2026-10-24' }, { stan: 'do_akceptacji', utworzono: godz(30) }, { stan: 'blad', powod: 'model milczy', utworzono: godz(24 * 9) }] },
        '/api/game-show': { odcinki: [{ stan: 'do_akceptacji', utworzono: godz(4) }] },   // stan zostaje po publikacji — nie liczymy
    },
    autopilot: { autopilot: { cele: {
        shorts: { nazwa: 'YouTube Shorts', wlaczony: true, dzisiaj: 1, wyslane: 53, doZrobienia: 0, konto: { polaczony: true } },
        tiktok: { nazwa: 'TikTok', wlaczony: true, dzisiaj: 0, wyslane: 9, pauza: { powod: 'skrzynka szkiców pełna' }, konto: { polaczony: true } },
        reels: { nazwa: 'Instagram Reels', wlaczony: false, konto: { polaczony: false, powod: 'niepołączone' } },
    } } },
    stol: { karty: [{ etap: 'do_akceptacji', tytul: 'Pałac Katedry' }, { etap: 'zratyfikowane', tytul: 'stara' }] },
    sklep: { dzien: { data: '2026-10-24' }, pakiety: [{ stan: 'do-akceptacji' }, { stan: 'wystawiony' }], propozycje: [{ stan: 'czeka', dzien: '2026-10-24' }, { stan: 'czeka', dzien: '2026-10-20' }] },
    sprzedaz: { sprzedaz: [{ kwota: 6, waluta: 'usd', kiedy: godz(8) }, { kwota: 3, waluta: 'usd', kiedy: godz(50) }] },
    nocna: { wlaczona: true, zadania: [], dziennik: [{ rodzaj: 'kuznia-soup', stan: 'gotowe', kiedy: godz(6) }, { rodzaj: 'produkcja', stan: 'blad', blad: 'karta zajęta', kiedy: godz(5) }, { stan: 'gotowe', kiedy: godz(80) }] },
    bledyMostu: czytajBledyMostu(`${godz(30)} [nieobsłużona obietnica] stary\n  at x\n${godz(2)} [nieobsłużony wyjątek] TypeError: boom\n    at y`),
    braki: { 'Mame Leon Show': 'HTTP 500' },
};

test('brief: ✓ tylko z publikacji, świeże studio, 24 h, usterki, braki wprost', () => {
    const b = zlozBrief(DANE, { teraz: TERAZ, imie: 'Mistrz Arkadiusz' });
    const t = briefJakoTekst(b);
    const sek = Object.fromEntries(b.sekcje.map((s) => [s.id, s.linie.map((l) => l.tekst).join('\n')]));
    assert.match(sek.czeka, /1 publikacja YouTube do ✓: „🎪 TeO Game Show🎪: Nu”/);
    assert.doesNotMatch(sek.czeka, /TeO Game Show: /, 'stan programu „do_akceptacji” to nie sprawa — liczy publikacja');
    assert.match(sek.czeka, /📰 Zebrra News: 1 odcinek czeka na nagranie/);
    assert.match(sek.czeka, /🏛️ Stół: 1 karta czeka na ratyfikację: „Pałac Katedry”/);
    assert.match(sek.czeka, /🐾 Sklep Mini: 1 pakiet do wystawienia, 1 nowa propozycja/);
    assert.match(sek.dzien, /wyszły 2 filmy \(w tym 1 Shorts\) · TeO Univers Studio, Zebrra Sports/);
    assert.match(sek.dzien, /YouTube Shorts 1 dziś \(razem 53\) · TikTok 0 dziś/);
    assert.doesNotMatch(sek.dzien, /Instagram/, 'wyłączony cel nie zaśmieca');
    assert.match(sek.dzien, /💳 Sprzedaż: 1 pakiet \(6 usd\)/);
    assert.match(sek.dzien, /Nocna Zmiana: włączona · 1 zadanie gotowe, 1 z błędem/);
    assert.match(sek.uwaga, /1 publikacja padła: „Padł” — quotaExceeded/);
    assert.doesNotMatch(sek.uwaga, /Bardzo stary błąd|model milczy/, 'stare błędy to historia');
    assert.match(sek.uwaga, /czeka na dzienny limit/);
    assert.match(sek.uwaga, /TikTok: pauza — skrzynka szkiców pełna/);
    assert.match(sek.uwaga, /Most złapał 1 nieobsłużony błąd .* TypeError: boom/);
    assert.match(sek.uwaga, /Nie odczytałem: Mame Leon Show \(HTTP 500\)/);
    assert.ok(b.zapowiedz.length <= 400);
    assert.match(b.zapowiedz, /^☀️ Dzień dobry, Mistrz Arkadiusz! 4 sprawy czekają na Ciebie · wczoraj 2 filmy na YouTube/);
    assert.ok(t.includes('✓ Czeka na Ciebie') && t.includes('⚠ Do sprawdzenia'));
});

test('brief: spokojny dzień mówi to wprost', () => {
    const b = zlozBrief({ publikacje: { publikacje: [] }, bledyMostu: [], braki: {} }, { teraz: TERAZ });
    assert.match(b.sekcje[0].linie[0].tekst, /Nic nie czeka/);
    assert.match(b.sekcje[2].linie[0].tekst, /Bez usterek/);
    assert.match(b.zapowiedz, /nic nie czeka na Twoje ✓ · wczoraj 0 filmów na YouTube · bez usterek/);
});

test('serwis: raz dziennie po godzinie, wieść kanałem Mistrza, źródło, które milczy — w brakach', async () => {
    const katalog = await fs.mkdtemp(path.join(os.tmpdir(), 'brief-'));
    let godzina = 6;
    const wiesci = [];
    const trasy = { '/api/youtube/publikacje': DANE.publikacje, '/api/grv/ja': { wlasciciel: { nazwa: 'Mistrz Arkadiusz' } } };
    const B = utworzPorannyBrief({
        katalog,
        teraz: () => new Date(2026, 9, 24, godzina, 5),
        pobierz: async (t) => { if (trasy[t]) return trasy[t]; throw new Error('HTTP 404'); },
        wiesc: async (w) => { wiesci.push(w); },
    });
    assert.equal(await B.krok(), null, 'przed 7:00 nic');
    godzina = 7;
    const b = await B.krok();
    assert.ok(b && b.dzien === '2026-10-24');
    assert.equal(wiesci.length, 1);
    assert.equal(wiesci[0].rodzaj, 'brief');
    assert.match(wiesci[0].tresc, /Mistrz Arkadiusz/);
    assert.match(b.sekcje[2].linie.map((l) => l.tekst).join(), /Nie odczytałem: .*Stół|stol/);
    assert.equal(await B.krok(), null, 'drugi raz tego dnia — nie');
    await B.ustaw({ glos: true, godzina: 8 });
    assert.deepEqual(await B.ustawienia(), { wlaczony: true, godzina: 8, glos: true });
    await assert.rejects(B.ustaw({ godzina: 25 }), /0–23/);
    const nowy = await B.wygeneruj({ wymus: true });
    assert.equal(wiesci.length, 2);
    assert.equal(wiesci[1].glos, true);
    assert.equal((await B.ostatni()).kiedy, nowy.kiedy);
    await fs.rm(katalog, { recursive: true, force: true });
});
