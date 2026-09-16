/**
 * 🤖📱 Artemis — ręce TeOgochi na telefonie (adapter do google/artemis).
 *
 * CO TO NAPRAWDĘ JEST (sprawdzone w repo 2026-09-16, nie z pamięci):
 * Artemis to framework Google do AUTOMATYZACJI ANDROIDA: polecenie w języku
 * naturalnym → klikanie po ekranie telefonu (ADB + Accessibility Helper +
 * model wizyjny). Daemon w Pythonie 3.12 słucha na :8000 i ma HTTP API, z którego
 * korzysta ich własny `artemis_client`:
 *
 *   GET  /api/status                → zdrowie daemona
 *   GET  /api/devices               → { devices: [{ serial, ... }] }
 *   POST /api/run                   → { goal, profile: 'flash'|'pro', session_id, device_serial?, expected_output?, conversation_id? }
 *                                     odpowiedź: { status, tasks: [{ session_id, status }] } (status 'rejected' = odmowa)
 *   GET  /api/sessions/:session_id  → { status, output|result|summary, error, turns }
 *   POST /api/stop                  → { session_id }
 *   statusy końcowe: completed | success | failed | cancelled | canceled | rejected
 *
 * ⚠️ CZYM NIE JEST: to NIE jest most głosowy ani protokół strumieniowania audio.
 * „Real-time duplex voice" figuruje u nich tylko w roadmapie. Głos Delegata
 * jedzie torami Katedry (Whisper + /api/voice/speak), nie Artemisem.
 *
 * ⚠️ KTÓRY TELEFON: Artemis steruje urządzeniem podpiętym do TEJ maszyny (ADB,
 * kabel lub Wi-Fi ADB w sieci domowej) albo emulatorem. Telefon, który Suweren
 * ma w kieszeni poza domem, nie jest dla Artemisa osiągalny — do tego służy
 * strona /delegat przez tunel. Artemis = „drugi telefon na biurku" jako ręce.
 *
 * INSTALACJA JEST DECYZJĄ SUWERENA: Python 3.12 + uv + ADB + helper APK na
 * telefonie (`start.bat` w repo Artemisa). Ten moduł niczego nie instaluje —
 * mówi wprost 424, gdy daemon nie żyje.
 */

import crypto from 'crypto';

const ARTEMIS_BASE = (process.env.OTAKOS_ARTEMIS || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const KONCOWE = new Set(['completed', 'success', 'failed', 'cancelled', 'canceled', 'rejected']);
const UDANE = new Set(['completed', 'success']);

async function zapytaj(sciezka, { metoda = 'GET', body, ms = 15_000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        const r = await fetch(`${ARTEMIS_BASE}${sciezka}`, {
            method: metoda, signal: ctrl.signal,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
        const tekst = await r.text();
        let dane = null;
        try { dane = JSON.parse(tekst); } catch { dane = { surowe: tekst.slice(0, 300) }; }
        if (!r.ok) throw Object.assign(new Error(`Artemis HTTP ${r.status}: ${dane?.error || dane?.detail || tekst.slice(0, 120)}`), { status: r.status });
        return dane;
    } finally { clearTimeout(t); }
}

/** Czy daemon żyje. Nigdy nie rzuca — oddaje { zywy:false, blad } gdy nie. */
export async function stan() {
    try {
        const s = await zapytaj('/api/status', { ms: 4000 });
        let urzadzenia = [];
        try {
            const d = await zapytaj('/api/devices', { ms: 4000 });
            urzadzenia = Array.isArray(d?.devices) ? d.devices : Array.isArray(d) ? d : [];
        } catch { /* lista urządzeń to bonus */ }
        return { zywy: true, baza: ARTEMIS_BASE, status: s, urzadzenia };
    } catch (e) {
        return {
            zywy: false, baza: ARTEMIS_BASE, urzadzenia: [],
            blad: e.name === 'AbortError' ? 'Artemis nie odpowiada (timeout).' : e.message,
            hint: 'Artemis nie działa na :8000. Uruchomienie: sklonuj github.com/google/artemis i odpal start.bat (Python 3.12 + uv + ADB; helper APK trafia na telefon przy pierwszym zadaniu). To decyzja Suwerena — most sam niczego nie instaluje.',
        };
    }
}

/**
 * Zleć zadanie na telefonie. Zwraca od razu po przyjęciu — telefon klika w tle.
 * @param {{ cel:string, profil?:'flash'|'pro', urzadzenie?:string, oczekiwane?:string, rozmowaId?:string }} p
 */
export async function zlec({ cel, profil = 'flash', urzadzenie, oczekiwane, rozmowaId }) {
    const goal = String(cel || '').trim();
    if (!goal) throw new Error('Brak celu zadania dla telefonu.');
    const session_id = crypto.randomUUID();
    const body = { goal, profile: profil === 'pro' ? 'pro' : 'flash', session_id, ingress: 'katedra_delegat' };
    if (urzadzenie) body.device_serial = urzadzenie;
    if (oczekiwane) body.expected_output = oczekiwane;
    if (rozmowaId) body.conversation_id = rozmowaId;
    const d = await zapytaj('/api/run', { metoda: 'POST', body, ms: 20_000 });
    const status = String(d?.status || 'unknown').toLowerCase();
    const zadania = Array.isArray(d?.tasks) ? d.tasks : [];
    if (status === 'rejected' || !zadania.length) {
        throw new Error(`Artemis odrzucił zadanie: ${d?.error || 'bez powodu'}`);
    }
    return { id: zadania[0].session_id || session_id, status: zadania[0].status || status, cel: goal, profil: body.profile };
}

/** Stan jednego zadania — z pamięci sesji Artemisa. */
export async function sonduj(id) {
    const d = await zapytaj(`/api/sessions/${encodeURIComponent(id)}`, { ms: 8000 });
    const status = String(d?.status || 'unknown').toLowerCase();
    const wynik = d?.output ?? d?.result ?? d?.summary ?? null;
    return {
        id, status,
        skonczone: KONCOWE.has(status),
        udane: UDANE.has(status),
        wynik: typeof wynik === 'string' ? wynik : wynik ? JSON.stringify(wynik).slice(0, 2000) : null,
        blad: d?.error ?? null,
        tur: d?.turns ?? null,
    };
}

export async function zatrzymaj(id) {
    const d = await zapytaj('/api/stop', { metoda: 'POST', body: { session_id: id }, ms: 8000 });
    return String(d?.status || '').toLowerCase() === 'stopped';
}

/**
 * Zleć i poczekaj — dla Delegata, który chce oddać wynik w jednej odpowiedzi.
 * Sufit domyślnie 90 s (Flash robi 3–5 s na krok); po suficie oddaje
 * { skonczone:false } z id, żeby dało się dopytać później.
 */
export async function zlecICzekaj(p, { sufitMs = 90_000, coMs = 3000 } = {}) {
    const z = await zlec(p);
    const t0 = Date.now();
    while (Date.now() - t0 < sufitMs) {
        await new Promise((r) => setTimeout(r, coMs));
        let s = null;
        try { s = await sonduj(z.id); } catch { continue; }
        if (s.skonczone) return { ...z, ...s };
    }
    return { ...z, skonczone: false, status: 'running', wynik: null, blad: null, uwaga: `Telefon dalej pracuje (ponad ${Math.round(sufitMs / 1000)} s) — dopytaj o zadanie ${z.id}.` };
}

export default { stan, zlec, sonduj, zatrzymaj, zlecICzekaj, ARTEMIS_BASE };
