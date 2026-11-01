/**
 * 🛠️ Warsztat Stada — TeOsimowie ulepszają wygląd Teterhii PRZEPISEM, nie kodem (Suweren 2026-11-01: „czy mogłyby ulepszać
 * modele w grze: drzew, skał, wody, statków, chmury, oświetlenie…”). Projekt: docs/designs/warsztat-stada.md (v2 po
 * przeglądzie złotych rybek). ETAP 1: jedna dziedzina — WODA (TeOsim Paleta).
 *
 * Przepis = liczby w zakresach z `zakresyStylu.json` GRY (jedna tabela; most czyta ją w czasie działania). Gra składa obraz
 * (src/gra/stylSwiata.ts — BLIŹNIAK `oczyscPrzepis`, test mostu porównuje oba). Przepis to BAZA — blednięcie świata dalej
 * mnoży nasycenie w grze.
 *
 * Droga: nocny przebieg (raz na noc, najwyżej 1 propozycja) albo `POST /zaproponuj` → model przydziału Palety (JSON,
 * jedna poprawka z błędem, potem błąd wprost) → `oczyscPrzepis` → zrzuty „teraz / po” (puppeteer, przepis w adresie —
 * gra pod puppeteerem nie widzi /api) → źródło Izby zgód (`do_zgody`) → ✓ Suwerena: warstwa do przepisu (bazaWersji
 * zgodna, zapis atomowy po kolei, poprzednia do `przepis.poprzedni.json`), XP raz, decyzja do JaJa, wieść. ✕: powód
 * w propozycji (przyszła pamięć gustu). Bez decyzji 7 dni = `wygasla`. Duch po restarcie = błąd z powodem.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

export const DZIEDZINY = {
    woda: { autor: 'paleta', nazwa: 'Woda Teterhii', opis: 'wygląd wody w grze: barwa (odcień, nasycenie, jasność w HSL), przezroczystość i połysk powierzchni' },
};
export const WAZNOSC_DNI = 7;
export const XP_ZA_PRZYJECIE = 20;
const GODZINA_NOCY = 3;

// ── BLIŹNIAK src/gra/stylSwiata.ts (gra) — ta sama reguła na tym samym zakresyStylu.json ─────────────
const zaokr = (x) => Math.round(x * 1000) / 1000;
function przytnij(x, [od, doo], nazwa, przyciete) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return null;
    if (x < od || x > doo) przyciete.push(nazwa);
    return zaokr(Math.min(doo, Math.max(od, x)));
}
/** Przepis z dowolnego wejścia → tylko znane warstwy i pola, liczby w zakresach (przycięte pola wymienione). */
export function oczyscPrzepis(wej, zakresy) {
    const przyciete = [], odrzucone = [];
    const POLA_WODY = zakresy.warstwy.woda.pola;
    const w = wej?.warstwy?.woda;
    const woda = {};
    if (w && typeof w === 'object') {
        for (const [k, v] of Object.entries(w)) {
            if (k === 'autor' && typeof v === 'string' && /^[a-z0-9-]{1,30}$/.test(v)) { woda.autor = v; continue; }
            if (k === 'wersja' && typeof v === 'number' && Number.isInteger(v) && v >= 0) { woda.wersja = v; continue; }
            const pole = POLA_WODY[k];
            if (!pole) { odrzucone.push(`woda.${k}`); continue; }
            if (pole.rodzaj === 'hsl') {
                if (!Array.isArray(v) || v.length !== 3) { odrzucone.push(`woda.${k}`); continue; }
                const h = przytnij(v[0], pole.odcien, `woda.${k}.odcien`, przyciete), s = przytnij(v[1], pole.nasycenie, `woda.${k}.nasycenie`, przyciete), l = przytnij(v[2], pole.jasnosc, `woda.${k}.jasnosc`, przyciete);
                if (h === null || s === null || l === null) { odrzucone.push(`woda.${k}`); continue; }
                woda[k] = [h, s, l];
            } else {
                const x = przytnij(v, pole.zakres, `woda.${k}`, przyciete);
                if (x === null) { odrzucone.push(`woda.${k}`); continue; }
                woda[k] = x;
            }
        }
    }
    return { przepis: { wersja_schematu: zakresy.wersja_schematu, warstwy: Object.keys(woda).some((k) => k !== 'autor' && k !== 'wersja') ? { woda } : {} }, przyciete, odrzucone };
}
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Opis pól dla modelu — z tej samej tabeli, którą sprawdza gra. */
export function opisPol(zakresy, dziedzina) {
    return Object.entries(zakresy.warstwy[dziedzina].pola).map(([k, p]) => p.rodzaj === 'hsl'
        ? `- "${k}": [odcień ${p.odcien[0]}–${p.odcien[1]}, nasycenie ${p.nasycenie[0]}–${p.nasycenie[1]}, jasność ${p.jasnosc[0]}–${p.jasnosc[1]}] (dziś domyślnie ${JSON.stringify(p.domyslnie)})`
        : `- "${k}": liczba ${p.zakres[0]}–${p.zakres[1]} (dziś domyślnie ${p.domyslnie})`).join('\n');
}

