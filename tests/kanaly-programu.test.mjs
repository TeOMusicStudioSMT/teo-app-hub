// 📡 TeO Game Show na wszystkie kanały programu jednym ✓ + playlista programu na każdym kanale (Suweren 2026-10-22).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { utworzPublikacje } from '../services/PublikacjeYouTube.js';
import { utworzGameShow, PROJEKT } from '../services/TeoGameShow.js';

const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `kp-${n}-`));
const KANALY = [{ id: 'UCteouniversA1', nazwa: 'TeO Univers Studio' }, { id: 'UCsmtzastepczy1', nazwa: '[S.M.T]' }, { id: 'UCzebrrasports1', nazwa: 'Zebrra Football' }];

test('ustawienia: stara pojedyncza playlista → lista; jedna na kanał; kanały dodatkowe; usuń', async () => {
    const kat = tmp('ust');
    fs.mkdirSync(path.join(kat, 'game-show'), { recursive: true });
    fs.writeFileSync(path.join(kat, 'game-show', 'ustawienia.json'), JSON.stringify({ jezyk: 'en', playlista: 'PLQHA79g8V0HM', playlistaKanal: 'UCteouniversA1', playlistaTytul: '🩰TeO Game Show🩰' }));
    const G = utworzGameShow({ katalog: kat });
    let u = await G.ustawienia();
    assert.deepEqual(u.playlisty, [{ id: 'PLQHA79g8V0HM', kanal: 'UCteouniversA1', tytul: '🩰TeO Game Show🩰' }]);
    assert.equal(u.playlista, 'PLQHA79g8V0HM');
    u = await G.ustaw({ playlista: 'PLzebrraAAAAA', playlistaKanal: 'UCzebrrasports1', playlistaTytul: 'TGS Zebrra' });
    u = await G.ustaw({ playlista: 'PLzebrraBBBBB', playlistaKanal: 'UCzebrrasports1', playlistaTytul: 'TGS Zebrra 2' });   // ten sam kanał = podmiana
    assert.deepEqual(u.playlisty.map((x) => x.id), ['PLQHA79g8V0HM', 'PLzebrraBBBBB']);
    assert.equal(u.playlista, 'PLQHA79g8V0HM', 'pierwsza zostaje dla wizytówki');
    u = await G.ustaw({ kanalyDodatkowe: ['UCsmtzastepczy1', 'UCzebrrasports1'] });
    assert.deepEqual(u.kanalyDodatkowe, ['UCsmtzastepczy1', 'UCzebrrasports1']);
    await assert.rejects(G.ustaw({ kanalyDodatkowe: ['zle id'] }), /lista id kanałów/);
    u = await G.ustaw({ playlistaUsun: 'PLzebrraBBBBB' });
    assert.deepEqual(u.playlisty.map((x) => x.id), ['PLQHA79g8V0HM']);
    const zapis = JSON.parse(fs.readFileSync(path.join(kat, 'game-show', 'ustawienia.json'), 'utf8'));
    assert.equal(zapis.playlista, undefined, 'na dysku tylko lista');
});

