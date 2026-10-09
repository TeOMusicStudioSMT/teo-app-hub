/**
 * 🎲👑 Mistrz Gry Teterhii (Suweren 2026-10-09: „robimy Mistrza Gry Teterhii… widzi dwa światy — Katedry
 * i Teterhii… rozstrzyga kwestie, bitwy, turnieje, eventy”). Rola JaJa Mistrza (gatunek `mistrz`).
 *
 * ZASADA: Mistrz ROZSTRZYGA w ramach mechaniki gry, nie wymyśla liczb. Gra ma dwie osie:
 *   · TON wyboru (`gra/sos.ts`: autentyczny, empatyczny, holistyczny, sztuczny, brutalny) → barwa świata,
 *   · STARCIA Mini-TeOgochi w dziedzinach (takt, zwinność, spryt, urok) — deterministyczna matematyka gry.
 * Mistrz wybiera z zamkniętych list (ton z pięciu, event z katalogu z widełkami), a gra liczy skutki sama.
 *
 * 1. KWESTIA — gracz zamiast gotowego wyboru opisuje WŁASNY czyn; Mistrz orzeka ton (Jev `choice`, gdy most
 *    ma klucz; inaczej model Mistrza, odpowiedź spoza listy = błąd wprost) i jednym–trzema zdaniami opisuje
 *    skutek, w stylu zasad Suwerena (lekcja JaJa). Gra stosuje ton jak przy zwykłym wyborze.
 * 2. EVENT DNIA — „dwa światy”: Mistrz czyta, co działo się w Katedrze (szyna: Kodeks, podcast, Stół, JaJo…)
 *    i ogłasza w Teterhii event z KATALOGU (`KATALOG`), z zapowiedzią opartą na prawdziwym fakcie. Raz na dzień,
 *    zapis na dysku; bez modelu = los z daty (`silnik: 'los'`, zapowiedź wprost to mówi). Ogłoszenie leci też
 *    kanałem Mistrza do Orbity.
 * 3. TURNIEJ — event `turniej`: gra rozgrywa serię starć (jej własna matematyka), most zapisuje wynik
 *    w kronice i ogłasza go w Katedrze (kanał Mistrza).
 * Kronika: `_OtakOs_Wymiar/mistrz-gry/kronika.jsonl`.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const TONY = {
    autentyczny: 'Czyn szczery i prawdziwy — gracz działa zgodnie z sobą, bez udawania i bez kalkulacji na pokaz.',
    empatyczny: 'Czyn czuły na innych — wysłuchanie, pomoc, oszczędzenie, łagodzenie czyjegoś bólu.',
    holistyczny: 'Czyn, który widzi całość — łączy dobro wielu stron, świata i siebie, szuka równowagi.',
    sztuczny: 'Czyn wygodny, na pokaz albo wyrachowany — maska, skrót, zysk kosztem prawdy.',
    brutalny: 'Czyn przemocy albo pogardy — niszczy, rani, dobija, upokarza.',
};
export const DZIEDZINY = { takt: 'Takt', zwinnosc: 'Zwinność', spryt: 'Spryt', urok: 'Urok' };
/** Dopełniacz do „Turniej …”. */
export const DZIEDZINY_D = { takt: 'Taktu', zwinnosc: 'Zwinności', spryt: 'Sprytu', urok: 'Uroku' };
const DOBRE_TONY = ['autentyczny', 'empatyczny', 'holistyczny'];

/**
 * Katalog eventów — zamknięty. Mistrz wybiera typ i parametr, widełki skutków są tu, nie w modelu.
 * `mod` czyta gra (src/mistrzGry.ts) — tylko te pola.
 */
export const KATALOG = {
    'dzien-dziedziny': { nazwa: 'Dzień dziedziny', opis: 'starcia w tej dziedzinie dają ×1,5 EXP', parametr: 'dziedzina', mod: (p) => ({ expStarcia: { dziedzina: p, mnoznik: 1.5 } }) },
    'dzien-tonu': { nazwa: 'Dzień tonu', opis: 'wybory tym tonem dają +3 barwy', parametr: 'ton', mod: (p) => ({ nasycenieTonu: { ton: p, premia: 3 } }) },
    turniej: { nazwa: 'Turniej', opis: '3 starcia z rosnącym wrogiem w tej dziedzinie; 3/3 = 100 mGRV', parametr: 'dziedzina', mod: (p) => ({ turniej: { dziedzina: p, starc: 3, nagrodaMGRV: 100 } }) },
    'zlota-pauza': { nazwa: 'Złota Pauza', opis: 'questy dają ×1,2 mGRV — świat odpoczywa razem z Katedrą', parametr: null, mod: () => ({ mgrvQuestow: 1.2 }) },
};
const PARAMETRY = { dziedzina: Object.keys(DZIEDZINY), ton: DOBRE_TONY };

