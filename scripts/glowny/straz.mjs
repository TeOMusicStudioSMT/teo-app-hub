#!/usr/bin/env node
/**
 * 🛡️ Straż Głównego — hook PreToolUse Claude Code (services/Glowny.js wpina go przez `--settings`).
 *
 * Suweren (2026-10-01): „dużo kwestii zgody na przeczytanie… niepotrzebne. Tylko najważniejsze — jak edycja głównych
 * plików Katedry. A w przypadku tworzenia nowych rzeczy powinna być swoboda."
 *
 *   ✅ bez pytania: polecenia TYLKO DO ODCZYTU (ls, cat, git status, ffprobe, curl GET do mostu…), polecenia stada
 *      (katedra.mjs), NOWE pliki w Katedrze, zmiany w katalogach roboczych `_OtakOs_*` i w dodatkowych katalogach.
 *   ✋ za zgodą (prośba z Tłumaczem): zmiana ISTNIEJĄCEGO pliku rdzenia Katedry (kod, konfiguracja), sekrety,
 *      zapis poza Katedrą, każde inne polecenie powłoki.
 *
 * Zgody Suwerena przychodzą w `OTAKOS_GLOWNY_ZGODY` (JSON: polecenia Bash i klucze `plik:<pełna ścieżka>`).
 * Powód odmowy widzi model — mówimy mu wprost, żeby nie ponawiał w innej formie (tak się zapętlał).
 */
import fs from 'fs';
import path from 'path';

/** Pliki, których nie zmienia się bez Suwerena nawet w katalogach roboczych. */
const SEKRET = /(^|[\\/])(\.env(\.[\w-]+)?|media_secrets\.json|identity\.json|[^\\/]*\.(key|pem|pfx|p12|keystore|jks))$/i;

/** Jedna część polecenia (bez && ; |), która tylko czyta albo tworzy NOWE (katalog, pusty plik). */
const ODCZYT = [
    /^(ls|dir|pwd|cd|cat|type|head|tail|wc|echo|which|where|whoami|hostname|date|tree|stat|file|du|df|uname|basename|dirname|realpath|sort|uniq|cut|tr|less|more|findstr|nvidia-smi)(\s|$)/i,
    /^(grep|rg|egrep)\s/i,
    /^find\s(?!(.*\s)?-(delete|exec|execdir|ok|okdir|fprint\w*|fls)\b)/i,
    /^ffprobe\s/i,
    /^ffmpeg\s+(-hide_banner\s+)?-(version|formats|codecs|encoders|decoders|filters|h|help)\b/i,
    /^git\s+(status|diff|log|show|remote(\s+-v)?$|branch(\s+(-a|-r|-v|-vv|--list))*$|rev-parse|ls-files|blame)\b/i,
    /^node\s+(--check|-c|-v|--version)\b/i,
    /^(npm|pnpm|yarn|python\S*|py|pip3?|ollama|claude)\s+(-v|-V|--version)$/i,
    /^ollama\s+(list|ls|ps|show)\b/i,
    // Tworzenie bez niszczenia: nowy katalog, pusty plik (istniejącemu touch zmienia tylko datę).
    /^(mkdir|md)(\s+(-p|--parents))?\s+[^-]/i,
    /^touch\s+[^-]/i,
    /^New-Item\s[^\n]*-ItemType\s+Directory\b/i,
    /^(curl|wget)\s(?!(.*\s)?(-X|--request|-d|--data[\w-]*|-F|--form|-T|--upload-file|-o|--output|-O)\b)[^\n]*https?:\/\/(127\.0\.0\.1|localhost)[:/]/i,
    /^(Get-ChildItem|Get-Content|Get-Item|Test-Path|Get-Location|gci|gc|Get-Process)\b/i,
];

/** Przekierowania, które nie piszą do pliku. */
const BEZPIECZNE_PRZEKIEROWANIE = /\d?>&\d|\d?>\s*(\/dev\/null|nul)\b/gi;

