/**
 * 🎬📱 goscStudio — strona STUDIA kanału gości.
 *
 * Odbiera obraz z telefonów, które otworzyły `/gosc/`. Każdy gość dostaje
 * własne `RTCPeerConnection`; gotowy `MediaStream` idzie do slotu kamery
 * w PodcastCore (`guestStream` — właściwość, która do 2026-08-06 była martwa,
 * bo nikt jej nigdy nie podawał).
 *
 * ⚠️ CZEGO TU NIE MA I DLACZEGO: żadnych serwerów STUN/TURN. W jednej sieci
 * lokalnej wystarczają kandydaci hosta, a Katedra ma działać bez wychodzenia
 * na zewnątrz. Telefon w INNEJ sieci wymagałby STUN-a — czyli wyjazdu do
 * chmury — więc świadomie tego nie robimy i mówimy o tym wprost w panelu.
 */

export interface Gosc {
    id: string;
    nazwa: string;
    strumien: MediaStream | null;
    stan: 'łączę' | 'na antenie' | 'zerwane' | 'nie doszło';
}

type Sluchacz = (goscie: Gosc[]) => void;

export interface OpcjeStudia {
    /** Baza mostu. Domyślnie ten sam host, z którego serwowana jest strona. */
    baza?: string;
    onZmiana?: Sluchacz;
    onLog?: (wiadomosc: string) => void;
}

export class StudioGosci {
    private ws: WebSocket | null = null;
    private polaczenia = new Map<string, RTCPeerConnection>();
    private goscie = new Map<string, Gosc>();
    private zamkniete = false;

    constructor(public readonly kod: string, private opcje: OpcjeStudia = {}) {}

    private log(w: string) { this.opcje.onLog?.(w); }

    private rozglos() {
        this.opcje.onZmiana?.([...this.goscie.values()]);
    }

    private adres(): string {
        const baza = this.opcje.baza
            ?? (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3001');
        const u = new URL(baza);
        u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
        u.pathname = '/api/studio/gosc';
        u.search = `?rola=studio&pokoj=${encodeURIComponent(this.kod)}`;
        return u.toString();
    }

    otworz(): void {
        this.zamkniete = false;
        const ws = new WebSocket(this.adres());
        this.ws = ws;

        ws.onopen = () => this.log(`Pokój ${this.kod} otwarty — czekam na telefony.`);
        ws.onerror = () => this.log('Kanał gości nie odpowiada — czy Most stoi?');
        ws.onclose = () => {
            if (!this.zamkniete) this.log('Kanał gości zamknięty.');
        };

        ws.onmessage = async (ev) => {
            let m: any;
            try { m = JSON.parse(ev.data); } catch { return; }

            if (m.typ === 'gosc-dolaczyl') {
                this.goscie.set(m.goscId, { id: m.goscId, nazwa: m.nazwa || 'telefon', strumien: null, stan: 'łączę' });
                this.log(`📱 „${m.nazwa}" wszedł do pokoju.`);
                this.rozglos();
            }
            if (m.typ === 'gosc-odszedl') {
                this.zamknijGoscia(m.goscId);
                this.log('📱 Gość wyszedł.');
                this.rozglos();
            }
            if (m.typ === 'przejete') {
                this.log('Inne studio weszło na ten kod — to okno straciło pokój.');
            }
            if (m.typ === 'sygnal') {
                await this.odbierzSygnal(m.od, m.nazwa, m.dane);
            }
        };
    }

    private polaczenie(goscId: string): RTCPeerConnection {
        const istniejace = this.polaczenia.get(goscId);
        if (istniejace) return istniejace;

        const pc = new RTCPeerConnection({ iceServers: [] });

        pc.ontrack = (e) => {
            const g = this.goscie.get(goscId);
            if (!g) return;
            // `e.streams[0]` niesie i obraz, i dźwięk telefonu w jednym strumieniu.
            g.strumien = e.streams[0] ?? new MediaStream([e.track]);
            g.stan = 'na antenie';
            this.rozglos();
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) this.wyslij(goscId, { ice: e.candidate });
        };

        pc.onconnectionstatechange = () => {
            const g = this.goscie.get(goscId);
            if (!g) return;
            if (pc.connectionState === 'failed') { g.stan = 'nie doszło'; this.rozglos(); }
            if (pc.connectionState === 'disconnected') { g.stan = 'zerwane'; this.rozglos(); }
        };

        this.polaczenia.set(goscId, pc);
        return pc;
    }

    private async odbierzSygnal(goscId: string, nazwa: string | undefined, dane: any) {
        if (!this.goscie.has(goscId)) {
            // Gość mógł zapukać, zanim doszło ogłoszenie — nie gubimy go.
            this.goscie.set(goscId, { id: goscId, nazwa: nazwa || 'telefon', strumien: null, stan: 'łączę' });
            this.rozglos();
        }
        const pc = this.polaczenie(goscId);

        if (dane?.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(dane.sdp));
            if (dane.sdp.type === 'offer') {
                const odp = await pc.createAnswer();
                await pc.setLocalDescription(odp);
                this.wyslij(goscId, { sdp: pc.localDescription });
            }
        }
        if (dane?.ice) {
            try { await pc.addIceCandidate(dane.ice); }
            catch (e) { console.warn('[StudioGosci] ICE odrzucone:', e); }
        }
    }

    private wyslij(goscId: string, dane: unknown) {
        if (this.ws?.readyState === 1) {
            this.ws.send(JSON.stringify({ typ: 'sygnal', do: goscId, dane }));
        }
    }

    private zamknijGoscia(goscId: string) {
        const pc = this.polaczenia.get(goscId);
        if (pc) { try { pc.close(); } catch { /* już zamknięte */ } }
        this.polaczenia.delete(goscId);
        // Ścieżki trzeba zatrzymać ręcznie — inaczej zostają żywe i trzymają zasoby.
        this.goscie.get(goscId)?.strumien?.getTracks().forEach(t => t.stop());
        this.goscie.delete(goscId);
    }

    zamknij(): void {
        this.zamkniete = true;
        for (const id of [...this.goscie.keys()]) this.zamknijGoscia(id);
        if (this.ws) { try { this.ws.close(); } catch { /* nieistotne */ } this.ws = null; }
        this.rozglos();
    }
}

/** Kod pokoju żyje w przeglądarce, żeby przetrwał odświeżenie strony studia. */
const KLUCZ_POKOJU = 'teo_studio_pokoj';

export function kodPokoju(): string {
    if (typeof localStorage === 'undefined') return 'LOKALNY';
    const zapisany = localStorage.getItem(KLUCZ_POKOJU);
    if (zapisany) return zapisany;
    const alfabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bez mylących 0/O/1/I
    let kod = '';
    for (let i = 0; i < 6; i++) kod += alfabet[Math.floor(Math.random() * alfabet.length)];
    localStorage.setItem(KLUCZ_POKOJU, kod);
    return kod;
}

export function przekujKodPokoju(): string {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KLUCZ_POKOJU);
    return kodPokoju();
}
