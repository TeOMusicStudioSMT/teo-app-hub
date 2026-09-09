/**
 * 🗣️ ŚCIEŻKA DIALOGOWA — kwestie z kart zamieniane w nagrania.
 *
 * PO CO. Suweren: „produkt niemy film bez głosu, choć w bibliotece assetu są
 * głosy i muzyka filmowa". Głosy tam były — Solita, Molita, Tim, każdy
 * z próbką — ale NIC ich nie używało. Bo też nie było czego mówić: karty
 * produkcyjne opisywały wyłącznie obraz. Najpierw doszły `kwestie` do kart,
 * teraz jest to, co je wypowiada.
 *
 * ⚠️ TO NIE ROBI DUBBINGU DO GOTOWEGO OBRAZU. Nagranie powstaje z tekstu
 * kwestii i jest osobnym plikiem obok ujęcia. Synchronizacja ust nie istnieje
 * i nie udajemy, że istnieje — Wan 2.2 nie animuje mowy.
 *
 * ⚠️ VOICESTUDIO TO OSOBNY PROGRAM (port 3900) i bywa wyłączony. Wtedy mówimy
 * to wprost, kadr po kadrze, zamiast zwracać ciszę jako sukces.
 */

import fs from 'fs/promises';
import path from 'path';
import * as GlosStudio from './GlosStudio.js';
import { utworzProjekt } from './Produkcje.js';

/**
 * Rdzeń polskiego imienia — odcięta końcówka fleksyjna.
 *
 * ⚠️ NIE JEST TO ODMIANA W DRUGĄ STRONĘ, tylko sprowadzenie obu form do
 * wspólnego początku. „Tima" → „tim", „Tim" → „tim", „Solity" → „solit",
 * „Solita" → „solit". Dłuższe końcówki idą pierwsze, bo inaczej „owi"
 * zostałoby zjedzone przez samo „i".
 */
function rdzenImienia(s) {
    return String(s || '').trim().toLowerCase()
        .replace(/(ami|ach|owi|om|ie|ę|ą|y|a|i|u|o|e)$/u, '');
}

/**
 * Dopasuj mówiącego do assetu typu `glos`.
 *
 * ⚠️ ODMIANA POLSKA JEST TU RÓŻNICĄ MIĘDZY GŁOSEM A CISZĄ. Model pisze
 * w kwestii „Tim", ale równie dobrze „Tima" albo „Timowi" — a asset nazywa się
 * „Tim". Zmierzone na pierwszej wersji: „Tima" i „Timowi" NIE trafiały,
 * czyli postać milczałaby bez powodu.
 *
 * Dlatego sprowadzamy OBIE strony do rdzenia i porównujemy. Sprawdzamy też
 * pojedyncze słowa nazwy assetu, bo „barman Krys" ma padać w kwestii jako
 * samo „Krys".
 *
 * ⚠️ Kolejność jest istotna: najpierw trafienie dokładne, potem po rdzeniu.
 * Inaczej przy istniejących „Sol" i „Solita" wygrywałby ten krótszy.
 */
export function dopasujGlos(kto, glosy = []) {
    const imie = String(kto || '').trim();
    if (imie.length < 2) return null;

    const doklad = glosy.find((g) => String(g.nazwa).toLowerCase() === imie.toLowerCase());
    if (doklad) return doklad;

    const szukany = rdzenImienia(imie);
    if (szukany.length < 3) return null;

    // Kandydaci z nazwy assetu: cała nazwa i każde jej słowo z osobna.
    const pasuje = (nazwa) => {
        const czesci = [nazwa, ...String(nazwa).split(/\s+/)].filter((c) => c.length >= 3);
        return czesci.some((c) => {
            const r = rdzenImienia(c);
            if (r.length < 3) return false;
            return r === szukany || r.startsWith(szukany) || szukany.startsWith(r);
        });
    };

    // Najdłuższa pasująca nazwa wygrywa — „barman Krys" przed samym „Krys".
    const trafione = glosy.filter((g) => pasuje(g.nazwa));
    if (!trafione.length) return null;
    return trafione.sort((a, b) => String(b.nazwa).length - String(a.nazwa).length)[0];
}

/**
 * Której próbki użyć jako głosu.
 *
 * VoiceStudio bierze `voice` jako NAZWĘ głosu, którą sam zna — nie ścieżkę
 * do pliku. Asset trzyma próbkę w `referencje.probka`; jeśli Suweren wgrał ją
 * do VoiceStudio pod nazwą postaci, ta nazwa jest tym, czego szukamy.
 */
export function nazwaGlosu(asset) {
    return String(asset?.nazwa ?? '').trim();
}

/**
 * Nagraj kwestie JEDNEJ karty.
 *
 * Zwraca listę wyników — jeden na kwestię — z powodem przy każdej, która się
 * nie udała. `ok: false` na całości znaczy „nic nie powstało", a nie „coś
 * poszło nie tak gdzieś tam".
 */
