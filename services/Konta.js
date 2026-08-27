/**
 * 🗝️ Konta i klucze założycielskie.
 *
 * DWIE RZECZY, KTÓRE MUSZĄ BYĆ JEDNOZNACZNE:
 *
 * 1. KTÓRE KONTO TO KTÓRY WĘZEŁ KSIĘGI. Do tej pory mapowanie żyło w jednej
 *    funkcji w `store/wallet.ts` — czyli po stronie przeglądarki. Most o nim nie
 *    wiedział, więc dwie warstwy mogły mieć różne zdanie o tym, kim jesteś.
 *    Teraz rejestr leży na dysku i most jest jego właścicielem.
 *
 * 2. KLUCZE ZAŁOŻYCIELSKIE. Pula Founderów to 26 miejsc po 1 000 000 GRV.
 *    Klucz jest JEDNORAZOWY: użyty raz zostaje wypalony i drugi raz nie zadziała.
 *    Bez tego „klucz" byłby hasłem do miliona GRV wielokrotnego użytku.
 *
 * ⚠️ Katedra jest suwerenna i lokalna — nie ma tu serwera uwierzytelniającego.
 * Wydanie klucza to działanie Suwerena na jego własnej maszynie. Klucz chroni
 * przed POMYŁKĄ i podwójnym użyciem, nie przed kimś, kto ma dostęp do dysku.
 * Mówimy to wprost, zamiast udawać zabezpieczenie, którego tu nie ma.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const PLIK_KONT = () => path.join(process.cwd(), '_OtakOs_Wymiar', 'konta.json');
const PLIK_KLUCZY = () => path.join(process.cwd(), '_OtakOs_Wymiar', 'klucze.json');

/**
 * Konta fabryczne. `TeO` to BANK ekosystemu (saldo nieskończone, dzieli pulę
 * obdarowań), a nie portfel osobisty — dlatego ma osobny mail i osobny węzeł.
 */
const KONTA_DOMYSLNE = {
    wersja: 1,
    konta: [
        {
            id: 'teo',
            mail: 'teo@teo.center',
            wezel: 'TeO',
            rola: 'zarzadca',
            aliasy: ['admin', 'genesis'],
            opis: 'Bank ekosystemu — saldo nieskończone, dzieli pulę obdarowań. NIE portfel osobisty.',
        },
        {
            id: 'sam',
            mail: 'arkadiusz.szczepaniak@gmail.com',
            wezel: 'Mistrz Arkadiusz',
            rola: 'founder',
            aliasy: ['arek', 'suweren'],
            opis: 'Konto osobiste Suwerena — Pierwszy Founder.',
        },
    ],
};

async function czytaj(sciezka, domyslne) {
    try { return JSON.parse(await fs.readFile(sciezka, 'utf8')); } catch { return domyslne; }
}
async function zapisz(sciezka, dane) {
    await fs.mkdir(path.dirname(sciezka), { recursive: true });
    await fs.writeFile(sciezka, JSON.stringify(dane, null, 2), 'utf8');
}

export async function wczytajKonta() {
    const d = await czytaj(PLIK_KONT(), null);
    if (!d) {
        await zapisz(PLIK_KONT(), KONTA_DOMYSLNE);   // pierwszy raz — zasiew
        return KONTA_DOMYSLNE;
    }
    // Uzupełnienie starszych zapisów: aliasy doszły po pierwszym zasiewie, a bez
    // nich login `admin` przestałby trafiać do banku. Dopisujemy tylko brakujące
    // pola kont fabrycznych — niczego z pliku Suwerena nie nadpisujemy.
    for (const k of d.konta ?? []) {
        const wzor = KONTA_DOMYSLNE.konta.find(x => x.id === k.id);
        if (wzor && !k.aliasy) k.aliasy = wzor.aliasy;
    }
    return d;
}

