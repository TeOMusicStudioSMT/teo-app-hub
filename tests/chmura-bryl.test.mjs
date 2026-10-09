// ☁️🗿 Dopracowanie brył w chmurze (Meshy) — wycena, zgoda na kwotę, zlecenie w tle (atrapa API, bez kredytów).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzChmureBryl, oczyscZlecenie, wycena, cialoMeshy, promptStylu, oczyscStyl, dobierzAkcje, CENNIK_MESHY } from '../services/ChmuraBryl.js';
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
    // 🎨 kolor wersji z chmury liczy się na teksturach (tests/glb-tekstury.test.mjs) — atrapa GLB bez tekstur = błąd wprost, bez nowej wersji
    const przed = (await fs.readdir(kat)).length;
    await assert.rejects(Assety3D.przekolorujBryle(n.id, { czern: 0.3 }), /bez kawałka JSON|nie ma tekstur barwy/);
    assert.equal((await fs.readdir(kat)).length, przed, 'nieudana wersja posprzątana');
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

test('🧊 Image-to-3D i 🦴 rig: wycena z cennika, ciało API, rig tylko z teksturami', () => {
    assert.deepEqual(wycena(oczyscZlecenie({ rodzaj: 'obraz3d', rozdzielczosc: '8k' })).kredyty, 35);
    assert.equal(wycena(oczyscZlecenie({ rodzaj: 'obraz3d', model: 'meshy-6-lite' })).kredyty, 15);
    assert.throws(() => oczyscZlecenie({ rodzaj: 'obraz3d', model: 'meshy-6-lite', rozdzielczosc: '4k' }), /tylko tekstury 2K/);
    const o = oczyscZlecenie({ rodzaj: 'obraz3d', poza: 't-pose', pbr: true });
    assert.deepEqual(cialoMeshy(o, 'data:image/png;base64,x'), { image_url: 'data:image/png;base64,x', ai_model: 'latest', should_texture: true, enable_pbr: true, texture_resolution: '2k', pose_mode: 't-pose', target_formats: ['glb'] });
    const r = oczyscZlecenie({ rodzaj: 'rig', wzrost: 1.8, akcje: [4, 4, 92, '10'] });
    assert.deepEqual(r.akcje, [4, 92, 10]);
    assert.equal(wycena(r).kredyty, 5 + 3 * 3);
    assert.deepEqual(cialoMeshy(r, { zadanie: 'm-1' }), { input_task_id: 'm-1', height_meters: 1.8 });
    assert.deepEqual(cialoMeshy(r, 'data:x'), { model_url: 'data:x', height_meters: 1.8 });
    assert.throws(() => oczyscZlecenie({ rodzaj: 'rig', akcje: Array.from({ length: 11 }, (_, i) => i) }), /Najwyżej 10 akcji/);
    assert.throws(() => oczyscZlecenie({ rodzaj: 'rig', wzrost: 9 }), /Wzrost/);
});

