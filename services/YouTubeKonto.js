/**
 * 📺 YouTubeKonto — „Połącz z YouTube” jednym kliknięciem (2026-10-03).
 *
 * Suweren: „potrzebuję w końcu podłączyć to API… ciągle ostateczne produkcje muszę sam uploadować”.
 * Impresariat (services/ImpresarioService.js) od dawna umiał wysłać plik na YouTube, ale wymagał
 * ręcznie wklejonego REFRESH_TOKEN — a ten zdobywa się w OAuth Playground, czego nikt nie robi dwa razy.
 *
 * Teraz: Suweren raz zakłada w Google Cloud klienta OAuth typu „Aplikacja komputerowa” (Desktop),
 * wkleja CLIENT_ID i CLIENT_SECRET, klika „Połącz” → ekran zgody Google w przeglądarce → Google
 * wraca na most (http://127.0.0.1:3001/api/impresario/youtube/zwrot — pętla zwrotna, którą Google
 * dopuszcza dla klientów Desktop) → most wymienia kod na token odświeżania i zapisuje go w skarbcu
 * Impresariatu (`_OtakOs_Wymiar/media/media_secrets.json`, poza repo). Nic nie trzeba kopiować.
 *
 * Bezpieczeństwo: `state` (losowy, jednorazowy, 10 min) chroni przed podrzuceniem cudzego kodu,
 * PKCE (S256) — przed użyciem przechwyconego kodu. Zakresy: tylko wysyłka i odczyt własnego kanału.
 *
 * ⚠️ UCZCIWIE O DWÓCH OGRANICZENIACH GOOGLE (nie da się ich obejść kodem):
 *   1. Projekt w trybie „Testowanie” daje token na 7 dni — trzeba przełączyć ekran zgody na „W produkcji”
 *      (dla własnego kanału wystarczy; Google pokaże ostrzeżenie „niezweryfikowana aplikacja”).
 *   2. Filmy wysłane z projektu API bez audytu YouTube trzyma jako PRYWATNE, nawet gdy prosimy
 *      o „niepubliczny”. Dlatego po wysyłce pytamy o PRAWDZIWY status filmu (`statusFilmu`).
 */
import crypto from 'node:crypto';

export const ZAKRESY = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];
export const SCIEZKA_ZWROTU = '/api/impresario/youtube/zwrot';
const WAZNOSC_STATE_MS = 10 * 60_000;

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * @param {{ sekrety:()=>Promise<any>, zapiszToken:(t:string)=>Promise<any>, adresMostu?:string,
 *           fetch?:typeof fetch, teraz?:()=>number }} o
 *   sekrety → { CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN } ze skarbca Impresariatu
 */
