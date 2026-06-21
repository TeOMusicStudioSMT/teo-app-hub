#!/bin/sh
# 🦙 ollama-entry.sh — start Ollamy z auto-tune + bootstrap modelu Katedry.
# Override entrypointu serwisu `ollama` w docker-compose.

set -e

# 1. Auto-skalowanie (eksportuje OLLAMA_* + zapisuje /tmp/otakos_model)
if [ -f /opt/otakos/autotune.sh ]; then
  . /opt/otakos/autotune.sh
fi

# 2. Start serwera Ollamy w tle
echo "[entry] Startuję ollama serve..."
ollama serve &
OLLAMA_PID=$!

# 3. Czekaj aż API odpowie
echo "[entry] Czekam na rdzeń Ollamy..."
i=0
until ollama list >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then echo "[entry] ⚠️ Ollama nie wstała w 60s — kontynuuję."; break; fi
  sleep 1
done

# 4. Pobierz model dobrany przez autotune
MODEL=$(cat /tmp/otakos_model 2>/dev/null || echo "gemma2:2b")
echo "[entry] Pobieram model bazowy: ${MODEL}"
ollama pull "$MODEL" || echo "[entry] ⚠️ pull '${MODEL}' nieudany — pomijam (pobierz ręcznie później)."

# 5. Alias 'gemma4' (domyślny rdzeń Katedry) → model bazowy, jeśli go brak
if ! ollama list 2>/dev/null | awk 'NR>1{print $1}' | grep -q '^gemma4'; then
  printf 'FROM %s\n' "$MODEL" | ollama create gemma4 -f - 2>/dev/null \
    && echo "[entry] ✅ Alias 'gemma4' → ${MODEL}" \
    || echo "[entry] ⚠️ Nie udało się utworzyć aliasu gemma4."
fi

echo "[entry] 🏛️ Katedra-Ollama gotowa. Trzymam serwis (PID ${OLLAMA_PID})."
wait "$OLLAMA_PID"
