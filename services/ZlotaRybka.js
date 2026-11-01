/**
 * 🐟 Złota Rybka — recenzja planu GDD BEZ kontekstu rozmowy (Suweren 2026-11-01, po google/elephant-goldfish-model:
 * „projektuj ze słoniem, recenzuj ze złotą rybką”; Apache-2.0 — wzięta METODA, plugin `egm` jest u Claude Code osobno).
 *
 * Słoń = Reżyser Gry: zna całą rozmowę z Suwerenem i dlatego zapisuje plan skrótami „przecież wiadomo”. Kodeks dostaje
 * potem JEDNO zadanie naraz i tego „wiadomo” nie ma — stąd rundy, w których modele toną (Teterhia 8.1, Obrona Rytmu).
 * Rybka dostaje TYLKO to, co dostanie Kodeks: GDD (sekcje), zadania czekające na produkcję, mapę kodu gry (WikiProjektu,
 * z kodu, bez modelu). Żadnej rozmowy, żadnych wcześniejszych rund. Pyta: czego zadanie nie mówi, a wymaga?
 *
 * Wynik = UWAGI do konkretnych zadań (id z planu, nic spoza), rodzaje z zamkniętej listy, każda z propozycją nowej treści.
 * Nic nie zmienia sama: Suweren ✓ (treść zadania podmieniona w GDD, stan bez zmian) albo ✕. Recenzja przed „Realizuj plan”,
 * nie blokuje produkcji. Jedna recenzja na projekt naraz; duch po restarcie mostu = błąd z powodem.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const RODZAJE = {
    zalozenie: 'niejawne założenie (zadanie zakłada coś, czego plan nie mówi)',
    kod: 'niezgodne z kodem gry (moduł, funkcja albo plik nie istnieje / nazywa się inaczej / jest gdzie indziej)',
    niejasne: 'niejasne kryterium (nie wiadomo, po czym poznać, że zrobione)',
    'za-duze': 'za duże na jedną rundę (podziel)',
    kolejnosc: 'zła kolejność (zależy od zadania, które jest później)',
};
export const MAX_UWAG = 20;
const LIMIT_MAPY = 12_000;

export const SYSTEM_RYBKI = `Jesteś ZŁOTĄ RYBKĄ — recenzentem planu produkcji gry, który NIE ZNA rozmowy, z której plan powstał. Widzisz tylko to, co dostanie programista (Kodeks): GDD, listę zadań i mapę istniejącego kodu. Programista dostaje JEDNO zadanie naraz, bez reszty rozmowy.
Twoja praca: dla zadań wypisz, czego programista NIE wie, a musiałby wiedzieć — niejawne założenia, nazwy modułów/funkcji, których w mapie kodu nie ma, niejasne kryteria „zrobione”, zadania za duże na jedną rundę, złą kolejność.
Zasady:
- Tylko zadania z listy, po ich numerze (Z1, Z2…). Nie wymyślaj nowych funkcji gry ani nowych zadań.
- Każda uwaga konkretna i sprawdzalna, z propozycją NOWEJ TREŚCI zadania (jedno zlecenie „dodaj…/zrób…”, które usuwa problem; wolno dopisać nazwę pliku z mapy kodu albo kryterium typu „window.__gra.x pokazuje…”).
- Zadanie bez problemu pomiń. Lepiej 3 trafne uwagi niż 15 ogólnych. Najwyżej ${MAX_UWAG}.
- Rodzaje (pole "rodzaj"): ${Object.entries(RODZAJE).map(([k, v]) => `"${k}" = ${v}`).join('; ')}.
Odpowiadasz WYŁĄCZNIE JSON-em: {"uwagi":[{"zadanie":"Z3","rodzaj":"kod","opis":"…","propozycja":"nowa treść zadania"}]}. Brak uwag = {"uwagi":[]}.`;

/** Zadania czekające na produkcję (jak w Gdd.realizuj) z numerami Z1…Zn. */
export function zadaniaDoRecenzji(g, { tylkoKamien = null } = {}) {
    const out = [];
    for (const [ik, k] of (g?.kamienie ?? []).entries()) {
        if (tylkoKamien && k.id !== tylkoKamien) continue;
        for (const z of k.zadania ?? []) if (!['gotowe', 'pominiete'].includes(z.stan)) out.push({ nr: `Z${out.length + 1}`, id: z.id, kamien: k.id, kamienTytul: k.tytul, kamienNr: ik + 1, tresc: z.tresc, klocki: (z.klocki ?? []).map((x) => x.rola).filter(Boolean) });
    }
    return out;
}

