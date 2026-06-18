/**
 * 🌾 SimulatorMap — Wizualizacja Agro-Robotics Simulator
 *
 * Pole + animowany robot 🚜 jeżdżący po waypointach wyliczonych przez
 * AgroBridgeService. Przełącznik [SYMULACJA] / [FIZYCZNY ROBOT] wybiera silnik
 * (SimulationExecutor / PhysicalExecutor) BEZ zmiany logiki parsera.
 *
 * Skrypt: move(North), plant('A'), move(East), spray('B'), measure(N), wait(1)
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sprout, Cpu, Play, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { AgroBridgeService } from '../../src/services/AgroBridgeService';
import { SimulationExecutor } from '../../src/executors/SimulationExecutor';
import { PhysicalExecutor } from '../../src/executors/PhysicalExecutor';
import type { IExecutor, RobotStateSink } from '../../src/executors/IExecutor';
import type { ExecutionMode, RobotState, StepResult } from '../../src/types/robotTypes';

const RANGE = 10;                 // pole -10..10 (21 komórek)
const CELLS = RANGE * 2 + 1;
const FIELD_PX = 420;
const CELL_PX = FIELD_PX / CELLS;

const toPx = (x: number, y: number) => ({
    left: (x + RANGE) * CELL_PX + CELL_PX / 2,
    top:  (RANGE - y) * CELL_PX + CELL_PX / 2,   // y odwrócone (ekran)
});

const DEFAULT_SCRIPT = "move(North)\nmove(North)\nplant('A')\nmove(East)\nspray('B')\nmove(South)\nmeasure(N)\nwait(1)";

interface Marker { x: number; y: number; icon: string; }
interface LogLine { id: number; msg: string; ok: boolean; }

export const SimulatorMap: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const [script, setScript]     = useState(DEFAULT_SCRIPT);
    const [mode, setMode]         = useState<ExecutionMode>('SIMULATION');
    const [running, setRunning]   = useState(false);
    const [robot, setRobot]       = useState({ x: 0, y: 0 });
    const [battery, setBattery]   = useState(100);
    const [markers, setMarkers]   = useState<Marker[]>([]);
    const [log, setLog]           = useState<LogLine[]>([]);
    const [violations, setViolations] = useState<string[]>([]);
    const execRef = useRef<IExecutor | null>(null);

    const sink: RobotStateSink = useCallback((state: RobotState, result?: StepResult) => {
        setRobot({ x: state.x, y: state.y });
        setBattery(state.battery);
        if (result) {
            setLog(prev => [...prev, { id: result.stepId, msg: result.message, ok: result.ok }]);
            const icon = state.lastAction === 'PLANT' ? '🌱'
                : state.lastAction === 'SPRAY' ? '💧'
                : state.lastAction === 'MEASURE' ? '📡' : '';
            if (icon) setMarkers(prev => [...prev, { x: state.x, y: state.y, icon }]);
        }
    }, []);

    const handleReset = useCallback(() => {
        execRef.current?.resetHardware?.();
        setRobot({ x: 0, y: 0 }); setBattery(100); setMarkers([]); setLog([]); setViolations([]);
    }, []);

    const handleRun = useCallback(async () => {
        if (running) return;
        setViolations([]); setMarkers([]); setLog([]); setRobot({ x: 0, y: 0 });
        let plan;
        try { plan = AgroBridgeService.parseScript(script); }
        catch (e) { setViolations([(e as Error).message]); return; }

        const v = AgroBridgeService.validatePlan(plan);
        if (v.length) { setViolations(v); return; }

        setRunning(true);
        const exec: IExecutor = mode === 'SIMULATION' ? new SimulationExecutor(sink) : new PhysicalExecutor(sink);
        execRef.current = exec;
        try { await exec.executePlan(plan); }
        catch (e) { setLog(prev => [...prev, { id: -1, msg: `Przerwano: ${(e as Error).message}`, ok: false }]); }
        finally { setRunning(false); }
    }, [running, script, mode, sink]);

    const robotPx = toPx(robot.x, robot.y);

    return (
        <div className="w-full max-w-4xl mx-auto bg-[#04080a] border border-emerald-500/25 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] font-sans text-slate-200">
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/20 bg-gradient-to-r from-[#05140a] to-[#0a1005]">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-black border border-emerald-500/40 flex items-center justify-center">
                        <Sprout size={22} className="text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-lime-400">AGRO-ROBOTICS SIMULATOR</h2>
                        <p className="text-[10px] text-slate-500 tracking-wider">Parser trójfazowy · Factory + HAL · Waypoint XYZ</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Przełącznik trybu */}
                    <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[11px] font-mono">
                        {(['SIMULATION', 'PHYSICAL'] as ExecutionMode[]).map(m => (
                            <button key={m} onClick={() => !running && setMode(m)} disabled={running}
                                className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${mode === m
                                    ? (m === 'SIMULATION' ? 'bg-emerald-700/70 text-white' : 'bg-amber-700/70 text-white')
                                    : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}>
                                {m === 'SIMULATION' ? <><Play size={11} /> SYMULACJA</> : <><Cpu size={11} /> ROBOT</>}
                            </button>
                        ))}
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white border border-slate-700">
                            <X size={15} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-5 p-6">
                {/* LEWA: skrypt + sterowanie */}
                <div className="flex flex-col gap-3 lg:w-[300px] shrink-0">
                    <label className="text-[10px] text-slate-500 tracking-[0.2em] uppercase">Skrypt komend</label>
                    <textarea
                        value={script}
                        onChange={e => setScript(e.target.value)}
                        spellCheck={false}
                        rows={9}
                        className="bg-black/60 border border-emerald-700/30 focus:border-emerald-500/60 rounded-xl p-3 text-xs font-mono text-emerald-200 outline-none resize-none"
                    />
                    <p className="text-[9px] text-slate-600 leading-relaxed">
                        Komendy: <span className="text-emerald-500">move(North/South/East/West)</span>, plant('A'), spray('B'), measure(N), wait(s)
                    </p>

                    <div className="flex gap-2">
                        <button onClick={handleRun} disabled={running}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border
                                ${mode === 'PHYSICAL' ? 'bg-amber-700/70 hover:bg-amber-600 border-amber-400/40' : 'bg-emerald-700/70 hover:bg-emerald-600 border-emerald-400/40'} text-black disabled:opacity-40`}>
                            <Play size={14} /> {running ? 'WYKONUJĘ...' : mode === 'PHYSICAL' ? 'EXPORT → ROBOT' : 'URUCHOM SYMULACJĘ'}
                        </button>
                        <button onClick={handleReset} disabled={running}
                            className="px-3 py-2.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 disabled:opacity-40">
                            <RotateCcw size={14} />
                        </button>
                    </div>

                    {mode === 'PHYSICAL' && (
                        <div className="text-[10px] text-amber-300/90 bg-amber-950/30 border border-amber-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
                            <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                            Tryb fizyczny: blokujące await na GPIO + stop awaryjny. (HardwareBus symulowany — podłącz WebSerial/MQTT.)
                        </div>
                    )}

                    {violations.length > 0 && (
                        <div className="text-[10px] text-rose-300 bg-rose-950/30 border border-rose-500/30 rounded-lg px-3 py-2">
                            🛡️ Safe-Mode zatrzymał plan:
                            {violations.map((v, i) => <div key={i}>• {v}</div>)}
                        </div>
                    )}
                </div>

                {/* PRAWA: pole + log */}
                <div className="flex-1 flex flex-col gap-3 items-center">
                    {/* HUD */}
                    <div className="w-full flex justify-between text-[10px] font-mono text-emerald-400/80">
                        <span>POZYCJA: <span className="text-emerald-300">({robot.x}, {robot.y})</span></span>
                        <span>BATERIA: <span className={battery < 30 ? 'text-rose-400' : 'text-lime-400'}>{battery.toFixed(0)}%</span></span>
                        <span>NASADZONO: <span className="text-emerald-300">{markers.filter(m => m.icon === '🌱').length}</span></span>
                    </div>

                    {/* Pole */}
                    <div className="relative rounded-xl overflow-hidden border border-emerald-700/30"
                        style={{
                            width: FIELD_PX, height: FIELD_PX,
                            backgroundColor: '#07120a',
                            backgroundImage: `linear-gradient(rgba(16,185,129,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.08) 1px, transparent 1px)`,
                            backgroundSize: `${CELL_PX}px ${CELL_PX}px`,
                        }}>
                        {/* osie 0,0 */}
                        <div className="absolute bg-emerald-500/10" style={{ left: 0, right: 0, top: toPx(0, 0).top - 0.5, height: 1 }} />
                        <div className="absolute bg-emerald-500/10" style={{ top: 0, bottom: 0, left: toPx(0, 0).left - 0.5, width: 1 }} />

                        {/* markery */}
                        {markers.map((m, i) => {
                            const p = toPx(m.x, m.y);
                            return <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 text-sm" style={{ left: p.left, top: p.top }}>{m.icon}</span>;
                        })}

                        {/* robot */}
                        <motion.div
                            className="absolute -translate-x-1/2 -translate-y-1/2 text-xl"
                            animate={{ left: robotPx.left, top: robotPx.top }}
                            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
                            style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.7))' }}
                        >
                            🚜
                        </motion.div>
                    </div>

                    {/* Log kroków */}
                    <div className="w-full max-h-28 overflow-y-auto bg-black/40 rounded-lg border border-emerald-900/30 p-2 font-mono space-y-0.5">
                        {log.length === 0 ? (
                            <div className="text-[10px] text-slate-700">Log wykonania — uruchom skrypt.</div>
                        ) : log.map((l, i) => (
                            <div key={i} className="text-[10px]" style={{ color: l.ok ? '#6ee7b7' : '#fb7185' }}>
                                <span className="opacity-40">#{l.id}</span> {l.msg}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SimulatorMap;
