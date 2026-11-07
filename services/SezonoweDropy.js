/**
 * 🗓️ Sezonowe dropy 0.00G Style (2026-11-07: „TeOgochi mogą wymyślać sezonowe i okazjonalne linie… osobne CSV do Shopify”).
 *
 * Źródło = żywe produkty Stołu Produktowego (paczka TeO Fashion Studio po QC). Drop NIE rysuje nowej grafiki (nową grafikę
 * robi „Uszyj” w Fashion) — to edycja sezonowa tego samego produktu:
 *   • 6 dropów tematycznych (swieta, sylwester, walentynki, wiosna, lato, zima): fasony pasujące do okazji, NOWE produkty
 *     `<handle>-<sezon>` z tytułem i opowieścią edycji, które pisze Kronikarz (model przydziału, JSON, tylko z faktów
 *     produktu — imię postaci, opowieść bazowa, fason; bez cen, dat i obietnic), tagi `0.00G Style, Seasonal, <Nazwa>_Drop`.
 *   • black-friday: te SAME handle co produkt bazowy (import z „nadpisz istniejące” = promocja na istniejącym produkcie),
 *     `Variant Compare At Price` = cena bazowa, `Variant Price` = cena po rabacie (10–50 %, domyślnie 20 %). Bez modelu.
 *     Po promocji wraca się importem `shopify-import.csv` (cena bazowa, Compare At pusty).
 * Pliki: `_OtakOs_Wymiar/sklep-shopify/sezonowe/shopify-import-<sezon>.csv` + `teksty-<sezon>.json` (opowieści — po
 * synchronizacji CSV pisze się od nowa bez modelu, martwe produkty wypadają) + CZYTAJ.txt. Nic nie idzie do Shopify samo.
 * Wolny cykl: raz na dobę, gdy okno okazji zaczyna się w ciągu 30 dni, a dropu nie ma — przygotowuje go i daje znać
 * (`OTAKOS_SEZONOWE_AUTO=0` wyłącza).
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { wierszCsv, ROZMIARY } from './StolProduktowy.js';

const D = (r, m, d) => Date.UTC(r, m - 1, d);
/** 4. czwartek listopada (Thanksgiving) + 1 dzień. */
export function blackFriday(rok) { const pierwszy = new Date(D(rok, 11, 1)).getUTCDay(); const czw = 1 + ((4 - pierwszy + 7) % 7) + 21; return D(rok, 11, czw + 1); }

export const SEZONY = {
    swieta: { emoji: '🎄', nazwa: 'Święta', en: 'Christmas Edition', tag: 'Swieta_Drop', fasony: ['bluza', 'parka', 'kurtka', 'longsleeve'],
        motyw: 'Christmas and winter warmth in the 0.00G spirit: candlelight, snow, family gathered, gifts of light', okno: (r) => [D(r, 12, 1), D(r, 12, 26)] },
    sylwester: { emoji: '🥂', nazwa: 'Sylwester', en: "New Year's Eve Edition", tag: 'Sylwester_Drop', fasony: ['ramoneska', 'bomber', 'plaszcz'],
        motyw: "New Year's Eve: golden night, fireworks, a cyber-elegant evening, the first spark of a new year", okno: (r) => [D(r, 12, 27), D(r + 1, 1, 2)] },
    walentynki: { emoji: '❤️', nazwa: 'Walentynki', en: "Valentine's Edition", tag: 'Walentynki_Drop', fasony: ['koszulka', 'bluza', 'longsleeve', 'torba'],
        motyw: "Valentine's Day: closeness, two hearts of 0.00G, friendship and love between characters", okno: (r) => [D(r, 2, 1), D(r, 2, 14)] },
    'black-friday': { emoji: '🖤', nazwa: 'Black Friday', en: 'Black Friday', tag: 'Black_Friday_Drop', fasony: null, motyw: null,
        okno: (r) => { const bf = blackFriday(r); return [bf - 7 * 864e5, bf + 3 * 864e5]; } },
    wiosna: { emoji: '🌸', nazwa: 'Wiosna', en: 'Spring Edition', tag: 'Wiosna_Drop', fasony: ['plaszcz', 'jeansowa', 'bomber', 'longsleeve'],
        motyw: 'Spring awakening: first blossoms, fresh rain, light returning, new beginnings', okno: (r) => [D(r, 3, 20), D(r, 6, 20)] },
    lato: { emoji: '☀️', nazwa: 'Lato', en: 'Summer Edition', tag: 'Lato_Drop', fasony: ['koszulka', 'longsleeve', 'torba'],
        motyw: 'Summer: long golden evenings, sea and sun, festivals, freedom', okno: (r) => [D(r, 6, 21), D(r, 9, 22)] },
    zima: { emoji: '❄️', nazwa: 'Zima', en: 'Winter Edition', tag: 'Zima_Drop', fasony: ['parka', 'bluza', 'kurtka', 'plaszcz'],
        motyw: 'Winter: frost, quiet snowy forests, warmth kept inside, the inner flame', okno: (r) => [D(r, 12, 21), D(r + 1, 3, 19)] },
};
export const ID_SEZONOW = Object.keys(SEZONY);
const DOMYSLNY_RABAT = 20;