export function promptPropozycji({ dziedzina, zakresy, obecna }) {
    const d = DZIEDZINY[dziedzina];
    return `ZADANIE W WARSZTACIE STADA — ${d.nazwa}.
Mieszkasz na wyspach Teterhii. Zaproponuj, jak ma wyglądać ${d.opis}. Nie piszesz kodu — tylko liczby przepisu.
POLA I ZAKRESY (wartości spoza zakresu zostaną przycięte):
${opisPol(zakresy, dziedzina)}
OBECNIE W GRZE: ${obecna ? JSON.stringify(obecna) : 'wartości domyślne z kodu'}
Zasady: zmiana ma być widoczna, ale gracz musi dalej odróżnić wodę od lądu (nie za ciemna, nie przezroczysta jak powietrze). Uwaga: świat blednie, gdy gracz traci barwę — Twoja barwa to baza przy pełnej barwie.
Odpowiedz WYŁĄCZNIE JSON-em: {"zmiany":{…tylko pola z listy…},"uzasadnienie":"1–2 zdania po polsku, dlaczego tak"}`;
}

const wylowJson = (t) => { const s = String(t ?? '').replace(/<think>[\s\S]*?<\/think>/g, ''); const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; } };

/**
 * @param {{ katalog: string, plikZakresow: string, gra: string, pisz: (o:{system:string,prompt:string,model?:string}) => Promise<string>,
 *   model: (agent:string) => string|null, karta: (agent:string) => Promise<string|null>, czyWyklute: (agent:string) => Promise<boolean>,
 *   zrzut?: (o:{zapytanie:string, plik:string}) => Promise<string>, nagroda?: Function, jajo?: { decyzja?: Function, wiesc?: Function },
 *   teraz?: () => number }} cfg
 */
