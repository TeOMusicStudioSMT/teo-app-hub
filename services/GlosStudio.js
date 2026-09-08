/**
 * 🗣️ GlosStudio — spięcie Katedry z VoiceStudio (klonowanie i projektowanie głosu).
 *
 * PO CO. Suweren pytał, czy głosy da się wytworzyć którymś ze wskazanych repo.
 * OpenWhispr robi kierunek ODWROTNY (mowa → tekst), więc do assetów „Głosy" się
 * nie nadaje. VoiceStudio robi dokładnie to, czego brakuje: klonowanie głosu
 * z próbki, projektowanie głosu z opisu i syntezę mowy.
 *
 * ⚠️ VOICESTUDIO JEST OSOBNYM PROGRAMEM I MA NIM ZOSTAĆ.
 * Jego licencja to AGPL-3.0. Dopóki rozmawiamy z nim po HTTP — tak jak z ComfyUI
 * — jest to osobny proces, a kod Katedry zostaje przy swojej licencji. Wciągnięcie
 * jego źródeł do tego repo zmieniłoby sytuację. Dlatego tutaj jest KLIENT, nigdy
 * kopia jego kodu.
 *
 * ⚠️ NIE ZGADUJEMY TRAS. Z dokumentacji znam pewne punkty (`/health`,
 * `/v1/audio/voices`, `/v1/audio/speech`, `/v1/audio/transcriptions`) — resztę
 * ODKRYWAMY z `/openapi.json` działającej instalacji. To ta sama zasada, co przy
 * ComfyUI: graf budujemy z żywych schematów, nie z pamięci. Dzięki temu panel
 * mówi, co TA instalacja naprawdę potrafi, zamiast obiecywać z ulotki.
 *
 * ⚠️ KLONOWANIE ROBI SIĘ W VOICESTUDIO. Jego okno ma do tego kreator z próbką
 * audio; my nie udajemy, że mamy własny. Katedra bierze GOTOWY głos z listy
 * i przypina go do assetu — i to mówi wprost.
 */

import fs from 'fs/promises';
import path from 'path';

/** Domyślnie loopback: na tym samym komputerze VoiceStudio nie wymaga klucza. */
export const BAZA = process.env.OTAKOS_VOICESTUDIO || 'http://127.0.0.1:3900';

/** Punkty, które znam z dokumentacji — reszta pochodzi z odkrycia. */
const ZNANE = {
    zdrowie: '/health',
    glosy: '/v1/audio/voices',
    mowa: '/v1/audio/speech',
    transkrypcja: '/v1/audio/transcriptions',
};

async function pobierz(sciezka, opcje = {}, limitMs = 8000) {
    const stoper = AbortSignal.timeout(limitMs);
    return fetch(`${BAZA}${sciezka}`, { ...opcje, signal: stoper });
}

/**
 * Czy VoiceStudio żyje, jakie ma głosy i co naprawdę potrafi.
 *
 * ⚠️ Rozróżniamy „nie działa" od „działa, ale nie ma głosów". To dwie różne
 * naprawy: pierwsza to odpalenie programu, druga to sklonowanie głosu.
 */
