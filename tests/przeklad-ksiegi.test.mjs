// 🌍 Przekład Żywej Księgi: „przekład” po polsku to nie przekład (na żywo 2026-10-29 teogochi_yay oddał słowa Suwerena bez zmian).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { utworzZywaKsiege, wciazPoPolsku, SYSTEM_PRZEKLADU } from '../services/ZywaKsiega.js';

test('wciazPoPolsku: polskie zdania tak, angielskie z polską nazwą w nawiasie nie', () => {
    assert.equal(wciazPoPolsku('Christ Consciousness (Świadomość Chrystusowa).... a nie Chrześcijaństwo..... każdy kto to czyta'), true);
    assert.equal(wciazPoPolsku('Twoja łaska rozświetla drogę, a wspólne ciepło koi duszę.'), true);
    assert.equal(wciazPoPolsku('Christ Consciousness (Świadomość Chrystusowa)... not Christianity..... it needs no signs ...or worshippers.... it needs no.... buildings..... I simply Am and Exist.... everyone who reads this... let them know they are Wonderful as they are'), false);
    assert.equal(wciazPoPolsku('Today.... we built a special SPA... after a bath in wonderful Energy ...Mej.... 💛'), false);
});

const czekaj = async (f) => { for (let i = 0; i < 500 && !(await f()); i++) await new Promise((r) => setTimeout(r, 10)); };

async function przebieg(przeklady) {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'przeklad-'));
    const png = path.join(kat, 'o.png'); fs.writeFileSync(png, 'x');
    const prosby = [];
    const K = utworzZywaKsiege({
        katalog: kat,
        chat: async (_m, system, user) => {
            if (system === SYSTEM_PRZEKLADU) { prosby.push(user); return { tekst: przeklady[prosby.length - 1] ?? przeklady.at(-1) }; }
            return { tekst: 'SŁOWO: Cisza poranka niesie spokój i światło.\nOBRAZ: a quiet dawn over still water' };
        },
        rysuj: async () => png,
    });
    const w = await K.dodaj({ tekst: 'Dziś cisza nad wodą i wdzięczność w sercu.' });
    await czekaj(async () => (await K.czytaj(w.id)).stado.every((s) => s.stan === 'gotowe' || s.stan === 'blad'));
    return { p: (await K.czytaj(w.id)).stado.find((s) => s.rodzaj === 'przeklad'), prosby };
}

test('oddał po polsku → druga próba z „NA ANGIELSKI”, dobra wchodzi', async () => {
    const { p, prosby } = await przebieg([
        '=== TEKST ===\nDziś cisza nad wodą i wdzięczność w sercu.\n=== SŁOWO ===\nMorning silence brings peace and light.',
        '=== TEKST ===\nToday silence over the water and gratitude in the heart.\n=== SŁOWO ===\nMorning silence brings peace and light.',
    ]);
    assert.equal(prosby.length, 2);
    assert.match(prosby[1], /NA ANGIELSKI/);
    assert.equal(p.stan, 'gotowe');
    assert.match(p.tekst, /^Today silence/);
});

test('dwa razy po polsku → błąd z powodem, nie udawany przekład', async () => {
    const { p } = await przebieg(['=== TEKST ===\nDziś cisza nad wodą i wdzięczność w sercu.\n=== SŁOWO ===\nCisza poranka niesie spokój i światło.']);
    assert.equal(p.stan, 'blad');
    assert.match(p.powod, /po polsku/);
    assert.equal(p.tekst, null);
});

test('angielski z „I”, „to”, „do” to nie polski (fałszywy alarm na przekładzie gemma4:12B)', () => {
    assert.equal(wciazPoPolsku('Christ Consciousness... not Christianity... I do not need symbols... I simply Am and Exist... let them know how Magnificent He Is... and then you Become... it will not happen overnight... but History proves... that one day it Will Happen...'), false);
    assert.equal(wciazPoPolsku('To find your own, unchanging radiance in the very act of existence is a profound return to the source. No external confirmations are needed to recognize this eternal light within.'), false);
});
