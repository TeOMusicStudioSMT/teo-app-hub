import { useEffect, useRef, useState, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { assistantStateAtom, AssistantMessage, balanceModeAtom } from '../store/assistant';
import { ResonanceColorKey } from '../store/personalization';
import toast from 'react-hot-toast';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from '@google/genai';
import { encode, decode, decodeAudioData } from '../lib/helpers';
import { useAegisClient } from './useAegisClient';
import * as gravitonClient from '../lib/graviton/client';
import * as marketClient from '../lib/market/client';
import { useEssenceIdentity } from './useEssenceIdentity';
import { COSMIC_VENTURES } from '../constants';
import { walletAtom } from '../store/wallet';
import { SYSTEM_INSTRUCTION_VISEL, getCloudProvider } from '../services/cloudService';
import { userApiKeyAtom } from '../store/settings';

// --- Function Declarations ---
const getBalanceFunctionDeclaration: FunctionDeclaration = {
    name: 'getBalance', description: 'Gets the user\'s current Graviton (GRV) token balance.', parameters: { type: Type.OBJECT, properties: {} }
};
const transferGravTonFunctionDeclaration: FunctionDeclaration = {
    name: 'transferGravTon', description: 'Transfers GRV.', parameters: { type: Type.OBJECT, properties: { recipientId: { type: Type.STRING }, amount: { type: Type.NUMBER } }, required: ['recipientId', 'amount'] }
};
const createListingFunctionDeclaration: FunctionDeclaration = {
    name: 'createListing', description: 'Creates item listing.', parameters: { type: Type.OBJECT, properties: { itemName: { type: Type.STRING }, price: { type: Type.NUMBER } }, required: ['itemName', 'price'] }
};
const confirmActionFunctionDeclaration: FunctionDeclaration = { name: 'confirmAction', description: 'Confirms action.', parameters: { type: Type.OBJECT, properties: {} } };
const getFrequencyTierFunctionDeclaration: FunctionDeclaration = { name: 'getFrequencyTier', description: 'Gets Frequency Tier.', parameters: { type: Type.OBJECT, properties: {} } };
const getVentureFrequencyRequirementFunctionDeclaration: FunctionDeclaration = { name: 'getVentureFrequencyRequirement', description: 'Gets venture reqs.', parameters: { type: Type.OBJECT, properties: { ventureName: { type: Type.STRING } }, required: ['ventureName'] } };

const allFunctionDeclarations = [getBalanceFunctionDeclaration, transferGravTonFunctionDeclaration, createListingFunctionDeclaration, confirmActionFunctionDeclaration, getFrequencyTierFunctionDeclaration, getVentureFrequencyRequirementFunctionDeclaration];

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) { int16[i] = data[i] * 32768; }
    return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}

