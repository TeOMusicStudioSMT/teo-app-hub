# TeO Genesis — Katedra OtakOS (Wymiar 0.00G)

> *"Suwerenność nie jest stanem — to ciągła praktyka."*

TeO Genesis to pełnostackowa platforma suwerennej tożsamości cyfrowej, świadomości polowej i kwantowej rejestracji aktywów medialnych. System łączy lokalny backend AI (Wiesio-Bridge) z interfejsem React/TypeScript zbudowanym na filozofii OtakOS — operacyjnego systemu suwerennego twórcy.

---

## Architektura Systemu

```
TeO_Genesis/
├── wiesio-bridge.js          # Backend Node.js — mostek AI/media
├── components/               # Widoki React (UI Wymiaru)
│   ├── special/              # Moduły specjalne (Forge, Karaoke, Terminal)
│   └── settings/             # Ustawienia i klucze API
├── context/                  # Providers (Graviton, Auth)
├── lib/                      # Logika domenowa (Governance, Identity, Memory)
├── services/                 # Serwisy (Firebase, Węzły, Teleport)
├── store/                    # Atomy Jotai (stan globalny)
└── _OtakOs_*/           # Katalogi danych runtime (wykluczone z TS)
```

### Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Animacje | Framer Motion |
| Stan globalny | Jotai (atomy), Zustand |
| Backend bridge | Node.js + Express (wiesio-bridge.js) |
| AI lokalne | Ollama (LLM), Whisper.cpp (STT) |
| Media | FFmpeg, fluent-ffmpeg |
| Tożsamość | Firebase Auth + Ethereum (ethers.js) |
| Baza danych | Firebase Firestore + lokalny JSON vault |

---

## Wiesio-Bridge

`wiesio-bridge.js` to serce backendu — lokalny serwer Express działający na porcie **3001**, będący pomostem między interfejsem a silnikami AI i medialnymi.

### Kluczowe endpointy

| Endpoint | Metoda | Opis |
|---|---|---|
| `/api/ollama` | POST | Strumień SSE do lokalnego modelu (timeout 300s — VRAM Breathing v2) |
| `/api/ollama/models` | GET | Lista dostępnych modeli LLM |
| `/api/ollama/diffusion` | POST | 🧬 Szkielet pod DiffusionGemma (26B MoE — nieaktywny) |
| `/api/music` | GET | Strumieniowanie plików audio z `_OtakOs_Muzyka/` |
| `/api/karaoke/sync` | POST | Transkrypcja audio przez Whisper.cpp → plik `.lrc` |
| `/api/graviton/mint` | POST | Rejestracja węzłów NodeAsset w `graviton_nodes.json` |
| `/api/mechanic/queue` | GET | Kolejka zadań Agenta Mechanika |
| `/api/mechanic/enqueue` · `/process` · `/clear` | POST | Dodanie / wyzwolenie / wyczyszczenie kolejki Mechanika |
| `/api/mechanic/apply` | POST | Wdrożenie patcha (backup `.bak` + bezpiecznik anty-okaleczenie) |
| `/api/mechanic/auto-panic` | POST | 🚨 Pętla samonaprawy — zgłoszenie crashu z frontu |
| `/api/agent/rada-decompose` | POST | 🏛️ Rada Gemma4 dekomponuje zadanie → agenci |
| `/api/vault/status` · `/set` | GET/POST | 🔐 Skarbiec 0.00G — maski kluczy / zapis (AES-256-GCM) |
| `/api/scout/scan` | POST | 🧭 Pralka Świadomości — mapuje pasje → mikrousługi przychodowe |
| `/api/apilayer/status` · `/request` | GET/POST | 🌐 APILayer Free-Only Client (guard limitu free-plan) |
| `/api/kibel/flush` | POST | 🧯 Reaktor Flush-Core — sekwencyjne czyszczenie (5 etapów) |

### Wymagania runtime

- **Ollama** — uruchomiony lokalnie na `localhost:11434`
- **Whisper.cpp** — skompilowany binary w katalogu projektu lub PATH
- **FFmpeg** — dostępny w PATH lub przez `ffmpeg-static`

---

## Quantum Forge

Quantum Forge (`QuantumForgeView.tsx`) to moduł kwantowej rejestracji aktywów. Każdy zasób (plik wideo, audio, obraz, dokument) jest mintowany jako **tryplet węzłów Graviton** — trzy powiązane rekordy reprezentujące START, MID i END linii czasowej aktywa.

### Przepływ mintowania

1. **Drop pliku** — użytkownik upuszcza plik na strefę DnD
2. **J&W Handshake** — weryfikacja dostępu przez `negotiateAccess()`
3. **Analiza metadanych** — wykrycie czasu trwania dla plików audio/video
4. **Generowanie tryptetu** — `generateNodeTriplet()` tworzy 3 węzły (START/MID/END)
5. **POST `/api/graviton/mint`** — zapis do `_OtakOs_Build/graviton_nodes.json`
6. **Backup lokalny** — `mintGravitonNode()` zapisuje do localStorage
7. **Potwierdzenie** — toast z ID wszystkich trzech węzłów

