/**
 * 🐾🕺 Mini z ruchem — kandydaci do Bestiariusza z Assetów 3D (Suweren 2026-10-13: „mam wiele nowych mini TeOgochi
 * z ruchem, a Bestiariusz ich nie widzi… ruchy porozsiewały się po wersjach… niech się to scali… niech widzi tylko
 * te z ruchem i jakim, do kategorii, i niech sortuje to auto”).
 *
 * RODZINA = wszystkie wersje jednej bryły: łańcuch `ulepsza` (poprawki, Meshy Image-to-3D, rig, akcje…) i wspólny
 * obraz źródłowy `zObrazu`. Z rodziny bierzemy wersję z NAJWIĘKSZĄ liczbą klipów ruchu (remis = najnowsza) —
 * „scalona” bryła. Klipy czytamy z nagłówka GLB każdego pliku ruchu (tylko JSON, bez wczytywania geometrii).
 * Kategoria z nazw klipów (Meshy: Boom_Dance, Punch_Combo, Walking…): 💃 tancerz / ⚔️ wojownik / 🚶 wędrowiec / 🙂 gesty.
 * Tylko rodziny Z RUCHEM (choć jeden plik ruchu z klipami). Sortowanie: kategoria, potem liczba klipów.
 */
import fs from 'node:fs/promises';

export const KATEGORIE = {
    tancerz: { nazwa: '💃 Tancerz', kolejnosc: 0 },
    wojownik: { nazwa: '⚔️ Wojownik', kolejnosc: 1 },
    gesty: { nazwa: '🙂 Gesty i codzienne', kolejnosc: 2 },
    wedrowiec: { nazwa: '🚶 Wędrowiec (chód/bieg)', kolejnosc: 3 },
};

/** Rodzaj klipu z nazwy (jak scena Tanecznego Starcia). */
export function rodzajKlipu(nazwa) {
    const n = String(nazwa).toLowerCase();
    if (/danc|taniec|boogie|hip.?hop|samba|salsa|twist|shuffle|groove|swing|disco|ballet|moonwalk|bass_beats|crystal_beads|cherish|bubble/.test(n)) return 'taniec';
    if (/punch|kick|attack|strike|slash|combo|jab|hook|uppercut|block|dodge|hit|react|death|dying|fall|knock|sword|fight/.test(n)) return 'walka';
    if (/walk|run|jog|sprint|jump|chod|bieg|step|crouch|climb/.test(n)) return 'ruch';
    if (/idle|breath|stand|stance/.test(n)) return 'spoczynek';
    return 'gest';
}

/** Kategoria rodziny z liczby klipów danego rodzaju. */
export function kategoria(licz) {
    if ((licz.taniec ?? 0) >= 2) return 'tancerz';
    if ((licz.walka ?? 0) >= 2) return 'wojownik';
    if ((licz.gest ?? 0) + (licz.taniec ?? 0) + (licz.walka ?? 0) >= 1) return 'gesty';
    return 'wedrowiec';
}

/** Nazwy animacji z pliku GLB — czyta tylko nagłówek i blok JSON. */
export async function animacjeGlb(plik) {
    const fh = await fs.open(plik, 'r');
    try {
        const nag = Buffer.alloc(20);
        await fh.read(nag, 0, 20, 0);
        if (nag.toString('ascii', 0, 4) !== 'glTF') return [];
        const dl = nag.readUInt32LE(12);
        if (nag.readUInt32LE(16) !== 0x4e4f534a || dl > 64 * 1024 * 1024) return [];
        const json = Buffer.alloc(dl);
        await fh.read(json, 0, dl, 20);
        return (JSON.parse(json.toString('utf8')).animations ?? []).map((a, i) => String(a?.name || `klip ${i + 1}`));
    } catch { return []; } finally { await fh.close(); }
}

const nazwaMini = (a) => {
    const o = String(a.opis || a.nazwa || '').trim();
    return (o.split(/[—:,.]/)[0] || o).replace(/^mini-?teogochi\s*/i, '').trim().slice(0, 40) || a.nazwa;
};

/**
 * @param {{ lista: object[], sciezka: (id: string, plik: string) => string | null, assetyGry?: { plik: string, zrodlo?: string }[], czytaj?: typeof animacjeGlb }} o
 */
