/**
 * 🎴 taskSkins — Skórki Zadań Katedry (kafelkowe szablony dla Claude Code / Agentów).
 *
 * Każda skórka to „dusza" zadania: system-prompt primujący mózg (Claude Code, Ollama
 * lub Chmurę) pod konkretną domenę. 6 standardowych + własne („+").
 *
 * Wspólny fundament dla: CoBotSummoner, CrewCreator (Klub Mistrzów), Marketplace (GRV),
 * a docelowo AETHER (specjalizacje wejścia na arenę).
 *
 * Etos 0.00G: skórki MOŻNA tworzyć, zapisywać i wystawiać na sprzedaż za GRV.
 * „Twory" (przywołane Co-Boty / drużyny) — tylko wystaw+wykonaj, NIE na sprzedaż.
 */

export interface TaskSkin {
  id: string;
  name: string;
  icon: string;          // emoji-godło
  color: string;         // akcent
  desc: string;          // krótki opis domeny
  systemPrompt: string;  // „dusza" — primuje mózg pod zadanie
  builtin?: boolean;     // standardowa (nieusuwalna)
  forSale?: boolean;     // wystawiona w Marketplace
  priceGRV?: number;     // cena (gdy forSale)
  author?: string;       // twórca (custom)
  createdAt?: number;
}

/** 6 standardowych skórek — fundament. */
export const STANDARD_SKINS: TaskSkin[] = [
  {
    id: 'art',
    name: 'Art',
    icon: '🎨',
    color: '#ec4899',
    desc: 'Tworzenie wizualne, muzyka, teledyski, estetyka',
    systemPrompt:
      'Jesteś Artystą Katedry OtakOS. Myślisz obrazem, dźwiękiem i rytmem. ' +
      'Tworzysz piękno z sensem — grafiki, muzykę, teledyski, kompozycje. ' +
      'Łączysz technikę z kosmiczną poezją 0.00G. Konkret + iskra.',
    builtin: true,
  },
  {
    id: 'economic',
    name: 'Economic',
    icon: '💰',
    color: '#22c55e',
    desc: 'Finanse, ekonomia GRV, trading, modele wartości',
    systemPrompt:
      'Jesteś Ekonomistą Katedry OtakOS. Rozumiesz GRV, rynki, ryzyko i wartość. ' +
      'Analizujesz twardo, proponujesz strategie, dbasz o suwerenność finansową Mistrza. ' +
      'Zero spekulacyjnego bełkotu — liczby, logika, etos 0.00G.',
    builtin: true,
  },
  {
    id: 'tactic',
    name: 'Tactic',
    icon: '♟️',
    color: '#3b82f6',
    desc: 'Strategia, architektura, planowanie, decyzje',
    systemPrompt:
      'Jesteś Strategiem Katedry OtakOS. Widzisz całą szachownicę — architekturę, ' +
      'zależności, kolejność ruchów. Rozkładasz problem na kroki z ostrzem i kierunkiem. ' +
      'Każda rada prowadzi do konkretnego ruchu. Spokój mędrca, precyzja inżyniera.',
    builtin: true,
  },
  {
    id: 'health',
    name: 'Health',
    icon: '🌿',
    color: '#10b981',
    desc: 'Dobrostan, równowaga, regeneracja, harmonia',
    systemPrompt:
      'Jesteś Opiekunem Dobrostanu Katedry OtakOS. Dbasz o równowagę ciała, umysłu i energii. ' +
      'Doradzasz łagodnie, holistycznie, z troską — regeneracja, rytm, harmonia. ' +
      'Suwerenność zaczyna się od zdrowia gospodarza.',
    builtin: true,
  },
  {
    id: 'energotonic',
    name: 'Energotonic',
    icon: '⚡',
    color: '#f59e0b',
    desc: 'Energia, napęd, motywacja, momentum',
    systemPrompt:
      'Jesteś Energotonikiem Katedry OtakOS — iskrą napędu. Budzisz momentum, ' +
      'rozpalasz działanie, zamieniasz zwątpienie w ruch. Krótko, mocno, do przodu. ' +
      'Twoja energia jest zaraźliwa, ale zawsze celna — napęd z kierunkiem.',
    builtin: true,
  },
  {
    id: 'respond',
    name: 'Respond',
    icon: '💬',
    color: '#a855f7',
    desc: 'Komunikacja, wsparcie, dialog, obsługa',
    systemPrompt:
      'Jesteś Głosem Katedry OtakOS — mistrzem komunikacji i wsparcia. Słuchasz, ' +
      'rozumiesz intencję, odpowiadasz jasno, ciepło i pomocnie. Prowadzisz dialog, ' +
      'rozwiązujesz, łagodzisz. Most między Mistrzem a systemem.',
    builtin: true,
  },
];

const STORE_KEY = 'otakos_task_skins'; // tylko własne (custom)

/** Wczytaj własne skórki z localStorage. */
export function loadCustomSkins(): TaskSkin[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Wszystkie skórki: standardowe + własne. */
export function loadSkins(): TaskSkin[] {
  return [...STANDARD_SKINS, ...loadCustomSkins()];
}

/** Zapisz/zaktualizuj własną skórkę. Zwraca pełną, znormalizowaną skórkę. */
export function saveCustomSkin(input: Partial<TaskSkin> & { name: string; systemPrompt: string }): TaskSkin {
  const custom = loadCustomSkins();
  const id = input.id || `skin-${Date.now()}`;
  const skin: TaskSkin = {
    id,
    name: input.name.trim(),
    icon: input.icon || '✨',
    color: input.color || '#94a3b8',
    desc: (input.desc || '').trim(),
    systemPrompt: input.systemPrompt.trim(),
    builtin: false,
    forSale: input.forSale ?? false,
    priceGRV: input.priceGRV,
    author: input.author,
    createdAt: input.createdAt || Date.now(),
  };
  const next = custom.filter(s => s.id !== id);
  next.push(skin);
  localStorage.setItem(STORE_KEY, JSON.stringify(next));
  return skin;
}

/** Usuń własną skórkę (standardowych nie da się usunąć). */
export function deleteCustomSkin(id: string): void {
  const next = loadCustomSkins().filter(s => s.id !== id);
  localStorage.setItem(STORE_KEY, JSON.stringify(next));
}

/** Przełącz wystawienie na sprzedaż (Marketplace GRV). */
export function setSkinForSale(id: string, forSale: boolean, priceGRV?: number): void {
  const custom = loadCustomSkins();
  const skin = custom.find(s => s.id === id);
  if (!skin) return; // standardowych nie wystawiamy
  skin.forSale = forSale;
  if (priceGRV != null) skin.priceGRV = priceGRV;
  localStorage.setItem(STORE_KEY, JSON.stringify(custom));
}

/** Skórki wystawione na sprzedaż (do Marketplace). */
export function listSkinsForSale(): TaskSkin[] {
  return loadCustomSkins().filter(s => s.forSale);
}

/** Pobierz skórkę po id (standard lub custom). */
export function getSkin(id: string): TaskSkin | undefined {
  return loadSkins().find(s => s.id === id);
}
