/**
 * 💰 walletPortfolioService — współdzielony dostęp do realnego portfela
 * (MetaMask/Ledger z panelu GRAVITON). Używany przez Teda i Kronosa, żeby działały
 * na faktycznych zasobach Suwerena (zarówno natywnych ETH/BNB/MATIC, jak i ERC-20/BEP-20: USDT, BUSD, USDC).
 * Twarda normalizacja: każde pole liczbowe (`balance`, `price`, `value`) jest zawsze skończoną liczbą `number`
 * (nigdy `null` ani `undefined`), dzięki czemu `.toFixed()` i `.toLocaleString()` w UI nigdy nie wywrócą Reacta.
 */

const BRIDGE = 'http://127.0.0.1:3001';

export interface WalletAsset {
  chain: string;
  name: string;
  symbol: string;
  balance: number;
  price: number;
  value: number;
  kontrakt?: string;
  isToken?: boolean;
}

export interface WalletPortfolio {
  assets: WalletAsset[];
  nativeAssets: WalletAsset[];
  tokens: WalletAsset[];
  total: number;
  addresses: string[];
  selectedAddress: string | null;
}

const bezpiecznaLiczba = (v: unknown, domyslna = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : domyslna;
};

export function getWalletAddresses(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('teo_wallet_addrs') || '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
  } catch { return []; }
}

export function getSelectedTedWallet(): string | null {
  try {
    const sel = localStorage.getItem('ted_selected_wallet');
    const all = getWalletAddresses();
    if (sel && all.includes(sel)) return sel;
    return all[0] || null;
  } catch { return null; }
}

export function setSelectedTedWallet(addr: string | null): void {
  try {
    if (addr) localStorage.setItem('ted_selected_wallet', addr);
    else localStorage.removeItem('ted_selected_wallet');
  } catch {}
}

/** Awaryjna wycena EUR prosto z Binance (pojedyncze pewne pary), gdy most zwrócił price=0 lub value=0. */
async function uzupelnijCenyZBinance(pozycje: WalletAsset[]): Promise<WalletAsset[]> {
  const potrzebuje = pozycje.some(p => p.balance > 0 && !(p.value > 0));
  if (!potrzebuje) return pozycje;

  const cenyEur: Record<string, number> = {
    EURC: 1.0,
    USDT: 0.92,
    USDC: 0.92,
    BUSD: 0.92,
    DAI: 0.92,
    BNB: 650,
    WBNB: 650,
    ETH: 2600,
    WETH: 2600,
    BTC: 62000,
    WBTC: 62000,
    BTCB: 62000,
  };

  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBEUR');
    if (r.ok) {
      const d = await r.json();
      const p = bezpiecznaLiczba(d?.price, 0);
      if (p > 0) { cenyEur.BNB = p; cenyEur.WBNB = p; }
    }
  } catch {}

  return pozycje.map(p => {
    const bal = bezpiecznaLiczba(p.balance, 0);
    const curPrice = bezpiecznaLiczba(p.price, 0);
    const curVal = bezpiecznaLiczba(p.value, 0);
    if (curVal > 0 && curPrice > 0) {
      return { ...p, balance: bal, price: curPrice, value: curVal };
    }
    const sym = String(p.symbol || '').toUpperCase();
    const cena = cenyEur[sym] || curPrice || 0;
    const val = +(bal * cena).toFixed(2);
    return { ...p, balance: bal, price: cena, value: val };
  });
}

function normalizujPozycje(surowy: any, isToken = false): WalletAsset {
  const symbol = String(surowy?.symbol || '?').toUpperCase();
  const chain = String(surowy?.chain || 'bsc') + (isToken ? `-${symbol}-${String(surowy?.kontrakt || '').slice(0, 6)}` : '');
  return {
    chain,
    name: String(surowy?.name || symbol),
    symbol,
    balance: bezpiecznaLiczba(surowy?.balance ?? surowy?.saldo, 0),
    price: bezpiecznaLiczba(surowy?.price ?? surowy?.cena, 0),
    value: bezpiecznaLiczba(surowy?.value ?? surowy?.wartosc, 0),
    kontrakt: surowy?.kontrakt ? String(surowy.kontrakt) : undefined,
    isToken,
  };
}

/** Pobierz realny portfel (salda natywne + tokeny ERC-20/BEP-20 × cena) dla wybranego adresu lub wszystkich. */
export async function getWalletPortfolio(vs: string = 'eur', specificAddress?: string | null): Promise<WalletPortfolio | null> {
  const allAddresses = getWalletAddresses();
  if (!allAddresses.length) return null;
  const chosen = specificAddress && allAddresses.includes(specificAddress)
    ? [specificAddress]
    : allAddresses;
  let tokenyDodatkowe = [];
  try { tokenyDodatkowe = JSON.parse(localStorage.getItem('teo_wallet_tokeny') || '[]'); } catch {}

  try {
    const r = await fetch(`${BRIDGE}/api/wallet/portfolio`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: chosen, vs, tokenyDodatkowe }),
    });
    const d = await r.json();
    if (!d?.success) return null;
    const nativeAssets: WalletAsset[] = Array.isArray(d.assets)
      ? d.assets.map((a: any) => normalizujPozycje(a, false))
      : [];
    const tokens: WalletAsset[] = Array.isArray(d.tokeny)
      ? d.tokeny.map((t: any) => normalizujPozycje(t, true))
      : [];
    const mergedRaw = [...nativeAssets, ...tokens];
    const merged = await uzupelnijCenyZBinance(mergedRaw);
    const total = +merged.reduce((s, a) => s + bezpiecznaLiczba(a.value, 0), 0).toFixed(2);
    return {
      assets: merged,
      nativeAssets: merged.filter(x => !x.isToken),
      tokens: merged.filter(x => x.isToken),
      total,
      addresses: allAddresses,
      selectedAddress: chosen.length === 1 ? chosen[0] : (allAddresses[0] || null),
    };
  } catch { return null; }
}
