/**
 * ⚒️ Kuźnia Soup — każdy TeOgochi dostaje WŁASNY model, wykuty z jego własnej pracy (trening LoRA).
 *
 * Obok starszej Kuźni Modeli (services/KuzniaModeli.js: gotowe GGUF z dysku → Ollama) — tu model POWSTAJE:
 * trening na pracy stada, a na końcu wynik trafia do Ollamy tak samo jak tam.
 *
 * Suweren (2026-09-28): „i by używał tego narzędzia github.com/MakazhanAlpamys/Soup… pozwala tworzyć
 * własne… no to takie własne do każdego TeOgochi sobie zrobimy".
 *
 * Soup (soup-cli, Apache-2.0) to lokalny trening LoRA z jednego soup.yaml → eksport GGUF → Ollama.
 * Kuźnia daje mu dane z Katedry — tylko to, co naprawdę się wydarzyło w pracy stada:
 *   SFT   — wkłady tego TeOgochi z projektów, które Sędzia ocenił co najmniej `prog` (domyślnie 7/10):
 *           system = jego karta roli, user = wizja + zadanie, assistant = jego wkład (format chatml);
 *   PARY  — „gorzej → lepiej": szkic sprzed pętli kreatywnej i wersja po niej; wkład z rundy, po której
 *           ocena Sędziego WZROSŁA, i wersja wcześniejsza (format dpo: prompt/chosen/rejected).
 * Za mało dobrej pracy = odmowa z liczbami, a nie trening na byle czym.
 *
 * WYKUCIE (godziny na karcie graficznej — robota dla Nocnej Zmiany):
 *   soup train -c soup.yaml → soup export --format gguf --quant q4_k_m → soup deploy ollama --name teogochi-<id>
 * Telemetria Soup wyłączona zawsze (--no-telemetry, SOUP_TELEMETRY=0) — nic nie wychodzi z Katedry.
 * Model bazowy to wagi HuggingFace (id albo ŚCIEŻKA lokalna), NIE model z Ollamy — Soup trenuje safetensors.
 * Wykuty model NIE podmienia sam silnika TeOgochi: trafia do katalogu Dyrygenta jako „własny", a przydział
 * zostaje decyzją Suwerena (albo Dyrygenta w projekcie).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';

let cfg = {
    katalog: path.join(process.cwd(), '_OtakOs_Wymiar', 'kuznia-soup'),
    /** → pełne projekty stada */
    projekty: async () => [],
    /** id → { tresc, imie } karta roli */
    karta: async () => null,
    soup: process.env.OTAKOS_SOUP || 'soup',
    /** Model bazowy HF (id albo ścieżka), gdy Suweren nie poda innego. */
    baza: process.env.OTAKOS_KUZNIA_BAZA || '',
    szyna: null,
    /** (polecenie, argumenty, { cwd, env, naLinie }) → Promise<kod wyjścia> — podmienialne w testach */
    uruchom: null,
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

export const MIN_PROBEK = 8;
export const PROG_OCENY = 7;
const ID = /^[a-z0-9-]{2,40}$/;
const nadaj = (tresc, dane) => cfg.szyna?.nadaj?.({ agent: 'Kuźnia', rodzaj: 'kuznia-soup', tresc, dane })?.catch?.(() => {});
const katalogAgenta = (agent) => path.join(cfg.katalog, agent);
const nazwaModelu = (agent) => `teogochi-${agent}`;

const ZASADY = 'PRACUJESZ W ZESPOLE. Stado TeOgochi robi razem jeden projekt Suwerena; każdy wnosi to, co umie najlepiej. Piszesz po polsku, konkretnie, bez wstępów.';
const promptDla = (p, k) => `PROJEKT: ${p.nazwa}\nWIZJA SUWERENA:\n${p.wizja}\n\nTWOJE ZADANIE (${k.imie}):\n${k.zadanie}`;
/** Ocena Sędziego po danej rundzie (albo ostatnia znana, gdy runda nie ma własnej). */
const ocenaRundy = (p, r) => (p.oceny ?? []).find((o) => o.runda === r)?.ocena ?? null;
const ocenaKoncowa = (p) => (p.oceny ?? []).filter((o) => o.ocena != null).at(-1)?.ocena ?? null;

