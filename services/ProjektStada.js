/**
 * 🧩 Projekt Stada — TeOgochi pracują RAZEM nad jednym dziełem Suwerena.
 *
 * Suweren (2026-09-24): „one mogą ze sobą współpracować… każdy może być poustawiany na innym
 * modelu… wspólne wykonanie zadań przez agentów… całe uniwersum z filmami, grami, modą,
 * muzyką… i merchandising".
 *
 * JAK TO CHODZI:
 *   Suweren podaje wizję → każdy uczestnik dostaje zadanie ze SWOJEJ dziedziny (tabela ROLE)
 *   → pracują kolejnymi falami: najpierw fundament (fabuła, mit świata), potem dziedziny
 *   (muzyka, zwiastun, gra, moda, styl, głosy), na końcu to, co wymaga całości (merch, budżet,
 *   spójność) → Reżyser (albo pierwszy uczestnik) scala wszystko w Biblię projektu.
 *   Każdy agent pracuje na SWOIM modelu (services/ModeleAgentow.js) z SWOJĄ kartą roli
 *   (services/Persony.js) i widzi wkłady tych, którzy byli przed nim.
 *
 * Każdy krok idzie na szynę jako ten agent → Świat klocków pokazuje na żywo, kto nad czym
 * pracuje; oddany wkład staje się klockiem na jego płytce (services/KlockiStada.js).
 *
 * Wkład to TEKST, ale z liniami dla maszyny (PRODUKT:, MUZYKA:, OBIEKT:, UJĘCIE:). Gdy Stado skończy
 * pisać, te linie SAME zlecają moduły Katedry — Marketplace, generator muzyki, Assety3D, wideo
 * (services/ZleceniaStada.js). Zlecenia idą jedną kolejką, po kolei, bo karta graficzna jest jedna;
 * wynik albo błąd modułu zostaje zapisany w projekcie. Suweren może to wyłączyć przy zakładaniu
 * (`samoZlecanie: false`) i zlecić ręcznie później (zlec).
 * Jeden projekt naraz — lokalna karta graficzna jest jedna.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as ZleceniaStada from './ZleceniaStada.js';
import { ocenJev } from './SedziaJev.js';

let cfg = {
    katalog: path.join(process.cwd(), '_OtakOs_Wymiar', 'projekty-stada'),
    szyna: null,
    /** (model, messages) → tekst odpowiedzi */
    chat: async () => { throw new Error('Brak silnika czatu.'); },
    /** id gatunku → model albo null */
    modelDla: async () => null,
    domyslnyModel: 'gemma4:e2b',
    /** id gatunku → { tresc, imie, dziedzina } | null */
    karta: async () => null,
    /** ({ id, xp, klucz, powod }) → nagroda XP za pracę (Stado.nagrodz); bez niej praca nie daje XP. */
    nagroda: null,
    /** ({ zadanie, agenci }) → { przydzial:[{agent, model, powod}], odrzucone, model } — Dyrygent (services/Dyrygent.js) */
    dyrygent: null,
    /** (ścieżka, body?) → JSON z trasy mostu; bez niego wkłady niczego nie zlecają. */
    most: null,
    odstepMs: 10_000,
    limityMs: {},
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

/**
 * Co kto wnosi. `fala`: 1 = fundament, 2 = dziedziny, 3 = to, co wymaga całości.
 * Gatunek spoza tabeli dostaje zadanie ogólne ze swojej dziedziny (fala 2).
 */
