/**
 * 🧠 Mózg Katedry — JEDNO źródło prawdy o tym, na czym Katedra myśli (Suweren 2026-10-11: „błędy z małymi modelami są,
 * bo gdzieś rury nie dochodzą… potrzebujemy jednego miejsca, a teraz w samym głównym studio są 3 miejsca”).
 *
 * Dotąd: Hub trzymał model w przeglądarce w trzech miejscach (Sterowanie Rdzeniem, czat Katedry, Terminal Zero —
 * każde swój klucz localStorage), a most miał WŁASNY, wpisany na sztywno `gemma4:e2b` w ~30 trasach — także tam, gdzie
 * pracuje konkretny TeOgochi z przydziałem (Reżyser Story Studio rozmawiał na e2b, choć przydział miał 26B).
 *
 * Teraz:
 *  · `_OtakOs_Wymiar/mozg-katedry.json` {lokalny, lokalnyCiezki, chmuraLekki, chmuraCiezki} — Hub czyta go przy starcie
 *    i zapisuje tylko przez `PUT /api/mozg`; most bierze stąd `domyslny()` (dawny DEFAULT_LLM).
 *  · `modelRoli(rola)` = przydział TeOgochi (ModeleAgentow) → domyślny Katedry. Trasy z rolą pytają tędy.
 *  · Kolejność domyślnego: plik → `OTAKOS_MODEL` → zapas (`gemma4:e2b`).
 */
import fs from 'fs';
import path from 'path';

export const ZAPAS = 'gemma4:e2b';
const MODEL = /^[A-Za-z0-9._:\/-]{2,120}$/;
export const POLA = ['lokalny', 'lokalnyCiezki', 'chmuraLekki', 'chmuraCiezki'];

/** Czyste pola (zła nazwa = odrzucona z powodem, pusty napis = usuń wpis). */
export function oczyscPola(d = {}) {
    const out = {};
    for (const k of POLA) {
        if (!(k in d)) continue;
        const v = String(d[k] ?? '').trim();
        if (v && !MODEL.test(v)) throw new Error(`Zła nazwa modelu w „${k}”: ${v.slice(0, 60)}`);
        out[k] = v;
    }
    return out;
}

/**
 * @param {{ katalog: string, agenci: { modelZPamieci: (id:string)=>string|null, wszystkie: ()=>Promise<object> }, env?: Record<string,string|undefined> }} o
 */
export function utworzMozg({ katalog, agenci, env = process.env }) {
    const plik = path.join(katalog, 'mozg-katedry.json');
    let stan = {};
    const wczytaj = () => { try { stan = JSON.parse(fs.readFileSync(plik, 'utf8')) ?? {}; } catch { stan = {}; } return stan; };
    wczytaj();
    void agenci.wszystkie().catch(() => null);   // pamięć przydziału TeOgochi od startu (modelZPamieci)

    /** Domyślny silnik Katedry (dawny DEFAULT_LLM): plik → OTAKOS_MODEL → zapas. */
    const domyslny = () => stan.lokalny || env.OTAKOS_MODEL || ZAPAS;
    const zrodloDomyslnego = () => (stan.lokalny ? 'mozg' : env.OTAKOS_MODEL ? 'OTAKOS_MODEL' : 'zapas');
    /** Model roli (id gatunku TeOgochi): przydział → domyślny Katedry. */
    const modelRoli = (rola) => (rola && agenci.modelZPamieci(rola)) || domyslny();

    function ustaw(d) {
        const z = oczyscPola(d);
        const nowy = { ...wczytaj() };
        for (const [k, v] of Object.entries(z)) { if (v) nowy[k] = v; else delete nowy[k]; }
        fs.mkdirSync(katalog, { recursive: true });
        fs.writeFileSync(`${plik}.tmp`, JSON.stringify(nowy, null, 2), 'utf8');
        fs.renameSync(`${plik}.tmp`, plik);
        stan = nowy;
        return opis();
    }
    const opis = () => ({ ...stan, domyslny: domyslny(), zrodlo: zrodloDomyslnego(), zapas: ZAPAS });
    return { domyslny, modelRoli, ustaw, opis, wczytaj };
}
