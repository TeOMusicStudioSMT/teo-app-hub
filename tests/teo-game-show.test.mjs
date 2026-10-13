// 🎪 TeO Game Show: czyste części (prompt intro, konkurencja, wywiad po stworkowemu, kontekst Kronikarza, karta Stołu)
// i PRAWDZIWY łańcuch (ffmpeg: plansza, klatka „po”, finał z wywiadem, Spawacz) z atrapami Wan, głosu, modelu i publikacji.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { utworzGameShow, promptIntro, konkurencja, zapowiedz, ogloszenieWyniku, promptWywiaduStworka, odczytajWywiadStworka, kontekstKronikarza, kartaZarzadzania, INNE_SIECI, PROJEKT } from '../services/TeoGameShow.js';
import { czytajKarte } from '../services/Stol.js';
import { utworzPublikacje } from '../services/PublikacjeYouTube.js';
import { opisz } from '../services/Montazownia.js';
import * as Spawacz from '../services/Spawacz.js';
import { CZCIONKI } from '../services/PowitanieDnia.js';

const czcionka = CZCIONKI.find((p) => fs.existsSync(p));
const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `gameshow-${n}-`));
const czekaj = async (warunek, ms = 240_000) => { const t0 = Date.now(); for (;;) { const w = await warunek(); if (w) return w; if (Date.now() - t0 > ms) throw new Error('Za długo.'); await new Promise((r) => setTimeout(r, 200)); } };
const OCENA = { wynik: 86, takt: 0.92, energia: 0.8, roznorodnosc: 0.85 };
const WYWIAD = 'PYTANIE: Jak się tańczyło?\nSTWOREK: Mru-tii pa-lo, nunu!\nPO POLSKU: Wspaniale, łapki same szły!\n\nPYTANIE: Co dalej?\nSTWOREK: Ka-ri ko, mi-mi tuu.\nPO POLSKU: Teraz drzemka, potem Taniec Tygodnia.';

test('prompt intro po angielsku z imieniem; konkurencja = Mistrzostwa, inaczej Taniec Dnia; zapowiedź i wynik z liczbami', () => {
    const p = promptIntro({ imie: 'Kot Tancerz' });
    assert.match(p, /^Kot Tancerz, a small cute TeOgochi creature/);
    assert.match(p, /first frame/);
    const dzien = { okres: 'dzien', klucz: '2026-10-13', nazwa: 'Taniec Dnia' };
    assert.equal(konkurencja([dzien, { okres: 'rok', klucz: '2026', nazwa: 'Taniec Roku' }], 'pl').nazwa, 'Taniec Dnia');
    assert.equal(konkurencja([dzien, { okres: 'mistrzostwa', klucz: 'MS-2026', nazwa: 'Mistrzostwa Świata 2026' }], 'pl').nazwa, 'Mistrzostwa Świata 2026');
    assert.equal(konkurencja([], 'pl').nazwa, 'Taneczne Starcie');
    // domyślnie po angielsku (program dla świata)
    assert.equal(konkurencja([dzien]).nazwa, 'Dance of the Day');
    assert.equal(konkurencja([dzien, { okres: 'mistrzostwa', klucz: 'MS-2026', nazwa: 'Mistrzostwa Świata 2026' }]).nazwa, 'World Championship 2026');
    assert.match(zapowiedz({ tancerz: 'Kot', utwor: 'Joann1', bpm: 128, konk: { nazwa: 'Taniec Dnia' }, jezyk: 'pl' }), /Taneczne Starcie — Taniec Dnia.*Kot.*„Joann1”, 128 uderzeń/);
    assert.match(zapowiedz({ tancerz: 'Kot', utwor: 'Joann1', bpm: 133.1, konk: { nazwa: 'Dance of the Day' } }), /^Welcome to the TeO Game Show!.*Dance Clash — Dance of the Day.*“Joann1”, 133 beats per minute/);
    assert.match(ogloszenieWyniku({ tancerz: 'Kot', ocena: OCENA, jezyk: 'pl' }), /86 punktów na sto — ranga A! Takt 92%, energia 80%, różnorodność 85%/);
    assert.match(ogloszenieWyniku({ tancerz: 'Kot', ocena: OCENA }), /Kot scores 86 out of a hundred — rank A! Rhythm 92%, energy 80%, variety 85%/);
});

