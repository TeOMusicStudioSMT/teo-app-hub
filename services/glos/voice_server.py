"""
🎙️ voice_server.py — silnik klonu głosu Katedry OtakOS (tor „klon-lokalny”, :5002).

DLACZEGO TEN PLIK (2026-10-04): launcher i most od dawna wołały `_OtakOs_AI/voice_server.py`, ale tego pliku
nigdy nie było w repo — kloner Katedry „jakby nigdy nie był podłączony”, bo nie był. Teraz jest: prawdziwy serwer,
instalowany przez most (`POST /api/glos/silnik/instaluj`).

KONTRAKT (services/PrzewodyGlosuService.js → torKlonLokalny):
    GET  /                 → {"ok": true, "silnik": "chatterbox|xtts_v2", "model": "ladowanie|gotowy|blad", ...}
    POST /api/tts          {"text": "...", "speaker_wav": "<pełna ścieżka WAV>", "language": "pl"} → audio/wav

SILNIKI (jeden na środowisko; wybór: OTAKOS_GLOS_SILNIK albo plik `.silnik` w środowisku, który pisze instalator):
  • chatterbox (DOMYŚLNY) — Chatterbox Multilingual od Resemble AI, licencja MIT: wolno używać KOMERCYJNIE
    (Suweren tworzy, pokazuje i zarabia). Klonuje barwę z ~10 s próbki, 23 języki, w tym polski i angielski.
    Każde nagranie niesie niesłyszalny znak wodny Perth (Resemble AI) — tak działa ich biblioteka, nie Katedra.
  • xtts — XTTS-v2 przez coqui-tts. ⚖️ Coqui Public Model License (CPML) = TYLKO użycie niekomercyjne;
    ładuje się wyłącznie po zgodzie Suwerena (plik `.zgoda-cpml` obok środowiska → COQUI_TOS_AGREED=1).

Długi tekst idzie po zdaniach (Chatterbox ucina mowę po ~1000 tokenach), kawałki sklejone krótką pauzą.
Zero zależności poza silnikiem: http.server ze standardowej biblioteki, jedna synteza naraz, model ładowany raz w tle.
"""

import io
import json
import os
import re
import sys
import threading
import traceback
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("OTAKOS_GLOS_PORT", "5002"))
MODEL_XTTS = os.environ.get("OTAKOS_GLOS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")
DOMYSLNA_PROBKA = os.environ.get("OTAKOS_GLOS_PROBKA", "")
MAX_KAWALKA = 250   # znaków na jedną syntezę

JEZYKI = {
    "chatterbox": {"ar", "da", "de", "el", "en", "es", "fi", "fr", "he", "hi", "it", "ja", "ko", "ms", "nl", "no",
                   "pl", "pt", "ru", "sv", "sw", "tr", "zh"},
    "xtts": {"pl", "en", "de", "es", "fr", "it", "pt", "nl", "cs", "ru", "tr", "ar", "zh-cn", "ja", "hu", "ko", "hi"},
}
NAZWY = {"chatterbox": "chatterbox", "xtts": "xtts_v2"}
LICENCJE = {"chatterbox": "MIT (wolno komercyjnie)", "xtts": "CPML (tylko niekomercyjnie)"}


def wybierz_silnik():
    """OTAKOS_GLOS_SILNIK → plik `.silnik` w środowisku (sys.prefix) → chatterbox."""
    s = (os.environ.get("OTAKOS_GLOS_SILNIK") or "").strip().lower()
    if not s:
        try:
            with open(os.path.join(sys.prefix, ".silnik"), encoding="utf-8") as f:
                s = f.read().strip().lower()
        except OSError:
            s = ""
    return s if s in JEZYKI else "chatterbox"


SILNIK = wybierz_silnik()
stan = {"model": "ladowanie", "blad": None, "urzadzenie": None}
_model = None
_probka = None   # próbka, z której Chatterbox ma przygotowane warunki (prepare_conditionals)
_blokada = threading.Lock()


