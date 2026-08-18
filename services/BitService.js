/**
 * 🥁 BitService — SUWERENNY SILNIK BITÓW (Step-Grid)
 *
 * Zamienia matrycę rytmiczną [1,0,0,0,...] na realny plik WAV. Bez sampli, bez
 * bibliotek, bez zewnętrznego DAW-a — perkusja jest SYNTEZOWANA proceduralnie
 * z fal, dokładnie w duchu 0.00G.
 *
 * ⚠️ UCZCIWIE O „432 Hz NA PERKUSJI": strojenie odniesienia dotyczy materiału
 * WYSOKOŚCIOWEGO. Da się nastroić fundament stopy, ton korpusu werbla i perkusję
 * syntezatorową — i to robimy, wyprowadzając ich częstotliwości z podanego
 * odniesienia. HI-HAT TO SZUM NIEHARMONICZNY i „nastrojenie" go nie znaczy nic,
 * więc go nie stroimy i nie udajemy, że stroimy. Pole `dsp_freq` realnie zmienia
 * brzmienie stopy, werbla i synth-perc — nie jest ozdobnikiem, ale też nie jest
 * magią działającą na wszystko.
 */

import fs from 'fs/promises';
import path from 'path';

export const SCIEZKI = ['kick', 'snare', 'hihat', 'synth'];
const SR = 44100;                 // sample rate
const KROKOW_NA_TAKT = 16;        // 16 kroków = takt 4/4 w szesnastkach

// ── PARSER WZORCÓW TEKSTOWYCH ────────────────────────────────────────────────

/**
 * Zamienia zapis z czatu na tablicę 0/1. Przyjmuje formy, których realnie
 * używają ludzie i modele — nie zmuszamy nikogo do jednej składni:
 *   "x---x---x---x---"      (x/o/./-/_ )
 *   "1000100010001000"
 *   "1,0,0,0,1,0,0,0"
 *   [1,0,0,0]              (już tablica)
 */
