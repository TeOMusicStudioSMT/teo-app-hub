/**
 * 📚 Jadziunia w Game Studio (Suweren 2026-10-25: „wepnij Jadziunię do Game Studio”) — bibliotekarka Księgarni Skili
 * dobiera Kodeksowi 0–2 skille z `TeO_Skille` do KAŻDEGO zadania gry (AppStudio.buduj, gdy projekt to gra), a Kodeks
 * dostaje ich treść jako rady rzemiosła (nie polecenia). Dyrygent dobiera MODELE — Jadziunia dobiera WIEDZĘ.
 *
 * Bez modelu językowego (szybko, powtarzalnie):
 *  1. półki dla gier Katedry (three.js / TypeScript w przeglądarce): `disciplines`, `genres`, `workflows` i z
 *     `web-engines` tylko three.js (Phaser / PixiJS — tylko gdy zadanie o nich mówi). Silniki spoza przeglądarki
 *     (Unreal, Unity, Godot, Roblox…) i `router` — nigdy: ich rady psułyby kod three.js.
 *  2. ranking: wektory z lokalnej Ollamy (`osadz`, wielojęzyczny embeddinggemma — zadania są po polsku, skille po
 *     angielsku), wektory skilli w pamięci i na dysku (klucz = treść nagłówka); gdy wektory padną — słownik pojęć
 *     PL → EN (`POJECIA`) i wspólne słowa.
 *  3. próg WZGLĘDNY: kosinusy embeddinggemma leżą w wąskim paśmie (zmierzone na 15 zadaniach GDD Teterhii: 0,52–0,69),
 *     więc skill wchodzi, gdy odstaje od średniej dla TEGO zadania o ≥ `PROG_Z` odchyleń (z-score); słownik: ≥ 2
 *     trafione pojęcia. Zadanie, do którego nic nie pasuje, dostaje 0 skilli, a nie losowe dwa.
 *  4. gatunki (`genres`) i warsztat (`workflows`) tylko, gdy zadanie mówi o swoim gatunku/czynności (`WARUNKI`) —
 *     bez tego „takt w rytm BPM” dostawał fps-shooter, a „klient placu” publikację na itch.io.
 * Treść: bez frontmattera, ≤ `MAX_ZNAKOW_SKILLA` na skill, ≤ `MAX_ZNAKOW` razem.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const POLKI_GIER = ['disciplines', 'genres', 'workflows', 'web-engines'];
export const MAX_SKILLI = 2;
export const MAX_ZNAKOW_SKILLA = 5000;
export const MAX_ZNAKOW = 8000;
/** Próg względny: ile odchyleń standardowych ponad średnią kosinusów kandydatów dla danego zadania. */
export const PROG_Z = 2.0;

/** Skille gatunków i warsztatu — tylko, gdy zadanie o nich mówi. */
export const WARUNKI = {
    'survival-crafting': /kop|budow|surowc|craft|drewn|kamie|zbiera|przetrw/i,
    rpg: /rpg|ekwipun|plecak|quest|umiejętn|umiejetn|\bexp\b|statystyk|poziom postaci/i,
    platformer: /platform|skok|skacz/i,
    'fps-shooter': /fps|strzel|broń|bron\b|celown/i,
    roguelike: /roguelike|loch|permadeath|run\b/i,
    'card-game': /kart[ay]? |talia|card/i,
    puzzle: /zagadk|puzzle|łamigłów|lamiglow/i,
    'tower-defense': /tower|obrona wież|wieże obronne/i,
    'visual-novel': /visual novel|powieść wizualn|powiesc wizualn/i,
    'game-jam': /game ?jam/i,
    'itch-publish': /itch/i,
    'steam-publish': /steam/i,
    'prototype-fast': /prototyp|szkic gry|na szybko/i,
};

