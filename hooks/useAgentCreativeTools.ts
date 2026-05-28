// ═══════════════════════════════════════════════════════════════════
//  src/hooks/useAgentCreativeTools.ts
//
//  Hook podłączający agentów OtakOS do narzędzi kreatywnych.
//  Agenci komunikują się przez BroadcastChannel + Wiesław Bridge.
//
//  BoB: użyj w TeOSimAcademy.tsx — jedna linia:
//    const { executeCreativeActions } = useAgentCreativeTools();
//    // potem po każdej odpowiedzi AI:
//    executeCreativeActions(parsedActions, agentName, agentColor);
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
    CreativeAction,
    AgentPaintInstruction,
    WARDROBE_STYLES,
} from '../lib/agentCreativeActions';
import { generateContent } from '../services/cloudService';
import type { CloudProvider } from '../services/cloudService';

// ── BroadcastChannels ─────────────────────────────────────────────
const CHANNELS = {
    canvas:   'quantum_canvas',
    wardrobe: 'quantum_wardrobe',
    arcade:   'katedra_arcade',
    dispatch: 'katedra_dispatch',
} as const;

function broadcast(channel: string, data: Record<string, unknown>) {
    try {
        const bc = new BroadcastChannel(channel);
        bc.postMessage(data);
        bc.close();
    } catch (e) {
        console.warn(`[CreativeTools] BroadcastChannel "${channel}" niedostępny:`, e);
    }
}

// ── Wiesław Bridge ────────────────────────────────────────────────
const BRIDGE_URL = 'http://127.0.0.1:3001';

