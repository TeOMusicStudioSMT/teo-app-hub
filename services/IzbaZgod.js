/**
 * 📥 Izba zgód — jedna lista wszystkich ✓ Katedry (Suweren 2026-11-01: „te zatwierdzenia niech idą na StoL… bo się nam to
 * rozrasta, powoli nie ogarniam tej Kuwety”). Projekt: docs/designs/warsztat-stada.md (v2, po przeglądzie złotych rybek).
 *
 * Moduły REJESTRUJĄ źródła zamiast budować własne ekrany zgód. StoL ma jedną zakładkę „Izba Akceptacji” na `GET /api/izba`.
 * Źródło: { id, nazwa, emoji, czekajace(): Promise<Pozycja[]>, decyduj(id, akcja, { powod, lokalny }) }.
 *   - `czekajace()` to ODCZYT bez skutków ubocznych (bez kolejkowania wysyłek, bez zapisu); padło / > 3 s = wpis
 *     „🔇 nie odczytałem” zamiast wiszącego ekranu w telefonie.
 *   - Pozycja: { id, tytul, opis, kiedy, pilne?, obrazy?: string[] (ścieżki na dysku), akcje: [{ id, etykieta, zdalnie, potwierdz? }] }.
 *   - `zdalnie: false` (domyślnie) = decyzja tylko przy Katedrze — Izba NIE otwiera z telefonu tego, co Straż trzyma przy
 *     maszynie (GPU, kredyty). Z telefonu widać kartę, ✓ wtedy odmawia z powodem.
 */
import path from 'path';

export const LIMIT_ZRODLA_MS = 3000;
const zKoncem = (p, ms) => Promise.race([p, new Promise((_, nie) => setTimeout(() => nie(new Error(`brak odpowiedzi w ${ms / 1000} s`)), ms))]);

/** Pozycja źródła → kształt wspólny (przycięte teksty, domyślne akcje). */
export function oczyscPozycje(zrodlo, p) {
    const akcje = (Array.isArray(p?.akcje) && p.akcje.length ? p.akcje : [{ id: 'przyjmij', etykieta: '✓' }, { id: 'odrzuc', etykieta: '✕' }])
        .filter((a) => /^[a-z][a-z0-9-]{0,30}$/.test(String(a?.id ?? '')))
        .map((a) => ({ id: a.id, etykieta: String(a.etykieta ?? a.id).slice(0, 40), zdalnie: a.zdalnie === true, ...(a.potwierdz ? { potwierdz: String(a.potwierdz).slice(0, 300) } : {}) }));
    return {
        zrodlo: zrodlo.id, emoji: zrodlo.emoji, nazwaZrodla: zrodlo.nazwa,
        id: String(p.id), tytul: String(p.tytul ?? '').slice(0, 200), opis: String(p.opis ?? '').slice(0, 600),
        kiedy: p.kiedy ?? null, pilne: p.pilne === true, obrazy: (p.obrazy ?? []).length, akcje,
    };
}

