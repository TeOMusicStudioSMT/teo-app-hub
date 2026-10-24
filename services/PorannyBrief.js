/**
 * ☀️ Poranny brief Katedry (Suweren 2026-10-24, po Claude Duet: „zrób Poranny brief Katedry do tego, co już mamy”).
 *
 * Raz dziennie (od `godzina`, domyślnie 7:00; albo „☀️ teraz”) most zbiera FAKTY z tras, które Hub już ma
 * (publikacje YouTube, programy, autopilot formatów, Stół, Sklep Mini, Stripe, Nocna Zmiana, dziennik błędów mostu)
 * i składa je w trzy sekcje: ✓ czeka na Ciebie · 📈 ostatnie 24 h · ⚠ do sprawdzenia. Bez modelu — liczby z mostu.
 * Zapowiedź (≤ 400 znaków) idzie kanałem Mistrza do Orbity (`wiesc`), pełny brief: `GET /api/brief`, Hub → Rdzeń → ☀️.
 * Źródło, które nie odpowiedziało, brief wymienia wprost („nie odczytałem: …”) — nie udaje, że jest pusto.
 * Ważne: stan odcinka w programie zostaje „do_akceptacji” także po publikacji — sprawy do ✓ liczymy z PUBLIKACJI,
 * z programów biorą się tylko świeże „czeka na nagranie w studiu” i błędy.
 * `_OtakOs_Wymiar/poranny-brief/<dzień>.json` (14 ostatnich) + `ustawienia.json` {wlaczony, godzina, glos}.
 */
import fs from 'fs/promises';
import path from 'path';

const DOBA = 24 * 3600 * 1000;
const SWIEZE = 3 * DOBA;   // błędy i studio z ostatnich 3 dni (starsze to historia, nie sprawa na dziś)
export const DOMYSLNE = { wlaczony: true, godzina: 7, glos: false };

/** Programy z odcinkami: trasa → nazwa i ikona. */
export const PROGRAMY = [
    { trasa: '/api/game-show', klucz: 'odcinki', nazwa: 'TeO Game Show', ikona: '🎪' },
    { trasa: '/api/wieczor-tanca', klucz: 'wieczory', nazwa: 'Wieczór Tańca', ikona: '🌙' },
    { trasa: '/api/zebrra-news', klucz: 'odcinki', nazwa: 'Zebrra News', ikona: '📰' },
    { trasa: '/api/zebrra-taniec', klucz: 'odcinki', nazwa: 'Zebrra Sports · taniec', ikona: '🩰' },
    { trasa: '/api/mame-leon', klucz: 'odcinki', nazwa: 'Mame Leon Show', ikona: '🦎' },
    { trasa: '/api/gol-dnia', klucz: 'odcinki', nazwa: 'Gol Dnia', ikona: '⚽' },
];

const czasZ = (x) => {
    for (const k of ['wyslano', 'zatwierdzono', 'utworzono', 'zmieniono', 'od', 'kiedy', 'dzien']) {
        const t = Date.parse(x?.[k] ?? '');
        if (Number.isFinite(t)) return t;
    }
    return null;
};
const odmiana = (n, jeden, kilka, wiele) => (n === 1 ? jeden : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? kilka : wiele);
const liczba = (n, jeden, kilka, wiele) => `${n} ${odmiana(n, jeden, kilka, wiele)}`;
const skrot = (t, n = 60) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/**
 * Czysta: fakty → brief. `dane` = odpowiedzi tras (null = nie odczytano, z powodem w `braki`).
 * Zwraca { sekcje: [{id, tytul, linie: [{tekst, pilne?}]}], pilnych, zapowiedz }.
 */
