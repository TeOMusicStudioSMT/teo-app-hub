/**
 * 🏛️ KatedraChat.tsx — Autonomiczny Organizm v5
 *
 * Architektura agentów:
 *   ⚡ Klaudiusz  — szybki (Enter),   OLLAMA: fastModel     | CHMURA: cloudFastModel
 *   🏛️ Adamus    — ciężki (Rada btn), OLLAMA: heavyModel    | CHMURA: cloudHeavyModel
 *   🔍 Moderator — w tle, po każdej odpowiedzi, analiza & ewentualna interwencja
 *   ⚙️ Terminal  — wyniki EXEC_SYSTEM (Space Agent)
 *
 * Naprawione w v5:
 *   - cloudFastModel / cloudHeavyModel — osobne selecty chmury per rola
 *   - sendMessage ZAWSZE → Klaudiusz (isCouncilMode nie miksuje ról przy Enter)
 *   - handleCouncilConsultation resetuje isCouncilMode po zakończeniu
 *   - Moderator: fire-and-forget, tylko gdy ma coś do powiedzenia
 *   - dispatchCloud: isGemini routing po model.startsWith('gemini-')
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Copy, Save, Archive, Upload, Users, MessageSquare,
    Brain, Sparkles, Terminal, Zap, Settings, RefreshCw,
    Cloud, Cpu, X, Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiDyrygent, CLOUD_MODELS, ImageAttachment } from '../../lib/router/ApiDyrygent';

// ══════════════════════════════════════════════════════════════════
// BLOK KODU z przyciskiem "⚡ Wdróż do Katedry"
// ══════════════════════════════════════════════════════════════════

/** Domyślna ścieżka wdrożenia na podstawie języka */
const defaultDeployPath = (lang: string): string => {
    const l = lang.toLowerCase();
    if (l === 'tsx' || l === 'jsx')  return 'components/special/';
    if (l === 'ts'  || l === 'js')   return 'lib/';
    if (l === 'css' || l === 'scss') return 'styles/';
    if (l === 'json')                return '_AntiGravity_Wymiar/';
    return 'components/special/';
};

const CodeBlock: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
    const [copied, setCopied] = useState(false);
    const [deploying, setDeploying] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDeploy = async () => {
        const suggested = defaultDeployPath(lang);
        const filePath = window.prompt(
            'Podaj ścieżkę pliku (np. components/special/Nazwa.tsx):',
            suggested,
        );
        if (!filePath?.trim()) return;

        // Ochrona — lista plików krytycznych, których "Wdróż" nie może nadpisać
        const PROTECTED_FILES = [
            'App.tsx', 'main.tsx', 'index.tsx',
            'wiesio-bridge.js', 'vite.config.ts', 'tsconfig.json',
            'components/special/WniosekO.tsx',
            'components/special/KatedraChat.tsx',
            'context/GravitonProvider.tsx',
            'lib/router/ApiDyrygent.ts',
        ];
        const normalized = filePath.trim().replace(/\\/g, '/');
        if (PROTECTED_FILES.some(p => normalized.endsWith(p))) {
            toast.error(`🛡️ Plik chroniony — nie można nadpisać przez Wdróż: ${normalized}`);
            return;
        }

        setDeploying(true);
        try {
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    action:   'WRITE_FILE',
                    filename: filePath.trim(),
                    content:  code,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`⚡ Zmaterializowano: ${filePath.trim()}`);
            } else {
                toast.error(`❌ Wdróż błąd: ${data.message}`);
            }
        } catch (err: any) {
            toast.error(`❌ Wiesław offline: ${err.message}`);
        } finally {
            setDeploying(false);
        }
    };

    return (
        <div className="my-2 rounded-lg overflow-hidden bg-slate-950 border border-slate-700/60">
            {/* Pasek nagłówka */}
            <div className="flex items-center justify-between px-3 py-1.5
                            bg-slate-800/90 border-b border-slate-700/50">
                <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">
                    {lang || 'kod'}
                </span>
                <div className="flex items-center gap-1.5">
                    {/* Kopiuj */}
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded
                                   bg-slate-700/60 hover:bg-slate-600 text-slate-300
                                   transition-colors border border-slate-600/40"
                    >
                        {copied ? '✓ Skopiowano' : '📋 Kopiuj'}
                    </button>
                    {/* Wdróż */}
                    <button
                        onClick={handleDeploy}
                        disabled={deploying}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded
                                   bg-purple-700/70 hover:bg-purple-600 text-purple-100
                                   transition-colors border border-purple-500/40
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Zapisz ten kod do pliku w projekcie przez Wiesława"
                    >
                        {deploying ? '⏳ Wdrażam...' : '⚡ Wdróż do Katedry'}
                    </button>
                </div>
            </div>
            {/* Kod */}
            <pre className="p-3 overflow-x-auto text-xs font-mono text-emerald-300
                            leading-relaxed max-h-[480px] overflow-y-auto">
                <code>{code}</code>
            </pre>
        </div>
    );
};

/**
 * Renderuje treść wiadomości — zwykły tekst i bloki kodu (``` ... ```)
 * Dla streamujących wiadomości: plain text (szybciej, bez parsowania)
 */
const MessageContent: React.FC<{ content: string; streaming?: boolean }> = ({
    content,
    streaming,
}) => {
    if (streaming || !content) {
        return <span className="whitespace-pre-wrap">{content}</span>;
    }

    // Podziel po blokach kodu — match backtick fence z opcjonalnym językiem
    const parts = content.split(/(```(?:[^\n`]*)?\n[\s\S]*?```)/g);

    return (
        <>
            {parts.map((part, i) => {
                const match = part.match(/^```([^\n`]*?)?\n([\s\S]*?)```$/);
                if (match) {
                    const lang = (match[1] ?? '').trim();
                    const code = match[2] ?? '';
                    return <CodeBlock key={i} lang={lang} code={code} />;
                }
                return (
                    <span key={i} className="whitespace-pre-wrap">
                        {part}
                    </span>
                );
            })}
        </>
    );
};

