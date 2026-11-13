// 🎛️ Jason — orkiestrator kampanii: atrapa Suno MCP (te same nazwy narzędzi i kształty co prawdziwe), prawdziwy dysk i trasy HTTP.
// Prawdziwe Suno i FLUX w tym teście NIE biorą udziału.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import { zbudujStoryboard, sekcjeTekstu, przydzialScen, czasyScen, motywyZWersow, KLIMAT_TELEDYSKU } from '../services/StoryboardTeledysku.js';
import { czyDlaSparowanych } from '../services/StrazMostu.js';
import { oczyscStacje, artystaZGlosu } from '../services/JasonOrchestrator.js';
import { czystyTekst, naglowekWav, wymiaryJpeg, folderWydania } from '../services/JasonOrchestrator.js';
import { utworzJasona, zamontujTrasyJasona, oczyscZlecenie, argumentyUtworu, klipyZWyniku, znajdzWorkspace, stanyKlipow, dopasujGlos, czasUtworu, STACJE, ALBUM } from '../services/JasonOrchestrator.js';

const tekst = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o) }] });
const blad = (o) => ({ isError: true, content: [{ type: 'text', text: JSON.stringify(o) }] });
// kształt z prawdziwego voices-list (2026-11-12)
const GLOSY = [{ id: 'v-bella', name: 'Bella' }, { id: 'v-kael', name: 'KAEL (S.M.T.)' }, { id: 'v-elara', name: 'ELARA (S.M.T)' }];

function atrapaSuno(tmp, { workspace = true, kredyt = false, limitowane = 0 } = {}) {
    const wywolania = [];
    let czekan = 0, limit = limitowane;
    const zapiszUtwory = async (_w, gotowe) => Promise.all((gotowe ?? []).map(async (u) => {
        const plik = `Suno MCP/${u.tytul} [${u.id.slice(0, 8)}].mp3`;
        await fs.mkdir(path.join(tmp, 'muzyka', 'Suno MCP'), { recursive: true });
        await fs.writeFile(path.join(tmp, 'muzyka', plik), 'mp3');
        return { ...u, plik, nowy: true };
    }));
    return {
        wywolania, zapiszUtwory,
        async wywolaj(nazwa, args, opcje = {}) {
            wywolania.push({ nazwa, args, opcje });
            if (nazwa === 'workspaces-list') return { wynik: tekst({ workspaces: [{ id: 'ws-inne', name: 'Inny album' }] }), utwory: [] };
            if (nazwa === 'workspaces-create') { if (!workspace) throw new Error('403 forbidden'); return { wynik: tekst({ id: 'ws-1', name: args.name }), utwory: [] }; }
            if (nazwa === 'voices-list') return { wynik: tekst({ voices: args.collection === 'own' ? GLOSY : [] }), utwory: [] };
            if (nazwa === 'audio-create') return { wynik: tekst({ clip_ids: ['aaaaaaaa-1', 'bbbbbbbb-2'] }), utwory: [] };
            if (nazwa === 'audio-wait') {
                czekan++;
                if (czekan === 1) return { wynik: tekst({ clips: args.ids.map((id) => ({ id, status: 'streaming' })) }), utwory: [] };
                // kształt z prawdziwego audio-retrieve: metadata.duration, song_url — bez adresu pliku
                return { wynik: tekst({ clips: args.ids.map((id, i) => ({ id, status: 'complete', title: 'Velvet Booth for Two', song_url: `https://suno.com/song/${id}`, metadata: { duration: i ? 173.2 : 193.6 } })) }), utwory: [] };
            }
            if (nazwa === 'audio-download') {
                if (limit > 0) { limit--; return { wynik: blad({ code: 'rate_limited', error: 'Woah, too many downloads at once.', reason: 'rate_limited', retry_after_seconds: 1 }), utwory: [] }; }
                return { wynik: tekst(kredyt && !args.confirm ? { status: 'requires_credit' } : { status: 'ready', url: `https://cdn.example/dl/${args.id}` }), utwory: [] };
            }
            throw new Error(`nieznane narzędzie ${nazwa}`);
        },
    };
}
const ile = (suno, nazwa) => suno.wywolania.filter((w) => w.nazwa === nazwa).length;

