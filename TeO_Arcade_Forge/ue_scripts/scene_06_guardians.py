import unreal

# 🛡️ GENESIS OVERRIDE — Krok 06: Strażnicy (drony iFixAi, teleportacja zamiast kary)
# Filozofia 0.00G: iFixAi nie KARZE — leczy i ODSYŁA. Brak damage; przekroczenie granicy =
# łagodna teleportacja z powrotem do konsoli (Guardian_Respawn). Strażnik = światło, nie miecz.
#
# CO ROBI PYTHON (pewnie, działa po uruchomieniu w UE):
#   1) Guardian_Drone_A/B/C — lewitujące kule iFixAi (sphere + zielono-cyjanowy glow), patrol bram.
#   2) Guardian_Respawn      — bezpieczny punkt powrotu (TargetPoint) przy biurku/konsoli.
#   3) Guardian_TeleZone     — TriggerBox: granica, za którą zamiast kary następuje odesłanie.
#
# CZEGO PYTHON NIE ZROBI (uczciwie — krok 06b, jedno wiązanie w Level Blueprint):
#   OnActorBeginOverlap(Guardian_TeleZone) → SetActorLocation(Player → Guardian_Respawn).
#   Stock UE nie autoryzuje grafu BP z Pythona. Instrukcja na końcu skryptu.
#
# Idempotentne (find-or-spawn). Etykiety wg konwencji: Guardian_*.

SPHERE = "/Engine/BasicShapes/Sphere.Sphere"
HEAL = (0, 255, 180, 255)   # iFixAi: uzdrawiający cyjan-zieleń (Color 0-255!)


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


def drone(label, loc, color255=HEAL):
    # Kula iFixAi (mesh) + lampa lewitującego światła tuż obok — strażnik z poświatą.
    core = fos(unreal.StaticMeshActor, label, loc)
    core.static_mesh_component.set_static_mesh(unreal.load_asset(SPHERE))
    core.set_actor_scale3d(unreal.Vector(0.6, 0.6, 0.6))
    glow = fos(unreal.PointLight, label + "_Glow", loc)
    gc = glow.get_component_by_class(unreal.PointLightComponent)
    gc.set_editor_property('light_color', unreal.Color(*color255))  # Color 0-255 (NIE set_light_color — chce LinearColor)
    gc.set_intensity(4500.0)
    gc.set_attenuation_radius(700.0)
    return core


def guardians():
    # Trójka strażników patroluje bramy EventHorizon (z 03b: wrota w 700, ±120).
    drone("Guardian_Drone_A", unreal.Vector(700, -260, 360))
    drone("Guardian_Drone_B", unreal.Vector(700,  260, 360))
    drone("Guardian_Drone_C", unreal.Vector(420,    0, 420))

    # Bezpieczny powrót — przy konsoli (03b: biurko/terminal w okolicy 0,0).
    fos(unreal.TargetPoint, "Guardian_Respawn", unreal.Vector(0, 0, 100))

    # Granica „za daleko" — zamiast kary odsyła do Guardian_Respawn (most do AETHER zaczyna się dalej).
    zone = fos(unreal.TriggerBox, "Guardian_TeleZone", unreal.Vector(1500, 0, 150))
    zone.set_actor_scale3d(unreal.Vector(2.0, 8.0, 3.0))

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== GENESIS Krok 06 gotowy: 3 drony iFixAi + Respawn + strefa teleportacji. ===")
    unreal.log("WIĄZANIE 06b (raz, ręcznie): Level Blueprint → zaznacz Guardian_TeleZone → "
               "'Add Event > OnActorBeginOverlap' → z Other Actor wyciągnij 'SetActorLocation' "
               "= lokacja Guardian_Respawn. Bez damage — czysta teleportacja (iFixAi leczy, nie karze).")


guardians()
