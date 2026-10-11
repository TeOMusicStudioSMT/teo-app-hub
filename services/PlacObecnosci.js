/**
 * 👥 PLAC OBECNOŚCI — gracze widzą się nawzajem na wyspie Katedry (krok 3, Suweren 2026-10-11).
 *
 * Gra dalej liczy się u GRAJĄCEGO. Most gospodarza jest tylko tablicą meldunków: każdy gracz co ~0,4 s podaje,
 * gdzie stoi (pozycja, obrót, ruch, imię, ciało), a w odpowiedzi dostaje, gdzie stoją inni. Wszystko w pamięci —
 * bez dysku, bez modeli, bez ComfyUI. Po `ZYWOTNOSC_MS` ciszy gracz znika z placu.
 *
 * Ochrona komputera gospodarza: najwyżej `max` graczy na placu jednej gry (nowy ponad limit → `pelny`),
 * meldunek częściej niż `MIN_ODSTEP_MS` nie zmienia stanu, ≤ 3 graczy z jednego adresu, pola ucięte i sprawdzone.
 * Ciało gracza przechodzi TYLKO jako nazwa pliku z assetów udostępnionej gry (sprawdza `czyCialo`) — inaczej
 * kapsuła: obcy adres GLB nie trafi do przeglądarek innych graczy.
 */

export const ZYWOTNOSC_MS = 10_000;
export const MIN_ODSTEP_MS = 150;
const MAX_Z_ADRESU = 3;
const ID = /^[a-z0-9]{8,32}$/;
const PLIK_CIALA = /^[a-z0-9][a-z0-9._-]{0,90}\.glb$/i;

const liczba = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0; };
/** Imię do pokazania innym: bez znaków sterujących, ≤ 24 znaki (rysowane na płótnie, nie jako HTML). */
export const imieGracza = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Wędrowiec';

/**
 * @param {{ max?: number, teraz?: () => number, czyCialo?: (gra: string, plik: string) => Promise<boolean> }} o
 */
export function utworzPlac({ max = Number(process.env.OTAKOS_GOSCIE_MAX || 8) + 1, teraz = () => Date.now(), czyCialo = async () => false } = {}) {
    /** gra → Map(id → wpis) */
    const place = new Map();
    const cialaOk = new Map();   // `${gra}|${plik}` → bool (pamięć sprawdzeń pliku)

    const plac = (gra) => { let p = place.get(gra); if (!p) { p = new Map(); place.set(gra, p); } return p; };
    function sprzataj(p) { const g = teraz() - ZYWOTNOSC_MS; for (const [id, w] of p) if (w.kiedy < g) p.delete(id); }
    const publiczny = (w) => ({ id: w.id, imie: w.imie, cialo: w.cialo, gosc: w.gosc, x: w.x, y: w.y, z: w.z, rot: w.rot, ruch: w.ruch, wiek: teraz() - w.kiedy });

    async function cialo(gra, plik) {
        if (typeof plik !== 'string' || !PLIK_CIALA.test(plik)) return null;
        const k = `${gra}|${plik}`;
        if (!cialaOk.has(k)) cialaOk.set(k, await czyCialo(gra, plik).catch(() => false));
        return cialaOk.get(k) ? plik : null;
    }

    /** Meldunek gracza → { ja, inni, pelny }. `kto` = adres gracza (cf-connecting-ip). */
    async function melduj(gra, kto, d = {}) {
        const id = String(d.id ?? '');
        if (!ID.test(id)) throw new Error('Zły identyfikator gracza (8–32 znaki a–z0–9).');
        const p = plac(gra);
        sprzataj(p);
        let w = p.get(id);
        if (!w) {
            if (p.size >= max) return { ja: null, pelny: true, inni: [...p.values()].map(publiczny), max };
            if ([...p.values()].filter((x) => x.kto === kto).length >= MAX_Z_ADRESU) throw new Error(`Z jednego adresu najwyżej ${MAX_Z_ADRESU} graczy na placu.`);
            w = { id, kto, kiedy: 0 };
            p.set(id, w);
        } else if (w.kto !== kto) throw new Error('Ten identyfikator gracza należy do innego adresu.');
        if (teraz() - w.kiedy >= MIN_ODSTEP_MS) {
            Object.assign(w, {
                imie: imieGracza(d.imie), cialo: await cialo(gra, d.cialo), gosc: d.gosc === true,
                x: liczba(d.x, -500, 500), y: liczba(d.y, -50, 200), z: liczba(d.z, -500, 500), rot: liczba(d.rot, -10, 10),
                ruch: ['stoi', 'idzie', 'biegnie'].includes(d.ruch) ? d.ruch : 'stoi', kiedy: teraz(),
            });
        }
        return { ja: id, pelny: false, inni: [...p.values()].filter((x) => x.id !== id && x.imie !== undefined).map(publiczny), max };
    }

    /** Gracz wychodzi (zamknięta karta) — znika od razu. */
    function wyjdz(gra, kto, id) {
        const p = place.get(gra);
        const w = p?.get(String(id ?? ''));
        if (w && w.kto === kto) p.delete(w.id);
        return !!w;
    }

    /** Dla panelu Katedry: ilu graczy na placach (bez adresów). */
    function stan() {
        const out = {};
        for (const [gra, p] of place) { sprzataj(p); if (p.size) out[gra] = { graczy: p.size, imiona: [...p.values()].map((w) => w.imie).filter(Boolean) }; }
        return { max, place: out };
    }

    return { melduj, wyjdz, stan };
}

export default { utworzPlac, imieGracza, ZYWOTNOSC_MS, MIN_ODSTEP_MS };
