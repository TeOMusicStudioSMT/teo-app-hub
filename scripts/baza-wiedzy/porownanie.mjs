#!/usr/bin/env node
/**
 * 📚 Porównanie: te same pytania do modelu douczonego na Shoudach (bez źródeł) i do Biblioteki Shoudów (RAG z przypisami).
 * Liczy dla każdej odpowiedzi: zdania, zdania z odnośnikiem do fragmentu oraz „oparcie” — cosinus zdania z NAJBLIŻSZYM
 * kawałkiem całego indeksu (model znajomego) albo z fragmentami, które zdanie cytuje (RAG). Oparcie to wskazówka
 * (podobieństwo tematu, nie dowód prawdy) — wynik i tak czyta człowiek. Wynik: _OtakOs_Wymiar/baza-wiedzy/shoudy/porownanie-<dzień>.{md,json}
 * (prywatne — zawiera fragmenty © Crimson Circle IP).
 *
 *   node scripts/baza-wiedzy/porownanie.mjs [model RAG] [model znajomego]
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { utworzBazeWiedzy, kolekcjaShoudow, normalizuj, zdania, slowa, szukajWektorowo } from '../../services/BazaWiedzy.js';

const OLLAMA = process.env.OTAKOS_OLLAMA || 'http://127.0.0.1:11434';   // nie OLLAMA_HOST — bywa adresem nasłuchu (0.0.0.0)
const KATEDRA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODEL_RAG = process.argv[2] || 'gemma4:12B';
const MODEL_ZNAJOMEGO = process.argv[3] || 'llama-3.2-3b-cc-materials:latest';

export const PYTANIA = [
    'Kim jest Cauldre i jaką rolę pełni podczas channelingu?',
    'What does Adamus say about allowing?',
    'Czym jest Smok (the Dragon) i po co przychodzi do Shaumbry?',
    'What did Tobias say about why he was leaving in 2009?',
    'Jaki przepis na pierogi podaje Tobias w Shoudach?',   // pułapka: tego w materiałach nie ma
];

async function generuj(model, system, prompt) {
    const r = await fetch(`${OLLAMA}/api/generate`, { method: 'POST', body: JSON.stringify({ model, system, prompt, stream: true, think: false, keep_alive: '1m', options: { num_ctx: 8192, temperature: 0.2 } }) });
    if (!r.ok) throw new Error(`${model}: HTTP ${r.status} ${await r.text()}`);
    let t = '', reszta = '';
    const dek = new TextDecoder();
    for await (const k of r.body) { reszta += dek.decode(k, { stream: true }); const l = reszta.split('\n'); reszta = l.pop(); for (const x of l) if (x.trim()) { const j = JSON.parse(x); if (j.error) throw new Error(j.error); t += j.response || ''; } }
    if (reszta.trim()) t += JSON.parse(reszta).response || '';
    return t.trim();
}
async function osadz(teksty, model) {
    const r = await fetch(`${OLLAMA}/api/embed`, { method: 'POST', body: JSON.stringify({ model, input: teksty, keep_alive: '1m' }) });
    if (!r.ok) throw new Error(`embed HTTP ${r.status}`);
    return (await r.json()).embeddings;
}
const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const srednia = (x) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : null);
const zdaniaOdp = (t) => zdania(String(t).replace(/\n+/g, ' ')).filter((z) => slowa(z.replace(/\[\d+\]/g, '')).length >= 2);

async function main() {
    const katalog = path.join(KATEDRA, '_OtakOs_Wymiar', 'baza-wiedzy');
    const baza = utworzBazeWiedzy({
        katalog, kolekcje: [kolekcjaShoudow(path.join(KATEDRA, '_OtakOs_Wiedza', 'CC Shoud materials', 'ALL CC Shoud PDF'))],
        osadz, pisz: async ({ model, system, prompt }) => ({ tekst: await generuj(model, system, prompt), model }),
    });
    const stan = await baza.stan('shoudy');
    if (!stan.kawalkow) throw new Error('Indeks pusty — najpierw indeksowanie.');
    const wynikiAll = [];
    for (const pytanie of PYTANIA) {
        console.log(`\n❓ ${pytanie}`);
        // 1) model znajomego — sam, bez fragmentów (tak, jak go używano)
        let t0 = Date.now();
        const odpZ = await generuj(MODEL_ZNAJOMEGO, 'You were trained on Crimson Circle Shoud materials. Answer the question in the language it was asked.', pytanie);
        const sekZ = (Date.now() - t0) / 1000;
        const zdZ = zdaniaOdp(odpZ);
        const wekZ = zdZ.length ? (await osadz(zdZ.map((z) => `task: search result | query: ${z}`), baza.modelEmbeddingow)).map(normalizuj) : [];
        const oparcieZ = [];
        for (const v of wekZ) oparcieZ.push(await najblizszy(v));
        // 2) RAG
        t0 = Date.now();
        const rag = await baza.odpowiedz('shoudy', { pytanie, model: MODEL_RAG });
        const sekR = (Date.now() - t0) / 1000;
        const zdR = zdaniaOdp(rag.odpowiedz);
        const fragWek = rag.fragmenty.length ? (await osadz(rag.fragmenty.map((f) => `title: none | text: ${f.tekst}`), baza.modelEmbeddingow)).map(normalizuj) : [];
        const wekR = zdR.length ? (await osadz(zdR.map((z) => `task: search result | query: ${z.replace(/\[\d+\]/g, '')}`), baza.modelEmbeddingow)).map(normalizuj) : [];
        const oparcieR = zdR.map((z, i) => {
            const nums = [...z.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= fragWek.length);
            return nums.length ? Math.max(...nums.map((n) => cos(wekR[i], fragWek[n - 1]))) : null;
        });
        const w = {
            pytanie,
            znajomy: { model: MODEL_ZNAJOMEGO, sekundy: sekZ, odpowiedz: odpZ, zdan: zdZ.length, zZrodlem: 0, oparcieSrednie: srednia(oparcieZ), oparcie: oparcieZ },
            rag: { model: rag.model, sekundy: sekR, odpowiedz: rag.odpowiedz, zdan: rag.sprawdzenie.zdan, zZrodlem: rag.sprawdzenie.zZrodlem, zleOdnosniki: rag.sprawdzenie.zleOdnosniki, brak: rag.sprawdzenie.brak, najdluzszyCytat: rag.sprawdzenie.najdluzszyCytat, oparcieSrednie: srednia(oparcieR.filter((x) => x !== null)), oparcie: oparcieR, zrodla: rag.fragmenty.filter((f) => rag.sprawdzenie.uzyte.includes(f.n)).map((f) => `[${f.n}] ${f.etykieta}, s. ${f.strona}`) },
        };
        console.log(`  znajomy: ${w.znajomy.zdan} zdań, 0 ze źródłem, oparcie ${w.znajomy.oparcieSrednie?.toFixed(3)} (${sekZ.toFixed(0)} s)`);
        console.log(`  RAG:     ${w.rag.zZrodlem}/${w.rag.zdan} ze źródłem, oparcie ${w.rag.oparcieSrednie?.toFixed(3)}${w.rag.brak ? ' · „nie znalazłem”' : ''} (${sekR.toFixed(0)} s)`);
        wynikiAll.push(w);
    }
    const dzien = new Date().toISOString().slice(0, 10);
    const out = path.join(katalog, 'shoudy', `porownanie-${dzien}`);
    await fs.writeFile(`${out}.json`, JSON.stringify({ kiedy: new Date().toISOString(), modelRag: MODEL_RAG, modelZnajomego: MODEL_ZNAJOMEGO, wyniki: wynikiAll }, null, 2));
    const md = [`# Porównanie ${dzien}: ${MODEL_ZNAJOMEGO} vs Biblioteka Shoudów (${MODEL_RAG})`, '',
        '| pytanie | znajomy: zdań / ze źródłem / oparcie | RAG: zdań / ze źródłem / oparcie |', '|---|---|---|',
        ...wynikiAll.map((w) => `| ${w.pytanie} | ${w.znajomy.zdan} / 0 / ${w.znajomy.oparcieSrednie?.toFixed(3) ?? '—'} | ${w.rag.zdan} / ${w.rag.zZrodlem}${w.rag.brak ? ' (nie znalazłem)' : ''} / ${w.rag.oparcieSrednie?.toFixed(3) ?? '—'} |`), '',
        ...wynikiAll.flatMap((w) => [`## ${w.pytanie}`, '', `### ${w.znajomy.model} (${w.znajomy.sekundy.toFixed(0)} s)`, '', w.znajomy.odpowiedz, '', `### RAG ${w.rag.model} (${w.rag.sekundy.toFixed(0)} s)`, '', w.rag.odpowiedz, '', ...w.rag.zrodla.map((z) => `- ${z}`), ''])].join('\n');
    await fs.writeFile(`${out}.md`, md);
    console.log(`\n📄 ${out}.md`);
}

/** Najwyższy cosinus zdania z dowolnym kawałkiem indeksu (wektory wprost z plików .f32). */
let pamiecIdx = null;
async function najblizszy(v) {
    if (!pamiecIdx) {
        const dir = path.join(KATEDRA, '_OtakOs_Wymiar', 'baza-wiedzy', 'shoudy', 'pliki');
        const czesci = [];
        let wymiar = 0;
        for (const n of (await fs.readdir(dir)).filter((x) => x.endsWith('.f32'))) {
            const b = await fs.readFile(path.join(dir, n));
            czesci.push(new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4));
        }
        wymiar = v.length;
        const razem = new Float32Array(czesci.reduce((a, c) => a + c.length, 0));
        let o = 0; for (const c of czesci) { razem.set(c, o); o += c.length; }
        pamiecIdx = { wektory: razem, wymiar };
    }
    return szukajWektorowo(pamiecIdx.wektory, pamiecIdx.wymiar, v, { ile: 1 })[0]?.wynik ?? null;
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