test('wywiad po stworkowemu: prompt zakazuje prawdziwych słów, parser bierze 1–3 trójki, bez formatu = błąd', () => {
    const { system, user } = promptWywiaduStworka({ tancerz: 'Kot', opis: 'puszysty', utwor: 'Joann1', ocena: OCENA });
    assert.match(system, /WŁASNYM językiem stworków/);
    assert.match(system, /TŁUMACZENIE: <tłumaczenie odpowiedzi po ANGIELSKU/);
    assert.match(promptWywiaduStworka({ tancerz: 'Kot', utwor: 'x', ocena: OCENA, jezyk: 'pl' }).system, /TŁUMACZENIE: <tłumaczenie odpowiedzi po polsku>/);
    assert.match(user, /86\/100 \(ranga A\)/);
    const w = odczytajWywiadStworka(`<think>hmm</think>${WYWIAD}`);
    assert.equal(w.length, 2);
    assert.deepEqual(w[0], { pytanie: 'Jak się tańczyło?', stworek: 'Mru-tii pa-lo, nunu!', tlumaczenie: 'Wspaniale, łapki same szły!' });
    assert.equal(odczytajWywiadStworka('PYTANIE: How was it?\nSTWOREK: Mru!\nTŁUMACZENIE: Great!')[0].tlumaczenie, 'Great!');
    assert.throws(() => odczytajWywiadStworka('Kot mówi: miau.'), /nie trzymał formatu/);
});

test('kontekst Kronikarza = fakty odcinka; karta Stołu czytelna dla Stołu; inne sieci tylko „niepodłączone” z powodem', () => {
    const k = kontekstKronikarza({ konkurencja: { nazwa: 'Taniec Dnia', wszystkie: ['Taniec Dnia', 'Taniec Roku'] }, tancerz: { imie: 'Kot', opis: 'puszysty' }, utwor: { tytul: 'Joann1', bpm: 128 }, ocena: OCENA, wywiad: odczytajWywiadStworka(WYWIAD) });
    assert.match(k, /TeO Game Show:/);
    assert.match(k, /Wynik: 86\/100, ranga A/);
    assert.match(k, /Jak się tańczyło\? → Wspaniale/);
    const karta = kartaZarzadzania();
    const c = czytajKarte(karta.tresc);
    assert.match(c.wizja, /^Dedykowany kanał YouTube „TeO Game Show”/);
    assert.deepEqual(c.uczestnicy, ['Kronikarz', 'Reżyser', 'Aktor', 'Mistrz']);
    assert.ok(INNE_SIECI.length >= 4 && INNE_SIECI.every((s) => s.stan === 'niepodłączony' && s.powod.length > 20));
});

test('kanał programu: ustawiony kanał projektu wygrywa z domyślnym; niepołączony = odmowa; null = zapomnij', async () => {
    const kat = tmp('kanal');
    const P = utworzPublikacje({ katalog: kat, pisz: async () => ({ tekst: '' }), impresariat: {}, statusFilmu: async () => ({}), naWystawe: async () => {}, gotowyYouTube: async () => true,
        kanaly: async () => ({ domyslny: 'UC_glowny', kanaly: [{ id: 'UC_glowny', nazwa: 'TeO Music' }, { id: 'UC_show', nazwa: 'TeO Game Show' }] }) });
    assert.equal((await P.kanalProjektu(PROJEKT)).kanalNazwa, 'TeO Music');
    await assert.rejects(P.ustawKanalProjektu(PROJEKT, 'UC_obcy'), /nie jest połączony/);
    const k = await P.ustawKanalProjektu(PROJEKT, 'UC_show');
    assert.equal(k.kanalNazwa, 'TeO Game Show');
    assert.equal(k.zapamietany, 'UC_show');
    assert.equal((await P.ustawKanalProjektu(PROJEKT, null)).kanalNazwa, 'TeO Music');
});

