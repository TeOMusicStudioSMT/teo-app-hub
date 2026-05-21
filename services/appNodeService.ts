import { v4 as uuidv4 } from 'uuid';

export type StabilityLevel = 'FLASH' | 'FLUID' | 'STABLE' | 'GENESIS';
export type NodeType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'CODE';

export interface GravitonNode {
    id: string;
    name: string;
    content: string;
    type: NodeType;
    stability: StabilityLevel;
    mode: string;
    timestamp: number;
}

/** Węzeł z pełnymi metadanymi temporalnymi — produkt Quantum Forge Faza 1 */
export interface NodeAsset extends GravitonNode {
    /** Czas (epoch ms) kiedy asset zaczął powstawać (start nagrywania / drag-in) */
    timestamp_start: number;
    /** Punkt środkowy w czasie trwania assetu */
    timestamp_mid: number;
    /** Czas finalizacji (mint) */
    timestamp_end: number;
    /** Oryginalna nazwa pliku */
    fileName: string;
    /** Adres portfela właściciela, null jeśli niepodłączony */
    ownerAddress: string | null;
}

/**
 * Generuje tryplet NodeAsset: START / MID / END.
 * @param baseName     Nazwa base (bez sufiksu)
 * @param fileName     Oryginalna nazwa pliku
 * @param type         Typ assetu
 * @param stability    Klasa stabilności
 * @param mode         Globalny tryb (z electricBorderAtom)
 * @param ownerAddress Adres portfela (może być null)
 * @param durationMs   Czas trwania w ms (dla video/audio); fallback: 60 000
 */
export const generateNodeTriplet = (
    baseName: string,
    fileName: string,
    type: NodeType,
    stability: StabilityLevel,
    mode: string,
    ownerAddress: string | null,
    durationMs?: number,
): NodeAsset[] => {
    const ts_end   = Date.now();
    const span     = durationMs ?? 60_000;
    const ts_start = ts_end - span;
    const ts_mid   = ts_end - Math.floor(span / 2);

    const make = (suffix: 'START' | 'MID' | 'END', ts: number): NodeAsset => ({
        id:              `GRAV-${uuidv4().substring(0, 8).toUpperCase()}`,
        name:            `${baseName} [${suffix}]`,
        content:         fileName,
        type,
        stability,
        mode,
        timestamp:       ts,
        timestamp_start: ts_start,
        timestamp_mid:   ts_mid,
        timestamp_end:   ts_end,
        fileName,
        ownerAddress,
    });

    return [
        make('START', ts_start),
        make('MID',   ts_mid),
        make('END',   ts_end),
    ];
};

export const mintGravitonNode = (
    name: string, 
    content: string, 
    type: NodeType, 
    stability: StabilityLevel, 
    mode: string
): GravitonNode => {
    const node: GravitonNode = {
        id: `GRAV-${uuidv4().substring(0, 8).toUpperCase()}`,
        name,
        content,
        type,
        stability,
        mode,
        timestamp: Date.now()
    };

    console.log('🚀 [GRAVITON] Minting new node:', node);
    
    // Zapisujemy do localStorage dla trwałości w demo
    const existingNodes = JSON.parse(localStorage.getItem('graviton_nodes') || '[]');
    localStorage.setItem('graviton_nodes', JSON.stringify([...existingNodes, node]));

    return node;
};
