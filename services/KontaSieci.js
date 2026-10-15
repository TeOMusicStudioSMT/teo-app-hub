/**
 * 📱 KontaSieci — podpięcie kont TikTok i Instagram (Suweren 2026-10-15: „dział, który przerabia materiały na Shorts,
 * TikTok i Instagram… przygotuj podpięcie kont TikTok i Instagram — kanały założę sam”). Wzór: services/YouTubeKonto.js —
 * OAuth z pętlą zwrotną na moście, token w skarbcu Impresariatu (`media_secrets.json` → `tiktok` / `instagram`, poza repo),
 * kilka kont, jedno domyślne. Nic tu nie udaje połączenia: bez kluczy aplikacji / bez konta = `niepodłączone` z powodem.
 *
 * ── TikTok (sprawdzone w dokumentacji developers.tiktok.com, 2026-10-15) ──
 *   Login Kit for Desktop: `https://www.tiktok.com/v2/auth/authorize/` (client_key, scope po przecinku, redirect_uri, state,
 *   PKCE S256 — wyzwanie = SHA-256 weryfikatora w HEX), redirect tylko localhost/127.0.0.1 z portem (http dozwolony).
 *   Token: `POST https://open.tiktokapis.com/v2/oauth/token/` — dostęp 24 h, odświeżania 365 dni (może przyjść NOWY → zapis).
 *   Wysyłka = „Upload” (zakres `video.upload`): `POST /v2/post/publish/inbox/video/init/` FILE_UPLOAD → PUT kawałków
 *   na `upload_url` (Content-Range) → film trafia do SKRZYNKI twórcy w aplikacji TikTok jako szkic; Suweren kończy post
 *   w telefonie (opis, prywatność, muzyka). Celowo nie „Direct Post”: ten wymaga audytu (bez niego tylko SELF_ONLY,
 *   ≤ 5 kont/dobę), a do tego TikTok wymaga UX (wybór prywatności bez domyślnej, zgody na muzykę) — szkic oddaje te
 *   decyzje aplikacji TikTok. Limity: 6 zapytań/min na token, ≤ 5 szkiców czekających na dobę (403 spam_risk_too_many_pending_share).
 *
 * ── Instagram (developers.facebook.com/docs/instagram-platform/content-publishing, 2026-10-15) ──
 *   Instagram API z Facebook Login for Business (tylko ta droga ma wysyłkę „resumable” z pliku — bez publicznego adresu):
 *   konto Instagram PROFESJONALNE (Business/Creator) połączone ze stroną Facebook; uprawnienia instagram_basic,
 *   instagram_content_publish, pages_show_list, pages_read_engagement (+ business_management). Aplikacja w trybie
 *   deweloperskim działa dla osób z rolą w aplikacji (Suweren = administrator) — bez App Review; redirect
 *   http://localhost… Meta przyjmuje TYLKO w trybie deweloperskim (w trybie Live wymaga https — wtedy `OTAKOS_INSTAGRAM_ZWROT`
 *   = adres tunelu). Token: kod → krótki token → `fb_exchange_token` (60 dni) → `/me/accounts` → token STRONY (nie wygasa)
 *   i `instagram_business_account`. Publikacja: kontener `media_type=REELS, upload_type=resumable` → bajty na
 *   `rupload.facebook.com/ig-api-upload/<wer>/<kontener>` → `status_code` FINISHED → `media_publish` = POST PUBLICZNY
 *   (Instagram nie ma szkiców w API) — dlatego wysyłka tylko po ✓ Suwerena. Limit: 100 postów z API na 24 h.
 *
 * UCZCIWIE: kod rozmawia z prawdziwymi adresami, ale w tym przebiegu sprawdzony tylko na atrapie `fetch` (testy) —
 * prawdziwych kluczy aplikacji TikTok/Meta w Katedrze nie było.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

export const SIECI = ['tiktok', 'instagram'];
export const SCIEZKI_ZWROTU = { tiktok: '/api/impresario/tiktok/zwrot', instagram: '/api/impresario/instagram/zwrot' };
export const ZAKRESY_TIKTOK = ['user.info.basic', 'video.upload'];
export const ZAKRESY_INSTAGRAM = ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement', 'business_management'];
export const WERSJA_GRAPH = process.env.OTAKOS_GRAPH_WERSJA || 'v23.0';
const WAZNOSC_STATE_MS = 10 * 60_000;
const MB = 1024 * 1024;

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Kroki dla Suwerena (co zakłada SAM — Katedra tylko dołącza). Pokazuje je panel. */
export const INSTRUKCJE = {
    tiktok: [
        'Załóż konto TikTok (to, na które mają iść filmy) — w aplikacji TikTok.',
        'developers.tiktok.com → zaloguj się → Manage apps → Create app (typ: Desktop).',
        'Dodaj produkty: Login Kit i Content Posting API (bez „Direct Post” — Katedra wysyła szkice do skrzynki).',
        'Login Kit → platforma Desktop → Redirect URI: {zwrot} (dokładnie tak, z portem).',
        'Zakresy: user.info.basic i video.upload.',
        'Skopiuj Client key i Client secret → wklej poniżej → „Połącz z TikTok”.',
        'Bez zatwierdzenia aplikacji (App Review) działa tylko tryb Sandbox z kontami dodanymi jako „target users” — do pełnego użycia złóż wniosek o review w portalu TikTok.',
        'Film przychodzi do skrzynki w aplikacji TikTok (powiadomienie) — tam ustawiasz opis, prywatność i publikujesz.',
    ],
    instagram: [
        'Konto Instagram przełącz na PROFESJONALNE (Firma albo Twórca) — w aplikacji Instagram → Ustawienia → Typ konta.',
        'Połącz je ze stroną na Facebooku (Meta Business Suite albo ustawienia strony → Konta połączone → Instagram).',
        'developers.facebook.com → My Apps → Create app (typ: Business) → dodaj produkt „Instagram” (API z Facebook Login for Business) i „Facebook Login for Business”.',
        'Facebook Login → Settings → Valid OAuth Redirect URIs: {zwrot}. Aplikacja zostaje w trybie deweloperskim (localhost działa tylko w nim; Ty jako administrator nie potrzebujesz App Review).',
        'Opcjonalnie: Facebook Login for Business → Configurations → utwórz konfigurację z uprawnieniami instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement, business_management i wklej jej Configuration ID.',
        'Skopiuj App ID i App secret (Settings → Basic) → wklej poniżej → „Połącz z Instagramem” → wybierz stronę i konto Instagram.',
        'Instagram nie ma szkiców w API: wysłany Reel jest od razu PUBLICZNY — dlatego Katedra wysyła dopiero po Twoim ✓.',
    ],
};

