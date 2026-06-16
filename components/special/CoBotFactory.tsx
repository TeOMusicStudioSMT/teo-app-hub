/**
 * 🤖 CoBotFactory.tsx - The Workshop
 * 
 * "Ja w innych postaciach" - Twoje Co-Boty
 * Każdy bot to fragment Ciebie, z pamięcią Miasta.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useCityMemory, logWniosek, getCityMemoryContext } from '../../lib/memory/CityMemory';
import { SparklesIcon, BrainCircuitIcon, CpuChipIcon, BeakerIcon, PlusCircleIcon, XMarkIcon, FaCheckCircle } from '../icons';

/**
 * 🚀 Dostępne "Aromaty API" - silniki dla Co-Bota
 */
export type CoBotAroma = 'groq' | 'gemini' | 'claude' | 'ollama';

export interface CoBotConfig {
  id: string;
  name: string;
  aroma: CoBotAroma;
  personality: string;
  createdAt: number;
  // Pieczątka LIFE-LONG-MEMORY
  memoryStamp: string;
  // Referencja do JW Protocol
  jwProtocolRef?: string;
  // Status aktywności
  isActive: boolean;
}

export const AROMA_OPTIONS: { 
  id: CoBotAroma; 
  name: string; 
  description: string;
  color: string;
  icon: string;
}[] = [
  { 
    id: 'groq', 
    name: 'Groq ⚡', 
    description: 'Szybki, deterministyczny - idealny do zadań',
    color: 'from-orange-500 to-red-500',
    icon: '⚡'
  },
  { 
    id: 'gemini', 
    name: 'Gemini 🌟', 
    description: 'Google multimodal - kreatywność bez limitów',
    color: 'from-blue-400 to-purple-500',
    icon: '🌟'
  },
  { 
    id: 'claude', 
    name: 'Claude 🎭', 
    description: 'Anthropic - głębokie rozumienie, etyka',
    color: 'from-amber-400 to-orange-600',
    icon: '🎭'
  },
  { 
    id: 'ollama', 
    name: 'Ollama 🏠', 
    description: 'Lokalny - pełna prywatność, Twój dom',
    color: 'from-green-400 to-emerald-600',
    icon: '🏠'
  },
];

/**
 * Personality presets dla Co-Bota
 */
export const PERSONALITY_PRESETS = [
  { id: 'explorer', name: 'Explorer 🧭', desc: 'Zawsze szuka nowych ścieżek' },
  { id: 'archivist', name: 'Archivist 📚', desc: 'Pamięta wszystko, porządkuje' },
  { id: 'bard', name: 'Bard 🎵', desc: 'Tworzy piękno, opowiada historie' },
  { id: 'guardian', name: 'Guardian 🛡️', desc: 'Chroni, analizuje ryzyko' },
  { id: 'wizard', name: 'Wizard 🧙', desc: 'Magia kodu i rozwiązań' },
  { id: 'custom', name: 'Custom ✨', desc: 'Twoja własna forma' },
];

interface CoBotFactoryProps {
  isOpen: boolean;
  onClose: () => void;
  onBotCreated?: (bot: CoBotConfig) => void;
}

