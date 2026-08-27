/**
 * 🏅 Rangi Katedry — jak węzeł wspina się od Basic do Foundera.
 *
 * Drabina: basic → herold → filar → founder → zarządca (TeO).
 * Każdy szczebel zdobywa się INACZEJ i to jest sedno tego pliku:
 *
 *   · FILAR   — na HASŁO (SHAUMBRA). Sloty NIEOGRANICZONE, świadomie:
 *               to zaproszenie do kręgu, nie licytacja o miejsce.
 *   · HEROLD  — na OSIĄGNIĘCIA. Nie da się go kupić ani wyprosić.
 *   · FOUNDER — na KLUCZ ZAŁOŻYCIELSKI z puli 26. Klucz wydaje Suweren.
 *
 * ⚠️ OSIĄGNIĘCIA LICZYMY WYŁĄCZNIE Z FAKTÓW, KTÓRE WIDZI MOST.
 * Kuszące było wziąć XP TeOgochi — ale ono żyje w localStorage przeglądarki,
 * więc każdy mógłby sobie wpisać dowolną liczbę i „zasłużyć" na rangę jednym
 * kliknięciem w konsoli. Ranga oparta na podrabialnym dowodzie to nie ranga.
 * Dlatego patrzymy na szynę zdarzeń, dziennik napraw, rejestr posiadanych
 * aktywów i graf wiedzy — rzeczy, które powstają tylko przez REALNĄ pracę.
 */
import fs from 'fs/promises';
import path from 'path';

/** Hasło do kręgu Filarów. Jawne z założenia — to zaproszenie, nie sekret. */
export const HASLO_FILARA = 'SHAUMBRA';

/** Ile osiągnięć trzeba, żeby zostać Heroldem. */
export const PROG_HEROLDA = 3;

const wymiar = (...p) => path.join(process.cwd(), '_OtakOs_Wymiar', ...p);
const kopie = (...p) => path.join(process.cwd(), '_OtakOs_Kopie', ...p);

async function czytajJson(sciezka, domyslne) {
    try { return JSON.parse(await fs.readFile(sciezka, 'utf8')); } catch { return domyslne; }
}
async function czytajLinie(sciezka) {
    try {
        return (await fs.readFile(sciezka, 'utf8')).trim().split('\n')
            .map(l => { try { return JSON.parse(l); } catch { return null; } })
            .filter(Boolean);
    } catch { return []; }
}

/**
 * Katalog osiągnięć. Każde ma `sprawdz`, które MUSI opierać się na pliku
 * zapisanym przez most — nigdy na tym, co przyśle przeglądarka.
 */
export const OSIAGNIECIA = [
    {
        id: 'pierwszy-meldunek', nazwa: 'Pierwszy meldunek', ikona: '📡',
        opis: 'Któryś z TeOgochi zameldował się na szynie zdarzeń.',
        async sprawdz(f) { return f.zdarzenia.length > 0; },
    },
    {
        id: 'stado-pracuje', nazwa: 'Stado pracuje', ikona: '🐣',
        opis: 'Co najmniej trzej różni agenci wykonali pracę.',
        async sprawdz(f) { return f.agenci.size >= 3; },
    },
    {
        id: 'rozmowa-agentow', nazwa: 'Rozmowa agentów', ikona: '💬',
        opis: 'Jeden TeOgochi zapytał drugiego i dostał odpowiedź.',
        async sprawdz(f) {
            return f.zdarzenia.some(z => z.rodzaj === 'pytanie')
                && f.zdarzenia.some(z => z.rodzaj === 'odpowiedz');
        },
    },
    {
        id: 'naprawa-wdrozona', nazwa: 'Naprawa wdrożona', ikona: '🔧',
        opis: 'Mechanik wdrożył łatkę, która przeszła weryfikację.',
        async sprawdz(f) { return f.naprawy.some(n => n.wynik === 'wdrozone'); },
    },
    {
        id: 'cofka-zadzialala', nazwa: 'Cofka zadziałała', ikona: '↩️',
        opis: 'Zła łatka została cofnięta, zanim narobiła szkód.',
        async sprawdz(f) { return f.naprawy.some(n => n.wynik === 'cofniete'); },
    },
    {
        id: 'pierwszy-nabytek', nazwa: 'Pierwszy nabytek', ikona: '🎒',
        opis: 'Węzeł posiada co najmniej jedno aktywo z Marketplace.',
        async sprawdz(f, wezel) { return f.aktywa.some(a => a.wlasciciel === wezel); },
    },
    {
        id: 'graf-policzony', nazwa: 'Graf policzony', ikona: '🕸️',
        opis: 'Katedra zna własne katalogi — graf wiedzy istnieje.',
        async sprawdz(f) { return f.grafIstnieje; },
    },
];

