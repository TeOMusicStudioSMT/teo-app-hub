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
    /** Tura zastępcza, gdy most/Ollama milczy — nie jest częścią rozmowy (pamięć, eksport). */
    blad?: boolean;
}

/**
 * Co Katedra NAPRAWDĘ ma — gospodarze opierają pomysły na tym, a nie na ogólnikach z Web3.
 * Suweren (2026-09-27): „Podcast Twin nie wie, że mamy własne GRV i te rzeczy, o których mówią".
 * Fakty z mostu: wiesio-bridge.js (/api/grv/*, /api/market/*), services/Rangi.js, Questy.js,
 * ProjektStada.js, ZleceniaStada.js. Zmieniasz ekonomię — zmień i tu.
 */
export const WIEDZA_KATEDRY = [
    'WIEDZA O KATEDRZE (opieraj się na tym, nie wymyślaj):',
    '• Katedra OtakOS działa lokalnie, na sprzęcie Suwerena. Bez chmury, bez blockchaina, bez kryptowalut i giełd.',
    '• GRV — własna waluta Katedry: księga z pieczęcią (łańcuch hashy), zarządca TeO, nowy węzeł dostaje 1000 GRV.',
    '• Marketplace w GRV: twórca wystawia produkt i sam ustala cenę; zakup = przelew 100% ceny do twórcy + wpis w rejestrze posiadanych aktywów z pieczęcią. To jest nasz „royalty" — bez pośredników.',
    '• Kuracja społeczności: głosy w Marketplace; co 30 dni zostaje top 10 na moduł, reszta jest spalana, a jej cena bazowa w GRV wraca do twórców.',
    '• Prestiż i głos: rangi Katedry (Herold za osiągnięcia — nie da się kupić; Filar; Founder z puli 26 kluczy), questy płacą GRV za realną pracę, Rejestr Zasobów Trwałych.',
    '• Stado TeOgochi pracuje nad projektami (Projekt Stada) i samo zleca moduły: produkty do Marketplace, muzykę, bryły 3D (Assety3D), wideo (ComfyUI). Za pracę dostaje XP.',
    '• Świat klocków (2D/3D) i apka StoL na telefon; Stół = propozycje, które Suweren ratyfikuje.',
    'Nie proponuj DAO, tokenów zarządczych, NFT ani „mintowania" — to, czego szukacie, GRV już robi (nazwij właściwy mechanizm).',
    'Jeśli pomysł wymaga czegoś, czego Katedra nie ma (np. AR, osobna apka gry), powiedz to wprost jako kierunek na później.',
].join('\n');

/** Tura zastępcza z błędem mostu — też ze starej pamięci, zapisanej zanim tury dostały pole `blad`. */
export const czyBlad = (t: PodcastTurn): boolean =>
    !!t.blad || (/rdzeń milczy \(/.test(t.hostA) && /Most Wiesława śpi/.test(t.hostB));

/**
 * Rozmowa → tekst do pliku (i na Stół): temat Suwerena + tury Iskry i Echa, bez tur z błędem mostu.
 * Ten sam układ, w którym Suweren zapisywał rozmowy ręcznie.
 */
export function rozmowaDoTekstu(temat: string, tury: PodcastTurn[]): string {
    const linie = [`Suweren: "${temat.trim()}"`, ''];
    for (const t of tury) {
        if (czyBlad(t)) continue;
        if (t.hostA?.trim()) linie.push(`🔥 ISKRA: ${t.hostA.trim()}`);
        if (t.hostB?.trim()) linie.push(`🌊 ECHO: ${t.hostB.trim()}`);
    }
    return `${linie.join('\n')}\n`;
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
            WIEDZA_KATEDRY,
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
        // Pamięć: ostatnie 6 tur jako kontekst, żeby gospodarze NIE kręcili się w kółko.
        history = history.filter(t => !czyBlad(t));   // tura „rdzeń milczy" to nie wątek rozmowy
        const prior = history.slice(-6).map((t, i) => `[tura ${history.length - Math.min(6, history.length) + i + 1}] A: ${t.hostA}\nB: ${t.hostB}`).join('\n');
        const userPrompt =
            `TEMAT ODCINKA: "${context}"\n` +
            (prior
                ? `\nDOTYCHCZASOWA ROZMOWA (NIE powtarzaj tych wątków):\n${prior}\n` +
                  `\nWygeneruj KOLEJNĄ turę — POSUŃ rozmowę DO PRZODU, wprowadź NOWY aspekt tematu, nawiąż do poprzedniej wypowiedzi. (JSON)`
                : `\nWygeneruj PIERWSZĄ turę rozmowy — przywitajcie się i otwórzcie temat. (JSON)`);

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
                blad: true,
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
