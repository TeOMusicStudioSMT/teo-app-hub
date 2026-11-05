/**
 * 👕🔭 Zwiadowca kanałów dystrybucji — etap 1 (projekt: docs/designs/zwiadowca-dystrybucji.md, Argo BoB 2026-11-01).
 * Szuka w sieci kanałów sprzedaży ubrań i gadżetów z motywami Teterhii i Mini-TeOgochi: druk na żądanie (POD) spinany
 * z Shopify, marketplace'y twórców, sklepy merchu dla twórców. Wyszukiwanie = silnik Zwiadowcy promocji (`surowy`:
 * Claude web_search albo Gemini google_search) z własnym poleceniem. ZERO ZMYŚLEŃ: kanał przechodzi tylko, gdy jego
 * `link` padł w wynikach wyszukiwania (`dopasujZrodlo`). Nic nie zakłada, nie płaci, nie łączy sklepów, nie wysyła wzorów.
 * „Podłącz ten kanał” = propozycja → 📥 Izba zgód → ✓ Suwerena = kierunek przyjęty; spięcie konta robi człowiek.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { wylowJson, dopasujZrodlo, utworzZwiadowcePromocji } from './ZwiadowcaPromocji.js';

export const KATEGORIE = {
    pod: 'druk na żądanie (POD) z integracją ze sklepem — najlepiej Shopify',
    marketplace: 'marketplace dla twórców z własnym ruchem (wgrywasz wzór, platforma drukuje, wysyła i przyjmuje płatność)',
    'sklep-tworcow': 'sklepy merchu dla twórców, graczy i kanałów wideo (YouTube Merch Shelf, Twitch, Discord)',
};
export const MODELE = ['POD', 'hurt', 'komis'];
export const DOSTAWCY = ['auto', 'anthropic', 'gemini'];   // 🏠 lokalny nie przeszuka sieci rzetelnie — etap 1 bez niego
const DOMYSLNY_KONTEKST = 'ubrania i gadżety (bluzy, koszulki, kubki, naklejki) z motywami gry Teterhia i stworków Mini-TeOgochi; sprzedawca w Polsce, wysyłka do UE; sklep Suwerena stoi na Shopify';

export const SYSTEM = `Jesteś Zwiadowcą Katedry OtakOS. Szukasz w sieci REALNYCH kanałów sprzedaży fizycznego merchu (ubrania, gadżety) z autorskimi wzorami twórcy.
Zasady:
- Tylko to, co znalazłeś w wynikach wyszukiwania TERAZ — każdy kanał z adresem strony (link) oferty, cennika albo integracji.
- Nie zgadujesz liczb: prowizje, koszty i progi tylko, gdy strona je podaje — inaczej null.
- Licencja na wzory: czy twórca zachowuje prawa, czy jest wyłączność, czy platforma może używać wzorów (np. do AI) — tylko ze strony, inaczej null.
- Pewność: "oficjalne" (strona/dokumentacja platformy), "agregator" (porównania, blogi), "forum" (Reddit, opinie twórców).
Na końcu odpowiedz WYŁĄCZNIE JSON-em (bez nic po nim):
{"kanaly":[{"nazwa":"…","link":"https://…","kategoria":"pod|marketplace|sklep-tworcow","model":"POD|hurt|komis","prowizjaKoszty":"tekst albo null","wysylkaUE":true,"krajeWysylki":"tekst albo null","integracje":["Shopify"],"licencjaWzory":"tekst albo null","wymagania":"tekst albo null","data":"data ze strony albo null","pewnosc":"oficjalne|agregator|forum"}],"podsumowanie":"1–2 zdania po polsku"}`;

const tnij = (x, n) => (x === null || x === undefined || x === '' ? null : String(x).trim().slice(0, n) || null);

/** JSON modelu + źródła z wyszukiwania → przyjęte (link w wynikach) i odrzucone z powodem; oficjalne pierwsze. */
export function sprawdzKanaly(json, zrodla, kategoriaZwiadu = null) {
    const przyjete = [], odrzucone = [];
    for (const k of Array.isArray(json?.kanaly) ? json.kanaly : []) {
        const { zr, potwierdzone } = dopasujZrodlo(k?.link, zrodla);
        const wpis = {
            nazwa: tnij(k?.nazwa, 80) ?? '(bez nazwy)',
            link: String(k?.link ?? '').slice(0, 400),
            kategoria: KATEGORIE[k?.kategoria] ? k.kategoria : (KATEGORIE[kategoriaZwiadu] ? kategoriaZwiadu : 'pod'),
            model: MODELE.includes(k?.model) ? k.model : 'POD',
            prowizjaKoszty: tnij(k?.prowizjaKoszty, 300),
            wysylkaUE: k?.wysylkaUE === true ? true : k?.wysylkaUE === false ? false : null,
            krajeWysylki: tnij(k?.krajeWysylki, 200),
            integracje: (Array.isArray(k?.integracje) ? k.integracje : []).map((x) => tnij(x, 40)).filter(Boolean).slice(0, 10),
            licencjaWzory: tnij(k?.licencjaWzory, 300),
            wymagania: tnij(k?.wymagania, 300),
            data: tnij(k?.data, 40),
            pewnosc: ['oficjalne', 'agregator', 'forum'].includes(k?.pewnosc) ? k.pewnosc : 'agregator',
            tytulZrodla: zr?.tytul ?? null, wiekStrony: zr?.wiek ?? null, potwierdzone,
        };
        if (!zr) { odrzucone.push({ ...wpis, powod: 'źródła nie było w wynikach wyszukiwania — możliwe zmyślenie' }); continue; }
        if (przyjete.some((p) => p.link === wpis.link)) continue;
        przyjete.push(wpis);
    }
    const kolej = { oficjalne: 0, agregator: 1, forum: 2 };
    przyjete.sort((a, b) => kolej[a.pewnosc] - kolej[b.pewnosc]);
    return { przyjete, odrzucone };
}

