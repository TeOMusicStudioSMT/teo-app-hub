/**
 * 🧠 Modele Agentów — każdy TeOgochi może pracować na innym silniku.
 *
 * Suweren (2026-09-24): „każdy może być poustawiany na innym modelu". Joanna na szybkim
 * gemma4:e2b, Kodeks na qwen3.5:9b, Reżyser na większym — każdy według tego, co mu służy.
 * Chmura (`claude:…`, `gemini:…`) tylko jako JAWNY wybór Suwerena, nigdy domyślnie.
 *
 * Plik: _OtakOs_Wymiar/modele-agentow.json → { "<id gatunku>": "<model>" }.
 * Brak wpisu = domyślny silnik Katedry.
 */
import fs from 'fs/promises';
import path from 'path';

let katalog = path.join(process.cwd(), '_OtakOs_Wymiar');
export function skonfiguruj({ katalogWymiar } = {}) { if (katalogWymiar) katalog = katalogWymiar; }
const PLIK = () => path.join(katalog, 'modele-agentow.json');

const ID = /^[a-z0-9-]{2,40}$/;
/** Nazwa modelu Ollamy (`qwen3.5:9b`, `hf.co/x/y:Q4`) albo chmury z prefiksem. */
const MODEL = /^[A-Za-z0-9._:\/-]{2,120}$/;

export async function wszystkie() {
    try { return JSON.parse(await fs.readFile(PLIK(), 'utf8')); } catch { return {}; }
}

export async function modelDla(id, domyslny = null) {
    return (await wszystkie())[id] ?? domyslny;
}

/** Ustaw model agenta; pusty model = powrót do domyślnego. */
export async function ustaw(id, model) {
    if (!ID.test(String(id))) throw new Error('Zły identyfikator agenta.');
    const m = String(model ?? '').trim();
    if (m && !MODEL.test(m)) throw new Error('Zła nazwa modelu.');
    const d = await wszystkie();
    if (m) d[id] = m; else delete d[id];
    await fs.mkdir(katalog, { recursive: true });
    const tmp = `${PLIK()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(d, null, 2), 'utf8');
    await fs.rename(tmp, PLIK());
    return d;
}

export default { skonfiguruj, wszystkie, modelDla, ustaw };
