/**
 * 🌉 bridgeService.ts — Śluza AntiGravity (Połączenie z przestrzenią lokalną systemu)
 *
 * Ten serwis przesyła polecenia do procesu Node.js (Wiesia)
 * nasłuchującego na lokalnym porcie 3001. 
 */

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:3001/api/bridge/execute';

const getBridgeUrl = (): string => {
    // Sprawdź czy jesteśmy w przeglądarce i czy jest ustawiony zewnętrzny tunel
    if (typeof window !== 'undefined') {
        const tunnelUrl = localStorage.getItem('teodash_tunnel_url');
        if (tunnelUrl && tunnelUrl.trim().length > 0) {
            return tunnelUrl;
        }
    }
    return DEFAULT_BRIDGE_URL;
};

export interface BridgeResponse {
    success: boolean;
    message: string;
    error?: string;
}

export const executeBridgeCommand = async (command: string): Promise<BridgeResponse> => {
    try {
        const url = getBridgeUrl();
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
            message: 'Śluza zamknięta: Serwer Wiesława jest wyłączony lub nieosiągalny na 127.0.0.1:3001.',
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
    try {
        const url = getBridgeUrl();
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
            message: 'Błąd wymiaru: Serwer Wiesława jest wyłączony lub nieosiągalny.',
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
