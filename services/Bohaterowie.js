/**
 * 🧝 Bohaterowie startowi gry (Suweren 2026-10-09: „potrzebuję więcej postaci, modeli bohaterów początkowych…
 * też żeńskie postacie”). Bohater = karta (imię, płeć, żywioł, droga, wygląd) + droga przez moce Katedry:
 *
 *   💡 pomysł → 🖼️ obraz (Pracownia, styl „Postać do riga”: dwie nogi, A-poza, FLUX lokalnie)
 *   → 🗿 bryła (TRELLIS.2 lokalnie, z obrazu) → ☁️ tekstury (Meshy Image-to-3D) → 🦴 rig + chód (Meshy)
 *   → 🎮 w grze: `public/assety/bohaterowie.json` (gra pokazuje bohaterów w Bramie i bierze jego bryłę jako ciało).
 *
 * Etap liczony z FAKTÓW (meta obrazu i brył Assetów 3D: wszystkie wersje z tym samym `zObrazu`) — nic nie udaje.
 * Płatne kroki Meshy (tekstury, rig) robi Suweren w Assetach 3D z wyceną i zgodą; tu tylko wskazujemy wersję.
 * Lista per projekt: `_OtakOs_Wymiar/bohaterowie/<projekt>.json`; gry Teterhii dostają wzorcowych sześcioro sami.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

/** Żywioły i drogi Teterhii (`src/gra/postac.ts` gry) — bohater idzie do Bramy z nimi. */
export const ZYWIOLY = ['ogien', 'woda', 'ziemia', 'powietrze', 'eter'];
export const DROGI = ['tworca', 'opiekun', 'wedrowiec', 'badacz'];
export const PLCI = { kobieta: 'woman', mezczyzna: 'man', inna: 'androgynous person' };

/** Wzorcowi bohaterowie Teterhii — trzy kobiety, trzech mężczyzn, każdy żywioł; wygląd w stylu świata (fantastyka + tech-wear + klub). */
export const WZORCOWI_TETERHII = [
    { id: 'iskra', imie: 'Iskra', plec: 'kobieta', zywiol: 'ogien', droga: 'tworca', opis: 'młoda artystka ognia: krótka kurtka tech-wear w barwie żaru, świecące słuchawki na szyi, rękawice z miedzianymi kablami, ciężkie buty, włosy spięte jak płomień' },
    { id: 'mira', imie: 'Mira', plec: 'kobieta', zywiol: 'ziemia', droga: 'opiekun', opis: 'Opiekunka Gaju: płaszcz z mchu i kory do kolan, lniana tunika, skórzane sandały z rzemieniami, latarnia pełna świetlików u pasa, warkocz z liśćmi' },
    { id: 'nawa', imie: 'Nawa', plec: 'kobieta', zywiol: 'woda', droga: 'wedrowiec', opis: 'nawigatorka strumieni: dopasowany kombinezon w odcieniach morskiej wody, przezroczysta peleryna jak fala, kompas z perłą na piersi, wysokie buty do brodzenia' },
    { id: 'orin', imie: 'Orin', plec: 'mezczyzna', zywiol: 'eter', droga: 'badacz', opis: 'Badacz Wyrwy: gogle na czole, płaszcz obszyty mapami, mosiężny sekstant u pasa, fioletowe świecące szwy na rękawach, plecak z lunetą' },
    { id: 'zefir', imie: 'Zefir', plec: 'mezczyzna', zywiol: 'powietrze', droga: 'wedrowiec', opis: 'Wędrowiec Równin: lekki plecak, długi szal na wietrze, luźne spodnie i owijacze, laska z dzwoneczkami, jasna kamizelka z kieszeniami' },
    { id: 'bas', imie: 'Bas', plec: 'mezczyzna', zywiol: 'ziemia', droga: 'tworca', opis: 'kowal rytmu: krępy, skórzany fartuch na koszuli z podwiniętymi rękawami, mały bęben przewieszony przez bark, młot o rączce owiniętej kablem, solidne buty' },
];

const ID = /^[a-z0-9-]{2,40}$/;
const ID_ZASOBU = /^[a-z0-9-]{2,80}$/;
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'bohater';

/**
 * Wszystkie wersje bryły bohatera: z jego obrazu Pracowni (`zObrazu`) albo potomkowie podpiętej bryły-korzenia
 * (łańcuch `ulepsza` — retekstura, rig, kolor…). Korzeń z obrazu Pracowni wciąga też wersje z tego obrazu.
 */
