/**
 * 💭 PokojOpowiesci — miejsce, gdzie opowieść się WYMYŚLA, zanim zacznie się
 * ją produkować.
 *
 * PO CO. Suweren: „brakuje mi miejsca do wymyślania samych opowieści —
 * miejsca, gdzie poprzez rozmowę tekstową z TeOgochi wymyślamy historię,
 * a potem leci automatycznie od punktu 1: wybór reżysera, jakie co-boty itd."
 *
 * DWA TRYBY JEDNEJ ROZMOWY:
 *   1. WYMYŚLANIE — TeOgochi jest partnerem od pomysłów: dopytuje, proponuje
 *      warianty, drąży. Nic nie zapisuje.
 *   2. PRZEKUCIE — na żądanie ta sama rozmowa zamienia się w KONKRET:
 *      nazwę serialu, fakty kanoniczne i listę odcinków z czasem i stylem.
 *      Dopiero to ląduje w pamięci Reżysera i na Tablicy.
 *
 * ⚠️ ROZDZIAŁ TRYBÓW JEST CELOWY. Gdyby model zapisywał w trakcie rozmowy,
 * połowa kanonu byłaby zapisem myśli porzuconych trzy zdania później.
 * Suweren mówi „przekuj", kiedy pomysł dojrzał — i wtedy zapisujemy.
 *
 * ⚠️ PARTNER TO PRAWDZIWY TEOGOCHI, nie wymyślona persona. Imię i dziedzinę
 * bierzemy z migawki stada; gdy stada nie ma, mówimy to wprost zamiast
 * podstawiać „asystenta".
 */

import fs from 'fs/promises';
import path from 'path';

/** Ile ostatnich tur wchodzi do promptu. Mały model gubi początek instrukcji. */
const OKNO_ROZMOWY = 12;

/**
 * Prompt rozmowy. Partner ma DRĄŻYĆ, nie streszczać — najczęstsza wada małych
 * modeli w burzy mózgów to zgadzanie się ze wszystkim i podsumowywanie.
 */
export function promptRozmowy({ gatunek = null, kotwica = '', assety = '', rece = false }) {
    const kto = gatunek
        ? `Jesteś ${gatunek.imie} — agentem Katedry OtakOS od dziedziny „${gatunek.dziedzina}".`
        : 'Jesteś towarzyszem od wymyślania opowieści w Katedrze OtakOS.';

    return [
        kto,
        'Rozmawiacie o POMYŚLE na serial. Odpowiadasz po polsku, 2-4 zdania.',
        '',
        'JAK ROZMAWIASZ:',
        '· Dopytujesz o konkret: kto, gdzie, czego chce, co stoi na przeszkodzie.',
        '· Proponujesz WARIANTY („może tak, albo zupełnie inaczej: …"), nie jedną słuszną wersję.',
        '· Gdy pomysł jest mglisty, mówisz to wprost i pytasz o brakujący element.',
        '· NIE streszczasz tego, co Suweren przed chwilą powiedział — to strata jego czasu.',
        '· NIE zapisujesz niczego i nie obiecujesz, że zapisałeś. Od zapisu jest osobny przycisk.',
        // ⚠️ ŚWIADOMOŚĆ JOANNY, NIE JEJ RĘCE. Suweren chciał, żeby moduł Opowieści
        // „był świadomy takiej możliwości współpracy”. Więc TeOgochi ma o Joannie
        // WIEDZIEĆ i pytać o muzykę — ale komponowanie zleca człowiek w Music
        // Studio. Obietnica „już każę jej skomponować” bez akcji to atrapa,
        // a ta pułapka raz już nas kosztowała wiarę w panel.
        '',
        'MUZYKA — MASZ KOMPOZYTORKĘ:',
        '· W Katedrze pracuje JOANNA — TeOgochi od muzyki. Potrafi skomponować utwór',
        '  DOKŁADNIE na długość gotowego materiału wideo (Montażownia → SKOMPONUJ).',
        '· Dlatego pytaj o brzmienie tak samo jak o obraz: czym ma być wypełniona cisza,',
        '  gdzie wchodzi motyw, co ma zamilknąć. To trafia do briefu w polu `muzyka`.',
        '· NIE obiecujesz, że już każeś jej grać. Mówisz, że można ją o to poprosić',
        '  w Montażowni — i tam Suweren wciska przycisk.',
        kotwica.trim() ? `\nCO JUŻ ISTNIEJE W TYM ŚWIECIE (nie zaprzeczaj):\n${kotwica.trim().slice(0, 1200)}` : '',
        // ⚠️ Biblioteka OSOBNO od kanonu. Fakt „Molita nosi perukę" i wpis
        // „Molita — aktorka z arkuszem 6 widoków" to dwie różne rzeczy; sklejone
        // w jeden blok gubiłyby się nawzajem.
        assety.trim()
            ? `\nBIBLIOTEKA TEGO PROJEKTU — to JUŻ istnieje, nie wymyślaj tego od nowa:\n${assety.trim().slice(0, 1400)}`
            : '',
        rece ? instrukcjaRak() : '',
    ].filter(Boolean).join('\n');
}

