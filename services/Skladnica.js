/**
 * 📦 Składnica Katedry — wspólne assety dla wszystkich modułów (`_OtakOs_Assety`).
 *
 * Suweren (2026-10-05): „mamy jakiś główny katalog z assetami do postaci i modeli scen, z którego mogą czerpać
 * wszystkie moduły… jak story i games… fashion…” — „buduj Składnicę w _OtakOs_Assety”.
 *
 * Dotąd każdy moduł trzymał swoje: obsada Wywiadów (`_OtakOs_Wymiar/aktorzy`, same ścieżki), biblioteka Reżysera
 * (`produkcje/<projekt>/assety`, celowo per projekt), bryły (`_OtakOs_AI/assety3d`), paczki gier (`TeO_Vault`),
 * kreacje w repo Fashion. Składnica jest tym, co WSPÓLNE — postać czy scena, która żyje dłużej niż jeden projekt.
 *
 * Układ na dysku (prawda = pliki; karta = opis):
 *   _OtakOs_Assety/<rodzaj>/<id>/karta.json   {id, rodzaj, nazwa, opis, tagi, kolor, glos, glowny, zrodlo, …}
 *   _OtakOs_Assety/<rodzaj>/<id>/<pliki>      portrety, klipy, kadry, panoramy, bryły, próbki głosu…
 *   _OtakOs_Assety/_kosz/<data>_<rodzaj>_<id> usunięte (NIC nie znika na zawsze — to dzieła Suwerena)
 * Katalog wrzucony ręcznie przez Eksplorator też jest assetem (bez karty: nazwa = nazwa katalogu).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const RODZAJE = {
    postacie: { etykieta: 'Postacie', ikona: '🎭', opis: 'Aktorzy, bohaterowie, awatary — twarz, klip, głos, kolor' },
    sceny: { etykieta: 'Sceny', ikona: '🏞️', opis: 'Lokacje, studia, panoramy, tła' },
    rekwizyty: { etykieta: 'Rekwizyty', ikona: '🗝️', opis: 'Przedmioty opowieści i gier' },
    kreacje: { etykieta: 'Kreacje', ikona: '👗', opis: 'Stroje i projekty z Fashion' },
    bryly: { etykieta: 'Bryły 3D', ikona: '🗿', opis: 'Modele 3D (glb/gltf/obj/fbx)' },
};

export const OBRAZ = /\.(png|jpe?g|webp|gif|bmp)$/i;
export const WIDEO = /\.(mp4|mov|webm|mkv|m4v)$/i;
export const AUDIO = /\.(wav|mp3|flac|ogg|m4a|opus)$/i;
export const BRYLA = /\.(glb|gltf|obj|fbx|usdz|blend|stl|ply)$/i;
export const MAX_BAJTOW = 500 * 1024 * 1024;
const KARTA = 'karta.json';

export function rodzajPliku(nazwa) {
    if (OBRAZ.test(nazwa)) return 'obraz';
    if (WIDEO.test(nazwa)) return 'wideo';
    if (AUDIO.test(nazwa)) return 'audio';
    if (BRYLA.test(nazwa)) return 'bryla';
    return 'inne';
}

/** Id z nazwy: bez ogonków, a–z0–9 i „-”, max 48. */
export function idZNazwy(nazwa) {
    return String(nazwa ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');
}

/** Nazwa pliku bezpieczna dla Windows (rozszerzenie zostaje). */
export function bezpiecznaNazwaPliku(nazwa) {
    const n = String(nazwa ?? '').split(/[\\/]/).pop().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
        .replace(/[^A-Za-z0-9 _.()-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 100);
    if (!n || n === KARTA) throw new Error('Zła nazwa pliku.');
    return n;
}

const tekst = (v, max) => String(v ?? '').trim().slice(0, max);
const tagi = (v) => [...new Set((Array.isArray(v) ? v : String(v ?? '').split(','))
    .map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 20).map((t) => t.slice(0, 32));

/**
 * @param {{ katalog: string, kopiuj?: (z: string, do: string) => Promise<void> }} o
 */
export function utworzSkladnice({ katalog, kopiuj = (z, d) => fs.copyFile(z, d) }) {
    const korzen = path.resolve(katalog);

    function sprawdzRodzaj(rodzaj) {
        if (!Object.hasOwn(RODZAJE, rodzaj)) throw new Error(`Nieznany rodzaj „${rodzaj}” — są: ${Object.keys(RODZAJE).join(', ')}.`);
        return rodzaj;
    }
    function katalogAssetu(rodzaj, id) {
        sprawdzRodzaj(rodzaj);
        const czysty = String(id ?? '');
        if (!czysty || czysty.startsWith('.') || /[\\/]/.test(czysty) || czysty === '_kosz') throw new Error('Złe id assetu.');
        return path.join(korzen, rodzaj, czysty);
    }
    function sciezkaPliku(rodzaj, id, plik) {
        const kat = katalogAssetu(rodzaj, id);
        const p = path.resolve(kat, String(plik ?? ''));
        if (path.dirname(p) !== kat || path.basename(p) === KARTA) throw new Error('Plik spoza assetu.');
        return p;
    }

    async function wczytaj(rodzaj, id) {
        const kat = katalogAssetu(rodzaj, id);
        const st = await fs.stat(kat).catch(() => null);
        if (!st?.isDirectory()) throw new Error(`Nie ma assetu ${rodzaj}/${id}.`);
        let karta = {};
        try { karta = JSON.parse(await fs.readFile(path.join(kat, KARTA), 'utf-8')); } catch { /* katalog wrzucony ręcznie */ }
        const pliki = [];
        for (const w of await fs.readdir(kat, { withFileTypes: true }).catch(() => [])) {
            if (!w.isFile() || w.name === KARTA || w.name.startsWith('.')) continue;
            const s = await fs.stat(path.join(kat, w.name)).catch(() => null);
            if (s) pliki.push({ nazwa: w.name, rodzaj: rodzajPliku(w.name), bajtow: s.size, sciezka: path.join(kat, w.name), czas: s.mtimeMs });
        }
        pliki.sort((a, b) => a.nazwa.localeCompare(b.nazwa));
        const glowny = pliki.find((p) => p.nazwa === karta.glowny) ?? pliki.find((p) => p.rodzaj === 'obraz') ?? pliki.find((p) => p.rodzaj === 'wideo') ?? null;
        return {
            id, rodzaj, nazwa: karta.nazwa || id, opis: karta.opis || '', tagi: karta.tagi || [], kolor: karta.kolor || null,
            glos: karta.glos || null, rola: karta.rola || '', zrodlo: karta.zrodlo || null,
            glowny: glowny?.nazwa ?? null, pliki, katalog: kat, maKarte: Object.keys(karta).length > 0,
            utworzono: karta.utworzono || new Date(st.birthtimeMs || st.mtimeMs).toISOString(), zmieniono: karta.zmieniono || null,
        };
    }

    async function lista({ rodzaj = '', szukaj = '' } = {}) {
        const rodzaje = rodzaj ? [sprawdzRodzaj(rodzaj)] : Object.keys(RODZAJE);
        const q = String(szukaj).trim().toLowerCase();
        const wynik = [];
        for (const r of rodzaje) {
            for (const w of await fs.readdir(path.join(korzen, r), { withFileTypes: true }).catch(() => [])) {
                if (!w.isDirectory() || w.name.startsWith('.') || w.name.startsWith('_')) continue;
                const a = await wczytaj(r, w.name).catch(() => null);
                if (!a) continue;
                if (q && ![a.nazwa, a.opis, a.id, ...a.tagi].join(' ').toLowerCase().includes(q)) continue;
                wynik.push(a);
            }
        }
        return wynik.sort((a, b) => a.rodzaj.localeCompare(b.rodzaj) || a.nazwa.localeCompare(b.nazwa));
    }

    async function zapiszKarte(rodzaj, id, karta) {
        const kat = katalogAssetu(rodzaj, id);
        await fs.mkdir(kat, { recursive: true });
        const tmp = path.join(kat, `.${KARTA}.${process.pid}.tmp`);
        await fs.writeFile(tmp, JSON.stringify(karta, null, 2));
        await fs.rename(tmp, path.join(kat, KARTA));
    }

    /** Nowy asset albo zmiana karty (`id` podane = zmiana; bez `id` = nowy z nazwy, unikalny). */
    async function zapisz(dane = {}) {
        const rodzaj = sprawdzRodzaj(String(dane.rodzaj ?? ''));
        const nazwa = tekst(dane.nazwa, 80);
        let id = dane.id ? String(dane.id) : '';
        let stara = null;
        if (id) stara = await wczytaj(rodzaj, id);
        else {
            if (!nazwa) throw new Error('Podaj nazwę.');
            const baza = idZNazwy(nazwa) || 'asset';
            id = baza;
            for (let n = 2; fsSync.existsSync(katalogAssetu(rodzaj, id)); n++) id = `${baza}-${n}`;
        }
        const pole = (k, f) => (Object.hasOwn(dane, k) ? f(dane[k]) : stara?.[k]);
        const kolor = pole('kolor', (v) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : null));
        const glos = pole('glos', (v) => (v && typeof v === 'object' ? (v.voicestudio ? { voicestudio: tekst(v.voicestudio, 80) } : v.profil ? { profil: tekst(v.profil, 80) } : null) : null));
        const glowny = pole('glowny', (v) => (v ? path.basename(String(v)) : null));
        if (glowny && !fsSync.existsSync(sciezkaPliku(rodzaj, id, glowny))) throw new Error(`Główny plik „${glowny}” nie leży w tym assecie.`);
        const karta = {
            id, rodzaj, nazwa: (Object.hasOwn(dane, 'nazwa') ? nazwa : stara?.nazwa) || id,
            opis: pole('opis', (v) => tekst(v, 2000)) ?? '', tagi: pole('tagi', tagi) ?? [], rola: pole('rola', (v) => tekst(v, 120)) ?? '',
            kolor: kolor ?? null, glos: glos ?? null, glowny: glowny ?? null, zrodlo: stara?.zrodlo ?? (dane.zrodlo ? tekst(dane.zrodlo, 300) : null),
            utworzono: stara?.utworzono ?? new Date().toISOString(), zmieniono: new Date().toISOString(),
        };
        await zapiszKarte(rodzaj, id, karta);
        return wczytaj(rodzaj, id);
    }

    function wolnaNazwa(kat, nazwa) {
        let n = nazwa;
        const roz = path.extname(nazwa), baza = nazwa.slice(0, nazwa.length - roz.length);
        for (let i = 2; fsSync.existsSync(path.join(kat, n)); i++) n = `${baza} (${i})${roz}`;
        return n;
    }

    /** Plik do assetu: z zawartości (`dataURL`) albo kopia istniejącego pliku (`sciezka`). Oryginał zostaje. */
    async function dodajPlik(rodzaj, id, { nazwa = '', dataURL = '', sciezka = '' } = {}) {
        await wczytaj(rodzaj, id);
        const kat = katalogAssetu(rodzaj, id);
        if (sciezka) {
            const z = path.resolve(String(sciezka));
            const st = await fs.stat(z).catch(() => null);
            if (!st?.isFile()) throw new Error(`Nie ma pliku: ${z}`);
            if (st.size > MAX_BAJTOW) throw new Error('Plik większy niż 500 MB.');
            const cel = path.join(kat, wolnaNazwa(kat, bezpiecznaNazwaPliku(nazwa || path.basename(z))));
            await kopiuj(z, cel);
            return { nazwa: path.basename(cel), sciezka: cel };
        }
        const m = String(dataURL).match(/^data:[^,]*;base64,(.+)$/s);
        if (!m) throw new Error('Podaj plik (dataURL) albo ścieżkę istniejącego pliku.');
        const bufor = Buffer.from(m[1], 'base64');
        if (!bufor.length) throw new Error('Plik jest pusty.');
        if (bufor.length > MAX_BAJTOW) throw new Error('Plik większy niż 500 MB.');
        const cel = path.join(kat, wolnaNazwa(kat, bezpiecznaNazwaPliku(nazwa)));
        await fs.writeFile(cel, bufor);
        return { nazwa: path.basename(cel), sciezka: cel };
    }

    /** Do kosza, nie w nicość. */
    async function doKosza(zrodlo, opis) {
        const kosz = path.join(korzen, '_kosz');
        await fs.mkdir(kosz, { recursive: true });
        const cel = path.join(kosz, `${new Date().toISOString().replace(/[:.]/g, '-')}_${opis}`);
        await fs.rename(zrodlo, cel);
        return cel;
    }
    async function usunPlik(rodzaj, id, plik) {
        const p = sciezkaPliku(rodzaj, id, plik);
        if (!fsSync.existsSync(p)) throw new Error(`Nie ma pliku ${plik}.`);
        return { kosz: await doKosza(p, `${rodzaj}_${id}_${path.basename(p)}`) };
    }
    async function usun(rodzaj, id) {
        await wczytaj(rodzaj, id);
        return { kosz: await doKosza(katalogAssetu(rodzaj, id), `${rodzaj}_${id}`) };
    }

    /**
     * Obsada Wywiadów → postacie Składnicy (kopie zdjęcia i klipu; karta niesie imię, rolę, kolor i głos).
     * Postać, która już przyszła z tej obsady (`zrodlo: obsada:<id>`), nie dubluje się.
     */
    async function importujObsade(aktorzy = []) {
        const juz = new Map((await lista({ rodzaj: 'postacie' })).filter((a) => a.zrodlo?.startsWith('obsada:')).map((a) => [a.zrodlo.slice(7), a]));
        const wynik = { dodane: [], pominiete: [] };
        for (const ak of aktorzy) {
            if (!ak?.id || (ak.id === 'kronikarz' && !ak.zdjecie)) continue;
            if (juz.has(ak.id)) { wynik.pominiete.push({ id: ak.id, powod: `już jest jako ${juz.get(ak.id).id}` }); continue; }
            const a = await zapisz({ rodzaj: 'postacie', nazwa: ak.imie || ak.id, rola: ak.rola || '', kolor: ak.kolor, glos: ak.glos, zrodlo: `obsada:${ak.id}` });
            let glowny = null;
            for (const p of [ak.zdjecie, ak.wideo]) {
                if (p && fsSync.existsSync(p)) { const f = await dodajPlik('postacie', a.id, { sciezka: p }); glowny ??= f.nazwa; }
            }
            if (glowny) await zapisz({ rodzaj: 'postacie', id: a.id, glowny });
            wynik.dodane.push(a.id);
        }
        return wynik;
    }

    /**
     * Katalog z dysku → Składnica (KOPIE, oryginał zostaje).
     * tryb 'folder' = cały katalog jednym assetem; 'pliki' = każdy obraz/klip/bryła osobnym assetem;
     * 'podkatalogi' = każdy podkatalog osobnym assetem (pliki luzem — jak 'pliki').
     */
    async function importujKatalog({ sciezka = '', rodzaj = '', tryb = 'podkatalogi' } = {}) {
        sprawdzRodzaj(rodzaj);
        const z = path.resolve(String(sciezka));
        if (!(await fs.stat(z).catch(() => null))?.isDirectory()) throw new Error(`Nie ma katalogu: ${z}`);
        if (z === korzen || z.startsWith(korzen + path.sep)) throw new Error('Ten katalog już jest w Składnicy.');
        const uzyteczny = (n) => rodzajPliku(n) !== 'inne';
        const wpisy = await fs.readdir(z, { withFileTypes: true });
        const dodane = [];
        const zPlikami = async (nazwa, pliki, zrodlo) => {
            if (!pliki.length) return;
            const a = await zapisz({ rodzaj, nazwa, zrodlo });
            for (const p of pliki) await dodajPlik(rodzaj, a.id, { sciezka: p });
            dodane.push(a.id);
        };
        const luzem = wpisy.filter((w) => w.isFile() && uzyteczny(w.name)).map((w) => path.join(z, w.name));
        if (tryb === 'folder') {
            const wszystkie = [...luzem];
            for (const w of wpisy.filter((x) => x.isDirectory())) {
                for (const f of await fs.readdir(path.join(z, w.name), { withFileTypes: true })) if (f.isFile() && uzyteczny(f.name)) wszystkie.push(path.join(z, w.name, f.name));
            }
            await zPlikami(path.basename(z), wszystkie, z);
        } else {
            for (const p of luzem) await zPlikami(path.basename(p, path.extname(p)).replace(/[_-]+/g, ' '), [p], p);
            if (tryb === 'podkatalogi') {
                for (const w of wpisy.filter((x) => x.isDirectory() && !x.name.startsWith('.'))) {
                    const kat = path.join(z, w.name);
                    const pliki = (await fs.readdir(kat, { withFileTypes: true })).filter((f) => f.isFile() && uzyteczny(f.name)).map((f) => path.join(kat, f.name));
                    await zPlikami(w.name, pliki, kat);
                }
            }
        }
        return { dodane };
    }

    /**
     * Przyjęcie z innego modułu (Assety3D, Fashion…): asset z kopiami plików. Ten sam `zrodlo` drugi raz = ten sam
     * asset, dokładane są tylko brakujące pliki (po nazwie) — ponowny import nie dubluje.
     */
    async function przyjmij({ rodzaj, nazwa, opis = '', tagi: t = [], pliki = [], glowny = null, zrodlo }) {
        sprawdzRodzaj(rodzaj);
        if (!zrodlo) throw new Error('Przyjęcie potrzebuje źródła (np. assety3d:<id>).');
        const istniejace = pliki.filter((p) => p && fsSync.existsSync(p));
        if (!istniejace.length) throw new Error(`Brak plików do przyjęcia (${zrodlo}).`);
        let a = (await lista({ rodzaj })).find((x) => x.zrodlo === zrodlo) ?? null;
        const nowy = !a;
        if (!a) a = await zapisz({ rodzaj, nazwa, opis, tagi: t, zrodlo });
        const juz = new Set(a.pliki.map((p) => p.nazwa));
        let dodano = 0;
        for (const p of istniejace) {
            if (juz.has(bezpiecznaNazwaPliku(path.basename(p)))) continue;
            await dodajPlik(rodzaj, a.id, { sciezka: p });
            dodano++;
        }
        if (glowny && nowy) await zapisz({ rodzaj, id: a.id, glowny: bezpiecznaNazwaPliku(path.basename(glowny)) }).catch(() => {});
        return { asset: await wczytaj(rodzaj, a.id), nowy, dodano };
    }

    /**
     * Asset → gra ze Studia Gier (`_OtakOs_Apki/<projekt>/public/assety` + `assety.json`, ten sam zapis co
     * Assety3D „Do gry” — Kodeks czyta go w prompcie). Idą obrazy, bryły i dźwięki; klipy wideo nie.
     */
    async function doGry(rodzaj, id, { katalogApek, projekt }) {
        const a = await wczytaj(rodzaj, id);
        if (!/^[a-z0-9-]{2,48}$/.test(String(projekt || '')) || !fsSync.existsSync(path.join(katalogApek, projekt))) throw new Error('Nie ma takiego projektu gry.');
        const pliki = a.pliki.filter((p) => ['obraz', 'bryla', 'audio'].includes(p.rodzaj));
        if (!pliki.length) throw new Error(`„${a.nazwa}” nie ma obrazów, brył ani dźwięków do gry.`);
        const dir = path.join(katalogApek, projekt, 'public', 'assety');
        await fs.mkdir(dir, { recursive: true });
        const plikKat = path.join(dir, 'assety.json');
        let kat = [];
        try { kat = JSON.parse(await fs.readFile(plikKat, 'utf8')); } catch { kat = []; }
        if (!Array.isArray(kat)) kat = [];
        const skopiowane = [];
        for (const p of pliki) {
            const nazwaPliku = `${a.id}-${p.nazwa}`.replace(/\s+/g, '-');
            await kopiuj(p.sciezka, path.join(dir, nazwaPliku));
            kat = kat.filter((x) => x.plik !== nazwaPliku);
            kat.push({ plik: nazwaPliku, nazwa: a.nazwa, rodzaj: p.rodzaj, opis: a.opis || a.rola || '', tagi: a.tagi, zrodlo: `skladnica:${rodzaj}/${a.id}`, dodano: new Date().toISOString() });
            skopiowane.push(`assety/${nazwaPliku}`);
        }
        await fs.writeFile(plikKat, JSON.stringify(kat, null, 2), 'utf8');
        return { pliki: skopiowane, katalog: kat };
    }

    /** Obrazy i klipy scen — dla modułów, które biorą tła (Sceny dialogowe, Studio Podcastu). */
    async function tla() {
        const out = [];
        for (const a of await lista({ rodzaj: 'sceny' })) {
            for (const p of a.pliki) if (p.rodzaj === 'obraz' || p.rodzaj === 'wideo') out.push({ plik: p.sciezka, nazwa: p.nazwa, gdzie: `📦 Składnica / ${a.nazwa}`, wideo: p.rodzaj === 'wideo', czas: p.czas });
        }
        return out;
    }

    return { katalog: korzen, RODZAJE, lista, wczytaj, zapisz, dodajPlik, usunPlik, usun, importujObsade, importujKatalog, przyjmij, doGry, tla, sciezkaPliku };
}

export default { utworzSkladnice, RODZAJE, idZNazwy, bezpiecznaNazwaPliku, rodzajPliku };
