/**
 * 🏢 businessService.ts — klient rejestru „Twoje Biznesy" (Etap 1).
 *
 * Firmy, strony, usługi i sklepy Suwerena + księga Służby, z której naliczane
 * jest GRV. Cały stan mieszka po stronie Mostu (`/api/business/*`), a ten plik
 * jest wyłącznie cienką, otypowaną rurą.
 *
 * ⚠️ ŻADNYCH DANYCH ZASTĘPCZYCH. Gdy most milczy, funkcje RZUCAJĄ błąd —
 * nie zwracają „przykładowych" biznesów ani zerowego bilansu udającego stan.
 * Panel, który przy padniętym moście pokazuje ładne karty, kłamie w sprawie,
 * na której Suweren opiera decyzje o własnych pieniądzach.
 *
 * ⚠️ GRV NIE JEST LICZONE TUTAJ ANI W PANELU. Front zgłasza fakt Służby
 * (`zglosSluzbe`), a most rozstrzyga przez Ekonomię Oddechu — limit dobowy
 * i klucz jednokrotności są egzekwowane po stronie serwera. Klikanie w kółko
 * niczego nie wyciśnie.
 */

const MOST = 'http://127.0.0.1:3001';

export type RodzajBiznesu = 'strona' | 'usluga' | 'sklep' | 'lokal' | 'studio';

/** Akcje Służby — biała lista, ta sama co w `BiznesService.js` na moście. */
export type AkcjaSluzby =
    | 'klient.obsluzony'
    | 'oferta.wygenerowana'
    | 'rozmowa.domknieta'
    | 'zamowienie.zlozone';

export interface BilansBiznesu {
    zdarzen: number;
    grv: number;
    klientow: number;
    ofert: number;
    zamowien: number;
    rozmow: number;
    ostatnie: string | null;
}

export interface Biznes {
    id: string;
    nazwa: string;
    rodzaj: RodzajBiznesu;
    opis: string;
    url: string | null;
    telefon: string | null;
    /** Identyfikator profilu głosowego z `voiceMcpService`. */
    voiceProfile: string | null;
    agenci: string[];
    aktywny: boolean;
    utworzony: string;
    zmieniony?: string;
    bilans: BilansBiznesu;
}

export interface ZdarzenieSluzby {
    id: string;
    biznesId: string;
    akcja: AkcjaSluzby | string;
    klucz: string;
    opis: string;
    klient: string | null;
    grv: number;
    /** `false` = służba się wydarzyła, ale GRV nie doszło (limit dobowy / już zapłacone). */
    przyznane: boolean;
    powod: string | null;
    kiedy: string;
}

export interface StanBiznesow {
    biznesy: Biznes[];
    podsumowanie: {
        dzialalnosci: number;
        aktywnych: number;
        zdarzen: number;
        grvZeSluzby: number;
        zGlosem: number;
    };
    akcje: Record<string, { oddech: string; opis: string }>;
    rodzaje: Record<string, { label: string; glyph: string }>;
}

export interface WynikSluzby {
    zdarzenie: ZdarzenieSluzby;
    oddech: { przyznane: boolean; grv?: number; klasa?: string; opis?: string; powod?: string | null };
    biznes: string;
}

/** Możliwości sterownika telefonii — po to, żeby UI nie obiecywał Etapu 3. */
export interface MozliwosciTelefonii {
    polaczenieWychodzace: boolean;
    mowaTwilio: boolean;
    odbieranieTonow: boolean;
    rozmowaDwustronna: boolean;
    klonSuwerenaWSluchawce: boolean;
    polaczeniaPrzychodzace: boolean;
}

export interface StanTelefonii {
    /** Czy konto Twilio realnie odpowiedziało — nie „czy klucz leży w skarbcu". */
    drozny: boolean;
    braki: string[];
    konto?: { sid: string; nazwa: string | null; status: string | null; prubny: boolean };
    od?: string;
    mozliwosci: MozliwosciTelefonii;
    message: string;
}

/**
 * Odpowiedź Konsoli Dial. `wykonane` jest ZAWSZE prawdą o tym, czy telefon
 * zadzwonił — `false` również wtedy, gdy wszystko się udało, ale to była próba.
 */
