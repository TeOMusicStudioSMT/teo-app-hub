
import { TransactionData, AegisQReport } from '../types';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

// --- Simulation Helpers ---
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- 1. Post-Quantum Cryptography Simulation ---

class QuantumSecureChannel {
    async generate_keypair(): Promise<{ publicKey: string; privateKey: string }> {
        await delay(150);
        return { publicKey: 'sim_kyber_public_key', privateKey: 'sim_kyber_private_key' };
    }

    async encapsulate_key(publicKey: string): Promise<{ ciphertext: string; sharedSecret: string }> {
        await delay(200);
        return { ciphertext: 'sim_kyber_ciphertext', sharedSecret: 'sim_kyber_shared_secret' };
    }
}

class QuantumSignedTransaction {
    transactionData: TransactionData;
    signature: string | null = null;

    constructor(transactionData: TransactionData) {
        this.transactionData = transactionData;
    }

    private _hash_data(data: TransactionData): string {
        return `hash(${JSON.stringify(data, Object.keys(data).sort())})`;
    }

    static async generate_keypair(): Promise<{ publicKey: string; privateKey: string }> {
        await delay(150);
        return { publicKey: 'sim_dilithium_public_key', privateKey: 'sim_dilithium_private_key' };
    }

    async sign(privateKey: string): Promise<void> {
        await delay(250);
        this.signature = `signed(${this._hash_data(this.transactionData)})`;
    }

    async verify(publicKey: string): Promise<boolean> {
        await delay(100);
        // In simulation, we always assume the signature is valid if it exists.
        return this.signature !== null;
    }
}

// --- 2. Anomaly Detection Simulation ---

class TransactionAnomalyDetector {
    // A simple heuristic-based anomaly detector for simulation purposes.
    predict_anomaly(txData: TransactionData): { is_anomaly: boolean; anomaly_score: number } {
        let anomaly_score = 0.1; // Base score for a normal transaction

        // High-value transactions are more suspicious
        if (txData.amount > 5000) {
            anomaly_score -= 0.3;
        } else if (txData.amount > 1000) {
            anomaly_score -= 0.15;
        }

        // New or unusual recipients can be a red flag
        if (txData.recipientId === 'graviton.dream') {
            anomaly_score -= 0.1;
        }
        
        // Final decision
        const is_anomaly = anomaly_score < -0.1;
        return { is_anomaly, anomaly_score };
    }
}


// --- 3. Reporting and Compliance Simulation ---

function generate_threat_report(transactionData: TransactionData, anomalyScore: number): AegisQReport {
    const severity = anomalyScore < -0.2 ? 'CRITICAL' : 'HIGH';
    
    return {
      reportId: uuidv4(),
      timestamp: new Date().toISOString(),
      severity,
      threatType: 'ANOMALOUS_TRANSACTION',
      details: {
        pseudonymizedUserId: `anon_${btoa(transactionData.senderId)}`, // GDPR
        transactionAmount: transactionData.amount,
        recipientId: transactionData.recipientId,
        anomalyScore,
        context: "Transaction deviates significantly from user's established spending patterns."
      },
      recommendedAction: "BLOCK_TRANSACTION_AND_NOTIFY_USER", // AI_ACT
      complianceFlags: ["GDPR_PSEUDONYMIZATION", "AI_ACT_HIGH_RISK_FLAG"]
    };
}


// --- Main Validation Flow ---
type ValidationResult = {
    status: 'PROCESSED' | 'BLOCKED' | 'REJECTED';
    reason: string;
    report?: AegisQReport;
};

export async function validate_and_process_transaction(
    txData: TransactionData,
    toastInstance: typeof toast,
    toastId: string
): Promise<ValidationResult> {
    const channel = new QuantumSecureChannel();
    const anomalyDetector = new TransactionAnomalyDetector();

    // Step 1: Establish Secure Channel (Kyber Simulation)
    await delay(500);
    const { publicKey: serverPubKey } = await channel.generate_keypair();
    await channel.encapsulate_key(serverPubKey);
    toastInstance.loading('Secure Quantum Channel Established (Kyber)...', { id: toastId });

    // Step 2: Sign Transaction (Dilithium Simulation)
    await delay(500);
    const { publicKey: userPubKey, privateKey: userPrivKey } = await QuantumSignedTransaction.generate_keypair();
    const signedTx = new QuantumSignedTransaction(txData);
    await signedTx.sign(userPrivKey);
    toastInstance.loading('Transaction Signed (Dilithium)...', { id: toastId });

    // Step 3: Server-side Verification (Simulation)
    await delay(800);
    toastInstance.loading('Verifying Signature & Analyzing with AI...', { id: toastId });
    const is_valid_signature = await signedTx.verify(userPubKey);

    if (!is_valid_signature) {
        return { status: 'REJECTED', reason: 'Invalid cryptographic signature.' };
    }

    // Step 4: Anomaly Analysis
    const { is_anomaly, anomaly_score } = anomalyDetector.predict_anomaly(txData);
    
    await delay(800);

    // Step 5: Decision
    if (is_anomaly) {
        const report = generate_threat_report(txData, anomaly_score);
        return {
            status: 'BLOCKED',
            reason: 'Anomalous behavior detected.',
            report,
        };
    } else {
        return {
            status: 'PROCESSED',
            reason: 'Transaction verified and processed successfully.'
        };
    }
}
