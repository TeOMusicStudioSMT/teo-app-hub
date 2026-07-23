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
        const rest = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
        return saved;
    } catch {
        return '';
    }
};

/** Link dispatchowy dla telefonu — to on ląduje w kodzie QR. */
export const buildDispatchUrl = (tunnel: string, base = 'https://graviton.pw'): string => {
    const normalized = normalizeTunnelUrl(tunnel);
    if (!normalized) return '';
    return `${base.replace(/\/+$/, '')}/?tunnel=${encodeURIComponent(normalized)}`;
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
            headers: {
                'Content-Type': 'application/json',
            },
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
            headers: {
                'Content-Type': 'application/json',
            },
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
