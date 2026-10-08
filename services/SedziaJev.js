/**
 * ⚖️ Sędzia Projektu Stada na Jev (Suweren 2026-10-08: „zrób sędziego Projektu Stada na Jev”).
 *
 * Dotąd zgodność Biblii z wizją oceniał lokalny model (Wektor albo scalacz) w formacie „ZGODNOŚĆ: n/10”.
 * Liczba zależała od nastroju modelu i od tego, czy w ogóle utrzymał format. Jev (services/Jev.js) daje:
 *   · OCENĘ 0–10 — pytanie `score` z rubryką 10 poziomów; wynik = średnia ważona prawdopodobieństwem,
 *   · ZAŁOŻENIA — każde założenie wizji osobnym pytaniem `noul` („czy Biblia je spełnia?”), w JEDNYM
 *     zapytaniu; niespełnione (p < 0,5) to konkretne BRAKI wzięte prosto z wizji Suwerena.
 * Słowne BRAKI („co dołożyć”) dalej pisze lokalny Sędzia — tu tylko liczby i lista założeń.
 */

const RUBRYKA = [
    '1/10 — Biblia prawie nie dotyka wizji; większość założeń pominięta albo sprzeczna.',
    '2/10 — pojedyncze założenia ledwie wspomniane, reszta pominięta.',
    '3/10 — mniej niż połowa założeń, i to powierzchownie.',
    '4/10 — część założeń opisana, ważne brakują.',
    '5/10 — około połowy założeń spełnione konkretnie.',
    '6/10 — większość założeń jest, ale kilka ważnych płytko albo z lukami.',
    '7/10 — prawie wszystkie założenia, drobne luki i ogólniki.',
    '8/10 — wszystkie założenia obecne, kilka do pogłębienia.',
    '9/10 — wszystkie założenia spełnione konkretnie i spójnie; tylko kosmetyka.',
    '10/10 — wizja spełniona w całości, konkretnie, spójnie, bez sprzeczności.',
];

/** Założenia wizji: punkty listy, a gdy ich nie ma — zdania. Najwyżej 8, każde 8–300 znaków. */
export function zalozeniaWizji(wizja) {
    const t = String(wizja || '').replace(/\r/g, '');
    const punkty = t.split('\n').map((l) => l.trim()).filter((l) => /^([-*•]|\d+[.)])\s+/.test(l)).map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, ''));
    if (punkty.length >= 2) return punkty.map((s) => s.replace(/\s+/g, ' ').slice(0, 300)).filter((s) => s.length >= 8).slice(0, 8);
    // Wizja jako luźny tekst (np. rozmowa z Podcast Twin): zdania ≥ 25 znaków, bez pytań i wtrąceń
    // („Ale musimy zawęzić.”, „ECHO: Zgadzam się.” to nie założenia — zmierzone 2026-10-08).
    return t.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length >= 25 && !/\?\s*["”]?$/.test(s)).map((s) => s.slice(0, 300)).slice(0, 8);
}

/** Pytania dla Jev: ocena + po jednym `noul` na założenie (klucze z1…zN). */
export function pytaniaSedziego(zalozenia) {
    const q = { ocena: { type: 'score', instructions: 'Na ile BIBLIA PROJEKTU spełnia WSZYSTKIE założenia WIZJI Suwerena (konkretnie, spójnie, bez sprzeczności)?', criteria: RUBRYKA } };
    zalozenia.forEach((z, i) => {
        q[`z${i + 1}`] = {
            type: 'noul',
            instructions: { pytanie: 'Czy Biblia projektu spełnia to założenie wizji — konkretnie, a nie tylko je wspomina?', zalozenie: z },
            criteria: { true: 'Biblia realizuje to założenie konkretnymi elementami.', false: 'Założenia brak, jest tylko ogólnikiem albo Biblia mu przeczy.' },
        };
    });
    return q;
}

/**
 * Odpowiedź Jev → { ocena (0–10, jedno miejsce po przecinku), braki [niespełnione założenia], zalozenia [{tekst, p}] }.
 * Ocena liczona sami z prawdopodobieństw poziomów (klucze poziomów posortowane = 1…10), a gdy ich brak — z `score`.
 */
export function wynikSedziego(odp, zalozenia) {
    const o = odp?.answers?.ocena;
    let ocena = null;
    if (o?.probabilities && typeof o.probabilities === 'object') {
        const klucze = Object.keys(o.probabilities).sort((a, b) => Number(a) - Number(b));
        if (klucze.length === RUBRYKA.length) ocena = klucze.reduce((s, k, i) => s + Number(o.probabilities[k] || 0) * (i + 1), 0);
    }
    if (ocena == null && Number.isFinite(Number(o?.score))) {
        const s = Number(o.score);
        ocena = s <= RUBRYKA.length - 1 ? s + 1 : s;   // poziomy liczone od 0 albo od 1
    }
    const lista = zalozenia.map((tekst, i) => ({ tekst, p: Number(odp?.answers?.[`z${i + 1}`]?.noul) }));
    return {
        ocena: ocena == null ? null : Math.round(Math.min(10, Math.max(0, ocena)) * 10) / 10,
        pewnosc: Number.isFinite(Number(o?.confidence)) ? Number(o.confidence) : null,
        braki: lista.filter((z) => Number.isFinite(z.p) && z.p < 0.5).map((z) => `Niespełnione założenie wizji: „${z.tekst.slice(0, 160)}” (Jev p=${z.p.toFixed(2)})`),
        zalozenia: lista,
    };
}

/**
 * Pełna ocena: { ocena, braki, zalozenia, model } albo null (bez klucza). Błąd Jev = wyjątek (wołający wraca do lokalnego).
 * @param {{ zapytaj: Function, stan: Function }} jev
 */
export async function ocenJev(jev, { wizja, biblia, uwagi = '' }) {
    if (!jev?.stan?.().maKlucz) return null;
    const zalozenia = zalozeniaWizji(wizja);
    const odp = await jev.zapytaj({
        state: { wizja: String(wizja).slice(0, 4000), biblia_projektu: String(biblia).slice(0, 20_000), ...(uwagi ? { uwagi_suwerena: String(uwagi).slice(0, 1500) } : {}) },
        questions: pytaniaSedziego(zalozenia),
    });
    return { ...wynikSedziego(odp, zalozenia), model: odp.model };
}

export default { zalozeniaWizji, pytaniaSedziego, wynikSedziego, ocenJev };
