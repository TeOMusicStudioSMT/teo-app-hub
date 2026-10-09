/**
 * 🥚 JaJo Mistrza (Suweren 2026-10-07: „obserwuje, co robi Suweren, i układa szkolenia i workflowy do treningu”;
 * 2026-10-09: „lecimy z tym JAJEM… może być Mistrzem Gry Teterhii… widzi dwa światy… rozstrzyga bitwy, turnieje…
 * przedstawiciel Katedry w Globalnym Klubie Mistrzów”).
 *
 * ETAP 1 = OCZY I PAMIĘĆ. JaJo patrzy tylko na to, co Suweren NAPRAWDĘ zrobił w Katedrze:
 *   · POPRAWKA — model coś napisał, Suweren zmienił (kwestie wywiadu / odcinka podcastu / sceny, tytuł i opis
 *     publikacji YouTube przed ✓) → para „model → Suweren” (rejected / chosen) = najczystszy sygnał stylu;
 *   · DECYZJA  — Suweren przyjął / odrzucił / ratyfikował kartę Stołu, zatwierdził / odrzucił publikację.
 * Nic nie zgaduje i nic nie wysyła: dziennik `_OtakOs_Wymiar/jajo-mistrza/obserwacje.jsonl`.
 *
 * Z dziennika:
 *   · `kurs()`    — dane do treningu w formacie Kuźni Soup: pary DPO (prompt/chosen/rejected) z poprawek i SFT
 *                   (chatml) z wersji Suwerena → `_OtakOs_Wymiar/kuznia-soup/mistrz/` (trening = decyzja Suwerena);
 *   · `lekcja()`  — Mistrz na swoim modelu czyta ostatnie obserwacje i spisuje ZASADY stylu Suwerena, każda
 *                   z numerami obserwacji, na których stoi (bez numeru = odrzucona) → `zasady.md`;
 *   · `stan()`    — ile widział, z czego, i jak daleko jajo do wyklucia (progi `ETAPY`).
 * Mistrz Gry Teterhii i Klub Mistrzów stoją na tych zasadach — to następne etapy, nie ten.
 *
 * 📯 KANAŁ MISTRZA (Suweren 2026-10-09: „podłączyć do KatedraOrb… jako Rola Mistrzowska może zostać kanałem
 * dla Mistrzów… odezwać się, jak coś zaobserwuje, albo gdy będzie potrzebny przekaz z pola”): `wiesci.jsonl`
 * — JaJo sam mówi, gdy: jajo przechodzi etap, uzbierało się dość nowych poprawek na lekcję, Kodeks po porażkach
 * wygrał zadanie; „z pola” (`wiesc`) — przekaz z zewnątrz (dziś: most/Główny, jutro Klub Mistrzów).
 * Orbita odpytuje `/api/mistrz/wiesci?od=` i pokazuje (opcjonalnie mówi) — nic nie wychodzi z Katedry.
 *
 * ⚖️ RUNDY KODEKSA: AppStudio oddaje po zadaniu rundy odrzucone przez sędziów (build, przeglądarka, Recenzent,
 * Jev…) i rundę przyjętą → `rundy-kodeksa.jsonl` = pary kodu „źle → dobrze” z powodem werdyktu (dla Kodeksa,
 * osobno od stylu Suwerena; w kursie `kuznia-soup/kodeks/pary-kodeksa.jsonl`).
 *
 * 💡 PODPOWIEDZI DLA KODEKSA (Suweren 2026-10-09: „niech JaJo Mistrza daje im podpowiedzi… tak jak ja teraz”):
 * `podpowiedzKodeksowi({projekt, cel, bledy})` — przed kolejną próbą (następny model łańcucha albo kolejna runda)
 * Mistrz czyta błędy poprzedników i daje radę jak Suweren: (1) porada od sędziego, który odrzucał (`PORADY_SEDZIOW`),
 * (2) co POMOGŁO, gdy ten sam sędzia odrzucał wcześniej (`rundy-kodeksa.jsonl`: linie dopisane w przyjętej rundzie,
 * których odrzucona nie miała), (3) UPARTY SĘDZIA — ten sam werdykt u ≥ 2 modeli i ≥ 3 razy: Kodeks dostaje „kod bywa
 * prawie dobry — popraw tylko to”, a Suweren wieść kanałem Mistrza „może to sędzia się myli” (raz na zadanie i sędziego;
 * tak było z martwym modułem 2026-10-09 — sędzia nie widział importu z innego modułu).
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/** Jajo pęka od prawdziwej pracy — liczy się każda obserwacja (poprawka waży 2, bo uczy więcej). */
export const ETAPY = [
    { od: 0, nazwa: 'jajo', opis: 'Jajo leży i patrzy. Każda Twoja poprawka i decyzja je grzeje.' },
    { od: 20, nazwa: 'drży', opis: 'Jajo drży — zna już pierwsze nawyki Suwerena.' },
    { od: 60, nazwa: 'pęka', opis: 'Skorupka pęka — wystarczy obserwacji na pierwszą lekcję stylu.' },
    { od: 120, nazwa: 'wykluty', opis: 'Mistrz się wykluł — zna styl Suwerena na tyle, by uczyć stado i sędziować.' },
];
export const ZRODLA = {
    wywiad: 'Wywiad aktorów', podcast: 'Odcinek Studia Podcastu', scena: 'Scena dialogowa',
    youtube: 'Publikacja YouTube', stol: 'Stół ratyfikacji',
};
const MAX_TEKST = 2000;
const MAX_KODU = 12_000;
/** Nowe poprawki od ostatniej lekcji, po których JaJo sam proponuje kolejną. */
export const PROG_NOWEJ_LEKCJI = 10;

