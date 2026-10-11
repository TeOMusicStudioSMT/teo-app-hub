/**
 * 🫀 Koherencja Katedry — czy rury Katedry naprawdę dochodzą (Suweren 2026-10-11: „Reasoning Monitor był do testów,
 * jak nie było RAM-ów… można go przebudować, połączyć z tym wskaźnikiem koherencji na głównej”).
 *
 * Czysta logika: fakty zebrane przez most → lista sprawdzeń {id, nazwa, ok, waga, opis, rada} → procent koherencji.
 * Sprawdzenia z faktów, nie z symulacji: Ollama, domyślny model Mózgu, modele ról TeOgochi (są w Ollamie? nie za małe
 * do ról, które piszą długo?), Mechanik, ComfyUI (opcjonalne — śpi = pół wagi), błędy mostu z doby, błąd chmury.
 */
export const ROLE_DLUGIE = ['rezyser', 'kronikarz', 'kodeks', 'dyrygent', 'pionek', 'wektor'];
const nazwyRowne = (a, b) => a === b || a === `${b}:latest` || b === `${a}:latest`;

/**
 * @param {{ ollama: string[]|null, domyslny: string, agenci: Record<string,string>, mechanik: string,
 *   comfy: boolean|null, bledyMostuDoby: number, bladChmuryDoby: string|null, rozmiar: (m:string)=>number|null }} f
 */
export function policzKoherencje(f) {
    const sprawdzenia = [];
    const dodaj = (id, nazwa, ok, waga, opis, rada = null) => sprawdzenia.push({ id, nazwa, ok, waga, opis, rada: ok ? null : rada });
    const ollama = f.ollama;
    const jest = (m) => !!m && (/^(claude|gemini):/.test(m) || (ollama ?? []).some((o) => nazwyRowne(o, m)));

    dodaj('ollama', '🦙 Ollama odpowiada', ollama !== null, 3, ollama ? `${ollama.length} modeli` : 'brak odpowiedzi z :11434', 'Uruchom Ollamę (ollama serve) — bez niej Katedra milczy.');
    if (ollama !== null) {
        dodaj('domyslny', '🧠 Domyślny model Katedry jest w Ollamie', jest(f.domyslny), 3, f.domyslny, `Ollama nie ma „${f.domyslny}” — ustaw inny w 🧠 Mózgu Katedry albo pobierz go.`);
        const role = Object.entries(f.agenci ?? {});
        const brak = role.filter(([, m]) => !jest(m));
        dodaj('role', '🥚 Modele ról TeOgochi są w Ollamie', brak.length === 0, 3,
            brak.length ? `brak: ${brak.map(([r, m]) => `${r} → ${m}`).join(', ')}` : `${role.length} ról z przydziałem`,
            'Zmień model tych ról w 🧠 Mózgu Katedry (Straż Modeli podstawia zastępcę, ale to łatka).');
        const male = ROLE_DLUGIE.map((r) => [r, (f.agenci ?? {})[r] || f.domyslny]).filter(([, m]) => { const b = f.rozmiar(m); return b !== null && b <= 4.5; });
        dodaj('rozmiar', '📏 Role piszące długo nie stoją na małych modelach', male.length === 0, 2,
            male.length ? `za małe: ${male.map(([r, m]) => `${r} (${m})`).join(', ')}` : 'Reżyser, Kronikarz, Kodeks, Dyrygent… > 4,5 mld',
            'Mały model gubi wątki i format (Reżyser na e2b zgubił listę ujęć) — daj tym rolom większy model w 🧠 Mózgu.');
        dodaj('mechanik', '🐙 Model Mechanika / Kodeksa jest w Ollamie', jest(f.mechanik), 1, f.mechanik, 'Ustaw model Mechanika w 🧠 Mózgu Katedry.');
    }
    // ComfyUI jest potrzebny tylko do obrazu/wideo/brył — śpi = pół punktu (nie błąd)
    sprawdzenia.push({ id: 'comfy', nazwa: '🎨 ComfyUI (obraz, wideo, bryły)', ok: f.comfy === true, waga: f.comfy === true ? 1 : 0.5, opis: f.comfy === true ? 'online' : 'śpi — budzi się sam przy zadaniu', rada: null, opcjonalne: true });
    dodaj('bledy', '🛟 Most bez błędów w ostatniej dobie', f.bledyMostuDoby === 0, 2, f.bledyMostuDoby ? `${f.bledyMostuDoby} wpisów w most-bledy.log` : 'czysto', 'Zajrzyj do _OtakOs_Wymiar/most-bledy.log — każdy wpis to błąd do poprawienia u źródła.');
    dodaj('chmura', '☁️ Chmura bez błędu w ostatniej dobie', !f.bladChmuryDoby, 1, f.bladChmuryDoby ? f.bladChmuryDoby.slice(0, 140) : 'czysto (albo nieużywana)', 'Sprawdź klucz i limit w TeO-Kibel / Trybie Katedry.');

    const suma = sprawdzenia.reduce((s, x) => s + x.waga, 0);
    const zdobyte = sprawdzenia.reduce((s, x) => s + (x.ok || x.opcjonalne ? x.waga : 0), 0);
    const procent = suma ? Math.round((zdobyte / suma) * 100) : 0;
    return { procent, sprawdzenia, braki: sprawdzenia.filter((x) => !x.ok && !x.opcjonalne).length };
}