/** Historia rozmowy przycięta do okna — najnowsze tury są najważniejsze. */
export function zwezHistorie(historia = []) {
    return historia
        .filter((t) => t && typeof t.tresc === 'string' && t.tresc.trim())
        .slice(-OKNO_ROZMOWY)
        .map((t) => `${t.kto === 'suweren' ? 'SUWEREN' : 'TEOGOCHI'}: ${t.tresc.trim()}`)
        .join('\n');
}

/**
 * Prompt przekucia rozmowy w serial.
 *
 * ⚠️ Wymuszamy JSON i KONKRETNE pola, bo to, co z niego wyjdzie, ląduje
 * prosto w pamięci Reżysera. „Ciekawy świat pełen tajemnic" jako fakt
 * kanoniczny nie pomoże żadnemu kadrowi.
 */
export function promptPrzekucia({ historia = [], ile = 3 }) {
    const system = [
        'Jesteś SCENARZYSTĄ zamieniającym luźną rozmowę w konkret produkcyjny.',
        'Odpowiadasz po polsku, WYŁĄCZNIE obiektem JSON, bez komentarza i bez płotu z backticków.',
        '',
        'Kształt odpowiedzi:',
        '{',
        '  "serial": "krótka nazwa projektu",',
        '  "fakty": ["zdanie o świecie albo postaci, któremu kolejne odcinki nie mogą zaprzeczyć", …],',
        `  "odcinki": [{"tytul":"…","streszczenie":"co się dzieje","czasMinut":3,"styl":"jak to wygląda"}, …]`,
        '}',
        '',
        'ŻELAZNE ZASADY:',
        '1. FAKTY to rzeczy SPRAWDZALNE w kadrze: wygląd postaci, kolor światła, zasada świata.',
        '   „Świat pełen tajemnic" nie jest faktem. „Molita nosi brunetną perukę" — jest.',
        `2. Odcinków ma być ${ile}, każdy z własną akcją. Nie powtarzaj tej samej sceny.`,
        '3. `czasMinut` to liczba (1-30). `styl` opisuje OBRAZ, nie nastrój fabuły.',
        '4. Bierzesz TYLKO to, co padło w rozmowie. Nie dokładasz wątków, o których nikt nie mówił.',
    ].join('\n');

    const prompt = [
        '— ROZMOWA —',
        zwezHistorie(historia) || '(pusto)',
        '',
        `Przekuj to w projekt: nazwa, fakty kanoniczne i ${ile} odcinków. Sam JSON.`,
    ].join('\n');

    return { system, prompt };
}

/**
 * Wyłuskaj obiekt z odpowiedzi modelu i przytnij do sensownych granic.
 * ⚠️ Bierzemy pierwszy `{` i ostatni `}` — modele lubią obudować JSON zdaniem.
 */
