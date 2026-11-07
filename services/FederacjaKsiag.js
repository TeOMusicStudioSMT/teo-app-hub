/**
 * 📚🏛️ Federacja Wydawnicza teostory.studio (2026-11-07: „każda Katedra TeOnauty może wystawiać swoje Żywe Księgi /
 * Audiobooki w katalogu teostory.studio”). Wzór: paczki gier i rozliczenia między Katedrami (podpisy ed25519, klucz Z REJESTRU).
 *
 * AUTOR (dowolna Katedra): księga wystawiona w JEJ Wypożyczalni → zgłoszenie {nick, id, tytuł, autor, opis, okładka, próbka
 *   audio, poziom, cena, sha256 księgi, adres tunelu, czas} podpisane kluczem wizytówki → POST do wydawcy
 *   (`OTAKOS_TEOSTORY_WYDAWCA`, domyślnie tunel głównego węzła — ten sam, który czyta portal teostory.studio).
 * WYDAWCA: nick w rejestrze otakos.wtf, podpis kluczem Z REJESTRU, świeżość ≤ 1 h, adres = adres z rejestru, księga
 *   naprawdę stoi w publicznym katalogu Katedry autora (tytuł, poziom, cena zgodne) → `do_zgody` w Izbie zgód → ✓ = w katalogu.
 *   Katalog wydawcy podaje przyjęte pozycje z `katedra {nick, adres}` i podpisem; czytanie i płatność idą PROSTO do Katedry
 *   autora (jej Stripe, jej dostęp 48 h). Wydawca nie trzyma treści księgi ani pieniędzy — trzyma wpis i autorstwo
 *   (Skarbnik: kto jest autorem pozycji, pod przyszłe rozliczenia).
 * Zgłoszenie tej samej księgi od nowa = aktualizacja wpisu; przyjęta zostaje przyjęta, jeśli tytuł i autor się nie zmieniły.
 * Wycofanie = podpisane `akcja: wycofaj`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { sprawdzPodpis } from './RozliczeniaKatedr.js';

const NICK = /^[a-z0-9][a-z0-9-]{2,31}$/;
const ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
export const SWIEZOSC_MS = 60 * 60_000;
export const MAX_POZYCJI = 2000;
const krotko = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const httpsLubNull = (u) => { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.href.slice(0, 600) : null; } catch { return null; } };
const origin = (u) => { try { return new URL(String(u)).origin; } catch { return null; } };

export const trescZgloszenia = (z) => ['otakos-ksiega', z.akcja, z.nick, z.id, z.tytul, z.autor, z.tier, z.cenaEur, z.sha256, z.adres, z.czas].join('\n');

/** Zgłoszenie z sieci: tylko znane pola, typy i granice — inaczej null. */
export function oczyscZgloszenie(z) {
    if (!z || typeof z !== 'object') return null;
    const akcja = z.akcja === 'wycofaj' ? 'wycofaj' : z.akcja === 'zglos' ? 'zglos' : null;
    if (!akcja || !NICK.test(String(z.nick)) || !ID.test(String(z.id)) || !Number.isFinite(Date.parse(z.czas))) return null;
    const adres = origin(z.adres);
    if (!adres || !adres.startsWith('https://')) return null;
    const tier = z.tier === 'demo' ? 'demo' : z.tier === 'rental_48h' ? 'rental_48h' : null;
    const cena = Math.round(Number(z.cenaEur) * 100) / 100;
    if (akcja === 'zglos' && (!tier || !(cena >= 0 && cena <= 100) || !/^[0-9a-f]{64}$/.test(String(z.sha256)) || !krotko(z.tytul, 200))) return null;
    return { akcja, nick: z.nick, id: z.id, tytul: krotko(z.tytul, 200), autor: krotko(z.autor, 120), tier: tier ?? '', cenaEur: Number.isFinite(cena) ? cena : 0,
        sha256: String(z.sha256 ?? ''), adres, czas: new Date(Date.parse(z.czas)).toISOString(),
        podtytul: krotko(z.podtytul, 200), opis: krotko(z.opis, 600), stron: Math.max(0, Math.min(300, Math.round(Number(z.stron) || 0))),
        okladka: httpsLubNull(z.okladka), probka: httpsLubNull(z.probka), jezyk: z.jezyk === 'en' ? 'en' : z.jezyk === 'pl' ? 'pl' : null,
        rodzaj: z.rodzaj === 'audiobook' ? 'audiobook' : 'zywa-ksiega', podpis: String(z.podpis ?? '').slice(0, 200) };
}

