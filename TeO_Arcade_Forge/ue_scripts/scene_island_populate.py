import unreal
import json
import urllib.request

# 🗂️ GENESIS OVERRIDE — Zaludnienie Wyspy z bazy zdjęć użytkownika.
# Pobiera z mostu (/api/island/db) bazę: OSOBNO ludzie, OSOBNO przedmioty (skan katalogów).
# Rozrzuca po wyspie w DWÓCH strefach: ludzie (karty-stojaki, cyjan) na -Y, przedmioty (amber) na +Y.
# Idempotentne. DEFENSYWNIE: brak danych → dziewicza wyspa (nic nie stawia).
#
# To ETAP 1 iniekcji danych: karty-placeholdery z PODPISAMI (nazwy plików). Fototekstury na kartach
# (import tekstur) i klasyfikacja modelem wizyjnym = etap 2. Patrz wyspa-roadmap.
#
# Najpierw w Katedrze/most: POST /api/island/scan {dir} (wskaż katalog zdjęć). Most musi działać.

BRIDGE = "http://127.0.0.1:3001/api/island/db"
CUBE = "/Engine/BasicShapes/Cube.Cube"
MAX_PER_KIND = 40          # ile maks. postawić na strefę (anty-zaśmiecenie)
COLS = 8                   # kolumny siatki
SPACING = 170.0


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


def fetch_db():
    try:
        resp = urllib.request.urlopen(BRIDGE, timeout=5)
        return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        unreal.log_warning("Wyspa: most offline (%s) — uruchom wiesio-bridge.js i zeskanuj katalog." % e)
        return None


def grid_loc(i, base_x, base_y, sign_y):
    row = i // COLS
    col = i % COLS
    x = base_x + (col - COLS / 2.0) * SPACING
    y = base_y + sign_y * row * SPACING
    return x, y


def card(label, x, y, color255, name):
    # Karta-stojak: cienki, stojący slab + podpis nad nim.
    slab = fos(unreal.StaticMeshActor, label, unreal.Vector(x, y, 70))
    slab.static_mesh_component.set_static_mesh(unreal.load_asset(CUBE))
    slab.set_actor_scale3d(unreal.Vector(0.05, 1.0, 1.4))
    txt = fos(unreal.TextRenderActor, label + "_Lbl", unreal.Vector(x, y, 150))
    tc = txt.text_render
    tc.set_text(unreal.Text(name[:24]))
    tc.set_text_render_color(unreal.Color(*color255))
    tc.set_world_size(12.0)
    try:
        tc.set_horizontal_alignment(unreal.HorizTextAligment.EHTA_CENTER)
    except Exception:
        pass


def populate():
    db = fetch_db()
    if db is None:
        return
    people = db.get("people") or []
    assets = db.get("assets") or []
    if not people and not assets:
        unreal.log("Wyspa: baza pusta — dziewicza wyspa. Zeskanuj katalog (POST /api/island/scan).")
        return

    # Ludzie — strefa na -Y (karty cyjanowe).
    for i, p in enumerate(people[:MAX_PER_KIND]):
        x, y = grid_loc(i, 0.0, -260.0, -1.0)
        card("Island_Person_%d" % i, x, y, (0, 230, 255, 255), p.get("name", "osoba"))

    # Przedmioty/surowce — strefa na +Y (karty amber).
    for i, a in enumerate(assets[:MAX_PER_KIND]):
        x, y = grid_loc(i, 0.0, 260.0, 1.0)
        card("Island_Asset_%d" % i, x, y, (255, 190, 60, 255), a.get("name", "przedmiot"))

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== 🗂️ Wyspa zaludniona: %d ludzi (cyjan, -Y) + %d przedmiotów (amber, +Y). ===" %
               (min(len(people), MAX_PER_KIND), min(len(assets), MAX_PER_KIND)))
    if len(people) > MAX_PER_KIND or len(assets) > MAX_PER_KIND:
        unreal.log("(pokazano po max %d na strefę — reszta w bazie)" % MAX_PER_KIND)


populate()
