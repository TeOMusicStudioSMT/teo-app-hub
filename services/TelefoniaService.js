/**
 * ☎️ TelefoniaService — sterownik przewodu telefonicznego (Twilio) · Etap 2.
 *
 * To jest miejsce, w którym Katedra przestaje mówić do przeglądarki i zaczyna
 * mówić do CUDZEGO TELEFONU. Dlatego ten plik jest napisany defensywnie —
 * pomyłka tutaj nie kończy się brzydkim UI, tylko realnym połączeniem do
 * realnego człowieka i realnym rachunkiem.
 *
 * ⚠️ PIĘĆ BEZPIECZNIKÓW, KAŻDY WYMUSZONY PO STRONIE SERWERA:
 *
 *  1. NUMER W E.164 ALBO NIC. Bez `+` i kraju Twilio i tak odmówi, ale my
 *     odmawiamy wcześniej i konkretniej — literówka w numerze to połączenie
 *     do obcej osoby.
 *  2. NADAWCA MUSI BYĆ SKONFIGUROWANY (`twilio.from_number`). Nie zgadujemy
 *     numeru wyjściowego z konta.
 *  3. PRÓBA (`proba: true`) JEST DOMYŚLNĄ DROGĄ TESTU. Sprawdza poświadczenia
 *     i składa TwiML, ale NIE dzwoni. Dokładnie ta ścieżka służy do weryfikacji,
 *     żeby nikt nie „testował" na żywym numerze.
 *  4. TREŚĆ JEST ESKEJPOWANA DO XML. TwiML to XML; niezaeskejpowany apostrof
 *     albo `&` w nazwie firmy rozwala dokument, a wtedy Twilio czyta śmieci
 *     albo rozłącza się w pół zdania.
 *  5. TOKEN NIE WYCHODZI. Ani do logu, ani do odpowiedzi, ani w treści cudzego
 *     błędu (odpowiedzi Twilio bywają echem żądania).
 *
 * ZAKRES: Etap 2 dał połączenie wychodzące, które MÓWI (TwiML `<Say>`).
 * Etap 3 dokłada rozmowę DWUSTRONNĄ (`zbudujTwimlStream` → `<Connect><Stream>`
 * na publiczny WSS Kwantowego Tunelu) oraz weryfikację podpisu Twilio dla
 * połączeń przychodzących. To, co realnie działa, zależy od tego, czy tunel
 * jest wpięty — dlatego `mozliwosci()` przyjmuje ten stan jako argument
 * i nie deklaruje niczego na wyrost.
 *
 * Standard ESM. Zero zależności — sam `fetch`.
 */

import crypto from 'crypto';

/**
 * Adres API. Nadpisywalny (`OTAKOS_TWILIO_API`) z jednego powodu: żeby dało się
 * sprawdzić KSZTAŁT ŻĄDANIA na serwerze-atrapie, bez dzwonienia do człowieka.
 * Bez tego jedyną drogą testu byłby prawdziwy telefon na czyjś numer.
 */
const TWILIO_API = process.env.OTAKOS_TWILIO_API || 'https://api.twilio.com/2010-04-01';
const TIMEOUT = 20_000;

export class BladTelefonii extends Error {
    constructor(message, status = 424) {
        super(message);
        this.name = 'BladTelefonii';
        this.status = status;
    }
}

/** Numer w formacie E.164: `+` i 8–15 cyfr. Twilio nie przyjmuje niczego innego. */
export function poprawnyNumer(numer) {
    return /^\+[1-9]\d{7,14}$/.test(String(numer ?? '').replace(/[\s()-]/g, ''));
}

export function normalizujNumer(numer) {
    return String(numer ?? '').replace(/[\s()-]/g, '');
}

/** SID w logach — pierwsze 6 znaków wystarczy, żeby rozpoznać konto. */
export function maskaSid(sid) {
    const s = String(sid ?? '');
    return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : '[sid]';
}

function bezSekretow(tekst, limit = 300) {
    return String(tekst ?? '')
        .replace(/\bAC[a-f0-9]{32}\b/gi, '[sid]')
        .replace(/\b[a-f0-9]{32}\b/gi, '[token]')
        .slice(0, limit);
}

