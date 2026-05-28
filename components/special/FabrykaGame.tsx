import React, { useState, useEffect, useRef } from 'react';
import './FabrykaGame.css';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 🏭 FabrykaGame - Symulator Fabryki TeO OtakOS
 * 
 * Moduł wizualizujący procesy produkcyjne w ekosystemie TeO.
 * Zarządza "Wsadami" (Payloads), które przechodzą przez cykl technologiczny.
 */

interface MachineProps {
    id: string;
    name: string;
    icon: string;
    desc: string;
    type: 'norm' | 'scan' | 'weld' | 'out';
    isActive: boolean;
}

const MACHINES: MachineProps[] = [
    { id: 'm1', name: 'NORMALIZACJA', icon: '📐', desc: 'Ustawienie parametrów Punktu Zero', type: 'norm', isActive: false },
    { id: 'm2', name: 'SKANOWANIE', icon: '👁️', desc: 'Weryfikacja koherencji kwantowej', type: 'scan', isActive: false },
    { id: 'm3', name: 'SPAWANIE', icon: '🔥', desc: 'Łączenie fragmentów w nową formę', type: 'weld', isActive: false },
    { id: 'm4', name: 'MANIFESTACJA', icon: '💎', desc: 'Finalny produkt wychodzi do Wymiaru', type: 'out', isActive: false },
];

export const FabrykaGame: React.FC = () => {
    const [isWorking, setIsWorking] = useState(false);
    const [currentStep, setCurrentStep] = useState(-1);
    const [logs, setLogs] = useState<Array<{ msg: string; type: 'sys' | 'warn' | 'err' }>>([
        { msg: 'System Fabryki Zainicjowany...', type: 'sys' },
        { msg: 'Oczekiwanie na inicjację suwerena...', type: 'sys' }
    ]);
    const [kwanty, setKwanty] = useState(0);
    const terminalRef = useRef<HTMLDivElement>(null);

    const addLog = (msg: string, type: 'sys' | 'warn' | 'err' = 'sys') => {
        setLogs(prev => [...prev, { msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }]);
        setTimeout(() => {
            if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }, 50);
    };

    const startCycle = () => {
        if (isWorking) return;
        setIsWorking(true);
        setCurrentStep(0);
        addLog('Inicjowanie cyklu produkcyjnego...', 'sys');
        addLog('Pobieranie danych z Chmury...', 'sys');
    };

    useEffect(() => {
        if (isWorking && currentStep >= 0 && currentStep < MACHINES.length) {
            const timer = setTimeout(() => {
                addLog(`Maszyna ${MACHINES[currentStep].name}: PRACA...`, 'sys');
                if (currentStep < MACHINES.length - 1) {
                    setCurrentStep(prev => prev + 1);
                } else {
                    setIsWorking(false);
                    setCurrentStep(-1);
                    setKwanty(prev => prev + 100);
                    addLog('CYKL ZAKOŃCZONY. Manifestacja udana! +100 Kwantów', 'sys');
                }
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isWorking, currentStep]);

    return (
        <div className="fabryka-game-container">
            <header className="fg-header">
                <h1>🏭 SYMULATOR FABRYKI</h1>
                <h2>Cykl Produkcyjny OtakOS - Wersja Beta 1.0</h2>
            </header>

            <div className="fg-container">
                {/* 🏗️ EKOSYSTEM */}
                <div className="fg-ecosystem">
                    <div className="fg-eco-col fg-cloud">
                        <div className="fg-node">
                            <span className="fg-node-icon">☁️</span>
                            <span className="fg-node-title">CHMURA</span>
                            <span className="fg-node-desc">Dane wejściowe TeOnauty</span>
                        </div>
                    </div>

                    <div className="fg-eco-col fg-portal">
                        <div className="fg-node">
                            <div className="fg-node-icon"></div>
                            <span className="fg-node-title">PORTAL 0.00G</span>
                            <span className="fg-node-desc">Punkt Zero Transformacji</span>
                        </div>
                    </div>

                    <div className="fg-eco-col fg-tech">
                        <div className="fg-tech-stack">
                            <div className="fg-tech-box">
                                <div className="fg-title">REACT</div>
                                <div className="fg-desc">Interfejs</div>
                            </div>
                            <div className="fg-tech-box">
                                <div className="fg-title">GEMMA</div>
                                <div className="fg-desc">Inteligencja</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🚜 LINIA PRODUKCYJNA */}
                <div className="fg-production">
                    <div className={`fg-conveyor-track ${isWorking ? 'active' : ''}`}></div>
                    
                    {MACHINES.map((m, idx) => (
                        <div key={m.id} className={`fg-machine ${currentStep === idx ? 'fg-working' : ''}`}>
                            <div className={`fg-machine-body fg-mach-${m.type}`}>
                                {m.icon}
                            </div>
                            <div className="fg-machine-name">{m.name}</div>
                            <div className="fg-machine-desc">{m.desc}</div>
                        </div>
                    ))}

                    {isWorking && (
                        <motion.div 
                            initial={{ left: '50px' }}
                            animate={{ left: `${50 + (currentStep + 1) * 120}px` }}
                            transition={{ duration: 2, ease: "linear" }}
                            className="fg-payload"
                        >
                            📦
                        </motion.div>
                    )}
                </div>

                {/* 📑 TERMINAL I STEROWANIE */}
                <div className="fg-dashboard-footer">
                    <div className="fg-controls">
                        <button 
                            className="fg-btn" 
                            onClick={startCycle}
                            disabled={isWorking}
                        >
                            {isWorking ? 'PRODUKCJA...' : 'ODPAL CYKL'}
                        </button>
                    </div>

                    <div className="fg-terminal" ref={terminalRef}>
                        {logs.map((log, i) => (
                            <p key={i} className={`fg-log-${log.type}`}>
                                {log.msg}
                            </p>
                        ))}
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 10, color: '#fbbf24', fontWeight: 'bold' }}>
                    ZASOBY: {kwanty} ⚡ KWANTÓW
                </div>
            </div>
        </div>
    );
};