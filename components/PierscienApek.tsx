/**
 * 💍 Pierścień apek — studia Katedry jako warstwy w oknie Huba + koło przełączania z boku (lib/pierscien.ts).
 *
 * Warstwa apki wjeżdża z boku (jak przejście na otakos.wtf) i żyje w tle po powrocie do Huba.
 * Koło po prawej: 🏛️ Hub + każda otwarta apka; ✕ zamyka, ↗ wyrzuca do osobnej karty.
 * Alt+PageUp / Alt+PageDown — poprzednia / następna (gdy fokus jest w Hubie albo na kole).
 */
import React, { useEffect, useState } from 'react';
import { stanPierscienia, sluchajPierscienia, pokazApke, pokazHub, zamknijApke, przewin } from '../lib/pierscien';

// Mikrofon (Sampler głosu), schowek (Ctrl+V zrzutów), dźwięk, pełny ekran — apki Katedry z nich korzystają.
const POZWOLENIA = 'microphone; camera; clipboard-read; clipboard-write; autoplay; fullscreen; display-capture';

export const PierscienApek: React.FC = () => {
    const [s, setS] = useState(stanPierscienia());
    useEffect(() => sluchajPierscienia(setS), []);
    useEffect(() => {
        const k = (e: KeyboardEvent) => {
            if (!e.altKey || (e.key !== 'PageDown' && e.key !== 'PageUp')) return;
            e.preventDefault(); przewin(e.key === 'PageDown' ? 1 : -1);
        };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, []);
    if (!s.apki.length) return null;

    return (
        <>
            {/* Warstwy apek — tylko wczytane; aktywna na wierzchu, reszta schowana za prawą krawędzią. */}
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

            {/* Koło przełączania — prawa krawędź, nad wszystkim. */}
            <nav aria-label="Otwarte apki Katedry" className="fixed right-2 top-1/2 z-[9600] flex -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-white/10 bg-black/55 p-1.5 backdrop-blur-md">
                <Kolko znak="🏛️" tytul="Hub Katedry" kolor="#eab308" aktywne={!s.aktywna} onClick={pokazHub} />
                {s.apki.map((a) => (
                    <div key={a.id} className="group relative">
                        <Kolko znak={a.znak} tytul={a.tytul} kolor={a.kolor} aktywne={a.id === s.aktywna} uspiona={!a.wczytana} onClick={() => pokazApke(a.id)} />
                        <div className="pointer-events-none absolute right-full top-1/2 mr-2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-2 py-1 text-[11px] text-white/90 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
                            <span>{a.tytul}{!a.wczytana ? ' · śpi' : ''}</span>
                            <button title="Otwórz w osobnej karcie" onClick={() => { window.open(a.url, '_blank', 'noopener'); zamknijApke(a.id); }} className="rounded px-1 text-white/60 hover:bg-white/10 hover:text-white">↗</button>
                            <button title="Zamknij apkę" onClick={() => zamknijApke(a.id)} className="rounded px-1 text-rose-300/80 hover:bg-rose-500/20 hover:text-rose-200">✕</button>
                        </div>
                    </div>
                ))}
            </nav>
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
