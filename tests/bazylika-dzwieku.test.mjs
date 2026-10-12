// 🎵 Bazylika Dźwięku — bit WAV z gry → mp3 w bibliotece (prawdziwy ffmpeg), album z utworów biblioteki → plik
// z przejściami + lista z czasami + produkt Marketplace, utwór spoza biblioteki odrzucony, zamówienie u Joanny
// (prompt od modelu albo uczciwy szablon) na atrapie generatora, zgubione po restarcie = „przerwane”.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { utworzBazylike, oczyscPrompt, szablonPromptu, nazwaPliku } from '../services/BazylikaDzwieku.js';

const ex = promisify(execFile);
const uruchom = (c, a, o) => ex(c, a, { windowsHide: true, maxBuffer: 1 << 24, ...o });

/** WAV mono 16-bit: ton `hz` przez `sek` sekund. */
function wav(sek, hz = 440, sr = 22050) {
    const n = Math.round(sek * sr);
    const b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
    b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / sr) * 8000), 44 + i * 2);
    return b;
}

async function srodowisko(o = {}) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bazylika-'));
    const muzyka = path.join(root, 'muzyka');
    await fs.mkdir(muzyka, { recursive: true });
    const wywolania = [];
    const B = utworzBazylike({ katalogMuzyki: muzyka, katalog: path.join(root, 'wymiar'), ffmpeg, uruchom, czekaj: async () => {}, most: async (s, c) => { wywolania.push([s, c]); return o.most ? o.most(s, c) : { success: true, product: { id: 'muzyka-x', priceGrv: c?.priceGrv } }; }, ...o.cfg });
    return { root, muzyka, B, wywolania, sprzataj: () => fs.rm(root, { recursive: true, force: true }) };
}

test('bit z Pracowni: WAV → mp3 w Bazylika/ + wzór; zły format odrzucony', async () => {
    const s = await srodowisko();
    try {
        const bit = await s.B.zapiszBit({ nazwa: 'Taniec Żaby', dataURL: `data:audio/wav;base64,${wav(2).toString('base64')}`, bpm: 128, wzor: { kroki: [[1, 0, 0, 0]] } });
        assert.match(bit.plik, /^Bazylika\/Taniec_Zaby_[a-z0-9]+\.mp3$/);
        const st = await fs.stat(path.join(s.muzyka, bit.plik));
        assert.ok(st.size > 1000);
        const lista = await s.B.bity();
        assert.equal(lista[0].nazwa, 'Taniec Żaby');
        assert.equal(lista[0].bpm, 128);
        assert.deepEqual(lista[0].wzor, { kroki: [[1, 0, 0, 0]] });
        await assert.rejects(s.B.zapiszBit({ dataURL: 'data:audio/mpeg;base64,AAAA' }), /WAV/);
        await assert.rejects(s.B.zapiszBit({ dataURL: `data:audio/wav;base64,${Buffer.alloc(2000).toString('base64')}` }), /nie jest plik WAV/);
    } finally { await s.sprzataj(); }
});

