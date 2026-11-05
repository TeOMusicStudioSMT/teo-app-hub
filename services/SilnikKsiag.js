/**
 * 📖✍️ Silnik Żywych Ksiąg — potok KATEDRY dla czytnika TeO Story Studio (Suweren 2026-11-05: „adaptacja tego, co
 * zastosowaliśmy w Żywej Księdze… a Google tylko opcja”). Wzór: services/ZywaKsiega.js — słowo pisze Kronikarz (model
 * przydziału), obraz maluje Paleta (FLUX `Assety3D.kadrFilmu`), wzory postaci ze Stałej Obsady (`StalaObsada.wzory`).
 *
 * Księga = format czytnika (Storybook: title, subtitle, author, characters[{id, name, role, avatarCutoutUrl}],
 * pages[{chapterTitle, narrativeText, dialogueLines[{speaker, speakerLabel, text}], illustrationPrompt, imageCaption, imageUrl}]),
 * ten sam, który publikuje Wypożyczalnia (services/WypozyczalniaKsiag.js).
 * Etapy z faktów: pisze → postacie (wycinanki z papieru zamiast „pionków”) → strony → gotowe | blad. Jedno zadanie naraz
 * (karta graficzna), duch po restarcie = błąd z powodem. `_OtakOs_Wymiar/zywe-ksiegi/<zk-id>/{ksiega.json, postac-*.png, strona-*.png}`.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_STRON = 8;
export const MAX_POSTACI = 5;
/** Kreska jak portal teostory.studio: noc Katedry, bursztyn i szmaragd, wycinanki z papieru. */
export const STYL = ', layered cut-paper storybook illustration, paper theater diorama, warm amber candlelight against deep emerald and midnight blue, fine gold ink accents, soft paper texture, cinematic, no text, no letters';
export const STYL_POSTACI = ', single paper-cutout theater puppet, full body, front view, flat hand-painted colors, thick white paper border around the figure, standing on a small wooden stick, plain light parchment background, no text';

const ID = /^zk-[0-9a-f]{8}$/;
const tekst = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const slug = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

export function systemKronikarza(jezyk = 'pl') {
    const j = jezyk === 'en' ? 'English' : 'Polish (polski)';
    return `Jesteś Kronikarzem Katedry OtakOS. Piszesz ŻYWE KSIĘGI — krótkie, ilustrowane opowieści czytane na głosy w Teatrze 2.5D.
Język tekstu opowieści: ${j}. Opisy obrazów (illustrationPrompt, look) zawsze po ANGIELSKU.
Zasady: własna, oryginalna opowieść (żadnych cudzych chronionych dzieł, postaci ani cytatów); ciepło, humor, obraz w słowach; każda strona: narracja 2–5 zdań + 0–4 kwestie postaci.
Odpowiedz WYŁĄCZNIE JSON-em:
{"title":"…","subtitle":"…","characters":[{"id":"krotkie-id","name":"Imię","role":"kim jest","look":"EN: wygląd do rysunku","aktor":"id aktora z listy albo null"}],
 "pages":[{"chapterTitle":"…","narrativeText":"…","dialogueLines":[{"speaker":"id postaci","text":"…"}],"illustrationPrompt":"EN: scena","imageCaption":"krótki podpis"}]}`;
}

export function promptKsiegi({ pomysl, stron, obsada = [] }) {
    const aktorzy = obsada.length ? `\nSTAŁA OBSADA (możesz ich obsadzić — wpisz "aktor": id):\n${obsada.map((a) => `- ${a.id}: ${a.imie}${a.opis ? ` — ${a.opis}` : ''}`).join('\n')}` : '';
    return `POMYSŁ SUWERENA: ${tekst(pomysl, 1500)}\nLICZBA STRON: dokładnie ${stron}. Postaci: 1–${MAX_POSTACI}.${aktorzy}`;
}

const wylowJson = (t) => { const s = String(t ?? '').replace(/<think>[\s\S]*?<\/think>/g, ''); const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; } };

