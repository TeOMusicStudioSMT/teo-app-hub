/**
 * 🔭 Zwiadowca HF — TeOgochi, który szuka na HuggingFace nowych modeli dla Katedry i melduje je Dyrygentowi.
 *
 * Suweren (2026-09-29): „Teogochi którym zadanie jest wyszukiwanie na Hugging Face nowych modeli… dla Katedry (dla
 * teogochi i raportować dyrygentowi i przy następnej Kalibracji ma nowe dane… i nowe modele idą do kucia po akceptacji)".
 *
 * JAK:
 *  zwiad    — publiczne API HuggingFace (tylko ODCZYT: nic o Katedrze nie wychodzi poza słowa wyszukiwania):
 *             modele z plikami GGUF dla zapytań (domyślnie: polski, Bielik, Qwen, Gemma, coder…), dla każdego lista
 *             plików → kwantyzacja, która mieści się w VRAM (Q4_K_M, a gdy za duża — mniejsza); pomija to, co Ollama
 *             już ma i co Suweren odrzucił. Opcjonalnie model Zwiadowcy czyta kartę modelu (README) i pisze jedno zdanie:
 *             do czego i któremu TeOgochi się przyda.
 *  meldunek — szyna („Zwiadowca: N nowych modeli czeka na akceptację") + katalog Dyrygenta (pole `kandydaci`).
 *  akceptacja Suwerena → `ollama pull hf.co/<repo>:<kwant>` w tle; po pobraniu opinia Zwiadowcy trafia do karty
 *             modelu Dyrygenta — przy następnym doborze Dyrygent wie, do czego model jest. NIC nie pobiera się samo.
 * ŹRÓDŁA (2026-10-01, Suweren: „dodaj zwiadowcy możliwość podawania bezpośrednio linków z Hugging Face… oraz nową
 *   opcję z pirateface.co… niech też ma zdolność przeglądania automatycznego"): HuggingFace (zweryfikowane) i pirateface.co
 *   (🏴‍☠️ NIEZWERYFIKOWANE — Katedra nie zna jego pochodzenia; zakładamy API zgodne z HuggingFace, a gdy jest inne,
 *   zwiad mówi to wprost). Spoza HF Ollama nie pobiera sama — pobieramy JEDEN plik GGUF do katalogu Kuźni Modeli i kujemy
 *   go do Ollamy (`ollama create`). Lista źródeł: OTAKOS_ZWIADOWCA_ZRODLA (domyślnie hf,pirateface).
 *  link    — bezpośredni link (huggingface.co/…, hf.co/…, pirateface.co/…, albo „właściciel/repo") → kandydat od razu.
 * Wyłączenie: OTAKOS_ZWIADOWCA=0.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

let cfg = {
    katalog: path.join(process.cwd(), '_OtakOs_Wymiar', 'zwiadowca'),
    hf: 'https://huggingface.co',
    pirateface: 'https://pirateface.co',
    /** Które źródła przegląda automatyczny zwiad. */
    zrodla: (process.env.OTAKOS_ZWIADOWCA_ZRODLA || 'hf,pirateface').split(',').map((s) => s.trim()).filter(Boolean),
    ollama: 'http://127.0.0.1:11434',
    fetch: (...a) => globalThis.fetch(...a),
    /** Ile GB VRAM ma karta (model ma się zmieścić z zapasem ~10%). */
    vramGB: Number(process.env.OTAKOS_VRAM_GB) || 12,
    zapytania: (process.env.OTAKOS_ZWIADOWCA_SZUKAJ || 'polish,bielik,qwen3,gemma,coder,llama').split(',').map((s) => s.trim()).filter(Boolean),
    /** ({ system, prompt }) → tekst — model Zwiadowcy; null = bez opinii */
    pisz: null,
    /** (nazwaModelu, { opis, mocne }) → karta modelu u Dyrygenta */
    ustawKarte: null,
    szyna: null,
    wlaczony: process.env.OTAKOS_ZWIADOWCA !== '0',
    /** Spoza HF: katalog, do którego pobieramy GGUF (pierwszy katalog Kuźni Modeli). */
    katalogModeli: path.join(process.cwd(), '_OtakOs_AI', 'models'),
    /** ({ plik, nazwa }) → { ok, id, nazwa, powod } — Kuźnia Modeli: `ollama create` z pliku */
    wykuj: null,
    /** (id) → { stan: 'kuje'|'gotowe'|'blad', blad } */
    stanKucia: null,
    /** (url, cel, naPostep) → pobierz plik; podmienialne w testach */
    pobierzPlik: null,
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

