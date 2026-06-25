/**
 * 📱 MobilePocketBadge — „Kieszeń Suwerena": pokazuje się na telefonie/tablecie,
 * informuje że Katedra jest w locie i poleca tryb JusT (VRAM telefonu).
 * Renderuje się TYLKO na urządzeniach mobilnych (inaczej null).
 */
import React from 'react';
import { pocketStatus } from '../../lib/mobile';

export const MobilePocketBadge: React.FC = () => {
  const { mobile, webgpu, nfc } = pocketStatus();
  if (!mobile) return null;

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 font-mono text-cyan-200 mb-3">
      <div className="text-xs font-bold tracking-wider flex items-center gap-2 mb-1">
        📱 KIESZEŃ SUWERENA — Katedra w locie (0.00G)
      </div>
      <div className="text-[11px] text-cyan-300/80 leading-relaxed">
        {webgpu
          ? 'Wykryto VRAM (WebGPU) — polecam tryb JusT (on-device): liczy lokalnie, offline, zero telemetrii.'
          : 'Brak WebGPU w tej przeglądarce — użyj Chrome (Android) dla trybu JusT na VRAM telefonu.'}
      </div>
      <div className="flex gap-2 mt-2 text-[9px]">
        <span className={`px-1.5 py-0.5 rounded border ${webgpu ? 'border-emerald-500/40 text-emerald-300' : 'border-zinc-700 text-zinc-500'}`}>
          {webgpu ? '⚡ VRAM/WebGPU ✓' : '⚡ WebGPU —'}
        </span>
        <span className={`px-1.5 py-0.5 rounded border ${nfc ? 'border-fuchsia-500/40 text-fuchsia-300' : 'border-zinc-700 text-zinc-500'}`}>
          {nfc ? '💍 NFC Pierścień ✓' : '💍 NFC —'}
        </span>
      </div>
    </div>
  );
};

export default MobilePocketBadge;
