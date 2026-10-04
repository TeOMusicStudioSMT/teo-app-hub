// 🌐 Nazwany tunel (stały adres Katedry, np. katedra.graviton.pw): własny plik, odporny na zapis telefonii w tunel.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { konfiguracjaNazwanego, PLIKI_NAZWANEGO } from '../services/Tunel.js';
import { ustaw as tunelUstaw, wczytaj as tunelWczytaj } from '../services/TunelService.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tunel-'));

test('tunel-nazwany.json: nazwa + host (bez https i końcowego /), poświadczenia muszą istnieć', () => {
    const k = tmp();
    assert.equal(konfiguracjaNazwanego(k), null, 'bez pliku = quick tunnel');
    const cred = path.join(k, 'id.json'); fs.writeFileSync(cred, '{}');
    fs.writeFileSync(path.join(k, 'tunel-nazwany.json'), JSON.stringify({ nazwa: 'katedra', host: 'https://katedra.graviton.pw/', poswiadczenia: cred }));
    assert.deepEqual(konfiguracjaNazwanego(k), { nazwa: 'katedra', host: 'katedra.graviton.pw', poswiadczenia: cred, plik: 'tunel-nazwany.json' });
    fs.writeFileSync(path.join(k, 'tunel-nazwany.json'), JSON.stringify({ nazwa: 'katedra', host: 'katedra.graviton.pw', poswiadczenia: path.join(k, 'nie-ma.json') }));
    assert.match(konfiguracjaNazwanego(k).blad, /poświadczeń, którego nie ma/);
    fs.writeFileSync(path.join(k, 'tunel-nazwany.json'), '{zepsuty');
    assert.match(konfiguracjaNazwanego(k).blad, /nie do odczytu/);
});

test('zapis Kwantowego Tunelu telefonii (tunel.json) NIE kasuje stałego adresu; stary tunel.json z „nazwa” nadal działa', async () => {
    assert.deepEqual(PLIKI_NAZWANEGO, ['tunel-nazwany.json', 'tunel.json']);
    const k = tmp();
    fs.writeFileSync(path.join(k, 'tunel-nazwany.json'), JSON.stringify({ nazwa: 'katedra', host: 'katedra.graviton.pw' }));
    await tunelUstaw(k, 'https://abc-def.trycloudflare.com', 'telefonia');
    assert.equal((await tunelWczytaj(k)).adres, 'https://abc-def.trycloudflare.com');
    assert.equal(konfiguracjaNazwanego(k).host, 'katedra.graviton.pw', 'stały adres przeżył zapis telefonii');

    // Węzeł, który zrobił stare kroki (tunel.json z polem nazwa) — nadal nazwany; tunel.json telefonii — pomijany.
    const s = tmp();
    fs.writeFileSync(path.join(s, 'tunel.json'), JSON.stringify({ nazwa: 'katedra', host: 'katedra.graviton.pw' }));
    assert.equal(konfiguracjaNazwanego(s).plik, 'tunel.json');
    await tunelUstaw(s, 'https://abc-def.trycloudflare.com');
    assert.equal(konfiguracjaNazwanego(s), null, 'kształt telefonii {adres…} to nie konfiguracja nazwanego tunelu');
});
