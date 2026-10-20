/**
 * 🧬 Harness² po katedralnemu (Suweren 2026-10-20, po lekturze google-research/harness2, Apache 2.0): bierzemy METODĘ,
 * nie instalujemy oryginału (Linux + Vertex AI + benchmarki). UPRZĄŻ = wszystko wokół modelu przy stałych wagach.
 *
 * Części uprzęży TeOgochi w Katedrze (tylko odczyt — kodu i kart rdzenia nie zmieniamy): karta persony
 * (`services/persony/<id>.md`, temperament prowadzących z GolDnia.NARRATORZY), żelazne zasady zadania z kodu serwisu
 * (np. `ZebrraNews.promptScenariusza`), skille (`TeO_Skille`), przydział modelu (`ModeleAgentow` — decyzja Dyrygenta),
 * zasady stylu Suwerena (JaJo Mistrza). Nowa wersja uprzęży to NADPISANIE — lista zmian z zamkniętych rodzajów
 * (`RODZAJE`), dokładana jako blok tekstu nad zasadami zadania.
 *
 * PROPOSE–PROBE–COMPOSE na prawdziwym zadaniu i TYM SAMYM materiale: (1) wykonanie bazowe (aktywna uprząż albo goła),
 * (2) model proponuje k zmian uprzęży z powodem, (3) każda wersja robi to samo zadanie, (4) sędzia: najpierw twarde
 * sprawdziany zadania (format, liczby, źródła…), potem kontrast Jev (`noul` na puentę każdego newsa + `choice` najlepszej
 * wersji) — bez klucza model lokalny jako sędzia porównawczy (adnotacja `sedzia.uwaga`), (5) compose = zmiany, które
 * pobiły bazę; ≥ 2 zwycięzców → złożona wersja jest jeszcze raz wypróbowana i musi pobić najlepszego pojedynczego.
 * Sekwencyjnie głębiej: `glebokosc` rund, każda od uprzęży wybranej w poprzedniej. Bez wzorcowych odpowiedzi.
 *
 * ZESZYT (`_OtakOs_Wymiar/uprzaz/`): `uprzeze.json` (wersje: proponowana / aktywna / odrzucona / wycofana),
 * `przebiegi/p-<8 hex>.json` (dowody: wersje, wyniki sędziów), `lekcje.jsonl` (każda zmiana: pomogła / zaszkodziła /
 * bez zmian, delta, id przebiegu i wersji). Lekcje wracają do następnego Propose — trwała „improvement harness”.
 * Uprząż wchodzi do użytku DOPIERO po ✓ Suwerena (`przyjmij`); ✓/✖ idą do JaJa Mistrza jako decyzje, propozycja
 * jako wieść kanałem Mistrza. UCZCIWIE: jedna próba na wersję — losowość modelu bywa większa niż różnica uprzęży;
 * dlatego próg `MARGINES` i ponowny sprawdzian złożonej.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { NARRATORZY } from './GolDnia.js';
import { promptScenariusza, odczytajScenariusz, sprawdzLiczby, ZADANIE_UPRZEZY as ZADANIE_NEWS } from './ZebrraNews.js';

/** Zamknięte rodzaje zmian uprzęży (odpowiedniki części Harness²: guardrails, tool guidance, memory, skills…). */
export const RODZAJE = {
    zasada: 'guardrail — twarda zasada dopisana do zasad zadania',
    wskazowka: 'wskazówka wykonania — jak robić zadanie (kolejność, format, na co uważać)',
    persona: 'uwaga o głosie postaci — warstwa nad kartą persony, nie jej edycja',
    pamiec: 'lekcja z zeszytu wpisana jako pamięć (co już pomogło)',
    skill: 'skill z TeO_Skille — pole `ref` = id skilla z listy',
    styl: 'zasada stylu Suwerena z JaJa Mistrza — pole `ref` = numer zasady z listy',
};
const ETYKIETY = { zasada: 'ZASADA', wskazowka: 'WSKAZÓWKA', persona: 'GŁOS', pamiec: 'PAMIĘĆ', skill: 'UMIEJĘTNOŚĆ', styl: 'STYL SUWERENA' };
export const MAX_ZMIAN = 6, MAX_ZMIAN_KANDYDATA = 3, MAX_K = 3, MAX_GLEBOKOSC = 3;
/** O ile wynik wersji musi pobić bazę, żeby zmiana „pomogła” (szum jednej próby). */
export const MARGINES = 0.03;
const ID_U = /^u-[0-9a-f]{8}$/, ID_P = /^p-[0-9a-f]{8}$/;
const noweId = (p) => `${p}-${crypto.randomBytes(4).toString('hex')}`;
const tnij = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const klucz = (z) => `${z.rodzaj}|${z.ref ?? ''}|${tnij(z.tresc, 400).toLowerCase()}`;

