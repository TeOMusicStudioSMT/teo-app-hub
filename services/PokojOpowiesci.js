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

/** Ile ostatnich tur wchodzi do promptu. Mały model gubi początek instrukcji. */
const OKNO_ROZMOWY = 12;

/**
 * Prompt rozmowy. Partner ma DRĄŻYĆ, nie streszczać — najczęstsza wada małych
 * modeli w burzy mózgów to zgadzanie się ze wszystkim i podsumowywanie.
 */
export function promptRozmowy({ gatunek = null, kotwica = '' }) {
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
        kotwica.trim() ? `\nCO JUŻ ISTNIEJE W TYM ŚWIECIE (nie zaprzeczaj):\n${kotwica.trim().slice(0, 1200)}` : '',
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

export default { promptRozmowy, zwezHistorie, promptPrzekucia, odczytajPrzekucie, OKNO_ROZMOWY };
