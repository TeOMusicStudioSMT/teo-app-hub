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
 * 🎬 TELEDYSK (Suweren 2026-11-13): `teoStory(id)` = storyboard 0.00G (`storyboard_000g.json` w paczce, 10–14 ujęć z tekstu —
 * services/StoryboardTeledysku.js, bez modelu) + projekt w TeO Story Studio (`cfg.story.zaloz`: projekt Reżysera, fakty,
 * odcinek, `teledysk.json` z master.wav, karty KADR na Tablicy). `kadrSceny` rysuje klatki Paletą (FLUX) BEZ okładki jako
 * wzoru — okładka narzucała każdej klatce swoją kompozycję (pierwsze klatki wyszły jak pięć kopii okładki).
 *
 * 🎞️ OPODYSK (Opowieść + Teledysk): `opodysk(id, {napisy})` dorysowuje brakujące klatki 16:9 i składa ffmpegiem film na
 * długość utworu (services/Opodysk.js: Ken Burns, xfade, napis opowieści, master.wav → AAC 320k, H.264 1080p) →
 * `opodysk_youtube_16x9.mp4` w paczce. `opodyski()` = katalog dla Teatru w TeO Story i Biblioteki Żywych Ksiąg;
 * `gablota*` = półka odzieży TeO Wear / 0.00G Merch (pozycje dodaje Suweren).
 *
 * 📚 WYPOŻYCZALNIA teostory.studio: `wydajDoWypozyczalni(id, {tier, cenaEur})` zamienia Opodysk w Żywą Księgę czytnika —
 * akt = strona (klatka 16:9, wersy jako narracja, fragment utworu wycięty z master.wav jako nagranie strony) — i publikuje
 * ją przez `cfg.wypozyczalnia.publikuj`. Portal gra strony po kolei, więc utwór płynie akt po akcie. Stacja 1 domyślnie
 * `demo` (darmowy prolog), pozostałe `rental_48h`. `wydajAlbum` = cały album jako jeden spektakl (wszystkie gotowe stacje).
 *
 * ➕ STACJE: wbudowane `STACJE` 1–10 (pełne LP „Zero Gravity Heart”, sztafeta głosów Kael ↔ Elara) + własne z interfejsu
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
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { zbudujStoryboard, sekcjeTekstu, FORMATY as FORMATY_KADRU, WERSJA_STORYBOARDU } from './StoryboardTeledysku.js';
import { htmlManuskryptu, htmlPergaminu, sprawdzSvg } from './DrukOpodysku.js';

export const PLIK_MANUSKRYPTU = 'manuskrypt_000g.pdf';
export const PLIKI_PERGAMINU = { svg: 'pergamin_000g.svg', png: 'pergamin_000g.png', pdf: 'pergamin_000g.pdf' };
import { zlozOpodysk, PLIK_OPODYSKU, dlugoscPliku } from './Opodysk.js';
import { nagranieDoMp4 } from './OdcinkiStudia.js';
import { spotifyZAdresu } from './WypozyczalniaKsiag.js';

