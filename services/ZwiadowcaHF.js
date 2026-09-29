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
 * Wyłączenie: OTAKOS_ZWIADOWCA=0.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

let cfg = {
    katalog: path.join(process.cwd(), '_OtakOs_Wymiar', 'zwiadowca'),
    hf: 'https://huggingface.co',
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
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

const PLIK = () => path.join(cfg.katalog, 'kandydaci.json');
const REPO = /^[\w.-]{1,96}\/[\w.-]{1,96}$/;
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
export function wybierzPlik(pliki, vramGB) {
    const grupy = new Map();
    for (const p of pliki ?? []) {
        const nazwa = String(p.path ?? p.nazwa ?? '');
        if (!/\.gguf$/i.test(nazwa) || /mmproj|imatrix/i.test(nazwa)) continue;
        const k = kwant(path.basename(nazwa));
        if (!k) continue;
        const bajty = Number(p.lfs?.size ?? p.size ?? 0);
        const g = grupy.get(k) ?? { kwant: k, bajty: 0, plik: nazwa };
        g.bajty += bajty;
        grupy.set(k, g);
    }
    const limit = vramGB * 0.9 * 1e9;
    const pasujace = [...grupy.values()].filter((g) => g.bajty > 0 && g.bajty <= limit);
    pasujace.sort((a, b) => {
        const ia = PREFEROWANE.indexOf(a.kwant), ib = PREFEROWANE.indexOf(b.kwant);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const w = pasujace[0];
    return w ? { kwant: w.kwant, gb: Math.round(w.bajty / 1e8) / 10, plik: w.plik } : null;
}

/** Nazwa, pod którą Ollama pobiera model prosto z HuggingFace. */
export const nazwaOllamy = (repo, k) => `hf.co/${repo}:${k}`;

/** Czy Ollama ma już ten model (dowolną kwantyzację z tego repo). */
export function wOllamie(repo, tagi) {
    const r = `hf.co/${repo}`.toLowerCase();
    return (tagi ?? []).some((t) => String(t).toLowerCase() === r || String(t).toLowerCase().startsWith(`${r}:`));
}

// ─────────────────────────────────────────────────────────────────────────────
// Zwiad
// ─────────────────────────────────────────────────────────────────────────────

let biezacy = null;   // { id, stan, etap, blad, znaleziono, od, koniec }

async function hfJson(sciezka) {
    const r = await cfg.fetch(`${cfg.hf}${sciezka}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`HuggingFace: HTTP ${r.status} (${sciezka.split('?')[0]})`);
    return r.json();
}

async function tagiOllamy() {
    try {
        const r = await cfg.fetch(`${cfg.ollama}/api/tags`, { signal: AbortSignal.timeout(8000) });
        return ((await r.json()).models ?? []).map((m) => m.name);
    } catch { return []; }
}

async function opinia(repo) {
    if (!cfg.pisz) return null;
    try {
        const r = await cfg.fetch(`${cfg.hf}/${repo}/raw/main/README.md`, { signal: AbortSignal.timeout(15_000) });
        const karta = r.ok ? (await r.text()).slice(0, 4000) : '';
        const tekst = await cfg.pisz({
            system: 'Jesteś Zwiadowca — TeOgochi Katedry OtakOS, który szuka modeli językowych. Odpowiadasz JEDNYM zdaniem po polsku: do czego ten model się nadaje i któremu TeOgochi (Kodeks — kod, Reżyser/Kronikarz — pisanie, Joanna — muzyka i teksty, Wektor — wiedza i ocena, Bilans — liczby, Kupiec — handel, Pionek — gry) przyda się najbardziej. Bez obietnic, których karta nie potwierdza.',
            prompt: `MODEL: ${repo}\n\nKARTA MODELU (początek):\n${karta || '(brak karty)'}`,
        });
        return String(tekst || '').trim().split('\n')[0].slice(0, 300) || null;
    } catch { return null; }
}

/**
 * Zwiad w tle: zapytania → repo z GGUF → plik mieszczący się w VRAM → nowi kandydaci (+ opinia Zwiadowcy).
 * @returns {{ id:string, sondaz:string }}
 */
export async function zwiad({ zapytania = cfg.zapytania, naZapytanie = 8, opinii = 6 } = {}) {
    if (!cfg.wlaczony) throw new Error('Zwiadowca wyłączony (OTAKOS_ZWIADOWCA=0).');
    if (biezacy?.stan === 'trwa') throw new Error('Zwiadowca już jest w terenie — poczekaj na meldunek.');
    const lista = [...new Set((zapytania ?? []).map((z) => String(z).trim().toLowerCase()).filter((z) => /^[\p{L}\d .+_-]{2,40}$/u.test(z)))].slice(0, 10);
    if (!lista.length) throw new Error('Podaj słowa do szukania (np. polish, coder).');
    const z = biezacy = { id: `zw-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`, stan: 'trwa', etap: 'start', blad: null, znaleziono: 0, od: new Date().toISOString(), koniec: null };
    (async () => {
        try {
            const d = await czytaj();
            const znane = new Set(d.kandydaci.map((k) => k.repo.toLowerCase()));
            const tagi = await tagiOllamy();
            const repo = new Map();
            let bledy = 0, ostatniBlad = null;
            for (const q of lista) {
                z.etap = `szukam: ${q}`;
                const wyniki = await hfJson(`/api/models?search=${encodeURIComponent(q)}&filter=gguf&sort=downloads&direction=-1&limit=${naZapytanie}`)
                    .catch((e) => { bledy++; ostatniBlad = e.message; return []; });
                for (const m of Array.isArray(wyniki) ? wyniki : []) {
                    const id = String(m.id ?? m.modelId ?? '');
                    if (!REPO.test(id) || znane.has(id.toLowerCase()) || repo.has(id) || wOllamie(id, tagi)) continue;
                    repo.set(id, { pobrania: m.downloads ?? null, polubienia: m.likes ?? null, zmieniony: m.lastModified ?? m.createdAt ?? null, zapytanie: q });
                }
            }
            // Wszystkie zapytania padły = nie wiemy nic. Meldunek „bez nowych modeli" byłby nieprawdą.
            if (bledy === lista.length) throw new Error(`HuggingFace nieosiągalny (${ostatniBlad})`);
            const nowi = [];
            for (const [id, meta] of repo) {
                z.etap = `pliki: ${id}`;
                const pliki = await hfJson(`/api/models/${id}/tree/main`).catch(() => null);
                const w = pliki && wybierzPlik(pliki, cfg.vramGB);
                if (!w) continue;
                nowi.push({ id: crypto.createHash('sha1').update(id).digest('hex').slice(0, 10), repo: id, ...meta, kwant: w.kwant, gb: w.gb, plik: w.plik, ollama: nazwaOllamy(id, w.kwant), opinia: null, stan: 'nowy', znaleziony: new Date().toISOString() });
            }
            nowi.sort((a, b) => (b.pobrania ?? 0) - (a.pobrania ?? 0));
            for (const k of nowi.slice(0, opinii)) { z.etap = `czytam kartę: ${k.repo}`; k.opinia = await opinia(k.repo); }
            const swiezy = await czytaj();   // w międzyczasie Suweren mógł coś zaakceptować
            swiezy.kandydaci = [...nowi, ...swiezy.kandydaci].slice(0, 200);
            swiezy.ostatniZwiad = { kiedy: new Date().toISOString(), zapytania: lista, nowych: nowi.length };
            await zapisz(swiezy);
            z.znaleziono = nowi.length;
            z.stan = 'gotowe';
            await nadaj(nowi.length
                ? `${nowi.length} nowych modeli z HuggingFace czeka na akceptację (np. ${nowi.slice(0, 3).map((k) => `${k.repo} ${k.kwant} ${k.gb} GB`).join(', ')}) — Dyrygent widzi je w katalogu jako kandydatów`
                : 'zwiad bez nowych modeli mieszczących się w karcie graficznej', { kandydaci: nowi.map((k) => k.id) });
        } catch (e) {
            z.stan = 'blad'; z.blad = String(e.message || e).slice(0, 300);
            await nadaj(`zwiad przerwany: ${z.blad}`);
        } finally {
            z.koniec = new Date().toISOString();
        }
    })();
    return { id: z.id, sondaz: '/api/zwiadowca/sondaz' };
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

/** Akceptacja: `ollama pull hf.co/<repo>:<kwant>` w tle; po pobraniu karta modelu dla Dyrygenta z opinii Zwiadowcy. */
export async function akceptuj(id) {
    if ([...pobierania.values()].some((p) => p.stan === 'trwa')) throw new Error('Inny model już się pobiera — jeden naraz.');
    const k = await zmien(id, (x) => {
        if (x.stan === 'pobrany') throw new Error('Ten model już jest w Ollamie.');
        x.stan = 'pobiera'; x.decyzja = new Date().toISOString(); x.blad = null;
    });
    const p = { repo: k.repo, stan: 'trwa', postep: 'start' };
    pobierania.set(id, p);
    await nadaj(`Suweren przyjął ${k.repo} (${k.kwant}, ${k.gb} GB) — pobieram do Ollamy`, { kandydat: id });
    (async () => {
        try {
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
            p.stan = 'gotowe';
            await zmien(id, (x) => { x.stan = 'pobrany'; x.pobrany = new Date().toISOString(); });
            if (cfg.ustawKarte) await cfg.ustawKarte(k.ollama, { opis: k.opinia || `Z HuggingFace (${k.repo}), ${k.kwant}, ${k.gb} GB — znalazł Zwiadowca.`, mocne: [] }).catch(() => {});
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

export default { skonfiguruj, zwiad, sondaz, kandydaci, akceptuj, odrzuc, kwant, wybierzPlik, nazwaOllamy, wOllamie };
