/**
 * 🔻 SIATKA 3D — spawanie i upraszczanie GLB pod grę (od 2026-09-22).
 *
 * PO CO. TRELLIS.2 oddaje ~150 tys. trójkątów z kolorami wierzchołków (11 MB). DecimateMesh
 * w ComfyUI do 20 tys. ROZWALAŁ siatkę (zostawał strzęp), a przy 50 tys. wywracał się na VRAM.
 * gltf-transform `simplify` z marszu też nie schodził poniżej ~120 tys., bo wierzchołki są
 * porozcinane (1,7 wierzchołka na trójkąt — przez normalne i lekko różne kolory), a
 * meshoptimizer nie zwija krawędzi przez takie szwy.
 *
 * CO ROBIMY. (1) SPAWAMY po pozycji (kwantyzacja 1/4096 rozmiaru bryły), uśredniając kolor,
 * normalne wyrzucamy (three.js policzy je przy wczytaniu). (2) meshoptimizer.simplify do zadanej
 * liczby ścian. (3) zapis GLB z jednym prymitywem: POSITION + COLOR_0 + indeksy. CPU, sekundy.
 */
import { NodeIO, Document } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';

/** Wczytaj GLB → jedna spawana siatka { pozycje: Float32Array, kolory: Float32Array|null, indeksy: Uint32Array }. */
export async function wczytajISpawaj(sciezka, podzialka = 4096) {
    const io = new NodeIO();
    const doc = await io.read(sciezka);
    const pozycje = [], kolory = [], indeksy = [];
    let maKolory = true;
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue;
        const P = prim.getAttribute('POSITION').getArray();
        const C = prim.getAttribute('COLOR_0')?.getArray() ?? null;
        const cs = prim.getAttribute('COLOR_0')?.getElementSize() ?? 0;
        const I = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: P.length / 3 }, (_, i) => i);
        const baza = pozycje.length / 3;
        for (let i = 0; i < P.length; i++) pozycje.push(P[i]);
        if (!C) maKolory = false;
        for (let v = 0; v < P.length / 3; v++) {
            if (C) { const n = cs === 4 ? 4 : 3; const k = C[v * cs]; const s = k > 1 ? 255 : 1; kolory.push(C[v * cs] / s, C[v * cs + 1] / s, C[v * cs + 2] / s); void n; } else kolory.push(1, 1, 1);
        }
        for (let i = 0; i < I.length; i++) indeksy.push(baza + I[i]);
    }
    if (!pozycje.length) throw new Error('GLB bez trójkątów.');
    // spawanie po pozycji
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < pozycje.length; i += 3) { const x = pozycje[i], y = pozycje[i + 1], z = pozycje[i + 2]; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; }
    const rozmiar = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
    const q = rozmiar / podzialka;
    const mapa = new Map(); const remap = new Int32Array(pozycje.length / 3);
    const nP = [], nC = [], licznik = [];
    for (let v = 0; v < pozycje.length / 3; v++) {
        const kx = Math.round((pozycje[v * 3] - minX) / q), ky = Math.round((pozycje[v * 3 + 1] - minY) / q), kz = Math.round((pozycje[v * 3 + 2] - minZ) / q);
        const klucz = kx * 73856093 ^ ky * 19349663 ^ kz * 83492791;
        const k2 = `${klucz}:${kx & 7}${ky & 7}${kz & 7}`;
        let id = mapa.get(k2);
        if (id === undefined) { id = nP.length / 3; mapa.set(k2, id); nP.push(pozycje[v * 3], pozycje[v * 3 + 1], pozycje[v * 3 + 2]); nC.push(kolory[v * 3], kolory[v * 3 + 1], kolory[v * 3 + 2]); licznik.push(1); }
        else { const n = licznik[id]; for (let c = 0; c < 3; c++) nC[id * 3 + c] = (nC[id * 3 + c] * n + kolory[v * 3 + c]) / (n + 1); licznik[id] = n + 1; }
        remap[v] = id;
    }
    const nI = [];
    for (let i = 0; i < indeksy.length; i += 3) { const a = remap[indeksy[i]], b = remap[indeksy[i + 1]], c = remap[indeksy[i + 2]]; if (a !== b && b !== c && a !== c) nI.push(a, b, c); }
    return { pozycje: Float32Array.from(nP), kolory: maKolory ? Float32Array.from(nC) : null, indeksy: Uint32Array.from(nI), przed: { wierzcholki: pozycje.length / 3, trojkaty: indeksy.length / 3 }, rozmiar: [maxX - minX, maxY - minY, maxZ - minZ] };
}

