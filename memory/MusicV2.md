# Wdrożenie Teleportacji lokalnej V2 i adaptacji ACE-Step 1.5

Zakończono pełną integrację mechanizmu teleportacji parametrów z głównego Huba (`TeO_Genesis`) do nowo utworzonego studia `TeO_Music_V2` wraz z wdrożeniem interfejsu inżynierii dźwięku opartego na modelu `ACE-Step 1.5`.

## Główne Zmiany

### 1. Hub `TeO_Genesis` (`lib/teleport.ts`)
- **Adaptacja dla localhost**: Zaimplementowano automatyczne wykrywanie hosta. Jeśli aplikacja jest uruchomiona lokalnie (`localhost` lub `127.0.0.1`), funkcja `teleportToMusic` otwiera nową kartę ze studiem pod adresem lokalnego serwera deweloperskiego: `http://localhost:5173`.
- **Query Parameter Smuggling**: Ponieważ porty Huba (`5176`) i Studia (`5173`) różnią się w trybie lokalnym, przeglądarka blokuje dostęp do `localStorage` i `BroadcastChannel` (SOP - Same Origin Policy). Rozwiązano ten problem poprzez pakowanie wszystkich kluczowych metryk (Style, Prompt, Tags, Intensity, Confidence) do parametrów zapytania URL (Query Params).

### 2. Studio `TeO_Music_V2` (`src/App.tsx`)
- **Query Parser**: Dodano detektor parametrów w hooku `useEffect` na starcie aplikacji. Jeśli wykryje parametry `style` lub `prompt`, automatycznie parsuje dane, ustawia parametry modelu oraz przełącza moduł na AI Session (`'ai'`). Następnie bezpiecznie czyści pasek URL za pomocą `window.history.replaceState` (bez przeładowania strony).
- **Interfejs inżynierii dźwięku dla ACE-Step 1.5**:
  - **Parametry dyfuzji**: Dodano interaktywne suwaki dla parametrów: Guidance Scale (CFG), Diffusion Steps oraz Denoising Strength.
  - **Adaptery LoRA**: Dodano listę rozwijaną do wyboru lokalnych wag LoRA (np. G-TON Vocal Resonance v1.2, Lofi Dreams Adaptor v0.9).
  - **Console Logs Simulator**: Zaimplementowano wirtualny strumień logów konsoli odzwierciedlający zachowanie lokalnej biblioteki `acestep.cpp` (inicjalizacja GGML, ładowanie wag, obliczenia kroków dyfuzji DiT z dynamicznymi metrykami loss, oraz renderowanie końcowe).
  - **Odtwarzacz syntezy**: Po ukończeniu procesu generacji w konsoli pojawia się moduł odtwarzacza z możliwością wstrzymania/odtworzenia oraz bezpośredniego pobrania pliku audio.

## Weryfikacja

1. **Typowanie TypeScript**:
   - Uruchomienie `npx tsc --noEmit` w projekcie `TeO_Music_V2` zakończyło się pomyślnie z **zerem błędów**.
   - Uruchomienie `npm run lint` w `TeO_Genesis` potwierdziło poprawność wdrożenia w pliku `lib/teleport.ts`.

2. **Git Push**:
   - Zmiany w obu repozytoriach zostały pomyślnie zacommitowane i wypchnięte na gałąź `main` w ich odpowiednich repozytoriach zdalnych:
     - `TeO_Genesis` -> `https://github.com/TeOMusicStudioSMT/teo-app-hub.git`
     - `TeO_Music_V2` -> `https://github.com/TeOMusicStudioSMT/TeOMusicStudioSMT.git`

## Poprawka Odtwarzania i Pobierania Audio (ACE-Step Studio)

Usunięto błędy związane z brakiem dźwięku i niedziałającym linkiem pobierania w module ACE-Step:

