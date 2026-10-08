/**
 * ⚖️ Delegat na Jev (Suweren 2026-10-08: „zrób Delegata na Jev… oraz wkomponuj okno delegata do stołu”).
 *
 * Delegat to mały model lokalny (gemma4:e2b) z narzędziami podawanymi jawnym JSON-em. Jego dwie słabości
 * (zmierzone na telefonie Suwerena 2026-09-18): (1) nie wywołuje narzędzia, gdy powinien — pisze
 * „katedra.stan:{}” w zdaniu albo obiecuje „przygotuję”; (2) potrafi wezwać narzędzie, o które nikt nie prosił.
 * Jev (services/Jev.js) odpowiada liczbą na typowane pytania, więc:
 *   · INTENCJA — pytanie `choice`: którego narzędzia wymaga wypowiedź Suwerena (albo „rozmowa”).
 *     Narzędzie bez argumentów most wykonuje od razu; z argumentami — model dostaje twardą wskazówkę.
 *   · STRAŻ — przed narzędziem CIĘŻKIM (zamknięcie procesu, harness, ręce na telefonie) pytanie `noul`:
 *     czy Suweren wprost o to prosi? Niskie p = odmowa z powodem, model ma dopytać.
 * Bez klucza / błąd Jev = Delegat jak dawniej (nic nie udajemy).
 *
 * Kontekst karty Stołu (`blokKarty`): rozmowa przy otwartej karcie w StoL — Delegat zna tytuł, etap,
 * wizję, rundy, oceny Sędziego, braki i zlecenia; decyzje zostają przyciskami Suwerena.
 */

export const PROG_INTENCJI = Number(process.env.OTAKOS_DELEGAT_JEV_PROG) || 0.6;
export const PROG_STRAZY = Number(process.env.OTAKOS_DELEGAT_JEV_STRAZ) || 0.5;
export const ROZMOWA = 'rozmowa';

/** Narzędzia, które most może wykonać sam, bez argumentów od modelu (`projekty.stan` — szukaj opcjonalne). */
export const BEZ_ARGUMENTOW = new Set(['katedra.stan', 'music.status', 'system.pamiec', 'projekty.stan']);

/**
 * Pytanie o intencję: opcje = dozwolone narzędzia z opisem + „rozmowa”.
 * @param {{ nazwa:string, opis:string }[]} narzedzia
 */
export function pytanieIntencji(narzedzia) {
    return {
        type: 'choice',
        instructions: 'Którą czynność Katedry musi wykonać Delegat, żeby odpowiedzieć na OSTATNIĄ wypowiedź Suwerena? Wybierz „rozmowa”, gdy wystarczy zwykła odpowiedź (powitanie, opinia, pytanie o znaczenie, rozmowa o tym, co już powiedziano).',
        criteria: {
            [ROZMOWA]: 'Zwykła odpowiedź słowami — bez sprawdzania i bez zlecania czegokolwiek.',
            ...Object.fromEntries(narzedzia.map((n) => [n.nazwa, String(n.opis).slice(0, 400)])),
        },
    };
}

/** Odpowiedź Jev → { wybor, p, drugi } (p = prawdopodobieństwo wyboru). */
export function wynikIntencji(odp) {
    const a = odp?.answers?.intencja;
    const probs = a?.probabilities && typeof a.probabilities === 'object' ? Object.entries(a.probabilities).map(([k, v]) => [k, Number(v) || 0]).sort((x, y) => y[1] - x[1]) : [];
    const wybor = typeof a?.choice === 'string' ? a.choice : probs[0]?.[0] ?? null;
    const p = probs.find(([k]) => k === wybor)?.[1] ?? (Number.isFinite(Number(a?.confidence)) ? Number(a.confidence) : null);
    const drugi = probs.find(([k]) => k !== wybor) ?? null;
    return { wybor, p, drugi: drugi ? { wybor: drugi[0], p: drugi[1] } : null };
}

/**
 * Rozpoznaj intencję. → { wybor, p, drugi, model, decyzja: 'wykonaj'|'wskazowka'|'rozmowa'|'niepewne' } albo null bez klucza.
 * Błąd Jev = wyjątek (wołający idzie dalej bez Jev).
 */
