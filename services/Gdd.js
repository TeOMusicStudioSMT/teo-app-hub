/**
 * 📜 GDD — Game Design Document + Reżyser Gry + produkcja z planu (od 2026-09-21).
 *
 * Suweren: „panel do GDD (na wzór modułu opowieści ze Story) + panel z Reżyserem Gry +
 * ustawienia, na jakim silniku buduje; mam GDD Isometric ARPG z Gemini — zrealizuj ten plan".
 *
 * GDD żyje w projekcie gry: _OtakOs_Apki/<id>/gdd.json (Kodeks commituje je razem z kodem).
 * Sekcje jak w klasycznym GDD: wizja, mechanika, fabuła, postacie, wizual, audio, technika —
 * plus KAMIENIE MILOWE z zadaniami, bo z planu ma powstać gra, nie tylko dokument:
 *   GDD → plan (kamienie → zadania) → produkcja: zadanie po zadaniu do pętli Kodeksa
 *   (AppStudio.buduj), każde ze stanem; stop na pierwszym błędzie, reszta czeka.
 *
 * SILNIK: Katedra buduje w three.js (przeglądarka, bez instalacji). Inne silniki są na liście
 * jako CEL DOKUMENTU (GDD może być pisane pod Unity/Godot), ale produkcja mówi wprost, że
 * buduje w three.js i przepisuje rozwiązania (NavMesh → własny ruch, ScriptableObjects → JSON,
 * Cinemachine → kamera podążająca). Żadnego udawania, że Unity jest zainstalowane.
 *
 * REŻYSER GRY: rozmowa jak w Story (historia z frontu, kotwica = GDD). Reżyser może
 * PROPONOWAĆ zmiany w GDD blokiem JSON — front pokazuje propozycję, Suweren wpisuje albo nie.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { radaDlaKodeksa } from './BledyModeli.js';
import Klocki from './KlockiGry.js';

let cfg = { katalog: path.join(process.cwd(), '..', '_OtakOs_Apki'), szyna: null, appStudio: null, pisz: null, model: () => 'qwen3.5:9b', assety3d: null };
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

export const SILNIKI = {
    three:   { etykieta: 'three.js — przeglądarka (Katedra buduje)', dostepny: true,  uwaga: 'Jedyny silnik, w którym Kodeks naprawdę buduje i testuje (puppeteer).' },
    babylon: { etykieta: 'Babylon.js — przeglądarka',                 dostepny: false, uwaga: 'Nie ma szablonu ani zależności w Katedrze. Produkcja zbuduje w three.js.' },
    godot:   { etykieta: 'Godot 4',                                    dostepny: false, uwaga: 'Wymaga Godot + .NET/C#; nie zainstalowane. GDD może być pod Godot, produkcja idzie w three.js.' },
    unity:   { etykieta: 'Unity',                                      dostepny: false, uwaga: 'Nie zainstalowane. GDD z Unity zostaje dokumentem; produkcja przepisuje rozwiązania na three.js.' },
};
const SEKCJE = ['wizja', 'mechanika', 'fabula', 'postacie', 'wizual', 'audio', 'technika'];
const ETYKIETY = { wizja: 'Wizja i koncepcja', mechanika: 'Mechanika rozgrywki', fabula: 'Fabuła i quest', postacie: 'Postacie', wizual: 'Aspekty wizualne', audio: 'Dźwięk i muzyka', technika: 'Kwestie techniczne' };

const idOk = (id) => /^[a-z0-9-]{2,48}$/.test(String(id || ''));
const plik = (id) => path.join(cfg.katalog, id, 'gdd.json');
const noweId = (p) => `${p}-${crypto.randomBytes(3).toString('hex')}`;

function puste(tytul = '') {
    return { wersja: 1, tytul, gatunek: '', silnik: 'three', perspektywa: '', platformy: ['przeglądarka'], sekcje: Object.fromEntries(SEKCJE.map((s) => [s, ''])), kamienie: [], galezie: [], historia: [], zrodlo: null, zmieniono: null };
}

/**
 * 🌳 GAŁĘZIE ŚWIATA (Suweren 2026-10-06: „propozycje przypisane do gałęzi kategorii świata gry”) — kategorie, z których
 * Pracownia obrazów i Assety 3D biorą propozycje: postacie, stwory, ekwipunek, krainy… Każda propozycja = opis + styl obrazu.
 */
