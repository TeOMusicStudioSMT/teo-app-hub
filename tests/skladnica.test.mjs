// 📦 Składnica Katedry: assety jako katalogi z kartą, pliki z dataURL i kopie z dysku, kosz zamiast kasowania,
// import obsady i katalogów (kopie — oryginały zostają), tła scen dla innych modułów.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { utworzSkladnice, idZNazwy, bezpiecznaNazwaPliku, rodzajPliku } from '../services/Skladnica.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'skladnica-'));
const png = `data:image/png;base64,${Buffer.from('nie-prawdziwy-png').toString('base64')}`;

test('nazwy: id bez ogonków, pliki bez znaków spoza Windows, rodzaj po rozszerzeniu', () => {
    assert.equal(idZNazwy('Łucja Ćma — główna!'), 'lucja-cma-glowna');
    assert.equal(bezpiecznaNazwaPliku('C:\\x\\Portret: Łucja?.PNG'), 'Portret Lucja .PNG');
    assert.throws(() => bezpiecznaNazwaPliku('karta.json'));
    assert.equal(rodzajPliku('a.webm'), 'wideo');
    assert.equal(rodzajPliku('a.glb'), 'bryla');
    assert.equal(rodzajPliku('a.txt'), 'inne');
});

test('postać: karta, plik z dataURL, główny, zmiana karty bez gubienia pól, unikalne id', async () => {
    const S = utworzSkladnice({ katalog: tmp() });
    const a = await S.zapisz({ rodzaj: 'postacie', nazwa: 'Aria Thorne', kolor: '#F472B6', tagi: 'wokal, Sci-Fi, wokal', glos: { profil: 'aria' } });
    assert.equal(a.id, 'aria-thorne');
    assert.deepEqual(a.tagi, ['wokal', 'sci-fi']);
    assert.equal(a.kolor, '#f472b6');
    const f = await S.dodajPlik('postacie', a.id, { nazwa: 'portret.png', dataURL: png });
    const f2 = await S.dodajPlik('postacie', a.id, { nazwa: 'portret.png', dataURL: png });
    assert.equal(f.nazwa, 'portret.png');
    assert.equal(f2.nazwa, 'portret (2).png', 'ta sama nazwa nie nadpisuje');
    const zm = await S.zapisz({ rodzaj: 'postacie', id: a.id, opis: 'Wokalistka', glowny: 'portret (2).png' });
    assert.equal(zm.nazwa, 'Aria Thorne');
    assert.deepEqual(zm.glos, { profil: 'aria' });
    assert.equal(zm.glowny, 'portret (2).png');
    assert.equal(zm.pliki.length, 2);
    await assert.rejects(S.zapisz({ rodzaj: 'postacie', id: a.id, glowny: 'nie-ma.png' }), /nie leży/);
    const b = await S.zapisz({ rodzaj: 'postacie', nazwa: 'Aria Thorne' });
    assert.equal(b.id, 'aria-thorne-2');
    await assert.rejects(S.zapisz({ rodzaj: 'smoki', nazwa: 'x' }), /Nieznany rodzaj/);
});

test('ścieżki: nic spoza assetu, karta nie jest plikiem do pobrania', async () => {
    const S = utworzSkladnice({ katalog: tmp() });
    const a = await S.zapisz({ rodzaj: 'sceny', nazwa: 'Plaża' });
    assert.throws(() => S.sciezkaPliku('sceny', a.id, '../../etc/passwd'), /spoza/);
    assert.throws(() => S.sciezkaPliku('sceny', a.id, 'karta.json'), /spoza/);
    assert.throws(() => S.sciezkaPliku('sceny', '../postacie', 'x.png'), /Złe id/);
    await assert.rejects(S.wczytaj('sceny', 'nie-ma'), /Nie ma assetu/);
});

