/**
 * 📖 WIKI PROJEKTU — mapa kodu dla Kodeksa i Nocnej Zmiany (od 2026-09-24).
 *
 * Suweren: „potrzebujemy klastra, który stworzy wiki projektu i da agentom/robotom, bo się
 * odnaleźć nie mogą". Dokładnie o to chodzi: model dostaje pliki, ale nie wie, GDZIE co podpiąć,
 * kto kogo importuje i czego nie wolno ruszać. Przy dziewięciu modułach to się rozjeżdża.
 *
 * CO TU JEST: czytanie kodu, nie zgadywanie. Wszystko poniżej wyciągamy deterministycznie
 * z plików (nagłówki, eksporty, importy, kotwice w main.ts), więc wiki nigdy nie kłamie —
 * najwyżej jest uboga. Model nie bierze w tym udziału.
 *
 * GDZIE TRAFIA: `WIKI.md` w katalogu projektu (do czytania przez Suwerena) oraz skrót na górze
 * promptu Kodeksa (`jakoPrompt`). Odświeżane po każdym udanym zleceniu.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

/** Nagłówkowy komentarz pliku (pierwszy blok // albo /* … *\/) — zwykle mówi PO CO ten moduł. */
function naglowek(tresc) {
    const linie = tresc.split('\n');
    const out = [];
    for (const l of linie) {
        const t = l.trim();
        if (!out.length && !t) continue;
        if (/^(\/\/|\/\*|\*)/.test(t)) { out.push(t.replace(/^\/\*+|^\*+\/?|^\/\//, '').trim()); continue; }
        break;
    }
    return out.filter(Boolean).slice(0, 4).join(' ');
}

/** Eksporty: nazwa + surowa sygnatura (bez ciała). */
function eksporty(tresc) {
    return tresc.split('\n')
        .filter((l) => /^export\s+(async\s+)?(function|const|interface|type|class)/.test(l))
        .map((l) => l.replace(/\s*\{\s*$/, '').replace(/;\s*$/, '').trim())
        .slice(0, 14);
}

/** Z jakich lokalnych modułów plik korzysta. */
function importy(tresc) {
    return [...tresc.matchAll(/from\s+['"]\.\/([\w.-]+)['"]/g)].map((m) => m[1].replace(/\.tsx?$/, ''));
}

/**
 * Kotwice w pliku wejściowym: linie, przy których dopina się nowe rzeczy. Szukamy po komentarzach
 * sekcji i charakterystycznych wywołaniach — to one są „adresem" dla nowego kodu.
 */
function kotwice(tresc) {
    const linie = tresc.split('\n');
    const znajdz = (wzor) => { const i = linie.findIndex((l) => wzor.test(l)); return i < 0 ? null : i + 1; };
    return [
        ['pętla gry', znajdz(/^function petla|requestAnimationFrame\(petla\)/)],
        ['budowa HUD-u', znajdz(/stworzHud\(/)],
        ['aktualizacja HUD (raz na klatkę)', znajdz(/aktualizujHud\(\{/)],
        ['reset gry', znajdz(/function resetGry/)],
        ['wczytanie modeli 3D', znajdz(/wczytajModele\(/)],
        ['stan do testów (window.__gra)', znajdz(/window\.__gra = \{/)],
    ].filter(([, l]) => l);
}

/** Zbierz wiedzę o projekcie. `katalog` = katalog projektu (z src/). */
export async function zbierz(katalog) {
    const dirSrc = path.join(katalog, 'src');
    let nazwy = [];
    try { nazwy = (await fs.readdir(dirSrc)).filter((f) => /\.tsx?$/.test(f)); } catch { return null; }

    const moduly = [];
    for (const f of nazwy) {
        const tresc = await fs.readFile(path.join(dirSrc, f), 'utf8');
        moduly.push({
            plik: `src/${f}`,
            nazwa: f.replace(/\.tsx?$/, ''),
            linii: tresc.split('\n').length,
            typy: /\.d\.ts$/.test(f),
            naglowek: naglowek(tresc),
            eksporty: eksporty(tresc),
            importy: importy(tresc),
            kotwice: /^main\./.test(f) ? kotwice(tresc) : [],
        });
    }
    for (const m of moduly) m.uzywanyPrzez = moduly.filter((x) => x.importy.includes(m.nazwa)).map((x) => x.nazwa);

    let assety = [];
    try { assety = JSON.parse(await fs.readFile(path.join(katalog, 'public', 'assety', 'assety.json'), 'utf8')); } catch { /* brak */ }

    let historia = [];
    try {
        const p = JSON.parse(await fs.readFile(path.join(katalog, 'projekt.json'), 'utf8'));
        historia = (p.historia ?? []).slice(-6).map((h) => ({ ok: h.ok, tresc: String(h.tresc).slice(0, 120), commit: h.commit }));
    } catch { /* brak */ }

    return { moduly, assety, historia };
}

/** WIKI.md — dla Suwerena, pełne. */
export function jakoMarkdown(w, nazwaProjektu) {
    if (!w) return '';
    const l = [`# ${nazwaProjektu} — mapa projektu`, '', '_Plik generowany automatycznie po każdym udanym zleceniu Kodeksa. Nie pisz tu ręcznie._', ''];
    l.push('## Moduły', '');
    for (const m of w.moduly) {
        l.push(`### ${m.plik} (${m.linii} linii)${m.typy ? ' — typy' : ''}`);
        if (m.naglowek) l.push(m.naglowek);
        if (m.eksporty.length) l.push('', '```ts', ...m.eksporty, '```');
        l.push('', `_importuje:_ ${m.importy.join(', ') || '—'} · _używany przez:_ ${m.uzywanyPrzez.join(', ') || '— (nikt!)'}`, '');
    }
    const main = w.moduly.find((m) => m.kotwice.length);
    if (main) {
        l.push('## Gdzie co podpiąć (src/main.ts)', '');
        for (const [co, linia] of main.kotwice) l.push(`- **${co}** — linia ~${linia}`);
        l.push('');
    }
    if (w.assety.length) {
        l.push('## Assety 3D (public/assety/)', '');
        for (const a of w.assety) l.push(`- \`${a.plik}\` — ${a.opis || a.nazwa}${a.sciany ? ` (~${a.sciany} ścian)` : ''}`);
        l.push('');
    }
    if (w.historia.length) {
        l.push('## Ostatnie zlecenia', '');
        for (const h of w.historia) l.push(`- ${h.ok ? '✓' : '✗'} ${h.tresc}${h.commit ? ` (${h.commit})` : ''}`);
    }
    return l.join('\n');
}

/** Skrót do promptu Kodeksa — kilkanaście linii, żeby model wiedział, gdzie jest i co gdzie leży. */
export function jakoPrompt(w) {
    if (!w?.moduly?.length) return '';
    const l = ['MAPA PROJEKTU (czytaj, zanim zaczniesz pisać):'];
    for (const m of w.moduly) {
        const kto = m.uzywanyPrzez.length ? `używany przez: ${m.uzywanyPrzez.join(', ')}` : 'NIKT GO NIE UŻYWA';
        l.push(`- ${m.plik} (${m.linii} l.) — ${m.naglowek?.slice(0, 110) || 'bez opisu'} [${kto}]`);
        if (m.eksporty.length) l.push(`    eksportuje: ${m.eksporty.map((e) => e.replace(/^export\s+(async\s+)?(function|const|interface|type|class)\s+/, '').split(/[(:=<]/)[0].trim()).join(', ')}`);
    }
    const main = w.moduly.find((m) => m.kotwice.length);
    if (main) l.push(`GDZIE PODPIĄĆ w ${main.plik}: ` + main.kotwice.map(([co, linia]) => `${co} ~linia ${linia}`).join('; '));
    if (w.assety.length) l.push(`ASSETY: ${w.assety.map((a) => a.plik).join(', ')} (ładuje je src/modele.ts — nie rób własnego GLTFLoadera)`);
    return l.join('\n');
}

/** Zbuduj i zapisz WIKI.md; zwraca skrót do promptu. */
export async function odswiez(katalog, nazwaProjektu) {
    const w = await zbierz(katalog);
    if (!w) return '';
    try { await fs.writeFile(path.join(katalog, 'WIKI.md'), jakoMarkdown(w, nazwaProjektu), 'utf8'); } catch { /* tylko do wglądu */ }
    return jakoPrompt(w);
}

/** Skrót do promptu bez zapisu (gdy WIKI.md już jest albo katalog tylko do odczytu). */
export async function skrot(katalog) {
    if (!fsSync.existsSync(katalog)) return '';
    return jakoPrompt(await zbierz(katalog));
}

export default { zbierz, jakoMarkdown, jakoPrompt, odswiez, skrot };