/** Pliki rundy → jeden tekst (do pary DPO). */
export function plikiJakoTekst(pliki = [], limit = MAX_KODU) {
    return pliki.map((p) => `=== PLIK: ${p.sciezka} ===\n${p.tresc}\n=== KONIEC ===`).join('\n').slice(0, limit);
}
/** Kto odrzucił rundę — z pierwszych słów uwag (tak, jak AppStudio je pisze). */
export function sedziaZPowodu(powod) {
    const t = String(powod ?? '');
    if (/SĘDZIA ZADANIA/i.test(t)) return 'Jev (sędzia zadania)';
    if (/ŻADEN plik projektu tego nie importuje/.test(t)) return 'martwy moduł';
    if (/IDENTYCZNYCH/.test(t)) return 'bez zmian';
    if (/NA EKRANIE/.test(t)) return 'oczy';
    if (/ZADANIE NIE JEST ZROBIONE|ZACHOWUJE SIĘ/.test(t)) return 'sędzia zachowania';
    if (/w przeglądarce/.test(t)) return 'przeglądarka';
    if (/bloku === PLIK|nie zmieściła się/.test(t)) return 'format';
    if (/RECENZ|zaślepk|atrap|regresj|@ts-ignore|pusty catch/i.test(t)) return 'Recenzent';
    if (/^(tsc|vite|build)|error TS\d+|TS\d{4}/im.test(t)) return 'build';
    return 'sędzia';
}

/** Rada od sędziego, który odrzucił — z przyczyn, które Katedra już zmierzyła (CLAUDE.md, historia AppStudio). */
const RADA_PRZEGLADARKI = 'Błąd w konsoli przy starcie: sprawdź kolejność (użycie przed utworzeniem), wyniki querySelector bez sprawdzenia null i importy, które przy starcie coś wywołują.';
export const PORADY_SEDZIOW = {
    'martwy moduł': 'Każdy nowy plik src/*.ts musi być osiągalny importem od src/main.ts (wprost albo przez moduł, który main już importuje), a jego funkcja musi być WYWOŁANA tam, gdzie gra działa. Jeśli możesz, dopisz kod do istniejącego modułu zamiast tworzyć nowy plik.',
    build: 'Czytaj numer linii i nazwę typu z błędu tsc — popraw TĘ linię i jej typ. Nie zmieniaj sygnatur eksportów, których używają inne pliki; nowe pole typu uzupełnij we wszystkich miejscach, gdzie powstaje obiekt.',
    'przeglądarka': RADA_PRZEGLADARKI,
    oczy: 'Na ekranie nic nie widać: kamera, światło i obiekty muszą być w scenie, a pętla renderu działać — nie zasłaniaj płótna nieprzezroczystą nakładką.',
    'sędzia zachowania': 'Zadanie ma być WIDAĆ w grze: stan w window.__gra musi się zmieniać po klawiszu/zdarzeniu z zadania. Samo dopisanie funkcji to za mało — podepnij ją do pętli albo obsługi klawisza.',
    'Jev (sędzia zadania)': 'Przeczytaj zadanie zdanie po zdaniu i zrób KAŻDY element (trasa mostu, okno, postać, zachowanie) — nie tylko pierwszy.',
    Recenzent: 'Bez zaślepek („// reszta bez zmian”), @ts-ignore, pustych catch, danych na sztywno i bez wycinania działającego kodu poza zadaniem — oddaj pliki w całości.',
    'bez zmian': 'Oddałeś pliki identyczne z projektem — napisz KOD, który realizuje zadanie.',
    format: 'Oddaj mniej: tylko zmieniane pliki, w blokach === PLIK: … === / === KONIEC ===; duże pliki podziel na moduły.',
};

