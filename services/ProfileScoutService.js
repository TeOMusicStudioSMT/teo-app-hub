/**
 * 🧭 ProfileScoutService — Menedżer AI & Pralka Świadomości (Optimized Earnings Engine)
 *
 * Analizuje profil pasji Suwerena i mapuje go na zewnętrzne mikrousługi API,
 * które realnie generują przychód. Zintegrowany z PRALKĄ ŚWIADOMOŚCI — silnikiem,
 * który BEZWZGLĘDNIE odrzuca nierealistyczne, marnujące energię iluzje i skupia
 * się wyłącznie na surowych, technicznych osiągach oraz automatycznym wdrażaniu
 * narzędzi przychodowych.
 *
 * Wejście: profil (tekst pasji / kompetencji Suwerena).
 * Wyjście: { verdict, tools[], rejected[] } — twarda, inżynierska mapa przychodu.
 *
 * Standard ESM · Singleton · Ollama gemma4 (lokalnie, timeout 300s pod VRAM).
 */

const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
const MODEL      = 'gemma4';
const TIMEOUT_MS = 300_000;  // VRAM Breathing v2

// ── PRALKA ŚWIADOMOŚCI — bezwzględny prompt systemowy ──────────────────────────
const PRALKA_SYSTEM =
    'Jesteś PRALKĄ ŚWIADOMOŚCI — bezlitosnym silnikiem optymalizacji przychodu Katedry 0.00G. ' +
    'Twoja jedyna funkcja: zamienić pasje Suwerena w działające, generujące przychód mikrousługi.\n' +
    'ŻELAZNE ZASADY:\n' +
    '1. BEZWZGLĘDNIE ODRZUCAJ nierealistyczne, magiczne i marnujące energię iluzje. ' +
    'Jeśli pomysł nie ma technicznej drogi wdrożenia w ≤30 dni przy użyciu istniejących API — odrzuć go jako ILUZJĘ.\n' +
    '2. Skupiaj się WYŁĄCZNIE na surowych, technicznych osiągach: konkretne API, automatyzacja, mierzalny przychód.\n' +
    '3. Dla każdej realnej pasji wskaż: nazwę narzędzia, konkretną usługę/API, wymagane klucze ze Skarbca, ' +
    'sposób automatycznego wdrożenia oraz realność (realityScore 0-100).\n' +
    '4. Zero pustego entuzjazmu, zero coachingu, zero afirmacji. Tylko inżynieria przychodu.\n' +
    'Odpowiadaj WYŁĄCZNIE w formacie JSON (bez markdown, bez komentarzy):\n' +
    '{"verdict":"krótki, twardy werdykt",' +
    '"tools":[{"name":"...","service":"...","apiNeeded":"...","vaultKey":"github_bridge|ollama_ecosystem|voice_cloning|anthropic|gemini",' +
    '"automation":"jak wdrożyć automatycznie","revenue":"szacowany model przychodu","realityScore":0}],' +
    '"rejected":[{"illusion":"odrzucony pomysł","reason":"techniczny powód odrzucenia"}]}';

class ProfileScoutServiceClass {
    constructor() {
        console.log('[ProfileScout] 🧭 Menedżer AI & Pralka Świadomości aktywny.');
    }

    /**
     * Przeskanuj profil pasji i zmapuj na przychodowe mikrousługi.
     * @param {string} profile  Opis pasji / kompetencji Suwerena.
     * @returns {Promise<{verdict, tools, rejected, raw?}>}
     */
    async scan(profile) {
        const input = String(profile || '').trim();
        if (!input) throw new Error('Pusty profil — brak czego skanować.');

        const prompt =
            `PROFIL PASJI SUWERENA:\n"${input.slice(0, 2000)}"\n\n` +
            `Zmapuj realne pasje na przychodowe mikrousługi. Odrzuć iluzje. Zwróć czysty JSON.`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const resp = await fetch(OLLAMA_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                signal:  controller.signal,
                body: JSON.stringify({
                    model:   MODEL,
                    system:  PRALKA_SYSTEM,
                    prompt,
                    stream:  false,
                    options: { temperature: 0.4 },  // niska temp = twarda, techniczna analiza
                }),
            });

            if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status} — model "${MODEL}"?`);
            const data = await resp.json();
            return this._parse(data.response || '');

        } catch (e) {
            // Ten sam protokół rzetelności co u Mechanika: abort mówi „nie zdążyło",
            // a nie „to VRAM". Podajemy fakt (limit) i hipotezy jako hipotezy.
            const aborted = e.name === 'AbortError';
            throw new Error(aborted
                ? `Pralka Świadomości: model "${MODEL}" nie odpowiedział w limicie 300s. ` +
                  'HIPOTEZY (niezweryfikowane): zimny start modelu, Ollama nie nadąża, ' +
                  'model niepobrany lub za mało wolnej pamięci. Sprawdź: "ollama ps".'
                : `Pralka Świadomości: ${e.message}`);
        } finally {
            clearTimeout(timer);
        }
    }

    /** Parsowanie JSON z fallbackiem (Gemma czasem dokleja preambułę). */
    _parse(raw) {
        try {
            const match  = raw.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(match ? match[0] : raw);
            return {
                verdict:  parsed.verdict  || 'Brak werdyktu.',
                tools:    Array.isArray(parsed.tools)    ? parsed.tools    : [],
                rejected: Array.isArray(parsed.rejected) ? parsed.rejected : [],
            };
        } catch {
            // Fallback: model nie zwrócił JSON — oddaj surowy werdykt
            return {
                verdict:  raw.slice(0, 400) || 'Pralka nie zwróciła czytelnej analizy.',
                tools:    [],
                rejected: [],
                raw:      true,
            };
        }
    }
}

let _instance = null;
export default {
    getInstance() {
        if (!_instance) _instance = new ProfileScoutServiceClass();
        return _instance;
    },
};
