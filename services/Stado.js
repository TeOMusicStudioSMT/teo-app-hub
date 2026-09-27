/**
 * 🥚 Stado — ŹRÓDŁO PRAWDY dla XP i stanu TeOgochi (od 2026-09-21).
 *
 * Suweren: „zrób most jako źródło prawdy dla XP". Do tej pory XP, sytość, nastrój
 * i wyklucie żyły WYŁĄCZNIE w localStorage przeglądarki; jedno „wyczyść dane witryny"
 * skasowało Legendę Joanny (11 923 XP). Teraz stan leży na dysku Katedry:
 *
 *   _OtakOs_Wymiar/stado.json  →  { wersja, aktywny, wyklute:[id], stany:{ id: TeogochiState }, zmieniono }
 *
 * Przeglądarka jest tylko PAMIĘCIĄ PODRĘCZNĄ: przy starcie ściąga stąd (lib/stadoSync.ts),
 * każdy zapis odsyła tu. Reguła scalania jest jedna i prosta:
 *   XP W GRZE TYLKO ROŚNIE. Zapis z niższym XP niż na dysku = przeglądarka ze starym
 *   albo pustym stanem → odrzucamy TEN gatunek (reszta wchodzi) i mówimy o tym w odpowiedzi.
 *   Sytość/nastrój/liczniki bierzemy z przeglądarki bez dyskusji — one żyją w czasie
 *   rzeczywistym i mają prawo spadać.
 *
 * Migawka dla apki na telefon (MostStada) zostaje osobno — to widok, nie stan.
 */

import fs from 'fs/promises';
import path from 'path';

const PLIK = () => path.join(process.cwd(), '_OtakOs_Wymiar', 'stado.json');
const PUSTE = () => ({ wersja: 1, aktywny: 'joanna', wyklute: ['joanna'], stany: {}, zmieniono: null });
const ID_OK = (id) => /^[a-z0-9_-]{1,40}$/i.test(String(id || ''));

async function czytaj() {
    try {
        const j = JSON.parse(await fs.readFile(PLIK(), 'utf8'));
        return { ...PUSTE(), ...j, wyklute: Array.isArray(j.wyklute) ? j.wyklute : ['joanna'], stany: j.stany && typeof j.stany === 'object' ? j.stany : {} };
    } catch { return PUSTE(); }
}