/** Linie dopisane w przyjętej rundzie, których odrzucona nie miała — „co pomogło” (bez znaczników plików i pustych). */
export function coPomoglo(odrzucona, przyjeta, ile = 10) {
    const bylo = new Set(String(odrzucona ?? '').split('\n').map((l) => l.trim()));
    const out = [];
    for (const l of String(przyjeta ?? '').split('\n')) {
        const t = l.trim();
        if (t.length < 4 || t.startsWith('=== ') || /^[{}()[\];,]+$/.test(t) || bylo.has(t) || out.includes(t)) continue;
        out.push(t.slice(0, 160));
        if (out.length >= ile) break;
    }
    return out;
}

/**
 * Czysta część podpowiedzi: błędy poprzedników [{model, powod}] + historia rund (rundy-kodeksa) → rada.
 * `uparty` = sędzia, który odrzucał u ≥ 2 modeli i ≥ 3 razy.
 */
export function ulozPodpowiedz({ bledy = [], historia = [], projekt = '' } = {}) {
    if (!bledy.length) return null;
    const wgSedziego = new Map();
    for (const b of bledy) {
        const s = sedziaZPowodu(b.powod);
        const w = wgSedziego.get(s) ?? { sedzia: s, razy: 0, modele: new Set() };
        w.razy++;
        if (b.model) w.modele.add(String(b.model));
        wgSedziego.set(s, w);
    }
    const sedziowie = [...wgSedziego.values()].sort((a, b) => b.razy - a.razy);
    const uparty = sedziowie.find((w) => w.razy >= 3 && w.modele.size >= 2) ?? null;
    const linie = ['💡 PODPOWIEDŹ MISTRZA (JaJo — patrzy na wszystkie próby tego zadania):'];
    if (uparty) linie.push(`Sędzia „${uparty.sedzia}” odrzucił ${uparty.razy} rund u ${uparty.modele.size} modeli (${[...uparty.modele].join(', ')}). Kod poprzedników bywał prawie dobry — NIE przepisuj wszystkiego, popraw tylko to, co mówi ten sędzia.`);
    for (const w of sedziowie.slice(0, 3)) if (PORADY_SEDZIOW[w.sedzia]) linie.push(`• ${w.sedzia} (${w.razy}×): ${PORADY_SEDZIOW[w.sedzia]}`);
    const wzory = [];
    for (const w of sedziowie.slice(0, 2)) {
        const przypadki = historia.filter((r) => r.sedzia === w.sedzia).sort((a, b) => (b.projekt === projekt) - (a.projekt === projekt)).slice(0, 2);
        for (const r of przypadki) {
            const pomoglo = coPomoglo(r.odrzucona, r.przyjeta);
            if (pomoglo.length) wzory.push(`Kiedyś (${r.projekt}) sędzia „${w.sedzia}” odrzucił: „${String(r.powod).replace(/\s+/g, ' ').slice(0, 160)}”. Przeszło, gdy dopisano m.in.:\n${pomoglo.map((l) => `    ${l}`).join('\n')}`);
        }
    }
    if (wzory.length) linie.push('Z pamięci Mistrza (co pomogło przy tym samym sędzi):', ...wzory.slice(0, 3));
    return {
        tekst: linie.join('\n').slice(0, 3500),
        uparty: uparty ? { sedzia: uparty.sedzia, razy: uparty.razy, modele: [...uparty.modele] } : null,
        sedziowie: sedziowie.map((w) => ({ sedzia: w.sedzia, razy: w.razy, modele: w.modele.size })),
    };
}

