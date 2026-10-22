/**
 * 🎹 Jam z Joanną na żywo (Suweren 2026-10-20: gra na AKAI MPK mini, Joanna odpowiada) — strona MOSTU.
 *
 * Grę, brzmienie i odpowiedzi liczy Music Studio V2 w przeglądarce (Web MIDI + WebAudio, czysty
 * rdzeń `src/jam/*` z testami) — most robi tylko to, czego przeglądarka nie zrobi:
 *  · `strategia` — model przydziału TeOgochi `joanna` WYBIERA strategię odpowiedzi z zamkniętej listy
 *    (bliźniak `STRATEGIE` w `src/jam/fraza.ts` apki — zmieniasz listę, zmień obie) i mówi jedno zdanie.
 *    Nut NIE wymyśla: nuty liczy kod apki. Spoza listy / zły JSON = błąd wprost (apka gra wtedy po swojemu).
 *  · `zapisz` — nagranie dżemu: audio (webm/ogg/wav z MediaRecorder) → ffmpeg → mp3 + plik .mid + karta .json
 *    w `_OtakOs_Muzyka/Jam z Joanną/` → biblioteka `/api/rytm/utwory`, Radio, Warsztat Utworów.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFile } from 'child_process';

export const KATALOG = 'Jam z Joanną';
export const STRATEGIE = ['echo', 'odwrocenie', 'rak', 'sekwencja', 'wariacja', 'kadencja'];
export const OPIS_STRATEGII = {
    echo: 'ta sama fraza, o tercję wyżej w skali',
    odwrocenie: 'kontur lustrzany wokół pierwszej nuty',
    rak: 'fraza od końca, ten sam rytm',
    sekwencja: 'początek motywu powtórzony stopień i dwa wyżej',
    wariacja: 'te same dźwięki, nowy rytm',
    kadencja: 'odpowiedź schodząca krokami do toniki',
};
const MAX_AUDIO = 300 * 1024 * 1024;
const MAX_MIDI = 2 * 1024 * 1024;

/** Bezpieczna nazwa pliku (litery, cyfry, polskie znaki, spacja, myślnik). */
export function nazwaPliku(s) {
    const n = String(s ?? '').normalize('NFC').replace(/[^\p{L}\p{N} _-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    return n || 'jam';
}

/** Odpowiedź modelu → {strategia, komentarz}. Strategia spoza listy = wyjątek z powodem. */
export function odczytajStrategie(tekst) {
    const m = String(tekst ?? '').match(/\{[\s\S]*\}/);
    let o;
    try { o = JSON.parse(m ? m[0] : ''); } catch { throw new Error('Joanna nie oddała JSON-u.'); }
    const s = String(o?.strategia ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
    if (!STRATEGIE.includes(s)) throw new Error(`Strategia „${String(o?.strategia ?? '').slice(0, 40)}” spoza listy (${STRATEGIE.join(', ')}).`);
    const komentarz = String(o?.komentarz ?? '').replace(/[\r\n]+/g, ' ').replace(/[*_#`]/g, '').trim().slice(0, 200);
    return { strategia: s, komentarz };
}

export function promptStrategii({ fraza = {}, energia = 0.5, gestosc = 0.5, poprzednie = [] } = {}) {
    const lista = STRATEGIE.map((s) => `- ${s}: ${OPIS_STRATEGII[s]}`).join('\n');
    const system = [
        'Jesteś Joanna — TeOgochi muzyki Katedry OtakOS. Grasz na żywo z Suwerenem: on gra frazę, Ty odpowiadasz.',
        'NUT NIE PISZESZ — nuty policzy kod z frazy Suwerena. Ty wybierasz tylko STRATEGIĘ odpowiedzi z listy:',
        lista,
        'Dobierz strategię do frazy (kontur, energia, gęstość) i nie powtarzaj w kółko tej samej.',
        'Odpowiadasz WYŁĄCZNIE jednym obiektem JSON: {"strategia":"<id z listy>","komentarz":"<jedno krótkie, ciepłe zdanie po polsku do Suwerena o tym, co usłyszałaś i co odpowiadasz; bez liczb, których nie ma we frazie>"}',
    ].join('\n');
    const f = fraza && typeof fraza === 'object' ? fraza : {};
    const prompt = [
        `FRAZA SUWERENA: tonacja ${String(f.tonacja ?? '?').slice(0, 20)} (pewność ${Number(f.pewnoscTonacji ?? 0).toFixed(2)}), ${Number(f.bpm) || '?'} BPM, ${Number(f.nut) || 0} nut, kontur: ${String(f.kontur ?? '?').slice(0, 20)}, zakres ${String(f.zakres ?? '').slice(0, 20)}, średnia siła ${Number(f.sredniaSila) || 0}/127.`,
        `MELODIA: ${String(f.melodia ?? '').slice(0, 120)}`,
        `GAŁKI: energia ${Math.round(Number(energia) * 100) || 0}%, gęstość ${Math.round(Number(gestosc) * 100) || 0}%.`,
        `TWOJE OSTATNIE STRATEGIE: ${(Array.isArray(poprzednie) ? poprzednie : []).filter((s) => STRATEGIE.includes(s)).slice(-4).join(', ') || 'brak'}.`,
        'JSON:',
    ].join('\n');
    return { system, prompt };
}

const ffmpegNaMp3 = (ffmpeg, we, wy) => new Promise((ok, zle) => execFile(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', we, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', wy],
    { windowsHide: true, timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 },
    (e, _o, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').slice(-2).join(' | ').slice(0, 300)}`)) : ok())));

/**
 * @param {{ katalogMuzyki: string, ffmpeg: string, pisz?: (z: {system: string, prompt: string}) => Promise<{tekst: string, model?: string}>, szyna?: any, teraz?: () => Date }} cfg
 */
export function utworzJam({ katalogMuzyki, ffmpeg, pisz, szyna, teraz = () => new Date() }) {
    const katalog = path.join(katalogMuzyki, KATALOG);
    const rel = (p) => path.relative(katalogMuzyki, p).split(path.sep).join('/');
    const url = (r) => `/music/${r.split('/').map(encodeURIComponent).join('/')}`;

    async function strategia(z = {}) {
        if (!pisz) throw new Error('Most nie ma modelu Joanny.');
        const { system, prompt } = promptStrategii(z);
        const t0 = Date.now();
        const w = await pisz({ system, prompt });
        return { ...odczytajStrategie(w.tekst), model: w.model ?? null, ms: Date.now() - t0 };
    }

    async function zapisz({ audio, typAudio = 'audio/webm', midi, meta = {} } = {}) {
        const a = Buffer.isBuffer(audio) ? audio : Buffer.from(String(audio ?? ''), 'base64');
        const m = Buffer.isBuffer(midi) ? midi : Buffer.from(String(midi ?? ''), 'base64');
        if (a.length < 2048) throw new Error('Nagranie dźwięku jest puste albo za krótkie.');
        if (a.length > MAX_AUDIO) throw new Error('Nagranie dźwięku większe niż 300 MB.');
        if (!/^(audio\/(webm|ogg|wav|x-wav|mp4)|video\/webm|application\/octet-stream)/.test(String(typAudio))) throw new Error('Dźwięk musi być webm, ogg, wav albo mp4.');
        if (m.length < 14 || m.subarray(0, 4).toString('latin1') !== 'MThd') throw new Error('Plik MIDI jest pusty albo uszkodzony (brak MThd).');
        if (m.length > MAX_MIDI) throw new Error('Plik MIDI większy niż 2 MB.');
        await fs.mkdir(katalog, { recursive: true });
        const d = teraz();
        const stempel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
        let baza = `${stempel} ${nazwaPliku(meta.nazwa)}`;
        for (let i = 2; fsSync.existsSync(path.join(katalog, `${baza}.mp3`)); i++) baza = `${stempel} ${nazwaPliku(meta.nazwa)} ${i}`;
        const roz = /wav/.test(typAudio) ? 'wav' : /ogg/.test(typAudio) ? 'ogg' : /mp4/.test(typAudio) ? 'm4a' : 'webm';
        const surowe = path.join(katalog, `.${baza}.surowe.${roz}`);
        const mp3 = path.join(katalog, `${baza}.mp3`);
        await fs.writeFile(surowe, a);
        try { await ffmpegNaMp3(ffmpeg, surowe, mp3); } finally { await fs.rm(surowe, { force: true }).catch(() => {}); }
        const plikMid = path.join(katalog, `${baza}.mid`);
        await fs.writeFile(plikMid, m);
        const karta = {
            nazwa: nazwaPliku(meta.nazwa),
            kiedy: d.toISOString(),
            bpm: Math.max(30, Math.min(300, Math.round(Number(meta.bpm) || 120))),
            tonacja: String(meta.tonacja ?? '').slice(0, 20) || null,
            fraz: Math.max(0, Math.round(Number(meta.fraz) || 0)),
            sekundy: Math.max(0, Math.round((Number(meta.sekundy) || 0) * 10) / 10),
            strategie: (Array.isArray(meta.strategie) ? meta.strategie : []).filter((s) => STRATEGIE.includes(s)).slice(0, 200),
            urzadzenie: String(meta.urzadzenie ?? '').slice(0, 80) || null,
            // 🥁 zestaw padów, który grał (services/PadyJamu.js) — Aranż i Warsztat mają ten sam kontekst
            zestawPadow: /^[a-z0-9][a-z0-9-]{0,39}$/.test(String(meta.zestawPadow ?? '')) ? String(meta.zestawPadow) : null,
            audio: rel(mp3), midi: rel(plikMid),
        };
        await fs.writeFile(path.join(katalog, `${baza}.json`), JSON.stringify(karta, null, 2), 'utf8');
        void szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `🎹 Jam z Joanną zapisany: ${baza}.mp3 (${karta.bpm} BPM${karta.tonacja ? `, ${karta.tonacja}` : ''})` })?.catch?.(() => {});
        return { ...karta, url: url(karta.audio), urlMidi: url(karta.midi) };
    }

    async function lista() {
        const pliki = await fs.readdir(katalog).catch(() => []);
        const out = [];
        for (const f of pliki.filter((x) => x.endsWith('.json'))) {
            try {
                const k = JSON.parse(await fs.readFile(path.join(katalog, f), 'utf8'));
                if (!k.audio || !fsSync.existsSync(path.join(katalogMuzyki, k.audio))) continue;
                out.push({ ...k, url: url(k.audio), urlMidi: k.midi ? url(k.midi) : null });
            } catch { /* zła karta — pomijamy */ }
        }
        return out.sort((a, b) => String(b.kiedy).localeCompare(String(a.kiedy))).slice(0, 100);
    }

    return { strategia, zapisz, lista, katalog };
}

export function zamontujTrasyJamu(app, jam) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    app.get('/api/jam', (_req, res) => odp(res, jam.lista().then((jamy) => ({ jamy, katalog: KATALOG, strategie: STRATEGIE })), 500));
    app.post('/api/jam/strategia', (req, res) => odp(res, jam.strategia(req.body ?? {}), 502));
    app.post('/api/jam/nagranie', (req, res) => odp(res, jam.zapisz(req.body ?? {}).then((jam) => ({ jam }))));
    return jam;
}

export default { utworzJam, zamontujTrasyJamu, odczytajStrategie, promptStrategii, nazwaPliku, STRATEGIE, KATALOG };
