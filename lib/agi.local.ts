/**
 * 🧠 agi.local.ts — mapa sieci neuronowej Katedry OtakOS (Wymiar 0.00G)
 * ────────────────────────────────────────────────────────────────────────────
 * Mapa suwerennych węzłów (modułów i TeOgochi) działających na Twoim sprzęcie. Węzeł = neuron, krawędź = synapsa
 * (prawdziwa zależność: kto kogo woła). Plik jest w dwóch miejscach z tą samą treścią: Hub (`lib/agi.local.ts`)
 * i otakos.wtf (`src/agi.local.ts`).
 *
 * Suweren 2026-10-13: „ma być zgodny z rzeczywistością”. Zdjęte węzły, których Katedra już nie ma albo których nikt
 * nie sprawdzał (Kronos, Ted, VideO-Use, KsięgOOdbioru, Kwantowa Tarcza). Każdy węzeł poniżej ma sondę w moście
 * (services/MapaAgi.js → GET /api/agi/state) i swój powód — bez mostu mapa pokazuje sam manifest, nic nie udaje życia.
 *
 * Warstwy: CORE (rdzeń), SENSE (zmysły / wejście), ACT (działanie / wyjście), GUARD (tarcza).
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
  version: '2026.10',
  dimension: '0.00G',
  origin: 'local',
  nodes: [
    // ── CORE ──────────────────────────────────────────────────────────────
    { id: 'ollama', label: 'Ollama', labelEn: 'Ollama', emoji: '🦙', layer: 'CORE',
      desc: 'Lokalne modele językowe i widzące (domyślnie gemma4) na Twojej karcie.',
      descEn: 'Local language and vision models (gemma4 by default) on your GPU.' },
    { id: 'bridge', label: 'Wiesio-Bridge', labelEn: 'Wiesio-Bridge', emoji: '🌉', layer: 'CORE',
      desc: 'Most :3001 — układ nerwowy: modele, pliki, studia, GRV, głos, sieć.',
      descEn: 'Bridge :3001 — the nervous system: models, files, studios, GRV, voice, network.' },
    { id: 'stado', label: 'Stado TeOgochi', labelEn: 'TeOgochi Herd', emoji: '🐣', layer: 'CORE',
      desc: 'Agenci Katedry — każdy na swoim modelu, piszą wkłady do Projektów Stada.',
      descEn: 'The Cathedral agents — each on its own model, writing contributions to Herd Projects.' },
    { id: 'dyrygent', label: 'Dyrygent', labelEn: 'Conductor', emoji: '🎼', layer: 'CORE',
      desc: 'Mózg Katedry — dobiera modele i silniki do zadania i celu.',
      descEn: 'The Cathedral brain — assigns models and engines to a task and goal.' },
    { id: 'glowny', label: 'Główny (Claude Code)', labelEn: 'Lead (Claude Code)', emoji: '👑', layer: 'CORE',
      desc: 'Claude Code w tle czatu — działa w Katedrze, na zmiany rdzenia pyta o zgodę.',
      descEn: 'Claude Code behind the chat — works in the Cathedral, asks consent for core changes.' },
    { id: 'mechanik', label: 'Mechanik', labelEn: 'Mechanic', emoji: '🔧', layer: 'CORE',
      desc: 'Kolejka patchy — każdy przechodzi przez Tarczę, zanim trafi na dysk.',
      descEn: 'Patch queue — each one passes the Shield before it reaches disk.' },

    // ── SENSE ─────────────────────────────────────────────────────────────
    { id: 'stol', label: 'Stół ratyfikacji', labelEn: 'Ratification Table', emoji: '🏛️', layer: 'SENSE',
      desc: 'Propozycje Suwerena (Podcast Twin, telefon, plik) → Projekt Stada.',
      descEn: 'The Sovereign’s proposals (Podcast Twin, phone, file) → Herd Project.' },
    { id: 'mowa', label: 'Whisper', labelEn: 'Whisper', emoji: '📝', layer: 'SENSE',
      desc: 'Mowa → tekst lokalnie (whisper.cpp) dla Dziennika i podcastów.',
      descEn: 'Speech → text locally (whisper.cpp) for the Log and podcasts.' },
    { id: 'zwiadowca', label: 'Zwiadowca', labelEn: 'Scout', emoji: '🔭', layer: 'SENSE',
      desc: 'Szuka modeli i silników na HuggingFace — nic nie pobiera bez „Przyjmij”.',
      descEn: 'Finds models and engines on HuggingFace — downloads nothing without “Accept”.' },
    { id: 'jev', label: 'Jev (sędzia)', labelEn: 'Jev (judge)', emoji: '⚖️', layer: 'SENSE',
      desc: 'Opcja chmury z własnym kluczem: ocena prawdopodobieństwem dla Kodeksa, Sędziego i Dyrygenta.',
      descEn: 'Cloud option with your own key: probability judgements for the Codex, Judge and Conductor.' },

    // ── ACT ───────────────────────────────────────────────────────────────
    { id: 'kodeks', label: 'Kodeks (Studio Gier)', labelEn: 'Codex (Game Studio)', emoji: '🧱', layer: 'ACT',
      desc: 'Buduje gry i apki z planu GDD — build, przeglądarka, recenzent przed każdą rundą.',
      descEn: 'Builds games and apps from the GDD plan — build, browser, reviewer before each round.' },
    { id: 'obraz', label: 'Obraz (FLUX)', labelEn: 'Image (FLUX)', emoji: '🖼️', layer: 'ACT',
      desc: 'Pracownia obrazów przez ComfyUI — koncepty, postacie, krainy.',
      descEn: 'Image workshop via ComfyUI — concepts, characters, lands.' },
    { id: 'wideo', label: 'Wideo (Wan)', labelEn: 'Video (Wan)', emoji: '🎬', layer: 'ACT',
      desc: 'Ujęcia i filmy gry przez ComfyUI, montaż ffmpeg.',
      descEn: 'Shots and game films via ComfyUI, ffmpeg editing.' },
    { id: 'bryly', label: 'Bryły 3D', labelEn: '3D meshes', emoji: '🗿', layer: 'ACT',
      desc: 'Obraz → bryła (TRELLIS lokalnie), ruch w Blenderze, Meshy tylko za zgodą na koszt.',
      descEn: 'Image → mesh (TRELLIS locally), motion in Blender, Meshy only with cost consent.' },
    { id: 'glos', label: 'Głos (klon)', labelEn: 'Voice (clone)', emoji: '🗣️', layer: 'ACT',
      desc: 'Silnik klonu głosu :5002 (Chatterbox, MIT) — aktorzy, podcast, TeOgochi.',
      descEn: 'Voice clone engine :5002 (Chatterbox, MIT) — actors, podcast, TeOgochi.' },
    { id: 'muzyka', label: 'Muzyka', labelEn: 'Music', emoji: '🎵', layer: 'ACT',
      desc: 'Joanna i Music Studio — utwory przez ComfyUI (ACE-Step), podkłady do gry i tańca.',
      descEn: 'Joanna and Music Studio — tracks via ComfyUI (ACE-Step), music for the game and dance.' },
    { id: 'usta', label: 'Usta aktorów', labelEn: 'Actor lips', emoji: '👄', layer: 'ACT',
      desc: 'MuseTalk 1.5 (MIT) — aktorzy mówią ustami pod swój głos.',
      descEn: 'MuseTalk 1.5 (MIT) — actors move their lips to their voice.' },

    // ── GUARD ─────────────────────────────────────────────────────────────
    { id: 'tarcza', label: 'Tarcza Prawdy', labelEn: 'Shield of Truth', emoji: '🛡️', layer: 'GUARD',
      desc: 'Skanuje patche przed zapisem — sekrety, rm -rf, eval, sabotaż.',
      descEn: 'Scans patches before writing — secrets, rm -rf, eval, sabotage.' },
    { id: 'straz', label: 'Straż Mostu', labelEn: 'Bridge Guard', emoji: '🚧', layer: 'GUARD',
      desc: 'Rozróżnia maszynę Suwerena, sparowany telefon i obcego gościa.',
      descEn: 'Tells the Sovereign’s machine, a paired phone and a stranger apart.' },
    { id: 'ksiega', label: 'Księga GRV', labelEn: 'GRV Ledger', emoji: '🪪', layer: 'GUARD',
      desc: 'Własny skarbiec i właściciel tej Katedry, podpisane pokwitowania przelewów.',
      descEn: 'This Cathedral’s own treasury and owner, signed transfer receipts.' },
    { id: 'tunel', label: 'Tunel', labelEn: 'Tunnel', emoji: '🌐', layer: 'GUARD',
      desc: 'Wyjście do sieci Katedr (Cloudflare) — tylko gdy Suweren go włączy.',
      descEn: 'Exit to the Cathedral network (Cloudflare) — only when the Sovereign turns it on.' },
  ],
  edges: [
    // Rdzeń
    { from: 'ollama', to: 'bridge' }, { from: 'bridge', to: 'stado' }, { from: 'dyrygent', to: 'stado' },
    { from: 'ollama', to: 'dyrygent' }, { from: 'glowny', to: 'bridge' }, { from: 'mechanik', to: 'bridge' },
    // Zmysły → rdzeń
    { from: 'stol', to: 'stado' }, { from: 'mowa', to: 'bridge' }, { from: 'zwiadowca', to: 'dyrygent' },
    { from: 'jev', to: 'dyrygent' }, { from: 'jev', to: 'kodeks' },
    // Rdzeń → działanie
    { from: 'stado', to: 'kodeks' }, { from: 'ollama', to: 'kodeks' },
    { from: 'bridge', to: 'obraz' }, { from: 'bridge', to: 'wideo' }, { from: 'bridge', to: 'bryly' },
    { from: 'bridge', to: 'glos' }, { from: 'bridge', to: 'muzyka' },
    { from: 'obraz', to: 'bryly' }, { from: 'obraz', to: 'wideo' }, { from: 'glos', to: 'usta' },
    // Tarcza
    { from: 'tarcza', to: 'mechanik' }, { from: 'tarcza', to: 'kodeks' }, { from: 'straz', to: 'bridge' },
    { from: 'ksiega', to: 'bridge' }, { from: 'tunel', to: 'straz' },
  ],
};

export default AGI_LOCAL;
