/**
 * 🎚️ Produkcja aranżu w SoundCraft — czyste części (rozdział perkusji SMF, skrypt, miks z planu, model z listy,
 * wzmocnienie do −14 LUFS) + PRAWDZIWY soundcraft-cli z _OtakOs_AI/soundcraft (pomijane, gdy go nie ma).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import { utworzProdukcje, skryptProdukcji, rozdzielPerkusje, czytajSmf, zapiszSmf, miksZPlanu, odczytajMiks, brzmienieRoli, wzmocnienieDoCelu, znajdzCli, MIKSY } from '../services/ProdukcjaSoundcraft.js';

const tekstMeta = (t) => { const d = [...Buffer.from(t, 'utf8')]; return [0xff, 0x03, d.length, ...d]; };
/** Aranż jak z Music Studio: 4 ścieżki o nazwach z `src/jam/aranz.ts`, perkusja na kanale 10. */
function midAranzu(beatow = 16) {
    const nuty = (kanal, lista) => lista.flatMap(([wys, start, dl, sila]) => [{ tick: start * 480, bajty: [0x90 | kanal, wys, sila] }, { tick: (start + dl) * 480, bajty: [0x80 | kanal, wys, 0] }]);
    const sc = (nazwa, kanal, lista) => ({ nazwa, zdarzenia: [{ tick: 0, bajty: tekstMeta(nazwa) }, ...nuty(kanal, lista)] });
    const tempo = { nazwa: '', zdarzenia: [{ tick: 0, bajty: [0xff, 0x51, 3, 0x07, 0xa1, 0x20] }] };
    const b = Array.from({ length: beatow }, (_, i) => i);
    return zapiszSmf({ ppq: 480, sciezki: [tempo,
        sc('Melodia (motyw Suwerena)', 0, b.map((i) => [[69, 72, 76, 74][i % 4], i, 0.9, 100])),
        sc('Akordy', 1, b.filter((i) => i % 4 === 0).flatMap((i) => [57, 60, 64].map((w) => [w, i, 4, 70]))),
        sc('Bas', 2, b.map((i) => [i % 8 < 4 ? 45 : 41, i, 0.45, 100])),
        sc('Perkusja', 9, b.flatMap((i) => [[36, i, 0.1, 120], [42, i + 0.5, 0.1, 70], ...(i % 2 ? [[38, i, 0.1, 110]] : [])])),
    ] });
}
const PLAN = { tytul: 'Test produkcji', styl: 'test', tagi: 'electronic, a minor, 120 bpm', tekst: '', sekcje: [
    { typ: 'zwrotka', takty: 2, energia: 0.6, progresja: 'i-iv-v-i', motyw: 1, instrumenty: ['syntezator', 'pad', 'bas-syntetyczny', 'perkusja-elektroniczna'] },
    { typ: 'drop', takty: 2, energia: 1, progresja: 'i-VI-III-VII', motyw: 1, instrumenty: ['dzwonki', 'smyczki', 'bas-syntetyczny', 'perkusja-elektroniczna'] },
] };

test('SMF: odczyt i zapis w obie strony, rozdział perkusji na pady z próbką', () => {
    const mid = midAranzu();
    const smf = czytajSmf(mid);
    assert.deepEqual(smf.sciezki.map((s) => s.nazwa), ['', 'Melodia (motyw Suwerena)', 'Akordy', 'Bas', 'Perkusja']);
    assert.deepEqual(czytajSmf(zapiszSmf(smf)), smf);
    // stopa (36) i hi-hat (42) mają próbki na padach 1 i 3; werbel (38) zostaje na drum_synth
    const { mid: m2, pady } = rozdzielPerkusje(mid, { 36: 0, 42: 2 });
    assert.deepEqual(pady.map((p) => [p.pad, p.nazwa, p.nuty]), [[0, 'Pad 1', [36]], [2, 'Pad 3', [42]]]);
    const s2 = czytajSmf(m2);
    const perk = s2.sciezki.find((s) => s.nazwa === 'Perkusja').zdarzenia.filter((e) => (e.bajty[0] & 0xf0) === 0x90);
    assert.ok(perk.length > 0 && perk.every((e) => e.bajty[1] === 38), 'na drum_synth zostaje tylko werbel');
    const pad1 = s2.sciezki.find((s) => s.nazwa === 'Pad 1').zdarzenia.filter((e) => (e.bajty[0] & 0xf0) === 0x90);
    assert.equal(pad1.length, 16);
    assert.ok(pad1.every((e) => e.bajty[1] === 60 && e.bajty[2] === 120), 'próbka gra na C4 z siłą uderzenia');
    assert.throws(() => czytajSmf(Buffer.from('nie midi')), /MThd/);
});

