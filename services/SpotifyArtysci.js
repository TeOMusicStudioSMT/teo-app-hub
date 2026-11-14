/**
 * 🎧 Spotify — profile artystów Katedry (Suweren 2026-11-10: „Połącz” przy Spotify tylko przełączał stan).
 * Spotify Web API, Client Credentials (klucze w Skarbcu 0.00G: usługa `spotify` {client_id, client_secret}).
 * Tylko ODCZYT publicznych profili: nazwa, obserwujący, popularność, gatunki, zdjęcie, link. Nic nie publikuje —
 * muzyka trafia na Spotify przez dystrybutora (paczka DistroKid w kolejce Impresariatu).
 */
/** Album „Zero Gravity Heart (0.00G Sessions)” — adres podał Suweren (2026-11-14). */
export const ALBUM_SPOTIFY = { id: '323Vwh5KWdlT4rBjkzu1DM', url: 'https://open.spotify.com/album/323Vwh5KWdlT4rBjkzu1DM' };
export const ARTYSCI = [
    // id bywa przepisane z literówką (I/1/l, J) — gdy Spotify odda 404, szukamy po nazwie i znaku rozpoznawczym (utwór)
    { klucz: 'elara', id: '1v1bnmU5f1TbCJA26D53z5', nazwa: 'ELARA', utwor: 'Raindrops' },   // id potwierdzone przez Suwerena 2026-11-14 (wcześniej literówka CIA)
    { klucz: 'kael', id: '5MsSriliBvzqoMuwKmmtMr', nazwa: 'KAEL', utwor: null },
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
    const pobierz = async (t, url) => { const r = await f(url, { headers: { Authorization: `Bearer ${t}` } }); return { r, d: r.ok ? await r.json() : null }; };
    /**
     * Zapas, gdy id nie istnieje (404/400 — literówka): /v1/search po nazwie; dokładna nazwa, a przy kilku — ten,
     * który ma w najpopularniejszych utworach znak rozpoznawczy (np. „Raindrops”). Nic pewnego = null (zostaje błąd).
     */
    async function znajdz(t, { nazwa, utwor }) {
        if (!nazwa) return null;
        const { d } = await pobierz(t, `https://api.spotify.com/v1/search?type=artist&limit=10&q=${encodeURIComponent(nazwa)}`);
        const takiSam = (d?.artists?.items ?? []).filter((a) => String(a.name).toLowerCase() === nazwa.toLowerCase());
        if (!utwor) return takiSam.length === 1 ? takiSam[0] : null;
        for (const a of takiSam) {
            const { d: top } = await pobierz(t, `https://api.spotify.com/v1/artists/${a.id}/top-tracks?market=DE`);
            if ((top?.tracks ?? []).some((x) => String(x.name).toLowerCase().includes(utwor.toLowerCase()))) return a;
        }
        // utworu nie ma w najpopularniejszych — szukamy samego utworu i bierzemy artystę o tej nazwie
        const { d: s } = await pobierz(t, `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(`${utwor} ${nazwa}`)}`);
        const tr = (s?.tracks?.items ?? []).find((x) => x.artists?.some((a) => String(a.name).toLowerCase() === nazwa.toLowerCase()));
        const id = tr?.artists.find((a) => String(a.name).toLowerCase() === nazwa.toLowerCase())?.id;
        return id ? (await pobierz(t, `https://api.spotify.com/v1/artists/${id}`)).d : takiSam.length === 1 ? takiSam[0] : null;
    }
    /** Profile wszystkich artystów Katedry; artysta, którego Spotify nie oddał, ma `blad` (reszta działa). */
    async function artysci() {
        const t = await dostep();
        return Promise.all(ARTYSCI.map(async (art) => {
            const { klucz, id } = art;
            const { r, d } = await pobierz(t, `https://api.spotify.com/v1/artists/${id}`);
            if (r.ok) return { klucz, ...profilArtysty(d) };
            if (r.status === 404 || r.status === 400) {
                const a = await znajdz(t, art).catch(() => null);
                if (a) return { klucz, ...profilArtysty(a), poprawioneId: a.id !== id ? a.id : undefined };
            }
            return { klucz, id, blad: `HTTP ${r.status}${art.nazwa ? ` (wyszukanie „${art.nazwa}” nic pewnego nie dało)` : ''}` };
        }));
    }
    /** Utwory albumu (odczyt publiczny): numer, nazwa, adres — do przypięcia każdej stacji Opodysku do jej utworu. */
    async function albumUtwory(id) {
        if (!/^[A-Za-z0-9]{10,40}$/.test(String(id))) throw Object.assign(new Error('Zły identyfikator albumu.'), { kod: 400 });
        const t = await dostep(), wyniki = [];
        for (let od = 0; od < 100; od += 50) {
            const { r, d } = await pobierz(t, `https://api.spotify.com/v1/albums/${id}/tracks?limit=50&offset=${od}&market=DE`);
            if (!r.ok) throw Object.assign(new Error(`Spotify nie oddał utworów albumu (HTTP ${r.status}).`), { kod: 502 });
            wyniki.push(...(d.items ?? []));
            if (!d.next) break;
        }
        return wyniki.map((x) => ({ nr: x.track_number, nazwa: x.name, url: x.external_urls?.spotify ?? `https://open.spotify.com/track/${x.id}` }));
    }
    return { artysci, albumUtwory };
}

export function zamontujTrasySpotify(app, S) {
    app.get('/api/impresario/spotify/album/:id', async (req, res) => {
        try { res.json({ success: true, utwory: await S.albumUtwory(req.params.id) }); }
        catch (e) { res.status(typeof e.kod === 'number' ? e.kod : 502).json({ success: false, message: e.message }); }
    });
    app.get('/api/impresario/spotify/artysci', async (_req, res) => {
        try { res.json({ success: true, artysci: await S.artysci() }); }
        catch (e) { res.status(typeof e.kod === 'number' ? e.kod : 502).json({ success: false, message: e.message }); }
    });
}

export default { utworzSpotify, zamontujTrasySpotify, ARTYSCI, profilArtysty };