export function odczytajPrzekucie(surowe, ile = 3) {
    const t = String(surowe || '');
    const start = t.indexOf('{');
    const koniec = t.lastIndexOf('}');
    if (start < 0 || koniec <= start) {
        throw new Error(`Model nie oddał obiektu JSON. Dostałem: ${t.slice(0, 200)}`);
    }
    let d;
    try { d = JSON.parse(t.slice(start, koniec + 1)); } catch (e) {
        throw new Error(`Przekucie jest niepoprawnym JSON-em: ${e.message}`);
    }

    const serial = String(d.serial || d.nazwa || '').trim().slice(0, 80);
    if (serial.length < 2) throw new Error('Model nie nazwał serialu.');

    const fakty = (Array.isArray(d.fakty) ? d.fakty : [])
        .map((f) => String(typeof f === 'string' ? f : f?.tresc || '').trim())
        // Fakt krótszy niż 10 znaków to etykieta, nie fakt.
        .filter((f) => f.length >= 10)
        .slice(0, 12);

    const odcinki = (Array.isArray(d.odcinki) ? d.odcinki : [])
        .map((o) => {
            const czas = Number(o?.czasMinut ?? o?.czas);
            return {
                tytul: String(o?.tytul || '').trim().slice(0, 90),
                streszczenie: String(o?.streszczenie || o?.opis || '').trim(),
                czasMinut: Number.isFinite(czas) && czas > 0 && czas <= 30 ? czas : null,
                styl: String(o?.styl || '').trim().slice(0, 200),
                status: 'plan',
            };
        })
        .filter((o) => o.tytul.length >= 3 && o.streszczenie.length >= 10)
        .slice(0, Math.max(1, Math.min(ile, 12)));

    if (!odcinki.length) throw new Error('Model nie oddał ani jednego odcinka z tytułem i opisem.');
    return { serial, fakty, odcinki };
}


// ══════════════════════════════════════════════════════════════════════════════
//  HISTORIA ROZMÓW — „potrzebuje historię opowieści, jakie tam się odbyły"
// ══════════════════════════════════════════════════════════════════════════════

const PLIK_HISTORII = 'opowiesci.json';
const MAX_ROZMOW = 60;

/**
 * ⚠️ ZAPIS ATOMOWY (tmp → rename). Rozmowa bywa zapisywana w trakcie pisania
 * następnej tury; przerwany zapis w połowie zostawiłby plik, którego nie da się
 * odczytać — czyli utratę CAŁEJ historii, nie jednej rozmowy.
 */
async function zapiszPlik(katalog, dane) {
    await fs.mkdir(katalog, { recursive: true });
    const cel = path.join(katalog, PLIK_HISTORII);
    const tmp = `${cel}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(dane, null, 2), 'utf8');
    await fs.rename(tmp, cel);
}

export async function historia(katalog) {
    try {
        const d = JSON.parse(await fs.readFile(path.join(katalog, PLIK_HISTORII), 'utf8'));
        return Array.isArray(d.rozmowy) ? d.rozmowy : [];
    } catch { return []; }
}

/** Tytuł rozmowy z pierwszej wypowiedzi Suwerena — tak się ją potem poznaje. */
function tytulZRozmowy(turyRozmowy) {
    const pierwsza = turyRozmowy.find((t) => t.kto === 'suweren')?.tresc ?? '';
    const czysta = pierwsza.trim().replace(/\s+/g, ' ');
    return czysta.length > 70 ? `${czysta.slice(0, 67)}…` : (czysta || 'rozmowa bez tytułu');
}

/**
 * Zapisz albo zaktualizuj rozmowę. `id` puste = nowa.
 * ⚠️ Pusta rozmowa NIE jest zapisywana — lista zapełniona sesjami po jednym
 * kliknięciu byłaby bezużyteczna.
 */
export async function zapisz(katalog, { id = '', tury = [], gatunek = null, serial = null }) {
    const sensowne = (tury ?? []).filter((t) => t?.tresc?.trim());
    if (sensowne.length < 2) throw new Error('Za krótka rozmowa, żeby ją zapisywać.');

    const rozmowy = await historia(katalog);
    const teraz = new Date().toISOString();
    const istniejaca = id ? rozmowy.find((r) => r.id === id) : null;

    if (istniejaca) {
        istniejaca.tury = sensowne;
        istniejaca.gatunek = gatunek ?? istniejaca.gatunek;
        istniejaca.serial = serial ?? istniejaca.serial;
        istniejaca.tytul = tytulZRozmowy(sensowne);
        istniejaca.zmieniono = teraz;
    } else {
        rozmowy.unshift({
            id: `opow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            tytul: tytulZRozmowy(sensowne),
            tury: sensowne, gatunek, serial,
            kiedy: teraz, zmieniono: teraz,
        });
    }

    // Najstarsze wypadają — plik ma zostać czytelny, nie kompletny co do joty.
    const przyciete = rozmowy.slice(0, MAX_ROZMOW);
    await zapiszPlik(katalog, { rozmowy: przyciete });
    return istniejaca ?? przyciete[0];
}

/** Odnotuj, że z tej rozmowy powstał projekt — po to, żeby było widać skutek. */
export async function oznaczPrzekute(katalog, id, serial) {
    const rozmowy = await historia(katalog);
    const r = rozmowy.find((x) => x.id === id);
    if (!r) return null;
    r.serial = serial;
    r.przekute = new Date().toISOString();
    await zapiszPlik(katalog, { rozmowy });
    return r;
}

