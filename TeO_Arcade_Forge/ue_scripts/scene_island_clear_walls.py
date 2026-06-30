import unreal

# 🧹 O TAK… WYSPA — Usuń ściany/resztki schronu (geometria template'u FirstPerson/LevelPrototyping).
# Otwiera Wyspę: kasuje żółte klocki/ściany/rampy template'u, zostawia NASZE assety (BasicShapes/Megascans).
# Po tym można swobodnie chodzić i rozstawiać. Zapewnia wielką podłogę, gdyby zabrakło.
#
# Bezpieczne: kasuje TYLKO StaticMeshActory, których siatka pochodzi z template'u (LevelPrototyping/FirstPerson).
# Nasze (Env_/Nature_/Ship_/Island_/Gate_…) używają BasicShapes/Megascans → nie ruszane.

TEMPLATE_HINTS = ("LevelPrototyping", "/Game/FirstPerson/")


def clear():
    sub = unreal.EditorActorSubsystem()
    removed = 0
    for a in list(unreal.EditorLevelLibrary.get_all_level_actors()):
        if not isinstance(a, unreal.StaticMeshActor):
            continue
        try:
            m = a.static_mesh_component.static_mesh
            p = m.get_path_name() if m else ""
        except Exception:
            continue
        if any(h in p for h in TEMPLATE_HINTS):
            try:
                sub.destroy_actor(a)
                removed += 1
            except Exception:
                try:
                    unreal.EditorLevelLibrary.destroy_actor(a)
                    removed += 1
                except Exception:
                    pass

    # Zapewnij wielką, płaską podłogę (gdyby ocean/wyspa nie pokrywały) — by gracz nie spadł.
    labels = [x.get_actor_label() for x in unreal.EditorLevelLibrary.get_all_level_actors()]
    has_ground = any(k in lbl for lbl in labels for k in ("Ocean", "Island", "Floor"))
    if not has_ground:
        f = sub.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, -20))
        f.set_actor_label("Island_Floor")
        f.static_mesh_component.set_static_mesh(unreal.load_asset("/Engine/BasicShapes/Cube.Cube"))
        f.set_actor_scale3d(unreal.Vector(80, 80, 0.2))

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== 🧹 Usunięto %d elementów schronu/template'u. Wyspa otwarta — chodź swobodnie. ===" % removed)


clear()