test('skrypt produkcji: brzmienia z planu, sampler, pogłos na busie, suma z maximizerem, deterministycznie', () => {
    const sciezki = ['', 'Melodia (motyw Suwerena)', 'Akordy', 'Bas', 'Perkusja', 'Pad 1'];
    const s = skryptProdukcji({ mid: 'C:/a/aranz.mid', plan: PLAN, miks: 'kosmiczny', sciezki, probki: [{ nazwa: 'Pad 1', plik: 'C:/a/pad-1.wav', transpose: -2 }], wzmocnienie: 31 });
    const linie = s.trim().split('\n').map((l) => { const i = l.indexOf(' '); return [l.slice(0, i), JSON.parse(l.slice(i + 1))]; });
    assert.equal(linie[0][0], 'file.import_midi');
    const inst = linie.filter(([id]) => id === 'mix.instrument');
    assert.deepEqual(inst.map(([, p]) => [p.track, p.plugin]), [['Melodia (motyw Suwerena)', 'subtractive_synth'], ['Akordy', 'subtractive_synth'], ['Bas', 'subtractive_synth'], ['Perkusja', 'drum_synth']]);
    assert.equal(brzmienieRoli(PLAN, 'melodia'), 'syntezator', 'remis taktów = pierwszy');
    assert.equal(brzmienieRoli({ sekcje: [] }, 'akordy'), 'pad');
    const sampler = linie.find(([id]) => id === 'mix.sampler_load')[1];
    assert.deepEqual([sampler.track, sampler.params.play_mode, sampler.params.key_low, sampler.params.transpose], ['Pad 1', 1, 60, -2]);
    const sendy = linie.filter(([id]) => id === 'mix.send').map(([, p]) => [p.track, p.level_db]);
    assert.deepEqual(sendy, [['Melodia (motyw Suwerena)', -6], ['Akordy', -4], ['Bas', -24], ['Perkusja', -16], ['Pad 1', -16]]);
    assert.ok(linie.some(([id, p]) => id === 'mix.insert' && p.track === 'Pogłos AUX' && p.plugin === 'plate_reverb'));
    assert.ok(linie.some(([id, p]) => id === 'mix.insert' && p.track === 'Melodia (motyw Suwerena)' && p.plugin === 'mod_delay'), 'kosmiczny = echo na melodii');
    const suma = linie.filter(([id, p]) => id === 'mix.insert' && p.track === 'Suma').map(([, p]) => p.plugin);
    assert.deepEqual(suma, ['compressor', 'gain', 'maximizer']);
    assert.equal(linie.find(([id, p]) => id === 'mix.insert' && p.plugin === 'gain')[1].params.gain, 24, 'wzmocnienie ograniczone');
    assert.equal(linie.find(([id, p]) => id === 'mix.insert' && p.plugin === 'maximizer')[1].params.ceiling, -1.5);
    assert.equal(s, skryptProdukcji({ mid: 'C:/a/aranz.mid', plan: PLAN, miks: 'kosmiczny', sciezki, probki: [{ nazwa: 'Pad 1', plik: 'C:/a/pad-1.wav', transpose: -2 }], wzmocnienie: 31 }));
    assert.throws(() => skryptProdukcji({ mid: 'x', plan: PLAN, miks: 'rockowy', sciezki }), /Nieznany miks/);
});

test('miks: z planu, z modelu tylko z listy, wzmocnienie do −14 LUFS', () => {
    assert.equal(miksZPlanu(PLAN), 'klubowy');
    assert.equal(miksZPlanu({ sekcje: [{ typ: 'intro', takty: 4, energia: 0.3, instrumenty: ['fortepian'] }] }), 'kameralny');
    assert.equal(miksZPlanu({ sekcje: [{ typ: 'zwrotka', takty: 4, energia: 0.6, instrumenty: ['pad'] }] }), 'kosmiczny');
    assert.equal(miksZPlanu({ sekcje: [{ typ: 'zwrotka', takty: 4, energia: 0.6, instrumenty: ['fortepian'] }] }), 'cieply');
    assert.deepEqual(odczytajMiks('oto {"miks":"Ciepły","komentarz":"Bo nocą."}'), { miks: 'cieply', komentarz: 'Bo nocą.' });
    assert.equal(odczytajMiks('{"miks":"rockowy"}'), null);
    assert.equal(odczytajMiks('brak'), null);
    assert.equal(wzmocnienieDoCelu(-25.4), 11.4);
    assert.equal(wzmocnienieDoCelu(-60), 24);
    assert.equal(wzmocnienieDoCelu(-3), -11);
    assert.equal(wzmocnienieDoCelu(NaN), 0);
    assert.equal(Object.keys(MIKSY).length, 5);
});

