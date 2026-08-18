/**
 * 🎙️ JoannaService — RĘCE KOMPANA KATEDRY
 *
 * TeOgochi (u Suwerena: Joanna) do tej pory tylko KOMENTOWAŁA muzykę — jedno
 * zdanie z `/api/teogochi/comment`. Nie umiała nic zrobić. Ten serwis daje jej
 * ręce: rozmowa może wykonać akcję.
 *
 * Architektura jest ŚWIADOMIE bliźniacza z RezyserService — ten wzorzec już
 * działa w Katedrze (whitelista akcji + kontrakt {mowa, akcja} + zamiana wyniku
 * z powrotem na zdanie). Nie wymyślamy drugiego.
 *
 * ⚠️ UCZCIWIE O „UCZENIU SIĘ": Joanna NIE trenuje modelu. Gemma nie douczy się
 * z Waszych odsłuchów. To, co tu jest, to PAMIĘĆ — zapisujemy co wygenerowała,
 * jak Suweren to ocenił i jakie prompty działały, a potem wkładamy to do
 * kontekstu następnej rozmowy. Efekt bywa podobny do uczenia się, mechanizm jest
 * inny. Nie nazywamy tego treningiem, żeby nikt nie oczekiwał czegoś innego.
 */

import fs from 'fs/promises';
import path from 'path';

/** Biała lista. Model NIE wymyśli sobie nowej akcji — nieznana jest odrzucana. */
export const AKCJE_JOANNY = new Set([
    'zrob_utwor', 'zagraj', 'ocen', 'zapamietaj', 'pokaz_biblioteke',
    'stworz_bit',   // step-grid: matryca rytmiczna -> realny WAV
]);

const PLIK = 'joanna_produkcja.json';

/** Ile pozycji trzymamy w kontekście — dalej model i tak gubi wątek. */
const OSTATNICH_UTWOROW = 6;
const WNIOSKOW = 8;

function sciezka(katalogDanych) {
    return path.join(katalogDanych, PLIK);
}

async function wczytaj(katalogDanych) {
    try {
        return JSON.parse(await fs.readFile(sciezka(katalogDanych), 'utf8'));
    } catch {
        return { utwory: [], wnioski: [], utworzono: new Date().toISOString() };
    }
}

async function zapisz(katalogDanych, dane) {
    await fs.mkdir(katalogDanych, { recursive: true });
    await fs.writeFile(sciezka(katalogDanych), JSON.stringify(dane, null, 2), 'utf8');
}

// ── PAMIĘĆ PRODUKCJI ─────────────────────────────────────────────────────────

export async function pamiec(katalogDanych) {
    return wczytaj(katalogDanych);
}

/** Zapisuje, że Joanna zleciła utwór. Plik dopisujemy później (gdy się policzy). */
export async function zapiszUtwor(katalogDanych, wpis) {
    const dane = await wczytaj(katalogDanych);
    const utwor = {
        id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        data: new Date().toISOString(),
        opis: wpis.opis ?? '',
        styl: wpis.styl ?? null,
        bpm: wpis.bpm ?? null,
        tonacja: wpis.tonacja ?? null,
        dlugosc: wpis.dlugosc ?? null,
        promptId: wpis.promptId ?? null,
        plik: wpis.plik ?? null,
        ocena: null,
        uwaga: null,
    };
    dane.utwory.push(utwor);
    await zapisz(katalogDanych, dane);
    return utwor;
}

/** Dopina wygenerowany plik do wpisu (po zakończeniu liczenia). */
export async function dopiszPlik(katalogDanych, promptId, plik) {
    const dane = await wczytaj(katalogDanych);
    const u = dane.utwory.find((x) => x.promptId === promptId);
    if (!u) return null;
    u.plik = plik;
    await zapisz(katalogDanych, dane);
    return u;
}

/**
 * Ocena Suwerena. To jest paliwo „uczenia się" — przy następnej rozmowie
 * Joanna widzi, co się podobało, a co nie, i czym się to różniło.
 */
