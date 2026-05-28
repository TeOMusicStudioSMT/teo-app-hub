/**
 * 🚌 AutobusDashboard.tsx — Wizualna Magistrala Katedry 0.00G
 *
 * Pokazuje live stream zdarzeń między modułami.
 * Umożliwia ręczne routowanie: Widok→Klaudiusz, Terminal→Klaudiusz, itd.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OtakOSBus, BUS, type BusEvent, type BusModule } from '../../lib/otakosBus';

// ── Konfiguracja modułów ──────────────────────────────────────────

const MODULES: Record<BusModule, { label: string; icon: string; color: string; glow: string }> = {
    terminal:  { label: 'Terminal',  icon: '⚡', color: '#3b82f6', glow: 'rgba(59,130,246,.3)' },
    klaudiusz: { label: 'Klaudiusz', icon: '⚗', color: '#f0c060', glow: 'rgba(240,192,96,.3)' },
    widok:     { label: 'Widok',     icon: '👁', color: '#06b6d4', glow: 'rgba(6,182,212,.3)' },
    rada:      { label: 'Rada',      icon: '🔮', color: '#c026d3', glow: 'rgba(192,38,211,.3)' },
    crew:      { label: 'Crew',      icon: '🏆', color: '#fbbf24', glow: 'rgba(251,191,36,.3)' },
    system:    { label: 'System',    icon: '🌐', color: '#94a3b8', glow: 'rgba(148,163,184,.3)' },
};

const TYPE_LABELS: Record<string, string> = {
    [BUS.TERMINAL_RESULT]:  'wynik',
    [BUS.TERMINAL_RUN]:     'task',
    [BUS.KLAUDIUSZ_MSG]:    'wiadomość',
    [BUS.KLAUDIUSZ_INJECT]: 'inject',
    [BUS.WIDOK_REPORT]:     'raport',
    [BUS.WIDOK_COUNCIL]:    'rada',
    [BUS.RADA_OPENED]:      'otwarto',
    [BUS.CREW_AGENT]:              'agent',
    [BUS.CREW_SAVED]:              'załoga',
    [BUS.CREW_TRAINING_QUEUE]:     'na szkolenie',
    [BUS.INKUBATOR_TRAINED]:       '✅ ukończono trening',
    [BUS.INKUBATOR_DEPLOYED]:      '🎓 deploy akademia',
    'inkubator.training.start':    '⏳ trening w toku...',
};

// ── Komponent główny ──────────────────────────────────────────────

export const AutobusDashboard: React.FC = () => {
    const [events, setEvents]           = useState<BusEvent[]>([]);
    const [selected, setSelected]       = useState<BusEvent | null>(null);
    const [lastActive, setLastActive]   = useState<Partial<Record<BusModule, number>>>({});
    const [pulse, setPulse]             = useState<BusModule | null>(null);
    const streamRef                     = useRef<HTMLDivElement>(null);

    // Subskrybuj magistralę
    useEffect(() => {
        setEvents(OtakOSBus.log);
        const unsub = OtakOSBus.subscribe(ev => {
            setEvents(prev => [...prev.slice(-99), ev]);
            setLastActive(prev => ({ ...prev, [ev.from]: ev.ts }));
            setPulse(ev.from);
            setTimeout(() => setPulse(null), 600);
        });
        return unsub;
    }, []);

    const clearAll = () => { setEvents([]); setSelected(null); };
    const deleteEvent = (id: string) => setEvents(prev => prev.filter(e => e.id !== id));

    // Auto-scroll do dołu streamu
    useEffect(() => {
        streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: 'smooth' });
    }, [events]);

    // ── Szybkie trasy ──────────────────────────────────────────────

    const routes = [
        {
            label:   '📊 Raport → ⚗ Klaudiusz',
            desc:    'Wyślij ostatni raport WIDOK do Klaudiusza',
            color:   '#06b6d4',
            action:  () => {
                const last = OtakOSBus.last(BUS.WIDOK_REPORT);
                if (!last) return alert('Brak raportu WIDOK. Najpierw wygeneruj raport.');
                const text = `Przeanalizuj ten raport WIDOK:\n\n${last.payload.synthesis as string || last.payload.baseReport as string || '(brak treści)'}`;
                OtakOSBus.emit('system', BUS.KLAUDIUSZ_INJECT, { text });
            },
        },
        {
            label:   '⚗ Klaudiusz → ⚡ Terminal',
            desc:    'Wyślij ostatnią odpowiedź Klaudiusza jako zadanie do Terminala',
            color:   '#f0c060',
            action:  () => {
                const last = OtakOSBus.last(BUS.KLAUDIUSZ_MSG);
                if (!last) return alert('Brak wiadomości od Klaudiusza.');
                OtakOSBus.emit('system', BUS.TERMINAL_RUN, {
                    command: last.payload.content as string,
                    skill:   'AUTO',
                    title:   'Z Klaudiusza',
                });
            },
        },
        {
            label:   '⚡ Terminal → ⚗ Klaudiusz',
            desc:    'Wyślij ostatni wynik Terminala do Klaudiusza do analizy',
            color:   '#3b82f6',
            action:  () => {
                const last = OtakOSBus.last(BUS.TERMINAL_RESULT);
                if (!last) return alert('Brak wyników Terminala.');
                const text = `Przeanalizuj wynik terminala:\n\n${last.payload.content as string || '(brak treści)'}`;
                OtakOSBus.emit('system', BUS.KLAUDIUSZ_INJECT, { text });
            },
        },
        {
            label:   '🏆 Nowy Agent → ⚡ Terminal',
            desc:    'Ostatnio stworzony agent: uruchom jego zadanie w Terminalu',
            color:   '#fbbf24',
            action:  () => {
                const last = OtakOSBus.last(BUS.CREW_AGENT);
                if (!last) return alert('Brak utworzonych agentów.');
                OtakOSBus.emit('system', BUS.TERMINAL_RUN, {
                    command: `Opisz rolę agenta "${last.payload.name}" (rola: ${last.payload.role}) i wygeneruj jego pierwszą instrukcję.`,
                    skill:   'AUTO',
                    title:   `Agent: ${last.payload.name}`,
                });
            },
        },
        {
            label:   '👁 Widok → 🔮 Rada',
            desc:    'Otwórz Radę z tematem z ostatniego raportu WIDOK',
            color:   '#c026d3',
            action:  () => {
                const last = OtakOSBus.last(BUS.WIDOK_REPORT);
                if (!last) return alert('Brak raportu WIDOK.');
                const topic = `Analiza WIDOK: ${(last.payload.synthesis as string || last.payload.baseReport as string || '').substring(0, 200)}`;
                localStorage.setItem('otakos_current_topic', topic);
                window.dispatchEvent(new Event('otakos_open_council'));
                OtakOSBus.emit('system', BUS.WIDOK_COUNCIL, { topic });
            },
        },
    ];

    // ── RENDER ─────────────────────────────────────────────────────
    return (
        <div style={S.root}>

            {/* Header */}
            <div style={S.header}>
                <div style={S.headerLeft}>
                    <span style={S.busIcon}>🚌</span>
                    <div>
                        <div style={S.title}>AUTOBUS 0.00G</div>
                        <div style={S.subtitle}>Magistrala Zdarzeń Katedry · {events.length} w historii</div>
                    </div>
                </div>
                <div style={S.headerRight}>
                    {events.length > 0 && (
                        <button
                            onClick={clearAll}
                            style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, padding: '3px 10px', color: '#f87171', fontSize: 9, cursor: 'pointer', letterSpacing: '.1em', fontFamily: 'monospace' }}
                        >
                            🗑 WYCZYŚĆ ({events.length})
                        </button>
                    )}
                    <div style={S.dot} />
                    <span style={S.liveLabel}>LIVE</span>
                </div>
            </div>

            {/* Moduły */}
            <div style={S.modulesRow}>
                {(Object.entries(MODULES) as [BusModule, typeof MODULES[BusModule]][])
                    .filter(([k]) => k !== 'system')
                    .map(([id, m]) => {
                    const isActive = pulse === id;
                    const lastTs = lastActive[id];
                    const secAgo = lastTs ? Math.floor((Date.now() - lastTs) / 1000) : null;
                    return (
                        <motion.div
                            key={id}
                            style={{
                                ...S.moduleCard,
                                borderColor: isActive ? m.color : 'rgba(255,255,255,.06)',
                                boxShadow: isActive ? `0 0 16px ${m.glow}` : 'none',
                            }}
                            animate={isActive ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <span style={{ fontSize: 16 }}>{m.icon}</span>
                            <span style={{ ...S.moduleName, color: isActive ? m.color : 'rgba(255,255,255,.5)' }}>
                                {m.label}
                            </span>
                            <span style={S.moduleTime}>
                                {secAgo === null ? '—' : secAgo < 60 ? `${secAgo}s` : `${Math.floor(secAgo / 60)}m`}
                            </span>
                        </motion.div>
                    );
                })}
            </div>

            {/* Szybkie Trasy */}
            <div style={S.section}>
                <div style={S.sectionTitle}>⚡ SZYBKIE TRASY</div>
                <div style={S.routesGrid}>
                    {routes.map(r => (
                        <button
                            key={r.label}
                            style={{ ...S.routeBtn, borderColor: `${r.color}40` }}
                            title={r.desc}
                            onClick={r.action}
                            onMouseEnter={e => (e.currentTarget.style.background = `${r.color}18`)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
                        >
                            <span style={{ ...S.routeLabel, color: r.color }}>{r.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Strumień zdarzeń */}
            <div style={S.section}>
                <div style={S.sectionTitle}>📡 STRUMIEŃ ZDARZEŃ</div>
                <div ref={streamRef} style={S.stream}>
                    <AnimatePresence initial={false}>
                        {events.length === 0 && (
                            <div style={S.empty}>Brak zdarzeń... moduły czekają na aktywność.</div>
                        )}
                        {[...events].reverse().map(ev => {
                            const m = MODULES[ev.from] ?? MODULES.system;
                            const typeLabel = TYPE_LABELS[ev.type] ?? ev.type;
                            const time = new Date(ev.ts).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            return (
                                <motion.div
                                    key={ev.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{
                                        ...S.eventRow,
                                        borderLeftColor: m.color,
                                        background: selected?.id === ev.id ? 'rgba(255,255,255,.05)' : 'transparent',
                                    }}
                                    onClick={() => setSelected(selected?.id === ev.id ? null : ev)}
                                >
                                    <span style={S.evTime}>{time}</span>
                                    <span style={{ ...S.evFrom, color: m.color }}>{m.icon} {m.label}</span>
                                    <span style={S.evArrow}>→</span>
                                    <span style={S.evType}>{typeLabel}</span>
                                    {Object.keys(ev.payload).length > 0 && (
                                        <span style={S.evHasData}>●</span>
                                    )}
                                    <button
                                        onClick={e => { e.stopPropagation(); deleteEvent(ev.id); if (selected?.id === ev.id) setSelected(null); }}
                                        style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,.4)', cursor: 'pointer', fontSize: 10, padding: '0 2px', lineHeight: 1, marginLeft: 4 }}
                                        title="Usuń"
                                    >✕</button>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* Szczegóły wybranego zdarzenia */}
            <AnimatePresence>
                {selected && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={S.detail}
                    >
                        <div style={S.detailHeader}>
                            <span style={{ color: MODULES[selected.from]?.color }}>
                                {MODULES[selected.from]?.icon} {selected.from}
                            </span>
                            <span style={S.detailType}>{selected.type}</span>
                            <button style={S.detailClose} onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <pre style={S.detailBody}>
                            {JSON.stringify(selected.payload, null, 2)}
                        </pre>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

// ── Style ─────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
    root: {
        display: 'flex', flexDirection: 'column', gap: 0,
        background: 'linear-gradient(160deg,rgba(4,4,16,.99),rgba(2,4,10,1))',
        borderRadius: 14,
        border: '1px solid rgba(59,130,246,.15)',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
        height: '100%', minHeight: 500,
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(59,130,246,.06)',
        borderBottom: '1px solid rgba(59,130,246,.12)',
        flexShrink: 0,
    },
    headerLeft:   { display: 'flex', alignItems: 'center', gap: 10 },
    headerRight:  { display: 'flex', alignItems: 'center', gap: 6 },
    busIcon:      { fontSize: 22 },
    title:        { fontSize: 13, fontWeight: 700, color: '#93c5fd', letterSpacing: '.1em' },
    subtitle:     { fontSize: 8, color: 'rgba(147,197,253,.4)', letterSpacing: '.15em', marginTop: 2 },
    dot:          { width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite', boxShadow: '0 0 6px #22c55e' },
    liveLabel:    { fontSize: 8, color: '#22c55e', letterSpacing: '.2em' },

    modulesRow: {
        display: 'flex', gap: 6, padding: '10px 14px',
        background: 'rgba(0,0,0,.2)', borderBottom: '1px solid rgba(255,255,255,.04)',
        flexShrink: 0, overflowX: 'auto',
    },
    moduleCard: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '8px 12px', borderRadius: 8,
        border: '1px solid rgba(255,255,255,.06)',
        background: 'rgba(255,255,255,.02)',
        minWidth: 72, cursor: 'default', transition: 'border-color .2s',
    },
    moduleName: { fontSize: 8, letterSpacing: '.1em', fontWeight: 600 },
    moduleTime: { fontSize: 7, color: 'rgba(255,255,255,.2)', letterSpacing: '.05em' },

    section: {
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,.04)',
        flexShrink: 0,
    },
    sectionTitle: { fontSize: 8, color: 'rgba(147,197,253,.5)', letterSpacing: '.2em', marginBottom: 8 },

    routesGrid: {
        display: 'flex', flexWrap: 'wrap', gap: 6,
    },
    routeBtn: {
        padding: '6px 12px', borderRadius: 7,
        background: 'rgba(255,255,255,.02)',
        border: '1px solid',
        cursor: 'pointer', transition: 'background .15s',
        fontFamily: "'JetBrains Mono',monospace",
    },
    routeLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '.03em' },

    stream: {
        maxHeight: 260, overflowY: 'auto',
        display: 'flex', flexDirection: 'column-reverse', gap: 1,
    },
    empty: { fontSize: 10, color: 'rgba(255,255,255,.2)', padding: '12px 0', textAlign: 'center' },

    eventRow: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px', borderRadius: 4,
        borderLeft: '2px solid',
        cursor: 'pointer', transition: 'background .1s',
    },
    evTime:   { fontSize: 8, color: 'rgba(255,255,255,.3)', minWidth: 60 },
    evFrom:   { fontSize: 9, fontWeight: 700, minWidth: 72, letterSpacing: '.05em' },
    evArrow:  { fontSize: 9, color: 'rgba(255,255,255,.2)' },
    evType:   { fontSize: 9, color: 'rgba(255,255,255,.6)', flex: 1 },
    evHasData:{ fontSize: 8, color: '#3b82f6', marginLeft: 'auto' },

    detail: {
        overflow: 'hidden',
        borderTop: '1px solid rgba(59,130,246,.15)',
        flexShrink: 0,
    },
    detailHeader: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px',
        background: 'rgba(59,130,246,.05)',
        fontSize: 9, fontWeight: 700, letterSpacing: '.1em',
    },
    detailType:  { color: 'rgba(255,255,255,.4)', flex: 1 },
    detailClose: { background: 'none', border: 'none', color: 'rgba(255,255,255,.3)', cursor: 'pointer', fontSize: 12 },
    detailBody:  {
        margin: 0, padding: '10px 14px',
        fontSize: 9, color: '#93c5fd', lineHeight: 1.6,
        overflowX: 'auto', maxHeight: 180, overflowY: 'auto',
    },
};

export default AutobusDashboard;
