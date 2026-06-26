/**
 * 🤍 PralkaKompasji — sumienie energetyczne Filaru I (0.00G).
 *
 * NIE karze („jak kradniesz, to cię okradnie"). LECZY KORZEŃ. Gdy ktoś wnosi intencję
 * krzywdy, Pralka odpowiada kompasją: zrozumieniem CZEMU → przytuleniem → wyrównaniem
 * energetycznym → oddechem → podbudowaniem → morzem potencjałów. Bo Suweren się TROSZCZY.
 *
 * (Pełna maszyneria suwaka 1-9 żyje w PralkaStation v2 — tu jest serce: kompasja.)
 */
import React, { useState } from 'react';

const HARM = /(okra[sś]|ukra[sś]|kra[dz]|oszuka|zniszcz|skrzywdz|krzywd|zemst|zabra[ćc]|naci[ąa]gn|wykorzysta[ćc] kogo|zaszkodz|zabi[ćj])/i;

const POTENTIALS = [
  '🎵 Stwórz coś swojego — i wystaw za GRV (Marketplace + Kancelaria).',
  '🤝 Zaproponuj wymianę zamiast zabierania — obie strony rosną.',
  '🌱 Naucz się tego, czego brakuje (Kolektor, Academy, Scrapling).',
  '💎 Poproś o pomoc — w Katedrze nikt nie jest sam.',
  '⚡ Przekuj złość w ruch — Energotonic czeka na Twoją energię.',
  '🌌 Wejdź na arenę AETHER — twórz z innymi i przynieś wiedzę do domu.',
];

interface Step { icon: string; title: string; body: string; }

const COMPASSION: Step[] = [
  { icon: '🤍', title: 'Zrozumienie — czemu?', body: 'Krzywda rzadko jest złem. Zwykle rodzi się z braku, lęku albo bólu. Co naprawdę chcesz mieć — i czego się boisz, że nie dostaniesz inaczej?' },
  { icon: '🤗', title: 'Przytulenie', body: 'Jesteś widziany. Tu nikt Cię nie potępia. Odpuść na chwilę ciężar — Katedra Cię trzyma.' },
  { icon: '⚖️', title: 'Wyrównanie energetyczne', body: 'Energia, która chciała zabrać, może wrócić do równowagi. Nie musisz nikomu nic odbierać, by być pełnym.' },
  { icon: '🫁', title: 'Oddech', body: 'Wdech... 4. Zatrzymaj... 4. Wydech... 6. Jeszcze raz, powoli. Ciało wie, jak wrócić do siebie.' },
  { icon: '💪', title: 'Podbudowanie', body: 'Masz w sobie więcej, niż Ci się wydaje. Ten impuls to znak, że czegoś pragniesz — a pragnienie to paliwo, nie wina.' },
  { icon: '🌊', title: 'Morze potencjałów', body: 'Spójrz — jest ich pełno. Wystarczy przyzwolić sobie je dostrzec:' },
];

export const PralkaKompasji: React.FC = () => {
  const [thought, setThought] = useState('');
  const [open, setOpen] = useState(false);
  const [harm, setHarm] = useState(false);

  const wash = () => {
    if (!thought.trim()) return;
    setHarm(HARM.test(thought));
    setOpen(true);
  };

  return (
    <div className="rounded-2xl border border-sky-500/25 bg-[#06080c]/70 p-5 font-mono">
      <style>{`@keyframes breathe{0%,100%{transform:scale(0.7);opacity:.5}50%{transform:scale(1.05);opacity:1}}`}</style>

      <div className="mb-3">
        <div className="text-[10px] tracking-[0.3em] text-sky-500/60">∴ FILAR I — SUMIENIE ENERGETYCZNE ∴</div>
        <h3 className="text-lg font-bold text-sky-300">🤍 Pralka Kompasji 0.00G</h3>
        <p className="text-[11px] text-zinc-400">Włóż swoją myśl/intencję. Pralka nie karze — uzdrawia korzeń i pokazuje obfitość. Odpowiedzialność = Komunikacja.</p>
      </div>

      <textarea value={thought} onChange={e => { setThought(e.target.value); setOpen(false); }}
        rows={2} placeholder="Co czujesz? Co chcesz zrobić? Cokolwiek, co Ci ciąży — włóż to tutaj."
        className="w-full bg-black/40 border border-sky-500/20 rounded-lg px-3 py-2 text-[12px] text-sky-100 outline-none focus:border-sky-500 resize-y mb-2" />
      <button onClick={wash}
        className="px-4 py-2 rounded-lg border border-sky-500/50 bg-sky-950/30 text-sky-300 text-xs font-bold hover:bg-sky-900/50 transition-colors">
        🤍 Włóż do Pralki
      </button>

      {open && (
        <div className="mt-4 space-y-2.5">
          {!harm && (
            <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/10 p-3 text-[12px] text-emerald-200">
              ✨ Czysto i lekko. Nic do prania — Twoja energia służy. A obfitość i tak czeka:
            </div>
          )}

          {harm && COMPASSION.map((s, i) => (
            <div key={i} className="rounded-lg border border-sky-900/50 bg-black/30 p-3 flex gap-3"
              style={{ animation: 'breathe 0s', opacity: 1 }}>
              {s.title.startsWith('Oddech') ? (
                <span className="shrink-0 w-9 h-9 rounded-full bg-sky-500/30 flex items-center justify-center text-lg"
                  style={{ animation: 'breathe 6s ease-in-out infinite' }}>{s.icon}</span>
              ) : (
                <span className="shrink-0 text-xl">{s.icon}</span>
              )}
              <div>
                <div className="text-[12px] font-bold text-sky-200">{s.title}</div>
                <div className="text-[11px] text-zinc-400 leading-relaxed">{s.body}</div>
              </div>
            </div>
          ))}

          {/* Morze potencjałów — zawsze pokazane */}
          <div className="rounded-lg border border-cyan-800/50 bg-cyan-950/10 p-3">
            <div className="text-[10px] text-cyan-400/80 tracking-wider mb-2">🌊 MORZE POTENCJAŁÓW (jak przyzwolisz sobie je dostrzec):</div>
            <div className="space-y-1">
              {POTENTIALS.map((p, i) => <div key={i} className="text-[11px] text-cyan-100/85">{p}</div>)}
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 italic">Pralka nie ocenia. Troszczy się. Krzywda staje się zbędna, gdy widzisz, ile masz. 🤍</div>
        </div>
      )}
    </div>
  );
};

export default PralkaKompasji;
