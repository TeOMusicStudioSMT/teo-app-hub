import {
  EssenceIdentity,
  Guardian,
  ClaimUsernameRequest,
  ClaimUsernameResponse,
  UpdateGuardiansRequest,
  UpdateGuardiansResponse,
  ValidateTransactionRequest,
  ValidateTransactionResponse,
  ConfirmResonanceRequest,
  ConfirmResonanceResponse,
  AvatarForm,
} from './types';
import { v4 as uuidv4 } from 'uuid';

// --- Mock Backend Data Store ---
let mockIdentity: EssenceIdentity = {
  did: 'did:key:z6MkpTHR8VNsj1wV1bY51qzjA2j3e5Q6q8C2pX9b7Z8dY3aN',
  username: null,
  assistantDomain: null,
  avatarSeed: 'e1a2c3b4d5f6',
  auraColor: '#8b5cf6', // violet-500
  avatarForm: 'humanoid',
  vcSummary: {
    essenceProofIssued: false,
    issuer: 'did:web:teo.universe',
    issueDate: null,
  },
  guardians: [
    { id: 'g1', label: 'Primary Device', contact: 'did:key:z...', weight: 1 },
  ],
  limits: {
    daily: 5000,
    highRiskDelayMinutes: 15,
    quorum: 2,
  },
  coherence: {
    index: 98,
    riskLevel: 'LOW',
    reasons: ['Consistent device usage', 'Normal transaction patterns'],
    updatedAt: new Date().toISOString(),
  },
};
const claimedUsernames = new Set(['admin', 'teo', 'test']);
// --- End Mock Data ---


const API_BASE = process.env.NEXT_PUBLIC_AEGIS_API_BASE || '/api';

/**
 * Simulates network delay and potential errors.
 */
export const mockFetch = async <T>(data: T, delay = 500, errorRate = 0): Promise<T> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < errorRate) {
        reject(new Error('A simulated network error occurred.'));
      } else {
        resolve(JSON.parse(JSON.stringify(data))); // Deep copy to prevent mutation
      }
    }, delay);
  });
};


// --- API Client Implementation ---

export const getProfile = async (): Promise<EssenceIdentity> => {
  // GET /identity/profile
  return mockFetch(mockIdentity);
};

export const getCoherence = async (): Promise<EssenceIdentity['coherence']> => {
  // GET /aegis/behavior
  // Simulate slight fluctuations in coherence
  const shouldChange = Math.random() > 0.7;
  if (shouldChange) {
    mockIdentity.coherence.index = Math.max(80, Math.min(99, mockIdentity.coherence.index + (Math.random() * 4 - 2)));
    mockIdentity.coherence.updatedAt = new Date().toISOString();
  }
  return mockFetch(mockIdentity.coherence, 200);
}

export const claimUsername = async (data: ClaimUsernameRequest): Promise<ClaimUsernameResponse> => {
  // POST /identity/claimUsername
  const { username, assistantDomain } = data;
  const validationRegex = /^[a-z0-9.-]{3,24}$/;
  if (!validationRegex.test(username)) {
    throw new Error('Invalid username format.');
  }

  // Get current user from Firebase Auth
  const { auth } = await import('../firebaseConfig');
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated.');
  }

  // Check username availability using Firestore
  const { checkUsernameAvailability, updateUserIdentity } = await import('../../services/firebaseService');
  const isAvailable = await checkUsernameAvailability(username, currentUser.uid);

  if (!isAvailable) {
    throw new Error('Username is already taken.');
  }

  // Update Firestore with username and companionName
  await updateUserIdentity(currentUser.uid, username, assistantDomain);

  // Update local mock for backward compatibility with other mock features
  mockIdentity.username = username;
  mockIdentity.assistantDomain = assistantDomain;

  return mockFetch({ success: true, username, assistantDomain });
};

export const updateGuardians = async (data: UpdateGuardiansRequest): Promise<UpdateGuardiansResponse> => {
  // POST /identity/guardians
  const { guardians, quorum } = data;
  mockIdentity.guardians = guardians.map(g => ({ ...g, id: g.id || uuidv4() }));
  mockIdentity.limits.quorum = quorum;
  return mockFetch({ success: true, guardians: mockIdentity.guardians, quorum: mockIdentity.limits.quorum });
}

export const validateTransaction = async (data: ValidateTransactionRequest): Promise<ValidateTransactionResponse> => {
  // POST /aegis/validateTransaction
  // Simulate risk assessment based on amount
  const randomFactor = Math.random();
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let status: 'APPROVED' | 'REVIEW' | 'BLOCKED' = 'APPROVED';
  let reason = 'Transaction parameters are within normal range.';

  if (data.amount > mockIdentity.limits.daily) {
    riskLevel = 'HIGH';
    status = 'BLOCKED';
    reason = 'Transaction exceeds daily limit.';
  } else if (data.amount > 2000 || (data.recipientId.includes('jano') && data.amount > 50) || randomFactor > 0.9) { // Specific rule for demo
    riskLevel = 'HIGH';
    status = 'BLOCKED';
    reason = 'Transaction flagged as high-risk due to unusual pattern.';
  } else if (data.amount > 500 || randomFactor > 0.7) {
    riskLevel = 'MEDIUM';
    status = 'REVIEW';
    reason = 'Transaction requires additional verification.';
  }

  // Update coherence for demo purposes
  mockIdentity.coherence.riskLevel = riskLevel;
  mockIdentity.coherence.index = riskLevel === 'HIGH' ? 45 : riskLevel === 'MEDIUM' ? 70 : 98;
  mockIdentity.coherence.reasons = [reason];

  return mockFetch({
    status,
    reason,
    riskLevel,
    reportId: status === 'BLOCKED' ? `REP-${uuidv4().substring(0, 8)}` : undefined,
  });
}

export const confirmResonance = async (data: ConfirmResonanceRequest): Promise<ConfirmResonanceResponse> => {
  // POST /aegis/protective/confirmResonance
  console.log(`Received resonance confirmation for report: ${data.reportId}`);
  // In a real system, this would mark the transaction for re-evaluation
  // or allow it to proceed after the delay.
  return mockFetch({
    success: true,
    message: 'Resonance confirmed. The transaction will be re-processed after the security delay.'
  });
}

export const updateAvatarForm = async (data: { form: AvatarForm }): Promise<{ success: boolean; avatarForm: AvatarForm }> => {
  mockIdentity.avatarForm = data.form;
  return mockFetch({ success: true, avatarForm: data.form }, 800);
};