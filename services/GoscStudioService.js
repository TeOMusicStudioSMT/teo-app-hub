/**
 * 📱 GoscStudioService — telefon jako kamera, bez sterowników i bez chmury.
 *
 * PO CO TO ISTNIEJE: `guestStream` w PodcastCore był martwą właściwością —
 * nikt jej nigdy nie podawał. Telefony dało się wpiąć tylko przez obce
 * programy (DroidCam/Iriun), które instalują wirtualną kamerę w systemie.
 * Ten moduł daje drogę suwerenną: telefon otwiera stronę, oddaje obraz,
 * koniec.
 *
 * ⚠️ TRZY FAKTY, KTÓRE RZĄDZĄ TĄ ARCHITEKTURĄ — warto je znać, zanim się
 *    tu cokolwiek zmieni:
 *
 * 1. BLUETOOTH NIGDY NIE PRZENIESIE OBRAZU. Praktyczna przepustowość BT to
 *    ~2 Mb/s, a 1080p30 potrzebuje kilkunastu. To granica fizyczna, nie brak
 *    sterownika. Bluetooth przy aparacie służy do wyzwalania migawki,
 *    geotagowania i kopiowania zdjęć — nie do transmisji na żywo.
 *
 * 2. PRZEGLĄDARKA TELEFONU NIE ODDA KAMERY BEZ HTTPS. `getUserMedia` wymaga
 *    bezpiecznego kontekstu, a `http://192.168.x.x:3001` nim NIE JEST.
 *    Dlatego SYGNALIZACJA idzie Kwantowym Tunelem (prawdziwy HTTPS), nawet
 *    gdy oba urządzenia stoją obok siebie w tym samym Wi-Fi.
 *
 * 3. SAM OBRAZ I TAK POLECI PO SIECI LOKALNEJ. WebRTC po wymianie sygnałów
 *    łączy się bezpośrednio (kandydaci hosta), więc klatki nie jadą do
 *    Cloudflare i z powrotem — tunelem idzie tylko uścisk dłoni.
 *
 * Ten serwis NIE dotyka mediów. Jest przekaźnikiem kopert: przepisuje JSON
 * między studiem a gośćmi tego samego pokoju i nic więcej.
 */

import { WebSocketServer } from 'ws';
import crypto from 'crypto';

/** Pokoje: kod → { studio: ws|null, goscie: Map<id, ws> }. Żyją tylko w pamięci. */
const pokoje = new Map();

const nowyId = () => crypto.randomBytes(4).toString('hex');

/** Kod pokoju czytelny z ekranu telefonu: 6 znaków bez mylących 0/O/1/I. */
export function nowyKodPokoju() {
    const alfabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let kod = '';
    for (const b of crypto.randomBytes(6)) kod += alfabet[b % alfabet.length];
    return kod;
}

function wyslij(ws, obiekt) {
    if (ws && ws.readyState === 1) {
        try { ws.send(JSON.stringify(obiekt)); } catch { /* gniazdo padło w locie */ }
    }
}

function pokoj(kod) {
    if (!pokoje.has(kod)) pokoje.set(kod, { studio: null, goscie: new Map() });
    return pokoje.get(kod);
}

function sprzatnijPusty(kod) {
    const p = pokoje.get(kod);
    if (p && !p.studio && p.goscie.size === 0) pokoje.delete(kod);
}

/** Stan do pokazania w panelu — ilu gości realnie wisi na łączu. */
export function stanPokoi() {
    return [...pokoje.entries()].map(([kod, p]) => ({
        kod,
        studioObecne: !!p.studio,
        goscie: [...p.goscie.keys()],
    }));
}

/**
 * Podłącz kanał sygnalizacji do istniejącego serwera HTTP.
 * Ścieżka: `/api/studio/gosc?rola=studio|gosc&pokoj=KOD&nazwa=...`
 */
