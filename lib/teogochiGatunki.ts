/**
 * 🥚 Gatunki TeOgochi — 13 szablonów, z których wykluwają się agenci zadaniowi.
 *
 * Joanna była pierwsza i jedyna. Teraz jest JEDNYM z gatunków — muzycznym.
 * Każdy gatunek to osobny agent z własną dziedziną, własnym jajem, własną
 * ścieżką ewolucji i własnym zestawem narzędzi po stronie mostu.
 *
 * ⚠️ `narzedzia` to REALNE trasy mostu, nie życzenia. Gdy któraś nie istnieje,
 * panel gatunku ma powiedzieć to wprost, zamiast udawać, że agent coś potrafi.
 * Stan „które trasy naprawdę żyją" sprawdza się przez /api/mcp/status i katalog
 * tras — nie przez wiarę w tę tablicę.
 *
 * Etapy są wspólne dla wszystkich (patrz teogochiState.ts): jajko → pisklę →
 * młodzik → kompan → legenda. Różni się WYGLĄD na każdym etapie — jajko sroki
 * ma inny wzór niż jajko żółwia, a wykluwa się co innego.
 */
import type { TeogochiStage } from './teogochiState';

export interface Gatunek {
    id: string;
    /** Imię własne agenta — tak się do niego mówi. */
    imie: string;
    /** Dziedzina, za którą odpowiada. */
    dziedzina: string;
    /** Jedno zdanie: co ten agent robi dla Suwerena. */
    opis: string;
    /** Wygląd na każdym etapie. Jajko każdego gatunku wygląda inaczej. */
    formy: Record<TeogochiStage, string>;
    /** Kolor akcentu panelu (hex). */
    kolor: string;
    /** Trasy mostu, z których gatunek korzysta. */
    narzedzia: string[];
    /** Przykładowe polecenia — to, co Suweren może powiedzieć przez Orba. */
    zadania: string[];
    /** Głos Pipera; brak = domyślny żeński. */
    glos?: string;
}

