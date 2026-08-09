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
import { useKatedraRadio, type SunoTrack } from '../context/KatedraRadioContext';
import {
    loadTeogochi, saveTeogochi, feedTreat, feedFavorite, pet as petAction,
    stageOf, nextStageOf, moodLabel, type TeogochiState,
} from '../lib/teogochiState';
import {
    loadJoannaPlaylist, addUserTrack, removeUserTrack, isUserTrack, trackIdFrom,
    type JoannaTrack,
} from '../lib/joannaPlaylist';
import {
    powiedzJakKompan, czyGlosWlaczony, ustawGlos, czemuNieSlychac, ucisz,
} from '../lib/glosKompana';

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
    const [glosNa, setGlosNa] = useState<boolean>(() => czyGlosWlaczony());
    // Powód, dla którego mowa NIE zabrzmiała — pokazujemy zamiast udawać, że słychać.
    const [nieSlychac, setNieSlychac] = useState<string | null>(null);

    // Zamknięcie domu ucisza kompana w pół zdania — inaczej mówiłby do pustego ekranu.
    useEffect(() => () => ucisz(), []);

    // 🎶 Playlista smakołyków — rozwijana pod przyciskiem SMAKOŁYK
    const [showList, setShowList] = useState(false);
    const [playlist, setPlaylist] = useState<JoannaTrack[]>([]);
    const [listLoading, setListLoading] = useState(false);

    useEffect(() => {
        if (!showList || playlist.length > 0) return;
        setListLoading(true);
        loadJoannaPlaylist()
            .then(setPlaylist)
            .finally(() => setListLoading(false));
    }, [showList, playlist.length]);

    // Odśwież stan (tick karmienia żyje w KatedraRadioPlayer — tu tylko czytamy)
    useEffect(() => {
        const iv = setInterval(() => setS(loadTeogochi()), 5_000);
        return () => clearInterval(iv);
    }, []);

    const stage = stageOf(s.xp);
    const next = nextStageOf(s.xp);
    const isEgg = stage.stage === 'jajko';
    const nastroj = moodLabel(s);

    // 🔊 JEDNO miejsce, przez które przechodzi wszystko, co kompan „mówi".
    // Wcześniej `setSpeech` było wołane w dziesięciu miejscach i tylko wypełniało
    // dymek — dopisywanie mowy do każdego z osobna gwarantowałoby, że przy
    // następnej zmianie ktoś jedno przeoczy i Joanna wybiórczo zamilknie.
    const powiedz = useCallback((tekst: string) => {
        setSpeech(tekst);
        // Świadomie bez `await`: dymek ma pojawić się natychmiast, a mowa
        // dogonić. Silnik klonu potrafi mielić sekundę i nie ma powodu,
        // żeby UI na niego czekało.
        void powiedzJakKompan(tekst).then(zrodlo => {
            if (zrodlo === 'cisza') setNieSlychac(czemuNieSlychac());
            else if (zrodlo !== 'wylaczony') setNieSlychac(null);
        });
    }, []);

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
            powiedz(d.comment || (isEgg ? '...(ciche pukanie od środka)...' : 'Ćwir!'));
        } catch {
            powiedz(isEgg ? '...(jajko lekko drży)...' : 'Ćwir? (most milczy)');
        }
    }, [radio.currentTrack, stage.stage, nastroj, isEgg, s.name, powiedz]);

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
        else powiedz(isEgg ? '...(skorupka jeszcze ciepła od głaskania)...' : 'Hej, dopiero co! Daj odetchnąć 😊');
    };

    const handleTreat = () => {
        const { state, ok } = feedTreat(s);
        saveTeogochi(state); setS(state);
        setWiggle(w => w + 1);
        if (ok) say('dostał pyszny smakołyk: świeży wektor soniczny');
        else powiedz('Brzuszek pełny — smakołyk za jakiś czas! 🫧');
    };

    // 🎶 Ulubiony utwór = smakołyk grany na żywo. Leci TYM SAMYM torem co radio
    // (jeden odtwarzacz, jeden AudioContext), więc minutowe ticki karmienia
    // działają dalej — eter i playlista karmią identycznie.
    const handlePlayFavorite = (t: JoannaTrack) => {
        const suno: SunoTrack = { id: t.id, title: t.title, audio_url: t.url || '', filename: t.filename };
        radio.playFavorite(suno);

        const { state, ok } = feedFavorite(s);
        saveTeogochi(state); setS(state);
        setWiggle(w => w + 1);
        if (ok) say(`słucha właśnie swojego ulubionego kawałka: „${t.title}"`);
        else powiedz(`Gram „${t.title}" 🎶 (najedzony — ale słucha z przyjemnością)`);
    };

    // ⭐ Zabierz do ulubionych to, co właśnie leci w eterze.
    const handleStarCurrent = () => {
        const cur = radio.currentTrack;
        if (!cur) { powiedz('W eterze cisza — nie ma czego zapisać. 🫧'); return; }
        const source = cur.filename || cur.audio_url || cur.id;
        const entry: JoannaTrack = {
            id: trackIdFrom(source),
            title: cur.title || 'Bez tytułu',
            filename: cur.filename,
            url: cur.filename ? undefined : cur.audio_url,
            note: 'z eteru',
        };
        if (addUserTrack(entry)) {
            setPlaylist(prev => [entry, ...prev.filter(p => p.id !== entry.id)]);
            setShowList(true);
            powiedz(`⭐ „${entry.title}" trafił do smakołyków!`);
        } else {
            powiedz('To już jest w jego ulubionych 😊');
        }
    };

    const handleRemoveFavorite = (id: string) => {
        removeUserTrack(id);
        setPlaylist(prev => prev.filter(p => p.id !== id));
    };

    // Czy dany ulubiony leci właśnie w eterze?
    const isNowPlaying = (t: JoannaTrack): boolean => {
        const cur = radio.currentTrack;
        if (!cur || !radio.isPlaying) return false;
        return (!!t.filename && t.filename === cur.filename) || (!!t.url && t.url === cur.audio_url);
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
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {/* 🔊 Głos kompana. Wyciszenie zapisuje się na stałe i milknie w pół zdania. */}
                    <button
                        onClick={() => {
                            const nowy = !glosNa;
                            ustawGlos(nowy); setGlosNa(nowy);
                            setNieSlychac(null);
                            if (nowy) powiedz(`Znowu mnie słychać. Mówi ${s.name}.`);
                        }}
                        title={glosNa ? `Wycisz ${s.name}` : `Włącz głos — ${s.name} zacznie mówić`}
                        style={{
                            background: glosNa ? 'rgba(251,191,36,0.12)' : 'none',
                            border: `1px solid rgba(251,191,36,${glosNa ? 0.4 : 0.15})`,
                            borderRadius: 8, color: glosNa ? '#fbbf24' : '#64748b',
                            width: 26, height: 26, cursor: 'pointer', fontSize: 11, padding: 0,
                        }}>
                        {glosNa ? '🔊' : '🔇'}
                    </button>
                    <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#64748b', width: 26, height: 26, cursor: 'pointer' }}>✕</button>
                </div>
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

            {/* Dymek się pojawił, ale dźwięku NIE było — mówimy dlaczego, zamiast
                zostawiać Suwerena z pytaniem, czemu kompan jest niemy. */}
            {glosNa && nieSlychac && (
                <div style={{ margin: '0 0 4px', padding: '6px 9px', borderRadius: 9, background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.18)', fontSize: 8, color: '#94a3b8', lineHeight: 1.5 }}>
                    🔇 {nieSlychac}
                </div>
            )}

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
                <button onClick={() => setShowList(v => !v)}
                    title="Rozwiń playlistę ulubionych smakołyków"
                    style={{ flex: 1, padding: '8px 6px', borderRadius: 9, border: `1px solid rgba(74,222,128,${showList ? 0.75 : 0.4})`, background: `rgba(74,222,128,${showList ? 0.16 : 0.08})`, color: '#86efac', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🎵 SMAKOŁYK {showList ? '▲' : '▼'}
                </button>
                <button onClick={handlePet}
                    style={{ flex: 1, padding: '8px 6px', borderRadius: 9, border: '1px solid rgba(192,132,252,0.4)', background: 'rgba(192,132,252,0.08)', color: '#d8b4fe', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🫳 POGŁASZCZ
                </button>
            </div>

            {/* 🎶 Playlista smakołyków */}
            <AnimatePresence>
                {showList && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ marginTop: 8, padding: 8, borderRadius: 11, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.18)' }}>
                            {/* Pasek narzędzi listy */}
                            <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
                                <button onClick={handleStarCurrent}
                                    title="Dodaj utwór grający w eterze do ulubionych"
                                    style={{ flex: 1, padding: '5px 4px', borderRadius: 7, border: '1px solid rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.07)', color: '#fcd34d', fontSize: 8, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em' }}>
                                    ⭐ Z ETERU
                                </button>
                                <button onClick={handleTreat}
                                    title="Klasyczny smakołyk — świeży wektor soniczny (co 10 min)"
                                    style={{ flex: 1, padding: '5px 4px', borderRadius: 7, border: '1px solid rgba(74,222,128,0.35)', background: 'rgba(74,222,128,0.07)', color: '#86efac', fontSize: 8, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em' }}>
                                    🍬 WEKTOR
                                </button>
                            </div>

                            {/* Lista */}
                            <div style={{ maxHeight: 148, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {listLoading ? (
                                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '14px 0' }}>
                                        ...nakrywam do stołu...
                                    </div>
                                ) : playlist.length === 0 ? (
                                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', textAlign: 'center', padding: '12px 6px', lineHeight: 1.6 }}>
                                        Spiżarnia pusta.<br />
                                        Puść coś w radiu i kliknij <span style={{ color: '#fcd34d' }}>⭐ Z ETERU</span>,<br />
                                        albo wpisz ulubione w <code style={{ color: '#86efac', fontSize: 8 }}>joanna_playlist.json</code>.
                                    </div>
                                ) : playlist.map(t => {
                                    const playing = isNowPlaying(t);
                                    return (
                                        <div key={t.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                padding: '5px 6px', borderRadius: 7,
                                                background: playing ? 'rgba(74,222,128,0.14)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${playing ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.05)'}`,
                                            }}>
                                            <button onClick={() => handlePlayFavorite(t)}
                                                title={t.note ? `${t.title} — ${t.note}` : `Zagraj: ${t.title}`}
                                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit', minWidth: 0 }}>
                                                <span style={{ fontSize: 10, flexShrink: 0 }}>{playing ? '🔊' : '▶'}</span>
                                                <span style={{
                                                    fontSize: 9, color: playing ? '#bbf7d0' : 'rgba(255,255,255,0.72)',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>
                                                    {t.title}
                                                </span>
                                            </button>
                                            {isUserTrack(t.id) && (
                                                <button onClick={() => handleRemoveFavorite(t.id)} title="Usuń z ulubionych"
                                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 9, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {playlist.length > 0 && (
                                <div style={{ marginTop: 6, fontSize: 7.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center', letterSpacing: '0.06em' }}>
                                    ♪ {playlist.length} smakołyków · zjedzonych: {s.favoritesPlayed ?? 0}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
