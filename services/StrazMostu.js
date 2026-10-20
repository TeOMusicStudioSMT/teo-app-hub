/**
 * 🛡️ StrazMostu — autoryzacja i ograniczenie zasięgu Wiesio-Bridge (0.00G)
 *
 * PROBLEM, KTÓRY ROZWIĄZUJE: Most nie miał ŻADNEJ kontroli — każde żądanie było
 * równe, a wystawia `EXEC_SYSTEM_CMD` (dowolna komenda PowerShell) i `WRITE_FILE`.
 * Przy otwartym Kwantowym Tunelu ktokolwiek znający adres miał zdalne wykonanie
 * kodu na maszynie Suwerena — obok `identity.json`, walleta i `.env`.
 *
 * DWIE WARSTWY, CELOWO NIEZALEŻNE:
 *
 *  1. KLUCZ SESJI — żądanie spoza maszyny musi go podać. Odcina skanery,
 *     przypadkowych gości i boty pukające po adresach *.trycloudflare.com.
 *
 *  2. OGRANICZENIE ZASIĘGU — nawet Z POPRAWNYM KLUCZEM żądanie zdalne nie
 *     uruchomi komendy systemowej ani nie zapisze pliku. To jest ta ważniejsza
 *     warstwa: kod QR NIESIE klucz, więc zdjęcie ekranu = wyciek klucza.
 *     Bez drugiej warstwy wyciek QR znaczyłby przejęcie maszyny; z nią znaczy
 *     tyle, że ktoś obcy może przełączyć Suwerenowi utwór w radiu.
 *
 * Maszyna Suwerena (localhost) działa jak dotąd — bez klucza, bez ograniczeń.
 * Kto siedzi przy klawiaturze, ma i tak pełny dostęp do systemu.
 */

import crypto from 'crypto';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

/** Plik klucza. Rozszerzenie `.key` jest już objęte `.gitignore` (`*.key`). */
const PLIK_KLUCZA = 'straz_mostu.key';

/** Nazwa nagłówka i parametru — parametr przydaje się dla <audio>/<img>, gdzie nagłówka nie da się dołożyć. */
export const NAGLOWEK_KLUCZA = 'x-teo-klucz';
export const PARAM_KLUCZA = 'k';

/**
 * Akcje, których żądanie ZDALNE nie wykona nigdy — nawet z poprawnym kluczem.
 * Lista jest jawna i konserwatywna: jak coś zapisuje, uruchamia albo kasuje, to tu jest.
 */
export const AKCJE_TYLKO_LOKALNE = new Set([
    'EXEC_SYSTEM', 'EXEC_SYSTEM_CMD', 'EXEC_COMMAND', 'EXEC_OLLAMA_CLI',
    'WRITE_FILE', 'WRITE_FILE_CONTENT', 'APPEND_CHUNK',
    'DELETE_LOCAL_PREMIERE', 'LIST_MOVE',
    'SAVE_KRONIKA', 'SAVE_METADATA', 'SAVE_PODCAT', 'SAVE_SONIC_VECTORS',
    'MCP_UI_BUILD', 'FINISH_PODCAT',
]);

/**
 * Ścieżki REST, których żądanie ZDALNE nie dotknie (dopasowanie po prefiksie).
 * Mechanik stosuje łatki do kodu, kuźnie zapisują pliki, głos klonuje próbki —
 * to wszystko należy do maszyny, nie do tunelu.
 */
