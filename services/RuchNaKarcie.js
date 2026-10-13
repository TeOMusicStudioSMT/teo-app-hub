/**
 * 🚦 RUCH NA KARCIE — kto teraz dostaje VRAM.
 *
 * PO CO TO ISTNIEJE — ZDARZENIE, NIE PRZECZUCIE. Suweren włączył VoiceStudio
 * w trakcie liczenia kadrów i render padł: `CUDA error: unspecified launch
 * failure` w węźle KSampler. Po takim błędzie kontekst CUDA w procesie jest
 * MARTWY — ComfyUI wywalał każde następne zlecenie (21 s, potem 6 s, 6 s),
 * dopóki go nie ubiliśmy.
 *
 * Zmierzone w chwili awarii:
 *   karta                 6144 MiB, zajęte 5129 MiB
 *   VoiceStudio (OmniVoice) 1937 MiB na cuda:0, wolne 1,28 GB
 *   OmniVoice deklaruje    min_vram_gb: 6.0  ← czyli CAŁĄ kartę
 *   Wan 2.2 przy renderze  też sięga po niemal całość
 *
 * Dwa programy, każdy chcący 6 GB, na karcie mającej 6 GB. To nie jest
 * sytuacja, którą da się „lepiej zaplanować" — jeden musi ustąpić.
 *
 * ⚠️ TRZECH GRACZY, NIE DWÓCH. Poza VoiceStudio i ComfyUI kartę trzyma też
 * OLLAMA — zostawia model wczytany po ostatnim pytaniu. Pierwsza wersja tego
 * modułu o niej zapomniała i Suweren dostał blokadę „wolne 193 MiB” przy
 * WYŁĄCZONYM VoiceStudio, bo kartę trzymał `qwen3.6:35b-a3b` (1892 MiB).
 *
 * ⚠️ TEN MODUŁ NIKOGO NIE UBIJA. Prosi grzecznie: VoiceStudio ma trasę
 * wyładowania modelu, Ollama rozumie `keep_alive: 0`, ComfyUI ma `/free`.
 * Zabijanie procesów zostawiamy Suwerenowi — to jego maszyna, a TACOS GUARD
 * już raz pokazał, czym kończy się automatyczne strzelanie do procesów GPU.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const VOICESTUDIO = process.env.OTAKOS_VOICESTUDIO || 'http://127.0.0.1:3900';

/**
 * ⚠️ CZWARTY GRACZ (2026-10-13): silnik klonu głosu Katedry (:5002, services/glos/voice_server.py). Trzymał
 * Chatterboxa na karcie od pierwszego nagrania (~3,3 GB) i odcinek TeO Game Show stał — Wan w ComfyUI przelewał
 * się do RAM, krok 10 trwał 43 min (812 s/it). Rozjemca znał VoiceStudio i Ollamę, a o NASZYM serwerze głosu
 * nie wiedział. Serwer ma teraz `POST /zwolnij` (model śpi, proces zostaje) i sam usypia model po bezczynności.
 */
const KLON = process.env.OTAKOS_VOICE_HOST || 'http://127.0.0.1:5002';

let cfg = {
    /** (program, argumenty) → Promise<{stdout}> — podmienialne w testach */
    uruchom: promisify(execFile),
    ollamaBase: null,
    klonBase: KLON,
    voiceStudio: VOICESTUDIO,
    /** zapis na szynę ({agent, rodzaj, tresc, dane}) — ustawia most */
    nadaj: null,
    /** `przedRenderem` działa dopiero, gdy most go włączy (testy modułów wideo nie pukają do prawdziwej karty) */
    wlaczone: false,
    teraz: () => Date.now(),
};
/** Most ustawia adresy i szynę raz przy starcie (`wlaczone: true`). */
export function skonfiguruj(o = {}) { cfg = { ...cfg, ...o }; ostatniaProsba = null; }
const uruchom = (...a) => cfg.uruchom(...a);

