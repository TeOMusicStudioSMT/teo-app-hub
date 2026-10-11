/**
 * 🔐 Skarbiec → stacje i klucze, których brakowało (Suweren 2026-10-11: „skarbiec — brakuje elementów z Impresario”).
 * Skarbiec 0.00G trzyma swoje sekrety (VaultService), ale Katedra ma jeszcze dwa magazyny:
 *  · Impresariat (`media_secrets.json`): YouTube (OAuth, kanały), Spotify, SoundCloud — `GET /api/impresario/status`,
 *  · klucze chmury udostępnione mostowi z TeO-Kibla — `GET /api/kibel/most` (tylko końcówki).
 * Tu je widać w jednym miejscu (bez wartości kluczy); łączy się w zakładce 🎙️ Impresario i w TeO-Kiblu.
 */
import React, { useEffect, useState } from 'react';
import { otworzTeoSim } from '../../lib/koherencja';

const MOST = 'http://127.0.0.1:3001';
interface Stacja { connected: boolean; last_updated?: string | null; kanalow?: number }
interface KluczMostu { nazwa: string; udostepniony: boolean; koncowka?: string | null }

const SkarbiecStacje: React.FC = () => {
  const [stacje, setStacje] = useState<Record<string, Stacja> | null>(null);
  const [klucze, setKlucze] = useState<Record<string, KluczMostu> | null>(null);
  useEffect(() => {
    fetch(`${MOST}/api/impresario/status`).then((r) => r.json()).then((d) => setStacje(d?.vault ?? null)).catch(() => setStacje(null));
    fetch(`${MOST}/api/kibel/most`).then((r) => r.json()).then((d) => setKlucze(d?.klucze ?? null)).catch(() => setKlucze(null));
  }, []);
  const karta: React.CSSProperties = { flex: '1 1 180px', background: 'rgba(15,23,42,.8)', border: '1px solid #334155', borderRadius: 12, padding: '10px 12px' };
  const IKONY: Record<string, string> = { youtube: '📺 YouTube', spotify: '🎵 Spotify', soundcloud: '☁️ SoundCloud' };

  return (
    <div style={{ marginBottom: 14, color: '#e2e8f0', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 6px' }}>
        <b style={{ letterSpacing: '.08em', color: '#c4b5fd' }}>🎙️ STACJE IMPRESARIATU</b>
        <button onClick={() => otworzTeoSim('impresario')} style={{ padding: '3px 10px', borderRadius: 8, border: '1px solid #a78bfa66', background: 'transparent', color: '#c4b5fd', cursor: 'pointer' }}>połącz / odłącz → Impresario</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {stacje ? Object.entries(IKONY).map(([id, nazwa]) => {
          const s = stacje[id];
          return <div key={id} style={{ ...karta, borderColor: s?.connected ? '#34d39966' : '#33415599' }}>
            <div style={{ fontWeight: 700 }}>{nazwa}</div>
            <div style={{ color: s?.connected ? '#86efac' : '#f87171' }}>{s?.connected ? `● połączono${s.kanalow ? ` · kanałów: ${s.kanalow}` : ''}` : '○ niepołączone'}</div>
            {s?.last_updated && <div style={{ color: '#64748b' }}>{new Date(s.last_updated).toLocaleString()}</div>}
          </div>;
        }) : <div style={{ ...karta, color: '#94a3b8' }}>Impresariat nie odpowiada (most?).</div>}
      </div>
      <div style={{ margin: '12px 2px 6px' }}><b style={{ letterSpacing: '.08em', color: '#67e8f9' }}>🌀 KLUCZE CHMURY DLA MOSTU (z TeO-Kibla)</b></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {klucze ? Object.entries(klucze).map(([id, k]) => (
          <div key={id} style={{ ...karta, borderColor: k.udostepniony ? '#22d3ee66' : '#33415599' }}>
            <div style={{ fontWeight: 700 }}>{k.nazwa}</div>
            <div style={{ color: k.udostepniony ? '#67e8f9' : '#94a3b8' }}>{k.udostepniony ? `● udostępniony ${k.koncowka ?? ''}` : '○ tylko w przeglądarce — TeO-Kibel → 🔗 Udostępnij mostowi'}</div>
          </div>
        )) : <div style={{ ...karta, color: '#94a3b8' }}>Most nie podał kluczy.</div>}
      </div>
    </div>
  );
};

export default SkarbiecStacje;
