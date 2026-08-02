/**
 * 🗺️ MapaSektorowService — co się z czym rusza (0.00G)
 *
 * Korelacje LICZONE Z DANYCH, nie zgadywane. Jedno wywołanie CoinGecko daje
 * 7 dni notowań godzinowych dla kilkunastu aktywów naraz (sparkline), z czego
 * liczymy zwroty logarytmiczne i macierz korelacji Pearsona.
 *
 * PO CO TO KOMU: w krypto prawie wszystko chodzi za Bitcoinem, więc „portfel
 * z pięciu monet" bywa jedną pozycją w pięciu przebraniach. Ta mapa pokazuje,
 * co faktycznie porusza się osobno — czyli gdzie dywersyfikacja jest realna,
 * a gdzie tylko pozorna.
 *
 * UCZCIWOŚĆ WPISANA W MODUŁ:
 *  • Korelacja to NIE przyczynowość i NIE prognoza. Mówi, co działo się razem
 *    w danym oknie — nie, co będzie.
 *  • Okno 7 dni to migawka. Korelacje w krypto potrafią się przewrócić w tydzień.
 *  • Liczba próbek jest podawana wprost, żeby było widać wagę wyniku.
 */

const URL_RYNKI = 'https://api.coingecko.com/api/v3/coins/markets';

/** Sektory — przypisanie jawne, żeby dało się je zakwestionować i poprawić. */
export const SEKTORY = {
    'Warstwa 1':  ['bitcoin', 'ethereum', 'solana', 'cardano', 'avalanche-2', 'polkadot'],
    'DeFi/Infra': ['chainlink', 'uniswap', 'aave'],
    'Płatności':  ['ripple', 'litecoin', 'stellar'],
    'Memy':       ['dogecoin', 'shiba-inu'],
};

const WSZYSTKIE = Object.values(SEKTORY).flat();
const sektorDla = (id) => Object.entries(SEKTORY).find(([, ids]) => ids.includes(id))?.[0] ?? 'Inne';

const CACHE_TTL_MS = 15 * 60_000;   // 15 min — dane godzinowe i tak nie zmieniają się szybciej
let cache = { at: 0, dane: null };

/** Zwroty logarytmiczne z szeregu cen. Odporne na skalę — BTC i DOGE porównywalne. */
function zwrotyLog(ceny) {
    const out = [];
    for (let i = 1; i < ceny.length; i++) {
        const a = ceny[i - 1], b = ceny[i];
        if (a > 0 && b > 0) out.push(Math.log(b / a));
    }
    return out;
}

/** Korelacja Pearsona. Zwraca null, gdy któryś szereg jest płaski (zero wariancji). */
export function korelacja(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return null;
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
    const mx = sx / n, my = sy / n;
    let licz = 0, wx = 0, wy = 0;
    for (let i = 0; i < n; i++) {
        const dx = x[i] - mx, dy = y[i] - my;
        licz += dx * dy; wx += dx * dx; wy += dy * dy;
    }
    if (wx === 0 || wy === 0) return null;
    return licz / Math.sqrt(wx * wy);
}

/** Pobierz notowania i policz mapę. */
export async function zbudujMape({ odswiez = false } = {}) {
    if (!odswiez && cache.dane && Date.now() - cache.at < CACHE_TTL_MS) {
        return { ...cache.dane, zCache: true };
    }

    const url = `${URL_RYNKI}?vs_currency=usd&ids=${WSZYSTKIE.join(',')}` +
                '&order=market_cap_desc&sparkline=true&price_change_percentage=24h';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    let surowe;
    try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
        surowe = await res.json();
        if (!Array.isArray(surowe)) throw new Error('CoinGecko zwróciło nieoczekiwany kształt');
    } finally { clearTimeout(timer); }

    // Aktywa z użyteczną historią. Braki NIE są przemilczane — trafiają do raportu.
    const aktywa = [];
    const pominiete = [];
    for (const c of surowe) {
        const ceny = c?.sparkline_in_7d?.price;
        if (!Array.isArray(ceny) || ceny.length < 24) {
            pominiete.push({ id: c?.id, powod: `za krótka historia (${ceny?.length ?? 0} punktów)` });
            continue;
        }
        aktywa.push({
            id: c.id,
            symbol: String(c.symbol || '').toUpperCase(),
            nazwa: c.name,
            sektor: sektorDla(c.id),
            cena: c.current_price,
            zmiana24h: c.price_change_percentage_24h ?? null,
            zwroty: zwrotyLog(ceny),
        });
    }
    for (const id of WSZYSTKIE) {
        if (!surowe.some(c => c.id === id)) pominiete.push({ id, powod: 'brak w odpowiedzi CoinGecko' });
    }

    // Macierz korelacji.
    const macierz = aktywa.map(a => aktywa.map(b => {
        const r = korelacja(a.zwroty, b.zwroty);
        return r === null ? null : +r.toFixed(3);
    }));

    // Korelacja z BTC — w krypto to najważniejsza pojedyncza liczba.
    const iBtc = aktywa.findIndex(a => a.id === 'bitcoin');
    const wobecBtc = iBtc < 0 ? [] : aktywa
        .map((a, i) => ({ symbol: a.symbol, sektor: a.sektor, r: macierz[iBtc][i] }))
        .filter(x => x.symbol !== 'BTC' && x.r !== null)
        .sort((a, b) => a.r - b.r);   // najmniej skorelowane na górze — tam jest realna dywersyfikacja

    const probek = Math.min(...aktywa.map(a => a.zwroty.length));

    const dane = {
        aktywa: aktywa.map(({ zwroty, ...reszta }) => ({ ...reszta, probek: zwroty.length })),
        macierz,
        wobecBtc,
        pominiete,
        probek,
        okno: '7 dni · notowania godzinowe',
        policzonoO: new Date().toISOString(),
        // Podpis wędruje z danymi, żeby żaden konsument API nie wziął tego za sygnał.
        charakter: 'STATYSTYKA OPISOWA OKNA 7 DNI',
        disclaimer: 'Korelacja opisuje, co poruszało się razem w tym oknie. To nie jest ' +
                    'przyczynowość ani prognoza — w krypto zależności potrafią się odwrócić w tydzień. ' +
                    'Nie stanowi porady inwestycyjnej.',
    };

    cache = { at: Date.now(), dane };
    return { ...dane, zCache: false };
}

export default { SEKTORY, zbudujMape, korelacja };
