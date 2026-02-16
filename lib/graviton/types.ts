
export interface GravitonActivity {
  id: string;
  type: 'INBOUND' | 'OUTBOUND' | 'STAKE' | 'YIELD';
  amount: number;
  peer: string; // or 'System' for staking/yield
  timestamp: string;
}

export interface GravitonTransferRequest {
  recipientId: string; // e.g., @username
  amount: number;
}

export interface GravitonTransferResponse {
  success: boolean;
  transactionId: string;
}
