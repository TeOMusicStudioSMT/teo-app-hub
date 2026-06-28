# 🗺️ GENESIS OVERRIDE — Mapa Budowy (żeby się nie pogubić)

> Zasada: **jeden krok = jeden skrypt**, ponumerowany. Każdy aktor ma **unikalną etykietę**.
> Skrypty są **idempotentne** (find-or-spawn z `_forge_lib.py`) — możesz uruchamiać ponownie,
> nic się nie zdubluje. Budujemy **warstwami**, od fundamentu po film.

## Warstwy (kolejność)
- ✅ **01 — Oświetlenie** (`scene_fix_lighting.py`): zmierzch + 4 neony fiolet/cyjan. ZROBIONE.
- 🎬 **02 — Filmowe wejście** (`scene_02_intro.py`): tytuł „OtakOS" + podtytuł „budzisz się…" + kamera kinowa. ZROBIONE.
- 🎞️ **02b — Wejście filmowe** (`scene_02b_intro_film.py`): ✅ polerka — Level Sequence `Cine_Intro_Film` (fade z czerni 0→1.5 s = „otwarcie oczu" + cięcie na `Cine_Intro`, auto_play). Defensywnie (Sequencer 5.8). ⚠ oddanie sterowania = 1 węzeł BP (On Finished → Set View Target).
- 🏛️ **03 — Oszklone ATRIUM** (`scene_03_atrium.py`): metalowa konstrukcja (pierścień słupów + sufitowe belki z `/Engine/BasicShapes/Cube`) + 4 kolorowe „witraże" (światła) + SphereReflectionCapture (odbicia). ZROBIONE.
- 🪟 **03c — Szklane panele** (`scene_03c_glass.py`): ✅ polerka — translucentny materiał emisyjny (`/Game/Genesis/Materials/M_Glass_*`, niska szorstkość = odbicia) na 4 taflach `Atrium_Pane_*`, przez które świecą neony. Defensywnie (Material API 5.8) — slaby stają nawet bez materiału.
- 🏛️ **03b — Geometria Schronu** (`scene_03b_geometry.py`): biurko Konstruktora, terminal „KATEDRA OtakOS", pancerne wrota EventHorizon (z PRZYPISANĄ siatką — inaczej niewidoczne!).
- 💍 **04 — Interakcja** (`scene_04_interaction.py`): strefa `Trigger_GateConsole` przy terminalu + Level Sequence `Cine_GateOpen` (skrzydła rozsuwają się 0→1.5 s) + `Seq_GateOpen_Actor` (auto_play). `open_gate_now()` = test natychmiastowy. SKRYPT GOTOWY — uruchom w UE. ⚠ **04b (raz, ręcznie):** w Level Blueprint zepnij `OnActorBeginOverlap(Trigger_GateConsole)` → `Play(Seq_GateOpen_Actor)` (Python nie autoryzuje grafu BP).
- 🍞 **05 — Most + TOST → AETHER** (`scene_05_aether.py`): platforma w kosmosie, gwiazdy NeuralMap, złoty TOST-portal, wybór specjalizacji.
- 🛡️ **06 — Strażnicy** (`scene_06_guardians.py`): 3 drony iFixAi (kule + zielono-cyjanowy glow) patrolują bramy + `Guardian_Respawn` (TargetPoint przy konsoli) + `Guardian_TeleZone` (granica). Filozofia: brak damage — przekroczenie = łagodna teleportacja do Respawn. SKRYPT GOTOWY — uruchom w UE. ⚠ **06b (raz, ręcznie):** w Level Blueprint zepnij `OnActorBeginOverlap(Guardian_TeleZone)` → `SetActorLocation(OtherActor → Guardian_Respawn)`.

## ⚡ Jeden klik = cała Katedra
`build_all_genesis.py` odpala wszystkie warstwy 01→06 po kolei (idempotentnie, `try/except`
per scena + raport) i na końcu **strojenie świateł** (`fix_lights_vsm.py`). Narzędzia → Wykonaj
skrypt → `build_all_genesis.py`. Do rekonstrukcji świata po reset/nowy poziom.

## 💡 Pułapka VSM — „za dużo świateł" (fix `fix_lights_vsm.py`)
Wiele lokalnych świateł **rzucających cień** nakłada się → Virtual Shadow Maps przepełnia
single-pass (ostrzeżenie `[VSM] Przepełnienie...`) + przepalony obraz. FIX: dekoracyjne światła
nie potrzebują dynamicznego cienia → `fix_lights_vsm.py` ustawia `cast_shadows=False` na wszystkich
PointLight/SpotLight + przycina skrajne intensity/radius. Cień rzuca tylko DirectionalLight.
Wbudowane w `build_all_genesis` (krok 99) i `story_compiler` (na końcu). Można puszczać samodzielnie. Ręczne wiązania BP **04b** (overlap→Play wrót) i **06b**
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

## 🎬 REŻYSER — gra = Film = opowieść (Etap I)
Warstwa kompozycji NAD pojedynczymi scenami: użytkownik składa film ze **scen i ujęć**
w Katedrze (TeO Arcade Forge → panel Reżyser), eksportuje JEDEN manifest, wrzuca do UE.
- **UI:** `components/special/RezyserView.tsx` (w `TeoArcadeForge.tsx`). Format: `lib/storyManifest.ts`.
- **Most:** `POST /api/forge/story` (zapis do `stories/`), `GET /api/forge/stories`, `GET /api/forge/plugins`. ⚠ restart mostu.
- **Kompilator:** `ue_scripts/story_compiler.py` — czyta najnowszy `stories/*.json`, stawia środowiska
  (schron/atrium/aether/pusto), woła wtyczki, buduje `Cine_Story` (cięcia kamer, auto_play) = HYBRYDA film→gra.
  Uruchom: Narzędzia → Wykonaj skrypt → `story_compiler.py`. ⚠ oddanie sterowania graczowi = ręczny 1 węzeł BP (On Finished → Set View Target).
- **Wtyczki/mody:** `forge_plugins/` — kontrakt `_PLUGIN_API.md` (`apply(ctx, params)`), przykłady `rain_neon.py`, `floating_props.py`.
- **Etap II — generator modów (✅ część a):** `POST /api/forge/plugin` (Ollama pisze wtyczkę wg kontraktu → zapis do `forge_plugins/`),
  panel „🔌 Stwórz mod" w `RezyserView.tsx` (opis + nazwa → generuj → mod pojawia się jako chip do wpięcia). ⚠ restart mostu + Ollama.
- **Etap II — mody za GRV (✅ część b):** `POST /api/forge/mod/publish` (kod modu wędruje W PRODUKCIE payload — suwerennie),
  `POST /api/forge/mod/install` (zapis do `forge_plugins/`, **Tarcza Prawdy skanuje kod** przed zapisem — blokuje sabotaż/eval).
  RezyserView: wiersz „🏷️ wystaw → do Marketplace". `Marketplace.tsx` `buy()`: po zakupie modu (type=mod) auto-instalacja.
  TODO: TOP10/głosy dla modów (działa przez istniejący rynek), hash-chain autentyczności modu (Skaner) — na potem.

## 🏝️ Portale GRV — szklane tafle = okna na wyspy (etap 1: podpisy)
`scene_portals_grv.py` pobiera z mostu `GET /api/islands/random` (slot 1 = OtakOS kanon, 2-4 = losowe
węzły z księgi GRV jako wyspy; format deterministyczny z id) i podpisuje 4 tafle `Atrium_Pane_*`
(`Portal_GRV_1..4`, zwrócone do środka, złoto=OtakOS / cyjan=wyspa / szarość=pusta). Most offline →
etykieta „portal offline". Wymaga `scene_03c_glass.py` + działającego mostu. Wpięte w `build_all` (krok 07).
**Następny etap (roadmap):** dynamiczne miniatury (RenderTarget/UMG) + teleport pierścieniem. Patrz `wyspa-roadmap`.

## Konwencja etykiet (by wszystko się spinało)
`Sun_*`, `Neon_*`, `Title_*`, `Desk_*`, `Terminal_*`, `Gate_*`, `Aether_*`, `Guardian_*`, `Cine_*`, `Atrium_Pane_*`, `Seq_Intro_Actor`, `M_Glass_*`.
Reżyser: `Env_<scena>_*` (środowiska), `Cine_<scena>_<ujęcie>` (kamery), `Cap_<scena>_<ujęcie>` (podpisy), `Plugin_<id>_<scena>_*` (wtyczki), `Seq_Story_Actor`.
Portale: `Portal_GRV_1..4` (podpisy na taflach `Atrium_Pane_*`).
