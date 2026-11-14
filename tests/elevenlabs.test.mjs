// 🎙️ ElevenLabs w Katedrze — atrapa API (te same ścieżki, nagłówki i kształty błędów co prawdziwe), prawdziwy dysk, ffmpeg i trasy HTTP.
// Prawdziwe ElevenLabs w tym teście NIE bierze udziału — żaden kredyt nie schodzi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import { utworzElevenLabs, zamontujTrasyElevenLabs, rozdzielRole, rolaMowcy, kawalki, skrotMowy, ROLE, GLOSY_BIBLIOTEKI, MAX_KAWALKA } from '../services/ElevenLabs.js';
import { SCIEZKI_TYLKO_LOKALNE } from '../services/StrazMostu.js';

const uruchom = promisify(execFile);

test('czyste: role w tekście, mówcy księgi, kawałki, skrót nagrania', () => {
    const seg = rozdzielRole('Deszcz bębnił o szybę. „Zostań jeszcze” — powiedziała cicho.\n— Nie mogę — odparł Kael. — Świt już idzie.\nPotem wyszeptała: „wróć”.');
    assert.deepEqual(seg.map((s) => s.rola), ['kronikarz', 'postac2', 'kronikarz', 'postac1', 'kronikarz', 'postac1', 'kronikarz', 'szept']);
    assert.equal(seg[1].tekst, 'Zostań jeszcze'); assert.equal(seg[3].tekst, 'Nie mogę'); assert.equal(seg[4].tekst, 'odparł Kael.'); assert.equal(seg[7].tekst, 'wróć');
    assert.deepEqual(rozdzielRole('Sama narracja bez mowy.').map((s) => s.rola), ['kronikarz']);

    const mapa = {};
    assert.equal(rolaMowcy('Narrator', mapa), 'kronikarz'); assert.equal(rolaMowcy('Der Chronist', mapa), 'kronikarz');
    assert.equal(rolaMowcy('Elara', mapa), 'elara'); assert.equal(rolaMowcy('KAEL (S.M.T.)', mapa), 'kael');
    assert.equal(rolaMowcy('Mira', mapa), 'postac1'); assert.equal(rolaMowcy('Orin', mapa), 'postac2'); assert.equal(rolaMowcy('mira', mapa), 'postac1', 'ten sam mówca = ta sama rola');
    assert.deepEqual(mapa, { mira: 'postac1', orin: 'postac2' });

    const dlugi = Array.from({ length: 80 }, (_, i) => `To jest zdanie numer ${i}, wcale nie takie krótkie.`).join(' ');
    const k = kawalki(dlugi);
    assert.ok(k.length > 1 && k.every((x) => x.length <= MAX_KAWALKA) && k.every((x) => /[.]$/.test(x)), 'cięcie na granicy zdania');
    assert.equal(k.join(' '), dlugi);
    assert.equal(skrotMowy({ tekst: ' a  b ', glos: 'g', model: 'm' }), skrotMowy({ tekst: 'a b', glos: 'g', model: 'm' }));
    assert.notEqual(skrotMowy({ tekst: 'a b', glos: 'g', model: 'm' }), skrotMowy({ tekst: 'a b', glos: 'h', model: 'm' }));
    assert.ok(Object.values(ROLE).every((r) => GLOSY_BIBLIOTEKI.some((g) => g.id === r.domyslny)), 'każda rola ma domyślny głos z listy');
});

