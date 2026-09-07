/**
 * 🧊 Blender — budowanie cyfrowych scen z kadrów.
 *
 * PO CO. Suweren: „podpięcia do Blendera, by umożliwić budowanie całych
 * digitalnych scen z kadrów (to zostanie użyte w późniejszych produkcjach)".
 *
 * ⚠️ BLENDERA NIE MA NA TEJ MASZYNIE — sprawdzone 2026-09-07: ani w PATH,
 * ani w `C:/Program Files/Blender Foundation`. Dlatego ten moduł jest napisany
 * tak, żeby był UŻYTECZNY JUŻ TERAZ i gotowy w dniu, w którym Blender się
 * pojawi:
 *
 *   · `stanBlendera()` szuka go w PATH i w typowych miejscach i mówi WPROST,
 *     czego nie widzi — zamiast udawać, że scena się buduje.
 *   · `zbudujScenariusz()` zapisuje PRAWDZIWY skrypt `.py` z kadrami projektu:
 *     każdy kadr jako płaszczyzna z teksturą, ustawione w łuk przed kamerą,
 *     światło i kamera gotowe do renderu. Ten plik można otworzyć w Blenderze
 *     ręcznie na dowolnej maszynie — jest wynikiem sam w sobie.
 *   · `uruchom()` odpala `blender --background --python …` DOPIERO gdy binarka
 *     istnieje. Bez niej odmawia z instrukcją, a nie z zagadkowym błędem.
 *
 * Skrypt celowo używa wyłącznie `bpy` z rdzenia Blendera — żadnych dodatków
 * do doinstalowania, bo każdy z nich to kolejna rzecz, która może nie zadziałać
 * na cudzej maszynie.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const uruchomProces = promisify(execFile);

/** Typowe miejsca instalacji na Windowsie. Kolejność: najnowsze pierwsze. */
const KANDYDACI = [
    'C:/Program Files/Blender Foundation',
    'C:/Program Files (x86)/Blender Foundation',
    'D:/Blender Foundation',
    'E:/Blender Foundation',
];

/** Gdzie lądują scenariusze i sceny. */
export const KATALOG = () => path.join(process.cwd(), '_OtakOs_Wymiar', 'blender');

/**
 * Czy Blender jest. Szukamy w PATH, potem w typowych katalogach.
 * ⚠️ Nie zgadujemy wersji z nazwy katalogu — bierzemy pierwszy istniejący
 * `blender.exe` i pytamy JEGO o wersję.
 */
