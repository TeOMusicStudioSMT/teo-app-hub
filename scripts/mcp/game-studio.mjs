#!/usr/bin/env node
/**
 * 🎮 MCP Game Studio Katedry — serwer MCP (stdio) na wzór CoplayDev/unity-mcp, ale dla gier three.js Katedry.
 * Suweren 2026-10-20: „własny MCP Game Studio na wzór unity-mcp”.
 *
 * NIE dubluje logiki: każde narzędzie woła PRAWDZIWĄ trasę mostu (domyślnie http://127.0.0.1:3001, `OTAKOS_MOST`).
 * Straż mostu zostaje autorytetem — serwer działa na tej maszynie, więc dostaje to, co „maszyna Suwerena”.
 *
 * Protokół: JSON-RPC 2.0, jedna wiadomość = jedna linia na stdin/stdout (MCP stdio). Oficjalnego SDK nie ma
 * w node_modules Katedry, a potrzebne są cztery metody (initialize, tools/list, tools/call, ping) — więc bez
 * nowych zależności. Logi idą na stderr (stdout jest dla protokołu).
 *
 * GRUPY (jak w unity-mcp, włączane wybiórczo): `--grupy=projekty,assety` albo `OTAKOS_MCP_GRUPY`; domyślnie wszystkie.
 *   projekty  — gry Katedry, GDD, klocki, produkcja, mapa projektu; wybór gry (wiele gier naraz = parametr `projekt`)
 *   assety    — Assety 3D (lista, meta, ruchy, do gry), Pracownia obrazów; FLUX/TRELLIS/Blender tylko z `zgoda: true`,
 *               Meshy: darmowa wycena → zlecenie z `zgodaKredyty` równym wycenie (most sprawdza)
 *   budowa    — Kodeks (budowa w tle, sondaż), produkcja z planu GDD (z `zgoda: true`), test gry w przeglądarce + zrzut
 *   walidacja — Recenzent Kodeksa + tsc na kopii projektu PRZED zapisem (odpowiednik Roslyn); niczego nie zapisuje
 *   unity     — Unity jako drugi silnik (stan, eksport brył, otwarcie i budowa z `zgoda: true`)
 */
import readline from 'readline';
import path from 'path';
import { pathToFileURL } from 'url';

export const WERSJE_PROTOKOLU = ['2025-06-18', '2025-03-26', '2024-11-05'];
export const GRUPY = ['projekty', 'assety', 'budowa', 'walidacja', 'unity'];
export const NAZWA = 'katedra-game-studio';

const S = (v, opis, extra = {}) => ({ type: 'string', description: opis, ...extra });
const N = (opis, extra = {}) => ({ type: 'number', description: opis, ...extra });
const B = (opis) => ({ type: 'boolean', description: opis });
const obiekt = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const PROJEKT = S(null, 'Id gry w _OtakOs_Apki (np. teterhia-wieczna-saga). Puste = gra wybrana przez gs_wybierz_gre.');
const ZGODA = B('Jawna zgoda Suwerena na ciężką/płatną akcję (GPU, chmura modeli, kredyty). Bez true narzędzie odmawia.');

/** Skraca odpowiedź mostu, żeby nie zalać kontekstu agenta. */
export function skroc(v, limit = 30_000) {
    const t = typeof v === 'string' ? v : JSON.stringify(v, null, 1);
    return t.length > limit ? `${t.slice(0, limit)}\n… (ucięte: ${t.length - limit} znaków więcej — zawęź zapytanie)` : t;
}

const lekkiAsset = (a) => ({ id: a.id, nazwa: a.nazwa, opis: String(a.opis ?? '').slice(0, 160), stan: a.stan, projekt: a.projekt ?? null, sciany: a.sciany ?? a.siatka?.sciany ?? null, tekstury: !!a.tekstury, rig: a.chmura?.rodzaj === 'rig', ruchy: (a.ruchy ?? []).map((r) => r.ruch ?? r.id ?? r), utworzono: a.utworzono });
const lekkiObraz = (o) => ({ id: o.id, opis: String(o.opis ?? '').slice(0, 160), styl: o.styl, galaz: o.galaz ?? null, projekt: o.projekt ?? null, stan: o.stan, bryly: o.bryly ?? [], utworzono: o.utworzono });

