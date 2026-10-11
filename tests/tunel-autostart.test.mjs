// 🔁 Autostart tunelu: most pamięta wybór Suwerena (start = włączony, stop = wyłączony), zmienna środowiskowa wygrywa,
// po starcie mostu włączony tunel wstaje sam z ponowieniami i meldunkiem; wyłączony — nic nie startuje.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { skonfiguruj, czyAutostart, zapamietaj, autostart } from '../services/Tunel.js';

test('autostart tunelu: pamięć wyboru, zmienna środowiskowa, ponowienia, meldunek po starcie', async () => {
    const k = fs.mkdtempSync(path.join(os.tmpdir(), 'tunel-auto-'));
    const env = process.env.OTAKOS_TUNEL_AUTOSTART;
    delete process.env.OTAKOS_TUNEL_AUTOSTART;
    try {
        const meldunki = [];
        skonfiguruj({ katalogWymiaru: k, szyna: null, poStarcie: async (s) => { meldunki.push(s.adres); } });
        assert.equal(czyAutostart(), false, 'bez pliku — wyłączony (nie wystawiamy Katedry bez wyboru Suwerena)');
        let proby = 0;
        const uruchom = async () => { proby++; throw new Error('nie powinno startować'); };
        assert.equal(await autostart({ opoznienieMs: 0, przerwy: [], uruchom }), null);
        assert.equal(proby, 0);

        zapamietaj(true);
        assert.equal(czyAutostart(), true);
        assert.equal(JSON.parse(fs.readFileSync(path.join(k, 'tunel-autostart.json'), 'utf8')).wlaczony, true);
        assert.equal(czyAutostart({ OTAKOS_TUNEL_AUTOSTART: '0' }), false, 'zmienna wyłącza mimo pliku');

        // dwie porażki (np. internet jeszcze nie wstał), trzecia próba udana → meldunek
        let n = 0;
        const s = await autostart({ opoznienieMs: 0, przerwy: [10, 10], uruchom: async () => { n++; if (n < 3) throw new Error('brak sieci'); return { stan: 'dziala', adres: 'https://katedra.otakos.wtf' }; } });
        assert.equal(n, 3);
        assert.equal(s.adres, 'https://katedra.otakos.wtf');
        assert.deepEqual(meldunki, ['https://katedra.otakos.wtf']);

        // same porażki → po wyczerpaniu prób stan z błędem, bez meldunku
        let m = 0;
        await autostart({ opoznienieMs: 0, przerwy: [5], uruchom: async () => { m++; throw new Error('brak sieci'); } });
        assert.equal(m, 2);
        assert.equal(meldunki.length, 1);

        zapamietaj(false);
        assert.equal(czyAutostart(), false);
        assert.equal(czyAutostart({ OTAKOS_TUNEL_AUTOSTART: '1' }), true, 'zmienna włącza mimo pliku');
    } finally {
        if (env === undefined) delete process.env.OTAKOS_TUNEL_AUTOSTART; else process.env.OTAKOS_TUNEL_AUTOSTART = env;
        fs.rmSync(k, { recursive: true, force: true });
    }
});
