import unreal

# 🪟 GENESIS OVERRIDE — Krok 03c: PRAWDZIWE szklane panele Atrium (polerka 03).
# Zamiast samych świateł-witraży: translucentny materiał emisyjny na cienkich taflach (cube-slab),
# przez które świecą i odbijają się neony Atrium. Idempotentne (find_or_spawn).
# DEFENSYWNIE: jeśli Material API 5.8 inne — slaby i tak staną (bez koloru), struktura zostaje.
#
# Wymaga wcześniej scene_03_atrium.py (światła witraży). Etos „zero z dupy": materiał w try/except.

CUBE = "/Engine/BasicShapes/Cube.Cube"
MAT_PATH = "/Game/Genesis/Materials"

# (nazwa, kolor LinearColor 0-1, pozycja, skala taflowa)
PANES = [
    ("M_Glass_Violet", (0.55, 0.0, 1.0),  unreal.Vector(440, 0, 420),  unreal.Vector(0.06, 2.2, 3.2)),
    ("M_Glass_Cyan",   (0.0, 0.9, 1.0),   unreal.Vector(-440, 0, 420), unreal.Vector(0.06, 2.2, 3.2)),
    ("M_Glass_Gold",   (1.0, 0.78, 0.16), unreal.Vector(0, 440, 420),  unreal.Vector(2.2, 0.06, 3.2)),
    ("M_Glass_Rose",   (1.0, 0.16, 0.63), unreal.Vector(0, -440, 420), unreal.Vector(2.2, 0.06, 3.2)),
]


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


def make_glass(name, rgb):
    # Translucentny, emisyjny, niska szorstkość (odbicia). Cały w try/except.
    try:
        full = MAT_PATH + "/" + name
        mat = unreal.load_asset(full)
        if mat is None:
            mat = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
                name, MAT_PATH, unreal.Material, unreal.MaterialFactoryNew())
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        try:
            mat.set_editor_property("two_sided", True)
        except Exception:
            pass
        mel = unreal.MaterialEditingLibrary
        col = mel.create_material_expression(mat, unreal.MaterialExpressionConstant3Vector, -400, 0)
        col.set_editor_property("constant", unreal.LinearColor(rgb[0], rgb[1], rgb[2], 1.0))
        mel.connect_material_property(col, "", unreal.MaterialProperty.MP_BASE_COLOR)
        mel.connect_material_property(col, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
        op = mel.create_material_expression(mat, unreal.MaterialExpressionConstant, -400, 220)
        op.set_editor_property("r", 0.28)
        mel.connect_material_property(op, "", unreal.MaterialProperty.MP_OPACITY)
        rg = mel.create_material_expression(mat, unreal.MaterialExpressionConstant, -400, 380)
        rg.set_editor_property("r", 0.08)
        mel.connect_material_property(rg, "", unreal.MaterialProperty.MP_ROUGHNESS)
        mel.recompile_material(mat)
        return mat
    except Exception as e:
        unreal.log_warning("  03c: materiał %s pominięty (API 5.8?): %s" % (name, e))
        return None


def glass():
    cube = unreal.load_asset(CUBE)
    made = 0
    for name, rgb, loc, scale in PANES:
        mat = make_glass(name, rgb)
        slab = fos(unreal.StaticMeshActor, "Atrium_Pane_%s" % name.replace("M_Glass_", ""), loc)
        slab.static_mesh_component.set_static_mesh(cube)
        slab.set_actor_scale3d(scale)
        if mat is not None:
            try:
                slab.static_mesh_component.set_material(0, mat)
                made += 1
            except Exception as e:
                unreal.log_warning("  03c: przypisanie materiału %s nieudane: %s" % (name, e))
    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== GENESIS Krok 03c: szklane panele Atrium (%d/4 z materiałem translucent). ===" % made)
    if made == 0:
        unreal.log_warning("03c: slaby stoją bez koloru — Material API inne. Nadaj materiał ręcznie w Material Editor.")


glass()
