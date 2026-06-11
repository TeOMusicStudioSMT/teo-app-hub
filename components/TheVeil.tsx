import React, { useEffect, useState } from 'react';
import { useRoastingContext, AnalysisResult } from '../context/roastingContext';

/**
 * Component: TheVeil — Warstwa Interpretacyjna (Operational Consciousness UI)
 * Funkcja: Wizualizacja pracy Maszyny Stanów, Middleware i Chronosa.
 * Cel: Świadomość złożonego procesu stojącego za zwykłą transmisją danych.
 */
const TheVeil: React.FC = () => {
    const { lastAnalysisResult, isAnalyzing, state, currentLevel, isSingularityProtocolActive } = useRoastingContext();

    const [analysisOutput, setAnalysisOutput] = useState<AnalysisResult | null>(null);

    useEffect(() => {
        if (lastAnalysisResult) {
            setAnalysisOutput(lastAnalysisResult);
        } else if (!isAnalyzing) {
            // Stan domyślny, gdy system pracuje w tle
            setAnalysisOutput({
                message: 'System monitoruje spójność tożsamości...',
                warningLevel: 'LOW',
                hasMemoryAccess: false,
            });
        }
    }, [lastAnalysisResult, isAnalyzing]);

    // --- LOGIKA WYŚWIETLANIA KRYTYCZNYCH WARUNKÓW ---

    const renderMemoryStatus = (hasAccess: boolean) => {
        if (!hasAccess) return null;
        return <span className="text-emerald-400">💾 Pamięć LTC aktywowana</span>;
    };

    const renderWarning = (level: 'LOW' | 'MEDIUM' | 'HIGH', message: string) => {
        if (!message || level === 'LOW') return null;
        const colorClass = level === 'HIGH'
            ? 'border-red-600 animate-pulse text-red-300'
            : 'border-yellow-500 text-yellow-300';
        return (
            <div className={`p-2 mt-3 border-l-4 ${colorClass} bg-gray-800/50 text-xs`}>
                🚨 [WARNING — ANALIZA] Status: {message}
            </div>
        );
    };

    if (!analysisOutput) return null;

    return (
        <div className="bg-gray-900 p-4 border-t-2 border-dashed border-blue-700 mt-6 shadow-lg rounded-b-lg">
            <h3 className="text-sm font-mono text-cyan-400 uppercase tracking-widest flex items-center flex-wrap gap-1">
                <span role="img" aria-label="oko">👁️</span> SYSTEM MONITORING VEIL: Analiza Transakcyjna Tożsamości
                <span className="ml-2 text-cyan-600">({state}{isSingularityProtocolActive ? ' · SP' : ''})</span>
            </h3>

            {/* 1. Status Pamięci Długoterminowej */}
            <div className="mb-3 text-xs text-blue-400 mt-2">
                <p>Aktualny poziom: <span className="font-bold">{currentLevel}/9</span></p>
                {renderMemoryStatus(analysisOutput.hasMemoryAccess)}
            </div>

            {/* 2. Wynik Walidacji/Interpretacji */}
            <div className="bg-black/30 p-3 rounded mb-2 border border-cyan-700/50">
                <p className="text-sm text-gray-200 italic">
                    {isAnalyzing ? '⟳ ' : ''}{analysisOutput.message}
                </p>
            </div>

            {/* 3. Alert Systemowy */}
            {renderWarning(analysisOutput.warningLevel, analysisOutput.message)}
        </div>
    );
};

export default TheVeil;