const PLIK = () => path.join(cfg.katalog, 'kandydaci.json');
const REPO = /^[\w.-]{1,96}\/[\w.-]{1,96}$/;

/** Źródła modeli. `zweryfikowane: false` = kandydaci z ostrzeżeniem w panelu i w meldunku. */
export const ZRODLA = {
    hf: { nazwa: 'HuggingFace', baza: () => cfg.hf, zweryfikowane: true },
    pirateface: { nazwa: 'pirateface.co', baza: () => cfg.pirateface, zweryfikowane: false },
};
const zrodloKandydata = (k) => k.zrodlo ?? 'hf';
const kluczKandydata = (zrodlo, repo) => `${zrodlo}:${String(repo).toLowerCase()}`;
/** Id kandydata: HF jak dotąd (zgodność z zapisanymi), inne źródła z prefiksem. */
const idKandydata = (zrodlo, repo) => crypto.createHash('sha1').update(zrodlo === 'hf' ? repo : `${zrodlo}:${repo}`).digest('hex').slice(0, 10);
const nadaj = (tresc, dane) => cfg.szyna?.nadaj?.({ agent: 'Zwiadowca', rodzaj: 'zwiad', tresc, dane })?.catch?.(() => {});

async function czytaj() { try { return JSON.parse(await fs.readFile(PLIK(), 'utf8')); } catch { return { kandydaci: [], ostatniZwiad: null }; } }
async function zapisz(d) {
    await fs.mkdir(cfg.katalog, { recursive: true });
    await fs.writeFile(`${PLIK()}.tmp`, JSON.stringify(d, null, 2), 'utf8');
    await fs.rename(`${PLIK()}.tmp`, PLIK());
}

// ─────────────────────────────────────────────────────────────────────────────
// Czyste funkcje (testowalne bez sieci)
// ─────────────────────────────────────────────────────────────────────────────

/** Kwantyzacja z nazwy pliku GGUF: „Qwen3-8B-Q4_K_M.gguf" → "Q4_K_M". */
export function kwant(nazwaPliku) {
    const m = String(nazwaPliku).match(/(?:^|[-_.])((?:IQ|Q)\d(?:_[0-9A-Z]{1,2}){0,2}|BF16|F16|F32)(?=[-_.]|\.gguf$)/i);
    return m ? m[1].toUpperCase() : null;
}

/** Kolejność preferencji: dobra jakość przy rozsądnym rozmiarze; gdy nie mieści się — mniejsze. */
const PREFEROWANE = ['Q4_K_M', 'Q5_K_M', 'Q4_K_S', 'Q4_0', 'IQ4_XS', 'Q3_K_M', 'Q3_K_L', 'Q6_K', 'Q8_0', 'IQ3_M', 'Q3_K_S', 'Q2_K'];

/**
 * Z listy plików repo wybierz GGUF, który zmieści się w VRAM (≤ 90%). Pliki dzielone (-00001-of-00003) liczymy razem.
 * @returns {{ kwant:string, gb:number, plik:string } | null}
 */