export function promptRybki({ gddTekst, zadania, mapa }) {
    const lista = zadania.map((z) => `${z.nr}. [kamień ${z.kamienNr}: ${z.kamienTytul}] ${z.tresc}${z.klocki.length ? ` (klocki: ${z.klocki.join(', ')})` : ''}`).join('\n');
    return `GDD (dokument, który zna programista):\n${gddTekst}\n\nZADANIA DO ZROBIENIA (programista dostanie je po kolei, każde osobno):\n${lista}\n\n${mapa ? mapa.slice(0, LIMIT_MAPY) : 'MAPA KODU: projekt nie ma jeszcze kodu (gra od zera) — każde zadanie musi samo powiedzieć, jakie pliki tworzy.'}`;
}

const wylowJson = (t) => { const s = String(t ?? '').replace(/<think>[\s\S]*?<\/think>/g, ''); const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; } };

/** Uwagi z odpowiedzi modelu — tylko zadania z listy, rodzaje z listy, bez pustych i dubli. */
export function odczytajUwagi(tekst, zadania) {
    const j = wylowJson(tekst);
    if (!j || !Array.isArray(j.uwagi)) return null;
    const out = [], widziane = new Set();
    for (const u of j.uwagi) {
        const nr = String(u?.zadanie ?? '').trim().toUpperCase().replace(/^(\d+)$/, 'Z$1');
        const z = zadania.find((x) => x.nr === nr);
        const rodzaj = String(u?.rodzaj ?? '').trim().toLowerCase();
        const opis = String(u?.opis ?? '').trim().slice(0, 600);
        const propozycja = String(u?.propozycja ?? '').trim().slice(0, 700);
        if (!z || !RODZAJE[rodzaj] || opis.length < 8) continue;
        const klucz = `${z.id}|${rodzaj}`;
        if (widziane.has(klucz)) continue;
        widziane.add(klucz);
        out.push({ id: `u-${crypto.randomBytes(3).toString('hex')}`, zadanie: z.id, nr: z.nr, kamien: z.kamien, tresc: z.tresc, rodzaj, opis, propozycja: propozycja.length >= 8 ? propozycja : null, decyzja: null });
        if (out.length >= MAX_UWAG) break;
    }
    return out;
}

/**
 * @param {{ katalog: string, gdd: { wczytaj: Function, zapisz: Function, jakoTekst: Function }, pisz: Function, model: () => string,
 *   mapa: (projektId: string) => Promise<string>, szyna?: { nadaj?: Function }, teraz?: () => number }} cfg
 */
