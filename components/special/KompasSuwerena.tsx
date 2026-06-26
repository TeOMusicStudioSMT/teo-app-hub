/**
 * 🧭 KompasSuwerena — mapa gry Odkrywania (Filar I — dla wszystkich).
 *
 * Pokazuje, GDZIE jesteś na drodze od Karmy do Miłości 2.0 i co prowadzi dalej.
 * „Nie wspinasz się po uprawnienia — wspinasz się ku Miłości 2.0."
 */
import React, { useEffect, useState } from 'react';
import { currentTier, TIERS } from '../../lib/tiers';
import { currentRole } from '../../lib/roles';

const BRIDGE = 'http://127.0.0.1:3001';

const ESSENCE: Record<string, { law: string; note: string }> = {
  poznawczy:    { law: 'Karma uczy',     note: 'Zbierasz, słuchasz, Pralka Kompasji leczy korzeń. Energia wraca do równowagi.' },
  tworczy:      { law: 'Przejście',      note: 'Tworzysz z zebranych wektorów. Karma cichnie, komunikacja dojrzewa.' },
  mistrzowski:  { law: 'Miłość 2.0',     note: 'Czysta komunikacja, mądrość, radość, Przygoda. Bez karmy — energia po prostu służy.' },
};

export const KompasSuwerena: React.FC = () => {
  const tier = currentTier();
  const role = currentRole();
  const [grv, setGrv] = useState<{ balance: any; ok: boolean | null }>({ balance: null, ok: null });

  useEffect(() => {
    (async () => {
      try {
        const b = await (await fetch(`${BRIDGE}/api/grv/${encodeURIComponent(role?.sovereignName || 'Mistrz Arkadiusz')}`)).json();
        const v = await (await fetch(`${BRIDGE}/api/grv/verify`)).json();
        setGrv({ balance: b?.success ? b.grv : null, ok: v?.success ? v.ok : null });
      } catch { /* most offline */ }
    })();
  }, [role]);

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-[#07060d]/75 p-5 font-mono">
      <div className="mb-4">
        <div className="text-[10px] tracking-[0.3em] text-violet-400/60">∴ GRA ODKRYWANIA ∴</div>
        <h3 className="text-lg font-bold text-violet-200">🧭 Kompas Suwerena</h3>
        <p className="text-[11px] text-zinc-400">Gdzie jesteś na drodze od Karmy do Miłości 2.0 — i dokąd prowadzi dalej.</p>
      </div>

      {/* Twój stan */}
      <div className="flex flex-wrap gap-2 mb-4 text-[10px] font-mono">
        {role && <span className="px-2.5 py-1 rounded-full border border-amber-600/40 bg-amber-950/20 text-amber-300">🔑 {role.label}</span>}
        <span className="px-2.5 py-1 rounded-full border" style={{ borderColor: `${tier.color}55`, background: `${tier.color}14`, color: tier.color }}>🏛️ {tier.title.pl}</span>
        {grv.balance !== null && <span className="px-2.5 py-1 rounded-full border border-amber-600/40 bg-amber-950/20 text-amber-300">💎 {grv.balance === 'INFINITE' ? '∞' : Number(grv.balance).toLocaleString('pl-PL')} GRV</span>}
        {grv.ok !== null && <span className={`px-2.5 py-1 rounded-full border ${grv.ok ? 'border-emerald-600/40 text-emerald-300' : 'border-rose-600/40 text-rose-300'}`}>⛓️ księga {grv.ok ? 'OK' : '⚠'}</span>}
      </div>

      {/* Droga przez Filary */}
      <div className="space-y-2">
        {TIERS.map((t, i) => {
          const here = t.id === tier.id;
          const passed = TIERS.findIndex(x => x.id === tier.id) > i;
          const e = ESSENCE[t.id];
          return (
            <div key={t.id} className="flex items-stretch gap-3 rounded-xl border p-3 transition-colors"
              style={{ borderColor: here ? t.color : 'rgba(255,255,255,.08)', background: here ? `${t.color}12` : 'rgba(0,0,0,.25)' }}>
              <div className="flex flex-col items-center justify-center w-8 shrink-0">
                <span style={{ fontSize: 18, opacity: passed || here ? 1 : 0.4 }}>{passed ? '✓' : here ? '◉' : '○'}</span>
                {i < TIERS.length - 1 && <span className="text-zinc-700 text-xs">│</span>}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-bold" style={{ color: here ? t.color : '#cbd5e1' }}>{t.name.pl} · {t.title.pl}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${t.color}1f`, color: t.color }}>{e.law}</span>
                  {here && <span className="text-[9px] text-violet-300">← jesteś tu</span>}
                </div>
                <div className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">{e.note}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Busola */}
      <div className="mt-4 text-center text-[11px] text-violet-200/80 italic leading-relaxed">
        Nie wspinasz się po uprawnienia — <b className="text-violet-300">wspinasz się ku Miłości 2.0</b>.<br />
        <span className="text-zinc-500">Energia służy, nie panuje. Odpowiedzialność = Komunikacja.</span>
      </div>
    </div>
  );
};

export default KompasSuwerena;
