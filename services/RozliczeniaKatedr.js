/**
 * 💳 ROZLICZENIA KATEDR — przelew GRV między Katedrami za grę (krok 4, Suweren 2026-10-12: „przelew 333 GRV”).
 *
 * Każda Katedra ma WŁASNĄ księgę GRV — żadna liczba nie przechodzi z księgi do księgi. Przelew to dwie połowy
 * spięte podpisanymi pokwitowaniami (ed25519 wizytówek, klucze z rejestru otakos.wtf):
 *   1. KUPUJĄCY podpisuje zlecenie {id, od, do, kwota, gra, czas} i ODKŁADA kwotę w swojej księdze na konto
 *      `rozliczenia-katedr` (nic nie ginie: odrzucone = zwrot, zerwane łącze = zlecenie czeka na ponowienie);
 *   2. SPRZEDAJĄCY sprawdza podpis kluczem kupującego Z REJESTRU, kwotę = cena gry, odbiorcę = siebie, świeżość;
 *      dopisuje kwotę swojemu właścicielowi (ze skarbca swojej księgi) i odsyła POKWITOWANIE podpisane swoim kluczem.
 *      To samo zlecenie drugi raz = to samo pokwitowanie, bez drugiego dopisania;
 *   3. KUPUJĄCY sprawdza pokwitowanie kluczem sprzedającego z rejestru → odłożone GRV idą do skarbca jego księgi
 *      (wyszły z jego obiegu), zakup „potwierdzony”. Obie Katedry trzymają zlecenie i pokwitowanie — dowód dla obu.
 * Paczkę (zip) sprzedający wydaje tylko Katedrze z potwierdzonym zakupem — żądanie podpisane jej kluczem
 * (`naglowkiPobrania`). Gra gościa na wyspie (pliki statyczne) zostaje darmowa — płaci się za własną kopię.
 * ⚠️ UCZCIWIE: tożsamość potwierdza rejestr; skoro księgi są osobne, obie połowy to deklaracje Katedr spięte podpisami.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const KONTO_ROZLICZEN = 'rozliczenia-katedr';
const NICK = /^[a-z0-9][a-z0-9-]{2,31}$/;
const ID_GRY = /^[a-z0-9][a-z0-9-]{1,47}$/;
const ID = /^[0-9a-f]{16}$/;
const SWIEZOSC_MS = 60 * 60_000;
const POBRANIE_MS = 10 * 60_000;

export const trescZlecenia = (z) => `otakos-przelew\n${z.id}\n${z.od}\n${z.do}\n${z.kwota}\n${z.gra}\n${z.czas}`;
export const trescPokwitowania = (z, czas) => `otakos-pokwitowanie\n${z.id}\n${z.do}\n${z.od}\n${z.kwota}\n${z.gra}\n${czas}`;
export const trescPobrania = (gra, nick, czas) => `otakos-pobranie\n${gra}\n${nick}\n${czas}`;

export function sprawdzPodpis(tekst, kluczB64, podpisB64) {
    try { return crypto.verify(null, Buffer.from(tekst, 'utf8'), crypto.createPublicKey({ key: Buffer.from(String(kluczB64), 'base64'), format: 'der', type: 'spki' }), Buffer.from(String(podpisB64 ?? ''), 'base64')); }
    catch { return false; }
}

/** Zlecenie z sieci: tylko znane pola, typy i granice — reszta = odrzucone. */
export function oczyscZlecenie(z) {
    if (!z || typeof z !== 'object') return null;
    const kwota = Number(z.kwota);
    if (!ID.test(String(z.id)) || !NICK.test(String(z.od)) || !NICK.test(String(z.do)) || !ID_GRY.test(String(z.gra))) return null;
    if (!Number.isInteger(kwota) || kwota <= 0 || kwota > 1_000_000 || !Number.isFinite(Date.parse(z.czas))) return null;
    return { id: z.id, od: z.od, do: z.do, kwota, gra: z.gra, czas: new Date(Date.parse(z.czas)).toISOString() };
}

