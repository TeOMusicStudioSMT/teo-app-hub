import unreal
import math
import json
import urllib.request

# 🏝️ GENESIS OVERRIDE — Portale GRV: szklane tafle Atrium jako OKNA NA WYSPY innych suwerenów.
# Pobiera z mostu (/api/islands/random) 4 portale: slot 1 = OtakOS (kanon, stały),
# 2-4 = losowe wyspy z sieci węzłów GRV. Podpisuje 4 tafle `Atrium_Pane_*` (z scene_03c_glass).
# Idempotentne. DEFENSYWNIE: gdy most offline — panele dostają etykietę „portal offline".
#
# To PIERWSZY etap portali: na razie czytelne PODPISY na szkle. Dynamiczne miniatury (RenderTarget)
# i teleport pierścieniem = następny etap (wymaga materiałów/triggerów). Patrz wyspa-roadmap.
#
# ⚠ Wymaga wcześniej scene_03c_glass.py (tafle). Most musi działać (:3001).

BRIDGE = "http://127.0.0.1:3001/api/islands/random"

# slot -> (pozycja tafli z 03c, kolor podpisu wg roli)
PANES = {
    1: unreal.Vector(440, 0, 420),
    2: unreal.Vector(-440, 0, 420),
    3: unreal.Vector(0, 440, 420),
    4: unreal.Vector(0, -440, 420),
}


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


def fetch_portals():
    try:
        resp = urllib.request.urlopen(BRIDGE, timeout=4)
        data = json.loads(resp.read().decode("utf-8"))
        if data.get("success"):
            return data.get("panels", [])
    except Exception as e:
        unreal.log_warning("Portale GRV: most offline (%s). Uruchom wiesio-bridge.js." % e)
    return None


def color_for(panel):
    if panel.get("canonical"):
        return unreal.Color(255, 200, 60, 255)        # OtakOS = złoto
    if panel.get("format") == "vacant" or not panel.get("id"):
        return unreal.Color(110, 110, 120, 255)        # pusta = szarość
    return unreal.Color(0, 230, 255, 255)              # wyspa = cyjan


def place_label(slot, pos, text, color):
    # Podpis tuż przed taflą, zwrócony do środka Atrium (czytelny od Antresoli).
    inner = unreal.Vector(pos.x * 0.86, pos.y * 0.86, pos.z)
    a = fos(unreal.TextRenderActor, "Portal_GRV_%d" % slot, inner)
    tc = a.text_render
    tc.set_text(unreal.Text(text))
    tc.set_text_render_color(color)
    tc.set_world_size(26.0)
    rot = unreal.Rotator()
    rot.yaw = math.degrees(math.atan2(-pos.y, -pos.x))  # twarzą do środka
    a.set_actor_rotation(rot, False)
    try:
        tc.set_horizontal_alignment(unreal.HorizTextAligment.EHTA_CENTER)
    except Exception:
        pass


def portals():
    panels = fetch_portals()
    if panels is None:
        for slot, pos in PANES.items():
            place_label(slot, pos, "PORTAL %d\n[most offline]" % slot, unreal.Color(160, 80, 80, 255))
        unreal.EditorLevelLibrary.save_current_level()
        unreal.log("Portale GRV: most offline — tafle oznaczone, uruchom most i puść ponownie.")
        return

    by_slot = {p.get("slot"): p for p in panels}
    for slot, pos in PANES.items():
        p = by_slot.get(slot, {"label": "Niezamieszkana wyspa", "format": "vacant"})
        fmt = p.get("format", "?")
        text = "%s\n[%s]" % (p.get("label", "wyspa"), fmt)
        place_label(slot, pos, text, color_for(p))

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== 🏝️ Portale GRV: 4 tafle Atrium podpisane jako okna na wyspy. ===")
    unreal.log("Slot 1 = OtakOS (kanon), 2-4 = losowe wyspy z sieci GRV. Miniatury+teleport = nast. etap.")


portals()
