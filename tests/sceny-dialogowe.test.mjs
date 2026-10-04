// 💬 Sceny dialogowe filmu: prompt bez prowadzącego, kadry projektu, ujęcie–przeciwujęcie, poprawki, dalszy ciąg,
// PRAWDZIWE nagranie (ffmpeg, tło-obraz i tło-klip, głos = sinus) ze schowkiem głosu → montaże projektu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { utworzSceny, promptSceny, promptDalszegoCiagu, tloKwestii, argumentyUjecia, MAX_RUND } from '../services/ScenyDialogowe.js';
import { opisz } from '../services/Montazownia.js';
import { CZCIONKI } from '../services/PowitanieDnia.js';

const czcionka = CZCIONKI.find((p) => fs.existsSync(p));
const czekaj = async (warunek, ms = 180_000) => { const t0 = Date.now(); for (;;) { const w = await warunek(); if (w) return w; if (Date.now() - t0 > ms) throw new Error('Za długo.'); await new Promise((r) => setTimeout(r, 200)); } };
const tmpDir = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `sceny-${n}-`));
const KAEL = { id: 'kael', imie: 'Kael', rola: 'Pilot, mówi krótko', kolor: '#3b82f6', zdjecie: null, glos: { profil: 'kael-glos' } };
const ELARA = { id: 'elara', imie: 'Elara', rola: 'Astronomka, poetycka', kolor: '#ec4899', zdjecie: null, glos: null };
const MIRA = { id: 'mira', imie: 'Mira', rola: 'DJ-ka', kolor: '#22c55e', zdjecie: null, glos: null };
const DIALOG = 'KAEL: Burza idzie od zachodu.\nELARA: Widzę ją w gwiazdach od tygodnia.\nKAEL: I nic nie powiedziałaś?\nELARA: Nie pytałeś, Kael.';

test('prompt sceny: nikt nie prowadzi, bez powitań, kanon i postacie w rolach, styl; dalszy ciąg bez powtórek', () => {
    const { system, user } = promptSceny({ postacie: [KAEL, ELARA], opis: 'Dach przed burzą', kanon: '- Kael wrócił z orbity', uwagi: 'więcej napięcia', styl: 'deep' });
    assert.match(system, /Nikt nie prowadzi/);
    assert.match(system, /nikt nie wita/);
    assert.match(system, /IMIĘ: tekst kwestii/);
    assert.match(system, /STYL:/);
    assert.match(user, /SCENA: Dach przed burzą/);
    assert.match(user, /KANON PROJEKTU:\n- Kael wrócił z orbity/);
    assert.match(user, /- KAEL: Pilot/);
    assert.match(promptSceny({ postacie: [KAEL, ELARA], opis: 'x', jezyk: 'en' }).system, /PO ANGIELSKU/);
    const d = promptDalszegoCiagu({ postacie: [KAEL, ELARA], opis: 'Dach', kwestie: [{ kto: 'kael', tekst: 'Burza.' }], imie: (id) => (id === 'kael' ? 'Kael' : id), runda: 1 });
    assert.match(d.system, /DALSZY CIĄG.*część 2/);
    assert.match(d.user, /KAEL: Burza\./);
});

test('tło kwestii: wskazane wygrywa; jeden kadr = ten sam; kilka = „swój” kadr postaci (ujęcie–przeciwujęcie)', () => {
    const tla = [{ plik: 'a.jpg' }, { plik: 'b.jpg' }];
    assert.equal(tloKwestii({ kto: 'kael' }, [], [KAEL, ELARA]), null);
    assert.equal(tloKwestii({ kto: 'elara' }, [tla[0]], [KAEL, ELARA]), 0);
    assert.equal(tloKwestii({ kto: 'kael' }, tla, [KAEL, ELARA]), 0);
    assert.equal(tloKwestii({ kto: 'elara' }, tla, [KAEL, ELARA]), 1);
    assert.equal(tloKwestii({ kto: 'elara', tlo: 0 }, tla, [KAEL, ELARA]), 0);
    assert.equal(tloKwestii({ kto: 'elara', tlo: 7 }, tla, [KAEL, ELARA]), 1, 'nieistniejący indeks = automat');
});

