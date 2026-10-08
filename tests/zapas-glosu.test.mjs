// 🛟 Zapas głosu: padnięty profil VoiceStudio → ten sam głos klonem Katedry (Suweren 2026-10-08).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { probkaZapasowa, nazwaPliku } from '../services/ZapasGlosu.js';

async function katalogi() {
    const baza = await fs.mkdtemp(path.join(os.tmpdir(), 'zapas-glosu-'));
    const katalogGlosow = path.join(baza, 'voices'), katalogVS = path.join(baza, 'OmniVoice', 'voices');
    await fs.mkdir(katalogGlosow, { recursive: true }); await fs.mkdir(katalogVS, { recursive: true });
    return { katalogGlosow, katalogVS };
}

test('nazwa pliku jak w Samplerze: „TeO G.” → teo-g, polskie znaki bez ogonków', () => {
    assert.equal(nazwaPliku('TeO G.'), 'teo-g');
    assert.equal(nazwaPliku('Kira „Vapor” Chen'), 'kira-vapor-chen');
    assert.equal(nazwaPliku('Żółć Łoś'), 'zolc-los');
});

test('1) próbka Katedry o nazwie profilu wygrywa — bez kopiowania z VoiceStudio', async () => {
    const k = await katalogi();
    await fs.writeFile(path.join(k.katalogGlosow, 'teo-g.wav'), 'katedra');
    await fs.writeFile(path.join(k.katalogVS, 'abc123.wav'), 'vs');
    const w = await probkaZapasowa('abc123', { ...k, profile: async () => [{ id: 'abc123', name: 'TeO G.', ref_audio_path: 'abc123.wav' }] });
    assert.deepEqual(w, { glos: 'teo-g', probka: path.join(k.katalogGlosow, 'teo-g.wav') });
    assert.equal(await fs.readFile(path.join(k.katalogGlosow, 'vs-abc123.wav'), 'utf8').catch(() => 'brak'), 'brak');
});

test('2) bez próbki Katedry — kopia nagrania referencyjnego VoiceStudio jako vs-<id>.wav, potem z pamięci', async () => {
    const k = await katalogi();
    await fs.writeFile(path.join(k.katalogVS, 'ref-x.wav'), 'glos-vs');
    const w = await probkaZapasowa('p1', { ...k, profile: async () => [{ id: 'p1', name: 'Nowa Postać', ref_audio_path: 'ref-x.wav' }] });
    assert.equal(w.glos, 'vs-p1');
    assert.equal(await fs.readFile(w.probka, 'utf8'), 'glos-vs');
    assert.equal(await fs.readFile(path.join(k.katalogVS, 'ref-x.wav'), 'utf8'), 'glos-vs', 'oryginał zostaje w VoiceStudio');
    // VoiceStudio leży całkiem — i tak mamy zapas z poprzedniego razu
    const w2 = await probkaZapasowa('p1', { ...k, profile: async () => { throw new Error('ECONNREFUSED'); } });
    assert.equal(w2.glos, 'vs-p1');
});

test('3) VoiceStudio nie odpowiada, ale plik <id>.wav jest w jego katalogu — też ratuje', async () => {
    const k = await katalogi();
    await fs.writeFile(path.join(k.katalogVS, 'q9.wav'), 'x');
    const w = await probkaZapasowa('q9', { ...k, profile: async () => { throw new Error('down'); } });
    assert.equal(w.glos, 'vs-q9');
});

test('nic nie ma — null (wołający oddaje oryginalny błąd); ścieżka z zewnątrz nie przechodzi', async () => {
    const k = await katalogi();
    assert.equal(await probkaZapasowa('zzz', { ...k }), null);
    assert.equal(await probkaZapasowa('', { ...k }), null);
    const w = await probkaZapasowa('e1', { ...k, profile: async () => [{ id: 'e1', name: 'Ktoś', ref_audio_path: '../../../Windows/win.ini' }] });
    assert.equal(w, null, 'basename(win.ini) nie jest plikiem audio z katalogu VoiceStudio');
});
