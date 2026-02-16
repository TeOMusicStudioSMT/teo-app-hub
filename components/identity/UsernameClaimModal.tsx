import React, { useState, useEffect } from 'react';
import { ElectricBorder } from '../react_bits/ElectricBorder';
import { useAtom } from 'jotai';
import { isClaimUsernameModalOpenAtom } from '../../store/identity';
import { useEssenceIdentity } from '../../hooks/useEssenceIdentity';
import { RESONANCE_THEMES, resonanceColorAtom, pulseIntensityAtom, ResonanceColorKey } from '../../store/personalization';
import { cn } from '../../lib/helpers';
import { EssenceIncarnation } from './EssenceIncarnation';

const validationRegex = /^[a-z0-9.-]{3,24}$/;
const pulseLabels = ['Slow', 'Medium', 'Dynamic'];

export const UsernameClaimModal: React.FC = () => {
    const [isOpen, setIsOpen] = useAtom(isClaimUsernameModalOpenAtom);
    const [username, setUsername] = useState('');
    const [assistantDomain, setAssistantDomain] = useState('');
    const [isClaiming, setIsClaiming] = useState(false);

    const [usernameIsValid, setUsernameIsValid] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [domainIsValid, setDomainIsValid] = useState(false);
    const [domainError, setDomainError] = useState('');

    const [resonanceColor, setResonanceColor] = useAtom(resonanceColorAtom);
    const [pulseIntensity, setPulseIntensity] = useAtom(pulseIntensityAtom);

    const { refreshIdentity } = useEssenceIdentity();

    useEffect(() => {
        if (!username) {
            setUsernameIsValid(false);
            setUsernameError('');
            return;
        }
        const valid = validationRegex.test(username);
        setUsernameIsValid(valid);
        if (!valid) {
            setUsernameError('Must be 3-24 characters, lowercase letters, numbers, dots, or hyphens.');
        } else {
            setUsernameError('');
        }
    }, [username]);

    useEffect(() => {
        if (!assistantDomain.trim()) {
            setDomainIsValid(false);
            setDomainError('Assistant domain is required.');
        } else if (assistantDomain.trim().length < 2) {
            setDomainIsValid(false);
            setDomainError('Must be at least 2 characters.');
        } else {
            setDomainIsValid(true);
            setDomainError('');
        }
    }, [assistantDomain]);


    const handleClaim = async () => {
        if (!usernameIsValid || !domainIsValid || isClaiming) return;
        setIsClaiming(true);
    };

    const handleClose = () => {
        if (isClaiming) return;
        setIsOpen(false);
        setUsername('');
        setAssistantDomain('');
    };

    if (isClaiming) {
        return (
            <EssenceIncarnation
                username={username}
                assistantDomain={assistantDomain}
                resonanceColor={resonanceColor}
                onComplete={() => {
                    refreshIdentity();
                    setIsOpen(false);
                    setIsClaiming(false);
                }}
                onFailure={() => {
                    setIsClaiming(false);
                }}
            />
        );
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fade-in_0.3s]">

            {/* Kontener Modala */}
            <div className="claim-modal-container max-w-lg w-full m-4 relative">

                {/* cornerRadius={24} -> musi pasować do zaokrąglenia wewnętrznego diva (rounded-3xl to 24px)
                */}
                <ElectricBorder color="#22d3ee" cornerRadius={24} className="w-full h-full">

                    {/* Wnętrze karty */}
                    <div className="bg-slate-900 rounded-3xl p-8 space-y-6 h-full relative z-10 border border-slate-800/50 shadow-2xl">

                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-bold text-cyan-300 mb-2 tracking-wide drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                                Claim Your Essence Name
                            </h2>
                            <p className="text-slate-400 text-sm">
                                This will be your unique, permanent identifier across the TeO Universe.
                            </p>
                        </div>

                        {/* Formularz */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Essence Name</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 font-bold">@</span>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                        placeholder="your.essence"
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-9 pr-4 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all placeholder:text-slate-700 font-mono"
                                    />
                                </div>
                                {usernameError && <p className="text-rose-400 text-xs px-2">{usernameError}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Assistant Domain</label>
                                <input
                                    type="text"
                                    value={assistantDomain}
                                    onChange={(e) => setAssistantDomain(e.target.value)}
                                    placeholder="e.g., Napus, HAL, Buddy"
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all placeholder:text-slate-700"
                                />
                                {domainError && <p className="text-rose-400 text-xs px-2">{domainError}</p>}
                            </div>
                        </div>

                        {/* Opcje Personalizacji */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Resonance</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(Object.keys(RESONANCE_THEMES) as ResonanceColorKey[]).map(key => (
                                        <button
                                            key={key}
                                            onClick={() => setResonanceColor(key)}
                                            className={cn(
                                                'p-2 rounded-lg text-white font-bold text-[10px] uppercase transition-all transform',
                                                'bg-gradient-to-br border border-white/10', RESONANCE_THEMES[key].gradient,
                                                resonanceColor === key ? 'scale-105 shadow-md ring-1 ring-white' : 'hover:scale-105 opacity-60 hover:opacity-100'
                                            )}
                                        >
                                            {RESONANCE_THEMES[key].label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pulse</label>
                                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-900/20 px-2 py-0.5 rounded">
                                        {pulseLabels[pulseIntensity]}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="1"
                                    value={pulseIntensity}
                                    onChange={(e) => setPulseIntensity(Number(e.target.value))}
                                    className="w-full pulse-slider cursor-pointer accent-cyan-400 h-1 bg-slate-700 rounded-lg appearance-none"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-800">
                            <button onClick={handleClose} className="text-slate-400 hover:text-white px-4 py-2 text-sm transition-colors">Cancel</button>
                            <button
                                onClick={handleClaim}
                                disabled={!usernameIsValid || !domainIsValid || isClaiming}
                                className="capsule-button capsule-cyan w-full md:w-auto shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
                            >
                                Sync Identity
                            </button>
                        </div>

                    </div>
                </ElectricBorder>
            </div>
        </div>
    );
};