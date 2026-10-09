// ☁️🗿 Dopracowanie brył w chmurze (Meshy) — wycena, zgoda na kwotę, zlecenie w tle (atrapa API, bez kredytów).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzChmureBryl, oczyscZlecenie, wycena, cialoMeshy, promptStylu, oczyscStyl, CENNIK_MESHY } from '../services/ChmuraBryl.js';
import * as Assety3D from '../services/Assety3D.js';
import { zapiszGlb } from '../services/Siatka3D.js';

const GLB = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(60)]);
/** Atrapa Meshy: saldo, przyjęcie zlecenia, dwa odczyty statusu, plik GLB. */
function atrapa({ saldo = 100, status = ['IN_PROGRESS', 'SUCCEEDED'], kodPost = 200 } = {}) {
    const wolania = [];
    let odczyt = 0;
    const f = async (url, o = {}) => {
        wolania.push({ url, metoda: o.method ?? 'GET', cialo: o.body ? JSON.parse(o.body) : null, auth: o.headers?.Authorization });
        if (url.endsWith('/balance')) return { ok: true, json: async () => ({ balance: saldo }) };
        if (o.method === 'POST') return { ok: kodPost === 200, status: kodPost, json: async () => (kodPost === 200 ? { result: 'meshy-123' } : { message: 'Insufficient credits' }) };
        if (url.includes('/meshy-123')) { const s = status[Math.min(odczyt++, status.length - 1)]; return { ok: true, json: async () => ({ status: s, progress: s === 'SUCCEEDED' ? 100 : 40, model_urls: { glb: 'https://cdn.meshy/wynik.glb' }, consumed_credits: 10, task_error: s === 'FAILED' ? { message: 'zły model' } : null }) }; }
        if (url === 'https://cdn.meshy/wynik.glb') return { ok: true, arrayBuffer: async () => GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.length) };
        throw new Error(`nieoczekiwany adres ${url}`);
    };
    return { f, wolania };
}
const czekaj = async (C, id) => { for (let i = 0; i < 100; i++) { const z = C.zadanie(id); if (z.stan === 'gotowe' || z.stan === 'blad') return z; await new Promise((r) => setTimeout(r, 10)); } throw new Error('zadanie nie skończyło'); };

test('zlecenie sprawdzone, wycena z cennika (Meshy 2026-10-09), ciało API', () => {
    assert.throws(() => oczyscZlecenie({}), /retekstura albo remesh/);
    assert.throws(() => oczyscZlecenie({ rodzaj: 'retekstura', styl: 'x' }), /opisz styl/);
    assert.throws(() => oczyscZlecenie({ rodzaj: 'remesh', sciany: 50 }), /od 100 do 300 000/);
    const r = oczyscZlecenie({ rodzaj: 'retekstura', styl: 'opalowa sierść', rozdzielczosc: '8k', pbr: 1 });
    assert.deepEqual(wycena(r), { kredyty: 15, usdOkolo: 0.3, cennik: CENNIK_MESHY.zrodlo });
    assert.equal(wycena(oczyscZlecenie({ rodzaj: 'remesh', sciany: 20000, topologia: 'quad' })).kredyty, 5);
    assert.deepEqual(cialoMeshy(r, 'data:x'), { model_url: 'data:x', text_style_prompt: 'opalowa sierść', texture_resolution: '8k', enable_pbr: true, enable_original_uv: false, target_formats: ['glb'] });
});

test('bez klucza — błąd wprost; bez zgody na kwotę — nic nie wychodzi', async () => {
    const { f, wolania } = atrapa();
    const bez = utworzChmureBryl({ klucz: () => null, plikBryly: async () => ({ bajty: GLB }), zapiszWersje: async () => ({}), fetch: f });
    await assert.rejects(bez.saldo(), /Brak klucza Meshy/);
    const C = utworzChmureBryl({ klucz: () => 'msy_test', plikBryly: async () => ({ bajty: GLB }), zapiszWersje: async () => ({}), fetch: f });
    await assert.rejects(C.zlec('kot', { rodzaj: 'remesh', sciany: 20000 }, {}), /Brak zgody na koszt: to zlecenie kosztuje 5 kredytów/);
    await assert.rejects(C.zlec('kot', { rodzaj: 'remesh', sciany: 20000 }, { zgodaKredyty: 4 }), /Brak zgody/);
    assert.equal(wolania.filter((w) => w.metoda === 'POST').length, 0, 'bez zgody zero wysyłek');
});

