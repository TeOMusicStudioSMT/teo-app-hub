/**
 * 🧊🎮 TETERHIA 3D — świat gry z planszy 2D do Blendera i z powrotem jako .glb.
 *
 * Suweren (2026-09-13): „rozwinięcie gry, ulepszenie do 3D — robione w Blenderze";
 * w Labie leżało to jako zlecenie dla Nocnej Zmiany na `Gra.tsx`, ale to nie jest
 * praca na jeden plik i jeden model — to jest PIPELINE, którego Games Studio nie
 * miało: dane planszy → skrypt bpy → Blender headless → .glb → loader w grze.
 *
 * Co dokładnie się dzieje:
 *   1. TGS wysyła świat, jaki ma w pamięci (48×32 kafli: biom, wysokość,
 *      odchylenie odcienia) — ten sam, który rysuje na planszy 2D. Ziarno to
 *      wypadkowa postaci, więc ten sam gracz zawsze dostaje ten sam teren.
 *   2. Most pisze skrypt bpy: siatka (W+1)×(H+1) wierzchołków, z = wysokość,
 *      każdy kafel to czworokąt z KOLOREM NAROŻNIKÓW (ta sama paleta HSL co na
 *      planszy, nasycenie 75 %), woda (strumień) leży niżej, grzbiety wyżej.
 *   3. Blender (headless) buduje mesh, eksportuje .glb (COLOR_0 w środku),
 *      renderuje podgląd Workbench z kolorem wierzchołków, zapisuje .blend.
 *   4. .glb + .png lądują w `TeO_Games_Studio/public/assets/swiaty/` i w manifeście
 *      `swiaty.json` — gra ładuje je bez mostu.
 *
 * ⚠️ SEKRETY I START NIE SĄ W GLB. Kafle-sekrety widać w grze dopiero powyżej
 * progu nasycenia — to mechanika, nie geometria; znaczniki stawia klient.
 * Nasycenie gracza też zostaje na planszy 2D; w 3D teren ma pełne barwy.
 * Mówię to wprost, żeby nikt nie szukał w .glb tego, czego tam nie ma.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import * as Blender from './Blender.js';

let cfg = null;
export function skonfiguruj(c) { cfg = c; }

const HUE_BIOMU = { strumien: 195, gaj: 120, rownina: 65, grzbiet: 25, pustka: 275 };
const JASNOSC = { strumien: 42, gaj: 36, rownina: 48, grzbiet: 40, pustka: 30 };

function hslDoRgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360; s /= 100; l /= 100;
    const k = (n) => (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)];
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'swiat';

function katalogTgs() {
    for (const d of ['TeO_Games_Studio', 'TeO_Game_Studio']) {
        const abs = path.resolve(process.cwd(), '..', d);
        if (fsSync.existsSync(path.join(abs, 'package.json'))) return abs;
    }
    throw new Error('Nie widzę TeO_Games_Studio obok Katedry.');
}

/** Skrypt bpy: teren z kafli. Liczby wchodzą do skryptu jako listy — Blender nic nie liczy „na oko". */
function skryptTerenu({ nazwa, szerokosc, wysokosc, kafle, skalaWys = 3.0, kafelM = 1.0, wyjscieGlb, wyjsciePng, wyjscieBlend }) {
    const W = szerokosc, H = wysokosc;
    const z = kafle.map((k) => {
        const baza = k.biom === 'strumien' ? -0.35 : k.biom === 'grzbiet' ? 0.6 : 0;
        return +((baza + (Number(k.wys) || 0)) * skalaWys).toFixed(3);
    });
    const kolory = kafle.map((k) => {
        const h = HUE_BIOMU[k.biom] ?? 0, l = JASNOSC[k.biom] ?? 40;
        const [r, g, b] = hslDoRgb(h + (Number(k.odchylHue) || 0), 75, l);
        return [+r.toFixed(3), +g.toFixed(3), +b.toFixed(3)];
    });
    return `# TeO Games Studio — teren „${nazwa}" (${W}×${H} kafli) z planszy Teterhii. bpy z rdzenia Blendera.
import bpy, json
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
W, H, K = ${W}, ${H}, ${kafelM}
Z = json.loads("""${JSON.stringify(z)}""")
KOL = json.loads("""${JSON.stringify(kolory)}""")

def zk(x, y):
    # wysokość wierzchołka = średnia sąsiednich kafli (gładkie zbocza, ale kafel zachowuje kolor)
    s, n = 0.0, 0
    for (i, j) in ((x-1, y-1), (x, y-1), (x-1, y), (x, y)):
        if 0 <= i < W and 0 <= j < H:
            s += Z[j*W + i]; n += 1
    return s / n if n else 0.0

verts = [((x - W/2) * K, (H/2 - y) * K, zk(x, y)) for y in range(H+1) for x in range(W+1)]
faces = [(y*(W+1)+x, y*(W+1)+x+1, (y+1)*(W+1)+x+1, (y+1)*(W+1)+x) for y in range(H) for x in range(W)]
me = bpy.data.meshes.new("Teterhia"); me.from_pydata(verts, [], faces); me.update()
ob = bpy.data.objects.new("Teterhia", me); bpy.context.collection.objects.link(ob)

# Kolor narożników: każdy czworokąt = jeden kafel = jeden kolor (płaskie kafle, jak na planszy).
ca = me.color_attributes.new(name="Color", type='BYTE_COLOR', domain='CORNER')
for pi, p in enumerate(me.polygons):
    r, g, b = KOL[pi]
    for li in p.loop_indices:
        ca.data[li].color = (r, g, b, 1.0)
mat = bpy.data.materials.new("Teterhia_mat"); mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
attr = mat.node_tree.nodes.new("ShaderNodeVertexColor"); attr.layer_name = "Color"
mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.9
me.materials.append(mat)

# Kamera i światło do podglądu.
bpy.ops.object.light_add(type='SUN', location=(20, -20, 40)); bpy.context.active_object.data.energy = 3
bpy.ops.object.empty_add(location=(0, 0, 0)); cel = bpy.context.active_object
bpy.ops.object.camera_add(location=(W*0.55, -H*0.95, max(W, H)*0.55)); cam = bpy.context.active_object
tr = cam.constraints.new(type='TRACK_TO'); tr.target = cel; tr.track_axis = 'TRACK_NEGATIVE_Z'; tr.up_axis = 'UP_Y'
sc = bpy.context.scene; sc.camera = cam
sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = 1280; sc.render.resolution_y = 704
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'VERTEX'
sc.render.filepath = r"${wyjsciePng.replace(/\\/g, '/')}"
bpy.ops.render.render(write_still=True)

# GLB: tylko teren (bez kamery i światła — gra ma własne).
cam.select_set(False); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.export_scene.gltf(filepath=r"${wyjscieGlb.replace(/\\/g, '/')}", export_format='GLB', use_selection=True, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=r"${wyjscieBlend.replace(/\\/g, '/')}")
print("UJECIE: " + r"${wyjsciePng.replace(/\\/g, '/')}")
print("ZAPISANO: " + r"${wyjscieGlb.replace(/\\/g, '/')}")
`;
}

