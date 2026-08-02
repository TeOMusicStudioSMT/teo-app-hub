/**
 * 🎛️ SterowanieRdzeniem — jedno miejsce, w którym widać i ustawia się rdzeń AI.
 *
 * Zastępuje rozproszone przełączniki, przez które Suweren nie wiedział, gdzie
 * właściwie coś włączyć, gdy przestawało działać. Trzy tryby nazwane po ludzku
 * (lokal / chmura / hybryda), realna lista zainstalowanych modeli zamiast wpisanych
 * na sztywno nazw, i linijka „KTO TERAZ ODPOWIADA" — żeby stan był widoczny,
 * a nie domyślany.
 *
 * ⚠️ Panel ostrzega, gdy wybrany model NIE JEST zainstalowany. To lekcja z realnej
 * awarii: pięć modułów Katedry wołało `gemma3:4b`, którego nie ma w tej Ollamie —
 * wszystkie chybiały po cichu przez tygodnie.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, RefreshCw, AlertTriangle } from 'lucide-react';
import { ApiDyrygent, CLOUD_MODELS } from '../../lib/router/ApiDyrygent';
import {
    getTryb, setTryb, getModelLokalny, setModelLokalny,
    getModelChmuryCiezki, setModelChmuryCiezki,
    nasluchujZmian, ktoOdpowiada, OPIS_TRYBU, type TrybPracy,
} from '../../lib/router/trybPracy';

const TRYBY: TrybPracy[] = ['lokal', 'chmura', 'hybryda'];
const BARWA: Record<TrybPracy, string> = { lokal: '#4ade80', chmura: '#38bdf8', hybryda: '#c084fc' };

export const SterowanieRdzeniem: React.FC = () => {
    const [tryb, setTrybStan]         = useState<TrybPracy>(getTryb);
    const [lokalny, setLokalny]       = useState<string>(getModelLokalny);
    const [chmurowy, setChmurowy]     = useState<string>(getModelChmuryCiezki);
    const [zainstalowane, setZainst]  = useState<string[]>([]);
    const [ollamaZyje, setOllamaZyje] = useState<boolean | null>(null);
    const [laduje, setLaduje]         = useState(false);

    const odswiez = useCallback(async () => {
        setLaduje(true);
        try {
            const lista = await ApiDyrygent.fetchOllamaModels();
            setZainst(lista);
            setOllamaZyje(lista.length > 0);
        } catch {
            setZainst([]); setOllamaZyje(false);
        } finally { setLaduje(false); }
    }, []);

    useEffect(() => { odswiez(); }, [odswiez]);

    // Panel słucha zmian z KAŻDEGO miejsca — także z innej karty.
    useEffect(() => nasluchujZmian(() => {
        setTrybStan(getTryb()); setLokalny(getModelLokalny()); setChmurowy(getModelChmuryCiezki());
    }), []);

    const kto = ktoOdpowiada(tryb);
    // Pusta lista = Ollama nie odpowiada; wtedy NIE straszymy, że model nie istnieje.
    const lokalnyNieznany = zainstalowane.length > 0 && !zainstalowane.includes(lokalny);

    const przycisk: React.CSSProperties = {
        flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
        fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", transition: 'all .2s',
    };
    const pole: React.CSSProperties = {
        width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,.45)',
        border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '7px 9px',
        fontSize: 11, color: '#e2e8f0', outline: 'none', fontFamily: "'JetBrains Mono',monospace",
    };

    return (
        <div style={{ background: 'rgba(8,10,18,.6)', border: '1px solid rgba(56,189,248,.18)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'rgba(56,189,248,.5)' }}>∴ KATEDRA OTAKOS · RDZEŃ AI ∴</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e8f6ff', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Cpu size={16} /> STEROWANIE RDZENIEM
                    </div>
                </div>
                <button onClick={odswiez} disabled={laduje}
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 10, cursor: laduje ? 'wait' : 'pointer',
                        border: '1px solid rgba(56,189,248,.4)', background: 'rgba(56,189,248,.08)', color: '#7dd3fc',
                        display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono',monospace" }}>
                    <RefreshCw size={12} className={laduje ? 'animate-spin' : ''} /> ODŚWIEŻ
                </button>
            </div>

            {/* Trzy tryby */}
            <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
                {TRYBY.map(t => {
                    const wybrany = tryb === t;
                    return (
                        <button key={t} onClick={() => { setTryb(t); setTrybStan(t); }} title={OPIS_TRYBU[t].opis}
                            style={{ ...przycisk,
                                border: `1px solid ${wybrany ? BARWA[t] : 'rgba(255,255,255,.12)'}`,
                                background: wybrany ? `${BARWA[t]}22` : 'rgba(255,255,255,.03)',
                                color: wybrany ? BARWA[t] : 'rgba(255,255,255,.45)' }}>
                            <div style={{ fontSize: 15 }}>{OPIS_TRYBU[t].ikona}</div>
                            {OPIS_TRYBU[t].etykieta}
                        </button>
                    );
                })}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', marginTop: 7, lineHeight: 1.6 }}>
                {OPIS_TRYBU[tryb].opis}
            </div>

            {/* Kto teraz odpowiada — sedno panelu */}
            <div style={{ marginTop: 11, padding: '9px 11px', borderRadius: 10,
                background: `${BARWA[tryb]}12`, border: `1px solid ${BARWA[tryb]}44` }}>
                <div style={{ fontSize: 8, letterSpacing: '.15em', color: 'rgba(255,255,255,.4)' }}>KTO TERAZ ODPOWIADA</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: BARWA[tryb], marginTop: 2 }}>{kto.opis}</div>
                {kto.zapasowy && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>
                        ↳ gdy chmura padnie: <b style={{ color: 'rgba(255,255,255,.7)' }}>{kto.zapasowy}</b>
                    </div>
                )}
            </div>

            {/* Rdzeń lokalny */}
            <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                    <span style={{ fontSize: 9, letterSpacing: '.12em', color: 'rgba(255,255,255,.45)' }}>🏠 RDZEŃ LOKALNY</span>
                    <span style={{ fontSize: 8, color: ollamaZyje === null ? 'rgba(255,255,255,.3)' : ollamaZyje ? '#4ade80' : '#f87171' }}>
                        {ollamaZyje === null ? '…' : ollamaZyje ? `Ollama żyje · ${zainstalowane.length} modeli` : 'Ollama nie odpowiada (:11434)'}
                    </span>
                </div>
                {zainstalowane.length > 0 ? (
                    <select value={lokalny} onChange={e => { setModelLokalny(e.target.value); setLokalny(e.target.value); }} style={pole}>
                        {!zainstalowane.includes(lokalny) && <option value={lokalny}>{lokalny} — NIEZAINSTALOWANY</option>}
                        {zainstalowane.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                ) : (
                    <input value={lokalny} onChange={e => { setModelLokalny(e.target.value); setLokalny(e.target.value); }} style={pole} />
                )}
                {lokalnyNieznany && (
                    <div style={{ marginTop: 6, padding: '6px 9px', borderRadius: 8, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.3)',
                        display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <AlertTriangle size={12} style={{ color: '#fca5a5', flexShrink: 0, marginTop: 1 }} />
                        <div style={{ fontSize: 8.5, color: '#fca5a5', lineHeight: 1.55 }}>
                            Model <b>{lokalny}</b> nie jest zainstalowany w tej Ollamie. Wywołania będą chybiać
                            po cichu — wybierz model z listy albo pobierz go (<code>ollama pull {lokalny}</code>).
                        </div>
                    </div>
                )}
            </div>

            {/* Rdzeń chmurowy */}
            <div style={{ marginTop: 11, opacity: tryb === 'lokal' ? .45 : 1 }}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'rgba(255,255,255,.45)', marginBottom: 5 }}>
                    ☁️ RDZEŃ CHMUROWY {tryb === 'lokal' && '— nieużywany w trybie LOKAL'}
                </div>
                <select value={chmurowy} onChange={e => { setModelChmuryCiezki(e.target.value); setChmurowy(e.target.value); }} style={pole}>
                    {CLOUD_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.label} · {m.tier}</option>
                    ))}
                </select>
            </div>

            <div style={{ marginTop: 10, fontSize: 8, color: 'rgba(255,255,255,.28)', lineHeight: 1.55 }}>
                Ten panel jest jedynym źródłem prawdy o rdzeniu — zmiana tutaj rozchodzi się
                natychmiast po wszystkich modułach Katedry, także w innych kartach przeglądarki.
            </div>
        </div>
    );
};

export default SterowanieRdzeniem;
