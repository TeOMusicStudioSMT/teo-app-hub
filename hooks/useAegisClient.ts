import { useMemo } from 'react';
import * as client from '../lib/identity/client';

/**
 * Provides a memoized instance of the Aegis/Identity API client.
 * This hook centralizes the API access logic.
 */
export const useAegisClient = () => {
    const api = useMemo(() => {
        return { ...client };
    }, []);
    return api;
};
