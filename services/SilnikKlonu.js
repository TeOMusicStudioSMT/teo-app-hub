/**
 * 🎙️ Silnik klonu głosu (XTTS-v2 na :5002) — most go instaluje, odpala i mówi prawdę o jego stanie.
 *
 * HISTORIA (2026-10-04): launcher i most wołały `_OtakOs_AI/voice_server.py`, którego NIGDY nie było w repo —
 * stąd „kloner jakby nigdy nie był podłączony”. Teraz serwer leży w kodzie Katedry (`services/glos/voice_server.py`),
 * a środowisko zakłada most: `instaluj({ zgodaLicencji, cuda })` → `_OtakOs_AI/voice_env` (Python 3.10–3.12) →
 * PyTorch z CUDA pod sterownik → coqui-tts → zgoda na licencję modelu zapisana obok środowiska → start silnika.
 *
 * ⚖️ Model XTTS-v2 = Coqui Public Model License (użycie NIEKOMERCYJNE). Bez jawnej zgody Suwerena nic się nie instaluje.
 * Kto chce własny serwer zgodny z kontraktem, kładzie go jako `_OtakOs_AI/voice_server.py` — ma pierwszeństwo.
 * Wyłącz autostart: OTAKOS_GLOS_AUTOSTART=0 (launcher ustawia to sam, gdy odpalił silnik).
 */
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { koloTorch } from './KuzniaSoup.js';

const TUTAJ = path.dirname(fileURLToPath(import.meta.url));
export const SERWER_KATEDRY = path.join(TUTAJ, 'glos', 'voice_server.py');
export const WYMAGANIA = path.join(TUTAJ, 'glos', 'requirements-voice.txt');
export const PLIK_ZGODY = '.zgoda-cpml';

const stan = { uruchomiony: false, powod: 'jeszcze nie sprawdzano', pid: null };
const instalacja = { stan: 'brak', etap: null, log: [], blad: null, od: null, koniec: null, kolo: null, cuda: null };

const katalogSrodowiska = (aiDir) => path.join(aiDir, 'voice_env');
const pythonSrodowiska = (aiDir) => [path.join(katalogSrodowiska(aiDir), 'Scripts', 'python.exe'), path.join(katalogSrodowiska(aiDir), 'bin', 'python')].find((p) => fsSync.existsSync(p)) ?? null;
/** Serwer: własny Suwerena (`_OtakOs_AI/voice_server.py`) albo ten z kodu Katedry. */
export const serwerGlosu = (aiDir) => [path.join(aiDir, 'voice_server.py'), SERWER_KATEDRY].find((p) => fsSync.existsSync(p)) ?? null;
export const maZgode = (aiDir) => fsSync.existsSync(path.join(katalogSrodowiska(aiDir), PLIK_ZGODY));

async function odpowiada(base) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 1500);
    try { const r = await fetch(`${base}/`, { signal: c.signal }); return r.ok ? (await r.json().catch(() => ({}))) : null; } catch { return null; } finally { clearTimeout(t); }
}

/** Odpala silnik, jeśli nie odpowiada i da się go uruchomić. Zwraca stan (też z powodem, gdy się nie da). */
export async function zapewnij({ aiDir, base, log = console.log, spawnFn = spawn } = {}) {
    const zywy = await odpowiada(base);
    if (zywy) {
        const model = zywy.model ? ` (model: ${zywy.model}${zywy.blad ? ` — ${zywy.blad}` : ''})` : '';
        return Object.assign(stan, { uruchomiony: true, powod: `działa${model}`, model: zywy.model ?? null });
    }
    if (process.env.OTAKOS_GLOS_AUTOSTART === '0') return Object.assign(stan, { powod: 'wyłączony (OTAKOS_GLOS_AUTOSTART=0)' });
    if (stan.pid) return stan;   // już go odpaliliśmy, ładuje model
    const serwer = serwerGlosu(aiDir);
    const python = pythonSrodowiska(aiDir);
    if (!serwer) return Object.assign(stan, { powod: 'brak services/glos/voice_server.py — zaktualizuj Katedrę' });
    if (!python) return Object.assign(stan, { powod: 'silnik nie jest zainstalowany — Studio Podcastu / panel głosu → „Zainstaluj silnik klonu” (XTTS-v2)' });
    try {
        const env = { ...process.env, ...(maZgode(aiDir) ? { COQUI_TOS_AGREED: '1' } : {}) };
        const p = spawnFn(python, [serwer], { cwd: aiDir, env, detached: true, stdio: 'ignore', windowsHide: true });
        p.on?.('error', (e) => { stan.pid = null; stan.powod = `nie wystartował: ${e.message}`; });
        p.on?.('exit', (kod) => { stan.pid = null; stan.uruchomiony = false; stan.powod = `zakończył się (kod ${kod})`; });
        p.unref?.();
        stan.pid = p.pid ?? null; stan.powod = 'odpalony przez most (ładuje model — za pierwszym razem pobiera ~1,8 GB)';
        log(`🎙️ Silnik klonu głosu odpalony przez most (pid ${stan.pid}).`);
    } catch (e) { stan.powod = `nie wystartował: ${e.message}`; }
    return stan;
}

