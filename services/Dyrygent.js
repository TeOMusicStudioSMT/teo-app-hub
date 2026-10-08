/**
 * 🎼 Dyrygent — dobiera MODELE do zadań, tak jak Jadziunia dobiera skille.
 *
 * Suweren (2026-09-28): „przydałby się agent dyrygent i api modeli dostępnych w Katedrze… do zadania…
 * jak mamy już w Jadziuni mechanizm doboru skilli, tylko że do modeli".
 *
 *   katalog()  — co NAPRAWDĘ jest w Katedrze: modele Ollamy (/api/tags: rozmiar, rodzina, parametry,
 *                kwantyzacja) + karta modelu od Suwerena (opis, mocne strony) + wykute w Kuźni (własny
 *                model TeOgochi) + statystyka z pracy stada: w ilu wkładach pisał i jaka była średnia ocena
 *                Sędziego projektów, w których pisał. Nic tu nie jest wymyślone — pusta karta zostaje pusta.
 *   dobierz()  — model Dyrygenta czyta katalog i zadanie (albo skład zespołu projektu) i proponuje
 *                model dla każdego TeOgochi z krótkim powodem. Wynik jest SPRAWDZANY: tylko modele z
 *                katalogu, tylko agenci z listy; resztę odrzucamy z powodem, zamiast zgadywać.
 *   zastosuj() — propozycja → stałe silniki agentów (ModeleAgentow). Tylko przy maszynie, decyzja Suwerena.
 * Projekt Stada może też wziąć przydział TYLKO dla siebie (`dyrygent: true`) — bez zmiany stałych silników.
 */
import fs from 'fs/promises';
import path from 'path';
import { rozmiarModelu } from './BledyModeli.js';
import { zgniecionyKwant } from './ZwiadowcaHF.js';

