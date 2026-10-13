"""
🎙️ voice_server.py — silnik klonu głosu Katedry OtakOS (tor „klon-lokalny”, :5002).

DLACZEGO TEN PLIK (2026-10-04): launcher i most od dawna wołały `_OtakOs_AI/voice_server.py`, ale tego pliku
nigdy nie było w repo — kloner Katedry „jakby nigdy nie był podłączony”, bo nie był. Teraz jest: prawdziwy serwer,
instalowany przez most (`POST /api/glos/silnik/instaluj`).

KONTRAKT (services/PrzewodyGlosuService.js → torKlonLokalny):
    GET  /                 → {"ok": true, "silnik": "chatterbox|xtts_v2", "model": "ladowanie|gotowy|uspiony|blad", "vram_mb", ...}
    POST /api/tts          {"text": "...", "speaker_wav": "<pełna ścieżka WAV>", "language": "pl"} → audio/wav
                           (uśpiony model wstaje sam; czas wstawania w nagłówku X-Glos-Ladowanie-S)
    POST /zwolnij          {"powod": "..."} → {"zwolniono": bool, "vram_mb_przed", "vram_mb_po", "powod"} — oddaje kartę

KARTA (2026-10-13): na 6 GB karty model trzymany od pierwszego nagrania (~3,3 GB) wypychał Wana z ComfyUI do RAM
(krok 10 → 812 s/it, 43 min). Teraz model ŚPI: po bezczynności (OTAKOS_GLOS_BEZCZYNNOSC_S, domyślnie 180 s; 0 = nigdy)
i na prośbę mostu (`POST /zwolnij` przed renderem) — `del` + `torch.cuda.empty_cache()`; następne `/api/tts` ładuje go
z powrotem (wagi z dysku, bez pobierania). Proces zostaje — nic się nie zabija.

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
import gc
import json
import os
import re
import sys
import threading
import time
import traceback
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("OTAKOS_GLOS_PORT", "5002"))
MODEL_XTTS = os.environ.get("OTAKOS_GLOS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")
DOMYSLNA_PROBKA = os.environ.get("OTAKOS_GLOS_PROBKA", "")
MAX_KAWALKA = 250   # znaków na jedną syntezę
try:
    BEZCZYNNOSC_S = max(0.0, float(os.environ.get("OTAKOS_GLOS_BEZCZYNNOSC_S", "180")))
except ValueError:
    BEZCZYNNOSC_S = 180.0

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
stan = {"model": "ladowanie", "blad": None, "urzadzenie": None, "bezczynnosc_s": BEZCZYNNOSC_S,
        "ladowanie_s": None, "uspienia": 0, "uspiony_bo": None}
_model = None
_probka = None   # próbka, z której Chatterbox ma przygotowane warunki (prepare_conditionals)
_blokada = threading.Lock()
_ostatnio = time.monotonic()   # koniec ostatniej syntezy (albo załadowania)


def _torch():
    """torch, jeśli jest (atrapy w testach go nie mają)."""
    try:
        import torch  # noqa: WPS433
        return torch
    except ImportError:
        return None


def vram_mb():
    """Ile pamięci karty trzyma TEN proces (zarezerwowane przez PyTorch), w MB; None bez CUDA."""
    torch = _torch()
    try:
        if torch is not None and torch.cuda.is_available():
            return round(torch.cuda.memory_reserved() / 1048576)
    except Exception:  # noqa: BLE001
        pass
    return None


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
    """Ładuje model (start: w tle, pierwszy raz pobiera wagi; po uśpieniu: z dysku). Błąd zostaje w `stan`."""
    global _model, _ostatnio
    t0 = time.monotonic()
    stan["model"] = "ladowanie"
    stan["blad"] = None
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
        stan["ladowanie_s"] = round(time.monotonic() - t0, 1)
        stan["uspiony_bo"] = None
        _ostatnio = time.monotonic()
    except Exception as e:  # noqa: BLE001 — każdy powód ma trafić do Suwerena
        stan["model"] = "blad"
        stan["blad"] = f"{type(e).__name__}: {e}"[:400]
        traceback.print_exc()


def zwolnij(powod="prośba"):
    """Oddaje kartę: model do kosza + `torch.cuda.empty_cache()`. NIE czeka na trwającą syntezę (most prosi przed
    renderem — nie może wisieć na długim nagraniu): mówi wtedy wprost, że model zostaje. Zwraca słownik dla HTTP."""
    global _model, _probka
    if not _blokada.acquire(blocking=False):
        return {"zwolniono": False, "powod": "właśnie mówi — model zostaje do końca nagrania", "model": stan["model"]}
    try:
        if stan["model"] != "gotowy" or _model is None:
            return {"zwolniono": False, "powod": f"model nie jest załadowany ({stan['model']})", "model": stan["model"]}
        przed = vram_mb()
        _model = None
        _probka = None
        gc.collect()
        torch = _torch()
        try:
            if torch is not None and torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:  # noqa: BLE001 — sprzątanie nie jest powodem, żeby serwer padł
            traceback.print_exc()
        stan["model"] = "uspiony"
        stan["uspienia"] += 1
        stan["uspiony_bo"] = str(powod)[:120]
        po = vram_mb()
        melduj(f"[Głos] model uśpiony ({powod}) — karta {przed} → {po} MB")
        return {"zwolniono": True, "vram_mb_przed": przed, "vram_mb_po": po, "powod": stan["uspiony_bo"], "model": "uspiony"}
    finally:
        _blokada.release()


def czy_uspic(teraz=None):
    """Czy bezczynny model na karcie ma już zasnąć (na CPU usypianie nic nie daje — RAM wróci tylko wolniej)."""
    if BEZCZYNNOSC_S <= 0 or stan["model"] != "gotowy" or stan["urzadzenie"] not in ("cuda", "mps"):
        return False
    return ((time.monotonic() if teraz is None else teraz) - _ostatnio) >= BEZCZYNNOSC_S


def straz_bezczynnosci(co_s=15.0):
    """Wątek: model bezczynny dłużej niż BEZCZYNNOSC_S → zwolnij."""
    while True:
        time.sleep(co_s)
        if czy_uspic():
            zwolnij(f"bezczynność {int(BEZCZYNNOSC_S)} s")


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


def syntezuj(tekst, probka, jezyk, info=None):
    """Tekst + próbka głosu → WAV (bajty). Rzuca ValueError z powodem po polsku.
    Uśpiony model wstaje tu (pod blokadą); `info["ladowanie_s"]` = ile trwało wstawanie."""
    global _ostatnio
    if stan["model"] == "uspiony":
        pass   # wstanie niżej, pod blokadą
    elif stan["model"] != "gotowy" or _model is None:
        raise ValueError(f"model nie jest gotowy ({stan['model']}{': ' + stan['blad'] if stan['blad'] else ''})")
    if not probka or not os.path.isfile(probka):
        raise ValueError("brak próbki głosu (speaker_wav) — profil klonu potrzebuje pliku WAV z głosem")
    j = jezyk_silnika(jezyk)
    if j not in JEZYKI[SILNIK]:
        raise ValueError(f"silnik {NAZWY[SILNIK]} nie zna języka „{j}”")
    probki, czestotliwosc = [], 24000
    with _blokada:
        if stan["model"] == "uspiony" or _model is None:
            t0 = time.monotonic()
            zaladuj()
            if stan["model"] != "gotowy" or _model is None:
                raise ValueError(f"model nie jest gotowy (wstawanie po uśpieniu: {stan['blad'] or stan['model']})")
            wstal = round(time.monotonic() - t0, 1)
            if info is not None:
                info["ladowanie_s"] = wstal
            melduj(f"[Głos] model wstał po uśpieniu w {wstal} s")
        for i, k in enumerate(kawalki(tekst)):
            dane, czestotliwosc = _syntezuj_kawalek(k, probka, j)
            if i:
                probki.extend([0.0] * int(czestotliwosc * 0.15))   # oddech między zdaniami
            probki.extend(list(dane) if not hasattr(dane, "tolist") else dane.tolist())
        _ostatnio = time.monotonic()
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
                                    "vram_mb": vram_mb(),
                                    "bezczynny_s": round(time.monotonic() - _ostatnio) if stan["model"] == "gotowy" else None,
                                    "zgoda": zgoda_licencji() if SILNIK == "xtts" else None,
                                    "jezyki": sorted(JEZYKI[SILNIK])})
        return self._json(404, {"blad": "nie ma takiej ścieżki"})

    def do_POST(self):  # noqa: N802
        sciezka = self.path.split("?")[0]
        if sciezka == "/zwolnij":
            try:
                dlugosc = int(self.headers.get("Content-Length") or 0)
                dane = json.loads(self.rfile.read(min(dlugosc, 10_000)) or b"{}") if dlugosc else {}
            except ValueError:
                dane = {}
            return self._json(200, {"ok": True, **zwolnij(str((dane or {}).get("powod") or "prośba mostu"))})
        if sciezka != "/api/tts":
            return self._json(404, {"blad": "nie ma takiej ścieżki"})
        info = {}
        try:
            dlugosc = int(self.headers.get("Content-Length") or 0)
            if dlugosc > 1_000_000:
                return self._json(413, {"blad": "za duże żądanie"})
            dane = json.loads(self.rfile.read(dlugosc) or b"{}")
            tekst = str(dane.get("text") or "").strip()
            if not tekst:
                return self._json(400, {"blad": "pusty tekst"})
            wav = syntezuj(tekst[:4000], dane.get("speaker_wav") or DOMYSLNA_PROBKA, dane.get("language"), info)
        except ValueError as e:
            return self._json(503 if "model" in str(e) else 400, {"blad": str(e)})
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            return self._json(500, {"blad": f"{type(e).__name__}: {e}"[:400]})
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        if info.get("ladowanie_s") is not None:
            self.send_header("X-Glos-Ladowanie-S", str(info["ladowanie_s"]))
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
    threading.Thread(target=straz_bezczynnosci, daemon=True).start()
    melduj(f"[Głos] silnik klonu {NAZWY[SILNIK]} na http://127.0.0.1:{PORT}")
    serwer.serve_forever()


if __name__ == "__main__":
    main()
