/**
 * 🗣️ Głos TeOgochi — wybór barwy z tych samych głosów, których używają aktorzy w wywiadach (profile Katedry
 * i VoiceStudio). Zapis: `PUT /api/glos/stado {id, glos}` (services/GlosyStada.js); most podstawia tę barwę
 * wszędzie, gdzie ten TeOgochi mówi (Orb, panel, rozmowa, Delegat). „Piper (domyślny)” = dawny tor.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Mic } from 'lucide-react';

const MOST = 'http://127.0.0.1:3001';
interface Glos { profil?: string; voicestudio?: string }
interface Glosy { katedra: { id: string; nazwa: string; przewod: string; probkaIstnieje: boolean }[]; voicestudio: { zywe: boolean; profile: { id: string; nazwa: string }[] } }

const naWartosc = (g: Glos | null | undefined) => (g?.voicestudio ? `voicestudio:${g.voicestudio}` : g?.profil ? `profil:${g.profil}` : '');
const zWartosci = (v: string): Glos | null => (v.startsWith('voicestudio:') ? { voicestudio: v.slice(12) } : v.startsWith('profil:') ? { profil: v.slice(7) } : null);

export const GlosTeogochi: React.FC<{ id: string; imie: string; onTest: (tekst: string) => void }> = ({ id, imie, onTest }) => {
    const [glosy, setGlosy] = useState<Glosy | null>(null);
    const [wartosc, setWartosc] = useState('');
    const [blad, setBlad] = useState('');
    const odswiez = useCallback(async () => {
        try {
            const [g, s] = await Promise.all([
                fetch(`${MOST}/api/glos/glosy`).then((r) => r.json()),
                fetch(`${MOST}/api/glos/stado`).then((r) => r.json()),
            ]);
            if (g.success) setGlosy(g);
            setWartosc(naWartosc(s.glosy?.[id]));
            setBlad(s.success === false ? s.message : '');
        } catch { setBlad('Most milczy — barwy Stada żyją w Katedrze.'); }
    }, [id]);
    useEffect(() => { void odswiez(); }, [odswiez]);

    const zmien = async (v: string) => {
        setWartosc(v);
        try {
            const r = await fetch(`${MOST}/api/glos/stado`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, glos: zWartosci(v) }) });
            const d = await r.json();
            if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
            setBlad('');
            onTest(`Cześć, tu ${imie}. Tak teraz brzmię.`);
        } catch (e) { setBlad(e instanceof Error ? e.message : String(e)); void odswiez(); }
    };

    return (
        <div className="p-4 rounded-2xl bg-slate-800/40 border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Mic className="w-4 h-4 text-fuchsia-400" />
                <span>GŁOS (BARWA TEGO TEOGOCHI)</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
                <select value={wartosc} onChange={(e) => void zmien(e.target.value)}
                    className="w-full sm:w-80 rounded-xl border border-slate-700 bg-black/60 px-3 py-2 text-xs text-slate-200 outline-none focus:border-fuchsia-500">
                    <option value="">Piper (domyślny, lokalny)</option>
                    {!!glosy?.katedra.length && (
                        <optgroup label="Profile Katedry (jak aktorzy)">
                            {glosy.katedra.map((p) => <option key={p.id} value={`profil:${p.id}`}>{p.nazwa} · {p.przewod}</option>)}
                        </optgroup>
                    )}
                    {!!glosy?.voicestudio.profile.length && (
                        <optgroup label={`VoiceStudio${glosy.voicestudio.zywe ? '' : ' (śpi)'}`}>
                            {glosy.voicestudio.profile.map((p) => <option key={p.id} value={`voicestudio:${p.id}`}>{p.nazwa}</option>)}
                        </optgroup>
                    )}
                </select>
                <button onClick={() => onTest(`Cześć, tu ${imie}.`)} className="rounded-xl border border-fuchsia-500/40 px-3 py-2 text-xs text-fuchsia-200 hover:bg-fuchsia-500/10">▶ posłuchaj</button>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
                {wartosc ? 'Ta barwa gra wszędzie, gdzie mówi ten TeOgochi (Orb, rozmowa, Delegat). Gdy jej silnik śpi, Katedra wraca do Pipera.' : 'Barwy z wywiadów: profile Katedry (klon, Kokoro…) i VoiceStudio. Tekst przed mową jest czyszczony z emoji i znaczników.'}
            </p>
            {glosy && !glosy.voicestudio.zywe && <p className="text-[11px] text-amber-300/80">VoiceStudio (:3900) śpi — jego głosy zabrzmią, gdy go odpalisz.</p>}
            {blad && <p className="text-[11px] text-amber-300">⚠ {blad}</p>}
        </div>
    );
};

export default GlosTeogochi;
