/**
 * 🛰️ tunel — Kwantowy Tunel jednym przyciskiem (front → most → cloudflared).
 *
 * Most (services/Tunel.js) odpala `cloudflared tunnel --url` i oddaje losowy adres
 * `https://….trycloudflare.com` + klucz Straży. Karty (Delegat, Kwantowy Tunel) budują
 * z tego QR dla telefonu.
 *
 * ⚠️ CELOWO NIE zapisujemy adresu jako `teodash_tunnel_url` tej Katedry: zapis
 * przełączyłby lokalną Katedrę na rozmowę z własnym mostem PRZEZ Cloudflare — wolniej,
 * a Straż uznałaby ją za zdalną i zablokowała Mechanika, kuźnie, klon głosu. Tunel jest
 * dla telefonu; komputer zostaje lokalny. Kto chce inaczej, ma nadal „Zapisz Tunel".
 *
 * Trasy /api/tunel/* są tylko lokalne — wołamy ZAWSZE 127.0.0.1:3001, nigdy przez tunel.
 */

const MOST = 'http://127.0.0.1:3001';

export interface StanTunelu {
    stan: 'zatrzymany' | 'instaluje' | 'startuje' | 'dziala' | 'blad';
    adres: string | null;
    od: string | null;
    blad: string | null;
    binarka: string | null;
    zainstalowany: boolean;
    log: string[];
    port: number;
}

export async function stanTunelu(): Promise<StanTunelu> {
    const r = await fetch(`${MOST}/api/tunel/stan`);
    if (!r.ok) throw new Error(`Most: HTTP ${r.status}`);
    return r.json();
}

/** Uruchom (albo dołącz do działającego). Oddaje adres + klucz Straży. Rzuca z powodem z mostu. */
export async function uruchomTunel(): Promise<StanTunelu & { klucz?: string }> {
    const r = await fetch(`${MOST}/api/tunel/start`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.adres) throw new Error(d.message || `Most: HTTP ${r.status}`);
    return d;
}

export async function zatrzymajTunel(): Promise<StanTunelu> {
    const r = await fetch(`${MOST}/api/tunel/stop`, { method: 'POST' });
    return r.json().catch(() => ({}));
}

/** Link na telefon do strony Delegata przez tunel — klucz za kratką (fragment nie opuszcza przeglądarki). */
export function linkDelegata(adres: string, klucz: string | null | undefined, profilId = 'joanna'): string {
    const baza = adres.replace(/\/+$/, '');
    return `${baza}/delegat/#${klucz ? `k=${encodeURIComponent(klucz)}&` : ''}delegat=${encodeURIComponent(profilId)}`;
}
