/**
 * 🎤 voiceService — suwerenny głos Katedry (klon lokalny + fallback przeglądarki).
 *
 * speak() próbuje lokalnego silnika klonu (most /api/voice/speak → XTTS/OpenVoice);
 * jak go brak — używa przeglądarki (speechSynthesis), więc DZIAŁA U KAŻDEGO od razu,
 * a podbija się do Twojego sklonowanego głosu, gdy lokalny silnik jest zainstalowany.
 * Próbka głosu zapisywana lokalnie (zero chmury).
 *
 * ⚠️ CZTERY PUŁAPKI PRZEGLĄDARKOWEJ SYNTEZY — wszystkie tu obsłużone, bo każda
 * z osobna wystarczy, żeby głos brzmiał jak zepsuty automat:
 *  1. `getVoices()` przy pierwszym wywołaniu zwraca PUSTĄ tablicę (Chrome ładuje
 *     listę asynchronicznie). Bez nasłuchu `voiceschanged` pierwsze zdanie leci
 *     domyślnym głosem systemu — po polsku brzmi to fatalnie.
 *  2. Sam `lang = 'pl-PL'` NIE wystarcza. Trzeba wskazać konkretny `voice`,
 *     inaczej silnik bywa, że i tak czyta angielskim głosem.
 *  3. Emoji i znaczniki są CZYTANE NA GŁOS („gwiazdka", „cudzysłów dolny").
 *     Dymek kompana jest ich pełen, więc tekst trzeba oczyścić przed mową.
 *  4. Bez wcześniejszego gestu użytkownika przeglądarka kolejkuje mowę i nigdy
 *     jej nie odtwarza (autoplay policy) — a `onend` się nie odpala, więc kod
 *     „myśli", że powiedział. Zgłaszamy to jako 'cisza', zamiast udawać sukces.
 */

const BRIDGE = 'http://127.0.0.1:3001';

export interface VoiceStatus { success: boolean; available: boolean; voices?: string[]; note?: string; }

/** Skąd naprawdę poszedł dźwięk. `cisza` = NIE zabrzmiało, i mówimy to wprost. */
export type ZrodloGlosu = 'clone' | 'browser' | 'cisza';

export interface OpcjeMowy {
    /** Profil klonu po stronie silnika lokalnego (nazwa pliku próbki). */
    voiceId?: string;
    /** 0.1–2. Wyżej = jaśniejszy głos. Dotyczy tylko toru przeglądarki. */
    pitch?: number;
    /** 0.1–10. Tempo mowy. Dotyczy tylko toru przeglądarki. */
    rate?: number;
    /** Rodzaj głosu przeglądarki. Bez tego Joanna dostaje pierwszy polski z listy — bywa męski. */
    rodzaj?: RodzajGlosu;
    /** Nie przerywaj tego, co właśnie leci (domyślnie przerywamy). */
    nieprzerywaj?: boolean;
}

export async function voiceStatus(): Promise<VoiceStatus> {
  try { return await (await fetch(`${BRIDGE}/api/voice/status`)).json(); }
  catch { return { success: false, available: false }; }
}

export async function cloneVoice(sampleBase64: string, voiceId = 'suweren') {
  const r = await fetch(`${BRIDGE}/api/voice/clone`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample: sampleBase64, voiceId }),
  });
  return r.json();
}

// ── Pułapka 1, 2 i 5: polski głos — asynchroniczny I W ODPOWIEDNIM RODZAJU ───

export type RodzajGlosu = 'zenski' | 'meski' | 'obojetnie';

