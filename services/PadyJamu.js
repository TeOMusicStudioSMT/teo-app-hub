/**
 * 🥁 Pady z dźwiękiem w Jamie z Joanną (Suweren 2026-10-22: „programować pady dźwiękiem… naciskając je, by dany dźwięk
 * leciał”) — strona MOSTU: zestawy padów na dysku i KAŻDY dźwięk przez ffmpeg do wav (Music Studio gra je w WebAudio).
 *
 * Zestaw = `_OtakOs_Muzyka/Jam z Joanną/Pady/<id>/` {zestaw.json, pad-<nr>-<hex>.wav}. Biblioteka utworów
 * (`/api/rytm/utwory`) widzi tylko jeden poziom katalogów, więc próbki padów nie trafiają do Radia.
 * Źródła dźwięku: nagranie / plik (dataURL — mikrofon, wav, mp3, ogg, m4a, wideo z dźwiękiem), próbka z Samplera
 * (`_OtakOs_Muzyka/_Stemy/…`), wycinek utworu z biblioteki (od–do). Wynik: wav 44,1 kHz stereo 16-bit, ≤ 30 s.
 * Przycięcie, głośność, strój, tryb, grupa i czułość to USTAWIENIA (nieniszczące) — liczy je apka.
 * `oczyscZestaw` = BLIŹNIAK `src/jam/pady.ts` apki (zmieniasz pola tu, zmień tam).
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';

export const PADOW = 16;
export const MAX_SEKUND = 30;
const MAX_BAJTOW = 60 * 1024 * 1024;
const TRYBY = ['raz', 'trzymaj', 'petla'];
const UDERZENIA = [1, 2, 4, 8, 16];
const AUDIO = /\.(mp3|wav|flac|ogg|m4a)$/i;

const liczba = (v, min, max, dom) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dom; };
const r3 = (x) => Math.round(x * 1000) / 1000;
export const czyPlikPadu = (p) => typeof p === 'string' && /^pad-\d{1,2}-[0-9a-f]{6,16}\.wav$/.test(p);
const padDomyslny = () => ({ plik: null, zrodlo: 'perkusja syntezowana', od: 0, do: null, glosnosc: 1, normalizacja: true, stroj: 0, tryb: 'raz', petlaUderzen: 4, grupa: 0, czulosc: 0.7 });

export function oczyscZestaw(x) {
    const o = x && typeof x === 'object' ? x : {};
    const lista = Array.isArray(o.pady) ? o.pady : [];
    const pady = Array.from({ length: PADOW }, (_, i) => {
        const p = lista[i] && typeof lista[i] === 'object' ? lista[i] : {};
        const d = padDomyslny();
        const od = r3(liczba(p.od, 0, MAX_SEKUND * 20, 0));
        const doS = p.do === null || p.do === undefined ? null : r3(liczba(p.do, 0, MAX_SEKUND * 20, 0));
        return {
            plik: czyPlikPadu(p.plik) ? p.plik : null,
            zrodlo: String(p.zrodlo ?? (czyPlikPadu(p.plik) ? 'próbka' : d.zrodlo)).replace(/[\u0000-\u001f]/g, ' ').slice(0, 120),
            od, do: doS !== null && doS > od ? doS : null,
            glosnosc: r3(liczba(p.glosnosc, 0, 2, d.glosnosc)),
            normalizacja: typeof p.normalizacja === 'boolean' ? p.normalizacja : d.normalizacja,
            stroj: Math.round(liczba(p.stroj, -24, 24, 0)),
            tryb: TRYBY.includes(String(p.tryb)) ? p.tryb : d.tryb,
            petlaUderzen: UDERZENIA.includes(Number(p.petlaUderzen)) ? Number(p.petlaUderzen) : d.petlaUderzen,
            grupa: Math.round(liczba(p.grupa, 0, 8, 0)),
            czulosc: r3(liczba(p.czulosc, 0, 1, d.czulosc)),
        };
    });
    return { nazwa: String(o.nazwa ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 60) || 'Mój zestaw', wersja: 1, pady };
}

/** Id katalogu zestawu z nazwy: małe litery, cyfry, myślniki. */
export function idZNazwy(nazwa) {
    const s = String(nazwa ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return s || 'zestaw';
}
const czyId = (id) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(String(id));

/** dataURL → Buffer (każdy typ; ffmpeg i tak sprawdzi, czy jest dźwięk). */
function zDataURL(d) {
    const m = String(d ?? '').match(/^data:([^;,]*)(;base64)?,(.*)$/s);
    if (!m) throw new Error('Dźwięk musi przyjść jako dataURL (plik albo nagranie z mikrofonu).');
    const b = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]));
    if (b.length < 256) throw new Error('Plik dźwięku jest pusty.');
    if (b.length > MAX_BAJTOW) throw new Error('Plik większy niż 60 MB — przytnij go wcześniej.');
    return b;
}

