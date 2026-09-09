/**
 * 🎼 MuzykaDoFilmu — Joanna komponuje ścieżkę POD DŁUGOŚĆ materiału.
 *
 * PO CO. Suweren: „trzeba dać możliwość, by TeOgochi od muzyki (Joanna) mógł
 * skomponować cały utwór do całej długości materiału video w Music Studio".
 *
 * Do tej pory montażownia podkładała GOTOWY utwór z biblioteki i zapętlała go,
 * gdy był krótszy. Działa, ale zapętlony kawałek słychać — a to nie to samo,
 * co muzyka napisana pod ten film.
 *
 * JAK TO IDZIE
 *   1. Joanna dostaje kontekst filmu (projekt, kanon, styl, długość) i pisze
 *      BRIEF BRZMIENIA — tagi, których oczekuje ACE-Step.
 *   2. Materiał dłuższy niż jeden bezpieczny segment dzielimy na części.
 *   3. Części łączymy PRZENIKANIEM i przycinamy do długości filmu CO DO SEKUNDY.
 *
 * ⚠️ SILNIKIEM JEST ACE-STEP, NIE MINIMAX. Zmierzone na tej maszynie: MiniMax
 * liczy ~7 godzin na minutę muzyki. Ścieżka do pięciominutowego filmu szłaby
 * ponad dobę. ACE robi to w ośmiu krokach dyfuzji i rozumie polskie teksty.
 *
 * ⚠️ NIE ZGADUJEMY SUFITU SILNIKA. `MAX_SEGMENT` to nasz OSTROŻNY DOMYŚLNY
 * podział, nie twardy limit ACE — dłuższa generacja zjada więcej RAM-u i czasu,
 * a przy zerwaniu tracisz całość zamiast jednego segmentu. Wartość da się
 * nadpisać (OTAKOS_MUZYKA_SEGMENT), gdy ktoś zmierzy, ile ta maszyna udźwignie.
 *
 * ⚠️ PRZYCINAMY, NIE ROZCIĄGAMY. Muzyka dłuższa niż film jest ucinana z
 * wyciszeniem; krótsza — nigdy nie „rozciągana", bo zmiana tempa słychać
 * natychmiast. Zamiast tego dokładamy segment.
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';

const uruchom = promisify(execFile);

/** Ostrożny podział materiału na segmenty (sekundy). Patrz uwaga wyżej. */
export const MAX_SEGMENT = Number(process.env.OTAKOS_MUZYKA_SEGMENT) || 120;

/** Ile sekund trwa przenikanie między segmentami. */
export const PRZENIKANIE = 3;

/**
 * Plan generacji: na ile części pociąć i jak długa jest każda.
 *
 * ⚠️ SEGMENTY ZACHODZĄ NA SIEBIE o czas przenikania — inaczej po sklejeniu
 * ścieżka byłaby KRÓTSZA od filmu o (liczba złączeń × przenikanie), i to cicho.
 */
export function planSegmentow(sekundy, maxSegment = MAX_SEGMENT) {
    const s = Math.max(1, Math.round(Number(sekundy) || 0));
    if (s <= maxSegment) return { ile: 1, dlugosc: s, zachodzenie: 0, razem: s };

    // Każde złączenie zjada `PRZENIKANIE` sekund, więc materiału potrzeba więcej.
    const ile = Math.ceil((s - PRZENIKANIE) / (maxSegment - PRZENIKANIE));
    const dlugosc = Math.ceil((s + (ile - 1) * PRZENIKANIE) / ile);
    return { ile, dlugosc, zachodzenie: PRZENIKANIE, razem: ile * dlugosc - (ile - 1) * PRZENIKANIE };
}

/**
 * Prompt dla Joanny: ma oddać TAGI BRZMIENIA, nie esej.
 *
 * ⚠️ ACE-STEP CZYTA TAGI, NIE OPOWIADANIA. „Melancholijna podróż bohaterki
 * przez pustkowia" nie mówi silnikowi nic; „ambient electronic, warm analog
 * synthesizers, slow evolving pads, instrumental, no drums" — mówi wszystko.
 * Dlatego wymuszamy format i zabraniamy zdań.
 */
