/**
 * 💹 Punkt wpięcia prywatnego modułu TeDa (repo TeD_OtakOS → `moduly/ted/`, w .gitignore).
 *
 * Publiczna Katedra modułu nie ma — `import.meta.glob` zwraca wtedy pusty obiekt, Vite niczego nie dołącza,
 * a Hub działa jak dawniej (TeODash pokazuje swój stary panel TeDa). Gdy moduł jest zainstalowany (Katedra spełniła
 * wymogi: Filar III + 777 777 GRV + JaJo TeDa), pojawia się Centrum Finansowe w prawym menu.
 */
import React, { Suspense } from 'react';

const centrum = import.meta.glob('../moduly/ted/CentrumFinansoweTed.tsx');
const ladujCentrum = Object.values(centrum)[0] as (() => Promise<{ default: React.ComponentType<{ tryb?: string }> }>) | undefined;

/** Czy prywatny moduł TeDa jest w tej Katedrze. */
export const MODUL_TED = !!ladujCentrum;

const Centrum = ladujCentrum ? React.lazy(ladujCentrum) : null;

/** Centrum Finansowe TeDa albo nic (moduł niezainstalowany). */
export const CentrumTeda: React.FC<{ tryb?: string }> = (p) => (Centrum ? <Suspense fallback={null}><Centrum {...p} /></Suspense> : null);

export default CentrumTeda;