/** Uprość do `celScian` trójkątów (meshoptimizer). Zwraca nowe indeksy + osiągnięty błąd. */
export async function uprosc(siatka, celScian) {
    await MeshoptSimplifier.ready;
    const cel = Math.max(3, Math.floor(celScian)) * 3;
    if (siatka.indeksy.length <= cel) return { indeksy: siatka.indeksy, blad: 0 };
    // simplifySloppy: ignoruje topologię (siatka z wokseli ma tysiące krawędzi brzegowych,
    // przez które zwykły simplify NIE schodził poniżej ~117 tys. przy celu 20 tys. — zmierzone
    // 2026-09-22 na golemie). Sloppy trafia w cel w kilkanaście ms; błąd ok. 1–3% rozmiaru bryły.
    const [ind, blad] = MeshoptSimplifier.simplifySloppy(siatka.indeksy, siatka.pozycje, 3, null, cel, 1.0);
    return { indeksy: ind, blad };
}

/** Zapisz spawaną/uproszczoną siatkę jako GLB (POSITION + COLOR_0 + indeksy, materiał z kolorami wierzchołków). */
export async function zapiszGlb(siatka, indeksy, sciezka) {
    // wyrzucamy nieużywane wierzchołki
    const uzyte = new Int32Array(siatka.pozycje.length / 3).fill(-1);
    const P = [], C = [];
    const I = new Uint32Array(indeksy.length);
    for (let i = 0; i < indeksy.length; i++) {
        const v = indeksy[i];
        if (uzyte[v] < 0) { uzyte[v] = P.length / 3; P.push(siatka.pozycje[v * 3], siatka.pozycje[v * 3 + 1], siatka.pozycje[v * 3 + 2]); if (siatka.kolory) C.push(siatka.kolory[v * 3], siatka.kolory[v * 3 + 1], siatka.kolory[v * 3 + 2]); }
        I[i] = uzyte[v];
    }
    const doc = new Document();
    const buf = doc.createBuffer();
    const pos = doc.createAccessor('POSITION').setType('VEC3').setArray(Float32Array.from(P)).setBuffer(buf);
    const idx = doc.createAccessor('indeksy').setType('SCALAR').setArray(P.length / 3 > 65535 ? I : Uint16Array.from(I)).setBuffer(buf);
    // Dwustronnie: siatki z TRELLIS.2 bywaja otwarte i pod izometria widac przez sciany (2026-09-22).
    const mat = doc.createMaterial('kolory').setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(true);
    const prim = doc.createPrimitive().setMode(4).setAttribute('POSITION', pos).setIndices(idx).setMaterial(mat);
    if (siatka.kolory) prim.setAttribute('COLOR_0', doc.createAccessor('COLOR_0').setType('VEC3').setArray(Float32Array.from(C)).setBuffer(buf));
    const mesh = doc.createMesh('asset').addPrimitive(prim);
    const node = doc.createNode('asset').setMesh(mesh);
    doc.createScene('scena').addChild(node);
    await new NodeIO().write(sciezka, doc);
    return { wierzcholki: P.length / 3, trojkaty: I.length / 3 };
}

