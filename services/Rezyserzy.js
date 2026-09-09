/**
 * 🎬 REŻYSERZY — kto kręci, a nie kto gra.
 *
 * PO CO. Suweren: „w module reżysera zakładka »Aktorzy« zmienia się na
 * »Reżyserzy« i tam tworzymy reżyserów o swoim unikalnym stylu; wyrzucamy
 * stamtąd Solitę i Molitę (przenieśmy ich do jakiejś bazy Aktorów OtakOS),
 * zostawiamy pustego reżysera + 3 podstawowe szablonowe, można im przypisać
 * silniki LLM jak i do Video".
 *
 * Zakładka od początku mieszała dwie rzeczy. Leżały w niej `Postac` bez
 * gatunku — czyli Solita i Molita, wklejone persony z czasów Domu TeOgochi.
 * Ale obsadę filmu trzyma dziś BIBLIOTEKA ASSETÓW projektu (twarz, garderoba,
 * arkusz sylwetek, rola fabularna), a persona bez zdjęcia nie ma jak zagrać.
 * Reżyser to co innego niż aktor: to zestaw decyzji o tym, JAK się kręci.
 *
 * ⚠️ REŻYSER NIE JEST OZDOBĄ. Każde jego pole realnie steruje produkcją:
 * `styl` i `pryncypia` dopisują się do promptu kadru, `silnikLLM` pisze kadry,
 * a `rozdzielczosc`, `sekundNaKadr` i `kroki` idą wprost do ComfyUI. Reżyser,
 * który tylko ładnie wygląda w panelu, byłby atrapą.
 *
 * ⚠️ WBUDOWANYCH NIE DA SIĘ USUNĄĆ, tylko sklonować. Inaczej pierwszy
 * przypadkowy klik zostawiłby Katedrę bez punktu wyjścia.
 */

import fs from 'fs/promises';
import path from 'path';

const PLIK_REZYSEROW = 'rezyserzy.json';
const PLIK_AKTOROW = 'aktorzy-otakos.json';
const PLIK_POSTACI = 'rezyser_postacie.json';

/**
 * Domyślne parametry kadru.
 *
 * ⚠️ ZMIERZONE NA TEJ KARCIE (RTX 3060 Laptop, 6 GB), 49 klatek, 20 kroków:
 *     704×480 — 171 s,  960×544 — 351 s,  1280×704 — 611 s.
 * Podniesienie rozdzielczości kosztuje czas, a nie „nic".
 */
export const DOMYSLNE = {
    silnikWideo: 'wan22',
    // ⚠️ KOMPROMIS WYBRANY ŚWIADOMIE: 704×480 to 171 s/ujęcie i wygląd „lat 80.”,
    // 1280×704 to 611 s i 51 h na dziesięciominutowy odcinek. 960×544 kosztuje
    // 351 s — dwa razy więcej niż dotąd, ale połowę tego, co natywna Wan.
    szerokosc: 960,
    wysokosc: 544,
    sekundNaKadr: 2.04,   // 49 klatek @ 24 fps — Wan wymaga długości 4n+1
    kroki: 20,
};

/**
 * Szablony. Trzy z charakterem + jeden pusty, dokładnie jak prosił Suweren.
 *
 * ⚠️ `styl` jest PO ANGIELSKU, bo trafia do promptu Wana — enkoder umT5 był
 * trenowany na angielskim i polski opis daje słabszy obraz. `opis` jest po
 * polsku, bo to czyta człowiek.
 */
