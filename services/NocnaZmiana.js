/**
 * 🌙 NOCNA ZMIANA — Katedra pracuje, gdy Suweren nie pracuje.
 *
 * Suweren (2026-09-12) o prime-agent: „do zadań agentycznych lokalnej Katedry na
 * długie zadania… by się włączał, jak nic nie robię na kompie". Repo odpadło
 * (wymaga klucza API, bez Ollamy), pomysł został i tu jest — lokalnie.
 *
 * ⚠️ TRZY BRAMY, WSZYSTKIE MUSZĄ BYĆ OTWARTE, ŻEBY RUSZYĆ ZADANIE:
 *   1. BEZCZYNNOŚĆ — od ostatniego klawisza/ruchu myszy minęło ≥ PROG_BEZCZYNNOSCI
 *      (Windows: GetLastInputInfo przez PowerShell; bez zgadywania po CPU).
 *   2. KARTA WOLNA — ComfyUI nic nie liczy i VRAM ma miejsce. Render, który
 *      Suweren zostawił na noc, ma pierwszeństwo — Zmiana mu nie przeszkadza.
 *   3. RAM — wolnego ≥ MIN_RAM_GB. Noc 2026-09-11 nauczyła, co robi model
 *      wciśnięty w pełną pamięć.
 *   Zadanie już rozpoczęte KOŃCZY SIĘ nawet, gdy Suweren wróci — przerywanie
 *      renderu w połowie marnuje więcej niż dokończenie. Nowe nie startuje.
 *
 * ⚠️ ZADANIE = ODŁOŻONE WYWOŁANIE MOSTU, WYŁĄCZNIE Z BIAŁEJ LISTY. Kolejka to plik
 * na dysku, panel bywa wystawiony przez Kwantowy Tunel na telefon — gdyby przyjąć
 * dowolną ścieżkę, Zmiana byłaby zdalnym pilotem do całego mostu. Lista niżej
 * to zamknięty zbiór długich, bezpiecznych robót.
 *
 * ⚠️ NIC NIE DZIEJE SIĘ PO CICHU: każde uruchomienie i wynik idzie na Szynę
 * zdarzeń i do dziennika kolejki, z czasem i powodem. Rano widać, co zrobiono.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ⚠️ `??`, nie `||`: zero z env to legalna wartość (test), a `Number('0') || 600` daje 600.
const zEnv = (nazwa, domyslnie) => { const v = process.env[nazwa]; const n = v === undefined || v === '' ? NaN : Number(v); return Number.isFinite(n) ? n : domyslnie; };
export const PROG_BEZCZYNNOSCI_S = zEnv('OTAKOS_NOCNA_BEZCZYNNOSC_S', 10 * 60);
export const MIN_RAM_GB = zEnv('OTAKOS_NOCNA_MIN_RAM_GB', 8);
export const MIN_VRAM_MIB = zEnv('OTAKOS_NOCNA_MIN_VRAM_MIB', 2500);
export const CO_ILE_MS = 60_000;

/**
 * Biała lista robót. Klucz = `rodzaj` zadania; wartość opisuje, jak wywołać most.
 * `body` z zadania jest przepuszczany tylko przez `pola` — reszta wypada.
 */
/**
 * ⚠️ POLA Z WYBOREM (2026-09-12). Suweren: „wybór realizacji zadania musi mieć
 * wybór projektu z bazy danych, inaczej nie wie, co ma robić". Każde pole roboty
 * ma teraz opis: `wybor` mówi karcie, skąd wziąć listę (trasa mostu), `wymagane`
 * blokuje dodanie bez wskazania. Bez tego JSON „{"projekt": …}" w karcie był
 * loterią — a Produkcja bez projektu robiłaby to, co akurat ma w pamięci.
 *
 * Źródła list (`wybor`):
 *   projekt-story   /api/rezyser/projekty          nazwa projektu Story (serial)
 *   odcinek         /api/rezyser/pamiec?serial=    odcinek TEGO projektu (zależy od pola projekt/serial)
 *   rezyser         /api/rezyserzy                 styl reżysera
 *   silnik-obrazu   /api/silniki-obrazu            silnik obrazu do kadrów
 *   lab-apka        /api/lab/apki                  apka do piaskownicy
 *   lab-chip        /api/lab/chipy                 projekt chipu
 *   biznes          /api/latarnik/biznesy          pilnowany biznes
 *   opcje           lista wpisana tu, na miejscu
 */
