/**
 * 🩺 Błędy modeli po ludzku — co znaczy surowy błąd Ollamy i co z nim zrobić (Suweren 2026-10-06: Główny na
 * hf.co/…/Agents-A1-4B-…-GGUF zwracał „API Error 500 … System message must be at the beginning … usually temporary”,
 * a produkcja Teterhii na tym samym 4B padła po 4 rundach „Nie znalazłem żadnego bloku === PLIK”).
 *
 * Surowe „spróbuj za chwilę” kłamie: szablon czatu modelu nie zmieni się za chwilę. Mówimy przyczynę i drogę.
 */

/** Rozmiar modelu z nazwy (miliardy parametrów) — „4b”, „e4b”, „7b”, „0.6b”, „A1-4B”; null = nie wiem. */
export function rozmiarModelu(nazwa) {
    const m = String(nazwa ?? '').toLowerCase().match(/(?:^|[^a-z0-9.])e?(\d+(?:\.\d+)?)b(?![a-z])/g);
    if (!m) return null;
    const liczby = m.map((x) => Number(x.replace(/[^0-9.]/g, ''))).filter((x) => x > 0 && x < 2000);
    return liczby.length ? Math.max(...liczby) : null;
}
/** Mały = ≤ 4B — gubi się w narzędziach Claude Code i w formacie plików Kodeksa. */
export const malyModel = (nazwa) => { const r = rozmiarModelu(nazwa); return r !== null && r <= 4; };

const ZNANE = [
    {
        wzor: /System message must be at the beginning|raise_exception\(['"]System message/i,
        rada: (m) => `Model ${m || 'ten'} ma w szablonie czatu (Jinja z pliku GGUF) zasadę „jedna wiadomość systemowa i tylko na początku”, a Claude Code wysyła rozmowę inaczej — Ollama odrzuci KAŻDĄ wiadomość, ponawianie nic nie da. Wybierz inny model (qwen3-coder, gpt-oss:20b, gemma4 26B/31B) albo popraw TEMPLATE w Modelfile tego modelu.`,
    },
    {
        wzor: /does not support tools|tool(s)? (are )?not supported/i,
        rada: (m) => `Model ${m || 'ten'} nie obsługuje narzędzi (tool calling) w Ollamie — Claude Code bez narzędzi nic w Katedrze nie zrobi. Wybierz model z narzędziami (qwen3-coder, gpt-oss:20b, gemma4).`,
    },
    {
        wzor: /model .* not found|pull model manifest|no such model/i,
        rada: (m) => `Ollama nie ma modelu ${m || ''}. Pobierz go (Kuźnia Modeli → Zwiadowca) albo wybierz inny z listy.`.replace('  ', ' '),
    },
];

/** Wyjaśnienie surowego błędu (albo null, gdy go nie znamy — wtedy zostaje surowy). */
export function wyjasnijBladModelu(tekst, model = '') {
    const t = String(tekst ?? '');
    for (const z of ZNANE) if (z.wzor.test(t)) return z.rada(model);
    return null;
}

/** Podpowiedź do porażki Kodeksa, gdy model nie oddał plików w formacie (mały model to najczęstsza przyczyna). */
export function radaDlaKodeksa(powod, model = '') {
    const p = String(powod ?? '');
    if (!/Nie znalazłem żadnego bloku|bez bloków PLIK|ucięt/i.test(p)) return null;
    return malyModel(model)
        ? `Model ${model} jest mały (≤ 4B) — nie utrzyma formatu plików Kodeksa w dużym projekcie. Daj Kodeksowi większy (Dyrygent gry → „Dobierz modele”, np. qwen2.5-coder:7b+ albo qwen3-coder) i wznów produkcję.`
        : `Model ${model || 'Kodeksa'} nie oddał plików w formacie — spróbuj wznowić albo daj Kodeksowi mocniejszy model kodu.`;
}

export default { rozmiarModelu, malyModel, wyjasnijBladModelu, radaDlaKodeksa };
