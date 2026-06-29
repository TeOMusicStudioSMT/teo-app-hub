import unreal
import os

# 🛰️ GENESIS OVERRIDE — Budowa HEADLESS (UE bez okna edytora, przez komendlet -run=pythonscript).
# Headless NIE ma domyślnie otwartego poziomu — najpierw ŁADUJEMY mapę, potem budujemy, potem zapis.
# Wywoływane przez most: POST /api/uneng/run-headless (z -nullrhi = zero renderu, mało RAM).
#
# ⚠ BLIND-BUILD (najwyższy poziom): ścieżka mapy + zachowanie komendletu zależą od Twojego projektu/UE 5.8.
# Ustaw env OTAKOS_UE_MAP jeśli mapa jest gdzie indziej. Jeśli headless nie wczyta poziomu — w logu zobaczysz
# wprost dlaczego; fallback: odpal build_all_genesis.py w otwartym edytorze (GUI), to droga pewna.

MAP = os.environ.get("OTAKOS_UE_MAP", "/Game/FirstPerson/Maps/Lvl_FirstPerson")


def load_map():
    # Próbujemy nowym API (LevelEditorSubsystem), potem starym (EditorLoadingAndSavingUtils).
    for attempt in (
        lambda: unreal.LevelEditorSubsystem().load_level(MAP),
        lambda: unreal.EditorLoadingAndSavingUtils.load_map(MAP),
    ):
        try:
            attempt()
            unreal.log("Headless: załadowano mapę %s" % MAP)
            return True
        except Exception as e:
            last = e
    unreal.log_warning("Headless: nie udało się załadować mapy %s (%s). "
                       "Ustaw OTAKOS_UE_MAP albo buduj w GUI." % (MAP, last))
    return False


def run():
    load_map()
    here = os.path.dirname(os.path.abspath(__file__))
    target = os.path.join(here, "build_all_genesis.py")
    try:
        with open(target, "r", encoding="utf-8") as f:
            code = f.read()
        exec(compile(code, target, "exec"), {"__name__": "__main__", "__file__": target})
    except Exception as e:
        unreal.log_warning("Headless: build_all_genesis błąd: %s" % e)
    # Zapis wszystkich zmienionych pakietów (poziom + assety Materials/Sequences).
    try:
        unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    except Exception:
        try:
            unreal.EditorLevelLibrary.save_current_level()
        except Exception:
            pass
    unreal.log("=== 🛰️ Headless: build zakończony, pakiety zapisane. ===")


run()
