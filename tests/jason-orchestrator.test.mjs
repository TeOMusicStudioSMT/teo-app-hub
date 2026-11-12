// 🎛️ Jason — orkiestrator kampanii: atrapa Suno MCP (te same nazwy narzędzi co prawdziwe), prawdziwy dysk i trasy HTTP.
// Prawdziwe Suno i FLUX w tym teście NIE biorą udziału.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import { utworzJasona, zamontujTrasyJasona, oczyscZlecenie, argumentyUtworu, klipyZWyniku, znajdzWorkspace, stanyKlipow, STACJE } from '../services/JasonOrchestrator.js';

const tekst = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o) }] });

function atrapaSuno(tmp, { workspace = true, plikZCzekania = true, kredyt = false } = {}) {
    const wywolania = [];
    let czekan = 0;
    const zapiszUtwory = async (_w, gotowe) => Promise.all((gotowe ?? []).map(async (u) => {
        const plik = `Suno MCP/${u.tytul} [${u.id.slice(0, 8)}].mp3`;
        await fs.mkdir(path.join(tmp, 'muzyka', 'Suno MCP'), { recursive: true });
        await fs.writeFile(path.join(tmp, 'muzyka', plik), 'mp3');
        return { ...u, plik, nowy: true };
    }));
    return {
        wywolania, zapiszUtwory,
        async wywolaj(nazwa, args) {
            wywolania.push({ nazwa, args });
            if (nazwa === 'workspaces-list') return { wynik: tekst({ workspaces: [{ id: 'ws-inne', name: 'Inny album' }] }), utwory: [] };
            if (nazwa === 'workspaces-create') { if (!workspace) throw new Error('403 forbidden'); return { wynik: tekst({ id: 'ws-1', name: args.name }), utwory: [] }; }
            if (nazwa === 'audio-create') return { wynik: tekst({ clip_ids: ['aaaaaaaa-1', 'bbbbbbbb-2'] }), utwory: [] };
            if (nazwa === 'audio-wait') {
                czekan++;
                if (czekan === 1) return { wynik: tekst({ clips: args.ids.map((id) => ({ id, status: 'streaming' })) }), utwory: [] };
                const utwory = plikZCzekania ? await zapiszUtwory(null, [{ id: args.ids[0], tytul: 'Velvet Booth for Two' }]) : [];
                return { wynik: tekst({ clips: args.ids.map((id) => ({ id, status: 'complete', title: 'Velvet Booth for Two' })) }), utwory };
            }
            if (nazwa === 'audio-download') return { wynik: tekst(kredyt && !args.confirm ? { status: 'requires_credit' } : { status: 'ready', url: `https://cdn.example/${args.id}.mp3` }), utwory: [] };
            throw new Error(`nieznane narzędzie ${nazwa}`);
        },
    };
}

test('czyste: zlecenie, argumenty Suno, klipy, workspace, stany', () => {
    const z = oczyscZlecenie({});
    assert.equal(z.stacja.tytul, STACJE[1].tytul);
    assert.deepEqual(z.artysci, ['Elara', 'Kael']);
    assert.equal(z.album, 'StarLight Diner');
    assert.match(z.okladka.prompt, /StarLight Diner/);
    // tryb prosty: description bez style/lyrics; tryb własny: lyrics + style bez description
    const prosty = argumentyUtworu({ id: 'j-00000000', ...z, workspace: { id: 'ws-1' } });
    assert.ok(prosty.description && !prosty.style && !prosty.lyrics);
    assert.equal(prosty.workspace_id, 'ws-1');
    assert.equal(prosty.idempotency_key, 'j-00000000');
    const wlasny = argumentyUtworu({ id: 'j-1', ...oczyscZlecenie({ stacja: { nr: 2, tytul: 'X', lyrics: '[Verse] la', styl: 'soul, 82 bpm' } }) });
    assert.ok(wlasny.lyrics && wlasny.style && !wlasny.description);
    assert.throws(() => oczyscZlecenie({ stacja: 7 }), /Nie znam stacji/);
    assert.throws(() => oczyscZlecenie({ stacja: { tytul: 'Bez treści' } }), /opisu/);
    assert.deepEqual(klipyZWyniku({ clip_ids: ['a', 'b'], id: 'a' }), ['a', 'b']);
    assert.equal(znajdzWorkspace({ data: { items: [{ id: 'w9', name: ' starlight diner ' }] } }, 'StarLight Diner'), 'w9');
    assert.deepEqual(stanyKlipow({ id: 'a', status: 'complete' }).map((s) => s.status), ['complete']);
});

