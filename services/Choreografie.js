/**
 * 🩰 Choreografie Tanecznego Starcia (Suweren 2026-10-12: „TeOgochi sam tańczy do wybranego utworu… zapisać
 * choreografię… nagrać występ jako film… Taniec Dnia / Tygodnia / Miesiąca / Roku i Mistrzostwa Świata”).
 *
 *  · CHOREOGRAFIA: układ ruchów (klipy tańca z riga Meshy) na frazach utworu z biblioteki muzyki (`_OtakOs_Muzyka`,
 *    też Bazylika Dźwięku). Most NIE wierzy przeglądarce co do muzyki: frazy (czas i energia) liczy sam z `/api/rytm`
 *    tego pliku, a ocenę liczy od nowa. Ruchy (nazwa, długość, moc szkieletu) deklaruje apka — moc liczy z klatek klipu,
 *    most nie wczytuje szkieletu (uczciwie: ta część jest deklaracją).
 *    `_OtakOs_Wymiar/choreografie/c-<8 hex>.json`.
 *  · NAGRANIE: film występu z przeglądarki (MediaRecorder, webm) → `produkcje/taneczne-starcie/montaz/` → ffmpeg do mp4
 *    (H.264 + AAC; nie wyszło = zostaje webm z powodem) → Montażownia, „📺 do publikacji”.
 *  · TURNIEJE: okresy liczone z daty UTC (ta sama doba dla każdej Katedry): Taniec Dnia, Tygodnia (ISO), Miesiąca, Roku
 *    i Mistrzostwa Świata (cały grudzień). Zgłoszenie = najlepsza ocena w każdym otwartym okresie
 *    (`turnieje.json`) → pole `tance` publicznej wizytówki (KlubMistrzow) z DANYMI do sprawdzenia: inne Katedry liczą
 *    ocenę same (`tanecZSieci`) i odrzucają występ, którego liczby się nie zgadzają.
 *    ⚠️ UCZCIWIE: Katedra deklaruje energię fraz i moc ruchów (nikt inny nie ma jej utworu i bryły) — sprawdzalna jest
 *    ARYTMETYKA oceny i to, że układ jest ten sam (odcisk), nie sama muzyka. Bez GRV między Katedrami.
 *
 * ⚠️ BLIŹNIAK: matematyka (frazy, rangi, tempo klipu, układ, ocena, odcisk) = `_OtakOs_Apki/taneczne-starcie/src/
 * choreografia.ts`. Zmieniasz wzór tutaj — zmień tam (test apki `testy/choreografia.test.ts` porównuje oba).
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const FRAZY = [4, 8, 16];
export const MAX_FRAZ = 96;
export const MAX_RUCHOW = 40;
export const UDERZENIA_KLIPU = [1, 2, 3, 4, 6, 8, 12, 16];
export const WAGI = { takt: 0.4, energia: 0.35, roznorodnosc: 0.25 };
export const PROJEKT = 'taneczne-starcie';
export const MAX_NAGRANIA_MB = Number(process.env.OTAKOS_TANIEC_NAGRANIE_MB) || 400;
export const OKRESY = { dzien: 'Taniec Dnia', tydzien: 'Taniec Tygodnia', miesiac: 'Taniec Miesiąca', rok: 'Taniec Roku', mistrzostwa: 'Mistrzostwa Świata' };

const r3 = (x) => Math.round(x * 1000) / 1000;
const ID = /^c-[0-9a-f]{8}$/;

// ── matematyka (bliźniak src/choreografia.ts) ──
export function frazyZRytmu(rytm, fraza, maxFraz = MAX_FRAZ) {
    const f = Math.max(1, Math.round(fraza));
    const b = Array.isArray(rytm?.beaty) ? rytm.beaty : [];
    const out = [];
    for (let i = 0; i + f <= b.length && out.length < maxFraz; i += f) {
        let s = 0;
        for (let k = i; k < i + f; k++) s += Number(b[k].sila) || 0;
        out.push({ od: r3(Number(b[i].t) || 0), uderzen: f, energia: r3(s / f) });
    }
    return out;
}
export function rangi(wartosci) {
    const n = wartosci.length;
    if (n < 2) return wartosci.map(() => 0.5);
    const kol = wartosci.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
    const r = new Array(n);
    kol.forEach((x, k) => { r[x.i] = k / (n - 1); });
    return r;
}
export function tempoKlipu(sek, okresSek) {
    if (!(sek > 0) || !(okresSek > 0)) return { uderzen: 1, skala: 1 };
    let naj = UDERZENIA_KLIPU[0], blad = Infinity;
    for (const u of UDERZENIA_KLIPU) { const e = Math.abs(Math.log2(sek / (u * okresSek))); if (e < blad - 1e-9) { blad = e; naj = u; } }
    return { uderzen: naj, skala: r3(sek / (naj * okresSek)) };
}
export function trafienieTaktu(sek, okresSek) {
    const { skala } = tempoKlipu(sek, okresSek);
    return Math.max(0, 1 - Math.abs(Math.log2(skala)) / 0.3);
}
export function ulozChoreografie(frazy, ruchy, okresSek, przypiete = {}) {
    if (!ruchy.length) return frazy.map(() => -1);
    const eR = rangi(frazy.map((f) => f.energia));
    const mR = rangi(ruchy.map((r) => r.moc));
    const uzycia = ruchy.map(() => 0);
    const uklad = [];
    for (let i = 0; i < frazy.length; i++) {
        const p = przypiete[i];
        if (Number.isInteger(p) && p >= 0 && p < ruchy.length) { uklad.push(p); uzycia[p]++; continue; }
        let naj = 0, koszt = Infinity;
        for (let m = 0; m < ruchy.length; m++) {
            const k = Math.abs(mR[m] - eR[i])
                + 0.3 * (1 - trafienieTaktu(ruchy[m].sek, okresSek))
                + 0.12 * uzycia[m]
                + (ruchy.length > 1 && uklad[i - 1] === m ? 1 : 0)
                + (ruchy.length > 1 && przypiete[i + 1] === m ? 1 : 0);
            if (k < koszt - 1e-9) { koszt = k; naj = m; }
        }
        uklad.push(naj); uzycia[naj]++;
    }
    return uklad;
}
export function ocenChoreografie({ okresSek, frazy, ruchy, uklad }) {
    const n = frazy.length;
    if (n < 2 || ruchy.length < 1 || uklad.length !== n || uklad.some((m) => !Number.isInteger(m) || m < 0 || m >= ruchy.length)) return { wynik: 0, takt: 0, energia: 0, roznorodnosc: 0 };
    const eR = rangi(frazy.map((f) => f.energia));
    const mR = rangi(ruchy.map((r) => r.moc));
    let t = 0, e = 0, powtorki = 0;
    for (let i = 0; i < n; i++) {
        t += trafienieTaktu(ruchy[uklad[i]].sek, okresSek);
        e += Math.abs(mR[uklad[i]] - eR[i]);
        if (i && uklad[i] === uklad[i - 1]) powtorki++;
    }
    const takt = t / n;
    const energia = Math.max(0, 1 - 2 * (e / n));
    const rozne = new Set(uklad).size / Math.min(n, ruchy.length);
    const roznorodnosc = 0.6 * rozne + 0.4 * (1 - powtorki / (n - 1));
    const wynik = Math.round(100 * (WAGI.takt * takt + WAGI.energia * energia + WAGI.roznorodnosc * roznorodnosc));
    return { wynik, takt: r3(takt), energia: r3(energia), roznorodnosc: r3(roznorodnosc) };
}
export function odciskChoreografii({ okresSek, frazy, ruchy, uklad }) {
    const s = JSON.stringify([r3(okresSek), frazy.map((f) => [f.od, f.uderzen, f.energia]), ruchy.map((r) => [r.nazwa, r3(r.sek), r3(r.moc)]), uklad]);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
}
export const rangaOceny = (w) => (w >= 90 ? 'S' : w >= 75 ? 'A' : w >= 60 ? 'B' : w >= 40 ? 'C' : 'D');

// ── okresy turniejów (UTC) ──
const dzienUTC = (t) => new Date(t).toISOString().slice(0, 10);
/** Tydzień ISO 8601 („2026-W42”) dla chwili `t` (UTC). */
export function tydzienISO(t) {
    const d = new Date(t);
    const dzien = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const nr = dzien.getUTCDay() || 7;
    dzien.setUTCDate(dzien.getUTCDate() + 4 - nr);   // czwartek tego tygodnia wyznacza rok
    const rok = dzien.getUTCFullYear();
    const tydz = Math.ceil(((dzien - Date.UTC(rok, 0, 1)) / 86_400_000 + 1) / 7);
    return `${rok}-W${String(tydz).padStart(2, '0')}`;
}
/** Otwarte dziś okresy: dzień, tydzień, miesiąc, rok — i Mistrzostwa Świata przez cały grudzień. */
export function okresyTanca(teraz = Date.now()) {
    const d = dzienUTC(teraz);
    const rok = d.slice(0, 4);
    const out = [
        { okres: 'dzien', klucz: d, nazwa: OKRESY.dzien },
        { okres: 'tydzien', klucz: tydzienISO(teraz), nazwa: OKRESY.tydzien },
        { okres: 'miesiac', klucz: d.slice(0, 7), nazwa: OKRESY.miesiac },
        { okres: 'rok', klucz: rok, nazwa: OKRESY.rok },
    ];
    if (d.slice(5, 7) === '12') out.push({ okres: 'mistrzostwa', klucz: `MS-${rok}`, nazwa: `${OKRESY.mistrzostwa} ${rok}` });
    return out;
}
/** Kiedy następne Mistrzostwa Świata (dla napisu w apce). */
export const mistrzostwaOd = (teraz = Date.now()) => `${dzienUTC(teraz).slice(0, 4)}-12-01`;

