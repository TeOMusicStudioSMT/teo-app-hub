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
 * PORZĄDKI (services/Porzadki.js): co zbędne na dysku, z rozmiarem i powodem — usuwa tylko zaznaczone.
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
interface Silnik { id: string; nazwa: string; rodzaj: string; gotowy: boolean; nieWiadomo: boolean; powod: string; licencja: string | null; modul: string | null }
interface KandydatSilnika { id: string; repo: string; rodzaj: string; licencja: string | null; komercyjna: boolean | null; url: string; opinia: string | null; stan: string }
interface WynikCelu {
    cel: string; etykieta: string; brakuje: string[]; moznaRuszyc: boolean; modeleUwaga?: string;
    rodzaje: Record<string, { potrzebny: boolean; gotowe: Silnik[]; niegotowe: Silnik[]; kandydaci: KandydatSilnika[] }>;
    modele?: { przydzial: Przydzial[]; odrzucone: (Przydzial & { powod: string })[]; model: string };
}
const CELE_DYRYGENTA: { id: string; nazwa: string }[] = [
    { id: 'film', nazwa: '🎬 Film / Story' }, { id: 'podcast', nazwa: '🎙️ Podcast' }, { id: 'gra', nazwa: '🎮 Gra / apka' },
    { id: 'fashion', nazwa: '👗 Fashion' }, { id: 'muzyka', nazwa: '🎵 Muzyka' }, { id: 'stol', nazwa: '🏛️ Stół (projekt stada)' },
];
const NAZWA_RODZAJU: Record<string, string> = { wideo: '🎬 Wideo', muzyka: '🎵 Muzyka', glos: '🗣️ Głos', obraz: '🖼️ Obraz', '3d': '🗿 Bryły 3D', usta: '👄 Usta', glebia: '🧊 Głębia', stemy: '🎚️ Stemy', mowa: '📝 Mowa→tekst' };
const licencjaZnacznik = (k: { licencja: string | null; komercyjna: boolean | null }) =>
    k.komercyjna === true ? `✅ ${k.licencja}` : k.komercyjna === false ? `⛔ ${k.licencja} — tylko niekomercyjnie` : `❔ ${k.licencja ?? 'licencja nieznana'} — sprawdź kartę`;
interface Gatunek { id: string; imie: string; forma?: string; wyklute: boolean }
interface Podglad { sft: number; pary: number; pominiete: { bezOceny: number; slabe: number }; wystarczy: boolean; minimum: number; prog: number }
interface Doktor {
    jest: boolean; wersja?: string; doktor?: string[]; blad?: string; polecenie: string; baza: string | null;
    zrodlo?: string; gpu?: 'cuda' | 'cpu' | null; srodowisko?: string; wKatedrze?: boolean; linki?: { nazwa: string; url: string }[];
}
interface Sondaz { stan: string; etap?: string; blad?: string | null; podsumowanie?: string | null; log?: string[] }

