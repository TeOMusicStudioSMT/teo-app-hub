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
    kodeks: { fala: 2, zadanie: 'Gra: gatunek, pętla rozgrywki, 3 mechaniki wynikające ze świata, pierwszy poziom — skrót dokumentu gry.' },
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
    let p;
    try { p = JSON.parse(await fs.readFile(plik(id), 'utf8')); } catch { return null; }
    // Po restarcie mostu praca z pliku nie wraca sama — mówimy „przerwane", a nie udajemy, że trwa.
    if (p.stan === 'trwa' && !trwajace.has(p.id)) p.stan = 'przerwany';
    for (const z of p.zlecenia ?? []) if ((z.stan === 'czeka' || z.stan === 'trwa') && !aktywne.has(`${p.id}/${z.id}`)) z.stan = 'przerwane';
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
        kroki: p.kroki.map(({ agent, imie, zadanie, model, stan, fala }) => ({ agent, imie, zadanie, model, stan, fala })),
        gotowe: p.kroki.filter((k) => k.stan === 'gotowe').length, razem: p.kroki.length,
        zlecenia: (p.zlecenia ?? []).map(({ id, modul, agent, imie, opis, stan }) => ({ id, modul, agent, imie, opis, stan })),
    };
}

const nadaj = (agent, tresc, dane) => cfg.szyna?.nadaj?.({ agent, rodzaj: 'projekt', tresc, dane })?.catch?.(() => {});

/** Plan: kto, w jakiej fali, z jakim zadaniem — plus scalenie na końcu. */
export function zaplanuj(uczestnicy) {
    const kroki = uczestnicy.map((u) => {
        const r = ROLE[u.id] ?? { fala: 2, zadanie: `Wkład z Twojej dziedziny (${u.dziedzina || 'Twoja specjalność'}) do tego projektu — konkretny i spójny z resztą.` };
        return { agent: u.id, imie: u.imie, fala: r.fala, zadanie: r.zadanie };
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
export async function zaloz({ nazwa, wizja, uczestnicy, samoZlecanie = true, zalozyl = null }) {
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
        kroki: await Promise.all(zaplanuj(lista2).map(async (k) => ({
            ...k, model: (await cfg.modelDla(k.agent).catch(() => null)) || cfg.domyslnyModel, stan: 'czeka', wklad: null,
        }))),
    };
    trwajace.add(id);   // przed zapisem — inaczej czytelnik zobaczyłby „trwa" bez pracy i uznał za przerwany
    try { await zapisz(p); } catch (e) { trwajace.delete(id); throw e; }
    nadaj('Stado', `nowy wspólny projekt „${n}" — ${lista2.map((u) => u.imie).join(', ')}${p.zalozyl ? ` (zlecony z urządzenia „${p.zalozyl}")` : ''}`, { projekt: id });
    pracuj(p).catch(() => {}).finally(() => trwajace.delete(id));
    return skrot(p);
}

async function pracuj(p) {
    for (const k of p.kroki) {
        k.stan = 'trwa'; k.od = new Date().toISOString();
        await zapisz(p);
        nadaj(k.imie, `pracuje nad „${p.nazwa}": ${k.zadanie.split(':')[0]}`, { projekt: p.id });
        try {
            const karta = await cfg.karta(k.agent).catch(() => null);
            const poprzednie = p.kroki.filter((x) => x.stan === 'gotowe' && x.wklad);
            const system = `${karta?.tresc ?? `Jesteś ${k.imie} — TeOgochi Katedry OtakOS.`}

PRACUJESZ W ZESPOLE. Stado TeOgochi robi razem jeden projekt Suwerena; każdy wnosi to, co umie najlepiej.
Opieraj się na wkładach kolegów, nie przecz im. Piszesz po polsku, konkretnie, bez wstępów i bez markdownowych nagłówków.
${k.synteza ? 'Jesteś SCALACZEM: masz przed sobą wszystkie wkłady — złóż z nich jedną całość (do 450 słów).' : 'Twój wkład: do 250 słów.'}`;
            const user = `PROJEKT: ${p.nazwa}
WIZJA SUWERENA:
${p.wizja}

${poprzednie.length ? `WKŁADY ZESPOŁU DO TEJ PORY:\n${poprzednie.map((x) => `— ${x.imie}: ${x.wklad.slice(0, k.synteza ? 1800 : 1200)}`).join('\n\n')}` : 'Jesteś pierwszy — kładziesz fundament.'}

TWOJE ZADANIE (${k.imie}):
${k.zadanie}`;
            const tekst = String(await cfg.chat(k.model, [{ role: 'system', content: system }, { role: 'user', content: user }]) ?? '').trim();
            if (!tekst) throw new Error('model oddał pustą odpowiedź');
            k.wklad = tekst.slice(0, MAX_WKLADU);
            k.stan = 'gotowe';
            nadaj(k.imie, `oddał${k.synteza ? ' Biblię projektu' : ' wkład do'} „${p.nazwa}"`, { projekt: p.id });
        } catch (e) {
            k.stan = 'blad'; k.blad = String(e.message || e).slice(0, 300);
            nadaj(k.imie, `nie dał rady w „${p.nazwa}": ${k.blad}`, { projekt: p.id });
        }
        k.do = new Date().toISOString();
        await zapisz(p);
    }
    const bledy = p.kroki.filter((k) => k.stan === 'blad').length;
    p.stan = bledy === p.kroki.length ? 'blad' : bledy ? 'czesciowo' : 'gotowe';
    p.do = new Date().toISOString();
    await zapisz(p);
    nadaj('Stado', `projekt „${p.nazwa}" ${p.stan === 'gotowe' ? 'skończony' : p.stan === 'czesciowo' ? `skończony z ${bledy} brakami` : 'nie powiódł się'}`, { projekt: p.id });
    if (p.samoZlecanie && cfg.most) await zlecWszystko(p);
}

/**
 * Wkłady → zlecenia modułów. Gotowe zlecenia zostają; reszta (nowe, błędne, przerwane) idzie do kolejki.
 * Zwraca, ile weszło do kolejki; na wyniki czekaj szyną albo `projekt(id)`.
 */
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

export default { skonfiguruj, ROLE, zaplanuj, zaloz, zlec, projekt, lista, skrot, obiekty3d };
