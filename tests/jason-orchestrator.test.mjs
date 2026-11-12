// 🎛️ Jason — orkiestrator kampanii: atrapa Suno MCP (te same nazwy narzędzi i kształty co prawdziwe), prawdziwy dysk i trasy HTTP.
// Prawdziwe Suno i FLUX w tym teście NIE biorą udziału.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
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
    assert.match(z.okladka.prompt, /StarLight Diner/);
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
    assert.throws(() => oczyscZlecenie({ stacja: 7 }), /Nie znam stacji/);
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