test('🦴 rig: bryła bez tekstur odmawia; z teksturami → rig (input_task_id) → chód, bieg, akcje → ruchy nowej wersji', async () => {
    const wolania = [];
    const ruchy = [];
    let odczytRig = 0, odczytAnim = 0;
    const f = async (url, o = {}) => {
        wolania.push({ url, metoda: o.method ?? 'GET', cialo: o.body ? JSON.parse(o.body) : null });
        if (url.endsWith('/balance')) return { ok: true, json: async () => ({ balance: 500 }) };
        if (url.endsWith('/rigging') && o.method === 'POST') return { ok: true, json: async () => ({ result: 'rig-1' }) };
        if (url.endsWith('/animations') && o.method === 'POST') return { ok: true, json: async () => ({ result: 'anim-1' }) };
        if (url.includes('/rigging/rig-1')) return { ok: true, json: async () => (odczytRig++ ? { status: 'SUCCEEDED', progress: 100, consumed_credits: 5, result: { rigged_character_glb_url: 'https://cdn/rig.glb', basic_animations: { walking_glb_url: 'https://cdn/walk.glb', running_glb_url: 'https://cdn/run.glb' } } } : { status: 'IN_PROGRESS', progress: 50 }) };
        if (url.includes('/animations/anim-1')) return { ok: true, json: async () => (odczytAnim++ ? { status: 'SUCCEEDED', progress: 100, consumed_credits: 6, result: { animation_glb_url: 'https://cdn/akcje.glb' } } : { status: 'IN_PROGRESS', progress: 10 }) };
        if (url.startsWith('https://cdn/')) return { ok: true, arrayBuffer: async () => GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.length) };
        throw new Error(`nieoczekiwany adres ${url}`);
    };
    const meta = { 'kot-bez': { tekstury: false }, 'kot-tex': { tekstury: true, chmura: { rodzaj: 'retekstura', zadanie: 'retex-9' } } };
    const C = utworzChmureBryl({ klucz: () => 'msy_test', fetch: f, coMs: 1, plikBryly: async () => ({ bajty: GLB }), metaBryly: async (id) => meta[id],
        zapiszWersje: async (id) => ({ id: `${id}-rig` }), zapiszRuch: async (id, ruch, glb, wpis) => { ruchy.push([id, ruch, glb.toString('ascii', 0, 4), wpis.zrodlo]); } });
    await assert.rejects(C.wycen('kot-bez', { rodzaj: 'rig' }), /potrzebuje bryły z TEKSTURAMI/);
    const w = await C.wycen('kot-tex', { rodzaj: 'rig', akcje: [4, 92] });
    assert.deepEqual([w.kredyty, w.mb], [11, 0]);
    const zad = await C.zlec('kot-tex', { rodzaj: 'rig', akcje: [4, 92] }, { zgodaKredyty: 11 });
    assert.deepEqual(wolania.find((x) => x.metoda === 'POST').cialo, { input_task_id: 'retex-9', height_meters: 1.7 });
    for (let i = 0; i < 200 && !['gotowe', 'blad'].includes(C.zadanie(zad.id).stan); i++) await new Promise((r) => setTimeout(r, 5));
    const k = C.zadanie(zad.id);
    assert.equal(k.stan, 'gotowe', k.blad);
    assert.deepEqual([k.asset, k.ruchy, k.kredyty], ['kot-tex-rig', ['chod', 'bieg', 'akcje'], 11]);
    assert.deepEqual(wolania.find((x) => x.url.endsWith('/animations')).cialo, { rig_task_id: 'rig-1', action_ids: [4, 92] });
    assert.deepEqual(ruchy.map((r) => r[1]), ['chod', 'bieg', 'akcje']);
    assert.ok(ruchy.every((r) => r[0] === 'kot-tex-rig' && r[2] === 'glTF' && r[3] === 'meshy'));
});

test('📚 biblioteka animacji Meshy: odczyt, filtr, pamięć', async () => {
    let wolan = 0;
    const C = utworzChmureBryl({ klucz: () => 'msy_test', plikBryly: async () => ({ bajty: GLB }), zapiszWersje: async () => ({}),
        fetch: async () => { wolan++; return { ok: true, json: async () => ({ result: [{ action_id: 4, name: 'Attack', key: 'attack', category: 'Fighting', sub_category: 'AttackingwithWeapon', preview_url: 'https://x/p.mp4' }, { action_id: 1, name: 'Walk', key: 'walk', category: 'WalkAndRun' }, { name: 'bez id' }] }) }; } });
    assert.deepEqual((await C.akcje()).map((a) => a.id), [4, 1]);
    assert.deepEqual((await C.akcje({ kategoria: 'Fighting' })).map((a) => a.nazwa), ['Attack']);
    assert.deepEqual((await C.akcje({ szukaj: 'WAL' })).map((a) => a.id), [1]);
    assert.equal(wolan, 1, 'biblioteka z pamięci');
});

