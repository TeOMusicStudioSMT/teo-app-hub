/**
 * 📚 Wypożyczalnia Żywych Ksiąg — teostory.studio (Suweren 2026-11-05: „Netflix dla interaktywnych książek… do wypożyczenia”).
 * Silnik czytnika (TeO Story Studio, moduł produkcyjny) PUBLIKUJE księgę do Katedry; portal teostory.studio czyta katalog
 * i wypożycza przez tunel Katedry — jak Sklep Mini (services/SklepMini.js), bez własnego serwera z danymi.
 *
 * Księga = JSON silnika (Storybook: title, subtitle, author, pages[{narrativeText, dialogueLines, imageUrl…}]) →
 * `_OtakOs_Wymiar/teostory/ksiegi/<id>.json` + wpis w `katalog.json`. Poziom (`tier`): `demo` = czytanie za darmo,
 * `rental_48h` = Stripe Checkout (cena liczona TU, nie w przeglądarce) → dostęp 48 h od pierwszego odbioru opłaconej sesji.
 * Dostęp = identyfikator opłaconej sesji Stripe (sprawdzany u Stripe, schowek w services/Stripe.js) + `wypozyczenia.json`.
 * NIE ma tu portfela mGRV dla gości — goście strony nie są węzłami księgi GRV (przelew GRV między Katedrami = 🏝️ Gry).
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TIERY = ['demo', 'rental_48h'];
export const GODZIN_WYPOZYCZENIA = 48;
export const DOMYSLNA_CENA_EUR = 1.99;
export const MAX_BAJTOW_KSIEGI = 40 * 1024 * 1024;
export const MAX_STRON = 300;
const ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
/** 🌍 Języki dzieł teostory.studio (Suweren 2026-11-09: „nasze dzieła z automatycznym tłumaczem… PL/EN/DE”). */
export const JEZYKI_KSIAG = { pl: 'Polish', en: 'English', de: 'German' };
/** Krótsza księga = „Darmowy Prolog / Hörprobe” w portalu (Suweren: za 2,99 € czytelnik dostaje pełną opowieść). */
export const MIN_KWESTII_PELNEJ = 20;
/** Styl Palety dla ilustracji ksiąg: malowany storybook, świecki (bez aureoli, krzyży, ołtarzy). */
export const STYL_ILUSTRACJI_KSIEGI = 'painterly storybook illustration, rich gouache and oil textures, cinematic soft light, warm and deep colours, wide establishing shot, magical but secular, no text, no letters, no captions, no halos, no crosses, no religious symbols, no altars';
const ORIGINY = (process.env.OTAKOS_TEOSTORY_ORIGINY || 'https://teostory.studio,https://www.teostory.studio').split(',').map((x) => x.trim()).filter(Boolean);

const tekst = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
export function idKsiegi(wej) {
    const z = String(wej ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56);
    return ID.test(z) ? z : `ks-${crypto.randomBytes(4).toString('hex')}`;
}
/** Adres powrotu po płatności — tylko portal teostory.studio (albo `OTAKOS_TEOSTORY_ORIGINY`), inaczej strona odbioru mostu. */
export function dozwolonyPowrot(u, originy = ORIGINY) {
    try { const x = new URL(String(u)); return x.protocol === 'https:' && originy.includes(x.origin) ? x.origin + x.pathname : null; } catch { return null; }
}

