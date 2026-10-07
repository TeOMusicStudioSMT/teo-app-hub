/**
 * ☁️ Modele chmury i klucze dla mostu — Suweren 2026-10-06: „mam włączony na Hubie cloud, a w games nie widzi kluczy,
 * choć w skarbcu w Hubie są… i są wpisane nieaktualne modele”.
 *
 * Dwie przyczyny:
 *  1. Kibel Huba trzyma klucze TYLKO w przeglądarce (localStorage) — most ich nie widzi. Most czyta
 *     `_OtakOs_Wymiar/kibel_<dostawca>.txt` (ten katalog jest w .gitignore). Udostępnienie = świadomy krok
 *     Suwerena w Kiblu („🔗 Udostępnij mostowi”), cofnięcie kasuje plik. Domyślnie nic nie wychodzi z przeglądarki.
 *  2. Nazwy modeli były wpisane na sztywno (claude-sonnet-5, gemini-2.5-flash). Teraz lista z API dostawcy
 *     (Anthropic GET /v1/models, Gemini GET v1beta/models) — z kluczem, schowek 10 min; bez klucza/sieci = zapas.
 */
import fs from 'fs/promises';
import path from 'path';

export const DOSTAWCY = {
    anthropic: { plik: 'kibel_anthropic.txt', wzor: /^sk-ant-[A-Za-z0-9_-]{20,}$/, nazwa: 'Anthropic (Claude)' },
    gemini: { plik: 'kibel_gemini.txt', wzor: /^(AIza[A-Za-z0-9_-]{30,}|AQ\.[A-Za-z0-9_-]{30,})$/, nazwa: 'Google (Gemini)' },
};

/** Zapas, gdy nie da się zapytać API (brak klucza, brak sieci). Pierwszy = polecany do kodu. */
export const ZAPAS = {
    anthropic: [
        { model: 'claude-sonnet-5-5', nazwa: 'Claude Sonnet 5.5' },
        { model: 'claude-opus-5-5', nazwa: 'Claude Opus 5.5' },
        { model: 'claude-haiku-4-5', nazwa: 'Claude Haiku 4.5' },
    ],
    gemini: [
        { model: 'gemini-2.5-pro', nazwa: 'Gemini 2.5 Pro' },
        { model: 'gemini-2.5-flash', nazwa: 'Gemini 2.5 Flash' },
    ],
};

const koncowka = (k) => (k ? `…${String(k).slice(-4)}` : null);

/** Klucze Kibla udostępnione mostowi (pliki w katalogu Wymiaru). */
export function utworzKluczeMostu({ katalog, efektywny = {} }) {
    const sciezka = (d) => path.join(katalog, DOSTAWCY[d].plik);
    const sprawdzDostawce = (d) => { if (!DOSTAWCY[d]) throw new Error(`Nieznany dostawca „${d}” (anthropic | gemini).`); };
    return {
        /** Stan bez kluczy: czy plik mostu jest, czy most w ogóle ma klucz (env/.key/plik) — tylko końcówka. */
        async stan() {
            const wynik = {};
            for (const d of Object.keys(DOSTAWCY)) {
                let zPliku = null;
                try { zPliku = (await fs.readFile(sciezka(d), 'utf8')).trim().match(/\S+/)?.[0] ?? null; } catch { /* brak */ }
                const ma = await efektywny[d]?.().catch(() => null) ?? null;
                wynik[d] = { nazwa: DOSTAWCY[d].nazwa, udostepniony: !!zPliku, koncowka: koncowka(ma), zrodlo: !ma ? null : (zPliku && ma === zPliku ? 'kibel' : 'inne') };
            }
            return wynik;
        },
        async ustaw(dostawca, klucz) {
            sprawdzDostawce(dostawca);
            const k = String(klucz ?? '').trim();
            if (!DOSTAWCY[dostawca].wzor.test(k)) throw new Error(`To nie wygląda na klucz ${DOSTAWCY[dostawca].nazwa}.`);
            await fs.mkdir(katalog, { recursive: true });
            await fs.writeFile(sciezka(dostawca), k + '\n', { encoding: 'utf8', mode: 0o600 });
            return { dostawca, koncowka: koncowka(k) };
        },
        async usun(dostawca) {
            sprawdzDostawce(dostawca);
            try { await fs.unlink(sciezka(dostawca)); return { usunieto: true }; } catch { return { usunieto: false }; }
        },
    };
}

// ── Listy modeli ──

/** Claude z /v1/models: API zwraca od najnowszych; bierzemy pierwsze `ile`. */
export function wybierzClaude(dane, ile = 4) {
    const lista = (dane?.data || []).filter((m) => /^claude-/.test(m?.id || ''));
    return lista.slice(0, ile).map((m) => ({ model: m.id, nazwa: m.display_name || m.id }));
}

const WYKLUCZ_GEMINI = /embed|image|imagen|tts|audio|live|aqa|learnlm|robotics|computer-use|veo|native|gemma/i;
/** Gemini z v1beta/models: tylko generateContent i tekst; najnowsza wersja, pro → flash → lite, stabilne przed preview. */
export function wybierzGemini(dane, ile = 4) {
    const wersja = (id) => Number(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
    const klasa = (id) => (/flash-lite/.test(id) ? 2 : /flash/.test(id) ? 1 : /pro/.test(id) ? 0 : 3);
    const niestabilny = (id) => (/preview|exp|latest|\d{2}-\d{2}/.test(id) ? 1 : 0);
    const lista = (dane?.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => ({ model: String(m.name || '').replace(/^models\//, ''), nazwa: m.displayName || '' }))
        .filter((m) => /^gemini-/.test(m.model) && !WYKLUCZ_GEMINI.test(m.model));
    lista.sort((a, b) => wersja(b.model) - wersja(a.model) || niestabilny(a.model) - niestabilny(b.model) || klasa(a.model) - klasa(b.model) || a.model.localeCompare(b.model));
    return lista.slice(0, ile).map((m) => ({ model: m.model, nazwa: m.nazwa || m.model }));
}

/** Pobieranie list (z kluczem) ze schowkiem; błąd = zapas i powód. */
export function utworzListyModeli({ fetch: f = globalThis.fetch, ttlMs = 10 * 60_000, teraz = () => Date.now() } = {}) {
    const schowek = new Map();
    const zapytaj = {
        anthropic: (k) => f('https://api.anthropic.com/v1/models?limit=50', { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01' } }),
        gemini: (k) => f('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': k } }),
    };
    const wybierz = { anthropic: wybierzClaude, gemini: wybierzGemini };
    return async function modele(dostawca, klucz) {
        if (!klucz) return { modele: ZAPAS[dostawca], zApi: false, blad: null };
        const id = `${dostawca}:${klucz.slice(-6)}`;
        const s = schowek.get(id);
        if (s && teraz() - s.czas < ttlMs) return s.wynik;
        let wynik;
        try {
            const r = await zapytaj[dostawca](klucz);
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(`HTTP ${r.status}${d?.error?.message ? `: ${d.error.message}` : ''}`);
            const m = wybierz[dostawca](d);
            wynik = m.length ? { modele: m, zApi: true, blad: null } : { modele: ZAPAS[dostawca], zApi: false, blad: 'API nie zwróciło modeli do pisania' };
        } catch (e) {
            wynik = { modele: ZAPAS[dostawca], zApi: false, blad: e.message };
        }
        schowek.set(id, { czas: teraz(), wynik });
        return wynik;
    };
}

export default { DOSTAWCY, ZAPAS, utworzKluczeMostu, wybierzClaude, wybierzGemini, utworzListyModeli };
