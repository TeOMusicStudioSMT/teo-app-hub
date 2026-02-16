import { auth } from '../lib/firebaseConfig';
import { signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import toast from 'react-hot-toast';

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Google using Firebase Authentication
 * Uses Redirect method to be compatible with COOP/COEP security headers required for local AI
 */
export const signInWithGoogle = async (): Promise<void> => {
    try {
        // We use signInWithRedirect because our strict security headers (COOP/COEP)
        // required for the WASM AI model break cross-origin popups.
        await signInWithRedirect(auth, googleProvider);
        // Note: The result will be handled by the onAuthStateChanged listener in App.tsx
        // or can be retrieved with getRedirectResult() if needed, but the listener is usually enough.
    } catch (error: any) {
        console.error("Error initiating Google Redirect:", error);
        toast.error('Failed to initiate login sequence.');
        throw error;
    }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (email: string, password: string): Promise<User | null> => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        toast.success(`Welcome back!`);
        return result.user;
    } catch (error: any) {
        console.error("Error signing in with email:", error);

        if (error.code === 'auth/user-not-found') {
            toast.error('No account found with this email');
        } else if (error.code === 'auth/wrong-password') {
            toast.error('Incorrect password');
        } else if (error.code === 'auth/invalid-email') {
            toast.error('Invalid email address');
        } else {
            toast.error('Failed to sign in. Please try again.');
        }

        throw error;
    }
};

/**
 * Sign up with email and password
 */
export const signUpWithEmail = async (email: string, password: string): Promise<User | null> => {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        toast.success(`Account created! Welcome to TeO Genesis!`);
        return result.user;
    } catch (error: any) {
        console.error("Error signing up with email:", error);

        if (error.code === 'auth/email-already-in-use') {
            toast.error('Email already in use. Try logging in instead.');
        } else if (error.code === 'auth/weak-password') {
            toast.error('Password is too weak. Use at least 6 characters.');
        } else if (error.code === 'auth/invalid-email') {
            toast.error('Invalid email address');
        } else {
            toast.error('Failed to create account. Please try again.');
        }

        throw error;
    }
};

/**
 * Sign in with Web3 wallet
 * Creates a mock user session for wallet-based authentication
 */
export const loginWithWallet = async (address: string, domainName?: string): Promise<User | null> => {
    try {
        // Create a mock User object for wallet authentication
        // Note: This is a workaround since Firebase Auth doesn't natively support Web3 wallets
        // In production, you might want to use Firebase Custom Tokens instead
        const mockUser = {
            uid: `wallet_${address.toLowerCase()}`,
            displayName: domainName || `${address.slice(0, 6)}...${address.slice(-4)}`,
            email: `${address.toLowerCase()}@wallet.teo`, // Mock email for Firestore compatibility
            photoURL: `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`, // Generate avatar from address
            emailVerified: true, // Wallet ownership is verified
            isAnonymous: false,
            metadata: {},
            providerData: [{
                providerId: 'web3',
                uid: address,
                displayName: domainName,
                email: `${address.toLowerCase()}@wallet.teo`,
                photoURL: null,
                phoneNumber: null,
            }],
            refreshToken: "",
            tenantId: null,
            delete: async () => { },
            getIdToken: async () => `mock-wallet-token-${address}`,
            getIdTokenResult: async () => ({
                token: `mock-wallet-token-${address}`,
                signInProvider: "web3",
                claims: { address },
                authTime: "",
                issuedAtTime: "",
                expirationTime: ""
            } as any),
            reload: async () => { },
            toJSON: () => ({}),
            phoneNumber: null
        } as unknown as User;

        toast.success(domainName
            ? `Welcome, ${domainName}!`
            : `Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`
        );

        return mockUser;
    } catch (error) {
        console.error("Error creating wallet session:", error);
        toast.error('Failed to initialize wallet session');
        throw error;
    }
};

/**
 * Sign out the current user
 */
export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
        toast.success('Signed out successfully');
    } catch (error) {
        console.error("Error signing out:", error);
        toast.error('Failed to sign out');
    }
};

/**
 * Subscribe to authentication state changes
 * @param callback Function to call when auth state changes
 * @returns Unsubscribe function
 */
export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};

export { auth };
