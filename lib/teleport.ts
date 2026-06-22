/**
 * 🎵 Teleport API - Komunikacja Hub ↔ Music V2
 * 
 * "Most między światami"
 * 
 * Używa localStorage + BroadcastChannel do komunikacji
 */

export const TELEPORT_CHANNEL = 'teo_music_teleport';
export const TELEPORT_RESULT_KEY = 'teo_music_result';

/** Wyślij parametry do Music V2 */
export function teleportToMusic(params: {
  style: string;
  tags: string[];
  model: 'v3' | 'v4' | 'v5';
  prompt: string;
  generationId?: string;
  returnUrl?: string; // URL do powrotu
  intensity?: number;
  confidence?: number;
}): void {
  // Zapisz parametry
  localStorage.setItem('teo_music_params', JSON.stringify(params));
  
  // Wyślij event
  const channel = new BroadcastChannel(TELEPORT_CHANNEL);
  channel.postMessage({ type: 'GENERATE', params });
  
  console.log('[Teleport] 📤 Wysłano parametry do Music V2:', params);
  
  // Wykryj localhost
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // Zbuduj parametry zapytania (Query Params) dla zachowania spójności przy zmianie portów
  const qParams = new URLSearchParams();
  qParams.set('style', params.style || '');
  qParams.set('prompt', params.prompt || '');
  qParams.set('model', params.model || '');
  if (params.tags && params.tags.length > 0) {
    qParams.set('tags', params.tags.join(','));
  }
  if (params.generationId) {
    qParams.set('generationId', params.generationId);
  }
  if (params.intensity !== undefined) {
    qParams.set('intensity', String(params.intensity));
  }
  if (params.confidence !== undefined) {
    qParams.set('confidence', String(params.confidence));
  }

  const query = '?' + qParams.toString();
  const targetUrl = isLocalhost ? `http://localhost:5173${query}` : `/music${query}`;
  
  // Otwórz Music V2 w nowej karcie
  window.open(targetUrl, '_blank');
}

/** Nasłuchuj na parametry z Huba */
export function onTeleportReceive(callback: (params: any) => void): () => void {
  const channel = new BroadcastChannel(TELEPORT_CHANNEL);
  
  channel.onmessage = (event) => {
    if (event.data.type === 'GENERATE') {
      console.log('[Teleport] 📥 Otrzymano parametry:', event.data.params);
      callback(event.data.params);
    }
  };
  
  return () => channel.close();
}

/** Wyślij wynik z powrotem do Huba */
export function teleportResult(result: {
  success: boolean;
  audioUrl?: string;
  title?: string;
  error?: string;
}): void {
  localStorage.setItem(TELEPORT_RESULT_KEY, JSON.stringify({
    ...result,
    timestamp: Date.now(),
  }));
  
  // Wyślij event
  const channel = new BroadcastChannel(TELEPORT_CHANNEL);
  channel.postMessage({ type: 'RESULT', result });
  
  console.log('[Teleport] 📤 Wysłano wynik do Huba:', result);
}

/** Nasłuchuj na wynik z Music V2 */
export function onTeleportResult(callback: (result: any) => void): () => void {
  const channel = new BroadcastChannel(TELEPORT_CHANNEL);
  
  channel.onmessage = (event) => {
    if (event.data.type === 'RESULT') {
      console.log('[Teleport] 📥 Otrzymano wynik:', event.data.result);
      callback(event.data.result);
    }
  };
  
  return () => channel.close();
}
