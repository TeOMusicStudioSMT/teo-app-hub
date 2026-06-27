/**
 * 🔀 modelRouter — Live Model Routing: dobiera model do ZADANIA.
 *
 * Różne rzeczy w świecie/forge wołają różne mózgi: glm→design, gemma4:31b/cloud→ciężkie
 * rozumowanie, coder→kod, małe (1b/2b)→drobne i szybkie. Tryb AUTO przełącza model
 * wg wybranego trybu zadania. 0.00G — lokalnie, na modelach z Ollamy.
 */

export interface TaskMode {
  id: string; label: string; icon: string; desc: string;
  match: RegExp[]; // preferencje (kolejność = priorytet), dopasowane do dostępnych modeli
}

export const TASK_MODES: TaskMode[] = [
  { id: 'design', label: 'Design / Świat', icon: '🎨', desc: 'Projekt świata, sceny, estetyka', match: [/glm/i, /gemma4/i, /gemma/i] },
  { id: 'heavy',  label: 'Ciężkie myślenie', icon: '🧠', desc: 'Architektura, strategia, rozumowanie', match: [/31b|cloud|70b|large/i, /glm/i, /gemma4/i] },
  { id: 'code',   label: 'Kod / Logika',   icon: '💻', desc: 'Skrypty gry, logika, naprawy', match: [/coder|qwen/i, /glm/i, /gemma4/i] },
  { id: 'fast',   label: 'Szybkie / Proste', icon: '⚡', desc: 'Drobne rzeczy, niska latencja', match: [/(^|[:\-])(1b|2b|3b)|mini|small|tiny|gemma3/i, /gemma/i] },
  { id: 'chat',   label: 'Rozmowa',        icon: '💬', desc: 'Dialog, towarzyszenie', match: [/gemma4/i, /gemma/i] },
];

/** Dobierz najlepszy DOSTĘPNY model dla trybu zadania. */
export function pickModelForTask(taskId: string, available: string[]): string | null {
  const mode = TASK_MODES.find(m => m.id === taskId);
  if (!mode || !available.length) return null;
  for (const re of mode.match) {
    const hit = available.find(m => re.test(m));
    if (hit) return hit;
  }
  return available[0];
}

const KEY = 'otakos_active_model';
const AUTO_KEY = 'otakos_model_auto';

export function getActiveModel(): string {
  try { return localStorage.getItem(KEY) || 'gemma4'; } catch { return 'gemma4'; }
}
export function setActiveModel(m: string): void {
  try { localStorage.setItem(KEY, m); window.dispatchEvent(new CustomEvent('otakos-model-changed', { detail: m })); } catch { /* noop */ }
}
export function isAuto(): boolean {
  try { return localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; }
}
export function setAuto(v: boolean): void {
  try { localStorage.setItem(AUTO_KEY, v ? '1' : '0'); } catch { /* noop */ }
}

/** Świat/forge woła to, gdy zmienia się rodzaj pracy (gdy AUTO ON → przełącza model). */
export function routeForTask(taskId: string, available: string[]): string | null {
  if (!isAuto()) return getActiveModel();
  const m = pickModelForTask(taskId, available);
  if (m) setActiveModel(m);
  return m;
}
