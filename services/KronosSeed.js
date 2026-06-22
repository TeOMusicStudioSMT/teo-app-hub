/**
 * 🔮 KronosSeed — Nasiono Rynkowe (lokalna projekcja świec K-line)
 *
 * Lekka, LOKALNA emulacja prognozy w duchu modelu Kronos (Foundation Model
 * for Financial Markets). NIE pobiera nic z chmury — generuje deterministyczną
 * (seedowaną) projekcję sekwencji świecowej OHLC na bazie ostatniej ceny,
 * momentum i zmienności wyliczonych z historii.
 *
 * To „Nasiono": w wersji Live-USB startuje jako lekki seed i — gdy obecny jest
 * prawdziwy lokalny model Kronos (Python/Qlib) — można podmienić `forecast()`
 * na wywołanie `KronosPredictor.predict_batch`. Tu domyślnie: projekcja seed.
 *
 * Zwraca świece + stożek ufności (upper/lower) rozszerzający się z horyzontem.
 */

// Deterministyczny PRNG (mulberry32) — ta sama historia → ta sama projekcja.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function seedFrom(symbol, lastPrice) {
    let h = 2166136261;
    const s = `${symbol}:${Math.round(lastPrice * 100)}`;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

// Box-Muller dla szumu gaussowskiego z PRNG.
function gauss(rnd) {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * @param {object} opt
 *   symbol:string, lastPrice:number, history?:number[] (ostatnie close, stare→nowe),
 *   predLen?:number (ile świec naprzód, domyślnie 24), intervalLabel?:string
 * @returns {{model:string, symbol:string, lastPrice:number, predLen:number,
 *            drift:number, volatility:number, candles:Array, band:Array, verdict:string}}
 */
export function forecast(opt = {}) {
    const symbol    = String(opt.symbol || 'ASSET').toUpperCase();
    const lastPrice = Number(opt.lastPrice) > 0 ? Number(opt.lastPrice) : 100;
    const predLen   = Math.max(4, Math.min(96, Number(opt.predLen) || 24));
    const history   = Array.isArray(opt.history) ? opt.history.filter(n => Number(n) > 0) : [];

    // Drift (momentum) i zmienność z historii — albo łagodne domyślne.
    let drift = 0, vol = 0.012;
    if (history.length >= 3) {
        const rets = [];
        for (let i = 1; i < history.length; i++) rets.push(Math.log(history[i] / history[i - 1]));
        const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
        const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
        drift = mean * 0.6;                              // tłumiony momentum (mean-reversion)
        vol   = Math.max(0.004, Math.min(0.08, Math.sqrt(variance)));
    }

    const rnd = mulberry32(seedFrom(symbol, lastPrice));
    const candles = [];
    const band = [];
    let price = lastPrice;

    for (let i = 0; i < predLen; i++) {
        const open = price;
        const shock = gauss(rnd) * vol;
        // Lekka mean-reversion do ceny startowej, by projekcja nie uciekała.
        const pull = (lastPrice - price) / lastPrice * 0.05;
        const ret  = drift + pull + shock;
        const close = Math.max(0.0000001, open * (1 + ret));
        const hi = Math.max(open, close) * (1 + Math.abs(gauss(rnd)) * vol * 0.5);
        const lo = Math.min(open, close) * (1 - Math.abs(gauss(rnd)) * vol * 0.5);
        candles.push({
            i,
            open:  +open.toFixed(6),
            high:  +hi.toFixed(6),
            low:   +lo.toFixed(6),
            close: +close.toFixed(6),
            up:    close >= open,
        });
        // Stożek ufności: ±k·vol·√horyzont
        const cone = lastPrice * vol * Math.sqrt(i + 1) * 1.96;
        band.push({ i, upper: +(close + cone).toFixed(6), lower: +Math.max(0, close - cone).toFixed(6) });
        price = close;
    }

    const projChange = (candles[candles.length - 1].close - lastPrice) / lastPrice;
    const verdict = projChange > 0.03 ? 'WZROST' : projChange < -0.03 ? 'SPADEK' : 'KONSOLIDACJA';

    return {
        model: 'Kronos-Seed (lokalna projekcja · Nasiono Rynkowe)',
        symbol, lastPrice, predLen,
        drift:      +drift.toFixed(6),
        volatility: +vol.toFixed(6),
        projChangePct: +(projChange * 100).toFixed(2),
        candles, band, verdict,
    };
}

export default { forecast };
