import unreal

# 🎞️ GENESIS OVERRIDE — Krok 02b: Filmowe wejście (fade z czerni = „otwarcie oczu") — polerka 02.
# Level Sequence „Cine_Intro_Film": czerń → przejrzystość (0→1.5 s), cięcie kamery na Cine_Intro,
# auto_play → po starcie gracz „otwiera oczy" na tytuł OtakOS. Idempotentne.
# DEFENSYWNIE: cała warstwa Sequencer w try/except (API 5.8 bywa różne) — gdy padnie,
# kamera/tytuł z kroku 02 i tak stoją. Wymaga wcześniej scene_02_intro.py.
#
# ⚠ Oddanie sterowania graczowi po sekwencji = 1 ręczny węzeł BP (On Finished → Set View Target).

FPS = 30
DUR_S = 5.0
SEQ_PATH = "/Game/Genesis"
SEQ_NAME = "Cine_Intro_Film"


def find_actor(label):
    for a in unreal.EditorLevelLibrary.get_all_level_actors():
        if a.get_actor_label() == label:
            return a
    return None


def _binding_id(seq, binding):
    for attempt in (
        lambda: binding.get_binding_id(),
        lambda: unreal.MovieSceneSequenceExtensions.get_binding_id(seq, binding),
        lambda: unreal.MovieSceneSequenceExtensions.make_binding_id(seq, binding),
    ):
        try:
            return attempt()
        except Exception:
            continue
    return None


def _add_key(channel, frame, value):
    try:
        channel.add_key(unreal.FrameNumber(int(frame)), float(value))
        return True
    except Exception:
        return False


def intro_film():
    cam = find_actor("Cine_Intro")
    if cam is None:
        unreal.log_warning("02b: brak Cine_Intro — uruchom najpierw scene_02_intro.py.")
        return

    total = int(DUR_S * FPS)
    try:
        tools = unreal.AssetToolsHelpers.get_asset_tools()
        path = "%s/%s" % (SEQ_PATH, SEQ_NAME)
        seq = unreal.load_asset(path)
        if seq is None:
            seq = tools.create_asset(SEQ_NAME, SEQ_PATH, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
        seq.set_display_rate(unreal.FrameRate(FPS, 1))
        seq.set_playback_start(0)
        seq.set_playback_end(total)

        # 1) Cięcie kamery na Cine_Intro przez całą sekwencję.
        try:
            cut = seq.add_track(unreal.MovieSceneCameraCutTrack)
        except Exception:
            cut = seq.add_master_track(unreal.MovieSceneCameraCutTrack)
        binding = seq.add_possessable(cam)
        cut_sec = cut.add_section()
        cut_sec.set_range(0, total)
        bid = _binding_id(seq, binding)
        if bid is not None:
            cut_sec.set_camera_binding_id(bid)

        # 2) Fade z czerni: 1.0 (czarne) → 0.0 (przejrzyste) w 1.5 s = „otwarcie oczu".
        try:
            fade_track = seq.add_track(unreal.MovieSceneFadeTrack)
        except Exception:
            fade_track = seq.add_master_track(unreal.MovieSceneFadeTrack)
        fade_sec = fade_track.add_section()
        fade_sec.set_range(0, total)
        try:
            fade_sec.set_editor_property("fade_color", unreal.LinearColor(0.0, 0.0, 0.0, 1.0))
        except Exception:
            pass
        chans = []
        for getter in (lambda: fade_sec.get_channels(), lambda: fade_sec.get_all_channels()):
            try:
                chans = getter()
                if chans:
                    break
            except Exception:
                continue
        if chans:
            _add_key(chans[0], 0, 1.0)
            _add_key(chans[0], int(1.5 * FPS), 0.0)

        unreal.EditorAssetLibrary.save_asset(path)

        # 3) Aktor sekwencji — auto_play (film leci po naciśnięciu Play).
        sa = find_actor("Seq_Intro_Actor")
        if sa is None:
            sa = unreal.EditorActorSubsystem().spawn_actor_from_class(
                unreal.LevelSequenceActor, unreal.Vector(0, 0, 0))
            sa.set_actor_label("Seq_Intro_Actor")
        sa.set_sequence(seq)
        try:
            sa.set_editor_property("auto_play", True)
        except Exception:
            sa.playback_settings.auto_play = True

        unreal.EditorLevelLibrary.save_current_level()
        unreal.log("=== GENESIS Krok 02b: filmowe wejście (fade z czerni + Cine_Intro, auto_play). ===")
        unreal.log("ODDANIE STEROWANIA (raz, ręcznie): Level Blueprint → Seq_Intro_Actor 'On Finished' → "
                   "'Set View Target with Blend' na pawn gracza = otwierasz oczy w świecie.")
    except Exception as e:
        unreal.log_warning("02b: Sequencer pominięty (API 5.8 inne?): %s. "
                           "Tytuł i kamera z kroku 02 stoją — złóż fade ręcznie w Sequencerze." % e)


intro_film()