const KATALOG_AI = path.resolve('_OtakOs_AI');
const CLI = znajdzCli(KATALOG_AI);

test('PRAWDZIWY SoundCraft: aranż + pad z próbką → −14 LUFS, true peak ≤ −1, stemy, sesja, mp3', { skip: !CLI && 'brak soundcraft-cli w _OtakOs_AI/soundcraft' }, async () => {
    const korzen = await fs.mkdtemp(path.join(os.tmpdir(), 'produkcja-'));
    try {
        const M = path.join(korzen, 'muzyka');
        await fs.mkdir(path.join(M, 'Aranże Joanny'), { recursive: true });
        await fs.writeFile(path.join(M, 'Aranże Joanny', 'Test [a1b2c3d4].mid'), midAranzu(32));
        // pad 1 = krótki „kick” z ffmpeg (sinus z opadającą obwiednią), przycięty i ściszony w ustawieniach
        const katPadow = path.join(korzen, 'pady');
        await fs.mkdir(katPadow);
        const { execFileSync } = await import('child_process');
        execFileSync(ffmpegPath, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=55:duration=1', '-af', 'afade=t=out:st=0:d=0.6,volume=0.2', path.join(katPadow, 'pad-1-abcdef12.wav')]);
        const zestaw = { id: 'test', katalog: katPadow, pady: Array.from({ length: 16 }, (_, i) => (i === 0 ? { plik: 'pad-1-abcdef12.wav', od: 0, do: 0.5, glosnosc: 1, normalizacja: true, stroj: 0 } : { plik: null })) };
        const P = utworzProdukcje({ katalogMuzyki: M, katalog: path.join(korzen, 'wymiar'), katalogAI: KATALOG_AI, ffmpeg: ffmpegPath });
        const stan = await P.stan();
        assert.equal(stan.dostepny, true, stan.powod);
        const a = { id: 'a-a1b2c3d4', plan: PLAN, demo: { mid: 'Aranże Joanny/Test [a1b2c3d4].mid' } };
        const t0 = Date.now();
        const p = await P.produkuj(a, { miks: 'klubowy', zestaw, baza: 'Test [a1b2c3d4]' });
        console.log(`  produkcja ${((Date.now() - t0) / 1000).toFixed(1)} s: ${p.lufsPrzed} → ${p.lufs} LUFS (wzmocnienie ${p.wzmocnienie} dB), TP ${p.truePeak}, ${p.sekundy} s, stemy ${p.stemy.length}`);
        assert.equal(p.miks, 'klubowy');
        assert.equal(p.miksZrodlo, 'suweren');
        assert.ok(Math.abs(p.lufs - -14) <= 1.5, `LUFS ${p.lufs}`);
        assert.ok(p.truePeak <= -1, `true peak ${p.truePeak}`);
        assert.ok(p.sekundy >= 15 && p.sekundy < 25, `${p.sekundy} s`);
        assert.deepEqual(p.probki, [{ pad: 1, nuty: [36] }]);
        assert.ok(p.stemy.some((s) => /Pad 1/.test(s)) && p.stemy.some((s) => /Perkusja/.test(s)) && p.stemy.length >= 5, p.stemy.join(', '));
        assert.equal(p.plik, 'Aranże Joanny/Test [a1b2c3d4] (produkcja).mp3');
        assert.ok((await fs.stat(path.join(M, p.plik))).size > 50_000);
        assert.ok((await fs.stat(p.sesja)).size > 1000, 'sesja .scraft zapisana');
        // druga produkcja naraz = odmowa, bez demo = odmowa
        await assert.rejects(() => P.produkuj({ ...a, demo: null }, {}), /Najpierw demo/);
        await assert.rejects(() => P.produkuj(a, { miks: 'rockowy', baza: 'x' }), /Nieznany miks/);
    } finally { await fs.rm(korzen, { recursive: true, force: true }); }
});
