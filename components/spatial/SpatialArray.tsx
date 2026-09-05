/**
 * 🗂️ SpatialArray — siatka kart przestrzennych.
 *
 * ⚠️ NAPISANA OD NOWA. Wersja z `_OtakOs_Wymiar/src` miała dwa błędy, które
 * przewracały ją niezależnie od braku three.js:
 *
 *   1. Wołała `useCallback` WEWNĄTRZ `.map()`. To złamanie Reguł Hooków —
 *      React wyrzuca „Rendered more hooks than during the previous render",
 *      gdy tylko liczba kart się zmieni.
 *   2. Wszystkie karty renderowały się BEZ pozycji, czyli jedna w drugiej —
 *      w scenie 3D nałożyłyby się na siebie w punkcie zero.
 *
 * Do tego karmiła się wymyślonymi danymi („Moduł Kernel", „Grafika GPU",
 * „API Gateway"). Teraz domyślnie pokazuje PRAWDZIWE stado — trzynaście
 * gatunków TeOgochi z katalogu Katedry.
 */
import React from 'react';
import { SpatialCard3D } from './SpatialCard3D';
import { tokeny } from '../../lib/designTokens';
import { GATUNKI } from '../../lib/teogochiGatunki';

export interface PozycjaSiatki {
    id: string;
    tytul: string;
    opis: string;
    gatunekId?: string;
    onDotkniecie?: () => void;
}

export interface SpatialArrayProps {
    /** Co pokazać. Bez tego — całe stado TeOgochi. */
    pozycje?: PozycjaSiatki[];
    onWybor?: (id: string) => void;
}

/** Stado jako pozycje siatki — jedno źródło, katalog gatunków. */
function zeStada(): PozycjaSiatki[] {
    return GATUNKI.map(g => ({
        id: g.id, tytul: g.imie, opis: g.opis, gatunekId: g.id,
    }));
}

export const SpatialArray: React.FC<SpatialArrayProps> = ({ pozycje, onWybor }) => {
    const t = tokeny();
    const lista = pozycje ?? zeStada();

    if (!lista.length) {
        return <p className="text-sm text-slate-500">Nie ma czego pokazać.</p>;
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lista.map(p => (
                <SpatialCard3D
                    key={p.id}
                    tytul={p.tytul}
                    opis={p.opis}
                    gatunekId={p.gatunekId}
                    t={t}
                    // Callback budujemy TUTAJ, w JSX — to zwykła domknięta funkcja,
                    // nie hook, więc pętla jej nie dotyczy.
                    onDotkniecie={p.onDotkniecie ?? (onWybor ? () => onWybor(p.id) : undefined)}
                />
            ))}
        </div>
    );
};

export default SpatialArray;
