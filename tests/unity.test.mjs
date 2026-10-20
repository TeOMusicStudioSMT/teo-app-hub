// 🎲 Unity jako drugi silnik — wykrywanie (atrapa ścieżek Windows), projekty z pakietami, budowa CLI (atrapa procesu
// z dziennikiem), eksport brył do Assets/, trasy za Strażą. UCZCIWIE: prawdziwego Unity tu nie ma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import express from 'express';
import { utworzUnity, zamontujTrasyUnity, wersjaProjektu, pakietyProjektu, SKRYPT_BUDOWY, PAKIET_MCP } from '../services/Unity.js';
import { strazMostu } from '../services/StrazMostu.js';

const ENV = { ProgramFiles: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\s\\AppData\\Local', APPDATA: 'C:\\Users\\s\\AppData\\Roaming' };
const HUB = 'C:\\Program Files\\Unity Hub\\Unity Hub.exe';
const ED6 = 'C:\\Program Files\\Unity\\Hub\\Editor\\6000.0.23f1\\Editor\\Unity.exe';
const ED22 = 'D:\\Unity\\Editors\\2022.3.10f1\\Editor\\Unity.exe';

/** Fałszywy świat ścieżek: tylko to, co podane, istnieje. Katalogi projektów idą z prawdziwego dysku. */
function swiat(pliki, katalogi, czytaj = {}) {
    return {
        platforma: 'win32', env: ENV,
        istnieje: (p) => pliki.includes(p) || fsSync.existsSync(p),
        listaKatalogow: (p) => katalogi[p] ?? (fsSync.existsSync(p) ? fsSync.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []),
        czytaj: (p) => { if (p in czytaj) return czytaj[p]; return fsSync.readFileSync(p, 'utf8'); },
    };
}

test('wersja projektu i pakiety z manifestu (Unity MCP z git URL, glTFast)', () => {
    assert.equal(wersjaProjektu('m_EditorVersion: 6000.0.23f1\nm_EditorVersionWithRevision: 6000.0.23f1 (abc)'), '6000.0.23f1');
    assert.equal(wersjaProjektu(''), null);
    assert.deepEqual(pakietyProjektu(JSON.stringify({ dependencies: { 'com.coplaydev.unity-mcp': PAKIET_MCP, 'com.unity.cloud.gltfast': '6.0.0' } })), { mcp: true, gltf: true });
    assert.deepEqual(pakietyProjektu(JSON.stringify({ dependencies: { 'com.inny': 'https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#v10.0.0' } })), { mcp: true, gltf: false });
    assert.deepEqual(pakietyProjektu('zepsuty'), { mcp: false, gltf: false });
    assert.match(SKRYPT_BUDOWY, /namespace OtakOs[\s\S]*public static void Buduj\(\)/);
});

test('bez Unity: powód wprost i instrukcja (Hub + Unity 6 LTS + pakiet unity-mcp); Hub bez edytora — inny powód', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'unity-'));
    const pusto = utworzUnity({ katalog: kat, katalogDziennikow: kat, ...swiat([], {}, { 'C:\\Users\\s\\AppData\\Roaming\\UnityHub\\secondaryInstallPath.json': '' }) });
    const s = pusto.stan();
    assert.equal(s.gotowy, false);
    assert.match(s.powod, /nie ma Unity/);
    assert.ok(s.instrukcja.some((l) => l.includes('Unity 6 LTS')) && s.instrukcja.some((l) => l.includes(PAKIET_MCP)));
    await assert.rejects(pusto.buduj('moja'), /Nie ma projektu|Brak Unity/);
    const tylkoHub = utworzUnity({ katalog: kat, katalogDziennikow: kat, ...swiat([HUB], {}) });
    assert.equal(tylkoHub.stan().hub, HUB);
    assert.match(tylkoHub.stan().powod, /bez edytora/);
});

