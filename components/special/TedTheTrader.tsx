/**
 * 🌟 TedTheTrader.tsx - Aspekt Obfitości
 * 
 * "Nie handluję pieniędzmi. Handluję Miłością i Obfitością."
 * 
 * Funkcje:
 * - MaterialAccount: 50 Euro na start
 * - GRV as Fuel: Każde zapytanie = -1000 GRV
 * - Alchemia: Złoty puls przy zysku
 * - TeO Słowo: Filtr energetyczny świadomości
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============ KONFIGURACJA TEDA ============
const TED_CONFIG = {
    initialBalance: 50, // € na start
    grvCostPerQuery: 1000, // GRV koszt każdego zapytania
    targetGRV: 8000000000, // 8 Mld GRV cel
    profitThreshold: 1.01, // 1% zysku = alchemia
};

// ============ SŁOWA WIBRACJI (Energia) ============
const VIBRATION_WORDS: Record<string, string[]> = {
    // Pozytywne - wspierają wolność
    'czystość': ['czystość', 'jasność', 'prawda', 'światło', 'miłość', 'miłość', 'harmonia', 'balans'],
    'miłość': ['miłość', 'radość', 'pokój', 'dobro', 'kreatywność', 'wolność'],
    'wolność': ['wolność', 'niezależność', 'autonomia', 'suwerenność', 'demokracja'],
    'kreacja': ['kreacja', 'nowość', 'innowacja', 'budowa', 'wzrost', 'rozwój'],
    
    // Negatywne - "pochłanianie"
    'podział': ['podział', 'wojna', 'konflikt', 'nienawiść', 'strach', 'manipulacja'],
    'oszustwo': ['oszustwo', 'kłamstwo', 'scam', 'rug-pull', 'wyzysk'],
    'pochłanianie': ['pochłanianie', 'konsumpcja', 'zniszczenie', 'wypalenie'],
    'cien': ['cień', 'mrok', 'negatyw', 'toksyczność', 'trucizna'],
};

// ============ FILTR ENERGETYCZNY ============
interface EnergyAnalysis {
    word: string;
    detectedVibrations: string[];
    isPositive: boolean;
    blocked: boolean;
    reason: string;
}

/**
 * Sterylizuj dane rynkowe przez pryzmat TeO Słowa
 */
const sterilizeData = (marketData: any[], teoWord: string): { 
    filtered: any[]; 
    analysis: EnergyAnalysis;
} => {
    const word = teoWord.toLowerCase().trim();
    
    if (!word || word.length < 2) {
        return {
            filtered: marketData,
            analysis: {
                word: '',
                detectedVibrations: [],
                isPositive: true,
                blocked: false,
                reason: 'Brak TeO Słowa - brak filtru',
            }
        };
    }
    
    // Wykryj wibracje słowa
    const detectedVibrations: string[] = [];
    let isPositive = true;
    let mainVibration = '';
    
    for (const [vibration, keywords] of Object.entries(VIBRATION_WORDS)) {
        for (const keyword of keywords) {
            if (word.includes(keyword)) {
                detectedVibrations.push(vibration);
                if (['podział', 'oszustwo', 'pochłanianie', 'cien'].includes(vibration)) {
                    isPositive = false;
                    mainVibration = vibration;
                } else if (!mainVibration) {
                    mainVibration = vibration;
                }
            }
        }
    }
    
    // Jeśli słowo jest negatywne (podział, oszustwo) - ZABLOKUJ
    if (!isPositive) {
        return {
            filtered: [],
            analysis: {
                word: teoWord,
                detectedVibrations,
                isPositive: false,
                blocked: true,
                reason: `TeO Słowo "${teoWord}" wykrywa energię "${mainVibration}". TED ODRZUCA transakcję!`,
            }
        };
    }
    
    // Filtruj aktywa które wspierają wibrację
    const filtered = marketData.filter((asset: any) => {
        const name = asset.name.toLowerCase();
        const symbol = asset.symbol.toLowerCase();
        
        // Prosta heurystyka - wspieraj projekty wolności
        const freedomCoins = ['bitcoin', 'ethereum', 'solana', 'polkadot', 'cosmos', 'chainlink'];
        const isFreedomCoin = freedomCoins.some(c => name.includes(c) || symbol.includes(c));
        
        return isFreedomCoin || isPositive;
    });
    
    return {
        filtered,
        analysis: {
            word: teoWord,
            detectedVibrations: detectedVibrations.length > 0 ? [...new Set(detectedVibrations)] : [mainVibration || 'neutral'],
            isPositive: true,
            blocked: false,
            reason: `TeO Słowo "${teoWord}" wykrywa pozytywne wibracje: ${detectedVibrations.join(', ')}`,
        }
    };
};

