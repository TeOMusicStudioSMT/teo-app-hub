/**
 * 🐾🛒 Sklep Mini — pakiety Mini-TeOgochi na sprzedaż (Suweren 2026-10-13: „sprzedawać gotowe nasze modele Mini z Meshy
 * + 3 propozycje tego Mini do wytworzenia w swej Katedrze; ceny od rzadkości: pospolity/rzadki 3 $, epicki 6 $,
 * legendarny/mityczny 9 $… niech stado dostanie automatyczne dzienne zlecenie, by przygotować taki pakiet… niech robi
 * plan, jakie są zasoby danego Mini (czy ma model Meshy + ruch + akcje + 3 obrazy)… raz dziennie 3 nowe propozycje do
 * wyboru (obrazy)… zaakceptowany niech przejdzie proces aż do produktu”).
 *
 * MINI = rodzina wersji jednej bryły z Assetów 3D (łańcuch `ulepsza` + wspólny obraz `zObrazu`, jak Bestiariusz),
 * gałąź Pracowni `mini-teogochi` albo „stworek/Mini-TeOgochi” w opisie, albo propozycja przyjęta tutaj.
 * PLAN ZASOBÓW z faktów (nic nie zgaduje): model Meshy (wersja z teksturami), ruch (chód/bieg z riga), akcje (paczka
 * akcji Meshy NA TYM SAMYM rigu), 3 obrazy-propozycje wariantów (Pracownia). Komplet → pakiet.
 * PAKIET (zip): model.glb + ruch-*.glb najlepszej wersji, koncept.png, wariant-1…3.png, propozycje.json (opisy
 * i prompty — kupujący odtworzy warianty w SWOJEJ Katedrze), karta.json, CZYTAJ.txt. Cena z rzadkości (`CENY`).
 *
 * DZIEŃ (raz, od `godzinaDnia`): stado (model przydziału `pionek`) pisze 3 nowe Mini → Pracownia rysuje je po kolei
 * (FLUX lokalnie, wspólna kolejka GPU) → czekają na wybór Suwerena; pakiet dnia = Mini z kompletem Meshy bez pakietu
 * (brakujące obrazy wariantów rysuje stado) → „do akceptacji” (na stronę dopiero po ✓).
 * PRZYJĘCIE propozycji = zgoda na budżet Meshy (`BUDZET_PRODUKCJI` kredytów) i rzadkość → produkcja krok po kroku:
 * TRELLIS z obrazu (lokalnie) → Meshy Image-to-3D → rig + chód/bieg + akcje „🎮 podstawy gry” → 3 obrazy wariantów →
 * pakiet → produkt na stronie. Płatny krok, który zginął przy restarcie mostu, NIE rusza sam drugi raz (kredyty
 * mogły zejść) — propozycja „utknęła” z powodem, „↻ Wznów” = nowa zgoda.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CENNIK_MESHY, MAX_AKCJI } from './ChmuraBryl.js';
import { animacjeGlb } from './MiniZRuchem.js';

export const RZADKOSCI = ['pospolity', 'rzadki', 'epicki', 'legendarny', 'mityczny'];
/** Cena w USD (Suweren 2026-10-13). */
export const CENY = { pospolity: 3, rzadki: 3, epicki: 6, legendarny: 9, mityczny: 9 };
export const WALUTA = 'usd';
/** Zgoda przy przyjęciu: Image-to-3D (Meshy 7.1, 2K) + Remesh przed rigiem (gdy > 300 tys. ścian) + rig + 10 akcji. */
export const BUDZET_PRODUKCJI = CENNIK_MESHY.obraz3d.latest['2k'] + CENNIK_MESHY.remesh + CENNIK_MESHY.rig + CENNIK_MESHY.akcja * MAX_AKCJI;
export const OBRAZOW_WARIANTOW = 3;
export const STAN_MINI = /mini-?teogochi|stwor(ek|ka|ki)/i;

const tekst = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const dzis = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
const godzina = (t) => Number(new Date(t).toLocaleString('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', hour12: false }).slice(0, 2));
const ID_PROP = /^p-[0-9a-f]{8}$/;
const ID_PAK = /^pk-[0-9a-f]{8}$/;

/** Rzadkość z tekstu modelu (pl/en) albo null. */
export function rzadkoscZTekstu(t) {
    const s = String(t ?? '').toLowerCase();
    if (/mity|myth/.test(s)) return 'mityczny';
    if (/legend/.test(s)) return 'legendarny';
    if (/epic|epik/.test(s)) return 'epicki';
    if (/rzadk|rare/.test(s)) return 'rzadki';
    if (/pospol|common/.test(s)) return 'pospolity';
    return null;
}

