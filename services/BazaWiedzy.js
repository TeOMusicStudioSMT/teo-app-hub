/**
 * 📚 Baza Wiedzy Katedry — prywatne kolekcje dokumentów z odpowiedziami z przypisami (RAG lokalnie).
 *
 * Suweren 2026-10-20: model douczony przez znajomego na Shoudach Crimson Circle
 * (`llama-3.2-3b-cc-materials`, 3B, Q4) zmyśla — za mały, a z małego modelu większego nie wyszkolimy.
 * Droga: materiały zostają materiałami (PDF-y Suwerena), a odpowiada WIĘKSZY model, który dostaje
 * tylko znalezione fragmenty i każde twierdzenie podpina pod fragment.
 *
 * Czemu ogólny silnik z kolekcjami, a nie „BibliotekaCC": wszystko poza nazwą pliku i czyszczeniem
 * stron (ekstrakcja, kawałki, embeddingi, BM25, hybryda, zasada „tylko z fragmentów”) jest takie samo
 * dla każdego zbioru tekstów Suwerena. Kolekcja = katalog źródeł + `meta(nazwaPliku)` + prywatność.
 * Dziś jedna: `shoudy`.
 *
 * Indeks bez bazy zewnętrznej: `<katalog>/<kolekcja>/pliki/<id>.json` (metadane, tekst kawałków)
 * + `<id>.f32` (wektory float32, znormalizowane, wiersz po wierszu). Jeden plik źródła = jedna para,
 * zapisywana dopiero po całym pliku → przerwanie (restart, ⏹) nic nie psuje, wznowienie pomija pliki
 * z tym samym SHA-1 i tym samym modelem embeddingów (przyrostowo: zmieniony plik liczy się od nowa,
 * usunięty — znika z indeksu).
 *
 * PRAWA: materiały © Crimson Circle IP, Inc. — kolekcja `prywatna`: trasy tylko z maszyny
 * (Straż + własny warunek trasy), nic do wizytówki, paczek, Giełdy; odpowiedzi z krótkimi cytatami.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

export const MODEL_EMBEDDINGOW = process.env.OTAKOS_WIEDZA_EMBED || 'hf.co/unsloth/embeddinggemma-2-GGUF:Q8_0';
export const KAWALEK = { min: 800, max: 1200, zakladka: 180 };
/** Wersja czyszczenia i kawałkowania — zmieniasz oczyscStrony/akapity/kawalki, podbij: indeks przeliczy się sam. */
export const WERSJA_KAWALKOW = 2;
const PACZKA_EMBED = 32;
const RRF_K = 60;

export const BRAK = { pl: 'W Shoudach tego nie znalazłem.', en: 'I did not find this in the Shouds.' };

// ─────────────────────────── metadane z nazwy pliku (kolekcja shoudy) ───────────────────────────

/**
 * `<NN - Nazwa Series (rrrr-rrrr)>/<rrrrmmdd>_<Seria>_<Lekcja>_English.pdf` → {seria, lata, data, rok, lekcja, qa}.
 * Seria z katalogu (ładna nazwa), data i lekcja z pliku. Nieznany wzór = to, co się da, reszta null.
 */
export function metaShoudu(rel) {
    const czesci = String(rel).split(/[\\/]/);
    const plik = czesci.pop() || '';
    const katalog = czesci.pop() || '';
    const k = katalog.match(/^\s*(\d+)\s*-\s*(.+?)\s*(?:\((\d{4}(?:-\d{4})?)\))?\s*$/);
    const seria = k ? k[2].trim() : (katalog || null);
    const nr = k ? Number(k[1]) : null;
    const lata = k?.[3] ?? null;
    const baza = plik.replace(/\.pdf$/i, '');
    const d = baza.match(/^(\d{4})(\d{2})(\d{2})_/);
    const data = d ? `${d[1]}-${d[2]}-${d[3]}` : null;
    const reszta = (d ? baza.slice(d[0].length) : baza).replace(/_English(?:_Letter)?$/i, '').replace(/_English_/i, '_');
    const l = reszta.match(/(?:Lesson|Shoud)[-_ ]?\d+(?:-\d+)?(?:-Q&?A)?/i);
    let lekcja = l ? l[0].replace(/_/g, '-') : (reszta.split('_').slice(1).join(' ') || reszta);
    if (/^\d+$/.test(lekcja)) lekcja = `Shoud ${lekcja}`;
    lekcja = lekcja.replace(/-Q&?A$/i, ' Q&A').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    const qa = /Q&?A/i.test(reszta);
    return { seria, nrSerii: nr, lata, data, rok: d ? Number(d[1]) : null, lekcja: lekcja || null, qa };
}

// ─────────────────────────── ekstrakcja i czyszczenie ───────────────────────────

/**
 * Strony PDF jako tekst z liniami (pdf-parse, czysty JS — jedzie z Katedrą, w przeciwieństwie do
 * pdftotext z Gita). Linia = elementy na tej samej wysokości. Import z `lib/` — patrz Laboratorium.tekstZPdf.
 */
export async function stronyZPdf(bufor) {
    const { default: pdf } = await import('pdf-parse/lib/pdf-parse.js');
    const strony = [];
    await pdf(bufor, {
        max: 0,
        pagerender: async (strona) => {
            const tc = await strona.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
            let y, s = '';
            for (const it of tc.items) {
                const ty = it.transform?.[5];
                if (y === undefined || Math.abs(ty - y) < 1) s += it.str; else s += '\n' + it.str;
                y = ty;
            }
            strony[strona.pageIndex] = s;
            return s;
        },
    });
    return strony.map((s) => s ?? '');
}

