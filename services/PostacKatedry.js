/**
 * 🏛️ Postać Katedry (Suweren 2026-10-09: „własna postać mojej Katedry w MRPG… z całym etapem modelowania własnej
 * Katedry”). JEDNA postać na Katedrę — avatar jej Suwerena, z którym schodzi na każdą wyspę Teterhii (MRPG:
 * `?katedra=<nick>` — gra idzie z mostu TEJ Katedry, więc gracz zawsze niesie swoją postać).
 *
 * Droga jak u bohaterów startowych (services/Bohaterowie.js — ta sama karta i etapy z faktów):
 *   z OPISU: 🖼️ obraz w Pracowni (FLUX, „Postać do riga”) → 🗿 bryła (TRELLIS)
 *   ze ZDJĘCIA: 🗿 bryła prosto ze zdjęcia (TRELLIS; pozę do riga daje potem Meshy Image-to-3D z A-pozą)
 *   → ☁️ tekstury i 🦴 rig + chód w Assetach 3D (Meshy, za zgodą) → 📣 OPUBLIKUJ: najlepsza wersja (z chodem →
 *   z teksturami → najnowsza) jako `_OtakOs_Wymiar/postac-katedry/postac.glb`.
 * Opublikowana postać: gra (Brama → „🏛️ Postać Twojej Katedry”) przez `/api/postac-katedry/gra`, a sieć przez pole
 * `postac` w publicznej wizytówce + `GET /wizytowka/postac.glb` (tylko ten plik, tylko odczyt).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { etapBohatera, oczyscBohatera, opisDoObrazu, rodzinaWersji } from './Bohaterowie.js';

const MAX_ZDJECIA = 15 * 1024 * 1024;
const RUCH = /^[a-z][a-z0-9]{1,19}$/;

/** Wszystkie wersje postaci: z obrazu Pracowni (zObrazu) albo potomkowie bryły-korzenia (zdjęcie / podpięta bryła). */
export const rodzinaPostaci = rodzinaWersji;

/**
 * @param {{ katalog: string, assety: { obraz: Function, generuj: Function, lista: Function, metaObrazu: Function, sciezkaPliku: Function },
 *           imieSuwerena?: () => Promise<string|null>, szyna?: object|null }} cfg
 */
