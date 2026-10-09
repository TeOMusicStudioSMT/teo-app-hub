/**
 * 🏛️ Globalny Klub Mistrzów (Suweren 2026-10-09: „przedstawiciel danej Katedry w Globalnym Klubie Mistrzów…
 * organizować eventy globalne”; „robimy Klub Mistrzów”).
 *
 * Bez nowego serwera i bez zmiany rejestru — po drogach, które sieć Katedr już ma:
 *   · PRZEDSTAWICIELSTWO: JaJo Mistrza tej Katedry wystawia się w PUBLICZNEJ wizytówce (`/api/wizytowka`, pole
 *     `mistrz`): etap jaja, event dnia Teterhii, eventy globalne, które ta Katedra organizuje, i jej wyniki.
 *   · POLE: rejestr otakos.wtf (`/api/katedry`) zna Katedry online (nick, adres https, klucz ed25519). Mistrz czyta
 *     ich wizytówki wprost spod adresu i przyjmuje TYLKO te, których nick i klucz zgadzają się z rejestrem.
 *     Z tego składa: kto jest w Klubie, jakie eventy globalne trwają, ranking każdego eventu.
 *   · EVENT GLOBALNY: Suweren ogłasza (np. Turniej Taktu na 3 dni) → idzie w wizytówce → inne Katedry widzą go
 *     w polu, a ich Mistrz mówi o nim w Orbicie („z pola”) → gracze grają turniej w SWOJEJ Teterhii → wynik zapisuje
 *     ich Katedra we własnej wizytówce → organizator i wszyscy widzą ranking.
 * ⚠️ UCZCIWIE: wynik jest DEKLAROWANY przez Katedrę (tożsamość potwierdza rejestr, liczby — nie). Za udział nie płyną
 * GRV między Katedrami; nagroda w mGRV zostaje w grze gracza. To etap 1 Klubu.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const DZIEDZINY = { takt: 'Takt', zwinnosc: 'Zwinność', spryt: 'Spryt', urok: 'Urok' };
export const DZIEDZINY_D = { takt: 'Taktu', zwinnosc: 'Zwinności', spryt: 'Sprytu', urok: 'Uroku' };
export const MAX_MOICH = 3;
export const STARC = 3;
const NICK = /^[a-z0-9][a-z0-9-]{2,31}$/;
const ID = /^g-[0-9a-f]{8}$/;
const POLE_WAZNE_MS = 5 * 60_000;

const dzien = (d) => new Date(d).toISOString().slice(0, 10);
const klucz = (organizator, id) => `${organizator}:${id}`;

/** Event globalny (mój albo z sieci) → bezpieczna postać; null = śmieci / nie trwa. */
export function eventZSieci(e, organizator, teraz = Date.now()) {
    if (!e || typeof e !== 'object' || !ID.test(String(e.id)) || !NICK.test(String(organizator))) return null;
    if (e.typ !== 'turniej' || !DZIEDZINY[e.dziedzina]) return null;
    const od = String(e.od ?? '').slice(0, 10), do_ = String(e.do ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(od) || !/^\d{4}-\d{2}-\d{2}$/.test(do_)) return null;
    const dzis = dzien(teraz);
    if (dzis < od || dzis > do_) return null;
    return { klucz: klucz(organizator, e.id), id: e.id, organizator, typ: 'turniej', dziedzina: e.dziedzina, nazwa: `Turniej ${DZIEDZINY_D[e.dziedzina]} Klubu Mistrzów`, opis: String(e.opis ?? '').slice(0, 200), od, do: do_, starc: STARC };
}

/** Wynik z wizytówki → bezpieczna postać. */
export function wynikZSieci(w, nick) {
    if (!w || typeof w !== 'object' || !/^[a-z0-9-]{3,32}:g-[0-9a-f]{8}$/.test(String(w.event))) return null;
    const starc = Number(w.starc), wygrane = Math.round(Number(w.wygrane));
    if (starc !== STARC || !(wygrane >= 0 && wygrane <= starc)) return null;
    return { event: w.event, nick, wygrane, starc, kiedy: String(w.kiedy ?? '').slice(0, 30), mini: Array.isArray(w.mini) ? w.mini.map((x) => String(x).slice(0, 30)).slice(0, 3) : [] };
}