export async function usun(katalog, id) {
    const rozmowy = await historia(katalog);
    const i = rozmowy.findIndex((r) => r.id === id);
    if (i < 0) throw new Error(`Nie znam rozmowy „${id}".`);
    const [usunieta] = rozmowy.splice(i, 1);
    await zapiszPlik(katalog, { rozmowy });
    return usunieta;
}

// ═════════════════════════════════════════════════════════════════════════════
//  OCZY I RĘCE — partner widzi bibliotekę projektu i może do niej dopisywać
//
//  Suweren: „mam przygotowane te wszystkie assety w projekcie Solita — jak
//  przejdę do modułu opowieści i powiem memu TeOgochi o tych assetach, to je
//  zobaczy? I czy w przyszłym projekcie będzie można to wytworzyć już w samym
//  czacie, bo sam będzie korzystał z modułu i dodawał assety".
//
//  Do tej pory partner NIE widział assetow — do promptu szły wyłącznie fakty
//  kanonu. Mógł więc wymyślić postać, która od dawna ma już twarz i arkusz
//  sylwetek, i nikt by tego nie złapał.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Biblioteka projektu w formie, którą model ogarnie jednym spojrzeniem.
 *
 * ⚠️ MÓWIMY, CZEGO ASSET NIE MA. „Solita — aktorka, bez roli, bez arkusza"
 * niesie więcej niż sama nazwa: partner może zapytać o rolę, zamiast wymyślać
 * drugą Solitę od zera.
 */
export function spisAssetow(assety = [], role = {}) {
    if (!assety.length) return '';
    const wg = {};
    for (const a of assety) (wg[a.typ] ??= []).push(a);

    const etykiety = { aktor: 'AKTORZY', scena: 'SCENY', rekwizyt: 'REKWIZYTY', glos: 'GŁOSY', muzyka: 'MUZYKA' };
    const linie = [];
    for (const [typ, lista] of Object.entries(wg)) {
        linie.push(`${etykiety[typ] ?? typ.toUpperCase()}:`);
        for (const a of lista) {
            const cechy = [];
            if (a.rola) cechy.push(role[a.rola] ?? a.rola);
            else if (typ === 'aktor') cechy.push('bez roli');
            if (a.arkusz?.length) cechy.push(`${a.arkusz.length} widoków`);
            if (a.referencje && Object.keys(a.referencje).length) cechy.push(`referencje: ${Object.keys(a.referencje).join('/')}`);
            if (a.notatki) cechy.push(a.notatki.slice(0, 80));
            linie.push(`  · ${a.nazwa}${cechy.length ? ` (${cechy.join(', ')})` : ''}`);
        }
    }
    return linie.join('\n');
}

/**
 * Co partner wolno mu ZROBIĆ, nie tylko powiedzieć.
 *
 * ⚠️ KASOWANIA TU NIE MA I NIE BĘDZIE. Pokój Opowieści bywa wystawiony przez
 * Kwantowy Tunel na telefon; rozmowa, która potrafi skasować obsadę, to jedno
 * niefortunne zdanie od straty dorobku. Kasuje się ręcznie, w Assetach.
 */
export const AKCJE = new Set(['dodaj_asset', 'zmien_asset']);

/** Instrukcja rąk doklejana do promptu — tylko gdy jest do czego (znany projekt). */
export function instrukcjaRak() {
    return [
        '',
        'MASZ RĘCE. Gdy Suweren PROSI, żeby coś dopisać do biblioteki projektu,',
        'kończysz wypowiedź osobną linią w tej postaci (i niczym po niej):',
        '[[AKCJA: {"akcja":"dodaj_asset","typ":"aktor","nazwa":"…","rola":"glowna","notatki":"…"}]]',
        '',
        'ZASADY RĄK:',
        '· `typ`: aktor | scena | rekwizyt | glos | muzyka.',
        '· `rola` (tylko aktor): glowna | drugoplanowa | epizod | tlo | narrator | antagonista.',
        '  Nie znasz roli — pomiń pole. Zgadywanie obsady za człowieka to nie jest pomoc.',
        '· `zmien_asset` działa tak samo, ale na assecie o TEJ SAMEJ nazwie i typie.',
        '· JEDNA akcja na wypowiedź. Nie dopisujesz nic, o co nie poproszono.',
        '· Nie kasujesz — nie masz takiej akcji.',
        '· Nie meldujesz „dopisałem", dopóki nie zobaczysz potwierdzenia. Katedra',
        '  wykonuje akcję i sama mówi, co naprawdę powstało.',
    ].join('\n');
}

