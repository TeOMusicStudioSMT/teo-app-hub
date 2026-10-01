/**
 * 🧹 Porządki na dysku — propozycje, nie samowolka.
 *
 * Suweren (2026-09-29): „tu rodzi nam się kwestia miejsca… bo stare nie używane i niepotrzebne już pliki mogą być
 * usuwane z dysku". Katedra PROPONUJE (co, ile GB, dlaczego), a usuwa wyłącznie to, co Suweren zaznaczy — i przed
 * usunięciem sprawdza każdą pozycję jeszcze raz na świeżym przeglądzie (stan mógł się zmienić).
 *
 * CO BYWA ZBĘDNE (tylko rzeczy, o których Katedra WIE, skąd się wzięły):
 *  gguf-w-ollamie   — plik GGUF z katalogu Kuźni Modeli, który już jest w Ollamie: `ollama create` skopiował wagi do
 *                     własnego magazynu, więc plik na dysku to drugi egzemplarz tych samych gigabajtów;
 *  model-ollamy     — model w Ollamie, którego nie używa żaden TeOgochi, nie ma pracy w stadzie, nie jest domyślny,
 *                     nie ma karty (ani od Suwerena, ani od Zwiadowcy) i nie jest wykuty w Kuźni;
 *  kuznia-wynik     — punkty kontrolne treningu Kuźni Soup (`wynik/`) i wyeksportowany GGUF agenta, którego model
 *                     już jest w Ollamie;
 *  pip-cache        — pobrane paczki pip środowiska Kuźni (odtwarzalne).
 * NIGDY: dzieła Suwerena (muzyka, rendery, wideo, projekty, Biblie), modele bazowe HF Kuźni (potrzebne do kolejnego
 * kucia), nic spoza katalogów Katedry.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

let cfg = {
    /** → { modele: [{ plik, sciezka, bajty, rodzaj, wykuty, proponowanaNazwa, katalog }], katalogi: [{ sciezka }] } (KuzniaModeli.skanujModele) */
    skanGguf: async () => ({ modele: [], katalogi: [] }),
    /** → [{ nazwa, rozmiarGB, karta, wlasny, agenci, praca: { wkladow } }] (Dyrygent.katalog) */
    katalogModeli: async () => [],
    /** → [{ agent, model }] (KuzniaSoup.wykute) */
    wykuteKuzni: async () => [],
    /** katalog Kuźni Soup (<agent>/wynik, <agent>/teogochi-<agent>.gguf) */
    katalogKuzni: path.join(process.cwd(), '_OtakOs_Wymiar', 'kuznia-soup'),
    /** środowisko Kuźni (pip-cache) */
    srodowiskoKuzni: path.join(process.cwd(), '_OtakOs_AI', 'kuznia-soup'),
    /** modele, których nie proponujemy nigdy (domyślne silniki Katedry) */
    chronioneModele: () => [],
    /** (nazwa) → usuń model z Ollamy */
    usunModel: async () => { throw new Error('Most nie podpiął usuwania modeli.'); },
    szyna: null,
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

const idPozycji = (rodzaj, klucz) => crypto.createHash('sha1').update(`${rodzaj}:${klucz}`).digest('hex').slice(0, 12);
const gb = (bajty) => Math.round((bajty / 1e9) * 10) / 10;
const bez = (nazwa) => String(nazwa).replace(/:latest$/, '');

/** Rozmiar pliku albo katalogu (rekurencyjnie). Nieistniejące = 0. */
export async function rozmiar(p) {
    let st;
    try { st = await fs.lstat(p); } catch { return 0; }
    if (st.isSymbolicLink()) return 0;   // dowiązań nie liczymy i nie idziemy za nimi
    if (!st.isDirectory()) return st.size;
    let suma = 0;
    for (const w of await fs.readdir(p).catch(() => [])) suma += await rozmiar(path.join(p, w));
    return suma;
}

/** Czy ścieżka leży w jednym z dozwolonych korzeni (po rozwiązaniu `..`). */
export function wKorzeniach(p, korzenie) {
    const r = path.resolve(p);
    return korzenie.some((k) => { const kk = path.resolve(k); return r !== kk && r.startsWith(kk + path.sep); });
}

/**
 * Przegląd: lista propozycji z rozmiarem i powodem. Niczego nie zmienia.
 * @returns {Promise<{ pozycje: object[], razemGB: number }>}
 */
