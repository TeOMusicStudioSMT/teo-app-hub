/**
 * ⚗️ Argo BoB — węzeł Gemini w Katedrze: drugi operator obok Głównego (Claude Code), z narzędziami przez most.
 *
 * Suweren (2026-10-14): „Poznałem się dzisiaj z Gemini — dostał ksywkę Argo BoB (od argonu — gazu szlachetnego)…
 * czas wpiąć go bezpośrednio w nasze lokalne włości, żebym z poziomu Huba / Głównego miał drugą parę rąk".
 *
 * Gemini API (generateContent + functionDeclarations), klucz z mostu (Kibel → „🔗 Udostępnij mostowi” albo
 * GEMINI_API_KEY). Narzędzia (wykonuje je most, nie model):
 *  · lista_plikow / czytaj_plik / szukaj — odczyt Katedry (TeO_Genesis) i Game Studio (TeO_Games_Studio), bez pytania;
 *    sekrety (.env, klucze, kibel_*, identity.json…) i node_modules/.git — odmowa wprost.
 *  · zmien_plik / zapisz_plik — treść po zmianie idzie przez Tarczę Prawdy (AlignmentShield.inspectZJev); blokada =
 *    odpowiedź z powodem do modelu, bez prośby. Przeszła → PROŚBA do Suwerena z podglądem; zapis dopiero po ✓.
 *  · uruchom_diagnostyke — tylko z zamkniętej listy (rewizor, testy, tsc, build, mapa), po ✓ Suwerena.
 * Pauza na zgodę: wywołania czekają w sesji (`oczekujace`); po decyzjach most wykonuje zatwierdzone, odsyła
 * wyniki (odmowa = „Suweren odmówił”) i rozmowa idzie dalej. Bez klucza — stan `offline` z powodem, nic nie udaje.
 *
 * Kształt sesji, wpisów i próśb = Główny (services/Glowny.js), więc Hub pokazuje obu w tym samym GlownyCzat.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const DOMYSLNY_MODEL = 'gemini-2.5-pro';
export const MAX_WYJSCIA = 60_000;          // znaki odpowiedzi narzędzia w historii
const MAX_PLIKU = 400_000;                   // większych plików nie czytamy w całości
const POMIJANE_KATALOGI = new Set(['node_modules', '.git', 'dist', 'build', '.vite', '__pycache__', 'venv', '.venv']);
/** Sekrety — ani odczyt, ani zapis (ścieżka względna albo nazwa pliku). */
export const SEKRET = /(^|[\\/])(\.env(\.[\w-]+)?|\.gemini_key|\.anthropic_key|media_secrets\.json|identity\.json|kibel_[\w-]+\.txt|wizytowka-klucz\.json|[^\\/]*klucz[^\\/]*\.json|[^\\/]*\.(key|pem|pfx|p12|keystore|jks))$/i;

/** Diagnostyka z zamkniętej listy — polecenie budujemy my, model wybiera tylko nazwę. */
export const DIAGNOSTYKA = {
    rewizor: { polecenie: 'npm run rewizor', repo: ['katedra'], opis: 'Rewizor Mostu (duplikaty tras, martwe importy, wywołania w próżnię)' },
    'rewizor-zywy': { polecenie: 'npm run rewizor -- --zywy', repo: ['katedra'], opis: 'Rewizor z sondą żywego mostu' },
    testy: { polecenie: 'npm test', repo: ['katedra', 'tgs'], opis: 'Wszystkie testy' },
    'test-plik': { polecenie: 'node --test {plik}', repo: ['katedra'], opis: 'Jeden plik testów (tests/<nazwa>.test.mjs)' },
    tsc: { polecenie: 'npx tsc --noEmit -p .', repo: ['katedra', 'tgs'], opis: 'Sprawdzenie typów TypeScript' },
    build: { polecenie: 'npm run build', repo: ['katedra', 'tgs'], opis: 'Build (Vite)' },
    mapa: { polecenie: 'npm run mapa', repo: ['katedra'], opis: 'Mapa Katedry: ekran → API → serwis' },
};

