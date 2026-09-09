/**
 * 🎞️ KolejkaKadrow — wyrenderuj WSZYSTKIE kadry po kolei i zmontuj w jedno.
 *
 * PO CO. Suweren: „mam te wszystkie kadry, a nigdzie nie mam, by je wytworzył
 * wszystkie po kolei i zmontował w jedno". Na jego tablicy leżą 132 karty
 * etapu KADR — klikanie ich pojedynczo to nie jest praca dla człowieka.
 *
 * ⚠️ WYNIKI LĄDUJĄ W KATEDRZE, NIE W COMFYUI. Druga skarga brzmiała:
 * „wygenerowane sceny są zapisywane w ComfyUI, a nie w OtakOS". ComfyUI zapisuje
 * u siebie, bo tam liczy — więc po każdym ujęciu KOPIUJEMY plik do katalogu
 * projektu (`_OtakOs_Wymiar/produkcje/<slug>/ujecia/`) i dopiero TĘ ścieżkę
 * wpisujemy w kartę. Oryginał w ComfyUI zostaje jako materiał roboczy.
 *
 * ⚠️ KARTA DOSTAJE PRAWDZIWĄ ŚCIEŻKĘ, NIE OPIS. Do pola `zwrot` idzie ścieżka
 * pliku, który istnieje. To dokładnie odwrotność tego, co robił „Lokalny Flow":
 * on wpisywał tam nazwę PIERWSZEGO lepszego filmu z dysku Suwerena i meldował
 * sukces. Plik był, ale nie był wynikiem tej pracy.
 *
 * ⚠️ KOLEJKA JEST SZEREGOWA I TO NIE JEST LENISTWO. Karta ma 6 GB VRAM;
 * dwa ujęcia naraz to OOM i dwa stracone renderowania zamiast jednego gotowego.
 */

import fs from 'fs/promises';
import path from 'path';
import { slug, utworzProjekt } from './Produkcje.js';

/** Ile zadań trzymamy w pamięci. */
const MAX_ZADAN = 10;
const zadania = new Map();

/** Górny limit kadrów w jednym przebiegu — inaczej kolejka idzie dobę. */
export const MAX_KADROW = 60;

/** Katalog ujęć projektu — tam wyniki lądują na stałe. */
export async function katalogUjec(katalog, projekt) {
    const { sciezka } = await utworzProjekt(katalog, projekt);
    const kat = path.join(sciezka, 'ujecia');
    await fs.mkdir(kat, { recursive: true });
    return kat;
}

/**
 * Prompt ujęcia z karty kadru. Kotwica doklejana ZAWSZE — każdy kadr liczy
 * się osobno i model nie pamięta poprzedniego.
 */
/**
 * Wygląd postaci, które NAPRAWDĘ występują w tym kadrze.
 *
 * PO CO. Suweren: „chyba nie bardzo korzysta z przygotowanych assetów — mam
 * wielowymiarową prezentację bytów". I miał rację: prompt renderu dostawał
 * opis kadru („Solita i Molita są blisko siebie") i biblię projektu, ale NIGDY
 * wyglądu Solity. Silnik nie miał się czego złapać i rysował abstrakcyjne kształty.
 *
 * ⚠️ DOKŁADAMY TYLKO TYCH, KTÓRZY SĄ W KADRZE. Wklejenie całej obsady do
 * każdego ujęcia zapełniłoby prompt opisami ludzi, których w nim nie ma —
 * a model rysuje to, co przeczyta.
 *
 * ⚠️ DOPASOWANIE PO CAŁYM SŁOWIE. „Tim" nie może złapać się w „intymny";
 * bez granicy słowa krótkie imiona wciągałyby do kadru przypadkowych ludzi.
 */
export function opisObsady(kadr, assety = []) {
    const tekst = `${kadr?.tytul ?? ''} ${kadr?.opis ?? ''}`;
    const opisy = [];

    for (const a of assety) {
        if (!['aktor', 'rekwizyt', 'scena'].includes(a.typ)) continue;
        const nazwa = String(a.nazwa ?? '').trim();
        if (nazwa.length < 3) continue;

        // ⚠️ POLSKA ODMIANA. „Solitę", „Solitą", „Klubie" — dosłowne dopasowanie
        // przepuszczałoby tylko mianownik, a kadry pisze się zdaniami. Bierzemy
        // RDZEŃ: nazwę bez końcowej samogłoski, i żądamy granicy słowa PRZED nim.
        // Granicy PO rdzeniu celowo nie ma — właśnie tam siedzi końcówka.
        //
        // ⚠️ Skracamy dopiero od 5 znaków. Krótkie imiona („Tim") bez końcówki
        // złapałyby się w połowie słownika — sprawdzone: „intymny" wciągałoby Tima.
        const rdzen = nazwa.length >= 5
            ? nazwa.replace(/[aeąęioyu]$/i, '')
            : nazwa;
        const uciekly = rdzen.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&');
        const wzor = new RegExp(`(^|[^\\p{L}])${uciekly}`, 'iu');
        if (!wzor.test(tekst)) continue;

        // Notatka assetu to jego WYGLĄD — to jedyna rzecz, która pomaga silnikowi.
        const wyglad = String(a.notatki ?? '').trim();
        opisy.push(wyglad ? `${nazwa}: ${wyglad.slice(0, 220)}` : nazwa);
    }
    return opisy;
}