/** JSON Kronikarza → księga czytnika albo błąd z powodem (do jednej poprawki). */
export function odczytajKsiege(t, { stron, aktorzy = [] }) {
    const j = typeof t === 'string' ? wylowJson(t) : t;
    if (!j) throw new Error('to nie był JSON');
    const title = tekst(j.title, 160);
    if (!title) throw new Error('brak tytułu');
    const postacie = [];
    for (const c of Array.isArray(j.characters) ? j.characters : []) {
        const id = slug(c?.id || c?.name);
        if (!id || postacie.some((p) => p.id === id) || postacie.length >= MAX_POSTACI) continue;
        postacie.push({ id, name: tekst(c.name, 60) || id, role: tekst(c.role, 80), look: tekst(c.look, 400), aktor: aktorzy.includes(c?.aktor) ? c.aktor : null });
    }
    if (!postacie.length) throw new Error('brak postaci');
    const pages = (Array.isArray(j.pages) ? j.pages : []).slice(0, stron).map((s, i) => ({
        pageNumber: i + 1, chapterTitle: tekst(s?.chapterTitle, 80) || `Rozdział ${i + 1}`, narrativeText: tekst(s?.narrativeText, 1500),
        dialogueLines: (Array.isArray(s?.dialogueLines) ? s.dialogueLines : []).slice(0, 6).map((l) => {
            const p = postacie.find((x) => x.id === slug(l?.speaker)) ?? null;
            return p && tekst(l?.text, 400) ? { speaker: p.id, speakerLabel: p.name, isDialogue: true, voiceName: p.name, text: tekst(l.text, 400) } : null;
        }).filter(Boolean),
        illustrationPrompt: tekst(s?.illustrationPrompt, 600), imageCaption: tekst(s?.imageCaption, 120),
    }));
    if (pages.length !== stron) throw new Error(`stron jest ${pages.length}, a miało być ${stron}`);
    const pusta = pages.findIndex((s) => !s.narrativeText || !s.illustrationPrompt);
    if (pusta >= 0) throw new Error(`strona ${pusta + 1} bez narracji albo bez opisu obrazu`);
    return { title, subtitle: tekst(j.subtitle, 160), postacie, pages };
}

/**
 * @param {{ katalog: string, pisz: (model:string, system:string, prompt:string) => Promise<string>, model: () => Promise<string>|string,
 *   rysuj: (o:{prompt:string, referencje:string[], szer:number, wys:number, prefiks:string}) => Promise<string>,
 *   obsada?: { lista: () => Promise<any[]>, wzory: (id:string) => Promise<string[]> }, autor?: () => Promise<string>, teraz?: () => number }} cfg
 */