export const WBUDOWANI = [
    {
        id: 'rez-pusty',
        nazwa: 'Reżyser bez stylu',
        opis: 'Czysta kartka. Nic nie dopisuje do promptu — kadr wygląda dokładnie tak, '
            + 'jak go napisano. Od tego zaczynaj, gdy chcesz zobaczyć goły silnik.',
        styl: '',
        pryncypia: [],
        paleta: '',
        ...DOMYSLNE,
    },
    {
        id: 'rez-neon',
        nazwa: 'Neon',
        opis: 'To, czym są dotychczasowe filmy: noc, neon, klub, krótkie cięcia. '
            + 'Kadr 2 s — tempo teledysku.',
        styl: 'cinematic night scene, neon lighting, magenta and cyan rim light, '
            + 'shallow depth of field, anamorphic lens flare, film grain, high contrast',
        pryncypia: [
            'Światło zawsze z boku lub od tyłu — nigdy płaskie z przodu.',
            'Kamera nisko, lekko pod postać.',
            'Cięcie zanim ruch się skończy.',
        ],
        paleta: 'magenta, cyan, głęboka czerń',
        ...DOMYSLNE,
    },
    {
        id: 'rez-kronikarz',
        nazwa: 'Kronikarz',
        opis: 'Spokój i światło dzienne. Długie ujęcia, mało ruchu kamery — kadr 4 s, '
            + 'bo dokument nie tnie co dwie sekundy.',
        styl: 'natural daylight, documentary cinematography, steady camera, '
            + 'realistic skin tones, soft shadows, 35mm film look, muted colors',
        pryncypia: [
            'Kamera na wysokości oczu, bez efekciarstwa.',
            'Jeden ruch na ujęcie albo żaden.',
            'Twarz zawsze czytelna — światło nie może jej zjeść.',
        ],
        paleta: 'ziemiste brązy, zieleń, złamana biel',
        ...DOMYSLNE,
        sekundNaKadr: 4.04,   // 97 klatek — też 4n+1
    },
    {
        id: 'rez-rysownik',
        nazwa: 'Rysownik',
        opis: 'Serial animowany. Płaskie kolory, wyraźny kontur, uproszczone tło. '
            + '⚠️ To STYL, nie inny model — na tej karcie liczy tylko Wan 2.2.',
        styl: '2D animation, cel shading, flat colors, bold clean outlines, '
            + 'simplified background, anime style, consistent character design',
        pryncypia: [
            'Płaskie plamy koloru, żadnych fotograficznych tekstur.',
            'Kontur widoczny na każdej sylwetce.',
            'Tło prostsze niż postać — inaczej rozpada się na szum.',
        ],
        paleta: 'nasycone, ograniczone do kilku barw',
        ...DOMYSLNE,
    },
].map((r) => ({ ...r, wbudowany: true }));

async function odczytaj(katalog, plik, domyslne = []) {
    try {
        const j = JSON.parse(await fs.readFile(path.join(katalog, plik), 'utf8'));
        return Array.isArray(j) ? j : (j.pozycje ?? domyslne);
    } catch {
        return domyslne;
    }
}