export const useAssistant = () => {
    const [assistantState, setAssistantState] = useAtom(assistantStateAtom);
    const [balanceMode, setBalanceMode] = useAtom(balanceModeAtom);
    const api = useAegisClient();
    const { identity } = useEssenceIdentity();
    const walletAtomValue = useAtomValue(walletAtom);
    const currentApiKey = useAtomValue(userApiKeyAtom);
    const [pendingAction, setPendingAction] = useState<any>(null);

    const aiRef = useRef<GoogleGenAI | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);
    const nextStartTime = useRef<number>(0);
    const sources = useRef<Set<AudioBufferSourceNode>>(new Set());
    const speakingTimeoutRef = useRef<number | null>(null);
    const hasLoggedMissingKey = useRef(false);
    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');
    const hasTriggeredBalanceMode = useRef(false);

    // GORGOO: Wake Lock Reference
    const wakeLockRef = useRef<any>(null);

    // --- Wake Lock Logic ---
    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                console.log('⚡ Wake Lock active: Screen will stay on.');
            }
        } catch (err) {
            console.warn(`Wake Lock failed (non-fatal): ${err}`);
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            } catch (err) { console.error(err); }
        }
    };

    // --- Balance Mode Monitor ---
    useEffect(() => {
        const riskLevel = identity?.coherence.riskLevel;
        if (!riskLevel) return;
        if ((riskLevel === 'MEDIUM' || riskLevel === 'HIGH') && !hasTriggeredBalanceMode.current) {
            hasTriggeredBalanceMode.current = true;
            setBalanceMode(prev => ({ ...prev, isActive: true }));
            // ... (speech omitted)
        } else if (riskLevel === 'LOW' && hasTriggeredBalanceMode.current) {
            hasTriggeredBalanceMode.current = false;
            setBalanceMode({ isActive: false, timerVisible: false, countdown: 17 });
        }
    }, [identity?.coherence.riskLevel, setBalanceMode]);

    // --- Cleanup ---
    const cleanup = useCallback(() => {
        releaseWakeLock();
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (inputAudioContextRef.current?.state !== 'closed') inputAudioContextRef.current?.close();
        if (outputAudioContextRef.current?.state !== 'closed') {
            sources.current.forEach(source => { try { source.stop(); } catch (e) { } });
            sources.current.clear();
            outputAudioContextRef.current?.close();
        }
        sessionPromiseRef.current = null;
        nextStartTime.current = 0;
        setPendingAction(null);
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);

        setAssistantState(prev => ({
            status: 'idle',
            transcript: '',
            response: '',
            conversationHistory: prev.conversationHistory
        }));
    }, [setAssistantState]);

    const executeToolCall = async (functionCall: any): Promise<{ result: string }> => {
        const { name, args } = functionCall;
        switch (name) {
            case 'getBalance':
                const balance = await gravitonClient.getBalance();
                return { result: `Your current balance is ${balance.toFixed(2)} GRV.` };
            case 'createListing':
                await marketClient.createListing({ itemName: args.itemName, price: args.price });
                return { result: `I have listed "${args.itemName}" on the market for ${args.price} GRV.` };
            case 'transferGravTon':
                setAssistantState(prev => ({ ...prev, status: 'thinking' }));
                const validation = await api.validateTransaction({
                    recipientId: args.recipientId,
                    amount: args.amount,
                    currency: 'GRV'
                });
                if (validation.status === 'APPROVED') {
                    await gravitonClient.transferGravTon(args);
                    return { result: `Transfer to ${args.recipientId} for ${args.amount} GRV is approved and processing.` };
                } else {
                    setPendingAction({ type: 'transfer', data: args });
                    return { result: `Aegis has detected a risk: ${validation.reason}. This action may lower your Coherence. Please confirm to proceed.` };
                }
            case 'confirmAction':
                if (pendingAction?.type === 'transfer') {
                    setAssistantState(prev => ({ ...prev, status: 'thinking' }));
                    await gravitonClient.transferGravTon(pendingAction.data);
                    setPendingAction(null);
                    return { result: 'Action confirmed. The transfer is now processing.' };
                }
                return { result: 'There is no pending action to confirm.' };
            case 'getFrequencyTier':
                return { result: `Your current Frequency Tier is ${walletAtomValue.frequencyTier}.` };
            case 'getVentureFrequencyRequirement':
                const venture = COSMIC_VENTURES.find(v => v.name.toLowerCase().includes(args.ventureName.toLowerCase()));
                if (venture) {
                    if (venture.requiredFrequencyTier) {
                        return { result: `Accessing "${venture.name}" requires a ${venture.requiredFrequencyTier} Frequency Tier.` };
                    } else {
                        return { result: `"${venture.name}" does not have a specific Frequency Tier requirement.` };
                    }
                }
                return { result: `I could not find a Cosmic Venture named "${args.ventureName}".` };
            default:
                return { result: 'Unknown function' };
        }
    };

    // --- Session Management ---
    const startConversation = async (personalization: { resonanceColor: ResonanceColorKey, pulseIntensity: number }) => {
        if (!aiRef.current) {
            toast.error("Neural Link not configured.");
            return;
        }
        if (!identity?.assistantDomain) {
            toast.error("Claim identity first.");
            return;
        }

        try {
            // Wake Lock - Non blocking
            requestWakeLock().catch(e => console.warn("Background WakeLock error", e));

            setAssistantState(prev => ({ ...prev, status: 'listening' }));
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            // Resume Contexts (Mobile Fix)
            if (inputAudioContextRef.current?.state === 'suspended') await inputAudioContextRef.current.resume();
            if (outputAudioContextRef.current?.state === 'suspended') await outputAudioContextRef.current.resume();

            outputNodeRef.current = outputAudioContextRef.current.createGain();
            outputNodeRef.current.connect(outputAudioContextRef.current.destination);

            // GORGOO: Pobieramy AKTUALNY stan wiedzy o użytkowniku wprost z Atomów
            // Musimy użyć getDefaultStore, aby pobrać wartość atomu wewnątrz funkcji asynchronicznej
            const { getDefaultStore } = await import('jotai');
            const store = getDefaultStore();
            const currentWallet = store.get(walletAtom); // Pobierz prawdziwy portfel

            const assistantName = identity.assistantDomain;

            // Wstrzykujemy Prawdę (Stan Konta) do instrukcji systemowej
            const dynamicContext = `
            CURRENT REALITY DATA:
            - User Name: ${identity.username}
            - Current Balance: ${currentWallet.balance} GRV (Do not guess. Use this exact number).
            - Frequency Tier: ${currentWallet.frequencyTier}
            - Resonance Color: ${personalization.resonanceColor}
            `;

            const systemInstruction = `${SYSTEM_INSTRUCTION_VISEL}\n${dynamicContext}\nYour name is ${assistantName}.`;

            sessionPromiseRef.current = aiRef.current.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        console.log("[VISEL] Connection Opened");
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        mediaStreamSourceRef.current = source;
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            sessionPromiseRef.current?.then((session: any) => {
                                session.sendRealtimeInput({ media: createBlob(inputData) });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.turnComplete) {
                            // History handling
                        }
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            setAssistantState(prev => ({ ...prev, status: 'speaking' }));
                            if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
                            speakingTimeoutRef.current = window.setTimeout(() => {
                                setAssistantState(prev => prev.status === 'speaking' ? { ...prev, status: 'listening' } : prev);
                            }, 1500);

                            const outputContext = outputAudioContextRef.current!;
                            const outputNode = outputNodeRef.current!;

                            nextStartTime.current = Math.max(nextStartTime.current, outputContext.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputContext, 24000, 1);
                            const source = outputContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputNode);
                            source.addEventListener('ended', () => { sources.current.delete(source); });
                            source.start(nextStartTime.current);
                            nextStartTime.current += audioBuffer.duration;
                            sources.current.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        toast.error('Connection error.');
                        cleanup();
                    },
                    onclose: () => {
                        cleanup();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    tools: [{ functionDeclarations: allFunctionDeclarations }],
                    systemInstruction,
                },
            });

        } catch (err: any) {
            console.error("Error starting conversation:", err);
            cleanup();
        }
    };

    const stopConversation = useCallback(() => {
        sessionPromiseRef.current?.then((session: any) => session.close());
    }, []);

    const triggerWelcome = useCallback(() => {
        // ... (Welcome logic bez zmian)
    }, [setAssistantState]);

    useEffect(() => {
        const { provider, apiKey } = getCloudProvider();
        if (provider === 'gemini' && apiKey) {
            try {
                aiRef.current = new GoogleGenAI({ apiKey });
                hasLoggedMissingKey.current = false;
            } catch (e) {
                console.error("AI Init Failed", e);
            }
        } else {
            aiRef.current = null;
        }
        return () => {
            sessionPromiseRef.current?.then((session: any) => session.close());
            cleanup();
        };
    }, [cleanup, currentApiKey]);

    return { startConversation, stopConversation, triggerWelcome };
};