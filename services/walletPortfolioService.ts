/**
 * 💰 walletPortfolioService — współdzielony dostęp do realnego portfela
 * (MetaMask/Ledger read-only). Używany przez Teda i Kronosa, żeby działały
 * na faktycznych zasobach Suwerena. Adresy z localStorage ('teo_wallet_addrs').
 */

const BRIDGE = 'http://127.0.0.1:3001';

export interface WalletAsset { chain: string; name: string; symbol: string; balance: number; price: number; value: number; }
export interface WalletPortfolio { assets: WalletAsset[]; total: number; addresses: string[]; }

export function getWalletAddresses(): string[] {
  try { return JSON.parse(localStorage.getItem('teo_wallet_addrs') || '[]'); } catch { return []; }
}

/** Pobierz realny portfel (saldo natywne × cena). Null gdy brak adresów / most offline. */
export async function getWalletPortfolio(vs: string = 'eur'): Promise<WalletPortfolio | null> {
  const addresses = getWalletAddresses();
  if (!addresses.length) return null;
  try {
    const r = await fetch(`${BRIDGE}/api/wallet/portfolio`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses, vs }),
    });
    const d = await r.json();
    if (!d.success) return null;
    return { assets: d.assets || [], total: d.total || 0, addresses };
  } catch { return null; }
}
