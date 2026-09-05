/**
 * 🧊 SpatialCard3D — karta z głębią, reagująca na kursor.
 *
 * ⚠️ NAPISANA OD NOWA. Wersja z `_OtakOs_Wymiar/src` NIE DAŁA SIĘ SKOMPILOWAĆ:
 *   · `three`, `@react-three/fiber` i `@react-three/drei` NIE SĄ w projekcie,
 *   · importowała `Mesh` i `BoxGeometry` z `drei` (to klasy THREE, nie eksporty drei),
 *   · używała `tokens.cardBg`, `primaryGlow`, `secondaryGlow`, `glowIntensity` —
 *     czterech pól, których w pliku tokenów NIE MA,
 *   · props nazywał się `teOgochiKey`, a destrukturyzowany był `teOgogoKey` (literówka),
 *   · `MeshPhongMaterial` dostawał `metalness`, którego Phong nie ma,
 *   · `<TextMesh>` pochodził z pliku, który sam plik nazywa „zakładamy tę funkcję",
 *   · `className` na `<group>` — obiekty three nie mają klas CSS.
 *
 * DLACZEGO CSS 3D, A NIE WEBGL: Katedra nigdzie nie używa three.js, sprzęt
 * Suwerena jest słaby, a cały zamysł — karta z głębią, która unosi się i świeci
 * pod kursorem — robi się transformacjami CSS za darmo. Dokładanie renderera
 * WebGL dla czterech ozdobnych kart byłoby kosztem bez pokrycia. Gdyby kiedyś
 * miała tu wjechać prawdziwa scena 3D, to osobna decyzja i osobne zależności.
 */
import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { tokeny, type TokenyWizualne } from '../../lib/designTokens';
import { gatunekPo } from '../../lib/teogochiGatunki';

export interface SpatialCard3DProps {
    tytul: string;
    opis: string;
    /** Gatunek TeOgochi, do którego należy karta — barwa i forma stąd. */
    gatunekId?: string;
    /** Nadpisanie tokenów; domyślnie rezonans Katedry. */
    t?: TokenyWizualne;
    onDotkniecie?: () => void;
}

/** Maksymalny przechył w stopniach. Więcej wygląda jak usterka, nie jak głębia. */
const PRZECHYL = 9;

export const SpatialCard3D: React.FC<SpatialCard3DProps> = React.memo(({
    tytul, opis, gatunekId, t, onDotkniecie,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [obrot, setObrot] = useState({ x: 0, y: 0 });
    const [pod, setPod] = useState(false);

    const tok = t ?? tokeny();
    const gat = gatunekId ? gatunekPo(gatunekId) : undefined;
    // Barwa gatunku wygrywa z globalną — karta Joanny ma być fioletowa jak Joanna.
    const barwa = gat?.kolor ?? tok.primary;

    const naRuch = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        // Środek karty = 0°, krawędź = pełny przechył. Oś Y odwrócona, żeby
        // karta „patrzyła" w stronę kursora, a nie od niego.
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        setObrot({ x: -py * PRZECHYL * 2, y: px * PRZECHYL * 2 });
    }, []);

    const naWyjscie = useCallback(() => { setObrot({ x: 0, y: 0 }); setPod(false); }, []);

    return (
        // Perspektywa musi siedzieć na RODZICU — na samym elemencie nie daje głębi.
        <div style={{ perspective: 900 }}>
            <motion.div
                ref={ref}
                onMouseMove={naRuch}
                onMouseEnter={() => setPod(true)}
                onMouseLeave={naWyjscie}
                onClick={onDotkniecie}
                role={onDotkniecie ? 'button' : undefined}
                tabIndex={onDotkniecie ? 0 : undefined}
                onKeyDown={(e) => { if (onDotkniecie && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onDotkniecie(); } }}
                animate={{
                    rotateX: obrot.x, rotateY: obrot.y,
                    scale: pod ? 1.03 : 1,
                    z: pod ? 24 : 0,
                }}
                transition={{ type: 'spring', stiffness: 240, damping: 22 }}
                style={{
                    transformStyle: 'preserve-3d',
                    cursor: onDotkniecie ? 'pointer' : 'default',
                    background: tok.tloKarty,
                    border: `1px solid ${pod ? barwa : tok.obrys}`,
                    borderRadius: tok.promien,
                    padding: tok.odstep,
                    boxShadow: pod ? `0 18px 40px -12px ${barwa}66, 0 0 24px ${barwa}33` : 'none',
                    backdropFilter: 'blur(6px)',
                }}
            >
                {/* Warstwa uniesiona nad tłem — stąd bierze się wrażenie głębi. */}
                <div style={{ transform: 'translateZ(28px)', transformStyle: 'preserve-3d' }}>
                    <div className="flex items-center gap-2">
                        {gat && <span className="text-2xl leading-none select-none">{gat.formy['jajko']}</span>}
                        <span className="text-sm font-bold" style={{ color: barwa }}>{tytul}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{opis}</p>
                    {gat && (
                        <div className="text-[10px] font-mono mt-1.5" style={{ color: `${barwa}aa` }}>
                            {gat.dziedzina}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
});

SpatialCard3D.displayName = 'SpatialCard3D';
export default SpatialCard3D;
