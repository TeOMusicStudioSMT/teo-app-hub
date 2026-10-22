// 🌙 Wieczór Tańca — po nagraniu występu: Zebrra Sports i Mame Leon zakładane z polem `wieczor` (tancerz-bryła +
// choreograf na kanapie, fakty z choreografii), czekanie na filmy części, sklejenie prawdziwym Spawaczem i ffmpeg
// w kolejności Game Show → Zebrra → Mame Leon, publikacja do ✓, „sklej bez …”, brak bryły tancerza, trasy HTTP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import express from 'express';
import { utworzWieczorTanca, zamontujTrasyWieczoru, faktyKanapy, CZESCI } from '../services/WieczorTanca.js';
import { spawaj as spawajNaprawde } from '../services/Spawacz.js';
import { opisz as opiszNaprawde } from '../services/Montazownia.js';

const uruchom = promisify(execFileCb);
const C = {
    id: 'c-12345678', nazwa: 'Misio — The Quantum Forge', mini: { id: 'mini-misio', nazwa: 'Misio' },
    utwor: { plik: 'Bazylika/forge.mp3', tytul: 'The Quantum Forge', bpm: 88 }, fraza: 8,
    frazy: Array.from({ length: 37 }, (_, i) => ({ od: i, uderzen: 8, energia: 0.5 })), uklad: [0, 1, 2, 1, 0],
    ruchy: [{ nazwa: 'Boom_Dance' }, { nazwa: 'Bass_Beats' }, { nazwa: 'Wirujący Grom', figura: { sekcja: 'drop' } }],
    ocena: { wynik: 87, takt: 0.812, energia: 0.9, roznorodnosc: 0.95 }, nagrania: [{ nazwa: 'taniec_Misio_ab12cd.mp4' }],
};

