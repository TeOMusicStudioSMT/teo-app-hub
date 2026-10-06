// 🩺 Błędy modeli po ludzku: surowy błąd Ollamy z ekranu Suwerena → przyczyna i droga; mały model w Kodeksie → rada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rozmiarModelu, malyModel, wyjasnijBladModelu, radaDlaKodeksa } from '../services/BledyModeli.js';

const Z_EKRANU = 'API Error: 500 {"error":{"code":500,"message":"\\n------------\\nWhile executing CallExpression at line 99, column 32 in source:\\n...first %}↵ {{- raise_exception(\'System message must be at the beginnin...\\n ^\\nError: Jinja Exception: System message must be at the beginning.","type":"server_error"}}. This is a server-side issue, usually temporary — try again in a moment.';

test('rozmiar z nazwy: 4B, e4b, 7b, 26B, 0.6b; bez rozmiaru = null', () => {
    assert.equal(rozmiarModelu('hf.co/mradermacher/Agents-A1-4B-kimi-Preview-heretic-GGUF:Q4_K_M'), 4);
    assert.equal(rozmiarModelu('gemma4:e4b'), 4);
    assert.equal(rozmiarModelu('qwen2.5-coder:7b'), 7);
    assert.equal(rozmiarModelu('gemma4:26b'), 26);
    assert.equal(rozmiarModelu('qwen3:0.6b'), 0.6);
    assert.equal(rozmiarModelu('gemma4'), null);
    assert.equal(malyModel('hf.co/mradermacher/Agents-A1-4B-kimi-Preview-heretic-GGUF:Q4_K_M'), true);
    assert.equal(malyModel('gpt-oss:20b'), false);
    assert.equal(malyModel('gemma4'), false, 'nie wiem = nie straszę');
});

test('błąd szablonu czatu z ekranu Suwerena → wprost: nie przejściowy, wybierz inny model', () => {
    const w = wyjasnijBladModelu(Z_EKRANU, 'hf.co/x/Agents-A1-4B-GGUF:Q4_K_M');
    assert.match(w, /szablonie czatu/);
    assert.match(w, /ponawianie nic nie da/);
    assert.match(w, /Agents-A1-4B/);
    assert.match(wyjasnijBladModelu('registry.ollama.ai/library/phi does not support tools', 'phi'), /narzędzi/);
    assert.equal(wyjasnijBladModelu('connection reset', 'x'), null, 'nieznany błąd zostaje surowy');
});

test('rada dla Kodeksa: mały model bez bloków PLIK → większy model; inny powód → brak rady', () => {
    const powod = 'Po 4 rundach nadal błędy — ostatnie: Nie znalazłem żadnego bloku === PLIK: … === w Twojej odpowiedzi.';
    assert.match(radaDlaKodeksa(powod, 'hf.co/x/Agents-A1-4B-GGUF:Q4_K_M'), /mały.*Dyrygent gry/);
    assert.match(radaDlaKodeksa(powod, 'qwen3-coder:30b'), /mocniejszy/);
    assert.equal(radaDlaKodeksa('build: TS2339', 'qwen3-coder:30b'), null);
});