/** Sprawdza księgę silnika i robi wpis katalogu. Rzuca z powodem. */
export function sprawdzKsiege(book, { tier = 'rental_48h', cenaEur = DOMYSLNA_CENA_EUR } = {}) {
    if (!book || typeof book !== 'object') throw new Error('Brak księgi (pole „book”).');
    const tytul = tekst(book.title, 200);
    if (!tytul) throw new Error('Księga nie ma tytułu.');
    const strony = Array.isArray(book.pages) ? book.pages : [];
    if (!strony.length) throw new Error('Księga nie ma stron.');
    if (strony.length > MAX_STRON) throw new Error(`Za dużo stron (${strony.length} > ${MAX_STRON}).`);
    if (!strony.some((s) => tekst(s?.narrativeText, 10))) throw new Error('Żadna strona nie ma tekstu narracji.');
    if (!TIERY.includes(tier)) throw new Error(`Poziom: ${TIERY.join(', ')} (vip_full jeszcze nie ma).`);
    const cena = Math.round(Number(cenaEur) * 100) / 100;
    if (tier === 'rental_48h' && !(cena >= 0.5 && cena <= 100)) throw new Error('Cena wypożyczenia: 0,50–100 €.');
    const bajtow = Buffer.byteLength(JSON.stringify(book));
    if (bajtow > MAX_BAJTOW_KSIEGI) throw new Error(`Księga za duża (${Math.round(bajtow / 1e6)} MB > ${MAX_BAJTOW_KSIEGI / 1e6} MB) — obrazy jako adresy, nie dataURL.`);
    const jezyk = JEZYKI_KSIAG[String(book.language ?? '').slice(0, 2)] ? String(book.language).slice(0, 2) : null;
    const przeklady = przekladyKsiegi(book);
    return {
        tytul, podtytul: tekst(book.subtitle, 200), autor: tekst(book.author, 120), stron: strony.length, tier,
        cenaEur: tier === 'demo' ? 0 : cena, bajtow,
        opis: tekst(strony.find((s) => s?.narrativeText)?.narrativeText, 280),
        narrator: tekst(book.narrator ?? book.modelsUsed?.narrator, 80) || null,
        kwestii: liczKwestie(book), jezyk,
        jezyki: [...new Set([jezyk, ...Object.keys(przeklady)].filter(Boolean))],
        // tytuł, podtytuł i opis w każdym języku przekładu — karta w portalu mówi językiem strony
        przeklady: Object.fromEntries(Object.entries(przeklady).map(([j, p]) => [j, { tytul: tekst(p.title, 200) || tytul, podtytul: tekst(p.subtitle, 200), opis: tekst(p.pages?.find((s) => s?.narrativeText)?.narrativeText, 280) }])),
        muzyka: typeof book.musicUrl === 'string' && !!book.musicUrl ? { tytul: tekst(book.music?.title, 120) || null, autor: tekst(book.music?.author, 120) || null } : null,
    };
}

/** Kwestie Teatru = narracja strony + każda linia dialogu (tak liczy portal). */
export function liczKwestie(book) {
    return (book?.pages ?? []).reduce((n, s) => n + (tekst(s?.narrativeText, 10) ? 1 : 0) + (s?.dialogueLines ?? []).filter((l) => tekst(l?.text, 2)).length, 0);
}
/** Przekłady zapisane w księdze: tylko języki z listy i z tyloma stronami, co oryginał. */
export function przekladyKsiegi(book) {
    const t = book?.translations && typeof book.translations === 'object' ? book.translations : {};
    return Object.fromEntries(Object.entries(t).filter(([j, p]) => JEZYKI_KSIAG[j] && Array.isArray(p?.pages) && p.pages.length === (book.pages ?? []).length));
}

/** Strona → kawałek do przekładu (bez obrazów i nagrań). */
export const stronaDoPrzekladu = (s) => ({ chapterTitle: s?.chapterTitle ?? '', imageCaption: s?.imageCaption ?? '', narrativeText: s?.narrativeText ?? '', lines: (s?.dialogueLines ?? []).map((l) => String(l?.text ?? '')) });
/** Sprawdza przekład strony od modelu: te same pola, tyle samo kwestii, długość w granicach rozsądku. Rzuca z powodem. */
export function sprawdzPrzekladStrony(zrodlo, odp) {
    let d = odp;
    if (typeof d === 'string') { const m = /\{[\s\S]*\}/.exec(d.replace(/<think>[\s\S]*?<\/think>/g, '')); if (!m) throw new Error('brak JSON-a'); d = JSON.parse(m[0]); }
    if (!d || typeof d !== 'object') throw new Error('brak obiektu');
    const lines = Array.isArray(d.lines) ? d.lines.map((x) => String(x ?? '').trim()) : [];
    if (lines.length !== zrodlo.lines.length) throw new Error(`kwestii ${lines.length} zamiast ${zrodlo.lines.length}`);
    const pole = (k) => String(d[k] ?? '').trim();
    for (const k of ['chapterTitle', 'imageCaption', 'narrativeText']) if (zrodlo[k].trim() && !pole(k)) throw new Error(`puste pole ${k}`);
    const dl = (a, b) => !a.trim() || (b.length >= a.length * 0.35 && b.length <= a.length * 2.8 + 20);
    if (!dl(zrodlo.narrativeText, pole('narrativeText'))) throw new Error('narracja o podejrzanej długości');
    zrodlo.lines.forEach((l, i) => { if (!dl(l, lines[i])) throw new Error(`kwestia ${i + 1} o podejrzanej długości`); });
    return { chapterTitle: pole('chapterTitle'), imageCaption: pole('imageCaption'), narrativeText: pole('narrativeText'), lines };
}

/**
 * @param {{ katalog: string, stripe?: object|null, adres?: () => Promise<string|null>, teraz?: () => number }} o
 */
