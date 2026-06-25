/**
 * 🪞 AntiMatrixMirror — Złote Taco / Anty-Lustro Matrixa (Tarcza Prywatności 0.00G).
 *
 * Matrix buduje Twoje „lustro" (Device/Household Graph, odcisk behawioralny, GPS,
 * dwell time, ko-lokacja). Tej grafu z przeglądarki NIE przechwycimy (to poziom
 * routera/ad-sieci) — i mówimy to wprost. Co Katedra REALNIE umie:
 *   1) pokazać co widać (audyt),
 *   2) wyczyścić lokalne ślady w tej przeglądarce (cookies/session/obce localStorage),
 *   3) wygenerować WABIK — szum profilujący („niech coś mają": Złote Taco).
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

const VECTORS = [
  { icon: '📱', name: 'Graf Urządzeń', desc: 'Smartfon + laptop + Smart TV → jeden profil.' },
  { icon: '🏠', name: 'Graf Gospodarstwa', desc: 'Wszyscy pod tym samym IP/Wi-Fi = jeden „klaster".' },
  { icon: '🫆', name: 'Odcisk Behawioralny', desc: 'Historia wyszukiwań + GPS + mikroruchy = unikalne ID.' },
  { icon: '📍', name: 'Lokalizacja GPS', desc: 'Odwiedzane sklepy, spotkania, nawyki.' },
  { icon: '⏱️', name: 'Dwell Time', desc: 'Poziom zainteresowania treścią — bez kliknięcia.' },
  { icon: '🔗', name: 'Ko-lokacja', desc: 'Bliskość urządzeń przez Bluetooth/Wi-Fi → „zakażenie" intencją.' },
];

// 🌮 Wabik — absurdalne intencje, którymi karmimy profilera.
const DECOY_POOL = [
  'Złote tacos w stratosferze — dostawa dronem',
  'Hodowla chmur dla kucyków (kurs online)',
  'Skarpetki kwantowe, rozmiar ∞',
  'Medytacja z tosterem — retreat 7 dni',
  'Akcje kopalni jednorożców (IPO)',
  'Teleportacja dla kotów — abonament',
  'Farba świecąca w podczerwieni dla ślimaków',
  'Lekcje tańca dla pralek automatycznych',
  'Sól himalajska do ładowania baterii',
  'Wynajem mgły na wesela',
  'Parasol antygrawitacyjny 0.00G',
  'Kanapki z dźwiękiem — edycja kolekcjonerska',
];

const PROTECT = ['otakos', 'teo', 'aether', 'inkubator', 'grv', 'kronika', 'wallet', 'identity', 'market'];
const isProtected = (k: string) => PROTECT.some(p => k.toLowerCase().includes(p));

// ── 🤖 Agenci Szumu: Generator składa frazy, Kontroler ocenia. Czasem leży diament. ──
const OFFERS = ['Wynajem', 'Subskrypcja', 'Kurs', 'Hodowla', 'Dostawa', 'Abonament', 'Warsztaty', 'Aukcja', 'Coaching', 'Naprawa'];
const ABSURD = ['chmur dla kucyków', 'kwantowych skarpetek', 'mgły na wesela', 'snów na zamówienie', 'ciszy w słoiku', 'tęczy dla kretów', 'echa z jaskini', 'cieni do wynajęcia', 'grawitacji na raty'];
// Ziarna „realne" — gdy Generator po nie sięgnie, Kontroler znajduje DIAMENT.
const SEEDS_REAL = ['lokalnego studia muzycznego 0.00G', 'kursu suwerennego AI offline', 'archiwizacji rodzinnych nagrań', 'warsztatów montażu teledysków', 'hostingu bez chmury', 'naprawy starego sprzętu audio'];
const TWISTS = ['— dostawa dronem', '— edycja 0.00G', '— tylko dziś', '— pakiet rodzinny', '— z gwarancją kosmiczną', ''];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

interface NoiseItem { phrase: string; gem: boolean; verdict: string; }

function generateNoise(n = 6): NoiseItem[] {
  const out: NoiseItem[] = [];
  for (let i = 0; i < n; i++) {
    const gem = Math.random() < 0.22; // ~1 na 5 to ziarno realne
    const core = gem ? pick(SEEDS_REAL) : pick(ABSURD);
    const phrase = `${pick(OFFERS)} ${core} ${pick(TWISTS)}`.trim();
    // Kontroler ocenia:
    const verdict = gem
      ? '💎 Kontroler: „To nie szum — to realny pomysł. Zachowaj!"'
      : pick(['🗑️ Kontroler: czysty absurd, idealny wabik.', '🗑️ Kontroler: Matrix to schrupie, brawo.', '🗑️ Kontroler: bezużyteczne dla śledzących — czyli idealne.']);
    out.push({ phrase, gem, verdict });
  }
  return out;
}

export const AntiMatrixMirror: React.FC = () => {
  const [cleared, setCleared] = useState<number | null>(null);
  const [decoys, setDecoys] = useState<string[]>([]);
  const [noise, setNoise] = useState<NoiseItem[]>([]);

  const cleanTrace = () => {
    let n = 0;
    try {
      // Cookies (same-origin, nie-httpOnly)
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0].trim();
        if (name) { document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`; n++; }
      });
      // sessionStorage
      n += sessionStorage.length; sessionStorage.clear();
      // localStorage — tylko OBCE klucze (suwerenne dane OtakOS zostają!)
      Object.keys(localStorage).forEach(k => { if (!isProtected(k)) { localStorage.removeItem(k); n++; } });
    } catch { /* przeglądarka ograniczyła — częściowo */ }
    setCleared(n);
    toast.success(`🧹 Wyczyszczono ${n} lokalnych śladów (dane OtakOS nietknięte).`);
  };

  const brewTaco = () => {
    const shuffled = [...DECOY_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
    setDecoys(shuffled);
    toast('🌮 Złote Taco upieczone — wabik gotowy.', { icon: '🌮' });
  };

  const runAgents = () => {
    const items = generateNoise(6);
    setNoise(items);
    const gems = items.filter(i => i.gem).length;
    toast(gems > 0 ? `💎 Kontroler znalazł ${gems} diament(y) w szumie!` : '🤖 Agenci wygenerowali świeży szum.', { icon: gems > 0 ? '💎' : '🤖' });
  };

  return (
    <div className="rounded-2xl border border-fuchsia-500/25 bg-[#0a0410]/70 p-5 font-mono">
      <div className="mb-3">
        <div className="text-[10px] tracking-[0.3em] text-fuchsia-500/60">∴ TARCZA PRYWATNOŚCI 0.00G ∴</div>
        <h3 className="text-lg font-bold text-fuchsia-300">🪞 Anty-Lustro Matrixa <span className="text-amber-300">· 🌮 Złote Taco</span></h3>
        <p className="text-[11px] text-zinc-400">Matrix już buduje Twoje lustro. Czyścimy ślad i karmimy sieć wabikiem — „niech coś mają".</p>
      </div>

      {/* Uczciwa granica */}
      <div className="text-[10px] text-amber-300/80 bg-amber-950/20 border border-amber-500/25 rounded-lg px-3 py-2 mb-4 leading-relaxed">
        ⚠ Uczciwie: grafu gospodarstwa/urządzeń (poziom routera i ad-sieci) z przeglądarki NIE przechwycimy.
        Realnie działa: audyt poniżej, czyszczenie lokalnych śladów i generator wabika.
      </div>

      {/* Co widzi Matrix */}
      <div className="text-[11px] text-fuchsia-300/80 tracking-wider mb-2">CO WIDZI MATRIX (Graf):</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {VECTORS.map(v => (
          <div key={v.name} className="flex items-start gap-2 rounded-lg border border-zinc-800/70 bg-black/30 p-2.5">
            <span className="text-base">{v.icon}</span>
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-zinc-200">{v.name}</div>
              <div className="text-[10px] text-zinc-400 leading-snug">{v.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Akcje */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={cleanTrace}
          className="px-4 py-2 rounded-lg border border-cyan-500/50 bg-cyan-950/30 text-cyan-300 text-xs font-bold hover:bg-cyan-900/50 transition-colors">
          🧹 Wyczyść ślad {cleared !== null && <span className="text-cyan-500/70">({cleared})</span>}
        </button>
        <button onClick={brewTaco}
          className="px-4 py-2 rounded-lg border border-amber-500/50 bg-amber-950/30 text-amber-300 text-xs font-bold hover:bg-amber-900/50 transition-colors">
          🌮 Upiecz Złote Taco (wabik)
        </button>
        <button onClick={runAgents}
          className="px-4 py-2 rounded-lg border border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-300 text-xs font-bold hover:bg-fuchsia-900/50 transition-colors">
          🤖 Wpuść Agentów (Generator + Kontroler)
        </button>
      </div>

      {/* Wabik */}
      {decoys.length > 0 && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/10 p-3">
          <div className="text-[10px] text-amber-400/80 tracking-wider mb-2">🌮 WABIK DLA SIECI — „niech coś mają":</div>
          <div className="space-y-1">
            {decoys.map((d, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="text-[11px] text-amber-200/90 flex items-center gap-2">
                <span className="text-amber-500">🔍</span> {d}
              </motion.div>
            ))}
          </div>
          <div className="text-[9px] text-zinc-500 mt-2 italic">
            Wabik wygenerowany lokalnie. Pełne zaśmiecanie profilu wymaga wpięcia w ruch tła (roadmap) — tu masz gotowy ładunek absurdu. 🌮
          </div>
        </div>
      )}

      {/* 🤖 Agenci Szumu — Generator + Kontroler */}
      {noise.length > 0 && (
        <div className="mt-3 rounded-lg border border-fuchsia-900/50 bg-fuchsia-950/10 p-3">
          <div className="text-[10px] text-fuchsia-400/80 tracking-wider mb-2">🤖 AGENCI SZUMU — Generator składa, Kontroler ocenia:</div>
          <div className="space-y-1.5">
            {noise.map((it, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className={`rounded px-2.5 py-1.5 border ${it.gem ? 'border-amber-400/50 bg-amber-950/20' : 'border-zinc-800/70 bg-black/30'}`}>
                <div className={`text-[12px] ${it.gem ? 'text-amber-200 font-bold' : 'text-zinc-300'}`}>
                  {it.gem ? '💎' : '🗑️'} {it.phrase}
                </div>
                <div className={`text-[10px] mt-0.5 ${it.gem ? 'text-amber-300/80' : 'text-zinc-500 italic'}`}>{it.verdict}</div>
              </motion.div>
            ))}
          </div>
          {noise.some(i => i.gem) && (
            <div className="text-[10px] text-amber-400/80 mt-2 italic">💎 Diamenty zachowaj — z zabawy w szum rodzi się czasem realny pomysł.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AntiMatrixMirror;