export const SCIEZKI_TYLKO_LOKALNE = [
    '/api/mechanic/apply', '/api/mechanic/enqueue', '/api/mechanic/reject',
    '/api/forge/', '/api/gameforge/', '/api/voice/clone',
    '/api/teledysk/render', '/api/video/edit',
    '/api/straz/',
    '/api/tunel/',   // tunelu nie odpala się (ani nie gasi) z tunelu
    '/api/system/free',   // zamyka procesy na maszynie
    '/api/choreografie', '/api/taniec/',   // 🩰 choreografie, nagrania występów i zgłoszenia do turniejów — przy maszynie
    '/api/gol-dnia',   // ⚽ Gol Dnia: zwiad w sieci (koszt), FLUX, głos, publikacja — tylko przy maszynie
    '/api/zebrra-taniec',   // 🩰 Taniec w Zebrra Sports: model, głos, nagranie, publikacja — tylko przy maszynie
    '/api/mame-leon',   // 🦎 Mame Leon Show: model, głos, nagranie, publikacja — tylko przy maszynie
    '/api/zebrra-news',   // 📰 Zebrra News: nagłówki z sieci, model, FLUX, głos, nagranie, publikacja — tylko przy maszynie
    '/api/game-show',   // 🎪 odcinki TeO Game Show (GPU, ffmpeg) i kanał programu — przy maszynie; ✓ publikacji zostaje w Izbie
    '/api/suno-album',   // 🎵 album Suno pobiera pliki do biblioteki muzyki — przy maszynie
    // Stado należy do Katedry: telefon (StoL) PATRZY — nie publikuje migawki, nie paruje
    // innych urządzeń i nie odłącza ich. Jego jedyne zdalne wejście to /api/stado/paruj.
    '/api/stado/publikuj', '/api/stado/parowanie', '/api/stado/odlacz',
    '/api/stado/projekt/', '/api/stado/model',   // ponawianie zleceń i zmiana silników — decyzje Suwerena przy maszynie
    '/api/stado/powitanie/zrob',   // film powitania liczy się na karcie graficznej maszyny
    '/api/kuznia-soup/',
    '/api/kuznia-colab',   // 🧪 notatnik Colab niesie dane treningowe Katedry — składa się i pobiera tylko przy maszynie
    // 📺 Konto YouTube (klient OAuth, łączenie, rozłączanie) i skarbiec kluczy — tylko przy maszynie.
    // Publikacje (/api/youtube/publikacje*) telefon może zatwierdzać z kluczem (Izba Akceptacji).
    '/api/impresario/youtube/', '/api/impresario/secrets/',
    // 📱 Formaty i sieci: ffmpeg na maszynie, konta TikTok/Instagram (klucze aplikacji, OAuth) i ✓ wysyłki do sieci — tylko przy maszynie
    '/api/formaty', '/api/impresario/tiktok/', '/api/impresario/instagram/',
    '/api/pliki/upusc',   // zapis upuszczonego pliku do katalogu projektu — tylko przy maszynie   // trening modeli trwa godziny na karcie graficznej i pisze po dysku — tylko przy maszynie
    '/api/zwiadowca/szukaj', '/api/zwiadowca/kandydat/', '/api/zwiadowca/link', '/api/zwiadowca/promocje',   // zwiad i pobieranie modeli (GB na dysk) — decyzja przy maszynie
    '/api/porzadki/usun',   // kasowanie plików i modeli — tylko przy maszynie
    '/api/glowny/',   // Główny (Claude Code) zmienia pliki Katedry — rozmowa i zgody tylko przy maszynie
    '/api/ted/',   // 💹 TeD (prywatny moduł): klucze portfela, zakłady, swapy, zlecenia giełdowe — prawdziwe pieniądze, tylko przy maszynie
    '/api/argo/',   // ⚗️ Argo BoB (Gemini) czyta pliki Katedry i TGS, zmienia je po ✓ — rozmowa i zgody tylko przy maszynie
    '/api/aktualizacja/zastosuj', '/api/aktualizacja/cofnij',   // podmiana kodu Katedry — tylko przy maszynie
    '/api/wizytowka/',   // profil i meldunek wizytówki zmienia Suweren przy Katedrze (sama /api/wizytowka jest publiczna)
    '/api/dyrygent/zastosuj', '/api/modele/karta',   // stałe silniki TeOgochi i karty modeli zmienia Suweren przy Katedrze
    '/api/dyrygent/partytury', '/api/dyrygent/straz',   // 📜 partytury i 🛡️ straż modeli (zmienia przydział silników) — tylko przy Katedrze
    '/api/klub-mistrzow',   // 🏛️ Klub Mistrzów: ogłaszanie eventów globalnych i zwiad po sieci — decyzje przy Katedrze
    '/api/mistrz-gry',   // 🎲 Mistrz Gry Teterhii: orzeczenia na Jev/modelu (koszt) i kronika — gra z mostu Katedry (gość zdalny = etap MRPG)
    '/api/aranz',   // 🎼 Joanna aranżuje szkic: model Joanny, pliki biblioteki, ACE-Step na karcie — tylko przy Katedrze
    '/api/jam',   // 🎹 Jam z Joanną: model Joanny i zapis nagrania do biblioteki muzyki — tylko przy Katedrze
    '/api/kompozytor',   // 🏛️⚡ JaJo Kompozytor: osie czasu na modelu Katedry, zamówienia u Joanny (GPU) — tylko przy Katedrze
    '/api/mistrz',   // 🥚 JaJo Mistrza: dziennik poprawek Suwerena i lekcje na jego modelu — tylko przy Katedrze
    '/api/modele/zadania',   // 🎯 wybór modeli zadań technicznych — decyzja przy Katedrze
    '/api/postac-katedry',   // 🏛️ postać Katedry: FLUX/TRELLIS, zdjęcie z dysku, publikacja — tylko przy Katedrze (plik postaci publicznie: /wizytowka/postac.glb)
    '/api/bestiariusz',   // 🐾 Bestiariusz Mini — zapis do plików gry, tylko przy Katedrze
    '/api/bohaterowie',   // 🧝 bohaterowie gry: FLUX/TRELLIS na karcie i zapis do plików gry — tylko przy Katedrze
    '/api/merch',   // 🖨️ Pracownia merchu: kredyty Meshy, pliki brył wychodzą z Katedry — tylko przy maszynie
    '/api/assety3d/chmura',   // ☁️ Meshy = rachunek za kredyty i bryła wychodzi z Katedry — tylko przy maszynie
    '/api/aktorzy', '/api/wywiady',   // 🎭 obsada wskazuje zdjęcia z dysku, nagranie liczy ffmpeg na maszynie — tylko przy Katedrze
    '/api/studio-podcast',   // 🎙️ Studio Podcastu: zdjęcia z dysku, ffmpeg i klon głosu — tylko przy Katedrze
    '/api/sceny',   // 💬 Sceny dialogowe: kadry z dysku i ffmpeg — tylko przy Katedrze
    '/api/studio3d',   // 🧊 Studio 3D z kadru: zdjęcia z dysku, model głębi i Blender — tylko przy Katedrze
    '/api/usta',   // 👄 Usta aktorów: instalacja środowiska i wag — tylko przy Katedrze
    '/api/skladnica', // 📦 Składnica: wspólne assety (zapis, import z dysku, kosz) — tylko przy Katedrze
    '/api/gielda-mocy',   // ⚡ Giełda mocy: oferta tej Katedry ustawia się tylko przy niej
    '/api/vault/status', '/api/vault/set', '/api/vault/sekret/', '/api/vault/resetuj',   // 🔐 Skarbiec 0.00G — tylko przy Katedrze
    '/api/stripe', '/api/sklep-mini',   // 💳🐾 płatności Stripe i Sklep Mini (zgody na kredyty Meshy, wystawianie) — tylko przy Katedrze
    '/api/kibel/most', '/api/modele/chmura',   // 🔗 klucze Kibla dla mostu i modele z konta dostawcy — tylko przy Katedrze
    '/api/jev',   // ⚖️ Jev (TypeSafe) = rachunek za tokeny — tylko przy Katedrze
    '/api/koherencja',   // 🫀 Koherencja Katedry — nazwy modeli i błędy mostu, tylko przy maszynie
    '/api/mozg',   // 🧠 Mózg Katedry: domyślne modele Katedry — ustawia tylko Suweren przy Katedrze
    '/api/tryb',   // ☁️/🏠 Tryb Katedry (CLOUD/JusT) = rachunek za tokeny — przełącza tylko Suweren przy Katedrze
    '/api/glos/',   // 🎙️ głos ze stemu: zapisuje próbki klonu i profile głosu — tylko przy Katedrze
    '/api/gry/',   // 🏝️ paczki gier: udostępnianie, instalacja cudzej paczki (zapis na dysk) — tylko przy Katedrze; publicznie tylko /wizytowka/gra/…
];

