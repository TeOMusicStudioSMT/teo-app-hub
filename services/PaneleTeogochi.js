/**
 * 🥚🛠️ Kreator paneli TeOgochi — warsztat dla gatunków, które go nie mają.
 *
 * Osiem z trzynastu gatunków wykluwa się i... nie ma czym pracować. Karta mówi
 * o tym wprost („panel jeszcze nie powstał"), ale uczciwy komunikat nie zastąpi
 * narzędzia. Ten moduł pozwala Suwerenowi ZBUDOWAĆ panel przy pierwszym wejściu.
 *
 * ⚠️ SEDNO — I DLATEGO TO NIE JEST GENERATOR ATRAP:
 * panel może dostać WYŁĄCZNIE narzędzia, które most naprawdę wystawia. Katalog
 * domen nie jest wpisaną ręcznie listą życzeń, tylko odczytem z żywego routera
 * Express (`app.router.stack`). Gdy trasa nie istnieje, nie da się jej wybrać —
 * a gdy zniknie po aktualizacji, panel przy zapisie zostanie odrzucony zamiast
 * pokazywać guzik prowadzący donikąd.
 *
 * Jajo (wygląd na pięciu etapach) jest kosmetyką i mówimy to wprost. Losowanie
 * jest DETERMINISTYCZNE z ziarna: to samo ziarno = to samo jajo, więc da się je
 * odtworzyć na innym węźle bez przesyłania obrazków.
 *
 * Panele leżą w `_OtakOs_Wymiar/panele-teogochi.json` — po stronie MOSTU, nie w
 * przeglądarce. To celowe: dzienny zrzut do skarbca Otakos.wtf zbiera pliki
 * z dysku, a czego nie ma na dysku, tego nie ma w zrzucie.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const PLIK = () => path.join(process.cwd(), '_OtakOs_Wymiar', 'panele-teogochi.json');

/** Grupy tras, których NIE proponujemy jako narzędzi gatunku. */
const POMIJANE = new Set(['shutdown', 'health', 'ping']);

// ── KATALOG PRAWDZIWYCH TRAS ────────────────────────────────────────────────

/**
 * Wyciąga z żywej aplikacji Express listę zarejestrowanych tras.
 * Express 5 trzyma je w `app.router`, Express 4 w `app._router` — sprawdzamy oba,
 * bo zgadywanie wersji frameworka to proszenie się o pustą listę po aktualizacji.
 */
export function zywetrasy(app) {
    const stos = app?.router?.stack ?? app?._router?.stack ?? [];
    const out = [];
    for (const warstwa of stos) {
        const r = warstwa?.route;
        if (!r?.path || typeof r.path !== 'string') continue;
        if (!r.path.startsWith('/api/')) continue;
        for (const metoda of Object.keys(r.methods || {})) {
            if (metoda === '_all') continue;
            out.push({ metoda: metoda.toUpperCase(), sciezka: r.path });
        }
    }
    return out;
}

/** Nazwa parametru w trasie: `/api/grv/:id` → ['id']. */
function parametry(sciezka) {
    return (sciezka.match(/:[A-Za-z0-9_]+/g) ?? []).map(s => s.slice(1));
}

/**
 * Trasy pogrupowane w DOMENY po drugim segmencie (`/api/<domena>/...`).
 * To jest lista, z której Suweren wybiera dziedzinę nowego panelu.
 */
export function katalogDomen(app) {
    const mapa = new Map();
    for (const t of zywetrasy(app)) {
        const seg = t.sciezka.split('/')[2] || '';
        if (!seg || POMIJANE.has(seg)) continue;
        if (!mapa.has(seg)) mapa.set(seg, []);
        mapa.get(seg).push({ ...t, parametry: parametry(t.sciezka) });
    }
    return [...mapa.entries()]
        .map(([id, narzedzia]) => ({
            id,
            prefiks: `/api/${id}`,
            narzedzia: narzedzia.sort((a, b) => a.sciezka.localeCompare(b.sciezka)),
            ile: narzedzia.length,
        }))
        .sort((a, b) => b.ile - a.ile);
}

// ── JAJO ────────────────────────────────────────────────────────────────────

/** Pule form na każdy etap. Losowanie wybiera po jednej — linia ma być spójna. */
const PULE = {
    'jajko': ['🥚', '🪺', '🧿', '🔮', '💠', '🌰'],
    'pisklę': ['🐣', '🐛', '🦐', '🐍', '🦠', '🐚', '🪲', '🦂'],
    'młodzik': ['🐤', '🦎', '🦀', '🐡', '🦔', '🐇', '🦇', '🦑'],
    'kompan': ['🐥', '🦅', '🦩', '🐺', '🦊', '🐬', '🦉', '🐲'],
    'legenda': ['🕊️', '🔥', '🌟', '🐉', '🦄', '👑', '⚡', '🌌'],
};
const BARWY = ['#a855f7', '#22d3ee', '#fbbf24', '#ec4899', '#10b981', '#f97316',
    '#14b8a6', '#ef4444', '#84cc16', '#eab308', '#f43f5e', '#8b5cf6', '#06b6d4'];