/** Zapis atomowy: tmp → rename. Przerwany zapis nie zostawia połowy pliku. */
async function zapisz(katalog, plik, dane) {
    await fs.mkdir(katalog, { recursive: true });
    const cel = path.join(katalog, plik);
    const tmp = `${cel}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(dane, null, 2), 'utf8');
    await fs.rename(tmp, cel);
}

// ── REŻYSERZY ───────────────────────────────────────────────────────────────

/**
 * Wszyscy reżyserzy: wbudowani + własni.
 *
 * ⚠️ Wbudowanych NIE zapisujemy do pliku. Gdyby tam trafili, poprawka szablonu
 * w kodzie nigdy nie dotarłaby do Katedry, w której raz je zapisano.
 * Własna przeróbka wbudowanego zapisuje się pod nowym id (klon).
 */
export async function lista(katalog) {
    const wlasni = await odczytaj(katalog, PLIK_REZYSEROW, []);
    return [...WBUDOWANI, ...wlasni];
}

export async function jeden(katalog, id) {
    return (await lista(katalog)).find((r) => r.id === id) ?? null;
}

export async function zapiszRezysera(katalog, dane = {}) {
    const nazwa = String(dane.nazwa || '').trim();
    if (nazwa.length < 2) throw new Error('Reżyser potrzebuje nazwy (min. 2 znaki).');

    const wlasni = await odczytaj(katalog, PLIK_REZYSEROW, []);
    const wbudowany = WBUDOWANI.find((r) => r.id === dane.id);
    const istniejacy = dane.id ? wlasni.find((r) => r.id === dane.id) : null;

    const teraz = new Date().toISOString();
    const wpis = {
        ...(wbudowany ?? istniejacy ?? { utworzono: teraz }),
        // Klon wbudowanego dostaje NOWE id — inaczej nadpisałby szablon w liście.
        id: istniejacy?.id ?? `rez-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        nazwa,
        opis: String(dane.opis ?? wbudowany?.opis ?? istniejacy?.opis ?? '').trim(),
        styl: String(dane.styl ?? wbudowany?.styl ?? istniejacy?.styl ?? '').trim(),
        pryncypia: (dane.pryncypia ?? wbudowany?.pryncypia ?? istniejacy?.pryncypia ?? [])
            .map((s) => String(s).trim()).filter(Boolean),
        paleta: String(dane.paleta ?? wbudowany?.paleta ?? istniejacy?.paleta ?? '').trim(),
        silnikLLM: String(dane.silnikLLM ?? istniejacy?.silnikLLM ?? '').trim() || null,
        silnikWideo: String(dane.silnikWideo ?? istniejacy?.silnikWideo ?? DOMYSLNE.silnikWideo).trim(),
        szerokosc: Number(dane.szerokosc ?? istniejacy?.szerokosc ?? wbudowany?.szerokosc ?? DOMYSLNE.szerokosc),
        wysokosc: Number(dane.wysokosc ?? istniejacy?.wysokosc ?? wbudowany?.wysokosc ?? DOMYSLNE.wysokosc),
        sekundNaKadr: Number(dane.sekundNaKadr ?? istniejacy?.sekundNaKadr ?? wbudowany?.sekundNaKadr ?? DOMYSLNE.sekundNaKadr),
        kroki: Number(dane.kroki ?? istniejacy?.kroki ?? wbudowany?.kroki ?? DOMYSLNE.kroki),
        wbudowany: false,
        zmieniono: teraz,
    };

    if (istniejacy) Object.assign(istniejacy, wpis);
    else wlasni.push(wpis);
    await zapisz(katalog, PLIK_REZYSEROW, wlasni);
    return wpis;
}

export async function usunRezysera(katalog, id) {
    if (WBUDOWANI.some((r) => r.id === id)) {
        throw new Error('To reżyser wbudowany — nie da się go usunąć. Zrób z niego klon i zmień klon.');
    }
    const wlasni = await odczytaj(katalog, PLIK_REZYSEROW, []);
    const i = wlasni.findIndex((r) => r.id === id);
    if (i < 0) throw new Error('Nie ma takiego reżysera.');
    const [usuniety] = wlasni.splice(i, 1);
    await zapisz(katalog, PLIK_REZYSEROW, wlasni);
    return usuniety;
}

/**
 * Fragment dopisywany do KAŻDEGO promptu kadru tego reżysera.
 *
 * ⚠️ Pusty styl daje pusty łańcuch, a nie „, , ". Reżyser bez stylu ma nie
 * zostawiać po sobie śladu w prompcie.
 */
export function promptStylu(rezyser) {
    if (!rezyser) return '';
    const czesci = [rezyser.styl, rezyser.paleta ? `color palette: ${rezyser.paleta}` : '']
        .map((s) => String(s || '').trim()).filter(Boolean);
    return czesci.join(', ');
}

/** Zasady reżysera dla modelu, który PISZE kadry — po polsku, bo pisze po polsku. */
export function wskazowkiDlaPisarza(rezyser) {
    if (!rezyser?.pryncypia?.length) return '';
    return `Reżyser „${rezyser.nazwa}" pracuje tak:\n`
        + rezyser.pryncypia.map((p) => `- ${p}`).join('\n');
}

