/**
 * 👄 Usta aktorów — karta mówiącego rusza ustami pod jego kwestię (MuseTalk 1.5, MIT: kod i wagi wolno komercyjnie).
 *
 * Suweren (2026-10-05): „teraz aktorzy” — po ożywionych tłach (🧊 Studio 3D) czas na postaci. Przegląd licencji przed
 * budową: Wav2Lip = tylko niekomercyjnie; LatentSync 1.5 (Apache) potrzebuje 8 GB VRAM i InsightFace; LivePortrait
 * nie jest sterowany dźwiękiem; MuseTalk 1.5 = MIT, ~4 GB VRAM (fp16). Jego parser twarzy (face-parse-bisent) jest
 * wyuczony na CelebAMask-HQ — umowa zbioru zabrania komercyjnego użycia „danych pochodnych”, więc NIE pobieramy go:
 * mieszanie robi własna maska Katedry, a twarz znajduje YuNet z OpenCV (MIT) zamiast DWPose/mmcv.
 *
 * ŚRODOWISKO (`_OtakOs_AI/usta`): venv z Pythonem 3.10–3.12 (te same zasady co silnik głosu), PyTorch + torchvision
 * pod sterownik, `services/usta/requirements-usta.txt`, kod MuseTalk z przypiętego commita i wagi (`pobierz.py`).
 * Generowanie: `services/usta/usta.py` — zdjęcie/klip aktora + audio kwestii → mp4 bez dźwięku. Jedno naraz (GPU),
 * wynik w schowku po sumie (źródło, audio, ustawienia) — ponowne nagranie odcinka nie liczy ust drugi raz.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { koloTorch } from './KuzniaSoup.js';
import { znajdzPythona, domyslneUruchom, zbierzDomyslnie } from './SilnikKlonu.js';
import { opisKoduWyjscia, sednoBledu } from './GlebiaKadru.js';

const TUTAJ = path.dirname(fileURLToPath(import.meta.url));
export const COMMIT_MUSETALK = '0a89dec45a0192b824e3cf4daf96c239440c5ed8';
export const SKRYPT_USTA = path.join(TUTAJ, 'usta', 'usta.py');
export const SKRYPT_POBIERZ = path.join(TUTAJ, 'usta', 'pobierz.py');
export const WYMAGANIA_USTA = path.join(TUTAJ, 'usta', 'requirements-usta.txt');
export const LICENCJA_USTA = 'MuseTalk 1.5 — MIT (kod i wagi wolno komercyjnie); VAE sd-vae-ft-mse MIT; whisper-tiny MIT; YuNet MIT. Bez parsera twarzy CelebAMask-HQ (tylko niekomercyjny).';

/** Domyślne wywołanie skryptu Pythona: stdout (ostatnia linia = JSON), stderr do opisu błędu. */
const domyslnySkrypt = (py, argi, { env, timeout }) => new Promise((ok, zle) => execFile(py, argi, { env, timeout, windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (e, out, err) => {
    if (e) { e.stderr = err; return zle(e); }
    return ok(String(out));
}));

/**
 * @param {{ aiDir: string, ffmpeg: string, katalog?: string, uruchom?: Function, skrypt?: Function, log?: Function, python?: () => string|null }} o
 *   `uruchom` = kroki instalatora (jak w SilnikKlonu), `skrypt` = wywołanie usta.py (testy podmieniają oba).
 */
export function utworzUsta(o) {
    const cfg = { uruchom: domyslneUruchom, skrypt: domyslnySkrypt, log: console.log, ...o };
    const KAT = cfg.katalog ?? path.join(cfg.aiDir, 'usta');
    const VENV = path.join(KAT, 'venv');
    const MODELE = path.join(KAT, 'modele');
    const REPO = path.join(KAT, 'MuseTalk');
    const SCHOWEK = path.join(KAT, 'schowek');
    const instalacja = { stan: 'brak', etap: null, log: [], blad: null, od: null, koniec: null, kolo: null, cuda: null };
    let kolejka = Promise.resolve();
    let wToku = 0;

    const python = () => cfg.python?.() ?? [path.join(VENV, 'Scripts', 'python.exe'), path.join(VENV, 'bin', 'python')].find((p) => fsSync.existsSync(p)) ?? null;
    const PLIKI = [
        path.join(MODELE, 'musetalkV15', 'unet.pth'), path.join(MODELE, 'musetalkV15', 'musetalk.json'),
        path.join(MODELE, 'sd-vae', 'config.json'), path.join(MODELE, 'whisper', 'config.json'), path.join(MODELE, 'whisper', 'preprocessor_config.json'),
    ];
    const kodGotowy = () => { try { return fsSync.readFileSync(path.join(REPO, '.commit'), 'utf8').trim() === COMMIT_MUSETALK; } catch { return false; } };
    const brakujace = () => [...(kodGotowy() ? [] : ['kod MuseTalk']), ...PLIKI.filter((p) => !fsSync.existsSync(p)).map((p) => path.relative(KAT, p))];
    const gotowy = () => !!python() && brakujace().length === 0;

    function stan() {
        const b = brakujace();
        return {
            gotowy: !!python() && b.length === 0, srodowisko: !!python(), brakuje: b, katalog: KAT, licencja: LICENCJA_USTA,
            wToku, instalacja: { ...instalacja, log: instalacja.log.slice(-40) },
            powod: !python() ? 'nie zainstalowane — 🎙️ → 🎛️ Studio Podcastu → „👄 Zainstaluj usta aktorów”' : b.length ? `brakuje: ${b.join(', ')} — zainstaluj ponownie` : 'gotowe',
        };
    }

    /** Instalacja w tle: Python 3.10–3.12 → venv → torch + torchvision pod sterownik → zależności → kod + wagi. */
    function instaluj({ cuda = 'auto' } = {}) {
        if (instalacja.stan === 'trwa') throw new Error(`Instalacja ust już trwa (${instalacja.etap}).`);
        Object.assign(instalacja, { stan: 'trwa', etap: 'start', log: [], blad: null, od: new Date().toISOString(), koniec: null, kolo: null, cuda: null });
        const loguj = (l) => { instalacja.log.push(String(l).slice(0, 300)); if (instalacja.log.length > 300) instalacja.log.splice(0, instalacja.log.length - 300); };
        const zbierz = zbierzDomyslnie(cfg.uruchom);
        const env = { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1', PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', HF_HOME: process.env.HF_HOME || path.join(KAT, 'hf'), HF_HUB_DISABLE_PROGRESS_BARS: '1' };
        const krok = async (opis, pol, argi) => {
            instalacja.etap = opis; loguj(`▶ ${opis}: ${path.basename(pol)} ${argi.join(' ').slice(0, 200)}`);
            const kod = await cfg.uruchom(pol, argi, { cwd: KAT, env, naLinie: loguj });
            if (kod !== 0) throw new Error(`${opis}: zakończone kodem ${kod} — szczegóły w dzienniku.`);
        };
        (async () => {
            try {
                await fs.mkdir(KAT, { recursive: true });
                instalacja.etap = 'szukam Pythona 3.10–3.12';
                const p = await znajdzPythona(cfg.aiDir, zbierz);
                if (!p) throw new Error('Nie ma Pythona 3.10–3.12. Zainstaluj Python 3.12 z python.org — Katedra znajdzie go przez „py -3.12”.');
                loguj(`Python ${p.wersja}: ${p.polecenie} ${p.argi.join(' ')}`);
                let kolo = cuda;
                if (cuda === 'auto') {
                    const smi = await zbierz('nvidia-smi', []).catch(() => ({ kod: 1, linie: [] }));
                    kolo = koloTorch(smi.linie.join('\n')) ?? 'cpu';
                    loguj(kolo === 'cpu' ? 'nvidia-smi nie odpowiada — PyTorch bez CUDA (usta na procesorze: bardzo wolno).' : `sterownik NVIDIA → koło PyTorch ${kolo}`);
                }
                instalacja.kolo = kolo;
                if (!python()) await krok('tworzę środowisko (usta/venv)', p.polecenie, [...p.argi, '-m', 'venv', VENV]);
                const py = python();
                if (!py) throw new Error('Środowisko nie powstało — szczegóły w dzienniku.');
                await krok('aktualizuję pip', py, ['-m', 'pip', 'install', '--upgrade', 'pip']);
                await krok(kolo === 'cpu' ? 'PyTorch (procesor)' : `PyTorch z CUDA (${kolo})`, py, ['-m', 'pip', 'install', 'torch', 'torchvision', '--index-url', `https://download.pytorch.org/whl/${kolo}`]);
                await krok('zależności MuseTalk (bez mmcv i parsera twarzy)', py, ['-m', 'pip', 'install', '-r', WYMAGANIA_USTA]);
                await krok('kod MuseTalk i wagi (~3,5 GB z GitHuba i HuggingFace)', py, [SKRYPT_POBIERZ, JSON.stringify({ katalog: KAT, commit: COMMIT_MUSETALK })]);
                instalacja.etap = 'sprawdzam';
                const t = await zbierz(py, ['-c', 'import torch, torchvision, diffusers, transformers, cv2, librosa; print(torch.__version__, torch.cuda.is_available())']);
                loguj(`sprawdzenie: ${t.linie.at(-1) ?? '?'}`);
                if (t.kod !== 0) throw new Error('Zależności zainstalowane, ale się nie importują — szczegóły w dzienniku.');
                instalacja.cuda = /\bTrue\b/.test(t.linie.at(-1) ?? '');
                if (brakujace().length) throw new Error(`Po pobraniu nadal brakuje: ${brakujace().join(', ')}.`);
                instalacja.stan = 'gotowe';
                cfg.log(`👄 Usta aktorów zainstalowane (${instalacja.cuda ? 'CUDA' : 'procesor'}).`);
            } catch (e) {
                instalacja.stan = 'blad'; instalacja.blad = String(e.message || e).slice(0, 400);
            } finally { instalacja.koniec = new Date().toISOString(); }
        })();
        return stan().instalacja;
    }

    async function mowTeraz({ zrodlo, audio, przesuniecie = 0 }) {
        const py = python();
        if (!py || brakujace().length) throw new Error(`Usta aktorów: ${stan().powod}`);
        for (const [co, p] of [['karta aktora', zrodlo], ['nagranie kwestii', audio]]) if (!p || !fsSync.existsSync(p)) throw new Error(`Usta: brak pliku (${co}): ${p || '(brak)'}`);
        const st = await fs.stat(zrodlo);
        const klucz = createHash('sha1').update(JSON.stringify([path.resolve(zrodlo), st.size, st.mtimeMs, Number(przesuniecie) || 0, COMMIT_MUSETALK]))
            .update(await fs.readFile(audio)).digest('hex').slice(0, 24);
        const cel = path.join(SCHOWEK, `${klucz}.mp4`);
        const opis = path.join(SCHOWEK, `${klucz}.json`);
        if (fsSync.existsSync(cel) && fsSync.existsSync(opis)) return { plik: cel, ...JSON.parse(await fs.readFile(opis, 'utf8')), zSchowka: true };
        await fs.mkdir(SCHOWEK, { recursive: true });
        const tmp = path.join(SCHOWEK, `${klucz}.tmp.mp4`);
        const arg = JSON.stringify({ zrodlo: path.resolve(zrodlo), audio: path.resolve(audio), wyjscie: tmp, repo: REPO, modele: MODELE, ffmpeg: cfg.ffmpeg, fps: 25, przesuniecie: Number(przesuniecie) || 0 });
        const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_VERBOSITY: 'error', TQDM_DISABLE: '1' };
        let out;
        try {
            out = await cfg.skrypt(py, [SKRYPT_USTA, arg], { env, timeout: 30 * 60_000 });
        } catch (e) {
            await fs.rm(tmp, { force: true }).catch(() => {});
            const jak = e.killed ? 'przekroczyły 30 min' : e.signal ? `sygnał ${e.signal}` : opisKoduWyjscia(e.code);
            const sedno = sednoBledu(e.stderr);
            throw new Error(`Usta (MuseTalk) padły — ${jak}${sedno ? `: ${sedno}` : ''}`);
        }
        let wynik;
        try { wynik = JSON.parse(String(out).trim().split(/\r?\n/).pop()); } catch { throw new Error(`Usta oddały nieczytelny wynik: ${String(out).slice(-200)}`); }
        if (!fsSync.existsSync(tmp)) throw new Error('Usta nie zapisały klipu.');
        await fs.rename(tmp, cel);
        await fs.writeFile(opis, JSON.stringify(wynik), 'utf8');
        return { plik: cel, ...wynik, zSchowka: false };
    }

    /** Jedno generowanie naraz (GPU); kolejne czekają w kolejce. */
    function mow(o) {
        wToku++;
        const p = kolejka.then(() => mowTeraz(o)).finally(() => { wToku--; });
        kolejka = p.catch(() => {});
        return p;
    }

    return { stan, gotowy, instaluj, mow, katalog: KAT };
}

export default { utworzUsta, COMMIT_MUSETALK, LICENCJA_USTA };
