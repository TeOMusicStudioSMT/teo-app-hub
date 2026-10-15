/**
 * ⚽ Gol Dnia — program Katedry, w którym TeOgochi RYSUJE i OPOWIADA bramki z prawdziwych meczów (Suweren 2026-10-15).
 *
 * Pomysł Suwerena: kanał z samymi golami, ale po naszemu — piłkarka TeOgochi ze słodkim głosem w intro, przed każdym
 * golem stop-klatka strzelca i parę słów o nim, po golu stop-klatka i parę słów o bramce, komentarz z każdym odcinkiem
 * bogatszy; narrator z TEMPERAMENTEM (królik słodko, byk z pazurem) i studio, w którym ten sam mecz opowiadają różni.
 *
 * PRAWA (uczciwie, decyzja z rozmowy): obraz NIE pochodzi z cudzych nagrań (prawa lig/nadawców, regulamin YouTube,
 * Content ID) — ani pobrany, ani „przerysowany” z nagrania. Bierzemy tylko FAKTY meczu (wynik, minuta, strzelec,
 * asysta, opis akcji — fakty nie są czyimś utworem), a każdą klatkę rysuje FLUX w stylu Katedry: piłkarze to stworki
 * TeOgochi w barwach drużyn, bez prawdziwych twarzy, herbów i logotypów.
 *
 * Łańcuch odcinka (jeden naraz — GPU i ffmpeg), każdy etap z faktów, błąd = stop z powodem, „↻ Ponów” od etapu:
 *   scenariusz → narrator (model TeOgochi `pilkarka`) pisze intro, przed/okrzyk/po każdego gola i outro w swoim
 *                temperamencie, tylko z podanych faktów, z PAMIĘCIĄ (strzelcy z poprzednich odcinków, poprawki Suwerena)
 *   obrazy     → FLUX: narrator w studiu, karta strzelca (stworek w barwach klubu), scena gola, plansza wyniku
 *   segmenty   → głos narratora + napisy na kadrach (argumentyKwestii; wolny najazd kamery)
 *   sklejenie  → `produkcje/gol-dnia/montaz/gol_<mecz>_<narrator>_<id>.mp4`
 *   publikacja → Kronikarz pisze tytuł/opis → ✓ Suwerena w Izbie → kanał programu
 * Fakty meczu: mecze i wyniki z TheSportsDB (darmowe), strzelcy i minuty — `cfg.zwiad` (wyszukiwanie w sieci z
 * podaniem źródeł); liczba goli każdej drużyny MUSI zgadzać się z wynikiem, inaczej fakty odrzucone. Suweren może
 * poprawić fakty ręcznie.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { CZCIONKI, zawin } from './PowitanieDnia.js';
import { argumentyKwestii, czasBezGlosu } from './WywiadAktorow.js';
import { klockiWJezyku } from './TeoGameShow.js';

export const PROJEKT = 'gol-dnia';
export const NAZWA = 'Gol Dnia';
const ID = /^g-[0-9a-f]{8}$/;
const KOLOR = '#22c55e';
const ETAPY = ['scenariusz', 'obrazy', 'segmenty', 'sklejenie', 'publikacja'];
export const JEZYKI = { en: 'English', pl: 'polski' };

/** Ligi z TheSportsDB (id lig darmowego API). */
export const LIGI = {
    4328: 'Premier League', 4335: 'LaLiga', 4331: 'Bundesliga', 4332: 'Serie A', 4334: 'Ligue 1',
    4480: 'UEFA Champions League', 4422: 'Ekstraklasa', 4337: 'Eredivisie', 4344: 'Primeira Liga',
};

/**
 * Narratorzy — temperament prowadzi i słowa, i kreskę (Suweren: „postać teogochi odpowiada za temperament wypowiedzi
 * i rysowania — króliczek słodko, byk z nutą agresywną”). `wyglad`/`kreska` idą do FLUX po angielsku.
 */
export const NARRATORZY = {
    pilkarka: { imie: 'Piłkarka', imieEn: 'Kickie', emoji: '⚽', temperament: 'słodka, ciepła, zachwycona każdą bramką, mówi jak najlepsza przyjaciółka kibica',
        temperamentEn: 'sweet, warm, delighted by every goal — talks like the fan\'s best friend',
        wyglad: 'a cute round TeOgochi creature girl in a tiny football kit with a ponytail, big sparkling eyes, holding a microphone', kreska: 'soft pastel colors, rounded shapes, gentle glow, cozy cartoon' },
    krolik: { imie: 'Królik', imieEn: 'Bunny', emoji: '🐰', temperament: 'słodki, delikatny, rozczulony, zdrobnienia, ale konkretny w faktach',
        temperamentEn: 'sweet, gentle, tender, cute words but precise with the facts',
        wyglad: 'a fluffy little bunny TeOgochi creature with a scarf and headset', kreska: 'pastel watercolor, soft light, sparkles' },
    byk: { imie: 'Byk', imieEn: 'Bull', emoji: '🐂', temperament: 'ognisty, z pazurem i nutą agresji, krótkie mocne zdania, okrzyki — ale nikogo nie obraża',
        temperamentEn: 'fiery, punchy, a hint of aggression, short strong sentences and shouts — never insulting anyone',
        wyglad: 'a muscular bull TeOgochi creature with small horns, a sweatband and a roaring expression', kreska: 'bold strokes, high contrast, motion lines, fiery reds and oranges, dynamic comic style' },
    sowa: { imie: 'Sowa', imieEn: 'Owl', emoji: '🦉', temperament: 'spokojna, analityczna, taktyka i ustawienie, rzeczowo z odrobiną humoru',
        temperamentEn: 'calm, analytical, tactics and positioning, matter-of-fact with a touch of humor',
        wyglad: 'a wise owl TeOgochi creature with round glasses and a tactics board', kreska: 'clean lines, blueprint accents, cool blue palette, tidy diagram style' },
    // 🦓🦁 Prowadzący Studia Zebrra Football (Suweren 2026-10-15) — najciekawsze mecze i podsumowania; resztę opowiada stado.
    // Zlat Kadabra to ORYGINALNA postać w stylu wielkiej gwiazdy — nie podszywa się pod żadnego prawdziwego piłkarza.
    zebra: { imie: 'Gol Donna', imieEn: 'Gol Donna', emoji: '🦓', rola: 'prowadzacy', kolor: '#f5f5f5',
        temperament: 'elegancka, pewna siebie, z humorem i klasą — czarno-biała gospodyni studia, która każdą bramkę podaje jak główne wydarzenie wieczoru; ripostuje z uśmiechem',
        temperamentEn: 'elegant, self-assured, witty and classy — the black-and-white hostess of the studio who presents every goal like the main event of the night; quick with a smiling comeback',
        wyglad: 'an elegant zebra TeOgochi creature hostess with bold black-and-white stripes, a sleek studio blazer, a confident smile and a microphone', kreska: 'crisp black-and-white contrast with neon pitch-green accents, glossy TV studio lighting, stylish cartoon' },
    lew: { imie: 'Zlat Kadabra', imieEn: 'Zlat Kadabra', emoji: '🦁', rola: 'prowadzacy', kolor: '#f59e0b',
        temperament: 'gwiazdorski i charyzmatyczny, chełpliwy z przymrużeniem oka, mówi o sobie w trzeciej osobie („Zlat Kadabra widział już takie gole…”), ale fakty podaje uczciwie i nikogo nie obraża',
        temperamentEn: 'a superstar with huge charisma, boastful with a wink, talks about himself in the third person ("Zlat Kadabra has seen goals like this before…") but keeps the facts honest and never insults anyone',
        wyglad: 'a charismatic lion TeOgochi creature with a huge golden mane, sunglasses pushed up on his head, a sharp golden suit, posing like a superstar', kreska: 'golden highlights, dramatic spotlight, bold glamorous comic style' },
    lampart: { imie: 'Jai Lampart', imieEn: 'Jai Lampart', emoji: '🐆', rola: 'prowadzacy', kolor: '#eab308',
        temperament: 'energia sprintera: szybkie, zwinne zdania, zachwyt kontratakiem, dryblingiem i tempem akcji; liczy kroki do bramki, ale nie zmyśla liczb',
        temperamentEn: 'sprinter energy: quick, agile sentences, thrilled by counter-attacks, dribbling and tempo; counts the strides to goal but never invents numbers',
        wyglad: 'an athletic leopard TeOgochi creature with golden spotted fur, a teal-and-blue sports jersey and an excited grin', kreska: 'dynamic speed lines, teal and gold accents, sleek sporty cartoon' },
};
/** Prowadzący studia (rola `prowadzacy`); reszta to stado narratorów. */
export const PROWADZACY = Object.keys(NARRATORZY).filter((k) => NARRATORZY[k].rola === 'prowadzacy');
/** Wideo odcinka: 🎞️ segmenty z napisami (ffmpeg) albo 🎥 nagranie ze Studia Zebrra Football (apka 3D). */
export const WIDEO = { napisy: '🎞️ kadry z napisami', studio: '🎥 Studio Zebrra Football (3D)' };
/** Współprowadzący: do trzech obok prowadzącego (Suweren 2026-10-15: „prowadząca/cy + do trzech współprowadzących”). */
export const MAX_WSPOL = 3;
/** Linie współprowadzących: okrzyk i opis gola („po”); prowadzący mówi intro, kartę strzelca i outro. */
export const LINIE_WSPOL = ['okrzyk', 'po'];
/** Współprowadzący odcinka (0–3, bez prowadzącego i dubli) — nowe `wspolprowadzacy`, starsze odcinki z jednym `wspol`. */
export function wspolprowadzacyOdcinka(s) {
    const w = Array.isArray(s?.wspolprowadzacy) ? s.wspolprowadzacy : s?.wspol ? [s.wspol] : [];
    return w.filter((k, i, a) => k && NARRATORZY[k] && k !== s.narrator && a.indexOf(k) === i).slice(0, MAX_WSPOL);
}
/** Wszyscy na scenie: prowadzący pierwszy, potem współprowadzący. */
export const skladOdcinka = (s) => [s.narrator, ...wspolprowadzacyOdcinka(s)];
/** Kto mówi linię: okrzyk i „po” gola nr `gol` (od 0) — współprowadzący po kolei (gol i → i-ty mod ich liczby). */
export function ktoMowi(typ, s, gol = 0) {
    const w = wspolprowadzacyOdcinka(s);
    return w.length && LINIE_WSPOL.includes(typ) ? w[(Number(gol) || 0) % w.length] : s.narrator;
}

