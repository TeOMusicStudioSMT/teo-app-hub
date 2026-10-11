/**
 * 📜 Plan gry w wizytówce (Suweren 2026-10-11: „uzupełnij te klocki… niech będzie tam automatyczny… i możliwość
 * wspólnego dokończenia planu, jak już długo wisi coś — jak oferta”).
 *
 * Z GDD gry Katedry (`_OtakOs_Apki/<projekt>/gdd.json`) składa PUBLICZNY wycinek dla wizytówki → rejestr otakos.wtf
 * → strona Teterhii pokazuje postęp sama, bez ręcznych wpisów:
 *  · kamienie: tytuł + ile zadań gotowych z ilu (bez treści zadań),
 *  · wisi: zadania, które od ≥ `progDni` dni stoją w błędzie albo „trwa” — oferta „🤝 do wspólnego dokończenia”
 *    (inne Katedry mogą odezwać się przez TOST). Treść zadania ≤ 160 znaków, bez plików, bez uwag modeli.
 */
import fs from 'fs/promises';
import path from 'path';

export const PROG_DNI = 3;
const tekst = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Czysta: GDD → publiczny plan (null, gdy GDD bez kamieni). */
export function planZGdd(gdd, { teraz = Date.now(), progDni = PROG_DNI } = {}) {
    const kamienie = Array.isArray(gdd?.kamienie) ? gdd.kamienie : [];
    if (!kamienie.length) return null;
    const prog = teraz - progDni * 24 * 3600_000;
    const wisi = [];
    const out = kamienie.slice(0, 24).map((k) => {
        const zad = Array.isArray(k?.zadania) ? k.zadania : [];
        for (const z of zad) {
            const kiedy = Date.parse(z?.kiedy ?? '');
            if ((z?.stan === 'blad' || z?.stan === 'trwa') && Number.isFinite(kiedy) && kiedy <= prog) {
                wisi.push({ kamien: tekst(k.tytul, 80), zadanie: tekst(z.tresc, 160), stan: z.stan, od: new Date(kiedy).toISOString() });
            }
        }
        return { tytul: tekst(k?.tytul, 80), gotowe: zad.filter((z) => z?.stan === 'gotowe').length, razem: zad.length };
    });
    return { tytul: tekst(gdd.tytul || gdd.nazwa, 80), kamienie: out, wisi: wisi.slice(0, 8), zaktualizowano: new Date(teraz).toISOString() };
}

/** Plan gry z dysku Katedry (projekt domyślnie Teterhia); brak pliku = null. */
export function utworzPlanGry({ katalogGier, projekt = 'teterhia-wieczna-saga' }) {
    return {
        async publiczny() {
            try { return planZGdd(JSON.parse(await fs.readFile(path.join(katalogGier, projekt, 'gdd.json'), 'utf8'))); } catch { return null; }
        },
    };
}
