// 🎧 Spotify: token Client Credentials (raz, ze schowka), profile Elary i Kaela, brak kluczy = 412 z powodem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utworzSpotify, ARTYSCI } from '../services/SpotifyArtysci.js';

test('Spotify: token raz, profile artystów, artysta z błędem nie psuje reszty, brak kluczy = powód', async () => {
    const wolania = [];
    const f = async (url, o) => {
        wolania.push(url);
        if (url.includes('/api/token')) { assert.match(o.headers.Authorization, /^Basic /); return new Response(JSON.stringify({ access_token: 't1', expires_in: 3600 })); }
        if (url.endsWith(ARTYSCI[1].id)) return new Response('{}', { status: 404 });
        if (url.includes('/v1/search?type=artist')) return new Response(JSON.stringify({ artists: { items: [] } }));
        if (url.includes('/v1/search?type=track')) return new Response(JSON.stringify({ tracks: { items: [] } }));
        return new Response(JSON.stringify({ id: ARTYSCI[0].id, name: 'Elara', followers: { total: 42 }, popularity: 7, genres: ['ambient'], images: [{ url: 'https://i.scdn.co/x' }], external_urls: { spotify: 'https://open.spotify.com/artist/x' } }));
    };
    const S = utworzSpotify({ klucze: async () => ({ client_id: 'a', client_secret: 'b' }), fetch: f });
    const a = await S.artysci();
    assert.deepEqual(a[0], { klucz: 'elara', id: ARTYSCI[0].id, nazwa: 'Elara', obserwujacy: 42, popularnosc: 7, gatunki: ['ambient'], obraz: 'https://i.scdn.co/x', url: 'https://open.spotify.com/artist/x' });
    assert.match(a[1].blad, /^HTTP 404/);
    await S.artysci();
    assert.equal(wolania.filter((u) => u.includes('/api/token')).length, 1, 'token ze schowka');
    await assert.rejects(utworzSpotify({ klucze: async () => ({}) }).artysci(), /Skarbcu/);
});

test('Spotify: 404 po literówce w id → wyszukanie po nazwie i utworze „Raindrops” → właściwy profil', async () => {
    const f = async (url) => {
        if (url.includes('/api/token')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }));
        if (url.includes('/v1/search?type=artist')) return new Response(JSON.stringify({ artists: { items: [{ id: 'zly', name: 'Elara' }, { id: 'dobry', name: 'ELARA' }] } }));
        if (url.includes('/zly/top-tracks')) return new Response(JSON.stringify({ tracks: [{ name: 'Other' }] }));
        if (url.includes('/dobry/top-tracks')) return new Response(JSON.stringify({ tracks: [{ name: 'Raindrops (Live)' }] }));
        if (url.endsWith(ARTYSCI[0].id)) return new Response('{}', { status: 404 });
        return new Response(JSON.stringify({ id: 'k', name: 'KAEL' }));
    };
    const [elara] = await utworzSpotify({ klucze: async () => ({ client_id: 'a', client_secret: 'b' }), fetch: f }).artysci();
    assert.equal(elara.id, 'dobry'); assert.equal(elara.poprawioneId, 'dobry'); assert.equal(elara.blad, undefined);
});
