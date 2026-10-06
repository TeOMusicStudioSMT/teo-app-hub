/**
 * 🪑 Stół ratyfikacji — propozycje dla stada, o których decyduje Suweren (Hub albo StoL na telefonie).
 *
 * Suweren (2026-09-27): „rozmowa z Podcast Twin… chciałbym teraz zlecić na StoL… w apce jest Stół,
 * ale jako atrapa to bez sensu" → wybrał „Stół ratyfikacji": karta propozycji ląduje na stole,
 * Suweren przyjmuje ją jako Projekt Stada, a moduły (produkty, muzyka, 3D, wideo) ruszają dopiero
 * po jego RATYFIKACJI gotowej Biblii projektu.
 *
 *   ETAP KARTY (liczony z faktów, nie zapisywany na zapas):
 *     na_stole      — czeka na decyzję: przyjąć (→ Projekt Stada) albo odrzucić,
 *     opracowuje    — stado pisze wkłady (projekt „trwa"),
 *     do_akceptacji — Biblia gotowa; Suweren ratyfikuje → zlecenia modułów,
 *     zratyfikowane — moduły zlecone (ProjektStada.zlec),
 *     utknela       — projekt padł albo przerwał go restart mostu; można przyjąć od nowa,
 *     odrzucona.
 *
 * ⚠️ PROJEKT ZE STOŁU NIE ZLECA SAM MODUŁÓW (samoZlecanie: false). Ratyfikacja to prawdziwa brama —
 * bez niej karta graficzna i Marketplace nie ruszają. Zapisy stol.json idą po kolei (jak Stado.js).
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { rund } from './ProjektStada.js';

let cfg = {
    plik: path.join(process.cwd(), '_OtakOs_Wymiar', 'stol.json'),
    szyna: null,
    /** id → pełny projekt stada albo null */
    projekt: async () => null,
    /** ({ nazwa, wizja, uczestnicy, samoZlecanie, zalozyl }) → skrót projektu */
    zaloz: async () => { throw new Error('Most nie podpiął Projektu Stada.'); },
    /** id projektu → { ile, zlecenia } */
    zlec: async () => { throw new Error('Most nie podpiął zleceń modułów.'); },
    /** (id projektu, { rundy, petla, uwagi, zrodloUwag }) → kolejne rundy doskonalenia (ProjektStada.kontynuuj) */
    doskonal: async () => { throw new Error('Most nie podpiął rund doskonalenia.'); },
    /** ({ projektStada, rundy, petla, powtorzenia }) → zadanie Nocnej Zmiany (NocnaZmiana.dodaj) */
    nocna: async () => { throw new Error('Most nie podpiął Nocnej Zmiany.'); },
    /** → { wlaczona, zadania } — stan Nocnej Zmiany, żeby karta pokazała, co czeka na noc */
    nocnaStan: async () => ({ wlaczona: false, zadania: [] }),
    /** (imiona albo id) → [{ id, imie, dziedzina }] spośród wyklutych; pusta lista = wszyscy wykluci */
    uczestnicy: async () => [],
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

export const ZRODLA = { 'podcast-twin': '🎙️ Podcast Twin', koom: '📖 Księga KOOM', plik: '📄 Plik', telefon: '📱 Telefon', hub: '🏛️ Katedra' };
const MAX_TRESCI = 20_000;
const MAX_KART = 200;

let ogon = Promise.resolve();
const poKolei = (fn) => { const w = ogon.then(fn, fn); ogon = w.catch(() => {}); return w; };