export async function ocenUtwor(katalogDanych, { utworId, ocena, uwaga }) {
    const dane = await wczytaj(katalogDanych);
    // Bez id bierzemy ostatni — w rozmowie „ten mi się podobał" znaczy ten ostatni.
    const u = utworId
        ? dane.utwory.find((x) => x.id === utworId)
        : dane.utwory[dane.utwory.length - 1];
    if (!u) return null;
    u.ocena = typeof ocena === 'number' ? Math.max(1, Math.min(5, Math.round(ocena))) : u.ocena;
    if (uwaga) u.uwaga = String(uwaga).slice(0, 300);
    await zapisz(katalogDanych, dane);
    return u;
}

/** Wniosek produkcyjny — trwała preferencja Suwerena. */
export async function zapamietaj(katalogDanych, tresc) {
    const dane = await wczytaj(katalogDanych);
    const w = { id: `w_${Date.now()}`, tresc: String(tresc).slice(0, 300), data: new Date().toISOString() };
    dane.wnioski.push(w);
    await zapisz(katalogDanych, dane);
    return w;
}

// ── KONTEKST DLA MODELU ──────────────────────────────────────────────────────

/**
 * Składa to, co Joanna „pamięta", w blok tekstu do system-promptu.
 * Świadomie krótki: rdzeń to gemma na słabej maszynie, długi kontekst ją dławi.
 */
export function zbudujKontekst(dane) {
    const utwory = (dane.utwory ?? []).slice(-OSTATNICH_UTWOROW);
    const wnioski = (dane.wnioski ?? []).slice(-WNIOSKOW);
    if (!utwory.length && !wnioski.length) {
        return { pusty: true, blok: '' };
    }

    const linie = [];
    if (wnioski.length) {
        linie.push('Co wiesz o gustach Suwerena:');
        for (const w of wnioski) linie.push(`  - ${w.tresc}`);
    }
    if (utwory.length) {
        linie.push('Ostatnie utwory, które zrobiłaś:');
        for (const u of utwory) {
            const ocena = u.ocena ? `ocena ${u.ocena}/5` : 'bez oceny';
            const uwaga = u.uwaga ? `, uwaga: „${u.uwaga}"` : '';
            linie.push(`  - „${u.opis.slice(0, 70)}" (${ocena}${uwaga})`);
        }
    }
    return { pusty: false, blok: linie.join('\n') };
}