/** 🎼 Opodysk z wtopioną partyturą 0.00G — nagranie Teatru Opodysku (tryb Fuzji) z przeglądarki */
export const PLIK_PARTYTURY = 'opodysk_partytura_16x9.mp4';
/** 📱 Spotify Canvas: pętla 8 s, 9:16 (1080×1920), H.264 bez dźwięku — wgrywasz w Spotify for Artists → Add Canvas. */
export const PLIK_CANVAS = 'spotify_canvas_9x16_8s.mp4';
export const WARIANTY_CANVAS = ['fuzja', 'teofon'];

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
    // pełne LP — 10 utworów (Suweren 2026-11-12): dalsza sztafeta 6 Elara, 7 Kael, 8 Elara, 9 Kael, 10 Elara (finał, w opisie obok Kaela)
    6: {
        nr: 6, tytul: 'Velvet Static (Elara Solo)', bpm: 83, artysci: ['Elara'], glos: 'ELARA (S.M.T)', gatunek: 'R&B/Soul', jezyk: 'EN',
        styl: 'sensual neo-soul, late night lounge, 83 bpm, silky breathy female vocal, warm Rhodes chords, deep analog sub-bass, soft rimshot groove, vinyl crackle warmth',
        lyrics: [
            '[Intro - Warm Rhodes chords, soft vinyl crackle, deep sub-bass groove at 83 BPM]',
            '[Verse 1]',
            'Turn the radio down to a golden hum',
            'Watching what the quiet night has now become',
            'Static in the air is turning into silk',
            'Moonlight in the glass like a drop of milk',
            '[Chorus]',
            'Wrapped in velvet static, floating next to you',
            'Every hidden color shining softly through',
            "We don't need a compass when the stars align",
            'Your frequency is locked inside of mine',
            '[Verse 2]',
            'Every little worry melts into the floor',
            'Nothing left to chase outside the diner door',
            'Just the gentle voltage of your fingertips',
            'And the unspoken promise on your lips',
            '[Chorus]',
            'Wrapped in velvet static, floating next to you',
            'Every hidden color shining softly through',
            "We don't need a compass when the stars align",
            'Your frequency is locked inside of mine',
            '[Outro - Breathy female whisper over fading Rhodes]',
            'Velvet static...',
            'Zero point zero G...',
        ].join('\n'),
    },
    7: {
        nr: 7, tytul: 'Neon Rain on Chrome (Kael Solo)', bpm: 85, artysci: ['Kael'], glos: 'KAEL (S.M.T.)', gatunek: 'R&B/Soul', jezyk: 'EN',
        styl: 'smooth nocturnal soul-jazz, 85 bpm, deep warm baritone male vocal, smoky tenor saxophone solo, upright double bass, Fender Rhodes, brushed snare, late night city vibe',
        lyrics: [
            '[Intro - Smoky tenor saxophone melody over upright bass and brushed drums at 85 BPM]',
            '[Verse 1]',
            'Neon rain is dancing on the window chrome',
            'This little corner booth feels like our only home',
            'Headlights passing by like comets in the mist',
            "Every quiet second shouldn't be missed",
            '[Chorus]',
            'Let the city shimmer in the afterglow',
            'There is nowhere else that we would rather go',
            'Drifting on a current only we can feel',
            'In a world of illusions, only this is real',
            '[Verse 2]',
            'Your reflection smiling in the amber glass',
            'Letting all the noise of the century pass',
            'One more slow rotation of the midnight reel',
            'Nothing left to hide and nothing to conceal',
            '[Chorus]',
            'Let the city shimmer in the afterglow',
            'There is nowhere else that we would rather go',
            'Drifting on a current only we can feel',
            'In a world of illusions, only this is real',
            '[Outro - Tenor saxophone fadeout with warm baritone whisper]',
            'Neon rain on chrome...',
            'Stay with me...',
        ].join('\n'),
    },
    8: {
        nr: 8, tytul: 'Two Shadows One Flame (Elara Solo)', bpm: 78, artysci: ['Elara'], glos: 'ELARA (S.M.T)', gatunek: 'R&B/Soul', jezyk: 'EN',
        styl: 'intimate cinematic R&B ballad, 78 bpm, silky emotional female vocal, warm cello and Rhodes piano, minimal heartbeat kick, close-mic whisper, lush analog reverb',
        lyrics: [
            '[Intro - Warm solo cello and soft Fender Rhodes chords at 78 BPM]',
            '[Verse 1]',
            'The candle on the table casts a gentle ring',
            'Listening to the song that only silence sings',
            'Two shadows on the wall are merging into one',
            'Long before the rising of the morning sun',
            '[Chorus]',
            'Two shadows, one flame, burning soft and slow',
            'In the deepest sanctuary that we know',
            'Weightless in the warmth of an endless embrace',
            'Lost inside the beauty of this quiet space',
            '[Verse 2]',
            'No gravity to pull us back to yesterday',
            'Every heavy cloud has gently drifted away',
            'Just the honest truth inside your open eyes',
            'Underneath the shelter of the velvet skies',
            '[Chorus]',
            'Two shadows, one flame, burning soft and slow',
            'In the deepest sanctuary that we know',
            'Weightless in the warmth of an endless embrace',
            'Lost inside the beauty of this quiet space',
            '[Outro - Close-mic whispered vocal and fading cello]',
            'Two shadows... one flame...',
            'Zero gravity heart...',
        ].join('\n'),
    },
    9: {
        nr: 9, tytul: 'Last Call in Zero-G (Kael Solo)', bpm: 82, artysci: ['Kael'], glos: 'KAEL (S.M.T.)', gatunek: 'R&B/Soul', jezyk: 'EN',
        styl: 'late night bluesy neo-soul, 82 bpm, deep warm baritone male vocal, tremolo electric guitar, warm organ pad, upright bass, brushed drums, intimate analog tape feel',
        lyrics: [
            '[Intro - Tremolo electric guitar chords, warm Hammond organ pad and bass at 82 BPM]',
            '[Verse 1]',
            'The bartender turns the key inside the lock',
            'Nobody is looking at the diner clock',
            'Last call in a world where time has lost its name',
            'And nothing in our lives will ever be the same',
            '[Chorus]',
            'Pour a little stardust in the final cup',
            'We are floating higher, never coming down or up',
            'Right here at the center of eternity',
            'Last call in the middle of zero-G',
            '[Verse 2]',
            'The chairs are on the tables in the quiet hall',
            'Except for this red booth against the wooden wall',
            'Where you and I are anchored in a timeless sea',
            'Breathing in the rhythm of what used to be',
            '[Chorus]',
            'Pour a little stardust in the final cup',
            'We are floating higher, never coming down or up',
            'Right here at the center of eternity',
            'Last call in the middle of zero-G',
            '[Outro - Tremolo guitar and deep baritone whisper]',
            'Last call in zero-G...',
            'Just you and me...',
        ].join('\n'),
    },
    10: {
        nr: 10, tytul: 'Infinite Horizon (0.00G Finale)', bpm: 75, artysci: ['Elara', 'Kael'], glos: 'ELARA (S.M.T)', gatunek: 'R&B/Soul', jezyk: 'EN',
        styl: 'ethereal neo-soul album finale, 75 bpm, silky breathy female vocal, warm acoustic piano, lush ambient strings, upright bass, golden sunrise atmosphere, vinyl warmth',
        lyrics: [
            '[Intro - Warm acoustic piano and lush ambient strings at 75 BPM]',
            '[Verse 1]',
            'First ray of the morning touches silver glass',
            'Night is bowing softly as the shadows pass',
            'We step outside together into open air',
            'Carrying the stillness that we found in there',
            '[Chorus]',
            'Into the infinite horizon, wide and free',
            'Living in the state of zero point zero G',
            'Every single step is lighter than a dream',
            'Floating down the middle of a golden stream',
            '[Verse 2]',
            'No more walls between the spirit and the ground',
            'In the sweetest harmony we ever found',
            'The diner lights behind us softly fade away',
            'As we walk together into brand new day',
            '[Chorus]',
            'Into the infinite horizon, wide and free',
            'Living in the state of zero point zero G',
            'Every single step is lighter than a dream',
            'Floating down the middle of a golden stream',
            '[Outro - Silky whisper fading into warm sunrise chord]',
            'Infinite horizon...',
            'Zero gravity heart...',
            'We are... what we are...',
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
    const krecone = new Set();           // id kampanii, której Opodysk właśnie się kręci
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
        if (['klatki', 'montaz'].includes(k.opodysk?.stan) && !krecone.has(k.id)) {   // 👻 kręcenie Opodysku przerwane restartem
            k.opodysk = { ...k.opodysk, stan: 'blad', blad: 'Kręcenie przerwane (restart mostu) — 🎞️ nakręć jeszcze raz; narysowane klatki zostały.' };
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
    async function stacjeWlasne() {
        let l; try { const d = JSON.parse(await fs.readFile(plikStacji, 'utf8')); l = Array.isArray(d?.stacje) ? d.stacje.filter((x) => x && Number(x.nr) > 0 && x.tytul) : []; } catch { return []; }
        // album urósł w kodzie (np. 5 → 10 stacji) i numer własnej stacji zajęła wbudowana → własna dostaje pierwszy wolny za nimi
        if (l.some((x) => STACJE[Number(x.nr)])) {
            let wolny = Math.max(...Object.keys(STACJE).map(Number), ...l.filter((x) => !STACJE[Number(x.nr)]).map((x) => Number(x.nr)));
            l = l.map((x) => (STACJE[Number(x.nr)] ? { ...x, nrPoprzedni: Number(x.nr), nr: ++wolny } : x));
            await zapiszStacje(l).catch(() => {});
        }
        return l;
    }
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
    async function czytajUstawienia() { try { const u = JSON.parse(await fs.readFile(plikUstawien, 'utf8')); return u && typeof u === 'object' ? u : {}; } catch { return {}; } }
    async function ustawienia() {
        const u = await czytajUstawienia();
        const wlasny = typeof u.dystrybutor === 'string' && u.dystrybutor ? u.dystrybutor : null;
        return { dystrybutor: wlasny ?? DYSTRYBUTOR_DOMYSLNY, domyslny: !wlasny, spotify: { album: u.spotify?.album ?? null, utwory: u.spotify?.utwory ?? {} } };
    }
    /** Zmiana ustawień: `dystrybutor` (https, pusty = DistroKid), `spotifyAlbum`, `spotifyUtwor {nr, url}` — adresy open.spotify.com wkleja Suweren, gdy album wyjdzie. */
    async function ustaw(z = {}) {
        const u = await czytajUstawienia();
        if ('dystrybutor' in z) {
            const a = String(z.dystrybutor ?? '').trim();
            if (a && !/^https:\/\/[^\s]{4,300}$/.test(a)) throw new Error('Adres panelu dystrybutora musi zaczynać się od https://');
            u.dystrybutor = a || null;
        }
        const sp = (x, co) => { const a = String(x ?? '').trim(); if (a && !/^https:\/\/open\.spotify\.com\/[^\s]{4,300}$/.test(a)) throw new Error(`Adres ${co} musi zaczynać się od https://open.spotify.com/`); return a || null; };
        if ('spotifyAlbum' in z) u.spotify = { ...(u.spotify ?? {}), album: sp(z.spotifyAlbum, 'albumu') };
        if (z.spotifyUtwor) {
            const nr = Number(z.spotifyUtwor.nr);
            if (!(nr >= 1 && nr <= 99)) throw new Error('Podaj numer stacji (1–99).');
            const a = sp(z.spotifyUtwor.url, 'utworu'), utwory = { ...(u.spotify?.utwory ?? {}) };
            if (a) utwory[nr] = a; else delete utwory[nr];
            u.spotify = { ...(u.spotify ?? {}), utwory };
        }
        await fs.mkdir(path.dirname(plikUstawien), { recursive: true });
        await fs.writeFile(plikUstawien, JSON.stringify(u, null, 2));
        if ('spotifyAlbum' in z || z.spotifyUtwor) await synchronizujSpotify().catch(() => {});
        return ustawienia();
    }
    const ustawDystrybutora = (adres) => ustaw({ dystrybutor: adres });
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
    // ── 🎬 Teledysk: storyboard 0.00G w paczce wydawniczej + projekt w TeO Story Studio ──
    const PLIK_STORYBOARDU = 'storyboard_000g.json';
    const rysowaneKadry = new Set();   // `${id}:${scena}:${format}` — żywe rysowanie klatek
    async function zapiszStoryboard(k, sb) {
        const cel = path.join(sciezkaWydania(k), PLIK_STORYBOARDU), tmp = `${cel}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(sb, null, 2), 'utf8');
        await fs.rename(tmp, cel).catch(async () => { await fs.copyFile(tmp, cel); await fs.rm(tmp, { force: true }); });
        return sb;
    }
    async function czytajStoryboard(k) {
        const kat = sciezkaWydania(k);
        if (!kat) return null;
        let sb; try { sb = JSON.parse(await fs.readFile(path.join(kat, PLIK_STORYBOARDU), 'utf8')); } catch { return null; }
        if (!Array.isArray(sb?.sceny)) return null;
        let duch = false;   // 👻 „rysuje” bez żywej pracy (restart mostu) = błąd z powodem
        for (const sc of sb.sceny) for (const [f, v] of Object.entries(sc.kadry ?? {})) {
            if (v?.stan === 'rysuje' && !rysowaneKadry.has(`${k.id}:${sc.nr}:${f}`)) { sc.kadry[f] = { ...(v.plik ? { plik: v.plik } : {}), blad: 'Rysowanie przerwane (restart mostu) — zleć klatkę jeszcze raz.' }; duch = true; }
        }
        if (duch) await zapiszStoryboard(k, sb);
        return sb;
    }
    /** Ujęcia storyboardu → karty KADR Tablicy TeO Story (prompty obu formatów w notatkach). */
    const kartySceny = (k, sb) => sb.sceny.map((sc) => ({
        tytul: `${String(sc.nr).padStart(2, '0')} · ${sc.sekcja} — ${k.stacja.tytul}`.slice(0, 120),
        opis: `${czasUtworu(sc.od)}–${czasUtworu(sc.do)} · ${sc.opis} ${sc.obraz}. ${sc.energia ?? ''}${sc.wersy.length ? `\nWersy: ${sc.wersy.join(' / ')}` : ''}`,
        notatki: `16:9 (YouTube): ${sc.prompt169}\n\n9:16 (Spotify Canvas, pętla 8 s): ${sc.prompt916}`,
    }));
    /** 🎬 Storyboard (10–14 ujęć) + projekt teledysku w TeO Story (raz; ponowne wywołanie tylko go otwiera). `odNowa` liczy ujęcia od zera. */
    async function teoStory(id, { odNowa = false } = {}) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        if (k.stan !== 'przyjeta' || !k.spotify || !sciezkaWydania(k)) throw new Error('Teledysk projektuję z gotowej paczki wydawniczej — najpierw „🚀 Przygotuj i wyślij na Spotify”.');
        const kat = sciezkaWydania(k);
        await fs.access(kat).catch(() => { throw new Error('Folder paczki zniknął z dysku — złóż paczkę ponownie.'); });
        let sb = odNowa ? null : await czytajStoryboard(k);
        if (sb && !(Number(sb.wersja) >= WERSJA_STORYBOARDU)) sb = null;   // stary układ (5 scen przy stoliku) → nowa opowieść
        const nowyUklad = !sb;
        if (!sb) {
            if ([...rysowaneKadry].some((x) => x.startsWith(`${k.id}:`))) throw new Error('Paleta właśnie rysuje klatki tego storyboardu — poczekaj, aż skończy.');
            sb = await zapiszStoryboard(k, zbudujStoryboard(k, { sekundy: k.spotify.master?.sekundy ?? null }));
        }
        if (!k.spotify.pliki.includes(PLIK_STORYBOARDU)) k.spotify.pliki.push(PLIK_STORYBOARDU);
        const uwagi = [];
        if (!k.teoStory?.serial) {
            if (!cfg.story) uwagi.push('Most nie ma podłączonego TeO Story Studio — storyboard jest w paczce, projektu nie założyłem.');
            else {
                const jest = async (n) => (await fs.access(path.join(kat, n)).then(() => true, () => false)) ? path.join(kat, n) : null;
                const p = await cfg.story.zaloz({
                    nazwa: `Teledysk — ${k.stacja.tytul}`,
                    notatka: `Teledysk do utworu „${k.stacja.tytul}” (${k.album}) — most Jasona, storyboard 0.00G.`,
                    fakty: [
                        `To teledysk do utworu „${k.stacja.tytul}” z albumu „${k.album}”: ${k.artysci.join(' i ')}, ${sb.bpm ?? '?'} BPM, ${czasUtworu(sb.sekundy)}.`,
                        `Świat: ${sb.klimat}.`,
                        ...Object.values(sb.postacie ?? {}).map((o) => `Postać: ${o}.`),
                        'Na ekranie nie ma żadnych napisów, liter ani szyldów. Klatka bazowa (firstFrame) to okładka utworu.',
                    ],
                    odcinek: { tytul: `Teledysk — ${k.stacja.tytul}`.slice(0, 120), czasMinut: Math.round(((sb.sekundy ?? 180) / 60) * 100) / 100, styl: tn(k.stacja.styl, 300),
                        streszczenie: sb.sceny.map((sc) => `${sc.nr}. ${sc.sekcja} (${czasUtworu(sc.od)}–${czasUtworu(sc.do)}): ${sc.opis} ${sc.obraz}.`).join('\n') },
                    teledysk: { utwor: k.stacja.tytul, audio: (await jest('master.wav')) ?? (await jest('original.mp3')), sekundy: sb.sekundy, styl: k.stacja.styl ?? '', prompt: sb.klimat,
                        lyrics: czystyTekst(k.stacja.lyrics), artysci: k.artysci, bpm: sb.bpm, firstFrame: await jest('cover_3000x3000.jpg'), storyboard: path.join(kat, PLIK_STORYBOARDU), kampania: k.id },
                    sceny: kartySceny(k, sb),
                });
                k.teoStory = { serial: p.serial, odcinekId: p.odcinekId ?? null, karty: p.karty ?? [], kiedy: new Date().toISOString() };
                sb.projekt = { serial: p.serial };
                await zapiszStoryboard(k, sb);
                wiesc(`🎬 Jason: projekt teledysku „${p.serial}” czeka w TeO Story Studio — ${sb.sceny.length} ujęć na Tablicy, utwór podpięty pod montaż.`);
            }
        }
        else if (nowyUklad && cfg.story?.wymienKarty) {
            // projekt już jest, a ujęcia policzono od nowa → karty na Tablicy mają odpowiadać nowym ujęciom
            try {
                k.teoStory.karty = await cfg.story.wymienKarty({ serial: k.teoStory.serial, stare: k.teoStory.karty ?? [], sceny: kartySceny(k, sb) });
                sb.projekt = { serial: k.teoStory.serial };
                await zapiszStoryboard(k, sb);
            } catch (e) { uwagi.push(`Karty na Tablicy TeO Story zostały stare (${tn(e.message, 160)}).`); }
        }
        k.teoStory = { ...(k.teoStory ?? {}), storyboard: PLIK_STORYBOARDU, scen: sb.sceny.length, url: k.teoStory?.serial ? `/apps/story/?serial=${encodeURIComponent(k.teoStory.serial)}` : null };
        await zapisz(k);
        return { kampania: k, storyboard: sb, uwagi };
    }
    async function storyboard(id) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        const sb = await czytajStoryboard(k);
        if (!sb) throw Object.assign(new Error('Ta kampania nie ma jeszcze storyboardu — „🎬 Projektuj Teledysk w TeO Story”.'), { kod: 404 });
        return sb;
    }
    const plikKadru = (nr, format) => `storyboard/scena-${nr}-${format.replace(':', 'x')}.png`;
    /** 🎨 Klatka sceny od Palety (FLUX w tle, okładka paczki jako wzór postaci). `scena`: 1–5 albo 'wszystkie'; `format`: '16:9' | '9:16'. */
    async function kadrSceny(id, { scena = 'wszystkie', format = '16:9', wzor = false } = {}) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        if (!cfg.kadr) throw new Error('Katedra nie ma podłączonej Palety (FLUX).');
        if (!FORMATY_KADRU[format]) throw new Error(`Nie znam formatu „${format}”. Znane: ${Object.keys(FORMATY_KADRU).join(', ')}.`);
        const sb = await czytajStoryboard(k);
        if (!sb) throw new Error('Najpierw storyboard — „🎬 Projektuj Teledysk w TeO Story”.');
        const numery = scena === 'wszystkie' ? sb.sceny.map((sc) => sc.nr) : [Number(scena)];
        const sceny = numery.map((n) => sb.sceny.find((sc) => sc.nr === n));
        if (sceny.some((sc) => !sc)) throw new Error(`Storyboard ma sceny 1–${sb.sceny.length}.`);
        const nowe = sceny.filter((sc) => !rysowaneKadry.has(`${k.id}:${sc.nr}:${format}`));
        if (!nowe.length) throw new Error('Te klatki właśnie się rysują.');
        for (const sc of nowe) { rysowaneKadry.add(`${k.id}:${sc.nr}:${format}`); sc.kadry = { ...(sc.kadry ?? {}), [format]: { ...(sc.kadry?.[format]?.plik ? { plik: sc.kadry[format].plik } : {}), stan: 'rysuje' } }; }
        await zapiszStoryboard(k, sb);
        for (const sc of nowe) kolejka = kolejka.then(() => rysujKadr(k.id, sc.nr, format, wzor === true)).catch(() => {});
        return sb;
    }
    async function rysujKadr(id, nr, format, zWzorem = false) {
        const klucz = `${id}:${nr}:${format}`;
        try {
            const k = await wczytaj(id), sb = k && await czytajStoryboard(k), sc = sb?.sceny.find((x) => x.nr === nr);
            if (!sc) return;
            const kat = sciezkaWydania(k), poprzedni = sc.kadry?.[format]?.plik;
            try {
                // Okładka jako wzór tylko na wyraźne życzenie: FLUX przenosi z wzoru całą kompozycję (2026-11-13: pięć klatek = pięć okładek).
                const wzor = path.join(kat, 'cover_3000x3000.jpg');
                const f = FORMATY_KADRU[format];
                const w = await cfg.kadr({ prompt: `${format === '9:16' ? 'Vertical 9:16 composition. ' : 'Widescreen 16:9 composition. '}${sc.promptKadru}`, szer: f.szer, wys: f.wys,
                    referencje: zWzorem && (await fs.access(wzor).then(() => true, () => false)) ? [wzor] : [], scena: sc, kampania: k });
                const zrodlo = typeof w === 'string' ? w : w?.sciezka ?? w?.plik;
                if (!zrodlo) throw new Error('Paleta nie oddała pliku.');
                const rel = plikKadru(nr, format), cel = path.join(kat, ...rel.split('/'));
                await fs.mkdir(path.dirname(cel), { recursive: true });
                await fs.copyFile(zrodlo, cel);
                sc.kadry[format] = { plik: rel, wersja: (Number(sc.kadry?.[format]?.wersja) || 0) + 1, kiedy: new Date().toISOString() };
                // klatka 16:9 trafia też na kartę sceny na Tablicy TeO Story (pole „zwrot”)
                if (format === '16:9' && k.teoStory?.karty?.[nr - 1]) await Promise.resolve(cfg.story?.kadrGotowy?.({ karta: k.teoStory.karty[nr - 1], plik: cel })).catch(() => {});
            } catch (e) { sc.kadry[format] = { ...(poprzedni ? { plik: poprzedni } : {}), blad: tn(e.message, 300) }; }
            rysowaneKadry.delete(klucz);
            await zapiszStoryboard(k, sb);
        } finally { rysowaneKadry.delete(klucz); }
    }
    // ── 🎞️ OPODYSK: brakujące klatki 16:9 → montaż ffmpeg na długość utworu → opodysk_youtube_16x9.mp4 w paczce ──
    const jestPlik = (p) => fs.access(p).then(() => true, () => false);
    const maKlatke = async (kat, sc) => { const p = sc.kadry?.['16:9']?.plik; return !!p && jestPlik(path.join(kat, ...p.split('/'))); };
    async function czcionkaNapisow() { for (const p of cfg.czcionki ?? []) if (p && await jestPlik(p)) return p; return null; }
    /** 🎞️ Start kręcenia (wraca od razu; praca na kolejce Jasona). `napisy: false` = film bez napisu opowieści. */
    async function opodysk(id, { napisy = true } = {}) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        if (!cfg.ffmpeg || !cfg.uruchom) throw new Error('Most nie ma podłączonego ffmpeg dla Jasona.');
        const sb = await czytajStoryboard(k);
        if (!sb) throw new Error('Opodysk kręcę ze storyboardu — najpierw „🎬 Projektuj Teledysk w TeO Story”.');
        if (krecone.has(k.id)) throw new Error('Ten Opodysk właśnie się kręci.');
        if ([...rysowaneKadry].some((x) => x.startsWith(`${k.id}:`))) throw new Error('Paleta właśnie rysuje klatki tego storyboardu — nakręć, gdy skończy.');
        const kat = sciezkaWydania(k);
        if (!(await jestPlik(path.join(kat, 'master.wav')))) throw new Error('W paczce nie ma master.wav — złóż paczkę ponownie.');
        const brak = [];
        for (const sc of sb.sceny) if (!(await maKlatke(kat, sc))) brak.push(sc.nr);
        if (brak.length && !cfg.kadr) throw new Error(`Ujęcia ${brak.join(', ')} nie mają klatek 16:9, a Katedra nie ma podłączonej Palety (FLUX).`);
        krecone.add(k.id);   // przed zapisem — odczyt nie weźmie jej za ducha
        k.opodysk = { ...(k.opodysk?.plik ? { plik: k.opodysk.plik, sekundy: k.opodysk.sekundy, bajtow: k.opodysk.bajtow, wersja: k.opodysk.wersja } : {}),
            stan: brak.length ? 'klatki' : 'montaz', napisy: napisy !== false, brakowaloKlatek: brak.length, etap: brak.length ? `dorysowuję ${brak.length} klatek` : 'montaż',
            postep: { zrobione: 0, razem: brak.length + sb.sceny.length + 1 }, start: new Date().toISOString() };
        await zapisz(k);
        kolejka = kolejka.then(() => krecOpodysk(k.id, napisy !== false)).catch(() => {}).finally(() => krecone.delete(k.id));
        return k;
    }
    async function krecOpodysk(id, napisy) {
        let k = await wczytaj(id);
        const kat = sciezkaWydania(k), praca = path.join(kat, '.opodysk');
        const stan = async (zm) => { k = await wczytaj(id); k.opodysk = { ...k.opodysk, ...zm }; await zapisz(k); };
        try {
            const razem = k.opodysk.postep.razem;
            let zrobione = 0;
            // 1. brakujące klatki 16:9 — po kolei, Paletą (bez okładki jako wzoru)
            for (const sc of (await czytajStoryboard(k)).sceny) {
                if (await maKlatke(kat, sc)) continue;
                rysowaneKadry.add(`${id}:${sc.nr}:16:9`);
                const s2 = await czytajStoryboard(k), x = s2.sceny.find((y) => y.nr === sc.nr);
                x.kadry = { ...(x.kadry ?? {}), '16:9': { stan: 'rysuje' } };
                await zapiszStoryboard(k, s2);
                await rysujKadr(id, sc.nr, '16:9');
                zrobione++;
                await stan({ postep: { zrobione, razem }, etap: `klatka ujęcia ${sc.nr}` });
            }
            const sb = await czytajStoryboard(k);
            for (const sc of sb.sceny) if (!(await maKlatke(kat, sc))) throw new Error(`Ujęcie ${sc.nr} nie ma klatki 16:9 (${sc.kadry?.['16:9']?.blad ?? 'Paleta jej nie narysowała'}) — film nie powstał.`);
            // 2. montaż
            await stan({ stan: 'montaz', etap: 'montaż' });
            await fs.rm(praca, { recursive: true, force: true });
            const w = await zlozOpodysk({ sb, kat, praca, ffmpeg: cfg.ffmpeg, uruchom: cfg.uruchom, czcionka: napisy ? await czcionkaNapisow() : null, napisy,
                postep: (a, _b, e) => stan({ postep: { zrobione: zrobione + a, razem }, etap: e }) });
            await fs.rm(praca, { recursive: true, force: true });
            k = await wczytaj(id);
            if (!k.spotify.pliki.includes(PLIK_OPODYSKU)) k.spotify.pliki.push(PLIK_OPODYSKU);
            const uwagi = ['Klatki FLUX mają 1280×720 — do 1920×1080 są powiększone, szczegółów z tego nie przybywa. To ruch po nieruchomych klatkach, nie wideo generowane ujęcie po ujęciu.'];
            if (napisy && !w.napisy) uwagi.push('Bez napisów — most nie znalazł czcionki.');
            // kopia do montaży projektu TeO Story → Montażownia i „📺 do publikacji” (Kronikarz → ✓ → Impresariat)
            let montaz = null;
            if (k.teoStory?.serial && cfg.story?.filmGotowy) montaz = await Promise.resolve(cfg.story.filmGotowy({ serial: k.teoStory.serial, plik: path.join(kat, PLIK_OPODYSKU), tytul: k.stacja.tytul })).catch(() => null);
            k.opodysk = { stan: 'gotowy', ...w, wersja: (Number(k.opodysk?.wersja) || 0) + 1, brakowaloKlatek: k.opodysk?.brakowaloKlatek ?? 0, montaz: montaz ?? null, uwagi, kiedy: new Date().toISOString() };
            await zapisz(k);
            wiesc(`🎞️ Jason: Opodysk „${k.stacja.tytul}” gotowy — ${czasUtworu(w.sekundy)}, ${w.ujec} ujęć, _OtakOs_Muzyka/${k.spotify.folder}/${PLIK_OPODYSKU}.`);
        } catch (e) {
            await fs.rm(praca, { recursive: true, force: true }).catch(() => {});
            k = await wczytaj(id);
            k.opodysk = { ...(k.opodysk ?? {}), stan: 'blad', blad: tn(e.stderr || e.message, 400) };
            await zapisz(k);
            wiesc(`🎞️ Jason: Opodysk „${k.stacja.tytul}” nie powstał (${tn(e.message, 160)}).`);
        }
    }
    const sciezkaOpodysku = (k) => (k?.opodysk?.plik && sciezkaWydania(k) ? path.join(sciezkaWydania(k), k.opodysk.plik) : null);
    /**
     * 🎼 Opodysk z partyturą: Teatr Opodysku (TeO Story, tryb Fuzji) nagrywa płótno partytury z dźwiękiem utworu w czasie
     * rzeczywistym i przysyła webm → ffmpeg H.264 + AAC → `opodysk_partytura_16x9.mp4` w paczce wydawniczej. Jedno naraz.
     */
    let nagrywana = null;
    async function zapiszPartyture(id, bufor, typ) {
        let k = await wczytaj(id);
        const kat = sciezkaWydania(k);
        if (!kat || !k.spotify) throw Object.assign(new Error('Ta kampania nie ma paczki wydawniczej — najpierw „🚀 Przygotuj i wyślij na Spotify”.'), { status: 409 });
        if (nagrywana) throw Object.assign(new Error('Most właśnie przelicza inne nagranie partytury — poczekaj chwilę.'), { status: 409 });
        nagrywana = id;
        try {
            const cel = path.join(kat, PLIK_PARTYTURY), roboczy = path.join(kat, '.partytura', 'partytura.mp4');
            await nagranieDoMp4({ bufor, typ, praca: path.join(kat, '.partytura'), cel: roboczy, ffmpeg: cfg.ffmpeg, minBajtow: 20_000 });
            const sekundy = await dlugoscPliku(cfg.ffmpeg, cfg.uruchom, roboczy);
            const wzor = k.spotify.master?.sekundy ?? null;
            if (wzor && sekundy && sekundy < wzor * 0.9) { await fs.rm(path.join(kat, '.partytura'), { recursive: true, force: true }); throw Object.assign(new Error(`Nagranie trwa ${czasUtworu(sekundy)}, a utwór ${czasUtworu(wzor)} — przerwane w połowie, nie zapisuję.`), { status: 422 }); }
            await fs.rename(roboczy, cel).catch(async () => { await fs.copyFile(roboczy, cel); });
            await fs.rm(path.join(kat, '.partytura'), { recursive: true, force: true }).catch(() => {});
            const bajtow = (await fs.stat(cel)).size;
            k = await wczytaj(id);
            if (!k.spotify.pliki.includes(PLIK_PARTYTURY)) k.spotify.pliki.push(PLIK_PARTYTURY);
            k.partytura = { plik: PLIK_PARTYTURY, sekundy: sekundy ?? null, bajtow, wersja: (Number(k.partytura?.wersja) || 0) + 1, kiedy: new Date().toISOString() };
            await zapisz(k);
            wiesc(`🎼 Jason: Opodysk z partyturą 0.00G „${k.stacja.tytul}” zapisany — ${czasUtworu(sekundy)}, _OtakOs_Muzyka/${k.spotify.folder}/${PLIK_PARTYTURY}.`);
            return k;
        } finally { nagrywana = null; }
    }
    // ── 🎙️ głos lektora sceny i atmosfera tła (ElevenLabs; pliki leżą w `voices/` paczki — archiwum, 0 kredytów przy powtórce) ──
    async function ustawLektora(id, nr, w) {
        const k = await wczytaj(id), n = Number(nr);
        if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error('Lektor potrzebuje numeru sceny.');
        k.lektor = { ...(k.lektor ?? {}) };
        if (w?.plik) k.lektor[n] = { plik: String(w.plik), rola: String(w.rola ?? 'kronikarz'), tekst: tn(w.tekst, 2000), glosy: w.glosy ?? null, kiedy: new Date().toISOString() }; else delete k.lektor[n];
        await zapisz(k);
        return k.lektor;
    }
    async function ustawAtmosfere(id, w) {
        const k = await wczytaj(id);
        k.atmosfera = w?.plik ? { plik: String(w.plik), opis: tn(w.opis, 450), sekundy: Number(w.sekundy) || null, petla: w.petla !== false, kiedy: new Date().toISOString() } : null;
        await zapisz(k);
        return k.atmosfera;
    }
    const glosyKampanii = (k) => { const b = `/api/elevenlabs/plik/opodysk/${k.id}`; return {
        lektor: Object.fromEntries(Object.entries(k.lektor ?? {}).map(([nr, l]) => [nr, { url: `${b}/${l.plik}`, rola: l.rola, tekst: l.tekst, glosy: l.glosy ?? null }])),
        atmosfera: k.atmosfera?.plik ? { url: `${b}/${k.atmosfera.plik}`, opis: k.atmosfera.opis, sekundy: k.atmosfera.sekundy, petla: k.atmosfera.petla } : null }; };
    // ── 📖 Żywa Księga i Manuskrypt PDF z Opodysku (Suweren 2026-11-14) ──
    const slugKsiegi = (t) => nazwaFolderu(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    /** Strony księgi: najpierw cały tekst utworu, potem po stronie na akt (opis akcji + wersy + klatka FLUX); bez storyboardu — sekcje tekstu. */
    async function stronyKsiegi(k) {
        const sb = await czytajStoryboard(k), kat = sciezkaWydania(k), strony = [], tekst = czystyTekst(k.stacja.lyrics ?? '');
        if (tekst.length >= 10) strony.push({ chapterTitle: 'Tekst utworu', imageCaption: k.stacja.tytul, narrativeText: tekst, dialogueLines: [] });
        if (sb) {
            for (const sc of sb.sceny) {
                const kadr = sc.kadry?.['16:9'], ma = await maKlatke(kat, sc);
                strony.push({ chapterTitle: `Akt ${sc.nr} · ${sc.sekcja}`, imageCaption: sc.sekcja, dialogueLines: [],
                    narrativeText: [sc.obraz, sc.wersy.length ? sc.wersy.map((w) => `♪ ${w}`).join('\n') : ''].filter(Boolean).join('\n\n'),
                    ...(ma ? { imageUrl: `/api/jason/kampanie/${k.id}/storyboard/kadr/${kadr.plik.split('/').pop()}` } : {}) });
            }
        } else for (const sec of sekcjeTekstu(k.stacja.lyrics ?? '')) if (sec.wersy.length) strony.push({ chapterTitle: sec.nazwa, imageCaption: sec.nazwa, narrativeText: sec.wersy.join('\n'), dialogueLines: [] });
        if (!strony.length) throw new Error(`„${k.stacja.tytul}” nie ma tekstu ani storyboardu — nie ma z czego złożyć księgi.`);
        return { strony, sb };
    }
    /** Żywa Księga z Opodysku w Wypożyczalni — NIEWYSTAWIONA (widać ją w Dzienniku Żywych Wpisów; do portalu trafia dopiero po „wystaw”). */
    async function zlozKsiege(id, { tier = 'demo', cenaEur = 0, wystaw = false } = {}) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        if (k.stan !== 'przyjeta' || !k.spotify) throw new Error('Księgę składam z gotowej paczki wydawniczej.');
        if (!cfg.wypozyczalnia?.publikuj) throw new Error('Most nie ma podłączonej Wypożyczalni teostory.studio.');
        const { strony, sb } = await stronyKsiegi(k);
        const book = { id: `zk-opodysk-${String(k.stacja.nr).padStart(2, '0')}-${slugKsiegi(k.stacja.tytul)}`, title: k.stacja.tytul, subtitle: `${k.artysci.join(' & ')} · ${k.album}`,
            author: k.artysci.join(' & '), narrator: k.artysci.join(' & '), language: 'en', sourceType: 'zywa-ksiega', characters: [], pages: strony };
        const live = spotifyLive(k, await ustawienia());
        if (live) book.spotify = { url: live.url };
        let wpis = await cfg.wypozyczalnia.publikuj({ book, rentalTier: tier, cenaEur: tier === 'demo' ? 0 : cenaEur, wystaw });
        if (wystaw && wpis.wystawiona === false && cfg.wypozyczalnia.wystaw) wpis = await cfg.wypozyczalnia.wystaw(wpis.id);
        const k2 = await wczytaj(id);
        k2.ksiega = { id: wpis.id, stron: strony.length, zKlatkami: strony.filter((s) => s.imageUrl).length, zStoryboardu: !!sb, tier: wpis.tier ?? tier, cenaEur: wpis.cenaEur ?? 0, spotify: !!live, wystawiona: wpis.wystawiona !== false, kiedy: new Date().toISOString() };
        await zapisz(k2);
        wiesc(`📖 Jason: Żywa Księga „${k.stacja.tytul}” złożona (${strony.length} stron${sb ? '' : ', z sekcji tekstu — bez storyboardu'}) — jest na liście Żywych Wpisów.`);
        return k2;
    }
    /** Manuskrypt PDF (A5) w paczce stacji: okładka, tekst utworu, akt po akcie z klatką FLUX. Chrome (puppeteer) składa PDF; obrazy idą jako lekkie JPEG. */
    async function zlozManuskrypt(id) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        const kat = sciezkaWydania(k);
        if (!kat || k.stan !== 'przyjeta' || !k.spotify) throw new Error('Manuskrypt składam z gotowej paczki wydawniczej.');
        if (!cfg.pdf) throw new Error('Most nie ma podłączonego puppeteera (Chrome) — PDF nie powstanie.');
        if (!cfg.ffmpeg || !cfg.uruchom) throw new Error('Most nie ma podłączonego ffmpeg dla Jasona.');
        const sb = await czytajStoryboard(k), praca = path.join(kat, '.manuskrypt');
        await fs.rm(praca, { recursive: true, force: true }); await fs.mkdir(praca, { recursive: true });
        try {
            const jpg = async (zrodlo, cel, szer) => { await cfg.uruchom(cfg.ffmpeg, ['-loglevel', 'error', '-y', '-i', zrodlo, '-vf', `scale=${szer}:-2`, '-q:v', '3', path.join(praca, cel)], { windowsHide: true, timeout: 120_000, maxBuffer: 1 << 24 }); return cel; };
            const okl = path.join(kat, 'cover_3000x3000.jpg'), okladka = await jestPlik(okl) ? await jpg(okl, 'okladka.jpg', 1100).catch(() => null) : null;
            const akty = [];
            if (sb) for (const sc of sb.sceny) {
                const ma = await maKlatke(kat, sc), obraz = ma ? await jpg(path.join(kat, ...sc.kadry['16:9'].plik.split('/')), `akt-${sc.nr}.jpg`, 1280).catch(() => null) : null;
                akty.push({ nr: sc.nr, sekcja: sc.sekcja, od: sc.od, do: sc.do, plan: sc.plan, opis: sc.obraz, wersy: sc.wersy ?? [], obraz });
            }
            const tekst = sekcjeTekstu(k.stacja.lyrics ?? '').filter((s) => s.wersy.length).map((s) => ({ nazwa: s.nazwa, wersy: s.wersy }));
            if (!akty.length && !tekst.length) throw new Error(`„${k.stacja.tytul}” nie ma tekstu ani storyboardu — nie ma z czego złożyć manuskryptu.`);
            await fs.writeFile(path.join(praca, 'index.html'), htmlManuskryptu({ tytul: k.stacja.tytul, album: k.album, artysci: k.artysci, bpm: k.stacja.bpm ?? sb?.bpm ?? null, sekundy: k.spotify.master?.sekundy ?? sb?.sekundy ?? null,
                okladka, tekst, akty, autor: k.spotify.autor ?? null }), 'utf8');
            const cel = path.join(kat, PLIK_MANUSKRYPTU), tmp = `${cel}.tmp.pdf`;
            await cfg.pdf({ plikHtml: path.join(praca, 'index.html'), wyjscie: tmp });
            await fs.rename(tmp, cel).catch(async () => { await fs.copyFile(tmp, cel); await fs.rm(tmp, { force: true }); });
            const k2 = await wczytaj(id);
            if (!k2.spotify.pliki.includes(PLIK_MANUSKRYPTU)) k2.spotify.pliki.push(PLIK_MANUSKRYPTU);
            k2.manuskrypt = { plik: PLIK_MANUSKRYPTU, aktow: akty.length, zKlatkami: akty.filter((a) => a.obraz).length, bajtow: (await fs.stat(cel)).size, wersja: (Number(k.manuskrypt?.wersja) || 0) + 1, kiedy: new Date().toISOString() };
            await zapisz(k2);
            wiesc(`📄 Jason: Manuskrypt PDF „${k.stacja.tytul}” gotowy (${akty.length} aktów) — _OtakOs_Muzyka/${k.spotify.folder}/${PLIK_MANUSKRYPTU}.`);
            return k2;
        } finally { await fs.rm(praca, { recursive: true, force: true }).catch(() => {}); }
    }
    let skladana = null;
    /** Przycisk „📖 Złóż Żywą Księgę i Manuskrypt PDF z utworu”: księga zawsze, PDF gdy Chrome jest; jedno naraz. */
    async function zlozKsiegeIManuskrypt(id) {
        if (skladana) throw new Error('Most właśnie składa inną księgę — poczekaj chwilę.');
        skladana = id;
        try {
            let k = await zlozKsiege(id);
            const uwagi = [];
            try { k = await zlozManuskrypt(id); } catch (e) { uwagi.push(`Manuskrypt PDF nie powstał: ${tn(e.message, 240)}`); }
            return { kampania: k, uwagi };
        } finally { skladana = null; }
    }
    /** Księgi ze wszystkich stacji z paczką (lista wyboru w Żywych Wpisach). Bez PDF — manuskrypt osobno z karty stacji. */
    async function zlozWszystkieKsiegi() {
        const widziane = new Set(), zrobione = [], bledy = [];
        for (const k of await lista()) {
            if (k.stan !== 'przyjeta' || !k.spotify || widziane.has(k.stacja.nr)) continue;
            widziane.add(k.stacja.nr);
            try { const x = await zlozKsiege(k.id); zrobione.push({ nr: k.stacja.nr, id: x.ksiega.id, stron: x.ksiega.stron }); } catch (e) { bledy.push(`Stacja ${k.stacja.nr}: ${tn(e.message, 200)}`); }
        }
        return { zrobione, bledy };
    }
    let wystawiana = false;
    /**
     * 🏛️ „Wystaw wszystkie Żywe Księgi Opodysku” (Suweren 2026-11-14): jedna kolekcja — Stacja 1 jako darmowy Prolog (demo), pozostałe wypożyczenie 48 h za `cenaEur`.
     * Każda księga dostaje odznakę Spotify (adres stacji albo albumu) i — gdy jest Chrome — manuskrypt PDF w paczce. Rolowany pergamin składa przeglądarka
     * (silnik partytury), więc stacje bez niego trafiają do `uwagi`; do Wypożyczalni PDF ani pergamin nie jadą (to pliki paczki stacji).
     */
    async function wystawWszystkie({ cenaEur = 1.99 } = {}) {
        const cena = Math.round(Number(cenaEur) * 100) / 100;
        if (!(cena >= 0.5 && cena <= 100)) throw new Error('Cena wypożyczenia: 0,50–100 €.');
        if (!cfg.wypozyczalnia?.wystaw) throw new Error('Most nie ma podłączonej Wypożyczalni teostory.studio.');
        if (wystawiana || skladana) throw new Error('Most właśnie składa księgi — poczekaj chwilę.');
        wystawiana = true;
        try {
            const widziane = new Set(), zrobione = [], bledy = [], uwagi = [], ks = [];
            for (const k of await lista()) { if (k.stan !== 'przyjeta' || !k.spotify || widziane.has(k.stacja.nr)) continue; widziane.add(k.stacja.nr); ks.push(k); }
            ks.sort((a, b) => a.stacja.nr - b.stacja.nr);
            if (!ks.length) throw new Error('Żadna stacja nie ma paczki wydawniczej — nie ma czego wystawić.');
            for (const s of ks) {
                try {
                    const tier = s.stacja.nr === 1 ? 'demo' : 'rental_48h';
                    let k = await zlozKsiege(s.id, { tier, cenaEur: cena, wystaw: true });
                    let pdf = !!k.manuskrypt?.plik;
                    if (!pdf && cfg.pdf) { try { k = await zlozManuskrypt(s.id); pdf = true; } catch (e) { uwagi.push(`Stacja ${s.stacja.nr}: manuskrypt PDF nie powstał (${tn(e.message, 160)}).`); } }
                    if (!k.pergamin?.pdf && !k.pergamin?.svg) uwagi.push(`Stacja ${s.stacja.nr}: brak Rolowanego Pergaminu — wydrukuj go w Teatrze Opodysku (silnik partytury działa w przeglądarce).`);
                    if (!k.spotifyLive && !spotifyLive(k, await ustawienia())) uwagi.push(`Stacja ${s.stacja.nr}: brak adresu Spotify — odznaka „LIVE ON SPOTIFY” pojawi się po wklejeniu adresu albumu lub utworu.`);
                    zrobione.push({ nr: s.stacja.nr, id: k.ksiega.id, tytul: s.stacja.tytul, tier, cenaEur: tier === 'demo' ? 0 : cena, stron: k.ksiega.stron, manuskrypt: pdf, pergamin: !!(k.pergamin?.pdf || k.pergamin?.svg), spotify: !!k.ksiega.spotify });
                } catch (e) { bledy.push(`Stacja ${s.stacja.nr}: ${tn(e.message, 200)}`); }
            }
            if (zrobione.length) wiesc(`🏛️ Jason: ${zrobione.length} Żywych Ksiąg Opodysku jest w Wypożyczalni teostory.studio (Stacja 1 za darmo, reszta ${cena.toFixed(2)} € / 48 h).`);
            return { zrobione, bledy, uwagi };
        } finally { wystawiana = false; }
    }
    const sciezkaManuskryptu = (k) => (k?.manuskrypt?.plik && sciezkaWydania(k) ? path.join(sciezkaWydania(k), k.manuskrypt.plik) : null);

    // ── 📜 Rolowany Pergamin (TeOfon Scroll): SVG zbudowany w przeglądarce silnikiem partytury → paczka (svg, png, pdf) ──
    /** Treść kodu optycznego stacji. Format `teofon://` jest NASZ — specyfikacji urządzenia TeOfon (TeO Lab) w Katedrze nie ma. */
    function kodPergaminu(k) {
        const tresc = `teofon://opodysk-000g/${k.id}?stacja=${k.stacja.nr}&bpm=${k.stacja.bpm ?? ''}&sek=${Math.round(k.spotify?.master?.sekundy ?? 0)}&tytul=${encodeURIComponent(tn(k.stacja.tytul, 60))}`;
        return { tresc, ...(cfg.qr ? cfg.qr(tresc) : { rozmiar: 0, wiersze: [] }) };
    }
    let drukowany = null;
    async function zapiszPergamin(id, { svg, png = null } = {}) {
        const k = await wczytaj(id), kat = k && sciezkaWydania(k);
        if (!kat || !k.spotify) throw new Error('Pergamin zapisuję w paczce wydawniczej — najpierw „🚀 Przygotuj i wyślij na Spotify”.');
        const { szer, wys } = sprawdzSvg(svg);
        if (drukowany) throw new Error('Most właśnie drukuje inny pergamin — poczekaj chwilę.');
        drukowany = id;
        const praca = path.join(kat, '.pergamin');
        try {
            await fs.mkdir(praca, { recursive: true });
            const pliki = {};
            await fs.writeFile(path.join(kat, PLIKI_PERGAMINU.svg), svg, 'utf8'); pliki.svg = PLIKI_PERGAMINU.svg;
            const m = /^data:image\/png;base64,(.+)$/i.exec(String(png ?? ''));
            if (m) { const b = Buffer.from(m[1], 'base64'); if (b.length > 60 * 1024 * 1024) throw new Error('PNG za duży (limit 60 MB).'); await fs.writeFile(path.join(kat, PLIKI_PERGAMINU.png), b); pliki.png = PLIKI_PERGAMINU.png; }
            let uwaga = null;
            if (cfg.pdf) {
                await fs.writeFile(path.join(praca, 'index.html'), htmlPergaminu(svg, szer, wys), 'utf8');
                const tmp = path.join(kat, `${PLIKI_PERGAMINU.pdf}.tmp.pdf`);
                try { await cfg.pdf({ plikHtml: path.join(praca, 'index.html'), wyjscie: tmp }); await fs.rename(tmp, path.join(kat, PLIKI_PERGAMINU.pdf)); pliki.pdf = PLIKI_PERGAMINU.pdf; }
                catch (e) { await fs.rm(tmp, { force: true }).catch(() => {}); uwaga = `PDF nie powstał: ${tn(e.message, 240)}`; }
            } else uwaga = 'Most nie ma puppeteera (Chrome) — PDF nie powstał; SVG i PNG są w paczce.';
            const k2 = await wczytaj(id);
            for (const p of Object.values(pliki)) if (!k2.spotify.pliki.includes(p)) k2.spotify.pliki.push(p);
            k2.pergamin = { ...pliki, szer, wys, wersja: (Number(k.pergamin?.wersja) || 0) + 1, uwaga, kiedy: new Date().toISOString() };
            await zapisz(k2);
            wiesc(`📜 Jason: Rolowany Pergamin „${k.stacja.tytul}” zapisany (${Math.round(szer)}×${Math.round(wys)} px${pliki.pdf ? ', z PDF' : ''}).`);
            return k2;
        } finally { drukowany = null; await fs.rm(praca, { recursive: true, force: true }).catch(() => {}); }
    }
    const sciezkaPergaminu = (k, rodzaj) => (k?.pergamin?.[rodzaj] && PLIKI_PERGAMINU[rodzaj] && sciezkaWydania(k) ? path.join(sciezkaWydania(k), k.pergamin[rodzaj]) : null);
    const adresyDruku = (k) => { const b = `/api/jason/kampanie/${k.id}`; return {
        ksiega: k.ksiega ? { id: k.ksiega.id, stron: k.ksiega.stron, wystawiona: !!k.ksiega.wystawiona } : null,
        manuskrypt: k.manuskrypt?.plik ? { url: `${b}/manuskrypt?v=${k.manuskrypt.wersja ?? 1}`, aktow: k.manuskrypt.aktow ?? null, bajtow: k.manuskrypt.bajtow ?? null } : null,
        pergamin: k.pergamin ? { ...Object.fromEntries(['svg', 'png', 'pdf'].filter((r) => k.pergamin[r]).map((r) => [r, `${b}/pergamin/${r}?v=${k.pergamin.wersja ?? 1}`])), szer: k.pergamin.szer ?? null, wys: k.pergamin.wys ?? null, uwaga: k.pergamin.uwaga ?? null } : null }; };
    const sciezkaPartytury = (k) => (k?.partytura?.plik && sciezkaWydania(k) ? path.join(sciezkaWydania(k), k.partytura.plik) : null);
    // ── 📱 Spotify Canvas (Suweren 2026-11-14): Teatr nagrywa 8 s płótna 9:16 (pętla domknięta przenikaniem końca w początek), most robi z tego mp4 ──
    let renderowanyCanvas = null;
    /** webm z przeglądarki → `spotify_canvas_9x16_8s.mp4`: 1080×1920, 30 kl/s, H.264, bez dźwięku, DOKŁADNIE 8,0 s (sprawdzane po kodowaniu). */
    async function zapiszCanvas(id, bufor, { wariant = 'fuzja', od = null, trwaloMs = null } = {}) {
        let k = await wczytaj(id);
        const kat = k && sciezkaWydania(k);
        if (!kat || !k.spotify) throw Object.assign(new Error('Canvas zapisuję w paczce wydawniczej — najpierw „🚀 Przygotuj i wyślij na Spotify”.'), { status: 409 });
        if (!WARIANTY_CANVAS.includes(wariant)) throw Object.assign(new Error('Wariant Canvas: fuzja albo teofon.'), { status: 400 });
        if (!cfg.ffmpeg || !cfg.uruchom) throw Object.assign(new Error('Most nie ma podłączonego ffmpeg dla Jasona.'), { status: 409 });
        if (!Buffer.isBuffer(bufor) || bufor.length < 20_000) throw Object.assign(new Error('Nagranie Canvas jest puste albo za małe.'), { status: 400 });
        if (trwaloMs != null && trwaloMs < 7500) throw Object.assign(new Error(`Nagranie trwało ${(trwaloMs / 1000).toFixed(1)} s — Canvas ma 8 s; nie zapisuję urwanego.`), { status: 422 });
        if (renderowanyCanvas) throw Object.assign(new Error('Most właśnie przelicza inny Canvas — poczekaj chwilę.'), { status: 409 });
        renderowanyCanvas = id;
        const praca = path.join(kat, '.canvas');
        try {
            await fs.rm(praca, { recursive: true, force: true }); await fs.mkdir(praca, { recursive: true });
            const we = path.join(praca, 'we.webm'), wy = path.join(praca, 'canvas.mp4');
            await fs.writeFile(we, bufor);
            await cfg.uruchom(cfg.ffmpeg, ['-loglevel', 'error', '-y', '-i', we, '-vf', 'fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,tpad=stop_mode=clone:stop_duration=2,trim=duration=8,setpts=PTS-STARTPTS',
                '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', wy], { windowsHide: true, timeout: 5 * 60_000, maxBuffer: 1 << 24 });
            const sekundy = await dlugoscPliku(cfg.ffmpeg, cfg.uruchom, wy);
            if (!(sekundy > 7.9 && sekundy < 8.1)) throw Object.assign(new Error(`Po przeliczeniu Canvas trwa ${sekundy ?? '?'} s, a ma 8,0 — nie zapisuję.`), { status: 422 });
            const cel = path.join(kat, PLIK_CANVAS);
            await fs.rename(wy, cel).catch(async () => { await fs.copyFile(wy, cel); });
            const bajtow = (await fs.stat(cel)).size;
            k = await wczytaj(id);
            if (!k.spotify.pliki.includes(PLIK_CANVAS)) k.spotify.pliki.push(PLIK_CANVAS);
            k.canvas = { plik: PLIK_CANVAS, wariant, od: Number.isFinite(Number(od)) ? Math.round(Number(od) * 100) / 100 : null, sekundy: 8, bajtow, wersja: (Number(k.canvas?.wersja) || 0) + 1, kiedy: new Date().toISOString() };
            await zapisz(k);
            wiesc(`📱 Jason: Spotify Canvas „${k.stacja.tytul}” (${wariant === 'teofon' ? 'skaner pergaminu' : 'fuzja partytury'}, 8 s · 9:16) gotowy — _OtakOs_Muzyka/${k.spotify.folder}/${PLIK_CANVAS}. Wgrywasz w Spotify for Artists → Add Canvas.`);
            return k;
        } finally { renderowanyCanvas = null; await fs.rm(praca, { recursive: true, force: true }).catch(() => {}); }
    }
    const sciezkaCanvasu = (k) => (k?.canvas?.plik && sciezkaWydania(k) ? path.join(sciezkaWydania(k), k.canvas.plik) : null);
    /** 🟢 Adres Spotify stacji: jej własny, a gdy go nie ma — adres całego albumu (jedno pole dla wszystkich dziesięciu). */
    const spotifyLive = (k, u) => { const wlasny = u.spotify?.utwory?.[k.stacja.nr] ?? null, url = wlasny ?? u.spotify?.album ?? null, sp = spotifyZAdresu(url); return sp ? { ...sp, zrodlo: wlasny ? 'utwor' : 'album' } : null; };
    /** Odznaka Spotify w katalogu Wypożyczalni dla każdej stacji, która ma już księgę (po wklejeniu / zmianie adresu). Błąd nie psuje zapisu ustawień. */
    async function synchronizujSpotify() {
        if (!cfg.wypozyczalnia?.ustawSpotify) return 0;
        const u = await ustawienia(); let n = 0;
        for (const k of await lista()) { if (!k.ksiega?.id || k.stan !== 'przyjeta') continue; const sp = spotifyLive(k, u); if (await cfg.wypozyczalnia.ustawSpotify(k.ksiega.id, sp?.url ?? null).catch(() => null)) n++; }
        return n;
    }
    const sciezkaAudio = (k) => (sciezkaWydania(k) ? path.join(sciezkaWydania(k), 'original.mp3') : null);
    async function pokazOpodysk(id) {
        const p = sciezkaOpodysku(await wczytaj(id));
        if (!p || !(await jestPlik(p))) throw new Error('Ta kampania nie ma jeszcze Opodysku.');
        if (!cfg.pokaz && !cfg.otworz) throw new Error('Most nie umie pokazać pliku na tej maszynie.');
        await (cfg.pokaz ? cfg.pokaz(p) : cfg.otworz(path.dirname(p)));
        return p;
    }
    /** 🎭 Katalog muzycznych opowieści albumu — dla Teatru Opodysku w TeO Story i Biblioteki Żywych Ksiąg (najnowsza przyjęta kampania każdej stacji z paczką). */
    async function opodyski() {
        const u = await ustawienia(), widziane = new Set(), utwory = [];
        for (const k of await lista()) {
            if (k.stan !== 'przyjeta' || !k.spotify || widziane.has(k.stacja.nr)) continue;
            widziane.add(k.stacja.nr);
            const b = `/api/jason/kampanie/${k.id}`;
            utwory.push({ id: k.id, nr: k.stacja.nr, tytul: k.stacja.tytul, album: k.album, artysci: k.artysci, glos: k.glos?.nazwa ?? null, bpm: k.stacja.bpm ?? null, sekundy: k.spotify.master?.sekundy ?? null,
                okladka: k.spotify.okladka ? `${b}/spotify/okladka?v=${k.okladka?.wersja ?? 1}` : null, audio: `${b}/audio`,
                storyboard: k.teoStory?.storyboard ? { scen: k.teoStory.scen ?? null, url: `${b}/storyboard` } : null, serial: k.teoStory?.serial ?? null,
                opodysk: k.opodysk?.plik ? { url: `${b}/opodysk/wideo?v=${k.opodysk.wersja ?? 1}`, sekundy: k.opodysk.sekundy ?? null, stan: k.opodysk.stan } : null,
                partytura: k.partytura?.plik ? { url: `${b}/opodysk/partytura/wideo?v=${k.partytura.wersja ?? 1}`, sekundy: k.partytura.sekundy ?? null } : null,
                ...glosyKampanii(k), ...adresyDruku(k),
                canvas: k.canvas?.plik ? { url: `${b}/canvas/wideo?v=${k.canvas.wersja ?? 1}`, sekundy: k.canvas.sekundy ?? 8, wariant: k.canvas.wariant ?? null, od: k.canvas.od ?? null } : null, spotifyLive: spotifyLive(k, u),
                wypozyczalnia: k.wypozyczalnia ?? null, spotify: u.spotify.utwory[k.stacja.nr] ?? null, suno: k.wybrana?.id ? linkOdsluchu(k.wybrana.id) : null });
        }
        utwory.sort((a, b) => a.nr - b.nr);
        return { album: utwory[0]?.album ?? ALBUM, spotifyAlbum: u.spotify.album, utwory };
    }
    // ── 👕 Gablota TeO Wear / 0.00G Merch — pozycje dodaje Suweren (żadnych wymyślonych produktów) ──
    const plikGabloty = path.join(cfg.katalog, 'jason', 'gablota.json');
    async function gablota() { try { const d = JSON.parse(await fs.readFile(plikGabloty, 'utf8')); return Array.isArray(d?.pozycje) ? d.pozycje : []; } catch { return []; } }
    const oczyscPozycje = (z = {}) => {
        const nazwa = tn(z.nazwa, 80);
        if (!nazwa) throw new Error('Pozycja kolekcji potrzebuje nazwy.');
        const https = (x, co) => { const a = String(x ?? '').trim(); if (a && !/^https:\/\/[^\s]{4,400}$/.test(a)) throw new Error(`${co} musi zaczynać się od https://`); return a; };
        const obraz = /^stacja:\d{1,2}$/.test(String(z.obraz ?? '').trim()) ? String(z.obraz).trim() : https(z.obraz, 'Adres obrazu');   // `stacja:3` = okładka stacji jako motyw
        return { nazwa, opis: tn(z.opis, 400), motyw: tn(z.motyw, 80), cena: tn(z.cena, 30), link: https(z.link, 'Link do sklepu'), obraz };
    };
    let kolejkaGabloty = Promise.resolve();
    const zmienGablote = (fn) => { const p = kolejkaGabloty.then(async () => { const l = await fn(await gablota()); await fs.mkdir(path.dirname(plikGabloty), { recursive: true }); await fs.writeFile(plikGabloty, JSON.stringify({ pozycje: l }, null, 2)); return l; }); kolejkaGabloty = p.catch(() => {}); return p; };
    const dodajDoGabloty = (z) => { const p = oczyscPozycje(z); return zmienGablote((l) => [...l, { id: `g-${crypto.randomBytes(3).toString('hex')}`, ...p, dodano: new Date().toISOString() }]); };
    const zmienWGablocie = (id, z) => { const p = oczyscPozycje(z); return zmienGablote((l) => { if (!l.some((x) => x.id === id)) throw Object.assign(new Error('Nie ma takiej pozycji.'), { kod: 404 }); return l.map((x) => (x.id === id ? { ...x, ...p } : x)); }); };
    const usunZGabloty = (id) => zmienGablote((l) => { if (!l.some((x) => x.id === id)) throw Object.assign(new Error('Nie ma takiej pozycji.'), { kod: 404 }); return l.filter((x) => x.id !== id); });

    // ── 📚 Opodysk jako Żywa Księga w Wypożyczalni teostory.studio ──
    const plikAktu = (nr) => `teatr/akt-${String(nr).padStart(2, '0')}.mp3`;
    /** Strony księgi z aktów storyboardu: klatka, wersy (ujęcie bez słów → opis obrazu), fragment utworu jako nagranie strony. */
    async function stronyOpodysku(k, { przedrostek = '' } = {}) {
        const sb = await czytajStoryboard(k), kat = sciezkaWydania(k);
        if (!sb) throw new Error(`„${k.stacja.tytul}” nie ma storyboardu — najpierw „🎬 Projektuj Teledysk w TeO Story”.`);
        const brak = [];
        for (const sc of sb.sceny) if (!(await maKlatke(kat, sc))) brak.push(sc.nr);
        if (brak.length) throw new Error(`„${k.stacja.tytul}”: ujęcia ${brak.join(', ')} nie mają klatek 16:9 — „🎞️ Nakręć Opodysk” dorysuje je i wtedy wystawisz spektakl.`);
        const master = path.join(kat, 'master.wav');
        if (!(await jestPlik(master))) throw new Error(`„${k.stacja.tytul}”: w paczce nie ma master.wav.`);
        await fs.mkdir(path.join(kat, 'teatr'), { recursive: true });
        const strony = [];
        for (const sc of sb.sceny) {
            const rel = plikAktu(sc.nr), cel = path.join(kat, ...rel.split('/'));
            // fragment utworu dla aktu — cięty dokładnie (po dekodowaniu), mp3 192 kb/s
            await cfg.uruchom(cfg.ffmpeg, ['-loglevel', 'error', '-y', '-i', master, '-ss', String(sc.od), '-t', String(Math.round((sc.do - sc.od) * 1000) / 1000), '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', cel], { maxBuffer: 1 << 24, timeout: 5 * 60_000, windowsHide: true });
            strony.push({ chapterTitle: `${przedrostek}Act ${sc.nr} · ${sc.sekcja}`, imageCaption: sc.sekcja, narrativeText: sc.wersy.length ? sc.wersy.join('\n') : sc.obraz, dialogueLines: [], bpm: sb.bpm ?? null,
                imageUrl: `/api/jason/kampanie/${k.id}/storyboard/kadr/${sc.kadry['16:9'].plik.split('/').pop()}`, audioUrl: `/api/jason/kampanie/${k.id}/${rel}` });
        }
        return { strony, sb };
    }
    const sprawdzWydanie = (tier, cenaEur) => {
        if (!cfg.wypozyczalnia?.publikuj) throw new Error('Most nie ma podłączonej Wypożyczalni teostory.studio.');
        if (!cfg.ffmpeg || !cfg.uruchom) throw new Error('Most nie ma podłączonego ffmpeg dla Jasona.');
        if (!['demo', 'rental_48h'].includes(tier)) throw new Error('Poziom: demo (za darmo) albo rental_48h (wypożyczenie na 48 h).');
        const cena = Math.round(Number(cenaEur) * 100) / 100;
        if (tier === 'rental_48h' && !(cena >= 0.5 && cena <= 100)) throw new Error('Cena wypożyczenia: 0,50–100 €.');
        return cena;
    };
    /** 📚 Wydanie jednego Opodysku do Wypożyczalni. Bez `tier`: Stacja 1 = darmowy prolog, pozostałe = wypożyczenie 48 h. */
    async function wydajDoWypozyczalni(id, { tier = null, cenaEur = 1.99 } = {}) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        const poziom = tier ?? (k.stacja.nr === 1 ? 'demo' : 'rental_48h');
        const cena = sprawdzWydanie(poziom, cenaEur);
        if (k.stan !== 'przyjeta' || !k.spotify) throw new Error('Spektakl wydaję z gotowej paczki wydawniczej.');
        const { strony, sb } = await stronyOpodysku(k);
        const book = { id: `opodysk-${String(k.stacja.nr).padStart(2, '0')}-${nazwaFolderu(k.stacja.tytul).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)}`,
            title: k.stacja.tytul, subtitle: `${k.artysci.join(' & ')} · ${k.album}`, author: k.artysci.join(' & '), narrator: k.artysci.join(' & '), language: 'en', sourceType: 'opodysk',
            opodysk: { album: k.album, stacja: k.stacja.nr, bpm: sb.bpm ?? null, sekundy: sb.sekundy ?? null, aktow: sb.sceny.length }, characters: [], pages: strony };
        const wpis = await cfg.wypozyczalnia.publikuj({ book, rentalTier: poziom, cenaEur: cena });
        k.wypozyczalnia = { id: wpis.id, tier: poziom, cenaEur: poziom === 'demo' ? 0 : cena, aktow: strony.length, wystawiona: wpis.wystawiona !== false, kiedy: new Date().toISOString() };
        await zapisz(k);
        wiesc(`📚 Jason: spektakl Opodysku „${k.stacja.tytul}” jest w Wypożyczalni teostory.studio (${poziom === 'demo' ? 'za darmo' : `${cena.toFixed(2)} € / 48 h`}, ${strony.length} aktów).`);
        return k;
    }
    /** 🎭 Cały album jako jeden spektakl: wszystkie stacje z paczką muszą mieć komplet klatek (inaczej odmowa z listą braków). */
    async function wydajAlbum({ tier = 'rental_48h', cenaEur = 4.99 } = {}) {
        const cena = sprawdzWydanie(tier, cenaEur);
        const widziane = new Set(), ks = [];
        for (const k of await lista()) { if (k.stan !== 'przyjeta' || !k.spotify || widziane.has(k.stacja.nr)) continue; widziane.add(k.stacja.nr); ks.push(k); }
        ks.sort((a, b) => a.stacja.nr - b.stacja.nr);
        if (ks.length < 2) throw new Error('Spektakl albumu potrzebuje co najmniej dwóch stacji z paczką wydawniczą.');
        const pages = [], bledy = [];
        for (const k of ks) { try { pages.push(...(await stronyOpodysku(k, { przedrostek: `${String(k.stacja.nr).padStart(2, '0')} ${k.stacja.tytul} — ` })).strony); } catch (e) { bledy.push(e.message); } }
        if (bledy.length) throw new Error(`Album nie jest gotowy do wystawienia: ${bledy.join(' | ')}`);
        const album = ks[0].album, artysci = [...new Set(ks.flatMap((k) => k.artysci))];
        const book = { id: 'opodysk-album-zero-gravity-heart', title: `${album.replace(/\s*\(.*\)\s*$/, '')} — 0.00G Musical Theatre`, subtitle: `${artysci.join(' & ')} · ${ks.length} songs`, author: artysci.join(' & '), narrator: artysci.join(' & '),
            language: 'en', sourceType: 'opodysk', opodysk: { album, stacji: ks.length, aktow: pages.length }, characters: [], pages };
        const wpis = await cfg.wypozyczalnia.publikuj({ book, rentalTier: tier, cenaEur: cena });
        wiesc(`📚 Jason: spektakl albumu „${book.title}” jest w Wypożyczalni teostory.studio (${ks.length} utworów, ${pages.length} aktów).`);
        return { id: wpis.id, tytul: book.title, stacji: ks.length, aktow: pages.length, tier, cenaEur: tier === 'demo' ? 0 : cena, wystawiona: wpis.wystawiona !== false };
    }
    /** Adres mostu → plik w paczce (Wypożyczalnia kopiuje klatki i nagrania aktów do księgi przy publikacji). Tylko klatki i akty. */
    function plikZAdresu(adres) {
        const m = /^\/api\/jason\/kampanie\/(j-[0-9a-f]{8})\/(?:storyboard\/kadr\/(scena-\d{1,2}-16x9\.png)|teatr\/(akt-\d{2}\.mp3))$/.exec(String(adres ?? ''));
        if (!m || !cfg.katalogMuzyki) return null;
        let k; try { k = JSON.parse(fsSync.readFileSync(plik(m[1]), 'utf8')); } catch { return null; }
        const kat = sciezkaWydania(k);
        if (!kat) return null;
        const p = m[2] ? path.join(kat, 'storyboard', m[2]) : path.join(kat, 'teatr', m[3]);
        return fsSync.existsSync(p) ? p : null;
    }

    const sciezkaKadru = (k, plik) => (/^scena-\d{1,2}-(16x9|9x16)\.png$/.test(String(plik)) && sciezkaWydania(k) ? path.join(sciezkaWydania(k), 'storyboard', plik) : null);

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

    return { wykonaj, ponow, rozstrzygnij, przerysujOkladke, _czekajOkladki: (id) => rysowane.get(id) ?? Promise.resolve(), przygotujSpotify, pominSpotify, otworzFolder, teoStory, storyboard, kadrSceny, sciezkaKadru, opodysk, pokazOpodysk, sciezkaOpodysku, zapiszPartyture, sciezkaPartytury, ustawLektora, ustawAtmosfere, glosyKampanii, zlozKsiege, zlozManuskrypt, zlozKsiegeIManuskrypt, zlozWszystkieKsiegi, wystawWszystkie, zapiszCanvas, sciezkaCanvasu, synchronizujSpotify, spotifyLive, sciezkaManuskryptu, kodPergaminu, zapiszPergamin, sciezkaPergaminu, wydajDoWypozyczalni, wydajAlbum, plikZAdresu, sciezkaAudio, opodyski, ustaw, gablota, dodajDoGabloty, zmienWGablocie, usunZGabloty, _czekajKolejki: () => kolejka, stacje, dodajStacje, usunStacje, sciezkaWydania, ustawienia, ustawDystrybutora, lista, kampania: wczytaj, glosy: listaGlosow, sciezkaOkladki, zrodloIzby, _czekaj: (id) => wRobocie.get(id) ?? Promise.resolve() };
}

/** Trasy. `dostep(req, res)` = maszyna albo sparowany telefon (Stół Narad w StoL); Straż wpuszcza z telefonu tylko start i odczyt. */
export function zamontujTrasyJasona(app, J, { dostep = async () => ({ urzadzenie: null }), raw = null } = {}) {
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
    // 🎬 teledysk: storyboard 0.00G w paczce + projekt w TeO Story Studio (nic nie kosztuje — maszyna albo sparowany telefon)
    app.post('/api/jason/kampanie/:id/teo-story', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        try { res.json({ success: true, ...(await J.teoStory(req.params.id, { odNowa: req.body?.odNowa === true })) }); } catch (e) { blad(res, e); }
    });
    app.get('/api/jason/kampanie/:id/storyboard', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        try { res.json({ success: true, storyboard: await J.storyboard(req.params.id) }); } catch (e) { blad(res, e); }
    });
    // 🎨 klatki ujęć od Palety (FLUX — tylko maszyna): {scena: numer | 'wszystkie', format: '16:9' | '9:16', wzor?: true = okładka jako wzór}
    app.post('/api/jason/kampanie/:id/storyboard/kadr', async (req, res) => { try { res.json({ success: true, storyboard: await J.kadrSceny(req.params.id, { scena: req.body?.scena ?? 'wszystkie', format: req.body?.format ?? '16:9', wzor: req.body?.wzor === true }) }); } catch (e) { blad(res, e); } });
    app.get('/api/jason/kampanie/:id/storyboard/kadr/:plik', async (req, res) => {
        const p = J.sciezkaKadru(await J.kampania(req.params.id), req.params.plik);
        return p && await fs.access(p).then(() => true, () => false) ? res.sendFile(p) : res.status(404).json({ success: false, message: 'Nie ma takiej klatki.' });
    });
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
    app.put('/api/jason/ustawienia', async (req, res) => { try { res.json({ success: true, ustawienia: await J.ustaw(req.body ?? {}) }); } catch (e) { blad(res, e); } });
    // 🎞️ Opodysk: {napisy?: false} — dorysowanie brakujących klatek 16:9 i montaż ffmpeg w tle (tylko maszyna: GPU i długi ffmpeg)
    app.post('/api/jason/kampanie/:id/opodysk', async (req, res) => { try { res.json({ success: true, kampania: await J.opodysk(req.params.id, { napisy: req.body?.napisy !== false }) }); } catch (e) { blad(res, e); } });
    app.post('/api/jason/kampanie/:id/opodysk/pokaz', async (req, res) => { try { res.json({ success: true, plik: await J.pokazOpodysk(req.params.id) }); } catch (e) { blad(res, e); } });
    app.get('/api/jason/kampanie/:id/opodysk/wideo', async (req, res) => {
        const p = J.sciezkaOpodysku(await J.kampania(req.params.id));
        return p && await fs.access(p).then(() => true, () => false) ? res.sendFile(p) : res.status(404).json({ success: false, message: 'Ta kampania nie ma jeszcze Opodysku.' });
    });
    // 🎼 Opodysk z partyturą 0.00G: surowe nagranie płótna Teatru (video/webm) → mp4 w paczce; tylko maszyna (Straż /api/jason/)
    if (raw) app.post('/api/jason/kampanie/:id/opodysk/partytura', raw({ type: ['video/*', 'application/octet-stream'], limit: '1500mb' }), async (req, res) => {
        try { const k = await J.zapiszPartyture(req.params.id, req.body, String(req.headers['content-type'] || 'video/webm')); res.json({ success: true, partytura: k.partytura }); } catch (e) { blad(res, e); }
    });
    app.get('/api/jason/kampanie/:id/opodysk/partytura/wideo', async (req, res) => {
        const p = J.sciezkaPartytury(await J.kampania(req.params.id));
        return p && await fs.access(p).then(() => true, () => false) ? res.sendFile(p) : res.status(404).json({ success: false, message: 'Ta kampania nie ma jeszcze nagrania z partyturą.' });
    });
    // 📖 Żywa Księga + Manuskrypt PDF z Opodysku (tylko maszyna): księga zawsze, PDF gdy Chrome jest; `/ksiegi` = wszystkie stacje do listy Żywych Wpisów
    app.post('/api/jason/kampanie/:id/ksiega', async (req, res) => { try { res.json({ success: true, ...(await J.zlozKsiegeIManuskrypt(req.params.id)) }); } catch (e) { blad(res, e); } });
    app.post('/api/jason/opodyski/ksiegi', async (_req, res) => { try { res.json({ success: true, ...(await J.zlozWszystkieKsiegi()) }); } catch (e) { blad(res, e); } });
    // 🏛️ Wystaw wszystkie Żywe Księgi Opodysku w Wypożyczalni (publiczne!): Stacja 1 = darmowy Prolog, reszta wypożyczenie 48 h za `cenaEur`
    app.post('/api/jason/opodyski/wystaw', async (req, res) => { try { res.json({ success: true, ...(await J.wystawWszystkie({ cenaEur: req.body?.cenaEur ?? 1.99 })) }); } catch (e) { blad(res, e); } });
    // 📱 Spotify Canvas 8 s · 9:16: surowe nagranie płótna (video/webm) → mp4 w paczce; `?wariant=fuzja|teofon&od=<sek>&ms=<czas nagrania>`
    if (raw) app.post('/api/jason/kampanie/:id/canvas', raw({ type: ['video/*', 'application/octet-stream'], limit: '400mb' }), async (req, res) => {
        try { const k = await J.zapiszCanvas(req.params.id, req.body, { wariant: String(req.query.wariant ?? 'fuzja'), od: req.query.od ?? null, trwaloMs: req.query.ms != null ? Number(req.query.ms) : null }); res.json({ success: true, canvas: k.canvas }); } catch (e) { blad(res, e); }
    });
    app.get('/api/jason/kampanie/:id/canvas/wideo', async (req, res) => {
        const p = J.sciezkaCanvasu(await J.kampania(req.params.id));
        return p && await fs.access(p).then(() => true, () => false) ? res.sendFile(p) : res.status(404).json({ success: false, message: 'Ta kampania nie ma jeszcze Spotify Canvas.' });
    });
    app.get('/api/jason/kampanie/:id/manuskrypt', async (req, res) => {
        const p = J.sciezkaManuskryptu(await J.kampania(req.params.id));
        return p && await fs.access(p).then(() => true, () => false) ? res.sendFile(p) : res.status(404).json({ success: false, message: 'Ta kampania nie ma jeszcze manuskryptu PDF.' });
    });
    // 📜 Rolowany Pergamin: kod QR stacji (moduły do SVG), zapis wstęgi z przeglądarki, pliki do pobrania
    app.get('/api/jason/kampanie/:id/pergamin/kod', async (req, res) => { try { const k = await J.kampania(req.params.id); if (!k?.spotify) throw new Error('Pergamin potrzebuje paczki wydawniczej stacji.'); res.json({ success: true, ...J.kodPergaminu(k) }); } catch (e) { blad(res, e); } });
    app.post('/api/jason/kampanie/:id/pergamin', async (req, res) => { try { const k = await J.zapiszPergamin(req.params.id, req.body ?? {}); res.json({ success: true, pergamin: k.pergamin }); } catch (e) { blad(res, e); } });
    app.get('/api/jason/kampanie/:id/pergamin/:rodzaj', async (req, res) => {
        const p = ['svg', 'png', 'pdf'].includes(req.params.rodzaj) ? J.sciezkaPergaminu(await J.kampania(req.params.id), req.params.rodzaj) : null;
        return p && await fs.access(p).then(() => true, () => false) ? res.sendFile(p) : res.status(404).json({ success: false, message: 'Ta kampania nie ma jeszcze takiego pliku pergaminu.' });
    });
    app.get('/api/jason/kampanie/:id/audio', async (req, res) => {
        const p = J.sciezkaAudio(await J.kampania(req.params.id));
        return p && await fs.access(p).then(() => true, () => false) ? res.sendFile(p) : res.status(404).json({ success: false, message: 'Ta kampania nie ma paczki z utworem.' });
    });
    // 📚 Opodysk do Wypożyczalni teostory.studio (tylko maszyna): {tier?: 'demo' | 'rental_48h', cenaEur?} — publikacja wystawia pozycję publicznie
    app.post('/api/jason/kampanie/:id/wypozyczalnia', async (req, res) => { try { res.json({ success: true, kampania: await J.wydajDoWypozyczalni(req.params.id, { tier: req.body?.tier ?? null, cenaEur: req.body?.cenaEur ?? 1.99 }) }); } catch (e) { blad(res, e); } });
    app.post('/api/jason/opodyski/album', async (req, res) => { try { res.json({ success: true, spektakl: await J.wydajAlbum({ tier: req.body?.tier ?? 'rental_48h', cenaEur: req.body?.cenaEur ?? 4.99 }) }); } catch (e) { blad(res, e); } });
    // 🎭 katalog muzycznych opowieści (Teatr Opodysku w TeO Story, Biblioteka Żywych Ksiąg) i 👕 gablota TeO Wear
    app.get('/api/jason/opodyski', async (_req, res) => { try { res.json({ success: true, ...(await J.opodyski()) }); } catch (e) { blad(res, e); } });
    app.get('/api/jason/gablota', async (_req, res) => res.json({ success: true, pozycje: await J.gablota() }));
    app.post('/api/jason/gablota', async (req, res) => { try { res.json({ success: true, pozycje: await J.dodajDoGabloty(req.body ?? {}) }); } catch (e) { blad(res, e); } });
    app.put('/api/jason/gablota/:id', async (req, res) => { try { res.json({ success: true, pozycje: await J.zmienWGablocie(req.params.id, req.body ?? {}) }); } catch (e) { blad(res, e); } });
    app.delete('/api/jason/gablota/:id', async (req, res) => { try { res.json({ success: true, pozycje: await J.usunZGabloty(req.params.id) }); } catch (e) { blad(res, e); } });
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
