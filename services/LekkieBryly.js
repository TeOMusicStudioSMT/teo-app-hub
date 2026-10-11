/**
 * 📱 LEKKIE BRYŁY — kopie GLB gry dla telefonu gościa (Suweren 2026-10-11: „odchudź paczkę gry dla telefonu”).
 *
 * Zmierzone na Teterhii: bryły z TRELLIS to 0,9–1,2 mln trójkątów przy teksturze < 3 MB (siatka = 90% pliku),
 * bryły z rigiem Meshy — ~100 tys. trójkątów i tekstury 2K/4K (tekstury = 60–70% pliku).
 *   · bez skóry i morfów: siatka uproszczona `simplifySloppy` (meshoptimizer, jak w Siatka3D) do `celScian`
 *     (domyślnie 30 tys. na całą bryłę, rozdzielone po prymitywach), potem nieużyte wierzchołki wycięte (compactPrimitive);
 *   · ze skórą albo morfami: siatka NIETKNIĘTA (rig i animacje bajt w bajt), tylko tekstury;
 *   · tekstury ≤ `maksTekstury` (1024 px) przez `GlbTekstury.zmniejszTekstury` (ffmpeg, ten sam format).
 * Pełne bryły zostają w grze (Katedra, komputer, zip dla innych Katedr) — to tylko kopie obok.
 */
import { NodeIO, PropertyType, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { zmniejszTekstury } from './GlbTekstury.js';

export const CEL_SCIAN = Number(process.env.OTAKOS_LEKKIE_SCIANY || 30_000);
export const MAKS_TEKSTURY = Number(process.env.OTAKOS_LEKKIE_TEKSTURA || 1024);

const trojkaty = (p) => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION')?.getCount() ?? 0) / 3;

/**
 * @param {Buffer} glb
 * @param {{ celScian?: number, maksTekstury?: number, ffmpeg: string, uruchom: Function }} o
 * @returns {Promise<{ glb: Buffer, przed: number, po: number, trojkaty: { z: number, na: number }, rig: boolean, tekstury: object[] }>}
 */
export async function odchudzBryle(glb, { celScian = CEL_SCIAN, maksTekstury = MAKS_TEKSTURY, ffmpeg, uruchom }) {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setLogger(new Logger(Logger.Verbosity.ERROR));
    const doc = await io.readBinary(new Uint8Array(glb));
    doc.setLogger(new Logger(Logger.Verbosity.ERROR));
    const root = doc.getRoot();
    const rig = root.listSkins().length > 0;
    const prymitywy = root.listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getMode() === 4);
    const z = Math.round(prymitywy.reduce((s, p) => s + trojkaty(p), 0));
    let na = z;
    if (!rig && z > celScian) {
        await MeshoptSimplifier.ready;
        na = 0;
        for (const p of prymitywy) {
            const ile = trojkaty(p);
            const pos = p.getAttribute('POSITION');
            if (p.listTargets().length || !pos || ile < 300) { na += ile; continue; }
            let ind = p.getIndices()?.getArray();
            if (!ind) ind = Uint32Array.from({ length: pos.getCount() }, (_, i) => i);
            const cel = Math.max(300, Math.round((ile / z) * celScian));
            const pozycje = pos.getArray() instanceof Float32Array ? pos.getArray() : Float32Array.from(pos.getArray());
            const [nowe] = MeshoptSimplifier.simplifySloppy(Uint32Array.from(ind), pozycje, pos.getElementSize(), null, cel * 3, 1.0);
            if (!nowe.length) { na += ile; continue; }
            const acc = doc.createAccessor().setType('SCALAR').setArray(pos.getCount() > 65535 ? Uint32Array.from(nowe) : Uint16Array.from(nowe)).setBuffer(root.listBuffers()[0]);
            p.setIndices(acc);
            compactPrimitive(p);
            na += nowe.length / 3;
        }
        await doc.transform(prune({ propertyTypes: [PropertyType.ACCESSOR] }));
    }
    let wynik = Buffer.from(await io.writeBinary(doc));
    const t = await zmniejszTekstury(wynik, maksTekstury, { ffmpeg, uruchom });
    wynik = t.glb;
    return { glb: wynik, przed: glb.length, po: wynik.length, trojkaty: { z, na: Math.round(na) }, rig, tekstury: t.zmniejszone };
}

export default { odchudzBryle, CEL_SCIAN, MAKS_TEKSTURY };