/**
 * @param {{ katalog: string, nick: () => Promise<string|null>, podpisz: (t:string) => Promise<string>, adres: () => Promise<string|null>,
 *   katedra: (nick:string) => Promise<{nick:string, adres:string, klucz:string}>, wypozyczalnia: object, plikKsiegi: (id:string) => string|null,
 *   wydawca?: string|null, fetch?: Function, teraz?: () => number, szyna?: object }} o
 */
export function utworzFederacje({ katalog, nick, podpisz, adres, katedra, wypozyczalnia: W, plikKsiegi, wydawca = null, fetch: f = globalThis.fetch, teraz = () => Date.now(), szyna = null }) {
    const PLIK = path.join(katalog, 'federacja.json');           // wydawca: pozycje innych Katedr
    const MOJE = path.join(katalog, 'federacja-moje.json');      // autor: moje zgłoszenia
    let kolejka = Promise.resolve();
    const poKolei = (fn) => { const p = kolejka.then(fn, fn); kolejka = p.catch(() => {}); return p; };
    const czytaj = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
    const zapisz = async (p, o) => { await fs.mkdir(path.dirname(p), { recursive: true }); const t = `${p}.${process.pid}.tmp`; await fs.writeFile(t, JSON.stringify(o, null, 1)); await fs.rename(t, p); };
    const czas = () => new Date(teraz()).toISOString();
    const wiesc = (tresc) => szyna?.nadaj?.({ agent: 'kronikarz', rodzaj: 'praca', tresc })?.catch?.(() => {});
    const blad = (m, kod = 400) => Object.assign(new Error(m), { kod });
    const adresWydawcy = () => String(wydawca || '').replace(/\/+$/, '') || null;

    // ── AUTOR ──
    async function zgloszenie(id, akcja) {
        const ja = await nick();
        if (!ja) throw blad('Najpierw nadaj Katedrze nick (🪪 Wizytówka) — wydawca rozpoznaje Katedrę po nicku z rejestru.');
        const moj = String(await adres() ?? '').replace(/\/+$/, '');
        if (!moj.startsWith('https://')) throw blad('Tunel Katedry nie działa — wydawca musi móc zajrzeć do Twojej Wypożyczalni (🌐 Tunel → włącz).');
        const k = (await W.katalogPelny()).find((x) => x.id === id);
        if (!k) throw blad('Nie ma takiej księgi w Twojej Wypożyczalni.', 404);
        if (akcja === 'zglos' && !k.wystawiona) throw blad('Najpierw wystaw księgę w swojej Wypożyczalni.');
        const p = plikKsiegi(id);
        const book = p ? JSON.parse(await fs.readFile(p, 'utf8')) : null;
        const pub = (await W.katalogPubliczny()).find((x) => x.id === id);
        const okl = pub?.okladka ? (pub.okladka.startsWith('/') ? `${moj}${pub.okladka}` : pub.okladka) : null;
        const pierwszeAudio = book?.pages?.find((s) => s?.audioUrl)?.audioUrl;
        const z = { akcja, nick: ja, id, tytul: k.tytul, autor: k.autor, tier: k.tier, cenaEur: k.cenaEur, adres: moj, czas: czas(),
            sha256: book ? crypto.createHash('sha256').update(JSON.stringify(book)).digest('hex') : '0'.repeat(64),
            podtytul: k.podtytul, opis: k.opis, stron: k.stron, okladka: okl, probka: pierwszeAudio?.startsWith('/') ? `${moj}${pierwszeAudio}` : null,
            jezyk: book?.language ?? null, rodzaj: book?.sourceType === 'author-manuscript' ? 'audiobook' : 'zywa-ksiega' };
        z.podpis = await podpisz(trescZgloszenia(z));
        return z;
    }
    async function wyslij(z) {
        const cel = adresWydawcy();
        if (!cel) throw blad('Nie ma adresu wydawcy teostory.studio (OTAKOS_TEOSTORY_WYDAWCA).');
        let r;
        try { r = await f(`${cel}/wizytowka/teostory/zgloszenie`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'otakos-katedra' }, body: JSON.stringify(z), signal: AbortSignal.timeout(30_000) }); }
        catch (e) { throw blad(`Wydawca (${cel}) nie odpowiada: ${e?.message ?? e}`, 502); }
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.success === false) throw blad(`Wydawca odmówił: ${d.message ?? `HTTP ${r.status}`}`, r.status === 403 ? 403 : 502);
        return d;
    }
    const zglos = (id) => poKolei(async () => {
        const z = await zgloszenie(id, 'zglos');
        const d = await wyslij(z);
        const m = await czytaj(MOJE, { zgloszenia: [] });
        const wpis = { id, tytul: z.tytul, wydawca: adresWydawcy(), stan: d.stan ?? 'do_zgody', wyslano: z.czas, sha256: z.sha256, tier: z.tier, cenaEur: z.cenaEur };
        m.zgloszenia = [wpis, ...m.zgloszenia.filter((x) => x.id !== id)].slice(0, 500);
        await zapisz(MOJE, m);
        return { zgloszenie: wpis };
    });
    const wycofajMoje = (id) => poKolei(async () => {
        const z = await zgloszenie(id, 'wycofaj');
        await wyslij(z);
        const m = await czytaj(MOJE, { zgloszenia: [] });
        const x = m.zgloszenia.find((q) => q.id === id);
        if (x) { x.stan = 'wycofana'; x.wycofano = z.czas; await zapisz(MOJE, m); }
        return { wycofana: id };
    });
    /** Moje zgłoszenia + stan u wydawcy z jego publicznego katalogu (przyjęta = jest w katalogu z moim nickiem). */
    async function moje() {
        const m = await czytaj(MOJE, { zgloszenia: [] });
        const ja = await nick().catch(() => null);
        let uWydawcy = null, bladWydawcy = null;
        if (adresWydawcy() && m.zgloszenia.length) {
            try {
                const r = await f(`${adresWydawcy()}/wizytowka/teostory`, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'otakos-katedra' } });
                uWydawcy = new Set(((await r.json())?.ksiegi ?? []).filter((k) => k?.katedra?.nick === ja).map((k) => k.id));
            } catch (e) { bladWydawcy = String(e?.message ?? e); }
        }
        return { wydawca: adresWydawcy(), bladWydawcy, zgloszenia: m.zgloszenia.map((x) => ({ ...x, wKatalogu: uWydawcy ? uWydawcy.has(x.id) : null })) };
    }

    // ── WYDAWCA ──
    /** Zgłoszenie z sieci → weryfikacja (rejestr, podpis, świeżość, adres, katalog autora) → wpis `do_zgody` / aktualizacja / wycofanie. */
    async function przyjmijZgloszenie(cialo) {
        const z = oczyscZgloszenie(cialo);
        if (!z) throw blad('Zgłoszenie niepoprawne (pola, poziom, cena 0–100 €, sha256, adres https).');
        const ja = await nick().catch(() => null);
        if (z.nick === ja) throw blad('To Twoja Katedra — Twoje księgi już są w katalogu.');
        if (Math.abs(teraz() - Date.parse(z.czas)) > SWIEZOSC_MS) throw blad('Zgłoszenie nieświeże (> 1 h) — wyślij ponownie.');
        let k;
        try { k = await katedra(z.nick); } catch (e) { throw blad(`Katedry „${z.nick}” nie ma w rejestrze otakos.wtf (${e.message}).`, 403); }
        if (!sprawdzPodpis(trescZgloszenia(z), k.klucz, z.podpis)) throw blad('Podpis nie zgadza się z kluczem tej Katedry z rejestru — odrzucone.', 403);
        if (origin(k.adres) !== z.adres) throw blad('Adres w zgłoszeniu różni się od adresu Katedry w rejestrze — odrzucone.', 403);
        const klucz = `${z.nick}/${z.id}`;
        if (z.akcja === 'wycofaj') {
            return poKolei(async () => {
                const d = await czytaj(PLIK, { pozycje: [] });
                const x = d.pozycje.find((q) => q.klucz === klucz);
                if (x) { Object.assign(x, { stan: 'wycofana', wycofano: czas() }); await zapisz(PLIK, d); }
                return { stan: 'wycofana' };
            });
        }
        // księga naprawdę stoi w publicznym katalogu Katedry autora (tylko jej własne pozycje)
        let lista;
        try {
            const r = await f(`${z.adres}/wizytowka/teostory?tylko=moje`, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'otakos-wydawca' } });
            lista = (await r.json())?.ksiegi ?? [];
        } catch (e) { throw blad(`Nie zajrzę do Wypożyczalni Katedry „${z.nick}” (${e?.message ?? e}) — tunel śpi?`, 502); }
        const u = lista.find((x) => x?.id === z.id && !x.katedra);
        if (!u) throw blad('Tej księgi nie ma w publicznym katalogu Katedry autora.', 403);
        if (krotko(u.tytul, 200) !== z.tytul || u.tier !== z.tier || Math.round(Number(u.cenaEur) * 100) !== Math.round(z.cenaEur * 100)) throw blad('Tytuł, poziom albo cena różnią się od katalogu Katedry autora — odrzucone.', 403);
        return poKolei(async () => {
            const d = await czytaj(PLIK, { pozycje: [] });
            const stary = d.pozycje.find((q) => q.klucz === klucz);
            const zostajePrzyjeta = stary?.stan === 'przyjeta' && stary.tytul === z.tytul && stary.autor === z.autor;
            const { akcja: _a, ...dane } = z;
            const nowy = { klucz, ...dane, stan: zostajePrzyjeta ? 'przyjeta' : 'do_zgody', zgloszono: stary?.zgloszono ?? czas(), zmieniono: czas(),
                przyjeto: zostajePrzyjeta ? stary.przyjeto : null, powod: null };
            d.pozycje = [nowy, ...d.pozycje.filter((q) => q.klucz !== klucz)].slice(0, MAX_POZYCJI);
            await zapisz(PLIK, d);
            if (!zostajePrzyjeta) wiesc(`📚 Katedra „${z.nick}” zgłasza do teostory.studio: „${z.tytul}”${z.autor ? ` (${z.autor})` : ''} — czeka na ✓ w Izbie zgód.`);
            return { stan: nowy.stan };
        });
    }
    const decyduj = (klucz, akcja, { powod = '' } = {}) => poKolei(async () => {
        const d = await czytaj(PLIK, { pozycje: [] });
        const x = d.pozycje.find((q) => q.klucz === klucz);
        if (!x) throw blad('Nie ma takiego zgłoszenia.', 404);
        if (akcja === 'przyjmij') Object.assign(x, { stan: 'przyjeta', przyjeto: czas(), powod: null });
        else if (akcja === 'odrzuc') Object.assign(x, { stan: 'odrzucona', powod: krotko(powod, 300) || null });
        else if (akcja === 'zdejmij') Object.assign(x, { stan: 'zdjeta', powod: krotko(powod, 300) || null });
        else throw blad('Akcja: przyjmij, odrzuc albo zdejmij.');
        await zapisz(PLIK, d);
        return { pozycja: x };
    });
    const pozycje = async () => (await czytaj(PLIK, { pozycje: [] })).pozycje;
    /** Do publicznego katalogu wydawcy: tylko przyjęte, z autorem, Katedrą i podpisem. */
    async function pozycjePubliczne() {
        return (await pozycje()).filter((x) => x.stan === 'przyjeta').map((x) => ({
            id: x.id, tytul: x.tytul, podtytul: x.podtytul, autor: x.autor, stron: x.stron, tier: x.tier, cenaEur: x.cenaEur, opis: x.opis, narrator: x.rodzaj === 'audiobook' ? 'Głosek' : null,
            okladka: x.okladka, probka: x.probka, jezyk: x.jezyk, rodzaj: x.rodzaj, pieczec: null, godzinWypozyczenia: x.tier === 'demo' ? null : 48,
            katedra: { nick: x.nick, adres: x.adres }, podpis: { tresc: 'otakos-ksiega', sha256: x.sha256, czas: x.czas, podpis: x.podpis },
        }));
    }
    /** Izba zgód: czysty odczyt. */
    async function czekajace() {
        return (await pozycje()).filter((x) => x.stan === 'do_zgody').map((x) => ({
            id: `${x.nick}~${x.id}`, kiedy: x.zgloszono, tytul: `📚 „${x.tytul}” — Katedra ${x.nick} zgłasza do teostory.studio`,
            opis: `${x.autor ? `Autor: ${x.autor}. ` : ''}${x.rodzaj === 'audiobook' ? 'Audiobook z ilustracjami. ' : ''}${x.tier === 'demo' ? 'Za darmo.' : `Wypożyczenie 48 h: ${x.cenaEur} € (płatność idzie do Katedry autora).`}\n${x.opis}${x.probka ? `\n🎧 próbka: ${x.probka}` : ''}`,
            akcje: [{ id: 'przyjmij', etykieta: '✓ do katalogu', zdalnie: true }, { id: 'odrzuc', etykieta: '✕ odrzuć', zdalnie: true }],
        }));
    }
    /** Skarbnik: kto jest autorem której pozycji (własne + federacja), wypożyczenia własnych ksiąg. */
    async function autorstwo() {
        const ja = await nick().catch(() => null);
        const wyp = await W.wypozyczenia().catch(() => []);
        const wlasne = (await W.katalogPelny()).map((k) => {
            const w = wyp.filter((x) => x.ksiega === k.id);
            return { id: k.id, tytul: k.tytul, autor: k.autor || null, katedra: ja, tier: k.tier, cenaEur: k.cenaEur, wystawiona: k.wystawiona,
                wypozyczen: w.length, przychod: Math.round(w.reduce((s, x) => s + (Number(x.kwota) || 0), 0) * 100) / 100, waluta: (w[0]?.waluta ?? 'eur').toUpperCase() };
        });
        const federacja = (await pozycje()).map((x) => ({ id: x.id, tytul: x.tytul, autor: x.autor || null, katedra: x.nick, tier: x.tier, cenaEur: x.cenaEur, stan: x.stan, zgloszono: x.zgloszono,
            rozlicza: 'Katedra autora — wypożyczenie płaci jej Stripe; tu zapis autorstwa pod przyszłe rozliczenia' }));
        return { wlasne, federacja };
    }

    return { zglos, wycofaj: wycofajMoje, moje, przyjmijZgloszenie, decyduj, pozycje, pozycjePubliczne, czekajace, autorstwo, zgloszenie };
}

