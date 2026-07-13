/**
 * 🎬🎵 TeledyskPanel — Kreator teledysku (Music V2 × VideO-Use, Punkt 4 UI)
 *
 * Pełna pętla twórcza w jednym panelu:
 *   1. 📖 Opowieść  — LLM pisze storyboard z tytułu + tekstu + energii (/storyboard)
 *   2. 🎨 Sceny     — generuje WŁASNE sceny z opisu (3 tryby: proc/sd/gemini) (/scene)
 *   3. 🎵 Beaty     — podgląd cięć zsynchronizowanych z basem (/plan)
 *   4. 🎬 Render    — beat-sync montaż → teledysk.mp4 (/render)
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

const BRIDGE = 'http://127.0.0.1:3001';

interface Seg { from: number; to: number; fx: string; intensity: number; }
interface Plan { cutCount: number; segments: Seg[]; }
interface Scene { mood: string; desc: string; keywords?: string[]; }

const FX_COLOR: Record<string, string> = { 'punch-zoom': '#f59e0b', 'flash-cut': '#22d3ee', 'soft-fade': '#a78bfa' };
const MODES = [
    { id: 'proc',   label: '🟢 Proc 0.00G', hint: 'ffmpeg lavfi — zero AI, lokalnie' },
    { id: 'sd',     label: '🔵 Stable Diff', hint: 'lokalny SD (txt2img)' },
    { id: 'gemini', label: '🟣 Imagen',     hint: 'chmura (klucz Gemini)' },
];

interface TeledyskPanelProps {
    /** Prefill z przylotu Music V2 (audio dograne przez /api/teledysk/stage-audio) */
    initialAudioFile?: string;
    initialTitle?: string;
}

