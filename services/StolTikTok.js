/**
 * 📱 StolTikTok.js — Zarządzanie kontami i tokenami TikTok w Katedrze OtakOS
 * 
 * Odpowiada za:
 * - Pobieranie listy połączonych kont TikTok
 * - Czyszczenie zduplikowanych starych tokenów (np. "Zebrra Football")
 * - Bezpieczne rozłączanie pojedynczych kont (rozłącz wzorem YouTube)
 * - Pobieranie najnowszego produkcyjnego tokenu do publikacji szkiców
 */

import path from 'path';
import fs from 'fs/promises';

const SECRETS_FILE = path.join(process.cwd(), '_OtakOs_Wymiar', 'media', 'media_secrets.json');

/**
 * Wczytuje sekrety mediów.
 */
async function wczytajSekrety() {
    try {
        const text = await fs.readFile(SECRETS_FILE, 'utf8');
        return JSON.parse(text);
    } catch {
        return {};
    }
}

/**
 * Atomowy zapis sekretów mediów.
 */
async function zapiszSekrety(dane) {
    const tempFile = `${SECRETS_FILE}.tmp.${Date.now()}`;
    await fs.mkdir(path.dirname(SECRETS_FILE), { recursive: true });
    await fs.writeFile(tempFile, JSON.stringify(dane, null, 2), 'utf8');
    await fs.rename(tempFile, SECRETS_FILE);
}

/**
 * Czyści zduplikowane stare tokeny TikToka, zostawiając wyłącznie najnowszy
 * produkcyjny token dla danej nazwy konta (np. "Zebrra Football").
 */
export async function wyczyscDuplikatyTikToka() {
    const sekrety = await wczytajSekrety();
    if (!sekrety.tiktok || !Array.isArray(sekrety.tiktok.KONTA)) {
        return { success: true, zmieniono: false, konta: [] };
    }

    const suroweKonta = sekrety.tiktok.KONTA;
    const poNazwie = new Map();

    for (const k of suroweKonta) {
        const klucz = (k.nazwa || k.id || '').trim().toLowerCase();
        const istniejace = poNazwie.get(klucz);
        if (!istniejace || (new Date(k.polaczono || 0).getTime() >= new Date(istniejace.polaczono || 0).getTime())) {
            poNazwie.set(klucz, k);
        }
    }

    const oczyszczone = Array.from(poNazwie.values());
    const zmieniono = oczyszczone.length !== suroweKonta.length || !oczyszczone.some(k => k.id === sekrety.tiktok.DOMYSLNY);

    if (zmieniono) {
        sekrety.tiktok.KONTA = oczyszczone;
        if (!oczyszczone.some(k => k.id === sekrety.tiktok.DOMYSLNY)) {
            sekrety.tiktok.DOMYSLNY = oczyszczone[oczyszczone.length - 1]?.id ?? oczyszczone[0]?.id ?? null;
        }
        await zapiszSekrety(sekrety);
        console.log(`[StolTikTok] 🧹 Oczyszczono duplikaty tokenów TikToka. Pozostało kont: ${oczyszczone.length}`);
    }

    return {
        success: true,
        zmieniono,
        domyslny: sekrety.tiktok.DOMYSLNY,
        konta: oczyszczone.map(({ id, nazwa, polaczono }) => ({ id, nazwa, polaczono }))
    };
}

/**
 * Zwraca listę połączonych kont TikToka (bez wrażliwych pełnych tokenów) oraz ewentualny ostatni błąd.
 */
export async function pobierzKontaTikToka() {
    const sekrety = await wczytajSekrety();
    const konta = Array.isArray(sekrety?.tiktok?.KONTA) ? sekrety.tiktok.KONTA : [];
    return {
        domyslny: sekrety?.tiktok?.DOMYSLNY ?? konta[0]?.id ?? null,
        ostatniBlad: sekrety?.tiktok?.OSTATNI_BLAD ?? null,
        konta: konta.map(({ id, nazwa, polaczono }) => ({ id, nazwa, polaczono }))
    };
}

/**
 * Zapisuje błąd autoryzacji lub wymiany tokenu TikToka w stanie Impresariatu.
 */
export async function zapiszBladTikToka(powod) {
    const sekrety = await wczytajSekrety();
    if (!sekrety.tiktok) sekrety.tiktok = {};
    sekrety.tiktok.OSTATNI_BLAD = {
        komunikat: String(powod?.message || powod),
        kiedy: new Date().toISOString()
    };
    await zapiszSekrety(sekrety);
}

/**
 * Czyści zapisany błąd TikToka.
 */
export async function wyczyscBladTikToka() {
    const sekrety = await wczytajSekrety();
    if (sekrety.tiktok?.OSTATNI_BLAD) {
        delete sekrety.tiktok.OSTATNI_BLAD;
        await zapiszSekrety(sekrety);
    }
}

/**
 * Rozłącza wybrane konto TikTok (lub wszystkie gdy kontoId === null),
 * usuwając token ze skarbca Katedry (wzorem YouTube).
 */
export async function rozlaczKontoTikToka(kontoId = null) {
    const sekrety = await wczytajSekrety();
    if (!sekrety.tiktok || !Array.isArray(sekrety.tiktok.KONTA)) {
        return { success: true, konta: [] };
    }

    const idDoUsuniecia = typeof kontoId === 'object' && kontoId !== null ? (kontoId.kontoId || kontoId.id) : kontoId;
    const stareKonta = sekrety.tiktok.KONTA;
    sekrety.tiktok.KONTA = idDoUsuniecia ? stareKonta.filter(k => k.id !== idDoUsuniecia) : [];

    if (!sekrety.tiktok.KONTA.some(k => k.id === sekrety.tiktok.DOMYSLNY)) {
        sekrety.tiktok.DOMYSLNY = sekrety.tiktok.KONTA[0]?.id ?? null;
    }

    await zapiszSekrety(sekrety);
    console.log(`[StolTikTok] ⏏ Rozłączono konto TikTok: ${idDoUsuniecia || 'wszystkie'}`);

    return {
        success: true,
        domyslny: sekrety.tiktok.DOMYSLNY,
        konta: sekrety.tiktok.KONTA.map(({ id, nazwa, polaczono }) => ({ id, nazwa, polaczono }))
    };
}

/**
 * Pobiera najnowszy produkcyjny token TikToka do wysyłki szkicu.
 */
export async function najnowszyTokenTikToka(kontoId = null) {
    const sekrety = await wczytajSekrety();
    const konta = Array.isArray(sekrety?.tiktok?.KONTA) ? sekrety.tiktok.KONTA : [];
    if (!konta.length) {
        throw new Error('Brak połączonych kont TikToka w Katedrze.');
    }

    const konto = kontoId
        ? konta.find(k => k.id === kontoId)
        : (konta.find(k => k.id === sekrety?.tiktok?.DOMYSLNY) || konta[konta.length - 1]);

    if (!konto || !konto.token) {
        throw new Error('Konto TikTok nie posiada aktywnego tokenu.');
    }

    return {
        id: konto.id,
        nazwa: konto.nazwa,
        token: konto.token,
        polaczono: konto.polaczono
    };
}

export default {
    wyczyscDuplikatyTikToka,
    pobierzKontaTikToka,
    rozlaczKontoTikToka,
    najnowszyTokenTikToka,
    zapiszBladTikToka,
    wyczyscBladTikToka
};
