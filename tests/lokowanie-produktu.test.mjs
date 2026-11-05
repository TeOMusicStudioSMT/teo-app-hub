// 🛍️ Lokowanie produktu: film z linkiem kolekcji albo wstawką reklamową → YouTube paidProductPlacementDetails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzPublikacje } from '../services/PublikacjeYouTube.js';

async function publikacje(linkSklepu) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lokowanie-'));
    const kolejka = [];
    const P = utworzPublikacje({ katalog: dir, teraz: () => Date.now(), pisz: async () => ({ tekst: 'TYTUŁ: Borowik dances\nOPIS: Opis otakos.wtf\nTAGI: a, b', silnik: 'atrapa' }),
        kanaly: async () => ({ domyslny: null, kanaly: [] }), gotowyYouTube: async () => true, linkSklepu,
        impresariat: { enqueuePublication: async (...a) => { kolejka.push(a[4]); return { id: 'job-1' }; } } });
    const film = async (n) => { const p = path.join(dir, n); await fs.writeFile(p, 'x'); return p; };
    return { P, film, kolejka };
}

test('link kolekcji w opisie = lokowanie produktu, idzie do Impresariatu', async () => {
    const { P, film, kolejka } = await publikacje(async ({ plik }) => (/borowik/i.test(plik) ? { imie: 'Borowik', url: 'https://teo.center/' } : null));
    const t = await P.przygotuj({ plik: await film('gameshow_Borowik_en_1.mp4'), nazwa: 'x', jezyk: 'en', zrodlo: { projekt: 'teo-game-show' } });
    assert.equal(t.lokowanie, true);
    assert.match(t.opis, /🛍️ Borowik collection: https:\/\/teo\.center\//);
    await P.zatwierdz(t.id);
    assert.equal(kolejka[0].lokowanie, true);
});

test('bez produktu — bez lokowania; wstawka reklamowa (zrodlo.reklama) — z lokowaniem', async () => {
    const { P, film, kolejka } = await publikacje(async () => null);
    const a = await P.przygotuj({ plik: await film('gol_a-b_en_1.mp4'), nazwa: 'a', zrodlo: { projekt: 'gol-dnia' } });
    assert.notEqual(a.lokowanie, true);
    await P.zatwierdz(a.id);
    assert.equal(kolejka[0].lokowanie, false);
    const b = await P.przygotuj({ plik: await film('fashion_x.mp4'), nazwa: 'b', zrodlo: { projekt: 'zebrra-fashion', reklama: true } });
    assert.equal(b.lokowanie, true);
});
