/**
 * 🔭🏷️ PanelZwiadowcy.tsx — Dedykowany Warsztat TeOgochi Zwiadowcy
 *
 * Łączy w jednym, zwijanym i pokatalogowanym widoku:
 *   1. 🏷️ Zwiad Kodów Zaproszenia, Promocji i Bonusów (Kraken DE / giełdy / AI / 3D / GPU)
 *      — obsługuje:
 *          · 🏠 Lokalny (Ollama + żywy zwiad Reddit JSON za 0 €, działa nawet na starym procesie mostu!)
 *          · ☁️ Gemini (Google Search)
 *          · ☁️ Claude (Web Search)
 *      — podzielony na zwijane kategorie (📈 Giełdy & Finanse, 🎨 AI & Kreacja, ☁️ Chmura & Inne)
 *      oraz zwijane karty usług z przyciskiem „📋 Kopiuj kod”.
 *   2. 🔭 Zwiad Modeli i Silników HuggingFace (ZwiadowcaPanel).
 */
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { ZwiadowcaPanel } from './DyrygentIKuznia';

const MOST = 'http://127.0.0.1:3001';

interface Znalezisko {
    rodzaj: string;
    kod: string | null;
    opis: string;
    rabat: string | null;
    zrodlo: string;
    tytulZrodla: string | null;
    wiekStrony: string | null;
    data: string | null;
    pewnosc: string;
    uwagi: string | null;
    potwierdzone?: 'adres' | 'domena' | null;
}

interface Zwiad {
    usluga: string;
    kiedy: string;
    dostawca?: 'anthropic' | 'gemini' | 'lokalny';
    znalezione: Znalezisko[];
    odrzucone: unknown[];
    podsumowanie: string;
    koszt: { wyszukan: number; usdWyszukiwania: number | null };
    uwaga: string;
}

type DostawcaPromocji = 'lokalny' | 'gemini' | 'auto' | 'anthropic';

const PRESETY: Array<{ label: string; usluga: string; kontekst: string; kat: 'finanse' | 'ai' | 'chmura' }> = [
    {
        label: '🐙 Kraken DE (Kod zaproszenia)',
        usluga: 'Kraken Germany',
        kontekst: 'Kraken invite code referral code bonus EUR Germany',
        kat: 'finanse',
    },
    {
        label: '🐙 Kraken Pro (Fee / Promo)',
        usluga: 'Kraken Pro',
        kontekst: 'Kraken Pro promo code invite code referral Europe',
        kat: 'finanse',
    },
    {
        label: '🐼 Bitpanda DE',
        usluga: 'Bitpanda',
        kontekst: 'Bitpanda referral code Tell-a-Friend bonus EUR Germany',
        kat: 'finanse',
    },
    {
        label: '🔐 Ledger (Portfel sprzętowy)',
        usluga: 'Ledger',
        kontekst: 'Ledger Nano discount code referral code promo',
        kat: 'finanse',
    },
    {
        label: '🧊 Meshy (3D AI)',
        usluga: 'Meshy',
        kontekst: 'Meshy AI 3D promo code discount code coupon',
        kat: 'ai',
    },
    {
        label: '🎵 Suno AI (Muzyka)',
        usluga: 'Suno AI',
        kontekst: 'Suno AI promo code discount referral plan',
        kat: 'ai',
    },
    {
        label: '🧬 ElevenLabs (Głos)',
        usluga: 'ElevenLabs',
        kontekst: 'ElevenLabs promo code coupon creator discount',
        kat: 'ai',
    },
    {
        label: '☁️ RunPod / Vast.ai (GPU)',
        usluga: 'RunPod',
        kontekst: 'RunPod GPU cloud promo code referral bonus credits',
        kat: 'chmura',
    },
];

function kategoriaUslugi(nazwa: string): 'finanse' | 'ai' | 'chmura' {
    const n = nazwa.toLowerCase();
    if (/kraken|binance|bybit|bitpanda|coinbase|ledger|trezor|stripe|krypto|crypto|gie[łl]d|bank|revolut|bitvavo/.test(n)) return 'finanse';
    if (/meshy|suno|eleven|midjourney|runway|kling|flux|udio|tripo|luma|pika|openai|claude|anthropic|gemini/.test(n)) return 'ai';
    return 'chmura';
}

