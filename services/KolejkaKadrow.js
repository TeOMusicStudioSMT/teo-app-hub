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
export function promptZKadru(kadr, kotwica = '') {
    const czesci = [];
    if (kadr.opis?.trim()) czesci.push(kadr.opis.trim());
    // Tytuł tylko wtedy, gdy opisu brak — inaczej dubluje treść.
    else if (kadr.tytul?.trim()) czesci.push(kadr.tytul.trim());
    if (kotwica.trim()) czesci.push(kotwica.trim().slice(0, 400));
    return czesci.join(', ');
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
 * @param {function} p.generuj  ({prompt}) => {ok, zlecenie, powod}
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
            stan: 'czeka', plik: null, sekundy: null, powod: null,
        })),
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
                    const r = await p.generuj({ prompt: poz.prompt });
                    if (!r.ok) throw new Error(r.powod);

                    const zComfy = await p.czekaj(r.zlecenie, () => z.przerwane);
                    if (z.przerwane) return;
                    if (!zComfy) throw new Error('silnik nie oddał pliku');

                    // ⚠️ TU WYNIK WCHODZI DO KATEDRY. Bez tego kroku plik zostaje
                    // wyłącznie w wyjściu ComfyUI i projekt o nim nie wie.
                    poz.plik = await p.zapisz(zComfy, poz);
                    await p.oznacz(poz.kadrId, { zwrot: poz.plik, etap: 'RUCH' });

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
