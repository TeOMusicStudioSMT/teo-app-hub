import unreal
import json
import urllib.request

# ⛵ GENESIS OVERRIDE — Stocznia + węzły surowców (pętla rzemiosła → podróż na inne wyspy).
# Pobiera recepty z mostu (/api/craft/recipes) i stawia na wyspie:
#   • węzły surowców (drzewa→drewno, skały→kamień, trawa→lina, len→żagiel, drzewo żywiczne→żywica),
#   • planszę Stoczni z recepturą statku,
#   • placeholder tratwy przy brzegu (cel widoczny).
# Idempotentne. DEFENSYWNIE: most offline → plansza „offline", surowce wg domyślnej listy.
#
# To ETAP 1: węzły + plansza (placeholdery z podpisami). GAMEPLAY (zbieranie/inwentarz/budowa) =
# blueprinty w edytorze (patrz kroki w odpowiedzi Klaudiusza / wyspa-roadmap). Najpierw most + wyspa.

BRIDGE = "http://127.0.0.1:3001/api/craft/recipes"
CUBE = "/Engine/BasicShapes/Cube.Cube"

# surowiec -> (kolor podpisu, skala węzła, wysokość)
NODE_STYLE = {
    "drewno":  ((90, 200, 90, 255),  unreal.Vector(0.4, 0.4, 2.2), 110),   # drzewo
    "kamien":  ((150, 150, 160, 255), unreal.Vector(1.2, 1.2, 0.8), 40),    # skała
    "lina":    ((120, 220, 180, 255), unreal.Vector(0.3, 0.3, 0.6), 30),    # trawa morska
    "zagiel":  ((230, 230, 250, 255), unreal.Vector(0.2, 1.4, 1.6), 80),    # len/tkanina
    "zywica":  ((255, 210, 60, 255),  unreal.Vector(0.5, 0.5, 2.0), 100),   # drzewo żywiczne
}
DEFAULT_RES = [
    {"id": "drewno", "name": "Drewno", "from": "Drzewo"},
    {"id": "kamien", "name": "Kamień", "from": "Skała"},
    {"id": "lina", "name": "Lina", "from": "Włókno"},
    {"id": "zagiel", "name": "Żagiel", "from": "Len"},
    {"id": "zywica", "name": "Żywica", "from": "Drzewo żywiczne"},
]


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


def node(label, loc, scale, color255, text):
    m = fos(unreal.StaticMeshActor, label, loc)
    m.static_mesh_component.set_static_mesh(unreal.load_asset(CUBE))
    m.set_actor_scale3d(scale)
    t = fos(unreal.TextRenderActor, label + "_Lbl", unreal.Vector(loc.x, loc.y, loc.z + 90))
    tc = t.text_render
    tc.set_text(unreal.Text(text))
    tc.set_text_render_color(unreal.Color(*color255))
    tc.set_world_size(13.0)
    try:
        tc.set_horizontal_alignment(unreal.HorizTextAligment.EHTA_CENTER)
    except Exception:
        pass


def fetch_recipes():
    try:
        resp = urllib.request.urlopen(BRIDGE, timeout=5)
        d = json.loads(resp.read().decode("utf-8"))
        if d.get("success"):
            return d
    except Exception as e:
        unreal.log_warning("Stocznia: most offline (%s) — surowce domyślne." % e)
    return None


def shipyard():
    data = fetch_recipes()
    resources = (data or {}).get("resources") or DEFAULT_RES
    ships = (data or {}).get("ships") or []

    # Węzły surowców — po 3 z każdego rodzaju, rozrzucone po obrzeżu wyspy.
    import math
    for ri, r in enumerate(resources):
        rid = r.get("id", "?")
        style = NODE_STYLE.get(rid, ((200, 200, 200, 255), unreal.Vector(0.5, 0.5, 1.0), 60))
        color, scale, h = style
        for k in range(3):
            ang = (2 * math.pi / (len(resources) * 3)) * (ri * 3 + k)
            R = 620 + (k * 70)
            loc = unreal.Vector(R * math.cos(ang), R * math.sin(ang), h)
            node("Ship_%s_%d" % (rid, k), loc, scale, color,
                 "%s\n[%s → %s]" % (r.get("from", rid), r.get("from", "?"), r.get("name", rid)))

    # Plansza Stoczni przy brzegu (-X) z recepturą najlepszego statku.
    board = fos(unreal.StaticMeshActor, "Shipyard_Board", unreal.Vector(-820, 0, 120))
    board.static_mesh_component.set_static_mesh(unreal.load_asset(CUBE))
    board.set_actor_scale3d(unreal.Vector(0.15, 3.0, 2.0))
    top = ships[-1] if ships else None
    if top:
        needs = "  ".join("%s×%d" % (k, v) for k, v in (top.get("needs") or {}).items())
        txt = "STOCZNIA — %s\n%s\nenergia: %s" % (top.get("name", "Statek"), needs, top.get("energy", "?"))
    else:
        txt = "STOCZNIA\n[most offline — uruchom most]"
    tb = fos(unreal.TextRenderActor, "Shipyard_Board_Lbl", unreal.Vector(-790, 0, 180))
    tb.text_render.set_text(unreal.Text(txt))
    tb.text_render.set_text_render_color(unreal.Color(255, 190, 60, 255))
    tb.text_render.set_world_size(16.0)
    tb.set_actor_rotation(unreal.Rotator(0.0, 0.0, 0.0), False)

    # Placeholder tratwy przy brzegu (cel) — płaski slab na wodzie.
    raft = fos(unreal.StaticMeshActor, "Ship_Raft", unreal.Vector(-980, 0, -10))
    raft.static_mesh_component.set_static_mesh(unreal.load_asset(CUBE))
    raft.set_actor_scale3d(unreal.Vector(2.2, 1.4, 0.1))

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== ⛵ Stocznia: węzły surowców + plansza + tratwa-cel postawione. ===")
    unreal.log("Gameplay zbierania/budowy = blueprinty (kroki w runbooku). Strażnik: bez planu nie budujesz.")


shipyard()
