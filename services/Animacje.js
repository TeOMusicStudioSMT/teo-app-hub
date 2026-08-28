/**
 * 🎬 Animacje — silnik HyperFrames dla App V2 i Story V2.
 *
 * DLACZEGO HYPERFRAMES, A NIE REMOTION:
 * Remotion jest darmowy dla osoby prywatnej i firmy DO 3 pracowników; powyżej
 * wymaga płatnej Company License, a modyfikowanie jego kodu pod odsprzedaż
 * pochodnych jest zabronione. Katedra jedzie na USB do innych węzłów — to jest
 * dokładnie ten kierunek, w którym taka licencja gryzie. HyperFrames jest na
 * Apache 2.0: render lokalny, bez opłat, bez chmury.
 *
 * ⚠️ TELEMETRIA: HyperFrames domyślnie wysyła anonimowe dane o użyciu. W Katedrze
 * to łamie „zero chmury", więc KAŻDE wywołanie dostaje HYPERFRAMES_NO_TELEMETRY=1
 * i DO_NOT_TRACK=1. Nie polegamy na globalnym przełączniku — ustawiamy w env.
 *
 * ⚠️ GSAP LOKALNIE: szablon HyperFrames ciągnie GSAP z jsdelivr. Przy renderze
 * bez internetu animacja by nie ruszyła, więc wstrzykujemy gsap.min.js z dysku.
 */
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

const WARSZTAT = path.join(process.cwd(), '_OtakOs_Animacje');
const PROJEKTY = path.join(WARSZTAT, 'projekty');
const GSAP = path.join(WARSZTAT, 'node_modules', 'gsap', 'dist', 'gsap.min.js');

/** Środowisko bez telemetrii — jedno miejsce prawdy. */
const SRODOWISKO = {
    ...process.env,
    HYPERFRAMES_NO_TELEMETRY: '1',
    DO_NOT_TRACK: '1',
};

function binarka() {
    const nazwa = process.platform === 'win32' ? 'hyperframes.cmd' : 'hyperframes';
    return path.join(WARSZTAT, 'node_modules', '.bin', nazwa);
}

/** Czy warsztat stoi? Zwraca prawdę o stanie, nie obietnicę. */
export async function stanAnimacji() {
    const wynik = { warsztat: WARSZTAT, silnik: false, gsapLokalny: false, ffmpeg: false, projekty: 0 };
    try { await fs.access(binarka()); wynik.silnik = true; } catch { /* brak */ }
    try { await fs.access(GSAP); wynik.gsapLokalny = true; } catch { /* brak */ }
    try { await execAsync('ffmpeg -version', { timeout: 10000, windowsHide: true }); wynik.ffmpeg = true; } catch { /* brak */ }
    try { wynik.projekty = (await fs.readdir(PROJEKTY)).length; } catch { /* jeszcze nic */ }
    return wynik;
}

const HF_JSON = JSON.stringify({
    $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json',
    paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' },
    media: { autoProxy: true },
}, null, 2);

/**
 * Zbuduj projekt HyperFrames na dysku i wyrenderuj MP4.
 * @param {string} id      nazwa projektu (slug)
 * @param {string} html    pełna treść index.html kompozycji
 */
export async function renderuj(id, html) {
    const slug = String(id).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'animacja';
    const katalog = path.join(PROJEKTY, slug);
    await fs.mkdir(katalog, { recursive: true });
    await fs.writeFile(path.join(katalog, 'hyperframes.json'), HF_JSON, 'utf8');

    // GSAP z dysku zamiast z CDN — render ma działać bez internetu.
    let tresc = html;
    try {
        const kod = await fs.readFile(GSAP, 'utf8');
        tresc = tresc.replace(
            /<script[^>]*src="https?:\/\/cdn\.jsdelivr\.net[^"]*gsap[^"]*"[^>]*><\/script>/i,
            `<script>${kod}</script>`,
        );
    } catch { /* brak gsap lokalnie — zostaje CDN, mówimy o tym w stanie */ }

    await fs.writeFile(path.join(katalog, 'index.html'), tresc, 'utf8');

    const { stdout, stderr } = await execAsync(`"${binarka()}" render`, {
        cwd: katalog, env: SRODOWISKO, timeout: 1800000,
        windowsHide: true, maxBuffer: 20 * 1024 * 1024,
    });

    // Ścieżkę bierzemy z DYSKU, nie z parsowania logu — log bywa kolorowany.
    let plik = null;
    try {
        const wpisy = await fs.readdir(path.join(katalog, 'renders'));
        const mp4 = wpisy.filter(w => w.endsWith('.mp4')).sort();
        if (mp4.length) plik = path.join(katalog, 'renders', mp4[mp4.length - 1]);
    } catch { /* nic nie powstało */ }
    if (!plik) {
        const ogon = String(stdout || '').split('\n').slice(-12).join('\n');
        throw new Error(`Render nie zostawił pliku MP4.\n${ogon}\n${String(stderr || '').slice(-500)}`);
    }

    const st = await fs.stat(plik);
    return {
        id: slug,
        plik,
        katalog,
        rozmiarKB: +(st.size / 1024).toFixed(1),
        log: String(stdout || '').split('\n').filter(l => !l.startsWith('[INFO]')).slice(-6).join('\n'),
    };
}

export const KATALOG_PROJEKTOW = PROJEKTY;
export default { stanAnimacji, renderuj, KATALOG_PROJEKTOW };
