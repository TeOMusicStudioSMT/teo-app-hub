/**
 * 🎙️ NotebookPodcastService — Spectrum Podcast Twin (dwójka gospodarzy)
 *
 * Generuje dwuosobowy dialog wideo-podcastu (wzorzec NotebookLM) na bazie
 * kontekstu. Na samym POCZĄTKU promptu systemowego wstrzykiwany jest osobisty
 * komunikat od Suwerena: "Miło mi Was w końcu zobaczyć... :)".
 *
 * Model zwraca ŚCISŁY format dialogu: { hostA, hostB, triggerAnimation }.
 * Wywołanie idzie przez most Wiesława (/api/ollama, SSE) na nadrzędnym modelu.
 */

const BRIDGE_OLLAMA = 'http://127.0.0.1:3001/api/ollama';

/** Osobiste powitanie Suwerena — pierwsza linia promptu systemowego. */
export const SOVEREIGN_WELCOME = 'Miło mi Was w końcu zobaczyć... :)';

export type TwinAnimation = 'A_SPEAKING' | 'B_SPEAKING' | 'BOTH' | 'IDLE';

/** Pojedyncza tura dialogu dwóch gospodarzy. */
export interface PodcastTurn {
    hostA: string;
    hostB: string;
    triggerAnimation: TwinAnimation;
}

export class NotebookPodcastService {
    /** Buduje dwuosobowy prompt systemowy z powitaniem Suwerena na starcie. */
    static buildSystemPrompt(): string {
        return [
            SOVEREIGN_WELCOME,
            '',
            'Jesteście DWÓJKĄ gospodarzy suwerennego wideo-podcastu Katedry OtakOS:',
            '• HOST A ("Iskra") — energiczna, ciekawska, zadaje pytania, wprowadza tematy.',
            '• HOST B ("Echo") — analityczny, spokojny, pogłębia, podsumowuje, dorzuca fakt.',
            'Rozmawiacie naturalnie, krótko (1-3 zdania na osobę), z humorem i konkretem.',
            '',
            'Odpowiadaj WYŁĄCZNIE w formacie JSON (bez markdown, bez tekstu poza JSON):',
            '{"hostA":"...","hostB":"...","triggerAnimation":"A_SPEAKING|B_SPEAKING|BOTH|IDLE"}',
            'triggerAnimation = kto mówi wyraźniej w tej turze.',
        ].join('\n');
    }

    /** Aktywny rdzeń z Interfejsu Wiesi (nadrzędne źródło prawdy). */
    private static getModel(): string {
        try { return localStorage.getItem('otakos_active_model') || 'gemma4'; }
        catch { return 'gemma4'; }
    }

    /**
     * Generuje jedną turę dialogu na bazie tematu/kontekstu.
     * @param context  temat odcinka lub treść do omówienia.
     * @param history  poprzednie tury (dla ciągłości rozmowy).
     */
    async generateTurn(context: string, history: PodcastTurn[] = []): Promise<PodcastTurn> {
        const model = NotebookPodcastService.getModel();
        const system = NotebookPodcastService.buildSystemPrompt();
        const prior = history.slice(-3).map(t => `A: ${t.hostA}\nB: ${t.hostB}`).join('\n');
        const userPrompt =
            `TEMAT ODCINKA: "${context}"\n` +
            (prior ? `\nDOTYCHCZASOWA ROZMOWA:\n${prior}\n` : '') +
            `\nWygeneruj KOLEJNĄ turę rozmowy (JSON).`;

        try {
            const res = await fetch(BRIDGE_OLLAMA, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ model, system, messages: [{ role: 'user', content: userPrompt }] }),
            });
            if (!res.ok || !res.body) throw new Error(`Most HTTP ${res.status}`);

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '', full = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const evt = JSON.parse(line.slice(6));
                        if (evt.type === 'text' && evt.text) full += evt.text;
                        if (evt.type === 'error') throw new Error(evt.error);
                    } catch (e: any) {
                        if (e?.message && !e.message.includes('JSON')) throw e;
                    }
                }
            }
            return NotebookPodcastService.parseTurn(full);
        } catch (error: any) {
            // Fallback: gdy most/Ollama padnie — krótka tura zastępcza (panel nie wisi).
            return {
                hostA: `Hmm, rdzeń milczy (${error?.message || 'offline'}). Spróbujmy za chwilę?`,
                hostB: 'Most Wiesława śpi. Suweren wie co robić — odpalić wiesio-bridge.js. :)',
                triggerAnimation: 'BOTH',
            };
        }
    }

    /** Parsowanie JSON z odpowiedzi modelu (z fallbackiem na surowy tekst). */
    static parseTurn(raw: string): PodcastTurn {
        try {
            const m = raw.match(/\{[\s\S]*\}/);
            const o = JSON.parse(m ? m[0] : raw);
            const anim: TwinAnimation = ['A_SPEAKING', 'B_SPEAKING', 'BOTH', 'IDLE'].includes(o.triggerAnimation)
                ? o.triggerAnimation : 'BOTH';
            return {
                hostA: String(o.hostA || '...').trim(),
                hostB: String(o.hostB || '...').trim(),
                triggerAnimation: anim,
            };
        } catch {
            return { hostA: raw.slice(0, 200) || '...', hostB: '', triggerAnimation: 'A_SPEAKING' };
        }
    }
}

export default NotebookPodcastService;
