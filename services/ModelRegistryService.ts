/**
 * 🗂️ Rejestr modeli — znormalizowany katalog wag Katedry.
 *
 * ⚠️ TA WERSJA JEST PRZEPISANA. Pierwotna importowała `fs` i `path` i skanowała
 * dysk — ale wołał ją komponent Reacta, czyli PRZEGLĄDARKA, która dostępu do
 * dysku nie ma. W najlepszym razie zwracała pustą listę, w najgorszym wywalała
 * okno przy starcie. Filtr też mijał się z rzeczywistością: szukał plików
 * `.ollama/.api/.txt`, a w `_OtakOs_AI/models` leżą `.gguf` i `.bin` — więc
 * nawet po stronie Node znalazłby ZERO wag.
 *
 * Kształt `ModelResource` zostaje, bo pomysł był dobry: jeden znormalizowany
 * opis zasobu dla całej Katedry. Zmienia się tylko źródło — katalog czyta most
 * (`/api/modele/lokalne`), a przeglądarka pyta most.
 */

/** Znormalizowany opis zasobu modelowego. */
export interface ModelResource {
    id: string;
    name: string;
    /** Pełna ścieżka na dysku Suwerena (informacyjnie — przeglądarka jej nie otworzy). */
    path: string;
    type: 'ollama' | 'gguf' | 'whisper' | 'safetensors' | 'inne-wagi' | 'nieznany';
    description: string;
    /** GGUF: czy jest już wykuty w Ollamie. `null` = Ollama milczy, nie wiemy. */
    isInitialized: boolean | null;
    bytes: number;
    gb: number;
    /** Czy da się z tego zrobić model Ollamy. */
    forgeable: boolean;
    /** Nazwa proponowana przy wykuwaniu. */
    suggestedName: string;
}

export interface RejestrModeli {
    katalog: string;
    istnieje: boolean;
    zasoby: ModelResource[];
    ollama: { zywa: boolean; ile: number } | null;
    /** Ile bajtów dołoży się na dysku, gdy wykujemy wszystko niewykute. */
    doWykucia: number;
}

const MOST = 'http://127.0.0.1:3001';

/**
 * Skatalogowanie wag. Nazwa została po pierwotnej wersji, ale nic już nie
 * „inicjalizuje" po cichu — pyta most i oddaje to, co ten naprawdę widzi.
 */
export async function scanAndInitializeModels(): Promise<RejestrModeli> {
    const pusty: RejestrModeli = { katalog: '', istnieje: false, zasoby: [], ollama: null, doWykucia: 0 };
    try {
        const r = await fetch(`${MOST}/api/modele/lokalne`);
        if (!r.ok) return pusty;
        const d = await r.json();
        if (!d?.success) return pusty;

        return {
            katalog: d.katalog ?? '',
            istnieje: !!d.istnieje,
            ollama: d.ollama ?? null,
            doWykucia: d.doWykucia ?? 0,
            zasoby: (d.modele ?? []).map((m: any): ModelResource => ({
                id: m.proponowanaNazwa,
                name: m.plik,
                path: m.sciezka,
                type: m.rodzaj,
                description: m.przeznaczenie,
                isInitialized: m.wykuty,
                bytes: m.bajty,
                gb: m.gb,
                forgeable: !!m.kowalny,
                suggestedName: m.proponowanaNazwa,
            })),
        };
    } catch {
        // Most śpi. Zwracamy pusty rejestr — wołający ma powiedzieć to wprost,
        // zamiast pokazywać starą listę jako aktualną.
        return pusty;
    }
}

export default { scanAndInitializeModels };
