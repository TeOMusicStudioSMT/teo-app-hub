/**
 * ⚡ Giełda mocy (TeOkoP GRV) — etap 1: OGŁOSZENIA. Katedra mówi sieci, jaką moc udostępnia i za ile GRV.
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

    /** Stan panelu: moja oferta, wykryta karta, modele Ollamy. */
    async function stan() {
        const [o, g, modele] = await Promise.all([oferta(), cfg.gpu().catch(() => null), cfg.modeleOllamy().catch(() => [])]);
        return { oferta: o, publiczna: wycinekPubliczny(o), wykryte: g, modele, jednostka: JEDNOSTKA };
    }

    /** Oferty Katedr online z rejestru otakos.wtf (bez mojej, gdy podam nick). */
    async function oferty({ pomin = null } = {}) {
        const r = await cfg.fetch(cfg.rejestr, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'otakos-katedra' } });
        if (!r.ok) throw new Error(`Rejestr otakos.wtf odpowiedział HTTP ${r.status}.`);
        const d = await r.json().catch(() => ({}));
        const katedry = Array.isArray(d?.katedry) ? d.katedry : [];
        const zOferta = katedry.map((k) => ({ nick: String(k?.nick ?? ''), adres: String(k?.adres ?? ''), motto: String(k?.motto ?? '').slice(0, 140), moc: ofertaZSieci(k?.moc) }))
            .filter((k) => /^[a-z0-9-]{3,32}$/.test(k.nick) && k.moc && k.nick !== pomin);
        return { online: katedry.length, oferty: zOferta, vramGB: zOferta.reduce((s, k) => s + k.moc.vramGB, 0) };
    }

    return { oferta, ustawOferte, publiczna, stan, oferty };
}

export default { utworzGielde, normalizujOferte, wycinekPubliczny, ofertaZSieci, gpuZNvidiaSmi, JEDNOSTKA };