// ── dane z apki → bezpieczna postać ──
export function oczyscRuchy(ruchy) {
    if (!Array.isArray(ruchy)) throw new Error('Brak ruchów tańca.');
    const out = [], nazwy = new Set();
    for (const r of ruchy.slice(0, MAX_RUCHOW)) {
        const nazwa = String(r?.nazwa ?? '').replace(/[^\p{L}\p{N} _.|:-]/gu, '').trim().slice(0, 60);
        const sek = Number(r?.sek), moc = Number(r?.moc);
        if (!nazwa || nazwy.has(nazwa) || !(sek > 0.1 && sek < 120) || !(moc >= 0 && moc < 1000)) throw new Error(`Ruch „${nazwa || '?'}” ma złe dane (długość/moc).`);
        nazwy.add(nazwa);
        out.push({ nazwa, sek: r3(sek), moc: r3(moc) });
    }
    if (out.length < 2) throw new Error('Choreografia potrzebuje co najmniej 2 ruchów tańca (rig z akcjami tanecznymi).');
    return out;
}

/** Występ z wizytówki innej Katedry → sprawdzony wpis albo { odrzucony, powod }. Ocena liczona od nowa. */
export function tanecZSieci(t, nick, teraz = Date.now()) {
    if (!t || typeof t !== 'object' || !OKRESY[t.okres]) return null;
    const otwarte = okresyTanca(teraz).find((o) => o.okres === t.okres);
    if (!otwarte || otwarte.klucz !== String(t.klucz)) return null;   // okres się skończył (albo jeszcze nie zaczął)
    const d = t.dane ?? {};
    try {
        const okresSek = Number(d.okresSek);
        if (!(okresSek > 0.2 && okresSek < 2)) throw new Error('złe tempo');
        if (!Array.isArray(d.frazy) || d.frazy.length < 2 || d.frazy.length > MAX_FRAZ) throw new Error('złe frazy');
        const frazy = d.frazy.map((f) => ({ od: r3(Number(f?.[0])), uderzen: Math.round(Number(f?.[1])), energia: r3(Number(f?.[2])) }));
        if (frazy.some((f) => !(f.od >= 0) || !FRAZY.includes(f.uderzen) || !(f.energia >= 0 && f.energia <= 1))) throw new Error('złe frazy');
        const ruchy = oczyscRuchy((Array.isArray(d.ruchy) ? d.ruchy : []).map((r) => ({ nazwa: r?.[0], sek: r?.[1], moc: r?.[2] })));
        const uklad = Array.isArray(d.uklad) ? d.uklad.map(Number) : [];
        const ocena = ocenChoreografie({ okresSek, frazy, ruchy, uklad });
        if (ocena.wynik !== Math.round(Number(t.ocena?.wynik))) throw new Error(`ocena się nie zgadza (deklaruje ${t.ocena?.wynik}, z układu wychodzi ${ocena.wynik})`);
        const odcisk = odciskChoreografii({ okresSek, frazy, ruchy, uklad });
        if (odcisk !== t.odcisk) throw new Error('odcisk układu się nie zgadza');
        return { nick, okres: t.okres, klucz: otwarte.klucz, ocena, odcisk, mini: String(t.mini ?? '').slice(0, 40), utwor: String(t.utwor ?? '').slice(0, 80), bpm: Math.round(60 / okresSek), frazy: frazy.length, kiedy: String(t.kiedy ?? '').slice(0, 30) };
    } catch (e) { return { odrzucony: true, nick, okres: t.okres, powod: e.message }; }
}

