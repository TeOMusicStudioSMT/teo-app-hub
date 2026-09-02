/**
 * 🌐 OtakOSProvider — wczytuje rejestr wag przy starcie i podaje go dalej.
 *
 * ⚠️ TA WERSJA JEST PRZEPISANA. Pierwotna:
 *   · wołała `useDispatch`/`useSelector` z `react-redux`, którego w Katedrze nie ma,
 *   · importowała slice z `../redux/store/...`, a plik leżał gdzie indziej,
 *   · miała ścieżkę do modeli WPISANĄ NA SZTYWNO (`F:\5 stars\...`) — Katedra jest
 *     klasy Live-USB i na innej maszynie ta ścieżka nie istnieje,
 *   · BLOKOWAŁA CAŁĄ APLIKACJĘ ekranem „Inicjalizacja..." do czasu skanu; gdyby
 *     most spał, Katedra nie wstałaby wcale.
 *
 * Teraz: katalog zna most (to on siedzi na dysku), skan leci w tle, a dzieci
 * renderują się od razu. Gdy mostu nie ma, mówimy to w rogu zamiast trzymać
 * Suwerena przed pustym ekranem.
 */
import React, { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { scanAndInitializeModels } from '../services/ModelRegistryService';
import { modelRegistryAtom, modelKatalogAtom, rejestrZywyAtom } from '../store/otakOS';

const OtakOSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const setRejestr = useSetAtom(modelRegistryAtom);
    const setKatalog = useSetAtom(modelKatalogAtom);
    const setZywy = useSetAtom(rejestrZywyAtom);

    useEffect(() => {
        let porzucone = false;
        void (async () => {
            const r = await scanAndInitializeModels();
            if (porzucone) return;
            setRejestr(r.zasoby);
            setKatalog(r.katalog);
            // `istnieje` mówi o katalogu, ale gdy most śpi, dostajemy pusty rejestr
            // z `istnieje: false` — i to też jest uczciwa odpowiedź „nie wiem".
            setZywy(r.istnieje);
            console.log(`[OtakOS] Rejestr wag: ${r.zasoby.length} zasobów z ${r.katalog || 'nieznanego katalogu'}`);
        })();
        return () => { porzucone = true; };
    }, [setRejestr, setKatalog, setZywy]);

    // Świadomie BEZ ekranu ładowania: skan katalogu to sprawa tła, a nie brama,
    // przez którą musi przejść cała Katedra.
    return <>{children}</>;
};

export default OtakOSProvider;
