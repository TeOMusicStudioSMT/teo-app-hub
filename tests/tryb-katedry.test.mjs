// ☁️/🏠 Tryb Katedry: jeden przełącznik CLOUD/JusT dla całej Katedry — przechwycenie wywołań Ollamy
// (Suweren 2026-10-08: „rób przełącznik na całą Katedrę”).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { utworzTryb, zainstalujFetch } from '../services/TrybKatedry.js';

const OLLAMA = 'http://127.0.0.1:11434';

/** Atrapa chmury: zapisuje, co dostała; odpowiada jak Claude albo Gemini. */
function atrapaChmury({ pad = false } = {}) {
    const wolania = [];
    const f = async (url, init) => {
        const b = JSON.parse(init.body);
        wolania.push({ url: String(url), b, naglowki: init.headers });
        if (pad) return new Response(JSON.stringify({ error: { message: 'credits depleted' } }), { status: 402 });
        if (String(url).includes('anthropic')) return new Response(JSON.stringify({ content: [{ text: 'z chmury Claude' }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 });
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 } }), { status: 200 });
    };
    return { f, wolania };
}

async function tryb(opcje = {}, klucze = { anthropic: 'sk-ant-x', gemini: null }) {
    const katalog = await fs.mkdtemp(path.join(os.tmpdir(), 'tryb-'));
    const ch = atrapaChmury(opcje);
    const t = utworzTryb({ katalog, klucz: (d) => klucze[d], ollamaBase: OLLAMA, fetch: ch.f });
    return { t, ch, katalog };
}
const post = (b) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

test('domyślnie lokalnie: nic nie przechwytuje', async () => {
    const { t, ch } = await tryb();
    assert.equal(t.stan().tryb, 'lokalnie');
    assert.equal(await t.przechwyc(`${OLLAMA}/api/generate`, post({ model: 'gemma4:e2b', prompt: 'hej', stream: false })), null);
    assert.equal(ch.wolania.length, 0);
    assert.equal(t.modelDla('qwen3.5:9b'), 'qwen3.5:9b');
});

test('CLOUD: /api/generate idzie do Claude i wraca w kształcie Ollamy; tokeny liczone', async () => {
    const { t, ch } = await tryb();
    t.ustaw({ tryb: 'chmura' });
    const r = await t.przechwyc(`${OLLAMA}/api/generate`, post({ model: 'gemma4:e2b', system: 'Kustosz', prompt: 'quest', stream: false, format: 'json' }));
    const d = await r.json();
    assert.equal(d.response, 'z chmury Claude');
    assert.equal(d.done, true);
    assert.match(ch.wolania[0].url, /anthropic/);
    assert.match(ch.wolania[0].b.system, /Kustosz[\s\S]*WYŁĄCZNIE poprawnym obiektem JSON/);
    assert.equal(t.stan().dzis.tokeny, 15);
    assert.equal(t.modelDla('qwen3.5:9b'), 'claude:claude-sonnet-5-5');
});

test('CLOUD: /api/chat strumieniem = NDJSON z wiadomością i done; system wyjęty, role sklejone', async () => {
    const { t, ch } = await tryb();
    t.ustaw({ tryb: 'chmura' });
    const r = await t.przechwyc(`${OLLAMA}/api/chat`, post({ model: 'x', messages: [{ role: 'system', content: 'Bądź Klaudiuszem' }, { role: 'user', content: 'a' }, { role: 'user', content: 'b' }] }));
    const linie = (await r.text()).trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(linie[0].message.content, 'z chmury Claude');
    assert.equal(linie.at(-1).done, true);
    assert.equal(ch.wolania[0].b.system, 'Bądź Klaudiuszem');
    assert.deepEqual(ch.wolania[0].b.messages, [{ role: 'user', content: 'a\n\nb' }]);
});

test('CLOUD z Gemini (brak Claude): format JSON i odpowiedź Gemini', async () => {
    const { t, ch } = await tryb({}, { anthropic: null, gemini: 'AIza' + 'x'.repeat(35) });
    t.ustaw({ tryb: 'chmura' });
    const d = await (await t.przechwyc(`${OLLAMA}/api/generate`, post({ prompt: 'p', stream: false, format: 'json' }))).json();
    assert.equal(d.response, '{"ok":true}');
    assert.match(ch.wolania[0].url, /generativelanguage/);
    assert.equal(ch.wolania[0].b.generationConfig.responseMimeType, 'application/json');
    assert.equal(t.modelDla('m'), 'gemini:gemini-3.8-flash');
});

