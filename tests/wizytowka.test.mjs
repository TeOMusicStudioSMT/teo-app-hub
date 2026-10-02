// 🪪 Wizytówka Katedry: publiczna strona w sieci otakos.wtf — bez ścieżek z dysku, bez ukrytych pozycji,
// meldunek podpisany kluczem ed25519, a Straż wpuszcza bez klucza TYLKO odczyt wizytówki.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import * as W from '../services/Wizytowka.js';
import { strazMostu } from '../services/StrazMostu.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wizytowka-'));
const film = path.join(tmp, 'film.mp4'); fs.writeFileSync(film, 'mp4');
const ukryty = path.join(tmp, 'ukryty.mp4'); fs.writeFileSync(ukryty, 'mp4');
const utwor = path.join(tmp, 'utwor.mp3'); fs.writeFileSync(utwor, 'mp3');
const wystawa = {
    zbierz: async () => ({
        filmy: [
            { id: 'film-a', rodzaj: 'film', projekt: 'p', tytul: 'Film A', opis: 'o', kiedy: '2026-10-01', plik: film, ukryty: false, youtube: { id: 'yt1' } },
            { id: 'film-b', rodzaj: 'film', projekt: 'p', tytul: 'Ukryty', opis: '', kiedy: '2026-10-01', plik: ukryty, ukryty: true, youtube: null },
        ],
        utwory: [{ id: 'utw-a', tytul: 'Utwór', kiedy: '2026-10-01', plik: utwor, ukryty: false }],
        produkty: [{ id: 'prod-a', rodzaj: 'print', dzial: 'Lab', tytul: 'Print', opis: '', kiedy: null, obraz: null, ukryty: false }],
        suno: [{ typ: 'utwor', id: 's1', url: 'https://suno.com/song/s1', tytul: 'S', opis: '', embed: 'https://suno.com/embed/s1' }],
    }),
    plakat: async (_z, cel) => { fs.writeFileSync(cel, 'jpg'); return true; },
};

describe('Wizytówka', () => {
    test('bez nicka nie istnieje; nick waliduje się jak adres', async () => {
        W.skonfiguruj({ katalog: tmp, wystawa });
        assert.equal(await W.publiczna(), null);
        await assert.rejects(W.ustawProfil({ nick: 'Mistrz Arkadiusz' }), /Nick/);
        await assert.rejects(W.ustawProfil({ nick: 'żółw' }), /Nick/);
        const p = await W.ustawProfil({ nick: 'TeO-Center', motto: '  Tu ta chwila  ', opis: 'x'.repeat(900) });
        assert.equal(p.nick, 'teo-center');
        assert.equal(p.motto, 'Tu ta chwila');
        assert.equal(p.opis.length, 600);
        assert.equal(p.meldunek, false, 'meldunek domyślnie wyłączony');
    });

    test('publiczna: bez ścieżek z dysku i bez ukrytych; pliki tylko dla id z wizytówki', async () => {
        const w = await W.publiczna();
        assert.equal(w.nick, 'teo-center');
        assert.deepEqual(w.wystawa.filmy.map((f) => f.id), ['film-a']);
        assert.equal(w.wystawa.filmy[0].youtube, 'yt1');
        assert.equal(w.wystawa.filmy[0].plik, '/wizytowka/plik/film-a');
        assert.ok(!JSON.stringify(w).includes(tmp), 'żadnej ścieżki z dysku w wizytówce');
        assert.equal(await W.plik('film-a'), film);
        assert.equal(await W.plik('utw-a'), utwor);
        assert.equal(await W.plik('film-b'), null, 'ukryty nie wychodzi');
        assert.equal(await W.plik('../../etc/passwd'), null);
        assert.ok((await W.plakat('film-a')).endsWith(path.join('plakaty', 'film-a.jpg')));
        assert.equal(await W.plakat('utw-a'), null, 'plakat tylko dla filmu');
    });

    test('meldunek: bez tunelu nie wysyła; z tunelem — podpis ed25519, który weryfikuje się kluczem publicznym', async () => {
        const wyslane = [];
        W.skonfiguruj({ tunel: async () => ({ stan: 'zatrzymany' }), fetch: async (url, init) => { wyslane.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200, json: async () => ({ wiadomosc: 'Zameldowana.' }) }; }, rejestr: 'https://rejestr.test/api/katedry' });
        assert.equal(await W.meldunek(), null, 'wyłączony → nic');
        await W.ustawProfil({ meldunek: true });
        const bez = await W.meldunek();
        assert.equal(bez.ok, false);
        assert.match(bez.wiadomosc, /Tunel nie działa/);
        assert.equal(wyslane.length, 0);

        W.skonfiguruj({ tunel: async () => ({ stan: 'dziala', adres: 'https://abc-def.trycloudflare.com/' }) });
        const m = await W.meldunek();
        assert.equal(m.ok, true);
        const { url, body } = wyslane.at(-1);
        assert.equal(url, 'https://rejestr.test/api/katedry/meldunek');
        assert.equal(body.adres, 'https://abc-def.trycloudflare.com');
        const pub = crypto.createPublicKey({ key: Buffer.from(body.klucz, 'base64'), format: 'der', type: 'spki' });
        assert.ok(crypto.verify(null, Buffer.from(W.trescMeldunku(body)), pub, Buffer.from(body.podpis, 'base64')));
        assert.ok(!crypto.verify(null, Buffer.from(W.trescMeldunku({ ...body, nick: 'ktos-inny' })), pub, Buffer.from(body.podpis, 'base64')), 'podpis wiąże nick');
        assert.ok(!fs.readFileSync(path.join(tmp, 'wizytowka.json'), 'utf8').includes('PRIVATE'), 'klucz prywatny osobno');
    });
});

describe('Straż: tunel widzi tylko wizytówkę', () => {
    const KLUCZ = 'k'.repeat(48);
    const zdalne = (method, p) => {
        const h = { host: 'abc.trycloudflare.com', 'cf-ray': 'x', origin: 'https://otakos.wtf' };
        const req = { ip: '127.0.0.1', method, path: p, body: {}, query: {}, get: (n) => h[n.toLowerCase()] };
        let status = null, dalej = false;
        const res = { status(s) { status = s; return this; }, json() { return this; } };
        strazMostu({ klucz: () => KLUCZ })(req, res, () => { dalej = true; });
        return dalej ? 'dalej' : status;
    };
    for (const [m, p, oczek] of [
        ['GET', '/api/wizytowka', 'dalej'],
        ['HEAD', '/wizytowka/plik/film-a', 'dalej'],
        ['GET', '/wizytowka/plakat/film-a', 'dalej'],
        ['POST', '/api/wizytowka', 401],
        ['GET', '/api/wizytowka/profil', 401],
        ['GET', '/wizytowka/plik/a/b', 401],
        ['GET', '/api/wystawa', 401],
        ['GET', '/wystawa/plik/film-b', 401],
        ['GET', '/api/katedra/raport', 401],
        ['POST', '/api/tost/skrzynka', 'dalej'],
        ['GET', '/api/tost/skrzynka', 401],
        ['GET', '/api/tost/siec/kontakty', 401],
        ['POST', '/api/tost/siec/wyslij', 401],
    ]) test(`${m} ${p} → ${oczek}`, () => assert.equal(zdalne(m, p), oczek));
});
