import unreal
import os
import sys
import json
import glob
import math
import importlib

# 🎬 GENESIS OVERRIDE — KOMPILATOR REŻYSERA (gra = Film = opowieść)
# Czyta manifest filmu (stories/*.json) i generuje HYBRYDĘ FILM→GRA:
#   • geometria scen (grywalny poziom) wg presetów środowisk,
#   • wtyczki sceny z forge_plugins/ (mody),
#   • Level Sequence „Cine_Story" z cięciami kamer (film), auto_play → po sekwencji grasz.
#
# Uruchom w UE: Narzędzia → Wykonaj skrypt Pythona → story_compiler.py
# (bierze NAJNOWSZY manifest z stories/; albo ustaw STORY_FILE poniżej).
# Idempotentny (find-or-spawn). Etos „zero z dupy": kamery i geometria stoją nawet,
# gdy Sequencer w 5.8 ma inne API (cała warstwa filmowa jest w try/except).

SCHEMA_VERSION = 1
SCENE_SPACING = 4000          # cm między origin kolejnych scen (by się nie nakładały)
STORY_FILE = None             # None = najnowszy z stories/; albo wpisz ścieżkę .json
CUBE = "/Engine/BasicShapes/Cube.Cube"
SPHERE = "/Engine/BasicShapes/Sphere.Sphere"


# ── Fundament: find-or-spawn ─────────────────────────────────────────────────
def find_actor(label):
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        if a.get_actor_label() == label:
            return a
    return None


def fos(cls, label, loc):
    a = find_actor(label)
    if a is None:
        a = unreal.EditorActorSubsystem().spawn_actor_from_class(cls, loc)
        a.set_actor_label(label)
    a.set_actor_location(loc, False, False)
    return a


def _cube(label, loc, scale):
    a = fos(unreal.StaticMeshActor, label, loc)
    a.static_mesh_component.set_static_mesh(unreal.load_asset(CUBE))
    a.set_actor_scale3d(scale)
    return a


def _plight(label, loc, color255, intensity=9000.0, radius=750.0):
    a = fos(unreal.PointLight, label, loc)
    c = a.get_component_by_class(unreal.PointLightComponent)
    c.set_editor_property('light_color', unreal.Color(*color255))  # Color 0-255 (set_light_color chce LinearColor)
    c.set_intensity(intensity)
    c.set_attenuation_radius(radius)
    return a


def _text(label, content, loc, color255, size=18.0):
    a = fos(unreal.TextRenderActor, label, loc)
    tc = a.text_render
    tc.set_text(unreal.Text(content))
    tc.set_text_render_color(unreal.Color(*color255))
    tc.set_world_size(size)
    return a


def tame_local_lights():
    # Dekoracyjne światła bez dynamicznego cienia (fix VSM single-pass) + anty-przepalenie.
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        comp = None
        if isinstance(a, unreal.PointLight):
            comp = a.get_component_by_class(unreal.PointLightComponent)
        elif isinstance(a, unreal.SpotLight):
            comp = a.get_component_by_class(unreal.SpotLightComponent)
        if comp is None:
            continue
        try:
            comp.set_editor_property("cast_shadows", False)
        except Exception:
            pass
        try:
            if comp.get_editor_property("intensity") > 4000.0:
                comp.set_intensity(4000.0)
        except Exception:
            pass


def ensure_baseline_light():
    # Minimum światła, by „pusto" nie było czarne (gotcha: NIE zeruj DirectionalLight).
    sun = fos(unreal.DirectionalLight, "Story_Baseline_Sun", unreal.Vector(0, 0, 1500))
    sun.get_component_by_class(unreal.DirectionalLightComponent).set_intensity(0.6)
    fos(unreal.SkyLight, "Story_Baseline_Sky", unreal.Vector(0, 0, 1200))