test('ujęcie: napisy wyśrodkowane na dole, imię i karta opcjonalne, klip jako tło bez najazdu', () => {
    const a = argumentyUjecia({ tlo: { plik: 't.jpg', ox: 0.5, oy: 0.5 }, liniePliki: ['l0.txt'], czcionka: 'c.ttf', czas: 2, audio: null, wyjscie: 'u.mp4' });
    const f = a[a.indexOf('-filter_complex') + 1];
    assert.match(f, /x=\(w-text_w\)\/2/);
    assert.match(f, /zoompan/);
    assert.ok(!/overlay/.test(f) && !/textfile=i-/.test(f));
    const b = argumentyUjecia({ tlo: { plik: 't.mp4' }, karta: 'k.jpg', imiePlik: 'i-001.txt', kolor: '#ff0000', liniePliki: ['l0.txt', 'l1.txt'], czcionka: 'c.ttf', czas: 2, audio: 'a.wav', wyjscie: 'u.mp4' });
    const g = b[b.indexOf('-filter_complex') + 1];
    assert.ok(b.includes('-stream_loop') && !/zoompan/.test(g), 'klip zapętlony, bez najazdu');
    assert.match(g, /overlay/); assert.match(g, /textfile=i-001\.txt/); assert.match(g, /\[2:a\]/);
});

test('scena: obsada 2–4, tła muszą istnieć, opis wymagany; kadry projektu bez montaży; poprawki z tłem; dalszy ciąg i limit', async () => {
    const tmp = tmpDir('logika');
    const projekt = path.join(tmp, 'produkcje', 'film');
    fs.mkdirSync(path.join(projekt, 'ujecia'), { recursive: true });
    fs.mkdirSync(path.join(projekt, 'montaz'), { recursive: true });
    fs.writeFileSync(path.join(projekt, 'ujecia', 'dach.jpg'), 'x');
    fs.writeFileSync(path.join(projekt, 'ujecia', 'lot.mp4'), 'x');
    fs.writeFileSync(path.join(projekt, 'montaz', 'gotowy.mp4'), 'x');
    fs.writeFileSync(path.join(projekt, 'notatka.txt'), 'x');
    const proby = [];
    const S = utworzSceny({
        katalog: path.join(tmp, 'sceny'), aktorzy: async () => [KAEL, ELARA, MIRA], katalogProjektu: async () => projekt,
        kontekst: async () => ({ opis: '- Kael wrócił z orbity' }), opisz, katalogMontazy: async () => path.join(projekt, 'montaz'),
        chat: async (_m, system, user, opcje) => { proby.push({ system, user, opcje }); return { tekst: /DALSZY CIĄG/.test(system) ? 'ELARA: Wtedy zostaję.\nKAEL: Więc lecimy razem.\nELARA: Razem.' : DIALOG }; },
    });
    const tla = await S.tlaProjektu('film');
    assert.deepEqual(tla.map((t) => t.nazwa).sort(), ['dach.jpg', 'lot.mp4'], 'obrazy i klipy, bez montaży i nie-mediów');
    await assert.rejects(S.przygotuj({ projekt: '', postacie: ['kael', 'elara'], opis: 'Dach' }), /projektu/);
    await assert.rejects(S.przygotuj({ projekt: 'film', postacie: ['kael'], opis: 'Dach przed burzą' }), /dwóch postaci/);
    await assert.rejects(S.przygotuj({ projekt: 'film', postacie: ['kael', 'elara'], opis: 'x' }), /Opisz scenę/);
    await assert.rejects(S.przygotuj({ projekt: 'film', postacie: ['kael', 'elara'], opis: 'Dach przed burzą', tla: ['/nie/ma.jpg'] }), /istniejącym obrazem/);
    const s = await S.przygotuj({ projekt: 'film', postacie: ['kael', 'elara', 'nikt'], opis: 'Dach przed burzą', tla: [tla.find((t) => t.nazwa === 'dach.jpg').plik], styl: 'mistyczny', pralka: 9 });
    assert.deepEqual(s.postacie, ['kael', 'elara']);
    assert.deepEqual(s.kwestie.map((k) => k.kto), ['kael', 'elara', 'kael', 'elara']);
    assert.equal(proby[0].opcje.temperatura, 1.3);
    assert.match(proby[0].user, /KANON PROJEKTU/);
    assert.equal(s.etap, 'scenariusz'); assert.equal(s.rundy, 1); assert.equal(s.styl, 'mistyczny');

    const z = await S.zmien(s.id, { kwestie: [{ kto: 'kael', tekst: 'Burza.', tlo: 0 }, { kto: 'mira', tekst: 'Obca.' }, { kto: 'elara', tekst: 'Wiem.', tlo: 5 }], imiona: true });
    assert.deepEqual(z.kwestie, [{ kto: 'kael', tekst: 'Burza.', tlo: 0 }, { kto: 'elara', tekst: 'Wiem.', tlo: 5 }].map((k, i) => (i === 1 ? { kto: 'elara', tekst: 'Wiem.' } : k)), 'obca postać wypada, tło spoza listy zdjęte');
    assert.equal(z.imiona, true);
    await assert.rejects(S.zmien(s.id, { kwestie: [{ kto: 'kael', tekst: 'Sam.' }] }), /dwóch kwestii/);

    const d = await S.dalej(s.id, { rundy: 2 });
    assert.equal(d.rundy, 3);
    assert.equal(d.kwestie.length, 2 + 3 + 3);
    assert.equal(proby.filter((p) => /DALSZY CIĄG/.test(p.system)).length, 2);
    await S.dalej(s.id, { rundy: 3 });
    await assert.rejects(S.dalej(s.id), new RegExp(`limit ${MAX_RUND}`));
    await assert.rejects(S.nagraj(s.id, { bezGlosu: false }), /silnika głosu/);
    assert.equal((await S.sceny('film')).length, 1);
    assert.equal((await S.sceny('inny')).length, 0);
    await assert.rejects(S.scena('../x'), /Złe id/);
    await S.usun(s.id);
    assert.equal((await S.sceny()).length, 0);
});

