/**
 * 🌙🎬 REALIZACJA NOCNA — dwie roboty Nocnej Zmiany dla Story (2026-09-12).
 *
 * Suweren: „Zrealizuj zaplanowaną Produkcję — ustawione kadry w Produkcji, po
 * czym Ruch tych kadrów, po czym sklejenie w całość/montaż i zapisanie
 * w katalogu projektu/odcinek, oraz przejście na sekcję GOTOWE — to niech robi
 * Klatka/Fiona. Zrealizuj Tablicę Reżysera — wszystkie odcinki, po kolei,
 * z osobna — tym niech się zajmuje jajo Reżyser."
 *
 *   PRODUKCJA (Klatka):  KADR → RUCH → MONTAŻ → plik w katalogu projektu
 *                        (albo odcinka) → karty na GOTOWE + karta filmu.
 *   TABLICA  (Reżyser):  dla każdego odcinka nie-zrealizowanego, po numerach:
 *                        brak kadrów? → /realizuj (Reżyser pisze kadry) →
 *                        PRODUKCJA tego odcinka → status „zrealizowany"
 *                        (materializacja odcinek.md/json robi się sama w PATCH).
 *
 * ⚠️ NIC TU NIE LICZY SIĘ „PO NOWEMU". Każdy krok to istniejąca trasa mostu:
 * /api/kolejka/odpal (kadry, ruch — z bramami VRAM i silnikami), CiagDalszy.sklej
 * (montaż), /api/rezyser/pamiec/odcinek/:id/realizuj i PATCH statusu. Ten moduł
 * tylko ustawia je w szereg i CZEKA, bo Nocna Zmiana ma jedną parę rąk.
 *
 * ⚠️ WOŁAMY MOST PRZEZ HTTP DO SIEBIE, nie przez import funkcji z trasy — bo
 * cała mądrość kolejki (zwalnianie karty, wybór silnika, prompt z biblią
 * i obsadą) siedzi w handlerze trasy. Kopiowanie jej tu = dwa źródła prawdy.
 *
 * ⚠️ JEDEN ZŁY ETAP NIE UDAJE DOBREGO. Gdy kolejka mówi „żaden kadr na etapie"
 * — to jest informacja, nie błąd (etap był już zrobiony). Gdy padnie render —
 * zapisujemy powód i idziemy do montażu z tym, co jest; rano widać liczby.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

let cfg = null;
const zadania = new Map();
const MAX_ZADAN = 20;
let plikZwierciadla = null;

export function skonfiguruj(c) {
    cfg = c;
    plikZwierciadla = path.join(c.katalogKatedry, 'realizacje-nocne.json');
}

const teraz = () => new Date().toISOString();
const id8 = () => crypto.randomBytes(4).toString('hex');
const spij = (ms) => new Promise((r) => setTimeout(r, ms));

async function zapiszZwierciadlo() {
    if (!plikZwierciadla) return;
    const lista = [...zadania.values()].slice(-MAX_ZADAN);
    const tmp = `${plikZwierciadla}.${process.pid}.tmp`;
    try {
        await fs.writeFile(tmp, JSON.stringify(lista, null, 2), 'utf8');
        await fs.rename(tmp, plikZwierciadla);
    } catch { /* zwierciadło jest pomocnicze */ }
}

function sprzatnij() {
    while (zadania.size > MAX_ZADAN) zadania.delete(zadania.keys().next().value);
}

