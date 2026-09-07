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
import ffmpegPath from 'ffmpeg-static';
import { promisify } from 'util';

const uruchomProces = promisify(execFile);

/**
 * Gdzie szukać Blendera.
 *
 * ⚠️ POPRAWIONE 2026-09-07. Pierwsza wersja miała listę „typowych" katalogów
 * i nie znalazła instalacji Suwerena, bo ta leży w `E:/Modele AI/Blender
 * Foundation/Blender 5.2` — czyli w katalogu modeli AI, a nie w Program Files.
 * Lekcja: „typowe miejsca" to założenie o cudzej maszynie, a nie wiedza.
 *
 * Teraz przeszukujemy każdy dysk o jeden poziom głębiej i honorujemy
 * `OTAKOS_BLENDER` — kto ma Blendera gdzie indziej, wskaże go wprost.
 */
const KORZENIE = ['C:', 'D:', 'E:', 'F:', 'G:'];
const PODKATALOGI = [
    'Program Files/Blender Foundation',
    'Program Files (x86)/Blender Foundation',
    'Blender Foundation',
    'Modele AI/Blender Foundation',
    'Programy/Blender Foundation',
];

/** Wszystkie sensowne katalogi bazowe — istniejące, bez powtórek. */
function kandydaci() {
    const lista = [];
    for (const k of KORZENIE) {
        for (const p of PODKATALOGI) {
            const pelna = `${k}/${p}`;
            if (fsSync.existsSync(pelna)) lista.push(pelna);
        }
    }
    return lista;
}

/** Gdzie lądują scenariusze i sceny. */
export const KATALOG = () => path.join(process.cwd(), '_OtakOs_Wymiar', 'blender');

/**
 * Czy Blender jest. Szukamy w PATH, potem w typowych katalogach.
 * ⚠️ Nie zgadujemy wersji z nazwy katalogu — bierzemy pierwszy istniejący
 * `blender.exe` i pytamy JEGO o wersję.
 */
