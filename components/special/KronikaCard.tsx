// src/components/special/KronikaCard.tsx
import React from 'react';
import { KronikaEntry } from '../../store/kronikaStore';

interface KronikaCardProps {
    entry: KronikaEntry;
}

const getAuraClass = (aura: string) => {
    switch (aura) {
        case "cyan": return "border-cyan-400 shadow-cyan-500/50";
        case "magenta": return "border-fuchsia-400 shadow-fuchsia-500/50";
        case "gold": return "border-yellow-500 shadow-yellow-500/50";
        default: return "border-gray-600";
    }
};

const KronikaCard: React.FC<KronikaCardProps> = ({ entry }) => {
    const cardClass = `p-6 bg-gray-800/70 border-l-4 transition duration-300 hover:ring-2 ring-cyan-500 cursor-pointer ${getAuraClass(entry.aura)}`;

    return (
        <div className={cardClass}>
            {/* Nagłówek + Punkty */}
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-2xl font-mono text-white uppercase tracking-wider">{entry.title}</h3>
                <span className={`text-lg px-4 py-1 rounded-full ${entry.xp > 0 ? 'bg-green-600/70' : 'bg-gray-700'} text-yellow-300 font-bold animate-pulse`}>
                    [GRV: {entry.xp}]
                </span>
            </div>

            {/* Wizualizacje Wideo */}
            {entry.videoUrl && (
                <div className="mb-4 border border-gray-700 rounded-md overflow-hidden">
                    <video 
                        src={entry.videoUrl} // Tutaj odbywa się magiczna obsługa ścieżki lokalnej
                        controls 
                        className="w-full h-auto max-h-64" 
                        poster="/placeholder_video.jpg"
                    >
                        Twoja przeglądarka nie obsługuje tagu video.
                    </video>
                </div>
            )}

            {/* Narracja */}
            <p className="text-gray-300 mb-6 text-sm italic leading-relaxed">{entry.narrative}</p>

            {/* Sekcja Komentarzy Agentów (Dynamic Feedback) */}
            <div className="mt-auto pt-4 border-t border-gray-700">
                <h4 className="text-md font-mono text-cyan-500 mb-2 uppercase tracking-wider">// FEEDBACK AGENTÓW</h4>
                <ul className="space-y-2 text-xs">
                    {entry.comments.map((comment, index) => (
                        <li key={index} className="flex items-start">
                            <span className={`mr-2 font-bold uppercase ${comment.agent === 'Adamus' ? 'text-yellow-400' : comment.agent === 'Bella' ? 'text-pink-400' : 'text-lime-400'}`}>
                                [{comment.agent}]
                            </span>
                            <span className="flex-1 text-gray-200">{comment.text}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default KronikaCard;