export async function stan() {
    let zywe = false;
    let powod = null;
    try {
        const r = await pobierz(ZNANE.zdrowie, {}, 4000);
        zywe = r.ok;
        if (!r.ok) powod = `VoiceStudio odpowiedział HTTP ${r.status}`;
    } catch (e) {
        powod = e.name === 'TimeoutError'
            ? `VoiceStudio nie odpowiada na ${BAZA} (przekroczony czas).`
            : `VoiceStudio nie odpowiada na ${BAZA}.`;
    }

    if (!zywe) {
        return {
            zywe: false, baza: BAZA, glosy: [], mozliwosci: {},
            braki: [
                powod ?? `Brak połączenia z ${BAZA}.`,
                'Odpal VoiceStudio (osobny program) albo wskaż inny adres zmienną OTAKOS_VOICESTUDIO.',
            ],
        };
    }

    // Lista głosów — także tych sklonowanych w jego własnym oknie.
    let glosy = [];
    try {
        const r = await pobierz(ZNANE.glosy);
        if (r.ok) {
            const d = await r.json();
            const surowe = Array.isArray(d) ? d : (d.voices ?? d.data ?? []);
            glosy = surowe.map((g) => ({
                id: String(g?.id ?? g?.voice_id ?? g?.name ?? '').trim(),
                nazwa: String(g?.name ?? g?.label ?? g?.id ?? '').trim(),
                jezyk: g?.language ?? g?.lang ?? null,
                silnik: g?.engine ?? g?.model ?? null,
                sklonowany: Boolean(g?.cloned ?? g?.is_cloned ?? g?.custom),
            })).filter((g) => g.id);
        }
    } catch { /* lista głosów jest miła, ale nie krytyczna */ }

    // Odkrycie tras: mówimy o TEJ instalacji, nie o ulotce.
    const mozliwosci = { mowa: false, transkrypcja: false, klonowanie: false, projektowanie: false };
    let trasy = [];
    try {
        const r = await pobierz('/openapi.json', {}, 6000);
        if (r.ok) {
            const spec = await r.json();
            trasy = Object.keys(spec?.paths ?? {});
        }
    } catch { /* brak OpenAPI — zostajemy przy tym, co znane */ }

    if (trasy.length) {
        mozliwosci.mowa = trasy.some((t) => /audio\/speech/i.test(t));
        mozliwosci.transkrypcja = trasy.some((t) => /audio\/transcriptions/i.test(t));
        mozliwosci.klonowanie = trasy.some((t) => /clone|voices?\/(create|add)/i.test(t));
        mozliwosci.projektowanie = trasy.some((t) => /design/i.test(t));
    } else {
        // Bez OpenAPI zakładamy tylko to, co potwierdzone w dokumentacji.
        mozliwosci.mowa = true;
        mozliwosci.transkrypcja = true;
    }

    return {
        zywe: true, baza: BAZA, glosy, mozliwosci, trasy: trasy.length,
        braki: glosy.length ? [] : ['VoiceStudio działa, ale nie ma jeszcze żadnego głosu — sklonuj go w jego oknie, a pojawi się tutaj.'],
    };
}

/**
 * Wypowiedz tekst wskazanym głosem i zapisz plik W KATEDRZE.
 *
 * ⚠️ Plik ląduje w katalogu assetu, nie w katalogu VoiceStudio — dokładnie
 * z tego samego powodu, dla którego ujęcia nie zostają w ComfyUI.
 */
export async function mow({ tekst, glos, format = 'wav', katalogDocelowy, nazwa = 'probka' }) {
    const t = String(tekst ?? '').trim();
    if (t.length < 2) throw new Error('Pusty tekst — nie ma czego wypowiadać.');
    if (!glos) throw new Error('Nie wskazano głosu.');
    if (!katalogDocelowy) throw new Error('Nie wiem, gdzie zapisać nagranie.');

    let odp;
    try {
        odp = await pobierz(ZNANE.mowa, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Kształt zgodny z API audio OpenAI — VoiceStudio je wystawia.
            body: JSON.stringify({ model: 'tts-1', input: t.slice(0, 4000), voice: glos, response_format: format }),
        }, 180000);
    } catch (e) {
        throw new Error(`VoiceStudio nie odpowiedział: ${e.message}`);
    }

    if (!odp.ok) {
        const tresc = await odp.text().catch(() => '');
        throw new Error(`VoiceStudio odmówił (HTTP ${odp.status}): ${tresc.slice(0, 240)}`);
    }

    const bufor = Buffer.from(await odp.arrayBuffer());
    if (bufor.length < 128) throw new Error('VoiceStudio oddał pusty plik — nagranie nie powstało.');

    await fs.mkdir(katalogDocelowy, { recursive: true });
    const bezpieczna = String(nazwa).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'probka';
    const cel = path.join(katalogDocelowy, `${bezpieczna}_${Date.now().toString(36)}.${format}`);
    await fs.writeFile(cel, bufor);
    return { sciezka: cel, bajtow: bufor.length, glos, znakow: t.length };
}

/**
 * Transkrypcja próbki — pomocne, gdy Suweren wgrywa nagranie wzorcowe i chce
 * wiedzieć, co na nim padło.
 */
export async function przepisz(sciezkaAudio) {
    const dane = await fs.readFile(sciezkaAudio);
    const formularz = new FormData();
    formularz.append('file', new Blob([dane]), path.basename(sciezkaAudio));
    formularz.append('model', 'whisper-1');

    const odp = await pobierz(ZNANE.transkrypcja, { method: 'POST', body: formularz }, 180000);
    if (!odp.ok) {
        const t = await odp.text().catch(() => '');
        throw new Error(`VoiceStudio odmówił transkrypcji (HTTP ${odp.status}): ${t.slice(0, 240)}`);
    }
    const d = await odp.json();
    return { tekst: String(d?.text ?? '').trim() };
}

export default { BAZA, stan, mow, przepisz };