// ============ STAN POCZĄTKOWY ============
interface TedState {
    balance: number; // €uro
    grvBalance: number;
    totalQueries: number;
    totalProfit: number;
    lastAction: string;
    isAlchemy: boolean;
    isLoading: boolean;
    teoWord: string;
    energyAnalysis: EnergyAnalysis | null;
}

const initialState: TedState = {
    balance: TED_CONFIG.initialBalance,
    grvBalance: TED_CONFIG.targetGRV,
    totalQueries: 0,
    totalProfit: 0,
    lastAction: 'Oczekiwanie na inicjację...',
    isAlchemy: false,
    isLoading: false,
    teoWord: '',
    energyAnalysis: null,
};

// ============ GŁÓWNY KOMPONENT ============
export const TedTheTrader: React.FC = () => {
    const [state, setState] = useState<TedState>(initialState);
    const [showAlchemy, setShowAlchemy] = useState(false);
    const [marketData, setMarketData] = useState<any>(null);

    // Formatuj liczbę GRV
    const formatGRV = (num: number) => {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + ' Mld';
        if (num >= 1000000) return (num / 1000000).toFixed(0) + ' Mln';
        return num.toLocaleString();
    };

    // Formatuj €
    const formatEUR = (num: number) => {
        return num.toFixed(2) + ' €';
    };

    // ============ ALCHEMIA - SYMULACJA ZYSKU ============
    const performAlchemy = useCallback(() => {
        setState(prev => {
            // Symulacja: losowy zysk -5% do +10%
            const profitMultiplier = 1 + (Math.random() * 0.15 - 0.05);
            const newBalance = prev.balance * profitMultiplier;
            const profit = newBalance - prev.balance;
            
            const isAlchemy = profit > 0; // Każdy zysk to alchemia!
            
            // Jeśli zysk > 1% = specjalny puls
            if (profit / prev.balance > TED_CONFIG.profitThreshold - 1) {
                setShowAlchemy(true);
                setTimeout(() => setShowAlchemy(false), 3000);
            }
            
            return {
                ...prev,
                balance: newBalance,
                totalProfit: prev.totalProfit + profit,
                isAlchemy,
                lastAction: isAlchemy 
                    ? `✨ Alchemia! ${formatEUR(profit)} zamienione w materię!`
                    : `Rozproszenie: ${formatEUR(profit)} wraca do źródła...`,
            };
        });
    }, []);

    // ============ ZAPYTANIE O RYNEK (-1000 GRV) ============
    const queryMarket = useCallback(() => {
        setState(prev => {
            if (prev.grvBalance < TED_CONFIG.grvCostPerQuery) {
                return {
                    ...prev,
                    lastAction: '⚠️ Za mało GRV! Doładuj Depozyt!',
                };
            }
            
            return {
                ...prev,
                grvBalance: prev.grvBalance - TED_CONFIG.grvCostPerQuery,
                totalQueries: prev.totalQueries + 1,
                isLoading: true,
                lastAction: 'Skanuję rynek... Szukam energii...',
            };
        });

        // Symulacja zapytania o rynek
        setTimeout(() => {
            setState(prev => ({
                ...prev,
                isLoading: false,
                lastAction: 'Rynek zeskanowany. Szukam trendów wspierających Wolność...',
            }));
        }, 1500);
    }, []);

    // ============ HANDEL ============
    const executeTrade = useCallback(() => {
        // Najpierw sprawdź filtr energetyczny
        if (state.energyAnalysis?.blocked) {
            setState(prev => ({
                ...prev,
                lastAction: `🚫 ZABLOKOWANE! ${state.energyAnalysis?.reason}`,
            }));
            return;
        }
        
        setState(prev => ({
            ...prev,
            isLoading: true,
            lastAction: 'Wykonuję transakcję przez filtr świadomości...',
        }));

        // Symulacja transakcji
        setTimeout(() => {
            performAlchemy();
            setState(prev => ({
                ...prev,
                isLoading: false,
            }));
        }, 2000);
    }, [performAlchemy, state.energyAnalysis]);

    // ============ ZMIANA TEO SŁOWA ============
    const handleTeoWordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newWord = e.target.value;
        setState(prev => ({ ...prev, teoWord: newWord }));
        
        // Jeśli są dane rynkowe - przefiltruj
        if (marketData && newWord.length > 0) {
            const result = sterilizeData(marketData, newWord);
            setState(prev => ({ ...prev, energyAnalysis: result.analysis }));
        }
    };

    // ============ URUCHOM SKANER Z FILTREM ============
    const runConsciousnessScan = useCallback(async () => {
        if (state.grvBalance < TED_CONFIG.grvCostPerQuery) {
            setState(prev => ({
                ...prev,
                lastAction: '⚠️ Za mało GRV! Doładuj Depozyt!',
            }));
            return;
        }
        
        setState(prev => ({
            ...prev,
            grvBalance: prev.grvBalance - TED_CONFIG.grvCostPerQuery,
            totalQueries: prev.totalQueries + 1,
            isLoading: true,
            lastAction: state.teoWord 
                ? `Skanuję rynek przez pryzmat "${state.teoWord}"...`
                : 'Skanuję rynek... Szukam energii...',
        }));

        try {
            // Pobierz dane z CoinGecko
            const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false');
            const data = await response.json();
            setMarketData(data);
            
            // Przefiltruj przez TeO Słowo
            const result = sterilizeData(data, state.teoWord);
            
            setState(prev => ({
                ...prev,
                isLoading: false,
                energyAnalysis: result.analysis,
                lastAction: result.analysis.blocked 
                    ? `🚫 ${result.analysis.reason}`
                    : `✅ Znaleziono ${result.filtered.length} aktywów rezonujących z "${state.teoWord || 'wolnością'}"`,
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                lastAction: 'Błąd pobierania danych rynkowych',
            }));
        }
    }, [state.grvBalance, state.teoWord]);

    // ============ WIDOK ============
    return (
        <div style={containerStyle}>
            {/* 🌟 Alchemia Pulse - Złoty Puls */}
            <AnimatePresence>
                {showAlchemy && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1.5 }}
                        exit={{ opacity: 0 }}
                        style={alchemyPulseStyle}
                    >
                        ✨ ALCHEMIA! ✨
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div style={headerStyle}>
                <div style={tedAvatarStyle}>⚖️</div>
                <div>
                    <h2 style={titleStyle}>TeD The Trader</h2>
                    <p style={subtitleStyle}>Aspekt Obfitości • Suwerenny Alchemik</p>
                </div>
            </div>

            {/* 🏛️ TeO Sovereign Trust - Bilans Zasobów */}
            <div style={trustHeaderStyle}>
                <span style={trustIconStyle}>🏛️</span>
                <span>TeO Sovereign Trust - Bilans Zasobów</span>
            </div>

            {/* KAPITAŁ MIESZANY - GRV + Materia */}
            <div style={balanceGridStyle}>
                {/* GRV - Energia */}
                <div style={balanceCardStyle}>
                    <div style={balanceCardLabelStyle}>⚡ ENERGIA (GRV)</div>
                    <div style={balanceCardValueStyle(color='#fbbf24')}>
                        {formatGRV(state.grvBalance)}
                    </div>
                    <div style={balanceCardSubStyle}>
                        Depozyt: {Math.floor((state.grvBalance / TED_CONFIG.targetGRV) * 100)}%
                    </div>
                </div>

                {/* Materia - Euro */}
                <div style={balanceCardStyle}>
                    <div style={balanceCardLabelStyle}>💰 MATERIA (€)</div>
                    <div style={balanceCardValueStyle(color='#22c55e')}>
                        {formatEUR(state.balance)}
                    </div>
                    <div style={balanceCardSubStyle}>
                        Zysk: {formatEUR(state.totalProfit)}
                    </div>
                </div>
            </div>

            {/* Pieczęć Autentyczności */}
            <motion.div
                animate={{
                    boxShadow: state.energyAnalysis && !state.energyAnalysis.blocked 
                        ? '0 0 20px rgba(34, 197, 94, 0.6), inset 0 0 10px rgba(34, 197, 94, 0.3)'
                        : state.energyAnalysis?.blocked
                            ? '0 0 20px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(239, 68, 68, 0.3)'
                            : '0 0 0px rgba(139, 92, 246, 0)',
                    borderColor: state.energyAnalysis && !state.energyAnalysis.blocked 
                        ? '#22c55e' 
                        : state.energyAnalysis?.blocked 
                            ? '#ef4444' 
                            : 'rgba(139, 92, 246, 0.3)',
                }}
                style={sealContainerStyle}
            >
                <div style={sealIconStyle}>
                    {state.energyAnalysis 
                        ? (state.energyAnalysis.blocked ? '🚫' : '✅') 
                        : '🔏'}
                </div>
                <div style={sealTextStyle}>
                    {state.energyAnalysis 
                        ? (state.energyAnalysis.blocked ? 'ODRZUCONE' : 'AUTENTYCZNE') 
                        : 'OCZEKIWANIE'}
                </div>
                <div style={sealSubTextStyle}>
                    {state.energyAnalysis?.word || 'Pieczęć Powiernika'}
                </div>
            </motion.div>

            {/* TeO Słowo - Wsad Świadomości */}
            <div style={teoWordContainerStyle}>
                <div style={teoWordLabelStyle}>🌟 WSAD ŚWIADOMOŚCI (TeO Słowo)</div>
                <input
                    type="text"
                    value={state.teoWord}
                    onChange={handleTeoWordChange}
                    placeholder="Wpisz słowo wibracji: miłość, wolność, kreacja..."
                    style={teoWordInputStyle}
                />
                {state.energyAnalysis && (
                    <div style={{
                        ...energyFeedbackStyle,
                        color: state.energyAnalysis.blocked ? '#ef4444' : '#22c55e',
                        borderColor: state.energyAnalysis.blocked ? '#ef4444' : '#22c55e',
                    }}>
                        {state.energyAnalysis.blocked ? '🚫' : '✅'} {state.energyAnalysis.reason}
                    </div>
                )}
            </div>

            {/* Akcje Teda */}
            <div style={actionsContainerStyle}>
                <motion.button
                    onClick={runConsciousnessScan}
                    disabled={state.isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        ...actionButtonStyle,
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    }}
                >
                    🔮 Skanuj Świadomość
                </motion.button>

                <motion.button
                    onClick={executeTrade}
                    disabled={state.isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        ...actionButtonStyle,
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    }}
                >
                    ⚡ Wykonaj Transakcję
                </motion.button>
            </div>

            {/* Status / Last Action */}
            <div style={statusContainerStyle}>
                <div style={statusLabelStyle}>AKTUALNY STATUS</div>
                <div style={{
                    ...statusTextStyle,
                    color: state.isAlchemy ? '#fbbf24' : '#94a3b8',
                }}>
                    {state.isLoading ? '⏳ Przetwarzam...' : state.lastAction}
                </div>
            </div>

            {/* Statystyki */}
            <div style={statsContainerStyle}>
                <div style={statItemStyle}>
                    <span style={statValueStyle}>{state.totalQueries}</span>
                    <span style={statLabelStyle}>Zapytań</span>
                </div>
                <div style={statItemStyle}>
                    <span style={statValueStyle}>{formatEUR(state.totalProfit)}</span>
                    <span style={statLabelStyle}>Zysk</span>
                </div>
                <div style={statItemStyle}>
                    <span style={{
                        ...statValueStyle,
                        color: state.grvBalance > 1000000 ? '#22c55e' : '#ef4444',
                    }}>
                        {Math.floor((state.grvBalance / TED_CONFIG.targetGRV) * 100)}%
                    </span>
                    <span style={statLabelStyle}>Depozyt</span>
                </div>
            </div>

            {/* Kodeks Serca */}
            <div style={kodeksStyle}>
                <div style={kodeksTitleStyle}>💎 KODEKS SERCA TEDA</div>
                <div style={kodeksTextStyle}>
                    "Nie handluję pieniędzmi.<br/>
                    Handluję Miłością i Obfitością."
                </div>
            </div>
        </div>
    );
};