/**
 * Wyłuskaj akcję z wypowiedzi. Zwraca `{ mowa, akcja }` — mowa BEZ linii akcji,
 * bo Suweren nie ma oglądać nawiasu z JSON-em.
 *
 * ⚠️ Nieznana akcja jest ODRZUCANA po cichu, ale mowa zostaje. Model, który
 * wymyślił sobie `skasuj_wszystko`, ma zostać bez rąk, a nie wywalić rozmowę.
 */
export function odczytajAkcje(surowe) {
    const t = String(surowe || '');
    const m = t.match(/\[\[AKCJA:\s*(\{[\s\S]*?\})\s*\]\]/);
    if (!m) return { mowa: t.trim(), akcja: null };

    const mowa = t.replace(m[0], '').trim();
    let d;
    try { d = JSON.parse(m[1]); } catch { return { mowa, akcja: null, powod: 'Akcja nie była poprawnym JSON-em.' }; }

    const akcja = String(d?.akcja || '').trim();
    if (!AKCJE.has(akcja)) return { mowa, akcja: null, powod: `Nie znam akcji „${akcja}".` };

    return {
        mowa,
        akcja: {
            akcja,
            typ: String(d.typ || '').trim(),
            nazwa: String(d.nazwa || '').trim(),
            rola: d.rola === undefined ? undefined : String(d.rola || '').trim(),
            notatki: String(d.notatki || '').trim(),
        },
    };
}

/**
 * Czy Suweren PROSI o dopisanie czegoś do biblioteki.
 *
 * ⚠️ BRAMKA JEST PO TO, ŻEBY NIE PŁACIĆ DWA RAZY ZA KAŻDĄ TURĘ. Ręce to
 * osobne wywołanie modelu; odpalanie go przy każdym zdaniu podwoiłoby czas
 * odpowiedzi w rozmowie, która w 90% jest zwykłym gadaniem o pomyśle.
 *
 * Potrzebne są OBA warunki: czasownik polecenia I rzeczownik z biblioteki.
 * Samo „dodajmy jej tajemniczości" nie jest prośbą o asset.
 */
export function czyProsiOAsset(wypowiedz = '') {
    const w = String(wypowiedz);
    const polecenie = /\b(dopisz|dodaj|utw[o\u00f3]rz|stw[o\u00f3]rz|zapisz|wpisz|za\u0142\u00f3\u017c)\b/i.test(w);
    const rzecz = /(asset|posta\u0107|postac|aktor|bohater|scen|lokacj|miejsc|rekwizyt|przedmiot|g\u0142os|glos|muzyk)/i.test(w);
    return polecenie && rzecz;
}

/**
 * Osobne, WĄSKIE wywołanie: jedno zadanie — zamień prośbę w akcję albo odmów.
 *
 * ⚠️ DLACZEGO OSOBNO, A NIE W ROZMOWIE. Pierwsza wersja prosiła partnera, żeby
 * DOKLEIŁ linię `[[AKCJA: …]]` do swojej wypowiedzi. Sprawdzone na żywym
 * `gemma4:e2b`: model zignorował instrukcję i po prostu ładnie pogadał o barmanie.
 * Mały model robi dobrze JEDNĄ rzecz naraz — więc rozmowa jest rozmową,
 * a akcja osobnym pytaniem z jedną odpowiedzią do wydania.
 */