export function utworzPostacKatedry({ katalog, assety, imieSuwerena = async () => null, szyna = null }) {
    const plikKarty = path.join(katalog, 'karta.json');
    const plikGlb = path.join(katalog, 'postac.glb');

    async function karta() {
        try { return JSON.parse(await fs.readFile(plikKarty, 'utf8')); } catch { return null; }
    }
    async function zapiszKarte(k) {
        await fs.mkdir(katalog, { recursive: true });
        await fs.writeFile(plikKarty, JSON.stringify({ ...k, zmieniono: new Date().toISOString() }, null, 2), 'utf8');
        return k;
    }

    /** Karta + etap z faktów; bez karty — podpowiedź imienia z księgi GRV. */
    async function stan() {
        const k = await karta();
        if (!k) return { karta: null, imie: await imieSuwerena().catch(() => null), etap: 'brak', opublikowana: null };
        const obraz = k.obraz ? await assety.metaObrazu(k.obraz).catch(() => null) : null;
        const e = etapBohatera({ ...k, wGrze: k.opublikowana }, obraz, rodzinaPostaci(k, await assety.lista()));
        return { karta: k, ...e, etap: e.etap === 'w-grze' ? 'opublikowana' : e.etap, opublikowana: k.opublikowana ?? null };
    }

    /** Nowa karta albo zmiana; nowy wygląd = obraz od nowa (stare obrazy i bryły zostają w Pracowni/Assetach). */
    async function zapisz(dane) {
        const stara = await karta();
        const imie = String(dane?.imie ?? '').trim() || stara?.imie || (await imieSuwerena().catch(() => null)) || '';
        // 🔗 podpięty gotowy obraz z Pracowni / gotowa bryła z Assetów 3D — muszą istnieć
        if (dane?.obraz && !(await assety.metaObrazu(dane.obraz).catch(() => null))) throw new Error('Nie ma takiego obrazu w Pracowni.');
        if (dane?.korzen && !(await assety.lista()).some((m) => m.id === dane.korzen)) throw new Error('Nie ma takiej bryły w Assetach 3D.');
        const k = { ...stara, ...oczyscBohatera({ ...dane, imie, id: 'katedra' }, stara ? { ...stara, id: 'katedra' } : null), opublikowana: stara?.opublikowana ?? null };
        if (stara && stara.opis !== k.opis && dane?.obraz === undefined) k.obraz = null;
        delete k.wGrze;
        return zapiszKarte(k);
    }
    const potrzebnaKarta = async () => {
        const k = await karta();
        if (!k) throw new Error('Najpierw karta postaci (imię i wygląd).');
        return k;
    };

    /** 🖼️ z opisu: obraz w Pracowni (FLUX lokalnie, styl postac3d). */
    async function narysuj() {
        const k = await potrzebnaKarta();
        const r = await assety.obraz({ opis: opisDoObrazu(k), styl: 'postac3d', galaz: 'postacie', projekt: null });
        await zapiszKarte({ ...k, obraz: r.obraz });
        return r;
    }
    /** 🗿 z obrazu Pracowni (TRELLIS lokalnie). */
    async function wyrzezb() {
        const k = await potrzebnaKarta();
        if (!k.obraz) throw new Error('Najpierw obraz postaci (🖼️ z opisu) albo bryła ze zdjęcia.');
        const o = await assety.metaObrazu(k.obraz);
        if (o?.stan !== 'gotowe') throw new Error(o?.stan === 'trwa' ? 'Obraz jeszcze się rysuje.' : 'Obraz postaci się nie udał — narysuj od nowa.');
        return assety.generuj({ zObrazu: k.obraz, nazwa: 'postac-katedry', opis: `${k.imie} — ${k.opis}`, sciany: 20000, rozdzielczosc: 1024 });
    }
    /** 🗿 ze zdjęcia (dataURL png/jpg/webp ≤ 15 MB) → bryła-korzeń rodziny postaci. */
    async function zeZdjecia(dataURL) {
        const k = await potrzebnaKarta();
        const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataURL || ''));
        if (!m) throw new Error('Zdjęcie: PNG, JPG albo WEBP.');
        const bajty = Buffer.from(m[2], 'base64');
        if (bajty.length > MAX_ZDJECIA) throw new Error('Zdjęcie większe niż 15 MB.');
        await fs.mkdir(katalog, { recursive: true });
        const plik = path.join(katalog, `zdjecie.${m[1].replace('jpeg', 'jpg')}`);
        await fs.writeFile(plik, bajty);
        const r = await assety.generuj({ zdjecie: plik, nazwa: 'postac-katedry', opis: `${k.imie} — ${k.opis}`, sciany: 20000, rozdzielczosc: 1024 });
        await zapiszKarte({ ...(await karta()), korzen: r.asset });
        return r;
    }

    /** 📣 Najlepsza wersja → postac.glb (gra i wizytówka). Z chodem = animowany GLB z riga. */
    async function opublikuj() {
        const s = await stan();
        if (!s.karta) throw new Error('Najpierw karta postaci.');
        if (!s.najlepsza) throw new Error('Postać nie ma jeszcze bryły.');
        const ruch = s.najlepsza.ruchy.includes('chod') ? 'chod' : null;
        const zrodlo = assety.sciezkaPliku(s.najlepsza.id, ruch ? `ruch-${ruch}.glb` : 'model.glb');
        if (!zrodlo) throw new Error('Bryła nie ma jeszcze pliku modelu.');
        await fs.mkdir(katalog, { recursive: true });
        await fs.copyFile(zrodlo, plikGlb);
        // 🕹️ pozostałe ruchy riga (bieg, akcje…) jako postac-<ruch>.glb — gra dokłada ich klipy do ciała (src/ruchyPostaci.ts)
        for (const p of await fs.readdir(katalog)) if (/^postac-[a-z0-9]+\.glb$/.test(p)) await fs.rm(path.join(katalog, p), { force: true });
        const ruchy = [];
        for (const r of s.najlepsza.ruchy.filter((x) => x !== ruch && RUCH.test(x))) {
            const z = assety.sciezkaPliku(s.najlepsza.id, `ruch-${r}.glb`);
            if (z) { await fs.copyFile(z, path.join(katalog, `postac-${r}.glb`)); ruchy.push(r); }
        }
        const opublikowana = { zrodlo: s.najlepsza.id, ruch, ruchy, bajtow: (await fs.stat(plikGlb)).size, kiedy: new Date().toISOString() };
        await zapiszKarte({ ...s.karta, opublikowana });
        void szyna?.nadaj?.({ agent: 'Katedra', rodzaj: 'praca', tresc: `🏛️ postać Katedry „${s.karta.imie}” opublikowana${ruch ? ' (z chodem)' : ''} — zejdzie z nią na każdą wyspę Teterhii` })?.catch?.(() => {});
        return opublikowana;
    }
    async function wycofaj() {
        const k = await potrzebnaKarta();
        await fs.rm(plikGlb, { force: true });
        for (const p of await fs.readdir(katalog).catch(() => [])) if (/^postac-[a-z0-9]+\.glb$/.test(p)) await fs.rm(path.join(katalog, p), { force: true });
        return zapiszKarte({ ...k, opublikowana: null });
    }

    /** Dla gry i wizytówki: tylko opublikowana, tylko gdy plik jest. Adres pliku z wersją (przeglądarka nie trzyma starej). */
    async function publiczna() {
        const k = await karta();
        if (!k?.opublikowana || !fsSync.existsSync(plikGlb)) return null;
        const v = Date.parse(k.opublikowana.kiedy) || 0;
        const ruchy = Object.fromEntries((k.opublikowana.ruchy ?? []).filter((r) => fsSync.existsSync(path.join(katalog, `postac-${r}.glb`))).map((r) => [r, `/wizytowka/postac-${r}.glb?v=${v}`]));
        return { imie: k.imie, plec: k.plec, zywiol: k.zywiol, droga: k.droga, opis: k.opis, ruch: k.opublikowana.ruch ?? null, glb: `/wizytowka/postac.glb?v=${v}${k.opublikowana.ruch ? `&ruch=${k.opublikowana.ruch}` : ''}`, ...(Object.keys(ruchy).length ? { ruchy } : {}) };
    }
    /** Plik opublikowanej postaci (bez nazwy) albo jej ruchu (`bieg`, `akcje`…) — tylko z katalogu postaci. */
    const plik = (ruch = null) => {
        if (ruch !== null && !RUCH.test(String(ruch))) return null;
        const p = ruch ? path.join(katalog, `postac-${ruch}.glb`) : plikGlb;
        return fsSync.existsSync(p) ? p : null;
    };

    return { stan, zapisz, narysuj, wyrzezb, zeZdjecia, opublikuj, wycofaj, publiczna, plik };
}

export default { utworzPostacKatedry, rodzinaPostaci };