/**
 * @param {{ katalog: string, nick: () => Promise<string|null>, podpisz: (t: string) => Promise<string>,
 *           katedra: (nick: string) => Promise<{ nick: string, adres: string, klucz: string }>,
 *           ksiega: { przelej: (od: string, do: string, kwota: number, notatka: object) => Promise<unknown>, wlasciciel: () => Promise<string|null>, zarzadca: () => Promise<string>, saldo: (wezel: string) => Promise<number|'INFINITE'> },
 *           cena: (gra: string) => Promise<number|null>, fetch?: Function, teraz?: () => number, szyna?: object }} o
 */
export function utworzRozliczenia({ katalog, nick, podpisz, katedra, ksiega, cena, fetch: f = globalThis.fetch, teraz = () => Date.now(), szyna = null }) {
    const PLIK = path.join(katalog, 'rozliczenia-katedr.json');
    let kolejka = Promise.resolve();   // zapisy po kolei (księga + plik) — dwa żądania naraz nie zdublują przelewu
    const poKolei = (fn) => { const p = kolejka.then(fn, fn); kolejka = p.catch(() => {}); return p; };
    const czytaj = async () => { try { return JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { return { zakupy: [], sprzedaz: [] }; } };
    const zapisz = async (d) => { await fs.mkdir(katalog, { recursive: true }); await fs.writeFile(PLIK, JSON.stringify(d, null, 2), 'utf8'); };
    const wiesc = (tresc) => szyna?.nadaj?.({ agent: 'kupiec', rodzaj: 'praca', tresc })?.catch?.(() => {});

    // ── SPRZEDAJĄCY ──
    /** Zlecenie od innej Katedry (publiczny POST) → pokwitowanie albo odmowa `{ odrzucone: true, powod }`. */
    function przyjmij(cialo) {
        return poKolei(async () => {
            const ja = await nick();
            const z = oczyscZlecenie(cialo?.zlecenie);
            const odmowa = (powod) => ({ odrzucone: true, powod });
            if (!ja) return odmowa('Ta Katedra nie ma nicka wizytówki.');
            if (!z) return odmowa('Zlecenie niepełne albo złe pola.');
            const d = await czytaj();
            const byla = d.sprzedaz.find((x) => x.id === z.id);
            if (byla) return byla.od === z.od ? { pokwitowanie: byla.pokwitowanie, powtorka: true } : odmowa('To id zlecenia należy do innej Katedry.');
            if (z.do !== ja) return odmowa(`Zlecenie jest do „${z.do}”, nie do tej Katedry.`);
            if (z.od === ja) return odmowa('Katedra nie płaci sama sobie.');
            if (Math.abs(teraz() - Date.parse(z.czas)) > SWIEZOSC_MS) return odmowa('Zlecenie przeterminowane (ponad godzinę) — złóż nowe.');
            const c = await cena(z.gra);
            if (c == null) return odmowa(`Ta Katedra nie sprzedaje gry „${z.gra}”.`);
            if (z.kwota !== c) return odmowa(`Cena gry to ${c} GRV, a zlecenie mówi ${z.kwota} GRV.`);
            let k;
            try { k = await katedra(z.od); } catch (e) { return odmowa(`Kupującego nie ma w rejestrze otakos.wtf (${e.message}).`); }
            if (!sprawdzPodpis(trescZlecenia(z), k.klucz, cialo.podpis)) return odmowa('Podpis zlecenia nie zgadza się z kluczem kupującego z rejestru.');
            const wlasciciel = await ksiega.wlasciciel();
            if (!wlasciciel) return odmowa('Księga tej Katedry nie ma właściciela.');
            await ksiega.przelej(await ksiega.zarzadca(), wlasciciel, z.kwota, { rozliczenie: z.id, od: z.od, gra: z.gra, strona: 'sprzedaz' });
            const czas = new Date(teraz()).toISOString();
            const pokwitowanie = { czas, nick: ja, podpis: await podpisz(trescPokwitowania(z, czas)) };
            d.sprzedaz.push({ ...z, podpisZlecenia: cialo.podpis, pokwitowanie, kiedy: czas, dlaWezla: wlasciciel });
            await zapisz(d);
            await wiesc(`💳 Katedra „${z.od}” zapłaciła ${z.kwota} GRV za „${z.gra}” — dopisane w księdze, pokwitowanie wysłane.`);
            return { pokwitowanie };
        });
    }

    /** Czy Katedra `nick` może pobrać paczkę gry: darmowa, albo potwierdzony zakup i świeży podpis jej kluczem. */
    async function mozePobrac(gra, { nick: kto, czas, podpis } = {}) {
        const c = await cena(gra);
        if (c == null) return { tak: false, powod: 'Ta Katedra nie udostępnia takiej gry.' };
        if (c === 0) return { tak: true };
        if (!NICK.test(String(kto ?? '')) || !Number.isFinite(Date.parse(czas)) || Math.abs(teraz() - Date.parse(czas)) > POBRANIE_MS) return { tak: false, powod: `Paczka kosztuje ${c} GRV — pobiera ją Katedra po zapłacie (podpisane żądanie).` };
        const d = await czytaj();
        if (!d.sprzedaz.some((x) => x.od === kto && x.gra === gra)) return { tak: false, powod: `Katedra „${kto}” nie zapłaciła jeszcze za „${gra}” (${c} GRV).` };
        let k; try { k = await katedra(kto); } catch { return { tak: false, powod: 'Kupującego nie ma w rejestrze.' }; }
        return sprawdzPodpis(trescPobrania(gra, kto, czas), k.klucz, podpis) ? { tak: true } : { tak: false, powod: 'Podpis żądania nie zgadza się z kluczem Katedry z rejestru.' };
    }

    // ── KUPUJĄCY ──
    /** Nagłówki pobrania paczki podpisane kluczem tej Katedry. */
    async function naglowkiPobrania(gra) {
        const ja = await nick();
        const czas = new Date(teraz()).toISOString();
        return { 'x-katedra-nick': ja, 'x-katedra-czas': czas, 'x-katedra-podpis': await podpisz(trescPobrania(gra, ja, czas)) };
    }

    /** Czy już zapłaciliśmy tej Katedrze za tę grę (potwierdzone pokwitowaniem). */
    async function zaplacone(sprzedawca, gra) { return (await czytaj()).zakupy.some((x) => x.do === sprzedawca && x.gra === gra && x.stan === 'potwierdzona'); }

    /** Wysyła zlecenie (nowe albo czekające) i rozlicza odpowiedź. Wołane w kolejce. */
    async function wyslij(z, podpis) {
        const d = await czytaj();
        const wpis = d.zakupy.find((x) => x.id === z.id);
        const ustaw = async (pola) => { Object.assign(wpis, pola); await zapisz(d); return { ...wpis }; };
        let k, r, odp;
        try {
            k = await katedra(z.do);
            r = await f(`${k.adres}/wizytowka/gra/${z.gra}/platnosc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zlecenie: z, podpis }), signal: AbortSignal.timeout(30_000), redirect: 'error' });
            odp = await r.json().catch(() => ({}));
        } catch (e) { return ustaw({ stan: 'wyslana', blad: `Katedra „${z.do}” nie odpowiedziała (${e.message}) — GRV czekają odłożone, ponów później.` }); }
        if (odp?.odrzucone) {
            const wlasciciel = await ksiega.wlasciciel();
            await ksiega.przelej(KONTO_ROZLICZEN, wpis.zWezla ?? wlasciciel, z.kwota, { rozliczenie: z.id, strona: 'zwrot', powod: String(odp.powod ?? '').slice(0, 200) });
            return ustaw({ stan: 'zwrot', blad: `Odrzucone: ${String(odp.powod ?? 'bez powodu').slice(0, 300)} — ${z.kwota} GRV wróciło.` });
        }
        const p = odp?.pokwitowanie;
        if (!r.ok || !p?.podpis || !Number.isFinite(Date.parse(p.czas))) return ustaw({ stan: 'wyslana', blad: `Katedra „${z.do}” odpowiedziała HTTP ${r.status} bez pokwitowania — GRV czekają odłożone, ponów później.` });
        if (!sprawdzPodpis(trescPokwitowania(z, p.czas), k.klucz, p.podpis)) return ustaw({ stan: 'wyslana', blad: 'Pokwitowanie z podpisem, który nie zgadza się z kluczem sprzedającego z rejestru — nie zamykam rozliczenia.' });
        await ksiega.przelej(KONTO_ROZLICZEN, await ksiega.zarzadca(), z.kwota, { rozliczenie: z.id, do: z.do, gra: z.gra, strona: 'zakup' });
        await wiesc(`💳 Zapłacone ${z.kwota} GRV Katedrze „${z.do}” za „${z.gra}” — pokwitowanie podpisane jej kluczem.`);
        return ustaw({ stan: 'potwierdzona', pokwitowanie: p, blad: null });
    }

    /** Zapłać Katedrze `sprzedawca` za grę `gra` kwotę `kwota` (cena z jej manifestu, potwierdzona przez Suwerena). */
    function zaplac({ sprzedawca, gra, kwota }) {
        return poKolei(async () => {
            const ja = await nick();
            if (!ja) throw new Error('Ta Katedra nie ma nicka wizytówki — bez niego nie podpisze zlecenia.');
            if (sprzedawca === ja) throw new Error('Katedra nie płaci sama sobie.');
            const d = await czytaj();
            const byl = d.zakupy.find((x) => x.do === sprzedawca && x.gra === gra && ['potwierdzona', 'wyslana'].includes(x.stan));
            if (byl) return byl.stan === 'potwierdzona' ? { ...byl, juz: true } : wyslij(oczyscZlecenie(byl), byl.podpis);
            const z = oczyscZlecenie({ id: crypto.randomBytes(8).toString('hex'), od: ja, do: sprzedawca, kwota, gra, czas: new Date(teraz()).toISOString() });
            if (!z) throw new Error('Złe dane zlecenia (Katedra, gra albo kwota).');
            const wlasciciel = await ksiega.wlasciciel();
            if (!wlasciciel) throw new Error('Księga tej Katedry nie ma właściciela.');
            const saldo = await ksiega.saldo(wlasciciel);
            if (saldo !== 'INFINITE' && Number(saldo) < z.kwota) throw new Error(`Za mało GRV: masz ${saldo}, gra kosztuje ${z.kwota}.`);
            const podpis = await podpisz(trescZlecenia(z));
            await ksiega.przelej(wlasciciel, KONTO_ROZLICZEN, z.kwota, { rozliczenie: z.id, do: z.do, gra: z.gra, strona: 'odlozone' });
            d.zakupy.push({ ...z, podpis, zWezla: wlasciciel, stan: 'wyslana', kiedy: z.czas });
            await zapisz(d);
            return wyslij(z, podpis);
        });
    }

    /** Ponów zlecenie, które czeka (zerwane łącze). */
    function ponow(id) {
        return poKolei(async () => {
            const w = (await czytaj()).zakupy.find((x) => x.id === id);
            if (!w) throw new Error('Nie ma takiego zlecenia.');
            if (w.stan !== 'wyslana') return { ...w };
            return wyslij(oczyscZlecenie(w), w.podpis);
        });
    }

    async function stan() { const d = await czytaj(); return { zakupy: d.zakupy.slice(-50).reverse(), sprzedaz: d.sprzedaz.slice(-50).reverse() }; }

    return { przyjmij, mozePobrac, naglowkiPobrania, zaplacone, zaplac, ponow, stan };
}

export default { utworzRozliczenia, trescZlecenia, trescPokwitowania, trescPobrania, sprawdzPodpis, oczyscZlecenie, KONTO_ROZLICZEN };
