/**
 * 🌌 ModulyService — Rejestr Modułów i Wypraw (Universa 0.00G).
 *
 * ZASTĘPUJE ATRAPĘ. Do 2026-08-15 zakładka „Universes" była w całości makietą:
 *  · `NetworkOfLoci` rysował trzy WYMYŚLONE aktywa („Aethelgard's Echo",
 *    „Orbital Deed #404") z fałszywymi skrótami `0x7f3a...9b12`, a napisy
 *    „Graviton Sync Active" i „LIVE" były ozdobą — nic nie synchronizowało się
 *    z niczym. Przycisk „Incarnate Asset" pokazywał komunikat i nie robił nic.
 *  · Wyprawy (`COSMIC_VENTURES`) miały liczniki wpisane na sztywno
 *    (1 875 000 / 5 000 000 GRV), zdjęcia ze stocka i przycisk „Contribute GRAV"
 *    BEZ ŻADNEJ obsługi kliknięcia.
 *
 * TU JEST RÓŻNICA: liczniki nie są przechowywane. Są SUMOWANE z realnych
 * przelewów GRV, które przeszły przez księgę i zostały opieczętowane w łańcuchu.
 * Nie da się ich „ustawić" — mogą urosnąć wyłącznie wtedy, gdy ktoś faktycznie
 * przelał GRV. Dlatego startują od zera i to zero jest prawdziwe.
 *
 * Dane: `_OtakOs_Wymiar/moduly.json`. Ruch GRV: księga `grv_ledger.json`
 * przez `grant` w moście (z pieczęcią łańcucha).
 */

import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

const PLIK = 'moduly.json';

/** Węzeł-skarbiec, na który idą opłaty za moduły. */
export const SKARBIEC = 'TeO';

function sciezka(katalog) { return path.join(katalog, PLIK); }

