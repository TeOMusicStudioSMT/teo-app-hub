/**
 * 🎬 Storyboard 0.00G teledysku (Suweren 2026-11-13: „most Jason → TeO Story Studio… 5 scen dopasowanych do tekstu
 * i klimatu StarLight Diner 0.00G… prompt 16:9 i 9:16”).
 *
 * BEZ modelu językowego — jak cały Jason: sceny liczy KOD z tekstu stacji.
 *   • sekcje bierze z tagów tekstu (`[Intro - …]`, `[Verse 1 - Kael: …]`, `[Chorus]`, `[Bridge]`, `[Outro - …]`),
 *   • pięć scen: Intro, Verse 1, Chorus, Verse 2, Outro; gdy utwór nie ma drugiej zwrotki, czwartą scenę niesie
 *     Bridge → Pre-Chorus → powtórka refrenu (pole `zrodlo` mówi, skąd wzięto wersy),
 *   • obraz sceny = motywy rozpoznane w JEJ wersach (deszcz, filiżanka, świeca, świt…) z zamkniętej listy `MOTYWY`,
 *     bez powtórek między scenami; bez świeżego trafienia — motyw domyślny sceny,
 *   • czasy scen: udział w długości utworu, granice dociągnięte do pełnych taktów 4/4 z BPM stacji.
 * Prompty są po angielsku (generatory wideo), opis sceny po polsku. Na ekranie NIE MA napisów — mówi to każdy prompt.
 */

export const KLIMAT_TELEDYSKU = 'StarLight Diner 0.00G: interior of a late-night retro diner, a deep red velvet booth beside a rain-streaked window, '
    + 'one warm amber table lamp, two porcelain coffee cups, zero gravity inside the room: coffee droplets and curls of steam float weightless in slow motion, '
    + 'raindrops slide down the glass in slow motion, blurry city bokeh outside in the night, 35mm film grain, shallow depth of field, intimate mood, '
    + 'strictly no text, no letters, no captions, no subtitles, no neon words, no signage, no logos';

/** Postacie — fikcyjni artyści albumu; opis trzyma tę samą parę w każdej scenie (klatka bazowa = okładka stacji). */
export const POSTACIE = {
    Elara: 'Elara, a woman in her early thirties with long wavy chestnut hair and a dark silk blouse',
    Kael: 'Kael, a man in his mid thirties with short dark hair, light stubble and a charcoal knit sweater',
};

export const FORMATY = {
    '16:9': { szer: 1280, wys: 720, cel: 'YouTube Music Video' },
    '9:16': { szer: 720, wys: 1280, cel: 'Spotify Canvas', petlaSekund: 8 },
};

/** Pięć scen: udział w długości utworu, ruch kamery 16:9, ruch pętli 9:16, motyw domyślny, opis po polsku. */
export const SCENY = [
    { sekcja: 'Intro', waga: 0.10, kamera: 'slow dolly-in from the dim empty diner toward the lit booth', petla: 'steam and droplets rising and settling in a perfect cycle',
        domyslny: 'the two cups on the table, the first drops of coffee lifting off the surface as gravity lets go', pl: 'Wejście: pusty bar nocą, kamera płynie do loży; grawitacja puszcza.' },
    { sekcja: 'Verse 1', waga: 0.26, kamera: 'intimate medium close-up with a gentle handheld drift', petla: 'a slow breath and a blink, droplets orbiting in a closed loop',
        domyslny: 'a quiet look across the table, lamp light warm on the face', pl: 'Pierwsza zwrotka: bliski plan śpiewającej postaci.' },
    { sekcja: 'Chorus', waga: 0.22, kamera: 'slow 180-degree orbit around the booth', petla: 'droplets and steam circling the lamp once and returning to the same place',
        domyslny: 'everything on the table rising weightless around them, amber light refracting through the floating coffee droplets', pl: 'Refren: pełna nieważkość, kamera okrąża lożę.' },
    { sekcja: 'Verse 2', waga: 0.24, kamera: 'over-the-shoulder close-up, rack focus from floating droplets to the eyes', petla: 'fingertips drifting closer and apart again in a seamless cycle',
        domyslny: 'a single coffee droplet drifting slowly between their faces, the lamp light caught inside it', pl: 'Druga zwrotka: przez ramię, ostrość z kropli na oczy.' },
    { sekcja: 'Outro', waga: 0.18, kamera: 'slow pull-back and upward drift as the light softens', petla: 'the lamp glow breathing dimmer and brighter, droplets sinking and rising',
        domyslny: 'the droplets settling gently back toward the cups, the booth glowing alone in the dark room', pl: 'Wyjście: kamera odpływa, światło gaśnie, krople opadają.' },
];

