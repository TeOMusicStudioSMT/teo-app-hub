/**
 * 🗂️ StolPamiec — trwały dyskowy zapis historii rozmowy i aktywnego zadania
 * każdego agenta przy Kwantowym Stole Narad.
 *
 * Pliki: _OtakOs_Wymiar/stol-pamiec/<agent>.json
 * Format: { agent, aktywneZadanie, historia, zaktualizowano }
 *
 * Zapis atomowy (tmp → rename) z kolejką poKolei (jak Stado.js, patent 2026-11-09).
 */

import fs from 'fs/promises';
import path from 'path';
import * as Stado from './Stado.js';

const KATALOG = () => path.join(process.cwd(), '_OtakOs_Wymiar', 'stol-pamiec');
const PLIK_AGENTA = (id) => path.join(KATALOG(), `${id}.json`);
const ID_OK = (id) => /^[a-z0-9_-]{1,32}$/i.test(String(id || ''));
const PUSTA = (agent) => ({ agent, aktywneZadanie: null, historia: [], zaktualizowano: null });

// Mapa cooldownu EXP per agent (30s)
const ostatniXpCzas = new Map();

// --- Atomowy zapis (Windows: EPERM/EBUSY retry jak Stado.js) ---
async function atomicWrite(plik, dane) {
    await fs.mkdir(path.dirname(plik), { recursive: true });
    const tmp = `${plik}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(dane, null, 2), 'utf8');
    for (let i = 0; ; i++) {
        try { await fs.rename(tmp, plik); return; }
        catch (e) {
            if (i >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) {
                await fs.rm(tmp, { force: true }).catch(() => {});
                throw e;
            }
            await new Promise((r) => setTimeout(r, 15 * (i + 1)));
        }
    }
}

async function czytajAgenta(id) {
    try {
        const j = JSON.parse(await fs.readFile(PLIK_AGENTA(id), 'utf8'));
        return {
            agent: String(j.agent || id),
            aktywneZadanie: j.aktywneZadanie ?? null,
            historia: Array.isArray(j.historia) ? j.historia : [],
            zaktualizowano: j.zaktualizowano ?? null,
        };
    } catch { return PUSTA(id); }
}

// --- Kolejka zapisów po kolei (jeden plik na agenta) ---
const ogony = {};
const poKolei = (id, fn) => {
    if (!ogony[id]) ogony[id] = Promise.resolve();
    const w = ogony[id].then(fn, fn);
    ogony[id] = w.catch(() => {});
    return w;
};

// --- API publiczne ---

/** Lista pamięci wszystkich agentów (pliki .json z katalogu). */
export async function lista() {
    try {
        await fs.mkdir(KATALOG(), { recursive: true });
        const pliki = (await fs.readdir(KATALOG())).filter(f => f.endsWith('.json'));
        const wyniki = await Promise.all(
            pliki.map(async (f) => {
                try { return JSON.parse(await fs.readFile(path.join(KATALOG(), f), 'utf8')); }
                catch { return null; }
            })
        );
        return wyniki.filter(Boolean);
    } catch { return []; }
}

/** Pamięć konkretnego agenta. Zwraca pusty rekord gdy brak pliku. */
export async function pobierz(id) {
    if (!ID_OK(id)) throw Object.assign(new Error('Nieprawidłowy ID agenta.'), { status: 400 });
    return czytajAgenta(id);
}

/**
 * Zapisz/aktualizuj pamięć agenta.
 * @param {string} id  ID agenta (^[a-z0-9_-]{1,32}$)
 * @param {{ aktywneZadanie?: any, historia?: object|object[], xpPrzyrost?: number }} delta
 */
export function zapisz(id, delta = {}) {
    if (!ID_OK(id)) return Promise.reject(Object.assign(new Error('Nieprawidłowy ID agenta.'), { status: 400 }));
    return poKolei(id, async () => {
        const d = await czytajAgenta(id);
        if (delta.aktywneZadanie !== undefined) d.aktywneZadanie = delta.aktywneZadanie;
        if (delta.historia !== undefined) {
            const wpis = Array.isArray(delta.historia) ? delta.historia : [delta.historia];
            d.historia = [...d.historia, ...wpis].slice(-200); // maks. 200 wpisów
        }
        d.zaktualizowano = new Date().toISOString();
        await atomicWrite(PLIK_AGENTA(id), d);

        // Maksymalnie 10 EXP, serwerowy cooldown 30s
        const xp = Math.max(0, Math.min(10, Math.round(Number(delta.xpPrzyrost) || 0)));
        if (xp > 0) {
            const teraz = Date.now();
            const ostatnio = ostatniXpCzas.get(id) || 0;
            if (teraz - ostatnio >= 30000) {
                ostatniXpCzas.set(id, teraz);
                try {
                    const stadoStan = await Stado.stan().catch(() => null);
                    const aktywnyJajo = stadoStan?.aktywny || 'joanna';
                    // Nagródź aktywne Jajo / TeOgochi w stadzie
                    await Stado.nagrodz({
                        id: aktywnyJajo,
                        xp,
                        klucz: `stol-jajo-${id}-${teraz}`,
                        powod: `Kwantowy Stół Narad (${id})`,
                    }).catch(() => {});
                    // Jeśli agent to inny ID, nagródź również pod id agenta
                    if (id !== aktywnyJajo) {
                        await Stado.nagrodz({
                            id,
                            xp,
                            klucz: `stol-${id}-${teraz}`,
                            powod: 'Wypowiedź przy Kwantowym Stole Narad',
                        }).catch(() => {});
                    }
                } catch (e) {
                    // Cicha tarcza - błąd nagrody nie psuje zapisu pamięci
                }
            }
        }
        return d;
    });
}

export default { lista, pobierz, zapisz };
