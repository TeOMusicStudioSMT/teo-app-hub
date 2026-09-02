/**
 * 🔨 Kuźnia Modeli — surowe wagi z dysku stają się modelem Katedry.
 *
 * W `_OtakOs_AI/models` leżą gigabajty, których Katedra dotąd nie umiała użyć.
 * Ten panel je pokazuje, mówi CO Z NIMI MOŻNA, i kuje je do Ollamy — po czym
 * stają się zwykłym rdzeniem, dostępnym dla każdego gatunku TeOgochi.
 *
 * ŚCIEŻKA ZADANIA jest widoczna z góry, bo to nie jest jedno kliknięcie:
 * skan → wybór → Modelfile → kucie → model w Ollamie. Suweren ma wiedzieć,
 * na którym kroku stoi i ile jeszcze przed nim.
 *
 * ⚠️ Katalog czyta MOST, nie przeglądarka. Skan dysku z komponentu React
 * zwróciłby pustą listę albo wywalił okno — `fs` nie istnieje w przeglądarce.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hammer, HardDrive, AlertTriangle, Check, Cpu, RefreshCw, Flame } from 'lucide-react';

const MOST = 'http://127.0.0.1:3001';

interface ModelLokalny {
    plik: string;
    sciezka: string;
    bajty: number;
    gb: number;
    rodzaj: 'gguf' | 'whisper' | 'safetensors' | 'inne-wagi' | 'nieznany';
    przeznaczenie: string;
    kowalny: boolean;
    proponowanaNazwa: string;
    wykuty: boolean | null;
}

interface Przebieg {
    id: string; plik: string; nazwa: string;
    stan: 'kuje' | 'gotowe' | 'blad';
    postep: string; blad: string | null;
}

const BARWA_RODZAJU: Record<string, string> = {
    gguf: '#f97316', whisper: '#22d3ee', safetensors: '#a855f7',
    'inne-wagi': '#64748b', nieznany: '#64748b',
};

/** Kroki ścieżki. `stan` liczy się z tego, co naprawdę zaszło — nie z licznika kliknięć. */
const KROKI = [
    { id: 'skan', ikona: '🔍', nazwa: 'Skan', opis: 'Most czyta katalog wag' },
    { id: 'wybor', ikona: '🎯', nazwa: 'Wybór', opis: 'Który plik i pod jaką nazwą' },
    { id: 'modelfile', ikona: '📜', nazwa: 'Modelfile', opis: 'FROM wskazuje plik z dysku' },
    { id: 'kucie', ikona: '🔥', nazwa: 'Kucie', opis: 'Ollama przepakowuje wagi' },
    { id: 'gotowe', ikona: '🧠', nazwa: 'W Ollamie', opis: 'Rdzeń dostępny dla stada' },
];

