/** Nocna Zmiana: powtórzenia ×N i robota rund Projektu Stada (sondaż do końca pracy stada). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import * as NocnaZmiana from '../services/NocnaZmiana.js';

/** Most na niby: /api/wiedza/buduj (albo błąd), runda projektu + sondaż „trwa" → „gotowe". */
async function mostNaNiby() {
    const wolania = [];
    let pada = false, sondaze = 0;
    const serwer = http.createServer((req, res) => {
        let cialo = '';
        req.on('data', (c) => { cialo += c; });
        req.on('end', () => {
            wolania.push({ metoda: req.method, sciezka: req.url, cialo: cialo ? JSON.parse(cialo) : null });
            res.setHeader('Content-Type', 'application/json');
            if (req.url === '/api/wiedza/buduj') {
                if (pada) { res.statusCode = 500; return res.end(JSON.stringify({ success: false, message: 'Ollama milczy' })); }
                return res.end(JSON.stringify({ success: true, plikow: 3 }));
            }
            if (req.url === '/api/stado/projekt/forge-ab12/runda') return res.end(JSON.stringify({ success: true, sondaz: '/api/stado/projekt/forge-ab12/sondaz' }));
            if (req.url === '/api/stado/projekt/forge-ab12/sondaz') return res.end(JSON.stringify(++sondaze < 2 ? { success: true, stan: 'trwa' } : { success: true, stan: 'gotowe', podsumowanie: 'Forge: runda 3/3, zgodność 9/10' }));
            res.statusCode = 404; res.end('{}');
        });
    });
    await new Promise((r) => serwer.listen(0, '127.0.0.1', r));
    NocnaZmiana.skonfiguruj({ katalogKatedry: fs.mkdtempSync(path.join(os.tmpdir(), 'nocna-')), portMostu: serwer.address().port, szynaZdarzen: null });
    return { wolania, serwer, psuj: () => { pada = true; } };
}

test('powtórzenia ×N: udany przebieg wraca do kolejki, po N — gotowe; błąd przerywa serię', async () => {
    const m = await mostNaNiby();
    try {
        await assert.rejects(NocnaZmiana.dodaj({ rodzaj: 'graf-wiedzy', powtorzenia: 0 }), /od 1 do 20/);
        await assert.rejects(NocnaZmiana.dodaj({ rodzaj: 'graf-wiedzy', powtorzenia: 21 }), /od 1 do 20/);
        const z = await NocnaZmiana.dodaj({ rodzaj: 'graf-wiedzy', powtorzenia: 3 });
        const stanZ = async () => (await NocnaZmiana.stanZmiany()).zadania.find((x) => x.id === z.id);
        await NocnaZmiana.uruchomTeraz(z.id);
        assert.deepEqual([(await stanZ()).stan, (await stanZ()).wykonane], ['czeka', 1]);
        await NocnaZmiana.uruchomTeraz(z.id);
        await NocnaZmiana.uruchomTeraz(z.id);
        assert.deepEqual([(await stanZ()).stan, (await stanZ()).wykonane], ['gotowe', 3]);
        const dziennik = (await NocnaZmiana.stanZmiany()).dziennik;
        assert.deepEqual(dziennik.slice(0, 3).map((w) => w.powtorzenie), ['3/3', '2/3', '1/3']);

        const z2 = await NocnaZmiana.dodaj({ rodzaj: 'graf-wiedzy', powtorzenia: 5 });
        m.psuj();
        await assert.rejects(NocnaZmiana.uruchomTeraz(z2.id), /Ollama milczy/);
        const po = (await NocnaZmiana.stanZmiany()).zadania.find((x) => x.id === z2.id);
        assert.deepEqual([po.stan, po.wykonane], ['blad', 1]);

        const stare = await NocnaZmiana.dodaj({ rodzaj: 'graf-wiedzy' });
        assert.equal(stare.powtorzenia, 1);
    } finally { m.serwer.close(); }
});

test('robota rund Projektu Stada: wymaga projektu, woła rundę i czeka na sondażu, aż stado skończy', async () => {
    const m = await mostNaNiby();
    try {
        await assert.rejects(NocnaZmiana.dodaj({ rodzaj: 'projekt-stada-rundy', parametry: {} }), /projekt stada/);
        const robota = (await NocnaZmiana.stanZmiany()).roboty.find((r) => r.rodzaj === 'projekt-stada-rundy');
        assert.deepEqual(robota.opisPol.map((o) => [o.nazwa, o.wybor ?? o.typ]), [['projektStada', 'projekt-stada'], ['rundy', 'liczba'], ['petla', 'liczba']]);
        const z = await NocnaZmiana.dodaj({ rodzaj: 'projekt-stada-rundy', parametry: { projektStada: 'forge-ab12', rundy: 2, petla: 1 } });
        // Sondaż co 30 s w prawdziwej nocy — tu skracamy czekanie podmianą setTimeout.
        const stary = globalThis.setTimeout;
        globalThis.setTimeout = (fn, ms, ...a) => stary(fn, ms === 30_000 ? 1 : ms, ...a);
        let wynik;
        try { wynik = await NocnaZmiana.uruchomTeraz(z.id); } finally { globalThis.setTimeout = stary; }
        assert.deepEqual(m.wolania[0], { metoda: 'POST', sciezka: '/api/stado/projekt/forge-ab12/runda', cialo: { projektStada: 'forge-ab12', rundy: 2, petla: 1 } });
        assert.equal(wynik.wynik.podsumowanie, 'Forge: runda 3/3, zgodność 9/10');
        assert.equal(m.wolania.filter((w) => w.sciezka.endsWith('/sondaz')).length, 2);
    } finally { m.serwer.close(); }
});
