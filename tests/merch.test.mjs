// 🖨️ Pracownia merchu — Creative Lab (prototyp → akceptacja → budowa) i druk (darmowa analiza + 3MF), zgoda na kwotę,
// pliki tylko z katalogu merchu. Atrapa API Meshy, prawdziwy dysk tymczasowy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzMerch, oczyscProdukt, oczyscDruk, cialoPrototypu, cialoBudowy, raportDruku, CENNIK_MERCHU } from '../services/Merch.js';

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const GLB = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(16)]);
async function czekaj(M, id, warunek) {
    for (let i = 0; i < 400; i++) {
        const m = (await M.lista()).find((x) => x.id === id);
        if (m && !m.liczy && (warunek(m) || m.stan === 'blad')) return m;
        await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('merch nie skończył');
}

function atrapa() {
    const wolania = [];
    const odczyty = {};
    const zadanie = (url, gotowe) => { odczyty[url] = (odczyty[url] ?? 0) + 1; return odczyty[url] > 1 ? { status: 'SUCCEEDED', progress: 100, ...gotowe } : { status: 'IN_PROGRESS', progress: 30 }; };
    const f = async (url, o = {}) => {
        wolania.push({ url, metoda: o.method ?? 'GET', cialo: o.body ? JSON.parse(o.body) : null });
        const json = (d) => ({ ok: true, status: 200, json: async () => d });
        if (url.endsWith('/balance')) return json({ balance: 980 });
        if (o.method === 'POST') return json({ result: url.includes('prototype') ? 'pro-1' : url.includes('build') ? 'bud-1' : url.includes('analyze') ? 'ana-1' : 'mc-1' });
        if (url.endsWith('/keychain/v1/prototype/pro-1')) return json(zadanie(url, { consumed_credits: 6, image_urls: ['https://cdn/koncept.png'] }));
        if (url.endsWith('/keychain/v1/build/bud-1')) return json(zadanie(url, { consumed_credits: 20, model_urls: { glb: 'https://cdn/brelok.glb' }, thumbnail_url: 'https://cdn/mini.png' }));
        if (url.endsWith('/print/analyze/ana-1')) return json(zadanie(url, { printability: { status: 'warning', error_count: 0, warning_count: 1, metrics: { is_watertight: true, holes: 0, non_manifold_edges: 2, degenerate_faces: 0 }, thin_walls: { has_thin_walls: true, thin_area_ratio: 0.04, status: 'healthy' }, intended_print: { dimensions_mm: [40, 40, 4], wall_thickness_mm: 0.8 } } }));
        if (url.endsWith('/print/multi-color/mc-1')) return json(zadanie(url, { consumed_credits: 10, model_urls: { '3mf': 'https://cdn/druk.3mf' } }));
        if (url.startsWith('https://cdn/')) { const b = url.endsWith('.png') ? PNG : GLB; return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; }
        throw new Error(`nieoczekiwany adres ${url}`);
    };
    return { f, wolania };
}

test('czyste funkcje: produkt, druk, ciała API, raport', () => {
    assert.throws(() => oczyscProdukt({ produkt: 'kubek' }), /Produkt: figurka, brelok/);
    const b = oczyscProdukt({ produkt: 'brelok', grawer: 'TeOgochi-Kot!', ksztalt: 'gwiazda', mm: 400 });
    assert.deepEqual(b, { produkt: 'brelok', nazwa: 'Brelok z grawerem', grawer: 'TeOgochi-K', ksztalt: 'circle', mm: 150 });
    assert.equal(oczyscProdukt({ produkt: 'figurka', grawer: 'x' }).grawer, '', 'figurka bez graweru');
    assert.deepEqual(cialoPrototypu(b, 'data:x'), { image_url: 'data:x', name: 'Brelok z grawerem', name_text: 'TeOgochi-K' });
    assert.deepEqual(cialoBudowy(b, 'pro-1'), { input_task_id: 'pro-1', name: 'Brelok z grawerem', options: { badge_shape: 'circle', size_mm: 150 }, output: { format: 'glb' } });
    assert.deepEqual(cialoBudowy(oczyscProdukt({ produkt: 'figurka' }), 'p'), { input_task_id: 'p', name: 'Figurka (chibi)', output: { format: 'glb' } });
    assert.deepEqual(oczyscDruk({ kolory: 40, marka: 'xerox', styl: 'realistic', mm: 3 }), { drukarkaTyp: 'fdm', mm: 10, kolory: 16, styl: 'realistic', marka: 'bambu' });
    assert.equal(raportDruku({ status: 'error' }).werdykt, '⛔ wymaga naprawy przed drukiem');
    assert.equal(raportDruku(null), null);
});

test('Creative Lab: prototyp za zgodą → koncept → budowa za zgodą → gotowy brelok; druk 3MF; pliki tylko merchu', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'merch-'));
    try {
        const { f, wolania } = atrapa();
        const M = utworzMerch({ katalog: kat, klucz: () => 'msy_t', fetch: f, coMs: 1, obrazBryly: async () => PNG, glbBryly: async () => ({ bajty: GLB, zadanie: null }) });
        await assert.rejects(M.prototyp({ produkt: 'brelok' }, { bryla: 'kot', zgodaKredyty: 5 }), /prototyp kosztuje 6 kredytów/);
        await assert.rejects(M.prototyp({ produkt: 'brelok' }, { zgodaKredyty: 6 }), /Podaj bryłę/);
        assert.equal(wolania.filter((w) => w.metoda === 'POST').length, 0, 'bez zgody i źródła — zero wysyłek');
        const w = await M.wycen('budowa');
        assert.deepEqual([w.kredyty, w.saldo], [CENNIK_MERCHU.budowa, 980]);
        const m0 = await M.prototyp({ produkt: 'brelok', grawer: 'Kot', ksztalt: 'star' }, { bryla: 'kot', zgodaKredyty: 6 });
        const post = wolania.find((x) => x.metoda === 'POST');
        assert.match(post.url, /\/openapi\/creative-lab\/keychain\/v1\/prototype$/);
        assert.match(post.cialo.image_url, /^data:image\/png;base64,/);
        const m1 = await czekaj(M, m0.id, (m) => m.stan === 'koncept');
        assert.deepEqual([m1.stan, m1.kredyty, m1.pliki.koncept], ['koncept', 6, 'koncept.png']);
        await assert.rejects(M.buduj(m0.id, { zgodaKredyty: 20 }), /budowa kosztuje 30/);
        await M.buduj(m0.id, { zgodaKredyty: 30 });
        assert.deepEqual(wolania.filter((x) => x.metoda === 'POST').at(-1).cialo, { input_task_id: 'pro-1', name: 'Brelok z grawerem', options: { badge_shape: 'star', size_mm: 40 }, output: { format: 'glb' } });
        const m2 = await czekaj(M, m0.id, (m) => m.stan === 'gotowy');
        assert.deepEqual([m2.stan, m2.kredyty, m2.pliki.model, m2.pliki.miniatura], ['gotowy', 26, 'model.glb', 'miniatura.png']);
        assert.equal((await fs.readFile(await M.plik(m0.id, 'model.glb'))).toString('ascii', 0, 4), 'glTF');
        await assert.rejects(M.plik(m0.id, '../../etc/passwd'), /Nie ma takiego pliku/);
        await assert.rejects(M.plik('../x', 'model.glb'), /Złe id/);
        await assert.rejects(M.buduj(m0.id, { zgodaKredyty: 30 }), /tylko z gotowego konceptu/);
        // druk z gotowego merchu: analiza (darmowa) + 3MF (za zgodą)
        await assert.rejects(M.druk({ id: m0.id, z3mf: true, zgodaKredyty: 0 }), /plik 3MF kosztuje 10/);
        await M.druk({ id: m0.id, ustawienia: { kolory: 6, mm: 40, marka: 'prusa' }, z3mf: true, zgodaKredyty: 10 });
        const m4 = await czekaj(M, m0.id, (m) => m.druk?.stan === 'gotowe');
        assert.equal(m4.druk.raport.werdykt, '⚠ do druku z uwagami');
        assert.deepEqual([m4.druk.raport.szczelna, m4.druk.raport.krawedzieNieRozmaitosci, m4.druk.raport.wymiaryMm], [true, 2, [40, 40, 4]]);
        assert.deepEqual([m4.pliki.druk, m4.kredyty], ['druk.3mf', 36]);
        const mc = wolania.find((x) => x.url.endsWith('/print/multi-color'));
        assert.deepEqual([mc.cialo.max_colors, mc.cialo.style, mc.cialo.printer_brand], [6, 'cartoon', 'prusa']);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('druk z bryły: zadanie Meshy idzie jako input_task_id, sama analiza bez kredytów', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'merch-d-'));
    try {
        const { f, wolania } = atrapa();
        const M = utworzMerch({ katalog: kat, klucz: () => 'msy_t', fetch: f, coMs: 1, obrazBryly: async () => PNG, glbBryly: async () => ({ bajty: GLB, zadanie: 'retex-9' }) });
        const m = await M.druk({ bryla: 'kot-343a', ustawienia: { drukarkaTyp: 'sla', mm: 120 } });
        const a = wolania.find((x) => x.url.endsWith('/print/analyze'));
        assert.deepEqual(a.cialo, { input_task_id: 'retex-9', printer_type: 'sla', intended_print_longest_side_mm: 120 });
        const g = await czekaj(M, m.id, (x) => x.stan === 'gotowy');
        assert.deepEqual([g.rodzaj, g.kredyty, g.pliki.druk], ['druk', 0, undefined]);
        assert.equal(wolania.some((x) => x.url.includes('multi-color')), false);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
