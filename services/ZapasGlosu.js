/**
 * 🛟 Zapas głosu: profil VoiceStudio → próbka dla klonu Katedry (tor klon-lokalny, :5002).
 *
 * Suweren 2026-10-08: „rób fallback głosu na klon Katedry” — VoiceStudio (osobny program) padało na
 * „CUDA error: unspecified launch failure” przy gorącej karcie i nagranie podcastu stawało.
 * Żeby zapas mówił TYM SAMYM głosem, a nie obcym, szukamy próbki po kolei:
 *   1. `vs-<id>.wav` w katalogu głosów Katedry (zapas już raz przygotowany),
 *   2. próbka Katedry o nazwie profilu („TeO G.” → `teo-g.wav`, jak robi Sampler/GlosZeStemu),
 *   3. nagranie referencyjne profilu z danych VoiceStudio (`ref_audio_path`, domyślnie `<id>.wav`)
 *      → KOPIA do Katedry jako `vs-<id>.wav` (oryginał zostaje w VoiceStudio).
 * Nic nie znalezione = null (wołający oddaje oryginalny błąd VoiceStudio).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const nazwaPliku = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/**
 * @param {string} id  id profilu VoiceStudio
 * @param {{ katalogGlosow: string, katalogVS: string, profile?: () => Promise<Array<{id:string, name?:string, ref_audio_path?:string}>> }} o
 * @returns {Promise<{ glos: string, probka: string } | null>}
 */
export async function probkaZapasowa(id, { katalogGlosow, katalogVS, profile = async () => [] }) {
    const czysty = String(id || '').replace(/[^\w-]/g, '');
    if (!czysty) return null;
    const zapas = path.join(katalogGlosow, `vs-${czysty}.wav`);
    if (fsSync.existsSync(zapas)) return { glos: `vs-${czysty}`, probka: zapas };

    const p = (await profile().catch(() => [])).find((x) => String(x.id) === czysty) ?? null;
    const poNazwie = p?.name ? nazwaPliku(p.name) : '';
    if (poNazwie && fsSync.existsSync(path.join(katalogGlosow, `${poNazwie}.wav`))) return { glos: poNazwie, probka: path.join(katalogGlosow, `${poNazwie}.wav`) };

    // Nagranie referencyjne VoiceStudio — tylko plik z jego katalogu głosów (żadnych ścieżek z zewnątrz).
    const ref = path.basename(String(p?.ref_audio_path || `${czysty}.wav`));
    const zrodlo = path.join(katalogVS, ref);
    if (!/\.(wav|mp3|flac|ogg)$/i.test(ref) || !fsSync.existsSync(zrodlo)) return null;
    await fs.mkdir(katalogGlosow, { recursive: true });
    await fs.copyFile(zrodlo, zapas);
    return { glos: `vs-${czysty}`, probka: zapas };
}

export default { probkaZapasowa, nazwaPliku };
