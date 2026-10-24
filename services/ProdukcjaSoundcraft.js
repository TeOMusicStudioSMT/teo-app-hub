/**
 * 🎚️ Produkcja aranżu Joanny w SoundCraft (Suweren 2026-10-24: „zobacz czy to repo… może rozwinąć nasze… produkcyjne…
 * byśmy z Joanną mogli tworzyć niesamowite utwory”) — github.com/storytold/soundcraft (MIT/Apache-2.0, DAW w Rust).
 *
 * Używamy WYŁĄCZNIE `soundcraft-cli` bez okna (`script` = jedna komenda `ID JSON` na linię, `--bounce`, `--save`):
 *  1. aranż .mid (z demo) → perkusja rozdzielona: każda nuta GM, której pad zestawu jamu ma próbkę, idzie na własną
 *     ścieżkę samplera (`rozdzielPerkusje` — sampler gra jedną próbkę na ścieżkę), reszta zostaje na drum_synth;
 *  2. brzmienia instrumentów planu (`BRZMIENIA`, zamknięta lista → parametry wbudowanego syntezatora);
 *  3. MIKS z zamkniętej listy (`MIKSY`: pogłos na busie + sendy, kompresja, EQ, suma) — wybiera model Joanny (JSON,
 *     tylko id z listy) albo Suweren; zły wybór / brak modelu = `miksZPlanu` (kod);
 *  4. dwa przebiegi bounce: pomiar zintegrowanej głośności → wzmocnienie przed maximizerem (sufit −1 dBTP) → −14 LUFS;
 *  5. mp3 do biblioteki, stemy (WAV) obok, sesja `.scraft` do ręcznej obróbki w oknie SoundCraft.
 * Model niczego nie gra i nie rysuje — kod składa sesję deterministycznie (`skryptProdukcji`, czysty, testowany).
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';

export const CEL_LUFS = -14;
// maximizer pilnuje szczytu PRÓBEK, true peak (między próbkami) wychodzi ~0,2–0,5 dB wyżej — sufit −1,5 trzyma TP ≤ −1
export const SUFIT_DBTP = -1.5;

/** Pad (0–15) z nuty GM perkusji aranżu — ta sama mapa co render demo w Music Studio (`src/jam/render.ts`). */
export const PAD_Z_GM = { 36: 0, 38: 1, 42: 2, 46: 3, 39: 4, 45: 5, 50: 6, 37: 7, 49: 3 };

