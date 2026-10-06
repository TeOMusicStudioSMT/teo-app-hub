/**
 * 🎞️ Ruch brył 3D — etap 1: ruchy proceduralne w Blenderze (Suweren 2026-10-06: „trzeba potem sekcję do ruchów
 * tych modeli… 1 sekcji ruchów”).
 *
 * Bryła z Assetów 3D (TRELLIS.2 → model.glb) dostaje JEDEN z ruchów poniżej. Blender wczytuje GLB, wiesza wszystkie
 * obiekty pod pustakiem RUCH (oś w środku PODSTAWY bryły — kołysanie i oddech idą od ziemi, nie od pępka), kluczuje
 * pustaka klatka po klatce i eksportuje GLB z animacją (`ruch_<id>` — three.js: AnimationMixer + clipAction).
 * Pętla jest domknięta: pierwsza i ostatnia klatka to ta sama poza, więc zapętlony klip nie szarpie.
 * Podgląd: kamera ¾ z przodu, klatki PNG → nasz ffmpeg → mp4 (jak w Studiu 3D — niezależnie od wersji Blendera).
 *
 * UCZCIWIE: to ruch CAŁEJ bryły (obrót, unoszenie, kołysanie, oddech, podskok). Chodu, machania ręką itp. tu nie ma —
 * to wymaga szkieletu (rig) i modelu ruchu; etap 2, po sprawdzeniu licencji.
 *
 * Pliki w katalogu assetu: ruch-<id>.glb, ruch-<id>.mp4; meta.ruchy = [{ ruch, glb, mp4, sekundy, klatek, czas, utworzono }].
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const RUCHY_BRYL = [
    { id: 'obrot', nazwa: 'Obrót', opis: 'pełny obrót wokół osi — przedmiot do podniesienia, prezentacja w sklepie' },
    { id: 'lewitacja', nazwa: 'Lewitacja', opis: 'unosi się, opada i lekko obraca — kryształ, artefakt, duch' },
    { id: 'kolysanie', nazwa: 'Kołysanie', opis: 'kołysze się na boki od podstawy — drzewo, sztandar, postać w spoczynku' },
    { id: 'oddech', nazwa: 'Oddech', opis: 'delikatnie rośnie i opada — postać albo stwór w spoczynku (idle)' },
    { id: 'podskok', nazwa: 'Podskok', opis: 'podskakuje i ugina się przy ziemi — znajdźka, slime, radosny stworek' },
];
const ID_RUCHOW = new Set(RUCHY_BRYL.map((r) => r.id));

/** Ścieżka do skryptu Pythona: ukośniki w przód (Windows też je przyjmuje), bez cudzysłowów w środku. */
const sciezkaPy = (p) => {
    const s = String(p).split(String.fromCharCode(92)).join('/');
    if (s.includes('"')) throw new Error(`Ścieżka z cudzysłowem nie przejdzie do Blendera: ${s}`);
    return s;
};

/**
 * Skrypt Blendera (czysty — testowalny bez Blendera).
 * @param {{ wejscie: string, glb: string, klatki?: string|null, ruch: string, sekundy?: number, fps?: number, rozmiar?: number }} o
 */