/**
 * Ile MiB musi być wolne, żeby puszczać render.
 *
 * ⚠️ TO NIE JEST ZMIERZONY PRÓG, tylko liczba WYWIEDZIONA Z JEDNEJ AWARII —
 * i tak trzeba ją czytać. Wiadomo tyle:
 *   · przy 1,28 GB wolnego render padł na `unspecified launch failure`
 *   · przy pełnej karcie (VoiceStudio wyłączone) 34 kadry policzyły się bez wpadki
 * Nie robiłem przemiatania w poszukiwaniu dokładnej granicy, bo każde takie
 * badanie kosztuje kolejny martwy kontekst CUDA. 2500 MiB to dwukrotność
 * tego, przy czym się wywróciło — świadomy zapas, nie wynik.
 *
 * ⚠️ Wan 2.2 fp16 waży 9,4 GB i NIE MIEŚCI SIĘ w tej karcie w całości —
 * ComfyUI zrzuca wagi do RAM-u. Dlatego render chodzi przy paru gigabajtach
 * wolnego VRAM i nie ma sensu żądać tu połowy karty.
 */
export const POTRZEBA_NA_RENDER = Number(process.env.OTAKOS_VRAM_RENDER) || 2500;

/** Mowa jest skromniejsza, ale OmniVoice i tak ładuje ~1,9 GB. */
export const POTRZEBA_NA_MOWE = Number(process.env.OTAKOS_VRAM_MOWA) || 2200;

/**
 * Co się dzieje na karcie.
 *
 * ⚠️ Brak `nvidia-smi` NIE jest błędem — Katedra ma chodzić i na maszynach
 * bez karty NVIDIA. Zwracamy wtedy „nie wiem" i nikogo nie blokujemy.
 */
export async function stanKarty() {
    try {
        const { stdout } = await uruchom('nvidia-smi', [
            '--query-gpu=name,memory.total,memory.used,memory.free',
            '--format=csv,noheader,nounits',
        ], { timeout: 10000 });
        const [nazwa, total, used, free] = String(stdout).trim().split('\n')[0].split(',').map((s) => s.trim());
        return {
            znane: true,
            nazwa,
            razemMiB: Number(total),
            zajeteMiB: Number(used),
            wolneMiB: Number(free),
        };
    } catch {
        return { znane: false, nazwa: null, razemMiB: null, zajeteMiB: null, wolneMiB: null };
    }
}

async function pobierz(sciezka, opcje = {}, limitMs = 20000) {
    return fetch(`${cfg.voiceStudio}${sciezka}`, { ...opcje, signal: AbortSignal.timeout(limitMs) });
}

/**
 * Kto jest na karcie wg sterownika: [{ pid, program, vramMiB|null }].
 * ⚠️ Windows (WDDM) zwykle NIE podaje pamięci na proces („[N/A]") — wtedy `vramMiB: null`, a ile kto trzyma
 * wiemy tylko od tych, którzy sami mówią (serwer głosu, Ollama, VoiceStudio).
 */
export async function procesyKarty() {
    try {
        const { stdout } = await uruchom('nvidia-smi', [
            '--query-compute-apps=pid,process_name,used_memory',
            '--format=csv,noheader,nounits',
        ], { timeout: 10000, windowsHide: true });
        return String(stdout).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
            const czesci = l.split(',').map((x) => x.trim());
            const pid = Number(czesci[0]);
            const mb = Number(czesci.at(-1));
            const sciezka = czesci.slice(1, -1).join(',');
            return { pid, program: sciezka.split(/[\\/]/).pop() || sciezka, vramMiB: Number.isFinite(mb) ? mb : null };
        }).filter((p) => Number.isInteger(p.pid) && p.pid > 0);
    } catch {
        return [];
    }
}

/** Co trzyma silnik klonu głosu Katedry (:5002). */
export async function modelKlonu() {
    try {
        const r = await fetch(`${cfg.klonBase}/`, { signal: AbortSignal.timeout(4000) });
        if (!r.ok) return { zywe: false };
        const d = await r.json();
        return {
            zywe: true,
            silnik: d.silnik ?? null,
            model: d.model ?? null,
            urzadzenie: d.urzadzenie ?? null,
            vramMiB: Number.isFinite(Number(d.vram_mb)) && d.vram_mb !== null ? Math.round(Number(d.vram_mb)) : null,
            bezczynnyS: d.bezczynny_s ?? null,
            usypiaPoS: d.bezczynnosc_s ?? null,
            ladowanieS: d.ladowanie_s ?? null,
            // starszy serwer (sprzed 2026-10-13) nie zna `/zwolnij` — nie ma w stanie `uspienia`
            umieZwolnic: d.uspienia !== undefined,
        };
    } catch {
        return { zywe: false };
    }
}

