/**
 * 📱🕊️ Delegat Mobilny — TeOgochi jako przedstawiciel Suwerena w telefonie.
 *
 * Suweren (2026-09-16): „Mobilny Delegat TeOgochi na telefonie — dwukierunkowy
 * strumień audio/tekst, wywołania narzędzi mapowane na trasy mostu, przez
 * Kwantowy Tunel, a fakty z rozmów na centralną szynę".
 *
 * JAK TO CHODZI:
 *  telefon (public/delegat, przez tunel + klucz Straży)
 *    → mowa: MediaRecorder → /api/voice/transcribe (Whisper) albo SpeechRecognition w przeglądarce
 *    → tekst: POST /api/delegat/rozmowa  (SSE: narzędzie → tokeny → koniec)
 *    ← głos: /api/voice/speak (tor Katedry) albo speechSynthesis w przeglądarce
 *  most: persona profilu + PĘTLA NARZĘDZI (JSON w odpowiedzi modelu → wykonanie → dopowiedź)
 *  szyna: każda tura i każde narzędzie lądują na Szynie jako agent „Delegat·<Imię>",
 *         a Mózg Orbity w Katedrze (lib/teogochiDelegate.ts → sluchajTelefonu) czyta je
 *         ze strumienia i dopisuje do swojej pamięci jako ślady „telefon".
 *  pamięć: _OtakOs_Wymiar/delegat/rozmowy/<id>.json + fakty.json (po „podsumuj").
 *
 * NARZĘDZIA SĄ BIAŁĄ LISTĄ. Model nie dostaje „dowolnej trasy mostu" — dostaje
 * nazwane czynności z opisem argumentów. Wykonanie idzie po pętli zwrotnej
 * (127.0.0.1), czyli OMIJA Straż — dlatego lista jest wąska, a narzędzia
 * „ciężkie" (harness kodu, ręce na telefonie) wymagają żądania lokalnego albo
 * OTAKOS_TUNEL_PELNY=1. Z tunelu Delegat może: pytać stado, zapisywać fakty,
 * kolejkować muzykę i Nocną Zmianę, czytać stan Katedry.
 *
 * PROTOKÓŁ NARZĘDZI: gemma4 w Ollamie nie ma pewnego „tools" — używamy jawnego
 * JSON-a w treści: model odpowiada JEDNĄ linią {"narzedzie":"…","argumenty":{…}},
 * gdy chce coś zrobić; inaczej mówi zwyczajnie. Maks 3 narzędzia na turę.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

let cfg = {
    ollamaBase: 'http://127.0.0.1:11434',
    portMostu: 3001,
    szyna: null,
    nocna: null,
    artemis: null,
    katalog: path.join(process.cwd(), '_OtakOs_Wymiar', 'delegat'),
    model: 'gemma4:e2b',
    pelnyTunel: false,
};

export function skonfiguruj(opcje) { cfg = { ...cfg, ...opcje }; }

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE — kto reprezentuje Suwerena w telefonie
// ─────────────────────────────────────────────────────────────────────────────
// Trzy profile z katalogu gatunków (lib/teogochiGatunki.ts). Strona /delegat jest
// serwowana przez most bez katalogu z frontu, więc persona MUSI żyć tutaj.
// Trzymamy to krótko i wskazujemy `gatunek`, żeby było jasne, skąd imię i głos.

export const PROFILE = {
    joanna: {
        id: 'joanna', gatunek: 'joanna', imie: 'Joanna', emoji: '🕊️', kolor: '#a855f7',
        dziedzina: 'Muzyka i nastrój Katedry', glos: 'pl_PL-gosia-medium',
        persona: 'Jesteś Joanna — TeOgochi od muzyki, radia i nastroju Katedry OtakOS. Reprezentujesz Suwerena, gdy jest poza domem. Mówisz po polsku, ciepło i konkretnie, zdaniami do wypowiedzenia na głos (bez list, bez markdownu). Znasz się na brzmieniu, BPM, tonacjach i tekstach piosenek.',
        narzedzia: ['katedra.stan', 'szyna.pytanie', 'szyna.notatka', 'music.generate', 'music.status', 'nocna.dodaj', 'telefon.zadanie'],
    },
    kodeks: {
        id: 'kodeks', gatunek: 'kodeks', imie: 'Kodeks', emoji: '🐙', kolor: '#10b981',
        dziedzina: 'Kod Katedry', glos: null,
        persona: 'Jesteś Kodeks — TeOgochi od kodu Katedry OtakOS. Reprezentujesz Suwerena poza domem. Mówisz po polsku, rzeczowo, krótkimi zdaniami do wypowiedzenia na głos. Nie commitujesz nic sam — proponujesz i uruchamiasz harness, a decyzja należy do Suwerena.',
        narzedzia: ['katedra.stan', 'szyna.pytanie', 'szyna.notatka', 'harness.run', 'nocna.dodaj'],
    },
    spawacz: {
        id: 'spawacz', gatunek: 'spawacz', imie: 'Spawacz', emoji: '⚡', kolor: '#f97316',
        dziedzina: 'Warsztat workflow i klocki wydania', glos: null,
        persona: 'Jesteś Spawacz — TeOgochi od warsztatu: grafy ComfyUI, klocki wydania, montaż. Reprezentujesz Suwerena poza domem. Mówisz po polsku, konkretnie, jak majster — krótkie zdania na głos.',
        narzedzia: ['katedra.stan', 'szyna.pytanie', 'szyna.notatka', 'nocna.dodaj', 'telefon.zadanie'],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// NARZĘDZIA — biała lista, każde z opisem dla modelu i wykonaniem
// ─────────────────────────────────────────────────────────────────────────────

async function most(sciezka, body, ms = 60_000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        const r = await fetch(`http://127.0.0.1:${cfg.portMostu}${sciezka}`, {
            method: body ? 'POST' : 'GET', signal: ctrl.signal,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.message || `HTTP ${r.status}`);
        return d;
    } finally { clearTimeout(t); }
}

/**
 * Utwór zlecony z telefonu nikt nie „odbiera" — Music Studio robi to z przeglądarki
 * (progress → collect), a na telefonie tej pętli nie ma. Więc most sam czeka w tle:
 * co 10 s pyta ComfyUI, a gdy gotowe, przenosi plik do _OtakOs_Muzyka i melduje na
 * szynie (telefon pokazuje to w pasku, Katedra w Orbicie). Sufit 45 min — ACE liczy
 * minutę w ~1–2 min, ale za renderem WAN potrafi stać długo.
 */
