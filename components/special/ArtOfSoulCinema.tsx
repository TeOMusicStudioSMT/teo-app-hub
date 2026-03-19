import React, { useState } from 'react';

interface CinemaProps {
    isOpen: boolean;
    onClose: () => void;
}

const PLAYLISTS = {
    muzyka: 'PLGy1K1HrDg0goxBHv8oVijtdCwzLhPp1z',
    podcastyPL: 'PLGy1K1HrDg0gzeeXtCFp6w9WbD5jMVtfB',
    podcastyEN: 'PLGy1K1HrDg0jXH9z3vDVpoVz_oUryDJ_W',
    filmy: 'PLGy1K1HrDg0iPHgkru3YZ_7eVCPm_atQS'
};

type TabType = 'muzyka' | 'podcasty' | 'filmy';
type LangType = 'PL' | 'EN';

export const ArtOfSoulCinema: React.FC<CinemaProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<TabType>('muzyka');
    const [podcastLang, setPodcastLang] = useState<LangType>('PL');

    if (!isOpen) return null;

    let activeUrl = PLAYLISTS.muzyka;
    if (activeTab === 'podcasty') {
        activeUrl = podcastLang === 'PL' ? PLAYLISTS.podcastyPL : PLAYLISTS.podcastyEN;
    } else if (activeTab === 'filmy') {
        activeUrl = PLAYLISTS.filmy;
    }

    return (
        // Z-INDEX [9999] FIX: Tytanowa tarcza, nic z tła już nie prześwituje!
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="relative w-full max-w-6xl aspect-video bg-gray-900 border border-indigo-500/40 rounded-2xl shadow-[0_0_40px_rgba(99,102,241,0.25)] flex flex-col overflow-hidden">
                
                {/* Pasek Nawigacji Kina */}
                <div className="h-14 bg-gray-950 border-b border-indigo-500/20 flex items-center justify-between px-6 z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="text-indigo-300 font-semibold tracking-widest mr-4">📺 ArtOfSoul TV</span>
                        
                        {/* 🎵 Tab: Muzyka */}
                        <button
                            onClick={() => setActiveTab('muzyka')}
                            className={`px-3 py-1 text-xs md:text-sm rounded-full transition-all ${activeTab === 'muzyka' ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.6)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        >
                            🎵 Muzyka
                        </button>

                        {/* 🎙️ Tab: Podcasty (z wbudowanym przełącznikiem języka) */}
                        <div className={`flex items-center rounded-full transition-all ${activeTab === 'podcasty' ? 'bg-indigo-600 p-1 shadow-[0_0_10px_rgba(79,70,229,0.6)]' : 'bg-gray-800 p-1'}`}>
                            <button
                                onClick={() => setActiveTab('podcasty')}
                                className={`px-3 py-1 text-xs md:text-sm rounded-full transition-all ${activeTab === 'podcasty' ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}
                            >
                                🎙️ Podcasty
                            </button>
                            {activeTab === 'podcasty' && (
                                <div className="flex bg-gray-900 rounded-full ml-1 overflow-hidden border border-indigo-400/30">
                                    <button onClick={() => setPodcastLang('PL')} className={`px-2 py-0.5 text-xs font-bold transition-colors ${podcastLang === 'PL' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}>PL</button>
                                    <button onClick={() => setPodcastLang('EN')} className={`px-2 py-0.5 text-xs font-bold transition-colors ${podcastLang === 'EN' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}>EN</button>
                                </div>
                            )}
                        </div>

                        {/* 🎬 Tab: Filmy */}
                        <button
                            onClick={() => setActiveTab('filmy')}
                            className={`px-3 py-1 text-xs md:text-sm rounded-full transition-all ${activeTab === 'filmy' ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.6)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        >
                            🎬 Filmy
                        </button>

                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-400 text-3xl font-light leading-none transition-colors">×</button>
                </div>

                {/* Ekran (Iframe) */}
                <div className="flex-1 bg-black w-full relative">
                    <iframe 
                        key={activeUrl} // Wymusza przeładowanie Iframe przy zmianie języka/kategorii
                        className="absolute top-0 left-0 w-full h-full"
                        src={`https://www.youtube.com/embed/videoseries?list=${activeUrl}`} 
                        title="ArtOfSoulTV Player" 
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
        </div>
    );
};
