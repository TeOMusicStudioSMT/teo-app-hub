/**
 * 🎶 joannaPlaylist — ulubione smakołyki kompana (lokalna playlista Domu).
 *
 * Dwa źródła, jedna lista:
 *  - `public/joanna_playlist.json` — kuratorowany zestaw jadący z distro (Live-USB).
 *  - localStorage `teo_joanna_playlist` — to, co Suweren dorzuci z poziomu UI.
 * Scalane po `id`; wpisy Suwerena mają pierwszeństwo (może nadpisać kuratorowany tytuł).
 *
 * 0.00G: pliki lecą z lokalnego mostu (`/music/...`), nie z chmury.
 */

export interface JoannaTrack {
    id:        string;
    title:     string;
    filename?: string;   // plik w _OtakOs_Muzyka — strumień przez most
    url?:      string;   // zewnętrzny adres (eter/archiwum), gdy brak pliku
    note?:     string;   // dlaczego ulubiony
}

const STORE_KEY = 'teo_joanna_playlist';
const CONFIG_URL = 'joanna_playlist.json';   // relatywnie — działa też pod /apps/*

/** Wpisy dodane przez Suwerena (localStorage). */
export function loadUserTracks(): JoannaTrack[] {
    try {
        const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
        return Array.isArray(raw) ? raw.filter(t => t && t.id && t.title) : [];
    } catch { return []; }
}

function saveUserTracks(tracks: JoannaTrack[]): void {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(tracks)); } catch { /* limit storage */ }
}

/** Kuratorowany plik konfiguracyjny. Brak pliku = pusta lista, nie błąd. */
export async function loadConfigTracks(): Promise<JoannaTrack[]> {
    try {
        const res = await fetch(CONFIG_URL, { cache: 'no-cache' });
        if (!res.ok) return [];
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.tracks;
        return Array.isArray(list) ? list.filter((t: JoannaTrack) => t && t.id && t.title) : [];
    } catch { return []; }
}

/** Pełna playlista: kuratorowana + własna, bez duplikatów. */
export async function loadJoannaPlaylist(): Promise<JoannaTrack[]> {
    const [config, user] = [await loadConfigTracks(), loadUserTracks()];
    const byId = new Map<string, JoannaTrack>();
    config.forEach(t => byId.set(t.id, t));
    user.forEach(t => byId.set(t.id, t));   // Suweren nadpisuje kuratora
    return [...byId.values()];
}

/** Dorzuć utwór do ulubionych. Zwraca false, gdy już tam był. */
export function addUserTrack(track: JoannaTrack): boolean {
    const user = loadUserTracks();
    if (user.some(t => t.id === track.id)) return false;
    saveUserTracks([track, ...user]);
    return true;
}

/** Usuń z ulubionych (tylko wpisy Suwerena — kuratorowanych z pliku nie ruszamy). */
export function removeUserTrack(id: string): void {
    saveUserTracks(loadUserTracks().filter(t => t.id !== id));
}

export function isUserTrack(id: string): boolean {
    return loadUserTracks().some(t => t.id === id);
}

/** Stabilne id z nazwy pliku/adresu — ten sam utwór nie wpadnie dwa razy. */
export function trackIdFrom(source: string): string {
    return `joanna-${source.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
}
