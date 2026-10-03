// 🎙️ Głos ze stemu: rozpoznanie wokalu/instrumentalu, lista paczek, PRAWDZIWE wycięcie próbki klonu i podkład pod wywiadem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { listaStemow, glosZeStemu, argumentyProbki, argumentyPodkladu, czyWokal, czyInstrumental, MIN_SEKUND } from '../services/GlosZeStemu.js';
import { opisz } from '../services/Montazownia.js';

const uruchom = promisify(execFile);
const ff = (...a) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...a]);

test('rozpoznanie stemów: wokal z Suno i Demucsa, instrumental osobno', () => {
    for (const n of ['Track 03 (Lead Vocal).wav', 'Backing Vocals.mp3', 'vocals.wav', 'wokal.flac']) assert.ok(czyWokal(n), n);
    for (const n of ['Drums.wav', 'Instrumental.wav', 'no_vocals.wav', 'bass.wav']) assert.ok(!czyWokal(n), n);
    assert.ok(czyInstrumental('Track 03 (Instrumental).wav') && czyInstrumental('no_vocals.wav'));
    assert.ok(!czyInstrumental('Lead Vocal.wav'));
});

test('lista: paczki w podkatalogach, wokale najpierw, tylko audio', async () => {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'stemy-'));
    fs.mkdirSync(path.join(kat, 'Track 03'));
    for (const n of ['Drums.wav', 'Lead Vocal.wav', 'okladka.png']) fs.writeFileSync(path.join(kat, 'Track 03', n), 'x');
    fs.writeFileSync(path.join(kat, 'vocals.wav'), 'x');
    const l = await listaStemow(kat);
    assert.deepEqual(l.map((s) => s.rel), ['vocals.wav', 'Track 03/Lead Vocal.wav', 'Track 03/Drums.wav']);
    assert.equal(l[1].paczka, 'Track 03');
    assert.deepEqual(await listaStemow(path.join(kat, 'nie-ma')), []);
});

test('argumenty: wycinek od–do, wycięcie ciszy, mono 22 050 Hz; zły zakres = błąd', () => {
    const a = argumentyProbki({ wejscie: 'v.wav', od: 10, do: 40, wyjscie: 'o.wav' });
    assert.deepEqual(a.slice(0, 7), ['-y', '-ss', '10', '-to', '40', '-i', 'v.wav']);
    assert.match(a[a.indexOf('-af') + 1], /silenceremove=.*stop_periods=-1/);
    assert.ok(a.includes('22050') && a.at(-1) === 'o.wav');
    assert.throws(() => argumentyProbki({ wejscie: 'v', od: 5, do: 5, wyjscie: 'o' }), /później/);
    const p = argumentyPodkladu({ film: 'w.mp4', podklad: 'm.wav', wyjscie: 'o.mp4', sekundy: 20, glosnosc: 5 });
    assert.match(p[p.indexOf('-filter_complex') + 1], /volume=0\.6,.*afade=t=out:st=17\.50.*amix=inputs=2:duration=first/);
    assert.ok(p.includes('-stream_loop') && p.includes('copy'));
});

test('PRAWDZIWA próbka: śpiew z przerwami → bez ciszy, mono 22 050 Hz, profil klonu; za krótko = błąd i stara próbka zostaje', async () => {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'glos-'));
    const stem = path.join(kat, 'Lead Vocal.wav');
    // 4 frazy po 2,5 s przedzielone 2 s ciszy (jak wokal między zwrotkami) = 16 s, w tym 10 s głosu
    ff('-f', 'lavfi', '-i', "aevalsrc='if(lt(mod(t,4.5),2.5),0.5*sin(2*PI*220*t),0)':s=44100:d=16", '-ac', '2', stem);
    const glosy = path.join(kat, 'voices');
    const profile = [];
    const zapiszProfil = async (d) => { profile.push(d); return d; };
    const w = await glosZeStemu({ stem, id: 'Kael Głos', nazwa: 'Kael', katalogGlosow: glosy, ffmpeg: ffmpegPath, uruchom, opisz, zapiszProfil });
    assert.equal(w.profil.id, 'kael-glos');
    assert.equal(w.profil.przewod, 'klon-lokalny');
    assert.equal(path.basename(w.probka), 'kael-glos.wav');
    assert.ok(w.sekundy > 9 && w.sekundy < 12.5, `po wycięciu ciszy ${w.sekundy} s`);
    // ffmpeg bez wyjścia kończy się kodem 1, ale opis strumienia jest w stderr
    const opis = await uruchom(ffmpegPath, ['-hide_banner', '-i', w.probka]).catch((e) => e);
    assert.match(String(opis.stderr), /22050 Hz, mono/);

    const przed = fs.statSync(w.probka).size;
    await assert.rejects(glosZeStemu({ stem, od: 0, do: 3, id: 'kael-glos', katalogGlosow: glosy, ffmpeg: ffmpegPath, uruchom, opisz, zapiszProfil }), new RegExp(`co najmniej ${MIN_SEKUND} s`));
    assert.equal(fs.statSync(w.probka).size, przed, 'nieudana próba nie niszczy dobrej próbki');
    assert.deepEqual(fs.readdirSync(glosy), ['kael-glos.wav'], 'bez plików tymczasowych');
    assert.equal(profile.length, 1);
});