export function wybierzPlik(pliki, vramGB, { jedenPlik = false } = {}) {
    const grupy = new Map();
    for (const p of pliki ?? []) {
        const nazwa = String(p.path ?? p.nazwa ?? '');
        if (!/\.gguf$/i.test(nazwa) || /mmproj|imatrix/i.test(nazwa)) continue;
        const k = kwant(path.basename(nazwa));
        if (!k) continue;
        const bajty = Number(p.lfs?.size ?? p.size ?? 0);
        const g = grupy.get(k) ?? { kwant: k, bajty: 0, plik: nazwa, czesci: 0 };
        g.bajty += bajty; g.czesci++;
        grupy.set(k, g);
    }
    const limit = vramGB * 0.9 * 1e9;
    // Spoza HF kujemy jeden plik przez `ollama create` — modeli dzielonych na części tak nie złożymy.
    const pasujace = [...grupy.values()].filter((g) => g.bajty > 0 && g.bajty <= limit && (!jedenPlik || g.czesci === 1));
    pasujace.sort((a, b) => {
        const ia = PREFEROWANE.indexOf(a.kwant), ib = PREFEROWANE.indexOf(b.kwant);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const w = pasujace[0];
    return w ? { kwant: w.kwant, gb: Math.round(w.bajty / 1e8) / 10, plik: w.plik } : null;
}

/**
 * Format wag w repo — Ollama (i Kuźnia Modeli) bierze tylko GGUF. Reszta to wagi „pod innych operatorów":
 * MLX = Apple Silicon (Mac M1–M4), safetensors/PyTorch = transformers/vLLM — da się je zamienić w GGUF
 * (llama.cpp convert_hf_to_gguf), ale tylko dla architektur, które llama.cpp zna.
 * @returns {{ format:'gguf'|'mlx'|'safetensors'|'pytorch'|'nieznany', gb:number|null, co:string }}
 */
export function formatRepo(repo, pliki) {
    const nazwy = (pliki ?? []).map((p) => String(p.path ?? p.nazwa ?? ''));
    const gb = (re) => { const b = (pliki ?? []).filter((p) => re.test(String(p.path ?? ''))).reduce((a, p) => a + Number(p.lfs?.size ?? p.size ?? 0), 0); return b ? Math.round(b / 1e8) / 10 : null; };
    if (nazwy.some((n) => /\.gguf$/i.test(n))) return { format: 'gguf', gb: gb(/\.gguf$/i), co: 'GGUF — Ollama to uruchomi.' };
    const mlx = /(^|[-_/])mlx([-_/]|$)/i.test(String(repo)) || nazwy.some((n) => /\.npz$/i.test(n));
    if (mlx) return { format: 'mlx', gb: gb(/\.(safetensors|npz)$/i), co: 'MLX — wagi dla Apple Silicon (Mac M1–M4, biblioteka mlx). Na Windows z kartą NVIDIA ich nie uruchomisz; MLX-owej kwantyzacji nie zamienisz też w GGUF — potrzebny oryginał (safetensors) albo gotowy GGUF.' };
    if (nazwy.some((n) => /\.safetensors$/i.test(n))) return { format: 'safetensors', gb: gb(/\.safetensors$/i), co: 'safetensors (transformers) — do Ollamy trzeba je zamienić w GGUF (llama.cpp convert_hf_to_gguf, gdy zna architekturę) albo użyć jako bazy w Kuźni Soup (Kuźnia sama eksportuje GGUF).' };
    if (nazwy.some((n) => /(pytorch_model.*\.bin|\.pt|\.pth)$/i.test(n))) return { format: 'pytorch', gb: gb(/\.(bin|pt|pth)$/i), co: 'PyTorch (.bin) — jak safetensors: konwersja do GGUF albo baza Kuźni Soup.' };
    return { format: 'nieznany', gb: null, co: 'Nie widzę tu wag w znanym formacie.' };
}

/** Nazwa bazowa modelu bez dopisków formatu („Jev-Omni-MLX-4bit" → „Jev-Omni") — do szukania jego wersji GGUF. */
export const rdzenNazwy = (repo) => String(repo).split('/').pop()
    .replace(/[-_.](mlx|gguf|awq|gptq|exl2|bnb|onnx|fp16|bf16|fp8|int[48]|\d+[-_]?bits?|q\d\w*)(?=$|[-_.])/gi, '').replace(/[-_.]+$/, '');

/** Nazwa, pod którą Ollama pobiera model prosto z HuggingFace. */
export const nazwaOllamy = (repo, k) => `hf.co/${repo}:${k}`;

/** Czy Ollama ma już ten model (dowolną kwantyzację z tego repo). */
export function wOllamie(repo, tagi) {
    const r = `hf.co/${repo}`.toLowerCase();
    return (tagi ?? []).some((t) => String(t).toLowerCase() === r || String(t).toLowerCase().startsWith(`${r}:`));
}

/**
 * Link → { zrodlo, repo, plik? }. Rozumie: https://huggingface.co/a/b[/blob|resolve|tree/main/plik.gguf], hf.co/a/b[:Q4_K_M],
 * https://pirateface.co/a/b[...], a samo „a/b" traktuje jako HuggingFace. Inne adresy → null.
 */
export function czytajLink(link) {
    const t = String(link ?? '').trim();
    if (!t || t.length > 400) return null;
    if (REPO.test(t)) return { zrodlo: 'hf', repo: t };
    const m0 = t.match(/^(?:https?:\/\/)?hf\.co\/([\w.-]+\/[\w.-]+?)(?::([\w.-]+))?\/?$/i);
    if (m0) return { zrodlo: 'hf', repo: m0[1], kwant: m0[2]?.toUpperCase() };
    let u;
    try { u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`); } catch { return null; }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const zrodlo = host === 'huggingface.co' ? 'hf' : host === 'pirateface.co' ? 'pirateface' : null;
    if (!zrodlo) return null;
    const cz = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (cz[0] === 'models') cz.shift();   // /models/a/b — styl API
    if (cz.length < 2 || !REPO.test(`${cz[0]}/${cz[1]}`)) return null;
    const repo = `${cz[0]}/${cz[1]}`;
    const plik = ['blob', 'resolve', 'tree'].includes(cz[2]) && cz.length > 4 ? cz.slice(4).join('/') : null;
    return { zrodlo, repo, ...(plik && /\.gguf$/i.test(plik) ? { plik } : {}) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Zwiad
// ─────────────────────────────────────────────────────────────────────────────

let biezacy = null;   // { id, stan, etap, blad, znaleziono, od, koniec }

async function hfJson(sciezka, zrodlo = 'hf') {
    const z = ZRODLA[zrodlo];
    const r = await cfg.fetch(`${z.baza()}${sciezka}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`${z.nazwa}: HTTP ${r.status} (${sciezka.split('?')[0]})`);
    try { return await r.json(); } catch { throw new Error(`${z.nazwa}: odpowiedź nie jest JSON-em (inne API niż HuggingFace?)`); }
}

async function tagiOllamy() {
    try {
        const r = await cfg.fetch(`${cfg.ollama}/api/tags`, { signal: AbortSignal.timeout(8000) });
        return ((await r.json()).models ?? []).map((m) => m.name);
    } catch { return []; }
}

async function opinia(repo, zrodlo = 'hf') {
    if (!cfg.pisz) return null;
    try {
        const r = await cfg.fetch(`${ZRODLA[zrodlo].baza()}/${repo}/raw/main/README.md`, { signal: AbortSignal.timeout(15_000) });
        const karta = r.ok ? (await r.text()).slice(0, 4000) : '';
        const tekst = await cfg.pisz({
            system: 'Jesteś Zwiadowca — TeOgochi Katedry OtakOS, który szuka modeli językowych. Odpowiadasz JEDNYM zdaniem po polsku: do czego ten model się nadaje i któremu TeOgochi (Kodeks — kod, Reżyser/Kronikarz — pisanie, Joanna — muzyka i teksty, Wektor — wiedza i ocena, Bilans — liczby, Kupiec — handel, Pionek — gry) przyda się najbardziej. Bez obietnic, których karta nie potwierdza.',
            prompt: `MODEL: ${repo}\n\nKARTA MODELU (początek):\n${karta || '(brak karty)'}`,
        });
        return String(tekst || '').trim().split('\n')[0].slice(0, 300) || null;
    } catch { return null; }
}

/** Kandydat z repo i wybranego pliku. HF → `ollama pull hf.co/…`; inne źródła → pobranie pliku + Kuźnia Modeli. */
function nowyKandydat({ zrodlo, repo, meta = {}, w }) {
    const hf = zrodlo === 'hf';
    return {
        id: idKandydata(zrodlo, repo), zrodlo, zweryfikowane: ZRODLA[zrodlo].zweryfikowane, repo,
        pobrania: meta.pobrania ?? null, polubienia: meta.polubienia ?? null, zmieniony: meta.zmieniony ?? null, zapytanie: meta.zapytanie ?? null,
        kwant: w.kwant, gb: w.gb, plik: w.plik,
        ollama: hf ? nazwaOllamy(repo, w.kwant) : nazwaWykutego(repo, w.kwant),
        url: `${ZRODLA[zrodlo].baza()}/${repo}`,
        opinia: null, stan: 'nowy', znaleziony: new Date().toISOString(),
    };
}
/** Nazwa modelu wykutego z pliku spoza HF: `pf-<repo>-<kwant>` (małe litery, bezpieczne znaki). */
export function nazwaWykutego(repo, k) {
    return `pf-${String(repo).split('/')[1]}-${k}`.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/**
 * Zwiad w tle: dla każdego źródła zapytania → repo z GGUF → plik mieszczący się w VRAM → nowi kandydaci (+ opinia).
 * Źródło, które w całości nie odpowiada, melduje błąd; zwiad pada dopiero, gdy nie odpowiedziało żadne.
 * @returns {{ id:string, sondaz:string }}
 */
export async function zwiad({ zapytania = cfg.zapytania, naZapytanie = 8, opinii = 6, zrodla = cfg.zrodla } = {}) {
    if (!cfg.wlaczony) throw new Error('Zwiadowca wyłączony (OTAKOS_ZWIADOWCA=0).');
    if (biezacy?.stan === 'trwa') throw new Error('Zwiadowca już jest w terenie — poczekaj na meldunek.');
    const lista = [...new Set((zapytania ?? []).map((z) => String(z).trim().toLowerCase()).filter((z) => /^[\p{L}\d .+_-]{2,40}$/u.test(z)))].slice(0, 10);
    if (!lista.length) throw new Error('Podaj słowa do szukania (np. polish, coder).');
    const zr = (zrodla ?? []).filter((x) => ZRODLA[x]);
    if (!zr.length) throw new Error('Brak znanych źródeł (hf, pirateface).');
    const z = biezacy = { id: `zw-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`, stan: 'trwa', etap: 'start', blad: null, znaleziono: 0, bledyZrodel: [], od: new Date().toISOString(), koniec: null };
    (async () => {
        try {
            const d = await czytaj();
            const znane = new Set(d.kandydaci.map((k) => kluczKandydata(zrodloKandydata(k), k.repo)));
            const tagi = await tagiOllamy();
            const repo = new Map();   // klucz → { zrodlo, repo, meta }
            for (const zrodlo of zr) {
                let bledy = 0, ostatniBlad = null;
                for (const q of lista) {
                    z.etap = `${ZRODLA[zrodlo].nazwa}: szukam „${q}"`;
                    const wyniki = await hfJson(`/api/models?search=${encodeURIComponent(q)}&filter=gguf&sort=downloads&direction=-1&limit=${naZapytanie}`, zrodlo)
                        .then((w) => { if (!Array.isArray(w)) throw new Error(`${ZRODLA[zrodlo].nazwa}: odpowiedź nie jest listą modeli (inne API niż HuggingFace?)`); return w; })
                        .catch((e) => { bledy++; ostatniBlad = e.message; return []; });
                    for (const m of Array.isArray(wyniki) ? wyniki : []) {
                        const id = String(m.id ?? m.modelId ?? '');
                        const klucz = kluczKandydata(zrodlo, id);
                        if (!REPO.test(id) || znane.has(klucz) || repo.has(klucz) || (zrodlo === 'hf' && wOllamie(id, tagi))) continue;
                        repo.set(klucz, { zrodlo, repo: id, meta: { pobrania: m.downloads ?? null, polubienia: m.likes ?? null, zmieniony: m.lastModified ?? m.createdAt ?? null, zapytanie: q } });
                    }
                }
                if (bledy === lista.length) z.bledyZrodel.push(`${ZRODLA[zrodlo].nazwa} nieosiągalny (${ostatniBlad})`);
            }
            // Żadne źródło nie odpowiedziało = nie wiemy nic. Meldunek „bez nowych modeli" byłby nieprawdą.
            if (z.bledyZrodel.length === zr.length) throw new Error(z.bledyZrodel.join('; '));
            const nowi = [];
            for (const { zrodlo, repo: id, meta } of repo.values()) {
                z.etap = `pliki: ${id}`;
                const pliki = await hfJson(`/api/models/${id}/tree/main`, zrodlo).catch(() => null);
                const w = pliki && wybierzPlik(pliki, cfg.vramGB, { jedenPlik: zrodlo !== 'hf' });
                if (!w) continue;
                nowi.push(nowyKandydat({ zrodlo, repo: id, meta, w }));
            }
            nowi.sort((a, b) => (b.pobrania ?? 0) - (a.pobrania ?? 0));
            for (const k of nowi.slice(0, opinii)) { z.etap = `czytam kartę: ${k.repo}`; k.opinia = await opinia(k.repo, k.zrodlo); }
            const swiezy = await czytaj();   // w międzyczasie Suweren mógł coś zaakceptować
            swiezy.kandydaci = [...nowi, ...swiezy.kandydaci].slice(0, 200);
            swiezy.ostatniZwiad = { kiedy: new Date().toISOString(), zapytania: lista, zrodla: zr, nowych: nowi.length, bledyZrodel: z.bledyZrodel };
            await zapisz(swiezy);
            z.znaleziono = nowi.length;
            z.stan = 'gotowe';
            const niezw = nowi.filter((k) => !k.zweryfikowane).length;
            await nadaj((nowi.length
                ? `${nowi.length} nowych modeli czeka na akceptację (np. ${nowi.slice(0, 3).map((k) => `${k.repo} ${k.kwant} ${k.gb} GB`).join(', ')})${niezw ? ` — w tym ${niezw} z NIEZWERYFIKOWANEGO źródła` : ''} — Dyrygent widzi je w katalogu jako kandydatów`
                : 'zwiad bez nowych modeli mieszczących się w karcie graficznej') + (z.bledyZrodel.length ? `. Nie odpowiedziało: ${z.bledyZrodel.join('; ')}` : ''), { kandydaci: nowi.map((k) => k.id) });
        } catch (e) {
            z.stan = 'blad'; z.blad = String(e.message || e).slice(0, 300);
            await nadaj(`zwiad przerwany: ${z.blad}`);
        } finally {
            z.koniec = new Date().toISOString();
        }
    })();
    return { id: z.id, sondaz: '/api/zwiadowca/sondaz' };
}

/**
 * Kandydat z bezpośredniego linku (HF albo pirateface). Sprawdza pliki repo i dobiera GGUF (albo bierze wskazany plik,
 * gdy się mieści). Znany kandydat wraca jako „nowy" (chyba że już pobrany). Nic nie pobiera.
 */
export async function zLinku(link) {
    if (!cfg.wlaczony) throw new Error('Zwiadowca wyłączony (OTAKOS_ZWIADOWCA=0).');
    const l = czytajLink(link);
    if (!l) throw new Error('Nie rozumiem tego linku — podaj adres modelu z huggingface.co albo pirateface.co (albo „właściciel/repo").');
    const jedenPlik = l.zrodlo !== 'hf';
    const pliki = await hfJson(`/api/models/${l.repo}/tree/main`, l.zrodlo);
    if (!Array.isArray(pliki)) throw new Error(`${ZRODLA[l.zrodlo].nazwa} nie oddał listy plików ${l.repo} (inne API niż HuggingFace?)`);
    let w;
    if (l.plik) {
        const p = pliki.find((x) => String(x.path) === l.plik);
        if (!p) throw new Error(`W ${l.repo} nie ma pliku ${l.plik}.`);
        w = wybierzPlik([p], cfg.vramGB, { jedenPlik });
        if (!w) throw new Error(`${l.plik} nie mieści się w karcie (${cfg.vramGB} GB VRAM) albo to nie jest GGUF.`);
    } else {
        const f = formatRepo(l.repo, pliki);
        if (f.format !== 'gguf') {
            // Nie „brak pliku", tylko PRAWDA o formacie + czy ktoś już zrobił GGUF tego modelu (wtedy wystarczy jego link).
            const rdzen = rdzenNazwy(l.repo);
            const gguf = rdzen.length >= 3 ? await hfJson(`/api/models?search=${encodeURIComponent(rdzen)}&filter=gguf&sort=downloads&direction=-1&limit=5`, 'hf')
                .then((x) => (Array.isArray(x) ? x.map((m) => String(m.id ?? m.modelId ?? '')).filter((id) => REPO.test(id)) : [])).catch(() => null) : [];
            const e = new Error(`${l.repo}: ${f.co}${f.gb ? ` (${f.gb} GB)` : ''} ` +
                (gguf === null ? 'Nie sprawdziłem, czy jest wersja GGUF (HuggingFace nie odpowiedział).'
                    : gguf.length ? `Wersje GGUF „${rdzen}" na HuggingFace: ${gguf.join(', ')} — podaj link do którejś.`
                        : `Na HuggingFace nie ma jeszcze wersji GGUF „${rdzen}".`));
            e.format = f.format; e.gguf = gguf ?? [];
            throw e;
        }
        const wszystkie = l.kwant ? pliki.filter((p) => kwant(path.basename(String(p.path ?? ''))) === l.kwant) : pliki;
        w = wybierzPlik(wszystkie, cfg.vramGB, { jedenPlik });
        if (!w) throw new Error(`W ${l.repo} nie ma pliku GGUF, który zmieści się w karcie (${cfg.vramGB} GB VRAM)${jedenPlik ? ' jako jeden plik' : ''}.`);
    }
    const k = nowyKandydat({ zrodlo: l.zrodlo, repo: l.repo, meta: { zapytanie: 'link' }, w });
    k.opinia = await opinia(l.repo, l.zrodlo);
    const d = await czytaj();
    const byl = d.kandydaci.find((x) => x.id === k.id);
    if (byl?.stan === 'pobrany') throw new Error(`${l.repo} już jest w Katedrze jako ${byl.ollama}.`);
    if (byl?.stan === 'pobiera') throw new Error(`${l.repo} właśnie się pobiera.`);
    d.kandydaci = [k, ...d.kandydaci.filter((x) => x.id !== k.id)].slice(0, 200);
    await zapisz(d);
    await nadaj(`Suweren podał link: ${l.repo} (${ZRODLA[l.zrodlo].nazwa}${k.zweryfikowane ? '' : ', NIEZWERYFIKOWANE'}) — ${k.kwant}, ${k.gb} GB, czeka na akceptację`, { kandydat: k.id });
    return k;
}

export function sondaz() {
    if (!biezacy) return { stan: 'brak', etap: null, blad: null, podsumowanie: null };
    const pobiera = [...pobierania.values()].find((p) => p.stan === 'trwa');
    return {
        stan: biezacy.stan, etap: biezacy.etap, blad: biezacy.blad,
        podsumowanie: biezacy.stan === 'gotowe' ? `znaleziono ${biezacy.znaleziono} nowych modeli` : null,
        pobiera: pobiera ? { repo: pobiera.repo, postep: pobiera.postep } : null,
    };
}

export async function kandydaci({ wszystkie = false } = {}) {
    const d = await czytaj();
    const lista = wszystkie ? d.kandydaci : d.kandydaci.filter((k) => k.stan !== 'odrzucony');
    return { kandydaci: lista.map((k) => ({ ...k, postep: pobierania.get(k.id)?.postep ?? null })), ostatniZwiad: d.ostatniZwiad, trwa: biezacy?.stan === 'trwa', vramGB: cfg.vramGB };
}

// ─────────────────────────────────────────────────────────────────────────────
// Decyzja Suwerena: akceptacja → pobranie do Ollamy; odrzucenie → nie wraca w kolejnych zwiadach
// ─────────────────────────────────────────────────────────────────────────────

const pobierania = new Map();   // id → { repo, stan, postep }

async function zmien(id, fn) {
    const d = await czytaj();
    const k = d.kandydaci.find((x) => x.id === id);
    if (!k) throw new Error('Nie ma takiego kandydata.');
    const w = fn(k);
    await zapisz(d);
    return w ?? k;
}

export async function odrzuc(id) {
    return zmien(id, (k) => {
        if (k.stan === 'pobiera') throw new Error('Model właśnie się pobiera.');
        k.stan = 'odrzucony'; k.decyzja = new Date().toISOString();
    });
}

/** Domyślne pobieranie pliku (spoza HF): strumień do `<cel>.part`, potem zmiana nazwy — przerwane nie udaje gotowego. */
async function domyslnePobierz(url, cel, naPostep) {
    const r = await cfg.fetch(url, { redirect: 'follow' });
    if (!r.ok || !r.body) throw new Error(`pobieranie: HTTP ${r.status}`);
    const razem = Number(r.headers?.get?.('content-length')) || 0;
    let ile = 0;
    const zrodlo = Readable.fromWeb ? Readable.fromWeb(r.body) : Readable.from(r.body);
    zrodlo.on('data', (k) => { ile += k.length; if (razem) naPostep(`pobieram ${Math.round(ile / razem * 100)}%`); });
    await fs.mkdir(path.dirname(cel), { recursive: true });
    await pipeline(zrodlo, fsSync.createWriteStream(`${cel}.part`));
    if (razem && ile !== razem) throw new Error(`pobrano ${ile} z ${razem} bajtów — plik niepełny`);
    await fs.rename(`${cel}.part`, cel);
}

async function pobierzZHf(k, p) {
    const r = await cfg.fetch(`${cfg.ollama}/api/pull`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: k.ollama, name: k.ollama, stream: true }),
    });
    if (!r.ok || !r.body) throw new Error(`Ollama: HTTP ${r.status}`);
    let reszta = '', ostatni = null;
    for await (const kawalek of r.body) {
        reszta += Buffer.from(kawalek).toString('utf8');
        const linie = reszta.split('\n'); reszta = linie.pop() ?? '';
        for (const l of linie.filter(Boolean)) {
            let j; try { j = JSON.parse(l); } catch { continue; }
            if (j.error) throw new Error(`Ollama: ${j.error}`);
            ostatni = j;
            p.postep = j.total ? `${j.status} ${Math.round((j.completed ?? 0) / j.total * 100)}%` : j.status;
        }
    }
    if (ostatni?.status !== 'success') throw new Error(`pobieranie urwane (${ostatni?.status ?? 'brak odpowiedzi'})`);
}

