/**
 * 🧪 TeO-Sim — pętla wnioskowania agenta, rozliczana w GRV.
 *
 * ⚠️ CO DOSTAŁEM I DLACZEGO TEGO NIE PRZENIOSŁEM 1:1.
 * `_OtakOs_Wymiar/src/services/teo-sim/ReasoningLoopSimulator.ts` był atrapą
 * na wylot — jego własny komentarz mówi „Metody pomocnicze (Mocki systemowe)":
 *
 *   captureSystemState() → zawsze napis "VRAM_STALL_ERROR_0x01"
 *   applyAction()        → zawsze napis "SYSTEM_OK"
 *   queryModel()         → { proposedAction: "flush_vram", tokens: 10 albo 50 }
 *   applyReward/Penalty  → console.log
 *
 * `queryModel` NIGDY nie wołał modelu, choć `LocalModelAdapter` leżał obok.
 * Walidator porównywał liczbę słów „error" w dwóch WPISANYCH NA SZTYWNO
 * napisach, więc pętla zawsze kończyła się sukcesem w pierwszym obiegu.
 * Przemianowanie tych 10/50 „tokenów" na GRV dałoby FAŁSZYWĄ CENĘ ZA FIKCYJNĄ
 * PRACĘ — czyli coś gorszego niż sama atrapa.
 *
 * Dlatego pętla liczy naprawdę:
 *   · myśl generuje ŻYWY model przez Ollamę (`/api/generate`),
 *   · koszt bierze się z `eval_count` + `prompt_eval_count`, które oddaje Ollama,
 *   · rozliczenie idzie przez KSIĘGĘ GRV — tą samą, co każdy inny ruch.
 *
 * ⚠️ KURS. Liczenie lokalne jest darmowe (Kronika: „Token cost: 0"), więc GRV
 * NIE jest tu opłatą za prąd — to miara włożonej pracy, płacona przez zarządcę
 * (TeO) agentowi za wynik. Nagrodę dostaje się za ROZWIĄZANIE, nie za mielenie:
 * pętla bez rezultatu nie płaci nic.
 */

/** Ile GRV za tysiąc przeliczonych tokenów. Jawna stała — nie magia w kodzie. */
const GRV_ZA_1K_TOKENOW = 1;
/** Premia za domknięcie sprawy. Bez niej opłacałoby się mielić w kółko. */
const GRV_ZA_ROZWIAZANIE = 25;
/** Twardy sufit jednego przebiegu — pętla nie może wydrenować zarządcy. */
const SUFIT_GRV = 500;

const MAX_OBIEGOW = 6;

/**
 * Jedna myśl: pytanie do modelu przez Ollamę. Zwraca treść i FAKTYCZNY koszt
 * w tokenach policzony przez silnik, nie zgadnięty.
 */
