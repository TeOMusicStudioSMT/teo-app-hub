/**
 * 🎭 Persony — karty ról TeOgochi (od 2026-09-21).
 *
 * Suweren: „zrób karty ról TeOgochi z agency-agents". Układ karty wzięty z
 * github.com/msitarzewski/agency-agents (MIT): Tożsamość → Misja → Żelazne zasady →
 * Co dostarczasz → Jak pracujesz → Miary sukcesu. Treść napisana po polsku pod Katedrę:
 * z narzędziami mostu, które gatunek NAPRAWDĘ ma, i z lekcjami z pomiarów (np. Kodeks:
 * „czas w sekundach", Klatka: „jedno ujęcie naraz na 6 GB").
 *
 * DWA ŹRÓDŁA, JEDNA KOLEJNOŚĆ:
 *   1. _OtakOs_Wymiar/persony/<gatunek>.md — karta Suwerena (edytowana z Katedry), wygrywa;
 *   2. services/persony/<gatunek>.md      — kanon z repo (jedzie w distro V_ZERO).
 * Kto woła: Delegat (telefon), Arena i badania w Labie, /api/szyna/pytanie, Kodeks w App
 * Studio. Karta jest KRÓTKA (≈2 KB) celowo — małe modele lokalne gubią długie reguły.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KANON = path.join(__dirname, 'persony');
let katalogWlasnych = path.join(process.cwd(), '_OtakOs_Wymiar', 'persony');
export function skonfiguruj({ katalogWymiar } = {}) { if (katalogWymiar) katalogWlasnych = path.join(katalogWymiar, 'persony'); }

const idOk = (id) => /^[a-z0-9_-]{2,32}$/.test(String(id || ''));
const cache = new Map();   // id → { mtime, karta }

function rozbierz(surowy) {
    const m = surowy.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const meta = {};
    if (m) for (const linia of m[1].split(/\r?\n/)) { const k = linia.match(/^([a-zA-Z_]+):\s*(.*)$/); if (k) meta[k[1]] = k[2].trim(); }
    return { meta, tresc: (m ? m[2] : surowy).trim() };
}

async function wczytaj(plik) {
    const st = await fs.stat(plik);
    const c = cache.get(plik);
    if (c && c.mtime === st.mtimeMs) return c.karta;
    const { meta, tresc } = rozbierz(await fs.readFile(plik, 'utf8'));
    const karta = { ...meta, tresc, plik };
    cache.set(plik, { mtime: st.mtimeMs, karta });
    return karta;
}

/** Karta gatunku: własna Suwerena, a gdy jej nie ma — kanon. null, gdy gatunek nie ma karty. */
export async function karta(id) {
    if (!idOk(id)) return null;
    for (const [plik, wlasna] of [[path.join(katalogWlasnych, `${id}.md`), true], [path.join(KANON, `${id}.md`), false]]) {
        if (fsSync.existsSync(plik)) { try { return { ...(await wczytaj(plik)), gatunek: id, wlasna }; } catch { /* uszkodzona — próbujemy kanonu */ } }
    }
    return null;
}

/** Karta po imieniu („Joanna", „Reżyser") — szyna i arena znają imiona, nie identyfikatory. */
export async function kartaPoImieniu(imie) {
    const szukane = String(imie || '').trim().toLowerCase();
    if (!szukane) return null;
    for (const k of await lista()) if (k.imie?.toLowerCase() === szukane || k.gatunek === szukane) return karta(k.gatunek);
    return null;
}

/**
 * Prompt systemowy dla modelu: karta + ramka sytuacji (telefon / arena / kod).
 * Gdy karty nie ma — oddaje sam `zapas` (dotychczasowe zachowanie modułów bez regresji).
 */
export async function systemPrompt(id, { ramka = '', zapas = '' } = {}) {
    const k = await karta(id);
    if (!k) return zapas;
    return `${k.tresc}\n\n${ramka}`.trim();
}

export async function lista() {
    const ids = new Set();
    for (const dir of [KANON, katalogWlasnych]) {
        if (!fsSync.existsSync(dir)) continue;
        for (const f of await fs.readdir(dir)) if (f.endsWith('.md')) ids.add(f.slice(0, -3));
    }
    const out = [];
    for (const id of [...ids].sort()) { const k = await karta(id); if (k) out.push({ gatunek: id, imie: k.imie, dziedzina: k.dziedzina, wlasna: k.wlasna, zrodlo: k.zrodlo, znakow: k.tresc.length }); }
    return out;
}

/** Zapis własnej karty Suwerena (nadpisuje kanon dla tego gatunku, kanon zostaje nietknięty). */
export async function zapiszWlasna(id, surowy) {
    if (!idOk(id)) throw new Error('Zły identyfikator gatunku.');
    const tekst = String(surowy || '').trim();
    if (tekst.length < 40) throw new Error('Karta jest za krótka, żeby była kartą.');
    await fs.mkdir(katalogWlasnych, { recursive: true });
    await fs.writeFile(path.join(katalogWlasnych, `${id}.md`), tekst + '\n', 'utf8');
    return karta(id);
}

export async function usunWlasna(id) {
    if (!idOk(id)) throw new Error('Zły identyfikator gatunku.');
    const plik = path.join(katalogWlasnych, `${id}.md`);
    if (!fsSync.existsSync(plik)) return false;
    await fs.rm(plik, { force: true });
    cache.delete(plik);
    return true;
}

export default { skonfiguruj, karta, kartaPoImieniu, systemPrompt, lista, zapiszWlasna, usunWlasna };
