/**
 * 🩰 Taniec w Zebrra Sports (Suweren 2026-10-16: kanał Zebrra Football → Zebrra Sports; „jedną z dyscyplin jest taniec”).
 *
 * Prowadzący Studia Zebrra (Gol Donna 🦓, Zlat Kadabra 🦁, Jai Lampart 🐆 — i stado narratorów Gola Dnia) komentują
 * występy z 💃 Tanecznego Starcia: choreografie TeOgochi (services/Choreografie.js) z oceną mostu (takt, energia,
 * różnorodność), rangą, ruchami z riga i miejscem w turniejach (Taniec Dnia… Mistrzostwa Świata). Ekran LED w studiu
 * pokazuje nagranie występu (mp4 z montażu `taneczne-starcie`), a link prowadzi do odcinka 🎪 TeO Game Show na YouTube,
 * gdy ten już tam jest.
 *
 * Scenariusz TYLKO z faktów: model prowadzącego pisze INTRO / WYSTEP n / OCENA n / RUCHY n / OUTRO, a każda liczba
 * w tekście musi być w faktach (`liczbyPozaFaktami`) — inaczej jedna poprawka z błędem w prośbie, potem błąd wprost.
 * Obraz: tylko nagranie apki (studio 3D + klip naszego występu), bez cudzych materiałów.
 *
 * Łańcuch: utworz → scenariusz (w tle) → `studio` (czeka na nagranie w apce) → nagranie → mp4
 * `produkcje/zebrra-sports/montaz/zebrra_taniec_<tancerze>_<kto>_<jezyk>_<id>.mp4` → Kronikarz → ✓ w Izbie.
 * Ten katalog montaży widzi 📱 Formaty i sieci (autopilot Shorts/TikTok/Reels).
 */
import fsSync from 'fs';
import path from 'path';
import { NARRATORZY, MAX_WSPOL } from './GolDnia.js';
import { OKRESY, rangaOceny } from './Choreografie.js';
import { liczbyPozaFaktami, bezpNazwa, utworzMagazyn, glosKwestii, nagranieDoMp4 } from './OdcinkiStudia.js';

export const PROGRAM = 'zebrra-taniec';
export const PROJEKT = 'zebrra-sports';
export const NAZWA = 'Zebrra Sports · Taniec';
export const MAX_WYSTEPOW = 3;
export const JEZYKI = { en: 'English', pl: 'polski' };
const ID = /^z-[0-9a-f]{8}$/;
const OKRESY_EN = { dzien: 'Dance of the Day', tydzien: 'Dance of the Week', miesiac: 'Dance of the Month', rok: 'Dance of the Year', mistrzostwa: 'World Championship' };

/** Nazwa ruchu z riga („Arm_Circle_Shuffle”, „Armature|Hip_Hop”) → „Arm Circle Shuffle”. */
export const nazwaRuchu = (n) => String(n ?? '').split('|').pop().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Fakty występu z choreografii — jedyne, o czym wolno mówić. `turnieje` = okresy, w których ta choreografia prowadzi
 * (Choreografie.moje()), `gameShow` = odcinek TeO Game Show z tym występem (publikacja: tytuł, adres YouTube).
 */
export function faktyWystepu(c, { turnieje = [], gameShow = null, klip = null } = {}) {
    const uzycia = new Map();
    for (const i of c.uklad ?? []) uzycia.set(i, (uzycia.get(i) ?? 0) + 1);
    const uzyte = [...uzycia.entries()].map(([i, n]) => ({ ruch: c.ruchy?.[i], n })).filter((x) => x.ruch);
    const top = [...uzyte].sort((a, b) => b.n - a.n || (b.ruch.moc ?? 0) - (a.ruch.moc ?? 0)).slice(0, 3).map((x) => nazwaRuchu(x.ruch.nazwa));
    const najmocniejszy = [...uzyte].sort((a, b) => (b.ruch.moc ?? 0) - (a.ruch.moc ?? 0))[0];
    const proc = (x) => Math.round((Number(x) || 0) * 100);
    return {
        choreografia: c.id, tancerz: c.mini?.nazwa || 'TeOgochi',
        utwor: { tytul: c.utwor?.tytul ?? '', bpm: Math.round(Number(c.utwor?.bpm) || 0), plik: c.utwor?.plik ?? null },
        ocena: { wynik: Number(c.ocena?.wynik) || 0, takt: proc(c.ocena?.takt), energia: proc(c.ocena?.energia), roznorodnosc: proc(c.ocena?.roznorodnosc) },
        ranga: rangaOceny(Number(c.ocena?.wynik) || 0),
        frazy: c.frazy?.length ?? 0, fraza: c.fraza ?? null, ruchow: uzyte.length,
        ruchy: top, najmocniejszy: najmocniejszy ? nazwaRuchu(najmocniejszy.ruch.nazwa) : null,
        turnieje: turnieje.map((o) => o.okres).filter((o) => OKRESY[o]),
        gameShow: gameShow ? { tytul: gameShow.tytul ?? null, url: gameShow.url ?? null } : null,
        klip,
    };
}

