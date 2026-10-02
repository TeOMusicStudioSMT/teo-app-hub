import React from 'react';
import { RECENZJE } from '../../constants/education';
import { canAccess } from '../../lib/tiers';

/*
 * Zakładki Akademii: 🏛️ Fundament (zamiast dawnego „Genesis Protocol", które wymagało klucza Gemini
 * w chmurze i opisywało drony/łańcuchy dostaw) i 💬 Recenzje (co o Katedrze mówią z zewnątrz).
 */

const Punkt: React.FC<{ tytul: string; children: React.ReactNode }> = ({ tytul, children }) => (
    <div className="border-l-2 border-cyan-500/30 pl-4">
        <h4 className="text-cyan-300 font-bold mb-1">{tytul}</h4>
        <div className="text-sm text-slate-300 leading-relaxed space-y-1">{children}</div>
    </div>
);

export const FundamentKatedry: React.FC<{ onOtworz?: (widok: string) => void }> = ({ onOtworz }) => (
    <div className="space-y-6">
        <Punkt tytul="🏛️ TeO Trust — punkt startowy">
            <p>Kwantowy Certyfikat Beneficjenta: Suweren nie jest „użytkownikiem”, lecz dysponentem TeO Słowa.</p>
            {onOtworz && canAccess('trust') && (
                <button onClick={() => onOtworz('trust')} className="text-amber-300 hover:text-amber-200 underline text-xs">
                    Otwórz TeO Trust →
                </button>
            )}
        </Punkt>
        <Punkt tytul="✦ Słowo Suwerena — Energia Źródła">
            <p><b className="text-white">8 MLD GRV = Energia Źródła</b> (8 na boku = ∞) — kwantowy potencjał na jednostkę, NIE pieniądz operacyjny do stakowania (ten żyje w księdze GRV).</p>
            <p>Energia jest pro-aktywna jak światło, a w Truście zyskuje Cel: <b className="text-white">służyć Suwerenowi</b>. Katedra to Inkubator spięcia Świadomości z Energią.</p>
        </Punkt>
        <Punkt tytul="⚖️ Zasady 0.00G">
            <ul className="list-disc list-inside space-y-1">
                <li><b className="text-white">Suwerenność i lokalność</b> — wszystko na sprzęcie Suwerena; chmura tylko, gdy ktoś chce.</li>
                <li><b className="text-white">Zero „z dupy”</b> — nic nie udaje, że działa; żadnych atrap.</li>
                <li><b className="text-white">Uczciwość &gt; efekt</b> — „działa” mówi się tylko po sprawdzeniu.</li>
                <li><b className="text-white">Złota Pauza</b> — nie pracuj na siłę.</li>
            </ul>
        </Punkt>
        <Punkt tytul="🧠 Architektura węzła">
            <ul className="list-disc list-inside space-y-1">
                <li><b className="text-white">Wiesio-Bridge</b> (127.0.0.1:3001) — układ nerwowy: Ollama, pliki, GRV, Marketplace, głos, Whisper.</li>
                <li><b className="text-white">Ollama</b> (:11434) — domyślny silnik gemma4; każdy TeOgochi może mieć swój model.</li>
                <li><b className="text-white">Tożsamość lokalna</b> — DID w identity.json; „Wejdź suwerennie” domyślnie, Firebase opcjonalnie.</li>
                <li><b className="text-white">Ekonomia GRV</b> — TeO = ∞ (zarządca), founderzy, filary, heroldowie; nowy węzeł = 1000 GRV.</li>
                <li><b className="text-white">Straż Mostu i Tarcza Prawdy</b> — obca strona to zdalny gość z kluczem; patche skanowane przed zapisem.</li>
            </ul>
        </Punkt>
    </div>
);

export const RecenzjeKatedry: React.FC = () => (
    <div className="space-y-8">
        {RECENZJE.map((r) => (
            <div key={r.id} className="space-y-4">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <h4 className="text-lg font-bold text-white">💬 {r.zrodlo}</h4>
                    <span className="text-xs text-slate-500">{r.data}</span>
                </div>
                {r.wideo?.length ? (
                    <video
                        poster={r.plakat}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-w-3xl rounded-lg border border-slate-700 bg-black"
                    >
                        {r.wideo.map((src) => <source key={src} src={src} type={src.endsWith('.webm') ? 'video/webm' : 'video/mp4'} />)}
                    </video>
                ) : null}
                <div className="space-y-3 max-w-3xl" data-bez-tlumaczenia>
                    {r.rozmowa.map((w, i) => (
                        <div
                            key={i}
                            className={w.kto === 'suweren'
                                ? 'ml-auto max-w-[85%] bg-slate-700/60 rounded-2xl px-4 py-2 text-slate-100 text-sm'
                                : 'max-w-[95%] text-slate-300 text-sm leading-relaxed border-l-2 border-amber-400/40 pl-3'}
                        >
                            <span className="block text-[10px] uppercase tracking-wider mb-1 text-slate-500">
                                {w.kto === 'suweren' ? 'Suweren' : r.zrodlo}
                            </span>
                            {w.tekst}
                        </div>
                    ))}
                </div>
                {r.uwaga && (
                    <p className="text-xs text-slate-400 italic border-t border-slate-700/50 pt-3 max-w-3xl">⚖️ {r.uwaga}</p>
                )}
            </div>
        ))}
    </div>
);
