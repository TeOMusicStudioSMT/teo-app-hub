# 🗺️ GENESIS OVERRIDE — Mapa Budowy (żeby się nie pogubić)

> Zasada: **jeden krok = jeden skrypt**, ponumerowany. Każdy aktor ma **unikalną etykietę**.
> Skrypty są **idempotentne** (find-or-spawn z `_forge_lib.py`) — możesz uruchamiać ponownie,
> nic się nie zdubluje. Budujemy **warstwami**, od fundamentu po film.

## Warstwy (kolejność)
- ✅ **01 — Oświetlenie** (`scene_fix_lighting.py`): zmierzch + 4 neony fiolet/cyjan. ZROBIONE.
- 🎬 **02 — Filmowe wejście** (`scene_02_intro.py`): tytuł „OtakOS" + podtytuł „budzisz się…" + kamera kinowa. Fade i animacja „otwarcia oczu" → Sequencer (patrz niżej).
- 🏛️ **03 — Oszklone ATRIUM** (`scene_03_atrium.py`): metalowa konstrukcja (pierścień słupów + sufitowe belki z `/Engine/BasicShapes/Cube`) + 4 kolorowe „witraże" (światła) + SphereReflectionCapture (odbicia). NASTĘPNA polerka: prawdziwe przeszklone panele (materiał translucent kolorowy, niska szorstkość = odbicia) — Material Editor lub generator.
- 🏛️ **03b — Geometria Schronu** (`scene_03b_geometry.py`): biurko Konstruktora, terminal „KATEDRA OtakOS", pancerne wrota EventHorizon (z PRZYPISANĄ siatką — inaczej niewidoczne!).
- 💍 **04 — Interakcja** (`scene_04_interaction.py`): strefa `Trigger_GateConsole` przy terminalu + Level Sequence `Cine_GateOpen` (skrzydła rozsuwają się 0→1.5 s) + `Seq_GateOpen_Actor` (auto_play). `open_gate_now()` = test natychmiastowy. SKRYPT GOTOWY — uruchom w UE. ⚠ **04b (raz, ręcznie):** w Level Blueprint zepnij `OnActorBeginOverlap(Trigger_GateConsole)` → `Play(Seq_GateOpen_Actor)` (Python nie autoryzuje grafu BP).
- 🍞 **05 — Most + TOST → AETHER** (`scene_05_aether.py`): platforma w kosmosie, gwiazdy NeuralMap, złoty TOST-portal, wybór specjalizacji.
- 🛡️ **06 — Strażnicy** (`scene_06_guardians.py`): 3 drony iFixAi (kule + zielono-cyjanowy glow) patrolują bramy + `Guardian_Respawn` (TargetPoint przy konsoli) + `Guardian_TeleZone` (granica). Filozofia: brak damage — przekroczenie = łagodna teleportacja do Respawn. SKRYPT GOTOWY — uruchom w UE. ⚠ **06b (raz, ręcznie):** w Level Blueprint zepnij `OnActorBeginOverlap(Guardian_TeleZone)` → `SetActorLocation(OtherActor → Guardian_Respawn)`.

## ⚡ Jeden klik = cała Katedra
`build_all_genesis.py` odpala wszystkie warstwy 01→06 po kolei (idempotentnie, `try/except`
per scena + raport). Narzędzia → Wykonaj skrypt → `build_all_genesis.py`. Do rekonstrukcji
świata po reset/nowy poziom. Ręczne wiązania BP **04b** (overlap→Play wrót) i **06b**
(overlap→teleport) robisz raz osobno — Python nie autoryzuje grafu Blueprinta.

## Jak pracować (rytm)
1. W Katedrze → **TeO Arcade Forge → 🐍 Agent buduje scenę** → opisz JEDEN krok → generuj.
2. Agent zapisuje skrypt do `ue_scripts/`. Uruchom w UE (**Narzędzia → Wykonaj skrypt Pythona**).
3. Coś nie tak? Popraw prompt / skrypt, uruchom ponownie (idempotentnie — bez bałaganu).
4. Działa? Odhacz krok tutaj, idź do następnego. **Nigdy nie rób dwóch warstw naraz.**

## 🎬 Filmowe wejście — jak zrobić fade + „otwarcie oczu"
Tytuł i kamerę stawia `scene_02_intro.py`. Sam **film** (przyciemnienie z czerni → tytuł → znika → grasz)
robi się w **Sequencerze** (Okno → Cinematics → Add Level Sequence):
- Dodaj **Camera Cut Track** + kamerę kinową.
- **Fade Track**: czerń → przejrzystość (0→1 s).
- Ścieżka widoczności tytułu „OtakOS" (pojawia się, znika).
- Na końcu sekwencji → **oddanie sterowania graczowi** (Level Blueprint: po sekwencji `Set View Target` na gracza = „otwierasz oczy").
- (Docelowo: generator napisze i to przez Python — Sequencer ma API.)

## Konwencja etykiet (by wszystko się spinało)
`Sun_*`, `Neon_*`, `Title_*`, `Desk_*`, `Terminal_*`, `Gate_*`, `Aether_*`, `Guardian_*`, `Cine_*`.
