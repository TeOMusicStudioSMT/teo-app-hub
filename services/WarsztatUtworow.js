/**
 * 🔧🎵 WARSZTAT UTWORÓW — przedłużanie, remiks, cover ISTNIEJĄCEGO utworu (2026-09-12).
 *
 * Suweren: „Joanna utworzyła utwór 0:53 — a jakbym chciał, by go przedłużyła?
 * Przydałaby się osobna sekcja do przedłużania, remiksowania, coverowania".
 *
 * Wszystko na ACE-Step 1.5 w ComfyUI, na WĘZŁACH Z RDZENIA (bez cudzych
 * dodatków), z tych samych wag, które ma workflow acestep15.json:
 *
 *   PRZEDŁUŻ  — KONTYNUACJA: nowy fragment N s liczony z ReferenceTimbreAudio
 *               (latent oryginału = barwa) i tymi samymi tagami; most zszywa
 *               oryginał + fragment ffmpeg-iem (acrossfade 2 s). Efekt: ta sama
 *               barwa i styl, dalszy ciąg — NIE dosłowna kontynuacja frazy.
 *   REMIKS    — ten sam utwór przepuszczony przez model z NOWYMI tagami przy
 *               denoise < 1 (`sila`): struktura zostaje, faktura się zmienia.
 *               Zmierzone: denoise 0,5 → korelacja obwiedni z oryginałem 0,78.
 *   COVER     — nowa aranżacja o tej samej długości, z barwą oryginału
 *               (ReferenceTimbreAudio) i nowymi tagami/tekstem, denoise 1.
 *
 * ⚠️ DLACZEGO NIE „REPAINT W MIEJSCU". Latent audio ACE 1.5 jest jednowymiarowy
 * (25 klatek/s), a SetLatentNoiseMask z rdzenia umie tylko maski 2D — sprawdzone:
 * „Input and output must have the same number of spatial dimensions". Więc
 * przedłużenie to kontynuacja + zszycie, i tak to nazywamy.
 *
 * Wyniki lądują w `_OtakOs_Muzyka/_Przerobki/` — Graviton Radio i reszta
 * Katedry je widzą jak każdy utwór.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

let cfg = null;
const zadania = new Map();
const MAX = 30;

export const TRYBY = {
    przedluz: { nazwa: 'Przedłuż', opis: 'kontynuacja w tej samej barwie, zszyta crossfade 2 s' },
    remiks:   { nazwa: 'Remiks',   opis: 'ten sam utwór z nowymi tagami; siła = ile zmienić' },
    cover:    { nazwa: 'Cover',    opis: 'nowa aranżacja o tej samej długości, barwa z oryginału' },
};

export function skonfiguruj(c) { cfg = c; }

const id8 = () => crypto.randomBytes(4).toString('hex');
const teraz = () => new Date().toISOString();
const slug = (s) => String(s || '').toLowerCase().replace(/\.(mp3|wav|flac|ogg)$/i, '').replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'utwor';
const spij = (ms) => new Promise((r) => setTimeout(r, ms));

function sprzatnij() { while (zadania.size > MAX) zadania.delete(zadania.keys().next().value); }
export function stanZadania(id) { return zadania.get(id) ?? null; }
export function listaZadan() { return [...zadania.values()].reverse(); }

async function dlugoscSekund(plik) {
    const { stdout } = await cfg.execFile(cfg.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', plik], { windowsHide: true });
    const d = Number(String(stdout).trim());
    if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe nie odczytał długości: ${plik}`);
    return d;
}

/** Ścieżka źródła: absolutna albo względem _OtakOs_Muzyka. Tylko wewnątrz biblioteki albo Wymiaru. */
function rozwiazPlik(plik) {
    const p = String(plik || '').trim();
    if (!p) throw new Error('Wskaż utwór (`plik`).');
    const abs = path.isAbsolute(p) ? p : path.join(cfg.musicDir, p);
    const wolno = [cfg.musicDir, cfg.katalogKatedry].some((k) => path.resolve(abs).startsWith(path.resolve(k)));
    if (!wolno) throw new Error('Warsztat bierze utwory tylko z biblioteki Katedry (_OtakOs_Muzyka) albo z Wymiaru.');
    if (!fsSync.existsSync(abs)) throw new Error(`Nie widzę pliku: ${abs}`);
    return abs;
}

