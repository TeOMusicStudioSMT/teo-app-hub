"""
🎚️ demucs_stemy.py — REALNA separacja stemów dla Katedry OtakOS

Wywoływany przez wiesio-bridge jako podproces. Rozdziela nagranie na cztery
ścieżki: wokal, perkusja, bas, reszta. To jest PRAWDZIWA separacja (model uczony),
w odróżnieniu od podziału na pasma częstotliwości w RzezbaAudioService.

DLACZEGO OSOBNY VENV (F:/OtakOsDemucs):
- python ComfyUI raz już padł przy dokładaniu paczek (WinError 206 + rozjechany
  torch); Demucs nie ma prawa go tknąć,
- torch jest CPU-only, żeby separacja NIE walczyła o 6 GB VRAM z generacją muzyki.

DLACZEGO KRÓTKA ŚCIEŻKA VENV:
torch rozpakowuje drzewo licencji kineto/libkineto/dynolog/... które przy dłuższym
prefiksie przekracza limit 260 znaków Windows. F:/OtakOsDemucs ma 15 znaków.

DLACZEGO truststore:
Avast przechwytuje HTTPS własnym CA, którego Python nie zna — bez tego pobranie
wag pada na CERTIFICATE_VERIFY_FAILED. truststore każe używać magazynu Windows.

DLACZEGO WEJŚCIE/WYJŚCIE PRZEZ ffmpeg + moduł `wave`, a nie torchaudio.load:
torchaudio 2.11 wymaga do wczytywania paczki `torchcodec`. Zamiast dokładać
kolejną zależność (i kolejne ryzyko rozjazdu wersji) dekodujemy ffmpegiem, który
w Katedrze już jest i jest sprawdzony, a WAV czytamy modułem standardowym.

Wywołanie:
    python demucs_stemy.py <plik_wejsciowy> <katalog_wyjsciowy> [model] [--tylko=wokal,bas]
Wypisuje JSON na stdout — most go parsuje.
"""

import sys, os, json, time, wave, subprocess, tempfile, warnings
warnings.filterwarnings('ignore')

try:
    import truststore
    truststore.inject_into_ssl()
except Exception:
    pass  # potrzebne tylko przy pierwszym pobraniu wag

import numpy as np
import torch
from demucs.pretrained import get_model
from demucs.apply import apply_model

SR = 44100
# Skrypt lezy w services/, wiec node_modules jest o poziom wyzej.
FFMPEG = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'node_modules', 'ffmpeg-static', 'ffmpeg.exe',
)


def bledem(msg, **extra):
    print(json.dumps({'success': False, 'message': msg, **extra}, ensure_ascii=False))
    sys.exit(1)


def wczytaj_audio(sciezka):
    """Cokolwiek -> float32 [2, N] w 44.1 kHz. Dekoduje ffmpegiem do tymczasowego WAV."""
    if not os.path.isfile(FFMPEG):
        bledem(f'Brak ffmpeg: {FFMPEG}')
    tmp = os.path.join(tempfile.gettempdir(), f'demucs_in_{os.getpid()}.wav')
    try:
        subprocess.run(
            [FFMPEG, '-v', 'error', '-i', sciezka, '-ar', str(SR), '-ac', '2',
             '-c:a', 'pcm_s16le', '-y', tmp],
            check=True, capture_output=True,
        )
        with wave.open(tmp, 'rb') as w:
            ramek = w.getnframes()
            surowe = w.readframes(ramek)
        dane = np.frombuffer(surowe, dtype='<i2').astype(np.float32) / 32768.0
        return torch.from_numpy(dane.reshape(-1, 2).T.copy())
    finally:
        try: os.remove(tmp)
        except OSError: pass


def zapisz_wav(sciezka, tensor):
    """float32 [2, N] -> WAV 16-bit stereo."""
    dane = tensor.clamp(-1, 1).cpu().numpy().T          # [N, 2]
    pcm = (dane * 32767.0).astype('<i2').tobytes()
    with wave.open(sciezka, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)


def main():
    if len(sys.argv) < 3:
        bledem('Uzycie: demucs_stemy.py <wejscie> <katalog_wy> [model] [--tylko=a,b]')

    wejscie, katalog_wy = sys.argv[1], sys.argv[2]
    nazwa_modelu = 'htdemucs'
    tylko = None
    for a in sys.argv[3:]:
        if a.startswith('--tylko'):
            wart = a.split('=', 1)[1] if '=' in a else ''
            tylko = [x.strip() for x in wart.split(',') if x.strip()]
        elif not a.startswith('--'):
            nazwa_modelu = a

    if not os.path.isfile(wejscie):
        bledem(f'Nie ma pliku: {os.path.basename(wejscie)}')
    os.makedirs(katalog_wy, exist_ok=True)

    t0 = time.time()
    try:
        model = get_model(nazwa_modelu)
    except Exception as e:
        bledem(f'Nie udalo sie wczytac modelu {nazwa_modelu}: {e}')
    model.eval()
    t_model = time.time() - t0

    fala = wczytaj_audio(wejscie)
    sekund = fala.shape[1] / SR

    # Normalizacja wg statystyk nagrania — tak robi referencyjny separate.py demucsa.
    ref = fala.mean(0)
    sr_mean, sr_std = ref.mean(), ref.std()
    fala_n = (fala - sr_mean) / (sr_std + 1e-8)

    t1 = time.time()
    with torch.no_grad():
        # segment/overlap dobrane pod slaba maszyne: mniejszy segment = mniej RAM.
        zrodla = apply_model(
            model, fala_n[None], device='cpu', split=True,
            overlap=0.15, segment=7, progress=False,
        )[0]
    t_sep = time.time() - t1
    zrodla = zrodla * (sr_std + 1e-8) + sr_mean

    baza = os.path.splitext(os.path.basename(wejscie))[0][:50]
    stempel = int(time.time() * 1000)
    wyniki = []
    for nazwa, tensor in zip(model.sources, zrodla):
        if tylko and nazwa not in tylko:
            continue
        plik = f'{baza}__stem_{nazwa}_{stempel}.wav'
        sciezka = os.path.join(katalog_wy, plik)
        zapisz_wav(sciezka, tensor)
        # Poziom RMS — pozwala mostowi powiedziec, ze stem wyszedl praktycznie pusty
        # (np. wokal w utworze instrumentalnym) zamiast udawac, ze cos znalazl.
        rms = float(torch.sqrt((tensor ** 2).mean()))
        wyniki.append({
            'stem': nazwa,
            'plik': plik,
            'bajty': os.path.getsize(sciezka),
            'rmsDb': round(20 * np.log10(max(rms, 1e-9)), 1),
        })

    print(json.dumps({
        'success': True,
        'model': nazwa_modelu,
        'zrodla': list(model.sources),
        'stemy': wyniki,
        'sekundyAudio': round(sekund, 2),
        'sekundyModelu': round(t_model, 1),
        'sekundySeparacji': round(t_sep, 1),
        'urzadzenie': 'cpu',
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
