/**
 * 🎞️ Montaż — OpenMontage jako studio produkcji wideo dla Story V2.
 *
 * ⚠️ DLACZEGO POZA KATEDRĄ (C:\OpenMontage, nie _OtakOs_Wiedza):
 * OpenMontage ma bardzo głębokie ścieżki (`.agents/skills/<nazwa>/references/<plik>.md`).
 * Klon do katalogu Katedry ZERWAŁ SIĘ — 2159 plików się nie wypakowało przez limit
 * MAX_PATH Windowsa. Zmierzone: ta sama komenda do `C:\om2` dała 0 braków.
 * Baza Katedry ma już ~60 znaków, więc studio musi mieszkać przy korzeniu dysku.
 * Ścieżkę można nadpisać zmienną OTAKOS_OPENMONTAGE.
 *
 * ⚠️ LICENCJA AGPLv3 z klauzulą sieciową. Dlatego trzymamy OpenMontage jako
 * OSOBNE NARZĘDZIE wołane procesem — nie kopiujemy jego kodu do Katedry.
 * Kod Katedry zostaje przy swojej licencji; AGPL dotyczy tego, co w C:\OpenMontage.
 * Wystawiając Backlot Kwantowym Tunelem, wystawiasz program AGPL — źródło musi
 * być dostępne dla korzystających (jest publiczne, o ile nie modyfikujesz repo).
 *
 * ⚠️ REMOTION ŚWIADOMIE NIEZAINSTALOWANY. OpenMontage wybiera silnik przy
 * propozycji (`render_runtime`): Remotion albo HyperFrames. Composera Remotion
 * NIE instalowaliśmy — jego licencja jest darmowa tylko do 3 pracowników, a
 * Katedra jedzie na USB. Pipeline'y na HyperFrames działają bez niego.
 */
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const STUDIO = process.env.OTAKOS_OPENMONTAGE || 'C:\\OpenMontage';
const PORT_BACKLOT = Number(process.env.OTAKOS_BACKLOT_PORT) || 7788;

const pythonVenv = () => path.join(STUDIO, '.venv', 'Scripts', process.platform === 'win32' ? 'python.exe' : 'python');

async function jest(p) {
    try { await fs.access(p); return true; } catch { return false; }
}

async function backlotZywy() {
    try {
        const ctrl = new AbortController();
        const z = setTimeout(() => ctrl.abort(), 2000);
        const r = await fetch(`http://127.0.0.1:${PORT_BACKLOT}/`, { signal: ctrl.signal });
        clearTimeout(z);
        return r.ok;
    } catch { return false; }
}

/** Stan studia — same fakty z dysku, zero obietnic. */
export async function stanMontazu() {
    const python = pythonVenv();
    const stan = {
        studio: STUDIO,
        zainstalowany: await jest(path.join(STUDIO, 'README.md')),
        venv: await jest(python),
        remotionComposer: await jest(path.join(STUDIO, 'remotion-composer', 'node_modules')),
        skilleAgentowe: 0,
        projekty: [],
        backlot: { port: PORT_BACKLOT, zywy: await backlotZywy() },
        silnikRenderu: 'hyperframes',
        licencja: 'AGPLv3 (klauzula sieciowa) — narzędzie osobne, kod Katedry nietknięty',
    };
    try { stan.skilleAgentowe = (await fs.readdir(path.join(STUDIO, '.agents', 'skills'))).length; } catch { /* brak */ }
    try {
        const p = await fs.readdir(path.join(STUDIO, 'projects'), { withFileTypes: true });
        stan.projekty = p.filter(x => x.isDirectory()).map(x => x.name);
    } catch { /* jeszcze żadnego */ }
    stan.gotowy = stan.zainstalowany && stan.venv;
    return stan;
}

/** Odpal tablicę Backlot w tle. Idempotentnie — żywej nie dubluje. */
export async function odpalBacklot() {
    if (await backlotZywy()) {
        return { juzDzialal: true, url: `http://127.0.0.1:${PORT_BACKLOT}/` };
    }
    const python = pythonVenv();
    if (!(await jest(python))) throw new Error(`Brak venv w ${STUDIO} — studio nie jest zainstalowane.`);
    const dziecko = spawn(python, ['-m', 'backlot', 'serve', '--port', String(PORT_BACKLOT)], {
        cwd: STUDIO, detached: true, stdio: 'ignore', windowsHide: true,
    });
    dziecko.unref();

    // Czekamy, aż realnie odpowie — „odpaliłem" bez sprawdzenia to obietnica, nie fakt.
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 700));
        if (await backlotZywy()) return { juzDzialal: false, url: `http://127.0.0.1:${PORT_BACKLOT}/` };
    }
    throw new Error(`Backlot nie odpowiedział na :${PORT_BACKLOT} w 14 s.`);
}

export const SCIEZKA_STUDIA = STUDIO;
export default { stanMontazu, odpalBacklot, SCIEZKA_STUDIA };