/**
 * Wyjątki od SCIEZKI_TYLKO_LOKALNE (dokładna ścieżka): zdalnie z kluczem sesji wolno, ale sama
 * trasa i tak żąda tokenu SPAROWANEGO telefonu (dostepStada) — sam klucz tunelu nie wystarczy.
 * Suweren (2026-09-24): „tak, pozwól zakładać projekty z telefonu".
 * Suweren (2026-09-29): zwalnianie pamięci „z poziomu Katedry i Stołu" — /api/system/free z telefonu tylko
 * po PID i z tokenem parowania (sprawdza trasa); zamykanie po nazwie zostaje przy maszynie.
 */
/**
 * 🪪 Wizytówka Katedry (services/Wizytowka.js) — JEDYNE, co most pokazuje każdemu bez klucza:
 * GET/HEAD wizytówki i jej plików. Suweren (2026-10-02): wizytówki Katedr przewijane na otakos.wtf.
 * Adres tunelu trafia wtedy do rejestru, więc wszystko poza tą listą dalej żąda klucza sesji.
 * Trasy same oddają 404, gdy Katedra nie ma nicka (wizytówka wyłączona).
 */
export const SCIEZKI_WIZYTOWKI = { dokladne: new Set(['/api/wizytowka', '/wizytowka/postac.glb']), prefiksy: ['/wizytowka/plik/', '/wizytowka/plakat/', '/wizytowka/postac-'] };
/**
 * 🏝️ Paczki gier (services/PaczkiGier.js): manifest, zip i pliki gry dla gościa — z podkatalogami (assets/, assety/),
 * dlatego osobny prefiks. Trasa sama oddaje 404 dla gier, których Suweren nie udostępnił, i nie wychodzi poza dist.
 */