/** Brzmienia instrumentów planu (bliźniak `INSTRUMENTY` z `services/AranzJoanny.js`) → wbudowany instrument SoundCraft. */
export const BRZMIENIA = {
    fortepian: { plugin: 'subtractive_synth', params: { osc1_wave: 3, osc2_wave: 2, osc2_semitones: 12, osc_mix: 30, cutoff: 5000, amp_attack: 3, amp_decay: 600, amp_sustain: 25, amp_release: 400, level: -8 } },
    syntezator: { plugin: 'subtractive_synth', params: { osc1_wave: 0, osc2_wave: 1, osc2_detune: 9, cutoff: 4200, resonance: 25, filter_env_amount: 40, amp_attack: 5, amp_sustain: 70, amp_release: 250, level: -10 } },
    dzwonki: { plugin: 'subtractive_synth', params: { osc1_wave: 3, osc2_wave: 2, osc2_semitones: 24, osc_mix: 45, cutoff: 9000, amp_attack: 1, amp_decay: 900, amp_sustain: 10, amp_release: 900, level: -10 } },
    flet: { plugin: 'subtractive_synth', params: { osc1_wave: 2, osc2_wave: 3, osc_mix: 20, cutoff: 3000, amp_attack: 60, amp_sustain: 85, amp_release: 250, glide: 30, level: -9 } },
    organy: { plugin: 'subtractive_synth', params: { osc1_wave: 1, osc2_wave: 2, osc2_semitones: 12, osc_mix: 50, cutoff: 2600, amp_attack: 10, amp_sustain: 100, amp_release: 120, level: -16 } },
    smyczki: { plugin: 'subtractive_synth', params: { osc1_wave: 0, osc2_wave: 0, osc2_detune: 14, cutoff: 1800, amp_attack: 280, amp_sustain: 85, amp_release: 900, level: -16 } },
    pad: { plugin: 'subtractive_synth', params: { osc1_wave: 0, osc2_wave: 3, osc2_detune: 18, cutoff: 1300, amp_attack: 450, amp_sustain: 90, amp_release: 1500, level: -17 } },
    gitara: { plugin: 'subtractive_synth', params: { osc1_wave: 0, osc2_wave: 1, osc2_detune: 5, cutoff: 2400, filter_env_amount: 55, filter_decay: 180, amp_attack: 2, amp_decay: 450, amp_sustain: 15, amp_release: 200, level: -14 } },
    chor: { plugin: 'subtractive_synth', params: { osc1_wave: 3, osc2_wave: 0, osc2_detune: 20, osc_mix: 35, cutoff: 1600, amp_attack: 350, amp_sustain: 85, amp_release: 1200, level: -17 } },
    'bas-syntetyczny': { plugin: 'subtractive_synth', params: { osc1_wave: 0, osc2_wave: 2, osc2_semitones: -12, osc_mix: 40, cutoff: 650, resonance: 30, filter_env_amount: 35, amp_sustain: 80, amp_release: 120, level: -8 } },
    'bas-elektryczny': { plugin: 'subtractive_synth', params: { osc1_wave: 2, osc2_wave: 3, osc_mix: 30, cutoff: 900, amp_attack: 3, amp_decay: 700, amp_sustain: 55, amp_release: 150, level: -8 } },
    'perkusja-elektroniczna': { plugin: 'drum_synth', params: { kick_decay: 380, kick_tune: -2, snare_snappy: 70, snare_decay: 180, hat_decay: 60, level: -6 } },
    'perkusja-akustyczna': { plugin: 'drum_synth', params: { kick_decay: 550, snare_snappy: 45, snare_decay: 260, hat_decay: 110, tom_decay: 600, cymbal_decay: 2600, level: -6 } },
};
/** Rola ścieżki .mid aranżu (nazwy z `src/jam/aranz.ts`) → domyślne brzmienie, gdy plan nie wskazał instrumentu tej roli. */
export const SCIEZKI = { 'Melodia (motyw Suwerena)': 'melodia', Akordy: 'akordy', Bas: 'bas', Perkusja: 'perkusja' };
const ROLA_INSTRUMENTU = {
    fortepian: 'melodia', syntezator: 'melodia', dzwonki: 'melodia', flet: 'melodia',
    organy: 'akordy', smyczki: 'akordy', pad: 'akordy', gitara: 'akordy', chor: 'akordy',
    'bas-syntetyczny': 'bas', 'bas-elektryczny': 'bas', 'perkusja-elektroniczna': 'perkusja', 'perkusja-akustyczna': 'perkusja',
};
const DOMYSLNE = { melodia: 'syntezator', akordy: 'pad', bas: 'bas-syntetyczny', perkusja: 'perkusja-elektroniczna' };