/**
 * Buduje teren świata w Blenderze i oddaje go grze. Zwraca ścieżki i URL-e
 * względem `public/` TGS. Gdy Blendera nie ma — mówi, czego brak (Blender.uruchom).
 */
export async function zbudujSwiat({ nazwa, ziarno, szerokosc, wysokosc, kafle, skalaWys, postac = null }) {
    if (!Array.isArray(kafle) || !kafle.length) throw new Error('Brak kafli świata.');
    const W = Number(szerokosc) || 48, H = Number(wysokosc) || 32;
    if (kafle.length !== W * H) throw new Error(`Kafli jest ${kafle.length}, a W×H = ${W * H}.`);
    if (W * H > 20000) throw new Error('Za duży świat na jeden mesh (limit 20 000 kafli).');
    const tgs = katalogTgs();
    const katalog = path.join(tgs, 'public', 'assets', 'swiaty');
    await fs.mkdir(katalog, { recursive: true });
    const baza = `${slug(nazwa)}_${String(ziarno ?? 0)}`;
    const wyjscieGlb = path.join(katalog, `${baza}.glb`);
    const wyjsciePng = path.join(katalog, `${baza}.png`);
    const wyjscieBlend = path.join(Blender.KATALOG(), `tgs_${baza}.blend`);
    await fs.mkdir(Blender.KATALOG(), { recursive: true });
    const plikPy = path.join(Blender.KATALOG(), `tgs_${baza}.py`);
    await fs.writeFile(plikPy, skryptTerenu({ nazwa, szerokosc: W, wysokosc: H, kafle, skalaWys, wyjscieGlb, wyjsciePng, wyjscieBlend }), 'utf8');

    const t0 = Date.now();
    const w = await Blender.uruchom(plikPy);
    if (!fsSync.existsSync(wyjscieGlb)) throw new Error(`Blender skończył, ale .glb nie ma: ${w.log.slice(-300)}`);
    const rekord = {
        id: baza, nazwa: String(nazwa || 'Teterhia'), ziarno: ziarno ?? null, szerokosc: W, wysokosc: H,
        glb: `/assets/swiaty/${baza}.glb`, png: fsSync.existsSync(wyjsciePng) ? `/assets/swiaty/${baza}.png` : null,
        blend: wyjscieBlend, bajtow: (await fs.stat(wyjscieGlb)).size, sekundy: Math.round((Date.now() - t0) / 1000),
        blender: w.wersja, postac: postac ? { imie: postac.imie, zywiol: postac.zywiol, droga: postac.droga } : null, kiedy: new Date().toISOString(),
    };
    const manifest = path.join(katalog, 'swiaty.json');
    let lista = [];
    try { lista = JSON.parse(await fs.readFile(manifest, 'utf8')).swiaty ?? []; } catch { /* pierwszy */ }
    lista = [rekord, ...lista.filter((s) => s.id !== baza)].slice(0, 50);
    await fs.writeFile(manifest, JSON.stringify({ swiaty: lista }, null, 2), 'utf8');
    cfg?.szyna?.nadaj?.({ agent: 'Kustosz', rodzaj: 'praca', tresc: `Blender zbudował teren „${rekord.nazwa}" (${W}×${H}) → ${path.basename(wyjscieGlb)} w ${rekord.sekundy} s` })?.catch?.(() => {});
    return rekord;
}

export async function listaSwiatow() {
    try {
        const tgs = katalogTgs();
        return JSON.parse(await fs.readFile(path.join(tgs, 'public', 'assets', 'swiaty', 'swiaty.json'), 'utf8')).swiaty ?? [];
    } catch { return []; }
}

export default { skonfiguruj, zbudujSwiat, listaSwiatow };
