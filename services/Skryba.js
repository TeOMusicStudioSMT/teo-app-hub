/**
 * ✍️ SKRYBA — spisuje z Opowieści scenariusz i prozę do Rękopisu.
 *
 * Suweren: „Rękopis miał spisać z Opowieści omawianą historię i brief, i z tego
 * scenariusz dla agentów rysowania tych scen, dodając assety do opisów…
 * jak i też pisze książkę dla tego Uniwersum… a potem znów reżyser może
 * kręcić na materiale i trzymać wątek".
 *
 * ⚠️ DLACZEGO OSOBNY MODUŁ, A NIE W REKOPIS.JS. Rękopis został zbudowany na
 * zasadzie „prozę pisze człowiek, model tylko podpowiada" — i ta zasada jest
 * słuszna dla edytora. Ale między Opowieścią a Rękopisem nie było NIKOGO, kto
 * by przeniósł ustaloną w rozmowie historię do tekstu; rozdział stał pusty
 * (zmierzone: 0 bajtów). Skryba tę lukę wypełnia, a żeby nie powstała „książka,
 * której nikt nie napisał", KAŻDY jego rozdział nosi w tytule „[szkic AI]"
 * i w stopce podpis silnika. Edytor zostaje ludzki; szkice są jawne.
 *
 * ⚠️ ASSETY Z BIBLIOTEKI, NIE Z GŁOWY MODELU. Scenariusz jest dla agentów
 * rysujących, którzy ładują lokacje, postacie i rekwizyty PO NAZWIE. Model
 * dostaje spis i ma używać wyłącznie tych nazw; czego nie ma, oznacza
 * „BRAK:", żeby brakujący asset wyszedł na wierzch zamiast zniknąć w opisie.
 *
 * ⚠️ SCENA PO SCENIE, NIE CAŁOŚĆ NARAZ. Mały model nie utrzyma dwunastu scen
 * w jednej odpowiedzi — gubi numerację i przepisuje sceny w sceny. Najpierw
 * plan (lista scen w JSON), potem osobne wołanie na każdą scenę.
 */

/** Skraca rozmowę do tego, co model musi znać: głos Suwerena w całości, głos Jaja przycięty. */
export function zwezRozmowe(tury = [], limitZnakow = 9000) {
    const linie = [];
    for (const t of tury) {
        const kto = t.kto === 'suweren' ? 'SUWEREN' : 'JAJO';
        const tresc = String(t.tresc || '').replace(/\s+/g, ' ').trim();
        if (!tresc) continue;
        // Jajo bywa rozwlekłe; jego propozycje liczą się mniej niż decyzje Suwerena.
        linie.push(`${kto}: ${kto === 'JAJO' ? tresc.slice(0, 420) : tresc}`);
    }
    let tekst = linie.join('\n');
    if (tekst.length > limitZnakow) tekst = tekst.slice(tekst.length - limitZnakow);
    return tekst;
}

/** Spis assetów w formie, którą model ma cytować dosłownie. */
export function spisAssetow(assety = []) {
    const grupy = { aktor: [], scena: [], rekwizyt: [], muzyka: [], glos: [] };
    for (const a of assety) {
        const typ = String(a.typ || '').toLowerCase();
        if (!(typ in grupy)) continue;
        const nota = String(a.notatki || a.opis || '').replace(/\s+/g, ' ').slice(0, 120);
        grupy[typ].push(`${a.nazwa}${nota ? ` — ${nota}` : ''}`);
    }
    const blok = (naglowek, lista) => (lista.length ? `${naglowek}:\n${lista.map((x) => `  · ${x}`).join('\n')}` : `${naglowek}: (brak)`);
    return [
        blok('POSTACIE', grupy.aktor),
        blok('LOKACJE', grupy.scena),
        blok('REKWIZYTY', grupy.rekwizyt),
        blok('MUZYKA', grupy.muzyka),
    ].join('\n');
}

