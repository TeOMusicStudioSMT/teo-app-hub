/**
 * 📰 TunelRynkowy — Tunel Wiadomości Rynkowych (0.00G)
 *
 * Czytnik nagłówków z 6 kanałów + streszczenie nastroju prasy liczone LOKALNIE.
 * Myśl przewodnia Suwerena: rynek reaguje emocjonalnie, więc ton mediów jest
 * realnym sygnałem — inaczej niż wróżenie ze świec.
 *
 * ⚠️ To czytnik, nie doradca. Streszczenie to opinia modelu o TONIE nagłówków,
 * nigdy prognoza ani rekomendacja — i tak jest podpisane w UI oraz w API.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Newspaper, RefreshCw, Brain, ExternalLink } from 'lucide-react';
import { getBridgeBase } from '../../lib/bridgeService';

interface Wiadomosc {
    tytul: string; link: string; opis: string;
    zrodlo: string; zrodloId: string; rodzaj: 'krypto' | 'makro';
    czas: string | null;
}
interface RaportZrodla { id: string; nazwa: string; ok: boolean; pozycji: number; ms: number; blad?: string }

type Filtr = 'wszystko' | 'krypto' | 'makro';

const kiedy = (iso: string | null): string => {
    if (!iso) return '';
    const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (min < 1) return 'teraz';
    if (min < 60) return `${min} min temu`;
    const h = Math.round(min / 60);
    return h < 24 ? `${h} h temu` : `${Math.round(h / 24)} dni temu`;
};

export const TunelRynkowy: React.FC = () => {
    const [items, setItems]   = useState<Wiadomosc[]>([]);
    const [raport, setRaport] = useState<RaportZrodla[]>([]);
    const [filtr, setFiltr]   = useState<Filtr>('wszystko');
    const [laduje, setLaduje] = useState(false);
    const [blad, setBlad]     = useState<string | null>(null);
    const [pobranoO, setPobranoO] = useState<string | null>(null);

    const [nastroj, setNastroj]   = useState<string | null>(null);
    const [myslI, setMysli]       = useState(false);
    const [modelUzyty, setModel]  = useState<string | null>(null);

    const pobierz = useCallback(async (odswiez = false) => {
        setLaduje(true); setBlad(null);
        try {
            const q = new URLSearchParams({ limit: '40', ...(filtr !== 'wszystko' ? { rodzaj: filtr } : {}), ...(odswiez ? { odswiez: '1' } : {}) });
            const r = await fetch(`${getBridgeBase()}/api/rynek/wiadomosci?${q}`);
            const d = await r.json();
            if (!d.success) throw new Error(d.message || `HTTP ${r.status}`);
            setItems(d.items || []);
            setRaport(d.raport || []);
            setPobranoO(d.pobranoO || null);
        } catch (e: any) {
            setBlad(`Tunel nie doszedł do skutku: ${e?.message || e}`);
        } finally { setLaduje(false); }
    }, [filtr]);

    useEffect(() => { pobierz(); }, [pobierz]);

    const streszcz = async () => {
        setMysli(true); setNastroj(null);
        try {
            const r = await fetch(`${getBridgeBase()}/api/rynek/nastroj`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rodzaj: filtr === 'wszystko' ? undefined : filtr, maks: 20 }),
            });
            const d = await r.json();
            setNastroj(d.success ? d.streszczenie : `⚠️ ${d.message || 'Rdzeń nie odpowiedział.'}`);
            setModel(d.model || null);
        } catch (e: any) {
            setNastroj(`⚠️ Most nieosiągalny: ${e?.message || e}`);
        } finally { setMysli(false); }
    };

    const padle = raport.filter(r => !r.ok);

    return (
        <div style={{ background: 'rgba(8,10,18,.6)', border: '1px solid rgba(0,229,255,.18)', borderRadius: 12, padding: 14 }}>
            {/* Nagłówek */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'rgba(0,229,255,.5)' }}>∴ KATEDRA OTAKOS · CENTRUM FINANSOWE ∴</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e8f6ff', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Newspaper size={16} /> TUNEL WIADOMOŚCI
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)' }}>
                        {raport.filter(r => r.ok).length}/{raport.length} kanałów · {items.length} nagłówków
                        {pobranoO && ` · ${kiedy(pobranoO)}`}
                    </div>
                </div>
                <button onClick={() => pobierz(true)} disabled={laduje}
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 10, cursor: laduje ? 'wait' : 'pointer',
                        border: '1px solid rgba(0,229,255,.4)', background: 'rgba(0,229,255,.08)', color: '#67e8f9',
                        display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono',monospace" }}>
                    <RefreshCw size={12} className={laduje ? 'animate-spin' : ''} /> ODŚWIEŻ
                </button>
            </div>

            {/* Filtry + streszczenie */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
                {(['wszystko', 'krypto', 'makro'] as Filtr[]).map(f => (
                    <button key={f} onClick={() => setFiltr(f)}
                        style={{ padding: '5px 12px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace",
                            border: `1px solid ${filtr === f ? 'rgba(0,229,255,.6)' : 'rgba(255,255,255,.1)'}`,
                            background: filtr === f ? 'rgba(0,229,255,.1)' : 'rgba(255,255,255,.03)',
                            color: filtr === f ? '#00e5ff' : 'rgba(232,223,200,.7)' }}>
                        {f.toUpperCase()}
                    </button>
                ))}
                <button onClick={streszcz} disabled={myslI || !items.length}
                    style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, fontSize: 10, cursor: myslI ? 'wait' : 'pointer',
                        border: '1px solid rgba(192,132,252,.45)', background: 'rgba(192,132,252,.1)', color: '#d8b4fe',
                        display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono',monospace", opacity: items.length ? 1 : .4 }}>
                    <Brain size={12} /> {myslI ? 'CZYTAM NAGŁÓWKI...' : 'STRESZCZ NASTRÓJ'}
                </button>
            </div>

            {/* Streszczenie nastroju */}
            {nastroj && (
                <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: 'rgba(192,132,252,.06)', border: '1px solid rgba(192,132,252,.25)' }}>
                    <div style={{ fontSize: 8, letterSpacing: '.15em', color: 'rgba(216,180,254,.7)', marginBottom: 5 }}>
                        NASTRÓJ PRASY — OPINIA MODELU{modelUzyty ? ` · ${modelUzyty}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#f3e8ff', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{nastroj}</div>
                </div>
            )}

            {/* ⚠️ Granica, której nie przekraczamy — widoczna, nie schowana w kodzie */}
            <div style={{ marginBottom: 10, padding: '6px 9px', borderRadius: 8, background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.25)' }}>
                <div style={{ fontSize: 8.5, color: '#fcd34d', lineHeight: 1.55 }}>
                    ⚠️ Czytnik nagłówków, nie doradca. Streszczenie opisuje <b>ton mediów</b>, nie przyszłe ceny.
                    Nie jest poradą inwestycyjną ani podstawą decyzji finansowych.
                </div>
            </div>

            {/* Awarie kanałów — jawnie, bo cichy brak źródła fałszuje obraz nastroju */}
            {padle.length > 0 && (
                <div style={{ marginBottom: 8, fontSize: 8.5, color: 'rgba(252,165,165,.8)' }}>
                    ❌ Bez odpowiedzi: {padle.map(p => `${p.nazwa} (${p.blad})`).join(' · ')}
                </div>
            )}

            {blad && <div style={{ fontSize: 10, color: '#fca5a5', marginBottom: 8 }}>{blad}</div>}

            {/* Lista nagłówków */}
            <div style={{ maxHeight: 380, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {laduje && !items.length ? (
                    <div style={{ padding: 20, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,.4)' }}>⟳ Otwieram tunel...</div>
                ) : !items.length ? (
                    <div style={{ padding: 20, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,.35)' }}>Brak nagłówków.</div>
                ) : items.map((it, i) => (
                    <a key={i} href={it.link} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', padding: '7px 9px', borderRadius: 8, textDecoration: 'none',
                            background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 7.5, padding: '1px 5px', borderRadius: 4, letterSpacing: '.05em',
                                background: it.rodzaj === 'krypto' ? 'rgba(0,229,255,.12)' : 'rgba(251,191,36,.12)',
                                color: it.rodzaj === 'krypto' ? '#67e8f9' : '#fcd34d' }}>
                                {it.zrodlo}
                            </span>
                            <span style={{ fontSize: 7.5, color: 'rgba(255,255,255,.3)' }}>{kiedy(it.czas)}</span>
                            <ExternalLink size={9} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.25)' }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: 'rgba(232,246,255,.85)', lineHeight: 1.45 }}>{it.tytul}</div>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default TunelRynkowy;