export const ROLE = {
    rezyser: { fala: 1, zadanie: 'Fabuła i bohaterowie: logline (1 zdanie), 3–5 postaci (imię, cel, sekret), świat i jego zasady, główny konflikt.' },
    kronikarz: { fala: 1, zadanie: 'Kronika założycielska: mit powstania tego świata, ton opowieści, 5 kluczowych nazw własnych z krótkim wyjaśnieniem.' },
    klatka: { fala: 2, zadanie: 'Scenopis zwiastunu 60 s: 6–8 ujęć (plan, ruch kamery, co widać, dźwięk), zbudowany na bohaterach i konflikcie. Dwa najważniejsze ujęcia napisz dodatkowo każde w osobnej linii zaczynającej się od „UJĘCIE:" — jedno zdanie po angielsku dla generatora wideo (kto, co robi, gdzie, światło, ruch kamery).' },
    joanna: { fala: 2, zadanie: 'Muzyka: motyw przewodni (nastrój, BPM, tonacja, instrumenty) i tekst refrenu. Na końcu dwie linie dla generatora muzyki: „MUZYKA:" + prompt po angielsku (gatunek, nastrój, instrumenty, BPM) oraz „REFREN:" + wersy refrenu rozdzielone „/".' },
    kodeks: { fala: 2, zadanie: 'Gra: gatunek, pętla rozgrywki, 3 mechaniki wynikające ze świata, pierwszy poziom — skrót dokumentu gry. Na końcu jedna linia dla Studia Gier: „GRA: nazwa gry | jedno zdanie, co to za gra" (gdy projekt to raczej aplikacja niż gra: „APKA: nazwa | jedno zdanie").' },
    // 🎲 Pionek (2026-09-29, Suweren: „dodał bym NOWE TeOgochi… od Gier/budowania ich"): dokument gry i linia GRA: —
    // gdy jest w zespole, Kodeks dostaje technikę (KODEKS_Z_PIONKIEM), a gra ma jednego autora.
    pionek: { fala: 2, zadanie: 'Gra: gatunek, pętla rozgrywki (co gracz robi co 30 s, co 5 min, co godzinę), 3 mechaniki wynikające ze świata, progresja i pierwszy poziom krok po kroku — skrót dokumentu gry (GDD), który Studio Gier zamieni w plan produkcji. Na końcu jedna linia dla Studia Gier: „GRA: nazwa gry | jedno zdanie, co to za gra" (gdy projekt to raczej aplikacja niż gra: „APKA: nazwa | jedno zdanie").' },
    // 🎭 Aktor (2026-10-03, Suweren: „można powołać TeOgochi… Aktora"): gra postaci zespołu — wywiad o filmie nagrywa
    // potem services/WywiadAktorow.js (TeO Story Studio → Post-produkcja → 🎭 Aktorzy), nie ten wkład.
    aktor: { fala: 3, zadanie: 'Obsada: dla każdej postaci, którą zespół już wymyślił (najwyżej 4), jak ją zagrasz — głos (barwa, tempo), sposób mówienia, jedno charakterystyczne zdanie. Potem 3 pytania z wywiadu o tym filmie i odpowiedzi postaci W ROLI — tylko z faktów zespołu, bez zmyślonych scen.' },
    krawcowa: { fala: 2, zadanie: 'Moda: kolekcja 4 strojów bohaterów (krój, materiał, kolory, detal), spójna ze światem.' },
    paleta: { fala: 2, zadanie: 'Styl wizualny: paleta 5 barw (hex) z uzasadnieniem i 3 obiekty do wyrzeźbienia w 3D — każdy w osobnej linii zaczynającej się od „OBIEKT:" i jednym zdaniem opisu dla generatora brył.' },
    glosek: { fala: 2, zadanie: 'Głosy: obsada głosowa postaci (barwa, tempo, maniera) i 3 kwestie próbne.' },
    spawacz: { fala: 2, zadanie: 'Warsztat: łańcuch produkcji — które moduły Katedry (muzyka, obraz, wideo, 3D, gra) i w jakiej kolejności zrobią pliki tego projektu.' },
    kupiec: { fala: 3, zadanie: 'Merchandising: 5 produktów z tego uniwersum — tylko z tego, co zespół już wymyślił. Każdy produkt w osobnej linii: „PRODUKT: nazwa | cena w GRV | dla kogo i co to jest".' },
    bilans: { fala: 3, zadanie: 'Plan i budżet: co zrobić najpierw, szacunek czasu pracy karty graficznej, 3 ryzyka.' },
    wektor: { fala: 3, zadanie: 'Spójność: wypisz sprzeczności między wkładami zespołu i zaproponuj, jak je rozwiązać.' },
    straznik: { fala: 3, zadanie: 'Bezpieczeństwo i prawa: co w projekcie może naruszać cudze prawa albo prywatność i jak tego uniknąć.' },
};

const MAX_UCZESTNIKOW = 12;
const MAX_WKLADU = 4000;
/**
 * RUNDY DOSKONALENIA i PĘTLA KREATYWNA (Suweren 2026-09-27: „małe modele i lokalne… rundy
 * samoudoskonalenia… dokładanie kolejnych cegiełek… aż produkt będzie miał ten cały obiecany efekt").
 *   runda  = całe stado jeszcze raz: każdy bierze SWÓJ poprzedni wkład, Biblię i braki wskazane przez
 *            Sędziego i oddaje pełną, lepszą wersję; potem nowa Biblia i nowa ocena. Koniec po `rundy`
 *            albo wcześniej, gdy Sędzia da ≥ CEL_OCENY (wizja spełniona).
 *   pętla  = na każdym punkcie planu: autor czyta swój szkic krytycznie względem wizji i oddaje
 *            poprawioną wersję — `petla` razy, zanim przekaże pałeczkę dalej.
 * Sędzia to Wektor (spójność), gdy jest w zespole, inaczej scalacz — na swoim modelu.
 */
export const MAX_RUND = 5;
export const MAX_PETLI = 3;
export const CEL_OCENY = 9;
const MAX_UWAG = 4000;
/** 1 runda, 3 rundy, 5 rund — liczebnik po polsku do komunikatów szyny. */
export const rund = (n) => `${n} ${n === 1 ? 'runda' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'rundy' : 'rund'}`;

const wLimicie = (v, min, max, dom) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dom; };
const ID = /^[a-z0-9-]{2,40}$/;
const trwajace = new Set();
/** `${projekt}/${zlecenie}` — zlecenia w kolejce albo w pracy w TYM procesie mostu. */
const aktywne = new Set();
let ogon = Promise.resolve();

