/**
 * 🛍️ Stół Produktowy (2026-11-07: „w Shopify przez przypadek wrzucałem pliki stref jako Digital product… nie miałem widoku,
 * z którego jednym kliknięciem wybiorę gotowy produkt z Fashion i przygotuję paczkę”).
 *
 * Źródło = paczka sklepu TeO Fashion Studio (`public/nadruki/sklep/<postać>/`: `produkty.csv` + katalog każdego modelu
 * z makietami `podglad-*.png`, plikami `druk-*-300dpi.png` po QC szwalni i `WYMIARY-DRUKU.txt`). Nic tu nie rysuje
 * i niczego nie wysyła do Shopify — rozdziela pliki na DWA odbiorców:
 *   `_OtakOs_Wymiar/sklep-shopify/<postać>/<model>/1-DO-SKLEPU-SHOPIFY/`  makiety przód/tył + WKLEJ-DO-SHOPIFY.txt
 *   `_OtakOs_Wymiar/sklep-shopify/<postać>/<model>/2-DO-DRUKARNI-300DPI/` druk-*-300dpi.png + WYMIARY-DRUKU.txt
 * oraz `_OtakOs_Wymiar/sklep-shopify/shopify-import.csv` — wszystkie wysłane produkty jako produkty FIZYCZNE
 * (wymaga wysyłki), szkice (`draft`), rozmiary S–XXL; zdjęcia CSV-em nie wejdą bez publicznego adresu — wgrywa się je
 * z folderu 1-DO-SKLEPU-SHOPIFY. `strefa-*.png` (4096 px, robocze) i `arkusz.png` nie idą ani do sklepu, ani do drukarni.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

const POSTAC = /^[a-z0-9][a-z0-9-]{0,40}$/;
const MODEL = /^[a-z0-9][a-z0-9-]{2,80}$/;
export const ROZMIARY = ['S', 'M', 'L', 'XL', 'XXL'];
export const KOLUMNY_CSV = ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published', 'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Price',
    'Variant Requires Shipping', 'Variant Taxable', 'Variant Inventory Policy', 'Variant Fulfillment Service', 'Gift Card', 'Status'];

/** CSV (RFC 4180: cudzysłowy, przecinki i nowe linie w polach, BOM) → wiersze jako obiekty po nagłówku. */
export function czytajCsv(tekst) {
    const t = String(tekst ?? '').replace(/^﻿/, '');
    const wiersze = [];
    let pole = '', wiersz = [], wCudz = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (wCudz) {
            if (c === '"' && t[i + 1] === '"') { pole += '"'; i++; } else if (c === '"') wCudz = false; else pole += c;
        } else if (c === '"') wCudz = true;
        else if (c === ',') { wiersz.push(pole); pole = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; wiersz.push(pole); pole = ''; if (wiersz.some((x) => x !== '')) wiersze.push(wiersz); wiersz = []; }
        else pole += c;
    }
    if (pole !== '' || wiersz.length) { wiersz.push(pole); if (wiersz.some((x) => x !== '')) wiersze.push(wiersz); }
    const [glowa = [], ...reszta] = wiersze;
    return reszta.map((w) => Object.fromEntries(glowa.map((k, i) => [k, w[i] ?? ''])));
}
const poleCsv = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const wierszCsv = (pola) => pola.map(poleCsv).join(',');
const zHtml = (h) => String(h ?? '').replace(/<\/p>\s*/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();

/**
 * @param {{ katalogFashion: string, katalog: string, teraz?: () => number }} o
 *   katalogFashion = katalog TeO Fashion Studio, katalog = `_OtakOs_Wymiar/sklep-shopify`
 */
export function utworzStolProduktowy({ katalogFashion, katalog, teraz = () => Date.now() }) {
    const SKLEP = path.join(katalogFashion, 'public', 'nadruki', 'sklep');
    const blad = (m, kod = 400) => Object.assign(new Error(m), { kod });

    /** Produkty postaci z paczki Fashion: dane z produkty.csv (pierwszy wiersz handle'a) + pliki z katalogu modelu. */
    async function produktyPostaci(postac) {
        const kat = path.join(SKLEP, postac);
        let csv;
        try { csv = czytajCsv(await fs.readFile(path.join(kat, 'produkty.csv'), 'utf8')); } catch { return []; }
        const pierwsze = new Map(), ceny = new Map();
        for (const w of csv) {
            if (!w.Handle) continue;
            if (!pierwsze.has(w.Handle) && w.Title) pierwsze.set(w.Handle, w);
            if (w['Variant Price']) ceny.set(w.Handle, w['Variant Price']);
        }
        const out = [];
        for (const [handle, w] of pierwsze) {
            if (!MODEL.test(handle)) continue;
            const dir = path.join(kat, handle);
            const pliki = await fs.readdir(dir).catch(() => []);
            const druk = pliki.filter((p) => /^druk-.+-300dpi\.png$/.test(p)).sort();
            const makiety = ['podglad-przod.png', 'podglad-tyl.png'].filter((p) => pliki.includes(p));
            const wymiary = pliki.includes('WYMIARY-DRUKU.txt');
            const cena = Number(String(w['Variant Price'] || ceny.get(handle) || '').replace(',', '.'));
            const braki = [!makiety.includes('podglad-przod.png') && 'makieta przodu', !druk.length && 'pliki druku 300 DPI', !wymiary && 'WYMIARY-DRUKU.txt', !(cena > 0) && 'cena'].filter(Boolean);
            const strefy = druk.map((p) => { const m = /^druk-(.+?)-([\d.]+)x([\d.]+)cm-300dpi\.png$/.exec(p); return m ? { strefa: m[1], szer: Number(m[2]), wys: Number(m[3]), plik: p } : { strefa: p, plik: p }; });
            out.push({ postac, model: handle, tytul: w.Title, opisHtml: w['Body (HTML)'], typ: w.Type, tagi: w.Tags, dostawca: w.Vendor || '0.00G Style', cenaEur: cena > 0 ? cena : null,
                makiety, druk: strefy, wymiary, gotowy: !braki.length, braki, wyslany: fsSync.existsSync(path.join(katalog, postac, handle, '1-DO-SKLEPU-SHOPIFY', 'WKLEJ-DO-SHOPIFY.txt')) });
        }
        return out.sort((a, b) => a.model.localeCompare(b.model));
    }

    async function lista() {
        const postacie = (await fs.readdir(SKLEP, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory() && POSTAC.test(d.name)).map((d) => d.name).sort();
        const out = [];
        for (const p of postacie) {
            const produkty = await produktyPostaci(p);
            if (produkty.length) out.push({ postac: p, gotowe: produkty.filter((x) => x.gotowy).length, wszystkie: produkty.length, wyslane: produkty.filter((x) => x.wyslany).length, produkty });
        }
        return { postacie: out, zrodlo: SKLEP, cel: katalog, csv: fsSync.existsSync(path.join(katalog, 'shopify-import.csv')) ? 'shopify-import.csv' : null };
    }

    function tekstWklej(x) {
        return [
            `🛍️ ${x.tytul}`,
            '',
            'JAK DODAĆ W SHOPIFY (Products → Add product):',
            '  • To PRODUKT FIZYCZNY: w sekcji „Shipping” zaznacz „This is a physical product” (wymaga wysyłki).',
            '    NIE używaj „Digital product” / zasobów do pobrania — klient dostaje ubranie, nie pliki.',
            '  • Zdjęcia (Media): podglad-przod.png, podglad-tyl.png z tego folderu.',
            '  • Pliki z 2-DO-DRUKARNI-300DPI NIE idą do sklepu — tylko do drukarni (Printful / Gelato / Apliiq).',
            '',
            `TYTUŁ (Title):\n${x.tytul}`,
            '',
            `OPIS (Description) — wklej jako zwykły tekst:\n${zHtml(x.opisHtml)}`,
            '',
            `OPIS w HTML (przycisk <> w edytorze Shopify):\n${x.opisHtml}`,
            '',
            `CENA (Price): ${x.cenaEur != null ? `${x.cenaEur.toFixed(2)} EUR` : '— brak ceny w TeO Fashion Studio, wpisz ją tam i wyślij paczkę ponownie'}`,
            `TYP (Product type): ${x.typ}`,
            `PRODUCENT (Vendor): ${x.dostawca}`,
            `TAGI (Tags): ${x.tagi}`,
            `WARIANTY: opcja „Size” — ${ROZMIARY.join(', ')}; SKU: ${ROZMIARY.map((r) => `${x.model.toUpperCase()}-${r}`).join(', ')}`,
            'Stan magazynu: druk na żądanie — „Continue selling when out of stock” albo bez śledzenia ilości.',
            '',
            `Źródło: TeO Fashion Studio → public/nadruki/sklep/${x.postac}/${x.model}/ (QC szwalni). Przygotował Stół Produktowy Katedry ${new Date(teraz()).toISOString().slice(0, 10)}.`,
        ].join('\n');
    }

    /** Jeden produkt → dwa foldery (sklep / drukarnia). Stare pliki w tych folderach są zastępowane, nic poza nimi nie jest ruszane. */
    async function wyslijProdukt(x) {
        if (!x.gotowy) throw blad(`„${x.tytul}” nie jest gotowy: brakuje ${x.braki.join(', ')}.`);
        const zrodlo = path.join(SKLEP, x.postac, x.model);
        const baza = path.join(katalog, x.postac, x.model);
        const sklep = path.join(baza, '1-DO-SKLEPU-SHOPIFY'), druk = path.join(baza, '2-DO-DRUKARNI-300DPI');
        for (const d of [sklep, druk]) { await fs.rm(d, { recursive: true, force: true }); await fs.mkdir(d, { recursive: true }); }
        for (const p of x.makiety) await fs.copyFile(path.join(zrodlo, p), path.join(sklep, p));
        await fs.writeFile(path.join(sklep, 'WKLEJ-DO-SHOPIFY.txt'), tekstWklej(x), 'utf8');
        for (const s of x.druk) await fs.copyFile(path.join(zrodlo, s.plik), path.join(druk, s.plik));
        await fs.copyFile(path.join(zrodlo, 'WYMIARY-DRUKU.txt'), path.join(druk, 'WYMIARY-DRUKU.txt'));
        return { model: x.model, sklep: path.relative(katalog, sklep), drukarnia: path.relative(katalog, druk), zdjec: x.makiety.length, plikowDruku: x.druk.length };
    }

    /** CSV importu Shopify ze WSZYSTKICH produktów wysłanych do sklep-shopify (każda postać), produkty fizyczne, szkice. */
    async function zapiszCsv() {
        const { postacie } = await lista();
        const linie = [wierszCsv(KOLUMNY_CSV)];
        let produktow = 0;
        for (const p of postacie) for (const x of p.produkty.filter((q) => q.wyslany && q.gotowy)) {
            produktow++;
            ROZMIARY.forEach((r, i) => linie.push(wierszCsv([x.model, i ? '' : x.tytul, i ? '' : x.opisHtml, i ? '' : x.dostawca, i ? '' : x.typ, i ? '' : x.tagi, i ? '' : 'FALSE',
                'Size', r, `${x.model.toUpperCase()}-${r}`, x.cenaEur.toFixed(2), 'TRUE', 'TRUE', 'continue', 'manual', i ? '' : 'FALSE', i ? '' : 'draft'])));
        }
        await fs.mkdir(katalog, { recursive: true });
        const plik = path.join(katalog, 'shopify-import.csv');
        await fs.writeFile(plik, `﻿${linie.join('\n')}\n`, 'utf8');
        return { plik: path.basename(plik), produktow, wariantow: produktow * ROZMIARY.length };
    }

    /** Wysyłka: jeden model albo cała postać (bez `model`) albo wszystko (bez `postac`). Potem CSV od nowa. */
    async function wyslij({ postac = null, model = null } = {}) {
        if (postac && !POSTAC.test(String(postac))) throw blad('Zła nazwa postaci.');
        if (model && !MODEL.test(String(model))) throw blad('Zła nazwa modelu.');
        const { postacie } = await lista();
        const wybrane = postacie.filter((p) => !postac || p.postac === postac).flatMap((p) => p.produkty).filter((x) => !model || x.model === model);
        if (!wybrane.length) throw blad('Nie ma takiego produktu w paczce TeO Fashion Studio.', 404);
        const wyslane = [], pominiete = [];
        for (const x of wybrane) {
            if (!x.gotowy) { pominiete.push({ model: x.model, powod: `brakuje: ${x.braki.join(', ')}` }); continue; }
            wyslane.push(await wyslijProdukt(x));
        }
        if (!wyslane.length) throw blad(`Nic nie wysłano — ${pominiete.map((p) => `${p.model}: ${p.powod}`).join('; ')}`);
        return { wyslane, pominiete, csv: await zapiszCsv(), cel: katalog };
    }

    function plik(postac, model, nazwa) {
        if (!POSTAC.test(String(postac)) || !MODEL.test(String(model)) || !/^(podglad-(przod|tyl)|druk-[a-z0-9.-]+-300dpi)\.png$|^WYMIARY-DRUKU\.txt$/.test(String(nazwa))) return null;
        const p = path.join(SKLEP, postac, model, nazwa);
        return fsSync.existsSync(p) ? p : null;
    }

    return { lista, wyslij, zapiszCsv, plik, tekstWklej };
}

/** Trasy (Straż `/api/stol-produktowy`: tylko maszyna). */
export function zamontujTrasyStoluProduktowego(app, S) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    app.get('/api/stol-produktowy', (_req, res) => odp(res, S.lista()));
    app.post('/api/stol-produktowy/wyslij', (req, res) => odp(res, S.wyslij(req.body ?? {})));
    app.get('/api/stol-produktowy/plik/:postac/:model/:plik', (req, res) => { const p = S.plik(req.params.postac, req.params.model, req.params.plik); return p ? res.sendFile(p) : res.status(404).end(); });
}

export default { utworzStolProduktowy, zamontujTrasyStoluProduktowego, czytajCsv, wierszCsv, KOLUMNY_CSV };