/**
 * Dane do treningu z projektów stada — czysta funkcja (testowalna bez dysku).
 * @returns {{ sft:object[], pary:object[], pominiete:{ bezOceny:number, slabe:number } }}
 */
export function zbierz(projekty, { agent, kartaRoli = '', prog = PROG_OCENY }) {
    const system = `${kartaRoli || `Jesteś ${agent} — TeOgochi Katedry OtakOS.`}\n\n${ZASADY}`;
    const sft = [], pary = [];
    const pominiete = { bezOceny: 0, slabe: 0 };
    for (const p of projekty ?? []) {
        for (const k of (p.kroki ?? []).filter((x) => x.agent === agent && x.stan === 'gotowe' && x.wklad)) {
            const prompt = promptDla(p, k);
            const ocena = ocenaRundy(p, k.runda ?? p.runda ?? 1) ?? ocenaKoncowa(p);
            if (ocena == null) pominiete.bezOceny++;
            else if (ocena < prog) pominiete.slabe++;
            else sft.push({ messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }, { role: 'assistant', content: k.wklad }] });
            // Pętla kreatywna: szkic → wersja po krytyce. „Lepiej" wg samego autora — dlatego tylko jako para.
            for (const s of k.szkice ?? []) if (s.przed && s.po && s.przed !== s.po) pary.push({ prompt: `${system}\n\n${prompt}`, chosen: s.po, rejected: s.przed });
            // Rundy: poprzednia wersja przegrywa, gdy Sędzia ocenił nową rundę WYŻEJ.
            for (const w of k.wersje ?? []) {
                const przed = ocenaRundy(p, w.runda), po = ocenaRundy(p, k.runda ?? p.runda);
                if (przed != null && po != null && po > przed && w.wklad !== k.wklad) pary.push({ prompt: `${system}\n\n${prompt}`, chosen: k.wklad, rejected: w.wklad });
            }
        }
    }
    return { sft, pary, pominiete };
}

/** soup.yaml dla SFT (LoRA, 4 bity — mieści się na jednej domowej karcie). */
export function konfiguracja({ baza, probek, epoki = 3 }) {
    return [
        `# Kuźnia Modeli Katedry OtakOS — wygenerowane ${new Date().toISOString().slice(0, 10)}. Trening lokalny, bez telemetrii.`,
        `base: ${JSON.stringify(baza)}`,
        'task: sft',
        'data:',
        '  train: ./sft.jsonl',
        '  format: chatml',
        `  val_split: ${probek >= 20 ? 0.1 : 0.0}`,
        '  max_length: 2048',
        'training:',
        `  epochs: ${epoki}`,
        '  lr: 2e-4',
        '  batch_size: auto',
        '  lora:',
        '    r: 16',
        '    alpha: 32',
        '    target_modules: auto',
        '  quantization: 4bit',
        'output: ./wynik',
        '',
    ].join('\n');
}

const doJsonl = (wiersze) => wiersze.map((w) => JSON.stringify(w)).join('\n') + (wiersze.length ? '\n' : '');

/** Przygotuj dane i soup.yaml w _OtakOs_Wymiar/kuznia-soup/<agent>/. Nie trenuje. */
export async function przygotuj(agent, { baza = cfg.baza, prog = PROG_OCENY, epoki = 3 } = {}) {
    if (!ID.test(String(agent))) throw new Error('Zły identyfikator TeOgochi.');
    const b = String(baza ?? '').trim();
    if (!b) throw new Error('Podaj model bazowy do treningu: id z HuggingFace (np. Qwen/Qwen2.5-3B-Instruct) albo ścieżkę do pobranych wag. Soup trenuje wagi safetensors, nie model z Ollamy.');
    if (/[\n\r"]/.test(b)) throw new Error('Zła nazwa modelu bazowego.');
    const karta = await cfg.karta(agent).catch(() => null);
    const { sft, pary, pominiete } = zbierz(await cfg.projekty(), { agent, kartaRoli: karta?.tresc ?? '', prog });
    if (sft.length < MIN_PROBEK) {
        throw new Error(`Za mało dobrej pracy ${karta?.imie ?? agent} do kucia: ${sft.length} wkładów z oceną ≥ ${prog}/10 (potrzeba ${MIN_PROBEK}). ` +
            `Pominięte: ${pominiete.bezOceny} bez oceny Sędziego, ${pominiete.slabe} słabszych. Więcej rund doskonalenia da więcej ocenionej pracy.`);
    }
    const dir = katalogAgenta(agent);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'sft.jsonl'), doJsonl(sft), 'utf8');
    await fs.writeFile(path.join(dir, 'pary.jsonl'), doJsonl(pary), 'utf8');
    await fs.writeFile(path.join(dir, 'soup.yaml'), konfiguracja({ baza: b, probek: sft.length, epoki }), 'utf8');
    const info = { agent, imie: karta?.imie ?? agent, baza: b, prog, sft: sft.length, pary: pary.length, pominiete, przygotowano: new Date().toISOString() };
    await fs.writeFile(path.join(dir, 'kuznia.json'), JSON.stringify(info, null, 2), 'utf8');
    return { ...info, katalog: dir };
}

