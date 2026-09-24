/**
 * 🏭 Zlecenia Stada — wkłady do Projektu Stada same zlecają moduły Katedry.
 *
 * Suweren (2026-09-24): „tak, niech wkłady same zlecają moduły Katedry".
 *
 * Wkład to tekst, ale z liniami, które maszyna umie przeczytać (karta zadania w ProjektStada.ROLE
 * każe je pisać). Każda taka linia = jedno zlecenie do PRAWDZIWEGO modułu, tą samą trasą mostu,
 * którą woła panel Suwerena:
 *   PRODUKT: nazwa | cena GRV | opis  → Marketplace (/api/market/create) — od ręki, bez karty graficznej,
 *   MUZYKA: prompt po angielsku       → generator muzyki (ComfyUI × ACE) → odbiór do _OtakOs_Muzyka,
 *   REFREN: wers / wers / wers         → tekst do tego samego utworu,
 *   OBIEKT: opis bryły                 → Assety3D (FLUX.2 → TRELLIS.2 → GLB),
 *   UJĘCIE: opis ujęcia po angielsku   → wideo (ComfyUI) → kopia do katalogu projektu.
 *
 * Nic tu nie udaje wyniku: gdy ComfyUI śpi albo brakuje wag, zlecenie kończy się błędem z komunikatem
 * modułu i tak zostaje zapisane. Limity (MAX) są po to, żeby jeden projekt nie zajął karty graficznej
 * na całą noc — reszta linii zostaje w tekście i można je zlecić ręcznie.
 */

/** Kolejność wykonania: najpierw to, co nie potrzebuje karty graficznej. */
export const MODULY = {
    merch: { nazwa: 'Marketplace', ikona: '🛒', max: 5, gpu: false },
    muzyka: { nazwa: 'Generator muzyki', ikona: '🎵', max: 1, gpu: true },
    model3d: { nazwa: 'Assety3D', ikona: '🧊', max: 3, gpu: true },
    wideo: { nazwa: 'Wideo', ikona: '🎬', max: 2, gpu: true },
};

const linie = (tekst, znacznik) => [...String(tekst ?? '').matchAll(new RegExp(`^[\\s>*•-]*(?:${znacznik})\\s*\\**\\s*:\\s*(.+)$`, 'gim'))]
    .map((m) => m[1].replace(/\*\*/g, '').trim()).filter(Boolean);

/** Cena z „120 GRV", „120", „~120 grv" → 120; bzdura → 0 (Marketplace i tak przyjmie 0). */
const cena = (s) => { const m = String(s ?? '').replace(/\s/g, '').match(/\d+(?:[.,]\d+)?/); return m ? Math.max(0, Math.round(Number(m[0].replace(',', '.')))) : 0; };

/**
 * Wyciągnij zlecenia z oddanych wkładów. Biblia projektu (synteza) powtarza cudze linie — pomijamy ją.
 * @param {{agent:string, imie:string, stan:string, wklad?:string|null, synteza?:boolean}[]} kroki
 */
export function wyciagnij(kroki = []) {
    const out = [], widziane = new Set();
    const dodaj = (k, modul, opis, argumenty) => {
        const klucz = `${modul}:${opis.toLowerCase()}`;
        if (widziane.has(klucz) || out.filter((z) => z.modul === modul).length >= MODULY[modul].max) return;
        widziane.add(klucz);
        out.push({ id: `${modul}-${out.length + 1}`, modul, agent: k.agent, imie: k.imie, opis: opis.slice(0, 300), argumenty, stan: 'czeka', wynik: null });
    };
    for (const k of kroki) {
        if (k.stan !== 'gotowe' || !k.wklad || k.synteza) continue;
        for (const l of linie(k.wklad, 'PRODUKT')) {
            const [nazwa, c, ...opis] = l.split('|').map((x) => x.trim());
            if (nazwa) dodaj(k, 'merch', nazwa, { nazwa: nazwa.slice(0, 80), cenaGrv: cena(c), opis: opis.join(' | ').slice(0, 400) });
        }
        const muzyka = linie(k.wklad, 'MUZYKA')[0];
        if (muzyka) {
            const refren = linie(k.wklad, 'REFREN')[0];
            dodaj(k, 'muzyka', muzyka, { prompt: muzyka.slice(0, 500), tekst: refren ? `[chorus]\n${refren.split(/\s*\/\s*/).join('\n')}` : '' });
        }
        for (const l of linie(k.wklad, 'OBIEKT')) dodaj(k, 'model3d', l, { tekst: l.slice(0, 500) });
        for (const l of linie(k.wklad, 'UJ[EĘ]CIE')) dodaj(k, 'wideo', l, { prompt: l.slice(0, 600) });
    }
    const kolej = Object.keys(MODULY);
    return out.sort((a, b) => kolej.indexOf(a.modul) - kolej.indexOf(b.modul));
}

