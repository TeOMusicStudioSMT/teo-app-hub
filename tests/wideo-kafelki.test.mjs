// 🧩 Dekodowanie kafelkowe i czekanie na render (Suweren 2026-10-08: render 54 min 29 s „padł” po 45 min, choć liczył dalej).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { dekodujKafelkami, terminCzekania, CZEKANIE_WIDEO, stanZlecenia } from '../services/Wideo.js';

test('VAEDecode → VAEDecodeTiled z zachowanymi wejściami; OTAKOS_WIDEO_KAFELKI=0 wyłącza', () => {
    const graf = () => ({ 8: { class_type: 'KSampler', inputs: {} }, 9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } } });
    const g = dekodujKafelkami(graf(), {});
    assert.deepEqual(g['9'], { class_type: 'VAEDecodeTiled', inputs: { samples: ['8', 0], vae: ['3', 0], tile_size: 512, overlap: 64, temporal_size: 32, temporal_overlap: 8 } });
    assert.equal(g['8'].class_type, 'KSampler');
    assert.equal(dekodujKafelkami(graf(), { OTAKOS_WIDEO_KAFELKI: '0' })['9'].class_type, 'VAEDecode');
    assert.equal(dekodujKafelkami(graf(), { OTAKOS_WIDEO_KAFEL: '384', OTAKOS_WIDEO_KAFEL_KLATEK: '16' })['9'].inputs.tile_size, 384);
});

test('termin czekania: przesuwa się, gdy ComfyUI liczy; sufit 4 h; bez pracy stoi', () => {
    const start = 0, min = 60_000;
    const t0 = start + CZEKANIE_WIDEO.pierwszy;
    assert.equal(terminCzekania({ start, termin: t0, wToku: false, teraz: 44 * min }), t0);
    assert.equal(terminCzekania({ start, termin: t0, wToku: true, teraz: 44 * min }), 64 * min, '44 min + 20 min zapasu');
    assert.equal(terminCzekania({ start, termin: t0, wToku: true, teraz: 10 * min }), t0, 'nie skraca');
    assert.equal(terminCzekania({ start, termin: 230 * min, wToku: true, teraz: 230 * min }), 240 * min, 'sufit 4 h');
});

test('stanZlecenia bez historii: liczy / w-kolejce / zgubione z kolejki ComfyUI', async () => {
    const kolejka = { queue_running: [[0, 'a-liczy', {}]], queue_pending: [[1, 'b-czeka', {}]] };
    const s = http.createServer((req, res) => res.end(JSON.stringify(req.url.startsWith('/queue') ? kolejka : {})));
    await new Promise((r) => s.listen(0, '127.0.0.1', r));
    const baza = `http://127.0.0.1:${s.address().port}`;
    try {
        assert.deepEqual(await stanZlecenia(baza, 'a-liczy'), { ok: true, gotowe: false, stan: 'liczy', wToku: true });
        assert.deepEqual(await stanZlecenia(baza, 'b-czeka'), { ok: true, gotowe: false, stan: 'w-kolejce', wToku: true });
        assert.deepEqual(await stanZlecenia(baza, 'c-nikt'), { ok: true, gotowe: false, stan: 'zgubione', wToku: false });
    } finally { s.close(); }
});