test('kampania: workspace → audio-create → czekanie → pobranie → okładka → Izba → ✓ (trasy HTTP)', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-'));
    const suno = atrapaSuno(tmp);
    const wiesci = [], decyzje = [];
    const J = utworzJasona({ katalog: tmp, suno, wiesc: (t) => wiesci.push(t), decyzja: (d) => decyzje.push(d),
        okladka: async ({ prompt }) => { assert.match(prompt, /diner/i); const p = path.join(tmp, 'flux.png'); await fs.writeFile(p, 'png'); return p; } });
    const app = express(); app.use(express.json());
    zamontujTrasyJasona(app, J);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    const post = (s, b) => fetch(baza + s, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b ?? {}) });
    try {
        let r = await (await post('/api/jason/wykonaj-kampanie', { stacja: 1 })).json();
        assert.equal(r.success, true);
        const id = r.kampania.id;
        assert.equal(r.kampania.stan, 'robi');
        // druga taka sama w toku → 409, Suno nie dostaje drugiego audio-create
        assert.equal((await post('/api/jason/wykonaj-kampanie', { stacja: 1 })).status, 409);
        await J._czekaj(id);
        const k = (await (await fetch(`${baza}/api/jason/kampanie/${id}`)).json()).kampania;
        assert.equal(k.stan, 'do_akceptacji', k.blad);
        assert.deepEqual(k.workspace, { id: 'ws-1', nazwa: 'StarLight Diner', nowy: true });
        assert.equal(suno.wywolania.filter((w) => w.nazwa === 'audio-create').length, 1);
        assert.equal(suno.wywolania.find((w) => w.nazwa === 'audio-create').args.workspace_id, 'ws-1');
        // pierwsza wersja przyszła z czekania, drugą Jason dociągnął przez audio-download
        assert.equal(k.klipy.length, 2);
        assert.ok(k.klipy.every((c) => c.plik?.startsWith('Suno MCP/')));
        assert.deepEqual(suno.wywolania.filter((w) => w.nazwa === 'audio-download').map((w) => w.args.id), ['bbbbbbbb-2']);
        for (const c of k.klipy) await fs.access(path.join(tmp, 'muzyka', c.plik));
        assert.equal(k.okladka.plik, 'okladka.png');
        assert.equal((await fetch(`${baza}/api/jason/kampanie/${id}/okladka`)).status, 200);
        // Izba zgód widzi pakiet z okładką i zdalnymi decyzjami
        const [poz] = await J.zrodloIzby.czekajace();
        assert.equal(poz.id, id);
        assert.match(poz.tytul, /Velvet Booth for Two/);
        assert.equal(poz.obrazy.length, 1);
        assert.ok(poz.akcje.every((a) => a.zdalnie));
        await J.zrodloIzby.decyduj(id, 'przyjmij', { powod: 'gra' });
        assert.equal((await J.kampania(id)).stan, 'przyjeta');
        assert.equal((await J.zrodloIzby.czekajace()).length, 0);
        assert.equal(decyzje[0].werdykt, 'przyjmij');
        assert.ok(wiesci.some((w) => /czeka na Twoje/.test(w)));
        assert.equal((await post(`/api/jason/kampanie/${id}/odrzuc`)).status, 400, 'rozstrzygnięta — druga decyzja odpada');
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});

test('uczciwie: workspace odmówił → dalej bez; FLUX padł → pakiet bez okładki; ↻ nie tworzy utworu drugi raz; kredyt pobrania', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-'));
    const suno = atrapaSuno(tmp, { workspace: false, plikZCzekania: false, kredyt: true });
    let flux = 0;
    const J = utworzJasona({ katalog: tmp, suno, okladka: async () => { if (++flux === 1) throw new Error('ComfyUI śpi'); const p = path.join(tmp, 'f.png'); await fs.writeFile(p, 'png'); return p; } });
    try {
        const { id } = await J.wykonaj({});
        await J._czekaj(id);
        let k = await J.kampania(id);
        assert.equal(k.stan, 'do_akceptacji', k.blad);
        assert.equal(k.workspace, null);
        assert.match(k.uwagi.join(' '), /Workspace/);
        assert.equal(k.okladka.blad, 'ComfyUI śpi');
        assert.match((await J.zrodloIzby.czekajace())[0].opis, /Bez okładki: ComfyUI śpi/);
        assert.ok(k.klipy.every((c) => c.plik && c.kredytPobrania), 'pobranie poszło z confirm po requires_credit');
        // ↻ sama okładka: żadnego nowego audio-create ani workspace
        await J.ponow(id, { okladka: true });
        await J._czekaj(id);
        k = await J.kampania(id);
        assert.equal(k.okladka.plik, 'okladka.png');
        assert.equal(suno.wywolania.filter((w) => w.nazwa === 'audio-create').length, 1);
        assert.equal(suno.wywolania.filter((w) => w.nazwa === 'workspaces-create').length, 1);
        // kampania z kredytPobrania: false nie potwierdza kredytu → błąd wprost
        const b = await J.wykonaj({ nowa: true, kredytPobrania: false });
        await J._czekaj(b.id);
        const kb = await J.kampania(b.id);
        assert.equal(kb.stan, 'blad');
        assert.match(kb.blad, /kredytu pobrania/);
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});
