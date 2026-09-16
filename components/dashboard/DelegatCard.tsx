/**
 * 📱🕊️ DelegatCard — Delegat Mobilny na pulpicie Katedry.
 *
 * Trzy rzeczy, które Suweren ma tu widzieć:
 *  1. KOD QR na telefon — strona /delegat przez Kwantowy Tunel, z kluczem Straży
 *     we fragmencie. Bez tunelu karta mówi wprost, że QR nie powstanie.
 *  2. CO PRZYSZŁO Z TELEFONU — ostatnie fakty (po „zakończ i zapisz") i żywy
 *     ogon rozmów ze strumienia szyny.
 *  3. RĘCE NA TELEFONIE (Artemis) — czy daemon żyje i jakie urządzenie widzi.
 *     Gdy nie żyje, pokazujemy podpowiedź mostu (instalacja to decyzja Suwerena).
 * Nasłuch do Mózgu Orbity jest w App.tsx — karta go nie dubluje.
 */
import React, { useEffect, useState } from 'react';
import DashboardCard from '../DashboardCard';
import { Smartphone, QrCode, RefreshCw, Copy } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'react-hot-toast';
import { getTunnelUrl } from '../../lib/bridgeService';
import { adresDelegataNaTelefon, pobierzFakty, pobierzProfile, sluchajTelefonu, type FaktZTelefonu, type ProfilDelegata, type ZdarzenieSzyny } from '../../lib/teogochiDelegate';

const MOST = 'http://127.0.0.1:3001';

interface StanArtemisa { zywy: boolean; urzadzenia: Array<{ serial?: string; model?: string; state?: string }>; blad?: string; hint?: string; baza: string; }

export const DelegatCard: React.FC = () => {
    const [profile, setProfile] = useState<ProfilDelegata[]>([]);
    const [profil, setProfil] = useState('joanna');
    const [qr, setQr] = useState<string | null>(null);
    const [fakty, setFakty] = useState<FaktZTelefonu[]>([]);
    const [zywe, setZywe] = useState<ZdarzenieSzyny[]>([]);
    const [artemis, setArtemis] = useState<StanArtemisa | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const tunel = getTunnelUrl();
    const adres = adresDelegataNaTelefon(profil);

    const odswiez = async () => {
        try {
            const [p, f, a] = await Promise.all([
                pobierzProfile(),
                pobierzFakty(8),
                fetch(`${MOST}/api/telefon/stan`).then((r) => r.json()).catch(() => null),
            ]);
            setProfile(p.profile); setFakty(f); setArtemis(a); setBlad(null);
        } catch (e) { setBlad((e as Error).message); }
    };

    useEffect(() => { void odswiez(); }, []);
    useEffect(() => {
        if (!adres) { setQr(null); return; }
        QRCode.toDataURL(adres, { margin: 1, width: 200, color: { dark: '#0b0f1a', light: '#f5f3ff' } }).then(setQr).catch(() => setQr(null));
    }, [adres]);
    useEffect(() => sluchajTelefonu((z) => setZywe((prev) => [z, ...prev].slice(0, 6))), []);

    const kopiuj = async () => {
        if (!adres) return;
        try { await navigator.clipboard.writeText(adres); toast.success('Link na telefon skopiowany'); }
        catch { toast.error('Skopiuj ręcznie z paska poniżej'); }
    };

    const wybrany = profile.find((p) => p.id === profil);

    return (
        <DashboardCard
            title="Delegat Mobilny"
            icon={<Smartphone className="w-5 h-5 text-violet-400" />}
            extra={<button onClick={odswiez} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400" title="Odśwież"><RefreshCw className="w-3.5 h-3.5" /></button>}
        >
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5">
                {/* QR + wybór TeOgochi */}
                <div className="flex flex-col items-center gap-2 min-w-[200px]">
                    <select value={profil} onChange={(e) => setProfil(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white">
                        {profile.length ? profile.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.imie} — {p.dziedzina}</option>) : <option value="joanna">🕊️ Joanna</option>}
                    </select>
                    {qr ? (
                        <img src={qr} alt="Kod QR — Delegat na telefonie" className="rounded-xl border border-violet-500/30 w-[200px] h-[200px]" />
                    ) : (
                        <div className="w-[200px] h-[200px] rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-center text-[11px] text-slate-500 p-3">
                            <span><QrCode className="w-5 h-5 mx-auto mb-1 opacity-60" />{tunel ? 'Generuję QR…' : 'Brak Kwantowego Tunelu — wpisz adres tunelu w karcie Tunelu, wtedy powstanie QR na telefon.'}</span>
                        </div>
                    )}
                    {adres && (
                        <button onClick={kopiuj} className="w-full px-2 py-1.5 rounded-lg text-[10px] font-mono bg-violet-600/70 hover:bg-violet-600 text-white flex items-center justify-center gap-1.5">
                            <Copy className="w-3 h-3" /> Skopiuj link na telefon
                        </button>
                    )}
                    {wybrany && (
                        <p className="text-[10px] text-slate-500 leading-snug text-center">
                            Z tunelu: {wybrany.narzedziaZdalne.join(', ')}
                        </p>
                    )}
                </div>

                {/* Z telefonu + Artemis */}
                <div className="space-y-3 min-w-0">
                    {blad && <p className="text-[11px] text-amber-300">Most nie odpowiada: {blad}</p>}

                    <div>
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Na żywo z telefonu</span>
                        {zywe.length ? (
                            <ul className="mt-1 space-y-1">
                                {zywe.map((z) => (
                                    <li key={z.id} className="text-[11px] text-slate-300 truncate"><span className="text-violet-300 font-mono">{z.agent}</span> · {z.tresc}</li>
                                ))}
                            </ul>
                        ) : <p className="text-[11px] text-slate-500 mt-1">Cisza — nikt teraz nie rozmawia z Delegatem.</p>}
                    </div>

                    <div>
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Fakty zapisane z rozmów</span>
                        {fakty.length ? (
                            <ul className="mt-1 space-y-1">
                                {fakty.map((f, i) => (
                                    <li key={`${f.rozmowaId}-${i}`} className="text-[11px] text-slate-200"><span className="text-slate-500 font-mono">{new Date(f.kiedy).toLocaleDateString('pl-PL')}</span> · {f.tresc}</li>
                                ))}
                            </ul>
                        ) : <p className="text-[11px] text-slate-500 mt-1">Jeszcze żadnych — na telefonie „Zakończ i zapisz fakty" wysyła je tu i do Mózgu Orbity.</p>}
                    </div>

                    <div className={`rounded-xl border p-2.5 ${artemis?.zywy ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/40'}`}>
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Ręce na telefonie (Artemis)</span>
                        {artemis?.zywy ? (
                            <p className="text-[11px] text-emerald-300 mt-1">
                                Daemon żyje ({artemis.baza}). Urządzenia: {artemis.urzadzenia.length ? artemis.urzadzenia.map((u) => u.serial || u.model || '?').join(', ') : 'żadne podpięte'}.
                            </p>
                        ) : (
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                                Nie działa. {artemis?.hint ?? 'Artemis (github.com/google/artemis) steruje Androidem podpiętym do tej maszyny — instalacja to Twoja decyzja.'}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
};

export default DelegatCard;