function klip(plik, kolor, sekundy = 1) {
    execFileSync(ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${kolor}:s=320x180:r=30:d=${sekundy}`, '-f', 'lavfi', '-i', `sine=frequency=440:duration=${sekundy}`, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', plik]);
}

async function srodowisko({ assetId = 'mini-teogochi-misio-1234' } = {}) {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'wieczor-'));
    const montaz = (p) => path.join(kat, 'montaz', p);
    await fs.mkdir(montaz('taneczne-starcie'), { recursive: true });
    klip(path.join(montaz('taneczne-starcie'), 'taniec_Misio_ab12cd.mp4'), 'blue');
    const odcinki = { gameShow: new Map(), zebrra: new Map(), mameLeon: new Map() };
    odcinki.gameShow.set('s-00000001', { id: 's-00000001', stan: 'robi', plik: null, nagranie: { nazwa: 'taniec_Misio_ab12cd.mp4' } });
    const zalozone = { zebrra: [], mameLeon: [] };
    const program = (k, prefiks) => ({
        utworz: async (z) => { zalozone[k].push(z); const s = { id: `${prefiks}-0000000${zalozone[k].length}`, stan: 'studio', plik: null }; odcinki[k].set(s.id, s); return s; },
        wczytaj: async (id) => { const s = odcinki[k].get(id); if (!s) throw new Error('Nie ma takiego odcinka.'); return s; },
    });
    const publikacje = [];
    const W = utworzWieczorTanca({
        katalog: kat, katalogMontazy: async (p) => montaz(p),
        choreografie: { wczytaj: async (id) => { if (id !== C.id) throw new Error('Nie ma takiej choreografii.'); return C; } },
        gameShow: { wczytaj: async (id) => odcinki.gameShow.get(id), lista: async () => [...odcinki.gameShow.values()] },
        zebrra: program('zebrra', 'z'), mameLeon: program('mameLeon', 'm'),
        tancerz: async () => ({ imie: 'Misio', assetId }),
        os: async () => ({ sekcje: [{ nazwa: 'Intro' }, { nazwa: 'Build-up' }, { nazwa: 'Drop' }, { nazwa: 'Outro' }] }),
        imieChoreografa: async () => 'JaJo Kompozytor',
        spawaj: (o) => spawajNaprawde({ ...o, opisz: opiszNaprawde, uruchom, ffmpeg: ffmpegPath }),
        publikuj: async (z) => { publikacje.push(z); return { id: 'yt_x', etap: 'do_akceptacji' }; },
        opisz: opiszNaprawde,
    });
    // film części = plik w montażu jej programu
    const nagraj = async (k, id, kolor) => { const p = montaz(`${k}-${id}.mp4`); klip(p, kolor); Object.assign(odcinki[k].get(id), { plik: p, stan: 'do_akceptacji' }); };
    return { kat, W, zalozone, odcinki, publikacje, nagraj, montaz };
}

test('fakty kanapy: tylko liczby występu, figury i oś Kompozytora, ≤ 600 znaków', () => {
    const f = faktyKanapy(C, { os: { sekcje: [{ nazwa: 'Intro' }, { nazwa: 'Drop' }] }, choreograf: 'JaJo Kompozytor' });
    assert.match(f, /ocena 87\/100 \(ranga A\), takt 81%, energia 90%, różnorodność 95%/);
    assert.match(f, /37 fraz po 8 uderzeń, 3 różnych ruchów/);
    assert.match(f, /Figury, które JaJo Kompozytor wymyślił z klipów tancerza: Wirujący Grom/);
    assert.match(f, /oś utworu: Intro → Drop/);
    assert.ok(f.length <= 600);
});

test('wieczór: części z polem wieczor, czekanie z powodem, sklejenie Game Show → Zebrra → Mame Leon, publikacja do ✓', async () => {
    const { kat, W, zalozone, publikacje, nagraj } = await srodowisko();
    try {
        const w = await W.zacznij({ choreografia: C.id, nagranie: 'taniec_Misio_ab12cd.mp4' });
        assert.match(w.id, /^w-[0-9a-f]{8}$/);
        assert.equal(w.czesci.gameShow.id, 's-00000001', 'Game Show znaleziony po nagraniu');
        assert.deepEqual(zalozone.zebrra[0], { wystepy: [C.id], narrator: 'zebra', wspolprowadzacy: ['lew'], jezyk: 'en', wieczor: w.id });
        const m = zalozone.mameLeon[0];
        assert.equal(m.wieczor, w.id);
        assert.deepEqual(m.goscie, [{ rodzaj: 'bryla', id: 'mini-teogochi-misio-1234', imie: 'Misio' }, { rodzaj: 'teogochi', id: 'kompozytor' }]);
        assert.match(m.temat, /Misio's dance to “The Quantum Forge”/);
        assert.match(m.uwagi, /ocena 87\/100/);
        assert.equal((await W.zacznij({ choreografia: C.id, nagranie: 'taniec_Misio_ab12cd.mp4' })).id, w.id, 'to samo nagranie = ten sam wieczór');
        await W.sprawdz();
        let s = await W.wczytaj(w.id);
        assert.equal(s.stan, 'czeka');
        assert.match(s.powod, /Zebrra Sports: czeka na nagranie w studiu/);
        await assert.rejects(W.sklej(w.id), /nie ma jeszcze filmu/);
        await nagraj('gameShow', 's-00000001', 'red');
        await nagraj('zebrra', 'z-00000001', 'green');
        await nagraj('mameLeon', 'm-00000001', 'yellow');
        await W.sprawdz();
        s = await W.wczytaj(w.id);
        assert.equal(s.stan, 'do_akceptacji');
        assert.match(path.basename(s.plik), /^wieczor_Misio_en_[0-9a-f]{8}\.mp4$/);
        assert.ok(Math.abs(s.sekundy - 3) < 0.4, `trzy części po 1 s → ${s.sekundy}`);
        // kolejność: środek każdej sekundy ma barwę swojej części
        const barwa = (t) => execFileSync(ffmpegPath, ['-loglevel', 'error', '-ss', String(t), '-i', s.plik, '-frames:v', '1', '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
        const [r, g, y] = [barwa(0.5), barwa(1.5), barwa(2.5)];
        assert.ok(r[0] > 150 && r[1] < 80, 'najpierw Game Show (czerwony)');
        assert.ok(g[1] > 80 && g[0] < 80, 'potem Zebrra (zielony)');
        assert.ok(y[0] > 150 && y[1] > 150, 'na koniec Mame Leon (żółty)');
        assert.equal(publikacje[0].zrodlo.wieczor, w.id);
        assert.match(publikacje[0].kontekst, /TeO Game Show → Zebrra Sports → Mame Leon Show/);
        assert.deepEqual(CZESCI.map((k) => s.czesci[k].wFilmie), [true, true, true]);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('tancerz bez bryły: Mame Leon z powodem, „sklej bez” składa Game Show + Zebrra', async () => {
    const { kat, W, nagraj } = await srodowisko({ assetId: null });
    try {
        const w = await W.zacznij({ choreografia: C.id });
        assert.match(w.czesci.mameLeon.blad, /nie ma bryły w Assetach 3D/);
        await nagraj('gameShow', 's-00000001', 'red');
        await nagraj('zebrra', 'z-00000001', 'green');
        await W.sprawdz();
        assert.match((await W.wczytaj(w.id)).powod, /Mame Leon Show: blad/);
        const s = await W.sklej(w.id, { pomin: ['mameLeon'] });
        assert.equal(s.stan, 'do_akceptacji');
        assert.deepEqual(s.pominiete, ['mameLeon']);
        assert.ok(Math.abs(s.sekundy - 2) < 0.4);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('trasy /api/wieczor-tanca: ustawienia, start ręczny, lista ze stanem części, sklej, usuń', async () => {
    const { kat, W, nagraj } = await srodowisko();
    const app = express(); app.use(express.json());
    zamontujTrasyWieczoru(app, W);
    const srv = app.listen(0);
    const url = `http://127.0.0.1:${srv.address().port}`;
    const j = (u, metoda = 'GET', cialo) => fetch(url + u, { method: metoda, headers: { 'Content-Type': 'application/json' }, body: cialo ? JSON.stringify(cialo) : undefined }).then(async (r) => ({ kod: r.status, ...(await r.json()) }));
    try {
        assert.equal((await j('/api/wieczor-tanca/ustawienia', 'PUT', { jezyk: 'pl', auto: false })).ustawienia.jezyk, 'pl');
        assert.equal((await j('/api/wieczor-tanca/ustawienia', 'PUT', { jezyk: 'de' })).kod, 400);
        const w = (await j('/api/wieczor-tanca', 'POST', { choreografia: C.id })).wieczor;
        assert.equal(w.jezyk, 'pl');
        const l = await j('/api/wieczor-tanca');
        assert.equal(l.wieczory[0].czesci.zebrra.stan, 'studio');
        assert.equal((await j('/api/wieczor-tanca/w-00000000')).kod, 404);
        await nagraj('gameShow', 's-00000001', 'red'); await nagraj('zebrra', 'z-00000001', 'green'); await nagraj('mameLeon', 'm-00000001', 'yellow');
        assert.equal((await j(`/api/wieczor-tanca/${w.id}/sklej`, 'POST', {})).wieczor.stan, 'do_akceptacji');
        assert.equal((await j(`/api/wieczor-tanca/${w.id}`, 'DELETE')).usuniety, true);
    } finally { srv.close(); await fs.rm(kat, { recursive: true, force: true }); }
});