def zgoda_licencji():
    """Zgoda Suwerena na CPML (tylko XTTS): zmienna albo plik `.zgoda-cpml` w katalogu środowiska (sys.prefix)."""
    if os.environ.get("COQUI_TOS_AGREED") == "1":
        return True
    return os.path.exists(os.path.join(sys.prefix, ".zgoda-cpml"))


def urzadzenie(torch):
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    return "mps" if mps is not None and mps.is_available() else "cpu"


def zaladuj():
    """Ładuje model w tle (pierwszy raz pobiera wagi). Błąd zostaje w `stan`, serwer odpowiada dalej."""
    global _model
    try:
        import torch  # noqa: WPS433 — ciężki import dopiero w tle
        urz = urzadzenie(torch)
        stan["urzadzenie"] = urz
        if SILNIK == "chatterbox":
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS
            _model = ChatterboxMultilingualTTS.from_pretrained(device=urz)
        else:
            if not zgoda_licencji():
                raise RuntimeError("brak zgody na licencję modelu XTTS-v2 (CPML, użycie niekomercyjne) — zaakceptuj ją w Katedrze przy instalacji silnika")
            os.environ["COQUI_TOS_AGREED"] = "1"
            from TTS.api import TTS
            _model = TTS(MODEL_XTTS).to("cuda" if urz == "cuda" else "cpu")
        stan["model"] = "gotowy"
    except Exception as e:  # noqa: BLE001 — każdy powód ma trafić do Suwerena
        stan["model"] = "blad"
        stan["blad"] = f"{type(e).__name__}: {e}"[:400]
        traceback.print_exc()


def kawalki(tekst, maks=MAX_KAWALKA):
    """Tekst → kawałki ≤ maks znaków po granicach zdań (a zbyt długie zdanie — po przecinkach i słowach)."""
    zdania = [z.strip() for z in re.split(r"(?<=[.!?…])\s+", tekst.strip()) if z.strip()]
    wynik = []
    for z in zdania:
        while len(z) > maks:
            ciecie = max(z.rfind(", ", 0, maks), z.rfind("; ", 0, maks))
            if ciecie < maks // 3:
                ciecie = z.rfind(" ", 0, maks)
            if ciecie <= 0:
                ciecie = maks
            wynik.append(z[:ciecie + 1].strip())
            z = z[ciecie + 1:].strip()
        if z:
            if wynik and len(wynik[-1]) + 1 + len(z) <= maks:   # krótkie zdania razem — mniej syntez
                wynik[-1] = f"{wynik[-1]} {z}"
            else:
                wynik.append(z)
    return wynik


def jezyk_silnika(jezyk):
    j = (jezyk or "pl").lower()
    if SILNIK == "chatterbox" and j in ("zh-cn", "zh-tw"):
        return "zh"
    if SILNIK == "xtts" and j == "zh":
        return "zh-cn"
    return j


def _syntezuj_kawalek(tekst, probka, jezyk):
    """Jeden kawałek → (lista/tablica float, częstotliwość)."""
    global _probka
    if SILNIK == "chatterbox":
        if _probka != probka:
            _model.prepare_conditionals(probka)
            _probka = probka
        wav = _model.generate(tekst, language_id=jezyk)
        dane = wav.squeeze(0).detach().cpu().numpy() if hasattr(wav, "detach") else wav
        return dane, getattr(_model, "sr", 24000) or 24000
    dane = _model.tts(text=tekst, speaker_wav=probka, language=jezyk)
    return dane, getattr(getattr(_model, "synthesizer", None), "output_sample_rate", 24000) or 24000


def syntezuj(tekst, probka, jezyk):
    """Tekst + próbka głosu → WAV (bajty). Rzuca ValueError z powodem po polsku."""
    if stan["model"] != "gotowy" or _model is None:
        raise ValueError(f"model nie jest gotowy ({stan['model']}{': ' + stan['blad'] if stan['blad'] else ''})")
    if not probka or not os.path.isfile(probka):
        raise ValueError("brak próbki głosu (speaker_wav) — profil klonu potrzebuje pliku WAV z głosem")
    j = jezyk_silnika(jezyk)
    if j not in JEZYKI[SILNIK]:
        raise ValueError(f"silnik {NAZWY[SILNIK]} nie zna języka „{j}”")
    probki, czestotliwosc = [], 24000
    with _blokada:
        for i, k in enumerate(kawalki(tekst)):
            dane, czestotliwosc = _syntezuj_kawalek(k, probka, j)
            if i:
                probki.extend([0.0] * int(czestotliwosc * 0.15))   # oddech między zdaniami
            probki.extend(list(dane) if not hasattr(dane, "tolist") else dane.tolist())
    return wav_z_probek(probki, czestotliwosc)


