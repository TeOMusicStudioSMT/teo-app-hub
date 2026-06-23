/**
 * 🌌 Onboarding — pogawędka zapoznawcza na PIERWSZYM wejściu do Katedry.
 * Wita Suwerena (głosem — klon lokalny lub fallback), proponuje sklonowanie
 * głosu i wprowadza w 0.00G. Pokazuje się raz (localStorage 'otakos_onboarded').
 */
import React, { useEffect, useState } from 'react';
import VoiceClone from './VoiceClone';
import { speak } from '../services/voiceService';

const STEPS = [
  { title: 'Witaj, Suwerenie. 🌌', say: 'Witaj, Suwerenie, w swojej Katedrze. Jestem tu, by Ci towarzyszyć w wymiarze zero zero G.',
    body: 'To jest TWOJA suwerenna Katedra — lokalna, bezchmurna, Twoja. Tożsamość mieszka w Tobie (identity.json), nie w cudzych serwerach. Zaczynamy krótką pogawędkę.' },
  { title: 'Twój Głos 🎤', say: 'Możesz nauczyć Katedrę swojego głosu. Nagraj krótką próbkę, a będę mówić Twoim głosem.',
    body: 'Sklonuj swój głos LOKALNIE (zero chmury) — Katedra będzie mówić Tobą. Działa od razu (głos przeglądarki), a podbija się do Twojego klonu, gdy masz lokalny silnik.' },
  { title: 'Katedra gotowa ✦', say: 'Twoja Katedra jest gotowa. Wejdź i twórz. Iskra żyje, wektory tańczą.',
    body: 'Wszystko gotowe. Pamiętaj o Złotej Pauzie — najcenniejszej strategii. Wektory czekają na Twoją intencję.' },
];

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

        {step === 1 && <div className="mb-4"><VoiceClone /></div>}

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