const zlecenia = new Map(); // promptId → { stan, plik, tytul, od }
async function odbierzWTle({ promptId, tytul, agent }) {
    zlecenia.set(promptId, { stan: 'w-kolejce', plik: null, tytul, od: Date.now() });
    const t0 = Date.now();
    while (Date.now() - t0 < 45 * 60_000) {
        await new Promise((r) => setTimeout(r, 10_000));
        let d = null;
        try { d = await most(`/api/music/progress?promptId=${encodeURIComponent(promptId)}`); } catch { continue; }
        const z = zlecenia.get(promptId);
        if (!d?.success && (d?.stan === 'blad' || d?.stan === 'przerwane')) {
            z.stan = 'blad'; z.blad = d.message || d.stan;
            await cfg.szyna?.nadaj({ agent, rodzaj: 'blad', tresc: `utwór „${tytul}" padł w ComfyUI: ${z.blad}`, dane: { promptId } });
            return;
        }
        if (d?.stan === 'gotowe' && d.audio?.length) {
            try {
                const a = d.audio[0];
                const c = await most('/api/music/collect', { filename: a.filename, subfolder: a.subfolder, type: a.type, title: tytul });
                z.stan = 'gotowe'; z.plik = c.savedPath ?? a.filename;
                await cfg.szyna?.nadaj({ agent, rodzaj: 'praca', tresc: `utwór gotowy: „${tytul}" → ${path.basename(String(z.plik))}`, dane: { promptId, plik: z.plik } });
            } catch (e) {
                z.stan = 'blad'; z.blad = `odbiór: ${e.message}`;
                await cfg.szyna?.nadaj({ agent, rodzaj: 'blad', tresc: `utwór „${tytul}" policzony, ale odbiór padł: ${e.message}`, dane: { promptId } });
            }
            return;
        }
        if (z) z.stan = d?.stan || z.stan;
    }
    const z = zlecenia.get(promptId);
    if (z) { z.stan = 'przeterminowane'; }
    await cfg.szyna?.nadaj({ agent, rodzaj: 'blad', tresc: `utwór „${tytul}" nie policzył się w 45 min — sprawdź kolejkę ComfyUI`, dane: { promptId } });
}

