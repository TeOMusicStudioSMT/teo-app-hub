/**
 * 🔌 PanelPodlaczen — rozwijany panel podłączeń zewnętrznych urządzeń.
 *
 * Odpowiada na pytanie „jak to w ogóle podłączyć?" — i odpowiada UCZCIWIE,
 * łącznie z tym, czego zrobić SIĘ NIE DA.
 *
 * ⚠️ BLUETOOTH NIE PRZENIESIE OBRAZU. Praktyczna przepustowość BT to ~2 Mb/s,
 * a 1080p30 potrzebuje kilkunastu. To granica fizyczna, nie brak sterownika —
 * żadna wersja tego panelu tego nie obejdzie. Bluetooth przy aparacie służy
 * do wyzwalania migawki, geotagowania i kopiowania zdjęć po fakcie.
 * Aparat sparowany po BT NIGDY nie pojawi się na liście kamer.
 *
 * Realne drogi są trzy i panel je rozdziela:
 *  · USB / grabber HDMI → urządzenie widziane jako zwykła kamera (UVC),
 *  · wirtualna kamera (DroidCam/Iriun/Sony Imaging Edge) → też zwykła kamera,
 *  · TELEFON PRZEZ WI-FI (WebRTC) → bez sterowników, drogą suwerenną.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { StudioGosci, kodPokoju, przekujKodPokoju, type Gosc } from '../../lib/goscStudio';
import { getTunnelUrl } from '../../lib/bridgeService';

interface Props {
    /** Gość wpięty do studia — PodcastCore wstawia go w slot kamery. */
    onGosc?: (strumien: MediaStream | null, nazwa: string) => void;
    domyslnieOtwarty?: boolean;
}

const karta: React.CSSProperties = {
    borderRadius: 12, border: '1px solid rgba(255,255,255,0.09)',
    background: 'rgba(255,255,255,0.03)', padding: 12,
};
const etykieta: React.CSSProperties = {
    fontSize: 8, letterSpacing: '0.22em', color: '#64748b', textTransform: 'uppercase', marginBottom: 6,
};