export function utworzWypozyczalnie({ katalog, stripe = null, adres = async () => null, obrazLokalny = () => null, teraz = () => Date.now(), pisz = null, rysuj = null, muzykaLokalna = () => null }) {
    const KAT = path.join(katalog, 'katalog.json'), KS = path.join(katalog, 'ksiegi'), WYP = path.join(katalog, 'wypozyczenia.json');
    let kolejka = Promise.resolve();
    const poKolei = (fn) => { const p = kolejka.then(fn); kolejka = p.catch(() => {}); return p; };
    async function czytaj(p, zap) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return zap; } }
    async function zapisz(p, o) { await fs.mkdir(path.dirname(p), { recursive: true }); const t = `${p}.${process.pid}.tmp`; await fs.writeFile(t, JSON.stringify(o, null, 2)); await fs.rename(t, p); }
    const plikKsiegi = (id) => (ID.test(String(id)) ? path.join(KS, `${id}.json`) : null);

    /** Okładka: pierwszy obraz strony z adresem http(s) — dataURL zapisujemy jako plik obok księgi. */
    async function okladka(id, book) {
        const url = (book.pages ?? []).map((s) => s?.imageUrl ?? s?.plates?.[0]?.imageUrl).find((u) => typeof u === 'string' && u);
        if (!url) return null;
        const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(url);
        if (m) { const roz = m[1].replace('jpeg', 'jpg'); await fs.writeFile(path.join(KS, `${id}-okladka.${roz}`), Buffer.from(m[2], 'base64')); return `plik:${roz}`; }
        if (url.startsWith(`/wizytowka/teostory/${id}/obraz/`)) return url;
        return /^https:\/\//.test(url) ? url.slice(0, 1000) : null;
    }

    /** Obrazy księgi (Silnik Ksiąg Katedry albo dataURL) → pliki Wypożyczalni + adres publiczny; obce https zostaje, reszta znika. */
    async function przeniesObrazy(id, book) {
        const kat = path.join(KS, id);
        await fs.mkdir(kat, { recursive: true });
        let n = 0;
        const swoje = (url) => typeof url === 'string' && url.startsWith(`/wizytowka/teostory/${id}/`);
        for (const f of await fs.readdir(kat).catch(() => [])) { const m = /^obraz-(\d+)\./.exec(f); if (m) n = Math.max(n, Number(m[1])); }
        const przenies = async (url) => {
            if (swoje(url)) return url;
            if (typeof url !== 'string' || !url) return url;
            const lok = obrazLokalny(url);
            const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(url);
            if (!lok && !m) return /^https:\/\//.test(url) ? url : undefined;
            const nazwa = `obraz-${++n}.${lok ? path.extname(lok).slice(1) || 'png' : m[1].replace('jpeg', 'jpg')}`;
            if (lok) await fs.copyFile(lok, path.join(kat, nazwa)); else await fs.writeFile(path.join(kat, nazwa), Buffer.from(m[2], 'base64'));
            return `/wizytowka/teostory/${id}/obraz/${nazwa}`;
        };
        // 🎙️ dźwięk strony (Własny Manuskrypt: lektor Głosek) → audio-N.mp3; obcy adres https zostaje, reszta znika
        let a = 0;
        for (const f of await fs.readdir(kat).catch(() => [])) { const m = /^audio-(\d+)\.mp3$/.exec(f); if (m) a = Math.max(a, Number(m[1])); }
        const przeniesDzwiek = async (url) => {
            if (swoje(url)) return url;
            if (typeof url !== 'string' || !url) return undefined;
            const lok = obrazLokalny(url);
            if (!lok || !/\.mp3$/i.test(lok)) return /^https:\/\//.test(url) ? url : undefined;
            const nazwa = `audio-${++a}.mp3`;
            await fs.copyFile(lok, path.join(kat, nazwa));
            return `/wizytowka/teostory/${id}/audio/${nazwa}`;
        };
        const pages = [];
        for (const s of book.pages ?? []) pages.push({ ...s, imageUrl: await przenies(s?.imageUrl), audioUrl: await przeniesDzwiek(s?.audioUrl), plates: undefined,
            dialogueLines: Array.isArray(s?.dialogueLines) ? await Promise.all(s.dialogueLines.map(async (l) => (l?.audioUrl ? { ...l, audioUrl: await przeniesDzwiek(l.audioUrl) } : l))) : s?.dialogueLines });
        // 🎵 podkład księgi (np. utwór Joanny z _OtakOs_Muzyka) → muzyka.mp3 obok nagrań, ten sam dostęp co audiobook
        let musicUrl = book.musicUrl;
        if (typeof musicUrl === 'string' && musicUrl && !swoje(musicUrl)) {
            const lok = muzykaLokalna(musicUrl);
            if (lok && /\.mp3$/i.test(lok)) { await fs.copyFile(lok, path.join(kat, 'muzyka.mp3')); musicUrl = `/wizytowka/teostory/${id}/audio/muzyka.mp3`; }
            else musicUrl = /^https:\/\//.test(musicUrl) ? musicUrl : undefined;
        }
        const characters = [];
        for (const c of book.characters ?? []) characters.push({ ...c, avatarCutoutUrl: await przenies(c?.avatarCutoutUrl) });
        return { ...book, id, pages, characters, musicUrl };
    }
    function plikDzwieku(id, nazwa) {
        if (!ID.test(String(id)) || !/^(audio-\d{1,4}|muzyka)\.mp3$/.test(String(nazwa))) return null;
        const p = path.join(KS, id, nazwa);
        return fsSync.existsSync(p) ? p : null;
    }
    function plikObrazu(id, nazwa) {
        if (!ID.test(String(id)) || !/^obraz-\d{1,3}\.(png|jpg|webp)$/.test(String(nazwa))) return null;
        const p = path.join(KS, id, nazwa);
        return fsSync.existsSync(p) ? p : null;
    }

    function publikuj({ book, rentalTier = 'rental_48h', cenaEur = DOMYSLNA_CENA_EUR, pieczec = null } = {}) {
        return poKolei(async () => {
            const wpis = sprawdzKsiege(book, { tier: rentalTier, cenaEur });
            const id = idKsiegi(book.id || book.title);
            await fs.mkdir(KS, { recursive: true });
            book = await przeniesObrazy(id, book);
            await zapisz(path.join(KS, `${id}.json`), book);
            const k = await czytaj(KAT, { ksiegi: [] });
            const stary = k.ksiegi.find((x) => x.id === id);
            const nowy = { id, ...wpis, okladka: await okladka(id, book), pieczec: pieczec ? tekst(pieczec, 120) : null,
                wystawiona: stary?.wystawiona ?? true, opublikowano: stary?.opublikowano ?? new Date(teraz()).toISOString(), zmieniono: new Date(teraz()).toISOString() };
            k.ksiegi = [nowy, ...k.ksiegi.filter((x) => x.id !== id)].slice(0, 500);
            await zapisz(KAT, k);
            return nowy;
        });
    }
    const ustawWystawienie = (id, tak) => poKolei(async () => {
        const k = await czytaj(KAT, { ksiegi: [] });
        const x = k.ksiegi.find((q) => q.id === id);
        if (!x) throw Object.assign(new Error('Nie ma takiej księgi.'), { kod: 404 });
        x.wystawiona = !!tak; await zapisz(KAT, k); return x;
    });
    const katalogPelny = async () => (await czytaj(KAT, { ksiegi: [] })).ksiegi;
    /** Publiczny katalog: tylko wystawione, bez ścieżek z dysku. */
    async function katalogPubliczny() {
        return (await katalogPelny()).filter((k) => k.wystawiona).map(({ okladka: o, bajtow: _b, wystawiona: _w, ...k }) => ({
            ...k, okladka: o?.startsWith('plik:') ? `/wizytowka/teostory/${k.id}/okladka` : o ?? null, godzinWypozyczenia: k.tier === 'demo' ? null : GODZIN_WYPOZYCZENIA,
        }));
    }
    async function plikOkladki(id) {
        const k = (await katalogPelny()).find((x) => x.id === id && x.wystawiona);
        if (!k?.okladka?.startsWith('plik:')) return null;
        const p = path.join(KS, `${id}-okladka.${k.okladka.slice(5)}`);
        return fsSync.existsSync(p) ? p : null;
    }

    async function wypozycz(id, { powrot = null } = {}) {
        const k = (await katalogPelny()).find((x) => x.id === id && x.wystawiona);
        if (!k) throw Object.assign(new Error('Tej księgi nie ma w wypożyczalni.'), { kod: 404 });
        if (k.tier === 'demo') return { darmowa: true };
        if (!stripe) throw Object.assign(new Error('Katedra nie przyjmuje teraz płatności.'), { kod: 503 });
        const s = await stripe.sesjaZakupu({ pakiet: { id: k.id, nazwa: `📚 ${k.tytul} — wypożyczenie ${GODZIN_WYPOZYCZENIA} h`, opis: k.opis || k.podtytul || 'Żywa Księga teostory.studio' },
            kwotaCentow: Math.round(k.cenaEur * 100), waluta: 'eur', powrot: await adres(), anuluj: dozwolonyPowrot(powrot),
            sukces: '/wizytowka/teostory/odbior', rodzaj: 'ksiega-48h', metadane: { powrot: dozwolonyPowrot(powrot) ?? '' } });
        return { url: s.url };
    }

    /** Opłacona sesja → wypożyczenie (start przy pierwszym odbiorze) → {ksiega, do, powrot}. Rzuca z powodem. */
    async function odbierz(sesja) {
        if (!stripe) throw Object.assign(new Error('Katedra nie przyjmuje teraz płatności.'), { kod: 503 });
        const s = await stripe.sprawdzSesje(String(sesja ?? ''));
        if (!s.oplacona) throw Object.assign(new Error('Płatność jeszcze nie przeszła.'), { kod: 402 });
        if (s.rodzaj !== 'ksiega-48h' || !s.pakiet) throw Object.assign(new Error('To nie jest wypożyczenie księgi.'), { kod: 400 });
        const w = await poKolei(async () => {
            const d = await czytaj(WYP, { wypozyczenia: [] });
            let x = d.wypozyczenia.find((q) => q.sesja === s.id);
            if (!x) { x = { sesja: s.id, ksiega: s.pakiet, od: new Date(teraz()).toISOString(), kwota: s.kwota, waluta: s.waluta, tryb: s.tryb }; d.wypozyczenia = [x, ...d.wypozyczenia].slice(0, 5000); await zapisz(WYP, d); }
            return x;
        });
        return { ksiega: w.ksiega, do: new Date(Date.parse(w.od) + GODZIN_WYPOZYCZENIA * 3600e3).toISOString(), powrot: dozwolonyPowrot(s.powrot) };
    }

    /** Pełna księga do czytania: demo bez niczego, wypożyczenie = opłacona sesja tej księgi w ciągu 48 h. */
    async function czytaj_(id, { sesja = null } = {}) {
        const k = (await katalogPelny()).find((x) => x.id === id && x.wystawiona);
        if (!k) throw Object.assign(new Error('Tej księgi nie ma w wypożyczalni.'), { kod: 404 });
        let doKiedy = null;
        if (k.tier !== 'demo') {
            if (!sesja) throw Object.assign(new Error('Ta księga jest do wypożyczenia — najpierw płatność.'), { kod: 402 });
            const o = await odbierz(sesja);
            if (o.ksiega !== id) throw Object.assign(new Error('To wypożyczenie dotyczy innej księgi.'), { kod: 403 });
            if (Date.parse(o.do) < teraz()) throw Object.assign(new Error(`Wypożyczenie wygasło (${GODZIN_WYPOZYCZENIA} h minęło).`), { kod: 410 });
            doKiedy = o.do;
        }
        const p = plikKsiegi(id);
        const book = p ? await czytaj(p, null) : null;
        if (!book) throw Object.assign(new Error('Księgi nie ma na dysku Katedry.'), { kod: 404 });
        return { ksiega: book, dostepDo: doKiedy };
    }

    // ── 🌍 Przekład, 🎨 ilustracje Palety, 🎵 podkład — prace w tle (jedna naraz na księgę), stan w pamięci ──
    const prace = new Map();
    const stanPracy = (id) => prace.get(id) ?? null;
    function wTle(id, rodzaj, fn) {
        const b = prace.get(id);
        if (b && b.stan === 'robi') throw Object.assign(new Error(`Księga już pracuje (${b.rodzaj}) — poczekaj.`), { kod: 409 });
        const p = { rodzaj, stan: 'robi', postep: 0, z: 0, od: new Date(teraz()).toISOString(), blad: null, uwagi: [] };
        prace.set(id, p);
        Promise.resolve().then(() => fn(p)).then(() => { p.stan = 'gotowe'; }, (e) => { p.stan = 'blad'; p.blad = String(e?.message || e).slice(0, 400); });
        return p;
    }
    /** Zapis księgi + odświeżenie wpisu katalogu (języki, tytuły przekładów, okładka) — po kolei z publikacjami. */
    const zapiszKsiege = (id, zmien) => poKolei(async () => {
        const p = plikKsiegi(id); const book = p ? await czytaj(p, null) : null;
        if (!book) throw Object.assign(new Error('Księgi nie ma na dysku Katedry.'), { kod: 404 });
        const nowa = await zmien(book);
        await zapisz(p, nowa);
        const k = await czytaj(KAT, { ksiegi: [] });
        const x = k.ksiegi.find((q) => q.id === id);
        if (x) { const w = sprawdzKsiege(nowa, { tier: x.tier, cenaEur: x.cenaEur || DOMYSLNA_CENA_EUR }); Object.assign(x, { kwestii: w.kwestii, jezyk: w.jezyk, jezyki: w.jezyki, przeklady: w.przeklady, muzyka: w.muzyka, okladka: (await okladka(id, nowa)) ?? x.okladka, zmieniono: new Date(teraz()).toISOString() }); await zapisz(KAT, k); }
        return nowa;
    });

    /** 🌍 Przekład księgi na język z listy: strona po stronie modelem Katedry, każda sprawdzona (jedna poprawka z powodem). */
    async function przeloz(id, jezyk) {
        if (!pisz) throw new Error('Tłumacz ksiąg niedostępny (brak modelu).');
        if (!JEZYKI_KSIAG[jezyk]) throw new Error(`Język: ${Object.keys(JEZYKI_KSIAG).join(', ')}.`);
        const p = plikKsiegi(id); const book = p ? await czytaj(p, null) : null;
        if (!book) throw Object.assign(new Error('Księgi nie ma na dysku Katedry.'), { kod: 404 });
        const zrodlowy = JEZYKI_KSIAG[String(book.language ?? '').slice(0, 2)] ?? 'the source language';
        if (String(book.language ?? '').slice(0, 2) === jezyk) throw new Error('To jest język oryginału.');
        const cel = JEZYKI_KSIAG[jezyk];
        const system = `You are a literary translator of illustrated audio storybooks. Translate from ${zrodlowy} into ${cel}. Keep the meaning, tone, rhythm and warmth; write natural, publishable ${cel} prose, never word-by-word. Keep proper names unchanged (Teterhia, TeOgochi, 0.00G, Katedra OtakOS, Iskra, Echo, Mira and other character names). Use the quotation marks customary in ${cel}. Answer ONLY with a JSON object with exactly the same keys; "lines" must have exactly the same number of items in the same order.`;
        return wTle(id, `przekład ${jezyk}`, async (praca) => {
            const kawalki = (book.pages ?? []).map(stronaDoPrzekladu);
            praca.z = kawalki.length + 1;
            const glowa = sprawdzPrzekladStrony({ chapterTitle: book.title ?? '', imageCaption: book.subtitle ?? '', narrativeText: '', lines: [] },
                await pisz(system, JSON.stringify({ chapterTitle: book.title ?? '', imageCaption: book.subtitle ?? '', narrativeText: '', lines: [] })));
            praca.postep = 1;
            const strony = [];
            for (const k of kawalki) {
                let wynik = null, powod = '';
                for (let proba = 0; proba < 2 && !wynik; proba++) {
                    try { wynik = sprawdzPrzekladStrony(k, await pisz(system, JSON.stringify(k) + (powod ? `\n\nThe previous answer was rejected: ${powod}. Fix it.` : ''))); }
                    catch (e) { powod = String(e.message || e).slice(0, 200); }
                }
                if (!wynik) throw new Error(`Strona ${strony.length + 1}: ${powod}`);
                strony.push(wynik);
                praca.postep++;
            }
            await zapiszKsiege(id, async (b) => ({ ...b, translations: { ...(b.translations ?? {}), [jezyk]: {
                title: glowa.chapterTitle || b.title, subtitle: glowa.imageCaption, przelozono: new Date(teraz()).toISOString(), automatycznie: true,
                pages: strony.map((s) => ({ chapterTitle: s.chapterTitle, imageCaption: s.imageCaption, narrativeText: s.narrativeText, dialogueLines: s.lines.map((text) => ({ text })) })),
            } } }));
        });
    }

    /** 🎨 Ilustracje Palety: każda strona bez obrazu (albo wszystkie z `nadpisz`) dostaje malowany kadr FLUX z opisu sceny. */
    async function ilustruj(id, { nadpisz = false, ile = 300 } = {}) {
        if (!rysuj) throw new Error('Paleta (FLUX) niedostępna.');
        const p = plikKsiegi(id); const book = p ? await czytaj(p, null) : null;
        if (!book) throw Object.assign(new Error('Księgi nie ma na dysku Katedry.'), { kod: 404 });
        const doZrobienia = (book.pages ?? []).map((s, i) => ({ s, i })).filter(({ s }) => nadpisz || !s?.imageUrl).slice(0, ile);
        if (!doZrobienia.length) throw new Error('Każda strona ma już ilustrację (nadpisz: true = narysuj od nowa).');
        return wTle(id, 'ilustracje', async (praca) => {
            praca.z = doZrobienia.length;
            const kat = path.join(KS, id); await fs.mkdir(kat, { recursive: true });
            for (const { s, i } of doZrobienia) {
                let scena = [s?.imageCaption, s?.chapterTitle].filter(Boolean).join(' — ');
                if (pisz) {   // opis kadru po angielsku z treści strony (FLUX rozumie angielski), bez modelu = sam podpis sceny
                    try {
                        const o = await pisz('You write one short English prompt (max 60 words) for a painted storybook illustration of this page: setting, light, mood, characters as secular cinematic figures (no halos, no crosses, no church interiors). Answer ONLY JSON {"prompt": "..."}.',
                            JSON.stringify({ book: book.title, chapter: s?.chapterTitle ?? '', caption: s?.imageCaption ?? '', text: String(s?.narrativeText ?? '').slice(0, 600) }));
                        const m = /\{[\s\S]*\}/.exec(String(o)); const pr = m ? String(JSON.parse(m[0]).prompt ?? '').trim() : '';
                        if (pr.length >= 15) scena = pr.slice(0, 600);
                    } catch (e) { praca.uwagi.push(`strona ${i + 1}: opis kadru z podpisu (${String(e.message || e).slice(0, 80)})`); }
                }
                const plik = await rysuj({ prompt: `${scena}. ${STYL_ILUSTRACJI_KSIEGI}`, szer: 1280, wys: 720 });
                let n = 0; for (const f of await fs.readdir(kat)) { const m = /^obraz-(\d+)\./.exec(f); if (m) n = Math.max(n, Number(m[1])); }
                const nazwa = `obraz-${n + 1}${path.extname(plik) || '.png'}`;
                await fs.copyFile(plik, path.join(kat, nazwa));
                await zapiszKsiege(id, async (b) => { const pages = [...b.pages]; pages[i] = { ...pages[i], imageUrl: `/wizytowka/teostory/${id}/obraz/${nazwa}` }; return { ...b, pages }; });
                praca.postep++;
            }
        });
    }

    /** 🎵 Podkład księgi z biblioteki Katedry (_OtakOs_Muzyka, mp3) — np. aranż Joanny. */
    async function ustawMuzyke(id, { plik, tytul = null, autor = null } = {}) {
        const lok = muzykaLokalna(String(plik ?? ''));
        if (!lok || !/\.mp3$/i.test(lok)) throw new Error('Podkład: plik mp3 z biblioteki muzyki Katedry.');
        await fs.mkdir(path.join(KS, id), { recursive: true });
        await fs.copyFile(lok, path.join(KS, id, 'muzyka.mp3'));
        return zapiszKsiege(id, async (b) => ({ ...b, musicUrl: `/wizytowka/teostory/${id}/audio/muzyka.mp3`, music: { title: tekst(tytul, 120) || path.basename(lok, '.mp3'), author: tekst(autor, 120) || null } })).then((b) => ({ musicUrl: b.musicUrl, music: b.music }));
    }

    return { plikObrazu, plikDzwieku, publikuj, przeloz, ilustruj, ustawMuzyke, stanPracy, wystaw: (id) => ustawWystawienie(id, true), wycofaj: (id) => ustawWystawienie(id, false), katalogPelny, katalogPubliczny, plikOkladki, wypozycz, odbierz, czytaj: czytaj_,
        wypozyczenia: async () => (await czytaj(WYP, { wypozyczenia: [] })).wypozyczenia };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Trasy: Hub (Straż `/api/books`: maszyna) i publiczne `/wizytowka/teostory/…` (Straż: SCIEZKA_TEOSTORY / SCIEZKA_WYPOZYCZENIA). */