async function czytaj() {
    try { const d = JSON.parse(await fs.readFile(cfg.plik, 'utf8')); return { karty: Array.isArray(d.karty) ? d.karty : [] }; }
    catch { return { karty: [] }; }
}
async function zapisz(d) {
    await fs.mkdir(path.dirname(cfg.plik), { recursive: true });
    const tmp = `${cfg.plik}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(d, null, 2), 'utf8');
    await fs.rename(tmp, cfg.plik);
}
const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Stół', rodzaj: 'stol', tresc })?.catch?.(() => {});

/**
 * Z tekstu karty (np. „KARTA DLA STOŁU" z rozmowy) wyciąga wizję i sugerowanych uczestników.
 * Bez takich sekcji: wizja = początek treści, uczestników wybierze Suweren (albo cały stado).
 */
export function czytajKarte(tresc) {
    const t = String(tresc ?? '').replace(/\r/g, '');
    const sekcja = (naglowek) => {
        const m = t.match(new RegExp(`^${naglowek}[^\\n:]*:\\s*([\\s\\S]*?)(?=\\n\\s*\\n|\\n[A-ZŻŹĆĄŚĘŁÓŃ][^\\n]{0,40}:|(?![\\s\\S]))`, 'm'));
        return m ? m[1].replace(/\s+/g, ' ').trim() : '';
    };
    const wizja = sekcja('Wizja');
    const uczestnicy = sekcja('Uczestnicy')
        .split(/,\s*(?![^()]*\))/).map((x) => x.replace(/\(.*?\)/g, '').replace(/[.;\s]+$/, '').trim()).filter((x) => /^[\p{L}][\p{L}\s-]{1,30}$/u.test(x));
    return { wizja: (wizja || t.replace(/\s+/g, ' ').trim()).slice(0, 3000), uczestnicy };
}

/** Etap karty z jej stanu i z projektu stada (fakty, nie pamięć karty). */
export function etap(karta, projekt) {
    if (karta.stan === 'odrzucona') return 'odrzucona';
    if (karta.stan === 'na_stole' || !karta.projekt) return 'na_stole';
    if (karta.stan === 'zratyfikowana') return 'zratyfikowane';
    if (!projekt || projekt.stan === 'blad' || projekt.stan === 'przerwany') return 'utknela';
    if (projekt.stan === 'trwa') return 'opracowuje';
    return 'do_akceptacji';   // gotowe albo czesciowo — Biblia (albo jej część) czeka na Suwerena
}

export function dodaj({ tytul, tresc, zrodlo = 'hub', zalozyl = null }) {
    return poKolei(async () => {
        const nazwa = String(tytul ?? '').trim().slice(0, 80);
        const t = String(tresc ?? '').trim();
        if (!nazwa) throw new Error('Karta potrzebuje tytułu.');
        if (t.length < 10) throw new Error('Karta jest pusta — połóż na stół treść propozycji.');
        const { wizja, uczestnicy } = czytajKarte(t);
        const d = await czytaj();
        const karta = {
            id: `k-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
            tytul: nazwa, tresc: t.slice(0, MAX_TRESCI), wizja, sugerowani: uczestnicy,
            zrodlo: ZRODLA[zrodlo] ? zrodlo : 'hub', zalozyl: zalozyl ? String(zalozyl).slice(0, 60) : null,
            stan: 'na_stole', projekt: null, od: new Date().toISOString(), decyzje: [],
        };
        d.karty.unshift(karta);
        d.karty = d.karty.slice(0, MAX_KART);
        await zapisz(d);
        nadaj(`na stół trafiła propozycja „${nazwa}" (${ZRODLA[karta.zrodlo]})`);
        return karta;
    });
}

