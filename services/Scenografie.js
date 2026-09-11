/**
 * 🎭 Scenografie — przekazanie wirtualnego studia do TeO Game Studio.
 *
 * PO CO. Suweren: „możliwość przesłania scenografii do TeO_Game_Studio, do
 * zbudowania gry lub nakręcenia sceny poprzez naszego TeOgochi".
 *
 * CO SIĘ DZIEJE: gotowy `.glb` (scena z Blendera, tekstury w środku) trafia do
 * `TeO_Game_Studio/public/assets/scenografie/` i do wspólnego manifestu.
 * Od tej chwili TGS ma plik u siebie — pod adresem, który przeglądarka poda
 * loaderowi bez żadnego mostu.
 *
 * ⚠️ TGS NIE MA JESZCZE LOADERA glTF — sprawdzone 2026-09-07: w jego
 * `package.json` nie ma ani `three`, ani `@react-three/*`. Plik będzie na
 * miejscu i będzie poprawny, ale ktoś musi jeszcze napisać komponent, który
 * go wyświetli. Mówię to wprost, zamiast meldować „scenografia przesłana"
 * i zostawiać Suwerena z pustym ekranem.
 *
 * ⚠️ KOPIUJEMY, a nie linkujemy. Aplikacja webowa serwuje tylko to, co ma
 * w swoim `public/` — dowiązanie do `_OtakOs_Wymiar` byłoby dla niej
 * niewidoczne.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

/** Gdzie TGS trzyma swoje zasoby. */
export const KATALOG_TGS = () => ['TeO_Games_Studio', 'TeO_Game_Studio']
    .map((d) => path.join(process.cwd(), '..', d, 'public', 'assets', 'scenografie'))
    .find((d) => fsSync.existsSync(d))
    ?? path.join(process.cwd(), '..', 'TeO_Games_Studio', 'public', 'assets', 'scenografie');
const MANIFEST = 'scenografie.json';

async function wczytajManifest(katalog) {
    try {
        const d = JSON.parse(await fs.readFile(path.join(katalog, MANIFEST), 'utf8'));
        return Array.isArray(d.scenografie) ? d : { scenografie: [] };
    } catch { return { scenografie: [] }; }
}

/** Czy TGS w ogóle jest tam, gdzie go szukamy. */
export async function stanTgs() {
    const kat = KATALOG_TGS();
    const korzen = path.resolve(kat, '..', '..', '..');
    let jest = false;
    try { await fs.access(path.join(korzen, 'package.json')); jest = true; } catch { /* nie ma */ }

    // Loader 3D sprawdzamy PO ZALEŻNOŚCIACH, nie po wierze.
    let loader = false;
    try {
        const pkg = JSON.parse(await fs.readFile(path.join(korzen, 'package.json'), 'utf8'));
        const zal = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        loader = Object.keys(zal).some((n) => n === 'three' || n.startsWith('@react-three'));
    } catch { /* brak package.json */ }

    return {
        jest, korzen, katalog: kat, loader,
        uwaga: !jest
            ? 'Nie widzę TeO Game Studio obok Katedry — scenografii nie ma dokąd wysłać.'
            : loader
                ? null
                : 'TGS nie ma jeszcze biblioteki 3D (three / @react-three). Plik .glb trafi na miejsce i będzie poprawny, ale nikt go tam jeszcze nie wyświetli.',
    };
}

/**
 * Przekaż scenografię do TGS.
 * `przeznaczenie` mówi, po co ona tam idzie — gra czy plan zdjęciowy.
 */
export async function przekaz({ projekt, glb, blend = null, kadr = null, nazwa = '', przeznaczenie = 'gra', opis = '' }) {
    const stan = await stanTgs();
    if (!stan.jest) throw new Error(stan.uwaga);

    try { await fs.access(glb); } catch { throw new Error(`Nie widzę pliku sceny: ${glb}`); }
    if (!/\.glb$/i.test(glb)) throw new Error('Do TGS idzie .glb — .blend jest dla przeglądarki nieczytelny.');

    const kat = stan.katalog;
    await fs.mkdir(kat, { recursive: true });

    const baza = String(nazwa || path.basename(glb, '.glb')).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    const nazwaPliku = `${baza}.glb`;
    const cel = path.join(kat, nazwaPliku);
    await fs.copyFile(glb, cel);
    const st = await fs.stat(cel);

    const manifest = await wczytajManifest(kat);
    const wpis = {
        id: `scen-${Date.now().toString(36)}`,
        projekt,
        nazwa: baza,
        plik: nazwaPliku,
        // Adres, pod którym przeglądarka TGS to zobaczy — bez mostu.
        url: `/assets/scenografie/${nazwaPliku}`,
        bajtow: st.size,
        przeznaczenie: ['gra', 'plan'].includes(przeznaczenie) ? przeznaczenie : 'gra',
        opis: String(opis || '').slice(0, 300),
        zrodlo: { blend, kadr },
        kiedy: new Date().toISOString(),
    };
    // Ta sama nazwa nadpisuje wpis, nie mnoży go — plik i tak został podmieniony.
    manifest.scenografie = manifest.scenografie.filter((s) => s.plik !== nazwaPliku);
    manifest.scenografie.push(wpis);
    await fs.writeFile(path.join(kat, MANIFEST), JSON.stringify(manifest, null, 2), 'utf8');

    return { wpis, katalog: kat, loader: stan.loader, uwaga: stan.uwaga };
}

export async function lista() {
    const stan = await stanTgs();
    if (!stan.jest) return { scenografie: [], ...stan };
    const m = await wczytajManifest(stan.katalog);
    return { ...m, ...stan };
}

export default { KATALOG_TGS, stanTgs, przekaz, lista };
