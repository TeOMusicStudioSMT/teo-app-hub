// 🏷️ Zwiadowca promocji — tylko znaleziska ze źródłem z wyników wyszukiwania (atrapa API Claude, bez kosztów).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzZwiadowcePromocji, sprawdzZnaleziska, zrodlaZOdpowiedzi, wylowJson } from '../services/ZwiadowcaPromocji.js';

const JSON_MODELU = {
    znalezione: [
        { rodzaj: 'kod', kod: 'KOD20', opis: '20% na pierwszy miesiąc', rabat: '20%', zrodlo: 'https://kupony.example/meshy?ref=1', pewnosc: 'agregator' },
        { rodzaj: 'program', kod: null, opis: 'Program edukacyjny', zrodlo: 'https://www.meshy.ai/edu/', pewnosc: 'oficjalne' },
        { rodzaj: 'kod', kod: 'ZMYSLONY', opis: 'z sufitu', zrodlo: 'https://nigdzie.example/x', pewnosc: 'forum' },
    ],
    podsumowanie: 'Są dwie zniżki.',
};
const ODPOWIEDZ = (stop = 'end_turn') => ({
    stop_reason: stop,
    usage: { input_tokens: 1000, output_tokens: 300, server_tool_use: { web_search_requests: 2 } },
    content: [
        { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'meshy coupon' } },
        { type: 'web_search_tool_result', tool_use_id: 's1', content: [
            { type: 'web_search_result', url: 'https://kupony.example/meshy', title: 'Kupony Meshy', page_age: 'October 1, 2026' },
            { type: 'web_search_result', url: 'https://www.meshy.ai/edu', title: 'Meshy for Education' },
        ] },
        { type: 'text', text: 'Szukam… ', citations: [{ type: 'web_search_result_location', url: 'https://www.meshy.ai/edu', title: 'Meshy for Education', cited_text: 'x' }] },
        { type: 'text', text: JSON.stringify(JSON_MODELU) },
    ],
});

test('źródło musi być w wynikach wyszukiwania; oficjalne pierwsze; adres bez ?/#/ukośnika', () => {
    const zr = zrodlaZOdpowiedzi(ODPOWIEDZ().content);
    assert.equal(zr.size, 2);
    const { przyjete, odrzucone } = sprawdzZnaleziska(JSON_MODELU, zr);
    assert.deepEqual(przyjete.map((z) => z.pewnosc), ['oficjalne', 'agregator']);
    assert.equal(przyjete[1].wiekStrony, 'October 1, 2026');
    assert.equal(odrzucone[0].kod, 'ZMYSLONY');
    assert.match(odrzucone[0].powod, /możliwe zmyślenie/);
    assert.equal(wylowJson('tekst {"x":1} i potem {"znalezione":[],"podsumowanie":"a"} koniec').podsumowanie, 'a');
    assert.equal(wylowJson('bez listy'), null);
});

test('szukaj: klucz, narzędzie web_search, pause_turn, zapis, koszt; bez klucza błąd wprost', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'promocje-'));
    try {
        const bez = utworzZwiadowcePromocji({ klucz: async () => null, katalog: kat, fetch: async () => { throw new Error('nie wołać'); } });
        await assert.rejects(bez.szukaj('Meshy'), /nie ma klucza Anthropic/);
        const wolania = [];
        const odp = [ODPOWIEDZ('pause_turn'), { stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, content: [] }];
        const f = async (url, o) => { wolania.push({ url, o, cialo: JSON.parse(o.body) }); const d = odp[(wolania.length - 1) % 2]; return { ok: true, json: async () => d }; };
        const szyna = { wpisy: [], nadaj: async (w) => szyna.wpisy.push(w) };
        const Z = utworzZwiadowcePromocji({ klucz: async () => 'sk-ant-test', katalog: kat, fetch: f, szyna });
        await assert.rejects(Z.szukaj(' '), /Podaj usługę/);
        const w = await Z.szukaj('Meshy');
        assert.equal(wolania.length, 2, 'pause_turn = drugie wywołanie');
        assert.equal(wolania[0].o.headers['x-api-key'], 'sk-ant-test');
        assert.equal(wolania[0].cialo.tools[0].type, 'web_search_20250305');
        assert.equal(wolania[1].cialo.messages.at(-1).role, 'assistant');
        assert.equal(w.znalezione.length, 2);
        assert.equal(w.odrzucone.length, 1);
        assert.deepEqual(w.koszt, { wyszukan: 2, tokenyWe: 1010, tokenyWy: 305, usdWyszukiwania: 0.02 });
        assert.match(szyna.wpisy[0].tresc, /Meshy: 2 zniżek.*KOD20.*1 odrzucone/);
        assert.equal((await Z.lista())[0].usluga, 'Meshy');
        await Z.szukaj('meshy');
        assert.equal((await Z.lista()).length, 1, 'ta sama usługa nadpisuje');
        const zly = utworzZwiadowcePromocji({ klucz: async () => 'k', katalog: kat, fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) }) });
        await assert.rejects(zly.szukaj('Meshy'), /HTTP 401: invalid x-api-key/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