export const POLA = {
    projekt:       { etykieta: 'projekt Story',   wybor: 'projekt-story' },
    serial:        { etykieta: 'serial Story',    wybor: 'projekt-story' },
    odcinekId:     { etykieta: 'odcinek',         wybor: 'odcinek', zalezyOd: ['projekt', 'serial'] },
    rezyser:       { etykieta: 'reżyser (styl)',  wybor: 'rezyser' },
    silnikObrazu:  { etykieta: 'silnik obrazu',   wybor: 'silnik-obrazu' },
    apka:          { etykieta: 'apka',            wybor: 'lab-apka' },
    biznes:        { etykieta: 'biznes',          wybor: 'biznes' },
    co:            { etykieta: 'co spisać',       wybor: 'opcje', opcje: ['oba', 'scenariusz', 'proza'] },
    sekundy:       { etykieta: 'sekund na kadr',  typ: 'liczba' },
    kroki:         { etykieta: 'kroki',           typ: 'liczba' },
    ileScen:       { etykieta: 'ile scen',        typ: 'liczba' },
    rundy:         { etykieta: 'rundy',           typ: 'liczba' },
    klatek:        { etykieta: 'klatek',          typ: 'liczba' },
    szerokosc:     { etykieta: 'szerokość',       typ: 'liczba' },
    wysokosc:      { etykieta: 'wysokość',        typ: 'liczba' },
    ziarno:        { etykieta: 'ziarno',          typ: 'liczba' },
    model:         { etykieta: 'model (Ollama)',  typ: 'tekst' },
    prompt:        { etykieta: 'prompt',          typ: 'tekst' },
    silnik:        { etykieta: 'silnik',          wybor: 'silnik-obrazu' },
    plik:          { etykieta: 'plik (ścieżka)',  typ: 'tekst' },
    tylko:         { etykieta: 'tylko stem',      typ: 'tekst' },
    nazwa:         { etykieta: 'nazwa kreacji',   typ: 'tekst' },
    pod:           { etykieta: 'pod (katalog)',   typ: 'tekst' },
    opis:          { etykieta: 'opis',            typ: 'tekst' },
    cel:           { etykieta: 'cel',             typ: 'tekst' },
    pytanieId:     { etykieta: 'pytanie (id)',    typ: 'tekst' },
    uczestnicy:    { etykieta: 'uczestnicy (id, po przecinku)', typ: 'lista' },
};

export const ROBOTY = {
    'mechanik':        { opis: 'Mechanik przerabia kolejkę łatek',              metoda: 'POST', sciezka: '/api/mechanic/process',       pola: [] },
    'skryba':          { opis: 'Skryba spisuje scenariusz i prozę z Opowieści', metoda: 'POST', sciezka: '/api/rekopis/z-opowiesci',    pola: ['projekt', 'co', 'ileScen', 'model'], wymagane: ['projekt'], czekajNa: 'skryba' },
    'graf-wiedzy':     { opis: 'Przeliczenie grafu wiedzy Katedry (AST)',       metoda: 'POST', sciezka: '/api/wiedza/buduj',           pola: [] },
    'stemy':           { opis: 'Rozdzielenie utworu na stemy (Demucs, CPU)',    metoda: 'POST', sciezka: '/api/stemy/rozdziel',         pola: ['plik', 'tylko'], wymagane: ['plik'] },
    'obraz':           { opis: 'Policzenie jednego obrazu wybranym silnikiem',  metoda: 'POST', sciezka: '/api/obraz/policz',           pola: ['prompt', 'silnik', 'szerokosc', 'wysokosc', 'kroki', 'ziarno'], wymagane: ['prompt'] },
    'obrot-kreacji':   { opis: 'Obrót kreacji (Wan, i2v)',                       metoda: 'POST', sciezka: '/api/moda/obrot',             pola: ['nazwa', 'pod', 'klatek', 'opis'], wymagane: ['nazwa'] },
    'latarnik':        { opis: 'Latarnik sprawdza spójność danych biznesu',      metoda: 'GET',  sciezka: '/api/latarnik/przeglad',      pola: ['biznes'] },
    // 🧪 TeO Lab: bez pól bierze pierwsze otwarte zlecenie (apka+plik+cel) i labuje je w piaskownicy — rano decyzja Suwerena.
    'lab-eksperyment': { opis: 'Lab: eksperyment w piaskownicy z kolejki zleceń', metoda: 'POST', sciezka: '/api/lab/eksperyment',         pola: ['apka', 'plik', 'cel', 'model'] },
    // 🔬 TeO Lab: TeOgochi badają otwarte pytanie projektu chipu (Arena z kontekstem → dziennik projektu).
    'lab-badanie':     { opis: 'Lab: TeOgochi badają otwarte pytanie projektu chipu', metoda: 'POST', sciezka: '/api/lab/badaj',              pola: ['projekt', 'pytanieId', 'uczestnicy', 'rundy', 'model'], polaInaczej: { projekt: { etykieta: 'projekt chipu', wybor: 'lab-chip' } }, czekajNa: 'sondaz' },
    // 🎬 Story (2026-09-12). Produkcja = kadry → ruch → montaż → plik w katalogu projektu/odcinka → GOTOWE (Klatka).
    // Tablica = każdy niezrealizowany odcinek po kolei, z osobna: Reżyser pisze kadry, potem produkcja, potem status.
    // Oba trwają godzinami — most oddaje `sondaz`, a Zmiana czeka, aż stan przestanie być „trwa".
    'produkcja':       { opis: 'Zrealizuj zaplanowaną Produkcję (Klatka): kadry → ruch → montaż → GOTOWE', metoda: 'POST', sciezka: '/api/produkcja/zrealizuj', pola: ['projekt', 'odcinekId', 'sekundy', 'silnikObrazu', 'rezyser', 'kroki'], wymagane: ['projekt'], czekajNa: 'sondaz' },
    'tablica-rezysera': { opis: 'Zrealizuj Tablicę Reżysera (Reżyser): odcinki po kolei, z osobna',        metoda: 'POST', sciezka: '/api/rezyser/tablica/zrealizuj', pola: ['serial', 'sekundy', 'silnikObrazu', 'rezyser', 'kroki', 'model'], wymagane: ['serial'], czekajNa: 'sondaz' },
};

