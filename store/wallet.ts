
import { atom } from 'jotai';
import { WalletState } from '../types';
import { calculateRevenueSplit, createISO20022Message } from '../lib/graviton/economics';
import { v4 as uuidv4 } from 'uuid';

// --- GRV Energy Atom (Obfitość Ludzkości) ---
// Domyślna wartość: 8.000.000.000 GRV (symbol potencjału ludzkości)
// Ta energia jest "uśpiona" dopóki użytkownik nie włoży kluczy do Kibla
export const grvEnergyAtom = atom<{
    total: number;        // Całkowita energia (8Mrd)
    active: number;       // Aktywna energia (do wykorzystania po włożeniu kluczy)
    unlocked: boolean;    // Czy klucze zostały włożone do Kibla
    lastActivity: number; // Timestamp ostatniej aktywności
}>({
    total: 8000000000,     // 8.000.000.000 GRV - OBFFITOŚĆ!
    active: 0,            // 0 dopóki nie odblokowane
    unlocked: false,      // Domyślnie zablokowane
    lastActivity: Date.now(),
});

// --- Odblokuj GRV po włożeniu kluczy ---
export const unlockGrvAtom = atom(
    null,
    (get, set) => {
        const grv = get(grvEnergyAtom);
        // Odblokuj 50% energii (4Mrd) - reszta do odkrywania!
        const unlockedAmount = Math.floor(grv.total * 0.5);
        
        set(grvEnergyAtom, {
            ...grv,
            active: unlockedAmount,
            unlocked: true,
            lastActivity: Date.now(),
        });
        
        console.log('%c 🔥 [GRV] ENERGY UNLOCKED! 4,000,000,000 GRV available!', 'color: #f59e0b; font-size: 14px; font-weight: bold;');
    }
);

// --- Zużyj GRV (przy korzystaniu z AI) ---
export const consumeGrvAtom = atom(
    null,
    (get, set, amount: number) => {
        const grv = get(grvEnergyAtom);
        
        if (!grv.unlocked) {
            console.warn('⚠️ [GRV] Energy still locked! Insert API keys first.');
            return false;
        }
        
        if (grv.active < amount) {
            console.warn('⚠️ [GRV] Insufficient energy!');
            return false;
        }
        
        set(grvEnergyAtom, {
            ...grv,
            active: grv.active - amount,
            lastActivity: Date.now(),
        });
        
        return true;
    }
);

const MOST = 'http://127.0.0.1:3001';

/**
 * 🔗 KTÓRY WĘZEŁ KSIĘGI odpowiada któremu kontu.
 *
 * ⚠️ TU BYŁA DRUGA PRAWDA. Mapowanie kont na węzły siedziało W TEJ FUNKCJI,
 * czyli w przeglądarce, a most miał własne zdanie w `_OtakOs_Wymiar/konta.json`.
 * Dwie warstwy mogły twierdzić co innego o tym, czyj to portfel. Teraz pytamy
 * most (`/api/konta/wezel`) — rejestr jest jeden i to on jest właścicielem
 * odpowiedzi. Wynik trafia do pamięci podręcznej, żeby nie pytać przy każdym renderze.
 *
 * Nieznane konto → `null`. Świadomie NIE zgadujemy „to pewnie Suweren", bo
 * zgadnięcie przypisałoby komuś cudze saldo. Wołający ma wtedy nic nie pokazać.
 *
 * ⚠️ Nazwa węzła NIE jest kosmetyką: to klucz w księdze GRV (grv_ledger.json),
 * po nim idą przelewy i po nim liczy się saldo.
 */
let rejestrKont: Record<string, string> = {};

/** Konto, na które przeglądarka jest obecnie zalogowana — do odświeżeń po zakupie. */
let ostatnieKonto: string | null = null;

