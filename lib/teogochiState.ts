/**
 * 🐣 teogochiState — serce małego kompana (mechanika tamagotchi, 0.00G).
 *
 * Zasady życia:
 *  - SYTOŚĆ karmi się MUZYKĄ: każda minuta słuchania radia = +2 sytości, +1 XP.
 *  - Smakołyk (wektor soniczny) = +18 sytości, +6 XP (max raz na 10 min — bez tuczenia).
 *  - Głaskanie = +10 nastroju (max raz na 2 min).
 *  - Sytość i nastrój opadają z czasem (także offline — liczone przy powrocie).
 *  - XP prowadzi przez etapy: jajko → pisklę → młodzik → kompan → legenda.
 *  Stan żyje w localStorage ('teogochi_state') — suwerennie, na urządzeniu.
 */

export type TeogochiStage = 'jajko' | 'pisklę' | 'młodzik' | 'kompan' | 'legenda';

export interface TeogochiState {
    name: string;
    xp: number;
    satiety: number;      // 0-100
    mood: number;         // 0-100
    hatchedAt: number | null;
    bornAt: number;
    lastTickAt: number;
    lastTreatAt: number;
    lastPetAt: number;
    minutesListened: number;
}

const KEY = 'teogochi_state';

export const STAGES: { stage: TeogochiStage; minXp: number; emoji: string; title: string }[] = [
    { stage: 'jajko',   minXp: 0,    emoji: '🥚', title: 'Cierpliwe Jajko' },
    { stage: 'pisklę',  minXp: 15,   emoji: '🐣', title: 'Świeżo Wykluty' },
    { stage: 'młodzik', minXp: 120,  emoji: '🐤', title: 'Muzyczny Młodzik' },
    { stage: 'kompan',  minXp: 600,  emoji: '🐥', title: 'Kompan Suwerena' },
    { stage: 'legenda', minXp: 2400, emoji: '🕊️', title: 'Legenda Katedry' },
];

export function stageOf(xp: number) {
    let cur = STAGES[0];
    for (const s of STAGES) if (xp >= s.minXp) cur = s;
    return cur;
}

export function nextStageOf(xp: number) {
    return STAGES.find(s => s.minXp > xp) ?? null;
}

function fresh(): TeogochiState {
    const now = Date.now();
    return {
        name: 'TeOgochi', xp: 0, satiety: 70, mood: 70,
        hatchedAt: null, bornAt: now, lastTickAt: now,
        lastTreatAt: 0, lastPetAt: 0, minutesListened: 0,
    };
}

export function loadTeogochi(): TeogochiState {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return fresh();
        const s = { ...fresh(), ...JSON.parse(raw) } as TeogochiState;
        return applyDecay(s);
    } catch { return fresh(); }
}

export function saveTeogochi(s: TeogochiState): void {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* brak localStorage */ }
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Opad z czasu (też offline): sytość -1.5/h, nastrój -1/h — łagodnie, bez dramy. */
function applyDecay(s: TeogochiState): TeogochiState {
    const now = Date.now();
    const hours = (now - s.lastTickAt) / 3_600_000;
    if (hours <= 0) return s;
    return {
        ...s,
        satiety: clamp(s.satiety - hours * 1.5),
        mood: clamp(s.mood - hours * 1),
        lastTickAt: now,
    };
}

/** Minuta słuchania radia = karmienie muzyką. Wyklucie przy pierwszym progu XP. */
export function tickListening(s: TeogochiState): TeogochiState {
    const next = applyDecay(s);
    next.satiety = clamp(next.satiety + 2);
    next.mood = clamp(next.mood + 0.5);
    next.xp += 1;
    next.minutesListened += 1;
    if (!next.hatchedAt && next.xp >= STAGES[1].minXp) next.hatchedAt = Date.now();
    return { ...next };
}

/** Smakołyk: plik wektorów sonicznych. Cooldown 10 min. */
export function feedTreat(s: TeogochiState): { state: TeogochiState; ok: boolean } {
    const now = Date.now();
    if (now - s.lastTreatAt < 600_000) return { state: s, ok: false };
    const next = applyDecay(s);
    next.satiety = clamp(next.satiety + 18);
    next.mood = clamp(next.mood + 4);
    next.xp += 6;
    next.lastTreatAt = now;
    if (!next.hatchedAt && next.xp >= STAGES[1].minXp) next.hatchedAt = now;
    return { state: { ...next }, ok: true };
}

/** Głaskanie. Cooldown 2 min. */
export function pet(s: TeogochiState): { state: TeogochiState; ok: boolean } {
    const now = Date.now();
    if (now - s.lastPetAt < 120_000) return { state: s, ok: false };
    const next = applyDecay(s);
    next.mood = clamp(next.mood + 10);
    next.lastPetAt = now;
    return { state: { ...next }, ok: true };
}

/** Słowny opis nastroju — do UI i do promptu AI (kompan mówi jak się czuje). */
export function moodLabel(s: TeogochiState): string {
    if (s.satiety < 20) return 'głodny i marudny';
    if (s.mood >= 80 && s.satiety >= 60) return 'promienieje szczęściem';
    if (s.mood >= 55) return 'zadowolony';
    if (s.mood >= 30) return 'zamyślony';
    return 'smutny, potrzebuje czułości';
}