/** TwiML to XML — bez tego nazwa „Kowalski & Syn" rozwala dokument. */
export function escXml(tekst) {
    return String(tekst ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Składa TwiML wypowiedzi.
 *
 * `glos` to głos Twilio (np. `Polly.Ewa`), NIE profil głosowy Katedry — klon
 * Suwerena nie da się tu wpiąć bez publicznego adresu do pliku audio. Gdy
 * `nagranieUrl` jest podane, gra plik zamiast syntezy Twilio.
 */
export function zbudujTwiml({ tekst, jezyk = 'pl-PL', glos = 'Polly.Ewa', nagranieUrl = null, gatherUrl = null }) {
    const mowa = nagranieUrl
        ? `<Play>${escXml(nagranieUrl)}</Play>`
        : `<Say language="${escXml(jezyk)}" voice="${escXml(glos)}">${escXml(tekst)}</Say>`;

    const tresc = gatherUrl
        ? `<Gather input="dtmf" numDigits="1" timeout="6" action="${escXml(gatherUrl)}" method="POST">${mowa}</Gather>` +
          `<Say language="${escXml(jezyk)}" voice="${escXml(glos)}">Nie otrzymałam odpowiedzi. Do usłyszenia.</Say>`
        : mowa;

    return `<?xml version="1.0" encoding="UTF-8"?><Response>${tresc}</Response>`;
}

/**
 * TwiML rozmowy DWUSTRONNEJ (Etap 3) — `<Connect><Stream>` kieruje audio
 * połączenia na nasz publiczny WSS (Kwantowy Tunel).
 *
 * ⚠️ `<Connect>` jest BLOKUJĄCY: dopóki strumień żyje, nic dalej z TwiML się nie
 * wykona, a zakończenie strumienia kończy połączenie. Dlatego powitanie idzie
 * PRZED `<Connect>`, a nie po nim — po nim byłoby zdaniem, którego nikt nigdy
 * nie usłyszy.
 *
 * `bilet` wchodzi jako `<Parameter>`, nie jako część adresu: parametry lecą
 * w ramce `start`, więc token nie ląduje w logach pośredników razem z URL-em.
 */
export function zbudujTwimlStream({ wssUrl, bilet, powitanie = '', jezyk = 'pl-PL', glos = 'Polly.Ewa', parametry = {} }) {
    if (!wssUrl) throw new BladTelefonii('Brak adresu WSS Kwantowego Tunelu — rozmowa dwustronna nie ma dokąd pójść.', 424);

    const wstep = powitanie
        ? `<Say language="${escXml(jezyk)}" voice="${escXml(glos)}">${escXml(powitanie)}</Say>`
        : '';

    const parms = Object.entries({ ...parametry, ...(bilet ? { bilet } : {}) })
        .map(([k, v]) => `<Parameter name="${escXml(k)}" value="${escXml(v)}"/>`)
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?><Response>${wstep}` +
           `<Connect><Stream url="${escXml(wssUrl)}">${parms}</Stream></Connect></Response>`;
}

/**
 * Weryfikacja podpisu Twilio (`X-Twilio-Signature`).
 *
 * ⚠️ BEZ TEGO PUBLICZNY WEBHOOK JEST OTWARTYM PRZYCISKIEM DLA CAŁEGO INTERNETU.
 * Adres tunelu prędzej czy później gdzieś wycieknie, a wtedy każdy mógłby kazać
 * Katedrze odebrać „połączenie" i puścić w świat głos Suwerena. Algorytm jest
 * podyktowany przez Twilio: HMAC-SHA1 (klucz = auth token) po pełnym URL-u
 * z doklejonymi parami klucz+wartość POST-a, posortowanymi po kluczu.
 *
 * Porównanie stałoczasowe — zwykłe `===` na podpisie to podręcznikowy wyciek
 * przez czas odpowiedzi.
 */
export function weryfikujPodpis({ url, params = {}, podpis, token }) {
    if (!token) return { ok: false, powod: 'Brak auth tokenu — nie mam czym zweryfikować podpisu.' };
    if (!podpis) return { ok: false, powod: 'Żądanie bez nagłówka X-Twilio-Signature.' };

    const dane = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], String(url ?? ''));
    const oczekiwany = crypto.createHmac('sha1', token).update(Buffer.from(dane, 'utf8')).digest('base64');

    const a = Buffer.from(oczekiwany);
    const b = Buffer.from(String(podpis));
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { ok, powod: ok ? null : 'Podpis nie zgadza się z treścią żądania.' };
}

function naglowki(sid, token) {
    return {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
    };
}

async function zLimitem(url, init) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT);
    try { return await fetch(url, { ...init, signal: c.signal }); }
    finally { clearTimeout(t); }
}

function sprawdzPoswiadczenia(sid, token) {
    if (!sid || !token) {
        throw new BladTelefonii(
            'Brak poświadczeń Twilio w Skarbcu 0.00G (twilio.account_sid + twilio.auth_token). Nic nie zostało wysłane.',
            424);
    }
}

/**
 * Stan konta — jedyny sposób, żeby UCZCIWIE odpowiedzieć „przewód drożny",
 * zamiast wnioskować z samej obecności klucza w skarbcu. Klucz bywa nieaktualny.
 */
export async function stanKonta({ sid, token }) {
    sprawdzPoswiadczenia(sid, token);

    let r;
    try {
        r = await zLimitem(`${TWILIO_API}/Accounts/${encodeURIComponent(sid)}.json`, { headers: naglowki(sid, token) });
    } catch (e) {
        throw new BladTelefonii(`Twilio nie odpowiedziało (${e.name === 'AbortError' ? 'przekroczony czas' : e.message}).`, 504);
    }
    if (r.status === 401) throw new BladTelefonii('Twilio odrzuciło poświadczenia (401). Sprawdź SID i token w Skarbcu.', 401);
    if (!r.ok) throw new BladTelefonii(`Twilio: HTTP ${r.status} — ${bezSekretow(await r.text().catch(() => ''))}`, 502);

    const d = await r.json().catch(() => ({}));
    return {
        sid: maskaSid(d.sid ?? sid),
        nazwa: d.friendly_name ?? null,
        status: d.status ?? null,
        // `trial` znaczy, że Twilio zadzwoni tylko na numery zweryfikowane
        // i dolepi swoją zapowiedź — bez tego ostrzeżenia test wygląda na awarię.
        prubny: String(d.type ?? '').toLowerCase() === 'trial',
    };
}

/**
 * Połączenie wychodzące.
 *
 * @param {object} p
 * @param {boolean} p.proba  — `true` (domyślnie) sprawdza wszystko i NIE dzwoni.
 * @returns {Promise<{wykonane: boolean, callSid?: string, status?: string, twiml: string, do: string, od: string, konto: object}>}
 */
export async function zadzwon({ sid, token, od, doKogo, tekst, jezyk = 'pl-PL', glos = 'Polly.Ewa', nagranieUrl = null, twiml: twimlGotowy = null, proba = true }) {
    sprawdzPoswiadczenia(sid, token);

    const cel = normalizujNumer(doKogo);
    const nadawca = normalizujNumer(od);

    if (!poprawnyNumer(cel)) {
        throw new BladTelefonii(`Numer docelowy „${doKogo}" nie jest w formacie E.164 (np. +48123456789). Nie dzwonię.`, 400);
    }
    if (!poprawnyNumer(nadawca)) {
        throw new BladTelefonii(
            'Brak poprawnego numeru nadawcy (twilio.from_number w Skarbcu 0.00G, format E.164). Nie zgaduję numeru wyjściowego.',
            424);
    }
    // `twimlGotowy` przychodzi z trybu rozmowy dwustronnej (<Connect><Stream>) —
    // wtedy treści nie ma i mieć nie musi, bo słowa powstają dopiero na żywo.
    if (!twimlGotowy && !String(tekst ?? '').trim() && !nagranieUrl) {
        throw new BladTelefonii('Brak treści rozmowy — połączenie bez słowa nie ma sensu. Nie dzwonię.', 400);
    }

    // Poświadczenia sprawdzamy ZAWSZE, także w próbie — po to jest próba.
    const konto = await stanKonta({ sid, token });
    const twiml = twimlGotowy || zbudujTwiml({ tekst, jezyk, glos, nagranieUrl });

    if (proba) {
        return {
            wykonane: false,
            proba: true,
            twiml,
            do: cel,
            od: nadawca,
            konto,
            uwaga: konto.prubny
                ? 'Konto próbne Twilio: dodzwoni się TYLKO na numery zweryfikowane i doklei własną zapowiedź.'
                : null,
        };
    }

    const body = new URLSearchParams({ To: cel, From: nadawca, Twiml: twiml });

    let r;
    try {
        r = await zLimitem(`${TWILIO_API}/Accounts/${encodeURIComponent(sid)}/Calls.json`, {
            method: 'POST', headers: naglowki(sid, token), body,
        });
    } catch (e) {
        throw new BladTelefonii(`Twilio nie odpowiedziało (${e.name === 'AbortError' ? 'przekroczony czas' : e.message}). Nie wiem, czy połączenie ruszyło — sprawdź konsolę Twilio.`, 504);
    }

    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
        throw new BladTelefonii(
            `Twilio odrzuciło połączenie (HTTP ${r.status}): ${bezSekretow(d?.message ?? '')}${d?.code ? ` [kod ${d.code}]` : ''}`,
            r.status === 401 ? 401 : 502);
    }

    return {
        wykonane: true,
        proba: false,
        callSid: d.sid ?? null,
        status: d.status ?? null,
        twiml,
        do: cel,
        od: nadawca,
        konto,
    };
}

