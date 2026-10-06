/**
 * ⚡ Giełda Master Flow (dawniej „Giełda mocy”, TeOkoP GRV) — etap 1: OGŁOSZENIA. Katedra mówi sieci, jaką moc udostępnia i za ile GRV.
 *
 * Suweren (2026-10-04): „jak się i tak tam siedzi i eksponuje Katedrę, to można wybrać… udostępnić moce… a w Katedrze
 * wyświetla się lista z dostępnymi… i jest wymiana określonej kwoty za działanie”. Na otakos.wtf stał dotąd wymyślony
 * licznik („18 mln GB VRAM”, losowi „peerzy”) — zero z dupy: od teraz liczby biorą się z prawdziwych ofert.
 *
 * Droga oferty: Katedra → pole `moc` w PUBLICZNEJ wizytówce (`/api/wizytowka`) → rejestr otakos.wtf i tak pobiera
 * wizytówkę przy meldunku i sprawdza nick + klucz, więc oferta dochodzi bez zmiany podpisu meldunku (odświeża się
 * przy ponownej weryfikacji rejestru, co ~5 min) → strona i inne Katedry widzą ją w `/api/katedry`.
 *
 * ⚠️ ETAP 1 = OGŁOSZENIA. Nic tu nie wykonuje cudzych zadań i nie przelewa GRV — to etap 2 (zlecanie przez tunel,
 * limity, podpisane pokwitowania). Panel mówi to wprost.
 */
import fs from 'fs/promises';
import path from 'path';

export const JEDNOSTKA = '1000 tokenów';
const MODEL = /^[a-zA-Z0-9._:/-]{1,80}$/;