/** Czy serwer głosu siedzi na karcie z załadowanym modelem. */
const klonNaKarcie = (k) => k.zywe && k.model === 'gotowy' && /cuda|mps/i.test(String(k.urzadzenie ?? ''));

/**
 * Poproś serwer głosu Katedry, żeby uśpił model (`POST /zwolnij`). Proces zostaje — następne nagranie
 * załaduje model z dysku. W trakcie nagrania serwer odmawia (nie przerywamy mowy).
 */
export async function oddajKarteZKlonu(powod = 'render') {
    const k = await modelKlonu();
    if (!k.zywe) return { zrobione: false, powod: 'Silnik głosu Katedry nie działa — nic nie trzyma.', zdjete: [] };
    if (!klonNaKarcie(k)) return { zrobione: true, zdjete: [], powod: `Silnik głosu nie trzyma karty (model: ${k.model ?? '?'}).` };
    if (!k.umieZwolnic) return { zrobione: false, zdjete: [], powod: 'Silnik głosu to starsza wersja bez /zwolnij — zrestartuj go (most odpali nowy).' };
    try {
        const r = await fetch(`${cfg.klonBase}/zwolnij`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ powod }), signal: AbortSignal.timeout(30000),
        });
        const d = await r.json().catch(() => ({}));
        if (!d.zwolniono) return { zrobione: false, zdjete: [], powod: `Silnik głosu: ${d.powod ?? `HTTP ${r.status}`}` };
        return { zrobione: true, zdjete: [{ nazwa: `głos Katedry (${k.silnik ?? 'klon'})`, vramMiB: d.vram_mb_przed ?? k.vramMiB ?? 0 }], powod: null };
    } catch (e) {
        return { zrobione: false, zdjete: [], powod: `Silnik głosu nie odpowiedział: ${e.message}` };
    }
}

/** Które modele VoiceStudio trzyma teraz na karcie. */
export async function modeleGlosu() {
    try {
        const r = await pobierz('/model/loaded', {}, 10000);
        if (!r.ok) return { zywe: false, modele: [] };
        const d = await r.json();
        return {
            zywe: true,
            modele: (d.models ?? []).map((m) => ({
                id: String(m.id ?? ''),
                nazwa: String(m.name ?? ''),
                vramMiB: Math.round(Number(m.vram_mb ?? 0)),
                urzadzenie: String(m.device ?? ''),
                mozliwyDoZdjecia: m.unloadable !== false,
            })),
        };
    } catch {
        return { zywe: false, modele: [] };
    }
}

/**
 * Poproś VoiceStudio, żeby oddał kartę.
 *
 * Zdejmujemy TYLKO modele siedzące na cuda — ten na CPU nikomu nie
 * przeszkadza, a jego ponowne wczytanie kosztuje czas.
 */
export async function oddajKarteZMowy() {
    const { zywe, modele } = await modeleGlosu();
    if (!zywe) return { zrobione: false, powod: 'VoiceStudio nie odpowiada — nie ma kogo prosić.', zdjete: [] };

    const naKarcie = modele.filter((m) => /cuda|gpu/i.test(m.urzadzenie) && m.mozliwyDoZdjecia);
    if (!naKarcie.length) return { zrobione: true, zdjete: [], powod: 'VoiceStudio nic nie trzyma na karcie.' };

    const zdjete = [];
    for (const m of naKarcie) {
        try {
            const r = await pobierz(`/model/unload/${encodeURIComponent(m.id)}`, { method: 'POST' }, 60000);
            if (r.ok) zdjete.push({ id: m.id, vramMiB: m.vramMiB });
        } catch { /* jeden nieudany nie przerywa reszty */ }
    }
    // Dosprzątanie — VoiceStudio wystawia to osobno i bez tego pamięć potrafi zostać.
    try { await pobierz('/system/flush-memory', { method: 'POST' }, 30000); } catch { /* nieobowiązkowe */ }

    return { zrobione: zdjete.length > 0, zdjete, powod: null };
}

/**
 * Co OLLAMA trzyma na karcie.
 *
 * ⚠️ TRZECI GRACZ, O KTÓRYM ZAPOMNIAŁEM. Pierwsza wersja tego modułu pytała
 * tylko VoiceStudio — i Suweren dostał blokadę „wolne 193 MiB" MIMO wyłączonego
 * VoiceStudio. Kartę trzymał `llama-server.exe` z modelem `qwen3.6:35b-a3b`
 * (1892 MiB), bo Ollama zostawia model wczytany po ostatnim pytaniu.
 *
 * Rozjemca, który zna dwóch z trzech graczy, jest gorszy niż żaden — bo mówi
 * „zamknij VoiceStudio", gdy VoiceStudio już nie żyje.
 */