export const KuzniaModeli: React.FC = () => {
    const [modele, setModele] = useState<ModelLokalny[]>([]);
    const [katalog, setKatalog] = useState('');
    const [ollama, setOllama] = useState<{ zywa: boolean; ile: number } | null>(null);
    const [doWykucia, setDoWykucia] = useState(0);
    const [wybrany, setWybrany] = useState<string | null>(null);
    const [nazwa, setNazwa] = useState('');
    const [przebieg, setPrzebieg] = useState<Przebieg | null>(null);
    const [blad, setBlad] = useState('');
    const [zajety, setZajety] = useState(false);
    const pollRef = useRef<number | null>(null);

    const odswiez = useCallback(async () => {
        setBlad('');
        try {
            const d = await fetch(`${MOST}/api/modele/lokalne`).then(r => r.json());
            if (!d.success) throw new Error(d.message || 'Most odmówił.');
            setModele(d.modele ?? []);
            setKatalog(d.katalog ?? '');
            setOllama(d.ollama ?? null);
            setDoWykucia(d.doWykucia ?? 0);
        } catch (e) {
            setBlad(`${(e as Error).message} Katalog czyta most — bez niego nie ma czego pokazać.`);
            setModele([]);
        }
    }, []);

    useEffect(() => { void odswiez(); }, [odswiez]);
    useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

    const wykuj = async (m: ModelLokalny) => {
        setZajety(true); setBlad('');
        try {
            const r = await fetch(`${MOST}/api/modele/wykuj`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plik: m.plik, nazwa: (nazwa || m.proponowanaNazwa).trim() }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || 'Most odmówił kucia.');

            setPrzebieg({ id: d.id, plik: d.plik, nazwa: d.nazwa, stan: 'kuje', postep: 'start…', blad: null });
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = window.setInterval(async () => {
                try {
                    const s = await fetch(`${MOST}/api/modele/wykuj/stan?id=${d.id}`).then(x => x.json());
                    if (!s.success || !s.przebieg) return;
                    setPrzebieg(s.przebieg);
                    if (s.przebieg.stan !== 'kuje') {
                        if (pollRef.current) window.clearInterval(pollRef.current);
                        void odswiez();     // status „wykuty" przeliczy się z Ollamy
                    }
                } catch { /* most mrugnął — kolejny tick spróbuje */ }
            }, 1500);
        } catch (e) {
            setBlad((e as Error).message);
        } finally { setZajety(false); }
    };

    // Który krok ścieżki świeci: liczony ze stanu, nie z kliknięć.
    const krokAktywny = przebieg
        ? (przebieg.stan === 'kuje' ? 3 : 4)
        : wybrany ? 2 : modele.length ? 1 : 0;

    const kowalne = modele.filter(m => m.kowalny);
    const pozostale = modele.filter(m => !m.kowalny);

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <Hammer size={22} className="text-orange-400" />
                    <span className="bg-gradient-to-r from-orange-300 to-amber-500 bg-clip-text text-transparent">
                        Kuźnia Modeli
                    </span>
                </h2>
                <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
                    Wagi leżące na dysku same z siebie nic nie robią. Wykucie rejestruje je w Ollamie —
                    dopiero wtedy stają się rdzeniem, którego może użyć każdy gatunek TeOgochi.
                </p>
                <div className="flex items-center gap-3 flex-wrap text-xs">
                    {katalog && <span className="font-mono text-slate-600 truncate max-w-full">{katalog}</span>}
                    {ollama && (
                        <span className={ollama.zywa ? 'text-emerald-400' : 'text-amber-400'}>
                            {ollama.zywa ? `Ollama żyje · ${ollama.ile} modeli` : 'Ollama milczy — nie sprawdzę, co już wykute'}
                        </span>
                    )}
                    <button onClick={odswiez} className="rounded-lg border border-slate-700 px-2 py-1 text-slate-300 hover:border-slate-500">
                        <RefreshCw size={13} />
                    </button>
                </div>
            </header>

            {blad && (
                <p className="flex items-start gap-2 text-sm text-amber-400">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{blad}</span>
                </p>
            )}

            {/* ── ŚCIEŻKA ZADANIA ────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-b from-orange-950/20 to-transparent p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-orange-500/60 mb-3">
                    ścieżka zadania
                </div>
                <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
                    {KROKI.map((k, i) => {
                        const zrobiony = i < krokAktywny;
                        const teraz = i === krokAktywny;
                        return (
                            <React.Fragment key={k.id}>
                                {i > 0 && (
                                    <div className="flex items-center shrink-0 px-0.5">
                                        <div className="h-px w-5 sm:w-8" style={{
                                            background: zrobiony || teraz
                                                ? 'linear-gradient(90deg,#f9731688,#f97316)'
                                                : 'rgba(148,163,184,0.2)',
                                        }} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-[104px] rounded-xl border p-2.5 transition-colors"
                                    style={{
                                        borderColor: teraz ? '#f97316' : zrobiony ? '#f9731655' : 'rgba(148,163,184,0.15)',
                                        background: teraz ? 'rgba(249,115,22,0.10)' : 'rgba(0,0,0,0.25)',
                                    }}>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-base ${teraz ? 'animate-pulse' : ''}`}>{k.ikona}</span>
                                        <span className="text-xs font-bold" style={{ color: teraz ? '#fdba74' : zrobiony ? '#f97316' : '#64748b' }}>
                                            {k.nazwa}
                                        </span>
                                        {zrobiony && <Check size={11} className="text-orange-400/70" />}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{k.opis}</div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* ── KUCIE W TOKU ───────────────────────────────────────────────── */}
            <AnimatePresence>
                {przebieg && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="rounded-2xl border p-4"
                        style={{
                            borderColor: przebieg.stan === 'blad' ? '#f59e0b66' : '#f9731666',
                            background: przebieg.stan === 'blad' ? 'rgba(120,53,15,0.15)' : 'rgba(124,45,18,0.18)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-1.5">
                            <Flame size={16} className={przebieg.stan === 'kuje' ? 'text-orange-400 animate-pulse' : 'text-slate-500'} />
                            <span className="text-sm font-bold text-slate-100">{przebieg.nazwa}</span>
                            <span className="text-[10px] font-mono text-slate-500">← {przebieg.plik}</span>
                        </div>
                        {przebieg.stan === 'blad' ? (
                            <p className="text-xs text-amber-400 leading-relaxed">{przebieg.blad}</p>
                        ) : (
                            <p className="text-xs font-mono text-slate-300 truncate">{przebieg.postep}</p>
                        )}
                        {przebieg.stan === 'kuje' && (
                            <div className="mt-2 h-1 rounded-full bg-slate-800 overflow-hidden">
                                <div className="h-full w-1/3 rounded-full bg-orange-500 animate-[pulse_1.6s_ease-in-out_infinite]" />
                            </div>
                        )}
                        <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
                            Ollama kopiuje wagi do własnego magazynu — plik na dysku zostaje, a miejsca
                            ubywa drugie tyle. Przy kilku gigabajtach to trwa.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── WAGI DO WYKUCIA ────────────────────────────────────────────── */}
            {kowalne.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                        <span className="text-[11px] font-mono text-slate-500">
                            do wykucia — {kowalne.length} {kowalne.length === 1 ? 'plik' : 'plików'}
                        </span>
                        {doWykucia > 0 && (
                            <span className="text-[11px] font-mono text-orange-400/80">
                                zajmie dodatkowo ~{Math.round(doWykucia / 1e9 * 10) / 10} GB
                            </span>
                        )}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        {kowalne.map(m => {
                            const zaznaczony = wybrany === m.plik;
                            return (
                                <div key={m.plik}
                                    onClick={() => { setWybrany(m.plik); setNazwa(m.proponowanaNazwa); }}
                                    className="rounded-2xl border p-4 cursor-pointer transition-colors"
                                    style={{
                                        borderColor: zaznaczony ? BARWA_RODZAJU[m.rodzaj] : 'rgba(148,163,184,0.15)',
                                        background: zaznaczony ? 'rgba(249,115,22,0.07)' : 'rgba(15,23,42,0.5)',
                                    }}>
                                    <div className="flex items-start gap-3">
                                        <HardDrive size={18} className="mt-0.5 shrink-0" style={{ color: BARWA_RODZAJU[m.rodzaj] }} />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-bold text-slate-100 break-all leading-snug">{m.plik}</div>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                                    style={{ color: BARWA_RODZAJU[m.rodzaj], background: `${BARWA_RODZAJU[m.rodzaj]}1a` }}>
                                                    {m.rodzaj}
                                                </span>
                                                <span className="text-[11px] font-mono text-slate-400">{m.gb} GB</span>
                                                {m.wykuty === true && (
                                                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                                                        <Check size={11} /> w Ollamie
                                                    </span>
                                                )}
                                                {m.wykuty === null && (
                                                    <span className="text-[10px] text-slate-600">nie wiem — Ollama milczy</span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{m.przeznaczenie}</p>
                                        </div>
                                    </div>

                                    {zaznaczony && (
                                        <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                                            <input
                                                value={nazwa}
                                                onChange={e => setNazwa(e.target.value)}
                                                placeholder={m.proponowanaNazwa}
                                                className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-xs font-mono outline-none focus:border-orange-500"
                                            />
                                            <button
                                                onClick={() => wykuj(m)}
                                                disabled={zajety || przebieg?.stan === 'kuje'}
                                                className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40"
                                            >
                                                <Hammer size={13} /> Wykuj
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── RESZTA KATALOGU ────────────────────────────────────────────── */}
            {pozostale.length > 0 && (
                <div className="space-y-2">
                    <span className="text-[11px] font-mono text-slate-500">
                        pozostałe wagi — nie dla Ollamy
                    </span>
                    <div className="space-y-1.5">
                        {pozostale.map(m => (
                            <div key={m.plik} className="flex items-center gap-2.5 rounded-lg bg-black/25 px-3 py-2">
                                <Cpu size={14} className="shrink-0" style={{ color: BARWA_RODZAJU[m.rodzaj] }} />
                                <span className="text-xs text-slate-300 truncate flex-1">{m.plik}</span>
                                <span className="text-[10px] font-mono text-slate-500 shrink-0">{m.gb} GB</span>
                                <span className="text-[10px] text-slate-600 hidden sm:block max-w-[42%] truncate" title={m.przeznaczenie}>
                                    {m.przeznaczenie}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!modele.length && !blad && (
                <p className="text-sm text-slate-500">
                    Katalog jest pusty — nie ma czego kuć.
                </p>
            )}

            <p className="text-[10px] text-slate-600 leading-relaxed">
                Skan i kucie robi most: przeglądarka nie ma dostępu do dysku, więc lista, którą tu widzisz,
                to faktyczna zawartość katalogu, a nie zapamiętana kopia.
            </p>
        </div>
    );
};

export default KuzniaModeli;
