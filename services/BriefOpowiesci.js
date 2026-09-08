/**
 * 📋 BriefOpowiesci — żywe streszczenie tego, co ustaliliście w Pokoju Opowieści.
 *
 * PO CO. Suweren: „moduł Opowieść niech też ma taki aktualizujący się brief,
 * który można rozwinąć z ikonki". Rozmowa o pomyśle ciągnie się kilkanaście tur
 * i po dwudziestu minutach nikt już nie pamięta, czy ustaliliście, że Molita
 * nosi perukę, czy dopiero o tym rozmawialiście. Brief odpowiada na to jednym
 * spojrzeniem.
 *
 * ⚠️ BRIEF NIE JEST KANONEM. Kanon powstaje dopiero po PRZEKUJ i ląduje
 * w pamięci Reżysera. To jest notatka z rozmowy — może się zmienić w następnej
 * turze i nic z niej nie wynika dla produkcji. Rozdział jest celowy: gdyby
 * brief zapisywał fakty, połowa kanonu byłaby zapisem myśli porzuconych trzy
 * zdania później.
 *
 * ⚠️ PUSTE POLE ZOSTAJE PUSTE. Model ma zakaz dopisywania „tajemniczej
 * atmosfery" tam, gdzie nic nie padło — brief pełen wymyślonych ozdobników
 * jest gorszy niż krótki, bo nie da się odróżnić ustaleń od zmyśleń.
 */

/** Ile ostatnich tur wchodzi do promptu — mały model gubi początek instrukcji. */
const OKNO = 16;

/** Po ilu nowych turach warto odświeżyć brief samoczynnie. */
export const CO_ILE_TUR = 2;

export function promptBriefu(historia = []) {
    const rozmowa = (historia ?? [])
        .filter((t) => t?.tresc?.trim())
        .slice(-OKNO)
        .map((t) => `${t.kto === 'suweren' ? 'SUWEREN' : 'TEOGOCHI'}: ${t.tresc.trim()}`)
        .join('\n');

    const system = [
        'Jesteś sekretarzem spotkania scenariuszowego.',
        'Odpowiadasz po polsku, WYŁĄCZNIE obiektem JSON, bez komentarza i bez płotu z backticków.',
        '',
        'Kształt odpowiedzi:',
        '{',
        '  "tytul": "robocza nazwa pomysłu albo pusty łańcuch",',
        '  "logline": "o czym to jest, jedno zdanie",',
        '  "swiat": "gdzie i kiedy się dzieje, 1-2 zdania",',
        '  "ton": "jak to ma wyglądać i brzmieć, 1 zdanie",',
        '  "postacie": [{"imie":"…","kim":"jedno zdanie, kim jest i czego chce"}],',
        '  "ustalenia": ["rzecz, którą JUŻ ustaliliście, sprawdzalna w kadrze"],',
        '  "doDogadania": ["pytanie, na które rozmowa jeszcze nie odpowiedziała"]',
        '}',
        '',
        'ŻELAZNE ZASADY:',
        '1. Bierzesz WYŁĄCZNIE to, co padło w rozmowie. Niczego nie dopowiadasz.',
        '2. Gdy czegoś nie ustalono — pusty łańcuch albo pusta lista. Nie zgadujesz.',
        '3. `ustalenia` to rzeczy WIDOCZNE albo sprawdzalne: wygląd, miejsce, zasada świata.',
        '   „Ciekawa historia" nie jest ustaleniem. „Molita nosi brunetną perukę" — jest.',
        '4. `doDogadania` to prawdziwe dziury w pomyśle, nie uprzejme pytania.',
    ].join('\n');

    return { system, prompt: `— ROZMOWA —\n${rozmowa || '(pusto)'}\n\nZłóż brief. Sam JSON.` };
}

/**
 * Wyłuskaj brief z odpowiedzi modelu.
 * ⚠️ Bierzemy pierwszy `{` i ostatni `}` — modele lubią obudować JSON zdaniem.
 */
export function odczytaj(surowe) {
    const t = String(surowe || '');
    const start = t.indexOf('{');
    const koniec = t.lastIndexOf('}');
    if (start < 0 || koniec <= start) {
        throw new Error(`Model nie oddał obiektu JSON. Dostałem: ${t.slice(0, 200)}`);
    }
    let d;
    try { d = JSON.parse(t.slice(start, koniec + 1)); } catch (e) {
        throw new Error(`Brief jest niepoprawnym JSON-em: ${e.message}`);
    }

    const zdanie = (v, ile = 400) => String(v ?? '').trim().slice(0, ile);
    const lista = (v, ile = 10) => (Array.isArray(v) ? v : [])
        .map((x) => zdanie(typeof x === 'string' ? x : x?.tresc, 240))
        // Wpis krótszy niż 6 znaków to etykieta, nie ustalenie.
        .filter((x) => x.length >= 6)
        .slice(0, ile);

    return {
        tytul: zdanie(d.tytul, 90),
        logline: zdanie(d.logline),
        swiat: zdanie(d.swiat),
        ton: zdanie(d.ton),
        postacie: (Array.isArray(d.postacie) ? d.postacie : [])
            .map((p) => ({ imie: zdanie(p?.imie, 60), kim: zdanie(p?.kim, 240) }))
            .filter((p) => p.imie.length >= 2)
            .slice(0, 12),
        ustalenia: lista(d.ustalenia, 12),
        doDogadania: lista(d.doDogadania, 8),
        zlozony: new Date().toISOString(),
    };
}

/** Czy brief jest na tyle pusty, że nie ma sensu go pokazywać. */
export function pusty(b) {
    if (!b) return true;
    return !b.logline && !b.swiat && !b.ton
        && !(b.postacie?.length) && !(b.ustalenia?.length);
}

export default { promptBriefu, odczytaj, pusty, CO_ILE_TUR };
