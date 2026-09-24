/**
 * Świat klocków (public/swiat): tryb 3D ładuje three.js z mostu przez mapę importów.
 * Pilnujemy, żeby każdy adres z mapy i każdy import sceny 3D miał plik na dysku —
 * inaczej 3D padnie dopiero na telefonie Suwerena (a strona spadnie do 2D).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KORZEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SWIAT = path.join(KORZEN, 'public', 'swiat');
/** Tak jak w wiesio-bridge.js: /swiat/three/build i /swiat/three/examples/jsm → node_modules/three. */
const naDysk = (url) => url.replace(/^\.\/three\//, path.join(KORZEN, 'node_modules', 'three') + '/');

test('mapa importów wskazuje istniejące pliki three.js', () => {
    const html = fs.readFileSync(path.join(SWIAT, 'index.html'), 'utf8');
    const mapa = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
    assert.ok(fs.existsSync(naDysk(mapa.three)), mapa.three);
    for (const imp of fs.readFileSync(path.join(SWIAT, 'swiat3d.js'), 'utf8').matchAll(/from '(three\/addons\/[^']+)'/g)) {
        const plik = naDysk(imp[1].replace('three/addons/', mapa['three/addons/']));
        assert.ok(fs.existsSync(plik), imp[1]);
    }
});

test('wersja three.js zgodna z Games Studio (0.170)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(KORZEN, 'node_modules', 'three', 'package.json'), 'utf8'));
    assert.match(pkg.version, /^0\.170\./);
});
