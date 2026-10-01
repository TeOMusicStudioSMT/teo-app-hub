/**
 * 👑 Orb ↔ Główny (services/Glowny.js). Suweren (2026-10-01): „cała Katedra powinna być podłączona do głównego Orba,
 * z którego można rozmawiać". Gdy w ustawieniach Orbity włączone „Rozmawiaj z Głównym", to, co Suweren powie do Orba,
 * idzie do Głównego (ta sama sesja, póki jej nie zamknie), a odpowiedź wraca do Orba głosem.
 * Prośby o zgodę NIE są rozstrzygane głosem — Orb mówi, że czekają w Creative Zone (tam widać, co dokładnie zrobią).
 */
const MOST = 'http://127.0.0.1:3001';
const KLUCZ_WLACZONY = 'otakos_orb_glowny';
const KLUCZ_SESJI = 'otakos_orb_glowny_sesja';

export function orbZGlownym(): boolean {
    try { return localStorage.getItem(KLUCZ_WLACZONY) === '1'; } catch { return false; }
}
export function ustawOrbZGlownym(wl: boolean): void {
    try { localStorage.setItem(KLUCZ_WLACZONY, wl ? '1' : '0'); if (!wl) localStorage.removeItem(KLUCZ_SESJI); } catch { /* bez pamięci */ }
}

interface Wpis { kto: string; tresc?: string }
interface Sesja { id: string; trwa: boolean; blad: string | null; wpisy: Wpis[]; prosby: { stan: string; coRobi: string }[] }

async function json<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}

/**
 * Wyślij wypowiedź Suwerena do Głównego i poczekaj na koniec tury (do `limitMs`).
 * @returns odpowiedź do wypowiedzenia (ostatnie słowa Głównego) albo komunikat o prośbie/błędzie
 */
export async function zapytajGlownego(tekst: string, limitMs = 10 * 60_000): Promise<string> {
    let sesja: string | null = null;
    try { sesja = localStorage.getItem(KLUCZ_SESJI); } catch { /* bez pamięci */ }
    let d: { sesja: string };
    try {
        d = await json<{ sesja: string }>('/api/glowny/wiadomosc', { method: 'POST', body: JSON.stringify({ tekst, sesja, zrodlo: 'orb' }) });
    } catch (e) {
        // Stara sesja mogła zniknąć albo czeka na decyzję — przy „nie ma takiej sesji" zaczynamy nową.
        if (sesja && /Nie ma takiej sesji/.test((e as Error).message)) {
            d = await json<{ sesja: string }>('/api/glowny/wiadomosc', { method: 'POST', body: JSON.stringify({ tekst, zrodlo: 'orb' }) });
        } else throw e;
    }
    try { localStorage.setItem(KLUCZ_SESJI, d.sesja); } catch { /* bez pamięci */ }
    const t0 = Date.now();
    let s: Sesja | null = null;
    let ileWpisow = -1;
    while (Date.now() - t0 < limitMs) {
        await new Promise((r) => setTimeout(r, 1500));
        s = (await json<{ sesja: Sesja }>(`/api/glowny/sesja/${d.sesja}`)).sesja;
        if (ileWpisow < 0) ileWpisow = s.wpisy.map((w) => w.kto).lastIndexOf('suweren');
        if (!s.trwa) break;
    }
    if (!s) return 'Główny nie odpowiedział.';
    if (s.trwa) return 'Główny wciąż pracuje — odpowiedź zobaczysz w Creative Zone, w trybie Główny.';
    const nowe = s.wpisy.slice(Math.max(0, ileWpisow) + 1);
    const slowa = nowe.filter((w) => w.kto === 'glowny').map((w) => w.tresc ?? '').join(' ').trim();
    const czeka = s.prosby.filter((p) => p.stan === 'czeka');
    if (s.blad) return `Główny ma kłopot: ${s.blad}`;
    const odp = slowa.length > 500 ? `${slowa.slice(0, 480)}… Resztę masz w Creative Zone.` : slowa;
    return czeka.length
        ? `${odp ? `${odp} ` : ''}Główny prosi o twoją zgodę (${czeka.length}): ${czeka[0].coRobi} Zdecyduj w Creative Zone, w trybie Główny.`
        : odp || 'Główny skończył, ale nic nie powiedział.';
}
