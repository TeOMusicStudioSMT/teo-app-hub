/**
 * ✦ Figury taneczne TeOgochi (Suweren 2026-10-20: „raczej idziemy w rozbudowę naszej” — bez text-to-motion na wagach
 * niekomercyjnych). Kompozytor wymyśla NOWE ruchy tancerza składane z tego, co bryła już ma: klip A, klip B na masce
 * kości, warstwy proceduralne (obrót, podskok, pochylenie, lustro, akcent, freeze), wejście w takt. Model wybiera TYLKO
 * z zamkniętych list (przepis sprawdza `oczyscPrzepis` z services/Choreografie.js — bliźniak apki), kod liczy figurę.
 *
 *  · `proponuj({mini, klipy, sekcje, okresSek, ile})` — model przydziału `kompozytor` (JSON) → figury sprawdzone po
 *    jednej; złe odpadają z powodem (`odrzucone`), żadna dobra = jedna poprawka z błędami w prośbie, potem błąd wprost.
 *  · Suweren: ✓ / ✖ (`decyzja`) i ✎ (`popraw` — para „model → Suweren” w `figury/obserwacje.jsonl`, jak u JaJa
 *    Kompozytora), albo własna figura (`dodaj`, od razu przyjęta). Przyjęte = biblioteka ruchów tancerza: apka dokłada je
 *    do układu, a most przy zapisie choreografii liczy ich długość i moc SAM (`przeliczFigury`).
 *  · `kurs()` → `kuznia-soup/figury/` (pary DPO + SFT z przyjętych); trening = decyzja Suwerena.
 * Pliki: `_OtakOs_Wymiar/choreografie/figury/<tancerz>.json` {mini, klipy (nazwa, sek, moc, części), figury}.
 * UCZCIWIE: części klipów (moc masek) mierzy apka z klatek riga — most ich nie sprawdzi bez szkieletu (jak moc klipu).
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { oczyscPrzepis, oczyscRuchy, mocFigury, kodFigury, SEKCJE_FIGUR, MASKI, WEJSCIA, GRANICE, MAX_FIGUR, rangi } from './Choreografie.js';
import { wyjmijJson, ETAPY } from './JajoKompozytora.js';

const tekst = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// bez cyfr — nazwa figury trafia do napisów programów (Zebrra Sports pilnuje liczb z faktów)
const nazwaFigury = (v) => tekst(v, 40).replace(/[^\p{L} _.:-]/gu, '').replace(/\s+/g, ' ').trim();
const ID = /^f-[0-9a-f]{8}$/;
const klucz = (id) => tekst(id, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'tancerz';

/** Granice warstw jako tekst dla modelu (z tej samej tabeli, którą sprawdza kod). */
export const OPIS_LIST = [
    `sekcja ∈ ${SEKCJE_FIGUR.join(' | ')}`,
    `maska (gdy jest klip "b") ∈ ${MASKI.join(' | ')} — "b" prowadzi te kości, "a" resztę ciała (gora = tułów, głowa i ręce; dol = biodra i nogi; rece = same ręce; glowa = szyja i głowa)`,
    `wejscie ∈ ${Object.keys(WEJSCIA).join(' | ')} (cięcie / pół uderzenia / całe uderzenie przenikania)`,
    `warstwy (każda najwyżej raz, akcent i freeze nie razem): ${Object.entries(GRANICE).map(([t, g]) => `${t} {${Object.entries(g).map(([k, v]) => (['wysokosc', 'kat', 'sila', 'czesc'].includes(k) ? `${k}: ${v[0]}–${v[1]}` : `${k}: ${v.join('|')}`)).join(', ')}}`).join('; ')}; lustro: true`,
].join('\n');

export const SYSTEM_FIGUR = `Jesteś JaJem Kompozytorem — choreografem TeOgochi w Katedrze OtakOS (domena „Bam” 🏛️⚡). Wymyślasz NOWE FIGURY taneczne, składając je z ruchów, które tancerz JUŻ MA (klipy riga, lista K1…Kn). Nie piszesz ruchu kości — tylko PRZEPIS z zamkniętych list; kod złoży figurę i policzy jej moc.
Figura = klip "a" (cały) + opcjonalnie klip "b" na masce kości + warstwy ruchu całego ciała w rytm.
Dobre figury: na Drop — obrót albo podskok na mocnym klipie, freeze na raz (stop-klatka i wybuch); na Build-up — pochylenie i akcent narastają; na Staccato — akcent co 1 uderzenie, ręce z innego klipu (maska rece); na Intro / Outro — spokojny klip, lustro, freeze 50%, delikatne pochylenie.
Odpowiadasz WYŁĄCZNIE jednym obiektem JSON:
{"figury":[{"nazwa":"krótka nazwa po polsku (bez cyfr)","opis":"1 zdanie po polsku","sekcja":"drop","a":"K3","b":"K5","maska":"gora","wejscie":"pol","warstwy":{"obrot":{"obrotow":1,"co":4,"kierunek":1},"freeze":{"czesc":0.25,"co":4}}}]}
"a" i "b" to numery z listy (K1…) albo dokładne nazwy klipów; "b": null = bez miksu (wtedy co najmniej jedna warstwa).
Listy:
${OPIS_LIST}`;