const nowyId = (pre) => `${pre}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Moduły wbudowane — REALNE części Katedry, nie wymyślone światy.
 * `wbudowany: true` znaczy, że nie da się ich usunąć: to nie są cudze dodatki,
 * tylko własne narzędzia Suwerena. `cenaGRV: 0` — za swoje się nie płaci.
 */
const WBUDOWANE = [
    { id: 'story', nazwa: 'TeO Story Studio', opis: 'Reżyser, Tablica Produkcji, TeO Kadr. Narracja i montaż.', ikona: '📖', kategoria: 'kreacja', url: '/apps/story/', cenaGRV: 0, wbudowany: true },
    { id: 'music', nazwa: 'TeO Music', opis: 'Radio Katedry, teledyski, wektory soniczne.', ikona: '🎵', kategoria: 'kreacja', url: '/apps/music/', cenaGRV: 0, wbudowany: true },
    { id: 'app', nazwa: 'TeO App Studio', opis: 'Kuźnia narzędzi i komponentów.', ikona: '📦', kategoria: 'kreacja', url: '/apps/app/', cenaGRV: 0, wbudowany: true },
    { id: 'podcast', nazwa: 'PodcastCore', opis: 'Wideopodcast, reżyser multi-cam, telefon jako kamera.', ikona: '🎥', kategoria: 'kreacja', url: null, cenaGRV: 0, wbudowany: true },
    { id: 'rynek', nazwa: 'Centrum Finansowe', opis: 'Portfel, Tunel Wiadomości, Mapa Sektorów, Dziennik Decyzji.', ikona: '💰', kategoria: 'wiedza', url: null, cenaGRV: 0, wbudowany: true },
    { id: 'spizarnia', nazwa: 'Spiżarnia Zasobów', opis: 'Katalog darmowych źródeł dla agentów.', ikona: '🍱', kategoria: 'wiedza', url: null, cenaGRV: 0, wbudowany: true },
];

async function wczytaj(katalog) {
    try {
        const raw = await fs.readFile(sciezka(katalog), 'utf8');
        const d = JSON.parse(raw);
        return {
            moduly: Array.isArray(d.moduly) ? d.moduly : [],
            wyprawy: Array.isArray(d.wyprawy) ? d.wyprawy : [],
            subskrypcje: Array.isArray(d.subskrypcje) ? d.subskrypcje : [],
            wplaty: Array.isArray(d.wplaty) ? d.wplaty : [],
        };
    } catch {
        return { moduly: [], wyprawy: [], subskrypcje: [], wplaty: [] };
    }
}

async function zapisz(katalog, dane) {
    if (!fsSync.existsSync(katalog)) await fs.mkdir(katalog, { recursive: true });
    await fs.writeFile(sciezka(katalog), JSON.stringify(dane, null, 2), 'utf8');
}

// ── Moduły ────────────────────────────────────────────────────────────────────

/** Wszystkie moduły: wbudowane + dodane przez węzły. */
export async function listaModulow(katalog, wezel = null) {
    const d = await wczytaj(katalog);
    const wszystkie = [...WBUDOWANE, ...d.moduly];
    return wszystkie.map(m => ({
        ...m,
        // Subskrypcja jest per węzeł — każdy widzi swoją.
        subskrybowany: wezel
            ? d.subskrypcje.some(s => s.modul === m.id && s.wezel === wezel)
            : false,
        subskrybentow: new Set(d.subskrypcje.filter(s => s.modul === m.id).map(s => s.wezel)).size,
    }));
}

/**
 * Moduł dodany przez węzeł. `autor` jest wymagany — anonimowy wpis w rejestrze
 * to zaproszenie do śmieci, a przy cenie w GRV trzeba wiedzieć, kto pobiera.
 */
export async function dodajModul(katalog, dane = {}) {
    const nazwa = String(dane.nazwa || '').trim();
    const autor = String(dane.autor || '').trim();
    if (nazwa.length < 3) throw new Error('Nazwa modułu jest wymagana (min. 3 znaki).');
    if (!autor) throw new Error('Pole „autor" jest wymagane — rejestr nie przyjmuje wpisów bez węzła.');

    const url = String(dane.url || '').trim();
    if (url && !/^(https?:\/\/|\/)/.test(url)) {
        throw new Error('Adres musi zaczynać się od http(s):// albo / (ścieżka lokalna).');
    }
    const cena = Math.max(0, Math.floor(Number(dane.cenaGRV) || 0));

    const d = await wczytaj(katalog);
    if ([...WBUDOWANE, ...d.moduly].some(m => m.nazwa.toLowerCase() === nazwa.toLowerCase())) {
        throw new Error(`Moduł o nazwie „${nazwa}" już jest w rejestrze.`);
    }

    const modul = {
        id: nowyId('mod'),
        nazwa,
        opis: String(dane.opis || '').trim(),
        ikona: String(dane.ikona || '🧩').trim().slice(0, 4),
        kategoria: ['kreacja', 'wiedza', 'zabawa', 'narzedzie'].includes(dane.kategoria) ? dane.kategoria : 'narzedzie',
        url: url || null,
        cenaGRV: cena,
        autor,
        wbudowany: false,
        dodane: new Date().toISOString(),
    };
    d.moduly.push(modul);
    await zapisz(katalog, d);
    return modul;
}

/** Usuń moduł. Wbudowanych nie ruszamy — to własne narzędzia Katedry. */
export async function usunModul(katalog, id) {
    if (WBUDOWANE.some(m => m.id === id)) {
        throw new Error('Modułu wbudowanego nie da się usunąć — to część Katedry, nie cudzy dodatek.');
    }
    const d = await wczytaj(katalog);
    const i = d.moduly.findIndex(m => m.id === id);
    if (i < 0) throw new Error(`Moduł „${id}" nie istnieje.`);
    const [usuniety] = d.moduly.splice(i, 1);
    d.subskrypcje = d.subskrypcje.filter(s => s.modul !== id);
    await zapisz(katalog, d);
    return usuniety;
}

/**
 * Zapis subskrypcji PO udanym przelewie GRV. Sam przelew robi most (grant
 * z pieczęcią łańcucha) — ten serwis nigdy nie dotyka księgi bezpośrednio,
 * żeby nie powstała druga droga ruchu GRV z pominięciem pieczęci.
 */
export async function zapiszSubskrypcje(katalog, { modul, wezel, grv }) {
    const d = await wczytaj(katalog);
    if (d.subskrypcje.some(s => s.modul === modul && s.wezel === wezel)) {
        return { juzByla: true };
    }
    const wpis = { modul, wezel, grv: Number(grv) || 0, kiedy: new Date().toISOString() };
    d.subskrypcje.push(wpis);
    await zapisz(katalog, d);
    return { juzByla: false, wpis };
}