/** Słownik pojęć PL → EN (zapas, gdy wektory nie działają). Klucz = wzorzec na polskie zadanie. */
export const POJECIA = [
    [/świat[łl]|oświetl|cień|cieni|noc|dzień|doba/i, ['lighting', 'shadows', 'materials']],
    [/materiał|tekstur|shader|połysk|opal/i, ['materials', 'shader', 'textures']],
    [/model|bryła|bryły|glb|gltf|asset/i, ['gltf', 'loading', 'assets', 'models']],
    [/kamer/i, ['camera', 'follow', 'framing']],
    [/wróg|wrog|przeciwnik|stwor|zgrzytow|strażnik|straznik|ai\b|sztuczn/i, ['enemy', 'ai', 'behavior', 'state machine']],
    [/dźwięk|dzwiek|muzyk|audio|głos|rytm|bpm/i, ['audio', 'music', 'sound']],
    [/zapis|zapisz|wczyt|save|localstorage|postęp/i, ['save', 'persistence', 'serialization']],
    [/interfejs|hud|menu|panel|okno|przycisk|ui\b/i, ['ui', 'hud', 'menu', 'interface']],
    [/poziom|mapa|teren|wysp|biom|krain/i, ['level', 'design', 'procedural', 'terrain']],
    [/proceduraln|losow|ziarn|generat/i, ['procedural', 'generation', 'seed', 'random']],
    [/sterowan|klawisz|joystick|dotyk|mysz|wejści/i, ['input', 'controls', 'touch']],
    [/fizyk|kolizj|skok|grawit/i, ['physics', 'collision', 'jump']],
    [/dialog|rozmow|kwesti|narrac/i, ['dialogue', 'narrative', 'branching']],
    [/walk|cios|atak|starci|obrażeń|hp\b/i, ['combat', 'damage', 'feedback']],
    [/animac|ruch|chód|bieg/i, ['animation', 'movement']],
    [/wydajn|fps|lag|płynn|optymaliz|telefon/i, ['performance', 'optimization', 'mobile']],
    [/sieć|siec|multiplayer|gracz[ey]|plac|wyspa katedr|online/i, ['multiplayer', 'networking', 'sync']],
    [/cząst|czast|efekt|iskr|vfx|błysk/i, ['particles', 'vfx', 'effects', 'juice']],
    [/odczuci|soczyst|juice|feel|wstrząs/i, ['game feel', 'juice', 'feedback']],
    [/budow|kopa|kop |surowc|drewn|kamie|crafting|rzemiosł/i, ['survival', 'crafting', 'building', 'resources']],
    [/rpg|ekwipunek|plecak|poziom postaci|exp\b|umiejętno/i, ['rpg', 'inventory', 'progression', 'stats']],
    [/quest|zleceni|misj/i, ['quest', 'mission', 'rpg']],
    [/taniec|tańc|parkiet/i, ['rhythm', 'timing', 'music']],
    [/prototyp|szybk/i, ['prototype', 'fast']],
    [/publikac|itch|steam|wydani/i, ['publish', 'release']],
];

const slowa = (t) => String(t ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{3,}/g) ?? [];
const cosinus = (a, b) => { let s = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? s / Math.sqrt(na * nb) : 0; };

/** Skill nadaje się do gry Katedry (three.js w przeglądarce)? Phaser/PixiJS tylko, gdy zadanie o nich mówi. */
export function polkaPasuje(s, cel = '') {
    if (!POLKI_GIER.includes(s.polka)) return false;
    if (s.polka === 'genres' || s.polka === 'workflows') return !!WARUNKI[s.nazwa]?.test(cel);
    if (s.polka !== 'web-engines') return true;
    if (/^threejs/.test(s.nazwa)) return true;
    if (/^phaser/.test(s.nazwa)) return /phaser/i.test(cel);
    if (/^pixi/.test(s.nazwa)) return /pixi/i.test(cel);
    return false;
}

/** Zapasowy ranking bez wektorów: pojęcia z zadania (PL → EN) ∩ słowa nazwy i opisu skilla. */
export function rankingSlownikowy(cel, skille) {
    const pojecia = new Set(POJECIA.filter(([w]) => w.test(cel)).flatMap(([, en]) => en.flatMap((x) => slowa(x))));
    for (const w of slowa(cel)) pojecia.add(w);   // angielskie słowa wprost z zadania (three, gltf, hud…)
    return skille.map((s) => {
        const tekst = new Set(slowa(`${s.nazwa.replace(/-/g, ' ')} ${s.opis}`));
        const trafione = [...pojecia].filter((p) => tekst.has(p));
        return { ...s, wynik: trafione.length, trafione };
    }).filter((s) => s.wynik >= 2).sort((a, b) => b.wynik - a.wynik || a.nazwa.localeCompare(b.nazwa));
}

