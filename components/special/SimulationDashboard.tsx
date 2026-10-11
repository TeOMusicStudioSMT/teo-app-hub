/**
 * 🧠 TeO-Sim — mózg i centrala Katedry w jednym oknie (przycisk 🧠 w menu Huba).
 *
 * Suweren 2026-10-11: „jedno miejsce na modele… w menu z TeO-Sim i tam te ważne podobne rzeczy związane z mózgiem
 * Katedry… Reasoning Monitor był do testów, jak nie było RAM-ów — można go przebudować, połączyć ze wskaźnikiem
 * koherencji… przenieść Oczy Suwerena, całe Impresario, całe menu MCP Skillboard”.
 *
 * Zakładki: 🧠 Mózg Katedry (modele) · 🎼 Dyrygent i Kuźnia · 🫀 Koherencja (dawny Reasoning Monitor — teraz prawdziwe
 * sprawdzenia rur) · 👁️ Oczy Suwerena · 🎙️ Impresario · ⚡ MCP Skillboard · 🗺️ Mapa Sieci · 🔐 Skarbiec (+ stacje
 * Impresariatu i klucze chmury mostu).
 */
import React, { useEffect, useState } from 'react';
import ModuleSieci from './ModuleSieci';
import VaultDashboard from './VaultDashboard';
import MozgKatedry from './MozgKatedry';
import KuzniaModeli from './KuzniaModeli';
import KoherencjaKatedry from './KoherencjaKatedry';
import SkarbiecStacje from './SkarbiecStacje';
import AgentDashboard from './AgentDashboard';
import ImpresarioDashboard from './ImpresarioDashboard';
import McpSkillboardPanel from '../McpSkillboardPanel';

export type ZakladkaTeoSim = 'mozg' | 'kuznia' | 'koherencja' | 'oczy' | 'impresario' | 'mcp' | 'sieci' | 'vault';
export const ZAKLADKI_TEOSIM: readonly [ZakladkaTeoSim, string][] = [
    ['mozg', '🧠 Mózg Katedry'], ['kuznia', '🎼 Dyrygent i Kuźnia'], ['koherencja', '🫀 Koherencja'],
    ['oczy', '👁️ Oczy Suwerena'], ['impresario', '🎙️ Impresario'], ['mcp', '⚡ MCP Skillboard'],
    ['sieci', '🗺️ Mapa Sieci'], ['vault', '🔐 Skarbiec'],
];

export const SimulationDashboard: React.FC<{ start?: ZakladkaTeoSim; onClose?: () => void }> = ({ start = 'mozg', onClose }) => {
    const [tab, setTab] = useState<ZakladkaTeoSim>(start);
    useEffect(() => { setTab(start); }, [start]);

    return (
        <div className="w-full">
            <div className="flex flex-wrap gap-2 mb-3">
                {ZAKLADKI_TEOSIM.map(([k, label]) => (
                    <button key={k} onClick={() => setTab(k)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-colors border
                            ${tab === k ? 'bg-emerald-700/60 text-white border-emerald-400/50' : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-slate-200'}`}>
                        {label}
                    </button>
                ))}
            </div>
            {tab === 'mozg' && <MozgKatedry />}
            {tab === 'kuznia' && <KuzniaModeli />}
            {tab === 'koherencja' && <KoherencjaKatedry />}
            {tab === 'oczy' && <AgentDashboard />}
            {tab === 'impresario' && <ImpresarioDashboard />}
            {tab === 'mcp' && <McpSkillboardPanel onClose={onClose ?? (() => setTab('mozg'))} />}
            {tab === 'sieci' && <ModuleSieci />}
            {tab === 'vault' && <><SkarbiecStacje /><VaultDashboard /></>}
        </div>
    );
};

export default SimulationDashboard;