/**
 * Wspólny szkielet kont jednej sieci: lista KONTA + DOMYSLNY w skarbcu, stan bez sekretów, state jednorazowy.
 * @param {string} siec
 * @param {{ sekrety:(siec:string)=>Promise<any>, zapiszSekrety:(siec:string, zmiana:(s:object)=>void)=>Promise<any> }} cfg
 */
function kontaSkarbca(siec, cfg) {
    const bledy = new Map();
    async function lista() {
        const s = await cfg.sekrety(siec).catch(() => ({}));
        const konta = Array.isArray(s?.KONTA) ? s.KONTA : [];
        return { domyslny: s?.DOMYSLNY ?? konta[0]?.id ?? null, konta: konta.map(({ id, nazwa, strona, polaczono }) => ({ id, nazwa, strona: strona ?? null, polaczono, blad: bledy.get(id) ?? null })) };
    }
    async function zapiszKonto(konto) {
        await cfg.zapiszSekrety(siec, (s) => {
            const konta = (Array.isArray(s.KONTA) ? s.KONTA : []).filter((k) => k.id !== konto.id);
            s.KONTA = [...konta, { ...konto, polaczono: new Date().toISOString() }];
            if (!s.KONTA.some((k) => k.id === s.DOMYSLNY)) s.DOMYSLNY = s.KONTA[0]?.id ?? null;
        });
        bledy.delete(konto.id);
    }
    async function ustawDomyslne(id) {
        await cfg.zapiszSekrety(siec, (s) => {
            if (!(s.KONTA ?? []).some((k) => k.id === id)) throw new Error('Nie ma takiego połączonego konta.');
            s.DOMYSLNY = id;
        });
        return lista();
    }
    async function rozlacz(id = null) {
        await cfg.zapiszSekrety(siec, (s) => {
            s.KONTA = id ? (s.KONTA ?? []).filter((k) => k.id !== id) : [];
            if (!s.KONTA.some((k) => k.id === s.DOMYSLNY)) s.DOMYSLNY = s.KONTA[0]?.id ?? null;
        });
        return lista();
    }
    async function konto(id = null) {
        const s = await cfg.sekrety(siec);
        const konta = Array.isArray(s?.KONTA) ? s.KONTA : [];
        const k = id ? konta.find((x) => x.id === id) : (konta.find((x) => x.id === s?.DOMYSLNY) ?? konta[0]);
        if (!k) throw new Error(id ? 'To konto nie jest połączone z Katedrą.' : `${siec === 'tiktok' ? 'TikTok' : 'Instagram'} niepołączony — najpierw „Połącz”.`);
        return { s, k };
    }
    return { lista, zapiszKonto, ustawDomyslne, rozlacz, konto, bledy };
}

