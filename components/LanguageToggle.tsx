/**
 * 🌍 LanguageToggle — wybór języka Katedry. pl/en/it mają ręczny słownik, każdy inny język tłumaczy
 * lokalny model (lib/tlumaczDom.ts → services/Tlumacz.js) i zapamiętuje na dysku węzła.
 * Pod wyborem: stan Tłumacza (ile tekstów czeka, błąd mostu/modelu) — żeby nie udawać, że wszystko już przetłumaczone.
 */
import React, { useEffect, useState } from 'react';
import { useT } from '../lib/i18n';
import { JEZYKI, JEZYKI_SLOWNIKA } from '../lib/locale';
import { obserwujStan, StanTlumacza } from '../lib/tlumaczDom';

export const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useT();
  const [stan, setStan] = useState<StanTlumacza | null>(null);
  useEffect(() => obserwujStan(setStan), []);
  const reczny = (JEZYKI_SLOWNIKA as readonly string[]).includes(lang);
  return (
    <span translate="no" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        title="Język Katedry — pl/en/it ze słownika, inne tłumaczy lokalny model (pierwszy raz chwilę trwa, potem z pamięci)"
        style={{
          padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(167,139,250,.4)', background: 'rgba(20,16,40,.85)',
          color: '#c4b5fd', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {Object.entries(JEZYKI).map(([kod, j]) => <option key={kod} value={kod}>{j.flaga} {j.nazwa}</option>)}
      </select>
      {!reczny && stan && stan.jezyk === lang && (stan.tlumaczy || stan.czeka > 0 || stan.blad) && (
        <span style={{ fontSize: 10, color: stan.blad ? '#fda4af' : '#a5b4fc' }}>
          {stan.blad ? `⚠ ${stan.blad}` : `🌍 tłumaczę… (${stan.czeka})`}
        </span>
      )}
    </span>
  );
};

export default LanguageToggle;