export function zlozBrief(dane, { teraz = Date.now(), imie = '' } = {}) {
    const od = teraz - DOBA;
    const czeka = [], dzien = [], uwaga = [];
    const swieze = (x) => { const t = czasZ(x); return t === null || t >= teraz - SWIEZE; };

    // 📺 publikacje YouTube
    const pub = dane.publikacje?.publikacje;
    let filmow = 0;
    if (Array.isArray(pub)) {
        const doZ = pub.filter((p) => p.etap === 'do_akceptacji');
        if (doZ.length) czeka.push({ pilne: true, tekst: `📺 ${liczba(doZ.length, 'publikacja', 'publikacje', 'publikacji')} YouTube do ✓: ${doZ.slice(0, 3).map((p) => `„${skrot(p.tytul || p.nazwa, 50)}”`).join(', ')}${doZ.length > 3 ? ' …' : ''} (Impresariat / StoL → Izba)` });
        const wyszlo = pub.filter((p) => (p.etap === 'opublikowana' || p.etap === 'prywatna') && Date.parse(p.wyslano ?? '') >= od);
        filmow = wyszlo.length;
        if (wyszlo.length) {
            const shorty = wyszlo.filter((p) => p.zrodlo?.format === 'shorts').length;
            const kanaly = [...new Set(wyszlo.map((p) => p.kanalNazwa).filter(Boolean))];
            dzien.push({ tekst: `📺 YouTube: ${odmiana(wyszlo.length, 'wyszedł', 'wyszły', 'wyszło')} ${liczba(wyszlo.length, 'film', 'filmy', 'filmów')}${shorty ? ` (w tym ${shorty} Shorts)` : ''}${kanaly.length ? ` · ${kanaly.join(', ')}` : ''}. Najnowszy: „${skrot(wyszlo.sort((a, b) => Date.parse(b.wyslano) - Date.parse(a.wyslano))[0].tytul, 60)}”.` });
        } else dzien.push({ tekst: '📺 YouTube: w ostatnich 24 h nic nie wyszło.' });
        const prywatne = pub.filter((p) => p.etap === 'prywatna' && Date.parse(p.wyslano ?? '') >= od).length;
        if (prywatne) czeka.push({ tekst: `👁️ ${liczba(prywatne, 'film czeka', 'filmy czekają', 'filmów czeka')} jako prywatne — widoczność zmienisz w YouTube Studio.` });
        const limit = pub.filter((p) => p.etap === 'limit').length;
        if (limit) uwaga.push({ tekst: `⏳ ${liczba(limit, 'film czeka', 'filmy czekają', 'filmów czeka')} na dzienny limit wysyłek YouTube — pójdą same po odnowieniu.` });
        const bledy = pub.filter((p) => p.etap === 'blad' && swieze(p));
        if (bledy.length) uwaga.push({ pilne: true, tekst: `❌ ${liczba(bledy.length, 'publikacja padła', 'publikacje padły', 'publikacji padło')}: ${bledy.slice(0, 2).map((p) => `„${skrot(p.tytul || p.nazwa, 40)}” — ${skrot(p.blad, 70)}`).join('; ')}` });
    }

    // 🎬 programy: świeże „czeka na nagranie w studiu” i błędy
    for (const pr of PROGRAMY) {
        const lista = dane.programy?.[pr.trasa]?.[pr.klucz];
        if (!Array.isArray(lista)) continue;
        const studio = lista.filter((o) => o.stan === 'studio' && swieze(o));
        if (studio.length) czeka.push({ tekst: `${pr.ikona} ${pr.nazwa}: ${liczba(studio.length, 'odcinek czeka', 'odcinki czekają', 'odcinków czeka')} na nagranie w studiu (otwórz studio — automat nagra).` });
        const bl = lista.filter((o) => o.stan === 'blad' && swieze(o));
        if (bl.length) uwaga.push({ tekst: `${pr.ikona} ${pr.nazwa}: ${liczba(bl.length, 'odcinek padł', 'odcinki padły', 'odcinków padło')}${bl[0].powod ? ` — ${skrot(bl[0].powod, 90)}` : ''}.` });
    }

    // 📱 autopilot formatów
    const cele = dane.autopilot?.autopilot?.cele;
    if (cele && typeof cele === 'object') {
        const wl = Object.values(cele).filter((c) => c.wlaczony);
        if (wl.length) dzien.push({ tekst: `📱 Autopilot formatów: ${wl.map((c) => `${c.nazwa} ${c.dzisiaj ?? 0} dziś (razem ${c.wyslane ?? 0}${c.doZrobienia ? `, w kolejce ${c.doZrobienia}` : ''})`).join(' · ')}.` });
        for (const c of wl) {
            if (c.pauza) uwaga.push({ tekst: `⏸️ ${c.nazwa}: pauza — ${skrot(typeof c.pauza === 'string' ? c.pauza : c.pauza.powod ?? JSON.stringify(c.pauza), 100)}` });
            if (c.konto && c.konto.polaczony === false) uwaga.push({ pilne: true, tekst: `🔌 ${c.nazwa}: ${skrot(c.konto.powod || 'konto niepołączone', 100)}` });
        }
    }

    // 🏛️ Stół
    const karty = dane.stol?.karty;
    if (Array.isArray(karty)) {
        const doRat = karty.filter((k) => k.etap === 'do_akceptacji');
        const naStole = karty.filter((k) => k.etap === 'na_stole');
        const utk = karty.filter((k) => k.etap === 'utknela');
        if (doRat.length) czeka.push({ pilne: true, tekst: `🏛️ Stół: ${liczba(doRat.length, 'karta czeka', 'karty czekają', 'kart czeka')} na ratyfikację: ${doRat.slice(0, 2).map((k) => `„${skrot(k.tytul, 40)}”`).join(', ')}.` });
        if (naStole.length) czeka.push({ tekst: `🏛️ Stół: ${liczba(naStole.length, 'nowa propozycja', 'nowe propozycje', 'nowych propozycji')} do przyjęcia.` });
        if (utk.length) uwaga.push({ tekst: `🏛️ Stół: ${liczba(utk.length, 'karta utknęła', 'karty utknęły', 'kart utknęło')}: ${utk.slice(0, 2).map((k) => `„${skrot(k.tytul, 40)}”`).join(', ')}.` });
    }

    // 🐾 Sklep Mini i 💳 sprzedaż
    const sklep = dane.sklep;
    if (sklep) {
        const pakiety = (sklep.pakiety ?? []).filter((p) => p.stan === 'do-akceptacji').length;
        const prop = (sklep.propozycje ?? []).filter((p) => p.stan === 'czeka' && p.dzien === sklep.dzien?.data).length;
        if (pakiety || prop) czeka.push({ tekst: `🐾 Sklep Mini: ${[pakiety && liczba(pakiety, 'pakiet do wystawienia', 'pakiety do wystawienia', 'pakietów do wystawienia'), prop && `${liczba(prop, 'nowa propozycja', 'nowe propozycje', 'nowych propozycji')} Mini od stada`].filter(Boolean).join(', ')} (Marketplace → 🐾).` });
    }
    const sprzedaz = dane.sprzedaz?.sprzedaz;
    if (Array.isArray(sprzedaz)) {
        const s24 = sprzedaz.filter((s) => (czasZ(s) ?? 0) >= od);
        dzien.push({ tekst: s24.length ? `💳 Sprzedaż: ${liczba(s24.length, 'pakiet', 'pakiety', 'pakietów')} (${s24.map((s) => `${s.kwota ?? '?'} ${s.waluta ?? ''}`.trim()).join(', ')}).` : '💳 Sprzedaż: w ostatnich 24 h nic.' });
    }

    // 🌙 Nocna Zmiana
    const nocna = dane.nocna;
    if (nocna) {
        const noc = (nocna.dziennik ?? []).filter((z) => (czasZ(z) ?? 0) >= od);
        const ok = noc.filter((z) => z.stan === 'gotowe').length, zle = noc.filter((z) => z.stan === 'blad');
        dzien.push({ tekst: `🌙 Nocna Zmiana: ${nocna.wlaczona ? 'włączona' : 'wyłączona'} · ${noc.length ? `${liczba(ok, 'zadanie gotowe', 'zadania gotowe', 'zadań gotowych')}${zle.length ? `, ${zle.length} z błędem` : ''}` : 'w nocy nic nie liczyła'}${(nocna.zadania ?? []).length ? ` · w kolejce ${nocna.zadania.length}` : ''}.` });
        if (zle.length) uwaga.push({ tekst: `🌙 Nocna Zmiana: „${zle[0].rodzaj}” — ${skrot(zle[0].blad, 90)}` });
    }

    // 🛟 dziennik błędów mostu
    if (Array.isArray(dane.bledyMostu)) {
        const b24 = dane.bledyMostu.filter((b) => b.czas >= od);
        if (b24.length) uwaga.push({ pilne: true, tekst: `🛟 Most złapał ${liczba(b24.length, 'nieobsłużony błąd', 'nieobsłużone błędy', 'nieobsłużonych błędów')} (most-bledy.log) — ostatni: ${skrot(b24.at(-1).tresc, 110)}` });
    }

    // uczciwie: czego nie odczytano
    const braki = Object.entries(dane.braki ?? {});
    if (braki.length) uwaga.push({ tekst: `🔇 Nie odczytałem: ${braki.map(([k, v]) => `${k} (${skrot(v, 40)})`).join(', ')} — tych spraw brief nie widzi.` });

    if (!czeka.length) czeka.push({ tekst: '✨ Nic nie czeka na Twoje ✓ — możesz zacząć od Złotej Pauzy.' });
    if (!uwaga.length) uwaga.push({ tekst: '✅ Bez usterek w faktach mostu.' });
    const sekcje = [
        { id: 'czeka', tytul: '✓ Czeka na Ciebie', linie: czeka },
        { id: 'dzien', tytul: '📈 Ostatnie 24 h', linie: dzien },
        { id: 'uwaga', tytul: '⚠ Do sprawdzenia', linie: uwaga },
    ];
    const ileCzeka = czeka.filter((l) => !l.tekst.startsWith('✨')).length;
    const ileUwag = uwaga.filter((l) => !l.tekst.startsWith('✅')).length;
    const pilnych = [...czeka, ...uwaga].filter((l) => l.pilne).length;
    const zapowiedz = `☀️ Dzień dobry${imie ? `, ${imie}` : ''}! ${ileCzeka ? `${liczba(ileCzeka, 'sprawa czeka', 'sprawy czekają', 'spraw czeka')} na Ciebie` : 'nic nie czeka na Twoje ✓'} · wczoraj ${liczba(filmow, 'film', 'filmy', 'filmów')} na YouTube · ${ileUwag ? liczba(ileUwag, 'rzecz do sprawdzenia', 'rzeczy do sprawdzenia', 'rzeczy do sprawdzenia') : 'bez usterek'}. Pełny brief: Hub → ••• → Rdzeń → ☀️ Poranny brief.`.slice(0, 400);
    return { sekcje, pilnych, ileCzeka, ileUwag, filmow, zapowiedz };
}