const spij = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pytaj `sprawdz()` co `odstepMs`, aż odda wynik (nie-null) albo minie `limitMs`. */
async function doczekaj(sprawdz, { odstepMs, limitMs, co }) {
    const t0 = Date.now();
    while (Date.now() - t0 < limitMs) {
        await spij(odstepMs);
        let w = null;
        try { w = await sprawdz(); } catch (e) { if (e?.twardy) throw e; continue; }   // most chwilowo zajęty — pytamy dalej
        if (w) return w;
    }
    throw new Error(`${co} nie skończyło się w ${Math.round(limitMs / 60_000)} min — sprawdź kolejkę ComfyUI.`);
}
const twardy = (msg) => Object.assign(new Error(msg), { twardy: true });

/**
 * Wykonaj jedno zlecenie przez trasy mostu i poczekaj na plik.
 * @param {{modul:string, argumenty:any, agent:string, imie:string}} z
 * @param {{ most:(sciezka:string, body?:any)=>Promise<any>, projekt:{id:string,nazwa:string}, odstepMs?:number, limityMs?:Record<string,number> }} o
 */
export async function wykonaj(z, { most, projekt, odstepMs = 10_000, limityMs = {} }) {
    const a = z.argumenty ?? {};
    const limit = (m, dom) => limityMs[m] ?? dom;
    if (z.modul === 'merch') {
        const d = await most('/api/market/create', {
            module: 'projekt-stada', type: 'merch', name: a.nazwa, desc: a.opis || `Z uniwersum „${projekt.nazwa}".`,
            priceGrv: a.cenaGrv, creator: `${z.imie} (Stado)`, payload: { projekt: projekt.id, agent: z.agent },
        });
        return { produkt: d.product?.id ?? null, cenaGrv: d.product?.priceGrv ?? a.cenaGrv };
    }
    if (z.modul === 'muzyka') {
        const tytul = `${projekt.nazwa} — motyw`.slice(0, 60);
        const d = await most('/api/music/generate', { prompt: a.prompt, lyrics: a.tekst || '', duration: 60 });
        const gotowe = await doczekaj(async () => {
            const p = await most(`/api/music/progress?promptId=${encodeURIComponent(d.promptId)}`);
            if (p.stan === 'blad' || p.stan === 'przerwane') throw twardy(p.message || `ComfyUI: ${p.stan}`);
            return p.stan === 'gotowe' && p.audio?.length ? p.audio[0] : null;
        }, { odstepMs, limitMs: limit('muzyka', 45 * 60_000), co: 'Utwór' });
        const c = await most('/api/music/collect', { filename: gotowe.filename, subfolder: gotowe.subfolder, type: gotowe.type, title: tytul });
        return { promptId: d.promptId, plik: c.savedPath ?? gotowe.filename, silnik: d.engine ?? null };
    }
    if (z.modul === 'model3d') {
        const d = await most('/api/assety3d/generuj', { tekst: a.tekst, nazwa: a.tekst.split(/[,.;]/)[0].slice(0, 40), opis: `${projekt.nazwa}: ${a.tekst}`.slice(0, 500) });
        await doczekaj(async () => {
            const s = (await most(`/api/assety3d/zadania/${encodeURIComponent(d.zadanie)}`)).zadanie;
            if (s?.stan === 'blad') throw twardy(s.blad || 'Assety3D: błąd');
            return s?.stan === 'gotowe' ? s : null;
        }, { odstepMs, limitMs: limit('model3d', 60 * 60_000), co: 'Bryła 3D' });
        return { asset: d.asset };
    }
    if (z.modul === 'wideo') {
        const d = await most('/api/wideo/generuj', { prompt: a.prompt });
        const s = await doczekaj(async () => {
            const r = await most(`/api/wideo/zlecenie/${encodeURIComponent(d.zlecenie)}`);
            if (r.blad) throw twardy(`ComfyUI: ${r.blad.status_str || 'błąd wykonania'}`);
            return r.gotowe ? r : null;
        }, { odstepMs, limitMs: limit('wideo', 90 * 60_000), co: 'Ujęcie' });
        const zrodlo = s.materialy?.find((m) => /\.(mp4|webm|gif|webp)$/i.test(m.nazwa)) ?? s.materialy?.[0];
        // Kopia do katalogu projektu w Katedrze (jak kolejka kadrów) — wyjście ComfyUI zostaje nietknięte.
        const kopia = zrodlo ? await most('/api/wideo/do-projektu', { projekt: projekt.nazwa, plik: zrodlo.sciezka, tytul: z.id }).catch(() => null) : null;
        return { zlecenie: d.zlecenie, plik: kopia?.sciezka ?? zrodlo?.sciezka ?? null, silnik: d.silnik ?? null };
    }
    throw new Error(`Nieznany moduł „${z.modul}".`);
}

export default { MODULY, wyciagnij, wykonaj };
