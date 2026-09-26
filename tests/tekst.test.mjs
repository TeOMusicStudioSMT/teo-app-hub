/** Tekst stada (public/swiat/tekst.js): wkłady modeli bez surowych znaczków, ale bez wstrzykiwania HTML. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const kontekst = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../public/swiat/tekst.js', import.meta.url), 'utf8'), kontekst);
const { bogaty } = kontekst.window.TekstStada;

test('pogrubienia, nagłówki, punkty i kursywa zamiast gwiazdek', () => {
    assert.equal(bogaty('**Tekst/Interfejs (Ciemny):** `#1A1A1A`'), '<b>Tekst/Interfejs (Ciemny):</b> <code>#1A1A1A</code>');
    assert.equal(bogaty('### Plan produkcji'), '<b>Plan produkcji</b>');
    assert.equal(bogaty('* **Rozwiązanie:** najpierw API\n- druga\n  * wcięta'), '• <b>Rozwiązanie:</b> najpierw API\n• druga\n  • wcięta');
    assert.equal(bogaty('to jest *ważne* słowo'), 'to jest <i>ważne</i> słowo');
    assert.equal(bogaty('2 * 3 * 4 = 24'), '2 * 3 * 4 = 24');                 // mnożenie to nie kursywa
    assert.equal(bogaty('---'), '──────');
});

test('LaTeX z modelu → strzałki i znaki (dokładnie jak w pierwszym projekcie Suwerena)', () => {
    assert.equal(bogaty('Wprowadzenie modułu $\\rightarrow$ Pozycjonowanie modułu $\\rightarrow$ Łączenie'), 'Wprowadzenie modułu → Pozycjonowanie modułu → Łączenie');
    assert.equal(bogaty('koszt $\\times 2$, $a \\le b$'), 'koszt $× 2$, $a ≤ b$');   // wyrażenia zostają, polecenia są czytelne
    assert.equal(bogaty('\\textbf{x}'), '\\textbf{x}');                          // nieznane polecenie zostaje, jak było
});

test('HTML z modelu nigdy nie trafia do strony', () => {
    assert.equal(bogaty('<img src=x onerror=alert(1)> **<b>ok</b>**'), '&lt;img src=x onerror=alert(1)&gt; <b>&lt;b&gt;ok&lt;/b&gt;</b>');
    assert.equal(bogaty('"cytat" & <script>'), '&quot;cytat&quot; &amp; &lt;script&gt;');
    assert.equal(bogaty(null), '');
});
