// 🎵 Album Suno → biblioteka muzyki: link → id, wszystkie strony albumu, publiczny = pobrany, prywatny = rada,
// ręcznie pobrany plik rozpoznany po tytule, drugi przebieg nic nie pobiera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { utworzAlbumSuno, idAlbumuSuno, plikUtworu, bpmZTagow, nazwaPliku } from '../services/AlbumSuno.js';

const A = '246f477a-1229-461f-9361-6b0d3d100f89';
const klip = (id, title, pub, extra = {}) => ({ clip: { id, title, status: 'complete', is_public: pub, audio_url: 'https://studio-api.prod.suno.com/api/forbidden', metadata: { duration: 214.3, tags: 'Gothic Electro Pop, driving 126 BPM' }, ...extra } });

test('link albumu → id; BPM z tagów; plik utworu po id8 albo po tytule', () => {
    assert.equal(idAlbumuSuno(`https://suno.com/album/${A}`), A);
    assert.equal(idAlbumuSuno(`https://suno.com/playlist/${A}?sh=x`), A);
    assert.equal(idAlbumuSuno('https://suno.com/song/abc'), null);
    assert.equal(bpmZTagow('driving 126 BPM four-on-the-floor'), 126);
    const u = { id: '8c39ee7a-e9c7-4deb-ab56-35c2fc780ae3', tytul: 'T1' };
    assert.equal(nazwaPliku(u), 'T1 [8c39ee7a].mp3');
    assert.equal(plikUtworu(u, ['T1.1.mp3', 'T1.mp3', 'okladka.jpg']), 'T1.mp3', 'ręczne pobranie z Suno');
    assert.equal(plikUtworu(u, ['T1 [8c39ee7a].mp3']), 'T1 [8c39ee7a].mp3');
    assert.equal(plikUtworu({ id: 'ffffffff-0', tytul: 'T1.1' }, ['T1.mp3']), null, 'T1.1 to nie T1');
});

test('synchronizacja: publiczny pobrany do „Suno <album>”, prywatny z radą, ręczny plik rozpoznany, drugi raz bez pobierania', async () => {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'suno-'));
    const muzyka = path.join(kat, 'muzyka');
    const pobrania = [];
    const strony = { 1: [klip('11111111-aaaa-bbbb-cccc-000000000001', 'Bit Taneczny', true), klip('22222222-aaaa-bbbb-cccc-000000000002', 'T1', false)], 2: [klip('33333333-aaaa-bbbb-cccc-000000000003', 'T1.1', false), klip('44444444-aaaa-bbbb-cccc-000000000004', 'Szkic', false, { status: 'streaming' })] };
    const fetchAtrapa = async (url) => {
        const u = String(url);
        const m = u.match(/playlist\/[^/]+\/\?page=(\d+)/);
        if (m) return { ok: true, status: 200, json: async () => ({ name: 'TeO Game Show', num_total_results: 4, playlist_clips: strony[m[1]] ?? [] }) };
        if (u.startsWith('https://cdn1.suno.ai/')) { pobrania.push(u); return u.includes('11111111') ? { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(50_000).buffer } : { ok: false, status: 403 }; }
        return { ok: false, status: 404 };
    };
    const S = utworzAlbumSuno({ katalog: kat, katalogMuzyki: muzyka, fetch: fetchAtrapa });
    await assert.rejects(S.ustaw('https://suno.com/song/x'), /link albumu Suno/);
    const a = await S.ustaw(`https://suno.com/album/${A}`);
    assert.equal(a.nazwa, 'TeO Game Show');
    assert.equal(a.katalog, 'Suno TeO Game Show');
    const st = Object.fromEntries(a.utwory.map((u) => [u.tytul, u.stan]));
    assert.deepEqual(st, { 'Bit Taneczny': 'pobrany', T1: 'prywatny', 'T1.1': 'prywatny' }, 'niedokończony (streaming) pominięty');
    assert.match(a.utwory.find((u) => u.tytul === 'T1').powod, /prywatny w Suno.*Download → MP3/);
    assert.equal(a.utwory[0].bpm, 126);
    assert.ok(fs.existsSync(path.join(muzyka, 'Suno TeO Game Show', 'Bit Taneczny [11111111].mp3')));
    // Suweren pobiera T1 ręcznie z Suno
    fs.writeFileSync(path.join(muzyka, 'Suno TeO Game Show', 'T1.mp3'), 'x');
    pobrania.length = 0;
    const b = await S.synchronizuj();
    assert.equal(b.utwory.find((u) => u.tytul === 'T1').stan, 'na-dysku');
    assert.equal(b.utwory.find((u) => u.tytul === 'Bit Taneczny').stan, 'na-dysku');
    assert.deepEqual(pobrania.map((u) => u.slice(-40)), [`${'33333333-aaaa-bbbb-cccc-000000000003'}.mp3`].map((x) => `https://cdn1.suno.ai/${x}`.slice(-40)), 'pobiera tylko brakujące');
    assert.equal((await S.ustaw(null)).album, null);
});