test('uczciwie lokalnie: obrazy, narzędzia, rozgrzewka i inne trasy Ollamy', async () => {
    const { t, ch } = await tryb();
    t.ustaw({ tryb: 'chmura' });
    assert.equal(await t.przechwyc(`${OLLAMA}/api/generate`, post({ prompt: 'co widzisz', images: ['abc'] })), null);
    assert.equal(await t.przechwyc(`${OLLAMA}/api/chat`, post({ messages: [{ role: 'user', content: 'x' }], tools: [{}] })), null);
    assert.equal(await t.przechwyc(`${OLLAMA}/api/generate`, post({ model: 'm', keep_alive: 0 })), null);
    assert.equal(await t.przechwyc(`${OLLAMA}/api/embed`, post({ input: 'x' })), null);
    assert.equal(await t.przechwyc('https://example.com/api/generate', post({ prompt: 'x' })), null);
    assert.equal(ch.wolania.length, 0);
});

test('bez klucza, po limicie i przy błędzie chmury — lokalnie z powodem', async () => {
    const bezKlucza = await tryb({}, { anthropic: null, gemini: null });
    bezKlucza.t.ustaw({ tryb: 'chmura' });
    assert.equal(await bezKlucza.t.przechwyc(`${OLLAMA}/api/generate`, post({ prompt: 'x' })), null);
    assert.match(bezKlucza.t.stan().powod, /nie ma klucza/);

    const limit = await tryb();
    limit.t.ustaw({ tryb: 'chmura', limitTokenow: 10 });
    await limit.t.przechwyc(`${OLLAMA}/api/generate`, post({ prompt: 'x', stream: false }));
    assert.equal(await limit.t.przechwyc(`${OLLAMA}/api/generate`, post({ prompt: 'y' })), null, 'limit 10 przekroczony po 15 tokenach');
    assert.match(limit.t.stan().powod, /limit/);

    const pad = await tryb({ pad: true });
    pad.t.ustaw({ tryb: 'chmura' });
    assert.equal(await pad.t.przechwyc(`${OLLAMA}/api/generate`, post({ prompt: 'x' })), null);
    assert.match(pad.t.stan().ostatniBlad.tekst, /402/);
});

test('zainstalujFetch: przechwycone idzie do chmury, reszta do prawdziwego fetch', async () => {
    const { t } = await tryb();
    t.ustaw({ tryb: 'chmura' });
    const prawdziwy = globalThis.fetch;
    let doOryginalu = 0;
    globalThis.fetch = async () => { doOryginalu++; return new Response('lokalnie'); };
    try {
        zainstalujFetch(t);
        const a = await (await fetch(`${OLLAMA}/api/generate`, post({ prompt: 'x', stream: false }))).json();
        assert.equal(a.response, 'z chmury Claude');
        assert.equal(await (await fetch(`${OLLAMA}/api/tags`)).text(), 'lokalnie');
        assert.equal(doOryginalu, 1);
    } finally { globalThis.fetch = prawdziwy; }
});

test('ustaw: zły tryb/dostawca = błąd; stan przetrwa nowy obiekt (plik)', async () => {
    const { t, katalog } = await tryb();
    assert.throws(() => t.ustaw({ tryb: 'kosmos' }), /lokalnie albo chmura/);
    assert.throws(() => t.ustaw({ dostawca: 'openai' }), /auto, anthropic albo gemini/);
    t.ustaw({ tryb: 'chmura', model: 'claude:claude-opus-5-5', dostawca: 'anthropic' });
    await new Promise((r) => setTimeout(r, 700));
    const t2 = utworzTryb({ katalog, klucz: () => 'sk-ant-x', ollamaBase: OLLAMA, fetch: async () => new Response('{}') });
    assert.equal(t2.stan().tryb, 'chmura');
    assert.equal(t2.modelDla('m'), 'claude:claude-opus-5-5');
});
