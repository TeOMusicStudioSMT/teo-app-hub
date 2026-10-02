/**
 * 🪪 WIZYTÓWKA — publiczna strona tej Katedry w sieci otakos.wtf (2026-10-02).
 *
 * Suweren: „to personalna strona każdej katedry z jej twórczością… na otakos.wtf, jak przesuniesz
 * w prawo, wyświetla się twoja wersja teo.center… a dalej każdy inny dostępny w sieci (jak scroll
 * shortów), wyświetlają się tylko Nicki katedr… wszystko suwerennie, na tej jednej domenie".
 *
 * JAK TO DZIAŁA:
 *   · Treść = Wystawa (services/Wystawa.js) bez pozycji ukrytych + profil (nick, motto, opis).
 *     Wizytówka NIE niesie ścieżek z dysku — tylko id; pliki idą przez /wizytowka/plik/:id
 *     i tylko dla id, które są w tej wizytówce (nie cała biała lista Wystawy).
 *   · Meldunek: gdy Suweren go włączy, a Kwantowy Tunel działa, co minutę idzie do rejestru
 *     otakos.wtf: nick + adres tunelu + czas, PODPISANE kluczem ed25519 tej Katedry. Rejestr
 *     pokazuje tylko nicki, które Suweren otakos.wtf zatwierdził razem z kluczem — nikt nie
 *     podszyje się pod cudzy nick, a obca treść nie trafi na stronę bez zgody.
 *   · Klucz prywatny nie opuszcza maszyny (`_OtakOs_Wymiar/wizytowka-klucz.json`).
 *
 * ⚠️ Tunel wystawia przez Straż TYLKO GET wizytówki i jej pliki (SCIEZKI_WIZYTOWKI) — reszta
 * mostu dalej żąda klucza sesji. Bez nicka wizytówka nie istnieje (404), bez zgody nie ma meldunku.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

let cfg = {
    katalog: null,                 // _OtakOs_Wymiar
    wystawa: null,                 // moduł Wystawa (zbierz, kuracja, plakat)
    tunel: async () => ({ stan: 'zatrzymany', adres: null }),
    rejestr: process.env.OTAKOS_REJESTR_URL || 'https://otakos.wtf/api/katedry',
    fetch: (...a) => fetch(...a),
    szyna: null,
    tostKlucz: null,               // () => klucz publiczny X25519 TOST-a (services/TostSiec.js) — w wizytówce
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

const PLIK_PROFILU = () => path.join(cfg.katalog, 'wizytowka.json');
const PLIK_KLUCZA = () => path.join(cfg.katalog, 'wizytowka-klucz.json');
const KATALOG_PLAKATOW = () => path.join(cfg.katalog, 'wizytowka', 'plakaty');
export const NICK = /^[a-z0-9][a-z0-9-]{2,31}$/;

async function czytajJson(p, d) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } }
async function zapiszJson(p, d) { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, JSON.stringify(d, null, 2), 'utf8'); }

// ── Klucz ed25519 Katedry ────────────────────────────────────────────────────
let kluczCache = null;
export async function klucz() {
    if (kluczCache) return kluczCache;
    let k = await czytajJson(PLIK_KLUCZA(), null);
    if (!k?.prywatny || !k?.publiczny) {
        const para = crypto.generateKeyPairSync('ed25519');
        k = {
            publiczny: para.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
            prywatny: para.privateKey.export({ format: 'pem', type: 'pkcs8' }),
            utworzono: new Date().toISOString(),
        };
        await zapiszJson(PLIK_KLUCZA(), k);
    }
    kluczCache = { publiczny: k.publiczny, prywatny: crypto.createPrivateKey(k.prywatny) };
    return kluczCache;
}

/** Treść podpisu meldunku — ta sama funkcja musi być po stronie rejestru (otakos.wtf/server). */
export const trescMeldunku = ({ nick, adres, czas }) => `otakos-meldunek\n${nick}\n${adres}\n${czas}`;

export async function podpisz(dane) { return podpiszTekst(trescMeldunku(dane)); }
/** Podpis dowolnej treści kluczem wizytówki (meldunek, koperty TOST). */
export async function podpiszTekst(tekst) {
    const { prywatny } = await klucz();
    return crypto.sign(null, Buffer.from(tekst, 'utf8'), prywatny).toString('base64');
}

// ── Profil ───────────────────────────────────────────────────────────────────
const tekst = (x, max) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function profil() {
    const p = await czytajJson(PLIK_PROFILU(), {});
    const { publiczny } = await klucz();
    return {
        nick: NICK.test(p.nick ?? '') ? p.nick : '',
        motto: tekst(p.motto, 140),
        opis: tekst(p.opis, 600),
        meldunek: p.meldunek === true,
        klucz: publiczny,
        ostatniMeldunek: stanMeldunku,
        rejestr: cfg.rejestr,
    };
}

export async function ustawProfil({ nick, motto, opis, meldunek } = {}) {
    const p = await czytajJson(PLIK_PROFILU(), {});
    if (nick !== undefined) {
        const n = String(nick).trim().toLowerCase();
        if (n && !NICK.test(n)) throw new Error('Nick: 3–32 znaki, małe litery a–z, cyfry i „-” (bez polskich liter i spacji) — to adres w sieci, nie podpis.');
        p.nick = n;
    }
    if (motto !== undefined) p.motto = tekst(motto, 140);
    if (opis !== undefined) p.opis = tekst(opis, 600);
    if (meldunek !== undefined) p.meldunek = meldunek === true;
    await zapiszJson(PLIK_PROFILU(), p);
    if (p.meldunek) setTimeout(() => { void meldunek_(); }, 0);
    return profil();
}

