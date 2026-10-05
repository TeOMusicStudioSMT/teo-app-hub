"""
👄 Pobieranie silnika ust (services/UstaAktorow.js → instaluj, krok „pliki”).

Co i skąd (każde z licencją pozwalającą na użycie komercyjne):
  • kod MuseTalk (MIT, Tencent Music) — zip przypiętego commita z GitHuba → <katalog>/MuseTalk
  • wagi MuseTalk V1.5 (TMElyralab/MuseTalk — „available for any purpose, even commercially”) → modele/musetalkV15
  • VAE stabilityai/sd-vae-ft-mse (MIT) → modele/sd-vae
  • openai/whisper-tiny (MIT) → modele/whisper
  • YuNet — detektor twarzy z OpenCV Zoo (MIT) → modele/yunet.onnx
NIE pobieramy: face-parse-bisent (wyuczony na CelebAMask-HQ — tylko niekomercyjnie), DWPose/mmcv (ciężka instalacja,
niepotrzebna przy YuNet), SyncNet (tylko do treningu).

Wejście (argv[1] = JSON): {"katalog", "commit"}. Każdy plik jest pomijany, gdy już jest. Na koniec stdout = JSON z listą.
"""

import io
import json
import os
import shutil
import sys
import urllib.request
import zipfile

YUNET = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"


def melduj(t):
    try:
        print(t, flush=True)
    except Exception:  # noqa: BLE001
        pass


def pobierz_url(url, cel):
    os.makedirs(os.path.dirname(cel), exist_ok=True)
    tmp = cel + ".part"
    with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f, 1024 * 1024)
    os.replace(tmp, cel)


def main():
    a = json.loads(sys.argv[1])
    kat = a["katalog"]
    commit = a["commit"]
    modele = os.path.join(kat, "modele")
    os.makedirs(modele, exist_ok=True)
    zrobione = []

    # 1) kod MuseTalk (przypięty commit — ten sam, który Katedra sprawdziła)
    kod = os.path.join(kat, "MuseTalk")
    znacznik = os.path.join(kod, ".commit")
    if not (os.path.isfile(znacznik) and open(znacznik, encoding="utf-8").read().strip() == commit):
        melduj(f"kod MuseTalk {commit[:7]} z GitHuba")
        with urllib.request.urlopen(f"https://codeload.github.com/TMElyralab/MuseTalk/zip/{commit}", timeout=120) as r:
            dane = r.read()
        shutil.rmtree(kod, ignore_errors=True)
        with zipfile.ZipFile(io.BytesIO(dane)) as z:
            korzen = z.namelist()[0].split("/")[0]
            z.extractall(kat)
        os.replace(os.path.join(kat, korzen), kod)
        with open(znacznik, "w", encoding="utf-8") as f:
            f.write(commit)
        zrobione.append("MuseTalk")

    # 2) wagi z HuggingFace (HF_ENDPOINT = lustro, jeśli ktoś używa)
    from huggingface_hub import hf_hub_download

    def hf(repo, plik, cel_kat, nazwa=None):
        cel = os.path.join(cel_kat, nazwa or os.path.basename(plik))
        if os.path.isfile(cel) and os.path.getsize(cel) > 0:
            return
        melduj(f"{repo}: {plik}")
        sciezka = hf_hub_download(repo_id=repo, filename=plik)
        os.makedirs(cel_kat, exist_ok=True)
        shutil.copyfile(sciezka, cel)
        zrobione.append(f"{repo}/{plik}")

    hf("TMElyralab/MuseTalk", "musetalkV15/musetalk.json", os.path.join(modele, "musetalkV15"))
    hf("TMElyralab/MuseTalk", "musetalkV15/unet.pth", os.path.join(modele, "musetalkV15"))
    hf("stabilityai/sd-vae-ft-mse", "config.json", os.path.join(modele, "sd-vae"))
    hf("stabilityai/sd-vae-ft-mse", "diffusion_pytorch_model.safetensors", os.path.join(modele, "sd-vae"))
    for p in ("config.json", "model.safetensors", "preprocessor_config.json"):
        hf("openai/whisper-tiny", p, os.path.join(modele, "whisper"))

    # 3) YuNet
    cel = os.path.join(modele, "yunet.onnx")
    if not (os.path.isfile(cel) and os.path.getsize(cel) > 10000):
        melduj("YuNet (OpenCV Zoo)")
        pobierz_url(YUNET, cel)
        zrobione.append("yunet.onnx")

    sys.stdout.write(json.dumps({"pobrane": zrobione}) + "\n")


if __name__ == "__main__":
    main()
