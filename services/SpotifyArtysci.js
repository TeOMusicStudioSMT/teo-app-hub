/**
 * 🎧 Spotify — profile artystów Katedry (Suweren 2026-11-10: „Połącz” przy Spotify tylko przełączał stan).
 * Spotify Web API, Client Credentials (klucze w Skarbcu 0.00G: usługa `spotify` {client_id, client_secret}).
 * Tylko ODCZYT publicznych profili: nazwa, obserwujący, popularność, gatunki, zdjęcie, link. Nic nie publikuje —
 * muzyka trafia na Spotify przez dystrybutora (paczka DistroKid w kolejce Impresariatu).
 */
export const ARTYSCI = [
    { klucz: 'elara', id: '1v1bnmU5f11bCJA26D53z5' },
    { klucz: 'kael', id: '5MsSriliBvzqoMuwKmmtMr' },
];

/** Profil artysty z odpowiedzi Spotify → pola, które pokazuje Impresariat. */
export const profilArtysty = (a) => ({
    id: a.id, nazwa: a.name, obserwujacy: a.followers?.total ?? null, popularnosc: a.popularity ?? null,
    gatunki: a.genres ?? [], obraz: a.images?.[0]?.url ?? null, url: a.external_urls?.spotify ?? `https://open.spotify.com/artist/${a.id}`,
});

/**
 * @param {{ klucze: () => Promise<{client_id?: string, client_secret?: string}>, fetch?: typeof fetch, teraz?: () => number }} cfg
 */
export function utworzSpotify({ klucze, fetch: f = fetch, teraz = () => Date.now() }) {
    let token = null;
    async function dostep() {
        if (token && token.do > teraz() + 30_000) return token.wartosc;
        const k = await klucze();
        if (!k?.client_id || !k?.client_secret) throw Object.assign(new Error('Brak kluczy Spotify w Skarbcu 0.00G (usługa spotify: client_id, client_secret).'), { kod: 412 });
        const r = await f('https://accounts.spotify.com/api/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${k.client_id}:${k.client_secret}`).toString('base64')}` },
            body: 'grant_type=client_credentials',
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.access_token) throw Object.assign(new Error(`Spotify odmówił tokenu (HTTP ${r.status}${d.error_description ? `: ${d.error_description}` : d.error ? `: ${d.error}` : ''}).`), { kod: 502 });
        token = { wartosc: d.access_token, do: teraz() + (Number(d.expires_in) || 3600) * 1000 };
        return token.wartosc;
    }
    /** Profile wszystkich artystów Katedry; artysta, którego Spotify nie oddał, ma `blad` (reszta działa). */
    async function artysci() {
        const t = await dostep();
        return Promise.all(ARTYSCI.map(async ({ klucz, id }) => {
            const r = await f(`https://api.spotify.com/v1/artists/${id}`, { headers: { Authorization: `Bearer ${t}` } });
            if (!r.ok) return { klucz, id, blad: `HTTP ${r.status}` };
            return { klucz, ...profilArtysty(await r.json()) };
        }));
    }
    return { artysci };
}

export function zamontujTrasySpotify(app, S) {
    app.get('/api/impresario/spotify/artysci', async (_req, res) => {
        try { res.json({ success: true, artysci: await S.artysci() }); }
        catch (e) { res.status(typeof e.kod === 'number' ? e.kod : 502).json({ success: false, message: e.message }); }
    });
}

export default { utworzSpotify, zamontujTrasySpotify, ARTYSCI, profilArtysty };
