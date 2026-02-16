import React from 'react';

interface EventHorizonProps {
    onLoginRequest: () => void;
}

const EventHorizon: React.FC<EventHorizonProps> = ({ onLoginRequest }) => {
    return (
        <div
            className="event-horizon-container relative w-40 h-40 md:w-52 md:h-52 flex items-center justify-center group cursor-pointer"
            onClick={onLoginRequest}
            aria-label="Enter TeOnaut Lounge"
            role="button"
        >
            {/* Crystalline Sphere effect */}
            <div className="crystal-sphere"></div>

            {/* Inner nebula and core pulse effects */}
            <div className="mini-nebula"></div>
            <div className="core-pulse-warm"></div>
            
            {/* Central Text */}
            <div className="relative text-center font-bold tracking-widest uppercase transition-all duration-300 group-hover:scale-105 z-10">
                <span className="text-4xl md:text-5xl text-amber-100 drop-shadow-[0_0_12px_rgba(255,220,150,0.9)]">TeO</span>
            </div>
        </div>
    );
};

export default EventHorizon;
