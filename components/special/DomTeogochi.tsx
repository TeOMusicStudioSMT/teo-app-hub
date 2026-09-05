/**
 * 🏠🥚 Dom TeOgochi — dawna strona Co-Bots.
 *
 * Trzynaście gatunków, każdy to osobny agent zadaniowy. Joanna (muzyka) była
 * pierwsza i zostaje — jest teraz jednym z gatunków, nie jedynym kompanem.
 *
 * Awatar pokazuje FAKTYCZNY stan ewolucji: dopóki gatunek nie ma XP, widać
 * jajko. Po wykluciu — jego własną formę. To nie ozdoba: forma czytana jest
 * ze stanu (`stanGatunku` → `stageOf`), więc nie da się jej podrobić.
 *
 * ⚠️ CO TA STRONA JUŻ ROBI: dom dla jaj, wykluwanie, wybór dyżurnego, podgląd
 * narzędzi i przykładowych poleceń każdego gatunku. Pięć gatunków ma panel
 * wbudowany; pozostałe budują go SOBIE — kreator składa warsztat z tras, które
 * most naprawdę wystawia (patrz KreatorPanelu), więc nie da się nim wyklikać
 * guzika prowadzącego donikąd.
 * ⚠️ CZEGO JESZCZE NIE ROBI: wykonywania zadań gatunków przez Orba głosem.
 * Mówimy to wprost, zamiast pokazywać przyciski, które nic nie robią.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import PanelKlatka from './PanelKlatka';
import PanelWektor from './PanelWektor';
import WorkPalace from './WorkPalace';
import PanelKodeks from './PanelKodeks';
import PanelBilans from './PanelBilans';
import KreatorPanelu from './KreatorPanelu';
import PanelWlasny from './PanelWlasny';
import { TeogochiPanel } from '../TeogochiPanel';
import { pobierzPanele, type PanelDef } from '../../lib/paneleTeogochi';
import { GATUNKI, type Gatunek } from '../../lib/teogochiGatunki';
import { stageOf } from '../../lib/teogochiState';
import {
    wykluteGatunki, wykluj, aktywnyGatunek, ustawAktywny, stanGatunku,
    modelGatunku, ustawModelGatunku,
} from '../../lib/teogochiStado';

/** Gatunki z panelem napisanym ręcznie. Reszta buduje swój w kreatorze. */
const WBUDOWANE = ['joanna', 'klatka', 'wektor', 'kodeks', 'bilans'];