export async function modeleMysli(ollamaBase) {
    try {
        const r = await fetch(`${ollamaBase}/api/ps`, { signal: AbortSignal.timeout(10000) });
        if (!r.ok) return { zywe: false, modele: [] };
        const d = await r.json();
        return {
            zywe: true,
            modele: (d.models ?? [])
                .map((m) => ({ nazwa: String(m.name ?? m.model ?? ''), vramMiB: Math.round(Number(m.size_vram ?? 0) / 1048576) }))
                .filter((m) => m.nazwa && m.vramMiB > 0),
        };
    } catch {
        return { zywe: false, modele: [] };
    }
}

/**
 * Poproś Ollamę, żeby oddała kartę.
 *
 * ⚠️ `keep_alive: 0` to oficjalny sposób zdjęcia modelu — nie ubijamy procesu.
 * Model wczyta się z powrotem przy następnym pytaniu, kosztem paru sekund.
 * Przy renderze trwającym godzinę to uczciwa zamiana.
 */
export async function oddajKarteZMysli(ollamaBase) {
    const { zywe, modele } = await modeleMysli(ollamaBase);
    if (!zywe) return { zrobione: false, powod: 'Ollama nie odpowiada — nie ma kogo prosić.', zdjete: [] };
    if (!modele.length) return { zrobione: true, zdjete: [], powod: 'Ollama nic nie trzyma na karcie.' };

    const zdjete = [];
    for (const m of modele) {
        try {
            const r = await fetch(`${ollamaBase}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: m.nazwa, keep_alive: 0 }),
                signal: AbortSignal.timeout(60000),
            });
            if (r.ok) zdjete.push({ nazwa: m.nazwa, vramMiB: m.vramMiB });
        } catch { /* jeden nieudany nie przerywa reszty */ }
    }
    return { zrobione: zdjete.length > 0, zdjete, powod: null };
}

/**
 * Poproś ComfyUI, żeby oddał kartę.
 *
 * ⚠️ `/free` z `unload_models` zdejmuje wagi, ale NIE ubija procesu — kolejka
 * ComfyUI zostaje nietknięta. To jest ta różnica, przez którą nie wystarczy
 * „zrestartować silnika".
 */
export async function oddajKarteZRenderu(comfyBase) {
    try {
        const r = await fetch(`${comfyBase}/free`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unload_models: true, free_memory: true }),
            signal: AbortSignal.timeout(30000),
        });
        return { zrobione: r.ok, powod: r.ok ? null : `ComfyUI odmówił (HTTP ${r.status}).` };
    } catch (e) {
        return { zrobione: false, powod: `ComfyUI nie odpowiedział: ${e.message}` };
    }
}

/**
 * Zrób miejsce na RENDER.
 *
 * Zwraca `{ wolno, ... }` — `wolno: false` znaczy, że mimo próśb miejsca nie ma
 * i puszczanie renderu skończy się tak samo jak wtedy: martwym kontekstem CUDA.
 */
export async function zrobMiejsceNaRender({ potrzeba = POTRZEBA_NA_RENDER, ollamaBase = cfg.ollamaBase, powod: poCo = 'render' } = {}) {
    const przed = await stanKarty();
    if (!przed.znane) return { wolno: true, znane: false, powod: 'Nie widzę karty — nie blokuję.' };
    ostatniaProsba = cfg.teraz();

    // ⚠️ PYTAMY OBU KONKURENTÓW. Zmierzone: przy wyłączonym VoiceStudio kartę
    // trzymała Ollama (qwen3.6:35b-a3b, 1892 MiB), więc komunikat „zamknij
    // VoiceStudio" był bezużyteczny — bo już był zamknięty.
    const zMowy = await oddajKarteZMowy();
    const zKlonu = await oddajKarteZKlonu(poCo);
    const zMysli = ollamaBase ? await oddajKarteZMysli(ollamaBase) : { zrobione: false, zdjete: [], powod: 'Nie znam adresu Ollamy.' };

    const po = await stanKarty();

    // Kto NADAL trzyma kartę PO poproszeniu.
    const trzymaja = [];
    if ((await modeleGlosu()).modele.some((m) => /cuda|gpu/i.test(m.urzadzenie))) trzymaja.push('VoiceStudio');
    if (klonNaKarcie(await modelKlonu())) trzymaja.push('silnik głosu Katedry');
    if (ollamaBase && (await modeleMysli(ollamaBase)).modele.length) trzymaja.push('Ollama');

    /**
     * ⚠️ TU BYŁ MÓJ BŁĄD W SAMEJ ZASADZIE, nie w progu.
     *
     * Pierwsza wersja blokowała render, gdy wolnego VRAM-u było mniej niż próg.
     * Skutek: Suweren dostał blokadę „wolne 2150 MiB" przy WYŁĄCZONYM
     * VoiceStudio i PUSTEJ Ollamie — bo pamięć trzymał **sam ComfyUI**, który
     * wczytał wagi Wana przy poprzednim przebiegu i użyłby ich ponownie.
     * Renderer był blokowany za to, że jest gotowy do renderowania.
     *
     * Prawdziwym zagrożeniem nie jest „mało wolnego VRAM-u" — Wan i tak nie
     * mieści się w tej karcie i ComfyUI zrzuca wagi do RAM-u. Zagrożeniem jest
     * DRUGI SILNIK sięgający po tę samą pamięć w trakcie liczenia. Dlatego
     * blokujemy wyłącznie wtedy, gdy konkurent NADAL trzyma kartę mimo prośby.
     *
     * Niski poziom wolnej pamięci bez konkurenta zwracamy jako `ostrzezenie` —
     * do pokazania, nie do blokowania.
     */
    const wolno = trzymaja.length === 0;
    const malo = po.wolneMiB < potrzeba;

    return {
        wolno, znane: true, przed, po, potrzeba, trzymaja,
        zwolniono: {
            zdjete: [...(zMowy.zdjete ?? []), ...(zKlonu.zdjete ?? []), ...(zMysli.zdjete ?? [])],
            mowa: zMowy, klon: zKlonu, mysl: zMysli,
        },
        ostrzezenie: (wolno && malo)
            ? `Na karcie wolne tylko ${po.wolneMiB} MiB, ale trzyma ją ComfyUI albo program spoza `
              + 'Katedry. Puszczam render — jeśli padnie na błędzie CUDA, zamknij to, co jeszcze '
              + 'sięga po kartę (przeglądarka z akceleracją, gra, antywirus).'
            : null,
        powod: wolno
            ? null
            : `Kartę trzyma nadal: ${trzymaja.join(' i ')} (wolne ${po.wolneMiB} MiB). `
              + 'Dwa silniki naraz kończą się błędem CUDA i martwym kontekstem — '
              + 'zamknij ten program i spróbuj ponownie.',
    };
}

/** Kiedy ostatnio prosiliśmy o kartę — kolejka kadrów nie musi pytać przy każdym kadrze. */
let ostatniaProsba = null;
export const ODSTEP_PROSB_MS = 20_000;

/**
 * 🚦 Przed ciężką robotą GPU w ComfyUI (Wan, FLUX, TRELLIS) — wołane w JEDNYM miejscu każdej wysyłki grafu
 * (services/Wideo.js, services/Assety3D.js). PROSI serwer głosu, VoiceStudio i Ollamę o zwolnienie karty i zapisuje
 * na szynie, co oddali. NIGDY nie rzuca i nie blokuje — trasy, które mają blokować (507), wołają
 * `zrobMiejsceNaRender` same. Nic nie zabija.
 * @returns {Promise<object>} wynik `zrobMiejsceNaRender` albo `{ pominiete: powód }`
 */
export async function przedRenderem(poCo = 'render') {
    if (!cfg.wlaczone || process.env.OTAKOS_GPU_ZWALNIAJ === '0') return { pominiete: 'wyłączone' };
    if (ostatniaProsba && cfg.teraz() - ostatniaProsba < ODSTEP_PROSB_MS) return { pominiete: 'prośba przed chwilą' };
    try {
        const ollamaBase = process.env.OTAKOS_GPU_ZWALNIAJ_OLLAMA === '0' ? null : cfg.ollamaBase;
        const r = await zrobMiejsceNaRender({ ollamaBase, powod: poCo });
        const zdjete = r.zwolniono?.zdjete ?? [];
        if (zdjete.length || r.trzymaja?.length) {
            const ile = zdjete.reduce((s, m) => s + (m.vramMiB || 0), 0);
            const tresc = `🚦 Przed ${poCo}: ` +
                (zdjete.length ? `oddali kartę — ${zdjete.map((m) => `${m.nazwa ?? m.id} ${m.vramMiB} MiB`).join(', ')} (≈ ${ile} MiB)` : 'nikt nie oddał karty') +
                (r.po?.znane !== false && r.po ? `; wolne ${r.przed?.wolneMiB} → ${r.po.wolneMiB} MiB` : '') +
                (r.trzymaja?.length ? `; nadal trzyma: ${r.trzymaja.join(', ')}` : '') + '.';
            console.log(`[Karta] ${tresc}`);
            try { await cfg.nadaj?.({ agent: 'most', rodzaj: 'karta', tresc, dane: { poCo, zdjete, przed: r.przed?.wolneMiB ?? null, po: r.po?.wolneMiB ?? null, trzymaja: r.trzymaja ?? [] } }); } catch { /* szyna nie jest powodem */ }
        }
        return r;
    } catch (e) {
        return { pominiete: `błąd prośby o kartę: ${e.message}` };
    }
}

/**
 * Pamięć KARTY dla 🧠 Pamięci Katedry: całość ze sterownika + kto trzyma (z ich własnych słów, bo WDDM nie podaje
 * pamięci na proces) + lista programów na karcie.
 */
export async function pamiecKarty() {
    const [karta, procesy, klon, glos, mysl] = await Promise.all([
        stanKarty(), procesyKarty(), modelKlonu(), modeleGlosu(), cfg.ollamaBase ? modeleMysli(cfg.ollamaBase) : Promise.resolve({ zywe: false, modele: [] }),
    ]);
    const trzymaja = [];
    if (klon.zywe) {
        trzymaja.push({
            kto: 'głos Katedry', co: `${klon.silnik ?? 'klon'} · ${klon.model ?? '?'}`,
            vramMiB: klonNaKarcie(klon) ? klon.vramMiB : 0, zwolnij: 'glos',
            uwaga: klon.model === 'uspiony' ? 'model śpi — wstanie przy następnym nagraniu'
                : klon.usypiaPoS ? `zaśnie sam po ${Math.round(klon.usypiaPoS / 60 * 10) / 10} min bezczynności` : null,
        });
    }
    for (const m of (glos.modele ?? []).filter((x) => /cuda|gpu/i.test(x.urzadzenie))) trzymaja.push({ kto: 'VoiceStudio', co: m.nazwa || m.id, vramMiB: m.vramMiB, zwolnij: 'voicestudio' });
    for (const m of mysl.modele ?? []) trzymaja.push({ kto: 'Ollama', co: m.nazwa, vramMiB: m.vramMiB, zwolnij: 'ollama' });
    return { ...karta, procesy, trzymaja };
}

/** Zrób miejsce na MOWĘ. Ta sama zasada, druga strona. */
export async function zrobMiejsceNaMowe({ comfyBase, potrzeba = POTRZEBA_NA_MOWE } = {}) {
    const przed = await stanKarty();
    if (!przed.znane) return { wolno: true, znane: false, powod: 'Nie widzę karty — nie blokuję.' };
    if (przed.wolneMiB >= potrzeba) {
        return { wolno: true, znane: true, przed, po: przed, zwolniono: null, potrzeba };
    }

    const zwolniono = comfyBase ? await oddajKarteZRenderu(comfyBase) : { zrobione: false, powod: 'Nie znam adresu ComfyUI.' };
    const po = await stanKarty();
    return {
        wolno: po.wolneMiB >= potrzeba,
        znane: true,
        przed, po, zwolniono, potrzeba,
        powod: po.wolneMiB >= potrzeba
            ? null
            : `Na karcie wolne ${po.wolneMiB} MiB, a mowa potrzebuje ${potrzeba} MiB.`,
    };
}

export default {
    POTRZEBA_NA_RENDER, POTRZEBA_NA_MOWE,
    stanKarty, modeleGlosu, modeleMysli, oddajKarteZMowy, oddajKarteZMysli, oddajKarteZRenderu,
    zrobMiejsceNaRender, zrobMiejsceNaMowe,
    skonfiguruj, procesyKarty, modelKlonu, oddajKarteZKlonu, przedRenderem, pamiecKarty, ODSTEP_PROSB_MS,
};
