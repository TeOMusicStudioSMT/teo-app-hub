/**
 * 🎤 voiceService — suwerenny głos Katedry (klon lokalny + fallback przeglądarki).
 *
 * speak() próbuje lokalnego silnika klonu (most /api/voice/speak → XTTS/OpenVoice);
 * jak go brak — używa przeglądarki (speechSynthesis), więc DZIAŁA U KAŻDEGO od razu,
 * a podbija się do Twojego sklonowanego głosu, gdy lokalny silnik jest zainstalowany.
 * Próbka głosu zapisywana lokalnie (zero chmury).
 */

const BRIDGE = 'http://127.0.0.1:3001';

export interface VoiceStatus { success: boolean; available: boolean; voices?: string[]; note?: string; }

export async function voiceStatus(): Promise<VoiceStatus> {
  try { return await (await fetch(`${BRIDGE}/api/voice/status`)).json(); }
  catch { return { success: false, available: false }; }
}

export async function cloneVoice(sampleBase64: string, voiceId = 'suweren') {
  const r = await fetch(`${BRIDGE}/api/voice/clone`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample: sampleBase64, voiceId }),
  });
  return r.json();
}

let current: HTMLAudioElement | null = null;

/** Mów. Zwraca 'clone' (lokalny silnik) lub 'browser' (fallback). */
export async function speak(text: string, voiceId = 'suweren'): Promise<'clone' | 'browser'> {
  try {
    const r = await fetch(`${BRIDGE}/api/voice/speak`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId }),
    });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('audio')) {
      const blob = await r.blob();
      if (current) { current.pause(); }
      current = new Audio(URL.createObjectURL(blob));
      await current.play();
      return 'clone';
    }
  } catch { /* fallback */ }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pl-PL';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  return 'browser';
}

/** Pomocnik: Blob (nagranie) → base64 data URL. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
