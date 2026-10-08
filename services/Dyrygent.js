/**
 * 🎼 Dyrygent — dobiera MODELE do zadań, tak jak Jadziunia dobiera skille.
 *
 * Suweren (2026-09-28): „przydałby się agent dyrygent i api modeli dostępnych w Katedrze… do zadania…
 * jak mamy już w Jadziuni mechanizm doboru skilli, tylko że do modeli".
 *
 *   katalog()  — co NAPRAWDĘ jest w Katedrze: modele Ollamy (/api/tags: rozmiar, rodzina, parametry,
 *                kwantyzacja) + karta modelu od Suwerena (opis, mocne strony) + wykute w Kuźni (własny
 *                model TeOgochi) + statystyka z pracy stada: w ilu wkładach pisał i jaka była średnia ocena
 *                Sędziego projektów, w których pisał. Nic tu nie jest wymyślone — pusta karta zostaje pusta.
 *   dobierz()  — model Dyrygenta czyta katalog i zadanie (albo skład zespołu projektu) i proponuje
 *                model dla każdego TeOgochi z krótkim powodem. Wynik jest SPRAWDZANY: tylko modele z
 *                katalogu, tylko agenci z listy; resztę odrzucamy z powodem, zamiast zgadywać.
 *   zastosuj() — propozycja → stałe silniki agentów (ModeleAgentow). Tylko przy maszynie, decyzja Suwerena.
 * Projekt Stada może też wziąć przydział TYLKO dla siebie (`dyrygent: true`) — bez zmiany stałych silników.
 */
import fs from 'fs/promises';
import path from 'path';
import { rozmiarModelu } from './BledyModeli.js';
import { zgniecionyKwant } from './ZwiadowcaHF.js';