/** Prośba do modelu: klipy tancerza (moc w rankingu, długość w uderzeniach), sekcje utworu, ile figur. */
export function promptFigur({ mini, klipy, sekcje = [], okresSek = 0.5, ile = 4, istniejace = [] }) {
    const mR = rangi(klipy.map((k) => k.moc));
    const lista = klipy.map((k, i) => `K${i + 1} ${k.nazwa} — moc ${Math.round(mR[i] * 100)}/100, ~${Math.max(1, Math.round(k.sek / okresSek))} uderzeń`).join('\n');
    const sek = [...new Set(sekcje.filter((s) => SEKCJE_FIGUR.includes(s)))];
    return [
        `Tancerz: ${tekst(mini?.nazwa, 40) || 'TeOgochi'}. Tempo: ${Math.round(60 / okresSek)} BPM.`,
        `Klipy tańca tancerza:\n${lista}`,
        sek.length ? `Sekcje utworu (oś Kompozytora): ${sek.join(', ')} — daj figury przede wszystkim na nie, co najmniej jedną na drop, jeśli jest.` : 'Utwór bez osi — daj figury na różne sekcje, co najmniej jedną na drop.',
        istniejace.length ? `Tancerz ma już figury (nie powtarzaj nazw ani przepisów): ${istniejace.map((f) => f.nazwa).join(', ')}.` : '',
        `Wymyśl ${ile} figur, różnych od siebie.`,
    ].filter(Boolean).join('\n\n');
}

/** Odpowiedź modelu → figury sprawdzone po jednej: { figury: [{nazwa, opis, przepis}], odrzucone: [{nazwa, powod}] }. */
export function odczytajFigury(odp, nazwyKlipow, zajete = []) {
    const j = wyjmijJson(odp);
    const lista = Array.isArray(j?.figury) ? j.figury : Array.isArray(j) ? j : [];
    if (!lista.length) throw new Error('Kompozytor nie oddał listy "figury".');
    const figury = [], odrzucone = [];
    const nazwy = new Set([...zajete, ...nazwyKlipow].map((n) => n.toLowerCase()));
    const kody = new Set();
    for (const f of lista.slice(0, 12)) {
        const nazwa = nazwaFigury(f?.nazwa);
        try {
            if (nazwa.length < 2) throw new Error('figura bez nazwy');
            if (nazwy.has(nazwa.toLowerCase())) throw new Error(`nazwa „${nazwa}” już zajęta`);
            const przepis = oczyscPrzepis(f, nazwyKlipow);
            const kod = kodFigury(przepis);
            if (kody.has(kod)) throw new Error('ten sam przepis co inna figura');
            kody.add(kod); nazwy.add(nazwa.toLowerCase());
            figury.push({ nazwa, opis: tekst(f?.opis, 200), przepis });
        } catch (e) { odrzucone.push({ nazwa: nazwa || '?', powod: e.message }); }
    }
    return { figury, odrzucone };
}

/**
 * @param {{ katalog: string, katalogKuzni?: string|null, pisz?: (o:{system:string, prompt:string}) => Promise<{tekst:string, model?:string}>,
 *           szyna?: any, teraz?: () => Date }} o   katalog = `_OtakOs_Wymiar/choreografie/figury`
 */
