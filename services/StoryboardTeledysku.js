/**
 * 🎬 Storyboard 0.00G teledysku — OPOWIEŚĆ FILMOWA na całą długość utworu.
 *
 * Wersja 2 (Suweren 2026-11-13, po pierwszych klatkach: „wszystkie 5 klatek wygląda jak okładka — to samo ujęcie
 * stolika, nic się nie dzieje”). Przyczyny były dwie: każdy prompt zaczynał się od pary siedzącej w loży, a okładka
 * szła do FLUX jako wzór i narzucała kompozycję. Teraz:
 *   • 10–14 UJĘĆ od 0:00 do końca (jedno co ~12–18 s): każda sekcja tekstu dzielona po 2 wersy, sekcje bez słów
 *     (intro, bridge) i dołożone przejścia to ujęcia instrumentalne — „przepływy energii”,
 *   • KAŻDE ujęcie ma inną kompozycję z zamkniętej listy `KADRY` (detal, makro, portret jednej postaci bez stolika,
 *     zza szyby z ulicy, z góry, postacie w ruchu, wyjście o świcie…), wybraną z WERSÓW tego ujęcia; kompozycja użyta
 *     raz nie wraca; bez trafienia — kolejna z listy zapasowej; ujęcia instrumentalne biorą instrument z opisu sekcji;
 *     porządek opowieści: wejście z deszczu tylko w pierwszej połowie, wyjście o świcie dopiero pod koniec (i w finale,
 *     gdy tekst o świcie śpiewa),
 *   • prompt = plan kamery → akcja → energia → styl świata. NIE zaczyna się od pary przy stoliku, a opis postaci
 *     pojawia się tylko wtedy, gdy postać jest w kadrze,
 *   • WIDZIALNA ENERGIA w każdym ujęciu: złoto-błękitne wstęgi światła między dłońmi i sercami, geometryczne
 *     pierścienie rozchodzące się przy basie, iskry i krople wirujące w nieważkości,
 *   • klatki FLUX rysują się BEZ okładki jako wzoru (pole `wzor: false`) — spójność postaci trzyma opis słowny.
 * Dalej BEZ modelu językowego: ujęcia liczy kod. Prompty po angielsku, opis po polsku, w kadrze żadnych napisów.
 */

export const WERSJA_STORYBOARDU = 2;

/** Styl świata — ogon każdego promptu (bez opisu kompozycji: tę niesie ujęcie). */
export const KLIMAT_TELEDYSKU = 'StarLight Diner 0.00G world: a late-night retro diner, rain outside, warm amber lamp light against deep night blues, red velvet upholstery, '
    + 'zero gravity, slow motion, 35mm film grain, shallow depth of field, strictly no text, no letters, no numbers, no captions, no subtitles, no neon words, no signage, no logos';

/** Postacie — fikcyjni artyści albumu; ten sam opis słowny w każdym ujęciu, w którym postać jest w kadrze. */
export const POSTACIE = {
    Elara: 'Elara, a woman in her early thirties with long wavy chestnut hair and a dark silk blouse',
    Kael: 'Kael, a man in his mid thirties with short dark hair, light stubble and a charcoal knit sweater',
};

export const FORMATY = {
    '16:9': { szer: 1280, wys: 720, cel: 'YouTube Music Video' },
    '9:16': { szer: 720, wys: 1280, cel: 'Spotify Canvas', petlaSekund: 8 },
};

export const MIN_UJEC = 10, MAX_UJEC = 14, SEKUND_NA_UJECIE = 15;

/** Widzialne ruchy energii 0.00G — po jednym na ujęcie, zależnie od tego, kto jest w kadrze. */
export const ENERGIE = {
    oboje: 'Glowing gold-and-blue ribbons of light, like slow hydrogen waves, flow between their hands and their hearts',
    spiewak: 'Thin gold-and-blue ribbons of light drift out from the chest with every breath and curl through the air',
    nikt: 'Luminous sparks and weightless coffee droplets swirl slowly through the frame, trailing fine threads of gold-blue light',
    bas: 'Concentric geometric rings of gold-blue energy expand through the air with every bass note, bending the floating droplets as they pass',
};

