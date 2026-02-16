
import { useEffect, useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import { essenceIdentityAtom } from '../store/identity';
import { useAegisClient } from './useAegisClient';

/**
 * Hook to manage the user's Essence Identity state.
 * It fetches the profile on mount and provides a function to refresh it.
 */
export const useEssenceIdentity = () => {
    const [identity, setIdentity] = useAtom(essenceIdentityAtom);
    const api = useAegisClient();
    const hasFetched = useRef(false);

    const fetchIdentity = useCallback(async () => {
        try {
            const profile = await api.getProfile();
            setIdentity(profile);
        } catch (error) {
            console.error("Failed to fetch essence identity:", error);
            // Handle error appropriately, e.g., show a toast
        }
    }, [api, setIdentity]);

    useEffect(() => {
        // Fetch identity only once on mount if it's not already loaded
        if (!identity && !hasFetched.current) {
            hasFetched.current = true;
            fetchIdentity();
        }
    }, [identity, fetchIdentity]); // fetchIdentity is stable due to useCallback

    return {
        identity,
        isLoading: !identity,
        refreshIdentity: fetchIdentity,
    };
};