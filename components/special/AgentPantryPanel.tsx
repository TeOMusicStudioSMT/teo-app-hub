/**
 * 🍱 AgentPantryPanel — Spiżarnia Zasobów Agentów.
 *
 * Rozwijany panel z katalogiem darmowych źródeł. Filtry, wyszukiwarka
 * i wskaźnik stanu — przy czym wskaźnik NIE jest ozdobą: klikasz „SPRÓBUJ",
 * a panel realnie odpytuje źródło i pokazuje, co wróciło. Zielona kropka
 * bez pokrycia byłaby dokładnie tą atrapą, której tu nie budujemy.
 *
 * Każda pozycja niesie widoczną etykietę dostępności:
 *   API      — wywoływalne bez klucza (agent to zje),
 *   KLUCZ    — ma API, ale trzeba się zarejestrować,
 *   STRONA   — miejsce dla człowieka, agent poda tylko odnośnik.
 * To rozróżnienie jest sensem tego panelu; bez niego byłaby to lista linków.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
    KATEGORIE, szukaj, statystyka, pobierzZasob,
    type KategoriaId, type Dostepnosc, type WynikPobrania,
} from '../../services/AgentPantryService';

const BARWA_DOSTEPNOSCI: Record<Dostepnosc, { tlo: string; obwodka: string; tekst: string; etykieta: string }> = {
    'api':       { tlo: 'rgba(34,211,238,0.12)',  obwodka: 'rgba(34,211,238,0.5)',  tekst: '#67e8f9', etykieta: 'API' },
    'api-klucz': { tlo: 'rgba(251,191,36,0.10)',  obwodka: 'rgba(251,191,36,0.45)', tekst: '#fcd34d', etykieta: 'KLUCZ' },
    'strona':    { tlo: 'rgba(148,163,184,0.08)', obwodka: 'rgba(148,163,184,0.3)', tekst: '#94a3b8', etykieta: 'STRONA' },
};

const karta: React.CSSProperties = {
    borderRadius: 12, border: '1px solid rgba(217,70,239,0.18)',
    background: 'rgba(217,70,239,0.04)', padding: 12,
};
const pole: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '6px 10px', color: '#e2e8f0', fontSize: 11,
    fontFamily: 'inherit', outline: 'none',
};

export const AgentPantryPanel: React.FC<{ domyslnieOtwarty?: boolean }> = ({ domyslnieOtwarty = false }) => {
    const [otwarty, setOtwarty] = useState(domyslnieOtwarty);
    const [fraza, setFraza] = useState('');
    const [kategoria, setKategoria] = useState<KategoriaId | ''>('');
    const [proba, setProba] = useState('');
    const [wynik, setWynik] = useState<WynikPobrania | null>(null);
    const [zajety, setZajety] = useState(false);

    const stat = useMemo(() => statystyka(), []);
    const wyniki = useMemo(() => szukaj(fraza, kategoria || undefined), [fraza, kategoria]);

    const sprobuj = useCallback(async () => {
        const kat = (kategoria || 'VIDEO_MEDIA') as KategoriaId;
        setZajety(true); setWynik(null);
        try {
            setWynik(await pobierzZasob(kat, proba.trim() || 'kawiarnia', 6));
        } finally { setZajety(false); }
    }, [kategoria, proba]);

    return (
        <div style={{ ...karta, marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            <button onClick={() => setOtwarty(o => !o)}
                style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    color: '#e879f9', fontFamily: 'inherit', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
                }}>
                <span>🍱 SPIŻARNIA ZASOBÓW AGENTÓW <span style={{ color: '#67e8f9' }}>· {stat.wszystkich} pozycji</span></span>
                <span>{otwarty ? '▲' : '▼'}</span>
            </button>

            {otwarty && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* Uczciwy licznik zamiast okrągłego „300+" */}
                    <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.7 }}>
                        <b style={{ color: '#67e8f9' }}>{stat.wywolywalne}</b> źródeł agent odpyta bez klucza ·{' '}
                        <b style={{ color: '#fcd34d' }}>{stat.zKluczem}</b> wymaga rejestracji ·{' '}
                        <b style={{ color: '#94a3b8' }}>{stat.strony}</b> to miejsca dla człowieka.<br />
                        Katalog na bazie repozytorium <i>300-free-resource-websites</i> — tamto jest listą stron,
                        więc tu liczy się nie ilość, tylko to, co realnie da się wywołać.
                    </div>

                    {/* Filtry */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => setKategoria('')}
                            style={{ ...pole, cursor: 'pointer', fontWeight: 700, fontSize: 9, color: kategoria === '' ? '#e879f9' : '#64748b', borderColor: kategoria === '' ? 'rgba(217,70,239,0.5)' : 'rgba(255,255,255,0.12)' }}>
                            WSZYSTKO
                        </button>
                        {KATEGORIE.map(k => (
                            <button key={k.id} onClick={() => setKategoria(k.id)} title={k.opis}
                                style={{ ...pole, cursor: 'pointer', fontWeight: 700, fontSize: 9, color: kategoria === k.id ? '#e879f9' : '#64748b', borderColor: kategoria === k.id ? 'rgba(217,70,239,0.5)' : 'rgba(255,255,255,0.12)' }}>
                                {k.etykieta}
                            </button>
                        ))}
                    </div>

                    <input value={fraza} onChange={e => setFraza(e.target.value)}
                        placeholder={'szukaj po nazwie, opisie albo module (np. „Joanna", „teledysk", „kadr")'}
                        style={{ ...pole, width: '100%' }} />

                    {/* Lista */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 320, overflowY: 'auto' }}>
                        {wyniki.map(z => {
                            const b = BARWA_DOSTEPNOSCI[z.dostepnosc];
                            return (
                                <div key={`${z.kategoria}-${z.nazwa}`}
                                    style={{ padding: 8, borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <a href={z.url} target="_blank" rel="noreferrer"
                                            style={{ fontSize: 11, fontWeight: 700, color: '#f0abfc', textDecoration: 'none' }}>
                                            {z.nazwa}
                                        </a>
                                        <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: b.tlo, border: `1px solid ${b.obwodka}`, color: b.tekst }}>
                                            {b.etykieta}
                                        </span>
                                        {z.licencja && <span style={{ fontSize: 8, color: '#475569' }}>{z.licencja}</span>}
                                    </div>
                                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 3, lineHeight: 1.5 }}>{z.opis}</div>
                                    {z.dlaModulu?.length ? (
                                        <div style={{ fontSize: 8, color: '#22d3ee', marginTop: 3 }}>→ {z.dlaModulu.join(' · ')}</div>
                                    ) : null}
                                </div>
                            );
                        })}
                        {!wyniki.length && (
                            <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', padding: 12 }}>nic nie pasuje</div>
                        )}
                    </div>

                    {/* Stan podłączenia = realne odpytanie, nie zielona kropka */}
                    <div style={{ ...karta, borderColor: 'rgba(34,211,238,0.25)', background: 'rgba(34,211,238,0.04)' }}>
                        <div style={{ fontSize: 9, letterSpacing: '0.2em', color: '#67e8f9', marginBottom: 4 }}>
                            SPRAWDŹ NA ŻYWO {kategoria ? `· ${kategoria}` : '· VIDEO_MEDIA (domyślnie)'}
                        </div>
                        {/* Nadziałem się na to przy pierwszym teście: „kawiarnia o świcie"
                            zwróciło zero z wszystkich trzech źródeł, choć działały.
                            Te katalogi są indeksowane PO ANGIELSKU — bez tej informacji
                            pusty wynik wygląda jak zepsuty panel. */}
                        <div style={{ fontSize: 8, color: '#64748b', marginBottom: 6, lineHeight: 1.5 }}>
                            Pytaj <b style={{ color: '#94a3b8' }}>po angielsku</b> — te katalogi mają angielskie opisy.
                            „kawiarnia o świcie" zwróci pustkę, „coffee shop dawn" zwróci wyniki.
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input value={proba} onChange={e => setProba(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') void sprobuj(); }}
                                placeholder={'czego szukamy, np. „kawiarnia o świcie"'} style={{ ...pole, flex: 1 }} />
                            <button onClick={() => void sprobuj()} disabled={zajety}
                                style={{ ...pole, cursor: 'pointer', fontWeight: 700, color: '#67e8f9', borderColor: 'rgba(34,211,238,0.45)', opacity: zajety ? 0.5 : 1 }}>
                                {zajety ? '…' : 'SPRÓBUJ'}
                            </button>
                        </div>

                        {wynik && (
                            <div style={{ marginTop: 8 }}>
                                {wynik.uwaga ? (
                                    <div style={{ fontSize: 9, color: '#fcd34d', lineHeight: 1.6 }}>⚠ {wynik.uwaga}</div>
                                ) : (
                                    <div style={{ fontSize: 9, color: '#6ee7b7', marginBottom: 5 }}>
                                        ✅ {wynik.zrodlo} — {wynik.pozycje.length} pozycji
                                    </div>
                                )}
                                {wynik.pozycje.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 0' }}>
                                        {p.podglad && <img src={p.podglad} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: 'cover' }} />}
                                        <a href={p.url} target="_blank" rel="noreferrer"
                                            style={{ fontSize: 9, color: '#cbd5e1', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p.tytul}
                                        </a>
                                        {p.licencja && <span style={{ fontSize: 8, color: '#475569' }}>{p.licencja}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentPantryPanel;