export function rodzinaWersji(karta, lista) {
    const korzen = karta.korzen ? lista.find((m) => m.id === karta.korzen) : null;
    const obrazy = new Set([karta.obraz, korzen?.zObrazu].filter(Boolean));
    const wRodzinie = new Set(karta.korzen ? [karta.korzen] : []);
    for (let zmiana = true; zmiana;) {
        zmiana = false;
        for (const m of lista) if (!wRodzinie.has(m.id) && m.ulepsza && wRodzinie.has(m.ulepsza)) { wRodzinie.add(m.id); zmiana = true; }
    }
    return lista.filter((m) => wRodzinie.has(m.id) || obrazy.has(m.zObrazu));
}

/** Karta bohatera z wejścia — pola z list Teterhii, wygląd ≥ 10 znaków. */
export function oczyscBohatera(b, stary = null) {
    const imie = String(b?.imie ?? stary?.imie ?? '').trim().slice(0, 24);
    if (!imie) throw new Error('Bohater potrzebuje imienia.');
    const opis = String(b?.opis ?? stary?.opis ?? '').trim().slice(0, 600);
    if (opis.length < 10) throw new Error('Opisz wygląd bohatera (strój, rekwizyt, sylwetka) — co najmniej kilka słów.');
    const z = (pole, lista, dom) => (lista.includes(b?.[pole]) ? b[pole] : stary?.[pole] ?? dom);
    return {
        id: stary?.id ?? (ID.test(b?.id ?? '') ? b.id : slug(imie)),
        imie, opis,
        plec: z('plec', Object.keys(PLCI), 'inna'),
        zywiol: z('zywiol', ZYWIOLY, 'eter'),
        droga: z('droga', DROGI, 'wedrowiec'),
        // 🔗 gotowy obraz Pracowni / gotowa bryła z Assetów 3D (zamiast rysowania od zera); null = odepnij
        obraz: b?.obraz !== undefined ? (ID_ZASOBU.test(String(b.obraz ?? '')) ? b.obraz : null) : stary?.obraz ?? null,
        korzen: b?.korzen !== undefined ? (ID_ZASOBU.test(String(b.korzen ?? '')) ? b.korzen : null) : stary?.korzen ?? null,
        wGrze: stary?.wGrze ?? null,
    };
}

/** Opis do Pracowni: płeć wprost (FLUX bez niej rysuje losowo) + wygląd. Styl postac3d dokłada dwie nogi i A-pozę. */
export const opisDoObrazu = (b) => `${PLCI[b.plec] ?? PLCI.inna} — ${b.imie}, hero of a fantasy game: ${b.opis}`;

/**
 * Etap bohatera z faktów. `obraz` = meta obrazu Pracowni (albo null), `bryly` = wszystkie wersje z tym samym zObrazu.
 * Najlepsza wersja: z chodem (rig) → z teksturami → najnowsza gotowa.
 */
export function etapBohatera(b, obraz, bryly) {
    const gotowe = bryly.filter((m) => m.stan === 'gotowe').sort((a, c) => String(c.utworzono).localeCompare(String(a.utworzono)));
    const zChodem = gotowe.find((m) => (m.ruchy ?? []).some((r) => r.ruch === 'chod'));
    const zTeksturami = gotowe.find((m) => m.tekstury);
    const najlepsza = zChodem ?? zTeksturami ?? gotowe[0] ?? null;
    let etap = 'pomysl';
    if (b.obraz && !obraz) etap = 'pomysl';   // obraz usunięty z Pracowni
    else if (obraz?.stan === 'trwa') etap = 'rysuje';
    else if (obraz?.stan === 'blad') etap = 'blad';
    else if (obraz) etap = 'obraz';
    if (bryly.some((m) => m.stan === 'trwa')) etap = 'rzezbi';
    if (najlepsza) etap = zChodem ? 'rig' : zTeksturami ? 'tekstury' : 'bryla';
    if (b.wGrze && najlepsza && b.wGrze.zrodlo === najlepsza.id) etap = 'w-grze';
    return {
        etap,
        najlepsza: najlepsza ? { id: najlepsza.id, tekstury: !!najlepsza.tekstury, ruchy: (najlepsza.ruchy ?? []).map((r) => r.ruch) } : null,
        wersji: gotowe.length,
        blad: obraz?.stan === 'blad' ? obraz.blad ?? 'obraz się nie narysował' : null,
        nowszaNizWGrze: !!(b.wGrze && najlepsza && b.wGrze.zrodlo !== najlepsza.id),
    };
}

