/**
 * 📱🕊️ teogochiDelegate — Delegat Mobilny po stronie Katedry.
 *
 * Suweren (2026-09-16): TeOgochi jako przedstawiciel Suwerena w telefonie —
 * dwukierunkowy strumień audio/tekst, narzędzia mapowane na trasy mostu, przez
 * Kwantowy Tunel, a fakty z rozmów do Mózgu Orbity.
 *
 * CO TU JEST, A CO GDZIE INDZIEJ:
 *  - persona, biała lista narzędzi, pamięć rozmów → most, services/Delegat.js
 *    (strona telefonu jest serwowana bez frontu, więc mózg musi stać w moście);
 *  - strona telefonu → public/delegat (czysty JS, ten sam origin co most);
 *  - TEN MODUŁ: klient TS dla Katedry (ta sama rozmowa z poziomu przeglądarki
 *    na komputerze), link/QR na telefon, i MOST DO ORBITY — `sluchajTelefonu()`
 *    czyta strumień szyny i dopisuje rozmowy z telefonu do pamięci Mózgu Orbity
 *    jako ślady „telefon". Orbita zostaje pasywna: tylko czyta, nic nie wysyła.
 *
 * ⚠️ O „standardzie Google Artemis": to framework automatyzacji Androida (ADB +
 * accessibility), nie protokół głosowy. Głos jedzie torami Katedry (Whisper,
 * /api/voice/speak); Artemis daje Delegatowi narzędzie `telefon.zadanie` — ręce
 * na telefonie podpiętym do maszyny. Szczegóły: services/Artemis.js.
 */
import { getBridgeBase, getKluczStrazy, getTunnelUrl, normalizeTunnelUrl, NAGLOWEK_KLUCZA } from './bridgeService';
import { obserwuj } from './mozgOrbity';

export interface ProfilDelegata {
    id: string;
    gatunek: string;
    imie: string;
    emoji: string;
    kolor: string;
    dziedzina: string;
    glos: string | null;
    narzedzia: string[];
    /** Narzędzia dostępne z tunelu (bez „ciężkich", chyba że OTAKOS_TUNEL_PELNY=1). */
    narzedziaZdalne: string[];
}

export interface TuraRozmowy {
    kto: 'suweren' | 'delegat' | 'narzedzie';
    tresc: string;
    kiedy: string;
    narzedzie?: string;
    argumenty?: Record<string, unknown>;
}

export interface RozmowaDelegata {
    id: string;
    delegat: string;
    od: string;
    ostatnia: string | null;
    tury: TuraRozmowy[];
    podsumowanie: { kiedy: string; streszczenie: string; fakty: string[] } | null;
}

export interface FaktZTelefonu { kiedy: string; delegat: string; tresc: string; rozmowaId: string; }

export type ZdarzenieDelegata =
    | { typ: 'narzedzie'; narzedzie: string; argumenty: Record<string, unknown> }
    | { typ: 'wynik'; narzedzie: string; ok: boolean; wynik: unknown }
    | { typ: 'token'; tekst: string }
    | { typ: 'koniec'; rozmowaId: string; delegat: string; odpowiedz: string; glos: string | null; model: string }
    | { typ: 'blad'; message: string };

const naglowki = (): Record<string, string> => {
    const k = getKluczStrazy();
    return { 'Content-Type': 'application/json', ...(k ? { [NAGLOWEK_KLUCZA]: k } : {}) };
};

async function api<T>(sciezka: string, body?: unknown): Promise<T> {
    const r = await fetch(`${getBridgeBase()}${sciezka}`, { method: body ? 'POST' : 'GET', headers: naglowki(), body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d as { message?: string }).message || `HTTP ${r.status}`);
    return d as T;
}

