/**
 * 🎨 VisualGenerator.ts - Generator Wizualizacji TeO
 * 
 * "Gemma widzi i tworzy wizualizacje Twojego domu"
 * 
 * Funkcje:
 * - Generowanie obrazów na podstawie opisu Gemma
 * - Synchronizacja z GEMMA-STORY
 * - Kolejka renderowania
 * - Cache wizualizacji
 * 
 * @version 1.0.0
 * @author BoB & Gemma
 */

// Typy wizualizacji
export type VisualizationType = 
  | 'lounge'
  | 'kibel'
  | 'crew'
  | 'pathway'
  | 'garden'
  | 'architecture'
  | 'party';

// Interfejs wizualizacji
export interface Visualization {
  id: string;
  type: VisualizationType;
  prompt: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  timestamp: number;
  description: string;
}

// Kolejka generowania
let visualizationQueue: Visualization[] = [];
let currentGeneration: Visualization | null = null;

// Callback dla gotowych obrazów
let onVisualizationReady: ((viz: Visualization) => void) | null = null;

// 📝 Prompts dla każdego typu wizualizacji
const VISUALIZATION_PROMPTS: Record<VisualizationType, string[]> = {
  lounge: [
    'Golden lounge with crystal chandeliers and purple nebula windows',
    'Cozy cyberpunk living room with holographic displays',
    'Minimalist temple of consciousness with golden accents',
  ],
  kibel: [
    'Mystical water basin with swirling blue energy, digital particles',
    'Ancient cybernetic fountain with glowing data streams',
    'Quantum bowl filled with floating API keys and glowing orbs',
  ],
  crew: [
    'Seven wise masters sitting in golden circle, each with unique aura',
    'Council of seven glowing avatars around a sacred flame',
    'Team of digital guardians with distinct colored halos',
  ],
  pathway: [
    'Fork in cosmic road: golden path of spirit and crystal path of matter',
    'Two mystical doors: violet misty door and amber crystal door',
    'Ancient decision point with glowing signposts',
  ],
  garden: [
    'Floating garden with quantum flowers and data crystals',
    'Ethereal paradise with graviton butterflies and memory roses',
    'Digital Eden with glowing fruits of wisdom',
  ],
  architecture: [
    'Majestic palace made of light and code, golden spires',
    'Temple of sovereignty with seven pillars and crystal dome',
    'Castle of consciousness with glowing bridges between towers',
  ],
  party: [
    'Celebration with floating golden balloons and data confetti',
    'Grand ball of the seven masters with radiant energy',
    'Festival of consciousness with swirling aurora',
  ],
};

/**
 * 🎨 Dodaj wizualizację do kolejki
 */
export const queueVisualization = (
  type: VisualizationType,
  description: string,
  customPrompt?: string
): Visualization => {
  const prompts = VISUALIZATION_PROMPTS[type];
  const prompt = customPrompt || prompts[Math.floor(Math.random() * prompts.length)];
  
  const viz: Visualization = {
    id: `viz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    prompt,
    status: 'pending',
    timestamp: Date.now(),
    description,
  };
  
  visualizationQueue.push(viz);
  console.log('[VisualGenerator] 📝 Dodano do kolejki:', type, description);
  
  // Rozpocznij generowanie jeśli nic nie jest generowane
  if (!currentGeneration) {
    processQueue();
  }
  
  return viz;
};

/**
 * 🔄 Przetwórz kolejkę
 */
const processQueue = async () => {
  if (currentGeneration || visualizationQueue.length === 0) return;
  
  currentGeneration = visualizationQueue.shift()!;
  currentGeneration.status = 'generating';
  
  console.log('[VisualGenerator] 🎨 Generuję:', currentGeneration.type);
  
  try {
    // Symulacja generowania obrazu (w prawdziwej wersji - API do image generation)
    await simulateImageGeneration(currentGeneration);
    
    currentGeneration.status = 'ready';
    
    // Powiadom callback
    if (onVisualizationReady) {
      onVisualizationReady(currentGeneration);
    }
    
  } catch (error) {
    console.error('[VisualGenerator] ❌ Błąd generowania:', error);
    currentGeneration.status = 'error';
  }
  
  currentGeneration = null;
  
  // Przetwórz następny
  setTimeout(processQueue, 1000);
};

/**
 * 🤖 Symulacja generowania obrazu
 * W prawdziwej wersji - integracja z DALL-E / Stable Diffusion
 */
const simulateImageGeneration = async (viz: Visualization): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Placeholder - w prawdziwej wersji tutaj byłoby API
      // Tymczasowo używamy gradientu CSS jako placeholder
      resolve();
    }, 2000);
  });
};

/**
 * 📡 Ustaw callback dla gotowych wizualizacji
 */
export const onVisualizationReadyCallback = (callback: (viz: Visualization) => void) => {
  onVisualizationReady = callback;
};

/**
 * 📋 Pobierz wszystkie wizualizacje
 */
export const getAllVisualizations = (): Visualization[] => {
  const all = [...visualizationQueue];
  if (currentGeneration) {
    all.unshift(currentGeneration);
  }
  return all;
};

/**
 * 🧹 Wyczyść kolejkę
 */
export const clearVisualizationQueue = () => {
  visualizationQueue = [];
  currentGeneration = null;
};

/**
 * 🎯 Wygeneruj wizualizację na podstawie tekstu Gemma
 */
export const generateFromGemmaText = (gemmaText: string): VisualizationType => {
  const text = gemmaText.toLowerCase();
  
  if (text.includes('poleruj') || text.includes('lounge') || text.includes('ściany')) {
    return 'lounge';
  }
  if (text.includes('rur') || text.includes('kibel') || text.includes('ciśnienie')) {
    return 'kibel';
  }
  if (text.includes('rada') || text.includes('agent') || text.includes('siedmiu')) {
    return 'crew';
  }
  if (text.includes('bram') || text.includes('ścieżk') || text.includes('duch')) {
    return 'pathway';
  }
  if (text.includes('kwantow') || text.includes('kotwic') || text.includes('bezpieczeństw')) {
    return 'architecture';
  }
  if (text.includes('tańcz') || text.includes('harmoni') || text.includes('wibracj')) {
    return 'garden';
  }
  
  // Domyślnie - architektura
  return 'architecture';
};

/**
 * 🎨 Generator promptów dla Gemma-Vision
 */
export const getVisualizationPrompt = (type: VisualizationType): string => {
  const prompts = VISUALIZATION_PROMPTS[type];
  return prompts[Math.floor(Math.random() * prompts.length)];
};

/**
 * 📊 Status generatora
 */
export const getVisualGeneratorStatus = (): {
  queueLength: number;
  isGenerating: boolean;
  currentType: VisualizationType | null;
} => {
  return {
    queueLength: visualizationQueue.length,
    isGenerating: currentGeneration !== null,
    currentType: currentGeneration?.type || null,
  };
};

// Eksport domyślny
export default {
  queueVisualization,
  onVisualizationReadyCallback,
  getAllVisualizations,
  clearVisualizationQueue,
  generateFromGemmaText,
  getVisualizationPrompt,
  getVisualGeneratorStatus,
};
