"""
👄 Usta aktora pod jego głos — MuseTalk 1.5 (MIT) w środowisku Katedry (services/UstaAktorow.js → mow).

Suweren (2026-10-05): „teraz aktorzy” — karta mówiącego w Studiu Podcastu ma mówić, a nie stać jak zdjęcie.

Wejście (argv[1] = JSON):
  {"zrodlo": zdjęcie albo klip aktora, "audio": jego kwestia (wav/mp3), "wyjscie": mp4 BEZ dźwięku (dźwięk dokłada
   ffmpeg Katedry przy kadrze), "repo": kod MuseTalk, "modele": katalog wag, "ffmpeg": ścieżka ffmpeg,
   "fps": 25, "maksWys": 1024, "przesuniecie": 0 (piksele: + = środek twarzy niżej → usta mniej otwarte)}
Wyjście: stdout = {"klatek", "sekundy", "urzadzenie", "twarz": [x1,y1,x2,y2], "szer", "wys", "wykrywacz": "yunet|haar"}.

Różnice wobec skryptu MuseTalk (świadome):
  • twarz: YuNet z OpenCV Zoo (MIT; 5 punktów: oczy, nos, kąciki ust), zapas: kaskada Haara z OpenCV — zamiast
    S3FD + DWPose (mmcv/mmpose — ciężka, krucha instalacja na Windows),
  • mieszanie: własna miękka maska dolnej połowy twarzy — zamiast face-parse-bisent (wyuczony na CelebAMask-HQ,
    umowa zbioru zabrania komercyjnego użycia „danych pochodnych”). Granica bywa mniej precyzyjna przy brodzie.
"""

import json
import os
import subprocess
import sys

OBRAZ = (".png", ".jpg", ".jpeg", ".webp", ".bmp")


def wczytaj_klatki(zrodlo, fps, maks_wys, maks_klatek=300):
    import cv2

    def skaluj(img):
        h, w = img.shape[:2]
        s = min(1.0, maks_wys / float(h))
        nw, nh = int(round(w * s / 2) * 2), int(round(h * s / 2) * 2)
        return cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA) if (nw, nh) != (w, h) else img

    if zrodlo.lower().endswith(OBRAZ):
        img = cv2.imread(zrodlo)
        if img is None:
            raise ValueError(f"nie umiem otworzyć obrazu: {zrodlo}")
        return [skaluj(img)]
    cap = cv2.VideoCapture(zrodlo)
    zr_fps = cap.get(cv2.CAP_PROP_FPS) or fps
    wszystkie = []
    while len(wszystkie) < int(maks_klatek * max(1.0, zr_fps / fps)) + 1:
        ok, img = cap.read()
        if not ok:
            break
        wszystkie.append(img)
    cap.release()
    if not wszystkie:
        raise ValueError(f"nie umiem odczytać klipu: {zrodlo}")
    # przepróbkowanie do fps Katedry (klatka najbliższa czasowi k/fps)
    n = min(maks_klatek, max(1, int(len(wszystkie) * fps / zr_fps)))
    return [skaluj(wszystkie[min(len(wszystkie) - 1, int(round(k * zr_fps / fps)))]) for k in range(n)]