let plikKolejki = null;
let mostBase = 'http://127.0.0.1:3001';
let szyna = null;
let comfyBase = 'http://127.0.0.1:8188';

/** Stan w pamięci — zwierciadło pliku, żeby /stan nie czytało dysku co sekundę. */
const stan = {
    wlaczona: false,
    bezczynnySek: null,
    bramy: { bezczynnosc: false, karta: false, ram: false },
    powody: [],
    trwa: null,           // { id, rodzaj, od }
    ostatnieSprawdzenie: null,
    ostatniWynik: null,
};

let tik = null;
let wTrakcie = false;

export function skonfiguruj({ katalogKatedry, portMostu, szynaZdarzen, comfy }) {
    plikKolejki = path.join(katalogKatedry, 'nocna-zmiana.json');
    mostBase = `http://127.0.0.1:${portMostu}`;
    szyna = szynaZdarzen;
    if (comfy) comfyBase = comfy;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLIK KOLEJKI (atomowo)
// ─────────────────────────────────────────────────────────────────────────────

async function wczytaj() {
    try {
        const j = JSON.parse(await fs.readFile(plikKolejki, 'utf8'));
        return { wlaczona: !!j.wlaczona, zadania: Array.isArray(j.zadania) ? j.zadania : [], dziennik: Array.isArray(j.dziennik) ? j.dziennik : [] };
    } catch {
        return { wlaczona: false, zadania: [], dziennik: [] };
    }
}

async function zapisz(d) {
    await fs.mkdir(path.dirname(plikKolejki), { recursive: true });
    const tmp = `${plikKolejki}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(d, null, 2), 'utf8');
    await fs.rename(tmp, plikKolejki);
}

const id = () => `nz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// ─────────────────────────────────────────────────────────────────────────────
// BRAMY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sekundy od ostatniego klawisza/myszy. Windows: GetLastInputInfo (user32).
 * Poza Windows: null — Zmiana nie zgaduje i nie rusza (bezczynność nieznana).
 */
export async function sekundyBezczynnosci() {
    if (process.platform !== 'win32') return null;
    const skrypt = [
        "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class Idle{[StructLayout(LayoutKind.Sequential)]struct LII{public uint cbSize;public uint dwTime;}[DllImport(\"user32.dll\")]static extern bool GetLastInputInfo(ref LII p);public static uint Sec(){var i=new LII();i.cbSize=(uint)Marshal.SizeOf(i);GetLastInputInfo(ref i);return ((uint)Environment.TickCount-i.dwTime)/1000;}}';",
        '[Idle]::Sec()',
    ].join(' ');
    try {
        const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', skrypt], { timeout: 15000, windowsHide: true });
        const n = Number(String(stdout).trim());
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}

async function kartaWolna() {
    const powody = [];
    try {
        const q = await fetch(`${comfyBase}/queue`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
        const biegnie = (q.queue_running ?? []).length;
        const czeka = (q.queue_pending ?? []).length;
        if (biegnie + czeka > 0) powody.push(`ComfyUI liczy (${biegnie} biegnie, ${czeka} czeka)`);
    } catch { /* ComfyUI śpi — karta z tej strony wolna */ }
    try {
        const { stdout } = await execFileAsync('nvidia-smi', ['--query-gpu=memory.free,utilization.gpu', '--format=csv,noheader,nounits'], { timeout: 8000, windowsHide: true });
        const [wolneMiB, util] = String(stdout).trim().split(',').map((s) => Number(s.trim()));
        if (wolneMiB < MIN_VRAM_MIB) powody.push(`VRAM wolne ${wolneMiB} MiB < ${MIN_VRAM_MIB}`);
        if (util >= 50) powody.push(`GPU zajęte w ${util} %`);
    } catch { /* bez nvidia-smi nie blokujemy — roboty CPU mają sens */ }
    return { ok: powody.length === 0, powody };
}

function ramWolny() {
    const gb = os.freemem() / 1e9;
    return { ok: gb >= MIN_RAM_GB, gb: +gb.toFixed(1) };
}

async function sprawdzBramy() {
    const [bez, karta] = await Promise.all([sekundyBezczynnosci(), kartaWolna()]);
    const ram = ramWolny();
    const powody = [];
    const bezOk = bez !== null && bez >= PROG_BEZCZYNNOSCI_S;
    if (bez === null) powody.push('bezczynność nieznana (nie Windows albo błąd odczytu)');
    else if (!bezOk) powody.push(`Suweren aktywny ${bez} s temu (próg ${PROG_BEZCZYNNOSCI_S} s)`);
    if (!karta.ok) powody.push(...karta.powody);
    if (!ram.ok) powody.push(`RAM wolne ${ram.gb} GB < ${MIN_RAM_GB} GB`);
    stan.bezczynnySek = bez;
    stan.bramy = { bezczynnosc: bezOk, karta: karta.ok, ram: ram.ok };
    stan.powody = powody;
    stan.ostatnieSprawdzenie = Date.now();
    return powody.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// WYKONANIE
// ─────────────────────────────────────────────────────────────────────────────

async function wykonaj(zadanie) {
    const robota = ROBOTY[zadanie.rodzaj];
    if (!robota) throw new Error(`Rodzaj „${zadanie.rodzaj}" nie jest na białej liście.`);
    const body = {};
    for (const k of robota.pola) if (zadanie.parametry && zadanie.parametry[k] !== undefined) body[k] = zadanie.parametry[k];

    const url = robota.metoda === 'GET'
        ? `${mostBase}${robota.sciezka}${Object.keys(body).length ? '?' + new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString() : ''}`
        : `${mostBase}${robota.sciezka}`;
    const r = await fetch(url, {
        method: robota.metoda,
        headers: { 'Content-Type': 'application/json' },
        body: robota.metoda === 'GET' ? undefined : JSON.stringify(body),
        // Roboty bywają długie (Demucs 30 min, Skryba kilkanaście minut).
        signal: AbortSignal.timeout(45 * 60 * 1000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || d.error || `HTTP ${r.status}`);

    // Skryba zwraca id zadania w tle — czekamy, aż skończy, żeby dziennik mówił prawdę.
    if (robota.czekajNa === 'skryba' && d.zadanie) {
        for (let i = 0; i < 180; i++) {
            await new Promise((res) => setTimeout(res, 10_000));
            const s = await fetch(`${mostBase}/api/rekopis/z-opowiesci/${encodeURIComponent(d.zadanie)}`).then((x) => x.json()).catch(() => null);
            if (!s) continue;
            if (s.stan === 'gotowe') return { ...d, rozdzialow: s.rozdzialy?.length ?? 0, sekund: s.sekund };
            if (s.stan === 'blad') throw new Error(s.blad || 'Skryba przerwał');
        }
        throw new Error('Skryba nie skończył w 30 minut');
    }
    if (d.nic) return d;
    // Realizacja Nocna oddaje `sondaz` — czekamy, aż stan przestanie być „trwa" (to są godziny, sufit 12 h).
    if (robota.czekajNa === 'sondaz' && d.sondaz) {
        for (let i = 0; i < 12 * 60 * 2; i++) {
            await new Promise((res) => setTimeout(res, 30_000));
            const s = await fetch(`${mostBase}${d.sondaz}`).then((x) => x.json()).catch(() => null);
            if (!s || s.stan === 'trwa') continue;
            if (s.stan === 'blad' || s.stan === 'padla') throw new Error(s.blad || 'zadanie padło');
            return { ...d, stan: s.stan, podsumowanie: s.podsumowanie ?? null, film: s.film ?? null, odcinki: s.odcinki?.map((o) => `#${o.numer} ${o.stan}`) ?? undefined };
        }
        throw new Error('Realizacja nie skończyła się w 12 godzin');
    }
    return d;
}

async function cykl() {
    if (wTrakcie) return;
    wTrakcie = true;
    try {
        const d = await wczytaj();
        stan.wlaczona = d.wlaczona;
        if (!d.wlaczona) return;
        const czeka = d.zadania.find((z) => z.stan === 'czeka');
        if (!czeka) { stan.powody = ['kolejka pusta']; return; }
        if (!(await sprawdzBramy())) return;

        czeka.stan = 'trwa';
        czeka.od = new Date().toISOString();
        stan.trwa = { id: czeka.id, rodzaj: czeka.rodzaj, od: czeka.od };
        await zapisz(d);
        await szyna?.nadaj?.({ agent: 'Nocna Zmiana', rodzaj: 'praca', tresc: `ruszyła: ${ROBOTY[czeka.rodzaj]?.opis ?? czeka.rodzaj} (bezczynność ${stan.bezczynnySek} s)` }).catch(() => {});

        const t0 = Date.now();
        let wynik = null, blad = null;
        try { wynik = await wykonaj(czeka); } catch (e) { blad = e.message; }

        const d2 = await wczytaj();
        const z = d2.zadania.find((x) => x.id === czeka.id);
        if (z) {
            z.stan = blad ? 'blad' : 'gotowe';
            z.koniec = new Date().toISOString();
            z.sekund = Math.round((Date.now() - t0) / 1000);
            z.blad = blad;
            z.wynik = wynik ? JSON.stringify(wynik).slice(0, 600) : null;
        }
        d2.dziennik.unshift({ kiedy: new Date().toISOString(), id: czeka.id, rodzaj: czeka.rodzaj, stan: blad ? 'blad' : 'gotowe', sekund: Math.round((Date.now() - t0) / 1000), blad });
        d2.dziennik = d2.dziennik.slice(0, 200);
        await zapisz(d2);
        stan.trwa = null;
        stan.ostatniWynik = { id: czeka.id, rodzaj: czeka.rodzaj, stan: blad ? 'blad' : 'gotowe', blad };
        await szyna?.nadaj?.({ agent: 'Nocna Zmiana', rodzaj: blad ? 'blad' : 'praca', tresc: blad ? `padło: ${czeka.rodzaj} — ${blad}` : `skończyła: ${czeka.rodzaj} w ${Math.round((Date.now() - t0) / 1000)} s` }).catch(() => {});
    } catch (e) {
        stan.powody = [`cykl: ${e.message}`];
    } finally {
        wTrakcie = false;
    }
}

export function uruchomPetle() {
    if (tik) return;
    tik = setInterval(() => { cykl().catch(() => {}); }, CO_ILE_MS);
    tik.unref?.();
}

// ─────────────────────────────────────────────────────────────────────────────
// API DLA TRAS
// ─────────────────────────────────────────────────────────────────────────────

export async function stanZmiany() {
    const d = await wczytaj();
    stan.wlaczona = d.wlaczona;
    return {
        ...stan,
        prog: { bezczynnoscS: PROG_BEZCZYNNOSCI_S, minRamGb: MIN_RAM_GB, minVramMiB: MIN_VRAM_MIB, coIleS: CO_ILE_MS / 1000 },
        zadania: d.zadania,
        dziennik: d.dziennik.slice(0, 30),
        roboty: Object.entries(ROBOTY).map(([rodzaj, r]) => ({
            rodzaj, opis: r.opis, pola: r.pola, wymagane: r.wymagane ?? [],
            // Opis każdego pola: skąd lista, czy liczba, czy wymagane — karta buduje z tego formularz.
            opisPol: r.pola.map((p) => ({ nazwa: p, ...(POLA[p] ?? { etykieta: p, typ: 'tekst' }), ...(r.polaInaczej?.[p] ?? {}), wymagane: (r.wymagane ?? []).includes(p) })),
        })),
    };
}

export async function przelacz(wlaczona) {
    const d = await wczytaj();
    d.wlaczona = !!wlaczona;
    await zapisz(d);
    stan.wlaczona = d.wlaczona;
    return d.wlaczona;
}

export async function dodaj({ rodzaj, parametry = {}, notatka = '' }) {
    if (!ROBOTY[rodzaj]) throw new Error(`Nie znam roboty „${rodzaj}". Znane: ${Object.keys(ROBOTY).join(', ')}`);
    // Bez wskazania celu robota nie wie, co ma robić — odmawiamy od razu, nie o 3 w nocy.
    const brak = (ROBOTY[rodzaj].wymagane ?? []).filter((p) => parametry[p] === undefined || parametry[p] === null || String(parametry[p]).trim() === '');
    if (brak.length) throw new Error(`Robota „${ROBOTY[rodzaj].opis}" wymaga wskazania: ${brak.map((p) => POLA[p]?.etykieta ?? p).join(', ')}.`);
    const d = await wczytaj();
    const z = { id: id(), rodzaj, parametry, notatka: String(notatka).slice(0, 200), stan: 'czeka', dodano: new Date().toISOString() };
    d.zadania.push(z);
    await zapisz(d);
    return z;
}

export async function usun(idZadania) {
    const d = await wczytaj();
    const przed = d.zadania.length;
    d.zadania = d.zadania.filter((z) => z.id !== idZadania || z.stan === 'trwa');
    await zapisz(d);
    return przed - d.zadania.length;
}

/**
 * Uruchom zadanie TERAZ, z pominięciem bram — świadoma decyzja człowieka, nie automatu.
 * Zapis do dziennika taki sam jak z pętli, z dopiskiem „ręcznie".
 */
export async function uruchomTeraz(idZadania) {
    const d = await wczytaj();
    const z = d.zadania.find((x) => x.id === idZadania);
    if (!z) throw new Error('Nie ma takiego zadania.');
    if (z.stan === 'trwa') throw new Error('To zadanie już trwa.');
    z.stan = 'trwa'; z.od = new Date().toISOString(); z.recznie = true;
    await zapisz(d);
    stan.trwa = { id: z.id, rodzaj: z.rodzaj, od: z.od };
    const t0 = Date.now();
    let wynik = null, blad = null;
    try { wynik = await wykonaj(z); } catch (e) { blad = e.message; }
    const d2 = await wczytaj();
    const z2 = d2.zadania.find((x) => x.id === idZadania);
    if (z2) { z2.stan = blad ? 'blad' : 'gotowe'; z2.koniec = new Date().toISOString(); z2.sekund = Math.round((Date.now() - t0) / 1000); z2.blad = blad; z2.wynik = wynik ? JSON.stringify(wynik).slice(0, 600) : null; }
    d2.dziennik.unshift({ kiedy: new Date().toISOString(), id: idZadania, rodzaj: z.rodzaj, stan: blad ? 'blad' : 'gotowe', sekund: Math.round((Date.now() - t0) / 1000), blad, recznie: true });
    d2.dziennik = d2.dziennik.slice(0, 200);
    await zapisz(d2);
    stan.trwa = null;
    stan.ostatniWynik = { id: idZadania, rodzaj: z.rodzaj, stan: blad ? 'blad' : 'gotowe', blad };
    await szyna?.nadaj?.({ agent: 'Nocna Zmiana', rodzaj: blad ? 'blad' : 'praca', tresc: `${blad ? 'padło' : 'skończyła'} (ręcznie): ${z.rodzaj}${blad ? ' — ' + blad : ''}` }).catch(() => {});
    if (blad) throw new Error(blad);
    return { id: idZadania, sekund: Math.round((Date.now() - t0) / 1000), wynik };
}

/** Sprawdzenie bram na żądanie — panel pokazuje, dlaczego Zmiana (nie) rusza. */
export async function sprawdzTeraz() {
    await sprawdzBramy();
    return { bezczynnySek: stan.bezczynnySek, bramy: stan.bramy, powody: stan.powody };
}

export default { skonfiguruj, uruchomPetle, stanZmiany, przelacz, dodaj, usun, uruchomTeraz, sprawdzTeraz, sekundyBezczynnosci, ROBOTY };