interface Partytura { id: string; nazwa: string; cel: string; zrodlo: 'katedra' | 'reczna' | 'wykonanie'; opis: string; role: { agent: string; model?: string | null; zadanie?: string }[]; narzedzia: string[]; workflow: string[]; skille: string[]; ocena?: number }

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
    // ⚡ sam Jev (szybko) albo Jev zawęża + większy model lokalny rozstrzyga (domyślnie — mądrzej, kilkadziesiąt sekund)
    const [szybko, setSzybko] = useState(false);
    const [propozycja, setPropozycja] = useState<{ przydzial: Przydzial[]; odrzucone: (Przydzial & { powod: string })[]; model: string; silnik?: string; rozstrzygniecieBlad?: string; partytura?: { nazwa: string; zrodlo: string; podobienstwo: number; metoda: string; ocena: number | null } } | null>(null);
    // 📜 Partytury (gotowe układy produkcji, genialne wykonania) i 🛡️ straż modeli (auto 3)
    const [partytury, setPartytury] = useState<Partytura[] | null>(null);
    const [jevLokalny, setJevLokalny] = useState<{ model: string; powod: string | null } | null>(null);
    const [straz, setStraz] = useState<{ kiedy: string | null; blad: string | null; zastepstwa: Record<string, { oryginal: string; zastepca: string; kiedy: string }> } | null>(null);
    const [zajety, setZajety] = useState(false);
    const [edycja, setEdycja] = useState<string | null>(null);
    const [opis, setOpis] = useState('');
    const [cel, setCel] = useState('film');
    const [zadanieCelu, setZadanieCelu] = useState('');
    const [zModelami, setZModelami] = useState(false);
    const [wynikCelu, setWynikCelu] = useState<WynikCelu | null>(null);
    const [zajetyCel, setZajetyCel] = useState(false);

    const odswiez = useCallback(async () => {
        try { const d = await zMostu<{ modele: ModelKatalogu[]; dyrygent: string }>('/api/modele/katalog'); setModele(d.modele); setDyrygent(d.dyrygent); }
        catch (e) { toast.error(`Katalog modeli: ${blad(e)}`); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);
    const odswiezPartytury = useCallback(async () => {
        try { const d = await zMostu<{ partytury: Partytura[]; jevLokalny: { model: string; powod: string | null } }>('/api/dyrygent/partytury'); setPartytury(d.partytury); setJevLokalny(d.jevLokalny); } catch { setPartytury(null); }
        try { setStraz(await zMostu('/api/dyrygent/straz')); } catch { setStraz(null); }
    }, []);
    useEffect(() => { void odswiezPartytury(); }, [odswiezPartytury]);
    const sprawdzStraz = async () => {
        try { const d = await zMostu<{ zmiany: { agent: string; rodzaj: string; z: string; na: string | null }[] }>('/api/dyrygent/straz/sprawdz', { method: 'POST', body: '{}' }); toast.success(d.zmiany.length ? d.zmiany.map((z) => `${z.agent}: ${z.rodzaj} ${z.z} → ${z.na ?? '—'}`).join(' · ') : '🛡️ Wszystkie modele TeOgochi są w Ollamie.', { duration: 7000 }); await odswiezPartytury(); await odswiez(); }
        catch (e) { toast.error(blad(e)); }
    };
    const usunPartyture = async (id: string) => {
        if (!window.confirm('Usunąć tę partyturę?')) return;
        try { await zMostu(`/api/dyrygent/partytury/${encodeURIComponent(id)}`, { method: 'DELETE' }); await odswiezPartytury(); } catch (e) { toast.error(blad(e)); }
    };

    const dobierz = async () => {
        setZajety(true); setPropozycja(null);
        try { setPropozycja(await zMostu('/api/dyrygent/dobierz', { method: 'POST', body: JSON.stringify({ zadanie, szybko }) })); }
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
    // 🎼 Dyrygent to TeOgochi: gra na modelu z przydziału (POST /api/stado/model {agent:'dyrygent'}). Pusty = domyślny Katedry.
    const ustawModelDyrygenta = async (model: string) => {
        try { await zMostu('/api/stado/model', { method: 'POST', body: JSON.stringify({ agent: 'dyrygent', model }) }); toast.success(model ? `🎼 Dyrygent gra teraz na ${model}` : '🎼 Dyrygent wraca do domyślnego modelu Katedry'); await odswiez(); }
        catch (e) { toast.error(blad(e)); }
    };
    const doCelu = async () => {
        setZajetyCel(true); setWynikCelu(null);
        try { setWynikCelu(await zMostu<WynikCelu>('/api/dyrygent/cel', { method: 'POST', body: JSON.stringify({ cel, zadanie: zadanieCelu, modele: zModelami }) })); }
        catch (e) { toast.error(blad(e), { duration: 8000 }); }
        finally { setZajetyCel(false); }
    };
    const zapiszKarte = async (nazwa: string) => {
        try { await zMostu('/api/modele/karta', { method: 'PUT', body: JSON.stringify({ nazwa, opis }) }); setEdycja(null); await odswiez(); }
        catch (e) { toast.error(blad(e)); }
    };

    return (
        <div className="space-y-3 rounded-2xl border border-sky-500/25 bg-sky-950/10 p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-sky-200">🎼 Dyrygent — modele do zadań</h3>
                <label className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400" title="Dyrygent to TeOgochi — wybierz mu model z katalogu (większy = lepszy dobór, wolniej)">
                    Dyrygent gra na:
                    <select value={dyrygent} onChange={(e) => void ustawModelDyrygenta(e.target.value)} className="rounded border border-slate-700 bg-black/50 px-1.5 py-0.5 text-[10px] text-sky-200">
                        {dyrygent && !modele?.some((m) => m.nazwa === dyrygent) && <option value={dyrygent}>{dyrygent}</option>}
                        {[...(modele ?? [])].sort((a, b) => (b.rozmiarGB ?? 0) - (a.rozmiarGB ?? 0)).map((m) => (
                            <option key={m.nazwa} value={m.nazwa}>{m.nazwa}{m.rozmiarGB ? ` · ${m.rozmiarGB} GB` : ''}{/:cloud$|-cloud$/.test(m.nazwa) ? ' · ☁ chmura' : ''}</option>
                        ))}
                    </select>
                </label>
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
                <label className="flex items-center gap-1 text-[10px] text-slate-400" title="Sam Jev: ułamek sekundy, ale idzie za najsilniejszym sygnałem. Bez tego: Jev wybiera 3 kandydatów, a większy model lokalny rozstrzyga z uzasadnieniem."><input type="checkbox" checked={szybko} onChange={(e) => setSzybko(e.target.checked)} /> ⚡ szybko (sam Jev)</label>
                <button onClick={dobierz} disabled={zajety || zadanie.trim().length < 5} className="rounded-lg bg-sky-600/60 px-3 text-xs font-bold text-white disabled:opacity-40">{zajety ? (szybko ? '🎼…' : '🎼 Jev zawęża, model rozważa…') : '🎼 Dobierz'}</button>
            </div>
            {propozycja && (
                <div className="space-y-1 rounded-lg border border-sky-700/40 p-2 text-[11px]">
                    <div className="text-slate-400">Propozycja Dyrygenta ({propozycja.model}):</div>
                    {propozycja.rozstrzygniecieBlad && <div className="text-amber-300/80">Większy model nie rozstrzygnął ({propozycja.rozstrzygniecieBlad}) — zostaje wybór Jev.</div>}
                    {propozycja.partytura && <div className="text-violet-200/90">📜 Podpowiedź z partytury: „{propozycja.partytura.nazwa}” ({propozycja.partytura.zrodlo === 'wykonanie' ? `genialne wykonanie ${propozycja.partytura.ocena}/10` : propozycja.partytura.zrodlo === 'reczna' ? 'Twoja' : 'wzorcowa'}, {propozycja.partytura.metoda} {propozycja.partytura.podobienstwo})</div>}
                    {propozycja.przydzial.map((p) => <div key={p.agent}><b className="text-slate-200">{p.agent}</b> → <span className="font-mono text-sky-200">{p.model}</span> <span className="text-slate-500">{p.powod}</span></div>)}
                    {propozycja.odrzucone.map((p, i) => <div key={i} className="text-amber-300/80">✕ {p.agent} → {p.model}: {p.powod}</div>)}
                    <button onClick={zastosuj} disabled={zajety || !propozycja.przydzial.length} className="mt-1 rounded bg-emerald-700/50 px-3 py-1 text-emerald-100 disabled:opacity-40">Zastosuj na stałe (silniki TeOgochi)</button>
                    <div className="text-slate-500">Albo tylko dla jednego projektu: w Świecie przy nowym projekcie zaznacz „🎼 Dyrygent dobierze modele". Na Stole Dyrygent dobiera modele sam, zanim stado ruszy.</div>
                </div>
            )}

            {/* 📜 Partytury Dyrygenta + 🛡️ straż modeli (auto 3) */}
            <div className="space-y-1.5 rounded-lg border border-violet-700/30 bg-black/20 p-2 text-[11px]">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-violet-200">📜 Partytury — gotowe układy i genialne wykonania</span>
                    <span className="ml-auto text-[10px] text-slate-500">Dyrygent ds. Kreatywnych: {jevLokalny?.powod ? `Jev z chmury (lokalny ${jevLokalny.model.split('/').pop()} nie wstaje)` : `lokalnie ${jevLokalny?.model.split('/').pop() ?? '—'}`}</span>
                </div>
                {!partytury && <div className="text-slate-500">Most nie podał partytur (stary most — restart).</div>}
                {partytury?.map((p) => (
                    <div key={p.id} className="flex items-start gap-2 border-t border-slate-800/60 pt-1">
                        <span>{p.zrodlo === 'wykonanie' ? '🌟' : p.zrodlo === 'reczna' ? '✍️' : '🏛️'}</span>
                        <div className="min-w-0 flex-1">
                            <div className="text-slate-200">{p.nazwa} <span className="text-slate-500">· {p.cel}{p.ocena ? ` · Sędzia-Jev ${p.ocena}/10` : ''}</span></div>
                            <div className="truncate text-slate-500">{p.role.map((r) => `${r.agent}${r.model ? `→${r.model.split('/').pop()}` : ''}`).join(', ')}{p.narzedzia.length ? ` · ${p.narzedzia.join(', ')}` : ''}</div>
                        </div>
                        {p.zrodlo !== 'katedra' && <button onClick={() => void usunPartyture(p.id)} className="text-slate-500 hover:text-rose-300" title="Usuń partyturę">✕</button>}
                    </div>
                ))}
                <div className="text-[10px] text-slate-500">🌟 = projekt stada oceniony przez Sędziego-Jev na ≥ 9/10 zapisuje się sam. Dyrygent podpowiada najbliższą partyturę przy doborze.</div>
                <div className="flex items-center gap-2 border-t border-slate-800/60 pt-1.5">
                    <span className="font-bold text-sky-200">🛡️ Straż modeli</span>
                    <span className="text-slate-500">{straz ? (straz.blad ? `⚠ ${straz.blad}` : straz.kiedy ? `ostatnio ${new Date(straz.kiedy).toLocaleTimeString('pl-PL')}` : 'pierwsze sprawdzenie minutę po starcie mostu') : '—'}</span>
                    <button onClick={() => void sprawdzStraz()} className="ml-auto rounded bg-sky-800/50 px-2 py-0.5 text-sky-100">Sprawdź teraz</button>
                </div>
                {straz && Object.entries(straz.zastepstwa).map(([agent, z]) => <div key={agent} className="text-amber-200/90">{agent}: {z.oryginal} zniknął z Ollamy → gra na {z.zastepca} (wróci sam)</div>)}
            </div>

            {/* 🎯 Do celu: silniki (wideo, muzyka, głos, 3D…) z bazy Katedry + czego brakuje + kandydaci Zwiadowcy */}
            <div className="space-y-2 rounded-lg border border-sky-700/30 bg-black/20 p-2">
                <div className="text-[11px] font-bold text-sky-200">🎯 Do celu — modele i silniki</div>
                <div className="flex flex-wrap gap-1.5">
                    <select value={cel} onChange={(e) => setCel(e.target.value)} className="rounded border border-slate-700 bg-black/40 px-2 py-1.5 text-xs text-slate-200">
                        {CELE_DYRYGENTA.map((c) => <option key={c.id} value={c.id}>{c.nazwa}</option>)}
                    </select>
                    <input value={zadanieCelu} onChange={(e) => setZadanieCelu(e.target.value)} placeholder="co robimy (opcjonalnie — potrzebne do doboru modeli)"
                        className="min-w-[12rem] flex-1 rounded border border-slate-700 bg-black/40 px-2 py-1.5 text-xs text-slate-200" />
                    <label className="flex items-center gap-1 text-[10px] text-slate-400"><input type="checkbox" checked={zModelami} onChange={(e) => setZModelami(e.target.checked)} /> dobierz też modele</label>
                    <button onClick={() => void doCelu()} disabled={zajetyCel || (zModelami && zadanieCelu.trim().length < 5)} className="rounded bg-sky-700/60 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">{zajetyCel ? '🎼…' : '🎯 Sprawdź'}</button>
                </div>
                {wynikCelu && (
                    <div className="space-y-1.5 text-[11px]">
                        <div className={wynikCelu.moznaRuszyc ? 'text-emerald-300' : 'text-amber-300'}>
                            {wynikCelu.moznaRuszyc ? `✓ ${wynikCelu.etykieta}: wszystko, co potrzebne, jest gotowe.` : `⚠ ${wynikCelu.etykieta}: brakuje — ${wynikCelu.brakuje.map((r) => NAZWA_RODZAJU[r] ?? r).join(', ')}.`}
                        </div>
                        {Object.entries(wynikCelu.rodzaje).map(([r, v]) => (
                            <div key={r} className="rounded bg-black/30 px-2 py-1">
                                <div className="font-bold text-slate-200">{NAZWA_RODZAJU[r] ?? r} <span className="font-normal text-slate-500">{v.potrzebny ? '· potrzebny' : '· pomocny'}</span></div>
                                {v.gotowe.map((x) => <div key={x.id} className="text-emerald-300">✓ {x.nazwa} <span className="text-slate-500">{x.modul}{x.licencja ? ` · ${x.licencja}` : ''}</span></div>)}
                                {v.niegotowe.map((x) => <div key={x.id} className={x.nieWiadomo ? 'text-slate-400' : 'text-rose-300/80'}>{x.nieWiadomo ? '❔' : '✕'} {x.nazwa}: <span className="text-slate-500">{x.powod}</span></div>)}
                                {!v.gotowe.length && !v.niegotowe.length && <div className="text-slate-500">Katedra nie ma tu żadnego silnika.</div>}
                                {v.kandydaci.map((k) => (
                                    <div key={k.id} className="text-teal-300/90">🔭 <a href={k.url} target="_blank" rel="noreferrer" className="hover:underline">{k.repo}</a> <span className="text-slate-500">· {k.stan} · {licencjaZnacznik(k)}</span>{k.opinia && <div className="pl-4 text-slate-400">{k.opinia}</div>}</div>
                                ))}
                            </div>
                        ))}
                        {wynikCelu.modeleUwaga && <div className="text-amber-300/80">{wynikCelu.modeleUwaga}</div>}
                        {wynikCelu.modele && (
                            <div className="rounded border border-sky-700/40 p-1.5">
                                <div className="text-slate-400">Modele ({wynikCelu.modele.model}):</div>
                                {wynikCelu.modele.przydzial.map((p) => <div key={p.agent}><b className="text-slate-200">{p.agent}</b> → <span className="font-mono text-sky-200">{p.model}</span> <span className="text-slate-500">{p.powod}</span></div>)}
                                {wynikCelu.modele.odrzucone.map((p, i) => <div key={i} className="text-amber-300/80">✕ {p.agent} → {p.model}: {p.powod}</div>)}
                            </div>
                        )}
                        <div className="text-[10px] text-slate-500">Brakujący silnik? Zwiadowca niżej szuka ich w dziedzinach (muzyka, głos, wideo, obraz, 3D) — przyjęty trafia tu jako „do zainstalowania”. Nic nie instaluje się samo.</div>
                    </div>
                )}
            </div>
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
    zrodlo?: string; zweryfikowane?: boolean; url?: string;
    /** 🎼 silnik (wideo, muzyka, głos…) — nie GGUF; „Przyjmij” = do zainstalowania, nic się nie pobiera */
    rodzaj?: 'silnik'; dziedzina?: string; licencja?: string | null; komercyjna?: boolean | null;
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
    const [dziedzina, setDziedzina] = useState('llm');
    const [link, setLink] = useState('');
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
            await zMostu('/api/zwiadowca/szukaj', { method: 'POST', body: JSON.stringify(dziedzina !== 'llm' ? { dziedzina } : zapytania.trim() ? { zapytania } : {}) });
            setTrwa(true); toast('🔭 Zwiadowca ruszył na HuggingFace…'); wczytaj();
        } catch (e) { toast.error(blad(e)); }
    };
    const zLinku = async () => {
        if (!link.trim()) return;
        setPracuje('link');
        try {
            const d = await zMostu<{ kandydat: Kandydat }>('/api/zwiadowca/link', { method: 'POST', body: JSON.stringify({ link: link.trim() }) });
            toast.success(`🔭 ${d.kandydat.repo}: ${d.kandydat.kwant}, ${d.kandydat.gb} GB — czeka na „Przyjmij"`);
            setLink(''); wczytaj();
        } catch (e) { toast.error(blad(e)); }
        finally { setPracuje(null); }
    };
    const decyzja = async (k: Kandydat, co: 'akceptuj' | 'odrzuc') => {
        setPracuje(k.id);
        try {
            await zMostu(co === 'akceptuj' ? `/api/zwiadowca/kandydat/${k.id}/akceptuj` : `/api/zwiadowca/kandydat/${k.id}/odrzuc`, { method: 'POST', body: '{}' });
            toast.success(co === 'odrzuc' ? `Odrzucony: ${k.repo}` : k.rodzaj === 'silnik' ? `🎼 ${k.repo} — do zainstalowania (Dyrygent widzi go w bazie; nic się nie pobiera)` : `⬇️ Pobieram ${k.repo} (${k.gb} GB) do Ollamy`);
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
                Szuka na HuggingFace (i pirateface.co — 🏴‍☠️ niezweryfikowane, wyłącz: OTAKOS_ZWIADOWCA_ZRODLA=hf) modeli GGUF, które zmieszczą się w karcie ({vram ?? '?'} GB VRAM, zmień: OTAKOS_VRAM_GB), czyta ich karty i melduje Dyrygentowi.
                Z Katedry nic nie wychodzi poza słowami wyszukiwania. <b>Nic nie pobiera się samo</b> — dopiero „Przyjmij" (ollama pull hf.co/…); po pobraniu opinia Zwiadowcy trafia do karty modelu.
                W dziedzinach (muzyka, głos, wideo, obraz, 3D, mowa) szuka <b>silników</b> z licencją wprost (✅ wolno zarabiać / ⛔ tylko niekomercyjnie) — ich „Przyjmij” to tylko „do zainstalowania” w bazie Dyrygenta.
            </p>
            <div className="flex flex-wrap gap-1.5">
                <select value={dziedzina} onChange={(e) => setDziedzina(e.target.value)} title="Modele GGUF dla Ollamy albo silniki z HuggingFace dla Dyrygenta" className="rounded border border-slate-700 bg-black/40 px-2 py-1.5 text-xs text-slate-200">
                    <option value="llm">🧠 modele językowe (GGUF)</option>
                    <option value="kod">💻 kod i apki (GGUF)</option>
                    <option value="muzyka">🎵 muzyka i dźwięk</option>
                    <option value="glos">🗣️ głos (TTS)</option>
                    <option value="wideo">🎬 wideo</option>
                    <option value="obraz">🖼️ obraz</option>
                    <option value="3d">🗿 bryły 3D</option>
                    <option value="mowa">📝 mowa → tekst</option>
                </select>
                {dziedzina === 'llm' && <input value={zapytania} onChange={(e) => setZapytania(e.target.value)} placeholder="słowa (domyślnie: polish, bielik, qwen3, gemma, coder, llama)"
                    className="min-w-[16rem] flex-1 rounded border border-slate-700 bg-black/40 px-2 py-1.5 text-xs text-slate-200" />}
                <button onClick={szukaj} disabled={trwa} className="rounded bg-teal-700/70 px-3 py-1.5 text-xs font-bold text-teal-50 hover:bg-teal-600 disabled:opacity-50">
                    {trwa ? `⟳ ${etap ?? 'zwiad…'}` : '🔭 Szukaj teraz'}
                </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
                <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') zLinku(); }}
                    placeholder="albo wklej link: huggingface.co/… · hf.co/… · pirateface.co/…"
                    className="min-w-[16rem] flex-1 rounded border border-slate-700 bg-black/40 px-2 py-1.5 text-xs text-slate-200" />
                <button onClick={zLinku} disabled={!link.trim() || pracuje === 'link'} className="rounded border border-teal-600/60 px-3 py-1.5 text-xs font-bold text-teal-200 hover:bg-teal-900/40 disabled:opacity-50">
                    {pracuje === 'link' ? '⟳ sprawdzam…' : '🔗 Sprawdź link'}
                </button>
            </div>
            {ostatni && <div className="text-[10px] text-slate-500">Ostatni zwiad: {new Date(ostatni.kiedy).toLocaleString('pl-PL')} · nowych: {ostatni.nowych}</div>}
            {!widoczne.length && !trwa && <div className="text-[11px] text-slate-500">Brak kandydatów — uruchom zwiad (albo daj go Nocnej Zmianie: robota „zwiadowca-hf").</div>}
            <div className="space-y-1.5">
                {widoczne.map((k) => (
                    <div key={k.id} className="rounded-lg border border-slate-700/60 bg-black/30 p-2 text-[11px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                                <a href={k.url ?? `https://huggingface.co/${k.repo}`} target="_blank" rel="noreferrer" className="font-bold text-teal-200 hover:underline">{k.repo}</a>
                                {k.zweryfikowane === false && (
                                    <span title="Źródło spoza HuggingFace, którego Katedra nie zna — sprawdź kartę modelu i licencję przed przyjęciem. Pobierany jest tylko plik GGUF."
                                        className="rounded border border-amber-500/50 bg-amber-950/40 px-1.5 text-[9px] font-bold text-amber-300">🏴‍☠️ {k.zrodlo} · niezweryfikowane</span>
                                )}
                            </span>
                            <span className="text-slate-400">{k.rodzaj === 'silnik' ? `${NAZWA_RODZAJU[k.dziedzina ?? ''] ?? k.dziedzina} · ${licencjaZnacznik({ licencja: k.licencja ?? null, komercyjna: k.komercyjna ?? null })}` : `${k.kwant} · ${k.gb} GB`}{k.pobrania != null ? ` · ⬇ ${k.pobrania.toLocaleString('pl-PL')}` : ''}{k.polubienia != null ? ` · ♥ ${k.polubienia}` : ''}</span>
                        </div>
                        {k.opinia && <div className="mt-0.5 text-slate-300">🔭 {k.opinia}</div>}
                        {k.stan === 'blad' && <div className="mt-0.5 text-rose-300">✕ {k.blad}</div>}
                        <div className="mt-1 flex items-center gap-2">
                            {k.stan === 'pobiera'
                                ? <span className="text-amber-300">⬇️ {k.postep ?? 'pobieram…'}</span>
                                : (k.stan as string) === 'przyjety'
                                ? <span className="text-sky-300">🎼 do zainstalowania — w bazie Dyrygenta</span>
                                : <>
                                    <button onClick={() => decyzja(k, 'akceptuj')} disabled={pracuje === k.id} className="rounded bg-emerald-700/70 px-2 py-0.5 font-bold text-emerald-50 hover:bg-emerald-600 disabled:opacity-50">{k.stan === 'blad' ? '↻ Ponów' : '✓ Przyjmij'}</button>
                                    <button onClick={() => decyzja(k, 'odrzuc')} disabled={pracuje === k.id} className="rounded border border-slate-600 px-2 py-0.5 text-slate-300 hover:bg-slate-800 disabled:opacity-50">✕ Odrzuć</button>
                                  </>}
                            <span className="ml-auto font-mono text-[10px] text-slate-500">{k.rodzaj === 'silnik' ? 'silnik — instalacja ręczna' : k.ollama}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface PozycjaPorzadkow { id: string; rodzaj: string; nazwa: string; gb: number; powod: string; uwaga: string | null }
const RODZAJ_POZYCJI: Record<string, string> = { 'gguf-w-ollamie': '📦 GGUF już w Ollamie', 'model-ollamy': '🧠 nieużywany model', 'kuznia-wynik': '⚒️ resztki Kuźni', 'pip-cache': '🗃️ cache pip' };

/**
 * 🧹 Porządki na dysku (services/Porzadki.js): propozycje z rozmiarem i powodem. Usuwa TYLKO zaznaczone, po potwierdzeniu;
 * most sprawdza każdą pozycję jeszcze raz. Dzieł Suwerena (muzyka, rendery, projekty) i baz HF Kuźni nie proponuje nigdy.
 */
export const PorzadkiPanel: React.FC = () => {
    const [pozycje, setPozycje] = useState<PozycjaPorzadkow[] | null>(null);
    const [dysk, setDysk] = useState<{ wolneGB: number; razemGB: number } | null>(null);
    const [zazn, setZazn] = useState<Record<string, boolean>>({});
    const [pracuje, setPracuje] = useState(false);

    const wczytaj = useCallback(async () => {
        setPracuje(true);
        try {
            const d = await zMostu<{ pozycje: PozycjaPorzadkow[]; dysk: { wolneGB: number; razemGB: number } | null }>('/api/porzadki/przeglad');
            setPozycje(d.pozycje); setDysk(d.dysk); setZazn({});
        } catch (e) { toast.error(blad(e)); }
        finally { setPracuje(false); }
    }, []);

    const wybrane = (pozycje ?? []).filter((p) => zazn[p.id]);
    const ileGB = Math.round(wybrane.reduce((s, p) => s + p.gb, 0) * 10) / 10;
    const usun = async () => {
        if (!wybrane.length) return;
        if (!window.confirm(`Usunąć ${wybrane.length} pozycji (${ileGB} GB)?\n\n${wybrane.map((p) => `• ${p.nazwa} (${p.gb} GB)`).join('\n')}\n\nTego nie da się cofnąć.`)) return;
        setPracuje(true);
        try {
            const d = await zMostu<{ usuniete: { nazwa: string }[]; odmowy: { powod: string }[]; zwolnionoGB: number }>('/api/porzadki/usun', { method: 'POST', body: JSON.stringify({ ids: wybrane.map((p) => p.id) }) });
            if (d.usuniete.length) toast.success(`🧹 Zwolniono ${d.zwolnionoGB} GB (${d.usuniete.length} pozycji).`);
            for (const o of d.odmowy) toast(`✋ ${o.powod}`, { duration: 8000 });
        } catch (e) { toast.error(blad(e)); }
        finally { setPracuje(false); wczytaj(); }
    };

    return (
        <div className="space-y-3 rounded-2xl border border-rose-500/25 bg-rose-950/10 p-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-rose-200">🧹 Porządki na dysku</h3>
                {dysk && <span className="text-[11px] text-slate-400">wolne: <b className="text-slate-200">{dysk.wolneGB} GB</b> z {dysk.razemGB} GB</span>}
            </div>
            <p className="text-[11px] text-slate-400">
                Katedra proponuje tylko to, o czym wie, skąd się wzięło: GGUF, które Ollama już skopiowała do siebie, modele, których nikt w stadzie nie używa,
                resztki treningu Kuźni i cache pip. <b>Twoich dzieł (muzyka, rendery, projekty) i baz HF Kuźni nie rusza nigdy.</b> Usuwa tylko zaznaczone.
            </p>
            <div className="flex flex-wrap gap-1.5">
                <button onClick={wczytaj} disabled={pracuje} className="rounded bg-slate-700/70 px-3 py-1.5 text-xs font-bold text-slate-100 hover:bg-slate-600 disabled:opacity-50">{pracuje ? '⟳ …' : '🔍 Przejrzyj dysk'}</button>
                {!!wybrane.length && (
                    <button onClick={usun} disabled={pracuje} className="rounded bg-rose-700/70 px-3 py-1.5 text-xs font-bold text-rose-50 hover:bg-rose-600 disabled:opacity-50">🗑️ Usuń zaznaczone ({ileGB} GB)</button>
                )}
            </div>
            {pozycje && !pozycje.length && <div className="text-[11px] text-emerald-300/80">✅ Nic zbędnego, o czym Katedra wie.</div>}
            <div className="space-y-1.5">
                {(pozycje ?? []).map((p) => (
                    <label key={p.id} className="flex cursor-pointer gap-2 rounded-lg border border-slate-700/60 bg-black/30 p-2 text-[11px] hover:bg-white/5">
                        <input type="checkbox" checked={!!zazn[p.id]} onChange={() => setZazn((z) => ({ ...z, [p.id]: !z[p.id] }))} className="mt-0.5 accent-rose-500" />
                        <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center justify-between gap-2">
                                <span className="truncate font-bold text-slate-200">{p.nazwa}</span>
                                <span className="shrink-0 text-slate-400">{RODZAJ_POZYCJI[p.rodzaj] ?? p.rodzaj} · <b className="text-slate-200">{p.gb} GB</b></span>
                            </span>
                            <span className="block text-slate-400">{p.powod}</span>
                            {p.uwaga && <span className="block text-amber-300/80">⚠ {p.uwaga}</span>}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
};

/**
 * 🏷️ Zwiadowca promocji (services/ZwiadowcaPromocji.js): kody rabatowe i promocje usług (Meshy, ElevenLabs, chmury…)
 * przez wyszukiwanie w sieci API Claude. Tylko znaleziska ze źródłem z wyników wyszukiwania; nic nie wpisuje i nie płaci.
 */
interface Znalezisko { rodzaj: string; kod: string | null; opis: string; rabat: string | null; zrodlo: string; tytulZrodla: string | null; wiekStrony: string | null; data: string | null; pewnosc: string; uwagi: string | null }
interface Zwiad { usluga: string; kiedy: string; znalezione: Znalezisko[]; odrzucone: unknown[]; podsumowanie: string; koszt: { wyszukan: number; usdWyszukiwania: number }; uwaga: string }
export const PromocjePanel: React.FC = () => {
    const [zwiady, setZwiady] = useState<Zwiad[]>([]);
    const [usluga, setUsluga] = useState('Meshy');
    const [trwa, setTrwa] = useState(false);
    useEffect(() => { zMostu<{ zwiady: Zwiad[] }>('/api/zwiadowca/promocje').then((d) => setZwiady(d.zwiady)).catch(() => {}); }, []);
    const szukaj = async () => {
        setTrwa(true);
        try {
            const d = await zMostu<{ zwiad: Zwiad }>('/api/zwiadowca/promocje', { method: 'POST', body: JSON.stringify({ usluga: usluga.trim() }) });
            setZwiady((z) => [d.zwiad, ...z.filter((x) => x.usluga.toLowerCase() !== d.zwiad.usluga.toLowerCase())]);
            toast.success(`🏷️ ${d.zwiad.usluga}: ${d.zwiad.znalezione.length} zniżek ze źródłami`);
        } catch (e) { toast.error(blad(e)); } finally { setTrwa(false); }
    };
    return (
        <div className="space-y-2 rounded-xl border border-amber-800/50 bg-black/30 p-3">
            <h3 className="text-sm font-bold text-amber-200">🏷️ Zwiadowca promocji — kody rabatowe usług</h3>
            <p className="text-[10px] text-slate-500">Szuka w sieci przez API Claude (klucz Anthropic z Kibla; ~$0,01 za wyszukanie + tokeny). Pokazuje tylko to, co ma źródło. Kod sprawdzasz sam przy płatności.</p>
            <div className="flex gap-2">
                <input value={usluga} onChange={(e) => setUsluga(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !trwa) void szukaj(); }} placeholder="usługa, np. Meshy, ElevenLabs, RunPod" className="flex-1 rounded-lg border border-slate-700 bg-black/40 px-2 py-1 text-xs outline-none" />
                <button onClick={() => void szukaj()} disabled={trwa || usluga.trim().length < 2} className="rounded-lg border border-amber-600/60 px-3 py-1 text-xs text-amber-200 disabled:opacity-40">{trwa ? 'szukam…' : 'Szukaj'}</button>
            </div>
            {zwiady.map((z) => (
                <div key={z.usluga} className="space-y-1 rounded-lg border border-slate-800 p-2">
                    <div className="text-xs font-semibold text-slate-200">{z.usluga} <span className="font-normal text-[10px] text-slate-500">· {new Date(z.kiedy).toLocaleString('pl-PL')} · {z.koszt.wyszukan} wyszukań (≈ ${z.koszt.usdWyszukiwania}){z.odrzucone.length ? ` · ${z.odrzucone.length} odrzucone bez źródła` : ''}</span></div>
                    {z.znalezione.length === 0 && <div className="text-[11px] text-slate-400">Nic ze źródłem. {z.podsumowanie}</div>}
                    {z.znalezione.map((n, i) => (
                        <div key={i} className="text-[11px] text-slate-300">
                            {n.kod && <code className="mr-1 rounded bg-amber-500/20 px-1 text-amber-200">{n.kod}</code>}{n.rabat && <b className="mr-1 text-emerald-300">{n.rabat}</b>}{n.opis}
                            <span className="text-[10px] text-slate-500"> · {n.pewnosc === 'oficjalne' ? '✅ oficjalne' : n.pewnosc === 'forum' ? '💬 forum' : '🧾 agregator'}{n.data || n.wiekStrony ? ` · ${n.data ?? n.wiekStrony}` : ''}{n.uwagi ? ` · ${n.uwagi}` : ''} · <a href={n.zrodlo} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">{n.tytulZrodla ?? 'źródło'}</a></span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

/**
 * 🎯 Modele zadań technicznych (services/ModeleZadan.js): oczy itd. — model z faktów Ollamy (zdolność + rozmiar), ręczny
 * wybór Suwerena albo z DANYCH (≥ 5 użyć: skuteczność × ocena Jev). Każde użycie zbiera dane — tu widać, ile już jest.
 */
interface StatZadania { model: string; prob: number; skutecznosc: number; sredniaJev: number | null; medianaMs: number | null }
interface Zadanie { nazwa: string; opis: string; potrzeba: string[]; wybrany: string | null; zrodlo: string | null; reczny: string | null; kandydaci: { model: string; gb: number }[]; statystyki: StatZadania[]; uzyc: number; blad: string | null }
export const ModeleZadanPanel: React.FC = () => {
    const [d, setD] = useState<{ zadania: Record<string, Zadanie>; jev: boolean; minProb: number } | null>(null);
    const wczytaj = useCallback(() => zMostu<{ zadania: Record<string, Zadanie>; jev: boolean; minProb: number }>('/api/modele/zadania').then(setD).catch((e) => toast.error(blad(e))), []);
    useEffect(() => { void wczytaj(); }, [wczytaj]);
    const ustaw = async (zadanie: string, model: string) => {
        try { await zMostu('/api/modele/zadania', { method: 'PUT', body: JSON.stringify({ zadanie, model: model || null }) }); toast.success(model ? `🎯 ${zadanie} → ${model}` : `🎯 ${zadanie}: wybór automatyczny`); await wczytaj(); } catch (e) { toast.error(blad(e)); }
    };
    if (!d) return null;
    const ZRODLO: Record<string, string> = { fakty: 'z faktów Ollamy', dane: 'z danych (Jev + skuteczność)', reczny: 'Twój wybór', env: 'zmienna środowiska' };
    return (
        <div className="space-y-2 rounded-xl border border-sky-800/50 bg-black/30 p-3">
            <h3 className="text-sm font-bold text-sky-200">🎯 Modele zadań Katedry</h3>
            <p className="text-[10px] text-slate-500">Model wybiera się z tego, co Ollama naprawdę ma i umie. Każde użycie zbiera dane{d.jev ? ', a Jev ocenia jakość wyniku' : ' (bez klucza Jev — tylko skuteczność i czas)'}; od {d.minProb} użyć decydują dane.</p>
            {Object.entries(d.zadania).map(([id, z]) => (
                <div key={id} className="space-y-1 rounded-lg border border-slate-800 p-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-2">
                        <b className="text-slate-200">{z.nazwa}</b><span className="text-slate-500">{z.opis} · potrzebuje: {z.potrzeba.join(' + ')}</span>
                    </div>
                    {z.blad ? <p className="text-amber-300">⚠ {z.blad}</p> : <p className="text-emerald-300">→ {z.wybrany} <span className="text-slate-500">({ZRODLO[z.zrodlo ?? ''] ?? z.zrodlo}) · użyć: {z.uzyc}</span></p>}
                    <select value={z.reczny ?? ''} onChange={(e) => void ustaw(id, e.target.value)} className="rounded border border-slate-700 bg-black/40 px-1 py-0.5 text-[11px]">
                        <option value="">automatycznie (fakty → dane)</option>
                        {z.kandydaci.map((k) => <option key={k.model} value={k.model}>{k.model} · {k.gb} GB</option>)}
                    </select>
                    {z.statystyki.length > 0 && <div className="text-[10px] text-slate-400">{z.statystyki.slice(0, 4).map((s) => `${s.model}: ${s.prob}× · ${Math.round(s.skutecznosc * 100)}% ok${s.sredniaJev !== null ? ` · Jev ${s.sredniaJev}` : ''}${s.medianaMs ? ` · ${Math.round(s.medianaMs / 1000)} s` : ''}`).join(' | ')}</div>}
                </div>
            ))}
        </div>
    );
};

export default function DyrygentIKuznia() {
    return <div className="space-y-4"><DyrygentPanel /><ModeleZadanPanel /><ZwiadowcaPanel /><PromocjePanel /><KuzniaSoupPanel /><PorzadkiPanel /></div>;
}
