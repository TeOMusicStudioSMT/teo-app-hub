/**
 * 🐾 Bestiariusz Mini-TeOgochi (Suweren 2026-10-12: „potrzebuję miejsca na bibliotekę samych Mini i ich przyporządkowania
 * do rzadkości… i miejsca do projektowania im skilli i jakie mogą nowe wydropić… tak, żeby wylosowany mógł mieć różne
 * warianty”).
 *
 * Jeden plik w grze: `_OtakOs_Apki/<projekt>/public/bestiariusz.json` (+ kopia w `dist/`, gdy gra zbudowana) — gra
 * czyta go sama (src/gra/bestiariusz.ts), Reżyser i Kodeks o nim wiedzą. Treść:
 *  · rzadkosci — szansa wyklucia (%), próg naładowania Jaja (uderzeń w rytm BPM), mnożnik statystyk, kolor,
 *  · skille — nazwa, dziedzina, typ (cios / specjalny / pasywny / taniec), moc 1–100, opis,
 *  · mini — stworek z Pracowni/Assetów (klucz klocka b:/a:/o:), rzadkość, dziedzina, skille startowe,
 *    warianty (odcień, opis, szansa) i dropy (skill, szansa %, od poziomu).
 * Czysta logika losowania: `losujWyklucie` (rzadkość → stworek tej rzadkości → wariant) i `dropPoStarciu`.
 */
import fs from 'fs/promises';
import path from 'path';

export const DZIEDZINY = ['takt', 'zwinnosc', 'spryt', 'urok'];
export const TYPY_SKILLI = ['cios', 'specjalny', 'pasywny', 'taniec'];
export const DOMYSLNE_RZADKOSCI = [
    { id: 'pospolity', nazwa: 'Pospolity', kolor: '#9ca3af', szansa: 55, progJaja: 60, mnoznik: 1 },
    { id: 'rzadki', nazwa: 'Rzadki', kolor: '#38bdf8', szansa: 28, progJaja: 100, mnoznik: 1.15 },
    { id: 'epicki', nazwa: 'Epicki', kolor: '#a78bfa', szansa: 12, progJaja: 160, mnoznik: 1.35 },
    { id: 'legendarny', nazwa: 'Legendarny', kolor: '#f59e0b', szansa: 4, progJaja: 240, mnoznik: 1.6 },
    { id: 'mityczny', nazwa: 'Mityczny', kolor: '#f472b6', szansa: 1, progJaja: 333, mnoznik: 2 },
];

const ID = /^[a-z0-9-]{2,48}$/;
const KLUCZ = /^[abo]:[\w.\-]{1,160}$/;
const tekst = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const liczba = (v, min, max, dom) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dom; };
const slug = (s) => tekst(s, 60).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const noweId = (prefiks, nazwa, zajete) => { let b = `${prefiks}-${slug(nazwa) || 'x'}`.slice(0, 44), id = b, i = 2; while (zajete.has(id)) id = `${b}-${i++}`; zajete.add(id); return id; };

/** Pusty bestiariusz z domyślnymi rzadkościami. */
export const nowyBestiariusz = () => ({ wersja: 1, rzadkosci: DOMYSLNE_RZADKOSCI.map((r) => ({ ...r })), skille: [], mini: [], zmieniono: null });

/** Czyści wszystko, co przyszło z przeglądarki: znane pola, granice liczb, odwołania tylko do istniejących id. */
export function oczyscBestiariusz(d = {}) {
    const rz = (Array.isArray(d.rzadkosci) && d.rzadkosci.length ? d.rzadkosci : DOMYSLNE_RZADKOSCI).slice(0, 8).map((r, i) => ({
        id: typeof r?.id === 'string' && ID.test(r.id) ? r.id : `rzadkosc-${i + 1}`,
        nazwa: tekst(r?.nazwa, 30) || `Rzadkość ${i + 1}`,
        kolor: /^#[0-9a-f]{6}$/i.test(String(r?.kolor)) ? r.kolor : '#9ca3af',
        szansa: liczba(r?.szansa, 0, 100, 0),
        progJaja: Math.round(liczba(r?.progJaja, 10, 2000, 100)),
        mnoznik: Math.round(liczba(r?.mnoznik, 0.5, 5, 1) * 100) / 100,
    }));
    const idRz = new Set(rz.map((r) => r.id));
    const zajeteS = new Set();
    const skille = (Array.isArray(d.skille) ? d.skille : []).slice(0, 200).map((s) => {
        const id = typeof s?.id === 'string' && ID.test(s.id) && !zajeteS.has(s.id) ? (zajeteS.add(s.id), s.id) : noweId('sk', s?.nazwa, zajeteS);
        return { id, nazwa: tekst(s?.nazwa, 40) || 'Skill', dziedzina: DZIEDZINY.includes(s?.dziedzina) ? s.dziedzina : null, typ: TYPY_SKILLI.includes(s?.typ) ? s.typ : 'cios', moc: Math.round(liczba(s?.moc, 1, 100, 10)), opis: tekst(s?.opis, 300) };
    });
    const idS = new Set(skille.map((s) => s.id));
    const zajeteM = new Set();
    const mini = (Array.isArray(d.mini) ? d.mini : []).slice(0, 200).map((m) => {
        const id = typeof m?.id === 'string' && ID.test(m.id) && !zajeteM.has(m.id) ? (zajeteM.add(m.id), m.id) : noweId('mini', m?.nazwa, zajeteM);
        const zajeteW = new Set();
        return {
            id, nazwa: tekst(m?.nazwa, 40) || 'Mini',
            klucz: KLUCZ.test(String(m?.klucz)) ? m.klucz : null,
            rzadkosc: idRz.has(m?.rzadkosc) ? m.rzadkosc : rz[0].id,
            dziedzina: DZIEDZINY.includes(m?.dziedzina) ? m.dziedzina : 'takt',
            opis: tekst(m?.opis, 400),
            skille: [...new Set((Array.isArray(m?.skille) ? m.skille : []).filter((x) => idS.has(x)))].slice(0, 6),
            warianty: (Array.isArray(m?.warianty) ? m.warianty : []).slice(0, 8).map((w) => ({
                id: typeof w?.id === 'string' && ID.test(w.id) && !zajeteW.has(w.id) ? (zajeteW.add(w.id), w.id) : noweId('w', w?.nazwa, zajeteW),
                nazwa: tekst(w?.nazwa, 30) || 'Wariant', odcien: Math.round(liczba(w?.odcien, -180, 180, 0)), szansa: liczba(w?.szansa, 0, 100, 10), opis: tekst(w?.opis, 200),
            })),
            dropy: (Array.isArray(m?.dropy) ? m.dropy : []).filter((x) => idS.has(x?.skill)).slice(0, 8).map((x) => ({ skill: x.skill, szansa: liczba(x?.szansa, 0, 100, 5), odPoziomu: Math.round(liczba(x?.odPoziomu, 1, 20, 1)) })),
        };
    });
    return { wersja: 1, rzadkosci: rz, skille, mini, zmieniono: new Date().toISOString() };
}

