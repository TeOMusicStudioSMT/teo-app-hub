
// Graviton Asset Schema - Consumables and Durables

export interface ConsumableAsset {
    token_id: string;
    asset_type: string;
    name: string;
    origin: {
        manufacturer_id: string;
        harvest_date: string;
    };
    energy_profile: {
        initial_energy_value: number;
        entropy_model: string;
        expiration_date: string;
        current_status: string;
    };
    utility_layer: {
        on_expire_warning: boolean;
        suggested_recipes: string[];
        waste_prevention_bonus: number;
    };
}

export interface DurableAsset {
    token_id: string;
    asset_type: string;
    name: string;
    origin: {
        manufacturer_id: string;
        serial_hash: string;
        production_batch: string;
    };
    energy_profile: {
        initial_value_fiat: number;
        entropy_model: string;
        warranty_end: string;
        condition: string;
    };
    financial_layer: {
        creation_tax_paid: boolean;
        passive_income_capability: {
            network_node: boolean;
            data_mining: boolean;
            node_tier: number;
        };
    };
}
