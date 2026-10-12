/**
 * 🎵 BAZYLIKA DŹWIĘKU — miejsce na wyspie Teterhii do tworzenia muzyki (Suweren 2026-10-12: „ten asset będzie
 * naszym miejscem do tworzenia tanecznych utworów i innych rzeczy związanych z dźwiękiem… nagrywa składankę/album
 * do produktów muzycznych Katedry”). Gra (src/bazylika.ts) robi to, co da się w przeglądarce; most — resztę:
 *
 *  · 🥁 BIT Z PRACOWNI: gra renderuje bit (OfflineAudioContext → WAV) i wzór kroków → `zapiszBit` → ffmpeg → mp3 w
 *    `_OtakOs_Muzyka/Bazylika/` (Radio Katedry widzi go od razu) + wzór `.json` obok (do ponownej edycji).
 *  · 🎤 ZAMÓWIENIE U JOANNY: opis po polsku → model Joanny pisze tagi po angielsku (bez modelu = szablon z opisu)
 *    → generator muzyki Katedry (`/api/music/generate`, ComfyUI × ACE) → odbiór (`/api/music/collect`) → biblioteka.
 *    Jedno naraz (GPU), stan w `zamowienia.json`; zgubione przy restarcie = „przerwane”.
 *  · 💿 ALBUM / SKŁADANKA: utwory TYLKO z biblioteki muzyki → ffmpeg (wspólny format, łagodne przejścia) → jeden plik
 *    w `_OtakOs_Muzyka/_Albumy/` (poza Radiem) + lista utworów z czasami → produkt Marketplace (moduł `muzyka`,
 *    typ `album`, cena GRV od Suwerena). Nic nie publikuje się poza Katedrą.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_BIT_B = 25 * 1024 * 1024;
export const MAX_UTWOROW_ALBUMU = 24;
const AUDIO = /\.(mp3|wav|flac|ogg|m4a)$/i;

export const nazwaPliku = (t, dom = 'utwor') => String(t ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || dom;
const tekst = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** Tagi dla generatora z opisu, gdy model milczy (uczciwy szablon — nie udaje Joanny). */
export function szablonPromptu({ opis, bpm, styl }) {
    return [styl || 'dance', 'energetic', 'groovy beat', `${bpm} bpm`, 'instrumental', tekst(opis, 200)].filter(Boolean).join(', ');
}
/** Odpowiedź modelu → jedna linia tagów po angielsku (bez cudzysłowów, <think>, „Prompt:”). */
export function oczyscPrompt(s) {
    const t = String(s ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*(prompt|tags)\s*:\s*/i, '').split('\n').map((x) => x.trim()).filter(Boolean)[0] ?? '';
    return t.replace(/^["'„”]+|["'„”]+$/g, '').slice(0, 500).trim();
}

/**
 * @param {{ katalogMuzyki: string, katalog: string, ffmpeg: string, uruchom: Function,
 *   pisz?: (system: string, prompt: string) => Promise<string>, most: (sciezka: string, cialo?: object) => Promise<any>,
 *   czekaj?: (ms: number) => Promise<void> }} o
 */
export function utworzBazylike({ katalogMuzyki, katalog, ffmpeg, uruchom, pisz = null, most, czekaj = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
    const KAT_BITOW = path.join(katalogMuzyki, 'Bazylika');
    const KAT_ALBUMOW = path.join(katalogMuzyki, '_Albumy');
    const PLIK_ZAMOWIEN = path.join(katalog, 'zamowienia.json');
    let zamowienia = null;
    let kolejka = Promise.resolve();

    const wMuzyce = (rel) => {
        const p = path.resolve(katalogMuzyki, String(rel ?? ''));
        if (!p.startsWith(path.resolve(katalogMuzyki) + path.sep) || !AUDIO.test(p)) throw new Error(`„${rel}” nie jest utworem z biblioteki muzyki.`);
        return p;
    };

    // ── 🥁 bit z Pracowni ──
    async function zapiszBit({ nazwa, dataURL, bpm, wzor } = {}) {
        const m = /^data:audio\/(wav|wave|x-wav);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataURL ?? ''));
        if (!m) throw new Error('Bit musi przyjść jako WAV (data:audio/wav;base64,…).');
        const wav = Buffer.from(m[2], 'base64');
        if (wav.length > MAX_BIT_B) throw new Error('Bit za długi (limit 25 MB WAV).');
        if (wav.length < 1000 || wav.toString('ascii', 0, 4) !== 'RIFF') throw new Error('To nie jest plik WAV.');
        await fs.mkdir(KAT_BITOW, { recursive: true });
        const baza = `${nazwaPliku(nazwa, 'Bit')}_${Date.now().toString(36)}`;
        const tmp = path.join(KAT_BITOW, `${baza}.tmp.wav`);
        const cel = path.join(KAT_BITOW, `${baza}.mp3`);
        await fs.writeFile(tmp, wav);
        try { await uruchom(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '256k', cel]); }
        finally { await fs.rm(tmp, { force: true }); }
        const meta = { nazwa: tekst(nazwa, 60) || 'Bit', bpm: Math.round(Math.min(200, Math.max(60, Number(bpm) || 120))), wzor: wzor && typeof wzor === 'object' ? wzor : null, utworzono: new Date().toISOString(), zrodlo: 'bazylika' };
        if (JSON.stringify(meta).length > 50_000) meta.wzor = null;
        await fs.writeFile(path.join(KAT_BITOW, `${baza}.json`), JSON.stringify(meta, null, 2));
        return { plik: `Bazylika/${baza}.mp3`, url: `/music/Bazylika/${encodeURIComponent(baza)}.mp3`, ...meta };
    }

    async function bity() {
        const out = [];
        for (const f of await fs.readdir(KAT_BITOW).catch(() => [])) {
            if (!f.endsWith('.mp3')) continue;
            const meta = JSON.parse(await fs.readFile(path.join(KAT_BITOW, f.replace(/\.mp3$/, '.json')), 'utf8').catch(() => '{}'));
            out.push({ plik: `Bazylika/${f}`, url: `/music/Bazylika/${encodeURIComponent(f)}`, nazwa: meta.nazwa ?? f, bpm: meta.bpm ?? null, wzor: meta.wzor ?? null, utworzono: meta.utworzono ?? null });
        }
        return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    // ── 🎤 zamówienie u Joanny ──
    async function wczytajZam() {
        if (zamowienia) return zamowienia;
        try { zamowienia = JSON.parse(await fs.readFile(PLIK_ZAMOWIEN, 'utf8')); } catch { zamowienia = []; }
        // po restarcie mostu nic już tych zamówień nie liczy — mówimy to wprost
        for (const z of zamowienia) if (['czeka', 'pisze', 'gra'].includes(z.stan)) Object.assign(z, { stan: 'przerwane', blad: 'Most wstał na nowo w trakcie — zamów jeszcze raz.' });
        return zamowienia;
    }
    async function zapiszZam() { await fs.mkdir(katalog, { recursive: true }); await fs.writeFile(PLIK_ZAMOWIEN, JSON.stringify(zamowienia.slice(-50), null, 2)); }

    async function zamow({ opis, bpm = 124, sekundy = 90, styl = '' } = {}) {
        const o = tekst(opis, 400);
        if (o.length < 3) throw new Error('Opisz utwór (co najmniej kilka słów).');
        await wczytajZam();
        if (zamowienia.filter((z) => ['czeka', 'pisze', 'gra'].includes(z.stan)).length >= 3) throw new Error('Joanna ma już 3 utwory w kolejce — poczekaj, aż skończy.');
        const z = { id: `zam-${Date.now().toString(36)}`, opis: o, styl: tekst(styl, 40), bpm: Math.round(Math.min(180, Math.max(70, Number(bpm) || 124))), sekundy: Math.round(Math.min(240, Math.max(20, Number(sekundy) || 90))), stan: 'czeka', utworzono: new Date().toISOString() };
        zamowienia.push(z);
        await zapiszZam();
        const kopia = { ...z };
        kolejka = kolejka.then(() => wykonaj(z)).catch(() => {});
        return kopia;
    }

    async function wykonaj(z) {
        const zmien = async (d) => { Object.assign(z, d); await zapiszZam(); };
        try {
            await zmien({ stan: 'pisze' });
            let prompt = '';
            if (pisz) {
                try {
                    prompt = oczyscPrompt(await pisz(
                        'Jesteś Joanną, producentką muzyczną Katedry. Zamieniasz opis utworu na JEDNĄ linię tagów po angielsku dla generatora muzyki (gatunek, nastrój, instrumenty, tempo w bpm, „instrumental” jeśli bez śpiewu). Zwróć SAMĄ linię tagów.',
                        `Opis Suwerena: ${z.opis}\nStyl: ${z.styl || 'taneczny'}\nTempo: ${z.bpm} bpm\nUtwór do tańca TeOgochi na wyspie Teterhii.`));
                } catch { prompt = ''; }
            }
            const zModelu = prompt.length >= 10;
            if (!zModelu) prompt = szablonPromptu(z);
            await zmien({ stan: 'gra', prompt, promptOdJoanny: zModelu });
            const g = await most('/api/music/generate', { prompt, lyrics: '', duration: z.sekundy, bpm: z.bpm });
            if (!g?.promptId) throw new Error(g?.message || 'Generator muzyki nie przyjął zlecenia.');
            await zmien({ promptId: g.promptId, silnik: g.engine ?? null });
            const koniec = Date.now() + 45 * 60_000;
            let audio = null;
            while (!audio && Date.now() < koniec) {
                await czekaj(10_000);
                const p = await most(`/api/music/progress?promptId=${encodeURIComponent(g.promptId)}`);
                if (p?.stan === 'blad' || p?.stan === 'przerwane') throw new Error(p.message || `ComfyUI: ${p.stan}`);
                if (p?.stan === 'gotowe' && p.audio?.length) audio = p.audio[0];
            }
            if (!audio) throw new Error('Generator nie skończył w 45 min.');
            const c = await most('/api/music/collect', { filename: audio.filename, subfolder: audio.subfolder, type: audio.type, title: `Bazylika ${z.opis.slice(0, 40)}` });
            const abs = c?.savedPath ? path.resolve(c.savedPath) : null;
            const rel = abs && abs.startsWith(path.resolve(katalogMuzyki) + path.sep) ? path.relative(katalogMuzyki, abs).split(path.sep).join('/') : null;
            await zmien({ stan: 'gotowe', plik: rel, url: rel ? `/music/${rel.split('/').map(encodeURIComponent).join('/')}` : null, gotowe: new Date().toISOString() });
        } catch (e) { await zmien({ stan: 'blad', blad: e.message }); }
    }

    // ── 💿 album / składanka ──
    async function album({ tytul, utwory, cenaGRV = 100, opis = '', przejscie = 2 } = {}) {
        const t = tekst(tytul, 60);
        if (!t) throw new Error('Album potrzebuje tytułu.');
        const lista = (Array.isArray(utwory) ? utwory : []).map(String);
        if (lista.length < 2) throw new Error('Album to co najmniej 2 utwory.');
        if (lista.length > MAX_UTWOROW_ALBUMU) throw new Error(`Najwyżej ${MAX_UTWOROW_ALBUMU} utworów na album.`);
        const pliki = lista.map(wMuzyce);
        for (const p of pliki) await fs.access(p).catch(() => { throw new Error(`Nie ma utworu: ${path.basename(p)}`); });
        // czasy utworów (ffmpeg -i → Duration)
        const czasy = [];
        for (const p of pliki) {
            const w = await uruchom(ffmpeg, ['-hide_banner', '-i', p]).catch((e) => ({ stderr: String(e.stderr ?? e.message ?? '') }));
            const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(String(w.stderr ?? ''));
            if (!m) throw new Error(`Nie umiem odczytać długości: ${path.basename(p)}`);
            czasy.push(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
        }
        const xf = Math.min(6, Math.max(0, Number(przejscie) || 0));
        await fs.mkdir(KAT_ALBUMOW, { recursive: true });
        const baza = `${nazwaPliku(t, 'Album')}_${Date.now().toString(36)}`;
        const cel = path.join(KAT_ALBUMOW, `${baza}.mp3`);
        const wejscia = pliki.flatMap((p) => ['-i', p]);
        const norm = pliki.map((_, i) => `[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
        let laczenie;
        if (xf > 0) {
            let prev = 'a0';
            laczenie = pliki.slice(1).map((_, i) => { const out = i === pliki.length - 2 ? 'wyj' : `x${i}`; const s = `[${prev}][a${i + 1}]acrossfade=d=${xf}:c1=tri:c2=tri[${out}]`; prev = out; return s; });
        } else laczenie = [`${pliki.map((_, i) => `[a${i}]`).join('')}concat=n=${pliki.length}:v=0:a=1[wyj]`];
        await uruchom(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...wejscia, '-filter_complex', [...norm, ...laczenie].join(';'), '-map', '[wyj]', '-codec:a', 'libmp3lame', '-b:a', '256k', '-metadata', `title=${t}`, '-metadata', 'artist=Katedra OtakOS', cel], { maxBuffer: 1 << 24 });
        let start = 0;
        const sciezki = lista.map((rel, i) => { const w = { nr: i + 1, plik: rel, tytul: path.basename(rel).replace(/\.[^.]+$/, '').replace(/_/g, ' '), start: Math.round(start), sekundy: Math.round(czasy[i]) }; start += czasy[i] - (i < lista.length - 1 ? xf : 0); return w; });
        const meta = { tytul: t, opis: tekst(opis, 600), plik: `_Albumy/${baza}.mp3`, sekundy: Math.round(start), utwory: sciezki, przejscie: xf, utworzono: new Date().toISOString() };
        await fs.writeFile(path.join(KAT_ALBUMOW, `${baza}.json`), JSON.stringify(meta, null, 2));
        const lista2 = sciezki.map((s) => `${s.nr}. ${s.tytul} (${Math.floor(s.start / 60)}:${String(s.start % 60).padStart(2, '0')})`).join('\n');
        const d = await most('/api/market/create', {
            module: 'muzyka', type: 'album', name: t,
            desc: `${meta.opis ? `${meta.opis}\n\n` : ''}Album Katedry z Bazyliki Dźwięku — ${sciezki.length} utworów, ${Math.round(meta.sekundy / 60)} min.\n${lista2}`.slice(0, 2000),
            priceGrv: Math.max(0, Math.round(Number(cenaGRV) || 0)), creator: 'Bazylika Dźwięku', payload: { plik: meta.plik, url: `/music/${meta.plik.split('/').map(encodeURIComponent).join('/')}`, utwory: sciezki, sekundy: meta.sekundy },
        });
        return { ...meta, url: `/music/${meta.plik.split('/').map(encodeURIComponent).join('/')}`, produkt: d?.product ?? null };
    }

    async function albumy() {
        const out = [];
        for (const f of await fs.readdir(KAT_ALBUMOW).catch(() => [])) if (f.endsWith('.json')) out.push(JSON.parse(await fs.readFile(path.join(KAT_ALBUMOW, f), 'utf8').catch(() => 'null')));
        return out.filter(Boolean).sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    return { zapiszBit, bity, zamow, zamowienia: async () => [...(await wczytajZam())].reverse(), album, albumy, _czekajNaKolejke: () => kolejka };
}

export default { utworzBazylike, szablonPromptu, oczyscPrompt, nazwaPliku };