// ── Publiczna wizytówka ──────────────────────────────────────────────────────
let publiczneId = new Map();   // id → { plik, film:boolean } — tylko to, co jest w wizytówce

export async function publiczna({ ileFilmow = 12, ileUtworow = 12, ileProduktow = 24 } = {}) {
    const p = await profil();
    if (!p.nick) return null;
    const w = await cfg.wystawa.zbierz();
    const ids = new Map();
    const filmy = w.filmy.filter((x) => !x.ukryty).slice(0, ileFilmow).map((f) => {
        ids.set(f.id, { plik: f.plik, film: true });
        return { id: f.id, rodzaj: f.rodzaj, projekt: f.projekt, tytul: f.tytul, opis: f.opis, kiedy: f.kiedy, youtube: f.youtube?.id ?? null, plik: `/wizytowka/plik/${f.id}`, plakat: `/wizytowka/plakat/${f.id}` };
    });
    const utwory = w.utwory.filter((x) => !x.ukryty).slice(0, ileUtworow).map((u) => {
        ids.set(u.id, { plik: u.plik, film: false });
        return { id: u.id, tytul: u.tytul, kiedy: u.kiedy, plik: `/wizytowka/plik/${u.id}` };
    });
    const produkty = w.produkty.filter((x) => !x.ukryty).slice(0, ileProduktow).map((x) => {
        if (x.obraz) ids.set(x.id, { plik: x.obraz, film: false });
        return { id: x.id, rodzaj: x.rodzaj, dzial: x.dzial, tytul: x.tytul, opis: x.opis, kiedy: x.kiedy, obraz: x.obraz ? `/wizytowka/plik/${x.id}` : null };
    });
    const suno = (w.suno ?? []).map((s) => ({ typ: s.typ, id: s.id, url: s.url, tytul: s.tytul, opis: s.opis, embed: s.embed, okladka: s.okladka ?? null, sekundy: s.sekundy ?? null, utwory: (s.utwory ?? []).map((u) => ({ id: u.id, tytul: u.tytul, sekundy: u.sekundy ?? null, okladka: u.okladka ?? null, embed: u.embed, url: u.url })) }));
    publiczneId = ids;
    const tost = cfg.tostKlucz ? await cfg.tostKlucz().catch(() => null) : null;
    return { wersja: 1, nick: p.nick, motto: p.motto, opis: p.opis, klucz: p.klucz, ...(tost ? { tost } : {}), zaktualizowano: new Date().toISOString(), wystawa: { filmy, utwory, suno, produkty } };
}

/** Ścieżka pliku wizytówki — tylko id z ostatnio zbudowanej wizytówki (nigdy ścieżka z URL-a). */
export async function plik(id) {
    if (!publiczneId.has(id)) await publiczna().catch(() => null);
    const x = publiczneId.get(id);
    return x && fsSync.existsSync(x.plik) ? x.plik : null;
}

/** Plakat filmu (klatka z 2 s) liczony raz do katalogu wizytówki. */
export async function plakat(id) {
    if (!publiczneId.has(id)) await publiczna().catch(() => null);
    const x = publiczneId.get(id);
    if (!x?.film || !fsSync.existsSync(x.plik)) return null;
    if (!/^[\w-]+$/.test(id)) return null;
    await fs.mkdir(KATALOG_PLAKATOW(), { recursive: true });
    const cel = path.join(KATALOG_PLAKATOW(), `${id}.jpg`);
    return (await cfg.wystawa.plakat(x.plik, cel, true)) ? cel : null;
}

// ── Meldunek do rejestru otakos.wtf ──────────────────────────────────────────
let stanMeldunku = null;   // { kiedy, ok, status, wiadomosc, adres }
let petla = null;

async function meldunek_() {
    const p = await profil();
    if (!p.meldunek || !p.nick) { stanMeldunku = null; return null; }
    const t = await cfg.tunel();
    if (t?.stan !== 'dziala' || !t?.adres) {
        stanMeldunku = { kiedy: new Date().toISOString(), ok: false, status: 0, wiadomosc: 'Kwantowy Tunel nie działa — bez tunelu sieć nie ma jak zobaczyć wizytówki. Uruchom tunel w karcie Tunelu.', adres: null };
        return stanMeldunku;
    }
    const dane = { nick: p.nick, adres: String(t.adres).replace(/\/+$/, ''), czas: new Date().toISOString() };
    try {
        const r = await cfg.fetch(`${cfg.rejestr}/meldunek`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...dane, klucz: p.klucz, podpis: await podpisz(dane) }),
            signal: AbortSignal.timeout(20_000),
        });
        const d = await r.json().catch(() => ({}));
        stanMeldunku = { kiedy: dane.czas, ok: r.ok, status: r.status, wiadomosc: d.wiadomosc || d.message || (r.ok ? 'Zameldowana.' : `HTTP ${r.status}`), adres: dane.adres };
    } catch (e) {
        stanMeldunku = { kiedy: dane.czas, ok: false, status: 0, wiadomosc: `Rejestr nieosiągalny: ${e.message}`, adres: dane.adres };
    }
    return stanMeldunku;
}
export const meldunek = meldunek_;

/** Pętla meldunku (co 60 s). Sama nic nie wysyła, dopóki Suweren nie włączy meldunku. */
export function startPetli(ms = 60_000) {
    if (petla) return;
    petla = setInterval(() => { void meldunek_().catch(() => {}); }, ms);
    petla.unref?.();
    setTimeout(() => { void meldunek_().catch(() => {}); }, 5_000).unref?.();
}

export default { skonfiguruj, klucz, podpisz, podpiszTekst, trescMeldunku, profil, ustawProfil, publiczna, plik, plakat, meldunek, startPetli, NICK };