def znajdz_twarz(img, yunet, przesuniecie=0):
    """Ramka twarzy jak w MuseTalk 1.5: od chin w dół, góra symetrycznie wokół nosa. Zwraca (box, wykrywacz) albo None."""
    import cv2

    h, w = img.shape[:2]
    nos = broda = x1 = x2 = None
    wykrywacz = None
    if yunet and os.path.isfile(yunet) and hasattr(cv2, "FaceDetectorYN"):
        det = cv2.FaceDetectorYN.create(yunet, "", (w, h), 0.6, 0.3, 5000)
        det.setInputSize((w, h))
        _, twarze = det.detect(img)
        if twarze is not None and len(twarze):
            f = max(twarze, key=lambda t: t[2] * t[3])
            fx, fy, fw, fh = f[0:4]
            nos_y = f[9]
            usta_y = (f[11] + f[13]) / 2.0
            nos = nos_y
            broda = min(float(h), max(fy + fh, nos_y + 2.8 * (usta_y - nos_y)))
            x1, x2 = fx, fx + fw
            wykrywacz = "yunet"
    if nos is None:
        szary = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        kaskada = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
        twarze = kaskada.detectMultiScale(szary, 1.1, 5, minSize=(max(24, w // 20), max(24, h // 20)))
        if len(twarze):
            fx, fy, fw, fh = max(twarze, key=lambda t: t[2] * t[3])
            nos = fy + 0.58 * fh
            broda = min(float(h), fy + 1.08 * fh)
            x1, x2 = fx + 0.04 * fw, fx + 0.96 * fw
            wykrywacz = "haar"
    if nos is None:
        return None
    nos = nos + przesuniecie
    gora = max(0.0, nos - (broda - nos))
    box = [int(max(0, x1)), int(gora), int(min(w, x2)), int(broda)]
    if box[2] - box[0] < 16 or box[3] - box[1] < 16:
        return None
    return box, wykrywacz


def maska_dolnej_twarzy(szer, wys):
    """Miękka maska (0–255) na ramkę twarzy: elipsa dolnej połowy (usta, broda, policzki), rozmyta na brzegach."""
    import cv2
    import numpy as np

    m = np.zeros((wys, szer), dtype=np.uint8)
    cv2.ellipse(m, (szer // 2, int(wys * 0.70)), (int(szer * 0.42), int(wys * 0.34)), 0, 0, 360, 255, -1)
    m[: int(wys * 0.45), :] = 0
    k = max(3, int(szer * 0.12) // 2 * 2 + 1)
    return cv2.GaussianBlur(m, (k, k), 0)


def main():
    a = json.loads(sys.argv[1])
    sys.path.insert(0, a["repo"])
    import cv2
    import numpy as np
    import torch
    from transformers import WhisperModel
    from musetalk.models.unet import PositionalEncoding, UNet
    from musetalk.models.vae import VAE
    from musetalk.utils.audio_processor import AudioProcessor

    fps = int(a.get("fps") or 25)
    modele = a["modele"]
    cuda = bool(torch.cuda.is_available())
    dev = torch.device("cuda" if cuda else "cpu")

    klatki = wczytaj_klatki(a["zrodlo"], fps, int(a.get("maksWys") or 1024))
    yunet = os.path.join(modele, "yunet.onnx")
    ramki, wykrywacz, ostatnia = [], None, None
    for img in klatki:
        z = znajdz_twarz(img, yunet, int(a.get("przesuniecie") or 0))
        if z is not None:
            box, wykrywacz = z
            # wygładzenie ramki w klipie — bez drgań między klatkami
            if ostatnia is not None:
                box = [int(round(0.7 * o + 0.3 * b)) for o, b in zip(ostatnia, box)]
            ostatnia = box
        ramki.append(ostatnia)
    if ostatnia is None:
        raise ValueError("nie znalazłem twarzy na karcie aktora (zdjęcie/klip) — usta potrzebują twarzy en face")
    pierwsza = next(r for r in ramki if r is not None)
    ramki = [r or pierwsza for r in ramki]

    vae = VAE(model_path=os.path.join(modele, "sd-vae"), use_float16=cuda)
    unet = UNet(unet_config=os.path.join(modele, "musetalkV15", "musetalk.json"),
                model_path=os.path.join(modele, "musetalkV15", "unet.pth"), use_float16=cuda, device=dev)
    typ = unet.model.dtype
    pe = PositionalEncoding(d_model=384).to(dev)
    if cuda:
        pe = pe.half()
    katalog_whisper = os.path.join(modele, "whisper")
    whisper = WhisperModel.from_pretrained(katalog_whisper).to(device=dev, dtype=typ).eval()
    audio = AudioProcessor(feature_extractor_path=katalog_whisper)

    cechy, dlugosc = audio.get_audio_feature(a["audio"])
    kawalki = audio.get_whisper_chunk(cechy, dev, typ, whisper, dlugosc, fps=fps,
                                      audio_padding_length_left=2, audio_padding_length_right=2)
    if len(kawalki) == 0:
        raise ValueError("kwestia jest krótsza niż jedna klatka")

    margines = 10
    latenty, wyciecia = [], []
    for img, (x1, y1, x2, y2) in zip(klatki, ramki):
        y2m = min(img.shape[0], y2 + margines)
        wyciecie = cv2.resize(img[y1:y2m, x1:x2], (256, 256), interpolation=cv2.INTER_LANCZOS4)
        with torch.no_grad():
            latenty.append(vae.get_latents_for_unet(wyciecie))
        wyciecia.append((x1, y1, x2, y2m))
    # pętla tam i z powrotem (klip), jak w MuseTalk
    kolejnosc = list(range(len(klatki))) + list(range(len(klatki)))[::-1] if len(klatki) > 1 else [0]

    wys, szer = klatki[0].shape[:2]
    os.makedirs(os.path.dirname(os.path.abspath(a["wyjscie"])), exist_ok=True)
    ff = subprocess.Popen([a.get("ffmpeg") or "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{szer}x{wys}", "-r", str(fps), "-i", "-",
                           "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", a["wyjscie"]],
                          stdin=subprocess.PIPE)
    maski = {}
    czas = torch.tensor([0], device=dev)
    rozmiar = 8 if cuda else 2
    try:
        for i0 in range(0, len(kawalki), rozmiar):
            idx = [kolejnosc[(i0 + j) % len(kolejnosc)] for j in range(min(rozmiar, len(kawalki) - i0))]
            with torch.no_grad():
                dzwiek = pe(kawalki[i0:i0 + len(idx)].to(device=dev, dtype=typ))
                lat = torch.cat([latenty[k] for k in idx], dim=0).to(device=dev, dtype=typ)
                wynik = unet.model(lat, czas, encoder_hidden_states=dzwiek).sample
                twarze = vae.decode_latents(wynik)
            for k, twarz in zip(idx, twarze):
                x1, y1, x2, y2 = wyciecia[k]
                w, h = x2 - x1, y2 - y1
                twarz = cv2.resize(np.ascontiguousarray(twarz), (w, h), interpolation=cv2.INTER_LANCZOS4)
                if (w, h) not in maski:
                    maski[(w, h)] = (maska_dolnej_twarzy(w, h).astype(np.float32) / 255.0)[:, :, None]
                m = maski[(w, h)]
                kadr = klatki[k].copy()
                kadr[y1:y2, x1:x2] = (twarz * m + kadr[y1:y2, x1:x2] * (1.0 - m)).astype(np.uint8)
                ff.stdin.write(kadr.tobytes())
    finally:
        ff.stdin.close()
        kod = ff.wait()
    if kod != 0:
        raise RuntimeError(f"ffmpeg zakończył się kodem {kod}")
    sys.stdout.write(json.dumps({"klatek": len(kawalki), "sekundy": round(len(kawalki) / fps, 2),
                                 "urzadzenie": "cuda" if cuda else "cpu", "twarz": pierwsza, "szer": szer, "wys": wys,
                                 "wykrywacz": wykrywacz}) + "\n")


if __name__ == "__main__":
    main()