const KLATKA_BEZ_PRAW = 'no real people, no real faces, no club crests, no logos, no brand names, no text, no watermark';

// ─── Fakty ───────────────────────────────────────────────────────────────────────────────────────────

/** Mecz z TheSportsDB → nasz kształt (tylko zakończone, z wynikiem). */
export function meczZTheSportsDb(e) {
    const g = Number(e?.intHomeScore), d = Number(e?.intAwayScore);
    if (!e?.idEvent || !Number.isInteger(g) || !Number.isInteger(d) || e.intHomeScore === null || e.intAwayScore === null) return null;
    return { id: String(e.idEvent), liga: e.strLeague ?? null, data: e.dateEvent ?? null, gospodarze: String(e.strHomeTeam ?? ''), goscie: String(e.strAwayTeam ?? ''), wynik: [g, d], stadion: e.strVenue ?? null,
        idGospodarzy: e.idHomeTeam ? String(e.idHomeTeam) : null, idGosci: e.idAwayTeam ? String(e.idAwayTeam) : null };
}

// ─── Barwy drużyn (odznaki-monogramy w studiu — NIE herby: herby to znaki towarowe) ─────────────────────────

const HEX = /^#[0-9a-f]{6}$/i;
/** Barwa z nazwy (gdy TheSportsDB nie poda): stały odcień z sumy znaków — ta sama drużyna = ta sama para. */
export function barwyZNazwy(nazwa) {
    let h = 0;
    for (const z of String(nazwa)) h = (h * 31 + z.codePointAt(0)) >>> 0;
    const hsl = (hh, s, l) => {
        const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + hh / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
        return `#${f(0)}${f(8)}${f(4)}`;
    };
    const odcien = h % 360;
    return [hsl(odcien, 0.7, 0.42), (h >> 9) % 3 === 0 ? '#f8fafc' : hsl((odcien + 180) % 360, 0.6, 0.85)];
}
/** Barwy z wpisu drużyny TheSportsDB — tylko gdy nazwa się zgadza (darmowy klucz potrafi oddać inną drużynę). */
export function barwyZDruzyny(team, nazwa) {
    const norm = (x) => String(x ?? '').normalize('NFKD').replace(/[^\w]/g, '').toLowerCase();
    if (!team || !norm(nazwa) || !(norm(team.strTeam).includes(norm(nazwa)) || norm(nazwa).includes(norm(team.strTeam)) || norm(team.strTeamAlternate).includes(norm(nazwa)))) return null;
    const c = [team.strColour1, team.strColour2, team.strColour3].map((x) => String(x ?? '').trim()).filter((x) => HEX.test(x));
    return c.length ? [c[0], c[1] && c[1].toLowerCase() !== c[0].toLowerCase() ? c[1] : (c[2] ?? '#f8fafc')] : null;
}
/** Monogram odznaki: pierwsze litery słów bez „FC/AFC/CF…”, 2–3 znaki („Newcastle United” → „NU”). */
export function monogram(nazwa) {
    const slowa = String(nazwa ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[\s.-]+/).filter((w) => w && !/^(fc|afc|cf|sc|ac|ssc|as|rc|cd|ud|sv|vfb|vfl|tsg|bv|fk|ks|1\.?)$/i.test(w));
    if (!slowa.length) return '?';
    if (slowa.length === 1) return slowa[0].slice(0, 3).toUpperCase();
    return slowa.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

/** Kompilacja: odcinek z kilku meczów (Suweren 2026-10-15). Najwyżej `MAX_MECZOW`, każdy z faktami osobno. */
export const MAX_MECZOW = 6;
/** „2 mecze”, „5 meczów” (kompilacja ma 2–6 meczów). */
const ileMeczow = (n) => `${n} ${n >= 2 && n <= 4 ? 'mecze' : 'meczów'}`;
export const czyKompilacja = (s) => Array.isArray(s?.mecze) && s.mecze.length > 1;
/** Mecze odcinka: kompilacja — lista, pojedynczy — [mecz]. */
export const meczeOdcinka = (s) => (czyKompilacja(s) ? s.mecze : [s.mecz]);
/** Mecz, do którego należy gol (pole `mecz` = indeks w kompilacji). */
export const meczGola = (s, g) => meczeOdcinka(s)[Number(g?.mecz) || 0] ?? s.mecz;
/** Krótki opis do szyny i Kronikarza: „A – B” albo „kompilacja 3 meczów: A–B, C–D…”. */
export function opisMeczu(s, en = false) {
    if (!czyKompilacja(s)) return `${s.mecz.gospodarze} – ${s.mecz.goscie}`;
    return `${en ? `compilation of ${s.mecze.length} matches` : `kompilacja (${ileMeczow(s.mecze.length)})`}: ${s.mecze.map((m) => `${m.gospodarze} ${m.wynik[0]}:${m.wynik[1]} ${m.goscie}`).join(', ')}`;
}
const bezpNazwa = (x) => String(x).normalize('NFKD').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
/** Część nazwy pliku: „Gosp-Gosc” albo „kompilacja-<n>”. */
export const nazwaPlikuMeczu = (s) => (czyKompilacja(s) ? `kompilacja-${s.mecze.length}` : `${bezpNazwa(s.mecz.gospodarze)}-${bezpNazwa(s.mecz.goscie)}`);

/**
 * Kwestie odcinka po kolei — wspólne dla segmentów z napisami i Studia 3D: kto mówi, co, z jakim obrazem i nagłówkiem.
 * `typ`: intro | przed | okrzyk | po | outro; `gol` = indeks bramki albo null.
 */
export function kwestieOdcinka(s) {
    if (!s?.scenariusz) return [];
    const en = s.jezyk === 'en';
    const imie = (k) => (en ? NARRATORZY[k]?.imieEn : NARRATORZY[k]?.imie) ?? k;
    const kto = (typ, gol = 0) => ktoMowi(typ, s, gol);
    const ob = s.obrazy ?? null;
    const out = [];
    const dodaj = (typ, gol, tekst, naglowek, obraz) => out.push({ nr: out.length + 1, typ, gol, kto: kto(typ, gol ?? 0), tekst, naglowek, obraz });
    const kompilacja = czyKompilacja(s);
    dodaj('intro', null, s.scenariusz.intro, `${NARRATORZY[kto('intro')]?.emoji ?? ''} ${imie(kto('intro'))} · ${kompilacja ? `${NAZWA} — ${en ? `${s.mecze.length} matches` : ileMeczow(s.mecze.length)}` : `${s.mecz.gospodarze} – ${s.mecz.goscie}`}`, ob?.intro ?? null);
    // kompilacja: przed golami każdego meczu jego zapowiedź (MECZ k); mecz bez goli = sama zapowiedź
    const zapowiedz = (k) => { const m = s.mecze[k]; dodaj('mecz', null, s.scenariusz.mecze?.[k] ?? '', `${m.gospodarze} ${m.wynik[0]}:${m.wynik[1]} ${m.goscie}`, ob?.intro ?? null); out[out.length - 1].mecz = k; };
    let ostatniMecz = -1;
    const dociagnij = (do_) => { if (!kompilacja) return; while (ostatniMecz < do_) zapowiedz(++ostatniMecz); };
    for (const [i, g] of s.gole.entries()) {
        dociagnij(Number(g.mecz) || 0);
        const sc = s.scenariusz.gole[i];
        dodaj('przed', i, sc.przed, `${g.minuta}' ${g.strzelec}`, ob?.gole?.[i]?.karta ?? null);
        dodaj('okrzyk', i, sc.okrzyk, `⚽ ${en ? 'GOAL' : 'GOL'}! ${g.minuta}'`, ob?.gole?.[i]?.scena ?? null);
        dodaj('po', i, sc.po, `${g.strzelec}${g.asysta ? ` · ${en ? 'assist' : 'asysta'}: ${g.asysta}` : ''}`, ob?.gole?.[i]?.scena ?? null);
    }
    dociagnij(kompilacja ? s.mecze.length - 1 : -1);
    dodaj('outro', null, s.scenariusz.outro, kompilacja ? s.mecze.map((m) => `${m.wynik[0]}:${m.wynik[1]}`).join(' · ') : `${s.mecz.gospodarze} ${s.mecz.wynik[0]}:${s.mecz.wynik[1]} ${s.mecz.goscie}`, ob?.wynik ?? null);
    if (kompilacja) for (const k of out) if (k.gol !== null) k.mecz = Number(s.gole[k.gol]?.mecz) || 0;
    return out;
}

/** Gole od Zwiadowcy (JSON w tekście) → oczyszczone; tylko strony gospodarze/goscie. */
export function odczytajGole(tekst) {
    const s = String(tekst ?? '').replace(/```(?:json)?/gi, '');
    const start = s.indexOf('{'), koniec = s.lastIndexOf('}');
    if (start < 0 || koniec <= start) return null;
    let j; try { j = JSON.parse(s.slice(start, koniec + 1)); } catch { return null; }
    if (!Array.isArray(j?.gole)) return null;
    return j.gole.map((g) => ({
        minuta: String(g?.minuta ?? '').replace(/[^\d+]/g, '').slice(0, 6),
        strzelec: String(g?.strzelec ?? '').trim().slice(0, 60),
        druzyna: g?.druzyna === 'goscie' || g?.druzyna === 'away' ? 'goscie' : g?.druzyna === 'gospodarze' || g?.druzyna === 'home' ? 'gospodarze' : null,
        asysta: g?.asysta ? String(g.asysta).trim().slice(0, 60) : null,
        opis: g?.opis ? String(g.opis).trim().slice(0, 240) : null,
        samobojczy: g?.samobojczy === true,
        karny: g?.karny === true,
    }));
}

/**
 * Twarde sprawdzenie faktów: liczba goli każdej strony = wynik meczu, minuty 1–130, strzelec podany.
 * Gol samobójczy liczy się drużynie, która na nim ZYSKAŁA (`druzyna` = beneficjent). Zwraca powód odmowy albo null.
 */
export function sprawdzGole(gole, wynik) {
    if (!Array.isArray(gole)) return 'brak listy goli';
    for (const [i, g] of gole.entries()) {
        if (!g.strzelec) return `gol ${i + 1}: brak strzelca`;
        if (!g.druzyna) return `gol ${i + 1}: nie wiadomo, której drużyny`;
        const m = Number(String(g.minuta).split('+')[0]);
        if (!(m >= 1 && m <= 130)) return `gol ${i + 1}: minuta „${g.minuta}” poza meczem`;
    }
    const gosp = gole.filter((g) => g.druzyna === 'gospodarze').length, gosc = gole.filter((g) => g.druzyna === 'goscie').length;
    if (gosp !== wynik[0] || gosc !== wynik[1]) return `fakty nie zgadzają się z wynikiem: gole ${gosp}:${gosc}, wynik meczu ${wynik[0]}:${wynik[1]}`;
    return null;
}

export function promptZwiadu(mecz) {
    return `Mecz piłkarski: ${mecz.gospodarze} – ${mecz.goscie}, ${mecz.data ?? ''}${mecz.liga ? `, ${mecz.liga}` : ''}, wynik końcowy ${mecz.wynik[0]}:${mecz.wynik[1]}.
Znajdź w sieci WSZYSTKIE bramki tego meczu: minuta, strzelec, drużyna (gospodarze/goscie — drużyna, której gol zalicza się do wyniku; przy samobójczym ta, która zyskała), asysta i krótki opis akcji (np. „strzał z woleja z 16 m po rzucie rożnym”). Tylko fakty z relacji — niczego nie dopowiadaj.
Odpowiedz WYŁĄCZNIE JSON-em: {"gole":[{"minuta":"23","strzelec":"…","druzyna":"gospodarze|goscie","asysta":"… albo null","opis":"…","samobojczy":false,"karny":false}],"zrodla":["pełny adres strony z relacją, z której wziąłeś fakty"]}
Goli ma być dokładnie ${mecz.wynik[0] + mecz.wynik[1]} (${mecz.wynik[0]} gospodarzy, ${mecz.wynik[1]} gości).`;
}

/**
 * Zwiad po kolei: każdy dostawca z kluczem pyta sieć; błąd (limit konta, HTTP, brak JSON-u, fakty niezgodne z wynikiem
 * — `sprawdz` rzuca) = następny. Bez klucza = pominięty z powodem. Wszyscy padli = jeden błąd z powodami każdego.
 * @param {{ nazwa: string, klucz: () => Promise<string|null>|string|null, fn: (prompt: string, klucz: string) => Promise<{ tekst: string, zrodla: string[] }> }[]} proby
 */
export async function zwiadPoKolei(proby, prompt, sprawdz = null) {
    const powody = [];
    for (const p of proby) {
        const klucz = await Promise.resolve().then(() => p.klucz()).catch(() => null);
        if (!klucz) { powody.push(`${p.nazwa}: brak klucza`); continue; }
        try {
            const w = await p.fn(prompt, klucz);
            const wynik = sprawdz ? sprawdz(w) : w;
            return { ...w, ...(wynik && typeof wynik === 'object' ? wynik : {}), dostawca: p.nazwa, pominieci: powody };
        } catch (e) { powody.push(`${p.nazwa}: ${String(e.message || e).slice(0, 200)}`); }
    }
    throw new Error(powody.every((x) => /brak klucza/.test(x))
        ? 'Zwiadowca potrzebuje sieci: klucza Claude albo Gemini (TeO Kibel → „🔗 Udostępnij mostowi”). Model lokalny nie przeszuka internetu — możesz wpisać gole ręcznie.'
        : `Zwiadowca nie zdobył faktów — ${powody.join(' · ')}. Spróbuj później albo wpisz gole ręcznie.`);
}

/** Dopisek do zwiadu przez Gemini: bez niego model potrafi odpowiedzieć z pamięci, nie szukając (= brak źródeł). */
export const SZUKAJ_W_GOOGLE = '\n\nNAJPIERW użyj wyszukiwarki Google (relacje meczu: strona ligi, klubu, BBC, ESPN, Flashscore itp.) — nie odpowiadaj z pamięci. W polu "zrodla" podaj adresy stron, z których wziąłeś fakty.';

/**
 * Odpowiedź Gemini z narzędziem google_search → tekst i źródła. Źródła: strony z groundingu (`groundingChunks`); gdy
 * Google ich nie podał, a wyszukiwanie SIĘ ODBYŁO (`webSearchQueries`), bierzemy adresy http(s) z pola "zrodla" JSON-u
 * modelu. Bez wyszukiwania — żadnych źródeł (odpowiedź z pamięci nie jest faktem). `szukal` mówi, czy model szukał.
 */
export function odpowiedzGeminiZwiadu(d) {
    const k = d?.candidates?.[0];
    const tekst = (k?.content?.parts ?? []).filter((x) => x.text && !x.thought).map((x) => x.text).join('');
    const meta = k?.groundingMetadata ?? {};
    const zGroundingu = (meta.groundingChunks ?? []).map((c) => c?.web?.uri || c?.web?.title).filter(Boolean);
    const zapytania = (meta.webSearchQueries ?? []).filter(Boolean);
    const szukal = zGroundingu.length > 0 || zapytania.length > 0 || !!meta.searchEntryPoint;
    let zrodla = zGroundingu;
    let zJsona = false;
    if (!zrodla.length && szukal) {
        const s = tekst.replace(/```(?:json)?/gi, '');
        const a = s.indexOf('{'), b = s.lastIndexOf('}');
        try { zrodla = (JSON.parse(s.slice(a, b + 1))?.zrodla ?? []).map(String).filter((u) => /^https?:\/\/[^\s]+\.[a-z]{2,}/i.test(u)).slice(0, 8); zJsona = zrodla.length > 0; } catch { zrodla = []; }
    }
    return { tekst, zrodla, szukal, zapytania, zJsona, powodKonca: k?.finishReason ?? null };
}

