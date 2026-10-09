// 🧭 Reżyser Gry zna moce Katedry dla gier (Mistrz Gry, Klub, Kustosz, Assety 3D) i zasady stylu Suwerena od JaJa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Gdd, { MOCE_KATEDRY_DLA_GIER } from '../services/Gdd.js';

test('rozmowa Reżysera: moce Katedry + zasady JaJa; bez lekcji — bez pustego bloku', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'rez-'));
    try {
        await fs.mkdir(path.join(kat, 'gra'));
        let system = '';
        Gdd.skonfiguruj({ katalog: kat, model: () => 'm', pisz: async (o) => { system = o.system; return { tekst: 'Proponuję turniej z Mistrzem Gry.' }; }, zasadyStylu: async () => ['Skracaj kwestie do jednego zdania.'] });
        await Gdd.rozmowa('gra', { wypowiedz: 'Co z turniejami?' });
        assert.match(system, /Mistrz Gry \(JaJo Mistrza\): POST \/api\/mistrz-gry\/kwestia/);
        assert.match(system, /Globalny Klub Mistrzów/);
        assert.match(system, /ZASADY STYLU SUWERENA[\s\S]*1\. Skracaj kwestie do jednego zdania\./);
        Gdd.skonfiguruj({ zasadyStylu: async () => [] });
        await Gdd.rozmowa('gra', { wypowiedz: 'A teraz?' });
        assert.ok(system.includes(MOCE_KATEDRY_DLA_GIER));
        assert.doesNotMatch(system, /ZASADY STYLU SUWERENA/);
        Gdd.skonfiguruj({ zasadyStylu: async () => { throw new Error('JaJo śpi'); } });
        await Gdd.rozmowa('gra', { wypowiedz: 'I jeszcze?' });
        assert.doesNotMatch(system, /ZASADY STYLU SUWERENA/, 'błąd JaJa nie psuje rozmowy');
    } finally { Gdd.skonfiguruj({ zasadyStylu: undefined }); await fs.rm(kat, { recursive: true, force: true }); }
});
