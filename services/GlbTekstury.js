/**
 * 🖼️ Tekstury GLB do rozmiaru, który uniesie karta graficzna (Suweren 2026-10-09: kot z Meshy 8K → „studio dostaje
 * czarny ekran”). Meshy oddaje teksturę 8192×8192 (JPEG ~17 MB) — w VRAM to ~256 MB (+ mipmapy ~340 MB). Na karcie
 * 6 GB, którą trzyma podcast (5,9 GB zajęte), WebGL tracił kontekst i całe okno Huba czerniało.
 *
 * `zmniejszTekstury(glb, maks)`: każdy obraz GLB większy niż `maks` → ffmpeg (skala z zachowaniem proporcji, ten sam
 * format) → nowy GLB z przeliczonymi bufferView (jeden bufor, wyrównanie do 4 bajtów). Geometria, skóra i animacje
 * zostają bajt w bajt. Pełna rozdzielczość zostaje w `master.glb`.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

/** GLB → { json, bin } (tylko jeden bufor binarny). */
export function rozbierzGlb(glb) {
    if (!Buffer.isBuffer(glb) || glb.toString('ascii', 0, 4) !== 'glTF') throw new Error('To nie jest GLB.');
    const dlJson = glb.readUInt32LE(12);
    if (glb.readUInt32LE(16) !== 0x4E4F534A) throw new Error('GLB bez kawałka JSON.');
    const json = JSON.parse(glb.slice(20, 20 + dlJson).toString('utf8'));
    let bin = Buffer.alloc(0);
    const o = 20 + dlJson;
    if (o + 8 <= glb.length && glb.readUInt32LE(o + 4) === 0x004E4942) bin = glb.slice(o + 8, o + 8 + glb.readUInt32LE(o));
    return { json, bin };
}

/** { json, bin } → GLB (JSON dopełniony spacjami, BIN zerami — do 4 bajtów, jak każe glTF 2.0). */
export function zlozGlb(json, bin) {
    const jb = Buffer.from(JSON.stringify(json), 'utf8');
    const jPad = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
    const bPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);
    const naglowek = Buffer.alloc(12);
    naglowek.write('glTF', 0, 'ascii'); naglowek.writeUInt32LE(2, 4); naglowek.writeUInt32LE(12 + 8 + jPad.length + (bin.length ? 8 + bPad.length : 0), 8);
    const kj = Buffer.alloc(8); kj.writeUInt32LE(jPad.length, 0); kj.writeUInt32LE(0x4E4F534A, 4);
    const czesci = [naglowek, kj, jPad];
    if (bin.length) { const kb = Buffer.alloc(8); kb.writeUInt32LE(bPad.length, 0); kb.writeUInt32LE(0x004E4942, 4); czesci.push(kb, bPad); }
    return Buffer.concat(czesci);
}

/** Wymiary PNG/JPEG z nagłówka (bez dekodowania). */
export function wymiaryObrazu(d) {
    if (d[0] === 0x89 && d.toString('ascii', 1, 4) === 'PNG') return { w: d.readUInt32BE(16), h: d.readUInt32BE(20), format: 'png' };
    if (d[0] === 0xFF && d[1] === 0xD8) {
        let k = 2;
        while (k + 9 < d.length) {
            if (d[k] !== 0xFF) { k++; continue; }
            const m = d[k + 1];
            if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) return { w: d.readUInt16BE(k + 7), h: d.readUInt16BE(k + 5), format: 'jpg' };
            k += 2 + d.readUInt16BE(k + 2);
        }
    }
    return null;
}

/**
 * Podmienia zawartość wybranych bufferView i przelicza przesunięcia wszystkich (kolejność zachowana).
 * @param {object} json @param {Buffer} bin @param {Map<number, Buffer>} nowe
 */
export function podmienWidoki(json, bin, nowe) {
    const kawalki = [];
    let off = 0;
    const widoki = json.bufferViews.map((v, i) => {
        const dane = nowe.get(i) ?? bin.slice(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
        const pad = (4 - (off % 4)) % 4;
        if (pad) { kawalki.push(Buffer.alloc(pad)); off += pad; }
        const nv = { ...v, byteOffset: off, byteLength: dane.length };
        kawalki.push(dane); off += dane.length;
        return nv;
    });
    const nowyBin = Buffer.concat(kawalki);
    return { json: { ...json, bufferViews: widoki, buffers: [{ ...json.buffers[0], byteLength: nowyBin.length }] }, bin: nowyBin };
}

/**
 * @param {Buffer} glb @param {number} maks najdłuższy bok tekstury
 * @param {{ ffmpeg: string, uruchom: (cmd:string, args:string[]) => Promise<unknown> }} o
 * @returns {Promise<{ glb: Buffer, zmniejszone: { z: string, na: string }[] }>}
 */
export async function zmniejszTekstury(glb, maks, { ffmpeg, uruchom }) {
    const { json, bin } = rozbierzGlb(glb);
    if (!json.images?.length || (json.buffers?.length ?? 0) !== 1) return { glb, zmniejszone: [] };
    const nowe = new Map();
    const zmniejszone = [];
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'glb-tekstury-'));
    try {
        for (const img of json.images) {
            if (!Number.isInteger(img.bufferView)) continue;
            const v = json.bufferViews[img.bufferView];
            const dane = bin.slice(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
            const wym = wymiaryObrazu(dane);
            if (!wym || Math.max(wym.w, wym.h) <= maks) continue;
            const id = crypto.randomBytes(4).toString('hex');
            const we = path.join(tmp, `${id}-we.${wym.format}`), wy = path.join(tmp, `${id}-wy.${wym.format}`);
            await fs.writeFile(we, dane);
            const skala = wym.w >= wym.h ? `scale=${maks}:-2:flags=lanczos` : `scale=-2:${maks}:flags=lanczos`;
            await uruchom(ffmpeg, ['-loglevel', 'error', '-y', '-i', we, '-vf', skala, ...(wym.format === 'jpg' ? ['-q:v', '3'] : []), '-frames:v', '1', wy]);
            const nowa = await fs.readFile(wy);
            const w2 = wymiaryObrazu(nowa);
            nowe.set(img.bufferView, nowa);
            zmniejszone.push({ z: `${wym.w}×${wym.h}`, na: w2 ? `${w2.w}×${w2.h}` : '?' });
        }
    } finally { await fs.rm(tmp, { recursive: true, force: true }).catch(() => {}); }
    if (!nowe.size) return { glb, zmniejszone };
    const p = podmienWidoki(json, bin, nowe);
    return { glb: zlozGlb(p.json, p.bin), zmniejszone };
}

