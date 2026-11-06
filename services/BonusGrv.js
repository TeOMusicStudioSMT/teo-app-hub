/**
 * 🎁 Bonus GRV z metki 0.00G Style — strona ODBIORCY (Suweren 2026-11-06: „+2500 GRV za bluzę… kupujący odbiera, gdy założy
 * własną Katedrę”).
 *
 * Kupujący dostaje na stronie swojego kodu tańca kod bonusu `b-<16 hex>@<host wystawcy>` (wystawca = Katedra, która
 * sprzedała produkt; services/KodyTanca.js). Przy pierwszym wejściu do SWOJEJ Katedry wpisuje go obok imienia
 * (`POST /api/grv/register {wlasciciel, nazwa, bonus}`). Tu:
 *   1. `POST https://<host>/wizytowka/grv-bonus/<kod>` — wystawca oznacza bonus jako odebrany (RAZ) i oddaje kwotę
 *      podpisaną kluczem swojej wizytówki,
 *   2. klucz wystawcy z jego publicznej wizytówki (`GET https://<host>/api/wizytowka`) — podpis musi się zgadzać,
 *      nick wystawcy też,
 *   3. dopiero wtedy księga TEJ Katedry dopisuje kwotę (ze swojego skarbca — każda Katedra ma własny).
 * UCZCIWIE: to umowa między Katedrami spięta podpisem — wystawca ręczy za swój bonus; ruchu GRV między księgami nie ma.
 */
import crypto from 'crypto';

export const WZOR_ADRESU_BONUSU = /^(b-[0-9a-f]{16})@([a-z0-9.-]+\.[a-z]{2,})$/i;
export const MAX_BONUSU = 100_000;
export const trescBonusu = ({ kod, kwota, wystawca, czas }) => ['otakos-bonus-grv', kod, kwota, wystawca, czas].join('\n');

/** „ b-abc…@QR.teo.center ” → { kod, host } albo null. */
export function rozbierzBonus(tekst) {
    const m = WZOR_ADRESU_BONUSU.exec(String(tekst ?? '').trim().toLowerCase());
    return m ? { kod: m[1], host: m[2] } : null;
}

export function sprawdzPodpis(tekst, kluczB64, podpisB64) {
    try { return crypto.verify(null, Buffer.from(tekst, 'utf8'), crypto.createPublicKey({ key: Buffer.from(String(kluczB64), 'base64'), format: 'der', type: 'spki' }), Buffer.from(String(podpisB64 ?? ''), 'base64')); }
    catch { return false; }
}

/** Odbierz bonus u wystawcy i sprawdź podpis. Rzuca błąd z powodem po polsku (Suweren poprawi literówkę). */
export async function odbierzBonus(tekst, { fetch: f = globalThis.fetch, limitMs = 15_000 } = {}) {
    const b = rozbierzBonus(tekst);
    if (!b) throw new Error('Kod bonusu wygląda tak: b-…@adres (skopiuj go w całości ze strony swojego kodu tańca).');
    const baza = `https://${b.host}`;
    const odp = await f(`${baza}/wizytowka/grv-bonus/${b.kod}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(limitMs) })
        .catch((e) => { throw new Error(`Katedra wystawcy (${b.host}) nie odpowiada: ${e.message}`); });
    const d = await odp.json().catch(() => ({}));
    if (!odp.ok || d.success === false) throw new Error(`Wystawca odmówił: ${d.message ?? `HTTP ${odp.status}`}`);
    const kwota = Number(d.kwota);
    if (d.kod !== b.kod || !Number.isInteger(kwota) || kwota < 1 || kwota > MAX_BONUSU) throw new Error('Wystawca oddał niepoprawny bonus.');
    const w = await f(`${baza}/api/wizytowka`, { signal: AbortSignal.timeout(limitMs) }).then((r) => r.json()).catch(() => null);
    if (!w?.klucz || !w?.nick) throw new Error(`Nie odczytałem wizytówki wystawcy (${b.host}) — bez jego klucza nie sprawdzę podpisu.`);
    if (w.nick !== d.wystawca) throw new Error('Podpis bonusu jest od innej Katedry niż wizytówka pod tym adresem.');
    if (!sprawdzPodpis(trescBonusu({ kod: b.kod, kwota, wystawca: d.wystawca, czas: d.czas }), w.klucz, d.podpis)) throw new Error('Podpis bonusu się nie zgadza — nie dopisuję GRV.');
    return { kod: b.kod, host: b.host, kwota, wystawca: d.wystawca, czas: d.czas };
}

export default { rozbierzBonus, odbierzBonus, sprawdzPodpis, trescBonusu, WZOR_ADRESU_BONUSU };