/**
 * ⚠️ PIĄTA PUŁAPKA, znaleziona dopiero patrząc na żywą przeglądarkę:
 * na tej maszynie są DWA polskie głosy — „Microsoft Adam" i „Microsoft Paulina".
 * Pierwotny kod brał pierwszy z brzegu, czyli ADAMA — więc Joanna, ciepła
 * kompanka, przemówiłaby męskim głosem. Testy jednostkowe nie miały szans
 * tego złapać, bo poza przeglądarką lista głosów jest pusta.
 *
 * Web Speech API NIE UDOSTĘPNIA płci głosu — nie ma takiego pola. Zostaje
 * rozpoznanie po imieniu, i tak właśnie to tu działa: lista znanych imion
 * polskich syntezatorów (Windows, Edge Natural, Ivona, Google). Gdy imię jest
 * nieznane, nie zgadujemy — bierzemy jakikolwiek polski głos, bo lepszy obcy
 * rodzaj niż angielska wymowa polskich słów.
 */
const IMIONA_ZENSKIE = ['paulina', 'zofia', 'agnieszka', 'ewa', 'maja', 'female', 'kobie'];
const IMIONA_MESKIE = ['adam', 'marek', 'jacek', 'jan', 'krzysztof', 'male', 'męsk', 'mesk'];

function rodzajPoNazwie(nazwa: string): RodzajGlosu | null {
    const n = nazwa.toLowerCase();
    // Kolejność: „female" zawiera „male" jako podciąg, więc żeńskie sprawdzamy PIERWSZE.
    if (IMIONA_ZENSKIE.some(i => n.includes(i))) return 'zenski';
    if (IMIONA_MESKIE.some(i => n.includes(i))) return 'meski';
    return null;
}

const cacheGlosow = new Map<RodzajGlosu, SpeechSynthesisVoice | null>();
let nasluchPodpiety = false;

function szukajGlosuPl(rodzaj: RodzajGlosu): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const lista = window.speechSynthesis.getVoices();
    if (!lista.length) return null;                       // lista jeszcze nie doszła

    const polskie = lista.filter(v => v.lang?.toLowerCase().startsWith('pl'));
    if (!polskie.length) return null;

    if (rodzaj !== 'obojetnie') {
        const trafiony = polskie.find(v => rodzajPoNazwie(v.name || '') === rodzaj);
        if (trafiony) return trafiony;
        // Brak żądanego rodzaju — polski głos w innym rodzaju i tak bije angielski.
    }
    return polskie.find(v => v.lang?.toLowerCase() === 'pl-pl') ?? polskie[0];
}

/**
 * Polski głos systemu albo `null`, gdy go nie ma. Podpina się pod
 * `voiceschanged`, bo Chrome zwraca pustą listę przy pierwszym pytaniu.
 */
export function glosPolski(rodzaj: RodzajGlosu = 'obojetnie'): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

    const zCache = cacheGlosow.get(rodzaj);
    if (zCache) return zCache;

    const znaleziony = szukajGlosuPl(rodzaj);
    if (znaleziony) { cacheGlosow.set(rodzaj, znaleziony); return znaleziony; }

    // Lista jeszcze się ładuje — dociągnij ją w tle na następne zdanie.
    if (!nasluchPodpiety) {
        nasluchPodpiety = true;
        window.speechSynthesis.addEventListener('voiceschanged', () => {
            cacheGlosow.clear();                          // przeliczymy przy następnym pytaniu
        }, { once: true });
    }
    return null;
}

/** Czy w systemie w ogóle jest polski głos (do uczciwego komunikatu w UI). */
export function czyJestGlosPl(): boolean {
    return glosPolski('obojetnie') !== null;
}

/** Nazwa głosu, którym faktycznie mówi dany rodzaj — do pokazania w UI. */
export function nazwaGlosu(rodzaj: RodzajGlosu = 'obojetnie'): string | null {
    return glosPolski(rodzaj)?.name ?? null;
}

// ── Pułapka 3: emoji i znaczniki są czytane na głos ──────────────────────────

/**
 * Tekst do wypowiedzenia. Wywala emoji, symbole i ozdobniki dymka, zostawia
 * polskie znaki i normalną interpunkcję. `„Tytuł"` → `Tytuł` (cudzysłowy bywają
 * czytane jako słowo), `...(jajko drży)...` → `jajko drży`.
 */