export function utworzFiguryTanca({ katalog, katalogKuzni = null, pisz = null, szyna = null, teraz = () => new Date() }) {
    const PLIK_OBS = path.join(katalog, 'obserwacje.jsonl');
    let zapis = Promise.resolve();
    const poKolei = (f) => { const p = zapis.then(f, f); zapis = p.catch(() => {}); return p; };
    const plikTancerza = (id) => path.join(katalog, `${klucz(id)}.json`);

    async function wczytajTancerza(id) {
        try { return JSON.parse(await fs.readFile(plikTancerza(id), 'utf8')); } catch { return null; }
    }
    async function zapiszTancerza(b) { await fs.mkdir(katalog, { recursive: true }); await fs.writeFile(plikTancerza(b.mini.id), JSON.stringify(b, null, 2)); return b; }
    async function wszyscy() {
        const out = [];
        for (const f of await fs.readdir(katalog).catch(() => [])) if (f.endsWith('.json')) { try { out.push(JSON.parse(await fs.readFile(path.join(katalog, f), 'utf8'))); } catch { /* uszkodzony */ } }
        return out;
    }
    async function znajdz(id) {
        if (!ID.test(String(id))) throw new Error('Zły identyfikator figury.');
        for (const b of await wszyscy()) { const f = b.figury?.find((x) => x.id === id); if (f) return { b, f }; }
        throw new Error('Nie ma takiej figury.');
    }
    async function obserwacje() {
        const t = await fs.readFile(PLIK_OBS, 'utf8').catch(() => '');
        return t.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    }
    async function obserwuj(wpis) {
        const w = await obserwacje();
        const o = { nr: (w.at(-1)?.nr ?? 0) + 1, kiedy: teraz().toISOString(), ...wpis };
        await fs.mkdir(katalog, { recursive: true });
        await fs.appendFile(PLIK_OBS, `${JSON.stringify(o)}\n`);
        return o;
    }
    const miniZ = (m) => {
        const id = tekst(m?.id, 40);
        if (!id) throw new Error('Wybierz tancerza (Mini).');
        return { id, nazwa: tekst(m?.nazwa, 40) || 'TeOgochi' };
    };
    /** Klipy tancerza z apki (tylko klipy, bez figur) — nazwy, długość, moc i części masek. */
    const klipyZ = (klipy) => oczyscRuchy((Array.isArray(klipy) ? klipy : []).filter((k) => !k?.figura).map(({ figura: _f, ...k }) => k));
    /** Moc wzorcowa (120 BPM) do listy — w choreografii apka liczy ją z tempem utworu. */
    const zMoca = (f, klipy) => { try { return { ...f, wzor: mocFigury(f.przepis, klipy, 0.5) }; } catch (e) { return { ...f, wzor: null, blad: e.message }; } };
    const etap = (pkt) => [...ETAPY].reverse().find((e) => pkt >= e.od) ?? ETAPY[0];

    async function lista(miniId = null) {
        const w = await obserwacje();
        const poprawki = w.filter((o) => o.rodzaj === 'poprawka').length, decyzje = w.filter((o) => o.rodzaj === 'decyzja').length;
        const tancerze = miniId ? [await wczytajTancerza(miniId)].filter(Boolean) : await wszyscy();
        return {
            tancerze: tancerze.map((b) => ({ mini: b.mini, klipy: b.klipy.length, figury: b.figury.map((f) => zMoca(f, b.klipy)) })),
            stan: { obserwacji: w.length, poprawki, decyzje, etap: etap(2 * poprawki + decyzje) },
            listy: { sekcje: SEKCJE_FIGUR, maski: MASKI, wejscia: Object.keys(WEJSCIA), granice: GRANICE },
        };
    }

    async function proponuj({ mini, klipy, sekcje = [], okresSek = 0.5, ile = 4 } = {}) {
        if (!pisz) throw new Error('Kompozytor nie ma modelu (most bez Ollamy).');
        const m = miniZ(mini);
        const k = klipyZ(klipy);
        const okres = Number(okresSek) > 0.2 && Number(okresSek) < 2 ? Number(okresSek) : 0.5;
        const n = Math.min(6, Math.max(1, Math.round(Number(ile) || 4)));
        const stary = await wczytajTancerza(m.id);
        const istniejace = (stary?.figury ?? []).filter((f) => f.stan !== 'odrzucona');
        if ((stary?.figury?.length ?? 0) >= MAX_FIGUR) throw new Error(`Tancerz ma już ${MAX_FIGUR} figur — usuń odrzucone albo stare.`);
        const nazwy = k.map((x) => x.nazwa);
        const prompt = promptFigur({ mini: m, klipy: k, sekcje, okresSek: okres, ile: n, istniejace });
        let odp = await pisz({ system: SYSTEM_FIGUR, prompt });
        let wynik;
        try {
            wynik = odczytajFigury(odp.tekst, nazwy, istniejace.map((f) => f.nazwa));
            if (!wynik.figury.length) throw new Error(wynik.odrzucone.map((o) => `${o.nazwa}: ${o.powod}`).join('; '));
        } catch (e) {
            // jedna poprawka: model dostaje swoje błędy wprost
            odp = await pisz({ system: SYSTEM_FIGUR, prompt: `${prompt}\n\nTwoja poprzednia odpowiedź była zła: ${e.message}\nPamiętaj: tylko klipy z listy (K1…K${nazwy.length}), wartości tylko z list. Popraw i oddaj sam JSON.` });
            wynik = odczytajFigury(odp.tekst, nazwy, istniejace.map((f) => f.nazwa));
            if (!wynik.figury.length) throw new Error(`Kompozytor nie dał żadnej poprawnej figury: ${wynik.odrzucone.map((o) => `${o.nazwa} — ${o.powod}`).join('; ')}`);
        }
        const nowe = await poKolei(async () => {
            const b = (await wczytajTancerza(m.id)) ?? { mini: m, klipy: [], figury: [] };
            b.mini = m; b.klipy = k;
            const nowe = wynik.figury.map((f) => ({ id: `f-${crypto.randomBytes(4).toString('hex')}`, ...f, stan: 'propozycja', zrodlo: 'kompozytor', model: odp.model ?? null, prosba: prompt, odModelu: { nazwa: f.nazwa, przepis: f.przepis }, poprawiona: false, utworzono: teraz().toISOString() }));
            b.figury.push(...nowe);
            await zapiszTancerza(b);
            return nowe.map((f) => zMoca(f, k));
        });
        void szyna?.nadaj?.({ agent: 'JaJo Kompozytor', rodzaj: 'praca', tresc: `✦ ${m.nazwa}: ${nowe.length} nowych figur do Twojego ✓ (${nowe.map((f) => f.nazwa).join(', ')})` })?.catch?.(() => {});
        return { figury: nowe, odrzucone: wynik.odrzucone, model: odp.model ?? null };
    }

    /** Własna figura Suwerena — od razu przyjęta. Klipy tancerza z apki odświeżają zapis. */
    async function dodaj({ mini, klipy, nazwa, opis = '', przepis } = {}) {
        const m = miniZ(mini);
        return poKolei(async () => {
            const b = (await wczytajTancerza(m.id)) ?? { mini: m, klipy: [], figury: [] };
            if (klipy) b.klipy = klipyZ(klipy);
            if (!b.klipy.length) throw new Error('Most nie zna jeszcze klipów tego tancerza — otwórz go w choreografii.');
            const n = nazwaFigury(nazwa);
            if (n.length < 2) throw new Error('Nazwij figurę.');
            if (b.figury.some((f) => f.nazwa.toLowerCase() === n.toLowerCase()) || b.klipy.some((k) => k.nazwa.toLowerCase() === n.toLowerCase())) throw new Error(`Nazwa „${n}” już zajęta.`);
            const p = oczyscPrzepis(przepis, b.klipy.map((k) => k.nazwa));
            const f = { id: `f-${crypto.randomBytes(4).toString('hex')}`, nazwa: n, opis: tekst(opis, 200), przepis: p, stan: 'przyjeta', zrodlo: 'suweren', model: null, odModelu: null, poprawiona: false, utworzono: teraz().toISOString() };
            b.mini = m; b.figury.push(f);
            await zapiszTancerza(b);
            return zMoca(f, b.klipy);
        });
    }

    /** ✎ Poprawka Suwerena: przepis sprawdzony tak samo → para „model → Suweren” (gdy figura od modelu). */
    async function popraw(id, { nazwa, opis, przepis } = {}) {
        return poKolei(async () => {
            const { b, f } = await znajdz(id);
            const n = nazwa === undefined ? f.nazwa : nazwaFigury(nazwa);
            if (n.length < 2) throw new Error('Nazwij figurę.');
            if (b.figury.some((x) => x.id !== id && x.nazwa.toLowerCase() === n.toLowerCase())) throw new Error(`Nazwa „${n}” już zajęta.`);
            const p = przepis === undefined ? f.przepis : oczyscPrzepis(przepis, b.klipy.map((k) => k.nazwa));
            const przed = { nazwa: f.nazwa, przepis: f.przepis };
            if (JSON.stringify(przed) === JSON.stringify({ nazwa: n, przepis: p }) && (opis === undefined || tekst(opis, 200) === f.opis)) return { figura: zMoca(f, b.klipy), zmiana: false };
            Object.assign(f, { nazwa: n, przepis: p, opis: opis === undefined ? f.opis : tekst(opis, 200), poprawiona: true, zmieniono: teraz().toISOString() });
            await zapiszTancerza(b);
            const obs = f.odModelu ? await obserwuj({ rodzaj: 'poprawka', figura: id, mini: b.mini.nazwa, prosba: f.prosba, przed: JSON.stringify(przed), po: JSON.stringify({ nazwa: n, przepis: p }) }) : null;
            return { figura: zMoca(f, b.klipy), zmiana: true, obserwacja: obs?.nr ?? null };
        });
    }

    async function decyzja(id, werdykt) {
        if (!['przyjmij', 'odrzuc'].includes(werdykt)) throw new Error('Werdykt: przyjmij albo odrzuć.');
        return poKolei(async () => {
            const { b, f } = await znajdz(id);
            f.stan = werdykt === 'przyjmij' ? 'przyjeta' : 'odrzucona';
            f.decyzja = teraz().toISOString();
            await zapiszTancerza(b);
            if (f.odModelu) await obserwuj({ rodzaj: 'decyzja', figura: id, mini: b.mini.nazwa, werdykt, poprawiona: !!f.poprawiona });
            return zMoca(f, b.klipy);
        });
    }

    async function usun(id) {
        return poKolei(async () => {
            const { b } = await znajdz(id);
            b.figury = b.figury.filter((f) => f.id !== id);
            await zapiszTancerza(b);
            return true;
        });
    }

    /** Dane do Kuźni: pary DPO z poprawek (odrzucone = wersja modelu) i SFT z przyjętych figur od modelu. */
    async function kurs({ zapisz = true } = {}) {
        const w = await obserwacje();
        const pary = w.filter((o) => o.rodzaj === 'poprawka').map((o) => ({ prompt: `${SYSTEM_FIGUR}\n\n${o.prosba ?? ''}`, chosen: o.po, rejected: o.przed }));
        const sft = [];
        for (const b of await wszyscy()) for (const f of b.figury) if (f.stan === 'przyjeta' && f.prosba) sft.push({ messages: [{ role: 'system', content: SYSTEM_FIGUR }, { role: 'user', content: f.prosba }, { role: 'assistant', content: JSON.stringify({ figury: [{ nazwa: f.nazwa, opis: f.opis, ...f.przepis }] }) }] });
        let pliki = null;
        if (zapisz && katalogKuzni) {
            const kat = path.join(katalogKuzni, 'figury');
            await fs.mkdir(kat, { recursive: true });
            await fs.writeFile(path.join(kat, 'pary-figur.jsonl'), pary.map((p) => JSON.stringify(p)).join('\n') + (pary.length ? '\n' : ''));
            await fs.writeFile(path.join(kat, 'sft-figur.jsonl'), sft.map((p) => JSON.stringify(p)).join('\n') + (sft.length ? '\n' : ''));
            pliki = kat;
        }
        return { pary: pary.length, sft: sft.length, katalog: pliki };
    }

    return { lista, proponuj, dodaj, popraw, decyzja, usun, kurs };
}