/** Wagi z workflow acestep15.json — jedno źródło prawdy o tym, czym liczymy. */
async function wagiZWorkflow() {
    const wf = JSON.parse(await fs.readFile(path.join(cfg.workflowsDir, 'acestep15.json'), 'utf8'));
    const unet = Object.values(wf).find((n) => n.class_type === 'UNETLoader')?.inputs;
    const clip = Object.values(wf).find((n) => n.class_type === 'DualCLIPLoader')?.inputs;
    const vae = Object.values(wf).find((n) => n.class_type === 'VAELoader')?.inputs;
    const te = Object.values(wf).find((n) => n.class_type === 'TextEncodeAceStepAudio1.5')?.inputs;
    const ks = Object.values(wf).find((n) => n.class_type === 'KSampler')?.inputs;
    if (!unet || !clip || !vae || !te) throw new Error('acestep15.json nie ma loaderów ACE 1.5 — nie wiem, czym liczyć.');
    return { unet, clip, vae, te, ks };
}

function graf({ tryb, wagi, plikWejscia, tags, lyrics, sila, sekundyNowe, sekundyOryg, seed, bpm, keyscale, language, prefix }) {
    const te = { ...wagi.te, tags, lyrics: lyrics || '', seed, bpm: bpm || wagi.te.bpm, keyscale: keyscale || wagi.te.keyscale, language: language || wagi.te.language };
    const g = {
        '104': { class_type: 'UNETLoader', inputs: { ...wagi.unet } },
        '105': { class_type: 'DualCLIPLoader', inputs: { ...wagi.clip } },
        '106': { class_type: 'VAELoader', inputs: { ...wagi.vae } },
        '78':  { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['104', 0], shift: 3.0 } },
        '1':   { class_type: 'LoadAudio', inputs: { audio: plikWejscia } },
        '5':   { class_type: 'VAEEncodeAudio', inputs: { audio: ['1', 0], vae: ['106', 0] } },
        '47':  { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['94', 0] } },
        '18':  { class_type: 'VAEDecodeAudio', inputs: { samples: ['10', 0], vae: ['106', 0] } },
        '107': { class_type: 'SaveAudioMP3', inputs: { audio: ['18', 0], filename_prefix: `audio/${prefix}`, quality: 'V0' } },
    };
    const sampler = (positive, latent, denoise) => ({ class_type: 'KSampler', inputs: { model: ['78', 0], seed, steps: wagi.ks?.steps ?? 8, cfg: wagi.ks?.cfg ?? 1.0, sampler_name: wagi.ks?.sampler_name ?? 'euler', scheduler: wagi.ks?.scheduler ?? 'simple', positive, negative: ['47', 0], latent_image: latent, denoise } });
    if (tryb === 'przedluz') {
        g['94'] = { class_type: 'TextEncodeAceStepAudio1.5', inputs: { ...te, clip: ['105', 0], duration: sekundyNowe } };
        g['95'] = { class_type: 'ReferenceTimbreAudio', inputs: { conditioning: ['94', 0], latent: ['5', 0] } };
        g['98'] = { class_type: 'EmptyAceStep1.5LatentAudio', inputs: { seconds: sekundyNowe, batch_size: 1 } };
        g['10'] = sampler(['95', 0], ['98', 0], 1.0);
    } else if (tryb === 'remiks') {
        g['94'] = { class_type: 'TextEncodeAceStepAudio1.5', inputs: { ...te, clip: ['105', 0], duration: sekundyOryg } };
        g['10'] = sampler(['94', 0], ['5', 0], sila);
    } else if (tryb === 'cover') {
        g['94'] = { class_type: 'TextEncodeAceStepAudio1.5', inputs: { ...te, clip: ['105', 0], duration: sekundyOryg } };
        g['95'] = { class_type: 'ReferenceTimbreAudio', inputs: { conditioning: ['94', 0], latent: ['5', 0] } };
        g['98'] = { class_type: 'EmptyAceStep1.5LatentAudio', inputs: { seconds: sekundyOryg, batch_size: 1 } };
        g['10'] = sampler(['95', 0], ['98', 0], 1.0);
    } else throw new Error(`Nieznany tryb „${tryb}". Znam: ${Object.keys(TRYBY).join(', ')}.`);
    return g;
}