export async function anulujSubskrypcje(katalog, modul, wezel) {
    const d = await wczytaj(katalog);
    const przed = d.subskrypcje.length;
    d.subskrypcje = d.subskrypcje.filter(s => !(s.modul === modul && s.wezel === wezel));
    if (d.subskrypcje.length === przed) throw new Error('Nie było takiej subskrypcji.');
    await zapisz(katalog, d);
    // Uczciwie: GRV nie wraca. Anulowanie zdejmuje dostęp na przyszłość.
    return { zwrot: false, uwaga: 'Subskrypcja zdjęta. Wpłacone GRV NIE wraca — przelew jest opieczętowany w łańcuchu.' };
}

// ── Wyprawy (dawniej Cosmic Ventures) ─────────────────────────────────────────

/**
 * Wyprawy z licznikami LICZONYMI z wpłat, nigdy przechowywanymi.
 * To jedyny sposób, żeby „zebrane GRV" nie dało się ustawić z palca.
 */
export async function listaWypraw(katalog) {
    const d = await wczytaj(katalog);
    return d.wyprawy.map(w => {
        const moje = d.wplaty.filter(p => p.wyprawa === w.id);
        const zebrane = moje.reduce((s, p) => s + (Number(p.grv) || 0), 0);
        return {
            ...w,
            zebraneGRV: zebrane,
            wplat: moje.length,
            wspierajacych: new Set(moje.map(p => p.wezel)).size,
            postep: w.celGRV > 0 ? +(zebrane / w.celGRV * 100).toFixed(2) : 0,
        };
    });
}

export async function dodajWyprawe(katalog, dane = {}) {
    const nazwa = String(dane.nazwa || '').trim();
    const autor = String(dane.autor || '').trim();
    if (nazwa.length < 3) throw new Error('Nazwa wyprawy jest wymagana (min. 3 znaki).');
    if (!autor) throw new Error('Pole „autor" jest wymagane.');
    const cel = Math.max(1, Math.floor(Number(dane.celGRV) || 0));

    const d = await wczytaj(katalog);
    const wyprawa = {
        id: nowyId('wyp'),
        nazwa,
        opis: String(dane.opis || '').trim(),
        ikona: String(dane.ikona || '🚀').trim().slice(0, 4),
        celGRV: cel,
        autor,
        dodane: new Date().toISOString(),
    };
    d.wyprawy.push(wyprawa);
    await zapisz(katalog, d);
    return wyprawa;
}

export async function usunWyprawe(katalog, id) {
    const d = await wczytaj(katalog);
    const i = d.wyprawy.findIndex(w => w.id === id);
    if (i < 0) throw new Error(`Wyprawa „${id}" nie istnieje.`);
    const wplaconych = d.wplaty.filter(p => p.wyprawa === id).length;
    if (wplaconych > 0) {
        // Skasowanie wyprawy z wpłatami zatarłoby ślad cudzych pieniędzy.
        throw new Error(`Wyprawa ma ${wplaconych} wpłat — nie da się jej usunąć bez zatarcia śladu. Zamknij ją zamiast kasować.`);
    }
    const [usunieta] = d.wyprawy.splice(i, 1);
    await zapisz(katalog, d);
    return usunieta;
}

/** Zapis wpłaty PO udanym przelewie GRV (patrz uwaga przy subskrypcjach). */
export async function zapiszWplate(katalog, { wyprawa, wezel, grv }) {
    const d = await wczytaj(katalog);
    if (!d.wyprawy.some(w => w.id === wyprawa)) throw new Error(`Wyprawa „${wyprawa}" nie istnieje.`);
    const wpis = { id: nowyId('wpl'), wyprawa, wezel, grv: Number(grv) || 0, kiedy: new Date().toISOString() };
    d.wplaty.push(wpis);
    await zapisz(katalog, d);
    return wpis;
}

/** Surowy stan rejestru — do panelu i diagnostyki. */
export async function stan(katalog) {
    const d = await wczytaj(katalog);
    return {
        modulowWbudowanych: WBUDOWANE.length,
        modulowDodanych: d.moduly.length,
        subskrypcji: d.subskrypcje.length,
        wypraw: d.wyprawy.length,
        wplat: d.wplaty.length,
        grvWeWyprawach: d.wplaty.reduce((s, p) => s + (Number(p.grv) || 0), 0),
    };
}

export default {
    WBUDOWANE, SKARBIEC,
    listaModulow, dodajModul, usunModul, zapiszSubskrypcje, anulujSubskrypcje,
    listaWypraw, dodajWyprawe, usunWyprawe, zapiszWplate, stan,
};
