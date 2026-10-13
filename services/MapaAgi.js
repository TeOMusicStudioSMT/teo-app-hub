/**
 * 🧠 Mapa AGI — żywy stan sieci neuronowej Katedry (GET /api/agi/state, mapa w Hubie i na otakos.wtf).
 *
 * Suweren 2026-10-13: „główny widok sieci neuronowej… trzeba poprawić, by był zgodny z rzeczywistością”. Dawny stan
 * znał prawdziwie tylko most, Ollamę i Mechanika, a dziewięć węzłów (Kronos, Ted, VideO-Use, Kwantowa Tarcza…)
 * „oddychało” z zegara — wyglądały na żywe, choć nikt ich nie sprawdzał. Teraz każdy węzeł ma sondę z prawdziwego
 * modułu, a status mówi prawdę: `online` = działa / gotowe, `idle` = gotowe, ale śpi albo nie wiadomo, `offline` =
 * brak albo niegotowe. Każdy węzeł niesie `powod` — mapa pokazuje go zamiast ładnej bajki.
 *
 * Sondy NIC nie budzą (jak baza silników Dyrygenta). Pad sondy = `idle` z powodem „nie wiadomo”.
 */

export const STATUSY = ['online', 'idle', 'offline'];

const przytnij = (t, n = 200) => String(t ?? '').slice(0, n);

/**
 * Węzeł z wpisów bazy silników (Silniki.baza().silniki) jednego rodzaju: jest gotowy → online; tylko „nie wiadomo”
 * (np. ComfyUI śpi) → idle; nic gotowego → offline z powodem pierwszego wpisu.
 */
export function stanZSilnikow(silniki, rodzaj) {
    const lista = (silniki ?? []).filter((s) => s.rodzaj === rodzaj);
    if (!lista.length) return { status: 'offline', load: 0, powod: 'moduł nie zgłosił żadnego silnika' };
    const gotowe = lista.filter((s) => s.gotowy);
    if (gotowe.length) return { status: 'online', load: Math.min(1, gotowe.length / lista.length), powod: przytnij(`gotowe: ${gotowe.map((s) => s.nazwa).join(', ')}`) };
    const nieWiadomo = lista.find((s) => s.nieWiadomo);
    if (nieWiadomo) return { status: 'idle', load: 0, powod: przytnij(`${nieWiadomo.nazwa}: ${nieWiadomo.powod}`) };
    return { status: 'offline', load: 0, powod: przytnij(`${lista[0].nazwa}: ${lista[0].powod}`) };
}

/** Wynik sondy do kształtu węzła (status spoza listy = idle, load 0–1, powód przycięty). */
export function oczyscWezel(w) {
    const status = STATUSY.includes(w?.status) ? w.status : 'idle';
    const load = Number.isFinite(w?.load) ? Math.max(0, Math.min(1, w.load)) : 0;
    return { status, load: +load.toFixed(2), powod: przytnij(w?.powod || (status === 'online' ? 'działa' : 'nie wiadomo')) };
}

/**
 * @param {{ sondy: Record<string, () => Promise<object>|object>, silniki?: () => Promise<{silniki: object[]}>, ttlSilnikowMs?: number, limitMs?: number, teraz?: () => number }} o
 *   `sondy` — id węzła → sonda; sonda dostaje `{ silniki }` (wpisy bazy silników, ze schowka) i zwraca `{status, load?, powod}`.
 */
export function utworzMapeAgi({ sondy = {}, silniki = async () => ({ silniki: [] }), ttlSilnikowMs = 30_000, limitMs = 4_000, teraz = () => Date.now() } = {}) {
    let schowek = null;
    let wTrakcie = null;
    async function bazaSilnikow() {
        if (schowek && teraz() - schowek.czas < ttlSilnikowMs) return schowek.silniki;
        if (!wTrakcie) {
            wTrakcie = Promise.resolve().then(silniki).then((b) => {
                schowek = { czas: teraz(), silniki: b?.silniki ?? [] };
                return schowek.silniki;
            }).catch(() => schowek?.silniki ?? []).finally(() => { wTrakcie = null; });
        }
        return wTrakcie;
    }

    async function stan() {
        const lista = await bazaSilnikow();
        const wpisy = await Promise.all(Object.entries(sondy).map(async ([id, sonda]) => {
            let t;
            try {
                const w = await Promise.race([
                    Promise.resolve().then(() => sonda({ silniki: lista })),
                    new Promise((_, nie) => { t = setTimeout(() => nie(new Error(`sonda nie odpowiedziała w ${Math.round(limitMs / 1000)} s`)), limitMs); }),
                ]);
                return [id, oczyscWezel(w)];
            } catch (e) {
                return [id, oczyscWezel({ status: 'idle', powod: `nie wiadomo — ${e.message || e}` })];
            } finally { clearTimeout(t); }
        }));
        return Object.fromEntries(wpisy);
    }

    return { stan };
}

export default { utworzMapeAgi, stanZSilnikow, oczyscWezel, STATUSY };
