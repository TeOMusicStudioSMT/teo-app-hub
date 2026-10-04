/**
 * 🌌 Onboarding — pogawędka zapoznawcza na PIERWSZYM wejściu do Katedry.
 * Wita Suwerena (głosem — klon lokalny lub fallback), proponuje sklonowanie
 * głosu i wprowadza w 0.00G. Pokazuje się raz (localStorage 'otakos_onboarded').
 *
 * 🗝️ Krok „Twój węzeł w księdze GRV” (2026-10-04): imię węzła + opcjonalny kod zaproszenia → POST /api/grv/register.
 * Z kodem (services/KodZaproszenia.js) węzeł startuje z 12 345 GRV zamiast 1000. Zły kod nic nie zakłada — można
 * poprawić literówkę. Krok da się pominąć; imię trafia do localStorage 'otakos_sovereign_name'.
 */
import React, { useEffect, useState } from 'react';
import VoiceClone from './VoiceClone';
import { speak } from '../services/voiceService';

const STEPS = [
  { title: 'Witaj, Suwerenie. 🌌', say: 'Witaj, Suwerenie, w swojej Katedrze. Jestem tu, by Ci towarzyszyć w wymiarze zero zero G.',
    body: 'To jest TWOJA suwerenna Katedra — lokalna, bezchmurna, Twoja. Tożsamość mieszka w Tobie (identity.json), nie w cudzych serwerach. Zaczynamy krótką pogawędkę.' },
  { title: 'Twój węzeł w księdze GRV 🗝️', say: 'Nazwij swój węzeł w księdze GRV. Jeśli masz kod zaproszenia, wpisz go teraz.',
    body: 'Każda Katedra ma własną, lokalną księgę GRV. Nazwij swój węzeł — nowy węzeł dostaje 1000 GRV, a z kodem zaproszenia więcej. Kod działa tylko teraz, przy zakładaniu węzła.' },
  { title: 'Twój Głos 🎤', say: 'Możesz nauczyć Katedrę swojego głosu. Nagraj krótką próbkę, a będę mówić Twoim głosem.',
    body: 'Sklonuj swój głos LOKALNIE (zero chmury) — Katedra będzie mówić Tobą. Działa od razu (głos przeglądarki), a podbija się do Twojego klonu, gdy masz lokalny silnik.' },
  { title: 'Katedra gotowa ✦', say: 'Twoja Katedra jest gotowa. Wejdź i twórz. Iskra żyje, wektory tańczą.',
    body: 'Wszystko gotowe. Pamiętaj o Złotej Pauzie — najcenniejszej strategii. Wektory czekają na Twoją intencję.' },
];

const MOST = 'http://127.0.0.1:3001';

/** Imię węzła + kod zaproszenia → wpis w księdze GRV tej Katedry. */
const WezelGrv: React.FC = () => {
  const [imie, setImie] = useState(() => { try { return localStorage.getItem('otakos_sovereign_name') || ''; } catch { return ''; } });
  const [kod, setKod] = useState('');
  const [praca, setPraca] = useState(false);
  const [wynik, setWynik] = useState<{ id: string; grv: number | string; kod?: string; existed?: boolean } | null>(null);
  const [blad, setBlad] = useState('');
  const zapisz = async () => {
    setPraca(true); setBlad('');
    try {
      const r = await fetch(`${MOST}/api/grv/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: imie.trim(), kod: kod.trim() || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) throw new Error(d.message || `Most odpowiedział HTTP ${r.status}`);
      setWynik(d);
      try { localStorage.setItem('otakos_sovereign_name', d.id); } catch { /* noop */ }
    } catch (e) { setBlad(e instanceof Error ? e.message : String(e)); } finally { setPraca(false); }
  };
  if (wynik) {
    return (
      <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
        {wynik.existed
          ? <>Węzeł „{wynik.id}” już jest w księdze — saldo: <b>{String(wynik.grv)}</b> GRV (kod działa tylko przy nowym węźle).</>
          : <>✓ Węzeł „{wynik.id}” założony: <b>{Number(wynik.grv).toLocaleString('pl-PL')}</b> GRV{wynik.kod ? ' — z kodem zaproszenia 🗝️' : ''}.</>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <input value={imie} onChange={e => setImie(e.target.value)} placeholder="Imię Twojego węzła (np. Suweren Ania)" maxLength={40}
        className="w-full rounded border border-zinc-700 bg-black/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
      <input value={kod} onChange={e => setKod(e.target.value)} placeholder="Kod zaproszenia (opcjonalnie)" maxLength={40}
        className="w-full rounded border border-zinc-700 bg-black/60 px-3 py-2 text-sm tracking-widest text-amber-200 outline-none focus:border-amber-500" />
      {blad && <p className="text-xs text-red-300">⚠ {blad}</p>}
      <button onClick={() => void zapisz()} disabled={praca || imie.trim().length < 2}
        className="rounded border border-amber-500/50 bg-amber-950/40 px-4 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-900/50 disabled:opacity-40">
        {praca ? '…' : '🗝️ Załóż węzeł'}
      </button>
    </div>
  );
};

export const Onboarding: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const s = STEPS[step];

  useEffect(() => { speak(s.say).catch(() => {}); /* eslint-disable-next-line */ }, [step]);

  const finish = () => { try { localStorage.setItem('otakos_onboarded', '1'); } catch {} onDone(); };
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="max-w-lg w-full rounded-2xl border border-emerald-500/30 bg-[#05080d]/95 p-6 shadow-[0_0_60px_rgba(16,185,129,0.2)] font-mono">
        <div className="flex justify-between items-center mb-3">
          <div className="text-[10px] tracking-[0.3em] text-emerald-500/60">∴ PIERWSZE WEJŚCIE · 0.00G ∴</div>
          <button onClick={finish} className="text-zinc-500 hover:text-white text-xs">pomiń →</button>
        </div>

        <h2 className="text-2xl font-bold text-emerald-300 mb-2">{s.title}</h2>
        <p className="text-sm text-zinc-300 leading-relaxed mb-4">{s.body}</p>

        {step === 1 && <div className="mb-4"><WezelGrv /></div>}
        {step === 2 && <div className="mb-4"><VoiceClone /></div>}

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => speak(s.say)} title="Powtórz głosem"
              className="px-3 py-1.5 rounded border border-fuchsia-500/40 text-fuchsia-300 text-xs hover:bg-fuchsia-950/40">🔊</button>
            <button onClick={next}
              className="px-5 py-1.5 rounded border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 text-xs font-bold hover:bg-emerald-900/50">
              {step < STEPS.length - 1 ? 'Dalej →' : '✦ WEJDŹ DO KATEDRY'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