test('łańcuch: intro pada → odcinek staje z powodem → „bez intro” kończy; z intro = klocki + intro + konkurencja + występ + finał → do ✓', { skip: !czcionka && 'brak czcionki' }, async () => {
    const kat = tmp('lancuch');
    const nagrania = path.join(kat, 'nagrania');
    fs.mkdirSync(nagrania, { recursive: true });
    const ff = (args) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
    ff(['-f', 'lavfi', '-i', 'testsrc=s=640x360:r=30:d=2', '-f', 'lavfi', '-i', 'sine=f=440:d=2', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(nagrania, 'taniec_kot_abc123.mp4')]);
    ff(['-f', 'lavfi', '-i', 'color=c=orange:s=512x512:d=1', '-frames:v', '1', path.join(kat, 'kot.png')]);
    ff(['-f', 'lavfi', '-i', 'testsrc2=s=832x480:r=16:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(kat, 'intro-wan.mp4')]);
    ff(['-f', 'lavfi', '-i', 'sine=f=660:d=0.8', path.join(kat, 'glos.wav')]);
    const klockiStart = path.join(kat, 'start.mp4');
    ff(['-f', 'lavfi', '-i', 'color=c=purple:s=1920x1080:r=25:d=0.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', klockiStart]);

    const choreo = { id: 'c-12345678', nazwa: 'Kot — Joann1', odcisk: 'abcd1234', mini: { id: 'mini-kot', nazwa: 'Kot Tancerz' }, utwor: { tytul: 'Joann1', bpm: 128 }, ocena: OCENA, nagrania: [{ nazwa: 'taniec_kot_abc123.mp4' }] };
    let introPada = true;
    const prosbyIntro = [], publikacje = [], mowy = [], odrzucone = [];
    const GS = utworzGameShow({
        katalog: kat, ffmpeg: ffmpegPath,
        katalogMontazy: async (p) => { const d = path.join(kat, 'produkcje', p, 'montaz'); fs.mkdirSync(d, { recursive: true }); return d; },
        katalogNagran: async () => nagrania,
        choreografie: { wczytaj: async (id) => { if (id !== choreo.id) throw new Error('Nie ma takiej choreografii.'); return choreo; } },
        tancerz: async (mini) => ({ imie: mini.nazwa, opis: 'puszysty kocur', obraz: path.join(kat, 'kot.png') }),
        intro: async (o) => { prosbyIntro.push(o); if (introPada) throw new Error('ComfyUI śpi'); return path.join(kat, 'intro-wan.mp4'); },
        chat: async () => ({ tekst: WYWIAD, silnik: 'atrapa' }),
        mow: async (o) => { mowy.push(o); return { audio: fs.readFileSync(path.join(kat, 'glos.wav')), ext: 'wav' }; },
        opisz,
        spawaj: ({ klipy, wyjscie, celWedlug }) => Spawacz.spawaj({ klipy, wyjscie, opisz, uruchom: async (b, a) => execFileSync(b, a, { stdio: 'pipe' }), ffmpeg: ffmpegPath, celWedlug }),
        klocki: async () => ({ start: [klockiStart], end: [] }),
        okresy: () => [{ okres: 'dzien', klucz: '2026-10-13', nazwa: 'Taniec Dnia' }],
        odrzucPublikacje: async (id) => { odrzucone.push(id); },
        publikuj: async (z) => { publikacje.push(z); return { id: `yt_${publikacje.length}`, etap: 'do_akceptacji', tytul: 'TeO Game Show: Kot Tancerz tańczy', kanalNazwa: 'TeO Game Show' }; },
    });
    await assert.rejects(GS.utworz(choreo.id, 'inny.mp4'), /nie ma takiego nagrania/);

    // 1) intro pada: odcinek staje na intro, reszta czeka
    const s1 = await GS.utworz(choreo.id, 'taniec_kot_abc123.mp4', { jezyk: 'pl' });
    assert.equal((await GS.utworz(choreo.id, 'taniec_kot_abc123.mp4')).id, s1.id, 'drugie wywołanie nie robi drugiego odcinka');
    await GS.czekaj();
    let s = await GS.wczytaj(s1.id);
    assert.equal(s.stan, 'blad');
    assert.equal(s.etapy.intro.stan, 'blad');
    assert.match(s.etapy.intro.powod, /ComfyUI śpi/);
    assert.equal(s.etapy.konkurencja.stan, 'czeka');
    assert.equal(prosbyIntro[0].obraz, path.join(kat, 'kot.png'));
    assert.match(prosbyIntro[0].prompt, /^Kot Tancerz/);

    // 2) „bez intro” — reszta łańcucha do końca
    await GS.ponow(s1.id, { bezIntro: true });
    await GS.czekaj();
    s = await GS.wczytaj(s1.id);
    assert.equal(s.stan, 'do_akceptacji', s.powod ?? '');
    assert.equal(s.etapy.intro.stan, 'pominiety');
    assert.equal(s.etapy.final.obrazPo, true);
    assert.equal(s.etapy.final.wywiad, 2);
    assert.ok(fs.existsSync(s.plik));
    const bez = await opisz(s.plik);
    assert.equal(bez.szerokosc, 640, 'wyrównanie do rozmiaru występu');
    assert.equal(publikacje[0].zrodlo.projekt, PROJEKT);
    assert.match(publikacje[0].kontekst, /Wynik: 86\/100/);
    assert.equal(s.publikacja.id, 'yt_1');
    assert.ok(mowy.some((m) => m.kto === 'stworek' && /Mru-tii/.test(m.tekst)));
    assert.ok(mowy.some((m) => m.kto === 'prowadzacy' && /Witajcie w TeO Game Show/.test(m.tekst) && m.jezyk === 'pl'));
    assert.equal(publikacje[0].jezyk, 'pl');

    // 3) nowe nagranie, intro działa — film dłuższy o intro
    introPada = false;
    choreo.nagrania.push({ nazwa: 'taniec_kot_def456.mp4' });
    fs.copyFileSync(path.join(nagrania, 'taniec_kot_abc123.mp4'), path.join(nagrania, 'taniec_kot_def456.mp4'));
    const s2 = await GS.utworz(choreo.id, 'taniec_kot_def456.mp4');
    await GS.czekaj();
    const z = await GS.wczytaj(s2.id);
    assert.equal(z.stan, 'do_akceptacji', z.powod ?? '');
    assert.equal(z.etapy.intro.stan, 'gotowy');
    assert.equal(z.etapy.sklejanie.klocki.start, 1);
    const zIntro = await opisz(z.plik);
    assert.ok(zIntro.sekundy > bez.sekundy + 0.8, `intro (1 s) wydłuża odcinek (${bez.sekundy} → ${zIntro.sekundy})`);
    assert.equal((await GS.lista()).length, 2);
    await assert.rejects(GS.ponow(s2.id), /tylko odcinek, który stanął na błędzie/);
    // domyślny język = angielski: zapowiedź, wywiad i Kronikarz po angielsku, plik z _en_
    assert.equal(z.jezyk, 'en');
    assert.equal(z.konkurencja.nazwa, 'Dance of the Day');
    assert.match(z.plik, /gameshow_Kot_Tancerz_en_/);
    assert.ok(mowy.some((m) => m.kto === 'prowadzacy' && m.jezyk === 'en' && /^Welcome to the TeO Game Show/.test(m.tekst)));
    assert.equal(publikacje.at(-1).jezyk, 'en');

    // 4) przeróbka gotowego odcinka po polsku: intro zostaje (Wan nie liczy drugi raz), stara publikacja odrzucona
    const introPrzed = prosbyIntro.length, staraPub = z.publikacja.id;
    await GS.ponow(s2.id, { jezyk: 'pl' });
    await GS.czekaj();
    const zPl = await GS.wczytaj(s2.id);
    assert.equal(zPl.stan, 'do_akceptacji', zPl.powod ?? '');
    assert.equal(zPl.jezyk, 'pl');
    assert.equal(zPl.konkurencja.nazwa, 'Taniec Dnia');
    assert.equal(prosbyIntro.length, introPrzed, 'intro nie liczy się drugi raz');
    assert.equal(zPl.etapy.intro.stan, 'gotowy');
    assert.deepEqual(odrzucone, [staraPub]);
    assert.match(zPl.plik, /gameshow_Kot_Tancerz_pl_/);
    assert.ok((await opisz(zPl.plik)).sekundy > bez.sekundy + 0.8, 'przerobiony odcinek dalej ma intro');
    assert.equal(publikacje.at(-1).jezyk, 'pl');
});

test('duch po restarcie: „robi” bez pracy w pamięci = błąd z powodem, można ponowić', async () => {
    const kat = tmp('duch');
    const id = 's-0badf00d';
    fs.mkdirSync(path.join(kat, 'game-show', id), { recursive: true });
    fs.writeFileSync(path.join(kat, 'game-show', id, 'show.json'), JSON.stringify({ id, stan: 'robi', etapy: { intro: { stan: 'robi' }, konkurencja: { stan: 'czeka' }, final: { stan: 'czeka' }, sklejanie: { stan: 'czeka' }, publikacja: { stan: 'czeka' } }, uwagi: [] }));
    const GS = utworzGameShow({ katalog: kat, katalogMontazy: async () => kat, katalogNagran: async () => kat, choreografie: { wczytaj: async () => ({}) }, tancerz: async () => ({}), opisz, spawaj: async () => ({}) });
    const s = await GS.wczytaj(id);
    assert.equal(s.stan, 'blad');
    assert.match(s.etapy.intro.powod, /restartowany/);
});