let cfg = {
    katalogWymiar: path.join(process.cwd(), '_OtakOs_Wymiar'),
    /** → { models: [{ name, size, details: { family, parameter_size, quantization_level } }] } */
    tagi: async () => ({ models: [] }),
    /** → projekty stada (pełne: kroki z modelem, oceny) */
    projekty: async () => [],
    /** → { <agent>: <model> } */
    modeleAgentow: async () => ({}),
    ustawModel: async () => { throw new Error('Most nie podpiął silników agentów.'); },
    /** → [{ agent, model }] modele wykute w Kuźni */
    wykute: async () => [],
    /** ({ system, prompt, model }) → tekst */
    pisz: async () => { throw new Error('Most nie podpiął modelu Dyrygenta.'); },
    model: () => 'gemma4',
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

const PLIK_KART = () => path.join(cfg.katalogWymiar, 'karty-modeli.json');
async function karty() { try { return JSON.parse(await fs.readFile(PLIK_KART(), 'utf8')); } catch { return {}; } }

const MODEL = /^[A-Za-z0-9._:\/-]{2,120}$/;

/** Karta modelu od Suwerena: opis i mocne strony (do czego go używać). Pusty opis = usuń kartę. */
export async function ustawKarte(nazwa, { opis = '', mocne = [] } = {}) {
    if (!MODEL.test(String(nazwa))) throw new Error('Zła nazwa modelu.');
    const k = await karty();
    const o = String(opis).trim().slice(0, 400);
    const m = (Array.isArray(mocne) ? mocne : String(mocne).split(',')).map((x) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 8);
    if (!o && !m.length) delete k[nazwa]; else k[nazwa] = { opis: o, mocne: m };
    await fs.mkdir(cfg.katalogWymiar, { recursive: true });
    const tmp = `${PLIK_KART()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(k, null, 2), 'utf8');
    await fs.rename(tmp, PLIK_KART());
    return k[nazwa] ?? null;
}

/** Statystyka z pracy stada: model → { wkladow, ocen, srednia } (ocena = ostatnia ocena Sędziego projektu). */
export function statystyki(projekty) {
    const st = {};
    for (const p of projekty ?? []) {
        const ocena = (p.oceny ?? []).filter((o) => o.ocena != null).at(-1)?.ocena ?? null;
        for (const k of p.kroki ?? []) {
            if (!k.model || k.stan !== 'gotowe') continue;
            const s = (st[k.model] ||= { wkladow: 0, ocen: 0, suma: 0 });
            s.wkladow++;
            if (ocena != null) { s.ocen++; s.suma += ocena; }
        }
    }
    return Object.fromEntries(Object.entries(st).map(([m, s]) => [m, { wkladow: s.wkladow, ocen: s.ocen, srednia: s.ocen ? Math.round((s.suma / s.ocen) * 10) / 10 : null }]));
}

/** Katalog modeli Katedry — to, co jest, z tym, co o nim wiadomo. */
export async function katalog() {
    const [t, k, projekty, przydzial, wykute] = await Promise.all([
        cfg.tagi().catch(() => ({ models: [] })), karty(), cfg.projekty().catch(() => []),
        cfg.modeleAgentow().catch(() => ({})), cfg.wykute().catch(() => []),
    ]);
    const st = statystyki(projekty);
    return (t.models ?? []).map((m) => {
        const nazwa = m.name ?? m.model;
        return {
            nazwa,
            rozmiarGB: m.size ? Math.round((m.size / 1e9) * 10) / 10 : null,
            rodzina: m.details?.family ?? null,
            parametry: m.details?.parameter_size ?? null,
            kwantyzacja: m.details?.quantization_level ?? null,
            karta: k[nazwa] ?? null,
            wlasny: wykute.find((w) => w.model === nazwa || `${w.model}:latest` === nazwa)?.agent ?? null,
            agenci: Object.entries(przydzial).filter(([, mm]) => mm === nazwa || `${mm}:latest` === nazwa).map(([a]) => a),
            praca: st[nazwa] ?? st[nazwa.replace(/:latest$/, '')] ?? { wkladow: 0, ocen: 0, srednia: null },
        };
    }).sort((a, b) => (b.praca.srednia ?? -1) - (a.praca.srednia ?? -1) || (a.rozmiarGB ?? 0) - (b.rozmiarGB ?? 0));
}

/** Pierwszy obiekt JSON z odpowiedzi modelu (małe modele lubią dopisać zdanie przed i po). */
export function wylowJson(tekst) {
    const t = String(tekst ?? '');
    const start = t.indexOf('{');
    if (start < 0) return null;
    for (let koniec = t.lastIndexOf('}'); koniec > start; koniec = t.lastIndexOf('}', koniec - 1)) {
        try { return JSON.parse(t.slice(start, koniec + 1)); } catch { /* krócej */ }
    }
    return null;
}

/**
 * Sprawdź propozycję modelu: tylko agenci z listy i modele z katalogu (nazwa z `:latest` albo bez).
 * Zwraca { przydzial, odrzucone } — odrzucone z powodem, żeby Suweren widział, co model zmyślił.
 */
export function sprawdzPrzydzial(propozycja, { agenci, modele }) {
    const znane = new Map(modele.flatMap((m) => [[m, m], [m.replace(/:latest$/, ''), m]]));
    const ids = new Set(agenci.map((a) => a.id));
    const przydzial = [], odrzucone = [];
    for (const w of Array.isArray(propozycja?.przydzial) ? propozycja.przydzial : []) {
        const agent = String(w?.agent ?? '').toLowerCase().trim();
        const model = znane.get(String(w?.model ?? '').trim());
        if (!ids.has(agent)) { odrzucone.push({ ...w, powod: 'nie ma takiego TeOgochi w zadaniu' }); continue; }
        if (!model) { odrzucone.push({ ...w, powod: 'nie ma takiego modelu w Katedrze' }); continue; }
        if (przydzial.some((p) => p.agent === agent)) continue;
        przydzial.push({ agent, model, powod: String(w?.powod ?? '').slice(0, 200) });
    }
    return { przydzial, odrzucone };
}

/**
 * Dobierz modele do zadania. `agenci`: [{ id, imie, dziedzina, zadanie? }] — np. kroki planu projektu.
 * Zwraca { przydzial, odrzucone, model, katalog } — nic nie zapisuje.
 */
export async function dobierz({ zadanie, agenci = [] }) {
    const opis = String(zadanie ?? '').trim();
    if (opis.length < 5) throw new Error('Opisz zadanie dla Dyrygenta.');
    if (!agenci.length) throw new Error('Dyrygent potrzebuje składu — którzy TeOgochi grają.');
    const kat = await katalog();
    if (!kat.length) throw new Error('Katedra nie ma żadnego modelu w Ollamie — nie ma z czego dobierać.');
    const linia = (m) => `- ${m.nazwa}${m.parametry ? ` (${m.parametry}` : ' ('}${m.rozmiarGB ? `, ${m.rozmiarGB} GB` : ''})` +
        `${m.wlasny ? ` — WŁASNY model TeOgochi „${m.wlasny}" (wykuty z jego pracy)` : ''}` +
        `${m.karta?.opis ? ` — ${m.karta.opis}` : ''}${m.karta?.mocne?.length ? ` [mocne: ${m.karta.mocne.join(', ')}]` : ''}` +
        `${m.praca.wkladow ? ` — w stadzie: ${m.praca.wkladow} wkładów${m.praca.srednia != null ? `, średnia ocena Sędziego ${m.praca.srednia}/10` : ''}` : ' — jeszcze nie pracował w stadzie'}`;
    const system = `Jesteś DYRYGENTEM Katedry OtakOS. Przydzielasz TeOgochi modele językowe do zadania — każdy gra na instrumencie, który mu służy.
Zasady: bierzesz WYŁĄCZNIE modele z KATALOGU (dokładna nazwa). Większy model do rozumowania, scalania i kodu; mniejszy i szybszy do krótkich, prostych wkładów. Jeśli TeOgochi ma WŁASNY model — zwykle to on. Liczą się oceny Sędziego z pracy stada. Pamiętaj, że karta graficzna jest jedna: nie dawaj wszystkim największego.
Odpowiadasz WYŁĄCZNIE JSON-em: {"przydzial":[{"agent":"<id>","model":"<nazwa z katalogu>","powod":"<jedno zdanie>"}]} — po jednym wpisie na każdego TeOgochi z listy.`;
    const prompt = `KATALOG MODELI KATEDRY:\n${kat.map(linia).join('\n')}\n\nZADANIE SUWERENA:\n${opis.slice(0, 2000)}\n\nSKŁAD (id — kto — co robi):\n${agenci.map((a) => `- ${a.id} — ${a.imie}${a.dziedzina ? ` (${a.dziedzina})` : ''}${a.zadanie ? `: ${String(a.zadanie).split(':')[0]}` : ''}`).join('\n')}`;
    // ⚖️ Najpierw Jev (Suweren 2026-10-08: „zrób Dyrygenta na Jev”) — szybki wybór z pewnością; padnie / bez klucza → model.
    let jevBlad = null;
    if (cfg.jev?.stan?.().maKlucz) {
        try {
            const j = await dobierzJev(cfg.jev, { opis, agenci, kat, linia });
            if (j.przydzial.length) return { ...j, silnik: 'jev', katalog: kat.map((m) => m.nazwa) };
        } catch (e) { jevBlad = String(e.message || e).slice(0, 200); }
    }
    const model = await cfg.model();
    const odp = await cfg.pisz({ system, prompt, model });
    const j = wylowJson(odp);
    if (!j) throw new Error('Dyrygent nie oddał JSON-a z przydziałem — spróbuj ponownie albo daj mu większy model (panel Dyrygenta → „Dyrygent gra na”).');
    return { ...sprawdzPrzydzial(j, { agenci, modele: kat.map((m) => m.nazwa) }), model, silnik: 'model', ...(jevBlad ? { jevBlad } : {}), katalog: kat.map((m) => m.nazwa) };
}

/** Modele, które nie piszą tekstu (embeddingi) — nie są instrumentami dla TeOgochi. */
const NIE_DO_PISANIA = /embed|bge-|minilm|rerank/i;

/**
 * ⚖️ Dobór na Jev: każdy TeOgochi = pytanie `choice` (opcje = modele katalogu z opisem), wszystko w JEDNYM
 * zapytaniu. Wynik = model z największym prawdopodobieństwem, powód = pewność i drugi wybór. Przydział
 * przechodzi przez sprawdzPrzydzial jak odpowiedź modelu (Jev wybiera tylko z podanych opcji, ale ufamy faktom).
 * Zwraca { przydzial, odrzucone, model: 'jev-…' }.
 */
export async function dobierzJev(jev, { opis, agenci, kat, linia }) {
    // Zgniecione kwanty (IQ1/IQ2/Q2…) wypadają — gubią treść plików (Zwiadowca też ich nie proponuje).
    const opcje = kat.filter((m) => !NIE_DO_PISANIA.test(m.nazwa) && !zgniecionyKwant(m.kwantyzacja) && !zgniecionyKwant(String(m.nazwa).split(':').pop())).slice(0, 255);
    if (!opcje.length) throw new Error('W katalogu nie ma modeli do pisania.');
    // Jawna KLASA na początku opisu — zmierzone 2026-10-08: bez niej Jev dał Reżyserowi (scalanie) model 4B
    // z pewnością 0,84; rozmiar ukryty w nawiasie nie przebijał się przez nazwę.
    const klasa = (m) => {
        const b = Number(String(m.parametry ?? '').replace(/[^0-9.]/g, '')) || rozmiarModelu(m.nazwa);
        const chmura = /:cloud$|-cloud$/.test(m.nazwa) ? 'CHMURA OLLAMY (duży, poza kartą) — ' : '';
        if (!b) return `${chmura}ROZMIAR NIEZNANY — `;
        return `${chmura}${b >= 9 ? `DUŻY ${b}B — rozumowanie, scalanie, kod` : b > 4 ? `ŚREDNI ${b}B — zwykłe wkłady` : `MAŁY ${b}B — tylko krótkie, proste wkłady`} — `;
    };
    const criteria = Object.fromEntries(opcje.map((m) => [m.nazwa, `${klasa(m)}${linia(m).replace(/^- /, '')}`.slice(0, 320)]));
    const questions = Object.fromEntries(agenci.map((a, i) => [`a${i}`, {
        type: 'choice',
        instructions: {
            pytanie: 'Który model z katalogu Katedry najlepiej posłuży temu TeOgochi w tym zadaniu? Większy model do rozumowania, scalania i kodu; mniejszy i szybszy do krótkich, prostych wkładów; własny model TeOgochi (wykuty z jego pracy) zwykle jest dla niego; liczą się oceny Sędziego z pracy stada; karta graficzna jest jedna (ok. 6 GB) — nie każdemu największy.',
            teogochi: `${a.id} — ${a.imie}${a.dziedzina ? ` (${a.dziedzina})` : ''}${a.zadanie ? `: ${String(a.zadanie).slice(0, 300)}` : ''}`,
        },
        criteria,
    }]));
    const d = await jev.zapytaj({ state: { zadanie: opis.slice(0, 2000), sklad: agenci.map((a) => `${a.id} — ${a.imie}`).join('; ') }, questions });
    const propozycja = {
        przydzial: agenci.map((a, i) => {
            const o = d.answers?.[`a${i}`];
            const drugi = Object.entries(o?.probabilities ?? {}).sort((x, y) => y[1] - x[1])[1];
            const pewnosc = Number(o?.confidence ?? 0);
            // Niska pewność = Jev waha się między modelami — Suweren widzi, gdzie warto wybrać ręcznie.
            return { agent: a.id, model: o?.choice, powod: `${pewnosc < 0.3 ? '⚠ niepewny — ' : ''}Jev: pewność ${pewnosc.toFixed(2)}${drugi ? `; drugi wybór ${drugi[0]} (${Number(drugi[1]).toFixed(2)})` : ''}` };
        }),
    };
    return { ...sprawdzPrzydzial(propozycja, { agenci, modele: kat.map((m) => m.nazwa) }), model: d.model ?? 'jev' };
}

/** Przydział → stałe silniki agentów (ModeleAgentow). Tylko przy maszynie. */
export async function zastosuj(przydzial = []) {
    const wynik = [];
    for (const { agent, model } of przydzial) wynik.push({ agent, model, ok: await cfg.ustawModel(agent, model).then(() => true, (e) => e.message) });
    return wynik;
}

export default { skonfiguruj, katalog, dobierz, dobierzJev, zastosuj, ustawKarte, statystyki, sprawdzPrzydzial, wylowJson };