/** Karty z etapem i skrótem projektu; `pelne` = z treścią (dla jednej karty). */
export async function lista({ pelne = false } = {}) {
    const d = await czytaj();
    const out = [];
    const nocna = await cfg.nocnaStan().catch(() => ({ wlaczona: false, zadania: [] }));
    for (const k of d.karty) {
        const p = k.projekt ? await cfg.projekt(k.projekt).catch(() => null) : null;
        out.push({
            ...(pelne ? k : { ...k, tresc: k.tresc.slice(0, 600) }),
            etap: etap(k, p),
            projektSkrot: p ? {
                id: p.id, stan: p.stan, gotowe: p.kroki.filter((x) => x.stan === 'gotowe').length, razem: p.kroki.length,
                biblia: (p.kroki.find((x) => x.synteza && x.stan === 'gotowe')?.wklad ?? '').slice(0, pelne ? 4000 : 400),
                zlecenia: (p.zlecenia ?? []).map(({ modul, opis, stan }) => ({ modul, opis, stan })),
                // Rundy doskonalenia: która teraz, ile w planie, oceny Sędziego (zgodność z wizją 0–10) i braki ostatniej.
                runda: p.runda ?? 1, rundy: p.rundy ?? 1, petla: p.petla ?? 0,
                oceny: (p.oceny ?? []).map(({ runda, ocena }) => ({ runda, ocena })),
                braki: (p.oceny ?? []).at(-1)?.braki ?? [],
            } : null,
            // Rundy tego projektu zaplanowane na Nocną Zmianę (robota projekt-stada-rundy) — i czy Zmiana w ogóle jest włączona.
            nocna: k.projekt ? {
                wlaczona: !!nocna.wlaczona,
                zadania: (nocna.zadania ?? []).filter((z) => z.rodzaj === 'projekt-stada-rundy' && z.parametry?.projektStada === k.projekt && z.stan !== 'gotowe')
                    .map((z) => ({ id: z.id, stan: z.stan, wykonane: z.wykonane ?? 0, powtorzenia: z.powtorzenia ?? 1, rundy: Number(z.parametry?.rundy) || 1, blad: z.blad ?? null })),
            } : null,
        });
    }
    return out;
}
export async function karta(id) { return (await lista({ pelne: true })).find((k) => k.id === id) ?? null; }

async function zmien(id, fn) {
    return poKolei(async () => {
        const d = await czytaj();
        const k = d.karty.find((x) => x.id === id);
        if (!k) throw new Error('Nie ma takiej karty na stole.');
        const p = k.projekt ? await cfg.projekt(k.projekt).catch(() => null) : null;
        const wynik = await fn(k, etap(k, p));
        await zapisz(d);
        return wynik ?? k;
    });
}
const zapiszDecyzje = (k, co, kto) => { (k.decyzje ||= []).push({ co, kto: kto || 'Katedra', kiedy: new Date().toISOString() }); };

/**
 * Przyjmij → Projekt Stada (bez samoZlecania). Uczestnicy: podani (id) → sugerowani z karty → całe wyklute stado.
 * `rundy` (1–5) i `petla` (0–3): rundy doskonalenia i pętla kreatywna na każdym punkcie planu (ProjektStada).
 * `dyrygent` (domyślnie tak — Suweren 2026-10-06: „niech dobiera jako pierwszy na stole”): Dyrygent dobiera modele
 * do kroków projektu, zanim stado ruszy; gdy zawiedzie, każdy gra na swoim.
 */
export function przyjmij(id, { uczestnicy = [], kto = null, rundy = 1, petla = 0, dyrygent = true } = {}) {
    return zmien(id, async (k, e) => {
        if (!['na_stole', 'utknela'].includes(e)) throw new Error(`Karta jest na etapie „${e}" — nie ma czego przyjmować.`);
        let osoby = await cfg.uczestnicy(uczestnicy.length ? uczestnicy : k.sugerowani ?? []);
        if (osoby.length < 2) osoby = await cfg.uczestnicy([]);
        const p = await cfg.zaloz({ nazwa: k.tytul, wizja: k.wizja, uczestnicy: osoby, samoZlecanie: false, zalozyl: kto, rundy, petla, dyrygent });
        k.stan = 'przyjeta'; k.projekt = p.id;
        zapiszDecyzje(k, 'przyjeta', kto);
        nadaj(`Suweren przyjął „${k.tytul}" — stado zaczyna pracę (${osoby.map((o) => o.imie).join(', ')})${p.rundy > 1 ? `, ${rund(p.rundy)} doskonalenia` : ''}${p.petla ? `, pętla kreatywna ×${p.petla}` : ''}`);
        return { karta: k, projekt: p };
    });
}

export function odrzuc(id, { kto = null } = {}) {
    return zmien(id, async (k, e) => {
        if (['opracowuje', 'zratyfikowane'].includes(e)) throw new Error(`Karta jest na etapie „${e}" — nie odrzucę jej teraz.`);
        k.stan = 'odrzucona';
        zapiszDecyzje(k, 'odrzucona', kto);
        nadaj(`Suweren odłożył „${k.tytul}" ze stołu`);
    });
}

