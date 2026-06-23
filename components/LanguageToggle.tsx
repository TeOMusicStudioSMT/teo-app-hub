/**
 * 🌍 LanguageToggle — przełącznik języka Katedry (PL ⇄ EN).
 * Zmienia globalny język (i18n context), zapamiętuje wybór.
 */
import React from 'react';
import { useT } from '../lib/i18n';

export const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useT();
  return (
    <button
      onClick={() => setLang(lang === 'pl' ? 'en' : 'pl')}
      title={lang === 'pl' ? 'Switch to English' : 'Przełącz na polski'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8,
        border: '1px solid rgba(167,139,250,.4)', background: 'rgba(167,139,250,.1)', color: '#c4b5fd',
        fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer',
      }}
    >
      🌍 {lang === 'pl' ? 'PL' : 'EN'}
    </button>
  );
};

export default LanguageToggle;
