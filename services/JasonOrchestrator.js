/**
 * 🎛️ Jason — autonomiczny orkiestrator kampanii (Suweren 2026-11-12: „Jason sam w kodzie Node.js: audio-create →
 * pobranie do _OtakOs_Muzyka/Suno MCP/ → okładka od Palety → pakiet »Do akcept.« w StoL”). Album: „Zero Gravity Heart (0.00G Sessions)”.
 *
 * BEZ czatu i BEZ modelu językowego: kroki wykonuje kod, wprost na narzędziach Suno MCP mostu (services/SunoMcp.js).
 *   1. workspace  — `workspaces-list` → istniejący o nazwie albumu albo `workspaces-create` (padło = kampania idzie dalej bez)
 *   2. glos       — persona z `voices-list` (My Voices: „KAEL (S.M.T.)”, „ELARA (S.M.T)”) → `voice_id`; Suno bierze JEDEN głos na utwór
 *   3. utwor      — `audio-create` (tryb prosty `description` albo własny `lyrics`+`style`), `idempotency_key` = id kampanii
 *   4. czekanie   — `audio-wait {ids, until: complete}` w pętli; z wyniku tylko metadane: długość i link do odsłuchu (suno.com/song/…)
 *   5. okladka    — Paleta: FLUX przez `cfg.okladka({ prompt })` (padło = pakiet bez okładki, z powodem; ↻ ponawia sam ten krok)
 *   6. pakiet     — stan `do_akceptacji` → 📥 Izba zgód (źródło `jason`) → StoL „Izba Akceptacji”: odsłuch, potem JEDNA wersja
 *
 * POBRANIA (Suweren 2026-11-12, po pierwszej prawdziwej kampanii): plan Suno Pro ma 20 pobrań z prawami komercyjnymi na
 * miesiąc, a dwa pobrania naraz kończą się `rate_limited`. Dlatego potok NICZEGO nie pobiera (żadnego `audio-download`,
 * żadnego zapisu z wyniku) — dopiero „✓ Pobierz wersję N” w Izbie woła `audio-download` dla tej jednej wersji
 * (z `confirm`, bo kliknięcie Suwerena jest zgodą) i zapisuje ją do `_OtakOs_Muzyka/Suno MCP/`.
 *
 * 🎨 OKŁADKA OD NOWA: `przerysujOkladke(id)` działa także dla przyjętej kampanii (FLUX w tle, stara zostaje do udanej
 * zamiany) i od razu podmienia `cover_3000x3000.jpg` w paczce Spotify. 🎤 Stacje niosą własną personę (Stacja 2 = Elara).
 *
 * ➕ STACJE: wbudowane `STACJE` 1–5 (album „Zero Gravity Heart”, sztafeta głosów Kael ↔ Elara) + własne z interfejsu
 * (`dodajStacje` → `_OtakOs_Wymiar/jason/stacje.json`, numer nadaje kod) — nowy utwór bez edycji tego pliku.
 *
 * 🚀 PACZKA SPOTIFY (Suweren 2026-11-12): po ✓ i pobraniu wersji `przygotujSpotify(id)` składa folder wydawniczy
 * `_OtakOs_Muzyka/Spotify_Releases/<album>/<NN>_<tytuł>/`: `master.wav` (44,1 kHz, 16 bit, stereo), `original.mp3`,
 * `cover_3000x3000.jpg`, `lyrics_clean.txt`, `spotify_metadata.json`. Master: najpierw bezstratny WAV z Suno
 * (`audio-download {format: 'wav'}` BEZ `confirm` — gdyby Suno chciało za niego kolejne pobranie z limitu, NIE bierzemy)
 * → inaczej konwersja pobranego MP3 (uczciwa uwaga: kontener WAV, jakość MP3). To zmiana formatu, nie mastering dźwięku.
 * Katedra niczego nie wysyła do Spotify — Spotify przyjmuje utwory tylko od dystrybutora; kartę wgrywa Suweren w jego panelu.
 *
 * KREDYTY: jedno `audio-create` = 2 utwory z konta Suno Suwerena. Ponowienie NIGDY nie tworzy utworu drugi raz, gdy
 * kampania ma już `klipy` — wznawia od czekania. Duch po restarcie mostu = błąd z powodem (↻ wznawia).
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Suweren 2026-11-12: dawny prompt („StarLight Diner… neon”) dał bełkotliwy szyld i kanapę na chodniku PRZED barem → czyste wnętrze, żadnych napisów.
export const KLIMAT_OKLADKI = 'Cinematic cozy interior photograph inside a late-night retro diner, a woman and a man sitting across from each other in a deep red velvet booth inside the room, '
    + 'warm amber table lamp between two porcelain coffee cups, raindrops on the glass window beside them with blurry city bokeh lights outside in the night, '
    + '35mm film grain, intimate mood, strictly no text, no letters, no neon words, no signage.';

/** Dystrybutor Suwerena na Spotify (2026-11-12): DistroKid — formularz nowego wydania; adres do zmiany w ustawieniach. */
export const DYSTRYBUTOR_DOMYSLNY = 'https://distrokid.com/new/';

export const ALBUM = 'Zero Gravity Heart (0.00G Sessions)';