/** Python 3.10–3.12 (coqui-tts i torch): OTAKOS_PYTHON → `_OtakOs_AI/python312` → py -3.12/-3.11/-3.10 → python3.x. */
async function znajdzPythona(aiDir, zbierz) {
    const win = process.platform === 'win32';
    const wKatedrze = win ? path.join(aiDir, 'python312', 'python.exe') : path.join(aiDir, 'python312', 'bin', 'python3');
    const proby = [
        process.env.OTAKOS_PYTHON && [process.env.OTAKOS_PYTHON, []],
        fsSync.existsSync(wKatedrze) && [wKatedrze, []],
        ...(win ? [['py', ['-3.12']], ['py', ['-3.11']], ['py', ['-3.10']]] : [['python3.12', []], ['python3.11', []], ['python3.10', []], ['python3', []]]),
    ].filter(Boolean);
    for (const [pol, argi] of proby) {
        try {
            const w = await zbierz(pol, [...argi, '-c', 'import sys;print(sys.version_info[0], sys.version_info[1])']);
            const [a, b] = String(w.linie.at(-1) ?? '').trim().split(/\s+/).map(Number);
            if (w.kod === 0 && a === 3 && b >= 10 && b <= 12) return { polecenie: pol, argi, wersja: `${a}.${b}` };
        } catch { /* następna */ }
    }
    return null;
}

function domyslneUruchom(polecenie, argumenty, { cwd, env, naLinie = () => {} } = {}) {
    return new Promise((resolve, reject) => {
        const d = spawn(polecenie, argumenty, { cwd, env, windowsHide: true });
        let reszta = '';
        const czytaj = (b) => { reszta += b.toString('utf8'); const l = reszta.split(/\r?\n/); reszta = l.pop() ?? ''; l.filter(Boolean).forEach(naLinie); };
        d.stdout.on('data', czytaj); d.stderr.on('data', czytaj);
        d.on('error', reject);
        d.on('close', (kod) => { if (reszta) naLinie(reszta); resolve(kod); });
    });
}
const zbierzDomyslnie = (uruchom) => async (pol, argi) => { const linie = []; const kod = await uruchom(pol, argi, { naLinie: (l) => linie.push(l) }); return { kod, linie }; };

/**
 * Instalacja silnika W KATEDRZE (w tle, z dziennikiem). Wymaga `zgodaLicencji: true` (CPML — niekomercyjnie).
 * `cuda`: 'auto' (z nvidia-smi) | 'cpu' | 'cu128'…  Po instalacji od razu odpala silnik.
 */
