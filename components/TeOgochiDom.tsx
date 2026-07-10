/**
 * 🐣 TeOgochiDom — dom małego kompana (mini-moduł tamagotchi przy radiu).
 *
 * Wychowujesz go MUZYKĄ: słuchanie radia karmi (tick w KatedraRadioPlayer),
 * smakołyki to wektory soniczne, głaskanie poprawia humor. XP prowadzi przez
 * etapy jajko→legenda. Nastrój wpływa na jego żywe komentarze (AI dostaje
 * stage+mood). Stan lokalny (localStorage) — kompan jest TWÓJ, nie chmury.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKatedraRadio } from '../context/KatedraRadioContext';
import {
    loadTeogochi, saveTeogochi, feedTreat, pet as petAction,
    stageOf, nextStageOf, moodLabel, type TeogochiState,
} from '../lib/teogochiState';

const BRIDGE = 'http://127.0.0.1:3001';

const Bar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>
            <span>{label}</span><span>{Math.round(value)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <motion.div animate={{ width: `${value}%` }} transition={{ duration: 0.6 }}
                style={{ height: '100%', borderRadius: 3, background: color, boxShadow: `0 0 8px ${color}` }} />
        </div>
    </div>
);

export const TeOgochiDom: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const radio = useKatedraRadio();
    const [s, setS] = useState<TeogochiState>(() => loadTeogochi());
    const [speech, setSpeech] = useState('');
    const [wiggle, setWiggle] = useState(0);

    // Odśwież stan (tick karmienia żyje w KatedraRadioPlayer — tu tylko czytamy)
    useEffect(() => {
        const iv = setInterval(() => setS(loadTeogochi()), 5_000);
        return () => clearInterval(iv);
    }, []);

    const stage = stageOf(s.xp);
    const next = nextStageOf(s.xp);
    const isEgg = stage.stage === 'jajko';
    const nastroj = moodLabel(s);

    const say = useCallback(async (context: string) => {
        try {
            const r = await fetch(`${BRIDGE}/api/teogochi/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    track: radio.currentTrack?.title, lyric: context,
                    stage: stage.stage, mood: nastroj, name: s.name,
                }),
            });
            const d = await r.json();
            setSpeech(d.comment || (isEgg ? '...(ciche pukanie od środka)...' : 'Ćwir!'));
        } catch {
            setSpeech(isEgg ? '...(jajko lekko drży)...' : 'Ćwir? (most milczy)');
        }
    }, [radio.currentTrack, stage.stage, nastroj, isEgg, s.name]);

    // ⛪ Chrzcielnica — nadaj imię (bogini dostaje żeńską formę w komentarzach AI)
    const handleRename = () => {
        const newName = window.prompt('Nadaj imię swojemu kompanowi:', s.name);
        if (!newName || !newName.trim()) return;
        const next = { ...s, name: newName.trim().slice(0, 24) };
        saveTeogochi(next); setS(next);
        say(`Suweren właśnie uroczyście ochrzcił Cię imieniem ${next.name}`);
    };

    const handlePet = () => {
        const { state, ok } = petAction(s);
        saveTeogochi(state); setS(state);
        setWiggle(w => w + 1);
        if (ok) say(isEgg ? 'ktoś czule pogłaskał Twoją skorupkę' : 'Suweren właśnie Cię pogłaskał');
        else setSpeech(isEgg ? '...(skorupka jeszcze ciepła od głaskania)...' : 'Hej, dopiero co! Daj odetchnąć 😊');
    };

    const handleTreat = () => {
        const { state, ok } = feedTreat(s);
        saveTeogochi(state); setS(state);
        setWiggle(w => w + 1);
        if (ok) say('dostał pyszny smakołyk: świeży wektor soniczny');
        else setSpeech('Brzuszek pełny — smakołyk za jakiś czas! 🫧');
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            style={{
                width: 300, padding: 18, borderRadius: 18,
                background: 'linear-gradient(160deg, rgba(12,10,24,0.98), rgba(6,5,14,0.98))',
                border: '1px solid rgba(251,191,36,0.3)',
                boxShadow: '0 0 34px rgba(251,191,36,0.12)',
                fontFamily: "'JetBrains Mono', monospace",
            }}
        >
            {/* Nagłówek */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: 8, letterSpacing: '0.25em', color: 'rgba(251,191,36,0.55)' }}>
                        ∴ DOM {s.name.toUpperCase()} ∴
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fde68a', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {stage.title}
                        <button onClick={handleRename} title="Chrzcielnica — nadaj imię"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, opacity: 0.6, padding: 0 }}>
                            ✏️
                        </button>
                    </div>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#64748b', width: 26, height: 26, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Stworzonko */}
            <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
                <motion.div
                    key={wiggle}
                    animate={isEgg
                        ? { rotate: [0, -6, 6, -4, 4, 0] }
                        : { y: [0, -8, 0], rotate: [0, -4, 4, 0] }}
                    transition={{ duration: 1.1, ease: 'easeInOut' }}
                    style={{ fontSize: 64, lineHeight: 1, filter: s.mood < 30 ? 'grayscale(0.6)' : 'none', display: 'inline-block', cursor: 'pointer' }}
                    onClick={handlePet}
                    title="Pogłaszcz"
                >
                    {stage.emoji}
                </motion.div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                    {isEgg ? 'Wykluje się od słuchania muzyki...' : `nastrój: ${nastroj}`}
                </div>
            </div>

            {/* Dymek mowy */}
            <AnimatePresence mode="wait">
                {speech && (
                    <motion.div key={speech}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ margin: '8px 0 4px', padding: '8px 10px', borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', fontSize: 10, color: '#fef3c7', lineHeight: 1.5 }}>
                        {speech}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Statystyki */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
                <Bar label="SYTOŚĆ (karmi muzyka)" value={s.satiety} color="#4ade80" />
                <Bar label="NASTRÓJ" value={s.mood} color="#c084fc" />
                {next && (
                    <Bar label={`ROZWÓJ → ${next.stage.toUpperCase()}`}
                        value={((s.xp - stage.minXp) / (next.minXp - stage.minXp)) * 100} color="#fbbf24" />
                )}
            </div>

            {/* Akcje */}
            <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleTreat}
                    style={{ flex: 1, padding: '8px 6px', borderRadius: 9, border: '1px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.08)', color: '#86efac', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🎵 SMAKOŁYK
                </button>
                <button onClick={handlePet}
                    style={{ flex: 1, padding: '8px 6px', borderRadius: 9, border: '1px solid rgba(192,132,252,0.4)', background: 'rgba(192,132,252,0.08)', color: '#d8b4fe', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🫳 POGŁASZCZ
                </button>
            </div>

            {/* Stopka metryk życia */}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                <span>♪ {s.minutesListened} min muzyki</span>
                <span>XP {s.xp}</span>
                <span>{s.hatchedAt ? `wykluty ${new Date(s.hatchedAt).toLocaleDateString()}` : 'w jajku'}</span>
            </div>
        </motion.div>
    );
};

export default TeOgochiDom;
