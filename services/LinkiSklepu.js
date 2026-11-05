/**
 * 🛍️ Linki sklepu dla postaci (Suweren 2026-11-05: „kronikarz dodawał link do sklepu z asortymentem danego mini”).
 * `_OtakOs_Wymiar/sklep-linki.json` {imie: {url, kiedy}} — ustawia Suweren (Fashion Studio po założeniu kolekcji w Shopify).
 * `linkDla({plik, nazwa, zrodlo, kontekst})`: postać, której imię pada w nazwie/pliku/materiale filmu → {imie, url}.
 * Nic nie zgaduje: bez wpisu = bez linku. Tylko adresy https.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const bezOgonkow = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');

export function utworzLinkiSklepu({ katalog }) {
    const PLIK = path.join(katalog, 'sklep-linki.json');
    const czytaj = async () => { try { return JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { return {}; } };
    async function ustaw(imie, url) {
        const im = String(imie ?? '').trim().slice(0, 40);
        if (!im) throw new Error('Podaj imię postaci.');
        const l = await czytaj();
        if (url === null || url === '') delete l[im];
        else {
            let u; try { u = new URL(String(url)); } catch { throw new Error('To nie jest adres sklepu.'); }
            if (u.protocol !== 'https:') throw new Error('Link sklepu musi być https.');
            l[im] = { url: u.toString(), kiedy: new Date().toISOString() };
        }
        await fs.mkdir(katalog, { recursive: true });
        await fs.writeFile(PLIK, JSON.stringify(l, null, 2), 'utf8');
        return l;
    }
    async function linkDla({ plik, nazwa, zrodlo, kontekst } = {}) {
        const tekst = bezOgonkow([plik && path.basename(String(plik)), nazwa, zrodlo?.tancerz, zrodlo?.mini, String(kontekst ?? '').slice(0, 3000)].filter(Boolean).join(' '));
        for (const [imie, w] of Object.entries(await czytaj())) {
            const i = bezOgonkow(imie).replace(/[^a-z0-9 ]/g, '');   // same litery i cyfry — nic do ucieczki w wyrażeniu
            if (i.length >= 3 && new RegExp(`(^|[^a-z0-9])${i}([^a-z0-9]|$)`).test(tekst)) return { imie, url: w.url };
        }
        return null;
    }
    return { lista: czytaj, ustaw, linkDla };
}

/** Trasy (Straż `/api/sklep-linki`: maszyna). */
export function zamontujTrasyLinkowSklepu(app, L) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(400).json({ success: false, message: e.message }));
    app.get('/api/sklep-linki', (_req, res) => odp(res, L.lista().then((linki) => ({ linki }))));
    app.put('/api/sklep-linki', (req, res) => odp(res, L.ustaw(req.body?.imie, req.body?.url ?? null).then((linki) => ({ linki }))));
}
