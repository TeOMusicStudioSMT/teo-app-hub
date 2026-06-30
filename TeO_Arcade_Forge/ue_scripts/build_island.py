import unreal
import os

# 🏝️ O TAK… WYSPA — Budowniczy TWOJEJ Wyspy (jeden klik spina wszystko).
# Łączy w jeden świat: film Reżysera (ocean+wyspa+antresola z najnowszego manifestu) + szklane tafle
# + portale GRV (okna na wyspy sieci) + Twoje zdjęcia (osobno ludzie/przedmioty) + stocznię + strojenie świateł.
# Wszystko wokół środka (origin) = spójna Wyspa. Idempotentne (find-or-spawn w każdym skrypcie).
#
# WYMAGA wcześniej:
#   1) Reżyser → środowisko „🏝️ Wyspa" → Eksportuj film (zapisuje manifest do stories/).
#   2) „Zasil Wyspę danymi" → skan katalogu zdjęć (island_db.json).
#   3) Most działa (:3001) — portale/zaludnienie/stocznia pobierają dane.
# Uruchom: Narzędzia → Wykonaj skrypt Pythona → build_island.py (albo headless przez Kuźnię).

ORDER = [
    ("🎬 Film Wyspy (Reżyser)",        "story_compiler.py"),
    ("🌳 Zalesianie (natura)",         "scene_island_nature.py"),
    ("🪟 Szklane tafle",               "scene_03c_glass.py"),
    ("🏝️ Portale GRV (okna na wyspy)", "scene_portals_grv.py"),
    ("🗂️ Zaludnienie (Twoje zdjęcia)", "scene_island_populate.py"),
    ("⛵ Stocznia + surowce",          "scene_shipyard.py"),
    ("🌅 Atmosfera świtu",             "scene_island_atmosphere.py"),
    ("🚶 Punkt startu gracza",         "scene_island_spawn.py"),
    ("💡 Strojenie świateł",           "fix_lights_vsm.py"),
]


def run_all():
    here = os.path.dirname(os.path.abspath(__file__))
    ok, fail = [], []
    unreal.log("=== 🏝️ O TAK… WYSPA — buduję TWOJĄ Wyspę (%d warstw) ===" % len(ORDER))
    for title, fname in ORDER:
        path = os.path.join(here, fname)
        if not os.path.exists(path):
            unreal.log_warning("  ⨯ %s — brak %s (pomijam)" % (title, fname))
            fail.append(title)
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                code = f.read()
            exec(compile(code, path, "exec"), {"__name__": "__main__", "__file__": path})
            unreal.log("  ✓ %s" % title)
            ok.append(title)
        except Exception as e:
            unreal.log_warning("  ⨯ %s — BŁĄD: %s" % (title, e))
            fail.append(title)
    unreal.log("=== GOTOWE: %d/%d warstw Wyspy ===" % (len(ok), len(ORDER)))
    if fail:
        unreal.log_warning("Nie weszło: %s" % ", ".join(fail))
    else:
        unreal.log("Twoja Wyspa stoi. Naciśnij Play, by po niej pochodzić.")


run_all()
