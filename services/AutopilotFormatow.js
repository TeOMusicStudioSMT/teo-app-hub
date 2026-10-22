/**
 * 🤖 Autopilot formatów (Suweren 2026-10-16: „niech produkuje też automatycznie z wcześniejszych wysłanych filmów i wysyła
 * automatycznie… niech przerobią też wszystkie do odpowiedniego formatu i tam wyślą”). Konta Suwerena: TikTok @teo_otakos,
 * Instagram @teo_music_studio_s.m.t, YouTube — kanał projektu (np. @ZebrraFootball dla Gola Dnia).
 *
 * Przełącznik OSOBNO dla każdego celu (`shorts`, `reels`, `tiktok`), domyślnie WYŁĄCZONY. Gdy włączony:
 *   filmy = publikacje YouTube już wysłane (etap `opublikowana` / `prywatna`, bez Shortów i kopii na inne kanały), z pliku
 *   w katalogu montaży projektu (Game Show, Gol Dnia, wywiady, podcasty, sceny) — stare i każde nowe, gdy tylko wyjdzie;
 *   każdy film RAZ na cel (rejestr `plik|cel` na dysku — restart nie robi dubli) → pion (services/Formaty.js):
 *   propozycja z odcinka (Gol Dnia: cały skrót, gdy się mieści, inaczej pierwszy gol), inaczej cały film ≤ limit sieci,
 *   inaczej pierwsze N s; pion Shortu (≤ 3 min) służy też Reels i TikTokowi (cele po kolei od najkrótszego limitu) →
 *   Kronikarz pisze opis → wysyłka BEZ ręcznego ✓ (wprost życzenie Suwerena dla włączonych sieci):
 *     shorts → PublikacjeYouTube (zatwierdzenie od razu, kanał projektu; YouTube bez audytu i tak trzyma prywatnie — jak zawsze),
 *     tiktok → SZKIC do skrzynki aplikacji TikTok (opis Suweren wkleja tam — API szkicu opisu nie bierze),
 *     reels  → Instagram PUBLICZNIE od razu (API nie ma szkiców).
 *   Bez opisu Kronikarza nic nie wychodzi samo (publikacja czeka na ręczne ✓). Konto niepodłączone = cel czeka z powodem,
 *   nic nie zużywa. Błąd = do 3 prób w kolejnych przebiegach, potem „porzucony” z powodem (↻ w panelu).
 * Limity: dzienny limit autopilota na cel (domyślnie 5; TikTok najwyżej 5 — tyle szkiców TikTok trzyma na dobę),
 * jedna kolejka, odstęp 15 s między wysyłkami do TikToka (6 zapytań/min na token). Przebieg co 10 min (pierwszy po 2 min),
 * `OTAKOS_AUTOPILOT_FORMATOW=0` wyłącza pętlę; „▶ przerób zaległe teraz” = przebieg od razu.
 * Plik `_OtakOs_Wymiar/formaty/autopilot.json`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CELE } from './Formaty.js';

/** Kolejność celów: najkrótszy limit pierwszy — jego klip mieści się też w dłuższych. */
export const CELE_AUTO = ['shorts', 'reels', 'tiktok'];
export const SIEC_CELU = { shorts: 'youtube', reels: 'instagram', tiktok: 'tiktok' };
export const MAX_LIMITU = { shorts: 20, reels: 25, tiktok: 5 };
export const DOMYSLNY_LIMIT = 5;
export const MAX_PROB = 3;
const ETAPY_WYSLANE = ['opublikowana', 'prywatna'];
export const UWAGI = {
    shorts: 'Short idzie na kanał projektu (jak odcinek). YouTube bez audytu API trzyma go jako prywatny — widoczność zmieniasz w YouTube Studio.',
    tiktok: 'TikTok dostaje SZKIC do skrzynki aplikacji, cały film do 10 min — otwórz powiadomienie, wklej opis (📱 QR przy klipie), ustaw prywatność i opublikuj.',
    reels: 'Instagram publikuje Reel PUBLICZNIE od razu — API nie ma szkiców.',
};

/**
 * Wycinek dla celu: propozycja z odcinka (skrót → pierwszy pasujący) → cały film ≤ limit → pierwsze `limit` s.
 * `caly` (TikTok, do 10 min): cały film, gdy się mieści — taniec nie jest ucięty do skrótu.
 */