async function zapisz(d) {
    await fs.mkdir(path.dirname(PLIK()), { recursive: true });
    const tmp = `${PLIK()}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(d, null, 2), 'utf8');
    await fs.rename(tmp, PLIK());
}

/** Tylko pola stanu TeOgochi, z liczbami jako liczby — nic obcego z przeglądarki do pliku. */
function oczysc(s) {
    if (!s || typeof s !== 'object') return null;
    const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
    return {
        name: String(s.name || '').slice(0, 40),
        xp: Math.max(0, n(s.xp)),
        satiety: n(s.satiety, 70), mood: n(s.mood, 70),
        hatchedAt: s.hatchedAt == null ? null : n(s.hatchedAt, null),
        bornAt: n(s.bornAt, Date.now()), lastTickAt: n(s.lastTickAt, Date.now()),
        lastTreatAt: n(s.lastTreatAt), lastPetAt: n(s.lastPetAt),
        minutesListened: n(s.minutesListened),
        lastFavoriteAt: n(s.lastFavoriteAt), favoritesPlayed: n(s.favoritesPlayed),
    };
}

/** Stan dla Huba — bez rejestru nagród (klucze jednokrotności to księgowość mostu, nie stan). */
export async function stan() { const { nagrody, ...d } = await czytaj(); return d; }

// Zapisy po kolei: scal (przeglądarka) i nagrodz (praca stada) czytają-zmieniają-piszą ten sam plik —
// dwa naraz = jedna zmiana zgubiona. Ogon obietnic szereguje je w obrębie mostu.
let ogon = Promise.resolve();
const poKolei = (fn) => { const w = ogon.then(fn, fn); ogon = w.catch(() => {}); return w; };

/**
 * Progi etapów — KOPIA `STAGES` z lib/teogochiState.ts (most nie importuje TS-a). Zmieniasz tam,
 * zmień i tu: Świat i StoL liczą z tego etap po nagrodzie, zanim Dom TeOgochi opublikuje nową migawkę.
 */
export const ETAPY = [[0, 'jajko'], [15, 'pisklę'], [120, 'młodzik'], [600, 'kompan'], [2400, 'legenda']];
export const etapZXp = (xp) => ETAPY.filter(([min]) => xp >= min).at(-1)[1];

/** XP za prawdziwą pracę dla stada (wkład, oddane zlecenie, sentencja). */
export const NAGRODY = { wklad: 25, biblia: 40, zlecenie: 15, sentencja: 5 };
const MAX_KLUCZY = 5000;

/**
 * Nagródź TeOgochi za pracę. `klucz` = jednokrotność (ta sama praca płaci RAZ — ponowienie zlecenia,
 * restart mostu czy drugie nagranie powitania nie drukują XP). XP tylko rośnie, więc przeglądarka
 * ze starszym stanem dostanie przy najbliższym zapisie „odrzucone" i weźmie stan z mostu.
 * @param {{ id:string, xp:number, klucz:string, powod?:string, baza?:number }} o  baza = XP z migawki Domu
 * @returns {{ przyznane:boolean, xp:number, powod?:string }}
 */
export function nagrodz({ id, xp, klucz, powod = '', baza = 0 }) {
    return poKolei(async () => {
        if (!ID_OK(id)) return { przyznane: false, xp: 0, powod: 'Nieznany TeOgochi.' };
        const ile = Math.max(0, Math.min(500, Math.round(Number(xp) || 0)));
        if (!ile || !klucz) return { przyznane: false, xp: 0, powod: 'Brak XP albo klucza jednokrotności.' };
        const d = await czytaj();
        d.nagrody = d.nagrody && typeof d.nagrody === 'object' ? d.nagrody : {};
        const k = String(klucz).slice(0, 200);
        if (d.nagrody[k]) return { przyznane: false, xp: d.stany[id]?.xp ?? 0, powod: 'Ta praca już została nagrodzona.' };
        const teraz = Date.now();
        const s = d.stany[id] ?? oczysc({ xp: 0, bornAt: teraz, lastTickAt: teraz });
        // `baza` = XP z migawki Domu TeOgochi: gatunek, którego przeglądarka jeszcze nie zsynchronizowała,
        // nie może dostać nagrody „od zera" (późniejszy zapis przeglądarki by ją przykrył). XP tylko rośnie,
        // więc wyższa z dwóch wartości jest prawdziwa.
        s.xp = Math.max(Number(s.xp) || 0, Number(baza) || 0) + ile;
        if (s.hatchedAt == null && s.xp >= ETAPY[1][0]) s.hatchedAt = teraz;
        d.stany[id] = s;
        d.nagrody[k] = { id, xp: ile, powod: String(powod).slice(0, 160), kiedy: new Date(teraz).toISOString() };
        const klucze = Object.keys(d.nagrody);
        if (klucze.length > MAX_KLUCZY) for (const stary of klucze.slice(0, klucze.length - MAX_KLUCZY)) delete d.nagrody[stary];
        d.zmieniono = new Date(teraz).toISOString();
        await zapisz(d);
        return { przyznane: true, xp: s.xp, dodano: ile };
    });
}

/**
 * Scal delta z przeglądarki. { aktywny?, wyklute?: string[], stany?: { id: state }, wymus?: boolean }
 * Zwraca stan po scaleniu + `odrzucone` (gatunki, których XP był niższy niż na dysku).
 */
export function scal(delta = {}) { return poKolei(() => scalTeraz(delta)); }
async function scalTeraz(delta) {
    const d = await czytaj();
    const odrzucone = [];
    if (delta.stany && typeof delta.stany === 'object') {
        for (const [id, surowy] of Object.entries(delta.stany)) {
            if (!ID_OK(id)) continue;
            const nowy = oczysc(surowy);
            if (!nowy) continue;
            const stary = d.stany[id];
            if (stary && nowy.xp < stary.xp && !delta.wymus) {
                odrzucone.push({ id, naDysku: stary.xp, przyszlo: nowy.xp });
                continue;
            }
            d.stany[id] = nowy;
        }
    }
    if (Array.isArray(delta.wyklute)) {
        // Wyklucie nie cofa się samo — suma zbiorów. (Cofnąć można tylko `wymus`.)
        const nowe = delta.wyklute.filter(ID_OK).map(String);
        d.wyklute = delta.wymus ? [...new Set(['joanna', ...nowe])] : [...new Set(['joanna', ...d.wyklute, ...nowe])];
    }
    if (delta.aktywny && ID_OK(delta.aktywny)) d.aktywny = String(delta.aktywny);
    d.zmieniono = new Date().toISOString();
    await zapisz(d);
    const { nagrody, ...bez } = d;
    return { ...bez, odrzucone };
}

export default { stan, scal, nagrodz, etapZXp, ETAPY, NAGRODY };