/** Spoza HF: jeden plik GGUF do katalogu Kuźni Modeli → `ollama create` (Kuźnia Modeli) jako `pf-<repo>-<kwant>`. */
async function pobierzIWykuj(k, p) {
    if (!cfg.wykuj || !cfg.stanKucia) throw new Error('Most nie podpiął Kuźni Modeli — spoza HuggingFace model trzeba wykuć z pliku.');
    const plik = `${k.repo.split('/')[0]}__${path.basename(k.plik)}`.replace(/[^\w.-]+/g, '_');
    const cel = path.join(cfg.katalogModeli, plik);
    const url = `${ZRODLA[zrodloKandydata(k)].baza()}/${k.repo}/resolve/main/${k.plik.split('/').map(encodeURIComponent).join('/')}`;
    if (!fsSync.existsSync(cel)) await (cfg.pobierzPlik ?? domyslnePobierz)(url, cel, (t) => { p.postep = t; });
    p.postep = 'kuję do Ollamy';
    const w = await cfg.wykuj({ plik, nazwa: k.ollama });
    if (!w?.ok) throw new Error(`Kuźnia Modeli: ${w?.powod ?? 'odmowa'}`);
    for (let i = 0; i < 3600; i++) {
        const s = cfg.stanKucia(w.id);
        if (s?.stan === 'gotowe') return;
        if (!s || s.stan === 'blad') throw new Error(`Kuźnia Modeli: ${s?.blad ?? 'kucie przerwane'}`);
        p.postep = `kuję: ${s.postep ?? '…'}`.slice(0, 120);
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('kucie nie skończyło się w 2 godziny');
}

/**
 * Akceptacja: HF → `ollama pull hf.co/<repo>:<kwant>`; inne źródła → pobranie pliku + Kuźnia Modeli. W tle;
 * po pobraniu karta modelu dla Dyrygenta z opinii Zwiadowcy (z dopiskiem o źródle, gdy niezweryfikowane).
 */
export async function akceptuj(id) {
    if ([...pobierania.values()].some((p) => p.stan === 'trwa')) throw new Error('Inny model już się pobiera — jeden naraz.');
    const k = await zmien(id, (x) => {
        if (x.stan === 'pobrany') throw new Error('Ten model już jest w Ollamie.');
        x.stan = 'pobiera'; x.decyzja = new Date().toISOString(); x.blad = null;
    });
    const zrodlo = zrodloKandydata(k);
    const p = { repo: k.repo, stan: 'trwa', postep: 'start' };
    pobierania.set(id, p);
    await nadaj(`Suweren przyjął ${k.repo} (${k.kwant}, ${k.gb} GB${zrodlo === 'hf' ? '' : `, ${ZRODLA[zrodlo].nazwa} — niezweryfikowane`}) — pobieram do Ollamy`, { kandydat: id });
    (async () => {
        try {
            if (zrodlo === 'hf') await pobierzZHf(k, p);
            else await pobierzIWykuj(k, p);
            p.stan = 'gotowe';
            await zmien(id, (x) => { x.stan = 'pobrany'; x.pobrany = new Date().toISOString(); });
            const skad = zrodlo === 'hf' ? `Z HuggingFace (${k.repo})` : `Z ${ZRODLA[zrodlo].nazwa} (${k.repo}) — źródło NIEZWERYFIKOWANE`;
            if (cfg.ustawKarte) await cfg.ustawKarte(k.ollama, { opis: k.opinia ? `${k.opinia}${zrodlo === 'hf' ? '' : ` (${skad})`}` : `${skad}, ${k.kwant}, ${k.gb} GB — znalazł Zwiadowca.`, mocne: [] }).catch(() => {});
            await nadaj(`${k.repo} jest w Ollamie jako ${k.ollama} — Dyrygent może go przydzielać`, { kandydat: id, glos: `Zwiadowca: nowy model ${k.repo.split('/')[1]} jest w Katedrze.` });
        } catch (e) {
            p.stan = 'blad';
            const blad = String(e.message || e).slice(0, 300);
            await zmien(id, (x) => { x.stan = 'blad'; x.blad = blad; }).catch(() => {});
            await nadaj(`nie pobrałem ${k.repo}: ${blad}`, { kandydat: id });
        }
    })();
    return { id, repo: k.repo, ollama: k.ollama };
}

export default { skonfiguruj, zwiad, zLinku, formatRepo, rdzenNazwy, sondaz, kandydaci, akceptuj, odrzuc, kwant, wybierzPlik, nazwaOllamy, nazwaWykutego, wOllamie, czytajLink, ZRODLA };
