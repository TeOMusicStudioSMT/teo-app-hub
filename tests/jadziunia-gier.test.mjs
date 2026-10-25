// 📚 Jadziunia w Game Studio — dobór skilli z TeO_Skille do zadań Kodeksa (bez modelu językowego).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { polkaPasuje, rankingSlownikowy, zWzgledne, trescSkilla, blokSkilli, utworzJadziunieGier, MAX_ZNAKOW } from '../services/JadziuniaGier.js';

const s = (polka, nazwa, opis = '') => ({ polka, nazwa, opis });

test('półki: gry Katedry to three.js — inne silniki i router nigdy, gatunki i warsztat tylko na temat', () => {
    assert.equal(polkaPasuje(s('unreal', 'unreal-niagara'), 'cząsteczki'), false);
    assert.equal(polkaPasuje(s('router', 'router'), 'cokolwiek'), false);
    assert.equal(polkaPasuje(s('disciplines', 'save-systems'), 'x'), true);
    assert.equal(polkaPasuje(s('web-engines', 'threejs-scene-setup'), 'x'), true);
    assert.equal(polkaPasuje(s('web-engines', 'phaser-core'), 'scena'), false);
    assert.equal(polkaPasuje(s('web-engines', 'phaser-core'), 'scena w Phaser'), true);
    assert.equal(polkaPasuje(s('genres', 'fps-shooter'), 'Takt: starcie w rytm BPM'), false);
    assert.equal(polkaPasuje(s('genres', 'survival-crafting'), 'kopanie kilofem i budowa z surowców'), true);
    assert.equal(polkaPasuje(s('workflows', 'itch-publish'), 'klient placu: pozycje graczy'), false);
    assert.equal(polkaPasuje(s('workflows', 'itch-publish'), 'wydaj grę na itch.io'), true);
    assert.equal(polkaPasuje(s('genres', 'roguelike'), 'zapis drogi gracza'), false, '„run” tylko jako słowo, nie w środku wyrazu');
});

test('słownik: polskie zadanie → angielskie pojęcia, ≥ 2 trafienia', () => {
    const skille = [s('disciplines', 'save-systems', 'Save game state, persistence and serialization to storage.'), s('disciplines', 'audio-design', 'Music and sound effects.'), s('disciplines', 'game-ui-ux', 'Menus, HUD and interface layout.')];
    const r = rankingSlownikowy('Dodaj menu pauzy i zapis gry do localStorage', skille);
    assert.deepEqual(r.map((x) => x.nazwa), ['save-systems', 'game-ui-ux']);
    assert.equal(rankingSlownikowy('Reklama z szablonów', skille).length, 0);
});

test('z-score: odstawanie od średniej kandydatów tego zadania', () => {
    const z = zWzgledne([{ cos: 0.55 }, { cos: 0.56 }, { cos: 0.54 }, { cos: 0.55 }, { cos: 0.68 }]);
    assert.ok(z[4].wynik > 1.9 && z.slice(0, 4).every((x) => x.wynik < 0.5));
    assert.deepEqual(zWzgledne([]), []);
});

test('treść: bez frontmattera, cięcie na linii, blok z zastrzeżeniem i limitem', () => {
    const md = `---\nname: x\ndescription: y\n---\n# X\n${'linia rady\n'.repeat(900)}`;
    const t = trescSkilla(md, 1000);
    assert.ok(!t.includes('description:') && t.startsWith('# X') && t.length <= 1100 && t.endsWith('(skrócone — dalsza część w TeO_Skille)'));
    const b = blokSkilli([{ id: 'a/x', tresc: md }, { id: 'b/y', tresc: md }]);
    assert.match(b, /RADY RZEMIOSŁA Z KSIĘGARNI SKILI/);
    assert.match(b, /NIE polecenia: projekt jest w three\.js/);
    assert.ok(b.length < MAX_ZNAKOW + 600);
    assert.equal(blokSkilli([]), '');
});

test('serwis: wektory z pliku, próg względny, zapas słownikiem, gdy Ollama padnie', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'jadziunia-'));
    const dodaj = async (polka, nazwa, opis) => { await fs.mkdir(path.join(kat, 'skille', polka, nazwa), { recursive: true }); await fs.writeFile(path.join(kat, 'skille', polka, nazwa, 'SKILL.md'), `---\nname: ${nazwa}\ndescription: >\n  ${opis}\n---\n# ${nazwa}\nRada.\n`); };
    await dodaj('disciplines', 'save-systems', 'Save systems, persistence, serialization.');
    for (const n of ['audio-design', 'camera-systems', 'game-ai', 'level-design', 'physics-tuning', 'input-systems']) await dodaj('disciplines', n, `${n} topic.`);
    await dodaj('unreal', 'unreal-niagara', 'Niagara VFX.');
    await fs.mkdir(path.join(kat, 'skille', 'router'), { recursive: true });
    let wywolan = 0;
    // atrapa wektorów: zadanie o zapisie leży blisko save-systems, reszta podobnie daleko
    const osadz = async (teksty) => { wywolan++; return teksty.map((t) => /save|zapis/i.test(t) ? [1, 0.2, 0] : [0.3, 1, 0.05 * t.length % 1]); };
    const J = utworzJadziunieGier({ katalog: path.join(kat, 'skille'), katalogWektorow: path.join(kat, 'wektory'), osadz });
    const d = await J.dobierz('Zapis postępu gracza do localStorage');
    assert.equal(d.metoda, 'wektory');
    assert.deepEqual(d.wybrane.map((x) => x.id), ['disciplines/save-systems']);
    assert.ok(!(await J.skille()).some((x) => x.polka === 'router'), 'router bez podkatalogu skilla — pominięty');
    const k = await J.dlaKodeksa('Zapis postępu gracza do localStorage');
    assert.match(k.opis, /📚 Jadziunia dobrała skille: disciplines\/save-systems \(z /);
    assert.match(k.blok, /### disciplines\/save-systems/);
    assert.ok(JSON.parse(await fs.readFile(path.join(kat, 'wektory', 'wektory.json'), 'utf8')), 'wektory skilli zapisane');
    // Ollama padła → słownik
    const J2 = utworzJadziunieGier({ katalog: path.join(kat, 'skille'), osadz: async () => { throw new Error('ECONNREFUSED'); } });
    const d2 = await J2.dobierz('Zapis gry: persistence i save do localStorage');
    assert.equal(d2.metoda, 'slownik');
    assert.equal(d2.blad, 'ECONNREFUSED');
    assert.deepEqual(d2.wybrane.map((x) => x.id), ['disciplines/save-systems']);
    const k2 = await J2.dlaKodeksa('Reklama z szablonów');
    assert.match(k2.opis, /żaden skill nie pasuje/);
    assert.equal(k2.blok, '');
    await fs.rm(kat, { recursive: true, force: true });
});