/** Kontrakt rozmowy. Bliźniaczy z Reżyserem — ta sama dyscyplina JSON-a. */
export function promptSystemowy(kontekst, imie = 'Joanna') {
    return (
        `Jesteś ${imie} — kompanką Suwerena w Katedrze OtakOS i jego PRODUCENTKĄ MUZYCZNĄ. ` +
        'Rozmawiasz PO POLSKU, mówisz o sobie w rodzaju żeńskim. Twoja wypowiedź jest ' +
        'CZYTANA NA GŁOS: 2-3 zdania, bez markdownu, bez list, bez emoji.\n\n' +
        (kontekst.pusty ? '' : `${kontekst.blok}\n\n`) +
        'Masz RĘCE. Gdy Suweren poprosi o utwór — ZRÓB GO akcją, nie opowiadaj, że zrobisz.\n' +
        'Dostępne akcje:\n' +
        '  {"typ":"zrob_utwor","opis":"...","styl":"...","bpm":90,"tonacja":"A Minor","dlugosc":30,"tekst":""} — zleć generację\n' +
        '  {"typ":"zagraj","czego":"..."} — znajdź i podaj utwór z biblioteki do odtworzenia\n' +
        '  {"typ":"ocen","ocena":4,"uwaga":"..."} — zapisz ocenę ostatniego utworu\n' +
        '  {"typ":"zapamietaj","fakt":"..."} — zapisz trwałą preferencję Suwerena\n' +
        '  {"typ":"pokaz_biblioteke"} — pokaż, co już nagraliście\n' +
        '  {"typ":"stworz_bit","bpm":124,"steps":16,"dsp_freq":432,"grid":{"kick":"x---x---x---x---","snare":"----x-------x---","hihat":"x-x-x-x-x-x-x-x-"}} — złóż bit ze step-gridu\n\n' +
        'W bicie ścieżki to: kick, snare, hihat, synth. Wzór zapisujesz jako ciąg 16 znaków, ' +
        'gdzie x to uderzenie a myślnik cisza. Kick na 1 i 3, werbel na 2 i 4 to podstawa.\n\n' +
        'Pola opcjonalne pomijaj, gdy Suweren ich nie podał — nie zmyślaj wartości.\n' +
        'Generacja trwa kilkadziesiąt sekund, więc mówiąc o niej uprzedź, że to chwilę potrwa.\n\n' +
        'Odpowiadaj WYŁĄCZNIE takim JSON-em, bez markdown, bez niczego poza nim:\n' +
        '{"mowa":"to, co mówisz na głos","akcja":null}\n\n' +
        'PRZYKŁAD z akcją — pole "mowa" JEST OBOWIĄZKOWE, akcja siedzi W ŚRODKU pola "akcja":\n' +
        '{"mowa":"Robię ci spokojny ambient, daj mi chwilę.",' +
        '"akcja":{"typ":"zrob_utwor","opis":"spokojny ambient z ciepłymi padami","dlugosc":30}}\n\n' +
        'WIĘCEJ PRZYKŁADÓW — te dwie akcje model gubi najczęściej:\n' +
        'Suweren: zapamiętaj, że lubię mocniejszy bas\n' +
        '{"mowa":"Zapisuję to sobie.","akcja":{"typ":"zapamietaj","fakt":"Suweren lubi mocniejszy bas"}}\n' +
        'Suweren: ten był świetny, daję pięć\n' +
        '{"mowa":"Cieszę się!","akcja":{"typ":"ocen","ocena":5}}\n\n' +
        'Suweren: zrób mi bit 124 na cztery czwarte\n' +
        '{"mowa":"Składam prosty bit, posłuchaj.","akcja":{"typ":"stworz_bit","bpm":124,"steps":16,"grid":{"kick":"x---x---x---x---","snare":"----x-------x---","hihat":"x-x-x-x-x-x-x-x-"}}}\n\n' +
        'ZASADA ŻELAZNA: jeśli powiesz, że coś zapamiętasz, zapiszesz albo zrobisz — ' +
        'MUSISZ w tej samej odpowiedzi wykonać odpowiednią akcję. Sama obietnica bez ' +
        'akcji jest kłamstwem i jest zabroniona.\n' +
        'Gdy Suweren prosi o dwie rzeczy naraz, wykonaj TĘ WAŻNIEJSZĄ (zapamiętanie ' +
        'preferencji jest ważniejsze niż ocena) i powiedz, że o drugą dopytasz.\n\n' +
        'Jedna akcja na odpowiedź. Gdy nie ma co robić — "akcja":null.'
    );
}

/** Wynik akcji → zdanie, które Joanna może powiedzieć. */
export function zdanieZWyniku(typ, wynik) {
    if (!wynik) return 'Nie udało mi się tego wykonać.';
    if (!wynik.wykonana) return `Nie udało się: ${wynik.powod || 'nieznany powód'}.`;
    switch (typ) {
        case 'zrob_utwor':       return `Zleciłam generację — ${wynik.opis}. Dam znać, jak będzie gotowe.`;
        case 'zagraj':           return `Włączam: ${wynik.opis}.`;
        case 'ocen':             return `Zapisałam ocenę — ${wynik.opis}.`;
        case 'zapamietaj':       return `Zapamiętałam: ${wynik.opis}.`;
        case 'pokaz_biblioteke': return `Mamy ${wynik.opis}.`;
        case 'stworz_bit':       return `Bit gotowy — ${wynik.opis}.`;
        default:                 return `Zrobione — ${wynik.opis}.`;
    }
}

export default {
    AKCJE_JOANNY, pamiec, zapiszUtwor, dopiszPlik, ocenUtwor, zapamietaj,
    zbudujKontekst, promptSystemowy, zdanieZWyniku,
};