export function wycinekDla(propozycje, sekundy, limit, { caly = false } = {}) {
    if (caly && Number(sekundy) > 0 && Number(sekundy) <= limit + 0.05) return { propozycja: null, od: 0, do: Math.round(Number(sekundy) * 100) / 100, tytul: '' };
    const pasuje = (p) => p.do - p.od <= limit + 0.05;
    const p = (propozycje ?? []).find((x) => x.id === 'skrot' && pasuje(x)) ?? (propozycje ?? []).find((x) => x.id !== 'skrot' && pasuje(x));
    if (p) return { propozycja: p.id, od: p.od, do: p.do, tytul: p.tytul ?? '' };
    const dl = Number(sekundy) > 0 ? Math.min(Number(sekundy), limit) : limit;
    return { propozycja: null, od: 0, do: Math.round(dl * 100) / 100, tytul: '' };
}

/**
 * @param {{ katalog:string, formaty:object, publikacje:()=>Promise<any[]>, stanSieci:(siec:string)=>Promise<{polaczony:boolean, powod?:string|null}>,
 *   szyna?:any, teraz?:()=>number, czekaj?:(ms:number)=>Promise<void>, odstepTikTokMs?:number }} o
 */
export function utworzAutopilotFormatow(o) {
    const cfg = { teraz: () => Date.now(), czekaj: (ms) => new Promise((r) => setTimeout(r, ms)), odstepTikTokMs: 15_000, ...o };
    const F = cfg.formaty;
    const PLIK = path.join(cfg.katalog, 'formaty', 'autopilot.json');
    const czas = () => new Date(cfg.teraz()).toISOString();
    const dzis = () => czas().slice(0, 10);
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Impresario', rodzaj: 'praca', tresc: `🤖 ${tresc}` })?.catch?.(() => {});
    let dane = null, trwa = null, petla = null, ostatniTikTok = 0;

    async function wczytaj() {
        if (dane) return dane;
        try { dane = JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { dane = {}; }
        dane.ustawienia ??= {};
        dane.ustawienia.wlaczone = Object.fromEntries(CELE_AUTO.map((c) => [c, dane.ustawienia.wlaczone?.[c] === true]));
        dane.ustawienia.limit = Object.fromEntries(CELE_AUTO.map((c) => [c, Math.min(MAX_LIMITU[c], Math.max(0, Number(dane.ustawienia.limit?.[c] ?? DOMYSLNY_LIMIT) || 0))]));
        dane.rejestr ??= {};
        dane.dzien ??= { data: dzis(), wyslane: {} };
        dane.bledy ??= [];
        // 👻 przebieg przerwany restartem: wysyłka mogła już wyjść (Instagram publikuje od razu) — nie ponawiamy sami
        for (const r of Object.values(dane.rejestr)) if (r.stan === 'robi') Object.assign(r, { stan: 'porzucony', powod: 'przerwane restartem mostu — sprawdź w sieci, czy nie poszło, i dopiero wtedy ↻ ponów' });
        return dane;
    }
    async function zapisz() {
        await fs.mkdir(path.dirname(PLIK), { recursive: true });
        await fs.writeFile(`${PLIK}.tmp`, JSON.stringify(dane, null, 1), 'utf8');
        await fs.rename(`${PLIK}.tmp`, PLIK);
    }
    const klucz = (plik, cel) => `${path.resolve(plik)}|${cel}`;
    function nowyDzien(d) { if (d.dzien.data !== dzis()) d.dzien = { data: dzis(), wyslane: {} }; }

    /** Wysłane filmy z katalogów montaży: jeden wpis na plik (kopie na inne kanały i Shorty pomijane). */
    async function filmy() {
        const lista = await cfg.publikacje().catch(() => []);
        const out = new Map(), poza = [];
        for (const p of lista) {
            if (!ETAPY_WYSLANE.includes(p.etap) || p.kopiaZ || p.zrodlo?.format || !p.plik) continue;
            const k = path.resolve(p.plik);
            if (out.has(k)) continue;
            try { F.zrodloMontazu(k); out.set(k, { plik: k, tytul: p.tytul ?? p.nazwa ?? path.basename(k), publikacja: p.id, projekt: p.zrodlo?.projekt ?? null }); }
            catch (e) { poza.push({ plik: k, tytul: p.tytul ?? path.basename(k), powod: e.message }); }
        }
        return { filmy: [...out.values()], poza };
    }

    /** Zrobić? wyslany / porzucony = nie; blad = do MAX_PROB. */
    const doZrobienia = (d, plik, cel) => { const r = d.rejestr[klucz(plik, cel)]; return !r || (r.stan === 'blad' && (r.proby ?? 0) < MAX_PROB); };

    /** Klip jeszcze nie poszedł do sieci: brak publikacji, odrzucona/błąd albo auto-próba bez opisu (ponowienie Kronikarza). */
    const wolnyDla = (pub) => !pub || ['odrzucona', 'blad'].includes(pub.etap) || (pub.auto && pub.etap === 'do_akceptacji');
    async function klipDla(film, cel) {
        const limit = CELE[cel].max;
        const siec = SIEC_CELU[cel];
        const pr = await F.propozycje(film.plik);
        const w = wycinekDla(pr.propozycje, pr.opis?.sekundy, limit, { caly: cel === 'tiktok' });
        // klip autopilota z tym samym wycinkiem, który nie poszedł jeszcze do tej sieci → ten sam (bez drugiego ffmpeg);
        // TikTok bierze cały film, więc krótszy pion Shortu mu nie wystarcza
        const istniejacy = (await F.wszystkie()).find((k) => k.autopilot && k.stan === 'gotowy' && path.resolve(k.zrodlo) === film.plik
            && Math.abs(k.od - w.od) < 0.05 && Math.abs(k.do - w.do) < 0.05 && (k.sekundy ?? Infinity) <= limit + 0.05 && wolnyDla(k.publikacje?.[siec]));
        if (istniejacy) return istniejacy;
        const k = await F.utworz({ plik: film.plik, ...w, nazwa: w.propozycja ? undefined : `${film.tytul}`.slice(0, 100), uklad: 'rozmyte', napisy: 'zachowane', autopilot: true });
        const gotowy = await F.gotowy(k.id);
        if (gotowy.stan !== 'gotowy') throw new Error(`Przeróbka: ${gotowy.powod ?? 'nie wyszła'}`);
        return gotowy;
    }

    /**
     * Jeden przebieg: dla każdego włączonego celu (po kolei) filmy bez wpisu → klip → wysyłka; limit dnia i konto pilnowane.
     * @returns {Promise<object>} podsumowanie
     */
    async function przebieg({ reczny = false } = {}) {
        if (trwa) return trwa;
        trwa = (async () => {
            const d = await wczytaj();
            const cele = CELE_AUTO.filter((c) => d.ustawienia.wlaczone[c]);
            if (!cele.length) { if (reczny) throw new Error('Autopilot ma wyłączone wszystkie sieci — włącz Shorts, Reels albo TikTok.'); return { cele: [] }; }
            nowyDzien(d);
            const { filmy: lista } = await filmy();
            const wynik = { kiedy: czas(), cele: {}, reczny };
            for (const cel of cele) {
                const siec = SIEC_CELU[cel];
                const w = (wynik.cele[cel] = { wyslane: 0, bledy: 0, czeka: null });
                const konto = await cfg.stanSieci(siec).catch((e) => ({ polaczony: false, powod: e.message }));
                if (!konto?.polaczony) { w.czeka = konto?.powod ?? `${siec} niepodłączone`; continue; }
                for (const film of lista) {
                    if ((d.dzien.wyslane[cel] ?? 0) >= d.ustawienia.limit[cel]) { w.czeka = `limit dnia (${d.ustawienia.limit[cel]}) — reszta jutro`; break; }
                    if (!doZrobienia(d, film.plik, cel)) continue;
                    const kl = klucz(film.plik, cel);
                    const r = (d.rejestr[kl] = { ...(d.rejestr[kl] ?? {}), stan: 'robi', film: film.tytul, kiedy: czas() });
                    await zapisz();
                    try {
                        const k = await klipDla(film, cel);
                        r.klip = k.id;
                        if (siec === 'tiktok') { const ile = cfg.teraz() - ostatniTikTok; if (ostatniTikTok && ile < cfg.odstepTikTokMs) await cfg.czekaj(cfg.odstepTikTokMs - ile); }
                        const po = await F.doPublikacji(k.id, siec, { auto: true });
                        if (siec === 'tiktok') ostatniTikTok = cfg.teraz();
                        const pub = po.publikacje?.[siec] ?? {};
                        Object.assign(r, { stan: 'wyslany', etap: pub.etap ?? null, url: pub.url ?? null, kiedy: czas(), powod: null });
                        d.dzien.wyslane[cel] = (d.dzien.wyslane[cel] ?? 0) + 1;
                        w.wyslane++;
                        nadaj(`${CELE[cel].nazwa}: „${film.tytul}” wysłany sam (${UWAGI[cel].split(' — ')[0]})`);
                    } catch (e) {
                        const proby = (r.proby ?? 0) + 1;
                        Object.assign(r, { stan: proby >= MAX_PROB ? 'porzucony' : 'blad', proby, powod: e.message, kiedy: czas() });
                        d.bledy = [{ kiedy: czas(), cel, film: film.tytul, powod: e.message }, ...d.bledy].slice(0, 20);
                        w.bledy++;
                        // konto padło w trakcie (token wygasł) — reszta tego celu poczeka do następnego przebiegu
                        if (/wygasł|niepołączony|niepodłączon|cofnięty/i.test(e.message)) { w.czeka = e.message; await zapisz(); break; }
                    }
                    await zapisz();
                }
            }
            d.ostatniPrzebieg = wynik;
            await zapisz();
            return wynik;
        })();
        try { return await trwa; } finally { trwa = null; }
    }

    async function ustaw({ wlaczone, limit } = {}) {
        const d = await wczytaj();
        for (const c of CELE_AUTO) {
            if (typeof wlaczone?.[c] === 'boolean') d.ustawienia.wlaczone[c] = wlaczone[c];
            if (limit?.[c] !== undefined) {
                const n = Number(limit[c]);
                if (!Number.isInteger(n) || n < 0 || n > MAX_LIMITU[c]) throw new Error(`Limit ${CELE[c].nazwa}: 0–${MAX_LIMITU[c]} na dobę${c === 'tiktok' ? ' (TikTok trzyma najwyżej 5 szkiców na dobę)' : ''}.`);
                d.ustawienia.limit[c] = n;
            }
        }
        await zapisz();
        nadaj(`ustawienia: ${CELE_AUTO.map((c) => `${CELE[c].nazwa} ${d.ustawienia.wlaczone[c] ? 'WŁ' : 'wył'}`).join(', ')}`);
        return stan();
    }

    /** ↻ porzucony/błąd z powrotem do kolejki (zeruje próby). */
    async function ponow(plik, cel) {
        const d = await wczytaj();
        const kl = klucz(plik, cel);
        if (!d.rejestr[kl] || d.rejestr[kl].stan === 'wyslany') throw new Error('Tego filmu nie ma do ponowienia.');
        delete d.rejestr[kl];
        await zapisz();
        return stan();
    }

    async function stan() {
        const d = await wczytaj();
        nowyDzien(d);
        const { filmy: lista, poza } = await filmy();
        const klipy = (await F.wszystkie()).filter((k) => k.autopilot);
        const cele = {};
        for (const c of CELE_AUTO) {
            const wpisy = lista.map((f) => d.rejestr[klucz(f.plik, c)]).filter(Boolean);
            const konto = await cfg.stanSieci(SIEC_CELU[c]).catch((e) => ({ polaczony: false, powod: e.message }));
            cele[c] = {
                nazwa: CELE[c].nazwa, siec: SIEC_CELU[c], wlaczony: d.ustawienia.wlaczone[c], limit: d.ustawienia.limit[c], maxLimit: MAX_LIMITU[c], maxSekund: CELE[c].max,
                doZrobienia: lista.filter((f) => doZrobienia(d, f.plik, c)).length, wyslane: wpisy.filter((r) => r.stan === 'wyslany').length,
                porzucone: wpisy.filter((r) => r.stan === 'porzucony').length, dzisiaj: d.dzien.wyslane[c] ?? 0,
                konto: { polaczony: !!konto?.polaczony, powod: konto?.powod ?? null }, uwaga: UWAGI[c],
            };
        }
        const porzucone = Object.entries(d.rejestr).filter(([, r]) => r.stan === 'porzucony' || r.stan === 'blad').map(([k, r]) => ({ plik: k.slice(0, k.lastIndexOf('|')), cel: k.slice(k.lastIndexOf('|') + 1), ...r })).slice(0, 20);
        return {
            cele, filmow: lista.length, pozaMontazem: poza.length, przerobione: klipy.filter((k) => k.stan === 'gotowy').length,
            bledy: d.bledy, porzucone, ostatniPrzebieg: d.ostatniPrzebieg ?? null, trwa: !!trwa, petla: !!petla,
        };
    }

    /** Pętla: co `co` ms (pierwszy przebieg po `start`), tylko gdy coś włączone. */
    function uruchom({ start = 120_000, co = 10 * 60_000 } = {}) {
        if (petla || process.env.OTAKOS_AUTOPILOT_FORMATOW === '0') return;
        const krok = () => przebieg().catch((e) => console.warn('[Autopilot formatów]', e.message));
        petla = setTimeout(function tik() { void krok().finally(() => { petla = setTimeout(tik, co); petla.unref?.(); }); }, start);
        petla.unref?.();
    }
    function zatrzymaj() { if (petla) clearTimeout(petla); petla = null; }

    return { stan, ustaw, przebieg, ponow, uruchom, zatrzymaj, filmy };
}

export default { utworzAutopilotFormatow, wycinekDla, CELE_AUTO, SIEC_CELU, MAX_LIMITU };
