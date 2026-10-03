/**
 * 🏛️ Zarządca rejestru otakos.wtf — zatwierdzanie Katedr przez Stół (2026-10-03).
 *
 * Suweren: „niech też będzie możliwość zatwierdzenia przez Stół”. Dotąd nick i klucz nowej Katedry trzeba było
 * wpisać ręcznie do `katedry-zatwierdzone.json` w repo strony. Teraz:
 *   · Katedra, która się melduje bez zatwierdzenia, ląduje w rejestrze jako OCZEKUJĄCA (nick + klucz, bez adresu),
 *   · Katedra ZARZĄDCY (ta, której nick i klucz stoją w pliku strony jako „zarzadca”) widzi je w Hubie i w StoL,
 *     Suweren zatwierdza / odrzuca jednym przyciskiem,
 *   · lista zatwierdzonych leży TU (`_OtakOs_Wymiar/rejestr-zatwierdzone.json`) i co minutę (oraz po każdej zmianie)
 *     idzie do rejestru podpisana kluczem wizytówki — restart strony nie gubi zatwierdzeń na dłużej niż minutę.
 * Katedra, która nie jest zarządcą, nic tu nie robi (stan mówi wprost, kto jest zarządcą).
 */
import fs from 'fs/promises';
import path from 'path';

export const NICK = /^[a-z0-9][a-z0-9-]{2,31}$/;
/** Stała domena nazwanego tunelu (host, bez portu i ścieżki) — rejestr odpyta ją dopiero po zatwierdzeniu przy nicku. */
export const DOMENA = /^([a-z0-9-]+\.)+[a-z]{2,}$/;
const domenaZ = (d) => (typeof d === 'string' && DOMENA.test(d.toLowerCase()) && d.length <= 253 ? d.toLowerCase() : null);
const kluczWpisu = (z) => `${z.nick}|${z.klucz}|${z.domena ?? ''}`;
export const trescListyZarzadcy = ({ czas, zatwierdzone }) => `otakos-zarzadca\n${czas}\n${JSON.stringify(zatwierdzone)}`;

/**
 * @param {{ katalog:string, nick:()=>Promise<string>, podpisz:(t:string)=>Promise<string>, rejestr:string,
 *           fetch?:typeof fetch, teraz?:()=>number, szyna?:any }} o   rejestr = baza, np. https://otakos.wtf/api/katedry
 */
