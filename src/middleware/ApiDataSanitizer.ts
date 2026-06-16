/**
 * 🧯 ApiDataSanitizer v1.0 — API Gateway Sanitizer / Otak-Sync Watchdog (canonical)
 *
 * Standaryzacja powłoki: usuwa zanieczyszczenia składniowe Linux/Unix z komend,
 * zanim trafią do powłoki Windows (cmd/PowerShell). Powstało po paraliżu
 * wykonawczym: `'$' is not recognized as an internal command` — gdy do cmd
 * trafiał wklejony znacznik promptu powłoki (`$ npm run build`).
 *
 * WAŻNE — precyzja zamiast rzezi:
 *   NIE usuwamy KAŻDEGO znaku `$`. PowerShell legalnie używa `$env:`, `$null`,
 *   `$_`, a kod TS używa template literals `${...}`. Usuwamy WYŁĄCZNIE `$` pełniący
 *   rolę znacznika promptu powłoki (wiodący `$ ` / `$` przyklejony do komendy).
 *
 * Bliźniak runtime (ESM, dla mostu Node): services/ShellSanitizer.js — logika
 * MUSI pozostać zsynchronizowana z tym plikiem.
 */

export interface SanitizeResult {
    /** Oczyszczona komenda gotowa dla powłoki Windows. */
    command: string;
    /** Czy cokolwiek zmieniono względem wejścia. */
    changed: boolean;
    /** Czytelne notki diagnostyczne (do logu Szmaragdowego Terminala). */
    notes: string[];
}

/**
 * Odkaża pojedynczą komendę shell pod powłokę Windows.
 * Bezpieczne dla PowerShell ($env:, $null, $_) i kodu TS (${...}).
 */
export function sanitizeShellCommand(raw: string): SanitizeResult {
    const original = String(raw ?? '');
    let cmd = original;
    const notes: string[] = [];

    // 1) Znaczniki promptu powłoki na początku KAŻDEJ linii: "$ ", "# ", "PS...> ", "> "
    if (/^[ \t]*(\$|#|PS[^>\n]*>|>)[ \t]+/m.test(cmd)) {
        cmd = cmd.replace(/^[ \t]*(?:\$|#|PS[^>\n]*>|>)[ \t]+/gm, '');
        notes.push('Usunięto znacznik promptu powłoki (np. wiodący "$ ").');
    }

    // 2) Pojedynczy wiodący "$" przyklejony do komendy: "$npm" → "npm"
    //    (tylko gdy zaraz po $ jest litera — NIE rusza "$env:", "${", "$_")
    if (/^[ \t]*\$(?=[A-Za-z][A-Za-z0-9_-]*\s)/m.test(cmd)) {
        cmd = cmd.replace(/^([ \t]*)\$(?=[A-Za-z][A-Za-z0-9_-]*\s)/gm, '$1');
        notes.push('Usunięto wiodący "$" przyklejony do nazwy komendy.');
    }

    // 3) Linux NUL device → PowerShell: 2>/dev/null → 2>$null
    if (/\/dev\/null/.test(cmd)) {
        cmd = cmd.replace(/(\d*)>\s*\/dev\/null/g, (_m, fd) => `${fd}>$null`);
        notes.push('Zamieniono /dev/null -> $null (PowerShell).');
    }

    // 4) Linux line-continuation (backslash na końcu linii) → backtick (PowerShell)
    if (/[ \t]+\\\r?\n/.test(cmd)) {
        cmd = cmd.replace(/[ \t]+\\(\r?\n)/g, (_m, nl) => ` \`${nl}`);
        notes.push('Zamieniono kontynuację linii "\\" -> "`" (PowerShell).');
    }

    cmd = cmd.trim();
    return { command: cmd, changed: cmd !== original.trim(), notes };
}

/**
 * Odkaża dowolny payload danych API: rekurencyjnie usuwa znaki sterujące
 * i normalizuje końce linii w stringach. NIE rusza `$` (to nie jest shell).
 */
export function sanitizeApiData<T>(data: T): T {
    if (typeof data === 'string') {
        // Usuń znaki sterujące poza \t(09) \n(0A) \r(0D); znormalizuj CRLF
        // eslint-disable-next-line no-control-regex
        return data.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/\r\n/g, '\n') as unknown as T;
    }
    if (Array.isArray(data)) {
        return data.map(v => sanitizeApiData(v)) as unknown as T;
    }
    if (data && typeof data === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
            out[k] = sanitizeApiData(v);
        }
        return out as unknown as T;
    }
    return data;
}

export default { sanitizeShellCommand, sanitizeApiData };