test('wieczny cache, zgoda przed wydatkiem, obsada, scena wielogłosowa, efekt tła, błędy klucza (trasy HTTP)', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'eleven-'));
    const mp3 = path.join(tmp, 'wzor.mp3');
    await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=1', '-b:a', '64k', mp3]);
    const dzwiek = await fs.readFile(mp3);
    const wywolania = []; let tryb = 'ok';
    const json = (o, status) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    const atrapa = async (url, o = {}) => {
        const u = new URL(url), cialo = o.body ? JSON.parse(o.body) : null;
        if (o.headers?.['xi-api-key'] !== 'sk_test') return json({ detail: { status: 'invalid_api_key', message: 'Invalid API key' } }, 401);
        if (o.method !== 'POST') return json({ detail: { status: 'missing_permissions', message: 'The API key you used is missing the permission voices_read to execute this operation.' } }, 401);
        if (u.pathname.startsWith('/v1/text-to-speech/')) {
            const glos = u.pathname.split('/').pop();
            if (glos === 'nieznanyGlos0000000000') return json({ detail: { status: 'voice_not_found', message: 'A voice was not found.' } }, 404);
            if (cialo.model_id === 'katedra_sprawdza_glos') return json({ detail: { status: 'model_not_found', message: 'no model' } }, 400);
            if (tryb === 'limit') return json({ detail: { status: 'quota_exceeded', message: 'You have 0 credits remaining.' } }, 401);
            wywolania.push({ glos, tekst: cialo.text, model: cialo.model_id });
            await new Promise((r) => setTimeout(r, 30));
            return new Response(dzwiek, { status: 200, headers: { 'content-type': 'audio/mpeg', 'character-cost': String(cialo.text.length) } });
        }
        if (u.pathname === '/v1/sound-generation') { wywolania.push({ efekt: cialo.text, sek: cialo.duration_seconds, loop: cialo.loop }); return new Response(dzwiek, { status: 200, headers: { 'content-type': 'audio/mpeg', 'character-cost': '400' } }); }
        return json({ detail: 'nie ma' }, 404);
    };
    let klucz = 'sk_test';
    const paczka = path.join(tmp, 'paczka');
    const E = utworzElevenLabs({ katalog: path.join(tmp, 'el'), klucz: async () => klucz, fetch: atrapa, ffmpeg: ffmpegPath, uruchom, miejsca: { opodysk: async (id) => { if (id !== 'j-1') throw new Error('Nie ma takiej kampanii.'); return path.join(paczka, 'voices'); } } });
    const dopiete = [];
    const app = express(); app.use(express.json());
    zamontujTrasyElevenLabs(app, E, { poMowie: async (x) => { dopiete.push(x.cel); return { scena: x.cel.scena }; }, poEfekcie: async (x) => ({ atmosfera: { plik: x.wynik.nazwa } }) });
    const srv = app.listen(0), baza = `http://127.0.0.1:${srv.address().port}`;
    const zadaj = async (m, s, b) => { const r = await fetch(baza + s, { method: m, headers: { 'Content-Type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); return { status: r.status, ...(await r.json()) }; };
    try {
        // stan: połączony, obsada domyślna, brak uprawnień do salda i głosów konta powiedziany wprost
        let s = await zadaj('GET', '/api/elevenlabs');
        assert.equal(s.polaczony, true); assert.equal(s.saldo, null); assert.equal(s.glosyKonta, null); assert.equal(s.uwagi.length, 2);
        assert.equal(s.obsada.elara.nazwa, 'Charlotte'); assert.equal(s.obsada.kronikarz.wlasny, false); assert.equal(s.model, 'eleven_multilingual_v2');

        const m = { rodzaj: 'opodysk', id: 'j-1' }, motto = 'Two cups of warmth on a wooden table, no more masks.';
        let w = await zadaj('POST', '/api/elevenlabs/wycena', { miejsce: m, tekst: motto, rola: 'elara' });
        assert.equal(w.wycena.znakow, motto.length); assert.equal(w.wycena.kredytow, motto.length); assert.equal(w.wycena.wArchiwum, false); assert.equal(w.url, undefined);

        // bez zgody: odmowa z wyceną, ElevenLabs nic nie dostaje
        let r = await zadaj('POST', '/api/elevenlabs/mow', { miejsce: m, tekst: motto, rola: 'elara' });
        assert.equal(r.status, 402); assert.equal(r.kod, 'BEZ_ZGODY'); assert.equal(r.wycena.znakow, motto.length); assert.equal(wywolania.length, 0);

        // ze zgodą: dwa żądania naraz o to samo nagranie = JEDNO wywołanie; plik w voices/<sha>.mp3 paczki
        const [a, b] = await Promise.all([zadaj('POST', '/api/elevenlabs/mow', { miejsce: m, tekst: motto, rola: 'elara', zgoda: true, cel: { scena: 5 } }), zadaj('POST', '/api/elevenlabs/mow', { miejsce: m, tekst: motto, rola: 'elara', zgoda: true })]);
        assert.equal(a.success, true, a.message); assert.equal(b.success, true, b.message);
        assert.equal(wywolania.length, 1); assert.equal(wywolania[0].glos, 'XB0fDUnXU5powFXDhCwa'); assert.equal(wywolania[0].model, 'eleven_multilingual_v2');
        assert.equal(a.nazwa, `${skrotMowy({ tekst: motto, glos: 'XB0fDUnXU5powFXDhCwa', model: 'eleven_multilingual_v2' })}.mp3`);
        assert.deepEqual(await fs.readdir(path.join(paczka, 'voices')), [a.nazwa]);
        assert.deepEqual(dopiete, [{ scena: 5 }]); assert.equal(a.scena, 5);
        assert.equal(a.plik, undefined, 'ścieżka z dysku nie wychodzi');
        assert.equal((await fetch(baza + a.url)).status, 200);

        // drugi raz: archiwum, 0 kredytów, bez zgody, bez wywołania
        w = await zadaj('POST', '/api/elevenlabs/wycena', { miejsce: m, tekst: motto, rola: 'elara' });
        assert.equal(w.wycena.wArchiwum, true); assert.equal(w.wycena.kredytow, 0); assert.equal(w.url, a.url);
        r = await zadaj('POST', '/api/elevenlabs/mow', { miejsce: m, tekst: motto, rola: 'elara' });
        assert.equal(r.success, true); assert.equal(r.zArchiwum, true); assert.equal(r.znakow, 0); assert.equal(wywolania.length, 1);
        // inny głos tego samego tekstu = inne nagranie
        w = await zadaj('POST', '/api/elevenlabs/wycena', { miejsce: m, tekst: motto, rola: 'kael' });
        assert.equal(w.wycena.wArchiwum, false);

        // księga ze strukturą: narrator + dwie postacie + Elara → cztery głosy, jedna sklejona scena; mówca trzyma głos
        const ks = { rodzaj: 'ksiega', id: 'Lot nad Teterhią' };
        const segmenty = [{ postac: 'Narrator', tekst: 'Nad wyspą wstawał świt.' }, { postac: 'Mira', tekst: 'Widzisz to światło?' }, { postac: 'Orin', tekst: 'Widzę. Lecimy.' }, { postac: 'Elara', tekst: 'Czekałam na was.' }, { postac: 'Mira', tekst: 'Już jesteśmy.' }];
        w = await zadaj('POST', '/api/elevenlabs/wycena', { miejsce: ks, segmenty });
        assert.equal(w.wycena.fragmentow, 5); assert.equal(w.wycena.znakow, segmenty.reduce((n, x) => n + x.tekst.length, 0)); assert.equal(w.wycena.glosy.length, 4);
        const przed = wywolania.length;
        r = await zadaj('POST', '/api/elevenlabs/mow', { miejsce: ks, segmenty, zgoda: true });
        assert.equal(r.success, true, r.message); assert.match(r.nazwa, /^scena-[0-9a-f]{20}\.mp3$/);
        const nowe = wywolania.slice(przed);
        assert.deepEqual(nowe.map((x) => x.glos), ['JBFqnCBsd6RMkjVDRZzb', 'cgSgspJ2msm6clMCkdW9', 'TX3LPaxmHKxFdv7VOQHJ', 'XB0fDUnXU5powFXDhCwa', 'cgSgspJ2msm6clMCkdW9']);
        const katKs = path.join(tmp, 'el', 'ksiegi', 'lot-nad-teterhia', 'voices');
        assert.deepEqual(JSON.parse(await fs.readFile(path.join(katKs, 'obsada.json'), 'utf8')), { mira: 'postac1', orin: 'postac2' });
        const sek = Number(/Duration: 00:00:(\d+\.\d+)/.exec(await uruchom(ffmpegPath, ['-hide_banner', '-i', path.join(katKs, r.nazwa)]).catch((e) => e.stderr))[1]);
        assert.ok(sek > 5.5 && sek < 7.5, `pięć fragmentów po sekundzie z oddechem, jest ${sek}`);
        // dopisana jedna kwestia: płacimy tylko za nią
        w = await zadaj('POST', '/api/elevenlabs/wycena', { miejsce: ks, segmenty: [...segmenty, { postac: 'Orin', tekst: 'Nareszcie.' }] });
        assert.equal(w.wycena.doNagrania, 1); assert.equal(w.wycena.znakow, 10);

        // obsada: głos sprawdzany bez kosztu; nieznany odrzucony; własny zmienia nagranie; powrót do domyślnego
        r = await zadaj('PUT', '/api/elevenlabs/obsada', { rola: 'kael', glos: { id: 'nieznanyGlos0000000000' } });
        assert.equal(r.status, 404); assert.equal(r.kod, 'ZLY_GLOS');
        r = await zadaj('PUT', '/api/elevenlabs/obsada', { rola: 'kael', glos: { id: 'CwhRBWXzGAHq8TQ4Fs17' }, model: 'eleven_v3' });
        assert.equal(r.obsada.kael.nazwa, 'Roger'); assert.equal(r.obsada.kael.wlasny, true); assert.equal(r.model, 'eleven_v3');
        assert.equal((await zadaj('PUT', '/api/elevenlabs/obsada', { model: 'gpt' })).success, false);
        w = await zadaj('POST', '/api/elevenlabs/wycena', { miejsce: m, tekst: motto, rola: 'elara' });
        assert.equal(w.wycena.wArchiwum, false, 'inny model = inne nagranie (stare zostaje w archiwum)');
        await zadaj('PUT', '/api/elevenlabs/obsada', { rola: 'kael', glos: null, model: 'eleven_multilingual_v2' });

        // efekt tła: zgoda, cache po opisie + czasie + pętli
        const fx = { miejsce: m, opis: 'night rain against a diner window, distant thunder', sekundy: 12, petla: true };
        w = await zadaj('POST', '/api/elevenlabs/efekt/wycena', fx);
        assert.equal(w.wycena.wArchiwum, false); assert.equal(w.wycena.sekundy, 12);
        assert.equal((await zadaj('POST', '/api/elevenlabs/efekt', fx)).kod, 'BEZ_ZGODY');
        r = await zadaj('POST', '/api/elevenlabs/efekt', { ...fx, zgoda: true, cel: { atmosfera: true } });
        assert.equal(r.success, true, r.message); assert.match(r.nazwa, /^fx-[0-9a-f]{20}\.mp3$/); assert.equal(r.atmosfera.plik, r.nazwa);
        assert.deepEqual(wywolania.at(-1), { efekt: fx.opis, sek: 12, loop: true });
        const ile = wywolania.length;
        r = await zadaj('POST', '/api/elevenlabs/efekt', fx);
        assert.equal(r.zArchiwum, true); assert.equal(wywolania.length, ile);
        assert.equal((await zadaj('POST', '/api/elevenlabs/efekt/wycena', { ...fx, sekundy: 99 })).wycena.sekundy, 30, 'czas przycięty do 30 s');

        // dziennik zużycia: znaki i koszt z nagłówka
        s = await zadaj('GET', '/api/elevenlabs');
        assert.equal(s.zuzycie.wywolan, ile); assert.equal(s.zuzycie.sekundEfektow, 12);
        assert.equal(s.zuzycie.znakow, motto.length + segmenty.reduce((n, x) => n + x.tekst.length, 0));
        assert.equal(s.zuzycie.kredytowZNaglowka, s.zuzycie.znakow + 400);

        // błędy: brak kredytów nie zostawia pliku; zły / brak klucza; nieznane miejsce; plik spoza archiwum
        tryb = 'limit';
        r = await zadaj('POST', '/api/elevenlabs/mow', { miejsce: m, tekst: 'Nowe zdanie bez kredytów.', rola: 'kronikarz', zgoda: true });
        assert.equal(r.status, 429); assert.equal(r.kod, 'LIMIT');
        assert.equal((await fs.readdir(path.join(paczka, 'voices'))).filter((x) => x.endsWith('.tmp')).length, 0);
        tryb = 'ok'; klucz = 'sk_zly';
        r = await zadaj('POST', '/api/elevenlabs/mow', { miejsce: m, tekst: 'Inne zdanie.', zgoda: true });
        assert.equal(r.status, 401); assert.equal(r.kod, 'ZLY_KLUCZ');
        r = await zadaj('POST', '/api/elevenlabs/mow', { miejsce: m, tekst: motto, rola: 'elara' });
        assert.equal(r.success, true, 'archiwum gra nawet ze złym kluczem');
        klucz = '';
        assert.equal((await zadaj('GET', '/api/elevenlabs')).polaczony, false);
        assert.equal((await zadaj('POST', '/api/elevenlabs/mow', { miejsce: m, tekst: 'Jeszcze inne.', zgoda: true })).kod, 'BRAK_KLUCZA');
        klucz = 'sk_test';
        assert.equal((await zadaj('POST', '/api/elevenlabs/wycena', { miejsce: { rodzaj: 'opodysk', id: 'j-9' }, tekst: 'abc def' })).success, false);
        assert.equal((await zadaj('POST', '/api/elevenlabs/wycena', { miejsce: { rodzaj: 'dysk', id: 'x' }, tekst: 'abc def' })).success, false);
        assert.equal((await fetch(`${baza}/api/elevenlabs/plik/opodysk/j-1/..%2F..%2Fsekret.mp3`)).status, 404);
        assert.equal(SCIEZKI_TYLKO_LOKALNE.some((x) => '/api/elevenlabs/mow'.startsWith(x)), true, 'kredyty wydaje tylko maszyna Suwerena');
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});