export const PREFIKS_GIER = '/wizytowka/gra/';
export const SCIEZKA_PLATNOSCI = /^\/wizytowka\/gra\/[a-z0-9-]{2,48}\/platnosc$/;
export const SCIEZKA_PLACU = /^\/wizytowka\/plac\/[a-z0-9-]{2,48}(\/wyjdz)?$/;
/** 💃🥊 Ring taneczny (services/RingTaneczny.js): lista pokoi (GET), meldunki pojedynku (POST) — w pamięci mostu, bez modeli. */
/** 🐾🛒 Sklep Mini (services/SklepMini.js): zakup = sesja Stripe zakładana przez most (cena z rzadkości liczy most). */
export const SCIEZKA_ZAKUPU = /^\/wizytowka\/sklep\/pk-[0-9a-f]{8}\/kup$/;
/** Okładka wystawionego pakietu, odbiór i pobranie opłaconego (sprawdzane w Stripe). */
export const SCIEZKA_SKLEPU = /^\/wizytowka\/sklep\/(pk-[0-9a-f]{8}\/okladka\.png|odbior|pobierz)$/;
export const SCIEZKA_RINGU = /^\/wizytowka\/ring(\/r-[a-z0-9]{6,16}(\/wyjdz)?)?$/;
export function czyWizytowka(req) {
    // 💬 Skrzynka TOST (services/TostSiec.js): inne Katedry wrzucają tu koperty — szyfrowane, podpisane,
    // nadawca sprawdzany w rejestrze otakos.wtf. Tylko POST tej jednej ścieżki.
    if (req.method === 'POST' && req.path === '/api/tost/skrzynka') return true;
    // 👥 Plac obecności (services/PlacObecnosci.js): gracze udostępnionej gry meldują pozycję — w pamięci mostu, bez modeli.
    if ((req.method === 'POST' || req.method === 'OPTIONS') && SCIEZKA_PLACU.test(String(req.path || ''))) return true;
    // 💃🥊 Ring taneczny: pojedynki Mini-TeOgochi między Katedrami (otwarcie pokoju i tak tylko maszyna — sprawdza trasa).
    if (['GET', 'HEAD', 'POST', 'OPTIONS'].includes(req.method) && SCIEZKA_RINGU.test(String(req.path || ''))) return true;
    // 💳 Zapłata innej Katedry za grę (services/RozliczeniaKatedr.js): zlecenie podpisane jej kluczem, sprawdzane kluczem z rejestru.
    if ((req.method === 'POST' || req.method === 'OPTIONS') && SCIEZKA_PLATNOSCI.test(String(req.path || ''))) return true;
    if ((req.method === 'POST' || req.method === 'OPTIONS') && SCIEZKA_ZAKUPU.test(String(req.path || ''))) return true;
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const p = String(req.path || '');
    if (SCIEZKA_SKLEPU.test(p)) return true;
    if (p.startsWith(PREFIKS_GIER) && !p.includes('..') && !p.includes('\\')) return true;
    return SCIEZKI_WIZYTOWKI.dokladne.has(p) || SCIEZKI_WIZYTOWKI.prefiksy.some((x) => p.startsWith(x) && !p.slice(x.length).includes('/'));
}

