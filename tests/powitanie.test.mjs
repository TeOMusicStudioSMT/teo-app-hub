/** Powitanie Dnia: sentencje stada → film (ujęcie / dzieło / barwa + napis), bez udawania. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as P from '../services/PowitanieDnia.js';

const require = createRequire(import.meta.url);
/** ffmpeg z node_modules (jak most); na maszynie bez binarki test montażu mówi wprost, że pominięty. */
function znajdzFfmpeg() {
    for (const m of ['ffmpeg-static', '@ffmpeg-installer/ffmpeg']) {
        try {
            const p = require(m);
            const sciezka = typeof p === 'string' ? p : p?.path;
            if (sciezka && fs.existsSync(sciezka)) return sciezka;
        } catch { /* następny */ }
    }
    return null;
}
const FFMPEG = znajdzFfmpeg();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'powitanie-'));

test('odczytaj: SENTENCJA/OBRAZ, markdown i cudzysłowy precz, bez linii → pierwsze zdanie', () => {
    assert.deepEqual(P.odczytaj('**SENTENCJA:** „Dzień dobry, Suwerenie — ballada czeka."\nOBRAZ: warm dawn light over a lego harbour, slow dolly in'),
        { sentencja: 'Dzień dobry, Suwerenie — ballada czeka.', obraz: 'warm dawn light over a lego harbour, slow dolly in' });
    assert.deepEqual(P.odczytaj('Witaj! Dziś gram tylko dla Ciebie.'), { sentencja: 'Witaj! Dziś gram tylko dla Ciebie.', obraz: null });
    assert.equal(P.odczytaj('').sentencja, '');
    assert.ok(P.odczytaj(`SENTENCJA: ${'słowo '.repeat(60)}`).sentencja.length <= 140);
});

test('zawiń: po słowach, najwyżej 4 linie, ucięta kończy się „…"', () => {
    assert.deepEqual(P.zawin('Dzień dobry Suwerenie', 34), ['Dzień dobry Suwerenie']);
    const l = P.zawin('a '.repeat(200).trim() + ' koniec', 10, 4);
    assert.equal(l.length, 4);
    assert.ok(l.every((x) => x.length <= 11));
    assert.ok(l[3].endsWith('…'));
});

test('uczestnicy: tylko wyklute, najpierw aktywni w ostatniej dobie, potem XP; limit', () => {
    const teraz = Date.parse('2026-09-27T08:00:00Z');
    const gatunki = [
        { id: 'jajo', imie: 'Jajo', wyklute: false, xp: 999 },
        { id: 'kodeks', imie: 'Kodeks', wyklute: true, xp: 50 },
        { id: 'joanna', imie: 'Joanna', wyklute: true, xp: 10 },
        { id: 'paleta', imie: 'Paleta', wyklute: true, xp: 80 },
    ];
    const zdarzenia = [
        { agent: 'Joanna', tresc: 'skomponowała balladę', kiedy: '2026-09-27T06:00:00Z' },
        { agent: 'joanna', tresc: 'nagrała refren', kiedy: '2026-09-27T07:00:00Z' },
        { agent: 'Kodeks', tresc: 'stary ślad', kiedy: '2026-09-20T07:00:00Z' },
    ];
    const u = P.wybierzUczestnikow(gatunki, zdarzenia, { teraz, max: 3 });
    assert.deepEqual(u.map((x) => x.g.id), ['joanna', 'paleta', 'kodeks']);
    assert.deepEqual(u[0].slady.map((s) => s.tresc), ['nagrała refren', 'skomponowała balladę']);
    assert.equal(P.wybierzUczestnikow(gatunki, zdarzenia, { teraz, max: 1 }).length, 1);
});

