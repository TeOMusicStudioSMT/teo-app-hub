/**
 * 🎼 Dyrygent i ⚒️ Kuźnia Soup — w panelu Kuźni Modeli.
 *
 * DYRYGENT (services/Dyrygent.js): katalog modeli, które NAPRAWDĘ są w Katedrze (Ollama), z kartą od
 * Suwerena, własnym modelem TeOgochi i pracą w stadzie (ile wkładów, średnia ocena Sędziego) — i dobór
 * modeli do zadania, tak jak Jadziunia dobiera skille. Propozycja nic nie zmienia; „Zastosuj na stałe"
 * ustawia silniki agentów.
 *
 * KUŹNIA SOUP (services/KuzniaSoup.js): własny model TeOgochi z jego ocenionej pracy (soup-cli, LoRA →
 * GGUF → Ollama). Najpierw podgląd (ile dobrej pracy), potem dane + soup.yaml, na końcu wykucie — godziny
 * na karcie graficznej, najlepiej przez Nocną Zmianę. Bez Soup w Katedrze panel mówi to wprost.
 *
 * ZWIADOWCA HF (services/ZwiadowcaHF.js): kandydaci z HuggingFace dla Dyrygenta — pobranie po akceptacji.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';

interface ModelKatalogu {
    nazwa: string; rozmiarGB: number | null; parametry: string | null; kwantyzacja: string | null;
    karta: { opis: string; mocne: string[] } | null; wlasny: string | null; agenci: string[];
    praca: { wkladow: number; ocen: number; srednia: number | null };
}
interface Przydzial { agent: string; model: string; powod?: string }
interface Gatunek { id: string; imie: string; forma?: string; wyklute: boolean }
interface Podglad { sft: number; pary: number; pominiete: { bezOceny: number; slabe: number }; wystarczy: boolean; minimum: number; prog: number }
interface Doktor {
    jest: boolean; wersja?: string; doktor?: string[]; blad?: string; polecenie: string; baza: string | null;
    zrodlo?: string; gpu?: 'cuda' | 'cpu' | null; srodowisko?: string; wKatedrze?: boolean; linki?: { nazwa: string; url: string }[];
}
interface Sondaz { stan: string; etap?: string; blad?: string | null; podsumowanie?: string | null; log?: string[] }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}
const blad = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const DyrygentPanel: React.FC = () => {
    const [modele, setModele] = useState<ModelKatalogu[] | null>(null);
    const [dyrygent, setDyrygent] = useState('');
    const [zadanie, setZadanie] = useState('');
    const [propozycja, setPropozycja] = useState<{ przydzial: Przydzial[]; odrzucone: (Przydzial & { powod: string })[]; model: string } | null>(null);
    const [zajety, setZajety] = useState(false);
    const [edycja, setEdycja] = useState<string | null>(null);
    const [opis, setOpis] = useState('');

    const odswiez = useCallback(async () => {
        try { const d = await zMostu<{ modele: ModelKatalogu[]; dyrygent: string }>('/api/modele/katalog'); setModele(d.modele); setDyrygent(d.dyrygent); }
        catch (e) { toast.error(`Katalog modeli: ${blad(e)}`); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);

    const dobierz = async () => {
        setZajety(true); setPropozycja(null);
        try { setPropozycja(await zMostu('/api/dyrygent/dobierz', { method: 'POST', body: JSON.stringify({ zadanie }) })); }
        catch (e) { toast.error(blad(e), { duration: 8000 }); }
        finally { setZajety(false); }
    };
    const zastosuj = async () => {
        if (!propozycja?.przydzial.length) return;
        setZajety(true);
        try { await zMostu('/api/dyrygent/zastosuj', { method: 'POST', body: JSON.stringify({ przydzial: propozycja.przydzial }) }); toast.success('Silniki TeOgochi ustawione na stałe.'); await odswiez(); }
        catch (e) { toast.error(blad(e)); }
        finally { setZajety(false); }
    };
    const zapiszKarte = async (nazwa: string) => {
        try { await zMostu('/api/modele/karta', { method: 'PUT', body: JSON.stringify({ nazwa, opis }) }); setEdycja(null); await odswiez(); }
        catch (e) { toast.error(blad(e)); }
    };

    return (
        <div className="space-y-3 rounded-2xl border border-sky-500/25 bg-sky-950/10 p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-sky-200">🎼 Dyrygent — modele do zadań</h3>
                <span className="text-[10px] font-mono text-slate-500">Dyrygent gra na: {dyrygent || '…'}</span>
            </div>
            <p className="text-[11px] text-slate-400">Jak Jadziunia dobiera skille, tak Dyrygent dobiera modele: tylko te, które są w Katedrze, z ocenami Sędziego z pracy stada. Propozycja niczego nie zmienia.</p>
            <div className="space-y-1">
                {modele === null && <div className="text-[11px] text-slate-500">Czytam katalog…</div>}
                {modele?.length === 0 && <div className="text-[11px] text-amber-300">Ollama nie ma żadnego modelu (albo milczy).</div>}
                {modele?.map((m) => (
                    <div key={m.nazwa} className="rounded-lg bg-black/25 px-3 py-1.5 text-[11px]">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-slate-200">{m.nazwa}</span>
                            <span className="text-slate-500">{[m.parametry, m.rozmiarGB ? `${m.rozmiarGB} GB` : null].filter(Boolean).join(' · ')}</span>
                            {m.wlasny && <span className="rounded bg-orange-500/20 px-1.5 text-orange-200">⚒️ własny: {m.wlasny}</span>}
                            {m.agenci.length > 0 && <span className="text-emerald-300">gra: {m.agenci.join(', ')}</span>}
                            <span className="ml-auto text-slate-400">{m.praca.wkladow ? `${m.praca.wkladow} wkładów${m.praca.srednia != null ? ` · Sędzia ${m.praca.srednia}/10` : ''}` : 'jeszcze nie pracował w stadzie'}</span>
                            <button onClick={() => { setEdycja(m.nazwa); setOpis(m.karta?.opis ?? ''); }} className="text-slate-500 hover:text-sky-300" title="Karta modelu: do czego go używać">✎</button>
                        </div>
                        {m.karta?.opis && edycja !== m.nazwa && <div className="text-slate-500">{m.karta.opis}</div>}
                        {edycja === m.nazwa && (
                            <div className="mt-1 flex gap-1.5">
                                <input value={opis} onChange={(e) => setOpis(e.target.value)} placeholder="np. mocny w kodzie i scalaniu, wolny" className="flex-1 rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                                <button onClick={() => zapiszKarte(m.nazwa)} className="rounded bg-sky-600/40 px-2 text-sky-100">Zapisz</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex gap-1.5">
                <input value={zadanie} onChange={(e) => setZadanie(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && dobierz()}
                    placeholder="Zadanie dla stada — Dyrygent przydzieli modele (np. gra RPG-fashion z merchem i muzyką)"
                    className="flex-1 rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-xs text-slate-200" />
                <button onClick={dobierz} disabled={zajety || zadanie.trim().length < 5} className="rounded-lg bg-sky-600/60 px-3 text-xs font-bold text-white disabled:opacity-40">{zajety ? '🎼…' : '🎼 Dobierz'}</button>
            </div>
            {propozycja && (
                <div className="space-y-1 rounded-lg border border-sky-700/40 p-2 text-[11px]">
                    <div className="text-slate-400">Propozycja Dyrygenta ({propozycja.model}):</div>
                    {propozycja.przydzial.map((p) => <div key={p.agent}><b className="text-slate-200">{p.agent}</b> → <span className="font-mono text-sky-200">{p.model}</span> <span className="text-slate-500">{p.powod}</span></div>)}
                    {propozycja.odrzucone.map((p, i) => <div key={i} className="text-amber-300/80">✕ {p.agent} → {p.model}: {p.powod}</div>)}
                    <button onClick={zastosuj} disabled={zajety || !propozycja.przydzial.length} className="mt-1 rounded bg-emerald-700/50 px-3 py-1 text-emerald-100 disabled:opacity-40">Zastosuj na stałe (silniki TeOgochi)</button>
                    <div className="text-slate-500">Albo tylko dla jednego projektu: w Świecie przy nowym projekcie zaznacz „🎼 Dyrygent dobierze modele".</div>
                </div>
            )}
        </div>
    );
};

export const KuzniaSoupPanel: React.FC = () => {
    const [doktor, setDoktor] = useState<Doktor | null>(null);
    const [stado, setStado] = useState<Gatunek[]>([]);
    const [agent, setAgent] = useState('');
    const [podglad, setPodglad] = useState<Podglad | null>(null);
    const [baza, setBaza] = useState('');
    const [wykute, setWykute] = useState<{ agent: string; model: string; sft: number; kiedy: string }[]>([]);
    const [zadanie, setZadanie] = useState<{ id: string; s: Sondaz } | null>(null);
    const [zajety, setZajety] = useState(false);

    useEffect(() => {
        void (async () => {
            try { setDoktor(await zMostu<Doktor>('/api/kuznia-soup/doktor')); } catch (e) { setDoktor({ jest: false, blad: blad(e), polecenie: 'soup', baza: null }); }
            try { const k = await zMostu<{ wykute: typeof wykute; baza: string | null; biezace: { id: string } | null }>('/api/kuznia-soup'); setWykute(k.wykute); if (k.baza) setBaza(k.baza); if (k.biezace) setZadanie({ id: k.biezace.id, s: { stan: 'trwa' } }); } catch { /* most stary */ }
            try { const s = await zMostu<{ gatunki: Gatunek[] }>('/api/stado/stan'); setStado((s.gatunki ?? []).filter((g) => g.wyklute)); } catch { /* bez stada */ }
        })();
    }, []);

    useEffect(() => {
        if (!agent) { setPodglad(null); return; }
        zMostu<Podglad>(`/api/kuznia-soup/${encodeURIComponent(agent)}/podglad`).then(setPodglad).catch((e) => toast.error(blad(e)));
    }, [agent]);

    // Postęp kucia: sondaż co 10 s, dopóki trwa.
    useEffect(() => {
        if (!zadanie || zadanie.s.stan !== 'trwa') return;
        const t = window.setInterval(async () => {
            try { const s = await fetch(`${MOST}/api/kuznia-soup/zadanie/${zadanie.id}/sondaz`).then((r) => r.json()); setZadanie({ id: zadanie.id, s }); } catch { /* most chwilowo zajęty */ }
        }, 10_000);
        return () => window.clearInterval(t);
    }, [zadanie]);

    const akcja = async (co: 'przygotuj' | 'wykuj') => {
        setZajety(true);
        try {
            const d = await zMostu<{ id?: string; sft: number; pary: number; katalog?: string }>(`/api/kuznia-soup/${encodeURIComponent(agent)}/${co}`, { method: 'POST', body: JSON.stringify({ baza }) });
            if (co === 'wykuj' && d.id) { setZadanie({ id: d.id, s: { stan: 'trwa', etap: 'start' } }); toast.success(`Kucie ruszyło: ${d.sft} wkładów. To potrwa — Katedra powie, gdy skończy.`); }
            else toast.success(`Dane gotowe: ${d.sft} wkładów, ${d.pary} par → ${d.katalog}`);
        } catch (e) { toast.error(blad(e), { duration: 10000 }); }
        finally { setZajety(false); }
    };

    return (
        <div className="space-y-3 rounded-2xl border border-orange-500/25 bg-orange-950/10 p-4">
            <h3 className="text-sm font-bold text-orange-200">⚒️ Kuźnia Soup — własny model dla TeOgochi</h3>
            <p className="text-[11px] text-slate-400">
                Uczy model na pracy TeOgochi, którą Sędzia ocenił co najmniej {podglad?.prog ?? 7}/10 (SFT), plus pary „szkic → po pętli” i „runda niżej → runda wyżej”.
                Lokalnie, bez telemetrii (Soup, LoRA → GGUF → Ollama). Model bazowy to wagi HuggingFace (id albo ścieżka), nie model z Ollamy.
            </p>
            <SrodowiskoKuzni doktor={doktor} onZadanie={(id) => setZadanie({ id, s: { stan: 'trwa', etap: 'instalacja' } })} zajete={zadanie?.s.stan === 'trwa'} />
            <div className="flex flex-wrap gap-1.5">
                <select value={agent} onChange={(e) => setAgent(e.target.value)} className="rounded border border-slate-700 bg-black/40 px-2 py-1.5 text-xs text-slate-200">
                    <option value="">— TeOgochi —</option>
                    {stado.map((g) => <option key={g.id} value={g.id}>{g.forma} {g.imie}</option>)}
                </select>
                <input value={baza} onChange={(e) => setBaza(e.target.value)} placeholder="model bazowy HF, np. Qwen/Qwen2.5-3B-Instruct"
                    className="flex-1 min-w-[220px] rounded border border-slate-700 bg-black/40 px-2 py-1.5 text-xs text-slate-200" />
            </div>
            {podglad && (
                <div className="text-[11px] text-slate-300">
                    Dobra praca: <b>{podglad.sft}</b> wkładów (min. {podglad.minimum}) · par: {podglad.pary} · pominięte: {podglad.pominiete.bezOceny} bez oceny, {podglad.pominiete.slabe} słabszych.
                    {!podglad.wystarczy && <span className="text-amber-300"> Za mało — więcej rund doskonalenia da więcej ocenionej pracy.</span>}
                </div>
            )}
            <div className="flex gap-1.5">
                <button onClick={() => akcja('przygotuj')} disabled={zajety || !agent || !baza.trim() || !podglad?.wystarczy} className="rounded bg-slate-700/60 px-3 py-1.5 text-xs text-slate-100 disabled:opacity-40">Przygotuj dane + soup.yaml</button>
                <button onClick={() => akcja('wykuj')} disabled={zajety || !agent || !baza.trim() || !podglad?.wystarczy || !doktor?.jest || zadanie?.s.stan === 'trwa'}
                    title="Godziny na karcie graficznej — na noc lepiej przez Nocną Zmianę (robota „Kuźnia Soup”)"
                    className="rounded bg-orange-500 px-3 py-1.5 text-xs font-bold text-slate-900 disabled:opacity-40">⚒️ Wykuj teraz</button>
            </div>
            {zadanie && (
                <div className="rounded-lg bg-black/30 p-2 text-[11px]">
                    <div className={zadanie.s.stan === 'blad' ? 'text-red-300' : zadanie.s.stan === 'gotowe' ? 'text-emerald-300' : 'text-orange-200'}>
                        {zadanie.s.stan === 'trwa' ? `Kuje… ${zadanie.s.etap ?? ''}` : zadanie.s.stan === 'gotowe' ? `✓ ${zadanie.s.podsumowanie}` : `✕ ${zadanie.s.blad}`}
                    </div>
                    {zadanie.s.log?.length ? <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-[10px] text-slate-500">{zadanie.s.log.join('\n')}</pre> : null}
                </div>
            )}
            {wykute.length > 0 && (
                <div className="text-[11px] text-slate-400">Wykute: {wykute.map((w) => `${w.model} (${w.agent}, ${w.sft} wkładów)`).join(' · ')} — przydziel w Dyrygencie albo przy TeOgochi.</div>
            )}
        </div>
    );
};

