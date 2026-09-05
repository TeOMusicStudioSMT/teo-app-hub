/**
 * 📱 Most Stada — stan TeOgochi dla aplikacji zewnętrznej (OtakOS-StoL).
 *
 * Apka na Androida ma pokazywać ŻYWE stado Katedry, a nie pięciu wymyślonych
 * agentów wpisanych w kod. Ten moduł jest jedynym miejscem, przez które stan
 * wychodzi na zewnątrz — i jedynym, przez które wchodzi parowanie.
 *
 * ⚠️ SKĄD BIERZE SIĘ STAN — I DLACZEGO TAK.
 * Wyklucie i XP każdego gatunku żyją w `localStorage` PRZEGLĄDARKI
 * (`lib/teogochiStado.ts`), więc most sam z siebie ich NIE ZNA. Dlatego:
 *
 *   · Katedra PUBLIKUJE migawkę stada (`publikuj`) — kto wykluty, jaki etap, XP,
 *   · most dokłada AKTYWNOŚĆ z szyny zdarzeń, którą zna z pierwszej ręki,
 *   · apka czyta jedno i drugie, z jawnym znacznikiem, jak stara jest migawka.
 *
 * Gdyby most zmyślał stan stada „na oko" z samej szyny, apka pokazywałaby coś
 * innego niż Katedra na ekranie obok. Lepiej powiedzieć „migawka sprzed 40 minut"
 * niż podać świeżo wyglądającą nieprawdę.
 *
 * ⚠️ PAROWANIE JEST OBOWIĄZKOWE. Ten most bywa wystawiony przez Kwantowy Tunel,
 * więc trasa bez tokenu oddawałaby stan Katedry każdemu, kto zna adres.
 * Kod parowania żyje 5 minut i działa RAZ.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

const PLIK = () => path.join(process.cwd(), '_OtakOs_Wymiar', 'stado-most.json');

/** Kod parowania: 6 cyfr — do przepisania z ekranu na telefon. */
const ZYCIE_KODU_MS = 5 * 60 * 1000;