async function saveToBridge(filename: string, content: string): Promise<boolean> {
    try {
        const r = await fetch(`${BRIDGE_URL}/api/bridge/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'WRITE_FILE', filename, content }),
        });
        return r.ok;
    } catch {
        return false;
    }
}

// ── Główny hook ───────────────────────────────────────────────────

export function useAgentCreativeTools() {
    const activeAgentRef = useRef<{ name: string; color: string } | null>(null);

    // ── Akcja: PAINT_CANVAS ───────────────────────────────────────
    // Agent generuje instrukcję malowania i wysyła na Canvas
    const agentPaint = useCallback(async (
        instruction: string,
        agentName: string,
        agentColor: string,
        provider?: CloudProvider
    ) => {
        toast(`🎨 ${agentName} maluje na Quantum Canvas...`, {
            icon: '✨',
            style: { background: 'rgba(15,23,42,0.95)', color: agentColor },
        });

        try {
            // Prosimy AI o wygenerowanie JSON z instrukcją malowania
            const raw = await generateContent(
                `Jesteś ${agentName} — artysta Katedry OtakOS. Stwórz instrukcję malowania.

Opis dzieła: "${instruction}"

Odpowiedz TYLKO czystym JSON (bez markdown) w tym formacie:
{
  "background": "#06080f",
  "message": "jedno zdanie opisujące dzieło",
  "strokes": [
    { "type": "circle", "x": 50, "y": 50, "r": 80, "color": "${agentColor}", "size": 3, "opacity": 0.6 },
    { "type": "splatter", "x": 50, "y": 50, "r": 120, "color": "#c9953a", "size": 2, "opacity": 0.4 },
    { "type": "arc", "x": 50, "y": 50, "r": 150, "color": "#00e5ff", "size": 1.5, "opacity": 0.3 }
  ]
}

Stwórz 8-15 pociągnięć w kosmicznym stylu 0.00G. Użyj kolorów agenta: ${agentColor}, złoty #c9953a, cyjan #00e5ff.
x i y to procenty (0-100) szerokości i wysokości płótna.`,
                'active',
                provider
            );

            // Parsuj JSON
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('Brak JSON w odpowiedzi');
            const paintData: AgentPaintInstruction = JSON.parse(jsonMatch[0]);

            // Wyślij na Canvas przez BroadcastChannel
            broadcast(CHANNELS.canvas, {
                type: 'AGENT_PAINT',
                agentName,
                agentColor,
                instruction: paintData,
            });

            // Zapisz log do Wiesława
            await saveToBridge(
                `canvas_${agentName.toLowerCase()}_${Date.now()}.json`,
                JSON.stringify({ agentName, agentColor, instruction, paintData, timestamp: Date.now() }, null, 2)
            );

            toast.success(`✅ ${agentName} namalował: "${paintData.message}"`, {
                style: { background: 'rgba(15,23,42,0.95)', color: '#4ade80' },
            });

            return paintData;
        } catch (e: any) {
            console.error('[AgentPaint] Błąd:', e);
            toast.error(`❌ ${agentName}: błąd malowania — ${e.message}`);
            return null;
        }
    }, []);

    // ── Akcja: GENERATE_OUTFIT ────────────────────────────────────
    // Agent generuje prompt modowy i otwiera Wardrobe
    const agentGenerateOutfit = useCallback(async (
        style: string,
        description: string,
        agentName: string,
        agentColor: string,
        provider?: CloudProvider
    ) => {
        const styleName = WARDROBE_STYLES[style] || style;

        toast(`👗 ${agentName} projektuje strój...`, {
            icon: '✨',
            style: { background: 'rgba(15,23,42,0.95)', color: agentColor },
        });

        try {
            // Agent generuje bogaty prompt modowy
            const fashionPrompt = await generateContent(
                `Jesteś ${agentName} — projektant mody Katedry OtakOS.
Styl: ${styleName}
Koncepcja: ${description}

Napisz profesjonalny prompt dla AI Studio (Imagen 3 / Nano Banana Pro) po angielsku.
Prompt ma opisywać: ubranie, tkaninę, sylwetkę, oświetlenie, tło, klimat fotograficzny.
Długość: 3-4 zdania. Zakończ "16:9 format, high-end fashion photography."
Odpowiedz TYLKO promptem, bez żadnego tekstu przed lub po.`,
                'active',
                provider
            );

            // Wyślij do Wardrobe
            broadcast(CHANNELS.wardrobe, {
                type: 'AGENT_OUTFIT',
                agentName,
                agentColor,
                style,
                prompt: fashionPrompt.trim(),
                description,
            });

            // Otwórz Wardrobe jeśli dostępna
            broadcast(CHANNELS.dispatch, {
                type: 'OPEN_MODULE',
                module: 'wardrobe',
                agentName,
            });

            // Zapisz log
            await saveToBridge(
                `outfit_${agentName.toLowerCase()}_${Date.now()}.txt`,
                `Agent: ${agentName}\nStyl: ${styleName}\nKoncepcja: ${description}\n\nPROMPT:\n${fashionPrompt}`
            );

            toast.success(`✅ ${agentName} zaprojektował strój!`, {
                style: { background: 'rgba(15,23,42,0.95)', color: '#4ade80' },
            });

            return fashionPrompt;
        } catch (e: any) {
            toast.error(`❌ ${agentName}: błąd projektowania — ${e.message}`);
            return null;
        }
    }, []);

    // ── Akcja: FORGE_GAME ─────────────────────────────────────────
    // Agent generuje grę przez Fabrykę Gier
    const agentForgeGame = useCallback(async (
        genre: string,
        theme: string,
        agentName: string,
        agentColor: string,
        provider?: CloudProvider
    ) => {
        toast(`🕹️ ${agentName} wchodzi do Kuźni Gier...`, {
            icon: '🔥',
            style: { background: 'rgba(15,23,42,0.95)', color: agentColor },
        });

        // Wyślij do Fabryki Gier
        broadcast(CHANNELS.arcade, {
            type: 'AGENT_FORGE',
            agentName,
            agentColor,
            genre,
            theme,
            provider: provider || 'claude',
        });

        // Otwórz moduł
        broadcast(CHANNELS.dispatch, {
            type: 'OPEN_MODULE',
            module: 'arcade',
            agentName,
        });

        toast.success(`🔥 ${agentName} inicjuje materializację gry: "${theme}"`, {
            style: { background: 'rgba(15,23,42,0.95)', color: agentColor },
        });
    }, []);

    // ── Główny executor ───────────────────────────────────────────
    const executeCreativeActions = useCallback(async (
        actions: CreativeAction[],
        agentName: string,
        agentColor: string,
        provider?: CloudProvider
    ) => {
        activeAgentRef.current = { name: agentName, color: agentColor };

        for (const action of actions) {
            console.log(`[CreativeTools] ${agentName} wykonuje: ${action.type}`, action.payload);

            switch (action.type) {

                case 'OPEN_CANVAS':
                    broadcast(CHANNELS.dispatch, {
                        type: 'OPEN_MODULE',
                        module: 'canvas',
                        agentName,
                        prompt: action.payload?.prompt,
                    });
                    toast(`🎨 ${agentName} otwiera Quantum Canvas`, {
                        style: { background: 'rgba(15,23,42,0.95)', color: agentColor },
                    });
                    break;

                case 'PAINT_CANVAS':
                    if (action.payload?.instruction) {
                        await agentPaint(
                            String(action.payload.instruction),
                            agentName, agentColor, provider
                        );
                    }
                    break;

                case 'SAVE_CANVAS':
                    broadcast(CHANNELS.canvas, { type: 'SAVE_REQUEST', agentName });
                    toast(`💾 ${agentName} zapisuje dzieło do galerii`, {
                        style: { background: 'rgba(15,23,42,0.95)', color: agentColor },
                    });
                    break;

                case 'OPEN_WARDROBE':
                    broadcast(CHANNELS.dispatch, {
                        type: 'OPEN_MODULE',
                        module: 'wardrobe',
                        style: action.payload?.style || 'otakos',
                        agentName,
                    });
                    toast(`👗 ${agentName} otwiera Quantum Wardrobe`, {
                        style: { background: 'rgba(15,23,42,0.95)', color: agentColor },
                    });
                    break;

                case 'GENERATE_OUTFIT':
                    await agentGenerateOutfit(
                        String(action.payload?.style || 'otakos'),
                        String(action.payload?.desc || 'kreacja w stylu 0.00G'),
                        agentName, agentColor, provider
                    );
                    break;

                case 'OPEN_ARCADE':
                    broadcast(CHANNELS.dispatch, {
                        type: 'OPEN_MODULE',
                        module: 'arcade',
                        agentName,
                    });
                    toast(`🕹️ ${agentName} otwiera Fabrykę Gier`, {
                        style: { background: 'rgba(15,23,42,0.95)', color: agentColor },
                    });
                    break;

                case 'FORGE_GAME':
                    await agentForgeGame(
                        String(action.payload?.genre || 'puzzle'),
                        String(action.payload?.theme || 'gra kwantowa'),
                        agentName, agentColor, provider
                    );
                    break;

                case 'CREATIVE_REPORT':
                    if (action.payload?.summary) {
                        const summary = String(action.payload.summary);
                        await saveToBridge(
                            `creative_report_${Date.now()}.txt`,
                            `RAPORT KREATYWNY\nAgent: ${agentName}\nData: ${new Date().toLocaleString('pl-PL')}\n\n${summary}`
                        );
                        toast(`📊 ${agentName} złożył raport twórczy`, {
                            style: { background: 'rgba(15,23,42,0.95)', color: agentColor },
                        });
                    }
                    break;

                default:
                    console.warn('[CreativeTools] Nieznana akcja:', action.type);
            }

            // Małe opóźnienie między akcjami — czytelniejszy UX
            await new Promise(r => setTimeout(r, 400));
        }
    }, [agentPaint, agentGenerateOutfit, agentForgeGame]);

    return { executeCreativeActions };
}
