import unreal

# 💍 GENESIS OVERRIDE — Krok 04: Interakcja (dotknięcie pierścienia otwiera wrota)
# Spina łańcuch: biurko (03b) → konsola → STREFA → wrota EventHorizon → most do AETHER (05).
#
# CO ROBI PYTHON (pewnie, działa po uruchomieniu w UE):
#   1) Strefa interakcji  Trigger_GateConsole  — TriggerBox przy terminalu.
#   2) open_gate_now()    — natychmiastowe rozsunięcie skrzydeł (do weryfikacji geometrii).
#   3) Cine_GateOpen      — Level Sequence: skrzydła płynnie odjeżdżają (0 → 1.5 s).
#   4) Seq_GateOpen_Actor — LevelSequenceActor (auto_play): na Play wrota otwierają się kinowo.
#
# CZEGO PYTHON NIE ZROBI (uczciwie — krok 04b, jedno kliknięcie w edytorze):
#   Powiązanie OnActorBeginOverlap(Trigger_GateConsole) → Play(Cine_GateOpen) w Level Blueprint.
#   Stock UE nie pozwala autoryzować grafu BP z Pythona. Instrukcja na końcu skryptu.
#
# Idempotentne (find-or-spawn). Etykiety wg konwencji: Trigger_*, Gate_*, Cine_*, Seq_*.

GATE_L = "Gate_EventHorizon_L"
GATE_R = "Gate_EventHorizon_R"
CLOSED_Y = 120.0     # pozycja zamknięta (z 03b: L=-120, R=+120)
OPEN_Y   = 540.0     # pozycja otwarta (skrzydła odjeżdżają na boki)
SEQ_PATH = "/Game/Genesis"
SEQ_NAME = "Cine_GateOpen"


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


def build_trigger_zone():
    # Strefa „dotknięcia pierścienia" — tuż przed biurkiem/terminalem (03b: terminal w 0,0,75).
    tb = fos(unreal.TriggerBox, "Trigger_GateConsole", unreal.Vector(140, 0, 90))
    tb.set_actor_scale3d(unreal.Vector(1.6, 3.0, 2.0))  # zasięg ramienia przy konsoli
    unreal.log("Krok 04: strefa Trigger_GateConsole gotowa (przy terminalu).")
    return tb


def open_gate_now():
    # Natychmiastowe rozsunięcie — do szybkiej weryfikacji bez Sequencera.
    l = find_actor(GATE_L)
    r = find_actor(GATE_R)
    if l:
        loc = l.get_actor_location(); l.set_actor_location(unreal.Vector(loc.x, -OPEN_Y, loc.z), False, False)
    if r:
        loc = r.get_actor_location(); r.set_actor_location(unreal.Vector(loc.x,  OPEN_Y, loc.z), False, False)
    unreal.log("Krok 04: wrota rozsunięte natychmiast (open_gate_now).")


def _key_y(section, frame, value):
    # Wpisuje klucz na kanale Location.Y (indeks 1) sekcji transformu.
    chans = section.get_channels()
    chans[1].add_key(unreal.FrameNumber(frame), value)


def build_open_sequence():
    # Level Sequence: skrzydła zjeżdżają z CLOSED_Y → OPEN_Y w 1.5 s. Defensywnie (API 5.x bywa różne).
    try:
        tools = unreal.AssetToolsHelpers.get_asset_tools()
        asset_path = "%s/%s" % (SEQ_PATH, SEQ_NAME)
        seq = unreal.load_asset(asset_path)
        if seq is None:
            seq = tools.create_asset(SEQ_NAME, SEQ_PATH, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
        fps = 30
        seq.set_display_rate(unreal.FrameRate(fps, 1))
        seq.set_playback_start(0)
        seq.set_playback_end(int(1.5 * fps))

        for label, closed, opened in ((GATE_L, -CLOSED_Y, -OPEN_Y), (GATE_R, CLOSED_Y, OPEN_Y)):
            actor = find_actor(label)
            if actor is None:
                unreal.log_warning("Krok 04: brak %s — uruchom najpierw scene_03b_geometry.py." % label)
                continue
            binding = seq.add_possessable(actor)
            track = binding.add_track(unreal.MovieScene3DTransformTrack)
            section = track.add_section()
            section.set_range(0, int(1.5 * fps))
            _key_y(section, 0, closed)
            _key_y(section, int(1.5 * fps), opened)

        unreal.EditorAssetLibrary.save_asset(asset_path)

        # Aktor sekwencji w poziomie — auto_play: na Play wrota otwierają się kinowo.
        sa = find_actor("Seq_GateOpen_Actor")
        if sa is None:
            sa = unreal.EditorActorSubsystem().spawn_actor_from_class(
                unreal.LevelSequenceActor, unreal.Vector(0, 0, 0))
            sa.set_actor_label("Seq_GateOpen_Actor")
        sa.set_sequence(seq)
        try:
            sa.set_editor_property("auto_play", True)
        except Exception:
            sa.playback_settings.auto_play = True
        unreal.log("Krok 04: Cine_GateOpen + Seq_GateOpen_Actor (auto_play) gotowe.")
        return True
    except Exception as e:
        unreal.log_warning("Krok 04: Sequencer pominięty (API 5.8 inne?): %s. "
                           "Geometria + strefa stoją; użyj open_gate_now() do testu." % e)
        return False


def interaction():
    build_trigger_zone()
    build_open_sequence()
    unreal.EditorLevelLibrary.save_current_level()
    unreal.log("=== GENESIS Krok 04 gotowy. ===")
    unreal.log("WIĄZANIE 04b (raz, ręcznie w edytorze): otwórz Level Blueprint → "
               "zaznacz Trigger_GateConsole w Outliner → w grafie 'Add Event > OnActorBeginOverlap' → "
               "wyciągnij z Seq_GateOpen_Actor węzeł 'Play'. Tyle. Wrota otworzą się przy podejściu.")


interaction()