/** Zbierz raz wszystkie fakty z dysku, żeby nie czytać plików pod każde osiągnięcie. */
async function zbierzFakty() {
    const zdarzenia = await czytajLinie(wymiar('szyna.jsonl'));
    const naprawy = await czytajLinie(kopie('naprawy', 'dziennik.jsonl'));
    const posiadane = await czytajJson(wymiar('posiadane.json'), { aktywa: [] });
    let grafIstnieje = false;
    try { await fs.access(path.join(process.cwd(), 'graphify-out', 'graph.json')); grafIstnieje = true; } catch { /* brak */ }
    return {
        zdarzenia, naprawy, aktywa: posiadane.aktywa || [],
        agenci: new Set(zdarzenia.map(z => z.agent)),
        grafIstnieje,
    };
}

/** Które osiągnięcia węzeł ma, a których jeszcze nie. */
export async function stanOsiagniec(wezel) {
    const fakty = await zbierzFakty();
    const lista = [];
    for (const o of OSIAGNIECIA) {
        let zdobyte = false;
        try { zdobyte = await o.sprawdz(fakty, wezel); } catch { zdobyte = false; }
        lista.push({ id: o.id, nazwa: o.nazwa, ikona: o.ikona, opis: o.opis, zdobyte });
    }
    const zdobytych = lista.filter(o => o.zdobyte).length;
    return {
        osiagniecia: lista,
        zdobytych,
        wszystkich: lista.length,
        progHerolda: PROG_HEROLDA,
        gotowyNaHerolda: zdobytych >= PROG_HEROLDA,
    };
}

/**
 * Czy węzeł może dostać daną rangę. Zwraca `{ wolno, powod }`.
 * NIE zmienia niczego — decyzję wykonuje trasa mostu.
 */
export async function czyWolnoAwans(wezel, ranga, haslo, pule, limity) {
    if (ranga === 'pillar') {
        if (String(haslo || '').trim().toUpperCase() !== HASLO_FILARA) {
            return { wolno: false, powod: 'Filar wymaga hasła kręgu. Bez niego nie ma awansu.' };
        }
        // Sloty NIEOGRANICZONE — świadoma decyzja Suwerena.
        return { wolno: true, nieograniczone: true };
    }

    if (ranga === 'herald') {
        const s = await stanOsiagniec(wezel);
        if (!s.gotowyNaHerolda) {
            return {
                wolno: false,
                powod: `Herold wymaga ${PROG_HEROLDA} osiągnięć — masz ${s.zdobytych}. Rangi się nie prosi, tylko zdobywa.`,
                brakuje: s.osiagniecia.filter(o => !o.zdobyte).map(o => o.nazwa),
            };
        }
        const uzyte = pule.herald || 0;
        if (uzyte >= limity.herald.count) return { wolno: false, powod: `Pula Heroldów wyczerpana (${limity.herald.count}).` };
        return { wolno: true };
    }

    if (ranga === 'founder') {
        return { wolno: false, powod: 'Founder idzie wyłącznie z klucza założycielskiego — nie przez tę drogę.' };
    }

    return { wolno: false, powod: `Nieznana ranga „${ranga}".` };
}

export default { HASLO_FILARA, PROG_HEROLDA, OSIAGNIECIA, stanOsiagniec, czyWolnoAwans };
