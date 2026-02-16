
import React from 'react';

interface QuantumGuardianAlertProps {
    message: string;
    onClose: () => void;
}

const QuantumGuardianAlert: React.FC<QuantumGuardianAlertProps> = ({ message, onClose }) => {
    return (
        <div className="fixed bottom-5 right-5 z-50 w-full max-w-sm animate-[slide-in-bottom_0.5s_ease-out]">
            <div className="bg-amber-900/80 border border-amber-500 text-white p-4 rounded-lg shadow-lg backdrop-blur-sm">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-amber-400">Quantum Guardian AI Alert</p>
                        <p className="text-sm text-amber-200">{message}</p>
                    </div>
                    <button onClick={onClose} className="ml-4 text-amber-300 hover:text-white text-2xl leading-none">&times;</button>
                </div>
            </div>
        </div>
    );
};

export default QuantumGuardianAlert;