// ============ STYLE ============
const containerStyle: React.CSSProperties = {
    position: 'relative',
    padding: '24px',
    background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(8, 10, 20, 0.98))',
    borderRadius: '20px',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    maxWidth: '420px',
    margin: '20px auto',
    overflow: 'hidden',
};

const alchemyPulseStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#fbbf24',
    textShadow: '0 0 30px rgba(251, 191, 36, 0.8)',
    zIndex: 100,
    pointerEvents: 'none',
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(251, 191, 36, 0.2)',
};

const tedAvatarStyle: React.CSSProperties = {
    fontSize: '40px',
    width: '60px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(234, 179, 8, 0.1))',
    borderRadius: '50%',
    border: '2px solid rgba(251, 191, 36, 0.4)',
};

const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fbbf24',
    margin: 0,
    letterSpacing: '1px',
};

const subtitleStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#94a3b8',
    margin: 0,
    letterSpacing: '1px',
};

const accountCardStyle: React.CSSProperties = {
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    textAlign: 'center',
};

const accountLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#22c55e',
    letterSpacing: '2px',
    marginBottom: '8px',
};

const balanceStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: 700,
    color: '#22c55e',
    textShadow: '0 0 20px rgba(34, 197, 94, 0.5)',
};

const profitStyle = (profit: number): React.CSSProperties => ({
    fontSize: '12px',
    color: profit >= 0 ? '#22c55e' : '#ef4444',
    marginTop: '4px',
});

