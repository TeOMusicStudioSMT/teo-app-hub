# 🔌 Wtyczka Reżysera — rain_neon
# Neonowy deszcz: mgła wolumetryczna + rząd kolorowych kałuż-świateł (odbicia w mokrej podłodze).
# Kontrakt: patrz _PLUGIN_API.md. Idempotentne (prefiks etykiet Plugin_rain_<scene>_*).


def apply(ctx, params):
    """Neonowy deszcz: mgła + kałuże-odbicia (params: count=8, height=0)."""
    u = ctx.unreal
    count = int(params.get("count", 8))
    height = float(params.get("height", 0))

    # Mgła wolumetryczna nad sceną (jedna na poziom — stała etykieta).
    fog = ctx.fos(u.ExponentialHeightFog, "Plugin_rain_%s_fog" % ctx.scene_id,
                  ctx.origin + u.Vector(0, 0, height + 50))
    try:
        comp = fog.get_component_by_class(u.ExponentialHeightFogComponent)
        comp.set_editor_property("fog_density", 0.12)
        comp.set_editor_property("volumetric_fog", True)
    except Exception as e:
        ctx.log("rain_neon: mgła bez parametrów (%s)." % e)

    # Rząd kałuż — naprzemiennie cyjan/magenta, nisko przy podłodze (imitacja odbić w wodzie).
    palette = [u.Color(0, 220, 255, 255), u.Color(255, 0, 200, 255)]
    for i in range(count):
        loc = ctx.origin + u.Vector(-300 + i * 160, (i % 2) * 200 - 100, height + 8)
        puddle = ctx.fos(u.PointLight, "Plugin_rain_%s_puddle_%d" % (ctx.scene_id, i), loc)
        pc = puddle.get_component_by_class(u.PointLightComponent)
        pc.set_editor_property("light_color", palette[i % 2])  # Color 0-255 (set_light_color chce LinearColor)
        pc.set_intensity(2600.0)
        pc.set_attenuation_radius(380.0)

    ctx.log("rain_neon: mgła + %d kałuż-odbić." % count)