/** Deterministyczny generator z ziarna — to samo ziarno daje to samo jajo. */
function zZiarna(ziarno) {
    let h = 2166136261;
    for (const z of String(ziarno)) { h ^= z.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Wylosuj jajo. Wygląd jest KOSMETYKĄ — nie daje agentowi żadnej mocy i nie
 * powinien udawać, że daje. Ziarno wraca w wyniku, żeby dało się je odtworzyć.
 */
export function losujJajo(ziarno) {
    const z = ziarno || crypto.randomBytes(4).toString('hex');
    const rnd = zZiarna(z);
    const wybierz = (pula) => pula[Math.floor(rnd() * pula.length) % pula.length];
    return {
        ziarno: z,
        formy: {
            'jajko': wybierz(PULE['jajko']),
            'pisklę': wybierz(PULE['pisklę']),
            'młodzik': wybierz(PULE['młodzik']),
            'kompan': wybierz(PULE['kompan']),
            'legenda': wybierz(PULE['legenda']),
        },
        kolor: wybierz(BARWY),
    };
}

const ETAPY = ['jajko', 'pisklę', 'młodzik', 'kompan', 'legenda'];

/** Sprawdź jajo zaprojektowane ręcznie. Braki uzupełniamy, śmieci odrzucamy. */
export function sprawdzJajo(jajo) {
    if (!jajo || typeof jajo !== 'object') return { ok: false, powod: 'Brak opisu jaja.' };
    const formy = {};
    for (const e of ETAPY) {
        const v = String(jajo.formy?.[e] ?? '').trim();
        // Jeden znak-emoji to zwykle 1-3 jednostki UTF-16 plus modyfikatory.
        if (!v || [...v].length > 4) return { ok: false, powod: `Etap „${e}": podaj jeden znak.` };
        formy[e] = v;
    }
    const kolor = /^#[0-9a-fA-F]{6}$/.test(String(jajo.kolor || '')) ? jajo.kolor : BARWY[0];
    return { ok: true, jajo: { ziarno: jajo.ziarno || 'własne', formy, kolor } };
}

// ── SKŁAD PANELI ────────────────────────────────────────────────────────────

async function czytaj() {
    try { return JSON.parse(await fs.readFile(PLIK(), 'utf8')); }
    catch { return { wersja: 1, panele: [] }; }
}
async function zapisz(d) {
    await fs.mkdir(path.dirname(PLIK()), { recursive: true });
    await fs.writeFile(PLIK(), JSON.stringify(d, null, 2), 'utf8');
}

export async function wczytajPanele() {
    return czytaj();
}

/**
 * Zapisz panel gatunku.
 *
 * ⚠️ Każde narzędzie jest konfrontowane z ŻYWYM routerem. Panel obiecujący
 * trasę, której most nie ma, byłby dokładnie tą atrapą, której tu nie chcemy —
 * więc zamiast zapisać go „na wyrost", odmawiamy i mówimy czego brakuje.
 */
export async function zapiszPanel(app, { gatunek, domena, narzedzia, jajo, nazwa, opis }) {
    if (!gatunek) return { ok: false, powod: 'Brak gatunku.' };
    if (!Array.isArray(narzedzia) || narzedzia.length === 0) {
        return { ok: false, powod: 'Panel bez narzędzi to pusta ramka — wybierz co najmniej jedno.' };
    }

    const zywe = new Set(zywetrasy(app).map(t => `${t.metoda} ${t.sciezka}`));
    const brakujace = narzedzia.filter(n => !zywe.has(`${n.metoda} ${n.sciezka}`));
    if (brakujace.length) {
        return {
            ok: false,
            powod: `Most nie wystawia: ${brakujace.map(b => `${b.metoda} ${b.sciezka}`).join(', ')}. `
                + 'Panel z guzikiem donikąd byłby atrapą.',
        };
    }

    const d = await czytaj();
    const wpis = {
        gatunek,
        nazwa: nazwa || gatunek,
        opis: opis || '',
        domena: domena || null,
        narzedzia: narzedzia.map(n => ({
            metoda: n.metoda, sciezka: n.sciezka, parametry: parametry(n.sciezka),
        })),
        jajo: jajo ?? losujJajo(gatunek),
        utworzony: new Date().toISOString(),
        ofertaId: null,
    };
    d.panele = [...d.panele.filter(p => p.gatunek !== gatunek), wpis];
    await zapisz(d);
    return { ok: true, panel: wpis };
}

export async function usunPanel(gatunek) {
    const d = await czytaj();
    const bylo = d.panele.length;
    d.panele = d.panele.filter(p => p.gatunek !== gatunek);
    if (d.panele.length === bylo) return { ok: false, powod: 'Nie ma takiego panelu.' };
    await zapisz(d);
    return { ok: true };
}

/** Zapamiętaj, pod jakim id panel poszedł do Marketplace. */
export async function oznaczWystawiony(gatunek, ofertaId) {
    const d = await czytaj();
    const p = d.panele.find(x => x.gatunek === gatunek);
    if (!p) return false;
    p.ofertaId = ofertaId;
    await zapisz(d);
    return true;
}

export default {
    zywetrasy, katalogDomen, losujJajo, sprawdzJajo,
    wczytajPanele, zapiszPanel, usunPanel, oznaczWystawiony,
};