test('🎛️ akcje: auto-zestaw z biblioteki; kolejna paczka na TYM SAMYM rigu → akcje2 (bez nowej wersji)', async () => {
    const bib = [
        { id: 1, nazwa: 'Idle', klucz: 'idle', kategoria: 'DailyActions' }, { id: 2, nazwa: 'Jump Up', klucz: 'jump', kategoria: 'BodyMovements' },
        { id: 3, nazwa: 'Sword Attack', klucz: 'attack_1', kategoria: 'Fighting' }, { id: 4, nazwa: 'Punch', klucz: 'punch', kategoria: 'Fighting' },
        { id: 5, nazwa: 'Hip Hop', klucz: 'dance_1', kategoria: 'Dancing' }, { id: 6, nazwa: 'Wave Hello', klucz: 'wave', kategoria: 'DailyActions' },
    ];
    assert.deepEqual(dobierzAkcje('gra', bib).map((a) => a.id), [1, 2, 3, 6]);
    assert.deepEqual(dobierzAkcje('walka', bib, { pominac: [3] }).map((a) => a.id), [4], 'bez akcji, które bryła już ma');
    assert.throws(() => dobierzAkcje('nie-ma', bib), /Nieznany zestaw/);
    assert.throws(() => oczyscZlecenie({ rodzaj: 'akcje', akcje: [] }), /Wybierz akcje/);
    assert.throws(() => oczyscZlecenie({ rodzaj: 'akcje', akcje: Array.from({ length: 11 }, (_, i) => i) }), /kolejną paczką/);
    assert.equal(wycena(oczyscZlecenie({ rodzaj: 'akcje', akcje: [1, 2, 3] })).kredyty, 9);
    const wolania = [], ruchy = [];
    let odczyt = 0;
    const f = async (url, o = {}) => {
        wolania.push({ url, metoda: o.method ?? 'GET', cialo: o.body ? JSON.parse(o.body) : null });
        if (url.endsWith('/balance')) return { ok: true, json: async () => ({ balance: 100 }) };
        if (url.endsWith('/animations') && o.method === 'POST') return { ok: true, json: async () => ({ result: 'anim-7' }) };
        if (url.includes('/animations/anim-7')) return { ok: true, json: async () => (odczyt++ ? { status: 'SUCCEEDED', consumed_credits: 9, result: { animation_glb_url: 'https://cdn/a.glb' } } : { status: 'IN_PROGRESS' }) };
        if (url.startsWith('https://cdn/')) return { ok: true, arrayBuffer: async () => GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.length) };
        throw new Error(`nieoczekiwany adres ${url}`);
    };
    const meta = { 'kot-rig': { tekstury: true, chmura: { rodzaj: 'rig', zadanie: 'rig-5' }, ruchy: [{ ruch: 'chod' }, { ruch: 'akcje', akcje: [3] }] }, 'kot-tex': { tekstury: true, chmura: { rodzaj: 'retekstura', zadanie: 'r' } } };
    const C = utworzChmureBryl({ klucz: () => 'msy_test', fetch: f, coMs: 1, plikBryly: async () => ({ bajty: GLB }), metaBryly: async (id) => meta[id],
        zapiszWersje: async () => { throw new Error('akcje nie robią nowej wersji'); }, zapiszRuch: async (id, ruch) => { ruchy.push([id, ruch]); } });
    await assert.rejects(C.wycen('kot-tex', { rodzaj: 'akcje', akcje: [1] }), /z RIGIEM/);
    const zad = await C.zlec('kot-rig', { rodzaj: 'akcje', akcje: [1, 2, 6] }, { zgodaKredyty: 9 });
    assert.deepEqual(wolania.find((x) => x.metoda === 'POST').cialo, { rig_task_id: 'rig-5', action_ids: [1, 2, 6] });
    for (let i = 0; i < 200 && !['gotowe', 'blad'].includes(C.zadanie(zad.id).stan); i++) await new Promise((r) => setTimeout(r, 5));
    assert.equal(C.zadanie(zad.id).stan, 'gotowe', C.zadanie(zad.id).blad);
    assert.deepEqual(ruchy, [['kot-rig', 'akcje2']]);
});