async function most(sciezka, { metoda = 'GET', body } = {}) {
    const r = await fetch(`${cfg.mostBase}${sciezka}`, {
        method: metoda, headers: { 'Content-Type': 'application/json' },
        body: metoda === 'GET' ? undefined : JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(10 * 60_000),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok && d.success !== false, status: r.status, d };
}

function zdarzenie(agent, rodzaj, tresc) {
    try { cfg.szyna?.nadaj?.({ agent, rodzaj, tresc })?.catch?.(() => {}); } catch { /* opcjonalne */ }
}

export function stanZadania(id) { return zadania.get(id) ?? null; }
export function listaZadan() { return [...zadania.values()].map(({ etapy, ...z }) => ({ ...z, etapy })); }
export function przerwij(id) {
    const z = zadania.get(id);
    if (!z || z.stan !== 'trwa') return false;
    z.przerwane = true;
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// KROK: jedna kolejka (KADR albo RUCH) — odpal i czekaj do końca
// ─────────────────────────────────────────────────────────────────────────────

async function przebiegKolejki(z, etap, { projekt, odcinekId, sekundy, silnikObrazu, rezyser, kroki }) {
    const krok = { etap, stan: 'trwa', od: teraz(), kolejka: null, ujec: 0, bledow: 0, uwaga: null };
    z.etapy.push(krok);
    await zapiszZwierciadlo();

    const start = await most('/api/kolejka/odpal', {
        metoda: 'POST',
        body: { projekt, etap, odcinekId: odcinekId || undefined, ile: 60, sklejaj: false, sekundy, silnikObrazu, rezyser, kroki },
    });
    if (!start.ok) {
        const msg = String(start.d.message || `HTTP ${start.status}`);
        // „Żaden kadr na etapie" / „Wszystkie kadry mają już ujęcia" — etap zrobiony wcześniej, nie awaria.
        if (/zaden kadr|żaden kadr|wszystkie kadry/i.test(msg)) {
            Object.assign(krok, { stan: 'pominiety', uwaga: msg, do: teraz() });
            return krok;
        }
        Object.assign(krok, { stan: 'blad', uwaga: msg, do: teraz() });
        return krok;
    }
    krok.kolejka = start.d.id;

    // Kolejka liczy godzinami. Sondujemy co 15 s, bez sufitu innego niż przerwanie.
    for (;;) {
        await spij(15_000);
        if (z.przerwane) {
            await most(`/api/kolejka/${krok.kolejka}/przerwij`, { metoda: 'POST' }).catch(() => {});
            Object.assign(krok, { stan: 'przerwany', do: teraz() });
            return krok;
        }
        const s = await most(`/api/kolejka/${krok.kolejka}`);
        if (!s.ok) continue;
        const poz = s.d.pozycje ?? [];
        krok.ujec = poz.filter((p) => p.stan === 'gotowe').length;
        krok.bledow = poz.filter((p) => p.stan === 'blad').length;
        krok.biezaca = s.d.biezaca ?? null;
        krok.razem = poz.length;
        if (s.d.stan === 'liczy') continue;
        Object.assign(krok, { stan: s.d.stan === 'gotowe' ? 'gotowy' : 'blad', uwaga: s.d.blad ?? null, do: teraz() });
        return krok;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// KROK: montaż z kart MONTAŻ (+GOTOWE) → plik w katalogu projektu/odcinka
// ─────────────────────────────────────────────────────────────────────────────

async function montaz(z, { projekt, odcinek }) {
    const krok = { etap: 'MONTAZ', stan: 'trwa', od: teraz(), ujec: 0, film: null, uwaga: null };
    z.etapy.push(krok);
    await zapiszZwierciadlo();
    try {
        const wszystkie = (await cfg.produkcjaLista(cfg.katalogKatedry, projekt))
            .filter((k) => ['MONTAZ', 'GOTOWE'].includes(k.etap) && k.etap !== 'BIBLIA')
            .filter((k) => !odcinek || k.sesjaRady === odcinek.id);
        // Karta filmu z poprzedniego przebiegu ma pusty `zwrot` (film siedzi w `notatki`,
        // jak w Tablicy Produkcji) — maJuzUjecie jej nie policzy, więc nie sklejamy filmu z filmem.
        const uporzadkowane = cfg.poKolei(wszystkie);
        const pliki = [];
        for (const k of uporzadkowane) {
            const p = await cfg.maJuzUjecie(k);
            if (p) pliki.push(p);
        }
        krok.ujec = pliki.length;
        if (!pliki.length) { Object.assign(krok, { stan: 'pominiety', uwaga: 'żadna karta MONTAŻ nie ma pliku ujęcia', do: teraz() }); return krok; }

        // Gdzie ląduje film: katalog odcinka (gdy jest) albo katalog ujęć projektu.
        const katalog = odcinek
            ? await cfg.katalogOdcinka(cfg.katalogKatedry, projekt, odcinek, true)
            : await cfg.katalogUjec(cfg.katalogKatedry, projekt);
        const nazwa = odcinek
            ? `odcinek-${String(odcinek.numer).padStart(2, '0')}_${Date.now().toString(36)}.mp4`
            : `_film_${Date.now().toString(36)}.mp4`;
        const wyjscie = path.join(katalog, nazwa);

        if (pliki.length === 1) {
            await fs.copyFile(pliki[0], wyjscie);
            krok.metoda = 'jedno ujęcie — skopiowane, nie było czego sklejać';
        } else {
            const r = await cfg.sklej({ pliki, wyjscie, comfyDir: cfg.comfyDir });
            krok.metoda = r.metoda ?? null;
            if (r.plik && r.plik !== wyjscie && fsSync.existsSync(r.plik) && !fsSync.existsSync(wyjscie)) await fs.copyFile(r.plik, wyjscie);
        }
        if (!fsSync.existsSync(wyjscie)) throw new Error('montaż nie zostawił pliku');

        // 🎵 TELEDYSK: projekt ma utwór (teledysk.json) → podkładamy go pod film.
        // `-shortest`: film ~N×2,04 s, utwór ma swoją długość — tniemy do krótszego,
        // zamiast zostawiać ciszę albo obraz stojący na ostatniej klatce.
        const teledysk = cfg.teledyskProjektu ? await cfg.teledyskProjektu(projekt).catch(() => null) : null;
        let film = wyjscie;
        if (teledysk?.audio && cfg.ffmpeg) {
            const zMuzyka = wyjscie.replace(/\.mp4$/i, '_z_muzyka.mp4');
            try {
                await cfg.execFile(cfg.ffmpeg, ['-y', '-i', wyjscie, '-i', teledysk.audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', zMuzyka], { windowsHide: true, timeout: 10 * 60_000 });
                if (fsSync.existsSync(zMuzyka)) { film = zMuzyka; krok.muzyka = teledysk.audio; }
            } catch (e) { krok.uwagaMuzyka = `muzyka nie weszła pod film: ${(e.stderr || e.message).slice(-300)}`; }
        }
        krok.film = film;
        krok.bajtow = (await fs.stat(film)).size;

        // GOTOWE: karty ujęć przechodzą, plus jedna karta filmu (klucz = ścieżka w notatkach,
        // tak samo jak `wpiszDoGotowych` w Tablicy Produkcji — żeby się nie dublowały).
        for (const k of wszystkie.filter((x) => x.etap === 'MONTAZ')) {
            await cfg.produkcjaZmien(cfg.katalogKatedry, k.id, { etap: 'GOTOWE' }).catch(() => {});
        }
        await cfg.produkcjaDodaj(cfg.katalogKatedry, {
            projekt,
            tytul: path.basename(film),
            opis: odcinek
                ? `Odcinek #${odcinek.numer} „${odcinek.tytul}" złożony nocą z ${pliki.length} ujęć.`
                : `Cały projekt złożony nocą z ${pliki.length} ujęć.`,
            etap: 'GOTOWE', zrodlo: 'reka',
            zwrot: '', notatki: film,
            sesjaRady: odcinek?.id ?? undefined,
        });
        Object.assign(krok, { stan: 'gotowy', do: teraz() });
    } catch (e) {
        Object.assign(krok, { stan: 'blad', uwaga: e.message, do: teraz() });
    }
    return krok;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROBOTA 1: PRODUKCJA (Klatka)
// ─────────────────────────────────────────────────────────────────────────────

async function przebiegProdukcji(z, p) {
    let odcinek = null;
    if (p.odcinekId) {
        const pam = await cfg.rezyserPamiec(cfg.katalogKatedry, p.projekt);
        odcinek = (pam.odcinki ?? []).find((o) => o.id === p.odcinekId) ?? null;
        if (!odcinek) throw new Error(`Odcinek „${p.odcinekId}" nie istnieje w projekcie „${p.projekt}".`);
    }
    zdarzenie('Klatka', 'praca', `Nocna Zmiana: realizuję ${odcinek ? `odcinek #${odcinek.numer} „${odcinek.tytul}"` : `projekt „${p.projekt}"`} — kadry → ruch → montaż`);
    const k1 = await przebiegKolejki(z, 'KADR', p); if (z.przerwane) return;
    const k2 = await przebiegKolejki(z, 'RUCH', p); if (z.przerwane) return;
    const m = await montaz(z, { projekt: p.projekt, odcinek });
    z.film = m.film ?? null;
    z.podsumowanie = `kadry: ${k1.stan} (${k1.ujec ?? 0}/${k1.razem ?? 0}) · ruch: ${k2.stan} (${k2.ujec ?? 0}/${k2.razem ?? 0}) · montaż: ${m.stan}${m.film ? ` → ${path.basename(m.film)}` : m.uwaga ? ` (${m.uwaga})` : ''}`;
    zdarzenie('Klatka', 'praca', `Nocna Zmiana skończyła: ${z.podsumowanie}`);
    return m;
}

export function zrealizujProdukcje(p) {
    if (!cfg) throw new Error('RealizacjaNocna nieskonfigurowana.');
    if (!String(p.projekt || '').trim()) throw new Error('Bez nazwy projektu nie wiem, co realizować.');
    const id = `prod-${Date.now().toString(36)}-${id8()}`;
    const z = { id, rodzaj: 'produkcja', agent: 'Klatka', projekt: p.projekt, odcinekId: p.odcinekId || null, stan: 'trwa', od: teraz(), etapy: [], film: null, podsumowanie: null, blad: null, przerwane: false };
    zadania.set(id, z); sprzatnij();
    (async () => {
        try { await przebiegProdukcji(z, p); z.stan = z.przerwane ? 'przerwane' : 'gotowe'; }
        catch (e) { z.stan = 'blad'; z.blad = e.message; }
        z.do = teraz();
        await zapiszZwierciadlo();
    })();
    return z;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROBOTA 2: TABLICA REŻYSERA (Reżyser) — odcinki po kolei, z osobna
// ─────────────────────────────────────────────────────────────────────────────

export function zrealizujTablice(p) {
    if (!cfg) throw new Error('RealizacjaNocna nieskonfigurowana.');
    const serial = String(p.serial || p.projekt || '').trim();
    if (!serial) throw new Error('Bez nazwy serialu nie wiem, którą tablicę realizować.');
    const id = `tabl-${Date.now().toString(36)}-${id8()}`;
    const z = { id, rodzaj: 'tablica', agent: 'Reżyser', projekt: serial, stan: 'trwa', od: teraz(), odcinki: [], etapy: [], biezacy: null, podsumowanie: null, blad: null, przerwane: false };
    zadania.set(id, z); sprzatnij();

    (async () => {
        try {
            const pam = await cfg.rezyserPamiec(cfg.katalogKatedry, serial);
            const doZrobienia = (pam.odcinki ?? [])
                .filter((o) => o.status !== 'zrealizowany')
                .sort((a, b) => (Number(a.numer) || 0) - (Number(b.numer) || 0));
            if (!doZrobienia.length) { z.podsumowanie = 'Tablica nie ma odcinków do zrealizowania — wszystkie są „zrealizowane" albo nie ma żadnego.'; z.stan = 'gotowe'; z.do = teraz(); await zapiszZwierciadlo(); return; }
            zdarzenie('Reżyser', 'praca', `Nocna Zmiana: biorę tablicę „${serial}" — ${doZrobienia.length} odcinków, po kolei`);

            for (const o of doZrobienia) {
                if (z.przerwane) break;
                const wpis = { id: o.id, numer: o.numer, tytul: o.tytul, stan: 'trwa', od: teraz(), napisanoKadrow: null, film: null, uwaga: null };
                z.odcinki.push(wpis); z.biezacy = o.id;
                await zapiszZwierciadlo();
                try {
                    // 1. Kadry — jeśli odcinek nie ma jeszcze żadnych, Reżyser je pisze.
                    const kadry = (await cfg.produkcjaLista(cfg.katalogKatedry, serial)).filter((k) => k.sesjaRady === o.id && k.etap !== 'BIBLIA');
                    if (!kadry.length) {
                        const r = await most(`/api/rezyser/pamiec/odcinek/${encodeURIComponent(o.id)}/realizuj`, { metoda: 'POST', body: { serial, model: p.model } });
                        if (!r.ok) throw new Error(`Reżyser nie napisał kadrów: ${r.d.message || r.status}`);
                        wpis.napisanoKadrow = (r.d.kadry ?? []).length;
                        if (!wpis.napisanoKadrow) throw new Error('Reżyser nie oddał ani jednego kadru');
                    } else {
                        wpis.napisanoKadrow = 0;
                        wpis.uwaga = `odcinek miał już ${kadry.length} kadrów — nie pisano nowych`;
                    }
                    // 2. Produkcja tego odcinka: kadry → ruch → montaż → GOTOWE.
                    const m = await przebiegProdukcji(z, { ...p, projekt: serial, odcinekId: o.id });
                    if (z.przerwane) { wpis.stan = 'przerwany'; break; }
                    wpis.film = m?.film ?? null;
                    // 3. Status na tablicy — tylko gdy film naprawdę powstał.
                    if (wpis.film) {
                        const s = await most(`/api/rezyser/pamiec/odcinek/${encodeURIComponent(o.id)}`, { metoda: 'PATCH', body: { serial, status: 'zrealizowany' } });
                        wpis.stan = s.ok ? 'zrealizowany' : 'film-jest-status-nie';
                        if (!s.ok) wpis.uwaga = s.d.message || `PATCH HTTP ${s.status}`;
                    } else {
                        wpis.stan = 'bez-filmu'; wpis.uwaga = wpis.uwaga || m?.uwaga || 'montaż nie oddał pliku';
                    }
                } catch (e) {
                    wpis.stan = 'blad'; wpis.uwaga = e.message;
                }
                wpis.do = teraz();
                await zapiszZwierciadlo();
            }
            z.biezacy = null;
            const zrob = z.odcinki.filter((o) => o.stan === 'zrealizowany').length;
            z.podsumowanie = `${zrob}/${doZrobienia.length} odcinków zrealizowanych` + (z.odcinki.some((o) => o.stan !== 'zrealizowany') ? ` · reszta: ${z.odcinki.filter((o) => o.stan !== 'zrealizowany').map((o) => `#${o.numer} ${o.stan}`).join(', ')}` : '');
            zdarzenie('Reżyser', 'praca', `Nocna Zmiana skończyła tablicę „${serial}": ${z.podsumowanie}`);
            z.stan = z.przerwane ? 'przerwane' : 'gotowe';
        } catch (e) {
            z.stan = 'blad'; z.blad = e.message;
        }
        z.do = teraz();
        await zapiszZwierciadlo();
    })();
    return z;
}

export default { skonfiguruj, zrealizujProdukcje, zrealizujTablice, stanZadania, listaZadan, przerwij };
