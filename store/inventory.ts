
import { atom } from 'jotai';
import { ConsumableAsset, DurableAsset } from '../lib/graviton/schema';
import * as firebaseService from '../services/firebaseService';

// --- Mock Data (Fallback/Initial) ---
export const mockConsumable: ConsumableAsset = {
    token_id: "GRV-BIO-7782-XJ9",
    asset_type: "CONSUMABLE_ORGANIC",
    name: "Organic Raspberry Tomato",
    origin: {
        manufacturer_id: "FARM-SECTOR-7",
        harvest_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    energy_profile: {
        initial_energy_value: 85,
        entropy_model: "LINEAR_DECAY_FAST",
        expiration_date: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(), // Expiring in 23h
        current_status: "RIPE_CRITICAL"
    },
    utility_layer: {
        on_expire_warning: true,
        suggested_recipes: ["Tomato Basil Soup", "Bruschetta"],
        waste_prevention_bonus: 15
    }
};

export const mockDurable: DurableAsset = {
    token_id: "GRV-TECH-IPHONE-15",
    asset_type: "DURABLE_ASSET",
    name: "Quantum Phone (Model X)",
    origin: {
        manufacturer_id: "TEO-HARDWARE",
        serial_hash: "0x8f2a...99b1",
        production_batch: "BATCH-2024-Q3"
    },
    energy_profile: {
        initial_value_fiat: 1200,
        entropy_model: "LOGARITHMIC_DECAY_SLOW",
        warranty_end: "2026-10-27T00:00:00Z",
        condition: "MINT"
    },
    financial_layer: {
        creation_tax_paid: true,
        passive_income_capability: {
            network_node: true,
            data_mining: false,
            node_tier: 2
        }
    }
};

interface InventoryState {
    consumables: ConsumableAsset[];
    durables: DurableAsset[];
    isLoading: boolean;
}

// Base atom holding the state
const inventoryBaseAtom = atom<InventoryState>({
    consumables: [mockConsumable], 
    durables: [mockDurable],
    isLoading: false
});

// Derived atom for read/write operations including async fetch
export const inventoryAtom = atom(
    (get) => get(inventoryBaseAtom),
    async (get, set, action: { type: 'FETCH' } | { type: 'UPDATE', payload: Partial<InventoryState> }) => {
        if (action.type === 'FETCH') {
            set(inventoryBaseAtom, prev => ({ ...prev, isLoading: true }));
            try {
                const data = await firebaseService.fetchInventory();
                set(inventoryBaseAtom, {
                    consumables: data.consumables,
                    durables: data.durables,
                    isLoading: false
                });
            } catch (e) {
                console.error("Inventory Sync Failed", e);
                set(inventoryBaseAtom, prev => ({ ...prev, isLoading: false }));
            }
        } else if (action.type === 'UPDATE') {
            set(inventoryBaseAtom, prev => ({ ...prev, ...action.payload }));
        }
    }
);

export interface MiningSession {
    isActive: boolean;
    startTime: number | null;
    accumulatedRewards: number;
}

export const miningSessionAtom = atom<MiningSession>({
    isActive: false,
    startTime: null,
    accumulatedRewards: 0.00
});
