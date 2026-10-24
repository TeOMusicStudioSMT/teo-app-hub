/**
 * ☀️ Poranny brief Katedry — widok w menu (Rdzeń i tarcza) + pasek rano, gdy dzisiejszy brief czeka (services/PorannyBrief.js).
 *
 * Fakty składa most (publikacje, programy, autopilot formatów, Stół, Sklep Mini, sprzedaż, Nocna Zmiana, błędy mostu);
 * tu tylko je pokazujemy, „☀️ teraz” składa brief od nowa, a ustawienia mówią, o której godzinie i czy głosem Mistrza.
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';
const KLUCZ_PRZECZYTANY = 'otakos_brief_przeczytany';

interface Linia { tekst: string; pilne?: boolean }
interface Sekcja { id: string; tytul: string; linie: Linia[] }
interface Brief { dzien: string; kiedy: string; sekcje: Sekcja[]; pilnych: number; ileCzeka: number; ileUwag: number; filmow: number; zapowiedz: string }
interface Ustawienia { wlaczony: boolean; godzina: number; glos: boolean }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}
const dzisiaj = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const odmiana = (n: number, jeden: string, kilka: string, wiele: string) => (n === 1 ? jeden : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? kilka : wiele);
const przeczytaj = (dzien: string) => { try { localStorage.setItem(KLUCZ_PRZECZYTANY, dzien); } catch { /* bez pamięci */ } };

export const PorannyBriefView: React.FC = () => {
    const [brief, setBrief] = useState<Brief | null>(null);
    const [ust, setUst] = useState<Ustawienia | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [sklada, setSklada] = useState(false);

    const wczytaj = useCallback(async () => {
        try { const d = await zMostu<{ brief: Brief | null; ustawienia: Ustawienia }>('/api/brief'); setBrief(d.brief); setUst(d.ustawienia); setBlad(null); if (d.brief) przeczytaj(d.brief.dzien); }
        catch (e: any) { setBlad(e.message); }
    }, []);
    useEffect(() => { void wczytaj(); }, [wczytaj]);

    const teraz = async () => {
        setSklada(true);
        try { const d = await zMostu<{ brief: Brief }>('/api/brief/teraz', { method: 'POST' }); setBrief(d.brief); przeczytaj(d.brief.dzien); setBlad(null); }
        catch (e: any) { setBlad(e.message); }
        finally { setSklada(false); }
    };
    const zmien = async (z: Partial<Ustawienia>) => {
        try { const d = await zMostu<{ ustawienia: Ustawienia }>('/api/brief/ustawienia', { method: 'PUT', body: JSON.stringify(z) }); setUst(d.ustawienia); }
        catch (e: any) { setBlad(e.message); }
    };

    const kolor: Record<string, string> = { czeka: 'border-amber-500/40 bg-amber-950/20', dzien: 'border-cyan-500/30 bg-cyan-950/20', uwaga: 'border-rose-500/30 bg-rose-950/20' };
    return (
        <div className="mx-auto max-w-3xl space-y-4 p-4 text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-amber-200">☀️ Poranny brief Katedry</h2>
                    <p className="text-xs text-slate-400">Fakty z mostu: publikacje, programy, autopilot formatów, Stół, Sklep Mini, Nocna Zmiana, błędy mostu. Bez modelu — liczby, nie domysły.</p>
                </div>
                <button onClick={teraz} disabled={sklada} className="rounded-lg bg-amber-700/80 px-3 py-1.5 text-sm font-bold hover:bg-amber-600 disabled:opacity-50">
                    {sklada ? 'Składam…' : '☀️ Złóż teraz'}
                </button>
            </div>
            {blad && <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">⚠ {blad} {blad.includes('fetch') ? '— most Katedry nie odpowiada.' : ''}</div>}
            {!brief && !blad && <div className="text-sm text-slate-400">Dziś jeszcze nie było briefu{ust ? ` — przyjdzie o ${ust.godzina}:00` : ''}. Możesz go złożyć teraz.</div>}
            {brief && (
                <>
                    <div className="text-sm text-slate-300">{brief.zapowiedz.replace(/ Pełny brief:.*$/, '')}
                        <span className="ml-2 text-xs text-slate-500">({brief.dzien === dzisiaj() ? 'dzisiejszy' : `z ${brief.dzien}`}, {new Date(brief.kiedy).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })})</span>
                    </div>
                    {brief.sekcje.map((s) => (
                        <div key={s.id} className={`rounded-xl border p-3 ${kolor[s.id] ?? 'border-slate-700'}`}>
                            <div className="mb-1.5 text-sm font-bold">{s.tytul}</div>
                            <ul className="space-y-1 text-sm">
                                {s.linie.map((l, i) => <li key={i} className={l.pilne ? 'font-semibold text-amber-100' : 'text-slate-300'}>{l.tekst}</li>)}
                            </ul>
                        </div>
                    ))}
                </>
            )}
            {ust && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={ust.wlaczony} onChange={(e) => zmien({ wlaczony: e.target.checked })} /> codziennie</label>
                    <label className="flex items-center gap-1.5">o godzinie
                        <select value={ust.godzina} onChange={(e) => zmien({ godzina: Number(e.target.value) })} className="rounded bg-slate-800 px-1 py-0.5">
                            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
                        </select>
                    </label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={ust.glos} onChange={(e) => zmien({ glos: e.target.checked })} /> zapowiedź głosem Mistrza (Orbita)</label>
                    <span className="text-slate-500">Zapowiedź idzie kanałem Mistrza do Orbity.</span>
                </div>
            )}
        </div>
    );
};

/** Pasek nad widokiem: dzisiejszy brief jest, a jeszcze go nie otwierałeś. */
export const PorannyBriefBaner: React.FC<{ onOtworz: () => void }> = ({ onOtworz }) => {
    const [brief, setBrief] = useState<Brief | null>(null);
    useEffect(() => {
        let przeczytany = '';
        try { przeczytany = localStorage.getItem(KLUCZ_PRZECZYTANY) ?? ''; } catch { /* bez pamięci */ }
        if (przeczytany === dzisiaj()) return;
        zMostu<{ brief: Brief | null }>('/api/brief').then((d) => { if (d.brief?.dzien === dzisiaj()) setBrief(d.brief); }).catch(() => { /* most milczy — bez paska */ });
    }, []);
    if (!brief) return null;
    return (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-2 text-sm text-amber-100">
            <span>☀️ {brief.ileCzeka ? `${brief.ileCzeka} ${odmiana(brief.ileCzeka, 'sprawa czeka', 'sprawy czekają', 'spraw czeka')} na Ciebie` : 'Nic nie czeka na Twoje ✓'} · {brief.filmow} {odmiana(brief.filmow, 'film', 'filmy', 'filmów')} wczoraj{brief.ileUwag ? ` · ${brief.ileUwag} do sprawdzenia` : ''}</span>
            <span className="flex gap-2">
                <button onClick={() => { przeczytaj(brief.dzien); onOtworz(); }} className="rounded-lg bg-amber-700/80 px-3 py-1 text-xs font-bold hover:bg-amber-600">Brief</button>
                <button onClick={() => { przeczytaj(brief.dzien); setBrief(null); }} className="rounded-lg border border-amber-600/50 px-3 py-1 text-xs hover:bg-amber-900/40">Później</button>
            </span>
        </div>
    );
};

export default PorannyBriefView;
