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
    let kolejka = Promise.resolve();

    async function wszystkie() {
        try { return (await fs.readFile(PLIK(), 'utf8')).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); }
        catch { return []; }
    }
    function dopisz(wpisy) {
        if (!wpisy.length) return Promise.resolve([]);
        kolejka = kolejka.then(async () => {
            await fs.mkdir(katalog, { recursive: true });
            const n0 = (await wszystkie()).length;
            const z = wpisy.map((w, i) => ({ nr: n0 + i + 1, id: crypto.randomBytes(4).toString('hex'), kiedy: teraz().toISOString(), ...w }));
            await fs.appendFile(PLIK(), z.map((w) => JSON.stringify(w)).join('\n') + '\n', 'utf8');
            return z;
        }).catch(() => []);
        return kolejka;
    }
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
        return { obserwacji: o.length, poprawki, decyzje: o.length - poprawki, zrodla, etap: etap(poprawki * 2 + (o.length - poprawki)), ostatnie: o.slice(-12).reverse(), zasady: await zasadyZPliku() };
    }

    /** Dane treningowe Mistrza z poprawek → katalog Kuźni Soup (bez treningu). */
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
        return { pary: pary.length, sft: sft.length, katalog: gdzie, przyklad: pary[0] ?? null };
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
        await fs.writeFile(path.join(katalog, 'zasady.md'), `# Zasady stylu Suwerena (JaJo Mistrza, ${wynik.kiedy.slice(0, 10)})\n\n${zasady.map((z, i) => `${i + 1}. ${z.zasada} [${z.dowody.map((n) => `#${n}`).join(', ')}]`).join('\n')}\n`, 'utf8');
        void szyna?.nadaj?.({ agent: 'JaJo Mistrza', rodzaj: 'praca', tresc: `🥚📜 lekcja stylu: ${zasady.length} zasad z ${o.length} obserwacji` })?.catch?.(() => {});
        return wynik;
    }

    return { poprawkaDialogu, poprawkaPol, decyzja, stan, kurs, lekcja, wszystkie };
}

export default { utworzJajo, paryKwestii, podobienstwo, odczytajZasady, ETAPY, ZRODLA };
