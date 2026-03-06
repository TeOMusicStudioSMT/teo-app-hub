
import { atom } from 'jotai';
import { Project, PendingIncident } from '../types';
import { PROJECTS } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { PeerNode } from '../services/meshNetwork';

// Eksport GRV i Wallet
export { walletAtom, grvEnergyAtom, unlockGrvAtom, consumeGrvAtom } from './wallet';

export const PROJECTS_STORAGE_KEY = 'teo_projects_state';

// Function to load initial state from localStorage or use defaults
const loadProjects = (): Project[] => {
    try {
        const storedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
        if (storedProjects) {
            // Parse the stored data which only contains id, isSubscribed, isFavorite
            const parsedPreferences: Array<{ id: string; isSubscribed?: boolean; isFavorite?: boolean }> = JSON.parse(storedProjects);

            // Create a map for quick lookups
            const preferencesMap = new Map(parsedPreferences.map(p => [p.id, { isSubscribed: p.isSubscribed, isFavorite: p.isFavorite }]));

            // Merge the default projects with the stored preferences
            return PROJECTS.map(p => {
                const userPref = preferencesMap.get(p.id);
                if (userPref) {
                    return {
                        ...p,
                        isSubscribed: userPref.isSubscribed ?? p.isSubscribed,
                        isFavorite: userPref.isFavorite ?? p.isFavorite,
                    };
                }
                return p;
            });
        }
    } catch (error) {
        console.error("Failed to parse projects from localStorage", error);
        // If parsing fails, fall back to default
    }
    return PROJECTS; // Default projects if nothing in storage or on error
};


export const projectsAtom = atom<Project[]>(loadProjects());

export const userFavoritesAtom = atom<Project[]>((get) =>
    get(projectsAtom).filter((p) => p.isFavorite)
);

// --- Admin Dashboard State ---
const initialIncidents: PendingIncident[] = [
    {
        incidentId: 'INC001',
        userId: 'Teonaut_001',
        incidentType: 'anomalous transaction',
        confidenceScore: 85,
        timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    },
    {
        incidentId: 'INC002',
        userId: 'Teonaut_042',
        incidentType: 'suspicious login',
        confidenceScore: 92,
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    },
    {
        incidentId: 'INC003',
        userId: 'Teonaut_1337',
        incidentType: 'anomalous transaction',
        confidenceScore: 68,
        timestamp: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
    }
];

export const adminIncidentsAtom = atom<PendingIncident[]>(initialIncidents);

// Atom to add a new incident
export const addAdminIncidentAtom = atom(
    null,
    (get, set, newIncident: Omit<PendingIncident, 'incidentId' | 'timestamp'>) => {
        const fullIncident: PendingIncident = {
            ...newIncident,
            incidentId: `INC_${uuidv4().substring(0, 4).toUpperCase()}`,
            timestamp: new Date(),
        };
        set(adminIncidentsAtom, (prev) => [fullIncident, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    }
);

// --- Offline / Mesh Network State ---
export const isOfflineModeAtom = atom<boolean>(false);
export const meshPeersAtom = atom<PeerNode[]>([]);
