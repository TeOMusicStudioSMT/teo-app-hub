/**
 * 🎬 Panel Klatki — pierwszy panel narzędziowy gatunku TeOgochi (po Domu Joanny).
 *
 * Klatka to agent od filmu. Ten panel NIE udaje montażu: każdy przycisk woła
 * trasę mostu, którą wcześniej zmierzyliśmy na żywo.
 *
 *   · materiał   → POST /api/bridge/execute  {action:'LIST_DIRECTORY', target:'MOVE'}
 *   · plan cięć  → POST /api/video/edit      (skan źródeł + EDL)
 *   · sklejenie  → POST /api/bridge/execute  {action:'CONCATENATE_VIDEO', …}
 *
 * ⚠️ POLA IDĄ PŁASKO, nie w `payload`. Most czyta je z korzenia ciała —
 * zagnieżdżenie dawało „HTTP 400: Brak type lub mainVideoFilename" przy każdym
 * zleceniu. Zmierzone i naprawione po obu stronach.
 *
 * ⚠️ Klatka NIE generuje wideo z niczego. Skleja i tnie to, co realnie leży
 * w `_OtakOs_Move`. Gdy tam pusto — mówi to wprost.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Film, RefreshCw, Scissors, Layers, AlertTriangle } from 'lucide-react';
import { rdzenGatunku } from '../../lib/teogochiStado';
import { melduj, zapytajAgenta } from '../../lib/szyna';

const MOST = 'http://127.0.0.1:3001';

type TypSpawu = 'YT' | 'Podcat' | 'Kronika';

async function most<T>(sciezka: string, cialo: unknown): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cialo),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || (d as { success?: boolean }).success === false) {
        // Most ZAWSZE podaje powód w `message` — pokazujemy go, nie sam kod HTTP.
        throw new Error((d as { message?: string }).message || `HTTP ${r.status}`);
    }
    return d as T;
}

export const PanelKlatka: React.FC = () => {
    const [material, setMaterial] = useState<string[]>([]);
    const [wybrany, setWybrany] = useState('');
    const [typ, setTyp] = useState<TypSpawu>('YT');
    const [zajety, setZajety] = useState(false);
    const [log, setLog] = useState<string[]>([]);
    const [blad, setBlad] = useState('');

    const dopisz = (s: string) =>
        setLog(l => [...l.slice(-14), `[${new Date().toLocaleTimeString()}] ${s}`]);

    const odswiezMaterial = useCallback(async () => {
        setZajety(true); setBlad('');
        try {
            const d = await most<{ files?: { name: string; type: string }[] }>(
                '/api/bridge/execute', { action: 'LIST_DIRECTORY', target: 'MOVE' },
            );
            const pliki = (d.files || [])
                .filter(f => f.type === 'file' && /\.(mp4|mov|webm)$/i.test(f.name))
                .map(f => f.name);
            setMaterial(pliki);
            if (pliki.length && !wybrany) setWybrany(pliki[0]);
            dopisz(`📼 Materiał w _OtakOs_Move: ${pliki.length} plik(ów).`);
            void melduj('klatka', 'praca', `Przejrzała materiał: ${pliki.length} plik(ów).`);
        } catch (e) {
            setBlad((e as Error).message);
            setMaterial([]);
        } finally { setZajety(false); }
    }, [wybrany]);

    useEffect(() => { void odswiezMaterial(); }, []);   // raz przy wejściu

    const planCiec = async () => {
        setZajety(true); setBlad('');
        try {
            const d = await most<{ note?: string; sources?: unknown[] }>(
                '/api/video/edit', { sourceDir: '_OtakOs_Move' },
            );
            dopisz(`✂️ Plan gotowy: ${d.note || 'brak notatki'} (${d.sources?.length ?? 0} źródeł)`);
        } catch (e) {
            setBlad((e as Error).message);
        } finally { setZajety(false); }
    };

    const sklej = async () => {
        if (!wybrany) { setBlad('Nie ma czego sklejać — brak wybranego materiału.'); return; }
        setZajety(true); setBlad('');
        dopisz(`🔨 Spawam „${wybrany}" (typ ${typ})…`);
        try {
            // PŁASKO — most czyta te pola z korzenia ciała.
            const d = await most<{ outputFile?: string; outputPath?: string }>(
                '/api/bridge/execute',
                { action: 'CONCATENATE_VIDEO', type: typ, mainVideoFilename: wybrany },
            );
            dopisz(`✅ Gotowe: ${d.outputFile}`);
            void melduj('klatka', 'praca', `Skleiła „${wybrany}" → ${d.outputFile}`);
            dopisz(`📁 ${d.outputPath}`);
        } catch (e) {
            setBlad((e as Error).message);
            dopisz(`⚠️ ${(e as Error).message}`);
        } finally { setZajety(false); }
    };

    // 🎵 Klatka nie zna się na muzyce — pyta Joannę. Pytanie i odpowiedź lądują
    // na szynie, więc widać je w WORKPalace. To jest ta rozmowa między agentami.
    const [radaJoanny, setRadaJoanny] = useState('');
    const spytajJoanne = async () => {
        setZajety(true); setBlad('');
        dopisz('🎵 Pytam Joannę o podkład…');
        try {
            const o = await zapytajAgenta('klatka', 'joanna',
                `Montuję materiał „${wybrany || '(jeszcze nie wybrany)'}" na kanał ${typ}. ` +
                'Jaki podkład muzyczny proponujesz i czego unikać?');
            setRadaJoanny(o);
            dopisz('🎵 Joanna odpowiedziała.');
        } catch (e) {
            setBlad((e as Error).message);
            dopisz(`⚠️ Joanna nie odpowiedziała: ${(e as Error).message}`);
        } finally { setZajety(false); }
    };

    const rdzen = rdzenGatunku('klatka');

    return (
        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-5 space-y-4">
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Film size={18} className="text-cyan-400" />
                    <h3 className="font-bold text-cyan-200">Klatka — warsztat filmu</h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                    rdzeń: {rdzen || 'globalny Katedry'}
                </span>
            </header>

            {blad && (
                <p className="flex items-start gap-2 text-sm text-amber-400">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>{blad}</span>
                </p>
            )}

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <label className="block">
                    <span className="text-[11px] font-mono text-slate-500">materiał z _OtakOs_Move</span>
                    <select
                        value={wybrany}
                        onChange={e => setWybrany(e.target.value)}
                        disabled={!material.length}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-black/40 px-2 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50"
                    >
                        {material.length
                            ? material.map(m => <option key={m} value={m}>{m}</option>)
                            : <option value="">— pusto —</option>}
                    </select>
                </label>

                <label className="block">
                    <span className="text-[11px] font-mono text-slate-500">klocki</span>
                    <select
                        value={typ}
                        onChange={e => setTyp(e.target.value as TypSpawu)}
                        className="mt-1 rounded-lg border border-slate-700 bg-black/40 px-2 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                    >
                        <option value="YT">YT</option>
                        <option value="Podcat">Podcat</option>
                        <option value="Kronika">Kronika</option>
                    </select>
                </label>

                <button
                    onClick={odswiezMaterial}
                    disabled={zajety}
                    title="Przeczytaj katalog jeszcze raz"
                    className="mt-[18px] rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:border-slate-500 disabled:opacity-40"
                >
                    <RefreshCw size={15} className={zajety ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    onClick={planCiec}
                    disabled={zajety}
                    className="flex items-center gap-2 rounded-lg border border-cyan-500/50 px-4 py-2 text-sm font-medium text-cyan-300 disabled:opacity-40"
                >
                    <Scissors size={15} /> Plan cięć (EDL)
                </button>
                <button
                    onClick={sklej}
                    disabled={zajety || !wybrany}
                    className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-40"
                >
                    <Layers size={15} /> Sklej klocki
                </button>
                <button
                    onClick={spytajJoanne}
                    disabled={zajety}
                    title="Klatka nie zna się na muzyce — pyta Joannę"
                    className="flex items-center gap-2 rounded-lg border border-purple-500/50 px-4 py-2 text-sm font-medium text-purple-300 disabled:opacity-40"
                >
                    🎵 Spytaj Joannę
                </button>
            </div>

            {radaJoanny && (
                <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3">
                    <div className="text-[11px] font-mono text-purple-300 mb-1">Joanna radzi:</div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{radaJoanny}</p>
                </div>
            )}

            {!material.length && !blad && (
                <p className="text-xs text-amber-500/80">
                    ⚠ W <code>_OtakOs_Move</code> nie ma materiału wideo. Klatka skleja i tnie to,
                    co tam leży — nie generuje filmu z niczego.
                </p>
            )}

            {log.length > 0 && (
                <pre className="max-h-48 overflow-auto rounded-lg bg-black/50 p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                    {log.join('\n')}
                </pre>
            )}
        </section>
    );
};

export default PanelKlatka;
