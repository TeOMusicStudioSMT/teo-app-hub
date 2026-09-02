/**
 * 🔨 Kuźnia Modeli — surowe wagi z dysku wchodzą do Ollamy.
 *
 * W `_OtakOs_AI/models` leżą pliki, których Katedra dotąd NIE UMIAŁA użyć:
 * kilkanaście gigabajtów wag GGUF, niewidocznych dla niczego poza Eksploratorem.
 * Ten moduł je katalogizuje i wykuwa — czyli rejestruje w Ollamie, po czym stają
 * się zwykłym modelem, którego może użyć każdy gatunek TeOgochi i każdy panel.
 *
 * DLACZEGO PO STRONIE MOSTU, A NIE W PRZEGLĄDARCE:
 * skan katalogu to `fs.readdir`, a przeglądarka nie ma dostępu do dysku. Kod,
 * który importuje `fs` do komponentu React, zbuduje się i wywali dopiero
 * w oknie — albo, co gorsza, po cichu zwróci pustą listę. Katalog czyta most.
 *
 * ⚠️ KUCIE JEST DŁUGIE I NIEODWRACALNE W JEDNĄ STRONĘ: Ollama kopiuje wagi do
 * własnego magazynu (`~/.ollama/models/blobs`), więc 7 GB pliku zajmie drugie
 * 7 GB. Mówimy o tym WPRZÓD, zamiast zaskakiwać brakiem miejsca w połowie.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

const KATALOG = () => path.join(process.cwd(), '_OtakOs_AI', 'models');

/** Co potrafimy rozpoznać. Reszta trafia na listę jako „nieznane" — bez zgadywania. */
const RODZAJE = [
    { wzor: /\.gguf$/i, rodzaj: 'gguf', przeznaczenie: 'Model językowy — da się wykuć do Ollamy.', kowalny: true },
    { wzor: /^ggml-.*\.bin$/i, rodzaj: 'whisper', przeznaczenie: 'Wagi Whisper.cpp — używa ich transkrypcja mowy.', kowalny: false },
    { wzor: /\.safetensors$/i, rodzaj: 'safetensors', przeznaczenie: 'Wagi difuzyjne/HF — dla ComfyUI, nie dla Ollamy.', kowalny: false },
    { wzor: /\.(bin|pt|pth|onnx)$/i, rodzaj: 'inne-wagi', przeznaczenie: 'Wagi w formacie spoza Ollamy.', kowalny: false },
];

function rozpoznaj(nazwa) {
    for (const r of RODZAJE) if (r.wzor.test(nazwa)) return r;
    return { rodzaj: 'nieznany', przeznaczenie: 'Nie rozpoznaję tego formatu — nie zgaduję, do czego służy.', kowalny: false };
}

/** Modele znane Ollamie, żeby powiedzieć, co jest już wykute. */
async function modeleOllamy(base) {
    try {
        const r = await fetch(`${base}/api/tags`);
        if (!r.ok) return null;
        const d = await r.json();
        return (d.models ?? []).map(m => ({ nazwa: m.name, bajty: m.size ?? 0 }));
    } catch { return null; }
}

/** Nazwa proponowana dla wykutego modelu: `plik.gguf` → `plik` w małych literach. */
export function proponowanaNazwa(plik) {
    return path.basename(plik).replace(/\.[^.]+$/, '')
        .toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'model';
}

export async function skanujModele(ollamaBase) {
    const katalog = KATALOG();
    try { await fs.access(katalog); }
    catch { return { katalog, istnieje: false, modele: [], ollama: null }; }

    const pliki = await fs.readdir(katalog);
    const wOllamie = await modeleOllamy(ollamaBase);

    const modele = [];
    for (const plik of pliki) {
        const pelna = path.join(katalog, plik);
        let st;
        try { st = await fs.stat(pelna); } catch { continue; }
        if (!st.isFile()) continue;

        const r = rozpoznaj(plik);
        const nazwa = proponowanaNazwa(plik);
        // „Wykuty" = Ollama zna model o tej nazwie. Porównanie po nazwie, nie po
        // rozmiarze: Ollama przepakowuje wagi, więc bajty i tak się nie zgodzą.
        const wykuty = wOllamie ? wOllamie.some(m => m.nazwa === nazwa || m.nazwa === `${nazwa}:latest`) : null;

        modele.push({
            plik,
            sciezka: pelna,
            bajty: st.size,
            gb: Math.round((st.size / 1e9) * 10) / 10,
            zmieniony: st.mtime.toISOString(),
            rodzaj: r.rodzaj,
            przeznaczenie: r.przeznaczenie,
            kowalny: r.kowalny,
            proponowanaNazwa: nazwa,
            wykuty,
        });
    }

    modele.sort((a, b) => b.bajty - a.bajty);
    return {
        katalog, istnieje: true, modele,
        ollama: wOllamie ? { zywa: true, ile: wOllamie.length } : { zywa: false, ile: 0 },
        // Suma tego, co dołoży się na dysku, gdy wykujemy wszystko kowalne.
        doWykucia: modele.filter(m => m.kowalny && m.wykuty === false).reduce((s, m) => s + m.bajty, 0),
    };
}

