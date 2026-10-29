// 📖 Żywa Księga: Iskra Suwerena → stado (słowo Kronikarza + ilustracja FLUX), nagranie twarzy przez prawdziwy ffmpeg, trasy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import express from 'express';
import ffmpegPath from 'ffmpeg-static';
import { utworzZywaKsiege, zamontujTrasyZywejKsiegi, odczytajSlowo, oczyscRysunek, odczytajPrzeklad, SYSTEM_PRZEKLADU } from '../services/ZywaKsiega.js';
import { SCIEZKI_TYLKO_LOKALNE, czyDlaSparowanych } from '../services/StrazMostu.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ksiega-'));
const czekaj = async (f) => { for (let i = 0; i < 500 && !(await f()); i++) await new Promise((r) => setTimeout(r, 10)); };

function atrapy(kat, { slowo = 'SŁOWO: Twoje słowa niosą poranne światło. Stado czuje ten spokój.\nOBRAZ: a golden sunrise over a quiet sea with a glowing open book' } = {}) {
    const wolania = { chat: [], rysuj: [], przeklad: [] };
    const png = path.join(kat, 'comfy-out.png');
    execFileSync(ffmpegPath, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=gold:s=64x64', '-frames:v', '1', png]);
    return {
        wolania,
        cfg: {
            katalog: kat, ffmpeg: ffmpegPath,
            modelDla: async (id) => `model-${id}`,
            // jak piszModelem mostu: { tekst, silnik } (2026-10-29: goły napis w atrapie ukrył, że Księga czytała obiekt jako tekst)
            chat: async (model, system, user) => {
                // 🌍 przekład to osobna rozmowa Kronikarza — liczona osobno, żeby testy słowa liczyły tylko słowo
                if (system === SYSTEM_PRZEKLADU) { wolania.przeklad.push({ model, user }); return { tekst: '=== TEKST ===\nI am. Today I flow lightly.\n=== SŁOWO ===\nYour words carry the morning light.', silnik: model }; }
                wolania.chat.push({ model, system, user }); return { tekst: typeof slowo === 'function' ? slowo(wolania.chat.length) : slowo, silnik: model }; },
            rysuj: async ({ prompt, prefiks }) => { wolania.rysuj.push({ prompt, prefiks }); return png; },
        },
    };
}

test('odczyt słowa stada i rysunku AniDoodle', () => {
    assert.deepEqual(odczytajSlowo('<think>x</think>**SŁOWO:** Ciepłe słowa\nna dwa wiersze.\nOBRAZ: a calm forest of light and stars'), { slowo: 'Ciepłe słowa na dwa wiersze.', obraz: 'a calm forest of light and stars', styl: null });
    assert.equal(odczytajSlowo('bez formatu'), null);
    // na żywo 2026-10-29: etykieta po angielsku w tej samej linii wpadała do słowa
    assert.deepEqual(odczytajSlowo('SŁOWO: Wspólne ciepło koi duszę. Image: A gentle flow of light.'), { slowo: 'Wspólne ciepło koi duszę.', obraz: 'A gentle flow of light.', styl: null });
    assert.equal(odczytajSlowo('SŁOWO: Obraz świata jest jasny dla nas.').slowo, 'Obraz świata jest jasny dla nas.');
    assert.equal(odczytajSlowo('SŁOWO: Dosyć długie zdanie bez obrazu.').obraz, null);
    const r = oczyscRysunek({ klatki: [[{ kolor: '#aa0000', grubosc: 99, punkty: [[0.1, 0.1], [0.5, 0.5], [2, 2]] }, { punkty: [[0.3, 0.3]] }], [], [], []] });
    assert.deepEqual(r, { klatki: [[{ kolor: '#aa0000', grubosc: 20, punkty: [[0.1, 0.1], [0.5, 0.5]] }]] }, 'poza 0–1 i kreski z 1 punktu odpadają, ≤ 3 klatki');
    assert.throws(() => oczyscRysunek({ klatki: [[]] }), /pusty/);
});

test('Iskra → stado: Kronikarz pisze słowo i opis kadru, Paleta rysuje FLUX-em; pliki tylko z wpisu', async () => {
    const kat = tmp(); const a = atrapy(kat);
    const K = utworzZywaKsiege(a.cfg);
    await assert.rejects(K.dodaj({ tekst: '   ' }), /parę słów/);
    const w = await K.dodaj({ tekst: 'Jestem. Dziś płynę lekko.' });
    assert.match(w.id, /^k-\d{8}-[0-9a-f]{6}$/);
    await czekaj(async () => (await K.czytaj(w.id)).stado.every((s) => s.stan === 'gotowe' || s.stan === 'blad'));
    const g = await K.czytaj(w.id);
    assert.deepEqual(g.stado.map((s) => [s.rodzaj, s.kto, s.stan]), [['slowo', 'kronikarz', 'gotowe'], ['ilustracja', 'paleta', 'gotowe'], ['przeklad', 'kronikarz', 'gotowe']]);
    // 🌍 przekład: słowa Suwerena i odpowiedź Kronikarza idą do przekładu; świat dostaje je pod kluczem języka
    assert.match(a.wolania.przeklad[0].user, /Dziś płynę lekko[\s\S]*ODPOWIEDŹ KRONIKARZA:\nTwoje słowa niosą poranne światło/);
    assert.deepEqual(g.stado[2].tekst, 'I am. Today I flow lightly.');
    assert.equal((await K.publiczne())[0].przeklad.en.slowo, 'Your words carry the morning light.');
    assert.deepEqual(odczytajPrzeklad('=== TEKST ===\nOnly text'), { tekst: 'Only text', slowo: null });
    assert.equal(odczytajPrzeklad('bez znaczników'), null);
    assert.match(g.stado[0].tekst, /poranne światło/);
    assert.equal(a.wolania.chat[0].model, 'model-kronikarz');
    assert.match(a.wolania.chat[0].user, /Dziś płynę lekko/);
    assert.match(a.wolania.rysuj[0].prompt, /^a golden sunrise.*illuminated manuscript/);
    assert.equal(a.wolania.rysuj[0].prefiks, `katedra/zywa-ksiega/${w.id}`);
    assert.ok(fs.existsSync(await K.plik(w.id, 'ilustracja.png')));
    await assert.rejects(K.plik(w.id, 'wpis.json'), /Nie ma takiego pliku/);
    await assert.rejects(K.czytaj('../x'), /Nie ma takiego wpisu/);
});

test('zły format Kronikarza → jedna poprawka; FLUX padł → błąd z powodem, ↻ ponów rysuje ponownie', async () => {
    const kat = tmp();
    const a = atrapy(kat, { slowo: (n) => (n === 1 ? 'coś obok formatu' : 'SŁOWO: Druga próba trzyma format, dziękuję.\nOBRAZ: a lantern glowing in the misty garden') });
    let padnij = true;
    const rysuj = a.cfg.rysuj;
    a.cfg.rysuj = async (o) => { if (padnij) throw new Error('ComfyUI śpi'); return rysuj(o); };
    const K = utworzZywaKsiege(a.cfg);
    const w = await K.dodaj({ tekst: 'Mgła i latarnia.' });
    await czekaj(async () => (await K.czytaj(w.id)).stado[1].stan === 'blad');
    let g = await K.czytaj(w.id);
    assert.equal(a.wolania.chat.length, 2);
    assert.match(a.wolania.chat[1].user, /format był zły/);
    assert.equal(g.stado[0].stan, 'gotowe');
    assert.equal(g.stado[1].powod, 'ComfyUI śpi');
    padnij = false;
    await K.ponowStado(w.id);
    await czekaj(async () => (await K.czytaj(w.id)).stado[1].stan === 'gotowe');
    g = await K.czytaj(w.id);
    assert.equal(a.wolania.chat.length, 2, 'gotowe słowo nie liczy się drugi raz');
    assert.match(a.wolania.rysuj[0].prompt, /lantern/);
    await assert.rejects(K.ponowStado(w.id), /skończyło/);
});

test('ComfyUI dopiero wstaje → Paleta czeka i rysuje, zamiast od razu się poddać', async () => {
    const kat = tmp(); const a = atrapy(kat);
    let razy = 0; const rysuj = a.cfg.rysuj;
    a.cfg.rysuj = async (o) => { if (++razy < 3) throw new Error('ComfyUI właśnie wstaje (~30 s od startu). Spróbuj ponownie za chwilę.'); return rysuj(o); };
    const K = utworzZywaKsiege({ ...a.cfg, czekajComfyMs: 5 });
    const w = await K.dodaj({ tekst: 'Ranek z budzącym się ComfyUI.' });
    await czekaj(async () => (await K.czytaj(w.id)).stado[1].stan === 'gotowe');
    assert.equal(razy, 3);
});

test('duch po restarcie: „robi” bez pracy → błąd z powodem', async () => {
    const kat = tmp(); const a = atrapy(kat);
    a.cfg.chat = () => new Promise(() => {});   // wisi jak model przy restarcie
    const K1 = utworzZywaKsiege(a.cfg);
    const w = await K1.dodaj({ tekst: 'Zaraz restart.' });
    await czekaj(async () => (await K1.czytaj(w.id)).stado[0].stan === 'robi');
    const K2 = utworzZywaKsiege({ ...a.cfg, chat: undefined });
    await K2.sprzatnijDuchy();
    assert.match((await K2.czytaj(w.id)).stado[0].powod, /restartem/);
});

test('trasy: nagranie twarzy (prawdziwy webm → mp4), rysunek, publiczny, usunięcie do kosza; Straż = tylko maszyna', async () => {
    assert.ok(SCIEZKI_TYLKO_LOKALNE.includes('/api/zywa-ksiega'));
    const kat = tmp(); const a = atrapy(kat);
    const K = utworzZywaKsiege(a.cfg);
    const app = express(); app.use(express.json({ limit: '2mb' }));
    zamontujTrasyZywejKsiegi(app, K, { raw: express.raw });
    const srv = app.listen(0); const url = `http://127.0.0.1:${srv.address().port}`;
    try {
        const j = async (p, init) => { const r = await fetch(url + p, init); return { s: r.status, d: await r.json().catch(() => null), r }; };
        const nowy = await j('/api/zywa-ksiega', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tekst: 'Twarz przy stole.' }) });
        const id = nowy.d.wpis.id;
        const webm = path.join(kat, 'twarz.webm');
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=320x240:r=30:d=2', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=2', '-c:v', 'libvpx', '-b:v', '400k', '-c:a', 'libopus', '-shortest', webm]);
        const nag = await j(`/api/zywa-ksiega/${id}/nagranie`, { method: 'POST', headers: { 'Content-Type': 'video/webm' }, body: fs.readFileSync(webm) });
        assert.equal(nag.s, 200, JSON.stringify(nag.d));
        assert.equal(nag.d.wpis.nagranie.plik, 'nagranie.mp4');
        const mp4 = await fetch(`${url}/api/zywa-ksiega/${id}/plik/nagranie.mp4`);
        assert.equal(mp4.status, 200);
        assert.ok((await mp4.arrayBuffer()).byteLength > 5000);
        const rys = await j(`/api/zywa-ksiega/${id}/rysunek`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tytul: 'Słońce', rysunek: { klatki: [[{ kolor: '#c9a24a', grubosc: 3, punkty: [[0.2, 0.2], [0.8, 0.8]] }]] } }) });
        assert.equal(rys.d.wpis.rysunki[0].kto, 'suweren');
        assert.equal((await j(`/api/zywa-ksiega/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publiczny: false }) })).d.wpis.publiczny, false);
        assert.equal((await j(`/api/zywa-ksiega/${id}/plik/wpis.json`)).s, 404);
        await czekaj(async () => !K.stan().pracuje);
        assert.equal((await j(`/api/zywa-ksiega/${id}`, { method: 'DELETE' })).s, 200);
        assert.equal((await j('/api/zywa-ksiega')).d.wpisy.length, 0);
        assert.equal(fs.readdirSync(path.join(kat, 'zywa-ksiega', '_kosz')).length, 1, 'usunięte leży w koszu');
    } finally { srv.close(); }
});

test('🌍 dla świata: tylko wpisy publiczne i gotowe dodatki; plik prywatnego = 404; Straż wpuszcza tylko odczyt', async () => {
    const { czyWizytowka } = await import('../services/StrazMostu.js');
    const kat = tmp(); const a = atrapy(kat);
    const K = utworzZywaKsiege(a.cfg);
    const jawny = await K.dodaj({ tekst: 'Dla świata.' });
    const tajny = await K.dodaj({ tekst: 'Tylko dla mnie.', publiczny: false });
    await czekaj(async () => (await K.lista()).every((w) => w.stado.every((s) => s.stan === 'gotowe')));
    const app = express(); zamontujTrasyZywejKsiegi(app, K, { raw: express.raw });
    const srv = app.listen(0); const url = `http://127.0.0.1:${srv.address().port}`;
    try {
        const d = await (await fetch(`${url}/wizytowka/ksiega`)).json();
        assert.deepEqual(d.wpisy.map((w) => w.tekst), ['Dla świata.']);
        assert.match(d.wpisy[0].slowo.tekst, /poranne światło/);
        assert.equal(JSON.stringify(d).includes('model-'), false, 'bez nazw modeli i ścieżek z dysku');
        assert.equal((await fetch(url + d.wpisy[0].ilustracja.url)).status, 200);
        assert.equal((await fetch(`${url}/wizytowka/ksiega/${tajny.id}/ilustracja.png`)).status, 404);
        assert.equal((await fetch(`${url}/wizytowka/ksiega/${jawny.id}/wpis.json`)).status, 404);
    } finally { srv.close(); }
    const req = (method, p) => ({ method, path: p });
    assert.ok(czyWizytowka(req('GET', '/wizytowka/ksiega')));
    assert.ok(czyWizytowka(req('GET', `/wizytowka/ksiega/${jawny.id}/nagranie.mp4`)));
    assert.ok(!czyWizytowka(req('POST', '/wizytowka/ksiega')));
    assert.ok(!czyWizytowka(req('GET', `/wizytowka/ksiega/${jawny.id}/wpis.json`)));
    assert.ok(!czyWizytowka(req('GET', '/api/zywa-ksiega')));
});

test('zdjęcie we wpisie: obraz → JPEG ≤ 2048 px bez metadanych, trasa HTTP, publicznie tylko z wpisu „dla świata”', async () => {
    const kat = tmp(); const a = atrapy(kat);
    const K = utworzZywaKsiege(a.cfg);
    const app = express(); app.use(express.json()); zamontujTrasyZywejKsiegi(app, K, { raw: express.raw });
    const srv = app.listen(0); const url = `http://127.0.0.1:${srv.address().port}`;
    try {
        const w = await K.dodaj({ tekst: 'Moje zdjęcie z facjatą.' });
        const we = path.join(kat, 'duze.png');
        execFileSync(ffmpegPath, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=teal:s=3000x1500', '-frames:v', '1', '-metadata', 'comment=GPS 52.1 4.3', we]);
        const r = await fetch(`${url}/api/zywa-ksiega/${w.id}/zdjecie`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: fs.readFileSync(we) });
        const j = await r.json();
        assert.equal(j.success, true, j.message);
        assert.equal(j.wpis.zdjecie.plik, 'zdjecie.jpg');
        const jpg = path.join(kat, 'zywa-ksiega', w.id, 'zdjecie.jpg');
        const info = (() => { try { execFileSync(ffmpegPath, ['-hide_banner', '-i', jpg]); } catch (e) { return String(e.stderr); } })();
        assert.match(info, /mjpeg.*2048x1024/);
        assert.doesNotMatch(info, /GPS/);
        assert.equal(fs.existsSync(path.join(kat, 'zywa-ksiega', w.id, 'praca')), false);
        const zle = await fetch(`${url}/api/zywa-ksiega/${w.id}/zdjecie`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: Buffer.from('to nie obraz') });
        assert.equal(zle.status, 400);
        assert.equal((await K.czytaj(w.id)).zdjecie.plik, 'zdjecie.jpg');   // stare zostaje
        const pub = await (await fetch(`${url}/wizytowka/ksiega`)).json();
        assert.ok(pub.wpisy[0].zdjecie.url.startsWith(`/wizytowka/ksiega/${w.id}/zdjecie.jpg?v=`), pub.wpisy[0].zdjecie.url);
        assert.equal((await fetch(`${url}/wizytowka/ksiega/${w.id}/zdjecie.jpg`)).status, 200);
        await K.ustaw(w.id, { publiczny: false });
        assert.equal((await fetch(`${url}/wizytowka/ksiega/${w.id}/zdjecie.jpg`)).status, 404);
        assert.equal((await (await fetch(`${url}/api/zywa-ksiega/${w.id}/zdjecie`, { method: 'DELETE' })).json()).wpis.zdjecie, null);
        assert.equal(fs.existsSync(jpg), false);
    } finally { srv.close(); }
});