export function utworzZarzadce(o) {
    const cfg = { fetch: (...a) => fetch(...a), teraz: () => Date.now(), ...o };
    const PLIK = path.join(cfg.katalog, 'rejestr-zatwierdzone.json');
    let stan = null, zapis = Promise.resolve(), ostatniaWysylka = null;

    async function wczytaj() {
        if (stan) return stan;
        try { stan = JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { stan = {}; }
        stan.zatwierdzone = Array.isArray(stan.zatwierdzone) ? stan.zatwierdzone : [];
        stan.odrzucone = Array.isArray(stan.odrzucone) ? stan.odrzucone : [];
        return stan;
    }
    function zapisz() {
        zapis = zapis.then(async () => {
            await fs.mkdir(path.dirname(PLIK), { recursive: true });
            await fs.writeFile(`${PLIK}.tmp`, JSON.stringify(stan, null, 1), 'utf8');
            await fs.rename(`${PLIK}.tmp`, PLIK);
        }).catch(() => {});
        return zapis;
    }

    async function zRejestru(sciezka, init) {
        const r = await cfg.fetch(`${cfg.rejestr}${sciezka}`, { signal: AbortSignal.timeout(10_000), ...init });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.wiadomosc || `rejestr HTTP ${r.status}`);
        return d;
    }

    /** Kim jest zarządca w rejestrze i czy to ta Katedra. */
    async function kto() {
        const ja = await cfg.nick();
        const d = await zRejestru('/zarzadca');
        return { ja: ja || null, zarzadca: d.zarzadca ?? null, jestZarzadca: !!ja && d.zarzadca === ja, lista: d.lista ?? null };
    }

    async function wyslij() {
        const s = await wczytaj();
        const czas = new Date(cfg.teraz()).toISOString();
        const zatwierdzone = s.zatwierdzone.map(({ nick, klucz, domena }) => ({ nick, klucz, ...(domena ? { domena } : {}) })).sort((a, b) => a.nick.localeCompare(b.nick));
        try {
            const d = await zRejestru('/zarzadca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ czas, zatwierdzone, podpis: await cfg.podpisz(trescListyZarzadcy({ czas, zatwierdzone })) }) });
            ostatniaWysylka = { kiedy: czas, ok: true, wiadomosc: d.wiadomosc ?? 'Wysłana.' };
        } catch (e) { ostatniaWysylka = { kiedy: czas, ok: false, wiadomosc: e.message }; }
        return ostatniaWysylka;
    }

    async function przeglad() {
        const s = await wczytaj();
        let k = null, oczekujace = [], blad = null;
        try {
            k = await kto();
            if (k.jestZarzadca) {
                const d = await zRejestru('/oczekujace');
                // Ta sama Katedra z NOWYM stałym adresem wraca do oczekujących — zatwierdza się nick, klucz i domenę.
                const juz = new Set(s.zatwierdzone.map(kluczWpisu));
                const nie = new Set(s.odrzucone.map(kluczWpisu));
                oczekujace = (Array.isArray(d.oczekujace) ? d.oczekujace : [])
                    .filter((o) => NICK.test(o?.nick ?? '') && typeof o.klucz === 'string')
                    .map((o) => ({ ...o, domena: domenaZ(o.domena) }))
                    .filter((o) => !juz.has(kluczWpisu(o)) && !nie.has(kluczWpisu(o)));
            }
        } catch (e) { blad = e.message; }
        return { ...(k ?? { ja: null, zarzadca: null, jestZarzadca: false }), oczekujace, zatwierdzone: s.zatwierdzone, odrzuconych: s.odrzucone.length, ostatniaWysylka, ...(blad ? { blad } : {}) };
    }

    async function musiBycZarzadca() {
        const k = await kto();
        if (!k.jestZarzadca) throw new Error(k.zarzadca ? `Zatwierdza tylko zarządca rejestru („${k.zarzadca}”), a ta Katedra to „${k.ja ?? 'bez nicka'}”.` : 'Rejestr otakos.wtf nie ma jeszcze zarządcy.');
    }
    const sprawdzWpis = ({ nick, klucz, domena } = {}) => {
        if (!NICK.test(String(nick ?? ''))) throw new Error('Zły nick.');
        if (typeof klucz !== 'string' || klucz.length < 40 || klucz.length > 200) throw new Error('Zły klucz.');
        if (domena != null && domena !== '' && !domenaZ(domena)) throw new Error('Zła domena.');
        return { nick, klucz, domena: domenaZ(domena) };
    };
    /** Domena z kolejki rejestru, gdy przycisk (Hub / StoL) wysłał tylko nick i klucz. */
    async function domenaZKolejki(nick, klucz) {
        try {
            const d = await zRejestru('/oczekujace');
            return domenaZ((Array.isArray(d.oczekujace) ? d.oczekujace : []).find((o) => o?.nick === nick && o?.klucz === klucz)?.domena);
        } catch { return null; }
    }

    async function zatwierdz(w) {
        const { nick, klucz, domena: podana } = sprawdzWpis(w);
        await musiBycZarzadca();
        const domena = podana ?? (await domenaZKolejki(nick, klucz));
        const s = await wczytaj();
        s.zatwierdzone = s.zatwierdzone.filter((z) => z.nick !== nick);
        s.zatwierdzone.push({ nick, klucz, ...(domena ? { domena } : {}), kiedy: new Date(cfg.teraz()).toISOString() });
        s.odrzucone = s.odrzucone.filter((z) => !(z.nick === nick && z.klucz === klucz));
        await zapisz();
        cfg.szyna?.nadaj?.({ agent: 'Rejestr', rodzaj: 'praca', tresc: `🏛️ Katedra „${nick}”${domena ? ` (${domena})` : ''} zatwierdzona na otakos.wtf` })?.catch?.(() => {});
        return { ...(await wyslij()), nick };
    }
    async function odrzuc(w) {
        const { nick, klucz, domena: podana } = sprawdzWpis(w);
        await musiBycZarzadca();
        const domena = podana ?? (await domenaZKolejki(nick, klucz));
        const s = await wczytaj();
        const wpis = { nick, klucz, ...(domena ? { domena } : {}) };
        if (!s.odrzucone.some((z) => kluczWpisu(z) === kluczWpisu(wpis))) s.odrzucone.push({ ...wpis, kiedy: new Date(cfg.teraz()).toISOString() });
        await zapisz();
        return { nick, odrzucona: true };
    }
    async function cofnij({ nick } = {}) {
        if (!NICK.test(String(nick ?? ''))) throw new Error('Zły nick.');
        await musiBycZarzadca();
        const s = await wczytaj();
        s.zatwierdzone = s.zatwierdzone.filter((z) => z.nick !== nick);
        await zapisz();
        return { ...(await wyslij()), nick };
    }

    let petla = null;
    function startPetli(ms = 60_000) {
        if (petla) return;
        petla = setInterval(() => { void kto().then((k) => (k.jestZarzadca ? wyslij() : null)).catch(() => {}); }, ms);
        petla.unref?.();
    }

    return { kto, przeglad, zatwierdz, odrzuc, cofnij, wyslij, startPetli };
}

export default { utworzZarzadce, trescListyZarzadcy };