export function attachGoscStudio(server) {
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws, req, ctx) => {
        const { rola, kod, nazwa } = ctx;
        const p = pokoj(kod);

        if (rola === 'studio') {
            // Drugie studio na tym samym kodzie przejmuje pokój — poprzednie
            // najpewniej jest martwą kartą po odświeżeniu strony.
            if (p.studio) wyslij(p.studio, { typ: 'przejete', powod: 'inne studio weszło na ten kod' });
            p.studio = ws;
            console.log(`[Gość] 🎬 Studio objęło pokój ${kod} (gości: ${p.goscie.size}).`);
            wyslij(ws, { typ: 'studio-gotowe', kod, goscie: [...p.goscie.keys()] });
            // Goście, którzy czekali przed wejściem studia, muszą zostać ogłoszeni.
            for (const [id, g] of p.goscie) {
                wyslij(ws, { typ: 'gosc-dolaczyl', goscId: id, nazwa: g.__nazwa || 'gość' });
            }

            ws.on('message', (surowe) => {
                let m; try { m = JSON.parse(surowe); } catch { return; }
                if (m.typ === 'sygnal' && m.do) {
                    wyslij(p.goscie.get(m.do), { typ: 'sygnal', od: 'studio', dane: m.dane });
                }
            });

            ws.on('close', () => {
                if (p.studio === ws) p.studio = null;
                console.log(`[Gość] 🎬 Studio opuściło pokój ${kod}.`);
                for (const g of p.goscie.values()) wyslij(g, { typ: 'studio-zniklo' });
                sprzatnijPusty(kod);
            });
            return;
        }

        // ── Gość (telefon) ──
        const goscId = nowyId();
        ws.__nazwa = nazwa || 'telefon';
        p.goscie.set(goscId, ws);
        console.log(`[Gość] 📱 „${ws.__nazwa}" wszedł do pokoju ${kod} jako ${goscId}.`);

        wyslij(ws, { typ: 'witaj', goscId, studioObecne: !!p.studio });
        wyslij(p.studio, { typ: 'gosc-dolaczyl', goscId, nazwa: ws.__nazwa });

        ws.on('message', (surowe) => {
            let m; try { m = JSON.parse(surowe); } catch { return; }
            if (m.typ === 'sygnal') {
                wyslij(p.studio, { typ: 'sygnal', od: goscId, nazwa: ws.__nazwa, dane: m.dane });
            }
        });

        ws.on('close', () => {
            p.goscie.delete(goscId);
            console.log(`[Gość] 📱 „${ws.__nazwa}" (${goscId}) wyszedł z pokoju ${kod}.`);
            wyslij(p.studio, { typ: 'gosc-odszedl', goscId });
            sprzatnijPusty(kod);
        });
    });

    server.on('upgrade', (req, socket, head) => {
        let url;
        try { url = new URL(req.url, 'http://localhost'); } catch { return; }
        if (url.pathname !== '/api/studio/gosc') return;   // inne kanały mają własne obsługi

        const rola = url.searchParams.get('rola') === 'studio' ? 'studio' : 'gosc';
        const kod = String(url.searchParams.get('pokoj') || '').toUpperCase().slice(0, 12);
        const nazwa = String(url.searchParams.get('nazwa') || '').slice(0, 40);

        // Flaga dla wspólnego strażnika w wiesio-bridge.js: to gniazdo ma właściciela.
        // Bez niej strażnik zniszczyłby połączenie jako niczyje.
        req.__wsObsluzone = true;

        if (!kod) {
            // Bez kodu pokoju nie ma czego łączyć — zamykamy od razu z powodem,
            // zamiast trzymać otwarte gniazdo, które nigdy nic nie dostanie.
            socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
            socket.destroy();
            return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, { rola, kod, nazwa }));
    });

    console.log('[Gość] 📱 Kanał sygnalizacji gotów: WS /api/studio/gosc');
    return wss;
}

export default { attachGoscStudio, nowyKodPokoju, stanPokoi };
