// 🎯 Modele do zadań: wybór z faktów Ollamy (zdolności, rozmiar), ręczny tylko gdy model umie zadanie, dziennik użyć
// z oceną Jev, po ≥ 5 użyciach wybór z danych. Atrapa Ollamy i Jev, prawdziwy dysk tymczasowy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzModeleZadan, rankingZFaktow, statystyki, MIN_PROB } from '../services/ModeleZadan.js';

const OLLAMA = [
    { name: 'gemma4:12B', size: 7.6e9, capabilities: ['completion', 'vision'] },
    { name: 'ornith-1.5:9b', size: 6.6e9, capabilities: ['completion', 'vision'] },
    { name: 'gemma4:e2b', size: 7.2e9, capabilities: ['completion', 'vision'] },
    { name: 'gemma4:31b-cloud', size: 1, capabilities: ['completion', 'vision'] },
    { name: 'llamacpp:9aca', size: 9.6e9, capabilities: ['completion', 'vision'] },
    { name: 'mistral:latest', size: 4.4e9, capabilities: ['completion', 'tools'] },
];
const atrapaOllamy = async (url, o = {}) => {
    if (url.endsWith('/api/tags')) return { json: async () => ({ models: OLLAMA.map(({ name, size }) => ({ name, size })) }) };
    if (url.endsWith('/api/show')) { const m = OLLAMA.find((x) => x.name === JSON.parse(o.body).model); return { json: async () => ({ capabilities: m?.capabilities ?? [] }) }; }
    throw new Error(url);
};

test('ranking z faktów: tylko widzące, lokalne, bez llamacpp; najbliżej 8 GB; statystyki', () => {
    const r = rankingZFaktow('oczy', OLLAMA);
    assert.deepEqual(r.map((x) => x.model), ['gemma4:12B', 'ornith-1.5:9b', 'gemma4:e2b']);
    const s = statystyki([{ model: 'a', ok: true, ocena: 0.9, ms: 100 }, { model: 'a', ok: false, ms: 300 }, { model: 'b', ok: true, ocena: 0.4, ms: 50 }]);
    assert.deepEqual(s.map((x) => [x.model, x.prob, x.skutecznosc, x.sredniaJev]), [['a', 2, 0.5, 0.9], ['b', 1, 1, 0.4]]);
});

test('dla / ustaw / notuj: fakty → ręczny (tylko widzący) → dane z oceną Jev', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'mz-'));
    try {
        let pytan = 0;
        const jev = { stan: () => ({ maKlucz: true }), zapytaj: async (q) => { pytan++; assert.match(q.questions.jakosc.instructions, /POWIERZCHNI/); return { answers: { jakosc: { noul: q.state.wynik_modelu.includes('dobry') ? 0.9 : 0.2 } } }; } };
        const M = utworzModeleZadan({ katalog: kat, ollama: 'http://o', jev, fetch: atrapaOllamy });
        assert.deepEqual([(await M.dla('oczy')).model, (await M.dla('oczy')).zrodlo], ['gemma4:12B', 'fakty']);
        await assert.rejects(M.ustaw('oczy', 'mistral:latest'), /nie umie: vision/);
        await assert.rejects(M.ustaw('oczy', 'qwen3.5:9b'), /Ollama nie ma modelu/);
        assert.equal((await M.ustaw('oczy', 'ornith-1.5:9b')).zrodlo, 'reczny');
        await M.ustaw('oczy', null);
        // dane: gemma4:e2b dobra, gemma4:12B słaba — po MIN_PROB użyciach wybór z danych
        for (let i = 0; i < MIN_PROB; i++) {
            await M.notuj('oczy', { model: 'gemma4:e2b', ok: true, ms: 900, wynik: 'dobry opis futra' });
            await M.notuj('oczy', { model: 'gemma4:12B', ok: i % 2 === 0, ms: 700, wynik: 'kamera i tło' });
        }
        assert.equal(pytan, MIN_PROB + Math.ceil(MIN_PROB / 2), 'Jev ocenia tylko udane wyniki');
        const d = await M.dla('oczy');
        assert.deepEqual([d.model, d.zrodlo], ['gemma4:e2b', 'dane']);
        const p = await M.przeglad();
        assert.equal(p.zadania.oczy.uzyc, MIN_PROB * 2);
        assert.equal(p.zadania.oczy.statystyki[0].sredniaJev, 0.9);
        assert.deepEqual(JSON.parse(await fs.readFile(path.join(kat, 'modele-zadan.json'), 'utf8')).dziennik.oczy.length, MIN_PROB * 2);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
