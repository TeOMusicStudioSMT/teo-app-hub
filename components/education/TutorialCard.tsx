import React from 'react';
import { Tutorial } from '../../types';
import { ClockIcon } from '../icons';

interface TutorialCardProps {
    tutorial: Tutorial;
}

export const TutorialCard: React.FC<TutorialCardProps> = ({ tutorial }) => {
    return (
        <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/3 flex-shrink-0">
                <div className="aspect-video bg-black rounded-md overflow-hidden">
                    <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${tutorial.videoId}`}
                        title={tutorial.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
            <div className="flex-grow">
                <h4 className="text-lg font-bold text-white">{tutorial.title}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 mb-2">
                    <div className="w-4 h-4"><ClockIcon /></div>
                    <span>{tutorial.duration} min watch</span>
                </div>
                <p className="text-sm text-slate-300">{tutorial.description}</p>
            </div>
        </div>
    );
};