test('🔺 rig bryły > 300 000 ścian: wycena z Remeshem, zlecenie Remesh → rig na jego wyniku (input_task_id)', async () => {
    const wolania = [];
    let odczytR = 0, odczytRig = 0;
    const f = async (url, o = {}) => {
        wolania.push({ url, metoda: o.method ?? 'GET', cialo: o.body ? JSON.parse(o.body) : null });
        if (url.endsWith('/balance')) return { ok: true, json: async () => ({ balance: 100 }) };
        if (url.endsWith('/remesh') && o.method === 'POST') return { ok: true, json: async () => ({ result: 'rm-1' }) };
        if (url.endsWith('/rigging') && o.method === 'POST') return { ok: true, json: async () => ({ result: 'rig-9' }) };
        if (url.includes('/remesh/rm-1')) return { ok: true, json: async () => (odczytR++ ? { status: 'SUCCEEDED', consumed_credits: 5, model_urls: { glb: 'https://cdn/rm.glb' } } : { status: 'IN_PROGRESS' }) };
        if (url.includes('/rigging/rig-9')) return { ok: true, json: async () => (odczytRig++ ? { status: 'SUCCEEDED', consumed_credits: 5, result: { rigged_character_glb_url: 'https://cdn/rig.glb', basic_animations: { walking_glb_url: 'https://cdn/walk.glb' } } } : { status: 'IN_PROGRESS' }) };
        if (url.startsWith('https://cdn/')) return { ok: true, arrayBuffer: async () => GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.length) };
        throw new Error(`nieoczekiwany adres ${url}`);
    };
    const C = utworzChmureBryl({ klucz: () => 'msy_test', fetch: f, coMs: 1, plikBryly: async () => ({ bajty: GLB }), metaBryly: async () => ({ tekstury: true, chmura: { rodzaj: 'obraz3d', zadanie: 'i3d-1' } }), scianyBryly: async () => 963_244,
        zapiszWersje: async (id) => ({ id: `${id}-rig` }), zapiszRuch: async () => {} });
    const w = await C.wycen('kot', { rodzaj: 'rig' });
    assert.deepEqual([w.kredyty, w.zlecenie.przedRigiem], [10, { z: 963_244, na: 100_000 }], 'rig 5 + remesh 5');
    await assert.rejects(C.zlec('kot', { rodzaj: 'rig' }, { zgodaKredyty: 5 }), /z Remeshem 963/);
    const zad = await C.zlec('kot', { rodzaj: 'rig', scianyRig: 60000 }, { zgodaKredyty: 10 });
    assert.deepEqual(wolania.find((x) => x.metoda === 'POST').cialo, { input_task_id: 'i3d-1', target_polycount: 60000, topology: 'triangle', target_formats: ['glb'] });
    for (let i = 0; i < 300 && !['gotowe', 'blad'].includes(C.zadanie(zad.id).stan); i++) await new Promise((r) => setTimeout(r, 5));
    const k = C.zadanie(zad.id);
    assert.equal(k.stan, 'gotowe', k.blad);
    assert.deepEqual(wolania.filter((x) => x.metoda === 'POST').map((x) => x.url.split('/').pop()), ['remesh', 'rigging']);
    assert.deepEqual(wolania.find((x) => x.url.endsWith('/rigging')).cialo, { input_task_id: 'rm-1', height_meters: 1.7 });
    assert.deepEqual([k.asset, k.kredyty, k.ruchy], ['kot-rig', 10, ['chod']]);
    // mała bryła — bez Remeshu
    const C2 = utworzChmureBryl({ klucz: () => 'msy_test', fetch: f, plikBryly: async () => ({ bajty: GLB }), metaBryly: async () => ({ tekstury: true, chmura: { rodzaj: 'obraz3d', zadanie: 'x' } }), scianyBryly: async () => 80_000, zapiszWersje: async () => ({}) });
    assert.equal((await C2.wycen('maly', { rodzaj: 'rig' })).kredyty, 5);
});
