/**
 * 💍 PIERŚCIEŃ APEK — wszystkie studia Katedry w jednym oknie Huba.
 *
 * Suweren 2026-10-07: „otwieram to jakby we własnej apce, a potem Game Studio otwiera się w nowym oknie…
 * dałoby się w tym samym oknie, z przejściem w bok jak na otakos.wtf… koło wszystkich odpalonych apek
 * Katedry… i dla naszych Agentów lepiej — jakby jedna appka".
 *
 * Apka = warstwa (iframe) nad Hubem, ŻYJE w tle po przełączeniu (bez przeładowania i utraty pracy).
 * Lista otwartych apek pamięta się na urządzeniu; po odświeżeniu Huba warstwa wczytuje się dopiero przy
 * pierwszym wejściu (nie budzimy 5 studiów naraz). Kto woli stare zachowanie: localStorage
 * `otakos_apki_okno = 'nowe'` → nowa karta jak dawniej.
 */

export interface Apka {
    id: string;
    tytul: string;
    url: string;
    /** Emoji kółka w pierścieniu. */
    znak: string;
    /** Kolor obwódki (CSS). */
    kolor: string;
    /** Czy iframe już wczytany (leniwe wczytywanie po odświeżeniu Huba). */
    wczytana?: boolean;
    /** Zmienia się przy ponownym otwarciu z nowym adresem — wymusza przeładowanie warstwy. */
    wersja?: number;
}

interface Stan { apki: Apka[]; aktywna: string | null }

const KLUCZ = 'otakos_pierscien_v1';
const sluchacze = new Set<(s: Stan) => void>();

function wczytaj(): Stan {
    try {
        const d = JSON.parse(localStorage.getItem(KLUCZ) || 'null') as Stan | null;
        if (d && Array.isArray(d.apki)) return { apki: d.apki.map((a) => ({ ...a, wczytana: false })), aktywna: null };
    } catch { /* prywatne okno */ }
    return { apki: [], aktywna: null };
}

let stan: Stan = wczytaj();

function ustaw(nowy: Stan): void {
    stan = nowy;
    try { localStorage.setItem(KLUCZ, JSON.stringify({ apki: stan.apki.map(({ wczytana: _w, ...a }) => a), aktywna: null })); } catch { /* bez pamięci */ }
    // Agenci i inne części Huba: kto jest otwarty i co widać (BroadcastChannel — ta sama maszyna).
    try { new BroadcastChannel('katedra_pierscien').postMessage({ apki: stan.apki.map((a) => ({ id: a.id, tytul: a.tytul, url: a.url })), aktywna: stan.aktywna }); } catch { /* stara przeglądarka */ }
    sluchacze.forEach((f) => f(stan));
}

export const stanPierscienia = (): Stan => stan;
export function sluchajPierscienia(f: (s: Stan) => void): () => void { sluchacze.add(f); return () => { sluchacze.delete(f); }; }

/** Nowa karta zamiast pierścienia — świadomy wybór Suwerena. */
export function wNowymOknie(): boolean {
    try { return localStorage.getItem('otakos_apki_okno') === 'nowe'; } catch { return false; }
}

/** Kolory i znaki studiów (reszta: ✦ i fiolet). */
const WYGLAD: Record<string, { znak: string; kolor: string }> = {
    comfy: { znak: '🎛️', kolor: '#f97316' }, voicestudio: { znak: '🎙️', kolor: '#14b8a6' }, swiat: { znak: '🧱', kolor: '#38bdf8' },
    story: { znak: '🎬', kolor: '#a855f7' }, music: { znak: '🎵', kolor: '#ec4899' }, app: { znak: '🛠️', kolor: '#06b6d4' },
    games: { znak: '🎮', kolor: '#22c55e' }, fashion: { znak: '👗', kolor: '#f472b6' }, lab: { znak: '🧪', kolor: '#3b82f6' },
};

/**
 * Otwórz apkę w pierścieniu (albo w nowej karcie, gdy tak wybrano). Ta sama apka drugi raz = przejście do niej;
 * z innym adresem (np. teleport z parametrami) — przeładowanie jej warstwy na nowy adres.
 */
export function otworzApke(a: { id: string; tytul: string; url: string; znak?: string; kolor?: string }): void {
    if (wNowymOknie()) { window.open(a.url, '_blank', 'noopener'); return; }
    const w = WYGLAD[a.id] ?? { znak: '✦', kolor: '#8b5cf6' };
    const stara = stan.apki.find((x) => x.id === a.id);
    const apka: Apka = stara
        ? { ...stara, tytul: a.tytul, url: a.url, wczytana: true, wersja: stara.url !== a.url ? (stara.wersja ?? 0) + 1 : stara.wersja }
        : { id: a.id, tytul: a.tytul, url: a.url, znak: a.znak ?? w.znak, kolor: a.kolor ?? w.kolor, wczytana: true, wersja: 0 };
    ustaw({ apki: stara ? stan.apki.map((x) => (x.id === a.id ? apka : x)) : [...stan.apki, apka], aktywna: a.id });
}

/** Przejdź do otwartej apki (pierwsze wejście po odświeżeniu Huba ją wczytuje). */
export function pokazApke(id: string): void {
    if (!stan.apki.some((a) => a.id === id)) return;
    ustaw({ apki: stan.apki.map((a) => (a.id === id ? { ...a, wczytana: true } : a)), aktywna: id });
}

/** Przeładuj warstwę apki (np. studio wstało później niż jego okno). */
export function przeladujApke(id: string): void {
    ustaw({ apki: stan.apki.map((a) => (a.id === id ? { ...a, wczytana: true, wersja: (a.wersja ?? 0) + 1 } : a)), aktywna: id });
}

/** Wróć do Huba — apki żyją dalej w tle. */
export function pokazHub(): void { if (stan.aktywna !== null) ustaw({ ...stan, aktywna: null }); }

/** Zamknij apkę (jej warstwa znika, praca w niej przepada jak przy zamknięciu karty). */
export function zamknijApke(id: string): void {
    ustaw({ apki: stan.apki.filter((a) => a.id !== id), aktywna: stan.aktywna === id ? null : stan.aktywna });
}

/** Następna / poprzednia w kole: Hub → apka 1 → … → Hub. */
export function przewin(kierunek: 1 | -1): void {
    const kolo = [null, ...stan.apki.map((a) => a.id)];
    const i = kolo.indexOf(stan.aktywna);
    const nast = kolo[(i + kierunek + kolo.length) % kolo.length];
    if (nast === null) pokazHub(); else pokazApke(nast);
}