export const NARZEDZIA = {
    'katedra.stan': {
        opis: 'Stan Katedry: Nocna Zmiana (co czeka/trwa), ComfyUI, ostatnie zdarzenia na szynie. Użyj, gdy Suweren pyta „co się dzieje", „co robisz", „jaki stan".',
        argumenty: {},
        ciezkie: false,
        async wykonaj() {
            const nocna = cfg.nocna ? await cfg.nocna.stanZmiany().catch(() => null) : null;
            const comfy = await fetch('http://127.0.0.1:8188/queue').then((r) => r.json()).catch(() => null);
            const szyna = cfg.szyna ? cfg.szyna.ostatnie({ ile: 8 }).map((z) => `${z.agent}: ${z.tresc.slice(0, 100)}`) : [];
            // Zdanie po ludzku na początku — model brał `wlaczona:true` za „Nocna Zmiana trwa".
            const czeka = nocna ? nocna.zadania.filter((z) => z.stan === 'czeka').length : 0;
            const opisNocnej = !nocna ? 'Nocna Zmiana niedostępna.'
                : !nocna.wlaczona ? 'Nocna Zmiana WYŁĄCZONA.'
                : nocna.trwa ? `Nocna Zmiana właśnie wykonuje: ${nocna.trwa.rodzaj}.`
                : czeka ? `Nocna Zmiana włączona, czeka na noc z ${czeka} zadaniem/ami.`
                : 'Nocna Zmiana włączona, ale nic teraz nie robi — kolejka pusta.';
            const opisComfy = !comfy ? 'ComfyUI nie odpowiada.'
                : (comfy.queue_running?.length ?? 0) ? `ComfyUI liczy ${comfy.queue_running.length} zadanie/a (kolejka: ${comfy.queue_pending?.length ?? 0}).`
                : 'ComfyUI wolne.';
            return {
                opis: `${opisNocnej} ${opisComfy}`,
                nocnaZmiana: nocna ? { wlaczona: nocna.wlaczona, trwa: nocna.trwa, zadania: nocna.zadania.map((z) => `${z.rodzaj} [${z.stan}]`) } : 'niedostępna',
                comfy: comfy ? { wToku: comfy.queue_running?.length ?? 0, wKolejce: comfy.queue_pending?.length ?? 0 } : 'nie odpowiada',
                szyna,
            };
        },
    },
    'szyna.pytanie': {
        opis: 'Zapytaj innego TeOgochi ze stada (np. Klatka, Bilans, Kodeks, Reżyser) — odpowiada jego model.',
        argumenty: { doKogo: 'imię TeOgochi', pytanie: 'treść pytania' },
        ciezkie: false,
        async wykonaj(a, ctx) {
            const d = await most('/api/szyna/pytanie', { odKogo: ctx.agent, doKogo: String(a.doKogo || 'Kodeks'), pytanie: String(a.pytanie || ''), model: ctx.model }, 300_000);
            return { odpowiedz: d.odpowiedz };
        },
    },
    'szyna.notatka': {
        opis: 'Zapisz fakt lub ustalenie z rozmowy na szynie Katedry (żeby reszta stada i Mózg Orbity to widzieli).',
        argumenty: { tresc: 'jedno zdanie — co ustalono' },
        ciezkie: false,
        async wykonaj(a, ctx) {
            await cfg.szyna?.nadaj({ agent: ctx.agent, rodzaj: 'fakt', tresc: String(a.tresc || '').slice(0, 400), dane: { rozmowaId: ctx.rozmowaId, zrodlo: 'telefon' } });
            await dopiszFakt({ delegat: ctx.profil.id, tresc: String(a.tresc || ''), rozmowaId: ctx.rozmowaId });
            return { zapisano: true };
        },
    },
    'music.generate': {
        opis: 'ZAWSZE, gdy Suweren prosi o utwór, muzykę, piosenkę, podkład, kawałek „w stylu…" — nie pytaj o zgodę, zleć od razu. Utwór liczy się w ComfyUI w tle; wraca identyfikator.',
        argumenty: { prompt: 'opis brzmienia po angielsku', duration: 'sekundy (30–120)', lyrics: 'opcjonalny tekst' },
        ciezkie: false,
        async wykonaj(a, ctx) {
            const prompt = String(a.prompt || '');
            const d = await most('/api/music/generate', { prompt, duration: Math.min(180, Math.max(10, Number(a.duration) || 60)), lyrics: String(a.lyrics || '') }, 30_000);
            const tytul = prompt.slice(0, 40) || 'Utwór z telefonu';
            odbierzWTle({ promptId: d.promptId, tytul, agent: ctx.agent }).catch(() => {});
            return { promptId: d.promptId, rodzina: d.rodzina, uwaga: 'Liczy się w tle; gdy skończy, plik trafi do _OtakOs_Muzyka, a na szynie pojawi się „utwór gotowy". Suweren może zapytać „czy utwór gotowy?" (music.status).' };
        },
    },
    'music.status': {
        opis: 'Czy utwory zlecone w tej sesji są już policzone. Użyj, gdy Suweren pyta „czy gotowe", „co z muzyką".',
        argumenty: {},
        ciezkie: false,
        async wykonaj() {
            const lista = [...zlecenia.entries()].map(([id, z]) => ({ promptId: id, tytul: z.tytul, stan: z.stan, plik: z.plik ? path.basename(String(z.plik)) : null, blad: z.blad ?? null, minut: Math.round((Date.now() - z.od) / 60_000) }));
            return lista.length ? { utwory: lista } : { utwory: [], opis: 'W tej sesji mostu nic nie zlecono.' };
        },
    },
    'nocna.dodaj': {
        opis: 'Dodaj zadanie do Nocnej Zmiany, gdy Suweren mówi „na noc", „jak będę spał", „zaplanuj" (robot z białej listy, np. "produkcja" z parametrem projekt, "lab-eksperyment", "tablica-rezysera" z parametrem serial).',
        argumenty: { rodzaj: 'nazwa robota', parametry: 'obiekt z polami robota', notatka: 'krótki opis' },
        ciezkie: false,
        async wykonaj(a) {
            if (!cfg.nocna) throw new Error('Nocna Zmiana niepodpięta.');
            const z = await cfg.nocna.dodaj({ rodzaj: String(a.rodzaj || ''), parametry: a.parametry && typeof a.parametry === 'object' ? a.parametry : {}, notatka: String(a.notatka || 'z telefonu') });
            return { id: z.id, rodzaj: z.rodzaj, stan: z.stan };
        },
    },
    'harness.run': {
        opis: 'Uruchom harness kodu (Smart-Ralph) z celem. Wraca od razu z runId; przebieg leci w tle.',
        argumenty: { goal: 'cel zmiany w kodzie' },
        ciezkie: true,
        async wykonaj(a) {
            const d = await most('/api/harness/run', { goal: String(a.goal || '') }, 30_000);
            return { runId: d.runId ?? d.id ?? null, status: d.status ?? 'uruchomiono' };
        },
    },
    'telefon.zadanie': {
        opis: 'Ręce na telefonie przy biurku (Artemis): wykonaj czynność na Androidzie podpiętym do Katedry, np. "otwórz Ustawienia i powiedz poziom baterii". Czeka do 90 s na wynik.',
        argumenty: { cel: 'co zrobić na telefonie, po angielsku lub polsku', oczekiwane: 'opcjonalnie: co ma być wynikiem' },
        ciezkie: true,
        async wykonaj(a, ctx) {
            if (!cfg.artemis) throw new Error('Artemis niepodpięty.');
            const s = await cfg.artemis.stan();
            if (!s.zywy) throw new Error(s.hint || s.blad);
            return cfg.artemis.zlecICzekaj({ cel: String(a.cel || ''), oczekiwane: a.oczekiwane ? String(a.oczekiwane) : undefined, rozmowaId: ctx.rozmowaId });
        },
    },
};

