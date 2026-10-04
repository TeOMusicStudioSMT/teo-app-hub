// ⚡ Giełda mocy, etap 1: oferta (normalizacja, modele z Ollamy), wycinek do wizytówki, oferty z rejestru, karta z nvidia-smi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { utworzGielde, normalizujOferte, wycinekPubliczny, ofertaZSieci, gpuZNvidiaSmi, JEDNOSTKA } from '../services/GieldaMocy.js';

test('karta z nvidia-smi: nazwa i VRAM w GB; śmieci = null', () => {
    assert.deepEqual(gpuZNvidiaSmi('NVIDIA GeForce RTX 4070, 12282\nNVIDIA X, 8000'), { nazwa: 'NVIDIA GeForce RTX 4070', vramGB: 12 });
    assert.equal(gpuZNvidiaSmi(''), null);
    assert.equal(gpuZNvidiaSmi('cokolwiek'), null);
});

test('oferta: granice liczb, modele tylko znane i poprawne, wycinek tylko gdy udostępniam i są modele', () => {
    const o = normalizujOferte({ udostepniam: true, vramGB: 9999, cenaGRV: -5, modele: ['gemma4', 'gemma4', 'bielik:11b', 'zły model!', 'obcy'], opis: 'x'.repeat(500) }, { znaneModele: ['gemma4', 'bielik:11b'] });
    assert.equal(o.vramGB, 512); assert.equal(o.cenaGRV, 0); assert.deepEqual(o.modele, ['gemma4', 'bielik:11b']); assert.equal(o.opis.length, 300);
    assert.equal(wycinekPubliczny({ ...o, udostepniam: false }), null);
    assert.equal(wycinekPubliczny({ ...o, modele: [] }), null);
    assert.equal(wycinekPubliczny(o).jednostka, JEDNOSTKA);
    assert.equal(ofertaZSieci({ vramGB: 'dużo', modele: ['<script>'] }), null, 'cudza oferta bez poprawnego modelu = nic');
    assert.equal(ofertaZSieci({ vramGB: 24, modele: ['qwen3:14b'], cenaGRV: 2 }).vramGB, 24);
});

test('Giełda: domyślna oferta z wykrytej karty, zapis z walidacją modeli, publiczna, oferty z rejestru bez mojej', async () => {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'gielda-'));
    const G = utworzGielde({
        katalog: kat, modeleOllamy: async () => ['gemma4', 'bielik:11b'], gpu: async () => ({ nazwa: 'RTX 4070', vramGB: 12 }),
        fetch: async (url) => { assert.equal(url, 'https://rejestr.test/api/katedry'); return { ok: true, json: async () => ({ katedry: [
            { nick: 'teo-mas', adres: 'https://a.trycloudflare.com', moc: { vramGB: 12, modele: ['gemma4'], cenaGRV: 1 } },
            { nick: 'ania', adres: 'https://b.trycloudflare.com', motto: 'hej', moc: { vramGB: 24, gpu: 'RTX 4090', modele: ['qwen3:14b'], cenaGRV: 3 } },
            { nick: 'bez-oferty', adres: 'https://c.trycloudflare.com' },
            { nick: 'smiec', adres: 'https://d.trycloudflare.com', moc: { modele: [] } },
        ] }) }; },
        rejestr: 'https://rejestr.test/api/katedry',
    });
    const d = await G.oferta();
    assert.equal(d.udostepniam, false); assert.equal(d.vramGB, 12); assert.equal(d.gpu, 'RTX 4070');
    assert.equal(await G.publiczna(), null, 'domyślnie nic nie udostępniam');
    await assert.rejects(G.ustawOferte({ udostepniam: true, modele: ['obcy'] }), /co najmniej jednego modelu/);
    const o = await G.ustawOferte({ udostepniam: true, vramGB: 10, modele: ['gemma4', 'obcy'], cenaGRV: 1.5 });
    assert.deepEqual(o.modele, ['gemma4']); assert.ok(o.zmieniono);
    assert.deepEqual(Object.keys(await G.publiczna()).sort(), ['cenaGRV', 'godziny', 'gpu', 'jednostka', 'modele', 'od', 'opis', 'vramGB']);
    const s = await G.stan();
    assert.deepEqual(s.modele, ['gemma4', 'bielik:11b']); assert.equal(s.wykryte.vramGB, 12);
    const r = await G.oferty({ pomin: 'teo-mas' });
    assert.equal(r.online, 4);
    assert.deepEqual(r.oferty.map((k) => k.nick), ['ania']);
    assert.equal(r.vramGB, 24);
});

test('Giełda: bez odpowiedzi Ollamy nie ogłasza mocy (nie da się sprawdzić modeli)', async () => {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'gielda-'));
    const G = utworzGielde({ katalog: kat, modeleOllamy: async () => { throw new Error('ECONNREFUSED'); } });
    await assert.rejects(G.ustawOferte({ udostepniam: true, modele: ['gemma4'] }), /Ollama nie podała modeli/);
    assert.equal((await G.ustawOferte({ udostepniam: false, modele: ['gemma4'] })).udostepniam, false, 'zapis bez udostępniania wolno');
    assert.equal(await G.publiczna(), null);
});