const plik = (id) => path.join(cfg.katalog, `${id}.json`);
async function zapisz(p) {
    await fs.mkdir(cfg.katalog, { recursive: true });
    const tmp = `${plik(p.id)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(p, null, 2), 'utf8');
    await fs.rename(tmp, plik(p.id));
}
export async function projekt(id) {
    if (!ID.test(String(id))) return null;
    // ⚠️ Stan pracy łapiemy PRZED i PO odczycie. Odczyt pliku bywa sprzed ostatniego zapisu (otwarty stary plik,
    // a w międzyczasie praca zapisała koniec i zeszła z listy) — sam test „po" widział wtedy „trwa" bez pracy
    // i mówił „przerwany", a Nocna Zmiana brała udaną rundę za błąd. Przerwane = nie żyło ani przed, ani po.
    const zywyPrzed = trwajace.has(id);
    const aktywnePrzed = new Set([...aktywne].filter((a) => a.startsWith(`${id}/`)));
    let p;
    try { p = JSON.parse(await fs.readFile(plik(id), 'utf8')); } catch { return null; }
    // Po restarcie mostu praca z pliku nie wraca sama — mówimy „przerwane", a nie udajemy, że trwa.
    if (p.stan === 'trwa' && !zywyPrzed && !trwajace.has(p.id)) p.stan = 'przerwany';
    for (const z of p.zlecenia ?? []) {
        const klucz = `${p.id}/${z.id}`;
        if ((z.stan === 'czeka' || z.stan === 'trwa') && !aktywnePrzed.has(klucz) && !aktywne.has(klucz)) z.stan = 'przerwane';
    }
    return p;
}
export async function lista() {
    if (!fsSync.existsSync(cfg.katalog)) return [];
    const out = [];
    for (const f of await fs.readdir(cfg.katalog)) {
        if (!f.endsWith('.json')) continue;
        const p = await projekt(f.slice(0, -5));
        if (p) out.push(p);
    }
    return out.sort((a, b) => String(b.od).localeCompare(String(a.od)));
}
/** Krótki opis do listy i do Świata (bez pełnych wkładów). */
export function skrot(p) {
    return {
        id: p.id, nazwa: p.nazwa, wizja: p.wizja.slice(0, 300), stan: p.stan, od: p.od, do: p.do ?? null, zalozyl: p.zalozyl ?? null,
        kroki: p.kroki.map(({ agent, imie, zadanie, model, stan, fala, petle }) => ({ agent, imie, zadanie, model, stan, fala, petle: petle ?? 0 })),
        dyrygent: !!p.dyrygent, przydzial: p.przydzial ?? null,
        gotowe: p.kroki.filter((k) => k.stan === 'gotowe').length, razem: p.kroki.length,
        runda: p.runda ?? 1, rundy: p.rundy ?? 1, petla: p.petla ?? 0,
        oceny: (p.oceny ?? []).map(({ runda, ocena, braki, kto }) => ({ runda, ocena, braki, kto })),
        zlecenia: (p.zlecenia ?? []).map(({ id, modul, agent, imie, opis, stan }) => ({ id, modul, agent, imie, opis, stan })),
    };
}

const nadaj = (agent, tresc, dane) => cfg.szyna?.nadaj?.({ agent, rodzaj: 'projekt', tresc, dane })?.catch?.(() => {});

/** Plan: kto, w jakiej fali, z jakim zadaniem — plus scalenie na końcu. */
export const KODEKS_Z_PIONKIEM = 'Technika gry/apki: architektura (ekrany, stan, dane, zapis gry), stos w Studiu Gier (three.js albo Vite + React), co zbudować najpierw i jak sprawdzić, że działa. Dokument gry pisze Pionek — Ty mówisz, jak go zbudować; linii „GRA:" nie piszesz.';

/** TeOgochi, którzy NIE piszą wkładów: Dyrygent dobiera modele przed stadem (dyryguje, nie gra). */
export const POZA_SKLADEM = new Set(['dyrygent']);

export function zaplanuj(wszyscy) {
    const uczestnicy = wszyscy.filter((u) => !POZA_SKLADEM.has(u.id));
    if (!uczestnicy.length) throw new Error('W składzie projektu nie został nikt, kto pisze wkłady (Dyrygent tylko dobiera modele).');
    const zPionkiem = uczestnicy.some((u) => u.id === 'pionek');
    const kroki = uczestnicy.map((u) => {
        const r = ROLE[u.id] ?? { fala: 2, zadanie: `Wkład z Twojej dziedziny (${u.dziedzina || 'Twoja specjalność'}) do tego projektu — konkretny i spójny z resztą.` };
        const zadanie = u.id === 'kodeks' && zPionkiem ? KODEKS_Z_PIONKIEM : r.zadanie;
        return { agent: u.id, imie: u.imie, fala: r.fala, zadanie };
    }).sort((a, b) => a.fala - b.fala);
    const scalacz = uczestnicy.find((u) => u.id === 'rezyser') ?? uczestnicy.find((u) => u.id === 'kronikarz') ?? uczestnicy[0];
    kroki.push({
        agent: scalacz.id, imie: scalacz.imie, fala: 4, synteza: true,
        zadanie: 'Biblia projektu: scal wszystkie wkłady w jeden spójny dokument — świat, bohaterowie, muzyka, zwiastun, gra, moda, styl, merch — i wypisz 5 pierwszych kroków produkcji w Katedrze.',
    });
    return kroki;
}

/**
 * Załóż projekt i uruchom pracę w tle. Zwraca od razu (id); postęp idzie szyną i plikiem.
 * @param {{ nazwa:string, wizja:string, uczestnicy:{id:string, imie:string, dziedzina?:string}[] }} o
 */
export async function zaloz({ nazwa, wizja, uczestnicy, samoZlecanie = true, zalozyl = null, rundy = 1, petla = 0, dyrygent = false }) {
    const n = String(nazwa ?? '').trim().slice(0, 80);
    const w = String(wizja ?? '').trim().slice(0, 3000);
    if (!n) throw new Error('Nadaj projektowi nazwę.');
    if (w.length < 10) throw new Error('Opisz wizję choć jednym zdaniem.');
    const lista2 = (uczestnicy ?? []).filter((u) => u && ID.test(String(u.id))).slice(0, MAX_UCZESTNIKOW);
    if (lista2.length < 2) throw new Error('Wspólny projekt potrzebuje co najmniej dwóch TeOgochi.');
    if (trwajace.size) throw new Error('Stado pracuje już nad innym projektem — jedna karta graficzna, jeden projekt naraz.');

    const id = `${n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'projekt'}-${crypto.randomBytes(2).toString('hex')}`;
    const p = {
        id, nazwa: n, wizja: w, stan: 'trwa', od: new Date().toISOString(), samoZlecanie: samoZlecanie !== false,
        zalozyl: zalozyl ? String(zalozyl).slice(0, 60) : null,   // null = przy Katedrze; inaczej nazwa sparowanego urządzenia
        runda: 1, rundy: wLimicie(rundy, 1, MAX_RUND, 1), petla: wLimicie(petla, 0, MAX_PETLI, 0), oceny: [],
        dyrygent: !!dyrygent && !!cfg.dyrygent,
        kroki: await Promise.all(zaplanuj(lista2).map(async (k) => ({
            ...k, model: (await cfg.modelDla(k.agent).catch(() => null)) || cfg.domyslnyModel, stan: 'czeka', wklad: null,
        }))),
    };
    trwajace.add(id);   // przed zapisem — inaczej czytelnik zobaczyłby „trwa" bez pracy i uznał za przerwany
    try { await zapisz(p); } catch (e) { trwajace.delete(id); throw e; }
    nadaj('Stado', `nowy wspólny projekt „${n}" — ${lista2.map((u) => u.imie).join(', ')}${p.rundy > 1 ? ` · ${rund(p.rundy)} doskonalenia` : ''}${p.petla ? ` · pętla kreatywna ×${p.petla}` : ''}${p.zalozyl ? ` (zlecony z urządzenia „${p.zalozyl}")` : ''}`, { projekt: id });
    pracuj(p).catch(() => {}).finally(() => trwajace.delete(id));
    return skrot(p);
}