test('jedno ✓ = kopie na pozostałe kanały programu, każda na playlistę swojego kanału; kanał bez playlisty = pominięty z powodem', async () => {
    const kat = tmp('pub');
    const plik = path.join(kat, 'gameshow_Nu_en_1.mp4');
    fs.writeFileSync(plik, 'x');
    const kolejka = [], dodane = [];
    const playlisty = [{ id: 'PLteouniversAA', kanal: 'UCteouniversA1' }, { id: 'PLsmtzastepczyA', kanal: 'UCsmtzastepczy1' }];
    const P = utworzPublikacje({
        katalog: kat,
        pisz: async () => ({ tekst: 'TYTUŁ: Nu dances\nOPIS:\nNu tańczy. otakos.wtf\nTAGI: teo', silnik: 'atrapa' }),
        impresariat: { enqueuePublication: async (_t, _p, _s, _f, o) => { const j = { id: `job${kolejka.length + 1}`, status: 'COMPLETE', youtubeVideoId: `Vid${String(kolejka.length).padStart(8, '0')}`, kanal: o.kanalId }; kolejka.push(j); return j; }, getQueue: async () => kolejka },
        statusFilmu: async (id) => ({ id, istnieje: true, widocznosc: 'unlisted' }),
        kanaly: async () => ({ domyslny: KANALY[0].id, kanaly: KANALY }),
        naWystawe: async () => {}, gotowyYouTube: async () => true,
        playlistaDla: async (p) => { const pl = playlisty.find((x) => x.kanal === p.kanalId) ?? playlisty[0]; return { id: pl.id, kanalId: pl.kanal }; },
        dodajDoPlaylisty: async (v, pl, k) => { dodane.push([pl, k]); return { dodano: true }; },
        kanalyProgramu: async (p) => (p.zrodlo?.projekt === PROJEKT ? KANALY.map((k) => k.id) : []),
    });
    const p = await P.przygotuj({ plik, nazwa: 'Game Show Nu', zrodlo: { projekt: PROJEKT }, jezyk: 'en', kanalId: 'UCteouniversA1' });
    assert.ok(p.tytul.startsWith('🎪 TeO Game Show🎪'));
    await P.zatwierdz(p.id);
    const po = (await P.wszystkie()).find((x) => x.id === p.id);
    assert.deepEqual(po.kopie.map((k) => [k.kanalId, !!k.id, k.blad ?? null]), [['UCsmtzastepczy1', true, null], ['UCzebrrasports1', true, null]]);
    assert.equal(kolejka.length, 3, 'trzy wysyłki: główny + dwie kopie');
    assert.deepEqual(kolejka.map((j) => j.kanal), ['UCteouniversA1', 'UCsmtzastepczy1', 'UCzebrrasports1']);
    const l = await P.sprawdz();
    const stan = Object.fromEntries(l.filter((x) => x.plik === plik).map((x) => [x.kanalId, x.playlista?.stan]));
    assert.deepEqual(stan, { UCteouniversA1: 'dodana', UCsmtzastepczy1: 'dodana', UCzebrrasports1: 'pominieta' });
    assert.deepEqual(dodane.sort(), [['PLsmtzastepczyA', 'UCsmtzastepczy1'], ['PLteouniversAA', 'UCteouniversA1']]);
    assert.match(l.find((x) => x.kanalId === 'UCzebrrasports1').playlista.powod, /nie ma playlisty programu/);
});

test('inny program (Gol Dnia) — jedno ✓ = jeden kanał, bez kopii', async () => {
    const kat = tmp('gol');
    const plik = path.join(kat, 'gol_a-b_en_1.mp4');
    fs.writeFileSync(plik, 'x');
    const kolejka = [];
    const P = utworzPublikacje({
        katalog: kat, pisz: async () => ({ tekst: 'TYTUŁ: Gol\nOPIS:\nGol. otakos.wtf\nTAGI: a', silnik: 'a' }),
        impresariat: { enqueuePublication: async () => { const j = { id: 'j', status: 'QUEUED' }; kolejka.push(j); return j; }, getQueue: async () => kolejka },
        kanaly: async () => ({ domyslny: KANALY[0].id, kanaly: KANALY }), gotowyYouTube: async () => true,
        kanalyProgramu: async (p) => (p.zrodlo?.projekt === PROJEKT ? KANALY.map((k) => k.id) : []),
    });
    const p = await P.przygotuj({ plik, nazwa: 'Gol', zrodlo: { projekt: 'gol-dnia' } });
    await P.zatwierdz(p.id);
    assert.equal(kolejka.length, 1);
    assert.equal((await P.wszystkie()).find((x) => x.id === p.id).kopie, undefined);
});
