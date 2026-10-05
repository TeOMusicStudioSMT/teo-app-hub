"""
🧊 Mapa głębi kadru w Pythonie Katedry (services/GlebiaKadru.js → szacujPythonem).

DLACZEGO PYTHON (Suweren 2026-10-05): ONNX Runtime pod Node na Windows 11 padał kodem 0xC06D007F — Windows podsuwa
własny, starszy C:\\Windows\\System32\\onnxruntime.dll zamiast tego z paczki. Python ładuje biblioteki rozszerzeń z ich
własnego katalogu, a środowisko silnika głosu Katedry (Chatterbox) ma już torch + transformers — i kartę graficzną.

Model: Depth Anything V2 Small (Apache-2.0), `depth-anything/Depth-Anything-V2-Small-hf` (OTAKOS_GLEBIA_MODEL_PY).
Wejście (argv[1] = JSON): {"obraz", "model", "wyjscie"}. Wyjście: plik `wyjscie` = surowe bajty głębi 0–255
(jasne = blisko) w rozdzielczości modelu; stdout = {"szer", "wys", "urzadzenie"}.
"""

import json
import sys


def main():
    a = json.loads(sys.argv[1])
    import numpy as np
    import torch
    from transformers import pipeline

    gpu = bool(torch.cuda.is_available())
    potok = pipeline("depth-estimation", model=a["model"], device="cuda" if gpu else "cpu")
    wynik = potok(a["obraz"])
    # Surowa dysparycja, a gdy wersja transformers jej nie oddaje — obraz głębi (też jasne = blisko).
    d = wynik.get("predicted_depth") if hasattr(wynik, "get") else None
    if d is None:
        d = np.asarray(wynik["depth"], dtype="float32")
    d = d.detach().float().cpu().numpy() if hasattr(d, "detach") else np.asarray(d, dtype="float32")
    d = np.squeeze(d)
    if d.ndim != 2:
        raise ValueError(f"model oddał głębię o kształcie {d.shape}, a nie (wys, szer)")
    lo, hi = float(d.min()), float(d.max())
    bajty = np.round((d - lo) / ((hi - lo) or 1.0) * 255.0).astype("uint8")
    with open(a["wyjscie"], "wb") as f:
        f.write(bajty.tobytes())
    sys.stdout.write(json.dumps({"szer": int(bajty.shape[1]), "wys": int(bajty.shape[0]), "urzadzenie": "cuda" if gpu else "cpu"}))


if __name__ == "__main__":
    main()