const scalacz = (p) => p.kroki.find((k) => k.synteza);
const biblia = (p) => { const s = scalacz(p); return s?.stan === 'gotowe' ? s.wklad ?? '' : ''; };

/** System dla autora wkładu: jego karta roli + zasady pracy zespołu. */
async function systemDla(k) {
    const karta = await cfg.karta(k.agent).catch(() => null);
    return `${karta?.tresc ?? `Jesteś ${k.imie} — TeOgochi Katedry OtakOS.`}

PRACUJESZ W ZESPOLE. Stado TeOgochi robi razem jeden projekt Suwerena; każdy wnosi to, co umie najlepiej.
Opieraj się na wkładach kolegów, nie przecz im. Piszesz po polsku, konkretnie, bez wstępów i bez markdownowych nagłówków.
${k.synteza ? 'Jesteś SCALACZEM: masz przed sobą wszystkie wkłady — złóż z nich jedną całość (do 450 słów).' : 'Twój wkład: do 250 słów.'}`;
}

/** Treść zadania dla kroku `k` w bieżącej rundzie — pierwsza runda buduje, kolejne doskonalą. */
function zadanieDla(p, k) {
    const inni = p.kroki.filter((x) => x !== k && !x.synteza && x.wklad && (x.stan === 'gotowe' || p.runda > 1));
    const zespol = inni.length
        ? `WKŁADY ZESPOŁU DO TEJ PORY:\n${inni.map((x) => `— ${x.imie}: ${x.wklad.slice(0, k.synteza ? 1800 : 1200)}`).join('\n\n')}`
        : 'Jesteś pierwszy — kładziesz fundament.';
    const naglowek = `PROJEKT: ${p.nazwa}\nWIZJA SUWERENA:\n${p.wizja}`;
    if (p.runda <= 1) return `${naglowek}\n\n${zespol}\n\nTWOJE ZADANIE (${k.imie}):\n${k.zadanie}`;
    const ocena = (p.oceny ?? []).find((o) => o.runda === p.runda - 1);
    const braki = ocena?.braki?.length ? ocena.braki.map((b) => `- ${b}`).join('\n') : '- (Sędzia nie wskazał braków — pogłębiaj i konkretyzuj)';
    const poprzedniaBiblia = (p.bibliaPoprzednia ?? '').slice(0, 1500);
    const uw = uwagiDla(p);
    return `${naglowek}

RUNDA ${p.runda} z ${p.rundy} — DOSKONALENIE. Nie zaczynaj od zera: projekt już ma kształt, Ty go rozbudowujesz.
${poprzedniaBiblia ? `BIBLIA Z RUNDY ${p.runda - 1}:\n${poprzedniaBiblia}\n` : ''}${uw ? `\nUWAGI SUWERENA (${uw.zrodlo}) — weź je pod uwagę w swojej dziedzinie:\n${uw.tresc.slice(0, 1500)}\n` : ''}
BRAKI WSKAZANE PRZEZ SĘDZIEGO${ocena?.ocena != null ? ` (zgodność z wizją ${ocena.ocena}/10)` : ''}:
${braki}

${zespol}

${k.synteza ? 'TWOJA POPRZEDNIA BIBLIA' : 'TWÓJ WKŁAD Z POPRZEDNIEJ RUNDY'}:
${(k.wklad ?? '(nie powstał — napisz go teraz)').slice(0, 2000)}

TWOJE ZADANIE (${k.imie}):
${k.zadanie}
Dołóż kolejne cegiełki: domknij braki ze swojej dziedziny, usuń sprzeczności z zespołem, zamień ogólniki na konkrety.
Oddaj PEŁNĄ nową wersję (nie listę zmian). Linie dla maszyny (PRODUKT:, MUZYKA:, REFREN:, OBIEKT:, UJĘCIE:) zachowaj albo popraw.`;
}

/**
 * Uwagi Suwerena do rund (np. rozmowa Iskry i Echo z Podcast Twin o tym, co stado już ma).
 * Obowiązują od rundy, przed którą je dano, aż do nowych uwag.
 */
function uwagiDla(p) {
    return [...(p.uwagi ?? [])].reverse().find((u) => u.odRundy <= (p.runda ?? 1)) ?? null;
}