test('czyste: zlecenie, argumenty Suno, klipy, workspace, stany, głosy', () => {
    const z = oczyscZlecenie({});
    assert.equal(z.stacja.tytul, STACJE[1].tytul);
    assert.deepEqual(z.artysci, ['Elara', 'Kael']);
    assert.equal(z.album, 'Zero Gravity Heart (0.00G Sessions)');
    assert.equal(z.album, ALBUM);
    assert.match(z.okladka.prompt, /inside a late-night retro diner/);
    assert.match(z.okladka.prompt, /strictly no text, no letters, no neon words, no signage/);
    // Stacja 1 = tekst i styl Suwerena → tryb własny Suno: lyrics + style, BEZ description (mieszanie = 400)
    const s1 = argumentyUtworu({ id: 'j-00000000', ...z, workspace: { id: 'ws-1' } });
    assert.match(s1.lyrics, /^\[Intro - Warm Fender Rhodes chords/);
    assert.match(s1.lyrics, /In a velvet booth for two, zero point zero, me and you/);
    assert.match(s1.lyrics, /Zero gravity heart\.\.\.$/);
    assert.equal(s1.lyrics.split('\n').length, 16);
    assert.match(s1.style, /^sensual neo-soul, late night lounge, 82 bpm/);
    assert.equal(s1.description, undefined);
    assert.equal(s1.title, 'Velvet Booth for Two (82 BPM Intro)');
    assert.equal(s1.workspace_id, 'ws-1');
    assert.equal(s1.idempotency_key, 'j-00000000');
    assert.equal(s1.voice_id, undefined, 'duet bez wskazania = bez persony');
    // tryb prosty: sam opis → description bez style/lyrics (własny opis stacji 1 nie ciągnie tekstu wzorca)
    const prosty = argumentyUtworu({ id: 'j-2', ...oczyscZlecenie({ stacja: { nr: 1, tytul: 'Inna', opis: 'slow jazz duet' } }) });
    assert.ok(prosty.description && !prosty.lyrics && !prosty.style);
    assert.throws(() => oczyscZlecenie({ stacja: 77 }), /Nie znam stacji/);
    assert.throws(() => oczyscZlecenie({ stacja: { tytul: 'Bez treści' } }), /opisu/);
    assert.deepEqual(klipyZWyniku({ clip_ids: ['a', 'b'], id: 'a' }), ['a', 'b']);
    assert.equal(znajdzWorkspace({ data: { items: [{ id: 'w9', name: ' zero gravity heart (0.00g sessions) ' }] } }, ALBUM), 'w9');
    assert.deepEqual(stanyKlipow({ id: 'a', status: 'complete', metadata: { duration: 193.6 }, song_url: 'https://suno.com/song/a' }), [{ id: 'a', status: 'complete', tytul: null, sekundy: 194, odsluch: 'https://suno.com/song/a', blad: null }]);
    assert.equal(czasUtworu(194), '3:14');
    assert.equal(czasUtworu(173), '2:53');
    // 🎤 persony: nazwa artysty → oficjalny głos; id wprost; brak = null
    assert.deepEqual(dopasujGlos(GLOSY, 'Kael'), { id: 'v-kael', nazwa: 'KAEL (S.M.T.)' });
    assert.deepEqual(dopasujGlos(GLOSY, 'KAEL (SMT)'), { id: 'v-kael', nazwa: 'KAEL (S.M.T.)' });
    assert.deepEqual(dopasujGlos(GLOSY, 'elara'), { id: 'v-elara', nazwa: 'ELARA (S.M.T)' });
    assert.equal(dopasujGlos(GLOSY, 'v-bella').nazwa, 'Bella');
    assert.equal(dopasujGlos(GLOSY, 'Orion'), null);
    // domyślny głos: duet → brak; jeden artysta → on; wskazany wprost; „brak” wyłącza
    assert.equal(oczyscZlecenie({}).glos, null);
    assert.deepEqual(oczyscZlecenie({ artysci: ['Kael'] }).glos, { zadany: 'Kael', auto: true });
    assert.deepEqual(oczyscZlecenie({ glos: 'ELARA (S.M.T)' }).glos, { zadany: 'ELARA (S.M.T)', auto: false });
    assert.equal(oczyscZlecenie({ artysci: ['Kael'], glos: 'brak' }).glos, null);
});

test('kampania: tworzy, NIE pobiera, wystawia do odsłuchu; ✓ pobiera tylko wskazaną wersję (trasy HTTP)', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-'));
    const suno = atrapaSuno(tmp, { kredyt: true });
    const wiesci = [], decyzje = [];
    const J = utworzJasona({ katalog: tmp, suno, przerwaPobraniaMs: 5, wiesc: (t) => wiesci.push(t), decyzja: (d) => decyzje.push(d),
        okladka: async ({ prompt }) => { assert.match(prompt, /diner/i); const p = path.join(tmp, 'flux.png'); await fs.writeFile(p, 'png'); return p; } });
    const app = express(); app.use(express.json());
    zamontujTrasyJasona(app, J);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    const post = (s, b) => fetch(baza + s, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b ?? {}) });
    try {
        let r = await (await post('/api/jason/wykonaj-kampanie', { stacja: 1, glos: 'Kael' })).json();
        assert.equal(r.success, true);
        const id = r.kampania.id;
        assert.equal((await post('/api/jason/wykonaj-kampanie', { stacja: 1 })).status, 409, 'druga taka sama w toku');
        await J._czekaj(id);
        let k = (await (await fetch(`${baza}/api/jason/kampanie/${id}`)).json()).kampania;
        assert.equal(k.stan, 'do_akceptacji', k.blad);
        assert.deepEqual(k.workspace, { id: 'ws-1', nazwa: ALBUM, nowy: true });
        // 🎤 oficjalny głos Kaela poszedł do Suno jako voice_id
        assert.equal(k.glos.nazwa, 'KAEL (S.M.T.)');
        assert.equal(suno.wywolania.find((w) => w.nazwa === 'audio-create').args.voice_id, 'v-kael');
        assert.equal(ile(suno, 'audio-create'), 1);
        // ⛔ potok niczego nie pobrał: zero audio-download, czekanie z zapisz: false, żadnego pliku
        assert.equal(ile(suno, 'audio-download'), 0);
        assert.ok(suno.wywolania.filter((w) => w.nazwa === 'audio-wait').every((w) => w.opcje.zapisz === false));
        assert.ok(k.klipy.every((c) => c.plik === null));
        assert.deepEqual(k.klipy.map((c) => [c.sekundy, c.odsluch]), [[194, 'https://suno.com/song/aaaaaaaa-1'], [173, 'https://suno.com/song/bbbbbbbb-2']]);
        await assert.rejects(fs.access(path.join(tmp, 'muzyka', 'Suno MCP')));
        assert.equal(k.okladka.plik, 'okladka.png');
        // Izba: odsłuch + po jednym przycisku pobrania na wersję
        const [poz] = await J.zrodloIzby.czekajace();
        assert.match(poz.opis, /NIC nie pobrano/);
        assert.match(poz.opis, /Wersja 1 \(3:14\): https:\/\/suno\.com\/song\/aaaaaaaa-1/);
        assert.match(poz.opis, /głos: KAEL/);
        assert.deepEqual(poz.akcje.map((a) => a.id), ['pobierz-1', 'pobierz-2', 'odrzuc']);
        assert.match(poz.akcje[1].etykieta, /wersję 2 \(2:53\)/);
        assert.ok(poz.akcje.every((a) => a.zdalnie));
        // ✓ bez wskazania wersji przy dwóch gotowych → odmowa, nic nie schodzi z limitu
        assert.equal((await post(`/api/jason/kampanie/${id}/przyjmij`)).status, 400);
        assert.equal(ile(suno, 'audio-download'), 0);
        // ✓ wersja 2 → pobrana TYLKO ona (requires_credit → confirm, bo klik Suwerena jest zgodą)
        await J.zrodloIzby.decyduj(id, 'pobierz-2', {});
        k = await J.kampania(id);
        assert.equal(k.stan, 'przyjeta');
        assert.deepEqual(suno.wywolania.filter((w) => w.nazwa === 'audio-download').map((w) => [w.args.id, !!w.args.confirm]), [['bbbbbbbb-2', false], ['bbbbbbbb-2', true]]);
        assert.equal(k.klipy[0].plik, null);
        assert.equal(k.wybrana.wersja, 2);
        await fs.access(path.join(tmp, 'muzyka', k.wybrana.plik));
        assert.deepEqual(await fs.readdir(path.join(tmp, 'muzyka', 'Suno MCP')), ['Velvet Booth for Two [bbbbbbbb].mp3']);
        assert.equal(decyzje[0].werdykt, 'przyjmij');
        assert.ok(wiesci.some((w) => /Nic nie pobrano — wybierz jedną/.test(w)) && wiesci.some((w) => /wersja 2 pobrana/.test(w)));
        assert.equal((await post(`/api/jason/kampanie/${id}/odrzuc`)).status, 400, 'rozstrzygnięta — druga decyzja odpada');
        assert.deepEqual((await (await fetch(`${baza}/api/jason/glosy`)).json()).glosy.map((g) => g.name), ['Bella', 'KAEL (S.M.T.)', 'ELARA (S.M.T)']);
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});

