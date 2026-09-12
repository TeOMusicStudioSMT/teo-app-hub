/**
 * 🎬🎵 TELEDYSK Z NOWYCH SCEN (2026-09-12).
 *
 * Suweren: „w Music jest przycisk Teledysk w Katedrze — póki co to sklejanie
 * z przygotowanych scen. Chciałbym też wybór, by Joanna powiedziała, o czym
 * utwór, do Opowieści — i zbudowali teledysk z całkiem nowych scen."
 *
 * Droga (każdy krok to istniejąca rzecz w Katedrze):
 *   1. Joanna (model) mówi, O CZYM jest utwór: treatment, świat, bohater,
 *      motyw przewodni — z tekstu, stylu i promptu, które Suweren miał w Music.
 *   2. Powstaje PROJEKT Story: katalog, fakty kanoniczne (to, co Joanna
 *      powiedziała + „to teledysk do utworu X"), JEDEN odcinek w planie
 *      o długości utworu (czasMinut) i utwór wpięty jako motyw przewodni.
 *   3. `teledysk.json` w katalogu projektu — ścieżka audio, tekst, styl. Stąd
 *      montaż Realizacji Nocnej wie, że pod film ma wejść TEN utwór.
 *   4. Dalej jak każdy odcinek: Reżyser pisze kadry (liczba z długości),
 *      produkcja (kadry → ruch → montaż) — w nocy albo „teraz".
 *
 * ⚠️ NIE SKLEJAMY GOTOWYCH SCEN. To jest właśnie ten drugi tryb — kadry
 * powstają od zera z opowieści Joanny. Stary tryb (beat-sync z przygotowanych
 * scen) zostaje pod „Katedra Teledysk".
 *
 * ⚠️ DŁUGOŚĆ FILMU ≈ DŁUGOŚĆ UTWORU, nie dokładnie. Ujęcie trwa ~2,04 s, więc
 * 60 s utworu = ~29 kadrów; montaż przycina do krótszego z dwóch (`-shortest`).
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

let cfg = null;
export function skonfiguruj(c) { cfg = c; }

const teraz = () => new Date().toISOString();
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'utwor';

function pierwszyObiekt(s) {
    let g = 0, start = -1, wL = false, esc = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (wL) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') wL = false; continue; }
        if (c === '"') { wL = true; continue; }
        if (c === '{') { if (g === 0) start = i; g++; }
        else if (c === '}') { g--; if (g === 0 && start >= 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch { start = -1; } } }
    }
    return null;
}

/** Audio do katalogu projektu: z URL (Music oddaje blob/http) albo z pliku na dysku. */
async function przyniesAudio({ audioUrl, audioPlik, katalogProjektu, nazwa }) {
    const cel = path.join(katalogProjektu, 'muzyka');
    await fs.mkdir(cel, { recursive: true });
    if (audioPlik) {
        const abs = path.isAbsolute(audioPlik) ? audioPlik : path.resolve(process.cwd(), audioPlik);
        if (!fsSync.existsSync(abs)) throw new Error(`Nie widzę pliku audio: ${abs}`);
        const wyj = path.join(cel, `${slug(nazwa)}${path.extname(abs) || '.mp3'}`);
        if (path.resolve(abs) !== path.resolve(wyj)) await fs.copyFile(abs, wyj);
        return wyj;
    }
    if (audioUrl && /^https?:\/\//i.test(audioUrl)) {
        const r = await fetch(audioUrl);
        if (!r.ok) throw new Error(`Pobieranie audio: HTTP ${r.status}`);
        const typ = r.headers.get('content-type') || '';
        const ext = /wav/i.test(typ) ? '.wav' : /flac/i.test(typ) ? '.flac' : '.mp3';
        const wyj = path.join(cel, `${slug(nazwa)}${ext}`);
        await fs.writeFile(wyj, Buffer.from(await r.arrayBuffer()));
        return wyj;
    }
    throw new Error('Potrzebuję audio: `audioPlik` (ścieżka na dysku) albo `audioUrl` (http).');
}