/**
 * @param {{ katalogMuzyki: string, ffmpeg: string, szyna?: any }} cfg
 */
export function utworzPadyJamu({ katalogMuzyki, ffmpeg, szyna = null }) {
    const KAT = path.join(katalogMuzyki, 'Jam z Joanną', 'Pady');
    const katZestawu = (id) => { if (!czyId(id)) throw new Error('Zła nazwa zestawu.'); return path.join(KAT, id); };
    const url = (id, plik) => `/music/${['Jam z Joanną', 'Pady', id, plik].map(encodeURIComponent).join('/')}`;
    let kolejka = Promise.resolve();
    const poKolei = (f) => { const p = kolejka.then(f); kolejka = p.catch(() => {}); return p; };

    async function wczytaj(id) {
        const k = katZestawu(id);
        let z;
        try { z = JSON.parse(await fs.readFile(path.join(k, 'zestaw.json'), 'utf8')); } catch (e) { if (e.code === 'ENOENT') throw new Error('Nie ma takiego zestawu padów.'); throw e; }
        const c = oczyscZestaw(z);
        // plik, którego nie ma na dysku = pad wraca do syntezy (uczciwie, z powodem)
        c.pady = c.pady.map((p) => (p.plik && !fsSync.existsSync(path.join(k, p.plik)) ? { ...p, plik: null, zrodlo: `brak pliku ${p.plik} — perkusja syntezowana` } : p));
        return c;
    }
    const zUrl = (id, z) => ({ id, ...z, pady: z.pady.map((p) => ({ ...p, url: p.plik ? url(id, p.plik) : null })) });
    const zapisz = async (id, z) => { const k = katZestawu(id); await fs.mkdir(k, { recursive: true }); await fs.writeFile(path.join(k, 'zestaw.json'), JSON.stringify(oczyscZestaw(z), null, 2)); return z; };

    async function lista() {
        const out = [];
        for (const d of await fs.readdir(KAT, { withFileTypes: true }).catch(() => [])) {
            if (!d.isDirectory() || !czyId(d.name)) continue;
            try { const z = await wczytaj(d.name); out.push({ id: d.name, nazwa: z.nazwa, probek: z.pady.filter((p) => p.plik).length }); } catch { /* uszkodzony */ }
        }
        return out.sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
    }

    /** Nowy zestaw (pusty albo kopia z `z` — „zapisz jako…”, z plikami). */
    async function nowy({ nazwa, z: zZestawu = null } = {}) {
        return poKolei(async () => {
            const baza = idZNazwy(nazwa);
            let id = baza;
            for (let i = 2; fsSync.existsSync(path.join(KAT, id)); i++) id = `${baza}-${i}`.slice(0, 40);
            const k = katZestawu(id);
            await fs.mkdir(k, { recursive: true });
            let z = oczyscZestaw({ nazwa });
            if (zZestawu) {
                const zrodlo = await wczytaj(zZestawu);
                for (const p of zrodlo.pady) if (p.plik) await fs.copyFile(path.join(katZestawu(zZestawu), p.plik), path.join(k, p.plik));
                z = { ...zrodlo, nazwa: oczyscZestaw({ nazwa }).nazwa };
            }
            await zapisz(id, z);
            return zUrl(id, await wczytaj(id));
        });
    }

    /** Ustawienia padów (pliki zostają te, które są w zestawie — nowych nie da się tu „dopisać”). */
    async function ustaw(id, nowe) {
        return poKolei(async () => {
            const stary = await wczytaj(id);
            const c = oczyscZestaw({ ...nowe, nazwa: nowe?.nazwa ?? stary.nazwa });
            c.pady = c.pady.map((p, i) => ({ ...p, plik: stary.pady[i].plik, zrodlo: stary.pady[i].plik ? stary.pady[i].zrodlo : p.zrodlo }));
            await zapisz(id, c);
            return zUrl(id, await wczytaj(id));
        });
    }

    async function ffmpegWav(argsWejscia) {
        const t = path.join(KAT, `.robocze-${crypto.randomBytes(4).toString('hex')}.wav`);
        await fs.mkdir(KAT, { recursive: true });
        await new Promise((ok, zle) => execFile(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...argsWejscia, '-vn', '-t', String(MAX_SEKUND), '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', t],
            { windowsHide: true, timeout: 3 * 60_000, maxBuffer: 8 * 1024 * 1024 },
            (e, _o, err) => (e ? zle(new Error(/does not contain any stream|Output file #0 does not contain|matches no streams/i.test(String(err)) ? 'W tym pliku nie ma ścieżki dźwięku.' : `ffmpeg: ${String(err || e.message).trim().split('\n').slice(-2).join(' | ').slice(0, 300)}`)) : ok())));
        const st = await fs.stat(t);
        if (st.size < 44 + 4410 * 4) { await fs.rm(t, { force: true }); throw new Error('Dźwięk krótszy niż 0,1 s — nic do zagrania.'); }
        return t;
    }

    /**
     * Dźwięk na pad `nr` (1–16). `zrodlo`: {rodzaj: 'dane', dataURL, nazwa?} | {rodzaj: 'probka', stem} (ścieżka w _Stemy)
     * | {rodzaj: 'utwor', plik, od, do} (biblioteka). Stary plik padu usuwany po udanej zamianie.
     */
    async function dzwiek(id, nr, zrodlo = {}) {
        const n = Number(nr);
        if (!Number.isInteger(n) || n < 1 || n > PADOW) throw new Error(`Pad ${nr} poza 1–${PADOW}.`);
        const k = katZestawu(id);
        await wczytaj(id);
        let wejscie, opis, tmpWe = null;
        if (zrodlo.rodzaj === 'dane') {
            const b = zDataURL(zrodlo.dataURL);
            tmpWe = path.join(KAT, `.wejscie-${crypto.randomBytes(4).toString('hex')}`);
            await fs.mkdir(KAT, { recursive: true });
            await fs.writeFile(tmpWe, b);
            wejscie = ['-i', tmpWe];
            opis = zrodlo.nazwa ? `plik „${String(zrodlo.nazwa).slice(0, 60)}”` : 'nagranie z mikrofonu';
        } else if (zrodlo.rodzaj === 'probka') {
            const stemy = path.join(katalogMuzyki, '_Stemy');
            const p = path.resolve(stemy, String(zrodlo.stem ?? '').replace(/^_Stemy[\\/]/, ''));
            if (!p.startsWith(path.resolve(stemy) + path.sep) || !AUDIO.test(p) || !fsSync.existsSync(p)) throw new Error('Nie ma takiej próbki w _Stemy.');
            wejscie = ['-i', p];
            opis = `próbka ${path.relative(stemy, p).split(path.sep).join('/')}`;
        } else if (zrodlo.rodzaj === 'utwor') {
            const p = path.resolve(katalogMuzyki, String(zrodlo.plik ?? ''));
            if (!p.startsWith(path.resolve(katalogMuzyki) + path.sep) || !AUDIO.test(p) || !fsSync.existsSync(p)) throw new Error('Nie ma takiego utworu w bibliotece.');
            const od = liczba(zrodlo.od, 0, 3600, 0);
            const doS = liczba(zrodlo.do, od + 0.05, od + MAX_SEKUND, od + 2);
            wejscie = ['-ss', String(od), '-t', String(r3(doS - od)), '-i', p];
            opis = `utwór „${path.basename(p).replace(/\.[^.]+$/, '')}” ${r3(od)}–${r3(doS)} s`;
        } else throw new Error('Nieznane źródło dźwięku (dane / probka / utwor).');
        try {
            const t = await ffmpegWav(wejscie);
            return await poKolei(async () => {
                const z = await wczytaj(id);
                const plik = `pad-${n}-${crypto.randomBytes(4).toString('hex')}.wav`;
                await fs.rename(t, path.join(k, plik));
                const stary = z.pady[n - 1].plik;
                z.pady[n - 1] = { ...z.pady[n - 1], plik, zrodlo: opis, od: 0, do: null };
                await zapisz(id, z);
                if (stary && stary !== plik) await fs.rm(path.join(k, stary), { force: true }).catch(() => {});
                void szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `🥁 pad ${n} w zestawie „${z.nazwa}”: ${opis}` })?.catch?.(() => {});
                return zUrl(id, await wczytaj(id));
            });
        } finally { if (tmpWe) await fs.rm(tmpWe, { force: true }).catch(() => {}); }
    }

    /** Pad wraca do perkusji syntezowanej (plik usunięty). */
    async function bezDzwieku(id, nr) {
        return poKolei(async () => {
            const n = Number(nr);
            if (!Number.isInteger(n) || n < 1 || n > PADOW) throw new Error(`Pad ${nr} poza 1–${PADOW}.`);
            const z = await wczytaj(id);
            const stary = z.pady[n - 1].plik;
            z.pady[n - 1] = { ...z.pady[n - 1], plik: null, zrodlo: 'perkusja syntezowana', od: 0, do: null };
            await zapisz(id, z);
            if (stary) await fs.rm(path.join(katZestawu(id), stary), { force: true }).catch(() => {});
            return zUrl(id, await wczytaj(id));
        });
    }

    return { lista, nowy, ustaw, dzwiek, bezDzwieku, jeden: async (id) => zUrl(id, await wczytaj(id)), katalog: KAT };
}

export function zamontujTrasyPadow(app, P) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(/Nie ma takiego zestawu/.test(e.message) ? 404 : kod).json({ success: false, message: e.message }));
    app.get('/api/jam/pady', (_req, res) => odp(res, P.lista().then((zestawy) => ({ zestawy })), 500));
    app.post('/api/jam/pady', (req, res) => odp(res, P.nowy({ nazwa: req.body?.nazwa, z: req.body?.z ?? null }).then((zestaw) => ({ zestaw }))));
    app.get('/api/jam/pady/:id', (req, res) => odp(res, P.jeden(req.params.id).then((zestaw) => ({ zestaw }))));
    app.put('/api/jam/pady/:id', (req, res) => odp(res, P.ustaw(req.params.id, req.body ?? {}).then((zestaw) => ({ zestaw }))));
    app.post('/api/jam/pady/:id/pad/:nr', (req, res) => odp(res, P.dzwiek(req.params.id, req.params.nr, req.body ?? {}).then((zestaw) => ({ zestaw }))));
    app.delete('/api/jam/pady/:id/pad/:nr', (req, res) => odp(res, P.bezDzwieku(req.params.id, req.params.nr).then((zestaw) => ({ zestaw }))));
    return P;
}

export default { utworzPadyJamu, zamontujTrasyPadow, oczyscZestaw, idZNazwy, czyPlikPadu, PADOW };
