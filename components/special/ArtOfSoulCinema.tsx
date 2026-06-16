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

type TabType = 'muzyka' | 'podcasty' | 'filmy' | 'laboratorium';
type LangType = 'PL' | 'EN';

export const ArtOfSoulCinema: React.FC<CinemaProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<TabType>('muzyka');
    const [podcastLang, setPodcastLang] = useState<LangType>('PL');
    const [localPremiere, setLocalPremiere] = useState<{file: string, metadata: string, metadataFile: string | null} | null>(null);

    React.useEffect(() => {
        if (activeTab === 'laboratorium') {
            fetch('http://127.0.0.1:3001/wiesio/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'GET_LOCAL_PREMIERE' })
            }).then(res => res.json()).then(data => {
                if (data.file) setLocalPremiere(data);
            }).catch(e => console.error("Błąd laboratorium:", e));
        }
    }, [activeTab]);

    const handleFlush = async () => {
        if (!localPremiere) return;
        if (window.confirm("Na pewno chcesz spłukać (SKASOWAĆ) to nagranie i opis?")) {
            try {
                const res = await fetch('http://127.0.0.1:3001/wiesio/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'DELETE_LOCAL_PREMIERE', 
                        payload: { video: localPremiere.file, metadata: localPremiere.metadataFile }
                    })
                });
                if (res.ok) {
                    setLocalPremiere(null); // Czyścimy widok
                }
            } catch (e) {
                console.error("Błąd spłuczki:", e);
            }
        }
    };

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

                        <button
                            onClick={() => setActiveTab('laboratorium')}
                            className={`px-3 py-1 text-xs md:text-sm rounded-full transition-all ${activeTab === 'laboratorium' ? 'bg-fuchsia-600 text-white shadow-[0_0_10px_rgba(217,70,239,0.6)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        >
                            🧪 Laboratorium (Lokalnie)
                        </button>

                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-400 text-3xl font-light leading-none transition-colors">×</button>
                </div>

                {/* Ekran */}
                <div className="flex-1 bg-black w-full relative flex">
                    {activeTab === 'laboratorium' ? (
                        localPremiere ? (
                            <div className="flex w-full h-full">
                                {/* Lewa: Lokalny Odtwarzacz Wideo */}
                                <div className="w-2/3 h-full bg-black flex items-center justify-center border-r border-fuchsia-500/20">
                                    <video 
                                        src={`http://127.0.0.1:3001/move/${encodeURIComponent(localPremiere.file)}`} 
                                        controls 
                                        className="w-full max-h-full"
                                    />
                                </div>
                                {/* Prawa: Zapisana Pieczęć (Opis) */}
                                <div className="w-1/3 h-full bg-gray-900 p-6 overflow-y-auto">
                                    <div className="flex justify-between items-center border-b border-fuchsia-500/30 pb-2 mb-4">
                                        <h3 className="text-fuchsia-400 font-bold tracking-wider">📜 PIECZĘĆ ALCHEMIKA</h3>
                                        <button 
                                            onClick={handleFlush} 
                                            className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-all bg-red-900/20 px-2 py-1 rounded border border-red-500/30"
                                        >
                                            🚽 Spłucz Ujęcie
                                        </button>
                                    </div>
                                    <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                                        {localPremiere.metadata}
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                Brak lokalnych premier w folderze _OtakOs_Move.
                            </div>
                        )
                    ) : (
                        <iframe 
                            key={activeUrl} // Wymusza przeładowanie Iframe przy zmianie języka/kategorii
                            className="absolute top-0 left-0 w-full h-full"
                            src={`https://www.youtube.com/embed/videoseries?list=${activeUrl}`} 
                            title="ArtOfSoulTV Player" 
                            frameBorder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen
                        ></iframe>
                    )}
                </div>
            </div>
        </div>
    );
};