/** Miksy (zamknięta lista): pogłos na busie, sendy ról w dB (null = bez), kompresja ról, EQ, klej na sumie. */
export const MIKSY = {
    czysty: { nazwa: 'Czysty', opis: 'krótki pokój, mało pogłosu, przejrzyście', poglos: { plugin: 'room_reverb', params: { mix: 100, decay: 0.9, size: 35, pre_delay: 10 } }, sendy: { melodia: -16, akordy: -14, bas: null, perkusja: -24 }, kompresja: { bas: { threshold: -20, ratio: 3 }, perkusja: { threshold: -18, ratio: 2.5, attack: 20 } }, suma: { threshold: -12, ratio: 1.5 } },
    cieply: { nazwa: 'Ciepły', opis: 'płyta, łagodne nasycenie, okrągły bas', poglos: { plugin: 'plate_reverb', params: { mix: 100, decay: 2.2, pre_delay: 25, damping: 6000 } }, sendy: { melodia: -10, akordy: -8, bas: null, perkusja: -20 }, kompresja: { bas: { threshold: -18, ratio: 4 }, perkusja: { threshold: -16, ratio: 3, attack: 25 } }, nasycenie: { akordy: { drive: 4, tone: 9000, mix: 60 } }, suma: { threshold: -14, ratio: 2 } },
    klubowy: { nazwa: 'Klubowy', opis: 'mocny dół, ściśnięta perkusja, krótki pogłos', poglos: { plugin: 'room_reverb', params: { mix: 100, decay: 1.4, size: 55, pre_delay: 15 } }, sendy: { melodia: -14, akordy: -12, bas: null, perkusja: -26 }, kompresja: { bas: { threshold: -22, ratio: 5, attack: 5 }, perkusja: { threshold: -20, ratio: 4, attack: 10 } }, eq: { perkusja: { low_shelf_gain: 3, low_shelf_freq: 70 }, bas: { low_shelf_gain: 2, low_shelf_freq: 60 } }, suma: { threshold: -16, ratio: 2.5 } },
    kosmiczny: { nazwa: 'Kosmiczny', opis: 'długi pogłos, echo na melodii, szeroko', poglos: { plugin: 'plate_reverb', params: { mix: 100, decay: 5.5, pre_delay: 60, damping: 8000 } }, sendy: { melodia: -6, akordy: -4, bas: -24, perkusja: -16 }, kompresja: { bas: { threshold: -18, ratio: 3 } }, echo: { melodia: { time: 375, feedback: 35, mix: 25 } }, suma: { threshold: -12, ratio: 1.5 } },
    kameralny: { nazwa: 'Kameralny', opis: 'cicho, naturalnie, bez ściskania', poglos: { plugin: 'room_reverb', params: { mix: 100, decay: 1.6, size: 45, pre_delay: 20, damping: 7000 } }, sendy: { melodia: -12, akordy: -10, bas: null, perkusja: -18 }, kompresja: {}, suma: { threshold: -10, ratio: 1.3 } },
};

/** Miks bez modelu — z faktów planu: Drop/refren głośno = klubowy, ciche = kameralny, długie pady = kosmiczny. */
export function miksZPlanu(plan) {
    const s = Array.isArray(plan?.sekcje) ? plan.sekcje : [];
    const takty = s.reduce((a, x) => a + (Number(x.takty) || 0), 0) || 1;
    const energia = s.reduce((a, x) => a + (Number(x.energia) || 0) * (Number(x.takty) || 0), 0) / takty;
    if (s.some((x) => x.typ === 'drop') && energia >= 0.6) return 'klubowy';
    if (energia < 0.45) return 'kameralny';
    if (s.some((x) => (x.instrumenty ?? []).some((i) => ['pad', 'chor'].includes(i)))) return 'kosmiczny';
    return 'cieply';
}

// ── SMF: minimalny odczyt i zapis (format 1) do rozdzielenia perkusji ──────────────
const vlq = (n) => { let v = Math.max(0, Math.floor(n)); const b = [v & 0x7f]; while ((v >>= 7)) b.unshift((v & 0x7f) | 0x80); return b; };

/** SMF → {ppq, sciezki: [{nazwa, zdarzenia: [{tick, bajty}]}]} (running status obsłużony). */
export function czytajSmf(buf) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (b.toString('latin1', 0, 4) !== 'MThd') throw new Error('To nie jest plik MIDI (brak MThd).');
    const ppq = b.readUInt16BE(12);
    let i = 8 + b.readUInt32BE(4);
    const sciezki = [];
    while (i + 8 <= b.length) {
        if (b.toString('latin1', i, i + 4) !== 'MTrk') throw new Error('Uszkodzona ścieżka MIDI.');
        const kon = i + 8 + b.readUInt32BE(i + 4);
        let p = i + 8, t = 0, st = 0, nazwa = '';
        const zdarzenia = [];
        const v = () => { let x = 0, c; do { c = b[p++]; x = (x << 7) | (c & 0x7f); } while (c & 0x80 && p < kon); return x; };
        while (p < kon) {
            t += v();
            let s = b[p];
            if (s & 0x80) p++; else s = st;
            if (s === 0xff) {
                const typ = b[p++], dl = v();
                const dane = [...b.subarray(p, p + dl)];
                p += dl;
                if (typ === 0x2f) break;
                if (typ === 0x03) nazwa = Buffer.from(dane).toString('utf8');
                zdarzenia.push({ tick: t, bajty: [0xff, typ, ...vlq(dl), ...dane] });
            } else if (s === 0xf0 || s === 0xf7) {
                const dl = v(); p += dl;
            } else {
                st = s;
                const n = (s & 0xf0) === 0xc0 || (s & 0xf0) === 0xd0 ? 1 : 2;
                zdarzenia.push({ tick: t, bajty: [s, ...b.subarray(p, p + n)] });
                p += n;
            }
        }
        sciezki.push({ nazwa, zdarzenia });
        i = kon;
    }
    return { ppq, sciezki };
}

