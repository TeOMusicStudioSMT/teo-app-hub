/**
 * 🎥 Wspólny warsztat programów studyjnych Katedry nagrywanych w przeglądarce (apka `_OtakOs_Apki/studio-zebrra`):
 * 🩰 Taniec w Zebrra Sports (services/ZebrraTaniec.js) i 🦎 Mame Leon Show (services/MameLeonShow.js).
 *
 * Każdy program trzyma odcinki jako `<katalog>/<program>/<id>/odcinek.json`, liczy głos kwestii raz (Głosy Stada,
 * schowek w `praca/`), a nagranie z MediaRecorder (webm/mp4) zamienia ffmpegiem na mp4 H.264+AAC w katalogu montaży.
 * Tu nie ma modelu ani sieci — sama mechanika plików, żeby oba programy zachowywały się tak samo (i jak Gol Dnia).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';

/**
 * 🔢 Liczby spoza faktów: scenariusz NIE może podać liczby, której nie ma w faktach (Suweren: „bez zmyślonych liczb”).
 * Liczby w tekście (także 7,5 / 7.5 / 85%) porównujemy z zestawem dozwolonych (liczby i ich zaokrąglenia).
 */
export function liczbyPozaFaktami(tekst, dozwolone) {
    const zestaw = new Set();
    for (const x of dozwolone ?? []) {
        const n = Number(x);
        if (!Number.isFinite(n)) continue;
        zestaw.add(String(n)); zestaw.add(String(Math.round(n))); zestaw.add(String(Math.round(n * 10) / 10));
    }
    const zle = [];
    for (const m of String(tekst ?? '').matchAll(/\d+(?:[.,]\d+)?/g)) {
        const n = Number(m[0].replace(',', '.'));
        if (!zestaw.has(String(n)) && !zle.includes(m[0])) zle.push(m[0]);
    }
    return zle;
}

/** Bezpieczny kawałek nazwy pliku (bez polskich znaków i spacji). */
export const bezpNazwa = (t, max = 32) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max) || 'odcinek';

/**
 * Magazyn odcinków programu: zapis atomowy (Windows: rename na czytany plik → EPERM, chwila i jeszcze raz), odczyt
 * z „duchem” (stan `robi` bez pracy w pamięci po restarcie mostu = błąd z powodem), lista, kolejka jednej pracy naraz.
 */
export function utworzMagazyn({ katalog, program, wzorId }) {
    const KAT = path.join(katalog, program);
    const plikO = (id) => { if (!wzorId.test(String(id))) throw new Error('Złe id odcinka.'); return path.join(KAT, id, 'odcinek.json'); };
    const wRobocie = new Set();
    let kolejka = Promise.resolve();

    async function pisz(s) {
        const p = plikO(s.id);
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(`${p}.tmp`, JSON.stringify(s, null, 1), 'utf8');
        for (let proba = 0; ; proba++) {
            try { await fs.rename(`${p}.tmp`, p); return; } catch (e) { if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || proba >= 8) throw e; await new Promise((r) => setTimeout(r, 25 * (proba + 1))); }
        }
    }
    async function wczytaj(id) {
        let s;
        try { s = JSON.parse(await fs.readFile(plikO(id), 'utf8')); } catch (e) { if (e.code === 'ENOENT') throw new Error('Nie ma takiego odcinka.'); throw e; }
        if (s.stan === 'robi' && !wRobocie.has(id)) {
            Object.assign(s, { stan: 'blad', powod: 'Przerwane — most był restartowany. „↻ Ponów” napisze scenariusz od nowa.' });
            await pisz(s).catch(() => {});
        }
        return s;
    }
    async function lista() {
        const out = [];
        for (const k of await fs.readdir(KAT).catch(() => [])) if (wzorId.test(k)) { try { out.push(await wczytaj(k)); } catch { /* uszkodzony */ } }
        return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }
    /** Praca w tle, jedna naraz (model na karcie); `wRobocie` mówi, że odcinek nie jest duchem. */
    function zakolejkuj(id, fn) {
        wRobocie.add(id);
        kolejka = kolejka.then(fn).catch(() => {}).finally(() => wRobocie.delete(id));
        return kolejka;
    }
    async function usun(id) {
        if (wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.');
        await fs.rm(path.dirname(plikO(id)), { recursive: true, force: true });
        return true;
    }
    const praca = (id) => path.join(path.dirname(plikO(id)), 'praca');
    const noweId = (prefiks) => `${prefiks}-${crypto.randomBytes(4).toString('hex')}`;
    return { KAT, plikO, pisz, wczytaj, lista, zakolejkuj, usun, praca, noweId, wRobocie, czekaj: () => kolejka };
}

/**
 * 🔊 Głos kwestii (Głosy Stada pod `glos` mówcy) — liczony raz, potem z `praca/studio-<sha>.wav|mp3`.
 * `mow({ tekst, glos, jezyk })` → { audio: Buffer, ext }. Bez silnika = błąd (apka pokaże kwestię napisem).
 */
export async function glosKwestii({ praca, kwestia, glos, jezyk, mow }) {
    const skrot = crypto.createHash('sha1').update(`${glos}|${jezyk}|${kwestia.tekst}`).digest('hex').slice(0, 12);
    for (const ext of ['wav', 'mp3']) { const p = path.join(praca, `studio-${skrot}.${ext}`); if (fsSync.existsSync(p)) return p; }
    if (!mow) throw new Error('Katedra nie ma silnika głosu — Studio pokaże kwestię napisem.');
    const g = await mow({ tekst: kwestia.tekst, glos, jezyk });
    await fs.mkdir(praca, { recursive: true });
    const p = path.join(praca, `studio-${skrot}.${g.ext === 'mp3' ? 'mp3' : 'wav'}`);
    await fs.writeFile(p, g.audio);
    return p;
}

/** 🎥 Nagranie z przeglądarki (webm/mp4) → `cel` mp4 H.264+AAC 30 kl./s, parzyste wymiary. Surowy plik sprzątany. */
export async function nagranieDoMp4({ bufor, typ = 'video/webm', praca, cel, ffmpeg = 'ffmpeg', minBajtow = 10_000 }) {
    if (!Buffer.isBuffer(bufor) || bufor.length < minBajtow) throw new Error('Nagranie jest puste albo za krótkie.');
    if (typ && !/^(video\/(webm|mp4)|application\/octet-stream)/.test(typ)) throw new Error('Nagranie musi być filmem webm albo mp4.');
    await fs.mkdir(praca, { recursive: true });
    await fs.mkdir(path.dirname(cel), { recursive: true });
    const we = path.join(praca, `studio-surowe.${/mp4/.test(typ) ? 'mp4' : 'webm'}`);
    await fs.writeFile(we, bufor);
    try {
        await new Promise((ok, zle) => execFile(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', we, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-r', '30',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', cel],
        { windowsHide: true, timeout: 15 * 60_000, maxBuffer: 16 * 1024 * 1024 },
        (e, _o, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').slice(-3).join(' | ').slice(0, 400)}`)) : ok())));
    } finally { await fs.rm(we, { force: true }).catch(() => {}); }
    return cel;
}

export default { liczbyPozaFaktami, bezpNazwa, utworzMagazyn, glosKwestii, nagranieDoMp4 };
