// 🎨 Pracownia obrazów: silnik Qwen-Image-Edit 2511 (obraz od zera, Lightning 4 kroki) obok FLUX; FLUX zapasem, gdy Qwen
// padnie; brak plików Qwen = odmowa z nazwami (Katedra niczego nie pobiera). Atrapa ComfyUI — prawdziwy przebieg
// zmierzony 2026-10-14 (162 s z ładowaniem, 25 s na ciepło, 1024²).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import * as Assety3D from '../services/Assety3D.js';

const WF = path.join(process.cwd(), '_OtakOs_AI', 'workflows', 'flux2_klein_4b.json');

test('grafQwen: pusty latent ×16, LoRA Lightning, 4 kroki cfg 1, koder qwen_image, bez obrazów wejściowych', () => {
    const g = Assety3D.grafQwen({ prompt: 'a cat', szer: 1000, wys: 1290, ziarno: 7, prefiks: 'p/x' });
    assert.equal(g['1'].inputs.unet_name, 'qwen_image_edit_2511_fp8mixed.safetensors');
    assert.equal(g['2'].inputs.lora_name, Assety3D.PLIKI_QWEN.lora);
    assert.equal(g['4'].inputs.type, 'qwen_image');
    assert.deepEqual([g['8'].inputs.width, g['8'].inputs.height], [1008, 1296]);
    assert.deepEqual([g['9'].inputs.steps, g['9'].inputs.cfg, g['9'].inputs.seed], [4, 1, 7]);
    assert.equal(g['6'].inputs.prompt, 'a cat');
    assert.ok(!('image1' in g['6'].inputs), 'od zera — bez obrazu wejściowego');
    assert.equal(g['11'].inputs.filename_prefix, 'p/x');
    assert.ok(Assety3D.SILNIKI_OBRAZU.flux && Assety3D.SILNIKI_OBRAZU.qwen);
});

/** Atrapa ComfyUI: listy modeli, /prompt zapisuje grafy, /history oddaje obraz albo błąd Qwen. */
async function atrapaComfy({ qwenPliki = true, qwenPada = false, wyjscie }) {
    const grafy = [];
    const lista = (pola) => pola;
    const info = {
        UNETLoader: { unet_name: qwenPliki ? ['flux-2-klein-4b-fp8.safetensors', 'qwen_image_edit_2511_fp8mixed.safetensors'] : ['flux-2-klein-4b-fp8.safetensors'] },
        LoraLoaderModelOnly: { lora_name: [`obrazy\\${Assety3D.PLIKI_QWEN.lora}`] },
        CLIPLoader: { clip_name: ['qwen_2.5_vl_7b_fp8_scaled.safetensors'] },
        VAELoader: { vae_name: ['qwen_image_vae.safetensors'] },
    };
    const s = http.createServer((req, res) => {
        let b = '';
        req.on('data', (c) => { b += c; });
        req.on('end', () => {
            const odp = (d) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); };
            const m = req.url.match(/^\/object_info\/(\w+)/);
            if (m) return odp({ [m[1]]: { input: { required: Object.fromEntries(Object.entries(info[m[1]] ?? {}).map(([k, v]) => [k, [lista(v)]])) } } });
            if (req.url === '/prompt') { grafy.push(JSON.parse(b).prompt); return odp({ prompt_id: `p${grafy.length}` }); }
            const h = req.url.match(/^\/history\/(p\d+)/);
            if (h) {
                const g = grafy[Number(h[1].slice(1)) - 1];
                const qwen = Object.values(g).some((n) => n.class_type === 'TextEncodeQwenImageEditPlus');
                if (qwen && qwenPada) return odp({ [h[1]]: { status: { status_str: 'error', messages: [['execution_error', { exception_message: 'Allocation on device', node_type: 'KSampler' }]] } } });
                fs.mkdirSync(path.join(wyjscie, 'ComfyUI', 'output'), { recursive: true });
                fs.writeFileSync(path.join(wyjscie, 'ComfyUI', 'output', `${h[1]}.png`), qwen ? 'QWEN' : 'FLUX');
                return odp({ [h[1]]: { status: { status_str: 'success' }, outputs: { 9: { images: [{ filename: `${h[1]}.png`, subfolder: '' }] } } } });
            }
            res.writeHead(404); res.end('{}');
        });
    });
    await new Promise((r) => s.listen(0, '127.0.0.1', r));
    return { base: `http://127.0.0.1:${s.address().port}`, grafy, zamknij: () => new Promise((r) => s.close(r)) };
}