export async function stanBlendera() {
    // 0. Wskazany wprost — ma pierwszeństwo przed każdym zgadywaniem.
    const zmienna = process.env.OTAKOS_BLENDER;
    if (zmienna && fsSync.existsSync(zmienna)) {
        try {
            const { stdout } = await uruchomProces(zmienna, ['--version'], { timeout: 20000, maxBuffer: 1024 * 1024 });
            return { jest: true, sciezka: zmienna, wersja: String(stdout).split('\n')[0].trim(), skad: 'OTAKOS_BLENDER' };
        } catch { /* wskazany, ale nie działa — szukamy dalej */ }
    }

    // 1. PATH
    try {
        const { stdout } = await uruchomProces('blender', ['--version'], { timeout: 15000, maxBuffer: 1024 * 1024 });
        return { jest: true, sciezka: 'blender', wersja: String(stdout).split('\n')[0].trim(), skad: 'PATH' };
    } catch { /* szukamy dalej */ }

    // 2. Katalogi instalacji na wszystkich dyskach
    const sprawdzone = kandydaci();
    for (const baza of sprawdzone) {
        let wpisy = [];
        try { wpisy = fsSync.readdirSync(baza, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { continue; }
        // Odwrotnie: „Blender 5.2" przed „Blender 4.1" — nowsza wersja pierwsza.
        for (const w of wpisy.sort((a, b) => b.name.localeCompare(a.name, 'en', { numeric: true }))) {
            const exe = path.join(baza, w.name, 'blender.exe');
            if (!fsSync.existsSync(exe)) continue;
            try {
                const { stdout } = await uruchomProces(exe, ['--version'], { timeout: 30000, maxBuffer: 1024 * 1024 });
                return { jest: true, sciezka: exe, wersja: String(stdout).split('\n')[0].trim(), skad: baza };
            } catch { /* uszkodzona instalacja — szukamy dalej */ }
        }
    }

    return {
        jest: false,
        sciezka: null,
        wersja: null,
        // Konkret zamiast „nie znaleziono": gdzie szukałem i co zrobić.
        powod: sprawdzone.length
            ? `Nie widzę blender.exe ani w PATH, ani w: ${sprawdzone.join(', ')}.`
            : 'Nie widzę blender.exe w PATH ani żadnego katalogu „Blender Foundation" na dyskach C-G.',
        cozrobic: 'Wskaż binarkę zmienną OTAKOS_BLENDER albo dopisz Blendera do PATH. Scenariusze .py budują się bez niego.',
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

# Silnik renderu: PYTAMY BLENDERA, co ma, zamiast zgadywac po nazwach klas.
# Pierwsza wersja sprawdzala RenderEngine.__subclasses__() i wywalala sie
# w Blenderze 5.2 na HydraRenderEngine bez bl_idname. Enum z RNA jest
# jedynym zrodlem prawdy, ktore dziala w kazdej wersji.
try:
    dostepne = [i.identifier for i in scena.render.bl_rna.properties['engine'].enum_items]
except Exception:
    dostepne = []
for kandydat in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
    if kandydat in dostepne:
        scena.render.engine = kandydat
        break
print("SILNIK:", scena.render.engine)
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

// ══════════════════════════════════════════════════════════════════════════════
//  WIRTUALNE STUDIO Z KADRU
// ══════════════════════════════════════════════════════════════════════════════

/** Ruchy kamery, które kamerzysta umie wykonać. Zamknięta lista — patrz niżej. */
export const RUCHY = [
    { id: 'orbita', nazwa: 'Orbita wokół sceny', opis: 'Kamera obiega plan po łuku.' },
    { id: 'najazd', nazwa: 'Najazd', opis: 'Kamera zbliża się do tła.' },
    { id: 'odjazd', nazwa: 'Odjazd', opis: 'Kamera cofa się, odsłaniając plan.' },
    { id: 'dzwig', nazwa: 'Dźwig', opis: 'Kamera unosi się i patrzy z góry.' },
    { id: 'trawelling', nazwa: 'Trawelling', opis: 'Kamera jedzie bokiem, równolegle do tła.' },
];

/**
 * Zbuduj WIRTUALNE STUDIO z jednego kadru.
 *
 * Co powstaje: cyklorama z kadrem jako tłem, podłoga, światło trzypunktowe
 * (kluczowe / wypełniające / konturowe), kamera na celowniku i znaczniki
 * pozycji aktorów. To realny plan zdjęciowy, po którym da się jeździć kamerą.
 *
 * ⚠️ TO JEST 2.5D I NIE UDAJĘ INACZEJ. Kadr zostaje PŁASKIM tłem — nie mam
 * czym odtworzyć głębi. Sprawdzone 2026-09-07: w tym ComfyUI nie ma ani jednego
 * noda od map głębi (DepthAnything, MiDaS, Zoe). Prawdziwa rekonstrukcja 3D
 * wymagałaby doinstalowania takiego modelu; bez niego „scena 3D z kadru"
 * znaczy: plan zdjęciowy z kadrem w roli tła, po którym jeździ kamera.
 * Dla wirtualnego studia to i tak jest to, czego się używa — cyklorama
 * w prawdziwym studiu też jest płaska.
 */
export async function zbudujStudio({ projekt, kadr, nazwa = '', szerokoscSceny = 16, aktorow = 2 }) {
    if (!kadr || !/\.(png|jpg|jpeg|webp)$/i.test(kadr)) {
        throw new Error('Studio buduje się z KADRU (.png/.jpg). Z filmu wyjmij klatkę w Ciągu Dalszym.');
    }
    try { await fs.access(kadr); } catch { throw new Error(`Nie widzę kadru: ${kadr}`); }

    const kat = KATALOG();
    await fs.mkdir(kat, { recursive: true });
    const baza = bezpiecznaNazwa(nazwa || `${projekt}_studio`);
    const plikPy = path.join(kat, `${baza}_${Date.now().toString(36)}.py`);
    const plikBlend = plikPy.replace(/\.py$/, '.blend');

    const skrypt = `# -*- coding: utf-8 -*-
# WIRTUALNE STUDIO — projekt: ${projekt}
# Cyklorama z kadru, podloga, swiatlo trzypunktowe, kamera na celowniku,
# znaczniki pozycji aktorow. Uruchom:
#   blender --background --python "${plikPy.replace(/\\/g, '/')}"

import bpy, math, os

KADR = r"${kadr.replace(/\\/g, '/')}"
SZEROKOSC = ${Number(szerokoscSceny) || 16}
AKTOROW = ${Math.max(0, Math.min(8, Number(aktorow) || 0))}

bpy.ops.wm.read_factory_settings(use_empty=True)
scena = bpy.context.scene

try:
    dostepne = [i.identifier for i in scena.render.bl_rna.properties['engine'].enum_items]
except Exception:
    dostepne = []
for kandydat in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
    if kandydat in dostepne:
        scena.render.engine = kandydat
        break
print("SILNIK:", scena.render.engine)

obraz = bpy.data.images.load(KADR)
szer_px, wys_px = obraz.size
proporcja = (wys_px / szer_px) if szer_px else 0.5625
WYSOKOSC = SZEROKOSC * proporcja

# ── CYKLORAMA: tlo z kadru, stoi pionowo za planem ────────────────────────────
bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, SZEROKOSC * 0.55, WYSOKOSC / 2))
tlo = bpy.context.active_object
tlo.name = "cyklorama"
tlo.rotation_euler = (math.radians(90), 0.0, 0.0)
tlo.scale = (SZEROKOSC, WYSOKOSC, 1.0)

mat_tlo = bpy.data.materials.new(name="mat_cyklorama")
mat_tlo.use_nodes = True
n = mat_tlo.node_tree.nodes
l = mat_tlo.node_tree.links
bsdf = n.get("Principled BSDF")
tex = n.new("ShaderNodeTexImage")
tex.image = obraz
tex.location = (-420, 220)
l.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
if "Emission Color" in bsdf.inputs:
    l.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 0.5
bsdf.inputs["Roughness"].default_value = 0.9
tlo.data.materials.append(mat_tlo)

# ── PODLOGA ───────────────────────────────────────────────────────────────────
bpy.ops.mesh.primitive_plane_add(size=SZEROKOSC * 2.4, location=(0.0, 0.0, 0.0))
podloga = bpy.context.active_object
podloga.name = "podloga"
mat_pod = bpy.data.materials.new(name="mat_podloga")
mat_pod.use_nodes = True
pb = mat_pod.node_tree.nodes.get("Principled BSDF")
pb.inputs["Base Color"].default_value = (0.05, 0.05, 0.06, 1.0)
pb.inputs["Roughness"].default_value = 0.35
podloga.data.materials.append(mat_pod)

# ── SWIATLO TRZYPUNKTOWE ──────────────────────────────────────────────────────
# Kluczowe: mocne, z boku i gory. Wypelniajace: slabsze, z drugiej strony.
# Konturowe: od tylu, odrywa postac od tla. Tak sie oswietla plan naprawde.
def swiatlo(nazwa, typ, poz, moc, rozmiar=5.0):
    bpy.ops.object.light_add(type=typ, location=poz)
    ob = bpy.context.active_object
    ob.name = nazwa
    ob.data.energy = moc
    if typ == 'AREA':
        ob.data.size = rozmiar
    return ob

swiatlo("kluczowe", 'AREA', (-SZEROKOSC * 0.5, -SZEROKOSC * 0.35, WYSOKOSC * 1.1), 900.0, SZEROKOSC * 0.5)
swiatlo("wypelniajace", 'AREA', (SZEROKOSC * 0.55, -SZEROKOSC * 0.3, WYSOKOSC * 0.7), 320.0, SZEROKOSC * 0.6)
swiatlo("konturowe", 'AREA', (0.0, SZEROKOSC * 0.4, WYSOKOSC * 1.2), 500.0, SZEROKOSC * 0.35)

# ── CELOWNIK I KAMERA ─────────────────────────────────────────────────────────
# Kamera patrzy na pusty obiekt w srodku planu. Dzieki temu kazdy ruch kamery
# (orbita, najazd, dzwig) trzyma kadr — wystarczy przesuwac kamere.
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, 0.0, WYSOKOSC * 0.45))
cel = bpy.context.active_object
cel.name = "CEL"

bpy.ops.object.camera_add(location=(0.0, -SZEROKOSC * 0.95, WYSOKOSC * 0.5))
kamera = bpy.context.active_object
kamera.name = "KAMERA"
scena.camera = kamera
sledz = kamera.constraints.new(type='TRACK_TO')
sledz.target = cel
sledz.track_axis = 'TRACK_NEGATIVE_Z'
sledz.up_axis = 'UP_Y'

# ── ZNACZNIKI POZYCJI AKTOROW ─────────────────────────────────────────────────
for i in range(AKTOROW):
    x = (i - (AKTOROW - 1) / 2.0) * (SZEROKOSC * 0.22)
    bpy.ops.object.empty_add(type='SINGLE_ARROW', location=(x, -SZEROKOSC * 0.05, 0.0))
    znacznik = bpy.context.active_object
    znacznik.name = "AKTOR_%d" % (i + 1)
    znacznik.empty_display_size = 1.6

wyjscie = r"${plikBlend.replace(/\\/g, '/')}"
bpy.ops.wm.save_as_mainfile(filepath=wyjscie)
print("ZAPISANO:", wyjscie)
print("STUDIO:", SZEROKOSC, "x", round(WYSOKOSC, 2), "AKTOROW:", AKTOROW)
`;

    await fs.writeFile(plikPy, skrypt, 'utf8');
    return {
        skrypt: plikPy,
        scena: plikBlend,
        kadr,
        uwaga: 'Kadr jest PŁASKIM tłem (cyklorama) — w tym ComfyUI nie ma noda od map głębi, więc nie odtwarzam bryły sceny. Kamera jeździ po prawdziwym planie, ale tło zostaje płaskie.',
    };
}

/**
 * Nakręć ujęcie w gotowym studiu — TeOgochi w roli kamerzysty.
 *
 * ⚠️ TO JEST RENDER, NIE GENERACJA. Blender liczy klatki z tej sceny; nic tu
 * nie zmyśla. Dlatego wynik jest powtarzalny i zgodny z planem — w odróżnieniu
 * od ujęć z modelu wideo.
 */
export async function skryptUjecia({ blend, ruch = 'orbita', sekundy = 4, fps = 24, szerokosc = 704, wysokosc = 480, nazwa = '' }) {
    try { await fs.access(blend); } catch { throw new Error(`Nie widzę sceny: ${blend}`); }
    if (!RUCHY.some((r) => r.id === ruch)) {
        throw new Error(`Nieznany ruch „${ruch}". Dostępne: ${RUCHY.map((r) => r.id).join(', ')}.`);
    }

    const kat = KATALOG();
    const baza = bezpiecznaNazwa(nazwa || path.basename(blend, '.blend'));
    const znacznik = Date.now().toString(36);
    const plikPy = path.join(kat, `${baza}_ujecie_${znacznik}.py`);
    // ⚠️ Jeden znacznik na skrypt I na katalog klatek. Dwa osobne `Date.now()`
    // potrafily sie roznic o milisekunde i skrypt renderowal do innego katalogu,
    // niz potem przeszukiwal ffmpeg.
    const wyjscieBaza = path.join(kat, `${baza}_ujecie_${znacznik}`);
    await fs.mkdir(wyjscieBaza, { recursive: true });

    const klatek = Math.max(12, Math.round(Number(sekundy) * Number(fps)));

    const skrypt = `# -*- coding: utf-8 -*-
# UJECIE w gotowym studiu — ruch: ${ruch}
import bpy, math

bpy.ops.wm.open_mainfile(filepath=r"${blend.replace(/\\/g, '/')}")
scena = bpy.context.scene
kamera = bpy.data.objects.get("KAMERA")
cel = bpy.data.objects.get("CEL")
if kamera is None:
    raise RuntimeError("W tej scenie nie ma obiektu KAMERA — to nie jest studio zbudowane przez Katedre.")

KLATEK = ${klatek}
scena.frame_start = 1
scena.frame_end = KLATEK
scena.render.fps = ${Math.max(1, Number(fps) || 24)}
scena.render.resolution_x = ${Math.max(64, Number(szerokosc) || 704)}
scena.render.resolution_y = ${Math.max(64, Number(wysokosc) || 480)}
scena.render.resolution_percentage = 100

# Wyjscie: SEKWENCJA PNG, nie gotowy film.
# ⚠️ Blender 5.2 wyrzucil 'FFMPEG' z image_settings.file_format — jest tam
# teraz media_type='VIDEO', a w 3.x i 4.x bylo jeszcze inaczej. Zamiast gonic
# za API wersja po wersji, renderujemy klatki i skladamy je NASZYM ffmpegiem:
# tym samym, ktorym Katedra sklada wszystko inne. Wynik jest przewidywalny
# i niezalezny od tego, jaka wersje Blendera ktos ma.
scena.render.image_settings.file_format = 'PNG'
scena.render.filepath = r"${wyjscieBaza.replace(/\\/g, '/')}/klatka_"

start = kamera.location.copy()
promien = math.hypot(start.x, start.y) or 8.0
kat_start = math.atan2(start.y, start.x)

def klucz(nr, poz):
    kamera.location = poz
    kamera.keyframe_insert(data_path="location", frame=nr)

RUCH = "${ruch}"
if RUCH == "orbita":
    for i in range(0, KLATEK + 1, max(1, KLATEK // 12)):
        t = i / KLATEK
        kat = kat_start + math.radians(70) * t
        klucz(i + 1, (math.cos(kat) * promien, math.sin(kat) * promien, start.z))
elif RUCH == "najazd":
    klucz(1, start)
    klucz(KLATEK, (start.x * 0.45, start.y * 0.45, start.z * 0.9))
elif RUCH == "odjazd":
    klucz(1, (start.x * 0.5, start.y * 0.5, start.z * 0.95))
    klucz(KLATEK, start)
elif RUCH == "dzwig":
    klucz(1, start)
    klucz(KLATEK, (start.x, start.y * 0.8, start.z * 2.6))
elif RUCH == "trawelling":
    klucz(1, (start.x - promien * 0.35, start.y, start.z))
    klucz(KLATEK, (start.x + promien * 0.35, start.y, start.z))

# Plynny ruch: bez tego kamera szarpie na kazdym kluczu.
# ⚠️ Blender 4.4+/5.x przeniosl fcurves z Action do warstw i slotow
# ("slotted actions"). Stare action.fcurves wywala AttributeError.
# ⚠️ Bez odwrotnych apostrofow — ten skrypt siedzi w szablonie JS.
# Czytamy obiema drogami, zeby skrypt dzialal w kazdej wersji.
def krzywe(ob):
    ad = getattr(ob, "animation_data", None)
    akcja = getattr(ad, "action", None) if ad else None
    if akcja is None:
        return []
    if hasattr(akcja, "fcurves"):
        return list(akcja.fcurves)
    wynik = []
    for warstwa in getattr(akcja, "layers", []):
        for pasek in getattr(warstwa, "strips", []):
            for worek in getattr(pasek, "channelbags", []):
                wynik.extend(getattr(worek, "fcurves", []))
    return wynik

for f in krzywe(kamera):
    for kp in f.keyframe_points:
        kp.interpolation = 'BEZIER'

bpy.ops.render.render(animation=True)
print("UJECIE:", scena.render.filepath)
print("KLATEK:", KLATEK)
`;

    await fs.writeFile(plikPy, skrypt, 'utf8');
    return { skrypt: plikPy, wyjscieBaza, klatek, ruch };
}

/**
 * Zloz wyrenderowane klatki w plik mp4 — naszym ffmpegiem.
 * ⚠️ Osobny krok, bo Blender w kazdej wersji inaczej nazywa wyjscie wideo.
 * Klatki sa wspolnym mianownikiem, ktory dziala zawsze.
 */
export async function zlozKlatki(katalogKlatek, fps = 24) {
    let pliki = [];
    try {
        pliki = (await fs.readdir(katalogKlatek)).filter((n) => n.toLowerCase().endsWith('.png')).sort();
    } catch { throw new Error(`Nie widzę katalogu klatek: ${katalogKlatek}`); }
    if (!pliki.length) throw new Error(`Blender nie zapisał ani jednej klatki w ${katalogKlatek}.`);

    const cel = `${katalogKlatek}.mp4`;
    await uruchomProces(ffmpegPath, [
        '-framerate', String(fps),
        '-i', path.join(katalogKlatek, 'klatka_%04d.png'),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-y', cel,
    ], { maxBuffer: 16 * 1024 * 1024 });

    const st = await fs.stat(cel);
    return { plik: cel, klatek: pliki.length, bajtow: st.size, fps };
}

/**
 * Skrypt eksportu sceny do .glb — formatu, ktory czyta przegladarka.
 *
 * ⚠️ glTF/GLB, nie .blend. TeO Game Studio to aplikacja webowa; .blend jest
 * dla niej nieczytelny, a .glb wczytuje kazdy loader three.js. To jedyny
 * format, ktory ma sens po tej stronie mostu.
 */
export async function skryptGlb({ blend, nazwa = '' }) {
    const bs = String.fromCharCode(92);   // odwrotny ukosnik bez uciekania w szablonie
    try { await fs.access(blend); } catch { throw new Error(`Nie widze sceny: ${blend}`); }
    const kat = KATALOG();
    const baza = bezpiecznaNazwa(nazwa || path.basename(blend, '.blend'));
    const znacznik = Date.now().toString(36);
    const plikPy = path.join(kat, baza + '_glb_' + znacznik + '.py');
    const plikGlb = path.join(kat, baza + '_' + znacznik + '.glb');

    const skrypt = [
        '# -*- coding: utf-8 -*-',
        '# Eksport sceny do .glb — dla TeO Game Studio.',
        'import bpy',
        'bpy.ops.wm.open_mainfile(filepath=r"' + blend.split(bs).join('/') + '")',
        'wyjscie = r"' + plikGlb.split(bs).join('/') + '"',
        '# Tekstury WBUDOWANE w plik: inaczej .glb wskazuje na obrazy,',
        '# ktorych przegladarka po drugiej stronie nie ma.',
        'bpy.ops.export_scene.gltf(filepath=wyjscie, export_format="GLB", export_cameras=True, export_lights=True)',
        'print("ZAPISANO:", wyjscie)',
    ].join(String.fromCharCode(10));

    await fs.writeFile(plikPy, skrypt, 'utf8');
    return { skrypt: plikPy, glb: plikGlb };
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
    // ⚠️ NAJPIERW SZUKAMY TRACEBACKU. Pierwsza wersja meldowała „Blender nie
    // zapisał sceny" i doklejała ogon logu — a prawdziwa przyczyna (wyjątek
    // Pythona) była wyżej i wypadała z okna. Diagnoza gorsza niż żadna.
    const tb = log.match(/Traceback \(most recent call last\):[\s\S]*/);
    if (tb) {
        const linie = tb[0].trim().split('\n');
        throw new Error(`Skrypt Blendera padł: ${linie[linie.length - 1].trim()}`);
    }

    // Skrypty budujące scenę meldują ZAPISANO, renderujące — UJECIE.
    const zapisane = (log.match(/ZAPISANO:\s*(.+)/) ?? log.match(/UJECIE:\s*(.+)/))?.[1]?.trim() ?? null;
    if (!zapisane) throw new Error(`Blender nic nie zameldował. Ogon logu: ${log.slice(-400)}`);
    return { scena: zapisane, wersja: stan.wersja, log: log.slice(-1500) };
}

export default {
    KATALOG, RUCHY, stanBlendera, zbudujScenariusz, zbudujStudio,
    skryptUjecia, zlozKlatki, skryptGlb, uruchom,
};
