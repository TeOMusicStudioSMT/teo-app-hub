/**
 * 🎙️ voiceMcpService.ts — profile głosowe działalności i przewody Voice/Audio MCP.
 *
 * Warstwa Etapu 1 pod klonowanie głosu w module „Twoje Biznesy": który głos
 * obsługuje którą firmę, czym ten głos jest liczony i co z tego DZIŚ działa.
 *
 * ⚠️ DWA POLA, KTÓRYCH NIE WOLNO MYLIĆ — cały sens tego pliku:
 *   · `podpiety`  — przewód jest skonfigurowany (klucz w Skarbcu 0.00G albo
 *                   żywy serwer lokalny),
 *   · `sterownik` — most NAPRAWDĘ potrafi tędy poprowadzić dźwięk.
 *
 * Przewód bywa opłacony, skonfigurowany i kompletnie bezużyteczny, dopóki nikt
 * nie napisał jego obsługi. Panel ma pokazywać oba stany osobno, bo inaczej
 * powstaje dokładnie to, przed czym ostrzega Katedra: zielone światełko przy
 * czymś, co nic nie zrobi.
 *
 * Po Etapie 2 sterownik mają: lokalny klon (XTTS/OpenVoice), Kokoro TTS,
 * ElevenLabs, Whisper.cpp, tor przeglądarki oraz telefonia Twilio. Bez
 * sterownika został Gemini Audio Live — rozmowa dwustronna czeka na Etap 3.
 *
 * ⚠️ ElevenLabs KOSZTUJE kredyty przy każdym wywołaniu. Nie ma tu automatycznego
 * „podbicia jakości" — tor chmurowy wchodzi wyłącznie wtedy, gdy profil głosu
 * jawnie go wskazuje.
 */

import { speak as mowPrzegladarka, type ZrodloGlosu } from '../../services/voiceService';
import { mcpMarketService } from './mcpMarketService';

const MOST = 'http://127.0.0.1:3001';

export type RodzajPrzewodu = 'tts' | 'stt' | 'tts+klon' | 'live' | 'telefonia';

export interface PrzewodGlosu {
    id: string;
    nazwa: string;
    rodzaj: RodzajPrzewodu;
    zrodlo: 'lokalny' | 'chmura';
    glyph: string;
    /** Czy liczy się na maszynie Suwerena (0.00G: lokalność domyślna). */
    suwerenny: boolean;
    /** Czy most ma implementację tego przewodu. `false` = karta katalogu. */
    sterownik: boolean;
    /** Czy jest skonfigurowany (klucz w skarbcu / serwer odpowiada). */
    podpiety: boolean;
    /** Co dokładnie było sprawdzane (adres, pole skarbca, ścieżka binarki). */
    czym: string | null;
    opis: string;
    /** Jedno zdanie prawdy dla UI — złożone po stronie mostu. */
    werdykt: string;
}

export interface ProfilGlosu {
    id: string;
    nazwa: string;
    /** Nazwa próbki klonu: `_OtakOs_AI/voices/<voiceId>.wav`. */
    voiceId: string;
    przewod: string;
    jezyk: string;
    /** Do której działalności przypisany (albo `null` — profil wolny). */
    biznesId: string | null;
    opis: string;
    utworzony: string;
    /** Czy próbka klonu realnie leży na dysku. */
    probkaIstnieje?: boolean;
}

export interface Nagranie {
    plik: string;
    bajty: number;
    kiedy: string;
}

/** Co telefonia potrafi DZIŚ — zwracane przez most, nie zgadywane w UI. */
export interface MozliwosciTelefonii {
    polaczenieWychodzace: boolean;
    mowaTwilio: boolean;
    odbieranieTonow: boolean;
    rozmowaDwustronna: boolean;
    klonSuwerenaWSluchawce: boolean;
    polaczeniaPrzychodzace: boolean;
}

export interface StanPrzewodow {
    przewody: PrzewodGlosu[];
    /** Ile przewodów ma JEDNOCZEŚNIE sterownik i konfigurację. */
    gotowych: number;
    wKatalogu: number;
    telefonia: MozliwosciTelefonii;
    nagrania: Nagranie[];
}

export interface GlosElevenLabs {
    id: string;
    nazwa: string;
    kategoria: string | null;
    opis: string | null;
}

async function zawolaj<T>(sciezka: string, init?: RequestInit): Promise<T> {
    let odp: Response;
    try {
        odp = await fetch(`${MOST}${sciezka}`, {
            ...init,
            headers: init?.body
                ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
                : init?.headers,
        });
    } catch {
        throw new Error('Most (127.0.0.1:3001) milczy — odpal Katedrę.');
    }
    const d = await odp.json().catch(() => ({} as any));
    if (!odp.ok || (d as any)?.success === false) {
        throw new Error((d as any)?.message || `Most odpowiedział HTTP ${odp.status}`);
    }
    return d as T;
}

// ── Przewody ──────────────────────────────────────────────────────────────────

export const stanPrzewodow = () => zawolaj<StanPrzewodow>('/api/voice/mcp');

