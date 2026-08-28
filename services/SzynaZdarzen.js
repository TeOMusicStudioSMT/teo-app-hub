/**
 * 🚌 Szyna zdarzeń agentów — wspólny kanał, na którym TeOgochi meldują, co robią.
 *
 * PO CO: Suweren chciał WORKPalace (podgląd, co agenci robią) i rozmów między
 * nimi (Klatka pyta Joannę o muzykę). Oba potrzebują TEGO SAMEGO fundamentu:
 * miejsca, w którym agent zostawia ślad. Bez niego WORKPalace byłby pustym
 * oknem albo — gorzej — atrapą pokazującą wymyśloną aktywność.
 *
 * Konstrukcja świadomie prosta:
 *   · pierścień w pamięci (szybki odczyt dla UI),
 *   · dopisywanie do JSONL na dysku (przeżywa restart mostu),
 *   · SSE dla żywego podglądu.
 *
 * ⚠️ CZEGO TA SZYNA NIE ROBI: nie uruchamia agentów i nie zmusza ich do meldunku.
 * Pokazuje TYLKO to, co ktoś na nią wyśle. Agent, który milczy, będzie na
 * WORKPalace niewidoczny — i to jest uczciwe, a nie zepsute.
 */
import fs from 'fs/promises';
import path from 'path';

const PLIK = () => path.join(process.cwd(), '_OtakOs_Wymiar', 'szyna.jsonl');
const POJEMNOSC = 500;          // ile zdarzeń trzymamy w pamięci
const MAX_TRESC = 4000;         // dłuższe tniemy — szyna to dziennik, nie magazyn

const pierscien = [];
const sluchacze = new Set();    // odpowiedzi SSE
let licznik = 0;

/** Dopisz zdarzenie. Zwraca zapisany rekord. */
export async function nadaj({ agent, rodzaj, tresc, zadanie = null, dane = null }) {
    const zdarzenie = {
        id: ++licznik,
        kiedy: new Date().toISOString(),
        agent: String(agent || 'nieznany').slice(0, 40),
        rodzaj: String(rodzaj || 'info').slice(0, 40),
        tresc: String(tresc ?? '').slice(0, MAX_TRESC),
        zadanie,
        dane,
    };

    pierscien.push(zdarzenie);
    if (pierscien.length > POJEMNOSC) pierscien.shift();

    // Dysk nie może wywrócić nadania — UI ma dostać zdarzenie nawet, gdy zapis padnie.
    fs.mkdir(path.dirname(PLIK()), { recursive: true })
        .then(() => fs.appendFile(PLIK(), JSON.stringify(zdarzenie) + '\n', 'utf8'))
        .catch(() => { /* dysk pełny albo brak praw — pamięć działa dalej */ });

    for (const res of sluchacze) {
        try { res.write(`data: ${JSON.stringify(zdarzenie)}\n\n`); }
        catch { sluchacze.delete(res); }
    }
    return zdarzenie;
}

/** Ostatnie zdarzenia, opcjonalnie jednego agenta. */
export function ostatnie({ agent = null, ile = 100 } = {}) {
    const lista = agent ? pierscien.filter(z => z.agent === agent) : pierscien;
    return lista.slice(-Math.max(1, Math.min(POJEMNOSC, ile)));
}

/** Kto był aktywny i kiedy — podstawa widoku „kto teraz pracuje". */
export function ktoPracuje() {
    const mapa = new Map();
    for (const z of pierscien) {
        mapa.set(z.agent, { agent: z.agent, ostatnie: z.kiedy, rodzaj: z.rodzaj, tresc: z.tresc, ile: (mapa.get(z.agent)?.ile ?? 0) + 1 });
    }
    return [...mapa.values()].sort((a, b) => (a.ostatnie < b.ostatnie ? 1 : -1));
}

/** Podłącz słuchacza SSE. Zwraca funkcję odpinającą. */
export function sluchaj(res) {
    sluchacze.add(res);
    return () => sluchacze.delete(res);
}

/** Wczytaj ogon dziennika z dysku po starcie mostu — żeby nie zaczynać od pustki. */
export async function wczytajOgon() {
    try {
        const tekst = await fs.readFile(PLIK(), 'utf8');
        const linie = tekst.trim().split('\n').slice(-POJEMNOSC);
        for (const l of linie) {
            try {
                const z = JSON.parse(l);
                pierscien.push(z);
                if (typeof z.id === 'number' && z.id > licznik) licznik = z.id;
            } catch { /* uszkodzona linia — pomijamy */ }
        }
        return pierscien.length;
    } catch {
        return 0;
    }
}

export default { nadaj, ostatnie, ktoPracuje, sluchaj, wczytajOgon };