/** Prośba do wyszukiwarki dla kategorii (albo wszystkich) + kontekst. */
export function prosbaZwiadu({ kategoria = null, zapytanie = '', kontekst = '' } = {}, dzis = new Date()) {
    const kat = KATEGORIE[kategoria] ? `Kategoria: ${kategoria} — ${KATEGORIE[kategoria]}.` : `Kategorie: ${Object.entries(KATEGORIE).map(([k, o]) => `${k} (${o})`).join('; ')}.`;
    return `${kat}\nCzego szukamy: ${String(zapytanie || 'kanały, przez które twórca sprzeda swój merch').slice(0, 200)}\nKontekst: ${String(kontekst || DOMYSLNY_KONTEKST).slice(0, 400)}\nDzisiaj: ${dzis.toISOString().slice(0, 10)}. Znajdź 4–10 aktualnych kanałów z linkami.`;
}

/**
 * @param {{ katalog: string, klucze?: object, modelGemini?: Function, fetch?: Function, szyna?: object|null, jajo?: { decyzja?: Function }|null, silnik?: object, teraz?: () => number }} o
 */
export function utworzZwiadowceDystrybucji({ katalog, klucze = {}, modelGemini, fetch: f = globalThis.fetch, szyna = null, jajo = null, silnik = null, teraz = () => Date.now() }) {
    const S = silnik ?? utworzZwiadowcePromocji({ klucze, katalog, fetch: f, szyna: null, system: SYSTEM, ...(modelGemini ? { modelGemini } : {}) });
    const plik = () => path.join(katalog, 'dystrybucja.json');
    let kolejka = Promise.resolve();
    async function czytaj() { try { const d = JSON.parse(await fs.readFile(plik(), 'utf8')); return { zwiady: d.zwiady ?? [], propozycje: d.propozycje ?? [] }; } catch { return { zwiady: [], propozycje: [] }; } }
    async function zapisz(d) {
        await fs.mkdir(katalog, { recursive: true });
        const tmp = `${plik()}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(d, null, 2), 'utf8');
        await fs.rename(tmp, plik());
    }
    /** Zapisy po kolei — czytaj → zmień → zapisz bez wyścigów. */
    const zmien = (fn) => {
        const praca = kolejka.then(async () => { const d = await czytaj(); const w = await fn(d); await zapisz(d); return w; });
        kolejka = praca.catch(() => {});   // odmowa jednej zmiany nie blokuje następnych
        return praca;
    };

    async function szukaj({ kategoria = null, zapytanie = '', kontekst = '', dostawca = 'auto' } = {}) {
        if (!DOSTAWCY.includes(dostawca)) throw new Error(`Dostawca: ${DOSTAWCY.join(', ')} (lokalny model nie przeszuka sieci rzetelnie).`);
        if (kategoria && !KATEGORIE[kategoria]) throw new Error(`Kategoria: ${Object.keys(KATEGORIE).join(', ')}.`);
        const { dostawca: uzyty, wynik: w } = await S.surowy(prosbaZwiadu({ kategoria, zapytanie, kontekst }, new Date(teraz())), { dostawca });
        const json = wylowJson(w.tekst, 'kanaly');
        if (!json) {
            await fs.mkdir(katalog, { recursive: true });
            await fs.writeFile(path.join(katalog, 'dystrybucja-ostatnia-odpowiedz.txt'), String(w.tekst ?? ''), 'utf8').catch(() => {});
            throw new Error(`Zwiadowca nie oddał listy (JSON) — surowa odpowiedź w zwiadowca/dystrybucja-ostatnia-odpowiedz.txt. Początek: ${String(w.tekst ?? '').slice(0, 160)}`);
        }
        const { przyjete, odrzucone } = sprawdzKanaly(json, w.zrodla, kategoria);
        const zwiad = {
            id: `zd-${crypto.randomBytes(4).toString('hex')}`, kiedy: new Date(teraz()).toISOString(), kategoria, zapytanie: tnij(zapytanie, 200),
            dostawca: uzyty, model: w.model, kanaly: przyjete, odrzucone, podsumowanie: String(json.podsumowanie ?? '').slice(0, 400),
            zrodel: w.zrodla.size, bledyWyszukiwania: w.bledyWyszukiwania ?? [],
            koszt: { wyszukan: w.usage?.wyszukan ?? 0, tokenyWe: w.usage?.input_tokens ?? 0, tokenyWy: w.usage?.output_tokens ?? 0, usdWyszukiwania: uzyty === 'anthropic' ? Math.round((w.usage?.wyszukan ?? 0) * 0.01 * 100) / 100 : null },
            uwaga: `Zwiadowca nic nie zakłada i nie płaci — warunki sprawdzisz na stronie kanału przed rejestracją.${uzyty === 'gemini' ? ' Gemini podaje źródła jako domeny — „potwierdzone domeną” znaczy: ta strona była w wynikach, dokładnego adresu nie da się sprawdzić.' : ''}`,
        };
        await zmien((d) => { d.zwiady = [zwiad, ...d.zwiady].slice(0, 30); });
        await szyna?.nadaj?.({ agent: 'Zwiadowca', rodzaj: 'zwiad', tresc: `👕 kanały dystrybucji: ${przyjete.length} ze źródłami${odrzucone.length ? `, ${odrzucone.length} odrzucone bez źródła` : ''}`, dane: { zwiad: zwiad.id } })?.catch?.(() => {});
        return zwiad;
    }

    /** Sprawdzony kanał z zwiadu → propozycja „do_zgody” (Izba). Tylko link, który zwiad przyjął. */
    async function zaproponuj({ zwiad: zwiadId = null, link, notatka = '' } = {}) {
        return zmien((d) => {
            const zw = d.zwiady.filter((z) => !zwiadId || z.id === zwiadId);
            const kanal = zw.flatMap((z) => (z.kanaly ?? []).map((k) => ({ ...k, zwiad: z.id }))).find((k) => k.link === link);
            if (!kanal) throw Object.assign(new Error('Tego kanału nie ma wśród sprawdzonych znalezisk zwiadu — najpierw zwiad.'), { kod: 404 });
            const jest = d.propozycje.find((p) => p.kanal.link === link && p.stan === 'do_zgody');
            if (jest) return jest;
            const p = { id: `kd-${crypto.randomBytes(4).toString('hex')}`, stan: 'do_zgody', kiedy: new Date(teraz()).toISOString(), kanal, notatka: tnij(notatka, 300) };
            d.propozycje = [p, ...d.propozycje].slice(0, 100);
            return p;
        });
    }

    async function decyduj(id, akcja, { powod = '' } = {}) {
        if (!['przyjmij', 'odrzuc'].includes(akcja)) throw new Error('Akcja: przyjmij albo odrzuc.');
        const p = await zmien((d) => {
            const x = d.propozycje.find((q) => q.id === id);
            if (!x) throw Object.assign(new Error('Nie ma takiej propozycji kanału.'), { kod: 404 });
            if (x.stan !== 'do_zgody') return { ...x, juz: true };
            x.stan = akcja === 'przyjmij' ? 'przyjeta' : 'odrzucona';
            x.decyzja = { kiedy: new Date(teraz()).toISOString(), powod: tnij(powod, 300) };
            return x;
        });
        if (!p.juz) await Promise.resolve(jajo?.decyzja?.({ zrodlo: 'dystrybucja', obiekt: p.id, tytul: p.kanal.nazwa, werdykt: akcja, uwagi: powod || '' })).catch(() => {});
        return { stan: p.stan, ...(p.juz ? { juz: true } : {}) };
    }

    const opisKanalu = (k) => [
        `${k.kategoria} · ${k.model}`, k.prowizjaKoszty && `koszty: ${k.prowizjaKoszty}`,
        k.wysylkaUE === true ? '🇪🇺 wysyłka UE' : k.wysylkaUE === false ? 'bez wysyłki UE' : 'wysyłka UE: nie wiadomo',
        k.integracje?.length && `integracje: ${k.integracje.join(', ')}`, k.licencjaWzory && `licencja: ${k.licencjaWzory}`,
        k.wymagania && `wymagania: ${k.wymagania}`, `źródło (${k.pewnosc}, ${k.potwierdzone === 'adres' ? 'adres' : 'domena'}): ${k.link}`,
    ].filter(Boolean).join('\n');

    /** 📥 Źródło Izby zgód: czysty odczyt dysku, bez sieci. ✓ nie wydaje pieniędzy — tylko kierunek (zdalnie: true). */
    const zrodloIzby = {
        id: 'dystrybucja', emoji: '👕', nazwa: 'Kanały dystrybucji',
        czekajace: async () => (await czytaj()).propozycje.filter((p) => p.stan === 'do_zgody').map((p) => ({
            id: p.id, tytul: `Podłączyć kanał „${p.kanal.nazwa}”?`, kiedy: p.kiedy, opis: `${opisKanalu(p.kanal)}${p.notatka ? `\nnotatka: ${p.notatka}` : ''}`,
            akcje: [{ id: 'przyjmij', etykieta: '✓ Przyjmij do wdrożenia', zdalnie: true }, { id: 'odrzuc', etykieta: '✕ Odrzuć kanał', zdalnie: true }],
        })),
        decyduj: (id, akcja, o = {}) => decyduj(id, akcja, o),
    };

    return { szukaj, zaproponuj, decyduj, stan: czytaj, zrodloIzby, dostawcy: () => S.dostawcy?.() ?? null };
}

/** Trasy mostu (Straż: `/api/zwiadowca/` — tylko maszyna). */
export function zamontujTrasyDystrybucji(app, Z) {
    const blad = (res, e) => res.status(e.kod ?? 400).json({ success: false, message: e.message });
    app.get('/api/zwiadowca/dystrybucja', async (_req, res) => { try { res.json({ success: true, ...(await Z.stan()), kategorie: KATEGORIE, dostawcy: await Z.dostawcy() }); } catch (e) { blad(res, e); } });
    app.post('/api/zwiadowca/dystrybucja', async (req, res) => { try { res.json({ success: true, zwiad: await Z.szukaj(req.body ?? {}) }); } catch (e) { blad(res, e); } });
    app.post('/api/zwiadowca/dystrybucja/zaproponuj', async (req, res) => { try { res.json({ success: true, propozycja: await Z.zaproponuj(req.body ?? {}) }); } catch (e) { blad(res, e); } });
    app.post('/api/zwiadowca/dystrybucja/:id/:akcja', async (req, res) => { try { res.json({ success: true, ...(await Z.decyduj(req.params.id, req.params.akcja, { powod: req.body?.powod })) }); } catch (e) { blad(res, e); } });
}

export default { utworzZwiadowceDystrybucji, zamontujTrasyDystrybucji, sprawdzKanaly, prosbaZwiadu, KATEGORIE, SYSTEM };
