#!/bin/sh
# 🎚️ autotune.sh — auto-skalowanie Ollamy pod maszynę (CPU / RAM / GPU / model).
# Sourcowany przez ollama-entry.sh PRZED `ollama serve`. POSIX sh.

CORES=$(nproc 2>/dev/null || echo 2)
RAM_KB=$(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 4194304)
RAM_GB=$(( RAM_KB / 1024 / 1024 ))

# Równoległość zapytań wg liczby rdzeni
if   [ "$CORES" -ge 16 ]; then PAR=4
elif [ "$CORES" -ge 8 ];  then PAR=2
else                           PAR=1
fi

# Liczba jednocześnie załadowanych modeli wg RAM
if   [ "$RAM_GB" -ge 32 ]; then LOADED=3
elif [ "$RAM_GB" -ge 16 ]; then LOADED=2
else                            LOADED=1
fi

# Wykrycie GPU (NVIDIA)
GPU=0
if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then GPU=1; fi

# Dobór domyślnego modelu do pojemności maszyny (lub wymuszenie przez OTAKOS_MODEL)
if   [ -n "$OTAKOS_MODEL" ];                       then MODEL="$OTAKOS_MODEL"
elif [ "$GPU" = 1 ] || [ "$RAM_GB" -ge 16 ];       then MODEL="gemma2:9b"
elif [ "$RAM_GB" -ge 8 ];                          then MODEL="gemma2:2b"
else                                                    MODEL="qwen2.5:1.5b"
fi

export OLLAMA_NUM_PARALLEL="$PAR"
export OLLAMA_MAX_LOADED_MODELS="$LOADED"
export OLLAMA_KEEP_ALIVE="10m"
echo "$MODEL" > /tmp/otakos_model

echo "[autotune] CPU=${CORES} RAM=${RAM_GB}GB GPU=${GPU} -> PAR=${PAR} LOADED=${LOADED} MODEL=${MODEL}"
