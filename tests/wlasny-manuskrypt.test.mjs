// 📥 Własny Manuskrypt: PDF/DOCX/TXT + ilustracje → sceny (tekst w 100%) → Głosek → film, audiobook, Żywa Księga.
// Prawdziwy ffmpeg i pdf.js; atrapy: głos (sinus z ffmpeg), opis i FLUX.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { utworzManuskrypt, podzielNaSceny, blokiZTxt, tekstZTxt, tekstStronyPdf, rodzajPliku, normalizuj, stronyZPdf, blokiZDocx } from '../services/WlasnyManuskrypt.js';
import { opisz } from '../services/Montazownia.js';
import { SCIEZKI_TYLKO_LOKALNE } from '../services/StrazMostu.js';
import { zrobPdf } from './fixtures/pdfTestowy.mjs';
import { zrobDocx } from './fixtures/docxTestowy.mjs';
import { utworzWypozyczalnie } from '../services/WypozyczalniaKsiag.js';

const uruchom = promisify(execFile);
const dataUrl = (b, typ) => `data:${typ};base64,${b.toString('base64')}`;
async function jpeg(kat, s = '320x200') { const p = path.join(kat, `t-${s}.jpg`); await uruchom(ffmpegPath, ['-y', '-f', 'lavfi', '-i', `testsrc=s=${s}`, '-frames:v', '1', p]); return fs.readFile(p); }
async function png(kat) { const p = path.join(kat, 't.png'); await uruchom(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'color=c=teal:s=400x300', '-frames:v', '1', p]); return fs.readFile(p); }

async function srodowisko({ rysuj = null, cisza = () => false } = {}) {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'manuskrypt-'));
    const mowy = [];
    let M = null;
    const W = utworzWypozyczalnie({ katalog: path.join(kat, 'teostory'), obrazLokalny: (u) => M.plikZAdresu(u) });
    M = utworzManuskrypt({
        katalog: path.join(kat, 'manuskrypty'), katalogMontazy: async (p) => path.join(kat, 'produkcje', p, 'montaz'), ffmpeg: ffmpegPath, uruchom: (c, a, o) => uruchom(c, a, o), opisz,
        mow: async ({ tekst, glos, jezyk }) => {
            mowy.push({ tekst, glos, jezyk });
            const p = path.join(kat, `mowa-${mowy.length}.wav`);
            // atrapa: mowa ok. 12 znaków/s; `cisza()` = silnik oddaje 0,2 s ciszy (jak Chatterbox 2026-11-07)
            const d = Math.max(1.2, tekst.length / 12).toFixed(2);
            await uruchom(ffmpegPath, ['-y', '-f', 'lavfi', '-i', cisza(tekst) ? 'anullsrc=r=24000:cl=mono:d=0.2' : `sine=f=440:d=${d}`, ...(cisza(tekst) ? ['-t', '0.2'] : []), '-ar', '24000', p]);
            return { audio: await fs.readFile(p), ext: 'wav' };
        },
        pisz: async () => 'A small cat watching stars from a moonlit rooftop.',
        rysuj: rysuj ?? (async () => { const p = path.join(kat, 'flux.png'); await fs.writeFile(p, await png(kat)); return p; }),
        publikujYT: async (z) => ({ id: 'yt_1', etap: 'do_akceptacji', ...z }),
        publikujWypozyczalnia: (o) => W.publikuj(o),
    });
    return { M, W, kat, mowy };
}
const czekaj = async (M, id) => { for (let i = 0; i < 400; i++) { const z = await M.czytaj(id); if (['gotowe', 'blad'].includes(z.stan)) return z; await new Promise((r) => setTimeout(r, 100)); } throw new Error('za długo'); };

test('rodzaj pliku po zawartości; .doc odrzucony wprost', () => {
    assert.equal(rodzajPliku(Buffer.from('%PDF-1.4 x')), 'pdf');
    assert.equal(rodzajPliku(Buffer.from('Ala ma kota')), 'txt');
    assert.throws(() => rodzajPliku(Buffer.from('Ala'), 'ksiazka.doc'), /nie jest obsługiwany/);
});