test('uczciwie: workspace odmówił, FLUX padł, ↻ bez nowego utworu, rate_limited, ✕ bez pobierania, zły głos = stop przed kredytami', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-'));
    const suno = atrapaSuno(tmp, { workspace: false, limitowane: 2 });
    let flux = 0;
    const J = utworzJasona({ katalog: tmp, suno, przerwaPobraniaMs: 5, okladka: async () => { if (++flux === 1) throw new Error('ComfyUI śpi'); const p = path.join(tmp, 'f.png'); await fs.writeFile(p, 'png'); return p; } });
    try {
        const { id } = await J.wykonaj({});
        await J._czekaj(id);
        let k = await J.kampania(id);
        assert.equal(k.stan, 'do_akceptacji', k.blad);
        assert.equal(k.workspace, null);
        assert.match(k.uwagi.join(' '), /Workspace/);
        assert.equal(k.glos, null, 'duet: bez persony');
        assert.equal(ile(suno, 'voices-list'), 0);
        assert.equal(k.okladka.blad, 'ComfyUI śpi');
        assert.match((await J.zrodloIzby.czekajace())[0].opis, /Bez okładki: ComfyUI śpi/);
        // ↻ sama okładka: żadnego nowego audio-create, workspace ani pobrania
        await J.ponow(id, { okladka: true });
        await J._czekaj(id);
        k = await J.kampania(id);
        assert.equal(k.okladka.plik, 'okladka.png');
        assert.equal(ile(suno, 'audio-create'), 1);
        assert.equal(ile(suno, 'workspaces-create'), 1);
        assert.equal(ile(suno, 'audio-download'), 0);
        // rate_limited ×2 → przerwa i ponowienie; pobrana jedna wersja
        k = await J.rozstrzygnij(id, 'przyjmij', { wersja: 1 });
        assert.equal(k.wybrana.wersja, 1);
        assert.equal(ile(suno, 'audio-download'), 3);
        // ✕ innej kampanii: nic nie pobrane
        const b = await J.wykonaj({ nowa: true, okladka: false });
        await J._czekaj(b.id);
        const przed = ile(suno, 'audio-download');
        const kb = await J.rozstrzygnij(b.id, 'odrzuc', { powod: 'za wolno' });
        assert.equal(kb.stan, 'odrzucona');
        assert.equal(ile(suno, 'audio-download'), przed);
        // głos wskazany wprost, którego nie ma → błąd PRZED audio-create
        const c = await J.wykonaj({ nowa: true, glos: 'Orion', okladka: false });
        await J._czekaj(c.id);
        const kc = await J.kampania(c.id);
        assert.equal(kc.stan, 'blad');
        assert.match(kc.blad, /nie ma głosu „Orion”/);
        assert.equal(ile(suno, 'audio-create'), 2, 'trzecia kampania nie wydała kredytów');
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('stara kampania sprzed zmiany (stanęła na rate_limited przy auto-pobraniu): ↻ wystawia ją do odsłuchu bez pobierania', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-'));
    const suno = atrapaSuno(tmp);
    const J = utworzJasona({ katalog: tmp, suno });
    try {
        const kat = path.join(tmp, 'jason', 'kampanie'); await fs.mkdir(kat, { recursive: true });
        const stara = { id: 'j-c1ea8c0a', ...oczyscZlecenie({ okladka: false }), kredytPobrania: true, stan: 'blad', blad: 'Utwór jest w Suno, ale nie dał się pobrać', uwagi: [], utworzono: '2026-11-12T06:36:26.545Z',
            workspace: { id: 'ws-1', nazwa: ALBUM, nowy: true }, etapy: { utwor: { stan: 'gotowe' }, czekanie: { stan: 'gotowe' }, pobranie: { stan: 'robi' } },
            klipy: ['aaaaaaaa-1', 'bbbbbbbb-2'].map((id) => ({ id, status: 'complete', plik: null, kredytPobrania: true, bladPobrania: '{"code":"rate_limited"}' })) };
        await fs.writeFile(path.join(kat, 'j-c1ea8c0a.json'), JSON.stringify(stara));
        await J.ponow('j-c1ea8c0a');
        await J._czekaj('j-c1ea8c0a');
        const k = await J.kampania('j-c1ea8c0a');
        assert.equal(k.stan, 'do_akceptacji', k.blad);
        assert.equal(k.etapy.pobranie, undefined);
        assert.equal(ile(suno, 'audio-create'), 0);
        assert.equal(ile(suno, 'audio-download'), 0);
        assert.ok(k.klipy.every((c) => c.odsluch && !c.bladPobrania && !c.plik));
        assert.deepEqual((await J.zrodloIzby.czekajace())[0].akcje.map((a) => a.id), ['pobierz-1', 'pobierz-2', 'odrzuc']);
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('🚀 paczka Spotify: master.wav 44,1/16/stereo, okładka 3000×3000, czysty tekst, metadane (prawdziwy ffmpeg, trasy HTTP)', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-sp-'));
    const uruchom = promisify(execFile);
    const muzyka = path.join(tmp, 'muzyka');
    const suno = atrapaSuno(tmp);
    // prawdziwe pliki: mp3 zamiast atrapy „mp3”, okładka PNG 64×48 (niekwadratowa → przycięcie)
    suno.zapiszUtwory = async (_w, gotowe) => Promise.all(gotowe.map(async (u) => {
        const plik = `Suno MCP/${u.tytul} [${u.id.slice(0, 8)}].mp3`;
        await fs.mkdir(path.join(muzyka, 'Suno MCP'), { recursive: true });
        await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2:sample_rate=48000', '-ac', '1', path.join(muzyka, plik)]);
        return { ...u, plik, nowy: true };
    }));
    const otwarte = [];
    const J = utworzJasona({ katalog: tmp, suno, przerwaPobraniaMs: 5, katalogMuzyki: muzyka, ffmpeg: ffmpegPath, uruchom, autor: async () => 'Mistrz Testowy', otworz: async (p) => otwarte.push(p),
        okladka: async () => { const p = path.join(tmp, 'flux.png'); await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x48', '-frames:v', '1', p]); return p; } });
    const app = express(); app.use(express.json());
    zamontujTrasyJasona(app, J);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    const post = (s, b) => fetch(baza + s, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b ?? {}) }).then((r) => r.json());
    try {
        const { id } = await J.wykonaj({});
        await J._czekaj(id);
        assert.equal((await post(`/api/jason/kampanie/${id}/przygotuj-spotify`)).success, false, 'przed pobraniem — odmowa');
        await J.rozstrzygnij(id, 'pobierz-1', {});
        // Izba: przyjęta bez paczki czeka z przyciskiem Spotify
        assert.deepEqual((await J.zrodloIzby.czekajace())[0].akcje.map((a) => [a.id, a.zdalnie]), [['spotify', true], ['okladka', false], ['bez-spotify', true]]);
        const przed = ile(suno, 'audio-download');
        const d = await post(`/api/jason/kampanie/${id}/przygotuj-spotify`);
        assert.equal(d.success, true, d.message);
        const sp = d.kampania.spotify;
        assert.equal(sp.folder, 'Spotify_Releases/Zero Gravity Heart (0.00G Sessions)/01_Velvet Booth for Two (82 BPM Intro)');
        assert.deepEqual(sp.pliki, ['original.mp3', 'master.wav', 'cover_3000x3000.jpg', 'lyrics_clean.txt', 'spotify_metadata.json']);
        const kat = path.join(muzyka, ...sp.folder.split('/'));
        assert.deepEqual(naglowekWav(await fs.readFile(path.join(kat, 'master.wav'))), { pcm: true, kanaly: 2, hz: 44100, bity: 16 });
        assert.deepEqual(wymiaryJpeg(await fs.readFile(path.join(kat, 'cover_3000x3000.jpg'))), { wys: 3000, szer: 3000 });
        // bez `cfg.pobierz` → master z MP3, powiedziane wprost; Suno o WAV niepytane
        assert.equal(sp.master.zrodlo, 'mp3');
        assert.match(sp.uwagi.join(' '), /powstał z pobranego MP3/);
        assert.equal(ile(suno, 'audio-download'), przed);
        const tekstCzysty = await fs.readFile(path.join(kat, 'lyrics_clean.txt'), 'utf8');
        assert.doesNotMatch(tekstCzysty, /[\[\]]|\(Kael:\)|\(Elara:\)/);
        assert.match(tekstCzysty, /^Neon hums in amber light/);
        assert.match(tekstCzysty, /Stay right here\.\.\. Nothing left to fear\.\.\. Zero gravity heart\.\.\.\n$/);
        const meta = JSON.parse(await fs.readFile(path.join(kat, 'spotify_metadata.json'), 'utf8'));
        assert.equal(meta.primary_artists_text, 'Elara, Kael');
        assert.equal(meta.album, ALBUM); assert.equal(meta.genre, 'R&B/Soul'); assert.equal(meta.language, 'EN'); assert.equal(meta.bpm, 82);
        assert.deepEqual(meta.credits, { songwriter: 'Mistrz Testowy', producer: 'TeO Music Studio', label: 'TeO Music Studio' });
        assert.ok(Math.abs(meta.duration_seconds - 2) < 0.3);
        // po paczce znika z Izby; folder otwiera maszyna; dystrybutor tylko https
        assert.equal((await J.zrodloIzby.czekajace()).length, 0);
        assert.equal((await post(`/api/jason/kampanie/${id}/otworz-folder`)).success, true);
        assert.deepEqual(otwarte, [kat]);
        const put = (b) => fetch(`${baza}/api/jason/ustawienia`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
        // domyślnie DistroKid (formularz nowego wydania), dopóki Suweren nie wpisze innego
        assert.deepEqual((await fetch(`${baza}/api/jason/ustawienia`).then((r) => r.json())).ustawienia, { dystrybutor: 'https://distrokid.com/new/', domyslny: true });
        // 📋 czysty tekst do schowka = plik z paczki
        const t = await fetch(`${baza}/api/jason/kampanie/${id}/tekst`).then((r) => r.json());
        assert.equal(t.tytul, 'Velvet Booth for Two (82 BPM Intro)');
        assert.equal(`${t.tekst}\n`, tekstCzysty);
        assert.equal((await put({ dystrybutor: 'javascript:alert(1)' })).success, false);
        assert.deepEqual((await put({ dystrybutor: 'https://dystrybutor.example/panel' })).ustawienia, { dystrybutor: 'https://dystrybutor.example/panel', domyslny: false });
        assert.equal((await put({ dystrybutor: '' })).ustawienia.dystrybutor, 'https://distrokid.com/new/', 'pusty adres = powrót do DistroKid');
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});

test('🚀 paczka Spotify: bezstratny WAV z Suno, gdy nie kosztuje; `requires_credit` = NIE potwierdzamy, master z MP3', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-wav-'));
    const uruchom = promisify(execFile);
    const muzyka = path.join(tmp, 'muzyka');
    const wav = path.join(tmp, 'suno.wav');
    await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1:sample_rate=48000', '-c:a', 'pcm_s24le', wav]);
    for (const platny of [false, true]) {
        const suno = atrapaSuno(tmp);
        const stare = suno.wywolaj.bind(suno);
        suno.wywolaj = async (nazwa, args, opcje) => {
            if (nazwa === 'audio-download' && args.format === 'wav') { suno.wywolania.push({ nazwa, args, opcje }); return { wynik: tekst(platny ? { status: 'requires_credit' } : { status: 'ok', url: 'https://cdn.example/x.wav' }), utwory: [] }; }
            return stare(nazwa, args, opcje);
        };
        suno.zapiszUtwory = async (_w, gotowe) => Promise.all(gotowe.map(async (u) => {
            const plik = `Suno MCP/x [${u.id.slice(0, 8)}].mp3`;
            await fs.mkdir(path.join(muzyka, 'Suno MCP'), { recursive: true });
            await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', path.join(muzyka, plik)]);
            return { ...u, plik, nowy: true };
        }));
        let pobran = 0;
        const J = utworzJasona({ katalog: path.join(tmp, platny ? 'b' : 'a'), suno, przerwaPobraniaMs: 5, katalogMuzyki: muzyka, ffmpeg: ffmpegPath, uruchom, pobierz: async () => { pobran++; return fs.readFile(wav); } });
        const { id } = await J.wykonaj({ okladka: false });
        await J._czekaj(id);
        await J.rozstrzygnij(id, 'pobierz-1', {});
        const k = await J.przygotujSpotify(id);
        assert.equal(k.spotify.master.zrodlo, platny ? 'mp3' : 'wav-suno');
        assert.equal(pobran, platny ? 0 : 1);
        assert.ok(suno.wywolania.filter((w) => w.nazwa === 'audio-download' && w.args.format === 'wav').every((w) => !w.args.confirm), 'WAV nigdy z confirm');
        assert.equal(k.spotify.master.hz, 44100); assert.equal(k.spotify.master.bity, 16);
        assert.match(k.spotify.uwagi.join(' '), /Bez okładki/);
    }
    await fs.rm(tmp, { recursive: true, force: true });
});

test('czyste: tekst bez tagów, folder wydania', () => {
    assert.equal(czystyTekst('[Verse 1 - Kael: deep]\nLine one [ad-lib]\n\n[Chorus]\n(Elara:) Two (ooh)'), 'Line one\n\nTwo (ooh)');
    assert.equal(folderWydania({ album: 'A: B?', stacja: { nr: 3, tytul: 'T/x.' } }), 'Spotify_Releases/A B/03_T x');
});

test('🎨 przerysowanie okładki przyjętej kampanii: nowy prompt, stara zostaje do udanej zamiany, paczka Spotify dostaje nowy cover', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-okl-'));
    const uruchom = promisify(execFile);
    const muzyka = path.join(tmp, 'muzyka');
    const suno = atrapaSuno(tmp);
    suno.zapiszUtwory = async (_w, gotowe) => Promise.all(gotowe.map(async (u) => {
        const plik = `Suno MCP/x [${u.id.slice(0, 8)}].mp3`;
        await fs.mkdir(path.join(muzyka, 'Suno MCP'), { recursive: true });
        await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', path.join(muzyka, plik)]);
        return { ...u, plik, nowy: true };
    }));
    const prompty = []; let pada = false;
    const J = utworzJasona({ katalog: tmp, suno, przerwaPobraniaMs: 5, katalogMuzyki: muzyka, ffmpeg: ffmpegPath, uruchom,
        okladka: async ({ prompt }) => {
            prompty.push(prompt);
            if (pada) throw new Error('ComfyUI śpi');
            const p = path.join(tmp, `flux-${prompty.length}.png`);
            await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${prompty.length === 1 ? 'red' : 'blue'}:s=64x64`, '-frames:v', '1', p]);
            return p;
        } });
    const app = express(); app.use(express.json());
    zamontujTrasyJasona(app, J);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    const post = (s, b) => fetch(baza + s, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b ?? {}) }).then((r) => r.json());
    try {
        // kampania ze STARYM promptem (jak prawdziwa Stacja 1 sprzed zmiany)
        const { id } = await J.wykonaj({ okladka: { prompt: 'StarLight Diner at night, neon sign' } });
        await J._czekaj(id);
        await J.rozstrzygnij(id, 'pobierz-1', {});
        await J.przygotujSpotify(id);
        const kat = J.sciezkaWydania(await J.kampania(id));
        const coverPrzed = await fs.readFile(path.join(kat, 'cover_3000x3000.jpg'));
        const tworzenPrzed = ile(suno, 'audio-create'), pobranPrzed = ile(suno, 'audio-download');

        const d = await post(`/api/jason/kampanie/${id}/przerysuj-okladke`);
        assert.equal(d.success, true, d.message);
        assert.equal(d.kampania.okladka.rysuje, true);
        assert.equal((await post(`/api/jason/kampanie/${id}/przerysuj-okladke`)).success, false, 'druga prośba w trakcie — odmowa');
        await J._czekajOkladki(id);
        const k = await J.kampania(id);
        assert.equal(k.stan, 'przyjeta');
        assert.equal(k.okladka.rysuje, undefined);
        assert.equal(k.okladka.wersja, 2);
        assert.match(prompty[1], /inside a late-night retro diner/, 'przerysowanie bierze NOWY prompt, nie stary z kampanii');
        assert.doesNotMatch(prompty[1], /StarLight/);
        const coverPo = await fs.readFile(path.join(kat, 'cover_3000x3000.jpg'));
        assert.deepEqual(wymiaryJpeg(coverPo), { wys: 3000, szer: 3000 });
        assert.notDeepEqual(coverPo, coverPrzed, 'paczka dostała nową okładkę');
        assert.ok(k.spotify.okladkaZmieniona);
        await fs.access(path.join(tmp, 'jason', 'kampanie', id, 'okladka-poprzednia.png'));
        assert.equal(ile(suno, 'audio-create'), tworzenPrzed); assert.equal(ile(suno, 'audio-download'), pobranPrzed);

        // FLUX padł → poprzednia okładka i cover zostają, powód wprost
        pada = true;
        await J.przerysujOkladke(id, { prompt: 'własny opis bez napisów' });
        await J._czekajOkladki(id);
        const k2 = await J.kampania(id);
        assert.equal(k2.okladka.blad, 'ComfyUI śpi');
        assert.equal(k2.okladka.wersja, 2);
        assert.equal(prompty[2], 'własny opis bez napisów');
        assert.deepEqual(await fs.readFile(path.join(kat, 'cover_3000x3000.jpg')), coverPo);
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});

test('🎤 Stacja 2: „Closer Than Gravity (Elara Solo)” z personą ELARA (S.M.T) — głos stacji wskazany wprost; brak głosu = stop przed kredytami', async () => {
    const z = oczyscZlecenie({ stacja: 2 });
    assert.equal(z.stacja.tytul, 'Closer Than Gravity (Elara Solo)');
    assert.equal(z.album, ALBUM);
    assert.deepEqual(z.artysci, ['Elara']);
    assert.deepEqual(z.glos, { zadany: 'ELARA (S.M.T)', auto: false });
    assert.equal(oczyscZlecenie({ stacja: 2, glos: 'Kael' }).glos.zadany, 'Kael');
    assert.equal(oczyscZlecenie({ stacja: 2, glos: 'brak' }).glos, null);
    assert.equal(oczyscZlecenie({ stacja: 1 }).glos, null, 'Stacja 1 (duet) dalej bez persony');
    const a = argumentyUtworu({ id: 'j-00000002', ...z, glos: { id: 'v-elara' } });
    assert.match(a.style, /^sensual neo-soul, atmospheric dream-pop, 82 bpm, silky breathy female vocal/);
    assert.match(a.lyrics, /^\[Intro - Soft Rhodes chords/);
    assert.match(a.lyrics, /Pull me closer than gravity can hold/);
    assert.match(a.lyrics, /Zero point zero G\.\.\.$/);
    assert.equal(a.voice_id, 'v-elara'); assert.equal(a.description, undefined);
    assert.match(czystyTekst(STACJE[2].lyrics), /^Raindrops tracing silver lines upon the glass/);
    assert.doesNotMatch(czystyTekst(STACJE[2].lyrics), /[\[\]]/);

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-s2-'));
    try {
        const suno = atrapaSuno(tmp);
        const J = utworzJasona({ katalog: tmp, suno, przerwaPobraniaMs: 5 });
        const { id } = await J.wykonaj({ stacja: 2, okladka: false });
        await J._czekaj(id);
        const k = await J.kampania(id);
        assert.equal(k.stan, 'do_akceptacji');
        assert.deepEqual({ id: k.glos.id, nazwa: k.glos.nazwa }, { id: 'v-elara', nazwa: 'ELARA (S.M.T)' });
        assert.equal(suno.wywolania.find((w) => w.nazwa === 'audio-create').args.voice_id, 'v-elara');
        // Stacja 1 w toku nie blokuje Stacji 2 i odwrotnie (inna stacja = inna kampania)
        assert.equal((await J.wykonaj({ stacja: 1, okladka: false })).stacja.nr, 1);

        // konto bez głosu Elary → stop PRZED audio-create
        const bez = atrapaSuno(tmp);
        const stare = bez.wywolaj.bind(bez);
        bez.wywolaj = async (n, a2, o) => (n === 'voices-list' ? { wynik: tekst({ voices: [{ id: 'v-bella', name: 'Bella' }] }), utwory: [] } : stare(n, a2, o));
        const J2 = utworzJasona({ katalog: path.join(tmp, 'b'), suno: bez });
        const r = await J2.wykonaj({ stacja: 2, okladka: false });
        await J2._czekaj(r.id);
        const k2 = await J2.kampania(r.id);
        assert.equal(k2.stan, 'blad');
        assert.match(k2.blad, /nie ma głosu „ELARA \(S\.M\.T\)”/);
        assert.equal(ile(bez, 'audio-create'), 0);
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('🎤 album: stacje 3–5 w sztafecie głosów Kael ↔ Elara (tytuły, style, teksty, persony wprost)', () => {
    const oczekiwane = [[3, 'Amber Light on Your Skin (Kael Solo)', 84, ['Kael'], 'KAEL (S.M.T.)'], [4, 'Midnight Espresso (11:11) (Elara Solo)', 80, ['Elara'], 'ELARA (S.M.T)'], [5, 'Stay Until Dawn (0.00G Outro)', 76, ['Kael', 'Elara'], 'KAEL (S.M.T.)']];
    for (const [nr, tytul, bpm, artysci, glos] of oczekiwane) {
        const z = oczyscZlecenie({ stacja: nr });
        assert.equal(z.stacja.tytul, tytul); assert.equal(z.stacja.bpm, bpm); assert.equal(z.album, ALBUM);
        assert.deepEqual(z.artysci, artysci);
        assert.deepEqual(z.glos, { zadany: glos, auto: false });
        assert.match(z.stacja.styl, new RegExp(`${bpm} bpm`));
        assert.match(z.stacja.lyrics, /^\[Intro - /);
        assert.equal(dopasujGlos(GLOSY, glos).id, nr === 4 ? 'v-elara' : 'v-kael');
        assert.doesNotMatch(czystyTekst(z.stacja.lyrics), /[\[\]]/);
    }
    assert.match(STACJE[3].lyrics, /We don't need the noise outside the velvet door/);
    assert.match(STACJE[3].lyrics, /Stay right here\.\.\. zero point zero G\.\.\.$/);
    assert.match(STACJE[4].lyrics, /Taste of midnight espresso on your lips/);
    assert.match(STACJE[5].lyrics, /At StarLight Diner\.\.\. 0\.00G\.\.\.$/);
    assert.deepEqual(Object.keys(STACJE), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
});

test('➕ nowa stacja z interfejsu: zapis na dysku, numer z kodu, kampania z niej, bez dubli; wbudowanej nie da się usunąć (trasy HTTP)', async () => {
    assert.equal(artystaZGlosu('KAEL (S.M.T.)'), 'Kael');
    assert.equal(artystaZGlosu('ELARA (S.M.T)'), 'Elara');
    assert.deepEqual(oczyscStacje({ tytul: 'X', glos: 'KAEL (S.M.T.)', styl: 'soul, 92 BPM', tekst: 'la la' }), { tytul: 'X', bpm: 92, artysci: ['Kael'], glos: 'KAEL (S.M.T.)', gatunek: null, jezyk: null, styl: 'soul, 92 BPM', lyrics: 'la la' });
    assert.throws(() => oczyscStacje({ tytul: 'X', artysci: 'A' }), /tekstu utworu/);
    assert.throws(() => oczyscStacje({ tytul: 'X', tekst: 'la' }), /artystę albo wybierz personę/);
    assert.throws(() => oczyscStacje({ tekst: 'la', artysci: 'A' }), /tytułu/);

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-st-'));
    const suno = atrapaSuno(tmp);
    const J = utworzJasona({ katalog: tmp, suno, przerwaPobraniaMs: 5 });
    const app = express(); app.use(express.json());
    zamontujTrasyJasona(app, J);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    const zadaj = (m, s, b) => fetch(baza + s, { method: m, headers: { 'Content-Type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }).then((r) => r.json());
    try {
        const d = await zadaj('POST', '/api/jason/stacje', { tytul: 'Paper Moon Refill', glos: 'ELARA (S.M.T)', styl: 'neo-soul, 78 bpm', tekst: '[Verse 1]\nOne more cup before the dawn' });
        assert.equal(d.success, true, d.message);
        assert.equal(d.stacja.nr, 11); assert.equal(d.stacja.wlasna, true); assert.deepEqual(d.stacja.artysci, ['Elara']); assert.equal(d.stacja.bpm, 78);
        assert.equal(JSON.parse(await fs.readFile(path.join(tmp, 'jason', 'stacje.json'), 'utf8')).stacje[0].tytul, 'Paper Moon Refill');
        assert.equal((await zadaj('POST', '/api/jason/stacje', { tytul: 'paper moon refill', artysci: 'Kael', tekst: 'x' })).success, false, 'dubel tytułu');
        assert.equal((await zadaj('POST', '/api/jason/stacje', { tytul: 'Closer Than Gravity (Elara Solo)', artysci: 'Elara', tekst: 'x' })).success, false, 'dubel wbudowanej');
        const lista = (await zadaj('GET', '/api/jason/kampanie')).stacje;
        assert.deepEqual(lista.map((x) => [x.nr, x.wlasna]), [...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, false]), [11, true]]);
        assert.equal(lista[10].glos, 'ELARA (S.M.T)');

        // kampania z własnej stacji: jej tekst, styl i persona
        const r = await zadaj('POST', '/api/jason/wykonaj-kampanie', { stacja: 11, okladka: false });
        assert.equal(r.success, true, r.message);
        await J._czekaj(r.kampania.id);
        const k = await J.kampania(r.kampania.id);
        assert.equal(k.stan, 'do_akceptacji'); assert.equal(k.stacja.nr, 11); assert.equal(k.stacja.tytul, 'Paper Moon Refill');
        const a = suno.wywolania.find((w) => w.nazwa === 'audio-create').args;
        assert.equal(a.voice_id, 'v-elara'); assert.equal(a.style, 'neo-soul, 78 bpm'); assert.match(a.lyrics, /One more cup before the dawn/);

        assert.equal((await zadaj('DELETE', '/api/jason/stacje/2')).success, false, 'wbudowana zostaje');
        assert.deepEqual((await zadaj('DELETE', '/api/jason/stacje/11')).stacje.map((x) => x.nr), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        assert.equal((await zadaj('POST', '/api/jason/wykonaj-kampanie', { stacja: 11, okladka: false })).success, false, 'usuniętej stacji nie da się zlecić');
        // własna stacja zapisana, gdy album miał 5 utworów (nr 6) — po rozbudowie albumu w kodzie dostaje pierwszy wolny numer
        await fs.writeFile(path.join(tmp, 'jason', 'stacje.json'), JSON.stringify({ stacje: [{ nr: 6, tytul: 'Stara Szóstka', artysci: ['Kael'], lyrics: 'la' }] }));
        const po = (await zadaj('GET', '/api/jason/stacje')).stacje;
        assert.equal(po.find((x) => x.nr === 6).tytul, 'Velvet Static (Elara Solo)');
        assert.deepEqual(po.filter((x) => x.wlasna).map((x) => [x.nr, x.tytul, x.nrPoprzedni]), [[11, 'Stara Szóstka', 6]]);
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});

test('💿 pełne LP: stacje 6–10 w dalszej sztafecie Elara ↔ Kael (tytuły, BPM, style, teksty, persony wprost)', async () => {
    const oczekiwane = [
        [6, 'Velvet Static (Elara Solo)', 83, ['Elara'], 'ELARA (S.M.T)', /Wrapped in velvet static, floating next to you/, /Zero point zero G\.\.\.$/],
        [7, 'Neon Rain on Chrome (Kael Solo)', 85, ['Kael'], 'KAEL (S.M.T.)', /Every quiet second shouldn't be missed/, /Stay with me\.\.\.$/],
        [8, 'Two Shadows One Flame (Elara Solo)', 78, ['Elara'], 'ELARA (S.M.T)', /Two shadows, one flame, burning soft and slow/, /Zero gravity heart\.\.\.$/],
        [9, 'Last Call in Zero-G (Kael Solo)', 82, ['Kael'], 'KAEL (S.M.T.)', /Last call in the middle of zero-G/, /Just you and me\.\.\.$/],
        [10, 'Infinite Horizon (0.00G Finale)', 75, ['Elara', 'Kael'], 'ELARA (S.M.T)', /Into the infinite horizon, wide and free/, /We are\.\.\. what we are\.\.\.$/],
    ];
    for (const [nr, tytul, bpm, artysci, glos, wers, koniec] of oczekiwane) {
        const z = oczyscZlecenie({ stacja: nr });
        assert.equal(z.stacja.nr, nr); assert.equal(z.stacja.tytul, tytul); assert.equal(z.stacja.bpm, bpm); assert.equal(z.album, ALBUM);
        assert.equal(z.stacja.gatunek, 'R&B/Soul'); assert.equal(z.stacja.jezyk, 'EN');
        assert.deepEqual(z.artysci, artysci);
        assert.deepEqual(z.glos, { zadany: glos, auto: false });
        assert.match(z.stacja.styl, new RegExp(`\\b${bpm} bpm\\b`));
        assert.match(z.stacja.lyrics, /^\[Intro - /); assert.match(z.stacja.lyrics, wers); assert.match(z.stacja.lyrics, koniec);
        assert.ok(z.stacja.lyrics.length < 4900, 'tekst mieści się w limicie Suno');
        const a = argumentyUtworu({ id: 'j-0000000a', ...z, glos: dopasujGlos(GLOSY, glos) });
        assert.equal(a.voice_id, glos.startsWith('ELARA') ? 'v-elara' : 'v-kael'); assert.equal(a.title, tytul); assert.equal(a.description, undefined);
        assert.doesNotMatch(czystyTekst(z.stacja.lyrics), /[\[\]]/);
    }
    // tytuły albumu się nie powtarzają; kampania Stacji 10 idzie głosem Elary
    assert.equal(new Set(Object.values(STACJE).map((x) => x.tytul)).size, 10);
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-lp-'));
    try {
        const suno = atrapaSuno(tmp);
        const J = utworzJasona({ katalog: tmp, suno, przerwaPobraniaMs: 5 });
        const { id } = await J.wykonaj({ stacja: 10, okladka: false });
        await J._czekaj(id);
        const k = await J.kampania(id);
        assert.equal(k.stan, 'do_akceptacji'); assert.equal(k.glos.nazwa, 'ELARA (S.M.T)');
        assert.equal(suno.wywolania.find((w) => w.nazwa === 'audio-create').args.voice_id, 'v-elara');
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('🎬 storyboard 0.00G: 5 scen z tekstu każdej z 10 stacji, czasy w taktach, prompty 16:9 i 9:16 bez napisów', () => {
    for (const st of Object.values(STACJE)) {
        const sb = zbudujStoryboard({ album: ALBUM, stacja: st, artysci: st.artysci, glos: st.glos ? { nazwa: st.glos } : null }, { sekundy: 200 });
        assert.deepEqual(sb.sceny.map((x) => x.sekcja), ['Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Outro'], st.tytul);
        assert.equal(sb.firstFrame, 'cover_3000x3000.jpg'); assert.equal(sb.audio.master, 'master.wav'); assert.equal(sb.bpm, st.bpm);
        assert.equal(sb.sceny[0].od, 0); assert.equal(sb.sceny[4].do, 200);
        const takt = 240 / st.bpm;
        sb.sceny.forEach((sc, i) => {
            assert.ok(sc.do > sc.od && sc.sekundy > 5, `${st.tytul} scena ${sc.nr}`);
            if (i) assert.equal(sc.od, sb.sceny[i - 1].do);
            if (i) assert.ok(Math.abs(sc.od / takt - Math.round(sc.od / takt)) < 0.06, `granica sceny ${sc.nr} na takcie`);
            assert.match(sc.prompt169, /^Cinematic music video shot, 16:9 widescreen\./);
            assert.match(sc.prompt916, /^Vertical 9:16 video, seamless 8-second loop/);
            for (const p of [sc.prompt169, sc.prompt916, sc.promptKadru]) {
                assert.ok(p.includes(KLIMAT_TELEDYSKU)); assert.match(p, /no text, no letters, no captions, no subtitles/);
                assert.match(p, /red velvet booth/); assert.match(p, /float weightless/); assert.match(p, /\bElara\b/); assert.match(p, /\bKael\b/);
            }
        });
        assert.ok(sb.sceny[1].wersy.length && sb.sceny[2].wersy.length, 'zwrotka i refren niosą wersy');
    }
    // dopasowanie do tekstu: Stacja 8 = świeca i cienie, Stacja 7 = deszcz, Stacja 10 kończy świtem… a Stacja 1 śpiewają na zmianę
    const sb = (nr) => { const st = STACJE[nr]; return zbudujStoryboard({ album: ALBUM, stacja: st, artysci: st.artysci, glos: st.glos ? { nazwa: st.glos } : null }, { sekundy: 194 }); };
    assert.match(sb(8).sceny[1].obraz, /candle flame/); assert.match(sb(8).sceny[1].obraz, /shadows on the wall/);
    assert.match(sb(7).sceny[1].obraz, /Raindrops crawling down the window/);
    assert.match(sb(10).sceny[1].obraz, /light of dawn/);
    const s1 = sb(1);
    assert.deepEqual(s1.sceny.map((x) => x.kto), [['Elara', 'Kael'], ['Kael'], ['Elara', 'Kael'], ['Elara'], ['Elara', 'Kael']]);
    assert.match(s1.sceny[1].prompt169, /Focus on Kael/); assert.match(s1.sceny[3].prompt169, /Focus on Elara/);
    assert.doesNotMatch(s1.sceny[4].wersy.join(' '), /\(Kael:\)/);
    // Stacja 5 nie ma drugiej zwrotki → czwarta scena wraca do refrenu, ale z własnym obrazem
    const s5 = sb(5);
    assert.equal(s5.sceny[3].zrodlo, 'Chorus'); assert.notEqual(s5.sceny[3].obraz, s5.sceny[2].obraz);
    // czyste funkcje
    const sek = sekcjeTekstu('[Intro - Rhodes at 82 BPM]\n[Verse 1 - Kael: deep baritone]\nLine A\n[Bridge - guitar solo]\n[Outro]\n(Kael:) Stay');
    assert.deepEqual(sek.map((x) => [x.rodzaj, x.kto, x.wersy.length]), [['intro', '', 0], ['verse', 'Kael', 1], ['bridge', '', 0], ['outro', '', 1]]);
    assert.deepEqual(przydzialScen(sek), [0, 1, -1, 2, 3]);
    assert.deepEqual(czasyScen(100, 0).map((x) => x.od), [0, 10, 36, 58, 82]);
    assert.deepEqual(motywyZWersow(['Steam is rising from a porcelain cup', 'silver rain']).length, 2);
    assert.deepEqual(motywyZWersow(['la la la']), []);
});

test('🎬 most Jason → TeO Story: storyboard w paczce, projekt raz, klatki FLUX z okładką jako wzorem, Straż (trasy HTTP)', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-tv-'));
    const uruchom = promisify(execFile);
    const muzyka = path.join(tmp, 'muzyka');
    const suno = atrapaSuno(tmp);
    suno.zapiszUtwory = async (_w, gotowe) => Promise.all(gotowe.map(async (u) => {
        const plik = `Suno MCP/x [${u.id.slice(0, 8)}].mp3`;
        await fs.mkdir(path.join(muzyka, 'Suno MCP'), { recursive: true });
        await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=24', path.join(muzyka, plik)]);
        return { ...u, plik, nowy: true };
    }));
    const png = async (nazwa, kolor = 'red') => { const p = path.join(tmp, nazwa); await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${kolor}:s=64x64`, '-frames:v', '1', p]); return p; };
    const zalozone = [], gotoweKarty = [], rysowane = []; let pada = false;
    const J = utworzJasona({ katalog: tmp, suno, przerwaPobraniaMs: 5, katalogMuzyki: muzyka, ffmpeg: ffmpegPath, uruchom, okladka: () => png('flux.png'),
        kadr: async (o) => { rysowane.push(o); if (pada) throw new Error('ComfyUI śpi'); return png(`kadr-${rysowane.length}.png`, 'blue'); },
        story: { zaloz: async (z) => { zalozone.push(z); return { serial: z.nazwa, odcinekId: 'odc-1', karty: z.sceny.map((_, i) => `kd-${i + 1}`) }; }, kadrGotowy: async (x) => { gotoweKarty.push(x); } } });
    const app = express(); app.use(express.json());
    zamontujTrasyJasona(app, J);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    const zadaj = (m, s, b) => fetch(baza + s, { method: m, headers: { 'Content-Type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }).then((r) => r.json());
    try {
        const { id } = await J.wykonaj({ stacja: 2 });
        await J._czekaj(id);
        await J.rozstrzygnij(id, 'pobierz-1', {});
        assert.equal((await zadaj('POST', `/api/jason/kampanie/${id}/teo-story`)).success, false, 'bez paczki — odmowa');
        await J.przygotujSpotify(id);
        const kat = J.sciezkaWydania(await J.kampania(id));

        const d = await zadaj('POST', `/api/jason/kampanie/${id}/teo-story`);
        assert.equal(d.success, true, d.message);
        assert.equal(d.storyboard.sceny.length, 5); assert.equal(d.storyboard.stacja.tytul, 'Closer Than Gravity (Elara Solo)');
        assert.equal(d.storyboard.sekundy, 24); assert.equal(d.storyboard.bpm, 82);
        assert.deepEqual(JSON.parse(await fs.readFile(path.join(kat, 'storyboard_000g.json'), 'utf8')).sceny.map((x) => x.sekcja), ['Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Outro']);
        assert.ok(d.kampania.spotify.pliki.includes('storyboard_000g.json'));
        assert.equal(d.kampania.teoStory.serial, 'Teledysk — Closer Than Gravity (Elara Solo)');
        assert.equal(d.kampania.teoStory.url, `/apps/story/?serial=${encodeURIComponent('Teledysk — Closer Than Gravity (Elara Solo)')}`);
        // projekt dostał: utwór (master.wav z paczki), okładkę jako firstFrame, czysty tekst, 5 scen z promptami w obu formatach
        const z = zalozone[0];
        assert.equal(z.teledysk.audio, path.join(kat, 'master.wav')); assert.equal(z.teledysk.firstFrame, path.join(kat, 'cover_3000x3000.jpg'));
        assert.equal(z.teledysk.bpm, 82); assert.deepEqual(z.teledysk.artysci, ['Elara']); assert.match(z.teledysk.lyrics, /^Raindrops tracing silver lines/);
        assert.equal(z.sceny.length, 5); assert.match(z.sceny[2].notatki, /16:9 \(YouTube\)[\s\S]*9:16 \(Spotify Canvas, pętla 8 s\)/);
        assert.ok(z.fakty.some((f) => /nie ma żadnych napisów/.test(f)));
        // drugi raz = to samo, bez drugiego projektu; odNowa liczy sceny, projektu nie dubluje
        assert.equal((await zadaj('POST', `/api/jason/kampanie/${id}/teo-story`)).kampania.teoStory.serial, d.kampania.teoStory.serial);
        await zadaj('POST', `/api/jason/kampanie/${id}/teo-story`, { odNowa: true });
        assert.equal(zalozone.length, 1);

        // 🎨 klatka sceny 3 w 16:9: okładka paczki jako wzór, plik w paczce, karta Tablicy dostaje ścieżkę
        const r = await zadaj('POST', `/api/jason/kampanie/${id}/storyboard/kadr`, { scena: 3, format: '16:9' });
        assert.equal(r.storyboard.sceny[2].kadry['16:9'].stan, 'rysuje');
        await J._czekajKolejki();
        let sb = (await zadaj('GET', `/api/jason/kampanie/${id}/storyboard`)).storyboard;
        assert.equal(sb.sceny[2].kadry['16:9'].plik, 'storyboard/scena-3-16x9.png');
        assert.deepEqual([rysowane[0].szer, rysowane[0].wys, rysowane[0].referencje], [1280, 720, [path.join(kat, 'cover_3000x3000.jpg')]]);
        assert.match(rysowane[0].prompt, /^Widescreen 16:9 composition\. Cinematic film still\./);
        assert.deepEqual(gotoweKarty, [{ karta: 'kd-3', plik: path.join(kat, 'storyboard', 'scena-3-16x9.png') }]);
        assert.equal((await fetch(`${baza}/api/jason/kampanie/${id}/storyboard/kadr/scena-3-16x9.png`)).status, 200);
        assert.equal((await fetch(`${baza}/api/jason/kampanie/${id}/storyboard/kadr/..%2Fmaster.wav`)).status, 404);
        // wszystkie w 9:16 → 5 pionowych; FLUX padł → poprzednia klatka zostaje + powód
        await zadaj('POST', `/api/jason/kampanie/${id}/storyboard/kadr`, { scena: 'wszystkie', format: '9:16' });
        await J._czekajKolejki();
        sb = await J.storyboard(id);
        assert.deepEqual(sb.sceny.map((x) => x.kadry['9:16'].plik), [1, 2, 3, 4, 5].map((n) => `storyboard/scena-${n}-9x16.png`));
        assert.deepEqual([rysowane[1].szer, rysowane[1].wys], [720, 1280]);
        pada = true;
        await J.kadrSceny(id, { scena: 3, format: '16:9' });
        await J._czekajKolejki();
        sb = await J.storyboard(id);
        assert.deepEqual(sb.sceny[2].kadry['16:9'], { plik: 'storyboard/scena-3-16x9.png', blad: 'ComfyUI śpi' });
        assert.equal((await zadaj('POST', `/api/jason/kampanie/${id}/storyboard/kadr`, { scena: 9 })).success, false);
        assert.equal((await zadaj('POST', `/api/jason/kampanie/${id}/storyboard/kadr`, { scena: 1, format: '4:3' })).success, false);

        // Straż: telefon może storyboard i projekt, klatek FLUX i pobrań nie
        assert.equal(czyDlaSparowanych(`/api/jason/kampanie/${id}/teo-story`), true);
        assert.equal(czyDlaSparowanych(`/api/jason/kampanie/${id}/storyboard`), true);
        assert.equal(czyDlaSparowanych(`/api/jason/kampanie/${id}/storyboard/kadr`), false);
        assert.equal(czyDlaSparowanych(`/api/jason/kampanie/${id}/pobierz`), false);
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});
