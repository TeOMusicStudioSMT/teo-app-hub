// ☁️ Klucze Kibla dla mostu + listy modeli z konta dostawcy (Suweren 2026-10-06: „w Hubie cloud, a w games nie widzi
// kluczy… i są wpisane nieaktualne modele”).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { utworzKluczeMostu, utworzListyModeli, wybierzClaude, wybierzGemini, ZAPAS } from '../services/ModeleChmury.js';

const KLUCZ_A = 'sk-ant-api03-' + 'x'.repeat(40);
const KLUCZ_G = 'AIza' + 'y'.repeat(35);

test('klucze dla mostu: zły format odrzucony, zapis do pliku czytanego przez most, stan bez klucza, cofnięcie kasuje', async () => {
    const katalog = await fs.mkdtemp(path.join(os.tmpdir(), 'klucze-'));
    const czytaj = (p) => async () => (await fs.readFile(path.join(katalog, p), 'utf8').catch(() => '')).trim() || null;
    const K = utworzKluczeMostu({ katalog, efektywny: { anthropic: czytaj('kibel_anthropic.txt'), gemini: czytaj('kibel_gemini.txt') } });
    await assert.rejects(K.ustaw('anthropic', 'AIza123'), /nie wygląda/);
    await assert.rejects(K.ustaw('openai', KLUCZ_A), /Nieznany dostawca/);
    const w = await K.ustaw('anthropic', `  ${KLUCZ_A}\n`);
    assert.equal(w.koncowka, '…xxxx');
    assert.equal((await fs.readFile(path.join(katalog, 'kibel_anthropic.txt'), 'utf8')).trim(), KLUCZ_A);
    const s = await K.stan();
    assert.deepEqual(s.anthropic, { nazwa: 'Anthropic (Claude)', udostepniony: true, koncowka: '…xxxx', zrodlo: 'kibel' });
    assert.equal(s.gemini.koncowka, null);
    assert.ok(!JSON.stringify(s).includes(KLUCZ_A), 'stan nie niesie klucza');
    assert.deepEqual(await K.usun('anthropic'), { usunieto: true });
    assert.equal((await K.stan()).anthropic.udostepniony, false);
});

test('Claude: od najnowszych z /v1/models, tylko claude-*', () => {
    const d = { data: [{ id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' }, { id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5' }, { id: 'inny' }] };
    assert.deepEqual(wybierzClaude(d), [{ model: 'claude-opus-5-5', nazwa: 'Claude Opus 5.5' }, { model: 'claude-sonnet-5-5', nazwa: 'Claude Sonnet 5.5' }]);
});

test('Gemini: tylko generateContent i tekst, najnowsza wersja pierwsza, stabilna przed preview', () => {
    const m = (name, metody = ['generateContent']) => ({ name: `models/${name}`, displayName: name, supportedGenerationMethods: metody });
    const d = { models: [m('gemini-2.5-flash'), m('gemini-3.1-pro-preview'), m('gemini-3.1-pro'), m('text-embedding-004', ['embedContent']), m('gemini-2.5-flash-image'), m('gemini-2.5-pro'), m('gemini-3.1-flash-lite'), m('gemma-3-27b-it')] };
    assert.deepEqual(wybierzGemini(d).map((x) => x.model), ['gemini-3.1-pro', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-pro']);
});

test('listy: bez klucza zapas; błąd API = zapas z powodem; schowek', async () => {
    let wywolan = 0;
    const f = async (url, o) => { wywolan++; assert.equal(o.headers['x-api-key'], KLUCZ_A); return { ok: true, json: async () => ({ data: [{ id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5' }] }) }; };
    const L = utworzListyModeli({ fetch: f });
    assert.deepEqual(await L('anthropic', null), { modele: ZAPAS.anthropic, zApi: false, blad: null });
    const w = await L('anthropic', KLUCZ_A);
    assert.equal(w.zApi, true); assert.equal(w.modele[0].model, 'claude-sonnet-5-5');
    await L('anthropic', KLUCZ_A);
    assert.equal(wywolan, 1, 'drugie pytanie ze schowka');
    const zly = utworzListyModeli({ fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) }) });
    const b = await zly('gemini', KLUCZ_G);
    assert.equal(b.zApi, false); assert.match(b.blad, /401.*invalid/); assert.deepEqual(b.modele, ZAPAS.gemini);
});
