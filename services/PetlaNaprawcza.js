/**
 * 🔁 Pętla naprawcza — migawka → wdrożenie → WERYFIKACJA → cofnięcie.
 *
 * CZEGO BRAKOWAŁO (stan przed 2026-08-27):
 * `/api/mechanic/apply` miał już strażnika ścieżek, blokadę urywków i Tarczę
 * Prawdy — ale po zapisie NIKT NIC NIE SPRAWDZAŁ. Łatka lądowała na dysku,
 * zadanie szło na DONE i tyle. Jeśli model wygenerował kod z błędem składni,
 * Katedra była zepsuta, a dowiadywał się o tym dopiero Suweren przy następnym
 * uruchomieniu. Kopia szła do `<plik>.bak` OBOK źródła: jedna generacja,
 * nadpisywana, bez związku z zadaniem, zaśmiecająca drzewo.
 *
 * Logi Suwerena pokazały, po co to jest: Mechanik zrobił 3 próby naprawy i
 * wszystkie wróciły z tym samym `Expected ")" but found ":"`.
 *
 * CO ROBI TERAZ:
 *   1. `migawka()`   — kopia pliku do _OtakOs_Kopie/naprawy/<taskId>/ z metryczką.
 *   2. `zweryfikuj()`— po zapisie sprawdza, czy plik się PARSUJE.
 *                      .js/.mjs/.cjs → `node --check` (szybkie, dokładne)
 *                      .ts/.tsx      → `tsc --noEmit` na projekcie (wolne, ale prawdziwe)
 *                      reszta        — mówimy WPROST, że nie sprawdzamy.
 *   3. `cofnij()`    — przywraca migawkę, gdy weryfikacja padła.
 *   4. `zapiszDoDziennika()` — każdy przebieg ląduje w dzienniku napraw, żeby
 *      model przy kolejnej próbie wiedział, co już nie zadziałało.
 *
 * ⚠️ „Zweryfikowane" znaczy TYLKO „parsuje się". To nie dowód, że łatka naprawiła
 * błąd — to dowód, że niczego nie rozwaliła. Mówimy to wprost w wyniku.
 */
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

const KOPIE = () => path.join(process.cwd(), '_OtakOs_Kopie', 'naprawy');
const DZIENNIK = () => path.join(KOPIE(), 'dziennik.jsonl');

/** Migawka pliku przed wdrożeniem. Zwraca ścieżkę kopii albo null (plik nowy). */
export async function migawka(taskId, sciezkaWzgledna, tresc) {
    if (tresc === null || tresc === undefined) return null;   // nowy plik — nie ma co kopiować
    const katalog = path.join(KOPIE(), String(taskId).replace(/[^a-z0-9_-]/gi, ''));
    await fs.mkdir(katalog, { recursive: true });

    // Płaska nazwa z zachowaniem ścieżki — inaczej dwa pliki o tej samej nazwie
    // z różnych katalogów nadpisałyby się nawzajem.
    const plaska = sciezkaWzgledna.replace(/[\\/]/g, '__');
    const cel = path.join(katalog, plaska);
    await fs.writeFile(cel, tresc, 'utf8');
    await fs.writeFile(path.join(katalog, 'metryczka.json'), JSON.stringify({
        taskId, plik: sciezkaWzgledna, kopia: plaska,
        znakow: tresc.length, kiedy: new Date().toISOString(),
    }, null, 2), 'utf8');
    return cel;
}

/**
 * Czy plik po zapisie w ogóle się parsuje.
 * Zwraca { sprawdzone, ok, czym, blad }.
 */
export async function zweryfikuj(sciezkaAbsolutna) {
    const ext = path.extname(sciezkaAbsolutna).toLowerCase();

    if (['.js', '.mjs', '.cjs'].includes(ext)) {
        try {
            await execAsync(`node --check "${sciezkaAbsolutna}"`, { timeout: 60000, windowsHide: true });
            return { sprawdzone: true, ok: true, czym: 'node --check' };
        } catch (e) {
            return { sprawdzone: true, ok: false, czym: 'node --check', blad: ostatnieLinie(e.stderr || e.message) };
        }
    }

    if (['.ts', '.tsx'].includes(ext)) {
        try {
            // Projektowo, bo pojedynczy plik TS bez reszty projektu i tak nie przejdzie.
            // Wolne (~1 min), ale to bramka wdrożeniowa — lepiej wolno niż na ślepo.
            await execAsync('npx tsc --noEmit', {
                cwd: process.cwd(), timeout: 600000, windowsHide: true, maxBuffer: 10 * 1024 * 1024,
            });
            return { sprawdzone: true, ok: true, czym: 'tsc --noEmit' };
        } catch (e) {
            return { sprawdzone: true, ok: false, czym: 'tsc --noEmit', blad: ostatnieLinie(e.stdout || e.message) };
        }
    }

    // Uczciwie: nie udajemy, że sprawdziliśmy .md, .json czy .css tym narzędziem.
    return {
        sprawdzone: false, ok: true, czym: 'brak',
        blad: `Rozszerzenie „${ext || 'bez'}" nie ma sprawdzarki — wdrożono BEZ weryfikacji.`,
    };
}

const ostatnieLinie = (t, ile = 8) =>
    String(t || '').trim().split(/\r?\n/).filter(Boolean).slice(-ile).join('\n');

/** Przywróć plik z migawki. Zwraca true, gdy się udało. */
export async function cofnij(sciezkaKopii, sciezkaAbsolutna) {
    if (!sciezkaKopii) return false;
    try {
        const tresc = await fs.readFile(sciezkaKopii, 'utf8');
        await fs.writeFile(sciezkaAbsolutna, tresc, 'utf8');
        return true;
    } catch {
        return false;
    }
}

/**
 * Dziennik napraw — po to, żeby model przy KOLEJNEJ próbie wiedział, co już
 * nie zadziałało. To nie jest douczanie modelu; to pamięć, którą można mu podać
 * w kontekście. Mówimy o tym wprost, bo „uczy się" bywa mylące.
 */
export async function zapiszDoDziennika(wpis) {
    try {
        await fs.mkdir(KOPIE(), { recursive: true });
        await fs.appendFile(DZIENNIK(), JSON.stringify({ kiedy: new Date().toISOString(), ...wpis }) + '\n', 'utf8');
    } catch { /* dziennik nie może wywrócić wdrożenia */ }
}

/** Co już próbowano dla danego pliku i z jakim skutkiem — kontekst dla modelu. */
export async function historiaNapraw(plik, ile = 5) {
    try {
        const tekst = await fs.readFile(DZIENNIK(), 'utf8');
        return tekst.trim().split('\n')
            .map(l => { try { return JSON.parse(l); } catch { return null; } })
            .filter(w => w && (!plik || w.plik === plik))
            .slice(-ile);
    } catch {
        return [];
    }
}

export default { migawka, zweryfikuj, cofnij, zapiszDoDziennika, historiaNapraw };