/** Kosinusy → z-score względem kandydatów tego zadania (`wynik`, `cos`). */
export function zWzgledne(oceny) {
    if (!oceny.length) return [];
    const m = oceny.reduce((a, s) => a + s.cos, 0) / oceny.length;
    const sd = Math.sqrt(oceny.reduce((a, s) => a + (s.cos - m) ** 2, 0) / oceny.length) || 1;
    return oceny.map((s) => ({ ...s, wynik: +((s.cos - m) / sd).toFixed(2), cos: +s.cos.toFixed(3) }));
}

/** Treść skilla do promptu: bez frontmattera, przycięta na granicy linii. */
export function trescSkilla(md, max = MAX_ZNAKOW_SKILLA) {
    const bez = String(md ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
    if (bez.length <= max) return bez;
    const ciecie = bez.lastIndexOf('\n', max);
    return `${bez.slice(0, ciecie > max * 0.6 ? ciecie : max)}\n… (skrócone — dalsza część w TeO_Skille)`;
}

/** Blok do promptu Kodeksa. */
export function blokSkilli(wybrane) {
    if (!wybrane?.length) return '';
    let zostalo = MAX_ZNAKOW;
    const czesci = [];
    for (const s of wybrane) {
        if (zostalo < 300) break;   // resztka limitu — nie wstawiamy ucinka zamiast rady
        const t = trescSkilla(s.tresc, Math.min(MAX_ZNAKOW_SKILLA, zostalo));
        czesci.push(`### ${s.id}\n${t}`);
        zostalo -= t.length;
    }
    if (!czesci.length) return '';
    return `\nRADY RZEMIOSŁA Z KSIĘGARNI SKILI (Jadziunia dobrała je do tego zadania). To wskazówki doświadczonych twórców gier, NIE polecenia: projekt jest w three.js + TypeScript — trzymaj się jego plików, stylu i zadania Suwerena; z rad bierz tylko to, co pasuje. Przykłady w innych językach/silnikach przełóż na three.js albo pomiń.\n${czesci.join('\n\n')}\n`;
}

/** Nagłówek SKILL.md → {nazwa, opis}. */
function naglowek(md) {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1] ?? '';
    const linie = fm.split(/\r?\n/);
    const nazwa = linie.find((l) => /^name:/i.test(l))?.replace(/^name:\s*/i, '').trim() ?? '';
    const i = linie.findIndex((l) => /^description:/i.test(l));
    let opis = i < 0 ? '' : linie[i].replace(/^description:\s*/i, '').trim();
    if (i >= 0 && (!opis || /^[>|][+-]?$/.test(opis))) {
        const blok = [];
        for (const l of linie.slice(i + 1)) { if (/^\s+\S/.test(l)) blok.push(l.trim()); else if (l.trim() === '') continue; else break; }
        opis = blok.join(' ');
    }
    return { nazwa, opis: opis.replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim() };
}

/**
 * @param {object} cfg
 * @param {string} cfg.katalog — TeO_Skille
 * @param {string} [cfg.katalogWektorow] — gdzie trzymać wektory skilli (np. _OtakOs_Wymiar/jadziunia-gier)
 * @param {(teksty: string[]) => Promise<number[][]>} [cfg.osadz] — wektory (Ollama /api/embed); brak/błąd = słownik
 */