/**
 * ⏱️ Oś zdarzeń TheSportsDB (`lookuptimeline.php`, darmowa) → gole: minuta, strzelec, asysta, drużyna, karny, samobój.
 * Bez modelu i bez wyszukiwarki — dane źródła, z którego bierzemy też wynik. Liczą się tylko wpisy „Goal” (nie VAR,
 * nie kartki, nie niewykorzystany karny). Gol samobójczy: drużyna z osi bywa drużyną strzelca, a my liczymy beneficjenta —
 * rozstrzyga zgodność z wynikiem. Zwraca gole albo null, gdy osi brak; kompletność sprawdza `sprawdzGole`.
 */
export function goleZOsi(timeline, mecz) {
    if (!Array.isArray(timeline)) return null;
    const czyste = (x) => (x && x !== 'NULL' && x !== '0' ? String(x).trim() : null);
    const wpisy = timeline.filter((t) => t?.strTimeline === 'Goal' && !/miss/i.test(t?.strTimelineDetail ?? ''));
    const gole = wpisy.map((t) => {
        const samobojczy = /own/i.test(t.strTimelineDetail ?? '');
        const zDomu = t.strHome === 'Yes' || (t.strHome !== 'No' && t.strTeam === mecz.gospodarze);
        return {
            minuta: String(t.intTime ?? '').replace(/[^\d+]/g, '').slice(0, 6), strzelec: czyste(t.strPlayer)?.slice(0, 60) ?? '',
            druzyna: zDomu ? 'gospodarze' : 'goscie', asysta: czyste(t.strAssist)?.slice(0, 60) ?? null, opis: null,
            samobojczy, karny: /penalty/i.test(t.strTimelineDetail ?? ''),
        };
    }).sort((a, b) => Number(a.minuta.split('+')[0]) - Number(b.minuta.split('+')[0]));
    if (!gole.length) return gole;
    // samobój: gdy oś podała drużynę strzelca, odwrócenie samobójów zgra liczby z wynikiem — tylko wtedy odwracamy
    if (gole.some((g) => g.samobojczy) && sprawdzGole(gole, mecz.wynik)) {
        const odwr = gole.map((g) => (g.samobojczy ? { ...g, druzyna: g.druzyna === 'gospodarze' ? 'goscie' : 'gospodarze' } : g));
        if (!sprawdzGole(odwr, mecz.wynik)) return odwr;
    }
    return gole;
}

// ─── Scenariusz ──────────────────────────────────────────────────────────────────────────────────────

