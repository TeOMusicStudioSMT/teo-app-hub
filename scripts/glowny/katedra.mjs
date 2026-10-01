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

export const POLECENIA = {
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

async function main() {
    const [, , co, ...argi] = process.argv;
    const f = POLECENIA[co];
    if (!f) { console.log(`Polecenia: ${Object.keys(POLECENIA).join(', ')}`); process.exit(co ? 2 : 0); }
    try { console.log(await f(argi)); }
    catch (e) { console.error(`Błąd (${co}): ${e.message}`); process.exit(1); }
}
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('katedra.mjs')) main();