/**
 * 📺 Powrót z ekranu zgody Google (services/YouTubeKonto.js): przeglądarka Suwerena przechodzi
 * z accounts.google.com na http://127.0.0.1:3001/api/impresario/youtube/zwrot — z Refererem Google,
 * więc zrodloZadania mówi „obce”. Wpuszczamy TYLKO: GET tej jednej ścieżki, z gniazda pętli zwrotnej,
 * bez nagłówków tunelu, z Host = ta maszyna (żadnego DNS rebinding). Podrzucony kod odpada na `state`.
 */
export const SCIEZKA_ZWROTU_YOUTUBE = '/api/impresario/youtube/zwrot';
/** 📱 Te same zasady dla powrotów z TikTok (Login Kit) i Facebooka (Instagram) — services/KontaSieci.js. */
export const SCIEZKI_ZWROTU_OAUTH = new Set([SCIEZKA_ZWROTU_YOUTUBE, '/api/impresario/tiktok/zwrot', '/api/impresario/instagram/zwrot']);
export function czyZwrotYouTube(req) {
    if (req.method !== 'GET' || !SCIEZKI_ZWROTU_OAUTH.has(req.path)) return false;
    if (req.get?.('cf-connecting-ip') || req.get?.('x-forwarded-for') || req.get?.('cf-ray')) return false;
    if (!IP_PETLI.has(String(req.ip || req.socket?.remoteAddress || ''))) return false;
    return HOST_MASZYNY.test(String(req.get?.('host') || ''));
}

export const SCIEZKI_DLA_SPAROWANYCH = new Set(['/api/stado/projekt/nowy', '/api/system/free']);

/**
 * Publiczne strony Suwerena, które w JEGO przeglądarce czytają żywe dane z mostu
 * (teo.center: stan Katedry i playlista radia; otakos.wtf: mapa AGI na żywo).
 * Dostają ZASIĘG ZDALNY bez klucza: czytać tak, uruchamiać i zapisywać nie.
 * Dopisanie kolejnej: zmienna środowiskowa OTAKOS_ZAUFANE_ORIGINY="https://a.pl,https://b.pl".
 */
export const ZAUFANE_PUBLICZNE = ['https://otakos.wtf', 'https://www.otakos.wtf', 'https://teo.center', 'https://www.teo.center'];

/**
 * Strona publiczna nie niesie klucza, więc dostaje BIAŁĄ listę, nie czarną: odczyt (GET/HEAD)
 * i te akcje Śluzy, których te strony naprawdę używają. Czarna lista zasięgu zdalnego jest dobra
 * dla tunelu z kluczem — tu byłaby o jedno przeoczenie od dziury (patrz /api/system/free).
 */
export const AKCJE_STRON_PUBLICZNYCH = new Set(['GET_LOCAL_PLAYLIST']);

const HOST_MASZYNY = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const IP_PETLI = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

/** Origin z nagłówka Origin, a gdy go brak (np. <audio src>, <img>) — z Referera. */
function originZadania(req) {
    const o = req.get?.('origin');
    if (o) return o;
    const ref = req.get?.('referer');
    if (!ref) return null;
    try { return new URL(ref).origin; } catch { return null; }
}

/**
 * Skąd przyszło żądanie:
 *  · 'maszyna'   — Hub i substrony z localhost/127.0.0.1 albo narzędzia bez przeglądarki
 *                  (curl, serwisy Node, agenci). Pełny dostęp, bez klucza — jak dotąd.
 *  · 'publiczne' — zaufana publiczna strona Suwerena w jego przeglądarce: bez klucza,
 *                  ale tylko zasięg zdalny (bez komend i zapisu).
 *  · 'obce'      — przeglądarka na TEJ maszynie, ale żądanie wysłała obca strona.
 *  · 'zdalne'    — spoza maszyny (tunel, sieć lokalna).
 *
 * ⚠️ DZIURA ZAŁATANA 2026-09-24: dotąd „lokalne" znaczyło „gniazdo 127.0.0.1", a CORS odbijał
 * każdy origin. Dowolna strona otwarta w przeglądarce Suwerena mogła więc wołać most jak
 * właściciel — łącznie z EXEC_SYSTEM_CMD — a formularz HTML wysyła POST nawet bez preflightu,
 * więc samo CORS niczego tu nie broni. Teraz o „maszynie" decyduje też, KTO wysłał żądanie.
 * Przy okazji: nagłówek Host musi wskazywać maszynę — inaczej to DNS rebinding
 * (obca domena przestawiona na 127.0.0.1 udaje ten sam origin).
 */
