#!/usr/bin/env node
/**
 * 🔎 Rewizor Mostu — raport dla Suwerena (0.00G)
 *
 *   npm run rewizor               analiza statyczna (bez mostu, bez sieci)
 *   npm run rewizor -- --zywy     + sonda działającego mostu (GET-y bez parametrów)
 *   npm run rewizor -- --zywy --baza http://127.0.0.1:3001
 *   npm run rewizor -- --json     wynik jako JSON (dla Mechanika / Nocnej Zmiany)
 *
 * Kod wyjścia: 0 = czysto, 1 = są porażki (duplikat trasy, martwy import,
 * brakujący eksport, wywołanie w próżnię, trasa, która leży lub milczy).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewizja, wyciagnijTrasy } from './analiza.mjs';
import { planSondy, sonduj, PORAZKI } from './sonda.mjs';

const KORZEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = process.argv.slice(2);
const flaga = (n) => arg.includes(n);
const wartosc = (n, dom) => { const i = arg.indexOf(n); return i !== -1 && arg[i + 1] ? arg[i + 1] : dom; };

const JSON_WYJSCIE = flaga('--json');
const ZYWY = flaga('--zywy');
const BAZA = wartosc('--baza', process.env.OTAKOS_MOST || 'http://127.0.0.1:3001').replace(/\/+$/, '');

const druk = JSON_WYJSCIE ? () => {} : (...a) => console.log(...a);
const lista = (tytul, elementy, fmt) => {
    if (!elementy.length) { druk(`\n✅ ${tytul.replace(/^⛔\s*/, '')}: brak`); return; }
    druk(`\n${tytul} (${elementy.length})`);
    for (const e of elementy) druk(`   ${fmt(e)}`);
};

const r = rewizja(KORZEN);
let porazki = r.duplikaty.length + r.martweImporty.length + r.brakujaceEksporty.length + r.osierocone.length;

druk('🔎 REWIZOR MOSTU — analiza statyczna');
druk(`   Trasy HTTP: ${r.trasy.length}   ·   kanały WebSocket: ${r.ws.length}`);
lista('⛔ Trasy zarejestrowane dwa razy (druga kopia nigdy nie odpowie)', r.duplikaty,
    (d) => `${d.klucz}  — wiesio-bridge.js:${d.linie.join(', :')}`);
lista('⛔ Importy do nieistniejących plików', r.martweImporty,
    (m) => `${m.plik}:${m.linia}  → ${m.cel}`);
lista('⛔ Importy nazw, których moduł nie eksportuje (most nie wstanie)', r.brakujaceEksporty,
    (m) => `${m.plik}:${m.linia}  → ${m.cel} { ${m.brak.join(', ')} }`);
lista('⛔ Wywołania /api/, których most nie zna (zawsze 404)', r.osierocone,
    (o) => `${o.plik}:${o.linia}  ${o.surowa}`);

let sonda = null;
if (ZYWY) {
    const zrodloMostu = fs.readFileSync(path.join(KORZEN, 'wiesio-bridge.js'), 'utf8');
    const plan = planSondy(zrodloMostu, wyciagnijTrasy(zrodloMostu));
    druk(`\n🩺 SONDA ŻYWA — ${BAZA}`);
    druk(`   Sonduję ${plan.sondowane.length} tras GET bez parametrów; pomijam ${plan.pominiete.length} (ruchliwe albo wrażliwe).`);
    sonda = await sonduj({ baza: BAZA, trasy: plan.sondowane });
    sonda.pominiete = plan.pominiete;
    if (!sonda.mostZyje) {
        druk(`   ⛔ Most nie odpowiada na /wiesio/ping (${sonda.blad}). Odpal Katedrę i powtórz.`);
        porazki++;
    } else {
        const grupy = {};
        for (const w of sonda.wyniki) (grupy[w.werdykt] ||= []).push(w);
        const opis = {
            ZYWA: '✅ Żyje', ODMAWIA: '🟡 Odmawia (chce parametrów — to nie błąd)', ZALEZNOSC_SPI: '🟠 Zależność śpi (502/503/504 — np. Ollama/ComfyUI wyłączone)',
            BRAK_DANYCH: '⚪ Brak danych (404 od samej trasy — np. graf jeszcze niezbudowany)',
            ZAMKNIETA: '🔒 Zamknięta (401/403 z localhost — podejrzane)', ZNIKNELA: '⛔ Zniknęła („Cannot GET" — trasa jest w kodzie, a działający most jej nie zna: stary proces?)',
            AWARIA: '⛔ Awaria (5xx)', MILCZY: '⛔ Milczy (brak odpowiedzi w czasie)',
        };
        for (const [k, t] of Object.entries(opis)) {
            const g = grupy[k] || [];
            if (!g.length) continue;
            if (k === 'ZYWA') { druk(`\n${t}: ${g.length}`); continue; }
            lista(t, g, (w) => `${w.sciezka}  ${w.status ?? '—'}  ${w.ms} ms${w.blad ? `  (${w.blad})` : ''}  — wiesio-bridge.js:${w.linia}`);
        }
        const wolne = sonda.wyniki.filter((w) => w.status !== null && w.ms > 2000);
        if (wolne.length) lista('🐢 Wolne (> 2 s)', wolne, (w) => `${w.sciezka}  ${w.ms} ms`);
        porazki += sonda.wyniki.filter((w) => PORAZKI.has(w.werdykt)).length;
    }
    if (arg.includes('--pokaz-pominiete')) lista('↷ Pominięte', sonda.pominiete, (p) => `${p.sciezka}  — ${p.powod}`);
    else druk(`   (listę pominiętych pokaże --pokaz-pominiete)`);
}

if (JSON_WYJSCIE) {
    console.log(JSON.stringify({ ...r, trasy: r.trasy.length, ws: r.ws.length, sonda, porazki }, null, 2));
} else {
    druk(porazki ? `\n⛔ Porażek: ${porazki}. Most wymaga uwagi.` : '\n✅ Czysto. Most trzyma się kupy.');
}
process.exit(porazki ? 1 : 0);