export function promptScenariusza({ mecz, mecze = null, gole, narrator, wspolprowadzacy = null, wspol = null, jezyk = 'en', pamiec = null }) {
    const komp = Array.isArray(mecze) && mecze.length > 1;
    const N = NARRATORZY[narrator];
    const en = jezyk === 'en';
    const W = wspolprowadzacyOdcinka({ narrator, wspolprowadzacy, wspol }).map((k) => NARRATORZY[k]);
    const im = (x) => (en ? x.imieEn : x.imie);
    const kogo = W.map((x) => `${im(x)} — ${en ? 'temperament' : 'temperament'}: ${en ? x.temperamentEn : x.temperament}`).join(en ? '; ' : '; ');
    // przydział goli: gol i → współprowadzący i mod ich liczby (ten sam co ktoMowi)
    const przydzial = W.map((x, j) => `${im(x)}: ${gole.map((_, i) => i).filter((i) => i % W.length === j).map((i) => i + 1).join(', ') || '—'}`).join('; ');
    const duet = !W.length ? '' : en
        ? `\nYou host TOGETHER with ${kogo}. Lines INTRO, PRZED n and OUTRO are spoken by ${N.imieEn}; lines OKRZYK n and PO n are spoken by ${W.length === 1 ? im(W[0]) : `the co-host assigned to goal n (goals → ${przydzial})`} — write each line in the voice of its speaker; they may react to each other briefly.`
        : `\nProwadzicie razem: ${N.imie} i ${kogo}. Linie INTRO, PRZED n i OUTRO mówi ${N.imie}; linie OKRZYK n i PO n mówi ${W.length === 1 ? im(W[0]) : `współprowadzący przypisany do gola n (gole → ${przydzial})`} — każdą linię pisz głosem jej mówcy; mogą krótko na siebie reagować.`;
    const znani = pamiec?.zawodnicy ? gole.map((g) => g.strzelec).filter((s, i, a) => a.indexOf(s) === i && pamiec.zawodnicy[s]).map((s) => `${s}: już ${pamiec.zawodnicy[s].gole} gol(e) w naszych odcinkach, ostatnio ${pamiec.zawodnicy[s].ostatnio}`) : [];
    const poprawki = (pamiec?.poprawki ?? []).slice(-4).map((p) => `— było: „${p.bylo}” → Suweren poprawił: „${p.jest}”`);
    const system = `${en ? `You are ${N.imieEn}` : `Jesteś ${N.imie}`} — TeOgochi, narrator programu „${NAZWA}” Katedry OtakOS. Temperament: ${en ? N.temperamentEn : N.temperament}.${duet}
${en ? 'Write in English.' : 'Piszesz po polsku.'} Opowiadasz bramki z PODANYCH FAKTÓW — nie wymyślasz statystyk, transferów, wieku ani historii zawodników; gdy czegoś nie wiesz, mówisz o samej akcji i emocji. Bez obrażania kogokolwiek.
${znani.length ? `Twoja pamięć z poprzednich odcinków (możesz nawiązać): ${znani.join('; ')}.\n` : ''}${poprawki.length ? `Tak Suweren poprawiał Twoje teksty — ucz się z tego stylu:\n${poprawki.join('\n')}\n` : ''}${pamiec?.odcinkow ? `To Twój ${pamiec.odcinkow + 1}. odcinek — możesz być już swobodniejsza i bogatsza w komentarzu niż na początku.\n` : ''}
Format odpowiedzi — DOKŁADNIE te linie, każda w jednej linii:
INTRO: (1–2 zdania powitania i zapowiedź ${komp ? `kompilacji ${mecze.length} meczów` : 'meczu'})
${komp ? `${mecze.map((_, k) => `MECZ ${k + 1}: (1–2 zdania zapowiedzi meczu ${k + 1} — drużyny, wynik, stawka z faktów)`).join('\n')}\n` : ''}${gole.map((_, i) => `PRZED ${i + 1}: (1–2 zdania o strzelcu — z faktów)\nOKRZYK ${i + 1}: (2–6 słów okrzyku w chwili gola)\nPO ${i + 1}: (1–2 zdania o samej bramce — z opisu akcji)\nSCENA ${i + 1}: (po ANGIELSKU, 1 zdanie: co widać w kluczowej chwili akcji — pozycja, ruch, piłka)`).join('\n')}
OUTRO: (1–2 zdania podsumowania ${komp ? 'wszystkich meczów' : ''} i pożegnania)${komp ? '\nNumeracja bramek (PRZED n…) jest wspólna dla całej kompilacji — tak jak w liście faktów.' : ''}`;
    const mG = (g) => (komp ? mecze[Number(g.mecz) || 0] : mecz);
    const user = komp
        ? `Kompilacja ${mecze.length} meczów:\n${mecze.map((m, k) => `MECZ ${k + 1}: ${m.gospodarze} – ${m.goscie} ${m.wynik[0]}:${m.wynik[1]}${m.liga ? ` (${m.liga})` : ''}${m.data ? `, ${m.data}` : ''}${gole.some((g) => (Number(g.mecz) || 0) === k) ? '' : ' — bez bramek'}`).join('\n')}
Bramki (fakty, numeracja wspólna):
${gole.map((g, i) => `${i + 1}. [mecz ${(Number(g.mecz) || 0) + 1}] ${g.minuta}' ${g.strzelec} (${g.druzyna === 'gospodarze' ? mG(g).gospodarze : mG(g).goscie})${g.asysta ? `, asysta: ${g.asysta}` : ''}${g.karny ? ', rzut karny' : ''}${g.samobojczy ? ', gol samobójczy' : ''}${g.opis ? ` — ${g.opis}` : ''}`).join('\n')}`
        : `Mecz: ${mecz.gospodarze} – ${mecz.goscie} ${mecz.wynik[0]}:${mecz.wynik[1]}${mecz.liga ? ` (${mecz.liga})` : ''}${mecz.data ? `, ${mecz.data}` : ''}.
Bramki (fakty):
${gole.map((g, i) => `${i + 1}. ${g.minuta}' ${g.strzelec} (${g.druzyna === 'gospodarze' ? mecz.gospodarze : mecz.goscie})${g.asysta ? `, asysta: ${g.asysta}` : ''}${g.karny ? ', rzut karny' : ''}${g.samobojczy ? ', gol samobójczy' : ''}${g.opis ? ` — ${g.opis}` : ''}`).join('\n')}`;
    return { system, user };
}

/** Odpowiedź narratora → scenariusz; brak którejkolwiek linii = null (bez łatania zgadywaniem). */
export function odczytajScenariusz(tekst, ileGoli, ileMeczow = 0) {
    const t = String(tekst ?? '').replace(/\*\*/g, '');
    const linia = (klucz) => { const m = new RegExp(`^\\s*${klucz}\\s*:\\s*(.+)$`, 'im').exec(t); return m ? m[1].trim() : null; };
    const intro = linia('INTRO'), outro = linia('OUTRO');
    if (!intro || !outro) return null;
    const gole = [];
    for (let i = 1; i <= ileGoli; i++) {
        const g = { przed: linia(`PRZED ${i}`), okrzyk: linia(`OKRZYK ${i}`), po: linia(`PO ${i}`), scena: linia(`SCENA ${i}`) };
        if (Object.values(g).some((x) => !x)) return null;
        gole.push(g);
    }
    if (ileMeczow > 1) {
        const mecze = [];
        for (let k = 1; k <= ileMeczow; k++) { const m = linia(`MECZ ${k}`); if (!m) return null; mecze.push(m); }
        return { intro, mecze, gole, outro };
    }
    return { intro, gole, outro };
}

/** Prompty FLUX — stworki TeOgochi w barwach drużyn, temperament narratora w kresce, bez prawdziwych twarzy i herbów. */
export function promptyObrazow({ mecz, mecze = null, gole, scenariusz, narrator, wspolprowadzacy = null, wspol = null }) {
    const N = NARRATORZY[narrator];
    const W = wspolprowadzacyOdcinka({ narrator, wspolprowadzacy, wspol }).map((k) => NARRATORZY[k]);
    const mG = (g) => (Array.isArray(mecze) && mecze.length > 1 ? mecze[Number(g.mecz) || 0] : mecz);
    const druzyna = (g) => (g.druzyna === 'gospodarze' ? mG(g).gospodarze : mG(g).goscie);
    return {
        intro: `${N.wyglad}${W.length ? `, together with ${W.map((x) => x.wyglad).join(' and ')}` : ''}, standing in a cozy football TV studio with a pitch view behind, waving hello, ${N.kreska}, 16:9, ${KLATKA_BEZ_PRAW}`,
        gole: gole.map((g, i) => ({
            karta: `portrait card of a cute TeOgochi creature footballer in the kit colors of ${druzyna(g)}, confident pose, stadium lights bokeh, ${N.kreska}, 16:9, ${KLATKA_BEZ_PRAW}`,
            scena: `a football goal moment drawn as a cartoon with TeOgochi creature players: ${scenariusz.gole[i].scena}; the scoring player wears the kit colors of ${druzyna(g)}, ball in motion, crowd in the background, ${N.kreska}, cinematic 16:9, ${KLATKA_BEZ_PRAW}`,
        })),
        wynik: `${N.wyglad}, celebrating at a scoreboard in a stadium at night, confetti, ${N.kreska}, 16:9, ${KLATKA_BEZ_PRAW}`,
    };
}

export function kontekstKronikarza(s, { studio = false } = {}) {
    const en = s.jezyk === 'en';
    const sklad = skladOdcinka(s).map((k) => NARRATORZY[k]);
    const wielu = sklad.length > 1;
    const kto = `TeOgochi ${sklad.map((x) => `${en ? x.imieEn : x.imie} (${en ? x.temperamentEn : x.temperament})`).join(' and ')}`;
    const gdzie = studio ? ` Hosted in the 3D studio "Zebrra Football" — the ${wielu ? 'hosts are original animated TeOgochi characters' : 'host is an original animated TeOgochi character'}; the LED screens show the match facts with our own team monogram badges, not club crests.` : '';
    return `Program „${NAZWA}” Katedry OtakOS — ${kto} draw${wielu ? '' : 's'} and narrate${wielu ? '' : 's'} the goals of ${czyKompilacja(s) ? `${opisMeczu(s, true)} (one compilation episode)` : `${s.mecz.gospodarze} – ${s.mecz.goscie} ${s.mecz.wynik[0]}:${s.mecz.wynik[1]}${s.mecz.liga ? ` (${s.mecz.liga})` : ''}${s.mecz.data ? `, ${s.mecz.data}` : ''}`}. Scorers: ${s.gole.map((g) => `${g.strzelec} ${g.minuta}'`).join(', ')}. All visuals are original AI illustrations (no match footage).${gdzie} ${en ? 'Write the title, description and tags in English.' : 'Tytuł, opis i tagi po polsku.'}`;
}

export function nazwaPublikacji(s, studio = false) {
    const kto = skladOdcinka(s).map((k) => NARRATORZY[k]?.imie ?? k).join(' & ');
    const co = czyKompilacja(s) ? `${s.jezyk === 'en' ? `${s.mecze.length} matches` : ileMeczow(s.mecze.length)}: ${s.mecze.map((m) => `${m.gospodarze} ${m.wynik[0]}:${m.wynik[1]} ${m.goscie}`).join(' · ')}` : `${s.mecz.gospodarze} ${s.mecz.wynik[0]}:${s.mecz.wynik[1]} ${s.mecz.goscie}`;
    return `${NAZWA} — ${co} · ${kto}${studio ? ' · Studio Zebrra Football' : ''}`;
}

// ─── Serwis ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ katalog: string, katalogMontazy: (projekt: string) => Promise<string>, fetch?: Function,
 *   zwiad?: (prompt: string) => Promise<{ tekst: string, zrodla: string[] }>, chat?: (model: string|null, system: string, user: string) => Promise<{ tekst: string }>,
 *   modelDla?: (id: string) => Promise<string|null>, rysuj?: (o: { prompt: string, prefiks: string }) => Promise<string>,
 *   mow?: (o: { tekst: string, narrator: string, jezyk: string }) => Promise<{ audio: Buffer, ext: string }>, opisz?: (p: string) => Promise<{ sekundy: number|null }>,
 *   publikuj?: Function, ffmpeg?: string, szyna?: any, teraz?: () => number }} o
 */
