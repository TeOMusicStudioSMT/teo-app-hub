// 📋 TeO Game Show: playlista programu (RSS + język z metadanych), dopisywanie wysłanego odcinka (YouTube API — atrapa),
// ➕ ten sam film na kolejny kanał, pole `gameShow` wizytówki.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rozpoznajPlayliste, jezykZMetadanych, playlistaZRss } from '../services/KanalYouTube.js';
import { utworzKontoYouTube } from '../services/YouTubeKonto.js';
import { utworzPublikacje } from '../services/PublikacjeYouTube.js';
import { utworzGameShow, PROJEKT } from '../services/TeoGameShow.js';

const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `gs-pl-${n}-`));
const RSS = `<feed><yt:playlistId>PLQHA79g8V0HM</yt:playlistId><yt:channelId>UCFGMuAEBRjmXSNmb6CdKbCg</yt:channelId><title>🩰TeO Game Show🩰</title>
<entry><yt:videoId>Pp_N-0MelXA</yt:videoId><title>TeO Game Show: Kot Tancerz na parkiecie! Taniec Dnia</title><published>2026-10-13T10:09:31+00:00</published><media:group><media:description>Kot Tancerz tańczy w konkurencji Taniec Dnia i zdobywa wynik 75/100.</media:description></media:group></entry>
<entry><yt:videoId>AbCdEfGhIjK</yt:videoId><title>TeO Game Show: Dance Cat on the floor! Dance of the Day</title><published>2026-10-13T12:00:00+00:00</published><media:group><media:description>Welcome to the show — the cat scores 86 in the Dance of the Day challenge &amp; more.</media:description></media:group></entry>
<entry><yt:videoId>ZZZZZZZZZZZ</yt:videoId><title>🎪🎪🎪</title><media:group><media:description></media:description></media:group></entry></feed>`;

test('playlista: link → id; RSS → tytuł, kanał, filmy z językiem z tytułu i opisu (niepewny = null)', () => {
    assert.equal(rozpoznajPlayliste('https://www.youtube.com/playlist?list=PLQHA79g8V0HM'), 'PLQHA79g8V0HM');
    assert.equal(rozpoznajPlayliste('https://www.youtube.com/watch?v=Pp_N-0MelXA&list=PLQHA79g8V0HM&index=2'), 'PLQHA79g8V0HM');
    assert.equal(rozpoznajPlayliste('https://www.youtube.com/@kanal'), null);
    const p = playlistaZRss(RSS);
    assert.equal(p.tytul, '🩰TeO Game Show🩰');
    assert.equal(p.kanalId, 'UCFGMuAEBRjmXSNmb6CdKbCg');
    assert.deepEqual(p.filmy.map((f) => [f.id, f.jezyk]), [['Pp_N-0MelXA', 'pl'], ['AbCdEfGhIjK', 'en'], ['ZZZZZZZZZZZ', null]]);
    assert.equal(jezykZMetadanych('Welcome to the TeO Game Show — the dance of the day'), 'en');
});

test('dopisanie do playlisty: już jest = nic; nowe = POST playlistItems; brak zgody = rada „➕ Dodaj kanał”', async () => {
    const wolania = [];
    let tryb = 'nowy';
    const fetchAtrapa = async (url, init = {}) => {
        wolania.push([init.method ?? 'GET', String(url)]);
        const j = (d, status = 200) => ({ ok: status < 300, status, json: async () => d });
        if (String(url).includes('oauth2')) return j({ access_token: 'tok' });
        if (String(url).includes('playlistItems?part=id')) return j({ items: tryb === 'jest' ? [{ id: 'x' }] : [] });
        if (init.method === 'POST') return tryb === 'bez-zgody' ? j({ error: { message: 'Request had insufficient authentication scopes.', errors: [{ reason: 'insufficientPermissions' }] } }, 403) : j({ id: 'nowy' });
        return j({});
    };
    const K = utworzKontoYouTube({ sekrety: async () => ({ CLIENT_ID: 'a.apps.googleusercontent.com', CLIENT_SECRET: 's', KONTA: [{ id: 'UC1', nazwa: 'TeO', token: 'rt' }], DOMYSLNY: 'UC1' }), zapiszToken: async () => {}, adresMostu: 'http://127.0.0.1:3001', fetch: fetchAtrapa });
    assert.deepEqual(await K.dodajDoPlaylisty('Pp_N-0MelXA', 'PLQHA79g8V0HM', 'UC1'), { dodano: true });
    assert.ok(wolania.some(([m, u]) => m === 'POST' && u.includes('playlistItems?part=snippet')));
    tryb = 'jest';
    assert.deepEqual(await K.dodajDoPlaylisty('Pp_N-0MelXA', 'PLQHA79g8V0HM', 'UC1'), { dodano: false, juzByl: true });
    tryb = 'bez-zgody';
    await assert.rejects(K.dodajDoPlaylisty('Pp_N-0MelXA', 'PLQHA79g8V0HM', 'UC1'), /Dodaj kanał/);
    await assert.rejects(K.dodajDoPlaylisty('zle', 'PLQHA79g8V0HM'), /Złe id filmu/);
});

