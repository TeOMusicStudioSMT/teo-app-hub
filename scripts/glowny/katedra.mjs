#!/usr/bin/env node
/**
 * 👑 Polecenia stada dla Głównego (Claude Code w tle — services/Glowny.js). Główny woła je BEZ pytania Suwerena
 * (`Bash(node scripts/glowny/katedra.mjs:*)`), więc są tu tylko odczyty i rzeczy odwracalne/kolejkowane:
 * fakty o projektach, rozmowa z TeOgochi (bez ich ciężkich narzędzi), Stół, kolejka Nocnej Zmiany, pamięć.
 * Nic tu nie usuwa, nie zamyka procesów i nie zmienia silników — to zostaje przy Suwerenie.
 *
 *   node scripts/glowny/katedra.mjs stan [fragment nazwy]
 *   node scripts/glowny/katedra.mjs stado
 *   node scripts/glowny/katedra.mjs zapytaj <id TeOgochi> <pytanie…>
 *   node scripts/glowny/katedra.mjs stol
 *   node scripts/glowny/katedra.mjs nocna <robota> [JSON parametrów]
 *   node scripts/glowny/katedra.mjs pamiec
 *   node scripts/glowny/katedra.mjs moce
 *   node scripts/glowny/katedra.mjs wideo pliki [klocki|move]
 *   node scripts/glowny/katedra.mjs wideo przytnij <plik> <od_s> [do_s]   (nowy plik obok — oryginał zostaje)
 *   node scripts/glowny/katedra.mjs wideo potnij <plik> <sekundy>         (klocki po N s w podkatalogu)
 */
const MOST = process.env.OTAKOS_MOST || 'http://127.0.0.1:3001';

