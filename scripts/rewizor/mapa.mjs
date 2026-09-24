#!/usr/bin/env node
/**
 * 🗺️ Mapa Katedry — jak Katedra wygląda od środka, warstwami (0.00G)
 *
 *   npm run mapa                 podsumowanie w terminalu + docs/mapa-katedry.json
 *   npm run mapa -- --bez-zapisu tylko podsumowanie
 *   npm run mapa -- --repo ../teostory-studio --repo ../TGS
 *                                dołóż klientów z sąsiednich repo (substrony, apki) — liczą się
 *                                tylko wywołania, które trafiają w trasę mostu; własne /api
 *                                innych backendów (Caffe Martens, Dział Mody) nie są mostem.
 *
 * Graphify (/api/wiedza/*) liczy surowy graf AST: funkcja → funkcja. Ta mapa jest o piętro
 * wyżej — o PRZEPŁYWACH, tak jak czyta się system, żeby go zrozumieć:
 *
 *   EKRAN (komponent / lib)  →  DOMENA API (/api/<domena>/…)  →  SERWIS (services/*.js)  →  ŚWIAT
 *                                                                   (Ollama, ComfyUI, dysk, chmura…)
 *
 * Wszystko liczone z kodu, bez modelu i bez sieci. Czego z tego repo nie widać (np. klient
 * trasy żyje w substronie budowanej gdzie indziej), to jest oznaczone jako „poza repo",
 * nie jako „martwe".
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    maskuj, wyciagnijTrasy, wyciagnijWywolania, wzorTrasy, znajdzTrase,
    plikiKlienta, spisPlikow, POMIJANE, wyciagnijSciezkiWs,
} from './analiza.mjs';

/** Świat poza mostem — po czym go poznać w kodzie. */
export const SWIAT = [
    // Wykrywamy po KODZIE (porty, stałe, importy, wywołania), nie po prozie — słowo „ffmpeg"
    // w opisie nagrody to nie render. Komentarze są zaślepione przed dopasowaniem.
    { id: 'ollama', nazwa: 'Ollama (modele lokalne)', re: /11434|ollamaBase|OLLAMA_[A-Z]+|DEFAULT_LLM/ },
    { id: 'comfyui', nazwa: 'ComfyUI (obraz, wideo, 3D)', re: /8188|comfyBase|comfyUrl|COMFY_[A-Z]+|zapewnijComfyUI|zwolnijComfy/ },
    { id: 'glos', nazwa: 'Głos lokalny (Kokoro, Piper, Whisper)', re: /8880|KOKORO_[A-Z]+|PIPER_[A-Z]+|WHISPER_[A-Z]+|glosSyntezuj|syntezuj\(|whisper\w*\(/ },
    { id: 'przegladarka', nazwa: 'Puppeteer (przeglądarka bez okna)', re: /puppeteer/ },
    { id: 'ffmpeg', nazwa: 'FFmpeg (audio / wideo)', re: /ffmpeg-static|fluent-ffmpeg|ffprobe-static|ffmpegPath|FFMPEG|['"]ffmpeg(?:\.exe)?['"]|audioTnij|audioSklej/ },
    { id: 'blender', nazwa: 'Blender', re: /BLENDER_[A-Z]+|['"]blender(?:\.exe)?['"]|Blender\.\w+\(/ },
    { id: 'git', nazwa: 'git', re: /\bgit\(|['"]git['"]\s*,/ },
    { id: 'tunel', nazwa: 'Cloudflare Tunnel', re: /cloudflared|Tunel\.\w+\(|tunelCzyZywy/ },
    { id: 'telefonia', nazwa: 'Twilio (telefon)', re: /api\.twilio\.com|TWILIO_[A-Z]+|telefoniaZadzwon/ },
    { id: 'chmura-ai', nazwa: 'Chmura AI (Gemini, Anthropic, ElevenLabs, Suno) — tylko opcja', re: /generativelanguage\.googleapis|api\.anthropic\.com|api\.elevenlabs\.io|studio-api\.suno|@google\/genai|@google\/generative-ai/ },
    { id: 'blockchain', nazwa: 'Łańcuch / kryptografia (ethers, post-quantum)', re: /from\s+['"]ethers['"]|@noble\/post-quantum|coingecko/ },
];

const swiatW = (tekst) => SWIAT.filter((s) => s.re.test(tekst)).map((s) => s.id);
const rel = (k, p) => path.relative(k, p).split(path.sep).join('/');
const domenaTrasy = (sciezka) => sciezka.split('/')[2] || '(korzeń)';

/**
 * Nazwy lokalne importów mostu → plik serwisu.
 * `import * as X from './services/X.js'`, `import X from …`, `import { a, b as c } from …`.
 */
export function mapaImportow(zrodlo) {
    const out = new Map();
    const kod = maskuj(zrodlo, { szablony: true });
    const re = /\bimport\s+([\s\S]*?)\s+from\s*(['"])(\.\/[^'"]+)\2/g;
    for (const m of kod.matchAll(re)) {
        const cel = m[3].replace(/^\.\//, '');
        if (!/^(services|core|lib)\//.test(cel)) continue;
        const spec = m[1];
        const ns = spec.match(/\*\s+as\s+([\w$]+)/);
        if (ns) out.set(ns[1], cel);
        const def = spec.match(/^([\w$]+)\s*(?:,|$)/);
        if (def) out.set(def[1], cel);
        const nazwane = spec.match(/\{([\s\S]*)\}/);
        if (nazwane) for (const c of nazwane[1].split(',')) {
            const n = c.trim().split(/\s+as\s+/).pop().trim();
            if (n) out.set(n, cel);
        }
    }
    return out;
}

/** Ciało obsługi każdej trasy: od rejestracji do następnej rejestracji (maks. 250 linii). */
function ciala(zrodlo, trasy) {
    const linie = zrodlo.split('\n');
    const pos = [...trasy].sort((a, b) => a.linia - b.linia);
    return new Map(pos.map((t, i) => [t, linie.slice(t.linia - 1, Math.min((pos[i + 1]?.linia ?? t.linia + 80) - 1, t.linia + 250)).join('\n')]));
}

/** Pliki klienta w sąsiednim repo (bez zależności, buildów, minifikatów). */
const POMIJANE_OBCE = ['node_modules', '/dist/', '/.git/', '/build/', '.min.js', '/vendor/'];
function plikiObcegoRepo(katalog) {
    return spisPlikow(katalog, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.html', '.vue', '.kt', '.dart'], POMIJANE_OBCE)
        .filter((p) => { try { return fs.statSync(p).size < 800_000; } catch { return false; } });
}

/**
 * Pełna mapa.
 * @param {string} korzen repo Huba (z wiesio-bridge.js)
 * @param {{ repozytoria?: string[] }} [o] katalogi sąsiednich repo — ich klienci trafiają na mapę
 *        jako `<repo>:<plik>`.
 */
export function zbudujMape(korzen, { repozytoria = [] } = {}) {
    const zrodloMostu = fs.readFileSync(path.join(korzen, 'wiesio-bridge.js'), 'utf8');
    const trasy = wyciagnijTrasy(zrodloMostu).filter((t) => !t.prefiks || t.sciezka.startsWith('/api'));
    const importy = mapaImportow(zrodloMostu);
    const cialo = ciala(zrodloMostu, trasy);

    // ── Serwisy: kto je importuje i z czym rozmawiają ──
    const plikiSerwisow = [
        ...spisPlikow(path.join(korzen, 'services'), ['.js', '.mjs', '.ts'], POMIJANE),
        ...spisPlikow(path.join(korzen, 'core'), ['.js', '.mjs'], POMIJANE),
    ];
    const serwisy = {};
    for (const p of plikiSerwisow) {
        const t = fs.readFileSync(p, 'utf8');
        serwisy[rel(korzen, p)] = { linii: t.split('\n').length, swiat: swiatW(maskuj(t)), domeny: [], importowanyPrzez: [] };
    }
    const wszystkieZrodla = [path.join(korzen, 'wiesio-bridge.js'), ...plikiSerwisow, ...plikiKlienta(korzen)];
    const teksty = new Map(wszystkieZrodla.map((p) => [p, maskuj(fs.readFileSync(p, 'utf8'))]));
    for (const s of Object.keys(serwisy)) {
        const nazwa = path.basename(s).replace(/\.(m?js|ts)$/, '');
        const re = new RegExp(`['"][^'"\\n]*/${nazwa}(?:\\.m?js|\\.ts)?['"]`);
        for (const [p, t] of teksty) if (rel(korzen, p) !== s && re.test(t)) serwisy[s].importowanyPrzez.push(rel(korzen, p));
    }

    // ── Domeny API ──
    const wzory = [...trasy, ...plikiSerwisow.flatMap((p) => wyciagnijSciezkiWs(fs.readFileSync(p, 'utf8')))]
        .map((trasa) => ({ trasa, re: wzorTrasy(trasa) }));
    const klienci = new Map();   // "METODA ścieżka" → Set(plik)
    const ekrany = {};
    for (const p of plikiKlienta(korzen)) {
        const r = rel(korzen, p);
        const serwer = /^(services|core)\//.test(r) && /\.m?js$/.test(r);
        for (const w of wyciagnijWywolania(fs.readFileSync(p, 'utf8'), { serwer })) {
            const t = znajdzTrase(w, wzory);
            if (!t) continue;
            const k = `${t.metoda} ${t.sciezka}`;
            if (!klienci.has(k)) klienci.set(k, new Set());
            klienci.get(k).add(r);
            (ekrany[r] ||= new Set()).add(domenaTrasy(t.sciezka));
        }
    }

    // Sąsiednie repo: tylko wywołania, które trafiają w trasę mostu.
    const obce = [];
    for (const katalog of repozytoria) {
        const nazwa = path.basename(path.resolve(katalog));
        const pliki = plikiObcegoRepo(katalog);
        const trafione = new Set();
        for (const p of pliki) {
            let zrodlo; try { zrodlo = fs.readFileSync(p, 'utf8'); } catch { continue; }
            for (const w of wyciagnijWywolania(zrodlo)) {
                const t = znajdzTrase(w, wzory);
                if (!t) continue;
                const k = `${t.metoda} ${t.sciezka}`, r = `${nazwa}:${rel(katalog, p)}`;
                trafione.add(k);
                if (!klienci.has(k)) klienci.set(k, new Set());
                klienci.get(k).add(r);
                (ekrany[r] ||= new Set()).add(domenaTrasy(t.sciezka));
            }
        }
        obce.push({ nazwa, plikow: pliki.length, trasMostu: trafione.size });
    }

    const domeny = {};
    for (const t of trasy) {
        const d = domenaTrasy(t.sciezka);
        const dom = (domeny[d] ||= { trasy: 0, metody: {}, bezKlientaWRepo: 0, klienci: new Set(), serwisy: new Set(), swiat: new Set(), linie: [] });
        dom.trasy++;
        dom.metody[t.metoda.toUpperCase()] = (dom.metody[t.metoda.toUpperCase()] || 0) + 1;
        dom.linie.push(t.linia);
        const k = `${t.metoda} ${t.sciezka}`;
        if (klienci.has(k)) for (const c of klienci.get(k)) dom.klienci.add(c); else dom.bezKlientaWRepo++;
        const c = maskuj(cialo.get(t) ?? '');
        for (const [nazwa, plik] of importy) {
            if (new RegExp(`\\b${nazwa.replace(/\$/g, '\\$')}\\b`).test(c)) {
                dom.serwisy.add(plik);
                if (serwisy[plik] && !serwisy[plik].domeny.includes(d)) serwisy[plik].domeny.push(d);
            }
        }
        for (const s of swiatW(c)) dom.swiat.add(s);
    }
    // Świat serwisów „przecieka" do domeny, która ich używa.
    for (const dom of Object.values(domeny)) for (const s of dom.serwisy) for (const w of serwisy[s]?.swiat ?? []) dom.swiat.add(w);

    // ── Martwe miejsca ──
    const komponenty = spisPlikow(path.join(korzen, 'components'), ['.tsx', '.ts'], POMIJANE);
    const front = [...plikiKlienta(korzen), path.join(korzen, 'App.tsx'), path.join(korzen, 'index.tsx')].filter((p) => fs.existsSync(p));
    const frontTeksty = new Map(front.map((p) => [p, maskuj(fs.readFileSync(p, 'utf8'))]));
    const nieimportowaneKomponenty = komponenty.filter((c) => {
        const n = path.basename(c).replace(/\.tsx?$/, '');
        const re = new RegExp(`['"][^'"\\n]*/${n}(?:\\.tsx?)?['"]`);
        return ![...frontTeksty].some(([p, t]) => p !== c && re.test(t));
    }).map((c) => rel(korzen, c));
    const nieimportowaneSerwisy = Object.entries(serwisy).filter(([, s]) => !s.importowanyPrzez.length).map(([p]) => p);

    const zbiory = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([a, b]) => [a, b instanceof Set ? [...b].sort() : b]))]));
    return {
        wygenerowano: new Date().toISOString(),
        liczby: {
            trasy: trasy.length, domeny: Object.keys(domeny).length, serwisy: Object.keys(serwisy).length,
            ekrany: Object.keys(ekrany).length, komponenty: komponenty.length,
            trasyBezKlientaWRepo: Object.values(domeny).reduce((a, d) => a + d.bezKlientaWRepo, 0),
        },
        repozytoria: obce,
        swiat: SWIAT.map(({ id, nazwa }) => ({ id, nazwa })),
        domeny: zbiory(domeny),
        serwisy,
        ekrany: Object.fromEntries(Object.entries(ekrany).map(([k, v]) => [k, [...v].sort()])),
        martwe: { komponenty: nieimportowaneKomponenty, serwisy: nieimportowaneSerwisy },
    };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const KORZEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const repozytoria = process.argv.flatMap((a, i, t) => (a === '--repo' && t[i + 1] ? [t[i + 1]] : []));
    const m = zbudujMape(KORZEN, { repozytoria });
    const L = m.liczby;
    console.log('🗺️  MAPA KATEDRY');
    console.log(`   ${L.ekrany} plików frontu woła most · ${L.domeny} domen API · ${L.trasy} tras · ${L.serwisy} serwisów`);
    console.log(`   ${L.trasyBezKlientaWRepo} tras bez klienta ${m.repozytoria.length ? `w ${m.repozytoria.length + 1} przeczytanych repo` : 'w tym repo (dołóż --repo, żeby zajrzeć do substron)'}\n`);
    for (const r of m.repozytoria) console.log(`   + ${r.nazwa.padEnd(26)} ${String(r.plikow).padStart(4)} plików · trafia w ${r.trasMostu} tras mostu`);
    if (m.repozytoria.length) console.log('');
    const top = Object.entries(m.domeny).sort((a, b) => b[1].trasy - a[1].trasy).slice(0, 15);
    for (const [d, x] of top) {
        console.log(`   /api/${d.padEnd(16)} ${String(x.trasy).padStart(3)} tras · ${String(x.klienci.length).padStart(2)} ekranów · serwisy: ${x.serwisy.map((s) => path.basename(s)).slice(0, 3).join(', ') || '—'}${x.swiat.length ? ` · świat: ${x.swiat.join(', ')}` : ''}`);
    }
    console.log(`\n   Komponenty, których nikt nie importuje: ${m.martwe.komponenty.join(', ') || 'brak'}`);
    console.log(`   Serwisy, których nikt nie importuje:    ${m.martwe.serwisy.join(', ') || 'brak'}`);
    if (!process.argv.includes('--bez-zapisu')) {
        const cel = path.join(KORZEN, 'docs', 'mapa-katedry.json');
        fs.mkdirSync(path.dirname(cel), { recursive: true });
        fs.writeFileSync(cel, JSON.stringify(m, null, 2) + '\n');
        console.log(`\n   Zapisano: ${rel(KORZEN, cel)}`);
    }
}