test('data po polsku i lokalny dzień', () => {
    assert.equal(P.dataSlownie('2026-09-27'), 'niedziela, 27 września');
    assert.equal(P.dzien(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
    assert.equal(P.kolorFf('#A855F7'), '0xA855F7');
    assert.equal(P.kolorFf('czerwony'), '0xf4c84a');
    assert.equal(P.tloZKoloru('#ffffff', 0.5), '0x808080');
    assert.equal(P.jasniej('#000000', 0.5), '0x808080');
});

test('scena: tekst tylko przez textfile (expansion=none), względne nazwy, czas i format', () => {
    const a = P.argumentySceny({
        tlo: { rodzaj: 'dzielo', plik: 'dzielo-1' }, czcionka: 'czcionka.ttf', czas: 7, wyjscie: 'scena-01.mp4',
        linie: [{ plik: 't-1-0.txt', rozmiar: 50, kolor: 'white', y: 480 }],
    });
    const f = a[a.indexOf('-filter_complex') + 1];
    assert.match(f, /textfile=t-1-0\.txt:expansion=none/);
    assert.match(f, /fontfile=czcionka\.ttf/);
    assert.match(f, /zoompan/);
    assert.ok(!/[A-Z]:[\\/]/.test(a.join(' ')), 'żadnych ścieżek z literą dysku w argumentach');
    assert.equal(a.at(-1), 'scena-01.mp4');
});

test('zrób: bez wyklutych — błąd zapisany, bez filmu', async () => {
    const kat = tmp();
    P.skonfiguruj({ katalog: kat, gatunki: async () => [], zdarzenia: () => [], szyna: null });
    await assert.rejects(P.zrob({ data: '2026-09-27' }), /Nie ma wyklutych/);
    const m = await P.powitanie('2026-09-27');
    assert.equal(m.stan, 'blad');
    assert.equal(m.maFilm, false);
    assert.equal((await P.ostatnie()).gotowe, null);
});

test('zrób: model milczy u wszystkich — nie ma filmu i mówi to wprost', async () => {
    const kat = tmp();
    P.skonfiguruj({
        katalog: kat, ffmpeg: FFMPEG ?? 'ffmpeg', szyna: null,
        gatunki: async () => [{ id: 'joanna', imie: 'Joanna', wyklute: true }],
        zdarzenia: () => [], chat: async () => '   ',
    });
    await assert.rejects(P.zrob({ data: '2026-09-27' }), /Żaden TeOgochi nie napisał sentencji.*Joanna: model oddał pustą/);
    assert.equal(fs.existsSync(P.plikFilmu('2026-09-27')), false);
});

test('zrób: prawdziwy film — ujęcie z ComfyUI, dzieło, barwa, muzyka; ComfyUI pada → reszta bez czekania', { skip: FFMPEG ? false : 'brak binarki ffmpeg w node_modules — montażu nie sprawdzono' }, async () => {
    const kat = tmp(), media = tmp();
    // Materiały „z dysku": krótkie ujęcie, obraz dzieła, utwór — zrobione ffmpegiem.
    const ujecie = path.join(media, 'wan.mp4'), obraz = path.join(media, 'dzielo.png'), utwor = path.join(media, 'motyw.mp3');
    execFileSync(FFMPEG, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=s=832x480:r=16:d=2', '-pix_fmt', 'yuv420p', '-y', ujecie]);
    execFileSync(FFMPEG, ['-v', 'error', '-f', 'lavfi', '-i', 'mandelbrot=s=640x640', '-frames:v', '1', '-y', obraz]);
    execFileSync(FFMPEG, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-y', utwor]);

    const zlecone = [], szyna = [];
    let wideoProb = 0;
    const most = async (sciezka, body) => {
        zlecone.push(sciezka);
        if (sciezka === '/api/wideo/generuj') {
            wideoProb++;
            if (wideoProb > 1) throw new Error('ComfyUI: brak wag Wana');   // druga próba pada
            return { zlecenie: 'z1' };
        }
        if (sciezka.startsWith('/api/wideo/zlecenie/')) return { gotowe: true, materialy: [{ nazwa: 'wan.mp4', sciezka: ujecie }] };
        if (sciezka === '/api/wideo/do-projektu') return { sciezka: ujecie };
        throw new Error(`nieznana trasa ${sciezka} ${JSON.stringify(body)}`);
    };
    P.skonfiguruj({
        katalog: kat, ffmpeg: FFMPEG, most, odstepMs: 5, limitUjeciaMs: 5000, wideo: true,
        szyna: { nadaj: async (z) => { szyna.push(z.tresc); } },
        gatunki: async () => [
            { id: 'joanna', imie: 'Joanna', kolor: '#a855f7', wyklute: true, xp: 30 },
            { id: 'paleta', imie: 'Paleta', kolor: '#f59e0b', wyklute: true, xp: 20 },
            { id: 'kodeks', imie: 'Kodeks', kolor: '#22c55e', wyklute: true, xp: 10 },
        ],
        zdarzenia: () => [],
        modelDla: async (id) => (id === 'kodeks' ? 'qwen3:4b' : null),
        chat: async (model, [, user]) => `SENTENCJA: Dzień dobry, Suwerenie — dziś „100%" dla Ciebie: gram, maluję i piszę.\nOBRAZ: golden dawn over a lego harbour (${model})`,
        dziela: async (id) => (id === 'paleta' ? [{ tytul: 'Paleta barw', media: { typ: 'obraz', url: '/wystawa/plik/p1' } }] : []),
        pobierz: async (url) => (url === '/wystawa/plik/p1' ? fs.readFileSync(obraz) : null),
        muzyka: async () => utwor,
    });

    const m = await P.zrob({ data: '2026-09-27' });
    assert.equal(m.stan, 'gotowe');
    assert.deepEqual(m.sceny.map((s) => [s.imie, s.tlo]), [['Joanna', 'ujecie'], ['Paleta', 'dzielo'], ['Kodeks', 'kolor']]);
    assert.equal(m.sceny[2].model, 'qwen3:4b');
    assert.match(m.comfy, /brak wag/);
    assert.equal(wideoProb, 2, 'po pierwszym padnięciu ComfyUI trzecia scena już nie próbuje');
    assert.equal(m.muzyka, 'motyw.mp3');

    const film = P.plikFilmu('2026-09-27');
    assert.ok(fs.existsSync(film));
    assert.equal(fs.existsSync(path.join(kat, '2026-09-27', 'praca')), false, 'katalog roboczy sprzątnięty');
    // Długość i strumienie z samego pliku.
    const opis = (() => { try { execFileSync(FFMPEG, ['-hide_banner', '-i', film], { stdio: 'pipe' }); } catch (e) { return String(e.stderr); } return ''; })();
    const [, h, mi, s] = opis.match(/Duration: (\d+):(\d+):([\d.]+)/);
    const sekund = Number(h) * 3600 + Number(mi) * 60 + Number(s);
    assert.ok(Math.abs(sekund - (4.5 + 4.5 + 3 * 7)) < 0.6, `długość ${sekund}`);
    assert.match(opis, /Video: h264.*1280x720/);
    assert.match(opis, /Audio: aac/);

    const o = await P.ostatnie();
    assert.equal(o.gotowe.data, '2026-09-27');
    assert.ok(szyna.some((t) => /powitanie dnia gotowe: 3 sentencji, 1 ujęć z ComfyUI/.test(t)));
});

test('zrób: uszkodzona muzyka nie zabiera filmu — cichy film i powód w metadanych', { skip: FFMPEG ? false : 'brak binarki ffmpeg w node_modules' }, async () => {
    const kat = tmp(), media = tmp();
    const zepsuta = path.join(media, 'zepsuta.mp3');
    fs.writeFileSync(zepsuta, Buffer.from('ID3 to nie jest mp3'.repeat(50)));
    P.skonfiguruj({
        katalog: kat, ffmpeg: FFMPEG, most: null, szyna: null, pobierz: null,
        gatunki: async () => [{ id: 'joanna', imie: 'Joanna', kolor: '#a855f7', wyklute: true }],
        zdarzenia: () => [], modelDla: async () => null, karta: async () => null,
        chat: async () => 'SENTENCJA: Dzień dobry.\nOBRAZ: dawn',
        muzyka: async () => zepsuta,
    });
    const m = await P.zrob({ data: '2026-09-28' });
    assert.equal(m.stan, 'gotowe');
    assert.equal(m.muzyka, null);
    assert.match(m.muzykaBlad, /zepsuta\.mp3/);
    assert.ok(fs.existsSync(P.plikFilmu('2026-09-28')));
});

test('pętla: przed godziną nic; bez próby albo po restarcie — tak; po błędzie — czeka na Suwerena', async () => {
    const kat = tmp();
    P.skonfiguruj({ katalog: kat, godzina: 5 });
    const rano = new Date(2026, 8, 27, 4, 59), pozniej = new Date(2026, 8, 27, 7, 0);
    assert.equal(await P.czasNaPowitanie(rano), false);
    assert.equal(await P.czasNaPowitanie(pozniej), true);
    const zapisz = (stan) => { fs.mkdirSync(path.join(kat, '2026-09-27'), { recursive: true }); fs.writeFileSync(path.join(kat, '2026-09-27', 'powitanie.json'), JSON.stringify({ data: '2026-09-27', stan, sceny: [] })); };
    zapisz('trwa');   // zapis „trwa" bez pracy w tym procesie = restart mostu w połowie
    assert.equal((await P.powitanie('2026-09-27')).stan, 'przerwane');
    assert.equal(await P.czasNaPowitanie(pozniej), true);
    zapisz('blad');
    assert.equal(await P.czasNaPowitanie(pozniej), false);
    assert.equal(await P.powitanie('../../etc'), null);
});