/** Zmiana od modelu albo Suwerena → czysta zmiana albo błąd z powodem. `skille` [{id, opis}], `zasadyStylu` [tekst]. */
export function oczyscZmiane(z, { skille = [], zasadyStylu = [] } = {}) {
    const rodzaj = String(z?.rodzaj ?? '').toLowerCase().trim();
    if (!RODZAJE[rodzaj]) throw new Error(`nieznany rodzaj zmiany „${rodzaj}” (dozwolone: ${Object.keys(RODZAJE).join(', ')})`);
    const dlaczego = tnij(z?.dlaczego, 300);
    if (rodzaj === 'skill') {
        const s = skille.find((x) => x.id === String(z?.ref ?? '').trim());
        if (!s) throw new Error(`skill „${z?.ref}” nie istnieje w TeO_Skille`);
        return { rodzaj, ref: s.id, tresc: tnij(s.opis || s.id, 300), dlaczego };
    }
    if (rodzaj === 'styl') {
        const n = Number(String(z?.ref ?? '').replace(/[^\d]/g, ''));
        if (!(n >= 1 && n <= zasadyStylu.length)) throw new Error(`zasada stylu nr ${z?.ref} nie istnieje (JaJo ma ${zasadyStylu.length})`);
        return { rodzaj, ref: n, tresc: tnij(zasadyStylu[n - 1], 300), dlaczego };
    }
    const tresc = tnij(z?.tresc, 400);
    if (tresc.length < 8) throw new Error(`zmiana „${rodzaj}” bez treści`);
    return { rodzaj, ref: null, tresc, dlaczego };
}

/** Zmiany → blok tekstu doklejany do zasad zadania (to, co naprawdę widzi model). */
export function blokUprzezy(zmiany = []) {
    if (!zmiany.length) return '';
    return ['DODATKI UPRZĘŻY (obowiązują jak żelazne zasady):', ...zmiany.map((z) => `- ${ETYKIETY[z.rodzaj] ?? z.rodzaj.toUpperCase()}${z.rodzaj === 'skill' ? ` ${z.ref}` : ''}: ${z.tresc}`)].join('\n');
}

/** Złożenie: baza + zmiany zwycięzców, bez dubli, ≤ MAX_ZMIAN (wcześniejsze — z większym zyskiem — mają pierwszeństwo). */
export function zloz(baza = [], ...zestawy) {
    const out = [], byly = new Set();
    for (const z of [baza, ...zestawy].flat()) {
        const k = klucz(z);
        if (byly.has(k) || out.length >= MAX_ZMIAN) continue;
        byly.add(k); out.push(z);
    }
    return out;
}

// ─────────────────────────── PROPOSE ───────────────────────────

/** Prośba do ulepszacza: części uprzęży, wykonanie bazowe z ocenami sędziów, lekcje z zeszytu. */
export function promptPropozycji({ zadanie, czesci, baza, lekcje = [], k = 2, skille = [], zasadyStylu = [], bazowe = [] }) {
    const system = [
        'Jesteś ulepszaczem UPRZĘŻY (harness) TeOgochi w Katedrze OtakOS. Uprząż to wszystko wokół modelu: zasady, wskazówki, głos postaci, pamięć, skille — wagi modelu się nie zmieniają.',
        'Patrzysz, co poszło źle w wykonaniu zadania, i proponujesz MAŁE zmiany uprzęży, które to naprawią. Nie piszesz odpowiedzi na zadanie i nie podajesz wzorcowego wyniku.',
        'Zmiana musi być ogólna (zadziała też jutro na innych nagłówkach), krótka (jedno zdanie) i nie może dopisywać faktów ani liczb.',
        `Rodzaje zmian (pole "rodzaj"): ${Object.entries(RODZAJE).map(([r, o]) => `${r} = ${o}`).join('; ')}.`,
        'Odpowiadasz WYŁĄCZNIE jednym obiektem JSON.',
    ].join('\n');
    const user = [
        `ZADANIE: ${zadanie.nazwa} — ${zadanie.opis}`,
        `CZĘŚCI UPRZĘŻY (tylko odczyt):\n${czesci}`,
        bazowe.length ? `OBECNE DODATKI (już działają — nie powtarzaj):\n${blokUprzezy(bazowe)}` : 'OBECNE DODATKI: brak.',
        `WYKONANIE BAZOWE:\n${tnij(baza.tekst, 5000) || '(brak tekstu)'}`,
        `SĘDZIOWIE O WYKONANIU BAZOWYM:\n${baza.uwagi.length ? baza.uwagi.map((u) => `- ${u}`).join('\n') : '- brak twardych błędów'}`,
        lekcje.length ? `ZESZYT LEKCJI (dowody z poprzednich prób):\n${lekcje.map((l) => `- ${l.efekt === 'pomogla' ? '✓ pomogła' : l.efekt === 'zaszkodzila' ? '✗ zaszkodziła — NIE proponuj ponownie' : '· bez różnicy'} (${l.delta >= 0 ? '+' : ''}${l.delta.toFixed(2)}): [${l.zmiana.rodzaj}] ${l.zmiana.tresc}`).join('\n')}` : '',
        skille.length ? `SKILLE (ref dla rodzaju skill): ${skille.slice(0, 25).map((s) => s.id).join(', ')}` : '',
        zasadyStylu.length ? `ZASADY STYLU SUWERENA (ref = numer dla rodzaju styl):\n${zasadyStylu.map((z, i) => `${i + 1}. ${z}`).join('\n')}` : '',
        `Zaproponuj ${k} RÓŻNE wersje uprzęży (każda 1–${MAX_ZMIAN_KANDYDATA} zmian), każda celuje w inną wadę albo inną drogę naprawy.`,
        'FORMAT: {"kandydaci":[{"nazwa":"krótko","zmiany":[{"rodzaj":"zasada","tresc":"…","dlaczego":"jaka wada z wykonania","ref":null}]}]}',
    ].filter(Boolean).join('\n\n');
    return { system, user };
}