export function skryptRuchu({ wejscie, glb, klatki = null, ruch, sekundy = 2, fps = 24, rozmiar = 512 }) {
    if (!ID_RUCHOW.has(ruch)) throw new Error(`Nieznany ruch „${ruch}”. Są: ${[...ID_RUCHOW].join(', ')}.`);
    const sek = Math.min(8, Math.max(1, Number(sekundy) || 2));
    const kl = Math.max(12, Math.round(sek * (Number(fps) || 24)));
    const roz = Math.min(1024, Math.max(128, Math.round(Number(rozmiar) || 512)));
    return `# -*- coding: utf-8 -*-
# RUCH BRYLY — Katedra OtakOS (services/RuchBryl.js). Ruch: ${ruch}
import bpy, math, os
from mathutils import Vector

WEJSCIE = r"${sciezkaPy(wejscie)}"
GLB = r"${sciezkaPy(glb)}"
KLATKI = r"${klatki ? sciezkaPy(klatki) : ''}"
RUCH = "${ruch}"
KLATEK = ${kl}
FPS = ${Number(fps) || 24}

bpy.ops.wm.read_factory_settings(use_empty=True)
# Ustawienia fabryczne wylaczaja dodatki — a Cycles jest dodatkiem. Bez niego maszyna bez GPU/OpenGL
# (OTAKOS_BLENDER_SILNIK=CYCLES) nie ma czym policzyc podgladu.
try:
    import addon_utils
    addon_utils.enable("cycles", default_set=True)
except Exception as e:
    print("CYCLES niedostepny:", e)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start = 1
sc.frame_end = KLATEK

bpy.ops.import_scene.gltf(filepath=WEJSCIE)
siatki = [o for o in sc.objects if o.type == 'MESH']
if not siatki:
    raise RuntimeError("W tym GLB nie ma siatki.")
bpy.context.view_layer.update()
pkt = [o.matrix_world @ Vector(c) for o in siatki for c in o.bound_box]
mn = Vector((min(p.x for p in pkt), min(p.y for p in pkt), min(p.z for p in pkt)))
mx = Vector((max(p.x for p in pkt), max(p.y for p in pkt), max(p.z for p in pkt)))
srodek = (mn + mx) / 2
wys = max(mx.z - mn.z, 1e-3)
rozm = max(mx.x - mn.x, mx.y - mn.y, wys)

korzenie = [o for o in sc.objects if o.parent is None]
os_ruchu = bpy.data.objects.new("RUCH", None)
sc.collection.objects.link(os_ruchu)
os_ruchu.location = (srodek.x, srodek.y, mn.z)
bpy.context.view_layer.update()
for o in korzenie:
    mw = o.matrix_world.copy()
    o.parent = os_ruchu
    o.matrix_world = mw

L0 = os_ruchu.location.copy()
def poza(t):
    """t w [0, 1]; t=0 i t=1 to ta sama poza (domknieta petla)."""
    s = math.sin(2 * math.pi * t)
    lok, rot, skala = L0.copy(), [0.0, 0.0, 0.0], [1.0, 1.0, 1.0]
    if RUCH == "obrot":
        rot[2] = 2 * math.pi * t
    elif RUCH == "lewitacja":
        lok.z += 0.10 * wys * (0.5 - 0.5 * math.cos(2 * math.pi * t))
        rot[2] = 0.20 * s
    elif RUCH == "kolysanie":
        rot[1] = 0.10 * s
        rot[0] = 0.03 * math.sin(4 * math.pi * t)
    elif RUCH == "oddech":
        skala = [1 - 0.012 * s, 1 - 0.012 * s, 1 + 0.035 * s]
    elif RUCH == "podskok":
        h = math.sin(math.pi * t)
        lok.z += 0.30 * wys * h
        zgniot = 0.15 * max(0.0, 1 - 4 * h)
        skala = [1 + zgniot / 2, 1 + zgniot / 2, 1 - zgniot]
    return lok, rot, skala

for i in range(KLATEK + 1):
    lok, rot, skala = poza(i / KLATEK)
    os_ruchu.location = lok
    os_ruchu.rotation_euler = rot
    os_ruchu.scale = skala
    for sciezka in ("location", "rotation_euler", "scale"):
        os_ruchu.keyframe_insert(data_path=sciezka, frame=i + 1)

ad = os_ruchu.animation_data
if ad and ad.action:
    ad.action.name = "ruch_" + RUCH

# Krzywe liniowe: klucz jest na KAZDEJ klatce, wiec Bezier tylko by przestrzelil.
# Blender 4.4+/5.x trzyma krzywe w warstwach akcji (slotted actions) — czytamy obiema drogami.
def krzywe(akcja):
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
for f in krzywe(ad.action if ad else None):
    for kp in f.keyframe_points:
        kp.interpolation = 'LINEAR'

bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_animations=True, export_cameras=False, export_lights=False)
print("ANIMACJA:", "ruch_" + RUCH, "KLATEK:", KLATEK)

if KLATKI:
    os.makedirs(KLATKI, exist_ok=True)
    cel = bpy.data.objects.new("CEL", None)
    sc.collection.objects.link(cel)
    cel.location = (srodek.x, srodek.y, mn.z + wys * 0.5)
    kam_dane = bpy.data.cameras.new("KAMERA")
    kam_dane.lens = 50
    kam = bpy.data.objects.new("KAMERA", kam_dane)
    sc.collection.objects.link(kam)
    d = rozm * 2.6
    kam.location = (srodek.x + d * 0.55, srodek.y - d * 0.85, mn.z + wys * 0.6 + d * 0.22)
    tor = kam.constraints.new(type='TRACK_TO')
    tor.target = cel
    tor.track_axis = 'TRACK_NEGATIVE_Z'
    tor.up_axis = 'UP_Y'
    sc.camera = kam
    for nazwa, energia, kat in (("KLUCZ", 3.5, (0.8, 0.2, 0.6)), ("KONTRA", 1.5, (-0.9, 0.0, -2.4))):
        sw = bpy.data.lights.new(nazwa, type='SUN')
        sw.energy = energia
        ob = bpy.data.objects.new(nazwa, sw)
        ob.rotation_euler = kat
        sc.collection.objects.link(ob)
    if sc.world is None:
        sc.world = bpy.data.worlds.new("SWIAT")
    if not sc.world.node_tree:
        sc.world.use_nodes = True
    tlo = sc.world.node_tree.nodes.get("Background") if sc.world.node_tree else None
    if tlo:
        tlo.inputs[0].default_value = (0.035, 0.045, 0.07, 1.0)
        tlo.inputs[1].default_value = 0.6
    # Lista silnikow w bl_rna bywa nieodswiezona po wlaczeniu dodatku — probujemy przypisac wprost.
    for kandydat in (os.environ.get('OTAKOS_BLENDER_SILNIK', ''), 'BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
        if not kandydat:
            continue
        try:
            sc.render.engine = kandydat
            break
        except TypeError:
            pass
    if sc.render.engine == 'CYCLES':
        sc.cycles.samples = 24
        sc.cycles.use_denoising = False
    print("SILNIK:", sc.render.engine)
    sc.render.resolution_x = ${roz}
    sc.render.resolution_y = ${roz}
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = KLATKI + "/klatka_"
    bpy.ops.render.render(animation=True)

print("ZAPISANO:", GLB)
`;
}