/** Jednorazowe `state` (10 min) z dowolnym ładunkiem (weryfikator PKCE). */
function stany(teraz) {
    const m = new Map();
    return {
        nowy(dane = {}) {
            for (const [k, v] of m) if (teraz() - v.kiedy > WAZNOSC_STATE_MS) m.delete(k);
            const state = b64url(crypto.randomBytes(24));
            m.set(state, { ...dane, kiedy: teraz() });
            return state;
        },
        zuzyj(state, siec) {
            const v = state && m.get(String(state));
            if (!v || teraz() - v.kiedy > WAZNOSC_STATE_MS) throw new Error(`Ten powrót z ${siec} jest nieważny albo przeterminowany — kliknij „Połącz” jeszcze raz.`);
            m.delete(String(state));
            return v;
        },
    };
}

// ═══════════════════════════════════ TikTok ═══════════════════════════════════

/**
 * Kawałki wysyłki TikTok (przewodnik „Media Transfer”): plik ≤ 64 MB idzie jednym kawałkiem; większy — po 10 MB,
 * `total_chunk_count` = floor(rozmiar / kawałek), a reszta dokleja się do OSTATNIEGO (może mieć do 128 MB).
 */
export function kawalkiTikTok(rozmiar, kawalek = 10 * MB) {
    const n = Number(rozmiar);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Pusty plik.');
    if (n <= 64 * MB) return { chunk_size: n, total_chunk_count: 1, zakresy: [[0, n - 1]] };
    const ile = Math.floor(n / kawalek);
    const zakresy = Array.from({ length: ile }, (_, i) => [i * kawalek, i === ile - 1 ? n - 1 : (i + 1) * kawalek - 1]);
    return { chunk_size: kawalek, total_chunk_count: ile, zakresy };
}

/**
 * @param {{ sekrety, zapiszSekrety, adresMostu?:string, fetch?:typeof fetch, teraz?:()=>number, czytajPlik?:(p:string)=>Promise<Buffer> }} o
 */
