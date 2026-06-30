import unreal

# 🌅 O TAK… WYSPA — Atmosfera ŚWITU (worldPrompt: „świt nad oceanem, neony cyjan-fiolet").
# Ciepłe, NISKIE słońce + delikatna mgła = klimat świtu. Reużywa istniejącego słońca (nie dubluje).
# Idempotentne. Bezpieczne API (kolory: light_color=Color 0-255, fog_inscattering=LinearColor 0-1).

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


def atmosphere():
    actors = unreal.EditorLevelLibrary.get_all_level_actors()

    # Słońce świtu — niskie nad horyzontem, ciepłe.
    sun = next((a for a in actors if isinstance(a, unreal.DirectionalLight)), None)
    if sun is None:
        sun = fos(unreal.DirectionalLight, "Island_Sun_Dawn", unreal.Vector(0, 0, 1500))
    try:
        c = sun.get_component_by_class(unreal.DirectionalLightComponent)
        c.set_editor_property("light_color", unreal.Color(255, 188, 132, 255))  # ciepły świt
        c.set_intensity(3.2)
    except Exception as e:
        unreal.log_warning("  atmosfera: słońce bez parametrów (%s)" % e)
    rot = unreal.Rotator()
    rot.pitch = -11.0   # nisko nad horyzontem
    rot.yaw = 40.0
    sun.set_actor_rotation(rot, False)

    # Mgła świtu — ciepła, rzadka.
    fog = next((a for a in actors if isinstance(a, unreal.ExponentialHeightFog)), None)
    if fog is None:
        fog = fos(unreal.ExponentialHeightFog, "Island_Fog_Dawn", unreal.Vector(0, 0, 0))
    try:
        fc = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
        fc.set_editor_property("fog_density", 0.022)
        fc.set_editor_property("fog_inscattering_color", unreal.LinearColor(1.0, 0.68, 0.42, 1.0))
    except Exception as e:
        unreal.log_warning("  atmosfera: mgła bez parametrów (%s)" % e)

    # SkyLight przygaszony, by świt nie był płaski.
    sky = next((a for a in actors if isinstance(a, unreal.SkyLight)), None)
    if sky is not None:
        try:
            sky.get_component_by_class(unreal.SkyLightComponent).set_intensity(0.8)
        except Exception:
            pass

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== 🌅 Atmosfera świtu: ciepłe niskie słońce + mgła. ===")


atmosphere()