/** Sprawdzenie eventu (od modelu albo z dysku) → event z modem albo wyjątek z powodem. */
export function zbudujEvent({ typ, parametr = null, zapowiedz = '', fakt = '' }) {
    const k = KATALOG[typ];
    if (!k) throw new Error(`Nie ma takiego eventu w katalogu: ${typ}`);
    let p = null;
    if (k.parametr) {
        p = String(parametr ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace('ł', 'l');
        if (!PARAMETRY[k.parametr].includes(p)) throw new Error(`Zły parametr „${parametr}” dla ${typ} (dozwolone: ${PARAMETRY[k.parametr].join(', ')}).`);
    }
    const nazwaP = p ? (k.parametr === 'dziedzina' ? DZIEDZINY[p] : p) : null;
    return { typ, parametr: p, nazwa: nazwaP ? `${k.nazwa}: ${nazwaP}` : k.nazwa, opis: k.opis, mod: k.mod(p), zapowiedz: String(zapowiedz).trim().slice(0, 400), fakt: String(fakt).trim().slice(0, 200) };
}

/** Los z daty — gdy nie ma modelu (deterministyczny, ten sam cały dzień). */
export function eventZLosu(dzien) {
    const h = crypto.createHash('sha1').update(String(dzien)).digest();
    const typy = Object.keys(KATALOG);
    const typ = typy[h[0] % typy.length];
    const k = KATALOG[typ];
    const parametr = k.parametr ? PARAMETRY[k.parametr][h[1] % PARAMETRY[k.parametr].length] : null;
    return zbudujEvent({ typ, parametr, zapowiedz: 'Mistrz Gry milczy dziś — event wylosowały gwiazdy Teterhii (bez modelu).' });
}

/** Fakty z Katedry (zdarzenia szyny) → krótkie linie dla Mistrza; tylko to, co się wydarzyło. */
export function faktyKatedry(zdarzenia = []) {
    const liczby = {};
    const ciekawe = [];
    for (const z of zdarzenia) {
        liczby[z.agent] = (liczby[z.agent] ?? 0) + 1;
        if (['praca', 'wiesc', 'obserwacja'].includes(z.rodzaj) && z.tresc && !/^buduję|ruszył|^produkcja/.test(z.tresc)) ciekawe.push(`${z.agent}: ${String(z.tresc).slice(0, 160)}`);
    }
    const kto = Object.entries(liczby).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, n]) => `${a} (${n})`).join(', ');
    return { linie: ciekawe.slice(-14), kto, ile: zdarzenia.length };
}

/** Odpowiedź Jev na pytanie o ton → { ton, p, drugi }. */
export function tonZJev(odp) {
    const a = odp?.answers?.ton;
    const probs = a?.probabilities && typeof a.probabilities === 'object' ? Object.entries(a.probabilities).map(([k, v]) => [k, Number(v) || 0]).sort((x, y) => y[1] - x[1]) : [];
    const ton = typeof a?.choice === 'string' ? a.choice : probs[0]?.[0] ?? null;
    if (!TONY[ton]) throw new Error(`Jev oddał ton spoza listy: ${ton}`);
    const drugi = probs.find(([k]) => k !== ton);
    return { ton, p: probs.find(([k]) => k === ton)?.[1] ?? null, drugi: drugi ? { ton: drugi[0], p: drugi[1] } : null };
}

