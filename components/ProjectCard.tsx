import React from 'react';
import { Project } from '../types';

interface ProjectCardProps {
    project: Project;
}

const colorMap: { [key: string]: { border: string, text: string, shadow: string } } = {
    cyan: { border: 'border-cyan-400/50', text: 'text-cyan-300', shadow: 'hover:shadow-cyan-400/20' },
    fuchsia: { border: 'border-fuchsia-400/50', text: 'text-fuchsia-300', shadow: 'hover:shadow-fuchsia-400/20' },
    amber: { border: 'border-amber-400/50', text: 'text-amber-300', shadow: 'hover:shadow-amber-400/20' },
    lime: { border: 'border-lime-400/50', text: 'text-lime-300', shadow: 'hover:shadow-lime-400/20' },
    rose: { border: 'border-rose-400/50', text: 'text-rose-300', shadow: 'hover:shadow-rose-400/20' },
    violet: { border: 'border-violet-400/50', text: 'text-violet-300', shadow: 'hover:shadow-violet-400/20' },
    sky: { border: 'border-sky-400/50', text: 'text-sky-300', shadow: 'hover:shadow-sky-400/20' },
};


export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
    const colors = colorMap[project.color] || colorMap['cyan'];

    return (
        <div className={`flex flex-col items-center p-4 bg-slate-800/60 rounded-lg border ${colors.border} transition-all duration-300 ${colors.shadow} transform hover:-translate-y-1`}>
            <div className={`w-12 h-12 mb-3 ${colors.text}`}>
                {project.icon}
            </div>
            <h4 className="font-bold text-slate-100 text-center">{project.name}</h4>
            <p className="text-xs text-slate-400 text-center mt-1 h-10 overflow-hidden">
                {project.description.substring(0, 50)}{project.description.length > 50 && '...'}
            </p>
        </div>
    );
};