/** Trasy: autor i wydawca (Hub, Straż `/api/books`: maszyna) + publiczne zgłoszenie (Straż: SCIEZKA_ZGLOSZENIA_KSIEGI, tylko POST). */
export function zamontujTrasyFederacji(app, F, { limitNaMinute = 10 } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    app.get('/api/books/federacja', (_req, res) => odp(res, Promise.all([F.moje(), F.pozycje()]).then(([moje, pozycje]) => ({ ...moje, pozycje }))));
    app.post('/api/books/federacja/:nick/:id/:akcja', (req, res) => odp(res, F.decyduj(`${req.params.nick}/${req.params.id}`, req.params.akcja, req.body ?? {})));
    app.post('/api/books/:id/federacja', (req, res) => odp(res, F.zglos(req.params.id)));
    app.delete('/api/books/:id/federacja', (req, res) => odp(res, F.wycofaj(req.params.id)));
    const proby = new Map();
    app.post('/wizytowka/teostory/zgloszenie', (req, res) => {
        res.set('Access-Control-Allow-Origin', '*');
        const ip = req.ip || '?', t = Date.now(), l = (proby.get(ip) ?? []).filter((x) => t - x < 60_000);
        if (l.length >= limitNaMinute) return res.status(429).json({ success: false, message: 'Za dużo zgłoszeń — spróbuj za minutę.' });
        proby.set(ip, [...l, t]);
        if (Buffer.byteLength(JSON.stringify(req.body ?? {})) > 16_384) return res.status(413).json({ success: false, message: 'Zgłoszenie za duże.' });
        return odp(res, F.przyjmijZgloszenie(req.body ?? {}));
    });
}

export default { utworzFederacje, zamontujTrasyFederacji, trescZgloszenia, oczyscZgloszenie };
