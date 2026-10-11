/**
 * 🫀 Koherencja Katedry — zakładka TeO-Sim w miejscu dawnego Reasoning Monitora (symulacji z czasów bez RAM-u).
 * Pokazuje prawdziwe sprawdzenia rur Katedry z mostu (`GET /api/koherencja`) i radę przy każdym braku;
 * ten sam procent świeci na pasku Koherencji na głównej.
 */
import React, { useState } from 'react';
import { pobierzKoherencje, useKoherencja, type Koherencja } from '../../lib/koherencja';
import { otworzMozg } from '../../lib/mozgKatedry';

const KoherencjaKatedry: React.FC = () => {
  const auto = useKoherencja(60_000);
  const [reczna, setReczna] = useState<Koherencja | null>(null);
  const [mysli, setMysli] = useState(false);
  const k = reczna ?? auto;
  const kolor = !k ? '#64748b' : k.procent >= 90 ? '#34d399' : k.procent >= 70 ? '#facc15' : '#f87171';

  return (
    <div style={{ background: 'rgba(15,23,42,.8)', border: `1px solid ${kolor}55`, borderRadius: 16, padding: 16, color: '#e2e8f0', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 40, fontWeight: 900, color: kolor, fontFamily: 'monospace' }}>{k ? `${k.procent}%` : '—'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#a7f3d0' }}>🫀 Koherencja Katedry</div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>{k ? (k.braki ? `${k.braki} ${k.braki === 1 ? 'rura nie dochodzi' : 'rury nie dochodzą'} — rady niżej` : 'Wszystkie rury dochodzą.') : 'Most milczy — nie ma czego sprawdzić.'}{k ? ` · ${new Date(k.kiedy).toLocaleTimeString()}` : ''}</div>
        </div>
        <button disabled={mysli} onClick={() => { setMysli(true); void pobierzKoherencje().then((x) => { setReczna(x); setMysli(false); }); }}
          style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid #334155', background: '#0b1220', color: '#e2e8f0', cursor: 'pointer' }}>{mysli ? '⏳' : '↻ Sprawdź teraz'}</button>
      </div>
      {k?.sprawdzenia.map((s) => (
        <div key={s.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: '1px solid rgba(51,65,85,.5)' }}>
          <span style={{ width: 22, textAlign: 'center' }}>{s.ok ? '✅' : s.opcjonalne ? '💤' : '⚠️'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{s.nazwa}</div>
            <div style={{ color: '#94a3b8', fontSize: 12, wordBreak: 'break-word' }}>{s.opis}</div>
            {s.rada && <div style={{ color: '#fcd34d', fontSize: 12, marginTop: 2 }}>→ {s.rada}{/Mózgu/.test(s.rada) && <button onClick={otworzMozg} style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 8, border: '1px solid #34d39977', background: 'transparent', color: '#6ee7b7', cursor: 'pointer', fontSize: 11 }}>🧠 otwórz Mózg</button>}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KoherencjaKatedry;
