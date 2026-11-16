/**
 * 💳 Stripe — darowizny i sprzedaż pakietów Mini (Suweren 2026-10-13: „mam konto na Stripe, mam API… w skarbcu 0.00G
 * nie widzę na to miejsca… chcę na otakos.wtf przyjmować darowizny… jak i sprzedawać gotowe nasze modele Mini”).
 *
 * Klucz tajny (`sk_live_…` / `sk_test_…` / ograniczony `rk_…`) żyje TYLKO w Skarbcu 0.00G tej Katedry (usługa `stripe`,
 * pole `secret_key`) — czytany przy każdym użyciu, nigdy do przeglądarki ani na stronę. Strona otakos.wtf dostaje:
 *   · DAROWIZNY — Payment Link Stripe („zapłać, ile chcesz”, `submit_type: donate`): most zakłada raz produkt, cenę
 *     z `custom_unit_amount` i link; adres `https://buy.stripe.com/…` idzie do wizytówki. Działa nawet, gdy Katedra
 *     śpi — płatność obsługuje Stripe, pieniądze lądują na koncie Suwerena.
 *   · ZAKUP PAKIETU — sesja Stripe Checkout zakładana przez most NA ŻĄDANIE (`POST /wizytowka/sklep/<id>/kup` przez
 *     tunel Katedry): cena z rzadkości (liczy most, nie przeglądarka), `metadata.pakiet`, powrót na tunel Katedry →
 *     most pyta Stripe o sesję i wydaje plik TYLKO opłaconej (`payment_status: paid`). Bez webhooka — zero publicznego
 *     wejścia, które trzeba by podpisywać.
 * Zapis: `_OtakOs_Wymiar/stripe.json` {darowizny, sprzedaz} — bez kluczy.
 */
import fs from 'fs/promises';
import path from 'path';

export const API = process.env.OTAKOS_STRIPE_URL || 'https://api.stripe.com/v1';
export const WALUTY = ['usd', 'eur', 'pln'];
/** Adres Payment Linka i Checkoutu — nic innego nie trafia na stronę jako „zapłać tutaj”. */
export const LINK_STRIPE = /^https:\/\/(buy|donate)\.stripe\.com\/[A-Za-z0-9_/-]{4,200}$/;
export const CHECKOUT_STRIPE = /^https:\/\/checkout\.stripe\.com\/[A-Za-z0-9_/#%.=?&-]{4,2000}$/;
const SESJA = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
/** 🤝 Konto Connect autora (Express) — jedyne, co Katedra o nim wie. Tożsamość i numer konta trzyma Stripe. */
export const KONTO_CONNECT = /^acct_[A-Za-z0-9]{8,64}$/;
export const LINK_ONBOARDINGU = /^https:\/\/connect\.stripe\.com\/[A-Za-z0-9_/#%.=?&-]{4,2000}$/;

/** Tryb klucza z przedrostka (nic nie wysyłamy, żeby to wiedzieć). */
export function trybKlucza(k) {
    const m = /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.exec(String(k ?? '').trim());
    return m ? m[2] : null;
}

/** Obiekt → formularz Stripe (a[b][0][c]=…). */
export function formularz(obj, prefiks = '', out = new URLSearchParams()) {
    for (const [k, v] of Object.entries(obj ?? {})) {
        if (v === undefined || v === null) continue;
        const klucz = prefiks ? `${prefiks}[${k}]` : k;
        if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'object' ? formularz(x, `${klucz}[${i}]`, out) : out.append(`${klucz}[${i}]`, String(x))));
        else if (typeof v === 'object') formularz(v, klucz, out);
        else out.append(klucz, String(v));
    }
    return out;
}

/** Kwota w najmniejszej jednostce (centy) z liczby w walucie; 1–999 999. */
export function centy(kwota) {
    const c = Math.round(Number(kwota) * 100);
    if (!Number.isFinite(c) || c < 100 || c > 99_999_900) throw new Error('Kwota: od 1 do 999 999.');
    return c;
}

/**
 * @param {{ klucz: () => Promise<string|null>, katalog: string, fetch?: Function, teraz?: () => number }} o
 */
