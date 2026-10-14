// 🧠 Mapa AGI: każdy węzeł z sondy prawdziwego modułu i z powodem; pad sondy = „nie wiadomo”, nic nie „oddycha” z zegara.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utworzMapeAgi, stanZSilnikow, oczyscWezel } from '../services/MapaAgi.js';
import AGI from '../lib/agi.local.ts';

test('stanZSilnikow: gotowy → online, tylko „nie wiadomo” → idle, nic → offline z powodem', () => {
    const s = [
        { rodzaj: 'obraz', nazwa: 'FLUX.2', gotowy: false, nieWiadomo: true, powod: 'ComfyUI śpi' },
        { rodzaj: 'glos', nazwa: 'Chatterbox', gotowy: true, nieWiadomo: false, powod: 'gotowy' },
        { rodzaj: 'usta', nazwa: 'MuseTalk', gotowy: false, nieWiadomo: false, powod: 'nie zainstalowany' },
    ];
    assert.equal(stanZSilnikow(s, 'glos').status, 'online');
    assert.deepEqual(stanZSilnikow(s, 'obraz'), { status: 'idle', load: 0, powod: 'FLUX.2: ComfyUI śpi' });
    assert.equal(stanZSilnikow(s, 'usta').status, 'offline');
    assert.match(stanZSilnikow(s, 'usta').powod, /nie zainstalowany/);
    assert.equal(stanZSilnikow(s, 'wideo').status, 'offline');
    assert.deepEqual(oczyscWezel({ status: 'cos', load: 7 }), { status: 'idle', load: 1, powod: 'nie wiadomo' });
});

test('mapa: sondy dostają bazę silników ze schowka, pad i zwłoka = idle z powodem', async () => {
    let wywolan = 0;
    const M = utworzMapeAgi({
        limitMs: 50,
        silniki: async () => { wywolan++; return { silniki: [{ rodzaj: 'glos', nazwa: 'X', gotowy: true }] }; },
        sondy: {
            glos: ({ silniki }) => stanZSilnikow(silniki, 'glos'),
            pada: () => { throw new Error('brak modułu'); },
            wolna: () => new Promise((r) => setTimeout(() => r({ status: 'online' }), 500)),
        },
    });
    const a = await M.stan();
    assert.equal(a.glos.status, 'online');
    assert.equal(a.pada.status, 'idle'); assert.match(a.pada.powod, /brak modułu/);
    assert.equal(a.wolna.status, 'idle'); assert.match(a.wolna.powod, /nie odpowiedziała/);
    await M.stan();
    assert.equal(wywolan, 1, 'baza silników ze schowka');
});

test('mapa: przeterminowana baza silników odpowiada od razu (odświeżanie w tle), równoległe pytania = jeden przebieg', async () => {
    let t = 0, wywolan = 0, sond = 0, puscic;
    const M = utworzMapeAgi({
        ttlSilnikowMs: 1000, teraz: () => t,
        silniki: async () => { wywolan++; if (wywolan === 2) await new Promise((r) => { puscic = r; }); return { silniki: [{ rodzaj: 'glos', nazwa: `v${wywolan}`, gotowy: true }] }; },
        sondy: { glos: ({ silniki }) => { sond++; return { status: 'online', powod: silniki[0].nazwa }; } },
    });
    assert.equal((await M.stan()).glos.powod, 'v1');
    t = 5000;   // schowek przeterminowany, sonda silników „wisi”
    const [a, b] = await Promise.all([M.stan(), M.stan()]);
    assert.equal(a.glos.powod, 'v1', 'stara baza od razu, bez czekania na sondy silników');
    assert.equal(a, b);
    assert.equal(sond, 2, 'dwa równoległe pytania = jeden przebieg sond');
    puscic(); await new Promise((r) => setImmediate(r));
    assert.equal((await M.stan()).glos.powod, 'v2', 'odświeżona baza przy następnym pytaniu');
});

test('manifest: krawędzie łączą istniejące węzły, bez dawnych atrap', () => {
    const ids = new Set(AGI.nodes.map((n) => n.id));
    assert.equal(ids.size, AGI.nodes.length);
    for (const e of AGI.edges) assert.ok(ids.has(e.from) && ids.has(e.to), `${e.from}→${e.to}`);
    for (const stary of ['kronos', 'ted', 'quantum', 'koom', 'video']) assert.ok(!ids.has(stary), stary);
});
