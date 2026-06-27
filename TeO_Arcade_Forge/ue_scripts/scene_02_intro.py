import unreal

# 🎬 GENESIS OVERRIDE — Krok 02: Filmowe wejście (tytuł OtakOS + kamera kinowa).
# Idempotentne (find_or_spawn). Tytuł świeci, podtytuł „budzisz się…", kamera na wejście.

def find_actor(label):
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        if a.get_actor_label() == label:
            return a
    return None

def find_or_spawn(cls, label, loc):
    a = find_actor(label)
    if a is None:
        a = unreal.EditorActorSubsystem().spawn_actor_from_class(cls, loc)
        a.set_actor_label(label)
    a.set_actor_location(loc, False, False)
    return a

def intro():
    # 1) Tytuł OtakOS — wielki, cyjan (zwrócony do punktu startu)
    title = find_or_spawn(unreal.TextRenderActor, "Title_OtakOS", unreal.Vector(600, 0, 280))
    tc = title.text_render
    tc.set_text(unreal.Text("OtakOS"))
    tc.set_text_render_color(unreal.Color(0, 230, 255, 255))
    tc.set_world_size(150.0)
    title.set_actor_rotation(unreal.Rotator(0.0, 180.0, 0.0), False)

    # 2) Podtytuł — Wymiar 0.00G, fiolet
    sub = find_or_spawn(unreal.TextRenderActor, "Title_Sub", unreal.Vector(600, 0, 200))
    sc = sub.text_render
    sc.set_text(unreal.Text("Wymiar 0.00G  -  budzisz sie..."))
    sc.set_text_render_color(unreal.Color(140, 0, 255, 255))
    sc.set_world_size(45.0)
    sub.set_actor_rotation(unreal.Rotator(0.0, 180.0, 0.0), False)

    # 3) Kamera kinowa na otwierające ujęcie
    cam = find_or_spawn(unreal.CineCameraActor, "Cine_Intro", unreal.Vector(150, 0, 220))
    cam.set_actor_rotation(unreal.Rotator(-8.0, 180.0, 0.0), False)

    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("GENESIS Krok 02: tytul OtakOS + podtytul + kamera kinowa gotowe.")

intro()
