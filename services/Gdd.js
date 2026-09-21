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
import * as Persony from './Persony.js';

let cfg = { katalog: path.join(process.cwd(), '..', '_OtakOs_Apki'), szyna: null, appStudio: null, pisz: null, model: () => 'qwen3.5:9b' };
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
    return { wersja: 1, tytul, gatunek: '', silnik: 'three', perspektywa: '', platformy: ['przeglądarka'], sekcje: Object.fromEntries(SEKCJE.map((s) => [s, ''])), kamienie: [], historia: [], zrodlo: null, zmieniono: null };
}
function oczysc(g, stare = puste()) {
    const out = { ...stare };
    for (const k of ['tytul', 'gatunek', 'perspektywa']) if (typeof g[k] === 'string') out[k] = g[k].slice(0, 200);
    if (g.silnik && SILNIKI[g.silnik]) out.silnik = g.silnik;
    if (Array.isArray(g.platformy)) out.platformy = g.platformy.map(String).slice(0, 6);
    if (g.sekcje && typeof g.sekcje === 'object') for (const s of SEKCJE) if (typeof g.sekcje[s] === 'string') out.sekcje[s] = g.sekcje[s].slice(0, 6000);
    if (Array.isArray(g.kamienie)) out.kamienie = g.kamienie.slice(0, 12).map((k, i) => ({
        id: idOk(String(k.id || '')) ? k.id : noweId('km'), tytul: String(k.tytul || `Kamień ${i + 1}`).slice(0, 120), opis: String(k.opis || '').slice(0, 600),
        zadania: (Array.isArray(k.zadania) ? k.zadania : []).slice(0, 6).map((z) => typeof z === 'string' ? { id: noweId('zd'), tresc: z.slice(0, 700), stan: 'czeka' } : { id: idOk(String(z.id || '')) ? z.id : noweId('zd'), tresc: String(z.tresc || '').slice(0, 700), stan: ['czeka', 'trwa', 'gotowe', 'blad', 'pominiete'].includes(z.stan) ? z.stan : 'czeka', zadanieId: z.zadanieId ?? null, kiedy: z.kiedy ?? null, uwaga: z.uwaga ? String(z.uwaga).slice(0, 300) : null }),
    }));
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
export function jakoTekst(g, { zKamieniami = true } = {}) {
    const linie = [`TYTUŁ: ${g.tytul || '—'} · GATUNEK: ${g.gatunek || '—'} · SILNIK DOKUMENTU: ${g.silnik} · PERSPEKTYWA: ${g.perspektywa || '—'} · PLATFORMY: ${(g.platformy || []).join(', ') || '—'}`];
    for (const s of SEKCJE) if (g.sekcje?.[s]) linie.push(`## ${ETYKIETY[s]}\n${g.sekcje[s]}`);
    if (zKamieniami && g.kamienie?.length) linie.push('## Kamienie milowe\n' + g.kamienie.map((k, i) => `${i + 1}. ${k.tytul} — ${k.opis}\n${k.zadania.map((z) => `   - [${z.stan}] ${z.tresc}`).join('\n')}`).join('\n'));
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
    const system = `Jesteś Reżyserem Gry. Z GDD układasz PLAN PRODUKCJI dla programisty (Kodeks), który buduje w three.js i dostaje zadania PO KOLEI, każde na osobną rundę. ${RAMKA_SILNIKA}
Odpowiadasz WYŁĄCZNIE JSON-em, bez komentarzy: {"kamienie":[{"tytul":"…","opis":"…","zadania":["jedno konkretne zlecenie","…"]}]}
Kamieni DOKŁADNIE 5, w kolejności budowania (najpierw to, na czym stoi reszta: ruch gracza + kamera + świat; potem wrogowie/walka lub główna pętla; potem statystyki/przedmioty; potem HUD/menu; na końcu poziom/fabuła). Zadań DOKŁADNIE 2 na kamień, każde jako JEDNO zlecenie („dodaj…", „zrób…"), wykonalne w jednej rundzie i sprawdzalne po WSAD/spacji/kliknięciu (co ma pokazać HUD albo window.__gra).`;
    const odp = await cfg.pisz({ system, prompt: `GDD:\n${jakoTekst(g, { zKamieniami: false })}`, model: model || cfg.model(), timeoutMs: 15 * 60_000 });
    const j = wylowJson(odp.tekst);
    if (!j?.kamienie?.length) { await zapiszNieudane(projektId, 'plan', odp.tekst); throw new Error('Model nie oddał planu (JSON z kamieniami). Surowa odpowiedź w nieudane/.'); }
    return zapisz(projektId, { kamienie: j.kamienie });
}

/**
 * ROZMOWA Z REŻYSEREM GRY — jak w Pokoju Opowieści: historia z frontu, kotwica = GDD.
 * Reżyser może dodać blok PROPOZYCJA_GDD: {"sekcje":{…}} — front pokaże „Wpisz do GDD".
 */
export async function rozmowa(projektId, { wypowiedz, historia = [], model } = {}) {
    const g = (await wczytaj(projektId)) ?? puste();
    const tresc = String(wypowiedz || '').trim();
    if (tresc.length < 2) throw new Error('Pusta wypowiedź.');
    const rezyser = await Persony.karta('rezyser').catch(() => null);
    const system = `${rezyser ? rezyser.tresc + '\n\n' : ''}Jesteś Reżyserem Gry w Katedrze OtakOS — rozmawiasz z Suwerenem o JEGO grze i pilnujesz GDD. Mówisz po polsku, konkretnie, 2–6 zdań; zadajesz jedno pytanie naraz, gdy czegoś brakuje. ${RAMKA_SILNIKA}
Gdy ustalicie coś, co powinno trafić do dokumentu, dopisz na końcu odpowiedzi blok:
PROPOZYCJA_GDD: {"sekcje":{"mechanika":"pełna nowa treść sekcji"}, "tytul":"…"}
(tylko pola, które się zmieniają; treść sekcji w całości, nie diff). Bez propozycji, gdy nic nie ustalono.`;
    const dialog = historia.slice(-12).map((h) => `${h.kto === 'suweren' ? 'Suweren' : 'Reżyser'}: ${String(h.tresc).slice(0, 800)}`).join('\n');
    const odp = await cfg.pisz({ system, prompt: `GDD (kotwica — nie wymyślaj wbrew niemu):\n${jakoTekst(g)}\n\nROZMOWA:\n${dialog}\nSuweren: ${tresc}\nReżyser:`, model: model || cfg.model(), timeoutMs: 10 * 60_000 });
    let odpowiedz = odp.tekst.trim();
    let propozycja = null;
    const m = odpowiedz.match(/PROPOZYCJA_GDD:\s*(\{[\s\S]*\})\s*$/);
    if (m) { try { propozycja = JSON.parse(m[1]); odpowiedz = odpowiedz.slice(0, m.index).trim(); } catch { /* zostawiamy w tekście */ } }
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

export async function realizuj(projektId, { model, tylkoKamien = null } = {}) {
    const g = await wczytaj(projektId);
    if (!g) throw new Error('Ten projekt nie ma GDD.');
    if (!g.kamienie?.length) throw new Error('GDD nie ma planu — najpierw „Plan z GDD".');
    if (produkcje.get(projektId)?.stan === 'trwa') throw new Error('Produkcja tego projektu już trwa.');
    if (!cfg.appStudio) throw new Error('AppStudio niepodpięte.');
    const kolejka = g.kamienie.filter((k) => !tylkoKamien || k.id === tylkoKamien).flatMap((k) => k.zadania.filter((z) => z.stan === 'czeka' || z.stan === 'blad').map((z) => ({ kamien: k, zadanie: z })));
    if (!kolejka.length) throw new Error('Nic nie czeka — wszystkie zadania planu są gotowe albo pominięte.');
    const prod = { stan: 'trwa', od: new Date().toISOString(), biezace: null, kroki: [], zrobione: 0, padlo: 0, razem: kolejka.length, przerwij: false, model: model || cfg.model() };
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
            zd.stan = 'trwa'; zd.kiedy = new Date().toISOString();
            await fs.writeFile(plik(projektId), JSON.stringify(gAkt, null, 2), 'utf8');
            let wynik = null;
            try {
                const kontekst = `KONTEKST Z GDD (trzymaj się go): ${gAkt.tytul} — ${gAkt.gatunek}. Kamień milowy: ${km.tytul} — ${km.opis}.\nZADANIE: ${zd.tresc}`;
                const z = await cfg.appStudio.buduj(projektId, { zadanie: kontekst, model: prod.model });
                zd.zadanieId = z.id;
                for (;;) {
                    await new Promise((r) => setTimeout(r, 10_000));
                    const s = cfg.appStudio.zadanie(z.id);
                    if (!s) { wynik = { ok: false, powod: 'zadanie zniknęło (restart mostu?)' }; break; }
                    if (s.stan !== 'trwa') { wynik = s.wynik ?? { ok: s.stan === 'gotowe' }; break; }
                }
            } catch (e) { wynik = { ok: false, powod: e.message }; }
            const g2 = await wczytaj(projektId);
            const zd2 = g2.kamienie.find((k) => k.id === kamien.id)?.zadania.find((z) => z.id === zadanie.id);
            if (zd2) { zd2.stan = wynik?.ok ? 'gotowe' : 'blad'; zd2.uwaga = wynik?.ok ? `${wynik.rundy ?? '?'} rund, ${wynik.sekundy ?? '?'} s${wynik.commit ? ', ' + wynik.commit : ''}` : String(wynik?.powod || 'padło').slice(0, 300); zd2.kiedy = new Date().toISOString(); }
            await fs.writeFile(plik(projektId), JSON.stringify(g2, null, 2), 'utf8');
            if (wynik?.ok) { prod.zrobione++; krok(`✓ gotowe (${wynik.rundy} rund, ${wynik.sekundy} s)`); }
            else { prod.padlo++; krok(`✗ padło: ${String(wynik?.powod || '').slice(0, 200)} — zatrzymuję produkcję, reszta czeka`); break; }
        }
        prod.stan = prod.padlo ? 'blad' : prod.przerwij ? 'przerwana' : 'gotowe';
        prod.biezace = null; prod.koniec = new Date().toISOString();
        await cfg.szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: prod.padlo ? 'blad' : 'praca', tresc: `produkcja „${projektId}" ${prod.stan}: ${prod.zrobione}/${prod.razem} zadań gotowych${prod.padlo ? ', 1 padło' : ''}`, dane: { projekt: projektId } }).catch(() => {});
    })();

    return { start: true, zadan: kolejka.length, model: prod.model };
}

export default { skonfiguruj, SILNIKI, wczytaj, zapisz, zapewnij, importuj, plan, rozmowa, realizuj, produkcja, przerwij, jakoTekst };
