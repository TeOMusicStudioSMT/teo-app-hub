/**
 * 📯 Kanał Mistrza w Orbicie (Suweren 2026-10-09: „można go podłączyć do KatedraOrb… jako Rola Mistrzowska może
 * zostać kanałem dla Mistrzów… może się odezwać, jak coś zaobserwuje, czy jak będzie potrzebny przekaz z pola”).
 *
 * JaJo Mistrza (most: services/JajoMistrza.js) pisze wieści do `wiesci.jsonl`; Orbita odpytuje je co 30 s od
 * numeru, który już widziała (localStorage), pokazuje pod orbitą i zapisuje do własnej pamięci obserwacji
 * (`mozgOrbity.obserwuj`) — Orbita wie, co powiedział Mistrz. Głos: opcjonalnie, barwą TeOgochi „mistrz”
 * (Głosy Stada). Odpytuje tylko lokalny most — nic nie wychodzi z maszyny.
 */
import { useEffect, useRef, useState } from 'react';
import { obserwuj } from './mozgOrbity';

const MOST = 'http://127.0.0.1:3001';
const KLUCZ_WIDZIANE = 'otakos_mistrz_widziane';
const KLUCZ_WLACZONY = 'otakos_kanal_mistrza';
const KLUCZ_GLOS = 'otakos_mistrz_glos';
const CO_MS = 30_000;

export interface Wiesc { nr: number; kiedy: string; rodzaj: string; skad: string; tresc: string; glos?: boolean }

const czytaj = (k: string, dom: string) => { try { return localStorage.getItem(k) ?? dom; } catch { return dom; } };
const pisz = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* bez pamięci */ } };

export const kanalMistrzaWlaczony = () => czytaj(KLUCZ_WLACZONY, '1') !== '0';
export const ustawKanalMistrza = (v: boolean) => pisz(KLUCZ_WLACZONY, v ? '1' : '0');
export const glosMistrza = () => czytaj(KLUCZ_GLOS, '0') === '1';
export const ustawGlosMistrza = (v: boolean) => pisz(KLUCZ_GLOS, v ? '1' : '0');

/** Wieści, których ta przeglądarka jeszcze nie widziała. Pierwsze uruchomienie: tylko ostatnia (bez zalewu historii). */
export async function noweWiesci(): Promise<Wiesc[]> {
    const widziane = Number(czytaj(KLUCZ_WIDZIANE, '-1'));
    const r = await fetch(`${MOST}/api/mistrz/wiesci?od=${Math.max(0, widziane)}`);
    const d = await r.json();
    if (!d?.success) return [];
    const lista: Wiesc[] = d.wiesci ?? [];
    pisz(KLUCZ_WIDZIANE, String(d.ostatni ?? 0));
    return widziane < 0 ? lista.slice(-1) : lista;
}

/** Hook dla Orbity: bieżąca wieść (znika po 25 s albo kliknięciu) + licznik. */
export function useKanalMistrza(wlaczony: boolean) {
    const [wiesc, setWiesc] = useState<Wiesc | null>(null);
    const kolejka = useRef<Wiesc[]>([]);
    const zgas = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!wlaczony) return;
        let zyje = true;
        const pokazNastepna = () => {
            const w = kolejka.current.shift();
            if (!w || !zyje) { setWiesc(null); return; }
            setWiesc(w);
            obserwuj('akcja', `📯 Mistrz: ${w.tresc}`, 'kanał Mistrza');
            if (w.glos && glosMistrza()) {
                void fetch(`${MOST}/api/voice/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: w.tresc, teogochi: 'mistrz', voiceId: 'mistrz' }) })
                    .then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b && b.size) void new Audio(URL.createObjectURL(b)).play().catch(() => {}); }).catch(() => {});
            }
            if (zgas.current) clearTimeout(zgas.current);
            zgas.current = setTimeout(pokazNastepna, 25_000);
        };
        const sprawdz = async () => {
            try {
                const nowe = await noweWiesci();
                if (!nowe.length) return;
                const bylaPusta = !kolejka.current.length;
                kolejka.current.push(...nowe);
                if (bylaPusta && !zgas.current) pokazNastepna();
            } catch { /* most śpi — spróbujemy za chwilę */ }
        };
        void sprawdz();
        const iv = setInterval(sprawdz, CO_MS);
        return () => { zyje = false; clearInterval(iv); if (zgas.current) clearTimeout(zgas.current); zgas.current = null; };
    }, [wlaczony]);

    const zamknij = () => {
        if (zgas.current) clearTimeout(zgas.current);
        zgas.current = null;
        const w = kolejka.current.shift();
        setWiesc(w ?? null);
        if (w) { obserwuj('akcja', `📯 Mistrz: ${w.tresc}`, 'kanał Mistrza'); zgas.current = setTimeout(zamknij, 25_000); }
    };
    return { wiesc, zamknij };
}
