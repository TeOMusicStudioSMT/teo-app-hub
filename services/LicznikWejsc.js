/**
 * 🌍 Licznik wejść — kto zagląda na strony Suwerena (teo.center, otakos.wtf…) i skąd.
 *
 * Suweren 2026-10-30: „powiadomienia na mój telefon, jak ktoś wchodzi na stronę i skąd — tak jak miał Wix”.
 *
 * Strona przy wejściu puka do Katedry przez tunel (`POST /wizytowka/wejscie`). Tunel idzie przez
 * Cloudflare, więc KRAJ podaje nagłówek `cf-ipcountry` — nie zgadujemy go z adresu.
 * Prywatność: adresu IP NIE zapisujemy. W pamięci (nie na dysku) trzymamy tylko skrót IP z solą
 * zmienianą przy każdym starcie mostu — żeby jedna osoba = jedna wieść na `PRZERWA_MS`.
 * Boty (po user-agencie) liczymy osobno i bez wieści. Gospodarza strona sama nie zgłasza
 * (gdy widzi jego most na 127.0.0.1).
 *
 * Wieść idzie kanałem Mistrza (Orbita w Hubie); dziennik dnia: `odwiedziny/<dzień>.jsonl`.
 * Działa tylko, gdy Katedra nie śpi — reszta zostaje w Web Analytics Cloudflare.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const STRONY = ['teo.center', 'www.teo.center', 'otakos.wtf', 'www.otakos.wtf', 'graviton.pw'];
export const PRZERWA_MS = 30 * 60_000;
export const MAX_WIESCI_DNIA = 60;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|curl|wget|python|node|go-http|java\/|axios|scrapy|preview|monitor|uptime|facebookexternalhit|embedly|whatsapp|telegram/i;

const nazwyKrajow = (() => { try { return new Intl.DisplayNames(['pl'], { type: 'region' }); } catch { return null; } })();
export function nazwaKraju(kod) {
    const k = String(kod || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(k) || k === 'XX' || k === 'T1') return k === 'T1' ? 'sieci Tor' : null;
    try { return nazwyKrajow?.of(k) ?? k; } catch { return k; }
}
/** „z Niemiec” — dopełniacz bywa nieregularny, więc tylko prosta forma „kraj: Niemcy”. */
export function opisWejscia(w) {
    const gdzie = w.kraj ? `🌍 ${nazwaKraju(w.kraj) ?? w.kraj}` : '🌍 nieznany kraj';
    const skad = w.skad ? ` · przyszedł z ${w.skad}` : '';
    const co = w.sciezka && w.sciezka !== '/' ? ` · ${w.sciezka}` : '';
    return `${gdzie} — ktoś wszedł na ${w.strona}${skad}${co}`;
}

/** Host odsyłającego: tylko nazwa domeny, nigdy pełny adres (bywa w nim prywatne). */
export function hostOdsylajacego(x) {
    try { const h = new URL(String(x)).hostname.replace(/^www\./, '').toLowerCase(); return /^[a-z0-9.-]{3,80}$/.test(h) ? h : null; } catch { return null; }
}