/**
 * Zleca przeróbkę. Zwraca zadanie natychmiast; ComfyUI liczy w tle, most sam
 * odbiera wynik, zszywa (przedłuż) i zapisuje do _Przerobki.
 */
export async function przerob({ tryb = 'przedluz', plik, tags = '', lyrics = '', sila = 0.5, dodajSekund = 30, seed, bpm, keyscale, language, crossfade = 2 }) {
    if (!cfg) throw new Error('Warsztat nieskonfigurowany.');
    if (!TRYBY[tryb]) throw new Error(`Nieznany tryb „${tryb}". Znam: ${Object.keys(TRYBY).join(', ')}.`);
    if (!String(tags).trim()) throw new Error('Podaj tagi (opis brzmienia) — model nie zgadnie, w którą stronę iść.');
    const zrodlo = rozwiazPlik(plik);
    const sekundyOryg = Math.round(await dlugoscSekund(zrodlo) * 10) / 10;
    if (sekundyOryg > 600) throw new Error(`Utwór ma ${sekundyOryg} s — Warsztat bierze do 10 minut.`);
    const sekundyNowe = Math.max(5, Math.min(300, Number(dodajSekund) || 30));
    const silaN = Math.max(0.1, Math.min(0.95, Number(sila) || 0.5));
    const wagi = await wagiZWorkflow();

    // Plik do katalogu wejściowego ComfyUI — LoadAudio czyta tylko stamtąd.
    const wejscie = path.join(cfg.comfyDir, 'ComfyUI', 'input');
    await fs.mkdir(wejscie, { recursive: true });
    const nazwaWe = `teo_warsztat_${Date.now().toString(36)}${path.extname(zrodlo) || '.mp3'}`;
    await fs.copyFile(zrodlo, path.join(wejscie, nazwaWe));

    const id = `wr-${Date.now().toString(36)}-${id8()}`;
    const uzytySeed = Number.isFinite(Number(seed)) && seed !== '' && seed !== null && seed !== undefined ? Number(seed) : Math.floor(Math.random() * 1e12);
    const prefix = `teo_warsztat_${tryb}_${id8()}`;
    const g = graf({ tryb, wagi, plikWejscia: nazwaWe, tags: String(tags), lyrics: String(lyrics || ''), sila: silaN, sekundyNowe, sekundyOryg, seed: uzytySeed, bpm, keyscale, language, prefix });

    const r = await fetch(`${cfg.comfyBase}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: g, client_id: `teo_warsztat_${id}` }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`ComfyUI odrzucił graf (HTTP ${r.status}): ${JSON.stringify(d.node_errors ?? d.error ?? d).slice(0, 400)}`);

    const z = { id, tryb, nazwaTrybu: TRYBY[tryb].nazwa, zrodlo, sekundyOryg, tags: String(tags), lyrics: String(lyrics || ''), sila: tryb === 'remiks' ? silaN : null, dodajSekund: tryb === 'przedluz' ? sekundyNowe : null, crossfade: tryb === 'przedluz' ? crossfade : null, seed: uzytySeed, promptId: d.prompt_id, stan: 'liczy', od: teraz(), wynik: null, streamUrl: null, sekundyWyniku: null, blad: null, silnik: `ComfyUI × ACE-Step 1.5 (${wagi.unet.unet_name})` };
    zadania.set(id, z); sprzatnij();
    cfg.szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `warsztat: ${TRYBY[tryb].nazwa.toLowerCase()} „${path.basename(zrodlo)}"${tryb === 'przedluz' ? ` o ${sekundyNowe} s` : ''}` })?.catch?.(() => {});
    void odbierz(z);
    return z;
}

/** Czeka na ComfyUI, ściąga wynik, zszywa, zapisuje. Jeden zły krok = stan „blad" z powodem. */
async function odbierz(z) {
    const DO_KIEDY = Date.now() + 45 * 60_000;
    try {
        let audio = null;
        while (Date.now() < DO_KIEDY) {
            await spij(4000);
            const h = await fetch(`${cfg.comfyBase}/history/${z.promptId}`).then((x) => x.json()).catch(() => null);
            const w = h?.[z.promptId];
            if (!w) continue;
            const st = w.status ?? {};
            const err = (st.messages ?? []).find((m) => m[0] === 'execution_error');
            if (err) throw new Error(`ComfyUI: ${err[1]?.exception_message || 'błąd wykonania'}`);
            if ((st.messages ?? []).some((m) => m[0] === 'execution_interrupted')) throw new Error('przerwane w ComfyUI');
            if (!st.completed) continue;
            for (const out of Object.values(w.outputs ?? {})) for (const a of out.audio ?? []) audio = a;
            break;
        }
        if (!audio) throw new Error('ComfyUI nie oddał pliku w 45 min.');

        const url = `${cfg.comfyBase}/view?filename=${encodeURIComponent(audio.filename)}&subfolder=${encodeURIComponent(audio.subfolder ?? '')}&type=${audio.type ?? 'output'}`;
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
        const katalog = path.join(cfg.musicDir, '_Przerobki');
        await fs.mkdir(katalog, { recursive: true });
        const baza = `${slug(path.basename(z.zrodlo))}_${z.tryb}_${Date.now().toString(36)}`;
        const nowy = path.join(katalog, `${baza}_fragment.mp3`);
        await fs.writeFile(nowy, buf);

        let wynik = nowy;
        if (z.tryb === 'przedluz') {
            // Zszycie: oryginał → crossfade → kontynuacja. Wideo bez zmian, audio przekodowane raz.
            wynik = path.join(katalog, `${baza}.mp3`);
            const cf = Math.max(0.2, Math.min(8, Number(z.crossfade) || 2));
            await cfg.execFile(cfg.ffmpeg, ['-y', '-i', z.zrodlo, '-i', nowy, '-filter_complex', `[0:a][1:a]acrossfade=d=${cf}:c1=tri:c2=tri[a]`, '-map', '[a]', '-b:a', '192k', wynik], { windowsHide: true, timeout: 5 * 60_000 });
            await fs.rm(nowy, { force: true });
        } else {
            wynik = path.join(katalog, `${baza}.mp3`);
            await fs.rename(nowy, wynik);
        }
        z.wynik = wynik;
        z.sekundyWyniku = Math.round(await dlugoscSekund(wynik) * 10) / 10;
        z.streamUrl = `${cfg.mostBase}/music/_Przerobki/${encodeURIComponent(path.basename(wynik))}`;
        z.stan = 'gotowe';
        cfg.szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `warsztat gotowy: ${path.basename(wynik)} (${z.sekundyWyniku} s)` })?.catch?.(() => {});
    } catch (e) {
        z.stan = 'blad'; z.blad = e.message;
    }
    z.do = teraz();
}

export async function przerwij(id) {
    const z = zadania.get(id);
    if (!z || z.stan !== 'liczy') return false;
    await fetch(`${cfg.comfyBase}/interrupt`, { method: 'POST' }).catch(() => {});
    return true;
}

export default { TRYBY, skonfiguruj, przerob, stanZadania, listaZadan, przerwij };