/** Czytnik SSE po `fetch` — EventSource nie umie dołożyć nagłówka z kluczem Straży. */
async function czytajSse(r: Response, naZdarzenie: (z: unknown) => void): Promise<void> {
    if (!r.body) return;
    const czytnik = r.body.getReader();
    const dek = new TextDecoder();
    let bufor = '';
    for (;;) {
        const { value, done } = await czytnik.read();
        if (done) break;
        bufor += dek.decode(value, { stream: true });
        let i: number;
        while ((i = bufor.indexOf('\n\n')) >= 0) {
            const blok = bufor.slice(0, i); bufor = bufor.slice(i + 2);
            const linia = blok.split('\n').find((l) => l.startsWith('data: '));
            if (!linia) continue;
            try { naZdarzenie(JSON.parse(linia.slice(6))); } catch { /* niepełny blok */ }
        }
    }
}

export const pobierzProfile = () => api<{ profile: ProfilDelegata[]; lokalne: boolean; pelnyTunel: boolean }>('/api/delegat/profile');
export const pobierzRozmowy = () => api<{ rozmowy: Array<{ id: string; delegat: string; od: string; ostatnia: string; tur: number; podsumowana: boolean }> }>('/api/delegat/rozmowy').then((d) => d.rozmowy);
export const pobierzRozmowe = (id: string) => api<{ rozmowa: RozmowaDelegata }>(`/api/delegat/rozmowa/${encodeURIComponent(id)}`).then((d) => d.rozmowa);
export const pobierzFakty = (ile = 30) => api<{ fakty: FaktZTelefonu[] }>(`/api/delegat/fakty?ile=${ile}`).then((d) => d.fakty);
export const podsumujRozmowe = (id: string) => api<{ rozmowaId: string; streszczenie: string; fakty: string[] }>(`/api/delegat/rozmowa/${encodeURIComponent(id)}/podsumuj`, {});

/**
 * Klient jednej rozmowy z Delegatem — z Katedry na komputerze albo z dowolnego
 * miejsca, gdzie stoi front z tunelem. Ta sama pamięć, co na telefonie (rozmowaId).
 */
export class Delegat {
    rozmowaId: string | null = null;
    constructor(public readonly profilId: string) {}

    /** Wyślij wypowiedź; `naZdarzenie` dostaje narzędzia i tokeny w locie. Zwraca pełną odpowiedź. */
    async zapytaj(tekst: string, naZdarzenie?: (z: ZdarzenieDelegata) => void): Promise<string> {
        const r = await fetch(`${getBridgeBase()}/api/delegat/rozmowa`, {
            method: 'POST', headers: naglowki(),
            body: JSON.stringify({ delegat: this.profilId, tekst, rozmowaId: this.rozmowaId, strumien: true }),
        });
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { message?: string }).message || `HTTP ${r.status}`); }
        let odpowiedz = '';
        await czytajSse(r, (z) => {
            const zd = z as ZdarzenieDelegata;
            if (zd.typ === 'koniec') { this.rozmowaId = zd.rozmowaId; odpowiedz = zd.odpowiedz; }
            if (zd.typ === 'blad') throw new Error(zd.message);
            naZdarzenie?.(zd);
        });
        return odpowiedz;
    }

    /** Nagranie (Blob z MediaRecorder) → Whisper w Katedrze → tekst. */
    async przepisz(nagranie: Blob): Promise<string> {
        const b64 = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(nagranie); });
        const d = await api<{ transcript: string }>('/api/voice/transcribe', { sample: b64, model: 'small' });
        return d.transcript;
    }

    /** Głos Delegata torem Katedry; null = tor padł, użyj speechSynthesis. */
    async powiedz(tekst: string, glos?: string | null): Promise<HTMLAudioElement | null> {
        const r = await fetch(`${getBridgeBase()}/api/voice/speak`, { method: 'POST', headers: naglowki(), body: JSON.stringify({ text: tekst, voiceId: glos || undefined }) });
        if (!r.ok) return null;
        const a = new Audio(URL.createObjectURL(await r.blob()));
        await a.play();
        return a;
    }

    async podsumuj() {
        if (!this.rozmowaId) throw new Error('Nie ma jeszcze czego podsumować.');
        return podsumujRozmowe(this.rozmowaId);
    }
}