/**
 * Kompozycje z tekstu: [id, wzór w wersach, kto w kadrze, plan (PL), plan kamery (EN), akcja (EN; {S} śpiewający, {O} druga osoba, {P} oboje)].
 * Kolejność = pierwszeństwo (konkret przed ogółem). Każda użyta najwyżej raz w storyboardzie.
 */
export const KADRY = [
    ['zegar', /\b(clock|eleven)\b|11:11/i, 'nikt', 'Detal: zegar zatrzymany na 11:11', 'Extreme close-up, slow push-in',
        'a round vintage wall clock above the diner counter, plain tick marks instead of numerals, both hands frozen at eleven minutes past eleven, a single coffee droplet hanging motionless in front of its glass'],
    ['neon', /\bneon\b/i, 'nikt', 'Z ulicy: neon za deszczową szybą', 'Exterior shot from the wet street, slow lateral tracking',
        'abstract tubes of teal and magenta neon light (pure glowing lines, no words) burning behind a rain-streaked diner window, their reflections stretching across the wet asphalt'],
    ['wejscie', /\b(walk in|walks in|shaking off|carrying stories)\b/i, 'drugi', 'Plan ogólny: wejście z deszczu', 'Wide shot from deep inside the dim diner toward the entrance, slow dolly back',
        '{O} steps in through the glass door out of the rain and shakes the cold off a long coat; the droplets stop mid-air and hang weightless around the doorway'],
    ['plaszcz', /\b(armou?r|heavy|weight|masks?|worry|label)\b/i, 'nikt', 'Detal: ciężki płaszcz porzucony przy wejściu', 'Low-angle detail shot, slow tilt up',
        'a heavy rain-soaked coat left hanging on a brass hook by the entrance door, water lifting upward off its hem as gravity lets go'],
    ['klucz', /\b(key|lock|last call|bartender)\b/i, 'nikt', 'Makro: klucz w zamku drzwi', 'Macro shot, very shallow focus',
        'an old brass key turning in the lock of the diner door from the inside, the night street dissolved into soft bokeh beyond the glass'],
    ['swit', /\b(dawn|sunrise|horizon|first ray|step outside|walk together|brand new day|open air|morning light)\b|sky turns blue/i, 'oboje', 'Plan szeroki: wychodzą razem o świcie', 'Wide exterior shot from behind, slow dolly following',
        '{P} walk out of the diner side by side into a wide open horizon at dawn, pale blue-gold light ahead, the wet empty road shining under their feet'],
    ['unoszenie', /\b(floating|float|weightless|gravity|higher|drifting|suspended|lighter|stardust)\b/i, 'oboje', 'W ruchu: unoszą się nad podłogą', 'Full-body wide shot, slow upward crane',
        '{P} rise from their seats and lift gently off the checkered floor, hair and sleeves drifting, cups and spoons ascending around them'],
    ['cienie', /\bshadows?\b/i, 'nikt', 'Cienie na ścianie (bez ludzi w kadrze)', 'Static shot of a bare warm-lit wall, no people in frame',
        'two long shadows cast by a low light slowly lean toward each other until they merge into one'],
    ['plomien', /\b(candle|flame|spark|fire)\b/i, 'nikt', 'Makro: płomień w nieważkości', 'Macro shot, slow orbit',
        'a single candle flame drifting free of its wick as a perfect glowing sphere'],
    ['radio', /\b(radio|static|frequency|voltage)\b/i, 'nikt', 'Detal: skala starego radia', 'Close-up, slow rack focus',
        'the glowing dial of a vintage tabletop radio, its needle trembling, golden dust dancing in front of the speaker cloth'],
    ['filizanka', /\b(cups?|coffee|espresso|pour|steam|porcelain)\b/i, 'nikt', 'Makro: filiżanka', 'Macro close-up, slow rotation around the rim',
        'a white porcelain cup, the coffee rising out of it in a slow weightless spiral, steam curling like silk'],
    ['szyba', /\b(rain|raindrops?|window|glass|pane|mist|thunder)\b/i, 'spiewak', 'Zza szyby, z ulicy', 'Shot from outside on the street looking in through the rain-streaked window, slow push toward the glass',
        '{S} is alone in the frame behind the glass, the face softened by raindrops that slide sideways and upward in slow motion'],
    ['dlonie', /\b(hands?|fingers?|fingertips|touch|intertwined)\b/i, 'dlonie', 'Zbliżenie: dwie dłonie', 'Extreme close-up, no faces in frame',
        'two hands reaching toward each other above dark polished wood, a hair\'s breadth apart, then closing the distance'],
    ['miasto', /\b(city|headlights?|street|comets?)\b/i, 'nikt', 'Plan ogólny z drugiej strony ulicy', 'Wide exterior night shot from across the empty wet street, slow push-in',
        'a small diner glowing like a lantern in the dark, passing headlights stretching into long slow streaks of light'],
    ['portret', /\b(skin|lips|eyes|smiling|reflection|sigh|whisper|breath|breathing|name)\b/i, 'spiewak', 'Portret (bez stolika w kadrze)', 'Tight portrait close-up on an 85mm lens, dark background, no table in frame',
        '{S}, lit from one side by warm amber light, eyes slowly closing, lips parting on a quiet word'],
    ['niebo', /\b(stars?|moon|moonlight|sky|skies|heaven|eternity)\b/i, 'nikt', 'W górę: sufit otwiera się na gwiazdy', 'Low-angle shot looking straight up, slow rotation',
        'the diner ceiling dissolving into a deep field of stars, a ceiling fan turning slowly among them'],
    ['bar', /\b(chairs?|tables?|hall|counter|floor|wall|room)\b/i, 'nikt', 'Z góry: pusty bar', 'Bird\'s-eye view straight down from the ceiling, slow descent',
        'the empty diner at night, chairs upturned on the tables, a checkered floor, one pool of lamp light in the corner'],
    ['serce', /\b(heart|heartbeat|rhythm|pulse)\b/i, 'spiewak', 'Zbliżenie: dłoń na sercu', 'Medium close-up at chest height, slow push-in',
        '{S} stands with one hand resting over the heart, head tilted slightly back'],
    ['okno', /\b(closer|stay|pull me|next to|embrace|anchored)\b/i, 'oboje', 'W ruchu: wstają i podchodzą do okna', 'Medium-wide tracking shot, silhouettes against the light',
        '{P} stand up and move slowly toward the tall window until they are two silhouettes against the rain-lit glass'],
];

