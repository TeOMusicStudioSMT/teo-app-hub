/**
 * 🪪 Kto jest kim w księdze GRV TEJ Katedry — skarbiec (zarządca, saldo ∞) i właściciel (Suweren tej Katedry).
 *
 * Suweren (2026-10-04): „JA to tylko Jeden Jestem… niech się pyta, co wpisać… i niech też nie zakłada drugiego
 * głównego konta TeO… każda nowa ma mieć swe unikalne… a sam nick wyświetlania można zawsze zmienić”.
 * Dotąd geneza KAŻDEJ księgi zakładała „TeO” (∞) i „Mistrz Arkadiusz” (1 000 000 founder) — więc każda rozdana
 * Katedra miała w sobie kopię Suwerena i kopię jego banku.
 *
 * Od teraz nowa księga:
 *   · skarbiec = unikalny klucz `skarbiec-<hex>` (saldo ∞, nazwa „Skarbiec Katedry” — do zmiany),
 *   · właściciel = nikt, dopóki Suweren tej Katedry nie wpisze imienia przy pierwszym wejściu (Onboarding);
 *     dostaje unikalny klucz `wezel-<hex>` i nazwę, którą wpisał (do zmiany w każdej chwili, klucz zostaje),
 *   · pule rang puste — nikt nie zajmuje slotu founder z urzędu.
 * Istniejąca księga (główny węzeł TeO i węzły, które już ją mają) NIE jest przepisywana: jeśli ma „TeO”
 * i „Mistrz Arkadiusz”, to one są jej skarbcem i właścicielem — salda i łańcuch zostają nietknięte.
 */
import crypto from 'crypto';

export const NAZWA_SKARBCA = 'Skarbiec Katedry';
const losowe = () => crypto.randomBytes(4).toString('hex');

/** Nazwa wyświetlana od człowieka → bezpieczna postać (1–40 znaków, bez znaków sterujących). */
export function oczyscNazwe(nazwa) {
    const n = String(nazwa ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return n.length >= 2 ? n : null;
}

/** Nowa księga (pierwsze uruchomienie). `losowo` i `teraz` — dla testów. */
export function genezaKsiegi({ teraz = Date.now(), losowo = losowe } = {}) {
    const zarzadca = `skarbiec-${losowo()}`;
    return {
        zarzadca, wlasciciel: null,
        nodes: { [zarzadca]: { grv: 'INFINITE', role: 'sovereign-manager', tier: null, nazwa: NAZWA_SKARBCA, registeredAt: teraz } },
        pools: { founder: 0, pillar: 0, herald: 0 },
        chain: [],
        genesis: { [zarzadca]: 'INFINITE' },   // dane pierwszego bloku pieczęci
    };
}

/**
 * Starsza księga bez pól `zarzadca` / `wlasciciel` → uzupełnij z tego, co w niej JEST (nic nie wymyślamy):
 * skarbiec = węzeł z saldem INFINITE (najpierw „TeO”), właściciel = „Mistrz Arkadiusz”, gdy jest w księdze.
 * Zwraca true, gdy coś dopisano.
 */
export function migrujKsiege(L) {
    let zmiana = false;
    if (!L.zarzadca) {
        const nieskonczone = Object.keys(L.nodes ?? {}).filter((k) => L.nodes[k]?.grv === 'INFINITE');
        const z = nieskonczone.includes('TeO') ? 'TeO' : nieskonczone[0];
        if (z) { L.zarzadca = z; zmiana = true; }
    }
    if (L.wlasciciel === undefined) {
        L.wlasciciel = L.nodes?.['Mistrz Arkadiusz'] ? 'Mistrz Arkadiusz' : null;
        zmiana = true;
    }
    return zmiana;
}

/** Klucz nowego właściciela (unikalny w tej księdze). */
export function nowyKluczWezla(L, losowo = losowe) {
    let k;
    do { k = `wezel-${losowo()}`; } while (L.nodes?.[k]);
    return k;
}

/** Jak pokazać węzeł: nazwa wyświetlana albo klucz. */
export const nazwaWezla = (L, id) => (id && L.nodes?.[id]?.nazwa) || id || null;

/** Opis tożsamości księgi dla Huba (`GET /api/grv/ja`). */
export function kimJestem(L) {
    const opis = (id) => (id && L.nodes?.[id] ? { id, nazwa: nazwaWezla(L, id), grv: L.nodes[id].grv, tier: L.nodes[id].tier ?? null } : null);
    return { zarzadca: opis(L.zarzadca), wlasciciel: opis(L.wlasciciel) };
}

export default { genezaKsiegi, migrujKsiege, nowyKluczWezla, nazwaWezla, kimJestem, oczyscNazwe, NAZWA_SKARBCA };
