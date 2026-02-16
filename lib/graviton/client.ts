// GraviTON is modelled as a multi-dimensional currency (Superposition). Exclusive products like TeO Travel require High/Superposition Frequency Tier access.
import { mockFetch } from '../identity/client';
import { GravitonActivity, GravitonTransferRequest, GravitonTransferResponse } from './types';
import { v4 as uuidv4 } from 'uuid';

// --- Mock Backend Data Store ---
let mockBalance = 3975.78;
// FIX: The original array contained properties not in GravitonActivity and caused type errors.
// It has been rewritten to directly create objects matching the GravitonActivity interface.
const mockActivity: GravitonActivity[] = [
    { id: 'TXN7_jkl', type: 'OUTBOUND', amount: 50, peer: 'teoapp.studio', timestamp: new Date('2024-07-29 10:05 UTC').toISOString() },
    { id: 'TXN6_ghi', type: 'YIELD', amount: 125.78, peer: 'System', timestamp: new Date('2024-07-28 18:20 UTC').toISOString() },
];
// --- End Mock Data ---


export const getBalance = async (): Promise<number> => {
    return mockFetch(mockBalance, 300);
};

export const getActivity = async (): Promise<GravitonActivity[]> => {
    return mockFetch(mockActivity, 500);
};

export const transferGravTon = async (data: GravitonTransferRequest): Promise<GravitonTransferResponse> => {
    // Simulate the transfer
    mockBalance -= data.amount;
    
    const newActivity: GravitonActivity = {
        id: `TXN-${uuidv4().substring(0,8)}`,
        type: 'OUTBOUND',
        amount: data.amount,
        peer: data.recipientId,
        timestamp: new Date().toISOString(),
    };
    mockActivity.unshift(newActivity); // Add to the top of the history

    return mockFetch({
        success: true,
        transactionId: newActivity.id,
    });
};