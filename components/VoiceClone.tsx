/**
 * 🎤 VoiceClone — suwerenne klonowanie głosu w Twojej Katedrze.
 * Nagrywasz ~12s próbki → zapis LOKALNY → test mowy (lokalny silnik klonu lub
 * fallback przeglądarki). Każdy może to zrobić u siebie, zero chmury.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { voiceStatus, cloneVoice, speak, blobToBase64, VoiceStatus } from '../services/voiceService';

export const VoiceClone: React.FC = () => {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [testText, setTestText] = useState('Witaj w mojej Katedrze. Mówię Twoim głosem.');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const refresh = useCallback(async () => setStatus(await voiceStatus()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const startRec = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setBusy(true); setMsg('💾 Zapisuję próbkę lokalnie...');
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const b64 = await blobToBase64(blob);
          const d = await cloneVoice(b64, 'suweren');
          if (!d.success) throw new Error(d.message || 'błąd');
          setMsg(`✅ Głos zapisany lokalnie (${(d.bytes / 1024).toFixed(0)} KB). Przetestuj.`);
          refresh();
        } catch (e: any) { setMsg(`⚠ ${e.message} — uruchom Wiesio-Bridge (:3001).`); }
        finally { setBusy(false); }
      };
      rec.start(); recRef.current = rec; setRecording(true); setMsg('🎤 Nagrywam ~12s — mów naturalnie...');
      timerRef.current = setTimeout(() => stopRec(), 12000);
    } catch { setMsg('⚠ Brak dostępu do mikrofonu.'); }
  }, [refresh]);

  const stopRec = useCallback(() => {
    clearTimeout(timerRef.current);
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
    setRecording(false);
  }, []);

  const test = useCallback(async () => {
    setMsg('🔊 Mówię...');
    const mode = await speak(testText, 'suweren');
    setMsg(mode === 'clone' ? '✅ Mowa z lokalnego klonu Twojego głosu.' : 'ℹ️ Fallback przeglądarki (zainstaluj XTTS/OpenVoice dla klonu).');
  }, [testText]);

  return (
    <div className="rounded-xl border border-fuchsia-500/25 bg-slate-950/80 p-4 font-mono">
      <div className="text-[10px] tracking-widest text-fuchsia-500/60">∴ GŁOS SUWERENA (suwerenny klon) ∴</div>
      <div className="text-sm font-bold text-fuchsia-300 mb-1">🎤 Klonowanie głosu — lokalnie, zero chmury</div>
      <div className="text-[10px] text-slate-400 mb-3">
        {status?.available ? '🟢 Lokalny silnik klonu gotowy.' : '🟡 Fallback przeglądarki (działa od razu). Klon głosu → zainstaluj XTTS/OpenVoice na :5002.'}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {!recording ? (
          <button onClick={startRec} disabled={busy}
            className="px-4 py-1.5 rounded border border-rose-500/50 bg-rose-950/30 text-rose-300 text-xs font-bold hover:bg-rose-900/50 disabled:opacity-50">
            ● NAGRAJ PRÓBKĘ (12s)
          </button>
        ) : (
          <button onClick={stopRec}
            className="px-4 py-1.5 rounded border border-rose-400 bg-rose-900/50 text-rose-200 text-xs font-bold animate-pulse">
            ■ STOP (nagrywam...)
          </button>
        )}
        <button onClick={test} disabled={busy}
          className="px-4 py-1.5 rounded border border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-300 text-xs font-bold hover:bg-fuchsia-900/50 disabled:opacity-50">
          🔊 TEST MOWY
        </button>
      </div>

      <input value={testText} onChange={e => setTestText(e.target.value)}
        className="w-full mt-2 bg-black/40 border border-fuchsia-500/20 rounded px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-fuchsia-500" />
      {msg && <div className="text-[10px] text-slate-400 mt-2">{msg}</div>}
    </div>
  );
};

export default VoiceClone;