export async function stanBlendera() {
    // 1. PATH
    try {
        const { stdout } = await uruchomProces('blender', ['--version'], { timeout: 15000, maxBuffer: 1024 * 1024 });
        return { jest: true, sciezka: 'blender (PATH)', wersja: String(stdout).split('\n')[0].trim() };
    } catch { /* szukamy dalej */ }

    // 2. Typowe katalogi instalacji
    for (const baza of KANDYDACI) {
        let wpisy = [];
        try { wpisy = fsSync.readdirSync(baza, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { continue; }
        for (const w of wpisy.reverse()) {
            const exe = path.join(baza, w.name, 'blender.exe');
            if (!fsSync.existsSync(exe)) continue;
            try {
                const { stdout } = await uruchomProces(exe, ['--version'], { timeout: 20000, maxBuffer: 1024 * 1024 });
                return { jest: true, sciezka: exe, wersja: String(stdout).split('\n')[0].trim() };
            } catch { /* uszkodzona instalacja — szukamy dalej */ }
        }
    }

    return {
        jest: false,
        sciezka: null,
        wersja: null,
        // Konkret zamiast „nie znaleziono": gdzie szukałem i co zrobić.
        powod: `Nie widzę blender.exe ani w PATH, ani w: ${KANDYDACI.join(', ')}.`,
        cozrobic: 'Zainstaluj Blendera (blender.org) albo dopisz go do PATH. Scenariusze .py budują się bez niego — Blender jest potrzebny dopiero do renderu.',
    };
}

/** Bezpieczna nazwa pliku ze sluga projektu. */
const bezpiecznaNazwa = (s) => String(s || 'scena').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);

/**
 * Zbuduj skrypt Blendera ze wskazanych kadrów.
 *
 * Scena: kadry jako płaszczyzny ustawione w łuk, kamera w środku łuku,
 * miękkie światło. To punkt startowy do budowania przestrzeni z ujęć,
 * a nie gotowy film — dokładnie tak, jak Suweren zapowiedział („zostanie
 * użyte w późniejszych produkcjach").
 */
export async function zbudujScenariusz({ projekt, kadry = [], nazwa = '' }) {
    const obrazy = kadry.filter((k) => typeof k === 'string' && /\.(png|jpg|jpeg|webp)$/i.test(k));
    if (!obrazy.length) {
        throw new Error('Brak obrazów do zbudowania sceny. Kadry muszą być plikami .png/.jpg — z filmu wyjmij klatki w Ciągu Dalszym.');
    }

    const kat = KATALOG();
    await fs.mkdir(kat, { recursive: true });
    const baza = bezpiecznaNazwa(nazwa || projekt);
    const plikPy = path.join(kat, `${baza}_${Date.now().toString(36)}.py`);
    const plikBlend = plikPy.replace(/\.py$/, '.blend');

    // ⚠️ Ścieżki wchodzą do Pythona jako literały — zamieniamy backslashe,
    // inaczej „C:\nowe\test.png" ma w środku znak nowej linii i tabulator.
    const lista = obrazy.map((o) => `    r"${o.replace(/\\/g, '/')}",`).join('\n');

    const skrypt = `# -*- coding: utf-8 -*-
# Scena zbudowana przez Katedre OtakOS — projekt: ${projekt}
# Kadry ustawione w luk przed kamera. Uruchom:
#   blender --background --python "${plikPy.replace(/\\/g, '/')}"
# albo otworz ten plik w zakladce Scripting i wcisnij Run.

import bpy, math, os

KADRY = [
${lista}
]

PROMIEN = 8.0          # odleglosc kadrow od srodka
WYSOKOSC = 2.2         # wysokosc srodka plaszczyzn
ROZPIETOSC = math.radians(150)   # kat luku

# Czysta scena — usuwamy domyslna kostke, swiatlo i kamere.
bpy.ops.wm.read_factory_settings(use_empty=True)

scena = bpy.context.scene
scena.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.bl_idname for e in bpy.types.RenderEngine.__subclasses__()] else 'BLENDER_EEVEE'
scena.render.film_transparent = False

ile = len(KADRY)
start = -ROZPIETOSC / 2

for i, sciezka in enumerate(KADRY):
    if not os.path.exists(sciezka):
        print("POMIJAM (nie ma pliku):", sciezka)
        continue

    kat = start + (ROZPIETOSC * i / max(1, ile - 1)) if ile > 1 else 0.0
    x = math.sin(kat) * PROMIEN
    y = math.cos(kat) * PROMIEN

    obraz = bpy.data.images.load(sciezka)
    szer, wys = obraz.size
    proporcja = (wys / szer) if szer else 0.5625

    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(x, y, WYSOKOSC))
    plaszczyzna = bpy.context.active_object
    plaszczyzna.name = "kadr_%02d" % (i + 1)
    plaszczyzna.rotation_euler = (math.radians(90), 0.0, -kat)
    plaszczyzna.scale[1] = proporcja

    mat = bpy.data.materials.new(name="mat_kadr_%02d" % (i + 1))
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = obraz
    tex.location = (-400, 200)
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    # Lekka emisja, zeby kadry byly czytelne bez mocnego swiatla.
    if "Emission Color" in bsdf.inputs:
        links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 0.35
    plaszczyzna.data.materials.append(mat)

# Kamera w srodku luku, patrzy w strone kadrow.
bpy.ops.object.camera_add(location=(0.0, 0.0, WYSOKOSC), rotation=(math.radians(90), 0.0, 0.0))
scena.camera = bpy.context.active_object

# Miekkie swiatlo od gory.
bpy.ops.object.light_add(type='AREA', location=(0.0, 0.0, WYSOKOSC + 6.0))
swiatlo = bpy.context.active_object
swiatlo.data.energy = 400.0
swiatlo.data.size = 12.0

wyjscie = r"${plikBlend.replace(/\\/g, '/')}"
bpy.ops.wm.save_as_mainfile(filepath=wyjscie)
print("ZAPISANO:", wyjscie)
print("KADROW:", ile)
`;

    await fs.writeFile(plikPy, skrypt, 'utf8');
    return {
        skrypt: plikPy,
        scena: plikBlend,
        kadrow: obrazy.length,
        pominiete: kadry.length - obrazy.length,
        komenda: `blender --background --python "${plikPy}"`,
    };
}

/** Odpal Blendera na gotowym scenariuszu. Bez binarki — odmowa z instrukcją. */
export async function uruchom(skrypt) {
    const stan = await stanBlendera();
    if (!stan.jest) throw new Error(`${stan.powod} ${stan.cozrobic}`);
    try { await fs.access(skrypt); } catch { throw new Error(`Nie widzę scenariusza: ${skrypt}`); }

    const bin = stan.sciezka === 'blender (PATH)' ? 'blender' : stan.sciezka;
    const { stdout, stderr } = await uruchomProces(bin, ['--background', '--python', skrypt], {
        timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024,
    });
    const log = `${stdout}\n${stderr}`;
    const zapisane = log.match(/ZAPISANO:\s*(.+)/)?.[1]?.trim() ?? null;
    if (!zapisane) throw new Error(`Blender nie zapisał sceny. Ogon logu: ${log.slice(-400)}`);
    return { scena: zapisane, wersja: stan.wersja, log: log.slice(-1500) };
}

export default { KATALOG, stanBlendera, zbudujScenariusz, uruchom };
