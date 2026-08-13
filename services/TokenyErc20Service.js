/**
 * 🪙 TokenyErc20Service — portfel przestaje zaniżać stan posiadania.
 *
 * PROBLEM, KTÓRY TO ROZWIĄZUJE: `/api/wallet/portfolio` liczył WYŁĄCZNIE salda
 * natywne (ETH/MATIC/BNB). Wszystko, co Suweren trzyma w tokenach ERC-20, było
 * niewidzialne — a tę zaniżoną sumę dostawali Ted i Kronos jako obraz portfela.
 * Zła liczba na wejściu psuje każdy wniosek dalej.
 *
 * SUWERENNIE, BEZ KLUCZA API: pytamy te same publiczne RPC, których używa już
 * odczyt sald natywnych, wywołaniem `balanceOf(address)` (eth_call). Żadnego
 * Etherscana, żadnego konta, żadnego tokenu dostępowego.
 *
 * ⚠️ GRANICA, KTÓRĄ TRZEBA POWIEDZIEĆ GŁOŚNO: widzimy tylko te kontrakty,
 * o które zapytamy. Token spoza listy pozostaje niewidoczny — i właśnie
 * dlatego odpowiedź NIESIE `sprawdzono` oraz jawne ostrzeżenie. Zastąpienie
 * jednego cichego zaniżenia drugim byłoby gorsze niż brak zmiany, bo tym
 * razem suma wyglądałaby na kompletną.
 *
 * Kto trzyma coś egzotycznego — dokłada adres kontraktu ręcznie i jest widziany.
 */

/** Selektory funkcji ERC-20 (pierwsze 4 bajty keccak z sygnatury). */
const SEL_BALANCE_OF = '0x70a08231';
const SEL_DECIMALS   = '0x313ce567';
const SEL_SYMBOL     = '0x95d89b41';

/**
 * Znane tokeny per łańcuch. `dec` to WSKAZÓWKA — realną liczbę miejsc
 * czytamy z kontraktu w tym samym zapytaniu wsadowym i ona ma pierwszeństwo.
 * Dzięki temu pomyłka w tej tablicy nie zamienia się w fałszywe saldo.
 */