# ── Środowiska (presety) — reużywają wygląd istniejących scen, offset = origin ─
def build_antresola(o, sid):
    # Uniesiona platforma-punkt obserwacyjny z panelem OtakOS (biurko, terminal, neony, wrota).
    _cube("Env_%s_Antresola" % sid, o + unreal.Vector(0, 0, 5),  unreal.Vector(7.0, 7.0, 0.3))  # platforma
    _cube("Env_%s_Desk" % sid,     o + unreal.Vector(0, 0, 45), unreal.Vector(2.4, 1.2, 0.15))
    _cube("Env_%s_DeskLeg" % sid,  o + unreal.Vector(0, 0, 20), unreal.Vector(2.0, 0.9, 0.4))
    _cube("Env_%s_Panel" % sid,    o + unreal.Vector(0, 0, 75), unreal.Vector(0.5, 0.08, 0.45))  # panel OtakOS
    _text("Env_%s_PanelLbl" % sid, "KATEDRA OtakOS", o + unreal.Vector(-2, 0, 90), (0, 230, 255, 255), 14.0)
    _plight("Env_%s_NeonV" % sid, o + unreal.Vector(-200, 200, 120), (140, 0, 255, 255), 4000.0, 650.0)
    _plight("Env_%s_NeonC" % sid, o + unreal.Vector(200, -200, 120), (0, 230, 255, 255), 4000.0, 650.0)
    _cube("Env_%s_GateL" % sid, o + unreal.Vector(700, -120, 200), unreal.Vector(0.4, 1.2, 4.0))
    _cube("Env_%s_GateR" % sid, o + unreal.Vector(700,  120, 200), unreal.Vector(0.4, 1.2, 4.0))


def build_wyspa(o, sid):
    # Punkt startu: ocean (wielka tafla) + wyspa (uniesiony teren) + Antresola na środku.
    _cube("Env_%s_Ocean" % sid,  o + unreal.Vector(0, 0, -30), unreal.Vector(80.0, 80.0, 0.1))  # ocean
    _cube("Env_%s_Island" % sid, o + unreal.Vector(0, 0, -5),  unreal.Vector(18.0, 18.0, 0.4))  # teren wyspy
    build_antresola(o, sid)  # Antresola jako punkt obserwacyjny


def build_atrium(o, sid):
    n, R = 8, 460
    for i in range(n):
        ang = (2 * math.pi / n) * i
        _cube("Env_%s_Beam_%d" % (sid, i),
              o + unreal.Vector(R * math.cos(ang), R * math.sin(ang), 320),
              unreal.Vector(0.15, 0.15, 7.0))
    _cube("Env_%s_TopX" % sid, o + unreal.Vector(0, 0, 660), unreal.Vector(9.5, 0.25, 0.25))
    _cube("Env_%s_TopY" % sid, o + unreal.Vector(0, 0, 660), unreal.Vector(0.25, 9.5, 0.25))
    _plight("Env_%s_GlassV" % sid, o + unreal.Vector(460, 0, 420), (140, 0, 255, 255))
    _plight("Env_%s_GlassC" % sid, o + unreal.Vector(-460, 0, 420), (0, 230, 255, 255))
    _plight("Env_%s_GlassG" % sid, o + unreal.Vector(0, 460, 420), (255, 200, 40, 255))
    _plight("Env_%s_GlassR" % sid, o + unreal.Vector(0, -460, 420), (255, 40, 160, 255))
    fos(unreal.SphereReflectionCapture, "Env_%s_Reflect" % sid, o + unreal.Vector(0, 0, 350))


def build_aether(o, sid):
    # Platforma w kosmosie + rozsypane „gwiazdy" + złoty TOST-portal.
    _cube("Env_%s_Platform" % sid, o + unreal.Vector(0, 0, 0), unreal.Vector(8.0, 8.0, 0.2))
    for i in range(10):
        ang = (2 * math.pi / 10) * i
        _plight("Env_%s_Star_%d" % (sid, i),
                o + unreal.Vector(900 * math.cos(ang), 900 * math.sin(ang), 300 + (i % 3) * 150),
                (200, 220, 255, 255), 1500.0, 500.0)
    tost = fos(unreal.StaticMeshActor, "Env_%s_Tost" % sid, o + unreal.Vector(600, 0, 200))  # wysokość wzroku
    tost.static_mesh_component.set_static_mesh(unreal.load_asset(SPHERE))
    tost.set_actor_scale3d(unreal.Vector(1.2, 1.2, 1.2))
    _plight("Env_%s_TostGlow" % sid, o + unreal.Vector(600, 0, 200), (255, 200, 40, 255), 4000.0, 700.0)


def build_pusto(o, sid):
    pass  # czysta scena — tylko wtyczki i kamery


ENV = {
    "wyspa":     build_wyspa,
    "antresola": build_antresola,
    "schron":    build_antresola,   # alias wstecz (stare manifesty)
    "atrium":    build_atrium,
    "aether":    build_aether,
    "pusto":     build_pusto,
}


