# 🏛️ Katedra OtakOS — obraz przenośny (Live-USB)

Pełne zamknięcie Katedry: **Frontend + Wiesio-Bridge + Ollama** w jednym, przenośnym
stacku Docker z persystencją na pendrive i auto-skalowaniem pod maszynę.

## Architektura

| Serwis | Obraz / Stage | Port | Rola |
|---|---|---|---|
| `ollama` | `ollama/ollama` | 11434 | Lokalny rdzeń AI (GPU/CPU auto) |
| `bridge` | `Dockerfile` target `bridge` | 3001 | Wiesio-Bridge (API, media, Mechanik) |
| `web` | `Dockerfile` target `web` | 8080 | Statyczny frontend (nginx) |

Przeglądarka na hoście → `http://localhost:8080` (app) → woła `localhost:3001` (most)
→ most woła `ollama:11434` (przez sieć compose, `OLLAMA_HOST`).

## Wymagania
- Docker Engine + Docker Compose v2.
- (Opcjonalnie) GPU NVIDIA + `nvidia-container-toolkit` dla akceleracji VRAM.

## Uruchomienie

```bash
# CPU (działa na każdej maszynie):
docker compose up -d --build

# Z GPU (NVIDIA):
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

Otwórz **http://localhost:8080**. Pierwszy start pobiera model (autotune dobiera
rozmiar do RAM/GPU) i tworzy alias `gemma4` — domyślny rdzeń Katedry.

## 🎚️ Auto-skalowanie (VRAM / CPU)
`docker/autotune.sh` przy starcie wykrywa maszynę i dostraja Ollamę:
- **GPU** → użyty automatycznie (gdy dostępny przez nakładkę GPU); inaczej **CPU**.
- **Rdzenie** → `OLLAMA_NUM_PARALLEL` (1 / 2 / 4).
- **RAM** → `OLLAMA_MAX_LOADED_MODELS` (1 / 2 / 3) + dobór modelu:
  - `< 8 GB` → `qwen2.5:1.5b` · `8–16 GB` → `gemma2:2b` · `≥ 16 GB lub GPU` → `gemma2:9b`.
- Wymuszenie modelu: `OTAKOS_MODEL=llama3.1:8b docker compose up -d`.

## 💾 Persystencja (Live-USB)
Wszystkie dane lądują w `./data/` (przenoś z pendrive'em):
- `data/ollama` — pobrane modele.
- `data/wymiar` — kolejka Mechanika, patche, knowledge graph.
- `data/vault` — zaszyfrowane klucze (AES-256-GCM).
- `data/muzyka`, `data/move` — biblioteki mediów.

## Klucze chmurowe (opcjonalnie)
```bash
VITE_GEMINI_API_KEY=AIza... docker compose up -d --build
```
Klucze Anthropic/Gemini można też wrzucić w UI przez 🔐 Skarbiec (most je szyfruje).

## Operacje
```bash
docker compose logs -f bridge      # logi mostu
docker compose logs -f ollama      # logi rdzenia + autotune
docker compose down                # zatrzymanie (dane zostają w ./data)
docker exec -it katedra-ollama ollama pull gemma4   # ręczne pobranie modelu
```

## Uwagi
- Frontend woła most pod `127.0.0.1:3001` — działa, bo przeglądarka jest na hoście,
  a port mostu jest opublikowany. Dla zdalnego dostępu dodaj reverse-proxy.
- Most czyta adres Ollamy z `OLLAMA_HOST` (fallback `127.0.0.1:11434` — dev bez zmian).
