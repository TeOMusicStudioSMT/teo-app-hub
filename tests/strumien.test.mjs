/** Strumień Stada (SSE dla StoL): stan na start, zdarzenia bez `dane`, stan per telefon, rozparowanie. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { podlacz, rozeslijZdarzenie, rozeslijStan, ileTelefonow } from '../services/StrumienStada.js';

function polaczenie() {
    const req = new EventEmitter();
    const res = { naglowki: null, tekst: '', koniec: false,
        writeHead(_k, h) { this.naglowki = h; }, write(s) { this.tekst += s; }, end() { this.koniec = true; } };
    return { req, res };
}
const zdarzenia = (tekst, nazwa) => tekst.split('\n\n').filter((b) => b.startsWith(`event: ${nazwa}\n`)).map((b) => JSON.parse(b.split('\ndata: ')[1]));

test('stan na start, zdarzenie bez dane, nowa migawka z nazwą każdego telefonu', async () => {
    const a = polaczenie(), b = polaczenie();
    await podlacz(a.req, a.res, { token: 'ta', stan: async () => ({ urzadzenie: 'Pixel', xp: 1 }), zyje: async () => true });
    await podlacz(b.req, b.res, { token: 'tb', stan: async () => ({ urzadzenie: 'Tablet', xp: 1 }), zyje: async () => true });
    assert.equal(a.res.naglowki['Content-Type'], 'text/event-stream; charset=utf-8');
    assert.equal(ileTelefonow(), 2);

    rozeslijZdarzenie({ id: 7, kiedy: 'x', agent: 'Joanna', rodzaj: 'praca', tresc: 'ballada', dane: { sekret: 'NIE' } });
    assert.deepEqual(zdarzenia(a.res.tekst, 'szyna'), [{ id: 7, kiedy: 'x', agent: 'Joanna', rodzaj: 'praca', tresc: 'ballada' }]);
    assert.ok(!a.res.tekst.includes('NIE'));

    await rozeslijStan();
    assert.deepEqual(zdarzenia(a.res.tekst, 'stan').map((s) => s.urzadzenie), ['Pixel', 'Pixel']);
    assert.deepEqual(zdarzenia(b.res.tekst, 'stan').map((s) => s.urzadzenie), ['Tablet', 'Tablet']);

    a.req.emit('close'); b.req.emit('close');
    assert.equal(ileTelefonow(), 0);
});

test('długa treść przycięta do 300 znaków', async () => {
    const a = polaczenie();
    await podlacz(a.req, a.res, { token: 't', stan: async () => ({}), zyje: async () => true });
    rozeslijZdarzenie({ id: 1, agent: 'K', rodzaj: 'r', tresc: 'x'.repeat(5000) });
    assert.equal(zdarzenia(a.res.tekst, 'szyna')[0].tresc.length, 300);
    a.req.emit('close');
});
