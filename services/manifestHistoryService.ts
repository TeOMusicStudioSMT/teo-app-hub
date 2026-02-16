export interface ManifestEntry {
    word: string;
    timestamp: number;
    proposals: string[];
}

const STORAGE_KEY = 'teo_manifest_history';

export const saveManifestation = (word: string, proposals: string[]) => {
    try {
        const history = getManifestHistory();
        const newEntry: ManifestEntry = { word, timestamp: Date.now(), proposals };
        const updatedHistory = [newEntry, ...history].slice(0, 50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (e) { console.error("History Error:", e); }
};

export const getManifestHistory = (): ManifestEntry[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try { return JSON.parse(data); } catch { return []; }
};