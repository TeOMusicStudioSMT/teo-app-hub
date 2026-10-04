/**
 * 🎙️ Silnik klonu głosu (:5002) — most go instaluje, odpala i mówi prawdę o jego stanie.
 *
 * HISTORIA (2026-10-04): launcher i most wołały `_OtakOs_AI/voice_server.py`, którego NIGDY nie było w repo —
 * stąd „kloner jakby nigdy nie był podłączony”. Teraz serwer leży w kodzie Katedry (`services/glos/voice_server.py`),
 * a środowisko zakłada most: `instaluj({ silnik, cuda })` → Python 3.10–3.12 → venv → PyTorch pod sterownik → silnik.
 *
 * SILNIKI (każdy we własnym środowisku — mają sprzeczne zależności):
 *   • chatterbox (DOMYŚLNY) — Chatterbox Multilingual, Resemble AI, licencja MIT: wolno KOMERCYJNIE (Suweren 2026-10-04:
 *     „zależy mi na twórczości, pokazywaniu jej i zarabianiu”). `_OtakOs_AI/glos_chatterbox`. Znak wodny Perth w nagraniu.
 *   • xtts — XTTS-v2 (coqui-tts), ⚖️ CPML = tylko niekomercyjnie; wymaga `zgodaLicencji`. `_OtakOs_AI/voice_env` (stary launcher).
 * Aktywny silnik: `_OtakOs_AI/glos_silnik.txt` (pisze instalator po sukcesie), inaczej pierwszy zainstalowany.
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
export const PLIK_ZGODY = '.zgoda-cpml';
export const SILNIK_DOMYSLNY = 'chatterbox';
export const SILNIKI = {
    chatterbox: {
        nazwa: 'Chatterbox Multilingual (Resemble AI)', katalog: 'glos_chatterbox', zgoda: false,
        licencja: 'MIT — wolno używać komercyjnie (nagrania niosą niesłyszalny znak wodny Perth)',
        wymagania: path.join(TUTAJ, 'glos', 'requirements-chatterbox.txt'), pakiet: ['chatterbox-tts==0.1.7', '--no-deps'],
        sprawdz: 'import torch, chatterbox; print(torch.__version__, torch.cuda.is_available(), chatterbox.__version__)',
        model: '~3 GB z HuggingFace (ResembleAI/chatterbox)',
    },
    xtts: {
        nazwa: 'XTTS-v2 (coqui-tts)', katalog: 'voice_env', zgoda: true,
        licencja: 'Coqui Public Model License (CPML) — TYLKO użycie niekomercyjne',
        wymagania: path.join(TUTAJ, 'glos', 'requirements-xtts.txt'), pakiet: null,
        sprawdz: 'import torch, TTS; print(torch.__version__, torch.cuda.is_available(), TTS.__version__)',
        model: '~1,8 GB (coqui)',
    },
};

const stan = { uruchomiony: false, powod: 'jeszcze nie sprawdzano', pid: null, silnik: null };
const instalacja = { stan: 'brak', etap: null, log: [], blad: null, od: null, koniec: null, kolo: null, cuda: null, silnik: null };
let proces = null;   // silnik odpalony przez most (da się go zrestartować po zmianie silnika)

const plikAktywnego = (aiDir) => path.join(aiDir, 'glos_silnik.txt');
const katalogSrodowiska = (aiDir, silnik) => path.join(aiDir, SILNIKI[silnik].katalog);
const pythonSrodowiska = (aiDir, silnik) => [path.join(katalogSrodowiska(aiDir, silnik), 'Scripts', 'python.exe'), path.join(katalogSrodowiska(aiDir, silnik), 'bin', 'python')].find((p) => fsSync.existsSync(p)) ?? null;
/** Zainstalowane silniki (jest python w ich środowisku). */
export const zainstalowane = (aiDir) => Object.keys(SILNIKI).filter((s) => pythonSrodowiska(aiDir, s));
/** Aktywny silnik: wybrany przy instalacji → pierwszy zainstalowany (chatterbox przed xtts) → null. */
export function aktywnySilnik(aiDir) {
    const zapisany = (() => { try { return fsSync.readFileSync(plikAktywnego(aiDir), 'utf8').trim(); } catch { return ''; } })();
    const jest = zainstalowane(aiDir);
    return jest.includes(zapisany) ? zapisany : (jest[0] ?? null);
}
/** Serwer: własny Suwerena (`_OtakOs_AI/voice_server.py`) albo ten z kodu Katedry. */
export const serwerGlosu = (aiDir) => [path.join(aiDir, 'voice_server.py'), SERWER_KATEDRY].find((p) => fsSync.existsSync(p)) ?? null;
export const maZgode = (aiDir) => fsSync.existsSync(path.join(katalogSrodowiska(aiDir, 'xtts'), PLIK_ZGODY));