export const ZNANE_TOKENY = {
    eth: [
        { sym: 'USDT', adres: '0xdAC17F958D2ee523a2206206994597C13D831ec7', dec: 6,  cg: 'tether' },
        { sym: 'USDC', adres: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', dec: 6,  cg: 'usd-coin' },
        { sym: 'DAI',  adres: '0x6B175474E89094C44Da98b954EedeAC495271d0F', dec: 18, cg: 'dai' },
        { sym: 'WBTC', adres: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', dec: 8,  cg: 'wrapped-bitcoin' },
        { sym: 'WETH', adres: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', dec: 18, cg: 'weth' },
        { sym: 'LINK', adres: '0x514910771AF9Ca656af840dff83E8264EcF986CA', dec: 18, cg: 'chainlink' },
        { sym: 'UNI',  adres: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', dec: 18, cg: 'uniswap' },
        { sym: 'AAVE', adres: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', dec: 18, cg: 'aave' },
        { sym: 'SHIB', adres: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', dec: 18, cg: 'shiba-inu' },
    ],
    polygon: [
        { sym: 'USDT',   adres: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', dec: 6,  cg: 'tether' },
        { sym: 'USDC.e', adres: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', dec: 6,  cg: 'usd-coin' },
        { sym: 'DAI',    adres: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', dec: 18, cg: 'dai' },
        { sym: 'WETH',   adres: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', dec: 18, cg: 'weth' },
        { sym: 'WBTC',   adres: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', dec: 8,  cg: 'wrapped-bitcoin' },
    ],
    bsc: [
        { sym: 'USDT', adres: '0x55d398326f99059fF775485246999027B3197955', dec: 18, cg: 'tether' },
        { sym: 'USDC', adres: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', dec: 18, cg: 'usd-coin' },
        { sym: 'BUSD', adres: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', dec: 18, cg: 'binance-usd' },
        { sym: 'CAKE', adres: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', dec: 18, cg: 'pancakeswap-token' },
        { sym: 'ETH',  adres: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', dec: 18, cg: 'ethereum' },
    ],
};

/** Nazwy platform w CoinGecko — potrzebne do wyceny po adresie kontraktu. */
export const PLATFORMA_CG = {
    eth: 'ethereum',
    polygon: 'polygon-pos',
    bsc: 'binance-smart-chain',
};

/** Adres na 32-bajtowe słowo ABI (bez prefiksu, wyrównany zerami z lewej). */
function slowoAdresu(adres) {
    return adres.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

/**
 * Hex → liczba, z EXAKTNĄ częścią całkowitą.
 *
 * Dzielimy w BigInt i schodzimy na `Number` dopiero po rozbiciu na całość
 * i resztę, więc liczba jednostek przed przecinkiem jest dokładna (dopóki
 * mieści się w 2^53 — przy saldach portfela zawsze).
 *
 * Uczciwie o skali korzyści: przy saldach rzędu setek milionów tokenów
 * zmierzyliśmy, że naiwne `Number(BigInt(hex)) / 10**dec` daje TEN SAM wynik
 * (oba mają błąd względny ~1e-16). Ta wersja nie naprawia widocznej usterki —
 * daje gwarancję zamiast szczęścia i kosztuje trzy linijki.
 */
export function zHexNaLiczbe(hex, miejsca) {
    if (!hex || hex === '0x') return 0;
    let surowa;
    try { surowa = BigInt(hex); } catch { return 0; }
    if (surowa === 0n) return 0;
    const dzielnik = 10n ** BigInt(miejsca);
    const calosc = surowa / dzielnik;
    const reszta = surowa % dzielnik;
    return Number(calosc) + Number(reszta) / Number(dzielnik);
}

/** Odczyt `symbol()` — string ABI albo bytes32. Zwraca null, gdy nie da się odczytać. */
export function odczytajSymbol(hex) {
    if (!hex || hex === '0x') return null;
    const dane = hex.replace(/^0x/, '');
    try {
        // Wariant string: offset(32B) + długość(32B) + treść.
        if (dane.length >= 128) {
            const dlugosc = parseInt(dane.slice(64, 128), 16);
            if (dlugosc > 0 && dlugosc <= 32) {
                const tresc = dane.slice(128, 128 + dlugosc * 2);
                const s = Buffer.from(tresc, 'hex').toString('utf8').replace(/\0/g, '').trim();
                if (s) return s;
            }
        }
        // Wariant bytes32 (stare tokeny, np. MKR) — same znaki dopchane zerami.
        const s = Buffer.from(dane.slice(0, 64), 'hex').toString('utf8').replace(/\0/g, '').trim();
        return s || null;
    } catch { return null; }
}

/**
 * Zapytanie wsadowe JSON-RPC. Publiczne węzły to wspierają, a bez wsadu
 * odczyt 9 tokenów × 3 wywołania × N adresów to setki osobnych żądań —
 * publiczne RPC odcięłoby nas limitem, zanim cokolwiek policzymy.
 * Gdy węzeł nie zwróci tablicy, mówimy o tym wprost (rzucamy), zamiast
 * po cichu wpisać same zera i pokazać portfel jako pusty.
 */
async function wsad(rpc, wywolania, timeoutMs = 12_000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify(wywolania),
        });
        const txt = await r.text();
        if (!txt.trim().startsWith('[')) throw new Error('węzeł nie zwrócił odpowiedzi wsadowej');
        const odp = JSON.parse(txt);
        const wg = new Map();
        for (const o of odp) wg.set(o.id, o.result);
        return wg;
    } finally { clearTimeout(t); }
}

const wywolanie = (id, kontrakt, dane) => ({
    jsonrpc: '2.0', id, method: 'eth_call',
    params: [{ to: kontrakt, data: dane }, 'latest'],
});

/**
 * Salda tokenów jednego łańcucha dla listy adresów.
 * Zwraca pozycje z NIEZEROWYM saldem oraz liczbę realnie sprawdzonych kontraktów.
 */
export async function saldaTokenow(rpc, adresy, tokeny) {
    if (!tokeny.length || !adresy.length) return { pozycje: [], sprawdzono: 0 };

    const wywolania = [];
    const mapa = new Map();      // id → {token, adres, rodzaj}
    let id = 1;

    for (const t of tokeny) {
        // `decimals()` i `symbol()` pytamy RAZ na kontrakt, nie raz na adres.
        const idDec = id++; wywolania.push(wywolanie(idDec, t.adres, SEL_DECIMALS));
        mapa.set(idDec, { token: t, rodzaj: 'dec' });
        const idSym = id++; wywolania.push(wywolanie(idSym, t.adres, SEL_SYMBOL));
        mapa.set(idSym, { token: t, rodzaj: 'sym' });

        for (const a of adresy) {
            const idBal = id++;
            wywolania.push(wywolanie(idBal, t.adres, SEL_BALANCE_OF + slowoAdresu(a)));
            mapa.set(idBal, { token: t, adres: a, rodzaj: 'bal' });
        }
    }

    const wyniki = await wsad(rpc, wywolania);

    // Najpierw miejsca po przecinku i symbole — potrzebne do przeliczenia sald.
    const miejsca = new Map();
    const symbole = new Map();
    for (const [idW, meta] of mapa) {
        if (meta.rodzaj === 'dec') {
            const zLancucha = wyniki.get(idW);
            const d = zLancucha && zLancucha !== '0x' ? Number(BigInt(zLancucha)) : NaN;
            // Łańcuch ma pierwszeństwo nad naszą tablicą — pomyłka w liście
            // nie zamienia się wtedy w fałszywe saldo.
            miejsca.set(meta.token.adres, Number.isFinite(d) && d >= 0 && d <= 36 ? d : meta.token.dec);
        }
        if (meta.rodzaj === 'sym') {
            symbole.set(meta.token.adres, odczytajSymbol(wyniki.get(idW)) || meta.token.sym);
        }
    }

    const suma = new Map();      // adres kontraktu → saldo łączne (wszystkie adresy Suwerena)
    for (const [idW, meta] of mapa) {
        if (meta.rodzaj !== 'bal') continue;
        const dec = miejsca.get(meta.token.adres) ?? meta.token.dec;
        const ile = zHexNaLiczbe(wyniki.get(idW), dec);
        if (ile > 0) suma.set(meta.token.adres, (suma.get(meta.token.adres) || 0) + ile);
    }

    const pozycje = [...suma.entries()].map(([adres, saldo]) => ({
        adres,
        symbol: symbole.get(adres) || '?',
        miejsca: miejsca.get(adres),
        saldo,
    }));

    return { pozycje, sprawdzono: tokeny.length };
}

/**
 * Wycena tokenów po adresie kontraktu (CoinGecko). Brak ceny NIE jest błędem —
 * token bez notowania nadal ma być widoczny w portfelu, tylko bez wartości.
 * Ukrycie go byłoby powrotem do tego samego grzechu, który tu naprawiamy.
 */
/**
 * Ceny znanych tokenów JEDNYM zapytaniem, po identyfikatorach CoinGecko.
 *
 * ⚠️ TO JEST DROGA GŁÓWNA, a `cenyTokenow` (po adresie kontraktu) tylko awaryjna.
 * Zmierzone: portfel z 14 tokenami to 14 osobnych zapytań po kontrakcie, czyli
 * pewny limit na darmowym planie i suma zaniżona o wszystko, co nie zdążyło.
 * Endpoint `simple/price?ids=` przyjmuje wiele identyfikatorów naraz — jedno
 * zapytanie na cały portfel, ten sam, którym liczymy salda natywne.
 */
export async function cenyPoId(identyfikatory, waluta = 'eur') {
    const wynik = { ceny: {}, limit: false };
    const ids = [...new Set(identyfikatory.filter(Boolean))];
    if (!ids.length) return wynik;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
        const r = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${waluta}`,
            { signal: ctrl.signal });
        if (r.status === 429) { wynik.limit = true; return wynik; }
        if (!r.ok) return wynik;
        const d = await r.json();
        for (const [id, v] of Object.entries(d || {})) {
            const cena = v?.[waluta];
            if (cena != null) wynik.ceny[id] = cena;
        }
        return wynik;
    } catch { return wynik; }
    finally { clearTimeout(t); }
}

export async function cenyTokenow(platforma, adresy, waluta = 'eur') {
    const wynik = { ceny: {}, nieudane: [], limit: false };
    if (!platforma || !adresy.length) return wynik;

    // ⚠️ ZMIERZONE 2026-08-13, nie zgadnięte: darmowy plan CoinGecko przyjmuje
    // DOKŁADNIE JEDEN adres kontraktu na zapytanie (błąd 10012, HTTP 400).
    // Zbiorcze `contract_addresses=a,b,c` — czyli pierwsza, oczywista wersja
    // tego kodu — nie zwracało ani jednej ceny. Stąd pętla po jednym.
    for (const adres of adresy) {
        const url = `https://api.coingecko.com/api/v3/simple/token_price/${platforma}`
            + `?contract_addresses=${adres}&vs_currencies=${waluta}`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        try {
            const r = await fetch(url, { signal: ctrl.signal });
            if (r.status === 429) {
                // Limit zapytań. Przerywamy i MELDUJEMY — dalsze próby i tak
                // odpadną, a cicha zerowa cena zaniżyłaby sumę portfela
                // dokładnie tak, jak robił to brak tokenów w ogóle.
                wynik.limit = true;
                wynik.nieudane.push(adres);
                break;
            }
            if (!r.ok) { wynik.nieudane.push(adres); continue; }
            const d = await r.json();
            for (const [k, v] of Object.entries(d || {})) {
                const cena = v?.[waluta];
                if (cena != null) wynik.ceny[k.toLowerCase()] = cena;
            }
            if (wynik.ceny[adres.toLowerCase()] == null) wynik.nieudane.push(adres);
        } catch {
            wynik.nieudane.push(adres);
        } finally { clearTimeout(t); }
    }
    return wynik;
}

export default { ZNANE_TOKENY, PLATFORMA_CG, saldaTokenow, cenyTokenow, cenyPoId, zHexNaLiczbe, odczytajSymbol };
