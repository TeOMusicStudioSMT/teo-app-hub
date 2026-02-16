import React from 'react';
import { Project } from '../types';
import { motion } from 'framer-motion';

const classMap: { [key: string]: string } = {
    cyan: 'border-cyan-400 text-cyan-300 shadow-cyan-400/50',
    fuchsia: 'border-fuchsia-400 text-fuchsia-300 shadow-fuchsia-400/50',
    amber: 'border-amber-400 text-amber-300 shadow-amber-400/50',
    lime: 'border-lime-400 text-lime-300 shadow-lime-400/50',
    rose: 'border-rose-400 text-rose-300 shadow-rose-400/50',
    violet: 'border-violet-400 text-violet-300 shadow-violet-400/50',
    sky: 'border-sky-400 text-sky-300 shadow-sky-400/50',
    green: 'border-green-400 text-green-300 shadow-green-400/50',
};

interface PlanetProps {
    project: Project;
    onSelect: (project: Project) => void;
    style: React.CSSProperties;
}

const Planet: React.FC<PlanetProps> = ({ project, onSelect, style }) => {
    const planetClasses = classMap[project.color] || classMap['cyan'];

    const dynamicStyle: React.CSSProperties = {
        ...style,
        '--tw-shadow-color': `var(--color-${project.color}-400)`,
         '--glow-color': `rgba(var(--color-glow-${project.color}), 0.7)`,
    } as React.CSSProperties;

    return (
        <motion.div
            className="absolute top-1/2 left-1/2 -mt-10 -ml-10 w-20 h-20 group cursor-pointer"
            style={dynamicStyle}
            onClick={() => onSelect(project)}
            whileHover={{ scale: 1.05, filter: `drop-shadow(0 0 10px rgba(var(--rgb-${project.color}-400), 0.7))` }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
        >
            <div
                className={`w-full h-full rounded-full flex items-center justify-center transition-all duration-300 ease-in-out bg-slate-900/50 backdrop-blur-sm border ${planetClasses} `}
            >
                <div 
                    className="w-10 h-10 transition-transform duration-300 group-hover:scale-110"
                >
                    {project.icon}
                </div>
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-max px-3 py-1 bg-slate-800/80 text-white text-sm rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:delay-200 backdrop-blur-sm">
                    {project.name}
                </div>
            </div>
        </motion.div>
    );
};

export default Planet;