export function zamontujTrasyWypozyczalni(app, W, { limitNaMinute = 10, federacja = null, nick = async () => null } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    const cors = (res) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Access-Control-Allow-Headers', 'Content-Type'); res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); };
    // Hub
    app.get('/api/books/catalog', (_req, res) => odp(res, W.katalogPelny().then((ksiegi) => ({ ksiegi }))));
    app.post('/api/books/publish', (req, res) => odp(res, W.publikuj(req.body ?? {}).then((wpis) => ({ wpis }))));
    app.post('/api/books/:id/wystaw', (req, res) => odp(res, W.wystaw(req.params.id).then((wpis) => ({ wpis }))));
    app.post('/api/books/:id/wycofaj', (req, res) => odp(res, W.wycofaj(req.params.id).then((wpis) => ({ wpis }))));
    app.post('/api/books/rent', (req, res) => odp(res, W.wypozycz(String(req.body?.id ?? ''), { powrot: req.body?.powrot })));
    app.get('/api/books/rentals', (_req, res) => odp(res, W.wypozyczenia().then((wypozyczenia) => ({ wypozyczenia }))));
    // 🌍 przekład (PL/EN/DE), 🎨 ilustracje Palety, 🎵 podkład — prace w tle; stan: GET /api/books/:id/praca
    app.post('/api/books/:id/przeloz', (req, res) => odp(res, (async () => {
        const jezyki = (Array.isArray(req.body?.jezyki) ? req.body.jezyki : [req.body?.jezyk]).filter(Boolean);
        if (jezyki.length !== 1) throw new Error('Jeden język na raz: {"jezyk": "de"} (pl, en, de).');
        return { praca: await W.przeloz(req.params.id, String(jezyki[0])) };
    })()));
    app.post('/api/books/:id/ilustruj', (req, res) => odp(res, W.ilustruj(req.params.id, { nadpisz: req.body?.nadpisz === true, ile: Number(req.body?.ile) || 300 }).then((praca) => ({ praca }))));
    app.post('/api/books/:id/muzyka', (req, res) => odp(res, W.ustawMuzyke(req.params.id, req.body ?? {})));
    app.get('/api/books/:id/praca', (req, res) => res.json({ success: true, praca: W.stanPracy(req.params.id) }));
    // Publiczne (portal teostory.studio przez tunel Katedry)
    const proby = new Map();
    // 📚🏛️ katalog wydawcy = własne + przyjęte z innych Katedr (`katedra {nick, adres}`); `?tylko=moje` = tylko własne (weryfikacja wydawcy)
    app.get('/wizytowka/teostory', (req, res) => {
        cors(res);
        odp(res, (async () => {
            const wlasne = (await W.katalogPubliczny()).map((k) => ({ ...k, katedra: null }));
            const obce = req.query.tylko === 'moje' || !federacja ? [] : await federacja().catch(() => []);
            return { ksiegi: [...wlasne, ...obce], wydawca: { nick: await nick().catch(() => null) } };
        })());
    });
    app.get('/wizytowka/teostory/:id/obraz/:plik', async (req, res) => {
        cors(res);
        const k = (await W.katalogPubliczny()).find((x) => x.id === req.params.id);
        const p = k ? W.plikObrazu(req.params.id, req.params.plik) : null;
        return p ? res.sendFile(p) : res.status(404).end();
    });
    // 🎙️ dźwięk strony: demo za darmo, wypożyczenie = ta sama opłacona sesja co czytanie (audiobook nie wycieka za darmo)
    app.get('/wizytowka/teostory/:id/audio/:plik', async (req, res) => {
        cors(res);
        try {
            await W.czytaj(req.params.id, { sesja: req.query.sesja ? String(req.query.sesja) : null });
            const p = W.plikDzwieku(req.params.id, req.params.plik);
            return p ? res.sendFile(p) : res.status(404).end();
        } catch (e) { return res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }); }
    });
    app.get('/wizytowka/teostory/:id/okladka', async (req, res) => { const p = await W.plikOkladki(req.params.id); return p ? res.sendFile(p) : res.status(404).end(); });
    app.get('/wizytowka/teostory/:id/czytaj', (req, res) => { cors(res); odp(res, W.czytaj(req.params.id, { sesja: req.query.sesja ? String(req.query.sesja) : null })); });
    app.options('/wizytowka/teostory/:id/wypozycz', (_req, res) => { cors(res); res.sendStatus(204); });
    app.post('/wizytowka/teostory/:id/wypozycz', (req, res) => {
        cors(res);
        const ip = req.ip || '?', t = Date.now(), l = (proby.get(ip) ?? []).filter((x) => t - x < 60_000);
        if (l.length >= limitNaMinute) return res.status(429).json({ success: false, message: 'Za dużo prób — spróbuj za minutę.' });
        proby.set(ip, [...l, t]);
        return odp(res, W.wypozycz(req.params.id, { powrot: req.body?.powrot }));
    });
    app.get('/wizytowka/teostory/odbior', async (req, res) => {
        try {
            const o = await W.odbierz(String(req.query.sesja ?? ''));
            const n = await nick().catch(() => null);   // portal wydawcy rozpozna, z której Katedry wraca wypożyczenie
            if (o.powrot) return res.redirect(302, `${o.powrot}?ksiega=${encodeURIComponent(o.ksiega)}&sesja=${encodeURIComponent(String(req.query.sesja))}${n ? `&katedra=${encodeURIComponent(n)}` : ''}`);
            return res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Wypożyczone</title><body style="font-family:Georgia;background:#F6F2EA;padding:40px"><h1>📚 Wypożyczone na ${GODZIN_WYPOZYCZENIA} h</h1><p>Dostęp do: ${esc(o.do)}. Wróć do teostory.studio — księga czeka na Twojej półce.</p></body>`);
        } catch (e) { return res.status(typeof e.kod === 'number' ? e.kod : 400).type('html').send(`<!doctype html><meta charset="utf-8"><body style="font-family:Georgia;padding:40px"><h1>Nie rozpoznaję tej płatności</h1><p>${esc(e.message)}</p></body>`); }
    });
}

export default { utworzWypozyczalnie, zamontujTrasyWypozyczalni, sprawdzKsiege, idKsiegi, dozwolonyPowrot, TIERY, JEZYKI_KSIAG, liczKwestie, przekladyKsiegi, sprawdzPrzekladStrony };