// ── KUCIE ───────────────────────────────────────────────────────────────────

/** Przebiegi kucia trzymamy w pamięci — to stan procesu, nie dane do zachowania. */
const przebiegi = new Map();

export function stanKucia(id) {
    if (id) return przebiegi.get(id) ?? null;
    return [...przebiegi.values()].sort((a, b) => b.start - a.start).slice(0, 10);
}

/**
 * Wykuj model z pliku GGUF.
 *
 * Idzie przez CLI `ollama create`, nie przez API — API w tej wersji chce wag
 * wgranych jako bloby, a my mamy je już na dysku i nie ma powodu kopiować ich
 * dwa razy przez sieć na własnej maszynie.
 */
export async function wykuj({ plik, nazwa, szablon, ollamaBase }) {
    const katalog = KATALOG();
    const pelna = path.join(katalog, path.basename(String(plik || '')));
    if (!fsSync.existsSync(pelna)) return { ok: false, powod: `Nie ma pliku „${plik}" w ${katalog}.` };
    if (!/\.gguf$/i.test(pelna)) {
        return { ok: false, powod: 'Kuć da się tylko GGUF — inne formaty Ollama odrzuci.' };
    }

    const mianoRaw = String(nazwa || proponowanaNazwa(pelna)).trim().toLowerCase();
    const miano = mianoRaw.replace(/[^a-z0-9._:-]+/g, '-');
    if (!miano) return { ok: false, powod: 'Pusta nazwa modelu.' };

    // Modelfile w katalogu tymczasowym. FROM wskazuje wprost na plik z dysku.
    const modelfile = path.join(os.tmpdir(), `otakos-modelfile-${Date.now()}.txt`);
    const tresc = [`FROM ${pelna}`, szablon ? `TEMPLATE """${szablon}"""` : null]
        .filter(Boolean).join('\n') + '\n';
    await fs.writeFile(modelfile, tresc, 'utf8');

    const id = `kucie_${Date.now().toString(36)}`;
    const wpis = {
        id, plik: path.basename(pelna), nazwa: miano, start: Date.now(),
        stan: 'kuje', postep: '', linie: [], blad: null, koniec: null,
    };
    przebiegi.set(id, wpis);

    const proc = spawn('ollama', ['create', miano, '-f', modelfile], { windowsHide: true });

    const dopisz = (buf) => {
        const t = String(buf).replace(/\r/g, '\n');
        for (const l of t.split('\n')) {
            const linia = l.trim();
            if (!linia) continue;
            wpis.postep = linia;
            wpis.linie.push(linia);
            if (wpis.linie.length > 200) wpis.linie.shift();
        }
    };
    proc.stdout.on('data', dopisz);
    proc.stderr.on('data', dopisz);

    proc.on('error', (e) => {
        wpis.stan = 'blad';
        wpis.blad = `Nie mogę uruchomić polecenia ollama: ${e.message}`;
        wpis.koniec = Date.now();
    });

    proc.on('close', async (kod) => {
        await fs.rm(modelfile, { force: true }).catch(() => {});
        if (kod === 0) {
            wpis.stan = 'gotowe';
            wpis.postep = `Model „${miano}" jest w Ollamie.`;
        } else {
            wpis.stan = 'blad';
            // Ostatnia linia z CLI niesie powód; cała reszta to pasek postępu.
            wpis.blad = wpis.linie.slice(-3).join(' | ') || `ollama create zakończył się kodem ${kod}.`;
        }
        wpis.koniec = Date.now();
    });

    return { ok: true, id, nazwa: miano, plik: path.basename(pelna) };
}

export default { skanujModele, wykuj, stanKucia, proponowanaNazwa };