export function utworzIzbe({ limitMs = LIMIT_ZRODLA_MS, szyna = null } = {}) {
    const zrodla = new Map();
    const widziane = new Set();   // klucze pozycji już ogłoszonych wieścią

    function zarejestruj(z) {
        if (!/^[a-z][a-z0-9-]{1,30}$/.test(String(z?.id ?? '')) || typeof z.czekajace !== 'function' || typeof z.decyduj !== 'function') throw new Error('Źródło Izby: id, czekajace() i decyduj() są wymagane.');
        zrodla.set(z.id, { emoji: '📌', nazwa: z.id, ...z });
    }

    async function czekajace() {
        const lista = [...zrodla.values()];
        const wyniki = await Promise.allSettled(lista.map((z) => zKoncem(Promise.resolve().then(() => z.czekajace()), limitMs)));
        const pozycje = [], nieOdczytane = [], liczby = {};
        wyniki.forEach((w, i) => {
            const z = lista[i];
            if (w.status === 'rejected') { nieOdczytane.push({ zrodlo: z.id, emoji: z.emoji, nazwa: z.nazwa, powod: String(w.reason?.message ?? w.reason).slice(0, 300) }); return; }
            const ps = (Array.isArray(w.value) ? w.value : []).filter((p) => p && p.id != null).map((p) => oczyscPozycje(z, p));
            liczby[z.id] = ps.length;
            pozycje.push(...ps);
        });
        pozycje.sort((a, b) => (b.pilne - a.pilne) || String(a.kiedy ?? '').localeCompare(String(b.kiedy ?? '')));
        // 📯 nowa pozycja = jedna wieść (StoL pokaże ją robotnikiem wieści, zbiorczo co ~15 min)
        const nowe = pozycje.filter((p) => !widziane.has(`${p.zrodlo}|${p.id}`));
        for (const p of nowe) widziane.add(`${p.zrodlo}|${p.id}`);
        if (nowe.length && szyna) try { await szyna({ tresc: nowe.length === 1 ? `📥 Czeka na Twoje ✓: ${nowe[0].emoji} ${nowe[0].tytul}` : `📥 ${nowe.length} nowe sprawy czekają na Twoje ✓ (${[...new Set(nowe.map((p) => p.emoji))].join(' ')})`, ilosc: nowe.length }); } catch { /* wieść opcjonalna */ }
        return { pozycje, liczby, nieOdczytane, zrodla: lista.map((z) => ({ id: z.id, emoji: z.emoji, nazwa: z.nazwa })) };
    }

    async function pozycja(zrodloId, id) {
        const z = zrodla.get(zrodloId);
        if (!z) throw Object.assign(new Error(`Nie ma źródła „${zrodloId}”.`), { kod: 404 });
        const p = (await zKoncem(Promise.resolve().then(() => z.czekajace()), limitMs * 3)).find((x) => String(x.id) === String(id));
        if (!p) throw Object.assign(new Error('Ta sprawa już nie czeka (ktoś zdecydował albo wygasła).'), { kod: 409 });
        return { z, p };
    }

    async function decyduj(zrodloId, id, akcjaId, { powod = null, lokalny = false } = {}) {
        const { z, p } = await pozycja(zrodloId, id);
        const akcja = oczyscPozycje(z, p).akcje.find((a) => a.id === akcjaId);
        if (!akcja) throw Object.assign(new Error(`Ta sprawa nie ma akcji „${akcjaId}”.`), { kod: 400 });
        if (!lokalny && !akcja.zdalnie) throw Object.assign(new Error('Ta decyzja jest tylko przy Katedrze (koszt albo GPU) — zatwierdź w Hubie.'), { kod: 403 });
        const wynik = await z.decyduj(String(id), akcjaId, { powod: powod ? String(powod).slice(0, 500) : null, lokalny });
        widziane.delete(`${zrodloId}|${id}`);
        return { zrodlo: zrodloId, id: String(id), akcja: akcjaId, wynik: wynik ?? null };
    }

    /** Ścieżka obrazu nr `nr` pozycji (tylko z listy źródła — nic spoza). */
    async function obraz(zrodloId, id, nr) {
        const { p } = await pozycja(zrodloId, id);
        const s = (p.obrazy ?? [])[Number(nr)];
        if (!s) throw Object.assign(new Error('Nie ma takiego obrazu.'), { kod: 404 });
        return path.resolve(s);
    }

    return { zarejestruj, czekajace, decyduj, obraz, zrodla: () => [...zrodla.keys()] };
}

/**
 * Trasy. `dostep(req, res)` = sparowany telefon albo maszyna (most: `dostepStada`) — zwraca null i sam odpowiada 401.
 */
export function zamontujTrasyIzby(app, I, { dostep }) {
    const blad = (res, e) => res.status(e.kod ?? 400).json({ success: false, message: e.message });
    app.get('/api/izba', async (req, res) => {
        if (!(await dostep(req, res))) return;
        try { res.json({ success: true, ...(await I.czekajace()) }); } catch (e) { blad(res, e); }
    });
    app.get('/api/izba/obraz/:zrodlo/:id/:nr', async (req, res) => {
        if (!(await dostep(req, res))) return;
        try { res.sendFile(await I.obraz(req.params.zrodlo, req.params.id, req.params.nr)); } catch (e) { blad(res, e); }
    });
    app.post('/api/izba/:zrodlo/:id/:akcja', async (req, res) => {
        if (!(await dostep(req, res))) return;
        try { res.json({ success: true, ...(await I.decyduj(req.params.zrodlo, req.params.id, req.params.akcja, { powod: req.body?.powod, lokalny: req.lokalny === true })) }); } catch (e) { blad(res, e); }
    });
}
