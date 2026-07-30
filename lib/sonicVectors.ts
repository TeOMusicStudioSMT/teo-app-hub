/**
 * 🧬 sonicVectors — generator wektorów sonicznych (struktura rytmiczna utworu).
 *
 * Karmi silnik montażowy: `/api/teledysk/plan` robi z tego cięcia zgrane z beatem,
 * a TeO Story V2 zaciąga gotowy plik i tnie materiał pod konkretny utwór.
 *
 * ⚠️ DWA BŁĘDY STAREGO ZBIERACZA, KTÓRE TU NAPRAWIAMY:
 *  1. BRAK CZASU. Stary format miał `{s,b,v,h}` bez `t`, więc konsument zakładał
 *     `i/fps` i ściskał cały utwór w kilka sekund. Teraz `t` to REALNA sekunda
 *     z `audio.currentTime` — oś czasu jest prawdziwa, nie zgadywana.
 *  2. ZŁA SKALA. Stary zapisywał 0–255, a `/api/teledysk/plan` porównuje wokal
 *     i soprany do `0.6` — przy 0–255 każdy warunek był prawdziwy i wszystkie
 *     cięcia dostawały „punch-zoom". Teraz normalizujemy do 0..1, więc wybór
 *     efektu wreszcie działa. Pole `scale` w kopercie mówi wprost, co to za skala.
 *
 * Beat-detection: energia basu vs. ruchoma średnia z ~1.5 s + refrakcja 250 ms
 * (górny limit 240 BPM). Klasyczne podejście energetyczne — tanie, działa na żywo
 * i nie wymaga AudioWorkletu (a więc i drugiego kontekstu audio).
 */

/** Pojedyncza próbka. `t` = sekundy od początku utworu, pasma znormalizowane 0..1. */
export interface SonicVector {
    s: number;     // indeks próbki
    t: number;     // czas [s] — REALNY, z odtwarzacza
    b: number;     // bas      0..1
    v: number;     // średnie / wokal 0..1
    h: number;     // soprany  0..1
    beat?: 1;      // uderzenie wykryte w tej próbce
}

/** Koperta zapisywana na dysk (to czyta silnik montażowy). */
export interface SonicVectorSet {
    track:      string;
    duration:   number;         // długość utworu [s]
    sampledHz:  number;         // częstotliwość próbkowania
    scale:      '0..1';         // ⚠️ jawnie, żeby nikt znów nie pomylił skali
    bpm:        number | null;
    beats:      number[];       // czasy uderzeń [s]
    vectors:    SonicVector[];
    createdAt:  string;
    engine:     string;
}

/** Pasma zgodne z dotychczasową konwencją Katedry (b: 0-10, v: 10-50, h: 50-120). */
const BAND = { bass: [0, 10], vocal: [10, 50], high: [50, 120] } as const;

const SAMPLE_HZ = 20;              // 20 próbek/s — dość gęsto na cięcia, znośny plik
const HISTORY_SEC = 1.5;           // okno ruchomej średniej dla beat-detekcji
const BEAT_SENSITIVITY = 1.35;     // ile razy powyżej średniej = uderzenie
const BEAT_REFRACTORY = 0.25;      // min. odstęp uderzeń [s] → max 240 BPM
const BEAT_FLOOR = 0.08;           // cisza to nie beat

const avgBand = (data: Uint8Array, from: number, to: number): number => {
    const hi = Math.min(to, data.length);
    if (hi <= from) return 0;
    let sum = 0;
    for (let i = from; i < hi; i++) sum += data[i];
    return sum / (hi - from) / 255;   // ← normalizacja do 0..1
};

export class SonicVectorExtractor {
    private vectors: SonicVector[] = [];
    private beats: number[] = [];
    private history: number[] = [];
    private lastSampleT = -Infinity;
    private lastBeatT = -Infinity;
    private track = '';

    constructor(private readonly hz: number = SAMPLE_HZ) {}

    get count(): number { return this.vectors.length; }
    get beatCount(): number { return this.beats.length; }
    get isEmpty(): boolean { return this.vectors.length === 0; }

    reset(track = ''): void {
        this.vectors = [];
        this.beats = [];
        this.history = [];
        this.lastSampleT = -Infinity;
        this.lastBeatT = -Infinity;
        this.track = track;
    }

    /**
     * Wołane z istniejącej pętli rAF odtwarzacza — NIE tworzy własnego kontekstu
     * ani własnej pętli. Zwraca true, gdy próbka faktycznie została pobrana.
     */
    sample(analyser: AnalyserNode, timeSec: number): boolean {
        // Epsilon nie jest ozdobą: bez niego 0.15 − 0.10 = 0.04999999999999999
        // wypada poniżej progu i zbieracz gubi ~40% próbek (zmierzone).
        const step = 1 / this.hz - 1e-6;
        if (!(timeSec >= 0) || timeSec - this.lastSampleT < step) return false;

        // Przewinięcie w tył (seek) — historia z innego miejsca utworu kłamie.
        if (timeSec < this.lastSampleT) this.history = [];
        this.lastSampleT = timeSec;

        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);

        const b = avgBand(data, BAND.bass[0], BAND.bass[1]);
        const v = avgBand(data, BAND.vocal[0], BAND.vocal[1]);
        const h = avgBand(data, BAND.high[0], BAND.high[1]);