export function zapiszSmf({ ppq, sciezki }) {
    const kawalek = (typ, dane) => { const h = Buffer.alloc(8); h.write(typ, 0, 'latin1'); h.writeUInt32BE(dane.length, 4); return Buffer.concat([h, Buffer.from(dane)]); };
    const mthd = kawalek('MThd', [0, 1, (sciezki.length >> 8) & 255, sciezki.length & 255, (ppq >> 8) & 255, ppq & 255]);
    const trk = sciezki.map((s) => {
        const z = [...s.zdarzenia].sort((a, c) => a.tick - c.tick);
        const out = [];
        let t = 0;
        for (const e of z) { out.push(...vlq(e.tick - t), ...e.bajty); t = e.tick; }
        out.push(0, 0xff, 0x2f, 0);
        return kawalek('MTrk', out);
    });
    return Buffer.concat([mthd, ...trk]);
}
const meta03 = (tekst) => { const d = [...Buffer.from(tekst, 'utf8')]; return [0xff, 0x03, ...vlq(d.length), ...d]; };

/**
 * Nuty perkusji (kanał 10) z `nuty` wyjęte ze ścieżki „Perkusja” na osobne ścieżki „Pad <n>”
 * (n = numer padu 1–16). Zwraca nowy plik i listę {nazwa, nuta, pad}.
 */
export function rozdzielPerkusje(buf, nutyPadow) {
    const smf = czytajSmf(buf);
    const mapa = new Map(Object.entries(nutyPadow).map(([nuta, pad]) => [Number(nuta), pad]));
    const nowe = new Map();
    for (const s of smf.sciezki) {
        if (s.nazwa !== 'Perkusja') continue;
        s.zdarzenia = s.zdarzenia.filter((e) => {
            const [st, nuta] = e.bajty;
            const typ = st & 0xf0;
            if ((st & 0x0f) !== 9 || (typ !== 0x90 && typ !== 0x80) || !mapa.has(nuta)) return true;
            const pad = mapa.get(nuta);
            if (!nowe.has(pad)) nowe.set(pad, { nazwa: `Pad ${pad + 1}`, nuty: new Set(), zdarzenia: [{ tick: 0, bajty: meta03(`Pad ${pad + 1}`) }] });
            const n = nowe.get(pad);
            n.nuty.add(nuta);
            // ten sam pad gra jedną próbką: każda nuta padu → wysokość próbki (C4 = 60, bez transpozycji)
            n.zdarzenia.push({ tick: e.tick, bajty: [st, 60, e.bajty[2]] });
            return false;
        });
    }
    const pady = [...nowe.entries()].sort((a, c) => a[0] - c[0]);
    for (const [, n] of pady) smf.sciezki.push({ nazwa: n.nazwa, zdarzenia: n.zdarzenia });
    return { mid: zapiszSmf(smf), pady: pady.map(([pad, n]) => ({ pad, nazwa: n.nazwa, nuty: [...n.nuty] })) };
}

/** Instrument roli w planie: najczęściej wskazany instrument tej roli (wagą taktów), inaczej domyślny. */
export function brzmienieRoli(plan, rola) {
    const licz = new Map();
    for (const s of plan?.sekcje ?? []) for (const i of s.instrumenty ?? []) if (ROLA_INSTRUMENTU[i] === rola) licz.set(i, (licz.get(i) ?? 0) + (Number(s.takty) || 0));
    return [...licz.entries()].sort((a, c) => c[1] - a[1])[0]?.[0] ?? DOMYSLNE[rola];
}

/**
 * Skrypt `soundcraft-cli script` (jedna komenda na linię). Czysty: te same wejścia = ten sam skrypt.
 * `sciezki` = nazwy ścieżek .mid (z rozdzielenia), `probki` = [{nazwa, plik, transpose}], `wzmocnienie` = dB przed maximizerem.
 */
