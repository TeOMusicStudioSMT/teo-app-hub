
import { atom } from 'jotai';
import { WalletState } from '../types';
import { calculateRevenueSplit, createISO20022Message } from '../lib/graviton/economics';
import { v4 as uuidv4 } from 'uuid';

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
            balance: bonus.toFixed(2),
            tier: userTier,
            frequencyTier: initialTier,
            isGenesisNode: isGenesis
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
        // Auto-connect check (Just in case, though App.tsx should handle it)
        const balanceVal = currentWallet.balance ? parseFloat(currentWallet.balance) : 0;

        if (balanceVal < price) {
            throw new Error("Insufficient Energy (GRV). Please top up your Field.");
        }

        const split = calculateRevenueSplit(price);
        const newBalance = balanceVal - price;

        // Update Wallet State
        set(walletAtom, {
            ...currentWallet,
            balance: newBalance.toFixed(2)
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
