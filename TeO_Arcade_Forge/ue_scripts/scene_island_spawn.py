import unreal

# 🚶 O TAK… WYSPA — Punkt startu gracza (PlayerStart na środku Wyspy, twarzą do portali/AETHER).
# Po Play lądujesz NA Wyspie, patrząc przez antresolę ku wrotom i TOST-owi (+X). Idempotentne.
# Reużywa istniejącego PlayerStart (template ma swój) — przenosi go na Wyspę zamiast dublować.

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


def spawn_point():
    # Wyżej i z dala od antresoli-podestu (gracz spada czysto na grunt — bez artefaktów klipowania).
    loc = unreal.Vector(-650, 0, 220)   # na wyspie, twarzą do środka/portali (+X)
    ps = next((a for a in unreal.EditorLevelLibrary.get_all_level_actors()
               if isinstance(a, unreal.PlayerStart)), None)
    if ps is None:
        ps = fos(unreal.PlayerStart, "Island_PlayerStart", loc)
    else:
        ps.set_actor_location(loc, False, False)
    rot = unreal.Rotator()
    rot.yaw = 0.0   # patrzy w +X: antresola → wrota → AETHER
    ps.set_actor_rotation(rot, False)

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== 🚶 PlayerStart na Wyspie (środek, twarzą do portali/AETHER). Naciśnij Play. ===")


spawn_point()
