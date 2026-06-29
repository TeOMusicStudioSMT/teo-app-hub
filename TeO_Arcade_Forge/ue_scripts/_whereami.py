import unreal

# 🧭 Pokaż ścieżkę AKTUALNEJ mapy (tej, którą masz otwartą) — do ustawienia OTAKOS_UE_MAP.
# Uruchom: Narzędzia → Wykonaj skrypt Pythona → wskaż ten plik.
# Szukaj w logu (Output Log) linii: === MAPA: ... ===  i wklej ją Klaudiuszowi.

def show():
    path = "(nie udało się odczytać)"
    try:
        world = unreal.EditorLevelLibrary.get_editor_world()
        # Pakiet zewnętrzny = ścieżka mapy potrzebna do load_map (np. /Game/FirstPerson/Maps/Lvl_FirstPerson)
        path = world.get_outermost().get_name()
    except Exception as e:
        try:
            sub = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
            world = sub.get_editor_world()
            path = world.get_outermost().get_name()
        except Exception as e2:
            path = "(błąd: %s / %s)" % (e, e2)

    # Wypisujemy jako WARNING (żółte, łatwe do znalezienia w logu).
    unreal.log_warning("================================================")
    unreal.log_warning("=== MAPA: %s ===" % path)
    unreal.log_warning("=== ^ wklej tę ścieżkę Klaudiuszowi (część przed kropką). ===")
    unreal.log_warning("================================================")


show()