async function odpowiada(base) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 1500);
    try { const r = await fetch(`${base}/`, { signal: c.signal }); return r.ok ? (await r.json().catch(() => ({}))) : null; } catch { return null; } finally { clearTimeout(t); }
}

/** Środowisko procesu silnika: cache modeli HuggingFace w Katedrze (własne HF_HOME Suwerena wygrywa), zgoda CPML dla XTTS. */
const envSilnika = (aiDir, silnik) => ({
    ...process.env,
    OTAKOS_GLOS_SILNIK: silnik,
    HF_HOME: process.env.HF_HOME || path.join(aiDir, 'glos_modele'),
    ...(silnik === 'xtts' && maZgode(aiDir) ? { COQUI_TOS_AGREED: '1' } : {}),
});

/** Odpala silnik, jeśli nie odpowiada i da się go uruchomić. Zwraca stan (też z powodem, gdy się nie da). */
export async function zapewnij({ aiDir, base, log = console.log, spawnFn = spawn } = {}) {
    const zywy = await odpowiada(base);
    if (zywy) {
        const model = zywy.model ? ` (model: ${zywy.model}${zywy.blad ? ` — ${zywy.blad}` : ''})` : '';
        return Object.assign(stan, { uruchomiony: true, powod: `działa: ${zywy.silnik ?? '?'}${model}`, model: zywy.model ?? null, silnik: zywy.silnik ?? null });
    }
    if (process.env.OTAKOS_GLOS_AUTOSTART === '0') return Object.assign(stan, { powod: 'wyłączony (OTAKOS_GLOS_AUTOSTART=0)' });
    if (stan.pid) return stan;   // już go odpaliliśmy, ładuje model
    const serwer = serwerGlosu(aiDir);
    const silnik = aktywnySilnik(aiDir);
    if (!serwer) return Object.assign(stan, { powod: 'brak services/glos/voice_server.py — zaktualizuj Katedrę' });
    if (!silnik) return Object.assign(stan, { powod: 'silnik nie jest zainstalowany — 🎙️ → 🎛️ Studio Podcastu → „Zainstaluj silnik klonu” (Chatterbox, MIT)' });
    try {
        const p = spawnFn(pythonSrodowiska(aiDir, silnik), [serwer], { cwd: aiDir, env: envSilnika(aiDir, silnik), detached: true, stdio: 'ignore', windowsHide: true });
        p.on?.('error', (e) => { stan.pid = null; proces = null; stan.powod = `nie wystartował: ${e.message}`; });
        p.on?.('exit', (kod) => { stan.pid = null; proces = null; stan.uruchomiony = false; stan.powod = `zakończył się (kod ${kod})`; });
        p.unref?.();
        proces = p;
        stan.pid = p.pid ?? null; stan.silnik = silnik;
        stan.powod = `odpalony przez most: ${SILNIKI[silnik].nazwa} (ładuje model — za pierwszym razem pobiera ${SILNIKI[silnik].model})`;
        log(`🎙️ Silnik klonu ${silnik} odpalony przez most (pid ${stan.pid}).`);
    } catch (e) { stan.powod = `nie wystartował: ${e.message}`; }
    return stan;
}