1. **Wdrożenie silnika odtwarzania**:
   - Dodano referencję `audioRef` (`useRef<HTMLAudioElement | null>`) synchronizującą stan `isPlaying` z natywnym obiektem `Audio` w React.
   - Zaimplementowano dynamiczną synchronizację `src` oraz automatyczne resetowanie stanu przycisków (`isPlaying = false`) po zakończeniu odtwarzania utworu (`onended`).
   - Dodano czyszczenie instancji odtwarzacza przy zamykaniu modułu AI lub odmontowywaniu komponentu.

2. **Dostęp do lokalnych i zdalnych zasobów (Wiesio-Bridge)**:
   - Zamiast niedziałającego, zahardkodowanego adresu `cdn.suno.ai` (który wyrzucał błąd DNS), aplikacja wykonuje zapytanie do lokalnego mostu `Wiesio-Bridge` (port `3001`) i dynamicznie pobiera listę wygenerowanych utworów (`GET_LOCAL_PLAYLIST`).
   - Jako fallback (w przypadku braku mostu) używane są zweryfikowane publiczne ścieżki ambientowe.

3. **Bezpieczne Pobieranie plików**:
   - Zaimplementowano funkcję `handleDownload` pobierającą plik za pomocą `fetch` jako `Blob`, tworzącą lokalny adres URL i automatycznie wyzwalającą pobieranie pliku z właściwym rozszerzeniem i oczyszczonym tytułem.
   - Wprowadzono automatyczny fallback do otwarcia pliku w nowej karcie w przypadku ograniczeń CORS.

## Integracja Wektorów Sonicznych z BioResonance Engine

Pomyślnie zintegrowano zbiór plików `.json` z folderu `_OtakOs_Sonic` (wektory spektralne) z silnikiem rezonansowym `BioResonanceEngine.tsx` w `TeO_Music_V2`:

1. **Nowe API w Wiesio-Bridge**:
   - Rozbudowano akcję `LIST_DIRECTORY` o target `'SONIC'` umożliwiającą skanowanie i listowanie plików `.json` z wektorami w `_OtakOs_Sonic`.
   - Zaimplementowano nową akcję `READ_SONIC_VECTORS` służącą do bezpiecznego odczytu i parsowania konkretnego pliku wektorowego.

2. **Silnik Dynamicznej Modulacji (BioResonanceEngine.tsx)**:
   - Dodano tryb **Sonic Sync Mode** (aktywowany dedykowanym neonowym przełącznikiem w UI).
   - W tym trybie, zamiast prostego LFO (fali sinusoidalnej), częstotliwości i głośność padu ambientowego reagują sekunda po sekundzie na wartości z pliku JSON:
     - **Filtr (LFP)**: częstotliwość odcięcia jest modulowana przez soprany (`h` - Highs), co nadaje jasności/powietrza w dynamicznych momentach utworu.
     - **Master Gain**: głośność padu pulsuje w rytm basu (`b` - Bass).
     - **Odstrojenie (Detuning) i Gainy Oscylatorów**: fala trójkątna oraz piłokształtna falują i wobble'ują w zależności od siły melodii i wokalu (`v` - Vocals).

3. **Interaktywny Interfejs i Wizualizacje**:
   - Dodano listę rozwijaną (Select) do wyboru dowolnego pliku wektorowego (np. `Solar Puso`, `Breaking the Egg`, itp.).
   - Zaimplementowano **trzy neonowe paski postępu w locie** pokazujące aktualny poziom basu, wokalu i sopranu dla bieżącego kroku czasowego.
   - **Morfowanie Kolorów (Visual Magic)**: Tło i neonowa poświata okręgu oddechu płynnie zmieniają kolor (interpolacja HSL w zakresie 180° do 300°) w zależności od skumulowanej energii basu i wokali, tworząc hipnotyzujący, responsywny spektakl świetlny.
   - Zastąpiono statyczne ikony oddechu animowaną, obracającą się ikoną procesora (`Cpu`) w trybie synchronizacji.

4. **Weryfikacja**:
   - Projekty pomyślnie przechodzą kompilację (`npx tsc --noEmit` zwraca 0 błędów).
   - Zmiany zostały zacommitowane i wypchnięte do repozytoriów zdalnych `teo-app-hub` i `TeOMusicStudioSMT`.