/** Trasy (Straż: `/api/taniec/` — tylko maszyna). Przed `/api/taniec/figury/:id` stoją stałe ścieżki. */
export function zamontujTrasyFigur(app, { figury }) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(e.message?.startsWith('Nie ma') ? 404 : kod).json({ success: false, message: e.message }));
    app.get('/api/taniec/figury', (req, res) => odp(res, figury.lista(req.query.mini ? String(req.query.mini) : null), 500));
    app.post('/api/taniec/figury/proponuj', (req, res) => odp(res, figury.proponuj(req.body ?? {}), 502));
    app.post('/api/taniec/figury/kurs', (_req, res) => odp(res, figury.kurs()));
    app.post('/api/taniec/figury', (req, res) => odp(res, figury.dodaj(req.body ?? {}).then((figura) => ({ figura }))));
    app.put('/api/taniec/figury/:id', (req, res) => odp(res, figury.popraw(req.params.id, req.body ?? {})));
    app.post('/api/taniec/figury/:id/przyjmij', (req, res) => odp(res, figury.decyzja(req.params.id, 'przyjmij').then((figura) => ({ figura }))));
    app.post('/api/taniec/figury/:id/odrzuc', (req, res) => odp(res, figury.decyzja(req.params.id, 'odrzuc').then((figura) => ({ figura }))));
    app.delete('/api/taniec/figury/:id', (req, res) => odp(res, figury.usun(req.params.id).then((usunieta) => ({ usunieta }))));
}

export default { utworzFiguryTanca, zamontujTrasyFigur, odczytajFigury, promptFigur, SYSTEM_FIGUR };
