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

/** Cały ciąg: GLB z ComfyUI → spawanie → uproszczenie → GLB pod grę. */
export async function przygotujPodGre(zrodlo, cel, celScian) {
    const t0 = Date.now();
    const siatka = await wczytajISpawaj(zrodlo);
    const { indeksy, blad } = await uprosc(siatka, celScian);
    const wynik = await zapiszGlb(siatka, indeksy, cel);
    return { ...wynik, przed: siatka.przed, poSpawaniu: { wierzcholki: siatka.pozycje.length / 3, trojkaty: siatka.indeksy.length / 3 }, bladUproszczenia: blad, rozmiar: siatka.rozmiar, ms: Date.now() - t0 };
}

export default { wczytajISpawaj, uprosc, zapiszGlb, przygotujPodGre };