/** Obrazy z BARWĄ (baseColor, emisja) — normalne, metaliczność/szorstkość i okluzja zostają nietknięte. */
export function obrazyBarwy(json) {
    const zTekstury = (t) => (Number.isInteger(t?.index) ? json.textures?.[t.index]?.source : undefined);
    const out = new Set();
    for (const m of json.materials ?? []) for (const t of [m.pbrMetallicRoughness?.baseColorTexture, m.emissiveTexture]) { const s = zTekstury(t); if (Number.isInteger(s)) out.add(s); }
    return [...out];
}

/**
 * 🎨 Kolor tekstur (Suweren 2026-10-09: „modeli z Meshy nie można obrazowo zmieniać odcieni jak naszych”): każdy obraz barwy
 * → ffmpeg do surowego RGBA → `przelicz(rgba, szer, wys)` zmienia piksele w miejscu → ten sam format z powrotem.
 * @returns {Promise<{ glb: Buffer, obrazow: number }>}
 */
export async function przekolorujTekstury(glb, przelicz, { ffmpeg, uruchom }) {
    const { json, bin } = rozbierzGlb(glb);
    if ((json.buffers?.length ?? 0) !== 1) return { glb, obrazow: 0 };
    const nowe = new Map();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'glb-kolor-'));
    try {
        for (const i of obrazyBarwy(json)) {
            const img = json.images?.[i];
            if (!Number.isInteger(img?.bufferView)) continue;
            const v = json.bufferViews[img.bufferView];
            const dane = bin.slice(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
            const wym = wymiaryObrazu(dane);
            if (!wym) continue;
            const id = crypto.randomBytes(4).toString('hex');
            const we = path.join(tmp, `${id}-we.${wym.format}`), raw = path.join(tmp, `${id}.rgba`), wy = path.join(tmp, `${id}-wy.${wym.format}`);
            await fs.writeFile(we, dane);
            await uruchom(ffmpeg, ['-loglevel', 'error', '-y', '-i', we, '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]);
            const px = await fs.readFile(raw);
            if (px.length !== wym.w * wym.h * 4) throw new Error(`Tekstura ${wym.w}×${wym.h}: ffmpeg oddał ${px.length} bajtów zamiast ${wym.w * wym.h * 4}.`);
            przelicz(px, wym.w, wym.h);
            await fs.writeFile(raw, px);
            await uruchom(ffmpeg, ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${wym.w}x${wym.h}`, '-i', raw, ...(wym.format === 'jpg' ? ['-q:v', '2', '-pix_fmt', 'yuvj444p'] : []), '-frames:v', '1', wy]);
            nowe.set(img.bufferView, await fs.readFile(wy));
        }
    } finally { await fs.rm(tmp, { recursive: true, force: true }).catch(() => {}); }
    if (!nowe.size) return { glb, obrazow: 0 };
    const p = podmienWidoki(json, bin, nowe);
    return { glb: zlozGlb(p.json, p.bin), obrazow: nowe.size };
}

/** Liczba trójkątów w GLB z akcesorów (indeksy/3 albo pozycje/3; tylko tryb TRIANGLES) — bez dekodowania geometrii. */
export function scianyGlb(glb) {
    const { json } = rozbierzGlb(glb);
    let n = 0;
    for (const m of json.meshes ?? []) for (const p of m.primitives ?? []) {
        if ((p.mode ?? 4) !== 4) continue;
        const acc = json.accessors?.[Number.isInteger(p.indices) ? p.indices : p.attributes?.POSITION];
        if (acc) n += Math.floor(acc.count / 3);
    }
    return n;
}

export default { zmniejszTekstury, scianyGlb, przekolorujTekstury, obrazyBarwy, rozbierzGlb, zlozGlb, wymiaryObrazu, podmienWidoki };