/**
 * Prompt ujęcia z karty kadru. Kotwica doklejana ZAWSZE — każdy kadr liczy
 * się osobno i model nie pamięta poprzedniego.
 *
 * Kolejność jest celowa: najpierw CO WIDAĆ (opis kadru), potem KTO (wygląd
 * obsady), na końcu JAK (styl z biblii). Modele obrazowe ważą początek promptu
 * mocniej, a najważniejsza jest treść ujęcia.
 */
export function promptZKadru(kadr, kotwica = '', assety = []) {
    const czesci = [];
    if (kadr.opis?.trim()) czesci.push(kadr.opis.trim());
    // Tytuł tylko wtedy, gdy opisu brak — inaczej dubluje treść.
    else if (kadr.tytul?.trim()) czesci.push(kadr.tytul.trim());

    const obsada = opisObsady(kadr, assety);
    if (obsada.length) czesci.push(obsada.join('. '));

    if (kotwica.trim()) czesci.push(kotwica.trim().slice(0, 400));
    return czesci.join(', ');
}

/**
 * ⚠️ KOLEJNOŚĆ FABULARNA — NIE TA Z TABLICY.
 *
 * Suweren: „trzeba odwrócić kolejność układania kadrów, bo teraz kolejka
 * scala to jakby od końca". Miał rację: Tablica Produkcji sortuje karty
 * NAJNOWSZE NA WIERZCHU (i słusznie — to tablica robocza), więc kolejka brała
 * je od ostatniej sceny do pierwszej i sklejony film lecił tyłem naprzód.
 *
 * Film ma swój własny porządek i bierzemy go z NUMERU W TYTULE („#2.19",
 * „#1.5", „3.04 — …"). Numer bije datę utworzenia, bo kadr dopisany później
 * między sceny ma lądować tam, gdzie mówi jego numer, a nie na końcu filmu.
 * Karty bez numeru idą po ponumerowanych, w kolejności powstawania.
 */
export function numerSceny(kadr) {
    const t = String(kadr?.tytul || '').trim();
    // Numer musi stać NA POCZĄTKU tytułu — „Scena 7" w środku zdania to opis,
    // nie numeracja, a losowa liczba z treści przestawiłaby cały film.
    const m = t.match(/^#?\s*(\d+(?:[.\-_]\d+)*)/);
    if (!m) return null;
    return m[1].split(/[.\-_]/).map(Number);
}

/** Porównanie numerów scen: [2,9] < [2,10] (liczbowo, nie alfabetycznie). */
function porownajNumery(a, b) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i += 1) {
        const x = a[i] ?? 0;
        const y = b[i] ?? 0;
        if (x !== y) return x - y;
    }
    return 0;
}

/**
 * Ułóż karty tak, jak mają lecieć w filmie.
 * `odwrotnie` daje kolejność z Tablicy (od końca) — furtka, gdyby numeracja
 * projektu szła wspak.
 */
export function poKolei(kadry = [], odwrotnie = false) {
    const zNumerem = [];
    const bezNumeru = [];
    for (const k of kadry) (numerSceny(k) ? zNumerem : bezNumeru).push(k);

    zNumerem.sort((a, b) => porownajNumery(numerSceny(a), numerSceny(b)));
    bezNumeru.sort((a, b) => String(a.utworzono).localeCompare(String(b.utworzono)));

    const ulozone = [...zNumerem, ...bezNumeru];
    return odwrotnie ? ulozone.reverse() : ulozone;
}

/** Czy karta ma już gotowe ujęcie (ścieżkę do istniejącego pliku). */
export async function maJuzUjecie(kadr) {
    const z = String(kadr?.zwrot || '');
    const m = z.match(/[A-Za-z]:\\[^\n|"]+\.(mp4|webm|mov|mkv)/i) ?? z.match(/\/[^\n|"]+\.(mp4|webm|mov|mkv)/i);
    if (!m) return null;
    const p = m[0].trim();
    try { await fs.access(p); return p; } catch { return null; }
}

function sprzatnij() {
    if (zadania.size <= MAX_ZADAN) return;
    const stare = [...zadania.entries()].sort((a, b) => a[1].start - b[1].start);
    for (const [id] of stare.slice(0, zadania.size - MAX_ZADAN)) zadania.delete(id);
}

export function stanZadania(id) {
    const z = zadania.get(id);
    if (!z) return null;
    return {
        id: z.id, stan: z.stan, projekt: z.projekt,
        ile: z.pozycje.length,
        biezaca: z.biezaca,
        pozycje: z.pozycje.map((p) => ({
            nr: p.nr, kadrId: p.kadrId, tytul: p.tytul, stan: p.stan,
            plik: p.plik, sekundy: p.sekundy, powod: p.powod ?? null,
        })),
        film: z.film,
        sklejka: z.sklejka,
        blad: z.blad,
        sekundOd: Math.round((Date.now() - z.start) / 1000),
    };
}