export function instaluj({ aiDir, base, zgodaLicencji = false, cuda = 'auto', uruchom = domyslneUruchom, log = console.log } = {}) {
    if (!zgodaLicencji) throw new Error('Silnik klonu używa modelu XTTS-v2 na licencji CPML (tylko użycie niekomercyjne) — potwierdź zgodę, żeby zainstalować.');
    if (instalacja.stan === 'trwa') throw new Error(`Instalacja już trwa (${instalacja.etap}).`);
    Object.assign(instalacja, { stan: 'trwa', etap: 'start', log: [], blad: null, od: new Date().toISOString(), koniec: null, kolo: null, cuda: null });
    const loguj = (l) => { instalacja.log.push(String(l).slice(0, 300)); if (instalacja.log.length > 300) instalacja.log.splice(0, instalacja.log.length - 300); };
    const zbierz = zbierzDomyslnie(uruchom);
    const venv = katalogSrodowiska(aiDir);
    const krok = async (opis, pol, argi) => {
        instalacja.etap = opis; loguj(`▶ ${opis}: ${path.basename(pol)} ${argi.join(' ')}`);
        const kod = await uruchom(pol, argi, { cwd: aiDir, env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' }, naLinie: loguj });
        if (kod !== 0) throw new Error(`${opis}: zakończone kodem ${kod} — szczegóły w dzienniku.`);
    };
    (async () => {
        try {
            await fs.mkdir(aiDir, { recursive: true });
            instalacja.etap = 'szukam Pythona 3.10–3.12';
            const p = await znajdzPythona(aiDir, zbierz);
            if (!p) throw new Error('Nie ma Pythona 3.10–3.12 (coqui-tts nie wspiera 3.13). Zainstaluj Python 3.12 z python.org — Katedra znajdzie go przez „py -3.12”.');
            loguj(`Python ${p.wersja}: ${p.polecenie} ${p.argi.join(' ')}`);
            let kolo = cuda;
            if (cuda === 'auto') {
                const smi = await zbierz('nvidia-smi', []).catch(() => ({ kod: 1, linie: [] }));
                kolo = koloTorch(smi.linie.join('\n')) ?? 'cpu';
                loguj(kolo === 'cpu' ? 'nvidia-smi nie odpowiada — PyTorch bez CUDA (mowa na procesorze: wolno, ale działa).' : `sterownik NVIDIA → koło PyTorch ${kolo}`);
            }
            instalacja.kolo = kolo;
            if (!pythonSrodowiska(aiDir)) await krok('tworzę środowisko (voice_env)', p.polecenie, [...p.argi, '-m', 'venv', venv]);
            const py = pythonSrodowiska(aiDir);
            if (!py) throw new Error('Środowisko nie powstało — szczegóły w dzienniku.');
            await krok('aktualizuję pip', py, ['-m', 'pip', 'install', '--upgrade', 'pip']);
            if (kolo !== 'cpu') await krok(`PyTorch z CUDA (${kolo})`, py, ['-m', 'pip', 'install', 'torch', 'torchaudio', '--index-url', `https://download.pytorch.org/whl/${kolo}`]);
            await krok('coqui-tts (XTTS-v2)', py, ['-m', 'pip', 'install', '-r', WYMAGANIA]);
            await fs.writeFile(path.join(venv, PLIK_ZGODY), `Zgoda Suwerena na Coqui Public Model License (XTTS-v2, użycie niekomercyjne): ${new Date().toISOString()}\n`, 'utf8');
            instalacja.etap = 'sprawdzam';
            const t = await zbierz(py, ['-c', 'import torch, TTS; print(torch.__version__, torch.cuda.is_available(), TTS.__version__)']);
            loguj(`torch / TTS: ${t.linie.at(-1) ?? '?'}`);
            if (t.kod !== 0) throw new Error('coqui-tts zainstalowany, ale się nie importuje — szczegóły w dzienniku.');
            instalacja.cuda = /\bTrue\b/.test(t.linie.at(-1) ?? '');
            instalacja.stan = 'gotowe';
            log(`🎙️ Silnik klonu zainstalowany (${instalacja.cuda ? 'CUDA' : 'procesor'}).`);
            stan.pid = null;
            await zapewnij({ aiDir, base, log });
        } catch (e) {
            instalacja.stan = 'blad'; instalacja.blad = String(e.message || e).slice(0, 400);
        } finally { instalacja.koniec = new Date().toISOString(); }
    })();
    return stanInstalacji();
}

export const stanSilnika = () => ({ ...stan });
export const stanInstalacji = () => ({ ...instalacja, log: instalacja.log.slice(-40) });
export default { zapewnij, instaluj, stanSilnika, stanInstalacji, serwerGlosu, maZgode, SERWER_KATEDRY };