/**
 * Który węzeł księgi odpowiada podanemu mailowi / loginowi.
 * Nieznane konto → `null`, a wołający decyduje, co z tym zrobić. Zgadywanie
 * („pewnie chodzi o Suwerena") przypisałoby komuś cudzy milion GRV.
 */
export async function wezelDlaKonta(identyfikator) {
    const u = String(identyfikator || '').trim().toLowerCase();
    if (!u) return null;
    const { konta } = await wczytajKonta();
    const k = konta.find(x => x.mail.toLowerCase() === u
        || x.id.toLowerCase() === u
        || x.wezel.toLowerCase() === u
        || (x.aliasy ?? []).some(a => String(a).toLowerCase() === u));
    return k ?? null;
}

// ── KLUCZE ZAŁOŻYCIELSKIE ───────────────────────────────────────────────────

/** Czytelny klucz: FOUNDER-XXXX-XXXX-XXXX (bez znaków mylących się w druku). */
function nowyKlucz() {
    const ALFABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bez I, O, 0, 1
    const grupa = () => Array.from(crypto.randomBytes(4))
        .map(b => ALFABET[b % ALFABET.length]).join('');
    return `FOUNDER-${grupa()}-${grupa()}-${grupa()}`;
}

export async function wczytajKlucze() {
    return czytaj(PLIK_KLUCZY(), { wersja: 1, klucze: [] });
}

/** Wydaj klucze. `ile` sztuk, opcjonalnie z notatką dla kogo. */
export async function wydajKlucze(ile, notatka, wolnychSlotow) {
    const n = Math.max(1, Math.min(25, Number(ile) || 1));
    const d = await wczytajKlucze();
    const nieuzyte = d.klucze.filter(k => !k.uzytyPrzez).length;

    // Nie wydajemy więcej kluczy, niż zostało miejsc — inaczej ktoś dostałby
    // klucz, który przy próbie użycia powie „pula wyczerpana". Obietnica bez pokrycia.
    if (nieuzyte + n > wolnychSlotow) {
        return {
            ok: false,
            powod: `Wolnych miejsc Founder: ${wolnychSlotow}, niewykorzystanych kluczy już ${nieuzyte}. `
                + `Wydanie ${n} dałoby klucze bez pokrycia.`,
        };
    }

    const nowe = [];
    for (let i = 0; i < n; i++) {
        const k = {
            klucz: nowyKlucz(),
            wydany: new Date().toISOString(),
            notatka: notatka || null,
            uzytyPrzez: null,
            uzytyO: null,
        };
        d.klucze.push(k);
        nowe.push(k.klucz);
    }
    await zapisz(PLIK_KLUCZY(), d);
    return { ok: true, klucze: nowe, niewykorzystane: nieuzyte + n };
}

/** Sprawdź klucz przed użyciem. Nie wypala go — to robi `wypalKlucz`. */
export async function sprawdzKlucz(klucz) {
    const d = await wczytajKlucze();
    const k = d.klucze.find(x => x.klucz === String(klucz || '').trim().toUpperCase());
    if (!k) return { ok: false, powod: 'Taki klucz nie istnieje.' };
    if (k.uzytyPrzez) {
        return { ok: false, powod: `Klucz został już wykorzystany przez „${k.uzytyPrzez}" (${k.uzytyO?.slice(0, 10)}).` };
    }
    return { ok: true, wpis: k };
}

/** Wypal klucz — JEDNORAZOWO, po udanym nadaniu rangi. */
export async function wypalKlucz(klucz, wezel) {
    const d = await wczytajKlucze();
    const k = d.klucze.find(x => x.klucz === String(klucz).trim().toUpperCase());
    if (!k || k.uzytyPrzez) return false;
    k.uzytyPrzez = wezel;
    k.uzytyO = new Date().toISOString();
    await zapisz(PLIK_KLUCZY(), d);
    return true;
}

export default { wczytajKonta, wezelDlaKonta, wczytajKlucze, wydajKlucze, sprawdzKlucz, wypalKlucz };