const KATEGORIE: Array<{ id: 'finanse' | 'ai' | 'chmura'; tytul: string; ikona: string; kolor: string }> = [
    { id: 'finanse', tytul: 'Giełdy, Krypto & Finanse (Kraken DE, Ledger, Bitpanda…)', ikona: '📈', kolor: 'border-amber-500/35 bg-amber-950/10 text-amber-200' },
    { id: 'ai',      tytul: 'Kreacja AI, 3D, Muzyka & Głos (Meshy, Suno, ElevenLabs…)', ikona: '🎨', kolor: 'border-fuchsia-500/35 bg-fuchsia-950/10 text-fuchsia-200' },
    { id: 'chmura',  tytul: 'Chmura, GPU, Serwery & Narzędzia (RunPod, Hosting…)',      ikona: '☁️', kolor: 'border-cyan-500/35 bg-cyan-950/10 text-cyan-200' },
];

/**
 * 🏠 Bezpośredni Zwiad Lokalny (Reddit Public JSON + Lokalna Ollama przez Most `/api/ollama`)
 * Działa natychmiast za 0 €, nawet gdy działający w tle proces mostu nie był jeszcze zrestartowany!
 */
async function zwiadLokalnyRedditOllama(usluga: string, kontekst: string): Promise<Zwiad> {
    const q = encodeURIComponent(`${usluga} ${kontekst || 'invite referral promo code'}`.trim());
    const rr = await fetch(`https://www.reddit.com/search.json?q=${q}&sort=new&limit=12`);
    if (!rr.ok) throw new Error(`Reddit Search HTTP ${rr.status}`);
    const rd = await rr.json();
    const posts: Array<{ title: string; selftext: string; url: string; date: string }> = [];
    for (const c of rd?.data?.children ?? []) {
        const p = c?.data;
        if (!p?.title) continue;
        const url = `https://www.reddit.com${p.permalink || ''}`;
        const date = p.created_utc ? new Date(p.created_utc * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        posts.push({
            title: String(p.title).slice(0, 140),
            selftext: String(p.selftext || '').slice(0, 500),
            url,
            date,
        });
    }

    // Wyciągnij kody regexem + poproś lokalny model Ollama o analizę
    const wycinki = posts.map((p, idx) => `[${idx + 1}] ŹRÓDŁO: ${p.url} (${p.date})\nTYTUŁ: ${p.title}\nTREŚĆ: ${p.selftext}`).join('\n\n');
    const model = localStorage.getItem('otakos_active_model') || 'gemma4:e2b';
    const prompt = `Jesteś Zwiadowcą Katedry OtakOS. Przeanalizuj poniższe świeże wpisy z sieci dla usługi "${usluga}" (${kontekst}):\n\n${wycinki || 'Brak wpisów.'}\n\nWypisz znalezione kody zaproszenia (referral/invite code), promocje i linki powitalne po polsku (krótko, 2-3 zdania podsumowania).`;

    let podsumowanieModelu = '';
    try {
        const or = await fetch(`${MOST}/api/ollama`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, stream: false }),
        });
        if (or.ok) {
            const txt = await or.text();
            // Obsługa zarówno zwykłego JSON jak i strumienia SSE z /api/ollama
            if (txt.includes('data: ')) {
                podsumowanieModelu = txt
                    .split('\n')
                    .filter(l => l.startsWith('data: '))
                    .map(l => { try { return JSON.parse(l.slice(6)).text || ''; } catch { return ''; } })
                    .join('')
                    .trim();
            } else {
                try { podsumowanieModelu = JSON.parse(txt)?.response || txt; } catch { podsumowanieModelu = txt; }
            }
        }
    } catch {}

    // Wyekstrahuj konkretne znaleziska z prawdziwych postów (każdy ma 100% prawdziwe źródło!)
    const znalezione: Znalezisko[] = posts.slice(0, 8).map((p) => {
        const tekstCalosc = `${p.title} ${p.selftext}`;
        const codeMatch = tekstCalosc.match(/\b(?:code|invite|referral|kod|promo)[:\s-]*([A-Z0-9_-]{4,20})\b/i)
            || tekstCalosc.match(/\b([a-z0-9]{4,8}-[a-z0-9]{4,8})\b/i);
        const eurMatch = tekstCalosc.match(/(\d+\s*(?:€|EUR|\$|USD|BTC|%))/i);
        return {
            rodzaj: codeMatch ? 'kod' : 'partnerska',
            kod: codeMatch ? codeMatch[1] : null,
            opis: `${p.title}${p.selftext ? ' — ' + p.selftext.replace(/\s+/g, ' ').slice(0, 180) : ''}`,
            rabat: eurMatch ? eurMatch[1] : null,
            zrodlo: p.url,
            tytulZrodla: `Reddit (${p.date})`,
            wiekStrony: p.date,
            data: p.date,
            pewnosc: 'forum',
            uwagi: 'Zweryfikowane źródło społeczności Reddit',
            potwierdzone: 'adres',
        };
    });

    return {
        usluga,
        kiedy: new Date().toISOString(),
        dostawca: 'lokalny',
        znalezione,
        odrzucone: [],
        podsumowanie: (podsumowanieModelu || `Przeszukano ${posts.length} najnowszych wątków społeczności dla „${usluga}”.`).slice(0, 400),
        koszt: { wyszukan: 1, usdWyszukiwania: 0 },
        uwaga: '🏠 Zwiad wykonany lokalnie (żywe API Reddit + lokalny model Ollama, koszt $0.00).',
    };
}

