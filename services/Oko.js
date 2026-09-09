/**
 * 👁️ OKO — jajo, które PATRZY na assety i pisze, co widzi.
 *
 * PO CO TO ISTNIEJE. Silnik wideo dostaje w prompcie tylko `notatki` assetu.
 * Asset bez notatek nie daje mu NIC — a zmierzone było, że w SOLLET 9 z 17
 * assetów miało pusty opis. Tim, Kryształ, Flakonik i zestaw „elli" istniały
 * w bibliotece jako obrazki, o których generator nigdy się nie dowiedział.
 * Suweren słusznie zapytał: „mamy jakieś jajo, co by patrzyło i opisywało?".
 * Mamy. To jest to jajo.
 *
 * ⚠️ MODEL MUSI NAPRAWDĘ WIDZIEĆ, A NIE UDAWAĆ. Zmierzone na Tim/aktor.png
 * (mężczyzna ~40 lat, długie ciemne włosy w kucyk, JASNOniebieskie oczy, blizny
 * na policzku, czarna skóra, fioletowo-różowy neon):
 *
 *   qwen3.5:9b     29 s  „~40 lat, długie ciemne włosy, kucyk, zarost, oczy
 *                         o JASNEJ barwie, rany na twarzy, czarna kurtka
 *                         skórzana, oświetlenie fioletowe, różowy neon"  ✅
 *   gemma4:e2b      6 s  ogólniki + „CIEMNE oczy" — nieprawda               ❌
 *   gemma4:latest  13 s  „Proszę o załączenie obrazu" — twierdzi, że nie
 *                         widzi, choć tokeny dowodzą, że obraz dostał       ❌
 *
 * Dlatego domyślnym okiem jest qwen3.5:9b, a nie szybszy gemma4. Opis, który
 * zmyśla kolor oczu, jest GORSZY niż brak opisu — bo generator go posłucha.
 *
 * ⚠️ `think: false` JEST OBOWIĄZKOWE. Bez tego odpowiedź wraca PUSTA: model
 * zużywa cały budżet tokenów na blok myślenia (zmierzone: eval_count 60,
 * response ""), a panel pokazuje sukces bez treści. To pułapka klasy „atrapa".
 */

import fs from 'fs/promises';
import path from 'path';
import * as Assety from './Assety.js';

/** Domyślne oko. Zmienić można przez OTAKOS_MODEL_WZROKU, ale patrz ostrzeżenie wyżej. */
export const MODEL_WZROKU = process.env.OTAKOS_MODEL_WZROKU || 'qwen3.5:9b';

/** Jeden asset = jedno spojrzenie. 29 s zmierzone, 6 min to zapas na zimny start modelu. */
const LIMIT_MS = Number(process.env.OTAKOS_OKO_LIMIT_MS) || 6 * 60 * 1000;

/**
 * Ile obrazów pokazujemy modelowi na jeden asset.
 *
 * ⚠️ NIE „wszystkie". Arkusz wielokątowy ma 6-7 ujęć; wrzucenie ich wszystkich
 * to ~2000 tokenów obrazu na 6 GB VRAM i minuty czekania za informację, którą
 * niosą już trzy pierwsze. Trzy ujęcia dają twarz, sylwetkę i ubiór.
 */
const MAX_OBRAZOW = Number(process.env.OTAKOS_OKO_OBRAZOW) || 3;

/** Typy, które MAJĄ obraz. Głos i muzyka to dźwięk — oko ich nie opisze i nie udaje, że umie. */
export const TYPY_WIDZIALNE = new Set(['aktor', 'scena', 'rekwizyt']);

const OBRAZY = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

/**
 * O co pytamy przy każdym typie.
 *
 * ⚠️ Każdy prompt kończy się zakazem zmyślania. Model-widzenia poproszony
 * o „opisz postać" chętnie dopisuje imię, zawód i historię, których na obrazie
 * nie ma — a to trafiłoby prosto do promptu generatora jako fakt.
 */
