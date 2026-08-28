/**
 * 🌀 Wir TeOgochi — dawny przycisk „Asystent Muzyczny".
 *
 * Kliknięcie rozwija wir: wokół środka krążą TeOgochi, które Suweren WYKLUŁ.
 * Nie wszystkie trzynaście — tylko te ze stada. Jajko, które jeszcze nie
 * istnieje, nie ma prawa wirować; katalog gatunków jest w Domu, nie tutaj.
 *
 * Awatar każdego pokazuje jego FAKTYCZNY etap (stanGatunku → stageOf), więc
 * świeżo wykluty leci jako jajo, a Joanna po 3132 XP jako gołąb.
 *
 * Klik w krążącego = wzięcie go na dyżur. Joanna dodatkowo odpala odtwarzacz,
 * bo to jej warsztat — reszta ma swoje panele w Domu TeOgochi.
 */
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GATUNKI } from '../../lib/teogochiGatunki';
import { stageOf } from '../../lib/teogochiState';
import { wykluteGatunki, aktywnyGatunek, ustawAktywny, stanGatunku } from '../../lib/teogochiStado';
import { melduj } from '../../lib/szyna';
import { TeogochiPanel } from '../TeogochiPanel';

const PROMIEN = 92;          // px — jak daleko od środka krążą
const ROZMIAR_SRODKA = 74;

export const WirTeogochi: React.FC<{
    /** Wywoływane, gdy Suweren wybierze Joannę — odtwarzacz ma się otworzyć. */
    naJoanne?: () => void;
    /** Opcjonalne wywołanie przy wyborze postaci */
    onSelectGatunek?: (id: string) => void;
}> = ({ naJoanne, onSelectGatunek }) => {
    const [otwarty, setOtwarty] = useState(false);
    const [dyzurny, setDyzurny] = useState(() => aktywnyGatunek());
    const [panelGatunekId, setPanelGatunekId] = useState<string | null>(null);

    // Stado czytamy przy otwarciu wiru, nie przy każdym renderze.
    const stado = useMemo(() => {
        const ids = wykluteGatunki();
        return GATUNKI.filter(g => ids.includes(g.id)).map(g => ({
            gat: g,
            etap: stageOf(stanGatunku(g.id).xp),
        }));
    }, [otwarty]);

    const wybierz = (id: string) => {
        ustawAktywny(id);
        setDyzurny(id);
        void melduj(id, 'dyzur', 'Wzięty na dyżur z wiru.');
        setOtwarty(false);
        setPanelGatunekId(id);
        onSelectGatunek?.(id);
        if (id === 'joanna' && naJoanne) naJoanne();
    };

    return (
        <div style={{ position: 'relative', width: ROZMIAR_SRODKA, height: ROZMIAR_SRODKA }}>
            {/* Krążące TeOgochi */}
            <AnimatePresence>
                {otwarty && (
                    <motion.div
                        key="wir"
                        initial={{ opacity: 0, rotate: -30 }}
                        animate={{ opacity: 1, rotate: 360 }}
                        exit={{ opacity: 0, rotate: 30 }}
                        transition={{
                            opacity: { duration: 0.25 },
                            rotate: { duration: 34, repeat: Infinity, ease: 'linear' },
                        }}
                        style={{
                            position: 'absolute', inset: 0, pointerEvents: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        {stado.map(({ gat, etap }, i) => {
                            const kat = (i / Math.max(1, stado.length)) * Math.PI * 2;
                            return (
                                <motion.button
                                    key={gat.id}
                                    onClick={() => wybierz(gat.id)}
                                    title={`${gat.imie} — ${gat.dziedzina} (${etap.title})`}
                                    whileHover={{ scale: 1.25 }}
                                    // Przeciw-obrót: ikona ma stać prosto, mimo że wir się kręci.
                                    animate={{ rotate: -360 }}
                                    transition={{ rotate: { duration: 34, repeat: Infinity, ease: 'linear' } }}
                                    style={{
                                        position: 'absolute',
                                        left: `calc(50% + ${Math.cos(kat) * PROMIEN}px - 21px)`,
                                        top: `calc(50% + ${Math.sin(kat) * PROMIEN}px - 21px)`,
                                        width: 42, height: 42, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 21, cursor: 'pointer', pointerEvents: 'auto',
                                        background: 'rgba(10,15,28,0.92)',
                                        border: `2px solid ${gat.kolor}`,
                                        boxShadow: dyzurny === gat.id
                                            ? `0 0 18px ${gat.kolor}, 0 0 6px ${gat.kolor} inset`
                                            : `0 0 10px ${gat.kolor}55`,
                                    }}
                                >
                                    {gat.formy[etap.stage]}
                                </motion.button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Środek wiru */}
            <motion.button
                onClick={() => setOtwarty(o => !o)}
                whileTap={{ scale: 0.94 }}
                title={otwarty ? 'Zamknij wir' : 'Wir TeOgochi — wybierz kompana'}
                style={{
                    position: 'relative', zIndex: 2,
                    width: ROZMIAR_SRODKA, height: ROZMIAR_SRODKA, borderRadius: '50%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2, cursor: 'pointer', color: '#e2e8f0',
                    background: 'radial-gradient(circle at 50% 45%, #1e1b4b 0%, #0a0f1c 70%)',
                    border: '2px solid rgba(168,85,247,0.55)',
                    boxShadow: otwarty
                        ? '0 0 28px rgba(168,85,247,0.55)'
                        : '0 0 14px rgba(168,85,247,0.28)',
                }}
            >
                <motion.span
                    animate={{ rotate: otwarty ? 360 : 0 }}
                    transition={{ duration: otwarty ? 8 : 0.4, repeat: otwarty ? Infinity : 0, ease: 'linear' }}
                    style={{ fontSize: 22, lineHeight: 1 }}
                >
                    🌀
                </motion.span>
                <span style={{ fontSize: 9, letterSpacing: '0.14em', lineHeight: 1.1 }}>TeOGOCHI</span>
                <span style={{ fontSize: 8, color: '#64748b', lineHeight: 1 }}>
                    {stado.length} w stadzie
                </span>
            </motion.button>

            {/* Uniwersalny Panel Teogochi */}
            {panelGatunekId && (
                <TeogochiPanel
                    gatunekId={panelGatunekId}
                    onClose={() => setPanelGatunekId(null)}
                    onSwitchGatunek={(id) => {
                        setPanelGatunekId(id);
                        setDyzurny(id);
                    }}
                />
            )}
        </div>
    );
};

export default WirTeogochi;
