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
└── _AntiGravity_*/           # Katalogi danych runtime (wykluczone z TS)
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
| `/api/ollama/chat` | POST | Przekazuje wiadomości do lokalnego modelu Ollama |
| `/api/ollama/models` | GET | Lista dostępnych modeli LLM |
| `/api/music` | GET | Strumieniowanie plików audio z `_AntiGravity_Muzyka/` |
| `/api/music/list` | GET | Indeks biblioteki muzycznej |
| `/api/karaoke/sync` | POST | Transkrypcja audio przez Whisper.cpp → plik `.lrc` |
| `/api/graviton/mint` | POST | Rejestracja węzłów NodeAsset w `graviton_nodes.json` |
| `/api/graviton/nodes` | GET | Odczyt wszystkich zarejestrowanych węzłów Graviton |

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
5. **POST `/api/graviton/mint`** — zapis do `_AntiGravity_Build/graviton_nodes.json`
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

- Pliki audio muszą znajdować się w `_AntiGravity_Muzyka/` (lokalne)
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
mkdir _AntiGravity_Build
mkdir _AntiGravity_Muzyka
mkdir _AntiGravity_Wymiar
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

## Filozofia OtakOS

OtakOS to nie system operacyjny — to **filozofia suwerennego twórcy**. Każdy moduł systemu TeO Genesis jest zaprojektowany według zasad:

1. **Lokalność** — dane i AI działają lokalnie; chmura jest opcją, nie wymogiem
2. **Suwerenność** — użytkownik kontroluje swój klucz, tożsamość i dane
3. **Koherencja** — system monitoruje spójność wewnętrzną i eskaluje anomalie
4. **Wymiarowość** — interfejs operuje w "Wymiarze 0.00G" — przestrzeni zerowej grawitacji konwencji

---

*TeO Genesis © TeO STUDIO — Wszelkie prawa zastrzeżone przez Suwerena.*