export function zrodloZadania(req, { zaufane = ZAUFANE_PUBLICZNE } = {}) {
    // cloudflared działa NA TEJ MASZYNIE i łączy się z mostem z 127.0.0.1 — ale dokłada
    // nagłówki Cloudflare. Kto je ma, jest zdalny, choćby gniazdo mówiło 127.0.0.1
    // (zmierzone 2026-09-17: /api/tunel/stan z internetu → 200 zamiast 403).
    if (req.get?.('cf-connecting-ip') || req.get?.('x-forwarded-for') || req.get?.('cf-ray')) return 'zdalne';
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    if (!IP_PETLI.has(ip)) return 'zdalne';
    const host = req.get?.('host');
    if (host && !HOST_MASZYNY.test(host)) return 'obce';
    const origin = originZadania(req);
    if (!origin) {
        // Brak Origin i Referera: curl, Node, agenci — chyba że przeglądarka sama mówi „cross-site".
        return req.get?.('sec-fetch-site') === 'cross-site' ? 'obce' : 'maszyna';
    }
    let url;
    try { url = new URL(origin); } catch { return 'obce'; }   // „null" (file://, sandbox) też tu ląduje
    if (/^https?:$/.test(url.protocol) && HOST_MASZYNY.test(url.host)) return 'maszyna';
    if (zaufane.includes(url.origin)) return 'publiczne';
    return 'obce';
}

/** Czy żądanie ma pełne prawa maszyny Suwerena (zgodność wstecz — tak jak dawniej `req.lokalny`). */
export function czyLokalny(req, o) {
    return zrodloZadania(req, o) === 'maszyna';
}

/** Wczytaj klucz z dysku albo utwórz nowy przy pierwszym starcie. */
export function wczytajLubUtworzKlucz(katalog) {
    const sciezka = path.join(katalog, PLIK_KLUCZA);
    try {
        const k = fsSync.readFileSync(sciezka, 'utf8').trim();
        if (k.length >= 32) return k;
    } catch { /* brak pliku — tworzymy niżej */ }

    const nowy = crypto.randomBytes(24).toString('hex');   // 48 znaków
    fsSync.mkdirSync(katalog, { recursive: true });
    fsSync.writeFileSync(sciezka, nowy, 'utf8');
    console.log(`[Straż] 🔑 Utworzono nowy klucz sesji (${PLIK_KLUCZA}). Poza repozytorium.`);
    return nowy;
}

/** Wymiana klucza — unieważnia wszystkie stare linki i kody QR. */
export async function przekujKlucz(katalog) {
    const nowy = crypto.randomBytes(24).toString('hex');
    await fs.mkdir(katalog, { recursive: true });
    await fs.writeFile(path.join(katalog, PLIK_KLUCZA), nowy, 'utf8');
    console.log('[Straż] 🔄 Klucz przekuty — poprzednie kody QR i linki są martwe.');
    return nowy;
}

/** Porównanie odporne na atak czasowy. */
function rowneStale(a, b) {
    const x = Buffer.from(String(a || ''), 'utf8');
    const y = Buffer.from(String(b || ''), 'utf8');
    if (x.length !== y.length) return false;
    return crypto.timingSafeEqual(x, y);
}

/**
 * Middleware Straży. Wpiąć PO parserach ciała, PRZED trasami.
 * @param {{ klucz:() => string, pelnyTunel?:boolean }} opcje
 */