/** Brief jako zwykły tekst (log, czat, Główny). */
export const briefJakoTekst = (b) => [b.zapowiedz, ...b.sekcje.flatMap((s) => [``, s.tytul, ...s.linie.map((l) => `- ${l.tekst}`)])].join('\n');

/** Wpisy most-bledy.log: linie zaczynające się od czasu ISO. */
export function czytajBledyMostu(tekst) {
    const w = [];
    for (const linia of String(tekst ?? '').split('\n')) {
        const m = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z) (.*)$/.exec(linia);
        if (m) w.push({ czas: Date.parse(m[1]), tresc: m[2] });
    }
    return w;
}

/**
 * @param {object} cfg
 * @param {string} cfg.katalog — `_OtakOs_Wymiar`
 * @param {(trasa: string) => Promise<any>} cfg.pobierz — GET trasy własnego mostu (rzuca przy błędzie)
 * @param {(w: {tresc, rodzaj, skad, glos}) => Promise<any>} [cfg.wiesc] — kanał Mistrza
 * @param {() => Date} [cfg.teraz]
 */
export function utworzPorannyBrief({ katalog, pobierz, wiesc = null, teraz = () => new Date(), szyna = null }) {
    const kat = path.join(katalog, 'poranny-brief');
    const plikUst = path.join(kat, 'ustawienia.json');
    const dzienZ = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let trwa = null, zegar = null;

    async function ustawienia() {
        try { return { ...DOMYSLNE, ...JSON.parse(await fs.readFile(plikUst, 'utf8')) }; } catch { return { ...DOMYSLNE }; }
    }
    async function ustaw(zmiany = {}) {
        const u = await ustawienia();
        if (typeof zmiany.wlaczony === 'boolean') u.wlaczony = zmiany.wlaczony;
        if (zmiany.godzina !== undefined) { const g = Number(zmiany.godzina); if (!Number.isInteger(g) || g < 0 || g > 23) throw new Error('Godzina 0–23.'); u.godzina = g; }
        if (typeof zmiany.glos === 'boolean') u.glos = zmiany.glos;
        await fs.mkdir(kat, { recursive: true });
        await fs.writeFile(plikUst, JSON.stringify(u, null, 2), 'utf8');
        return u;
    }
    async function czytaj(dzien) { try { return JSON.parse(await fs.readFile(path.join(kat, `${dzien}.json`), 'utf8')); } catch { return null; } }
    async function ostatni() {
        let pliki = [];
        try { pliki = (await fs.readdir(kat)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort(); } catch { /* brak katalogu */ }
        return pliki.length ? czytaj(pliki.at(-1).slice(0, 10)) : null;
    }

    async function zbierz() {
        const dane = { programy: {}, braki: {} };
        const wez = async (klucz, trasa, gdzie = (d) => { dane[klucz] = d; }) => {
            try { gdzie(await pobierz(trasa)); } catch (e) { dane.braki[klucz] = e.message || String(e); }
        };
        await Promise.all([
            wez('publikacje', '/api/youtube/publikacje'),
            wez('autopilot', '/api/formaty/autopilot'),
            wez('stol', '/api/stol'),
            wez('sklep', '/api/sklep-mini'),
            wez('sprzedaz', '/api/stripe/sprzedaz'),
            wez('nocna', '/api/nocna/stan'),
            ...PROGRAMY.map((p) => wez(p.nazwa, p.trasa, (d) => { dane.programy[p.trasa] = d; })),
        ]);
        try { dane.bledyMostu = czytajBledyMostu(await fs.readFile(path.join(katalog, 'most-bledy.log'), 'utf8')); }
        catch (e) { dane.bledyMostu = e.code === 'ENOENT' ? [] : null; }
        let imie = '';
        try { imie = (await pobierz('/api/grv/ja'))?.wlasciciel?.nazwa ?? ''; } catch { /* bez imienia */ }
        return { dane, imie };
    }

    /** Złóż dzisiejszy brief (albo zwróć zapisany; `wymus` = złóż od nowa) i ogłoś go kanałem Mistrza. */
    async function wygeneruj({ wymus = false, oglos = true } = {}) {
        const t = teraz();
        const dzien = dzienZ(t);
        if (!wymus) { const b = await czytaj(dzien); if (b) return b; }
        if (trwa) return trwa;
        trwa = (async () => {
            const { dane, imie } = await zbierz();
            const b = { dzien, kiedy: t.toISOString(), ...zlozBrief(dane, { teraz: t.getTime(), imie }) };
            await fs.mkdir(kat, { recursive: true });
            await fs.writeFile(path.join(kat, `${dzien}.json`), JSON.stringify(b, null, 2), 'utf8');
            // 14 ostatnich dni
            try { const stare = (await fs.readdir(kat)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(0, -14); for (const f of stare) await fs.unlink(path.join(kat, f)); } catch { /* sprzątanie nie jest ważniejsze od briefu */ }
            if (oglos && wiesc) { const u = await ustawienia(); await wiesc({ tresc: b.zapowiedz, rodzaj: 'brief', skad: 'Poranny brief Katedry', glos: u.glos }).catch(() => {}); }
            void szyna?.nadaj?.({ agent: 'Poranny brief', rodzaj: 'brief', tresc: b.zapowiedz })?.catch?.(() => {});
            return b;
        })();
        try { return await trwa; } finally { trwa = null; }
    }

    /** Raz na minutę: po godzinie briefu, gdy dziś go jeszcze nie było — złóż i ogłoś. */
    async function krok() {
        const u = await ustawienia();
        if (!u.wlaczony) return null;
        const t = teraz();
        if (t.getHours() < u.godzina) return null;
        if (await czytaj(dzienZ(t))) return null;
        return wygeneruj();
    }
    function uruchom({ coIle = 60_000, start = 90_000 } = {}) {
        if (zegar || process.env.OTAKOS_PORANNY_BRIEF === '0') return;
        const tik = () => { krok().catch((e) => console.warn('[Poranny brief]', e.message)); };
        setTimeout(tik, start).unref?.();
        zegar = setInterval(tik, coIle);
        zegar.unref?.();
    }
    return { ustawienia, ustaw, wygeneruj, ostatni, czytaj, krok, uruchom, zbierz };
}

/** Trasy (Straż: `/api/brief` tylko maszyna). */
export function zamontujTrasyBriefu(app, Brief) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(400).json({ success: false, message: e.message }));
    app.get('/api/brief', (_req, res) => odp(res, (async () => ({ brief: await Brief.ostatni(), ustawienia: await Brief.ustawienia() }))()));
    app.post('/api/brief/teraz', (_req, res) => odp(res, (async () => ({ brief: await Brief.wygeneruj({ wymus: true }) }))()));
    app.put('/api/brief/ustawienia', (req, res) => odp(res, (async () => ({ ustawienia: await Brief.ustaw(req.body ?? {}) }))()));
}