test('album: utwory z biblioteki → jeden plik z przejściem, lista z czasami, produkt Marketplace; spoza biblioteki — nie', async () => {
    const s = await srodowisko();
    try {
        await fs.writeFile(path.join(s.muzyka, 'Pierwszy.wav'), wav(4, 330));
        await fs.mkdir(path.join(s.muzyka, 'Bazylika'));
        await fs.writeFile(path.join(s.muzyka, 'Bazylika', 'Drugi.wav'), wav(3, 550));
        const a = await s.B.album({ tytul: 'Noc na Wyspie', utwory: ['Pierwszy.wav', 'Bazylika/Drugi.wav'], cenaGRV: 250, przejscie: 1 });
        assert.match(a.plik, /^_Albumy\/Noc_na_Wyspie_[a-z0-9]+\.mp3$/);
        assert.deepEqual(a.utwory.map((u) => [u.nr, u.tytul, u.start, u.sekundy]), [[1, 'Pierwszy', 0, 4], [2, 'Drugi', 3, 3]]);
        assert.ok(Math.abs(a.sekundy - 6) <= 1, `długość z przejściem ${a.sekundy}`);
        const { stderr } = await uruchom(ffmpeg, ['-hide_banner', '-i', path.join(s.muzyka, a.plik)]).catch((e) => e);
        const m = /Duration:\s*00:00:(\d+\.\d+)/.exec(stderr);
        assert.ok(m && Math.abs(Number(m[1]) - 6) < 0.6, `plik albumu ~6 s (${m?.[1]})`);
        const [sciezka, cialo] = s.wywolania.find(([x]) => x === '/api/market/create');
        assert.equal(sciezka, '/api/market/create');
        assert.deepEqual([cialo.module, cialo.type, cialo.name, cialo.priceGrv], ['muzyka', 'album', 'Noc na Wyspie', 250]);
        assert.match(cialo.desc, /1\. Pierwszy \(0:00\)\n2\. Drugi \(0:03\)/);
        assert.equal((await s.B.albumy())[0].tytul, 'Noc na Wyspie');
        await assert.rejects(s.B.album({ tytul: 'X', utwory: ['../poza.wav', 'Pierwszy.wav'] }), /nie jest utworem z biblioteki/);
        await assert.rejects(s.B.album({ tytul: 'X', utwory: ['Pierwszy.wav'] }), /co najmniej 2/);
    } finally { await s.sprzataj(); }
});

test('zamówienie u Joanny: prompt od modelu → generator → odbiór do biblioteki; bez modelu — szablon', async () => {
    let n = 0;
    const s = await srodowisko({
        cfg: { pisz: async () => '<think>hm</think>Prompt: "upbeat tropical house, marimba, 124 bpm, instrumental"' },
        most: async (sc) => {
            if (sc === '/api/music/generate') return { promptId: 'p1', engine: 'ace' };
            if (sc.startsWith('/api/music/progress')) return ++n < 2 ? { stan: 'liczy' } : { stan: 'gotowe', audio: [{ filename: 'a.flac', subfolder: '', type: 'output' }] };
            if (sc === '/api/music/collect') return { savedPath: path.join(s.muzyka, 'Bazylika_tropik_1.flac') };
            return {};
        },
    });
    try {
        const z = await s.B.zamow({ opis: 'wesoły tropikalny taniec z marimbą', bpm: 124, sekundy: 60 });
        assert.equal(z.stan, 'czeka');
        await s.B._czekajNaKolejke();
        const [g] = await s.B.zamowienia();
        assert.deepEqual([g.stan, g.prompt, g.promptOdJoanny, g.plik], ['gotowe', 'upbeat tropical house, marimba, 124 bpm, instrumental', true, 'Bazylika_tropik_1.flac']);
        const gen = s.wywolania.find(([x]) => x === '/api/music/generate')[1];
        assert.deepEqual([gen.duration, gen.bpm], [60, 124]);
        await assert.rejects(s.B.zamow({ opis: 'x' }), /Opisz/);
    } finally { await s.sprzataj(); }
    assert.equal(oczyscPrompt('Tags: "lofi, rain"\ndruga linia'), 'lofi, rain');
    assert.match(szablonPromptu({ opis: 'kot tańczy', bpm: 120, styl: '' }), /dance, energetic, groovy beat, 120 bpm, instrumental, kot tańczy/);
    assert.equal(nazwaPliku('Złota Pauza!'), 'Zlota_Pauza');
});

test('zamówienie zgubione przy restarcie mostu = „przerwane”, a nie wieczne „gra”', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bazylika-'));
    try {
        await fs.mkdir(path.join(root, 'wymiar'), { recursive: true });
        await fs.writeFile(path.join(root, 'wymiar', 'zamowienia.json'), JSON.stringify([{ id: 'zam-1', opis: 'x', stan: 'gra' }]));
        const B = utworzBazylike({ katalogMuzyki: path.join(root, 'm'), katalog: path.join(root, 'wymiar'), ffmpeg, uruchom, most: async () => ({}) });
        const [z] = await B.zamowienia();
        assert.equal(z.stan, 'przerwane');
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});