test('katalog wrzucony ręcznie jest assetem; szukanie po nazwie i tagach', async () => {
    const kat = tmp();
    fs.mkdirSync(path.join(kat, 'sceny', 'Studio nocne'), { recursive: true });
    fs.writeFileSync(path.join(kat, 'sceny', 'Studio nocne', 'kadr.jpg'), 'x');
    const S = utworzSkladnice({ katalog: kat });
    await S.zapisz({ rodzaj: 'postacie', nazwa: 'Kael', tagi: ['noc'] });
    const wszystko = await S.lista();
    assert.equal(wszystko.length, 2);
    const studio = wszystko.find((a) => a.rodzaj === 'sceny');
    assert.equal(studio.nazwa, 'Studio nocne');
    assert.equal(studio.maKarte, false);
    assert.equal(studio.glowny, 'kadr.jpg');
    assert.deepEqual((await S.lista({ szukaj: 'noc' })).map((a) => a.id).sort(), ['Studio nocne', 'kael']);
    const tla = await S.tla();
    assert.equal(tla.length, 1);
    assert.match(tla[0].gdzie, /Składnica \/ Studio nocne/);
});

test('usuwanie = kosz (plik i cały asset wracają do odzyskania)', async () => {
    const kat = tmp();
    const S = utworzSkladnice({ katalog: kat });
    const a = await S.zapisz({ rodzaj: 'rekwizyty', nazwa: 'Klucz' });
    await S.dodajPlik('rekwizyty', a.id, { nazwa: 'klucz.png', dataURL: png });
    const p = await S.usunPlik('rekwizyty', a.id, 'klucz.png');
    assert.ok(fs.existsSync(p.kosz));
    const u = await S.usun('rekwizyty', a.id);
    assert.ok(fs.existsSync(path.join(u.kosz, 'karta.json')));
    assert.equal((await S.lista()).length, 0, 'kosz nie jest assetem');
});

test('import obsady: kopie zdjęcia i klipu, karta z imieniem/rolą/kolorem/głosem, drugi raz bez dubli', async () => {
    const kat = tmp(), dysk = tmp();
    const zdj = path.join(dysk, 'Teogachi2.png'), klip = path.join(dysk, 'teo.mp4');
    fs.writeFileSync(zdj, 'obraz'); fs.writeFileSync(klip, 'klip');
    const S = utworzSkladnice({ katalog: kat });
    const obsada = [
        { id: 'teo', imie: 'TeOgachi', rola: 'gość', kolor: '#22d3ee', zdjecie: zdj, wideo: klip, glos: { profil: 'teo' } },
        { id: 'kronikarz', imie: 'Kronikarz', zdjecie: null },
        { id: 'bez', imie: 'Bez Zdjęcia', zdjecie: path.join(dysk, 'zgubione.png') },
    ];
    const w = await S.importujObsade(obsada);
    assert.deepEqual(w.dodane, ['teogachi', 'bez-zdjecia']);
    const t = await S.wczytaj('postacie', 'teogachi');
    assert.equal(t.rola, 'gość');
    assert.deepEqual(t.glos, { profil: 'teo' });
    assert.equal(t.zrodlo, 'obsada:teo');
    assert.deepEqual(t.pliki.map((p) => p.nazwa).sort(), ['Teogachi2.png', 'teo.mp4'].sort());
    assert.equal(t.glowny, 'Teogachi2.png');
    assert.ok(fs.existsSync(zdj), 'oryginał zostaje');
    const w2 = await S.importujObsade(obsada);
    assert.deepEqual(w2.dodane, []);
    assert.equal(w2.pominiete.length, 2);
});

test('import katalogu: podkatalogi = assety, pliki luzem osobno, tylko obraz/wideo/audio/bryła', async () => {
    const kat = tmp(), dysk = tmp();
    fs.mkdirSync(path.join(dysk, 'studio'));
    fs.writeFileSync(path.join(dysk, 'studio', 'studio1.png'), 'a');
    fs.writeFileSync(path.join(dysk, 'studio', 'studio2.png'), 'b');
    fs.writeFileSync(path.join(dysk, 'studio', 'notatki.txt'), 'c');
    fs.mkdirSync(path.join(dysk, 'pusty'));
    fs.writeFileSync(path.join(dysk, 'scena1.png'), 'd');
    const S = utworzSkladnice({ katalog: kat });
    const w = await S.importujKatalog({ sciezka: dysk, rodzaj: 'sceny' });
    assert.deepEqual(w.dodane.sort(), ['scena1', 'studio']);
    assert.deepEqual((await S.wczytaj('sceny', 'studio')).pliki.map((p) => p.nazwa), ['studio1.png', 'studio2.png']);
    const S2 = utworzSkladnice({ katalog: tmp() });
    const w2 = await S2.importujKatalog({ sciezka: dysk, rodzaj: 'sceny', tryb: 'folder' });
    assert.equal(w2.dodane.length, 1);
    assert.equal((await S2.wczytaj('sceny', w2.dodane[0])).pliki.length, 3);
    await assert.rejects(S.importujKatalog({ sciezka: kat, rodzaj: 'sceny' }), /już jest w Składnicy/);
});

