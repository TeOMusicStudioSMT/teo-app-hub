import unreal

# 🏛️ GENESIS OVERRIDE — Krok 03b: Geometria Schronu
# Biurko Konstruktora + terminal (z napisem) + pancerne wrota EventHorizon.
# WAŻNE: każdy StaticMeshActor dostaje PRZYPISANĄ siatkę (cube) — inaczej niewidoczny.
# Idempotentne (find_or_spawn).

CUBE = "/Engine/BasicShapes/Cube.Cube"

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

def box(label, loc, scale):
    a = fos(unreal.StaticMeshActor, label, loc)
    a.static_mesh_component.set_static_mesh(unreal.load_asset(CUBE))
    a.set_actor_scale3d(scale)
    return a

def label_text(name, content, loc, color255, size=22.0):
    a = fos(unreal.TextRenderActor, name, loc)
    tc = a.text_render
    tc.set_text(unreal.Text(content))
    tc.set_text_render_color(unreal.Color(*color255))
    tc.set_world_size(size)
    return a

def geometry():
    # Biurko Konstruktora (blat + noga)
    box("Desk_Constructor", unreal.Vector(0, 0, 45), unreal.Vector(2.4, 1.2, 0.15))
    box("Desk_Leg",         unreal.Vector(0, 0, 20), unreal.Vector(2.0, 0.9, 0.4))

    # Terminal na biurku + napis
    box("Terminal_Box",     unreal.Vector(0, 0, 75), unreal.Vector(0.5, 0.08, 0.45))
    label_text("Terminal_OtakOS", "KATEDRA OtakOS\nWymiar 0.00G (V_ZERO)",
               unreal.Vector(-2, 0, 90), (0, 230, 255, 255), 14.0)

    # Pancerne wrota EventHorizon (dwa skrzydła + napis nad)
    box("Gate_EventHorizon_L", unreal.Vector(700, -120, 200), unreal.Vector(0.4, 1.2, 4.0))
    box("Gate_EventHorizon_R", unreal.Vector(700,  120, 200), unreal.Vector(0.4, 1.2, 4.0))
    label_text("Gate_Label", "EVENT  HORIZON", unreal.Vector(700, 0, 430), (140, 0, 255, 255), 30.0)

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("GENESIS Krok 03b: biurko + terminal + wrota EventHorizon (widoczne).")

geometry()
