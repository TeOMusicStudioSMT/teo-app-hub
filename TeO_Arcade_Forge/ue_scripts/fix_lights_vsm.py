import unreal

# 💡 GENESIS OVERRIDE — Strojenie świateł (fix ostrzeżenia VSM: za dużo lokalnych świateł).
# Problem: wiele PointLight/SpotLight rzucających CIEŃ nakłada się na piksel → Virtual Shadow Maps
# przepełnia single-pass. Fix: dekoracyjne światła (neony/witraże/gwiazdy/glow) NIE potrzebują
# dynamicznego cienia — wyłączamy `cast_shadows`. Glow i kolor ZOSTAJĄ; cień rzuca tylko słońce.
# Dodatkowo łagodzimy przepalenie: przycinamy skrajne intensywności/zasięgi.
# Idempotentne — można puszczać wielokrotnie. NIE rusza DirectionalLight (główne słońce/cień).

MAX_INTENSITY = 4000.0   # sufit jasności lokalnego światła (anty-przepalenie)
MAX_RADIUS = 650.0       # sufit zasięgu (mniej nakładania = mniej świateł/piksel)


def _comp(actor):
    if isinstance(actor, unreal.PointLight):
        return actor.get_component_by_class(unreal.PointLightComponent)
    if isinstance(actor, unreal.SpotLight):
        return actor.get_component_by_class(unreal.SpotLightComponent)
    if isinstance(actor, unreal.RectLight):
        return actor.get_component_by_class(unreal.RectLightComponent)
    return None


def tame_local_lights():
    actors = unreal.EditorLevelLibrary.get_all_level_actors()
    no_shadow, capped = 0, 0
    for a in actors:
        comp = _comp(a)
        if comp is None:
            continue
        # 1) Bez dynamicznego cienia — kluczowy fix VSM.
        try:
            comp.set_editor_property("cast_shadows", False)
        except Exception:
            try:
                comp.set_cast_shadows(False)
            except Exception:
                pass
        no_shadow += 1
        # 2) Anty-przepalenie: przytnij skrajne wartości.
        try:
            if comp.get_editor_property("intensity") > MAX_INTENSITY:
                comp.set_intensity(MAX_INTENSITY)
                capped += 1
        except Exception:
            pass
        try:
            if comp.get_editor_property("attenuation_radius") > MAX_RADIUS:
                comp.set_attenuation_radius(MAX_RADIUS)
        except Exception:
            pass
    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== 💡 Strojenie świateł: %d lokalnych bez cienia (VSM OK), %d przyciętych. ===" % (no_shadow, capped))
    unreal.log("Cień rzuca tylko DirectionalLight (słońce). Jeśli nadal przepalone — zmniejsz ekspozycję w PostProcessVolume.")


tame_local_lights()