const KartaGatunku: React.FC<{
    gat: Gatunek;
    wyklute: boolean;
    aktywny: boolean;
    modele: string[];
    wlasny: PanelDef | null;
    onWykluj: () => void;
    onDyzur: () => void;
    onKreator: () => void;
    onOtworzPanel?: () => void;
}> = ({ gat, wyklute, aktywny, modele, wlasny, onWykluj, onDyzur, onKreator, onOtworzPanel }) => {
    const [rdzen, setRdzen] = useState<string>(() => modelGatunku(gat.id));
    const stan = useMemo(() => (wyklute ? stanGatunku(gat.id) : null), [gat.id, wyklute]);
    const etap = stan ? stageOf(stan.xp) : null;
    // Jajo zaprojektowane w kreatorze wygrywa z fabrycznym — to wybór Suwerena.
    const formy = wlasny?.jajo?.formy ?? gat.formy;
    // Niewyklute pokazujemy jako jajko — bo tym właśnie są.
    const forma = wyklute && etap ? formy[etap.stage] : formy['jajko'];

    return (
        <motion.div
            layout
            className="rounded-2xl border p-4 flex flex-col gap-3 transition-colors"
            style={{
                borderColor: aktywny ? gat.kolor : 'rgba(148,163,184,0.18)',
                background: aktywny ? `${gat.kolor}14` : 'rgba(15,23,42,0.45)',
                boxShadow: aktywny ? `0 0 24px ${gat.kolor}33` : undefined,
            }}
        >
            <div className="flex items-start gap-3">
                <div className="text-4xl leading-none select-none" title={wyklute ? etap?.title : 'Jeszcze się nie wykluł'}>
                    {forma}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{gat.imie}</span>
                        {aktywny && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: gat.kolor, color: '#0a0f1c' }}>
                                DYŻUR
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] font-mono" style={{ color: gat.kolor }}>{gat.dziedzina}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        {wyklute && etap
                            ? `${etap.title} · ${stan!.xp} XP`
                            : 'jajko — jeszcze nie wykluty'}
                    </div>
                </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">{gat.opis}</p>

            <div className="text-[10px] font-mono text-slate-500 space-y-0.5">
                <div className="text-slate-600">narzędzia mostu:</div>
                {gat.narzedzia.map(n => <div key={n} className="truncate">· {n}</div>)}
            </div>

            <details className="text-[11px] text-slate-400">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-300">przykładowe polecenia</summary>
                <ul className="mt-1.5 space-y-1 pl-3">
                    {gat.zadania.map(z => <li key={z} className="text-slate-400">„{z}"</li>)}
                </ul>
            </details>

            {/* 🧠 RDZEŃ — na czym myśli ten gatunek. Lista jest REALNA (z /api/ollama/models),
                a nie polem tekstowym, bo wpisany z palca model-widmo dałby błąd dopiero
                przy wywołaniu. „Jak Katedra" = globalny otakos_active_model. */}
            {wyklute && (
                <label className="block">
                    <span className="text-[10px] font-mono text-slate-500">rdzeń (LLM)</span>
                    <select
                        value={rdzen}
                        onChange={(e) => { setRdzen(e.target.value); ustawModelGatunku(gat.id, e.target.value); }}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-black/40 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-slate-500"
                    >
                        <option value="">jak Katedra (globalny)</option>
                        {modele.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {!modele.length && (
                        <span className="text-[10px] text-amber-500/80">
                            Most milczy — lista modeli pusta, zostaje rdzeń globalny.
                        </span>
                    )}
                </label>
            )}

            <div className="mt-auto flex gap-2">
                {!wyklute ? (
                    <button
                        onClick={onWykluj}
                        className="flex-1 rounded-lg py-2 text-xs font-bold text-slate-900 transition hover:brightness-110"
                        style={{ background: gat.kolor }}
                    >
                        🥚 Wykluj
                    </button>
                ) : (
                    <>
                        <button
                            onClick={onDyzur}
                            disabled={aktywny}
                            className="flex-1 rounded-lg py-2 text-xs font-bold border transition disabled:opacity-40"
                            style={{ borderColor: gat.kolor, color: gat.kolor }}
                        >
                            {aktywny ? 'na dyżurze' : 'Weź na dyżur'}
                        </button>
                        <button
                            onClick={onOtworzPanel}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition"
                            title="Otwórz pełny panel zarządzania"
                        >
                            ⚙️ Panel
                        </button>
                    </>
                )}
            </div>

            {/* Warsztat: wbudowany, zbudowany przez Suwerena, albo do zbudowania. */}
            {wyklute && !WBUDOWANE.includes(gat.id) && (
                wlasny ? (
                    <p className="text-[10px] leading-relaxed" style={{ color: gat.kolor }}>
                        🛠️ Warsztat gotowy — {wlasny.narzedzia.length} narzędzi z {wlasny.domena ?? '—'}.
                        Widać go po wzięciu na dyżur.
                    </p>
                ) : (
                    <button onClick={onKreator}
                        className="rounded-lg border border-dashed py-2 text-[11px] font-bold transition hover:bg-white/5"
                        style={{ borderColor: `${gat.kolor}66`, color: gat.kolor }}>
                        🛠️ Zbuduj panel
                    </button>
                )
            )}
        </motion.div>
    );
};

export const DomTeogochi: React.FC = () => {
    const [stado, setStado] = useState<string[]>(() => wykluteGatunki());
    const [dyzurny, setDyzurny] = useState<string>(() => aktywnyGatunek());
    const [modele, setModele] = useState<string[]>([]);
    const [wlasnePanele, setWlasnePanele] = useState<PanelDef[]>([]);
    const [kreatorDla, setKreatorDla] = useState<string | null>(null);
    const [panelGatunekId, setPanelGatunekId] = useState<string | null>(null);

    // Panele zbudowane przez Suwerena leżą na MOŚCIE, nie w przeglądarce —
    // dzienny zrzut do skarbca zbiera pliki z dysku, a czego nie ma na dysku,
    // tego nie ma w zrzucie.
    const odswiezPanele = React.useCallback(() => {
        pobierzPanele().then(setWlasnePanele).catch(() => setWlasnePanele([]));
    }, []);
    useEffect(() => { odswiezPanele(); }, [odswiezPanele]);

    // Lista rdzeni z mostu. Most offline → pusta lista i karta mówi to wprost.
    useEffect(() => {
        fetch('http://127.0.0.1:3001/api/ollama/models')
            .then(r => r.json())
            .then((d: { models?: string[] }) => setModele(d.models ?? []))
            .catch(() => setModele([]));
    }, []);

    // 📱 PUBLIKACJA STADA DLA APKI. Wyklucie i XP żyją w localStorage tej
    // przeglądarki, więc most sam z siebie ich nie zna — Katedra musi mu je
    // podać. Bez tego aplikacja na telefonie pokazywałaby wymyślonych agentów
    // zamiast Twojego stada.
    useEffect(() => {
        const migawka = {
            aktywny: dyzurny,
            gatunki: GATUNKI.map(g => {
                const wyklute = stado.includes(g.id);
                const stan = wyklute ? stanGatunku(g.id) : null;
                const etap = stan ? stageOf(stan.xp) : null;
                const wlasny = wlasnePanele.find(p => p.gatunek === g.id);
                const formy = wlasny?.jajo?.formy ?? g.formy;
                return {
                    id: g.id, imie: g.imie, dziedzina: g.dziedzina, kolor: g.kolor,
                    forma: wyklute && etap ? formy[etap.stage] : formy['jajko'],
                    etap: etap?.stage ?? 'jajko',
                    xp: stan?.xp ?? 0,
                    wyklute,
                };
            }),
        };
        fetch('http://127.0.0.1:3001/api/stado/publikuj', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(migawka),
        }).catch(() => { /* most śpi — apka zobaczy starszą migawkę i tak to nazwie */ });
    }, [stado, dyzurny, wlasnePanele]);

    const wykluj_ = (id: string) => {
        if (wykluj(id)) setStado(wykluteGatunki());
    };
    const naDyzur = (id: string) => {
        ustawAktywny(id);
        setDyzurny(id);
    };

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-100">
                    🥚 <span className="text-purple-300">Dom TeOgochi</span>
                </h2>
                <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
                    Trzynaście gatunków, każdy z własną dziedziną. Jajko wygląda inaczej u każdego
                    i wykluwa się w co innego. Awatar pokazuje faktyczny etap — dopóki nie ma XP,
                    widzisz jajo.
                </p>
                <p className="text-xs text-slate-500">
                    W stadzie: <b className="text-slate-300">{stado.length}</b> z {GATUNKI.length} ·
                    na dyżurze: <b style={{ color: GATUNKI.find(g => g.id === dyzurny)?.kolor }}>
                        {GATUNKI.find(g => g.id === dyzurny)?.imie ?? dyzurny}
                    </b>
                </p>
            </header>

            {/* Panel dyżurnego gatunku. Na razie mają go DWA: Joanna (własny Dom,
                otwierany z odtwarzacza) i Klatka — tutaj. Reszta czeka na swój. */}
            {/* 🏛️ WORKPalace nad panelami — widać, co robi CAŁE stado, nie tylko dyżurny. */}
            <WorkPalace />

            {dyzurny === 'klatka' && stado.includes('klatka') && <PanelKlatka />}
            {dyzurny === 'wektor' && stado.includes('wektor') && <PanelWektor />}
            {dyzurny === 'kodeks' && stado.includes('kodeks') && <PanelKodeks />}
            {dyzurny === 'bilans' && stado.includes('bilans') && <PanelBilans />}

            {/* Kreator — otwarty świadomie z karty gatunku. */}
            {kreatorDla && (() => {
                const g = GATUNKI.find(x => x.id === kreatorDla);
                if (!g) return null;
                return (
                    <KreatorPanelu
                        gat={g}
                        onAnuluj={() => setKreatorDla(null)}
                        onGotowe={(p) => {
                            setWlasnePanele(l => [...l.filter(x => x.gatunek !== p.gatunek), p]);
                            setKreatorDla(null);
                            naDyzur(p.gatunek);       // zbudowany warsztat od razu widać
                        }}
                    />
                );
            })()}

            {/* Warsztat zbudowany przez Suwerena — dla dyżurnego bez panelu wbudowanego. */}
            {!WBUDOWANE.includes(dyzurny) && stado.includes(dyzurny) && (() => {
                const p = wlasnePanele.find(x => x.gatunek === dyzurny);
                if (!p || kreatorDla) return null;
                return (
                    <PanelWlasny
                        panel={p}
                        kolor={GATUNKI.find(g => g.id === dyzurny)?.kolor ?? '#94a3b8'}
                        onUsuniety={() => setWlasnePanele(l => l.filter(x => x.gatunek !== dyzurny))}
                    />
                );
            })()}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {GATUNKI.map(g => (
                    <KartaGatunku
                        key={g.id}
                        gat={g}
                        wyklute={stado.includes(g.id)}
                        aktywny={dyzurny === g.id}
                        modele={modele}
                        wlasny={wlasnePanele.find(p => p.gatunek === g.id) ?? null}
                        onWykluj={() => wykluj_(g.id)}
                        onDyzur={() => naDyzur(g.id)}
                        onKreator={() => setKreatorDla(g.id)}
                        onOtworzPanel={() => setPanelGatunekId(g.id)}
                    />
                ))}
            </div>

            {/* Uniwersalny Modal Panelu TeOgochi */}
            {panelGatunekId && (
                <TeogochiPanel
                    gatunekId={panelGatunekId}
                    onClose={() => setPanelGatunekId(null)}
                    onSwitchGatunek={(id) => {
                        setPanelGatunekId(id);
                        naDyzur(id);
                    }}
                />
            )}
        </div>
    );
};

export default DomTeogochi;