export async function nagrajKarte({ kadr, glosy = [], katalogDocelowy, znaneGlosy = null }) {
    const kwestie = Array.isArray(kadr?.kwestie) ? kadr.kwestie : [];
    if (!kwestie.length) {
        return { ok: true, nieme: true, nagrania: [], powod: 'Ujęcie nieme — nie ma czego mówić.' };
    }

    const nagrania = [];
    for (const [i, k] of kwestie.entries()) {
        const asset = dopasujGlos(k.kto, glosy);
        if (!asset) {
            nagrania.push({
                ok: false, kto: k.kto, tekst: k.tekst,
                powod: `Brak assetu typu „głos" dla „${k.kto}". Załóż go w Bibliotece Assetów i wgraj próbkę.`,
            });
            continue;
        }

        const glos = nazwaGlosu(asset);
        // ⚠️ Sprawdzamy, czy VoiceStudio W OGÓLE zna ten głos, ZANIM wyślemy
        // tekst. Inaczej odmowa wraca jako HTTP 400 z cudzym komunikatem,
        // a Suweren nie wie, czy problem jest w tekście, czy w nazwie głosu.
        if (znaneGlosy && znaneGlosy.length && !znaneGlosy.some((g) => String(g).toLowerCase() === glos.toLowerCase())) {
            nagrania.push({
                ok: false, kto: k.kto, tekst: k.tekst, glos,
                powod: `VoiceStudio nie zna głosu „${glos}". Zna: ${znaneGlosy.slice(0, 8).join(', ')}.`,
            });
            continue;
        }

        try {
            const w = await GlosStudio.mow({
                tekst: k.tekst,
                glos,
                format: 'wav',
                katalogDocelowy,
                nazwa: `${String(kadr.tytul || 'kadr').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)}_${i + 1}_${glos}`,
            });
            nagrania.push({ ok: true, kto: k.kto, tekst: k.tekst, glos, ...w });
        } catch (e) {
            nagrania.push({ ok: false, kto: k.kto, tekst: k.tekst, glos, powod: e.message });
        }
    }

    const udane = nagrania.filter((n) => n.ok).length;
    return {
        ok: udane > 0,
        nieme: false,
        nagrania,
        udanych: udane,
        wszystkich: nagrania.length,
        powod: udane ? null : 'Żadna kwestia nie została nagrana.',
    };
}

/**
 * Nagraj kwestie CAŁEGO projektu.
 *
 * ⚠️ NAJPIERW PYTAMY, CZY VOICESTUDIO ŻYJE. Bez tego przy wyłączonym programie
 * dostalibyśmy sto identycznych błędów sieciowych zamiast jednego zdania
 * mówiącego, co zrobić.
 */
export async function nagrajProjekt({ kadry = [], glosy = [], katalogDocelowy, naBiezaco = null }) {
    const stan = await GlosStudio.stan().catch(() => ({ zywe: false, braki: ['Nie umiem dopytać VoiceStudio.'] }));
    if (!stan.zywe) {
        return {
            ok: false,
            silnik: stan,
            powod: stan.braki?.join(' | ') ?? 'VoiceStudio nie odpowiada.',
            wyniki: [],
        };
    }

    const znaneGlosy = (stan.glosy ?? []).map((g) => (typeof g === 'string' ? g : g?.name ?? g?.id ?? ''));
    const zKwestiami = kadry.filter((k) => Array.isArray(k.kwestie) && k.kwestie.length);

    const wyniki = [];
    for (const kadr of zKwestiami) {
        const w = await nagrajKarte({ kadr, glosy, katalogDocelowy, znaneGlosy });
        wyniki.push({ id: kadr.id, tytul: kadr.tytul, ...w });
        if (naBiezaco) { try { naBiezaco(wyniki.at(-1)); } catch { /* podgląd nie wywraca przebiegu */ } }
    }

    return {
        ok: true,
        silnik: { zywe: true, glosy: znaneGlosy },
        kartZKwestiami: zKwestiami.length,
        kartNiemych: kadry.length - zKwestiami.length,
        nagranych: wyniki.reduce((s, w) => s + (w.udanych ?? 0), 0),
        wyniki,
    };
}

/**
 * Gdzie lądują nagrania. Osobno od ujęć — to inny materiał i inny montaż.
 *
 * Podpis taki sam jak `Montazownia.katalogMontazy` — jeden wzorzec dla
 * wszystkich katalogów projektu, żeby most nie musiał znać dwóch sposóbów.
 */
export async function katalogDialogow(katalogKatedry, projekt) {
    const { sciezka } = await utworzProjekt(katalogKatedry, projekt);
    const kat = path.join(sciezka, 'dialogi');
    await fs.mkdir(kat, { recursive: true });
    return kat;
}

export default { dopasujGlos, nazwaGlosu, nagrajKarte, nagrajProjekt, katalogDialogow };