function opisUniwersum(u) {
    if (!u) return '(brak założeń uniwersum)';
    const f = Array.isArray(u.filary) ? u.filary.join('; ') : '';
    const m = Array.isArray(u.motywy) ? u.motywy.join(', ') : '';
    return [
        u.zdanie ? `ŚWIAT: ${u.zdanie}` : '',
        u.domena ? `DOMENA: ${u.domena}` : '',
        f ? `FILARY: ${f}` : '',
        m ? `MOTYWY: ${m}` : '',
        u.ton ? `TON: ${u.ton}` : '',
    ].filter(Boolean).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// KROK 1 — PLAN SCEN
// ─────────────────────────────────────────────────────────────────────────────

export function promptPlanu({ rozmowa, uniwersum, assety, ile = 8 }) {
    return {
        system: 'Jesteś skrybą produkcji filmowej. Odpowiadasz WYŁĄCZNIE poprawnym JSON, bez komentarza, bez markdown.',
        prompt: [
            'Poniżej rozmowa, w której ustalono fabułę odcinka, oraz założenia świata i biblioteka assetów.',
            'Rozbij ustaloną historię na sceny — w kolejności, w jakiej mają iść w filmie.',
            `Maksymalnie ${ile} scen. Trzymaj się TEGO, co ustalono; nie dopisuj wątków, których w rozmowie nie ma.`,
            '',
            'ZASADY NAZW: w polach "lokacja", "postacie", "rekwizyty", "muzyka" używaj DOSŁOWNIE nazw z biblioteki.',
            'Jeśli scena potrzebuje czegoś, czego w bibliotece nie ma, wpisz "BRAK: <nazwa>" — nie wymyślaj zamiennika.',
            '',
            'Format (tablica JSON):',
            '[{"nr":1,"tytul":"…","lokacja":"…","postacie":["…"],"rekwizyty":["…"],"muzyka":"…","cel":"co ta scena ma zrobić w historii, jedno zdanie","nastroj":"światło i napięcie, jedno zdanie"}]',
            '',
            '=== ZAŁOŻENIA ŚWIATA ===',
            opisUniwersum(uniwersum),
            '',
            '=== BIBLIOTEKA ASSETÓW ===',
            spisAssetow(assety),
            '',
            '=== ROZMOWA ===',
            rozmowa,
        ].join('\n'),
    };
}

/**
 * Wyłuskuje z tekstu wszystkie obiekty JSON najwyższego poziomu — z poszanowaniem
 * nawiasów wewnątrz łańcuchów.
 *
 * ⚠️ ZMIERZONE NA gemma4:e2b: raz na dwie próby model oddaje KILKA tablic w osobnych
 * liniach („[{…}]\n[{…}]") albo obiekty bez wspólnej tablicy. Parser „od pierwszego
 * [ do ostatniego ]" dostawał wtedy nieparsowalną zbitkę i Skryba meldował
 * „model nie oddał planu", choć plan tam był. Obiekt po obiekcie jest odporne
 * na wszystkie te warianty naraz.
 */
function obiektyZTekstu(s) {
    const wyniki = [];
    let glebokosc = 0, start = -1, wLancuchu = false, ucieczka = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (wLancuchu) {
            if (ucieczka) ucieczka = false;
            else if (c === '\\') ucieczka = true;
            else if (c === '"') wLancuchu = false;
            continue;
        }
        if (c === '"') { wLancuchu = true; continue; }
        if (c === '{') { if (glebokosc === 0) start = i; glebokosc++; }
        else if (c === '}') {
            glebokosc--;
            if (glebokosc === 0 && start >= 0) {
                try { wyniki.push(JSON.parse(s.slice(start, i + 1))); } catch { /* obiekt urwany — pomijamy */ }
                start = -1;
            }
        }
    }
    return wyniki;
}

export function odczytajPlan(surowe, maks = 12) {
    const s = String(surowe || '');
    let lista = null;
    const start = s.indexOf('[');
    const koniec = s.lastIndexOf(']');
    if (start >= 0 && koniec > start) {
        try { const p = JSON.parse(s.slice(start, koniec + 1)); if (Array.isArray(p)) lista = p; } catch { /* spróbujemy obiekt po obiekcie */ }
    }
    if (!lista) lista = obiektyZTekstu(s);
    if (!Array.isArray(lista)) return [];
    return lista
        .filter((x) => x && typeof x === 'object' && String(x.tytul || '').trim())
        .slice(0, maks)
        .map((x, i) => ({
            nr: i + 1,
            tytul: String(x.tytul).trim(),
            lokacja: String(x.lokacja || '').trim(),
            postacie: Array.isArray(x.postacie) ? x.postacie.map(String) : [],
            rekwizyty: Array.isArray(x.rekwizyty) ? x.rekwizyty.map(String) : [],
            muzyka: String(x.muzyka || '').trim(),
            cel: String(x.cel || '').trim(),
            nastroj: String(x.nastroj || '').trim(),
        }));
}

/** Nazwy assetów, które model oznaczył jako brakujące albo których nie ma w bibliotece. */
export function brakujaceAssety(plan, assety = []) {
    const znane = new Set(assety.map((a) => String(a.nazwa || '').toLowerCase()));
    const braki = new Set();
    for (const s of plan) {
        for (const n of [s.lokacja, s.muzyka, ...s.postacie, ...s.rekwizyty]) {
            const t = String(n || '').trim();
            if (!t) continue;
            if (/^brak:/i.test(t)) { braki.add(t.replace(/^brak:\s*/i, '')); continue; }
            if (!znane.has(t.toLowerCase())) braki.add(t);
        }
    }
    return [...braki];
}

// ─────────────────────────────────────────────────────────────────────────────
// KROK 2 — SCENARIUSZ SCENY (dla agentów rysujących)
// ─────────────────────────────────────────────────────────────────────────────