const STOPKA = [
    /©|\bcopyright\b/i,
    /crimson circle ip/i,
    /please freely distribute/i,
    /mercial, no-charge basis/i,
    /approved in writing by geoffrey hoppe/i,
    /including these notes\. all other uses/i,
    /^\s*the global affiliation of new energy teachers\s*$/i,
    /^\s*see contacts page on website/i,
    /^\s*www\.crimsoncircle\.com\s*$/i,
    /^\s*listen to the audio or watch the video/i,
];

/**
 * Czyści strony: nagłówki/stopki powtarzane na wielu stronach (np. „Illumination • Shoud 1”), same numery
 * stron, linie praw autorskich i noty o dystrybucji. Zwraca strony (tablica linii) w tej samej numeracji.
 */
export function oczyscStrony(strony) {
    const linie = strony.map((s) => String(s).replace(/\r/g, '').replace(/ /g, ' ').split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()));
    // Nagłówek/stopka biegnąca = krótka linia z brzegu strony (2 pierwsze / 2 ostatnie niepuste), powtarzana na ≥ 30% stron.
    // Liczby w krótkich liniach jako „#” („Shoud 1 · 3”, „4”). Linie ze środka strony nie są ruszane — „And so it is.” zostaje.
    const klucz = (l) => (l.length < 40 ? l.toLowerCase().replace(/\d+/g, '#') : l.toLowerCase()).replace(/[^\p{L}\p{N}#]+/gu, '');
    const brzeg = (str) => { const n = str.map((l, i) => (l ? i : -1)).filter((i) => i >= 0); return new Set([...n.slice(0, 2), ...n.slice(-2)]); };
    const brzegi = linie.map(brzeg);
    const ile = new Map();
    linie.forEach((str, s) => { for (const k of new Set([...brzegi[s]].map((i) => klucz(str[i])).filter((k) => k.length >= 3))) ile.set(k, (ile.get(k) ?? 0) + 1); });
    const prog = Math.max(3, Math.ceil(strony.length * 0.3));
    return linie.map((str, s) => str.filter((l, i) => {
        if (!l) return true;   // pusta linia zostaje — bywa granicą akapitu
        if (/^[\divxlc]{1,4}$/i.test(l)) return false;   // sam numer strony
        if (STOPKA.some((r) => r.test(l))) return false;
        if (brzegi[s].has(i) && l.length < 90 && (ile.get(klucz(l)) ?? 0) >= prog) return false;   // nagłówek biegnący
        return true;
    }));
}

/**
 * Akapity z wyczyszczonych stron. PDF łamie linie co szerokość kolumny — koniec akapitu to pusta linia
 * albo linia kończąca zdanie wyraźnie krótsza od typowej. Akapit może przejść przez granicę strony
 * (dostaje stronę, na której się zaczął).
 */
export function akapity(stronyLinii) {
    const wszystkie = stronyLinii.flat().filter(Boolean).map((l) => l.length).sort((a, b) => a - b);
    const typowa = wszystkie.length ? wszystkie[Math.floor(wszystkie.length * 0.75)] : 80;
    const wynik = [];
    let biezacy = null;
    const zamknij = () => { if (biezacy && biezacy.tekst.trim()) wynik.push({ tekst: biezacy.tekst.trim(), strona: biezacy.strona }); biezacy = null; };
    stronyLinii.forEach((linie, i) => {
        for (const l of linie) {
            if (!l) { zamknij(); continue; }
            if (!biezacy) biezacy = { tekst: '', strona: i + 1 };
            biezacy.tekst = biezacy.tekst ? (biezacy.tekst.endsWith('-') && /^[a-z]/.test(l) ? biezacy.tekst.slice(0, -1) + l : `${biezacy.tekst} ${l}`) : l;
            if (/[.!?…"”'’)\]]$/.test(l) && l.length < typowa * 0.85) zamknij();
        }
    });
    zamknij();
    return wynik;
}

/** Zdania (proste: kropka/wykrzyknik/pytajnik + spacja + wielka litera lub cudzysłów). */
export function zdania(tekst) {
    return String(tekst).split(/(?<=[.!?…]["”’)]?)\s+(?=["“‘(\[]?[\p{Lu}0-9])/u).map((z) => z.trim()).filter(Boolean);
}

/**
 * Kawałki ~min–max znaków po akapitach, z zakładką (końcowe zdania poprzedniego kawałka ≤ `zakladka`
 * znaków na początku następnego). Za długi akapit dzielony po zdaniach; zdanie dłuższe niż max — po słowach.
 */
export function kawalki(listaAkapitow, { min = KAWALEK.min, max = KAWALEK.max, zakladka = KAWALEK.zakladka } = {}) {
    const jednostki = [];
    for (const a of listaAkapitow) {
        if (a.tekst.length <= max) { jednostki.push({ ...a, akapit: true }); continue; }
        for (const z of zdania(a.tekst)) {
            if (z.length <= max) { jednostki.push({ tekst: z, strona: a.strona, akapit: false }); continue; }
            const slowa = z.split(' ');
            let s = '';
            for (const w of slowa) { if ((s + ' ' + w).length > max && s) { jednostki.push({ tekst: s, strona: a.strona, akapit: false }); s = w; } else s = s ? `${s} ${w}` : w; }
            if (s) jednostki.push({ tekst: s, strona: a.strona, akapit: false });
        }
    }
    const wynik = [];
    let tekst = '', strona = null, nowych = 0, ogonDl = 0;
    const odcinij = () => {
        if (!nowych) return;
        wynik.push({ tekst: tekst.trim(), strona });
        // zakładka: ostatnie zdania do `zakladka` znaków
        const zd = zdania(tekst);
        let ogon = '';
        for (let i = zd.length - 1; i >= 0; i--) { if ((zd[i] + ' ' + ogon).length > zakladka) break; ogon = `${zd[i]} ${ogon}`.trim(); }
        tekst = ogon; ogonDl = ogon.length; strona = null; nowych = 0;
    };
    for (const j of jednostki) {
        if (nowych && tekst.length + 1 + j.tekst.length > max) odcinij();
        if (strona === null) strona = j.strona;
        tekst = tekst ? `${tekst}${j.akapit ? '\n' : ' '}${j.tekst}` : j.tekst;
        nowych++;
        if (tekst.length >= min) odcinij();
    }
    if (nowych) {
        // krótka końcówka (bez zakładki) dołącza do poprzedniego kawałka, gdy ten nie urośnie ponad 1,25 × max
        const ostatni = wynik[wynik.length - 1];
        const nowe = tekst.slice(ogonDl).trim();
        if (ostatni && tekst.trim().length < min / 2 && ostatni.tekst.length + nowe.length <= max * 1.25) ostatni.tekst = `${ostatni.tekst}\n${nowe}`;
        else wynik.push({ tekst: tekst.trim(), strona: strona ?? ostatni?.strona ?? 1 });
    }
    return wynik.filter((k) => k.tekst.length >= 40);
}

// ─────────────────────────── słowa i BM25 ───────────────────────────

const STOP = new Set(('a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those '
    + 'i you he she we they me my your our their his her them us do does did have has had not no so what which who whom how why when where '
    + 'there here then than just very can could would should will shall may might must about into over also all any some more most such only own same too '
    + 'oh ah well yes like going get got know really one '
    + 'i w z na do to że się nie jest jak co o a ale czy po od dla przez ten ta te tego tej tym są być był była było mi mnie ja ty on ona my wy oni '
    + 'jaki jaka jakie który która które czym kiedy gdzie dlaczego mówi mówił mówią shoud shoudach shoudy').split(/\s+/).filter(Boolean));

export function slowa(tekst) {
    return (String(tekst).toLowerCase().replace(/[’'`]/g, "'").match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) ?? [])
        .map((w) => w.replace(/'s$/, '').replace(/'/g, ''))
        .filter((w) => w.length >= 2 && !STOP.has(w));
}

/** Odwrócony indeks BM25 nad tekstami. */
export function indeksBm25(teksty) {
    const lista = new Map();   // słowo → [nr, tf, nr, tf, …]
    const dlugosci = new Float32Array(teksty.length);
    teksty.forEach((t, nr) => {
        const s = slowa(t);
        dlugosci[nr] = s.length;
        const tf = new Map();
        for (const w of s) tf.set(w, (tf.get(w) ?? 0) + 1);
        for (const [w, n] of tf) { let l = lista.get(w); if (!l) lista.set(w, (l = [])); l.push(nr, n); }
    });
    for (const [w, l] of lista) lista.set(w, Uint32Array.from(l));   // ~28 tys. kawałków: tablice typowane zamiast liczb JS (RAM mostu)
    const srednia = teksty.length ? dlugosci.reduce((a, b) => a + b, 0) / teksty.length : 1;
    return { lista, dlugosci, srednia, n: teksty.length };
}

export function szukajBm25(idx, zapytanie, { dozwolone = null, ile = 100, k1 = 1.2, b = 0.75 } = {}) {
    const wyniki = new Map();
    for (const w of new Set(slowa(zapytanie))) {
        const l = idx.lista.get(w);
        if (!l) continue;
        const df = l.length / 2;
        const idf = Math.log(1 + (idx.n - df + 0.5) / (df + 0.5));
        for (let i = 0; i < l.length; i += 2) {
            const nr = l[i];
            if (dozwolone && !dozwolone[nr]) continue;
            const tf = l[i + 1];
            const s = idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * idx.dlugosci[nr] / idx.srednia));
            wyniki.set(nr, (wyniki.get(nr) ?? 0) + s);
        }
    }
    return [...wyniki].sort((a, b) => b[1] - a[1]).slice(0, ile).map(([nr, wynik]) => ({ nr, wynik }));
}

// ─────────────────────────── wektory ───────────────────────────

export function normalizuj(v) {
    const w = Float32Array.from(v);
    let s = 0; for (const x of w) s += x * x;
    s = Math.sqrt(s) || 1;
    for (let i = 0; i < w.length; i++) w[i] /= s;
    return w;
}

/** Cosinus zapytania z każdym wierszem (wektory już znormalizowane). */
export function szukajWektorowo(wektory, wymiar, q, { dozwolone = null, ile = 100 } = {}) {
    const n = wektory.length / wymiar;
    const wyniki = [];
    for (let nr = 0; nr < n; nr++) {
        if (dozwolone && !dozwolone[nr]) continue;
        let s = 0; const o = nr * wymiar;
        for (let j = 0; j < wymiar; j++) s += wektory[o + j] * q[j];
        wyniki.push({ nr, wynik: s });
    }
    wyniki.sort((a, b) => b.wynik - a.wynik);
    return wyniki.slice(0, ile);
}

/** Reciprocal Rank Fusion: jedna albo kilka list wektorowych (pytanie + przekład) i lista słów. `cos` = najlepszy. */
export function polacz(wektorowe, slowne, k = RRF_K) {
    const m = new Map();
    const listy = Array.isArray(wektorowe[0]) ? wektorowe : [wektorowe];
    for (const lista of listy) lista.forEach((w, i) => {
        const e = m.get(w.nr) ?? { nr: w.nr, rrf: 0, cos: w.wynik, bm25: 0 };
        e.rrf += 1 / (k + i + 1); e.cos = Math.max(e.cos, w.wynik);
        m.set(w.nr, e);
    });
    slowne.forEach((w, i) => { const e = m.get(w.nr) ?? { nr: w.nr, rrf: 0, cos: null, bm25: 0 }; e.rrf += 1 / (k + i + 1); e.bm25 = w.wynik; m.set(w.nr, e); });
    return [...m.values()].sort((a, b) => b.rrf - a.rrf);
}

// ─────────────────────────── odpowiedź ───────────────────────────

export function jezykPytania(t) {
    const s = String(t).toLowerCase();
    if (/[ąćęłńóśźż]/.test(s)) return 'pl';
    if (/\b(czy|jak|co|dlaczego|kim|kiedy|gdzie|jest|się|mówi|czym|który|jaki)\b/.test(s)) return 'pl';
    return 'en';
}

export const PRZEKLAD_ZAPYTANIA = 'Translate the user\'s question into ONE short English search query for Crimson Circle Shoud transcripts (Tobias, Adamus, Kuthumi, Shaumbra). Keep proper names (Cauldre, Linda, Adamus, Tobias). Output only the English query, one line, no quotes, no comments.';

/** Pierwsza sensowna linia przekładu, bez cudzysłowów i etykiet; za długa / pusta = null. */
export function czystyPrzeklad(t) {
    const linia = String(t ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    const c = linia.replace(/^(english|query|search query|zapytanie)\s*:\s*/i, '').replace(/^["“'`]+|["”'`]+$/g, '').trim();
    return c.length >= 2 && c.length <= 300 ? c : null;
}

export function etykieta(f) {
    return [f.seria, f.data, f.lekcja].filter(Boolean).join(', ');
}

export function promptOdpowiedzi({ pytanie, fragmenty, jezyk = jezykPytania(pytanie) }) {
    const brak = BRAK[jezyk];
    const system = [
        'Jesteś bibliotekarzem PRYWATNEJ Biblioteki Shoudów (przekazy Crimson Circle) w Katedrze Suwerena.',
        'Odpowiadasz WYŁĄCZNIE na podstawie FRAGMENTÓW podanych w wiadomości. Nie używasz własnej wiedzy o Crimson Circle, Tobiasie, Adamusie ani niczym innym.',
        'ZASADY:',
        '1. Każde zdanie, które coś twierdzi, kończysz odnośnikiem do fragmentu w nawiasie kwadratowym, np. [3] albo [2][5]. Odnośnik = numer fragmentu, z którego to wiesz.',
        '2. Nie dopowiadasz niczego, czego we fragmentach nie ma. Gdy fragmenty mówią coś tylko częściowo — powiedz, czego w nich brakuje.',
        `3. Gdy żaden fragment nie odpowiada na pytanie, napisz dokładnie: "${brak}" i nic więcej.`,
        '4. Cytaty dosłowne tylko krótkie (najwyżej 15 słów) w cudzysłowie; resztę mów własnymi słowami.',
        '5. Kto mówi (Tobias, Adamus, Kuthumi…) podajesz tylko wtedy, gdy wynika to z fragmentu.',
        `6. Odpowiadasz ${jezyk === 'pl' ? 'PO POLSKU (fragmenty są po angielsku — tłumaczysz sens)' : 'IN ENGLISH'}. Zwięźle: 3–10 zdań.`,
    ].join('\n');
    const blok = fragmenty.map((f, i) => `[${i + 1}] ${etykieta(f)}${f.strona ? `, s. ${f.strona}` : ''}\n${f.tekst}`).join('\n\n');
    const prompt = `FRAGMENTY:\n\n${blok}\n\nPYTANIE: ${pytanie}\n\nODPOWIEDŹ (z odnośnikami [n]):`;
    return { system, prompt, jezyk };
}

/**
 * Sprawdza odpowiedź: zdania z odnośnikiem, odnośniki spoza listy (usuwane), „nie znalazłem”,
 * najdłuższy dosłowny ciąg słów z fragmentów (cytaty mają być krótkie).
 */
export function sprawdzOdpowiedz(tekst, fragmenty) {
    const n = fragmenty.length;
    const zle = new Set();
    const uzyte = new Set();
    let czysty = String(tekst).replace(/\[(\d+(?:\s*[,;]\s*\d+)*)\]/g, (cale, nums) => {
        const ok = nums.split(/[,;]/).map((x) => Number(x.trim())).filter((x) => { if (x >= 1 && x <= n) return true; zle.add(x); return false; });
        ok.forEach((x) => uzyte.add(x));
        return ok.map((x) => `[${x}]`).join('');
    }).replace(/([.!?…])[ \t]*((?:\[\d+\])+)/g, '$2$1')   // „zdanie. [3]” → „zdanie [3].”
        .replace(/[ \t]+\n/g, '\n').trim();
    const brak = /nie znalazłem|did not find this in the shouds|i did not find/i.test(czysty) && czysty.length < 200;
    const lista = zdania(czysty.replace(/\n+/g, ' ')).filter((z) => slowa(z.replace(/\[\d+\]/g, '')).length >= 2);
    const zZrodlem = lista.filter((z) => /\[\d+\]/.test(z)).length;
    // najdłuższy wspólny ciąg słów (≥ 8) z dowolnym fragmentem
    const slowaOdp = czysty.toLowerCase().replace(/\[\d+\]/g, ' ').match(/[\p{L}\p{N}']+/gu) ?? [];
    let najdluzszy = 0;
    if (slowaOdp.length >= 8) {
        const n8 = new Set();
        for (const f of fragmenty) { const s = f.tekst.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []; for (let i = 0; i + 8 <= s.length; i++) n8.add(s.slice(i, i + 8).join(' ')); }
        let biezacy = 0;
        for (let i = 0; i + 8 <= slowaOdp.length; i++) { if (n8.has(slowaOdp.slice(i, i + 8).join(' '))) { biezacy = biezacy ? biezacy + 1 : 8; najdluzszy = Math.max(najdluzszy, biezacy); } else biezacy = 0; }
    }
    return { tekst: czysty, zdan: lista.length, zZrodlem, bezZrodla: lista.length - zZrodlem, zleOdnosniki: [...zle], uzyte: [...uzyte].sort((a, b) => a - b), brak, najdluzszyCytat: najdluzszy };
}

// ─────────────────────────── kolekcja w Katedrze ───────────────────────────

const id12 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

async function zapiszAtom(plik, dane) {
    const tmp = `${plik}.${process.pid}.tmp`;
    await fs.writeFile(tmp, dane);
    await fs.rename(tmp, plik);
}

async function plikiPdf(korzen) {
    const wynik = [];
    async function idz(k) {
        let wpisy = [];
        try { wpisy = await fs.readdir(k, { withFileTypes: true }); } catch { return; }
        for (const w of wpisy) {
            const p = path.join(k, w.name);
            if (w.isDirectory()) await idz(p);
            else if (/\.pdf$/i.test(w.name)) wynik.push(p);
        }
    }
    await idz(korzen);
    return wynik.sort();
}

/**
 * @param {object} cfg
 * @param {string} cfg.katalog            `_OtakOs_Wymiar/baza-wiedzy`
 * @param {object[]} cfg.kolekcje          [{id, nazwa, zrodlo, meta(rel), prywatna, brak?}]
 * @param {(teksty:string[], model:string)=>Promise<number[][]>} cfg.osadz   embeddingi (Ollama /api/embed)
 * @param {(o:{model, system, prompt})=>Promise<{tekst, model}>} cfg.pisz     model odpowiedzi
 * @param {()=>Promise<string>} [cfg.modelOdpowiedzi]   domyślny model odpowiedzi
 * @param {()=>Promise<string|null>} [cfg.kartaZajeta]   powód, gdy karta zajęta renderem (ComfyUI) — indeks czeka, odpowiedź odmawia
 * @param {()=>Promise<any>} [cfg.zwolnijKarte]          prośba do ComfyUI o oddanie karty przed pracą
 */
export function utworzBazeWiedzy(cfg) {
    const kolekcje = new Map(cfg.kolekcje.map((k) => [k.id, k]));
    const modelEmb = cfg.modelEmbeddingow || MODEL_EMBEDDINGOW;
    const pamiec = new Map();   // id kolekcji → załadowany indeks
    const praca = new Map();    // id kolekcji → stan indeksowania
    const ustawieniaPlik = (k) => path.join(cfg.katalog, k, 'ustawienia.json');

    const kol = (id) => { const k = kolekcje.get(id); if (!k) throw Object.assign(new Error(`Nie znam kolekcji „${id}”.`), { kod: 404 }); return k; };
    const katalogPlikow = (id) => path.join(cfg.katalog, id, 'pliki');
    const aktualny = (w) => w.model === modelEmb && w.wersja === WERSJA_KAWALKOW;

    async function ustawienia(id) {
        try { return JSON.parse(await fs.readFile(ustawieniaPlik(id), 'utf8')); } catch { return {}; }
    }
    async function zapiszUstawienia(id, zmiana) {
        const u = { ...(await ustawienia(id)), ...zmiana };
        await fs.mkdir(path.dirname(ustawieniaPlik(id)), { recursive: true });
        await zapiszAtom(ustawieniaPlik(id), JSON.stringify(u, null, 2));
        return u;
    }

    async function wpisyIndeksu(id) {
        const dir = katalogPlikow(id);
        let nazwy = [];
        try { nazwy = (await fs.readdir(dir)).filter((n) => n.endsWith('.json')); } catch { return []; }
        const wynik = [];
        for (const n of nazwy) {
            try { wynik.push({ id: n.slice(0, -5), ...JSON.parse(await fs.readFile(path.join(dir, n), 'utf8')) }); } catch { /* uszkodzony — przeliczy się */ }
        }
        return wynik;
    }

    /**
     * Indeks kolekcji w pamięci (raz; po indeksowaniu — od nowa). Shoudy to ~0,5 GB RAM mostu, więc po
     * `bezczynnoscMs` (30 min) bez pytań indeks schodzi z pamięci; następne pytanie ładuje go ponownie (~8 s).
     */
    const zegary = new Map();
    function zaladuj(id) {
        clearTimeout(zegary.get(id));
        const z = setTimeout(() => pamiec.delete(id), cfg.bezczynnoscMs ?? 30 * 60_000);
        z.unref?.();
        zegary.set(id, z);
        if (!pamiec.has(id)) pamiec.set(id, wczytajIndeks(id).catch((e) => { pamiec.delete(id); throw e; }));
        return pamiec.get(id);
    }

    async function wczytajIndeks(id) {
        const wpisy = (await wpisyIndeksu(id)).filter((w) => aktualny(w) && fsSync.existsSync(path.join(katalogPlikow(id), `${w.id}.f32`)));
        wpisy.sort((a, b) => String(a.meta?.data ?? '').localeCompare(String(b.meta?.data ?? '')) || a.rel.localeCompare(b.rel));
        const kawalkiAll = [];
        const czesci = [];
        let wymiar = null;
        for (const w of wpisy) {
            const buf = await fs.readFile(path.join(katalogPlikow(id), `${w.id}.f32`));
            const v = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
            if (!w.wymiar || v.length !== w.wymiar * w.kawalki.length) continue;
            if (wymiar && w.wymiar !== wymiar) continue;
            wymiar = w.wymiar;
            czesci.push(v);
            w.kawalki.forEach((k, i) => kawalkiAll.push({ plik: w.rel, nr: i, tekst: k.t, strona: k.s, ...w.meta }));
        }
        const wektory = new Float32Array(kawalkiAll.length * (wymiar || 0));
        let o = 0; for (const c of czesci) { wektory.set(c, o); o += c.length; }
        return { wymiar, wektory, kawalki: kawalkiAll, bm25: indeksBm25(kawalkiAll.map((k) => `${k.lekcja ?? ''} ${k.tekst}`)), plikow: czesci.length };
    }

    async function stan(id) {
        const k = kol(id);
        const wpisy = await wpisyIndeksu(id);
        const zrodla = await plikiPdf(k.zrodlo);
        const zModelem = wpisy.filter(aktualny);
        let bajtow = 0;
        try { for (const n of await fs.readdir(katalogPlikow(id))) bajtow += (await fs.stat(path.join(katalogPlikow(id), n))).size; } catch { /* brak */ }
        const serie = new Map();
        for (const w of zModelem) { const s = w.meta?.seria ?? '—'; const e = serie.get(s) ?? { seria: s, lata: w.meta?.lata ?? null, nr: w.meta?.nrSerii ?? 99, plikow: 0, kawalkow: 0 }; e.plikow++; e.kawalkow += w.kawalki.length; serie.set(s, e); }
        const u = await ustawienia(id);
        return {
            id, nazwa: k.nazwa, prywatna: !!k.prywatna, zrodlo: k.zrodlo, zrodelPdf: zrodla.length,
            zaindeksowanych: zModelem.length, kawalkow: zModelem.reduce((a, w) => a + w.kawalki.length, 0), bajtowIndeksu: bajtow,
            pustych: zModelem.filter((w) => !w.kawalki.length).map((w) => w.rel),
            modelEmbeddingow: modelEmb, modelOdpowiedzi: u.model || null,
            serie: [...serie.values()].sort((a, b) => a.nr - b.nr),
            praca: praca.get(id) ?? { etap: 'bezczynny' },
        };
    }

    /** Indeksuje jeden plik źródła: tekst → kawałki → wektory → para .json/.f32. */
    async function indeksujPlik(id, k, sciezka, hash, bufor) {
        const rel = path.relative(k.zrodlo, sciezka).split(path.sep).join('/');
        const strony = oczyscStrony(await (k.strony ?? stronyZPdf)(bufor));   // kolekcja może mieć własny czytnik (test, inne formaty)
        const lista = kawalki(akapity(strony));
        const meta = k.meta(rel);
        const wektory = [];
        for (let i = 0; i < lista.length; i += PACZKA_EMBED) {
            const paczka = lista.slice(i, i + PACZKA_EMBED).map((x) => `title: ${[meta.seria, meta.lekcja].filter(Boolean).join(' ') || 'none'} | text: ${x.tekst}`);
            const e = await cfg.osadz(paczka, modelEmb);
            if (!Array.isArray(e) || e.length !== paczka.length) throw new Error(`Embeddingi: oczekiwałem ${paczka.length}, przyszło ${e?.length ?? 0}.`);
            for (const v of e) wektory.push(normalizuj(v));
        }
        const wymiar = wektory[0]?.length ?? 0;
        const f32 = new Float32Array(wektory.length * wymiar);
        wektory.forEach((v, i) => f32.set(v, i * wymiar));
        const pid = id12(rel);
        await fs.mkdir(katalogPlikow(id), { recursive: true });
        await zapiszAtom(path.join(katalogPlikow(id), `${pid}.f32`), Buffer.from(f32.buffer));
        await zapiszAtom(path.join(katalogPlikow(id), `${pid}.json`), JSON.stringify({ rel, hash, bajtow: bufor.length, meta, stron: strony.length, model: modelEmb, wersja: WERSJA_KAWALKOW, wymiar, kawalki: lista.map((x) => ({ t: x.tekst, s: x.strona })), kiedy: new Date().toISOString() }));
        return lista.length;
    }

    /** Indeksowanie w tle (przyrostowo, wznawialne). Drugi start w trakcie = ten sam stan. */
    function indeksuj(id, { odNowa = false } = {}) {
        const k = kol(id);
        const biezaca = praca.get(id);
        if (biezaca && ['indeksuje', 'czeka'].includes(biezaca.etap)) return biezaca;
        const st = { etap: 'indeksuje', start: Date.now(), plikow: 0, zrobione: 0, pominiete: 0, nowych: 0, kawalkow: 0, biezacy: null, bledy: [], przerwij: false, koniec: null, sekundy: null, powod: null };
        praca.set(id, st);
        (async () => {
            try {
                await cfg.zwolnijKarte?.().catch(() => null);
                const zrodla = await plikiPdf(k.zrodlo);
                if (!zrodla.length) throw new Error(`Brak PDF-ów w ${k.zrodlo}.`);
                st.plikow = zrodla.length;
                const istniejace = new Map((await wpisyIndeksu(id)).map((w) => [w.rel, w]));
                const widziane = new Set();
                for (const sciezka of zrodla) {
                    if (st.przerwij) break;
                    const rel = path.relative(k.zrodlo, sciezka).split(path.sep).join('/');
                    widziane.add(rel);
                    st.biezacy = rel;
                    const bufor = await fs.readFile(sciezka);
                    const hash = crypto.createHash('sha1').update(bufor).digest('hex');
                    const byl = istniejace.get(rel);
                    if (!odNowa && byl && byl.hash === hash && aktualny(byl)) { st.pominiete++; st.zrobione++; continue; }
                    // karta: nie liczymy embeddingów naraz z renderem ComfyUI
                    for (;;) {
                        const zajeta = await cfg.kartaZajeta?.().catch(() => null);
                        if (!zajeta || st.przerwij) break;
                        st.etap = 'czeka'; st.powod = zajeta;
                        await new Promise((ok) => setTimeout(ok, cfg.czekanieMs ?? 30_000));
                    }
                    st.etap = 'indeksuje'; st.powod = null;
                    try {
                        st.kawalkow += await indeksujPlik(id, k, sciezka, hash, bufor);
                        st.nowych++;
                    } catch (e) {
                        st.bledy.push({ plik: rel, blad: e.message });
                        if (/ECONNREFUSED|fetch failed|Ollama/i.test(e.message) && st.bledy.length >= 3) throw new Error(`Embeddingi nie działają: ${e.message}`);
                    }
                    st.zrobione++;
                    const minelo = (Date.now() - st.start) / 1000;
                    const liczone = st.zrobione - st.pominiete;
                    st.eta = liczone ? Math.round((minelo / liczone) * (st.plikow - st.zrobione)) : null;
                }
                if (!st.przerwij) {
                    // usunięte źródła znikają z indeksu
                    for (const [rel] of istniejace) if (!widziane.has(rel)) {
                        const pid = id12(rel);
                        await fs.rm(path.join(katalogPlikow(id), `${pid}.json`), { force: true });
                        await fs.rm(path.join(katalogPlikow(id), `${pid}.f32`), { force: true });
                    }
                }
                st.etap = st.przerwij ? 'przerwane' : 'gotowe';
            } catch (e) {
                st.etap = 'blad'; st.powod = e.message;
            } finally {
                st.biezacy = null; st.koniec = Date.now(); st.sekundy = Math.round((st.koniec - st.start) / 1000);
                pamiec.delete(id);
                cfg.szyna?.nadaj?.({ agent: 'Biblioteka', rodzaj: 'praca', tresc: `📚 ${k.nazwa}: ${st.etap} — ${st.nowych} nowych plików, ${st.kawalkow} kawałków, ${st.sekundy} s` })?.catch?.(() => {});
            }
        })();
        return st;
    }

    function zatrzymaj(id) {
        const st = praca.get(id);
        if (st && ['indeksuje', 'czeka'].includes(st.etap)) st.przerwij = true;
        return st ?? { etap: 'bezczynny' };
    }

    /** Hybryda: wektory + BM25 (RRF), filtry, najwyżej `naPlik` kawałków z jednego PDF. */
    async function szukaj(id, zapytanie, { k = 8, serie = null, rokOd = null, rokDo = null, qa = 'wszystko', naPlik = 2, zapytanieEn = null } = {}) {
        kol(id);
        const q = String(zapytanie ?? '').trim();
        if (q.length < 2) throw Object.assign(new Error('Puste pytanie.'), { kod: 400 });
        const idx = await zaladuj(id);
        if (!idx.kawalki.length) return { wyniki: [], przeszukano: 0 };
        const zbiorSerii = Array.isArray(serie) && serie.length ? new Set(serie) : null;
        let dozwolone = null;
        if (zbiorSerii || rokOd || rokDo || qa !== 'wszystko') {
            dozwolone = new Uint8Array(idx.kawalki.length);
            idx.kawalki.forEach((c, i) => {
                if (zbiorSerii && !zbiorSerii.has(c.seria)) return;
                if (rokOd && (c.rok ?? 0) < Number(rokOd)) return;
                if (rokDo && (c.rok ?? 9999) > Number(rokDo)) return;
                if (qa === 'bez' && c.qa) return;
                if (qa === 'tylko' && !c.qa) return;
                dozwolone[i] = 1;
            });
        }
        // Pytanie po polsku + jego angielski przekład (materiały są po angielsku): wektory dla obu, słowa z obu.
        const en = String(zapytanieEn ?? '').trim();
        const zapytania = en && en.toLowerCase() !== q.toLowerCase() ? [q, en] : [q];
        const emb = await cfg.osadz(zapytania.map((z) => `task: search result | query: ${z}`), modelEmb);
        const wekt = emb.map((v) => szukajWektorowo(idx.wektory, idx.wymiar, normalizuj(v), { dozwolone, ile: 120 }));
        const slow = szukajBm25(idx.bm25, zapytania.join(' '), { dozwolone, ile: 120 });
        const naPlikIle = new Map();
        const wyniki = [];
        for (const w of polacz(wekt, slow)) {
            const c = idx.kawalki[w.nr];
            const ile = naPlikIle.get(c.plik) ?? 0;
            if (ile >= naPlik) continue;
            naPlikIle.set(c.plik, ile + 1);
            wyniki.push({ ...c, rrf: Number(w.rrf.toFixed(5)), cos: w.cos === null ? null : Number(w.cos.toFixed(4)), bm25: Number(w.bm25.toFixed(3)) });
            if (wyniki.length >= Math.min(Math.max(1, Number(k) || 8), 20)) break;
        }
        return { wyniki, przeszukano: dozwolone ? dozwolone.reduce((a, b) => a + b, 0) : idx.kawalki.length };
    }

    async function odpowiedz(id, { pytanie, model, k = 8, ...filtry } = {}) {
        const kolekcja = kol(id);
        const zajeta = await cfg.kartaZajeta?.().catch(() => null);
        if (zajeta) throw Object.assign(new Error(`Karta zajęta: ${zajeta} — model odpowiedzi nie ruszy naraz z renderem. Spróbuj po renderze.`), { kod: 409 });
        const t0 = Date.now();
        const jezyk = jezykPytania(pytanie);
        const silnik = model || (await ustawienia(id)).model || (await cfg.modelOdpowiedzi?.()) || null;
        // Polskie pytanie: ten sam model daje angielskie zapytanie (BM25 nie zna „smoka”, zna „dragon”). Padł = szukamy samym polskim.
        let zapytanieEn = null;
        if (jezyk === 'pl') {
            const p = await cfg.pisz({ model: silnik, system: PRZEKLAD_ZAPYTANIA, prompt: String(pytanie) }).catch(() => null);
            zapytanieEn = czystyPrzeklad(p?.tekst);
        }
        const { wyniki, przeszukano } = await szukaj(id, pytanie, { k, ...filtry, zapytanieEn });
        const brak = (kolekcja.brak ?? BRAK)[jezyk];
        if (!wyniki.length) return { pytanie, jezyk, zapytanieEn, odpowiedz: brak, fragmenty: [], sprawdzenie: { zdan: 0, zZrodlem: 0, bezZrodla: 0, zleOdnosniki: [], uzyte: [], brak: true, najdluzszyCytat: 0 }, model: null, przeszukano, sekundy: 0 };
        const { system, prompt } = promptOdpowiedzi({ pytanie, fragmenty: wyniki, jezyk });
        const w = await cfg.pisz({ model: silnik, system, prompt });
        const spr = sprawdzOdpowiedz(w.tekst, wyniki);
        return {
            pytanie, jezyk, zapytanieEn, odpowiedz: spr.tekst, sprawdzenie: { ...spr, tekst: undefined },
            fragmenty: wyniki.map((f, i) => ({ n: i + 1, etykieta: etykieta(f), plik: f.plik, strona: f.strona, seria: f.seria, data: f.data, lekcja: f.lekcja, qa: f.qa, tekst: f.tekst, cos: f.cos, bm25: f.bm25 })),
            model: w.model || silnik, przeszukano, sekundy: Math.round((Date.now() - t0) / 100) / 10,
        };
    }

    return { stan, indeksuj, zatrzymaj, szukaj, odpowiedz, ustawienia, zapiszUstawienia, kolekcje: () => [...kolekcje.values()].map((k) => ({ id: k.id, nazwa: k.nazwa, prywatna: !!k.prywatna })), zrodlo: (id) => kol(id).zrodlo, modelEmbeddingow: modelEmb };
}

/** Kolekcja Shoudów Crimson Circle (prywatna, © Crimson Circle IP). */
export function kolekcjaShoudow(zrodlo) {
    return { id: 'shoudy', nazwa: 'Biblioteka Shoudów', zrodlo, meta: metaShoudu, prywatna: true, brak: BRAK };
}

/**
 * Trasy (wszystkie tylko z maszyny: Straż ma `/api/baza-wiedzy` w SCIEZKI_TYLKO_LOKALNE, a trasa
 * sama odmawia, gdy Straż oznaczyła żądanie jako nielokalne — także przy pełnym tunelu).
 */
export function zamontujTrasyBazyWiedzy(app, baza, { modele = async () => [] } = {}) {
    const tylkoMaszyna = (req, res, next) => {
        if (req.lokalny === false) return res.status(403).json({ success: false, blad: 'TYLKO_LOKALNIE', message: 'Baza wiedzy jest prywatna — tylko z maszyny Suwerena.' });
        next();
    };
    const blad = (res, e) => res.status(e.kod ?? 500).json({ success: false, message: e.message });
    app.get('/api/baza-wiedzy', tylkoMaszyna, (req, res) => res.json({ success: true, kolekcje: baza.kolekcje() }));
    app.get('/api/baza-wiedzy/:kol', tylkoMaszyna, async (req, res) => {
        try { res.json({ success: true, ...(await baza.stan(req.params.kol)), modele: await modele().catch(() => []) }); } catch (e) { blad(res, e); }
    });
    app.post('/api/baza-wiedzy/:kol/indeksuj', tylkoMaszyna, (req, res) => {
        try { const st = baza.indeksuj(req.params.kol, { odNowa: req.body?.odNowa === true }); res.json({ success: true, praca: st }); } catch (e) { blad(res, e); }
    });
    app.post('/api/baza-wiedzy/:kol/zatrzymaj', tylkoMaszyna, (req, res) => {
        try { res.json({ success: true, praca: baza.zatrzymaj(req.params.kol) }); } catch (e) { blad(res, e); }
    });
    app.put('/api/baza-wiedzy/:kol/ustawienia', tylkoMaszyna, async (req, res) => {
        try {
            const model = req.body?.model === null ? null : String(req.body?.model ?? '').trim() || null;
            res.json({ success: true, ustawienia: await baza.zapiszUstawienia(req.params.kol, { model }) });
        } catch (e) { blad(res, e); }
    });
    app.post('/api/baza-wiedzy/:kol/szukaj', tylkoMaszyna, async (req, res) => {
        try { const { pytanie, ...f } = req.body ?? {}; res.json({ success: true, ...(await baza.szukaj(req.params.kol, pytanie, f)) }); } catch (e) { blad(res, e); }
    });
    app.post('/api/baza-wiedzy/:kol/pytanie', tylkoMaszyna, async (req, res) => {
        try {
            const { pytanie, model, k, serie, rokOd, rokDo, qa } = req.body ?? {};
            if (!String(pytanie ?? '').trim()) return res.status(400).json({ success: false, message: 'Puste pytanie.' });
            res.json({ success: true, ...(await baza.odpowiedz(req.params.kol, { pytanie: String(pytanie).slice(0, 1000), model, k, serie, rokOd, rokDo, qa })) });
        } catch (e) { blad(res, e); }
    });
}
