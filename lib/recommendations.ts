import { Project } from '../types';

export function getRecommendations(
  allProjects: Project[],
  userFavoriteProjects: Project[]
): Project[] {
  // 1. Collect all tags from the user's favorite projects
  const favoriteTags = userFavoriteProjects.flatMap(project => project.tags || []);
  const uniqueFavoriteTags = [...new Set(favoriteTags)];

  if (uniqueFavoriteTags.length === 0) {
    // If the user has no favorites, return an empty array.
    return [];
  }

  // 2. Find projects that have matching tags but are not already favorited
  const recommendedProjects = allProjects.filter(project => {
    if (project.isFavorite) {
        return false; // Exclude projects already in favorites
    }

    const hasMatchingTag = (project.tags || []).some(tag => uniqueFavoriteTags.includes(tag));
    
    return hasMatchingTag;
  });

  // 3. Score projects based on the number of matching tags for better sorting
  const scoredRecommendations = recommendedProjects.map(project => {
    const matchingTags = (project.tags || []).filter(tag => uniqueFavoriteTags.includes(tag));
    return { ...project, score: matchingTags.length };
  }).sort((a, b) => b.score - a.score);


  // 4. Return a unique list of top recommendations
  const uniqueRecommendations = [...new Set(scoredRecommendations)];

  return uniqueRecommendations.slice(0, 4); // Return top 4 recommendations
}