/**
 * Definicje narzędzi: { nazwa, grupa, opis, schemat, wykonaj(args, ctx) }.
 * ctx: { most(metoda, sciezka, cialo?), projekt(args), ustawProjekt(id), obraz(sciezka) }
 */
export const NARZEDZIA = [
    // ── projekty ─────────────────────────────────────────────────────────────
    { nazwa: 'gs_gry', grupa: 'projekty', opis: 'Lista projektów App Studio/Game Studio (gry i apki): id, typ, czy zbudowana, iteracje. Wiele gier naraz = wybierasz po id.',
      schemat: obiekt({ typ: S(null, 'gra | apka | wszystkie (domyślnie gra)', { enum: ['gra', 'apka', 'wszystkie'] }) }),
      wykonaj: async (a, c) => { const r = await c.most('GET', '/api/appstudio/projekty'); const t = a.typ || 'gra'; return { wybrana: c.wybrana(), projekty: (r.projekty ?? []).filter((p) => t === 'wszystkie' || p.typ === t) }; } },
    { nazwa: 'gs_wybierz_gre', grupa: 'projekty', opis: 'Ustaw grę domyślną dla kolejnych narzędzi tej sesji (jak set_active_instance w unity-mcp). Sprawdza, że projekt istnieje.',
      schemat: obiekt({ projekt: S(null, 'Id gry') }, ['projekt']),
      wykonaj: async (a, c) => { const r = await c.most('GET', `/api/appstudio/projekty/${encodeURIComponent(a.projekt)}`); c.ustawProjekt(a.projekt); return { wybrana: a.projekt, nazwa: r.projekt?.nazwa, typ: r.projekt?.typ }; } },
    { nazwa: 'gs_projekt', grupa: 'projekty', opis: 'Projekt gry: pliki, historia iteracji Kodeksa, zadania w toku.',
      schemat: obiekt({ projekt: PROJEKT }),
      wykonaj: async (a, c) => { const r = await c.most('GET', `/api/appstudio/projekty/${encodeURIComponent(c.projekt(a))}`); const p = r.projekt ?? {}; return { ...p, historia: (p.historia ?? []).slice(-8), zadania: r.zadania }; } },
    { nazwa: 'gs_mapa_projektu', grupa: 'projekty', opis: 'Mapa projektu (WIKI.md budowana z kodu, bez modelu): moduły, eksporty, zależności.',
      schemat: obiekt({ projekt: PROJEKT }),
      wykonaj: async (a, c) => (await c.most('GET', `/api/appstudio/projekty/${encodeURIComponent(c.projekt(a))}/wiki`)).markdown },
    { nazwa: 'gs_gdd', grupa: 'projekty', opis: 'GDD gry (wizja, sekcje, kamienie i zadania planu, gałęzie świata, filmy) + stan produkcji. `czesc` zawęża odpowiedź.',
      schemat: obiekt({ projekt: PROJEKT, czesc: S(null, 'wszystko | plan | galezie | filmy | sekcje', { enum: ['wszystko', 'plan', 'galezie', 'filmy', 'sekcje'] }) }),
      wykonaj: async (a, c) => {
          const r = await c.most('GET', `/api/gdd/${encodeURIComponent(c.projekt(a))}`);
          if (!r.gdd) return { gdd: null, uwaga: 'Ta gra nie ma GDD (Game Studio → Reżyser i GDD).' };
          const g = r.gdd, cz = a.czesc || 'wszystko';
          if (cz === 'plan') return { kamienie: (g.kamienie ?? []).map((k) => ({ id: k.id, tytul: k.tytul, opis: k.opis, zadania: (k.zadania ?? []).map((z) => ({ id: z.id, stan: z.stan, tresc: String(z.tresc ?? '').slice(0, 220), ...(z.uwaga ? { uwaga: String(z.uwaga).slice(0, 160) } : {}) })) })), produkcja: r.produkcja ? { stan: r.produkcja.stan, zrobione: r.produkcja.zrobione, razem: r.produkcja.razem, ostatni: r.produkcja.kroki?.at(-1) ?? null } : null };
          if (cz === 'galezie') return { galezie: g.galezie };
          if (cz === 'filmy') return { filmy: g.filmy };
          if (cz === 'sekcje') return { tytul: g.tytul, sekcje: g.sekcje };
          return { gdd: g, produkcja: r.produkcja };
      } },
    { nazwa: 'gs_klocki', grupa: 'projekty', opis: 'Klocki gry (KlockiGry): katalog obrazów/brył projektu ze stanem (w-grze/bryla/obraz/koncept) i klocki każdego zadania planu — czego brakuje przed budową.',
      schemat: obiekt({ projekt: PROJEKT, stan: S(null, 'katalog tylko w tym stanie: w-grze | bryla | obraz | koncept (puste = sam licznik)', { enum: ['w-grze', 'bryla', 'obraz', 'koncept'] }), zadanie: S(null, 'id zadania planu — pełne klocki tylko tego zadania') }),
      wykonaj: async (a, c) => {
          const r = await c.most('GET', `/api/gdd/${encodeURIComponent(c.projekt(a))}/klocki`);
          const katalog = r.katalog ?? [], zadania = r.zadania ?? {};
          if (a.zadanie) return { zadanie: a.zadanie, klocki: zadania[a.zadanie] ?? null };
          const liczba = {};
          for (const k of katalog) liczba[k.stan] = (liczba[k.stan] ?? 0) + 1;
          const zBrakami = Object.entries(zadania).filter(([, z]) => z.braki?.length).map(([id, z]) => ({ zadanie: id, braki: z.braki.map((b) => ({ rola: b.rola, co: b.co, opis: String(b.opis ?? '').slice(0, 120) })) }));
          return { katalog: { razem: katalog.length, wgStanu: liczba, ...(a.stan ? { klocki: katalog.filter((k) => k.stan === a.stan).map((k) => ({ klucz: k.klucz, opis: String(k.opis ?? k.nazwa ?? '').slice(0, 120), galaz: k.galaz, bryly: k.bryly })) } : {}) },
              zadan: Object.keys(zadania).length, zadaniaZBrakami: zBrakami, uwaga: 'Brak klocka zatrzymuje resztę kamienia w produkcji (⏸). Szczegóły zadania: parametr `zadanie`.' };
      } },
    { nazwa: 'gs_produkcja', grupa: 'projekty', opis: 'Stan produkcji z planu GDD (kroki, zrobione/razem, błąd).',
      schemat: obiekt({ projekt: PROJEKT }),
      wykonaj: async (a, c) => c.most('GET', `/api/gdd/${encodeURIComponent(c.projekt(a))}/produkcja`) },

    // ── assety ───────────────────────────────────────────────────────────────
    { nazwa: 'gs_assety', grupa: 'assety', opis: 'Bryły z Assetów 3D (TRELLIS/Meshy): id, nazwa, opis, stan, tekstury, rig, ruchy. Filtry: projekt, szukaj.',
      schemat: obiekt({ projekt: S(null, 'tylko bryły tej gry (pole projekt w meta)'), szukaj: S(null, 'fragment nazwy/opisu'), limit: N('ile (domyślnie 40)') }),
      wykonaj: async (a, c) => {
          const r = await c.most('GET', '/api/assety3d');
          const q = String(a.szukaj ?? '').toLowerCase();
          const l = (r.assety ?? []).filter((x) => (!a.projekt || x.projekt === a.projekt) && (!q || `${x.nazwa} ${x.opis}`.toLowerCase().includes(q)));
          return { razem: l.length, assety: l.slice(0, a.limit || 40).map(lekkiAsset), zadania: (r.zadania ?? []).filter((z) => z.stan === 'trwa') };
      } },
    { nazwa: 'gs_asset', grupa: 'assety', opis: 'Pełna meta jednej bryły (poprawki, ruchy, chmura, światło, wersje).',
      schemat: obiekt({ asset: S(null, 'id bryły') }, ['asset']),
      wykonaj: async (a, c) => { const r = await c.most('GET', '/api/assety3d'); const m = (r.assety ?? []).find((x) => x.id === a.asset); if (!m) throw new Error(`Nie ma bryły „${a.asset}”.`); return m; } },
    { nazwa: 'gs_do_gry', grupa: 'assety', opis: 'Bryła → gra: kopia GLB do public/assety gry + wpis w assety.json (Kodeks czyta to w prompcie). Opcjonalnie ruch (animowany GLB) albo otoczenie (biom).',
      schemat: obiekt({ asset: S(null, 'id bryły'), projekt: PROJEKT, ruch: S(null, 'np. chod, obrot (z meta.ruchy)'), otoczenie: S(null, 'biom', { enum: ['gaj', 'rownina', 'grzbiet', 'strumien', 'pustka'] }), wysokosc: N('wysokość w jednostkach gry (otoczenie)') }, ['asset']),
      wykonaj: async (a, c) => c.most('POST', `/api/assety3d/${encodeURIComponent(a.asset)}/do-gry`, { projekt: c.projekt(a), ruch: a.ruch || null, otoczenie: a.otoczenie || null, wysokosc: a.wysokosc ?? null }) },
    { nazwa: 'gs_ruchy', grupa: 'assety', opis: 'Ruchy brył dostępne lokalnie (Blender: obrot, lewitacja, kolysanie, oddech, podskok) i zadania ruchu w toku.',
      schemat: obiekt({}),
      wykonaj: async (_a, c) => c.most('GET', '/api/assety3d/ruchy') },
    { nazwa: 'gs_ozyw_bryle', grupa: 'assety', opis: 'Ruch bryły w Blenderze (lokalnie, zajmuje maszynę): GLB z animacją + podgląd mp4. Wymaga zgoda: true.',
      schemat: obiekt({ asset: S(null, 'id bryły'), ruch: S(null, 'obrot | lewitacja | kolysanie | oddech | podskok'), sekundy: N('długość pętli'), zgoda: ZGODA }, ['asset', 'ruch']),
      ciezkie: true,
      wykonaj: async (a, c) => c.most('POST', `/api/assety3d/${encodeURIComponent(a.asset)}/ruch`, { ruch: a.ruch, sekundy: a.sekundy }) },
    { nazwa: 'gs_obrazy', grupa: 'assety', opis: 'Pracownia obrazów: obrazy (koncepty, postacie, zestawy) z gałęzią GDD i bryłami z nich. Filtry: projekt, galaz.',
      schemat: obiekt({ projekt: S(null, 'tylko obrazy tej gry'), galaz: S(null, 'gałąź świata z GDD, np. postacie, mini-teogochi, otoczenie'), limit: N('ile (domyślnie 40)') }),
      wykonaj: async (a, c) => {
          const r = await c.most('GET', '/api/assety3d/obrazy');
          const l = (r.obrazy ?? []).filter((o) => (!a.projekt || o.projekt === a.projekt) && (!a.galaz || o.galaz === a.galaz));
          return { razem: l.length, obrazy: l.slice(0, a.limit || 40).map(lekkiObraz), style: r.style, silniki: r.silniki, zadania: r.zadania };
      } },
    { nazwa: 'gs_narysuj', grupa: 'assety', opis: 'Pracownia: nowy obraz (FLUX albo Qwen na karcie graficznej, w tle). Wymaga zgoda: true.',
      schemat: obiekt({ opis: S(null, 'co narysować'), styl: S(null, 'pojedynczy | zestaw | postac | postac3d | krajobraz'), galaz: S(null, 'gałąź GDD'), projekt: PROJEKT, silnik: S(null, 'flux | qwen', { enum: ['flux', 'qwen'] }), zgoda: ZGODA }, ['opis']),
      ciezkie: true,
      wykonaj: async (a, c) => c.most('POST', '/api/assety3d/obrazy', { opis: a.opis, styl: a.styl || 'pojedynczy', galaz: a.galaz || null, projekt: c.projekt(a, true), silnik: a.silnik || 'flux' }) },
    { nazwa: 'gs_bryla_z_obrazu', grupa: 'assety', opis: 'TRELLIS.2 lokalnie (GPU): bryła z obrazu Pracowni; koncept/kolaż wymaga wycinka {x,y,w,h} 0–1. Wymaga zgoda: true.',
      schemat: obiekt({ obraz: S(null, 'id obrazu Pracowni'), nazwa: S(null, 'nazwa bryły'), projekt: PROJEKT, wycinek: { type: 'object', description: '{x,y,w,h} ułamki 0–1', properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } } }, zgoda: ZGODA }, ['obraz']),
      ciezkie: true,
      wykonaj: async (a, c) => c.most('POST', '/api/assety3d/generuj', { zObrazu: a.obraz, nazwa: a.nazwa, projekt: c.projekt(a, true), wycinek: a.wycinek }) },
    { nazwa: 'gs_zadanie_assetu', grupa: 'assety', opis: 'Stan zadania Assetów 3D/Pracowni (id z gs_narysuj / gs_bryla_z_obrazu).',
      schemat: obiekt({ zadanie: S(null, 'id zadania') }, ['zadanie']),
      wykonaj: async (a, c) => c.most('GET', `/api/assety3d/zadania/${encodeURIComponent(a.zadanie)}`) },
    { nazwa: 'gs_meshy_wycena', grupa: 'assety', opis: 'Meshy (chmura, płatne kredyty): DARMOWA wycena zlecenia (retekstura/remesh/obraz3d/rig/akcje) z saldem konta.',
      schemat: obiekt({ asset: S(null, 'id bryły'), zlecenie: { type: 'object', description: 'np. {rodzaj:"retekstura", styl:"…", rozdzielczosc:"2k"} — jak panel Meshy w Game Studio' } }, ['asset', 'zlecenie']),
      wykonaj: async (a, c) => c.most('POST', `/api/assety3d/chmura/${encodeURIComponent(a.asset)}/wycena`, { zlecenie: a.zlecenie }) },
    { nazwa: 'gs_meshy_zlec', grupa: 'assety', opis: 'Meshy: wysyła bryłę do chmury za kredyty. zgodaKredyty MUSI równać się wycenie (most odmawia inaczej) i zgoda: true.',
      schemat: obiekt({ asset: S(null, 'id bryły'), zlecenie: { type: 'object' }, zgodaKredyty: N('kredyty z gs_meshy_wycena'), zgoda: ZGODA }, ['asset', 'zlecenie', 'zgodaKredyty']),
      ciezkie: true,
      wykonaj: async (a, c) => c.most('POST', `/api/assety3d/chmura/${encodeURIComponent(a.asset)}/zlec`, { zlecenie: a.zlecenie, zgodaKredyty: a.zgodaKredyty }) },

    // ── budowa ───────────────────────────────────────────────────────────────
    { nazwa: 'gs_test_gry', grupa: 'budowa', opis: 'Test zbudowanej gry w Chrome (jak w pętli Kodeksa): canvas, WSAD + spacja, odczyt window.__gra po każdym ruchu, błędy konsoli, zrzut ekranu (zwracany jako obraz).',
      schemat: obiekt({ projekt: PROJEKT, cel: S(null, 'opcjonalnie: czego dotyczy test (klawisze ze zlecenia sprawdza Sędzia Gry)'), bezZrzutu: B('nie dołączaj obrazu zrzutu') }),
      wykonaj: async (a, c) => {
          const r = await c.most('POST', `/api/game-studio/${encodeURIComponent(c.projekt(a))}/test`, { cel: a.cel || '' });
          // window.__gra bywa duże (Teterhia: dziesiątki pól) — migawki jako pozycja/wynik, pełny stan tylko ostatni
          const { success: _s, migawki = [], ...reszta } = r;
          const wynik = { ...reszta, migawki: migawki.map((m) => ({ kiedy: m.kiedy, ...(m.stan ? { pozycja: m.stan.pozycja ?? null, wynik: m.stan.wynik ?? null } : { tekst: String(m.tekst ?? '').slice(0, 200) }) })) };
          const obraz = !a.bezZrzutu && r.zrzut ? await c.obraz(r.zrzut).catch(() => null) : null;
          return obraz ? { tresc: wynik, obraz } : wynik;
      } },
    { nazwa: 'gs_buduj', grupa: 'budowa', opis: 'Kodeks buduje zadanie w grze (model → pliki → tsc+vite → przeglądarka → sędziowie → commit), w tle. Model chmury = rachunek za tokeny. Wymaga zgoda: true. Wynik: id do gs_zadanie_kodeksa.',
      schemat: obiekt({ projekt: PROJEKT, zadanie: S(null, 'co zbudować/zmienić, po polsku'), model: S(null, 'model (puste = przydział Kodeksa)'), zgoda: ZGODA }, ['zadanie']),
      ciezkie: true,
      wykonaj: async (a, c) => c.most('POST', `/api/appstudio/projekty/${encodeURIComponent(c.projekt(a))}/buduj-w-tle`, { zadanie: a.zadanie, model: a.model || undefined }) },
    { nazwa: 'gs_zadanie_kodeksa', grupa: 'budowa', opis: 'Stan zadania Kodeksa: kroki (ostatnie 15), rundy, wynik.',
      schemat: obiekt({ zadanie: S(null, 'id kx-…') }, ['zadanie']),
      wykonaj: async (a, c) => { const z = (await c.most('GET', `/api/appstudio/zadania/${encodeURIComponent(a.zadanie)}`)).zadanie; return { ...z, kroki: (z.kroki ?? []).slice(-15) }; } },
    { nazwa: 'gs_realizuj_plan', grupa: 'budowa', opis: 'Produkcja z planu GDD: Kodeks zadanie po zadaniu (z klockami, zapasowymi modelami). Długo, model chmury = tokeny. Wymaga zgoda: true.',
      schemat: obiekt({ projekt: PROJEKT, kamien: S(null, 'tylko ten kamień'), model: S(null, 'model główny'), zgoda: ZGODA }),
      ciezkie: true,
      wykonaj: async (a, c) => c.most('POST', `/api/gdd/${encodeURIComponent(c.projekt(a))}/realizuj`, { kamien: a.kamien || null, model: a.model || undefined }) },
    { nazwa: 'gs_przerwij_produkcje', grupa: 'budowa', opis: 'Przerywa produkcję z planu GDD tej gry.',
      schemat: obiekt({ projekt: PROJEKT }),
      wykonaj: async (a, c) => c.most('POST', `/api/gdd/${encodeURIComponent(c.projekt(a))}/przerwij`, {}) },

    // ── walidacja ────────────────────────────────────────────────────────────
    { nazwa: 'gs_waliduj', grupa: 'walidacja', opis: 'PRZED zapisem: Recenzent Kodeksa (atrapy, @ts-ignore, wycięty kod…) + tsc --noEmit na kopii gry z Twoimi plikami. Niczego nie zapisuje. Tylko src/** i index.html.',
      schemat: obiekt({ projekt: PROJEKT, pliki: { type: 'array', description: 'pełne treści plików', items: { type: 'object', properties: { sciezka: { type: 'string' }, tresc: { type: 'string' } }, required: ['sciezka', 'tresc'] } }, cel: S(null, 'zadanie, którego dotyczą zmiany (Recenzent sprawdza np. czy kazano usuwać)'), tsc: B('domyślnie true'), jev: B('drugi głos Jev (TypeSafe, koszt tokenów) — domyślnie false') }, ['pliki']),
      wykonaj: async (a, c) => c.most('POST', `/api/game-studio/${encodeURIComponent(c.projekt(a))}/waliduj`, { pliki: a.pliki, cel: a.cel || '', tsc: a.tsc !== false, jev: a.jev === true }) },

    // ── unity ────────────────────────────────────────────────────────────────
    { nazwa: 'unity_stan', grupa: 'unity', opis: 'Unity na tej maszynie: Hub, edytory (wersje), projekty w _OtakOs_Unity (czy mają Unity MCP i glTFast), zadania budowy; bez Unity — co zainstalować.',
      schemat: obiekt({}),
      wykonaj: async (_a, c) => c.most('GET', '/api/unity/stan') },
    { nazwa: 'unity_eksport_bryly', grupa: 'unity', opis: 'Bryła z Assetów 3D (model.glb + ruch-*.glb + karta.json) → Assets/OtakOs/Bryly/<id>/ projektu Unity.',
      schemat: obiekt({ projekt: S(null, 'id projektu Unity'), asset: S(null, 'id bryły'), ruchy: B('z ruchami (domyślnie true)') }, ['projekt', 'asset']),
      wykonaj: async (a, c) => c.most('POST', '/api/unity/eksport', { projekt: a.projekt, asset: a.asset, ruchy: a.ruchy !== false }) },
    { nazwa: 'unity_otworz', grupa: 'unity', opis: 'Otwiera projekt Unity w edytorze (okno na ekranie Suwerena). Wymaga zgoda: true.',
      schemat: obiekt({ projekt: S(null, 'id projektu Unity'), zgoda: ZGODA }, ['projekt']),
      ciezkie: true,
      wykonaj: async (a, c) => c.most('POST', '/api/unity/launch', { projekt: a.projekt }) },
    { nazwa: 'unity_buduj', grupa: 'unity', opis: 'Budowa projektu Unity z wiersza poleceń (-batchmode, w tle, dziennik). Wymaga zgoda: true. Stan: unity_stan.',
      schemat: obiekt({ projekt: S(null, 'id projektu Unity'), cel: S(null, 'windows | linux | webgl | android', { enum: ['windows', 'linux', 'webgl', 'android'] }), zgoda: ZGODA }, ['projekt']),
      ciezkie: true,
      wykonaj: async (a, c) => c.most('POST', '/api/unity/build', { projekt: a.projekt, cel: a.cel || 'windows' }) },
];