export function utworzSilnikKsiag(cfg) {
    const KAT = cfg.katalog;
    const teraz = cfg.teraz ?? Date.now;
    const pracuje = new Set();
    let kolejka = Promise.resolve();
    const dir = (id) => path.join(KAT, id);
    async function czytaj(id) { if (!ID.test(String(id))) throw Object.assign(new Error('Nie ma takiej księgi.'), { kod: 404 }); try { return JSON.parse(await fs.readFile(path.join(dir(id), 'ksiega.json'), 'utf8')); } catch { throw Object.assign(new Error('Nie ma takiej księgi.'), { kod: 404 }); } }
    async function zapisz(z) { await fs.mkdir(dir(z.id), { recursive: true }); const t = path.join(dir(z.id), `ksiega.json.${process.pid}.tmp`); await fs.writeFile(t, JSON.stringify(z, null, 2)); await fs.rename(t, path.join(dir(z.id), 'ksiega.json')); }
    const krok = (z, opis) => { z.kroki = [...(z.kroki ?? []), { kiedy: new Date(teraz()).toISOString(), opis }].slice(-40); };
    const adres = (id, plik) => `/api/zywe-ksiegi/${id}/obraz/${plik}`;

    async function kopiuj(z, zrodlo, plik) { await fs.copyFile(zrodlo, path.join(dir(z.id), plik)); return adres(z.id, plik); }

    async function przebieg(z) {
        pracuje.add(z.id);
        try {
            // 1. słowo — Kronikarz
            const obsada = cfg.obsada ? (await cfg.obsada.lista()).filter((a) => a.stan === 'zatwierdzony' && z.obsada.includes(a.id)) : [];
            const model = String(await cfg.model());
            let prompt = promptKsiegi({ pomysl: z.pomysl, stron: z.stron, obsada: obsada.map((a) => ({ id: a.id, imie: a.imie, opis: a.opis })) });
            let ks = null, blad = null;
            for (let proba = 0; proba < 2 && !ks; proba++) {
                const odp = await cfg.pisz(model, systemKronikarza(z.jezyk), prompt);
                try { ks = odczytajKsiege(odp, { stron: z.stron, aktorzy: obsada.map((a) => a.id) }); }
                catch (e) { blad = e.message; prompt = `${prompt}\n\nPOPRZEDNIA ODPOWIEDŹ BYŁA ZŁA: ${blad}. Oddaj sam poprawny JSON.`; }
            }
            if (!ks) throw new Error(`Kronikarz dwa razy nie oddał poprawnej księgi (${blad}).`);
            Object.assign(z, { stan: 'postacie', model, ksiega: { id: z.id, title: ks.title, subtitle: ks.subtitle, author: (await cfg.autor?.().catch(() => null)) || 'Katedra OtakOS', sourceType: 'original-story', rentalTier: 'demo',
                characters: ks.postacie.map(({ look: _l, aktor, ...c }) => ({ ...c, description: c.role, voiceName: c.name, voiceSource: 'cathedral', aktor })), pages: ks.pages, look: Object.fromEntries(ks.postacie.map((c) => [c.id, c.look])) } });
            krok(z, `✍️ Kronikarz (${model}): „${ks.title}”, ${ks.pages.length} stron, ${ks.postacie.length} postaci`);
            await zapisz(z);
            // 2. postacie — wycinanki z papieru (zamiast „pionków”), aktor ze Stałej Obsady jako wzór
            const wzoryPostaci = {};
            for (const c of z.ksiega.characters) {
                wzoryPostaci[c.id] = c.aktor && cfg.obsada ? await cfg.obsada.wzory(c.aktor).catch(() => []) : [];
                const plik = await cfg.rysuj({ prompt: `${c.name}, ${z.ksiega.look[c.id] || c.role}${STYL_POSTACI}`, referencje: wzoryPostaci[c.id], szer: 768, wys: 1024, prefiks: `katedra/zywe-ksiegi/${z.id}` });
                c.avatarCutoutUrl = await kopiuj(z, plik, `postac-${c.id}.png`);
                krok(z, `🎭 ${c.name}${c.aktor ? ' (wzór: Stała Obsada)' : ''}`);
                await zapisz(z);
            }
            // 3. strony — wzory postaci, które mówią na stronie (≤ 3)
            z.stan = 'strony'; await zapisz(z);
            for (const s of z.ksiega.pages) {
                const ref = [...new Set(s.dialogueLines.map((l) => l.speaker))].flatMap((id) => wzoryPostaci[id]?.slice(0, 1) ?? []).slice(0, 3);
                const plik = await cfg.rysuj({ prompt: `${s.illustrationPrompt}${STYL}`, referencje: ref, szer: 1280, wys: 720, prefiks: `katedra/zywe-ksiegi/${z.id}` });
                s.imageUrl = await kopiuj(z, plik, `strona-${s.pageNumber}.png`);
                krok(z, `🖼️ strona ${s.pageNumber}`);
                await zapisz(z);
            }
            delete z.ksiega.look;
            Object.assign(z, { stan: 'gotowe', gotowe: new Date(teraz()).toISOString() });
            krok(z, '📖 Księga gotowa — czytaj w czytniku albo opublikuj w Wypożyczalni');
            await zapisz(z);
        } catch (e) {
            Object.assign(z, { stan: 'blad', powod: String(e?.message ?? e).slice(0, 500) });
            krok(z, `⛔ ${z.powod}`);
            await zapisz(z).catch(() => {});
        } finally { pracuje.delete(z.id); }
    }

    async function nowa({ pomysl, stron = 4, jezyk = 'pl', obsada = [] } = {}) {
        if (tekst(pomysl, 1500).length < 10) throw new Error('Opisz pomysł na księgę (co najmniej 10 znaków).');
        const n = Math.round(Number(stron));
        if (!(n >= 1 && n <= MAX_STRON)) throw new Error(`Stron: 1–${MAX_STRON}.`);
        const z = { id: `zk-${crypto.randomBytes(4).toString('hex')}`, stan: 'pisze', utworzono: new Date(teraz()).toISOString(), pomysl: tekst(pomysl, 1500), stron: n,
            jezyk: jezyk === 'en' ? 'en' : 'pl', obsada: (Array.isArray(obsada) ? obsada : []).map(String).filter((x) => /^a-[0-9a-f]{6}$/.test(x)).slice(0, MAX_POSTACI), kroki: [] };
        await zapisz(z);
        kolejka = kolejka.then(() => przebieg(z)).catch(() => {});   // karta graficzna: jedno zadanie naraz
        return z;
    }

    async function lista() {
        const out = [];
        for (const d of await fs.readdir(KAT).catch(() => [])) {
            if (!ID.test(d)) continue;
            try {
                const z = await czytaj(d);
                if (!['gotowe', 'blad'].includes(z.stan) && !pracuje.has(z.id) && !(await czyWKolejce(z))) { Object.assign(z, { stan: 'blad', powod: 'przerwane — most wystartował od nowa w trakcie' }); await zapisz(z); }
                out.push({ id: z.id, stan: z.stan, tytul: z.ksiega?.title ?? null, pomysl: z.pomysl, stron: z.stron, utworzono: z.utworzono, powod: z.powod ?? null, krok: z.kroki?.at(-1)?.opis ?? null });
            } catch { /* uszkodzona — pomijamy */ }
        }
        return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }
    // zadanie czeka w kolejce tej samej instancji — tylko utworzone po starcie (stan „pisze”, młodsze niż start procesu)
    const start = teraz();
    async function czyWKolejce(z) { return z.stan === 'pisze' && Date.parse(z.utworzono) >= start; }

    function plik(id, nazwa) {
        if (!ID.test(String(id)) || !/^(postac-[a-z0-9-]{1,30}|strona-\d{1,2})\.png$/.test(String(nazwa))) return null;
        const p = path.join(dir(id), nazwa);
        return fsSync.existsSync(p) ? p : null;
    }
    /** Adres obrazu księgi (`/api/zywe-ksiegi/<id>/obraz/<plik>`, także pełny URL) → plik na dysku. Dla Wypożyczalni. */
    function plikZAdresu(url) { const m = /\/api\/zywe-ksiegi\/(zk-[0-9a-f]{8})\/obraz\/([a-z0-9.-]+)$/.exec(String(url ?? '')); return m ? plik(m[1], m[2]) : null; }

    async function usun(id) { const z = await czytaj(id); if (pracuje.has(z.id)) throw new Error('Księga właśnie się tworzy.'); await fs.rm(dir(id), { recursive: true, force: true }); return { usunieta: id }; }

    return { nowa, lista, czytaj, plik, plikZAdresu, usun };
}

