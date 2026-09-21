/**
 * 🎭 KartyRol — karty ról TeOgochi w Domu TeOgochi (od 2026-09-21).
 *
 * Most trzyma dwa źródła (services/Persony.js): kanon z repo (`services/persony/`) i karty
 * własne Suwerena (`_OtakOs_Wymiar/persony/`), które wygrywają. Tu Suweren widzi, którą
 * kartę TeOgochi dostaje do promptu (Delegat, Arena, szyna, Kodeks), edytuje ją i w każdej
 * chwili wraca do kanonu. Układ karty (Tożsamość → Misja → Żelazne zasady → Co dostarczasz →
 * Jak pracujesz → Miary) pochodzi z agency-agents (msitarzewski, MIT).
 *
 * Bez mostu sekcja mówi to wprost — nie udaje pustej listy.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Drama, Save, RotateCcw, RefreshCw, Loader2 } from 'lucide-react';
import { GATUNKI } from '../../lib/teogochiGatunki';

const MOST = 'http://127.0.0.1:3001';

interface KartaLista { gatunek: string; imie: string; dziedzina: string; wlasna: boolean; zrodlo?: string; znakow: number; }
interface Karta extends KartaLista { tresc: string; plik: string; }

const KartyRol: React.FC = () => {
    const [lista, setLista] = useState<KartaLista[] | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [otwarta, setOtwarta] = useState<Karta | null>(null);
    const [edycja, setEdycja] = useState('');
    const [pracuje, setPracuje] = useState(false);
    const [zwiniete, setZwiniete] = useState(true);

    const odswiez = useCallback(async () => {
        try {
            const r = await fetch(`${MOST}/api/persony`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            setLista((await r.json()).persony); setBlad(null);
        } catch (e) { setLista([]); setBlad(`Most nie odpowiada (${(e as Error).message}) — karty żyją w moście.`); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);

    const otworz = async (gatunek: string) => {
        setPracuje(true);
        try {
            const r = await fetch(`${MOST}/api/persony/${encodeURIComponent(gatunek)}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`);
            setOtwarta(d.karta); setEdycja(d.karta.tresc); setBlad(null);
        } catch (e) { setBlad((e as Error).message); }
        finally { setPracuje(false); }
    };

    const zapisz = async () => {
        if (!otwarta) return;
        setPracuje(true);
        try {
            // Frontmatter odtwarzamy z karty — Suweren edytuje samą treść.
            const naglowek = `---\ngatunek: ${otwarta.gatunek}\nimie: ${otwarta.imie}\ndziedzina: ${otwarta.dziedzina}\nzrodlo: karta własna Suwerena (na bazie: ${otwarta.zrodlo ?? 'kanon'})\nwersja: własna\n---\n`;
            const r = await fetch(`${MOST}/api/persony/${encodeURIComponent(otwarta.gatunek)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tresc: naglowek + edycja }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`);
            setOtwarta(d.karta); setEdycja(d.karta.tresc);
            await odswiez();
        } catch (e) { setBlad((e as Error).message); }
        finally { setPracuje(false); }
    };

    const przywrocKanon = async () => {
        if (!otwarta || !window.confirm(`Usunąć własną kartę „${otwarta.imie}" i wrócić do kanonu z repo?`)) return;
        setPracuje(true);
        try {
            await fetch(`${MOST}/api/persony/${encodeURIComponent(otwarta.gatunek)}`, { method: 'DELETE' });
            await odswiez(); await otworz(otwarta.gatunek);
        } catch (e) { setBlad((e as Error).message); }
        finally { setPracuje(false); }
    };

    const zmieniona = otwarta ? edycja !== otwarta.tresc : false;
    const kolor = (id: string) => GATUNKI.find(g => g.id === id)?.kolor ?? '#94a3b8';

    return (
        <section className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-4 space-y-3">
            <button onClick={() => setZwiniete(v => !v)} className="w-full flex items-center gap-2 text-left">
                <Drama className="w-4 h-4 text-fuchsia-300" />
                <span className="text-sm font-bold text-fuchsia-200">Karty ról</span>
                <span className="text-[11px] text-slate-500 ml-1">— co każdy TeOgochi dostaje do promptu: tożsamość, misja, żelazne zasady, proces, miary</span>
                <span className="ml-auto text-[10px] font-mono text-slate-500">{lista ? `${lista.length} kart · ${lista.filter(k => k.wlasna).length} własnych` : '…'} {zwiniete ? '▸' : '▾'}</span>
            </button>

            {!zwiniete && (
                <>
                    {blad && <p className="text-[11px] text-amber-300">{blad}</p>}
                    <div className="flex flex-wrap gap-1.5">
                        {(lista ?? []).map(k => (
                            <button key={k.gatunek} onClick={() => otworz(k.gatunek)} title={`${k.dziedzina} · ${k.znakow} znaków`}
                                className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${otwarta?.gatunek === k.gatunek ? 'bg-white/10 border-white/30' : 'bg-black/30 border-white/10 hover:bg-white/5'}`}
                                style={{ color: kolor(k.gatunek) }}>
                                {k.imie}{k.wlasna ? <span className="ml-1 text-[9px] text-amber-300">własna</span> : null}
                            </button>
                        ))}
                        <button onClick={odswiez} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500" title="Odśwież"><RefreshCw className="w-3.5 h-3.5" /></button>
                    </div>

                    {otwarta && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="font-bold" style={{ color: kolor(otwarta.gatunek) }}>{otwarta.imie}</span>
                                <span className="text-slate-500">{otwarta.dziedzina}</span>
                                <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] ${otwarta.wlasna ? 'bg-amber-900/40 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>{otwarta.wlasna ? 'karta własna' : 'kanon z repo'}</span>
                                {otwarta.zrodlo && <span className="text-slate-600 truncate max-w-[50%]" title={otwarta.zrodlo}>{otwarta.zrodlo}</span>}
                            </div>
                            <textarea value={edycja} onChange={e => setEdycja(e.target.value)} spellCheck={false} rows={18}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-[12px] font-mono text-slate-200 outline-none focus:border-fuchsia-500/50 leading-relaxed" />
                            <div className="flex flex-wrap gap-2">
                                <button onClick={zapisz} disabled={pracuje || !zmieniona} className="px-3 py-1.5 rounded-lg text-[11px] font-mono bg-fuchsia-700/70 hover:bg-fuchsia-600 text-white disabled:opacity-40 flex items-center gap-1.5">
                                    {pracuje ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Zapisz jako własną
                                </button>
                                {otwarta.wlasna && (
                                    <button onClick={przywrocKanon} disabled={pracuje} className="px-3 py-1.5 rounded-lg text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 disabled:opacity-40 flex items-center gap-1.5">
                                        <RotateCcw className="w-3 h-3" /> Przywróć kanon
                                    </button>
                                )}
                                <span className="text-[10px] text-slate-500 self-center">Zmiana działa od następnej rozmowy — bez restartu mostu. Krótko: małe modele gubią długie reguły.</span>
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default KartyRol;
