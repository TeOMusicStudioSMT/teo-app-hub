/**
 * 💍 BiometriaService — Biometria Suwerena i Koherencja 0.00G (PEAQ Smart Ring PSR 100-SILVER 10).
 *
 * Most biometryczny łączący czujniki pierścienia (BPM, SpO2, bateria, ruch)
 * z Katedrą OtakOS, Ekonomią Oddechu (GRV), Jamem z Joanną i maną Tetherii.
 *
 * Zapisuje aktualny stan w pamięci oraz w `_OtakOs_Wymiar/biometria_suwerena.json`.
 */

import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

const PLIK = 'biometria_suwerena.json';
const MAX_HISTORIA = 60; // trzymamy 60 ostatnich odczytów dla wykresu kardiologicznego

let stanWPamieci = {
    urzadzenie: 'PEAQ Smart Ring (Model: PSR 100-SILVER 10)',
    rozmiar: 10,
    bpm: 0,
    spo2: 0,
    battery: 100,
    koherencja: 0.0,
    poziom: 'OCZEKIWANIE',
    tempoMuzyczne: 72,
    manaBonus: 1.0,
    timestamp: null,
    online: false,
    source: 'BEZPOŚREDNIE_BLE', // 'BEZPOŚREDNIE_BLE' | 'STÓŁ_MOBILNY' | 'SYMULACJA'
    historia: [],
};

function sciezka(katalog) {
    return path.join(katalog, PLIK);
}

/**
 * Wylicza współczynnik koherencji 0.00G w oparciu o fizjologiczny rezonans serca.
 * Optymalny zakres spoczynkowy: 60 - 78 BPM.
 */
export function obliczKoherencje(bpm, spo2 = 98) {
    if (!bpm || bpm <= 30) {
        return {
            koherencja: 0.0,
            poziom: 'BRAK ODCZYTU',
            tempoMuzyczne: 72,
            manaBonus: 1.0,
        };
    }

    // Odchylenie od optymalnego punktu rezonansowego 68 BPM
    const celBpm = 68;
    const delta = Math.abs(bpm - celBpm);
    
    // Bazowa koherencja z dystansu do złotego rytmu
    let k = 1.0 - (delta / 50.0);
    if (k < 0.2) k = 0.2;
    if (k > 1.0) k = 1.0;

    // Korekta o saturację tlenową
    if (spo2 >= 98) k = Math.min(1.0, k + 0.05);
    else if (spo2 > 0 && spo2 < 94) k = Math.max(0.1, k - 0.15);

    k = +(k.toFixed(3));

    let poziom = 'ADAPTACJA';
    if (k >= 0.88) poziom = 'SZCZYTOWA 0.00G';
    else if (k >= 0.72) poziom = 'HARMONIJNA';
    else if (k >= 0.50) poziom = 'SPOKOJNA';
    else poziom = 'WZBURZENIE';

    const manaBonus = +(1.0 + k * 0.5).toFixed(2); // 1.0x - 1.50x many w Tetherii
    const tempoMuzyczne = Math.min(140, Math.max(50, Math.round(bpm)));

    return { koherencja: k, poziom, tempoMuzyczne, manaBonus };
}

export async function wczytaj(katalog) {
    try {
        const raw = await fs.readFile(sciezka(katalog), 'utf8');
        const dane = JSON.parse(raw);
        if (dane && typeof dane === 'object') {
            stanWPamieci = {
                ...stanWPamieci,
                ...(dane.aktualny || {}),
                urzadzenie: dane.urzadzenie || stanWPamieci.urzadzenie,
                rozmiar: dane.rozmiar || 10,
                historia: Array.isArray(dane.historia) ? dane.historia.slice(-MAX_HISTORIA) : [],
            };
        }
        return dane;
    } catch {
        return null;
    }
}

export async function zapisz(katalog, dane) {
    if (!fsSync.existsSync(katalog)) await fs.mkdir(katalog, { recursive: true });
    const cel = sciezka(katalog);
    const tmp = cel + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(dane, null, 2), 'utf8');
    await fs.rename(tmp, cel);
}