test('publikacja: po wysłaniu sama na playlistę projektu (inny kanał = pominięta); ➕ kopia na drugi kanał z osobnym ✓', async () => {
    const kat = tmp('pub');
    const plik = path.join(kat, 'gameshow_Kot_en_1.mp4');
    fs.writeFileSync(plik, 'x');
    const dodane = [];
    const kolejka = [];
    const P = utworzPublikacje({
        katalog: kat,
        pisz: async () => ({ tekst: 'TYTUŁ: TeO Game Show: Kot\nOPIS:\nKot tańczy.\nTAGI: teo, taniec', silnik: 'atrapa' }),
        impresariat: { enqueuePublication: async (_t, _p, _s, _f, o) => { const j = { id: `job${kolejka.length + 1}`, status: 'COMPLETE', youtubeVideoId: kolejka.length ? 'Bbbbbbbbbbb' : 'Aaaaaaaaaaa', kanal: o.kanalId }; kolejka.push(j); return j; }, getQueue: async () => kolejka },
        statusFilmu: async (id) => ({ id, istnieje: true, widocznosc: 'unlisted' }),
        kanaly: async () => ({ domyslny: 'UC1', kanaly: [{ id: 'UC1', nazwa: 'TeO Univers Studio' }, { id: 'UC2', nazwa: 'TeO Game Show' }] }),
        naWystawe: async () => {}, gotowyYouTube: async () => true,
        playlistaDla: async (p) => (p.zrodlo?.projekt === PROJEKT ? { id: 'PLQHA79g8V0HM', kanalId: 'UC1' } : null),
        dodajDoPlaylisty: async (v, pl, k) => { dodane.push([v, pl, k]); return { dodano: true }; },
    });
    const p = await P.przygotuj({ plik, nazwa: 'TeO Game Show — Kot', zrodlo: { projekt: PROJEKT }, jezyk: 'en' });
    assert.equal(p.etap, 'do_akceptacji');
    const kopia = await P.naKanal(p.id, 'UC2');
    assert.equal(kopia.etap, 'do_akceptacji');
    assert.equal(kopia.tytul, p.tytul);
    assert.equal(kopia.kanalNazwa, 'TeO Game Show');
    await assert.rejects(P.naKanal(p.id, 'UC2'), /już jest \(albo czeka\)/);
    assert.equal((await P.przygotuj({ plik, nazwa: 'x', zrodlo: { projekt: PROJEKT } })).id, p.id, 'drugi przygotuj = ta sama (nie kopia)');
    await P.zatwierdz(p.id);
    await P.zatwierdz(kopia.id);
    const l = await P.sprawdz();
    const a = l.find((x) => x.id === p.id), b = l.find((x) => x.id === kopia.id);
    assert.equal(a.etap, 'opublikowana');
    assert.equal(a.playlista.stan, 'dodana');
    assert.deepEqual(dodane, [['Aaaaaaaaaaa', 'PLQHA79g8V0HM', 'UC1']]);
    assert.equal(b.playlista.stan, 'pominieta', 'film na drugim kanale nie trafia na playlistę pierwszego');
    // ponowienie dopisania
    const po = await P.ponowPlayliste(p.id);
    assert.equal(po.playlista.stan, 'dodana');
    // kopia nie przestawia zapamiętanego kanału projektu
    assert.equal((await P.kanalProjektu(PROJEKT)).zapamietany, 'UC1');
});

test('Game Show: playlista w ustawieniach (zmiana jednego pola nie kasuje innych) → pole `gameShow` wizytówki', async () => {
    const kat = tmp('ust');
    const GS = utworzGameShow({ katalog: kat, katalogMontazy: async () => kat, katalogNagran: async () => kat, choreografie: { wczytaj: async () => ({}) }, tancerz: async () => ({}), opisz: async () => ({}), spawaj: async () => ({}),
        playlistaRss: async (id) => ({ id, ...playlistaZRss(RSS) }) });
    assert.equal(await GS.publiczne(), null, 'bez playlisty — brak pola');
    await GS.ustaw({ playlista: 'PLQHA79g8V0HM', playlistaKanal: 'UCFGMuAEBRjmXSNmb6CdKbCg', playlistaTytul: '🩰TeO Game Show🩰' });
    await GS.ustaw({ jezyk: 'pl' });
    const u = await GS.ustawienia();
    assert.deepEqual([u.jezyk, u.playlista, u.playlistaKanal], ['pl', 'PLQHA79g8V0HM', 'UCFGMuAEBRjmXSNmb6CdKbCg']);
    const w = await GS.publiczne();
    assert.equal(w.playlista, 'PLQHA79g8V0HM');
    assert.equal(w.filmy.length, 3);
    assert.equal(w.filmy[1].jezyk, 'en');
    await assert.rejects(GS.ustaw({ playlista: 'zła playlista!' }), /Złe id playlisty/);
    await GS.ustaw({ playlista: null });
    assert.equal(await GS.publiczne(), null);
});