export function utworzKontoYouTube(o) {
    const cfg = { adresMostu: 'http://127.0.0.1:3001', fetch: (...a) => fetch(...a), teraz: () => Date.now(), ...o };
    const oczekujace = new Map();   // state → { weryfikator, kiedy }
    const zwrot = () => `${cfg.adresMostu}${SCIEZKA_ZWROTU}`;
    let kanalPamiec = null;   // { kiedy, kanal }

    /** Adres ekranu zgody Google. Rzuca, gdy brak CLIENT_ID / CLIENT_SECRET. */
    async function adresZgody() {
        const s = await cfg.sekrety();
        if (!s?.CLIENT_ID?.trim() || !s?.CLIENT_SECRET?.trim()) throw new Error('Najpierw wklej CLIENT_ID i CLIENT_SECRET klienta OAuth (typ „Aplikacja komputerowa”) z Google Cloud.');
        for (const [k, v] of oczekujace) if (cfg.teraz() - v.kiedy > WAZNOSC_STATE_MS) oczekujace.delete(k);
        const state = b64url(crypto.randomBytes(24));
        const weryfikator = b64url(crypto.randomBytes(48));
        oczekujace.set(state, { weryfikator, kiedy: cfg.teraz() });
        const p = new URLSearchParams({
            client_id: s.CLIENT_ID.trim(), redirect_uri: zwrot(), response_type: 'code',
            scope: ZAKRESY.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
            state, code_challenge: b64url(crypto.createHash('sha256').update(weryfikator).digest()), code_challenge_method: 'S256',
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
    }

    /** Powrót z Google: sprawdź state, wymień kod na token odświeżania, zapisz w skarbcu. */
    async function przyjmijZwrot({ code, state, error } = {}) {
        if (error) throw new Error(error === 'access_denied' ? 'Odmówiono zgody na ekranie Google.' : `Google zwrócił błąd: ${error}`);
        const o_ = state && oczekujace.get(String(state));
        if (!o_ || cfg.teraz() - o_.kiedy > WAZNOSC_STATE_MS) throw new Error('Ten powrót z Google jest nieważny albo przeterminowany — kliknij „Połącz z YouTube” jeszcze raz.');
        oczekujace.delete(String(state));
        if (!code) throw new Error('Google nie oddał kodu.');
        const s = await cfg.sekrety();
        const r = await cfg.fetch('https://oauth2.googleapis.com/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ code: String(code), client_id: s.CLIENT_ID.trim(), client_secret: s.CLIENT_SECRET.trim(), redirect_uri: zwrot(), grant_type: 'authorization_code', code_verifier: o_.weryfikator }).toString(),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.refresh_token) throw new Error(d.refresh_token === undefined && r.ok ? 'Google nie dał tokenu odświeżania — usuń dostęp aplikacji na myaccount.google.com/permissions i połącz ponownie.' : `Wymiana kodu nieudana: ${d.error ?? r.status} ${d.error_description ?? ''}`.trim());
        await cfg.zapiszToken(d.refresh_token);
        kanalPamiec = null;
        return { ok: true, kanal: await kanal(d.access_token).catch(() => null) };
    }

    async function tokenDostepu() {
        const s = await cfg.sekrety();
        if (!s?.REFRESH_TOKEN?.trim()) throw new Error('YouTube niepołączony.');
        const r = await cfg.fetch('https://oauth2.googleapis.com/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: s.CLIENT_ID, client_secret: s.CLIENT_SECRET, refresh_token: s.REFRESH_TOKEN, grant_type: 'refresh_token' }).toString(),
        });
        const d = await r.json().catch(() => ({}));
        if (!d.access_token) {
            throw new Error(d.error === 'invalid_grant'
                ? 'Token YouTube wygasł albo został cofnięty — kliknij „Połącz z YouTube” ponownie (projekt w trybie „Testowanie” daje token tylko na 7 dni).'
                : `Token YouTube: ${d.error ?? r.status} ${d.error_description ?? ''}`.trim());
        }
        return d.access_token;
    }

    async function api(sciezka, token) {
        const r = await cfg.fetch(`https://www.googleapis.com/youtube/v3/${sciezka}`, { headers: { Authorization: `Bearer ${token ?? await tokenDostepu()}` } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`YouTube API ${r.status}: ${d.error?.message ?? ''}`.trim());
        return d;
    }

    /** Kanał właściciela tokenu (nazwa, id, adres). */
    async function kanal(token) {
        if (!token && kanalPamiec && cfg.teraz() - kanalPamiec.kiedy < 10 * 60_000) return kanalPamiec.kanal;
        const d = await api('channels?part=snippet&mine=true', token);
        const c = d.items?.[0];
        const k = c ? { id: c.id, nazwa: c.snippet?.title ?? '', adres: c.snippet?.customUrl ? `https://www.youtube.com/${c.snippet.customUrl}` : `https://www.youtube.com/channel/${c.id}` } : null;
        kanalPamiec = { kiedy: cfg.teraz(), kanal: k };
        return k;
    }

    /** Prawdziwy status filmu po wysyłce: private / unlisted / public + czy przetworzony. */
    async function statusFilmu(id) {
        if (!/^[\w-]{11}$/.test(String(id ?? ''))) throw new Error('Złe id filmu.');
        const d = await api(`videos?part=status&id=${id}`);
        const s = d.items?.[0]?.status;
        if (!s) return { id, istnieje: false };
        return { id, istnieje: true, widocznosc: s.privacyStatus, przetworzony: s.uploadStatus === 'processed', odrzucony: s.rejectionReason ?? null };
    }

    /** Stan dla UI — bez sekretów. */
    async function stan() {
        const s = await cfg.sekrety().catch(() => ({}));
        const klient = !!(s?.CLIENT_ID?.trim() && s?.CLIENT_SECRET?.trim());
        const polaczony = !!s?.REFRESH_TOKEN?.trim();
        let k = null, blad = null;
        if (polaczony) { try { k = await kanal(); } catch (e) { blad = e.message; } }
        return { klient, polaczony, kanal: k, blad, zwrot: zwrot() };
    }

    return { adresZgody, przyjmijZwrot, tokenDostepu, kanal, statusFilmu, stan };
}

export default { utworzKontoYouTube, ZAKRESY, SCIEZKA_ZWROTU };