export function parsujWzor(wejscie, kroki) {
    if (Array.isArray(wejscie)) {
        const t = wejscie.map((v) => (Number(v) > 0 ? 1 : 0));
        return dopasujDlugosc(t, kroki);
    }
    const s = String(wejscie ?? '').trim();
    if (!s) return new Array(kroki).fill(0);

    // Z przecinkami / spacjami
    if (/[,\s]/.test(s)) {
        const t = s.split(/[,\s]+/).filter(Boolean).map((v) => (Number(v) > 0 || /^[xX#*]$/.test(v) ? 1 : 0));
        return dopasujDlugosc(t, kroki);
    }
    // Ciąg znaków: x/X/1/#/* = uderzenie, reszta = cisza
    const t = [...s].map((c) => (/[xX1#*]/.test(c) ? 1 : 0));
    return dopasujDlugosc(t, kroki);
}

/** Krótszy wzór zapętlamy, dłuższy przycinamy — tak działa każdy sekwencer. */
function dopasujDlugosc(tab, kroki) {
    if (!tab.length) return new Array(kroki).fill(0);
    const out = new Array(kroki);
    for (let i = 0; i < kroki; i++) out[i] = tab[i % tab.length];
    return out;
}

/**
 * Cała matryca z obiektu. Nieznane ścieżki są pomijane, brakujące = cisza.
 * Zwraca też listę pominiętych, żeby most mógł o nich powiedzieć zamiast milczeć.
 */
export function parsujMatryce(grid, kroki) {
    const matryca = {};
    const nieznane = [];
    for (const s of SCIEZKI) matryca[s] = new Array(kroki).fill(0);
    for (const [klucz, wzor] of Object.entries(grid ?? {})) {
        const k = String(klucz).toLowerCase().trim();
        // Synonimy, których używają czaty i ludzie.
        const cel = k === 'bass' || k === 'bd' || k === 'stopa' ? 'kick'
            : k === 'sd' || k === 'werbel' || k === 'clap' ? 'snare'
            : k === 'hh' || k === 'hat' || k === 'talerz' ? 'hihat'
            : k === 'perc' || k === 'lead' || k === 'bell' ? 'synth'
            : SCIEZKI.includes(k) ? k : null;
        if (!cel) { nieznane.push(klucz); continue; }
        matryca[cel] = parsujWzor(wzor, kroki);
    }
    return { matryca, nieznane };
}

// ── SYNTEZA ──────────────────────────────────────────────────────────────────

/**
 * Fundamenty wyprowadzone z odniesienia. Dla 432 Hz stopa siada na 54 Hz
 * (A1 w tym stroju), korpus werbla na 216 Hz (A3), synth na 432 Hz (A4).
 * Dla 440 Hz wychodzi klasyczne 55 / 220 / 440. To jest realna różnica
 * w brzmieniu, a nie etykieta.
 */
function fundamenty(dspFreq) {
    const f = Number(dspFreq) > 0 ? Number(dspFreq) : 432;
    return { kick: f / 8, snare: f / 2, synth: f };
}

/** Stopa: sinus ze zjazdem wysokości i wykładniczym zanikiem. */
function uderzKick(buf, start, f0) {
    const dl = Math.floor(SR * 0.28);
    for (let i = 0; i < dl && start + i < buf.length; i++) {
        const t = i / SR;
        const env = Math.exp(-t * 14);
        // Zjazd z ~3.2× fundamentu do fundamentu — to daje "puk" i ciało.
        const f = f0 * (1 + 2.2 * Math.exp(-t * 45));
        buf[start + i] += Math.sin(2 * Math.PI * f * t) * env * 0.9;
    }
}

/** Werbel: szum + nastrojony ton korpusu. */
function uderzSnare(buf, start, fBody) {
    const dl = Math.floor(SR * 0.18);
    for (let i = 0; i < dl && start + i < buf.length; i++) {
        const t = i / SR;
        const env = Math.exp(-t * 26);
        const szum = (Math.random() * 2 - 1) * 0.55;
        const ton = Math.sin(2 * Math.PI * fBody * t) * 0.35;
        buf[start + i] += (szum + ton) * env * 0.7;
    }
}

/**
 * Hi-hat: szum przepuszczony przez prosty górnoprzepustowy (różnica próbek).
 * ŚWIADOMIE NIESTROJONY — to materiał nieharmoniczny, patrz nagłówek pliku.
 */
function uderzHihat(buf, start) {
    const dl = Math.floor(SR * 0.06);
    let poprz = 0;
    for (let i = 0; i < dl && start + i < buf.length; i++) {
        const t = i / SR;
        const env = Math.exp(-t * 70);
        const x = Math.random() * 2 - 1;
        const hp = x - poprz;   // różniczka = górnoprzepust pierwszego rzędu
        poprz = x;
        buf[start + i] += hp * env * 0.32;
    }
}

/** Synth-perc: krótki nastrojony blip z lekką kwintą. */
function uderzSynth(buf, start, f0) {
    const dl = Math.floor(SR * 0.14);
    for (let i = 0; i < dl && start + i < buf.length; i++) {
        const t = i / SR;
        const env = Math.exp(-t * 22);
        const a = Math.sin(2 * Math.PI * f0 * t);
        const b = 0.4 * Math.sin(2 * Math.PI * f0 * 1.5 * t);
        buf[start + i] += (a + b) * env * 0.28;
    }
}

/**
 * Renderuje matrycę do bufora PCM.
 * @returns {{ pcm: Float32Array, sekundy: number, uderzen: number }}
 */
export function syntezuj({ bpm = 120, kroki = 16, matryca, dspFreq = 432, powtorzen = 2 }) {
    const tempo = Math.max(40, Math.min(220, Number(bpm) || 120));
    const krokSek = (60 / tempo) / (KROKOW_NA_TAKT / 4);   // długość jednego kroku
    const dlugoscSek = krokSek * kroki * powtorzen;
    // Ogon na wybrzmienie ostatniego uderzenia — bez tego bit ucina się brutalnie.
    const pcm = new Float32Array(Math.ceil((dlugoscSek + 0.35) * SR));
    const f = fundamenty(dspFreq);
    let uderzen = 0;

    for (let p = 0; p < powtorzen; p++) {
        for (let k = 0; k < kroki; k++) {
            const start = Math.floor(((p * kroki + k) * krokSek) * SR);
            if (matryca.kick?.[k])  { uderzKick(pcm, start, f.kick);   uderzen++; }
            if (matryca.snare?.[k]) { uderzSnare(pcm, start, f.snare); uderzen++; }
            if (matryca.hihat?.[k]) { uderzHihat(pcm, start);          uderzen++; }
            if (matryca.synth?.[k]) { uderzSynth(pcm, start, f.synth); uderzen++; }
        }
    }

    // Normalizacja z zapasem — sumowanie ścieżek potrafi przesterować.
    let szczyt = 0;
    for (let i = 0; i < pcm.length; i++) szczyt = Math.max(szczyt, Math.abs(pcm[i]));
    if (szczyt > 0.99) {
        const g = 0.99 / szczyt;
        for (let i = 0; i < pcm.length; i++) pcm[i] *= g;
    }
    return { pcm, sekundy: dlugoscSek, uderzen };
}

/** PCM → bufor WAV 16-bit mono. */
export function doWav(pcm) {
    const buf = Buffer.alloc(44 + pcm.length * 2);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + pcm.length * 2, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);           // PCM
    buf.writeUInt16LE(1, 22);           // mono
    buf.writeUInt32LE(SR, 24);
    buf.writeUInt32LE(SR * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(pcm.length * 2, 40);
    for (let i = 0; i < pcm.length; i++) {
        const s = Math.max(-1, Math.min(1, pcm[i]));
        buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
    }
    return buf;
}

/**
 * Pełna droga: parametry → plik WAV na dysku.
 * @returns {{ plik, sciezka, bpm, kroki, dspFreq, sekundy, uderzen, nieznane, matryca }}
 */
export async function renderujBit(params, katalogDocelowy) {
    const kroki = [8, 16, 32, 64].includes(Number(params.steps)) ? Number(params.steps) : 16;
    const bpm = Math.max(40, Math.min(220, Number(params.bpm) || 120));
    const dspFreq = Number(params.dsp_freq ?? params.dspFreq) || 432;
    const powtorzen = Math.max(1, Math.min(16, Number(params.powtorzen ?? params.bars) || 2));

    const { matryca, nieznane } = parsujMatryce(params.grid, kroki);
    const pusta = SCIEZKI.every((s) => matryca[s].every((v) => !v));
    if (pusta) {
        throw new Error('Matryca jest pusta — żadna ścieżka nie ma uderzeń.');
    }

    const { pcm, sekundy, uderzen } = syntezuj({ bpm, kroki, matryca, dspFreq, powtorzen });
    await fs.mkdir(katalogDocelowy, { recursive: true });
    const nazwa = `bit_${bpm}bpm_${dspFreq}hz_${Date.now()}.wav`;
    const sciezka = path.join(katalogDocelowy, nazwa);
    await fs.writeFile(sciezka, doWav(pcm));

    return { plik: nazwa, sciezka, bpm, kroki, dspFreq, powtorzen, sekundy, uderzen, nieznane, matryca };
}

export default { SCIEZKI, parsujWzor, parsujMatryce, syntezuj, doWav, renderujBit };
