# 🔌 Wtyczka Reżysera — floating_props
# Lewitujące rekwizyty: kule lub sześciany unoszące się w kręgu nad sceną (świecące rdzenie).
# Kontrakt: patrz _PLUGIN_API.md. Idempotentne (prefiks etykiet Plugin_props_<scene>_*).

import math

SHAPES = {
    "sphere": "/Engine/BasicShapes/Sphere.Sphere",
    "cube": "/Engine/BasicShapes/Cube.Cube",
}


def apply(ctx, params):
    """Lewitujące rekwizyty w kręgu (params: count=6, shape=sphere, radius=350, height=300)."""
    u = ctx.unreal
    count = max(1, int(params.get("count", 6)))
    shape = str(params.get("shape", "sphere"))
    radius = float(params.get("radius", 350))
    height = float(params.get("height", 300))
    mesh_path = SHAPES.get(shape, SHAPES["sphere"])
    mesh = u.load_asset(mesh_path)

    for i in range(count):
        ang = (2 * math.pi / count) * i
        loc = ctx.origin + u.Vector(math.cos(ang) * radius, math.sin(ang) * radius, height)
        prop = ctx.fos(u.StaticMeshActor, "Plugin_props_%s_%d" % (ctx.scene_id, i), loc)
        prop.static_mesh_component.set_static_mesh(mesh)
        prop.set_actor_scale3d(u.Vector(0.5, 0.5, 0.5))
        # Świecący rdzeń obok rekwizytu — delikatna poświata.
        glow = ctx.fos(u.PointLight, "Plugin_props_%s_glow_%d" % (ctx.scene_id, i), loc)
        gc = glow.get_component_by_class(u.PointLightComponent)
        gc.set_light_color(u.Color(180, 120, 255, 255))
        gc.set_intensity(1800.0)
        gc.set_attenuation_radius(300.0)

    ctx.log("floating_props: %d × %s w kręgu r=%d." % (count, shape, int(radius)))