export function promptKompozycji({ film, projekt, kanon = '', styl = '', sekundy, kontekstJoanny = '' }) {
    const system = [
        'Jesteś Joanną — TeOgochi Katedry OtakOS od muzyki.',
        'Piszesz BRIEF BRZMIENIA dla silnika ACE-Step, który czyta TAGI, nie zdania.',
        'Odpowiadasz WYŁĄCZNIE obiektem JSON, bez komentarza i bez płotu z backticków.',
        '',
        '{',
        '  "tagi": "gatunek, instrumenty, tempo, nastrój — po angielsku, przecinkami",',
        '  "unikaj": "czego ma NIE być, przecinkami (np. vocals, drums)",',
        '  "dlaczego": "jedno zdanie po polsku: czemu to pasuje do tego materiału"',
        '}',
        '',
        'ŻELAZNE ZASADY:',
        '1. `tagi` to 6-12 haseł po angielsku. Bez zdań, bez fabuły, bez imion postaci.',
        '2. Muzyka jest POD OBRAZ — ma nie walczyć z nim o uwagę. Gdy materiał jest',
        '   gęsty wizualnie, proponujesz spokojniejszą fakturę.',
        '3. Domyślnie INSTRUMENTAL. Wokal dodajesz tylko wtedy, gdy materiał wprost',
        '   go potrzebuje, i piszesz to w `dlaczego`.',
        '4. Bierzesz styl z kanonu projektu, jeśli jest. Nie wymyślasz wbrew niemu.',
        kontekstJoanny.trim() ? `\nCO PAMIĘTASZ Z WŁASNEJ PRACY:\n${kontekstJoanny.trim().slice(0, 900)}` : '',
    ].filter(Boolean).join('\n');

    const czesci = [
        `PROJEKT: ${projekt}`,
        `MATERIAŁ: ${path.basename(String(film || 'film'))}`,
        `DŁUGOŚĆ: ${Math.round(sekundy)} s (${Math.floor(sekundy / 60)} min ${Math.round(sekundy % 60)} s)`,
        styl ? `STYL OBRAZU: ${styl}` : '',
        kanon.trim() ? `\nKANON PROJEKTU:\n${kanon.trim().slice(0, 1200)}` : '',
        '',
        'Podaj brief brzmienia. Sam JSON.',
    ].filter(Boolean);

    return { system, prompt: czesci.join('\n') };
}

/** Wyłuskaj brief z odpowiedzi Joanny. */
export function odczytajBrief(surowe) {
    const t = String(surowe || '');
    const start = t.indexOf('{');
    const koniec = t.lastIndexOf('}');
    if (start < 0 || koniec <= start) throw new Error(`Joanna nie oddała JSON-a. Dostałem: ${t.slice(0, 180)}`);

    let d;
    try { d = JSON.parse(t.slice(start, koniec + 1)); } catch (e) {
        throw new Error(`Brief Joanny to niepoprawny JSON: ${e.message}`);
    }

    const tagi = String(d.tagi ?? d.tags ?? '').trim();
    if (tagi.length < 10) throw new Error('Joanna nie podała tagów brzmienia.');

    return {
        tagi: tagi.slice(0, 400),
        unikaj: String(d.unikaj ?? d.avoid ?? '').trim().slice(0, 200),
        dlaczego: String(d.dlaczego ?? '').trim().slice(0, 300),
    };
}

/**
 * Sklej segmenty muzyki przenikaniem i przytnij do długości filmu.
 *
 * ⚠️ `acrossfade` ŁĄCZY PO DWA. ffmpeg nie ma filtra „przenikaj N plików",
 * więc idziemy parami, narastająco. Przy jednym segmencie nie ma czego łączyć
 * i tylko przycinamy.
 */
export async function zloz({ segmenty, sekundy, wyjscie, wyciszenie = 3 }) {
    if (!segmenty.length) throw new Error('Brak segmentów do złożenia.');
    await fs.mkdir(path.dirname(wyjscie), { recursive: true });

    const dlugosc = Math.max(1, Math.round(Number(sekundy) || 0));
    const zanik = Math.max(0, Math.min(wyciszenie, dlugosc / 4));

    if (segmenty.length === 1) {
        await uruchom(ffmpegPath, [
            '-i', segmenty[0],
            '-t', String(dlugosc),
            '-af', `afade=t=out:st=${Math.max(0, dlugosc - zanik)}:d=${zanik}`,
            '-y', wyjscie,
        ], { maxBuffer: 16 * 1024 * 1024 });
        return { plik: wyjscie, segmentow: 1, sekundy: dlugosc };
    }

    // Wejścia + łańcuch przenikań: [0][1]->[a1], [a1][2]->[a2], …
    const wejscia = segmenty.flatMap((s) => ['-i', s]);
    const kroki = [];
    let poprzedni = '[0:a]';
    for (let i = 1; i < segmenty.length; i += 1) {
        const wynik = i === segmenty.length - 1 ? '[mix]' : `[a${i}]`;
        kroki.push(`${poprzedni}[${i}:a]acrossfade=d=${PRZENIKANIE}:c1=tri:c2=tri${wynik}`);
        poprzedni = wynik;
    }
    const filtr = `${kroki.join(';')};[mix]atrim=0:${dlugosc},afade=t=out:st=${Math.max(0, dlugosc - zanik)}:d=${zanik}[out]`;

    await uruchom(ffmpegPath, [
        ...wejscia,
        '-filter_complex', filtr,
        '-map', '[out]',
        '-y', wyjscie,
    ], { maxBuffer: 32 * 1024 * 1024 });

    return { plik: wyjscie, segmentow: segmenty.length, sekundy: dlugosc, przenikanie: PRZENIKANIE };
}

export default { MAX_SEGMENT, PRZENIKANIE, planSegmentow, promptKompozycji, odczytajBrief, zloz };
