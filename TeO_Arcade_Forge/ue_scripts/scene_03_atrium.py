import unreal
import math

# 🏛️ GENESIS OVERRIDE — Krok 03: Oszklone ATRIUM
# Metalowa konstrukcja (pierścień słupów + sufitowe belki) + kolorowe „witraże" (światła)
# + przechwytywanie odbić (SphereReflectionCapture). Idempotentne (find_or_spawn).

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

def beam(label, loc, scale):
    a = fos(unreal.StaticMeshActor, label, loc)
    cube = unreal.load_asset("/Engine/BasicShapes/Cube.Cube")
    a.static_mesh_component.set_static_mesh(cube)
    a.set_actor_scale3d(scale)
    return a

def glass_light(label, loc, color255):
    a = fos(unreal.PointLight, label, loc)
    c = a.get_component_by_class(unreal.PointLightComponent)
    c.set_editor_property('light_color', unreal.Color(*color255))  # 0-255
    c.set_editor_property('intensity', 9000.0)
    c.set_editor_property('attenuation_radius', 750.0)
    return a

def atrium():
    # Metalowa konstrukcja — pierścień 8 pionowych słupów wokół środka
    n, R = 8, 460
    for i in range(n):
        ang = (2 * math.pi / n) * i
        beam("Atrium_Beam_%d" % i, unreal.Vector(R * math.cos(ang), R * math.sin(ang), 320),
             unreal.Vector(0.15, 0.15, 7.0))

    # Sufitowe belki (krzyż szklarni)
    beam("Atrium_TopBeam_X", unreal.Vector(0, 0, 660), unreal.Vector(9.5, 0.25, 0.25))
    beam("Atrium_TopBeam_Y", unreal.Vector(0, 0, 660), unreal.Vector(0.25, 9.5, 0.25))

    # Kolorowe „szkło" — 4 witrażowe światła (odbiją się po metalu/podłodze)
    glass_light("Atrium_Glass_Violet", unreal.Vector(460, 0, 420),  (140, 0, 255, 255))
    glass_light("Atrium_Glass_Cyan",   unreal.Vector(-460, 0, 420), (0, 230, 255, 255))
    glass_light("Atrium_Glass_Gold",   unreal.Vector(0, 460, 420),  (255, 200, 40, 255))
    glass_light("Atrium_Glass_Rose",   unreal.Vector(0, -460, 420), (255, 40, 160, 255))

    # Odbicia w pomieszczeniu
    fos(unreal.SphereReflectionCapture, "Atrium_Reflection", unreal.Vector(0, 0, 350))

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("GENESIS Krok 03: Atrium — konstrukcja + witrazowe swiatla + odbicia gotowe.")

atrium()