/** Pętla kreatywna jednego punktu planu: autor krytycznie czyta swój szkic i oddaje lepszą wersję. */
async function szlifuj(p, k, system, szkic) {
    let tekst = szkic;
    k.petle = 0;
    const przed = szkic;
    for (let i = 1; i <= (p.petla ?? 0); i++) {
        nadaj(k.imie, `szlifuje ${k.synteza ? 'Biblię' : 'wkład do'} „${p.nazwa}" — pętla ${i}/${p.petla}`, { projekt: p.id });
        try {
            const lepszy = String(await cfg.chat(k.model, [{ role: 'system', content: system }, { role: 'user', content: `PROJEKT: ${p.nazwa}
WIZJA SUWERENA:
${p.wizja}

TWOJE ZADANIE (${k.imie}):
${k.zadanie}

TWÓJ SZKIC:
${tekst}

PĘTLA KREATYWNA ${i}/${p.petla}: przeczytaj szkic krytycznie względem wizji Suwerena i zadania — co jest ogólnikowe, czego brakuje, co kłóci się z zespołem, co można zrobić odważniej? Potem oddaj WYŁĄCZNIE poprawioną, pełną wersję (bez komentarza o poprawkach). Linie dla maszyny (PRODUKT:, MUZYKA:, REFREN:, OBIEKT:, UJĘCIE:) zachowaj.` }]) ?? '').trim();
            if (!lepszy) break;          // pusta odpowiedź — zostaje poprzednia wersja
            tekst = lepszy;
            k.petle = i;
            // Para „szkic → po pętli" — Kuźnia Modeli uczy z niej TeOgochi, co znaczy „lepiej" (DPO).
            k.szkice = [...(k.szkice ?? []), { runda: p.runda ?? 1, przed: przed.slice(0, MAX_WKLADU), po: lepszy.slice(0, MAX_WKLADU) }].slice(-4);
        } catch (e) {
            k.bladPetli = String(e.message || e).slice(0, 200);   // szkic przed pętlą zostaje — to nie jest błąd kroku
            break;
        }
    }
    return tekst;
}

/** Jedna runda: każdy krok planu po kolei (w pierwszej budowa, w kolejnych doskonalenie), na końcu scalenie. */
async function runda(p) {
    for (const k of p.kroki) {
        k.stan = 'trwa'; k.od = new Date().toISOString();
        await zapisz(p);
        nadaj(k.imie, p.runda > 1
            ? `doskonali „${p.nazwa}" (runda ${p.runda}/${p.rundy}): ${k.zadanie.split(':')[0]}`
            : `pracuje nad „${p.nazwa}": ${k.zadanie.split(':')[0]}`, { projekt: p.id });
        try {
            const system = await systemDla(k);
            const szkic = String(await cfg.chat(k.model, [{ role: 'system', content: system }, { role: 'user', content: zadanieDla(p, k) }]) ?? '').trim();
            if (!szkic) throw new Error('model oddał pustą odpowiedź');
            const nowy = (await szlifuj(p, k, system, szkic)).slice(0, MAX_WKLADU);
            // Wersja z poprzedniej rundy zostaje — z oceną Sędziego tworzy parę „gorzej → lepiej" dla Kuźni.
            if (k.wklad && p.runda > 1) k.wersje = [...(k.wersje ?? []), { runda: k.runda ?? p.runda - 1, wklad: k.wklad }].slice(-4);
            k.wklad = nowy;
            k.stan = 'gotowe'; k.blad = null; k.runda = p.runda;
            nadaj(k.imie, `oddał${k.synteza ? ' Biblię projektu' : ' wkład do'} „${p.nazwa}"${p.rundy > 1 ? ` (runda ${p.runda}/${p.rundy})` : ''}${k.petle ? ` po ${k.petle} ${k.petle === 1 ? 'pętli' : 'pętlach'}` : ''}`, { projekt: p.id });
            // Każda runda to nowa praca — płaci osobno (runda 1 zostaje przy starym kluczu).
            const r = p.runda > 1 ? `:r${p.runda}` : '';
            await nagrodz(k.agent, k.imie, k.synteza ? 'biblia' : 'wklad', `projekt:${p.id}:${k.agent}${k.synteza ? ':biblia' : ''}${r}`, `${k.synteza ? 'Biblię' : 'wkład'} „${p.nazwa}"${r ? ` (runda ${p.runda})` : ''}`, p.id);
        } catch (e) {
            // W rundzie doskonalenia stary wkład zostaje (wklad) — padła tylko ta próba.
            k.stan = 'blad'; k.blad = String(e.message || e).slice(0, 300);
            nadaj(k.imie, `nie dał rady w „${p.nazwa}": ${k.blad}`, { projekt: p.id });
        }
        k.do = new Date().toISOString();
        await zapisz(p);
    }
}

/**
 * Sędzia: na ile Biblia spełnia wizję (0–10) i czego brakuje. Format odpowiedzi jest sztywny, bo czyta
 * go maszyna; gdy model go nie trzyma, ocena = null (rundy idą dalej, tylko bez wczesnego końca).
 */
export function czytajOcene(tekst) {
    const t = String(tekst ?? '');
    const m = t.match(/ZGODNO[SŚ][CĆ]\s*\**\s*:\s*\**\s*(\d{1,2})(?:[.,]\d)?\s*(?:\/\s*10)?/i);
    const ocena = m ? Math.min(10, Number(m[1])) : null;
    const po = t.split(/BRAKI\s*\**\s*:/i)[1] ?? '';
    const braki = po.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim())
        .filter((l) => l.length > 3 && !/^(brak|nic|żadnych)\.?$/i.test(l)).slice(0, 6).map((l) => l.slice(0, 240));
    return { ocena, braki };
}