export function oczyscDoMowy(tekst: string): string {
    return String(tekst || '')
        // Emoji i symbole piktograficzne (bez `u` flag na starszych silnikach byłby błąd —
        // te zakresy są bezpieczne w każdej przeglądarce wspierającej speechSynthesis).
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, ' ')
        .replace(/[„""»«]/g, '')
        .replace(/\.{2,}/g, '. ')          // „...(cisza)..." → „. (cisza). "
        .replace(/[()]/g, ' ')
        .replace(/[∴·•]/g, ' ')
        .replace(/\s+/g, ' ')
        // Osad po zamianie wielokropka: „...(jajko drży)..." dawało „. jajko drży .".
        // Wiodąca kropka to dla syntezatora osobna pauza i słychać ją jak zacięcie.
        .replace(/^[\s.,;:–—-]+/, '')
        // Kropka ODDZIELONA spacją na końcu to osad („drży ."), ale „drży." to
        // normalne zakończenie zdania i musi zostać — stąd wymagana spacja przed.
        // `\s*$` na końcu jest KONIECZNE: po zamianie nawiasu na spację string
        // kończy się „drży . " — bez tego kotwica `$` nie trafia w kropkę.
        .replace(/\s+\.+\s*$/, '')
        .replace(/[\s,;:–—-]+$/, '')
        .trim();
}

// ── Pułapka 4: bez gestu użytkownika mowa nigdy nie zabrzmi ──────────────────

let bylGest = false;
if (typeof window !== 'undefined') {
    const zapamietaj = () => { bylGest = true; };
    window.addEventListener('pointerdown', zapamietaj, { once: true, capture: true });
    window.addEventListener('keydown', zapamietaj, { once: true, capture: true });
}

/** Czy przeglądarka pozwoli już mówić (był jakikolwiek gest użytkownika). */
export function czyWolnoMowic(): boolean { return bylGest; }

let current: HTMLAudioElement | null = null;

/**
 * Mów. Zwraca faktyczne źródło dźwięku: 'clone' (lokalny silnik),
 * 'browser' (synteza przeglądarki) albo 'cisza' (NIC nie zabrzmiało).
 *
 * Drugi argument przyjmuje też samo `voiceId` — dla zgodności ze starymi
 * wywołaniami (`speak(text, 'adamus')`).
 */
export async function speak(text: string, opcje: OpcjeMowy | string = {}): Promise<ZrodloGlosu> {
  const o: OpcjeMowy = typeof opcje === 'string' ? { voiceId: opcje } : opcje;
  const voiceId = o.voiceId ?? 'suweren';

  const doWypowiedzenia = oczyscDoMowy(text);
  if (!doWypowiedzenia) return 'cisza';       // sam emoji — nie ma czego czytać

  try {
    const r = await fetch(`${BRIDGE}/api/voice/speak`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: doWypowiedzenia, voiceId }),
    });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('audio')) {
      const blob = await r.blob();
      if (current && !o.nieprzerywaj) { current.pause(); }
      current = new Audio(URL.createObjectURL(blob));
      await current.play();
      return 'clone';
    }
  } catch { /* fallback */ }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return 'cisza';
  // Kolejkowanie bez gestu = mowa, która nigdy nie zabrzmi. Lepiej powiedzieć
  // „cisza" niż zwrócić 'browser' i zostawić Suwerena z pytaniem, czemu nie słychać.
  if (!bylGest) return 'cisza';

  const u = new SpeechSynthesisUtterance(doWypowiedzenia);
  u.lang = 'pl-PL';
  const glos = glosPolski(o.rodzaj ?? 'obojetnie');
  if (glos) u.voice = glos;                   // sam `lang` bywa ignorowany
  if (o.pitch != null) u.pitch = Math.max(0.1, Math.min(2, o.pitch));
  if (o.rate != null) u.rate = Math.max(0.1, Math.min(10, o.rate));
  if (!o.nieprzerywaj) window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return 'browser';
}

/** Ucisz natychmiast — oba tory. */
export function ucisz(): void {
  try { current?.pause(); } catch { /* nieistotne */ }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** Pomocnik: Blob (nagranie) → base64 data URL. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