/**
 * Głosy konta ElevenLabs. Rzuca z konkretem, gdy klucza nie ma w Skarbcu —
 * pusta lista udawałaby konto bez głosów, a to zupełnie inna diagnoza.
 */
export const glosyElevenLabs = () =>
    zawolaj<{ glosy: GlosElevenLabs[] }>('/api/voice/elevenlabs/glosy').then(d => d.glosy);

// ── Profile głosowe ───────────────────────────────────────────────────────────

export const pobierzProfile = () =>
    zawolaj<{ profile: ProfilGlosu[]; katalog: string }>('/api/voice/profiles').then(d => d.profile);

export const zapiszProfil = (dane: Partial<ProfilGlosu>) =>
    zawolaj<{ profil: ProfilGlosu }>('/api/voice/profiles', {
        method: 'POST', body: JSON.stringify(dane),
    }).then(d => d.profil);

export const usunProfil = (id: string) =>
    zawolaj<{ id: string; usuniety: boolean }>(`/api/voice/profiles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });

// ── Mowa ──────────────────────────────────────────────────────────────────────

/**
 * Renderuje mowę do PLIKU w `_OtakOs_Voice/`. Rzuca, gdy lokalnego silnika nie ma
 * — bez niego plik nie powstaje i nie ma czego udawać.
 */
export const renderujDoPliku = (tekst: string, opcje: { profil?: string; voiceId?: string; nazwa?: string } = {}) =>
    zawolaj<{ plik: string; bajty: number; voiceId: string }>('/api/voice/render', {
        method: 'POST', body: JSON.stringify({ text: tekst, ...opcje }),
    });

/**
 * Wypowiada tekst „tu i teraz" profilem działalności.
 *
 * Kolejność: lokalny klon (most) → przeglądarka. Zwracamy `ZrodloGlosu`, więc
 * wołający WIE, czy zabrzmiał klon, głos systemu, czy nie zabrzmiało nic
 * (`cisza`) — tor przeglądarki potrafi milczeć bez gestu użytkownika i
 * `voiceService` uczciwie to zgłasza zamiast udawać sukces.
 */
export async function mowProfilem(tekst: string, profil?: ProfilGlosu | null): Promise<ZrodloGlosu> {
    const voiceId = profil?.voiceId;
    try {
        const r = await fetch(`${MOST}/api/voice/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // `profil` niesie wybór przewodu — bez niego most zawsze brałby
            // lokalny klon i profil ElevenLabs brzmiałby nie swoim torem.
            body: JSON.stringify({ text: tekst, voiceId, profil: profil?.id }),
        });
        if (r.ok) {
            const audio = new Audio(URL.createObjectURL(await r.blob()));
            await audio.play();
            return 'clone';
        }
    } catch {
        // Most albo silnik milczą — spadamy na tor przeglądarki (niżej).
    }
    return mowPrzegladarka(tekst, { voiceId });
}

// ── Most do Skillboardu MCP ───────────────────────────────────────────────────

/**
 * Dopisuje przewód głosowy do rejestru MCP Skillboard jako kartę skilla.
 *
 * ⚠️ ODMAWIA dla przewodów bez sterownika — i to jest cała wartość tej funkcji.
 * `mcpMarketService.addCustomSkill` zapisuje skill ze statusem `active`, więc
 * wrzucenie tam ElevenLabsa czy Twilio zrobiłoby w Skillboardzie zieloną kartę
 * narzędzia, które nic nie wykona. Skillboard już raz przerabiał ten problem
 * (rejestr `MCP_REALNE` po stronie mostu) i nie dokładamy mu kolejnych atrap.
 *
 * Gdy przewód dostanie sterownik w Etapie 2, zacznie tędy przechodzić sam
 * z siebie — bez zmiany w tym pliku.
 */
export async function dopiszPrzewodDoSkillboardu(przewod: PrzewodGlosu) {
    if (!przewod.sterownik) {
        return {
            success: false as const,
            message: `„${przewod.nazwa}" nie ma jeszcze sterownika w moście. Nie dopisuję go do Skillboardu, bo powstałaby aktywna karta narzędzia, które nic nie wykona (Etap 2).`,
        };
    }
    const { skill } = await mcpMarketService.addCustomSkill({
        id: `glos-${przewod.id}`,
        name: przewod.nazwa,
        category: 'ai_media',
        categoryLabel: 'AI & Media',
        description: przewod.opis,
        icon: przewod.glyph,
        color: 'fuchsia',
        tags: ['glos', przewod.rodzaj, przewod.zrodlo, 'twoje-biznesy'],
        transport: 'http',
        command: przewod.czym ?? MOST,
        assignedAgents: ['klaudiusz', 'bob'],
        tools: [
            { name: 'speak', description: 'Wypowiedz tekst głosem profilu działalności.' },
            { name: 'render', description: 'Zapisz wypowiedź jako plik w _OtakOs_Voice/.' },
        ],
    });
    return { success: true as const, skill, message: `Przewód „${przewod.nazwa}" dopisany do Skillboardu.` };
}

export default {
    stanPrzewodow, pobierzProfile, zapiszProfil, usunProfil, glosyElevenLabs,
    renderujDoPliku, mowProfilem, dopiszPrzewodDoSkillboardu,
};
