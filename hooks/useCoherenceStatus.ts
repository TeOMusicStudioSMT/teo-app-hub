
import { useEffect, useState, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { essenceIdentityAtom } from '../store/identity';
import { useAegisClient } from './useAegisClient';
import { CoherenceStatus } from '../lib/identity/types';

/**
 * Hook to manage and periodically refresh the user's coherence status.
 */
export const useCoherenceStatus = (intervalMs: number = 15000) => {
    const [coherence, setCoherence] = useState<CoherenceStatus | null>(null);
    const setIdentity = useSetAtom(essenceIdentityAtom);
    const api = useAegisClient();

    const fetchStatus = useCallback(async () => {
        try {
            const status = await api.getCoherence();
            setCoherence(status);
            // Also update the main identity atom
            setIdentity(prev => (prev ? { ...prev, coherence: status } : null));
        } catch (error) {
            console.error("Failed to fetch coherence status:", error);
        }
    }, [api, setIdentity]);

    useEffect(() => {
        fetchStatus(); // Initial fetch
        const intervalId = setInterval(fetchStatus, intervalMs);

        return () => clearInterval(intervalId);
    }, [intervalMs, fetchStatus]);

    return coherence;
};