export function utworzGolDnia(o) {
    const cfg = { ffmpeg: 'ffmpeg', fetch: (...a) => globalThis.fetch(...a), teraz: () => Date.now(), modelDla: async () => null, opisz: async () => ({ sekundy: null }), ...o };
    const KAT = path.join(cfg.katalog, 'gol-dnia');
    const plikO = (id) => { if (!ID.test(String(id))) throw new Error('Złe id odcinka Gol Dnia.'); return path.join(KAT, id, 'odcinek.json'); };
    const plikPamieci = (n) => path.join(KAT, `pamiec-${n}.json`);
    const plikU = path.join(KAT, 'ustawienia.json');
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: NARRATORZY.pilkarka.imie, rodzaj: 'praca', tresc: `⚽ ${tresc}` })?.catch?.(() => {});
    const wRobocie = new Set();
    let kolejka = Promise.resolve();

    // Windows: rename na plik, który ktoś właśnie czyta (panel, Studio), daje EPERM/EBUSY — chwila i jeszcze raz
    const pisz = async (s) => {
        const p = plikO(s.id);
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(`${p}.tmp`, JSON.stringify(s, null, 1), 'utf8');
        for (let proba = 0; ; proba++) {
            try { await fs.rename(`${p}.tmp`, p); return; } catch (e) { if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || proba >= 8) throw e; await new Promise((r) => setTimeout(r, 25 * (proba + 1))); }
        }
    };
    const czytajJson = async (p, dom) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return dom; } };

    async function ustawienia() { const u = await czytajJson(plikU, {}); return { jezyk: JEZYKI[u.jezyk] ? u.jezyk : 'en', narrator: NARRATORZY[u.narrator] ? u.narrator : 'pilkarka', liga: LIGI[u.liga] ? Number(u.liga) : 4328 }; }
    async function ustaw(z = {}) {
        const u = await ustawienia();
        if (z.jezyk !== undefined) { if (!JEZYKI[z.jezyk]) throw new Error('Język: en albo pl.'); u.jezyk = z.jezyk; }
        if (z.narrator !== undefined) { if (!NARRATORZY[z.narrator]) throw new Error(`Narrator: ${Object.keys(NARRATORZY).join(', ')}.`); u.narrator = z.narrator; }
        if (z.liga !== undefined) { if (!LIGI[z.liga]) throw new Error('Nieznana liga.'); u.liga = Number(z.liga); }
        await fs.mkdir(KAT, { recursive: true }); await fs.writeFile(plikU, JSON.stringify(u, null, 1), 'utf8');
        return u;
    }

    /**
     * Zakończone mecze ligi (TheSportsDB). Darmowy klucz oddaje tylko 1 „ostatni” mecz i po 5 meczów na kolejkę —
     * więc bierzemy ostatni + jego kolejkę + dwie poprzednie (≤ 16). Pełna lista: TheSportsDB Premium (`OTAKOS_THESPORTSDB_KLUCZ`).
     */
    async function mecze(liga) {
        const id = Number(liga) || (await ustawienia()).liga;
        if (!LIGI[id]) throw new Error('Nieznana liga.');
        const klucz = process.env.OTAKOS_THESPORTSDB_KLUCZ || '3';
        const pobierz = async (u) => { const r = await cfg.fetch(`https://www.thesportsdb.com/api/v1/json/${klucz}/${u}`, { signal: AbortSignal.timeout(20_000) }); if (!r.ok) throw new Error(`TheSportsDB HTTP ${r.status}`); return (await r.json()).events ?? []; };
        const ostatnie = await pobierz(`eventspastleague.php?id=${id}`);
        const wszystkie = [...ostatnie];
        const runda = Number(ostatnie[0]?.intRound), sezon = ostatnie[0]?.strSeason;
        if (runda > 0 && sezon) for (const rr of [runda, runda - 1, runda - 2].filter((x) => x > 0)) wszystkie.push(...await pobierz(`eventsround.php?id=${id}&r=${rr}&s=${encodeURIComponent(sezon)}`).catch(() => []));
        const unikalne = new Map();
        for (const e of wszystkie) { const m = meczZTheSportsDb(e); if (m) unikalne.set(m.id, m); }
        return [...unikalne.values()].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    }

    /** Fakty bramek z sieci (Zwiadowca) — przyjęte tylko, gdy zgadzają się z wynikiem i mają źródła. */
    /** ⏱️ Fakty z osi zdarzeń TheSportsDB — pierwsze źródło (bez modelu); niepełna oś = powód, wtedy zwiad w sieci. */
    async function faktyZOsi(mecz) {
        if (!/^\d+$/.test(String(mecz.id ?? ''))) return { powod: 'mecz spoza TheSportsDB' };
        const klucz = process.env.OTAKOS_THESPORTSDB_KLUCZ || '3';
        try {
            const r = await cfg.fetch(`https://www.thesportsdb.com/api/v1/json/${klucz}/lookuptimeline.php?id=${encodeURIComponent(mecz.id)}`, { signal: AbortSignal.timeout(20_000) });
            if (!r.ok) return { powod: `HTTP ${r.status}` };
            const gole = goleZOsi((await r.json())?.timeline, mecz);
            if (!gole) return { powod: 'brak osi zdarzeń' };
            const zly = sprawdzGole(gole, mecz.wynik);
            if (zly) return { powod: `oś niepełna (${zly}${klucz === '3' ? '; darmowy klucz oddaje najwyżej 5 zdarzeń meczu' : ''})` };
            return { gole, zrodla: [`https://www.thesportsdb.com/event/${mecz.id}`], dostawca: 'TheSportsDB (oś zdarzeń)' };
        } catch (e) { return { powod: String(e.message || e).slice(0, 120) }; }
    }

    async function zbierzFakty(mecz) {
        if (mecz.wynik[0] + mecz.wynik[1] === 0) return { gole: [], zrodla: [], zwiad: 'bezbramkowy' };
        const os = await faktyZOsi(mecz);
        if (os.gole) return { gole: os.gole, zrodla: os.zrodla, dostawca: os.dostawca, pominieci: [] };
        const zOsi = `TheSportsDB: ${os.powod}`;
        if (!cfg.zwiad) throw new Error(`${zOsi}. Zwiadowca nie ma klucza wyszukiwania (Claude albo Gemini w Kiblu) — wpisz gole ręcznie.`);
        // każda odpowiedź sprawdzana od razu — zła u jednego dostawcy = pyta następnego (most: zwiadPoKolei)
        const sprawdz = (z) => {
            const gole = odczytajGole(z.tekst);
            if (!gole) throw new Error('nie oddał listy goli (JSON)');
            if (!z.zrodla?.length) throw new Error('nie podał źródeł — bez nich faktów nie przyjmuję');
            const zly = sprawdzGole(gole, mecz.wynik);
            if (zly) throw new Error(zly);
            return { gole };
        };
        let z;
        try { z = await cfg.zwiad(promptZwiadu(mecz), sprawdz); } catch (e) { throw new Error(`${zOsi} · ${e.message}`); }
        const w = z.gole ? z : sprawdz(z);   // zwiad bez obsługi `sprawdz` (np. atrapa) — sprawdzenie tutaj
        return { gole: w.gole, zrodla: z.zrodla.slice(0, 8), dostawca: z.dostawca ?? null, pominieci: [zOsi, ...(z.pominieci ?? [])] };
    }

    async function wczytaj(id) {
        let s;
        try { s = JSON.parse(await fs.readFile(plikO(id), 'utf8')); } catch (e) { if (e.code === 'ENOENT') throw new Error('Nie ma takiego odcinka Gol Dnia.'); throw e; }
        if ((s.stan === 'robi' || s.stan === 'w_kolejce') && !wRobocie.has(id)) {
            for (const e of ETAPY) if (s.etapy[e]?.stan === 'robi') s.etapy[e] = { ...s.etapy[e], stan: 'blad', powod: 'Przerwane — most był restartowany. „↻ Ponów” liczy od tego etapu.' };
            Object.assign(s, { stan: 'blad', powod: 'Przerwane restartem mostu.' });
            await pisz(s).catch(() => {});
        }
        return s;
    }
    async function lista() {
        const out = [];
        for (const k of await fs.readdir(KAT).catch(() => [])) if (ID.test(k)) { try { out.push(await wczytaj(k)); } catch { /* uszkodzony */ } }
        return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    /**
     * Nowy odcinek: mecz + fakty (zebrane albo podane) + narrator. `zrodlo` = id odcinka, z którego brać fakty
     * (studio: ten sam mecz, inny narrator — bez drugiego zwiadu).
     */
    /** Mecz od Suwerena/z listy → oczyszczony (wynik liczbami, obie drużyny). */
    function oczyscMecz(mecz) {
        if (!mecz?.id || !Array.isArray(mecz.wynik) || mecz.wynik.some((x) => !Number.isInteger(Number(x)) || Number(x) < 0)) throw new Error('Wybierz mecz z listy (albo wpisz go z wynikiem).');
        if (!String(mecz.gospodarze ?? '').trim() || !String(mecz.goscie ?? '').trim()) throw new Error('Mecz potrzebuje obu drużyn.');
        return { id: String(mecz.id), liga: mecz.liga ?? null, data: mecz.data ?? null, gospodarze: mecz.gospodarze, goscie: mecz.goscie, wynik: mecz.wynik.map(Number), stadion: mecz.stadion ?? null,
            idGospodarzy: mecz.idGospodarzy ?? null, idGosci: mecz.idGosci ?? null, barwy: mecz.barwy ?? null };
    }
    /** Fakty jednego meczu: podane gole (sprawdzone wynikiem) albo zwiad. */
    async function faktyMeczu(mecz, gole) {
        if (gole) {
            const g = odczytajGole(JSON.stringify({ gole }));
            const zly = sprawdzGole(g, mecz.wynik);
            if (zly) throw new Error(`${mecz.gospodarze} – ${mecz.goscie}: ${zly}`);
            return { gole: g, zrodla: ['wpisane przez Suwerena'] };
        }
        return zbierzFakty(mecz);
    }

    async function utworz({ mecz, gole = null, kompilacja = null, narrator = null, wspolprowadzacy = null, wspol = null, wideo = null, jezyk = null, zrodlo = null, kanalId = null } = {}) {
        const u = await ustawienia();
        let fakty, mecze = null;
        if (zrodlo) {
            const z = await wczytaj(zrodlo);
            mecz = z.mecz; fakty = { gole: z.gole, zrodla: z.zrodla };
            if (czyKompilacja(z)) mecze = z.mecze;
            jezyk ??= z.jezyk; kanalId ??= z.kanalId; wideo ??= z.wideo;   // wersja innego narratora = ten sam program, ten sam język, kanał i wideo
        } else if (Array.isArray(kompilacja) && kompilacja.length > 1) {
            // ⚽⚽ kompilacja: każdy mecz z faktami osobno (zwiad albo wpisane), gole numerowane wspólnie z polem `mecz`
            if (kompilacja.length > MAX_MECZOW) throw new Error(`Kompilacja: najwyżej ${MAX_MECZOW} meczów.`);
            mecze = []; fakty = { gole: [], zrodla: [] };
            for (const [k, el] of kompilacja.entries()) {
                const m = oczyscMecz(el?.mecz);
                if (mecze.some((x) => x.id === m.id)) throw new Error(`Mecz ${m.gospodarze} – ${m.goscie} jest w kompilacji dwa razy.`);
                const f = await faktyMeczu(m, el?.gole ?? null);
                mecze.push(m);
                fakty.gole.push(...f.gole.map((g) => ({ ...g, mecz: k })));
                fakty.zrodla.push(...(f.zrodla ?? []).filter((z) => !fakty.zrodla.includes(z)));
            }
            mecz = mecze[0];
        } else {
            mecz = oczyscMecz(mecz);
            fakty = await faktyMeczu(mecz, gole);
        }
        if (!fakty.gole.length) throw new Error(mecze ? 'Wszystkie mecze kompilacji są bezbramkowe — nie ma czego opowiadać.' : 'Mecz bezbramkowy — nie ma czego opowiadać w Golu Dnia.');
        const n = narrator && NARRATORZY[narrator] ? narrator : u.narrator;
        const wsp = Array.isArray(wspolprowadzacy) ? wspolprowadzacy.filter(Boolean) : wspol ? [wspol] : [];
        if (wsp.length > MAX_WSPOL) throw new Error(`Najwyżej ${MAX_WSPOL} współprowadzących.`);
        if (wsp.some((k, i) => !NARRATORZY[k] || k === n || wsp.indexOf(k) !== i)) throw new Error('Współprowadzący muszą być innymi narratorami z listy (każdy raz, nie prowadzący).');
        if (wideo && !WIDEO[wideo]) throw new Error(`Wideo: ${Object.keys(WIDEO).join(' albo ')}.`);
        const s = {
            wersja: 1, id: `g-${crypto.randomBytes(4).toString('hex')}`, stan: 'w_kolejce', powod: null,
            mecz: { id: mecz.id, liga: mecz.liga ?? null, data: mecz.data ?? null, gospodarze: mecz.gospodarze, goscie: mecz.goscie, wynik: mecz.wynik, stadion: mecz.stadion ?? null,
                idGospodarzy: mecz.idGospodarzy ?? null, idGosci: mecz.idGosci ?? null, barwy: mecz.barwy ?? null },
            ...(mecze ? { mecze } : {}),
            gole: fakty.gole, zrodla: fakty.zrodla, narrator: n, wspolprowadzacy: wsp, wideo: wideo || 'napisy', studio: null, jezyk: jezyk && JEZYKI[jezyk] ? jezyk : u.jezyk,
            etapy: Object.fromEntries(ETAPY.map((e) => [e, { stan: 'czeka' }])), scenariusz: null, obrazy: null, uwagi: [], plik: null, publikacja: null,
            kanalId: kanalId ? String(kanalId) : null, zrodlo: zrodlo ?? null, utworzono: czas(),
        };
        await pisz(s);
        zakolejkuj(s.id);
        nadaj(`odcinek ${opisMeczu(s)} (${skladOdcinka(s).map((k) => NARRATORZY[k].imie).join(', ')}) w kolejce`);
        return s;
    }

    function zakolejkuj(id) {
        wRobocie.add(id);
        kolejka = kolejka.then(() => przebieg(id)).catch(() => {}).finally(() => wRobocie.delete(id));
    }

    async function ffmpeg(args, cwd) {
        await new Promise((ok, zle) => execFile(cfg.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { cwd, windowsHide: true, timeout: 15 * 60_000, maxBuffer: 16 * 1024 * 1024 },
            (e, _o, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').slice(-3).join(' | ').slice(0, 400)}`)) : ok())));
    }

    /** Pamięć narratora: strzelcy z odcinków, liczba odcinków, ostatnie poprawki Suwerena. */
    const pamiec = (n) => czytajJson(plikPamieci(n), { odcinkow: 0, zawodnicy: {}, poprawki: [] });
    async function zapamietaj(s) {
        for (const n of skladOdcinka(s)) await zapamietajNarratora(s, n);
    }
    async function zapamietajNarratora(s, narrator) {
        const p = await pamiec(narrator);
        p.odcinkow = (p.odcinkow ?? 0) + 1;
        for (const g of s.gole) {
            const z = (p.zawodnicy[g.strzelec] ??= { gole: 0, ostatnio: null });
            z.gole++; z.ostatnio = `${meczGola(s, g).gospodarze} – ${meczGola(s, g).goscie}, ${g.minuta}'`;
        }
        await fs.mkdir(KAT, { recursive: true });
        await fs.writeFile(plikPamieci(narrator), JSON.stringify(p, null, 1), 'utf8');
    }

    /**
     * 🎬 Oprawa kompilacji: klocki „Klocki Football” (Start → film → End, język z nazwy pliku jak w Game Show) przez
     * Spawacza. Brak katalogu albo klocków = film bez oprawy i uwaga wprost (nic nie udajemy). Pojedynczy mecz = bez oprawy.
     */
    async function oprawa(s, we, cel) {
        if (!czyKompilacja(s)) { await fs.copyFile(we, cel); return; }
        let z = null;
        try { z = cfg.klocki ? await cfg.klocki() : null; } catch { z = null; }
        const start = klockiWJezyku(z?.start ?? [], s.jezyk), end = klockiWJezyku(z?.end ?? [], s.jezyk);
        if (!cfg.spawaj || (!start.length && !end.length)) {
            s.uwagi = [...new Set([...(s.uwagi ?? []), `oprawa kompilacji: brak klocków w ${z?.katalog ?? '_OtakOs_Klocki/Klocki Football'} (Start/, End/) — film bez intro i end`])].slice(0, 12);
            await fs.copyFile(we, cel); return;
        }
        await cfg.spawaj({ klipy: [...start, we, ...end], wyjscie: cel, celWedlug: start.length });
        s.oprawa = { start: start.map((f) => path.basename(f)), end: end.map((f) => path.basename(f)) };
    }

    /** Barwy obu drużyn (TheSportsDB po id drużyny, tylko przy zgodnej nazwie; inaczej z nazwy) — zapisane w meczu. */
    async function barwyMeczu(m) {
        if (m.barwy?.gospodarze && m.barwy?.goscie) return m.barwy;
        const klucz = process.env.OTAKOS_THESPORTSDB_KLUCZ || '3';
        const druzyna = async (idD, nazwa) => {
            if (idD) {
                try {
                    const r = await cfg.fetch(`https://www.thesportsdb.com/api/v1/json/${klucz}/lookupteam.php?id=${encodeURIComponent(idD)}`, { signal: AbortSignal.timeout(15_000) });
                    const c = r.ok ? barwyZDruzyny((await r.json())?.teams?.[0], nazwa) : null;
                    if (c) return { barwy: c, zrodlo: 'thesportsdb' };
                } catch { /* sieć — barwy z nazwy */ }
            }
            return { barwy: barwyZNazwy(nazwa), zrodlo: 'nazwa' };
        };
        const g = await druzyna(m.idGospodarzy, m.gospodarze), d = await druzyna(m.idGosci, m.goscie);
        m.barwy = { gospodarze: g.barwy, goscie: d.barwy, zrodlo: { gospodarze: g.zrodlo, goscie: d.zrodlo } };
        return m.barwy;
    }
    /** Barwy meczu odcinka (pierwszego) i — w kompilacji — każdego meczu; liczone raz, zapisane w odcinku. */
    async function barwy(id) {
        const s = await wczytaj(id);
        const lista = meczeOdcinka(s);
        let nowe = false;
        for (const m of lista) if (!(m.barwy?.gospodarze && m.barwy?.goscie)) { await barwyMeczu(m); nowe = true; }
        if (czyKompilacja(s)) s.mecz.barwy = s.mecze[0].barwy;
        if (nowe && !wRobocie.has(id)) await pisz(s);
        return s.mecz.barwy;
    }

    /** 🎥 Głos kwestii dla Studia (Głosy Stada pod id mówcy) — liczony raz, potem z pracy odcinka. */
    async function glos(id, nr) {
        const s = await wczytaj(id);
        const k = kwestieOdcinka(s).find((x) => x.nr === Number(nr));
        if (!k) throw new Error('Nie ma takiej kwestii.');
        const praca = path.join(KAT, id, 'praca');
        const skrot = crypto.createHash('sha1').update(`${k.kto}|${s.jezyk}|${k.tekst}`).digest('hex').slice(0, 12);
        for (const ext of ['wav', 'mp3']) { const p = path.join(praca, `studio-${skrot}.${ext}`); if (fsSync.existsSync(p)) return { plik: p, kto: k.kto }; }
        if (!cfg.mow) throw new Error('Katedra nie ma silnika głosu — Studio pokaże kwestię napisem.');
        const g = await cfg.mow({ tekst: k.tekst, narrator: k.kto, jezyk: s.jezyk });
        await fs.mkdir(praca, { recursive: true });
        const p = path.join(praca, `studio-${skrot}.${g.ext === 'mp3' ? 'mp3' : 'wav'}`);
        await fs.writeFile(p, g.audio);
        return { plik: p, kto: k.kto };
    }

    /**
     * 🎥 Nagranie ze Studia Zebrra Football (webm/mp4 z MediaRecorder) → mp4 w Montażowni. Odcinek `wideo: studio` →
     * to jest jego film i idzie dalej zwykłą drogą (publikacja → ✓ w Izbie). Odcinek z napisami → wersja studyjna OBOK,
     * z własną publikacją.
     */
    async function nagranieStudia(id, bufor, { typ = 'video/webm', prowadzacy = null } = {}) {
        const s = await wczytaj(id);
        if (wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi — nagraj, gdy skończy.');
        if (!s.scenariusz) throw new Error('Odcinek nie ma jeszcze scenariusza.');
        if (!Buffer.isBuffer(bufor) || bufor.length < 10_000) throw new Error('Nagranie jest puste albo za krótkie.');
        const praca = path.join(KAT, id, 'praca');
        await fs.mkdir(praca, { recursive: true });
        const we = `studio-surowe.${/mp4/.test(typ) ? 'mp4' : 'webm'}`;
        await fs.writeFile(path.join(praca, we), bufor);
        await ffmpeg(['-y', '-i', we, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', 'studio.mp4'], praca);
        const kat = await cfg.katalogMontazy(PROJEKT);
        await fs.mkdir(kat, { recursive: true });
        const kto = (Array.isArray(prowadzacy) && prowadzacy.length ? prowadzacy : skladOdcinka(s)).filter((x) => NARRATORZY[x]).slice(0, 1 + MAX_WSPOL);
        const cel = path.join(kat, `gol_${nazwaPlikuMeczu(s)}_studio_${kto.join('+')}_${s.jezyk}_${s.id.slice(2)}.mp4`);
        await oprawa(s, path.join(praca, 'studio.mp4'), cel);
        await fs.rm(path.join(praca, we), { force: true });
        s.studio = { plik: cel, prowadzacy: kto, sekundy: (await cfg.opisz(cel).catch(() => null))?.sekundy ?? null, kiedy: czas(), publikacja: null };
        if (s.wideo === 'studio') {
            s.plik = cel; s.publikacja = null;
            s.etapy.publikacja = { stan: 'czeka' };
            Object.assign(s, { stan: 'w_kolejce', powod: null });
            await pisz(s);
            await zapamietaj(s).catch(() => {});
            zakolejkuj(id);
        } else {
            if (cfg.publikuj) {
                const p = await cfg.publikuj({ plik: cel, nazwa: nazwaPublikacji(s, true), jezyk: s.jezyk, kontekst: kontekstKronikarza(s, { studio: true }), zrodlo: { projekt: PROJEKT, gol: s.id, studio: true }, kanalId: s.kanalId });
                s.studio.publikacja = { id: p.id ?? null, etap: p.etap ?? null };
            }
            await pisz(s);
        }
        nadaj(`nagranie Studia Zebrra Football: ${opisMeczu(s)} (${kto.map((k) => NARRATORZY[k].imie).join(' i ')}) w Montażowni`);
        return s;
    }

    async function przebieg(id) {
        const s = JSON.parse(await fs.readFile(plikO(id), 'utf8'));
        Object.assign(s, { stan: 'robi', powod: null });
        await pisz(s);
        const praca = path.join(KAT, id, 'praca');
        await fs.mkdir(praca, { recursive: true });
        const zrob = async (etap, fn) => {
            if (['gotowy', 'pominiety'].includes(s.etapy[etap]?.stan)) return true;
            s.etapy[etap] = { stan: 'robi', od: czas() };
            await pisz(s);
            try { s.etapy[etap] = { ...(await fn()), stan: 'gotowy', od: s.etapy[etap].od, do: czas() }; await pisz(s); return true; }
            catch (e) { s.etapy[etap] = { stan: 'blad', powod: String(e.message || e).slice(0, 500), od: s.etapy[etap].od, do: czas() }; Object.assign(s, { stan: 'blad', powod: `${etap}: ${s.etapy[etap].powod}` }); await pisz(s); return false; }
        };
        try {
            const czcionka = CZCIONKI.find((p) => fsSync.existsSync(p));
            if (!czcionka) throw new Error('Nie znalazłem czcionki z polskimi znakami.');
            await fs.copyFile(czcionka, path.join(praca, 'czcionka.ttf'));
            const N = NARRATORZY[s.narrator];

            if (!await zrob('scenariusz', async () => {
                if (s.scenariusz) return { zrodlo: 'Suweren' };   // poprawiony ręcznie — zostaje
                if (!cfg.chat) throw new Error('Katedra nie ma modelu do pisania.');
                const { system, user } = promptScenariusza({ mecz: s.mecz, mecze: czyKompilacja(s) ? s.mecze : null, gole: s.gole, narrator: s.narrator, wspolprowadzacy: wspolprowadzacyOdcinka(s), jezyk: s.jezyk, pamiec: await pamiec(s.narrator) });
                const model = await cfg.modelDla('pilkarka').catch(() => null);
                let ost = '';
                for (let proba = 0; proba < 2; proba++) {
                    const odp = await cfg.chat(model, system, proba ? `${user}\n\nPOPRZEDNIA ODPOWIEDŹ NIE MIAŁA WSZYSTKICH LINII FORMATU — napisz KAŻDĄ linię (INTRO, ${czyKompilacja(s) ? 'MECZ dla każdego meczu, ' : ''}PRZED/OKRZYK/PO/SCENA dla każdego gola, OUTRO).` : user);
                    ost = odp?.tekst ?? '';
                    const sc = odczytajScenariusz(ost, s.gole.length, czyKompilacja(s) ? s.mecze.length : 0);
                    if (sc) { s.scenariusz = sc; return { model }; }
                }
                throw new Error(`narrator nie trzymał formatu: ${ost.slice(0, 200)}`);
            })) return;

            if (!await zrob('obrazy', async () => {
                if (!cfg.rysuj) throw new Error('Katedra nie ma silnika obrazu (FLUX w ComfyUI).');
                const P = promptyObrazow({ mecz: s.mecz, mecze: czyKompilacja(s) ? s.mecze : null, gole: s.gole, scenariusz: s.scenariusz, narrator: s.narrator, wspolprowadzacy: wspolprowadzacyOdcinka(s) });
                const kopiuj = async (src, nazwa) => { await fs.copyFile(src, path.join(praca, nazwa)); return nazwa; };
                const ob = { intro: await kopiuj(await cfg.rysuj({ prompt: P.intro, prefiks: 'katedra/gol-dnia/intro' }), 'intro.png'), gole: [], wynik: null };
                for (const [i, g] of P.gole.entries()) {
                    ob.gole.push({
                        karta: await kopiuj(await cfg.rysuj({ prompt: g.karta, prefiks: 'katedra/gol-dnia/karta' }), `karta-${i + 1}.png`),
                        scena: await kopiuj(await cfg.rysuj({ prompt: g.scena, prefiks: 'katedra/gol-dnia/scena' }), `scena-${i + 1}.png`),
                    });
                }
                ob.wynik = await kopiuj(await cfg.rysuj({ prompt: P.wynik, prefiks: 'katedra/gol-dnia/wynik' }), 'wynik.png');
                s.obrazy = ob;
                return { obrazow: 2 + 2 * ob.gole.length };
            })) return;

            // 🎥 Studio Zebrra Football: kadry i głos nagrywa apka 3D — most czeka na nagranie (POST /api/gol-dnia/:id/studio)
            if (s.wideo === 'studio' && !s.studio?.plik) {
                for (const e of ['segmenty', 'sklejenie']) if (s.etapy[e]?.stan !== 'gotowy') s.etapy[e] = { stan: 'pominiety', powod: 'wideo nagrywa Studio Zebrra Football' };
                Object.assign(s, { stan: 'studio', powod: null });
                await pisz(s);
                nadaj(`odcinek ${opisMeczu(s)} czeka na nagranie w Studiu Zebrra Football`);
                return;
            }

            if (!await zrob('segmenty', async () => {
                const segmenty = [];
                const segment = async (k) => {
                    const { nr, obraz, naglowek, tekst, kto } = k;
                    let audio = null, dl = czasBezGlosu(tekst);
                    if (cfg.mow) {
                        try {
                            const g = await cfg.mow({ tekst, narrator: kto, jezyk: s.jezyk }).catch(() => cfg.mow({ tekst, narrator: kto, jezyk: s.jezyk }));
                            audio = `a-${nr}.${g.ext || 'wav'}`;
                            await fs.writeFile(path.join(praca, audio), g.audio);
                            const sek = (await cfg.opisz(path.join(praca, audio)).catch(() => null))?.sekundy;
                            if (sek) dl = Math.max(2.5, Math.round((sek + 0.6) * 100) / 100);
                        } catch (e) { s.uwagi = [...new Set([...s.uwagi, `głos narratora: ${String(e.message).slice(0, 160)} — segment z napisami, bez głosu`])].slice(0, 12); }
                    }
                    await fs.writeFile(path.join(praca, `n-${nr}.txt`), naglowek, 'utf8');
                    const pliki = [];
                    for (const [j, l] of zawin(tekst, 58).slice(0, 4).entries()) { const n = `l-${nr}-${j}.txt`; await fs.writeFile(path.join(praca, n), l, 'utf8'); pliki.push(n); }
                    const wyj = `seg-${String(nr).padStart(3, '0')}.mp4`;
                    await ffmpeg(argumentyKwestii({ obraz, klip: null, kolor: kto === s.narrator ? KOLOR : (NARRATORZY[kto]?.kolor ?? KOLOR), imiePlik: `n-${nr}.txt`, liniePliki: pliki, czcionka: 'czcionka.ttf', czas: dl, audio, wyjscie: wyj }), praca);
                    segmenty.push(wyj);
                };
                for (const k of kwestieOdcinka(s)) await segment(k);
                s.segmenty = segmenty;
                return { segmentow: segmenty.length };
            })) return;

            if (!await zrob('sklejenie', async () => {
                await fs.writeFile(path.join(praca, 'lista.txt'), s.segmenty.map((x) => `file '${x}'`).join('\n'), 'utf8');
                await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', '-movflags', '+faststart', 'odcinek.mp4'], praca);
                const kat = await cfg.katalogMontazy(PROJEKT);
                await fs.mkdir(kat, { recursive: true });
                const cel = path.join(kat, `gol_${nazwaPlikuMeczu(s)}_${skladOdcinka(s).join('+')}_${s.jezyk}_${s.id.slice(2)}.mp4`);
                await oprawa(s, path.join(praca, 'odcinek.mp4'), cel);
                s.plik = cel;
                await zapamietaj(s).catch(() => {});
                return { sekundy: (await cfg.opisz(cel).catch(() => null))?.sekundy ?? null };
            })) return;

            if (!await zrob('publikacja', async () => {
                if (!cfg.publikuj) return { pominieto: 'publikacje YouTube niepodłączone' };
                const zeStudia = !!s.studio?.plik && s.plik === s.studio.plik;
                const p = await cfg.publikuj({ plik: s.plik, nazwa: nazwaPublikacji(s, zeStudia), jezyk: s.jezyk, kontekst: kontekstKronikarza(s, { studio: zeStudia }), zrodlo: { projekt: PROJEKT, gol: s.id, ...(zeStudia ? { studio: true } : {}) }, kanalId: s.kanalId });
                s.publikacja = { id: p.id ?? null, etap: p.etap ?? null };
                return { publikacja: p.id ?? null };
            })) return;

            Object.assign(s, { stan: 'gotowy', powod: null });
            await pisz(s);
            nadaj(`odcinek ${opisMeczu(s)} (${skladOdcinka(s).map((k) => NARRATORZY[k].imie).join(', ')}) gotowy — czeka na ✓ w Izbie`);
        } catch (e) {
            Object.assign(s, { stan: 'blad', powod: String(e.message || e).slice(0, 400) });
            await pisz(s).catch(() => {});
        }
    }

    return {
        ustawienia, ustaw, mecze, zbierzFakty, utworz, wczytaj, lista,
        /** Studio: ten sam mecz i fakty, inny narrator (bez drugiego zwiadu). */
        wersja: (id, narrator, { wspolprowadzacy = null, wideo = null } = {}) => utworz({ zrodlo: id, narrator, wspolprowadzacy, wideo }),
        /** ↻ od pierwszego niegotowego etapu (albo od wskazanego). */
        async ponow(id, { od = null } = {}) {
            const s = await wczytaj(id);
            if (wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.');
            if (od && ETAPY.includes(od)) for (const e of ETAPY.slice(ETAPY.indexOf(od))) s.etapy[e] = { stan: 'czeka' };
            if (od === 'scenariusz') s.scenariusz = null;
            Object.assign(s, { stan: 'w_kolejce', powod: null });
            await pisz(s); zakolejkuj(id);
            return s;
        },
        /** ✎ Poprawka scenariusza przez Suwerena → nauka narratora (pamięć poprawek) i przeróbka od obrazów. */
        async popraw(id, scenariusz) {
            const s = await wczytaj(id);
            if (wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.');
            const nowy = odczytajScenariusz([`INTRO: ${scenariusz?.intro ?? ''}`, ...(scenariusz?.mecze ?? []).map((m, k) => `MECZ ${k + 1}: ${m}`), ...(scenariusz?.gole ?? []).flatMap((g, i) => [`PRZED ${i + 1}: ${g.przed}`, `OKRZYK ${i + 1}: ${g.okrzyk}`, `PO ${i + 1}: ${g.po}`, `SCENA ${i + 1}: ${g.scena}`]), `OUTRO: ${scenariusz?.outro ?? ''}`].join('\n'), s.gole.length, czyKompilacja(s) ? s.mecze.length : 0);
            if (!nowy) throw new Error(`Scenariusz musi mieć intro, outro${czyKompilacja(s) ? ', zapowiedź każdego meczu' : ''} i dla każdego gola: przed, okrzyk, po, scenę.`);
            // poprawka trafia do pamięci TEGO, kto mówi tę linię (w duecie okrzyk i „po” mówi drugi prowadzący)
            const stare = s.scenariusz;
            const pamieci = new Map();
            if (stare) for (const [k, a, b, gol] of [['intro', stare.intro, nowy.intro, 0], ['outro', stare.outro, nowy.outro, 0], ...nowy.gole.flatMap((g, i) => ['przed', 'po'].map((x) => [x, stare.gole[i]?.[x], g[x], i]))]) {
                if (!a || !b || a === b) continue;
                const kto = ktoMowi(k, s, gol);
                if (!pamieci.has(kto)) pamieci.set(kto, await pamiec(kto));
                const p = pamieci.get(kto);
                p.poprawki = [...(p.poprawki ?? []), { co: k, bylo: a.slice(0, 200), jest: b.slice(0, 200) }].slice(-20);
            }
            await fs.mkdir(KAT, { recursive: true });
            for (const [kto, p] of pamieci) await fs.writeFile(plikPamieci(kto), JSON.stringify(p, null, 1), 'utf8');
            const scenaZmieniona = !stare || nowy.gole.some((g, i) => g.scena !== stare.gole[i]?.scena);
            s.scenariusz = nowy;
            for (const e of ETAPY.slice(ETAPY.indexOf(scenaZmieniona ? 'obrazy' : 'segmenty'))) s.etapy[e] = { stan: 'czeka' };
            s.etapy.scenariusz = { stan: 'gotowy', zrodlo: 'Suweren', do: czas() };
            if (scenaZmieniona) s.obrazy = null;
            Object.assign(s, { stan: 'w_kolejce', powod: null, plik: null, publikacja: null, studio: null });   // stare nagranie studia nie pasuje do nowego tekstu
            await pisz(s); zakolejkuj(id);
            return s;
        },
        barwy, glos, nagranieStudia,
        async usun(id) { if (wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.'); await fs.rm(path.dirname(plikO(id)), { recursive: true, force: true }); return true; },
        sciezkaObrazu(id, plik) { if (!/^[\w-]+\.png$/.test(String(plik))) return null; const p = path.join(KAT, id, 'praca', plik); return ID.test(id) && fsSync.existsSync(p) ? p : null; },
        pamiec,
    };
}

export function zamontujTrasyGolDnia(app, G, { kanalProjektu = null, ustawKanalProjektu = null, raw = null, maxNagraniaMb = 600 } = {}) {
    const odp = (res, p, kod = 400) => p.then((w) => res.json({ success: true, ...w })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    app.get('/api/gol-dnia', (_req, res) => odp(res, (async () => ({
        odcinki: await G.lista(), ustawienia: await G.ustawienia(), ligi: LIGI, jezyki: JEZYKI,
        narratorzy: Object.fromEntries(Object.entries(NARRATORZY).map(([k, v]) => [k, { imie: v.imie, imieEn: v.imieEn, emoji: v.emoji, temperament: v.temperament, rola: v.rola ?? 'stado', kolor: v.kolor ?? null }])),
        wideo: WIDEO, maxWspol: MAX_WSPOL, maxMeczow: MAX_MECZOW,
        kanal: kanalProjektu ? await kanalProjektu(PROJEKT).catch(() => null) : null,
    }))(), 500));
    app.get('/api/gol-dnia/mecze', (req, res) => odp(res, G.mecze(req.query.liga).then((mecze) => ({ mecze })), 502));
    app.post('/api/gol-dnia/fakty', (req, res) => odp(res, G.zbierzFakty(req.body?.mecz ?? {})));
    app.post('/api/gol-dnia', (req, res) => odp(res, G.utworz(req.body ?? {}).then((odcinek) => ({ odcinek }))));
    app.put('/api/gol-dnia/ustawienia', (req, res) => odp(res, G.ustaw(req.body ?? {}).then((ustawienia) => ({ ustawienia }))));
    if (ustawKanalProjektu) app.put('/api/gol-dnia/kanal', (req, res) => odp(res, ustawKanalProjektu(PROJEKT, req.body?.kanalId || null).then((kanal) => ({ kanal }))));
    app.get('/api/gol-dnia/:id', (req, res) => odp(res, G.wczytaj(req.params.id).then((odcinek) => ({ odcinek })), 404));
    app.get('/api/gol-dnia/:id/wideo', async (req, res) => { try { const s = await G.wczytaj(req.params.id); const plik = req.query.studio ? s.studio?.plik : s.plik; return plik && fsSync.existsSync(plik) ? res.sendFile(plik) : res.status(404).end(); } catch { return res.status(404).end(); } });
    app.get('/api/gol-dnia/:id/obraz/:plik', (req, res) => { const p = G.sciezkaObrazu(req.params.id, req.params.plik); return p ? res.sendFile(p) : res.status(404).end(); });
    app.post('/api/gol-dnia/:id/wersja', (req, res) => odp(res, G.wersja(req.params.id, req.body?.narrator, { wspolprowadzacy: Array.isArray(req.body?.wspolprowadzacy) ? req.body.wspolprowadzacy : req.body?.wspol ? [req.body.wspol] : null, wideo: req.body?.wideo ?? null }).then((odcinek) => ({ odcinek }))));
    // 🎥 Studio Zebrra Football (apka _OtakOs_Apki/studio-zebrra): odcinek z kwestiami i barwami, głos kwestii, nagranie
    app.get('/api/gol-dnia/:id/studio', (req, res) => odp(res, (async () => {
        const barwy = await G.barwy(req.params.id);
        const o = await G.wczytaj(req.params.id);
        const mecze = meczeOdcinka(o);
        return { odcinek: o, kwestie: kwestieOdcinka(o), barwy, monogramy: { gospodarze: monogram(o.mecz.gospodarze), goscie: monogram(o.mecz.goscie) },
            mecze: mecze.map((m) => ({ ...m, monogramy: { gospodarze: monogram(m.gospodarze), goscie: monogram(m.goscie) } })) };
    })(), 404));
    app.get('/api/gol-dnia/:id/glos/:nr', (req, res) => G.glos(req.params.id, req.params.nr)
        .then(({ plik, kto }) => { res.set('X-Glos-Kto', kto); res.sendFile(plik); })
        .catch((e) => res.status(502).json({ success: false, message: e.message })));
    if (raw) app.post('/api/gol-dnia/:id/studio', raw({ type: ['video/*', 'application/octet-stream'], limit: `${maxNagraniaMb}mb` }), (req, res) => {
        const prowadzacy = String(req.query.prowadzacy ?? '').split(',').filter(Boolean);
        return odp(res, G.nagranieStudia(req.params.id, req.body, { typ: String(req.get('content-type') || ''), prowadzacy }).then((odcinek) => ({ odcinek })));
    });
    app.post('/api/gol-dnia/:id/ponow', (req, res) => odp(res, G.ponow(req.params.id, { od: req.body?.od ?? null }).then((odcinek) => ({ odcinek }))));
    app.put('/api/gol-dnia/:id/scenariusz', (req, res) => odp(res, G.popraw(req.params.id, req.body?.scenariusz).then((odcinek) => ({ odcinek }))));
    app.delete('/api/gol-dnia/:id', (req, res) => odp(res, G.usun(req.params.id).then((usuniety) => ({ usuniety }))));
}

export default { utworzGolDnia, zamontujTrasyGolDnia, NARRATORZY, PROWADZACY, WIDEO, LIGI, sprawdzGole, odczytajGole, odczytajScenariusz, promptScenariusza, promptyObrazow, kwestieOdcinka, zwiadPoKolei, goleZOsi, odpowiedzGeminiZwiadu, czyKompilacja, meczeOdcinka, MAX_MECZOW, ktoMowi, wspolprowadzacyOdcinka, skladOdcinka, MAX_WSPOL, monogram, barwyZNazwy, barwyZDruzyny };