/** Rzadkości do losowania: szanse jak wagi (suma nie musi być 100 — liczymy proporcje). */
function wybierzWage(lista, waga, los) {
    const suma = lista.reduce((s, x) => s + Math.max(0, waga(x)), 0);
    if (suma <= 0) return null;
    let r = los() * suma;
    for (const x of lista) { r -= Math.max(0, waga(x)); if (r < 0) return x; }
    return lista.at(-1);
}

/**
 * Wyklucie: rzadkość (wg szans, tylko rzadkości, które mają choć jednego Mini) → Mini tej rzadkości (równo) → wariant
 * (szansa wariantu; reszta do 100% = postać bazowa). `los` = funkcja 0–1 (gra podaje losowarkę z ziarna).
 */
export function losujWyklucie(b, los = Math.random) {
    const zMini = b.rzadkosci.filter((r) => b.mini.some((m) => m.rzadkosc === r.id));
    const rz = wybierzWage(zMini, (r) => r.szansa, los);
    if (!rz) return null;
    const kandydaci = b.mini.filter((m) => m.rzadkosc === rz.id);
    const mini = kandydaci[Math.floor(los() * kandydaci.length)];
    const sumaW = mini.warianty.reduce((s, w) => s + w.szansa, 0);
    const bazowy = Math.max(0, 100 - sumaW);
    const wariant = wybierzWage([...mini.warianty, { id: null, szansa: bazowy }], (w) => w.szansa, los);
    return { mini, rzadkosc: rz, wariant: wariant?.id ? wariant : null };
}

/** Drop po starciu: każdy drop od swojego poziomu rzuca osobno; zwraca skille, których Mini jeszcze nie ma. */
export function dropPoStarciu(b, mini, poziom, maSkille = [], los = Math.random) {
    return mini.dropy.filter((d) => poziom >= d.odPoziomu && !maSkille.includes(d.skill) && los() * 100 < d.szansa).map((d) => b.skille.find((s) => s.id === d.skill)).filter(Boolean);
}

/** Plik bestiariusza gry (public/ — źródło; dist/ — kopia, gdy gra zbudowana). */
export function utworzBestiariusz({ katalogGier }) {
    const plik = (projekt, gdzie = 'public') => path.join(katalogGier, projekt, gdzie, 'bestiariusz.json');
    const sprawdz = (projekt) => { if (!ID.test(String(projekt))) throw new Error('Zły projekt gry.'); };
    return {
        async wczytaj(projekt) {
            sprawdz(projekt);
            try { return oczyscBestiariusz(JSON.parse(await fs.readFile(plik(projekt), 'utf8'))); } catch { return nowyBestiariusz(); }
        },
        async zapisz(projekt, dane) {
            sprawdz(projekt);
            if (!(await fs.stat(path.join(katalogGier, projekt)).then((s) => s.isDirectory()).catch(() => false))) throw new Error(`Nie ma gry „${projekt}”.`);
            const b = oczyscBestiariusz(dane);
            const json = JSON.stringify(b, null, 2);
            await fs.mkdir(path.dirname(plik(projekt)), { recursive: true });
            await fs.writeFile(plik(projekt), json, 'utf8');
            if (await fs.stat(path.join(katalogGier, projekt, 'dist')).then((s) => s.isDirectory()).catch(() => false)) await fs.writeFile(plik(projekt, 'dist'), json, 'utf8');
            return b;
        },
    };
}