/** Stacje albumu — tekst i styl Suwerena (2026-11-12); do nadpisania w żądaniu (`stacja: { tytul, opis | lyrics, styl, … }`). */
export const STACJE = {
    1: {
        nr: 1, tytul: 'Velvet Booth for Two (82 BPM Intro)', bpm: 82, artysci: ['Elara', 'Kael'], gatunek: 'R&B/Soul', jezyk: 'EN',
        styl: 'sensual neo-soul, late night lounge, 82 bpm, warm Fender Rhodes piano, upright double bass, brushed jazz drums, breathy intimate male and female duet vocals, close-mic whisper, vinyl warmth',
        lyrics: [
            '[Intro - Warm Fender Rhodes chords, soft rain against the window, upright bass groove at 82 BPM]',
            '[Verse 1 - Kael: Warm, deep baritone vocal, close to the mic]',
            'Neon hums in amber light, wiping down the counter of the night',
            'The clock stopped spinning at eleven-eleven, just a quiet corner on the edge of heaven',
            'You walk in, shaking off the cold, carrying stories that were never told',
            '[Verse 2 - Elara: Silky, breathy female vocal, intimate whisper]',
            "Leave the heavy armor by the door, we don't need the gravity anymore",
            'Two cups of warmth on a wooden table, no more masks, no corporate label',
            'Just the sound of your breathing next to mine, floating in the space between the lines',
            '[Chorus - Elara & Kael: Sensual intertwined duet vocals]',
            'In a velvet booth for two, zero point zero, me and you',
            'Let the static fade into the dark, all we ever needed was a spark',
            'Closer than a shadow on your skin, this is where the real world begins',
            '[Bridge - Mellow electric guitar solo over deep heartbeat bass and Rhodes]',
            '[Outro - Whispered duet, fading warm analog tape]',
            '(Kael:) Stay right here... (Elara:) Nothing left to fear... Zero gravity heart...',
        ].join('\n'),
    },
    // 🎤 głosy artystów wymieniają się co utwór: Stacja 2 = oficjalna persona Elary (My Voices: „ELARA (S.M.T)”)
    2: {
        nr: 2, tytul: 'Closer Than Gravity (Elara Solo)', bpm: 82, artysci: ['Elara'], glos: 'ELARA (S.M.T)', gatunek: 'R&B/Soul', jezyk: 'EN',
        styl: 'sensual neo-soul, atmospheric dream-pop, 82 bpm, silky breathy female vocal, warm Rhodes chords, deep sub-bass pulse, minimal finger snaps, late night intimacy, vinyl warmth',
        lyrics: [
            '[Intro - Soft Rhodes chords, slow heartbeat sub-bass at 82 BPM, breathy female sigh]',
            '[Verse 1]',
            'Raindrops tracing silver lines upon the glass',
            'Watching all the heavy hours slowly pass',
            'Your hand is resting just an inch away from mine',
            'We crossed the border of the ordinary time',
            '[Pre-Chorus]',
            'No need to speak when every shadow knows your name',
            'Two quiet frequencies inside a single flame',
            '[Chorus]',
            'Pull me closer than gravity can hold',
            'In the amber light where nothing’s bought or sold',
            'Every breath is floating at zero point zero G',
            'Just the rhythm of your heart inside of me',
            '[Verse 2]',
            'The city sleeps beneath a blanket made of mist',
            'Every little moment that we almost missed',
            'Now it’s shining in the corner of your eyes',
            'No more distance, no more alibis',
            '[Chorus]',
            'Pull me closer than gravity can hold',
            'In the amber light where nothing’s bought or sold',
            'Every breath is floating at zero point zero G',
            'Just the rhythm of your heart inside of me',
            '[Outro - Intimate close-mic whisper over fading warm chords]',
            'Closer than gravity...',
            'Stay right here with me...',
            'Zero point zero G...',
        ].join('\n'),
    },
    // sztafeta głosów Kael ↔ Elara (Suweren 2026-11-12): 3 Kael, 4 Elara, 5 Kael (outro albumu, w opisie obok Elary)
    3: {
        nr: 3, tytul: 'Amber Light on Your Skin (Kael Solo)', bpm: 84, artysci: ['Kael'], glos: 'KAEL (S.M.T.)', gatunek: 'R&B/Soul', jezyk: 'EN',
        styl: 'sensual neo-soul groove, late night analog lounge, 84 bpm, deep warm baritone male vocal, fretless bass, mellow electric guitar licks, Fender Rhodes piano, brushed drums, vinyl warmth',
        lyrics: [
            '[Intro - Fretless bass groove at 84 BPM, mellow electric guitar lick, warm Rhodes chords]',
            '[Verse 1]',
            'Pour another cup of midnight in your hand',
            'No one left to rush us through this quiet land',
            'Amber light is falling softly on your skin',
            'Tracing every place where the new world begins',
            '[Chorus]',
            "We don't need the noise outside the velvet door",
            'Everything we searched for is right here on the floor',
            'Slow it down to eighty-four, let the night unwind',
            'Leave the weight of yesterday a million miles behind',
            '[Verse 2]',
            'I can hear the static melting in your sigh',
            'Underneath the ceiling of a painted sky',
            'Every single second worth its weight in gold',
            'The sweetest little secret that was never told',
            '[Chorus]',
            "We don't need the noise outside the velvet door",
            'Everything we searched for is right here on the floor',
            'Slow it down to eighty-four, let the night unwind',
            'Leave the weight of yesterday a million miles behind',
            '[Outro - Deep baritone whisper over fading fretless bass and Rhodes]',
            'Amber light on your skin...',
            'Stay right here... zero point zero G...',
        ].join('\n'),
    },
    4: {
        nr: 4, tytul: 'Midnight Espresso (11:11) (Elara Solo)', bpm: 80, artysci: ['Elara'], glos: 'ELARA (S.M.T)', gatunek: 'R&B/Soul', jezyk: 'EN',
        styl: 'cinematic sensual soul, velvet dream-pop, 80 bpm, silky intimate female vocal, lush analog synth pads, warm Fender Rhodes, deep heartbeat bass, late night diner atmosphere',
        lyrics: [
            '[Intro - Lush analog synth pad, soft Rhodes chords at 80 BPM, breathy female vocal]',
            '[Verse 1]',
            'Steam is rising slowly from a porcelain cup',
            'The world outside is spinning, but we gave it up',
            'Eleven-eleven glowing on the diner wall',
            'In this quiet sanctuary we have it all',
            '[Chorus]',
            'Taste of midnight espresso on your lips',
            'Every heavy shadow gently slips',
            'Suspended in the silence, crystalline and free',
            'Nothing left between the stars and you and me',
            '[Verse 2]',
            'Fingers intertwined across the wooden grain',
            'Listening to the rhythm of the silver rain',
            'Every spoken whisper turns from gas to gold',
            'In the warmest story that was ever told',
            '[Chorus]',
            'Taste of midnight espresso on your lips',
            'Every heavy shadow gently slips',
            'Suspended in the silence, crystalline and free',
            'Nothing left between the stars and you and me',
            '[Outro - Silky close-mic whisper]',
            'Eleven-eleven...',
            'Zero gravity heart...',
        ].join('\n'),
    },
    5: {
        nr: 5, tytul: 'Stay Until Dawn (0.00G Outro)', bpm: 76, artysci: ['Kael', 'Elara'], glos: 'KAEL (S.M.T.)', gatunek: 'R&B/Soul', jezyk: 'EN',
        styl: 'intimate acoustic soul outro, 76 bpm, warm baritone male vocal, solo Fender Rhodes and soft fingerpicked acoustic guitar, warm tape saturation, peaceful late-night afterglow',
        lyrics: [
            '[Intro - Solo Fender Rhodes and soft acoustic guitar fingerpicking at 76 BPM]',
            '[Verse 1]',
            'The neon sign is dimming as the sky turns blue',
            'Just an empty street and a booth for two',
            'All the words we needed have already been said',
            'While the morning light is painted overhead',
            '[Chorus]',
            'Stay until the dawn breaks through the window pane',
            'After all the thunder and the quiet rain',
            'In the zero gravity of who we really are',
            'Every single heartbeat is a guiding star',
            '[Outro - Warm baritone whisper fading with final piano chord]',
            'Stay until dawn...',
            'The door is always open...',
            'At StarLight Diner... 0.00G...',
        ].join('\n'),
    },
};

const tn = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Dane wyniku narzędzia MCP: structuredContent albo pierwszy JSON w treści. */
export function daneWyniku(wynik) {
    if (wynik?.structuredContent && typeof wynik.structuredContent === 'object') return wynik.structuredContent;
    for (const c of wynik?.content ?? []) if (c?.type === 'text') { try { const j = JSON.parse(c.text); if (j && typeof j === 'object') return j; } catch { /* zwykły tekst */ } }
    return {};
}
export function tekstWyniku(wynik) { return (wynik?.content ?? []).filter((c) => c?.type === 'text').map((c) => c.text).join('\n').slice(0, 400); }

/** Id klipów z odpowiedzi tworzenia (`clip_ids`, `id`, `clips[].id`). */
export function klipyZWyniku(d) {
    const ids = [...(Array.isArray(d?.clip_ids) ? d.clip_ids : []), ...(Array.isArray(d?.clips) ? d.clips.map((c) => c?.id) : []), d?.id];
    return [...new Set(ids.filter((x) => typeof x === 'string' && x.trim()))];
}

/** Workspace o danej nazwie w dowolnie zagnieżdżonej odpowiedzi `workspaces-list`. */
export function znajdzWorkspace(d, nazwa) {
    const cel = String(nazwa).trim().toLowerCase();
    let hit = null;
    const idz = (o, gl = 0) => {
        if (hit || !o || typeof o !== 'object' || gl > 6) return;
        if (Array.isArray(o)) { o.forEach((x) => idz(x, gl + 1)); return; }
        if (typeof o.id === 'string' && String(o.name ?? '').trim().toLowerCase() === cel) { hit = o.id; return; }
        Object.values(o).forEach((v) => idz(v, gl + 1));
    };
    idz(d);
    return hit;
}

/** Stany klipów z `audio-wait`: [{ id, status, sekundy, odsluch }] (odpowiedź z `clips` albo pojedynczy klip). */
export function stanyKlipow(d) {
    const lista = Array.isArray(d?.clips) && d.clips.length ? d.clips : d?.id ? [d] : [];
    return lista.map((c) => ({
        id: String(c.id ?? ''), status: String(c.status ?? (c.error ? 'error' : '')), tytul: c.title ?? null,
        sekundy: Number(c.metadata?.duration ?? c.duration) > 0 ? Math.round(Number(c.metadata?.duration ?? c.duration)) : null,
        odsluch: typeof c.song_url === 'string' && /^https:\/\//.test(c.song_url) ? c.song_url : null,
        blad: c.error ? tn(typeof c.error === 'string' ? c.error : c.error?.message ?? JSON.stringify(c.error), 200) : null,
    }));
}
export const linkOdsluchu = (id) => `https://suno.com/song/${encodeURIComponent(id)}`;
export const czasUtworu = (s) => (Number(s) > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '?:??');

