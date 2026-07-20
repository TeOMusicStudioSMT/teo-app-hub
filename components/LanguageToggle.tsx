/**
 * 🌍 LanguageToggle — przełącznik języka Katedry (PL → EN → IT → ...).
 * Cykl po obsługiwanych językach, zapamiętuje wybór.
 */
import React from 'react';
import { useT } from '../lib/i18n';
import { SUPPORTED_LANGS } from '../lib/locale';

const FLAG: Record<string, string> = { pl: '🇵🇱', en: '🇬🇧', it: '🇮🇹' };

export const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useT();
  const next = () => SUPPORTED_LANGS[(SUPPORTED_LANGS.indexOf(lang) + 1) % SUPPORTED_LANGS.length];
  return (
    <button
      onClick={() => setLang(next())}
      title={`Język: ${lang.toUpperCase()} → ${next().toUpperCase()}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8,
        border: '1px solid rgba(167,139,250,.4)', background: 'rgba(167,139,250,.1)', color: '#c4b5fd',
        fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer',
      }}
    >
      {FLAG[lang] ?? '🌍'} {lang.toUpperCase()}
    </button>
  );
};

export default LanguageToggle;
