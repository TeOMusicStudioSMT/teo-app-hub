/**
 * 🧠 Stan OtakOS — rejestr modeli i przebieg zadania.
 *
 * ⚠️ TO ZASTĘPUJE `redux/store/otakOSSlice.ts`. Pomysł Rady był słuszny — jedno
 * miejsce na rejestr wag, status workflow i historię — ale napisany na Reduksie,
 * którego w Katedrze NIE MA (`@reduxjs/toolkit` i `react-redux` nie są nawet
 * zainstalowane; kompilator odbijał oba importy). Katedra stoi na **jotai**.
 * Dokładanie drugiego systemu stanu dla jednego wycinka dałoby dwa źródła prawdy
 * o tym samym — a to już przerabialiśmy przy saldzie GRV.
 *
 * Kształt stanu i nazwy akcji zostają, żeby dalsza praca Rady nie poszła w kosz.
 */
import { atom } from 'jotai';
import type { ModelResource } from '../services/ModelRegistryService';

export type StatusWorkflow = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';

export interface WpisHistorii {
    timestamp: number;
    workflowId: string;
    result: unknown;
}

/** Rejestr wag — wypełnia go `scanAndInitializeModels()` przez most. */
export const modelRegistryAtom = atom<ModelResource[]>([]);

/** Katalog, z którego przyszedł rejestr — do pokazania Suwerenowi wprost. */
export const modelKatalogAtom = atom<string>('');

/** Czy most odpowiedział. `null` = jeszcze nie pytaliśmy. */
// Typ wartości początkowej podajemy ZMIENNĄ, nie generykiem: `atom(null)`
// wywnioskowałby atom tylko do odczytu i `useSetAtom` by go odbił, a wersja
// z własnym zapisem wołałaby samą siebie w nieskończoność.
const rejestrZywyStart: boolean | null = null;
export const rejestrZywyAtom = atom(rejestrZywyStart);

export const workflowStatusAtom = atom<StatusWorkflow>('IDLE');

export const workflowHistoryAtom = atom<WpisHistorii[]>([]);

/**
 * Usługi, które Katedra faktycznie wystawia.
 * ⚠️ Pierwotna lista („YouTubeAgent", „FileProcessor") była wpisana na sztywno
 * i nie odpowiadała niczemu w kodzie. Pusta lista jest uczciwsza niż wymyślona:
 * uzupełnia ją ten, kto naprawdę podłączy usługę.
 */
export const activeServicesAtom = atom<string[]>([]);

/** Dopisz przebieg do historii — odpowiednik `recordWorkflowRun`. */
export const recordWorkflowRunAtom = atom(
    null,
    (get, set, wpis: { id: string; result: unknown }) => {
        set(workflowHistoryAtom, [
            ...get(workflowHistoryAtom),
            { timestamp: Date.now(), workflowId: wpis.id, result: wpis.result },
        ]);
    },
);

export default {
    modelRegistryAtom, modelKatalogAtom, rejestrZywyAtom,
    workflowStatusAtom, workflowHistoryAtom, activeServicesAtom, recordWorkflowRunAtom,
};
