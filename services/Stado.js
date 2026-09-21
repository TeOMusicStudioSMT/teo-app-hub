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

export async function stan() { return czytaj(); }

/**
 * Scal delta z przeglądarki. { aktywny?, wyklute?: string[], stany?: { id: state }, wymus?: boolean }
 * Zwraca stan po scaleniu + `odrzucone` (gatunki, których XP był niższy niż na dysku).
 */
export async function scal(delta = {}) {
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
    return { ...d, odrzucone };
}

export default { stan, scal };
