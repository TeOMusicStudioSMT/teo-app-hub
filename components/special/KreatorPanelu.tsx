/**
 * 🥚🛠️ Kreator Panelu — warsztat dla gatunku, który go jeszcze nie ma.
 *
 * Otwiera się przy pierwszym wejściu w kartę wykluty gatunku bez panelu.
 * Cztery kroki: DOMENA → NARZĘDZIA → JAJO → WYSTAWIENIE.
 *
 * ⚠️ Lista domen i narzędzi pochodzi z żywego routera mostu, nie z tablicy
 * wpisanej tutaj. Jeśli mostu nie ma, kreator mówi to wprost i nie pozwala
 * zbudować panelu — bo panel bez sprawdzonych tras byłby atrapą z guzikami.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, Dices, Check, ArrowRight, ArrowLeft, Store } from 'lucide-react';
import {
    pobierzDomeny, losujJajo, zapiszPanel, wystawPanel,
    type Domena, type Jajo, type Narzedzie, type PanelDef,
} from '../../lib/paneleTeogochi';
import type { Gatunek } from '../../lib/teogochiGatunki';

const ETAPY = ['jajko', 'pisklę', 'młodzik', 'kompan', 'legenda'];

interface Props {
    gat: Gatunek;
    onGotowe: (p: PanelDef) => void;
    onAnuluj: () => void;
}

export const KreatorPanelu: React.FC<Props> = ({ gat, onGotowe, onAnuluj }) => {
    const [krok, setKrok] = useState(1);
    const [domeny, setDomeny] = useState<Domena[]>([]);
    const [szukaj, setSzukaj] = useState('');
    const [domena, setDomena] = useState<Domena | null>(null);
    const [wybrane, setWybrane] = useState<Narzedzie[]>([]);
    const [jajo, setJajo] = useState<Jajo | null>(null);
    const [wlasne, setWlasne] = useState(false);
    const [cena, setCena] = useState('0');
    const [panel, setPanel] = useState<PanelDef | null>(null);
    const [blad, setBlad] = useState('');
    const [info, setInfo] = useState('');
    const [zajety, setZajety] = useState(false);

    useEffect(() => {
        pobierzDomeny()
            .then(d => {
                setDomeny(d);
                // Podpowiadamy domenę po narzędziach, które gatunek DEKLARUJE.
                // To tylko podpowiedź — decyduje Suweren.
                const pierwsza = gat.narzedzia[0]?.split('/')[2];
                const trafiona = d.find(x => x.id === pierwsza);
                if (trafiona) setDomena(trafiona);
            })
            .catch(e => setBlad(`${(e as Error).message} Bez mostu nie ma z czego zbudować panelu — katalog narzędzi to jego router.`));
        void losujJajo(gat.id).then(setJajo).catch(() => { /* jajo dolosujemy ręcznie */ });
    }, [gat.id, gat.narzedzia]);

    const przelacz = useCallback((n: Narzedzie) => {
        setWybrane(w => w.some(x => x.sciezka === n.sciezka && x.metoda === n.metoda)
            ? w.filter(x => !(x.sciezka === n.sciezka && x.metoda === n.metoda))
            : [...w, n]);
    }, []);

    const zbuduj = async () => {
        setZajety(true); setBlad(''); setInfo('');
        try {
            const p = await zapiszPanel({
                gatunek: gat.id,
                domena: domena?.prefiks ?? null,
                narzedzia: wybrane,
                jajo: jajo!,
                nazwa: gat.imie,
                opis: gat.opis,
                wlasneJajo: wlasne,
            });
            setPanel(p);
            setInfo(`✅ Panel „${p.nazwa}" zbudowany — ${p.narzedzia.length} narzędzi sprawdzonych na moście.`);
            setKrok(4);
        } catch (e) { setBlad((e as Error).message); }
        finally { setZajety(false); }
    };

    const doMarketu = async () => {
        setZajety(true); setBlad('');
        try {
            const r = await wystawPanel(gat.id, Number(cena) || 0, 'Mistrz Arkadiusz');
            setInfo(`🏪 Wystawione w Marketplace jako „${r.oferta.name}".`);
        } catch (e) { setBlad((e as Error).message); }
        finally { setZajety(false); }
    };

    const widoczne = domeny.filter(d => !szukaj || d.id.includes(szukaj.toLowerCase()));

    return (
        <section className="rounded-2xl border p-5 space-y-4"
            style={{ borderColor: `${gat.kolor}55`, background: `${gat.kolor}0d` }}>

            <header className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Sparkles size={18} style={{ color: gat.kolor }} />
                    <h3 className="font-bold text-slate-100">
                        Kreator panelu — {gat.imie}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">krok {krok} z 4</span>
                </div>
                <button onClick={onAnuluj} className="text-[11px] text-slate-500 hover:text-slate-300">zamknij</button>
            </header>

            {blad && <p className="flex items-start gap-2 text-sm text-amber-400">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{blad}</span></p>}
            {info && <p className="text-sm text-emerald-400">{info}</p>}

            {/* ── KROK 1: DOMENA ── */}
            {krok === 1 && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Wybierz dziedzinę. Ta lista to <b className="text-slate-300">żywy router mostu</b> —
                        {domeny.length} domen, które naprawdę istnieją. Czego tu nie ma, tego most nie potrafi.
                    </p>
                    <input
                        value={szukaj} onChange={e => setSzukaj(e.target.value)}
                        placeholder="szukaj domeny…"
                        className="w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    />
                    <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4 max-h-64 overflow-y-auto pr-1">
                        {widoczne.map(d => (
                            <button key={d.id} onClick={() => { setDomena(d); setWybrane([]); }}
                                className="rounded-lg border px-2.5 py-2 text-left transition-colors"
                                style={{
                                    borderColor: domena?.id === d.id ? gat.kolor : 'rgba(148,163,184,0.18)',
                                    background: domena?.id === d.id ? `${gat.kolor}1a` : 'rgba(0,0,0,0.3)',
                                }}>
                                <div className="text-xs font-mono text-slate-200 truncate">/{d.id}</div>
                                <div className="text-[10px] text-slate-500">{d.ile} narzędzi</div>
                            </button>
                        ))}
                        {!widoczne.length && <p className="text-xs text-slate-500 col-span-full">Nic nie pasuje.</p>}
                    </div>
                    <div className="flex justify-end">
                        <button onClick={() => setKrok(2)} disabled={!domena}
                            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-40"
                            style={{ background: gat.kolor }}>
                            Narzędzia <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── KROK 2: NARZĘDZIA ── */}
            {krok === 2 && domena && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                        Co ma umieć <b className="text-slate-300">{gat.imie}</b> z domeny
                        <code className="mx-1 text-slate-300">{domena.prefiks}</code>? Każde zaznaczone
                        narzędzie stanie się guzikiem, który naprawdę woła tę trasę.
                    </p>
                    <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                        {domena.narzedzia.map(n => {
                            const zazn = wybrane.some(x => x.sciezka === n.sciezka && x.metoda === n.metoda);
                            return (
                                <button key={`${n.metoda} ${n.sciezka}`} onClick={() => przelacz(n)}
                                    className="w-full flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors"
                                    style={{
                                        borderColor: zazn ? gat.kolor : 'rgba(148,163,184,0.15)',
                                        background: zazn ? `${gat.kolor}14` : 'rgba(0,0,0,0.3)',
                                    }}>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                                        style={{ background: n.metoda === 'GET' ? '#1e293b' : '#422006', color: n.metoda === 'GET' ? '#94a3b8' : '#fbbf24' }}>
                                        {n.metoda}
                                    </span>
                                    <code className="text-[11px] text-slate-300 truncate flex-1">{n.sciezka}</code>
                                    {zazn && <Check size={13} style={{ color: gat.kolor }} />}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex justify-between">
                        <button onClick={() => setKrok(1)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
                            <ArrowLeft size={13} /> domena
                        </button>
                        <button onClick={() => setKrok(3)} disabled={!wybrane.length}
                            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-40"
                            style={{ background: gat.kolor }}>
                            Jajo ({wybrane.length}) <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── KROK 3: JAJO ── */}
            {krok === 3 && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Wygląd na pięciu etapach. To <b className="text-slate-300">kosmetyka</b> — nie daje
                        agentowi żadnej mocy i nie udaje, że daje. Losowanie idzie z ziarna, więc to samo
                        ziarno odtworzy to samo jajo na innym węźle.
                    </p>

                    <div className="flex items-center gap-3 flex-wrap rounded-lg bg-black/30 p-3">
                        {ETAPY.map(e => (
                            <div key={e} className="text-center">
                                {wlasne ? (
                                    <input
                                        value={jajo?.formy[e] ?? ''}
                                        onChange={ev => setJajo(j => j ? { ...j, formy: { ...j.formy, [e]: ev.target.value } } : j)}
                                        className="w-12 rounded border border-slate-700 bg-black/50 py-1 text-center text-2xl outline-none focus:border-slate-500"
                                    />
                                ) : (
                                    <div className="text-3xl leading-none">{jajo?.formy[e] ?? '…'}</div>
                                )}
                                <div className="text-[9px] font-mono text-slate-600 mt-1">{e}</div>
                            </div>
                        ))}
                        <div className="ml-auto flex items-center gap-2">
                            {wlasne && (
                                <input type="color" value={jajo?.kolor ?? '#a855f7'}
                                    onChange={ev => setJajo(j => j ? { ...j, kolor: ev.target.value } : j)}
                                    className="h-8 w-10 rounded border border-slate-700 bg-transparent" />
                            )}
                            <button onClick={() => { setWlasne(false); void losujJajo().then(setJajo); }}
                                disabled={zajety}
                                className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">
                                <Dices size={13} /> Losuj
                            </button>
                            <button onClick={() => setWlasne(w => !w)}
                                className="rounded-lg border px-3 py-1.5 text-xs"
                                style={{ borderColor: wlasne ? gat.kolor : 'rgba(148,163,184,0.3)', color: wlasne ? gat.kolor : '#94a3b8' }}>
                                Własny projekt
                            </button>
                        </div>
                    </div>
                    {jajo && <p className="text-[10px] font-mono text-slate-600">ziarno: {jajo.ziarno}</p>}

                    <div className="flex justify-between">
                        <button onClick={() => setKrok(2)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
                            <ArrowLeft size={13} /> narzędzia
                        </button>
                        <button onClick={zbuduj} disabled={zajety || !jajo}
                            className="rounded-lg px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-40"
                            style={{ background: gat.kolor }}>
                            Zbuduj panel
                        </button>
                    </div>
                </div>
            )}

            {/* ── KROK 4: MARKETPLACE ── */}
            {krok === 4 && panel && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Panel gotowy i zapisany na moście. Możesz go wystawić w Marketplace — oferta
                        niesie <b className="text-slate-300">przepis</b> (domena, narzędzia, jajo), więc kto
                        go zaimportuje, dostanie te same trasy. Jeśli jego most ich nie ma, zapis się nie uda.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-[11px] font-mono text-slate-500">cena GRV</label>
                        <input value={cena} onChange={e => setCena(e.target.value)}
                            className="w-24 rounded-lg border border-slate-700 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-slate-500" />
                        <button onClick={doMarketu} disabled={zajety || !!panel.ofertaId}
                            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-40"
                            style={{ background: gat.kolor }}>
                            <Store size={14} /> Wystaw w Marketplace
                        </button>
                        <button onClick={() => onGotowe(panel)}
                            className="rounded-lg border px-4 py-2 text-sm"
                            style={{ borderColor: gat.kolor, color: gat.kolor }}>
                            Otwórz panel
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default KreatorPanelu;