test('TXT: cp1250 rozpoznany, nagłówki, akapity; podział zachowuje 100% tekstu', () => {
    const cp = Buffer.from([0x52, 0x6f, 0x7a, 0x64, 0x7a, 0x69, 0x61, 0xb3]);   // „Rozdział” w Windows-1250 (ł = 0xB3)
    assert.equal(tekstZTxt(cp), 'Rozdział');
    const zdanie = 'Kot patrzył w gwiazdy i liczył je cicho. ';
    const t = `# Rozdział pierwszy\n\n${zdanie.repeat(30)}\n\n— Miau — powiedział kot. — Dobranoc!\n\nRozdział drugi\n\nRano było słońce.`;
    const bloki = blokiZTxt(t);
    assert.equal(bloki[0].naglowek, true); assert.equal(bloki[0].tekst, 'Rozdział pierwszy');
    assert.equal(bloki[3].naglowek, true);
    const { sceny, zgodnosc } = podzielNaSceny(bloki, { slowNaScene: 60 });
    assert.ok(zgodnosc.zgodne, 'sceny = źródło');
    assert.ok(sceny.length >= 4);
    assert.equal(sceny.at(-1).rozdzial, 'Rozdział drugi');
    for (const s of sceny) assert.doesNotMatch(s.tekst, /cicho\.\S/);   // zdania nie pocięte w środku
});

test('PDF: numery stron znikają, przeniesienia złączone', () => {
    assert.equal(tekstStronyPdf('Był sobie ko-\ntek, który\nlubił gwiazdy.\n12'), 'Był sobie kotek, który lubił gwiazdy.');
});

test('podział wg folderu ilustracji: tyle scen, ile obrazów; obraz autora otwiera scenę', () => {
    const bloki = Array.from({ length: 12 }, (_, i) => ({ tekst: `Akapit ${i + 1}. To jest zwykłe zdanie w tej książce.`, obrazy: [] }));
    const { sceny, zgodnosc } = podzielNaSceny(bloki, { tryb: 'ilosc', ileScen: 4 });
    assert.equal(sceny.length, 4); assert.ok(zgodnosc.zgodne);
    const zObrazami = [{ tekst: 'Wstęp.', obrazy: [{ plik: 'a.png' }] }, { tekst: 'Dalej.', obrazy: [] }, { tekst: 'Nowa scena.', obrazy: [{ plik: 'b.png' }] }];
    const r = podzielNaSceny(zObrazami, { slowNaScene: 500 });
    assert.deepEqual(r.sceny.map((s) => s.obraz?.plik), ['a.png', 'b.png']);
    assert.equal(normalizuj(r.sceny[0].tekst), 'Wstęp. Dalej.');
});

test('PDF z JPEG i obrazem Flate → strony z tekstem i obrazami (pdf.js)', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-pdf-'));
    const rgb = Buffer.alloc(128 * 128 * 3, 90);
    const pdf = zrobPdf([{ tekst: ['Rozdzial pierwszy', 'Byl sobie kot.'], jpeg: await jpeg(kat), jpegW: 320, jpegH: 200 }, { tekst: ['Druga strona.', '2'] }, { tekst: ['Trzecia.'], rgb: { w: 128, h: 128, dane: rgb } }]);
    const s = await stronyZPdf(pdf);
    assert.equal(s.length, 3);
    assert.equal(s[0].obrazy.length, 1); assert.equal(s[0].obrazy[0].w, 320);
    assert.equal(s[1].tekst, 'Druga strona.');
    assert.equal(s[2].obrazy[0].w, 128);
});