export async function wezelKsiegi(username?: string | null): Promise<string | null> {
    const u = (username || '').trim().toLowerCase();
    if (!u) return null;
    if (rejestrKont[u]) return rejestrKont[u];
    try {
        const r = await fetch(`${MOST}/api/konta/wezel?kto=${encodeURIComponent(u)}`);
        if (!r.ok) return null;                 // most nie zna tego konta — nie zgadujemy
        const d = await r.json();
        if (!d?.wezel) return null;
        rejestrKont[u] = d.wezel;
        return d.wezel;
    } catch {
        return null;                            // most śpi — lepiej nic niż cudze saldo
    }
}

/**
 * Realne saldo z KSIĘGI, nie z pamięci przeglądarki.
 *
 * ⚠️ TU BYŁ ROZJAZD: portfel UI trzymał własną liczbę (1000 dla zwykłego konta,
 * 99999999 dla admina) i odejmował od niej przy zakupie, podczas gdy księga GRV
 * — jedyne miejsce z łańcuchem i pieczęcią — miała zupełnie inną wartość.
 * Suweren widział 900,73 GRV przy 1 000 075 w księdze. Ekran pokazywał fikcję.
 */
/** Napis, którym oznaczamy saldo nieskończone. Bank NIE ma liczby. */
export const SALDO_NIESKONCZONE = '∞';

export async function saldoZKsiegi(wezel: string): Promise<{ grv: number | null; nieskonczone: boolean; tier?: string }> {
    try {
        const r = await fetch(`${MOST}/api/grv/${encodeURIComponent(wezel)}`);
        if (!r.ok) return { grv: null, nieskonczone: false };
        const d = await r.json();
        // Zarządca ma saldo nieskończone — księga zwraca je jako napis „INFINITE".
        // ⚠️ Ekran pokazywał wtedy wymyślone 99 999 999 GRV. To ta sama fikcja, co
        // wcześniejsze 900,73 przy milionie w księdze: liczba z palca zamiast prawdy.
        // Bank nie ma salda — ma nieskończoność, i tak trzeba to napisać.
        const surowe = d?.grv;
        if (surowe === 'INFINITE') return { grv: null, nieskonczone: true, tier: d?.tier };
        const liczba = typeof surowe === 'number' ? surowe : Number(surowe);
        return { grv: Number.isFinite(liczba) ? liczba : null, nieskonczone: false, tier: d?.tier };
    } catch {
        return { grv: null, nieskonczone: false };
    }
}

export const walletAtom = atom<WalletState>({
    address: null,
    balance: null,
    tier: 'observer',
    frequencyTier: 'Superposition',
    isGenesisNode: false,
});

// --- Wallet of Being Logic ---
// Automates wallet creation and connection linked to identity.
export const autoConnectWalletAtom = atom(
    null,
    (get, set, username?: string) => {
        const currentWallet = get(walletAtom);

        // If already connected, do nothing
        if (currentWallet.address) return;

        let mockAddress = `0x${uuidv4().replace(/-/g, '').substring(0, 40)}`;
        let isGenesis = false;
        let initialTier: WalletState['frequencyTier'] = 'Medium';
        let userTier: WalletState['tier'] = 'observer';
        let bonus = 1000.00;

        // Genesis Wallet Logic for Admin - CHECK FIRST
        if (username === 'admin' || username === 'teo' || username === 'teo@teo.center') {
            mockAddress = '0xGENESIS_NODE_001';
            isGenesis = true;
            initialTier = 'Superposition';
            userTier = 'singularity';
            bonus = 99999999.00; // Infinite energy for Genesis
            console.log(`%c [GRAVITON] Genesis Node Identified: ${username}`, 'color: #f59e0b; font-weight: bold; font-size: 12px;');
        }

        set(walletAtom, {
            address: mockAddress,
            balance: bonus.toFixed(2),      // wartość tymczasowa — zaraz nadpisze ją księga
            tier: userTier,
            frequencyTier: initialTier,
            isGenesisNode: isGenesis
        });

        // 🔗 Prawdziwe saldo dociąga się z księgi GRV. Wpisany wyżej „bonus" to
        // tylko wypełniacz na czas jednego przebiegu — gdyby most spał, ekran
        // pokaże starą wartość, ale NIE będzie na jej podstawie nic odejmował.
        ostatnieKonto = username ?? null;
        void wezelKsiegi(username).then(async (wezel) => {
            if (!wezel) return;                       // konto nieznane mostowi — zostaje wypełniacz
            const { grv, nieskonczone, tier } = await saldoZKsiegi(wezel);
            if (grv === null && !nieskonczone) return;   // most śpi — zostaje wypełniacz
            const pokaz = nieskonczone ? SALDO_NIESKONCZONE : grv!.toFixed(2);
            set(walletAtom, w => ({
                ...w,
                balance: pokaz,
                tier: tier === 'founder' ? 'singularity' : w.tier,
            }));
            console.log(`%c [GRV] Saldo z księgi: ${wezel} = ${pokaz}`, 'color:#34d399');
        });

        if (!isGenesis) {
            console.log(`%c [Wallet of Being] Initialized: ${mockAddress} | +${bonus} GRV`, 'color: #a855f7; font-weight: bold;');
        }
    }
);

