/** Podcast Twin: wiedza o Katedrze w prompcie, eksport rozmowy do .txt, tury z błędem mostu poza rozmową. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSync } from 'esbuild';

// Serwis jest w TypeScript — esbuild składa go do jednego pliku ESM na czas testu.
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-')), 'serwis.mjs');
buildSync({ entryPoints: [new URL('../src/services/NotebookPodcastService.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' });
const P = await import(out);

// Pierwsze tury z rozmowy Suwerena (2026-09-27) — tura z błędem zapisana starą wersją (bez pola `blad`).
const TURY = [
    { hostA: 'Hmm, rdzeń milczy (Ollama niedostępna: TIMEOUT — Ollama milczy >120s.). Spróbujmy za chwilę?', hostB: 'Most Wiesława śpi. Suweren wie co robić — odpalić wiesio-bridge.js. :)', triggerAnimation: 'BOTH' },
    { hostA: 'Czy to ma być coś filmowego, czy grywalnego?', hostB: 'Może RPG-fashion, gdzie moda jest mechaniką gry?', triggerAnimation: 'BOTH' },
    { hostA: 'Mobile czy PC?', hostB: '', triggerAnimation: 'A_SPEAKING' },
];

test('eksport .txt: temat Suwerena, Iskra i Echo po kolei, bez tury z błędem mostu', () => {
    const t = P.rozmowaDoTekstu('  Nowa marka… moda, gra  ', TURY);
    assert.equal(t, [
        'Suweren: "Nowa marka… moda, gra"',
        '',
        '🔥 ISKRA: Czy to ma być coś filmowego, czy grywalnego?',
        '🌊 ECHO: Może RPG-fashion, gdzie moda jest mechaniką gry?',
        '🔥 ISKRA: Mobile czy PC?',
        '',
    ].join('\n'));
    assert.ok(!t.includes('rdzeń milczy'));
});

test('błąd mostu: rozpoznany po polu `blad` i po starym tekście', () => {
    assert.equal(P.czyBlad(TURY[0]), true);
    assert.equal(P.czyBlad({ hostA: 'coś', hostB: 'coś', triggerAnimation: 'BOTH', blad: true }), true);
    assert.equal(P.czyBlad(TURY[1]), false);
});

test('prompt: gospodarze znają GRV i Marketplace, nie proponują DAO/tokenów/NFT', () => {
    const s = P.NotebookPodcastService.buildSystemPrompt();
    assert.match(s, /GRV — własna waluta Katedry/);
    assert.match(s, /przelew 100% ceny do twórcy/);
    assert.match(s, /top 10 na moduł/);
    assert.match(s, /Nie proponuj DAO, tokenów zarządczych, NFT ani „mintowania"/);
    assert.ok(s.startsWith(P.SOVEREIGN_WELCOME), 'powitanie Suwerena zostaje pierwszą linią');
});

test('kolejna tura: tura z błędem nie trafia do kontekstu modelu; błąd mostu daje turę z `blad`', async () => {
    const wyslane = [];
    globalThis.fetch = async (_url, opcje) => {
        wyslane.push(JSON.parse(opcje.body));
        const sse = `data: ${JSON.stringify({ type: 'text', text: '{"hostA":"A","hostB":"B","triggerAnimation":"BOTH"}' })}\n\n`;
        return new Response(sse, { status: 200 });
    };
    const s = new P.NotebookPodcastService();
    const tura = await s.generateTurn('Forge Fashion', TURY);
    assert.deepEqual({ a: tura.hostA, b: tura.hostB, blad: tura.blad }, { a: 'A', b: 'B', blad: undefined });
    const prompt = wyslane[0].messages[0].content;
    assert.ok(!prompt.includes('rdzeń milczy'), 'tura z błędem nie jest „dotychczasową rozmową"');
    assert.match(prompt, /RPG-fashion/);

    globalThis.fetch = async () => { throw new Error('TIMEOUT'); };
    const zla = await s.generateTurn('Forge Fashion', TURY);
    assert.equal(zla.blad, true);
    assert.match(zla.hostA, /rdzeń milczy \(TIMEOUT\)/);
});
