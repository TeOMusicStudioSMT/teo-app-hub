/**
 * 🎼 Baza silników Dyrygenta — wideo, muzyka, głos, obraz, 3D, usta, głębia, stemy — i dobór do CELU.
 *
 * Suweren (2026-10-06): „Dyrygent… może mieć w bazie kilka silników wideo i dźwiękowych… i modele… i dobiera czy to na
 * stół, czy do filmu, czy do podcastu, czy do gry, czy do fashion”.
 *
 * PRAWDA ZE ŹRÓDŁA: silnik nie jest wpisem w liście — jest tym, co zgłasza moduł, który go uruchamia. Most podaje
 * `sondy` (funkcje istniejących modułów: Wideo.stanWideo, rodziny muzyki, Assety3D.stan, Usta.stan, Glebia.stan,
 * silnik klonu, Demucs…). Każda sonda zwraca listę `{ id, nazwa, gotowy, powod, licencja?, chmura? }`. Sonda, która
 * padnie albo nie zdąży, daje wpis „nie wiadomo” z powodem — nie znika i nie udaje gotowości. Sondy NIC nie budzą
 * (ComfyUI śpi = silniki ComfyUI „nie wiadomo, ComfyUI śpi”).
 *
 * KANDYDACI: silniki znalezione przez Zwiadowcę (`rodzaj: 'silnik'`) — przyjęte = „do zainstalowania”, nowe = „do rozważenia”.
 */

export const RODZAJE = {
    wideo: { etykieta: 'Wideo', ikona: '🎬' },
    muzyka: { etykieta: 'Muzyka', ikona: '🎵' },
    glos: { etykieta: 'Głos (klon, TTS)', ikona: '🗣️' },
    obraz: { etykieta: 'Obraz', ikona: '🖼️' },
    '3d': { etykieta: 'Bryły 3D', ikona: '🗿' },
    usta: { etykieta: 'Usta aktorów', ikona: '👄' },
    glebia: { etykieta: 'Głębia kadru (2.5D)', ikona: '🧊' },
    stemy: { etykieta: 'Rozdział ścieżek', ikona: '🎚️' },
    mowa: { etykieta: 'Mowa → tekst', ikona: '📝' },
};

/**
 * Cele: jakie rodzaje silników są potrzebne (`potrzebne` — bez nich cel nie ruszy, `pomocne` — lepiej z nimi)
 * i którzy TeOgochi zwykle grają (dobór modeli językowych). `stol` = cały zespół karty, bez silników.
 */
export const CELE = {
    stol: { etykieta: 'Stół (projekt stada)', potrzebne: [], pomocne: [], agenci: null },
    film: { etykieta: 'Film / Story', potrzebne: ['wideo', 'glos'], pomocne: ['usta', 'glebia', 'muzyka', 'obraz'], agenci: ['rezyser', 'kronikarz', 'aktor', 'klatka', 'spawacz'] },
    podcast: { etykieta: 'Podcast', potrzebne: ['glos'], pomocne: ['usta', 'glebia', 'muzyka', 'mowa'], agenci: ['kronikarz', 'aktor'] },
    gra: { etykieta: 'Gra / apka', potrzebne: ['obraz'], pomocne: ['3d', 'muzyka', 'glos'], agenci: ['pionek', 'kodeks', 'paleta'] },
    fashion: { etykieta: 'Fashion', potrzebne: ['obraz'], pomocne: ['3d'], agenci: ['krawcowa', 'paleta'] },
    muzyka: { etykieta: 'Muzyka', potrzebne: ['muzyka'], pomocne: ['stemy', 'glos'], agenci: ['joanna', 'glosek'] },
};

/** Sonda z limitem czasu: pad / przekroczenie = wpis „nie wiadomo” z powodem, zamiast zniknięcia. */
async function sonduj(rodzaj, sonda, limitMs) {
    let t;
    try {
        const w = await Promise.race([
            Promise.resolve().then(sonda),
            new Promise((_, nie) => { t = setTimeout(() => nie(new Error(`sonda nie odpowiedziała w ${Math.round(limitMs / 1000)} s`)), limitMs); }),
        ]);
        return (Array.isArray(w) ? w : [w]).filter(Boolean).map((s) => ({
            id: String(s.id), nazwa: String(s.nazwa ?? s.id), rodzaj, gotowy: s.gotowy === true, nieWiadomo: s.gotowy == null,
            powod: s.powod ? String(s.powod).slice(0, 300) : (s.gotowy ? 'gotowy' : 'niegotowy'),
            licencja: s.licencja ?? null, chmura: !!s.chmura, modul: s.modul ?? null,
        }));
    } catch (e) {
        return [{ id: `${rodzaj}-sonda`, nazwa: RODZAJE[rodzaj]?.etykieta ?? rodzaj, rodzaj, gotowy: false, nieWiadomo: true, powod: `nie wiadomo — ${String(e.message || e).slice(0, 200)}`, licencja: null, chmura: false, modul: null }];
    } finally { clearTimeout(t); }
}

/**
 * @param {{ sondy: Record<string, () => Promise<object|object[]>>, kandydaci?: () => Promise<object[]>, limitMs?: number }} o
 */
export function utworzSilniki({ sondy = {}, kandydaci = async () => [], limitMs = 10_000 } = {}) {
    async function baza() {
        const wpisy = await Promise.all(Object.entries(sondy).map(([rodzaj, s]) => sonduj(rodzaj, s, limitMs)));
        const silniki = wpisy.flat();
        const kand = (await kandydaci().catch(() => [])).filter((k) => k.rodzaj === 'silnik' && k.stan !== 'odrzucony');
        return {
            silniki,
            kandydaci: kand.map((k) => ({ id: k.id, repo: k.repo, rodzaj: k.dziedzina, licencja: k.licencja ?? null, komercyjna: k.komercyjna ?? null, url: k.url, opinia: k.opinia ?? null, stan: k.stan === 'przyjety' ? 'do zainstalowania' : 'do rozważenia', pobrania: k.pobrania ?? null })),
        };
    }

    /**
     * Do celu: gotowe silniki po rodzajach, czego brakuje (potrzebne bez gotowego silnika = cel nie ruszy) i którzy
     * kandydaci Zwiadowcy by to załatali. Nic nie uruchamia i nic nie instaluje.
     */
    async function doCelu(cel) {
        const c = CELE[cel];
        if (!c) throw new Error(`Nie znam celu „${cel}” — są: ${Object.keys(CELE).join(', ')}.`);
        const { silniki, kandydaci: kand } = await baza();
        const rodzaje = [...c.potrzebne, ...c.pomocne];
        const poRodzajach = {};
        for (const r of rodzaje) {
            const lista = silniki.filter((s) => s.rodzaj === r);
            poRodzajach[r] = {
                potrzebny: c.potrzebne.includes(r),
                gotowe: lista.filter((s) => s.gotowy),
                niegotowe: lista.filter((s) => !s.gotowy),
                kandydaci: kand.filter((k) => k.rodzaj === r).sort((a, b) => Number(b.stan === 'do zainstalowania') - Number(a.stan === 'do zainstalowania') || (b.pobrania ?? 0) - (a.pobrania ?? 0)).slice(0, 5),
            };
        }
        const brakuje = c.potrzebne.filter((r) => !poRodzajach[r].gotowe.length);
        return { cel, etykieta: c.etykieta, agenci: c.agenci, rodzaje: poRodzajach, brakuje, moznaRuszyc: brakuje.length === 0 };
    }

    return { baza, doCelu, CELE, RODZAJE };
}

export default { utworzSilniki, CELE, RODZAJE };