// Action atom to simulate a purchase
export const purchaseAssetAtom = atom(
    null,
    (get, set, price: number) => {
        const currentWallet = get(walletAtom);
        const bank = currentWallet.balance === SALDO_NIESKONCZONE;   // zarządca — nie ma czego odejmować
        // Auto-connect check (Just in case, though App.tsx should handle it)
        const balanceVal = currentWallet.balance ? parseFloat(currentWallet.balance) : 0;

        if (!bank && balanceVal < price) {
            throw new Error("Insufficient Energy (GRV). Please top up your Field.");
        }

        const split = calculateRevenueSplit(price);

        // ⚠️ NIE liczymy salda lokalnie. Przelew wykonał już most (POST
        // /api/market/kup) i to KSIĘGA wie, ile zostało. Odejmowanie po stronie
        // UI było właśnie tym, co rozjeżdżało ekran z rzeczywistością.
        if (!bank) set(walletAtom, { ...currentWallet, balance: (balanceVal - price).toFixed(2) });
        void wezelKsiegi(ostatnieKonto).then(async (wezel) => {
            if (!wezel) return;
            const { grv, nieskonczone } = await saldoZKsiegi(wezel);
            if (nieskonczone) return;                 // bank zostaje bankiem
            if (grv !== null) set(walletAtom, w => ({ ...w, balance: grv.toFixed(2) }));
        });

        // --- ISO 20022 FINANCIAL MESSAGING ---
        const isoMessage = createISO20022Message(
            { name: 'Teonaut', id: currentWallet.address || '0xUNKNOWN' },
            { name: 'Marketplace Smart Contract', id: '0xMARKET_V1' },
            price,
            'GRV',
            'SALA' // Sale of Goods/Services
        );

        // Log the Smart Contract Split (Simulated)
        console.group(`%c [GRAVITON] Smart Contract Executed`, 'color: #06b6d4; font-weight: bold;');
        console.log(`%c Total Transaction: ${price.toFixed(2)} GRV`, 'color: white;');
        console.log(`%c 🟢 Creator Profit (95%): +${split.formatted.creator} GRV`, 'color: #4ade80; font-weight: bold;');
        console.log(`%c 🏛️ SuperMaster DAO Fee (5%): +${split.formatted.platform} GRV -> ${split.platformWallet}`, 'color: #f43f5e;');

        // Log the ISO Standard Message
        console.log(`%c [GRAVITON ISO-20022 BUS]: Broadcasting...`, 'color: #fbbf24; font-weight: bold;');
        console.log(JSON.stringify(isoMessage, null, 2));

        console.groupEnd();

        return split;
    }
);