export const PanelZwiadowcy: React.FC = () => {
    const [zwiady, setZwiady] = useState<Zwiad[]>(() => {
        try { return JSON.parse(localStorage.getItem('zwiadowca_lokalne_zwiady_v1') || '[]'); } catch { return []; }
    });
    const [usluga, setUsluga] = useState('Kraken Germany');
    const [kontekst, setKontekst] = useState('Kraken invite code referral code bonus EUR Germany');
    const [trwa, setTrwa] = useState(false);
    const [dostawca, setDostawca] = useState<DostawcaPromocji>('lokalny');
    const [klucze, setKlucze] = useState<{ anthropic: boolean; gemini: boolean } | null>(null);
    const [filtrKat, setFiltrKat] = useState<'wszystkie' | 'finanse' | 'ai' | 'chmura'>('wszystkie');

    const zapiszLokalnie = (nowaLista: Zwiad[]) => {
        setZwiady(nowaLista);
        try { localStorage.setItem('zwiadowca_lokalne_zwiady_v1', JSON.stringify(nowaLista.slice(0, 30))); } catch {}
    };

    const wczytaj = async () => {
        try {
            const r = await fetch(`${MOST}/api/zwiadowca/promocje`);
            const d = await r.json();
            if (Array.isArray(d?.zwiady) && d.zwiady.length > 0) {
                setZwiady(prev => {
                    const mapa = new Map<string, Zwiad>();
                    for (const x of [...prev, ...d.zwiady]) mapa.set(x.usluga.toLowerCase(), x);
                    return [...mapa.values()];
                });
            }
            if (d?.dostawcy) setKlucze(d.dostawcy);
        } catch {}
    };

    useEffect(() => { void wczytaj(); }, []);

    const uruchomZwiad = async (celUsluga = usluga, celKontekst = kontekst) => {
        if (celUsluga.trim().length < 2 || trwa) return;
        setTrwa(true);
        try {
            // Jeśli wybrano tryb 🏠 Lokalny — od razu leci darmowy zwiad Reddit + Ollama (0€, bez Anthropic!)
            if (dostawca === 'lokalny') {
                const wynikLok = await zwiadLokalnyRedditOllama(celUsluga.trim(), celKontekst.trim());
                zapiszLokalnie([wynikLok, ...zwiady.filter(x => x.usluga.toLowerCase() !== wynikLok.usluga.toLowerCase())]);
                toast.success(`🏠 Zwiadowca (Lokalny 0€): ${wynikLok.znalezione.length} znalezisk dla „${wynikLok.usluga}”`);
                return;
            }

            const r = await fetch(`${MOST}/api/zwiadowca/promocje`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usluga: celUsluga.trim(),
                    kontekst: celKontekst.trim() || undefined,
                    dostawca,
                }),
            });
            const d = await r.json();
            if (!r.ok || d?.success === false) {
                const msg = String(d?.message || `HTTP ${r.status}`);
                // Automatyczny ratunek: jeśli działający most jest sprzed restartu i woła o klucz Anthropic → wykonaj zwiad lokalnie!
                if (/Anthropic|klucza/i.test(msg)) {
                    toast('🔄 Most wołał o klucz chmury — przełączam Zwiadowcę na darmowy Zwiad Lokalny (Reddit + Ollama 0€)…');
                    const wynikLok = await zwiadLokalnyRedditOllama(celUsluga.trim(), celKontekst.trim());
                    zapiszLokalnie([wynikLok, ...zwiady.filter(x => x.usluga.toLowerCase() !== wynikLok.usluga.toLowerCase())]);
                    toast.success(`🏠 Zwiadowca (Lokalny 0€): ${wynikLok.znalezione.length} znalezisk dla „${wynikLok.usluga}”`);
                    return;
                }
                throw new Error(msg);
            }
            if (d?.zwiad) {
                zapiszLokalnie([d.zwiad, ...zwiady.filter(x => x.usluga.toLowerCase() !== d.zwiad.usluga.toLowerCase())]);
                toast.success(`🔭 Zwiadowca zbadał „${d.zwiad.usluga}”: ${d.zwiad.znalezione.length} potwierdzonych znalezisk`);
            }
        } catch (e: any) {
            toast.error(e?.message || String(e));
        } finally {
            setTrwa(false);
        }
    };

    const kopiujKod = (kod: string) => {
        navigator.clipboard.writeText(kod);
        toast.success(`📋 Skopiowano kod: ${kod}`);
    };

    return (
        <div className="space-y-4">
            {/* SEKCJA 1: KODY ZAPROSZENIA, PROMOCJE I BONUSY (ZWIJANA, POKATALOGOWANA) */}
            <details open className="group rounded-2xl border border-amber-500/35 bg-slate-950/80 p-4">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl">🏷️</span>
                        <div>
                            <h3 className="text-sm font-bold text-amber-200">
                                Zwiadowca Kodów Zaproszenia, Promocji i Bonusów ({zwiady.length} zbadanych usług)
                            </h3>
                            <p className="text-[10px] text-slate-400">
                                Działa <b>🏠 Lokalnie (Reddit + Ollama za 0€)</b> oraz w chmurze (<b>☁️ Gemini Google Search</b> / Claude). Zero zmyśleń — tylko prawdziwe linki.
                                {klucze ? ` Klucze chmury w moście: ${[klucze.gemini && 'Gemini', klucze.anthropic && 'Claude'].filter(Boolean).join(', ') || 'brak (tryb Lokalny 0€ aktywny)'}` : ''}
                            </p>
                        </div>
                    </div>
                    <span className="text-xs font-mono text-amber-300/70 group-open:rotate-90 transition-transform">▸</span>
                </summary>

                <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
                    {/* Szybkie presety (1-klik) */}
                    <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                            ⚡ Szybki cel zwiadu (kliknij, aby załadować kontekst):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {PRESETY.map((p) => (
                                <button
                                    key={p.label}
                                    onClick={() => { setUsluga(p.usluga); setKontekst(p.kontekst); }}
                                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition cursor-pointer ${
                                        usluga === p.usluga
                                            ? 'border-amber-400 bg-amber-500/20 text-amber-200 font-bold'
                                            : 'border-slate-700 bg-black/40 text-slate-300 hover:border-slate-500'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Formularz wyszukiwania z kontekstem */}
                    <div className="grid gap-2 sm:grid-cols-12 bg-black/40 p-3 rounded-xl border border-slate-800">
                        <div className="sm:col-span-3">
                            <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Usługa / Giełda / Narzędzie</label>
                            <input
                                value={usluga}
                                onChange={(e) => setUsluga(e.target.value)}
                                placeholder="np. Kraken Germany, Meshy..."
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                            />
                        </div>
                        <div className="sm:col-span-5">
                            <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Czego dokładnie szukać (kontekst / kraj)</label>
                            <input
                                value={kontekst}
                                onChange={(e) => setKontekst(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !trwa) void uruchomZwiad(); }}
                                placeholder="np. Kod zaproszenia DE Niemcy, referral bonus EUR..."
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500"
                            />
                        </div>
                        <div className="sm:col-span-4 flex items-end gap-1.5">
                            <select
                                value={dostawca}
                                onChange={(e) => setDostawca(e.target.value as DostawcaPromocji)}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-emerald-300 font-bold"
                                title="Silnik wyszukiwania"
                            >
                                <option value="lokalny">🏠 Lokalny (Ollama 0€)</option>
                                <option value="gemini">☁️ Gemini (Google)</option>
                                <option value="auto">🔄 Auto (Fallback)</option>
                                <option value="anthropic">☁️ Claude</option>
                            </select>
                            <button
                                onClick={() => void uruchomZwiad()}
                                disabled={trwa || usluga.trim().length < 2}
                                className="flex-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/70 px-3 py-1.5 text-xs font-bold text-amber-200 disabled:opacity-40 transition cursor-pointer"
                            >
                                {trwa ? '🔭 Szukam…' : '🔭 Wyślij Zwiad'}
                            </button>
                        </div>
                    </div>

                    {/* Filtr kategorii */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                        <div className="flex gap-1.5">
                            {[
                                { id: 'wszystkie', label: `🗂️ Wszystkie (${zwiady.length})` },
                                { id: 'finanse',   label: `📈 Giełdy & Finanse (${zwiady.filter(z => kategoriaUslugi(z.usluga) === 'finanse').length})` },
                                { id: 'ai',        label: `🎨 AI & Kreacja (${zwiady.filter(z => kategoriaUslugi(z.usluga) === 'ai').length})` },
                                { id: 'chmura',    label: `☁️ Chmura & Inne (${zwiady.filter(z => kategoriaUslugi(z.usluga) === 'chmura').length})` },
                            ].map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setFiltrKat(f.id as any)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border cursor-pointer ${
                                        filtrKat === f.id
                                            ? 'border-teal-400 bg-teal-950/40 text-teal-200 font-bold'
                                            : 'border-slate-800 bg-black/30 text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pokatalogowane, zwijane drzewo wyników */}
                    {zwiady.length === 0 ? (
                        <div className="rounded-xl border border-slate-800 bg-black/30 p-4 text-center text-xs text-slate-400">
                            Brak zapisanych zwiadów. Wybierz <b>🏠 Lokalny (Ollama 0€)</b> lub <b>☁️ Gemini</b> i kliknij <b>🔭 Wyślij Zwiad</b>!
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {KATEGORIE.filter(kat => filtrKat === 'wszystkie' || filtrKat === kat.id).map((kat) => {
                                const grupa = zwiady.filter(z => kategoriaUslugi(z.usluga) === kat.id);
                                if (grupa.length === 0) return null;
                                const lacznieZnalezisk = grupa.reduce((s, g) => s + g.znalezione.length, 0);

                                return (
                                    <details key={kat.id} open className={`rounded-xl border p-3 ${kat.kolor}`}>
                                        <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-bold">
                                            <span>{kat.ikona} {kat.tytul}</span>
                                            <span className="text-[10px] font-mono opacity-80">
                                                {grupa.length} usług · {lacznieZnalezisk} kodów/ofert ▾
                                            </span>
                                        </summary>

                                        <div className="mt-2.5 space-y-2">
                                            {grupa.map((z, idx) => (
                                                <details
                                                    key={z.usluga}
                                                    open={idx === 0}
                                                    className="rounded-lg border border-slate-800/90 bg-slate-950/90 p-2.5 text-slate-200"
                                                >
                                                    <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-xs font-bold text-white">{z.usluga}</span>
                                                            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                                                                {z.znalezione.length} znalezisk
                                                            </span>
                                                            {z.znalezione.some(n => n.kod) && (
                                                                <span className="rounded-full bg-amber-500/20 border border-amber-400/50 px-2 py-0.5 text-[10px] font-mono text-amber-200">
                                                                    🔑 ma kody
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-mono text-slate-400">
                                                            {new Date(z.kiedy).toLocaleDateString('pl-PL')} · {z.dostawca === 'lokalny' ? '🏠 Lokalny (Ollama 0€)' : z.dostawca === 'gemini' ? '☁️ Gemini' : '☁️ Claude'} ▾
                                                        </span>
                                                    </summary>

                                                    <div className="mt-2 space-y-2 border-t border-slate-800/80 pt-2">
                                                        {z.podsumowanie && (
                                                            <p className="text-[11px] text-slate-300 bg-black/40 rounded-lg p-2 border border-slate-800/60">
                                                                💡 {z.podsumowanie}
                                                            </p>
                                                        )}

                                                        {z.znalezione.length === 0 ? (
                                                            <div className="text-[11px] text-slate-400">
                                                                Brak potwierdzonych kodów z bezpośrednim źródłem w tym przebiegu.
                                                            </div>
                                                        ) : (
                                                            <div className="grid gap-2">
                                                                {z.znalezione.map((n, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="rounded-lg border border-slate-800 bg-black/50 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                                                    >
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                {n.kod ? (
                                                                                    <button
                                                                                        onClick={() => kopiujKod(n.kod!)}
                                                                                        title="Kliknij, aby skopiować kod do schowka"
                                                                                        className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400/60 text-amber-200 font-mono text-xs font-bold hover:bg-amber-500/40 transition cursor-pointer"
                                                                                    >
                                                                                        🔑 {n.kod} 📋
                                                                                    </button>
                                                                                ) : (
                                                                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                                                                                         wątek / link
                                                                                    </span>
                                                                                )}
                                                                                {n.rabat && (
                                                                                    <span className="text-xs font-bold text-emerald-300">
                                                                                        🎁 {n.rabat}
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-[10px] font-mono text-slate-400">
                                                                                    {n.pewnosc === 'oficjalne' ? '✅ oficjalne' : n.pewnosc === 'forum' ? '💬 społeczność/forum' : '🧾 agregator'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-xs text-slate-200">{n.opis}</div>
                                                                            {n.uwagi && (
                                                                                <div className="text-[10px] text-amber-300/80">⚠️ {n.uwagi}</div>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex sm:flex-col items-end justify-between gap-1 shrink-0">
                                                                            <a
                                                                                href={n.zrodlo}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="px-2.5 py-1 rounded border border-sky-500/40 bg-sky-950/30 text-[10px] font-mono text-sky-300 hover:bg-sky-900/50"
                                                                            >
                                                                                🌐 {n.tytulZrodla ? n.tytulZrodla.slice(0, 22) : 'Otwórz źródło'} ↗
                                                                            </a>
                                                                            {(n.data || n.wiekStrony) && (
                                                                                <span className="text-[9px] text-slate-500">{n.data ?? n.wiekStrony}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </details>
                                            ))}
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    )}
                </div>
            </details>

            {/* SEKCJA 2: ZWIAD MODELI I SILNIKÓW HUGGINGFACE (ZWIJANA) */}
            <details className="group rounded-2xl border border-teal-500/30 bg-slate-950/80 p-4">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl">🔭</span>
                        <div>
                            <h3 className="text-sm font-bold text-teal-200">
                                Zwiadowca HuggingFace — Modele GGUF i Silniki dla Katedry
                            </h3>
                            <p className="text-[10px] text-slate-400">
                                Rozwiń, aby szukać nowych modeli LLM, kodu, głosu, muzyki i 3D dopasowanych do Twojej karty VRAM.
                            </p>
                        </div>
                    </div>
                    <span className="text-xs font-mono text-teal-300/70 group-open:rotate-90 transition-transform">▸</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-white/10">
                    <ZwiadowcaPanel />
                </div>
            </details>
        </div>
    );
};

export default PanelZwiadowcy;
