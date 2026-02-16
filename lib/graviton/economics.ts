
import { v4 as uuidv4 } from 'uuid';

export type AssetType = 'Music Stream' | 'RPG World' | 'Standard';

export interface PricingParameters {
    // Music Params
    uniquenessScore?: number; // 1-10
    lengthMinutes?: number;
    // RPG Params
    complexity?: number; // 1-10
    npcCount?: number;
    // Standard
    baseOverride?: number;
}

export interface RevenueSplit {
    total: number;
    creatorShare: number;
    platformFee: number;
    platformWallet: string;
    formatted: {
        creator: string;
        platform: string;
    }
}

// --- ISO 20022 Financial Standard ---
// Represents a simplified financial transaction message compatible with global banking standards.
export interface ISO20022_Transaction {
    msgId: string; // Unique Message ID
    creDtTm: string; // Creation Date Time (ISO 8601)
    initgPty: { 
        nm: string; // Name
        id: string; // Wallet Address / DID
    }; // Sender (Initiating Party)
    dbtr: { 
        nm: string; 
        id: string; 
    }; // Receiver (Debtor in some contexts, simplified here as Target)
    amt: { 
        instdAmt: number; 
        ccy: "GRV" | "USD"; 
    }; // Amount
    purp: { 
        cd: "SALA" | "SERV" | "GIFT" | "INVEST"; // Purpose Code
    }; 
}

/**
 * Factory function to create an ISO 20022 compliant transaction message.
 */
export const createISO20022Message = (
    sender: { name: string; id: string },
    receiver: { name: string; id: string },
    amount: number,
    currency: "GRV" | "USD" = "GRV",
    purpose: "SALA" | "SERV" | "GIFT" | "INVEST" = "SERV"
): ISO20022_Transaction => {
    return {
        msgId: `MSG-${uuidv4()}`,
        creDtTm: new Date().toISOString(),
        initgPty: {
            nm: sender.name,
            id: sender.id
        },
        dbtr: {
            nm: receiver.name,
            id: receiver.id
        },
        amt: {
            instdAmt: amount,
            ccy: currency
        },
        purp: {
            cd: purpose
        }
    };
};


/**
 * Calculates the dynamic market price of an asset based on its intrinsic properties
 * and current "Kinetic Flux" market fluctuations.
 */
export const calculateAssetPrice = (type: AssetType, params: PricingParameters = {}): number => {
    let basePrice = 0;

    switch (type) {
        case 'RPG World':
            // Algorytm: Base (50) + (Complexity * 10) + (NPC_Count * 5)
            const complexity = params.complexity || 1;
            const npcCount = params.npcCount || 0;
            basePrice = 50 + (complexity * 10) + (npcCount * 5);
            break;

        case 'Music Stream':
            // Algorytm: Base (10) + (Uniqueness_Score * 2) + (Length_Minutes * 5)
            const uniqueness = params.uniquenessScore || 1;
            const length = params.lengthMinutes || 3;
            basePrice = 10 + (uniqueness * 2) + (length * 5);
            break;

        case 'Standard':
        default:
            basePrice = params.baseOverride || 100;
            break;
    }

    // Kinetic Flux: +/- 2% (0.98 to 1.02)
    const fluxMultiplier = 0.98 + (Math.random() * 0.04);
    const finalPrice = basePrice * fluxMultiplier;

    // Return rounded to 2 decimal places
    return Math.round(finalPrice * 100) / 100;
};

/**
 * Calculates the Smart Revenue Split: 95% Creator / 5% Platform (SuperMaster DAO)
 */
export const calculateRevenueSplit = (amount: number): RevenueSplit => {
    const PLATFORM_FEE_PERCENT = 0.05;
    const GENESIS_WALLET = '0xGENESIS_NODE_001';
    
    const platformFee = Number((amount * PLATFORM_FEE_PERCENT).toFixed(2));
    const creatorShare = Number((amount - platformFee).toFixed(2));

    return {
        total: amount,
        creatorShare,
        platformFee,
        platformWallet: GENESIS_WALLET,
        formatted: {
            creator: creatorShare.toFixed(2),
            platform: platformFee.toFixed(2)
        }
    };
};

// --- Physical-Digital Bridge (Conceptual Skeleton) ---

/**
 * Future Logic: Exchange a verified physical item for system energy (GRV).
 * This will rely on the "Social Contract" module and visual verification (AI Vision).
 * 
 * @param itemDescription - AI-generated description of the item
 * @param proofOfOwnership - Hash or signature verifying ownership
 * @returns Estimated GRV value
 */
export const exchangeItemForGRV = (itemDescription: string, proofOfOwnership: string): number => {
    console.log(`[Physical Bridge] Assessing item: ${itemDescription}`);
    // TODO: Implement PoBI (Proof of Bio-Integrity) check for the item.
    // TODO: Query Marketplace for similar item value.
    return 0;
};