/** Ranking eventu: najwięcej wygranych, przy remisie wcześniejszy. */
export function ranking(wyniki) {
    return [...wyniki].sort((a, b) => b.wygrane - a.wygrane || String(a.kiedy).localeCompare(String(b.kiedy)));
}

/**
 * @param {{ katalog: string, nick: () => Promise<string|null>, rejestr: string, mistrz?: () => Promise<object>,
 *           wiesc?: (w:object) => Promise<unknown>, fetch?: Function, teraz?: () => number }} o
 */
export function utworzKlub({ katalog, nick, rejestr, mistrz = async () => ({}), wiesc = null, fetch: f = globalThis.fetch, teraz = () => Date.now() }) {
    const PLIK = () => path.join(katalog, 'klub-mistrzow.json');
    let pamiec = null;
    let pole = { kiedy: 0, wynik: null };
    let trwa = null;

    async function wczytaj() {
        if (pamiec) return pamiec;
        try { pamiec = JSON.parse(await fs.readFile(PLIK(), 'utf8')); } catch { pamiec = {}; }
        pamiec.eventy ??= []; pamiec.wyniki ??= {}; pamiec.widziane ??= [];
        return pamiec;
    }
    async function zapisz() { await fs.mkdir(katalog, { recursive: true }); await fs.writeFile(PLIK(), JSON.stringify(pamiec, null, 2), 'utf8'); }

    async function mojeAktywne() {
        const ja = await nick();
        const s = await wczytaj();
        return ja ? s.eventy.map((e) => eventZSieci(e, ja, teraz())).filter(Boolean) : [];
    }

    /** Pole `mistrz` publicznej wizytówki — tylko to, co ma wyjść do sieci. */
    async function publiczne() {
        const s = await wczytaj();
        const m = await mistrz().catch(() => ({}));
        const wyniki = Object.values(s.wyniki).sort((a, b) => String(b.kiedy).localeCompare(String(a.kiedy))).slice(0, 10);
        const eventy = (await mojeAktywne()).map(({ id, typ, dziedzina, opis, od, do: do_ }) => ({ id, typ, dziedzina, opis, od, do: do_ }));
        return { wersja: 1, imie: 'JaJo Mistrza', ...m, eventy, wyniki };
    }

    /** Suweren ogłasza event globalny (dziś: turniej w dziedzinie na 1–7 dni). */
    async function oglos({ dziedzina, dni = 3, opis = '' } = {}) {
        const ja = await nick();
        if (!ja) throw new Error('Katedra nie ma nicku w sieci — najpierw 🪪 Wizytówka (nick), wtedy Klub Cię zobaczy.');
        if (!DZIEDZINY[dziedzina]) throw new Error(`Dziedzina: ${Object.keys(DZIEDZINY).join(', ')}.`);
        const n = Math.round(Number(dni));
        if (!(n >= 1 && n <= 7)) throw new Error('Event trwa od 1 do 7 dni.');
        if ((await mojeAktywne()).length >= MAX_MOICH) throw new Error(`Najwyżej ${MAX_MOICH} Twoje eventy naraz — wycofaj któryś.`);
        const s = await wczytaj();
        const e = { id: `g-${crypto.randomBytes(4).toString('hex')}`, typ: 'turniej', dziedzina, opis: String(opis).replace(/\s+/g, ' ').trim().slice(0, 200), od: dzien(teraz()), do: dzien(teraz() + (n - 1) * 86_400_000), utworzono: new Date(teraz()).toISOString() };
        s.eventy.push(e);
        s.eventy = s.eventy.filter((x) => eventZSieci(x, ja, teraz()) || x === e).slice(-20);
        await zapisz();
        const ev = eventZSieci(e, ja, teraz());
        await wiesc?.({ rodzaj: 'klub', skad: 'Klub Mistrzów', glos: true, tresc: `🏛️ Ogłosiłeś w Klubie Mistrzów: ${ev.nazwa} do ${ev.do}. Katedry w sieci zobaczą go przy najbliższym zwiadzie Mistrza.` })?.catch?.(() => {});
        return ev;
    }
    async function wycofaj(id) {
        const s = await wczytaj();
        const przed = s.eventy.length;
        s.eventy = s.eventy.filter((e) => e.id !== id);
        if (s.eventy.length === przed) throw new Error('Nie ma takiego Twojego eventu.');
        await zapisz();
        return true;
    }

    /** Czyta pole: Katedry z rejestru → ich wizytówki (nick + klucz zgodne z rejestrem) → Klub, eventy, rankingi. */
    async function zwiad({ swiezo = false } = {}) {
        if (!swiezo && pole.wynik && teraz() - pole.kiedy < POLE_WAZNE_MS) return pole.wynik;
        if (trwa) return trwa;
        trwa = (async () => {
            const ja = await nick();
            const r = await f(rejestr, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'otakos-katedra' } });
            if (!r.ok) throw new Error(`Rejestr otakos.wtf odpowiedział HTTP ${r.status}.`);
            const d = await r.json().catch(() => ({}));
            const katedry = (Array.isArray(d?.katedry) ? d.katedry : []).filter((k) => NICK.test(k?.nick ?? '') && typeof k.klucz === 'string' && /^https:\/\//.test(k.adres ?? '') && k.nick !== ja).slice(0, 30);
            const czlonkowie = [], pominiete = [];
            for (let i = 0; i < katedry.length; i += 5) {
                await Promise.all(katedry.slice(i, i + 5).map(async (k) => {
                    try {
                        const w = await (await f(`${k.adres.replace(/\/+$/, '')}/api/wizytowka`, { signal: AbortSignal.timeout(8000) })).json();
                        if (w?.nick !== k.nick || w?.klucz !== k.klucz) { pominiete.push({ nick: k.nick, powod: 'wizytówka nie zgadza się z rejestrem (nick/klucz)' }); return; }
                        if (!w.mistrz || typeof w.mistrz !== 'object') { pominiete.push({ nick: k.nick, powod: 'Katedra bez Mistrza (starsza wersja)' }); return; }
                        const m = w.mistrz;
                        czlonkowie.push({ nick: k.nick, motto: String(w.motto ?? '').slice(0, 140), etap: String(m.etap ?? '').slice(0, 20), teterhia: String(m.teterhia ?? '').slice(0, 80) || null,
                            eventy: (Array.isArray(m.eventy) ? m.eventy : []).slice(0, MAX_MOICH).map((e) => eventZSieci(e, k.nick, teraz())).filter(Boolean),
                            wyniki: (Array.isArray(m.wyniki) ? m.wyniki : []).slice(0, 10).map((x) => wynikZSieci(x, k.nick)).filter(Boolean) });
                    } catch (e) { pominiete.push({ nick: k.nick, powod: `nie odpowiada (${String(e.message).slice(0, 60)})` }); }
                }));
            }
            const ja_ = ja ? { nick: ja, ...(await publiczne()) } : null;
            const mojeEventy = await mojeAktywne();
            const eventy = [...mojeEventy, ...czlonkowie.flatMap((c) => c.eventy)];
            const s = await wczytaj();
            const wszystkieWyniki = [...czlonkowie.flatMap((c) => c.wyniki), ...(ja ? Object.values(s.wyniki).map((w) => wynikZSieci(w, ja)).filter(Boolean) : [])];
            const rankingi = Object.fromEntries(eventy.map((e) => [e.klucz, ranking(wszystkieWyniki.filter((w) => w.event === e.klucz))]));
            // 📯 nowe eventy innych i nowe wyniki w moich eventach — Mistrz mówi o nich w Orbicie (każde raz)
            const widziane = new Set(s.widziane);
            const doOgloszenia = [];
            for (const e of czlonkowie.flatMap((c) => c.eventy)) if (!widziane.has(e.klucz)) { widziane.add(e.klucz); doOgloszenia.push({ glos: true, tresc: `🏛️ Klub Mistrzów: Katedra „${e.organizator}” ogłasza ${e.nazwa} do ${e.do}${e.opis ? ` — ${e.opis}` : ''}. Zagraj w Teterhii (K → turniej).` }); }
            for (const e of mojeEventy) for (const w of rankingi[e.klucz].filter((x) => x.nick !== ja)) {
                const k = `${e.klucz}|${w.nick}|${w.wygrane}`;
                if (!widziane.has(k)) { widziane.add(k); doOgloszenia.push({ glos: w.wygrane === w.starc, tresc: `🏛️ ${e.nazwa} (Twój): Katedra „${w.nick}” — ${w.wygrane}/${w.starc}.` }); }
            }
            if (doOgloszenia.length) { s.widziane = [...widziane].slice(-500); await zapisz(); for (const o of doOgloszenia.slice(0, 5)) await wiesc?.({ rodzaj: 'klub', skad: 'Klub Mistrzów · z pola', ...o })?.catch?.(() => {}); }
            const wynik = { kiedy: new Date(teraz()).toISOString(), ja: ja_, online: katedry.length, czlonkowie, pominiete, eventy, rankingi };
            pole = { kiedy: teraz(), wynik };
            return wynik;
        })();
        try { return await trwa; } finally { trwa = null; }
    }

    /** Eventy globalne, które gracz tej Katedry może dziś zagrać (dla gry). Pole z pamięci — bez czekania na sieć. */
    async function aktywneGlobalne() {
        const z = pole.wynik ? pole.wynik.eventy.filter((e) => eventZSieci(e, e.organizator, teraz())) : await mojeAktywne();
        return z.map((e) => ({ ...e, mod: { turniej: { dziedzina: e.dziedzina, starc: e.starc, nagrodaMGRV: 0 } } }));
    }

    /** Wynik gracza tej Katedry w evencie globalnym — najlepszy zostaje, idzie w wizytówce. */
    async function zapiszWynik({ event, dziedzina, wygrane, starc, mini = [] } = {}) {
        const e = (await aktywneGlobalne()).find((x) => x.klucz === event);
        if (!e) throw new Error('Ten event Klubu Mistrzów nie trwa (albo Mistrz go jeszcze nie widział).');
        if (e.dziedzina !== dziedzina) throw new Error(`${e.nazwa} jest w dziedzinie ${DZIEDZINY[e.dziedzina]}.`);
        const w = wynikZSieci({ event, wygrane, starc, kiedy: new Date(teraz()).toISOString(), mini }, 'ja');
        if (!w) throw new Error(`Turniej Klubu ma ${STARC} starcia — wynik się nie zgadza.`);
        const s = await wczytaj();
        const stary = s.wyniki[event];
        const lepszy = !stary || w.wygrane > stary.wygrane;
        if (lepszy) { const { nick: _n, ...bez } = w; s.wyniki[event] = { ...bez, organizator: e.organizator, dziedzina }; await zapisz(); }
        return { event: e, wynik: lepszy ? w : { ...stary }, poprawiony: lepszy };
    }

    let petla = null;
    function startPetli(ms = 10 * 60_000) {
        if (petla) return;
        const krok = () => { void nick().then((n) => (n ? zwiad({ swiezo: true }) : null)).catch(() => {}); };
        setTimeout(krok, 90_000);
        petla = setInterval(krok, ms);
        petla.unref?.();
    }

    return { publiczne, oglos, wycofaj, zwiad, aktywneGlobalne, zapiszWynik, mojeAktywne, startPetli, ostatniZwiad: () => pole.wynik };
}

export default { utworzKlub, eventZSieci, wynikZSieci, ranking, DZIEDZINY, DZIEDZINY_D, MAX_MOICH, STARC };
