
import React from 'react';
import { useAtomValue } from 'jotai';
import { projectsAtom, userFavoritesAtom } from '../store';
import { getRecommendations } from '../lib/recommendations';
import { ProjectCard } from './ProjectCard';

export const RecommendationSection: React.FC = () => {
  const allProjects = useAtomValue(projectsAtom);
  const userFavorites = useAtomValue(userFavoritesAtom);

  const recommendations = getRecommendations(allProjects, userFavorites);

  if (recommendations.length === 0) {
    return null; // Don't show the section if there are no recommendations
  }

  return (
    <div className="mt-8 p-6 bg-slate-900/60 backdrop-blur-md rounded-lg border border-lime-500/20 shadow-2xl shadow-lime-900/30">
      <h2 className="text-2xl font-bold text-lime-300 mb-4 drop-shadow-[0_0_4px_rgba(163,230,53,0.5)]">
        VISeL Ai Picks for You ✨
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {recommendations.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
};