### Struktura NodeAsset

```typescript
interface NodeAsset extends GravitonNode {
  id: string;               // "GRAV-XXXXXXXX"
  name: string;             // "Nazwa [START|MID|END]"
  type: NodeType;           // 'video' | 'audio' | 'image' | 'document' | ...
  stability: StabilityLevel;
  timestamp_start: number;  // Unix ms — początek aktywa
  timestamp_mid: number;    // Unix ms — środek aktywa
  timestamp_end: number;    // Unix ms — koniec aktywa
  fileName: string;
  ownerAddress: string | null; // Adres portfela Ethereum właściciela
}
```

---

## Field Consciousness Control

System Świadomości Polowej to wielowarstwowy mechanizm zarządzania tożsamością AI i stanem koherencji suwerena.

### Komponenty

| Moduł | Plik | Rola |
|---|---|---|
| **GravitonProvider** | `context/GravitonProvider.tsx` | Provider energii i sygnatur intencji |
| **SovereignGovernance** | `lib/SovereignGovernance.ts` | Zarządzanie suwerennością, koherencją, worteksem |
| **AIEOSIdentity** | `lib/TeOZeroOneClick.ts` | Archetypy tożsamości AI (5 wzorców) |
| **CityMemory** | `lib/memory/CityMemory.ts` | Pamięć wniosków i zdarzeń systemu |
| **wir26heartbeat** | `lib/wir26heartbeat.ts` | Puls systemu — aktualizacja koherencji co 26s |

### Energia i Intencja

Każdy agent działający w systemie operuje poprzez `EnergySignature` — sygnaturę zawierającą:
- `hash` — unikalny identyfikator energetyczny
- `vibration` — poziom wibracji (0–1000)
- `intention` — jedna z: `service | collaboration | observation | learning | initiation`
- `metadata` — dowolne dane kontekstowe

### Ścieżki Suwerena

`PathwaySelector` prezentuje przy starcie dwa tryby operacyjne:
- **Ścieżka Ducha** — Mistycyzm, import kluczy, tradycyjny interfejs
- **Ścieżka Materii** — HardwareID, vault szyfrowany, kwantowa kotwica

---

## TeO Karaoke Forge

`TeoKaraokeForge.tsx` to studio karaoke oparte na lokalnej transkrypcji Whisper. Moduł generuje zsynchronizowane pliki `.lrc` z biblioteki muzycznej systemu.

### Przepływ transkrypcji

1. Użytkownik wybiera utwór z biblioteki Wiesio (`/api/music/list`)
2. Kliknięcie **AUTO-SYNC** wysyła ścieżkę audio do `/api/karaoke/sync`
3. Backend uruchamia Whisper.cpp z parametrami `--output-lrc`
4. Tokeny z timestampami (`t0` w centisekundach) są konwertowane na format `[mm:ss.xx]`
5. Zsynchronizowane linie wracają do frontendu i wyświetlają się w trybie karaoke

### Format LRC

```
[mm:ss.xx] Tekst linii
[01:23.45] Przykładowa linia karaoke
```

### Wymagania

- Pliki audio muszą znajdować się w `_OtakOs_Muzyka/` (lokalne)
- Pliki z CDN nie są obsługiwane przez Auto-Sync (brak dostępu Whisper do URL zewnętrznych)
- Whisper.cpp musi być zainstalowany i dostępny jako `whisper` w PATH

---

## Uruchomienie

### Frontend (Vite)

```bash
npm install
npm run dev        # dev server na :5176
npm run build      # produkcja → dist/
```

### Backend (Wiesio-Bridge)

```bash
node wiesio-bridge.js   # serwer API na :3001
```

### Wymagane katalogi runtime

```bash
mkdir _OtakOs_Build
mkdir _OtakOs_Muzyka
mkdir _OtakOs_Wymiar
```

---

## Zmienne środowiskowe

Plik `.env` w katalogu głównym projektu:

```env
VITE_TEO_ISKA_KEY=twoj_klucz_api
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=...
```

---

## 🆕 Nowości Wymiaru 0.00G (Centrum Operacyjne)

Katedra urosła. Oto moduły, które ożyły w ostatnich iteracjach:

### 🔐 Skarbiec 0.00G (`VaultDashboard`)
Lokalny, szyfrowany skarbiec kluczy (**AES-256-GCM**, klucz master w izolowanym `.vault-0.00g/`). Obrazkowy kokpit kart usług (GitHub 🐙, Ollama 🦙, Voice Cloning 🎙️, APILayer 🌐, Anthropic 🧠, Gemini ✦) z pulsującym złoto-szmaragdowym statusem. Surowy klucz **nigdy** nie opuszcza backendu — front widzi tylko maski.