const PYTANIA = {
    aktor: 'Jesteś scenografem. Opisz postać z obrazu tak, by generator wideo odtworzył JĄ SAMĄ '
        + 'w kolejnym kadrze. Podaj: wiek, płeć, włosy (długość, kolor, uczesanie), zarost, oczy, '
        + 'znaki szczególne (blizny, tatuaże, okulary), ubiór, budowę. Po polsku, 2-4 zdania, '
        + 'same fakty widoczne na obrazie. NIE zmyślaj imienia, zawodu ani historii.',
    scena: 'Jesteś scenografem. Opisz miejsce z obrazu tak, by generator wideo odtworzył TO SAMO '
        + 'wnętrze lub plener w kolejnym kadrze. Podaj: rodzaj miejsca, architekturę, materiały, '
        + 'kolory, źródła i barwę światła, porę dnia, charakterystyczne elementy. Po polsku, '
        + '2-4 zdania, same fakty widoczne na obrazie. NIE zmyślaj nazwy miejsca ani fabuły.',
    rekwizyt: 'Jesteś rekwizytorem. Opisz przedmiot z obrazu tak, by generator wideo narysował '
        + 'TEN SAM przedmiot w kolejnym kadrze. Podaj: co to jest, rozmiar względem dłoni, kształt, '
        + 'materiał, kolor, połysk, zdobienia, stan (nowy/zniszczony). Po polsku, 2-3 zdania, '
        + 'same fakty widoczne na obrazie. NIE zmyślaj nazwy ani przeznaczenia, jeśli nie widać.',
};

/**
 * Czy model NAPRAWDĘ widzi obraz.
 *
 * Nie pytamy go o to — modele kłamią w obie strony (gemma4:latest twierdzi, że
 * obrazu nie dostał, choć dostał). Liczymy tokeny wejścia z obrazem i bez.
 * Obraz to kilkaset tokenów; model ślepy zwróci tę samą liczbę albo zero.
 */
