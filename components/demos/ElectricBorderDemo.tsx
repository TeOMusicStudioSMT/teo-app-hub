import React, { useState } from 'react';
import { ElectricBorder } from '../react_bits/ElectricBorder';
import { useAtomValue } from 'jotai';
import { resonanceColorAtom, RESONANCE_THEMES } from '../../store/personalization';
import { ElectricBorderMode } from '../../store/electricBorder';

/**
 * ElectricBorder Demo Component
 * 
 * Interactive demonstration of JusT Mode functionality.
 * Showcases all three modes: Active, JusT, and Resonance.
 */
export const ElectricBorderDemo: React.FC = () => {
    const [mode, setMode] = useState<ElectricBorderMode>('just');
    const [color, setColor] = useState('#22d3ee');
    const [autoTransition, setAutoTransition] = useState(true);
    const [useGlobalSync, setUseGlobalSync] = useState(false);

    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];

    const modeDescriptions = {
        active: {
            title: '⚡ Active Mode',
            description: 'High energy, chaotic lightning patterns. Full intensity (100%).',
            specs: ['60fps', '10px displacement', 'Random flashes', 'Full opacity'],
            energy: '100%',
            color: '#ef4444'
        },
        just: {
            title: '🧘 JusT Mode',
            description: 'Passive presence, gentle breathing waves. Zero-gravity effect (30%).',
            specs: ['30fps', '2px displacement', 'Smooth curves', 'Breathing animation'],
            energy: '30%',
            color: '#22d3ee'
        },
        resonance: {
            title: '💫 Resonance Mode',
            description: 'Harmonic patterns synchronized with your theme. Deep connection (70%).',
            specs: ['45fps', '5px displacement', 'Wave harmonics', 'Theme-synced'],
            energy: '70%',
            color: theme.hex
        }
    };

    const currentMode = modeDescriptions[mode];

    return (
        <div className="min-h-screen bg-slate-950 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-4xl font-bold text-white mb-2">
                    ElectricBorder: JusT Mode Demo
                </h1>
                <p className="text-slate-400 mb-8">
                    Interactive demonstration of PEIE-based visual consciousness states
                </p>

                {/* Control Panel */}
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 mb-8">
                    <h2 className="text-xl font-semibold text-white mb-4">Controls</h2>

                    {/* Mode Selection */}
                    <div className="mb-6">
                        <label className="block text-sm text-slate-300 mb-3">
                            Select Mode
                        </label>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setMode('active')}
                                className={`px-6 py-3 rounded-lg font-medium transition-all ${mode === 'active'
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                            >
                                ⚡ Active
                            </button>

                            <button
                                onClick={() => setMode('just')}
                                className={`px-6 py-3 rounded-lg font-medium transition-all ${mode === 'just'
                                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                            >
                                🧘 JusT
                            </button>

                            <button
                                onClick={() => setMode('resonance')}
                                className={`px-6 py-3 rounded-lg font-medium transition-all ${mode === 'resonance'
                                        ? `${theme.tw.bg} text-white shadow-lg ${theme.tw.shadow}`
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                            >
                                💫 Resonance
                            </button>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoTransition}
                                    onChange={(e) => setAutoTransition(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                                />
                                <span className="text-slate-300">
                                    Auto-transition (30s inactivity → JusT)
                                </span>
                            </label>
                        </div>

                        <div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={useGlobalSync}
                                    onChange={(e) => setUseGlobalSync(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                                />
                                <span className="text-slate-300">
                                    Global State Sync (all borders together)
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Color Picker */}
                    <div className="mt-4">
                        <label className="block text-sm text-slate-300 mb-2">
                            Border Color
                        </label>
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-32 h-10 rounded cursor-pointer"
                        />
                    </div>
                </div>

                {/* Live Demo Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Main Demo */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4">
                            Live Preview
                        </h3>

                        <ElectricBorder
                            mode={mode}
                            color={color}
                            cornerRadius={24}
                            autoTransition={autoTransition}
                            inactivityTimeout={5000} // Shorter for demo
                            useGlobalState={useGlobalSync}
                            onModeChange={(newMode) => {
                                console.log('Mode changed to:', newMode);
                            }}
                        >
                            <div className="bg-slate-900/60 backdrop-blur-lg p-8 rounded-3xl min-h-[300px] flex flex-col items-center justify-center text-center">
                                <div className="text-6xl mb-4">
                                    {mode === 'active' && '⚡'}
                                    {mode === 'just' && '🧘'}
                                    {mode === 'resonance' && '💫'}
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-2">
                                    {currentMode.title}
                                </h3>

                                <p className="text-slate-400 mb-4">
                                    {currentMode.description}
                                </p>

                                <div className="text-sm text-slate-500">
                                    {autoTransition && (
                                        <p className="italic">
                                            Hover to activate, move away to see auto-transition
                                        </p>
                                    )}
                                </div>
                            </div>
                        </ElectricBorder>
                    </div>

                    {/* Specs Panel */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4">
                            Technical Specifications
                        </h3>

                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6">
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-400">Energy Level</span>
                                    <span className="text-xl font-bold" style={{ color: currentMode.color }}>
                                        {currentMode.energy}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-2">
                                    <div
                                        className="h-2 rounded-full transition-all duration-500"
                                        style={{
                                            width: currentMode.energy,
                                            backgroundColor: currentMode.color
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-semibold text-white mb-3">Parameters:</h4>
                                {currentMode.specs.map((spec, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: currentMode.color }}
                                        />
                                        <span className="text-slate-300">{spec}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-700/50">
                                <h4 className="font-semibold text-white mb-2">PEIE Alignment</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-2">
                                        <span className="text-cyan-400 font-mono">E:</span>
                                        <span className="text-slate-400">
                                            {mode === 'just' && 'Low computational energy, optimized for passive state'}
                                            {mode === 'active' && 'High visual energy, full responsiveness'}
                                            {mode === 'resonance' && 'Balanced energy, harmonic efficiency'}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-purple-400 font-mono">I:</span>
                                        <span className="text-slate-400">
                                            Visual pattern communicates system state
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-amber-400 font-mono">Ex:</span>
                                        <span className="text-slate-400">
                                            {autoTransition
                                                ? 'Bidirectional: responds to user presence'
                                                : 'Static: manual mode control'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Multiple Instances Demo (if global sync enabled) */}
                {useGlobalSync && (
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4">
                            Global Synchronization Demo
                        </h3>
                        <p className="text-slate-400 mb-4">
                            All borders below are synchronized - they share the same state
                        </p>

                        <div className="grid grid-cols-3 gap-4">
                            {['Card 1', 'Card 2', 'Card 3'].map((title, idx) => (
                                <ElectricBorder
                                    key={idx}
                                    useGlobalState={true}
                                    color={color}
                                    cornerRadius={16}
                                    autoTransition={autoTransition}
                                >
                                    <div className="bg-slate-900/60 backdrop-blur-lg p-6 rounded-2xl text-center">
                                        <h4 className="font-semibold text-white mb-2">
                                            {title}
                                        </h4>
                                        <p className="text-sm text-slate-400">
                                            Synced globally
                                        </p>
                                    </div>
                                </ElectricBorder>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Info */}
                <div className="mt-12 text-center text-slate-600 text-sm">
                    <p>
                        ElectricBorder: JusT Mode • Based on PEIE Philosophy
                    </p>
                    <p className="mt-1">
                        Protocol of Energy, Information & Exchange
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ElectricBorderDemo;