async function przygotuj(o) {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'pracownia-qwen-'));
    fs.mkdirSync(path.join(kat, 'wf'));
    fs.copyFileSync(WF, path.join(kat, 'wf', 'flux2_klein_4b.json'));
    const c = await atrapaComfy({ ...o, wyjscie: kat });
    Assety3D.skonfiguruj({ comfyBase: c.base, comfyDir: kat, katalogWorkflow: path.join(kat, 'wf'), katalogBiblioteki: path.join(kat, 'assety3d'), katalogObrazow: path.join(kat, 'obrazy'), pisz: null, szyna: null, ollamaBase: 'http://127.0.0.1:9' });
    const czekaj = async (id) => { for (let i = 0; i < 60; i += 1) { const m = await Assety3D.metaObrazu(id); if (m?.stan !== 'trwa') return m; await new Promise((r) => setTimeout(r, 500)); } throw new Error('za długo'); };
    return { kat, c, czekaj };
}

test('Qwen rysuje: graf Qwen z nazwą LoRA tak, jak widzi ją ComfyUI (podkatalog); meta zna silnik', async () => {
    const { kat, c, czekaj } = await przygotuj({});
    try {
        const { obraz } = await Assety3D.obraz({ opis: 'kot tancerz', styl: 'pojedynczy', silnik: 'qwen' });
        const m = await czekaj(obraz);
        assert.equal(m.stan, 'gotowe', m.blad);
        assert.deepEqual([m.silnik, m.silnikUzyty, m.uwaga], ['qwen', 'qwen', undefined]);
        assert.equal(c.grafy.length, 1);
        assert.equal(c.grafy[0]['2'].inputs.lora_name, `obrazy\\${Assety3D.PLIKI_QWEN.lora}`);
        assert.equal(fs.readFileSync(path.join(kat, 'obrazy', obraz, 'obraz.png'), 'utf8'), 'QWEN');
    } finally { await c.zamknij(); }
});

test('Qwen pada → ten sam obraz rysuje FLUX (zapas), powód w meta', async () => {
    const { kat, c, czekaj } = await przygotuj({ qwenPada: true });
    try {
        const { obraz } = await Assety3D.obraz({ opis: 'kot tancerz', styl: 'pojedynczy', silnik: 'qwen' });
        const m = await czekaj(obraz);
        assert.equal(m.stan, 'gotowe', m.blad);
        assert.equal(m.silnikUzyty, 'flux');
        assert.match(m.uwaga, /Qwen padł \(ComfyUI: Allocation on device/);
        assert.equal(fs.readFileSync(path.join(kat, 'obrazy', obraz, 'obraz.png'), 'utf8'), 'FLUX');
    } finally { await c.zamknij(); }
});

test('brak plików Qwen w ComfyUI = odmowa z nazwą pliku, nic nie zlecone; zły silnik = odmowa; FLUX domyślny', async () => {
    const { c, czekaj } = await przygotuj({ qwenPliki: false });
    try {
        await assert.rejects(Assety3D.obraz({ opis: 'kot', silnik: 'qwen' }), /nie widzi plików Qwen: qwen_image_edit_2511_fp8mixed\.safetensors.*nie pobiera/);
        await assert.rejects(Assety3D.obraz({ opis: 'kot', silnik: 'sdxl' }), /Nieznany silnik obrazu/);
        assert.equal(c.grafy.length, 0);
        const { obraz } = await Assety3D.obraz({ opis: 'kot' });
        const m = await czekaj(obraz);
        assert.deepEqual([m.silnik, m.silnikUzyty], ['flux', 'flux']);
        assert.ok(c.grafy[0]['5'], 'graf FLUX z pliku workflow');
    } finally { await c.zamknij(); }
});