/** Ratyfikacja gotowej Biblii → zlecenia modułów z wkładów (produkty, muzyka, 3D, wideo). */
export function ratyfikuj(id, { kto = null } = {}) {
    return zmien(id, async (k, e) => {
        if (e !== 'do_akceptacji') throw new Error(`Ratyfikować można gotowy projekt — ta karta jest na etapie „${e}".`);
        const z = await cfg.zlec(k.projekt);
        k.stan = 'zratyfikowana';
        zapiszDecyzje(k, 'zratyfikowana', kto);
        nadaj(`Suweren zratyfikował „${k.tytul}" — ${z?.ile ? `stado zleca ${z.ile} zadań modułom Katedry` : 'wkłady nie miały zleceń dla modułów'}`);
        return { karta: k, zlecenia: z?.ile ?? 0 };
    });
}

/** Etapy, na których projekt karty jest skończony i można go dalej doskonalić. */
const GOTOWY = ['do_akceptacji', 'zratyfikowane'];

/**
 * Doskonal: Biblia jeszcze nie spełnia wizji → stado robi kolejne rundy (na brakach Sędziego i uwagach
 * Suwerena), karta wraca do „opracowuje", a potem znów do akceptacji. Także po ratyfikacji — wtedy
 * karta czeka na NOWĄ ratyfikację (zlecenia już oddane zostają, nowe linie zlecą się po niej).
 */
export function doskonal(id, { rundy = 1, petla, uwagi, zrodloUwag, kto = null } = {}) {
    return zmien(id, async (k, e) => {
        if (!GOTOWY.includes(e)) throw new Error(`Doskonalić można gotowy projekt — ta karta jest na etapie „${e}".`);
        const p = await cfg.doskonal(k.projekt, { rundy, petla, uwagi, zrodloUwag: zrodloUwag ?? (kto && kto !== 'Katedra' ? `z telefonu „${kto}"` : 'Suweren') });
        if (k.stan === 'zratyfikowana') k.stan = 'przyjeta';
        zapiszDecyzje(k, 'doskonalona', kto);
        nadaj(`Suweren odesłał „${k.tytul}" do doskonalenia — ${rund(p.rundy - p.runda)}${p.petla ? `, pętla kreatywna ×${p.petla}` : ''}`);
        return { karta: k, projekt: p };
    });
}

/**
 * Na Nocną Zmianę: rundy doskonalenia tego projektu ×N, gdy Suweren śpi (bramy: bezczynność, karta, RAM).
 * Z telefonu można zaplanować — włączyć samą Zmianę można tylko przy Katedrze.
 */
export function naNoc(id, { rundy = 1, petla, powtorzenia = 1, kto = null } = {}) {
    return zmien(id, async (k, e) => {
        if (!k.projekt || ![...GOTOWY, 'opracowuje'].includes(e)) throw new Error(`Na noc można dać projekt, nad którym stado już pracowało — ta karta jest na etapie „${e}".`);
        const parametry = { projektStada: k.projekt, rundy };
        if (petla !== undefined && petla !== null && petla !== '') parametry.petla = petla;
        const zadanie = await cfg.nocna({ parametry, powtorzenia, notatka: `Stół: „${k.tytul}"${kto ? ` (${kto})` : ''}` });
        const { wlaczona } = await cfg.nocnaStan().catch(() => ({ wlaczona: false }));
        zapiszDecyzje(k, 'na_noc', kto);
        nadaj(`„${k.tytul}" idzie na Nocną Zmianę: ${zadanie.powtorzenia} × ${rund(Number(rundy) || 1)}${wlaczona ? '' : ' (Zmiana jest WYŁĄCZONA — ruszy po włączeniu w Katedrze)'}`);
        return { karta: k, zadanie, wlaczona };
    });
}

export default { skonfiguruj, dodaj, lista, karta, przyjmij, odrzuc, ratyfikuj, doskonal, naNoc, etap, czytajKarte, ZRODLA };