test('PRAWDZIWA scena: tło-obraz i tło-klip (ujęcie–przeciwujęcie), głos ze schowka przy ponownym nagraniu, plik w montażach', { skip: !czcionka && 'brak czcionki z polskimi znakami' }, async () => {
    const tmp = tmpDir('ff');
    const projekt = path.join(tmp, 'film');
    fs.mkdirSync(path.join(projekt, 'ujecia'), { recursive: true });
    const obraz = path.join(projekt, 'ujecia', 'dach.png');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=960x540:duration=1', '-frames:v', '1', obraz]);
    const klip = path.join(projekt, 'ujecia', 'lot.mp4');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:duration=1:rate=25', '-pix_fmt', 'yuv420p', klip]);
    const glosWav = path.join(tmp, 'glos.wav');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-ar', '22050', '-ac', '1', glosWav]);
    const montaz = path.join(projekt, 'montaz');
    fs.mkdirSync(montaz);
    const glosy = [];
    const S = utworzSceny({
        katalog: path.join(tmp, 'sceny'), aktorzy: async () => [KAEL, ELARA], katalogProjektu: async () => projekt, ffmpeg: ffmpegPath, opisz,
        katalogMontazy: async (p) => { assert.equal(p, 'film'); return montaz; },
        chat: async () => ({ tekst: DIALOG }),
        mow: async ({ tekst, glos }) => { glosy.push({ tekst, glos }); return { audio: fs.readFileSync(glosWav), ext: 'wav' }; },
    });
    const s = await S.przygotuj({ projekt: 'film', postacie: ['kael', 'elara'], opis: 'Dach przed burzą', tla: [obraz, klip], karty: true, imiona: true });
    await S.nagraj(s.id);
    await assert.rejects(S.nagraj(s.id), /już się nagrywa/);
    const g = await czekaj(async () => { const x = await S.scena(s.id); return x.etap !== 'nagrywa' && x; });
    assert.equal(g.etap, 'gotowa', g.blad);
    assert.equal(path.dirname(g.plik), montaz);
    assert.match(path.basename(g.plik), /^scena_dach-przed-burza_[a-z0-9]+\.mp4$/);
    assert.deepEqual(glosy.map((v) => v.glos?.profil ?? null), ['kael-glos', null, 'kael-glos', null], 'każdy swoim głosem');
    const o = await opisz(g.plik);
    assert.equal(o.szerokosc, 1280); assert.equal(o.wysokosc, 720); assert.ok(o.maAudio);
    assert.ok(o.sekundy > 4.5 && o.sekundy < 7, `scena ${o.sekundy} s (4 × ~1,35 s)`);
    assert.ok(!fs.existsSync(path.join(tmp, 'sceny', s.id, 'praca')), 'katalog roboczy sprzątnięty');
    assert.equal(await S.plik(s.id, 'tlo', 1), klip);
    await assert.rejects(S.plik(s.id, 'tlo', 9), /Nie ma takiego pliku/);

    // ponowne nagranie (np. po zmianie tła) — głosy ze schowka sceny, zero nowych syntez
    await S.zmien(s.id, { tla: [klip] });
    await S.nagraj(s.id);
    const g2 = await czekaj(async () => { const x = await S.scena(s.id); return x.etap !== 'nagrywa' && x; });
    assert.equal(g2.etap, 'gotowa', g2.blad);
    assert.equal(glosy.length, 4, 'cztery kwestie ze schowka');

    // bez głosu: same napisy, bez syntezy
    const b = await S.przygotuj({ projekt: 'film', postacie: ['kael', 'elara'], opis: 'Cisza w hangarze', tla: [obraz] });
    await S.nagraj(b.id, { bezGlosu: true });
    const g3 = await czekaj(async () => { const x = await S.scena(b.id); return x.etap !== 'nagrywa' && x; });
    assert.equal(g3.etap, 'gotowa', g3.blad);
    assert.equal(glosy.length, 4);
});