async function ocen(p) {
    const tekstBiblii = biblia(p);
    if (!tekstBiblii) return null;
    const sedzia = p.kroki.find((k) => k.agent === 'wektor' && !k.synteza) ?? scalacz(p);
    nadaj(sedzia.imie, `ocenia „${p.nazwa}" względem wizji (runda ${p.runda}/${p.rundy})`, { projekt: p.id });
    let wpis;
    try {
        const odp = await cfg.chat(sedzia.model, [
            { role: 'system', content: `${await systemDla({ ...sedzia, synteza: false })}\n\nJesteś teraz SĘDZIĄ projektu: surowo, uczciwie, konkretnie.` },
            { role: 'user', content: `PROJEKT: ${p.nazwa}
WIZJA SUWERENA (wszystkie założenia muszą być spełnione):
${p.wizja}

BIBLIA PROJEKTU (runda ${p.runda}):
${tekstBiblii.slice(0, 3000)}
${uwagiDla(p) ? `\nUWAGI SUWERENA do tej pracy (sprawdź, czy zespół je uwzględnił):\n${uwagiDla(p).tresc.slice(0, 1200)}\n` : ''}
Oceń, na ile Biblia spełnia WSZYSTKIE założenia wizji. Odpowiedz dokładnie w tym formacie:
ZGODNOŚĆ: <liczba 0–10>/10
BRAKI:
- <konkretny brak albo sprzeczność — co zespół ma dołożyć w następnej rundzie>
(najwyżej 5 braków; gdy wizja jest spełniona, napisz „BRAKI: brak")` },
        ]);
        wpis = { runda: p.runda, kto: sedzia.imie, ...czytajOcene(odp) };
    } catch (e) {
        wpis = { runda: p.runda, kto: sedzia.imie, ocena: null, braki: [], blad: String(e.message || e).slice(0, 200) };
    }
    // ⚖️ Sędzia Jev (services/SedziaJev.js, 2026-10-08): liczba zgodności z rubryki i każde założenie wizji osobno.
    // Ocena Jev decyduje (wcześniejszy koniec rund), lokalna zostaje obok do porównania; braki = niespełnione
    // założenia wizji + słowne braki lokalnego Sędziego. Bez klucza / błąd Jev — po staremu.
    if (cfg.jev) {
        try {
            const j = await ocenJev(cfg.jev, { wizja: p.wizja, biblia: tekstBiblii, uwagi: uwagiDla(p)?.tresc ?? '' });
            if (j && j.ocena != null) {
                const braki = [...new Set([...j.braki, ...(wpis.braki ?? [])])].slice(0, 8);
                wpis = { ...wpis, kto: `Jev + ${sedzia.imie}`, ocenaLokalna: wpis.ocena, ocena: j.ocena, braki, jev: { model: j.model, pewnosc: j.pewnosc, zalozenia: j.zalozenia } };
                delete wpis.blad;
            }
        } catch (e) {
            wpis = { ...wpis, jevBlad: String(e.message || e).slice(0, 200) };
        }
    }
    p.oceny = [...(p.oceny ?? []).filter((o) => o.runda !== p.runda), wpis];
    await zapisz(p);
    // 🌟 Partytury (services/Partytury.js): Sędzia-Jev ≥ 9/10 → układ tej pracy zapisuje się jako genialne wykonanie.
    if (cfg.poOcenie) await Promise.resolve(cfg.poOcenie(p, wpis)).catch((e) => console.warn(`[Partytury] ${e.message}`));
    nadaj(sedzia.imie, wpis.ocena != null
        ? `„${p.nazwa}" po rundzie ${p.runda}: zgodność z wizją ${wpis.ocena}/10${wpis.braki.length ? ` — braki: ${wpis.braki.slice(0, 2).join('; ')}` : ''}`
        : `nie umiał ocenić „${p.nazwa}"${wpis.blad ? `: ${wpis.blad}` : ' (odpowiedź bez oceny)'}`, { projekt: p.id });
    return wpis;
}

function nastepnaRunda(p) {
    p.bibliaPoprzednia = biblia(p);
    p.runda = (p.runda ?? 1) + 1;
    for (const k of p.kroki) { k.stan = 'czeka'; k.petle = 0; }
    nadaj('Stado', `„${p.nazwa}" — runda ${p.runda}/${p.rundy}: stado dokłada kolejne cegiełki`, { projekt: p.id });
}

/**
 * 🎼 Dyrygent dobiera modele do TEGO projektu (kroki planu), zanim stado ruszy. Stałe silniki TeOgochi
 * (ModeleAgentow) zostają nietknięte. Gdy Dyrygent zawiedzie — każdy gra na swoim, a powód jest w projekcie.
 */
async function dyryguj(p) {
    const agenci = [...new Map(p.kroki.map((k) => [k.agent, { id: k.agent, imie: k.imie, zadanie: k.zadanie }])).values()];
    nadaj('Dyrygent', `dobiera modele do „${p.nazwa}" (${agenci.length} TeOgochi)`, { projekt: p.id });
    try {
        const w = await cfg.dyrygent({ zadanie: `${p.nazwa}: ${p.wizja}`, agenci });
        for (const k of p.kroki) { const m = w.przydzial.find((x) => x.agent === k.agent); if (m) k.model = m.model; }
        p.przydzial = { model: w.model, przydzial: w.przydzial, odrzucone: w.odrzucone ?? [], kiedy: new Date().toISOString() };
        nadaj('Dyrygent', `„${p.nazwa}": ${w.przydzial.map((x) => `${x.agent} → ${x.model}`).join(', ') || 'bez zmian'}${w.odrzucone?.length ? ` (odrzucone: ${w.odrzucone.length})` : ''}`, { projekt: p.id });
    } catch (e) {
        p.przydzial = { blad: String(e.message || e).slice(0, 300), kiedy: new Date().toISOString() };
        nadaj('Dyrygent', `nie dobrał modeli do „${p.nazwa}" — każdy gra na swoim: ${p.przydzial.blad}`, { projekt: p.id });
    }
    await zapisz(p);
}