export function utworzKontoTikTok(o) {
    const cfg = { adresMostu: 'http://127.0.0.1:3001', fetch: (...a) => fetch(...a), teraz: () => Date.now(), czytajPlik: (p) => fs.readFile(p), ...o };
    const K = kontaSkarbca('tiktok', cfg);
    const st = stany(cfg.teraz);
    const zwrot = () => `${cfg.adresMostu}${SCIEZKI_ZWROTU.tiktok}`;
    const API = 'https://open.tiktokapis.com';

    const klient = (s) => (s?.CLIENT_KEY?.trim() && s?.CLIENT_SECRET?.trim() ? { key: s.CLIENT_KEY.trim(), secret: s.CLIENT_SECRET.trim() } : null);

    async function zapiszKlienta({ clientKey = '', clientSecret = '' } = {}) {
        const key = String(clientKey).trim(), secret = String(clientSecret).trim();
        if (!/^[\w-]{8,64}$/.test(key) || secret.length < 8) throw new Error('Client key i Client secret z portalu developers.tiktok.com (Manage apps → Twoja aplikacja).');
        await cfg.zapiszSekrety('tiktok', (s) => { s.CLIENT_KEY = key; s.CLIENT_SECRET = secret; });
        return stan();
    }

    async function adresZgody() {
        const k = klient(await cfg.sekrety('tiktok'));
        if (!k) throw new Error('Najpierw wklej Client key i Client secret aplikacji TikTok (developers.tiktok.com).');
        const weryfikator = b64url(crypto.randomBytes(48)).replace(/[^A-Za-z0-9\-._~]/g, '').slice(0, 64);
        const state = st.nowy({ weryfikator });
        const p = new URLSearchParams({
            client_key: k.key, response_type: 'code', scope: ZAKRESY_TIKTOK.join(','), redirect_uri: zwrot(), state,
            code_challenge: crypto.createHash('sha256').update(weryfikator).digest('hex'), code_challenge_method: 'S256',
        });
        return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
    }

    async function token(body) {
        const r = await cfg.fetch(`${API}/v2/oauth/token/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.access_token) throw new Error(`TikTok token: ${d.error ?? r.status} ${d.error_description ?? ''}`.trim());
        return d;
    }

    async function przyjmijZwrot({ code, state, error, error_description } = {}) {
        if (error) throw new Error(error === 'access_denied' ? 'Odmówiono zgody na ekranie TikTok.' : `TikTok zwrócił błąd: ${error} ${error_description ?? ''}`.trim());
        const { weryfikator } = st.zuzyj(state, 'TikTok');
        if (!code) throw new Error('TikTok nie oddał kodu.');
        const k = klient(await cfg.sekrety('tiktok'));
        const d = await token({ client_key: k.key, client_secret: k.secret, code: String(code), grant_type: 'authorization_code', redirect_uri: zwrot(), code_verifier: weryfikator });
        if (!d.refresh_token) throw new Error('TikTok nie dał tokenu odświeżania.');
        const zakresy = String(d.scope ?? '').split(',').map((x) => x.trim());
        if (!zakresy.includes('video.upload')) throw new Error('Zgoda bez „video.upload” — aplikacja TikTok musi mieć Content Posting API i ten zakres.');
        const u = await uzytkownik(d.access_token).catch(() => null);
        const konto = { id: d.open_id, nazwa: u?.display_name || `TikTok ${String(d.open_id).slice(0, 6)}`, token: d.refresh_token };
        await K.zapiszKonto(konto);
        return { ok: true, konto: { id: konto.id, nazwa: konto.nazwa } };
    }

    async function uzytkownik(dostep) {
        const r = await cfg.fetch(`${API}/v2/user/info/?fields=open_id,display_name`, { headers: { Authorization: `Bearer ${dostep}` } });
        const d = await r.json().catch(() => ({}));
        return d?.data?.user ?? null;
    }

    /** Token dostępu konta (24 h); NOWY token odświeżania od TikTok zapisujemy od razu. */
    async function tokenDostepu(kontoId = null) {
        const { s, k } = await K.konto(kontoId);
        const kl = klient(s);
        if (!kl) throw new Error('Brak Client key / Client secret TikTok.');
        try {
            const d = await token({ client_key: kl.key, client_secret: kl.secret, grant_type: 'refresh_token', refresh_token: k.token });
            if (d.refresh_token && d.refresh_token !== k.token) await K.zapiszKonto({ ...k, token: d.refresh_token });
            K.bledy.delete(k.id);
            return { dostep: d.access_token, konto: k };
        } catch (e) {
            const blad = /invalid_grant|refresh/i.test(e.message) ? 'Token TikTok wygasł albo został cofnięty — połącz konto ponownie.' : e.message;
            K.bledy.set(k.id, blad);
            throw new Error(blad);
        }
    }

    async function apiPost(sciezka, dostep, body) {
        const r = await cfg.fetch(`${API}${sciezka}`, { method: 'POST', headers: { Authorization: `Bearer ${dostep}`, 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || (d.error?.code && d.error.code !== 'ok')) {
            const kod = d.error?.code ?? r.status;
            const ludzko = { spam_risk_too_many_pending_share: 'TikTok: w skrzynce czeka już 5 szkiców z ostatniej doby — dokończ je w aplikacji TikTok i spróbuj później.', scope_not_authorized: 'TikTok: konto połączone bez zakresu video.upload — połącz ponownie.', rate_limit_exceeded: 'TikTok: za dużo zapytań (6/min) — za chwilę.' }[kod];
            throw new Error(ludzko ?? `TikTok API ${kod}: ${d.error?.message ?? ''}`.trim());
        }
        return d.data ?? {};
    }

    /**
     * Szkic do skrzynki twórcy (zakres video.upload): init → PUT kawałków → `publish_id`. Opis/prywatność ustawia Suweren
     * w aplikacji TikTok (API szkicu nie przyjmuje opisu).
     */
    async function wyslijSzkic(plik, kontoId = null) {
        const bajty = await cfg.czytajPlik(plik);
        const { dostep, konto } = await tokenDostepu(kontoId);
        const k = kawalkiTikTok(bajty.length);
        const d = await apiPost('/v2/post/publish/inbox/video/init/', dostep, { source_info: { source: 'FILE_UPLOAD', video_size: bajty.length, chunk_size: k.chunk_size, total_chunk_count: k.total_chunk_count } });
        if (!d.upload_url || !d.publish_id) throw new Error('TikTok nie oddał adresu wysyłki.');
        for (const [a, b] of k.zakresy) {
            const r = await cfg.fetch(d.upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(b - a + 1), 'Content-Range': `bytes ${a}-${b}/${bajty.length}` }, body: bajty.subarray(a, b + 1) });
            if (!r.ok && r.status !== 206) throw new Error(`TikTok: kawałek ${a}-${b} odrzucony (HTTP ${r.status}).`);
        }
        return { publishId: d.publish_id, konto: { id: konto.id, nazwa: konto.nazwa } };
    }

    /** Stan szkicu: PROCESSING_UPLOAD / SEND_TO_USER_INBOX / PUBLISH_COMPLETE / FAILED (+ powód). */
    async function stanWysylki(publishId, kontoId = null) {
        const { dostep } = await tokenDostepu(kontoId);
        const d = await apiPost('/v2/post/publish/status/fetch/', dostep, { publish_id: publishId });
        return { status: d.status ?? null, powod: d.fail_reason ?? null };
    }

    async function stan() {
        const s = await cfg.sekrety('tiktok').catch(() => ({}));
        const { domyslny, konta } = await K.lista();
        const kl = !!klient(s);
        return {
            siec: 'tiktok', klient: kl, polaczony: konta.length > 0, konta, domyslny, zwrot: zwrot(), zakresy: ZAKRESY_TIKTOK, tryb: 'szkic',
            powod: !kl ? 'niepodłączone: brak aplikacji TikTok (Client key / secret z developers.tiktok.com)' : !konta.length ? 'niepodłączone: aplikacja jest, ale żadne konto nie dało zgody — „Połącz z TikTok”' : null,
            instrukcja: INSTRUKCJE.tiktok.map((x) => x.replace('{zwrot}', zwrot())),
        };
    }

    return { stan, zapiszKlienta, adresZgody, przyjmijZwrot, tokenDostepu, wyslijSzkic, stanWysylki, konta: K.lista, ustawDomyslne: K.ustawDomyslne, rozlacz: K.rozlacz };
}

// ═══════════════════════════════════ Instagram ═══════════════════════════════════

/**
 * @param {{ sekrety, zapiszSekrety, adresMostu?:string, adresZwrotu?:string|null, fetch?:typeof fetch, teraz?:()=>number,
 *           czytajPlik?:(p:string)=>Promise<Buffer>, czekaj?:(ms:number)=>Promise<void>, wersja?:string }} o
 */
export function utworzKontoInstagram(o) {
    const cfg = { adresMostu: 'http://localhost:3001', adresZwrotu: process.env.OTAKOS_INSTAGRAM_ZWROT || null, fetch: (...a) => fetch(...a), teraz: () => Date.now(), czytajPlik: (p) => fs.readFile(p), czekaj: (ms) => new Promise((r) => setTimeout(r, ms)), wersja: WERSJA_GRAPH, ...o };
    const K = kontaSkarbca('instagram', cfg);
    const st = stany(cfg.teraz);
    const zwrot = () => cfg.adresZwrotu || `${cfg.adresMostu}${SCIEZKI_ZWROTU.instagram}`;
    const G = () => `https://graph.facebook.com/${cfg.wersja}`;
    const klient = (s) => (s?.APP_ID?.trim() && s?.APP_SECRET?.trim() ? { id: s.APP_ID.trim(), secret: s.APP_SECRET.trim(), config: s.CONFIG_ID?.trim() || null } : null);

    async function zapiszKlienta({ appId = '', appSecret = '', configId = '' } = {}) {
        const id = String(appId).trim(), secret = String(appSecret).trim(), conf = String(configId ?? '').trim();
        if (!/^\d{6,20}$/.test(id) || !/^[0-9a-f]{16,64}$/i.test(secret)) throw new Error('App ID (same cyfry) i App secret (Settings → Basic aplikacji Meta).');
        if (conf && !/^\d{6,20}$/.test(conf)) throw new Error('Configuration ID to same cyfry (Facebook Login for Business → Configurations).');
        await cfg.zapiszSekrety('instagram', (s) => { s.APP_ID = id; s.APP_SECRET = secret; s.CONFIG_ID = conf || null; });
        return stan();
    }

    async function adresZgody() {
        const k = klient(await cfg.sekrety('instagram'));
        if (!k) throw new Error('Najpierw wklej App ID i App secret aplikacji Meta (developers.facebook.com).');
        const state = st.nowy();
        const p = new URLSearchParams({ client_id: k.id, redirect_uri: zwrot(), state, response_type: 'code' });
        if (k.config) p.set('config_id', k.config); else p.set('scope', ZAKRESY_INSTAGRAM.join(','));
        return `https://www.facebook.com/${cfg.wersja}/dialog/oauth?${p}`;
    }

    async function graf(sciezka, params = {}, metoda = 'GET') {
        const p = new URLSearchParams(params);
        const r = metoda === 'GET'
            ? await cfg.fetch(`${G()}/${sciezka}?${p}`)
            : await cfg.fetch(`${G()}/${sciezka}`, { method: metoda, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.error) {
            const e = d.error ?? {};
            const ludzko = e.code === 190 ? 'Token Instagram/Facebook wygasł albo został cofnięty — połącz konto ponownie.'
                : e.code === 10 || e.code === 200 ? `Brak uprawnienia (${e.message ?? ''}) — połącz ponownie i zaznacz stronę oraz konto Instagram.`
                : e.code === 9 || e.code === 4 ? 'Instagram: limit publikacji/zapytań — spróbuj później (100 postów z API na dobę).'
                : null;
            throw new Error(ludzko ?? `Graph API ${r.status}: ${e.message ?? ''}`.trim());
        }
        return d;
    }

    async function przyjmijZwrot({ code, state, error, error_description } = {}) {
        if (error) throw new Error(error === 'access_denied' ? 'Odmówiono zgody na ekranie Facebooka.' : `Facebook zwrócił błąd: ${error} ${error_description ?? ''}`.trim());
        st.zuzyj(state, 'Facebooka');
        if (!code) throw new Error('Facebook nie oddał kodu.');
        const k = klient(await cfg.sekrety('instagram'));
        const krotki = await graf('oauth/access_token', { client_id: k.id, client_secret: k.secret, redirect_uri: zwrot(), code: String(code) });
        const dlugi = await graf('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: k.id, client_secret: k.secret, fb_exchange_token: krotki.access_token });
        const strony = await graf('me/accounts', { fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: dlugi.access_token, limit: '100' });
        const zIg = (strony.data ?? []).filter((x) => x.instagram_business_account?.id && x.access_token);
        if (!zIg.length) throw new Error('Żadna z udostępnionych stron Facebooka nie ma połączonego konta Instagram PROFESJONALNEGO — połącz je i spróbuj ponownie (przy zgodzie zaznacz stronę).');
        const konta = [];
        for (const x of zIg) {
            const konto = { id: x.instagram_business_account.id, nazwa: x.instagram_business_account.username ? `@${x.instagram_business_account.username}` : x.name, strona: x.name, stronaId: x.id, token: x.access_token };
            await K.zapiszKonto(konto);
            konta.push({ id: konto.id, nazwa: konto.nazwa, strona: konto.strona });
        }
        return { ok: true, konta };
    }

    /**
     * Reel z pliku (resumable): kontener → bajty na rupload → czekanie na FINISHED → media_publish → link.
     * `postep(etap)` dostaje: kontener / wysylka / przetwarzanie / publikacja.
     */
    async function opublikujReel(plik, { opis = '', kontoId = null, postep = () => {}, maxCzekaniaMs = 10 * 60_000 } = {}) {
        const { k } = await K.konto(kontoId);
        const bajty = await cfg.czytajPlik(plik);
        postep('kontener');
        const kont = await graf(`${k.id}/media`, { media_type: 'REELS', upload_type: 'resumable', caption: String(opis).slice(0, 2200), share_to_feed: 'true', access_token: k.token }, 'POST');
        if (!kont.id) throw new Error('Instagram nie oddał kontenera.');
        postep('wysylka');
        const r = await cfg.fetch(kont.uri || `https://rupload.facebook.com/ig-api-upload/${cfg.wersja}/${kont.id}`, { method: 'POST', headers: { Authorization: `OAuth ${k.token}`, offset: '0', file_size: String(bajty.length) }, body: bajty });
        const w = await r.json().catch(() => ({}));
        if (!r.ok || w.success === false) throw new Error(`Instagram: wysyłka pliku odrzucona (${w.debug_info?.message ?? w.error?.message ?? r.status}).`);
        postep('przetwarzanie');
        const start = cfg.teraz();
        for (;;) {
            const s = await graf(kont.id, { fields: 'status_code,status', access_token: k.token });
            if (s.status_code === 'FINISHED') break;
            if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Instagram nie przetworzył filmu (${s.status_code}${s.status ? `: ${s.status}` : ''}).`);
            if (cfg.teraz() - start > maxCzekaniaMs) throw new Error('Instagram przetwarza film dłużej niż 10 min — kontener wygaśnie po 24 h; spróbuj ponownie.');
            await cfg.czekaj(15_000);
        }
        postep('publikacja');
        const pub = await graf(`${k.id}/media_publish`, { creation_id: kont.id, access_token: k.token }, 'POST');
        const link = await graf(pub.id, { fields: 'permalink', access_token: k.token }).then((x) => x.permalink ?? null).catch(() => null);
        return { mediaId: pub.id, url: link, konto: { id: k.id, nazwa: k.nazwa } };
    }

    async function stan() {
        const s = await cfg.sekrety('instagram').catch(() => ({}));
        const { domyslny, konta } = await K.lista();
        const kl = !!klient(s);
        return {
            siec: 'instagram', klient: kl, polaczony: konta.length > 0, konta, domyslny, zwrot: zwrot(), zakresy: ZAKRESY_INSTAGRAM, konfiguracja: !!s?.CONFIG_ID, tryb: 'publiczny',
            powod: !kl ? 'niepodłączone: brak aplikacji Meta (App ID / App secret z developers.facebook.com)' : !konta.length ? 'niepodłączone: aplikacja jest, ale żadne konto Instagram (profesjonalne, połączone ze stroną) nie dało zgody — „Połącz z Instagramem”' : null,
            instrukcja: INSTRUKCJE.instagram.map((x) => x.replace('{zwrot}', zwrot())),
        };
    }

    return { stan, zapiszKlienta, adresZgody, przyjmijZwrot, opublikujReel, konta: K.lista, ustawDomyslne: K.ustawDomyslne, rozlacz: K.rozlacz };
}

export default { utworzKontoTikTok, utworzKontoInstagram, kawalkiTikTok, SIECI, SCIEZKI_ZWROTU, INSTRUKCJE };