/**
 * Adres strony telefonu przez tunel — to ląduje w kodzie QR na karcie Delegata.
 * Klucz za kratką (fragment nie opuszcza przeglądarki — patrz bridgeService).
 */
export function adresDelegataNaTelefon(profilId = 'joanna'): string {
    const tunel = getTunnelUrl();
    if (!tunel) return '';
    const baza = normalizeTunnelUrl(tunel).replace(/\/api\/bridge\/execute$/, '');
    const k = getKluczStrazy();
    return `${baza}/delegat/#${k ? `k=${encodeURIComponent(k)}&` : ''}delegat=${encodeURIComponent(profilId)}`;
}

// ── MOST DO MÓZGU ORBITY ─────────────────────────────────────────────────────
// Rozmowy z telefonu idą przez szynę mostu jako agent „Delegat·<Imię>". Katedra
// na komputerze słucha strumienia i dopisuje je do pamięci Orbity — dzięki temu
// Orbita wie, co Suweren ustalił z Joanną w tramwaju, mimo że jej pamięć jest
// lokalna w tej przeglądarce. Sam nasłuch nic nie wysyła.

export interface ZdarzenieSzyny { id: number; kiedy: string; agent: string; rodzaj: string; tresc: string; dane?: { rozmowaId?: string; kto?: string } | null; }

/**
 * Podłącz nasłuch. Zwraca funkcję odpinającą. Zerwany strumień wraca sam po 15 s.
 * `onZdarzenie` dostaje każde zdarzenie telefonu (do kart UI); do Orbity trafiają
 * tylko rozmowa i fakty — narzędzia jako ślad „narzedzie".
 */
export function sluchajTelefonu(onZdarzenie?: (z: ZdarzenieSzyny) => void): () => void {
    let zywy = true;
    let ctrl: AbortController | null = null;
    let ostatnieId = 0;

    const petla = async () => {
        while (zywy) {
            ctrl = new AbortController();
            try {
                const r = await fetch(`${getBridgeBase()}/api/szyna/strumien`, { headers: naglowki(), signal: ctrl.signal });
                if (r.ok) {
                    await czytajSse(r, (surowe) => {
                        const z = surowe as ZdarzenieSzyny;
                        if (!z?.agent || z.id <= ostatnieId) return;
                        ostatnieId = z.id;
                        const zTelefonu = z.agent.startsWith('Delegat·') || z.agent === 'Artemis';
                        if (!zTelefonu) return;
                        onZdarzenie?.(z);
                        if (z.rodzaj === 'telefon' && z.dane?.kto === 'suweren') obserwuj('mowa', z.tresc.replace(/^Suweren:\s*/, ''), 'telefon');
                        else if (z.rodzaj === 'telefon' && z.dane?.kto === 'delegat') obserwuj('odpowiedz', z.tresc, `telefon·${z.agent.replace('Delegat·', '')}`);
                        else if (z.rodzaj === 'fakt' || z.rodzaj === 'podsumowanie') obserwuj('akcja', `[${z.rodzaj} z telefonu] ${z.tresc}`, z.agent);
                        else if (z.rodzaj === 'narzedzie' || z.rodzaj === 'blad') obserwuj(z.rodzaj === 'blad' ? 'blad' : 'narzedzie', z.tresc, z.agent);
                        else if (z.agent === 'Artemis') obserwuj('narzedzie', z.tresc, 'Artemis');
                    });
                }
            } catch { /* most padł albo tunel zerwany — próbujemy dalej */ }
            if (zywy) await new Promise((res) => setTimeout(res, 15000));
        }
    };
    void petla();
    return () => { zywy = false; ctrl?.abort(); };
}