export const TeledyskPanel: React.FC<TeledyskPanelProps> = ({ initialAudioFile, initialTitle }) => {
    const [title, setTitle]         = useState(initialTitle || 'Triple Sun Alignment');
    const [sonicFile, setSonicFile] = useState('_OtakOs_Sonic/SonicVectors_014EN_2026-06-11T10-02-58-789Z.json');
    const [audioFile, setAudioFile] = useState(initialAudioFile || "_OtakOs_Muzyka/OtakOS RADIO Album's/8 June Protocol/1. Triple_Sun_Alignment.wav");
    const [sourceDir, setSourceDir] = useState('_OtakOs_Move');
    const [lyricsFile, setLyricsFile] = useState('');
    const [sceneMode, setSceneMode] = useState('proc');
    const [storyboard, setStoryboard] = useState<Scene[] | null>(null);
    const [plan, setPlan]           = useState<Plan | null>(null);
    const [busy, setBusy]           = useState(false);
    const [status, setStatus]       = useState('');
    const [output, setOutput]       = useState('');

    const call = async (path: string, body: any) => {
        const r = await fetch(`${BRIDGE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const d = await r.json();
        if (!d.success) throw new Error(d.message || 'błąd');
        return d;
    };

    const writeStory = useCallback(async () => {
        setBusy(true); setStatus('📖 Reżyser pisze storyboard (lokalny model)...'); setStoryboard(null);
        try {
            const d = await call('/api/teledysk/storyboard', { title, lyricsFile: lyricsFile || undefined, sonicFile, sceneCount: 6 });
            setStoryboard(d.scenes);
            setStatus(`✅ Opowieść: ${d.scenes.length} scen ${d.usedLLM ? `(model: ${d.model})` : '(szkielet — rdzeń offline)'}`);
        } catch (e: any) { setStatus(`⚠ Opowieść: ${e.message} — Ollama musi działać (tryb proc i tak zadziała)`); }
        finally { setBusy(false); }
    }, [title, lyricsFile, sonicFile]);

    const genScenes = useCallback(async () => {
        if (!storyboard?.length) { setStatus('⚠ Najpierw napisz opowieść (📖)'); return; }
        setBusy(true); setOutput('');
        try {
            for (let i = 0; i < storyboard.length; i++) {
                setStatus(`🎨 Generuję scenę ${i + 1}/${storyboard.length} (${sceneMode})...`);
                await call('/api/teledysk/scene', { desc: storyboard[i].desc, mood: storyboard[i].mood, mode: sceneMode, duration: 3 });
            }
            setSourceDir('_OtakOs_Move/scenes');
            setStatus(`✅ Wygenerowano ${storyboard.length} scen → źródło ustawione na _OtakOs_Move/scenes`);
        } catch (e: any) { setStatus(`⚠ Sceny (${sceneMode}): ${e.message}`); }
        finally { setBusy(false); }
    }, [storyboard, sceneMode]);

    const preview = useCallback(async () => {
        setBusy(true); setStatus('🎵 Wykrywam uderzenia...'); setPlan(null); setOutput('');
        try { const d = await call('/api/teledysk/plan', { sonicFile }); setPlan(d); setStatus(`✅ ${d.cutCount} cięć na beat`); }
        catch (e: any) { setStatus(`⚠ ${e.message}`); }
        finally { setBusy(false); }
    }, [sonicFile]);

    const render = useCallback(async () => {
        setBusy(true); setStatus('🎬 Renderuję teledysk (ffmpeg — chwilę to potrwa)...'); setOutput('');
        try {
            const d = await call('/api/teledysk/render', { sonicFile, sourceDir, audioFile, lrcFile: lyricsFile || undefined });
            setOutput(d.output); setStatus(`✅ Teledysk: ${d.segments} cięć z ${d.clipsUsed} źródeł${d.subtitles ? ' · z napisami 🔤' : ''}`);
        } catch (e: any) { setStatus(`⚠ Render: ${e.message}`); }
        finally { setBusy(false); }
    }, [sonicFile, sourceDir, audioFile, lyricsFile]);

    const inp: React.CSSProperties = { width: '100%', marginTop: 3, marginBottom: 7, padding: '6px 9px', borderRadius: 6, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(245,158,11,.22)', color: '#fde68a', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 };
    const lbl: React.CSSProperties = { fontSize: 8, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em' };
    const btn = (bg: string, bd: string, col: string): React.CSSProperties => ({ padding: '6px 13px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: busy ? 'default' : 'pointer', border: `1px solid ${bd}`, background: bg, color: col, opacity: busy ? 0.55 : 1 });
    const maxT = plan?.segments.length ? plan.segments[plan.segments.length - 1].to : 1;

    return (
        <div style={{ background: 'rgba(8,10,18,.6)', border: '1px solid rgba(245,158,11,.22)', borderRadius: 12, padding: 14, marginTop: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'rgba(245,158,11,.55)' }}>∴ KREATOR TELEDYSKU · MUSIC V2 × VIDEO-USE ∴</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fef3c7' }}>🎬🎵 TELEDYSK 0.00G</div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1 }}><label style={lbl}>TYTUŁ</label><input style={inp} value={title} onChange={e => setTitle(e.target.value)} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>TEKST .lrc (opcjonalnie — storyboard + napisy na dole)</label><input style={inp} value={lyricsFile} onChange={e => setLyricsFile(e.target.value)} placeholder="_OtakOs_Muzyka/.../utwor.lrc" /></div>
            </div>
            <label style={lbl}>WEKTORY SONICZNE</label><input style={inp} value={sonicFile} onChange={e => setSonicFile(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><label style={lbl}>AUDIO</label><input style={inp} value={audioFile} onChange={e => setAudioFile(e.target.value)} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>ŹRÓDŁA WIDEO</label><input style={inp} value={sourceDir} onChange={e => setSourceDir(e.target.value)} /></div>
            </div>

            {/* Tryb scen */}
            <label style={lbl}>TRYB WŁASNYCH SCEN</label>
            <div style={{ display: 'flex', gap: 6, margin: '4px 0 10px' }}>
                {MODES.map(m => (
                    <button key={m.id} onClick={() => setSceneMode(m.id)} title={m.hint}
                        style={{ flex: 1, padding: '5px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                            border: `1px solid ${sceneMode === m.id ? 'rgba(245,158,11,.6)' : 'rgba(255,255,255,.1)'}`,
                            background: sceneMode === m.id ? 'rgba(245,158,11,.12)' : 'rgba(255,255,255,.03)',
                            color: sceneMode === m.id ? '#fbbf24' : 'rgba(232,223,200,.6)' }}>
                        {m.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <motion.button whileTap={{ scale: 0.95 }} onClick={writeStory} disabled={busy} style={btn('rgba(167,139,250,.12)', 'rgba(167,139,250,.5)', '#c4b5fd')}>📖 NAPISZ OPOWIEŚĆ</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={genScenes} disabled={busy || !storyboard} style={btn('rgba(245,158,11,.12)', 'rgba(245,158,11,.5)', '#fbbf24')}>🎨 GENERUJ SCENY</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={preview} disabled={busy} style={btn('rgba(34,211,238,.12)', 'rgba(34,211,238,.5)', '#67e8f9')}>🎵 BEATY</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={render} disabled={busy} style={btn('rgba(74,222,128,.12)', 'rgba(74,222,128,.5)', '#86efac')}>🎬 RENDERUJ</motion.button>
            </div>

            {/* Storyboard */}
            {storyboard && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {storyboard.map((s, i) => (
                        <div key={i} style={{ padding: '6px 9px', borderRadius: 6, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(167,139,250,.18)' }}>
                            <div style={{ fontSize: 9, color: '#c4b5fd', fontWeight: 700 }}>#{i + 1} · {s.mood}</div>
                            <div style={{ fontSize: 10, color: 'rgba(232,223,200,.75)' }}>{s.desc}</div>
                            {s.keywords && <div style={{ fontSize: 8, color: 'rgba(245,158,11,.6)', marginTop: 2 }}>{s.keywords.join(' · ')}</div>}
                        </div>
                    ))}
                </motion.div>
            )}

            {/* Beat timeline */}
            {plan && (
                <div style={{ marginTop: 10 }}>
                    <div style={{ position: 'relative', height: 24, background: 'rgba(0,0,0,.3)', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,.06)' }}>
                        {plan.segments.map((s, i) => (
                            <div key={i} title={`${s.fx} @ ${s.from}s`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(s.from / maxT) * 100}%`, width: `${Math.max(0.5, ((s.to - s.from) / maxT) * 100)}%`, background: FX_COLOR[s.fx] || '#888', opacity: 0.25 + s.intensity * 0.6 }} />
                        ))}
                    </div>
                </div>
            )}

            {output && <div style={{ fontSize: 10, color: '#4ade80', marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>📁 {output}</div>}
            {status && <div style={{ fontSize: 9, color: 'rgba(255,255,255,.45)', marginTop: 8 }}>{status}</div>}
        </div>
    );
};

export default TeledyskPanel;