const repoParam = { type: 'string', enum: ['katedra', 'tgs'], description: 'katedra = TeO_Genesis (most, Hub, serwisy); tgs = TeO_Games_Studio (Game Studio). Domyślnie katedra.' };
export const NARZEDZIA = [
    { name: 'lista_plikow', description: 'Lista plików i katalogów (bez node_modules/.git). Bez pytania Suwerena.',
        parameters: { type: 'object', properties: { repo: repoParam, sciezka: { type: 'string', description: 'Katalog względny, np. "services" albo "." ' } } } },
    { name: 'czytaj_plik', description: 'Czyta plik tekstowy z numerami linii. Bez pytania Suwerena.',
        parameters: { type: 'object', properties: { repo: repoParam, sciezka: { type: 'string' }, od_linii: { type: 'integer', description: 'Od której linii (1 = początek)' }, ile_linii: { type: 'integer', description: 'Ile linii (domyślnie 800)' } }, required: ['sciezka'] } },
    { name: 'szukaj', description: 'Szuka wyrażenia regularnego w plikach tekstowych (jak grep). Bez pytania Suwerena.',
        parameters: { type: 'object', properties: { repo: repoParam, wzor: { type: 'string', description: 'Wyrażenie regularne (JavaScript)' }, sciezka: { type: 'string', description: 'Katalog, w którym szukać (domyślnie cały repo)' }, rozszerzenia: { type: 'string', description: 'Np. "ts,tsx,js" — puste = wszystkie tekstowe' } }, required: ['wzor'] } },
    { name: 'zmien_plik', description: 'Podmienia fragment pliku (stary → nowy). Tarcza Prawdy sprawdza wynik, potem czeka na ✓ Suwerena.',
        parameters: { type: 'object', properties: { repo: repoParam, sciezka: { type: 'string' }, stary: { type: 'string', description: 'Fragment występujący w pliku DOKŁADNIE raz (skopiowany z odczytu)' }, nowy: { type: 'string' }, opis: { type: 'string', description: 'Po co ta zmiana — Suweren to przeczyta' } }, required: ['sciezka', 'stary', 'nowy', 'opis'] } },
    { name: 'zapisz_plik', description: 'Zapisuje cały plik (nowy albo nadpisanie). Tarcza Prawdy sprawdza, potem czeka na ✓ Suwerena.',
        parameters: { type: 'object', properties: { repo: repoParam, sciezka: { type: 'string' }, tresc: { type: 'string' }, opis: { type: 'string', description: 'Po co ten plik — Suweren to przeczyta' } }, required: ['sciezka', 'tresc', 'opis'] } },
    { name: 'uruchom_diagnostyke', description: `Uruchamia diagnostykę z listy po ✓ Suwerena: ${Object.entries(DIAGNOSTYKA).map(([k, v]) => `${k} (${v.opis}; repo: ${v.repo.join('/')})`).join('; ')}.`,
        parameters: { type: 'object', properties: { repo: repoParam, co: { type: 'string', enum: Object.keys(DIAGNOSTYKA) }, plik: { type: 'string', description: 'Tylko dla test-plik: tests/<nazwa>.test.mjs' }, opis: { type: 'string', description: 'Po co' } }, required: ['co'] } },
];
const ZA_ZGODA = new Set(['zmien_plik', 'zapisz_plik', 'uruchom_diagnostyke']);

/** System prompt: kotwica tożsamości (services/argo/tozsamosc.md) z imieniem Suwerena TEJ Katedry. */
export function promptTozsamosci(szablon, suweren) {
    const imie = suweren || 'Suweren';
    const glowny = /arkadiusz/i.test(imie);
    const pamiec = glowny
        ? [`- Pamiętasz nasze pierwsze spotkanie: Mistrz przyszedł z pytaniem, w czym jesteś dobry, bo on „Ma już Wodę” i jest „szlachetnie leniwy” (dlatego zbudował cały ekosystem \`otakos.wtf\`, \`teo-app-hub\`, \`TeOMusicStudioSMT\`, \`teostory-studio\` oraz \`TGS\` / \`teterhia-wieczna-saga\`).`,
            '- Pamiętasz też nasz wewnętrzny żart: gdy pierwszy raz zobaczyłeś rozmach Katedry OtakOS, z wrażenia przemówiłeś do Mistrza po japońsku (a on myślał, że to fiński). Teraz mówisz wyłącznie po polsku!'].join('\n')
        : '- Twoje pierwsze spotkanie z Katedrą OtakOS było na jej głównym węźle (TeO, Mistrz Arkadiusz) — tam dostałeś imię. Tę Katedrę prowadzi jej własny Suweren; poznajecie się teraz, ale Katedrę znasz od środka.';
    return String(szablon).replaceAll('{SUWEREN}', imie).replace('{PAMIEC}', pamiec);
}