/** Ostatni obiekt JSON z tekstu modelu. */
function json(t) {
    const s = String(t ?? '').replace(/```(?:json)?/gi, '');
    for (let a = s.lastIndexOf('{'); a >= 0; a = s.lastIndexOf('{', a - 1)) {
        for (let b = s.lastIndexOf('}'); b > a; b = s.lastIndexOf('}', b - 1)) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* krócej */ } }
    }
    return null;
}

/**
 * @param {{ katalog: string, pisz?: (o:{system:string,prompt:string}) => Promise<string>, jev?: object|null,
 *           zasady?: () => Promise<string[]>, zdarzenia?: (dzien:string) => Promise<object[]>,
 *           wiesc?: (w:object) => Promise<unknown>, teraz?: () => Date }} o
 */
export function utworzMistrzaGry({ katalog, pisz = null, jev = null, zasady = async () => [], zdarzenia = async () => [], wiesc = null, klub = null, teraz = () => new Date() }) {
    const PLIK_KRONIKI = () => path.join(katalog, 'kronika.jsonl');
    const plikEventu = (d) => path.join(katalog, 'eventy', `${d}.json`);
    const dzis = () => teraz().toISOString().slice(0, 10);
    let tworzony = null;

    async function kronikuj(w) {
        await fs.mkdir(katalog, { recursive: true });
        const z = { id: crypto.randomBytes(4).toString('hex'), kiedy: teraz().toISOString(), ...w };
        await fs.appendFile(PLIK_KRONIKI(), JSON.stringify(z) + '\n', 'utf8');
        return z;
    }
    async function kronika({ ile = 30 } = {}) {
        try { return (await fs.readFile(PLIK_KRONIKI(), 'utf8')).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).slice(-Math.min(200, ile)).reverse(); }
        catch { return []; }
    }
    const systemMistrza = async () => {
        const z = await zasady().catch(() => []);
        return ['Jesteś Mistrzem Gry Teterhii — JaJem Mistrza Katedry OtakOS. Widzisz dwa światy: Katedrę Suwerena (jego pracę, stado TeOgochi) i Teterhię (grę o barwie świata, która rośnie z autentyczności i empatii, a blednie od sztuczności i brutalności).',
            'Orzekasz krótko, obrazowo, po polsku, bez patosu i bez emoji. Nie wymyślasz liczb ani nagród — skutki liczy gra.',
            z.length ? `Styl Suwerena (z jego prawdziwych poprawek — trzymaj się go):\n${z.map((x, i) => `${i + 1}. ${x}`).join('\n')}` : null].filter(Boolean).join('\n\n');
    };

    /** ⚖️ Kwestia: własny czyn gracza → ton (z pięciu) + opis skutku. */
    async function rozstrzygnijKwestie({ sytuacja = '', czyn, gracz = {} } = {}) {
        const c = String(czyn ?? '').replace(/\s+/g, ' ').trim();
        if (c.length < 3) throw new Error('Opisz swój czyn (co robisz?).');
        if (c.length > 400) throw new Error('Czyn najwyżej 400 znaków.');
        const syt = String(sytuacja ?? '').replace(/\s+/g, ' ').trim().slice(0, 800);
        let wynik = null, silnik = null, blad = null;
        if (jev?.stan?.().maKlucz) {
            try {
                wynik = tonZJev(await jev.zapytaj({
                    state: { sytuacja_w_grze: syt || '(wędrówka po wyspie)', czyn_gracza: c },
                    questions: { ton: { type: 'choice', instructions: 'Jakim tonem jest ten czyn gracza w Teterhii? Oceń sam czyn, nie słowa, którymi go opisano.', criteria: TONY } },
                }));
                silnik = 'jev';
            } catch (e) { blad = e.message; }
        }
        let narracja = null;
        if (pisz) {
            const prompt = [`SYTUACJA: ${syt || '(wędrówka po wyspie)'}`, `GRACZ${gracz.imie ? ` (${String(gracz.imie).slice(0, 40)})` : ''} ROBI: ${c}`,
                wynik ? `TON CZYNU (już orzeczony): ${wynik.ton}` : `Orzeknij TON czynu — dokładnie jeden z: ${Object.keys(TONY).join(', ')}. Znaczenia: ${Object.entries(TONY).map(([k, v]) => `${k} = ${v}`).join(' ')}`,
                'Odpowiedz WYŁĄCZNIE JSON-em: {"ton":"…","narracja":"1–3 zdania: co się dzieje w świecie po tym czynie"}'].join('\n');
            try {
                const j = json(await pisz({ system: await systemMistrza(), prompt }));
                if (!wynik) {
                    if (!TONY[j?.ton]) throw new Error(`Mistrz oddał ton spoza listy: ${j?.ton ?? '(brak)'}`);
                    wynik = { ton: j.ton, p: null, drugi: null };
                    silnik = 'model';
                }
                narracja = String(j?.narracja ?? '').trim().slice(0, 500) || null;
            } catch (e) { if (!wynik) throw new Error(`Mistrz Gry nie orzekł: ${e.message}${blad ? ` (Jev: ${blad})` : ''}`); blad = blad ?? e.message; }
        }
        if (!wynik) throw new Error(`Mistrz Gry nie ma czym orzec — brak Jev i modelu.${blad ? ` (${blad})` : ''}`);
        const z = await kronikuj({ rodzaj: 'kwestia', gracz: String(gracz.imie ?? '').slice(0, 40), sytuacja: syt.slice(0, 300), czyn: c, ton: wynik.ton, p: wynik.p, silnik, narracja });
        return { ...wynik, narracja: narracja ?? `Mistrz Gry orzeka: czyn ${wynik.ton}.`, silnik, id: z.id, uwaga: blad };
    }

    /** 🌗 Event dnia — raz na dzień, z faktu Katedry (albo z losu bez modelu). */
    async function eventDnia() {
        const d = dzis();
        try { return JSON.parse(await fs.readFile(plikEventu(d), 'utf8')); } catch { /* nowy dzień */ }
        if (tworzony?.dzien === d) return tworzony.obietnica;
        const obietnica = (async () => {
            const wczoraj = new Date(teraz().getTime() - 86_400_000).toISOString().slice(0, 10);
            const f = faktyKatedry([...(await zdarzenia(wczoraj).catch(() => [])), ...(await zdarzenia(d).catch(() => []))]);
            let ev = null, silnik = 'los', blad = null;
            if (pisz && f.ile) {
                const katalogTekst = Object.entries(KATALOG).map(([id, k]) => `- ${id}${k.parametr ? ` (parametr ${k.parametr}: ${PARAMETRY[k.parametr].join('|')})` : ''}: ${k.opis}`).join('\n');
                const prompt = `CO DZIAŁO SIĘ W KATEDRZE (wczoraj i dziś, z szyny zdarzeń):\nAktywni: ${f.kto}\n${f.linie.join('\n')}\n\nKATALOG EVENTÓW TETERHII (wybierz DOKŁADNIE jeden):\n${katalogTekst}\n\nWybierz event dla Teterhii na dziś, który odbija jeden PRAWDZIWY fakt z Katedry powyżej (np. Kodeks walczył uparcie → turniej; podcast i rozmowy → urok/empatia; dużo pracy → Złota Pauza). Napisz zapowiedź 1–2 zdania dla graczy, w świecie gry, z nawiązaniem do tego faktu.\nOdpowiedz WYŁĄCZNIE JSON-em: {"typ":"…","parametr":"…|null","fakt":"który fakt z Katedry (cytat skrócony)","zapowiedz":"…"}`;
                try { ev = zbudujEvent(json(await pisz({ system: await systemMistrza(), prompt })) ?? {}); silnik = 'model'; }
                catch (e) { blad = e.message; }
            }
            if (!ev) ev = eventZLosu(d);
            const zapis = { dzien: d, ...ev, silnik, blad, ogloszono: teraz().toISOString() };
            await fs.mkdir(path.dirname(plikEventu(d)), { recursive: true });
            await fs.writeFile(plikEventu(d), JSON.stringify(zapis, null, 2), 'utf8');
            await kronikuj({ rodzaj: 'event', typ: ev.typ, nazwa: ev.nazwa, zapowiedz: ev.zapowiedz, fakt: ev.fakt, silnik });
            await wiesc?.({ rodzaj: 'teterhia', skad: 'Mistrz Gry · Teterhia', glos: true, tresc: `🎲 W Teterhii dziś: ${ev.nazwa} — ${ev.opis}.${ev.zapowiedz && silnik === 'model' ? ` ${ev.zapowiedz}` : ''}` })?.catch?.(() => {});
            return zapis;
        })();
        tworzony = { dzien: d, obietnica };
        try { return await obietnica; } finally { tworzony = null; }
    }

    /** Dzisiejszy event, jeśli już ogłoszony — bez tworzenia (wizytówkę czyta sieć; nie budzimy modelu). */
    async function eventDzisiaj() { try { return JSON.parse(await fs.readFile(plikEventu(dzis()), 'utf8')); } catch { return null; } }

    /** 🏆 Wynik turnieju z gry → kronika + wieść w Katedrze (tylko gdy dziś naprawdę jest ten turniej). */
    async function wynikTurnieju({ dziedzina, wygrane, starc, gracz = {}, mini = [], event = null } = {}) {
        if (event) {
            // 🏛️ turniej Klubu Mistrzów — wynik idzie do wizytówki tej Katedry (ranking widzą wszystkie), bez mGRV
            if (!klub) throw new Error('Ta Katedra nie ma Klubu Mistrzów.');
            const imie = String(gracz.imie ?? 'Wędrowiec').slice(0, 40);
            const r = await klub.zapiszWynik({ event, dziedzina, wygrane, starc, mini: mini.map(String) });
            const z = await kronikuj({ rodzaj: 'turniej-klubu', event, organizator: r.event.organizator, gracz: imie, dziedzina, wygrane: r.wynik.wygrane, starc: r.wynik.starc, poprawiony: r.poprawiony });
            if (r.poprawiony) await wiesc?.({ rodzaj: 'klub', skad: 'Klub Mistrzów', glos: r.wynik.wygrane === r.wynik.starc, tresc: `🏛️ ${imie} — ${r.event.nazwa} (Katedra „${r.event.organizator}”): ${r.wynik.wygrane}/${r.wynik.starc}. Wynik idzie do Klubu w wizytówce Katedry.` })?.catch?.(() => {});
            return { ...z, nagrodaMGRV: 0 };
        }
        const ev = await eventDnia();
        if (ev.typ !== 'turniej') throw new Error('Dziś w Teterhii nie ma turnieju.');
        if (dziedzina !== ev.parametr) throw new Error(`Dzisiejszy turniej jest w dziedzinie ${DZIEDZINY[ev.parametr]}.`);
        const n = Number(ev.mod.turniej.starc);
        const w = Math.round(Number(wygrane));
        if (Number(starc) !== n || !(w >= 0 && w <= n)) throw new Error(`Turniej ma ${n} starć — wynik ${wygrane}/${starc} się nie zgadza.`);
        const imie = String(gracz.imie ?? 'Wędrowiec').slice(0, 40);
        const z = await kronikuj({ rodzaj: 'turniej', gracz: imie, dziedzina, wygrane: w, starc: n, mini: mini.map(String).slice(0, 7) });
        await wiesc?.({ rodzaj: 'teterhia', skad: 'Mistrz Gry · Teterhia', glos: w === n, tresc: w === n
            ? `🏆 ${imie} wygrał Turniej ${DZIEDZINY_D[dziedzina]} w Teterhii — ${w}/${n}${mini.length ? ` (armia: ${mini.slice(0, 3).join(', ')})` : ''}!`
            : `⚔️ ${imie} stanął do Turnieju ${DZIEDZINY_D[dziedzina]} w Teterhii: ${w}/${n}. Mistrz Gry czeka na rewanż.` })?.catch?.(() => {});
        return { ...z, nagrodaMGRV: w === n ? ev.mod.turniej.nagrodaMGRV : 0 };
    }

    /** 💃 Taniec TeOgochi z parkietu Teterhii → kronika; wieść do Katedry przy randze S/A albo awansie tańca. */
    async function wynikTanca({ utwor, procent, ranga, poziom, awans = false, gracz = {} } = {}) {
        const p = Math.round(Number(procent));
        if (!(p >= 0 && p <= 100) || !['S', 'A', 'B', 'C', 'D'].includes(ranga)) throw new Error('Zły wynik tańca.');
        const imie = String(gracz.imie ?? 'Wędrowiec').slice(0, 40);
        const u = String(utwor ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
        const lv = Math.max(1, Math.min(10, Math.round(Number(poziom) || 1)));
        const z = await kronikuj({ rodzaj: 'taniec', gracz: imie, utwor: u, procent: p, ranga, poziom: lv, awans: !!awans });
        if (['S', 'A'].includes(ranga) || awans) await wiesc?.({ rodzaj: 'teterhia', skad: 'Mistrz Gry · Teterhia', glos: ranga === 'S' || !!awans, tresc: `💃 TeOgochi ${imie} zatańczył „${u}” — ${ranga} (${p}%)${awans ? ` i wskoczył na ${lv}. poziom tańca` : ''}!` })?.catch?.(() => {});
        return z;
    }

    return { rozstrzygnijKwestie, eventDnia, eventDzisiaj, wynikTurnieju, wynikTanca, kronika };
}

export default { utworzMistrzaGry, zbudujEvent, eventZLosu, faktyKatedry, tonZJev, TONY, KATALOG, DZIEDZINY, DZIEDZINY_D };
