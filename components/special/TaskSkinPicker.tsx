/**
 * 🎴 TaskSkinPicker — kafelkowy wybór Skórek Zadań (wielokrotnego użytku).
 *
 * 6 standardowych + własne + „+" (kreator). Custom można usunąć i wystawić na GRV.
 * Używany w CoBotSummoner, CrewCreator (Klub Mistrzów), a docelowo AETHER.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TaskSkin, loadSkins, saveCustomSkin, deleteCustomSkin, setSkinForSale,
} from '../../lib/taskSkins';

interface Props {
  selectedId?: string;
  onSelect: (skin: TaskSkin) => void;
  allowCreate?: boolean; // pokaż kafelek „+"
  allowSell?: boolean;   // pokaż przełącznik sprzedaży GRV na custom
}

export const TaskSkinPicker: React.FC<Props> = ({
  selectedId, onSelect, allowCreate = true, allowSell = true,
}) => {
  const [skins, setSkins] = useState<TaskSkin[]>(() => loadSkins());
  const [showCreator, setShowCreator] = useState(false);

  // pola kreatora
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✨');
  const [color, setColor] = useState('#a855f7');
  const [desc, setDesc] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  const refresh = () => setSkins(loadSkins());

  const create = () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    const skin = saveCustomSkin({ name, icon, color, desc, systemPrompt });
    refresh();
    setShowCreator(false);
    setName(''); setIcon('✨'); setColor('#a855f7'); setDesc(''); setSystemPrompt('');
    onSelect(skin);
  };

  const remove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteCustomSkin(id);
    refresh();
  };

  const toggleSale = (e: React.MouseEvent, skin: TaskSkin) => {
    e.stopPropagation();
    const next = !skin.forSale;
    setSkinForSale(skin.id, next, skin.priceGRV ?? 100);
    refresh();
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {skins.map(skin => {
          const active = skin.id === selectedId;
          return (
            <motion.button
              key={skin.id}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(skin)}
              title={skin.desc || skin.name}
              className="relative flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border text-center transition-colors"
              style={{
                borderColor: active ? skin.color : 'rgba(255,255,255,0.10)',
                background: active ? `${skin.color}22` : 'rgba(0,0,0,0.30)',
                boxShadow: active ? `0 0 14px ${skin.color}55` : 'none',
              }}
            >
              <span style={{ fontSize: 20 }}>{skin.icon}</span>
              <span className="text-[11px] font-bold" style={{ color: active ? skin.color : '#cbd5e1' }}>
                {skin.name}
              </span>

              {/* odznaka sprzedaży */}
              {skin.forSale && (
                <span className="absolute top-1 left-1 text-[8px] px-1 rounded bg-emerald-600/80 text-white">GRV</span>
              )}

              {/* akcje custom */}
              {!skin.builtin && (
                <span className="absolute top-1 right-1 flex gap-1">
                  {allowSell && (
                    <span
                      onClick={(e) => toggleSale(e, skin)}
                      title={skin.forSale ? 'Zdejmij z Marketplace' : 'Wystaw na GRV'}
                      className="text-[10px] cursor-pointer hover:scale-125 transition-transform"
                    >
                      {skin.forSale ? '🏷️' : '💱'}
                    </span>
                  )}
                  <span
                    onClick={(e) => remove(e, skin.id)}
                    title="Usuń skórkę"
                    className="text-[10px] text-rose-400/70 hover:text-rose-400 cursor-pointer"
                  >
                    ✕
                  </span>
                </span>
              )}
            </motion.button>
          );
        })}

        {/* kafelek „+" */}
        {allowCreate && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCreator(true)}
            className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-dashed border-white/15 bg-black/20 text-slate-400 hover:text-white hover:border-white/30 transition-colors"
          >
            <span style={{ fontSize: 20 }}>➕</span>
            <span className="text-[11px] font-bold">Nowa</span>
          </motion.button>
        )}
      </div>

      {/* Kreator własnej skórki */}
      <AnimatePresence>
        {showCreator && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowCreator(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-5 space-y-3"
            >
              <h3 className="text-sm font-bold text-purple-200 tracking-wide flex items-center gap-2">
                🎴 Nowa Skórka Zadania
              </h3>

              <div className="flex gap-2">
                <input
                  value={icon} onChange={e => setIcon(e.target.value.slice(0, 2))}
                  className="w-14 text-center text-xl bg-black/40 border border-white/10 rounded-lg px-2 py-2 outline-none"
                  title="Emoji-godło"
                />
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Nazwa skórki..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                />
                <input
                  type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-12 h-[42px] bg-black/40 border border-white/10 rounded-lg cursor-pointer"
                  title="Kolor akcentu"
                />
              </div>

              <input
                value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Krótki opis domeny (opcjonalnie)"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-purple-500"
              />

              <textarea
                value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Dusza skórki (system-prompt) — np. 'Jesteś Mistrzem Pixel-Artu Katedry...'"
                rows={4}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono outline-none focus:border-purple-500 resize-y"
              />

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowCreator(false)}
                  className="flex-1 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:text-white hover:border-slate-500 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  onClick={create}
                  disabled={!name.trim() || !systemPrompt.trim()}
                  className="flex-1 py-2 text-sm font-semibold bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white rounded-lg transition-colors"
                >
                  ✨ Zapisz skórkę
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskSkinPicker;
