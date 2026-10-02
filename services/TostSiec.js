/**
 * 💬 TOST między Katedrami — rozmowa Katedra ↔ Katedra (2026-10-02).
 *
 * Suweren: „dodajmy do Stołu moduł TOSTa, by można gadać z innymi katedrami". Wybory Suwerena:
 * rozmowa w StoL i w Hubie; gdy druga Katedra jest offline, wiadomość CZEKA W TWOJEJ KATEDRZE
 * i wychodzi sama, gdy obie są online — nic nie leży na otakos.wtf ani w chmurze.
 *
 * JAK:
 *   · Kontakty = Katedry online z rejestru otakos.wtf (nick + adres tunelu + klucz ed25519
 *     zatwierdzony przez Suwerena strony). Rejestr niczego nie przenosi — tylko mówi, kto jest kim.
 *   · Koperta: tekst szyfrowany end-to-end — X25519 (klucz TOST tej Katedry, publiczny w wizytówce)
 *     → HKDF-SHA256 → AES-256-GCM. Cloudflare (tunel) i otakos.wtf widzą tylko szyfr.
 *     Całość podpisana kluczem ed25519 wizytówki — odbiorca sprawdza podpis kluczem, który rejestr
 *     ma przy nicku nadawcy. Kto nie jest zatwierdzony i online, ten nie wrzuci nic do skrzynki.
 *   · Skrzynka odbiorcza: POST /api/tost/skrzynka (publiczna przez tunel — Straż przepuszcza tylko
 *     tę ścieżkę; limit rozmiaru i liczby kopert na minutę od nadawcy, powtórki po id odrzucane).
 *   · Wychodzące czekają w kolejce i co minutę próbują ponownie; po 7 dniach — „niedostarczona".
 *
 * ⚠️ Uczciwie: na dysku własnej Katedry rozmowy leżą jawnie (`_OtakOs_Wymiar/tost-siec/rozmowy.json`)
 * — jak reszta danych Suwerena. Szyfrowanie chroni drogę między Katedrami, nie dysk.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const NICK = /^[a-z0-9][a-z0-9-]{2,31}$/;
const MAX_TEKST = 4000;
const MAX_KOPERTA = 16 * 1024;
const MAX_WIADOMOSCI = 3000;
const PORZUC_PO_MS = 7 * 24 * 3600_000;
const LIMIT_NA_MINUTE = 30;
const LISTA_WAZNA_MS = 60_000;

export const trescKoperty = (k) => ['otakos-tost', k.id, k.od, k.do, k.czas, k.odTost, k.iv, k.szyfr].join('\n');
const aad = (k) => Buffer.from(`${k.id}|${k.od}|${k.do}|${k.czas}`, 'utf8');
const kluczSesji = (wspolny, od, doKogo) => Buffer.from(crypto.hkdfSync('sha256', wspolny, Buffer.from(`${od}|${doKogo}`), Buffer.from('otakos-tost-v1'), 32));
const pubZ = (b64) => crypto.createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' });

/**
 * @param {{ katalog:string, nick:()=>Promise<string>, kluczEd:()=>Promise<string>, podpisz:(t:string)=>Promise<string>,
 *           rejestr:string, fetch?:typeof fetch, teraz?:()=>number, szyna?:any }} o
 */
