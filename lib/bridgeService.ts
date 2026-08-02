/**
 * 🌉 bridgeService.ts — Śluza AntiGravity (Połączenie z przestrzenią lokalną systemu)
 *
 * Ten serwis przesyła polecenia do procesu Node.js (Wiesia)
 * nasłuchującego na lokalnym porcie 3001. 
 */

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:3001/api/bridge/execute';
const BRIDGE_PATH = '/api/bridge/execute';

/** Klucz Kwantowego Tunelu (Cloudflare) w localStorage. */
export const TUNNEL_STORAGE_KEY = 'teodash_tunnel_url';

/**
 * Normalizuje adres tunelu. Suweren może wkleić samą bazę
 * (`https://cos-tam.trycloudflare.com`) albo pełną ścieżkę — obie formy działają.
 */
export const normalizeTunnelUrl = (raw: string): string => {
    let url = raw.trim().replace(/\s+/g, '');
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    url = url.replace(/\/+$/, '');
    if (!url.includes(BRIDGE_PATH)) url = `${url}${BRIDGE_PATH}`;
    return url;
};

/** Odczyt zapisanego tunelu (pusty string = brak / tryb lokalny). */
export const getTunnelUrl = (): string => {
    if (typeof window === 'undefined') return '';
    try { return (localStorage.getItem(TUNNEL_STORAGE_KEY) || '').trim(); } catch { return ''; }
};

/** Zapis tunelu. Pusty adres kasuje wpis → powrót do trybu lokalnego. */
export const setTunnelUrl = (raw: string): string => {
    const normalized = normalizeTunnelUrl(raw);
    if (typeof window === 'undefined') return normalized;
    try {
        if (normalized) localStorage.setItem(TUNNEL_STORAGE_KEY, normalized);
        else localStorage.removeItem(TUNNEL_STORAGE_KEY);
    } catch { /* storage zablokowany — zostaje tryb lokalny */ }
    return normalized;
};

/**
 * Baza Mostu (sam origin, bez ścieżki) — dla endpointów innych niż Śluza:
 * `/api/ollama`, `/api/gemini`, `/api/mechanic/*`. Jedzie tunelem, gdy tunel stoi.
 */
export const getBridgeBase = (): string => {
    const tunnel = getTunnelUrl();
    const url = tunnel ? normalizeTunnelUrl(tunnel) : DEFAULT_BRIDGE_URL;
    return url.replace(BRIDGE_PATH, '').replace(/\/+$/, '');
};

// ── 🛡️ KLUCZ STRAŻY MOSTU ────────────────────────────────────────────────────
// Most odrzuca żądania spoza maszyny bez klucza. Klucz jedzie w NAGŁÓWKU, a do
// telefonu trafia FRAGMENTEM adresu (`#k=…`) — fragment nigdy nie opuszcza
// przeglądarki, więc nie ląduje w logach serwera, proxy ani w historii Cloudflare.
// Parametr `?k=` byłby wygodniejszy i właśnie dlatego jest zły.

const KLUCZ_STORAGE = 'teodash_klucz_strazy';
export const NAGLOWEK_KLUCZA = 'x-teo-klucz';

export const getKluczStrazy = (): string => {
    if (typeof window === 'undefined') return '';
    try { return (localStorage.getItem(KLUCZ_STORAGE) || '').trim(); } catch { return ''; }
};

export const setKluczStrazy = (klucz: string): string => {
    const czysty = String(klucz || '').trim();
    if (typeof window === 'undefined') return czysty;
    try {
        if (czysty) localStorage.setItem(KLUCZ_STORAGE, czysty);
        else localStorage.removeItem(KLUCZ_STORAGE);
    } catch { /* storage zablokowany */ }
    return czysty;
};

/** Nagłówki dla każdego wywołania Mostu — z kluczem, jeśli jest. */
const naglowki = (dodatkowe: Record<string, string> = {}): Record<string, string> => {
    const k = getKluczStrazy();
    return { 'Content-Type': 'application/json', ...(k ? { [NAGLOWEK_KLUCZA]: k } : {}), ...dodatkowe };
};

/**
 * Na maszynie Suwerena klucz można po prostu pobrać z Mostu (endpoint wydaje go
 * wyłącznie żądaniom lokalnym). Dzięki temu Katedra na localhoście działa bez
 * żadnej konfiguracji, a klucz jest gotowy do wbicia w kod QR dla telefonu.
 */
export const zapewnijKluczLokalnie = async (): Promise<string> => {
    if (getKluczStrazy()) return getKluczStrazy();
    try {
        const r = await fetch(`${getBridgeBase()}/api/straz/klucz`);
        if (!r.ok) return '';
        const d = await r.json();
        return d?.klucz ? setKluczStrazy(d.klucz) : '';
    } catch { return ''; }
};