/** Ranking okresu: najwyższa ocena, przy remisie wcześniejszy występ. */
export const rankingTanca = (wpisy) => [...wpisy].sort((a, b) => b.ocena.wynik - a.ocena.wynik || String(a.kiedy).localeCompare(String(b.kiedy)));

/**
 * @param {{ katalog: string, rytm: (plik:string) => Promise<object>, katalogMontazy: (projekt:string) => Promise<string>,
 *           ffmpeg?: string, uruchom?: Function, mistrzGry?: { wynikChoreografii?: Function }, teraz?: () => number }} o
 */
export function utworzChoreografie({ katalog, rytm, katalogMontazy, ffmpeg = null, uruchom = null, mistrzGry = null, teraz = () => Date.now() }) {
    const KAT = () => path.join(katalog, 'choreografie');
    const plikC = (id) => { if (!ID.test(String(id))) throw new Error('Złe id choreografii.'); return path.join(KAT(), `${id}.json`); };
    const PLIK_T = () => path.join(KAT(), 'turnieje.json');
    let kolejka = Promise.resolve();
    const poKolei = (fn) => { const p = kolejka.then(fn, fn); kolejka = p.catch(() => {}); return p; };

    async function wczytaj(id) {
        try { return JSON.parse(await fs.readFile(plikC(id), 'utf8')); } catch (e) { if (e.code === 'ENOENT') throw new Error('Nie ma takiej choreografii.'); throw e; }
    }
    const skrot = (c) => ({ id: c.id, nazwa: c.nazwa, mini: c.mini, utwor: c.utwor, fraza: c.fraza, frazy: c.frazy.length, ocena: c.ocena, odcisk: c.odcisk, nagrania: c.nagrania ?? [], zmieniono: c.zmieniono });

    async function lista() {
        const pliki = await fs.readdir(KAT()).catch(() => []);
        const out = [];
        for (const f of pliki) if (/^c-[0-9a-f]{8}\.json$/.test(f)) { try { out.push(skrot(JSON.parse(await fs.readFile(path.join(KAT(), f), 'utf8')))); } catch { /* uszkodzony plik pomijamy */ } }
        return out.sort((a, b) => String(b.zmieniono).localeCompare(String(a.zmieniono)));
    }

    /** Zapis (nowa albo zmiana z `id`). Frazy i ocena — z rytmu utworu policzonego przez most. */
    async function zapisz(dane = {}) {
        const plik = String(dane.utwor?.plik ?? '');
        if (!plik) throw new Error('Wybierz utwór.');
        const fraza = Number(dane.fraza);
        if (!FRAZY.includes(fraza)) throw new Error(`Fraza: ${FRAZY.join(' / ')} uderzeń.`);
        const r = await rytm(plik);
        const frazy = frazyZRytmu(r, fraza);
        if (frazy.length < 2) throw new Error('Utwór za krótki na choreografię (mniej niż 2 frazy).');
        const ruchy = oczyscRuchy(dane.ruchy);
        const uklad = Array.isArray(dane.uklad) ? dane.uklad.map(Number) : [];
        if (uklad.length !== frazy.length) throw new Error(`Układ ma ${uklad.length} fraz, a utwór (z rytmu mostu) ma ${frazy.length} — ułóż od nowa.`);
        if (uklad.some((m) => !Number.isInteger(m) || m < 0 || m >= ruchy.length)) throw new Error('Układ wskazuje ruch, którego nie ma.');
        const przypiete = [...new Set((Array.isArray(dane.przypiete) ? dane.przypiete : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < frazy.length))].sort((a, b) => a - b);
        const okresSek = r.okresSek;
        const ocena = ocenChoreografie({ okresSek, frazy, ruchy, uklad });
        const odcisk = odciskChoreografii({ okresSek, frazy, ruchy, uklad });
        const mini = { id: String(dane.mini?.id ?? '').slice(0, 40), nazwa: String(dane.mini?.nazwa ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'TeOgochi' };
        return poKolei(async () => {
            const stara = dane.id ? await wczytaj(dane.id).catch(() => null) : null;
            const id = stara?.id ?? `c-${crypto.randomBytes(4).toString('hex')}`;
            const nazwa = String(dane.nazwa ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || `${mini.nazwa} — ${String(dane.utwor?.tytul ?? plik).slice(0, 50)}`;
            const c = {
                wersja: 1, id, nazwa, mini,
                utwor: { plik, tytul: String(dane.utwor?.tytul ?? path.basename(plik)).slice(0, 120), bpm: r.bpm, okresSek, przesuniecieSek: r.przesuniecieSek, sekundy: r.sekundy, pewnosc: r.pewnosc ?? null },
                fraza, frazy, ruchy, uklad, przypiete, ocena, odcisk,
                nagrania: stara?.nagrania ?? [], utworzono: stara?.utworzono ?? new Date(teraz()).toISOString(), zmieniono: new Date(teraz()).toISOString(),
            };
            await fs.mkdir(KAT(), { recursive: true });
            await fs.writeFile(plikC(id), JSON.stringify(c, null, 2), 'utf8');
            return c;
        });
    }
    async function usun(id) { await fs.unlink(plikC(id)).catch((e) => { if (e.code === 'ENOENT') throw new Error('Nie ma takiej choreografii.'); throw e; }); return true; }

    /** 🎥 Film występu (webm z przeglądarki) → montaż projektu `taneczne-starcie` → mp4. */
    async function nagranie(id, bufor, { typ = 'video/webm' } = {}) {
        const c = await wczytaj(id);
        if (!Buffer.isBuffer(bufor) || bufor.length < 1024) throw new Error('Nagranie jest puste — przeglądarka nic nie oddała.');
        if (bufor.length > MAX_NAGRANIA_MB * 1024 * 1024) throw new Error(`Nagranie ma ${(bufor.length / 1048576).toFixed(0)} MB — limit to ${MAX_NAGRANIA_MB} MB (OTAKOS_TANIEC_NAGRANIE_MB).`);
        if (!/^video\/(webm|mp4)/.test(typ)) throw new Error('Nagranie musi być filmem webm albo mp4.');
        const kat = await katalogMontazy(PROJEKT);
        const baza = `taniec_${c.nazwa.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'wystep'}_${crypto.randomBytes(3).toString('hex')}`;
        const wej = path.join(kat, `${baza}.${typ.includes('mp4') ? 'mp4' : 'webm'}`);
        await fs.writeFile(wej, bufor);
        let plik = wej, powod = null;
        if (!wej.endsWith('.mp4') && ffmpeg && uruchom) {
            const mp4 = path.join(kat, `${baza}.mp4`);
            try {
                await uruchom(ffmpeg, ['-y', '-loglevel', 'error', '-i', wej, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4], { timeout: 15 * 60_000 });
                await fs.unlink(wej).catch(() => {});
                plik = mp4;
            } catch (e) { powod = `mp4 nie wyszedł (${String(e.message).split('\n')[0].slice(0, 160)}) — zostaje webm`; await fs.unlink(mp4).catch(() => {}); }
        }
        const st = await fs.stat(plik);
        const wpis = { plik, nazwa: path.basename(plik), bajtow: st.size, kiedy: new Date(teraz()).toISOString(), odcisk: c.odcisk, powod };
        await poKolei(async () => {
            const cc = await wczytaj(id);
            cc.nagrania = [...(cc.nagrania ?? []), { nazwa: wpis.nazwa, bajtow: wpis.bajtow, kiedy: wpis.kiedy, odcisk: wpis.odcisk }].slice(-20);
            await fs.writeFile(plikC(id), JSON.stringify(cc, null, 2), 'utf8');
        });
        return { ...wpis, projekt: PROJEKT };
    }

    // ── turnieje ──
    async function wczytajT() { try { const t = JSON.parse(await fs.readFile(PLIK_T(), 'utf8')); t.wyniki ??= {}; return t; } catch { return { wyniki: {} }; } }
    /** Zgłoszenie: najlepsza ocena w każdym otwartym okresie. Ocena = ta policzona przez most przy zapisie. */
    async function zglos(id) {
        const c = await wczytaj(id);
        if (c.ocena?.wynik !== ocenChoreografie({ okresSek: c.utwor.okresSek, frazy: c.frazy, ruchy: c.ruchy, uklad: c.uklad }).wynik) throw new Error('Ocena w pliku nie zgadza się z układem — zapisz choreografię ponownie.');
        const kiedy = new Date(teraz()).toISOString();
        const wynik = await poKolei(async () => {
            const t = await wczytajT();
            const out = [];
            for (const o of okresyTanca(teraz())) {
                const k = `${o.okres}:${o.klucz}`;
                const stary = t.wyniki[k];
                const lepszy = !stary || c.ocena.wynik > stary.ocena.wynik;
                if (lepszy) t.wyniki[k] = { okres: o.okres, klucz: o.klucz, choreografia: c.id, ocena: c.ocena, odcisk: c.odcisk, mini: c.mini.nazwa, utwor: c.utwor.tytul, kiedy,
                    dane: { okresSek: c.utwor.okresSek, frazy: c.frazy.map((f) => [f.od, f.uderzen, f.energia]), ruchy: c.ruchy.map((r) => [r.nazwa, r.sek, r.moc]), uklad: c.uklad } };
                out.push({ ...o, poprawiony: lepszy, ocena: (lepszy ? c : stary).ocena.wynik, poprzednia: stary?.ocena?.wynik ?? null });
            }
            // stare okresy precz (zostaje 60 ostatnich wpisów)
            const otwarte = new Set(okresyTanca(teraz()).map((o) => `${o.okres}:${o.klucz}`));
            t.wyniki = Object.fromEntries(Object.entries(t.wyniki).sort((a, b) => (otwarte.has(b[0]) - otwarte.has(a[0])) || String(b[1].kiedy).localeCompare(String(a[1].kiedy))).slice(0, 60));
            await fs.mkdir(KAT(), { recursive: true });
            await fs.writeFile(PLIK_T(), JSON.stringify(t, null, 2), 'utf8');
            return out;
        });
        await mistrzGry?.wynikChoreografii?.({ mini: c.mini.nazwa, utwor: c.utwor.tytul, wynik: c.ocena.wynik, ranga: rangaOceny(c.ocena.wynik), okresy: wynik.filter((o) => o.poprawiony).map((o) => o.nazwa) })?.catch?.(() => {});
        return { choreografia: skrot(c), okresy: wynik };
    }
    /** Pole `tance` wizytówki: moje najlepsze występy w OTWARTYCH okresach, z danymi do sprawdzenia. */
    async function publiczne() {
        const t = await wczytajT();
        const otwarte = okresyTanca(teraz());
        return otwarte.map((o) => t.wyniki[`${o.okres}:${o.klucz}`]).filter(Boolean)
            .map(({ choreografia: _c, ...w }) => w);
    }
    async function moje() {
        const t = await wczytajT();
        return okresyTanca(teraz()).map((o) => ({ ...o, wynik: t.wyniki[`${o.okres}:${o.klucz}`] ? (({ dane: _d, ...w }) => w)(t.wyniki[`${o.okres}:${o.klucz}`]) : null }));
    }

    return { lista, wczytaj, zapisz, usun, nagranie, zglos, publiczne, moje, okresy: () => okresyTanca(teraz()), mistrzostwaOd: () => mistrzostwaOd(teraz()) };
}

/**
 * Trasy (Straż: `/api/choreografie`, `/api/taniec` — tylko maszyna). `raw` = parser surowego ciała (express.raw) dla nagrania.
 * @param {import('express').Express} app
 */
export function zamontujTrasyChoreografii(app, { choreografie, raw, klub = null, mistrzGry = null }) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(e.message?.startsWith('Nie ma') ? 404 : kod).json({ success: false, message: e.message }));
    app.get('/api/choreografie', (_req, res) => odp(res, choreografie.lista().then((choreografie_) => ({ choreografie: choreografie_ })), 500));
    app.get('/api/choreografie/:id', (req, res) => odp(res, choreografie.wczytaj(req.params.id).then((choreografia) => ({ choreografia }))));
    app.post('/api/choreografie', (req, res) => odp(res, choreografie.zapisz(req.body ?? {}).then((choreografia) => ({ choreografia }))));
    app.delete('/api/choreografie/:id', (req, res) => odp(res, choreografie.usun(req.params.id).then((usunieta) => ({ usunieta }))));
    app.post('/api/choreografie/:id/nagranie', raw({ type: ['video/*', 'application/octet-stream'], limit: `${MAX_NAGRANIA_MB}mb` }), (req, res) =>
        odp(res, choreografie.nagranie(req.params.id, req.body, { typ: String(req.get('content-type') || '') }).then((nagranie) => ({ nagranie }))));
    app.get('/api/taniec/turnieje', async (req, res) => {
        try {
            let pole = klub?.ostatniZwiad?.() ?? null, blad = null;
            if (req.query.zwiad === '1' && klub?.zwiad) { try { pole = await klub.zwiad({ swiezo: true }); } catch (e) { blad = e.message; } }
            const event = await mistrzGry?.eventDzisiaj?.().catch?.(() => null) ?? null;
            res.json({ success: true, okresy: await choreografie.moje(), mistrzostwaOd: choreografie.mistrzostwaOd(), rankingi: pole?.tance ?? null, odrzucone: pole?.tanceOdrzucone ?? [], zwiad: pole?.kiedy ?? null, online: pole?.online ?? null, eventDnia: event ? { nazwa: event.nazwa ?? null, zapowiedz: event.zapowiedz ?? null } : null, blad });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });
    app.post('/api/taniec/zglos', (req, res) => odp(res, choreografie.zglos(String(req.body?.id ?? ''))));
}

export default { utworzChoreografie, zamontujTrasyChoreografii, frazyZRytmu, ocenChoreografie, odciskChoreografii, ulozChoreografie, tempoKlipu, trafienieTaktu, rangi, okresyTanca, tydzienISO, tanecZSieci, rankingTanca, oczyscRuchy, rangaOceny };