/**
 * @param {{ katalog: string, katalogApek: string, assety: { obraz: Function, generuj: Function, doGry: Function, lista: Function, metaObrazu: Function }, szyna?: object|null }} cfg
 */
export function utworzBohaterow({ katalog, katalogApek, assety, szyna = null }) {
    const plik = (projekt) => path.join(katalog, `${projekt}.json`);
    const sprawdzProjekt = (projekt) => {
        if (!ID.test(String(projekt || '')) || !fsSync.existsSync(path.join(katalogApek, projekt))) throw new Error('Nie ma takiego projektu gry.');
    };
    let zapisy = Promise.resolve();

    async function wczytaj(projekt) {
        try { return JSON.parse(await fs.readFile(plik(projekt), 'utf8')).bohaterowie ?? []; }
        catch { return /teterhia/.test(projekt) ? WZORCOWI_TETERHII.map((b) => oczyscBohatera(b)) : []; }
    }
    function zmien(projekt, fn) {
        const w = zapisy.then(async () => {
            const lista = await wczytaj(projekt);
            const wynik = await fn(lista);
            await fs.mkdir(katalog, { recursive: true });
            await fs.writeFile(plik(projekt), JSON.stringify({ bohaterowie: lista, zmieniono: new Date().toISOString() }, null, 2), 'utf8');
            return wynik;
        });
        zapisy = w.catch(() => {});
        return w;
    }

    /** Lista z etapami (fakty z Assetów 3D przy każdym odczycie). */
    async function lista(projekt) {
        sprawdzProjekt(projekt);
        const bohaterowie = await wczytaj(projekt);
        const wszystkie = await assety.lista();
        const out = [];
        for (const b of bohaterowie) {
            const obraz = b.obraz ? await assety.metaObrazu(b.obraz).catch(() => null) : null;
            out.push({ ...b, ...etapBohatera(b, obraz, rodzinaWersji(b, wszystkie)) });
        }
        return out;
    }

    const znajdz = (lista, id) => {
        const b = lista.find((x) => x.id === id);
        if (!b) throw new Error('Nie ma takiego bohatera.');
        return b;
    };

    /** Nowy bohater albo zmiana karty (zmiana wyglądu = obraz od nowa, stary zostaje w Pracowni). */
    /** Podpięty obraz/bryła musi istnieć (obraz gotowy w Pracowni, bryła w Assetach 3D). */
    async function sprawdzPodpiete(dane) {
        if (dane?.obraz) { const o = await assety.metaObrazu(dane.obraz).catch(() => null); if (!o) throw new Error('Nie ma takiego obrazu w Pracowni.'); }
        if (dane?.korzen && !(await assety.lista()).some((m) => m.id === dane.korzen)) throw new Error('Nie ma takiej bryły w Assetach 3D.');
    }
    const zapisz = async (projekt, dane) => { sprawdzProjekt(projekt); await sprawdzPodpiete(dane); return zmien(projekt, (lista) => {
        const stary = dane?.id ? lista.find((x) => x.id === dane.id) : null;
        const b = oczyscBohatera(dane, stary);
        if (stary && stary.opis !== b.opis && dane?.obraz === undefined) b.obraz = null;
        if (!stary) { while (lista.some((x) => x.id === b.id)) b.id = `${b.id.slice(0, 34)}-${crypto.randomBytes(2).toString('hex')}`; lista.push(b); }
        else lista[lista.indexOf(stary)] = b;
        return b;
    }); };
    const usun = (projekt, id) => { sprawdzProjekt(projekt); return zmien(projekt, (lista) => { lista.splice(lista.indexOf(znajdz(lista, id)), 1); return true; }); };

    /** 🖼️ Obraz w Pracowni (FLUX lokalnie, styl postac3d). */
    async function narysuj(projekt, id) {
        sprawdzProjekt(projekt);
        const b = znajdz(await wczytaj(projekt), id);
        const r = await assety.obraz({ opis: opisDoObrazu(b), styl: 'postac3d', galaz: 'postacie', projekt });
        await zmien(projekt, (lista) => { znajdz(lista, id).obraz = r.obraz; });
        return r;
    }

    /** 🗿 Bryła z obrazu (TRELLIS.2 lokalnie) — baza pod Meshy Image-to-3D i rig. */
    async function wyrzezb(projekt, id) {
        sprawdzProjekt(projekt);
        const b = znajdz(await wczytaj(projekt), id);
        if (!b.obraz) throw new Error('Najpierw obraz bohatera (🖼️ Narysuj albo podepnij obraz z Pracowni).');
        const o = await assety.metaObrazu(b.obraz);
        if (o?.stan !== 'gotowe') throw new Error(o?.stan === 'trwa' ? 'Obraz jeszcze się rysuje.' : 'Obraz bohatera się nie udał — narysuj od nowa.');
        return assety.generuj({ zObrazu: b.obraz, projekt, nazwa: `bohater-${b.id}`, opis: `${b.imie} — ${b.opis}`, sciany: 20000, rozdzielczosc: 1024 });
    }

    /** Katalog gry: public/assety (źródło) + dist/assety, gdy gra jest zbudowana (most serwuje /apki/<id>/ z dist). */
    async function zapiszKatalogGry(projekt, lista) {
        const wpisy = lista.filter((b) => b.wGrze).map((b) => ({ id: b.id, imie: b.imie, plec: b.plec, zywiol: b.zywiol, droga: b.droga, opis: b.opis, plik: b.wGrze.plik, ruch: b.wGrze.ruch ?? null, ...(b.wGrze.ruchy ? { ruchy: b.wGrze.ruchy } : {}) }));
        const katalogi = [path.join(katalogApek, projekt, 'public', 'assety')];
        if (fsSync.existsSync(path.join(katalogApek, projekt, 'dist'))) katalogi.push(path.join(katalogApek, projekt, 'dist', 'assety'));
        for (const k of katalogi) {
            await fs.mkdir(k, { recursive: true });
            await fs.writeFile(path.join(k, 'bohaterowie.json'), JSON.stringify({ bohaterowie: wpisy, zmieniono: new Date().toISOString() }, null, 2), 'utf8');
        }
        if (katalogi.length > 1) for (const b of wpisy) for (const f of [b.plik, ...Object.values(b.ruchy ?? {})]) {
            const z = path.join(katalogi[0], f);
            if (fsSync.existsSync(z)) await fs.copyFile(z, path.join(katalogi[1], f));
        }
        return wpisy;
    }

    /** 🎮 Do gry: najlepsza wersja (z chodem — animowany GLB) → assety gry + bohaterowie.json. */
    async function doGry(projekt, id) {
        const b = (await lista(projekt)).find((x) => x.id === id);
        if (!b) throw new Error('Nie ma takiego bohatera.');
        if (!b.najlepsza) throw new Error('Bohater nie ma jeszcze bryły.');
        const ruch = b.najlepsza.ruchy.includes('chod') ? 'chod' : null;
        const r = await assety.doGry(b.najlepsza.id, projekt, { ruch });
        // 🕹️ pozostałe ruchy riga (bieg, akcje…) też do gry — gra dokłada ich klipy do ciała (src/ruchyPostaci.ts)
        const ruchy = {};
        for (const x of b.najlepsza.ruchy.filter((y) => y !== ruch)) {
            try { ruchy[x] = (await assety.doGry(b.najlepsza.id, projekt, { ruch: x })).plik.replace(/^assety\//, ''); } catch { /* ruch bez pliku — pomijamy */ }
        }
        const wGrze = { plik: r.plik.replace(/^assety\//, ''), zrodlo: b.najlepsza.id, ruch, ...(Object.keys(ruchy).length ? { ruchy } : {}), kiedy: new Date().toISOString() };
        const wpisy = await zmien(projekt, async (l) => { znajdz(l, id).wGrze = wGrze; return zapiszKatalogGry(projekt, l); });
        void szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: 'praca', tresc: `🧝 ${b.imie} w grze „${projekt}”${ruch ? ' (z chodem)' : ''} — wybór w Bramie` })?.catch?.(() => {});
        return { wGrze, bohaterowie: wpisy };
    }
    /** Zdejmij z gry (plik GLB w grze zostaje — może go używać coś innego). */
    const zGry = (projekt, id) => { sprawdzProjekt(projekt); return zmien(projekt, async (l) => { znajdz(l, id).wGrze = null; return zapiszKatalogGry(projekt, l); }); };

    return { lista, zapisz, usun, narysuj, wyrzezb, doGry, zGry };
}

export default { utworzBohaterow, rodzinaWersji, etapBohatera, oczyscBohatera, opisDoObrazu, WZORCOWI_TETERHII };