test('wykrywanie: edytory z Huba i z własnego katalogu Huba (secondaryInstallPath), OTAKOS_UNITY_EDITOR jako katalog, najnowszy pierwszy', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'unity-'));
    const wlasny = 'E:\\Moj\\Unity\\Editor\\Unity.exe';
    const w = swiat([HUB, ED6, ED22, wlasny], { 'C:\\Program Files\\Unity\\Hub\\Editor': ['6000.0.23f1'], 'D:\\Unity\\Editors': ['2022.3.10f1'] },
        { 'C:\\Users\\s\\AppData\\Roaming\\UnityHub\\secondaryInstallPath.json': '"D:\\\\Unity\\\\Editors"' });
    const U = utworzUnity({ katalog: kat, katalogDziennikow: kat, ...w, env: { ...ENV, OTAKOS_UNITY_EDITOR: 'E:\\Moj\\Unity\\Editor' } });
    const e = U.edytory();
    assert.deepEqual(e.map((x) => x.wersja), ['6000.0.23f1', '2022.3.10f1', null]);
    assert.ok(e.some((x) => x.sciezka === wlasny && x.zrodlo === 'OTAKOS_UNITY_EDITOR'));
    assert.equal(U.stan().gotowy, true);
});

/** Projekt Unity na dysku + atrapa procesu Unity, która pisze dziennik i kończy kodem. */
async function zProjektem({ kod = 0, dziennik = '[OtakOs] wynik: Succeeded, bajtow: 1, bledow: 0' } = {}) {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'unity-'));
    const d = path.join(kat, 'moja-gra');
    await fs.mkdir(path.join(d, 'Assets'), { recursive: true });
    await fs.mkdir(path.join(d, 'ProjectSettings'), { recursive: true });
    await fs.mkdir(path.join(d, 'Packages'), { recursive: true });
    await fs.writeFile(path.join(d, 'ProjectSettings', 'ProjectVersion.txt'), 'm_EditorVersion: 2022.3.10f1\n');
    await fs.writeFile(path.join(d, 'Packages', 'manifest.json'), JSON.stringify({ dependencies: { 'com.coplaydev.unity-mcp': PAKIET_MCP } }));
    const wolania = [];
    const uruchom = (program, args, opcje) => {
        wolania.push({ program, args, opcje });
        const p = new EventEmitter(); p.unref = () => {};
        const log = args[args.indexOf('-logFile') + 1];
        setImmediate(() => { if (log && args.includes('-batchmode')) fsSync.writeFileSync(log, `start\n${dziennik}\n`); p.emit('close', kod); });
        return p;
    };
    const U = utworzUnity({ katalog: kat, katalogDziennikow: path.join(kat, '_dzienniki'), uruchom, ...swiat([ED6, 'C:\\Program Files\\Unity\\Hub\\Editor\\2022.3.10f1\\Editor\\Unity.exe'], { 'C:\\Program Files\\Unity\\Hub\\Editor': ['6000.0.23f1', '2022.3.10f1'] }) });
    return { kat, d, U, wolania };
}
const koniec = async (U, id) => { for (let i = 0; i < 50 && U.zadanie(id).stan === 'trwa'; i++) await new Promise((r) => setTimeout(r, 10)); return U.zadanie(id); };

test('projekty: wersja i pakiety; otwarcie edytorem tej samej wersji; budowa CLI = skrypt OtakOsBudowa.cs + -executeMethod + dziennik', async () => {
    const { d, U, wolania } = await zProjektem();
    const p = U.stan().projekty;
    assert.deepEqual(p.map((x) => [x.id, x.wersja, x.mcp, x.gltf]), [['moja-gra', '2022.3.10f1', true, false]]);
    assert.deepEqual(U.stan().mcp.wProjektach, ['moja-gra']);

    const o = U.otworz('moja-gra');
    assert.equal(o.wersja, '2022.3.10f1', 'wersja z ProjectVersion.txt, nie najnowsza');
    assert.deepEqual(wolania[0].args, ['-projectPath', d]);

    const z = await U.buduj('moja-gra', 'windows');
    assert.ok(fsSync.existsSync(path.join(d, 'Assets', 'Editor', 'OtakOs', 'OtakOsBudowa.cs')));
    const a = wolania[1].args;
    assert.deepEqual(a.slice(0, 9), ['-batchmode', '-quit', '-projectPath', d, '-buildTarget', 'StandaloneWindows64', '-executeMethod', 'OtakOs.Budowa.Buduj', '-otakosWyjscie']);
    assert.equal(a[9], path.join(d, 'Build', 'windows', 'moja-gra.exe'));
    assert.ok(a.includes('-logFile'));
    const k = await koniec(U, z.id);
    assert.equal(k.stan, 'gotowe');
    assert.match(k.ogon, /\[OtakOs\] wynik: Succeeded/);
    await assert.rejects(U.buduj('moja-gra', 'ps5'), /Cel budowy/);
    assert.throws(() => U.otworz('../x'), /Zły identyfikator/);
});