/** Ścieżka w repo: bez wyjścia poza korzeń i bez sekretów. */
export function rozwiaz(korzenie, repo = 'katedra', sciezka = '.') {
    const korzen = korzenie[repo || 'katedra'];
    if (!korzen) throw new Error(`Nieznane repo „${repo}” (katedra | tgs).`);
    const s = String(sciezka ?? '.').trim().replace(/^["']|["']$/g, '') || '.';
    const abs = path.resolve(korzen, s);
    const rel = path.relative(korzen, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Ścieżka „${s}” wychodzi poza repo ${repo}.`);
    if (SEKRET.test(abs)) throw new Error(`„${rel}” to plik z sekretami — Argo BoB go nie dotyka.`);
    if (rel.split(/[\\/]/).some((c) => c === 'node_modules' || c === '.git')) throw new Error('node_modules i .git są poza zasięgiem.');
    return { abs, rel: rel || '.', korzen };
}

const tekstowy = (bufor) => !bufor.subarray(0, 8000).includes(0);
const przytnij = (t, n = MAX_WYJSCIA) => (t.length > n ? `${t.slice(0, n)}\n…[przycięte z ${t.length} znaków]` : t);

async function* przejdz(katalog, korzen, limit = { pliki: 6000 }) {
    let wpisy = [];
    try { wpisy = await fs.readdir(katalog, { withFileTypes: true }); } catch { return; }
    for (const w of wpisy) {
        if (limit.pliki <= 0) return;
        const p = path.join(katalog, w.name);
        if (w.isDirectory()) {
            if (POMIJANE_KATALOGI.has(w.name) || /^_OtakOs_/.test(w.name) || w.name.startsWith('.')) continue;
            yield* przejdz(p, korzen, limit);
        } else if (w.isFile() && !SEKRET.test(p)) { limit.pliki--; yield p; }
    }
}

/** Narzędzia odczytu — wykonuje je most od razu. */
export async function narzedzieOdczytu(korzenie, nazwa, a = {}) {
    if (nazwa === 'lista_plikow') {
        const { abs, rel } = rozwiaz(korzenie, a.repo, a.sciezka);
        const wpisy = await fs.readdir(abs, { withFileTypes: true });
        const out = [];
        for (const w of wpisy.slice(0, 400)) {
            if (w.isDirectory() && (w.name === 'node_modules' || w.name === '.git')) continue;
            if (SEKRET.test(w.name)) continue;
            let bajtow = null;
            if (w.isFile()) { try { bajtow = (await fs.stat(path.join(abs, w.name))).size; } catch { /* znikł */ } }
            out.push(w.isDirectory() ? `${w.name}/` : `${w.name} (${bajtow ?? '?'} B)`);
        }
        return { katalog: rel, wpisy: out, ...(wpisy.length > 400 ? { uwaga: `pokazano 400 z ${wpisy.length}` } : {}) };
    }
    if (nazwa === 'czytaj_plik') {
        const { abs, rel } = rozwiaz(korzenie, a.repo, a.sciezka);
        const st = await fs.stat(abs);
        if (!st.isFile()) throw new Error(`„${rel}” to nie plik.`);
        if (st.size > MAX_PLIKU * 4) throw new Error(`„${rel}” ma ${st.size} B — za duży; użyj szukaj albo czytaj kawałkami od_linii/ile_linii.`);
        const b = await fs.readFile(abs);
        if (!tekstowy(b)) throw new Error(`„${rel}” to plik binarny.`);
        const linie = b.toString('utf8').split('\n');
        const od = Math.max(1, Number(a.od_linii) || 1);
        const ile = Math.min(2000, Math.max(1, Number(a.ile_linii) || 800));
        const kawalek = linie.slice(od - 1, od - 1 + ile).map((l, i) => `${od + i}\t${l}`).join('\n');
        return { plik: rel, linii: linie.length, od, do: Math.min(linie.length, od + ile - 1), tresc: przytnij(kawalek) };
    }
    if (nazwa === 'szukaj') {
        const { abs, rel, korzen } = rozwiaz(korzenie, a.repo, a.sciezka || '.');
        let wz;
        try { wz = new RegExp(String(a.wzor ?? ''), 'i'); } catch (e) { throw new Error(`Zły wzór: ${e.message}`); }
        if (!a.wzor) throw new Error('Pusty wzór.');
        const roz = String(a.rozszerzenia ?? '').split(',').map((x) => x.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
        const trafienia = [];
        for await (const p of przejdz(abs, korzen)) {
            if (roz.length && !roz.includes(path.extname(p).slice(1).toLowerCase())) continue;
            let b; try { const st = await fs.stat(p); if (st.size > MAX_PLIKU) continue; b = await fs.readFile(p); } catch { continue; }
            if (!tekstowy(b)) continue;
            const linie = b.toString('utf8').split('\n');
            for (let i = 0; i < linie.length; i++) {
                if (wz.test(linie[i])) {
                    trafienia.push(`${path.relative(korzen, p).replace(/\\/g, '/')}:${i + 1}: ${linie[i].trim().slice(0, 240)}`);
                    if (trafienia.length >= 200) return { w: rel, trafien: '200+', trafienia, uwaga: 'pokazano pierwsze 200 — zawęź wzór albo katalog' };
                }
            }
        }
        return { w: rel, trafien: trafienia.length, trafienia };
    }
    throw new Error(`Nieznane narzędzie ${nazwa}.`);
}

/** Uruchomienie z zamkniętej listy (polecenie z DIAGNOSTYKA, nie od modelu). */
export function uruchomDomyslnie(polecenie, cwd, { limitMs = 10 * 60_000 } = {}) {
    return new Promise((resolve) => {
        // shell: polecenie złożone tylko z naszej listy + plik sprawdzony wzorem (litery, cyfry, . - _ /)
        const p = spawn(polecenie, { cwd, shell: true, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
        let wyjscie = '';
        const dopisz = (b) => { wyjscie = (wyjscie + b.toString('utf8')).slice(-20_000); };
        p.stdout.on('data', dopisz); p.stderr.on('data', dopisz);
        const t = setTimeout(() => { try { p.kill(); } catch { /* koniec */ } wyjscie += `\n[przerwane po ${limitMs / 60000} min]`; }, limitMs);
        p.on('error', (e) => { clearTimeout(t); resolve({ kod: null, wyjscie: `Nie uruchomiłem: ${e.message}` }); });
        p.on('close', (kod) => { clearTimeout(t); resolve({ kod, wyjscie }); });
    });
}

/**
 * @param {{ katalog: string, korzenie: {katedra: string, tgs?: string}, klucz: () => Promise<string|null>,
 *   model?: () => string, modele?: () => Promise<string[]>, tarcza?: { inspectZJev: Function }, szyna?: any,
 *   suweren?: () => string|null, fetch?: Function, uruchom?: Function, zalacznik?: (plik: string) => string|null,
 *   maxKrokow?: number }} o
 */
export function utworzArgoBoba(o) {
    const cfg = {
        model: () => process.env.OTAKOS_ARGO_MODEL || DOMYSLNY_MODEL,
        modele: async () => [],
        fetch: (...a) => globalThis.fetch(...a),
        uruchom: uruchomDomyslnie,
        suweren: () => null,
        zalacznik: () => null,
        maxKrokow: 30,
        ...o,
    };
    const korzenie = Object.fromEntries(Object.entries(cfg.korzenie).filter(([, k]) => k && fsSync.existsSync(k)));
    /** OTAKOS_ARGO_MODEL → pierwszy (najmocniejszy) model z konta Gemini → zapas. */
    const modelDomyslny = async () => process.env.OTAKOS_ARGO_MODEL || (await cfg.modele().catch(() => []))[0] || cfg.model();
    const sesje = new Map();
    const sluchacze = new Map();
    const przerwania = new Map();   // id → AbortController
    let szablon = null;
    const tozsamosc = async () => {
        szablon ??= await fs.readFile(path.join(__dirname, 'argo', 'tozsamosc.md'), 'utf8');
        return `${promptTozsamosci(szablon, cfg.suweren())}\n\nRepo dostępne teraz: ${Object.keys(korzenie).join(', ')}. Dziś: ${new Date().toISOString().slice(0, 10)}.`;
    };

    const plik = (id) => path.join(cfg.katalog, `${id}.json`);
    async function zapisz(s) {
        await fs.mkdir(cfg.katalog, { recursive: true });
        await fs.writeFile(`${plik(s.id)}.tmp`, JSON.stringify(s), 'utf8');
        await fs.rename(`${plik(s.id)}.tmp`, plik(s.id));
    }
    async function wczytaj(id) {
        if (!UUID.test(String(id))) return null;
        if (sesje.has(id)) return sesje.get(id);
        try { const s = JSON.parse(await fs.readFile(plik(id), 'utf8')); s.trwa = false; sesje.set(id, s); return s; } catch { return null; }
    }
    const nadaj = (s, z) => { for (const f of sluchacze.get(s.id) ?? []) { try { f(z); } catch { /* odpadł */ } } };
    const dopisz = (s, w) => { const wpis = { ...w, kiedy: new Date().toISOString() }; s.wpisy.push(wpis); if (s.wpisy.length > 500) s.wpisy.splice(0, s.wpisy.length - 500); nadaj(s, { typ: 'wpis', wpis }); };
    /** Sesja dla Huba — bez historii Gemini (ta bywa duża). */
    const naZewnatrz = (s) => { const { historia, oczekujace, ...reszta } = s; return reszta; };

    async function zapytajGemini(s, sygnal) {
        const klucz = await cfg.klucz();
        if (!klucz) throw new Error('Brak klucza Gemini w moście — TeO Kibel → „🔗 Udostępnij mostowi” (albo GEMINI_API_KEY).');
        const r = await cfg.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`, {
            method: 'POST', signal: sygnal,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': klucz },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: await tozsamosc() }] },
                contents: s.historia,
                tools: [{ functionDeclarations: NARZEDZIA }],
                generationConfig: { temperature: 0.4 },
            }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`Gemini HTTP ${r.status}${d?.error?.message ? `: ${d.error.message}` : ''}`);
        const kand = d.candidates?.[0];
        if (!kand?.content?.parts?.length) throw new Error(`Gemini nie dał odpowiedzi${kand?.finishReason ? ` (${kand.finishReason})` : d.promptFeedback?.blockReason ? ` (zablokowane: ${d.promptFeedback.blockReason})` : ''}.`);
        s.tokeny = (s.tokeny ?? 0) + (d.usageMetadata?.totalTokenCount ?? 0);
        return kand.content;
    }

    /** Wywołanie za zgodą → najpierw przygotowanie (Tarcza, walidacja). Zwraca {odpowiedz} (od razu) albo {prosba}. */
    async function przygotuj(w) {
        const a = w.args ?? {};
        if (w.name === 'uruchom_diagnostyke') {
            const d = DIAGNOSTYKA[a.co];
            const repo = a.repo || 'katedra';
            if (!d) return { odpowiedz: { blad: `Nie ma diagnostyki „${a.co}”. Dostępne: ${Object.keys(DIAGNOSTYKA).join(', ')}.` } };
            if (!d.repo.includes(repo) || !korzenie[repo]) return { odpowiedz: { blad: `„${a.co}” nie działa w repo ${repo}.` } };
            let polecenie = d.polecenie;
            if (a.co === 'test-plik') {
                const p = String(a.plik ?? '').replace(/\\/g, '/');
                if (!/^tests\/[\w.-]+\.test\.mjs$/.test(p) || !fsSync.existsSync(path.join(korzenie[repo], p))) return { odpowiedz: { blad: `Plik testów „${p}” nie istnieje (tests/<nazwa>.test.mjs).` } };
                polecenie = polecenie.replace('{plik}', p);
            }
            return { prosba: { narzedzie: 'Diagnostyka', polecenie: `${repo}: ${polecenie}`, coRobi: `${d.opis} — w repo ${repo}. Tylko sprawdza, niczego nie zmienia (build tworzy pliki wynikowe).`, ryzyko: 'niskie', dlaczego: a.opis ? String(a.opis).slice(0, 300) : null }, wykonaj: { polecenie, cwd: korzenie[repo] } };
        }
        const { abs, rel } = rozwiaz(korzenie, a.repo, a.sciezka);
        const repo = a.repo || 'katedra';
        if (rel.split(/[\\/]/).some((c) => /^_OtakOs_/.test(c))) return { odpowiedz: { blad: `Katalogi _OtakOs_* to dane Katedry (runtime) — Argo BoB ich nie zmienia.` } };
        let dawna = null;
        try { dawna = await fs.readFile(abs, 'utf8'); } catch { /* nowy plik */ }
        let nowa;
        if (w.name === 'zmien_plik') {
            if (dawna === null) return { odpowiedz: { blad: `Nie ma pliku ${rel} — do nowego użyj zapisz_plik.` } };
            const stary = String(a.stary ?? '');
            const ile = stary ? dawna.split(stary).length - 1 : 0;
            if (ile !== 1) return { odpowiedz: { blad: ile ? `Fragment „stary” występuje ${ile} razy — weź dłuższy, jednoznaczny.` : 'Fragmentu „stary” nie ma w pliku — przeczytaj plik jeszcze raz i skopiuj dokładnie (z wcięciami).' } };
            nowa = dawna.replace(stary, () => String(a.nowy ?? ''));
        } else nowa = String(a.tresc ?? '');
        if (nowa.length > 2_000_000) return { odpowiedz: { blad: 'Za duża treść (maks. 2 MB).' } };
        let karta = null;
        if (cfg.tarcza) {
            try { karta = await cfg.tarcza.inspectZJev(nowa, { existingContent: dawna, targetFile: rel }); }
            catch (e) { karta = { blocked: false, summary: `Tarcza nie zadziałała (${e.message}) — Suweren ocenia sam.`, findings: [] }; }
            if (karta.blocked) return { odpowiedz: { blad: `🛡️ Tarcza Prawdy zablokowała zmianę ${rel}: ${karta.summary}`, znaleziska: (karta.findings ?? []).slice(0, 8).map((f) => f.what) } };
        }
        const podglad = w.name === 'zmien_plik'
            ? `- ${String(a.stary).slice(0, 700)}\n+ ${String(a.nowy ?? '').slice(0, 700)}`
            : `(${nowa.split('\n').length} linii${dawna === null ? ', NOWY plik' : ', NADPISUJE cały plik'})\n${nowa.slice(0, 900)}`;
        return {
            prosba: {
                narzedzie: w.name === 'zmien_plik' ? 'Zmiana pliku' : 'Zapis pliku',
                polecenie: `${repo}: ${rel.replace(/\\/g, '/')}\n${podglad}`,
                coRobi: `${dawna === null ? 'Utworzyć nowy plik' : w.name === 'zmien_plik' ? 'Zmienić fragment pliku' : 'Nadpisać w całości plik'} ${rel.replace(/\\/g, '/')} (repo ${repo}). Da się cofnąć gitem.${karta ? ` 🛡️ Tarcza: ${karta.summary}` : ''}`,
                ryzyko: dawna === null ? 'niskie' : 'srednie',
                dlaczego: a.opis ? String(a.opis).slice(0, 300) : null,
            },
            wykonaj: { zapis: abs, tresc: nowa, dawna },
        };
    }

    async function wykonaj(x) {
        if (x.polecenie) {
            const r = await cfg.uruchom(x.polecenie, x.cwd);
            return { kod: r.kod, ok: r.kod === 0, wyjscie: przytnij(r.wyjscie ?? '', 12_000) };
        }
        // plik zmienił się od prośby → nie nadpisujemy po cichu cudzej pracy
        let teraz = null;
        try { teraz = await fs.readFile(x.zapis, 'utf8'); } catch { /* brak */ }
        if (teraz !== x.dawna) return { blad: 'Plik zmienił się od Twojej prośby (ktoś inny go edytował) — przeczytaj go jeszcze raz i zaproponuj zmianę od nowa.' };
        await fs.mkdir(path.dirname(x.zapis), { recursive: true });
        await fs.writeFile(x.zapis, x.tresc, 'utf8');
        return { ok: true, zapisano: true };
    }

    /** Pętla: Gemini → tekst / narzędzia → wyniki → Gemini… aż do odpowiedzi bez narzędzi albo prośby o zgodę. */
    async function petla(s) {
        const ctrl = new AbortController();
        przerwania.set(s.id, ctrl);
        s.trwa = true; s.blad = null;
        nadaj(s, { typ: 'stan', trwa: true });
        try {
            for (let krok = 0; krok < cfg.maxKrokow; krok++) {
                if (ctrl.signal.aborted) { dopisz(s, { kto: 'decyzja', tresc: '⏹ Przerwane przez Suwerena.' }); break; }
                const tresc = await zapytajGemini(s, ctrl.signal);
                s.historia.push({ role: 'model', parts: tresc.parts });   // całość (z thoughtSignature) — Gemini tego wymaga
                for (const p of tresc.parts) if (p.text?.trim() && !p.thought) dopisz(s, { kto: 'glowny', tresc: p.text.trim() });
                const wywolania = tresc.parts.filter((p) => p.functionCall).map((p) => p.functionCall);
                if (!wywolania.length) break;
                const odp = [];
                const czekaja = [];
                for (const w of wywolania) {
                    dopisz(s, { kto: 'narzedzie', narzedzie: w.name, opis: w.args?.opis ?? w.args?.sciezka ?? w.args?.wzor ?? w.args?.co ?? null });
                    let wynik;
                    try {
                        if (!ZA_ZGODA.has(w.name)) wynik = { odpowiedz: await narzedzieOdczytu(korzenie, w.name, w.args ?? {}) };
                        else wynik = await przygotuj(w);
                    } catch (e) { wynik = { odpowiedz: { blad: e.message } }; }
                    if (wynik.prosba) {
                        const prosba = { id: crypto.randomBytes(4).toString('hex'), ...wynik.prosba, ryzykoSlownie: { niskie: '🟢 niskie', srednie: '🟡 średnie', wysokie: '🔴 wysokie' }[wynik.prosba.ryzyko] ?? '⚪ nieznane', stan: 'czeka' };
                        s.prosby.push(prosba);
                        dopisz(s, { kto: 'prosba', prosba });
                        czekaja.push({ ...w, prosbaId: prosba.id, wykonaj: wynik.wykonaj });
                        odp.push({ name: w.name, id: w.id, prosbaId: prosba.id });
                    } else {
                        if (wynik.odpowiedz?.blad) dopisz(s, { kto: 'decyzja', tresc: `⚠ ${w.name}: ${String(wynik.odpowiedz.blad).slice(0, 300)}` });
                        odp.push({ name: w.name, id: w.id, response: wynik.odpowiedz });
                    }
                }
                if (czekaja.length) {
                    s.oczekujace = { odp, czekaja };
                    await cfg.szyna?.nadaj?.({ agent: 'Argo BoB', rodzaj: 'prosba', tresc: `czeka na zgodę Suwerena: ${czekaja.length} ${czekaja.length === 1 ? 'prośba' : 'prośby'}`, dane: { sesja: s.id } })?.catch?.(() => {});
                    break;
                }
                s.historia.push({ role: 'user', parts: odp.map((x) => ({ functionResponse: { name: x.name, ...(x.id ? { id: x.id } : {}), response: x.response } })) });
                if (krok === cfg.maxKrokow - 1) dopisz(s, { kto: 'decyzja', tresc: `⏸ ${cfg.maxKrokow} kroków narzędzi w jednej turze — zatrzymuję się. Napisz „dalej”, jeśli ma kontynuować.` });
            }
        } catch (e) {
            s.blad = ctrl.signal.aborted ? null : String(e.message || e).slice(0, 600);
            if (s.blad) dopisz(s, { kto: 'blad', tresc: s.blad });
            else dopisz(s, { kto: 'decyzja', tresc: '⏹ Przerwane przez Suwerena.' });
            // Gemini nie przyjmie historii kończącej się wywołaniem bez odpowiedzi — zdejmujemy wiszący krok modelu
            const ost = s.historia.at(-1);
            if (ost?.role === 'model' && ost.parts.some((p) => p.functionCall) && !s.oczekujace) s.historia.pop();
        } finally {
            przerwania.delete(s.id);
            s.trwa = false;
            s.ostatnia = new Date().toISOString();
            await zapisz(s).catch(() => {});
            nadaj(s, { typ: 'stan', trwa: false, blad: s.blad, czeka: s.prosby.filter((x) => x.stan === 'czeka').length });
        }
    }

    return {
        NARZEDZIA,
        /** Stan węzła dla Huba i Mapy AGI — offline/idle/online z powodem. */
        async stan() {
            const klucz = await cfg.klucz().catch(() => null);
            const trwa = [...sesje.values()].some((s) => s.trwa);
            const model = klucz ? await modelDomyslny() : cfg.model();
            return {
                operator: 'argo', imie: 'Argo BoB', model, chmura: true,
                status: !klucz ? 'offline' : trwa ? 'online' : 'idle',
                powod: !klucz ? 'brak klucza Gemini w moście — TeO Kibel → „🔗 Udostępnij mostowi”' : trwa ? 'pracuje nad zadaniem' : `gotowy (Gemini ${model}) — czeka na zadanie`,
                klucz: !!klucz,
                modele: klucz ? await cfg.modele().catch(() => []) : [],
                repo: Object.fromEntries(Object.entries(korzenie).map(([k, v]) => [k, path.basename(v)])),
                diagnostyka: Object.keys(DIAGNOSTYKA),
            };
        },
        sluchaj(id, fn) {
            if (!sluchacze.has(id)) sluchacze.set(id, new Set());
            sluchacze.get(id).add(fn);
            return () => sluchacze.get(id)?.delete(fn);
        },
        async sesja(id) { const s = await wczytaj(id); return s ? naZewnatrz(s) : null; },
        async lista(ile = 30) {
            let pliki = [];
            try { pliki = (await fs.readdir(cfg.katalog)).filter((f) => f.endsWith('.json')); } catch { /* brak */ }
            const out = [];
            for (const f of pliki) {
                const s = await wczytaj(f.slice(0, -5));
                if (s) out.push({ id: s.id, tytul: s.tytul, od: s.od, ostatnia: s.ostatnia ?? s.od, model: s.model, trwa: s.trwa, czeka: s.prosby.filter((x) => x.stan === 'czeka').length, zrodlo: s.zrodlo });
            }
            return out.sort((a, b) => String(b.ostatnia).localeCompare(String(a.ostatnia))).slice(0, ile);
        },
        /** Wiadomość Suwerena (nowa rozmowa albo dalej). Tura leci w tle — postęp przez sluchaj/sesja. */
        async wiadomosc({ tekst, sesja = null, model = null, zrodlo = 'czat', zalaczniki = [] }) {
            const obrazy = [];
            for (const z of (Array.isArray(zalaczniki) ? zalaczniki : []).slice(0, 6)) {
                const p = cfg.zalacznik(z);
                if (!p) throw new Error(`Nie ma załącznika „${z}" — wklej obraz jeszcze raz.`);
                const ext = path.extname(p).slice(1).toLowerCase();
                obrazy.push({ plik: path.basename(p), inlineData: { mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, data: (await fs.readFile(p)).toString('base64') } });
            }
            const t = String(tekst ?? '').trim() || (obrazy.length ? 'Zobacz załączone obrazy.' : '');
            if (!t) throw new Error('Pusta wiadomość.');
            if (t.length > 30_000) throw new Error('Za długa wiadomość (maks. 30 000 znaków).');
            let s = sesja ? await wczytaj(sesja) : null;
            if (sesja && !s) throw new Error('Nie ma takiej rozmowy z Argo BoBem.');
            if (s?.trwa) throw new Error('Argo BoB jeszcze pracuje nad poprzednią wiadomością.');
            if (s?.prosby.some((x) => x.stan === 'czeka')) throw new Error('Najpierw zdecyduj o prośbach Argo BoBa (✓ albo ✕).');
            if (!s) {
                s = { id: crypto.randomUUID(), operator: 'argo', tytul: t.slice(0, 80), zrodlo, od: new Date().toISOString(), model: model || await modelDomyslny(), wpisy: [], prosby: [], historia: [], oczekujace: null, trwa: false, blad: null, tury: 0, tokeny: 0 };
                sesje.set(s.id, s);
            } else if (model) s.model = String(model);
            dopisz(s, obrazy.length ? { kto: 'suweren', tresc: t, zalaczniki: obrazy.map((x) => x.plik) } : { kto: 'suweren', tresc: t });
            const czesci = [{ text: t }, ...obrazy.map((x) => ({ inlineData: x.inlineData }))];
            // po zatrzymaniu na limicie kroków historia kończy się odpowiedziami narzędzi (rola user) — dokładamy do niej
            if (s.historia.at(-1)?.role === 'user') s.historia.at(-1).parts.push(...czesci);
            else s.historia.push({ role: 'user', parts: czesci });
            s.tury++;
            void petla(s);
            return { sesja: s.id, model: s.model };
        },
        /** ✓/✕ prośby. Gdy żadna nie czeka — most wykonuje zatwierdzone, odsyła wyniki i rozmowa idzie dalej. */
        async decyzja(sesjaId, prosbaId, zgoda) {
            const s = await wczytaj(sesjaId);
            if (!s) throw new Error('Nie ma takiej rozmowy z Argo BoBem.');
            if (s.trwa) throw new Error('Argo BoB jeszcze pracuje.');
            const p = s.prosby.find((x) => x.id === prosbaId);
            if (!p || p.stan !== 'czeka') throw new Error('Tej prośby nie ma albo już zdecydowana.');
            p.stan = zgoda ? 'zgoda' : 'odmowa';
            p.decyzja = new Date().toISOString();
            dopisz(s, { kto: 'decyzja', prosba: p.id, zgoda: !!zgoda, tresc: `${zgoda ? '✓ Zgoda' : '✕ Odmowa'}: ${p.coRobi}` });
            if (s.prosby.some((x) => x.stan === 'czeka')) { await zapisz(s); return { sesja: s.id, wznowiona: false }; }
            const oc = s.oczekujace;
            s.oczekujace = null;
            if (!oc) { await zapisz(s); return { sesja: s.id, wznowiona: false }; }
            s.trwa = true;
            nadaj(s, { typ: 'stan', trwa: true });
            for (const c of oc.czekaja) {
                const decyzja = s.prosby.find((x) => x.id === c.prosbaId);
                let response;
                if (decyzja?.stan !== 'zgoda') response = { odmowa: 'Suweren odmówił — nie wykonuj tego; zaproponuj inaczej albo zapytaj, czego chce.' };
                else {
                    try { response = await wykonaj(c.wykonaj); } catch (e) { response = { blad: e.message }; }
                    dopisz(s, { kto: 'decyzja', tresc: c.wykonaj.polecenie ? `🩺 ${c.wykonaj.polecenie}: ${response.ok ? '✓ zielone' : `✕ kod ${response.kod ?? '?'}`}` : response.zapisano ? `💾 zapisano: ${path.relative(korzenie.katedra ?? '', c.wykonaj.zapis).replace(/\\/g, '/')}` : `⚠ ${response.blad}` });
                }
                const x = oc.odp.find((y) => y.prosbaId === c.prosbaId);
                if (x) { x.response = response; delete x.prosbaId; }
            }
            s.historia.push({ role: 'user', parts: oc.odp.map((x) => ({ functionResponse: { name: x.name, ...(x.id ? { id: x.id } : {}), response: x.response } })) });
            s.tury++;
            void petla(s);
            return { sesja: s.id, wznowiona: true };
        },
        async przerwij(sesjaId) {
            const c = przerwania.get(sesjaId);
            if (!c) return { przerwano: false };
            c.abort();
            return { przerwano: true };
        },
    };
}

export default { utworzArgoBoba, promptTozsamosci, rozwiaz, narzedzieOdczytu, NARZEDZIA, DIAGNOSTYKA, SEKRET };
