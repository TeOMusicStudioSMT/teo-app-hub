/**
 * 💬🔐 Znak TOST-a (TeO Secret Messenger) — dymek rozmowy z dziurką od klucza: rozmowy szyfrowane między Katedrami.
 * Własny znak w menu Huba (Suweren 2026-10-11: „w miejsce MCP Skillboard — TOST ze swą specjalną ikonką”).
 */
import React from 'react';

const TostIkona: React.FC<{ rozmiar?: number }> = ({ rozmiar = 26 }) => (
  <svg width={rozmiar} height={rozmiar} viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <linearGradient id="tost-dymek" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fef3c7" />
        <stop offset="1" stopColor="#fbbf24" />
      </linearGradient>
    </defs>
    {/* dymek z ogonkiem */}
    <path d="M6 5h20a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H14l-6 5v-5H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" fill="url(#tost-dymek)" stroke="#78350f" strokeWidth="1.2" />
    {/* dziurka od klucza — szyfr E2E */}
    <circle cx="16" cy="12" r="3" fill="#1c1917" />
    <path d="M14.6 13.8h2.8l1 5h-4.8z" fill="#1c1917" />
    {/* iskra Katedry */}
    <circle cx="26" cy="6" r="2.2" fill="#34d399" stroke="#064e3b" strokeWidth=".8" />
  </svg>
);

export default TostIkona;