# ── Kontekst wtyczek + loader z forge_plugins/ ───────────────────────────────
class Ctx(object):
    def __init__(self, origin, scene_id):
        self.unreal = unreal
        self.origin = origin
        self.scene_id = scene_id
        self.fos = fos
        self.find = find_actor

    def log(self, msg):
        unreal.log("    [wtyczka] %s" % msg)


def plugins_dir(here):
    return os.path.normpath(os.path.join(here, "..", "forge_plugins"))


def run_plugins(scene, ctx, pdir):
    plugs = scene.get("plugins") or []
    if not plugs:
        return
    if pdir not in sys.path:
        sys.path.insert(0, pdir)
    for entry in plugs:
        pid = (entry or {}).get("id")
        params = (entry or {}).get("params") or {}
        if not pid:
            continue
        try:
            mod = importlib.import_module(pid)
            importlib.reload(mod)  # świeży kod (gdy mod podmieniony z Marketplace)
            if hasattr(mod, "apply"):
                mod.apply(ctx, params)
            else:
                unreal.log_warning("    Wtyczka '%s' bez funkcji apply() — pomijam." % pid)
        except Exception as e:
            unreal.log_warning("    Wtyczka '%s' BŁĄD: %s" % (pid, e))


# ── Warstwa filmowa (Sequencer) — defensywna ─────────────────────────────────
def _binding_id(seq, binding):
    for attempt in (
        lambda: binding.get_binding_id(),
        lambda: unreal.MovieSceneSequenceExtensions.get_binding_id(seq, binding),
        lambda: unreal.MovieSceneSequenceExtensions.make_binding_id(seq, binding),
    ):
        try:
            return attempt()
        except Exception:
            continue
    return None


