/**
 * 🎬🎵 TeledyskPanel — Music V2 × VideO-Use (Punkt 4, cegła 3: UI)
 *
 * Bierze wektory soniczne granego utworu, podglądá beat-sync plan cięć
 * (/api/teledysk/plan) i renderuje teledysk (/api/teledysk/render) — cięcia
 * zgrane co do uderzenia basu, efekty wg wokalu/sopranów. Zero chmury.
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

const BRIDGE = 'http://127.0.0.1:3001';

interface Seg { from: number; to: number; fx: string; intensity: number; }
interface Plan { cutCount: number; segments: Seg[]; plan: string[]; note: string; engine: string; }

const FX_COLOR: Record<string, string> = { 'punch-zoom': '#f59e0b', 'flash-cut': '#22d3ee', 'soft-fade': '#a78bfa' };

export const TeledyskPanel: React.FC = () => {
    const [sonicFile, setSonicFile] = useState('_OtakOs_Sonic/Solar_Puso.json');
    const [sourceDir, setSourceDir] = useState('_OtakOs_Move');
    const [audioFile, setAudioFile] = useState('_OtakOs_Muzyka/utwor.mp3');
    const [plan, setPlan] = useState<Plan | null>(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [output, setOutput] = useState('');

    const preview = useCallback(async () => {
        setBusy(true); setStatus('🎵 Czytam wektory soniczne i wykrywam uderzenia...'); setPlan(null); setOutput('');
        try {
            const r = await fetch(`${BRIDGE}/api/teledysk/plan`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sonicFile }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || 'błąd planu');
            setPlan(d);
            setStatus(`✅ ${d.cutCount} cięć zsynchronizowanych z beatem`);
        } catch (e: any) {
            setStatus(`⚠ ${e.message} — sprawdź ścieżkę pliku sonicznego i czy most działa (:3001)`);
        } finally { setBusy(false); }
    }, [sonicFile]);

    const render = useCallback(async () => {
        setBusy(true); setStatus('🎬 Renderuję teledysk (ffmpeg tnie na uderzenia — chwilę to potrwa)...'); setOutput('');
        try {
            const r = await fetch(`${BRIDGE}/api/teledysk/render`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sonicFile, sourceDir, audioFile }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || 'błąd renderu');
            setOutput(d.output);
            setStatus(`✅ Teledysk gotowy: ${d.segments} cięć z ${d.clipsUsed} źródeł`);
        } catch (e: any) {
            setStatus(`⚠ Render: ${e.message}`);
        } finally { setBusy(false); }
    }, [sonicFile, sourceDir, audioFile]);

    const inputStyle: React.CSSProperties = {
        width: '100%', marginTop: 4, marginBottom: 8, padding: '7px 10px', borderRadius: 6,
        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(245,158,11,.25)', color: '#fde68a',
        fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
    };
    const lbl: React.CSSProperties = { fontSize: 9, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em' };

    // mini-timeline beatów
    const maxT = plan?.segments.length ? plan.segments[plan.segments.length - 1].to : 1;

    return (
        <div style={{ background: 'rgba(8,10,18,.6)', border: '1px solid rgba(245,158,11,.22)', borderRadius: 12, padding: 14, marginTop: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'rgba(245,158,11,.55)' }}>∴ MUSIC V2 × VIDEO-USE ∴</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fef3c7' }}>🎬🎵 TELEDYSK 0.00G</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>Cięcia zgrane co do uderzenia basu — z wektorów sonicznych granego utworu.</div>

            <label style={lbl}>WEKTORY SONICZNE (_OtakOs_Sonic)</label>
            <input style={inputStyle} value={sonicFile} onChange={e => setSonicFile(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <label style={lbl}>ŹRÓDŁA WIDEO</label>
                    <input style={inputStyle} value={sourceDir} onChange={e => setSourceDir(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={lbl}>AUDIO</label>
                    <input style={inputStyle} value={audioFile} onChange={e => setAudioFile(e.target.value)} />
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <motion.button whileTap={{ scale: 0.95 }} onClick={preview} disabled={busy}
                    style={{ padding: '7px 16px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
                        border: '1px solid rgba(34,211,238,.5)', background: 'rgba(34,211,238,.12)', color: '#67e8f9', opacity: busy ? 0.6 : 1 }}>
                    🎵 PODGLĄD BEATÓW
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={render} disabled={busy || !plan}
                    style={{ padding: '7px 16px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: busy || !plan ? 'default' : 'pointer',
                        border: '1px solid rgba(245,158,11,.5)', background: 'rgba(245,158,11,.12)', color: '#fbbf24', opacity: busy || !plan ? 0.5 : 1 }}>
                    🎬 RENDERUJ TELEDYSK
                </motion.button>
            </div>

            {plan && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 10 }}>
                    {/* mini-timeline */}
                    <div style={{ position: 'relative', height: 26, background: 'rgba(0,0,0,.3)', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,.06)' }}>
                        {plan.segments.map((s, i) => (
                            <div key={i} title={`${s.fx} @ ${s.from}s`} style={{
                                position: 'absolute', top: 0, bottom: 0,
                                left: `${(s.from / maxT) * 100}%`, width: `${Math.max(0.5, ((s.to - s.from) / maxT) * 100)}%`,
                                background: FX_COLOR[s.fx] || '#888', opacity: 0.25 + s.intensity * 0.6,
                                borderLeft: `1px solid ${FX_COLOR[s.fx] || '#888'}`,
                            }} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 9, fontFamily: "'JetBrains Mono',monospace" }}>
                        {Object.entries(FX_COLOR).map(([fx, c]) => (
                            <span key={fx} style={{ color: c }}>● {fx}</span>
                        ))}
                    </div>
                </motion.div>
            )}

            {output && <div style={{ fontSize: 10, color: '#4ade80', marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>📁 {output}</div>}
            {status && <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', marginTop: 8, letterSpacing: '.04em' }}>{status}</div>}
        </div>
    );
};

export default TeledyskPanel;
