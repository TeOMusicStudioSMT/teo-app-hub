/**
 * 💱 Ceny Rynku — jedna furtka do CoinGecko dla całej Katedry.
 *
 * Suweren (2026-09-29): „po tych zmianach znikły aktualne ceny krypto… a że się zmienił numer [portu]…".
 * Ticker pytał CoinGecko prosto z przeglądarki, co minutę, z KAŻDEJ otwartej karty i każdej kopii Hubu
 * (5173, 5174, 5175, 5176…). Darmowe API CoinGecko ma limit na adres IP — po jego przekroczeniu odpowiada 429
 * bez nagłówków CORS, przeglądarka zgłasza błąd sieci i karta zostaje z pustym „$".
 *
 * Tu: most pyta RAZ na minutę na zestaw monet, wszystkie karty dostają to samo z pamięci; gdy CoinGecko
 * odmówi, oddajemy OSTATNIE PRAWDZIWE ceny z datą (`nieaktualne: true`) — nigdy zmyślone.
 */

const URL_CENY = 'https://api.coingecko.com/api/v3/simple/price';
const TTL_MS = 60_000;
const ID = /^[a-z0-9-]{1,60}$/;
const WALUTA = /^[a-z]{3,4}$/;

let cfg = { fetch: (...a) => globalThis.fetch(...a), teraz: () => Date.now() };
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

/** klucz → { at (ostatnia próba), okAt (ostatnie prawdziwe ceny), ceny, blad, trwa } */
const pamiec = new Map();

export function wyczysc() { pamiec.clear(); }

/**
 * @param {{ ids: string[]|string, vs?: string }} p
 * @returns {Promise<{ ceny: Record<string, number>, vs: string, kiedy: string|null, nieaktualne: boolean, blad: string|null }>}
 */
export async function ceny({ ids, vs = 'usd' }) {
    const lista = [...new Set((Array.isArray(ids) ? ids : String(ids ?? '').split(','))
        .map((x) => String(x).trim().toLowerCase()).filter(Boolean))].sort();
    const waluta = String(vs).toLowerCase();
    if (!lista.length || lista.length > 30 || !lista.every((x) => ID.test(x))) throw new Error('Podaj od 1 do 30 identyfikatorów CoinGecko (np. bitcoin,ethereum).');
    if (!WALUTA.test(waluta)) throw new Error('Zła waluta (np. usd, eur, pln).');

    const klucz = `${waluta}:${lista.join(',')}`;
    const wpis = pamiec.get(klucz) ?? { at: 0, ceny: null, blad: null, trwa: null };
    pamiec.set(klucz, wpis);

    if (cfg.teraz() - wpis.at >= TTL_MS) {
        // Jedno zapytanie naraz na klucz — dziesięć kart w tej samej sekundzie to wciąż jedno pytanie do CoinGecko.
        wpis.trwa ??= (async () => {
            try {
                const r = await cfg.fetch(`${URL_CENY}?ids=${lista.join(',')}&vs_currencies=${waluta}`, { signal: AbortSignal.timeout(10_000) });
                if (!r.ok) throw new Error(r.status === 429 ? 'CoinGecko: limit zapytań (429) — spróbuję za minutę' : `CoinGecko: HTTP ${r.status}`);
                const d = await r.json();
                const nowe = {};
                for (const id of lista) if (typeof d?.[id]?.[waluta] === 'number') nowe[id] = d[id][waluta];
                if (!Object.keys(nowe).length) throw new Error('CoinGecko nie zwrócił cen dla tych monet');
                wpis.ceny = nowe;
                wpis.okAt = cfg.teraz();
                wpis.blad = null;
            } catch (e) {
                wpis.blad = String(e?.message || e);
            } finally {
                // Także po błędzie — nie młotkujemy CoinGecko, gdy już odmówił.
                wpis.at = cfg.teraz();
                wpis.trwa = null;
            }
        })();
        await wpis.trwa;
    }
    return {
        ceny: wpis.ceny ?? {},
        vs: waluta,
        kiedy: wpis.ceny ? new Date(wpis.okAt).toISOString() : null,
        nieaktualne: Boolean(wpis.blad && wpis.ceny),
        blad: wpis.blad,
    };
}

export default { ceny, skonfiguruj, wyczysc };
