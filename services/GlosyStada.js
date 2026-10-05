/**
 * 🗣️ Głosy Stada — który TeOgochi mówi jaką barwą (i czysty tekst do mowy).
 *
 * Suweren (2026-10-05): „głosy w panelu Joanny pochodzą z _OtakOs_Voice… i one są tragiczne… czytają jakieś ukryte
 * znaki… i tak samo korzysta z tego Katedra, jak mówi… głosy można dać z barw, jakich używamy do wywiadów”.
 *
 * DWA POWODY, CZEMU BRZMIAŁO ŹLE:
 *   1. Każde miejsce, gdzie TeOgochi mówi (Orb, panel gatunku, rozmowa kompana, Delegat, Joanna w Music Studio), miało
 *      na sztywno `przewod: 'piper-pl'` — dwa głosy Pipera dla całego stada, bez wyboru.
 *   2. Tekst szedł do syntezy surowy: `**pogrubienia**`, `#`, emoji, linki, nawiasy z kodem — Piper czyta je jak litery.
 *
 * TERAZ: mapa `_OtakOs_Wymiar/glosy-stada.json` { teogochiId: glos }, gdzie `glos` ma TEN SAM kształt co głos aktora
 * w wywiadach (`normalizujGlos`): profil Katedry `{profil}` albo profil VoiceStudio `{voicestudio}`. Most w
 * `/api/voice/speak` sprawdza mapę po `teogochi` albo `voiceId` (wołający podają id gatunku) — przypisany głos wygrywa
 * z domyślnym Piperem, więc wszystkie stare wywołania dostają nową barwę bez zmian u siebie. Brak wpisu = jak dawniej.
 * `tekstDoMowy` czyści KAŻDY tekst przed syntezą, niezależnie od toru.
 */
import fs from 'fs/promises';
import path from 'path';
import { normalizujGlos } from './WywiadAktorow.js';

const ID = /^[a-z0-9][a-z0-9-]{1,30}$/;

/**
 * Tekst z czatu/markdownu → to, co ma być POWIEDZIANE: bez znaczników, emoji, linków i bloków kodu.
 * Słowa i interpunkcja zostają; nic nie jest dopisywane.
 */
export function tekstDoMowy(tekst) {
    return String(tekst ?? '')
        .replace(/```[\s\S]*?```/g, ' ')                          // bloki kodu — nie do czytania na głos
        .replace(/`([^`]*)`/g, '$1')                               // kod w linii → sam tekst
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')                     // obrazki markdown
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                   // [opis](link) → opis
        .replace(/https?:\/\/\S+/g, ' ')                           // gołe linki
        .replace(/<[^>]+>/g, ' ')                                  // znaczniki HTML
        .replace(/^\s{0,3}(#{1,6}|>|[-*+•]|\d+[.)])\s+/gm, '')     // nagłówki, cytaty, punktory na początku linii
        .replace(/(\*\*|__|\*|_|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')   // **pogrubienia**, _kursywy_, ~~skreślenia~~
        .replace(/[*_~#|^]+/g, ' ')                                // resztki znaczników
        .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, ' ') // emoji, flagi, łączniki
        .replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202F\u2060-\u206F]/g, ' ') // znaki sterujące i niewidoczne
        .replace(/([.!?…:;,])\s*\n+\s*/g, '$1 ')                   // po interpunkcji nowa linia = spacja
        .replace(/\s*\n+\s*/g, '. ')                               // nowe linie → pauza
        .replace(/([.!?…])\s*\.(\s|$)/g, '$1$2')                   // bez podwójnych kropek po pauzie
        .replace(/\s{2,}/g, ' ')
        .replace(/^[\s.]+/, '')
        .trim();
}

/** @param {{ katalog: string }} o */
export function utworzGlosyStada(o) {
    const PLIK = path.join(o.katalog, 'glosy-stada.json');
    const czytaj = async () => { try { return JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { return {}; } };

    async function wszystkie() { return czytaj(); }
    async function glos(id) {
        const k = String(id ?? '').toLowerCase();
        return ID.test(k) ? ((await czytaj())[k] ?? null) : null;
    }
    /** `glos` = { profil } | { voicestudio } | null (null = wraca domyślny Piper). */
    async function ustaw(id, g) {
        const k = String(id ?? '').toLowerCase();
        if (!ID.test(k)) throw new Error('Złe id TeOgochi.');
        const n = normalizujGlos(g);
        if (g && !n?.profil && !n?.voicestudio) throw new Error('Głos TeOgochi to profil Katedry albo profil VoiceStudio — jak u aktorów.');
        const mapa = await czytaj();
        if (n) mapa[k] = { ...(n.profil ? { profil: n.profil } : {}), ...(n.voicestudio ? { voicestudio: n.voicestudio } : {}) };
        else delete mapa[k];
        await fs.mkdir(path.dirname(PLIK), { recursive: true });
        await fs.writeFile(`${PLIK}.tmp`, JSON.stringify(mapa, null, 1), 'utf8');
        await fs.rename(`${PLIK}.tmp`, PLIK);
        return mapa;
    }
    return { wszystkie, glos, ustaw };
}

export default { utworzGlosyStada, tekstDoMowy };