export async function zaplanuj({ audioUrl = '', audioPlik = '', tytul = '', styl = '', prompt = '', lyrics = '', sekundy = 0, model, realizujTeraz = false }) {
    if (!cfg) throw new Error('TeledyskNowy nieskonfigurowany.');
    const nazwaUtworu = String(tytul || 'Utwór').replace(/\.(mp3|wav|flac)$/i, '').trim().slice(0, 80);
    const sek = Math.max(10, Number(sekundy) || 60);

    // 1. JOANNA: o czym jest utwór — to jest jej głos, podpisany modelem.
    const { tekst, silnik } = await cfg.pisz(model,
        'Jesteś Joanną — TeOgochi Katedry OtakOS od muzyki. Słuchasz utworu przez jego tekst, styl i opis, i opowiadasz Reżyserowi, O CZYM on jest, żeby powstał teledysk z NOWYCH scen. Odpowiadasz WYŁĄCZNIE jednym obiektem JSON, po polsku.',
        [
            `UTWÓR: „${nazwaUtworu}" · ${Math.round(sek)} s`,
            styl ? `STYL: ${styl}` : '', prompt ? `OPIS: ${prompt}` : '', lyrics ? `TEKST:\n${String(lyrics).slice(0, 4000)}` : '(bez tekstu — instrumentalny)',
            '',
            'JSON: {"tytul": "<tytuł teledysku, 2-6 słów>", "oCzym": "<3-5 zdań: historia, którą opowiada ten utwór>", "swiat": "<2-3 zdania: gdzie i kiedy, faktura obrazu, paleta>", "bohater": "<1-2 zdania: kto jest w kadrze>", "motyw": "<jeden obraz-motyw, który wraca w refrenie>", "nastroj": "<3-6 słów>"}',
        ].filter(Boolean).join('\n'));
    const j = pierwszyObiekt(tekst) ?? {};
    const joanna = {
        tytul: String(j.tytul || nazwaUtworu).slice(0, 80), oCzym: String(j.oCzym || '').trim(), swiat: String(j.swiat || '').trim(),
        bohater: String(j.bohater || '').trim(), motyw: String(j.motyw || '').trim(), nastroj: String(j.nastroj || '').trim(), model: silnik,
    };
    if (!joanna.oCzym) throw new Error(`Joanna nie opowiedziała, o czym jest utwór (model ${silnik} oddał: ${tekst.slice(0, 120)}…).`);

    // 2. PROJEKT STORY — nazwa od utworu; gdy taki istnieje, dopisujemy „· teledysk".
    let serial = joanna.tytul;
    const istniejace = (await cfg.listaProjektow(cfg.katalog).catch(() => [])).map((p) => String(p.nazwa).toLowerCase());
    if (istniejace.includes(serial.toLowerCase())) serial = `${serial} · teledysk`;
    const projekt = await cfg.utworzProjekt(cfg.katalog, serial, `Teledysk do utworu „${nazwaUtworu}" — opowieść Joanny (${silnik}).`);

    const fakty = [
        `To teledysk do utworu „${nazwaUtworu}"${styl ? ` (${styl})` : ''}, ${Math.round(sek)} s. Każdy kadr ma trwać ~2 s i mieścić się w rytmie.`,
        `O czym: ${joanna.oCzym}`,
        joanna.swiat ? `Świat: ${joanna.swiat}` : '',
        joanna.bohater ? `Bohater: ${joanna.bohater}` : '',
        joanna.motyw ? `Motyw powracający w refrenie: ${joanna.motyw}` : '',
    ].filter(Boolean);
    for (const f of fakty) await cfg.dodajFakt(cfg.katalog, serial, f, 'joanna').catch(() => null);

    const odcinek = await cfg.dodajOdcinek(cfg.katalog, serial, {
        tytul: `Teledysk — ${nazwaUtworu}`.slice(0, 120),
        streszczenie: [joanna.oCzym, joanna.swiat, lyrics ? `Tekst utworu:\n${String(lyrics).slice(0, 1500)}` : ''].filter(Boolean).join('\n\n'),
        status: 'plan', czasMinut: Math.round((sek / 60) * 100) / 100, styl: [styl, joanna.nastroj].filter(Boolean).join(' · ').slice(0, 300), agent: 'klatka',
    });

    // 3. AUDIO do projektu + motyw przewodni + teledysk.json.
    const audio = await przyniesAudio({ audioUrl, audioPlik, katalogProjektu: projekt.sciezka, nazwa: nazwaUtworu });
    await cfg.dodajUtwor(cfg.katalog, serial, { sciezka: audio, rola: 'przewodni', nazwa: nazwaUtworu, odcinekId: odcinek.id }).catch(() => null);
    const teledysk = { utwor: nazwaUtworu, audio, sekundy: sek, styl, prompt, lyrics: String(lyrics || ''), joanna, odcinekId: odcinek.id, serial, data: teraz() };
    await fs.writeFile(path.join(projekt.sciezka, 'teledysk.json'), JSON.stringify(teledysk, null, 2), 'utf8');
    cfg.szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `opowiedziała Reżyserowi, o czym jest „${nazwaUtworu}" — projekt „${serial}", odcinek ${Math.round(sek)} s` })?.catch?.(() => {});

    // 4. Opcjonalnie od razu: Reżyser pisze kadry, potem produkcja + montaż z muzyką.
    let realizacja = null;
    if (realizujTeraz) {
        const r = await fetch(`${cfg.mostBase}/api/rezyser/tablica/zrealizuj`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serial, model }) });
        realizacja = await r.json().catch(() => null);
    }
    return { serial, projekt: { sciezka: projekt.sciezka }, odcinek, joanna, fakty: fakty.length, audio, sekundy: sek, kadrowSzacunkowo: Math.round(sek / 2.04), realizacja };
}

/** Dla montażu: czy projekt jest teledyskiem (ma utwór do podłożenia). */
export async function teledyskProjektu(katalogProjektu) {
    try {
        const t = JSON.parse(await fs.readFile(path.join(katalogProjektu, 'teledysk.json'), 'utf8'));
        return t?.audio && fsSync.existsSync(t.audio) ? t : null;
    } catch { return null; }
}

export default { skonfiguruj, zaplanuj, teledyskProjektu };