/** Grupy z argumentów/środowiska; nieznana nazwa = błąd wprost (literówka nie może po cichu wyłączyć narzędzi). */
export function grupyZ(argv = process.argv.slice(2), env = process.env) {
    const z = argv.find((x) => x.startsWith('--grupy='))?.slice(8) ?? env.OTAKOS_MCP_GRUPY ?? '';
    if (!z.trim()) return [...GRUPY];
    const l = z.split(',').map((x) => x.trim()).filter(Boolean);
    const zle = l.filter((x) => !GRUPY.includes(x));
    if (zle.length) throw new Error(`Nieznane grupy: ${zle.join(', ')} (są: ${GRUPY.join(', ')})`);
    return l;
}

/**
 * Serwer: obsluz(wiadomosc) → odpowiedź JSON-RPC albo null (powiadomienia).
 * @param {{ most?: string, grupy?: string[], fetch?: Function }} o
 */
export function utworzSerwer({ most = process.env.OTAKOS_MOST || 'http://127.0.0.1:3001', grupy = GRUPY, fetch: f = globalThis.fetch, wersja = '1.0.0' } = {}) {
    let wybrana = process.env.OTAKOS_MCP_GRA || null;
    const aktywne = NARZEDZIA.filter((n) => grupy.includes(n.grupa));

    async function wolaj(metoda, sciezka, cialo) {
        let r;
        try {
            r = await f(`${most}${sciezka}`, { method: metoda, headers: cialo ? { 'Content-Type': 'application/json' } : {}, body: cialo ? JSON.stringify(cialo) : undefined, signal: AbortSignal.timeout(15 * 60_000) });
        } catch (e) { throw new Error(`Most Katedry nie odpowiada (${most}): ${e.message}. Czy Katedra działa?`); }
        const tekst = await r.text();
        let j; try { j = JSON.parse(tekst); } catch { j = null; }
        if (!r.ok || j?.success === false) throw new Error(`${metoda} ${sciezka} → HTTP ${r.status}: ${j?.message ?? j?.error ?? tekst.slice(0, 300)}`);
        return j ?? { tekst };
    }
    const ctx = {
        most: wolaj,
        wybrana: () => wybrana,
        ustawProjekt: (id) => { wybrana = id; },
        projekt: (a, opcjonalny = false) => {
            const p = a?.projekt || wybrana;
            if (!p && !opcjonalny) throw new Error('Którą grę? Podaj `projekt` albo wybierz gs_wybierz_gre (lista: gs_gry).');
            return p || null;
        },
        obraz: async (sciezka) => {
            const r = await f(`${most}${sciezka}`, { signal: AbortSignal.timeout(30_000) });
            if (!r.ok) throw new Error(`zrzut: HTTP ${r.status}`);
            return { type: 'image', data: Buffer.from(await r.arrayBuffer()).toString('base64'), mimeType: 'image/png' };
        },
    };

    async function wywolaj(nazwa, args = {}) {
        const n = aktywne.find((x) => x.nazwa === nazwa);
        if (!n) return { isError: true, content: [{ type: 'text', text: NARZEDZIA.some((x) => x.nazwa === nazwa) ? `Narzędzie ${nazwa} jest w grupie wyłączonej w tym serwerze (--grupy=${grupy.join(',')}).` : `Nie ma narzędzia ${nazwa}.` }] };
        if (n.ciezkie && args?.zgoda !== true) return { isError: true, content: [{ type: 'text', text: `${nazwa} to ciężka/płatna akcja — potrzebna jawna zgoda Suwerena (zgoda: true). Zapytaj go, zanim wywołasz ponownie.` }] };
        try {
            const w = await n.wykonaj(args ?? {}, ctx);
            if (w && w.obraz && w.tresc) return { content: [{ type: 'text', text: skroc(w.tresc) }, w.obraz] };
            return { content: [{ type: 'text', text: skroc(w) }] };
        } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
    }

    async function obsluz(w) {
        const { id, method, params } = w ?? {};
        const ok = (result) => ({ jsonrpc: '2.0', id, result });
        const blad = (code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
        if (w?.jsonrpc !== '2.0' || typeof method !== 'string') return id === undefined ? null : blad(-32600, 'Invalid Request');
        if (id === undefined) return null;   // powiadomienie (notifications/initialized, cancelled…)
        switch (method) {
            case 'initialize': {
                const chce = params?.protocolVersion;
                return ok({ protocolVersion: WERSJE_PROTOKOLU.includes(chce) ? chce : WERSJE_PROTOKOLU[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: NAZWA, version: wersja },
                    instructions: `Game Studio Katedry OtakOS (gry three.js w _OtakOs_Apki). Grupy: ${grupy.join(', ')}. Najpierw gs_gry i gs_wybierz_gre. Przed zapisem kodu gry: gs_waliduj. Po budowie: gs_test_gry. Narzędzia z zgoda: true pytają Suwerena — nie ustawiaj zgody sam.` });
            }
            case 'ping': return ok({});
            case 'tools/list': return ok({ tools: aktywne.map((n) => ({ name: n.nazwa, description: `[${n.grupa}] ${n.opis}`, inputSchema: n.schemat, annotations: { readOnlyHint: !n.ciezkie && !['gs_do_gry', 'gs_przerwij_produkcje', 'unity_eksport_bryly'].includes(n.nazwa), destructiveHint: false, openWorldHint: n.nazwa === 'gs_meshy_zlec' } })) });
            case 'tools/call': return ok(await wywolaj(params?.name, params?.arguments));
            case 'resources/list': return ok({ resources: [] });
            case 'prompts/list': return ok({ prompts: [] });
            default: return blad(-32601, `Method not found: ${method}`);
        }
    }
    return { obsluz, wywolaj, narzedzia: aktywne };
}

/** Pętla stdio: linia JSON → odpowiedź linią JSON. */
export function uruchomStdio(serwer, wejscie = process.stdin, wyjscie = process.stdout) {
    const rl = readline.createInterface({ input: wejscie });
    // Po kolei, w kolejności przyjścia: gs_wybierz_gre musi skończyć się przed narzędziem, które z niej korzysta.
    let kolejka = Promise.resolve();
    rl.on('line', (linia) => {
        if (!linia.trim()) return;
        kolejka = kolejka.then(async () => {
            let w;
            try { w = JSON.parse(linia); } catch { wyjscie.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`); return; }
            const lista = Array.isArray(w) ? w : [w];
            const odp = [];
            for (const x of lista) { const o = await serwer.obsluz(x); if (o) odp.push(o); }
            if (odp.length) wyjscie.write(`${JSON.stringify(Array.isArray(w) ? odp : odp[0])}\n`);
        }).catch((e) => process.stderr.write(`[${NAZWA}] ${e.message}\n`));
    });
    return rl;
}

const glowny = !!process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase() === import.meta.url.toLowerCase();
if (glowny) {
    try {
        const grupy = grupyZ();
        uruchomStdio(utworzSerwer({ grupy }));
        process.stderr.write(`[${NAZWA}] gotowy, grupy: ${grupy.join(', ')}, most: ${process.env.OTAKOS_MOST || 'http://127.0.0.1:3001'}\n`);
    } catch (e) { process.stderr.write(`[${NAZWA}] ${e.message}\n`); process.exit(2); }
}