/** Kompozycje zapasowe — gdy wersy ujęcia nie dają świeżego trafienia (kolejno, każda raz). */
export const ZAPASOWE = [
    ['profil', 'spiewak', 'Profil przy oknie', 'Side-on profile close-up, slow lateral drift', '{S} in profile beside the dark window, city lights smeared into soft colour behind the head'],
    ['stopy', 'nikt', 'Detal: stopy odrywają się od podłogi', 'Low floor-level detail shot', 'two pairs of shoes lifting a few centimetres off a checkered floor, a dropped spoon turning slowly in the air beside them'],
    ['odbicie', 'spiewak', 'Odbicie w ciemnej szybie', 'Close shot of a reflection in black window glass, focus on the reflection', 'the reflection of {S} in the night window, raindrops crossing the reflected face'],
    ['sluchacz', 'drugi', 'Portret słuchającej osoby', 'Tight portrait close-up, dark background, no table in frame', '{O} listening with a slow half-smile, amber light moving across the face'],
    ['zgory', 'dlonie', 'Z góry: blat, dwie filiżanki, dłonie', 'Bird\'s-eye view straight down, slow rotation', 'a round wooden tabletop seen from directly above, two cups and two pairs of hands, everything turning slowly like a clock face'],
    ['korytarz', 'spiewak', 'Plan pełny: samotna sylwetka w pustym barze', 'Full-body wide shot down the length of the room, slow dolly-in', '{S} standing alone in the middle of the empty diner, a long shadow thrown across the floor'],
    ['taniec', 'oboje', 'W ruchu: wolny obrót w powietrzu', 'Medium-wide shot, slow orbit', '{P} turn slowly around each other in mid-air, foreheads almost touching'],
    ['kropla', 'nikt', 'Makro: kropla kawy', 'Extreme macro shot', 'one perfect sphere of coffee floating in the air, the whole warm room reflected upside down inside it'],
];

