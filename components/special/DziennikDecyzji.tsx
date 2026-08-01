/**
 * 📓 DziennikDecyzji — zapis decyzji Suwerena i ich powodów.
 *
 * Z całego arsenału finansowego to jedyne narzędzie, które realnie poprawia
 * wyniki: nie przewiduje przyszłości, tylko chroni przed przepisywaniem
 * historii po fakcie („przecież wiedziałem"). Rozumowanie zapisujesz ZANIM
 * poznasz wynik — dopiero wtedy późniejszy przegląd cokolwiek znaczy.
 *
 * ⚠️ Nic tu nie doradza. To notatnik, nie doradca.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BookMarked, Plus, Check, X } from 'lucide-react';
import { getBridgeBase } from '../../lib/bridgeService';

type Kierunek = 'KUPNO' | 'SPRZEDAZ' | 'TRZYMAM' | 'ODPUSZCZAM';
type Ocena = 'TRAFIONE' | 'CHYBIONE' | 'NIEROZSTRZYGNIETE';

interface Wynik { ocena: Ocena; domknieto: string; cenaPotem: number | null; czegoSieNauczylem: string | null }
interface Wpis {
    id: string; utworzono: string; aktywo: string; kierunek: Kierunek;
    rozumowanie: string; oczekiwanie: string | null; pewnosc: number;
    cenaWtedy: number | null; wynik: Wynik | null;
}
interface Podsum {
    wszystkich: number; otwartych: number; domknietych: number;
    trafione: number; chybione: number; uwaga: string;
}

const BARWA: Record<Kierunek, string> = {
    KUPNO: '#4ade80', SPRZEDAZ: '#f87171', TRZYMAM: '#fbbf24', ODPUSZCZAM: '#94a3b8',
};

export const DziennikDecyzji: React.FC = () => {
    const [wpisy, setWpisy]     = useState<Wpis[]>([]);
    const [pods, setPods]       = useState<Podsum | null>(null);
    const [blad, setBlad]       = useState<string | null>(null);
    const [formularz, setForm]  = useState(false);
    const [zapisuje, setZapis]  = useState(false);

    // Nowy wpis
    const [aktywo, setAktywo]           = useState('BTC');
    const [kierunek, setKierunek]       = useState<Kierunek>('KUPNO');
    const [rozumowanie, setRozum]       = useState('');
    const [oczekiwanie, setOczek]       = useState('');
    const [pewnosc, setPewnosc]         = useState(3);
    const [cenaWtedy, setCena]          = useState('');

    // Domykanie
    const [domykam, setDomykam]         = useState<string | null>(null);
    const [nauka, setNauka]             = useState('');

    const pobierz = useCallback(async () => {
        try {
            const [a, b] = await Promise.all([
                fetch(`${getBridgeBase()}/api/rynek/dziennik`).then(r => r.json()),
                fetch(`${getBridgeBase()}/api/rynek/dziennik/podsumowanie`).then(r => r.json()),
            ]);
            if (a.success) setWpisy(a.wpisy || []);
            if (b.success) setPods(b);
            setBlad(null);
        } catch (e: any) {
            setBlad(`Most nieosiągalny: ${e?.message || e}`);
        }
    }, []);

    useEffect(() => { pobierz(); }, [pobierz]);

    const zapiszWpis = async () => {
        setZapis(true); setBlad(null);
        try {
            const r = await fetch(`${getBridgeBase()}/api/rynek/dziennik`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aktywo, kierunek, rozumowanie, oczekiwanie, pewnosc, cenaWtedy: Number(cenaWtedy) || undefined }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message);
            setRozum(''); setOczek(''); setCena(''); setForm(false);
            await pobierz();
        } catch (e: any) {
            setBlad(e?.message || String(e));
        } finally { setZapis(false); }
    };

    const domknij = async (id: string, ocena: Ocena) => {
        try {
            const r = await fetch(`${getBridgeBase()}/api/rynek/dziennik/${id}/wynik`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ocena, czegoSieNauczylem: nauka }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message);
            setDomykam(null); setNauka('');
            await pobierz();
        } catch (e: any) { setBlad(e?.message || String(e)); }
    };

    const pole: React.CSSProperties = {
        width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,.4)',
        border: '1px solid rgba(180,100,255,.22)', borderRadius: 8, padding: '6px 9px',
        fontSize: 10, color: '#e9d5ff', outline: 'none', fontFamily: "'JetBrains Mono',monospace",
    };

    return (
        <div style={{ background: 'rgba(8,10,18,.6)', border: '1px solid rgba(180,100,255,.18)', borderRadius: 12, padding: 14, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'rgba(180,100,255,.5)' }}>∴ KATEDRA OTAKOS · CENTRUM FINANSOWE ∴</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e8f6ff', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <BookMarked size={16} /> DZIENNIK DECYZJI
                    </div>
                    {pods && (
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)' }}>
                            {pods.wszystkich} wpisów · {pods.otwartych} otwartych · {pods.trafione}✓ / {pods.chybione}✗ domkniętych
                        </div>
                    )}
                </div>
                <button onClick={() => setForm(v => !v)}
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 10, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace",
                        border: '1px solid rgba(180,100,255,.4)', background: 'rgba(180,100,255,.1)', color: '#d8b4fe',
                        display: 'flex', alignItems: 'center', gap: 6 }}>
                    {formularz ? <X size={12} /> : <Plus size={12} />} {formularz ? 'ANULUJ' : 'NOWA DECYZJA'}
                </button>
            </div>

            {/* Uczciwa uwaga o próbce — prosto z Mostu, bez upiększania */}
            {pods && (
                <div style={{ marginTop: 9, padding: '6px 9px', borderRadius: 8, background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.22)' }}>
                    <div style={{ fontSize: 8.5, color: '#fcd34d', lineHeight: 1.55 }}>⚠️ {pods.uwaga}</div>
                </div>
            )}

            {blad && <div style={{ marginTop: 8, fontSize: 9.5, color: '#fca5a5' }}>{blad}</div>}

            {/* Formularz nowej decyzji */}
            {formularz && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(180,100,255,.05)', border: '1px solid rgba(180,100,255,.22)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        <input value={aktywo} onChange={e => setAktywo(e.target.value)} placeholder="AKTYWO" style={{ ...pole, width: 110 }} />
                        <select value={kierunek} onChange={e => setKierunek(e.target.value as Kierunek)} style={{ ...pole, width: 130 }}>
                            {(['KUPNO', 'SPRZEDAZ', 'TRZYMAM', 'ODPUSZCZAM'] as Kierunek[]).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <input value={cenaWtedy} onChange={e => setCena(e.target.value)} placeholder="cena teraz" style={{ ...pole, width: 110 }} />
                    </div>
                    <textarea value={rozumowanie} onChange={e => setRozum(e.target.value)} rows={3}
                        placeholder="DLACZEGO tak robisz? (wymagane — to jest cała wartość dziennika)" style={{ ...pole, resize: 'vertical' }} />
                    <input value={oczekiwanie} onChange={e => setOczek(e.target.value)}
                        placeholder="Czego się spodziewasz? (np. odbicie w 2 tygodnie)" style={pole} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.45)' }}>PEWNOŚĆ</span>
                        {[1, 2, 3, 4, 5].map(p => (
                            <button key={p} onClick={() => setPewnosc(p)}
                                style={{ width: 24, height: 24, borderRadius: 6, fontSize: 10, cursor: 'pointer',
                                    border: `1px solid ${pewnosc === p ? 'rgba(180,100,255,.7)' : 'rgba(255,255,255,.12)'}`,
                                    background: pewnosc === p ? 'rgba(180,100,255,.2)' : 'transparent',
                                    color: pewnosc === p ? '#e9d5ff' : 'rgba(255,255,255,.4)' }}>{p}</button>
                        ))}
                        <button onClick={zapiszWpis} disabled={zapisuje || rozumowanie.trim().length < 10}
                            style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                                cursor: rozumowanie.trim().length < 10 ? 'not-allowed' : 'pointer',
                                border: '1px solid rgba(74,222,128,.45)', background: 'rgba(74,222,128,.12)', color: '#86efac',
                                opacity: rozumowanie.trim().length < 10 ? .4 : 1, fontFamily: "'JetBrains Mono',monospace" }}>
                            {zapisuje ? 'ZAPISUJĘ...' : 'ZAPISZ'}
                        </button>
                    </div>
                </div>
            )}

            {/* Lista wpisów */}
            <div style={{ marginTop: 10, maxHeight: 340, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {!wpisy.length ? (
                    <div style={{ padding: 18, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,.32)', lineHeight: 1.7 }}>
                        Dziennik pusty.<br />
                        <span style={{ fontSize: 8.5 }}>Zapisz pierwszą decyzję ZANIM poznasz jej wynik — inaczej cały sens znika.</span>
                    </div>
                ) : wpisy.map(w => (
                    <div key={w.id} style={{ padding: 9, borderRadius: 9, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: BARWA[w.kierunek] }}>{w.kierunek}</span>
                            <span style={{ fontSize: 10, color: '#e8f6ff', fontWeight: 700 }}>{w.aktywo}</span>
                            {w.cenaWtedy && <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,.4)' }}>@ {w.cenaWtedy}</span>}
                            <span style={{ fontSize: 8, color: 'rgba(255,255,255,.28)' }}>pewność {w.pewnosc}/5</span>
                            <span style={{ fontSize: 8, color: 'rgba(255,255,255,.25)', marginLeft: 'auto' }}>
                                {new Date(w.utworzono).toLocaleDateString('pl-PL')}
                            </span>
                        </div>
                        <div style={{ fontSize: 9.5, color: 'rgba(232,246,255,.75)', lineHeight: 1.5 }}>{w.rozumowanie}</div>
                        {w.oczekiwanie && <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,.35)', marginTop: 3 }}>↳ oczekiwanie: {w.oczekiwanie}</div>}

                        {w.wynik ? (
                            <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: w.wynik.ocena === 'TRAFIONE' ? '#4ade80' : w.wynik.ocena === 'CHYBIONE' ? '#f87171' : '#94a3b8' }}>
                                    {w.wynik.ocena}
                                </span>
                                {w.wynik.czegoSieNauczylem && (
                                    <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>💡 {w.wynik.czegoSieNauczylem}</div>
                                )}
                            </div>
                        ) : domykam === w.id ? (
                            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <input value={nauka} onChange={e => setNauka(e.target.value)} placeholder="Czego się nauczyłeś?" style={pole} />
                                <div style={{ display: 'flex', gap: 5 }}>
                                    {(['TRAFIONE', 'CHYBIONE', 'NIEROZSTRZYGNIETE'] as Ocena[]).map(o => (
                                        <button key={o} onClick={() => domknij(w.id, o)}
                                            style={{ padding: '4px 9px', borderRadius: 6, fontSize: 8.5, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace",
                                                border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.7)' }}>
                                            {o}
                                        </button>
                                    ))}
                                    <button onClick={() => { setDomykam(null); setNauka(''); }}
                                        style={{ marginLeft: 'auto', padding: '4px 9px', borderRadius: 6, fontSize: 8.5, cursor: 'pointer',
                                            border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(255,255,255,.4)' }}>✕</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setDomykam(w.id)}
                                style={{ marginTop: 5, padding: '3px 9px', borderRadius: 6, fontSize: 8.5, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace",
                                    border: '1px solid rgba(180,100,255,.3)', background: 'rgba(180,100,255,.07)', color: '#d8b4fe',
                                    display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Check size={10} /> DOMKNIJ WYNIKIEM
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DziennikDecyzji;
