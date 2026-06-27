/**
 * ⚖️ Kancelaria 0.00G — Tarcza Prawna Suwerena (Filar II).
 *
 * Inspirowane otwartym systemem legal-AI: Katedra dostaje narzędzia do OCHRONY
 * własnej twórczości — suwerenna licencja z pieczęcią SHA-256, etapy praw sonicznych
 * i checklisty zgodności przed wystawieniem w Marketplace.
 *
 * ⚠ To NIE jest porada prawna — pomoc orientacyjna, lokalna, 0.00G.
 */
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import StraznikLicencji from './StraznikLicencji';

const WORK_TYPES = ['Muzyka', 'Wideo / Teledysk', 'Aplikacja / Kod', 'Tekst / Kronika', 'Grafika'];

async function sealSig(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return 'sig-niedostepny'; }
}

const CHECKLIST = [
  'Jestem twórcą Dzieła (lub mam pełne prawa).',
  'Dzieło nie zawiera cudzych sampli/fragmentów bez zgody.',
  'Dołączyłem Suwerenną Licencję 0.00G.',
  'Ustaliłem warunki obrotu w GRV (cena, remiks, royalties).',
  'Nie narusza etosu 0.00G ani praw osób trzecich.',
];

export const Kancelaria: React.FC = () => {
  const [work, setWork] = useState('');
  const [type, setType] = useState(WORK_TYPES[0]);
  const [author, setAuthor] = useState(() => { try { return localStorage.getItem('otakos_sovereign_name') || 'Mistrz Arkadiusz'; } catch { return 'Mistrz Arkadiusz'; } });
  const [license, setLicense] = useState('');
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));

  const generate = async () => {
    if (!work.trim()) { toast.error('Podaj nazwę Dzieła.'); return; }
    const date = new Date().toLocaleString('pl-PL');
    const body =
`LICENCJA SUWERENNA OtakOS 0.00G
═══════════════════════════════════════
Dzieło:  ${work.trim()}  (${type})
Autor / Suweren:  ${author.trim()}
Data:  ${date}
Wymiar:  0.00G (suwerenny, lokalny)

1. Autor zachowuje PEŁNIĘ praw do Dzieła.
2. Autor oświadcza, że jest twórcą Dzieła i nie narusza praw osób trzecich.
3. Dozwolone: użycie osobiste, remiks za zgodą Autora, obrót w ekosystemie GRV wg ustaleń Autora.
4. Zabronione: przypisywanie sobie autorstwa, usuwanie tej licencji, użycie sprzeczne z etosem 0.00G.
5. Ta licencja podróżuje z Dziełem. Spory rozstrzyga suwerenność Autora.`;
    const sig = await sealSig(body);
    const full = `${body}\n\nPieczęć (SHA-256): ${sig}\n═══════════════════════════════════════\n⚠ To nie jest porada prawna — dokument orientacyjny 0.00G.`;
    setLicense(full);
    toast.success('⚖️ Suwerenna Licencja wygenerowana + zapieczętowana.');
  };

  const copy = () => { navigator.clipboard?.writeText(license).then(() => toast.success('Skopiowano licencję.')); };
  const download = () => {
    const blob = new Blob([license], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `Licencja_${work.trim().replace(/\s+/g, '_') || 'Dzielo'}_0.00G.txt`; a.click();
    URL.revokeObjectURL(a.href);
  };

  const allChecked = checked.every(Boolean);

  return (
    <div className="rounded-2xl border border-indigo-500/25 bg-[#070612]/70 p-5 font-mono">
      <div className="mb-3">
        <div className="text-[10px] tracking-[0.3em] text-indigo-400/60">∴ FILAR II — TWÓRCZY ∴</div>
        <h3 className="text-lg font-bold text-indigo-300">⚖️ Kancelaria 0.00G — Tarcza Prawna</h3>
        <p className="text-[11px] text-zinc-400">Chroń swoją twórczość: suwerenna licencja z pieczęcią, etapy praw, checklisty przed Marketplace.</p>
      </div>

      {/* Disclaimer */}
      <div className="text-[10px] text-amber-300/80 bg-amber-950/20 border border-amber-500/25 rounded-lg px-3 py-2 mb-4">
        ⚠ To NIE jest porada prawna. Pomoc orientacyjna, lokalna (0.00G). Przy realnych sporach — żywy prawnik.
      </div>

      {/* Generator licencji */}
      <div className="rounded-xl border border-indigo-900/50 bg-black/30 p-3 mb-4">
        <div className="text-[11px] text-indigo-300/80 tracking-wider mb-2">📜 GENERATOR SUWERENNEJ LICENCJI</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <input value={work} onChange={e => setWork(e.target.value)} placeholder="Nazwa Dzieła"
            className="bg-black/40 border border-indigo-500/20 rounded px-2.5 py-1.5 text-xs text-indigo-100 outline-none focus:border-indigo-500" />
          <select value={type} onChange={e => setType(e.target.value)}
            className="bg-black/40 border border-indigo-500/20 rounded px-2.5 py-1.5 text-xs text-indigo-100 outline-none focus:border-indigo-500 cursor-pointer">
            {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Autor / Suweren"
          className="w-full bg-black/40 border border-indigo-500/20 rounded px-2.5 py-1.5 text-xs text-indigo-100 outline-none focus:border-indigo-500 mb-2" />
        <button onClick={generate}
          className="w-full py-2 rounded-lg border border-indigo-500/50 bg-indigo-950/40 text-indigo-300 text-xs font-bold hover:bg-indigo-900/50 transition-colors">
          ⚖️ Wygeneruj i zapieczętuj licencję
        </button>

        {license && (
          <div className="mt-3">
            <pre className="text-[10px] text-indigo-100/90 bg-black/50 border border-indigo-900/50 rounded-lg p-3 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">{license}</pre>
            <div className="flex gap-2 mt-2">
              <button onClick={copy} className="px-3 py-1 rounded border border-indigo-500/40 text-indigo-300 text-[11px] font-bold hover:bg-indigo-950/40">📋 Kopiuj</button>
              <button onClick={download} className="px-3 py-1 rounded border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-950/40">⬇ Pobierz .txt</button>
            </div>
          </div>
        )}
      </div>

      {/* Etapy praw sonicznych */}
      <div className="rounded-xl border border-indigo-900/50 bg-black/30 p-3 mb-4">
        <div className="text-[11px] text-indigo-300/80 tracking-wider mb-2">🎼 ETAPY PRAW (fale soniczne)</div>
        <div className="space-y-1.5 text-[11px]">
          <div className="text-cyan-300"><b>Etap 1 — teraz:</b> fale nie są otagowane. Twórz/używaj <b>swoje</b> utwory. Zbiór soniczny = paliwo.</div>
          <div className="text-purple-300"><b>Etap 2 — wkrótce:</b> tagowanie + licencje + royalties GRV. Prawa wlutowane w wektor.</div>
        </div>
      </div>

      {/* Checklist przed Marketplace */}
      <div className="rounded-xl border border-indigo-900/50 bg-black/30 p-3">
        <div className="text-[11px] text-indigo-300/80 tracking-wider mb-2">✅ ZGODNOŚĆ PRZED WYSTAWIENIEM W MARKETPLACE</div>
        <div className="space-y-1.5">
          {CHECKLIST.map((c, i) => (
            <label key={i} className="flex items-start gap-2 text-[11px] text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={checked[i]} onChange={e => setChecked(ch => ch.map((v, j) => j === i ? e.target.checked : v))}
                className="accent-indigo-500 mt-0.5 w-3.5 h-3.5" />
              {c}
            </label>
          ))}
        </div>
        <div className={`text-[11px] font-bold mt-2 ${allChecked ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {allChecked ? '✅ Gotowe do wystawienia — sumienie czyste.' : '… uzupełnij listę, by wystawić bezpiecznie.'}
        </div>
      </div>

      {/* 🛡️ Agent-limit licencji Unreal Engine (Game Forge) */}
      <StraznikLicencji />
    </div>
  );
};

export default Kancelaria;
