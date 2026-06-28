/**
 * 🎬 storyManifest — format „gra = Film = opowieść" (Reżyser, Etap I).
 *
 * Użytkownik składa OPOWIEŚĆ ze scen i ujęć w Katedrze (RezyserView), eksportuje JEDEN
 * plik (manifest), wrzuca do UE → `story_compiler.py` czyta go jako dane i generuje
 * hybrydę FILM→GRA: geometria scen (grywalny poziom) + Level Sequence z cięciami kamer.
 *
 * Czyste typy + helpery (testowalne bez UE). Wtyczki środowisk = presety; wtyczki sceny =
 * mody z `forge_plugins/` (Etap II: generowane przez Ollamę + Marketplace GRV).
 *
 * Etos 0.00G: dane, nie magia. Manifest jest jawny i edytowalny ręcznie.
 */

/** Bumpuj, gdy zmienia się kształt manifestu — kompilator UE sprawdza zgodność. */
export const STORY_SCHEMA_VERSION = 1;

/** Wbudowane środowiska (presety geometrii reużywające istniejące sceny GENESIS). */
export type Environment = 'schron' | 'atrium' | 'aether' | 'pusto';

export const ENVIRONMENTS: { id: Environment; name: string; icon: string; desc: string }[] = [
  { id: 'schron', name: 'Cyber-Schron', icon: '🏛️', desc: 'Serwerownia: biurko, terminal, neony, wrota EventHorizon.' },
  { id: 'atrium', name: 'Oszklone Atrium', icon: '🪟', desc: 'Metalowa konstrukcja + kolorowe witraże + odbicia.' },
  { id: 'aether', name: 'Most AETHER', icon: '🍞', desc: 'Platforma w kosmosie, gwiazdy NeuralMap, złoty TOST-portal.' },
  { id: 'pusto', name: 'Pustka', icon: '⚫', desc: 'Czysta scena — tylko Twoje wtyczki i ujęcia.' },
];

/** Rodzaj ujęcia — wpływa na domyślny dobór kamery w UI. */
export type ShotKind = 'establishing' | 'dialog' | 'akcja';

export interface Shot {
  id: string;
  kind: ShotKind;
  /** Kamera: pozycja i punkt patrzenia w cm (świat UE). fov opcjonalne. */
  camera: { loc: [number, number, number]; lookAt: [number, number, number]; fov?: number };
  /** Długość ujęcia w sekwencji (sekundy). */
  durationS: number;
  /** Tekst na ekranie (TextRender/karta). Opcjonalny. */
  caption?: string;
}

export interface ScenePlugin {
  id: string;                       // nazwa pliku w forge_plugins/ (bez .py)
  params?: Record<string, unknown>; // parametry przekazane do apply(ctx, params)
}

export interface Scene {
  id: string;
  name: string;
  environment: Environment;
  envParams?: Record<string, string | number>;
  plugins?: ScenePlugin[];
  shots: Shot[];
}

export interface StoryManifest {
  meta: {
    title: string;
    author: string;
    version: number;     // = STORY_SCHEMA_VERSION przy eksporcie
    createdAt: number;
  };
  scenes: Scene[];
}

// ── Helpery (czyste, bez efektów ubocznych) ──────────────────────────────────

let _seq = 0;
/** Krótki, unikalny id (czas + licznik — stabilny w obrębie sesji). */
export function uid(prefix = 'id'): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}${_seq.toString(36)}`;
}

/** Domyślne ujęcie szerokie — bezpieczny punkt startu. */
export function defaultShot(kind: ShotKind = 'establishing'): Shot {
  const cams: Record<ShotKind, Shot['camera']> = {
    establishing: { loc: [-600, 0, 300], lookAt: [400, 0, 150], fov: 70 },
    dialog: { loc: [120, -200, 170], lookAt: [0, 0, 150], fov: 50 },
    akcja: { loc: [300, 300, 250], lookAt: [400, 0, 150], fov: 85 },
  };
  return { id: uid('shot'), kind, camera: cams[kind], durationS: 4 };
}

export function emptyScene(name = 'Scena 1', environment: Environment = 'schron'): Scene {
  return { id: uid('scene'), name, environment, shots: [defaultShot('establishing')] };
}

export function emptyStory(title = 'Bez tytułu', author = 'Suweren'): StoryManifest {
  return {
    meta: { title, author, version: STORY_SCHEMA_VERSION, createdAt: Date.now() },
    scenes: [emptyScene()],
  };
}

/** Niemutujący dodatek sceny. */
export function addScene(story: StoryManifest, scene?: Partial<Scene>): StoryManifest {
  const base = emptyScene(`Scena ${story.scenes.length + 1}`);
  return { ...story, scenes: [...story.scenes, { ...base, ...scene, id: base.id }] };
}

/** Niemutujący dodatek ujęcia do wskazanej sceny. */
export function addShot(story: StoryManifest, sceneId: string, kind: ShotKind = 'establishing'): StoryManifest {
  return {
    ...story,
    scenes: story.scenes.map(s =>
      s.id === sceneId ? { ...s, shots: [...s.shots, defaultShot(kind)] } : s),
  };
}

/** Całkowity czas filmu (suma ujęć) w sekundach. */
export function totalDurationS(story: StoryManifest): number {
  return story.scenes.reduce((a, s) => a + s.shots.reduce((b, sh) => b + (sh.durationS || 0), 0), 0);
}

/** Walidacja przed eksportem. Zwraca listę błędów (pusta = OK). */
export function validateStory(story: StoryManifest): string[] {
  const errs: string[] = [];
  if (!story?.meta?.title?.trim()) errs.push('Brak tytułu filmu.');
  if (!Array.isArray(story?.scenes) || story.scenes.length === 0) errs.push('Film musi mieć co najmniej jedną scenę.');
  const envIds = new Set(ENVIRONMENTS.map(e => e.id));
  story?.scenes?.forEach((s, i) => {
    if (!s.name?.trim()) errs.push(`Scena ${i + 1}: brak nazwy.`);
    if (!envIds.has(s.environment)) errs.push(`Scena ${i + 1}: nieznane środowisko „${s.environment}".`);
    if (!Array.isArray(s.shots) || s.shots.length === 0) errs.push(`Scena ${i + 1}: brak ujęć.`);
    s.shots?.forEach((sh, j) => {
      if (!(sh.durationS > 0)) errs.push(`Scena ${i + 1}, ujęcie ${j + 1}: czas musi być > 0 s.`);
    });
  });
  return errs;
}

/** Slug z tytułu (dla nazwy pliku manifestu). */
export function storySlug(story: StoryManifest): string {
  const base = (story?.meta?.title || 'film')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'film';
  return base;
}
