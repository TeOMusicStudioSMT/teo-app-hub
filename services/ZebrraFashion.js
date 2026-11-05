/**
 * 👗🦓 Zebrra Fashion — program modowy 0.00G Style + ubieranie postaci + wstawki reklamowe
 * (Suweren 2026-11-06, potok „0.00G Style”, docs/designs/potok-0-00g-style.md, kroki 4–6).
 *
 *  · UBIERANIE (krok 5): „look” = kadr FLUX (Assety3D.kadrFilmu) z DWOMA wzorami — obraz postaci z Pracowni
 *    (`_OtakOs_AI/obrazy-gry/<motyw>/obraz.png`) i makieta przodu kolekcji z TeO Fashion Studio. Rysunek, nie zdjęcie:
 *    FLUX nie zawsze trzyma krój i nadruk (UCZCIWIE — to ilustracja). Look liczy się RAZ na kolekcję
 *    (`zebrra-fashion/looks/<kolekcja>.png`) i służy programowi i wstawkom.
 *  · PROGRAM (krok 4): prowadzący (narrator Gola Dnia, domyślnie Gol Donna) pokazuje kolekcję postaci: INTRO, LOOK n
 *    (po jednym na model), OUTRO. Słowa pisze jego model z FAKTÓW kolekcji (nazwa modelu, tytuł, podtytuł, opowieść,
 *    cytat) — bez cen (cena jest w sklepie), link sklepu w opisie filmu. Kadry: look z głosem + plansza produktu
 *    (makieta przód | tył). Odcinek → Montażownia → Kronikarz (zrodlo.reklama = lokowanie produktu) → ✓ w Izbie.
 *  · WSTAWKA (krok 6): 4 s „0.00G Style — <Imię> collection · <sklep>” na looku — Wieczór Tańca wstawia ją między części.
 * Kolekcje czyta z katalogu Fashion (`OTAKOS_FASHION_DIR` → obok Katedry) — tylko odczyt.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { argumentyKwestii, czasBezGlosu } from './WywiadAktorow.js';
import { CZCIONKI, zawin } from './PowitanieDnia.js';

export const PROJEKT = 'zebrra-fashion';
export const UBIORY_EN = { koszulka: 'T-Shirt', bluza: 'Hoodie', longsleeve: 'Longsleeve', torba: 'Tote Bag', bomber: 'Bomber Jacket', jeansowa: 'Denim Jacket', ramoneska: 'Leather Biker Jacket', parka: 'Hooded Parka', plaszcz: 'Trench Coat', kurtka: 'Varsity Jacket' };
const KOLOR_EN = { czarny: 'black', bialy: 'white', grafitowy: 'graphite', granatowy: 'navy', zielony: 'green', piaskowy: 'sand', burgundowy: 'burgundy' };
/** Kolejność pokazu: od najmocniejszego wejścia (kurtki) do dodatków. */
const KOLEJNOSC = ['kurtka', 'ramoneska', 'bomber', 'jeansowa', 'plaszcz', 'parka', 'bluza', 'longsleeve', 'koszulka', 'torba'];
const MAX_LOOKOW = 10;
const czysty = (s, n = 400) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
export const imieZOpisu = (opis) => /„([^”"]{2,40})[”"]/.exec(String(opis ?? ''))?.[1]?.trim() ?? null;

/** Kolekcje postaci z Fashion: gotowe, najnowsza na model, w kolejności pokazu. */
export async function kolekcjePostaci(katalogFashion, imie) {
    const kat = path.join(katalogFashion, 'public', 'nadruki', 'kolekcje');
    const wszystkie = [];
    for (const d of await fs.readdir(kat).catch(() => [])) {
        const k = await fs.readFile(path.join(kat, d, 'kolekcja.json'), 'utf8').then(JSON.parse).catch(() => null);
        if (!k || k.stan !== 'gotowa') continue;
        const im = imieZOpisu(k.opisMotywu) ?? k.tekst?.tytul ?? '';
        if (String(im).toLowerCase() !== String(imie).toLowerCase()) continue;
        wszystkie.push({ ...k, katalog: path.join(kat, d) });
    }
    wszystkie.sort((a, b) => String(b.kiedy).localeCompare(String(a.kiedy)));
    const naModel = new Map();
    for (const k of wszystkie) if (!naModel.has(k.ubior)) naModel.set(k.ubior, k);
    return [...naModel.values()].sort((a, b) => (KOLEJNOSC.indexOf(a.ubior) + 99) % 99 - (KOLEJNOSC.indexOf(b.ubior) + 99) % 99).slice(0, MAX_LOOKOW);
}

export function promptLooku(k) {
    const u = UBIORY_EN[k.ubior] ?? k.ubior, kol = KOLOR_EN[k.kolor] ?? 'black';
    return `fashion show photo on a stylish TV studio runway: the small creature character from the first reference image, same face, same colours and proportions, now WEARING the garment from the second reference image — a ${kol} ${u} with the same prints and patches, fitted to its small body, full figure, confident pose, soft spotlights, dark elegant set with gold accents, shallow depth of field, no extra characters, no text, no logos, no watermark`;
}

export const SYSTEM_PREZENTERA = (imie, temperament, jezyk) => `You are ${imie}, presenter of the TV show "Zebrra Fashion" (fashion brand 0.00G Style). Temperament: ${temperament}.
Language of ALL lines: ${jezyk === 'pl' ? 'Polish' : 'English'}.
You present a clothing collection inspired by a character from the TeOgochi Mini series. Use ONLY the facts given: garment name, title, subtitle, story, quote. Never invent prices, materials, sizes or discounts. No markdown, no emoji, no hashtags.
Answer with EXACTLY these lines, each starting with its label:
INTRO: 2–3 sentences welcoming viewers and introducing the character and the 0.00G Style collection.
LOOK 1: … (one line per look, 2–3 sentences: what the garment is and which story from the series it carries)
OUTRO: 1–2 sentences — invite viewers to the shop (link in the description) and say goodbye.`;

export function promptPokazu(imie, kolekcje) {
    return `CHARACTER: ${imie}\nLOOKS (${kolekcje.length}):\n${kolekcje.map((k, i) => `LOOK ${i + 1}: ${UBIORY_EN[k.ubior] ?? k.ubior} (${k.styl === 'haft' ? 'chenille patches' : 'print'}) — title: ${czysty(k.tekst?.tytul, 60)}; subtitle: ${czysty(k.tekst?.podtytul, 120)}; story: ${czysty(k.tekst?.opowiesc, 420)}; quote: ${czysty(k.tekst?.cytat, 140)}`).join('\n')}\nWrite INTRO, LOOK 1…LOOK ${kolekcje.length}, OUTRO.`;
}

/** „INTRO: …”, „LOOK n: …”, „OUTRO: …” — dokładnie tyle looków, każda linia ≤ 420 znaków. */
export function odczytajPokaz(tekst, ile) {
    const t = String(tekst ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\*\*/g, '');
    const linia = (re) => czysty(re.exec(t)?.[1], 420);
    const intro = linia(/^\s*INTRO\s*[:：]\s*(.+)$/im), outro = linia(/^\s*OUTRO\s*[:：]\s*(.+)$/im);
    const looki = [];
    for (let i = 1; i <= ile; i++) looki.push(linia(new RegExp(`^\\s*LOOK\\s*${i}\\s*[:：]\\s*(.+)$`, 'im')));
    const brak = [!intro && 'INTRO', ...looki.map((l, i) => !l && `LOOK ${i + 1}`), !outro && 'OUTRO'].filter(Boolean);
    if (brak.length) throw new Error(`Brak linii: ${brak.join(', ')}.`);
    if (/\d+([.,]\d+)?\s*(€|eur|zł|pln|\$|usd)/i.test([intro, ...looki, outro].join(' '))) throw new Error('Prezenter podał cenę — cena jest tylko w sklepie.');
    return { intro, looki, outro };
}

/**
 * @param {{ katalog: string, katalogFashion: string, katalogObrazow: string, katalogMontazy: (p:string)=>Promise<string>,
 *   rysuj: (o:{prompt:string, referencje:string[], prefiks:string, szer?:number, wys?:number}) => Promise<string>,
 *   pisz: (model:string, system:string, prompt:string) => Promise<string>, model: (narrator:string) => Promise<string>,
 *   narrator: (id:string) => ({imie:string, kolor:string, temperament?:string}|null),
 *   mow?: (o:{tekst:string, narrator:string, jezyk:string}) => Promise<{audio:Buffer, ext?:string}>,
 *   opisz: (p:string) => Promise<{sekundy?:number}>, ffmpeg: string, uruchom: Function,
 *   publikuj?: (z:object) => Promise<any>, sklep?: (imie:string) => Promise<string|null>, teraz?: () => number }} cfg
 */
export function utworzZebrraFashion(cfg) {
    const teraz = cfg.teraz ?? (() => Date.now());
    const LOOKI = path.join(cfg.katalog, 'looks');
    const dirOd = (id) => path.join(cfg.katalog, id);
    const czytaj = (id) => fs.readFile(path.join(dirOd(id), 'odcinek.json'), 'utf8').then(JSON.parse);
    const pisz = async (s) => { await fs.mkdir(dirOd(s.id), { recursive: true }); await fs.writeFile(path.join(dirOd(s.id), 'odcinek.json'), JSON.stringify(s, null, 2), 'utf8'); };
    const ffmpeg = (args, cwd) => cfg.uruchom(cfg.ffmpeg, args, { cwd, windowsHide: true, maxBuffer: 1 << 24 });
    let kolejka = Promise.resolve();
    const wRobocie = new Set();

    /** Look kolekcji (FLUX raz na kolekcję). Zwraca ścieżkę PNG. */
    async function look(k) {
        const cel = path.join(LOOKI, `${k.id}.png`);
        if (fsSync.existsSync(cel)) return cel;
        const postac = path.join(cfg.katalogObrazow, String(k.obraz), 'obraz.png');
        const makieta = path.join(k.katalog, 'podglad-przod.png');
        for (const p of [postac, makieta]) if (!fsSync.existsSync(p)) throw new Error(`Brak wzoru: ${p}`);
        const plik = await cfg.rysuj({ prompt: promptLooku(k), referencje: [postac, makieta], prefiks: `katedra/zebrra-fashion/${k.id}`, szer: 1280, wys: 720 });
        await fs.mkdir(LOOKI, { recursive: true });
        await fs.copyFile(plik, cel);
        return cel;
    }
    const looki = async (imie) => {
        const ks = await kolekcjePostaci(cfg.katalogFashion, imie);
        if (!ks.length) throw new Error(`Postać „${imie}” nie ma gotowych kolekcji w TeO Fashion Studio.`);
        const out = [];
        for (const k of ks) out.push({ kolekcja: k.id, ubior: k.ubior, plik: await look(k) });
        return out;
    };

    async function plansza(k, praca, nr) {
        // makieta przód | tył obok siebie na ciemnym tle 1280×720
        const wyj = `produkt-${nr}.png`;
        await ffmpeg(['-y', '-i', path.join(k.katalog, 'podglad-przod.png'), '-i', path.join(k.katalog, 'podglad-tyl.png'), '-filter_complex',
            '[0]scale=-2:640[a];[1]scale=-2:640[b];[a][b]hstack=inputs=2,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0b0b10', '-frames:v', '1', wyj], praca);
        return wyj;
    }
    async function segment(praca, { nr, obraz, naglowek, tekst, kto, kolor, jezyk, glos }) {
        let audio = null, dl = czasBezGlosu(tekst);
        if (glos && cfg.mow) {
            const g = await cfg.mow({ tekst, narrator: kto, jezyk }).catch(() => cfg.mow({ tekst, narrator: kto, jezyk }));
            audio = `a-${nr}.${g.ext || 'wav'}`;
            await fs.writeFile(path.join(praca, audio), g.audio);
            const sek = (await cfg.opisz(path.join(praca, audio)).catch(() => null))?.sekundy;
            if (sek) dl = Math.max(2.5, Math.round((sek + 0.6) * 100) / 100);
        }
        await fs.writeFile(path.join(praca, `n-${nr}.txt`), naglowek, 'utf8');
        const pliki = [];
        for (const [j, l] of zawin(tekst, 58).slice(0, 4).entries()) { const n = `l-${nr}-${j}.txt`; await fs.writeFile(path.join(praca, n), l, 'utf8'); pliki.push(n); }
        const wyj = `seg-${String(nr).padStart(3, '0')}.mp4`;
        await ffmpeg(argumentyKwestii({ obraz, klip: null, kolor, imiePlik: `n-${nr}.txt`, liniePliki: pliki, czcionka: 'czcionka.ttf', czas: dl, audio, wyjscie: wyj }), praca);
        return wyj;
    }
    const czcionkaDo = async (praca) => {
        const c = CZCIONKI.find((p) => p && fsSync.existsSync(p));
        if (!c) throw new Error('Nie znalazłem czcionki.');
        await fs.copyFile(c, path.join(praca, 'czcionka.ttf'));
    };

    async function produkuj(s) {
        const praca = path.join(dirOd(s.id), 'praca');
        await fs.mkdir(praca, { recursive: true });
        const etap = async (nazwa, fn) => { s.etap = nazwa; await pisz(s); await fn(); };
        try {
            await czcionkaDo(praca);
            const ks = await kolekcjePostaci(cfg.katalogFashion, s.postac);
            if (!ks.length) throw new Error(`Postać „${s.postac}” nie ma gotowych kolekcji w TeO Fashion Studio.`);
            const N = cfg.narrator(s.narrator) ?? { imie: 'Gol Donna', kolor: '#d8b4fe' };
            await etap('looki', async () => { s.looki = []; for (const k of ks) s.looki.push({ kolekcja: k.id, ubior: k.ubior, plik: await look(k) }); });
            await etap('scenariusz', async () => {
                const model = await cfg.model(s.narrator);
                const sys = SYSTEM_PREZENTERA(N.imie, N.temperament ?? 'warm, elegant, a little playful', s.jezyk);
                let blad = null;
                for (let proba = 0; proba < 2; proba++) {
                    const t = await cfg.pisz(model, sys, promptPokazu(s.postac, ks) + (blad ? `\nYOUR PREVIOUS ANSWER WAS REJECTED: ${blad} Fix it.` : ''));
                    try { s.scenariusz = odczytajPokaz(t, ks.length); blad = null; break; } catch (e) { blad = e.message; }
                }
                if (blad) throw new Error(`scenariusz: ${blad}`);
            });
            await etap('segmenty', async () => {
                const seg = []; let nr = 0;
                const glos = !s.bezGlosu, kto = s.narrator;
                const tytul = s.jezyk === 'pl' ? `0.00G Style · kolekcja ${s.postac}` : `0.00G Style · ${s.postac} collection`;
                seg.push(await segment(praca, { nr: ++nr, obraz: s.looki[0].plik, naglowek: `${N.imie} · Zebrra Fashion`, tekst: s.scenariusz.intro, kto, kolor: N.kolor, jezyk: s.jezyk, glos }));
                for (const [i, k] of ks.entries()) {
                    seg.push(await segment(praca, { nr: ++nr, obraz: s.looki[i].plik, naglowek: `${N.imie} · ${UBIORY_EN[k.ubior] ?? k.ubior}`, tekst: s.scenariusz.looki[i], kto, kolor: N.kolor, jezyk: s.jezyk, glos }));
                    const pl = await plansza(k, praca, i + 1);
                    seg.push(await segment(praca, { nr: ++nr, obraz: path.join(praca, pl), naglowek: tytul, tekst: `${UBIORY_EN[k.ubior] ?? k.ubior} — ${czysty(k.tekst?.tytul, 60)}`, kto, kolor: N.kolor, jezyk: s.jezyk, glos: false }));
                }
                seg.push(await segment(praca, { nr: ++nr, obraz: s.looki[0].plik, naglowek: tytul, tekst: s.scenariusz.outro, kto, kolor: N.kolor, jezyk: s.jezyk, glos }));
                s.segmenty = seg;
            });
            await etap('sklejenie', async () => {
                await fs.writeFile(path.join(praca, 'lista.txt'), s.segmenty.map((x) => `file '${x}'`).join('\n'), 'utf8');
                const kat = await cfg.katalogMontazy(PROJEKT);
                await fs.mkdir(kat, { recursive: true });
                const cel = path.join(kat, `fashion_${s.postac.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '')}_${s.jezyk}_${s.id.slice(2)}.mp4`);
                await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', '-movflags', '+faststart', cel], praca);
                s.plik = cel;
                s.sekundy = (await cfg.opisz(cel).catch(() => null))?.sekundy ?? null;
            });
            await etap('publikacja', async () => {
                if (!cfg.publikuj) return;
                const url = await cfg.sklep?.(s.postac).catch(() => null);
                const p = await cfg.publikuj({ plik: s.plik, nazwa: `Zebrra Fashion — ${s.postac}`, jezyk: s.jezyk, zrodlo: { projekt: PROJEKT, fashion: s.id, mini: s.postac, reklama: true },
                    kontekst: `Zebrra Fashion — fashion show of the 0.00G Style collection inspired by ${s.postac} (TeOgochi Mini series). Presenter: ${N.imie}. Looks: ${ks.map((k) => `${UBIORY_EN[k.ubior] ?? k.ubior} „${czysty(k.tekst?.tytul, 50)}”`).join(', ')}. Images are AI illustrations of the character wearing the designs. Contains product placement of the brand's own products.${url ? ` Shop: ${url}` : ''}` });
                s.publikacja = { id: p?.id ?? null, etap: p?.etap ?? null };
            });
            Object.assign(s, { stan: 'gotowy', etap: null, powod: null });
        } catch (e) { Object.assign(s, { stan: 'blad', powod: `${s.etap}: ${String(e.message || e).slice(0, 400)}` }); }
        await pisz(s);
    }

    async function utworz({ postac, narrator = 'zebra', jezyk = 'en', bezGlosu = false } = {}) {
        const im = czysty(postac, 40);
        if (!im) throw new Error('Podaj postać (imię z kolekcji Fashion).');
        if (!(await kolekcjePostaci(cfg.katalogFashion, im)).length) throw new Error(`Postać „${im}” nie ma gotowych kolekcji w TeO Fashion Studio.`);
        if (!cfg.narrator(narrator)) throw new Error(`Nieznany prowadzący: ${narrator}.`);
        const s = { id: `f-${crypto.randomBytes(4).toString('hex')}`, postac: im, narrator, jezyk: jezyk === 'pl' ? 'pl' : 'en', bezGlosu: !!bezGlosu, stan: 'robi', etap: 'kolejka', kiedy: new Date(teraz()).toISOString(), looki: [], scenariusz: null, plik: null, powod: null };
        await pisz(s);
        wRobocie.add(s.id);
        kolejka = kolejka.then(() => produkuj(s)).finally(() => wRobocie.delete(s.id));
        return s;
    }
    async function lista() {
        const out = [];
        for (const d of await fs.readdir(cfg.katalog).catch(() => [])) {
            if (!/^f-[0-9a-f]{8}$/.test(d)) continue;
            const s = await czytaj(d).catch(() => null);
            if (!s) continue;
            if (s.stan === 'robi' && !wRobocie.has(s.id)) { Object.assign(s, { stan: 'blad', powod: `${s.etap}: przerwane (restart mostu)` }); await pisz(s).catch(() => {}); }
            out.push(s);
        }
        return out.sort((a, b) => String(b.kiedy).localeCompare(String(a.kiedy)));
    }

    /** 🛍️ Wstawka reklamowa 4 s: look (kurtka pierwsza) + „0.00G Style — <Imię> collection” + sklep. Raz na postać/język/sklep. */
    async function wstawka(imie, { jezyk = 'en' } = {}) {
        const ks = await kolekcjePostaci(cfg.katalogFashion, imie);
        if (!ks.length) return null;
        const url = (await cfg.sklep?.(imie).catch(() => null)) || null;
        const klucz = crypto.createHash('sha1').update(`${imie}|${jezyk}|${url}|${ks[0].id}`).digest('hex').slice(0, 10);
        const cel = path.join(cfg.katalog, 'wstawki', `reklama-${klucz}.mp4`);
        if (fsSync.existsSync(cel)) return cel;
        const plik = await look(ks[0]);
        const praca = path.join(cfg.katalog, 'wstawki', `praca-${klucz}`);
        await fs.mkdir(praca, { recursive: true });
        await czcionkaDo(praca);
        const tekst = `${jezyk === 'pl' ? `Kolekcja ${imie}` : `${imie} collection`} · 0.00G Style${url ? ` · ${url.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : ''}`;
        const seg = await segment(praca, { nr: 1, obraz: plik, naglowek: '🛍️ 0.00G Style', tekst, kto: null, kolor: '#c9a44c', jezyk, glos: false });
        await fs.copyFile(path.join(praca, seg), cel);
        await fs.rm(praca, { recursive: true, force: true });
        return cel;
    }
    return { utworz, lista, czytaj, looki, wstawka, katalogLookow: LOOKI };
}

/** Trasy (Straż `/api/zebrra-fashion`: maszyna). */
export function zamontujTrasyZebrraFashion(app, F) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(400).json({ success: false, message: e.message }));
    app.get('/api/zebrra-fashion', (_req, res) => odp(res, F.lista().then((odcinki) => ({ odcinki }))));
    app.post('/api/zebrra-fashion', (req, res) => odp(res, F.utworz(req.body ?? {}).then((odcinek) => ({ odcinek }))));
    app.post('/api/zebrra-fashion/looki', (req, res) => odp(res, F.looki(String(req.body?.postac ?? '')).then((looki) => ({ looki }))));
    app.post('/api/zebrra-fashion/wstawka', (req, res) => odp(res, F.wstawka(String(req.body?.postac ?? ''), { jezyk: req.body?.jezyk }).then((plik) => ({ plik }))));
    app.get('/api/zebrra-fashion/:id', (req, res) => odp(res, (/^f-[0-9a-f]{8}$/.test(req.params.id) ? F.czytaj(req.params.id) : Promise.reject(new Error('Zły odcinek.'))).then((odcinek) => ({ odcinek }))));
    app.get('/api/zebrra-fashion/look/:kolekcja', async (req, res) => {
        if (!/^k-[0-9a-f]{8}$/.test(req.params.kolekcja)) return res.status(400).end();
        const p = path.resolve(F.katalogLookow ?? '', `${req.params.kolekcja}.png`);
        res.sendFile(p, (e) => { if (e) res.status(404).end(); });
    });
}