// ── BAZA AKTORÓW OtakOS ─────────────────────────────────────────────────────
//
// Katedralna, ponad projektami. Tu lądują Solita i Molita, żeby nie ginęły
// przy zmianie zakładki na Reżyserów — i żeby dało się je obsadzić w NOWYM
// projekcie bez przepisywania.

export async function listaAktorow(katalog) {
    return odczytaj(katalog, PLIK_AKTOROW, []);
}

export async function zapiszAktora(katalog, dane = {}) {
    const imie = String(dane.imie || dane.nazwa || '').trim();
    if (imie.length < 2) throw new Error('Aktor potrzebuje imienia (min. 2 znaki).');

    const aktorzy = await odczytaj(katalog, PLIK_AKTOROW, []);
    const teraz = new Date().toISOString();
    const istniejacy = dane.id
        ? aktorzy.find((a) => a.id === dane.id)
        : aktorzy.find((a) => a.imie.toLowerCase() === imie.toLowerCase());

    const wpis = istniejacy ?? {
        id: `akt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        utworzono: teraz,
    };
    wpis.imie = imie;
    wpis.opis = String(dane.opis ?? wpis.opis ?? '').trim();
    wpis.skad = String(dane.skad ?? wpis.skad ?? 'ręcznie').trim();
    wpis.zmieniono = teraz;

    if (!istniejacy) aktorzy.push(wpis);
    await zapisz(katalog, PLIK_AKTOROW, aktorzy);
    return wpis;
}

export async function usunAktora(katalog, id) {
    const aktorzy = await odczytaj(katalog, PLIK_AKTOROW, []);
    const i = aktorzy.findIndex((a) => a.id === id);
    if (i < 0) throw new Error('Nie ma takiego aktora w bazie OtakOS.');
    const [usuniety] = aktorzy.splice(i, 1);
    await zapisz(katalog, PLIK_AKTOROW, aktorzy);
    return usuniety;
}

/**
 * Przenieś persony BEZ GATUNKU z pamięci Reżysera do bazy Aktorów OtakOS.
 *
 * ⚠️ „Bez gatunku" to dokładnie kryterium, którym panel odróżniał aktora od
 * co-bota. Postacie Z gatunkiem (Klatka, Joanna, Reżyser) to agenci Katedry —
 * ich NIE ruszamy, bo prowadzą pracę, a nie grają.
 *
 * ⚠️ Domyślnie KOPIUJE. Kasowanie źródła wymaga świadomego `zabierz: true` —
 * ta sama zasada co przy kopiowaniu assetów między projektami.
 */
export async function przeniesZPamieciRezysera(katalog, { zabierz = false } = {}) {
    const postacie = await odczytaj(katalog, PLIK_POSTACI, []);
    const doPrzeniesienia = postacie.filter((p) => !p.gatunek);
    if (!doPrzeniesienia.length) return { przeniesieni: [], zostawieni: postacie.length, zabrane: false };

    const przeniesieni = [];
    for (const p of doPrzeniesienia) {
        przeniesieni.push(await zapiszAktora(katalog, {
            imie: p.imie ?? p.nazwa,
            opis: String(p.surowe ?? p.opis ?? p.persona ?? '').trim(),
            skad: 'pamięć Reżysera',
        }));
    }

    if (zabierz) {
        await zapisz(katalog, PLIK_POSTACI, postacie.filter((p) => p.gatunek));
    }
    return {
        przeniesieni,
        zostawieni: postacie.filter((p) => p.gatunek).length,
        zabrane: zabierz,
    };
}

export default {
    DOMYSLNE, WBUDOWANI,
    lista, jeden, zapiszRezysera, usunRezysera, promptStylu, wskazowkiDlaPisarza,
    listaAktorow, zapiszAktora, usunAktora, przeniesZPamieciRezysera,
};