test('budowa padła przy otwartym edytorze → powód po ludzku; drugi build tego samego projektu w trakcie = odmowa', async () => {
    const { U } = await zProjektem({ kod: 1, dziennik: 'Aborting batchmode due to failure:\nIt looks like another Unity instance is running with this project open.' });
    const z = await U.buduj('moja-gra', 'webgl');
    await assert.rejects(U.buduj('moja-gra', 'webgl'), /już pracuje/);
    const k = await koniec(U, z.id);
    assert.equal(k.stan, 'blad');
    assert.match(k.powod, /zamknij go/);
});

test('eksport bryły: model.glb + ruch-*.glb + karta.json do Assets/OtakOs/Bryly; bez glTFast — uwaga', async () => {
    const { d, U } = await zProjektem();
    const bib = await fs.mkdtemp(path.join(os.tmpdir(), 'assety-'));
    await fs.mkdir(path.join(bib, 'kot-1'));
    for (const f of ['model.glb', 'master.glb', 'ruch-chod.glb', 'ruch-chod.mp4', 'obraz.png']) await fs.writeFile(path.join(bib, 'kot-1', f), f);
    const assety3d = { meta: async (id) => (id === 'kot-1' ? { id, nazwa: 'Kot', opis: 'kot tancerz', tekstury: true, ruchy: [{ ruch: 'chod' }] } : null), katalogAssetu: (id) => path.join(bib, id) };
    const U2 = utworzUnity({ katalog: path.dirname(d), katalogDziennikow: bib, assety3d, ...swiat([], {}) });
    const r = await U2.eksportuj('moja-gra', 'kot-1');
    assert.deepEqual(r.pliki, ['model.glb', 'ruch-chod.glb']);
    assert.match(r.uwaga, /gltfast/);
    const karta = JSON.parse(await fs.readFile(path.join(d, 'Assets', 'OtakOs', 'Bryly', 'kot-1', 'karta.json'), 'utf8'));
    assert.deepEqual(karta.ruchy, ['chod']);
    assert.deepEqual((await U2.eksportuj('moja-gra', 'kot-1', { ruchy: false })).pliki, ['model.glb']);
    await assert.rejects(U2.eksportuj('moja-gra', 'brak-2'), /Nie ma takiej bryły/);
    void U;
});

test('trasy /api/unity za Strażą: maszyna tak, zdalnie nawet z kluczem nie', async () => {
    const { U } = await zProjektem();
    const app = express();
    app.use(express.json());
    app.use(strazMostu({ klucz: () => 'k'.repeat(32) }));
    zamontujTrasyUnity(app, U);
    const s = http.createServer(app);
    await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
    const b = `http://127.0.0.1:${s.address().port}`;
    try {
        const st = await (await fetch(`${b}/api/unity/stan`)).json();
        assert.equal(st.success, true);
        assert.equal(st.projekty[0].id, 'moja-gra');
        const zla = await (await fetch(`${b}/api/unity/build`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projekt: 'moja-gra', cel: 'xbox' }) })).json();
        assert.equal(zla.success, false);
        const zdalnie = await fetch(`${b}/api/unity/launch`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '8.8.8.8', 'x-forwarded-for': '8.8.8.8', 'x-teo-klucz': 'k'.repeat(32) }, body: '{"projekt":"moja-gra"}' });
        assert.equal(zdalnie.status, 403);
    } finally { await new Promise((ok) => s.close(ok)); }
});