export interface WynikDial {
    wykonane: boolean;
    proba?: boolean;
    callSid?: string | null;
    status?: string | null;
    /** Dokładnie ten XML poszedłby (albo poszedł) na linię. */
    twiml?: string;
    do?: string;
    od?: string;
    konto?: { sid: string; nazwa: string | null; status: string | null; prubny: boolean };
    uwaga?: string | null;
    przewod?: string;
    tryb?: 'zapowiedz' | 'rozmowa';
    message?: string;
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

// ── Rejestr działalności ──────────────────────────────────────────────────────

export const pobierzBiznesy = () =>
    zawolaj<StanBiznesow & { success: true }>('/api/business/list');

export const dodajBiznes = (dane: Partial<Biznes>) =>
    zawolaj<{ biznes: Biznes }>('/api/business/create', {
        method: 'POST', body: JSON.stringify(dane),
    }).then(d => d.biznes);

export const zmienBiznes = (id: string, zmiany: Partial<Biznes>) =>
    zawolaj<{ biznes: Biznes }>(`/api/business/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(zmiany),
    }).then(d => d.biznes);

export const usunBiznes = (id: string) =>
    zawolaj<{ id: string; usuniete: boolean; zdarzenZachowanych: number }>(
        `/api/business/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Przypina profil głosowy do działalności (albo go zdejmuje, gdy `null`). */
export const przypiszGlos = (id: string, voiceProfile: string | null) =>
    zmienBiznes(id, { voiceProfile } as Partial<Biznes>);

// ── Służba i GRV ──────────────────────────────────────────────────────────────

/**
 * Zgłasza wykonaną Służbę.
 *
 * `klucz` musi jednoznacznie identyfikować TĘ konkretną pracę (np. numer
 * zamówienia, id rozmowy). Most odrzuci zgłoszenie bez klucza, a ten sam klucz
 * zapłaci tylko raz — dlatego nie wolno tu wstawiać `Date.now()`.
 */
export const zglosSluzbe = (dane: {
    biznesId: string;
    akcja: AkcjaSluzby;
    klucz: string;
    opis?: string;
    klient?: string;
    wezel?: string;
}) => zawolaj<WynikSluzby>('/api/business/sluzba', {
    method: 'POST', body: JSON.stringify(dane),
});

export const pobierzZdarzenia = (biznesId?: string | null, limit = 40) =>
    zawolaj<{ zdarzenia: ZdarzenieSluzby[] }>(
        `/api/business/ledger?limit=${limit}${biznesId ? `&biznesId=${encodeURIComponent(biznesId)}` : ''}`,
    ).then(d => d.zdarzenia);

/** Stan przewodu telefonicznego — pytanie do konta Twilio, nie do skarbca. */
export const stanTelefonii = () =>
    zawolaj<StanTelefonii & { success: true }>('/api/business/telefonia');

/**
 * Konsola Dial.
 *
 * ⚠️ `proba` jest DOMYŚLNIE `true` — most sprawdza poświadczenia i składa TwiML,
 * ale NIE dzwoni. Realne połączenie wymaga jednocześnie `proba: false`
 * i `potwierdzenie: true`; brak potwierdzenia most odbija kodem 428.
 *
 * Funkcja nie rzuca na odmowę — zwraca werdykt z `wykonane`, bo w tej konsoli
 * najważniejszą informacją jest właśnie to, czy telefon zadzwonił, czy nie.
 */
export async function zadzwon(opcje: {
    biznesId: string;
    numer?: string;
    tekst?: string;
    jezyk?: string;
    glos?: string;
    proba?: boolean;
    potwierdzenie?: boolean;
    /**
     * `zapowiedz` — Twilio czyta jedno zdanie i kończy (Etap 2).
     * `rozmowa`   — audio idzie na WSS Kwantowego Tunelu, AI rozmawia (Etap 3).
     */
    tryb?: 'zapowiedz' | 'rozmowa';
}): Promise<WynikDial> {
    let odp: Response;
    try {
        odp = await fetch(`${MOST}/api/business/dial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proba: true, ...opcje }),
        });
    } catch {
        throw new Error('Most (127.0.0.1:3001) milczy — odpal Katedrę.');
    }
    const d = await odp.json().catch(() => ({} as any));
    return {
        ...d,
        wykonane: !!d?.wykonane,
        przewod: d?.przewod ?? 'twilio-conduit',
        message: d?.message ?? (odp.ok ? undefined : `Most odpowiedział HTTP ${odp.status} bez wyjaśnienia.`),
    };
}

export default {
    pobierzBiznesy, dodajBiznes, zmienBiznes, usunBiznes, przypiszGlos,
    zglosSluzbe, pobierzZdarzenia, zadzwon, stanTelefonii,
};
