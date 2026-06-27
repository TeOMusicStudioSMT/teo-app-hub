import unreal

# 🔧 GENESIS OVERRIDE — POPRAWKA OŚWIETLENIA (scena 1)
# Naprawia: kolory (unreal.Color = 0-255, nie 0-1), czarny ekran (słońce != 0),
# clip ekspozycji (manualna ekspozycja), słabe neony.

def fix_genesis_lighting():
    eas = unreal.EditorActorSubsystem()
    actors = unreal.EditorLevelLibrary.get_all_level_actors()

    # 1) Słońce: NIE 0 — niski zmierzch (unik czarnego ekranu + clip ekspozycji)
    for a in actors:
        if isinstance(a, unreal.DirectionalLight):
            lc = a.get_component_by_class(unreal.LightComponent)
            lc.set_editor_property('intensity', 0.7)
            a.set_actor_label("Sun_Dusk_00G")

    # 2) SkyLight: przyciemnij, by neony grały (jeśli istnieje)
    for a in actors:
        if isinstance(a, unreal.SkyLight):
            sc = a.get_component_by_class(unreal.SkyLightComponent)
            sc.set_editor_property('intensity', 0.4)

    # 3) Neony — KOLOR przez unreal.Color w skali 0-255 (!), mocne, większy zasięg
    def neon(name, loc, color):
        light = eas.spawn_actor_from_class(unreal.PointLight, loc)
        light.set_actor_label(name)
        c = light.get_component_by_class(unreal.PointLightComponent)
        c.set_editor_property('light_color', color)
        c.set_editor_property('intensity', 20000.0)
        c.set_editor_property('attenuation_radius', 900.0)
        return light

    neon("Neon_Violet_00G",  unreal.Vector(250, 250, 150),   unreal.Color(140, 0, 255, 255))
    neon("Neon_Cyan_00G",    unreal.Vector(-250, -250, 150), unreal.Color(0, 230, 255, 255))
    neon("Neon_Violet_2",    unreal.Vector(250, -250, 150),  unreal.Color(170, 30, 255, 255))
    neon("Neon_Cyan_2",      unreal.Vector(-250, 250, 150),  unreal.Color(30, 255, 255, 255))

    # 4) Ekspozycja: zgaś warning/clip (manualnie)
    try:
        world = unreal.EditorLevelLibrary.get_editor_world()
        unreal.SystemLibrary.execute_console_command(world, "r.EyeAdaptation.CachedLightingPreExposure 0")
    except Exception as e:
        unreal.log_warning("Exposure cmd: %s" % e)

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("GENESIS OVERRIDE: oswietlenie naprawione — zmierzch + 4 neony fiolet/cyjan.")

fix_genesis_lighting()
