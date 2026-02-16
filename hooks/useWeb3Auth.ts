import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

// Extend Window interface for MetaMask
declare global {
    interface Window {
        ethereum?: any;
    }
}

interface Web3AuthState {
    address: string | null;
    domainName: string | null;
    isConnecting: boolean;
    error: string | null;
}

export const useWeb3Auth = () => {
    const [state, setState] = useState<Web3AuthState>({
        address: null,
        domainName: null,
        isConnecting: false,
        error: null,
    });

    /**
     * Resolve ENS or Unstoppable Domain name for an address
     */
    const resolveDomain = async (address: string, provider: ethers.BrowserProvider): Promise<string | null> => {
        try {
            // Try ENS resolution first
            const ensName = await provider.lookupAddress(address);
            if (ensName) {
                console.log(`✅ ENS resolved: ${ensName}`);
                return ensName;
            }

            // TODO: Add Unstoppable Domains resolution
            // This would require additional setup with UD SDK

            return null;
        } catch (error) {
            console.log('No domain name found for address');
            return null;
        }
    };

    /**
     * Connect to MetaMask or other Web3 wallet
     */
    const connectWallet = useCallback(async () => {
        // Check if MetaMask is installed
        if (!window.ethereum) {
            const errorMsg = 'MetaMask or Web3 wallet not detected. Please install MetaMask.';
            setState(prev => ({ ...prev, error: errorMsg }));
            toast.error(errorMsg);
            return null;
        }

        setState(prev => ({ ...prev, isConnecting: true, error: null }));

        try {
            // Request account access
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send('eth_requestAccounts', []);

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts returned from wallet');
            }

            const address = accounts[0];
            console.log(`🔗 Wallet connected: ${address}`);

            // Try to resolve domain name
            const domainName = await resolveDomain(address, provider);

            setState({
                address,
                domainName,
                isConnecting: false,
                error: null,
            });

            toast.success(domainName
                ? `Connected as ${domainName}`
                : `Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`
            );

            return { address, domainName };

        } catch (error: any) {
            console.error('Error connecting wallet:', error);

            let errorMsg = 'Failed to connect wallet';

            if (error.code === 4001) {
                errorMsg = 'Wallet connection rejected by user';
            } else if (error.code === -32002) {
                errorMsg = 'Wallet connection request already pending';
            }

            setState(prev => ({
                ...prev,
                isConnecting: false,
                error: errorMsg,
            }));

            toast.error(errorMsg);
            return null;
        }
    }, []);

    /**
     * Sign a message to prove ownership (for future nonce verification)
     */
    const signMessage = useCallback(async (nonce: string): Promise<string | null> => {
        if (!window.ethereum || !state.address) {
            toast.error('Wallet not connected');
            return null;
        }

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const signature = await signer.signMessage(nonce);

            console.log(`✍️ Message signed: ${signature}`);
            return signature;
        } catch (error: any) {
            console.error('Error signing message:', error);

            if (error.code === 4001) {
                toast.error('Signature rejected');
            } else {
                toast.error('Failed to sign message');
            }

            return null;
        }
    }, [state.address]);

    /**
     * Disconnect wallet
     */
    const disconnect = useCallback(() => {
        setState({
            address: null,
            domainName: null,
            isConnecting: false,
            error: null,
        });
        toast('Wallet disconnected');
    }, []);

    return {
        address: state.address,
        domainName: state.domainName,
        isConnecting: state.isConnecting,
        error: state.error,
        connect: connectWallet,
        signMessage,
        disconnect,
    };
};