async function most(sciezka, body, ms = 60_000) {
    const r = await fetch(`${MOST}${sciezka}`, {
        method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(ms),
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d;
}

/** „klocki:Folder/plik.mp4" | „move:plik.mp4" | „_OtakOs_Klocki/…" | pełna ścieżka | „Folder/plik.mp4" (= klocki). */
function plikWideo(arg) {
    const m = /^(klocki|move):(.+)$/.exec(String(arg ?? ''));
    if (m) return { zrodlo: m[1], plik: m[2] };
    // Ścieżka względem Katedry („_OtakOs_Klocki/…") — modele tak ją widzą z katalogu roboczego.
    const k = /^(?:\.[\\/])?_OtakOs_(Klocki|Move)[\\/](.+)$/i.exec(String(arg ?? ''));
    if (k) return { zrodlo: k[1].toLowerCase(), plik: k[2] };
    if (/^([a-zA-Z]:[\\/]|\/)/.test(String(arg ?? ''))) return { plik: arg };   // pełna ścieżka — korzeń dobierze most
    return { zrodlo: 'klocki', plik: arg };
}
const liczba = (x, co) => { const n = Number(String(x ?? '').replace(',', '.')); if (!Number.isFinite(n)) throw new Error(`${co}: podaj liczbę sekund (np. 0.5).`); return n; };

/** Co Katedra potrafi, a Główny może zlecić — żeby nie mówił „nie mam narzędzia", gdy most je ma. */
const MOCE = `MOCE KATEDRY (most :3001) — przez ten skrypt, bez pytania:
  wideo pliki [klocki|move]            filmy w _OtakOs_Klocki / _OtakOs_Move
  wideo przytnij <plik> <od_s> [do_s]  ffmpeg: wytnij fragment (np. „utnij pierwsze 0,5 s" = przytnij <plik> 0.5)
  wideo potnij <plik> <sekundy>        Nożyce: równe klocki po N s
  zapytaj <TeOgochi> <zadanie>         stado: muzyka, kod (kodeks), gry (pionek), modele (zwiadowca)…
  nocna <robota> [JSON]                Nocna Zmiana (długie roboty w nocy)
  stan / stol / pamiec                 fakty o projektach, Stole, RAM
<plik> = ścieżka względna w _OtakOs_Klocki, „move:<plik>" albo pełna ścieżka wewnątrz tych katalogów.
Inne moduły (ComfyUI, Assety3D, Marketplace, muzyka) — przez TeOgochi (zapytaj) albo trasy z CLAUDE.md (curl = prośba do Suwerena).`;

export const POLECENIA = {
    async moce() { return MOCE; },
    async wideo([co, ...argi]) {
        if (co === 'pliki') {
            const d = await most(`/api/wideo/pliki?zrodlo=${encodeURIComponent(argi[0] || 'klocki')}`);
            return [`${d.korzen}:`, ...d.pliki.map((p) => `- ${p.rel} (${p.sekundy ?? '?'} s, ${Math.round(p.bajtow / 1e5) / 10} MB)`)].join('\n') || 'Brak filmów.';
        }
        if (co === 'przytnij') {
            const [plik, od, doS] = argi;
            if (!plik || od === undefined) throw new Error('Użycie: wideo przytnij <plik> <od_s> [do_s]');
            const d = await most('/api/wideo/przytnij', { ...plikWideo(plik), od: liczba(od, 'od'), ...(doS !== undefined ? { do: liczba(doS, 'do') } : {}) }, 20 * 60_000);
            return `✂️ Przycięte: ${d.wynik} (${d.sekundy ?? '?'} s, było ${d.byloSekund ?? '?'} s). Oryginał bez zmian.`;
        }
        if (co === 'potnij') {
            const [plik, sek] = argi;
            if (!plik || sek === undefined) throw new Error('Użycie: wideo potnij <plik> <sekundy>');
            const d = await most('/api/wideo/potnij', { ...plikWideo(plik), sekundy: liczba(sek, 'sekundy') }, 20 * 60_000);
            return [`✂️ ${d.kawalki.length} kawałków w ${d.katalog}:`, ...d.kawalki.map((k) => `- ${k.rel} (${k.sekundy} s)`)].join('\n');
        }
        throw new Error('Użycie: wideo pliki | przytnij <plik> <od_s> [do_s] | potnij <plik> <sekundy>');
    },
    async stan(argi) {
        const d = await most(`/api/katedra/raport?szukaj=${encodeURIComponent(argi.join(' '))}`);
        return d.tekst;
    },
    async stado() {
        const d = await most('/api/delegat/wszyscy');
        return d.delegaci.map((x) => `${x.emoji} ${x.id} — ${x.imie}${x.dziedzina ? ` (${x.dziedzina})` : ''}${x.pelny ? ' · pełny profil' : ''}`).join('\n');
    },
    async zapytaj([kto, ...reszta]) {
        const tekst = reszta.join(' ').trim();
        if (!kto || !tekst) throw new Error('Użycie: zapytaj <id TeOgochi> <pytanie…>');
        // zGlownego: TeOgochi dostaje tylko narzędzia bez skutków ciężkich (jak z tunelu) — Główny nie obejdzie zgody Suwerena przez stado.
        const d = await most('/api/delegat/rozmowa', { delegat: kto, tekst, zGlownego: true }, 15 * 60_000);
        return `${kto}: ${d.odpowiedz}`;
    },
    async stol() {
        const d = await most('/api/stol');
        return (d.karty ?? []).map((k) => `- „${k.tytul}" [${k.etap}]${k.projektSkrot ? ` projekt ${k.projektSkrot.id}: ${k.projektSkrot.gotowe}/${k.projektSkrot.razem}` : ''}`).join('\n') || 'Stół pusty.';
    },
    async nocna([rodzaj, json]) {
        if (!rodzaj) throw new Error('Użycie: nocna <robota> [JSON parametrów]');
        let parametry = {};
        if (json) { try { parametry = JSON.parse(json); } catch { throw new Error('Parametry muszą być JSON-em, np. {"projektStada":"x-1"}'); } }
        const d = await most('/api/nocna/dodaj', { rodzaj, parametry, notatka: 'od Głównego' });
        return `Dodane do Nocnej Zmiany: ${rodzaj} (${d.zadanie?.id ?? d.id ?? 'ok'}) — ruszy, gdy Suweren włączy Zmianę i otworzą się bramy.`;
    },
    async pamiec() {
        const d = await most('/api/system/memory');
        return [`Wolne ${d.freeGB} GB z ${d.totalGB} GB.`, ...(d.procesy ?? []).slice(0, 10).map((p) => `PID ${p.pid} ${p.name} ${p.mb} MB${p.opis ? ` — ${p.opis}` : ''}${p.chroniony ? ' [chroniony]' : ''}`)].join('\n');
    },
};

export { plikWideo };

async function main() {
    const [, , co, ...argi] = process.argv;
    const f = POLECENIA[co];
    if (!f) { console.log(`Polecenia: ${Object.keys(POLECENIA).join(', ')}`); process.exit(co ? 2 : 0); }
    try { console.log(await f(argi)); }
    catch (e) { console.error(`Błąd (${co}): ${e.message}`); process.exit(1); }
}
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('katedra.mjs')) main();