let cfg = {
    katalogWymiar: path.join(process.cwd(), '_OtakOs_Wymiar'),
    /** → { models: [{ name, size, details: { family, parameter_size, quantization_level } }] } */
    tagi: async () => ({ models: [] }),
    /** → projekty stada (pełne: kroki z modelem, oceny) */
    projekty: async () => [],
    /** → { <agent>: <model> } */
    modeleAgentow: async () => ({}),
    ustawModel: async () => { throw new Error('Most nie podpiął silników agentów.'); },
    /** → [{ agent, model }] modele wykute w Kuźni */
    wykute: async () => [],
    /** ({ system, prompt, model }) → tekst */
    pisz: async () => { throw new Error('Most nie podpiął modelu Dyrygenta.'); },
    model: () => 'gemma4',
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

const PLIK_KART = () => path.join(cfg.katalogWymiar, 'karty-modeli.json');
async function karty() { try { return JSON.parse(await fs.readFile(PLIK_KART(), 'utf8')); } catch { return {}; } }

const MODEL = /^[A-Za-z0-9._:\/-]{2,120}$/;

/** Karta modelu od Suwerena: opis i mocne strony (do czego go używać). Pusty opis = usuń kartę. */
export async function ustawKarte(nazwa, { opis = '', mocne = [] } = {}) {
    if (!MODEL.test(String(nazwa))) throw new Error('Zła nazwa modelu.');
    const k = await karty();
    const o = String(opis).trim().slice(0, 400);
    const m = (Array.isArray(mocne) ? mocne : String(mocne).split(',')).map((x) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 8);
    if (!o && !m.length) delete k[nazwa]; else k[nazwa] = { opis: o, mocne: m };
    await fs.mkdir(cfg.katalogWymiar, { recursive: true });
    const tmp = `${PLIK_KART()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(k, null, 2), 'utf8');
    await fs.rename(tmp, PLIK_KART());
    return k[nazwa] ?? null;
}

/**
 * Statystyka z pracy stada: model → { wkladow, ocen, srednia, ocenJev, sredniaJev } (ocena = ostatnia ocena Sędziego projektu).
 * `…Jev` = tylko oceny Sędziego-Jev (`kto: 'Jev + …'`, od 2026-10-08). Starsze oceny lokalnego Sędziego były hojne
 * (Spark-4B 9,8/10) — liczone osobno, żeby Dyrygent nie szedł za zawyżoną liczbą (krok 1: równe szanse).
 */
export function statystyki(projekty) {
    const st = {};
    for (const p of projekty ?? []) {
        const oceny = (p.oceny ?? []).filter((o) => o.ocena != null);
        const ocena = oceny.at(-1)?.ocena ?? null;
        const ocenaJev = oceny.filter((o) => /^Jev\b/.test(String(o.kto ?? ''))).at(-1)?.ocena ?? null;
        for (const k of p.kroki ?? []) {
            if (!k.model || k.stan !== 'gotowe') continue;
            const s = (st[k.model] ||= { wkladow: 0, ocen: 0, suma: 0, ocenJev: 0, sumaJev: 0 });
            s.wkladow++;
            if (ocena != null) { s.ocen++; s.suma += ocena; }
            if (ocenaJev != null) { s.ocenJev++; s.sumaJev += ocenaJev; }
        }
    }
    const sr = (suma, n) => (n ? Math.round((suma / n) * 10) / 10 : null);
    return Object.fromEntries(Object.entries(st).map(([m, s]) => [m, { wkladow: s.wkladow, ocen: s.ocen, srednia: sr(s.suma, s.ocen), ocenJev: s.ocenJev, sredniaJev: sr(s.sumaJev, s.ocenJev) }]));
}

// ─────────────────────────────────────────────────────────────────────────────
// KROK 1 — RÓWNE SZANSE (Suweren 2026-10-08: „Dyrygent uparł się na Sparka… JEV szybki, lecz nie mądry… jak metale
// w polu magnetycznym”). Zmierzone: Spark był JEDYNYM z 29 modeli z kartą i ocenami (9,8/10 od dawnego Sędziego),
// reszta — pusto; Jev szedł za jedynym sygnałem. Teraz każdy model bez karty Suwerena dostaje kartę Z FAKTÓW
// (rozmiar, rodzina, kwantyzacja, cechy z nazwy) — nic dopowiedzianego.
// ─────────────────────────────────────────────────────────────────────────────
const CECHY_Z_NAZWY = [
    [/coder|[-_]code[-_:]|codestral|starcoder|devstral/i, 'model do kodu'],
    [/heretic|uncensored|abliterat/i, 'odblokowany (bez cenzury)'],
    [/[-_]vl[-_:]|vision|llava|moondream/i, 'widzi obrazy'],
    [/[-_]it[-_:]|instruct/i, 'dostrojony do poleceń'],
    [/nvfp4/i, 'format NVFP4 (karty Blackwell)'],
    [/\bA\d+(\.\d+)?B\b/, 'MoE — aktywna tylko część parametrów'],
    [/:cloud$|-cloud$/, 'chmura Ollamy (poza kartą graficzną)'],
];
export function cechyZNazwy(nazwa) { return CECHY_Z_NAZWY.filter(([re]) => re.test(String(nazwa))).map(([, c]) => c); }

/** Klasa modelu z rozmiaru (mniejsza z Ollamy i z nazwy). */
function klasaModelu(m) {
    const b = miliardy(m);
    if (!b) return 'rozmiar nieznany';
    return b >= 9 ? `DUŻY ${b}B` : b > 4.5 ? `ŚREDNI ${b}B` : `MAŁY ${b}B`;
}

/** Karta z faktów dla modelu bez karty Suwerena: klasa, rodzina, kwantyzacja, rozmiar pliku, cechy z nazwy. */
export function kartaZFaktow(m) {
    const cechy = cechyZNazwy(m.nazwa);
    return [klasaModelu(m), m.rodzina ? `rodzina ${m.rodzina}` : null, m.kwantyzacja ? `kwantyzacja ${m.kwantyzacja}` : null, m.rozmiarGB ? `${m.rozmiarGB} GB` : null, ...cechy].filter(Boolean).join(', ');
}

/** Praca w stadzie po ludzku — oceny Sędziego-Jev jako liczba, stare oceny lokalnego Sędziego bez liczby. */
export function opisPracy(praca) {
    if (!praca?.wkladow) return 'jeszcze nie pracował w stadzie';
    if (praca.ocenJev) return `w stadzie: ${praca.wkladow} wkładów, średnia ocena Sędziego-Jev ${praca.sredniaJev}/10 (${praca.ocenJev} ocen)`;
    if (praca.ocen) return `w stadzie: ${praca.wkladow} wkładów, oceny tylko od dawnego lokalnego Sędziego (zawyżone — nie porównuj z innymi)`;
    return `w stadzie: ${praca.wkladow} wkładów, bez ocen`;
}

/** Linia katalogu dla Dyrygenta (modelu i Jev): karta Suwerena albo karta z faktów + własny model + praca. */
export function liniaKatalogu(m) {
    const karta = m.karta?.opis
        ? `karta: ${m.karta.opis}${m.karta.mocne?.length ? ` [mocne: ${m.karta.mocne.join(', ')}]` : ''} (${kartaZFaktow(m)})`
        : `fakty: ${kartaZFaktow(m)}`;
    return `- ${m.nazwa}${m.wlasny ? ` — WŁASNY model TeOgochi „${m.wlasny}" (wykuty z jego pracy)` : ''} — ${karta} — ${opisPracy(m.praca)}`;
}

/** Katalog modeli Katedry — to, co jest, z tym, co o nim wiadomo. */
export async function katalog() {
    const [t, k, projekty, przydzial, wykute] = await Promise.all([
        cfg.tagi().catch(() => ({ models: [] })), karty(), cfg.projekty().catch(() => []),
        cfg.modeleAgentow().catch(() => ({})), cfg.wykute().catch(() => []),
    ]);
    const st = statystyki(projekty);
    return (t.models ?? []).map((m) => {
        const nazwa = m.name ?? m.model;
        return {
            nazwa,
            rozmiarGB: m.size ? Math.round((m.size / 1e9) * 10) / 10 : null,
            rodzina: m.details?.family ?? null,
            parametry: m.details?.parameter_size ?? null,
            kwantyzacja: m.details?.quantization_level ?? null,
            karta: k[nazwa] ?? null,
            wlasny: wykute.find((w) => w.model === nazwa || `${w.model}:latest` === nazwa)?.agent ?? null,
            agenci: Object.entries(przydzial).filter(([, mm]) => mm === nazwa || `${mm}:latest` === nazwa).map(([a]) => a),
            praca: st[nazwa] ?? st[nazwa.replace(/:latest$/, '')] ?? { wkladow: 0, ocen: 0, srednia: null, ocenJev: 0, sredniaJev: null },
        };
    }).sort((a, b) => (b.praca.sredniaJev ?? -1) - (a.praca.sredniaJev ?? -1) || (a.rozmiarGB ?? 0) - (b.rozmiarGB ?? 0));
}

/** Pierwszy obiekt JSON z odpowiedzi modelu (małe modele lubią dopisać zdanie przed i po). */
export function wylowJson(tekst) {
    const t = String(tekst ?? '');
    const start = t.indexOf('{');
    if (start < 0) return null;
    for (let koniec = t.lastIndexOf('}'); koniec > start; koniec = t.lastIndexOf('}', koniec - 1)) {
        try { return JSON.parse(t.slice(start, koniec + 1)); } catch { /* krócej */ }
    }
    return null;
}

/**
 * Sprawdź propozycję modelu: tylko agenci z listy i modele z katalogu (nazwa z `:latest` albo bez).
 * Zwraca { przydzial, odrzucone } — odrzucone z powodem, żeby Suweren widział, co model zmyślił.
 */
export function sprawdzPrzydzial(propozycja, { agenci, modele }) {
    const znane = new Map(modele.flatMap((m) => [[m, m], [m.replace(/:latest$/, ''), m]]));
    const ids = new Set(agenci.map((a) => a.id));
    const przydzial = [], odrzucone = [];
    for (const w of Array.isArray(propozycja?.przydzial) ? propozycja.przydzial : []) {
        const agent = String(w?.agent ?? '').toLowerCase().trim();
        const model = znane.get(String(w?.model ?? '').trim());
        if (!ids.has(agent)) { odrzucone.push({ ...w, powod: 'nie ma takiego TeOgochi w zadaniu' }); continue; }
        if (!model) { odrzucone.push({ ...w, powod: 'nie ma takiego modelu w Katedrze' }); continue; }
        if (przydzial.some((p) => p.agent === agent)) continue;
        przydzial.push({ agent, model, powod: String(w?.powod ?? '').slice(0, 200) });
    }
    return { przydzial, odrzucone };
}

/**
 * Dobierz modele do zadania. `agenci`: [{ id, imie, dziedzina, zadanie? }] — np. kroki planu projektu.
 * Zwraca { przydzial, odrzucone, model, katalog } — nic nie zapisuje.
 */
export async function dobierz({ zadanie, agenci = [], szybko = false }) {
    const opis = String(zadanie ?? '').trim();
    if (opis.length < 5) throw new Error('Opisz zadanie dla Dyrygenta.');
    if (!agenci.length) throw new Error('Dyrygent potrzebuje składu — którzy TeOgochi grają.');
    const kat = await katalog();
    if (!kat.length) throw new Error('Katedra nie ma żadnego modelu w Ollamie — nie ma z czego dobierać.');
    const linia = liniaKatalogu;
    const sklad = agenci.map((a) => `- ${a.id} — ${a.imie}${a.dziedzina ? ` (${a.dziedzina})` : ''}${a.zadanie ? `: ${String(a.zadanie).split(':')[0]}` : ''}${wymaganiaRoli(a) ? ` [WYMAGANIE ROLI: ${opisWymagan(wymaganiaRoli(a))}]` : ''}`).join('\n');
    const system = `Jesteś DYRYGENTEM Katedry OtakOS. Przydzielasz TeOgochi modele językowe do zadania — każdy gra na instrumencie, który mu służy.
Zasady: bierzesz WYŁĄCZNIE modele z KATALOGU (dokładna nazwa). Większy model do rozumowania, scalania i kodu; mniejszy i szybszy do krótkich, prostych wkładów. Jeśli TeOgochi ma WŁASNY model — zwykle to on. WYMAGANIE ROLI jest twarde. Karta graficzna jest jedna (ok. 6 GB) — najwyżej ${MAX_MODELI} różne modele dla całego stada, bo każda podmiana to ładowanie od nowa.
Odpowiadasz WYŁĄCZNIE JSON-em: {"przydzial":[{"agent":"<id>","model":"<nazwa z katalogu>","powod":"<jedno zdanie>"}]} — po jednym wpisie na każdego TeOgochi z listy.`;
    const prompt = `KATALOG MODELI KATEDRY:\n${kat.map(linia).join('\n')}\n\nZADANIE SUWERENA:\n${opis.slice(0, 2000)}\n\nSKŁAD (id — kto — co robi):\n${sklad}`;
    const wynik = (przydzial, reszta) => ({ ...reszta, przydzial: regulyRol(przydzial, agenci, kat), katalog: kat.map((m) => m.nazwa) });

    // ⚖️ KROK 3: Jev zawęża (3 kandydatów na TeOgochi, w ramach wymagań roli) → większy model lokalny rozstrzyga
    // z uzasadnieniem i limitem modeli. `szybko` = sam Jev. Jev padnie / bez klucza → cały wybór robi model.
    let jevBlad = null;
    if (cfg.jev?.stan?.().maKlucz) {
        try {
            const j = await dobierzJev(cfg.jev, { opis, agenci, kat, linia });
            if (j.przydzial.length) {
                if (szybko) return wynik(ograniczDoModeli(j.przydzial, j.krotkie, kat), { ...j, silnik: 'jev' });
                try {
                    const r = await rozstrzygnij({ opis, agenci, kat, krotkie: j.krotkie, jevPrzydzial: j.przydzial });
                    return wynik(ograniczDoModeli(r.przydzial, j.krotkie, kat), { odrzucone: [...j.odrzucone, ...r.odrzucone], krotkie: j.krotkie, model: `${j.model} → ${r.model}`, silnik: 'jev+model' });
                } catch (e) {
                    return wynik(ograniczDoModeli(j.przydzial, j.krotkie, kat), { ...j, silnik: 'jev', rozstrzygniecieBlad: String(e.message || e).slice(0, 200) });
                }
            }
        } catch (e) { jevBlad = String(e.message || e).slice(0, 200); }
    }
    const model = await cfg.model();
    const odp = await cfg.pisz({ system, prompt, model });
    const j = wylowJson(odp);
    if (!j) throw new Error('Dyrygent nie oddał JSON-a z przydziałem — spróbuj ponownie albo daj mu większy model (panel Dyrygenta → „Dyrygent gra na”).');
    const spr = sprawdzPrzydzial(j, { agenci, modele: kat.map((m) => m.nazwa) });
    return wynik(spr.przydzial, { ...spr, model, silnik: 'model', ...(jevBlad ? { jevBlad } : {}) });
}

/** Modele, które nie piszą tekstu (embeddingi) — nie są instrumentami dla TeOgochi. */
const NIE_DO_PISANIA = /embed|bge-|minilm|rerank/i;

/**
 * 📏 REGUŁA SCALAJĄCYCH (Suweren 2026-10-08: „daj regułę scalającym, bez modeli ≤4B”): Reżyser i Kronikarz
 * sklejają Biblię projektu z wkładów całego stada — model ≤ 4B gubi wątki i format. Agent może też przyjść
 * z `scala: true`. Gdy w katalogu nie ma nic większego niż 4B, reguła odpuszcza (i mówi to w powodzie).
 */
/** Role scalające (wymagania w WYMAGANIA_ROL niżej — tu zostaje lista dla innych modułów). */
export const SCALAJACY = new Set(['rezyser', 'kronikarz']);
// Mniejsza z dwóch: z Ollamy (Spark „4B” = 4,11 mld) i z nazwy (gemma4:e2b = 5,1 mld, ale EFEKTYWNIE 2B).
const miliardy = (m) => { const z = [Number(String(m?.parametry ?? '').replace(/[^0-9.]/g, '')), rozmiarModelu(m?.nazwa)].filter((x) => x > 0); return z.length ? Math.min(...z) : null; };

// ─────────────────────────────────────────────────────────────────────────────
// KROK 2 — REGUŁY RÓL (Suweren 2026-10-08: „robimy wszystkie trzy kroki”). Rozszerza regułę scalających:
//   scalający (Reżyser, Kronikarz, `scala: true`) — > 4,5 mld (Biblia z pracy całego stada),
//   Kodeks — model do kodu (> 4,5 mld) albo ≥ 7 mld (pisze grę; 4B nie oddawał bloków PLIK),
//   Wektor, Strażnik — ≥ 8 mld (oceniają i decydują).
// Własny model TeOgochi (wykuty z jego pracy) zawsze przechodzi. Nieznany rozmiar przechodzi (nie zgadujemy).
// Jev widzi tylko modele spełniające wymaganie, a reguła sprawdza jeszcze raz każdy wynik.
// ─────────────────────────────────────────────────────────────────────────────
export const WYMAGANIA_ROL = {
    rezyser: { minB: 4.5, opis: 'skleja pracę stada w Biblię' },
    kronikarz: { minB: 4.5, opis: 'skleja pracę stada w kronikę' },
    kodeks: { minB: 7, kod: true, opis: 'pisze kod gry' },
    wektor: { minB: 8, opis: 'ocenia i decyduje' },
    straznik: { minB: 8, opis: 'pilnuje i ocenia' },
};
export function wymaganiaRoli(a) {
    const id = String(a?.id ?? a?.agent ?? '').toLowerCase();
    return WYMAGANIA_ROL[id] ?? (a?.scala === true ? { minB: 4.5, opis: 'skleja pracę stada' } : null);
}
const opisWymagan = (w) => `${w.kod ? 'model do kodu albo ' : ''}co najmniej ${w.minB > 4.5 ? w.minB : 'ponad 4,5'} mld parametrów (${w.opis})`;
/** Czy model spełnia wymaganie roli (własny model agenta — zawsze). */
export function spelnia(m, w, agentId = null) {
    if (!w || !m) return true;
    if (agentId && m.wlasny === agentId) return true;
    if (NIE_DO_PISANIA.test(m.nazwa) || zgniety(m)) return false;
    const b = miliardy(m);
    if (b === null) return true;
    if (w.kod && /coder|[-_]code[-_:]|codestral|starcoder|devstral/i.test(m.nazwa) && b > 4.5) return true;
    return w.minB <= 4.5 ? b > 4.5 : b >= w.minB;
}
/** Zastępca dla roli: spełniający, lokalni przed chmurą, przy kodzie koderskie najpierw, potem ocena Sędziego-Jev, potem najmniejszy (szybszy). */
function zastepcaDla(kat, w, agentId) {
    return kat.filter((m) => spelnia(m, w, agentId) && !NIE_DO_PISANIA.test(m.nazwa))
        .sort((a, b) => Number(/cloud/.test(a.nazwa)) - Number(/cloud/.test(b.nazwa))
            || (w.kod ? Number(!/coder|code/i.test(a.nazwa)) - Number(!/coder|code/i.test(b.nazwa)) : 0)
            || (b.praca?.sredniaJev ?? -1) - (a.praca?.sredniaJev ?? -1)
            || (miliardy(a) ?? 99) - (miliardy(b) ?? 99))[0] ?? null;
}

/** Przydział po regułach ról: model niespełniający wymagania → zastępca z katalogu, z powodem (albo zostaje, z powodem). */
export function regulyRol(przydzial, agenci, kat) {
    const poNazwie = new Map(kat.map((m) => [m.nazwa, m]));
    return przydzial.map((p) => {
        const agent = agenci.find((a) => a.id === p.agent);
        const w = wymaganiaRoli(agent ?? p);
        if (!agent || !w || spelnia(poNazwie.get(p.model), w, agent.id)) return p;
        const z = zastepcaDla(kat, w, agent.id);
        const scala = w.minB <= 4.5;
        if (!z) return { ...p, powod: `${p.powod} · ${scala ? 'reguła scalających: w katalogu nie ma modelu większego niż 4B' : `reguła roli: w katalogu nie ma modelu, który ${opisWymagan(w)}`}` };
        return { ...p, model: z.nazwa, powod: scala
            ? `reguła scalających: ${p.model} ma ≤ 4B, a ${agent.imie ?? p.agent} skleja pracę stada → ${z.nazwa}`
            : `reguła roli: ${p.model} (${klasaModelu(poNazwie.get(p.model) ?? { nazwa: p.model })}) za mały — ${agent.imie ?? p.agent} ${w.opis}, potrzebny ${opisWymagan(w)} → ${z.nazwa}` };
    });
}
/** Dawna nazwa (2026-10-08 rano) — teraz cała rodzina reguł ról. */
export const regulaScalajacych = regulyRol;

// ─────────────────────────────────────────────────────────────────────────────
// KROK 3 — JEV ZAWĘŻA, WIĘKSZY MODEL ROZSTRZYGA. Jev jest szybki (~0,3 s) i trafia w „najsilniejszy sygnał”, ale nie
// waży kompromisów. Bierzemy od niego 3 najlepszych kandydatów na TeOgochi (z prawdopodobieństwem), a decyzję
// z uzasadnieniem podejmuje większy model lokalny (`OTAKOS_DYRYGENT_SEDZIA` → model Dyrygenta, jeśli ≥ 7 mld →
// największy lokalny piszący ≤ 13 GB) — w JEDNYM zapytaniu, wybór tylko z listy kandydata. Na końcu limit
// `MAX_MODELI` różnych modeli dla stada (karta 6 GB: każda podmiana = ładowanie od nowa).
// ─────────────────────────────────────────────────────────────────────────────
export const MAX_MODELI = Number(process.env.OTAKOS_DYRYGENT_MAX_MODELI) || 3;
export const ILU_KANDYDATOW = 3;

/** Kandydaci z odpowiedzi Jev: wybór + kolejni wg prawdopodobieństwa → [{ model, p }] (najwyżej `n`). */
export function kandydaciJev(o, n = ILU_KANDYDATOW) {
    const pr = Object.entries(o?.probabilities ?? {}).map(([m, p]) => [m, Number(p) || 0]).sort((a, b) => b[1] - a[1]);
    const lista = o?.choice ? [[o.choice, pr.find(([m]) => m === o.choice)?.[1] ?? Number(o.confidence ?? 0)], ...pr.filter(([m]) => m !== o.choice)] : pr;
    return lista.slice(0, n).map(([model, p]) => ({ model, p: Math.round(p * 100) / 100 }));
}

/** Zgnieciony kwant (IQ1/IQ2/Q2/TQ…) z Ollamy albo z końcówki nazwy. */
const zgniety = (m) => zgniecionyKwant(m?.kwantyzacja) || zgniecionyKwant(String(m?.nazwa ?? '').split(':').pop());

/** Model, który rozstrzyga (większy niż Jev-owy instynkt, ale lokalny i mieszczący się w karcie + RAM). */
export function modelRozstrzygajacy(kat, modelDyrygenta) {
    const zEnv = process.env.OTAKOS_DYRYGENT_SEDZIA;
    if (zEnv) return zEnv;
    const md = kat.find((m) => m.nazwa === modelDyrygenta || m.nazwa === `${modelDyrygenta}:latest`);
    if (md && (miliardy(md) ?? 0) >= 7 && !zgniety(md)) return md.nazwa;
    // Zgnieciony kwant sprawdzamy też w NAZWIE (hf.co/…:Q2_K) — zmierzone 2026-10-08: gemma-4-26B Q2_K rozstrzygała i pisała „Zapeja…”.
    const kandydaci = kat.filter((m) => !NIE_DO_PISANIA.test(m.nazwa) && !/cloud/.test(m.nazwa) && !zgniety(m) && (miliardy(m) ?? 0) >= 7 && (m.rozmiarGB ?? 99) <= 13)
        .sort((a, b) => (miliardy(b) ?? 0) - (miliardy(a) ?? 0));
    return kandydaci[0]?.nazwa ?? modelDyrygenta;
}

async function rozstrzygnij({ opis, agenci, kat, krotkie, jevPrzydzial }) {
    const poNazwie = new Map(kat.map((m) => [m.nazwa, m]));
    const model = modelRozstrzygajacy(kat, await cfg.model());
    const system = `Jesteś DYRYGENTEM Katedry OtakOS. Dla każdego TeOgochi masz już 3 kandydatów (z szybkiego wstępnego wyboru, z prawdopodobieństwem). Wybierz JEDNEGO z jego listy — tego, który naprawdę służy jego roli w tym zadaniu. Ważysz: rolę i jej wymaganie, rozmiar (większy = mądrzejszy, ale wolniejszy), fakty z karty modelu, ocenę Sędziego-Jev, a także to, że karta graficzna jest jedna — najwyżej ${MAX_MODELI} różne modele dla całego stada (wspólny model dla podobnych ról to zaleta). Wysokie prawdopodobieństwo wstępne to tylko podpowiedź, nie wyrok.
Odpowiadasz WYŁĄCZNIE JSON-em: {"przydzial":[{"agent":"<id>","model":"<nazwa z jego listy>","powod":"<jedno zdanie po polsku>"}]}.`;
    const prompt = `ZADANIE SUWERENA:\n${opis.slice(0, 1500)}\n\nTeOGOCHI I ICH KANDYDACI:\n${agenci.map((a) => {
        const w = wymaganiaRoli(a);
        const lista = (krotkie[a.id] ?? []).map((k) => `    · ${k.model} (wstępnie ${k.p}) — ${poNazwie.get(k.model) ? `${kartaZFaktow(poNazwie.get(k.model))}; ${opisPracy(poNazwie.get(k.model).praca)}` : '?'}`).join('\n');
        return `- ${a.id} — ${a.imie}${a.dziedzina ? ` (${a.dziedzina})` : ''}${w ? ` [wymaganie: ${opisWymagan(w)}]` : ''}\n${lista}`;
    }).join('\n')}`;
    const odp = await cfg.pisz({ system, prompt, model });
    const j = wylowJson(odp);
    if (!j) throw new Error(`model rozstrzygający (${model}) nie oddał JSON-a`);
    const przydzial = [], odrzucone = [];
    for (const a of agenci) {
        const w = (Array.isArray(j.przydzial) ? j.przydzial : []).find((x) => String(x?.agent ?? '').toLowerCase().trim() === a.id);
        const jev = jevPrzydzial.find((p) => p.agent === a.id);
        const naLiscie = (krotkie[a.id] ?? []).find((k) => k.model === String(w?.model ?? '').trim() || k.model === `${String(w?.model ?? '').trim()}:latest`);
        if (w && naLiscie) { przydzial.push({ agent: a.id, model: naLiscie.model, powod: `${String(w.powod ?? '').slice(0, 200)} (wstępnie ${naLiscie.p})` }); continue; }
        if (w) odrzucone.push({ agent: a.id, model: w.model, powod: 'spoza listy kandydatów — zostaje wybór wstępny' });
        if (jev) przydzial.push({ ...jev, powod: `${jev.powod} · rozstrzygający nie wybrał — zostaje wstępny` });
    }
    return { przydzial, odrzucone, model };
}

/**
 * Najwyżej `max` różnych modeli dla stada. Zostają najczęściej wybierane; TeOgochi z innym modelem przechodzi
 * na pierwszego ze SWOICH kandydatów, który już gra (i spełnia jego rolę). Brak takiego — zostaje, z powodem.
 */
export function ograniczDoModeli(przydzial, krotkie = {}, kat = [], max = MAX_MODELI) {
    // Waga: liczba TeOgochi na modelu, a model wybrany roli z wymaganiem (Kodeks → koderski) waży +2 — inaczej
    // limit wycinał wybór specjalistyczny na rzecz popularnego (zmierzone 2026-10-08: Kodeks coder → ornith).
    const ile = new Map();
    // Model do kodu wybrany roli kodu (Kodeks) jest chroniony — limit przesuwał go na ogólny 9B (zmierzone 2026-10-08).
    const waga = (p) => { const w = wymaganiaRoli(p); return 1 + (w?.kod && /coder|[-_]code[-_:]|codestral|starcoder|devstral/i.test(p.model) ? 100 : w ? 2 : 0); };
    for (const p of przydzial) ile.set(p.model, (ile.get(p.model) ?? 0) + waga(p));
    if (ile.size <= max) return przydzial;
    const kolejnosc = [...ile.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([m]) => m);
    const zostaja = new Set(kolejnosc);
    const poNazwie = new Map(kat.map((m) => [m.nazwa, m]));
    return przydzial.map((p) => {
        if (zostaja.has(p.model)) return p;
        const w = wymaganiaRoli(p);
        const inny = (krotkie[p.agent] ?? []).find((k) => zostaja.has(k.model) && spelnia(poNazwie.get(k.model), w, p.agent));
        if (inny) return { ...p, model: inny.model, powod: `${p.powod} · limit ${max} modeli na kartę: ${p.model} → ${inny.model} (też był wśród kandydatów)` };
        // Żaden z jego kandydatów nie gra — najczęściej grający model, który spełnia jego rolę (zmierzone 2026-10-08: Głosek).
        const wspolny = kolejnosc.find((m) => spelnia(poNazwie.get(m) ?? { nazwa: m }, w, p.agent));
        return wspolny
            ? { ...p, model: wspolny, powod: `${p.powod} · limit ${max} modeli na kartę: ${p.model} → ${wspolny} (najczęściej grający, spełnia rolę)` }
            : { ...p, powod: `${p.powod} · ponad limit ${max} modeli — żaden grający model nie spełnia jego roli` };
    });
}

/**
 * ⚖️ Dobór na Jev: każdy TeOgochi = pytanie `choice` (opcje = modele katalogu z opisem), wszystko w JEDNYM
 * zapytaniu. Wynik = model z największym prawdopodobieństwem, powód = pewność i drugi wybór. Przydział
 * przechodzi przez sprawdzPrzydzial jak odpowiedź modelu (Jev wybiera tylko z podanych opcji, ale ufamy faktom).
 * Zwraca { przydzial, odrzucone, model: 'jev-…' }.
 */
export async function dobierzJev(jev, { opis, agenci, kat, linia }) {
    // Zgniecione kwanty (IQ1/IQ2/Q2…) wypadają — gubią treść plików (Zwiadowca też ich nie proponuje).
    const opcje = kat.filter((m) => !NIE_DO_PISANIA.test(m.nazwa) && !zgniecionyKwant(m.kwantyzacja) && !zgniecionyKwant(String(m.nazwa).split(':').pop())).slice(0, 255);
    if (!opcje.length) throw new Error('W katalogu nie ma modeli do pisania.');
    // Jawna KLASA na początku opisu — zmierzone 2026-10-08: bez niej Jev dał Reżyserowi (scalanie) model 4B
    // z pewnością 0,84; rozmiar ukryty w nawiasie nie przebijał się przez nazwę.
    const klasa = (m) => {
        const b = miliardy(m);
        const chmura = /:cloud$|-cloud$/.test(m.nazwa) ? 'CHMURA OLLAMY (duży, poza kartą) — ' : '';
        if (!b) return `${chmura}ROZMIAR NIEZNANY — `;
        return `${chmura}${b >= 9 ? `DUŻY ${b}B — rozumowanie, scalanie, kod` : b > 4.5 ? `ŚREDNI ${b}B — zwykłe wkłady` : `MAŁY ${b}B — tylko krótkie, proste wkłady`} — `;
    };
    const criteria = Object.fromEntries(opcje.map((m) => [m.nazwa, `${klasa(m)}${linia(m).replace(/^- /, '')}`.slice(0, 320)]));
    // Rola z wymaganiem (krok 2) widzi tylko modele, które je spełniają — chyba że żaden nie spełnia.
    const dlaRoli = (a) => {
        const w = wymaganiaRoli(a);
        if (!w) return criteria;
        const c = Object.fromEntries(Object.entries(criteria).filter(([n]) => spelnia(opcje.find((m) => m.nazwa === n), w, a.id)));
        return Object.keys(c).length ? c : criteria;
    };
    const questions = Object.fromEntries(agenci.map((a, i) => [`a${i}`, {
        type: 'choice',
        instructions: {
            pytanie: 'Który model z katalogu Katedry najlepiej posłuży temu TeOgochi w tym zadaniu? Większy model do rozumowania, scalania i kodu; mniejszy i szybszy do krótkich, prostych wkładów; własny model TeOgochi (wykuty z jego pracy) zwykle jest dla niego; liczą się oceny Sędziego-Jev z pracy stada (stare oceny lokalnego Sędziego są zawyżone); karta graficzna jest jedna (ok. 6 GB) — nie każdemu największy.',
            teogochi: `${a.id} — ${a.imie}${a.dziedzina ? ` (${a.dziedzina})` : ''}${a.zadanie ? `: ${String(a.zadanie).slice(0, 300)}` : ''}`,
        },
        criteria: dlaRoli(a),
    }]));
    const d = await jev.zapytaj({ state: { zadanie: opis.slice(0, 2000), sklad: agenci.map((a) => `${a.id} — ${a.imie}`).join('; ') }, questions });
    const propozycja = {
        przydzial: agenci.map((a, i) => {
            const o = d.answers?.[`a${i}`];
            const drugi = Object.entries(o?.probabilities ?? {}).sort((x, y) => y[1] - x[1])[1];
            const pewnosc = Number(o?.confidence ?? 0);
            // Niska pewność = Jev waha się między modelami — Suweren widzi, gdzie warto wybrać ręcznie.
            return { agent: a.id, model: o?.choice, powod: `${pewnosc < 0.3 ? '⚠ niepewny — ' : ''}Jev: pewność ${pewnosc.toFixed(2)}${drugi ? `; drugi wybór ${drugi[0]} (${Number(drugi[1]).toFixed(2)})` : ''}` };
        }),
    };
    const krotkie = Object.fromEntries(agenci.map((a, i) => [a.id, kandydaciJev(d.answers?.[`a${i}`]).filter((k) => kat.some((m) => m.nazwa === k.model))]));
    return { ...sprawdzPrzydzial(propozycja, { agenci, modele: kat.map((m) => m.nazwa) }), krotkie, model: d.model ?? 'jev' };
}

/** Przydział → stałe silniki agentów (ModeleAgentow). Tylko przy maszynie. */
export async function zastosuj(przydzial = []) {
    const wynik = [];
    for (const { agent, model } of przydzial) wynik.push({ agent, model, ok: await cfg.ustawModel(agent, model).then(() => true, (e) => e.message) });
    return wynik;
}

export default { skonfiguruj, katalog, dobierz, dobierzJev, regulaScalajacych, regulyRol, WYMAGANIA_ROL, wymaganiaRoli, spelnia, SCALAJACY, zastosuj, ustawKarte, statystyki, sprawdzPrzydzial, wylowJson, kartaZFaktow, cechyZNazwy, opisPracy, liniaKatalogu, kandydaciJev, modelRozstrzygajacy, ograniczDoModeli, MAX_MODELI };
