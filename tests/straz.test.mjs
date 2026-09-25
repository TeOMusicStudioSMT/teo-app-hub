/**
 * Straż Mostu — kto jest „maszyną Suwerena", a kto tylko udaje.
 * Każdy scenariusz to prawdziwa droga, którą żądanie dociera do mostu.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { zrodloZadania, strazMostu } from '../services/StrazMostu.js';

const KLUCZ = 'k'.repeat(48);

/** Udawane żądanie Expressa: nagłówki małymi literami, IP gniazda, metoda, ścieżka, ciało. */
function zadanie({ ip = '127.0.0.1', naglowki = {}, method = 'GET', path = '/api/stado/stan', body = {} } = {}) {
    const h = Object.fromEntries(Object.entries({ host: '127.0.0.1:3001', ...naglowki }).map(([k, v]) => [k.toLowerCase(), v]));
    return { ip, method, path, body, query: {}, get: (n) => h[n.toLowerCase()] };
}
function przepusc(req) {
    let status = null, dalej = false;
    const res = { status(s) { status = s; return this; }, json() { return this; } };
    strazMostu({ klucz: () => KLUCZ, zaufane: ['https://teo.center'] })(req, res, () => { dalej = true; });
    return dalej ? 'dalej' : status;
}

describe('zrodloZadania', () => {
    const przypadki = [
        ['Hub z vite (fetch, Origin localhost:5176)', { naglowki: { origin: 'http://localhost:5176' } }, 'maszyna'],
        ['substrona podana przez most (ten sam origin)', { naglowki: { origin: 'http://127.0.0.1:3001' } }, 'maszyna'],
        ['<audio src> z Huba (bez Origin, Referer z localhost)', { naglowki: { referer: 'http://localhost:5176/radio', 'sec-fetch-site': 'cross-site' } }, 'maszyna'],
        ['curl / serwis Node (bez Origin i bez Sec-Fetch)', {}, 'maszyna'],
        ['obca strona: fetch', { naglowki: { origin: 'https://zla-strona.example' } }, 'obce'],
        ['obca strona: formularz POST', { method: 'POST', naglowki: { origin: 'https://zla-strona.example', 'content-type': 'application/x-www-form-urlencoded' } }, 'obce'],
        ['obca strona: <img> bez Referera', { naglowki: { 'sec-fetch-site': 'cross-site' } }, 'obce'],
        ['origin „null" (file://, sandbox)', { naglowki: { origin: 'null' } }, 'obce'],
        ['DNS rebinding: Host obcej domeny na 127.0.0.1', { naglowki: { host: 'zla-strona.example:3001', origin: 'http://zla-strona.example:3001' } }, 'obce'],
        ['zaufana strona publiczna Suwerena', { naglowki: { origin: 'https://teo.center' } }, 'publiczne'],
        ['tunel Cloudflare (gniazdo 127.0.0.1, nagłówki CF)', { naglowki: { 'cf-connecting-ip': '1.2.3.4', origin: 'http://localhost:5176' } }, 'zdalne'],
        ['sieć lokalna', { ip: '192.168.1.20' }, 'zdalne'],
    ];
    for (const [opis, z, oczekiwane] of przypadki) {
        test(opis, () => assert.equal(zrodloZadania(zadanie(z), { zaufane: ['https://teo.center'] }), oczekiwane));
    }
});

describe('strazMostu (middleware)', () => {
    test('maszyna przechodzi bez klucza, także z komendą systemową', () => {
        assert.equal(przepusc(zadanie({ method: 'POST', path: '/api/bridge/execute', body: { action: 'EXEC_SYSTEM_CMD' }, naglowki: { origin: 'http://localhost:5176' } })), 'dalej');
    });
    test('obca strona bez klucza → 401 (nawet GET)', () => {
        assert.equal(przepusc(zadanie({ naglowki: { origin: 'https://zla-strona.example' } })), 401);
        assert.equal(przepusc(zadanie({ method: 'POST', path: '/api/bridge/execute', body: { action: 'EXEC_SYSTEM_CMD' }, naglowki: { origin: 'https://zla-strona.example' } })), 401);
    });
    test('strona publiczna: odczyt i playlista tak, komendy i zapis nie', () => {
        const pub = { origin: 'https://teo.center' };
        assert.equal(przepusc(zadanie({ naglowki: pub, path: '/api/studio/pokoje' })), 'dalej');
        assert.equal(przepusc(zadanie({ naglowki: pub, method: 'POST', path: '/api/bridge/execute', body: { action: 'GET_LOCAL_PLAYLIST' } })), 'dalej');
        assert.equal(przepusc(zadanie({ naglowki: pub, method: 'POST', path: '/api/bridge/execute', body: { action: 'EXEC_SYSTEM_CMD' } })), 403);
        assert.equal(przepusc(zadanie({ naglowki: pub, method: 'POST', path: '/api/market/create', body: {} })), 403);
        assert.equal(przepusc(zadanie({ naglowki: pub, path: '/api/straz/klucz' })), 403);
    });
    test('tunel z kluczem: czyta, ale komendy dalej tylko lokalnie', () => {
        const tunel = { 'cf-connecting-ip': '1.2.3.4', 'x-teo-klucz': KLUCZ };
        assert.equal(przepusc(zadanie({ naglowki: tunel })), 'dalej');
        assert.equal(przepusc(zadanie({ naglowki: tunel, method: 'POST', path: '/api/bridge/execute', body: { action: 'EXEC_SYSTEM_CMD' } })), 403);
        assert.equal(przepusc(zadanie({ naglowki: tunel, method: 'POST', path: '/api/system/free', body: {} })), 403);
    });
    test('telefon: nowy projekt stada przez tunel z kluczem (token sprawdza trasa); reszta projektu i silniki lokalnie', () => {
        const tunel = { 'cf-connecting-ip': '1.2.3.4', 'x-teo-klucz': KLUCZ };
        assert.equal(przepusc(zadanie({ naglowki: tunel, method: 'POST', path: '/api/stado/projekt/nowy' })), 'dalej');
        assert.equal(przepusc(zadanie({ naglowki: { 'cf-connecting-ip': '1.2.3.4' }, method: 'POST', path: '/api/stado/projekt/nowy' })), 401);
        assert.equal(przepusc(zadanie({ naglowki: { origin: 'https://teo.center' }, method: 'POST', path: '/api/stado/projekt/nowy' })), 403);
        assert.equal(przepusc(zadanie({ naglowki: tunel, method: 'POST', path: '/api/stado/projekt/x-1/zlec' })), 403);
        assert.equal(przepusc(zadanie({ naglowki: tunel, method: 'POST', path: '/api/stado/projekt/nowy/../x' })), 403);
        assert.equal(przepusc(zadanie({ naglowki: tunel, method: 'POST', path: '/api/stado/model' })), 403);
    });
});
