// 🎛️ Pracownia obrazów / Assety 3D same budzą ComfyUI (Suweren 2026-10-07: „brakuje tam auto wstania Comfy”).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import * as A from '../services/Assety3D.js';

/** Atrapa ComfyUI: odpowiada dopiero po `budzSie()` (po starcie „procesu”). */
function atrapa() {
    let zyje = false;
    const s = http.createServer((req, res) => {
        if (!zyje) { res.writeHead(503); return res.end('{}'); }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
    });
    return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok({ s, base: `http://127.0.0.1:${s.address().port}`, budzSie: () => { zyje = true; } })));
}

test('ComfyUI żyje — nic nie budzi', async () => {
    const a = await atrapa(); a.budzSie();
    let budzono = 0;
    A.skonfiguruj({ comfyBase: a.base, obudzComfy: async () => { budzono++; return { started: true }; }, czekajNaComfyMs: 2000 });
    assert.deepEqual(await A.zywyComfy('/object_info'), { budzony: false });
    assert.equal(budzono, 0);
    a.s.close();
});

test('ComfyUI śpi — most go budzi, czekamy aż wstanie', async () => {
    const a = await atrapa();
    let powod = null;
    A.skonfiguruj({ comfyBase: a.base, obudzComfy: async (p) => { powod = p; setTimeout(a.budzSie, 1000); return { online: false, started: true, message: 'ComfyUI wstaje' }; }, czekajNaComfyMs: 15000 });
    assert.deepEqual(await A.zywyComfy('/object_info'), { budzony: true });
    assert.match(powod, /Pracownia/);
    a.s.close();
});

test('nie da się obudzić / nie wstał w czasie — błąd wprost', async () => {
    const a = await atrapa();
    A.skonfiguruj({ comfyBase: a.base, obudzComfy: async () => ({ online: false, started: false, message: 'Brak ComfyUI w X' }), czekajNaComfyMs: 1000 });
    await assert.rejects(A.zywyComfy('/object_info'), /nie dał się obudzić: Brak ComfyUI w X/);
    A.skonfiguruj({ obudzComfy: async () => ({ started: true }), czekajNaComfyMs: 500 });
    await assert.rejects(A.zywyComfy('/object_info'), /nie odpowiedział w 1 s/);
    A.skonfiguruj({ obudzComfy: null });
    await assert.rejects(A.zywyComfy('/object_info'), /obudź go/);
    a.s.close();
});