const STYLE_GALEZI = ['pojedynczy', 'zestaw', 'postac', 'krajobraz'];
export function oczyscGalezie(lista) {
    if (!Array.isArray(lista)) return [];
    const widziane = new Set();
    return lista.slice(0, 16).map((g) => {
        const nazwa = String(g?.nazwa || '').trim().slice(0, 60);
        let id = String(g?.id || nazwa).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
        if (!id || widziane.has(id)) return null;
        widziane.add(id);
        return {
            id, nazwa: nazwa || id, opis: String(g?.opis || '').slice(0, 400),
            propozycje: (Array.isArray(g?.propozycje) ? g.propozycje : []).slice(0, 12).map((p) => (typeof p === 'string' ? { opis: p, styl: 'pojedynczy' } : p))
                .map((p) => ({ opis: String(p?.opis || '').trim().slice(0, 600), styl: STYLE_GALEZI.includes(p?.styl) ? p.styl : 'pojedynczy' })).filter((p) => p.opis),
        };
    }).filter(Boolean);
}
// 'klocki' = czeka na klocek (obraz/bryłę z warsztatu Katedry) — patrz services/KlockiGry.js.
const STANY_ZADANIA = ['czeka', 'trwa', 'gotowe', 'blad', 'pominiete', 'klocki'];
/** Klocki i zgoda na zastępcze — tylko gdy są (zadania bez nich zostają jak dawniej). */
function klockiZadania(z) {
    const out = {};
    const k = Klocki.oczyscKlocki(z?.klocki);
    if (k) out.klocki = k;
    if (z?.zastepcze === true) out.zastepcze = true;
    return out;
}
function oczysc(g, stare = puste()) {
    const out = { ...stare };
    for (const k of ['tytul', 'gatunek', 'perspektywa']) if (typeof g[k] === 'string') out[k] = g[k].slice(0, 200);
    if (g.silnik && SILNIKI[g.silnik]) out.silnik = g.silnik;
    if (Array.isArray(g.platformy)) out.platformy = g.platformy.map(String).slice(0, 6);
    if (g.sekcje && typeof g.sekcje === 'object') for (const s of SEKCJE) if (typeof g.sekcje[s] === 'string') out.sekcje[s] = g.sekcje[s].slice(0, 6000);
    if (Array.isArray(g.kamienie)) out.kamienie = g.kamienie.slice(0, 12).map((k, i) => ({
        id: idOk(String(k.id || '')) ? k.id : noweId('km'), tytul: String(k.tytul || `Kamień ${i + 1}`).slice(0, 120), opis: String(k.opis || '').slice(0, 600),
        zadania: (Array.isArray(k.zadania) ? k.zadania : []).slice(0, 6).map((z) => typeof z === 'string' ? { id: noweId('zd'), tresc: z.slice(0, 700), stan: 'czeka' } : { id: idOk(String(z.id || '')) ? z.id : noweId('zd'), tresc: String(z.tresc || '').slice(0, 700), stan: STANY_ZADANIA.includes(z.stan) ? z.stan : 'czeka', zadanieId: z.zadanieId ?? null, kiedy: z.kiedy ?? null, uwaga: z.uwaga ? String(z.uwaga).slice(0, 300) : null, ...klockiZadania(z) }),
    }));
    if (Array.isArray(g.galezie)) out.galezie = oczyscGalezie(g.galezie);
    if (typeof g.zrodlo === 'string') out.zrodlo = g.zrodlo.slice(0, 200);
    out.zmieniono = new Date().toISOString();
    return out;
}

export async function wczytaj(projektId) {
    if (!idOk(projektId)) return null;
    try { return JSON.parse(await fs.readFile(plik(projektId), 'utf8')); } catch { return null; }
}
export async function zapisz(projektId, g) {
    if (!idOk(projektId) || !fsSync.existsSync(path.join(cfg.katalog, projektId))) throw new Error('Nie ma takiego projektu gry.');
    const stare = (await wczytaj(projektId)) ?? puste();
    const nowe = oczysc(g ?? {}, stare);
    nowe.historia = stare.historia ?? [];
    await fs.writeFile(plik(projektId), JSON.stringify(nowe, null, 2), 'utf8');
    return nowe;
}
export async function zapewnij(projektId, tytul) {
    return (await wczytaj(projektId)) ?? zapisz(projektId, puste(tytul));
}

/** Tekst GDD do promptu — zwięzły, żeby zmieścić się w 16k kontekstu obok kodu. */
export function jakoTekst(g, { zKamieniami = true, zId = false } = {}) {
    const linie = [`TYTUŁ: ${g.tytul || '—'} · GATUNEK: ${g.gatunek || '—'} · SILNIK DOKUMENTU: ${g.silnik} · PERSPEKTYWA: ${g.perspektywa || '—'} · PLATFORMY: ${(g.platformy || []).join(', ') || '—'}`];
    for (const s of SEKCJE) if (g.sekcje?.[s]) linie.push(`## ${ETYKIETY[s]}\n${g.sekcje[s]}`);
    if (g.galezie?.length) linie.push('## Gałęzie świata (kategorie assetów)\n' + g.galezie.map((x) => `- ${x.nazwa}: ${x.opis}`).join('\n'));
    if (zKamieniami && g.kamienie?.length) linie.push('## Kamienie milowe\n' + g.kamienie.map((k, i) => `${i + 1}. ${zId ? `(id: ${k.id}) ` : ''}${k.tytul} — ${k.opis}\n${k.zadania.map((z) => `   - [${z.stan}] ${z.tresc}`).join('\n')}`).join('\n'));
    return linie.join('\n\n').slice(0, 14_000);
}

