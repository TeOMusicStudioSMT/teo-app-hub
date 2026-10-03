/**
 * 📺 Kanał YouTube w wizytówce (2026-10-03) — Suweren: „dajmy całą ramkę na cały kanał YT, a w panelu
 * miejsce na wklejenie… mój to https://www.youtube.com/@ArtOfSoulTV”.
 *
 * Bez klucza API i bez logowania: adres kanału (@nazwa, /channel/UC…, /c/…, /user/…) → id kanału
 * (z publicznej strony kanału) → publiczny kanał RSS z najnowszymi filmami. Ramka na stronie gra
 * playlistę „wszystkie filmy” kanału (UU + id bez „UC”) przez youtube-nocookie.
 * Katedra pyta YouTube raz na 30 min i podaje wynik w wizytówce — przeglądarka gościa nie puka do
 * YouTube po listę, dopiero po kliknięciu ramki.
 */
const ID_KANALU = /^UC[\w-]{22}$/;
const WAZNOSC_MS = 30 * 60_000;

/** Adres kanału → { handle } albo { id } albo { sciezka } (/c/…, /user/…). null = to nie kanał YouTube. */
export function rozpoznajKanal(url) {
    let u;
    const t = String(url ?? '').trim();
    if (/^@[\w.-]{3,30}$/.test(t)) return { handle: t.slice(1), adres: `https://www.youtube.com/${t}` };
    try { u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`); } catch { return null; }
    if (!/^(www\.|m\.)?youtube\.com$/i.test(u.hostname)) return null;
    const p = u.pathname.replace(/\/+$/, '');
    let m;
    if ((m = p.match(/^\/@([\w.-]{3,30})(\/.*)?$/))) return { handle: m[1], adres: `https://www.youtube.com/@${m[1]}` };
    if ((m = p.match(/^\/channel\/(UC[\w-]{22})(\/.*)?$/))) return { id: m[1], adres: `https://www.youtube.com/channel/${m[1]}` };
    if ((m = p.match(/^\/(c|user)\/([\w.-]{1,100})(\/.*)?$/))) return { sciezka: `/${m[1]}/${m[2]}`, adres: `https://www.youtube.com/${m[1]}/${m[2]}` };
    return null;
}

/** Id kanału ze strony kanału — tylko pewne miejsca (kanoniczny adres, externalId), nie pierwsze lepsze „UC…”. */
export function idKanaluZeStrony(html) {
    const t = String(html ?? '');
    const m = t.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)
        ?? t.match(/"externalId":"(UC[\w-]{22})"/)
        ?? t.match(/<meta itemprop="(?:identifier|channelId)" content="(UC[\w-]{22})"/);
    return m?.[1] ?? null;
}

const odEncji = (s) => String(s ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** RSS kanału → { nazwa, filmy: [{ id, tytul, kiedy }] } (najwyżej 15 — tyle daje YouTube). */
export function filmyZRss(xml) {
    const t = String(xml ?? '');
    const nazwa = odEncji(t.match(/<author>\s*<name>([^<]*)<\/name>/)?.[1] ?? t.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').trim();
    const filmy = [];
    for (const e of t.split('<entry>').slice(1)) {
        const id = e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
        if (!id) continue;
        filmy.push({ id, tytul: odEncji(e.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').trim().slice(0, 160), kiedy: e.match(/<published>([^<]+)<\/published>/)?.[1] ?? null });
    }
    return { nazwa: nazwa.slice(0, 100), filmy: filmy.slice(0, 15) };
}

/** @param {{ fetch?:typeof fetch, teraz?:()=>number }} o */
export function utworzKanalYouTube(o = {}) {
    const cfg = { fetch: (...a) => fetch(...a), teraz: () => Date.now(), ...o };
    const pamiec = new Map();   // adres → { kiedy, wynik }
    const naglowki = { 'User-Agent': 'Mozilla/5.0 (Katedra OtakOS)', 'Accept-Language': 'pl,en;q=0.8' };

    async function tekst(url) {
        const r = await cfg.fetch(url, { headers: naglowki, signal: AbortSignal.timeout(10_000) });
        if (!r.ok) throw new Error(`YouTube HTTP ${r.status}`);
        return r.text();
    }

    /** { id, nazwa, adres, playlista, filmy } — albo { adres, blad } (wizytówka mówi prawdę, nie zgaduje). */
    async function pobierz(url) {
        const k = rozpoznajKanal(url);
        if (!k) return null;
        const z = pamiec.get(k.adres);
        if (z && cfg.teraz() - z.kiedy < WAZNOSC_MS) return z.wynik;
        let wynik;
        try {
            const id = k.id ?? idKanaluZeStrony(await tekst(k.adres));
            if (!id || !ID_KANALU.test(id)) throw new Error('nie znalazłem id kanału na jego stronie');
            const rss = filmyZRss(await tekst(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`));
            wynik = { id, nazwa: rss.nazwa, adres: k.adres, playlista: `UU${id.slice(2)}`, filmy: rss.filmy };
        } catch (e) {
            wynik = { adres: k.adres, blad: e.message };
        }
        pamiec.set(k.adres, { kiedy: cfg.teraz(), wynik });
        return wynik;
    }
    return { pobierz };
}

// ── Linki do innych serwisów (Instagram, TikTok, Spotify…) — tylko https, nazwa z domeny ──
const SERWISY = [
    [/(^|\.)instagram\.com$/, 'Instagram'], [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)facebook\.com$/, 'Facebook'],
    [/(^|\.)(x|twitter)\.com$/, 'X'], [/(^|\.)threads\.net$/, 'Threads'], [/(^|\.)spotify\.com$/, 'Spotify'],
    [/(^|\.)soundcloud\.com$/, 'SoundCloud'], [/(^|\.)bandcamp\.com$/, 'Bandcamp'], [/(^|\.)suno\.(com|ai)$/, 'Suno'],
    [/(^|\.)twitch\.tv$/, 'Twitch'], [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'], [/(^|\.)patreon\.com$/, 'Patreon'],
    [/(^|\.)linkedin\.com$/, 'LinkedIn'], [/(^|\.)github\.com$/, 'GitHub'], [/(^|\.)discord\.(gg|com)$/, 'Discord'],
];
/** Lista linków (tekst: jeden na linię albo tablica) → [{ nazwa, url }], max 10, tylko https. */
export function linkiSpolecznosciowe(wejscie) {
    const surowe = Array.isArray(wejscie) ? wejscie : String(wejscie ?? '').split(/[\n,]+/);
    const wynik = [];
    for (const x of surowe) {
        const t = String(typeof x === 'object' && x ? x.url : x ?? '').trim();
        if (!t) continue;
        let u;
        try { u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`); } catch { continue; }
        if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
        u.protocol = 'https:';
        const h = u.hostname.toLowerCase().replace(/^www\./, '');
        if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h)) continue;
        const nazwa = SERWISY.find(([re]) => re.test(h))?.[1] ?? h;
        if (!wynik.some((w) => w.url === u.href)) wynik.push({ nazwa, url: u.href.slice(0, 300) });
        if (wynik.length >= 10) break;
    }
    return wynik;
}

export default { utworzKanalYouTube, rozpoznajKanal, idKanaluZeStrony, filmyZRss, linkiSpolecznosciowe };