test('wycena z saldem; zlecenie: plik jako data URI → status → pobranie GLB → nowa wersja; 402 = za mało kredytów', async () => {
    const { f, wolania } = atrapa({ saldo: 12 });
    const zapisane = [];
    const C = utworzChmureBryl({ klucz: () => 'msy_test', plikBryly: async () => ({ bajty: GLB }), zapiszWersje: async (id, glb, wpis) => { zapisane.push({ id, glb, wpis }); return { id: `${id}-nowa` }; }, fetch: f, coMs: 1 });
    const w = await C.wycen('kot', { rodzaj: 'retekstura', styl: 'opal nocą', rozdzielczosc: '8k' });
    assert.deepEqual([w.kredyty, w.saldo, w.wystarczy, w.zaDuzy], [15, 12, false, false]);
    const z = await C.zlec('kot', { rodzaj: 'retekstura', styl: 'opal nocą' }, { zgodaKredyty: 10 });
    const post = wolania.find((x) => x.metoda === 'POST');
    assert.match(post.url, /\/retexture$/);
    assert.match(post.cialo.model_url, /^data:application\/octet-stream;base64,Z2xURg/);
    assert.equal(post.auth, 'Bearer msy_test');
    const k = await czekaj(C, z.id);
    assert.equal(k.stan, 'gotowe', k.blad);
    assert.equal(k.asset, 'kot-nowa');
    assert.equal(zapisane[0].glb.toString('ascii', 0, 4), 'glTF');
    assert.deepEqual([zapisane[0].wpis.usluga, zapisane[0].wpis.rodzaj, zapisane[0].wpis.kredyty], ['meshy', 'retekstura', 10]);
    const odmowa = utworzChmureBryl({ klucz: () => 'msy_test', plikBryly: async () => ({ bajty: GLB }), zapiszWersje: async () => ({}), fetch: atrapa({ kodPost: 402 }).f });
    await assert.rejects(odmowa.zlec('kot', { rodzaj: 'remesh', sciany: 1000 }, { zgodaKredyty: 5 }), /HTTP 402 — za mało kredytów/);
    const padlo = utworzChmureBryl({ klucz: () => 'msy_test', plikBryly: async () => ({ bajty: GLB }), zapiszWersje: async () => ({}), fetch: atrapa({ status: ['FAILED'] }).f, coMs: 1 });
    const zp = await padlo.zlec('kot', { rodzaj: 'remesh', sciany: 1000 }, { zgodaKredyty: 5 });
    assert.match((await czekaj(padlo, zp.id)).blad, /Meshy: FAILED — zły model/);
});

let kat;
before(async () => {
    kat = await fs.mkdtemp(path.join(os.tmpdir(), 'chmura-'));
    Assety3D.skonfiguruj({ katalogBiblioteki: kat });
    const dir = path.join(kat, 'kot-ab12');
    await fs.mkdir(dir);
    const s = { pozycje: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]), kolory: Float32Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0]), indeksy: Uint32Array.from([0, 1, 2]) };
    await zapiszGlb(s, s.indeksy, path.join(dir, 'master.glb'));
    await zapiszGlb(s, s.indeksy, path.join(dir, 'model.glb'));
    await fs.writeFile(path.join(dir, 'obraz.png'), 'png');
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify({ id: 'kot-ab12', nazwa: 'kot', opis: 'kot', sciany: 4000, stan: 'gotowe', wGrach: ['gra'], utworzono: '2026-10-09T10:00:00Z' }));
});
after(async () => { await fs.rm(kat, { recursive: true, force: true }); });

test('wersja z chmury: GLB bez przeróbek (tekstury), obok starej; lokalne poprawki odmawiają wprost', async () => {
    const plik = await Assety3D.plikDoChmury('kot-ab12');
    assert.equal(plik.bajty.toString('ascii', 0, 4), 'glTF');
    await assert.rejects(Assety3D.wersjaZChmury('kot-ab12', Buffer.from('nie glb'), {}), /nie jest GLB/);
    const n = await Assety3D.wersjaZChmury('kot-ab12', GLB, { usluga: 'meshy', rodzaj: 'retekstura', kredyty: 10, kiedy: 'teraz' });
    assert.equal(n.tekstury, true);
    assert.equal(n.ulepsza, 'kot-ab12');
    assert.deepEqual(n.wGrach, []);
    assert.deepEqual(n.poprawki.at(-1), { rodzaj: 'chmura', usluga: 'meshy', zlecenie: 'retekstura', kredyty: 10, kiedy: 'teraz' });
    assert.deepEqual(await fs.readFile(path.join(kat, n.id, 'model.glb')), GLB);
    await fs.access(path.join(kat, n.id, 'obraz.png'));
    await assert.rejects(Assety3D.przekolorujBryle(n.id, { czern: 0.3 }), /wersja z chmury \(Meshy\) — ma tekstury/);
    await assert.rejects(Assety3D.uprosc(n.id, 2000), /wersja z chmury/);
});

test('👁️ styl ze zdjęcia: prompt z opisem i świecącą częścią, odpowiedź oczyszczona, za krótka = błąd wprost', () => {
    const p = promptStylu({ opis: 'TeOgochi — stworek-duszek', swiatlo: '#ffb289' });
    assert.match(p, /Object description from its maker: TeOgochi/);
    assert.match(p, /glowing part \(emissive\) of color #ffb289/);
    assert.doesNotMatch(promptStylu(), /description|glowing/);
    assert.equal(oczyscStyl('<think>hmm</think>Style prompt: "Glossy black fur, opal sheen."'), 'Glossy black fur, opal sheen.');
    assert.equal(oczyscStyl('x'.repeat(900)).length, 800);
    assert.throws(() => oczyscStyl('ok'), /nie opisały tekstur/);
});