async function mysl({ ollamaBase, model, system, prompt }) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120000);
    try {
        const r = await fetch(`${ollamaBase}/api/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ model, system, prompt, stream: false }),
        });
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
        const d = await r.json();
        return {
            tresc: String(d.response || '').trim(),
            tokeny: (Number(d.eval_count) || 0) + (Number(d.prompt_eval_count) || 0),
        };
    } finally { clearTimeout(t); }
}

/**
 * Czy myśl faktycznie ruszyła sprawę do przodu.
 *
 * ⚠️ To nadal HEURYSTYKA, nie dowód — i mówimy o tym wprost zamiast nazywać ją
 * „Kotwicą Prawdy". Liczy, czy w opisie stanu ubyło słów o błędzie. Pierwotna
 * wersja robiła to samo, tylko na dwóch napisach wpisanych w kod.
 */
function ubyloBledow(przed, po) {
    const licz = (s) => (String(s).match(/error|błąd|blad|stall|fail|aborted|exception/gi) || []).length;
    return licz(po) < licz(przed);
}

/**
 * Pętla wnioskowania.
 *
 * `stanPrzed` musi podać wołający — to REALNY opis sytuacji (log, komunikat
 * błędu, wynik testu). Bez niego nie ma czego porównywać, więc odmawiamy
 * zamiast podstawiać wymyślony „VRAM_STALL_ERROR_0x01".
 */
export async function petlaWnioskowania({
    agent, scenariusz, stanPrzed, model, modelCiezki,
    ollamaBase, przelej, wezelAgenta,
}) {
    if (!agent) return { ok: false, powod: 'Brak agenta.' };
    if (!scenariusz?.trim()) return { ok: false, powod: 'Brak scenariusza.' };
    if (!stanPrzed?.trim()) {
        return {
            ok: false,
            powod: 'Brak „stanPrzed" — realnego opisu sytuacji (log, błąd, wynik testu). '
                + 'Bez niego walidacja porównywałaby wymyślone napisy, a to nie jest walidacja.',
        };
    }

    const lekki = model || 'gemma4:e2b';
    const ciezki = modelCiezki || lekki;
    let uzywany = lekki;

    const obiegi = [];
    let tokenyRazem = 0;
    let rozwiazane = false;
    let ostatnia = stanPrzed;

    for (let i = 1; i <= MAX_OBIEGOW && !rozwiazane; i++) {
        let t;
        try {
            t = await mysl({
                ollamaBase, model: uzywany,
                system: `Jesteś agentem ${agent} w Katedrze OtakOS. Proponuj JEDNO konkretne działanie `
                    + 'naprawcze. Krótko, po polsku, bez zastrzeżeń i formułek.',
                prompt: `Scenariusz: ${scenariusz}\n\nStan teraz:\n${ostatnia}\n\nCo zrobić?`,
            });
        } catch (e) {
            obiegi.push({ obieg: i, model: uzywany, blad: e.message });
            break;   // model milczy — nie udajemy, że pętla trwa
        }

        tokenyRazem += t.tokeny;
        const poprawa = ubyloBledow(ostatnia, t.tresc);
        obiegi.push({
            obieg: i, model: uzywany, tokeny: t.tokeny,
            propozycja: t.tresc.slice(0, 300), poprawa,
        });

        if (poprawa) {
            rozwiazane = true;
        } else if (uzywany === lekki && ciezki !== lekki) {
            uzywany = ciezki;      // eskalacja: lekki nie dał rady
        }
        ostatnia = t.tresc || ostatnia;
    }

    // ── ROZLICZENIE W GRV ───────────────────────────────────────────────────
    const zaPrace = (tokenyRazem / 1000) * GRV_ZA_1K_TOKENOW;
    const zaWynik = rozwiazane ? GRV_ZA_ROZWIAZANIE : 0;
    const nalezne = Math.min(SUFIT_GRV, Math.round((zaPrace + zaWynik) * 100) / 100);

    let rozliczenie = { wyplacone: 0, powod: 'Nic do wypłaty — pętla nie policzyła ani jednego tokenu.' };
    if (nalezne > 0 && typeof przelej === 'function') {
        try {
            await przelej('TeO', wezelAgenta || agent, nalezne);
            rozliczenie = { wyplacone: nalezne, powod: null, do: wezelAgenta || agent };
        } catch (e) {
            // Nieudany przelew NIE zamienia się w cichy sukces.
            rozliczenie = { wyplacone: 0, powod: `Księga odmówiła: ${e.message}` };
        }
    }

    return {
        ok: true, agent, rozwiazane, obiegow: obiegi.length,
        tokeny: tokenyRazem,
        grv: { zaPrace: Math.round(zaPrace * 100) / 100, zaWynik, nalezne, ...rozliczenie },
        kurs: { grvZa1kTokenow: GRV_ZA_1K_TOKENOW, grvZaRozwiazanie: GRV_ZA_ROZWIAZANIE, sufit: SUFIT_GRV },
        obiegi,
    };
}

export default { petlaWnioskowania };
