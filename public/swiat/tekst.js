/**
 * ✍️ Tekst stada — wkłady TeOgochi czytelnie, bez surowych znaczków modelu.
 *
 * Suweren (2026-09-26): gemma pisze `**pogrubienie**`, `### nagłówki`, listy `* …` i LaTeX
 * (`$\rightarrow$`), a Świat pokazywał te znaczki dosłownie. Tu zamieniamy je na zwykłe
 * pogrubienia, punkty i strzałki.
 *
 * BEZPIECZEŃSTWO: najpierw ucieczka HTML całego tekstu, dopiero potem nasze własne znaczniki
 * (<b>, <i>, <code>) — tekst z modelu nigdy nie wstrzyknie HTML-a do strony.
 */
(function (swiat) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Polecenia LaTeX-a, które modele wstawiają w zwykły tekst → znaki. */
  const LATEX = {
    rightarrow: '→', to: '→', leftarrow: '←', gets: '←', Rightarrow: '⇒', Leftarrow: '⇐',
    leftrightarrow: '↔', Leftrightarrow: '⇔', uparrow: '↑', downarrow: '↓', mapsto: '↦',
    times: '×', cdot: '·', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠', approx: '≈',
    pm: '±', infty: '∞', deg: '°', circ: '°', ldots: '…', dots: '…', checkmark: '✓', star: '★',
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', omega: 'ω', Delta: 'Δ',
  };
  const latexNaZnaki = (s) => s.replace(/\\([A-Za-z]+)/g, (m, nazwa) => LATEX[nazwa] ?? m);

  /** Jedna linia: pogrubienia, kursywa, kod — już po ucieczce HTML. */
  function wLinii(s) {
    return s
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>')
      .replace(/__([^_\n]+?)__/g, '<b>$1</b>')
      .replace(/(^|[\s(„"])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?”"]|$)/g, '$1<i>$2</i>');
  }

  /**
   * Tekst modelu → bezpieczny HTML do elementu z `white-space: pre-wrap` (np. .wklad).
   * @param {string} tekst
   * @returns {string}
   */
  function bogaty(tekst) {
    // LaTeX: najpierw `$…$` wokół poleceń (`$\rightarrow$` → `→`), potem gołe polecenia.
    let s = String(tekst ?? '').replace(/\$\s*(\\[A-Za-z]+(?:\s*\\[A-Za-z]+)*)\s*\$/g, (_, w) => latexNaZnaki(w).replace(/\s+/g, ''));
    s = latexNaZnaki(s);
    return esc(s).split('\n').map((linia) => {
      const naglowek = linia.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
      if (naglowek) return `<b>${wLinii(naglowek[1])}</b>`;
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(linia)) return '──────';
      const punkt = linia.match(/^(\s*)[*\-+•]\s+(.*)$/);
      if (punkt) return `${punkt[1]}• ${wLinii(punkt[2])}`;
      return wLinii(linia);
    }).join('\n');
  }

  const api = { bogaty, latexNaZnaki };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else swiat.TekstStada = api;
})(typeof window !== 'undefined' ? window : globalThis);