/** Wszystkie liczby, które scenariusz może wypowiedzieć (wynik, procenty, BPM, frazy, ruchy, liczba występów, skala 100). */
export function liczbyFaktow(wystepy) {
    // liczby z nazw jak w sprawdzarce (z ułamkiem i bez): „T 8.1 Tribal Cathedral” daje 8.1, 8 i 1 (2026-10-22: „8.1” odrzucało scenariusz)
    const zNazwy = (t) => [...String(t ?? '').matchAll(/\d+(?:[.,]\d+)?/g)].flatMap((m) => [m[0].replace(',', '.'), ...m[0].split(/[.,]/)]);
    const out = [100, wystepy.length];
    wystepy.forEach((w, i) => out.push(i + 1, w.ocena.wynik, w.ocena.takt, w.ocena.energia, w.ocena.roznorodnosc, w.utwor.bpm, w.frazy, w.fraza ?? 0, w.ruchow,
        ...zNazwy(w.utwor.tytul), ...zNazwy(w.tancerz), ...w.ruchy.flatMap(zNazwy)));
    return out;
}

/** Kto mówi: prowadzący intro, zapowiedź występu i outro; współprowadzący (po kolei) ocenę i ruchy. */
export function ktoMowiTaniec(typ, s, wystep = 0) {
    const w = s.wspolprowadzacy ?? [];
    if (!w.length || !['ocena', 'ruchy'].includes(typ)) return s.narrator;
    return w[(wystep * 2 + (typ === 'ruchy' ? 1 : 0)) % w.length];
}

