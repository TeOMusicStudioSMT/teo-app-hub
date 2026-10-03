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
 *
 * WIELE KANAŁÓW (2026-10-03, Suweren: „a co w przypadku, jak mam wiele kanałów… na dwóch kontach,
 * oraz te nowe, co utworzą agenci”): każde „Połącz” = jeden kanał. Google pyta o konto (`select_account`),
 * a przy koncie z kanałami marki — o kanał; token działa dla TEGO kanału. Katedra trzyma listę
 * (skarbiec Impresariatu: KONTA + DOMYSLNY). ⚠️ Kanału nie da się ZAŁOŻYĆ przez API YouTube — zakłada
 * go człowiek w YouTube (kanał marki), Katedra go tylko dołącza.
 */
import crypto from 'node:crypto';

export const ZAKRESY = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];
export const SCIEZKA_ZWROTU = '/api/impresario/youtube/zwrot';
const WAZNOSC_STATE_MS = 10 * 60_000;

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * @param {{ sekrety:()=>Promise<any>, zapiszToken:(t:string, kanal:{id,nazwa,adres})=>Promise<any>, adresMostu?:string,
 *           fetch?:typeof fetch, teraz?:()=>number }} o
 *   sekrety → { CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN } ze skarbca Impresariatu
 */
export function utworzKontoYouTube(o) {
    const cfg = { adresMostu: 'http://127.0.0.1:3001', fetch: (...a) => fetch(...a), teraz: () => Date.now(), ...o };
    const oczekujace = new Map();   // state → { weryfikator, kiedy }
    const zwrot = () => `${cfg.adresMostu}${SCIEZKA_ZWROTU}`;
    const bledy = new Map();   // kanalId → ostatni błąd tokenu (wygasł / cofnięty)

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
            // select_account: przy drugim kanale Google pozwala wybrać INNE konto (i kanał marki)
            scope: ZAKRESY.join(' '), access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true',
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
        const k = await kanal(d.access_token);
        if (!k) throw new Error('To konto Google nie ma kanału YouTube (albo nie wybrałeś kanału) — załóż kanał w YouTube i połącz ponownie.');
        await cfg.zapiszToken(d.refresh_token, k);
        bledy.delete(k.id);
        return { ok: true, kanal: k };
    }

    /** Token odświeżania kanału: z listy KONTA, bez id = domyślny; stary pojedynczy REFRESH_TOKEN też działa. */
    function tokenKanalu(s, kanalId) {
        const konta = Array.isArray(s?.KONTA) ? s.KONTA : [];
        if (kanalId) {
            const k = konta.find((x) => x.id === kanalId);
            if (!k) throw new Error('Ten kanał nie jest połączony z Katedrą.');
            return k.token;
        }
        return (konta.find((x) => x.id === s?.DOMYSLNY) ?? konta[0])?.token ?? s?.REFRESH_TOKEN;
    }

    async function tokenDostepu(kanalId = null, odswiezania = null) {
        const s = await cfg.sekrety();
        const rt = odswiezania ?? tokenKanalu(s, kanalId);
        if (!rt?.trim()) throw new Error('YouTube niepołączony.');
        const r = await cfg.fetch('https://oauth2.googleapis.com/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: s.CLIENT_ID, client_secret: s.CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }).toString(),
        });
        const d = await r.json().catch(() => ({}));
        if (!d.access_token) {
            const blad = d.error === 'invalid_grant'
                ? 'Token YouTube wygasł albo został cofnięty — połącz ten kanał ponownie (projekt w trybie „Testowanie” daje token tylko na 7 dni).'
                : `Token YouTube: ${d.error ?? r.status} ${d.error_description ?? ''}`.trim();
            if (kanalId) bledy.set(kanalId, blad);
            throw new Error(blad);
        }
        if (kanalId) bledy.delete(kanalId);
        return d.access_token;
    }

    async function api(sciezka, token, kanalId = null) {
        const r = await cfg.fetch(`https://www.googleapis.com/youtube/v3/${sciezka}`, { headers: { Authorization: `Bearer ${token ?? await tokenDostepu(kanalId)}` } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`YouTube API ${r.status}: ${d.error?.message ?? ''}`.trim());
        return d;
    }

    /** Kanał właściciela tokenu dostępu (nazwa, id, adres). */
    async function kanal(token) {
        const d = await api('channels?part=snippet&mine=true', token);
        const c = d.items?.[0];
        return c ? { id: c.id, nazwa: c.snippet?.title ?? '', adres: c.snippet?.customUrl ? `https://www.youtube.com/${c.snippet.customUrl}` : `https://www.youtube.com/channel/${c.id}` } : null;
    }

    /** Prawdziwy status filmu po wysyłce (tokenem kanału, na który poszedł): private / unlisted / public + czy przetworzony. */
    async function statusFilmu(id, kanalId = null) {
        if (!/^[\w-]{11}$/.test(String(id ?? ''))) throw new Error('Złe id filmu.');
        const d = await api(`videos?part=status&id=${id}`, null, kanalId);
        const s = d.items?.[0]?.status;
        if (!s) return { id, istnieje: false };
        return { id, istnieje: true, widocznosc: s.privacyStatus, przetworzony: s.uploadStatus === 'processed', odrzucony: s.rejectionReason ?? null };
    }

    /** Lista połączonych kanałów (bez tokenów). */
    async function kanaly() {
        const s = await cfg.sekrety().catch(() => ({}));
        const konta = Array.isArray(s?.KONTA) ? s.KONTA : [];
        return { domyslny: s?.DOMYSLNY ?? konta[0]?.id ?? null, kanaly: konta.map(({ id, nazwa, adres, polaczono }) => ({ id, nazwa, adres, polaczono, blad: bledy.get(id) ?? null })) };
    }

    /** Stan dla UI — bez sekretów. Stary pojedynczy token (sprzed listy kanałów) przenosi na listę. */
    async function stan() {
        let s = await cfg.sekrety().catch(() => ({}));
        const klient = !!(s?.CLIENT_ID?.trim() && s?.CLIENT_SECRET?.trim());
        let blad = null;
        if (klient && s?.REFRESH_TOKEN?.trim() && !(Array.isArray(s.KONTA) && s.KONTA.length)) {
            try {
                const k = await kanal(await tokenDostepu(null, s.REFRESH_TOKEN));
                if (k) { await cfg.zapiszToken(s.REFRESH_TOKEN, k); s = await cfg.sekrety(); }
            } catch (e) { blad = e.message; }
        }
        const { domyslny, kanaly: lista } = await kanaly();
        const dom = lista.find((k) => k.id === domyslny) ?? null;
        return { klient, polaczony: lista.length > 0 || !!s?.REFRESH_TOKEN?.trim(), kanaly: lista, domyslny, kanal: dom, blad: blad ?? dom?.blad ?? null, zwrot: zwrot() };
    }

    return { adresZgody, przyjmijZwrot, tokenDostepu, kanal, kanaly, statusFilmu, stan };
}

export default { utworzKontoYouTube, ZAKRESY, SCIEZKA_ZWROTU };
