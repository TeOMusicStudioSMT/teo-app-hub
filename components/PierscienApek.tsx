/**
 * 💍 Pierścień apek — studia Katedry jako warstwy w oknie Huba + koło przełączania z boku (lib/pierscien.ts).
 *
 * Warstwa apki wjeżdża z boku (jak przejście na otakos.wtf) i żyje w tle po powrocie do Huba.
 * Koło po LEWEJ (Suweren 2026-10-07: „przenieśmy menu na drugą stronę” — po prawej są bąble Huba):
 * 🏛️ Hub + każda otwarta apka; ↻ przeładuj, ↗ do osobnej karty, ✕ zamknij; „+” = narzędzia Katedry
 * (ComfyUI, VoiceStudio, Świat klocków — „i tym podobne apki, z których korzysta Katedra”).
 * Alt+PageUp / Alt+PageDown — poprzednia / następna (gdy fokus jest w Hubie albo na kole).
 */
import React, { useEffect, useState } from 'react';
import { stanPierscienia, sluchajPierscienia, pokazApke, pokazHub, zamknijApke, przewin, otworzApke, przeladujApke } from '../lib/pierscien';

// Mikrofon (Sampler głosu), schowek (Ctrl+V zrzutów), dźwięk, pełny ekran — apki Katedry z nich korzystają.
const POZWOLENIA = 'microphone; camera; clipboard-read; clipboard-write; autoplay; fullscreen; display-capture';
const MOST = 'http://127.0.0.1:3001';

/** Czy pod adresem coś odpowiada (bez CORS — wystarczy, że połączenie nie zostało odrzucone). */
async function zyje(adres: string): Promise<boolean> {
    try { await fetch(adres, { mode: 'no-cors', signal: AbortSignal.timeout(2500) }); return true; } catch { return false; }
}

interface Narzedzie { id: string; tytul: string; url: string; znak: string; kolor: string; obudz?: () => Promise<string | null>; sprawdz: string }
const NARZEDZIA: Narzedzie[] = [
    {
        id: 'comfy', tytul: 'ComfyUI', url: 'http://127.0.0.1:8188/', znak: '🎛️', kolor: '#f97316', sprawdz: 'http://127.0.0.1:8188/system_stats',
        // Śpi → most go budzi (bez okna konsoli i bez własnej przeglądarki) i czekamy, aż wstanie.
        obudz: async () => {
            await fetch(`${MOST}/api/comfy/ensure`, { method: 'POST' }).catch(() => null);
            for (let i = 0; i < 60; i++) { if (await zyje('http://127.0.0.1:8188/system_stats')) return null; await new Promise((r) => setTimeout(r, 2500)); }
            return 'ComfyUI nie wstał w 150 s — dziennik: _OtakOs_AI/comfyui.log.';
        },
    },
    { id: 'voicestudio', tytul: 'VoiceStudio', url: 'http://127.0.0.1:3900/', znak: '🎙️', kolor: '#14b8a6', sprawdz: 'http://127.0.0.1:3900/' },
    { id: 'swiat', tytul: 'Świat klocków', url: `${MOST}/swiat/`, znak: '🧱', kolor: '#38bdf8', sprawdz: `${MOST}/swiat/` },
];