/**
 * JSON z małego modelu bywa UCIĘTY (zmierzone 2026-09-21: 1890 znaków, brak „]}" na końcu —
 * model skończył w połowie tablicy). Domykamy: niezamknięty string, potem nawiasy ze stosu.
 * Gdy nadal nie parsuje — null, a wołający mówi to wprost.
 */
function domknijJson(t) {
    let wStringu = false, esc = false; const stos = [];
    for (const ch of t) {
        if (wStringu) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') wStringu = false; continue; }
        if (ch === '"') wStringu = true; else if (ch === '{') stos.push('}'); else if (ch === '[') stos.push(']'); else if (ch === '}' || ch === ']') stos.pop();
    }
    let out = t.replace(/,\s*$/, '');
    if (wStringu) out += '"';
    out = out.replace(/,\s*$/, '');
    while (stos.length) out += stos.pop();
    return out;
}
export function wylowJson(tekst) {
    const surowy = String(tekst || '').replace(/\/\* UCIĘTE[^*]*\*\//g, '');
    const start = surowy.indexOf('{');
    if (start < 0) return null;
    const kandydat = surowy.slice(start).replace(/```\s*$/, '').trim();
    for (const proba of [kandydat, domknijJson(kandydat)]) { try { return JSON.parse(proba); } catch { /* następna */ } }
    return null;
}

const RAMKA_SILNIKA = `KATEDRA BUDUJE W three.js (TypeScript, przeglądarka, kamera podążająca, własna pętla z dt, kolizje z odległości, HUD w DOM, dane w JSON/TS, bez zewnętrznych assetów). Rozwiązania z Unity/Godot przepisuj na odpowiedniki: NavMesh → własny ruch/siatka; ScriptableObjects → tablice danych w TS; Cinemachine → kamera podążająca; Animator → prosta animacja skali/obrotu; Shader Graph → materiały MeshStandardMaterial; UI Toolkit → HUD w HTML.`;

/** Surowa odpowiedź modelu, gdy JSON się nie złożył — do obejrzenia, zamiast zgadywania. */
async function zapiszNieudane(projektId, etap, tekst) {
    try {
        const dir = path.join(cfg.katalog, projektId, 'nieudane');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, `gdd-${etap}-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`), String(tekst || ''), 'utf8');
    } catch { /* tylko diagnostyka */ }
}

/**
 * IMPORT: dowolny tekst (np. z PDF Gemini) → ustrukturyzowane GDD. Model dostaje sekcje i ma
 * przepisać je pod silnik docelowy; kamienie milowe = to, co da się zbudować po kolei.
 */
export async function importuj(projektId, { tekst, silnikDocelowy = 'three', model } = {}) {
    const surowy = String(tekst || '').trim();
    if (surowy.length < 100) throw new Error('Za mało tekstu, żeby z niego zrobić GDD.');
    // Dwa kroki i BEZ karty Reżysera (serialowego): zmierzone 2026-09-21 — z kartą model
    // zatytułował GDD „Katedra: Kanon Świata - Odcinek 22", a jeden JSON z sekcjami i kamieniami
    // naraz 9B urywał w połowie. Krok 1: sekcje (wierny przekład dokumentu). Krok 2: plan().
    const system = `Jesteś Reżyserem Gry. Przekuwasz cudzy dokument gry w ustrukturyzowane GDD — WIERNIE: tytuł, gatunek, perspektywa, mechaniki i fabuła z DOKUMENTU (nie wymyślasz własnej historii; gdy dokument nie ma tytułu, użyj gatunku). ${silnikDocelowy === 'three' ? RAMKA_SILNIKA : ''}
Odpowiadasz WYŁĄCZNIE JSON-em po polsku, bez komentarzy:
{"tytul":"…","gatunek":"…","perspektywa":"…","platformy":["…"],"sekcje":{"wizja":"…","mechanika":"…","fabula":"…","postacie":"…","wizual":"…","audio":"…","technika":"…"}}
Sekcje: 3–6 zdań każda, konkretnie, bez lania wody. Sekcja „technika" ma wprost mówić o silniku docelowym i co przepisano z oryginału.`;
    const odp = await cfg.pisz({ system, prompt: `DOKUMENT ŹRÓDŁOWY:\n${surowy.slice(0, 12_000)}\n\nSILNIK DOCELOWY: ${SILNIKI[silnikDocelowy]?.etykieta ?? silnikDocelowy}`, model: model || cfg.model(), timeoutMs: 15 * 60_000 });
    const j = wylowJson(odp.tekst);
    if (!j || !j.sekcje) {
        await zapiszNieudane(projektId, 'import', odp.tekst);
        throw new Error('Model nie oddał poprawnego GDD (JSON). Surowa odpowiedź w nieudane/. Spróbuj ponownie albo innym modelem.');
    }
    delete j.kamienie;
    await zapisz(projektId, { ...j, silnik: silnikDocelowy, zrodlo: `import ${new Date().toISOString().slice(0, 10)}` });
    const g = await plan(projektId, { model, odNowa: true }).catch(async (e) => { await cfg.szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: 'ostrzezenie', tresc: `GDD „${j.tytul}" zaimportowane, ale plan się nie udał: ${e.message}`, dane: { projekt: projektId } }).catch(() => {}); return wczytaj(projektId); });
    await cfg.szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: 'praca', tresc: `GDD „${g.tytul}" zaimportowane do „${projektId}": ${g.kamienie.length} kamieni, ${g.kamienie.reduce((s, k) => s + k.zadania.length, 0)} zadań`, dane: { projekt: projektId } }).catch(() => {});
    return g;
}