async function czytaj() {
    try { return JSON.parse(await fs.readFile(PLIK(), 'utf8')); }
    catch { return { wersja: 1, migawka: null, urzadzenia: [], kod: null }; }
}
async function zapisz(d) {
    const cel = PLIK();
    await fs.mkdir(path.dirname(cel), { recursive: true });
    const tmp = `${cel}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(d, null, 2), 'utf8');
    await fs.rename(tmp, cel);
}

// ── PAROWANIE ───────────────────────────────────────────────────────────────

/** Wygeneruj kod do przepisania na telefon. Poprzedni traci ważność. */
export async function zacznijParowanie() {
    const d = await czytaj();
    const kod = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    d.kod = { kod, wazny_do: Date.now() + ZYCIE_KODU_MS };
    await zapisz(d);
    return { kod, wazneSekund: Math.round(ZYCIE_KODU_MS / 1000) };
}

/**
 * Wymień kod na token urządzenia. Kod działa RAZ — po użyciu znika, więc
 * podejrzany zza ramienia ekran nie daje drugiego wejścia.
 */
export async function sparuj(kod, nazwaUrzadzenia) {
    const d = await czytaj();
    if (!d.kod) return { ok: false, powod: 'Nie ma aktywnego parowania. Wygeneruj kod w Katedrze.' };
    if (Date.now() > d.kod.wazny_do) {
        d.kod = null; await zapisz(d);
        return { ok: false, powod: 'Kod wygasł. Wygeneruj nowy.' };
    }
    if (String(kod).trim() !== d.kod.kod) return { ok: false, powod: 'Zły kod.' };

    const token = crypto.randomBytes(24).toString('base64url');
    d.urzadzenia = [
        ...(d.urzadzenia || []),
        {
            token,
            nazwa: String(nazwaUrzadzenia || 'telefon').slice(0, 40),
            sparowane: Date.now(),
            ostatniKontakt: null,
        },
    ].slice(-10);   // dziesięć urządzeń wystarczy; starsze wypadają
    d.kod = null;
    await zapisz(d);
    return { ok: true, token };
}

/** Czy token należy do sparowanego urządzenia. Odnotowuje kontakt. */
export async function sprawdzToken(token) {
    if (!token) return null;
    const d = await czytaj();
    const u = (d.urzadzenia || []).find(x => x.token === token);
    if (!u) return null;
    u.ostatniKontakt = Date.now();
    await zapisz(d);
    return { nazwa: u.nazwa, sparowane: u.sparowane };
}

export async function urzadzenia() {
    const d = await czytaj();
    return (d.urzadzenia || []).map(u => ({
        nazwa: u.nazwa, sparowane: u.sparowane, ostatniKontakt: u.ostatniKontakt,
        // Tokenu NIE oddajemy nawet Katedrze — nie ma powodu, żeby krążył.
        skrot: `${String(u.token).slice(0, 6)}…`,
    }));
}

export async function odlacz(skrot) {
    const d = await czytaj();
    const przed = (d.urzadzenia || []).length;
    d.urzadzenia = (d.urzadzenia || []).filter(u => !String(u.token).startsWith(String(skrot).replace('…', '')));
    if (d.urzadzenia.length === przed) return { ok: false, powod: 'Nie ma takiego urządzenia.' };
    await zapisz(d);
    return { ok: true };
}

// ── MIGAWKA STADA ───────────────────────────────────────────────────────────

/**
 * Katedra publikuje stan stada. Przyjmujemy tylko to, co potrzebne apce —
 * bez przepuszczania dowolnego JSON-a z przeglądarki do pliku.
 */
export async function publikuj(stado) {
    if (!Array.isArray(stado?.gatunki)) return { ok: false, powod: 'Wymagane: { gatunki: [...] }.' };
    const d = await czytaj();
    d.migawka = {
        czas: Date.now(),
        aktywny: String(stado.aktywny || ''),
        gatunki: stado.gatunki.slice(0, 50).map(g => ({
            id: String(g.id || ''),
            imie: String(g.imie || ''),
            dziedzina: String(g.dziedzina || ''),
            kolor: /^#[0-9a-fA-F]{6}$/.test(String(g.kolor)) ? g.kolor : '#94a3b8',
            forma: String(g.forma || '🥚').slice(0, 8),
            etap: String(g.etap || 'jajko'),
            xp: Number(g.xp) || 0,
            wyklute: !!g.wyklute,
        })),
    };
    await zapisz(d);
    return { ok: true, ile: d.migawka.gatunki.length };
}

/**
 * Stan dla apki: migawka Katedry + aktywność, którą most zna sam (szyna).
 * `wiek` mówi wprost, ile migawka ma sekund — apka ma pokazać starą jako starą.
 */
export async function stanDlaApki(zdarzenia) {
    const d = await czytaj();
    if (!d.migawka) {
        return {
            migawka: null,
            powod: 'Katedra jeszcze nic nie opublikowała. Otwórz Dom TeOgochi — stado publikuje się samo.',
            aktywnosc: [],
        };
    }

    // Ostatni ślad każdego agenta na szynie — to jest wiedza mostu z pierwszej ręki.
    // ⚠️ Szyna znaczy czas polem `kiedy` (ISO), nie `ts`. Sprawdzone w
    // SzynaZdarzen.js — pierwsza wersja czytała `z.ts` i każde porównanie
    // wychodziło `undefined > undefined`, czyli fałsz: aktywność byłaby pusta.
    const ostatnie = new Map();
    for (const z of zdarzenia || []) {
        const kto = String(z.agent || '').toLowerCase();
        if (!kto) continue;
        const kiedy = Date.parse(z.kiedy || '') || 0;
        const p = ostatnie.get(kto);
        if (!p || kiedy > p.ts) ostatnie.set(kto, { ts: kiedy, rodzaj: z.rodzaj, tresc: z.tresc });
    }

    const gatunki = d.migawka.gatunki.map(g => {
        const slad = ostatnie.get(g.imie.toLowerCase()) || ostatnie.get(g.id.toLowerCase()) || null;
        return {
            ...g,
            // „Co robi" bierze się z FAKTU na szynie albo go nie ma. Żadnych
            // wymyślonych statusów w rodzaju „analizuje spójność macierzy".
            robi: slad ? String(slad.tresc || '').slice(0, 160) : null,
            robiOd: slad ? slad.ts : null,
        };
    });

    return {
        migawka: {
            czas: d.migawka.czas,
            wiekSekund: Math.round((Date.now() - d.migawka.czas) / 1000),
            aktywny: d.migawka.aktywny,
        },
        gatunki,
        aktywnosc: [...ostatnie.entries()].map(([kto, s]) => ({ kto, ...s })),
    };
}

export function plik() { return PLIK(); }
export function istnieje() { return fsSync.existsSync(PLIK()); }

export default {
    zacznijParowanie, sparuj, sprawdzToken, urzadzenia, odlacz,
    publikuj, stanDlaApki, plik, istnieje,
};