/** Podgląd bez zapisu: ile dobrej pracy i par ma TeOgochi. */
export async function podglad(agent, { prog = PROG_OCENY } = {}) {
    if (!ID.test(String(agent))) throw new Error('Zły identyfikator TeOgochi.');
    const karta = await cfg.karta(agent).catch(() => null);
    const { sft, pary, pominiete } = zbierz(await cfg.projekty(), { agent, kartaRoli: karta?.tresc ?? '', prog });
    return { agent, sft: sft.length, pary: pary.length, pominiete, prog, wystarczy: sft.length >= MIN_PROBEK, minimum: MIN_PROBEK };
}

// ─────────────────────────────────────────────────────────────────────────────
// WYKUCIE — Soup w tle, jedno naraz (karta graficzna jest jedna)
// ─────────────────────────────────────────────────────────────────────────────
const zadania = new Map();
let trwa = null;

function domyslneUruchom(polecenie, argumenty, { cwd, env, naLinie }) {
    return new Promise((resolve, reject) => {
        const d = spawn(polecenie, argumenty, { cwd, env, windowsHide: true });   // bez powłoki — argumenty idą wprost
        let reszta = '';
        const czytaj = (b) => { reszta += b.toString('utf8'); const l = reszta.split(/\r?\n/); reszta = l.pop() ?? ''; l.filter(Boolean).forEach(naLinie); };
        d.stdout.on('data', czytaj); d.stderr.on('data', czytaj);
        d.on('error', (e) => reject(e.code === 'ENOENT' ? new Error(`Nie ma Soup w Katedrze („${polecenie}"). Zainstaluj: pipx install "soup-cli[train]" (albo ustaw OTAKOS_SOUP).`) : e));
        d.on('close', (kod) => { if (reszta) naLinie(reszta); resolve(kod); });
    });
}

async function krok(z, opis, argumenty, cwd) {
    z.etap = opis;
    z.log.push(`▶ ${opis}: soup ${argumenty.join(' ')}`);
    const env = { ...process.env, SOUP_TELEMETRY: '0' };
    const kod = await (cfg.uruchom ?? domyslneUruchom)(cfg.soup, ['--no-telemetry', ...argumenty], {
        cwd, env, naLinie: (l) => { z.log.push(l.slice(0, 300)); if (z.log.length > 300) z.log.splice(0, z.log.length - 300); },
    });
    if (kod !== 0) throw new Error(`${opis}: Soup zakończył się kodem ${kod} — ostatnie linie w dzienniku Kuźni.`);
}

/**
 * Wykuj model TeOgochi: dane → trening → GGUF → Ollama (`teogochi-<id>`). W tle; zwraca id zadania.
 * Nie podmienia silnika agenta — to decyzja Suwerena (Dyrygent widzi model jako „własny").
 */