export function utworzStripe({ klucz, katalog, fetch: f = globalThis.fetch, teraz = () => Date.now() }) {
    const plik = path.join(katalog, 'stripe.json');
    let kolejka = Promise.resolve();
    const poKolei = (fn) => { const p = kolejka.then(fn, fn); kolejka = p.catch(() => {}); return p; };
    const czytaj = async () => { try { const d = JSON.parse(await fs.readFile(plik, 'utf8')); return { darowizny: d.darowizny ?? null, sprzedaz: Array.isArray(d.sprzedaz) ? d.sprzedaz : [] }; } catch { return { darowizny: null, sprzedaz: [] }; } };
    const zapisz = async (d) => { await fs.mkdir(katalog, { recursive: true }); await fs.writeFile(plik, JSON.stringify(d, null, 2), 'utf8'); };
    const sesje = new Map();   // id → { kiedy, wynik } — nie pytamy Stripe przy każdym kliknięciu „pobierz”

    async function wolaj(metoda, sciezka, cialo) {
        const k = await klucz();
        if (!k) throw Object.assign(new Error('Brak klucza Stripe — Hub → Skarbiec 0.00G → 💳 Stripe → secret_key (sk_live_… albo sk_test_…).'), { kod: 'BEZ_KLUCZA' });
        const r = await f(`${API}${sciezka}`, {
            method: metoda,
            headers: { Authorization: `Bearer ${k}`, ...(cialo ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
            body: cialo ? formularz(cialo).toString() : undefined,
            signal: AbortSignal.timeout(30_000),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
            const powod = { 401: 'zły klucz', 403: 'klucz ograniczony bez tego uprawnienia', 429: 'limit zapytań — za chwilę' }[r.status] ?? '';
            throw new Error(`Stripe odmówił (HTTP ${r.status}${powod ? ` — ${powod}` : ''}): ${d?.error?.message ?? JSON.stringify(d).slice(0, 200)}`);
        }
        return d;
    }

    /** Stan dla Huba: czy jest klucz, jaki tryb, darowizny, ile sprzedano (bez pytania Stripe). */
    async function stan() {
        const k = await klucz();
        const d = await czytaj();
        const oplacone = d.sprzedaz.filter((s) => s.oplacona);
        return {
            maKlucz: !!k, tryb: trybKlucza(k), kluczRozpoznany: !k || !!trybKlucza(k),
            darowizny: d.darowizny, sprzedanych: oplacone.length,
            przychod: oplacone.reduce((s, x) => { s[x.waluta] = (s[x.waluta] ?? 0) + x.kwota; return s; }, {}),
        };
    }

    /** 🎁 Darowizny: produkt + cena „ile chcesz” + Payment Link (raz; ponowne włączenie = nowy link). */
    function wlaczDarowizny({ waluta = 'usd', sugerowana = 5, minimum = 1, nazwa = 'Darowizna dla Katedry', opis = '' } = {}) {
        return poKolei(async () => {
            const w = WALUTY.includes(String(waluta).toLowerCase()) ? String(waluta).toLowerCase() : 'usd';
            const min = centy(minimum), pre = Math.max(min, centy(sugerowana));
            const k = await klucz();
            const produkt = await wolaj('POST', '/products', { name: String(nazwa).slice(0, 120), ...(opis ? { description: String(opis).slice(0, 500) } : {}), metadata: { katedra: 'otakos', rodzaj: 'darowizna' } });
            const cena = await wolaj('POST', '/prices', { currency: w, product: produkt.id, custom_unit_amount: { enabled: true, minimum: min, preset: pre } });
            const link = await wolaj('POST', '/payment_links', { line_items: [{ price: cena.id, quantity: 1 }], submit_type: 'donate', metadata: { rodzaj: 'darowizna' } });
            if (!LINK_STRIPE.test(String(link.url))) throw new Error(`Stripe oddał nieoczekiwany adres linku: ${String(link.url).slice(0, 80)}`);
            const d = await czytaj();
            if (d.darowizny?.id && d.darowizny.id !== link.id) await wolaj('POST', `/payment_links/${d.darowizny.id}`, { active: false }).catch(() => {});
            d.darowizny = { id: link.id, link: link.url, waluta: w, sugerowana: pre / 100, minimum: min / 100, produkt: produkt.id, cena: cena.id, tryb: trybKlucza(k), od: new Date(teraz()).toISOString() };
            await zapisz(d);
            return d.darowizny;
        });
    }
    function wylaczDarowizny() {
        return poKolei(async () => {
            const d = await czytaj();
            if (!d.darowizny) return { wylaczone: false };
            let uwaga = null;
            await wolaj('POST', `/payment_links/${d.darowizny.id}`, { active: false }).catch((e) => { uwaga = `Link zdjęty ze strony, ale Stripe go nie wyłączył: ${e.message}`; });
            d.darowizny = null;
            await zapisz(d);
            return { wylaczone: true, uwaga };
        });
    }

    /** Dla wizytówki — z pliku, bez pytania Stripe (wizytówkę czyta sieć). */
    async function publiczne() {
        const d = await czytaj();
        return d.darowizny?.link && LINK_STRIPE.test(d.darowizny.link) ? { link: d.darowizny.link, waluta: d.darowizny.waluta, sugerowana: d.darowizny.sugerowana, tryb: d.darowizny.tryb ?? null } : null;
    }

    /**
     * 🛒 Sesja zakupu pakietu. Cenę podaje WOŁAJĄCY z mostu (rzadkość → cena), nie przeglądarka.
     * `powrot` = baza adresu Katedry w sieci (tunel), `anuluj` = strona, z której przyszedł kupujący.
     */
    async function sesjaZakupu({ pakiet, kwotaCentow, waluta = 'usd', powrot, anuluj, sukces = '/wizytowka/sklep/odbior', rodzaj = 'pakiet-mini', metadane = {}, naKonto = null, prowizjaCentow = 0 }) {
        if (!/^https:\/\/[^/]+/.test(String(powrot))) throw new Error('Katedra nie ma adresu w sieci (tunel wyłączony) — zakup niemożliwy.');
        const baza = String(powrot).replace(/\/+$/, '');
        // 🤝 Connect: wpłata ląduje na koncie autora, Katedrze zostaje tylko prowizja. Pieniądze NIE przechodzą
        // przez Katedrę i nie ma nikomu nic do wypłacenia — tożsamość i konto autora trzyma Stripe, nie Katedra.
        if (naKonto && !KONTO_CONNECT.test(String(naKonto))) throw new Error('To nie jest identyfikator konta Stripe Connect.');
        const prowizja = Math.max(0, Math.min(Math.round(Number(prowizjaCentow) || 0), kwotaCentow));
        const s = await wolaj('POST', '/checkout/sessions', {
            mode: 'payment',
            line_items: [{ quantity: 1, price_data: { currency: waluta, unit_amount: kwotaCentow, product_data: { name: String(pakiet.nazwa).slice(0, 120), description: String(pakiet.opis || 'Pakiet Mini-TeOgochi').slice(0, 300) } } }],
            success_url: `${baza}${sukces}?sesja={CHECKOUT_SESSION_ID}`,
            cancel_url: /^https:\/\//.test(String(anuluj)) ? String(anuluj).slice(0, 500) : `${baza}/api/wizytowka`,
            metadata: { ...metadane, pakiet: pakiet.id, rodzaj },
            ...(naKonto ? { payment_intent_data: { transfer_data: { destination: naKonto }, ...(prowizja ? { application_fee_amount: prowizja } : {}) } } : {}),
        });
        if (!CHECKOUT_STRIPE.test(String(s.url))) throw new Error('Stripe nie oddał adresu płatności.');
        return { id: s.id, url: s.url };
    }

    /**
     * Czy sesja jest opłacona i za który pakiet — pyta Stripe (schowek 5 min dla opłaconych). Opłaconą zapisuje raz
     * (`sprzedaz`, bez danych kupującego poza tym, co trzeba do rozliczenia: kwota, waluta, kiedy).
     */
    async function sprawdzSesje(id) {
        if (!SESJA.test(String(id))) throw new Error('To nie jest identyfikator płatności Stripe.');
        const s = sesje.get(id);
        if (s && s.wynik.oplacona && teraz() - s.kiedy < 5 * 60_000) return s.wynik;
        const d = await wolaj('GET', `/checkout/sessions/${encodeURIComponent(id)}`);
        const wynik = { id, oplacona: d.payment_status === 'paid', pakiet: d.metadata?.pakiet ?? null, rodzaj: d.metadata?.rodzaj ?? null, powrot: d.metadata?.powrot ?? null, kwota: (Number(d.amount_total) || 0) / 100, waluta: d.currency ?? null, tryb: d.livemode ? 'live' : 'test' };
        sesje.set(id, { kiedy: teraz(), wynik });
        if (wynik.oplacona && wynik.pakiet) {
            await poKolei(async () => {
                const plikD = await czytaj();
                if (!plikD.sprzedaz.some((x) => x.sesja === id)) {
                    plikD.sprzedaz.unshift({ sesja: id, pakiet: wynik.pakiet, rodzaj: wynik.rodzaj, kwota: wynik.kwota, waluta: wynik.waluta, tryb: wynik.tryb, oplacona: true, kiedy: new Date(teraz()).toISOString(), pobran: 0 });
                    plikD.sprzedaz = plikD.sprzedaz.slice(0, 2000);
                    await zapisz(plikD);
                }
            });
        }
        return wynik;
    }

    /** Licznik pobrań opłaconej sesji (≤ `max`) — link z maila/historii nie jest wieczystym serwerem plików. */
    function pobranie(id, max = 5) {
        return poKolei(async () => {
            const d = await czytaj();
            const s = d.sprzedaz.find((x) => x.sesja === id);
            if (!s) throw new Error('Nie widzę tej płatności.');
            if (s.pobran >= max) throw Object.assign(new Error(`Ten zakup pobrano już ${max} razy — napisz do Katedry, jeśli potrzebujesz pliku ponownie.`), { kod: 'LIMIT' });
            s.pobran += 1;
            await zapisz(d);
            return s.pobran;
        });
    }

    // ── 🤝 Stripe Connect: wypłaty prosto do autora, z pominięciem Katedry ──
    /** Czy konto Suwerena ma włączony Connect. Tylko odczyt — nic nie zakłada. */
    async function stanConnect() {
        try { const d = await wolaj('GET', '/accounts?limit=1'); return { dostepny: true, kont: Array.isArray(d.data) ? d.data.length : 0 }; }
        catch (e) { return { dostepny: false, powod: String(e.message).slice(0, 300) }; }
    }
    /** Zakłada konto Express autora. Katedra NIE podaje tu żadnych danych osobowych — zbiera je Stripe przy onboardingu. */
    async function kontoAutora() {
        const d = await wolaj('POST', '/accounts', { type: 'express' });
        if (!KONTO_CONNECT.test(String(d.id))) throw new Error('Stripe nie oddał identyfikatora konta.');
        return { konto: d.id };
    }
    /** Jednorazowy link, pod którym autor podaje Stripe'owi swoje dane i numer konta. */
    async function linkOnboardingu(konto, { powrot, odswiez = null }) {
        if (!KONTO_CONNECT.test(String(konto))) throw new Error('To nie jest identyfikator konta Stripe Connect.');
        if (!/^https:\/\/[^/]+/.test(String(powrot))) throw new Error('Potrzebny adres powrotu (https).');
        const d = await wolaj('POST', '/account_links', { account: konto, type: 'account_onboarding', return_url: String(powrot).slice(0, 500), refresh_url: String(odswiez || powrot).slice(0, 500) });
        if (!LINK_ONBOARDINGU.test(String(d.url))) throw new Error('Stripe nie oddał adresu rejestracji.');
        return { url: d.url, wazneDo: d.expires_at ?? null };
    }
    /** Czy konto autora może już przyjmować wpłaty (Stripe skończył weryfikację). */
    async function stanKontaAutora(konto) {
        if (!KONTO_CONNECT.test(String(konto))) throw new Error('To nie jest identyfikator konta Stripe Connect.');
        const d = await wolaj('GET', `/accounts/${encodeURIComponent(konto)}`);
        return { konto, przyjmujeWplaty: d.charges_enabled === true, wyplaty: d.payouts_enabled === true, zakonczone: d.details_submitted === true,
            brakuje: (d.requirements?.currently_due ?? []).slice(0, 12) };
    }

    return { stan, wlaczDarowizny, wylaczDarowizny, publiczne, sesjaZakupu, sprawdzSesje, pobranie, sprzedaz: async () => (await czytaj()).sprzedaz,
        stanConnect, kontoAutora, linkOnboardingu, stanKontaAutora };
}

export default { utworzStripe, trybKlucza, formularz, centy, LINK_STRIPE, CHECKOUT_STRIPE, WALUTY };