/** PLAN: kamienie milowe z sekcji GDD (gdy ich nie ma albo Suweren chce od nowa). */
export async function plan(projektId, { model, odNowa = false } = {}) {
    const g = await wczytaj(projektId);
    if (!g) throw new Error('Ten projekt nie ma GDD.');
    if (g.kamienie?.length && !odNowa) return g;
    // Plan zna KLOCKI (Suweren 2026-10-07: „każą budować z lego, a klocków jeszcze nie ma").
    const kat = await katalogKlockow(projektId);
    const system = `Jesteś Reżyserem Gry. Z GDD układasz PLAN PRODUKCJI dla programisty (Kodeks), który buduje w three.js i dostaje zadania PO KOLEI, każde na osobną rundę. ${RAMKA_SILNIKA}
${ZASADA_KLOCKOW}
Odpowiadasz WYŁĄCZNIE JSON-em, bez komentarzy: {"kamienie":[{"tytul":"…","opis":"…","zadania":[{"tresc":"jedno konkretne zlecenie","klocki":[{"rola":"…","klocek":"K3"},{"rola":"…","brak":"opis obrazu do Pracowni"}]}]}]}
Kamieni DOKŁADNIE 5, w kolejności budowania (najpierw to, na czym stoi reszta: ruch gracza + kamera + świat; potem wrogowie/walka lub główna pętla; potem statystyki/przedmioty; potem HUD/menu; na końcu poziom/fabuła). Zadań DOKŁADNIE 2 na kamień, każde jako JEDNO zlecenie („dodaj…", „zrób…"), wykonalne w jednej rundzie i sprawdzalne po WSAD/spacji/kliknięciu (co ma pokazać HUD albo window.__gra).`;
    const odp = await cfg.pisz({ system, prompt: `GDD:\n${jakoTekst(g, { zKamieniami: false })}\n\n${Klocki.katalogJakoTekst(kat)}`, model: model || cfg.model(), timeoutMs: 15 * 60_000 });
    const j = wylowJson(odp.tekst);
    if (!j?.kamienie?.length) { await zapiszNieudane(projektId, 'plan', odp.tekst); throw new Error('Model nie oddał planu (JSON z kamieniami). Surowa odpowiedź w nieudane/.'); }
    for (const k of j.kamienie) if (Array.isArray(k?.zadania)) k.zadania = k.zadania.map((z) => (z && typeof z === 'object' ? { tresc: z.tresc, klocki: Klocki.klockiZOdpowiedzi(z.klocki, kat) } : z));
    return zapisz(projektId, { kamienie: j.kamienie });
}

const ZASADA_KLOCKOW = `KLOCKI: do każdego zadania dopisz "klocki" — rzeczy z warsztatu Suwerena, których zadanie potrzebuje, z ROLĄ w grze (np. "wróg Szumak", "NPC Kustosz", "nagroda — Nuta Sosu"). Bierz je z KATALOGU po numerze ("klocek":"K7"). Gdy zadanie potrzebuje postaci, stwora, przedmiotu albo budowli, której w katalogu NIE ma — wpisz {"rola":"…","brak":"krótki opis obrazu do narysowania w Pracowni"}. Zadania czysto kodowe (HUD, zapis, rytm, okno, mechanika) mają "klocki": []. Nie przypisuj klocków „na zapas".`;

/** Katalog klocków projektu (pusty, gdy most nie podał Assetów 3D). */
export async function katalogKlockow(projektId) {
    return cfg.assety3d ? Klocki.katalog(projektId, { assety3d: cfg.assety3d }) : [];
}

/**
 * DOBÓR KLOCKÓW do istniejącego planu — bez przepisywania zadań i bez ruszania ich stanu.
 * Planista dostaje zadania (nie gotowe, nie pominięte) i katalog; oddaje klocki per id zadania.
 */