/** Cały ciąg: GLB z ComfyUI → spawanie → uproszczenie → GLB pod grę. Z `fragment` — gęściej w jego obrębie. */
export async function przygotujPodGre(zrodlo, cel, celScian, { fragment = null, scianyFragmentu = 0 } = {}) {
    const t0 = Date.now();
    const siatka = await wczytajISpawaj(zrodlo);
    const u = fragment ? await uproscZFragmentem(siatka, { cel: celScian, fragment, scianyFragmentu }) : await uprosc(siatka, celScian);
    const wynik = await zapiszGlb(siatka, u.indeksy, cel);
    return { ...wynik, przed: siatka.przed, poSpawaniu: { wierzcholki: siatka.pozycje.length / 3, trojkaty: siatka.indeksy.length / 3 }, bladUproszczenia: u.blad, rozmiar: siatka.rozmiar, ms: Date.now() - t0, ...(u.fragment ? { fragment: u.fragment } : {}) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 KOLOR BRYŁY (Suweren 2026-10-07: „model wychodzi za ciemny” — obraz źródłowy czarny, TRELLIS.2 przenosi
// barwy 1:1). Kolory wierzchołków (COLOR_0, liniowe) → sRGB → poprawki → z powrotem. Czysta matematyka:
// tę samą kolejność liczy podgląd w Game Studio (src/lib/kolorBryly.ts), żeby suwaki pokazywały to, co zapiszemy.
// ─────────────────────────────────────────────────────────────────────────────
const doSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const doLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const obetnij = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lumi = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function obrocOdcien(r, g, b, stopnie) {
    // macierz obrotu odcienia wokół osi szarości (zachowuje luminancję) — bez skoków HSV na szarościach
    const a = (stopnie * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [
        r * (0.213 + c * 0.787 - s * 0.213) + g * (0.715 - c * 0.715 - s * 0.715) + b * (0.072 - c * 0.072 + s * 0.928),
        r * (0.213 - c * 0.213 + s * 0.143) + g * (0.715 + c * 0.285 + s * 0.140) + b * (0.072 - c * 0.072 - s * 0.283),
        r * (0.213 - c * 0.213 - s * 0.787) + g * (0.715 - c * 0.715 + s * 0.715) + b * (0.072 + c * 0.928 + s * 0.072),
    ];
}

/** Poziomy z percentyli luminancji (1% i 99%) w sRGB — `auto` rozciąga je na pełen zakres. */
export function poziomy(kolory) {
    const n = kolory.length / 3, krok = Math.max(1, Math.floor(n / 20000)), L = [];
    for (let v = 0; v < n; v += krok) L.push(lumi(doSrgb(kolory[v * 3]), doSrgb(kolory[v * 3 + 1]), doSrgb(kolory[v * 3 + 2])));
    L.sort((x, y) => x - y);
    const q = (p) => L[Math.min(L.length - 1, Math.floor(p * L.length))] ?? 0;
    return { czern: q(0.01), biel: q(0.99), srednia: L.reduce((s, x) => s + x, 0) / (L.length || 1) };
}

/**
 * Popraw kolory. Suwaki −1…1 (0 = bez zmian), `odcien` w stopniach, `czern` 0…1 (podnieś czerń), `auto` = rozciągnij poziomy.
 * Kolejność: poziomy → odcień → nasycenie → kontrast → czerń → jasność (gamma: czerń i biel zostają na miejscu —
 * dlatego osobny suwak czerni: czarny kot z czarnego obrazu po samej gammie zostaje czarny, zmierzone 2026-10-08).
 * @returns {Float32Array} nowe kolory liniowe
 */
export function przekoloruj(kolory, { jasnosc = 0, kontrast = 0, nasycenie = 0, odcien = 0, czern = 0, auto = false } = {}, pz = auto ? poziomy(kolory) : null) {
    const out = new Float32Array(kolory.length);
    const lo = pz ? pz.czern : 0, rozp = pz ? Math.max(0.05, pz.biel - pz.czern) : 1;
    const gamma = 2 ** -Math.max(-1, Math.min(1, Number(jasnosc) || 0));
    const k = 1 + Math.max(-1, Math.min(1, Number(kontrast) || 0));
    const s = 1 + Math.max(-1, Math.min(1, Number(nasycenie) || 0));
    const h = Number(odcien) || 0;
    const cz = Math.max(0, Math.min(1, Number(czern) || 0));
    for (let i = 0; i < kolory.length; i += 3) {
        let r = doSrgb(kolory[i]), g = doSrgb(kolory[i + 1]), b = doSrgb(kolory[i + 2]);
        if (pz) { r = obetnij((r - lo) / rozp); g = obetnij((g - lo) / rozp); b = obetnij((b - lo) / rozp); }
        if (h) [r, g, b] = obrocOdcien(r, g, b, h).map(obetnij);
        if (s !== 1) { const L = lumi(r, g, b); r = obetnij(L + (r - L) * s); g = obetnij(L + (g - L) * s); b = obetnij(L + (b - L) * s); }
        if (k !== 1) { r = obetnij((r - 0.5) * k + 0.5); g = obetnij((g - 0.5) * k + 0.5); b = obetnij((b - 0.5) * k + 0.5); }
        if (cz) { r = cz + r * (1 - cz); g = cz + g * (1 - cz); b = cz + b * (1 - cz); }
        if (gamma !== 1) { r **= gamma; g **= gamma; b **= gamma; }
        out[i] = doLin(r); out[i + 1] = doLin(g); out[i + 2] = doLin(b);
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔍 GĘSTOŚĆ FRAGMENTU (Suweren 2026-10-07: „60 000 na samą twarz”). Master z TRELLIS.2 ma ~200 tys. ścian;
// zwykłe upraszczanie rozkłada budżet równo. Tu fragment (pudełko w ułamkach ramki bryły, y w górę) dostaje
// WŁASNY budżet ścian, reszta — swój. Wierzchołki na granicy obu części są ZABLOKOWANE w obu upraszczaniach
// (vertex_lock), więc szew się nie rozjeżdża. Fragment nie ma więcej ścian, niż ma go master — to mówimy wprost.
// ─────────────────────────────────────────────────────────────────────────────
/** Pudełko fragmentu {x0,x1,y0,y1,z0?,z1?} w ułamkach 0–1 ramki bryły → sprawdzone. */
export function oczyscFragment(f) {
    if (!f || typeof f !== 'object') throw new Error('Fragment: podaj pudełko {x0,x1,y0,y1} w ułamkach 0–1.');
    const o = {};
    for (const [a, b] of [['x0', 'x1'], ['y0', 'y1'], ['z0', 'z1']]) {
        const p = f[a] ?? (a === 'z0' ? 0 : null), q = f[b] ?? (b === 'z1' ? 1 : null);
        if (p == null || q == null || p === '' || q === '' || !Number.isFinite(Number(p)) || !Number.isFinite(Number(q))) throw new Error(`Fragment: brak ${a}/${b}.`);
        o[a] = Math.max(0, Math.min(1, Math.min(Number(p), Number(q)))); o[b] = Math.max(0, Math.min(1, Math.max(Number(p), Number(q))));
        if (o[b] - o[a] < 0.02) throw new Error('Fragment za mały — zaznacz większy obszar.');
    }
    return o;
}

export async function uproscZFragmentem(siatka, { cel, fragment, scianyFragmentu }) {
    await MeshoptSimplifier.ready;
    const f = oczyscFragment(fragment);
    const P = siatka.pozycje, I = siatka.indeksy, n = P.length / 3;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < n; v++) for (let a = 0; a < 3; a++) { const x = P[v * 3 + a]; if (x < mn[a]) mn[a] = x; if (x > mx[a]) mx[a] = x; }
    const lim = [['x0', 'x1'], ['y0', 'y1'], ['z0', 'z1']].map(([a, b], o) => [mn[o] + f[a] * (mx[o] - mn[o]), mn[o] + f[b] * (mx[o] - mn[o])]);
    const wewn = [], zewn = [];
    for (let t = 0; t < I.length; t += 3) {
        let w = true;
        for (let o = 0; o < 3 && w; o++) { const c = (P[I[t] * 3 + o] + P[I[t + 1] * 3 + o] + P[I[t + 2] * 3 + o]) / 3; if (c < lim[o][0] || c > lim[o][1]) w = false; }
        (w ? wewn : zewn).push(I[t], I[t + 1], I[t + 2]);
    }
    if (!wewn.length) throw new Error('W zaznaczonym fragmencie nie ma ani jednej ściany bryły — zaznacz obszar na samej postaci.');
    // granica: wierzchołki należące do obu części — zablokowane w obu upraszczaniach
    const wA = new Uint8Array(n), wB = new Uint8Array(n);
    for (const v of wewn) wA[v] = 1;
    for (const v of zewn) wB[v] = 1;
    const zamek = new Uint8Array(n);
    let granica = 0;
    for (let v = 0; v < n; v++) if (wA[v] && wB[v]) { zamek[v] = 1; granica++; }
    const wMasterze = wewn.length / 3;
    const celF = Math.min(wMasterze, Math.max(3, Math.floor(Number(scianyFragmentu) || wMasterze)));
    const celR = Math.max(3, Math.floor(Number(cel) || 8000) - celF);
    const tnij = (ind, ile) => (ind.length / 3 <= ile ? [Uint32Array.from(ind), 0] : MeshoptSimplifier.simplifySloppy(Uint32Array.from(ind), P, 3, zamek, ile * 3, 1.0));
    const [iF, bF] = tnij(wewn, celF);
    const [iR, bR] = zewn.length ? tnij(zewn, celR) : [new Uint32Array(0), 0];
    const indeksy = new Uint32Array(iF.length + iR.length);
    indeksy.set(iF, 0); indeksy.set(iR, iF.length);
    return {
        indeksy, blad: Math.max(bF, bR),
        fragment: { pudelko: f, wMasterze, trojkaty: iF.length / 3, reszta: iR.length / 3, granica, prosba: Number(scianyFragmentu) || null, ograniczony: celF < (Number(scianyFragmentu) || 0) },
    };
}

export default { wczytajISpawaj, uprosc, zapiszGlb, przygotujPodGre, poziomy, przekoloruj, oczyscFragment, uproscZFragmentem };
