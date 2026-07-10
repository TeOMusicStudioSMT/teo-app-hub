/**
 * 🐣 TeOgochi.tsx — mały kompan przy Storytellerze.
 *
 * Słucha tego, co gra w Asystencie Muzycznym (KatedraRadioContext: currentTrack,
 * currentLyric, isPlaying) i wrzuca krótki, żywy komentarz (lokalny model przez
 * /api/teogochi/comment). Gdy silnik AI nie odpowie — spada na własne, wbudowane
 * odzywki, żeby nigdy nie stał pusty.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKatedraRadio } from '../context/KatedraRadioContext';
import { loadTeogochi, stageOf, moodLabel } from '../lib/teogochiState';

const FALLBACK_LINES = [
    'Ooo, to brzmi nieźle! 🎵',
    'Ten bas czuję aż w rdzeniu procesora.',
    'Zapisuję ten wers do pamięci... na zawsze.',
    'Mogłbym tego słuchać w nieskończoność. ✨',
    'Coś w tym tekście mnie porusza.',
];

const IDLE_LINE = 'Śpię... obudź mnie muzyką. 💤';
const MIN_INTERVAL_MS = 20000;

export const TeOgochi: React.FC = () => {
    const radio = useKatedraRadio();
    const [comment, setComment] = useState(IDLE_LINE);
    const [isThinking, setIsThinking] = useState(false);
    const lastLyricRef = useRef('');
    const lastFetchRef = useRef(0);

    useEffect(() => {
        if (!radio.isPlaying) {
            setComment(IDLE_LINE);
            lastLyricRef.current = '';
            return;
        }

        const lyric = radio.currentLyric || '';
        const now = Date.now();
        const lyricChanged = lyric && lyric !== lastLyricRef.current;
        const dueForPing = now - lastFetchRef.current > MIN_INTERVAL_MS;
        if (!lyricChanged && !dueForPing) return;

        lastLyricRef.current = lyric;
        lastFetchRef.current = now;

        let cancelled = false;
        (async () => {
            setIsThinking(true);
            try {
                const tg = loadTeogochi();
                const res = await fetch('http://127.0.0.1:3001/api/teogochi/comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        track: radio.currentTrack?.title, lyric,
                        name: tg.name, stage: stageOf(tg.xp).stage, mood: moodLabel(tg),
                    }),
                });
                const data = await res.json();
                if (cancelled) return;
                if (data.success && data.comment) {
                    setComment(data.comment);
                } else {
                    setComment(FALLBACK_LINES[Math.floor(Math.random() * FALLBACK_LINES.length)]);
                }
            } catch {
                if (!cancelled) setComment(FALLBACK_LINES[Math.floor(Math.random() * FALLBACK_LINES.length)]);
            } finally {
                if (!cancelled) setIsThinking(false);
            }
        })();

        return () => { cancelled = true; };
    }, [radio.isPlaying, radio.currentLyric, radio.currentTrack]);

    return (
        <div className="flex items-start gap-3 px-4 py-3 bg-slate-900/60 border border-purple-500/20 rounded-xl backdrop-blur-sm">
            <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="text-2xl leading-none select-none"
                title="TeOgochi"
            >
                🐣
            </motion.div>
            <AnimatePresence mode="wait">
                <motion.p
                    key={comment}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="text-sm text-purple-200 italic mt-1"
                >
                    {isThinking ? '...' : comment}
                </motion.p>
            </AnimatePresence>
        </div>
    );
};

export default TeOgochi;
