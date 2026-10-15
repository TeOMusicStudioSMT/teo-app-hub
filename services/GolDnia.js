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
};

const KLATKA_BEZ_PRAW = 'no real people, no real faces, no club crests, no logos, no brand names, no text, no watermark';

// ─── Fakty ───────────────────────────────────────────────────────────────────────────────────────────

/** Mecz z TheSportsDB → nasz kształt (tylko zakończone, z wynikiem). */
export function meczZTheSportsDb(e) {
    const g = Number(e?.intHomeScore), d = Number(e?.intAwayScore);
    if (!e?.idEvent || !Number.isInteger(g) || !Number.isInteger(d) || e.intHomeScore === null || e.intAwayScore === null) return null;
    return { id: String(e.idEvent), liga: e.strLeague ?? null, data: e.dateEvent ?? null, gospodarze: String(e.strHomeTeam ?? ''), goscie: String(e.strAwayTeam ?? ''), wynik: [g, d], stadion: e.strVenue ?? null };
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
Odpowiedz WYŁĄCZNIE JSON-em: {"gole":[{"minuta":"23","strzelec":"…","druzyna":"gospodarze|goscie","asysta":"… albo null","opis":"…","samobojczy":false,"karny":false}]}
Goli ma być dokładnie ${mecz.wynik[0] + mecz.wynik[1]} (${mecz.wynik[0]} gospodarzy, ${mecz.wynik[1]} gości).`;
}

// ─── Scenariusz ──────────────────────────────────────────────────────────────────────────────────────

export function promptScenariusza({ mecz, gole, narrator, jezyk = 'en', pamiec = null }) {
    const N = NARRATORZY[narrator];
    const en = jezyk === 'en';
    const znani = pamiec?.zawodnicy ? gole.map((g) => g.strzelec).filter((s, i, a) => a.indexOf(s) === i && pamiec.zawodnicy[s]).map((s) => `${s}: już ${pamiec.zawodnicy[s].gole} gol(e) w naszych odcinkach, ostatnio ${pamiec.zawodnicy[s].ostatnio}`) : [];
    const poprawki = (pamiec?.poprawki ?? []).slice(-4).map((p) => `— było: „${p.bylo}” → Suweren poprawił: „${p.jest}”`);
    const system = `${en ? `You are ${N.imieEn}` : `Jesteś ${N.imie}`} — TeOgochi, narrator programu „${NAZWA}” Katedry OtakOS. Temperament: ${en ? N.temperamentEn : N.temperament}.
${en ? 'Write in English.' : 'Piszesz po polsku.'} Opowiadasz bramki z PODANYCH FAKTÓW — nie wymyślasz statystyk, transferów, wieku ani historii zawodników; gdy czegoś nie wiesz, mówisz o samej akcji i emocji. Bez obrażania kogokolwiek.
${znani.length ? `Twoja pamięć z poprzednich odcinków (możesz nawiązać): ${znani.join('; ')}.\n` : ''}${poprawki.length ? `Tak Suweren poprawiał Twoje teksty — ucz się z tego stylu:\n${poprawki.join('\n')}\n` : ''}${pamiec?.odcinkow ? `To Twój ${pamiec.odcinkow + 1}. odcinek — możesz być już swobodniejsza i bogatsza w komentarzu niż na początku.\n` : ''}
Format odpowiedzi — DOKŁADNIE te linie, każda w jednej linii:
INTRO: (1–2 zdania powitania i zapowiedź meczu)
${gole.map((_, i) => `PRZED ${i + 1}: (1–2 zdania o strzelcu — z faktów)\nOKRZYK ${i + 1}: (2–6 słów okrzyku w chwili gola)\nPO ${i + 1}: (1–2 zdania o samej bramce — z opisu akcji)\nSCENA ${i + 1}: (po ANGIELSKU, 1 zdanie: co widać w kluczowej chwili akcji — pozycja, ruch, piłka)`).join('\n')}
OUTRO: (1–2 zdania podsumowania i pożegnania)`;
    const user = `Mecz: ${mecz.gospodarze} – ${mecz.goscie} ${mecz.wynik[0]}:${mecz.wynik[1]}${mecz.liga ? ` (${mecz.liga})` : ''}${mecz.data ? `, ${mecz.data}` : ''}.
Bramki (fakty):
${gole.map((g, i) => `${i + 1}. ${g.minuta}' ${g.strzelec} (${g.druzyna === 'gospodarze' ? mecz.gospodarze : mecz.goscie})${g.asysta ? `, asysta: ${g.asysta}` : ''}${g.karny ? ', rzut karny' : ''}${g.samobojczy ? ', gol samobójczy' : ''}${g.opis ? ` — ${g.opis}` : ''}`).join('\n')}`;
    return { system, user };
}

/** Odpowiedź narratora → scenariusz; brak którejkolwiek linii = null (bez łatania zgadywaniem). */
export function odczytajScenariusz(tekst, ileGoli) {
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
    return { intro, gole, outro };
}

/** Prompty FLUX — stworki TeOgochi w barwach drużyn, temperament narratora w kresce, bez prawdziwych twarzy i herbów. */
export function promptyObrazow({ mecz, gole, scenariusz, narrator }) {
    const N = NARRATORZY[narrator];
    const druzyna = (g) => (g.druzyna === 'gospodarze' ? mecz.gospodarze : mecz.goscie);
    return {
        intro: `${N.wyglad}, standing in a cozy football TV studio with a pitch view behind, waving hello, ${N.kreska}, 16:9, ${KLATKA_BEZ_PRAW}`,
        gole: gole.map((g, i) => ({
            karta: `portrait card of a cute TeOgochi creature footballer in the kit colors of ${druzyna(g)}, confident pose, stadium lights bokeh, ${N.kreska}, 16:9, ${KLATKA_BEZ_PRAW}`,
            scena: `a football goal moment drawn as a cartoon with TeOgochi creature players: ${scenariusz.gole[i].scena}; the scoring player wears the kit colors of ${druzyna(g)}, ball in motion, crowd in the background, ${N.kreska}, cinematic 16:9, ${KLATKA_BEZ_PRAW}`,
        })),
        wynik: `${N.wyglad}, celebrating at a scoreboard in a stadium at night, confetti, ${N.kreska}, 16:9, ${KLATKA_BEZ_PRAW}`,
    };
}

export function kontekstKronikarza(s) {
    const N = NARRATORZY[s.narrator];
    const en = s.jezyk === 'en';
    return `${en ? 'Program' : 'Program'} „${NAZWA}” Katedry OtakOS — TeOgochi ${en ? N.imieEn : N.imie} (${en ? N.temperamentEn : N.temperament}) draws and narrates the goals of ${s.mecz.gospodarze} – ${s.mecz.goscie} ${s.mecz.wynik[0]}:${s.mecz.wynik[1]}${s.mecz.liga ? ` (${s.mecz.liga})` : ''}${s.mecz.data ? `, ${s.mecz.data}` : ''}. Scorers: ${s.gole.map((g) => `${g.strzelec} ${g.minuta}'`).join(', ')}. All visuals are original AI illustrations (no match footage). ${en ? 'Write the title, description and tags in English.' : 'Tytuł, opis i tagi po polsku.'}`;
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

    const pisz = async (s) => { const p = plikO(s.id); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(`${p}.tmp`, JSON.stringify(s, null, 1), 'utf8'); await fs.rename(`${p}.tmp`, p); };
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
    async function zbierzFakty(mecz) {
        if (!cfg.zwiad) throw new Error('Zwiadowca nie ma klucza wyszukiwania (Claude albo Gemini w Kiblu) — wpisz gole ręcznie.');
        if (mecz.wynik[0] + mecz.wynik[1] === 0) return { gole: [], zrodla: [], zwiad: 'bezbramkowy' };
        const z = await cfg.zwiad(promptZwiadu(mecz));
        const gole = odczytajGole(z.tekst);
        if (!gole) throw new Error('Zwiadowca nie oddał listy goli (JSON) — spróbuj ponownie albo wpisz gole ręcznie.');
        if (!z.zrodla?.length) throw new Error('Zwiadowca nie podał źródeł — bez nich faktów nie przyjmuję.');
        const zly = sprawdzGole(gole, mecz.wynik);
        if (zly) throw new Error(`Zwiadowca: ${zly} — popraw ręcznie albo spróbuj ponownie.`);
        return { gole, zrodla: z.zrodla.slice(0, 8) };
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
    async function utworz({ mecz, gole = null, narrator = null, jezyk = null, zrodlo = null, kanalId = null } = {}) {
        const u = await ustawienia();
        let fakty;
        if (zrodlo) {
            const z = await wczytaj(zrodlo);
            mecz = z.mecz; fakty = { gole: z.gole, zrodla: z.zrodla };
            jezyk ??= z.jezyk; kanalId ??= z.kanalId;   // wersja innego narratora = ten sam program, ten sam język i kanał
        } else {
            if (!mecz?.id || !Array.isArray(mecz.wynik) || mecz.wynik.some((x) => !Number.isInteger(Number(x)) || Number(x) < 0)) throw new Error('Wybierz mecz z listy (albo wpisz go z wynikiem).');
            if (!String(mecz.gospodarze ?? '').trim() || !String(mecz.goscie ?? '').trim()) throw new Error('Mecz potrzebuje obu drużyn.');
            mecz = { ...mecz, wynik: mecz.wynik.map(Number) };
            if (gole) {
                const g = odczytajGole(JSON.stringify({ gole }));
                const zly = sprawdzGole(g, mecz.wynik);
                if (zly) throw new Error(zly);
                fakty = { gole: g, zrodla: ['wpisane przez Suwerena'] };
            } else fakty = await zbierzFakty(mecz);
        }
        if (!fakty.gole.length) throw new Error('Mecz bezbramkowy — nie ma czego opowiadać w Golu Dnia.');
        const n = narrator && NARRATORZY[narrator] ? narrator : u.narrator;
        const s = {
            wersja: 1, id: `g-${crypto.randomBytes(4).toString('hex')}`, stan: 'w_kolejce', powod: null,
            mecz: { id: mecz.id, liga: mecz.liga ?? null, data: mecz.data ?? null, gospodarze: mecz.gospodarze, goscie: mecz.goscie, wynik: mecz.wynik, stadion: mecz.stadion ?? null },
            gole: fakty.gole, zrodla: fakty.zrodla, narrator: n, jezyk: jezyk && JEZYKI[jezyk] ? jezyk : u.jezyk,
            etapy: Object.fromEntries(ETAPY.map((e) => [e, { stan: 'czeka' }])), scenariusz: null, obrazy: null, uwagi: [], plik: null, publikacja: null,
            kanalId: kanalId ? String(kanalId) : null, zrodlo: zrodlo ?? null, utworzono: czas(),
        };
        await pisz(s);
        zakolejkuj(s.id);
        nadaj(`odcinek ${s.mecz.gospodarze} – ${s.mecz.goscie} (${NARRATORZY[n].imie}) w kolejce`);
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
        const p = await pamiec(s.narrator);
        p.odcinkow = (p.odcinkow ?? 0) + 1;
        for (const g of s.gole) {
            const z = (p.zawodnicy[g.strzelec] ??= { gole: 0, ostatnio: null });
            z.gole++; z.ostatnio = `${s.mecz.gospodarze} – ${s.mecz.goscie}, ${g.minuta}'`;
        }
        await fs.mkdir(KAT, { recursive: true });
        await fs.writeFile(plikPamieci(s.narrator), JSON.stringify(p, null, 1), 'utf8');
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
            const en = s.jezyk === 'en';

            if (!await zrob('scenariusz', async () => {
                if (s.scenariusz) return { zrodlo: 'Suweren' };   // poprawiony ręcznie — zostaje
                if (!cfg.chat) throw new Error('Katedra nie ma modelu do pisania.');
                const { system, user } = promptScenariusza({ mecz: s.mecz, gole: s.gole, narrator: s.narrator, jezyk: s.jezyk, pamiec: await pamiec(s.narrator) });
                const model = await cfg.modelDla('pilkarka').catch(() => null);
                let ost = '';
                for (let proba = 0; proba < 2; proba++) {
                    const odp = await cfg.chat(model, system, proba ? `${user}\n\nPOPRZEDNIA ODPOWIEDŹ NIE MIAŁA WSZYSTKICH LINII FORMATU — napisz KAŻDĄ linię (INTRO, PRZED/OKRZYK/PO/SCENA dla każdego gola, OUTRO).` : user);
                    ost = odp?.tekst ?? '';
                    const sc = odczytajScenariusz(ost, s.gole.length);
                    if (sc) { s.scenariusz = sc; return { model }; }
                }
                throw new Error(`narrator nie trzymał formatu: ${ost.slice(0, 200)}`);
            })) return;

            if (!await zrob('obrazy', async () => {
                if (!cfg.rysuj) throw new Error('Katedra nie ma silnika obrazu (FLUX w ComfyUI).');
                const P = promptyObrazow({ mecz: s.mecz, gole: s.gole, scenariusz: s.scenariusz, narrator: s.narrator });
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

            if (!await zrob('segmenty', async () => {
                const segmenty = [];
                const segment = async (nr, { obraz, naglowek, tekst, mowa = true }) => {
                    let audio = null, dl = czasBezGlosu(tekst);
                    if (mowa && cfg.mow) {
                        try {
                            const g = await cfg.mow({ tekst, narrator: s.narrator, jezyk: s.jezyk }).catch(() => cfg.mow({ tekst, narrator: s.narrator, jezyk: s.jezyk }));
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
                    await ffmpeg(argumentyKwestii({ obraz, klip: null, kolor: KOLOR, imiePlik: `n-${nr}.txt`, liniePliki: pliki, czcionka: 'czcionka.ttf', czas: dl, audio, wyjscie: wyj }), praca);
                    segmenty.push(wyj);
                };
                const imie = en ? N.imieEn : N.imie;
                let nr = 1;
                await segment(nr++, { obraz: s.obrazy.intro, naglowek: `${N.emoji} ${imie} · ${s.mecz.gospodarze} – ${s.mecz.goscie}`, tekst: s.scenariusz.intro });
                for (const [i, g] of s.gole.entries()) {
                    const sc = s.scenariusz.gole[i];
                    await segment(nr++, { obraz: s.obrazy.gole[i].karta, naglowek: `${g.minuta}' ${g.strzelec}`, tekst: sc.przed });
                    await segment(nr++, { obraz: s.obrazy.gole[i].scena, naglowek: `⚽ ${en ? 'GOAL' : 'GOL'}! ${g.minuta}'`, tekst: sc.okrzyk });
                    await segment(nr++, { obraz: s.obrazy.gole[i].scena, naglowek: `${g.strzelec}${g.asysta ? ` · ${en ? 'assist' : 'asysta'}: ${g.asysta}` : ''}`, tekst: sc.po });
                }
                await segment(nr++, { obraz: s.obrazy.wynik, naglowek: `${s.mecz.gospodarze} ${s.mecz.wynik[0]}:${s.mecz.wynik[1]} ${s.mecz.goscie}`, tekst: s.scenariusz.outro });
                s.segmenty = segmenty;
                return { segmentow: segmenty.length };
            })) return;

            if (!await zrob('sklejenie', async () => {
                await fs.writeFile(path.join(praca, 'lista.txt'), s.segmenty.map((x) => `file '${x}'`).join('\n'), 'utf8');
                await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', '-movflags', '+faststart', 'odcinek.mp4'], praca);
                const kat = await cfg.katalogMontazy(PROJEKT);
                await fs.mkdir(kat, { recursive: true });
                const bezp = (x) => String(x).normalize('NFKD').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
                const cel = path.join(kat, `gol_${bezp(s.mecz.gospodarze)}-${bezp(s.mecz.goscie)}_${s.narrator}_${s.jezyk}_${s.id.slice(2)}.mp4`);
                await fs.copyFile(path.join(praca, 'odcinek.mp4'), cel);
                s.plik = cel;
                await zapamietaj(s).catch(() => {});
                return { sekundy: (await cfg.opisz(cel).catch(() => null))?.sekundy ?? null };
            })) return;

            if (!await zrob('publikacja', async () => {
                if (!cfg.publikuj) return { pominieto: 'publikacje YouTube niepodłączone' };
                const p = await cfg.publikuj({ plik: s.plik, nazwa: `${NAZWA} — ${s.mecz.gospodarze} ${s.mecz.wynik[0]}:${s.mecz.wynik[1]} ${s.mecz.goscie} · ${N.imie}`, jezyk: s.jezyk, kontekst: kontekstKronikarza(s), zrodlo: { projekt: PROJEKT, gol: s.id }, kanalId: s.kanalId });
                s.publikacja = { id: p.id ?? null, etap: p.etap ?? null };
                return { publikacja: p.id ?? null };
            })) return;

            Object.assign(s, { stan: 'gotowy', powod: null });
            await pisz(s);
            nadaj(`odcinek ${s.mecz.gospodarze} – ${s.mecz.goscie} (${N.imie}) gotowy — czeka na ✓ w Izbie`);
        } catch (e) {
            Object.assign(s, { stan: 'blad', powod: String(e.message || e).slice(0, 400) });
            await pisz(s).catch(() => {});
        }
    }

    return {
        ustawienia, ustaw, mecze, zbierzFakty, utworz, wczytaj, lista,
        /** Studio: ten sam mecz i fakty, inny narrator (bez drugiego zwiadu). */
        wersja: (id, narrator) => utworz({ zrodlo: id, narrator }),
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
            const nowy = odczytajScenariusz([`INTRO: ${scenariusz?.intro ?? ''}`, ...(scenariusz?.gole ?? []).flatMap((g, i) => [`PRZED ${i + 1}: ${g.przed}`, `OKRZYK ${i + 1}: ${g.okrzyk}`, `PO ${i + 1}: ${g.po}`, `SCENA ${i + 1}: ${g.scena}`]), `OUTRO: ${scenariusz?.outro ?? ''}`].join('\n'), s.gole.length);
            if (!nowy) throw new Error('Scenariusz musi mieć intro, outro i dla każdego gola: przed, okrzyk, po, scenę.');
            const p = await pamiec(s.narrator);
            const stare = s.scenariusz;
            if (stare) for (const [k, a, b] of [['intro', stare.intro, nowy.intro], ['outro', stare.outro, nowy.outro], ...nowy.gole.flatMap((g, i) => ['przed', 'po'].map((x) => [x, stare.gole[i]?.[x], g[x]]))]) if (a && b && a !== b) p.poprawki = [...(p.poprawki ?? []), { co: k, bylo: a.slice(0, 200), jest: b.slice(0, 200) }].slice(-20);
            await fs.mkdir(KAT, { recursive: true });
            await fs.writeFile(plikPamieci(s.narrator), JSON.stringify(p, null, 1), 'utf8');
            const scenaZmieniona = !stare || nowy.gole.some((g, i) => g.scena !== stare.gole[i]?.scena);
            s.scenariusz = nowy;
            for (const e of ETAPY.slice(ETAPY.indexOf(scenaZmieniona ? 'obrazy' : 'segmenty'))) s.etapy[e] = { stan: 'czeka' };
            s.etapy.scenariusz = { stan: 'gotowy', zrodlo: 'Suweren', do: czas() };
            if (scenaZmieniona) s.obrazy = null;
            Object.assign(s, { stan: 'w_kolejce', powod: null, plik: null, publikacja: null });
            await pisz(s); zakolejkuj(id);
            return s;
        },
        async usun(id) { if (wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.'); await fs.rm(path.dirname(plikO(id)), { recursive: true, force: true }); return true; },
        sciezkaObrazu(id, plik) { if (!/^[\w-]+\.png$/.test(String(plik))) return null; const p = path.join(KAT, id, 'praca', plik); return ID.test(id) && fsSync.existsSync(p) ? p : null; },
        pamiec,
    };
}

export function zamontujTrasyGolDnia(app, G, { kanalProjektu = null, ustawKanalProjektu = null } = {}) {
    const odp = (res, p, kod = 400) => p.then((w) => res.json({ success: true, ...w })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    app.get('/api/gol-dnia', (_req, res) => odp(res, (async () => ({
        odcinki: await G.lista(), ustawienia: await G.ustawienia(), ligi: LIGI, jezyki: JEZYKI,
        narratorzy: Object.fromEntries(Object.entries(NARRATORZY).map(([k, v]) => [k, { imie: v.imie, emoji: v.emoji, temperament: v.temperament }])),
        kanal: kanalProjektu ? await kanalProjektu(PROJEKT).catch(() => null) : null,
    }))(), 500));
    app.get('/api/gol-dnia/mecze', (req, res) => odp(res, G.mecze(req.query.liga).then((mecze) => ({ mecze })), 502));
    app.post('/api/gol-dnia/fakty', (req, res) => odp(res, G.zbierzFakty(req.body?.mecz ?? {})));
    app.post('/api/gol-dnia', (req, res) => odp(res, G.utworz(req.body ?? {}).then((odcinek) => ({ odcinek }))));
    app.put('/api/gol-dnia/ustawienia', (req, res) => odp(res, G.ustaw(req.body ?? {}).then((ustawienia) => ({ ustawienia }))));
    if (ustawKanalProjektu) app.put('/api/gol-dnia/kanal', (req, res) => odp(res, ustawKanalProjektu(PROJEKT, req.body?.kanalId || null).then((kanal) => ({ kanal }))));
    app.get('/api/gol-dnia/:id', (req, res) => odp(res, G.wczytaj(req.params.id).then((odcinek) => ({ odcinek })), 404));
    app.get('/api/gol-dnia/:id/wideo', async (req, res) => { try { const s = await G.wczytaj(req.params.id); return s.plik && fsSync.existsSync(s.plik) ? res.sendFile(s.plik) : res.status(404).end(); } catch { return res.status(404).end(); } });
    app.get('/api/gol-dnia/:id/obraz/:plik', (req, res) => { const p = G.sciezkaObrazu(req.params.id, req.params.plik); return p ? res.sendFile(p) : res.status(404).end(); });
    app.post('/api/gol-dnia/:id/wersja', (req, res) => odp(res, G.wersja(req.params.id, req.body?.narrator).then((odcinek) => ({ odcinek }))));
    app.post('/api/gol-dnia/:id/ponow', (req, res) => odp(res, G.ponow(req.params.id, { od: req.body?.od ?? null }).then((odcinek) => ({ odcinek }))));
    app.put('/api/gol-dnia/:id/scenariusz', (req, res) => odp(res, G.popraw(req.params.id, req.body?.scenariusz).then((odcinek) => ({ odcinek }))));
    app.delete('/api/gol-dnia/:id', (req, res) => odp(res, G.usun(req.params.id).then((usuniety) => ({ usuniety }))));
}

export default { utworzGolDnia, zamontujTrasyGolDnia, NARRATORZY, LIGI, sprawdzGole, odczytajGole, odczytajScenariusz, promptScenariusza, promptyObrazow };