export function utworzLicznikWejsc({ katalog, wiesc = null, teraz = () => Date.now() } = {}) {
    const sol = crypto.randomBytes(16);
    const ostatnio = new Map();          // skrót IP+strona → kiedy ostatnio
    const zAdresu = new Map();           // skrót IP → [czasy] (limit zapytań)
    let wiesciDnia = { dzien: '', ile: 0 };

    const dzien = (t) => new Date(t).toISOString().slice(0, 10);
    const skrot = (ip) => crypto.createHmac('sha256', sol).update(String(ip)).digest('hex').slice(0, 20);

    function sprzataj(t) {
        for (const [k, v] of ostatnio) if (t - v > PRZERWA_MS) ostatnio.delete(k);
        for (const [k, v] of zAdresu) { const s = v.filter((x) => t - x < 60_000); if (s.length) zAdresu.set(k, s); else zAdresu.delete(k); }
    }

    async function dopisz(t, wpis) {
        await fs.mkdir(katalog, { recursive: true });
        await fs.appendFile(path.join(katalog, `${dzien(t)}.jsonl`), JSON.stringify(wpis) + '\n', 'utf8');
    }

    /** Jedno wejście. Zwraca { przyjete, powod? } — strona nie musi nic z tym robić. */
    async function zglos({ ip, kraj, ua, strona, sciezka, skad }) {
        const t = teraz();
        sprzataj(t);
        const s = String(strona || '').toLowerCase();
        if (!STRONY.includes(s)) return { przyjete: false, powod: 'nieznana strona' };
        const id = skrot(ip || 'brak');
        const czasy = zAdresu.get(id) ?? [];
        if (czasy.length >= 20) return { przyjete: false, powod: 'za często' };
        zAdresu.set(id, [...czasy, t]);

        const wpis = {
            kiedy: new Date(t).toISOString(),
            strona: s.replace(/^www\./, ''),
            kraj: /^[A-Z0-9]{2}$/i.test(String(kraj || '')) ? String(kraj).toUpperCase() : null,
            sciezka: String(sciezka || '/').replace(/[?#].*$/, '').slice(0, 80) || '/',
            skad: hostOdsylajacego(skad),
            bot: BOT.test(String(ua || '')),
        };
        if (wpis.skad && wpis.strona.endsWith(wpis.skad)) wpis.skad = null;   // nawigacja w obrębie strony
        const klucz = `${id}|${wpis.strona}`;
        const nowy = !ostatnio.has(klucz);
        ostatnio.set(klucz, t);
        if (!nowy) return { przyjete: false, powod: 'już liczony' };
        await dopisz(t, wpis);

        if (!wpis.bot && wiesc) {
            if (wiesciDnia.dzien !== dzien(t)) wiesciDnia = { dzien: dzien(t), ile: 0 };
            if (wiesciDnia.ile < MAX_WIESCI_DNIA) {
                wiesciDnia.ile++;
                try { await wiesc({ tresc: opisWejscia(wpis), rodzaj: 'wejscie', skad: 'Licznik wejść' }); } catch { /* wieść nie psuje licznika */ }
            }
        }
        return { przyjete: true };
    }

    /** Podsumowanie ostatnich `dni` dni: ludzie, boty, kraje, skąd, strony. */
    async function podsumowanie({ dni = 7 } = {}) {
        const t = teraz();
        const wpisy = [];
        for (let i = 0; i < Math.min(Math.max(Number(dni) || 7, 1), 90); i++) {
            const plik = path.join(katalog, `${dzien(t - i * 86_400_000)}.jsonl`);
            const tekst = await fs.readFile(plik, 'utf8').catch(() => '');
            for (const l of tekst.split('\n')) { if (!l.trim()) continue; try { wpisy.push(JSON.parse(l)); } catch { /* zła linia */ } }
        }
        const ludzie = wpisy.filter((w) => !w.bot);
        const zlicz = (f) => Object.entries(ludzie.reduce((a, w) => { const k = f(w); if (k) a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
        return {
            dni, ludzie: ludzie.length, boty: wpisy.length - ludzie.length,
            dzis: ludzie.filter((w) => w.kiedy.startsWith(dzien(t))).length,
            kraje: zlicz((w) => w.kraj).map(([kod, ile]) => ({ kod, nazwa: nazwaKraju(kod) ?? kod, ile })),
            skad: zlicz((w) => w.skad).map(([host, ile]) => ({ host, ile })),
            strony: zlicz((w) => w.strona).map(([strona, ile]) => ({ strona, ile })),
            ostatnie: ludzie.slice(-15).reverse(),
        };
    }

    return { zglos, podsumowanie };
}

/** Trasy: publiczne zgłoszenie (Straż: SCIEZKA_WEJSCIA) i podsumowanie dla maszyny. */
export function zamontujTrasyLicznika(app, L) {
    app.post('/wizytowka/wejscie', async (req, res) => {
        try {
            const b = req.body && typeof req.body === 'object' ? req.body : {};
            const r = await L.zglos({
                ip: req.get('cf-connecting-ip') || req.ip,
                kraj: req.get('cf-ipcountry'),
                ua: req.get('user-agent'),
                strona: b.strona, sciezka: b.sciezka, skad: b.skad,
            });
            res.json({ success: true, ...r });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });
    app.get('/api/wejscia', async (req, res) => {
        if (req.lokalny === false) return res.status(403).json({ success: false, message: 'Tylko na maszynie Suwerena.' });
        try { res.json({ success: true, ...(await L.podsumowanie({ dni: req.query.dni })) }); }
        catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });
}