/** Najbliższe okno okazji (bieżące albo następne) od `teraz`. */
export function najblizszeOkno(id, teraz = Date.now()) {
    const s = SEZONY[id], r = new Date(teraz).getUTCFullYear();
    for (const rok of [r - 1, r, r + 1]) { const [od, doK] = s.okno(rok); if (doK + 864e5 > teraz) return { od: new Date(od).toISOString().slice(0, 10), do: new Date(doK).toISOString().slice(0, 10), dniDoStartu: Math.ceil((od - teraz) / 864e5) }; }
    return null;
}

const SYSTEM = (s) => `You are the Chronicler of the OtakOS Cathedral writing a SEASONAL EDITION of existing 0.00G Style apparel (same artwork, new seasonal story).
Season theme: ${s.motyw}. Edition name: "${s.en}".
For EACH product write: "tytul" — a short edition title (max 40 characters, English, no character name, no product type), "opis" — 2–3 English sentences connecting the character's story to the season.
Rules: use only facts given (character name, its story, garment). No prices, discounts, dates, delivery promises or other brands. Warm, poetic, concise.
Answer ONLY JSON: {"produkty":{"<handle>":{"tytul":"…","opis":"…"}}}`;

/** Odpowiedź Kronikarza → {handle: {tytul, opis}} dla dokładnie podanych handle'i albo błąd z powodem. */
export function odczytajTeksty(t, handles) {
    const s = String(t ?? '').replace(/<think>[\s\S]*?<\/think>/g, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    let j; try { j = JSON.parse(s.slice(a, b + 1)); } catch { throw new Error('to nie był JSON'); }
    const out = {};
    for (const h of handles) {
        const x = j?.produkty?.[h];
        const tytul = String(x?.tytul ?? '').replace(/\s+/g, ' ').trim().slice(0, 40), opis = String(x?.opis ?? '').replace(/\s+/g, ' ').trim().slice(0, 600);
        if (!tytul || opis.length < 20) throw new Error(`brak tytułu albo opisu dla ${h}`);
        if (/[€$£]|\d+\s*(%|eur|usd)/i.test(`${tytul} ${opis}`)) throw new Error(`ceny lub rabaty w tekście ${h}`);
        out[h] = { tytul, opis };
    }
    return out;
}
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const bezHtml = (h) => String(h ?? '').replace(/<\/p>\s*/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/**
 * @param {{ katalog: string, stol: { lista: () => Promise<{postacie: any[]}> }, pisz?: (system:string, prompt:string) => Promise<string>,
 *   teraz?: () => number, szyna?: object }} o   katalog = `_OtakOs_Wymiar/sklep-shopify`
 */
export function utworzSezonoweDropy({ katalog, stol, pisz = null, teraz = () => Date.now(), szyna = null }) {
    const KAT = path.join(katalog, 'sezonowe');
    const blad = (m, kod = 400) => Object.assign(new Error(m), { kod });
    const plikTekstow = (id) => path.join(KAT, `teksty-${id}.json`);
    const plikCsv = (id) => path.join(KAT, `shopify-import-${id}.csv`);
    const czytaj = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
    const sezon = (id) => { const s = SEZONY[id]; if (!s) throw blad(`Sezon: ${ID_SEZONOW.join(', ')}.`); return s; };
    const wiesc = (tresc) => szyna?.nadaj?.({ agent: 'kronikarz', rodzaj: 'praca', tresc })?.catch?.(() => {});

    async function produktySezonu(id) {
        const s = sezon(id);
        const { postacie } = await stol.lista();
        return postacie.flatMap((p) => p.produkty).filter((x) => x.gotowy && (!s.fasony || s.fasony.some((f) => x.model.includes(`-${FASON_EN[f]}-`))));
    }

    /** CSV dropu z zapisanych tekstów (bez modelu). Produkty bez tekstu → `bezTekstu`. */
    async function zapiszCsv(id, { rabat } = {}) {
        const s = sezon(id), produkty = await produktySezonu(id);
        const t = await czytaj(plikTekstow(id), { produkty: {}, rabat: DOMYSLNY_RABAT });
        const r = Math.max(10, Math.min(50, Number(rabat ?? t.rabat ?? DOMYSLNY_RABAT)));
        const kol = ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published', 'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Price', 'Variant Compare At Price',
            'Variant Requires Shipping', 'Variant Taxable', 'Variant Inventory Policy', 'Variant Fulfillment Service', 'Gift Card', 'Status'];
        const linie = [wierszCsv(kol)];
        const bezTekstu = [];
        let ile = 0;
        for (const x of produkty) {
            const bf = id === 'black-friday';
            const tx = bf ? null : t.produkty[x.model];
            if (!bf && !tx) { bezTekstu.push(x.model); continue; }
            ile++;
            const handle = bf ? x.model : `${x.model}-${id}`;
            const tytul = bf ? x.tytul : `${x.postac.charAt(0).toUpperCase()}${x.postac.slice(1)} — ${tx.tytul} · ${x.typ}`;
            const opis = bf ? x.opisHtml : `<p><strong>${esc(s.en)}</strong> — ${esc(tx.tytul)}</p><p>${esc(tx.opis)}</p>${x.opisHtml}`;
            const tagi = [...String(x.tagi).split(',').map((q) => q.trim()).filter(Boolean), 'Seasonal', s.tag].filter((q, i, a) => a.indexOf(q) === i).join(', ');
            const cena = bf ? Math.round(x.cenaEur * (100 - r)) / 100 : x.cenaEur;
            const opcja = x.opcja ?? { nazwa: 'Size', wartosci: ROZMIARY };
            opcja.wartosci.forEach((roz, i) => linie.push(wierszCsv([handle, i ? '' : tytul, i ? '' : opis, i ? '' : x.dostawca, i ? '' : x.typ, i ? '' : tagi, i ? '' : 'FALSE', opcja.nazwa, roz,
                `${handle.toUpperCase()}-${roz.replace(/\s+/g, '-').toUpperCase()}`, cena.toFixed(2), bf ? x.cenaEur.toFixed(2) : '', 'TRUE', 'TRUE', 'continue', 'manual', i ? '' : 'FALSE', i ? '' : 'draft'])));
        }
        await fs.mkdir(KAT, { recursive: true });
        await fs.writeFile(plikCsv(id), `﻿${linie.join('\n')}\n`, 'utf8');
        await fs.writeFile(path.join(KAT, 'CZYTAJ.txt'), CZYTAJ, 'utf8');
        if (id === 'black-friday') await fs.writeFile(plikTekstow(id), JSON.stringify({ ...t, rabat: r, kiedy: new Date(teraz()).toISOString() }, null, 1));
        return { sezon: id, plik: `sezonowe/${path.basename(plikCsv(id))}`, produktow: ile, bezTekstu, ...(id === 'black-friday' ? { rabat: r } : {}) };
    }

    /** Przygotowanie dropu: Kronikarz pisze edycję dla produktów bez tekstu (po postaci, JSON, jedna poprawka), potem CSV. */
    async function przygotuj(id, { rabat, odNowa = false } = {}) {
        const s = sezon(id);
        if (id === 'black-friday') return zapiszCsv(id, { rabat });
        const produkty = await produktySezonu(id);
        if (!produkty.length) throw blad(`Nie ma gotowych produktów w fasonach dropu ${s.nazwa} (${s.fasony.join(', ')}).`);
        const t = await czytaj(plikTekstow(id), { produkty: {} });
        const brak = produkty.filter((x) => odNowa || !t.produkty[x.model]);
        if (brak.length && !pisz) throw blad('Kronikarz (model) niedostępny — nie ma kto napisać edycji.');
        const zPostaci = new Map();
        for (const x of brak) zPostaci.set(x.postac, [...(zPostaci.get(x.postac) ?? []), x]);
        for (const [postac, lista] of zPostaci) {
            let prompt = `Character: ${postac}\nProducts:\n${lista.map((x) => `- handle: ${x.model}\n  garment: ${x.typ}\n  base title: ${x.tytul}\n  base story: ${bezHtml(x.opisHtml).slice(0, 500)}`).join('\n')}`;
            let wynik = null, powod = null;
            for (let proba = 0; proba < 2 && !wynik; proba++) {
                try { wynik = odczytajTeksty(await pisz(SYSTEM(s), prompt), lista.map((x) => x.model)); }
                catch (e) { powod = e.message; prompt += `\n\nYOUR PREVIOUS ANSWER WAS REJECTED: ${powod}. Answer with the JSON only.`; }
            }
            if (!wynik) throw blad(`Kronikarz dwa razy nie oddał edycji ${s.nazwa} dla ${postac} (${powod}).`, 502);
            for (const [h, v] of Object.entries(wynik)) t.produkty[h] = { ...v, kiedy: new Date(teraz()).toISOString() };
            await fs.mkdir(KAT, { recursive: true });
            await fs.writeFile(plikTekstow(id), JSON.stringify(t, null, 1));
        }
        const w = await zapiszCsv(id);
        wiesc(`${s.emoji} Drop ${s.nazwa}: ${w.produktow} produktów gotowych do importu (sklep-shopify/${w.plik}).`);
        return w;
    }

    /** Po synchronizacji Stołu: każdy istniejący drop od nowa z zapisanych tekstów (martwe produkty wypadają). */
    async function odswiezIstniejace() {
        const out = [];
        for (const id of ID_SEZONOW) if (fsSync.existsSync(plikCsv(id))) out.push(await zapiszCsv(id));
        return out;
    }

    async function stan() {
        const out = [];
        for (const id of ID_SEZONOW) {
            const s = SEZONY[id], produkty = await produktySezonu(id).catch(() => []);
            const t = await czytaj(plikTekstow(id), { produkty: {} });
            out.push({ id, emoji: s.emoji, nazwa: s.nazwa, tag: s.tag, fasony: s.fasony, okno: najblizszeOkno(id, teraz()), produktow: produkty.length,
                zTekstem: produkty.filter((x) => id === 'black-friday' || t.produkty[x.model]).length, rabat: id === 'black-friday' ? (t.rabat ?? DOMYSLNY_RABAT) : null,
                csv: fsSync.existsSync(plikCsv(id)) ? `sezonowe/${path.basename(plikCsv(id))}` : null,
                przyklad: produkty.map((x) => t.produkty[x.model] && { model: x.model, ...t.produkty[x.model] }).find(Boolean) ?? null });
        }
        return { sezony: out };
    }

    /** Wolny cykl: okazje zaczynające się w ciągu 30 dni (albo trwające), bez CSV → przygotuj. */
    async function cykl() {
        const zrobione = [];
        for (const id of ID_SEZONOW) {
            const o = najblizszeOkno(id, teraz());
            if (!o || o.dniDoStartu > 30 || fsSync.existsSync(plikCsv(id))) continue;
            try { zrobione.push(await przygotuj(id)); } catch (e) { zrobione.push({ sezon: id, blad: e.message }); }
        }
        return zrobione;
    }

    return { stan, przygotuj, zapiszCsv, odswiezIstniejace, cykl, plikCsv };
}

const FASON_EN = { koszulka: 't-shirt', bluza: 'hoodie', longsleeve: 'longsleeve', torba: 'tote-bag', bomber: 'bomber-jacket', jeansowa: 'denim-jacket', ramoneska: 'leather-biker-jacket', parka: 'hooded-parka', plaszcz: 'trench-coat', kurtka: 'varsity-jacket' };

const CZYTAJ = `Sezonowe dropy 0.00G Style — pliki do importu w Shopify (Products → Import).

• shopify-import-<sezon>.csv (święta, sylwester, walentynki, wiosna, lato, zima) = NOWE produkty „<handle>-<sezon>”:
  ta sama grafika co produkt bazowy, tytuł i opowieść edycji (Kronikarz), tagi „Seasonal” i „<Nazwa>_Drop” —
  w Shopify zrób kolekcję automatyczną: warunek „Tag produktu = Swieta_Drop” (itd.).
  Zdjęcia: podglad-przod.png i podglad-tyl.png z folderu 1-DO-SKLEPU-SHOPIFY produktu bazowego.
  Druk: te same pliki 2-DO-DRUKARNI-300DPI co produkt bazowy.
• shopify-import-black-friday.csv = TE SAME handle co produkty bazowe: zaznacz „Overwrite products with matching handles”.
  Variant Compare At Price = cena bazowa (przekreślona), Variant Price = cena po rabacie.
  Po promocji zaimportuj z nadpisaniem ../shopify-import.csv — cena wraca, przekreślenie znika.
• Wszystko wchodzi jako SZKIC (draft) — sprawdzasz i publikujesz sam.
`;

export function zamontujTrasySezonowych(app, S) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    app.get('/api/stol-produktowy/sezonowe', (_req, res) => odp(res, S.stan()));
    app.post('/api/stol-produktowy/sezonowe/:sezon', (req, res) => odp(res, S.przygotuj(req.params.sezon, req.body ?? {})));
    app.get('/api/stol-produktowy/sezonowe/:sezon/csv', async (req, res) => {
        if (!SEZONY[req.params.sezon]) return res.status(404).end();
        const p = S.plikCsv(req.params.sezon);
        return fsSync.existsSync(p) ? res.download(p) : res.status(404).end();
    });
}

export default { utworzSezonoweDropy, zamontujTrasySezonowych, SEZONY, najblizszeOkno, blackFriday, odczytajTeksty };