// ── Progi tokenów Claude (tryb high-res: 1750 tokenów/kafelek 512x512 + 85 bazowych) ──
const estimateClaudeTokens = (w: number, h: number): number =>
    Math.ceil(w / 512) * Math.ceil(h / 512) * 1750 + 85;

/** Kompresja obrazu przez Canvas API — zwraca gotowy ImageAttachment */
async function compressImage(
    file: File,
    maxDim  = 1024,
    quality = 0.78,
): Promise<ImageAttachment> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                const { naturalWidth: ow, naturalHeight: oh } = img;
                const scale  = Math.min(1, maxDim / Math.max(ow, oh));
                const nw     = Math.round(ow * scale);
                const nh     = Math.round(oh * scale);

                const canvas = document.createElement('canvas');
                canvas.width  = nw;
                canvas.height = nh;
                canvas.getContext('2d')!.drawImage(img, 0, 0, nw, nh);

                const base64 = canvas.toDataURL('image/jpeg', quality);
                resolve({
                    base64,
                    mediaType:        'image/jpeg',
                    width:             nw,
                    height:            nh,
                    originalSizeKB:   Math.round(file.size / 1024),
                    compressedSizeKB: Math.round(base64.length * 0.75 / 1024),
                    estimatedTokens:  estimateClaudeTokens(nw, nh),
                });
            };
            img.onerror = reject;
            img.src = ev.target!.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ── Typy ──────────────────────────────────────────────────────────
type SenderType = 'human' | 'klaudiusz' | 'adamus' | 'system' | 'terminal' | 'moderator';

interface Message {
    id:          string;
    sender:      SenderType;
    content:     string;
    timestamp:   Date;
    streaming?:  boolean;
    attachments?: Array<{ type: 'file'|'image'|'video'; name: string; url: string; size: number }>;
}

interface ChatMemory {
    id: string; title: string; summary: string;
    timestamp: Date; messages: Message[]; tags: string[];
}

type SourceMode = 'ollama' | 'cloud';

// ── Stałe wizualne ────────────────────────────────────────────────
const SENDER_LABELS: Record<SenderType, string> = {
    human:     'Suweren',
    klaudiusz: 'Klaudiusz',
    adamus:    'Adamus (Rada)',
    system:    'System',
    terminal:  '⚙️ Terminal',
    moderator: '🔍 Moderator',
};

const SENDER_STYLES: Record<SenderType, string> = {
    human:     'bg-purple-600 text-white',
    klaudiusz: 'bg-slate-700 text-purple-100 border border-purple-500/30',
    adamus:    'bg-amber-900/80 text-amber-100 border border-amber-500/40',
    system:    'bg-blue-900/60 text-blue-100 border border-blue-500/30',
    terminal:  'bg-slate-900 text-green-400 border border-green-500/30 font-mono text-sm',
    moderator: 'bg-slate-800/80 text-cyan-300 border border-cyan-500/20 text-xs italic',
};

// ── System prompty dla chmury ─────────────────────────────────────
const SYSTEM_PROMPTS = {
    klaudiusz: 'Jesteś Klaudiuszem — asystentem AI systemu OtakOS. ' +
               'Pomagasz Suweren\'owi: kod React/TypeScript, kryptowaluty, automatyzacja, ' +
               'development. Odpowiadaj po polsku, zwięźle i konkretnie.',
    adamus:    'Jesteś Adamusem — głównym analitykiem i architektem systemu OtakOS. ' +
               'Twoje odpowiedzi są głębsze, strategiczne i wielowymiarowe. ' +
               'Pomagasz Suweren\'owi podejmować kluczowe decyzje. Odpowiadaj po polsku.',
};

// ── Mini select ───────────────────────────────────────────────────
const DarkSelect: React.FC<{
    value: string; onChange: (v: string) => void;
    options: { value: string; label?: string }[]; color?: string;
}> = ({ value, onChange, options, color = '#c4b5fd' }) => (
    <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ colorScheme: 'dark', color }}
        className="bg-slate-800 text-xs px-2 py-1 rounded border border-slate-600
                   outline-none hover:border-purple-400 transition-colors cursor-pointer
                   max-w-[200px] truncate"
    >
        {!options.find(o => o.value === value) && (
            <option value={value}>{value}</option>
        )}
        {options.map(o => (
            <option key={o.value} value={o.value}>{o.label || o.value}</option>
        ))}
    </select>
);