/** Motywy z tekstu → obraz. Kolejność = pierwszeństwo; scena bierze najwyżej dwa. Żadnych szyldów ani cyfr w kadrze. */
export const MOTYWY = [
    [/\b(rain|raindrops?|thunder|mist)\b/i, 'raindrops crawling down the window glass in extreme slow motion, each one catching amber light'],
    [/\b(cups?|coffee|espresso|pour|steam|porcelain)\b/i, 'coffee droplets and curls of steam lifting out of the porcelain cups and hovering weightless above the table'],
    [/\b(candle|flame)\b/i, 'a single candle flame bending slowly in the still air'],
    [/\bshadows?\b/i, 'their two shadows on the wall slowly drawing closer until they merge'],
    [/\b(dawn|sunrise|horizon|first ray|morning light)\b|sky turns blue/i, 'the first pale blue-gold light of dawn slowly filling the window'],
    [/\b(hands?|fingers?|fingertips|skin|touch|lips|embrace)\b/i, 'their hands resting an inch apart on the wooden table, fingertips slowly closing the distance'],
    [/\b(radio|static|frequency|voltage)\b/i, 'a vintage radio dial glowing softly, fine golden dust shimmering in the air like static'],
    [/\b(stars?|stardust|comets?|moonlight|moon)\b/i, 'tiny glints of light like stardust suspended in the air around them'],
    [/\b(neon|city|headlights?|street|chrome)\b/i, 'soft out-of-focus city lights drifting past outside the window like slow comets'],
    [/\b(clock|eleven|hours?|time)\b/i, 'time standing still: dust motes frozen mid-air in the beam of the lamp'],
    [/\b(door|key|lock|chairs?|bartender)\b/i, 'the empty diner around them, chairs resting upturned on the tables, only their booth lit'],
    [/\b(whisper|breath|breathing|sigh)\b/i, 'a slow exhale visible in the warm light, close enough to feel'],
];

const tn = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Rodzaj sekcji z jej nazwy w tagu. */
export function rodzajSekcji(nazwa) {
    const n = String(nazwa).toLowerCase();
    if (/^intro/.test(n)) return 'intro';
    if (/^pre[- ]?chorus/.test(n)) return 'prechorus';
    if (/^(chorus|refren|hook)/.test(n)) return 'chorus';
    if (/^(verse|zwrotka)/.test(n)) return 'verse';
    if (/^bridge/.test(n)) return 'bridge';
    if (/^outro/.test(n)) return 'outro';
    return 'inna';
}