export function utworzWarsztat(cfg) {
    const teraz = cfg.teraz ?? Date.now;
    const KAT = cfg.katalog, PRZEPIS = path.join(KAT, 'przepis.json'), POPRZEDNI = path.join(KAT, 'przepis.poprzedni.json');
    const PROP = path.join(KAT, 'propozycje'), ZRZUTY = path.join(KAT, 'zrzuty'), USTAW = path.join(KAT, 'ustawienia.json');
    const pracuje = new Set();
    let kolejka = Promise.resolve();
    const poKolei = (fn) => { const p = kolejka.then(fn, fn); kolejka = p.catch(() => {}); return p; };
    const czas = () => new Date(teraz()).toISOString();

    const zakresy = () => JSON.parse(fsSync.readFileSync(cfg.plikZakresow, 'utf8'));
    async function czytajJson(p, zap) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return zap; } }
    async function zapiszAtomowo(p, obj) { await fs.mkdir(path.dirname(p), { recursive: true }); const tmp = `${p}.${process.pid}.tmp`; await fs.writeFile(tmp, JSON.stringify(obj, null, 2)); await fs.rename(tmp, p); }
    const idOk = (id) => /^w-[0-9a-f]{8}$/.test(String(id));
    const plikProp = (id) => path.join(PROP, `${id}.json`);

    async function przepis() { return oczyscPrzepis(await czytajJson(PRZEPIS, {}), zakresy()).przepis; }
    async function ustawienia() { return { wlaczony: true, ostatniaNoc: null, ...(await czytajJson(USTAW, {})) }; }

    async function propozycje() {
        const pliki = await fs.readdir(PROP).catch(() => []);
        const lista = [];
        for (const f of pliki.filter((x) => /^w-[0-9a-f]{8}\.json$/.test(x))) {
            const p = await czytajJson(path.join(PROP, f), null);
            if (!p) continue;
            if (p.stan === 'robi' && !pracuje.has(p.id)) Object.assign(p, { stan: 'blad', powod: 'przerwane — most wystartował od nowa w trakcie' });
            if (p.stan === 'do_zgody' && Date.parse(p.utworzono) + WAZNOSC_DNI * 864e5 < teraz()) Object.assign(p, { stan: 'wygasla' });
            lista.push(p);
        }
        return lista.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    async function zaproponuj({ dziedzina = 'woda', model: wymuszony = null } = {}) {
        const d = DZIEDZINY[dziedzina];
        if (!d) throw new Error(`Nieznana dziedzina „${dziedzina}” (etap 1: ${Object.keys(DZIEDZINY).join(', ')}).`);
        if (!(await cfg.czyWyklute(d.autor))) throw new Error(`TeOsim „${d.autor}” nie jest jeszcze wykluty — nie ma kto zaproponować.`);
        if ((await propozycje()).some((p) => p.dziedzina === dziedzina && ['robi', 'do_zgody'].includes(p.stan))) throw new Error('Ta dziedzina ma już propozycję czekającą na decyzję.');
        const id = `w-${crypto.randomBytes(4).toString('hex')}`;
        const zak = zakresy();
        const obecny = await przepis();
        const obecna = obecny.warstwy[dziedzina] ?? null;
        const model = wymuszony || cfg.model(d.autor);
        const prop = { id, dziedzina, autor: d.autor, stan: 'robi', utworzono: czas(), model, bazaWersji: obecna?.wersja ?? 0, zmiany: null, uzasadnienie: null, przyciete: [], odrzucone: [], zrzuty: [], powod: null };
        pracuje.add(id);
        await zapiszAtomowo(plikProp(id), prop);
        try {
            const system = `${(await cfg.karta(d.autor)) ?? `Jesteś ${d.autor} — TeOgochi Katedry OtakOS.`}\n\nTERAZ PRACUJESZ W WARSZTACIE STADA: proponujesz wygląd świata gry liczbami przepisu, nie kodem.`;
            let prompt = promptPropozycji({ dziedzina, zakresy: zak, obecna });
            let wynik = null;
            for (let proba = 0; proba < 2 && !wynik; proba++) {
                const j = wylowJson(await cfg.pisz({ system, prompt, model }));
                const ocz = j?.zmiany ? oczyscPrzepis({ warstwy: { [dziedzina]: j.zmiany } }, zak) : null;
                if (ocz?.przepis.warstwy[dziedzina]) wynik = { j, ocz };
                else prompt = `${promptPropozycji({ dziedzina, zakresy: zak, obecna })}\n\nPOPRZEDNIA ODPOWIEDŹ BYŁA ZŁA: ${!j ? 'to nie był JSON' : !j.zmiany ? 'brak pola "zmiany"' : `żadne pole nie przeszło (odrzucone: ${ocz?.odrzucone.join(', ') || 'wszystkie'})`}. Oddaj sam JSON z polami z listy.`;
            }
            if (!wynik) throw new Error('model dwa razy nie oddał poprawnego przepisu');
            const zmiany = wynik.ocz.przepis.warstwy[dziedzina];
            Object.assign(prop, { zmiany, uzasadnienie: String(wynik.j.uzasadnienie ?? '').slice(0, 400), przyciete: wynik.ocz.przyciete, odrzucone: wynik.ocz.odrzucone });
            // 📸 „teraz / po” — przepis w adresie (gra pod puppeteerem nie dostaje /api); brak zrzutów = karta bez obrazów, z powodem
            if (cfg.zrzut) {
                const po = { wersja_schematu: zak.wersja_schematu, warstwy: { ...obecny.warstwy, [dziedzina]: { ...(obecna ?? {}), ...zmiany } } };
                try {
                    const teraz_ = await cfg.zrzut({ zapytanie: `pora=dzien&kadr=${dziedzina}&przepisJson=${encodeURIComponent(JSON.stringify(obecny))}`, plik: path.join(ZRZUTY, `${id}-teraz.png`) });
                    const po_ = await cfg.zrzut({ zapytanie: `pora=dzien&kadr=${dziedzina}&przepisJson=${encodeURIComponent(JSON.stringify(po))}`, plik: path.join(ZRZUTY, `${id}-po.png`) });
                    prop.zrzuty = [teraz_, po_];
                } catch (e) { prop.uwagaZrzutu = `bez podglądu: ${e.message}`; }
            }
            prop.stan = 'do_zgody';
        } catch (e) { Object.assign(prop, { stan: 'blad', powod: e.message }); }
        finally { pracuje.delete(id); }
        await zapiszAtomowo(plikProp(id), prop);
        return prop;
    }

    async function decyduj(id, akcja, { powod = null } = {}) {
        if (!idOk(id)) throw new Error('Złe id propozycji.');
        return poKolei(async () => {
            const prop = await czytajJson(plikProp(id), null);
            if (!prop) throw new Error('Nie ma takiej propozycji.');
            if (prop.stan !== 'do_zgody') return { stan: prop.stan, juz: true };
            if (akcja === 'odrzuc') {
                Object.assign(prop, { stan: 'odrzucona', decyzja: { kiedy: czas(), powod: powod ? String(powod).slice(0, 500) : null } });
                await zapiszAtomowo(plikProp(id), prop);
                try { await cfg.jajo?.decyzja?.({ zrodlo: 'warsztat', obiekt: id, tytul: `${DZIEDZINY[prop.dziedzina]?.nazwa} od ${prop.autor}`, werdykt: 'odrzuc', opis: JSON.stringify(prop.zmiany), ...(powod ? { uwagi: powod } : {}) }); } catch { /* JaJo opcjonalne */ }
                return { stan: prop.stan };
            }
            if (akcja !== 'przyjmij') throw new Error(`Nieznana akcja „${akcja}”.`);
            const obecny = await przepis();
            const wersjaTeraz = obecny.warstwy[prop.dziedzina]?.wersja ?? 0;
            if (wersjaTeraz !== prop.bazaWersji) {
                Object.assign(prop, { stan: 'wygasla', powod: `nieaktualna — warstwa zmieniła się od propozycji (wersja ${prop.bazaWersji} → ${wersjaTeraz}); poproś o nową` });
                await zapiszAtomowo(plikProp(id), prop);
                throw new Error(prop.powod);
            }
            const nowa = { ...(obecny.warstwy[prop.dziedzina] ?? {}), ...prop.zmiany, autor: prop.autor, wersja: wersjaTeraz + 1 };
            await zapiszAtomowo(POPRZEDNI, obecny);
            await zapiszAtomowo(PRZEPIS, { ...obecny, warstwy: { ...obecny.warstwy, [prop.dziedzina]: nowa }, zmieniono: czas() });
            Object.assign(prop, { stan: 'przyjeta', decyzja: { kiedy: czas(), powod: powod ? String(powod).slice(0, 500) : null }, wersja: nowa.wersja });
            await zapiszAtomowo(plikProp(id), prop);
            try { await cfg.nagroda?.({ id: prop.autor, xp: XP_ZA_PRZYJECIE, klucz: `warsztat:${id}`, powod: `Warsztat Stada: ${DZIEDZINY[prop.dziedzina]?.nazwa}` }); } catch { /* XP opcjonalne */ }
            try { await cfg.jajo?.decyzja?.({ zrodlo: 'warsztat', obiekt: id, tytul: `${DZIEDZINY[prop.dziedzina]?.nazwa} od ${prop.autor}`, werdykt: 'zatwierdz', opis: JSON.stringify(prop.zmiany) }); } catch { /* — */ }
            try { await cfg.jajo?.wiesc?.({ tresc: `🛠️ ${DZIEDZINY[prop.dziedzina]?.nazwa} — nowy wygląd od ${prop.autor} przyjęty. Widać po wejściu do gry.`, rodzaj: 'warsztat', skad: 'Warsztat Stada' }); } catch { /* — */ }
            return { stan: prop.stan, wersja: nowa.wersja };
        });
    }

    /** ↩ cofnij: przepis wraca do stanu sprzed ostatniego przyjęcia. */
    async function cofnij() {
        return poKolei(async () => {
            const poprzedni = await czytajJson(POPRZEDNI, null);
            if (!poprzedni) throw new Error('Nie ma czego cofnąć.');
            await zapiszAtomowo(PRZEPIS, { ...poprzedni, zmieniono: czas(), cofnieto: true });
            await fs.rm(POPRZEDNI, { force: true });
            return przepis();
        });
    }

    /** Źródło Izby zgód — ODCZYT bez skutków ubocznych (bez wygaszania na dysku). */
    const zrodloIzby = {
        id: 'warsztat', emoji: '🛠️', nazwa: 'Warsztat Stada',
        czekajace: async () => (await propozycje()).filter((p) => p.stan === 'do_zgody').map((p) => ({
            id: p.id, kiedy: p.utworzono, tytul: `${DZIEDZINY[p.dziedzina]?.nazwa ?? p.dziedzina} — propozycja od ${p.autor}`,
            opis: [p.uzasadnienie, `zmiany: ${JSON.stringify(p.zmiany)}`, p.przyciete?.length ? `przycięte do zakresu: ${p.przyciete.join(', ')}` : null, p.uwagaZrzutu ?? (p.zrzuty?.length ? 'podgląd: teraz → po' : null)].filter(Boolean).join(' · '),
            obrazy: (p.zrzuty ?? []).filter((z) => fsSync.existsSync(z)),
            akcje: [{ id: 'przyjmij', etykieta: '✓ do gry', zdalnie: true }, { id: 'odrzuc', etykieta: '✕ odrzuć', zdalnie: true }],
        })),
        decyduj: (id, akcja, o) => decyduj(id, akcja, o),
    };

    /** 🌙 Raz na noc (od GODZINA_NOCY): najwyżej jedna propozycja, dziedziny po kolei. */
    async function nocnyPrzebieg() {
        const u = await ustawienia();
        const dzis = new Date(teraz()).toISOString().slice(0, 10);
        if (!u.wlaczony || u.ostatniaNoc === dzis || new Date(teraz()).getHours() < GODZINA_NOCY || new Date(teraz()).getHours() >= 7) return null;
        await zapiszAtomowo(USTAW, { ...u, ostatniaNoc: dzis });
        const dziedzina = Object.keys(DZIEDZINY)[0];
        try { return await zaproponuj({ dziedzina }); } catch (e) { return { blad: e.message }; }
    }
    function startPetli() {
        if (process.env.OTAKOS_WARSZTAT_STADA === '0') return null;
        return setInterval(() => { nocnyPrzebieg().catch(() => {}); }, 10 * 60_000);
    }
    async function ustawWlaczony(tak) { const u = await ustawienia(); await zapiszAtomowo(USTAW, { ...u, wlaczony: !!tak }); return ustawienia(); }

    return { przepis, propozycje, zaproponuj, decyduj, cofnij, zrodloIzby, nocnyPrzebieg, startPetli, ustawienia, ustawWlaczony };
}

/** Trasy (Straż: `/api/warsztat-stada` — maszyna; z telefonu decyzje idą przez Izbę zgód). GET /przepis czyta gra. */
export function zamontujTrasyWarsztatu(app, W) {
    const odp = (res, pr, kod = 400) => pr.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    app.get('/api/warsztat-stada/przepis', (_req, res) => odp(res, W.przepis().then((przepis) => ({ przepis })), 500));
    app.get('/api/warsztat-stada/propozycje', (_req, res) => odp(res, Promise.all([W.propozycje(), W.ustawienia()]).then(([propozycje, ustawienia]) => ({ propozycje, ustawienia })), 500));
    app.post('/api/warsztat-stada/zaproponuj', (req, res) => odp(res, W.zaproponuj({ dziedzina: req.body?.dziedzina || 'woda', model: req.body?.model || null }).then((propozycja) => ({ propozycja }))));
    app.post('/api/warsztat-stada/cofnij', (_req, res) => odp(res, W.cofnij().then((przepis) => ({ przepis }))));
    app.put('/api/warsztat-stada/wlaczony', (req, res) => odp(res, W.ustawWlaczony(req.body?.tak !== false).then((ustawienia) => ({ ustawienia }))));
}
