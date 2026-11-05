// 👗🦓 Zebrra Fashion — looki (FLUX z wzorami), program z prowadzącym, wstawka reklamowa. Prawdziwy ffmpeg, atrapy FLUX/modelu/głosu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { utworzZebrraFashion, kolekcjePostaci, odczytajPokaz, imieZOpisu } from '../services/ZebrraFashion.js';

const uruchom = promisify(execFile);
const png = (plik, kolor) => uruchom(ffmpegPath, ['-y', '-f', 'lavfi', '-i', `color=c=${kolor}:s=320x400`, '-frames:v', '1', plik]);
const opisz = async (p) => { const { stderr } = await uruchom(ffmpegPath, ['-i', p], { windowsHide: true }).catch((e) => ({ stderr: e.stderr })); const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr); return { sekundy: m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null }; };

async function srodowisko({ odpowiedz } = {}) {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'zebrra-fashion-'));
    const fashion = path.join(kat, 'fashion'), obrazy = path.join(kat, 'obrazy'), montaz = path.join(kat, 'montaz');
    await fs.mkdir(path.join(obrazy, 'mini-bor'), { recursive: true });
    await png(path.join(obrazy, 'mini-bor', 'obraz.png'), 'orange');
    const kolekcja = async (id, ubior, kiedy, tytul) => {
        const d = path.join(fashion, 'public', 'nadruki', 'kolekcje', id); await fs.mkdir(d, { recursive: true });
        await png(path.join(d, 'podglad-przod.png'), 'black'); await png(path.join(d, 'podglad-tyl.png'), 'gray');
        await fs.writeFile(path.join(d, 'kolekcja.json'), JSON.stringify({ id, obraz: 'mini-bor', opisMotywu: 'Mini-TeOgochi „Borowik”: grzybek', ubior, kolor: 'czarny', styl: ubior === 'kurtka' ? 'haft' : 'plaski', stan: 'gotowa', kiedy, tekst: { tytul, podtytul: 'Light', opowiesc: 'Story of lanterns.', cytat: 'Remember.' } }));
    };
    await kolekcja('k-00000001', 'koszulka', '2026-11-06T10:00:00Z', 'Old Tee');
    await kolekcja('k-00000002', 'koszulka', '2026-11-06T11:00:00Z', 'New Tee');
    await kolekcja('k-00000003', 'kurtka', '2026-11-06T09:00:00Z', 'Varsity');
    const rysowane = [], publikacje = [];
    let n = 0;
    const F = utworzZebrraFashion({
        katalog: path.join(kat, 'wymiar'), katalogFashion: fashion, katalogObrazow: obrazy, katalogMontazy: async () => montaz,
        rysuj: async (o) => { rysowane.push(o); const p = path.join(kat, `flux-${++n}.png`); await uruchom(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'color=c=purple:s=1280x720', '-frames:v', '1', p]); return p; },
        pisz: async () => odpowiedz ?? 'INTRO: Welcome to Zebrra Fashion with Borowik.\nLOOK 1: The varsity jacket with patches.\nLOOK 2: The tee with lanterns.\nOUTRO: The shop link is in the description.',
        model: async () => 'atrapa', narrator: (id) => (id === 'zebra' ? { imie: 'Gol Donna', kolor: '#f5f5f5', temperament: 'elegant' } : null),
        opisz, ffmpeg: ffmpegPath, uruchom, publikuj: async (z) => { publikacje.push(z); return { id: 'yt_1', etap: 'do_akceptacji' }; }, sklep: async () => 'https://teo.center/',
    });
    return { F, kat, fashion, rysowane, publikacje, montaz };
}
const czekaj = async (F, id) => { for (let i = 0; i < 600; i++) { const s = await F.czytaj(id); if (s.stan !== 'robi') return s; await new Promise((r) => setTimeout(r, 100)); } throw new Error('timeout'); };

test('kolekcje postaci: najnowsza na model, kurtka przed koszulką, imię z opisu motywu', async () => {
    const { fashion } = await srodowisko();
    const ks = await kolekcjePostaci(fashion, 'borowik');
    assert.deepEqual(ks.map((k) => k.id), ['k-00000003', 'k-00000002']);
    assert.equal(imieZOpisu('Mini-TeOgochi „Borowik”: x'), 'Borowik');
    assert.deepEqual(await kolekcjePostaci(fashion, 'Koralik'), []);
});

test('prezenter: brak linii albo cena = odmowa', () => {
    assert.throws(() => odczytajPokaz('INTRO: a\nOUTRO: b', 1), /LOOK 1/);
    assert.throws(() => odczytajPokaz('INTRO: a\nLOOK 1: only 119 EUR!\nOUTRO: b', 1), /cen/);
    assert.equal(odczytajPokaz('**INTRO:** hi\nLOOK 1: x\nOUTRO: y', 1).intro, 'hi');
});

test('odcinek: looki z dwoma wzorami (postać + makieta), program sklejony, publikacja z lokowaniem; look raz na kolekcję', async () => {
    const { F, rysowane, publikacje } = await srodowisko();
    const s = await czekaj(F, (await F.utworz({ postac: 'Borowik', bezGlosu: true })).id);
    assert.equal(s.stan, 'gotowy', s.powod);
    assert.equal(rysowane.length, 2);
    assert.ok(rysowane.every((r) => r.referencje.length === 2 && r.referencje[0].endsWith(path.join('mini-bor', 'obraz.png')) && r.referencje[1].endsWith('podglad-przod.png')));
    assert.match(rysowane[0].prompt, /Varsity Jacket/);
    assert.ok(s.sekundy > 10, `film ${s.sekundy} s`);   // intro + 2 × (look + plansza) + outro
    assert.equal(publikacje[0].zrodlo.reklama, true);
    assert.match(publikacje[0].kontekst, /teo\.center/);
    await czekaj(F, (await F.utworz({ postac: 'Borowik', bezGlosu: true })).id);
    assert.equal(rysowane.length, 2, 'drugi odcinek bierze looki z pamięci');
});

test('wstawka reklamowa: ~3 s mp4, raz liczona; postać bez kolekcji = null', async () => {
    const { F } = await srodowisko();
    const w = await F.wstawka('Borowik', { jezyk: 'en' });
    assert.ok(w.endsWith('.mp4'));
    const { sekundy } = await opisz(w);
    assert.ok(sekundy >= 2.5 && sekundy < 8, `${sekundy}`);
    assert.equal(await F.wstawka('Borowik', { jezyk: 'en' }), w);
    assert.equal(await F.wstawka('Koralik'), null);
    await assert.rejects(F.utworz({ postac: 'Koralik' }), /nie ma gotowych kolekcji/);
});