export const GATUNKI: Gatunek[] = [
    {
        id: 'joanna', imie: 'Joanna', dziedzina: 'Muzyka',
        opis: 'Zapowiada utwory, prowadzi radio, dobiera brzmienia i pilnuje nastroju Katedry.',
        formy: { 'jajko': '🥚', 'pisklę': '🐣', 'młodzik': '🐤', 'kompan': '🐥', 'legenda': '🕊️' },
        kolor: '#a855f7',
        narzedzia: ['/api/joanna/zapowiedz', '/api/music/generate', '/api/voice/speak'],
        zadania: ['Joanna, stwórz utwór', 'Joanna, zapowiedz następny kawałek', 'Joanna, zrób playlistę na wieczór'],
        glos: 'pl_PL-gosia-medium',
    },
    {
        id: 'klatka', imie: 'Klatka', dziedzina: 'Film i wideo',
        opis: 'Tnie materiał, układa kadry, pilnuje rytmu montażu i renderuje gotowe ujęcia.',
        formy: { 'jajko': '🥚', 'pisklę': '🦎', 'młodzik': '🦖', 'kompan': '🐉', 'legenda': '🐲' },
        kolor: '#22d3ee',
        narzedzia: ['/api/video/edit', '/api/bridge/execute', '/api/animacja/renderuj'],
        zadania: ['Klatka, zmontuj vlog ze spawania', 'Klatka, wytnij ciszę i „yyy"', 'Klatka, dorób napisy'],
    },
    {
        id: 'bilans', imie: 'Bilans', dziedzina: 'Biznes',
        opis: 'Pilnuje rejestru działalności, liczy przepływy GRV i mówi, gdzie ucieka energia.',
        formy: { 'jajko': '🥚', 'pisklę': '🐜', 'młodzik': '🐝', 'kompan': '🦋', 'legenda': '👑' },
        kolor: '#fbbf24',
        narzedzia: ['/api/grv/ledger', '/api/grv/oddech', '/api/business/telefonia'],
        zadania: ['Bilans, pokaż saldo węzła', 'Bilans, co zjadło najwięcej GRV', 'Bilans, zamknij miesiąc'],
    },
    {
        id: 'paleta', imie: 'Paleta', dziedzina: 'Sztuka',
        opis: 'Dobiera barwy, buduje systemy wizualne i pilnuje, żeby Katedra nie zszarzała.',
        formy: { 'jajko': '🥚', 'pisklę': '🐛', 'młodzik': '🦋', 'kompan': '🎨', 'legenda': '🌈' },
        kolor: '#ec4899',
        narzedzia: ['/api/wiedza/design/dopasuj', '/api/animacja/z-projektu'],
        zadania: ['Paleta, dobierz kolory do apki', 'Paleta, zaprojektuj okładkę', 'Paleta, sprawdź spójność wizualną'],
    },
    {
        id: 'kodeks', imie: 'Kodeks', dziedzina: 'Kod',
        opis: 'Czyta kod Katedry, znajduje usterki i proponuje łatki — nie commituje sam.',
        formy: { 'jajko': '🥚', 'pisklę': '🐌', 'młodzik': '🦗', 'kompan': '🦂', 'legenda': '🐙' },
        kolor: '#10b981',
        narzedzia: ['/api/mechanic/queue', '/api/mechanic/dziennik', '/api/mechanic/co-wiem', '/api/mechanic/model'],
        zadania: ['Kodeks, znajdź czemu most oddaje 400', 'Kodeks, przejrzyj ostatnią zmianę', 'Kodeks, pokaż zależności tego pliku'],
    },
    {
        id: 'kronikarz', imie: 'Kronikarz', dziedzina: 'Pisanie',
        opis: 'Prowadzi Kronikę, zapisuje dzień Katedry i pilnuje, żeby nic ważnego nie przepadło.',
        formy: { 'jajko': '🥚', 'pisklę': '🐁', 'młodzik': '🐀', 'kompan': '🦉', 'legenda': '📜' },
        kolor: '#8b5cf6',
        narzedzia: ['/api/kronika/forge', '/api/dziennik/wpis'],
        zadania: ['Kronikarz, zapisz dzisiejszy dzień', 'Kronikarz, streść ostatni tydzień', 'Kronikarz, znajdź wpis o Joannie'],
    },
    {
        id: 'wektor', imie: 'Wektor', dziedzina: 'Wiedza',
        opis: 'Zna graf Katedry — powie, co z czym się łączy i którędy biegnie najkrótsza droga.',
        formy: { 'jajko': '🥚', 'pisklę': '🕷️', 'młodzik': '🕸️', 'kompan': '🧿', 'legenda': '🔮' },
        kolor: '#06b6d4',
        narzedzia: ['/api/wiedza/wyjasnij', '/api/wiedza/sciezka', '/api/wiedza/buduj'],
        zadania: ['Wektor, wyjaśnij TeoArcadeForge', 'Wektor, znajdź drogę od Orba do mostu', 'Wektor, przelicz graf'],
    },
    {
        id: 'spawacz', imie: 'Spawacz', dziedzina: 'Warsztat workflow',
        opis: 'Pisze i spina grafy ComfyUI dla reszty stada — Joanna dostaje od niego to, na czym liczy. '
            + 'Skleja też klocki wydania: intro, wkład, outro.',
        formy: { 'jajko': '🥚', 'pisklę': '🔩', 'młodzik': '⚙️', 'kompan': '🔧', 'legenda': '⚡' },
        kolor: '#f97316',
        // ⚠️ Graf w formacie UI most odrzuci przy zapisie — Spawacz ma oddawać
        // eksport API („Workflow → Export (API)"), bo tylko taki da się uruchomić.
        narzedzia: ['/api/music/workflows', '/api/music/workflow', '/api/bridge/execute'],
        zadania: ['Spawacz, pokaż grafy w warsztacie', 'Spawacz, napisz workflow dla Joanny', 'Spawacz, sklej odcinek do YT'],
    },
    {
        id: 'glosek', imie: 'Głosek', dziedzina: 'Głos i lektor',
        opis: 'Czyta teksty polskim głosem, robi lektora do materiałów, klonuje barwy.',
        formy: { 'jajko': '🥚', 'pisklę': '🐸', 'młodzik': '🦜', 'kompan': '🦚', 'legenda': '🎙️' },
        kolor: '#14b8a6',
        narzedzia: ['/api/voice/speak', '/api/voice/render', '/api/voice/piper/glosy'],
        zadania: ['Głosek, przeczytaj ten tekst', 'Głosek, zrób lektora do filmu', 'Głosek, pokaż dostępne głosy'],
        glos: 'pl_PL-bass-high',
    },
    {
        id: 'straznik', imie: 'Strażnik', dziedzina: 'Bezpieczeństwo',
        opis: 'Pilnuje sekretów, skanuje łatki przed zapisem i wyłapuje atrapy udające działanie.',
        formy: { 'jajko': '🥚', 'pisklę': '🐢', 'młodzik': '🦔', 'kompan': '🦡', 'legenda': '🛡️' },
        kolor: '#ef4444',
        narzedzia: ['/api/mcp/execute', '/api/vault/status'],
        zadania: ['Strażnik, przeskanuj ten katalog na atrapy', 'Strażnik, sprawdź skarbiec', 'Strażnik, co wystawia tunel'],
    },
    {
        id: 'ogrodnik', imie: 'Ogrodnik', dziedzina: 'Agro i maszyny',
        opis: 'Dogląda floty, traktorków i wszystkiego, co ma koła albo korzenie.',
        formy: { 'jajko': '🥚', 'pisklę': '🌱', 'młodzik': '🌿', 'kompan': '🌳', 'legenda': '🚜' },
        kolor: '#84cc16',
        narzedzia: ['/api/craft/recipes', '/api/craft/plan'],
        zadania: ['Ogrodnik, zaplanuj budowę', 'Ogrodnik, pokaż surowce', 'Ogrodnik, co posiać w tym tygodniu'],
    },
    {
        id: 'kupiec', imie: 'Kupiec', dziedzina: 'Marketplace',
        opis: 'Wystawia, wycenia i pilnuje obiegu w Marketplace — po stronie Prawej Ekonomii.',
        formy: { 'jajko': '🥚', 'pisklę': '🐹', 'młodzik': '🦫', 'kompan': '🦝', 'legenda': '💎' },
        kolor: '#eab308',
        narzedzia: ['/api/market/list', '/api/grv/register'],
        zadania: ['Kupiec, wystaw ten skill', 'Kupiec, wyceń pakiet', 'Kupiec, pokaż obrót'],
    },
    {
        id: 'rezyser', imie: 'Reżyser', dziedzina: 'Narracja',
        opis: 'Trzyma kanon serialu, pilnuje obsady i spójności świata między odcinkami.',
        formy: { 'jajko': '🥚', 'pisklę': '🐒', 'młodzik': '🦧', 'kompan': '🦁', 'legenda': '🎬' },
        kolor: '#f43f5e',
        narzedzia: ['/api/rezyser/pamiec', '/api/rezyser/postacie'],
        zadania: ['Reżyser, dopisz fakt do kanonu', 'Reżyser, kto gra w tym odcinku', 'Reżyser, domknij odcinek'],
    },
];

export const gatunekPo = (id: string): Gatunek | undefined => GATUNKI.find(g => g.id === id);

/** Wygląd danego gatunku na danym etapie. Nieznany gatunek → neutralne jajko. */
export function formaGatunku(id: string, etap: TeogochiStage): string {
    return gatunekPo(id)?.formy[etap] ?? '🥚';
}

export default GATUNKI;
