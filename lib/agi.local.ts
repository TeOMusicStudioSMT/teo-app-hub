/**
 * 🧠 agi.local.ts — PLIK AGI LOKALNEJ (Wymiar 0.00G)
 * ────────────────────────────────────────────────────────────────────────────
 * Manifest żywej, lokalnej sieci neuronowej Katedry OtakOS. To NIE jest model
 * chmurowy — to mapa suwerennych węzłów (modułów/agentów) działających na
 * Twoich tranzystorach. Każdy węzeł = neuron; każda krawędź = synapsa.
 *
 * Warstwy (jak w sieci neuronowej):
 *   CORE   — rdzeń (wnioskowanie, most, samonaprawa)
 *   SENSE  — zmysły / wejście (zbieranie i rozumienie)
 *   ACT    — działanie / wyjście (twórczość, rynek, montaż)
 *   GUARD  — tarcza (bezpieczeństwo, prawda, skarbiec)
 *
 * Plik jest WERSJONOWANY — rozwijasz Katedrę, dopisujesz węzeł, mapa rośnie.
 * Uruchomiona Katedra może w przyszłości NADPISAĆ ten plik swoim żywym stanem
 * (agi.local.json eksportowany przez Wiesio-Bridge) — wtedy mapa staje się
 * lustrem realnej, lokalnej AGI.
 */

export type AgiLayer = 'CORE' | 'SENSE' | 'ACT' | 'GUARD';

export interface AgiNode {
  id: string;
  label: string;
  labelEn: string;
  emoji: string;
  layer: AgiLayer;
  desc: string;
  descEn: string;
}

export interface AgiEdge { from: string; to: string; }

export interface AgiManifest {
  version: string;
  dimension: string;
  origin: 'local';
  nodes: AgiNode[];
  edges: AgiEdge[];
}

export const AGI_LOCAL: AgiManifest = {
  version: 'V_ZERO',
  dimension: '0.00G',
  origin: 'local',
  nodes: [
    // ── CORE ──────────────────────────────────────────────────────────────
    { id: 'ollama',  label: 'Rdzeń AI (Ollama)',  labelEn: 'AI Core (Ollama)', emoji: '🦙', layer: 'CORE',
      desc: 'Lokalny silnik wnioskowania. Twoje VRAM, Twoje myśli — zero chmury.',
      descEn: 'Local inference engine. Your VRAM, your thoughts — zero cloud.' },
    { id: 'bridge',  label: 'Wiesio-Bridge',      labelEn: 'Wiesio-Bridge', emoji: '🌉', layer: 'CORE',
      desc: 'Most :3001 — układ nerwowy łączący wszystkie węzły.',
      descEn: 'Bridge :3001 — the nervous system linking every node.' },
    { id: 'mechanik',label: 'Mechanik',           labelEn: 'Mechanic', emoji: '🔧', layer: 'CORE',
      desc: 'Pętla samonaprawy — pisze, weryfikuje i leczy własny kod.',
      descEn: 'Self-repair loop — writes, verifies and heals its own code.' },

    // ── SENSE ─────────────────────────────────────────────────────────────
    { id: 'koom',    label: 'KsięgOOdbioru (KOOM)', labelEn: 'Book of Reception (KOOM)', emoji: '📖', layer: 'SENSE',
      desc: 'Zbiera rozmowy, dekoduje plany na zadania dla Mechanika.',
      descEn: 'Collects conversations, decodes plans into Mechanic tasks.' },
    { id: 'podcast', label: 'Podcast Twin',        labelEn: 'Podcast Twin', emoji: '🎙️', layer: 'SENSE',
      desc: 'Dwóch gospodarzy (ISKRA/ECHO) — refleksja i pamięć dialogu.',
      descEn: 'Two hosts (ISKRA/ECHO) — reflection and dialogue memory.' },
    { id: 'scout',   label: 'Zwiad (Scout)',       labelEn: 'Scout', emoji: '🛰️', layer: 'SENSE',
      desc: 'Skan otoczenia i profili — zmysł rozpoznania.',
      descEn: 'Environment & profile scan — the sense of recognition.' },

    // ── ACT ───────────────────────────────────────────────────────────────
    { id: 'kronos',  label: 'Kronos (Nasiono)',    labelEn: 'Kronos (Seed)', emoji: '🔮', layer: 'ACT',
      desc: 'Projekcja świec K-line — lokalna geometria rynku.',
      descEn: 'K-line candle projection — local market geometry.' },
    { id: 'video',   label: 'VideO-Use',           labelEn: 'VideO-Use', emoji: '🎬', layer: 'ACT',
      desc: 'Montaż słowem — surowy materiał → final.mp4.',
      descEn: 'Editing by words — raw footage → final.mp4.' },
    { id: 'ted',     label: 'Ted (Trader)',        labelEn: 'Ted (Trader)', emoji: '💰', layer: 'ACT',
      desc: 'Centrum Finansowe — skan rynków, Złota Pauza 0.00G.',
      descEn: 'Financial Center — market scan, Golden Pause 0.00G.' },
    { id: 'music',   label: 'Music V2',            labelEn: 'Music V2', emoji: '🎵', layer: 'ACT',
      desc: 'Synteza dźwięku (ACE-Step) + rezonans wektorów sonicznych.',
      descEn: 'Sound synthesis (ACE-Step) + sonic vector resonance.' },

    // ── GUARD ─────────────────────────────────────────────────────────────
    { id: 'shield',  label: 'Tarcza Prawdy (iFixAi)', labelEn: 'Truth Shield (iFixAi)', emoji: '🛡️', layer: 'GUARD',
      desc: 'Inspekcja alignmentu przed zapisem — blokuje sekrety i sabotaż.',
      descEn: 'Pre-write alignment inspection — blocks secrets and sabotage.' },
    { id: 'vault',   label: 'Skarbiec (Vault)',    labelEn: 'Vault', emoji: '🔐', layer: 'GUARD',
      desc: 'Szyfrowane klucze AES-256-GCM — suwerenna tajemnica.',
      descEn: 'AES-256-GCM encrypted keys — sovereign secret.' },
    { id: 'quantum', label: 'Kwantowa Tarcza',     labelEn: 'Quantum Shield', emoji: '⚛️', layer: 'GUARD',
      desc: 'Proxy brzegowe (Cloudflare Worker) — osłona ruchu.',
      descEn: 'Edge proxy (Cloudflare Worker) — traffic shielding.' },
  ],
  edges: [
    // Rdzeń spina się ze wszystkim
    { from: 'ollama', to: 'bridge' }, { from: 'bridge', to: 'mechanik' },
    // Zmysły → rdzeń
    { from: 'koom', to: 'bridge' }, { from: 'podcast', to: 'bridge' }, { from: 'scout', to: 'bridge' },
    { from: 'koom', to: 'mechanik' }, { from: 'podcast', to: 'ollama' },
    // Rdzeń → działanie
    { from: 'ollama', to: 'kronos' }, { from: 'ollama', to: 'video' },
    { from: 'bridge', to: 'ted' }, { from: 'bridge', to: 'music' }, { from: 'bridge', to: 'video' },
    // Tarcza pilnuje rdzenia i działania
    { from: 'shield', to: 'mechanik' }, { from: 'shield', to: 'bridge' },
    { from: 'vault', to: 'bridge' }, { from: 'quantum', to: 'bridge' },
    { from: 'ted', to: 'kronos' },
  ],
};

export default AGI_LOCAL;