test('przyjmij (Assety3D, Fashion): kopie plików, drugi raz ten sam asset i tylko brakujące pliki', async () => {
    const kat = tmp(), dysk = tmp();
    const glb = path.join(dysk, 'model.glb'), png = path.join(dysk, 'obraz.png');
    fs.writeFileSync(glb, 'glb'); fs.writeFileSync(png, 'png');
    const S = utworzSkladnice({ katalog: kat });
    const w1 = await S.przyjmij({ rodzaj: 'bryly', nazwa: 'Miecz', opis: 'stal', pliki: [glb], glowny: null, zrodlo: 'assety3d:miecz-ab12' });
    assert.equal(w1.nowy, true);
    const w2 = await S.przyjmij({ rodzaj: 'bryly', nazwa: 'Miecz', pliki: [glb, png, path.join(dysk, 'nie-ma.png')], glowny: png, zrodlo: 'assety3d:miecz-ab12' });
    assert.equal(w2.nowy, false);
    assert.equal(w2.dodano, 1, 'tylko brakujący obraz');
    assert.equal(w2.asset.id, w1.asset.id);
    assert.deepEqual(w2.asset.pliki.map((p) => p.nazwa).sort(), ['model.glb', 'obraz.png']);
    assert.equal((await S.lista({ rodzaj: 'bryly' })).length, 1);
    await assert.rejects(S.przyjmij({ rodzaj: 'bryly', nazwa: 'X', pliki: [path.join(dysk, 'brak.glb')], zrodlo: 'assety3d:x' }), /Brak plików/);
    await assert.rejects(S.przyjmij({ rodzaj: 'bryly', nazwa: 'X', pliki: [glb] }), /źródła/);
});

test('do gry: obrazy, bryły i dźwięki do public/assety + assety.json (bez klipów), powtórka nie dubluje wpisów', async () => {
    const kat = tmp(), apki = tmp();
    fs.mkdirSync(path.join(apki, 'kosmiczna-gra'));
    const S = utworzSkladnice({ katalog: kat });
    const a = await S.zapisz({ rodzaj: 'postacie', nazwa: 'Kael', opis: 'pilot' });
    await S.dodajPlik('postacie', a.id, { nazwa: 'sprite.png', dataURL: png });
    await S.dodajPlik('postacie', a.id, { nazwa: 'krok.wav', dataURL: png });
    await S.dodajPlik('postacie', a.id, { nazwa: 'klip.mp4', dataURL: png });
    const w = await S.doGry('postacie', a.id, { katalogApek: apki, projekt: 'kosmiczna-gra' });
    assert.deepEqual(w.pliki.sort(), ['assety/kael-krok.wav', 'assety/kael-sprite.png']);
    await S.doGry('postacie', a.id, { katalogApek: apki, projekt: 'kosmiczna-gra' });
    const katalogGry = JSON.parse(fs.readFileSync(path.join(apki, 'kosmiczna-gra', 'public', 'assety', 'assety.json'), 'utf8'));
    assert.equal(katalogGry.length, 2);
    assert.equal(katalogGry[0].zrodlo, 'skladnica:postacie/kael');
    assert.equal(katalogGry[0].opis, 'pilot');
    await assert.rejects(S.doGry('postacie', a.id, { katalogApek: apki, projekt: 'nie-ma' }), /Nie ma takiego projektu gry/);
    await assert.rejects(S.doGry('postacie', a.id, { katalogApek: apki, projekt: '../x' }), /Nie ma takiego projektu gry/);
    const pusta = await S.zapisz({ rodzaj: 'sceny', nazwa: 'Tylko klip' });
    await S.dodajPlik('sceny', pusta.id, { nazwa: 'a.mp4', dataURL: png });
    await assert.rejects(S.doGry('sceny', pusta.id, { katalogApek: apki, projekt: 'kosmiczna-gra' }), /nie ma obrazów/);
});