export function skryptProdukcji({ mid, plan, miks, sciezki, probki = [], wzmocnienie = 0 }) {
    const M = MIKSY[miks];
    if (!M) throw new Error(`Nieznany miks „${miks}” (znane: ${Object.keys(MIKSY).join(', ')}).`);
    const linie = [];
    const k = (id, p) => linie.push(`${id} ${JSON.stringify(p)}`);
    k('file.import_midi', { path: mid });
    const role = [];
    for (const nazwa of sciezki) {
        const rola = SCIEZKI[nazwa];
        if (!rola) continue;
        const b = BRZMIENIA[brzmienieRoli(plan, rola)];
        k('mix.instrument', { track: nazwa, plugin: b.plugin, params: b.params });
        role.push([nazwa, rola]);
    }
    for (const p of probki) k('mix.sampler_load', { track: p.nazwa, path: p.plik, params: { root_note: 60, key_low: 60, key_high: 60, key_track: 0, play_mode: 1, transpose: p.transpose ?? 0, attack: 0.5, release: 60, velocity: 80, level: -6 } });
    // pogłos: bus + aux z pogłosem na 100 % mokro, sendy ról
    k('mix.new_bus', { name: 'Pogłos' });
    k('track.new', { kind: 'aux', name: 'Pogłos AUX' });
    k('track.input', { tracks: ['Pogłos AUX'], input: 'Pogłos' });
    k('mix.insert', { track: 'Pogłos AUX', plugin: M.poglos.plugin, params: M.poglos.params });
    for (const [nazwa, rola] of [...role, ...probki.map((p) => [p.nazwa, 'perkusja'])]) {
        const poziom = M.sendy[rola];
        if (poziom != null) k('mix.send', { track: nazwa, bus: 'Pogłos', level_db: poziom });
        const wkladki = [];
        if (rola !== 'bas' && rola !== 'perkusja') wkladki.push(['eq_7band', { hpf_on: 1, hpf_freq: rola === 'melodia' ? 180 : 140 }]);
        if (M.eq?.[rola]) wkladki.push(['eq_7band', M.eq[rola]]);
        if (M.kompresja?.[rola]) wkladki.push(['compressor', M.kompresja[rola]]);
        if (M.nasycenie?.[rola]) wkladki.push(['saturator', M.nasycenie[rola]]);
        if (M.echo?.[rola]) wkladki.push(['mod_delay', M.echo[rola]]);
        for (const [plugin, params] of wkladki) k('mix.insert', { track: nazwa, plugin, params });
    }
    // suma: klej → wzmocnienie (z pomiaru LUFS) → maximizer z sufitem −1 dBTP
    k('track.new', { kind: 'master', name: 'Suma' });
    k('mix.insert', { track: 'Suma', plugin: 'compressor', params: { ...M.suma, attack: 30, release: 200 } });
    k('mix.insert', { track: 'Suma', plugin: 'gain', params: { gain: Math.round(Math.max(-24, Math.min(24, wzmocnienie)) * 100) / 100 } });
    k('mix.insert', { track: 'Suma', plugin: 'maximizer', params: { threshold: 0, ceiling: SUFIT_DBTP, release: 60 } });
    return linie.join('\n') + '\n';
}

/** Wzmocnienie do celu z pomiaru (ograniczone, bez cudów przy ciszy). */
export const wzmocnienieDoCelu = (lufs, cel = CEL_LUFS) => (Number.isFinite(lufs) ? Math.round(Math.max(-12, Math.min(24, cel - lufs)) * 100) / 100 : 0);