/** JSON ulepszacza → ≤ k kandydatów z czystymi zmianami (złe zmiany odpadają z powodem; zero kandydatów = błąd wprost). */
export function odczytajPropozycje(tekst, { k = 2, skille = [], zasadyStylu = [], bazowe = [] } = {}) {
    const bez = String(tekst ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
    const m = bez.match(/\{[\s\S]*\}/);
    let d;
    try { d = JSON.parse(m ? m[0] : bez); } catch { throw new Error(`ulepszacz nie oddał JSON-u: „${tnij(bez, 120)}”`); }
    const lista = Array.isArray(d?.kandydaci) ? d.kandydaci : Array.isArray(d) ? d : [];
    const juz = new Set(bazowe.map(klucz)), widziane = new Set(), odrzucone = [], out = [];
    for (const kand of lista) {
        const zmiany = [];
        for (const z of (Array.isArray(kand?.zmiany) ? kand.zmiany : []).slice(0, MAX_ZMIAN_KANDYDATA)) {
            try {
                const c = oczyscZmiane(z, { skille, zasadyStylu });
                if (juz.has(klucz(c))) { odrzucone.push(`już w uprzęży: ${c.tresc.slice(0, 60)}`); continue; }
                zmiany.push(c);
            } catch (e) { odrzucone.push(e.message); }
        }
        const podpis = zmiany.map(klucz).sort().join('§');
        if (!zmiany.length || widziane.has(podpis)) continue;
        widziane.add(podpis);
        out.push({ nazwa: tnij(kand?.nazwa, 60) || `wersja ${out.length + 1}`, zmiany });
        if (out.length >= k) break;
    }
    if (!out.length) throw new Error(`ulepszacz nie dał żadnej poprawnej zmiany${odrzucone.length ? ` (${odrzucone.slice(0, 3).join('; ')})` : ''}`);
    return { kandydaci: out, odrzucone };
}

// ─────────────────────────── ZADANIE: scenariusz Zebrra News ───────────────────────────

const LITERY = 'ABCDEFGH';
/** Najmocniejsze słowo nazwy redakcji („ABC News (Australia)” → ABC, „The Guardian” → Guardian). */
const rdzenZrodla = (z) => String(z ?? '').replace(/\(.*?\)/g, ' ').split(/\s+/).filter((w) => w.length >= 2 && !/^(the|news)$/i.test(w)).sort((a, b) => b.length - a.length)[0] ?? String(z ?? '');

/** Twarde sprawdziany scenariusza: format i liczby = warunek konieczny; źródła, bez markdownu, długość = punkty 0–1. */
export function twardeNews(tekst, s) {
    let sc;
    try { sc = odczytajScenariusz(tekst, s.newsy.length); } catch (e) { return { ok: false, punkty: 0, bledy: [e.message], sc: null }; }
    const bledy = [], liczby = sprawdzLiczby(sc, s);
    if (liczby) bledy.push(liczby);
    const miekkie = [];
    sc.newsy.forEach((t, i) => {
        const z = rdzenZrodla(s.newsy[i].zrodlo);
        miekkie.push(new RegExp(z.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(t) || `NEWS ${i + 1}: brak źródła „${s.newsy[i].zrodlo}”`);
        const zdan = t.split(/[.!?]+\s/).filter((x) => x.trim()).length;
        miekkie.push(zdan <= 5 || `NEWS ${i + 1}: ${zdan} zdań (miało być 2–3)`);
    });
    miekkie.push(!/[*#_`]|\p{Extended_Pictographic}/u.test(`${sc.intro} ${sc.outro} ${sc.newsy.join(' ')}`) || 'markdown albo emoji w tekście na głos');
    const uwagi = miekkie.filter((x) => x !== true);
    return { ok: !liczby, punkty: (miekkie.length - uwagi.length) / miekkie.length, bledy: [...bledy, ...uwagi], sc };
}

/** Pytania do Jev: `noul` puenta każdego newsa w każdej wersji + `choice` najlepszej wersji. */
export function pytaniaJevNews(s, wersje) {
    const questions = {};
    wersje.forEach((w, v) => s.newsy.forEach((n, i) => {
        questions[`p_${LITERY[v]}_${i + 1}`] = {
            type: 'noul',
            instructions: `Wersja ${LITERY[v]}, NEWS ${i + 1} (nagłówek: „${tnij(n.tytulOryginalny ?? n.tytul, 160)}”). Czy streszczenie wyraźnie podaje SEDNO i PUENTĘ nagłówka (np. zaskakujący zwrot) bez rozmywania i bez dopisanych faktów?`,
            criteria: { true: 'Słuchacz po tym streszczeniu wie, co jest najważniejsze i zaskakujące w nagłówku; nic nie zmyślono.', false: 'Sedno rozmyte w ogólnikach, puenta zgubiona albo odwrócona, albo dodano fakty spoza nagłówka.' },
        };
    }));
    questions.najlepsza = {
        type: 'choice',
        instructions: 'Która wersja to najlepszy serwis informacyjny: wierny nagłówkom, z wyraźną puentą każdego newsa, neutralny, naturalny do mówienia na głos, w temperamencie prowadzących?',
        criteria: Object.fromEntries(wersje.map((_, v) => [LITERY[v], `Wersja ${LITERY[v]}`])),
    };
    const state = {
        naglowki: s.newsy.map((n, i) => `${i + 1}. [${n.zrodlo}] ${n.tytulOryginalny ?? n.tytul} — ${tnij(n.opis, 300)}`).join('\n'),
        ...Object.fromEntries(wersje.map((w, v) => [`wersja_${LITERY[v]}`, tnij(w.tekst, 6000)])),
    };
    return { state, questions };
}
export function ocenyZJev(odp, s, wersje) {
    const a = odp?.answers ?? {};
    const pr = a.najlepsza?.probabilities ?? {};
    return wersje.map((_, v) => {
        const p = s.newsy.map((__, i) => Number(a[`p_${LITERY[v]}_${i + 1}`]?.noul)).filter(Number.isFinite);
        return { puenta: p.length ? p.reduce((x, y) => x + y, 0) / p.length : null, puenty: p, wybor: Number(pr[LITERY[v]]) || 0 };
    });
}

/** Sędzia porównawczy z modelu lokalnego (bez klucza Jev) — JSON z puentą 0/1 na news i najlepszą wersją. */
export function promptSedziegoNews(s, wersje) {
    return {
        system: 'Jesteś surowym sędzią serwisu informacyjnego. Porównujesz wersje tego samego serwisu. Nie poprawiasz ich. Odpowiadasz wyłącznie JSON.',
        user: `NAGŁÓWKI:\n${s.newsy.map((n, i) => `${i + 1}. ${n.tytulOryginalny ?? n.tytul} — ${tnij(n.opis, 300)}`).join('\n')}\n\n` +
            wersje.map((w, v) => `=== WERSJA ${LITERY[v]} ===\n${tnij(w.tekst, 4000)}`).join('\n\n') +
            `\n\nDla każdej wersji i każdego newsa oceń 1 albo 0: czy streszczenie wyraźnie podaje sedno i PUENTĘ nagłówka, bez dopisanych faktów. Potem wskaż najlepszą wersję.\n` +
            `FORMAT: {"puenty":{${wersje.map((_, v) => `"${LITERY[v]}":[${s.newsy.map(() => '1').join(',')}]`).join(',')}},"najlepsza":"A","dlaczego":"jedno zdanie"}`,
    };
}
export function ocenySedziegoLokalnego(tekst, s, wersje) {
    const bez = String(tekst ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
    const m = bez.match(/\{[\s\S]*\}/);
    const d = JSON.parse(m ? m[0] : bez);
    const naj = String(d?.najlepsza ?? '').trim().toUpperCase().slice(0, 1);
    if (!LITERY.slice(0, wersje.length).includes(naj)) throw new Error(`sędzia lokalny wskazał „${d?.najlepsza}” spoza wersji`);
    return {
        oceny: wersje.map((_, v) => {
            const p = (Array.isArray(d?.puenty?.[LITERY[v]]) ? d.puenty[LITERY[v]] : []).map(Number).filter((x) => x === 0 || x === 1).slice(0, s.newsy.length);
            return { puenta: p.length ? p.reduce((x, y) => x + y, 0) / p.length : null, puenty: p, wybor: LITERY[v] === naj ? 1 : 0 };
        }),
        dlaczego: tnij(d?.dlaczego, 300),
    };
}

/** Wynik wersji 0–1: bez twardych = -1; puenta 0,5 · wybór sędziego 0,3 · miękkie sprawdziany 0,2. */
export function wynikWersji(twarde, ocena) {
    if (!twarde.ok) return -1;
    return Math.round((0.5 * (ocena?.puenta ?? 0) + 0.3 * (ocena?.wybor ?? 0) + 0.2 * twarde.punkty) * 1000) / 1000;
}

/** Zadanie „scenariusz prowadzących Zebrra News” — materiał = zapisany odcinek (te same nagłówki dla każdej wersji). */
export function zadanieZebrraNews({ news, modelDla = async () => null, persona = async () => null }) {
    return {
        id: ZADANIE_NEWS, nazwa: 'Zebrra News — scenariusz prowadzących', agent: 'zebra',
        opis: 'Serwis INTRO / NEWS n / OUTRO z nagłówków RSS: własne streszczenia, liczby tylko ze źródeł, źródło na końcu newsa, puenta nagłówka wprost, temperament Gol Donny i Zlata.',
        async materialy() {
            return (await news.lista()).filter((o) => (o.newsy?.length ?? 0) >= 3).slice(0, 30)
                .map((o) => ({ id: o.id, opis: `${o.dzien} · ${o.jezyk} · ${o.newsy.length} newsów · ${o.stan}`, tytuly: o.newsy.map((n) => n.tytul).slice(0, 8) }));
        },
        material: (id) => news.wczytaj(id),
        async model(s) { return (await modelDla(s.narrator).catch(() => null)) ?? (await modelDla('pilkarka').catch(() => null)); },
        async czesci(s) {
            const sklad = [s.narrator, ...(s.wspolprowadzacy ?? [])];
            const karty = [];
            for (const k of sklad) { const t = await persona(k).catch(() => null); if (t) karty.push(`karta ${k}.md: ${tnij(t, 500)}`); }
            return [
                `PERSONA (GolDnia.NARRATORZY): ${sklad.map((k) => `${NARRATORZY[k]?.imie}: ${s.jezyk === 'en' ? NARRATORZY[k]?.temperamentEn : NARRATORZY[k]?.temperament}`).join(' | ')}`,
                ...karty,
                `ZASADY ZADANIA (ZebrraNews.promptScenariusza):\n${promptScenariusza(s).system}`,
            ].join('\n');
        },
        prompt: (s, zmiany) => promptScenariusza(s, { uprzaz: blokUprzezy(zmiany) }),
        twarde: (tekst, s) => twardeNews(tekst, s),
        pytaniaJev: pytaniaJevNews, ocenyZJev, promptSedziego: promptSedziegoNews, ocenySedziego: ocenySedziegoLokalnego,
    };
}

// ─────────────────────────── SERWIS ───────────────────────────

/**
 * @param {{ katalog: string, zadania: object[], chat: (model: string|null, system: string, user: string, opcje?: object) => Promise<{ tekst: string, silnik?: string }>,
 *   jev?: { zapytaj: Function, stan: () => { maKlucz: boolean } }|null, skille?: () => Promise<{ id: string, opis: string }[]>,
 *   zasadyStylu?: () => Promise<string[]>, jajo?: { decyzja?: Function, wiesc?: Function }|null, modelUlepszacza?: () => Promise<string|null>,
 *   temperatura?: number, szyna?: any, teraz?: () => Date }} o
 */
export function utworzUprzaz(o) {
    const cfg = { skille: async () => [], zasadyStylu: async () => [], jajo: null, jev: null, modelUlepszacza: async () => process.env.OTAKOS_UPRZAZ_MODEL || null, temperatura: 0.3, teraz: () => new Date(), ...o };
    const KAT = cfg.katalog;
    const PLIK_U = path.join(KAT, 'uprzeze.json'), PLIK_L = path.join(KAT, 'lekcje.jsonl'), KAT_P = path.join(KAT, 'przebiegi');
    const ZAD = new Map(cfg.zadania.map((z) => [z.id, z]));
    const zadanie = (id) => { const z = ZAD.get(id); if (!z) throw new Error(`Nie ma zadania uprzęży „${id}”.`); return z; };
    const czas = () => cfg.teraz().toISOString();
    const wRobocie = new Set();
    let kolejka = Promise.resolve(), zapisy = Promise.resolve();
    const poKolei = (fn) => (zapisy = zapisy.then(fn, fn));
    const nadaj = (t) => cfg.szyna?.nadaj?.({ agent: 'Uprząż', rodzaj: 'praca', tresc: `🧬 ${t}` })?.catch?.(() => {});

    async function pisz(p, d) {
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(`${p}.tmp`, JSON.stringify(d, null, 1), 'utf8');
        for (let i = 0; ; i++) { try { await fs.rename(`${p}.tmp`, p); return; } catch (e) { if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || i >= 8) throw e; await new Promise((r) => setTimeout(r, 25 * (i + 1))); } }
    }
    async function uprzeze() { try { return JSON.parse(await fs.readFile(PLIK_U, 'utf8')).uprzeze ?? []; } catch { return []; } }
    const zapiszUprzeze = (l) => pisz(PLIK_U, { uprzeze: l });
    async function lekcje(zad = null) {
        const t = await fs.readFile(PLIK_L, 'utf8').catch(() => '');
        return t.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((l) => l && (!zad || l.zadanie === zad));
    }
    async function aktywna(zad) {
        const u = (await uprzeze()).find((x) => x.zadanie === zad && x.stan === 'aktywna');
        return u ? { id: u.id, zmiany: u.zmiany, blok: blokUprzezy(u.zmiany) } : null;
    }
    const plikP = (id) => { if (!ID_P.test(String(id))) throw new Error('Złe id przebiegu.'); return path.join(KAT_P, `${id}.json`); };
    async function przebieg(id) {
        let p;
        try { p = JSON.parse(await fs.readFile(plikP(id), 'utf8')); } catch (e) { if (e.code === 'ENOENT') throw new Error('Nie ma takiego przebiegu.'); throw e; }
        if (p.stan === 'robi' && !wRobocie.has(id)) { Object.assign(p, { stan: 'blad', powod: 'Przerwane — most był restartowany.' }); await pisz(plikP(id), p).catch(() => {}); }
        return p;
    }
    async function przebiegi() {
        const out = [];
        for (const f of await fs.readdir(KAT_P).catch(() => [])) { const id = f.replace(/\.json$/, ''); if (ID_P.test(id)) { try { out.push(await przebieg(id)); } catch { /* uszkodzony */ } } }
        return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    /** Jedno wykonanie zadania z uprzężą `zmiany` (ten sam model, ta sama temperatura dla każdej wersji). */
    async function wykonaj(Z, s, model, zmiany, lit, nazwa) {
        const { system, user } = Z.prompt(s, zmiany);
        const t0 = Date.now();
        let tekst = '', blad = null;
        try { tekst = (await cfg.chat(model, system, user, { temperatura: cfg.temperatura })).tekst; } catch (e) { blad = String(e.message || e).slice(0, 300); }
        const twarde = blad ? { ok: false, punkty: 0, bledy: [`model: ${blad}`] } : Z.twarde(tekst, s);
        const { sc: _sc, ...tw } = twarde;
        return { lit, nazwa, zmiany, tekst, twarde: tw, ms: Date.now() - t0 };
    }

    /** Sędzia kontrastu: Jev (gdy klucz), inaczej model lokalny z uczciwą adnotacją. Wpisuje `ocena` i `wynik` w wersje. */
    async function osadz(Z, s, model, wersje) {
        let oceny = null, sedzia = null;
        if (cfg.jev?.stan?.().maKlucz) {
            try {
                const { state, questions } = Z.pytaniaJev(s, wersje);
                const d = await cfg.jev.zapytaj({ state, questions });
                oceny = Z.ocenyZJev(d, s, wersje);
                sedzia = { kto: `Jev (${d.model ?? 'jev'})`, uwaga: null };
            } catch (e) { sedzia = { jevBlad: String(e.message || e).slice(0, 200) }; }
        }
        if (!oceny) {
            try {
                const { system, user } = Z.promptSedziego(s, wersje);
                const r = Z.ocenySedziego((await cfg.chat(model, system, user, { temperatura: 0, json: true })).tekst, s, wersje);
                oceny = r.oceny;
                sedzia = { ...sedzia, kto: `model lokalny (${model ?? 'domyślny'})`, uwaga: 'Sędzia = model lokalny (ten sam, który pisał) — słabszy niż Jev i może faworyzować własny styl; wynik to wskazówka, nie wyrok.', dlaczego: r.dlaczego };
            } catch (e) {
                oceny = wersje.map(() => ({ puenta: null, puenty: [], wybor: 0 }));
                sedzia = { ...sedzia, kto: 'same twarde sprawdziany', uwaga: `Sędzia porównawczy padł (${String(e.message || e).slice(0, 160)}) — liczą się tylko twarde sprawdziany.` };
            }
        }
        wersje.forEach((w, i) => { w.ocena = oceny[i]; w.wynik = wynikWersji(w.twarde, oceny[i]); });
        return sedzia;
    }
    const uwagiWersji = (w) => [...w.twarde.bledy, ...(w.ocena?.puenty ?? []).map((p, i) => (p < 0.5 ? `NEWS ${i + 1}: sędzia — puenta rozmyta (${Number(p).toFixed(2)})` : null)).filter(Boolean)];

    async function praca(id) {
        const p = await przebieg(id);
        const zapisz = () => pisz(plikP(id), p);
        const krok = async (t) => { p.kroki.push({ czas: czas(), t }); await zapisz(); };
        try {
            const Z = zadanie(p.zadanie);
            const s = await Z.material(p.material);
            const model = await Z.model(s);
            const ulepszacz = (await cfg.modelUlepszacza().catch(() => null)) ?? model;
            const [skille, zasadyStylu] = await Promise.all([cfg.skille().catch(() => []), cfg.zasadyStylu().catch(() => [])]);
            const czesci = await Z.czesci(s);
            Object.assign(p, { model, ulepszacz });
            let baza = p.start.zmiany;
            for (let r = 1; r <= p.glebokosc; r++) {
                const runda = { nr: r, baza, wersje: [], sedzia: null, propozycje: null, zwyciezcy: [], zlozona: null, wybrana: null };
                p.rundy.push(runda);
                await krok(`runda ${r}: wykonanie bazowe (${baza.length} dodatków)`);
                const A = await wykonaj(Z, s, model, baza, 'A', r === 1 ? 'baza' : `baza rundy ${r}`);
                // PROPOSE — z zachowania bazy: twarde błędy + sędzia o samej bazie (puenty), plus zeszyt lekcji
                await krok(`runda ${r}: sędzia o wykonaniu bazowym`);
                runda.sedziaBazy = await osadz(Z, s, model, [A]);   // ocena bazy liczona jeszcze raz w kontraście
                await krok(`runda ${r}: ulepszacz (${ulepszacz ?? 'domyślny'}) proponuje ${p.k} wersje`);
                const lk = (await lekcje(p.zadanie)).slice(-14);
                const { system, user } = promptPropozycji({ zadanie: Z, czesci, baza: { tekst: A.tekst, uwagi: uwagiWersji(A) }, lekcje: lk, k: p.k, skille, zasadyStylu, bazowe: baza });
                let prop = null, blad = null;
                for (let proba = 0; proba < 2 && !prop; proba++) {
                    const t = (await cfg.chat(ulepszacz, system, proba ? `${user}\n\nPOPRZEDNIA ODPOWIEDŹ ODRZUCONA: ${blad}` : user, { json: true })).tekst;
                    try { prop = odczytajPropozycje(t, { k: p.k, skille, zasadyStylu, bazowe: baza }); } catch (e) { blad = e.message; }
                }
                if (!prop) throw new Error(`Propose: ${blad}`);
                runda.propozycje = { odrzucone: prop.odrzucone };
                // PROBE — każda wersja na tym samym materiale
                const wersje = [A];
                for (const [i, kand] of prop.kandydaci.entries()) {
                    await krok(`runda ${r}: próba ${LITERY[i + 1]} „${kand.nazwa}”`);
                    wersje.push(await wykonaj(Z, s, model, zloz(baza, kand.zmiany), LITERY[i + 1], kand.nazwa));
                    wersje.at(-1).nowe = kand.zmiany;
                }
                await krok(`runda ${r}: sędzia porównuje ${wersje.length} wersje`);
                runda.sedzia = await osadz(Z, s, model, wersje);
                runda.wersje = wersje;
                // COMPOSE — zmiany, które pobiły bazę
                const zwyc = wersje.slice(1).filter((w) => w.wynik > A.wynik + MARGINES).sort((a, b) => b.wynik - a.wynik);
                runda.zwyciezcy = zwyc.map((w) => w.lit);
                let wybrana = zwyc[0] ?? null;
                if (zwyc.length >= 2) {
                    await krok(`runda ${r}: złożenie ${zwyc.map((w) => w.lit).join('+')} i sprawdzian`);
                    const zl = await wykonaj(Z, s, model, zloz(baza, ...zwyc.map((w) => w.nowe)), LITERY[wersje.length], `złożona ${zwyc.map((w) => w.lit).join('+')}`);
                    const kontra = [{ ...A }, { ...zwyc[0] }, zl];
                    const sd = await osadz(Z, s, model, kontra);
                    runda.zlozona = { wersja: zl, sedzia: sd, przeciw: zwyc[0].lit, wyniki: kontra.map((w) => w.wynik) };
                    if (kontra[2].wynik > kontra[1].wynik && kontra[2].wynik > kontra[0].wynik + MARGINES) wybrana = zl;
                }
                // ZESZYT — każda nowa zmiana z dowodem
                const wpisy = wersje.slice(1).flatMap((w) => w.nowe.map((z) => {
                    const delta = Math.round((w.wynik - A.wynik) * 1000) / 1000;
                    return { czas: czas(), zadanie: p.zadanie, zmiana: z, efekt: delta > MARGINES ? 'pomogla' : delta < -MARGINES ? 'zaszkodzila' : 'bez-zmian', delta,
                        dowod: { przebieg: p.id, runda: r, wersja: w.lit, material: p.material, wynikBazy: A.wynik, wynik: w.wynik, sedzia: runda.sedzia?.kto ?? null } };
                }));
                if (wpisy.length) await poKolei(async () => { await fs.mkdir(KAT, { recursive: true }); await fs.appendFile(PLIK_L, wpisy.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8'); });
                runda.wybrana = wybrana ? { lit: wybrana.lit, wynik: wybrana.wynik, zmiany: wybrana.zmiany } : null;
                await zapisz();
                if (!wybrana) { await krok(`runda ${r}: żadna zmiana nie pobiła bazy (${A.wynik}) — koniec`); break; }
                baza = wybrana.zmiany;
            }
            // propozycja do ✓ — tylko gdy uprząż się zmieniła
            const koniec = p.rundy.map((x) => x.wybrana).filter(Boolean).at(-1);
            if (koniec && koniec.zmiany.map(klucz).join('§') !== p.start.zmiany.map(klucz).join('§')) {
                const u = { id: noweId('u'), zadanie: p.zadanie, stan: 'proponowana', zmiany: koniec.zmiany, rodzic: p.start.uprzaz, przebieg: p.id, material: p.material,
                    wynik: { start: p.rundy[0].wersje[0].wynik, koniec: koniec.wynik }, sedzia: p.rundy.at(-1).sedzia?.kto ?? null, utworzono: czas() };
                await poKolei(async () => { const l = await uprzeze(); l.push(u); await zapiszUprzeze(l); });
                p.propozycja = u.id;
                void cfg.jajo?.wiesc?.({ tresc: `🧬 Nowa uprząż „${Z.nazwa}” (${u.wynik.start} → ${u.wynik.koniec}, sędzia: ${u.sedzia}) czeka na Twoje ✓.`, rodzaj: 'uprzaz', skad: 'Harness²' })?.catch?.(() => {});
            }
            Object.assign(p, { stan: 'gotowy', powod: null, skonczono: czas() });
            nadaj(`przebieg ${p.id}: ${p.propozycja ? `nowa uprząż ${p.propozycja} do ✓` : 'bez lepszej uprzęży'}`);
        } catch (e) { Object.assign(p, { stan: 'blad', powod: String(e.message || e).slice(0, 600) }); }
        await zapisz();
    }

    /** Nowy przebieg Propose–Probe–Compose w tle (jeden naraz — model na karcie). */
    async function uruchom({ zadanie: zad, material, k = 2, glebokosc = 1 } = {}) {
        const Z = zadanie(zad);
        if (!material) throw new Error('Wskaż materiał (np. odcinek Zebrra News).');
        await Z.material(material);   // istnieje?
        const akt = await aktywna(zad);
        const p = { id: noweId('p'), zadanie: zad, material: String(material), k: Math.max(1, Math.min(MAX_K, Number(k) || 2)), glebokosc: Math.max(1, Math.min(MAX_GLEBOKOSC, Number(glebokosc) || 1)),
            stan: 'robi', powod: null, start: { uprzaz: akt?.id ?? null, zmiany: akt?.zmiany ?? [] }, rundy: [], kroki: [], propozycja: null, utworzono: czas() };
        await pisz(plikP(p.id), p);
        wRobocie.add(p.id);
        kolejka = kolejka.then(() => praca(p.id)).catch(() => {}).finally(() => wRobocie.delete(p.id));
        return p;
    }

    /** ✓ Suwerena: uprząż wchodzi do użytku, poprzednia aktywna → wycofana. */
    async function przyjmij(id) {
        if (!ID_U.test(String(id))) throw new Error('Złe id uprzęży.');
        const u = await poKolei(async () => {
            const l = await uprzeze();
            const x = l.find((y) => y.id === id);
            if (!x) throw new Error('Nie ma takiej uprzęży.');
            if (!['proponowana', 'wycofana'].includes(x.stan)) throw new Error(`Uprząż jest „${x.stan}”.`);
            for (const y of l) if (y.zadanie === x.zadanie && y.stan === 'aktywna') Object.assign(y, { stan: 'wycofana', wycofano: czas() });
            Object.assign(x, { stan: 'aktywna', przyjeto: czas() });
            await zapiszUprzeze(l);
            return x;
        });
        void cfg.jajo?.decyzja?.({ zrodlo: 'uprzaz', obiekt: u.id, tytul: zadanie(u.zadanie).nazwa, werdykt: 'przyjeta', opis: blokUprzezy(u.zmiany) })?.catch?.(() => {});
        return u;
    }
    async function odrzuc(id, uwagi = '') {
        if (!ID_U.test(String(id))) throw new Error('Złe id uprzęży.');
        const u = await poKolei(async () => {
            const l = await uprzeze();
            const x = l.find((y) => y.id === id);
            if (!x) throw new Error('Nie ma takiej uprzęży.');
            if (x.stan !== 'proponowana') throw new Error(`Uprząż jest „${x.stan}”.`);
            Object.assign(x, { stan: 'odrzucona', odrzucono: czas(), uwagi: tnij(uwagi, 400) });
            await zapiszUprzeze(l);
            return x;
        });
        void cfg.jajo?.decyzja?.({ zrodlo: 'uprzaz', obiekt: u.id, tytul: zadanie(u.zadanie).nazwa, werdykt: 'odrzucona', opis: blokUprzezy(u.zmiany), uwagi })?.catch?.(() => {});
        return u;
    }
    /** Zdjęcie aktywnej uprzęży zadania (powrót do gołych zasad). */
    async function wycofaj(zad) {
        zadanie(zad);
        return poKolei(async () => {
            const l = await uprzeze();
            const x = l.find((y) => y.zadanie === zad && y.stan === 'aktywna');
            if (!x) return null;
            Object.assign(x, { stan: 'wycofana', wycofano: czas() });
            await zapiszUprzeze(l);
            return x;
        });
    }

    async function stan() {
        const [u, p, l] = await Promise.all([uprzeze(), przebiegi(), lekcje()]);
        return {
            zadania: cfg.zadania.map((z) => ({ id: z.id, nazwa: z.nazwa, opis: z.opis, agent: z.agent, aktywna: u.find((x) => x.zadanie === z.id && x.stan === 'aktywna')?.id ?? null })),
            rodzaje: RODZAJE, uprzeze: u.slice().reverse().map((x) => ({ ...x, blok: blokUprzezy(x.zmiany) })),
            przebiegi: p.slice(0, 20).map((x) => ({ id: x.id, zadanie: x.zadanie, material: x.material, stan: x.stan, powod: x.powod, k: x.k, glebokosc: x.glebokosc, rund: x.rundy.length, propozycja: x.propozycja, utworzono: x.utworzono, ostatniKrok: x.kroki.at(-1)?.t ?? null })),
            lekcje: l.slice(-30).reverse(), jev: !!cfg.jev?.stan?.().maKlucz, margines: MARGINES, maxK: MAX_K, maxGlebokosc: MAX_GLEBOKOSC,
        };
    }

    return { stan, uruchom, przebieg, przebiegi, przyjmij, odrzuc, wycofaj, aktywna, lekcje, uprzeze, materialy: (zad) => zadanie(zad).materialy(), czekaj: () => kolejka };
}

export function zamontujTrasyUprzezy(app, U) {
    const odp = (res, p, kod = 400) => p.then((w) => res.json({ success: true, ...w })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    app.get('/api/uprzaz', (_req, res) => odp(res, U.stan(), 500));
    app.get('/api/uprzaz/materialy/:zadanie', (req, res) => odp(res, U.materialy(req.params.zadanie).then((materialy) => ({ materialy })), 404));
    app.post('/api/uprzaz/przebieg', (req, res) => odp(res, U.uruchom(req.body ?? {}).then((przebieg) => ({ przebieg }))));
    app.get('/api/uprzaz/przebieg/:id', (req, res) => odp(res, U.przebieg(req.params.id).then((przebieg) => ({ przebieg })), 404));
    app.post('/api/uprzaz/wycofaj', (req, res) => odp(res, U.wycofaj(req.body?.zadanie).then((uprzaz) => ({ uprzaz }))));
    app.post('/api/uprzaz/:id/przyjmij', (req, res) => odp(res, U.przyjmij(req.params.id).then((uprzaz) => ({ uprzaz }))));
    app.post('/api/uprzaz/:id/odrzuc', (req, res) => odp(res, U.odrzuc(req.params.id, req.body?.uwagi).then((uprzaz) => ({ uprzaz }))));
}

export default { utworzUprzaz, zamontujTrasyUprzezy, zadanieZebrraNews, RODZAJE, oczyscZmiane, blokUprzezy, zloz, promptPropozycji, odczytajPropozycje, twardeNews, pytaniaJevNews, ocenyZJev, promptSedziegoNews, ocenySedziegoLokalnego, wynikWersji, MARGINES };
