/**
 * 📱 mobile — detekcja „Kieszeni Suwerena": telefon/tablet, WebGPU (VRAM), NFC.
 * Pozwala apce wiedzieć, że Katedra jest w locie i polecić tryb JusT (on-device).
 */

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const touchMac = (navigator as any).maxTouchPoints > 1 && /Mac/.test((navigator as any).platform || '');
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) || touchMac;
}

/** WebGPU = telefon ma użyteczny VRAM dla lokalnej kognicji (JusT/MediaPipe). */
export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in (navigator as any);
}

export function hasNFC(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

export interface PocketStatus { mobile: boolean; webgpu: boolean; nfc: boolean; }

export function pocketStatus(): PocketStatus {
  return { mobile: isMobile(), webgpu: hasWebGPU(), nfc: hasNFC() };
}
