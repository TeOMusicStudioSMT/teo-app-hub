/**
 * 🧯 ShellSanitizer — Otak-Sync Watchdog (runtime ESM twin)
 *
 * Bliźniak runtime kanonicznego src/middleware/ApiDataSanitizer.ts dla mostu Node
 * (most jest czystym ESM-JS i nie może importować .ts). Logika MUSI pozostać
 * zsynchronizowana z ApiDataSanitizer.ts.
 *
 * Cel: usunąć zanieczyszczenia składniowe Linux/Unix z komendy ZANIM trafi do
 * powłoki Windows (cmd/PowerShell) — koniec z `'$' is not recognized as an
 * internal command`.
 *
 * Precyzja zamiast rzezi: NIE usuwamy każdego `$` (PowerShell: $env:, $null, $_;
 * kod TS: ${...}). Usuwamy tylko `$` w roli znacznika promptu powłoki.
 */

/**
 * @param {string} raw
 * @returns {{ command: string, changed: boolean, notes: string[] }}
 */
export function sanitizeShellCommand(raw) {
    const original = String(raw ?? '');
    let cmd = original;
    const notes = [];

    // 1) Znaczniki promptu powłoki na początku każdej linii: "$ ", "# ", "PS...> ", "> "
    if (/^[ \t]*(\$|#|PS[^>\n]*>|>)[ \t]+/m.test(cmd)) {
        cmd = cmd.replace(/^[ \t]*(?:\$|#|PS[^>\n]*>|>)[ \t]+/gm, '');
        notes.push('Usunięto znacznik promptu powłoki (np. wiodący "$ ").');
    }

    // 2) Wiodący "$" przyklejony do komendy: "$npm" → "npm" (nie rusza $env:, ${, $_)
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

export default { sanitizeShellCommand };