/** Karta z `nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits` → { nazwa, vramGB } (pierwsza karta). */
export function gpuZNvidiaSmi(tekst) {
    const linia = String(tekst ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    if (!linia) return null;
    const [nazwa, mib] = linia.split(',').map((s) => s.trim());
    const n = Number(mib);
    if (!nazwa || !Number.isFinite(n) || n <= 0) return null;
    return { nazwa: nazwa.slice(0, 80), vramGB: Math.max(1, Math.round(n / 1024)) };
}

/** Oferta od człowieka → bezpieczna postać. `znaneModele` (Ollama) — gdy podane, oferta zawiera tylko modele, które są. */
export function normalizujOferte(d = {}, { znaneModele = null } = {}) {
    const liczba = (v, min, max, dom) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : dom);
    const modele = [...new Set((Array.isArray(d.modele) ? d.modele : []).map((m) => String(m).trim()).filter((m) => MODEL.test(m)))]
        .filter((m) => !znaneModele || znaneModele.includes(m)).slice(0, 12);
    return {
        udostepniam: d.udostepniam === true,
        vramGB: Math.round(liczba(d.vramGB, 1, 512, 8)),
        gpu: String(d.gpu ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
        modele,
        cenaGRV: Math.round(liczba(d.cenaGRV, 0, 1_000_000, 1) * 100) / 100,
        godziny: String(d.godziny ?? 'zawsze, gdy Katedra działa').replace(/\s+/g, ' ').trim().slice(0, 60),
        opis: String(d.opis ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
    };
}

/** Publiczny wycinek oferty do wizytówki — tylko gdy Suweren udostępnia i ma co (co najmniej jeden model). */
export function wycinekPubliczny(oferta) {
    if (!oferta?.udostepniam || !oferta.modele?.length) return null;
    const { vramGB, gpu, modele, cenaGRV, godziny, opis, zmieniono } = oferta;
    return { vramGB, gpu, modele, cenaGRV, jednostka: JEDNOSTKA, godziny, opis, ...(zmieniono ? { od: zmieniono } : {}) };
}

/** Oferta z rejestru (cudza, z sieci) → bezpieczna postać do pokazania; null = śmieci. */
export function ofertaZSieci(moc) {
    if (!moc || typeof moc !== 'object') return null;
    const o = normalizujOferte({ ...moc, udostepniam: true });
    return o.modele.length ? wycinekPubliczny({ ...o, zmieniono: typeof moc.od === 'string' ? moc.od.slice(0, 40) : undefined }) : null;
}

/**
 * 📋 ZLECENIA (Suweren 2026-10-06: „dodać możliwość dodania do TeOKoP (Giełda Master Flow) danego zadania… lub całego
 * projektu”). Druga strona Giełdy: Katedra ogłasza, czego POTRZEBUJE — zadanie (np. kamień milowy GDD) albo cały projekt,
 * z modelami, których to wymaga, i budżetem GRV. Ogłoszenie idzie tą samą drogą co oferta (pole `zlecenia` wizytówki →
 * rejestr → /api/katedry). Nikt go jeszcze nie WYKONUJE i GRV nie płynie — to etap 2 (tunel, limity, pokwitowania).
 */
export const RODZAJE_ZLECEN = ['zadanie', 'projekt'];
export function normalizujZlecenie(d = {}) {
    const rodzaj = RODZAJE_ZLECEN.includes(d.rodzaj) ? d.rodzaj : null;
    if (!rodzaj) throw new Error('Zlecenie to „zadanie” albo „projekt”.');
    const tytul = String(d.tytul ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (tytul.length < 3) throw new Error('Zlecenie potrzebuje tytułu.');
    const budzet = Number(d.budzetGRV);
    return {
        rodzaj, tytul,
        opis: String(d.opis ?? '').replace(/\s+/g, ' ').trim().slice(0, 600),
        projekt: /^[a-z0-9-]{2,48}$/.test(String(d.projekt ?? '')) ? d.projekt : null,
        modele: [...new Set((Array.isArray(d.modele) ? d.modele : []).map((m) => String(m).trim()).filter((m) => MODEL.test(m)))].slice(0, 6),
        budzetGRV: Number.isFinite(budzet) ? Math.round(Math.min(1_000_000, Math.max(0, budzet)) * 100) / 100 : 0,
    };
}
/** Publiczny wycinek ogłoszonych zleceń (bez id projektu z dysku). */
export function zleceniaPubliczne(lista = []) {
    return lista.filter((z) => z.stan === 'ogloszone').slice(0, 10)
        .map(({ id, rodzaj, tytul, opis, modele, budzetGRV, od }) => ({ id, rodzaj, tytul, opis, modele, budzetGRV, od }));
}
/** Zlecenia z sieci (cudze) → bezpieczna postać; śmieci odpadają. */
export function zleceniaZSieci(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.slice(0, 10).map((z) => { try { return { id: String(z?.id ?? '').slice(0, 24), ...normalizujZlecenie(z), projekt: undefined, od: typeof z?.od === 'string' ? z.od.slice(0, 40) : null }; } catch { return null; } })
        .filter((z) => z && /^[a-z0-9-]{4,24}$/.test(z.id));
}

/**
 * @param {{ katalog:string, modeleOllamy?:()=>Promise<string[]>, gpu?:()=>Promise<{nazwa:string, vramGB:number}|null>,
 *   rejestr?:string, fetch?:typeof fetch, teraz?:()=>number }} o
 */
export function utworzGielde(o) {
    const cfg = { modeleOllamy: async () => [], gpu: async () => null, rejestr: 'https://otakos.wtf/api/katedry', fetch, teraz: () => Date.now(), ...o };
    const PLIK = path.join(cfg.katalog, 'gielda-mocy.json');
    const czytaj = async () => { try { return JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { return null; } };

    async function oferta() {
        const z = await czytaj();
        if (z) return z;
        const g = await cfg.gpu().catch(() => null);
        return { ...normalizujOferte({ vramGB: g?.vramGB ?? 8, gpu: g?.nazwa ?? '' }), zmieniono: null };
    }

    async function ustawOferte(dane = {}) {
        const znane = await cfg.modeleOllamy().catch(() => null);
        // Bez odpowiedzi Ollamy nie da się sprawdzić modeli → nie ogłaszamy niczego, czego Katedra może nie mieć.
        if (dane.udostepniam === true && !znane?.length) throw new Error('Ollama nie podała modeli — nie ogłoszę mocy bez sprawdzenia, co ta Katedra ma. Odpal Ollamę i spróbuj ponownie.');
        const o = { ...normalizujOferte(dane, { znaneModele: znane?.length ? znane : null }), zmieniono: new Date(cfg.teraz()).toISOString() };
        if (o.udostepniam && !o.modele.length) throw new Error('Udostępnianie potrzebuje co najmniej jednego modelu z Ollamy tej Katedry.');
        await fs.mkdir(path.dirname(PLIK), { recursive: true });
        await fs.writeFile(`${PLIK}.tmp`, JSON.stringify(o, null, 1), 'utf8');
        await fs.rename(`${PLIK}.tmp`, PLIK);
        return o;
    }

    /** Dla wizytówki: wycinek albo null (nie udostępniam). */
    async function publiczna() { return wycinekPubliczny(await oferta()); }

    // ── 📋 Zlecenia tej Katedry ──
    const PLIK_ZLECEN = path.join(cfg.katalog, 'gielda-zlecenia.json');
    const czytajZlecenia = async () => { try { const l = JSON.parse(await fs.readFile(PLIK_ZLECEN, 'utf8')); return Array.isArray(l) ? l : []; } catch { return []; } };
    const piszZlecenia = async (l) => { await fs.mkdir(path.dirname(PLIK_ZLECEN), { recursive: true }); await fs.writeFile(`${PLIK_ZLECEN}.tmp`, JSON.stringify(l, null, 1), 'utf8'); await fs.rename(`${PLIK_ZLECEN}.tmp`, PLIK_ZLECEN); };
    async function zlecenia() { return czytajZlecenia(); }
    async function dodajZlecenie(dane = {}) {
        const z = normalizujZlecenie(dane);
        const l = await czytajZlecenia();
        if (l.filter((x) => x.stan === 'ogloszone').length >= 10) throw new Error('Ogłoszonych zleceń jest już 10 — wycofaj któreś.');
        const dubel = l.find((x) => x.stan === 'ogloszone' && x.rodzaj === z.rodzaj && x.projekt === z.projekt && x.tytul === z.tytul);
        if (dubel) return dubel;
        const nowe = { id: `zl-${cfg.teraz().toString(36)}`, ...z, stan: 'ogloszone', od: new Date(cfg.teraz()).toISOString() };
        await piszZlecenia([nowe, ...l].slice(0, 100));
        return nowe;
    }
    async function wycofajZlecenie(id) {
        const l = await czytajZlecenia();
        const z = l.find((x) => x.id === id);
        if (!z) throw new Error('Nie ma takiego zlecenia.');
        z.stan = 'wycofane'; z.wycofano = new Date(cfg.teraz()).toISOString();
        await piszZlecenia(l);
        return z;
    }
    async function publiczneZlecenia() { return zleceniaPubliczne(await czytajZlecenia()); }

    /** Stan panelu: moja oferta, wykryta karta, modele Ollamy, moje zlecenia. */
    async function stan() {
        const [o, g, modele, zl] = await Promise.all([oferta(), cfg.gpu().catch(() => null), cfg.modeleOllamy().catch(() => []), czytajZlecenia()]);
        return { oferta: o, publiczna: wycinekPubliczny(o), wykryte: g, modele, jednostka: JEDNOSTKA, zlecenia: zl };
    }

    /** Oferty Katedr online z rejestru otakos.wtf (bez mojej, gdy podam nick). */
    async function oferty({ pomin = null } = {}) {
        const r = await cfg.fetch(cfg.rejestr, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'otakos-katedra' } });
        if (!r.ok) throw new Error(`Rejestr otakos.wtf odpowiedział HTTP ${r.status}.`);
        const d = await r.json().catch(() => ({}));
        const katedry = Array.isArray(d?.katedry) ? d.katedry : [];
        const wszystkie = katedry.map((k) => ({ nick: String(k?.nick ?? ''), adres: String(k?.adres ?? ''), motto: String(k?.motto ?? '').slice(0, 140), moc: ofertaZSieci(k?.moc), zlecenia: zleceniaZSieci(k?.zlecenia) }))
            .filter((k) => /^[a-z0-9-]{3,32}$/.test(k.nick) && k.nick !== pomin);
        const zOferta = wszystkie.filter((k) => k.moc).map(({ zlecenia: _z, ...k }) => k);
        const zlecenia = wszystkie.flatMap((k) => k.zlecenia.map((z) => ({ ...z, nick: k.nick })));
        return { online: katedry.length, oferty: zOferta, vramGB: zOferta.reduce((s, k) => s + k.moc.vramGB, 0), zlecenia };
    }

    return { oferta, ustawOferte, publiczna, stan, oferty, zlecenia, dodajZlecenie, wycofajZlecenie, publiczneZlecenia };
}

export default { utworzGielde, normalizujOferte, wycinekPubliczny, ofertaZSieci, gpuZNvidiaSmi, JEDNOSTKA, normalizujZlecenie, zleceniaPubliczne, zleceniaZSieci, RODZAJE_ZLECEN };
