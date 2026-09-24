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
 * UCZCIWIE: wkład to TEKST (koncepcja, scenopis, opis kolekcji, lista merchu). Prawdziwe
 * pliki — muzyka, bryły 3D, wideo — robią moduły Katedry, gdy Suweren je zleci (np. obiekty
 * Palety „OBIEKT: …" można wyrzeźbić w Assety3D jednym przyciskiem w Świecie).
 * Jeden projekt naraz — lokalna karta graficzna jest jedna.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

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
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

/**
 * Co kto wnosi. `fala`: 1 = fundament, 2 = dziedziny, 3 = to, co wymaga całości.
 * Gatunek spoza tabeli dostaje zadanie ogólne ze swojej dziedziny (fala 2).
 */
export const ROLE = {
    rezyser: { fala: 1, zadanie: 'Fabuła i bohaterowie: logline (1 zdanie), 3–5 postaci (imię, cel, sekret), świat i jego zasady, główny konflikt.' },
    kronikarz: { fala: 1, zadanie: 'Kronika założycielska: mit powstania tego świata, ton opowieści, 5 kluczowych nazw własnych z krótkim wyjaśnieniem.' },
    klatka: { fala: 2, zadanie: 'Scenopis zwiastunu 60 s: 6–8 ujęć (plan, ruch kamery, co widać, dźwięk), zbudowany na bohaterach i konflikcie.' },
    joanna: { fala: 2, zadanie: 'Muzyka: motyw przewodni (nastrój, BPM, tonacja, instrumenty) jako gotowy prompt do generatora muzyki + tekst refrenu.' },
    kodeks: { fala: 2, zadanie: 'Gra: gatunek, pętla rozgrywki, 3 mechaniki wynikające ze świata, pierwszy poziom — skrót dokumentu gry.' },
    krawcowa: { fala: 2, zadanie: 'Moda: kolekcja 4 strojów bohaterów (krój, materiał, kolory, detal), spójna ze światem.' },
    paleta: { fala: 2, zadanie: 'Styl wizualny: paleta 5 barw (hex) z uzasadnieniem i 3 obiekty do wyrzeźbienia w 3D — każdy w osobnej linii zaczynającej się od „OBIEKT:" i jednym zdaniem opisu dla generatora brył.' },
    glosek: { fala: 2, zadanie: 'Głosy: obsada głosowa postaci (barwa, tempo, maniera) i 3 kwestie próbne.' },
    spawacz: { fala: 2, zadanie: 'Warsztat: łańcuch produkcji — które moduły Katedry (muzyka, obraz, wideo, 3D, gra) i w jakiej kolejności zrobią pliki tego projektu.' },
    kupiec: { fala: 3, zadanie: 'Merchandising: 5 produktów z tego uniwersum (co to, dla kogo, cena w GRV) — tylko z tego, co zespół już wymyślił.' },
    bilans: { fala: 3, zadanie: 'Plan i budżet: co zrobić najpierw, szacunek czasu pracy karty graficznej, 3 ryzyka.' },
    wektor: { fala: 3, zadanie: 'Spójność: wypisz sprzeczności między wkładami zespołu i zaproponuj, jak je rozwiązać.' },
    straznik: { fala: 3, zadanie: 'Bezpieczeństwo i prawa: co w projekcie może naruszać cudze prawa albo prywatność i jak tego uniknąć.' },
};

const MAX_UCZESTNIKOW = 12;
const MAX_WKLADU = 4000;
const ID = /^[a-z0-9-]{2,40}$/;
const trwajace = new Set();

const plik = (id) => path.join(cfg.katalog, `${id}.json`);
async function zapisz(p) {
    await fs.mkdir(cfg.katalog, { recursive: true });
    const tmp = `${plik(p.id)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(p, null, 2), 'utf8');
    await fs.rename(tmp, plik(p.id));
}
export async function projekt(id) {
    if (!ID.test(String(id))) return null;
    try { return JSON.parse(await fs.readFile(plik(id), 'utf8')); } catch { return null; }
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
        id: p.id, nazwa: p.nazwa, wizja: p.wizja.slice(0, 300), stan: p.stan, od: p.od, do: p.do ?? null,
        kroki: p.kroki.map(({ agent, imie, zadanie, model, stan, fala }) => ({ agent, imie, zadanie, model, stan, fala })),
        gotowe: p.kroki.filter((k) => k.stan === 'gotowe').length, razem: p.kroki.length,
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
export async function zaloz({ nazwa, wizja, uczestnicy }) {
    const n = String(nazwa ?? '').trim().slice(0, 80);
    const w = String(wizja ?? '').trim().slice(0, 3000);
    if (!n) throw new Error('Nadaj projektowi nazwę.');
    if (w.length < 10) throw new Error('Opisz wizję choć jednym zdaniem.');
    const lista2 = (uczestnicy ?? []).filter((u) => u && ID.test(String(u.id))).slice(0, MAX_UCZESTNIKOW);
    if (lista2.length < 2) throw new Error('Wspólny projekt potrzebuje co najmniej dwóch TeOgochi.');
    if (trwajace.size) throw new Error('Stado pracuje już nad innym projektem — jedna karta graficzna, jeden projekt naraz.');

    const id = `${n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'projekt'}-${crypto.randomBytes(2).toString('hex')}`;
    const p = {
        id, nazwa: n, wizja: w, stan: 'trwa', od: new Date().toISOString(),
        kroki: await Promise.all(zaplanuj(lista2).map(async (k) => ({
            ...k, model: (await cfg.modelDla(k.agent).catch(() => null)) || cfg.domyslnyModel, stan: 'czeka', wklad: null,
        }))),
    };
    await zapisz(p);
    trwajace.add(id);
    nadaj('Stado', `nowy wspólny projekt „${n}" — ${lista2.map((u) => u.imie).join(', ')}`, { projekt: id });
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
}

/** Obiekty do wyrzeźbienia z wkładu Palety: linie „OBIEKT: …". */
export function obiekty3d(wklad) {
    return [...String(wklad ?? '').matchAll(/^\s*[-*•]?\s*OBIEKT\s*:\s*(.+)$/gim)].map((m) => m[1].trim()).filter(Boolean).slice(0, 6);
}

export default { skonfiguruj, ROLE, zaplanuj, zaloz, projekt, lista, skrot, obiekty3d };
