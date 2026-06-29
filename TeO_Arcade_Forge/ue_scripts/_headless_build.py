import unreal
import os

# 🛰️ GENESIS OVERRIDE — Budowa HEADLESS (UE bez okna, komendlet -run=pythonscript).
# Headless NIE ma otwartego poziomu → najpierw ŁADUJEMY mapę (z nazwą pliku!), potem budujemy, potem zapis.
# Jeśli mapa się nie wczyta, świat ląduje w bezimiennym transient → save_current_level wywala się
# „doesn't have a filename" (to był błąd 12×). Dlatego tu LOGUJEMY realnie, co jest wczytane.
#
# Ustaw env OTAKOS_UE_MAP na ścieżkę-referencję TWOJEJ mapy (UE: prawy klik na poziomie w Content
# Browser → Copy Reference → wklej, np. /Game/FirstPerson/Maps/Lvl_FirstPerson).

MAP = os.environ.get("OTAKOS_UE_MAP", "/Game/FirstPerson/Maps/Lvl_FirstPerson")


def world_path():
    try:
        w = unreal.EditorLevelLibrary.get_editor_world()
        return w.get_path_name() if w else "(brak świata)"
    except Exception as e:
        return "(nieznany: %s)" % e


def load_map():
    unreal.log("Headless: świat PRZED = %s" % world_path())
    ok = False
    try:
        # EditorLoadingAndSavingUtils.load_map — standard headless. Zwraca World albo None.
        w = unreal.EditorLoadingAndSavingUtils.load_map(MAP)
        ok = w is not None
    except Exception as e:
        unreal.log_warning("Headless: load_map('%s') wyjątek: %s" % (MAP, e))
    after = world_path()
    unreal.log("Headless: świat PO = %s  (cel: %s, ok=%s)" % (after, MAP, ok))
    if not ok and MAP.split("/")[-1] not in after:
        unreal.log_warning("Headless: ⚠ MAPA NIE WCZYTANA. Ustaw OTAKOS_UE_MAP na referencję swojej "
                           "mapy (Content Browser → prawy klik → Copy Reference). Bez tego świat nie zapisze się do Twojej mapy.")
    return ok


def hush_per_scene_saves():
    # World Partition: per-scena save_current_level() wywala "no filename" (WP zapisuje aktorów jako
    # ZEWNĘTRZNE pakiety, nie przez current level). Wyciszamy te wywołania — zapis raz na końcu (save_dirty_packages).
    try:
        unreal.EditorLevelLibrary.save_current_level = staticmethod(lambda *a, **k: None)
        unreal.log("Headless: wyciszono per-scena save_current_level (World Partition — zapis zbiorczy na końcu).")
    except Exception as e:
        unreal.log_warning("Headless: nie udało się wyciszyć save_current_level (%s) — błędy WP są nieszkodliwe." % e)


def run():
    load_map()
    hush_per_scene_saves()
    here = os.path.dirname(os.path.abspath(__file__))
    target = os.path.join(here, "build_all_genesis.py")
    try:
        with open(target, "r", encoding="utf-8") as f:
            code = f.read()
        exec(compile(code, target, "exec"), {"__name__": "__main__", "__file__": target})
    except Exception as e:
        unreal.log_warning("Headless: build_all_genesis błąd: %s" % e)
    # Zapis headless-owy: po pakietach (działa dla World Partition; nie wymaga „current level filename").
    try:
        unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
        unreal.log("Headless: save_dirty_packages OK.")
    except Exception as e:
        unreal.log_warning("Headless: save_dirty_packages błąd: %s" % e)
    unreal.log("=== 🛰️ Headless: koniec. Sprawdź wyżej, czy MAPA się wczytała (świat PO). ===")


run()
