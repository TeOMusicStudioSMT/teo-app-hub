/**
 * ⚖️ Jev (TypeSafe) — sędzia semantyczny z chmury (Suweren 2026-10-08: „kolejna opcja chmury… JEV… do czego
 * może się przydać”). To NIE czat-model: odpowiada liczbą na typowane pytania — `noul` (tak/nie → p(tak)),
 * `choice` (jedna z opcji + prawdopodobieństwa), `score` (rubryka 2–10 poziomów). Szybki (~150 ms) i tani.
 * API: POST https://api.typesafe.ai/v1/systemone, `Authorization: Bearer <apikey_…>`, model `jev-latest`.
 * Dokumentacja: https://docs.typesafe.ai/api.md
 *
 * W Katedrze pierwsze użycie: Sędzia zadania w Kodeksie (AppStudio) — „czy te zmiany REALIZUJĄ zadanie?”;
 * Kustosz 2026-10-07 dostał ptaszek bez wywołania mostu, bo żaden sędzia nie pytał o sens zmian.
 * Bez klucza = null (sędzia pominięty, nic nie udajemy).
 */

export const BAZA = process.env.OTAKOS_JEV_URL || 'https://api.typesafe.ai/v1';
export const MODEL = process.env.OTAKOS_JEV_MODEL || 'jev-latest';
/** Poniżej tego p(tak) runda Kodeksa wraca: „zadanie wygląda na niezrobione”. */
export const PROG_ZROBIONE = Number(process.env.OTAKOS_JEV_PROG) || 0.35;

/**
 * @param {{ klucz: () => string|null, fetch?: Function, teraz?: () => number }} o
 */
export function utworzJev({ klucz, fetch: f = globalThis.fetch, teraz = () => Date.now() }) {
    const licznik = { dzien: null, tokeny: 0, wywolan: 0, ostatniBlad: null };
    const dzis = () => new Date(teraz()).toISOString().slice(0, 10);

    /** Surowe zapytanie: { state, questions } → { model, answers, usage }. Błąd HTTP = wyjątek z kodem. */
    async function zapytaj({ state, questions, model = MODEL, limitMs = 30_000 }) {
        const k = klucz();
        if (!k) throw Object.assign(new Error('Brak klucza TypeSafe (Jev) — Kibel → „🔗 Udostępnij mostowi”.'), { kod: 'BEZ_KLUCZA' });
        const r = await f(`${BAZA}/systemone`, {
            method: 'POST', signal: AbortSignal.timeout(limitMs),
            headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ state, model, questions }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
            const powod = { 401: 'zły albo nieważny klucz', 422: 'zapytanie odrzucone przez walidację', 429: 'limit zapytań — za chwilę', 529: 'Jev przeciążony — za chwilę' }[r.status] ?? '';
            const e = new Error(`Jev HTTP ${r.status}${powod ? ` (${powod})` : ''}: ${JSON.stringify(d).slice(0, 200)}`);
            licznik.ostatniBlad = e.message;
            throw e;
        }
        if (licznik.dzien !== dzis()) { licznik.dzien = dzis(); licznik.tokeny = 0; licznik.wywolan = 0; }
        licznik.tokeny += (d.usage?.input_tokens || 0) + (d.usage?.output_tokens || 0);
        licznik.wywolan++;
        return d;
    }

    /**
     * Czy zmiany w kodzie realizują zadanie? → { p, model } (p = prawdopodobieństwo „tak”) albo null bez klucza.
     * `zmiany` — diff + nowe pliki (przycięte), `zadanie` — treść zlecenia.
     */
    async function czyZrobione({ zadanie, zmiany }) {
        if (!klucz()) return null;
        const d = await zapytaj({
            state: { zadanie: String(zadanie).slice(0, 4000), zmiany_w_kodzie: String(zmiany).slice(0, 24_000) },
            questions: {
                zrobione: {
                    type: 'noul',
                    instructions: 'Czy zmiany w kodzie gry naprawdę REALIZUJĄ zadanie — wszystkie jego kluczowe elementy (np. wywołanie wskazanej trasy, okno, zachowanie, postać), a nie tylko część albo coś obok?',
                    criteria: {
                        true: 'Kod wykonuje to, o co prosi zadanie: każdy wymieniony w zadaniu element ma w zmianach działający odpowiednik.',
                        false: 'Brakuje kluczowej części zadania (np. tylko wczytanie bryły bez logiki, brak wywołania wskazanej trasy) albo zmiany robią coś innego niż zadanie.',
                    },
                },
            },
        });
        return { p: Number(d.answers?.zrobione?.noul ?? NaN), model: d.model };
    }

    return { zapytaj, czyZrobione, stan: () => ({ maKlucz: !!klucz(), dzis: { ...licznik } }) };
}

export default { utworzJev, BAZA, MODEL, PROG_ZROBIONE };