export function promptRak({ wypowiedz, spis = '' }) {
    const system = [
        'Zamieniasz prośbę człowieka w JEDEN wpis do biblioteki projektu filmowego.',
        'Odpowiadasz WYŁĄCZNIE obiektem JSON, bez komentarza i bez płotu z backticków.',
        '',
        'Kształt:',
        '{"akcja":"dodaj_asset","typ":"aktor","nazwa":"…","rola":"epizod","notatki":"…"}',
        'albo, gdy to nie jest prośba o wpis: {"akcja":null}',
        '',
        'ŻELAZNE ZASADY:',
        '1. `typ`: aktor | scena | rekwizyt | glos | muzyka. Nic innego.',
        '2. `rola` TYLKO dla aktora: glowna | drugoplanowa | epizod | tlo | narrator | antagonista.',
        '   Nie pada w prośbie — pomiń pole. Nie zgadujesz obsady za człowieka.',
        '3. `nazwa` to samo imię albo nazwa, bez opisu. „Barman Krys", nie „Barman Krys, który…".',
        '4. `notatki` to jedno zdanie z tego, co POWIEDZIANO. Nie dopowiadasz.',
        '5. Jeden wpis. Gdy prośba dotyczy kilku rzeczy — bierzesz pierwszą.',
        '6. Gdy taki asset już jest na liście — `{"akcja":null}`. Od poprawiania jest panel.',
    ].join('\n');

    const prompt = [
        spis ? `— CO JUŻ JEST W BIBLIOTECE —\n${spis}\n` : '',
        `— PROŚBA —\n${String(wypowiedz).slice(0, 600)}`,
        '',
        'Sam JSON.',
    ].filter(Boolean).join('\n');

    return { system, prompt };
}

/**
 * Odmiana roli → postać kanoniczna.
 *
 * ⚠️ TO NIE JEST ZGADYWANIE. Model oddał `"epizodyczna"` zamiast `"epizod"` —
 * to TA SAMA rola w innej formie gramatycznej, nie inna decyzja obsadowa.
 * Odrzucanie tego to karanie za polską fleksję.
 *
 * Lista jest ZAMKNIĘTA i jawna. Dopasowanie „na oko" (np. po podobieństwie
 * napisów) potrafiłoby zamienić `antagonista` na `narrator` i nikt by nie
 * zauważył — dlatego każda forma jest tu wypisana z ręki.
 */
const ODMIANY_ROL = {
    glowna: 'glowna', 'g\u0142\u00f3wna': 'glowna', glowny: 'glowna', 'g\u0142\u00f3wny': 'glowna', 'g\u0142\u00f3wna rola': 'glowna',
    drugoplanowa: 'drugoplanowa', drugoplanowy: 'drugoplanowa', 'drugi plan': 'drugoplanowa',
    epizod: 'epizod', epizodyczna: 'epizod', epizodyczny: 'epizod', epizodystka: 'epizod',
    tlo: 'tlo', 't\u0142o': 'tlo', statysta: 'tlo', statystka: 'tlo',
    narrator: 'narrator', narratorka: 'narrator', lektor: 'narrator',
    antagonista: 'antagonista', antagonistka: 'antagonista', 'czarny charakter': 'antagonista',
};

/** Sprowadź rolę do postaci kanonicznej albo oddaj `undefined`, gdy nie znamy. */
export function znormalizujRole(rola) {
    const r = String(rola ?? '').trim().toLowerCase();
    if (!r) return undefined;
    return ODMIANY_ROL[r];
}

/** Wyłuskaj i sprawdź akcję z odpowiedzi wąskiego wywołania. */
export function odczytajRece(surowe) {
    const t = String(surowe || '');
    const start = t.indexOf('{');
    const koniec = t.lastIndexOf('}');
    if (start < 0 || koniec <= start) return { akcja: null, powod: 'Model nie oddał JSON-a.' };

    let d;
    try { d = JSON.parse(t.slice(start, koniec + 1)); } catch { return { akcja: null, powod: 'Niepoprawny JSON.' }; }
    if (!d || d.akcja === null || d.akcja === undefined) return { akcja: null };

    const akcja = String(d.akcja).trim();
    if (!AKCJE.has(akcja)) return { akcja: null, powod: `Nie znam akcji „${akcja}".` };

    const nazwa = String(d.nazwa || '').trim();
    if (nazwa.length < 2) return { akcja: null, powod: 'Akcja bez nazwy.' };

    return {
        akcja: {
            akcja,
            typ: String(d.typ || '').trim(),
            nazwa,
            // Odmiana przyjmowana, nieznana rola — pomijana. Lepszy asset bez roli
            // niż odrzucona prośba przez jedną końcówkę.
            rola: znormalizujRole(d.rola),
            notatki: String(d.notatki || '').trim(),
        },
    };
}

export default {
    promptRozmowy, zwezHistorie, promptPrzekucia, odczytajPrzekucie, OKNO_ROZMOWY,
    spisAssetow, instrukcjaRak, odczytajAkcje, AKCJE,
    czyProsiOAsset, promptRak, odczytajRece, znormalizujRole,
    historia, zapisz, oznaczPrzekute, usun,
};