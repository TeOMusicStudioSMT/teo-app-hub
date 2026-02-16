
// --- Core Identity & Security Models ---

/**
 * Represents the core, sovereign identity of a user within the TeO ecosystem.
 */

// --- New Types ---
export type AvatarForm = 'humanoid' | 'energy' | 'construct';

export interface EssenceIdentity {
  did: string; // Decentralized Identifier (e.g., 'did:key:z6Mkp...')
  username: string | null;
  assistantDomain: string | null;
  avatarSeed: string; // A unique string to deterministically generate the user's avatar/aura
  auraColor: string; // A hex color code for the aura's glow
  customAvatarUrl?: string | null; // Optional URL for AI generated avatars
  vcSummary: VCSummary;
  guardians: Guardian[];
  limits: SecurityLimits;
  coherence: CoherenceStatus;
  avatarForm: AvatarForm;
}

/**
 * A summary of the user's Verifiable Credential for "Proof of Essence".
 */
export interface VCSummary {
  essenceProofIssued: boolean;
  issuer: string; // e.g., 'did:web:teo.universe'
  issueDate: string | null; // ISO 8601 string
}

/**
 * A social recovery guardian for the user's identity.
 */
export interface Guardian {
  id: string; // A unique identifier for the guardian entry
  label: string; // User-defined name (e.g., "My Partner's Device")
  contact: string; // A DID or other secure contact method
  weight: number; // For future weighted quorum logic (default to 1)
}

/**
 * Security limits and settings for the user's account.
 */
export interface SecurityLimits {
  daily: number; // Max transaction value per day in GRV
  highRiskDelayMinutes: number; // Time delay for transactions flagged as high-risk
  quorum: number; // Number of guardians required for recovery (e.g., 2 for a 2-of-N setup)
}

/**
 * The user's real-time behavioral coherence status.
 */
export interface CoherenceStatus {
  index: number; // A score from 0 to 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[]; // Brief, anonymized reasons for the current risk level
  updatedAt: string; // ISO 8601 string
}


// --- API Request & Response Models ---

// POST /identity/claimUsername
export interface ClaimUsernameRequest {
  username: string;
  assistantDomain: string;
}
export interface ClaimUsernameResponse {
  success: boolean;
  username: string;
  assistantDomain: string;
}

// POST /identity/guardians
export interface UpdateGuardiansRequest {
  guardians: Guardian[];
  quorum: number;
}
export interface UpdateGuardiansResponse {
  success: boolean;
  guardians: Guardian[];
  quorum: number;
}

// POST /aegis/validateTransaction
export interface ValidateTransactionRequest {
  // Using a simplified version of the existing TransactionData
  amount: number;
  recipientId: string;
  currency: 'GRV' | 'USD';
}
export interface ValidateTransactionResponse {
  status: 'APPROVED' | 'REVIEW' | 'BLOCKED'; // APPROVED (low risk), REVIEW (medium), BLOCKED (high)
  reason: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reportId?: string;
}

// POST /aegis/protective/confirmResonance
export interface ConfirmResonanceRequest {
  reportId: string; // The report ID from the initial BLOCKED response
}
export interface ConfirmResonanceResponse {
  success: boolean;
  message: string;
}
