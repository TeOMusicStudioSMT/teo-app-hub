/**
 * 👻 Duchy nagrań — praca w tle zapisana na dysku jako „nagrywa”, której po restarcie mostu już nikt nie liczy.
 *
 * Suweren 2026-10-06: „po restarcie… w studio podcast pokazuje, że nagrywa… chyba się zawiesiło”. Etap „nagrywa” żyje
 * w pliku (odcinek.json, wywiad.json, scena.json), a postęp w pamięci (`wRobocie`). Most padł albo wstał od nowa →
 * plik dalej mówi „nagrywa”, pamięć jest pusta, a każda zmiana odbija się od „właśnie się nagrywa”. Na zawsze.
 *
 * Zasada: „nagrywa” bez wpisu w `wRobocie` = przerwane. Przy odczycie zamieniamy to na błąd z powodem i zapisujemy,
 * żeby Suweren mógł nagrać ponownie. Kolejność w `nagraj`: NAJPIERW wpis w `wRobocie`, POTEM zapis „nagrywa” —
 * inaczej odczyt w tej szczelinie wziąłby żywe nagranie za ducha.
 */
export const POWOD_PRZERWANIA = 'Nagrywanie przerwane — most wystartował od nowa w trakcie i nic już tego nie liczy. Nagraj ponownie.';

/**
 * @param {object|null} x wczytany zapis (z `id` i `etap`)
 * @param {{ wRobocie: Map<string, unknown>, pisz: (plik: string, d: object) => Promise<void>, plik: string, dopisek?: string }} o
 * @returns {Promise<object|null>} zapis, a duch — już jako błąd
 */
export async function bezDucha(x, { wRobocie, pisz, plik, dopisek = '' }) {
    if (!x || x.etap !== 'nagrywa' || wRobocie.has(x.id)) return x;
    const { postep, ...zapis } = x;
    Object.assign(zapis, { etap: 'blad', blad: `${POWOD_PRZERWANIA}${dopisek ? ` ${dopisek}` : ''}`, przerwano: new Date().toISOString() });
    await pisz(plik, zapis).catch(() => {});
    return zapis;
}

export default { bezDucha, POWOD_PRZERWANIA };
