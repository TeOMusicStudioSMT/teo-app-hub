/**
 * 📓 DziennikDecyzjiService — Dziennik Decyzji Suwerena (0.00G)
 *
 * DLACZEGO TO ISTNIEJE: z całego arsenału „finansowego" to jedyne narzędzie,
 * które realnie poprawia wyniki. Nie przewiduje przyszłości — zapisuje, CO
 * Suweren zrobił i DLACZEGO, a po fakcie pozwala zobaczyć, które ROZUMOWANIA
 * się sprawdzały. Pamięć ludzka po fakcie przepisuje historię („wiedziałem"),
 * zapis tego nie robi.
 *
 * ZASADY:
 *  • Nic tu nie doradza. Dziennik nie mówi, co kupić — zapisuje, co zrobiłeś.
 *  • Wszystko lokalnie, w `_OtakOs_Wymiar/dziennik_decyzji.json`. Zero chmury.
 *  • Rozumowanie zapisujemy PRZED znanym wynikiem — inaczej cały sens znika.
 */

import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

const PLIK = 'dziennik_decyzji.json';

function sciezka(katalog) { return path.join(katalog, PLIK); }

async function wczytaj(katalog) {
    try {
        const raw = await fs.readFile(sciezka(katalog), 'utf8');
        const d = JSON.parse(raw);
        return Array.isArray(d) ? d : (Array.isArray(d.wpisy) ? d.wpisy : []);
    } catch { return []; }
}

async function zapisz(katalog, wpisy) {
    if (!fsSync.existsSync(katalog)) await fs.mkdir(katalog, { recursive: true });
    await fs.writeFile(sciezka(katalog), JSON.stringify(wpisy, null, 2), 'utf8');
}

const KIERUNKI = ['KUPNO', 'SPRZEDAZ', 'TRZYMAM', 'ODPUSZCZAM'];

/** Lista wpisów, najnowsze pierwsze. */
export async function lista(katalog) {
    const wpisy = await wczytaj(katalog);
    return wpisy.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
}

/**
 * Dodaj decyzję. `rozumowanie` jest WYMAGANE — wpis bez uzasadnienia
 * jest bezwartościowy dla późniejszego przeglądu, więc go nie przyjmujemy.
 */
export async function dodaj(katalog, dane = {}) {
    const kierunek = String(dane.kierunek || '').toUpperCase();
    if (!KIERUNKI.includes(kierunek)) {
        throw new Error(`Nieznany kierunek "${dane.kierunek}". Dozwolone: ${KIERUNKI.join(', ')}.`);
    }
    const rozumowanie = String(dane.rozumowanie || '').trim();
    if (rozumowanie.length < 10) {
        throw new Error('Pole "rozumowanie" jest wymagane (min. 10 znaków) — bez uzasadnienia wpis nic nie wnosi.');
    }
    const aktywo = String(dane.aktywo || '').trim().toUpperCase() || 'NIEOKREŚLONE';

    const wpis = {
        id: `dec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        utworzono: new Date().toISOString(),
        aktywo,
        kierunek,
        rozumowanie,
        // Czego się spodziewasz — zapisane ZANIM poznasz wynik.
        oczekiwanie: String(dane.oczekiwanie || '').trim() || null,
        pewnosc: Math.max(1, Math.min(5, Number(dane.pewnosc) || 3)),   // 1–5
        nastrojPrasy: String(dane.nastrojPrasy || '').trim().slice(0, 600) || null,
        cenaWtedy: Number(dane.cenaWtedy) > 0 ? Number(dane.cenaWtedy) : null,
        // Wynik dopisujemy PÓŹNIEJ, osobnym wywołaniem.
        wynik: null,
    };

    const wpisy = await wczytaj(katalog);
    wpisy.push(wpis);
    await zapisz(katalog, wpisy);
    return wpis;
}

/** Domknij wpis wynikiem — dopiero to czyni dziennik użytecznym. */
export async function domknij(katalog, id, wynik = {}) {
    const wpisy = await wczytaj(katalog);
    const i = wpisy.findIndex(w => w.id === id);
    if (i < 0) throw new Error(`Wpis "${id}" nie istnieje.`);

    const ocena = String(wynik.ocena || '').toUpperCase();
    if (!['TRAFIONE', 'CHYBIONE', 'NIEROZSTRZYGNIETE'].includes(ocena)) {
        throw new Error('Pole "ocena" musi być: TRAFIONE, CHYBIONE albo NIEROZSTRZYGNIETE.');
    }
    wpisy[i].wynik = {
        ocena,
        domknieto: new Date().toISOString(),
        cenaPotem: Number(wynik.cenaPotem) > 0 ? Number(wynik.cenaPotem) : null,
        // Najcenniejsze pole całego dziennika.
        czegoSieNauczylem: String(wynik.czegoSieNauczylem || '').trim() || null,
    };
    await zapisz(katalog, wpisy);
    return wpisy[i];
}

/**
 * Podsumowanie — SUROWE LICZBY, zero interpretacji.
 * Świadomie nie liczymy „skuteczności" w procentach przy garstce wpisów:
 * 3 z 4 to nie jest 75% umiejętności, to szum. Podajemy liczby i tyle.
 */
export async function podsumowanie(katalog) {
    const wpisy = await wczytaj(katalog);
    const domkniete = wpisy.filter(w => w.wynik);
    const trafione = domkniete.filter(w => w.wynik.ocena === 'TRAFIONE').length;
    const chybione = domkniete.filter(w => w.wynik.ocena === 'CHYBIONE').length;

    // Rozbicie po deklarowanej pewności — czy wysoka pewność faktycznie znaczy więcej?
    const wgPewnosci = [1, 2, 3, 4, 5].map(p => {
        const g = domkniete.filter(w => w.pewnosc === p);
        return { pewnosc: p, domknietych: g.length, trafione: g.filter(w => w.wynik.ocena === 'TRAFIONE').length };
    }).filter(x => x.domknietych > 0);

    return {
        wszystkich: wpisy.length,
        otwartych: wpisy.length - domkniete.length,
        domknietych: domkniete.length,
        trafione, chybione,
        nierozstrzygniete: domkniete.length - trafione - chybione,
        wgPewnosci,
        // Uczciwie: przy małej próbce żadne wnioski statystyczne nie są uprawnione.
        uwaga: domkniete.length < 20
            ? `Za mało domkniętych wpisów (${domkniete.length}), by cokolwiek wnioskować. To dziennik, nie statystyka.`
            : 'Próbka zaczyna być sensowna — patrz na POWTARZALNE rozumowania, nie na sam wynik.',
    };
}

export default { lista, dodaj, domknij, podsumowanie, KIERUNKI };