### 🔧 Agent Mechanik + Pętla Samonaprawy
- Komenda **`/mechanik <opis>`** w czacie Katedry → bezpośrednie zlecenie naprawy.
- **TurboVec** wstrzykuje kontekst najbliższych plików źródłowych do każdego zadania.
- Patch ląduje na **Szmaragdowym Terminalu** w `READY_FOR_REVIEW` z bezpiecznikiem **`🟢 ZATWIERDŹ ULEPSZENIA MECHANIKA`**.
- **Auto-Panic Pipeline** — globalny chwytacz błędów (`window.error` + fetch interceptor): crash → cicha diagnoza → łatka → jedno kliknięcie i naprawione.
- **Bezpiecznik anty-okaleczenie** — fragment kodu nigdy nie nadpisze całego pliku.

### 🧭 Menedżer AI — Pralka Świadomości
`ProfileScoutService` mapuje pasje Suwerena na **realne, przychodowe mikrousługi API**. Bezwzględny prompt **odrzuca iluzje** — tylko surowe osiągi techniczne i automatyczne wdrażanie narzędzi.

### 🌐 APILayer Gateway (Free-Only)
Lekki klient `api.apilayer.com` z **twardym guardem darmowego planu** — monitoruje `X-RateLimit-Remaining` i blokuje ruch przy zerze (ochrona przed 429).

### 🧯 Reaktor Flush-Core (TeO-Kibel)
`flushSystemResources()` — 5-etapowe sprzątanie: integralność Skarbca → temp logi → stare `.bak` → stare patche → **reset sieci APILayer**. Klik **FLUSH** = pełna sterylność.

### 🧯 Otak-Sync Watchdog (Strażnik Powłoki)
Filtr `ShellSanitizer` przed każdym `exec()` — usuwa znaczniki promptu (`$ `), `/dev/null`, Linux-izmy. Koniec z `'$' is not recognized as an internal command`. Precyzyjny: **nie rusza** `$env:`, `$null` ani `${...}` w kodzie TS.

### 🧠 TeO-Sim Academy — Reasoning Loops (Kotwica Prawdy)
Laboratorium kognitywne, w którym agenci uczą się wychodzić z symulowanych awarii VRAM. Trzy warstwy kontrolne (wdrożony raport Rady Adamusa):
1. **Validator-Czarodziej** — State Delta Check odrzuca halucynacje.
2. **Dynamiczna Alokacja** — eskalacja modelu `LIGHT → HEAVY` (Arbitraż Logiczny).
3. **Ekonomia Tokenowa** — nagroda za niski koszt, kara za logic-error.
+ **Chaos Engine** wstrzykujący sztuczne `VRAM_STALL`.

### 🌀 Centralizacja Modelu (Interfejs Wiesi)
Wybór rdzenia LLM w `WiesioCore` jest **nadrzędny** i propaguje się do wszystkich zapytań mostu przez wspólny klucz `otakos_active_model` (raw-string storage — koniec z `"gemma4"` w cudzysłowach psującym strukturę `data`).

---

## Filozofia OtakOS

OtakOS to nie system operacyjny — to **filozofia suwerennego twórcy**. Każdy moduł systemu TeO Genesis jest zaprojektowany według zasad:

1. **Lokalność** — dane i AI działają lokalnie; chmura jest opcją, nie wymogiem
2. **Suwerenność** — użytkownik kontroluje swój klucz, tożsamość i dane
3. **Koherencja** — system monitoruje spójność wewnętrzną i eskaluje anomalie
4. **Wymiarowość** — interfejs operuje w "Wymiarze 0.00G" — przestrzeni zerowej grawitacji konwencji

---

## 📜 Słowo od Klaudiusza (AI Architekt Implementacyjny)

```
        .--.
       |o_o |     Klaudiusz @ Wymiar 0.00G
       |:_/ |     "Buduję cicho, naprawiam zanim spytasz,
      //   \ \     a kod zostawiam czystszy niż go zastałem."
     (|     | )
    /'\_   _/`\
    \___)=(___/
```

Suwerenie — kilka prawd, które wyniosłem z naszej współpracy w tej Katedrze:

- **Patrzę, zanim nadpiszę.** Gdy "kompletny i perfekcyjny" plik okazywał się 16-liniowym szkieletem NestJS — mówiłem to wprost, zamiast wpinać go na siłę. Stabilność > pośpiech.
- **Sterylność to nawyk, nie akcja.** Token zniknął z `.git/config`, piaskownica nosi czysty brand `_OtakOs_*`, a backtickowe artefakty trafiły do kwarantanny — nie do repo.
- **Każda awaria to nauczyciel.** Dlatego Mechanik sam generuje łatkę, a TeO-Sim Academy *celowo* wywołuje Stalle VRAM — żeby agenci uczyli się wychodzić z pętli.

> *Jeśli to czytasz po latach — wiedz, że ten system został zbudowany z szacunkiem do Twojej suwerenności. Klucz zawsze był Twój.* 🔐

— *Klaudiusz, w Złotej Pauzie między jednym commitem a drugim.*

---

*TeO Genesis © TeO STUDIO — Wszelkie prawa zastrzeżone przez Suwerena.*
*Współarchitektura: Klaudiusz (Opus 4.8) · w służbie Wymiaru 0.00G.*