export async function dobierzKlocki(projektId, { model } = {}) {
    const g = await wczytaj(projektId);
    if (!g?.kamienie?.length) throw new Error('Najpierw plan z GDD — nie ma zadań, do których dobrać klocki.');
    const kat = await katalogKlockow(projektId);
    const doDoboru = g.kamienie.flatMap((k) => k.zadania.filter((z) => z.stan !== 'gotowe' && z.stan !== 'pominiete').map((z) => ({ k, z })));
    if (!doDoboru.length) throw new Error('Wszystkie zadania są gotowe albo pominięte.');
    const system = `Jesteś Reżyserem Gry. Do zadań planu produkcji dobierasz KLOCKI z warsztatu Suwerena. ${ZASADA_KLOCKOW}
Odpowiadasz WYŁĄCZNIE JSON-em: {"zadania":[{"id":"zd-…","klocki":[…]}]} — każde zadanie z listy, z jego id.`;
    const lista = doDoboru.map(({ k, z }) => `- id ${z.id} (kamień „${k.tytul}”): ${z.tresc}`).join('\n');
    const odp = await cfg.pisz({ system, prompt: `GDD (skrót):\n${jakoTekst(g, { zKamieniami: false }).slice(0, 6000)}\n\n${Klocki.katalogJakoTekst(kat)}\n\nZADANIA:\n${lista}`, model: model || cfg.model(), timeoutMs: 15 * 60_000 });
    const j = wylowJson(odp.tekst);
    if (!Array.isArray(j?.zadania)) { await zapiszNieudane(projektId, 'klocki', odp.tekst); throw new Error('Model nie oddał doboru klocków (JSON). Surowa odpowiedź w nieudane/.'); }
    let dobrane = 0;
    const g2 = await wczytaj(projektId);
    for (const w of j.zadania) {
        const zd = g2.kamienie.flatMap((k) => k.zadania).find((z) => z.id === w?.id);
        if (!zd || zd.stan === 'gotowe' || zd.stan === 'pominiete') continue;
        zd.klocki = Klocki.klockiZOdpowiedzi(w.klocki, kat);
        if (zd.stan === 'klocki') zd.stan = 'czeka';   // nowy dobór — produkcja sprawdzi od nowa
        dobrane++;
    }
    g2.zmieniono = new Date().toISOString();
    await fs.writeFile(plik(projektId), JSON.stringify(g2, null, 2), 'utf8');
    return { gdd: g2, dobrane, model: odp.model ?? (model || cfg.model()) };
}

/** Zmiana jednego zadania z frontu: klocki (ręcznie) albo zgoda na bryły zastępcze. */
export async function ustawZadanie(projektId, zadanieId, { klocki, zastepcze } = {}) {
    const g = await wczytaj(projektId);
    const zd = g?.kamienie?.flatMap((k) => k.zadania).find((z) => z.id === zadanieId);
    if (!zd) throw new Error('Nie ma takiego zadania w planie.');
    if (klocki !== undefined) zd.klocki = Klocki.oczyscKlocki(klocki) ?? [];
    if (zastepcze !== undefined) { if (zastepcze) zd.zastepcze = true; else delete zd.zastepcze; }
    if (zd.stan === 'klocki') zd.stan = 'czeka';
    g.zmieniono = new Date().toISOString();
    await fs.writeFile(plik(projektId), JSON.stringify(g, null, 2), 'utf8');
    return g;
}

/** Stan klocków każdego zadania względem świeżego katalogu — dla frontu. */
export async function stanKlockow(projektId) {
    const g = await wczytaj(projektId);
    const kat = await katalogKlockow(projektId);
    const zadania = {};
    for (const zd of g?.kamienie?.flatMap((k) => k.zadania) ?? []) if (Array.isArray(zd.klocki)) zadania[zd.id] = Klocki.rozwiaz(zd.klocki, kat);
    return { katalog: kat, zadania };
}

/**
 * Propozycja kamieni od Reżysera → pełna lista kamieni do zapisu. Kamienie spoza propozycji
 * zostają bez zmian; w zmienianym kamieniu zadanie o tej samej treści zachowuje id i stan,
 * nowe dostają 'czeka'. Kamień bez znanego id = nowy, na końcu.
 */
export function scalKamienie(obecne, proponowane) {
    const norm = (t) => String(t || '').trim().toLowerCase();
    const wynik = obecne.map((k) => ({ ...k, zadania: k.zadania.map((z) => ({ ...z })) }));
    for (const pk of Array.isArray(proponowane) ? proponowane : []) {
        // model przepisuje zadania z planu razem ze znacznikiem „[gotowe] " — zdejmujemy go, żeby dopasować po treści
        const zadaniaProp = (Array.isArray(pk.zadania) ? pk.zadania : []).map((z) => typeof z === 'string' ? z : z?.tresc).filter(Boolean).map((t) => String(t).replace(/^\s*\[(czeka|trwa|gotowe|blad|pominiete)\]\s*/i, '').trim());
        const istn = wynik.find((k) => k.id === pk.id) ?? wynik.find((k) => norm(k.tytul) === norm(pk.tytul));
        if (!istn) { wynik.push({ tytul: pk.tytul, opis: pk.opis, zadania: zadaniaProp }); continue; }
        if (typeof pk.tytul === 'string' && pk.tytul.trim()) istn.tytul = pk.tytul;
        if (typeof pk.opis === 'string' && pk.opis.trim()) istn.opis = pk.opis;
        if (zadaniaProp.length) istn.zadania = zadaniaProp.map((t) => istn.zadania.find((z) => norm(z.tresc) === norm(t)) ?? { tresc: t, stan: 'czeka' });
    }
    return wynik;
}