/** Imię artysty z nazwy persony: „KAEL (S.M.T.)” → „Kael”. */
export function artystaZGlosu(glos) {
    const n = String(glos ?? '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    return n ? n.split(' ').map((w) => (w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w)).join(' ') : '';
}
/** Stacja dopisana z interfejsu (bez numeru — nadaje go `dodajStacje`). Rzuca przy brakach. */
export function oczyscStacje(z = {}) {
    const tytul = tn(z.tytul, 200), styl = tn(z.styl, 900), opis = tn(z.opis, 2800);
    const lyrics = String(z.lyrics ?? z.tekst ?? '').replace(/\r\n/g, '\n').trim().slice(0, 4900);
    const glos = /^(brak|nie|none)$/i.test(tn(z.glos, 80)) ? '' : tn(z.glos, 80);
    if (!tytul) throw new Error('Stacja potrzebuje tytułu.');
    if (!lyrics && !opis && z.instrumental !== true) throw new Error('Stacja potrzebuje tekstu utworu (albo opisu dla trybu prostego Suno).');
    if (z.instrumental === true && !styl && !opis) throw new Error('Utwór instrumentalny potrzebuje stylu albo opisu.');
    let artysci = (Array.isArray(z.artysci) ? z.artysci : String(z.artysci ?? z.artysta ?? '').split(/[,;&]/)).map((a) => tn(a, 60)).filter(Boolean).slice(0, 6);
    if (!artysci.length && glos) artysci = [artystaZGlosu(glos)].filter(Boolean);
    if (!artysci.length) throw new Error('Podaj artystę albo wybierz personę głosową.');
    const bpm = Number(z.bpm) || Number((/(\d{2,3})\s*bpm/i.exec(styl) ?? [])[1]) || null;
    return { tytul, bpm: bpm && bpm >= 40 && bpm <= 240 ? Math.round(bpm) : null, artysci, glos: glos || null, gatunek: tn(z.gatunek, 60) || null, jezyk: tn(z.jezyk, 10).toUpperCase() || null,
        styl, ...(lyrics ? { lyrics } : { opis }), ...(z.instrumental === true ? { instrumental: true } : {}) };
}

/** Persona głosowa z listy `voices-list`: id wprost albo nazwa („Kael” → „KAEL (S.M.T.)”) — porównanie po literach i cyfrach. */
export function dopasujGlos(lista, zadany) {
    const n = (x) => String(x ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
    const cel = n(zadany);
    if (!cel) return null;
    const glosy = (Array.isArray(lista) ? lista : []).filter((g) => g && typeof g.id === 'string');
    const g = glosy.find((x) => x.id === String(zadany).trim()) ?? glosy.find((x) => n(x.name) === cel) ?? glosy.find((x) => n(x.name).startsWith(cel));
    return g ? { id: g.id, nazwa: String(g.name ?? '') } : null;
}

/** Zlecenie → kampania (bez skutków ubocznych). Rzuca przy brakach. */
export function oczyscZlecenie(z = {}) {
    const wzor = typeof z.stacja === 'object' && z.stacja ? z.stacja : STACJE[Number(z.stacja ?? 1)];
    if (!wzor) throw new Error(`Nie znam stacji „${z.stacja}”. Znane: ${Object.keys(STACJE).join(', ')} — albo podaj obiekt { tytul, opis }.`);
    const baza = STACJE[Number(wzor.nr)] ?? {};
    const stacja = {
        nr: Math.max(1, Math.min(99, Number(wzor.nr) || 1)), tytul: tn(wzor.tytul ?? baza.tytul, 200), bpm: Number(wzor.bpm ?? baza.bpm) || null,
        opis: tn(wzor.opis ?? baza.opis, 2800), styl: tn(wzor.styl ?? baza.styl, 900), lyrics: String(wzor.lyrics ?? (wzor.opis ? '' : baza.lyrics) ?? '').trim().slice(0, 4900),
        gatunek: tn(wzor.gatunek ?? baza.gatunek, 60) || null, jezyk: tn(wzor.jezyk ?? baza.jezyk, 10).toUpperCase() || null,
        instrumental: wzor.instrumental === true, sekundy: Number(wzor.sekundy) >= 15 ? Math.min(360, Math.round(Number(wzor.sekundy))) : null,
    };
    if (!stacja.tytul) throw new Error('Stacja bez tytułu.');
    if (!stacja.lyrics && !stacja.opis && !stacja.instrumental) throw new Error('Stacja potrzebuje opisu (tryb prosty) albo tekstu ze stylem (tryb własny).');
    const artysci = (Array.isArray(z.artysci) && z.artysci.length ? z.artysci : wzor.artysci ?? baza.artysci ?? []).map((a) => tn(a, 60)).filter(Boolean).slice(0, 6);
    // 🎤 persona: `glos` = nazwa albo id z My Voices; false / 'brak' = bez persony. Bez pola: jeden artysta → jego głos,
    // duet → BEZ persony (Suno przyjmuje jeden `voice_id` na utwór — zaśpiewałby obie partie; decyzja Suwerena).
    const bezGlosu = z.glos === false || /^(brak|nie|none|false)$/i.test(String(z.glos ?? '').trim());
    // Persona przypisana do stacji (Stacja 2 = „ELARA (S.M.T)”) jest wskazaniem WPROST: brak takiego głosu na koncie = stop przed kredytami.
    const glosStacji = tn(wzor.glos ?? baza.glos, 80);
    const zadany = bezGlosu ? null : tn(z.glos, 80) || glosStacji || (artysci.length === 1 ? artysci[0] : null);
    return {
        album: tn(z.album, 100) || ALBUM, stacja, artysci,
        okladka: z.okladka === false ? null : { prompt: tn(z.okladka?.prompt, 1800) || KLIMAT_OKLADKI },
        glos: zadany ? { zadany, auto: !tn(z.glos, 80) && !glosStacji } : null, zlecil: tn(z.zlecil, 60) || 'Suweren', skad: tn(z.skad, 40) || 'hub',
    };
}

/** Tekst do Spotify / Musixmatch: bez tagów produkcyjnych `[Verse 1 - …]` i etykiet mówców `(Kael:)`; sekcje rozdziela pusta linia. */
export function czystyTekst(lyrics) {
    const out = [];
    for (const surowa of String(lyrics ?? '').split(/\r?\n/)) {
        const sekcja = /^\s*\[[^\]]*\]\s*$/.test(surowa);
        const l = surowa.replace(/\[[^\]]*\]/g, ' ').replace(/\(\s*[^():]{1,40}:\s*\)/g, ' ').replace(/[ \t]+/g, ' ').trim();
        if (l) out.push(l);
        else if ((sekcja || !surowa.trim()) && out.length && out[out.length - 1] !== '') out.push('');
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n');
}
/** Nazwa katalogu/pliku bezpieczna na Windows (bez <>:"/\|?*, bez kropki i spacji na końcu). */
export function nazwaFolderu(s) { return String(s ?? '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120) || 'bez-nazwy'; }
/** Folder wydawniczy kampanii względem katalogu muzyki. */
export function folderWydania(k) { return ['Spotify_Releases', nazwaFolderu(k.album), `${String(k.stacja.nr).padStart(2, '0')}_${nazwaFolderu(k.stacja.tytul)}`].join('/'); }
/** Nagłówek WAV: { hz, bity, kanaly, pcm } — albo null, gdy to nie RIFF/WAVE z blokiem fmt. */
export function naglowekWav(b) {
    if (!Buffer.isBuffer(b) || b.length < 44 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') return null;
    for (let i = 12; i + 8 <= b.length;) {
        const dl = b.readUInt32LE(i + 4);
        if (b.toString('ascii', i, i + 4) === 'fmt ' && i + 24 <= b.length) return { pcm: b.readUInt16LE(i + 8) === 1, kanaly: b.readUInt16LE(i + 10), hz: b.readUInt32LE(i + 12), bity: b.readUInt16LE(i + 22) };
        i += 8 + dl + (dl % 2);
    }
    return null;
}
/** Wymiary JPEG ze znacznika SOF — albo null. */
export function wymiaryJpeg(b) {
    if (!Buffer.isBuffer(b) || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
    for (let i = 2; i + 9 < b.length;) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { wys: b.readUInt16BE(i + 5), szer: b.readUInt16BE(i + 7) };
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
}
/** Metadane wydania dla dystrybutora (pola do przepisania w jego formularzu). `null` = uzupełnia Suweren. */
export function metadaneSpotify(k, { autor = null, sekundy = null, master = null } = {}) {
    const baza = STACJE[k.stacja.nr]?.tytul === k.stacja.tytul ? STACJE[k.stacja.nr] : {};
    return {
        title: k.stacja.tytul, primary_artists: k.artysci, primary_artists_text: k.artysci.join(', '), album: k.album, track_number: k.stacja.nr,
        genre: k.stacja.gatunek ?? baza.gatunek ?? null, language: k.stacja.jezyk ?? baza.jezyk ?? null, bpm: k.stacja.bpm ?? baza.bpm ?? null,
        duration_seconds: sekundy, instrumental: k.stacja.instrumental === true, explicit: null, isrc: null, upc: null, release_date: null,
        credits: { songwriter: autor || 'Suweren', producer: 'TeO Music Studio', label: 'TeO Music Studio' },
        ai_disclosure: { generated_with: 'Suno', clip_id: k.wybrana?.id ?? null, song_url: k.wybrana?.id ? linkOdsluchu(k.wybrana.id) : null, cover_art: 'FLUX (local)' },
        files: { audio: 'master.wav', audio_format: master ? `WAV ${master.hz} Hz / ${master.bity}-bit / ${master.kanaly} ch` : null, original: 'original.mp3', cover: 'cover_3000x3000.jpg', lyrics: 'lyrics_clean.txt' },
        prepared_by: 'Katedra OtakOS — Jason', prepared_at: new Date().toISOString(),
    };
}

/** Argumenty `audio-create` — dwa tryby Suno nie mogą się mieszać (400). */
export function argumentyUtworu(k) {
    const s = k.stacja;
    const a = { title: s.tytul, idempotency_key: k.id };
    if (s.lyrics) Object.assign(a, { lyrics: s.lyrics, ...(s.styl ? { style: s.styl } : {}) });
    else if (s.instrumental && s.styl) Object.assign(a, { style: s.styl });
    else a.description = s.opis;
    if (s.instrumental) a.instrumental = true;
    if (s.sekundy) a.duration = s.sekundy;
    if (k.workspace?.id) a.workspace_id = k.workspace.id;
    if (k.glos?.id) a.voice_id = k.glos.id;
    return a;
}

/**
 * @param {{ katalog: string, suno: { wywolaj: Function, zapiszUtwory: Function }, okladka?: (o: { prompt: string, kampania: object }) => Promise<string|{ sciezka?: string, plik?: string }>,
 *   wiesc?: (tresc: string) => any, decyzja?: (d: object) => any, czekanMax?: number, przerwaMs?: number }} cfg
 */
export function utworzJasona(cfg) {
    const katalog = path.join(cfg.katalog, 'jason', 'kampanie');
    const wRobocie = new Map();          // id → Promise (żywa praca)
    const rysowane = new Map();          // id → Promise (🎨 przerysowanie okładki)
    let kolejka = Promise.resolve();     // jedna kampania naraz (konto Suno, FLUX)
    const wiesc = (t) => { try { Promise.resolve(cfg.wiesc?.(t)).catch(() => {}); } catch { /* kanał opcjonalny */ } };
    const plik = (id) => path.join(katalog, `${id}.json`);
    const ID = /^j-[0-9a-f]{8}$/;

    async function zapisz(k) {
        await fs.mkdir(katalog, { recursive: true });
        k.zmieniono = new Date().toISOString();
        const tmp = `${plik(k.id)}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(k, null, 2));
        await fs.rename(tmp, plik(k.id)).catch(async () => { await fs.copyFile(tmp, plik(k.id)); await fs.rm(tmp, { force: true }); });
        return k;
    }
    async function wczytaj(id) {
        if (!ID.test(String(id))) return null;
        let k; try { k = JSON.parse(await fs.readFile(plik(id), 'utf8')); } catch { return null; }
        if (k.stan === 'robi' && !wRobocie.has(k.id)) {   // 👻 duch po restarcie mostu
            k.stan = 'blad'; k.blad = 'Praca przerwana (restart mostu). ↻ wznowi od miejsca przerwania — utwór nie zostanie stworzony drugi raz.';
            await zapisz(k);
        }
        if (k.okladka?.rysuje && !rysowane.has(k.id)) {   // 👻 rysowanie okładki przerwane restartem
            delete k.okladka.rysuje; k.okladka.blad = 'Rysowanie okładki przerwane (restart mostu) — 🎨 przerysuj jeszcze raz.';
            await zapisz(k);
        }
        return k;
    }
    async function lista() {
        const nazwy = (await fs.readdir(katalog).catch(() => [])).filter((n) => /^j-[0-9a-f]{8}\.json$/.test(n));
        const k = (await Promise.all(nazwy.map((n) => wczytaj(n.slice(0, -5))))).filter(Boolean);
        return k.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }
    const etap = async (k, nazwa, stan, dane = {}) => { k.etapy[nazwa] = { stan, ...dane, kiedy: new Date().toISOString() }; await zapisz(k); };

    // ── ➕ Stacje dopisane z interfejsu (obok wbudowanych STACJE) — `_OtakOs_Wymiar/jason/stacje.json` ──
    const plikStacji = path.join(cfg.katalog, 'jason', 'stacje.json');
    async function stacjeWlasne() { try { const d = JSON.parse(await fs.readFile(plikStacji, 'utf8')); return Array.isArray(d?.stacje) ? d.stacje.filter((x) => x && Number(x.nr) > 0 && x.tytul) : []; } catch { return []; } }
    async function zapiszStacje(l) {
        await fs.mkdir(path.dirname(plikStacji), { recursive: true });
        const tmp = `${plikStacji}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify({ stacje: l }, null, 2));
        await fs.rename(tmp, plikStacji).catch(async () => { await fs.copyFile(tmp, plikStacji); await fs.rm(tmp, { force: true }); });
    }
    /** Wszystkie stacje: wbudowane + własne (`wlasna: true`), po numerze. */
    async function stacje() { return [...Object.values(STACJE), ...(await stacjeWlasne()).map((x) => ({ ...x, wlasna: true }))].sort((a, b) => a.nr - b.nr); }
    let kolejkaStacji = Promise.resolve();
    const poKoleiStacje = (fn) => { const p = kolejkaStacji.then(fn, fn); kolejkaStacji = p.catch(() => {}); return p; };
    const dodajStacje = (z) => poKoleiStacje(async () => {
        const nowa = oczyscStacje(z);
        const wl = await stacjeWlasne(), wszystkie = [...Object.values(STACJE), ...wl];
        if (wszystkie.some((x) => String(x.tytul).toLowerCase() === nowa.tytul.toLowerCase())) throw new Error(`Stacja „${nowa.tytul}” już jest na liście.`);
        const nr = Math.max(...wszystkie.map((x) => Number(x.nr))) + 1;
        if (nr > 99) throw new Error('Album ma już 99 stacji.');
        const stacja = { nr, ...nowa, dodano: new Date().toISOString() };
        await zapiszStacje([...wl, stacja]);
        return { ...stacja, wlasna: true };
    });
    const usunStacje = (nr) => poKoleiStacje(async () => {
        const wl = await stacjeWlasne();
        if (STACJE[Number(nr)]) throw new Error('Stacji wbudowanej w kod nie da się usunąć z interfejsu.');
        if (!wl.some((x) => Number(x.nr) === Number(nr))) throw Object.assign(new Error('Nie ma takiej stacji.'), { kod: 404 });
        await zapiszStacje(wl.filter((x) => Number(x.nr) !== Number(nr)));   // kampanie tej stacji zostają — niosą własną kopię tekstu
        return stacje();
    });

    async function krokWorkspace(k) {
        if (k.workspace?.id || k.etapy.workspace?.stan === 'pominiety') return;
        await etap(k, 'workspace', 'robi');
        try {
            let id = znajdzWorkspace(daneWyniku((await cfg.suno.wywolaj('workspaces-list', {}, { zapisz: false })).wynik), k.album);
            const nowy = !id;
            if (!id) {
                const r = await cfg.suno.wywolaj('workspaces-create', { name: k.album, description: tn(`Album „${k.album}” — ${k.artysci.join(' & ') || 'Katedra OtakOS'}. Kampania Jasona.`, 1900) }, { zapisz: false });
                if (r.wynik?.isError) throw new Error(tekstWyniku(r.wynik) || 'Suno odmówił utworzenia workspace.');
                id = daneWyniku(r.wynik).id ?? znajdzWorkspace(daneWyniku(r.wynik), k.album);
            }
            if (!id) throw new Error('Suno nie oddał id workspace.');
            k.workspace = { id, nazwa: k.album, nowy };
            await etap(k, 'workspace', 'gotowe');
        } catch (e) {   // workspace to porządek w bibliotece Suno, nie warunek utworu
            k.uwagi.push(`Workspace „${k.album}” — nie udało się (${tn(e.message, 200)}); utwór idzie do biblioteki bez niego.`);
            await etap(k, 'workspace', 'pominiety', { powod: tn(e.message, 300) });
        }
    }

    async function listaGlosow() {
        const out = [];
        for (const collection of ['own', 'loved']) {
            const d = daneWyniku((await cfg.suno.wywolaj('voices-list', { collection, limit: 100 }, { zapisz: false })).wynik);
            for (const g of Array.isArray(d.voices) ? d.voices : []) if (g?.id && !out.some((x) => x.id === g.id)) out.push({ id: String(g.id), name: String(g.name ?? ''), kolekcja: collection });
        }
        return out;
    }
    async function krokGlos(k) {
        if (!k.glos?.zadany || k.glos.id || k.klipy?.length) return;
        await etap(k, 'glos', 'robi');
        let g = null, powod = '';
        try { g = dopasujGlos(await listaGlosow(), k.glos.zadany); if (!g) powod = `na koncie Suno nie ma głosu „${k.glos.zadany}” (My Voices)`; }
        catch (e) { powod = tn(e.message, 200); }
        if (g) { Object.assign(k.glos, g); await etap(k, 'glos', 'gotowe', { nazwa: g.nazwa }); return; }
        // wskazany wprost → stop PRZED wydaniem kredytów (utwór obcym głosem to zmarnowane 2 wersje); dobrany sam → dalej bez persony
        if (!k.glos.auto) { await etap(k, 'glos', 'blad', { powod }); throw new Error(`Persona głosowa: ${powod}. Nic nie zostało stworzone.`); }
        k.uwagi.push(`Bez persony głosowej: ${powod}.`); k.glos = null;
        await etap(k, 'glos', 'pominiety', { powod });
    }

    async function krokUtwor(k) {
        if (k.klipy?.length) return;   // 💳 nigdy drugi raz
        await etap(k, 'utwor', 'robi');
        const r = await cfg.suno.wywolaj('audio-create', argumentyUtworu(k), { zapisz: false });
        if (r.wynik?.isError) throw new Error(`Suno audio-create: ${tekstWyniku(r.wynik) || 'błąd bez opisu'}`);
        const ids = klipyZWyniku(daneWyniku(r.wynik));
        if (!ids.length) throw new Error(`Suno nie oddał id utworu. Odpowiedź: ${tekstWyniku(r.wynik) || '(pusta)'}`);
        k.klipy = ids.map((id) => ({ id, status: 'queued', plik: null }));
        await etap(k, 'utwor', 'gotowe', { klipow: ids.length });
    }

    async function krokCzekanie(k) {
        const koniec = (c) => ['complete', 'error'].includes(c.status);
        const pelne = () => k.klipy.every(koniec) && k.klipy.every((c) => c.status === 'error' || c.sekundy);
        if (pelne()) return;
        await etap(k, 'czekanie', 'robi');
        for (let i = 0; i < (cfg.czekanMax ?? 20) && !pelne(); i++) {
            // zapisz: false — z wyniku czekania NIC nie ląduje na dysku (limit pobrań komercyjnych)
            const r = await cfg.suno.wywolaj('audio-wait', { ids: k.klipy.map((c) => c.id), until: 'complete' }, { zapisz: false });
            for (const s of stanyKlipow(daneWyniku(r.wynik))) {
                const c = k.klipy.find((x) => x.id === s.id);
                if (c) Object.assign(c, { status: s.status || c.status, ...(s.tytul ? { tytul: s.tytul } : {}), ...(s.sekundy ? { sekundy: s.sekundy } : {}), ...(s.odsluch ? { odsluch: s.odsluch } : {}), ...(s.blad ? { blad: s.blad } : {}) });
            }
            await zapisz(k);
            if (k.klipy.every(koniec)) break;   // długości może nie być w odpowiedzi — nie kręcimy się po nią w kółko
            if (cfg.przerwaMs) await new Promise((ok) => setTimeout(ok, cfg.przerwaMs));
        }
        for (const c of k.klipy) if (!c.odsluch) c.odsluch = linkOdsluchu(c.id);
        if (!k.klipy.some((c) => c.status === 'complete')) throw new Error(k.klipy.every((c) => c.status === 'error') ? `Suno nie zrobił utworu: ${k.klipy.map((c) => c.blad).filter(Boolean).join(' | ') || 'błąd bez opisu'}` : 'Suno wciąż liczy utwór — ↻ wznowi czekanie (bez nowych kredytów).');
        await etap(k, 'czekanie', 'gotowe');
    }

    /** ⬇ Pobranie JEDNEJ wersji — tylko na decyzję Suwerena. `rate_limited` = chwila przerwy i jeszcze raz (do 3 prób). */
    async function pobierzKlip(k, c) {
        let d = {}, confirm = false;
        for (let i = 0; i < 8; i++) {
            const r = await cfg.suno.wywolaj('audio-download', { id: c.id, format: 'mp3', ...(confirm ? { confirm: true } : {}) }, { zapisz: false });
            d = daneWyniku(r.wynik);
            const tekst = r.wynik?.isError ? tekstWyniku(r.wynik) || 'audio-download: błąd' : '';
            if (/rate_limited/.test(tekst) || d.code === 'rate_limited') {
                if (i >= 3) throw new Error('Suno ogranicza tempo pobrań (rate_limited) — spróbuj za minutę.');
                await new Promise((ok) => setTimeout(ok, cfg.przerwaPobraniaMs ?? Math.max(3000, (Number(d.retry_after_seconds) || 1) * 1500)));
                continue;
            }
            if (tekst) throw new Error(tekst);
            if (d.status === 'requires_credit' && !confirm) { confirm = true; c.kredytPobrania = true; continue; }   // klik Suwerena = zgoda na to jedno pobranie
            if (d.status === 'processing' && !d.url) continue;
            break;
        }
        if (typeof d.url !== 'string' || !/^https:\/\//.test(d.url)) throw new Error(`Suno nie oddał adresu pliku (${tn(d.status ?? d.reason ?? 'brak', 80)})`);
        const [u] = await cfg.suno.zapiszUtwory(null, [{ id: c.id, tytul: c.tytul ?? k.stacja.tytul, adres: d.url }]);
        if (!u?.plik) throw new Error(u?.blad ?? 'zapis się nie udał');
        c.plik = u.plik; delete c.bladPobrania;
        return u.plik;
    }

    async function krokOkladka(k) {
        if (!k.okladka || k.okladka.plik) return;
        if (!cfg.okladka) { k.okladka.blad = 'Katedra nie ma podłączonej Palety (FLUX).'; await etap(k, 'okladka', 'pominiety', { powod: k.okladka.blad }); return; }
        await etap(k, 'okladka', 'robi');
        try {
            const w = await cfg.okladka({ prompt: k.okladka.prompt, kampania: k });
            const zrodlo = typeof w === 'string' ? w : w?.sciezka ?? w?.plik;
            if (!zrodlo) throw new Error('Paleta nie oddała pliku.');
            const cel = path.join(katalog, k.id, `okladka${path.extname(zrodlo) || '.png'}`);
            await fs.mkdir(path.dirname(cel), { recursive: true });
            await fs.copyFile(zrodlo, cel);
            k.okladka.plik = path.basename(cel); delete k.okladka.blad;
            await etap(k, 'okladka', 'gotowe');
        } catch (e) {   // pakiet bez okładki jest uczciwszy niż brak pakietu — mówimy to wprost
            k.okladka.blad = tn(e.message, 300);
            await etap(k, 'okladka', 'blad', { powod: k.okladka.blad });
        }
    }

    async function prowadz(id) {
        const k = await wczytaj(id);
        if (!k) return;
        k.stan = 'robi'; delete k.blad; await zapisz(k);
        try {
            await krokWorkspace(k); await krokGlos(k); await krokUtwor(k); await krokCzekanie(k); await krokOkladka(k);
            k.stan = 'do_akceptacji'; k.gotowe = new Date().toISOString();
            await etap(k, 'pakiet', 'gotowe');
            wiesc(`🎛️ Jason: „${k.stacja.tytul}” — ${k.klipy.filter((c) => c.status === 'complete').length} wersje do odsłuchu w Izbie Akceptacji${k.okladka?.blad ? ' (bez okładki)' : ''}. Nic nie pobrano — wybierz jedną.`);
        } catch (e) {
            k.stan = 'blad'; k.blad = tn(e.message, 500); await zapisz(k);
            wiesc(`🎛️ Jason: kampania „${k.stacja.tytul}” stanęła — ${tn(e.message, 160)}`);
        }
    }
    function rusz(id) {
        const p = (kolejka = kolejka.then(() => prowadz(id)).catch(() => {})).finally(() => wRobocie.delete(id));
        wRobocie.set(id, p);
        return p;
    }

    /** Nowa kampania — wraca od razu, praca idzie w tle. Ta sama stacja albumu w toku / do ✓ = odmowa (kredyty). */
    async function wykonaj(zlecenie) {
        // numer spoza wbudowanych = stacja dopisana z interfejsu
        const numer = zlecenie && typeof zlecenie.stacja !== 'object' ? Number(zlecenie.stacja ?? 1) : null;
        if (numer && !STACJE[numer]) { const wl = (await stacjeWlasne()).find((x) => Number(x.nr) === numer); if (wl) zlecenie = { ...zlecenie, stacja: wl }; }
        const z = oczyscZlecenie(zlecenie);
        const otwarta = (await lista()).find((k) => k.album === z.album && k.stacja.tytul === z.stacja.tytul && ['robi', 'do_akceptacji', 'blad'].includes(k.stan));
        if (otwarta && zlecenie?.nowa !== true) throw Object.assign(new Error(`Kampania „${z.stacja.tytul}” już jest (${otwarta.stan}) — ${otwarta.stan === 'blad' ? 'wznów ją (↻)' : otwarta.stan === 'robi' ? 'poczekaj, aż skończy' : 'rozstrzygnij ją w Izbie'} albo wyślij nowa: true.`), { kod: 'JUZ_JEST', kampania: otwarta });
        const k = { id: `j-${crypto.randomBytes(4).toString('hex')}`, ...z, stan: 'robi', etapy: {}, klipy: [], uwagi: [], workspace: null, utworzono: new Date().toISOString() };
        wRobocie.set(k.id, Promise.resolve());   // przed zapisem „robi” — odczyt nie weźmie jej za ducha
        await zapisz(k);
        rusz(k.id);
        return k;
    }
    async function ponow(id, { okladka = false } = {}) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        if (wRobocie.has(k.id)) throw new Error('Ta kampania właśnie pracuje.');
        if (['przyjeta', 'odrzucona'].includes(k.stan)) throw new Error(`Kampania jest już ${k.stan}.`);
        if (okladka && k.okladka) { delete k.okladka.plik; delete k.okladka.blad; }
        delete k.etapy.pobranie; delete k.kredytPobrania;
        for (const c of k.klipy ?? []) { delete c.bladPobrania; if (!c.plik) delete c.kredytPobrania; }
        k.stan = 'robi';
        wRobocie.set(k.id, Promise.resolve());
        await zapisz(k);
        rusz(k.id);
        return k;
    }
    const pobierane = new Set();
    /** ✓ = pobranie WSKAZANEJ wersji (`pobierz-N` albo `przyjmij` + `wersja`: numer od 1 lub id klipu); ✕ = odrzucenie bez pobierania. */
    async function rozstrzygnij(id, akcja, { powod = '', kto = null, wersja = null } = {}) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        if (k.stan !== 'do_akceptacji') throw new Error(`Kampania nie czeka na decyzję (stan: ${k.stan}).`);
        const m = /^pobierz-(\d{1,2})$/.exec(String(akcja));
        if (!m && !['przyjmij', 'odrzuc'].includes(akcja)) throw new Error(`Nie znam akcji „${akcja}”.`);
        let wybrana = null;
        if (akcja !== 'odrzuc') {
            const gotowe = k.klipy.filter((c) => c.status === 'complete');
            const w = m ? Number(m[1]) : wersja;
            wybrana = w == null || w === '' ? (gotowe.length === 1 ? gotowe[0] : null) : /^\d{1,2}$/.test(String(w)) ? k.klipy[Number(w) - 1] : k.klipy.find((c) => c.id === String(w));
            if (!wybrana || wybrana.status !== 'complete') throw new Error(`Wskaż wersję do pobrania (1–${k.klipy.length}) — pobieram tylko jedną, każda schodzi z miesięcznego limitu pobrań Suno.`);
            if (!wybrana.plik) {
                if (pobierane.has(k.id)) throw new Error('Ta kampania właśnie pobiera wersję — poczekaj chwilę.');
                pobierane.add(k.id);
                try { await pobierzKlip(k, wybrana); }
                catch (e) { wybrana.bladPobrania = tn(e.message, 300); await zapisz(k); throw new Error(`Nie pobrano wersji ${k.klipy.indexOf(wybrana) + 1}: ${wybrana.bladPobrania} Kampania dalej czeka w Izbie.`); }
                finally { pobierane.delete(k.id); }
            }
            k.wybrana = { id: wybrana.id, wersja: k.klipy.indexOf(wybrana) + 1, plik: wybrana.plik };
        }
        k.stan = akcja === 'odrzuc' ? 'odrzucona' : 'przyjeta';
        k.decyzja = { werdykt: akcja === 'odrzuc' ? 'odrzuc' : 'przyjmij', powod: tn(powod, 300), kto: kto ?? 'Suweren', kiedy: new Date().toISOString() };
        await zapisz(k);
        try { cfg.decyzja?.({ zrodlo: 'jason', obiekt: k.id, tytul: `${k.album} · ${k.stacja.tytul}`, werdykt: k.decyzja.werdykt, opis: [k.wybrana ? `wersja ${k.wybrana.wersja}` : '', k.decyzja.powod].filter(Boolean).join(' · ') }); } catch { /* JaJo opcjonalne */ }
        wiesc(k.wybrana
            ? `🎛️ Jason: „${k.stacja.tytul}” — ✓ wersja ${k.wybrana.wersja} pobrana do _OtakOs_Muzyka/${k.wybrana.plik}.`
            : `🎛️ Jason: „${k.stacja.tytul}” — ✕ odrzucone${k.decyzja.powod ? ` (${k.decyzja.powod})` : ''}. Nic nie pobrano; wersje zostają w Suno.`);
        return k;
    }
    // ── 🚀 Paczka wydawnicza pod dystrybucję na Spotify ──
    const plikUstawien = path.join(cfg.katalog, 'jason', 'ustawienia.json');
    async function ustawienia() {
        let wlasny = null;
        try { const u = JSON.parse(await fs.readFile(plikUstawien, 'utf8')); if (typeof u?.dystrybutor === 'string' && u.dystrybutor) wlasny = u.dystrybutor; } catch { /* brak pliku = domyślny */ }
        return { dystrybutor: wlasny ?? DYSTRYBUTOR_DOMYSLNY, domyslny: !wlasny };
    }
    async function ustawDystrybutora(adres) {
        const a = String(adres ?? '').trim();
        if (a && !/^https:\/\/[^\s]{4,300}$/.test(a)) throw new Error('Adres panelu dystrybutora musi zaczynać się od https://');
        await fs.mkdir(path.dirname(plikUstawien), { recursive: true });
        await fs.writeFile(plikUstawien, JSON.stringify({ dystrybutor: a || null }, null, 2));
        return ustawienia();
    }
    const sciezkaWydania = (k) => (k?.spotify?.folder && cfg.katalogMuzyki ? path.join(cfg.katalogMuzyki, ...k.spotify.folder.split('/')) : null);

    /** Bezstratny WAV z Suno dla JUŻ odblokowanej wersji — bez `confirm`: jeśli Suno chce za niego kolejne pobranie, rezygnujemy. Zwraca powód porażki albo null. */
    async function wavZSuno(k, cel) {
        if (!cfg.pobierz) return 'most nie ma czym pobrać pliku';
        for (let i = 0; i < 8; i++) {
            const r = await cfg.suno.wywolaj('audio-download', { id: k.wybrana.id, format: 'wav' }, { zapisz: false });
            if (r.wynik?.isError) return tn(tekstWyniku(r.wynik) || 'audio-download: błąd', 200);
            const d = daneWyniku(r.wynik);
            if (d.status === 'requires_credit') return 'Suno policzyłoby WAV jako kolejne pobranie z limitu';
            if (typeof d.url === 'string' && /^https:\/\//.test(d.url)) {
                const dane = await cfg.pobierz(d.url);
                if (!naglowekWav(dane)) return 'Suno oddało plik, który nie jest WAV';
                await fs.writeFile(cel, dane);
                return null;
            }
            if (d.status !== 'processing') return `Suno nie oddało adresu WAV (${tn(d.status ?? d.reason ?? 'brak', 60)})`;
            await new Promise((ok) => setTimeout(ok, cfg.przerwaPobraniaMs ?? 4000));
        }
        return 'Suno wciąż przygotowuje WAV';
    }

    const UWAGA_COVER = 'Okładka: obraz FLUX powiększony do 3000×3000 (Lanczos, JPEG najwyższej jakości) — powiększenie nie dodaje szczegółów, których nie było w oryginale.';
    const UWAGA_BEZ_COVER = 'Bez okładki — kampania jej nie ma (Paleta nie narysowała). Dystrybutor wymaga okładki 3000×3000.';
    /** cover_3000x3000.jpg z okładki kampanii (przycięcie do kwadratu, Lanczos) — null, gdy kampania nie ma okładki. */
    async function coverWydania(k, kat) {
        const zOkladki = sciezkaOkladki(k);
        if (!zOkladki || !(await fs.access(zOkladki).then(() => true, () => false))) return null;
        const cel = path.join(kat, 'cover_3000x3000.jpg'), rob = path.join(kat, '.cover-nowy.jpg');
        await cfg.uruchom(cfg.ffmpeg, ['-loglevel', 'error', '-y', '-i', zOkladki, '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=3000:3000:flags=lanczos", '-frames:v', '1', '-q:v', '1', '-pix_fmt', 'yuvj444p', rob], { maxBuffer: 1 << 24, timeout: 10 * 60_000, windowsHide: true });
        const w = wymiaryJpeg(await fs.readFile(rob));
        if (w?.szer !== 3000 || w?.wys !== 3000) { await fs.rm(rob, { force: true }); throw new Error(`Okładka nie wyszła 3000×3000 (${JSON.stringify(w)}).`); }
        await fs.rm(cel, { force: true }); await fs.rename(rob, cel);   // stara okładka paczki zostaje do udanej zamiany
        return { plik: 'cover_3000x3000.jpg', szer: 3000, wys: 3000 };
    }

    /**
     * 🎨 Przerysowanie okładki — także dla PRZYJĘTEJ kampanii (FLUX potrafi dorysować bełkotliwy szyld mimo zakazu).
     * Wraca od razu, rysuje w tle (`okladka.rysuje`); stara okładka zostaje do udanej zamiany (kopia `okladka-poprzednia.*`).
     * Kampania z paczką Spotify dostaje od razu nowy `cover_3000x3000.jpg` i poprawione metadane.
     */
    async function przerysujOkladke(id, { prompt = '' } = {}) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        if (!cfg.okladka) throw new Error('Katedra nie ma podłączonej Palety (FLUX).');
        if (k.stan === 'odrzucona') throw new Error('Kampania jest odrzucona.');
        if (k.stan === 'robi' || wRobocie.has(k.id)) throw new Error('Ta kampania właśnie pracuje — okładkę przerysujesz, gdy skończy.');
        if (rysowane.has(k.id)) throw new Error('Okładka tej kampanii właśnie się rysuje.');
        if (budowane.has(k.id)) throw new Error('Paczka Spotify właśnie się składa — poczekaj chwilę.');
        k.okladka = { ...(k.okladka ?? {}), prompt: tn(prompt, 1800) || KLIMAT_OKLADKI, rysuje: true };
        delete k.okladka.blad;
        rysowane.set(k.id, Promise.resolve());   // przed zapisem „rysuje” — odczyt nie weźmie jej za ducha
        await zapisz(k);
        const praca = (kolejka = kolejka.then(() => rysujOkladke(k.id, k.okladka.prompt)).catch(() => {})).finally(() => rysowane.delete(k.id));
        rysowane.set(k.id, praca);
        return k;
    }
    async function rysujOkladke(id, prompt) {
        const k = await wczytaj(id);
        if (!k) return;
        k.okladka = { ...(k.okladka ?? {}), prompt, rysuje: true };   // praca mogła ruszyć, zanim zapis prośby doszedł na dysk
        try {
            const w = await cfg.okladka({ prompt: k.okladka.prompt, kampania: k });
            const zrodlo = typeof w === 'string' ? w : w?.sciezka ?? w?.plik;
            if (!zrodlo) throw new Error('Paleta nie oddała pliku.');
            const kat = path.join(katalog, k.id);
            await fs.mkdir(kat, { recursive: true });
            const stara = sciezkaOkladki(k);
            if (stara && await fs.access(stara).then(() => true, () => false)) await fs.copyFile(stara, path.join(kat, `okladka-poprzednia${path.extname(stara)}`));
            const cel = path.join(kat, `okladka${path.extname(zrodlo) || '.png'}`);
            await fs.copyFile(zrodlo, cel);
            if (stara && stara !== cel) await fs.rm(stara, { force: true });
            k.okladka.plik = path.basename(cel); k.okladka.wersja = (Number(k.okladka.wersja) || 1) + 1; delete k.okladka.blad;
            const katWydania = sciezkaWydania(k);
            if (k.spotify && katWydania && cfg.ffmpeg && cfg.uruchom) {   // 🚀 paczka Spotify dostaje nową okładkę od razu
                k.spotify.okladka = await coverWydania(k, katWydania);
                if (!k.spotify.pliki.includes('cover_3000x3000.jpg')) k.spotify.pliki.splice(Math.max(0, k.spotify.pliki.indexOf('master.wav') + 1), 0, 'cover_3000x3000.jpg');
                k.spotify.uwagi = [UWAGA_COVER, ...k.spotify.uwagi.filter((u) => u !== UWAGA_COVER && u !== UWAGA_BEZ_COVER)];
                k.spotify.okladkaZmieniona = new Date().toISOString();
                const pm = path.join(katWydania, 'spotify_metadata.json');
                try { const m = JSON.parse(await fs.readFile(pm, 'utf8')); m.files = { ...(m.files ?? {}), cover: 'cover_3000x3000.jpg' }; await fs.writeFile(pm, JSON.stringify(m, null, 2), 'utf8'); } catch { /* metadane odtworzy „↻ złóż od nowa” */ }
            }
            delete k.okladka.rysuje;
            await zapisz(k);
            wiesc(`🎨 Jason: nowa okładka „${k.stacja.tytul}”${k.spotify ? ' — podmieniona też w paczce Spotify (cover_3000x3000.jpg)' : ''}. Obejrzyj ją, zanim wyślesz do dystrybutora.`);
        } catch (e) {
            delete k.okladka.rysuje; k.okladka.blad = tn(e.message, 300);
            await zapisz(k);
            wiesc(`🎨 Jason: okładka „${k.stacja.tytul}” nie wyszła (${k.okladka.blad}). Poprzednia zostaje.`);
        }
    }

    const budowane = new Set();
    async function przygotujSpotify(id) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        if (k.stan !== 'przyjeta' || !k.wybrana?.plik) throw new Error('Paczkę Spotify składam po ✓ i pobraniu wersji — ta kampania nie ma jeszcze pobranego utworu.');
        if (!cfg.katalogMuzyki || !cfg.ffmpeg || !cfg.uruchom) throw new Error('Most nie ma podłączonego ffmpeg ani katalogu muzyki dla Jasona.');
        if (budowane.has(k.id)) throw new Error('Ta paczka właśnie się składa.');
        if (rysowane.has(k.id)) throw new Error('Okładka właśnie się rysuje — złóż paczkę, gdy będzie gotowa.');
        const mp3 = path.join(cfg.katalogMuzyki, ...k.wybrana.plik.split('/'));
        await fs.access(mp3).catch(() => { throw new Error(`Nie ma pobranego pliku: _OtakOs_Muzyka/${k.wybrana.plik}`); });
        budowane.add(k.id);
        try {
            const folder = folderWydania(k), kat = path.join(cfg.katalogMuzyki, ...folder.split('/'));
            const uwagi = [], pliki = [];
            const ff = (args) => cfg.uruchom(cfg.ffmpeg, ['-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 24, timeout: 10 * 60_000, windowsHide: true });
            await fs.mkdir(kat, { recursive: true });
            await fs.copyFile(mp3, path.join(kat, 'original.mp3')); pliki.push('original.mp3');

            // master.wav — 44,1 kHz / 16 bit / stereo
            const surowy = path.join(kat, '.suno.wav'), master = path.join(kat, 'master.wav');
            let zrodlo = 'wav-suno';
            const czemuNie = await wavZSuno(k, surowy).catch((e) => tn(e.message, 200));
            if (czemuNie) { zrodlo = 'mp3'; uwagi.push(`master.wav powstał z pobranego MP3 (${czemuNie}) — kontener WAV, jakość dźwięku jak MP3. Bezstratny WAV pobierzesz w Suno (Download → WAV) i podmienisz plik.`); }
            await ff(['-i', zrodlo === 'mp3' ? mp3 : surowy, '-vn', '-map_metadata', '-1', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', master]);
            await fs.rm(surowy, { force: true });
            const fd = await fs.open(master, 'r'); const glowa = Buffer.alloc(4096); await fd.read(glowa, 0, 4096, 0); await fd.close();
            const h = naglowekWav(glowa);
            if (!h || !h.pcm || h.hz !== 44100 || h.bity !== 16 || h.kanaly !== 2) throw new Error(`master.wav nie ma formatu 44,1 kHz / 16 bit / stereo (${JSON.stringify(h)}).`);
            const bajtow = (await fs.stat(master)).size;
            const sekundy = Math.round((bajtow - 44) / (44100 * 4) * 10) / 10;
            pliki.push('master.wav');

            // cover_3000x3000.jpg
            const okladka = await coverWydania(k, kat);
            if (okladka) { pliki.push(okladka.plik); uwagi.push(UWAGA_COVER); }
            else uwagi.push(UWAGA_BEZ_COVER);

            // lyrics_clean.txt
            const tekst = czystyTekst(k.stacja.lyrics);
            if (tekst) { await fs.writeFile(path.join(kat, 'lyrics_clean.txt'), `${tekst}\n`, 'utf8'); pliki.push('lyrics_clean.txt'); }
            else uwagi.push(k.stacja.instrumental ? 'Utwór instrumentalny — bez pliku z tekstem.' : 'Bez lyrics_clean.txt — utwór powstał z opisu, tekst napisało Suno (skopiuj go ze strony utworu).');

            // spotify_metadata.json
            const autor = await Promise.resolve(cfg.autor?.()).catch(() => null);
            const meta = metadaneSpotify(k, { autor: typeof autor === 'string' ? autor : null, sekundy, master: h });
            if (!okladka) meta.files.cover = null;
            if (!tekst) meta.files.lyrics = null;
            await fs.writeFile(path.join(kat, 'spotify_metadata.json'), JSON.stringify(meta, null, 2), 'utf8'); pliki.push('spotify_metadata.json');
            uwagi.push('Do uzupełnienia u dystrybutora: data wydania, explicit, ISRC/UPC (nadaje dystrybutor), nazwisko autora do tantiem oraz oświadczenie o muzyce stworzonej z AI.');

            k.spotify = { folder, pliki, master: { ...h, zrodlo, sekundy, bajtow }, okladka, uwagi, kiedy: new Date().toISOString() };
            delete k.spotifyPominiete;
            await zapisz(k);
            wiesc(`🚀 Jason: paczka Spotify „${k.stacja.tytul}” gotowa — _OtakOs_Muzyka/${folder} (${pliki.length} plików). Wgrywasz ją w panelu dystrybutora.`);
            return k;
        } finally { budowane.delete(k.id); }
    }
    async function pominSpotify(id) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        k.spotifyPominiete = true;
        return zapisz(k);
    }
    async function otworzFolder(id) {
        const p = sciezkaWydania(await wczytaj(id));
        if (!p) throw new Error('Ta kampania nie ma jeszcze paczki Spotify.');
        if (!cfg.otworz) throw new Error('Most nie umie otworzyć folderu na tej maszynie.');
        await fs.access(p).catch(() => { throw new Error('Folder paczki zniknął z dysku — złóż paczkę ponownie.'); });
        await cfg.otworz(p);
        return p;
    }
    const sciezkaOkladki = (k) => (k?.okladka?.plik ? path.join(katalog, k.id, k.okladka.plik) : null);

    /** 📥 Źródło Izby zgód — odczyt bez skutków ubocznych. */
    const zrodloIzby = {
        id: 'jason', emoji: '🎛️', nazwa: 'Jason — kampanie',
        czekajace: async () => (await lista()).filter((k) => k.stan === 'do_akceptacji' || (k.stan === 'przyjeta' && k.wybrana?.plik && !k.spotify && !k.spotifyPominiete)).map((k) => (k.stan === 'przyjeta' ? {
            id: k.id, kiedy: k.decyzja?.kiedy ?? k.utworzono,
            tytul: `${k.album} · Stacja ${k.stacja.nr}: ${k.stacja.tytul} — do wydania`,
            opis: `${k.okladka?.rysuje ? '🎨 Okładka właśnie się rysuje. ' : k.okladka?.blad ? `⚠ Okładka: ${k.okladka.blad} ` : ''}Wersja ${k.wybrana.wersja} pobrana (_OtakOs_Muzyka/${k.wybrana.plik}). Jason złoży paczkę wydawniczą: master.wav 44,1 kHz/16 bit, okładka 3000×3000, czysty tekst, metadane. Nic nie kosztuje i nic nie wychodzi z Katedry — do Spotify wgrywasz ją sam w panelu dystrybutora.`,
            obrazy: sciezkaOkladki(k) ? [sciezkaOkladki(k)] : [],
            // 🎨 = FLUX na karcie Katedry → tylko przy maszynie (jak inne decyzje z GPU); zlecana bez czekania
            akcje: [{ id: 'spotify', etykieta: '🚀 Przygotuj i wyślij na Spotify', zdalnie: true }, ...(cfg.okladka && !k.okladka?.rysuje ? [{ id: 'okladka', etykieta: '🎨 Przerysuj okładkę', zdalnie: false }] : []), { id: 'bez-spotify', etykieta: '✕ Bez paczki Spotify', zdalnie: true }],
        } : {
            id: k.id, kiedy: k.gotowe ?? k.utworzono,
            tytul: `${k.album} · Stacja ${k.stacja.nr}: ${k.stacja.tytul}`,
            opis: [`${k.artysci.join(' & ') || 'Suno'}${k.glos?.nazwa ? ` · głos: ${k.glos.nazwa}` : ''}. NIC nie pobrano — odsłuchaj w Suno i pobierz jedną:`,
                ...k.klipy.map((c, i) => (c.status === 'complete' ? `Wersja ${i + 1} (${czasUtworu(c.sekundy)}): ${c.odsluch ?? linkOdsluchu(c.id)}` : `Wersja ${i + 1}: błąd Suno`)),
                k.okladka?.plik ? 'Okładka: Paleta (FLUX).' : k.okladka ? `Bez okładki: ${k.okladka.blad ?? 'pominięta'}.` : '', ...k.uwagi].filter(Boolean).join(' '),
            obrazy: sciezkaOkladki(k) ? [sciezkaOkladki(k)] : [],
            akcje: [...k.klipy.map((c, i) => (c.status === 'complete' ? { id: `pobierz-${i + 1}`, etykieta: `✓ Pobierz wersję ${i + 1} (${czasUtworu(c.sekundy)})`, zdalnie: true, potwierdz: 'Pobranie zużyje 1 z miesięcznych pobrań Suno z prawami komercyjnymi. Pobrać tę wersję?' } : null)).filter(Boolean),
                { id: 'odrzuc', etykieta: '✕ Odrzuć (bez pobierania)', zdalnie: true }],
        })),
        decyduj: (id, akcja, { powod } = {}) => (akcja === 'okladka' ? przerysujOkladke(id) : akcja === 'spotify' ? przygotujSpotify(id) : akcja === 'bez-spotify' ? pominSpotify(id) : rozstrzygnij(id, akcja, { powod })),
    };

    return { wykonaj, ponow, rozstrzygnij, przerysujOkladke, _czekajOkladki: (id) => rysowane.get(id) ?? Promise.resolve(), przygotujSpotify, pominSpotify, otworzFolder, stacje, dodajStacje, usunStacje, sciezkaWydania, ustawienia, ustawDystrybutora, lista, kampania: wczytaj, glosy: listaGlosow, sciezkaOkladki, zrodloIzby, _czekaj: (id) => wRobocie.get(id) ?? Promise.resolve() };
}

/** Trasy. `dostep(req, res)` = maszyna albo sparowany telefon (Stół Narad w StoL); Straż wpuszcza z telefonu tylko start i odczyt. */
export function zamontujTrasyJasona(app, J, { dostep = async () => ({ urzadzenie: null }) } = {}) {
    const blad = (res, e) => res.status(e.kod === 404 ? 404 : e.kod === 'JUZ_JEST' ? 409 : 400).json({ success: false, message: e.message, kod: e.kod ?? null, ...(e.kampania ? { kampania: e.kampania } : {}) });
    app.post('/api/jason/wykonaj-kampanie', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        try { res.json({ success: true, kampania: await J.wykonaj({ ...(req.body ?? {}), zlecil: d.urzadzenie ?? req.body?.zlecil, skad: d.urzadzenie ? 'telefon' : req.body?.skad }) }); } catch (e) { blad(res, e); }
    });
    app.get('/api/jason/kampanie', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        res.json({ success: true, kampanie: await J.lista(), stacje: (await J.stacje()).map(({ nr, tytul, bpm, artysci, glos, wlasna }) => ({ nr, tytul, bpm: bpm ?? null, artysci, glos: glos ?? null, wlasna: wlasna === true })) });
    });
    app.get('/api/jason/kampanie/:id', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        const k = await J.kampania(req.params.id);
        return k ? res.json({ success: true, kampania: k }) : res.status(404).json({ success: false, message: 'Nie ma takiej kampanii.' });
    });
    app.get('/api/jason/kampanie/:id/okladka', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        const p = J.sciezkaOkladki(await J.kampania(req.params.id));
        return p ? res.sendFile(p) : res.status(404).json({ success: false, message: 'Ta kampania nie ma okładki.' });
    });
    app.post('/api/jason/kampanie/:id/ponow', async (req, res) => { try { res.json({ success: true, kampania: await J.ponow(req.params.id, { okladka: req.body?.okladka === true }) }); } catch (e) { blad(res, e); } });
    // ✓ przyjmij / pobierz {wersja: 1|2|id klipu} = pobranie tej JEDNEJ wersji; odrzuc = bez pobierania
    for (const [trasa, akcja] of [['przyjmij', 'przyjmij'], ['pobierz', 'przyjmij'], ['odrzuc', 'odrzuc']]) {
        app.post(`/api/jason/kampanie/:id/${trasa}`, async (req, res) => { try { res.json({ success: true, kampania: await J.rozstrzygnij(req.params.id, akcja, { powod: req.body?.powod, wersja: req.body?.wersja ?? null }) }); } catch (e) { blad(res, e); } });
    }
    // 🎨 nowa okładka (FLUX w tle) — też dla przyjętej kampanii; paczka Spotify dostaje ją od razu. {prompt?} = własny opis
    app.post('/api/jason/kampanie/:id/przerysuj-okladke', async (req, res) => { try { res.json({ success: true, kampania: await J.przerysujOkladke(req.params.id, { prompt: req.body?.prompt }) }); } catch (e) { blad(res, e); } });
    // 🚀 paczka wydawnicza pod Spotify (tylko maszyna — Straż): master.wav, okładka 3000×3000, czysty tekst, metadane
    app.post('/api/jason/kampanie/:id/przygotuj-spotify', async (req, res) => { try { res.json({ success: true, kampania: await J.przygotujSpotify(req.params.id), ustawienia: await J.ustawienia() }); } catch (e) { blad(res, e); } });
    app.post('/api/jason/kampanie/:id/otworz-folder', async (req, res) => { try { res.json({ success: true, folder: await J.otworzFolder(req.params.id) }); } catch (e) { blad(res, e); } });
    app.get('/api/jason/kampanie/:id/spotify/okladka', async (req, res) => {
        const k = await J.kampania(req.params.id), p = J.sciezkaWydania(k);
        return p && k.spotify?.okladka ? res.sendFile(path.join(p, k.spotify.okladka.plik)) : res.status(404).json({ success: false, message: 'Ta paczka nie ma okładki.' });
    });
    // 📋 czysty tekst do wklejenia u dystrybutora: plik z paczki, a bez paczki — tekst stacji bez tagów
    app.get('/api/jason/kampanie/:id/tekst', async (req, res) => {
        const k = await J.kampania(req.params.id);
        if (!k) return res.status(404).json({ success: false, message: 'Nie ma takiej kampanii.' });
        const p = J.sciezkaWydania(k);
        const zPaczki = p && k.spotify?.pliki?.includes('lyrics_clean.txt') ? await fs.readFile(path.join(p, 'lyrics_clean.txt'), 'utf8').catch(() => null) : null;
        const tekst = (zPaczki ?? czystyTekst(k.stacja.lyrics)).trim();
        return tekst ? res.json({ success: true, tekst, tytul: k.stacja.tytul }) : res.status(404).json({ success: false, message: 'Ta kampania nie ma tekstu (utwór z opisu albo instrumentalny).' });
    });
    app.get('/api/jason/ustawienia', async (_req, res) => res.json({ success: true, ustawienia: await J.ustawienia() }));
    app.put('/api/jason/ustawienia', async (req, res) => { try { res.json({ success: true, ustawienia: await J.ustawDystrybutora(req.body?.dystrybutor) }); } catch (e) { blad(res, e); } });
    // 🎤 persony głosowe konta Suno (My Voices + ulubione) — do wyboru w Hubie i Music Studio
    // ➕ nowa stacja z interfejsu (nic nie kosztuje — to tylko wpis na liście); maszyna albo sparowany telefon
    app.get('/api/jason/stacje', async (req, res) => { const d = await dostep(req, res); if (!d) return; res.json({ success: true, stacje: await J.stacje() }); });
    app.post('/api/jason/stacje', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        try { res.json({ success: true, stacja: await J.dodajStacje(req.body ?? {}), stacje: await J.stacje() }); } catch (e) { blad(res, e); }
    });
    app.delete('/api/jason/stacje/:nr', async (req, res) => { try { res.json({ success: true, stacje: await J.usunStacje(req.params.nr) }); } catch (e) { blad(res, e); } });
    app.get('/api/jason/glosy', async (req, res) => { const d = await dostep(req, res); if (!d) return; try { res.json({ success: true, glosy: await J.glosy() }); } catch (e) { res.status(e.kod === 'NIEPOLACZONE' ? 409 : 502).json({ success: false, message: e.message }); } });
}