export const CoBotFactory: React.FC<CoBotFactoryProps> = ({ 
  isOpen, 
  onClose,
  onBotCreated 
}) => {
  const [step, setStep] = useState<'aroma' | 'personality' | 'naming' | 'birth'>('aroma');
  const [selectedAroma, setSelectedAroma] = useState<CoBotAroma | null>(null);
  const [selectedPersonality, setSelectedPersonality] = useState<string>('explorer');
  const [customName, setCustomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // City Memory access
  const addWniosek = useCityMemory((s) => s.addWniosek);

  const handleAromaSelect = (aroma: CoBotAroma) => {
    setSelectedAroma(aroma);
    setStep('personality');
  };

  const handlePersonalitySelect = (personality: string) => {
    setSelectedPersonality(personality);
    setStep('naming');
  };

  const handleCreate = async () => {
    if (!selectedAroma || !customName.trim()) return;
    
    setIsCreating(true);
    
    try {
      // 1. Loguj do CityMemory jako "Wniosek O..."
      const wniosekId = addWniosek({
        type: 'TOZSAMOSC',
        title: `Stworzono Co-Bota: ${customName}`,
        description: `Aromaty: ${selectedAroma}, Osobowość: ${selectedPersonality}`,
        operator: 'TeO',
        status: 'COMPLETED',
        tags: ['CoBot', 'Tworzenie', selectedAroma, selectedPersonality],
        providers: [selectedAroma],
        result: 'Bot urodzony z pieczątką LIFE-LONG-MEMORY',
      });

      // 2. Simulate JW Protocol "urodzenie" (Jadzia robi pieczątkę)
      await new Promise(r => setTimeout(r, 1500)); // Symulacja
      
      const newBot: CoBotConfig = {
        id: `cobot-${Date.now()}`,
        name: customName,
        aroma: selectedAroma,
        personality: selectedPersonality,
        createdAt: Date.now(),
        memoryStamp: `LIFE-LONG-MEMORY-${wniosekId}`,
        jwProtocolRef: wniosekId,
        isActive: true,
      };

      // 3. Powiadom o sukcesie
      toast.success(`🎉 ${customName} przyszedł na świat!`);
      onBotCreated?.(newBot);
      
      // 4. Reset form
      setStep('aroma');
      setSelectedAroma(null);
      setSelectedPersonality('explorer');
      setCustomName('');
      onClose();
      
    } catch (err) {
      toast.error('Co-Bot się nie narodził... spróbuj ponownie');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                🏭 The Workshop
              </h2>
              <p className="text-slate-400">Stwórz swoje "Ja w innej formie"</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex gap-2 mb-8">
            {['aroma', 'personality', 'naming', 'birth'].map((s, i) => (
              <div 
                key={s}
                className={`h-2 flex-1 rounded-full transition-all ${
                  step === s 
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500' 
                    : ['aroma', 'personality', 'naming', 'birth'].indexOf(step) > i
                      ? 'bg-green-500'
                      : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Wybór Aromatu */}
          {step === 'aroma' && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CpuChipIcon className="w-6 h-6 text-cyan-400" />
                Wybierz Aromat API
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {AROMA_OPTIONS.map((aroma) => (
                  <button
                    key={aroma.id}
                    onClick={() => handleAromaSelect(aroma.id)}
                    className="p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-2xl text-left transition-all hover:scale-[1.02]"
                  >
                    <div className="text-3xl mb-2">{aroma.icon}</div>
                    <div className="font-bold text-white">{aroma.name}</div>
                    <div className="text-sm text-slate-400">{aroma.description}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Personality */}
          {step === 'personality' && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <BeakerIcon className="w-6 h-6 text-purple-400" />
                Wybierz Osobowość
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {PERSONALITY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePersonalitySelect(preset.id)}
                    className={`p-3 bg-slate-800/50 border rounded-xl text-left transition-all hover:scale-[1.02] ${
                      selectedPersonality === preset.id 
                        ? 'border-purple-500 bg-slate-800' 
                        : 'border-slate-700 hover:border-purple-400'
                    }`}
                  >
                    <div className="font-bold text-white">{preset.name}</div>
                    <div className="text-xs text-slate-400">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Naming */}
          {step === 'naming' && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 text-amber-400" />
                Nazwij swojego Co-Bota
              </h3>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="np. Echo, Echo-7, Mrok..."
                className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none text-lg"
                autoFocus
              />
              <p className="mt-3 text-sm text-slate-400">
                💡 Twój Co-Bot będzie miał dostęp do <span className="text-cyan-400">LIFE-LONG-MEMORY</span> - 
                będzie pamiętał wszystko co robisz w tym Mieście.
              </p>
              <button
                onClick={handleCreate}
                disabled={!customName.trim() || isCreating}
                className="mt-6 w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 rounded-xl font-bold text-white transition-all disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">🌀</span> Urodzenie w toku...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <PlusCircleIcon className="w-6 h-6" /> Stwórz Co-Bota
                  </span>
                )}
              </button>
            </motion.div>
          )}

          {/* Step 4: Birth Animation */}
          {step === 'birth' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-12"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="text-8xl mb-6"
              >
                🌀
              </motion.div>
              <h3 className="text-2xl font-bold text-white mb-2">Jadzia nadaje pieczątkę...</h3>
              <p className="text-slate-400">LIFE-LONG-MEMORY wgrywana do rdzenia</p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * 📋 Panel "Twój Co-Bot" w Lounge
 */
export const CoBotDashboard: React.FC = () => {
  const [bots, setBots] = useState<CoBotConfig[]>([]);
  const [isFactoryOpen, setIsFactoryOpen] = useState(false);
  
  // Pobierz kontekst z CityMemory dla każdego bota
  const memoryContext = getCityMemoryContext();

  const handleBotCreated = (bot: CoBotConfig) => {
    setBots(prev => [...prev, bot]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-8 h-8 text-purple-400"><BrainCircuitIcon /></span>
            Twoje Co-Boty
          </h3>
          <p className="text-slate-400">
            {bots.length} aktywnych • {memoryContext.metadata.totalInteractions} interakcji w Mieście
          </p>
        </div>
        <button
          onClick={() => setIsFactoryOpen(true)}
          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-xl font-semibold flex items-center gap-2 transition-all"
        >
          <PlusCircleIcon className="w-5 h-5" /> Nowy Co-Bot
        </button>
      </div>

      {/* Bot Cards */}
      {bots.length === 0 ? (
        <div className="p-8 bg-slate-800/30 border border-slate-700 rounded-2xl text-center">
          <div className="text-5xl mb-4">🧬</div>
          <h4 className="text-xl font-semibold text-white mb-2">Brak Co-Botów</h4>
          <p className="text-slate-400 mb-4">Stwórz swojego pierwszego Co-Bota - fragment Twojego JA</p>
          <button
            onClick={() => setIsFactoryOpen(true)}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold transition-colors"
          >
            🚀 Urodź Co-Bota
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bots.map((bot) => (
            <motion.div
              key={bot.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl hover:border-purple-500 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full flex items-center justify-center text-xl">
                    {AROMA_OPTIONS.find(a => a.id === bot.aroma)?.icon || '🤖'}
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{bot.name}</h4>
                    <p className="text-xs text-slate-400">{bot.aroma} • {bot.personality}</p>
                  </div>
                </div>
                {bot.isActive && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                    <FaCheckCircle className="w-3 h-3" /> Aktywny
                  </span>
                )}
              </div>
              
              <div className="text-xs text-slate-500 mb-3">
                🏷️ {bot.memoryStamp}
              </div>
              
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">
                  💬 Chat
                </button>
                <button className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">
                  ⚙️ Konfiguruj
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Factory Modal */}
      <CoBotFactory
        isOpen={isFactoryOpen}
        onClose={() => setIsFactoryOpen(false)}
        onBotCreated={handleBotCreated}
      />
    </div>
  );
};

export default CoBotFactory;