def wav_z_probek(probki, czestotliwosc):
    """Lista/tablica float [-1, 1] → WAV 16-bit mono."""
    bufor = io.BytesIO()
    with wave.open(bufor, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(int(czestotliwosc))
        try:   # numpy przychodzi z torchem — szybka ścieżka
            import numpy as np
            w.writeframes((np.clip(np.asarray(probki, dtype=np.float32), -1.0, 1.0) * 32767).astype("<i2").tobytes())
        except ImportError:
            ramki = bytearray()
            for p in probki:
                v = max(-1.0, min(1.0, float(p)))
                ramki += int(v * 32767).to_bytes(2, "little", signed=True)
            w.writeframes(bytes(ramki))
    return bufor.getvalue()


class Obsluga(BaseHTTPRequestHandler):
    server_version = "OtakOS-Glos/2"

    def _json(self, kod, dane):
        tresc = json.dumps(dane, ensure_ascii=False).encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(tresc)))
        self.end_headers()
        self.wfile.write(tresc)

    def do_GET(self):  # noqa: N802 — nazwa z http.server
        if self.path.split("?")[0] in ("/", "/stan"):
            return self._json(200, {"ok": True, "silnik": NAZWY[SILNIK], "licencja": LICENCJE[SILNIK], **stan,
                                    "zgoda": zgoda_licencji() if SILNIK == "xtts" else None,
                                    "jezyki": sorted(JEZYKI[SILNIK])})
        return self._json(404, {"blad": "nie ma takiej ścieżki"})

    def do_POST(self):  # noqa: N802
        if self.path.split("?")[0] != "/api/tts":
            return self._json(404, {"blad": "nie ma takiej ścieżki"})
        try:
            dlugosc = int(self.headers.get("Content-Length") or 0)
            if dlugosc > 1_000_000:
                return self._json(413, {"blad": "za duże żądanie"})
            dane = json.loads(self.rfile.read(dlugosc) or b"{}")
            tekst = str(dane.get("text") or "").strip()
            if not tekst:
                return self._json(400, {"blad": "pusty tekst"})
            wav = syntezuj(tekst[:4000], dane.get("speaker_wav") or DOMYSLNA_PROBKA, dane.get("language"))
        except ValueError as e:
            return self._json(503 if "model" in str(e) else 400, {"blad": str(e)})
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            return self._json(500, {"blad": f"{type(e).__name__}: {e}"[:400]})
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(wav)))
        self.end_headers()
        self.wfile.write(wav)

    def log_message(self, fmt, *args):  # cicho — tylko błędy idą na stderr przez traceback
        pass


def melduj(tekst):
    """Wypis, który nie wywróci serwera: Windows bez konsoli ma stdout w cp1252 (bez „ł”) albo wcale (pythonw)."""
    try:
        strumien = sys.stdout
        if strumien is None:
            return
        try:
            strumien.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
        print(tekst, file=strumien, flush=True)
    except Exception:  # noqa: BLE001 — meldunek nigdy nie jest powodem, żeby silnik padł
        pass


def main():
    serwer = ThreadingHTTPServer(("127.0.0.1", PORT), Obsluga)
    if os.environ.get("OTAKOS_GLOS_BEZ_MODELU") != "1":   # testy kontraktu HTTP ładują własny silnik
        threading.Thread(target=zaladuj, daemon=True).start()
    melduj(f"[Głos] silnik klonu {NAZWY[SILNIK]} na http://127.0.0.1:{PORT}")
    serwer.serve_forever()


if __name__ == "__main__":
    main()