export async function rodzinyZRuchem({ lista, sciezka, assetyGry = [], czytaj = animacjeGlb }) {
    const poId = new Map(lista.map((a) => [a.id, a]));
    // union-find: ulepsza + wspólny obraz źródłowy
    const ojciec = new Map(lista.map((a) => [a.id, a.id]));
    const znajdz = (x) => { while (ojciec.get(x) !== x) { ojciec.set(x, ojciec.get(ojciec.get(x))); x = ojciec.get(x); } return x; };
    const polacz = (a, b) => { if (!poId.has(a) || !poId.has(b)) return; const ra = znajdz(a), rb = znajdz(b); if (ra !== rb) ojciec.set(rb, ra); };
    const poObrazie = new Map();
    for (const a of lista) {
        if (a.ulepsza) polacz(a.ulepsza, a.id);
        if (a.zObrazu) { if (poObrazie.has(a.zObrazu)) polacz(poObrazie.get(a.zObrazu), a.id); else poObrazie.set(a.zObrazu, a.id); }
    }
    const rodziny = new Map();
    for (const a of lista) { const r = znajdz(a.id); if (!rodziny.has(r)) rodziny.set(r, []); rodziny.get(r).push(a); }

    const wynik = [];
    for (const czlonkowie of rodziny.values()) {
        const zRuchem = czlonkowie.filter((a) => a.stan !== 'blad' && (a.ruchy ?? []).some((r) => r?.glb));
        if (!zRuchem.length) continue;
        const wersje = [];
        for (const a of zRuchem) {
            const klipy = [];
            for (const r of a.ruchy) {
                if (!r?.glb) continue;
                const p = sciezka(a.id, r.glb);
                if (!p) continue;
                for (const n of await czytaj(p)) klipy.push({ nazwa: n, plik: r.glb, ruch: r.ruch, rodzaj: rodzajKlipu(n) });
            }
            if (klipy.length) wersje.push({ a, klipy });
        }
        if (!wersje.length) continue;
        wersje.sort((x, y) => y.klipy.length - x.klipy.length || String(y.a.utworzono).localeCompare(String(x.a.utworzono)));
        const { a: best, klipy } = wersje[0];
        const licz = {};
        for (const k of klipy) licz[k.rodzaj] = (licz[k.rodzaj] ?? 0) + 1;
        const kat = kategoria(licz);
        const korzen = czlonkowie.slice().sort((x, y) => String(x.utworzono).localeCompare(String(y.utworzono)))[0];
        const ids = new Set(czlonkowie.map((x) => x.id));
        const klucze = [
            ...czlonkowie.map((x) => `a:${x.id}`),
            ...[...new Set(czlonkowie.map((x) => x.zObrazu).filter(Boolean))].map((o) => `o:${o}`),
            ...assetyGry.filter((g) => g?.zrodlo && ids.has(g.zrodlo)).map((g) => `b:${g.plik}`),
        ];
        wynik.push({
            // Mini-TeOgochi = gałąź Pracowni „mini-teogochi” albo stworek w opisie (bohaterowie i stwory świata — osobno)
            mini: [best, korzen].some((x) => x.galaz === 'mini-teogochi' || /mini-?teogochi|stworek/i.test(`${x.nazwa} ${x.opis ?? ''}`)),
            klucz: `a:${best.id}`, bryla: best.id, nazwa: nazwaMini(korzen.opis ? korzen : best), opis: String(best.opis || korzen.opis || '').slice(0, 400),
            galaz: best.galaz || korzen.galaz || null, obraz: best.zObrazu || korzen.zObrazu || null,
            kategoria: kat, kategoriaNazwa: KATEGORIE[kat].nazwa, klipow: klipy.length, rodzaje: licz,
            klipy: klipy.map((k) => k.nazwa), wersji: czlonkowie.length, wersjiZRuchem: wersje.length,
            klucze, utworzono: best.utworzono ?? null, tekstury: !!best.tekstury,
        });
    }
    return wynik.sort((x, y) => KATEGORIE[x.kategoria].kolejnosc - KATEGORIE[y.kategoria].kolejnosc || y.klipow - x.klipow || x.nazwa.localeCompare(y.nazwa, 'pl'));
}

export default { rodzinyZRuchem, rodzajKlipu, kategoria, animacjeGlb, KATEGORIE };