/** Po zmianie silnika: zatrzymaj ten, który odpalił most, i odpal aktywny. Obcego procesu nie ruszamy — mówimy wprost. */
async function przelacz({ aiDir, base, log }) {
    if (proces) { try { proces.kill(); } catch { /* już nie żyje */ } proces = null; stan.pid = null; await new Promise((r) => setTimeout(r, 1500)); }
    const zywy = await odpowiada(base);
    const chce = aktywnySilnik(aiDir);
    if (zywy && zywy.silnik && chce && zywy.silnik !== (chce === 'xtts' ? 'xtts_v2' : chce)) {
        return Object.assign(stan, { powod: `na :5002 działa ${zywy.silnik} odpalony poza mostem — zamknij go (np. okno START_KATEDRA), most odpali ${chce}` });
    }
    return zapewnij({ aiDir, base, log });
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
 * Instalacja silnika W KATEDRZE (w tle, z dziennikiem). `silnik`: 'chatterbox' (domyślny, MIT) | 'xtts' (wymaga
 * `zgodaLicencji: true` — CPML, tylko niekomercyjnie). `cuda`: 'auto' (z nvidia-smi) | 'cpu' | 'cu128'…
 * Po instalacji silnik staje się aktywny i most od razu go odpala (restart, jeśli wcześniej odpalił inny).
 */
export function instaluj({ aiDir, base, silnik = SILNIK_DOMYSLNY, zgodaLicencji = false, cuda = 'auto', uruchom = domyslneUruchom, log = console.log } = {}) {
    const S = SILNIKI[silnik];
    if (!S) throw new Error(`Nie znam silnika „${silnik}” (są: ${Object.keys(SILNIKI).join(', ')}).`);
    if (S.zgoda && !zgodaLicencji) throw new Error('XTTS-v2 jest na licencji CPML (tylko użycie niekomercyjne) — potwierdź zgodę albo wybierz Chatterbox (MIT, wolno komercyjnie).');
    if (instalacja.stan === 'trwa') throw new Error(`Instalacja już trwa (${instalacja.etap}).`);
    Object.assign(instalacja, { stan: 'trwa', etap: 'start', log: [], blad: null, od: new Date().toISOString(), koniec: null, kolo: null, cuda: null, silnik });
    const loguj = (l) => { instalacja.log.push(String(l).slice(0, 300)); if (instalacja.log.length > 300) instalacja.log.splice(0, instalacja.log.length - 300); };
    const zbierz = zbierzDomyslnie(uruchom);
    const venv = katalogSrodowiska(aiDir, silnik);
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
            if (!p) throw new Error('Nie ma Pythona 3.10–3.12 (silniki głosu nie wspierają jeszcze 3.13). Zainstaluj Python 3.12 z python.org — Katedra znajdzie go przez „py -3.12”.');
            loguj(`Python ${p.wersja}: ${p.polecenie} ${p.argi.join(' ')}`);
            let kolo = cuda;
            if (cuda === 'auto') {
                const smi = await zbierz('nvidia-smi', []).catch(() => ({ kod: 1, linie: [] }));
                kolo = koloTorch(smi.linie.join('\n')) ?? 'cpu';
                loguj(kolo === 'cpu' ? 'nvidia-smi nie odpowiada — PyTorch bez CUDA (mowa na procesorze: wolno, ale działa).' : `sterownik NVIDIA → koło PyTorch ${kolo}`);
            }
            instalacja.kolo = kolo;
            if (!pythonSrodowiska(aiDir, silnik)) await krok(`tworzę środowisko (${S.katalog})`, p.polecenie, [...p.argi, '-m', 'venv', venv]);
            const py = pythonSrodowiska(aiDir, silnik);
            if (!py) throw new Error('Środowisko nie powstało — szczegóły w dzienniku.');
            await krok('aktualizuję pip', py, ['-m', 'pip', 'install', '--upgrade', 'pip']);
            await krok(kolo === 'cpu' ? 'PyTorch (procesor)' : `PyTorch z CUDA (${kolo})`, py, ['-m', 'pip', 'install', 'torch', 'torchaudio', '--index-url', `https://download.pytorch.org/whl/${kolo}`]);
            await krok(`zależności: ${S.nazwa}`, py, ['-m', 'pip', 'install', '-r', S.wymagania]);
            if (S.pakiet) await krok(S.nazwa, py, ['-m', 'pip', 'install', ...S.pakiet]);
            if (S.zgoda) await fs.writeFile(path.join(venv, PLIK_ZGODY), `Zgoda Suwerena na Coqui Public Model License (XTTS-v2, użycie niekomercyjne): ${new Date().toISOString()}\n`, 'utf8');
            await fs.writeFile(path.join(venv, '.silnik'), silnik, 'utf8');
            instalacja.etap = 'sprawdzam';
            const t = await zbierz(py, ['-c', S.sprawdz]);
            loguj(`sprawdzenie: ${t.linie.at(-1) ?? '?'}`);
            if (t.kod !== 0) throw new Error(`${S.nazwa} zainstalowany, ale się nie importuje — szczegóły w dzienniku.`);
            instalacja.cuda = /\bTrue\b/.test(t.linie.at(-1) ?? '');
            await fs.writeFile(plikAktywnego(aiDir), silnik, 'utf8');
            instalacja.stan = 'gotowe';
            log(`🎙️ Silnik klonu ${silnik} zainstalowany (${instalacja.cuda ? 'CUDA' : 'procesor'}).`);
            await przelacz({ aiDir, base, log });
        } catch (e) {
            instalacja.stan = 'blad'; instalacja.blad = String(e.message || e).slice(0, 400);
        } finally { instalacja.koniec = new Date().toISOString(); }
    })();
    return stanInstalacji();
}

export const stanSilnika = () => ({ ...stan });
export const stanInstalacji = () => ({ ...instalacja, log: instalacja.log.slice(-40) });
export default { zapewnij, instaluj, stanSilnika, stanInstalacji, serwerGlosu, maZgode, aktywnySilnik, zainstalowane, SILNIKI, SERWER_KATEDRY };