export const PierscienApek: React.FC = () => {
    const [s, setS] = useState(stanPierscienia());
    const [menu, setMenu] = useState(false);
    const [praca, setPraca] = useState<string | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    useEffect(() => sluchajPierscienia(setS), []);
    useEffect(() => {
        const k = (e: KeyboardEvent) => {
            if (!e.altKey || (e.key !== 'PageDown' && e.key !== 'PageUp')) return;
            e.preventDefault(); przewin(e.key === 'PageDown' ? 1 : -1);
        };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, []);

    const otworzNarzedzie = async (n: Narzedzie) => {
        setMenu(false); setBlad(null); setPraca(n.id);
        try {
            if (!(await zyje(n.sprawdz))) {
                const powod = n.obudz ? await n.obudz() : `${n.tytul} nie działa (${n.url}) — uruchom go najpierw.`;
                if (powod) { setBlad(powod); return; }
            }
            otworzApke({ id: n.id, tytul: n.tytul, url: n.url, znak: n.znak, kolor: n.kolor });
        } finally { setPraca(null); }
    };

    return (
        <>
            {/* Warstwy apek — tylko wczytane; aktywna na wierzchu, reszta schowana za krawędzią. */}
            {s.apki.length > 0 && (
                <div className="fixed inset-0 z-[9000] overflow-hidden" style={{ pointerEvents: s.aktywna ? 'auto' : 'none' }}>
                    {s.apki.filter((a) => a.wczytana).map((a) => {
                        const widac = a.id === s.aktywna;
                        return (
                            <div key={a.id} className="absolute inset-0 bg-black"
                                style={{ transform: widac ? 'translateX(0)' : 'translateX(104%)', transition: 'transform 420ms cubic-bezier(.2,.8,.2,1), visibility 0s linear ' + (widac ? '0s' : '420ms'), visibility: widac ? 'visible' : 'hidden', boxShadow: widac ? `-24px 0 60px ${a.kolor}33` : 'none' }}>
                                <iframe key={`${a.id}-${a.wersja ?? 0}`} src={a.url} title={a.tytul} allow={POZWOLENIA} className="h-full w-full border-0" />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Koło przełączania — LEWA krawędź, nad wszystkim. */}
            <nav aria-label="Otwarte apki Katedry" className="fixed left-2 top-1/2 z-[9600] flex -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-white/10 bg-black/55 p-1.5 backdrop-blur-md">
                <Kolko znak="🏛️" tytul="Hub Katedry" kolor="#eab308" aktywne={!s.aktywna} onClick={pokazHub} />
                {s.apki.map((a) => (
                    <div key={a.id} className="group relative">
                        <Kolko znak={a.znak} tytul={a.tytul} kolor={a.kolor} aktywne={a.id === s.aktywna} uspiona={!a.wczytana} onClick={() => pokazApke(a.id)} />
                        <div className="pointer-events-none absolute left-full top-1/2 ml-2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-2 py-1 text-[11px] text-white/90 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
                            <span>{a.tytul}{!a.wczytana ? ' · śpi' : ''}</span>
                            <button title="Przeładuj (np. gdy studio wstało później niż okno)" onClick={() => przeladujApke(a.id)} className="rounded px-1 text-white/60 hover:bg-white/10 hover:text-white">↻</button>
                            <button title="Otwórz w osobnej karcie" onClick={() => { window.open(a.url, '_blank', 'noopener'); zamknijApke(a.id); }} className="rounded px-1 text-white/60 hover:bg-white/10 hover:text-white">↗</button>
                            <button title="Zamknij apkę" onClick={() => zamknijApke(a.id)} className="rounded px-1 text-rose-300/80 hover:bg-rose-500/20 hover:text-rose-200">✕</button>
                        </div>
                    </div>
                ))}
                <div className="relative">
                    <button onClick={() => setMenu((m) => !m)} title="Narzędzia Katedry w pierścieniu" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/70 hover:border-white/50 hover:text-white">{praca ? '⟳' : '+'}</button>
                    {menu && (
                        <div className="absolute left-full top-1/2 ml-2 w-44 -translate-y-1/2 space-y-1 rounded-xl border border-white/10 bg-black/90 p-2 text-[12px] text-white/90">
                            {NARZEDZIA.map((n) => (
                                <button key={n.id} onClick={() => void otworzNarzedzie(n)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/10">{n.znak} {n.tytul}</button>
                            ))}
                        </div>
                    )}
                </div>
            </nav>
            {(praca || blad) && (
                <div className="fixed bottom-6 left-16 z-[9600] max-w-sm rounded-lg border border-white/10 bg-black/85 px-3 py-2 text-xs text-white/90">
                    {praca ? `Budzę ${NARZEDZIA.find((n) => n.id === praca)?.tytul ?? praca}… (pierwszy start chwilę trwa)` : blad}
                    {blad && <button onClick={() => setBlad(null)} className="ml-2 text-white/50">✕</button>}
                </div>
            )}
        </>
    );
};

const Kolko: React.FC<{ znak: string; tytul: string; kolor: string; aktywne: boolean; uspiona?: boolean; onClick: () => void }> = ({ znak, tytul, kolor, aktywne, uspiona, onClick }) => (
    <button onClick={onClick} title={tytul} aria-current={aktywne}
        className="flex h-10 w-10 items-center justify-center rounded-full text-lg transition hover:scale-110"
        style={{ border: `2px solid ${aktywne ? kolor : kolor + '55'}`, background: aktywne ? kolor + '33' : 'rgba(0,0,0,.4)', boxShadow: aktywne ? `0 0 14px ${kolor}aa` : 'none', opacity: uspiona ? 0.55 : 1 }}>
        {znak}
    </button>
);

export default PierscienApek;