def build_cinematic(cameras, fps=30):
    # cameras: list of (cam_actor, durationS). Zwraca (ok, total_frames).
    try:
        tools = unreal.AssetToolsHelpers.get_asset_tools()
        path = "/Game/Genesis/Cine_Story"
        seq = unreal.load_asset(path)
        if seq is None:
            seq = tools.create_asset("Cine_Story", "/Game/Genesis",
                                     unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
        seq.set_display_rate(unreal.FrameRate(fps, 1))
        seq.set_playback_start(0)
        total = sum(max(1, int(d * fps)) for _, d in cameras) or fps
        seq.set_playback_end(total)

        try:
            cut_track = seq.add_track(unreal.MovieSceneCameraCutTrack)
        except Exception:
            cut_track = seq.add_master_track(unreal.MovieSceneCameraCutTrack)

        frame = 0
        for cam, dur in cameras:
            df = max(1, int(dur * fps))
            binding = seq.add_possessable(cam)
            section = cut_track.add_section()
            section.set_range(frame, frame + df)
            bid = _binding_id(seq, binding)
            if bid is not None:
                section.set_camera_binding_id(bid)
            frame += df

        unreal.EditorAssetLibrary.save_asset(path)

        sa = find_actor("Seq_Story_Actor")
        if sa is None:
            sa = unreal.EditorActorSubsystem().spawn_actor_from_class(
                unreal.LevelSequenceActor, unreal.Vector(0, 0, 0))
            sa.set_actor_label("Seq_Story_Actor")
        sa.set_sequence(seq)
        try:
            sa.set_editor_property("auto_play", True)
        except Exception:
            sa.playback_settings.auto_play = True
        return True, total
    except Exception as e:
        unreal.log_warning("  Sequencer pominięty (API 5.8 inne?): %s. "
                           "Kamery CineCamera stoją — złóż cięcia ręcznie w Sequencerze." % e)
        return False, 0


# ── Wejście: wczytanie manifestu ─────────────────────────────────────────────
def latest_story(here):
    sdir = os.path.normpath(os.path.join(here, "..", "stories"))
    files = sorted(glob.glob(os.path.join(sdir, "*.json")), key=os.path.getmtime, reverse=True)
    return files[0] if files else None


def compile_story():
    here = os.path.dirname(os.path.abspath(__file__))
    path = STORY_FILE or latest_story(here)
    if not path or not os.path.exists(path):
        unreal.log_warning("REŻYSER: brak manifestu w stories/. Wyeksportuj film z Katedry (Reżyser).")
        return

    with open(path, "r", encoding="utf-8") as f:
        story = json.load(f)

    ver = (story.get("meta") or {}).get("version")
    if ver != SCHEMA_VERSION:
        unreal.log_warning("REŻYSER: wersja manifestu %s != %s — próbuję mimo to." % (ver, SCHEMA_VERSION))

    meta = story.get("meta") or {}
    title = meta.get("title", "(bez tytułu)")
    scenes = story.get("scenes") or []
    unreal.log("=== REŻYSER kompiluje '%s' — %d scen ===" % (title, len(scenes)))
    wp = (meta.get("worldPrompt") or "").strip()
    if wp:
        unreal.log("  Prompt Startowy Świata: %s  (modyfikatory dla ścieżki agenta — geometria bazowa bez zmian)" % wp)

    ensure_baseline_light()
    pdir = plugins_dir(here)
    cameras = []
    built = 0

    for idx, scene in enumerate(scenes):
        sid = scene.get("id", "s%d" % idx).replace("-", "_")
        origin = unreal.Vector(idx * SCENE_SPACING, 0, 0)
        env = scene.get("environment", "wyspa")
        builder = ENV.get(env, build_wyspa)
        try:
            builder(origin, sid)
            unreal.log("  + Scena %d '%s' — srodowisko: %s" % (idx + 1, scene.get("name", sid), env))
            built += 1
        except Exception as e:
            unreal.log_warning("  ⨯ Scena %d środowisko '%s' BŁĄD: %s" % (idx + 1, env, e))

        run_plugins(scene, Ctx(origin, sid), pdir)

        # Kamery ujęć — zawsze realne aktory (offset o origin sceny).
        for j, shot in enumerate(scene.get("shots") or []):
            cam = (shot.get("camera") or {})
            loc = cam.get("loc", [-600, 0, 300])
            look = cam.get("lookAt", [0, 0, 150])
            wl = origin + unreal.Vector(loc[0], loc[1], loc[2])
            wk = origin + unreal.Vector(look[0], look[1], look[2])
            label = "Cine_%s_%d" % (sid, j)
            cine = fos(unreal.CineCameraActor, label, wl)
            rot = unreal.MathLibrary.find_look_at_rotation(wl, wk)
            cine.set_actor_rotation(rot, False)
            if cam.get("fov"):
                try:
                    cine.camera_component.set_editor_property("current_focal_length",
                                                              max(4.0, 36.0 / math.tan(math.radians(cam["fov"]) / 2) / 2))
                except Exception:
                    pass

            # Podpis ujęcia — karta TextRender PRZED kamerą (czytelna w danym ujęciu).
            caption = (shot.get("caption") or "").strip()
            if caption:
                fwd = unreal.MathLibrary.get_forward_vector(rot)
                cap_loc = wl + fwd * 320 + unreal.Vector(0, 0, -30)
                cap = fos(unreal.TextRenderActor, "Cap_%s_%d" % (sid, j), cap_loc)
                tc = cap.text_render
                tc.set_text(unreal.Text(caption))
                tc.set_text_render_color(unreal.Color(255, 255, 255, 255))
                tc.set_world_size(20.0)
                cap_rot = unreal.Rotator()      # twarzą do kamery (yaw + 180)
                cap_rot.yaw = rot.yaw + 180.0
                cap.set_actor_rotation(cap_rot, False)
                try:
                    tc.set_horizontal_alignment(unreal.HorizTextAligment.EHTA_CENTER)
                except Exception:
                    pass

            cameras.append((cine, float(shot.get("durationS", 4) or 4)))

    ok, total = build_cinematic(cameras)
    tame_local_lights()  # VSM OK + anty-przepalenie
    unreal.EditorLevelLibrary.save_current_level()

    unreal.log("=== GOTOWE: %d/%d scen, %d ujęć/kamer. Film: %s ===" %
               (built, len(scenes), len(cameras), "Cine_Story (auto_play)" if ok else "kamery bez sekwencji"))
    if ok:
        unreal.log("Naciśnij Play — film leci z cięciami kamer, potem sterowanie wraca do gracza.")
        unreal.log("ODDANIE STEROWANIA (raz, ręcznie): Level Blueprint → po Seq_Story_Actor 'On Finished' → "
                   "'Set View Target with Blend' na pawn gracza.")


compile_story()