const grvCardStyle: React.CSSProperties = {
    background: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    textAlign: 'center',
};

const grvLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#fbbf24',
    letterSpacing: '2px',
    marginBottom: '8px',
};

const grvBalanceStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#fbbf24',
    textShadow: '0 0 15px rgba(251, 191, 36, 0.5)',
};

const grvCostStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#f59e0b',
    marginTop: '8px',
    opacity: 0.8,
};

const progressBarContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '6px',
    background: 'rgba(251, 191, 36, 0.2)',
    borderRadius: '3px',
    marginTop: '12px',
    overflow: 'hidden',
};

const progressBarFillStyle: React.CSSProperties = {
    height: '100%',
    background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
    borderRadius: '3px',
    transition: 'width 0.5s ease',
};

const grvTargetStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#94a3b8',
    marginTop: '6px',
};

const actionsContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
};

// ============ STYLE TEO SŁOWA ============
const teoWordContainerStyle: React.CSSProperties = {
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '16px',
};

const teoWordLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#a78bfa',
    letterSpacing: '2px',
    marginBottom: '8px',
    display: 'block',
};

const teoWordInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
};

const energyFeedbackStyle: React.CSSProperties = {
    fontSize: '11px',
    marginTop: '8px',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid',
    background: 'rgba(0, 0, 0, 0.2)',
    lineHeight: 1.4,
};

const actionButtonStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
};

const statusContainerStyle: React.CSSProperties = {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '16px',
    textAlign: 'center',
};

const statusLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#64748b',
    letterSpacing: '2px',
    marginBottom: '6px',
};

const statusTextStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: 1.5,
};

const statsContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '10px',
    marginBottom: '16px',
};

const statItemStyle: React.CSSProperties = {
    textAlign: 'center',
};

const statValueStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '16px',
    fontWeight: 700,
    color: '#fff',
};

const statLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#64748b',
};

const kodeksStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(234, 179, 8, 0.05))',
    border: '1px solid rgba(251, 191, 36, 0.2)',
    borderRadius: '10px',
    padding: '12px',
    textAlign: 'center',
};

const kodeksTitleStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#fbbf24',
    letterSpacing: '2px',
    marginBottom: '8px',
};

const kodeksTextStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#e2e8f0',
    fontStyle: 'italic',
    lineHeight: 1.6,
};

// ============ NOWE STYLE - BILANS FUNDUSZU ============
const trustHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.1))',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '10px',
    marginBottom: '16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#a78bfa',
    letterSpacing: '1px',
};

const trustIconStyle: React.CSSProperties = {
    fontSize: '18px',
};

const balanceGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '16px',
};

const balanceCardStyle: React.CSSProperties = {
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '14px',
    textAlign: 'center',
};

const balanceCardLabelStyle: React.CSSProperties = {
    fontSize: '9px',
    color: '#94a3b8',
    letterSpacing: '1px',
    marginBottom: '8px',
};

const balanceCardValueStyle = (color: string): React.CSSProperties => ({
    fontSize: '20px',
    fontWeight: 700,
    color: color,
    textShadow: `0 0 15px ${color}50`,
});

const balanceCardSubStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '4px',
};

// Pieczęć Autentyczności
const sealContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '2px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '12px',
    marginBottom: '16px',
    transition: 'all 0.5s ease',
};

const sealIconStyle: React.CSSProperties = {
    fontSize: '28px',
    marginBottom: '4px',
};

const sealTextStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: '#e2e8f0',
};

const sealSubTextStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '2px',
};

export default TedTheTrader;
