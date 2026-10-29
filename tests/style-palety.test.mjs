// 🎨 Style Palety z anidoodle: spis ze skilla → Kronikarz wybiera id z listy → FLUX dostaje medium stylu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { styleZIndeksu, wczytajStyle, znajdzStyl, sufiksStylu, listaDlaKronikarza } from '../services/StylePalety.js';
import { utworzZywaKsiege, odczytajSlowo, systemSlowa, STYL_ILUSTRACJI } from '../services/ZywaKsiega.js';

const INDEKS = [
    '| # | style | medium | hero module | draw-film module |',
    '|---|---|---|---|---|',
    '| 29 | Sumi-e ink painting (`sumiE`) | one loaded soft brush of sumi ink on xuan paper | `a.ts` | `a.ts` |',
    '| 31 | Ukiyo-e colour woodblock (`woodcut`) | pigment printed by baren from carved cherry blocks | `b.ts` | `b.ts` |',
].join('\n');

test('spis stylów ze skilla: 32 style w Katedrze, wiersze tabeli → id, nazwa, medium', () => {
    const s = styleZIndeksu(INDEKS);
    assert.deepEqual(s.map((x) => x.id), ['sumiE', 'woodcut']);
    assert.equal(s[0].nazwa, 'Sumi-e ink painting');
    const wKatedrze = wczytajStyle();
    if (wKatedrze.length) assert.equal(wKatedrze.length, 32);   // skill leży w TeO_Skille/sztuka/anidoodle
    assert.equal(znajdzStyl(s, '`SUMIE`.')?.id, 'sumiE');
    assert.equal(znajdzStyl(s, 'watercolor'), null);
    assert.match(sufiksStylu(s[1]), /carved cherry blocks, hand-made illustration, no text/);
});

test('Kronikarz: trzecia linia STYL nie wpada do słowa ani do opisu kadru', () => {
    assert.match(systemSlowa(listaDlaKronikarza(styleZIndeksu(INDEKS))), /sumiE — Sumi-e ink painting[\s\S]*STYL: <id z listy>/);
    assert.equal(systemSlowa(''), systemSlowa());
    const r = odczytajSlowo('SŁOWO: Cisza poranka niesie spokój.\nOBRAZ: a lone heron in morning mist STYL: sumiE');
    assert.deepEqual(r, { slowo: 'Cisza poranka niesie spokój.', obraz: 'a lone heron in morning mist', styl: 'sumiE' });
    assert.equal(odczytajSlowo('SŁOWO: Dwie linie jak dawniej, bez stylu.\nOBRAZ: dawn over sea').styl, null);
});

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'palety-'));
const czekaj = async (f) => { for (let i = 0; i < 500 && !(await f()); i++) await new Promise((r) => setTimeout(r, 10)); };

async function przebieg(odpowiedz) {
    const kat = tmp(); const prompty = []; const systemy = [];
    const png = path.join(kat, 'out.png'); fs.writeFileSync(png, 'x');
    const K = utworzZywaKsiege({
        katalog: kat, style: styleZIndeksu(INDEKS),
        chat: async (_m, system) => { systemy.push(system); return { tekst: odpowiedz } },
        rysuj: async ({ prompt }) => { prompty.push(prompt); return png; },
    });
    const w = await K.dodaj({ tekst: 'Mgła nad stawem.' });
    await czekaj(async () => (await K.czytaj(w.id)).stado.every((s) => s.stan === 'gotowe' || s.stan === 'blad'));
    return { wpis: await K.czytaj(w.id), prompty, systemy, publiczne: await K.publiczne() };
}

test('stado: styl z listy → Paleta maluje jego medium; nazwa stylu idzie do świata', async () => {
    const { wpis, prompty, systemy, publiczne } = await przebieg('SŁOWO: Mgła otula staw jak oddech.\nOBRAZ: a quiet pond veiled in mist\nSTYL: woodcut');
    assert.match(systemy[0], /woodcut — Ukiyo-e/);
    assert.deepEqual(wpis.stado[1].styl, { id: 'woodcut', nazwa: 'Ukiyo-e colour woodblock' });
    assert.match(prompty[0], /^a quiet pond veiled in mist, pigment printed by baren/);
    assert.equal(publiczne[0].ilustracja.styl, 'Ukiyo-e colour woodblock');
});

test('stado: styl spoza listy → dawny styl rękopisu, bez wymyślonego medium', async () => {
    const { wpis, prompty } = await przebieg('SŁOWO: Mgła otula staw jak oddech.\nOBRAZ: a quiet pond veiled in mist\nSTYL: hyperrealistic photo');
    assert.equal(wpis.stado[1].styl, null);
    assert.ok(prompty[0].endsWith(STYL_ILUSTRACJI));
});
