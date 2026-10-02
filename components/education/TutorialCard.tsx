import React from 'react';
import { Tutorial } from '../../types';
import { canAccess, requiredPillar } from '../../lib/tiers';

interface TutorialCardProps {
    tutorial: Tutorial;
    /** Otwiera widok Hubu, o którym mówi przewodnik (gdy ma `widok`). */
    onOtworz?: (widok: string) => void;
}

/** Przewodnik po prawdziwym ekranie Katedry: kroki + przycisk do tego ekranu. */
export const TutorialCard: React.FC<TutorialCardProps> = ({ tutorial, onOtworz }) => (
    <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
                <h4 className="text-lg font-bold text-white">{tutorial.title}</h4>
                <p className="text-sm text-slate-400 mt-1">{tutorial.description}</p>
            </div>
            {/* Ten sam filar co w menu „•••” — przewodnik nie omija bramki */}
            {tutorial.widok && onOtworz && (canAccess(tutorial.widok) ? (
                <button
                    onClick={() => onOtworz(tutorial.widok!)}
                    className="capsule-button capsule-cyan py-2 px-5 flex-shrink-0"
                >
                    Otwórz →
                </button>
            ) : (
                <span className="text-xs text-slate-500 flex-shrink-0">🔒 Odblokujesz na Filarze {requiredPillar(tutorial.widok)}</span>
            ))}
        </div>
        <ol className="mt-3 pt-3 border-t border-slate-700/50 space-y-2 text-sm text-slate-300 list-decimal list-inside">
            {tutorial.steps.map((krok, i) => <li key={i}>{krok}</li>)}
        </ol>
    </div>
);
