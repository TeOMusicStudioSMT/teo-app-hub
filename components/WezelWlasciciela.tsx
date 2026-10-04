/**
 * 🪪 Twój węzeł w księdze GRV tej Katedry — imię Suwerena (+ kod zaproszenia przy zakładaniu) albo zmiana nazwy.
 *
 * Suweren (2026-10-04): „niech się pyta, co wpisać… każda nowa ma mieć swe unikalne… a sam nick wyświetlania można
 * zawsze zmienić”. Pierwsze wpisanie zakłada WŁAŚCICIELA (unikalny klucz `wezel-…`, `POST /api/grv/register
 * {wlasciciel: true, nazwa, kod}`); później ten sam panel zmienia tylko nazwę (`PUT /api/grv/nazwa`) — klucz,
 * saldo i łańcuch zostają. Używany w Onboardingu i w Panelu Bilansu.
 */
import React, { useEffect, useState } from 'react';
import { zsynchronizujWezel, zapamietajWezel, zmienNazwe, type WezelKsiegi } from '../lib/mojWezel';

const MOST = 'http://127.0.0.1:3001';

export const WezelWlasciciela: React.FC<{ onGotowe?: (w: WezelKsiegi) => void }> = ({ onGotowe }) => {
  const [stan, setStan] = useState<'laduje' | 'brak-mostu' | 'gotowe'>('laduje');
  const [wlasciciel, setWlasciciel] = useState<WezelKsiegi | null>(null);
  const [imie, setImie] = useState('');
  const [kod, setKod] = useState('');
  const [praca, setPraca] = useState(false);
  const [info, setInfo] = useState('');
  const [blad, setBlad] = useState('');

  useEffect(() => {
    void zsynchronizujWezel().then((ja) => {
      if (!ja) { setStan('brak-mostu'); return; }
      setWlasciciel(ja.wlasciciel); setImie(ja.wlasciciel?.nazwa ?? ''); setStan('gotowe');
      if (ja.wlasciciel) onGotowe?.(ja.wlasciciel);
    });
  }, [onGotowe]);

  const zaloz = async () => {
    setPraca(true); setBlad(''); setInfo('');
    try {
      const r = await fetch(`${MOST}/api/grv/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wlasciciel: true, nazwa: imie.trim(), kod: kod.trim() || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) throw new Error(d.message || `Most odpowiedział HTTP ${r.status}`);
      zapamietajWezel(d.id, d.nazwa ?? imie.trim());
      const w = { id: d.id, nazwa: d.nazwa ?? d.id, grv: d.grv, tier: d.tier ?? null };
      setWlasciciel(w); onGotowe?.(w);
      setInfo(d.existed ? `Ta Katedra ma już właściciela: „${w.nazwa}”.` : `✓ Witaj, ${w.nazwa}! Twój węzeł: ${Number(d.grv).toLocaleString('pl-PL')} GRV${d.kod ? ' — z kodem zaproszenia 🗝️' : ''}.`);
    } catch (e) { setBlad(e instanceof Error ? e.message : String(e)); } finally { setPraca(false); }
  };
  const zmien = async () => {
    if (!wlasciciel) return;
    setPraca(true); setBlad(''); setInfo('');
    try { const d = await zmienNazwe(wlasciciel.id, imie.trim()); setWlasciciel({ ...wlasciciel, nazwa: d.nazwa }); setInfo(`✓ Teraz jesteś „${d.nazwa}”.`); }
    catch (e) { setBlad(e instanceof Error ? e.message : String(e)); } finally { setPraca(false); }
  };

  if (stan === 'laduje') return <p className="text-xs text-zinc-500">…</p>;
  if (stan === 'brak-mostu') return <p className="text-xs text-amber-300">⚠ Most (127.0.0.1:3001) milczy — księga GRV żyje w moście. Odpal Katedrę — imię wpiszesz potem w Domu TeOgochi → Bilans (🪪 Twoje imię w tej Katedrze).</p>;
  const pole = 'w-full rounded border border-zinc-700 bg-black/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500';
  return (
    <div className="space-y-2">
      {wlasciciel && <p className="text-[11px] text-zinc-400">Węzeł w księdze: <code className="text-zinc-300">{wlasciciel.id}</code> · {String(wlasciciel.grv === 'INFINITE' ? '∞' : Number(wlasciciel.grv).toLocaleString('pl-PL'))} GRV — nazwę zmienisz w każdej chwili, klucz i saldo zostają.</p>}
      <input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="Jak masz na imię? (np. Ania, Suweren Marek)" maxLength={40} className={pole} />
      {!wlasciciel && <input value={kod} onChange={(e) => setKod(e.target.value)} placeholder="Kod zaproszenia (opcjonalnie)" maxLength={40} className={`${pole} tracking-widest text-amber-200 focus:border-amber-500`} />}
      {blad && <p className="text-xs text-red-300">⚠ {blad}</p>}
      {info && <p className="text-xs text-emerald-300">{info}</p>}
      <button onClick={() => void (wlasciciel ? zmien() : zaloz())} disabled={praca || imie.trim().length < 2 || (!!wlasciciel && imie.trim() === wlasciciel.nazwa)}
        className="rounded border border-amber-500/50 bg-amber-950/40 px-4 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-900/50 disabled:opacity-40">
        {praca ? '…' : wlasciciel ? '✎ Zmień nazwę' : '🗝️ Załóż mój węzeł'}
      </button>
    </div>
  );
};

export default WezelWlasciciela;
