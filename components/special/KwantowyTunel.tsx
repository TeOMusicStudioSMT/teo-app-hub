/**
 * 🛰️ KwantowyTunel — sterowanie Mostem Czasoprzestrzennym z zewnątrz (FLOMM-7)
 *
 * Pole adresu tunelu Cloudflare + zapis do localStorage (`teodash_tunnel_url`).
 * Pusty adres = powrót do domyślnej Śluzy lokalnej (127.0.0.1:3001).
 *
 * 📡 DISPATCH: generuje kod QR z linkiem `https://graviton.pw/?tunnel=<adres>`.
 * Telefon skanuje → otwiera Katedrę z hostingu → `hydrateTunnelFromLocation()`
 * (index.tsx) zapisuje tunel → telefon liczy na komputerze Suwerena. Zero instalacji.
 *
 * Komponent jest samowystarczalny — można go wstawić w dowolny panel jednym tagiem.
 */

import React, { useState, useEffect } from 'react';
import { Radio, Check, QrCode, Copy } from 'lucide-react';
import QRCode from 'qrcode';
import { getTunnelUrl, setTunnelUrl, buildDispatchUrl, sendCommand } from '../../lib/bridgeService';

/** Baza hostingu Katedry — tu ląduje telefon po zeskanowaniu QR. */
const DISPATCH_BASE = 'https://graviton.pw';

export const KwantowyTunel: React.FC<{ compact?: boolean; dispatchBase?: string }> = ({ compact, dispatchBase = DISPATCH_BASE }) => {
    const [value, setValue] = useState(getTunnelUrl());
    const [saved, setSaved] = useState(getTunnelUrl());
    const [status, setStatus] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);
    const [qr, setQr] = useState<string | null>(null);
    const [showQr, setShowQr] = useState(false);

    const dispatchUrl = saved ? buildDispatchUrl(saved, dispatchBase) : '';

    // Kod QR rysowany lokalnie (biblioteka `qrcode` → data URI). Zero zapytań na zewnątrz.
    useEffect(() => {
        if (!showQr || !dispatchUrl) { setQr(null); return; }
        let alive = true;
        QRCode.toDataURL(dispatchUrl, { margin: 1, width: 240, color: { dark: '#06121a', light: '#e6fbff' } })
            .then(url => { if (alive) setQr(url); })
            .catch(() => { if (alive) setStatus('⚠️ Nie udało się narysować kodu QR.'); });
        return () => { alive = false; };
    }, [showQr, dispatchUrl]);

    const save = () => {
        const next = setTunnelUrl(value);
        setValue(next);
        setSaved(next);
        setStatus(next ? `Tunel zapisany: ${next}` : 'Tunel wyczyszczony — tryb lokalny (127.0.0.1:3001).');
    };

    // Krótki ping przez Śluzę: potwierdza, że smartfon faktycznie dosięga Katedry.
    const test = async () => {
        setTesting(true);
        setStatus('Sonduję tunel...');
        try {
            const res = await sendCommand('PING');
            setStatus(res.success ? '✅ Most odpowiada — Katedra osiągalna.' : `⚠️ ${res.message}`);
        } finally {
            setTesting(false);
        }
    };

    const copyDispatch = async () => {
        if (!dispatchUrl) return;
        try {
            await navigator.clipboard.writeText(dispatchUrl);
            setStatus('📋 Link dla telefonu skopiowany.');
        } catch {
            setStatus(`Skopiuj ręcznie: ${dispatchUrl}`);
        }
    };

    return (
        <div className={`bg-black/50 border border-cyan-500/25 rounded-2xl px-4 py-3 ${compact ? '' : 'mb-3'}`}>
            <div className="flex items-center gap-2 mb-2">
                <Radio size={14} className="text-cyan-400" />
                <span className="text-[11px] font-bold tracking-widest text-cyan-300">KWANTOWY TUNEL URL</span>
                <span className="ml-auto text-[10px] text-slate-500">{saved ? '🌐 zewnętrzny' : '🏠 lokalny'}</span>
            </div>
            <div className="flex gap-2">
                <input
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && save()}
                    placeholder="https://cos-tam.trycloudflare.com"
                    spellCheck={false}
                    className="flex-1 bg-black/60 border border-cyan-700/30 focus:border-cyan-500/60 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                />
                <button onClick={save}
                    className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-cyan-700/70 hover:bg-cyan-600 text-white border border-cyan-400/40 transition-all">
                    <Check size={13} /> Zapisz Tunel
                </button>
                <button onClick={test} disabled={testing} title="Sprawdź połączenie ze Śluzą"
                    className="px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 disabled:opacity-40">
                    {testing ? '...' : 'Test'}
                </button>
            </div>

            {/* 📡 Dispatch na telefon — QR z linkiem do Katedry w hostingu */}
            {saved && (
                <div className="mt-3 pt-3 border-t border-cyan-900/40">
                    <div className="flex gap-2">
                        <button onClick={() => setShowQr(v => !v)}
                            className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-fuchsia-800/50 hover:bg-fuchsia-700/60 text-fuchsia-100 border border-fuchsia-500/30">
                            <QrCode size={13} /> {showQr ? 'Ukryj QR' : 'Dispatch na telefon (QR)'}
                        </button>
                        <button onClick={copyDispatch} title="Skopiuj link dla telefonu"
                            className="px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 flex items-center gap-1.5">
                            <Copy size={13} /> Kopiuj link
                        </button>
                    </div>
                    {showQr && (
                        <div className="mt-3 flex flex-col items-center gap-2">
                            {qr
                                ? <img src={qr} alt="Kod QR z linkiem dispatchowym do Katedry" className="rounded-xl border border-cyan-500/30" />
                                : <div className="text-[10px] text-slate-500 py-6">Rysuję kod...</div>}
                            <div className="text-[10px] text-slate-500 text-center break-all max-w-xs">{dispatchUrl}</div>
                            <div className="text-[10px] text-cyan-300/70">Zeskanuj telefonem — Katedra otworzy się z tunelem w kieszeni.</div>
                        </div>
                    )}
                </div>
            )}

            {status && <div className="mt-2 text-[10px] text-slate-400 break-all">{status}</div>}
        </div>
    );
};

export default KwantowyTunel;
