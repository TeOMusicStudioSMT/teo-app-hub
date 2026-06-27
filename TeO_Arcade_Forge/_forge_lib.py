import unreal

# 🧱 _forge_lib — wspólne pomocniki GENESIS OVERRIDE.
# ZASADA: każdy aktor ma UNIKALNĄ etykietę. find_or_spawn = znajdź-lub-stwórz →
# ponowne uruchomienie skryptu NIGDY nie dubluje (idempotentnie). Tak się nie gubimy.

def find_actor(label):
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        if a.get_actor_label() == label:
            return a
    return None

def find_or_spawn(cls, label, location=unreal.Vector(0, 0, 0)):
    a = find_actor(label)
    if a is None:
        a = unreal.EditorActorSubsystem().spawn_actor_from_class(cls, location)
        a.set_actor_label(label)
    a.set_actor_location(location, False, False)
    return a

def point_light(label, location, color255, intensity=20000.0, radius=900.0):
    a = find_or_spawn(unreal.PointLight, label, location)
    c = a.get_component_by_class(unreal.PointLightComponent)
    c.set_editor_property('light_color', unreal.Color(*color255))   # 0-255!
    c.set_editor_property('intensity', intensity)
    c.set_editor_property('attenuation_radius', radius)
    return a

def text(label, content, location, color255=(255, 255, 255, 255), size=80.0):
    a = find_or_spawn(unreal.TextRenderActor, label, location)
    tc = a.text_render
    tc.set_text(unreal.Text(content))
    tc.set_text_render_color(unreal.Color(*color255))
    tc.set_world_size(size)
    return a

def dim_sun(intensity=0.7):
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        if isinstance(a, unreal.DirectionalLight):
            a.get_component_by_class(unreal.LightComponent).set_editor_property('intensity', intensity)

def save():
    unreal.EditorLevelLibrary.save_current_level()