/** Odpowiedź modelu o miksie → id z listy (bez ogonków, spoza listy = null). */
export function odczytajMiks(tekst) {
    const m = String(tekst ?? '').match(/\{[\s\S]*\}/);
    try {
        const o = JSON.parse(m ? m[0] : '');
        const id = String(o?.miks ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').trim();
        return MIKSY[id] ? { miks: id, komentarz: String(o?.komentarz ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) } : null;
    } catch { return null; }
}

const wykonaj = (plik, args, opcje = {}) => new Promise((ok, zle) => execFile(plik, args, { windowsHide: true, timeout: 10 * 60_000, maxBuffer: 64 * 1024 * 1024, ...opcje }, (e, out, err) => (e ? zle(new Error(String(err || e.message).trim().split('\n').slice(-3).join(' | ').slice(0, 500))) : ok({ out: String(out), err: String(err) }))));

/** soundcraft-cli: `OTAKOS_SOUNDCRAFT` (plik albo katalog) → najnowszy w `_OtakOs_AI/soundcraft/<wersja>/…`. */
export function znajdzCli(katalogAI, env = process.env) {
    const szukaj = (k, gl = 0) => {
        if (!fsSync.existsSync(k)) return [];
        const out = [];
        for (const d of fsSync.readdirSync(k, { withFileTypes: true })) {
            const p = path.join(k, d.name);
            if (d.isFile() && /^soundcraft-cli(\.exe)?$/i.test(d.name)) out.push(p);
            else if (d.isDirectory() && gl < 3 && d.name !== 'pobrane') out.push(...szukaj(p, gl + 1));
        }
        return out;
    };
    const wlasny = env.OTAKOS_SOUNDCRAFT;
    if (wlasny) {
        if (fsSync.existsSync(wlasny) && fsSync.statSync(wlasny).isFile()) return wlasny;
        const w = szukaj(wlasny)[0];
        if (w) return w;
    }
    const kand = szukaj(path.join(katalogAI, 'soundcraft'));
    const wersja = (p) => (p.match(/(\d+)\.(\d+)\.(\d+)/) ?? [0, 0, 0, 0]).slice(1).map(Number);
    return kand.sort((a, c) => { const x = wersja(a), y = wersja(c); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]; })[0] ?? null;
}

/**
 * @param {{ katalogMuzyki: string, katalog: string, katalogAI: string, ffmpeg: string,
 *   pisz?: (z: {system: string, prompt: string}) => Promise<{tekst: string, model?: string}>, uruchom?: typeof wykonaj, env?: object }} cfg
 */
