/**
 * 🧐 RECENZENT KODEKSA — czyta to, co Kodeks oddał, zanim uwierzymy w „build zielony".
 *
 * PO CO. Sędziowie AppStudio patrzą na DZIAŁAJĄCĄ apkę (tsc, vite, konsola, zrzut, zachowanie).
 * Nikt nie patrzył na sam KOD. A mały model ma kilka sztuczek, które przechodzą przez build
 * i testy, a zostawiają projekt gorszy niż był:
 *   · oddaje plik „w całości", tylko że z `// ... reszta bez zmian` — i reszta znika,
 *   · ucisza tsc (`@ts-ignore`, `@ts-nocheck`) zamiast poprawić typ,
 *   · połyka błąd pustym `catch {}` — konsola czysta, sędzia przeglądarki zadowolony,
 *   · wstawia atrapę (`throw new Error('not implemented')`),
 *   · wycina funkcje, których zadanie nie kazało ruszać (build przechodzi, funkcji nie ma),
 *   · wpisuje sędziemu gry gotową odpowiedź (`kontekst: 'running'` na sztywno).
 * Reguły Kodeksa zabraniały części z tego SŁOWNIE. Recenzent to egzekwuje.
 *
 * JAK. Deterministycznie, bez modelu: porównuje stary i nowy tekst każdego pliku z rundy.
 * Liczą się tylko rzeczy DODANE w tej rundzie — stary dług projektu nie blokuje nowej pracy.
 *
 * ZASADA 0.00G: blokujemy tylko to, co jest pewne i ma jedno zdanie wyjaśnienia dla modelu.
 * Rzeczy wątpliwe (`any`, TODO, `.catch(() => {})`) idą jako UWAGI — widać je w krokach,
 * ale nie palą rundy.
 */

/** Słowa w zleceniu, które USPRAWIEDLIWIAJĄ usuwanie kodu. */
const ZLECENIE_USUWA = /usu[nń]|wytnij|skasuj|wyrzu[cć]|uprość|uprosc|refaktor|przepisz|podziel|wydziel|zast[aą]p|remove|delete|refactor|split|replace/i;

