/**
 * ⚖️ Panel Bilansu — drabina rang, osiągnięcia i questy.
 *
 * Bilans to gatunek TeOgochi od ekonomii, więc GRV, rangi i questy są jego
 * warsztatem. Panel pokazuje WYŁĄCZNIE to, co most policzył z faktów zapisanych
 * na dysku — postęp questu nie bierze się z pamięci przeglądarki, tylko z szyny
 * zdarzeń, dziennika napraw i rejestru posiadanych aktywów.
 *
 * ⚠️ Dlatego liczników NIE DA SIĘ podkręcić z konsoli. Gdyby postęp liczył się
 * po stronie frontu, każda ranga byłaby na sprzedaż za jedno `localStorage.setItem`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Scale, RefreshCw, AlertTriangle, Trophy, KeyRound, Check, Users, Copy } from 'lucide-react';

const MOST = 'http://127.0.0.1:3001';
const WEZEL = 'Mistrz Arkadiusz';

interface Szczebel { ranga: string; grv: number; wejscie: string; wolne: number | string | null; }
interface Osiagniecie { id: string; nazwa: string; ikona: string; opis: string; zdobyte: boolean; }
interface Konto {
    id: string; mail: string; wezel: string; rola: string; opis: string;
    ranga: string | null; saldo: number | string | null;
}
interface Klucz { klucz: string; wydany: string; notatka: string | null; uzytyPrzez: string | null; uzytyO: string | null; }
interface Quest {
    id: string; szczebel: string; ikona: string; nazwa: string; opis: string;
    nagroda: number; cel: number; teraz: number; procent: number;
    ukonczony: boolean; odebrany: boolean; doOdbioru: boolean;
}

const ETYKIETA: Record<string, string> = {
    basic: 'Basic', herald: 'Herold', pillar: 'Filar', founder: 'Founder',
};
const BARWA: Record<string, string> = {
    basic: '#64748b', herald: '#22d3ee', pillar: '#a855f7', founder: '#fbbf24',
};

export const PanelBilans: React.FC = () => {
    const [drabina, setDrabina] = useState<Szczebel[]>([]);
    const [ranga, setRanga] = useState<string | null>(null);
    const [osiagniecia, setOsiagniecia] = useState<Osiagniecie[]>([]);
    const [progHerolda, setProgHerolda] = useState(3);
    const [questy, setQuesty] = useState<Quest[]>([]);
    const [czekaGrv, setCzekaGrv] = useState(0);
    const [saldo, setSaldo] = useState<string | null>(null);
    const [konta, setKonta] = useState<Konto[]>([]);
    const [klucze, setKlucze] = useState<Klucz[]>([]);
    const [wolneSloty, setWolneSloty] = useState<number | null>(null);
    const [kluczDoUzycia, setKluczDoUzycia] = useState('');
    const [haslo, setHaslo] = useState('');
    const [blad, setBlad] = useState('');
    const [info, setInfo] = useState('');
    const [zajety, setZajety] = useState(false);

    const odswiez = useCallback(async () => {
        setBlad('');
        try {
            const [d, o, q, w, kt, kl] = await Promise.all([
                fetch(`${MOST}/api/grv/drabina`).then(r => r.json()),
                fetch(`${MOST}/api/grv/osiagniecia?wezel=${encodeURIComponent(WEZEL)}`).then(r => r.json()),
                fetch(`${MOST}/api/grv/questy?wezel=${encodeURIComponent(WEZEL)}`).then(r => r.json()),
                fetch(`${MOST}/api/grv/${encodeURIComponent(WEZEL)}`).then(r => r.json()),
                fetch(`${MOST}/api/konta`).then(r => r.json()),
                fetch(`${MOST}/api/grv/klucze`).then(r => r.json()),
            ]);
            setKonta(kt.konta ?? []);
            setKlucze(kl.klucze ?? []);
            setWolneSloty(kl.wolnychMiejsc ?? null);
            setDrabina(d.szczeble ?? []);
            setOsiagniecia(o.osiagniecia ?? []);
            setProgHerolda(o.progHerolda ?? 3);
            setRanga(o.ranga ?? null);
            setQuesty(q.questy ?? []);
            setCzekaGrv(q.czekaGrv ?? 0);
            setSaldo(w?.grv != null ? String(w.grv) : null);
        } catch {
            setBlad('Most nie odpowiada — rangi i questy liczy on, więc bez niego nie ma czego pokazać.');
        }
    }, []);

    useEffect(() => { void odswiez(); }, [odswiez]);

    const odbierz = async (quest: Quest) => {
        setZajety(true); setBlad(''); setInfo('');
        try {
            const r = await fetch(`${MOST}/api/grv/quest/odbierz`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wezel: WEZEL, quest: quest.id }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || 'Most odmówił wypłaty.');
            setInfo(`✅ „${d.nazwa}" — wypłacono ${d.nagroda} GRV.`);
            await odswiez();
        } catch (e) { setBlad((e as Error).message); }
        finally { setZajety(false); }
    };

    const wydajKlucz = async () => {
        setZajety(true); setBlad(''); setInfo('');
        try {
            const r = await fetch(`${MOST}/api/grv/klucze/wydaj`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ile: 1 }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || 'Most odmówił wydania klucza.');
            setInfo(`🗝️ Wydano klucz: ${d.klucze?.[0]} — przekaż go osobiście, działa RAZ.`);
            await odswiez();
        } catch (e) { setBlad((e as Error).message); }
        finally { setZajety(false); }
    };

    const uzyjKlucza = async () => {
        setZajety(true); setBlad(''); setInfo('');
        try {
            const r = await fetch(`${MOST}/api/grv/klucze/uzyj`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ klucz: kluczDoUzycia.trim(), wezel: WEZEL }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || 'Klucz odrzucony.');
            setInfo(`🏛️ Founder przyjęty${d.dosypano ? ` — dosypano ${d.dosypano} GRV.` : '.'}`);
            setKluczDoUzycia('');
            await odswiez();
        } catch (e) { setBlad((e as Error).message); }
        finally { setZajety(false); }
    };

    const awansNaFilara = async () => {
        setZajety(true); setBlad(''); setInfo('');
        try {
            const r = await fetch(`${MOST}/api/grv/awans`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wezel: WEZEL, ranga: 'pillar', haslo }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || 'Awans odrzucony.');
            setInfo(`🏅 Filar przyjęty${d.dosypano ? ` — dosypano ${d.dosypano} GRV.` : '.'}`);
            setHaslo('');
            await odswiez();
        } catch (e) { setBlad((e as Error).message); }
        finally { setZajety(false); }
    };

    const zdobyte = osiagniecia.filter(o => o.zdobyte).length;
    const szczeble = ['herald', 'pillar', 'founder'];

    return (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5 space-y-5">
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Scale size={18} className="text-amber-400" />
                    <h3 className="font-bold text-amber-200">Bilans — rangi, osiągnięcia, questy</h3>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-slate-400">
                        {ranga ? ETYKIETA[ranga] ?? ranga : 'basic'} · {saldo ?? '—'} GRV
                    </span>
                    <button onClick={odswiez} className="rounded-lg border border-slate-700 px-2 py-1.5 text-slate-300 hover:border-slate-500">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </header>

            {blad && <p className="flex items-start gap-2 text-sm text-amber-400">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{blad}</span></p>}
            {info && <p className="text-sm text-emerald-400">{info}</p>}

            {/* ── DRABINA ── */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {drabina.map(s => (
                    <div key={s.ranga}
                        className="rounded-lg border p-3"
                        style={{
                            borderColor: ranga === s.ranga ? BARWA[s.ranga] : 'rgba(148,163,184,0.18)',
                            background: ranga === s.ranga ? `${BARWA[s.ranga]}14` : 'rgba(0,0,0,0.25)',
                        }}>
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm font-bold" style={{ color: BARWA[s.ranga] }}>
                                {ETYKIETA[s.ranga] ?? s.ranga}
                            </span>
                            {ranga === s.ranga && <span className="text-[9px] font-mono text-slate-400">TWOJA</span>}
                        </div>
                        <div className="text-[11px] font-mono text-slate-300">{s.grv.toLocaleString('pl-PL')} GRV</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{s.wejscie}</div>
                        <div className="text-[10px] text-slate-600">
                            {s.wolne === null ? '' : `wolne: ${s.wolne}`}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── FILAR NA HASŁO ── */}
            {ranga !== 'pillar' && ranga !== 'founder' && (
                <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-purple-300 mb-2">
                        <KeyRound size={12} /> krąg Filarów — wejście na hasło, miejsc bez ograniczeń
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text" value={haslo} onChange={e => setHaslo(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && awansNaFilara()}
                            placeholder="hasło kręgu"
                            className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-purple-500"
                        />
                        <button onClick={awansNaFilara} disabled={zajety || !haslo.trim()}
                            className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-40">
                            Wejdź
                        </button>
                    </div>
                </div>
            )}

            {/* ── KONTA ── */}
            <div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 mb-2">
                    <Users size={12} /> konta — rejestr trzyma MOST, nie przeglądarka
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                    {konta.map(k => (
                        <div key={k.id} className="rounded-lg border border-slate-700/60 bg-black/30 p-3">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-bold text-slate-200">{k.wezel}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                    style={{ color: BARWA[k.ranga ?? 'basic'], background: `${BARWA[k.ranga ?? 'basic']}1a` }}>
                                    {k.rola === 'zarzadca' ? 'zarządca' : ETYKIETA[k.ranga ?? 'basic'] ?? 'basic'}
                                </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 truncate" title={k.mail}>{k.mail}</div>
                            <div className="text-[11px] font-mono text-amber-300 mt-0.5">
                                {k.saldo === 'INFINITE' ? '∞ GRV' : `${Number(k.saldo ?? 0).toLocaleString('pl-PL')} GRV`}
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">{k.opis}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── KLUCZE ZAŁOŻYCIELSKIE ── */}
            <div className="rounded-lg border border-amber-500/25 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-300/80">
                        <KeyRound size={12} /> klucze założycielskie
                        {wolneSloty !== null && <span className="text-slate-600">· wolnych miejsc: {wolneSloty}</span>}
                    </div>
                    <button onClick={wydajKlucz} disabled={zajety || wolneSloty === 0}
                        className="rounded-lg border border-amber-500/50 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/10 disabled:opacity-40">
                        Wydaj klucz
                    </button>
                </div>

                {klucze.length > 0 && (
                    <div className="space-y-1 mb-2">
                        {klucze.map(k => (
                            <div key={k.klucz} className="flex items-center justify-between gap-2 rounded bg-black/40 px-2 py-1.5">
                                <code className={`text-[11px] font-mono truncate ${k.uzytyPrzez ? 'text-slate-600 line-through' : 'text-amber-200'}`}>
                                    {k.klucz}
                                </code>
                                {k.uzytyPrzez ? (
                                    <span className="text-[10px] text-slate-500 shrink-0">wypalony · {k.uzytyPrzez}</span>
                                ) : (
                                    <button onClick={() => navigator.clipboard?.writeText(k.klucz)}
                                        title="skopiuj" className="text-slate-500 hover:text-amber-300 shrink-0">
                                        <Copy size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {ranga !== 'founder' && (
                    <div className="flex gap-2">
                        <input
                            type="text" value={kluczDoUzycia} onChange={e => setKluczDoUzycia(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && uzyjKlucza()}
                            placeholder="FOUNDER-XXXX-XXXX-XXXX"
                            className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm font-mono outline-none focus:border-amber-500"
                        />
                        <button onClick={uzyjKlucza} disabled={zajety || !kluczDoUzycia.trim()}
                            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-40">
                            Użyj
                        </button>
                    </div>
                )}

                <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
                    Klucz działa RAZ i po użyciu zostaje wypalony. Most nie wyda więcej kluczy,
                    niż zostało wolnych miejsc Foundera — obietnica bez pokrycia byłaby gorsza niż odmowa.
                </p>
            </div>

            {/* ── OSIĄGNIĘCIA ── */}
            <div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 mb-2">
                    <Trophy size={12} /> osiągnięcia — {zdobyte}/{osiagniecia.length}
                    <span className="text-slate-600">(Herold od {progHerolda})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {osiagniecia.map(o => (
                        <span key={o.id} title={o.opis}
                            className={`rounded-full border px-2.5 py-1 text-[11px] ${
                                o.zdobyte
                                    ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300'
                                    : 'border-slate-700 bg-black/30 text-slate-600'
                            }`}>
                            {o.ikona} {o.nazwa}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── QUESTY ── */}
            <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-2">
                    <span>questy — od Herolda wzwyż</span>
                    {czekaGrv > 0 && (
                        <span className="text-amber-300">czeka {czekaGrv.toLocaleString('pl-PL')} GRV</span>
                    )}
                </div>
                <div className="space-y-3">
                    {szczeble.map(sz => {
                        const grupa = questy.filter(q => q.szczebel === sz);
                        if (!grupa.length) return null;
                        return (
                            <div key={sz}>
                                <div className="text-[10px] font-mono uppercase mb-1" style={{ color: BARWA[sz] }}>
                                    {ETYKIETA[sz] ?? sz}
                                </div>
                                <div className="space-y-1.5">
                                    {grupa.map(q => (
                                        <div key={q.id} className="rounded-lg bg-black/30 p-2.5">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="text-xs text-slate-200 truncate">
                                                    {q.ikona} {q.nazwa}
                                                </span>
                                                {q.odebrany ? (
                                                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 shrink-0">
                                                        <Check size={11} /> odebrane
                                                    </span>
                                                ) : q.doOdbioru ? (
                                                    <button onClick={() => odbierz(q)} disabled={zajety}
                                                        className="rounded px-2.5 py-1 text-[10px] font-bold text-slate-900 shrink-0 disabled:opacity-40"
                                                        style={{ background: BARWA[sz] }}>
                                                        Odbierz {q.nagroda.toLocaleString('pl-PL')} GRV
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                                        {q.teraz}/{q.cel} · {q.nagroda.toLocaleString('pl-PL')} GRV
                                                    </span>
                                                )}
                                            </div>
                                            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${q.procent}%`, background: BARWA[sz] }} />
                                            </div>
                                            <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">{q.opis}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <p className="text-[10px] text-slate-600 leading-relaxed">
                Postęp liczy MOST — z szyny zdarzeń, dziennika napraw i rejestru aktywów.
                Nie da się go podkręcić z przeglądarki, bo nie stamtąd pochodzi.
            </p>
        </section>
    );
};

export default PanelBilans;