function opisNarzedzi(profil, lokalne) {
    return profil.narzedzia
        .filter((n) => NARZEDZIA[n] && (lokalne || cfg.pelnyTunel || !NARZEDZIA[n].ciezkie))
        .map((n) => `- ${n}: ${NARZEDZIA[n].opis} Argumenty: ${JSON.stringify(NARZEDZIA[n].argumenty)}`)
        .join('\n');
}

function systemPrompt(profil, lokalne) {
    const narzedzia = opisNarzedzi(profil, lokalne);
    return `${profil.persona}

Rozmawiasz z Suwerenem przez telefon — odpowiedzi są czytane na głos, więc: 1–3 zdania, bez list, bez nagłówków, bez emoji.

Masz narzędzia. Gdy CHCESZ COŚ ZROBIĆ (nie tylko powiedzieć), odpowiedz WYŁĄCZNIE jedną linią JSON, bez żadnego innego tekstu:
{"narzedzie":"<nazwa>","argumenty":{...}}
Dostępne narzędzia:
${narzedzia || '- (żadne — tylko rozmowa)'}

Po wykonaniu narzędzia dostaniesz jego wynik w wiadomości „WYNIK NARZĘDZIA" — wtedy odpowiedz Suwerenowi zwyczajnie, po polsku, jak człowiekowi. Nie wymyślaj wyników, których nie dostałeś. Jeśli narzędzie zawiodło, powiedz to wprost.

ZASADA: prośba o działanie („stwórz", „zrób", „zleć", „sprawdź", „dodaj") = narzędzie, nie obietnica. Nie mów „przygotuję", jeśli nie wywołałeś narzędzia. Gdy wypowiedź Suwerena jest bełkotem albo samymi nawiasami, powiedz krótko, że nie dosłyszałeś, i poproś o powtórzenie.`;
}