/**
 * Co ten sterownik POTRAFI w TEJ CHWILI.
 *
 * Połowa możliwości Etapu 3 stoi na Kwantowym Tunelu — bez publicznego adresu
 * Twilio nie ma dokąd oddać audio. Dlatego stan tunelu wchodzi tu argumentem,
 * a nie jest zaszyty na sztywno: panel ma pokazywać prawdę o TEJ maszynie,
 * a nie deklarację z dokumentacji.
 */
export function mozliwosci(tunelWpiety = false) {
    return {
        polaczenieWychodzace: true,
        mowaTwilio: true,
        // Klon Suwerena jedzie kanałem Media Streams (nie <Play>), więc idzie
        // razem z rozmową dwustronną — i tak samo zależy od tunelu.
        rozmowaDwustronna: !!tunelWpiety,
        klonSuwerenaWSluchawce: !!tunelWpiety,
        polaczeniaPrzychodzace: !!tunelWpiety,
        odbieranieTonow: false,     // <Gather> wymaga osobnego webhooka na akcję — nie w tym etapie
    };
}

export default {
    BladTelefonii, poprawnyNumer, normalizujNumer, escXml, maskaSid,
    zbudujTwiml, zbudujTwimlStream, weryfikujPodpis,
    stanKonta, zadzwon, mozliwosci,
};