export function promptScenariusza({ wystepy, narrator, wspolprowadzacy = [], jezyk = 'en', s = null }) {
    const en = jezyk === 'en';
    const sklad = [narrator, ...wspolprowadzacy].map((k) => NARRATORZY[k]).filter(Boolean);
    const okres = (o) => (en ? OKRESY_EN[o] : OKRESY[o]);
    const opis = wystepy.map((w, i) => [
        `WYSTĘP ${i + 1}: tancerz „${w.tancerz}”, utwór „${w.utwor.tytul}” (${w.utwor.bpm} BPM)`,
        `  ocena mostu: ${w.ocena.wynik}/100, ranga ${w.ranga}; takt ${w.ocena.takt}%, energia ${w.ocena.energia}%, różnorodność ${w.ocena.roznorodnosc}%`,
        `  układ: ${w.frazy} fraz po ${w.fraza} uderzeń, ${w.ruchow} różnych ruchów; najczęściej: ${w.ruchy.join(', ') || '—'}; najmocniejszy: ${w.najmocniejszy ?? '—'}`,
        `  turnieje: ${w.turnieje.length ? `prowadzi w: ${w.turnieje.map(okres).join(', ')}` : 'nie prowadzi w żadnym otwartym turnieju'}`,
        w.gameShow ? `  TeO Game Show: ${w.gameShow.tytul ?? 'odcinek z tym występem'}` : null,
    ].filter(Boolean).join('\n')).join('\n');
    const role = s ? [...new Set(wystepy.flatMap((_, i) => ['ocena', 'ruchy'].map((t) => `${t.toUpperCase()} ${i + 1} → ${NARRATORZY[ktoMowiTaniec(t, s, i)]?.imie}`)))].join('; ') : '';
    const system = [
        `Jesteś ${sklad.length > 1 ? 'składem prowadzących' : 'prowadzącym'} studia telewizyjnego Zebrra Sports (kanał sportowy Katedry OtakOS) — dziś dyscyplina: TANIEC. Komentujecie występy TeOgochi z gry Taneczne Starcie.`,
        ...sklad.map((n) => `- ${n.imie} (${en ? n.imieEn : n.imie}): ${en ? n.temperamentEn : n.temperament}`),
        'ŻELAZNE ZASADY:',
        '1. Mówisz TYLKO o faktach podanych niżej. Nie wymyślasz historii tancerza, publiczności, jurorów ani rekordów.',
        '2. Każda liczba, którą wypowiesz, musi być w faktach (wynik, procenty, BPM, frazy, liczba ruchów). Nie dodawaj żadnych innych liczb, dat ani miejsc w rankingu.',
        '3. Ocena pochodzi z mostu Katedry: takt = jak dobrze ruchy trafiają w tempo, energia = czy mocne ruchy idą na mocne frazy, różnorodność = ile różnych ruchów.',
        '4. Krótko: każda linia 1–3 zdania, mówione na głos. Bez emoji, bez markdown.',
        `5. Język: ${en ? 'English' : 'polski'}.`,
        'FORMAT (każda linia od etykiety, nic poza tym). Etykieta to NAZWA CZĘŚCI, nie imię mówiącego — nigdy nie zaczynaj linii od imienia:',
        'INTRO: …',
        ...wystepy.flatMap((_, i) => [`WYSTEP ${i + 1}: … (zapowiedź: tancerz i utwór)`, `OCENA ${i + 1}: … (wynik, ranga, takt/energia/różnorodność, turnieje)`, `RUCHY ${i + 1}: … (ruchy i układ)`]),
        'OUTRO: …',
        role ? `Kto mówi: INTRO, WYSTEP i OUTRO — ${NARRATORZY[narrator]?.imie}; ${role}. Pisz linię głosem tej osoby.` : '',
    ].filter(Boolean).join('\n');
    return { system, user: `FAKTY:\n${opis}` };
}