export async function przeglad() {
    const pozycje = [];
    const [gguf, modele, wykute] = await Promise.all([
        cfg.skanGguf().catch(() => ({ modele: [], katalogi: [] })),
        cfg.katalogModeli().catch(() => []),
        cfg.wykuteKuzni().catch(() => []),
    ]);

    for (const m of gguf.modele ?? []) {
        if (m.rodzaj !== 'gguf' || m.wykuty !== true) continue;
        pozycje.push({
            id: idPozycji('gguf-w-ollamie', m.sciezka), rodzaj: 'gguf-w-ollamie', nazwa: m.plik, sciezka: m.sciezka, bajty: m.bajty,
            powod: `Ollama ma już ten model jako „${m.proponowanaNazwa}" (skopiował wagi do siebie) — ten plik to drugi egzemplarz.`,
            uwaga: 'Gdybyś chciał go kiedyś wykuć od nowa pod inną nazwą, trzeba będzie pobrać plik ponownie.',
        });
    }

    const chronione = new Set(cfg.chronioneModele().filter(Boolean).map(bez));
    for (const m of modele) {
        const nazwa = m.nazwa;
        if (!nazwa || chronione.has(bez(nazwa))) continue;
        if ((m.agenci ?? []).length || (m.praca?.wkladow ?? 0) > 0 || m.wlasny || m.karta) continue;
        pozycje.push({
            id: idPozycji('model-ollamy', nazwa), rodzaj: 'model-ollamy', nazwa, model: nazwa, bajty: Math.round((m.rozmiarGB ?? 0) * 1e9),
            powod: 'Żaden TeOgochi go nie używa, nie ma pracy w stadzie, nie jest domyślny, nie ma karty i nie pochodzi z Kuźni.',
            uwaga: 'Inne moduły (np. narzędzia spoza stada) mogą wołać go po nazwie — wtedy wystarczy go pobrać ponownie.',
        });
    }

    for (const w of wykute) {
        const dir = path.join(cfg.katalogKuzni, w.agent);
        const wynik = path.join(dir, 'wynik');
        const plik = path.join(dir, `${w.model}.gguf`);
        const b1 = await rozmiar(wynik), b2 = await rozmiar(plik);
        if (b1) pozycje.push({ id: idPozycji('kuznia-wynik', wynik), rodzaj: 'kuznia-wynik', nazwa: `${w.agent}/wynik`, sciezka: wynik, bajty: b1, powod: `Punkty kontrolne treningu — model „${w.model}" jest już w Ollamie.`, uwaga: 'Kolejne kucie i tak trenuje od nowa z bazy.' });
        if (b2) pozycje.push({ id: idPozycji('kuznia-wynik', plik), rodzaj: 'kuznia-wynik', nazwa: `${w.agent}/${w.model}.gguf`, sciezka: plik, bajty: b2, powod: `Eksport GGUF — Ollama ma już kopię jako „${w.model}".`, uwaga: null });
    }

    const pip = path.join(cfg.srodowiskoKuzni, 'pip-cache');
    const bPip = await rozmiar(pip);
    if (bPip) pozycje.push({ id: idPozycji('pip-cache', pip), rodzaj: 'pip-cache', nazwa: 'pip-cache Kuźni', sciezka: pip, bajty: bPip, powod: 'Pobrane paczki instalacji środowiska Kuźni — środowisko już stoi.', uwaga: 'Przy ponownej instalacji pip pobierze je jeszcze raz.' });

    pozycje.sort((a, b) => b.bajty - a.bajty);
    return { pozycje: pozycje.map((p) => ({ ...p, gb: gb(p.bajty) })), razemGB: gb(pozycje.reduce((s, p) => s + p.bajty, 0)) };
}

/** Korzenie, w których wolno kasować pliki: katalogi Kuźni Modeli, Kuźni Soup i jej środowiska. */
async function korzenie() {
    const g = await cfg.skanGguf().catch(() => ({ katalogi: [] }));
    return [...(g.katalogi ?? []).map((k) => k.sciezka), cfg.katalogKuzni, cfg.srodowiskoKuzni].filter(Boolean);
}

/**
 * Usuń zaznaczone pozycje. Każda musi być na ŚWIEŻYM przeglądzie (ten sam id) — inaczej odmowa.
 * @returns {Promise<{ usuniete: object[], odmowy: { id: string, powod: string }[], zwolnionoGB: number }>}
 */
export async function usun(ids) {
    const chciane = [...new Set((Array.isArray(ids) ? ids : [ids]).map(String))].filter((x) => /^[0-9a-f]{12}$/.test(x));
    if (!chciane.length) throw new Error('Zaznacz, co usunąć.');
    const { pozycje } = await przeglad();
    const dozwolone = await korzenie();
    const usuniete = [], odmowy = [];
    let bajty = 0;
    for (const id of chciane) {
        const p = pozycje.find((x) => x.id === id);
        if (!p) { odmowy.push({ id, powod: 'Tej pozycji nie ma już na liście (stan się zmienił) — odśwież przegląd.' }); continue; }
        try {
            if (p.rodzaj === 'model-ollamy') await cfg.usunModel(p.model);
            else {
                if (!wKorzeniach(p.sciezka, dozwolone)) throw new Error('ścieżka poza katalogami Katedry');
                await fs.rm(p.sciezka, { recursive: true, force: false });
            }
            usuniete.push({ id, rodzaj: p.rodzaj, nazwa: p.nazwa, gb: p.gb });
            bajty += p.bajty;
        } catch (e) { odmowy.push({ id, powod: `${p.nazwa}: ${e.message}` }); }
    }
    const zwolnionoGB = gb(bajty);
    if (usuniete.length) await cfg.szyna?.nadaj?.({ agent: 'Porządki', rodzaj: 'porzadki', tresc: `Suweren zwolnił ${zwolnionoGB} GB: ${usuniete.map((u) => u.nazwa).join(', ')}`, dane: { usuniete: usuniete.map((u) => u.id) } })?.catch?.(() => {});
    return { usuniete, odmowy, zwolnionoGB };
}

/** Wolne miejsce na dysku Katedry (GB) — gdy system to umie podać. */
export async function wolneMiejsce(katalog = process.cwd()) {
    try {
        if (!fs.statfs) return null;
        const s = await fs.statfs(katalog);
        return { wolneGB: gb(s.bavail * s.bsize), razemGB: gb(s.blocks * s.bsize) };
    } catch { return null; }
}

export default { skonfiguruj, przeglad, usun, rozmiar, wKorzeniach, wolneMiejsce };
