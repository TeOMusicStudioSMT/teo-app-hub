// 📺 Kanał YouTube i linki w wizytówce: adres kanału → id (pewne miejsca strony) → RSS; linki tylko https.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rozpoznajKanal, idKanaluZeStrony, filmyZRss, utworzKanalYouTube, linkiSpolecznosciowe } from '../services/KanalYouTube.js';
import * as W from '../services/Wizytowka.js';

const ID = 'UCabcdefghijklmnopqrstuv';
const RSS = `<?xml version="1.0"?><feed><title>Art Of Soul TV</title><author><name>Art Of Soul TV</name></author>
<entry><yt:videoId>AAAAAAAAAAA</yt:videoId><title>Rozpad &amp; Percepcja</title><published>2026-10-01T10:00:00+00:00</published></entry>
<entry><yt:videoId>BBBBBBBBBBB</yt:videoId><title>Gęstość Ciszy</title><published>2026-09-30T10:00:00+00:00</published></entry></feed>`;

test('adres kanału: @nazwa, /channel/UC…, /c/…; link do filmu i obce domeny — nie', () => {
    assert.deepEqual(rozpoznajKanal('https://www.youtube.com/@ArtOfSoulTV'), { handle: 'ArtOfSoulTV', adres: 'https://www.youtube.com/@ArtOfSoulTV' });
    assert.equal(rozpoznajKanal('youtube.com/@ArtOfSoulTV/videos').handle, 'ArtOfSoulTV');
    assert.equal(rozpoznajKanal('@ArtOfSoulTV').adres, 'https://www.youtube.com/@ArtOfSoulTV');
    assert.equal(rozpoznajKanal(`https://m.youtube.com/channel/${ID}`).id, ID);
    assert.equal(rozpoznajKanal('https://www.youtube.com/c/TeOMusic').sciezka, '/c/TeOMusic');
    for (const z of ['https://www.youtube.com/watch?v=AAAAAAAAAAA', 'https://youtu.be/AAAAAAAAAAA', 'https://zla.pl/@ArtOfSoulTV', 'nie-url']) assert.equal(rozpoznajKanal(z), null, z);
});

test('id kanału tylko z kanonicznego adresu / externalId; RSS → nazwa i filmy', () => {
    assert.equal(idKanaluZeStrony(`... "channelId":"UCzzzzzzzzzzzzzzzzzzzzzz" ... <link rel="canonical" href="https://www.youtube.com/channel/${ID}">`), ID);
    assert.equal(idKanaluZeStrony(`{"externalId":"${ID}"}`), ID);
    assert.equal(idKanaluZeStrony('<html>nic</html>'), null);
    const r = filmyZRss(RSS);
    assert.equal(r.nazwa, 'Art Of Soul TV');
    assert.deepEqual(r.filmy[0], { id: 'AAAAAAAAAAA', tytul: 'Rozpad & Percepcja', kiedy: '2026-10-01T10:00:00+00:00' });
});

test('pobierz: strona kanału → RSS → playlista UU…, pamięć 30 min; błąd mówi prawdę', async () => {
    const pukniecia = [];
    let zegar = 0;
    const k = utworzKanalYouTube({
        teraz: () => zegar,
        fetch: async (url) => { pukniecia.push(url); return { ok: true, status: 200, text: async () => (url.includes('feeds') ? RSS : `<link rel="canonical" href="https://www.youtube.com/channel/${ID}">`) }; },
    });
    const w = await k.pobierz('https://www.youtube.com/@ArtOfSoulTV');
    assert.equal(w.id, ID);
    assert.equal(w.playlista, 'UUabcdefghijklmnopqrstuv');
    assert.equal(w.filmy.length, 2);
    await k.pobierz('https://www.youtube.com/@ArtOfSoulTV');
    assert.equal(pukniecia.length, 2, 'z pamięci');
    zegar += 31 * 60_000;
    await k.pobierz('https://www.youtube.com/@ArtOfSoulTV');
    assert.equal(pukniecia.length, 4);
    const zly = utworzKanalYouTube({ fetch: async () => ({ ok: false, status: 404, text: async () => '' }) });
    assert.match((await zly.pobierz('https://www.youtube.com/@nieistnieje')).blad, /404/);
});

test('linki: tylko https, nazwa z domeny, bez duplikatów i śmieci', () => {
    const l = linkiSpolecznosciowe('https://www.instagram.com/artofsoul\ntiktok.com/@artofsoul\njavascript:alert(1)\nhttp://open.spotify.com/artist/x\nhttps://www.instagram.com/artofsoul\nhttps://moja-strona.pl');
    assert.deepEqual(l.map((x) => x.nazwa), ['Instagram', 'TikTok', 'Spotify', 'moja-strona.pl']);
    assert.ok(l.every((x) => x.url.startsWith('https://')));
});

test('wizytówka niesie kanał (id, playlista, filmy) i linki; zły adres kanału odrzucony wprost', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wiz-kanal-'));
    W.skonfiguruj({
        katalog: tmp,
        wystawa: { zbierz: async () => ({ filmy: [], utwory: [], produkty: [], suno: [] }), plakat: async () => false },
        kanalYouTube: { pobierz: async (url) => ({ id: ID, nazwa: 'Art Of Soul TV', adres: url, playlista: 'UUabcdefghijklmnopqrstuv', filmy: [{ id: 'AAAAAAAAAAA', tytul: 't', kiedy: null }] }) },
    });
    await assert.rejects(W.ustawProfil({ kanal: 'https://youtu.be/AAAAAAAAAAA' }), /adres kanału/);
    const p = await W.ustawProfil({ nick: 'teo-mas', kanal: 'youtube.com/@ArtOfSoulTV/videos', linki: 'https://instagram.com/artofsoul' });
    assert.equal(p.kanal, 'https://www.youtube.com/@ArtOfSoulTV');
    const w = await W.publiczna();
    assert.equal(w.kanal.playlista, 'UUabcdefghijklmnopqrstuv');
    assert.deepEqual(w.linki, [{ nazwa: 'Instagram', url: 'https://instagram.com/artofsoul' }]);
    await W.ustawProfil({ kanal: '' });
    assert.equal((await W.publiczna()).kanal, undefined);
});