/** Ujęcia instrumentalne: instrument z opisu sekcji → detal w półmroku (każdy raz). */
export const INSTRUMENTY = [
    ['saksofon', /\bsax(ophone)?\b/i, 'Detal: saksofon w półmroku', 'Close detail shot in half-light, slow slide along the instrument', 'a tenor saxophone resting on the corner seat, golden reflections sliding along its bell'],
    ['gitara', /\bguitar\b/i, 'Detal: struny gitary', 'Macro shot along the fretboard', 'the strings of a hollow-body electric guitar trembling in deep shadow, an unseen hand letting a chord ring'],
    ['klawisze', /\b(rhodes|piano|keys|chords?)\b/i, 'Makro: klawisze', 'Macro shot along a row of keys, slow tracking', 'the keys of an old electric piano sinking and rising by themselves in warm lamp light'],
    ['kontrabas', /\b(bass|sub-bass|heartbeat)\b/i, 'Makro: struna kontrabasu', 'Macro shot, very slow motion', 'a single thick string of an upright bass vibrating in a wide slow arc'],
    ['smyczki', /\b(cello|strings)\b/i, 'Detal: wiolonczela', 'Close detail shot, slow tilt', 'a cello leaning against the wall in half-light, its bow floating beside it'],
    ['gramofon', /\b(vinyl|crackle|tape|organ|pad)\b/i, 'Makro: igła gramofonu', 'Macro shot, slow orbit', 'a turntable needle riding a spinning record, dust rising off the groove in slow motion'],
];
/** Gdy opis sekcji nie nazywa instrumentu (albo już był): czyste przepływy energii w pustej przestrzeni. */
export const PRZEPLYWY = [
    ['powietrze', 'Przepływ energii: pusta sala', 'Wide slow-motion shot of the empty air between the booths', 'cups, spoons and drops of coffee hanging weightless in the middle of the room, turning slowly'],
    ['okno-energia', 'Przepływ energii: przy szybie', 'Close shot of the window from inside, slow rack focus', 'raindrops on the glass lighting up one by one as a pulse of light travels through them'],
    ['lampa', 'Przepływ energii: lampka', 'Close-up, slow orbit', 'a small amber table lamp alone in the dark, its light breathing brighter and dimmer'],
    ['podloga', 'Przepływ energii: nad podłogą', 'Low tracking shot just above a checkered floor', 'a slow tide of light moving across the floor tiles, lifting dust and droplets as it passes'],
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

/** Ile ujęć na utwór: jedno co ~15 s, zawsze 10–14. */
export function ileUjec(sekundy) { return Math.max(MIN_UJEC, Math.min(MAX_UJEC, Math.round((Number(sekundy) || 180) / SEKUND_NA_UJECIE))); }

/**
 * Sekcje → ujęcia w kolejności utworu: po 2 wersy na ujęcie, sekcja bez słów = ujęcie instrumentalne; za mało →
 * dokładane „przepływy energii” (po refrenach, potem po zwrotkach), za dużo → sklejane pary w najdłuższych sekcjach.
 */
export function ujeciaZSekcji(sekcje, cel) {
    let u = [];
    const licznik = {};
    sekcje.forEach((s, nrSekcji) => {
        licznik[s.nazwa] = (licznik[s.nazwa] ?? 0) + 1;
        const nazwa = licznik[s.nazwa] > 1 ? `${s.nazwa} (${licznik[s.nazwa]})` : s.nazwa;
        const baza = { nrSekcji, sekcja: nazwa, rodzaj: s.rodzaj, kto: s.kto, nuta: s.nuta };
        if (!s.wersy.length) { u.push({ ...baza, wersy: [], instrumental: true }); return; }
        for (let i = 0; i < s.wersy.length; i += 2) u.push({ ...baza, wersy: s.wersy.slice(i, i + 2), instrumental: false });
    });
    if (!u.length) u.push({ nrSekcji: 0, sekcja: 'Intro', rodzaj: 'intro', kto: '', nuta: '', wersy: [], instrumental: true });
    // za dużo: sklej ostatnie dwa ujęcia sekcji, która ma ich najwięcej (najpierw powtórki refrenu)
    while (u.length > cel) {
        const ile = {};
        for (const x of u) if (!x.instrumental) ile[x.nrSekcji] = (ile[x.nrSekcji] ?? 0) + 1;
        const kandydaci = Object.entries(ile).filter(([, n]) => n > 1).map(([nr, n]) => ({ nr: Number(nr), n, powtorka: /\(\d+\)$/.test(u.find((x) => x.nrSekcji === Number(nr)).sekcja) }));
        if (!kandydaci.length) break;
        kandydaci.sort((a, b) => Number(b.powtorka) - Number(a.powtorka) || b.n - a.n || b.nr - a.nr);
        const idx = u.map((x, i) => (x.nrSekcji === kandydaci[0].nr && !x.instrumental ? i : -1)).filter((i) => i >= 0);
        const [a, b] = idx.slice(-2);
        u[a] = { ...u[a], wersy: [...u[a].wersy, ...u[b].wersy] };
        u.splice(b, 1);
    }
    // za mało: przepływ energii po końcu sekcji — refreny, potem zwrotki, potem reszta; nigdy dwa pod rząd i nie po ostatnim ujęciu
    const kolejnosc = ['chorus', 'verse', 'prechorus', 'bridge', 'intro', 'inna'];
    for (let runda = 0; u.length < cel && runda < 6; runda++) {
        let dodano = false;
        for (const rodzaj of kolejnosc) {
            for (let i = 0; i < u.length - 1 && u.length < cel; i++) {
                const koniecSekcji = u[i].nrSekcji !== u[i + 1].nrSekcji;
                if (!koniecSekcji || u[i].rodzaj !== rodzaj || u[i].przeplyw || u[i + 1].przeplyw || u[i].instrumental || u[i + 1].instrumental) continue;
                u.splice(i + 1, 0, { nrSekcji: u[i].nrSekcji + 0.5, sekcja: 'Energy flow', rodzaj: 'przeplyw', kto: '', nuta: u[i].nuta, wersy: [], instrumental: true, przeplyw: true });
                dodano = true; i++;
            }
        }
        if (!dodano) break;
    }
    // krótki utwór o niewielu sekcjach: oddech energii także w środku sekcji (między jej częściami)
    for (let i = 0; i < u.length - 1 && u.length < cel; i++) {
        if (u[i].nrSekcji !== u[i + 1].nrSekcji || u[i].instrumental || u[i + 1].instrumental) continue;
        if (u[i - 1]?.przeplyw) continue;
        u.splice(i + 1, 0, { nrSekcji: u[i].nrSekcji + 0.25, sekcja: 'Energy flow', rodzaj: 'przeplyw', kto: '', nuta: u[i].nuta, wersy: [], instrumental: true, przeplyw: true });
        i++;
    }
    // etykiety części: „Verse 1 · a / b”
    const czesci = {};
    for (const x of u) czesci[x.sekcja] = (czesci[x.sekcja] ?? 0) + 1;
    const ktora = {};
    return u.map((x) => {
        if (czesci[x.sekcja] < 2) return { ...x, etykieta: x.sekcja };
        ktora[x.sekcja] = (ktora[x.sekcja] ?? 0) + 1;
        return { ...x, etykieta: `${x.sekcja} · ${String.fromCharCode(96 + ktora[x.sekcja])}` };
    });
}

/** Granice ujęć w sekundach: udział = liczba wersów (instrumentalne krócej), dociągnięte do pełnych taktów 4/4. */
export function czasyUjec(ujecia, sekundy, bpm) {
    const calosc = Math.max(10, Number(sekundy) || 180);
    const takt = Number(bpm) > 0 ? 240 / Number(bpm) : 0;
    const wagi = ujecia.map((x) => (x.instrumental ? (x.przeplyw ? 1.5 : 1.7) : Math.max(1.6, x.wersy.length)));
    const suma = wagi.reduce((a, b) => a + b, 0);
    const granice = [0];
    let acc = 0;
    for (let i = 0; i < ujecia.length - 1; i++) {
        acc += wagi[i];
        let t = (acc / suma) * calosc;
        if (takt) t = Math.max(granice[i] + takt, Math.round(t / takt) * takt);
        granice.push(Math.min(t, calosc - (ujecia.length - 1 - i) * (takt || 1)));
    }
    granice.push(calosc);
    const r1 = (x) => Math.round(x * 10) / 10;
    return ujecia.map((_, i) => ({ od: r1(granice[i]), do: r1(granice[i + 1]), sekundy: r1(granice[i + 1] - granice[i]) }));
}

/** Śpiewający w ujęciu: mówca z tagu sekcji → jedyny artysta → persona stacji → pierwszy artysta. */
function spiewajacy({ kto, artysci, glos }) {
    const znani = Object.keys(POSTACIE);
    const z = (s) => znani.find((n) => new RegExp(`\\b${n}\\b`, 'i').test(String(s ?? '')));
    const zArtystow = [...new Set((artysci ?? []).map((a) => z(a)).filter(Boolean))];
    return z(kto) ?? (zArtystow.length === 1 ? zArtystow[0] : null) ?? z(glos) ?? zArtystow[0] ?? znani[0];
}
const wstaw = (tekst, S) => {
    const O = Object.keys(POSTACIE).find((n) => n !== S);
    return tekst.replaceAll('{S}', POSTACIE[S]).replaceAll('{O}', POSTACIE[O]).replaceAll('{P}', `${POSTACIE[S]} and ${POSTACIE[O]}`);
};
const zdanie = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Storyboard stacji. `k` = { album, stacja { nr, tytul, bpm, lyrics }, artysci, glos? { nazwa } }, `sekundy` = długość utworu.
 * Zwraca obiekt zapisywany jako `storyboard_000g.json` w paczce wydawniczej.
 */
export function zbudujStoryboard(k, { sekundy = null } = {}) {
    const sekcje = sekcjeTekstu(k.stacja?.lyrics);
    const ujecia = ujeciaZSekcji(sekcje, ileUjec(sekundy));
    const czasy = czasyUjec(ujecia, sekundy, k.stacja?.bpm);
    const uzyte = new Set();
    const nutyUtworu = sekcje.map((x) => x.nuta).join(' ; ');
    let instrumentalne = 0;
    // porządek opowieści: ktoś wchodzi na początku, wychodzą razem dopiero pod koniec
    const OKNA = { wejscie: [0, 0.5], swit: [0.6, 1] };
    const wOknie = (id, i) => { const o = OKNA[id]; const t = ujecia.length > 1 ? i / (ujecia.length - 1) : 1; return !o || (t >= o[0] && t <= o[1]); };
    const swit = KADRY.find((e) => e[0] === 'swit');
    const tekstOSwicie = swit[1].test(String(k.stacja?.lyrics ?? ''));
    const wez = (lista, pasuje = () => true) => { const x = lista.find((e) => !uzyte.has(e[0]) && pasuje(e)); if (x) uzyte.add(x[0]); return x ?? null; };

    const sceny = ujecia.map((u, i) => {
        const S = spiewajacy({ kto: u.kto, artysci: k.artysci, glos: k.glos?.nazwa });
        const O = Object.keys(POSTACIE).find((n) => n !== S);
        let plan, kamera, akcja, wKadrze, energia;
        if (u.instrumental) {
            // pierwsze ujęcie filmu = plan ogólny z ulicy; dalej instrument z opisu sekcji, potem czyste przepływy energii
            const otwarcie = i === 0 ? wez(KADRY, (e) => e[0] === 'miasto') : null;
            // instrument z opisu TEJ sekcji; w dołożonych przejściach na zmianę: instrument z aranżu utworu (saksofon, gitara…) i czysty przepływ
            const zAranzu = () => wez(INSTRUMENTY, (e) => e[1].test(nutyUtworu));
            const zSekcji = otwarcie || u.przeplyw ? null : wez(INSTRUMENTY, (e) => e[1].test(u.nuta));
            const instr = otwarcie ? null : zSekcji ?? (instrumentalne++ % 2 === 0 ? zAranzu() : null);
            const wolny = otwarcie || instr ? null : wez(PRZEPLYWY) ?? zAranzu() ?? wez(INSTRUMENTY) ?? PRZEPLYWY[i % PRZEPLYWY.length];
            if (otwarcie) [, , , plan, kamera, akcja] = otwarcie;
            else if (instr) [, , plan, kamera, akcja] = instr;
            else [, plan, kamera, akcja] = wolny;
            wKadrze = []; energia = ENERGIE.bas;
        } else {
            const tekst = u.wersy.join(' \n ');
            const final = i === ujecia.length - 1 && tekstOSwicie && !uzyte.has('swit');   // ostatni kadr: wychodzą w świt
            if (final) uzyte.add('swit');
            // gdy tekst śpiewa o świcie, wyjście w horyzont czeka na OSTATNI kadr filmu
            const zTekstu = final ? swit : wez(KADRY, (e) => e[1].test(tekst) && wOknie(e[0], i) && !(e[0] === 'swit' && tekstOSwicie));
            let typ;
            if (zTekstu) [, , typ, plan, kamera, akcja] = zTekstu;
            else { const z = wez(ZAPASOWE) ?? ZAPASOWE[i % ZAPASOWE.length]; [, typ, plan, kamera, akcja] = z; }
            wKadrze = typ === 'oboje' ? [S, O] : typ === 'spiewak' ? [S] : typ === 'drugi' ? [O] : [];
            energia = typ === 'oboje' || typ === 'dlonie' ? ENERGIE.oboje : typ === 'spiewak' || typ === 'drugi' ? ENERGIE.spiewak : ENERGIE.nikt;
        }
        akcja = zdanie(wstaw(akcja, S));
        return {
            nr: i + 1, sekcja: u.etykieta, zrodlo: u.sekcja, ...czasy[i], instrumental: u.instrumental, kto: wKadrze, wersy: u.wersy, nuta: u.nuta ?? '',
            plan, opis: `${plan}.${u.instrumental ? ' Ujęcie bez słów — przepływ energii 0.00G.' : ''}`, obraz: akcja, energia, wzor: false,
            prompt169: `Cinematic music video shot, 16:9 widescreen. ${kamera}. ${akcja}. ${energia}. ${KLIMAT_TELEDYSKU}.`,
            prompt916: `Vertical 9:16 video, seamless ${FORMATY['9:16'].petlaSekund}-second loop with identical first and last frame. ${kamera.split(',')[0]}. ${akcja}. ${energia}, moving in one closed cycle. ${KLIMAT_TELEDYSKU}.`,
            promptKadru: `Cinematic film still. ${kamera.split(',')[0]}. ${akcja}. ${energia}. ${KLIMAT_TELEDYSKU}.`,
            kadry: {},
        };
    });
    return {
        wersja: WERSJA_STORYBOARDU, album: k.album, stacja: { nr: k.stacja.nr, tytul: k.stacja.tytul }, artysci: k.artysci ?? [], bpm: k.stacja.bpm ?? null, sekundy: sekundy ?? null,
        firstFrame: 'cover_3000x3000.jpg', audio: { master: 'master.wav', original: 'original.mp3' }, lyrics: 'lyrics_clean.txt',
        klimat: KLIMAT_TELEDYSKU, postacie: POSTACIE, energie: ENERGIE, formaty: FORMATY, sceny, utworzono: new Date().toISOString(),
    };
}

export default { zbudujStoryboard, sekcjeTekstu, ujeciaZSekcji, czasyUjec, ileUjec, WERSJA_STORYBOARDU, KLIMAT_TELEDYSKU, POSTACIE, ENERGIE, FORMATY, KADRY, ZAPASOWE, INSTRUMENTY, PRZEPLYWY };
