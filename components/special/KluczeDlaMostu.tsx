/**
 * 🔗 Klucze Kibla dla mostu — Kibel trzyma klucze w tej przeglądarce; Game Studio, Kodeks i Reżyser gry
 * pracują w moście i ich nie widzą. „Udostępnij mostowi” = świadomy krok Suwerena: klucz idzie do
 * _OtakOs_Wymiar/kibel_<dostawca>.txt na tej maszynie (tylko 127.0.0.1). „Zabierz” kasuje plik.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getKeyDirect } from '../../lib/kibel';

const MOST = 'http://127.0.0.1:3001';
type Dostawca = 'anthropic' | 'gemini';
interface StanKlucza { nazwa: string; udostepniony: boolean; koncowka: string | null; zrodlo: 'kibel' | 'inne' | null }
const DOSTAWCY: Dostawca[] = ['anthropic', 'gemini'];

export const KluczeDlaMostu: React.FC = () => {
    const [stan, setStan] = useState<Record<Dostawca, StanKlucza> | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [praca, setPraca] = useState<Dostawca | null>(null);

    const odczytaj = useCallback(async (p: Promise<Response>) => {
        const d = await (await p).json().catch(() => ({}));
        if (!d.success) throw new Error(d.message || 'Most nie odpowiedział.');
        setStan(d.klucze); setBlad(null);
    }, []);
    useEffect(() => { odczytaj(fetch(`${MOST}/api/kibel/most`)).catch((e) => setBlad(`Most śpi albo odmówił: ${(e as Error).message}`)); }, [odczytaj]);

    const udostepnij = async (d: Dostawca) => {
        const klucz = getKeyDirect(d);
        if (!klucz || typeof klucz !== 'string') { setBlad(`W Kiblu tej przeglądarki nie ma klucza ${d}.`); return; }
        setPraca(d);
        try { await odczytaj(fetch(`${MOST}/api/kibel/most`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dostawca: d, klucz }) })); }
        catch (e) { setBlad((e as Error).message); } finally { setPraca(null); }
    };
    const zabierz = async (d: Dostawca) => {
        setPraca(d);
        try { await odczytaj(fetch(`${MOST}/api/kibel/most/${d}`, { method: 'DELETE' })); }
        catch (e) { setBlad((e as Error).message); } finally { setPraca(null); }
    };

    return (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(15,23,42,0.6)', fontSize: 12, color: '#cbd5e1' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🔗 Klucze dla mostu (Game Studio, Kodeks, Reżyser gry)</div>
            <div style={{ color: '#94a3b8', marginBottom: 8 }}>Klucz z Kibla żyje w tej przeglądarce. Udostępnienie zapisuje go na tej maszynie dla mostu — tylko na Twój znak.</div>
            {DOSTAWCY.map((d) => {
                const s = stan?.[d];
                const wKiblu = !!getKeyDirect(d);
                return (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ minWidth: 130 }}>{s?.nazwa ?? d}</span>
                        <span style={{ color: s?.koncowka ? '#4ade80' : '#f87171' }}>
                            {s?.koncowka ? `most ma klucz ${s.koncowka}${s.zrodlo === 'inne' ? ' (env / plik)' : ''}` : 'most nie ma klucza'}
                        </span>
                        {wKiblu && !s?.udostepniony && <button disabled={!!praca} onClick={() => void udostepnij(d)} style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer' }}>{praca === d ? '…' : '🔗 Udostępnij mostowi'}</button>}
                        {s?.udostepniony && <button disabled={!!praca} onClick={() => void zabierz(d)} style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, background: 'transparent', color: '#f87171', border: '1px solid #f87171', cursor: 'pointer' }}>{praca === d ? '…' : '✕ Zabierz'}</button>}
                        {!wKiblu && !s?.udostepniony && <span style={{ marginLeft: 'auto', color: '#64748b' }}>brak w Kiblu</span>}
                    </div>
                );
            })}
            <div style={{ color: '#94a3b8', marginTop: 4 }}>Klucz API to rachunek za tokeny u dostawcy — osobno od abonamentu (Claude Pro/Max, Gemini Advanced).</div>
            {blad && <div style={{ color: '#f87171', marginTop: 4 }}>{blad}</div>}
        </div>
    );
};

export default KluczeDlaMostu;