/** Komentarz-zaślepka: „// ...", „// ... reszta bez zmian", „/* existing code *\/". */
const ZASLEPKA = /(?:\/\/|\/\*|\{\/\*)\s*(?:\.{3}|…)\s*(?:\*\/|\}|$)|(?:\/\/|\/\*|\{\/\*)[^\n]*(?:\.{3}|…)[^\n]*(?:reszt|bez zmian|pozosta|poprzedni|jak wcze|rest of|existing|unchanged|same as|remaining|previous)|(?:\/\/|\/\*|\{\/\*)\s*(?:rest of the (?:code|file|component|function)|existing code|reszta (?:kodu|pliku|funkcji|komponentu)|kod bez zmian)\b/i;

const REGULY_LINII = [
    { id: 'zaslepka', blokuje: true, re: ZASLEPKA,
      opis: 'komentarz-zaślepka zamiast kodu', rada: 'Oddajesz plik W CAŁOŚCI — wpisz z powrotem kod, który zastąpiłeś komentarzem „…".' },
    { id: 'ucisza-tsc', blokuje: true, re: /@ts-(?:ignore|nocheck|expect-error)\b|eslint-disable/,
      opis: 'uciszenie kompilatora', rada: 'Nie uciszaj tsc — popraw typ, na który narzeka.' },
    { id: 'pusty-catch', blokuje: true, re: /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/,
      opis: 'pusty catch połyka błąd', rada: 'Obsłuż błąd albo go zaloguj (console.error) — pusty catch ukrywa awarię przed testem. Jeśli cisza jest celowa, napisz w catch komentarz, czemu.' },
    { id: 'atrapa', blokuje: true, re: /throw\s+new\s+Error\(\s*['"`][^'"`]*(?:not implemented|todo|nie zaimplement|do zrobienia|placeholder)/i,
      opis: 'atrapa zamiast implementacji', rada: 'Napisz działający kod zamiast rzucać „not implemented".' },
    { id: 'oszukany-sedzia', blokuje: true, re: /kontekst\s*:\s*['"]running['"]/,
      opis: 'stan audio wpisany na sztywno', rada: 'window.__gra.dzwiek.kontekst ma pochodzić z AudioContext.state, nie z literału — sędzia ma widzieć prawdziwy stan.' },
    { id: 'any', blokuje: false, re: /(?::\s*any\b|\bas\s+any\b|<any>)/,
      opis: 'typ any', rada: 'Otypuj zamiast any.' },
    { id: 'polkniety-promise', blokuje: false, re: /\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*(?:\{\s*\}|undefined|null)\s*\)/,
      opis: 'połknięty błąd obietnicy', rada: 'Zaloguj błąd obietnicy.' },
    { id: 'todo', blokuje: false, re: /\/\/\s*(?:TODO|FIXME|XXX)\b/,
      opis: 'TODO w nowym kodzie', rada: 'Dokończ albo usuń TODO.' },
];

/** Tylko pliki kodu podlegają regułom linii (CSS/HTML mają inne komentarze). */
const KOD = /\.(?:tsx?|jsx?|mjs)$/;

/** Wielozbiór linii (przycięte, bez pustych) → licznik. */
function linie(tresc) {
    const m = new Map();
    for (const l of String(tresc ?? '').replace(/\r\n/g, '\n').split('\n')) {
        const t = l.trim();
        if (t) m.set(t, (m.get(t) || 0) + 1);
    }
    return m;
}

/** Linie dodane w nowej wersji (wielozbiorowo — powtórzona linia liczy się tyle razy, ile przybyło). */
export function dodaneLinie(stara, nowa) {
    const s = linie(stara);
    const out = [];
    String(nowa ?? '').replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
        const t = l.trim();
        if (!t) return;
        if (s.get(t) > 0) { s.set(t, s.get(t) - 1); return; }
        out.push({ linia: i + 1, tekst: t });
    });
    return out;
}

/** Nazwy eksportowane z pliku TS/JS (funkcje, stałe, klasy, typy, `export { … }`). */
export function eksporty(tresc) {
    const out = new Set();
    const t = String(tresc ?? '');
    for (const m of t.matchAll(/\bexport\s+(?:default\s+)?(?:async\s+)?(?:function\s*\*?|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
    for (const m of t.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
        for (const c of m[1].split(',')) { const n = c.trim().split(/\s+as\s+/).pop().trim(); if (n) out.add(n); }
    }
    return out;
}

/** Liczba niepustych linii. */
const ile = (t) => String(t ?? '').split('\n').filter((l) => l.trim()).length;

/**
 * Recenzja jednej rundy.
 * @param {{ pliki: { sciezka:string, stara:string|null, nowa:string }[], cel?:string }} r
 *        `stara === null` — plik nowy w tej rundzie.
 * @returns {{ ok:boolean, blokujace:object[], uwagi:object[], feedback:string, podsumowanie:string }}
 */
export function recenzuj({ pliki, cel = '' }) {
    const blokujace = [], uwagi = [];
    const zapisz = (u) => (u.blokuje ? blokujace : uwagi).push(u);

    // 1. Reguły na DODANYCH liniach kodu.
    for (const p of pliki) {
        if (!KOD.test(p.sciezka)) continue;
        for (const { linia, tekst } of dodaneLinie(p.stara, p.nowa)) {
            for (const r of REGULY_LINII) {
                if (r.re.test(tekst)) zapisz({ regula: r.id, blokuje: r.blokuje, plik: p.sciezka, linia, tekst: tekst.slice(0, 160), opis: r.opis, rada: r.rada });
            }
        }
    }

    // 2. Wycięty kod: z pliku zniknęły eksporty, których nie ma już NIGDZIE w rundzie
    //    (przeniesienie do nowego modułu jest w porządku), a zlecenie nie kazało usuwać.
    if (!ZLECENIE_USUWA.test(cel)) {
        const teraz = new Set(pliki.flatMap((p) => [...eksporty(p.nowa)]));
        for (const p of pliki) {
            if (p.stara === null || !KOD.test(p.sciezka)) continue;
            const zniknely = [...eksporty(p.stara)].filter((n) => !teraz.has(n));
            if (zniknely.length) {
                zapisz({ regula: 'wyciete-eksporty', blokuje: true, plik: p.sciezka, linia: null,
                    tekst: zniknely.join(', '), opis: `zniknęło: ${zniknely.join(', ')}`,
                    rada: `Zadanie nie kazało niczego usuwać, a z ${p.sciezka} zniknęło: ${zniknely.join(', ')}. Przywróć to (albo przenieś do innego pliku i oddaj go).` });
            }
            // Plik skurczył się o ponad połowę, a kod nie przeszedł do nowych plików rundy.
            const przed = ile(p.stara), po = ile(p.nowa);
            const przeniesione = pliki.filter((q) => q.stara === null).reduce((a, q) => a + ile(q.nowa), 0);
            if (przed >= 30 && po < przed * 0.5 && przeniesione < (przed - po) * 0.5) {
                zapisz({ regula: 'skurczony-plik', blokuje: true, plik: p.sciezka, linia: null,
                    tekst: `${przed} → ${po} linii`, opis: `plik skurczył się z ${przed} do ${po} linii`,
                    rada: `${p.sciezka} stracił ${przed - po} z ${przed} linii, a zadanie nie kazało usuwać. Oddaj plik w CAŁOŚCI — ze wszystkim, co w nim było, plus Twoja zmiana.` });
            }
        }
    }

    const fmt = (u) => `- ${u.plik}${u.linia ? `:${u.linia}` : ''} — ${u.opis}${u.linia ? ` („${u.tekst}")` : ''}. ${u.rada}`;
    const feedback = blokujace.length
        ? `RECENZENT KODU odrzucił tę rundę (build nawet nie ruszał):\n${blokujace.map(fmt).join('\n')}`
        : '';
    const podsumowanie = blokujace.length
        ? `recenzent: ${blokujace.length} blokujące — ${[...new Set(blokujace.map((u) => u.regula))].join(', ')}`
        : `recenzent: czysto${uwagi.length ? ` (uwagi: ${uwagi.map((u) => `${u.opis} ${u.plik}${u.linia ? ':' + u.linia : ''}`).slice(0, 5).join('; ')})` : ''}`;
    return { ok: blokujace.length === 0, blokujace, uwagi, feedback, podsumowanie };
}

export default { recenzuj, dodaneLinie, eksporty };