export function promptScenariusza({ scena, uniwersum, assety, rozmowa }) {
    return {
        system: 'Jesteś scenarzystą piszącym dla agentów, które RYSUJĄ kadry. Piszesz po polsku, konkretnie i obrazowo. Bez wstępów, bez komentarzy o sobie.',
        prompt: [
            `Napisz scenariusz SCENY ${scena.nr}: „${scena.tytul}".`,
            `Cel sceny: ${scena.cel || '—'}`,
            `Nastrój: ${scena.nastroj || '—'}`,
            `Lokacja: ${scena.lokacja || '—'} · Postacie: ${scena.postacie.join(', ') || '—'} · Rekwizyty: ${scena.rekwizyty.join(', ') || '—'} · Muzyka: ${scena.muzyka || '—'}`,
            '',
            'STRUKTURA (trzymaj się jej dokładnie):',
            'NAGŁÓWEK — jedna linia: lokacja, pora, światło.',
            'OPIS — 3–5 zdań: co się dzieje, w kolejności.',
            'KADRY — od 3 do 6 punktów. Każdy kadr w jednej linii, w formacie:',
            '  KADR n [plan: bliski/średni/daleki] [assety: nazwa, nazwa] — opis tego, co WIDAĆ: kompozycja, światło, kolor, gest. Bez dialogu.',
            'DIALOG — jeśli scena go ma, krótkie kwestie w formie „POSTAĆ: kwestia".',
            '',
            'ZASADY: assety cytuj dosłownie z listy przy każdym kadrze. Światło i kolor zgodne ze światem poniżej.',
            'Nie dopisuj wydarzeń, których nie ma w rozmowie.',
            '',
            '=== ŚWIAT ===',
            opisUniwersum(uniwersum),
            '',
            '=== BIBLIOTEKA ===',
            spisAssetow(assety),
            '',
            '=== USTALENIA Z ROZMOWY (fragment) ===',
            rozmowa.slice(-3500),
        ].join('\n'),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// KROK 3 — PROZA (książka uniwersum)
// ─────────────────────────────────────────────────────────────────────────────

export function promptProzy({ scena, uniwersum, poprzedni = '' }) {
    return {
        system: 'Jesteś powieściopisarzem. Piszesz po polsku, prozą literacką, w trzeciej osobie, czasem teraźniejszym. Bez tytułów, bez nagłówków, bez komentarzy — sam tekst rozdziału.',
        prompt: [
            `Napisz rozdział powieści odpowiadający scenie „${scena.tytul}".`,
            `Co ma się wydarzyć: ${scena.cel || '—'}. Nastrój: ${scena.nastroj || '—'}.`,
            `Miejsce: ${scena.lokacja || '—'}. Postacie: ${scena.postacie.join(', ') || '—'}.`,
            '',
            'Długość: 350–550 słów. Zmysłowo, obrazowo, bez pośpiechu. Zmiany światła i przestrzeni są w tym świecie ZNACZĄCE — używaj ich.',
            poprzedni ? `\nPoprzedni rozdział kończył się tak (zachowaj ciągłość, nie powtarzaj):\n${poprzedni.slice(-600)}` : '',
            '',
            '=== ŚWIAT ===',
            opisUniwersum(uniwersum),
        ].join('\n'),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// SKŁADANIE ROZDZIAŁU RĘKOPISU
// ─────────────────────────────────────────────────────────────────────────────

function ucieknijHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Tekst modelu → HTML rozdziału ze STOPKĄ PODPISU.
 *
 * ⚠️ Stopka nie jest ozdobą. To ona odróżnia szkic Skryby od prozy Suwerena,
 * gdy oba leżą obok siebie w tym samym rękopisie.
 */
export function jakoRozdzial(tekst, { silnik, rodzaj, scena, rozmowaId }) {
    const akapity = String(tekst).split(/\n{2,}|\n(?=[A-ZĄĆĘŁŃÓŚŹŻ]{3,}[ —:-])/)
        .map((a) => a.trim()).filter(Boolean)
        .map((a) => `<p>${ucieknijHtml(a).replace(/\n/g, '<br>')}</p>`)
        .join('\n');
    const stopka = `<p class="podpis-skryby" style="opacity:.55;font-size:.85em">— szkic Skryby · ${ucieknijHtml(rodzaj)} · scena ${scena.nr} · silnik: ${ucieknijHtml(silnik)} (lokalnie) · z rozmowy ${ucieknijHtml(rozmowaId)}</p>`;
    return `${akapity}\n${stopka}`;
}

export function tytulRozdzialu(rodzaj, scena) {
    const etykieta = rodzaj === 'scenariusz' ? 'scenariusz' : 'proza';
    return `[szkic AI · ${etykieta}] ${scena.nr}. ${scena.tytul}`;
}

export default {
    zwezRozmowe, spisAssetow,
    promptPlanu, odczytajPlan, brakujaceAssety,
    promptScenariusza, promptProzy,
    jakoRozdzial, tytulRozdzialu,
};