/** „NAZWA | RZADKOŚĆ | opis wyglądu” × 3 → propozycje (bez dubli nazw, opis ≥ 20 znaków). */
export function odczytajPropozycjeMini(odp, zajete = []) {
    const nazwy = new Set(zajete.map((n) => String(n).toLowerCase()));
    const out = [];
    for (const l of String(odp ?? '').split('\n')) {
        const cz = l.replace(/^[\s*\-\d.)#]+/, '').split('|').map((x) => x.trim());
        if (cz.length < 3) continue;
        const nazwa = tekst(cz[0].replace(/^nazwa:\s*/i, '').replace(/^["“*]+|["”*]+$/g, ''), 40);
        const rzadkosc = rzadkoscZTekstu(cz[1]);
        const opis = tekst(cz.slice(2).join(' — ').replace(/^opis:\s*/i, ''), 600);
        if (!nazwa || !rzadkosc || opis.length < 20 || nazwy.has(nazwa.toLowerCase())) continue;
        nazwy.add(nazwa.toLowerCase());
        out.push({ nazwa, rzadkosc, opis });
        if (out.length >= 3) break;
    }
    return out;
}

/** „WARIANT: nazwa | opis” × 3 → warianty Mini. */
export function odczytajWarianty(odp) {
    const out = [];
    for (const l of String(odp ?? '').split('\n')) {
        const cz = l.replace(/^[\s*\-\d.)#]+/, '').replace(/^wariant\s*\d*\s*:\s*/i, '').split('|').map((x) => x.trim());
        if (cz.length < 2) continue;
        const nazwa = tekst(cz[0].replace(/^["“*]+|["”*]+$/g, ''), 40), opis = tekst(cz.slice(1).join(' — '), 600);
        if (nazwa && opis.length >= 20) out.push({ nazwa, opis });
        if (out.length >= OBRAZOW_WARIANTOW) break;
    }
    return out;
}

/** Rodziny wersji (union-find po `ulepsza` i `zObrazu`) — klucz rodziny = najstarsza wersja. */
export function rodzinyBryl(lista) {
    const poId = new Map(lista.map((a) => [a.id, a]));
    const ojciec = new Map(lista.map((a) => [a.id, a.id]));
    const znajdz = (x) => { while (ojciec.get(x) !== x) { ojciec.set(x, ojciec.get(ojciec.get(x))); x = ojciec.get(x); } return x; };
    const polacz = (a, b) => { if (!poId.has(a) || !poId.has(b)) return; const ra = znajdz(a), rb = znajdz(b); if (ra !== rb) ojciec.set(rb, ra); };
    const poObrazie = new Map();
    for (const a of lista) {
        if (a.ulepsza) polacz(a.ulepsza, a.id);
        if (a.zObrazu) { if (poObrazie.has(a.zObrazu)) polacz(poObrazie.get(a.zObrazu), a.id); else poObrazie.set(a.zObrazu, a.id); }
    }
    const grupy = new Map();
    for (const a of lista) { const r = znajdz(a.id); if (!grupy.has(r)) grupy.set(r, []); grupy.get(r).push(a); }
    return [...grupy.values()].map((w) => {
        const wersje = w.slice().sort((x, y) => String(x.utworzono).localeCompare(String(y.utworzono)));
        return { klucz: wersje[0].id, wersje, obrazy: [...new Set(wersje.map((x) => x.zObrazu).filter(Boolean))] };
    });
}

const rodzajRuchu = (r) => (/^akcje\d*$/.test(r.ruch) || r.akcje?.length ? 'akcje' : /^(chod|bieg)$/.test(r.ruch) ? 'ruch' : 'inne');

/**
 * Plan zasobów rodziny — z faktów. Najlepsza wersja = z teksturami i najwięcej plików ruchu (akcje muszą być NA TYM
 * SAMYM rigu, co chód — inny rig to inny szkielet). `obrazy` = gotowe obrazy wariantów tego Mini.
 */
export function planZasobow(rodzina, { obrazyWariantow = 0 } = {}) {
    const zywe = rodzina.wersje.filter((v) => v.stan !== 'blad' && v.stan !== 'trwa');
    const ocena = (v) => (v.tekstury ? 100 : 0) + (v.ruchy ?? []).filter((r) => r?.glb).length;
    const najlepsza = zywe.slice().sort((a, b) => ocena(b) - ocena(a) || String(b.utworzono).localeCompare(String(a.utworzono)))[0] ?? null;
    const ruchy = (najlepsza?.ruchy ?? []).filter((r) => r?.glb);
    const meshy = zywe.some((v) => v.tekstury);
    const ruch = ruchy.some((r) => rodzajRuchu(r) === 'ruch');
    const akcje = ruchy.some((r) => rodzajRuchu(r) === 'akcje');
    const obrazy = Math.min(OBRAZOW_WARIANTOW, obrazyWariantow);
    const braki = [
        ...(zywe.length ? [] : ['bryła (TRELLIS z obrazu)']),
        ...(meshy ? [] : ['model Meshy (Image-to-3D z teksturami)']),
        ...(ruch ? [] : ['ruch (rig Meshy: chód/bieg)']),
        ...(akcje ? [] : ['akcje (paczka akcji Meshy na rigu)']),
        ...(obrazy >= OBRAZOW_WARIANTOW ? [] : [`obrazy wariantów ${obrazy}/${OBRAZOW_WARIANTOW}`]),
    ];
    return { bryla: zywe.length > 0, meshy, ruch, akcje, obrazy, braki, gotowy: !braki.length, najlepsza: najlepsza?.id ?? null, ruchy: ruchy.map((r) => r.ruch) };
}

/**
 * @param {{
 *   katalog: string,
 *   assety: { lista: Function, meta: Function, listaObrazow: Function, metaObrazu: Function, plikObrazu: Function, sciezkaPliku: Function, obraz: Function, generuj: Function, zadanie: Function },
 *   chmura?: { wycen: Function, zlec: Function, zadanie: Function, zestaw: Function } | null,
 *   stripe?: object | null, bestiariusz?: () => Promise<object|null>, pisz?: (system: string, prompt: string) => Promise<string>,
 *   spakuj: (kat: string, zip: string) => Promise<{sha256: string, bajtow: number}>, projekt?: string, szyna?: object|null,
 *   teraz?: () => number, godzinaDnia?: number, czytajKlipy?: Function,
 * }} o
 */
export function utworzSklepMini({ katalog, assety, chmura = null, stripe = null, bestiariusz = async () => null, pisz = null, spakuj, projekt = 'teterhia-wieczna-saga', szyna = null, teraz = () => Date.now(), godzinaDnia = 6, czytajKlipy = animacjeGlb }) {
    const plik = path.join(katalog, 'stan.json');
    const dirPak = (id) => path.join(katalog, 'pakiety', id);
    let kolejkaZapisu = Promise.resolve();
    const poKolei = (fn) => { const p = kolejkaZapisu.then(fn, fn); kolejkaZapisu = p.catch(() => {}); return p; };
    const nowy = () => ({ propozycje: [], warianty: {}, rzadkosci: {}, pakiety: [], gpu: { kolejka: [], trwa: null }, dzien: null });
    async function czytaj() {
        try { return { ...nowy(), ...JSON.parse(await fs.readFile(plik, 'utf8')) }; } catch { return nowy(); }
    }
    async function zapisz(s) { await fs.mkdir(katalog, { recursive: true }); const tmp = `${plik}.tmp`; await fs.writeFile(tmp, JSON.stringify(s, null, 2), 'utf8'); await fs.rename(tmp, plik); }
    /** Zmiana stanu po kolei (pętla i trasy nie nadpisują sobie nawzajem). */
    const zmien = (fn) => poKolei(async () => { const s = await czytaj(); const w = await fn(s); await zapisz(s); return w; });
    const nadaj = (tresc, rodzaj = 'praca') => void szyna?.nadaj?.({ agent: 'Sklep Mini', rodzaj, tresc })?.catch?.(() => {});
    const nowyId = (p) => `${p}-${crypto.randomBytes(4).toString('hex')}`;

    // ── Mini i plany ──
    async function wszystkieRodziny() {
        const lista = await assety.lista();
        return rodzinyBryl(lista.filter((a) => a?.id));
    }
    const czyMini = (r, s) => r.wersje.some((v) => v.galaz === 'mini-teogochi' || STAN_MINI.test(`${v.nazwa} ${v.opis ?? ''}`)) || s.propozycje.some((p) => p.obraz && r.obrazy.includes(p.obraz));
    const nazwaRodziny = (r, s) => s.propozycje.find((p) => p.obraz && r.obrazy.includes(p.obraz))?.nazwa
        ?? tekst((r.wersje[0].opis || r.wersje[0].nazwa || '').split(/[—:,.]/)[0].replace(/^mini-?teogochi\s*/i, ''), 40) ?? r.klucz;
    async function rzadkoscRodziny(r, s, b) {
        if (RZADKOSCI.includes(s.rzadkosci[r.klucz])) return { rzadkosc: s.rzadkosci[r.klucz], zrodlo: 'Suweren' };
        const klucze = new Set([...r.wersje.map((v) => `a:${v.id}`), ...r.obrazy.map((o) => `o:${o}`)]);
        const zB = b?.mini?.find((m) => m.klucz && klucze.has(m.klucz));
        if (zB && RZADKOSCI.includes(zB.rzadkosc)) return { rzadkosc: zB.rzadkosc, zrodlo: 'Bestiariusz' };
        const p = s.propozycje.find((x) => x.obraz && r.obrazy.includes(x.obraz));
        if (p) return { rzadkosc: p.rzadkosc, zrodlo: 'propozycja' };
        return { rzadkosc: 'pospolity', zrodlo: 'domyślna' };
    }
    async function obrazyWariantow(s, klucz) {
        const w = s.warianty[klucz];
        return (w?.obrazy ?? []).filter((id) => assety.plikObrazu(id));
    }

    /** Plany zasobów wszystkich Mini (z faktów). */
    async function plany() {
        const s = await czytaj();
        const b = await bestiariusz().catch(() => null);
        const out = [];
        for (const r of await wszystkieRodziny()) {
            if (!czyMini(r, s)) continue;
            const obrazy = await obrazyWariantow(s, r.klucz);
            const plan = planZasobow(r, { obrazyWariantow: obrazy.length });
            const rz = await rzadkoscRodziny(r, s, b);
            const pakiet = s.pakiety.find((p) => p.klucz === r.klucz) ?? null;
            out.push({ klucz: r.klucz, nazwa: nazwaRodziny(r, s), opis: tekst(r.wersje.at(-1).opis, 300), wersji: r.wersje.length, ...plan, ...rz, cena: CENY[rz.rzadkosc], obrazyWariantow: obrazy, wariantyRysowane: !!s.warianty[r.klucz]?.doPakietu, pakiet: pakiet ? { id: pakiet.id, stan: pakiet.stan } : null });
        }
        return out.sort((a, b2) => Number(b2.gotowy) - Number(a.gotowy) || b2.braki.length - a.braki.length || a.nazwa.localeCompare(b2.nazwa, 'pl'));
    }

    // ── 🎨 Kolejka GPU (Pracownia i TRELLIS — jedno zadanie naraz, jak w Assetach 3D) ──
    function wKolejke(s, praca) {
        if (s.gpu.kolejka.some((x) => x.cel === praca.cel && x.rodzaj === praca.rodzaj && x.nr === praca.nr) || (s.gpu.trwa && s.gpu.trwa.cel === praca.cel && s.gpu.trwa.rodzaj === praca.rodzaj && s.gpu.trwa.nr === praca.nr)) return;
        s.gpu.kolejka.push(praca);
    }
    /** Wynik pracy GPU → jej cel (propozycja albo warianty Mini). */
    function przypisz(s, praca, wynik) {
        if (praca.rodzaj === 'obraz-propozycji') {
            const p = s.propozycje.find((x) => x.id === praca.cel);
            if (p) Object.assign(p, wynik.ok ? { obraz: wynik.obraz, stan: p.stan === 'rysuje' ? 'czeka' : p.stan } : { stan: 'blad', blad: wynik.blad });
        } else if (praca.rodzaj === 'obraz-wariantu') {
            const w = s.warianty[praca.cel];
            if (w) { w.obrazy = w.obrazy ?? []; if (wynik.ok) w.obrazy[praca.nr] = wynik.obraz; else w.bledy = [...(w.bledy ?? []), wynik.blad].slice(-6); }
        } else if (praca.rodzaj === 'bryla') {
            const p = s.propozycje.find((x) => x.id === praca.cel);
            if (p && !wynik.ok) Object.assign(p, { stan: 'utknela', blad: `TRELLIS: ${wynik.blad}` });
        }
    }
    async function krokGpu(s) {
        const t = s.gpu.trwa;
        if (t) {
            const z = assety.zadanie(t.zadanie);
            if (z && z.stan === 'trwa') return;
            let wynik;
            if (t.rodzaj === 'bryla') {
                const m = t.asset ? await assety.meta(t.asset) : null;
                wynik = m?.stan === 'gotowe' ? { ok: true } : { ok: false, blad: z?.blad || m?.blad || 'bryła nie powstała (przerwane?)' };
            } else {
                const m = t.obraz ? await assety.metaObrazu(t.obraz) : null;
                wynik = m?.stan === 'gotowe' && assety.plikObrazu(t.obraz) ? { ok: true, obraz: t.obraz } : { ok: false, blad: z?.blad || m?.blad || 'obraz nie powstał (przerwane?)' };
            }
            // obraz/bryła przerwane restartem (pusty wynik bez błędu modelu) wraca raz do kolejki — to praca lokalna, darmowa
            if (!wynik.ok && !z && (t.proby ?? 0) < 1) s.gpu.kolejka.unshift({ ...t, proby: (t.proby ?? 0) + 1, zadanie: undefined, obraz: undefined, asset: undefined });
            else przypisz(s, t, wynik);
            s.gpu.trwa = null;
        }
        const nast = s.gpu.kolejka[0];
        if (!nast) return;
        try {
            if (nast.rodzaj === 'bryla') {
                const r = await assety.generuj({ zObrazu: nast.obraz, projekt, nazwa: nast.nazwa, opis: nast.opis });
                s.gpu.trwa = { ...nast, zadanie: r.zadanie, asset: r.asset ?? null, od: new Date(teraz()).toISOString() };
            } else {
                const r = await assety.obraz({ opis: nast.opis, styl: 'postac3d', galaz: 'mini-teogochi', projekt });
                s.gpu.trwa = { ...nast, zadanie: r.zadanie, obraz: r.obraz, od: new Date(teraz()).toISOString() };
            }
            s.gpu.kolejka.shift();
        } catch (e) {
            // ComfyUI zajęte inną pracą Suwerena — spróbujemy przy następnym kroku; trwały błąd po 30 próbach = koniec
            if (/naraz|liczy|zaj[eę]t/i.test(e.message) && (nast.czekal ?? 0) < 30) { nast.czekal = (nast.czekal ?? 0) + 1; return; }
            s.gpu.kolejka.shift();
            przypisz(s, nast, { ok: false, blad: e.message });
        }
    }

    // ── 🌅 Dzień: 3 nowe Mini + pakiet dnia ──
    const SYSTEM_MINI = 'Jesteś stadem TeOgochi Katedry OtakOS i projektujesz Mini-TeOgochi — małe stworki armii z gry Teterhia: na DWÓCH nogach (do riga i animacji), przyjazne, z jedną wyraźną cechą żywiołu, czytelną sylwetką. Odpowiadasz DOKŁADNIE trzema liniami w formacie: NAZWA | RZADKOŚĆ | opis wyglądu po polsku (2–3 zdania: budowa, barwy, materiał, znak szczególny). RZADKOŚĆ to jedno z: pospolity, rzadki, epicki, legendarny, mityczny. Nic więcej.';
    const SYSTEM_WARIANTY = 'Projektujesz warianty Mini-TeOgochi do gry Teterhia — ten sam stworek, ta sama budowa (dwie nogi, A-poza), inna odsłona. Odpowiadasz DOKŁADNIE trzema liniami: WARIANT: nazwa | opis wyglądu po polsku (2 zdania; zachowaj budowę, zmień barwy, materiał, dodatki). Nic więcej.';

    async function propozycjeDnia(s) {
        if (!pisz) throw new Error('Most nie podał modelu stada.');
        const znane = [...s.propozycje.map((p) => p.nazwa), ...(await bestiariusz().catch(() => null))?.mini?.map((m) => m.nazwa) ?? []];
        const odp = await pisz(SYSTEM_MINI, `Zaprojektuj 3 NOWE Mini-TeOgochi na dziś (${dzis(teraz())}), różne od: ${znane.slice(-40).join(', ') || '—'}. Jeden pospolity albo rzadki, jeden epicki, jeden legendarny albo mityczny.`);
        const nowe = odczytajPropozycjeMini(odp, znane);
        if (!nowe.length) throw new Error(`Model stada nie oddał formatu „NAZWA | RZADKOŚĆ | opis” (odpowiedź: ${tekst(odp, 160) || 'pusta'}).`);
        for (const n of nowe) {
            const p = { id: nowyId('p'), dzien: dzis(teraz()), ...n, stan: 'rysuje', obraz: null, utworzono: new Date(teraz()).toISOString(), budzet: 0, wydano: 0, krok: null, historia: [] };
            s.propozycje.unshift(p);
            wKolejke(s, { rodzaj: 'obraz-propozycji', cel: p.id, opis: `Mini-TeOgochi „${n.nazwa}”: ${n.opis}` });
        }
        s.propozycje = s.propozycje.slice(0, 200);
        return nowe.length;
    }

    /** Opisy wariantów (model stada) + obrazy do kolejki; `doPakietu` = po obrazach pakiet zrobi się sam. */
    async function zamowWarianty(s, r, nazwa) {
        const w = s.warianty[r.klucz] ?? (s.warianty[r.klucz] = { opisy: [], obrazy: [] });
        w.doPakietu = true;
        if (w.opisy.length < OBRAZOW_WARIANTOW) {
            if (!pisz) throw new Error('Most nie podał modelu stada (opisy wariantów).');
            const baza = r.wersje.at(-1).opis || nazwa;
            const odp = await pisz(SYSTEM_WARIANTY, `Mini-TeOgochi „${nazwa}”: ${baza}\nNapisz 3 warianty.`);
            const war = odczytajWarianty(odp);
            if (war.length < OBRAZOW_WARIANTOW) throw new Error(`Model stada nie oddał 3 wariantów „WARIANT: nazwa | opis” (odpowiedź: ${tekst(odp, 160) || 'pusta'}).`);
            w.opisy = war;
        }
        const gotowe = (w.obrazy ?? []).map((id) => (id && assety.plikObrazu(id) ? id : null));
        w.opisy.forEach((o, nr) => { if (!gotowe[nr]) wKolejke(s, { rodzaj: 'obraz-wariantu', cel: r.klucz, nr, opis: `Mini-TeOgochi „${nazwa}”, wariant „${o.nazwa}”: ${o.opis}` }); });
    }

    async function pakietDnia(s) {
        const b = await bestiariusz().catch(() => null);
        for (const r of await wszystkieRodziny()) {
            if (!czyMini(r, s) || s.pakiety.some((p) => p.klucz === r.klucz) || s.warianty[r.klucz]?.doPakietu) continue;
            const plan = planZasobow(r, { obrazyWariantow: (await obrazyWariantow(s, r.klucz)).length });
            if (!plan.meshy || !plan.ruch || !plan.akcje) continue;
            const nazwa = nazwaRodziny(r, s);
            await zamowWarianty(s, r, nazwa);
            s.warianty[r.klucz].dnia = dzis(teraz());
            s.warianty[r.klucz].rzadkosc = (await rzadkoscRodziny(r, s, b)).rzadkosc;
            return nazwa;
        }
        return null;
    }

    /** Zlecenie dzienne stada (raz na dzień; `wymus` = jeszcze raz dziś). */
    async function dzien({ wymus = false } = {}) {
        return zmien(async (s) => {
            const d = dzis(teraz());
            if (s.dzien?.data === d && !wymus) return { pominiety: true, dzien: s.dzien };
            const wynik = { data: d, od: new Date(teraz()).toISOString(), propozycje: null, pakiet: null };
            try { wynik.propozycje = { ok: true, ile: await propozycjeDnia(s) }; } catch (e) { wynik.propozycje = { ok: false, powod: e.message }; }
            try { const n = await pakietDnia(s); wynik.pakiet = n ? { ok: true, mini: n } : { ok: false, powod: 'żaden Mini nie ma kompletu Meshy (model + ruch + akcje) bez pakietu — braki w planie zasobów' }; }
            catch (e) { wynik.pakiet = { ok: false, powod: e.message }; }
            s.dzien = wynik;
            nadaj(`🌅 Zlecenie dnia: ${wynik.propozycje.ok ? `${wynik.propozycje.ile} nowe Mini do wyboru (rysują się)` : `propozycje — ${wynik.propozycje.powod}`} · ${wynik.pakiet.ok ? `pakiet dnia: „${wynik.pakiet.mini}” (rysuję warianty)` : `pakiet dnia — ${wynik.pakiet.powod}`}`, wynik.propozycje.ok ? 'praca' : 'blad');
            return wynik;
        });
    }

    // ── 🏭 Produkcja przyjętej propozycji (krok po kroku, z faktów) ──
    const dopisz = (p, t) => { p.historia = [...(p.historia ?? []), { kiedy: new Date(teraz()).toISOString(), tekst: tekst(t, 300) }].slice(-30); };
    async function krokProdukcji(s, p, rodziny) {
        const r = rodziny.find((x) => x.obrazy.includes(p.obraz)) ?? null;
        const plan = r ? planZasobow(r, { obrazyWariantow: (await obrazyWariantow(s, r.klucz)).length }) : null;
        // trwający krok płatny
        if (p.krok) {
            const z = chmura?.zadanie(p.krok.id);
            if (z && !['gotowe', 'blad'].includes(z.stan)) return;
            if (z?.stan === 'blad') { p.stan = 'utknela'; p.blad = `${p.krok.rodzaj}: ${z.blad}`; dopisz(p, `⛔ ${p.blad}`); p.krok = null; return; }
            if (!z) {
                const zrobione = p.krok.rodzaj === 'obraz3d' ? plan?.meshy : plan?.ruch && plan?.akcje;
                if (!zrobione) { p.stan = 'utknela'; p.blad = `Krok Meshy „${p.krok.rodzaj}” przerwany restartem mostu — kredyty mogły już zejść. Sprawdź Assety 3D; „↻ Wznów” = nowa zgoda.`; dopisz(p, p.blad); p.krok = null; return; }
            }
            dopisz(p, `✅ ${p.krok.rodzaj} gotowe`);
            p.krok = null;
        }
        if (!r || !plan.bryla) {
            if (!s.gpu.kolejka.some((x) => x.cel === p.id) && s.gpu.trwa?.cel !== p.id) { wKolejke(s, { rodzaj: 'bryla', cel: p.id, obraz: p.obraz, nazwa: p.nazwa, opis: p.opis }); dopisz(p, '🗿 bryła z obrazu (TRELLIS, lokalnie) — w kolejce GPU'); }
            return;
        }
        p.korzen = r.klucz;
        const platny = async (rodzaj, id, zlecenie) => {
            if (!chmura) throw new Error('Most nie ma Meshy.');
            const w = await chmura.wycen(id, zlecenie);
            if (p.wydano + w.kredyty > p.budzet) throw new Error(`${rodzaj}: ${w.kredyty} kr. przekracza zgodę (wydano ${p.wydano} z ${p.budzet}).`);
            if (w.wystarczy === false) throw new Error(`${rodzaj}: na koncie Meshy ${w.saldo} kr., potrzeba ${w.kredyty}.`);
            const zad = await chmura.zlec(id, w.zlecenie ?? zlecenie, { zgodaKredyty: w.kredyty });
            p.wydano += w.kredyty;
            p.krok = { rodzaj, id: zad.id, od: new Date(teraz()).toISOString(), kredyty: w.kredyty };
            dopisz(p, `☁️ ${rodzaj} → Meshy (${w.kredyty} kr.)`);
        };
        try {
            if (!plan.meshy) {
                const zrodlo = r.wersje.find((v) => v.stan === 'gotowe' && v.zObrazu === p.obraz) ?? r.wersje.find((v) => v.stan === 'gotowe');
                return await platny('obraz3d', zrodlo.id, { rodzaj: 'obraz3d', model: 'latest', rozdzielczosc: '2k', poza: 'a-pose' });
            }
            if (!plan.ruch || !plan.akcje) {
                const zTeks = r.wersje.filter((v) => v.tekstury && v.stan === 'gotowe' && v.chmura?.rodzaj !== 'rig').at(-1);
                if (!zTeks) throw new Error('Brak wersji z teksturami do riga.');
                const akcje = (await chmura.zestaw(zTeks.id, 'gra')).slice(0, MAX_AKCJI).map((a) => a.id);
                return await platny('rig', zTeks.id, { rodzaj: 'rig', wzrost: 1, akcje });
            }
        } catch (e) { p.stan = 'utknela'; p.blad = e.message; dopisz(p, `⛔ ${e.message}`); return; }
        if (plan.obrazy < OBRAZOW_WARIANTOW) {
            if (!s.warianty[r.klucz]?.doPakietu) { try { await zamowWarianty(s, r, p.nazwa); s.warianty[r.klucz].rzadkosc = p.rzadkosc; s.warianty[r.klucz].wystaw = true; dopisz(p, '🎨 3 obrazy wariantów — w kolejce'); } catch (e) { p.stan = 'utknela'; p.blad = e.message; dopisz(p, `⛔ ${e.message}`); } }
            return;
        }
        const pk = s.pakiety.find((x) => x.klucz === r.klucz);
        if (pk) { p.stan = 'gotowa'; p.pakiet = pk.id; dopisz(p, `📦 pakiet ${pk.id} — ${pk.stan === 'wystawiony' ? 'na stronie' : pk.stan}`); }
    }

    // ── 📦 Pakiet ──
    async function zbudujPakiet(s, r, { nazwa, rzadkosc, wystaw }) {
        const plan = planZasobow(r, { obrazyWariantow: (await obrazyWariantow(s, r.klucz)).length });
        if (!plan.gotowy) throw new Error(`Mini „${nazwa}” nie ma kompletu: ${plan.braki.join(', ')}.`);
        const v = r.wersje.find((x) => x.id === plan.najlepsza);
        const id = nowyId('pk');
        const dir = dirPak(id), zaw = path.join(dir, 'zawartosc');
        await fs.mkdir(zaw, { recursive: true });
        try {
            const kopiuj = async (z, na) => { if (!z) throw new Error(`brak pliku ${na}`); await fs.copyFile(z, path.join(zaw, na)); };
            await kopiuj(assety.sciezkaPliku(v.id, 'model.glb'), 'model.glb');
            const klipy = [];
            for (const ru of (v.ruchy ?? []).filter((x) => x?.glb)) {
                const zr = assety.sciezkaPliku(v.id, ru.glb);
                if (!zr) continue;
                await kopiuj(zr, ru.glb);
                for (const n of await czytajKlipy(zr).catch(() => [])) klipy.push({ plik: ru.glb, klip: n });
            }
            const koncept = assety.sciezkaPliku(v.id, 'obraz.png') ?? (v.zObrazu ? assety.plikObrazu(v.zObrazu) : null);
            if (koncept) { await kopiuj(koncept, 'koncept.png'); await fs.copyFile(koncept, path.join(dir, 'okladka.png')); }
            const w = s.warianty[r.klucz];
            const propozycje = [];
            for (const [nr, oid] of (await obrazyWariantow(s, r.klucz)).slice(0, OBRAZOW_WARIANTOW).entries()) {
                await kopiuj(assety.plikObrazu(oid), `wariant-${nr + 1}.png`);
                const mo = await assety.metaObrazu(oid).catch(() => null);
                propozycje.push({ plik: `wariant-${nr + 1}.png`, nazwa: w?.opisy?.[nr]?.nazwa ?? `Wariant ${nr + 1}`, opis: w?.opisy?.[nr]?.opis ?? mo?.opis ?? '', promptObrazu: mo?.promptObrazu ?? null, styl: 'postac3d' });
            }
            const karta = { nazwa, rzadkosc, cena: { kwota: CENY[rzadkosc], waluta: WALUTA }, opis: tekst(v.opis, 600), model: { plik: 'model.glb', tekstury: true, zrodlo: 'Meshy (Image-to-3D, rig)' }, ruchy: (v.ruchy ?? []).filter((x) => x?.glb).map((x) => ({ plik: x.glb, ruch: x.ruch })), klipy, wariantow: propozycje.length, utworzono: new Date(teraz()).toISOString() };
            await fs.writeFile(path.join(zaw, 'propozycje.json'), JSON.stringify({ jak: 'Każda propozycja to opis wariantu tego Mini. W swojej Katedrze: Game Studio → Obrazy → styl „Postać do riga” → wklej opis → Do 3D → Meshy (Image-to-3D, rig) — powstanie Twój wariant.', propozycje }, null, 2), 'utf8');
            await fs.writeFile(path.join(zaw, 'karta.json'), JSON.stringify(karta, null, 2), 'utf8');
            await fs.writeFile(path.join(zaw, 'CZYTAJ.txt'), [
                `Mini-TeOgochi „${nazwa}” — ${rzadkosc} — pakiet Katedry OtakOS`,
                '',
                'model.glb — bryła z teksturami i szkieletem (rig Meshy), gotowa do three.js / Unity / Blendera.',
                `ruch-*.glb — animacje na tym samym szkielecie (${klipy.length} klipów): ${[...new Set(klipy.map((k) => k.klip))].slice(0, 20).join(', ')}.`,
                'koncept.png — obraz, z którego powstał Mini.',
                'wariant-1…3.png + propozycje.json — trzy warianty do wytworzenia w Twojej Katedrze (opisy i prompty).',
                '',
                'Licencja: do użytku w Twoich grach i projektach (także komercyjnych); bez odsprzedaży samego pakietu.',
            ].join('\n'), 'utf8');
            const z = await spakuj(zaw, path.join(dir, 'pakiet.zip'));
            const pk = { id, klucz: r.klucz, bryla: v.id, nazwa, rzadkosc, cena: CENY[rzadkosc], waluta: WALUTA, opis: tekst(v.opis, 300), klipow: klipy.length, obrazow: propozycje.length, bajtow: z.bajtow, sha256: z.sha256, okladka: !!koncept, stan: wystaw ? 'wystawiony' : 'do-akceptacji', utworzono: new Date(teraz()).toISOString() };
            await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(pk, null, 2), 'utf8');
            s.pakiety.unshift(pk);
            nadaj(`📦 Pakiet „${nazwa}” (${rzadkosc}, ${CENY[rzadkosc]} $) — ${pk.stan === 'wystawiony' ? 'na stronie' : 'czeka na Twoje ✓'}`);
            return pk;
        } finally { await fs.rm(zaw, { recursive: true, force: true }).catch(() => {}); }
    }

    /** Krok pętli (co minutę): GPU, produkcja, pakiety po obrazach, dzień. */
    let wTrakcie = false;
    async function krok() {
        if (wTrakcie) return;
        wTrakcie = true;
        try {
            await zmien(async (s) => {
                await krokGpu(s);
                const rodziny = await wszystkieRodziny();
                for (const p of s.propozycje.filter((x) => x.stan === 'w-produkcji')) await krokProdukcji(s, p, rodziny);
                for (const [klucz, w] of Object.entries(s.warianty)) {
                    if (!w.doPakietu || s.pakiety.some((x) => x.klucz === klucz)) continue;
                    const r = rodziny.find((x) => x.klucz === klucz);
                    if (!r || (await obrazyWariantow(s, klucz)).length < OBRAZOW_WARIANTOW) continue;
                    try { await zbudujPakiet(s, r, { nazwa: nazwaRodziny(r, s), rzadkosc: w.rzadkosc ?? 'pospolity', wystaw: !!w.wystaw }); w.doPakietu = false; }
                    catch (e) { w.doPakietu = false; w.bledy = [...(w.bledy ?? []), e.message].slice(-6); nadaj(`📦 pakiet: ${e.message}`, 'blad'); }
                }
            });
            const s = await czytaj();
            if (s.dzien?.data !== dzis(teraz()) && godzina(teraz()) >= godzinaDnia) await dzien();
        } finally { wTrakcie = false; }
    }
    function startPetli(ms = 60_000) { const t = setInterval(() => { void krok().catch((e) => nadaj(`krok: ${e.message}`, 'blad')); }, ms); t.unref?.(); return t; }

    // ── Decyzje Suwerena ──
    function przyjmij(id, { rzadkosc, zgodaKredyty } = {}) {
        return zmien(async (s) => {
            const p = s.propozycje.find((x) => x.id === id);
            if (!p) throw new Error('Nie ma takiej propozycji.');
            if (p.stan !== 'czeka') throw new Error(`Propozycja jest w stanie „${p.stan}” — przyjąć można tylko narysowaną, czekającą na wybór.`);
            if (Number(zgodaKredyty) !== BUDZET_PRODUKCJI) throw Object.assign(new Error(`Produkcja w Meshy to do ${BUDZET_PRODUKCJI} kredytów (≈ $${(BUDZET_PRODUKCJI * 0.02).toFixed(2)}) — potwierdź kwotę.`), { kod: 'BEZ_ZGODY' });
            if (rzadkosc !== undefined) { if (!RZADKOSCI.includes(rzadkosc)) throw new Error(`Rzadkość: ${RZADKOSCI.join(', ')}.`); p.rzadkosc = rzadkosc; }
            Object.assign(p, { stan: 'w-produkcji', budzet: BUDZET_PRODUKCJI, wydano: 0, blad: null, przyjeto: new Date(teraz()).toISOString() });
            dopisz(p, `✓ przyjęta przez Suwerena (${p.rzadkosc}, zgoda do ${BUDZET_PRODUKCJI} kr.)`);
            return p;
        });
    }
    function odrzuc(id) {
        return zmien(async (s) => {
            const p = s.propozycje.find((x) => x.id === id);
            if (!p) throw new Error('Nie ma takiej propozycji.');
            if (!['czeka', 'blad', 'utknela'].includes(p.stan)) throw new Error(`Nie odrzucę propozycji w stanie „${p.stan}”.`);
            p.stan = 'odrzucona'; dopisz(p, '✖ odrzucona');
            return p;
        });
    }
    /** ↻ Wznów utkniętą: nowa zgoda na to, co zostało z budżetu (płatny krok, który zginął, liczymy jako wydany). */
    function wznow(id, { zgodaKredyty } = {}) {
        return zmien(async (s) => {
            const p = s.propozycje.find((x) => x.id === id);
            if (!p || p.stan !== 'utknela') throw new Error('Wznowić można tylko propozycję, która utknęła.');
            if (Number(zgodaKredyty) !== BUDZET_PRODUKCJI) throw Object.assign(new Error(`Wznowienie = nowa zgoda do ${BUDZET_PRODUKCJI} kredytów — potwierdź kwotę.`), { kod: 'BEZ_ZGODY' });
            Object.assign(p, { stan: 'w-produkcji', blad: null, budzet: p.wydano + BUDZET_PRODUKCJI });
            dopisz(p, `↻ wznowiona (nowa zgoda do ${BUDZET_PRODUKCJI} kr.)`);
            return p;
        });
    }
    function ustawRzadkosc(klucz, rzadkosc) {
        return zmien(async (s) => {
            if (rzadkosc !== null && !RZADKOSCI.includes(rzadkosc)) throw new Error(`Rzadkość: ${RZADKOSCI.join(', ')}.`);
            if (rzadkosc === null) delete s.rzadkosci[klucz]; else s.rzadkosci[klucz] = rzadkosc;
            for (const pk of s.pakiety.filter((x) => x.klucz === klucz && rzadkosc)) { pk.rzadkosc = rzadkosc; pk.cena = CENY[rzadkosc]; await fs.writeFile(path.join(dirPak(pk.id), 'meta.json'), JSON.stringify(pk, null, 2), 'utf8').catch(() => {}); }
            return { klucz, rzadkosc };
        });
    }
    /** 📦 Pakiet dla wskazanego Mini teraz (brakujące obrazy wariantów rysuje stado, potem pakiet sam). */
    function zrobPakiet(klucz, { wystaw = false } = {}) {
        return zmien(async (s) => {
            const r = (await wszystkieRodziny()).find((x) => x.klucz === klucz);
            if (!r) throw new Error('Nie ma takiego Mini.');
            const plan = planZasobow(r, { obrazyWariantow: (await obrazyWariantow(s, klucz)).length });
            if (!plan.meshy || !plan.ruch || !plan.akcje) throw new Error(`Do pakietu brakuje: ${plan.braki.filter((b) => !b.startsWith('obrazy')).join(', ')}.`);
            const b = await bestiariusz().catch(() => null);
            await zamowWarianty(s, r, nazwaRodziny(r, s));
            Object.assign(s.warianty[klucz], { rzadkosc: (await rzadkoscRodziny(r, s, b)).rzadkosc, wystaw: !!wystaw });
            return { klucz, obrazy: plan.obrazy, wKolejce: s.gpu.kolejka.filter((x) => x.cel === klucz).length };
        });
    }
    function wystawPakiet(id, tak = true) {
        return zmien(async (s) => {
            const pk = s.pakiety.find((x) => x.id === id);
            if (!pk) throw new Error('Nie ma takiego pakietu.');
            pk.stan = tak ? 'wystawiony' : 'wycofany';
            await fs.writeFile(path.join(dirPak(id), 'meta.json'), JSON.stringify(pk, null, 2), 'utf8').catch(() => {});
            return pk;
        });
    }

    // ── Odczyt ──
    async function stan() {
        const s = await czytaj();
        return {
            ceny: CENY, waluta: WALUTA, rzadkosci: RZADKOSCI, budzet: BUDZET_PRODUKCJI, godzinaDnia,
            dzien: s.dzien, propozycje: s.propozycje.filter((p) => p.stan !== 'odrzucona').slice(0, 60), pakiety: s.pakiety,
            gpu: { trwa: s.gpu.trwa, kolejka: s.gpu.kolejka.length }, plany: await plany(),
            stripe: stripe ? await stripe.stan().catch((e) => ({ blad: e.message })) : null,
        };
    }
    async function pakiet(id) {
        if (!ID_PAK.test(String(id))) return null;
        return (await czytaj()).pakiety.find((x) => x.id === id) ?? null;
    }
    const plikPakietu = (id, nazwa) => (ID_PAK.test(String(id)) && ['pakiet.zip', 'okladka.png'].includes(nazwa) && fsSync.existsSync(path.join(dirPak(id), nazwa)) ? path.join(dirPak(id), nazwa) : null);
    const obrazPropozycji = async (id) => { if (!ID_PROP.test(String(id))) return null; const p = (await czytaj()).propozycje.find((x) => x.id === id); return p?.obraz ? assety.plikObrazu(p.obraz) : null; };
    /** Dla wizytówki: darowizny + wystawione pakiety — tylko gdy jest klucz Stripe (bez klucza nie ma czym zapłacić). */
    async function publiczne() {
        const st = stripe ? await stripe.stan().catch(() => null) : null;
        const darowizny = stripe ? await stripe.publiczne().catch(() => null) : null;
        const s = await czytaj();
        const mini = st?.maKlucz ? s.pakiety.filter((p) => p.stan === 'wystawiony').slice(0, 24).map((p) => ({ id: p.id, nazwa: p.nazwa, rzadkosc: p.rzadkosc, cena: p.cena, waluta: p.waluta, opis: p.opis, klipow: p.klipow, obrazow: p.obrazow, bajtow: p.bajtow, ...(p.okladka ? { obraz: `/wizytowka/sklep/${p.id}/okladka.png` } : {}) })) : [];
        if (!darowizny && !mini.length) return null;
        return { ...(darowizny ? { darowizny } : {}), ...(mini.length ? { mini } : {}), tryb: st?.tryb ?? null };
    }

    return { stan, plany, dzien, krok, startPetli, przyjmij, odrzuc, wznow, ustawRzadkosc, zrobPakiet, wystawPakiet, pakiet, plikPakietu, obrazPropozycji, publiczne };
}

// ── Trasy (montowane z mostu; testowalne na Expressie) ──

const strona = (tytul, tresc) => `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${tytul}</title><style>body{font-family:system-ui,sans-serif;background:#0b1020;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{max-width:520px;text-align:center}a.b{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:10px;background:#a855f7;color:#fff;text-decoration:none;font-weight:700}p{color:#94a3b8}</style></head><body><main>${tresc}</main></body></html>`;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Publiczne (przez tunel, bez klucza — Straż wpuszcza tylko te ścieżki): okładka, zakup (sesja Stripe), odbiór i pobranie
 * opłaconego pakietu. Hub (tylko maszyna): stan, dzień, decyzje, darowizny.
 * @param {{ sklep: object, stripe: object, adres: () => Promise<string|null>, maxPobran?: number, limitKupna?: number }} o
 */
export function zamontujTrasySklepu(app, { sklep, stripe, adres, maxPobran = 5, limitKupna = 10 }) {
    const kupujacy = new Map();   // ip → [czasy] — 10 sesji na minutę z jednego adresu
    const cors = (res) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); res.set('Access-Control-Allow-Headers', 'Content-Type'); };
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(e.kod === 'BEZ_ZGODY' ? 409 : e.kod === 'BEZ_KLUCZA' ? 412 : 400).json({ success: false, message: e.message, kod: e.kod }));

    app.options('/wizytowka/sklep/:id/kup', (_req, res) => { cors(res); res.sendStatus(204); });
    app.post('/wizytowka/sklep/:id/kup', async (req, res) => {
        cors(res);
        const ip = req.ip || req.socket?.remoteAddress || '?';
        const t = Date.now(), lista = (kupujacy.get(ip) ?? []).filter((x) => t - x < 60_000);
        if (lista.length >= limitKupna) return res.status(429).json({ success: false, message: 'Za dużo prób zakupu — spróbuj za minutę.' });
        kupujacy.set(ip, [...lista, t]);
        try {
            const pk = await sklep.pakiet(req.params.id);
            if (!pk || pk.stan !== 'wystawiony') return res.status(404).json({ success: false, message: 'Tego pakietu nie ma w sklepie.' });
            const s = await stripe.sesjaZakupu({ pakiet: pk, kwotaCentow: Math.round(pk.cena * 100), waluta: pk.waluta, powrot: await adres(), anuluj: req.body?.powrot });
            return res.json({ success: true, url: s.url });
        } catch (e) { return res.status(e.kod === 'BEZ_KLUCZA' ? 503 : 502).json({ success: false, message: e.kod === 'BEZ_KLUCZA' ? 'Katedra nie przyjmuje teraz płatności.' : e.message }); }
    });
    app.get('/wizytowka/sklep/:id/okladka.png', (req, res) => {
        const p = sklep.plikPakietu(req.params.id, 'okladka.png');
        if (!p) return res.status(404).end();
        return sklep.pakiet(req.params.id).then((pk) => (pk?.stan === 'wystawiony' ? res.sendFile(p) : res.status(404).end()));
    });
    app.get('/wizytowka/sklep/odbior', async (req, res) => {
        try {
            const s = await stripe.sprawdzSesje(String(req.query.sesja ?? ''));
            if (!s.oplacona) return res.status(402).type('html').send(strona('Płatność w toku', '<h1>⏳ Płatność jeszcze nie przeszła</h1><p>Odśwież tę stronę za chwilę. Jeśli płatność została przerwana — nic nie zostało pobrane.</p>'));
            const pk = await sklep.pakiet(s.pakiet);
            if (!pk) return res.status(404).type('html').send(strona('Brak pakietu', '<h1>Pakietu nie ma</h1><p>Płatność przeszła, ale Katedra nie ma już tego pakietu — napisz do niej, zwróci pieniądze albo wyśle plik.</p>'));
            const q = encodeURIComponent(s.id);
            return res.type('html').send(strona('Dziękujemy!', `<h1>💛 Dziękujemy!</h1><p>Mini-TeOgochi „${esc(pk.nazwa)}” (${esc(pk.rzadkosc)}) jest Twój.</p><a class="b" href="/wizytowka/sklep/pobierz?sesja=${q}">⬇️ Pobierz pakiet (${Math.round(pk.bajtow / 1e5) / 10} MB)</a><p>Link działa ${maxPobran} razy. Zachowaj plik u siebie.</p>`));
        } catch (e) { return res.status(400).type('html').send(strona('Błąd', `<h1>Nie rozpoznaję tej płatności</h1><p>${esc(e.message)}</p>`)); }
    });
    app.get('/wizytowka/sklep/pobierz', async (req, res) => {
        try {
            const s = await stripe.sprawdzSesje(String(req.query.sesja ?? ''));
            if (!s.oplacona) return res.status(402).json({ success: false, message: 'Ta płatność nie jest opłacona.' });
            const p = sklep.plikPakietu(s.pakiet, 'pakiet.zip');
            const pk = await sklep.pakiet(s.pakiet);
            if (!p || !pk) return res.status(404).json({ success: false, message: 'Pakietu nie ma na dysku Katedry.' });
            await stripe.pobranie(s.id, maxPobran);
            const nazwa = `mini-${String(pk.nazwa).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || pk.id}.zip`;
            return res.download(p, nazwa);
        } catch (e) { return res.status(e.kod === 'LIMIT' ? 429 : 400).json({ success: false, message: e.message }); }
    });

    // Hub (Straż: tylko maszyna)
    app.get('/api/sklep-mini', (_req, res) => odp(res, sklep.stan()));
    app.post('/api/sklep-mini/dzien', (req, res) => odp(res, sklep.dzien({ wymus: !!req.body?.wymus }).then((dzien) => ({ dzien }))));
    app.post('/api/sklep-mini/propozycje/:id/przyjmij', (req, res) => odp(res, sklep.przyjmij(req.params.id, req.body ?? {}).then((propozycja) => ({ propozycja }))));
    app.post('/api/sklep-mini/propozycje/:id/odrzuc', (req, res) => odp(res, sklep.odrzuc(req.params.id).then((propozycja) => ({ propozycja }))));
    app.post('/api/sklep-mini/propozycje/:id/wznow', (req, res) => odp(res, sklep.wznow(req.params.id, req.body ?? {}).then((propozycja) => ({ propozycja }))));
    app.get('/api/sklep-mini/propozycje/:id/obraz', async (req, res) => { const p = await sklep.obrazPropozycji(req.params.id); return p ? res.sendFile(p) : res.status(404).end(); });
    app.get('/api/sklep-mini/pakiety/:id/okladka', (req, res) => { const p = sklep.plikPakietu(req.params.id, 'okladka.png'); return p ? res.sendFile(p) : res.status(404).end(); });
    app.put('/api/sklep-mini/rzadkosc', (req, res) => odp(res, sklep.ustawRzadkosc(String(req.body?.klucz ?? ''), req.body?.rzadkosc ?? null)));
    app.post('/api/sklep-mini/pakiet', (req, res) => odp(res, sklep.zrobPakiet(String(req.body?.klucz ?? ''), { wystaw: !!req.body?.wystaw })));
    app.post('/api/sklep-mini/pakiety/:id/wystaw', (req, res) => odp(res, sklep.wystawPakiet(req.params.id, true).then((pakiet) => ({ pakiet }))));
    app.post('/api/sklep-mini/pakiety/:id/wycofaj', (req, res) => odp(res, sklep.wystawPakiet(req.params.id, false).then((pakiet) => ({ pakiet }))));
    app.get('/api/stripe', (_req, res) => odp(res, stripe.stan()));
    app.post('/api/stripe/darowizny', (req, res) => odp(res, req.body?.wlacz === false ? stripe.wylaczDarowizny() : stripe.wlaczDarowizny(req.body ?? {}).then((darowizny) => ({ darowizny }))));
    app.get('/api/stripe/sprzedaz', (_req, res) => odp(res, stripe.sprzedaz().then((sprzedaz) => ({ sprzedaz }))));
}

export default { utworzSklepMini, zamontujTrasySklepu, planZasobow, rodzinyBryl, odczytajPropozycjeMini, odczytajWarianty, rzadkoscZTekstu, CENY, RZADKOSCI, BUDZET_PRODUKCJI };
