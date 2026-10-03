// 🧭 Ścieżki od człowieka: "C:\…" (Ctrl+Shift+C w Windows) i file:///… → zwykła ścieżka; zwykły tekst nietknięty.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { oczyscSciezke, oczyscWartosc, czyscSciezkiMiddleware } from '../services/Sciezki.js';

test('cudzysłowy wokół ścieżki znikają; file:/// staje się ścieżką (z dekodowaniem %20)', () => {
    assert.equal(oczyscSciezke('"F:\\5 stars\\TeO STUDIO\\ujecia\\010__5_10_Kosmiczny_rytm.png"'), 'F:\\5 stars\\TeO STUDIO\\ujecia\\010__5_10_Kosmiczny_rytm.png');
    assert.equal(oczyscSciezke('  "F:\\a b.png"  '), 'F:\\a b.png');
    assert.equal(oczyscSciezke('file:///F:/5%20stars/TeO%20STUDIO/ujecia/017__5_17.png'), 'F:/5 stars/TeO STUDIO/ujecia/017__5_17.png');
    assert.equal(oczyscSciezke('file:///home/teo/kadr.png'), '/home/teo/kadr.png');
    assert.equal(oczyscSciezke('"\\\\NAS\\filmy\\a.mp4"'), '\\\\NAS\\filmy\\a.mp4');
    assert.equal(oczyscSciezke('„F:\\kadr.png”'), 'F:\\kadr.png');
});

test('zwykły tekst nietknięty: cytat, cudzysłów w środku, adres http, dataURL', () => {
    for (const t of ['"Tu ta chwila"', 'powiedział "F:\\x"', 'https://youtu.be/abc', '"to nie jest C: ścieżka"', 'data:image/png;base64,"AAA"', '']) {
        assert.equal(oczyscSciezke(t), t, t);
    }
});

test('wartości żądania: pola wielolinijkowe linia po linii, tablice i obiekty, długie napisy pomijane', () => {
    const kadry = 'file:///F:/5%20stars/ujecia/017.png\n"F:\\5 stars\\ujecia\\010.png"\nF:\\czysta.png';
    const w = oczyscWartosc({ projekt: 'elara', kadry, pliki: ['"F:\\a.mp4"', 'F:\\b.mp4'], meta: { film: '"F:\\m.mp4"' }, liczba: 3 });
    assert.equal(w.kadry, 'F:/5 stars/ujecia/017.png\nF:\\5 stars\\ujecia\\010.png\nF:\\czysta.png');
    assert.deepEqual(w.pliki, ['F:\\a.mp4', 'F:\\b.mp4']);
    assert.equal(w.meta.film, 'F:\\m.mp4');
    assert.equal(w.liczba, 3);
    const dlugi = `"F:\\x"${'A'.repeat(100_001)}`;
    assert.equal(oczyscWartosc(dlugi), dlugi);
});

test('middleware w Express 5: body i query trafiają do trasy już oczyszczone', async () => {
    const app = express();
    app.use(express.json());
    app.use(czyscSciezkiMiddleware);
    app.post('/t', (req, res) => res.json({ body: req.body, q: req.query.plik }));
    const serwer = app.listen(0);
    try {
        const port = serwer.address().port;
        const r = await fetch(`http://127.0.0.1:${port}/t?plik=${encodeURIComponent('"F:\\q.png"')}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ film: '"F:\\5 stars\\f.mp4"' }) });
        const d = await r.json();
        assert.equal(d.body.film, 'F:\\5 stars\\f.mp4');
        assert.equal(d.q, 'F:\\q.png');
    } finally { serwer.close(); }
});