// ══════════════════════════════════════════════════════════════════
// KOMPONENT GŁÓWNY
// ══════════════════════════════════════════════════════════════════
const KatedraChat: React.FC = () => {

    // ── Stan czatu ────────────────────────────────────────────────
    const [messages, setMessages]         = useState<Message[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [chatMemory, setChatMemory]     = useState<ChatMemory[]>([]);
    const [isLoading, setIsLoading]       = useState(false);
    const [statusLine, setStatusLine]     = useState('');
    // isCouncilMode = "sticky council" — Enter nadal idzie do Klaudiusza!
    // Aktywuje się tylko po kliknięciu Rada i resetuje po zakończeniu.
    const [isCouncilMode, setIsCouncilMode] = useState(false);

    // ── Stan ustawień modeli ──────────────────────────────────────
    const [showSettings, setShowSettings]   = useState(false);
    const [sourceMode, setSourceMode]       = useState<SourceMode>('ollama');

    // Ollama modele
    const [fastModel, setFastModel]   = useState(ApiDyrygent.getFastModel());
    const [heavyModel, setHeavyModel] = useState(ApiDyrygent.getHeavyModel());
    const [ollamaModels, setOllamaModels]   = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    // Chmura — OSOBNE modele dla Klaudiusza i Adamusa
    const [cloudFastModel,  setCloudFastModel]  = useState(ApiDyrygent.getCloudFastModel());
    const [cloudHeavyModel, setCloudHeavyModel] = useState(ApiDyrygent.getCloudHeavyModel());

    // Moderator
    const [showModerator, setShowModerator] = useState(true);

    // Załączniki — przetworzone obrazy czekające na wysyłkę
    const [pendingAttachments, setPendingAttachments] = useState<ImageAttachment[]>([]);
    const [attachProcessing, setAttachProcessing]     = useState(false);

    // ── Refs ──────────────────────────────────────────────────────
    const fileInputRef        = useRef<HTMLInputElement>(null);
    const messagesEndRef      = useRef<HTMLDivElement>(null);
    const scrollContainerRef  = useRef<HTMLDivElement>(null);
    const abortRef            = useRef<AbortController | null>(null);
    const moderatorAbortRef   = useRef<AbortController | null>(null);

    // ── Smart Scroll ──────────────────────────────────────────────
    // `isAtBottom` — czy użytkownik jest blisko dołu (próg: 80px).
    // Auto-scroll odpala się TYLKO gdy true; ręczny scroll do góry blokuje.
    const isAtBottom = useRef(true);

    // `showScrollBadge` — badge "⬇ Nowe wiadomości" widoczny gdy user przescrolował do góry
    const [showScrollBadge, setShowScrollBadge] = useState(false);

    /** Aktualizuj `isAtBottom` przy każdym scroll evencie kontenera */
    const handleScroll = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        // scrollTop + clientHeight ≥ scrollHeight - 150px → uznajemy za "dół"
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        isAtBottom.current = atBottom;
        // Badge pojawia się gdy user jest POWYŻEJ dołu
        setShowScrollBadge(!atBottom);
    }, []);

    /** Scrolluj do dołu tylko gdy użytkownik jest przy dole (lub wymuszenie) */
    const scrollToBottom = useCallback((force = false) => {
        if (!force && !isAtBottom.current) return; // zablokowany ręcznym scrollem
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (force) {
            // Wymuszone (koniec streamingu) — resetuj stan "użytkownik u dołu"
            isAtBottom.current = true;
            setShowScrollBadge(false);
        }
    }, []);

    // Auto-scroll przy każdym tokenie — respektuje pozycję użytkownika
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => { loadOllamaModels(); }, []);

    // ── Helpers wiadomości ────────────────────────────────────────
    const addMessage = (msg: Omit<Message, 'id' | 'timestamp'>): string => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setMessages(prev => [...prev, { ...msg, id, timestamp: new Date() }]);
        return id;
    };

    const updateMessage = (id: string, patch: Partial<Message>) =>
        setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));

    const setStatus = (text: string, clear = false) => {
        setStatusLine(text);
        if (clear) setTimeout(() => setStatusLine(''), 3000);
    };

    // ── Zarządzanie modelami ──────────────────────────────────────
    const loadOllamaModels = useCallback(async () => {
        setLoadingModels(true);
        try {
            const models = await ApiDyrygent.fetchOllamaModels();
            setOllamaModels(models);
            setStatus(models.length > 0
                ? `✅ ${models.length} modeli Ollama`
                : '⚠️ Brak modeli — Wiesław offline?', true);
        } catch {
            setStatus('❌ Nie można pobrać modeli', true);
        } finally {
            setLoadingModels(false);
        }
    }, []);

    const saveFastModel = (m: string) => { setFastModel(m); localStorage.setItem('otakos_active_model', m); };
    const saveHeavyModel = (m: string) => { setHeavyModel(m); localStorage.setItem('otakos_heavy_model', m); };
    const saveCloudFastModel = (m: string) => { setCloudFastModel(m); localStorage.setItem('otakos_cloud_fast_model', m); };
    const saveCloudHeavyModel = (m: string) => { setCloudHeavyModel(m); localStorage.setItem('otakos_cloud_heavy_model', m); };

    // ── Historia konwersacji (dla multi-turn context) ─────────────
    /**
     * Buduje tablicę {role, content} ze stanu messages.
     * Uwzględnia tylko faktyczne wypowiedzi (human/klaudiusz/adamus),
     * pomija system/moderator/terminal i wiadomości aktualnie streamowane.
     * Każda wiadomość skrócona do 2000 znaków by nie przekroczyć limitu payload.
     */
    const buildHistory = useCallback(
        (): Array<{ role: 'user' | 'assistant'; content: string }> =>
            messages
                .filter(m =>
                    (m.sender === 'human' || m.sender === 'klaudiusz' || m.sender === 'adamus') &&
                    !m.streaming &&
                    m.content.trim().length > 0,
                )
                .map(m => ({
                    role:    (m.sender === 'human' ? 'user' : 'assistant') as 'user' | 'assistant',
                    content: m.content.substring(0, 2000),
                })),
        [messages],
    );

    // ── Getter dyspozytora ─────────────────────────────────────────
    /**
     * Zwraca właściwą funkcję dispatch na podstawie:
     *   sourceMode: 'ollama' | 'cloud'
     *   heavy: false → Klaudiusz, true → Adamus
     *
     * Czwarty argument `hist` — opcjonalna historia multi-turn.
     *
     * ROUTING CHMURY:
     *   model.startsWith('gemini-') → /api/gemini (klucz Google z Kibla)
     *   reszta                      → /api/claude  (klucz Anthropic z Kibla)
     */
    const getDispatch = useCallback((heavy: boolean) => {
        if (sourceMode === 'cloud') {
            // ← NAPRAWKA: każda rola ma SWÓJ model chmury
            const model = heavy ? cloudHeavyModel : cloudFastModel;
            const sys   = heavy ? SYSTEM_PROMPTS.adamus : SYSTEM_PROMPTS.klaudiusz;
            return (
                msg:  string,
                cb:   (t: string) => void,
                sig?: AbortSignal,
                hist?: Array<{ role: 'user' | 'assistant'; content: string }>,
            ) => ApiDyrygent.dispatchCloud(msg, model, sys, cb, sig, undefined, hist);
        }
        // Ollama
        const model = heavy ? heavyModel : fastModel;
        const sys   = heavy ? SYSTEM_PROMPTS.adamus : SYSTEM_PROMPTS.klaudiusz;
        return (
            msg:  string,
            cb:   (t: string) => void,
            sig?: AbortSignal,
            hist?: Array<{ role: 'user' | 'assistant'; content: string }>,
        ) => ApiDyrygent.dispatchViaWieslaw(msg, model, cb, sig, hist, sys);
    }, [sourceMode, cloudFastModel, cloudHeavyModel, fastModel, heavyModel]);

    // ── Helpers ───────────────────────────────────────────────────
    const extractTags = (c: string) =>
        ['kod', 'react', 'typescript', 'ui', 'agent', 'trading', 'system', 'bash']
            .filter(t => c.toLowerCase().includes(t));

    const getParticipants = (msgs: Message[]) =>
        Array.from(new Set(msgs.map(m => m.sender))).map(s => SENDER_LABELS[s]);

    const extractMainTopic = (msgs: Message[]) => {
        const text = msgs.map(m => m.content).join(' ').toLowerCase();
        return ['trading','component','react','agent','system','kod','terminal']
            .filter(k => text.includes(k)).slice(0,3).join(', ') || 'ogólna dyskusja';
    };

    // ── Moderator (Trzeci Agent) ──────────────────────────────────
    /**
     * Fire-and-forget: analizuje ostatnią wymianę.
     * Dodaje wiadomość tylko gdy zwróci [MODERATOR] prefix.
     * Całkowicie nieskrępowany — nie blokuje UI.
     */
    const runModerator = useCallback((userMsg: string, agentMsg: string) => {
        if (!showModerator) return;
        const context = `Suweren: "${userMsg.substring(0, 300)}"\nAgent: "${agentMsg.substring(0, 400)}"`;

        // Anuluj poprzednie (nowa rozmowa ważniejsza)
        moderatorAbortRef.current?.abort();
        const ctrl = new AbortController();
        moderatorAbortRef.current = ctrl;

        // Fire and forget — nie await
        ApiDyrygent.dispatchModerator(context, ctrl.signal)
            .then(result => {
                if (ctrl.signal.aborted) return;
                const trimmed = result.trim();
                if (trimmed.startsWith('[MODERATOR]') && trimmed.length > 12) {
                    addMessage({
                        sender:  'moderator',
                        content: trimmed.replace('[MODERATOR]', '').trim(),
                    });
                }
            })
            .catch(() => { /* Moderator milczy gdy offline */ });
    }, [showModerator]);

    // ── PĘTLA SPACE AGENTA ─────────────────────────────────────────
    const handleOllamaResponse = useCallback(async (
        fullText: string, msgId: string, isHeavy = false,
    ): Promise<void> => {
        const bashMatch = fullText.match(/```(?:bash|sh|shell|cmd|powershell)[\s\S]*?\n([\s\S]*?)```/);
        if (!bashMatch || !bashMatch[1]) return;

        const command = bashMatch[1].trim();
        if (!command) return;

        console.log('[SpaceAgent] 🚀 Komenda:', command.substring(0, 80));

        updateMessage(msgId, {
            content: fullText.replace(
                bashMatch[0],
                `\`\`\`bash\n${command}\n\`\`\`\n> *⚙️ Wykonuję...*`,
            ),
        });
        setStatus(`⚙️ Terminal: ${command.substring(0, 50)}...`);

        const result = await ApiDyrygent.execSystem(command, 60000);
        const snippet = result.output.slice(0, 800);

        updateMessage(msgId, {
            content: fullText.replace(
                bashMatch[0],
                `\`\`\`bash\n${command}\n\`\`\`` +
                `\n\n**Wynik** (${result.success ? '✅' : '❌'}):\n\`\`\`\n${snippet}\n\`\`\``,
            ),
            streaming: false,
        });

        addMessage({ sender: 'terminal', content: `$ ${command}\n\n${snippet}` });
        setStatus(result.success ? '✅ Komenda wykonana' : '❌ Błąd komendy', true);

        // Zamknięcie pętli — wynik wraca do agenta
        const followUp =
            `[KONTEKST SYSTEMOWY]\nKomenda bash wykonana przez Wiesław.\n` +
            `KOMENDA: ${command}\nSTATUS: ${result.success ? 'SUKCES' : 'BŁĄD'}\n` +
            `WYNIK:\n${result.output}\n\nPotwierdź (max 3 zdania).`;

        setStatus('🔄 Agent analizuje wynik...');
        const contId = addMessage({
            sender:    isHeavy ? 'adamus' : 'klaudiusz',
            content:   '',
            streaming: true,
        });

        try {
            let contText = '';
            await getDispatch(isHeavy)(followUp, tok => {
                contText += tok;
                updateMessage(contId, { content: contText });
            });
            updateMessage(contId, { streaming: false });
            scrollToBottom(true); // ← SMART SCROLL: wymuś zjazd po końcu pętli SpaceAgenta
            setStatus('✅ Pętla SpaceAgenta zamknięta', true);
            if (contText.includes('```bash') || contText.includes('```sh')) {
                await handleOllamaResponse(contText, contId, isHeavy);
            }
        } catch {
            updateMessage(contId, { content: '[Agent nie mógł przetworzyć wyniku]', streaming: false });
        }
    }, [getDispatch, scrollToBottom]);

    // ── Wysyłanie wiadomości → ZAWSZE Klaudiusz ───────────────────
    /**
     * NAPRAWKA: sendMessage ZAWSZE wysyła do Klaudiusza (heavy=false).
     * isCouncilMode NIE wpływa na routing tutaj — nie miksujemy ról!
     * Konsultacja z Adamusem jest WYŁĄCZNIE przez przycisk "Rada".
     */
    const sendMessage = useCallback(async () => {
        const text = currentInput.trim();
        if ((!text && pendingAttachments.length === 0) || isLoading) return;
        setCurrentInput('');
        const attachmentsToSend = [...pendingAttachments];
        setPendingAttachments([]);

        const totalTokens = attachmentsToSend.reduce((s, a) => s + a.estimatedTokens, 0);
        const humanContent = text + (attachmentsToSend.length > 0
            ? `\n\n[📎 ${attachmentsToSend.length} obraz(y): ` +
              attachmentsToSend.map(a =>
                  `${a.width}×${a.height}px, ${a.compressedSizeKB}KB ~${a.estimatedTokens}tok`
              ).join(', ') + `]`
            : '');

        addMessage({
            sender: 'human',
            content: humanContent,
            attachments: attachmentsToSend.map(a => ({
                type: 'image' as const,
                name: `obraz_${a.width}x${a.height}.jpg`,
                url:  a.base64,
                size: a.compressedSizeKB * 1024,
            })),
        });
        setIsLoading(true);

        const modelLabel = sourceMode === 'cloud' ? cloudFastModel : fastModel;
        const tokenWarn  = totalTokens > 8000 ? ` ⚠️ ${totalTokens.toLocaleString()} tokenów` : '';
        setStatus(`⚡ Klaudiusz myśli... (${modelLabel})${tokenWarn}`);

        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        const replyId = addMessage({ sender: 'klaudiusz', content: '', streaming: true });

        try {
            let fullText = '';
            const dispatch = getDispatch(false); // false = Klaudiusz zawsze
            const history  = buildHistory();     // ← cała historia konwersacji

            // Dla chmury przekazujemy obrazy; dla Ollamy tylko tekst (brak vision API w /api/ollama)
            if (sourceMode === 'cloud' && attachmentsToSend.length > 0) {
                await ApiDyrygent.dispatchCloud(
                    text || '(opisz ten obraz)',
                    cloudFastModel,
                    SYSTEM_PROMPTS.klaudiusz,
                    tok => { fullText += tok; updateMessage(replyId, { content: fullText }); },
                    ctrl.signal,
                    attachmentsToSend,
                    history,   // ← historia przy obrazach
                );
            } else {
                await dispatch(
                    text + (attachmentsToSend.length > 0
                        ? `\n\n[Suweren dołączył ${attachmentsToSend.length} obraz(y), ` +
                          `ale tryb Ollama nie obsługuje vision — opisz co widzisz na podstawie tekstu]`
                        : ''),
                    (tok: string) => { fullText += tok; updateMessage(replyId, { content: fullText }); },
                    ctrl.signal,
                    history,   // ← historia multi-turn
                );
            }
            updateMessage(replyId, { streaming: false });
            scrollToBottom(true); // ← SMART SCROLL: wymuś zjazd po końcu streamingu
            setStatus('', true);
            await handleOllamaResponse(fullText, replyId, false);

            // Moderator w tle — bez await
            runModerator(text, fullText);

        } catch (err: any) {
            if (err.name !== 'AbortError') {
                updateMessage(replyId, {
                    content:   `[Błąd połączenia z Klaudiuszem: ${err.message}]`,
                    streaming: false,
                });
                setStatus(`❌ ${err.message}`, true);
            }
        } finally {
            setIsLoading(false);
        }
    }, [currentInput, isLoading, sourceMode, cloudFastModel, fastModel,
        buildHistory, getDispatch, handleOllamaResponse, runModerator, scrollToBottom]);

    // ── Konsultacja z Radą (Adamus) ────────────────────────────────
    /**
     * NAPRAWKA: resetuje isCouncilMode po zakończeniu.
     * Jednorazowe wezwanie — po zakończeniu powraca do normalnego trybu.
     * Jeśli użytkownik chce "zostać z Radą" może kliknąć przycisk ponownie.
     */
    const handleCouncilConsultation = useCallback(async () => {
        // ── Pełna historia konwersacji dla Rady (strukturalna, multi-turn) ──
        // Adamus dostaje całą historię jako tablicę {role, content},
        // a nie sformatowany string — LLM "widzi" poprzednie tury natywnie.
        const history = buildHistory();

        const context = history.length > 0
            ? 'Przeanalizuj powyższą rozmowę i doradź Suwerenowi. ' +
              'Odpowiedz jako Adamus — architekt systemu OtakOS.'
            : 'Jako Adamus, przedstaw się i powiedz co możesz zrobić dla Suwerena.';

        setIsCouncilMode(true);
        setIsLoading(true);
        const modelLabel = sourceMode === 'cloud' ? cloudHeavyModel : heavyModel;
        setStatus(`🏛️ Wzywa Adamus... (${modelLabel})`);

        addMessage({
            sender:  'system',
            content: `🏛️ **RADA WEZWANA** — Adamus (${modelLabel}) przejmuje analizę...`,
        });

        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        const councilId = addMessage({ sender: 'adamus', content: '', streaming: true });

        try {
            let fullText = '';
            await getDispatch(true)(    // ← true = Adamus
                context,
                tok => {
                    fullText += tok;
                    updateMessage(councilId, { content: fullText });
                },
                ctrl.signal,
                history,   // ← historia multi-turn dla Adamusa
            );
            updateMessage(councilId, { streaming: false });
            scrollToBottom(true); // ← SMART SCROLL: wymuś zjazd po końcu streamingu Adamusa
            setStatus('', true);
            await handleOllamaResponse(fullText, councilId, true);

            // Moderator po radzie też
            runModerator(context, fullText);

        } catch (err: any) {
            if (err.name !== 'AbortError') {
                updateMessage(councilId, {
                    content:   `[Adamus niedostępny: ${err.message}]`,
                    streaming: false,
                });
                setStatus(`❌ Adamus: ${err.message}`, true);
            }
        } finally {
            setIsLoading(false);
            setIsCouncilMode(false);  // ← NAPRAWKA: reset po zakończeniu
        }
    }, [buildHistory, sourceMode, cloudHeavyModel, heavyModel,
        getDispatch, handleOllamaResponse, runModerator, scrollToBottom]);

    // ── Zapis / upload ────────────────────────────────────────────
    const handleCopyResponse = (c: string) => {
        navigator.clipboard.writeText(c);
        setStatus('📋 Skopiowano!', true);
    };

    const handleSaveResponse = (msg: Message) => {
        setChatMemory(prev => [...prev, {
            id:        Date.now().toString(),
            title:     `Pamięć ${new Date().toLocaleDateString()}`,
            summary:   msg.content.substring(0, 120) + '...',
            timestamp: new Date(), messages: [msg],
            tags:      extractTags(msg.content),
        }]);
        setStatus('💾 Zapisano!', true);
    };

    const handleSaveConversation = async () => {
        if (!messages.length) return;
        const content =
            `# ARCHIWUM KATEDRY OTAKOS\n**Data:** ${new Date().toISOString()}\n` +
            `**Uczestnicy:** ${getParticipants(messages).join(', ')}\n\n` +
            messages.map(m =>
                `**${SENDER_LABELS[m.sender]}** (${m.timestamp.toLocaleTimeString()}):\n${m.content}`
            ).join('\n\n---\n\n');
        try {
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'WRITE_FILE',
                    filename: `Katedra/konwersacja_${Date.now()}.md`,
                    content,
                }),
            });
            const d = await res.json();
            setStatus(d.success ? '💾 Archiwum zapisane!' : '❌ Błąd zapisu', true);
        } catch {
            setStatus('❌ Wiesław offline', true);
        }
    };

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        // Resetuj input, by ten sam plik można wybrać ponownie
        e.target.value = '';
        setAttachProcessing(true);

        for (const file of files) {
            const isImage = file.type.startsWith('image/');

            if (isImage) {
                try {
                    setStatus(`🖼️ Kompresuję ${file.name}...`);
                    const attachment = await compressImage(file, 1024, 0.78);

                    // Ostrzeżenia tokenowe
                    if (attachment.estimatedTokens > 12_000) {
                        setStatus(
                            `⚠️ ${file.name}: ~${attachment.estimatedTokens.toLocaleString()} tokenów! ` +
                            `(Claude Sonnet może odrzucić)`, true
                        );
                    } else if (attachment.estimatedTokens > 5_000) {
                        setStatus(
                            `⚡ ${file.name}: ~${attachment.estimatedTokens.toLocaleString()} tokenów ` +
                            `(${attachment.compressedSizeKB}KB)`, true
                        );
                    } else {
                        setStatus(
                            `✅ ${file.name} skompresowany: ${attachment.originalSizeKB}KB → ` +
                            `${attachment.compressedSizeKB}KB (~${attachment.estimatedTokens} tokenów)`, true
                        );
                    }

                    setPendingAttachments(prev => [...prev, attachment]);
                } catch (err) {
                    setStatus(`❌ Błąd kompresji ${file.name}`, true);
                }
            } else {
                // Nie-obrazy: dodaj jako tekst
                setCurrentInput(p => p + `[Plik: ${file.name}] `);
            }
        }
        setAttachProcessing(false);
    }, []);

    const stopGeneration = () => {
        abortRef.current?.abort();
        moderatorAbortRef.current?.abort();
        setIsLoading(false);
        setStatus('⛔ Zatrzymano', true);
    };

    // ── Opcje select ──────────────────────────────────────────────
    const ollamaOpts  = ollamaModels.map(m => ({ value: m }));
    const cloudOpts   = CLOUD_MODELS.map(m => ({ value: m.id, label: m.label }));
    const cloudFastOpts  = CLOUD_MODELS.map(m => ({ value: m.id, label: m.label }));
    const cloudHeavyOpts = CLOUD_MODELS.map(m => ({ value: m.id, label: m.label }));

    const currentModelLabel = sourceMode === 'cloud'
        ? `☁️ K:${cloudFastModel.split('-').slice(0,3).join('-')} · A:${cloudHeavyModel.split('-').slice(0,3).join('-')}`
        : `⚡ ${fastModel} · 🏛️ ${heavyModel}`;

    // ══════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">

            {/* ── HEADER ─────────────────────────────────────────── */}
            <div className="bg-slate-800/50 border-b border-purple-500/30 p-3">
                <div className="flex items-center justify-between">

                    {/* Logo + model info */}
                    <div className="flex items-center gap-3 min-w-0">
                        <Brain className="text-purple-400 flex-shrink-0" size={22} />
                        <div className="min-w-0">
                            <h1 className="text-base font-bold text-purple-100 leading-tight">
                                Katedra OtakOS
                            </h1>
                            <div className="text-xs text-purple-400/60 truncate max-w-[280px]">
                                {currentModelLabel}
                            </div>
                        </div>
                    </div>

                    {/* Akcje */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => setShowSettings(s => !s)}
                            title="Ustawienia modeli"
                            className={`p-1.5 rounded-md transition-colors ${
                                showSettings ? 'bg-purple-700/60 text-white' : 'text-slate-300 hover:bg-slate-700'
                            }`}>
                            <Settings size={15} />
                        </button>

                        <button onClick={() => setShowModerator(s => !s)}
                            title={`Moderator: ${showModerator ? 'ON' : 'OFF'}`}
                            className={`p-1.5 rounded-md transition-colors ${
                                showModerator ? 'text-cyan-400' : 'text-slate-600'
                            } hover:bg-slate-700`}>
                            <Eye size={15} />
                        </button>

                        <button onClick={handleSaveConversation}
                            className="flex items-center gap-1 px-2.5 py-1 bg-green-700/70
                                       hover:bg-green-700 rounded-md text-white text-xs transition-colors">
                            <Archive size={13} />Zapisz
                        </button>

                        <button onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-700/70
                                       hover:bg-blue-700 rounded-md text-white text-xs transition-colors">
                            <Upload size={13} />Upload
                        </button>

                        <button onClick={handleCouncilConsultation} disabled={isLoading}
                            title="Jednorazowa konsultacja z Adamusem (ciężki model)"
                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-700/80
                                       hover:bg-amber-700 rounded-md text-white text-xs
                                       transition-colors disabled:opacity-50">
                            <Users size={13} />Rada
                            {isLoading && isCouncilMode && (
                                <Sparkles size={11} className="animate-spin" />
                            )}
                        </button>

                        {isLoading && (
                            <button onClick={stopGeneration}
                                className="px-2.5 py-1 bg-red-700/70 hover:bg-red-700
                                           rounded-md text-white text-xs transition-colors">
                                ⛔ Stop
                            </button>
                        )}
                    </div>
                </div>

                {statusLine && (
                    <div className="mt-1 text-xs text-purple-300/70 flex items-center gap-1">
                        <Terminal size={10} /><span>{statusLine}</span>
                    </div>
                )}
            </div>

            {/* ── PANEL USTAWIEŃ ─────────────────────────────────── */}
            {showSettings && (
                <div className="bg-slate-900/95 border-b border-purple-500/20 px-4 py-2.5
                                flex flex-wrap items-center gap-x-4 gap-y-2">

                    {/* Źródło */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500 mr-1">Źródło:</span>
                        <div className="flex rounded border border-slate-600 overflow-hidden text-xs">
                            <button onClick={() => setSourceMode('ollama')}
                                className={`px-2.5 py-1 flex items-center gap-1 transition-colors ${
                                    sourceMode === 'ollama'
                                        ? 'bg-purple-700 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}>
                                <Cpu size={11} /> Ollama
                            </button>
                            <button onClick={() => setSourceMode('cloud')}
                                className={`px-2.5 py-1 flex items-center gap-1 transition-colors ${
                                    sourceMode === 'cloud'
                                        ? 'bg-blue-700 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}>
                                <Cloud size={11} /> Chmura
                            </button>
                        </div>
                    </div>

                    {/* Ollama: dwa selecty */}
                    {sourceMode === 'ollama' && (<>
                        <div className="flex items-center gap-1.5">
                            <Zap size={12} className="text-purple-400" />
                            <span className="text-xs text-slate-400">Klaudiusz:</span>
                            <DarkSelect value={fastModel} onChange={saveFastModel}
                                options={ollamaOpts} color="#c4b5fd" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Users size={12} className="text-amber-400" />
                            <span className="text-xs text-slate-400">Adamus:</span>
                            <DarkSelect value={heavyModel} onChange={saveHeavyModel}
                                options={ollamaOpts} color="#fcd34d" />
                        </div>
                    </>)}

                    {/* Chmura: DWIE OSOBNE role ← NAPRAWKA */}
                    {sourceMode === 'cloud' && (<>
                        <div className="flex items-center gap-1.5">
                            <Zap size={12} className="text-purple-400" />
                            <span className="text-xs text-slate-400">Klaudiusz (☁️):</span>
                            <DarkSelect value={cloudFastModel} onChange={saveCloudFastModel}
                                options={cloudFastOpts} color="#c4b5fd" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Users size={12} className="text-amber-400" />
                            <span className="text-xs text-slate-400">Adamus (☁️):</span>
                            <DarkSelect value={cloudHeavyModel} onChange={saveCloudHeavyModel}
                                options={cloudHeavyOpts} color="#fcd34d" />
                        </div>
                    </>)}

                    {/* Odśwież + licznik */}
                    <button onClick={loadOllamaModels} disabled={loadingModels}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400
                                   hover:text-white border border-slate-700 hover:border-slate-500
                                   rounded transition-colors disabled:opacity-40">
                        <RefreshCw size={11} className={loadingModels ? 'animate-spin' : ''} />
                        Odśwież Ollama
                    </button>

                    {ollamaModels.length > 0 && (
                        <span className="text-xs text-green-400/50">
                            {ollamaModels.length} modeli
                        </span>
                    )}

                    {/* Info o Moderatorze */}
                    <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                        <Eye size={11} className={showModerator ? 'text-cyan-400' : ''} />
                        <span>Moderator: {showModerator ? 'aktywny' : 'wyciszony'}</span>
                    </div>

                    <button onClick={() => setShowSettings(false)}
                        className="text-slate-600 hover:text-slate-300 transition-colors ml-1">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* ── WIADOMOŚCI ─────────────────────────────────────── */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-3"
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full
                                    opacity-30 space-y-2 select-none">
                        <Brain size={48} className="text-purple-400" />
                        <p className="text-purple-200 text-sm">
                            Katedra gotowa. Enter → Klaudiusz · Rada → Adamus
                        </p>
                        <p className="text-purple-400 text-xs text-center">
                            {sourceMode === 'cloud'
                                ? `☁️ K: ${cloudFastModel} · A: ${cloudHeavyModel}`
                                : `⚡ ${fastModel} · 🏛️ ${heavyModel}`
                            }
                        </p>
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id}
                        className={`flex ${msg.sender === 'human' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg p-3 ${SENDER_STYLES[msg.sender]}`}>

                            <div className="flex items-center justify-between mb-1 gap-3">
                                <span className="text-xs font-semibold opacity-70">
                                    {SENDER_LABELS[msg.sender]}
                                    {msg.streaming && (
                                        <span className="ml-2 text-purple-300 animate-pulse">▊</span>
                                    )}
                                </span>
                                <span className="text-xs opacity-40 flex-shrink-0">
                                    {msg.timestamp.toLocaleTimeString()}
                                </span>
                            </div>

                            <div className="text-sm leading-relaxed">
                                {msg.content
                                    ? <MessageContent content={msg.content} streaming={msg.streaming} />
                                    : (msg.streaming ? '' : '—')
                                }
                            </div>

                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {msg.attachments.map((att, i) => (
                                        att.type === 'image' && att.url ? (
                                            <img key={i} src={att.url} alt={att.name}
                                                className="rounded border border-purple-500/30 max-w-[160px] max-h-[120px] object-cover cursor-pointer hover:opacity-90"
                                                title={`${att.name} · ${Math.round(att.size/1024)}KB`} />
                                        ) : (
                                            <div key={i} className="flex items-center gap-1 text-xs opacity-60">
                                                <Upload size={10} /><span>{att.name}</span>
                                            </div>
                                        )
                                    ))}
                                </div>
                            )}

                            {msg.sender !== 'human' && !msg.streaming && msg.content && (
                                <div className="flex gap-3 mt-2 pt-2 border-t border-current/15">
                                    <button onClick={() => handleCopyResponse(msg.content)}
                                        className="flex items-center gap-1 text-xs opacity-50
                                                   hover:opacity-100 transition-opacity">
                                        <Copy size={11} /> Kopiuj
                                    </button>
                                    <button onClick={() => handleSaveResponse(msg)}
                                        className="flex items-center gap-1 text-xs opacity-50
                                                   hover:opacity-100 transition-opacity">
                                        <Save size={11} /> Zapisz
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {/* ── Badge "Nowe wiadomości" — gdy user przewinął do góry podczas streamingu ── */}
                {showScrollBadge && isLoading && (
                    <div className="sticky bottom-3 flex justify-center z-10 pointer-events-none">
                        <button
                            onClick={() => scrollToBottom(true)}
                            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5
                                       bg-purple-700/90 hover:bg-purple-600 active:bg-purple-800
                                       text-white text-xs rounded-full shadow-lg
                                       border border-purple-400/40 backdrop-blur-sm
                                       transition-colors animate-pulse">
                            ⬇ Nowe wiadomości
                        </button>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ── INPUT ──────────────────────────────────────────── */}
            <div className="bg-slate-800/50 border-t border-purple-500/30 p-3">
                <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload}
                        multiple accept="image/*,video/*,.pdf,.txt,.md,.ts,.tsx,.js,.py"
                        className="hidden" />

                    <input
                        type="text"
                        value={currentInput}
                        onChange={e => setCurrentInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(); }}
                        placeholder={
                            sourceMode === 'cloud'
                                ? `⚡ Klaudiusz (${cloudFastModel.split('-').slice(0,3).join('-')})...`
                                : `⚡ Klaudiusz (${fastModel})...`
                        }
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 bg-slate-700 border border-purple-500/30
                                   rounded-lg text-purple-100 placeholder-purple-400/50
                                   focus:outline-none focus:border-purple-400 transition-colors
                                   disabled:opacity-50 text-sm"
                    />

                    <button onClick={sendMessage} disabled={isLoading || !currentInput.trim()}
                        className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white
                                   transition-colors disabled:opacity-40"
                        title="Wyślij do Klaudiusza (Enter)">
                        <MessageSquare size={18} />
                    </button>
                </div>

                {/* ── Chipsy załączników ─────────────────────────────── */}
                {(pendingAttachments.length > 0 || attachProcessing) && (
                    <div className="mb-2 flex flex-wrap gap-2">
                        {attachProcessing && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-slate-700 rounded-md text-xs text-slate-400 animate-pulse">
                                <RefreshCw size={11} className="animate-spin" />
                                <span>Kompresuję...</span>
                            </div>
                        )}
                        {pendingAttachments.map((att, i) => {
                            const tooHeavy  = att.estimatedTokens > 12_000;
                            const moderateW = att.estimatedTokens > 5_000;
                            return (
                                <div key={i}
                                    className={`relative flex items-center gap-2 px-2 py-1 rounded-md text-xs border
                                        ${tooHeavy  ? 'bg-red-900/50 border-red-500/50 text-red-200'   :
                                          moderateW ? 'bg-amber-900/50 border-amber-500/40 text-amber-200' :
                                                      'bg-slate-700 border-slate-500/40 text-slate-200'}`}>
                                    {/* Miniaturka */}
                                    <img src={att.base64} alt="" width={28} height={28}
                                        className="rounded object-cover flex-shrink-0" />
                                    {/* Info */}
                                    <div className="flex flex-col leading-tight">
                                        <span>{att.width}×{att.height}px</span>
                                        <span className="opacity-70">
                                            {att.originalSizeKB}→{att.compressedSizeKB}KB
                                            {' · '}
                                            <span className={tooHeavy ? 'text-red-300 font-bold' : moderateW ? 'text-amber-300' : 'text-green-400'}>
                                                ~{att.estimatedTokens.toLocaleString()} tok
                                            </span>
                                        </span>
                                    </div>
                                    {/* Usuń */}
                                    <button
                                        onClick={() => setPendingAttachments(p => p.filter((_, j) => j !== i))}
                                        className="ml-1 text-slate-500 hover:text-white transition-colors">
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                        {/* Łączna liczba tokenów */}
                        {pendingAttachments.length > 1 && (
                            <div className="flex items-center px-2 py-1 text-xs text-purple-400/60">
                                Razem: ~{pendingAttachments.reduce((s,a)=>s+a.estimatedTokens,0).toLocaleString()} tok
                            </div>
                        )}
                    </div>
                )}

            {/* Info o aktywnej konsultacji */}
                {isCouncilMode && (
                    <div className="mt-1 text-xs text-amber-400/70 flex items-center gap-1">
                        <Sparkles size={10} className="animate-pulse" />
                        <span>Adamus analizuje... (po zakończeniu powrót do Klaudiusza)</span>
                    </div>
                )}
            </div>

            {/* ── PANEL PAMIĘCI ───────────────────────────────────── */}
            {chatMemory.length > 0 && (
                <div className="absolute top-16 right-4 w-72 bg-slate-800/95 border
                                border-purple-500/30 rounded-lg p-3 max-h-56 overflow-y-auto
                                shadow-xl">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-medium text-purple-200">
                            Pamięć ({chatMemory.length})
                        </h3>
                        <button onClick={() => setChatMemory([])}
                            className="text-xs text-slate-500 hover:text-white">wyczyść</button>
                    </div>
                    {chatMemory.slice(-5).map(mem => (
                        <div key={mem.id}
                            className="text-xs text-purple-300 mb-1 p-2 bg-slate-700/50 rounded">
                            <div className="font-medium">{mem.title}</div>
                            <div className="opacity-60 truncate">{mem.summary}</div>
                            {mem.tags.length > 0 && (
                                <div className="text-purple-400 mt-0.5">{mem.tags.join(', ')}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default KatedraChat;