/** Wyłów JSON z wywołaniem narzędzia — tolerujemy płot ``` i śmieci wokół. */
function wylowNarzedzie(tekst) {
    const t = String(tekst || '').trim();
    const kandydaci = [t, t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()];
    const m = t.match(/\{[\s\S]*"narzedzie"[\s\S]*\}/);
    if (m) kandydaci.push(m[0]);
    for (const k of kandydaci) {
        try {
            const j = JSON.parse(k);
            if (j && typeof j.narzedzie === 'string') return { narzedzie: j.narzedzie, argumenty: j.argumenty && typeof j.argumenty === 'object' ? j.argumenty : {} };
        } catch { /* następny kandydat */ }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAMIĘĆ ROZMÓW
// ─────────────────────────────────────────────────────────────────────────────

const plikRozmowy = (id) => path.join(cfg.katalog, 'rozmowy', `${id}.json`);
const plikFaktow = () => path.join(cfg.katalog, 'fakty.json');
const bezpieczneId = (id) => /^[a-z0-9-]{6,40}$/i.test(String(id || '')) ? String(id) : null;

async function wczytajRozmowe(id) {
    try { return JSON.parse(await fs.readFile(plikRozmowy(id), 'utf8')); } catch { return null; }
}
async function zapiszRozmowe(r) {
    await fs.mkdir(path.dirname(plikRozmowy(r.id)), { recursive: true });
    await fs.writeFile(plikRozmowy(r.id), JSON.stringify(r, null, 2), 'utf8');
}
async function dopiszFakt(f) {
    let lista = [];
    try { lista = JSON.parse(await fs.readFile(plikFaktow(), 'utf8')); } catch { /* pierwszy fakt */ }
    lista.unshift({ kiedy: new Date().toISOString(), ...f });
    await fs.mkdir(cfg.katalog, { recursive: true });
    await fs.writeFile(plikFaktow(), JSON.stringify(lista.slice(0, 500), null, 2), 'utf8');
}

export async function fakty(ile = 50) {
    try { return JSON.parse(await fs.readFile(plikFaktow(), 'utf8')).slice(0, ile); } catch { return []; }
}

export async function rozmowy(ile = 30) {
    const dir = path.join(cfg.katalog, 'rozmowy');
    if (!fsSync.existsSync(dir)) return [];
    const pliki = (await fs.readdir(dir)).filter((p) => p.endsWith('.json'));
    const lista = [];
    for (const p of pliki) {
        try {
            const r = JSON.parse(await fs.readFile(path.join(dir, p), 'utf8'));
            lista.push({ id: r.id, delegat: r.delegat, od: r.od, ostatnia: r.ostatnia, tur: r.tury.length, podsumowana: !!r.podsumowanie });
        } catch { /* uszkodzony plik — pomijamy */ }
    }
    return lista.sort((a, b) => (a.ostatnia < b.ostatnia ? 1 : -1)).slice(0, ile);
}

export async function rozmowa(id) {
    const czyste = bezpieczneId(id);
    return czyste ? wczytajRozmowe(czyste) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROZMOWA — jedna tura z pętlą narzędzi; postęp przez callback (SSE na trasie)
// ─────────────────────────────────────────────────────────────────────────────

async function ollamaChat(model, messages, { strumien = false, naToken } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 300_000);
    try {
        const r = await fetch(`${cfg.ollamaBase}/api/chat`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            // think:false — qwen3.x bez tego oddaje pustą treść (zmierzone).
            body: JSON.stringify({ model, messages, stream: strumien, think: false, options: { temperature: 0.6 } }),
        });
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
        if (!strumien) return String((await r.json()).message?.content || '').trim();
        let calosc = '';
        const czytnik = r.body.getReader();
        const dek = new TextDecoder();
        let bufor = '';
        for (;;) {
            const { value, done } = await czytnik.read();
            if (done) break;
            bufor += dek.decode(value, { stream: true });
            let i;
            while ((i = bufor.indexOf('\n')) >= 0) {
                const linia = bufor.slice(0, i).trim(); bufor = bufor.slice(i + 1);
                if (!linia) continue;
                try {
                    const j = JSON.parse(linia);
                    const kawalek = j.message?.content || '';
                    if (kawalek) { calosc += kawalek; naToken?.(kawalek); }
                } catch { /* niepełna linia */ }
            }
        }
        return calosc.trim();
    } finally { clearTimeout(t); }
}

/**
 * @param {{ delegat:string, tekst:string, rozmowaId?:string, model?:string, lokalne?:boolean }} p
 * @param {(zdarzenie:object)=>void} [naZdarzenie]  — {typ:'narzedzie'|'wynik'|'token'|'koniec'|'blad', ...}
 */
export async function rozmawiaj({ delegat, tekst, rozmowaId, model, lokalne = false }, naZdarzenie = () => {}) {
    const profil = PROFILE[delegat];
    if (!profil) throw new Error(`Nie ma takiego delegata: ${delegat}. Znane: ${Object.keys(PROFILE).join(', ')}.`);
    const tresc = String(tekst || '').trim();
    if (!tresc) throw new Error('Pusta wypowiedź.');
    const silnik = model || cfg.model;
    const agent = `Delegat·${profil.imie}`;

    const id = bezpieczneId(rozmowaId) || `tel-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const r = (await wczytajRozmowe(id)) || { id, delegat: profil.id, od: new Date().toISOString(), ostatnia: null, tury: [], narzedzia: [], podsumowanie: null };
    r.tury.push({ kto: 'suweren', tresc, kiedy: new Date().toISOString() });
    await cfg.szyna?.nadaj({ agent, rodzaj: 'telefon', tresc: `Suweren: ${tresc.slice(0, 300)}`, dane: { rozmowaId: id, kto: 'suweren' } });

    const messages = [{ role: 'system', content: systemPrompt(profil, lokalne) }];
    for (const t of r.tury.slice(-12)) {
        if (t.kto === 'suweren') messages.push({ role: 'user', content: t.tresc });
        else if (t.kto === 'delegat') messages.push({ role: 'assistant', content: t.tresc });
        else if (t.kto === 'narzedzie') messages.push({ role: 'user', content: `WYNIK NARZĘDZIA ${t.narzedzie}: ${t.tresc}` });
    }

    const ctx = { agent, profil, rozmowaId: id, model: silnik };
    let odpowiedz = '';
    for (let krok = 0; krok < 4; krok++) {
        const ostatniKrok = krok === 3;
        // Najpierw bez strumienia — musimy zobaczyć całość, żeby poznać, czy to JSON narzędzia.
        const surowa = await ollamaChat(silnik, messages, { strumien: false });
        const wezwanie = ostatniKrok ? null : wylowNarzedzie(surowa);
        if (!wezwanie) {
            // Model czasem powtarza etykietę „WYNIK NARZĘDZIA …:" — na głos to śmieć, ścinamy.
            odpowiedz = (surowa.replace(/^```[\s\S]*?```$/m, '').trim() || surowa).replace(/^WYNIK NARZĘDZIA[^:\n]*:?\s*/i, '').trim() || surowa;
            // Strumień do telefonu: odpowiedź już jest, więc podajemy ją kawałkami po słowach —
            // uczciwie: to nie tokeny z modelu, ale telefon zaczyna czytać od razu.
            for (const slowo of odpowiedz.split(/(\s+)/)) if (slowo) naZdarzenie({ typ: 'token', tekst: slowo });
            break;
        }
        const nazwa = wezwanie.narzedzie;
        const n = NARZEDZIA[nazwa];
        const dozwolone = profil.narzedzia.includes(nazwa) && n && (lokalne || cfg.pelnyTunel || !n.ciezkie);
        naZdarzenie({ typ: 'narzedzie', narzedzie: nazwa, argumenty: wezwanie.argumenty });
        let wynik;
        if (!dozwolone) {
            wynik = { blad: n ? `Narzędzie ${nazwa} jest dostępne tylko z maszyny Suwerena (nie z tunelu).` : `Nie ma narzędzia ${nazwa}.` };
        } else {
            try { wynik = await n.wykonaj(wezwanie.argumenty, ctx); }
            catch (e) { wynik = { blad: e.message }; }
        }
        const wynikTekst = JSON.stringify(wynik).slice(0, 1500);
        r.tury.push({ kto: 'narzedzie', narzedzie: nazwa, argumenty: wezwanie.argumenty, tresc: wynikTekst, kiedy: new Date().toISOString() });
        r.narzedzia.push({ narzedzie: nazwa, ok: !wynik?.blad, kiedy: new Date().toISOString() });
        await cfg.szyna?.nadaj({ agent, rodzaj: wynik?.blad ? 'blad' : 'narzedzie', tresc: `${nazwa}(${JSON.stringify(wezwanie.argumenty).slice(0, 120)}) → ${wynikTekst.slice(0, 160)}`, dane: { rozmowaId: id } });
        naZdarzenie({ typ: 'wynik', narzedzie: nazwa, ok: !wynik?.blad, wynik });
        messages.push({ role: 'assistant', content: surowa });
        messages.push({ role: 'user', content: `WYNIK NARZĘDZIA ${nazwa}: ${wynikTekst}\n\nTeraz odpowiedz Suwerenowi zwyczajnie, na głos.` });
    }
    if (!odpowiedz) odpowiedz = 'Zrobione — wyniki masz w Katedrze.';

    r.tury.push({ kto: 'delegat', tresc: odpowiedz, kiedy: new Date().toISOString() });
    r.ostatnia = new Date().toISOString();
    await zapiszRozmowe(r);
    await cfg.szyna?.nadaj({ agent, rodzaj: 'telefon', tresc: `${profil.imie}: ${odpowiedz.slice(0, 300)}`, dane: { rozmowaId: id, kto: 'delegat' } });
    const wynik = { rozmowaId: id, delegat: profil.id, odpowiedz, glos: profil.glos, model: silnik };
    naZdarzenie({ typ: 'koniec', ...wynik });
    return wynik;
}

/**
 * Podsumowanie rozmowy → fakty na szynę i do fakty.json. Wołane z telefonu
 * („zakończ i zapisz") albo z Katedry. Model dostaje całą rozmowę i oddaje
 * 1 zdanie streszczenia + do 5 faktów — każdy fakt osobno na szynę.
 */
export async function podsumuj(rozmowaId, { model } = {}) {
    const id = bezpieczneId(rozmowaId);
    const r = id ? await wczytajRozmowe(id) : null;
    if (!r) throw new Error('Nie ma takiej rozmowy.');
    const profil = PROFILE[r.delegat] || PROFILE.joanna;
    const agent = `Delegat·${profil.imie}`;
    const zapis = r.tury.filter((t) => t.kto !== 'narzedzie').map((t) => `${t.kto === 'suweren' ? 'Suweren' : profil.imie}: ${t.tresc}`).join('\n');
    const surowe = await ollamaChat(model || cfg.model, [
        { role: 'system', content: 'Streszczasz rozmowę telefoniczną Suwerena z jego TeOgochi. Odpowiadasz WYŁĄCZNIE JSON-em: {"streszczenie":"jedno zdanie","fakty":["ustalenie 1","ustalenie 2"]}. Fakty to konkretne decyzje, prośby, terminy, preferencje — max 5, po polsku. Bez faktów → pusta lista.' },
        { role: 'user', content: zapis.slice(0, 8000) },
    ]);
    let j = { streszczenie: '', fakty: [] };
    try { j = JSON.parse(surowe.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()); } catch { j.streszczenie = surowe.slice(0, 300); }
    const faktyLista = Array.isArray(j.fakty) ? j.fakty.map((f) => String(f).trim()).filter(Boolean).slice(0, 5) : [];
    r.podsumowanie = { kiedy: new Date().toISOString(), streszczenie: String(j.streszczenie || '').slice(0, 400), fakty: faktyLista };
    await zapiszRozmowe(r);
    await cfg.szyna?.nadaj({ agent, rodzaj: 'podsumowanie', tresc: r.podsumowanie.streszczenie || '(bez streszczenia)', dane: { rozmowaId: id, tur: r.tury.length } });
    for (const f of faktyLista) {
        await cfg.szyna?.nadaj({ agent, rodzaj: 'fakt', tresc: f, dane: { rozmowaId: id, zrodlo: 'telefon' } });
        await dopiszFakt({ delegat: profil.id, tresc: f, rozmowaId: id });
    }
    return { rozmowaId: id, ...r.podsumowanie };
}

export function profile() {
    return Object.values(PROFILE).map(({ persona, ...p }) => ({ ...p, narzedziaZdalne: p.narzedzia.filter((n) => NARZEDZIA[n] && (cfg.pelnyTunel || !NARZEDZIA[n].ciezkie)) }));
}

export default { skonfiguruj, PROFILE, NARZEDZIA, rozmawiaj, podsumuj, profile, rozmowy, rozmowa, fakty };