/**
 * Środowisko Kuźni: gdzie jest Soup (Katedra / pipx na C: / PATH), czy PyTorch widzi kartę graficzną,
 * instalacja W KATEDRZE (Python 3.12 venv → PyTorch CUDA pod sterownik → soup-cli[train]) i linki.
 * Suweren 2026-09-29: pipx dał soup.exe w C:\Users\…\.local\bin (poza PATH), na Pythonie 3.13 — a soup-cli
 * wymaga 3.10–3.12, więc pip cofnął się do starszej wersji; torch z PyPI na Windows bywa bez CUDA.
 */
const SrodowiskoKuzni: React.FC<{ doktor: Doktor | null; onZadanie: (id: string) => void; zajete: boolean }> = ({ doktor, onZadanie, zajete }) => {
    const [cuda, setCuda] = useState('auto');
    const [instaluje, setInstaluje] = useState(false);
    const instaluj = async () => {
        setInstaluje(true);
        try {
            const d = await zMostu<{ id: string; srodowisko: string }>('/api/kuznia-soup/srodowisko/instaluj', { method: 'POST', body: JSON.stringify({ cuda }) });
            onZadanie(d.id);
            toast.success(`Instaluję środowisko Kuźni w ${d.srodowisko} — to kilka GB (PyTorch), potrwa.`, { duration: 8000 });
        } catch (e) { toast.error(blad(e), { duration: 10000 }); }
        finally { setInstaluje(false); }
    };
    if (doktor === null) return <div className="rounded-lg bg-black/30 p-2 text-[11px] text-slate-400">Pytam o Soup…</div>;
    const ostrzezenia: string[] = [];
    if (!doktor.jest) ostrzezenia.push(`Nie znalazłem Soup (${doktor.blad ?? doktor.polecenie}).`);
    if (doktor.jest && !doktor.wKatedrze) ostrzezenia.push(`Soup działa z „${doktor.zrodlo}" (${doktor.polecenie}) — docelowo zainstaluj go w Katedrze.`);
    if (doktor.gpu === 'cpu') ostrzezenia.push('PyTorch NIE widzi karty graficznej (CPU only) — trening trwałby dniami. Instalacja w Katedrze dobierze koło PyTorch z CUDA do sterownika.');
    return (
        <div className={`space-y-1.5 rounded-lg p-2 text-[11px] ${doktor.jest && doktor.gpu === 'cuda' ? 'bg-emerald-950/30 text-emerald-200' : 'bg-amber-950/30 text-amber-200'}`}>
            <div>{doktor.jest ? `Soup: ${doktor.wersja} · ${doktor.zrodlo}${doktor.gpu === 'cuda' ? ' · karta graficzna: CUDA ✓' : doktor.gpu === 'cpu' ? ' · karta graficzna: NIE' : ''}` : 'Soup: brak'}</div>
            {ostrzezenia.map((o) => <div key={o}>⚠️ {o}</div>)}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <select value={cuda} onChange={(e) => setCuda(e.target.value)} className="rounded border border-slate-700 bg-black/40 px-1.5 py-1 text-slate-200" title="Koło PyTorch: auto = z nvidia-smi (jak soup doctor)">
                    {['auto', 'cu128', 'cu126', 'cu124', 'cu121', 'cu130', 'cpu'].map((k) => <option key={k} value={k}>{k === 'auto' ? 'CUDA: auto (ze sterownika)' : k === 'cpu' ? 'bez CUDA (procesor)' : k}</option>)}
                </select>
                <button onClick={instaluj} disabled={instaluje || zajete} className="rounded bg-orange-600/70 px-3 py-1 font-bold text-white disabled:opacity-40">
                    {doktor.wKatedrze ? 'Aktualizuj środowisko w Katedrze' : 'Zainstaluj w Katedrze'}
                </button>
                <span className="text-slate-500">→ {doktor.srodowisko} (Python 3.12 + PyTorch + soup-cli[train])</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1">
                {(doktor.linki ?? []).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-sky-300 underline decoration-dotted hover:text-sky-200">{l.nazwa}</a>)}
            </div>
            {doktor.doktor?.length ? <details className="text-slate-400"><summary className="cursor-pointer">soup doctor</summary><pre className="whitespace-pre-wrap text-[10px]">{doktor.doktor.join('\n')}</pre></details> : null}
        </div>
    );
};

interface Kandydat {
    id: string; repo: string; kwant: string; gb: number; pobrania: number | null; polubienia: number | null;
    opinia: string | null; stan: 'nowy' | 'pobiera' | 'pobrany' | 'odrzucony' | 'blad'; blad?: string | null; postep?: string | null; ollama: string;
}

/**
 * 🔭 Zwiadowca HF (services/ZwiadowcaHF.js): nowi kandydaci z HuggingFace dla Dyrygenta. Pobranie (ollama pull hf.co/…)
 * rusza DOPIERO po „Przyjmij"; odrzucone nie wracają w kolejnych zwiadach. Zwiad można też dać Nocnej Zmianie (zwiadowca-hf).
 */
export const ZwiadowcaPanel: React.FC = () => {
    const [lista, setLista] = useState<Kandydat[]>([]);
    const [ostatni, setOstatni] = useState<{ kiedy: string; nowych: number } | null>(null);
    const [vram, setVram] = useState<number | null>(null);
    const [trwa, setTrwa] = useState(false);
    const [etap, setEtap] = useState<string | null>(null);
    const [zapytania, setZapytania] = useState('');
    const [pracuje, setPracuje] = useState<string | null>(null);

    const wczytaj = useCallback(async () => {
        try {
            const d = await zMostu<{ kandydaci: Kandydat[]; ostatniZwiad: { kiedy: string; nowych: number } | null; trwa: boolean; vramGB: number }>('/api/zwiadowca/kandydaci');
            setLista(d.kandydaci); setOstatni(d.ostatniZwiad); setTrwa(d.trwa); setVram(d.vramGB);
            if (d.trwa) { const s = await zMostu<{ etap: string | null }>('/api/zwiadowca/sondaz'); setEtap(s.etap); } else setEtap(null);
        } catch { /* most offline — panel pokaże pustą listę */ }
    }, []);
    useEffect(() => { wczytaj(); }, [wczytaj]);
    // Odśwież, gdy zwiad trwa albo coś się pobiera (postęp w %).
    const zyje = trwa || lista.some((k) => k.stan === 'pobiera');
    useEffect(() => {
        if (!zyje) return;
        const t = window.setInterval(wczytaj, 4000);
        return () => window.clearInterval(t);
    }, [zyje, wczytaj]);

    const szukaj = async () => {
        try {
            await zMostu('/api/zwiadowca/szukaj', { method: 'POST', body: JSON.stringify(zapytania.trim() ? { zapytania } : {}) });
            setTrwa(true); toast('🔭 Zwiadowca ruszył na HuggingFace…'); wczytaj();
        } catch (e) { toast.error(blad(e)); }
    };
    const decyzja = async (k: Kandydat, co: 'akceptuj' | 'odrzuc') => {
        setPracuje(k.id);
        try {
            await zMostu(co === 'akceptuj' ? `/api/zwiadowca/kandydat/${k.id}/akceptuj` : `/api/zwiadowca/kandydat/${k.id}/odrzuc`, { method: 'POST', body: '{}' });
            toast.success(co === 'akceptuj' ? `⬇️ Pobieram ${k.repo} (${k.gb} GB) do Ollamy` : `Odrzucony: ${k.repo}`);
            wczytaj();
        } catch (e) { toast.error(blad(e)); }
        finally { setPracuje(null); }
    };

    const widoczne = lista.filter((k) => k.stan !== 'pobrany');
    return (
        <div className="space-y-3 rounded-2xl border border-teal-500/25 bg-teal-950/10 p-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-teal-200">🔭 Zwiadowca HF — nowe modele dla Dyrygenta</h3>
                <button onClick={wczytaj} className="text-[10px] text-teal-300/70 hover:text-teal-200" title="Odśwież">↻</button>
            </div>
            <p className="text-[11px] text-slate-400">
                Szuka na HuggingFace modeli GGUF, które zmieszczą się w karcie ({vram ?? '?'} GB VRAM, zmień: OTAKOS_VRAM_GB), czyta ich karty i melduje Dyrygentowi.
                Z Katedry nic nie wychodzi poza słowami wyszukiwania. <b>Nic nie pobiera się samo</b> — dopiero „Przyjmij" (ollama pull hf.co/…); po pobraniu opinia Zwiadowcy trafia do karty modelu.
            </p>
            <div className="flex flex-wrap gap-1.5">
                <input value={zapytania} onChange={(e) => setZapytania(e.target.value)} placeholder="słowa (domyślnie: polish, bielik, qwen3, gemma, coder, llama)"
                    className="min-w-[16rem] flex-1 rounded border border-slate-700 bg-black/40 px-2 py-1.5 text-xs text-slate-200" />
                <button onClick={szukaj} disabled={trwa} className="rounded bg-teal-700/70 px-3 py-1.5 text-xs font-bold text-teal-50 hover:bg-teal-600 disabled:opacity-50">
                    {trwa ? `⟳ ${etap ?? 'zwiad…'}` : '🔭 Szukaj teraz'}
                </button>
            </div>
            {ostatni && <div className="text-[10px] text-slate-500">Ostatni zwiad: {new Date(ostatni.kiedy).toLocaleString('pl-PL')} · nowych: {ostatni.nowych}</div>}
            {!widoczne.length && !trwa && <div className="text-[11px] text-slate-500">Brak kandydatów — uruchom zwiad (albo daj go Nocnej Zmianie: robota „zwiadowca-hf").</div>}
            <div className="space-y-1.5">
                {widoczne.map((k) => (
                    <div key={k.id} className="rounded-lg border border-slate-700/60 bg-black/30 p-2 text-[11px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <a href={`https://huggingface.co/${k.repo}`} target="_blank" rel="noreferrer" className="font-bold text-teal-200 hover:underline">{k.repo}</a>
                            <span className="text-slate-400">{k.kwant} · {k.gb} GB{k.pobrania != null ? ` · ⬇ ${k.pobrania.toLocaleString('pl-PL')}` : ''}{k.polubienia != null ? ` · ♥ ${k.polubienia}` : ''}</span>
                        </div>
                        {k.opinia && <div className="mt-0.5 text-slate-300">🔭 {k.opinia}</div>}
                        {k.stan === 'blad' && <div className="mt-0.5 text-rose-300">✕ {k.blad}</div>}
                        <div className="mt-1 flex items-center gap-2">
                            {k.stan === 'pobiera'
                                ? <span className="text-amber-300">⬇️ {k.postep ?? 'pobieram…'}</span>
                                : <>
                                    <button onClick={() => decyzja(k, 'akceptuj')} disabled={pracuje === k.id} className="rounded bg-emerald-700/70 px-2 py-0.5 font-bold text-emerald-50 hover:bg-emerald-600 disabled:opacity-50">{k.stan === 'blad' ? '↻ Ponów' : '✓ Przyjmij'}</button>
                                    <button onClick={() => decyzja(k, 'odrzuc')} disabled={pracuje === k.id} className="rounded border border-slate-600 px-2 py-0.5 text-slate-300 hover:bg-slate-800 disabled:opacity-50">✕ Odrzuć</button>
                                  </>}
                            <span className="ml-auto font-mono text-[10px] text-slate-500">{k.ollama}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function DyrygentIKuznia() {
    return <div className="space-y-4"><DyrygentPanel /><ZwiadowcaPanel /><KuzniaSoupPanel /></div>;
}