test('DOCX: nagłówek ze stylu, obraz w miejscu autora, tytuł i autor z właściwości', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-docx-'));
    const d = await blokiZDocx(zrobDocx([{ tekst: 'Rozdział 1', styl: 'Heading1' }, { obraz: true }, { tekst: 'Zając & lis szli przez las.' }, { tekst: 'Koniec.' }], { png: await png(kat), tytul: 'Las nocą' }));
    assert.equal(d.tytul, 'Las nocą'); assert.equal(d.autor, 'Anna Testowa');
    assert.equal(d.bloki[0].naglowek, true);
    assert.equal(d.bloki[1].tekst, 'Zając & lis szli przez las.');
    assert.equal(d.bloki[1].obrazy.length, 1);
});

test('produkcja PDF: sceny = strony, Głosek czyta, film mp4, audiobook mp3, Żywa Księga z audio', async () => {
    const { M, W, kat, mowy } = await srodowisko();
    const pdf = zrobPdf([
        { tekst: ['Rozdzial pierwszy', 'Byl sobie kot, ktory lubil gwiazdy.'], jpeg: await jpeg(kat), jpegW: 320, jpegH: 200 },
        { tekst: ['Pewnej nocy wspial sie na dach.', '2'] },
        { tekst: ['I zobaczyl ksiezyc.'], jpeg: await jpeg(kat, '400x300'), jpegW: 400, jpegH: 300 },
    ]);
    await assert.rejects(M.nowy({ nazwa: 'kot.pdf', dane: dataUrl(pdf, 'application/pdf') }), /prawa/);
    const z = await M.nowy({ nazwa: 'kot.pdf', dane: dataUrl(pdf, 'application/pdf'), tytul: 'Kot i gwiazdy', autor: 'Jan Autor', prawa: true });
    assert.equal(z.stan, 'sceny'); assert.equal(z.sceny.length, 3); assert.ok(z.zgodnosc.zgodne);
    assert.equal(z.sceny[1].obraz, null);   // strona bez obrazu
    await M.produkuj(z.id, { domaluj: false });
    const g = await czekaj(M, z.id);
    assert.equal(g.stan, 'gotowe', g.powod);
    assert.equal(mowy.length, 4);   // zapowiedź + 3 strony
    assert.match(mowy[0].tekst, /Kot i gwiazdy\. Autor: Jan Autor\./);
    assert.equal(mowy[1].tekst, 'Rozdzial pierwszy Byl sobie kot, ktory lubil gwiazdy.');
    assert.equal(mowy[1].glos, 'glosek');
    assert.equal(g.sceny[1].obraz.zrodlo, 'poprzedni');
    const film = await opisz(g.wideo);
    assert.ok(film.sekundy > 6, `film ${film.sekundy} s`);
    const ab = await opisz(path.join(kat, 'manuskrypty', z.id, 'audiobook.mp3'));
    assert.ok(Math.abs(ab.sekundy - film.sekundy) < 1.5, `audiobook ${ab.sekundy} vs film ${film.sekundy}`);
    assert.equal(g.ksiega.pages.length, 3); assert.equal(g.ksiega.sourceType, 'author-manuscript');
    assert.match(g.ksiega.pages[0].audioUrl, /\/api\/manuskrypt\/mk-[0-9a-f]{8}\/plik\/audio\/strona-1\.mp3$/);
    assert.ok(M.plikZAdresu(g.ksiega.pages[0].imageUrl), 'obraz strony na dysku');
    assert.ok(M.plikZAdresu(g.ksiega.pages[2].audioUrl), 'audio strony na dysku');
    const yt = await M.doYouTube(z.id); assert.equal(yt.publikacja.zrodlo.projekt, 'wlasny-manuskrypt');
    // Wypożyczalnia: obrazy i dźwięk stron kopiowane przy publikacji; audio wypożyczenia tylko z opłaconą sesją
    const w = await M.doWypozyczalni(z.id, { rentalTier: 'rental_48h', cenaEur: 2.5 }); assert.equal(w.wpis.tier, 'rental_48h');
    const ks = JSON.parse(await fs.readFile(path.join(kat, 'teostory', 'ksiegi', `${w.wpis.id}.json`), 'utf8'));
    assert.match(ks.pages[0].audioUrl, new RegExp(`^/wizytowka/teostory/${w.wpis.id}/audio/audio-1\.mp3$`));
    assert.ok(W.plikDzwieku(w.wpis.id, 'audio-3.mp3'));
    await assert.rejects(W.czytaj(w.wpis.id), (e) => e.kod === 402);
});