export function utworzZlotaRybke(cfg) {
    const teraz = cfg.teraz ?? Date.now;
    const praca = new Map();   // projekt → obietnica
    const plik = (p) => path.join(cfg.katalog, `${p}.json`);
    const idOk = (p) => /^[a-z0-9][a-z0-9_-]{0,80}$/i.test(String(p ?? ''));
    async function czytaj(p) { try { return JSON.parse(await fs.readFile(plik(p), 'utf8')); } catch { return { projekt: p, przeglady: [] }; } }
    async function zapisz(p, s) { await fs.mkdir(cfg.katalog, { recursive: true }); await fs.writeFile(plik(p), JSON.stringify(s, null, 2)); }
    const nadaj = (tresc) => { try { cfg.szyna?.nadaj?.({ agent: 'Złota Rybka', rodzaj: 'praca', tresc })?.catch?.(() => {}); } catch { /* opcjonalna */ } };

    async function stan(p) {
        if (!idOk(p)) throw new Error('Złe id projektu.');
        const s = await czytaj(p);
        const ost = s.przeglady[0] ?? null;
        if (ost?.stan === 'trwa' && !praca.has(p)) { Object.assign(ost, { stan: 'blad', powod: 'przerwane — most wystartował od nowa w trakcie recenzji' }); await zapisz(p, s); }
        return { projekt: p, trwa: praca.has(p), ostatni: ost, rodzaje: RODZAJE };
    }

    async function przejrzyj(p, { model, tylkoKamien = null } = {}) {
        if (!idOk(p)) throw new Error('Złe id projektu.');
        if (praca.has(p)) throw new Error('Złota Rybka już czyta plan tej gry.');
        const g = await cfg.gdd.wczytaj(p);
        if (!g) throw new Error('Ten projekt nie ma GDD.');
        const zadania = zadaniaDoRecenzji(g, { tylkoKamien });
        if (!zadania.length) throw new Error('W planie nie ma zadań czekających na produkcję — nie ma czego recenzować.');
        const m = model || cfg.model();
        const przeglad = { id: `r-${crypto.randomBytes(4).toString('hex')}`, stan: 'trwa', od: new Date(teraz()).toISOString(), model: m, zadan: zadania.length, kamien: tylkoKamien, uwagi: [], powod: null };
        const s = await czytaj(p);
        s.przeglady = [przeglad, ...s.przeglady].slice(0, 10);
        await zapisz(p, s);
        const robota = (async () => {
            try {
                const mapa = await cfg.mapa(p).catch(() => '');
                const prompt = promptRybki({ gddTekst: cfg.gdd.jakoTekst(g, { zKamieniami: false }), zadania, mapa });
                let uwagi = null, surowe = '';
                for (let proba = 0; proba < 2 && uwagi === null; proba++) {
                    const odp = await cfg.pisz({ system: SYSTEM_RYBKI, prompt: proba ? `${prompt}\n\nPOPRZEDNIA ODPOWIEDŹ NIE BYŁA POPRAWNYM JSON-em {"uwagi":[…]} z numerami zadań Z1…Z${zadania.length}. Oddaj sam JSON.` : prompt, model: m, timeoutMs: 15 * 60_000 });
                    surowe = odp.tekst;
                    uwagi = odczytajUwagi(odp.tekst, zadania);
                }
                const s2 = await czytaj(p);
                const r = s2.przeglady.find((x) => x.id === przeglad.id);
                if (uwagi === null) Object.assign(r, { stan: 'blad', powod: 'model nie oddał uwag w formacie JSON (dwie próby)', surowe: String(surowe).slice(0, 2000) });
                else Object.assign(r, { stan: 'gotowe', uwagi, koniec: new Date(teraz()).toISOString() });
                await zapisz(p, s2);
                if (uwagi) nadaj(`🐟 Złota Rybka przeczytała plan „${g.tytul || p}”: ${uwagi.length ? `${uwagi.length} uwag do ${new Set(uwagi.map((u) => u.zadanie)).size} zadań` : 'bez uwag'}`);
            } catch (e) {
                const s2 = await czytaj(p);
                const r = s2.przeglady.find((x) => x.id === przeglad.id);
                if (r) Object.assign(r, { stan: 'blad', powod: e.message });
                await zapisz(p, s2);
            } finally { praca.delete(p); }
        })();
        praca.set(p, robota);
        return { przeglad, robota };
    }

    /** ✓ = treść zadania w GDD podmieniona na propozycję (albo `tresc` Suwerena); ✕ = tylko zapis decyzji. */
    async function rozstrzygnij(p, uwagaId, { decyzja, tresc } = {}) {
        if (!['przyjmij', 'odrzuc'].includes(decyzja)) throw new Error('Decyzja: przyjmij albo odrzuc.');
        const s = await czytaj(p);
        const r = s.przeglady.find((x) => x.uwagi?.some((u) => u.id === uwagaId));
        const u = r?.uwagi.find((x) => x.id === uwagaId);
        if (!u) throw new Error('Nie ma takiej uwagi.');
        if (u.decyzja) throw new Error('Ta uwaga jest już rozstrzygnięta.');
        if (decyzja === 'przyjmij') {
            const nowa = String(tresc ?? u.propozycja ?? '').trim();
            if (nowa.length < 8) throw new Error('Brak nowej treści zadania — wpisz ją albo odrzuć uwagę.');
            const g = await cfg.gdd.wczytaj(p);
            const z = g?.kamienie?.flatMap((k) => k.zadania ?? []).find((x) => x.id === u.zadanie);
            if (!z) throw new Error('Tego zadania nie ma już w planie.');
            if (z.tresc !== u.tresc) throw new Error('Treść zadania zmieniła się od recenzji — przeczytaj plan rybką jeszcze raz.');
            z.tresc = nowa.slice(0, 700);
            await cfg.gdd.zapisz(p, g);
            u.nowaTresc = z.tresc;
        }
        Object.assign(u, { decyzja, kiedy: new Date(teraz()).toISOString() });
        await zapisz(p, s);
        return u;
    }

    return { stan, przejrzyj, rozstrzygnij };
}

/** Trasy (Straż: jak reszta `/api/gdd` — maszyna Suwerena). */
export function zamontujTrasyRybki(app, R) {
    const odp = (res, pr, kod = 400) => pr.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    app.get('/api/gdd/:id/rybka', (req, res) => odp(res, R.stan(req.params.id).then((rybka) => ({ rybka }))));
    app.post('/api/gdd/:id/rybka', (req, res) => odp(res, R.przejrzyj(req.params.id, { model: req.body?.model || undefined, tylkoKamien: req.body?.kamien || null }).then(({ przeglad }) => ({ przeglad }))));
    app.post('/api/gdd/:id/rybka/:uwaga', (req, res) => odp(res, R.rozstrzygnij(req.params.id, req.params.uwaga, { decyzja: req.body?.decyzja, tresc: req.body?.tresc }).then((uwaga) => ({ uwaga }))));
}