test('📱 StoL: Straż wpuszcza trasy Księgi dla sparowanych, trasa żąda tokenu (przed ciałem), wpisu z telefonu nie usunie', async () => {
    assert.equal(czyDlaSparowanych('/api/zywa-ksiega'), true);
    assert.equal(czyDlaSparowanych('/api/zywa-ksiega/k-20261029-087b8c/zdjecie'), true);
    assert.equal(czyDlaSparowanych('/api/zywa-ksiega/k-20261029-087b8c/plik/ilustracja.png'), true);
    assert.equal(czyDlaSparowanych('/api/zywa-ksiega/k-20261029-087b8c/plik/wpis.json'), false);
    assert.equal(czyDlaSparowanych('/api/zywa-ksiega/../stado.json'), false);
    assert.equal(czyDlaSparowanych('/api/stado/projekt/nowy'), true);

    const kat = tmp(); const a = atrapy(kat);
    const K = utworzZywaKsiege(a.cfg);
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.lokalny = req.get('x-test-zdalny') !== '1'; next(); });
    const dostep = async (req, res) => {
        if (req.lokalny && req.get('X-Stado-Token') === undefined) return true;
        if (req.get('X-Stado-Token') === 'dobry') return true;
        res.status(401).json({ success: false, message: 'Brak sparowania.' }); return false;
    };
    zamontujTrasyZywejKsiegi(app, K, { raw: express.raw, dostep });
    const srv = app.listen(0); const url = `http://127.0.0.1:${srv.address().port}`;
    try {
        const tel = { 'x-test-zdalny': '1', 'X-Stado-Token': 'dobry' };
        assert.equal((await fetch(`${url}/api/zywa-ksiega`, { headers: { 'x-test-zdalny': '1' } })).status, 401);
        const nowy = await (await fetch(`${url}/api/zywa-ksiega`, { method: 'POST', headers: { ...tel, 'Content-Type': 'application/json' }, body: JSON.stringify({ tekst: 'Iskra z telefonu.' }) })).json();
        assert.equal(nowy.success, true);
        const bez = await fetch(`${url}/api/zywa-ksiega/${nowy.wpis.id}/zdjecie`, { method: 'POST', headers: { 'x-test-zdalny': '1', 'Content-Type': 'image/png' }, body: Buffer.alloc(1000) });
        assert.equal(bez.status, 401);
        const usun = await fetch(`${url}/api/zywa-ksiega/${nowy.wpis.id}`, { method: 'DELETE', headers: tel });
        assert.equal(usun.status, 403);
        assert.equal((await fetch(`${url}/api/zywa-ksiega/${nowy.wpis.id}`, { method: 'PUT', headers: { ...tel, 'Content-Type': 'application/json' }, body: JSON.stringify({ publiczny: false }) })).status, 200);
        assert.equal((await fetch(`${url}/api/zywa-ksiega/${nowy.wpis.id}`, { method: 'DELETE' })).status, 200);   // przy maszynie wolno
    } finally { srv.close(); }
});