/** Trasy (Straż `/api/zywe-ksiegi`: maszyna). `gemini` = opcja ☁️ dla czytnika (generateContent kluczem mostu). */
export function zamontujTrasySilnikaKsiag(app, S, { stan = async () => ({}), gemini = null } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    app.get('/api/zywe-ksiegi/stan', (_req, res) => odp(res, stan()));
    app.post('/api/zywe-ksiegi/gemini', (req, res) => {
        if (!gemini) return res.status(503).json({ error: 'Most nie ma klucza Gemini (Kibel → 🔗 Udostępnij mostowi).' });
        return gemini(req.body ?? {}).then((d) => res.json(d)).catch((e) => res.status(502).json({ error: e.message }));
    });
    app.get('/api/zywe-ksiegi', (_req, res) => odp(res, S.lista().then((ksiegi) => ({ ksiegi }))));
    app.post('/api/zywe-ksiegi', (req, res) => odp(res, S.nowa(req.body ?? {}).then((zadanie) => ({ zadanie }))));
    app.get('/api/zywe-ksiegi/:id', (req, res) => odp(res, S.czytaj(req.params.id).then((zadanie) => ({ zadanie }))));
    app.get('/api/zywe-ksiegi/:id/obraz/:plik', (req, res) => { const p = S.plik(req.params.id, req.params.plik); return p ? res.sendFile(p) : res.status(404).end(); });
    app.delete('/api/zywe-ksiegi/:id', (req, res) => odp(res, S.usun(req.params.id)));
}

export default { utworzSilnikKsiag, zamontujTrasySilnikaKsiag, odczytajKsiege, promptKsiegi, systemKronikarza, STYL, STYL_POSTACI };