/**
 * 📡 DISPATCH — hydratacja tunelu z adresu strony.
 * Telefon otwiera `https://graviton.pw/?tunnel=<adres>` (np. z kodu QR), a Katedra
 * sama zapisuje tunel i czyści parametr z paska adresu (żeby nie wisiał w historii).
 * Zwraca zapisany adres albo '' gdy w URL nic nie było.
 */
export const hydrateTunnelFromLocation = (): string => {
    if (typeof window === 'undefined') return '';
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('tunnel');
        if (!raw) return '';

        const saved = setTunnelUrl(raw);
        params.delete('tunnel');

        // 🔑 Klucz Straży czytamy z FRAGMENTU (`#k=…`) i natychmiast go stamtąd
        // usuwamy — żeby nie został w pasku adresu ani w historii przeglądarki.
        let hash = window.location.hash;
        const hp = new URLSearchParams(hash.replace(/^#/, ''));
        const k = hp.get('k');
        if (k) {
            setKluczStrazy(k);
            hp.delete('k');
            const reszta = hp.toString();
            hash = reszta ? `#${reszta}` : '';
        }

        const rest = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${hash}`);
        return saved;
    } catch {
        return '';
    }
};

/**
 * Link dispatchowy dla telefonu — to on ląduje w kodzie QR.
 * Klucz idzie za kratką, bo fragment nie opuszcza przeglądarki: nie trafia do
 * logów serwera hostingu ani do Cloudflare. Zapłatą jest to, że kto zobaczy
 * kod QR, ten ma klucz — dlatego Straż i tak nie wpuszcza z tunelu niczego,
 * co zapisuje albo uruchamia (patrz services/StrazMostu.js).
 */
export const buildDispatchUrl = (tunnel: string, base = 'https://graviton.pw', klucz = getKluczStrazy()): string => {
    const normalized = normalizeTunnelUrl(tunnel);
    if (!normalized) return '';
    const podstawa = `${base.replace(/\/+$/, '')}/?tunnel=${encodeURIComponent(normalized)}`;
    return klucz ? `${podstawa}#k=${encodeURIComponent(klucz)}` : podstawa;
};

const getBridgeUrl = (): string => {
    // Kwantowy Tunel (Cloudflare) ma pierwszeństwo; brak → bezpieczny powrót na localhost.
    const tunnelUrl = getTunnelUrl();
    return tunnelUrl ? normalizeTunnelUrl(tunnelUrl) : DEFAULT_BRIDGE_URL;
};

export interface BridgeResponse {
    success: boolean;
    message: string;
    error?: string;
}

export const executeBridgeCommand = async (command: string): Promise<BridgeResponse> => {
    const url = getBridgeUrl();
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: naglowki(),
            body: JSON.stringify({ command }),
        });

        if (!response.ok) {
            throw new Error(`Błąd odpowiedzi serwera (Status: ${response.status})`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("[AntiGravity Bridge] Błąd połączenia ze Śluzą:", error);

        // Obsługa przypadku, w którym serwer Wiesia po prostu nie jest uruchomiony
        return {
            success: false,
            message: `Śluza zamknięta: Serwer Wiesława jest wyłączony lub nieosiągalny pod ${url}.`,
            error: error instanceof Error ? error.message : String(error)
        };
    }
};

export interface GenericBridgeResponse extends BridgeResponse {
    stdout?: string;
    stderr?: string;
    [key: string]: any;
}

/**
 * Wysyła generyczne polecenie do Śluzy
 */
export const sendCommand = async (action: string, params: Record<string, any> = {}): Promise<GenericBridgeResponse> => {
    const url = getBridgeUrl();
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: naglowki(),
            body: JSON.stringify({ action, ...params }),
        });

        if (!response.ok) {
            throw new Error(`Błąd odpowiedzi serwera (Status: ${response.status})`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`[AntiGravity Bridge] Błąd połączenia ze Śluzą: ${action} failed`, error);
        return {
            success: false,
            message: `Błąd wymiaru: Serwer Wiesława jest nieosiągalny pod ${url}.`,
            error: error instanceof Error ? error.message : String(error)
        };
    }
};

export interface FileWriteResponse extends BridgeResponse {
    filePath?: string;
}

export const sendWriteFileCommand = async (filename: string, content: string): Promise<FileWriteResponse> => {
    return sendCommand('WRITE_FILE', { filename, content }) as Promise<FileWriteResponse>;
};

// Eksport domyślny dla wygody Suwerena
const bridgeService = {
    executeBridgeCommand,
    sendWriteFileCommand,
    sendCommand,
};

export default bridgeService;
