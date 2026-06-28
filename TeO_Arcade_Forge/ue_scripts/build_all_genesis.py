import unreal
import os

# 🏛️ GENESIS OVERRIDE — Budowniczy Całości (jeden klik = cała Katedra)
# Odpala wszystkie warstwy 01→06 po kolei. Sceny są idempotentne (find-or-spawn),
# więc uruchamianie wielokrotne jest bezpieczne — nic się nie zdubluje.
#
# Uruchom w UE: Narzędzia → Wykonaj skrypt Pythona → build_all_genesis.py
# Każdą scenę odpalamy w izolacji (try/except) — usterka jednej nie zatrzymuje reszty.
#
# UWAGA: ręczne wiązania Blueprinta (04b: overlap→Play wrót, 06b: overlap→teleport)
# robisz raz, osobno — patrz BUILD_LOG.md. Python ich nie autoryzuje.

ORDER = [
    ("01  Oświetlenie",        "scene_fix_lighting.py"),
    ("02  Filmowe wejście",    "scene_02_intro.py"),
    ("02b Wejście filmowe",    "scene_02b_intro_film.py"),
    ("03  Atrium",             "scene_03_atrium.py"),
    ("03c Szklane panele",     "scene_03c_glass.py"),
    ("03b Geometria Schronu",  "scene_03b_geometry.py"),
    ("04  Interakcja",         "scene_04_interaction.py"),
    ("05  AETHER",             "scene_05_aether.py"),
    ("06  Strażnicy iFixAi",   "scene_06_guardians.py"),
    ("99  Strojenie świateł",  "fix_lights_vsm.py"),   # ostatni: VSM OK + anty-przepalenie
]


def run_all():
    here = os.path.dirname(os.path.abspath(__file__))
    ok, fail = [], []
    unreal.log("=== GENESIS OVERRIDE — buduję całą Katedrę (%d warstw) ===" % len(ORDER))

    for title, fname in ORDER:
        path = os.path.join(here, fname)
        if not os.path.exists(path):
            unreal.log_warning("  ⨯ %s — brak pliku %s (pomijam)" % (title, fname))
            fail.append(title)
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                code = f.read()
            # Każda scena dostaje świeży kontekst z poprawnym __file__ (sceny liczą ścieżki od siebie).
            exec(compile(code, path, "exec"), {"__name__": "__main__", "__file__": path})
            unreal.log("  ✓ %s" % title)
            ok.append(title)
        except Exception as e:
            unreal.log_warning("  ⨯ %s — BŁĄD: %s" % (title, e))
            fail.append(title)

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== GOTOWE. Zbudowane: %d/%d ===" % (len(ok), len(ORDER)))
    if fail:
        unreal.log_warning("Nie weszło: %s — popraw scenę i odpal ponownie (idempotentnie)." % ", ".join(fail))
    else:
        unreal.log("Cała Katedra stoi. Wiązania BP 04b/06b zrób raz ręcznie (BUILD_LOG.md).")


run_all()
