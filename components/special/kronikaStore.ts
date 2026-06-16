// src/store/kronikaStore.ts
import { atom } from 'jotai';

/** ----------------------------------------- */
/* TYPING I INTERFEJSY DANYCH */
/** ----------------------------------------- */

export type KronikaType = 'AI_GENERATED' | 'MANUAL_LOG';

export interface AgentComment {
  agent: string; // Adamus, Bella, ODDI
  text: string;
}

export interface KronikaEntry {
  id: string;
  title: string;
  narrative: string;
  xp: number; // Wartość GRV
  aura: string;
  timestamp: string; // ISO Date String
  videoUrl?: string; // Lokalna ścieżka do pliku MP4
  type: KronikaType;
  comments: AgentComment[];
}

// -----------------------------------------
/* ATOM STANU */
// Uproszczony state - w realnym systemie będzie ładowany z DB/Storage API.
export const initialKronikaData: KronikaEntry[] = [
    {
        id: 'uuid-001',
        title: "Genesis Flux Point 3.1",
        narrative: "Pierwszy kontakt z polem kwantowym destabilizującym lokalną rzeczywistość.",
        xp: 55,
        aura: "cyan",
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 dni temu (Aktywny)
        videoUrl: "/assets/notebooks/flux_point_3.mp4",
        type: 'AI_GENERATED',
        comments: [
            { agent: "Adamus", text: "Świetna strategia, ale brakuje tu kalibracji ryzyka." },
            { agent: "Bella", text: "Kolorystyka opisu wymaga dodania szlachetnego złota." },
            { agent: "ODDI", text: "Logicznie rzecz biorąc, nie było przesłanek do tego odkrycia." }
        ]
    },
    // Dodaj wpis historyczny (starszy niż 7 dni)
    {
        id: 'uuid-002',
        title: "Projekt Chimera Beta",
        narrative: "Testowanie interfejsu bio-mózg. Minimalne sukcesy, wysokie zużycie zasobników.",
        xp: 30,
        aura: "magenta",
        timestamp: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 dni temu (Historyczny)
        videoUrl: undefined,
        type: 'AI_GENERATED',
        comments: []
    },
];

export const kronikaEntriesAtom = atom<KronikaEntry[]>(initialKronikaData);

/** ----------------------------------------- */
/* WARSTWA USŁUG (BUSINESS LOGIC) */
/** ----------------------------------------- */

// Implementacja logicznej syntezy i filtrowania danych.
interface KronikaState {
    entries: KronikaEntry[];
    activeWalletBalance: number; // Stan portfela użytkownika
}

export const useKronikaService = (currentEntries: KronikaEntry[]): {
    getActiveWrites: () => kronikaEntriesAtom | null;
    synthesizeWeekData: (userId: string) => Promise<boolean>;
};

/** Używa Jotai do dostępu do stanu i symuluje złożoną logikę */
export const useChronicleService = () => {
    const [entries] = atom(kronikaEntriesAtom);

    // Filtrowanie dla Koszyka Aktywnego (ostatnie 7 dni)
    const getActiveWrites = (): KronikaEntry[] => {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        return entries.filter(entry => new Date(entry.timestamp).getTime() >= sevenDaysAgo);
    };

    // Mechanika Syntezy: Transakcyjna aktualizacja stanu
    const synthesizeWeekData = async (userId: string): Promise<boolean> => {
        console.log("⚡ Uruchomienie Syntezy 7 Dnia... START");
        
        const activeEntries = getActiveWrites();
        if (activeEntries.length === 0) {
            alert("Brak danych w aktywnym koszyku do syntezy.");
            return false;
        }

        // Sumowanie GRV
        const totalGrevPoints = activeEntries.reduce((sum, entry) => sum + entry.xp, 0);

        console.log(`[CORE] Przetwarzanie ${activeEntries.length} wpisów. Generowany wynik: ${totalGrevPoints} GRV.`);

        // Symulacja aktualizacji stanu portfela użytkownika
        const newWalletBalance = (await atom('userWalletAtom')).get() + totalGrevPoints;
        
        // Symulacja przeniesienia danych do historii i resetu aktywnego statusu
        const updatedEntries: KronikaEntry[] = entries.map(entry => {
            if (activeEntries.some(a => a.id === entry.id)) {
                return { ...entry, xp: 0 }; // Reset XP po syntezie
            }
            return entry;
        });

        // Zaktualizowanie globalnego stanu Jotai w transakcyjnym trybie
        atom(kronikaEntriesAtom).set([...updatedEntries]);
        await atom('userWalletAtom').set(newWalletBalance);

        alert(`[SUCCESS] Synteza zakończona! +${totalGrevPoints} GRV na konto. Nowy stan portfela: ${newWalletBalance}`);
        return true;
    };

    return {
        getActiveWrites,
        synthesizeWeekData,
    };
};

// Placeholder dla stanu Portfela Użytkownika (User Wallet)
export const userWalletAtom = atom<number>(1500); // Startowe saldo