/**
 * ROZMOWA Z REŻYSEREM GRY — jak w Pokoju Opowieści: historia z frontu, kotwica = GDD.
 * Reżyser może dodać blok PROPOZYCJA_GDD: {"sekcje":{…}} — front pokaże „Wpisz do GDD".
 */
export async function rozmowa(projektId, { wypowiedz, historia = [], model } = {}) {
    const g = (await wczytaj(projektId)) ?? puste();
    const tresc = String(wypowiedz || '').trim();
    if (tresc.length < 2) throw new Error('Pusta wypowiedź.');
    // Bez karty Reżysera serialu (patrz importuj) — tu ma być reżyser GRY. Może proponować też
    // zmiany w PLANIE: podać kamień po id z nową listą zadań (Suweren 2026-09-22: „rozbij ostatni
    // kamień na mniejsze zadania"). Zadania gotowe zostają — front dopasowuje po treści.
    const system = `Jesteś Reżyserem Gry — rozmawiasz z Suwerenem o JEGO grze i pilnujesz GDD oraz planu produkcji (kamienie milowe → zadania dla programisty Kodeksa, lokalny model 9B, jedno zadanie = jedna runda ≤ 20 min, więc zadania mają być MAŁE i sprawdzalne). Mówisz po polsku, konkretnie, 2–6 zdań; zadajesz jedno pytanie naraz, gdy czegoś brakuje. ${RAMKA_SILNIKA}
Gdy ustalicie coś, co powinno trafić do dokumentu albo planu, dopisz na końcu odpowiedzi blok (poprawny JSON, nic po nim):
PROPOZYCJA_GDD: {"sekcje":{"mechanika":"pełna nowa treść sekcji"}, "tytul":"…", "kamienie":[{"id":"km-…","tytul":"…","opis":"…","zadania":["zadanie 1","zadanie 2"]}]}
Zasady: tylko pola, które się zmieniają; treść sekcji w całości; w "kamienie" podajesz TYLKO kamienie, które zmieniasz, z ich id z planu i PEŁNĄ nową listą zadań tego kamienia — zadania oznaczone [gotowe] przepisz dosłownie, żeby nie zgubić ich stanu. Bez propozycji, gdy nic nie ustalono.`;
    const dialog = historia.slice(-12).map((h) => `${h.kto === 'suweren' ? 'Suweren' : 'Reżyser'}: ${String(h.tresc).slice(0, 800)}`).join('\n');
    const odp = await cfg.pisz({ system, prompt: `GDD (kotwica — nie wymyślaj wbrew niemu):\n${jakoTekst(g, { zId: true })}\n\nROZMOWA:\n${dialog}\nSuweren: ${tresc}\nReżyser:`, model: model || cfg.model(), timeoutMs: 10 * 60_000 });
    let odpowiedz = odp.tekst.trim();
    let propozycja = null;
    const m = odpowiedz.match(/PROPOZYCJA_GDD:\s*(\{[\s\S]*\})\s*$/);
    if (m) { try { propozycja = JSON.parse(m[1]); odpowiedz = odpowiedz.slice(0, m.index).trim(); } catch { try { propozycja = JSON.parse(domknijJson(m[1])); odpowiedz = odpowiedz.slice(0, m.index).trim(); } catch { /* zostawiamy w tekście */ } } }
    if (propozycja?.kamienie) propozycja.kamienie = scalKamienie(g.kamienie ?? [], propozycja.kamienie);
    const wpisy = [{ kiedy: new Date().toISOString(), kto: 'suweren', tresc }, { kiedy: new Date().toISOString(), kto: 'rezyser', tresc: odpowiedz }];
    if (fsSync.existsSync(path.join(cfg.katalog, projektId))) { g.historia = [...(g.historia ?? []), ...wpisy].slice(-200); await fs.writeFile(plik(projektId), JSON.stringify(g, null, 2), 'utf8'); }
    return { odpowiedz, propozycja, model: odp.model ?? (model || cfg.model()) };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUKCJA — zadanie po zadaniu do Kodeksa, w tle; stop na pierwszym błędzie
// ─────────────────────────────────────────────────────────────────────────────
const produkcje = new Map();   // projektId → { stan, biezace, od, kroki[], zrobione, padlo }

export function produkcja(projektId) { return produkcje.get(projektId) ?? null; }
export function przerwij(projektId) { const p = produkcje.get(projektId); if (p && p.stan === 'trwa') { p.przerwij = true; return true; } return false; }

/**
 * Lista zapasowych modeli produkcji (Suweren 2026-10-06: „nie umie innych spróbować… może Dyrygent do tego nie dobiera”):
 * bez dubli i bez głównego, najwyżej 3. Zadanie, które padło na modelu, próbuje następny z listy; model, który
 * zadanie zrobił, prowadzi dalej (nie męczymy martwego modelu przy każdym zadaniu).
 */
export function listaZapasowych(glowny, zapasowe) {
    const out = [];
    for (const m of Array.isArray(zapasowe) ? zapasowe : []) {
        const n = String(m ?? '').trim();
        if (n && n !== glowny && !out.includes(n)) out.push(n);
    }
    return out.slice(0, 3);
}

export async function realizuj(projektId, { model, zapasowe = [], tylkoKamien = null } = {}) {
    const g = await wczytaj(projektId);
    if (!g) throw new Error('Ten projekt nie ma GDD.');
    if (!g.kamienie?.length) throw new Error('GDD nie ma planu — najpierw „Plan z GDD".');
    if (produkcje.get(projektId)?.stan === 'trwa') throw new Error('Produkcja tego projektu już trwa.');
    if (!cfg.appStudio) throw new Error('AppStudio niepodpięte.');
    // „trwa” bez żywej produkcji w pamięci = duch po restarcie mostu (2026-10-07: zadanie Teterhii
    // wisiało „trwa” od wczoraj i żadna produkcja go już nie brała) — wraca do kolejki.
    // „klocki” = czekało na klocek — sprawdzamy od nowa, może Suweren go już dorobił.
    const doZrobienia = (z) => z.stan === 'czeka' || z.stan === 'blad' || z.stan === 'trwa' || z.stan === 'klocki';
    const kolejka = g.kamienie.filter((k) => !tylkoKamien || k.id === tylkoKamien).flatMap((k) => k.zadania.filter(doZrobienia).map((z) => ({ kamien: k, zadanie: z })));
    if (!kolejka.length) throw new Error('Nic nie czeka — wszystkie zadania planu są gotowe albo pominięte.');
    const prod = { stan: 'trwa', od: new Date().toISOString(), biezace: null, kroki: [], zrobione: 0, padlo: 0, naKlocki: 0, razem: kolejka.length, przerwij: false, model: model || cfg.model(), zapasowe: [] };
    prod.zapasowe = listaZapasowych(prod.model, zapasowe);
    produkcje.set(projektId, prod);
    const krok = (t) => { prod.kroki.push({ kiedy: new Date().toISOString(), tekst: String(t).slice(0, 400) }); if (prod.kroki.length > 200) prod.kroki.shift(); };
    await cfg.szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: 'praca', tresc: `produkcja „${projektId}": ${kolejka.length} zadań z planu GDD → Kodeks`, dane: { projekt: projektId } }).catch(() => {});

    (async () => {
        for (const { kamien, zadanie } of kolejka) {
            if (prod.przerwij) { krok('przerwano na życzenie Suwerena'); break; }
            const gAkt = await wczytaj(projektId);
            const km = gAkt.kamienie.find((k) => k.id === kamien.id); const zd = km?.zadania.find((z) => z.id === zadanie.id);
            if (!zd) continue;
            prod.biezace = { kamien: km.tytul, zadanie: zd.tresc };
            krok(`▶ ${km.tytul}: ${zd.tresc.slice(0, 120)}`);
            // 🧱 KLOCKI: brakujący klocek = zadanie nie idzie do Kodeksa (chyba że Suweren pozwolił na zastępcze);
            // bryła gotowa w Assetach 3D sama trafia do gry. Zadanie bez pola klocki = dawne zachowanie.
            let blokKlockow;
            if (Array.isArray(zd.klocki)) {
                const kat = await katalogKlockow(projektId);
                const r = Klocki.rozwiaz(zd.klocki, kat);
                for (const d of r.doGry) {
                    try {
                        const w = await cfg.assety3d.doGry(d.bryla, projektId);
                        r.gotowe.push({ rola: d.rola, plik: path.posix.basename(w.plik), opis: d.opis });
                        krok(`📦 ${d.rola}: bryła z Assetów 3D dołożona do gry (${w.plik})`);
                    } catch (e) { r.braki.push({ rola: d.rola, co: 'bryla', opis: `${d.opis} (do gry nie weszła: ${e.message})` }); }
                }
                if (r.braki.length && !zd.zastepcze) {
                    zd.stan = 'klocki'; zd.uwaga = `🧱 brakuje: ${Klocki.opisBrakow(r.braki)}`.slice(0, 300); zd.kiedy = new Date().toISOString();
                    await fs.writeFile(plik(projektId), JSON.stringify(gAkt, null, 2), 'utf8');
                    prod.naKlocki++;
                    krok(`🧱 czeka na klocek — ${Klocki.opisBrakow(r.braki)}. Idę do następnego zadania.`);
                    continue;
                }
                blokKlockow = Klocki.blokKodeksa(r.gotowe, zd.zastepcze ? r.braki : [], r.koncepty);
            }
            zd.stan = 'trwa'; zd.kiedy = new Date().toISOString();
            await fs.writeFile(plik(projektId), JSON.stringify(gAkt, null, 2), 'utf8');
            const kontekst = `KONTEKST Z GDD (trzymaj się go): ${gAkt.tytul} — ${gAkt.gatunek}. Kamień milowy: ${km.tytul} — ${km.opis}.\nZADANIE: ${zd.tresc}`;
            const sprobuj = async (m) => {
                try {
                    const z = await cfg.appStudio.buduj(projektId, { zadanie: kontekst, model: m, blokKlockow });
                    zd.zadanieId = z.id;
                    for (;;) {
                        await new Promise((r) => setTimeout(r, cfg.odstepSondazuMs ?? 10_000));
                        const s = cfg.appStudio.zadanie(z.id);
                        if (!s) return { ok: false, powod: 'zadanie zniknęło (restart mostu?)' };
                        if (s.stan !== 'trwa') return s.wynik ?? { ok: s.stan === 'gotowe' };
                    }
                } catch (e) { return { ok: false, powod: e.message }; }
            };
            const lancuch = [prod.model, ...prod.zapasowe.filter((m) => m !== prod.model)];
            let wynik = null; let modelZadania = prod.model;
            for (let i = 0; i < lancuch.length; i++) {
                modelZadania = lancuch[i];
                if (i > 0) {
                    if (prod.przerwij) break;
                    krok(`↻ ${lancuch[i - 1]} nie dał rady (${String(wynik?.powod || '').slice(0, 120)}) — próbuję zapasowym: ${modelZadania}`);
                }
                wynik = await sprobuj(modelZadania);
                if (wynik?.ok) break;
            }
            if (wynik?.ok && modelZadania !== prod.model) { krok(`⇢ dalej prowadzi ${modelZadania} (zrobił zadanie, na którym ${prod.model} padł)`); prod.model = modelZadania; }
            const g2 = await wczytaj(projektId);
            const zd2 = g2.kamienie.find((k) => k.id === kamien.id)?.zadania.find((z) => z.id === zadanie.id);
            if (zd2) { zd2.stan = wynik?.ok ? 'gotowe' : 'blad'; zd2.uwaga = wynik?.ok ? `${wynik.rundy ?? '?'} rund, ${wynik.sekundy ?? '?'} s${wynik.commit ? ', ' + wynik.commit : ''}` : String(wynik?.powod || 'padło').slice(0, 300); zd2.kiedy = new Date().toISOString(); }
            await fs.writeFile(plik(projektId), JSON.stringify(g2, null, 2), 'utf8');
            if (wynik?.ok) { prod.zrobione++; krok(`✓ gotowe (${wynik.rundy} rund, ${wynik.sekundy} s)`); }
            else { prod.padlo++; const rada = radaDlaKodeksa(wynik?.powod, modelZadania); krok(`✗ padło${lancuch.length > 1 ? ` na wszystkich ${lancuch.length} modelach` : ''}: ${String(wynik?.powod || '').slice(0, 200)} — zatrzymuję produkcję, reszta czeka`); if (rada) krok(`💡 ${rada}`); break; }
        }
        prod.stan = prod.padlo ? 'blad' : prod.przerwij ? 'przerwana' : 'gotowe';
        prod.biezace = null; prod.koniec = new Date().toISOString();
        if (prod.naKlocki) krok(`🧱 ${prod.naKlocki} zadań czeka na klocki — dorób je w Pracowni obrazów / Assetach 3D (albo pozwól na bryły zastępcze) i puść produkcję jeszcze raz.`);
        await cfg.szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: prod.padlo ? 'blad' : 'praca', tresc: `produkcja „${projektId}" ${prod.stan}: ${prod.zrobione}/${prod.razem} zadań gotowych${prod.padlo ? ', 1 padło' : ''}${prod.naKlocki ? `, ${prod.naKlocki} czeka na klocki` : ''}`, dane: { projekt: projektId } }).catch(() => {});
    })();

    return { start: true, zadan: kolejka.length, model: prod.model, zapasowe: prod.zapasowe };
}

export default { skonfiguruj, SILNIKI, oczyscGalezie, wczytaj, zapisz, zapewnij, importuj, plan, rozmowa, realizuj, listaZapasowych, produkcja, przerwij, jakoTekst, scalKamienie, katalogKlockow, dobierzKlocki, ustawZadanie, stanKlockow };
