# 🎮 RUNBOOK — jak odpalić i ZAGRAĆ to, co mamy

Dwie warstwy: **A) Katedra (apka)** — panel sterowania (Reżyser, Forge, Co-Bot, Stocznia, portale, baza).
**B) Świat UE** — grywalny poziom budowany skryptami. Niżej: jak każdą odpalić i jak w to zagrać.

---

## A) Katedra (apka React + most + Ollama) — działa W PRZEGLĄDARCE, LOKALNIE
To tu klikasz Reżysera, Co-Bota, Stocznię, „Zasil Wyspę", generujesz mody.

1. **Ollama** uruchomiona (`:11434`), model `gemma4` pobrany.
2. **Most:** `node wiesio-bridge.js` (port `:3001`). ⚠ Po zmianach mostu RESTART.
3. **Apka:** `npm run dev` → otwórz `http://localhost:5176` (albo `Start_OtakOS.bat` robi 1-3 naraz).
4. Klikasz w przeglądarce: Game Forge → Reżyser / Co-Bot / Stocznia / Zasil Wyspę.

> Część UI jest też na **otakos.wtf**, ALE funkcje na żywo (Reżyser→UE, Co-Bot→Ollama, skan katalogu,
> portale z księgi GRV) wymagają LOKALNEGO mostu + Ollamy + UE. Web pokazuje interfejs; moc jest lokalna (suwerennie).

---

## B) Świat UE — zbuduj i wejdź

### Raz, na początku
- UE 5.8 otwarte, projekt **GENESIS_OVERRIDE**.
- Edycja → Wtyczki → włącz **„Python Editor Script Plugin"** → restart UE.
- **Most musi działać** (`node wiesio-bridge.js`) — skrypty portali/wyspy/stoczni pobierają dane z `:3001`.

### Zbuduj świat (Narzędzia → Wykonaj skrypt Pythona)
- **Całe demo GENESIS jednym kliknięciem:** `build_all_genesis.py` (01→07 + strojenie świateł).
- **Wyspa (z Reżysera):** w apce Reżyser → środowisko „🏝️ Wyspa" → Eksportuj film → w UE `story_compiler.py`.
- **Pojedynczo (Wyspa):** `scene_03c_glass.py` (tafle) → `scene_portals_grv.py` (okna na wyspy) →
  `scene_island_populate.py` (po skanie katalogu w „Zasil Wyspę") → `scene_shipyard.py` (stocznia + surowce).
- Jeśli UE marudzi „za dużo świateł" → `fix_lights_vsm.py` (już wpięte w build_all jako krok 99).

### 🛰️ Build HEADLESS — bez okna UE (oszczędza RAM/GPU)
Agent buduje świat, a UE liczy w tle BEZ GUI (`-nullrhi` = zero renderu). Nie musisz patrzeć —
operujesz słowem; grę włączasz wizualnie dopiero do testu.
- **Z apki:** Game Forge → „🛰️ Kuźnia Headless" → „Buduj świat headless" → „↻ Odśwież log".
- **Wymaga env:** `OTAKOS_UE_PATH` (UnrealEditor.exe; most użyje obok `UnrealEditor-Cmd.exe`),
  opcjonalnie `OTAKOS_UE_PROJECT` (.uproject) i `OTAKOS_UE_MAP` (ścieżka mapy, np. `/Game/FirstPerson/Maps/Lvl_FirstPerson`).
- **Ręcznie (fallback / dla agenta w terminalu):**
  `"...\UnrealEditor-Cmd.exe" "...\GENESIS_OVERRIDE.uproject" -run=pythonscript -script="...\ue_scripts\_headless_build.py" -unattended -nosplash -nullrhi -nopause -stdout`
- ⚠ BLIND-BUILD: headless ładowanie poziomu + komendlet zależą od projektu/UE 5.8. Log mówi wprost, co poszło;
  pewny fallback = build w otwartym edytorze (GUI). Cold start UE ~kilka minut.

### WEJDŹ DO GRY
- **Najprościej — w edytorze:** naciśnij **Play** (przycisk ▶ na górze) = grasz od razu, chodzisz po świecie.
- **Interakcje (raz, ręcznie — 1 węzeł w Level Blueprint każda):**
  - wrota: `OnActorBeginOverlap(Trigger_GateConsole)` → `Play(Seq_GateOpen_Actor)`
  - teleport strażników: `OnActorBeginOverlap(Guardian_TeleZone)` → `SetActorLocation(OtherActor → Guardian_Respawn)`
  - oddanie sterowania po intro: `Seq_Intro_Actor` „On Finished" → `Set View Target with Blend` na gracza.

---

## Jak ZAGRAĆ poza edytorem — lokal / web

### 🖥️ Lokalnie (standalone .exe — ZALECANE)
UE → **Platformy → Windows → Spakuj projekt** (Package Project). Powstaje folder z **.exe** — odpalasz grę
bez edytora, na swoim PC (i dystrybuujesz na USB). To najprostsza droga do „zagrać na lokalu".

### 🌐 W przeglądarce — UWAGA, nie jest to zwykły upload
UE5 **NIE eksportuje** już do HTML5/WebGL (Epic to usunął). Jedyna droga „UE w przeglądarce" to
**Pixel Streaming**: gra działa na SERWERZE z GPU (Twój PC albo chmura), a do przeglądarki leci tylko
WIDEO + sterowanie. Wymaga: spakowana gra z `-PixelStreaming` + Signalling Server (Epic dostarcza skrypty).
Czyli web-granie = strumień z maszyny z GPU, nie statyczny plik na hostingu.

> Alternatywa „natywny web" (lekka gra w przeglądarce bez serwera GPU) = przepisanie świata w silniku
> webowym (three.js / Babylon / PlayCanvas) — INNA ścieżka niż UE. Na teraz: lokalny .exe = gotowa droga,
> Pixel Streaming = web gdy chcesz pokazać online.

---

## Skrót decyzji
- **Chcę szybko pograć:** UE → Play (w edytorze).
- **Chcę grę jako program na PC / USB:** UE → Package → Windows → .exe.
- **Chcę pokazać w necie:** Pixel Streaming (serwer z GPU) — większy setup, osobny krok.
- **Panel (Reżyser/Co-Bot/Stocznia):** przeglądarka lokalnie (most + Ollama), część UI też na otakos.wtf.
