import React, { useState } from 'react';
import { useGuardians } from '../../hooks/useGuardians';
import { Guardian } from '../../lib/identity/types';
import toast from 'react-hot-toast';

export const GuardiansPanel: React.FC = () => {
    const { guardians, quorum, addGuardian, removeGuardian, setQuorum } = useGuardians();
    const [newGuardianLabel, setNewGuardianLabel] = useState('');
    const [newGuardianContact, setNewGuardianContact] = useState('');

    const handleAddGuardian = () => {
        if (!newGuardianLabel.trim() || !newGuardianContact.trim()) {
            toast.error("Guardian label and contact cannot be empty.");
            return;
        }
        addGuardian({ label: newGuardianLabel, contact: newGuardianContact });
        setNewGuardianLabel('');
        setNewGuardianContact('');
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-white">Social Recovery Guardians</h3>
                <p className="text-slate-400 text-sm">Guardians can help you recover your Essence if you lose access. They cannot control your assets directly.</p>
            </div>

            {/* Guardian List */}
            <div className="space-y-3">
                {guardians.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                        <div>
                            <p className="font-semibold text-slate-100">{g.label}</p>
                            <p className="text-xs text-slate-400 font-mono truncate max-w-xs">{g.contact}</p>
                        </div>
                        <button onClick={() => removeGuardian(g.id)} className="text-rose-400 hover:text-rose-300 font-bold text-sm">
                            Remove
                        </button>
                    </div>
                ))}
                {guardians.length === 0 && (
                    <p className="text-slate-500 text-center py-4">No guardians added yet.</p>
                )}
            </div>

            {/* Add Guardian Form */}
            <div className="border-t border-slate-700/50 pt-6 space-y-4">
                 <h4 className="text-md font-semibold text-white">Add a New Guardian</h4>
                 <input
                    type="text"
                    value={newGuardianLabel}
                    onChange={(e) => setNewGuardianLabel(e.target.value)}
                    placeholder="Guardian Label (e.g., 'My Ledger')"
                    className="w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-white"
                />
                 <input
                    type="text"
                    value={newGuardianContact}
                    onChange={(e) => setNewGuardianContact(e.target.value)}
                    placeholder="Guardian Contact (e.g., 'did:key:...')"
                    className="w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-white"
                />
                <button onClick={handleAddGuardian} className="capsule-button capsule-violet w-full">
                    Add Guardian
                </button>
            </div>
            
            {/* Quorum Settings */}
             <div className="border-t border-slate-700/50 pt-6">
                <h4 className="text-md font-semibold text-white mb-2">Recovery Quorum</h4>
                <p className="text-slate-400 text-sm mb-3">Select how many guardians are required to approve a recovery request.</p>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="1"
                        max={Math.max(1, guardians.length)}
                        value={quorum}
                        onChange={(e) => setQuorum(parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        disabled={guardians.length === 0}
                    />
                    <span className="font-bold text-cyan-300 w-24 text-center">{quorum} of {guardians.length}</span>
                </div>
            </div>
        </div>
    );
};