/**
 * Rejestruje nowy puls z pierścienia PEAQ (z PC lub ze Stołu Mobilnego).
 */
export async function zarejestrujOdczyt(katalog, { bpm, spo2, battery, deviceName, source }) {
    const terazIso = new Date().toISOString();
    const parsedBpm = Math.max(0, parseInt(bpm, 10) || 0);
    const parsedSpo2 = Math.max(0, parseInt(spo2, 10) || (parsedBpm > 0 ? 98 : 0));
    const parsedBattery = Math.max(0, Math.min(100, parseInt(battery, 10) || stanWPamieci.battery));
    const nazwa = String(deviceName || 'PEAQ Smart Ring (Model: PSR 100-SILVER 10)').trim();
    const zrodlo = String(source || 'BEZPOŚREDNIE_BLE').trim();

    const metryki = obliczKoherencje(parsedBpm, parsedSpo2);

    const wpisHistorii = {
        bpm: parsedBpm,
        spo2: parsedSpo2,
        battery: parsedBattery,
        koherencja: metryki.koherencja,
        source: zrodlo,
        timestamp: terazIso,
    };

    stanWPamieci.historia.push(wpisHistorii);
    if (stanWPamieci.historia.length > MAX_HISTORIA) {
        stanWPamieci.historia = stanWPamieci.historia.slice(-MAX_HISTORIA);
    }

    stanWPamieci = {
        ...stanWPamieci,
        urzadzenie: nazwa,
        rozmiar: 10,
        bpm: parsedBpm,
        spo2: parsedSpo2,
        battery: parsedBattery,
        koherencja: metryki.koherencja,
        poziom: metryki.poziom,
        tempoMuzyczne: metryki.tempoMuzyczne,
        manaBonus: metryki.manaBonus,
        source: zrodlo,
        timestamp: terazIso,
        online: parsedBpm > 0,
    };

    const doZapisu = {
        urzadzenie: stanWPamieci.urzadzenie,
        model: 'PSR 100-SILVER 10',
        rozmiar: stanWPamieci.rozmiar,
        source: stanWPamieci.source,
        aktualny: {
            bpm: stanWPamieci.bpm,
            spo2: stanWPamieci.spo2,
            battery: stanWPamieci.battery,
            koherencja: stanWPamieci.koherencja,
            poziom: stanWPamieci.poziom,
            tempoMuzyczne: stanWPamieci.tempoMuzyczne,
            manaBonus: stanWPamieci.manaBonus,
            source: stanWPamieci.source,
            timestamp: stanWPamieci.timestamp,
            online: stanWPamieci.online,
        },
        historia: stanWPamieci.historia,
        ostatniaSynchronizacja: terazIso,
    };

    try {
        await zapisz(katalog, doZapisu);
    } catch (e) {
        console.warn(`[Biometria] Nie udało się zapisać ${PLIK}: ${e.message}`);
    }

    return stanWPamieci;
}

/**
 * Zwraca aktualny stan biometrii Suwerena (wraz ze statusem Przekaźnika Stołu Mobilnego).
 */
export async function stanBiometrii(katalog) {
    // Sprawdzamy czy odczyt nie jest przestarzały (> 60s)
    let online = stanWPamieci.online;
    if (stanWPamieci.timestamp) {
        const deltaMs = Date.now() - new Date(stanWPamieci.timestamp).getTime();
        if (deltaMs > 60000 && stanWPamieci.bpm > 0) {
            online = false; // brak świeżego sygnału
        }
    }

    const isRelayed = stanWPamieci.source === 'STÓŁ_MOBILNY';

    return {
        ...stanWPamieci,
        isRelayed,
        online,
    };
}

export default {
    wczytaj,
    zapisz,
    zarejestrujOdczyt,
    stanBiometrii,
    obliczKoherencje,
};