        // Ruchoma średnia energii basu — próg dopasowuje się do utworu.
        const historyLen = Math.max(4, Math.round(HISTORY_SEC * this.hz));
        const mean = this.history.length
            ? this.history.reduce((a, x) => a + x, 0) / this.history.length
            : b;

        const isBeat =
            b > BEAT_FLOOR &&
            b > mean * BEAT_SENSITIVITY &&
            timeSec - this.lastBeatT >= BEAT_REFRACTORY &&
            this.history.length >= 4;

        this.history.push(b);
        if (this.history.length > historyLen) this.history.shift();

        const vec: SonicVector = {
            s: this.vectors.length,
            t: +timeSec.toFixed(3),
            b: +b.toFixed(4), v: +v.toFixed(4), h: +h.toFixed(4),
        };
        if (isBeat) {
            vec.beat = 1;
            this.beats.push(vec.t);
            this.lastBeatT = timeSec;
        }
        this.vectors.push(vec);
        return true;
    }

    /**
     * BPM w dwóch krokach:
     *  1. mediana odstępów — odporna na zgubione/nadmiarowe uderzenia,
     *  2. regresja liniowa czasów po numerach taktów — uśrednia błąd kwantyzacji
     *     próbkowania po CAŁYM utworze. Sama mediana przy 20 Hz myliła się o ~7%
     *     (140 BPM czytane jako 133), bo okres wpadał między próbki.
     */
    private estimateBpm(): number | null {
        if (this.beats.length < 4) return null;

        const gaps: number[] = [];
        for (let i = 1; i < this.beats.length; i++) gaps.push(this.beats[i] - this.beats[i - 1]);
        gaps.sort((a, b) => a - b);
        const median = gaps[Math.floor(gaps.length / 2)];
        if (!(median > 0)) return null;

        // Okres kotwiczymy na CAŁEJ rozpiętości utworu, ale liczby taktów NIE
        // wyliczamy wprost z mediany: mediana jest skwantowana do siatki
        // próbkowania (0.05 s) i zawyżona, więc `round(span/median)` potrafi
        // spudłować o 2 takty (przy 140 BPM dawało 43 zamiast 45 → błąd 5%).
        // Sprawdzamy więc kilku kandydatów i bierzemy tego, przy którym
        // uderzenia najrówniej siadają na siatkę taktów.
        const t0 = this.beats[0];
        const span = this.beats[this.beats.length - 1] - t0;
        if (!(span > 0)) return null;

        const zgadywany = Math.max(1, Math.round(span / median));
        let period0 = span / zgadywany;
        let najlepszy = Infinity;

        for (let c = Math.max(1, zgadywany - 4); c <= zgadywany + 4; c++) {
            const p = span / c;
            if (p <= 0) continue;
            let reszta = 0;
            for (const t of this.beats) {
                const n = Math.round((t - t0) / p);
                reszta += Math.abs((t - t0) - n * p);
            }
            if (reszta < najlepszy) { najlepszy = reszta; period0 = p; }
        }

        const idx = this.beats.map(t => Math.round((t - t0) / period0));

        // Najmniejsze kwadraty: t = a·n + b. Nachylenie `a` to okres taktu.
        const n = idx.length;
        const sumN = idx.reduce((a, x) => a + x, 0);
        const sumT = this.beats.reduce((a, x) => a + x, 0);
        const sumNN = idx.reduce((a, x) => a + x * x, 0);
        const sumNT = idx.reduce((a, x, i) => a + x * this.beats[i], 0);
        const denom = n * sumNN - sumN * sumN;

        const period = denom !== 0 ? (n * sumNT - sumN * sumT) / denom : period0;
        const bpm = 60 / (period > 0 ? period : median);
        return bpm >= 40 && bpm <= 240 ? +bpm.toFixed(1) : null;
    }

    /** Domknij zbiór — gotowy do zapisu na dysk. */
    finish(duration = 0, track = this.track): SonicVectorSet {
        return {
            track,
            duration: +Number(duration || this.vectors.at(-1)?.t || 0).toFixed(3),
            sampledHz: this.hz,
            scale: '0..1',
            bpm: this.estimateBpm(),
            beats: this.beats,
            vectors: this.vectors,
            createdAt: new Date().toISOString(),
            engine: 'SonicVectorExtractor 0.00G (AnalyserNode + energy beat-detection)',
        };
    }
}

/**
 * Wygodna nazwa z rozkazu — jednorazowa ekstrakcja z gotowej tablicy próbek.
 * (Ścieżka na żywo idzie przez klasę wyżej; ta funkcja przydaje się w testach
 * i przy przeliczaniu materiału już zebranego.)
 */
export function extractSonicVectors(
    samples: Array<{ data: Uint8Array; t: number }>,
    opts: { hz?: number; track?: string; duration?: number } = {},
): SonicVectorSet {
    const ex = new SonicVectorExtractor(opts.hz ?? SAMPLE_HZ);
    ex.reset(opts.track ?? '');
    const fake = (data: Uint8Array): AnalyserNode => ({
        frequencyBinCount: data.length,
        getByteFrequencyData: (out: Uint8Array) => out.set(data),
    } as unknown as AnalyserNode);
    for (const s of samples) ex.sample(fake(s.data), s.t);
    return ex.finish(opts.duration ?? 0, opts.track ?? '');
}

/** Nazwa pliku, po którą sięga silnik montażowy TeO Story V2. */
export const CURRENT_VECTORS_FILE = 'current_track_vectors.json';
export const CURRENT_PLAN_FILE = 'current_track_plan.json';