export const PanelPodlaczen: React.FC<Props> = ({ onGosc, domyslnieOtwarty = false }) => {
    const [otwarty, setOtwarty] = useState(domyslnieOtwarty);
    const [kamery, setKamery] = useState<MediaDeviceInfo[]>([]);
    const [mikrofony, setMikrofony] = useState<MediaDeviceInfo[]>([]);
    const [etykietyUkryte, setEtykietyUkryte] = useState(false);

    const [kod, setKod] = useState<string>(() => kodPokoju());
    const [goscie, setGoscie] = useState<Gosc[]>([]);
    const [log, setLog] = useState<string[]>([]);
    const [qr, setQr] = useState<string>('');
    const [tunel, setTunel] = useState<string>('');
    const studioRef = useRef<StudioGosci | null>(null);

    const dopiszLog = useCallback((w: string) => {
        setLog(l => [`${new Date().toLocaleTimeString('pl-PL')} · ${w}`, ...l].slice(0, 6));
    }, []);

    // ── Lista realnych urządzeń ──────────────────────────────────────────────
    const odswiezUrzadzenia = useCallback(async () => {
        try {
            const lista = await navigator.mediaDevices.enumerateDevices();
            const wideo = lista.filter(d => d.kind === 'videoinput');
            const audio = lista.filter(d => d.kind === 'audioinput');
            setKamery(wideo);
            setMikrofony(audio);
            // Przeglądarka ukrywa nazwy urządzeń, dopóki nie padnie zgoda na kamerę.
            // Bez tej informacji Suweren widzi „Kamera 1/2" i myśli, że coś się psuje.
            setEtykietyUkryte(wideo.length > 0 && wideo.every(d => !d.label));
        } catch (e) {
            dopiszLog(`Nie mogę odczytać listy urządzeń: ${(e as Error).message}`);
        }
    }, [dopiszLog]);

    useEffect(() => {
        void odswiezUrzadzenia();
        // Wpięcie grabbera albo start wirtualnej kamery zmienia listę w locie.
        navigator.mediaDevices?.addEventListener?.('devicechange', odswiezUrzadzenia);
        return () => navigator.mediaDevices?.removeEventListener?.('devicechange', odswiezUrzadzenia);
    }, [odswiezUrzadzenia]);

    // ── Adres dla telefonu + kod QR ──────────────────────────────────────────
    useEffect(() => {
        const zapisany = getTunnelUrl().replace('/api/bridge/execute', '');
        setTunel(zapisany);
        if (!zapisany) { setQr(''); return; }
        const link = `${zapisany}/gosc/?pokoj=${kod}`;
        QRCode.toDataURL(link, { margin: 1, width: 200, color: { dark: '#06121a', light: '#e6fbff' } })
            .then(setQr).catch(() => setQr(''));
    }, [kod]);

    // ── Pokój gości ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!otwarty) return;
        const studio = new StudioGosci(kod, { onZmiana: setGoscie, onLog: dopiszLog });
        studio.otworz();
        studioRef.current = studio;
        return () => { studio.zamknij(); studioRef.current = null; };
    }, [otwarty, kod, dopiszLog]);

    const linkTelefonu = tunel ? `${tunel}/gosc/?pokoj=${kod}` : '';

    return (
        <div style={{ ...karta, marginTop: 10 }}>
            <button
                onClick={() => setOtwarty(o => !o)}
                style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#67e8f9',
                    fontFamily: 'inherit', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                }}>
                <span>🔌 PANEL PODŁĄCZEŃ {goscie.length > 0 && <span style={{ color: '#34d399' }}>· {goscie.length} 📱</span>}</span>
                <span>{otwarty ? '▲' : '▼'}</span>
            </button>

            {otwarty && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* ── Co widzi Katedra ── */}
                    <div style={karta}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={etykieta}>Urządzenia widziane przez Katedrę</div>
                            <button onClick={() => void odswiezUrzadzenia()}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, color: '#94a3b8', fontSize: 9, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                ODŚWIEŻ
                            </button>
                        </div>
                        {kamery.length ? kamery.map((d, i) => (
                            <div key={d.deviceId || i} style={{ fontSize: 10, color: '#cbd5e1', padding: '3px 0' }}>
                                🎥 {d.label || `Kamera ${i + 1} (nazwa ukryta)`}
                            </div>
                        )) : <div style={{ fontSize: 10, color: '#64748b' }}>— żadnej kamery —</div>}
                        <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>
                            🎙️ mikrofonów: {mikrofony.length}
                        </div>
                        {etykietyUkryte && (
                            <div style={{ fontSize: 9, color: '#fde68a', marginTop: 6, lineHeight: 1.5 }}>
                                Nazwy urządzeń są ukryte, dopóki nie zezwolisz na dostęp do kamery —
                                to zachowanie przeglądarki, nie usterka. Odpal dowolną kamerę, a nazwy się pojawią.
                            </div>
                        )}
                    </div>

                    {/* ── Telefon przez Wi-Fi (droga suwerenna) ── */}
                    <div style={{ ...karta, borderColor: 'rgba(34,211,238,0.28)', background: 'rgba(34,211,238,0.05)' }}>
                        <div style={etykieta}>📱 Telefon przez Wi-Fi — bez sterowników</div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 20, letterSpacing: '0.18em', color: '#67e8f9', fontWeight: 700 }}>{kod}</div>
                            <button onClick={() => { setKod(przekujKodPokoju()); setGoscie([]); }}
                                title="Nowy kod — stare linki i kody QR przestają działać"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, color: '#94a3b8', fontSize: 9, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                PRZEKUJ
                            </button>
                        </div>

                        {tunel ? (
                            <>
                                {qr && <img src={qr} alt="Kod QR dla telefonu" style={{ width: 150, borderRadius: 8, display: 'block' }} />}
                                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 6, wordBreak: 'break-all' }}>{linkTelefonu}</div>
                            </>
                        ) : (
                            /* Tu leży sedno całej sprawy — bez HTTPS telefon NIE ODDA kamery. */
                            <div style={{ fontSize: 10, color: '#fde68a', lineHeight: 1.6, padding: 8, borderRadius: 8, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)' }}>
                                <b>Najpierw odpal Kwantowy Tunel.</b><br />
                                Przeglądarka telefonu oddaje kamerę <b>wyłącznie przez HTTPS</b>, a adres
                                w sieci lokalnej (<code>http://192.168…</code>) nim nie jest — kamera zostanie
                                zablokowana bez pytania.<br /><br />
                                Tunel daje prawdziwy HTTPS. <b>Sam obraz i tak poleci po Waszym Wi-Fi</b> —
                                WebRTC dogaduje się bezpośrednio, tunelem idzie tylko uścisk dłoni.
                            </div>
                        )}

                        {/* Podłączeni goście */}
                        <div style={{ marginTop: 10 }}>
                            {goscie.length ? goscie.map(g => (
                                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                                    <span style={{
                                        width: 7, height: 7, borderRadius: '50%',
                                        background: g.stan === 'na antenie' ? '#10b981' : g.stan === 'łączę' ? '#fbbf24' : '#ef4444',
                                    }} />
                                    <span style={{ fontSize: 10, color: '#e2e8f0', flex: 1 }}>{g.nazwa}</span>
                                    <span style={{ fontSize: 9, color: '#64748b' }}>{g.stan}</span>
                                    {g.strumien && onGosc && (
                                        <button onClick={() => onGosc(g.strumien, g.nazwa)}
                                            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.45)', borderRadius: 8, color: '#6ee7b7', fontSize: 9, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            → NA PULPIT
                                        </button>
                                    )}
                                </div>
                            )) : (
                                <div style={{ fontSize: 9, color: '#64748b' }}>
                                    Żaden telefon nie wszedł. Zeskanuj kod i naciśnij NADAWAJ.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Sony 4K i granica Bluetootha ── */}
                    <div style={{ ...karta, borderColor: 'rgba(251,191,36,0.22)' }}>
                        <div style={etykieta}>🎥 Sony 4K — trzy drogi, jedna niemożliwa</div>
                        <div style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.7 }}>
                            <b style={{ color: '#fca5a5' }}>Bluetooth odpada.</b> Przenosi ~2 Mb/s, a obraz 1080p
                            potrzebuje kilkunastu. To granica fizyczna — aparat sparowany po BT
                            <b> nigdy</b> nie pojawi się na liście kamer. BT służy tam do migawki,
                            geotagowania i kopiowania zdjęć.<br /><br />
                            <b style={{ color: '#6ee7b7' }}>Działa:</b><br />
                            1. <b>HDMI → grabber USB</b> (przechwytywacz UVC) — najpewniejsza droga,
                            aparat staje się zwykłą kamerą.<br />
                            2. <b>USB-C + Imaging Edge Webcam</b> — nowsze Sony potrafią nadawać obraz
                            wprost przez USB.<br />
                            3. <b>Kamera wirtualna</b> — jeśli producent daje własny sterownik.<br /><br />
                            Po każdej z nich kliknij <b>ODŚWIEŻ</b> wyżej — urządzenie wskoczy na listę.
                        </div>
                    </div>

                    {log.length > 0 && (
                        <div style={{ ...karta, padding: 8 }}>
                            <div style={etykieta}>Dziennik połączeń</div>
                            {log.map((l, i) => (
                                <div key={i} style={{ fontSize: 9, color: '#64748b', lineHeight: 1.6 }}>{l}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PanelPodlaczen;