export async function czyWidzi({ ollamaBase, model, obrazBase64 }) {
    const zapytaj = async (zObrazem) => {
        const r = await fetch(`${ollamaBase}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Opisz.', ...(zObrazem ? { images: [obrazBase64] } : {}) }],
                stream: false, think: false, options: { num_predict: 1 },
            }),
            signal: AbortSignal.timeout(LIMIT_MS),
        });
        const j = await r.json();
        return Number(j?.prompt_eval_count ?? 0);
    };
    const bez = await zapytaj(false);
    const z = await zapytaj(true);
    return { widzi: z > bez + 50, tokenowBez: bez, tokenowZ: z };
}

/** Czy ścieżka leży w katalogu assetów projektu. Panel bywa wystawiony przez Kwantowy Tunel. */
async function wolnoCzytac(katalogKatedry, projekt, plik) {
    const korzen = path.resolve(await Assety.katalog(katalogKatedry, projekt));
    const p = path.resolve(plik);
    return p === korzen || p.startsWith(korzen + path.sep);
}

/**
 * Które obrazy pokazać modelowi.
 *
 * Kolejność nieprzypadkowa: miniatura (to, co Suweren wybrał jako twarz assetu),
 * potem pozostałe referencje (np. `garderoba`), a arkusz na końcu — bo arkusz
 * to warianty tego samego, a referencje to różne informacje.
 */
export async function obrazyAssetu(katalogKatedry, projekt, asset) {
    const kandydaci = [
        asset.miniatura,
        ...Object.values(asset.referencje ?? {}),
        ...(asset.arkusz ?? []).map((k) => k.plik),
    ].filter(Boolean);

    const wybrane = [];
    const widziane = new Set();
    for (const plik of kandydaci) {
        if (wybrane.length >= MAX_OBRAZOW) break;
        const klucz = path.resolve(plik).toLowerCase();
        if (widziane.has(klucz)) continue;
        widziane.add(klucz);
        if (!OBRAZY.has(path.extname(plik).toLowerCase())) continue;
        if (!(await wolnoCzytac(katalogKatedry, projekt, plik))) continue;
        try {
            const bufor = await fs.readFile(plik);
            wybrane.push({ plik, base64: bufor.toString('base64'), bajtow: bufor.length });
        } catch { /* plik zniknął — pomijamy, resztę i tak opiszemy */ }
    }
    return wybrane;
}

/**
 * Spójrz na jeden asset i napisz, co widzisz.
 *
 * Zwraca `{ ok, opis, powod }` — NIGDY nie wymyśla opisu, gdy nie ma na co
 * patrzeć. `powod` mówi po ludzku, czego zabrakło.
 */
export async function opisz({ katalogKatedry, projekt, id, ollamaBase, model = MODEL_WZROKU }) {
    const asset = await Assety.jeden(katalogKatedry, projekt, id);
    if (!asset) return { ok: false, powod: 'Nie ma takiego assetu w tym projekcie.' };

    if (!TYPY_WIDZIALNE.has(asset.typ)) {
        return {
            ok: false, nazwa: asset.nazwa, typ: asset.typ,
            powod: `„${asset.nazwa}" to ${asset.typ} — dźwięk, nie obraz. Oko tego nie opisze.`,
        };
    }

    const obrazy = await obrazyAssetu(katalogKatedry, projekt, asset);
    if (!obrazy.length) {
        return {
            ok: false, nazwa: asset.nazwa, typ: asset.typ,
            powod: `„${asset.nazwa}" nie ma ani jednej referencji graficznej — nie ma na co patrzeć.`,
        };
    }

    const t0 = Date.now();
    let odpowiedz;
    try {
        const r = await fetch(`${ollamaBase}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: PYTANIA[asset.typ], images: obrazy.map((o) => o.base64) }],
                stream: false,
                think: false,                                  // ⚠️ patrz nagłówek pliku
                options: { num_predict: 400, temperature: 0.3 },  // niska temperatura: opisujemy, nie tworzymy
            }),
            signal: AbortSignal.timeout(LIMIT_MS),
        });
        odpowiedz = await r.json();
    } catch (e) {
        return { ok: false, nazwa: asset.nazwa, typ: asset.typ, powod: `Oko nie doczekało odpowiedzi: ${e.message}` };
    }

    const opis = String(odpowiedz?.message?.content ?? '').trim();
    if (!opis) {
        const czemu = odpowiedz?.error
            ? `Ollama odmówiła: ${odpowiedz.error}`
            : (odpowiedz?.message?.thinking
                ? 'Model oddał samo myślenie, bez treści — sprawdź, czy obsługuje think:false.'
                : 'Model zwrócił pustą odpowiedź.');
        return { ok: false, nazwa: asset.nazwa, typ: asset.typ, powod: czemu };
    }

    return {
        ok: true, id: asset.id, nazwa: asset.nazwa, typ: asset.typ,
        opis, model, obrazow: obrazy.length, sekundy: Math.round((Date.now() - t0) / 1000),
        bylOpis: !!String(asset.notatki ?? '').trim(),
    };
}

/** Zapisz opis w notatkach. Osobno od `opisz`, żeby dało się najpierw zobaczyć, co Oko napisało. */
export async function zapiszOpis({ katalogKatedry, projekt, id, opis }) {
    const asset = await Assety.jeden(katalogKatedry, projekt, id);
    if (!asset) throw new Error('Nie ma takiego assetu w tym projekcie.');
    return Assety.zapisz(katalogKatedry, projekt, {
        id: asset.id, typ: asset.typ, nazwa: asset.nazwa, notatki: String(opis || '').trim(),
    });
}

/**
 * Przejrzyj bibliotekę projektu.
 *
 * ⚠️ Domyślnie tylko assety BEZ opisu. Nadpisywanie tego, co Suweren napisał
 * ręcznie, wymaga świadomego `nadpisuj: true` — opis Solity („23-letnia
 * zjawiskowo piękna kobieta…") niesie zamysł, którego model z obrazka nie
 * odczyta.
 *
 * `naBiezaco` dostaje każdy wynik od razu, bo przegląd 9 assetów to ~4,5 min
 * i panel nie może przez ten czas milczeć.
 */
export async function przejrzyj({
    katalogKatedry, projekt, ollamaBase, model = MODEL_WZROKU,
    nadpisuj = false, zapisuj = true, idki = null, naBiezaco = null,
}) {
    const wszystkie = await Assety.lista(katalogKatedry, projekt);
    const doPrzejrzenia = wszystkie.filter((a) => {
        if (idki && !idki.includes(a.id)) return false;
        if (!TYPY_WIDZIALNE.has(a.typ)) return false;
        if (!nadpisuj && String(a.notatki ?? '').trim()) return false;
        return true;
    });

    const wyniki = [];
    for (const a of doPrzejrzenia) {
        const w = await opisz({ katalogKatedry, projekt, id: a.id, ollamaBase, model });
        if (w.ok && zapisuj) {
            await zapiszOpis({ katalogKatedry, projekt, id: a.id, opis: w.opis });
            w.zapisane = true;
        }
        wyniki.push(w);
        if (naBiezaco) { try { naBiezaco(w); } catch { /* podgląd nie może wywrócić przeglądu */ } }
    }

    const pominiete = wszystkie.filter((a) => !TYPY_WIDZIALNE.has(a.typ) && !String(a.notatki ?? '').trim());
    return {
        model,
        przejrzane: wyniki.length,
        opisane: wyniki.filter((w) => w.ok).length,
        wyniki,
        bezObrazu: pominiete.map((a) => ({ nazwa: a.nazwa, typ: a.typ })),
    };
}

export default { MODEL_WZROKU, TYPY_WIDZIALNE, czyWidzi, obrazyAssetu, opisz, zapiszOpis, przejrzyj };