async function pracuj(p, { kontynuacja = false } = {}) {
    if (p.dyrygent && !p.przydzial && cfg.dyrygent) await dyryguj(p);
    if (kontynuacja) {
        if (!(p.oceny ?? []).some((o) => o.runda === p.runda)) await ocen(p);   // braki poprzedniej rundy dla zespołu
        nastepnaRunda(p);
    }
    let cel = false;
    for (;;) {
        await runda(p);
        const cokolwiek = p.kroki.some((k) => k.stan === 'gotowe');
        const wpis = p.rundy > 1 && cokolwiek ? await ocen(p) : null;
        cel = wpis?.ocena != null && wpis.ocena >= CEL_OCENY;
        if (cel || !cokolwiek || p.runda >= p.rundy) break;
        nastepnaRunda(p);
    }
    const bledy = p.kroki.filter((k) => k.stan === 'blad').length;
    p.stan = bledy === p.kroki.length ? 'blad' : bledy ? 'czesciowo' : 'gotowe';
    p.do = new Date().toISOString();
    await zapisz(p);
    const ocena = (p.oceny ?? []).at(-1)?.ocena;
    const tresc = `projekt „${p.nazwa}" ${p.stan === 'gotowe' ? 'skończony' : p.stan === 'czesciowo' ? `skończony z ${bledy} brakami` : 'nie powiódł się'}` +
        `${p.rundy > 1 ? ` po ${p.runda} z ${p.rundy} rund` : ''}${ocena != null ? `, zgodność z wizją ${ocena}/10` : ''}${cel && p.runda < p.rundy ? ' — wizja spełniona przed czasem' : ''}`;
    // `glos` = zdanie dla zapowiedzi głosowej (Hub przy maszynie, StoL na telefonie).
    const glos = p.stan === 'blad'
        ? `Uwaga, projekt ${p.nazwa} nie powiódł się.`
        : `Stado skończyło projekt ${p.nazwa}${p.rundy > 1 ? ` po ${p.runda} rundach` : ''}${ocena != null ? `, zgodność z wizją ${ocena} na 10` : ''}.`;
    nadaj('Stado', tresc, { projekt: p.id, koniec: true, stan: p.stan, ocena: ocena ?? null, glos });
    if (p.samoZlecanie && cfg.most) await zlecWszystko(p);
}

/**
 * Kolejne rundy doskonalenia już skończonego projektu (Nocna Zmiana „×N", Stół „Doskonal").
 * Dokłada `rundy` rund do tych, które były; `petla` zmienia pętlę kreatywną (bez podania — zostaje).
 */
export async function kontynuuj(id, { rundy = 1, petla, uwagi, zrodloUwag = 'Suweren' } = {}) {
    const p = await projekt(id);
    if (!p) throw new Error('Nie ma takiego projektu.');
    if (trwajace.has(p.id)) throw new Error('Stado właśnie pracuje nad tym projektem.');
    if (trwajace.size) throw new Error('Stado pracuje już nad innym projektem — jedna karta graficzna, jeden projekt naraz.');
    if (!p.kroki.some((k) => k.wklad)) throw new Error('Projekt nie ma jeszcze żadnego wkładu — nie ma czego doskonalić.');
    if ((p.zlecenia ?? []).some((z) => aktywne.has(`${p.id}/${z.id}`))) throw new Error('Moduły jeszcze pracują nad zleceniami tego projektu.');
    p.runda = p.runda ?? 1;
    p.rundy = p.runda + wLimicie(rundy, 1, MAX_RUND, 1);
    if (petla !== undefined && petla !== null && petla !== '') p.petla = wLimicie(petla, 0, MAX_PETLI, 0);
    p.petla = p.petla ?? 0;
    const tresc = String(uwagi ?? '').trim().slice(0, MAX_UWAG);
    if (tresc) p.uwagi = [...(p.uwagi ?? []), { odRundy: p.runda + 1, tresc, zrodlo: String(zrodloUwag).slice(0, 60), kiedy: new Date().toISOString() }].slice(-10);
    p.stan = 'trwa'; p.do = null;
    trwajace.add(p.id);
    try { await zapisz(p); } catch (e) { trwajace.delete(p.id); throw e; }
    nadaj('Stado', `„${p.nazwa}" wraca na warsztat: ${rund(p.rundy - p.runda)} doskonalenia${p.petla ? `, pętla kreatywna ×${p.petla}` : ''}${tresc ? ` — z uwagami (${p.uwagi.at(-1).zrodlo})` : ''}`, { projekt: p.id });
    pracuj(p, { kontynuacja: true }).catch(() => {}).finally(() => trwajace.delete(p.id));
    return skrot(p);
}