export async function wykuj(agent, opcje = {}) {
    if (trwa) throw new Error(`Kuźnia już kuje (${trwa.agent}) — jedna karta graficzna, jeden model naraz.`);
    const info = await przygotuj(agent, opcje);
    const z = { id: `kz-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`, agent, imie: info.imie, stan: 'trwa', etap: 'start', od: new Date().toISOString(), log: [], model: null, blad: null, info };
    zadania.set(z.id, z);
    trwa = z;
    nadaj(`kuje model dla ${info.imie}: ${info.sft} wkładów z oceną ≥ ${info.prog}/10, baza ${info.baza}`, { agent, zadanie: z.id });
    (async () => {
        const dir = info.katalog;
        try {
            await krok(z, 'trening (LoRA)', ['train', '-c', 'soup.yaml', '-n', nazwaModelu(agent)], dir);
            const gguf = path.join(dir, `${nazwaModelu(agent)}.gguf`);
            await krok(z, 'eksport GGUF', ['export', '--model', './wynik', '--format', 'gguf', '--quant', 'q4_k_m', '--output', gguf], dir);
            const karta = await cfg.karta(agent).catch(() => null);
            const argi = ['deploy', 'ollama', '--model', gguf, '--name', nazwaModelu(agent), '--yes'];
            if (karta?.tresc) argi.push('--system', karta.tresc.slice(0, 4000));
            await krok(z, 'wdrożenie do Ollamy', argi, dir);
            z.model = nazwaModelu(agent);
            z.stan = 'gotowe';
            const w = await wykute();
            await zapiszWykute([...w.filter((x) => x.agent !== agent), { agent, model: z.model, baza: info.baza, sft: info.sft, kiedy: new Date().toISOString() }]);
            nadaj(`wykuła model „${z.model}" dla ${info.imie} — jest w Ollamie; przydziel go w Dyrygencie albo przy TeOgochi`, { agent, zadanie: z.id, glos: `Kuźnia wykuła własny model dla ${info.imie}.` });
        } catch (e) {
            z.stan = 'blad'; z.blad = String(e.message || e).slice(0, 400);
            nadaj(`nie wykuła modelu dla ${info.imie} (${z.etap}): ${z.blad}`, { agent, zadanie: z.id });
        } finally {
            z.koniec = new Date().toISOString();
            trwa = null;
        }
    })();
    return { id: z.id, agent, sft: info.sft, pary: info.pary, baza: info.baza, sondaz: `/api/kuznia-soup/zadanie/${z.id}/sondaz` };
}

export function zadanie(id) { return zadania.get(id) ?? null; }
export function sondaz(id) {
    const z = zadania.get(id);
    if (!z) return { stan: 'blad', blad: 'nie ma takiego zadania Kuźni (most zrestartowany?)' };
    return { stan: z.stan, etap: z.etap, blad: z.blad, podsumowanie: z.stan === 'gotowe' ? `wykuty „${z.model}" z ${z.info.sft} wkładów` : null, log: z.log.slice(-15) };
}
export function biezace() { return trwa ? { id: trwa.id, agent: trwa.agent, etap: trwa.etap, od: trwa.od } : null; }

const PLIK_WYKUTYCH = () => path.join(cfg.katalog, 'wykute.json');
export async function wykute() { try { return JSON.parse(await fs.readFile(PLIK_WYKUTYCH(), 'utf8')); } catch { return []; } }
async function zapiszWykute(w) {
    await fs.mkdir(cfg.katalog, { recursive: true });
    await fs.writeFile(`${PLIK_WYKUTYCH()}.tmp`, JSON.stringify(w, null, 2), 'utf8');
    await fs.rename(`${PLIK_WYKUTYCH()}.tmp`, PLIK_WYKUTYCH());
}

/** Czy Soup jest w Katedrze i co mówi o sprzęcie (`soup version` + `soup doctor`). */
export async function doktor() {
    const z = { log: [] };
    const zbierzLinie = async (argumenty) => {
        const linie = [];
        const kod = await (cfg.uruchom ?? domyslneUruchom)(cfg.soup, ['--no-telemetry', ...argumenty], { cwd: process.cwd(), env: { ...process.env, SOUP_TELEMETRY: '0' }, naLinie: (l) => linie.push(l) });
        return { kod, linie };
    };
    try {
        const v = await zbierzLinie(['version']);
        const d = await zbierzLinie(['doctor']);
        return { jest: v.kod === 0, wersja: v.linie.join(' ').trim().slice(0, 200), doktor: d.linie.slice(0, 80), polecenie: cfg.soup, baza: cfg.baza || null };
    } catch (e) {
        return { jest: false, blad: e.message, polecenie: cfg.soup, baza: cfg.baza || null, log: z.log };
    }
}

export default { skonfiguruj, zbierz, konfiguracja, przygotuj, podglad, wykuj, zadanie, sondaz, biezace, wykute, doktor, MIN_PROBEK, PROG_OCENY };