/**
 * @param {{
 *   katalogAssetu: (id: string) => string,
 *   blender: { stanBlendera: () => Promise<any>, uruchom: (skrypt: string, o?: object) => Promise<any>, zlozKlatki: (kat: string, fps?: number) => Promise<any> },
 *   szyna?: { nadaj?: (z: object) => Promise<any> },
 *   limitMs?: number,
 * }} o
 */
export function utworzRuch({ katalogAssetu, blender, szyna = null, limitMs = 20 * 60_000 }) {
    const zadania = new Map();
    const idOk = (id) => /^[a-z0-9-]{3,60}$/.test(String(id || ''));
    const plikMeta = (id) => path.join(katalogAssetu(id), 'meta.json');
    const czytajMeta = async (id) => JSON.parse(await fs.readFile(plikMeta(id), 'utf8'));
    const zapiszMeta = (id, m) => fs.writeFile(plikMeta(id), JSON.stringify(m, null, 2), 'utf8');

    /** Ruch dla gotowej bryły — w tle; jedno naraz (Blender na CPU/GPU, obok ComfyUI). */
    async function ozyw(id, { ruch, sekundy = 2, fps = 24, podglad = true } = {}) {
        if (!idOk(id)) throw new Error('Złe id assetu.');
        if (!ID_RUCHOW.has(ruch)) throw new Error(`Nieznany ruch „${ruch}”. Są: ${[...ID_RUCHOW].join(', ')}.`);
        let m;
        try { m = await czytajMeta(id); } catch { throw new Error('Nie ma takiego assetu 3D.'); }
        const dir = katalogAssetu(id);
        const model = path.join(dir, 'model.glb');
        if (m.stan !== 'gotowe' || !fsSync.existsSync(model)) throw new Error('Bryła nie jest gotowa — ruch dopiero po model.glb.');
        if ([...zadania.values()].some((z) => z.stan === 'trwa')) throw new Error('Jeden ruch naraz — Blender już liczy.');
        const st = await blender.stanBlendera();
        if (!st.jest) throw new Error(`${st.powod ?? 'Nie widzę Blendera.'} ${st.cozrobic ?? ''}`.trim());

        const z = { id: `ru-${Date.now().toString(36)}`, asset: id, ruch, stan: 'trwa', etap: 'blender', od: new Date().toISOString(), koniec: null, blad: null };
        zadania.set(z.id, z);
        (async () => {
            const t0 = Date.now();
            const glbTmp = path.join(dir, `ruch-${ruch}.tmp.glb`);
            const klatki = podglad ? path.join(dir, `ruch-${ruch}-klatki`) : null;
            const skrypt = path.join(dir, `ruch-${ruch}.py`);
            try {
                if (klatki) await fs.rm(klatki, { recursive: true, force: true });
                await fs.writeFile(skrypt, skryptRuchu({ wejscie: model, glb: glbTmp, klatki, ruch, sekundy, fps }), 'utf8');
                const w = await blender.uruchom(skrypt, { limitMs });
                if (!fsSync.existsSync(glbTmp)) throw new Error('Blender skończył, ale nie zapisał GLB z ruchem.');
                const klatek = Number(String(w?.log ?? '').match(/KLATEK:\s*(\d+)/)?.[1]) || Math.max(12, Math.round(Math.min(8, Math.max(1, Number(sekundy) || 2)) * (Number(fps) || 24)));
                let mp4 = null;
                if (klatki) {
                    z.etap = 'podglad';
                    const film = await blender.zlozKlatki(klatki, fps);
                    mp4 = `ruch-${ruch}.mp4`;
                    await fs.rename(film.plik, path.join(dir, mp4));
                    await fs.rm(klatki, { recursive: true, force: true });
                }
                await fs.rename(glbTmp, path.join(dir, `ruch-${ruch}.glb`));
                const swiezy = await czytajMeta(id);
                const wpis = { ruch, glb: `ruch-${ruch}.glb`, mp4, sekundy: Math.min(8, Math.max(1, Number(sekundy) || 2)), klatek, czas: Math.round((Date.now() - t0) / 1000), utworzono: new Date().toISOString() };
                swiezy.ruchy = [...(swiezy.ruchy ?? []).filter((r) => r.ruch !== ruch), wpis];
                await zapiszMeta(id, swiezy);
                z.stan = 'gotowe'; z.etap = 'gotowe'; z.wynik = wpis;
                await szyna?.nadaj?.({ agent: 'Assety3D', rodzaj: 'praca', tresc: `„${swiezy.nazwa}” dostał ruch „${ruch}” (${wpis.czas} s)`, dane: { asset: id, ruch } }).catch(() => {});
            } catch (e) {
                z.stan = 'blad'; z.etap = 'blad'; z.blad = e.message;
                await fs.rm(glbTmp, { force: true }).catch(() => {});
                if (klatki) await fs.rm(klatki, { recursive: true, force: true }).catch(() => {});
            } finally {
                await fs.rm(skrypt, { force: true }).catch(() => {});
                z.koniec = new Date().toISOString();
            }
        })();
        return { zadanie: z.id };
    }

    async function usun(id, ruch) {
        if (!idOk(id) || !ID_RUCHOW.has(ruch)) throw new Error('Złe id assetu albo ruchu.');
        const m = await czytajMeta(id);
        const dir = katalogAssetu(id);
        for (const p of [`ruch-${ruch}.glb`, `ruch-${ruch}.mp4`]) await fs.rm(path.join(dir, p), { force: true });
        m.ruchy = (m.ruchy ?? []).filter((r) => r.ruch !== ruch);
        await zapiszMeta(id, m);
        return m.ruchy;
    }

    return {
        RUCHY: RUCHY_BRYL,
        ozyw,
        usun,
        zadanie: (id) => zadania.get(id) ?? null,
        lista: () => [...zadania.values()],
    };
}

export default { RUCHY_BRYL, skryptRuchu, utworzRuch };
