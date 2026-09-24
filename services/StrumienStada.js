/**
 * 📡 Strumień Stada — to samo co GET /api/stado/stan, tylko NA ŻYWO (SSE) dla sparowanego telefonu.
 *
 * PO CO. StoL odpytywał most co 20 s: zdarzenie z szyny docierało z opóźnieniem do 20 s,
 * a telefon budził radio co 20 s, nawet gdy nic się nie działo. Strumień odwraca kierunek:
 * most mówi, kiedy jest co powiedzieć.
 *
 * CO LECI RURĄ (text/event-stream):
 *   event: stan   — pełny stanDlaApki: zaraz po podłączeniu i po każdej nowej migawce stada,
 *   event: szyna  — każde zdarzenie z szyny: { id, kiedy, agent, rodzaj, tresc } (treść ≤ 300 zn.),
 *   : puls        — co 25 s, żeby pośrednicy (Cloudflare) nie zamknęli ciszy.
 *
 * ⚠️ Pole `dane` zdarzeń szyny NIE wychodzi do telefonu — bywają w nim rzeczy wewnętrzne
 * (ścieżki kopii, stany tunelu). Telefon widzi to samo, co pokazuje WORKPalace: kto, co, kiedy.
 * ⚠️ Odłączenie telefonu w Katedrze zamyka jego strumień przy najbliższym pulsie.
 */

const klienci = new Set();   // { res, token, stan }
const PULS_MS = 25_000;
const MAX_TRESC = 300;

/** Zdarzenie szyny w postaci dla telefonu (bez `dane`). */
export function dlaTelefonu(z) {
    return {
        id: z.id ?? null,
        kiedy: z.kiedy ?? null,
        agent: String(z.agent ?? ''),
        rodzaj: String(z.rodzaj ?? ''),
        tresc: String(z.tresc ?? '').slice(0, MAX_TRESC),
    };
}

function wyslij(res, zdarzenie, dane) {
    try { res.write(`event: ${zdarzenie}\ndata: ${JSON.stringify(dane)}\n\n`); return true; }
    catch { return false; }
}

/**
 * Podłącz telefon. `stan()` oddaje aktualny stanDlaApki, `zyje(token)` mówi (bez zapisu na dysk),
 * czy urządzenie jest nadal sparowane.
 */
export async function podlacz(req, res, { token, stan, zyje }) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.write(': strumien stada otwarty\n\n');
    const klient = { res, token, stan };
    klienci.add(klient);
    wyslij(res, 'stan', await stan());

    const puls = setInterval(async () => {
        if (!(await zyje(token))) {
            wyslij(res, 'rozparowany', { message: 'Ten telefon został odłączony w Katedrze.' });
            res.end();
            return;
        }
        try { res.write(': puls\n\n'); } catch { /* zerwane — sprzątnie 'close' */ }
    }, PULS_MS);
    req.on('close', () => { clearInterval(puls); klienci.delete(klient); });
}

/** Nowe zdarzenie szyny → do wszystkich telefonów. */
export function rozeslijZdarzenie(z) {
    const d = dlaTelefonu(z);
    for (const k of klienci) if (!wyslij(k.res, 'szyna', d)) klienci.delete(k);
}

/** Nowa migawka stada → pełny stan do każdego telefonu (każdy ze swoją nazwą urządzenia). */
export async function rozeslijStan() {
    for (const k of [...klienci]) {
        const s = await k.stan().catch(() => null);
        if (!s || !wyslij(k.res, 'stan', s)) klienci.delete(k);
    }
}

export function ileTelefonow() { return klienci.size; }

export default { podlacz, rozeslijZdarzenie, rozeslijStan, dlaTelefonu, ileTelefonow };
