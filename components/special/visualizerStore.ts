// store/visualizerStore.ts

export type VisualizerType = 'PUSTKA' | 'STORYTELLER' | 'MATRIX_RAIN'; // Dodano 'MATRIX_RAIN'

export interface VisualizerState {
  visualizer: VisualizerType;
  layout: Record<string, unknown>; // Upewnij się, że 'left' lub klucz jest tu obsługiwany
}

// Twórca Store'a:
export const visualizerStore = {
  get state() { return this._state; },
  set visualizer(type: VisualizerType) {
    this._state.visualizer = type;
    // Trigger rebuild / event
  },
  // ...
}
