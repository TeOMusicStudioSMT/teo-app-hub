
import { db } from "../lib/firebaseConfig";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { User } from "firebase/auth";
import { ConsumableAsset, DurableAsset } from "../lib/graviton/schema";
import { mockConsumable, mockDurable } from "../store/inventory";

// This service simulates backend calls to Firebase.
// In a real implementation, it would import 'db' from './authService' (initialized app)
// and use Firestore methods like getDocs(collection(db, "inventory")).

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Initialize user in Firestore with Genesis Pack for new users
 * Or load existing user data
 */
export const initializeUserInFirestore = async (user: User) => {
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // NEW USER - Create with Genesis Pack
            const genesisData = {
                username: null, // Will be set during username claim flow
                companionName: null, // Will be set during username claim flow
                email: user.email,
                tier: 'observer', // Default Tier
                balance: 100, // Genesis Gift
                reputation: 1,
                createdAt: serverTimestamp(),
                inventory: [
                    {
                        id: 'item_tomato_001',
                        name: 'Genesis Tomato',
                        type: 'organic',
                        quantity: 1
                    }
                ]
            };

            await setDoc(userRef, genesisData);
            console.log(`%c🌟 [Genesis Node Created] User: ${user.uid} | Tier: Observer`, 'color: #10b981; font-weight: bold; font-size: 14px;');
            console.log('%cGenesis Pack Awarded: +100 GRV, Genesis Tomato x1', 'color: #a855f7;');

            return genesisData;
        } else {
            // EXISTING USER - Load data
            const userData = userSnap.data();
            console.log(`%c👋 Welcome back, ${userData.username || 'Traveler'}!`, 'color: #06b6d4; font-weight: bold; font-size: 14px;');
            console.log(`Balance: ${userData.balance} GRV | Tier: ${userData.tier || 'observer'}`);

            // Backfill tier if missing
            if (!userData.tier) {
                userData.tier = 'observer';
            }

            return userData;
        }
    } catch (error) {
        console.error("Error initializing user in Firestore:", error);
        throw error;
    }
};

/**
 * Upgrade user tier
 */
export const upgradeUserTier = async (uid: string, newTier: string) => {
    try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, { tier: newTier }, { merge: true });
        console.log(`%c🚀 [Tier Upgraded] User: ${uid} -> ${newTier}`, 'color: #f472b6; font-weight: bold;');
        return true;
    } catch (error) {
        console.error("Error upgrading user tier:", error);
        throw error;
    }
};

/**
 * Update user identity (username and companionName) in Firestore
 */
export const updateUserIdentity = async (uid: string, username: string, companionName: string) => {
    try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
            username,
            companionName,
        }, { merge: true }); // Use merge to only update these fields

        console.log(`%c✨ [Identity Synchronized] Username: @${username}, Companion: ${companionName}`, 'color: #10b981; font-weight: bold;');
        return { success: true, username, companionName };
    } catch (error) {
        console.error("Error updating user identity:", error);
        throw error;
    }
};

/**
 * Check if a username is available (not taken by another user)
 */
export const checkUsernameAvailability = async (username: string, currentUid: string): Promise<boolean> => {
    try {
        // Query Firestore to find if username exists
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", username));
        const querySnapshot = await getDocs(q);

        // If no results, username is available
        if (querySnapshot.empty) {
            return true;
        }

        // If username exists but belongs to current user, it's available (they can re-claim their own)
        const existingUserDoc = querySnapshot.docs[0];
        if (existingUserDoc.id === currentUid) {
            return true;
        }

        // Username is taken by someone else
        return false;
    } catch (error) {
        console.error("Error checking username availability:", error);
        throw error;
    }
};

export const fetchInventory = async (): Promise<{ consumables: ConsumableAsset[], durables: DurableAsset[] }> => {
    // Simulate network latency
    await delay(600);

    // Return mock data for now
    return {
        consumables: [mockConsumable],
        durables: [mockDurable]
    };
};

export const fetchWalletBalance = async (): Promise<number> => {
    await delay(300);
    // This could fetch from a 'wallets' collection in Firestore
    return 3975.78;
};

export const syncMiningSession = async (sessionId: string, stats: any): Promise<boolean> => {
    console.log(`[FirebaseService] Syncing mining session ${sessionId}...`, stats);
    await delay(500);
    return true;
};