/** Dla sondażu Nocnej Zmiany: „trwa" dopóki stado pracuje, potem stan i ocena. */
export async function sondaz(id) {
    const p = await projekt(id);
    if (!p) return null;
    const ocena = (p.oceny ?? []).at(-1)?.ocena ?? null;
    return {
        stan: p.stan === 'trwa' ? 'trwa' : p.stan === 'blad' || p.stan === 'przerwany' ? 'blad' : 'gotowe',
        blad: p.stan === 'przerwany' ? 'przerwany restartem mostu' : p.stan === 'blad' ? 'żaden krok nie wyszedł' : undefined,
        podsumowanie: `${p.nazwa}: runda ${p.runda ?? 1}/${p.rundy ?? 1}, ${p.kroki.filter((k) => k.stan === 'gotowe').length}/${p.kroki.length} wkładów${ocena != null ? `, zgodność ${ocena}/10` : ''}`,
    };
}

/**
 * Wkłady → zlecenia modułów. Gotowe zlecenia zostają; reszta (nowe, błędne, przerwane) idzie do kolejki.
 * Zwraca, ile weszło do kolejki; na wyniki czekaj szyną albo `projekt(id)`.
 */
/** XP za oddaną pracę — przez most (Stado.nagrodz), raz na klucz; błąd nagrody nie psuje projektu. */
const XP = { wklad: 25, biblia: 40, zlecenie: 15 };
async function nagrodz(agent, imie, rodzaj, klucz, powod, projektId) {
    if (!cfg.nagroda) return;
    try {
        const w = await cfg.nagroda({ id: agent, xp: XP[rodzaj], klucz, powod });
        if (w?.przyznane) nadaj(imie, `+${XP[rodzaj]} XP za ${powod} (razem ${w.xp})`, { projekt: projektId });
    } catch { /* bez XP, praca i tak zapisana */ }
}

async function zlecWszystko(p) {
    const stare = new Map((p.zlecenia ?? []).map((z) => [`${z.modul}:${z.opis.toLowerCase()}`, z]));
    p.zlecenia = ZleceniaStada.wyciagnij(p.kroki).map((z) => {
        const s = stare.get(`${z.modul}:${z.opis.toLowerCase()}`);
        return s?.stan === 'gotowe' ? s : z;
    });
    const doZrobienia = p.zlecenia.filter((z) => z.stan !== 'gotowe');
    for (const z of doZrobienia) { z.stan = 'czeka'; z.blad = null; aktywne.add(`${p.id}/${z.id}`); }
    await zapisz(p);
    if (doZrobienia.length) {
        const ile = Object.entries(ZleceniaStada.MODULY).map(([m, o]) => [o, doZrobienia.filter((z) => z.modul === m).length]).filter(([, n]) => n);
        nadaj('Stado', `„${p.nazwa}" zleca moduły Katedry: ${ile.map(([o, n]) => `${o.ikona} ${o.nazwa} ×${n}`).join(', ')}`, { projekt: p.id });
    }
    for (const z of doZrobienia) {
        ogon = ogon.then(() => wykonajZlecenie(p, z)).catch(() => {});
    }
    return doZrobienia.length;
}

async function wykonajZlecenie(p, z) {
    const m = ZleceniaStada.MODULY[z.modul];
    z.stan = 'trwa'; z.od = new Date().toISOString();
    await zapisz(p);
    nadaj(z.imie, `${m.ikona} zleca ${m.nazwa}: „${z.opis.slice(0, 80)}" (${p.nazwa})`, { projekt: p.id });
    try {
        z.wynik = await ZleceniaStada.wykonaj(z, { most: cfg.most, projekt: p, odstepMs: cfg.odstepMs, limityMs: cfg.limityMs });
        z.stan = 'gotowe';
        nadaj(z.imie, `${m.ikona} ${m.nazwa} oddał „${z.opis.slice(0, 80)}" (${p.nazwa})`, { projekt: p.id });
        await nagrodz(z.agent, z.imie, 'zlecenie', `zlecenie:${p.id}:${z.id}`, `${m.nazwa}: „${z.opis.slice(0, 60)}"`, p.id);
    } catch (e) {
        z.stan = 'blad'; z.blad = String(e.message || e).slice(0, 300);
        nadaj(z.imie, `${m.ikona} ${m.nazwa} nie zrobił „${z.opis.slice(0, 60)}": ${z.blad}`, { projekt: p.id });
    } finally {
        z.do = new Date().toISOString();
        aktywne.delete(`${p.id}/${z.id}`);
        await zapisz(p).catch(() => {});
    }
}

/** Ręcznie: zleć (albo ponów) moduły z wkładów projektu — np. po restarcie mostu albo gdy ComfyUI spało. */
export async function zlec(id) {
    if (!cfg.most) throw new Error('Most nie podpiął modułów — nie ma komu zlecać.');
    const p = await projekt(id);
    if (!p) throw new Error('Nie ma takiego projektu.');
    if (trwajace.has(p.id)) throw new Error('Stado jeszcze pisze — moduły ruszą same, gdy skończy.');
    if ((p.zlecenia ?? []).some((z) => aktywne.has(`${p.id}/${z.id}`))) throw new Error('Zlecenia tego projektu już są w kolejce.');
    const ile = await zlecWszystko(p);
    return { ile, zlecenia: p.zlecenia };
}

/** Obiekty do wyrzeźbienia z wkładu Palety: linie „OBIEKT: …". */
export function obiekty3d(wklad) {
    return [...String(wklad ?? '').matchAll(/^\s*[-*•]?\s*OBIEKT\s*:\s*(.+)$/gim)].map((m) => m[1].trim()).filter(Boolean).slice(0, 6);
}

export default { skonfiguruj, ROLE, KODEKS_Z_PIONKIEM, POZA_SKLADEM, zaplanuj, zaloz, zlec, kontynuuj, sondaz, czytajOcene, projekt, lista, skrot, obiekty3d, MAX_RUND, MAX_PETLI, CEL_OCENY };