const slowa = (t) => new Set(String(t ?? '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
/** Podobieństwo słów (Jaccard) — czy nowa kwestia to poprawka tamtej, czy zupełnie inna. */
export function podobienstwo(a, b) {
    const A = slowa(a), B = slowa(b);
    if (!A.size && !B.size) return 1;
    let wspolne = 0;
    for (const s of A) if (B.has(s)) wspolne++;
    return wspolne / (A.size + B.size - wspolne);
}

/**
 * Kwestie przed → po (ten sam dialog) → pary poprawek. Czysta funkcja.
 * Tej samej długości: kwestia za kwestię. Inaczej: każda nowa szuka najbliższej starej tego samego mówcy (≥ 0,3).
 * Kwestie usunięte i dopisane od zera nie są parami (nie wiadomo, co zastąpiły) — liczymy je osobno.
 */
export function paryKwestii(przed = [], po = []) {
    const norm = (k) => ({ kto: String(k?.kto ?? ''), tekst: String(k?.tekst ?? '').replace(/\s+/g, ' ').trim() });
    const A = przed.map(norm), B = po.map(norm);
    const pary = [];
    const kontekst = (lista, i) => lista.slice(Math.max(0, i - 3), i).map((k) => `${k.kto}: ${k.tekst}`).join('\n');
    if (A.length === B.length) {
        for (let i = 0; i < A.length; i++) if (A[i].kto === B[i].kto && A[i].tekst !== B[i].tekst && B[i].tekst) pary.push({ kto: B[i].kto, kontekst: kontekst(B, i), przed: A[i].tekst, po: B[i].tekst });
        return { pary, usuniete: 0, dopisane: 0 };
    }
    const uzyte = new Set();
    let dopisane = 0;
    for (let i = 0; i < B.length; i++) {
        if (A.some((k, j) => !uzyte.has(j) && k.kto === B[i].kto && k.tekst === B[i].tekst && uzyte.add(j))) continue;
        let best = -1, sila = 0.3;
        A.forEach((k, j) => { if (!uzyte.has(j) && k.kto === B[i].kto) { const p = podobienstwo(k.tekst, B[i].tekst); if (p >= sila) { sila = p; best = j; } } });
        if (best < 0) { dopisane++; continue; }
        uzyte.add(best);
        pary.push({ kto: B[i].kto, kontekst: kontekst(B, i), przed: A[best].tekst, po: B[i].tekst });
    }
    return { pary, usuniete: A.length - uzyte.size, dopisane };
}

/** Odczyt numerowanych zasad modelu: „1. … [#3, #7]” — zasada bez istniejących numerów obserwacji odpada. */
export function odczytajZasady(tekst, numery) {
    const ok = [], odrzucone = [];
    for (const linia of String(tekst ?? '').split(/\r?\n/)) {
        const m = linia.match(/^\s*(?:\d+[.)]|[-•*])\s*(.+?)\s*\[([#\d,\s]+)\]\s*$/);
        if (!m) continue;
        const dowody = [...m[2].matchAll(/#?(\d+)/g)].map((x) => Number(x[1])).filter((n) => numery.has(n));
        (dowody.length ? ok : odrzucone).push({ zasada: m[1].replace(/\*\*/g, '').slice(0, 300), dowody });
    }
    return { zasady: ok.slice(0, 15), odrzucone };
}

/**
 * @param {{ katalog: string, katalogKuzni?: string, pisz?: (o:{system:string,prompt:string}) => Promise<string>, szyna?: object|null, teraz?: () => Date }} o
 */
export function utworzJajo({ katalog, katalogKuzni = null, pisz = null, szyna = null, teraz = () => new Date() }) {
    const PLIK = () => path.join(katalog, 'obserwacje.jsonl');
    const PLIK_ZASAD = () => path.join(katalog, 'zasady.json');
    const PLIK_WIESCI = () => path.join(katalog, 'wiesci.jsonl');
    const PLIK_RUND = () => path.join(katalog, 'rundy-kodeksa.jsonl');
    const PLIK_KANALU = () => path.join(katalog, 'kanal.json');
    const czytajJsonl = async (plik) => { try { return (await fs.readFile(plik, 'utf8')).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } };
    let kolejka = Promise.resolve();

    const wszystkie = () => czytajJsonl(PLIK());
    /** Dopisanie numerowanych wpisów do pliku JSONL — jedno naraz (kolejka), numer = pozycja w pliku. */
    function dopiszDo(plik, wpisy) {
        if (!wpisy.length) return Promise.resolve([]);
        const wynik = kolejka.then(async () => {
            await fs.mkdir(katalog, { recursive: true });
            const n0 = (await czytajJsonl(plik)).length;
            const z = wpisy.map((w, i) => ({ nr: n0 + i + 1, id: crypto.randomBytes(4).toString('hex'), kiedy: teraz().toISOString(), ...w }));
            await fs.appendFile(plik, z.map((w) => JSON.stringify(w)).join('\n') + '\n', 'utf8');
            return z;
        }).catch(() => []);
        kolejka = wynik;
        return wynik;
    }
    const czytajKanal = async () => { try { return JSON.parse(await fs.readFile(PLIK_KANALU(), 'utf8')); } catch { return {}; } };
    const zapiszKanal = async (k) => { await fs.mkdir(katalog, { recursive: true }); await fs.writeFile(PLIK_KANALU(), JSON.stringify(k), 'utf8'); };

    /** 📯 Wieść na kanale Mistrza (Orbita ją odbierze). */
    async function wiesc({ tresc, rodzaj = 'pole', skad = 'JaJo Mistrza', glos = false } = {}) {
        const t = String(tresc ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
        if (t.length < 3) throw new Error('Pusta wieść.');
        const [w] = await dopiszDo(PLIK_WIESCI(), [{ rodzaj: String(rodzaj).slice(0, 20), skad: String(skad).slice(0, 60), tresc: t, glos: !!glos }]);
        void szyna?.nadaj?.({ agent: 'JaJo Mistrza', rodzaj: 'wiesc', tresc: `📯 ${t}` })?.catch?.(() => {});
        return w;
    }
    async function wiesci({ od = 0 } = {}) {
        const w = await czytajJsonl(PLIK_WIESCI());
        return { wiesci: w.filter((x) => x.nr > (Number(od) || 0)).slice(-20), ostatni: w.at(-1)?.nr ?? 0 };
    }

    /** Po każdej obserwacji: czy jajo przeszło etap, czy czas na lekcję — wtedy JaJo sam się odzywa. */
    async function poObserwacji() {
        const s = await stan();
        const k = await czytajKanal();
        if (k.etap !== s.etap.nazwa) {
            const pierwszy = k.etap === undefined && s.etap.nazwa === 'jajo';
            k.etap = s.etap.nazwa;
            await zapiszKanal(k);
            if (!pierwszy) await wiesc({ rodzaj: 'etap', glos: true, tresc: s.etap.nazwa === 'wykluty' ? '🐥 Wyklułem się! Znam Twój styl na tyle, by uczyć stado i sędziować.' : `${s.etap.nazwa === 'pęka' ? '🐣' : '🥚'} Jajo ${s.etap.nazwa}: ${s.etap.opis}` });
        }
        const odLekcji = s.poprawki - (s.zasady ? (k.poprawkiPrzyLekcji ?? 0) : 0);
        const gotowe = s.zasady ? odLekcji >= PROG_NOWEJ_LEKCJI : s.poprawki >= 5;
        if (gotowe && k.lekcjaZaproponowana !== (k.poprawkiPrzyLekcji ?? 0)) {
            k.lekcjaZaproponowana = k.poprawkiPrzyLekcji ?? 0;
            await zapiszKanal(k);
            await wiesc({ rodzaj: 'lekcja', tresc: s.zasady
                ? `📜 Uzbierałem ${odLekcji} nowych Twoich poprawek od ostatniej lekcji — mogę spisać świeże zasady stylu (Inkubator → „📜 Lekcja stylu”).`
                : `📜 Widziałem już ${s.poprawki} Twoich poprawek — mogę spisać pierwszą lekcję Twojego stylu (Inkubator → „📜 Lekcja stylu”).` });
        }
    }
    const dopisz = async (wpisy) => {
        const z = await dopiszDo(PLIK(), wpisy);
        if (z.length) await poObserwacji().catch(() => {});
        return z;
    };
    const tnij = (t) => String(t ?? '').slice(0, MAX_TEKST);

    /** Poprawka dialogu (wywiad / podcast / scena): pary kwestia „model → Suweren”. */
    async function poprawkaDialogu({ zrodlo, obiekt, tytul = '', przed, po }) {
        const { pary, usuniete, dopisane } = paryKwestii(przed, po);
        const wpisy = pary.map((p) => ({ rodzaj: 'poprawka', zrodlo, obiekt, tytul: tnij(tytul).slice(0, 200), kto: p.kto, kontekst: tnij(p.kontekst), przed: tnij(p.przed), po: tnij(p.po) }));
        if (usuniete || dopisane) wpisy.push({ rodzaj: 'decyzja', zrodlo, obiekt, tytul: tnij(tytul).slice(0, 200), werdykt: 'skrot', opis: `usunął ${usuniete}, dopisał od zera ${dopisane} kwestii` });
        const z = await dopisz(wpisy);
        if (pary.length) void szyna?.nadaj?.({ agent: 'JaJo Mistrza', rodzaj: 'obserwacja', tresc: `🥚 widzę ${pary.length} Twoich poprawek w: ${ZRODLA[zrodlo] ?? zrodlo}${tytul ? ` „${String(tytul).slice(0, 60)}”` : ''}` })?.catch?.(() => {});
        return z;
    }

    /** Poprawka pól (np. publikacja YouTube: tytuł, opis, tagi). */
    async function poprawkaPol({ zrodlo, obiekt, tytul = '', przed = {}, po = {}, pola }) {
        const wpisy = [];
        for (const pole of pola) {
            const a = Array.isArray(przed[pole]) ? przed[pole].join(', ') : String(przed[pole] ?? '');
            const b = Array.isArray(po[pole]) ? po[pole].join(', ') : String(po[pole] ?? '');
            if (a.trim() && b.trim() && a.trim() !== b.trim()) wpisy.push({ rodzaj: 'poprawka', zrodlo, obiekt, tytul: tnij(tytul).slice(0, 200), kto: pole, kontekst: '', przed: tnij(a), po: tnij(b) });
        }
        return dopisz(wpisy);
    }

    /** Decyzja Suwerena: przyjął / odrzucił / zatwierdził… — z tym, czego dotyczyła. */
    async function decyzja({ zrodlo, obiekt, tytul = '', werdykt, opis = '', uwagi = '' }) {
        return dopisz([{ rodzaj: 'decyzja', zrodlo, obiekt, tytul: tnij(tytul).slice(0, 200), werdykt: String(werdykt).slice(0, 40), opis: tnij(opis), uwagi: tnij(uwagi) }]);
    }

    function etap(punkty) {
        let e = ETAPY[0];
        for (const x of ETAPY) if (punkty >= x.od) e = x;
        const nast = ETAPY[ETAPY.indexOf(e) + 1] ?? null;
        return { ...e, punkty, nastepny: nast ? { nazwa: nast.nazwa, od: nast.od, brakuje: nast.od - punkty } : null };
    }

    async function zasadyZPliku() { try { return JSON.parse(await fs.readFile(PLIK_ZASAD(), 'utf8')); } catch { return null; } }

    async function stan() {
        const o = await wszystkie();
        const zrodla = {};
        for (const w of o) {
            const z = (zrodla[w.zrodlo] ??= { nazwa: ZRODLA[w.zrodlo] ?? w.zrodlo, poprawki: 0, decyzje: 0 });
            if (w.rodzaj === 'poprawka') z.poprawki++; else z.decyzje++;
        }
        const poprawki = o.filter((w) => w.rodzaj === 'poprawka').length;
        const rundy = await czytajJsonl(PLIK_RUND());
        const sedziowie = {};
        for (const r of rundy) sedziowie[r.sedzia] = (sedziowie[r.sedzia] ?? 0) + 1;
        return {
            obserwacji: o.length, poprawki, decyzje: o.length - poprawki, zrodla,
            etap: etap(poprawki * 2 + (o.length - poprawki) + rundy.length),
            ostatnie: o.slice(-12).reverse(), zasady: await zasadyZPliku(),
            rundyKodeksa: { par: rundy.length, zadan: new Set(rundy.map((r) => r.zadanie)).size, sedziowie, ostatnie: rundy.slice(-5).reverse().map(({ odrzucona: _o, przyjeta: _p, ...r }) => r) },
        };
    }

    /** Dane treningowe Mistrza z poprawek → katalog Kuźni Soup (bez treningu). */
    /**
     * ⚖️ Rundy Kodeksa po zadaniu: odrzucone przez sędziów + przyjęta → pary „źle → dobrze”. Tylko zadanie, które
     * w końcu PRZESZŁO i miało porażki po drodze (sama porażka nie ma „dobrze”, samo zwycięstwo nie ma „źle”).
     */
    async function rundaKodeksa({ projekt, zadanie, cel, model, ok, odrzucone = [], przyjete = null, rundy } = {}) {
        if (!ok || !przyjete?.length || !odrzucone.length) return [];
        const przyjeta = plikiJakoTekst(przyjete);
        const wpisy = odrzucone.filter((r) => r.pliki?.length).map((r) => ({
            projekt: String(projekt), zadanie: String(zadanie ?? ''), cel: tnij(cel), model: String(model ?? ''), runda: r.runda,
            sedzia: sedziaZPowodu(r.powod), powod: tnij(r.powod).slice(0, 800), odrzucona: plikiJakoTekst(r.pliki), przyjeta, rundaPrzyjeta: rundy,
        }));
        const z = await dopiszDo(PLIK_RUND(), wpisy);
        if (z.length) {
            const kto = [...new Set(z.map((r) => r.sedzia))].join(', ');
            const ile = z.length === 1 ? 'rundę' : z.length < 5 ? 'rundy' : 'rund';
            await wiesc({ rodzaj: 'kodeks', glos: true, tresc: `⚖️ Kodeks (${String(model).replace(/^.*[/:]/, '').slice(0, 40)}) na „${projekt}” przegrał ${z.length} ${ile} (${kto}) i wygrał w ${rundy}. — „${String(cel).slice(0, 80)}”. Zapisałem ${z.length} ${z.length === 1 ? 'parę' : z.length < 5 ? 'pary' : 'par'} „źle → dobrze”.` }).catch(() => {});
            await poObserwacji().catch(() => {});
        }
        return z;
    }

    /**
     * 💡 Podpowiedź dla następnej próby Kodeksa. `bledy` = [{model, powod}] wszystkich odrzuconych rund tego zadania
     * (wszystkich modeli łańcucha). Uparty sędzia → także wieść do Suwerena (raz na zadanie i sędziego).
     */
    async function podpowiedzKodeksowi({ projekt = '', cel = '', bledy = [] } = {}) {
        const p = ulozPodpowiedz({ bledy, historia: await czytajJsonl(PLIK_RUND()), projekt });
        if (!p?.uparty) return p;
        const klucz = `uparty:${crypto.createHash('sha1').update(`${projekt}|${cel}|${p.uparty.sedzia}`).digest('hex').slice(0, 16)}`;
        const k = await czytajKanal();
        if (!k[klucz]) {
            await zapiszKanal({ ...k, [klucz]: new Date().toISOString() });
            await wiesc({ rodzaj: 'kodeks', glos: true, tresc: `🧐 Sędzia „${p.uparty.sedzia}” odrzucił ${p.uparty.razy} rund u ${p.uparty.modele.length} modeli na „${projekt}” — „${String(cel).replace(/\s+/g, ' ').slice(0, 80)}”. Daję im podpowiedź, ale rzuć okiem: może to sędzia się myli.` }).catch(() => {});
        }
        return p;
    }

    async function kurs({ zapisz = true } = {}) {
        const o = (await wszystkie()).filter((w) => w.rodzaj === 'poprawka');
        const system = 'Piszesz tak, jak pisze Suweren Katedry OtakOS — jego słowami, rytmem i wyborami. Po polsku, konkretnie.';
        const prompt = (w) => [`[${ZRODLA[w.zrodlo] ?? w.zrodlo}${w.tytul ? ` — ${w.tytul}` : ''}]`, w.kontekst ? `Wcześniej:\n${w.kontekst}` : null, `Napisz: ${w.kto}`].filter(Boolean).join('\n');
        const pary = o.map((w) => ({ prompt: `${system}\n\n${prompt(w)}`, chosen: w.po, rejected: w.przed }));
        const sft = o.map((w) => ({ messages: [{ role: 'system', content: system }, { role: 'user', content: prompt(w) }, { role: 'assistant', content: w.po }] }));
        let gdzie = null;
        if (zapisz && katalogKuzni && pary.length) {
            gdzie = path.join(katalogKuzni, 'mistrz');
            await fs.mkdir(gdzie, { recursive: true });
            const jl = (xs) => xs.map((x) => JSON.stringify(x)).join('\n') + '\n';
            await fs.writeFile(path.join(gdzie, 'pary-suwerena.jsonl'), jl(pary), 'utf8');
            await fs.writeFile(path.join(gdzie, 'sft-suwerena.jsonl'), jl(sft), 'utf8');
        }
        const rundy = await czytajJsonl(PLIK_RUND());
        const paryKodu = rundy.map((r) => ({ prompt: `Projekt: ${r.projekt}\nZADANIE SUWERENA:\n${r.cel}\nOddaj pliki w blokach === PLIK: … === / === KONIEC ===.`, chosen: r.przyjeta, rejected: r.odrzucona }));
        let katalogKodeksa = null;
        if (zapisz && katalogKuzni && paryKodu.length) {
            katalogKodeksa = path.join(katalogKuzni, 'kodeks');
            await fs.mkdir(katalogKodeksa, { recursive: true });
            await fs.writeFile(path.join(katalogKodeksa, 'pary-kodeksa.jsonl'), paryKodu.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');
        }
        return { pary: pary.length, sft: sft.length, paryKodeksa: paryKodu.length, katalog: gdzie, katalogKodeksa, przyklad: pary[0] ?? null };
    }

    /** Lekcja stylu: Mistrz spisuje zasady z ostatnich obserwacji (każda z dowodami). */
    async function lekcja({ ile = 60 } = {}) {
        if (!pisz) throw new Error('JaJo nie ma modelu do pisania lekcji.');
        const o = (await wszystkie()).slice(-Math.min(150, Math.max(10, Number(ile) || 60)));
        const poprawki = o.filter((w) => w.rodzaj === 'poprawka');
        if (poprawki.length < 5) throw new Error(`Za mało poprawek na lekcję: ${poprawki.length} (potrzeba 5). Popraw kilka dialogów albo opisów — JaJo uczy się z Twoich zmian.`);
        const linie = o.map((w) => w.rodzaj === 'poprawka'
            ? `#${w.nr} [${ZRODLA[w.zrodlo] ?? w.zrodlo}, ${w.kto}] MODEL: «${w.przed.slice(0, 300)}» → SUWEREN: «${w.po.slice(0, 300)}»`
            : `#${w.nr} [${ZRODLA[w.zrodlo] ?? w.zrodlo}] DECYZJA: ${w.werdykt} — ${w.tytul}${w.uwagi ? ` (uwagi: ${w.uwagi.slice(0, 200)})` : ''}`);
        const system = 'Jesteś JaJem Mistrza — TeOgochi, który uczy się stylu Suwerena Katedry OtakOS z jego prawdziwych poprawek i decyzji. Nie zgadujesz i nie schlebiasz: wyciągasz tylko to, co widać w obserwacjach.';
        const prompt = `OBSERWACJE (to, co model napisał, i to, jak Suweren to poprawił albo o czym zdecydował):\n${linie.join('\n')}\n\nSpisz 5–12 ZASAD stylu i wyborów Suwerena — krótko, w trybie rozkazującym, po polsku. Każda zasada w osobnej linii, na końcu w nawiasie kwadratowym numery obserwacji, które ją pokazują, np.:\n1. Skracaj kwestie do jednego zdania, gdy rozmowa przyspiesza. [#3, #8]\nZasada bez numerów obserwacji się nie liczy. Nic poza listą.`;
        const odp = await pisz({ system, prompt });
        const { zasady, odrzucone } = odczytajZasady(odp, new Set(o.map((w) => w.nr)));
        if (!zasady.length) throw new Error(`Mistrz nie oddał zasad z dowodami. Początek odpowiedzi: ${String(odp).slice(0, 200)}`);
        const wynik = { kiedy: teraz().toISOString(), obserwacji: o.length, zasady, odrzucone: odrzucone.length };
        await fs.mkdir(katalog, { recursive: true });
        await fs.writeFile(PLIK_ZASAD(), JSON.stringify(wynik, null, 2), 'utf8');
        const k = await czytajKanal();
        k.poprawkiPrzyLekcji = (await wszystkie()).filter((w) => w.rodzaj === 'poprawka').length;
        await zapiszKanal(k).catch(() => {});
        await fs.writeFile(path.join(katalog, 'zasady.md'), `# Zasady stylu Suwerena (JaJo Mistrza, ${wynik.kiedy.slice(0, 10)})\n\n${zasady.map((z, i) => `${i + 1}. ${z.zasada} [${z.dowody.map((n) => `#${n}`).join(', ')}]`).join('\n')}\n`, 'utf8');
        void szyna?.nadaj?.({ agent: 'JaJo Mistrza', rodzaj: 'praca', tresc: `🥚📜 lekcja stylu: ${zasady.length} zasad z ${o.length} obserwacji` })?.catch?.(() => {});
        return wynik;
    }

    return { poprawkaDialogu, poprawkaPol, decyzja, stan, kurs, lekcja, wszystkie, wiesc, wiesci, rundaKodeksa, podpowiedzKodeksowi };
}

export default { utworzJajo, paryKwestii, podobienstwo, odczytajZasady, plikiJakoTekst, sedziaZPowodu, ETAPY, ZRODLA, PROG_NOWEJ_LEKCJI };