export function utworzProdukcje({ katalogMuzyki, katalog, katalogAI, ffmpeg, pisz = null, uruchom = wykonaj, env = process.env }) {
    let trwa = null;
    const cli = () => znajdzCli(katalogAI, env);

    async function stan() {
        const c = cli();
        if (!c) return { dostepny: false, powod: 'Nie ma SoundCraft w Katedrze — rozpakuj soundcraft-<wersja>-windows-x64-portable.zip (github.com/storytold/soundcraft/releases) do _OtakOs_AI/soundcraft/<wersja>/ albo wskaż OTAKOS_SOUNDCRAFT.', miksy: MIKSY };
        let wersja = null;
        try { wersja = (await uruchom(c, ['--version'], { env: { ...env, SOUNDCRAFT_NO_PREFS: '1' } })).out.trim(); } catch (e) { return { dostepny: false, sciezka: c, powod: `soundcraft-cli nie odpowiada: ${e.message}`, miksy: MIKSY }; }
        return { dostepny: true, sciezka: c, wersja, okno: fsSync.existsSync(path.join(path.dirname(c), 'soundcraft.exe')), trwa, miksy: MIKSY };
    }

    /** Wybór miksu: Suweren → model Joanny (lista) → plan. */
    async function wybierz(plan, { miks, uwagi }) {
        if (miks && miks !== 'joanna') {
            if (!MIKSY[miks]) throw new Error(`Nieznany miks „${miks}”.`);
            return { miks, zrodlo: 'suweren', komentarz: '' };
        }
        if (pisz) {
            const system = `Jesteś Joanna — TeOgochi muzyki Katedry OtakOS. Wybierasz MIKS gotowego aranżu z listy (nic poza nią):\n${Object.entries(MIKSY).map(([id, m]) => `- ${id}: ${m.opis}`).join('\n')}\nOdpowiadasz WYŁĄCZNIE JSON: {"miks":"<id>","komentarz":"<jedno zdanie po polsku: dlaczego>"}`;
            const prompt = `UTWÓR: „${plan.tytul}” — ${plan.styl || ''}. Tagi: ${plan.tagi}.\nSEKCJE: ${(plan.sekcje ?? []).map((s) => `${s.typ} ${s.takty} t. energia ${s.energia} (${(s.instrumenty ?? []).join(', ')})`).join('; ')}\n${uwagi ? `UWAGI SUWERENA: ${String(uwagi).slice(0, 400)}\n` : ''}JSON:`;
            try {
                const w = await pisz({ system, prompt });
                const o = odczytajMiks(w.tekst);
                if (o) return { ...o, zrodlo: 'model', model: w.model ?? null };
                return { miks: miksZPlanu(plan), zrodlo: 'plan', komentarz: '', uwaga: 'Model Joanny podał miks spoza listy — miks dobrał kod z planu.' };
            } catch (e) { return { miks: miksZPlanu(plan), zrodlo: 'plan', komentarz: '', uwaga: `Model Joanny nie odpowiedział (${e.message}) — miks dobrał kod z planu.` }; }
        }
        return { miks: miksZPlanu(plan), zrodlo: 'plan', komentarz: '' };
    }

    /** Próbka padu → wav gotowy dla samplera: przycięcie od–do, głośność, normalizacja szczytu (≤ +18 dB). */
    async function przygotujProbke(zrodlo, pad, cel) {
        const filtry = [];
        if (pad.od > 0 || pad.do != null) filtry.push(`atrim=start=${pad.od || 0}${pad.do != null ? `:end=${pad.do}` : ''}`, 'asetpts=PTS-STARTPTS');
        let zysk = 20 * Math.log10(Math.max(0.01, Number(pad.glosnosc) || 1));
        if (pad.normalizacja) {
            const { err } = await uruchom(ffmpeg, ['-hide_banner', '-i', zrodlo, '-af', [...filtry, 'volumedetect'].join(','), '-f', 'null', '-']);
            const m = String(err).match(/max_volume:\s*(-?[\d.]+) dB/);
            if (m) zysk += Math.min(18, -0.9 - Number(m[1]));
        }
        filtry.push(`volume=${zysk.toFixed(2)}dB`);
        await uruchom(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', zrodlo, '-af', filtry.join(','), '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', cel]);
        return cel;
    }

    /**
     * Produkcja aranżu. `a` = rekord AranzJoanny (plan, demo, analiza, id), `zestaw` = {katalog, pady} zestawu padów jamu albo null.
     * Zwraca opis produkcji (pliki względem biblioteki).
     */
    async function produkuj(a, { miks, uwagi, zestaw = null, baza } = {}) {
        if (trwa) throw new Error(`Trwa już produkcja „${trwa}” — jedna naraz.`);
        const c = cli();
        if (!c) throw new Error((await stan()).powod);
        if (!a?.demo?.mid) throw new Error('Najpierw demo aranżu (▶ demo) — produkcja bierze jego plik .mid.');
        trwa = a.plan.tytul;
        const t0 = Date.now();
        try {
            const praca = path.join(katalog, 'soundcraft', a.id);
            await fs.rm(praca, { recursive: true, force: true });
            await fs.mkdir(praca, { recursive: true });
            const wybor = await wybierz(a.plan, { miks, uwagi });
            // perkusja z próbek zestawu padów jamu
            const nutyPadow = {};
            const probki = [];
            for (const [gm, pad] of Object.entries(PAD_Z_GM)) {
                const p = zestaw?.pady?.[pad];
                if (p?.plik && fsSync.existsSync(path.join(zestaw.katalog, p.plik))) nutyPadow[gm] = pad;
            }
            const { mid, pady } = rozdzielPerkusje(await fs.readFile(path.join(katalogMuzyki, a.demo.mid)), nutyPadow);
            const plikMid = path.join(praca, 'aranz.mid');
            await fs.writeFile(plikMid, mid);
            for (const p of pady) {
                const ust = zestaw.pady[p.pad];
                const cel = path.join(praca, `pad-${p.pad + 1}.wav`);
                await przygotujProbke(path.join(zestaw.katalog, ust.plik), ust, cel);
                probki.push({ nazwa: p.nazwa, plik: cel, transpose: ust.stroj ?? 0 });
            }
            const sciezki = czytajSmf(mid).sciezki.map((s) => s.nazwa).filter(Boolean);
            const fwd = (p) => p.split(path.sep).join('/');
            const env2 = { ...env, SOUNDCRAFT_NO_PREFS: '1' };
            const przebieg = async (wzm, nazwa, zapis) => {
                const skrypt = path.join(praca, `${nazwa}.txt`);
                await fs.writeFile(skrypt, skryptProdukcji({ mid: fwd(plikMid), plan: a.plan, miks: wybor.miks, sciezki, probki: probki.map((p) => ({ ...p, plik: fwd(p.plik) })), wzmocnienie: wzm }));
                const wav = path.join(praca, `${nazwa}.wav`);
                const { out } = await uruchom(c, ['script', skrypt, '--bounce', wav, ...(zapis ? ['--save', zapis] : [])], { env: env2, cwd: praca }).catch((e) => { throw new Error(`SoundCraft: ${e.message}`); });
                const linia = out.split('\n').map((l) => l.trim()).find((l) => l.startsWith('{') && l.includes('"lufs"'));
                if (!linia) throw new Error(`SoundCraft nie oddał pomiaru bounce: ${out.slice(-300)}`);
                return { wav, ...JSON.parse(linia) };
            };
            const pomiar = await przebieg(0, 'pomiar', null);
            const wzm = wzmocnienieDoCelu(pomiar.lufs);
            const sesja = path.join(praca, 'aranz.scraft');
            const wynik = await przebieg(wzm, 'produkcja', sesja);
            // stemy: każda ścieżka osobno z zapisanej sesji
            const katStemow = path.join(katalogMuzyki, 'Aranże Joanny', `${baza} — stemy`);
            await fs.rm(katStemow, { recursive: true, force: true });
            await fs.mkdir(katStemow, { recursive: true });
            await uruchom(c, ['run', '--in', sesja, '--cmd', `file.bounce_stems=${JSON.stringify({ dir: fwd(katStemow), format: 'wav', bit_depth: '24' })}`], { env: env2, cwd: praca });
            const stemy = (await fs.readdir(katStemow)).filter((f) => /\.wav$/i.test(f)).sort();
            const mp3 = path.join(katalogMuzyki, 'Aranże Joanny', `${baza} (produkcja).mp3`);
            await uruchom(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wynik.wav, '-c:a', 'libmp3lame', '-b:a', '256k', mp3]);
            await fs.rm(path.join(praca, 'pomiar.wav'), { force: true });
            const rel = (p) => path.relative(katalogMuzyki, p).split(path.sep).join('/');
            return {
                plik: rel(mp3), wav: wynik.wav, sesja, stemy: stemy.map((f) => rel(path.join(katStemow, f))),
                lufs: Math.round(wynik.lufs * 10) / 10, truePeak: Math.round(wynik.true_peak_db * 10) / 10, peak: Math.round(wynik.peak_db * 10) / 10,
                sekundy: Math.round(wynik.seconds * 10) / 10, lufsPrzed: Math.round(pomiar.lufs * 10) / 10, wzmocnienie: wzm,
                miks: wybor.miks, miksZrodlo: wybor.zrodlo, komentarz: wybor.komentarz, uwaga: wybor.uwaga ?? null, model: wybor.model ?? null,
                probki: pady.map((p) => ({ pad: p.pad + 1, nuty: p.nuty })),
                soundcraft: (await stan()).wersja, sekundyLiczenia: Math.round((Date.now() - t0) / 100) / 10, kiedy: new Date().toISOString(),
            };
        } finally { trwa = null; }
    }

    /** Sesja w oknie SoundCraft (Suweren dokręca miks ręcznie). */
    async function otworz(sesja) {
        const c = cli();
        const okno = c && path.join(path.dirname(c), 'soundcraft.exe');
        if (!okno || !fsSync.existsSync(okno)) throw new Error('Nie ma okna SoundCraft (soundcraft.exe) obok CLI.');
        if (!fsSync.existsSync(sesja)) throw new Error('Nie ma zapisanej sesji tego aranżu — najpierw produkcja.');
        const p = spawn(okno, [sesja], { detached: true, stdio: 'ignore', windowsHide: false });
        p.unref();
        return { otwarte: true };
    }

    return { stan, produkuj, otworz, cli };
}

export default { utworzProdukcje, skryptProdukcji, rozdzielPerkusje, czytajSmf, zapiszSmf, miksZPlanu, odczytajMiks, brzmienieRoli, wzmocnienieDoCelu, znajdzCli, MIKSY, BRZMIENIA, PAD_Z_GM };
