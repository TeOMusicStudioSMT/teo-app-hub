
import { useAtom } from 'jotai';
import { useCallback } from 'react';
import { essenceIdentityAtom } from '../store/identity';
import { useAegisClient } from './useAegisClient';
import toast from 'react-hot-toast';
import { Guardian } from '../lib/identity/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook to manage social recovery guardians.
 * Provides functions to add, remove, and update guardians and the quorum.
 */
export const useGuardians = () => {
    const [identity, setIdentity] = useAtom(essenceIdentityAtom);
    const api = useAegisClient();

    const updateGuardians = useCallback(async (newGuardians: Guardian[], newQuorum: number) => {
        if (!identity) return;

        const promise = api.updateGuardians({ guardians: newGuardians, quorum: newQuorum });

        toast.promise(promise, {
            loading: 'Updating Guardians...',
            success: 'Guardians updated successfully!',
            error: 'Failed to update Guardians.',
        });

        try {
            const response = await promise;
            setIdentity((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    guardians: response.guardians,
                    limits: { ...prev.limits, quorum: response.quorum },
                };
            });
        } catch (error) {
            console.error(error);
        }
    }, [identity, setIdentity, api]);

    const addGuardian = useCallback((newGuardian: Omit<Guardian, 'id' | 'weight'>) => {
        if (!identity) return;
        const guardianToAdd: Guardian = { ...newGuardian, id: uuidv4(), weight: 1 };
        const updatedGuardians = [...identity.guardians, guardianToAdd];
        updateGuardians(updatedGuardians, identity.limits.quorum);
    }, [identity, updateGuardians]);

    const removeGuardian = useCallback((guardianId: string) => {
        if (!identity) return;
        const updatedGuardians = identity.guardians.filter(g => g.id !== guardianId);
        // Ensure quorum is not higher than the number of guardians
        const updatedQuorum = Math.min(identity.limits.quorum, updatedGuardians.length);
        updateGuardians(updatedGuardians, updatedQuorum);
    }, [identity, updateGuardians]);
    
    const setQuorum = useCallback((quorum: number) => {
        if (!identity || quorum < 1 || quorum > identity.guardians.length) return;
        updateGuardians(identity.guardians, quorum);
    }, [identity, updateGuardians]);

    return {
        guardians: identity?.guardians || [],
        quorum: identity?.limits.quorum || 1,
        addGuardian,
        removeGuardian,
        setQuorum,
    };
};