test('DOCX + folder ilustracji + domalowanie: Paleta tylko tam, gdzie brak obrazu, z wzorem autora', async () => {
    const wzory = [];
    const { M, kat } = await srodowisko({ rysuj: async (o) => { wzory.push(o.referencje.length); const p = path.join(os.tmpdir(), `flux-${Date.now()}.png`); await uruchom(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=640x360', '-frames:v', '1', p]); return p; } });
    const docx = zrobDocx(Array.from({ length: 9 }, (_, i) => ({ tekst: `Scena ${i + 1}. ${'Zając biegł przez łąkę pełną maków. '.repeat(6)}` })), { tytul: 'Zając' });
    const z = await M.nowy({ nazwa: 'zajac.docx', dane: dataUrl(docx, 'application/octet-stream'), prawa: true, slowNaScene: 60,
        ilustracje: [{ nazwa: 'ilu-10.png', dane: dataUrl(await png(kat), 'image/png') }, { nazwa: 'ilu-2.png', dane: dataUrl(await jpeg(kat), 'image/jpeg') }] });
    assert.equal(z.tytul, 'Zając'); assert.equal(z.tryb, 'ilosc'); assert.equal(z.sceny.length, 2);
    // dwie ilustracje → dwie sceny; autor wymienia ilustrację drugiej sceny na swoją
    await M.przepodziel(z.id, { tryb: 'slowa', slowNaScene: 60 });
    const z2 = await M.czytaj(z.id);
    assert.ok(z2.sceny.length > 2);
    assert.equal(z2.sceny[0].obraz.plik, 'autor-001.jpg');   // „ilu-2” przed „ilu-10”
    await M.produkuj(z.id, { domaluj: true });
    const g = await czekaj(M, z.id);
    assert.equal(g.stan, 'gotowe', g.powod);
    const domalowane = g.sceny.filter((s) => s.obraz.zrodlo === 'paleta');
    assert.equal(domalowane.length, g.sceny.length - 2);
    assert.ok(wzory.every((n) => n === 2), 'FLUX dostał 2 ilustracje autora jako wzór');
});

const DWIE_SCENY = ['Pierwsza scena jest tutaj i ma kilka słów.', 'Druga scena też ma kilka słów do przeczytania.'].join('\n\n');
test('głos: cisza z silnika = ponowienie, uparta cisza = błąd z powodem (nie „gotowe”)', async () => {
    let raz = 0;
    const { M } = await srodowisko({ cisza: (t) => t.includes('Druga') && raz++ < 1 });
    const t = await M.nowy({ nazwa: 'a.txt', dane: `data:text/plain;base64,${Buffer.from(DWIE_SCENY).toString('base64')}`, prawa: true, slowNaScene: 20 });
    await M.produkuj(t.id, {});
    const g = await czekaj(M, t.id);
    assert.equal(g.stan, 'gotowe', g.powod);
    assert.ok(g.kroki.some((k) => /🛟 scena \d: (cisza|nagranie za krótkie).*próba 1\/3/.test(k.opis)));
    const { M: M2 } = await srodowisko({ cisza: (t) => t.includes('Druga') });
    const t2 = await M2.nowy({ nazwa: 'a.txt', dane: `data:text/plain;base64,${Buffer.from(DWIE_SCENY).toString('base64')}`, prawa: true, slowNaScene: 20 });
    await M2.produkuj(t2.id, {});
    const g2 = await czekaj(M2, t2.id);
    assert.equal(g2.stan, 'blad'); assert.match(g2.powod, /głos sceny \d: .* \(po 3 próbach\)/);
});

test('Straż: /api/manuskrypt tylko przy maszynie', () => {
    assert.ok(SCIEZKI_TYLKO_LOKALNE.some((p) => '/api/manuskrypt/mk-12345678'.startsWith(p)));
});
