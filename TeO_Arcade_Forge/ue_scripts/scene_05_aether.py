import unreal

# 🍞 GENESIS OVERRIDE — Krok 05: AETHER — lewitujący złoty TOST + gwiazdy NeuralMap.
# Idempotentne. TOST = świecąca kula wysoko nad sceną, wokół cyjanowe „gwiazdy-Node".

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

def star(label, loc, color255, intensity=12000.0):
    a = fos(unreal.PointLight, label, loc)
    c = a.get_component_by_class(unreal.PointLightComponent)
    c.set_editor_property('light_color', unreal.Color(*color255))
    c.set_editor_property('intensity', intensity)
    c.set_editor_property('attenuation_radius', 1200.0)
    return a

def aether():
    # Lewitujący złoty TOST (kula) — na WYSOKOŚCI WZROKU nad Antresolą, dostępny dla gracza.
    TZ = 200  # wysokość TOSTu (eye-level), nie 1200
    tost = fos(unreal.StaticMeshActor, "Golden_Toast_Portal", unreal.Vector(0, 0, TZ))
    tost.static_mesh_component.set_static_mesh(unreal.load_asset("/Engine/BasicShapes/Sphere.Sphere"))
    tost.set_actor_scale3d(unreal.Vector(1.2, 1.2, 1.2))
    star("Aether_Toast_Glow", unreal.Vector(0, 0, TZ), (255, 200, 60, 255), 12000.0)

    # Gwiazdy NeuralMap (cyjanowe/fioletowe Node) — halo wokół TOSTa na wysokości wzroku
    star("Aether_Star_N", unreal.Vector(420, 0, TZ + 80), (0, 230, 255, 255))
    star("Aether_Star_S", unreal.Vector(-420, 0, TZ + 80), (0, 230, 255, 255))
    star("Aether_Star_E", unreal.Vector(0, 420, TZ + 80), (140, 0, 255, 255))
    star("Aether_Star_W", unreal.Vector(0, -420, TZ + 80), (140, 0, 255, 255))

    # Napis portalu — tuż pod TOSTem
    lbl = fos(unreal.TextRenderActor, "Aether_Label", unreal.Vector(0, 0, TZ - 110))
    lbl.text_render.set_text(unreal.Text("AETHER  -  arena Katedr"))
    lbl.text_render.set_text_render_color(unreal.Color(255, 200, 60, 255))
    lbl.text_render.set_world_size(40.0)

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("GENESIS Krok 05: AETHER — zloty TOST + gwiazdy NeuralMap gotowe.")

aether()