export function utworzTost(o) {
    const cfg = { fetch: (...a) => fetch(...a), teraz: () => Date.now(), ...o };
    const KAT = path.join(cfg.katalog, 'tost-siec');
    const PLIK = path.join(KAT, 'rozmowy.json');
    const PLIK_KLUCZA = path.join(KAT, 'klucz.json');

    // ── Klucz X25519 tej Katedry ──
    let klucze = null;
    async function kluczTost() {
        if (klucze) return klucze;
        let k = null;
        try { k = JSON.parse(await fs.readFile(PLIK_KLUCZA, 'utf8')); } catch { /* pierwszy raz */ }
        if (!k?.publiczny || !k?.prywatny) {
            const p = crypto.generateKeyPairSync('x25519');
            k = { publiczny: p.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), prywatny: p.privateKey.export({ format: 'pem', type: 'pkcs8' }), utworzono: new Date(cfg.teraz()).toISOString() };
            await fs.mkdir(KAT, { recursive: true });
            await fs.writeFile(PLIK_KLUCZA, JSON.stringify(k, null, 2), 'utf8');
        }
        klucze = { publiczny: k.publiczny, prywatny: crypto.createPrivateKey(k.prywatny) };
        return klucze;
    }

    // ── Rozmowy na dysku (zapisy po kolei) ──
    let stan = null, zapis = Promise.resolve();
    async function wczytaj() {
        if (stan) return stan;
        try { stan = JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { stan = {}; }
        stan.wiadomosci = Array.isArray(stan.wiadomosci) ? stan.wiadomosci : [];
        return stan;
    }
    function zapisz() {
        zapis = zapis.then(async () => {
            stan.wiadomosci = stan.wiadomosci.slice(-MAX_WIADOMOSCI);
            await fs.mkdir(KAT, { recursive: true });
            await fs.writeFile(`${PLIK}.tmp`, JSON.stringify(stan, null, 1), 'utf8');
            await fs.rename(`${PLIK}.tmp`, PLIK);
        }).catch(() => {});
        return zapis;
    }

    // ── Rejestr: kto online, z jakim kluczem ──
    let lista = { kiedy: 0, katedry: [] };
    async function katedryOnline({ swieze = false } = {}) {
        if (!swieze && cfg.teraz() - lista.kiedy < LISTA_WAZNA_MS) return lista.katedry;
        const r = await cfg.fetch(cfg.rejestr, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error(`rejestr HTTP ${r.status}`);
        const d = await r.json();
        lista = { kiedy: cfg.teraz(), katedry: (Array.isArray(d?.katedry) ? d.katedry : []).filter((k) => NICK.test(k?.nick ?? '') && typeof k.klucz === 'string' && /^https:\/\//.test(k.adres ?? '')) };
        return lista.katedry;
    }

    // ── Odbiór ──
    const limity = new Map();   // nick → [czasy z ostatniej minuty]
    async function odbierz(koperta) {
        const odp = (status, wiadomosc) => ({ status, wiadomosc });
        const k = koperta ?? {};
        if (JSON.stringify(k).length > MAX_KOPERTA) return odp(413, 'Koperta za duża.');
        for (const pole of ['id', 'od', 'do', 'czas', 'odKlucz', 'odTost', 'iv', 'szyfr', 'podpis']) if (typeof k[pole] !== 'string' || !k[pole]) return odp(400, `Koperta bez pola „${pole}".`);
        const ja = await cfg.nick();
        if (!ja) return odp(404, 'Ta Katedra nie ma nicka — nie przyjmuje TOST-ów.');
        if (k.do !== ja) return odp(400, 'Koperta nie do tej Katedry.');
        if (!NICK.test(k.od) || !/^[\w-]{8,64}$/.test(k.id)) return odp(400, 'Zły nadawca albo id.');
        const t = Date.parse(k.czas);
        if (!Number.isFinite(t) || t > cfg.teraz() + 5 * 60_000 || cfg.teraz() - t > PORZUC_PO_MS) return odp(400, 'Zły czas koperty.');

        const teraz = cfg.teraz();
        const ostatnie = (limity.get(k.od) ?? []).filter((x) => teraz - x < 60_000);
        if (ostatnie.length >= LIMIT_NA_MINUTE) return odp(429, 'Za dużo kopert na minutę.');
        limity.set(k.od, [...ostatnie, teraz]);

        let nadawca;
        try { nadawca = (await katedryOnline()).find((x) => x.nick === k.od) ?? (await katedryOnline({ swieze: true })).find((x) => x.nick === k.od); }
        catch (e) { return odp(503, `Nie sprawdzę nadawcy — rejestr nieosiągalny (${e.message}).`); }
        if (!nadawca || nadawca.klucz !== k.odKlucz) return odp(403, 'Nadawcy nie ma w rejestrze zatwierdzonych Katedr online.');
        let ok = false;
        try { ok = crypto.verify(null, Buffer.from(trescKoperty(k), 'utf8'), pubZ(k.odKlucz), Buffer.from(k.podpis, 'base64')); } catch { ok = false; }
        if (!ok) return odp(401, 'Podpis koperty się nie zgadza.');

        const s = await wczytaj();
        if (s.wiadomosci.some((m) => m.id === k.id)) return odp(200, 'Już dostarczona.');
        let tekst;
        try {
            const { prywatny } = await kluczTost();
            const klucz = kluczSesji(crypto.diffieHellman({ privateKey: prywatny, publicKey: pubZ(k.odTost) }), k.od, k.do);
            const surowe = Buffer.from(k.szyfr, 'base64');
            const d = crypto.createDecipheriv('aes-256-gcm', klucz, Buffer.from(k.iv, 'base64'));
            d.setAAD(aad(k));
            d.setAuthTag(surowe.subarray(surowe.length - 16));
            tekst = Buffer.concat([d.update(surowe.subarray(0, surowe.length - 16)), d.final()]).toString('utf8');
        } catch { return odp(400, 'Nie da się odszyfrować koperty.'); }
        s.wiadomosci.push({ id: k.id, z: k.od, kierunek: 'przychodzaca', tekst: tekst.slice(0, MAX_TEKST), czas: k.czas, odebrano: new Date(teraz).toISOString(), przeczytana: false });
        await zapisz();
        cfg.szyna?.nadaj?.({ agent: 'TOST', rodzaj: 'wiadomosc', tresc: `💬 TOST od ${k.od}` })?.catch?.(() => {});
        return odp(200, 'Dostarczona.');
    }

    // ── Wysyłka ──
    async function zaszyfrujDla(m, odbiorca, ja) {
        const r = await cfg.fetch(`${odbiorca.adres}/api/wizytowka`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error(`wizytówka odbiorcy HTTP ${r.status}`);
        const w = await r.json();
        if (w?.nick !== odbiorca.nick || w?.klucz !== odbiorca.klucz) throw new Error('pod adresem odbiorcy jest inna Katedra');
        if (typeof w.tost !== 'string') throw new Error('Katedra odbiorcy nie ma jeszcze TOST-a (starsza wersja)');
        const { publiczny, prywatny } = await kluczTost();
        const k = { wersja: 1, id: m.id, od: ja, do: odbiorca.nick, czas: m.czas, odKlucz: await cfg.kluczEd(), odTost: publiczny, iv: crypto.randomBytes(12).toString('base64') };
        const klucz = kluczSesji(crypto.diffieHellman({ privateKey: prywatny, publicKey: pubZ(w.tost) }), k.od, k.do);
        const c = crypto.createCipheriv('aes-256-gcm', klucz, Buffer.from(k.iv, 'base64'));
        c.setAAD(aad(k));
        k.szyfr = Buffer.concat([c.update(m.tekst, 'utf8'), c.final(), c.getAuthTag()]).toString('base64');
        k.podpis = await cfg.podpisz(trescKoperty(k));
        return k;
    }

    async function dostarcz(m) {
        const ja = await cfg.nick();
        const odbiorca = (await katedryOnline()).find((x) => x.nick === m.do);
        if (!odbiorca) { m.blad = 'odbiorca offline — czeka'; return false; }
        const koperta = await zaszyfrujDla(m, odbiorca, ja);
        const r = await cfg.fetch(`${odbiorca.adres}/api/tost/skrzynka`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(koperta), signal: AbortSignal.timeout(15_000) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { m.blad = d.wiadomosc || `HTTP ${r.status}`; return false; }
        m.stan = 'dostarczona'; m.dostarczono = new Date(cfg.teraz()).toISOString(); delete m.blad;
        return true;
    }

    let kolejka = Promise.resolve();
    async function wyslij({ do: doKogo, tekst } = {}) {
        const ja = await cfg.nick();
        if (!ja) throw new Error('Najpierw nadaj Katedrze nick (karta Wystawy → 🪪 Wizytówka).');
        const d = String(doKogo ?? '').trim().toLowerCase();
        if (!NICK.test(d)) throw new Error('Zły nick odbiorcy.');
        if (d === ja) throw new Error('To Twoja własna Katedra.');
        const t = String(tekst ?? '').trim();
        if (!t) throw new Error('Pusta wiadomość.');
        if (t.length > MAX_TEKST) throw new Error(`Za długa wiadomość (max ${MAX_TEKST} znaków).`);
        const s = await wczytaj();
        const m = { id: crypto.randomUUID(), do: d, kierunek: 'wychodzaca', tekst: t, czas: new Date(cfg.teraz()).toISOString(), stan: 'czeka' };
        s.wiadomosci.push(m);
        await zapisz();
        await (kolejka = kolejka.then(() => dostarcz(m).catch((e) => { m.blad = e.message; return false; })).then(() => zapisz()));
        return { ...m };
    }

    /** Ponów czekające (pętla co minutę). */
    async function ponow() {
        const s = await wczytaj();
        const czekaja = s.wiadomosci.filter((m) => m.kierunek === 'wychodzaca' && m.stan === 'czeka');
        if (!czekaja.length) return 0;
        let ile = 0;
        for (const m of czekaja) {
            if (cfg.teraz() - Date.parse(m.czas) > PORZUC_PO_MS) { m.stan = 'niedostarczona'; m.blad = 'odbiorca nie pojawił się online przez 7 dni'; continue; }
            if (await dostarcz(m).catch((e) => { m.blad = e.message; return false; })) ile++;
        }
        await zapisz();
        return ile;
    }

    // ── Odczyt dla Huba / StoL ──
    async function rozmowy() {
        const s = await wczytaj();
        const mapa = new Map();
        for (const m of s.wiadomosci) {
            const kto = m.kierunek === 'przychodzaca' ? m.z : m.do;
            const r = mapa.get(kto) ?? { nick: kto, ostatnia: null, nieprzeczytane: 0, czeka: 0 };
            r.ostatnia = { tekst: m.tekst.slice(0, 120), czas: m.czas, kierunek: m.kierunek };
            if (m.kierunek === 'przychodzaca' && !m.przeczytana) r.nieprzeczytane++;
            if (m.kierunek === 'wychodzaca' && m.stan === 'czeka') r.czeka++;
            mapa.set(kto, r);
        }
        return [...mapa.values()].sort((a, b) => String(b.ostatnia?.czas).localeCompare(String(a.ostatnia?.czas)));
    }
    async function rozmowa(nick, { oznacz = true } = {}) {
        const s = await wczytaj();
        const lista_ = s.wiadomosci.filter((m) => m.z === nick || m.do === nick);
        if (oznacz && lista_.some((m) => m.kierunek === 'przychodzaca' && !m.przeczytana)) {
            for (const m of lista_) if (m.kierunek === 'przychodzaca') m.przeczytana = true;
            await zapisz();
        }
        return lista_.map((m) => ({ ...m }));
    }
    async function kontakty() {
        const ja = await cfg.nick();
        let online = null, blad = null;
        try { online = await katedryOnline(); } catch (e) { blad = e.message; }
        const r = await rozmowy();
        const znane = new Map(r.map((x) => [x.nick, x]));
        const wynik = (online ?? []).filter((k) => k.nick !== ja).map((k) => ({ nick: k.nick, motto: k.motto ?? '', online: true, ...(znane.get(k.nick) ?? {}) }));
        for (const x of r) if (!wynik.some((w) => w.nick === x.nick)) wynik.push({ ...x, online: false });
        return { ja, kontakty: wynik, rejestr: blad ? { blad } : { ok: true } };
    }

    let petla = null;
    function startPetli(ms = 60_000) {
        if (petla) return;
        petla = setInterval(() => { void ponow().catch(() => {}); }, ms);
        petla.unref?.();
    }

    return { kluczTost, odbierz, wyslij, ponow, rozmowy, rozmowa, kontakty, startPetli, katedryOnline };
}

export default { utworzTost, trescKoperty, NICK };
