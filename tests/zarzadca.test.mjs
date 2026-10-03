// 🏛️ Zarządca rejestru: zatwierdzanie Katedr przez Stół — oczekujące z rejestru, podpisana lista, tylko zarządca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { utworzZarzadce, trescListyZarzadcy } from '../services/ZarzadcaRejestru.js';

const para = crypto.generateKeyPairSync('ed25519');
const KLUCZ_ZARZ = para.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const kluczKatedry = () => crypto.generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const NOWA = { nick: 'kael-elara', klucz: kluczKatedry() };

/** Rejestr podstawiony: oczekujące + przyjmuje listę tylko z podpisem zarządcy. */
function rejestr(zarzadca = 'teo-center') {
    const r = { oczekujace: [{ ...NOWA, kiedy: 'x', powod: 'nowa Katedra' }, { nick: 'inna-katedra', klucz: kluczKatedry(), kiedy: 'x' }], lista: null, odebrane: 0 };
    r.fetch = async (url, init = {}) => {
        const odp = (status, d) => ({ ok: status < 300, status, json: async () => d });
        if (url.endsWith('/zarzadca') && init.method === 'POST') {
            const b = JSON.parse(init.body);
            const ok = crypto.verify(null, Buffer.from(trescListyZarzadcy(b)), crypto.createPublicKey({ key: Buffer.from(KLUCZ_ZARZ, 'base64'), format: 'der', type: 'spki' }), Buffer.from(b.podpis, 'base64'));
            if (!ok) return odp(401, { wiadomosc: 'To nie jest podpis zarządcy rejestru.' });
            r.lista = b.zatwierdzone; r.odebrane++;
            return odp(200, { wiadomosc: `Zatwierdzonych od zarządcy: ${b.zatwierdzone.length}.` });
        }
        if (url.endsWith('/zarzadca')) return odp(200, { zarzadca });
        if (url.endsWith('/oczekujace')) return odp(200, { oczekujace: r.oczekujace });
        return odp(404, {});
    };
    return r;
}
const zarzadca = (nick, rej) => utworzZarzadce({
    katalog: fs.mkdtempSync(path.join(os.tmpdir(), 'zarzadca-')),
    nick: async () => nick,
    podpisz: async (t) => crypto.sign(null, Buffer.from(t), para.privateKey).toString('base64'),
    rejestr: 'https://otakos.test/api/katedry',
    fetch: rej.fetch,
});

test('zarządca widzi oczekujące; zatwierdzenie wysyła podpisaną listę i znika z oczekujących; odrzucenie ukrywa', async () => {
    const rej = rejestr();
    const z = zarzadca('teo-center', rej);
    let p = await z.przeglad();
    assert.equal(p.jestZarzadca, true);
    assert.deepEqual(p.oczekujace.map((o) => o.nick), ['kael-elara', 'inna-katedra']);

    const w = await z.zatwierdz(NOWA);
    assert.equal(w.ok, true, w.wiadomosc);
    assert.deepEqual(rej.lista, [{ nick: 'kael-elara', klucz: NOWA.klucz }]);
    await z.odrzuc(rej.oczekujace[1]);
    p = await z.przeglad();
    assert.deepEqual(p.oczekujace, [], 'zatwierdzona i odrzucona nie wracają');
    assert.deepEqual(p.zatwierdzone.map((x) => x.nick), ['kael-elara']);

    await z.cofnij({ nick: 'kael-elara' });
    assert.deepEqual(rej.lista, [], 'cofnięcie wysyła listę bez Katedry');
});

test('Katedra, która nie jest zarządcą, nie zatwierdza i nie widzi oczekujących', async () => {
    const rej = rejestr('teo-center');
    const z = zarzadca('ktos-inny', rej);
    const p = await z.przeglad();
    assert.equal(p.jestZarzadca, false);
    assert.deepEqual(p.oczekujace, []);
    await assert.rejects(z.zatwierdz(NOWA), /tylko zarządca rejestru \(„teo-center”\)/);
    assert.equal(rej.odebrane, 0);
    await assert.rejects(zarzadca('teo-center', rejestr()).zatwierdz({ nick: 'ZŁY', klucz: 'x' }), /Zły nick/);
});
