// 🎵🔌 Suno MCP w moście — atrapa Suno (odkrycie OAuth, rejestracja, PKCE, tokeny, MCP) + prawdziwe trasy Expressa.
// Atrapa Suno NIE idzie przez sieć (wstrzyknięty fetch): na maszynie Suwerena Avast (aswMonFltProxy) rozpoznaje ruch MCP
// po HTTP/1.1 i psuje odpowiedzi („Invalid character in chunk size”). Prawdziwe Suno most woła przez HTTP/2 (fetchH2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzSunoMcp, zamontujTrasySuno, odczytajOdpowiedz, utworyZWyniku, wymagaZgody, nazwaPliku } from '../services/SunoMcp.js';

const sluchaj = (app) => new Promise((r) => { const s = http.createServer(app).listen(0, '127.0.0.1', () => r(s)); });
const BAZA = 'https://suno.atrapa';

/** Atrapa Suno jako fetch: (adres, opcje) → Response. */
function atrapaSuno() {
    const st = { klienci: {}, kody: {}, wywolania: [], odswiezen: 0 };
    const odp = (status, cialo, naglowki = {}) => new Response(status === 202 || status === 302 ? null : typeof cialo === 'string' ? cialo : JSON.stringify(cialo), { status, headers: { 'Content-Type': 'application/json', ...naglowki } });
    async function fetchAtrapa(adres, o = {}) {
        const u = new URL(adres);
        const metoda = o.method ?? 'GET';
        const h = Object.fromEntries(Object.entries(o.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
        const forma = () => Object.fromEntries(new URLSearchParams(String(o.body)));
        const p = u.pathname;
        if (p === '/.well-known/oauth-protected-resource/mcp') return odp(200, { authorization_servers: [`${BAZA}/oauth`], resource: BAZA });
        if (p === '/.well-known/oauth-authorization-server/oauth') return odp(200, { issuer: `${BAZA}/oauth`, authorization_endpoint: `${BAZA}/oauth/authorize/`, token_endpoint: `${BAZA}/oauth/token/`, registration_endpoint: `${BAZA}/oauth/register/`, revocation_endpoint: `${BAZA}/oauth/revoke/` });
        if (p === '/oauth/register/') { const id = `kl-${Object.keys(st.klienci).length + 1}`; st.klienci[id] = JSON.parse(o.body); return odp(200, { client_id: id }); }
        if (p === '/oauth/authorize/') { const q = u.searchParams; const code = crypto.randomUUID(); st.kody[code] = { wyzwanie: q.get('code_challenge'), zwrot: q.get('redirect_uri') }; return odp(302, '', { Location: `${q.get('redirect_uri')}?code=${code}&state=${q.get('state')}` }); }
        if (p === '/oauth/token/') {
            const b = forma();
            if (b.grant_type === 'refresh_token') { st.odswiezen++; return b.refresh_token === 'rt-1' ? odp(200, { access_token: 'at-2', expires_in: 3600 }) : odp(400, { error: 'invalid_grant' }); }
            const k = st.kody[b.code];
            const ok = k && crypto.createHash('sha256').update(b.code_verifier).digest('base64url') === k.wyzwanie && k.zwrot === b.redirect_uri;
            return ok ? odp(200, { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600 }) : odp(400, { error: 'invalid_grant' });
        }
        if (p === '/oauth/revoke/') return odp(200, {});
        if (p === '/audio/abcd1234.mp3') return new Response(Buffer.alloc(20_000, 7), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
        if (p === '/mcp' && metoda === 'POST') {
            if (!/^Bearer at-/.test(h.authorization ?? '')) return odp(401, { error: 'sign in' });
            const m = JSON.parse(o.body);
            if (m.id === undefined) return odp(202, '');
            st.wywolania.push(m.method);
            const wynik = m.method === 'initialize' ? { protocolVersion: '2025-06-18', serverInfo: { name: 'suno', version: '1' }, capabilities: { tools: {} } }
                : m.method === 'tools/list' ? { tools: [
                    { name: 'get_credits', description: 'Credits left', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
                    { name: 'create_song', description: 'Create a song', inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } } },
                ] }
                : m.method === 'tools/call' && m.params.name === 'get_credits' ? { content: [{ type: 'text', text: JSON.stringify({ credits: 2500 }) }] }
                : { content: [{ type: 'text', text: 'Created.' }], structuredContent: { clips: [{ id: 'abcd1234-ffff', title: 'Diabełek Groove', audio_url: `${BAZA}/audio/abcd1234.mp3` }] } };
            // serwer Suno odpowiada SSE — sprawdzamy ten tor
            return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: m.id, result: wynik })}\n\n`, { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Mcp-Session-Id': 'sesja-1' } });
        }
        return odp(404, { error: 'nie ma' });
    }
    return { st, fetchAtrapa };
}

test('czyste pomocnicze: SSE, utwory, zgoda, nazwa pliku', () => {
    assert.deepEqual(odczytajOdpowiedz('event: message\ndata: {"jsonrpc":"2.0","id":3,"result":{"a":1}}\n\n', 'text/event-stream', 3).result, { a: 1 });
    assert.equal(odczytajOdpowiedz('{"jsonrpc":"2.0","id":4,"result":{}}', 'application/json', 4).id, 4);
    assert.equal(wymagaZgody({ annotations: { readOnlyHint: true } }), false);
    assert.equal(wymagaZgody({}), true);
    const u = utworyZWyniku({ content: [{ type: 'text', text: JSON.stringify({ songs: [{ id: 'x1', title: 'A/B', audio_url: 'https://cdn1.suno.ai/x1.mp3' }, { id: 'x2', title: 'no audio' }] }) }] });
    assert.deepEqual(u.map((x) => x.id), ['x1']);
    assert.equal(nazwaPliku(u[0]), 'AB [x1].mp3');
});

test('Suno MCP: połączenie OAuth (PKCE) → narzędzia → zgoda na kredyty → utwór w bibliotece → rozłączenie', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'suno-mcp-'));
    const a = atrapaSuno();
    const skarb = {};
    const most = express(); most.use(express.json());
    const sMost = await sluchaj(most);
    const adresMostu = `http://127.0.0.1:${sMost.address().port}`;
    const S = utworzSunoMcp({ katalog: tmp, katalogMuzyki: path.join(tmp, 'muzyka'), adresMostu, adresMcp: `${BAZA}/mcp`, fetch: a.fetchAtrapa,
        skarbiec: { czytaj: async (u, p) => skarb[`${u}.${p}`] ?? null, zapisz: async (u, p, v) => { skarb[`${u}.${p}`] = v; }, usun: async (u, p) => { delete skarb[`${u}.${p}`]; } } });
    zamontujTrasySuno(most, S);
    const post = (sciezka, cialo) => fetch(`${adresMostu}${sciezka}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cialo ?? {}) });
    try {
        let r = await (await fetch(`${adresMostu}/api/suno/stan`)).json();
        assert.equal(r.suno.polaczone, false);
        // przeglądarka: /polacz → Suno authorize → powrót do mostu
        const doSuno = (await fetch(`${adresMostu}/api/suno/polacz`, { redirect: 'manual' })).headers.get('location');
        assert.match(doSuno, /code_challenge_method=S256/);
        assert.equal(a.st.klienci['kl-1'].token_endpoint_auth_method, 'none');
        assert.deepEqual(a.st.klienci['kl-1'].redirect_uris, [`${adresMostu}/api/suno/zwrot`]);
        const powrot = (await a.fetchAtrapa(doSuno)).headers.get('location');
        assert.ok(powrot.startsWith(`${adresMostu}/api/suno/zwrot?`));
        assert.match(await (await fetch(powrot)).text(), /Suno połączone/);
        assert.equal(skarb['suno.refresh_token'], 'rt-1');
        assert.equal((await fetch(powrot)).status, 400, 'ten sam state drugi raz — odmowa');

        r = await (await fetch(`${adresMostu}/api/suno/stan`)).json();
        assert.equal(r.suno.polaczone, true);
        assert.deepEqual(r.suno.narzedzia.map((n) => [n.nazwa, n.zgoda]), [['get_credits', false], ['create_song', true]]);

        r = await (await post('/api/suno/wywolaj', { narzedzie: 'get_credits' })).json();
        assert.match(r.wynik.content[0].text, /2500/);
        // płatne bez zgody → 403, Suno nie dostaje wywołania
        const przed = a.st.wywolania.length;
        assert.equal((await post('/api/suno/wywolaj', { narzedzie: 'create_song', argumenty: { prompt: 'x' } })).status, 403);
        assert.equal(a.st.wywolania.length, przed);
        r = await (await post('/api/suno/wywolaj', { narzedzie: 'create_song', argumenty: { prompt: 'x' }, zgoda: true })).json();
        assert.equal(r.utwory[0].plik, 'Suno MCP/Diabełek Groove [abcd1234].mp3');
        assert.equal((await fs.stat(path.join(tmp, 'muzyka', 'Suno MCP', 'Diabełek Groove [abcd1234].mp3'))).size, 20_000);
        r = await (await post('/api/suno/wywolaj', { narzedzie: 'create_song', argumenty: {}, zgoda: true })).json();
        assert.equal(r.utwory[0].nowy, false, 'ten sam utwór drugi raz — bez pobierania');

        r = await (await post('/api/suno/rozlacz')).json();
        assert.equal(r.suno.polaczone, false);
        assert.equal(skarb['suno.refresh_token'], undefined);
        assert.equal((await post('/api/suno/wywolaj', { narzedzie: 'get_credits' })).status, 409);
    } finally { sMost.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});