export const listaZadan = () => [...zadania.values()]
    .sort((a, b) => b.start - a.start)
    .map((z) => ({ id: z.id, stan: z.stan, projekt: z.projekt, ile: z.pozycje.length, film: z.film }));

export function przerwij(id) {
    const z = zadania.get(id);
    if (!z) throw new Error(`Nie znam zadania „${id}".`);
    if (z.stan === 'liczy') { z.przerwane = true; z.stan = 'przerwane'; }
    return stanZadania(id);
}

/**
 * Odpal kolejkę. Zwraca id NATYCHMIAST — praca leci w tle.
 *
 * Zależności wstrzykiwane, żeby ten plik nie znał ani ComfyUI, ani ffmpega:
 * @param {function} p.generuj  ({prompt, zrodlo}) => {ok, zlecenie, powod}
 * @param {string}   p.nastepnyEtap  na którą kolumnę przenieść gotową kartę
 * @param {function} p.czekaj   (zlecenie, czyPrzerwane) => sciezka pliku
 * @param {function} p.oznacz   (kadrId, {zwrot, etap}) => void
 * @param {function} p.sklej    (pliki, cel) => {plik, metoda, wynik}
 */
export function odpal(p) {
    const id = `kol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const z = {
        id,
        start: Date.now(),
        stan: 'liczy',
        projekt: p.projekt,
        pozycje: p.kadry.map((k, i) => ({
            nr: i + 1, kadrId: k.id, tytul: k.tytul, prompt: k.prompt,
            // ⚠️ `zrodlo` niesie plik z POPRZEDNIEGO etapu — na etapie RUCH to
            // klatka kluczowa, z której ma powstać ujęcie. Bez tego kadr i ruch
            // byłyby dwoma niezależnymi losowaniami tego samego opisu.
            zrodlo: k.zrodlo ?? null,
            stan: 'czeka', plik: null, sekundy: null, powod: null,
        })),
        // Domyślnie RUCH — tak zachowywała się kolejka, zanim etapy się rozeszły.
        nastepnyEtap: String(p.nastepnyEtap || 'RUCH').toUpperCase(),
        biezaca: 0,
        film: null,
        sklejka: null,
        blad: null,
        przerwane: false,
    };
    zadania.set(id, z);
    sprzatnij();

    (async () => {
        try {
            for (const poz of z.pozycje) {
                if (z.przerwane) return;
                z.biezaca = poz.nr;
                poz.stan = 'liczy';
                const start = Date.now();

                try {
                    const r = await p.generuj({ prompt: poz.prompt, zrodlo: poz.zrodlo });
                    if (!r.ok) throw new Error(r.powod);

                    const zComfy = await p.czekaj(r.zlecenie, () => z.przerwane);
                    if (z.przerwane) return;
                    if (!zComfy) throw new Error('silnik nie oddał pliku');

                    // ⚠️ TU WYNIK WCHODZI DO KATEDRY. Bez tego kroku plik zostaje
                    // wyłącznie w wyjściu ComfyUI i projekt o nim nie wie.
                    poz.plik = await p.zapisz(zComfy, poz);
                    await p.oznacz(poz.kadrId, { zwrot: poz.plik, etap: z.nastepnyEtap });

                    poz.stan = 'gotowe';
                    poz.sekundy = Math.round((Date.now() - start) / 1000);
                } catch (e) {
                    // ⚠️ JEDEN ZŁY KADR NIE ZATRZYMUJE STU DOBRYCH. Zapisujemy powód
                    // przy tej pozycji i lecimy dalej — inaczej nocny przebieg padał
                    // na trzeciej karcie i rano nie ma nic.
                    poz.stan = 'blad';
                    poz.powod = e.message;
                    poz.sekundy = Math.round((Date.now() - start) / 1000);
                }
            }

            if (z.przerwane) return;

            const gotowe = z.pozycje.filter((x) => x.plik).map((x) => x.plik);
            if (gotowe.length >= 2 && p.sklejaj !== false) {
                const w = await p.sklej(gotowe);
                z.film = w.plik;
                z.sklejka = { metoda: w.metoda, sekundy: w.wynik?.sekundy, bajtow: w.wynik?.bajtow, ujec: gotowe.length };
            } else if (gotowe.length === 1) {
                z.film = gotowe[0];
                z.sklejka = { metoda: 'jedno ujęcie — nie było czego sklejać', ujec: 1 };
            } else if (!gotowe.length) {
                z.sklejka = { metoda: 'żadne ujęcie się nie policzyło', ujec: 0 };
            }
            z.stan = 'gotowe';
        } catch (e) {
            z.stan = 'blad';
            z.blad = e.message;
        }
    })();

    return id;
}

export default { MAX_KADROW, katalogUjec, promptZKadru, maJuzUjecie, odpal, stanZadania, listaZadan, przerwij, slug };