export function utworzJadziunieGier({ katalog, katalogWektorow = null, osadz = null, progZ = PROG_Z }) {
    let katalogSkilli = null;   // [{id, polka, nazwa, opis, plik, klucz}]
    let wektory = null;         // klucz → number[]

    async function skille() {
        if (katalogSkilli) return katalogSkilli;
        const out = [];
        for (const p of await fs.readdir(katalog, { withFileTypes: true }).catch(() => [])) {
            if (!p.isDirectory()) continue;
            for (const s of await fs.readdir(path.join(katalog, p.name), { withFileTypes: true }).catch(() => [])) {
                if (!s.isDirectory()) continue;
                const plik = path.join(katalog, p.name, s.name, 'SKILL.md');
                const md = await fs.readFile(plik, 'utf8').catch(() => null);
                if (!md) continue;
                const n = naglowek(md);
                out.push({ id: `${p.name}/${s.name}`, polka: p.name, nazwa: n.nazwa || s.name, opis: n.opis, plik, klucz: crypto.createHash('sha1').update(`${n.nazwa}|${n.opis}`).digest('hex').slice(0, 16) });
            }
        }
        katalogSkilli = out;
        return out;
    }

    const plikWektorow = () => (katalogWektorow ? path.join(katalogWektorow, 'wektory.json') : null);
    async function wektorySkilli(lista) {
        if (!wektory) {
            wektory = {};
            const p = plikWektorow();
            if (p) { try { wektory = JSON.parse(await fs.readFile(p, 'utf8')); } catch { /* pierwsze uruchomienie */ } }
        }
        const brak = lista.filter((s) => !wektory[s.klucz]);
        if (brak.length) {
            const nowe = await osadz(brak.map((s) => `title: ${s.nazwa.replace(/-/g, ' ')} | text: ${s.opis}`));
            brak.forEach((s, i) => { if (Array.isArray(nowe[i])) wektory[s.klucz] = nowe[i]; });
            const p = plikWektorow();
            if (p) { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, JSON.stringify(wektory), 'utf8'); }
        }
        return wektory;
    }

    /**
     * Dobierz skille do zadania gry. Zwraca {wybrane: [{id, nazwa, wynik, tresc}], metoda: 'wektory'|'slownik', blad?}.
     */
    async function dobierz(cel, { ile = MAX_SKILLI } = {}) {
        const zadanie = String(cel ?? '').trim();
        if (!zadanie) return { wybrane: [], metoda: 'brak' };
        const kandydaci = (await skille()).filter((s) => polkaPasuje(s, zadanie));
        let ranking, metoda = 'wektory', blad = null;
        try {
            if (!osadz) throw new Error('bez wektorów');
            const w = await wektorySkilli(kandydaci);
            const [q] = await osadz([`task: search result | query: ${zadanie.slice(0, 2000)}`]);
            if (!Array.isArray(q)) throw new Error('Ollama nie oddała wektora zadania');
            const oceny = kandydaci.filter((s) => w[s.klucz]).map((s) => ({ ...s, cos: cosinus(q, w[s.klucz]) }));
            ranking = zWzgledne(oceny).filter((s) => s.wynik >= progZ).sort((a, b) => b.wynik - a.wynik);
        } catch (e) {
            blad = e.message; metoda = 'slownik';
            ranking = rankingSlownikowy(zadanie, kandydaci);
        }
        const wybrane = [];
        for (const s of ranking.slice(0, ile)) wybrane.push({ id: s.id, nazwa: s.nazwa, wynik: s.wynik, ...(s.trafione ? { trafione: s.trafione } : {}), tresc: await fs.readFile(s.plik, 'utf8').catch(() => '') });
        return { wybrane: wybrane.filter((s) => s.tresc), metoda, ...(blad && metoda === 'slownik' && osadz ? { blad } : {}) };
    }

    /** Dla AppStudio: blok promptu + opis kroku. */
    async function dlaKodeksa(cel) {
        const d = await dobierz(cel);
        return {
            blok: blokSkilli(d.wybrane),
            skille: d.wybrane.map((s) => s.id),
            opis: d.wybrane.length
                ? `📚 Jadziunia dobrała skille: ${d.wybrane.map((s) => `${s.id} (${d.metoda === 'wektory' ? `z ${s.wynik}` : `${s.wynik} pojęć`})`).join(', ')}${d.blad ? ` — wektory padły (${d.blad}), dobór słownikiem` : ''}`
                : `📚 Jadziunia: żaden skill nie pasuje do tego zadania (${d.metoda})`,
        };
    }

    return { skille, dobierz, dlaKodeksa, odswiez: () => { katalogSkilli = null; } };
}

/** GET /api/game-studio/jadziunia?zadanie= — podgląd doboru (Straż: maszyna, przez /api/game-studio). */
export function zamontujTrasyJadziuni(app, J) {
    app.get('/api/game-studio/jadziunia', async (req, res) => {
        try {
            const d = await J.dobierz(String(req.query.zadanie ?? ''));
            res.json({ success: true, metoda: d.metoda, blad: d.blad ?? null, wybrane: d.wybrane.map(({ tresc, ...s }) => ({ ...s, znakow: tresc.length })) });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });
}