/** Tekst z tagami → sekcje [{ nazwa, rodzaj, kto, nuta, wersy }] (wersy bez etykiet mówców `(Kael:)`). */
export function sekcjeTekstu(lyrics) {
    const sekcje = [];
    let s = null;
    for (const surowa of String(lyrics ?? '').split(/\r?\n/)) {
        const m = /^\s*\[([^\]]+)\]\s*$/.exec(surowa);
        if (m) {
            const [nazwa, ...reszta] = m[1].split(/\s+-\s+/);
            const opis = reszta.join(' - ').trim();
            const k = /^([^:]{2,40}):\s*(.*)$/.exec(opis);
            s = { nazwa: tn(nazwa, 40), rodzaj: rodzajSekcji(nazwa), kto: k ? tn(k[1], 40) : '', nuta: tn(k ? k[2] : opis, 240), wersy: [] };
            sekcje.push(s);
            continue;
        }
        const w = surowa.replace(/\[[^\]]*\]/g, ' ').replace(/\(\s*[^():]{1,40}:\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
        if (!w) continue;
        if (!s) { s = { nazwa: 'Verse 1', rodzaj: 'verse', kto: '', nuta: '', wersy: [] }; sekcje.push(s); }
        s.wersy.push(w);
    }
    return sekcje;
}

/** Która sekcja tekstu niesie którą z pięciu scen (indeks w `sekcje` albo -1). */
export function przydzialScen(sekcje) {
    const pierwsza = (r, od = 0) => sekcje.findIndex((x, i) => i >= od && x.rodzaj === r);
    const intro = pierwsza('intro'), v1 = pierwsza('verse'), chorus = pierwsza('chorus');
    let v2 = v1 >= 0 ? pierwsza('verse', v1 + 1) : -1;
    if (v2 < 0) v2 = pierwsza('bridge');
    if (v2 < 0) v2 = pierwsza('prechorus');
    if (v2 < 0) v2 = chorus >= 0 ? sekcje.findIndex((x, i) => i > chorus && x.rodzaj === 'chorus') : -1;
    if (v2 < 0) v2 = chorus;   // utwór z jedną zwrotką i jednym refrenem: czwarta scena wraca do refrenu
    let outro = pierwsza('outro');
    if (outro < 0) outro = sekcje.length - 1;
    return [intro, v1, chorus, v2, outro];
}

/** Granice scen w sekundach: udziały z `SCENY`, dociągnięte do pełnych taktów 4/4 (gdy znamy BPM). */
export function czasyScen(sekundy, bpm) {
    const calosc = Math.max(10, Number(sekundy) || 180);
    const takt = Number(bpm) > 0 ? 240 / Number(bpm) : 0;
    const granice = [0];
    let suma = 0;
    for (const sc of SCENY.slice(0, -1)) {
        suma += sc.waga;
        let t = suma * calosc;
        if (takt) t = Math.max(granice[granice.length - 1] + takt, Math.round(t / takt) * takt);
        granice.push(Math.min(t, calosc - 1));
    }
    granice.push(calosc);
    const r1 = (x) => Math.round(x * 10) / 10;
    return SCENY.map((_, i) => ({ od: r1(granice[i]), do: r1(granice[i + 1]), sekundy: r1(granice[i + 1] - granice[i]) }));
}

/** Do dwóch motywów obrazu rozpoznanych w wersach sceny. */
export function motywyZWersow(wersy, ile = 2) {
    const tekst = (wersy ?? []).join(' \n ');
    return MOTYWY.filter(([wzor]) => wzor.test(tekst)).slice(0, ile).map(([, obraz]) => obraz);
}

/** Kto jest w centrum sceny: mówca z tagu → jedyny artysta → głos stacji (persona) → oboje. Refren duetu = oboje. */
function ktoWScenie({ kto, artysci, glos, refren }) {
    const znani = Object.keys(POSTACIE);
    const z = (s) => znani.filter((n) => new RegExp(`\\b${n}\\b`, 'i').test(String(s ?? '')));
    const zTagu = z(kto);
    if (zTagu.length) return zTagu;
    const zArtystow = [...new Set((artysci ?? []).flatMap((a) => z(a)))];
    if (zArtystow.length === 1) return zArtystow;
    if (refren) return zArtystow.length ? zArtystow : znani;
    const zGlosu = z(glos);
    return zGlosu.length ? zGlosu : zArtystow.length ? zArtystow : znani;
}
function zdaniePostaci(focus) {
    const [a, b] = Object.keys(POSTACIE);
    if (focus.length > 1) return `${POSTACIE[a]} and ${POSTACIE[b]} sit across from each other in the booth, both in frame`;
    const drugi = focus[0] === a ? b : a;
    return `Focus on ${POSTACIE[focus[0]]}, singing softly; across the table ${POSTACIE[drugi]} listens, slightly out of focus`;
}