export function strazMostu({ klucz, pelnyTunel = false, zaufane = null }) {
    const lista = zaufane ?? [...ZAUFANE_PUBLICZNE, ...String(process.env.OTAKOS_ZAUFANE_ORIGINY || '').split(',').map((x) => x.trim()).filter(Boolean)];
    return (req, res, next) => {
        req.zrodlo = zrodloZadania(req, { zaufane: lista });
        req.lokalny = req.zrodlo === 'maszyna';
        if (req.lokalny) return next();          // własna maszyna — bez zmian
        if (czyWizytowka(req)) return next();     // 🪪 publiczna wizytówka — tylko odczyt, każdy
        if (czyZwrotYouTube(req)) return next();  // 📺 powrót z ekranu zgody Google — patrz niżej

        // ── Żądanie spoza maszyny (albo od obcej strony): najpierw klucz ──
        // Zaufana publiczna strona Suwerena klucza nie niesie — przechodzi dalej, ale tylko
        // w zasięgu zdalnym (niżej): czytać może, uruchamiać i zapisywać nie.
        const podany = req.get(NAGLOWEK_KLUCZA) || req.query?.[PARAM_KLUCZA];
        if (req.zrodlo !== 'publiczne' && !rowneStale(podany, klucz())) {
            console.warn(`[Straż] ⛔ Odrzucone ${req.zrodlo === 'obce' ? 'żądanie obcej strony' : 'zdalne żądanie'} bez klucza: ${req.method} ${req.path}${req.get('origin') ? ` (origin ${req.get('origin')})` : ''}`);
            return res.status(401).json({
                success: false,
                blad: 'BRAK_KLUCZA',
                message: 'Żądanie spoza maszyny Suwerena wymaga klucza sesji. ' +
                         'Otwórz Katedrę linkiem dispatchowym z Kwantowego Tunelu.',
            });
        }

        // ── Zaufana strona publiczna: tylko biała lista ──
        if (req.zrodlo === 'publiczne') {
            const odczyt = req.method === 'GET' || req.method === 'HEAD';
            const akcja = String(req.body?.action || '').toUpperCase();
            const sluzaDoOdczytu = req.method === 'POST' && req.path === '/api/bridge/execute' && AKCJE_STRON_PUBLICZNYCH.has(akcja);
            if (!odczyt && !sluzaDoOdczytu) {
                console.warn(`[Straż] ⛔ Strona publiczna ${req.get('origin') || ''} chciała ${req.method} ${req.path}${akcja ? ` (${akcja})` : ''} — tylko odczyt.`);
                return res.status(403).json({
                    success: false, blad: 'TYLKO_ODCZYT',
                    message: 'Strona publiczna może z mostu tylko czytać. Zmiany robi się z Katedry na maszynie Suwerena.',
                });
            }
        }

        // ── Klucz poprawny (albo zaufana strona), ale zasięg zdalny jest węższy niż lokalny ──
        // Pełny tunel (OTAKOS_TUNEL_PELNY=1) dotyczy tylko tunelu z kluczem — nie stron publicznych.
        if (!pelnyTunel || req.zrodlo === 'publiczne') {
            const sciezkaZakazana = SCIEZKI_TYLKO_LOKALNE.some(p => req.path.startsWith(p))
                && !(req.zrodlo !== 'publiczne' && SCIEZKI_DLA_SPAROWANYCH.has(req.path));
            if (sciezkaZakazana) {
                console.warn(`[Straż] ⛔ Ścieżka tylko lokalna, żądanie zdalne odrzucone: ${req.path}`);
                return res.status(403).json({
                    success: false, blad: 'TYLKO_LOKALNIE',
                    message: `Ścieżka "${req.path}" działa wyłącznie z maszyny Suwerena.`,
                });
            }
            const akcja = String(req.body?.action || req.body?.command || '').toUpperCase();
            if (akcja && AKCJE_TYLKO_LOKALNE.has(akcja)) {
                console.warn(`[Straż] ⛔ Akcja tylko lokalna, żądanie zdalne odrzucone: ${akcja}`);
                return res.status(403).json({
                    success: false, blad: 'TYLKO_LOKALNIE',
                    message: `Akcja "${akcja}" zapisuje lub uruchamia rzeczy na maszynie — ` +
                             'z tunelu jest niedostępna, nawet z poprawnym kluczem.',
                });
            }
        }
        return next();
    };
}

export default { strazMostu, czyLokalny, czyWizytowka, czyZwrotYouTube, SCIEZKI_WIZYTOWKI, zrodloZadania, ZAUFANE_PUBLICZNE, AKCJE_STRON_PUBLICZNYCH, wczytajLubUtworzKlucz, przekujKlucz, NAGLOWEK_KLUCZA, PARAM_KLUCZA };
