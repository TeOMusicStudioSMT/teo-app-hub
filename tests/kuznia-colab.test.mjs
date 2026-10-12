/**
 * 🧪 Kuźnia w Colabie — notatnik jest poprawnym nbformat 4, niesie dane, nie niesie kluczy z Kibla ani ścieżek
 * z dysku; za mało próbek = powód wprost. Kod Pythona z notatnika musi się kompilować (py_compile), gdy jest Python.
 * Czy trening w Colabie działa — tego test nie sprawdzi (nie ma tu A100).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { utworzKuznieColab, oczyscTekst, BAZY } from '../services/KuzniaColab.js';

const KLUCZ_ANTHROPIC = 'sk-ant-api03-TESTOWYklucz1234567890abcdefXYZ';
const KLUCZ_MESHY = 'msy_TESTOWY_klucz_meshy_123456789';
const KLUCZ_DZIWNY = 'zupelnie-niestandardowy-sekret-42';   // bez znanego wzoru — tylko z Kibla

async function srodowisko({ wkladow = 10, poprawekMistrza = 0 } = {}) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kuznia-colab-'));
    const wymiar = path.join(dir, '_OtakOs_Wymiar');
    const kuznia = path.join(wymiar, 'kuznia-soup');
    await fs.mkdir(path.join(kuznia, 'mistrz'), { recursive: true });
    await fs.writeFile(path.join(wymiar, 'kibel_anthropic.txt'), KLUCZ_ANTHROPIC + '\n');
    await fs.writeFile(path.join(wymiar, 'kibel_meshy.txt'), KLUCZ_MESHY);
    await fs.writeFile(path.join(wymiar, 'kibel_inny.txt'), KLUCZ_DZIWNY);
    const sciezkaKatedry = path.join(dir, 'TeO_Genesis', 'services', 'Tajne.js');
    const kroki = Array.from({ length: wkladow }, (_, i) => ({
        agent: 'kodeks', imie: 'Kodeks', stan: 'gotowe', runda: 1, zadanie: `Zadanie ${i}`,
        wklad: `Wkład ${i}: klucz ${KLUCZ_ANTHROPIC}, inny ${KLUCZ_DZIWNY}, plik ${sciezkaKatedry} i F:\\5 stars\\Katalog\\x.txt oraz /home/ja/tajne.txt`,
        szkice: [{ przed: `szkic ${i}`, po: `po pętli ${i}` }],
    }));
    const projekty = async () => [{ nazwa: 'Projekt', wizja: `Wizja z ${KLUCZ_MESHY}`, kroki, oceny: [{ runda: 1, ocena: 8 }] }];
    const jl = (xs) => xs.map((x) => JSON.stringify(x)).join('\n') + '\n';
    if (poprawekMistrza) {
        const sft = Array.from({ length: poprawekMistrza }, (_, i) => ({ messages: [{ role: 'system', content: 's' }, { role: 'user', content: `u${i}` }, { role: 'assistant', content: `Suweren ${i}` }] }));
        await fs.writeFile(path.join(kuznia, 'mistrz', 'sft-suwerena.jsonl'), jl(sft));
        await fs.writeFile(path.join(kuznia, 'mistrz', 'pary-suwerena.jsonl'), jl(sft.map((_, i) => ({ prompt: `p${i}`, chosen: `dobrze ${i}`, rejected: `źle ${i}` }))));
    }
    await fs.mkdir(path.join(kuznia, 'kodeks'), { recursive: true });
    await fs.writeFile(path.join(kuznia, 'kodeks', 'pary-kodeksa.jsonl'), jl([{ prompt: 'Projekt: x', chosen: 'przyjęta', rejected: 'odrzucona' }]));
    const kc = utworzKuznieColab({
        katalogKuzni: kuznia, katalogWymiaru: wymiar, projekty,
        karta: async (id) => ({ imie: id === 'kodeks' ? 'Kodeks' : id, tresc: `Karta ${id}` }),
        sciezki: [dir, os.homedir()], env: {},
    });
    return { dir, kc };
}

const zrodloKomorki = (c) => (Array.isArray(c.source) ? c.source.join('') : c.source);
function daneZNotatnika(nb, zmienna) {
    const kod = nb.cells.filter((c) => c.cell_type === 'code').map(zrodloKomorki).join('\n');
    const m = kod.match(new RegExp(`${zmienna} = \\(\\n([\\s\\S]*?)\\n\\)`));
    assert.ok(m, `brak ${zmienna}`);
    const b64 = [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]).join('');
    if (!b64) return [];
    return zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('notatnik: poprawny nbformat 4 z danymi SFT i DPO', async () => {
    const { kc } = await srodowisko();
    const r = await kc.notatnik({ agent: 'kodeks', baza: 'gemma4-26b-a4b', metoda: 'lora' });
    const nb = JSON.parse(JSON.stringify(r.notatnik));   // przechodzi przez JSON
    assert.equal(nb.nbformat, 4);
    assert.ok(nb.nbformat_minor >= 4);
    assert.equal(nb.metadata.kernelspec.name, 'python3');
    assert.ok(nb.cells.length >= 10);
    const ids = new Set();
    for (const c of nb.cells) {
        assert.ok(['markdown', 'code'].includes(c.cell_type));
        assert.ok(Array.isArray(c.source) && c.source.every((s) => typeof s === 'string'));
        assert.ok(c.id && !ids.has(c.id)); ids.add(c.id);
        if (c.cell_type === 'code') { assert.deepEqual(c.outputs, []); assert.equal(c.execution_count, null); }
    }
    assert.match(zrodloKomorki(nb.cells[0]), /wyjeżdżają z Katedry do Google/);
    const sft = daneZNotatnika(nb, 'SFT_GZ_B64');
    const dpo = daneZNotatnika(nb, 'DPO_GZ_B64');
    assert.equal(sft.length, 10);
    assert.equal(r.sft, 10);
    assert.equal(dpo.length, 11);   // 10 szkiców ze stada + 1 runda Kodeksa
    assert.ok(sft[0].messages.some((m) => m.role === 'assistant' && m.content.startsWith('Wkład 0')));
    assert.ok(dpo.some((p) => p.chosen === 'przyjęta'));
    assert.match(r.nazwa, /\.ipynb$/);
});

test('notatnik: bez kluczy z Kibla i bez ścieżek z dysku', async () => {
    const { dir, kc } = await srodowisko();
    const r = await kc.notatnik({ agent: 'kodeks', baza: 'gemma4-e4b', metoda: 'pelny' });
    const tekst = JSON.stringify(r.notatnik);
    for (const k of [KLUCZ_ANTHROPIC, KLUCZ_MESHY, KLUCZ_DZIWNY]) assert.ok(!tekst.includes(k), `klucz w notatniku: ${k}`);
    const sft = daneZNotatnika(r.notatnik, 'SFT_GZ_B64');
    const wszystko = JSON.stringify(sft) + JSON.stringify(daneZNotatnika(r.notatnik, 'DPO_GZ_B64'));
    for (const k of [KLUCZ_ANTHROPIC, KLUCZ_MESHY, KLUCZ_DZIWNY]) assert.ok(!wszystko.includes(k));
    for (const p of [dir, dir.replace(/\\/g, '/'), os.homedir(), 'F:\\5 stars', '/home/ja', 'TeO_Genesis']) {
        assert.ok(!tekst.includes(p) && !wszystko.includes(p), `ścieżka w notatniku: ${p}`);
    }
    assert.match(wszystko, /\[SEKRET-USUNIĘTY\]/);
    assert.match(wszystko, /\[ŚCIEŻKA\]/);
    assert.ok(r.zamazane.sekrety >= 30 && r.zamazane.sciezki >= 30);
    // Pełny fine-tune — DPO wyłączone wprost, z powodem.
    assert.match(tekst, /TRENUJ_DPO = False/);
});

test('za mało próbek = powód wprost (stado i Mistrz)', async () => {
    const { kc } = await srodowisko({ wkladow: 3 });
    const s = await kc.stan('kodeks');
    assert.equal(s.wystarczy, false);
    assert.match(s.powod, /Za mało dobrej pracy Kodeks: 3 wkładów .* \(potrzeba 8\)/);
    await assert.rejects(kc.notatnik({ agent: 'kodeks', baza: 'gemma4-e4b' }), /Za mało dobrej pracy Kodeks: 3/);
    const m = await kc.stan('mistrz');
    assert.equal(m.sft, 0);
    assert.match(m.powod, /Za mało poprawek Suwerena do nauki: 0 \(potrzeba 8\)/);
});

test('Mistrz: dane z plików JaJa, zła baza/metoda odrzucone', async () => {
    const { kc } = await srodowisko({ poprawekMistrza: 9 });
    const s = await kc.stan('mistrz');
    assert.equal(s.sft, 9); assert.equal(s.dpo, 9); assert.equal(s.wystarczy, true);
    await assert.rejects(kc.notatnik({ agent: 'mistrz', baza: 'gemma4-31b', metoda: 'pelny' }), /metoda pelny odpada/);
    await assert.rejects(kc.notatnik({ agent: 'mistrz', baza: 'llama-9000' }), /Nieznana baza/);
    await assert.rejects(kc.notatnik({ agent: '../x', baza: 'gemma4-e4b' }), /Zły identyfikator/);
    const r = await kc.notatnik({ agent: 'mistrz', baza: 'gemma4-31b' });
    assert.equal(r.notatnik.metadata.otakos.metoda, 'qlora');
    assert.match(JSON.stringify(r.notatnik), /teogochi-mistrz-colab/);
});

test('oczyscTekst: zwykły tekst i adresy http nietknięte', () => {
    const o = oczyscTekst('Zobacz https://huggingface.co/google/x i plik: ./src/main.ts — 50% szans', { sekrety: [], sciezki: [] });
    assert.equal(o.tekst, 'Zobacz https://huggingface.co/google/x i plik: ./src/main.ts — 50% szans');
    assert.equal(o.sekrety + o.sciezki, 0);
});

function znajdzPythona() {
    for (const [p, a] of [[process.env.OTAKOS_PYTHON, []], ['python', []], ['python3', []], ['py', ['-3']]]) {
        if (!p) continue;
        const r = spawnSync(p, [...a, '--version'], { encoding: 'utf8' });
        if (r.status === 0 && /Python 3/.test(r.stdout + r.stderr)) return [p, a];
    }
    return null;
}

test('kod notatnika kompiluje się w Pythonie (py_compile)', async (t) => {
    const py = znajdzPythona();
    if (!py) { t.skip('brak Pythona 3'); return; }
    const { dir, kc } = await srodowisko();
    for (const [baza, b] of Object.entries(BAZY)) {
        for (const metoda of b.metody) {
            const r = await kc.notatnik({ agent: 'kodeks', baza, metoda });
            const skrypt = r.notatnik.cells.filter((c) => c.cell_type === 'code').map(zrodloKomorki).join('\n\n');
            const plik = path.join(dir, `nb-${baza}-${metoda}.py`);
            await fs.writeFile(plik, skrypt, 'utf8');
            const w = spawnSync(py[0], [...py[1], '-I', '-m', 'py_compile', plik], { encoding: 'utf8' });
            assert.equal(w.status, 0, `${baza}/${metoda}: ${w.stderr}`);
        }
    }
});
