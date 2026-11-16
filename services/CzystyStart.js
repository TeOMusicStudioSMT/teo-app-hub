/**
 * 🧼 Filtr czystego startu dla głosów lokalnych (VoiceStudio): profile `TeO G.` / `TeOgochi` potrafią złapać tuż przed
 * pierwszym słowem krótki trzask albo stuknięcie, a na końcu — ogon pogłosu. Każde nagranie z VoiceStudio przechodzi więc przez ffmpeg:
 *  1. `silenceremove` na początku: ucina ciszę ORAZ zdarzenia krótsze niż 0,12 s (trzask nie jest mową — mowa trwa dłużej),
 *  2. łagodne wejście (`afade in 0,08 s`) i wyjście (`afade out 0,08 s` — przez odwrócenie, bo nie znamy długości z góry),
 *  3. mp3 44,1 kHz 128 kb/s — ten sam format co reszta paczki księgi.
 */
export const PROG_CISZY_DB = -42, MIN_MOWY_S = 0.12, FADE_S = 0.08;

export function argumentyCzystegoStartu(wej, wyj) {
    const af = [
        `silenceremove=start_periods=1:start_duration=${MIN_MOWY_S}:start_threshold=${PROG_CISZY_DB}dB:detection=peak`,
        `afade=t=in:d=${FADE_S}`,
        'areverse', `afade=t=in:d=${FADE_S}`, 'areverse',
    ].join(',');
    return ['-hide_banner', '-loglevel', 'error', '-y', '-i', wej, '-af', af, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', wyj];
}

/** Przepuszcza nagranie przez filtr (wej → wyj). */
export async function oczyscStart({ ffmpeg, uruchom, wej, wyj }) {
    if (!ffmpeg || !uruchom) throw new Error('Brak ffmpeg — nie oczyszczę startu nagrania lokalnego.');
    await uruchom(ffmpeg, argumentyCzystegoStartu(wej, wyj), { windowsHide: true, timeout: 120_000, maxBuffer: 1 << 24 });
}

/** Długość pliku w sekundach (ffmpeg -i, bez ffprobe). */
export async function dlugoscS({ ffmpeg, uruchom, plik }) {
    const { stderr } = await uruchom(ffmpeg, ['-hide_banner', '-i', plik], { windowsHide: true, maxBuffer: 1 << 22 }).catch((e) => ({ stderr: e.stderr ?? '' }));
    const m = String(stderr).match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : null;
}

export default { argumentyCzystegoStartu, oczyscStart, dlugoscS, PROG_CISZY_DB, MIN_MOWY_S, FADE_S };
