import unreal
import os
import math
import random

# 🌳 O TAK… WYSPA — Zalesianie (natura wyspy). Placeholder TERAZ, Twoje assety PO migracji.
# Domyślnie sadzi proste „drzewa" (pień+korona z BasicShapes) w pierścieniu wokół środka (z dala od
# antresoli/zdjęć). Gdy ustawisz env OTAKOS_NATURE_MESHES (ścieżki siatek po przecinku, np. drzewa
# z Electric Dreams po migracji do projektu) — sadzi JE (z ich materiałami).
#
# Idempotentne (stały seed → te same pozycje; find-or-spawn). Etos: skill = powtarzalny czyn (zalesianie).
#
# Jak użyć Electric Dreams: w UE pobierz pack → Content Browser → Migrate siatki do GENESIS_OVERRIDE →
# ustaw OTAKOS_NATURE_MESHES="/Game/.../SM_Tree_01,/Game/.../SM_Rock_02" → uruchom ten skrypt.

CONE = "/Engine/BasicShapes/Cone.Cone"
CYL = "/Engine/BasicShapes/Cylinder.Cylinder"
COUNT = int(os.environ.get("OTAKOS_NATURE_COUNT", "28"))
R_IN, R_OUT = 700.0, 1150.0   # pierścień zalesiania (środek wolny na rozgrywkę)


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


def mesh_actor(label, loc, mesh, scale, yaw):
    a = fos(unreal.StaticMeshActor, label, loc)
    a.static_mesh_component.set_static_mesh(mesh)
    a.set_actor_scale3d(scale)
    rot = unreal.Rotator()
    rot.yaw = yaw
    a.set_actor_rotation(rot, False)
    return a


# Domyślne drzewa/skały Electric Dreams (Megascans). Działają PO Migrate do GENESIS_OVERRIDE.
# Gdy nie zmigrowane — load_asset zwróci None, lista pusta → placeholder. env OTAKOS_NATURE_MESHES nadpisuje.
ED_DEFAULTS = [
    "/Game/Megascans/3D_Assets/DeadTree/SM_DeadTree_01",
    "/Game/Megascans/3D_Assets/DeadTree/SM_DeadTree_02",
    "/Game/Megascans/3D_Assets/FallenSpruceTree/SM_FallenSpruceTree_01",
    "/Game/Megascans/3D_Assets/BirchTreeStump/SM_BirchTreeStump_01",
    "/Game/Megascans/3D_Assets/ForestRockFormation/SM_ForestRockFormation_01",
    "/Game/Megascans/3D_Assets/ForestRockFormation/SM_ForestRockFormation_02",
]


def custom_meshes():
    raw = os.environ.get("OTAKOS_NATURE_MESHES", "").strip()
    paths = [p.strip() for p in raw.split(",") if p.strip()] if raw else ED_DEFAULTS
    out = []
    for p in paths:
        m = unreal.load_asset(p)
        if m:
            out.append(m)
        elif raw:
            unreal.log_warning("  natura: nie znaleziono siatki %s (pomijam)." % p)
    return out


def plant():
    random.seed(42)  # stałe pozycje (idempotencja)
    meshes = custom_meshes()
    cone = unreal.load_asset(CONE)
    cyl = unreal.load_asset(CYL)
    for i in range(COUNT):
        ang = random.uniform(0, 2 * math.pi)
        r = random.uniform(R_IN, R_OUT)
        x, y = r * math.cos(ang), r * math.sin(ang)
        yaw = random.uniform(0, 360)
        if meshes:
            # Twoje assety (np. Electric Dreams) — jeden aktor na drzewo, losowa skala.
            m = meshes[i % len(meshes)]
            s = random.uniform(0.8, 1.6)
            mesh_actor("Nature_Asset_%d" % i, unreal.Vector(x, y, 0), m, unreal.Vector(s, s, s), yaw)
        else:
            # Placeholder „drzewo": pień (cylinder) + korona (cone). Do podmiany na Twoje siatki.
            h = random.uniform(0.9, 1.5)
            mesh_actor("Nature_Trunk_%d" % i, unreal.Vector(x, y, 90 * h), cyl, unreal.Vector(0.15, 0.15, h), yaw)
            mesh_actor("Nature_Canopy_%d" % i, unreal.Vector(x, y, 200 * h), cone, unreal.Vector(1.1, 1.1, 1.6 * h), yaw)

    unreal.EditorLevelLibrary.save_current_level()
    src = "Twoje assety (%d siatek)" % len(meshes) if meshes else "placeholder (cone+cylinder)"
    unreal.log("=== 🌳 Zalesiono Wyspę: %d drzew [%s]. ===" % (COUNT, src))
    if not meshes:
        unreal.log("Podmień na prawdziwe: Migrate siatki (Electric Dreams) → OTAKOS_NATURE_MESHES=\"/Game/.../SM_Tree\" → odpal ponownie.")


plant()