/** Czy całe polecenie tylko czyta (każda część; bez zapisu do pliku przez > i bez podstawień). */
export function tylkoOdczyt(polecenie) {
    const c = String(polecenie ?? '').trim();
    if (!c || /`|\$\(|<\(|\n/.test(c)) return false;
    if (/>/.test(c.replace(BEZPIECZNE_PRZEKIEROWANIE, ''))) return false;
    const czesci = c.split(/\s*(?:&&|\|\||;|\|)\s*/).map((x) => x.trim()).filter(Boolean);
    return czesci.length > 0 && czesci.every((x) => ODCZYT.some((r) => r.test(x)));
}

const POLECENIA_STADA = /^node\s+("?)(\.\/)?scripts[\\/]glowny[\\/]katedra\.mjs\1(\s|$)/;

/** Podpowiedź do odmowy — gdy Katedra ma na to własną moc. */
function podpowiedz(polecenie) {
    if (/\bffmpeg\b|\bmoviepy\b|\bcv2\b/i.test(polecenie)) return ' Wideo zrobisz BEZ zgody mocą Katedry: node scripts/glowny/katedra.mjs wideo przytnij <plik> <od_s> [do_s] | wideo potnij <plik> <s> | wideo pliki.';
    return ' Sprawdź też: node scripts/glowny/katedra.mjs moce.';
}

const CZEKA = 'Czeka na zgodę Suwerena — dostanie prośbę z wyjaśnieniem. NIE ponawiaj tego w innej formie i nie obchodź (inne polecenie, Python, skrypt). Zrób, co się da bez tego, albo zakończ turę krótkim podsumowaniem.';

const wnetrze = (p, dir) => { const r = path.relative(dir, p); return r === '' || (!!r && !r.startsWith('..') && !path.isAbsolute(r)); };

/**
 * Decyzja Straży.
 * @param {{ tool_name: string, tool_input: object, cwd?: string }} zdarzenie
 * @param {{ katedra: string, wolne?: string[], zgody?: string[], istnieje?: (p: string) => boolean }} o
 * @returns {{ decyzja: 'allow'|'ask', powod: string }}
 */
export function ocen(zdarzenie, { katedra, wolne = [], zgody = [], istnieje = fs.existsSync }) {
    const narzedzie = zdarzenie?.tool_name;
    const we = zdarzenie?.tool_input ?? {};
    if (narzedzie === 'Bash') {
        const c = String(we.command ?? '').trim();
        if (zgody.includes(c)) return { decyzja: 'allow', powod: 'Zgoda Suwerena.' };
        if (POLECENIA_STADA.test(c) && !/[;&|`>]|\$\(/.test(c)) return { decyzja: 'allow', powod: 'Polecenie stada.' };
        if (tylkoOdczyt(c)) return { decyzja: 'allow', powod: 'Tylko odczyt albo tworzenie nowego.' };
        return { decyzja: 'ask', powod: `${CZEKA}${podpowiedz(c)}` };
    }
    if (['Edit', 'MultiEdit', 'Write', 'NotebookEdit'].includes(narzedzie)) {
        const surowa = we.file_path ?? we.notebook_path ?? '';
        if (!surowa) return { decyzja: 'ask', powod: CZEKA };
        const p = path.resolve(zdarzenie.cwd || katedra, String(surowa));
        if (zgody.includes(`plik:${p}`)) return { decyzja: 'allow', powod: 'Zgoda Suwerena na ten plik.' };
        if (SEKRET.test(p)) return { decyzja: 'ask', powod: `Plik z sekretami — tylko za zgodą Suwerena. ${CZEKA}` };
        if (wolne.some((d) => wnetrze(p, d))) return { decyzja: 'allow', powod: 'Katalog roboczy.' };
        if (!wnetrze(p, katedra)) return { decyzja: 'ask', powod: `Zapis POZA Katedrą (${p}). ${CZEKA}` };
        const rel = path.relative(katedra, p);
        if (/^_OtakOs_/i.test(rel.split(/[\\/]/)[0])) return { decyzja: 'allow', powod: 'Katalog roboczy Katedry.' };
        if (!istnieje(p)) return { decyzja: 'allow', powod: 'Nowy plik — swoboda tworzenia.' };
        return { decyzja: 'ask', powod: `„${rel}" to istniejący plik rdzenia Katedry — zmiana za zgodą Suwerena. Możesz za to tworzyć NOWE pliki bez pytania. ${CZEKA}` };
    }
    return { decyzja: 'allow', powod: 'Narzędzie bez skutków ubocznych.' };
}

function main() {
    let d = {};
    try { d = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* puste wejście → domyślnie pytaj */ }
    const czytaj = (k, dom) => { try { return JSON.parse(process.env[k] ?? '') ?? dom; } catch { return dom; } };
    const katedra = process.env.OTAKOS_GLOWNY_KATEDRA || d.cwd || process.cwd();
    const { decyzja, powod } = ocen(d, { katedra, wolne: czytaj('OTAKOS_GLOWNY_WOLNE', []), zgody: czytaj('OTAKOS_GLOWNY_ZGODY', []) });
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decyzja, permissionDecisionReason: powod } }));
}
if (process.argv[1]?.endsWith('straz.mjs')) main();