test('dwa mosty na jednym katalogu: drugi nie skleja naraz (zamek), ponowne sklejenie = nowy plik, stary nietknięty', async () => {
    const { kat, W, nagraj } = await srodowisko();
    try {
        const w = await W.zacznij({ choreografia: C.id });
        await nagraj('gameShow', 's-00000001', 'red'); await nagraj('zebrra', 'z-00000001', 'green'); await nagraj('mameLeon', 'm-00000001', 'yellow');
        // drugi proces = zamek już leży w katalogu wieczoru
        const zamek = path.join(kat, 'wieczor-tanca', w.id, 'sklejanie.lock');
        await fs.writeFile(zamek, '');
        await assert.rejects(W.sklej(w.id), /skleja właśnie inny proces/);
        await fs.rm(zamek);
        const a = await W.sklej(w.id);
        const rozmiar = (await fs.stat(a.plik)).size;
        const b = await W.sklej(w.id);
        assert.notEqual(b.plik, a.plik);
        assert.match(path.basename(b.plik), /_v2\.mp4$/);
        assert.equal((await fs.stat(a.plik)).size, rozmiar, 'pierwszy film nie został nadpisany');
        assert.equal(await fs.stat(zamek).catch(() => null), null, 'zamek zdjęty po sklejeniu');
        assert.deepEqual((await fs.readdir(path.dirname(a.plik))).filter((f) => f.includes('.sklejanie.')), [], 'bez plików roboczych');
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
