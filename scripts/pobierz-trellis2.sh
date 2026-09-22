#!/bin/bash
# 🗿 TRELLIS.2 (Microsoft) — obraz → siatka 3D z teksturą PBR. Silnik ASSETÓW dla gier.
#
# PO CO. Games Studio ma dostawać bryły do gier z tekstu i zdjęć (Suweren, 2026-09-22).
# Ścieżka: tekst → FLUX.2 klein (obraz obiektu na białym tle) → BiRefNet (tło precz)
# → TRELLIS.2 (struktura → kształt → tekstura) → GLB do _OtakOs_Apki/<gra>/public/assety/.
#
# ⚠️ DLACZEGO TRELLIS.2, NIE HUNYUAN3D-2: licencja Hunyuan (Tencent Community) mówi
# wprost „NOT use in EU, UK, South Korea" — Katedra stoi w Polsce. TRELLIS.2 jest MIT.
# Enkoder obrazu DINOv3 (Meta) ma własną licencję Meta; tu jest z paczki Comfy-Org.
#
# ⚠️ WYBÓR WARIANTU: int8 (5,25 GB) zamiast bf16 (10,3 GB). Karta ma 6 GB VRAM — bf16
# i tak leżałby w RAM-ie. Czas na golemie mierzony osobno (patrz Assety3D.js).
#
# Węzły: w rdzeniu ComfyUI od 0.35 (Trellis2Conditioning, Trellis2ShapeStage,
# VaeDecodeShapeTrellis, LoadBackgroundRemovalModel, SaveGLB). Żadnych cudzych węzłów.
# Katalog jest podpięty do ComfyUI junctionem (models/*/katedra-3d) — bez restartu.

set -e
# Uruchamiaj z katalogu wag: bash scripts/pobierz-trellis2.sh (kopia leży też w _OtakOs_AI/models/3d/)
cd "$(dirname "$0")/../_OtakOs_AI/models/3d"

TRELLIS=https://huggingface.co/Comfy-Org/TRELLIS.2/resolve/main
BIREF=https://huggingface.co/Comfy-Org/BiRefNet/resolve/main

mkdir -p clip_vision diffusion_models vae background_removal

pobierz() {  # url, plik docelowy — wznawialne, bez nadpisywania gotowych
    local url="$1" cel="$2"
    if [ -f "$cel" ] && [ ! -f "$cel.part" ]; then echo "✓ jest: $cel"; return; fi
    echo "⬇ $cel"
    curl -L --fail --retry 5 --retry-delay 10 -C - -o "$cel.part" "$url"
    mv "$cel.part" "$cel"
}

pobierz "$TRELLIS/clip_vision/dino_v3_vit_l.safetensors"            clip_vision/dino_v3_vit_l.safetensors
pobierz "$TRELLIS/diffusion_models/trellis_2_int8_convrot.safetensors" diffusion_models/trellis_2_int8_convrot.safetensors
pobierz "$TRELLIS/vae/trellis_2_shape_vae_bf16.safetensors"         vae/trellis_2_shape_vae_bf16.safetensors
pobierz "$TRELLIS/vae/trellis_2_texture_vae_bf16.safetensors"       vae/trellis_2_texture_vae_bf16.safetensors
pobierz "$BIREF/background_removal/birefnet.safetensors"            background_removal/birefnet.safetensors

echo "GOTOWE"; du -sh clip_vision diffusion_models vae background_removal