export async function rozpoznajIntencje(jev, { tekst, historia = [], narzedzia, karta = null }) {
    if (!jev?.stan?.().maKlucz || !narzedzia.length) return null;
    const d = await jev.zapytaj({
        state: {
            ostatnia_wypowiedz_suwerena: String(tekst).slice(0, 2000),
            wczesniej: historia.slice(-6).map((t) => `${t.kto}: ${String(t.tresc).slice(0, 300)}`).join('\n'),
            ...(karta ? { rozmowa_przy_karcie_stolu: `${karta.tytul} (etap ${karta.etap})` } : {}),
        },
        questions: { intencja: pytanieIntencji(narzedzia) },
    });
    const w = wynikIntencji(d);
    const pewne = w.p != null && w.p >= PROG_INTENCJI;
    const decyzja = !w.wybor || w.wybor === ROZMOWA ? ROZMOWA
        : !pewne ? 'niepewne'
        : BEZ_ARGUMENTOW.has(w.wybor) ? 'wykonaj' : 'wskazowka';
    return { ...w, model: d.model, decyzja };
}

/** Straż ciężkiego narzędzia → { p, ok, model } albo null bez klucza. Błąd Jev = wyjątek. */
export async function czyWprostZlecone(jev, { tekst, historia = [], narzedzie, opis, argumenty }) {
    if (!jev?.stan?.().maKlucz) return null;
    const d = await jev.zapytaj({
        state: {
            wypowiedz_suwerena: String(tekst).slice(0, 2000),
            wczesniej: historia.slice(-4).map((t) => `${t.kto}: ${String(t.tresc).slice(0, 300)}`).join('\n'),
            czynnosc: `${narzedzie} — ${opis}`, argumenty: JSON.stringify(argumenty ?? {}).slice(0, 600),
        },
        questions: {
            wprost: {
                type: 'noul',
                instructions: 'Czy Suweren WPROST prosi o wykonanie TEJ czynności z TYMI argumentami (np. wskazał proces do zamknięcia, cel zmiany w kodzie, zadanie na telefonie)?',
                criteria: { true: 'Tak — Suweren jasno zlecił tę czynność i to, czego dotyczy.', false: 'Nie — Suweren tylko pyta, rozważa albo mówi o czymś innym; czynność byłaby na wyrost.' },
            },
        },
    });
    const p = Number(d.answers?.wprost?.noul);
    return { p: Number.isFinite(p) ? p : null, ok: !Number.isFinite(p) || p >= PROG_STRAZY, model: d.model };
}

/** Kontekst karty Stołu do promptu Delegata (fakty z mostu, nic zgadywanego). */
export function blokKarty(k) {
    if (!k) return '';
    const p = k.projektSkrot;
    const linie = [
        `ROZMOWA PRZY KARCIE STOŁU „${k.tytul}” (etap: ${k.etap}). Suweren patrzy na nią w StoL.`,
        `Wizja/treść karty: ${String(k.tresc ?? '').replace(/\s+/g, ' ').slice(0, 1500)}`,
    ];
    if (p) {
        linie.push(`Projekt stada: stan ${p.stan}, runda ${p.runda} z ${p.rundy}, wkłady ${p.gotowe}/${p.razem}.`);
        if (p.oceny?.length) linie.push(`Oceny Sędziego (zgodność z wizją): ${p.oceny.map((o) => `R${o.runda} ${o.ocena ?? '—'}/10`).join(', ')}.`);
        if (p.braki?.length) linie.push(`Braki ostatniej rundy: ${p.braki.slice(0, 5).map((b) => String(b).slice(0, 200)).join(' | ')}`);
        if (p.biblia) linie.push(`Biblia projektu (początek): ${String(p.biblia).replace(/\s+/g, ' ').slice(0, 1200)}`);
        if (p.zlecenia?.length) linie.push(`Zlecenia modułów: ${p.zlecenia.map((z) => `${z.modul} [${z.stan}]: ${String(z.opis).slice(0, 80)}`).join('; ')}.`);
    }
    linie.push('Decyzje (przyjąć, ratyfikować, doskonalić, odłożyć) Suweren podejmuje PRZYCISKAMI karty — Ty doradzasz, wyjaśniasz i sprawdzasz fakty, niczego nie przesądzasz.');
    return linie.join('\n');
}

export default { pytanieIntencji, wynikIntencji, rozpoznajIntencje, czyWprostZlecone, blokKarty, BEZ_ARGUMENTOW, PROG_INTENCJI, PROG_STRAZY, ROZMOWA };
