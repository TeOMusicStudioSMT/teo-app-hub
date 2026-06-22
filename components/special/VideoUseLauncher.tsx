/**
 * 🎬 VideoUseLauncher — montaż wideo słowem (VideO-Use) + teleport do Story V2
 *
 * Opisujesz montaż → most (POST /api/video/edit) sprawdza drożność ffmpeg,
 * skanuje folder źródeł i zwraca PLAN (EDL). Przycisk „Teleportuj do Story V2"
 * otwiera satelitę z misją w Query Params. Pełne cięcie słów-wypełniaczy
 * realizuje skill video-use + ElevenLabs Scribe po stronie Story V2.
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { teleportToStory } from '../../lib/teleport';

const BRIDGE = 'http://127.0.0.1:3001';

interface EditPlan {
    ffmpeg: { available: boolean; version: string };
    sources: { name: string; sizeMB: number }[];
    sourceCount: number;
    plan: string[];
    note: string;
}

export const VideoUseLauncher: React.FC = () => {
    const [mission, setMission]   = useState('Zmontuj vlog ze spawania — usuń „yyy/eee", napisy UPPERCASE, 30ms fade');
    const [sourceDir, setSourceDir] = useState('media/move');
    const [subtitleStyle]         = useState('2-word UPPERCASE');
    const [audioFadeMs]           = useState(30);
    const [plan, setPlan]         = useState<EditPlan | null>(null);
    const [loading, setLoading]   = useState(false);
    const [status, setStatus]     = useState('');

    const buildPlan = useCallback(async () => {
        setLoading(true); setStatus('⟳ Sprawdzam rury i skanuję źródła...'); setPlan(null);
        try {
            const r = await fetch(`${BRIDGE}/api/video/edit`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceDir, mission, subtitleStyle, audioFadeMs }),
            });
            if (!r.ok) throw new Error('most offline');
            const out = await r.json();
            if (!out.success) throw new Error(out.message || 'błąd');
            setPlan(out);
            setStatus(out.note);
        } catch (e: any) {
            setStatus(`⚠ Most niedostępny (${e.message}) — uruchom Wiesio-Bridge (port 3001)`);
        } finally {
            setLoading(false);
        }
    }, [sourceDir, mission, subtitleStyle, audioFadeMs]);

    const teleport = useCallback(() => {
        teleportToStory({ mission, sourceDir, subtitleStyle, audioFadeMs, returnUrl: window.location.href });
        setStatus('🎬 Teleportowano misję do Story V2 (nowa karta)');
    }, [mission, sourceDir, subtitleStyle, audioFadeMs]);

    return (
        <div style={{ background: 'rgba(8,10,18,.6)', border: '1px solid rgba(236,72,153,.2)', borderRadius: 12, padding: 14, marginTop: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'rgba(236,72,153,.55)' }}>∴ KATEDRA OTAKOS · MONTAŻYSTA ∴</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fbe2f0' }}>🎬 VideO-Use</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>Montaż słowem — surowy materiał → final.mp4 (skill po stronie Story V2)</div>

            <label style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em' }}>MISJA MONTAŻU</label>
            <textarea value={mission} onChange={e => setMission(e.target.value)} rows={2}
                style={{ width: '100%', marginTop: 4, marginBottom: 8, padding: '8px 10px', borderRadius: 6, resize: 'vertical',
                    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(236,72,153,.2)', color: '#f5e6f0',
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }} />

            <label style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em' }}>FOLDER ŹRÓDEŁ (w projekcie)</label>
            <input value={sourceDir} onChange={e => setSourceDir(e.target.value)}
                style={{ width: '100%', marginTop: 4, marginBottom: 10, padding: '7px 10px', borderRadius: 6,
                    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(236,72,153,.2)', color: '#f5e6f0',
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <motion.button whileTap={{ scale: 0.95 }} onClick={buildPlan} disabled={loading}
                    style={{ padding: '7px 16px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
                        border: '1px solid rgba(236,72,153,.5)', background: 'rgba(236,72,153,.12)', color: '#f9a8d4', opacity: loading ? 0.6 : 1 }}>
                    {loading ? '⟳ ANALIZA...' : '🔍 SPRAWDŹ RURY + PLAN'}
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={teleport}
                    style={{ padding: '7px 16px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: '1px solid rgba(167,139,250,.5)', background: 'rgba(167,139,250,.12)', color: '#c4b5fd' }}>
                    🚀 TELEPORTUJ DO STORY V2
                </motion.button>
            </div>

            {plan && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10, marginBottom: 6 }}>
                        <span style={{ color: plan.ffmpeg.available ? '#4ade80' : '#f87171' }}>
                            {plan.ffmpeg.available ? '✅ ffmpeg OK' : '⚠ brak ffmpeg'}
                        </span>
                        <span style={{ color: 'rgba(0,229,255,.7)' }}>🎞️ {plan.sourceCount} źródeł</span>
                    </div>
                    {plan.sources.length > 0 && (
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>
                            {plan.sources.map(s => `${s.name} (${s.sizeMB}MB)`).join(' · ')}
                        </div>
                    )}
                    <ol style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: 'rgba(232,223,200,.7)', lineHeight: 1.6 }}>
                        {plan.plan.map((p, i) => <li key={i}>{p.replace(/^\d+\.\s*/, '')}</li>)}
                    </ol>
                </motion.div>
            )}

            {status && <div style={{ fontSize: 8, color: 'rgba(255,255,255,.35)', marginTop: 8, letterSpacing: '.05em' }}>{status}</div>}
        </div>
    );
};

export default VideoUseLauncher;