/** Odczyt scenariusza: etykiety INTRO / WYSTEP n / OCENA n / RUCHY n / OUTRO — wszystkie obowiązkowe. */
export function odczytajScenariusz(tekst, ileWystepow, imiona = []) {
    // zapas (zmierzone 2026-10-21, teogochi_yay z duetem Gol Donna + Zlat): linie podpisane imionami prowadzących zamiast
    // etykiet — bierzemy je po kolei TYLKO, gdy jest ich dokładnie tyle, ile części (INTRO, po 3 na występ, OUTRO)
    if (imiona.length && !/^[\s*#>-]*(INTRO|OUTRO|WYST[EĘ]P|OCENA|RUCHY)\s*\d*\s*[:：]/im.test(String(tekst ?? ''))) {
        const nazwy = imiona.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const wzor = new RegExp(`^[\\s*#>-]*(?:${nazwy})\\s*[:：]\\s*(.+)$`, 'i');
        const linie = String(tekst ?? '').replace(/\r/g, '').split('\n').map((l) => wzor.exec(l.replace(/\*\*/g, '').trim())?.[1]?.trim()).filter(Boolean);
        if (linie.length === 2 + 3 * ileWystepow) {
            tekst = [`INTRO: ${linie[0]}`, ...Array.from({ length: ileWystepow }, (_, i) => [`WYSTEP ${i + 1}: ${linie[1 + 3 * i]}`, `OCENA ${i + 1}: ${linie[2 + 3 * i]}`, `RUCHY ${i + 1}: ${linie[3 + 3 * i]}`]).flat(), `OUTRO: ${linie.at(-1)}`].join('\n');
        }
    }
    const sc = { intro: '', outro: '', wystepy: Array.from({ length: ileWystepow }, () => ({ zapowiedz: '', ocena: '', ruchy: '' })) };
    let biezace = null;
    const pole = { WYSTEP: 'zapowiedz', 'WYSTĘP': 'zapowiedz', OCENA: 'ocena', RUCHY: 'ruchy' };
    for (const surowa of String(tekst ?? '').replace(/\r/g, '').split('\n')) {
        const l = surowa.replace(/^[\s*#>-]+/, '').replace(/\*\*/g, '').trim();
        if (!l) continue;
        const m = /^(INTRO|OUTRO|WYST[EĘ]P|OCENA|RUCHY)\s*(\d+)?\s*[:：]\s*(.*)$/i.exec(l);
        if (m) {
            const et = m[1].toUpperCase();
            if (et === 'INTRO' || et === 'OUTRO') { biezace = { o: sc, k: et.toLowerCase() }; sc[biezace.k] = m[3].trim(); continue; }
            const n = Number(m[2]);
            if (!(n >= 1 && n <= ileWystepow)) { biezace = null; continue; }
            biezace = { o: sc.wystepy[n - 1], k: pole[et] };
            biezace.o[biezace.k] = m[3].trim();
        } else if (biezace) biezace.o[biezace.k] = `${biezace.o[biezace.k]} ${l}`.trim();
    }
    const braki = [];
    if (!sc.intro) braki.push('INTRO');
    sc.wystepy.forEach((w, i) => { for (const [k, et] of [['zapowiedz', 'WYSTEP'], ['ocena', 'OCENA'], ['ruchy', 'RUCHY']]) if (!w[k]) braki.push(`${et} ${i + 1}`); });
    if (!sc.outro) braki.push('OUTRO');
    if (braki.length) throw new Error(`Scenariusz bez linii: ${braki.join(', ')}.`);
    return sc;
}

/** Linie scenariusza z liczbami spoza faktów → opis błędu (null = czysto). */
export function sprawdzLiczby(sc, wystepy) {
    const dozw = liczbyFaktow(wystepy);
    const linie = [['INTRO', sc.intro], ...sc.wystepy.flatMap((w, i) => [[`WYSTEP ${i + 1}`, w.zapowiedz], [`OCENA ${i + 1}`, w.ocena], [`RUCHY ${i + 1}`, w.ruchy]]), ['OUTRO', sc.outro]];
    const zle = linie.map(([et, t]) => [et, liczbyPozaFaktami(t, dozw)]).filter(([, z]) => z.length);
    return zle.length ? `liczby spoza faktów: ${zle.map(([et, z]) => `${et} (${z.join(', ')})`).join('; ')}` : null;
}

/** Kwestie odcinka po kolei — dla Studia: kto mówi, co, nagłówek, który występ (klip na ekranie LED). */
export function kwestieOdcinka(s) {
    if (!s?.scenariusz) return [];
    const en = s.jezyk === 'en';
    const out = [];
    const dodaj = (typ, wystep, tekst, naglowek) => out.push({ nr: out.length + 1, typ, gol: null, wystep, kto: ktoMowiTaniec(typ, s, wystep ?? 0), tekst, naglowek, obraz: null });
    dodaj('intro', null, s.scenariusz.intro, `🩰 ${NAZWA}`);
    s.wystepy.forEach((w, i) => {
        dodaj('wystep', i, s.scenariusz.wystepy[i].zapowiedz, `${w.tancerz} · „${w.utwor.tytul}”`);
        dodaj('ocena', i, s.scenariusz.wystepy[i].ocena, `${w.ocena.wynik}/100 · ${en ? 'rank' : 'ranga'} ${w.ranga}`);
        dodaj('ruchy', i, s.scenariusz.wystepy[i].ruchy, `${w.ruchow} ${en ? 'moves' : 'ruchów'} · ${w.frazy} ${en ? 'phrases' : 'fraz'}`);
    });
    dodaj('outro', null, s.scenariusz.outro, s.wystepy.map((w) => `${w.tancerz} ${w.ocena.wynik}`).join(' · '));
    return out;
}

export function kontekstKronikarza(s) {
    const en = s.jezyk === 'en';
    const sklad = [s.narrator, ...(s.wspolprowadzacy ?? [])].map((k) => NARRATORZY[k]).filter(Boolean);
    const okres = (o) => (en ? OKRESY_EN[o] : OKRESY[o]);
    const w = s.wystepy.map((x) => `${x.tancerz} — "${x.utwor.tytul}" (${x.utwor.bpm} BPM): score ${x.ocena.wynik}/100, rank ${x.ranga} (timing ${x.ocena.takt}%, energy ${x.ocena.energia}%, variety ${x.ocena.roznorodnosc}%)${x.turnieje.length ? `, leads ${x.turnieje.map(okres).join(', ')}` : ''}${x.gameShow?.url ? `. Full TeO Game Show episode: ${x.gameShow.url}` : ''}`).join('\n');
    return `Program "${NAZWA}" of Katedra OtakOS — the sports channel Zebrra Sports, dance discipline. Hosts: TeOgochi ${sklad.map((n) => `${en ? n.imieEn : n.imie} (${en ? n.temperamentEn : n.temperament})`).join(' and ')} in the 3D studio comment dance performances of TeOgochi creatures from the game "Taneczne Starcie" (Dance Clash). The LED screen shows the recorded performance (our own game footage). Scores are computed by the Katedra bridge (timing, energy, variety).\n${w}\n${en ? 'Write the title, description and tags in English. Put the TeO Game Show links (if any) in the description.' : 'Tytuł, opis i tagi po polsku. Linki do TeO Game Show (jeśli są) wstaw do opisu.'}`;
}

export const nazwaPublikacji = (s) => `${NAZWA} — ${s.wystepy.map((w) => `${w.tancerz} ${w.ocena.wynik}/100`).join(' · ')} · ${[s.narrator, ...(s.wspolprowadzacy ?? [])].map((k) => NARRATORZY[k]?.imie ?? k).join(' & ')}`;

/**
 * @param {{ katalog: string, katalogMontazy: (projekt: string) => Promise<string>,
 *   choreografie: { wczytaj: (id: string) => Promise<any>, lista: () => Promise<any[]>, moje: () => Promise<any[]> },
 *   gameShow?: () => Promise<any[]>, publikacja?: (id: string) => Promise<any>,
 *   chat?: (model: string|null, system: string, user: string) => Promise<{ tekst: string }>, modelDla?: (id: string) => Promise<string|null>,
 *   mow?: (o: { tekst: string, glos: string, jezyk: string }) => Promise<{ audio: Buffer, ext: string }>,
 *   publikuj?: Function, kanal?: () => Promise<string|null>, opisz?: Function, ffmpeg?: string, szyna?: any, teraz?: () => number }} o
 */
export function utworzZebrraTaniec(o) {
    const cfg = { ffmpeg: 'ffmpeg', teraz: () => Date.now(), modelDla: async () => null, opisz: async () => ({ sekundy: null }), ...o };
    const M = utworzMagazyn({ katalog: cfg.katalog, program: PROGRAM, wzorId: ID });
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Gol Donna', rodzaj: 'praca', tresc: `🩰 ${tresc}` })?.catch?.(() => {});

    /** Nagranie występu na dysku: najnowsze z listy choreografii, które naprawdę jest w montażu Tanecznego Starcia. */
    async function nagranieWystepu(c) {
        const kat = await cfg.katalogMontazy('taneczne-starcie');
        for (const n of [...(c.nagrania ?? [])].reverse()) {
            const p = path.join(kat, path.basename(String(n.nazwa)));
            if (n.nazwa && fsSync.existsSync(p)) return { nazwa: path.basename(p), plik: p };
        }
        return null;
    }
    /** Odcinek TeO Game Show z tą choreografią (najnowszy) + link YouTube, gdy publikacja już na kanale. */
    async function gameShowDla(id) {
        const s = (await cfg.gameShow?.().catch(() => []) ?? []).find((x) => x.choreografia?.id === id);
        if (!s) return null;
        const p = s.publikacja?.id && cfg.publikacja ? await cfg.publikacja(s.publikacja.id).catch(() => null) : null;
        return { id: s.id, tytul: p?.tytul ?? s.publikacja?.tytul ?? null, url: p?.url ?? null };
    }
    async function zbierzFakty(ids) {
        const moje = await cfg.choreografie.moje().catch(() => []);
        const out = [];
        for (const id of ids) {
            const c = await cfg.choreografie.wczytaj(id);
            const klip = await nagranieWystepu(c);
            if (!klip) throw new Error(`„${c.nazwa}” nie ma nagrania w montażu Tanecznego Starcia — nagraj występ w apce (🎥), wtedy studio pokaże klip.`);
            const turnieje = moje.filter((x) => x.wynik?.choreografia === c.id);
            out.push({ ...faktyWystepu(c, { turnieje, gameShow: await gameShowDla(c.id), klip: klip.nazwa }), klipPlik: klip.plik });
        }
        return out;
    }

    /** Choreografie, które da się omówić (z nagraniem), dla panelu. */
    async function dostepne() {
        const kat = await cfg.katalogMontazy('taneczne-starcie');
        return (await cfg.choreografie.lista()).map((c) => ({ ...c, zNagraniem: (c.nagrania ?? []).some((n) => n.nazwa && fsSync.existsSync(path.join(kat, path.basename(n.nazwa)))) }));
    }

    async function napiszScenariusz(s) {
        const model = (await cfg.modelDla(s.narrator).catch(() => null)) ?? (await cfg.modelDla('pilkarka').catch(() => null));
        const { system, user } = promptScenariusza({ wystepy: s.wystepy, narrator: s.narrator, wspolprowadzacy: s.wspolprowadzacy, jezyk: s.jezyk, s });
        let blad = null;
        for (let proba = 0; proba < 2; proba++) {
            // przy duecie model lubi podpisywać linie imionami („Gol Donna: …”) — druga próba dostaje wzór etykiet wprost
            const wzor = ['INTRO: …', ...s.wystepy.flatMap((_, i) => [`WYSTEP ${i + 1}: …`, `OCENA ${i + 1}: …`, `RUCHY ${i + 1}: …`]), 'OUTRO: …'].join('\n');
            const r = await cfg.chat(model, system, proba ? `${user}\n\nPOPRZEDNIA WERSJA ODRZUCONA: ${blad}. Napisz całość od nowa, trzymając się faktów. Linie zaczynaj DOKŁADNIE od tych etykiet (bez imion mówiących):\n${wzor}` : user);
            try {
                const imiona = [s.narrator, ...(s.wspolprowadzacy ?? [])].flatMap((k) => [NARRATORZY[k]?.imie, NARRATORZY[k]?.imieEn]).filter(Boolean);
                const sc = odczytajScenariusz(r.tekst, s.wystepy.length, imiona);
                const zle = sprawdzLiczby(sc, s.wystepy);
                if (zle) throw new Error(zle);
                return { sc, model, proby: proba + 1 };
            } catch (e) { blad = e.message; }
        }
        throw new Error(`Scenariusz odrzucony dwa razy — ${blad}`);
    }

    async function przebieg(id) {
        const s = await M.wczytaj(id);
        try {
            if (!cfg.chat) throw new Error('Most nie ma modelu do scenariusza.');
            const { sc, model, proby } = await napiszScenariusz(s);
            Object.assign(s, { scenariusz: sc, model, proby, stan: 'studio', powod: null, napisano: czas() });
            nadaj(`scenariusz tańca gotowy (${s.wystepy.map((w) => w.tancerz).join(', ')}) — czeka na nagranie w Studiu Zebrra`);
        } catch (e) { Object.assign(s, { stan: 'blad', powod: String(e.message || e).slice(0, 600) }); }
        await M.pisz(s);
    }

    async function utworz({ wystepy, narrator = 'zebra', wspolprowadzacy = [], jezyk = 'en', wieczor = null } = {}) {
        const ids = [...new Set((Array.isArray(wystepy) ? wystepy : []).map(String))];
        if (!ids.length) throw new Error('Wybierz co najmniej jeden występ (choreografię z nagraniem).');
        if (ids.length > MAX_WYSTEPOW) throw new Error(`Najwyżej ${MAX_WYSTEPOW} występy w odcinku.`);
        if (!NARRATORZY[narrator]) throw new Error(`Prowadzący: ${Object.keys(NARRATORZY).join(', ')}.`);
        const wsp = (Array.isArray(wspolprowadzacy) ? wspolprowadzacy : []).filter((k, i, a) => NARRATORZY[k] && k !== narrator && a.indexOf(k) === i).slice(0, MAX_WSPOL);
        const fakty = await zbierzFakty(ids);
        const s = { wersja: 1, id: M.noweId('z'), stan: 'robi', powod: null, narrator, wspolprowadzacy: wsp, jezyk: JEZYKI[jezyk] ? jezyk : 'en',
            wystepy: fakty.map(({ klipPlik: _k, ...w }) => w), klipy: fakty.map((w) => w.klipPlik), scenariusz: null, plik: null, publikacja: null, utworzono: czas(),
            // 🌙 część Wieczoru Tańca (services/WieczorTanca.js) — automat nagrywania studia bierze tylko takie
            ...(/^w-[0-9a-f]{8}$/.test(String(wieczor)) ? { wieczor: String(wieczor) } : {}) };
        await M.pisz(s);
        M.zakolejkuj(s.id, () => przebieg(s.id));
        return s;
    }

    async function ponow(id) {
        const s = await M.wczytaj(id);
        if (M.wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.');
        Object.assign(s, { stan: 'robi', powod: null, scenariusz: null, plik: null, publikacja: null });
        await M.pisz(s);
        M.zakolejkuj(id, () => przebieg(id));
        return s;
    }

    /** ✎ Poprawka Suwerena — jego słowo jest faktem; stare nagranie nie pasuje do nowego tekstu. */
    async function popraw(id, scenariusz) {
        const s = await M.wczytaj(id);
        if (M.wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.');
        if (!s.scenariusz) throw new Error('Odcinek nie ma jeszcze scenariusza.');
        const t = (x, dom) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, 800) : dom);
        const n = { intro: t(scenariusz?.intro, s.scenariusz.intro), outro: t(scenariusz?.outro, s.scenariusz.outro),
            wystepy: s.scenariusz.wystepy.map((w, i) => ({ zapowiedz: t(scenariusz?.wystepy?.[i]?.zapowiedz, w.zapowiedz), ocena: t(scenariusz?.wystepy?.[i]?.ocena, w.ocena), ruchy: t(scenariusz?.wystepy?.[i]?.ruchy, w.ruchy) })) };
        Object.assign(s, { scenariusz: n, poprawiono: czas(), stan: 'studio', plik: null, publikacja: null });
        await M.pisz(s);
        return s;
    }

    async function glos(id, nr) {
        const s = await M.wczytaj(id);
        const k = kwestieOdcinka(s).find((x) => x.nr === Number(nr));
        if (!k) throw new Error('Nie ma takiej kwestii.');
        return { plik: await glosKwestii({ praca: M.praca(id), kwestia: k, glos: k.kto, jezyk: s.jezyk, mow: cfg.mow }), kto: k.kto };
    }

    function sciezkaKlipu(s, k) {
        const p = s.klipy?.[Number(k)];
        return p && fsSync.existsSync(p) ? p : null;
    }

    async function nagranie(id, bufor, { typ = 'video/webm', prowadzacy = null } = {}) {
        const s = await M.wczytaj(id);
        if (M.wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi — nagraj, gdy skończy.');
        if (!s.scenariusz) throw new Error('Odcinek nie ma jeszcze scenariusza.');
        const kto = (Array.isArray(prowadzacy) && prowadzacy.length ? prowadzacy : [s.narrator, ...s.wspolprowadzacy]).filter((x) => NARRATORZY[x]).slice(0, 1 + MAX_WSPOL);
        const kat = await cfg.katalogMontazy(PROJEKT);
        const cel = path.join(kat, `zebrra_taniec_${bezpNazwa(s.wystepy.map((w) => w.tancerz).join('-'))}_${kto.join('+')}_${s.jezyk}_${s.id.slice(2)}.mp4`);
        await nagranieDoMp4({ bufor, typ, praca: M.praca(id), cel, ffmpeg: cfg.ffmpeg });
        Object.assign(s, { plik: cel, prowadzacyNagrania: kto, nagrano: czas(), sekundy: (await cfg.opisz(cel).catch(() => null))?.sekundy ?? null, stan: 'nagrany', publikacja: null });
        if (cfg.publikuj) {
            try {
                const p = await cfg.publikuj({ plik: cel, nazwa: nazwaPublikacji(s), jezyk: s.jezyk, kontekst: kontekstKronikarza(s), zrodlo: { projekt: PROJEKT, taniec: s.id }, kanalId: (await cfg.kanal?.().catch(() => null)) ?? null });
                s.publikacja = { id: p.id ?? null, etap: p.etap ?? null };
                s.stan = 'do_akceptacji';
            } catch (e) { s.powod = `publikacja: ${e.message}`; }
        }
        await M.pisz(s);
        nadaj(`nagranie studia: taniec ${s.wystepy.map((w) => w.tancerz).join(', ')} w Montażowni`);
        return s;
    }

    return { lista: M.lista, wczytaj: M.wczytaj, usun: M.usun, utworz, ponow, popraw, glos, nagranie, dostepne, sciezkaKlipu, zbierzFakty, czekaj: M.czekaj };
}

export function zamontujTrasyZebrraTanca(app, T, { raw = null, maxNagraniaMb = 600 } = {}) {
    const odp = (res, p, kod = 400) => p.then((w) => res.json({ success: true, ...w })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    app.get('/api/zebrra-taniec', (_req, res) => odp(res, (async () => ({
        odcinki: await T.lista(), choreografie: await T.dostepne(), jezyki: JEZYKI, maxWystepow: MAX_WYSTEPOW, maxWspol: MAX_WSPOL, okresy: OKRESY,
        narratorzy: Object.fromEntries(Object.entries(NARRATORZY).map(([k, v]) => [k, { imie: v.imie, imieEn: v.imieEn, emoji: v.emoji, temperament: v.temperament, rola: v.rola ?? 'stado', kolor: v.kolor ?? null }])),
    }))(), 500));
    app.post('/api/zebrra-taniec', (req, res) => odp(res, T.utworz(req.body ?? {}).then((odcinek) => ({ odcinek }))));
    app.get('/api/zebrra-taniec/:id', (req, res) => odp(res, T.wczytaj(req.params.id).then((odcinek) => ({ odcinek })), 404));
    app.get('/api/zebrra-taniec/:id/studio', (req, res) => odp(res, T.wczytaj(req.params.id).then((o) => ({
        odcinek: o, kwestie: kwestieOdcinka(o), wystepy: o.wystepy.map((w, i) => ({ ...w, klipUrl: `/api/zebrra-taniec/${o.id}/klip/${i}`, link: w.gameShow?.url ?? null })),
    })), 404));
    app.get('/api/zebrra-taniec/:id/klip/:k', async (req, res) => { try { const p = T.sciezkaKlipu(await T.wczytaj(req.params.id), req.params.k); return p ? res.sendFile(p) : res.status(404).end(); } catch { return res.status(404).end(); } });
    app.get('/api/zebrra-taniec/:id/wideo', async (req, res) => { try { const s = await T.wczytaj(req.params.id); return s.plik && fsSync.existsSync(s.plik) ? res.sendFile(s.plik) : res.status(404).end(); } catch { return res.status(404).end(); } });
    app.get('/api/zebrra-taniec/:id/glos/:nr', (req, res) => T.glos(req.params.id, req.params.nr)
        .then(({ plik, kto }) => { res.set('X-Glos-Kto', kto); res.sendFile(plik); })
        .catch((e) => res.status(502).json({ success: false, message: e.message })));
    if (raw) app.post('/api/zebrra-taniec/:id/studio', raw({ type: ['video/*', 'application/octet-stream'], limit: `${maxNagraniaMb}mb` }), (req, res) => {
        const prowadzacy = String(req.query.prowadzacy ?? '').split(',').filter(Boolean);
        return odp(res, T.nagranie(req.params.id, req.body, { typ: String(req.get('content-type') || ''), prowadzacy }).then((odcinek) => ({ odcinek })));
    });
    app.post('/api/zebrra-taniec/:id/ponow', (req, res) => odp(res, T.ponow(req.params.id).then((odcinek) => ({ odcinek }))));
    app.put('/api/zebrra-taniec/:id/scenariusz', (req, res) => odp(res, T.popraw(req.params.id, req.body?.scenariusz).then((odcinek) => ({ odcinek }))));
    app.delete('/api/zebrra-taniec/:id', (req, res) => odp(res, T.usun(req.params.id).then((usuniety) => ({ usuniety }))));
}

export default { utworzZebrraTaniec, zamontujTrasyZebrraTanca, faktyWystepu, promptScenariusza, odczytajScenariusz, sprawdzLiczby, kwestieOdcinka, ktoMowiTaniec, kontekstKronikarza, liczbyFaktow, nazwaRuchu };