/**
 * Storyboard stacji. `k` = { album, stacja { nr, tytul, bpm, lyrics }, artysci, glos? { nazwa } }, `sekundy` = długość utworu.
 * Zwraca obiekt zapisywany jako `storyboard_000g.json` w paczce wydawniczej.
 */
export function zbudujStoryboard(k, { sekundy = null } = {}) {
    const sekcje = sekcjeTekstu(k.stacja?.lyrics);
    const przydzial = przydzialScen(sekcje);
    const czasy = czasyScen(sekundy, k.stacja?.bpm);
    const uzyte = new Set();   // motyw pokazany w jednej scenie nie wraca w następnej — pięć scen ma pięć różnych obrazów
    const sceny = SCENY.map((wzor, i) => {
        const s = sekcje[przydzial[i]] ?? null;
        const wersy = s?.wersy ?? [];
        const focus = ktoWScenie({ kto: s?.kto, artysci: k.artysci, glos: k.glos?.nazwa, refren: wzor.sekcja === 'Chorus' });
        // czwarta scena bez własnej zwrotki wraca do refrenu — dostaje własny obraz sceny, żeby nie powtórzyć kadru refrenu
        const powtorka = i === 3 && przydzial[3] === przydzial[2];
        const swieze = motywyZWersow(wersy, 99).filter((m) => !uzyte.has(m)).slice(0, powtorka ? 1 : 2);
        swieze.forEach((m) => uzyte.add(m));
        const motywy = powtorka ? [wzor.domyslny, ...swieze] : swieze;
        const zdanie = (t) => t.charAt(0).toUpperCase() + t.slice(1);
        const obraz = zdanie((motywy.length ? motywy : [wzor.domyslny]).join('; '));
        const postacie = zdaniePostaci(focus);
        return {
            nr: i + 1, sekcja: wzor.sekcja, zrodlo: s ? s.nazwa : null, ...czasy[i], kto: focus, wersy, nuta: s?.nuta ?? '',
            opis: wzor.pl, obraz,
            prompt169: `Cinematic music video shot, 16:9 widescreen. Camera: ${wzor.kamera}. ${postacie}. ${obraz}. ${KLIMAT_TELEDYSKU}.`,
            prompt916: `Vertical 9:16 video, seamless ${FORMATY['9:16'].petlaSekund}-second loop with identical first and last frame, locked-off camera with a barely perceptible push-in, loop motion: ${wzor.petla}. ${postacie}. ${zdanie(motywy[0] ?? wzor.domyslny)}. ${KLIMAT_TELEDYSKU}.`,
            promptKadru: `Cinematic film still. ${postacie}. ${obraz}. ${KLIMAT_TELEDYSKU}.`,
            kadry: {},
        };
    });
    return {
        wersja: 1, album: k.album, stacja: { nr: k.stacja.nr, tytul: k.stacja.tytul }, artysci: k.artysci ?? [], bpm: k.stacja.bpm ?? null, sekundy: sekundy ?? null,
        firstFrame: 'cover_3000x3000.jpg', audio: { master: 'master.wav', original: 'original.mp3' }, lyrics: 'lyrics_clean.txt',
        klimat: KLIMAT_TELEDYSKU, postacie: POSTACIE, formaty: FORMATY, sceny, utworzono: new Date().toISOString(),
    };
}

export default { zbudujStoryboard, sekcjeTekstu, przydzialScen, czasyScen, motywyZWersow, KLIMAT_TELEDYSKU, POSTACIE, FORMATY, SCENY, MOTYWY };
