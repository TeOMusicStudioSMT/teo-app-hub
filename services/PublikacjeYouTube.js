/**
 * 🎬 Publikacje YouTube — postprodukcja przez stado, ostatnie „tak” Suwerena (2026-10-03).
 *
 * Suweren: „ciągle ostateczne produkcje muszę sam uploadować i opisy robić — a tak automatycznie
 * TeOgochi cały proces zrobią w postprodukcji”. Decyzja: wysyłka dopiero po ✓ w Izbie Akceptacji,
 * film NIEPUBLICZNY.
 *
 * Droga jednej publikacji:
 *   przygotuj (film z Wystawy albo odcinek z Biblioteki) → Kronikarz na SWOIM modelu pisze tytuł, opis
 *   i tagi → etap `do_akceptacji` (Hub: Impresariat i Wystawa, StoL: Izba) → Suweren poprawia / ✓ / ✕
 *   → ✓ = zlecenie w kolejce Impresariatu (to on wysyła — jedna implementacja uploadu) → `wysylanie`
 *   → `sprawdz()` czyta kolejkę i PRAWDZIWY status filmu w YouTube:
 *        unlisted/public → `opublikowana` + link sam trafia do Wystawy (film gra u każdego),
 *        private → `prywatna`: YouTube trzyma prywatnie (projekt API bez audytu) — link NIE idzie na
 *        Wystawę, bo by nie zagrał; Suweren zmienia widoczność w YouTube Studio, a następne
 *        sprawdzenie samo dokończy.
 * Plik: `_OtakOs_Wymiar/media/publikacje-youtube.json`.
 *
 * Kanał (wiele kanałów, 2026-10-03): publikacja dostaje kanał projektu (ten, który Suweren wybrał przy
 * ostatnim ✓ tego projektu — `kanaly-projektow.json`), a bez niego — domyślny. Suweren zmienia go przed ✓.
 */
import fs from 'fs/promises';
import path from 'path';

export const ETAPY = ['przygotowuje', 'do_akceptacji', 'wysylanie', 'prywatna', 'opublikowana', 'odrzucona', 'blad'];
const WIDEO = /\.(mp4|mov|webm)$/i;

/**
 * Prośba do Kronikarza w języku filmu (Suweren 2026-10-03: wywiady po angielsku „bym mógł też globalnie tworzyć”).
 * Etykiety TYTUŁ / OPIS / TAGI zostają po polsku — to format dla parsera, nie treść.
 */
export const systemKronikarza = (jezyk = 'pl') => [
    'Jesteś Kronikarz — pisarz Katedry OtakOS. Przygotowujesz film do wysłania na YouTube.',
    jezyk === 'en'
        ? 'Tytuł, opis i tagi piszesz PO ANGIELSKU (English) — dla widzów z całego świata; konkretnie, bez korporacyjnych formułek i bez wymyślania faktów spoza materiału. Etykiety formatu zostają bez zmian.'
        : 'Piszesz po polsku, konkretnie, bez korporacyjnych formułek i bez wymyślania faktów spoza materiału.',
    'Odpowiedz DOKŁADNIE w tym formacie (bez niczego przed i po):',
    'TYTUŁ: <do 90 znaków, chwytliwy, bez cudzysłowów>',
    'OPIS:',
    '<2–4 krótkie akapity: o czym jest film, nastrój, kontekst projektu; na końcu jedna linia o Katedrze OtakOS>',
    'TAGI: <8–15 tagów po przecinku, małymi literami>',
].join('\n');
export const SYSTEM_KRONIKARZA = systemKronikarza('pl');

/** Odpowiedź Kronikarza → { tytul, opis, tagi }; rzuca, gdy model nie trzymał formatu. */
export function odczytajMetadane(tekst) {
    const t = String(tekst ?? '').replace(/\r/g, '');
    const tytul = t.match(/^\s*TYTU[ŁL]:\s*(.+)$/mi)?.[1]?.trim().replace(/^["„]|["”]$/g, '');
    const opis = t.match(/^\s*OPIS:\s*\n?([\s\S]*?)(?=^\s*TAGI:)/mi)?.[1]?.trim();
    const tagi = (t.match(/^\s*TAGI:\s*(.+)$/mi)?.[1] ?? '').split(/[,;#]/).map((x) => x.trim().toLowerCase()).filter((x) => x && x.length <= 40);
    if (!tytul || !opis) throw new Error('Kronikarz nie trzymał formatu (TYTUŁ / OPIS / TAGI) — spróbuj ponownie albo innym modelem.');
    return { tytul: tytul.slice(0, 100), opis: opis.slice(0, 4800), tagi: [...new Set(tagi)].slice(0, 20) };
}

/**
 * @param {{ katalog:string, pisz:(system:string, prompt:string)=>Promise<{tekst:string, silnik?:string}>,
 *   impresariat:{ enqueuePublication:Function, getQueue:()=>Promise<any[]> },
 *   statusFilmu:(id:string, kanalId?:string|null)=>Promise<{istnieje:boolean, widocznosc?:string}>,
 *   kanaly?:()=>Promise<{ domyslny:string|null, kanaly:{id:string,nazwa:string}[] }>,
 *   naWystawe:(filmId:string, url:string)=>Promise<any>, gotowyYouTube:()=>Promise<boolean>,
 *   szyna?:any, teraz?:()=>number }} o
 */
export function utworzPublikacje(o) {
    const cfg = { teraz: () => Date.now(), ...o };
    const PLIK = path.join(cfg.katalog, 'media', 'publikacje-youtube.json');
    const PLIK_KANALOW = path.join(cfg.katalog, 'media', 'kanaly-projektow.json');
    let lista = null, zapis = Promise.resolve();
    const kanalyKatedry = async () => (cfg.kanaly ? await cfg.kanaly().catch(() => null) : null) ?? { domyslny: null, kanaly: [] };
    async function kanalyProjektow() { try { return JSON.parse(await fs.readFile(PLIK_KANALOW, 'utf8')) ?? {}; } catch { return {}; } }
    /** Kanał dla projektu: zapamiętany (jeśli dalej połączony) → domyślny. */
    async function kanalDla(projekt) {
        const { domyslny, kanaly } = await kanalyKatedry();
        const zap = projekt ? (await kanalyProjektow())[projekt] : null;
        const k = kanaly.find((x) => x.id === zap) ?? kanaly.find((x) => x.id === domyslny) ?? kanaly[0] ?? null;
        return k ? { kanalId: k.id, kanalNazwa: k.nazwa } : { kanalId: null, kanalNazwa: null };
    }
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Kronikarz', rodzaj: 'praca', tresc })?.catch?.(() => {});

    async function wczytaj() {
        if (lista) return lista;
        try { lista = JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { lista = []; }
        if (!Array.isArray(lista)) lista = [];
        return lista;
    }
    function zapisz() {
        zapis = zapis.then(async () => {
            await fs.mkdir(path.dirname(PLIK), { recursive: true });
            await fs.writeFile(`${PLIK}.tmp`, JSON.stringify(lista, null, 1), 'utf8');
            await fs.rename(`${PLIK}.tmp`, PLIK);
        }).catch(() => {});
        return zapis;
    }
    const znajdz = async (id) => {
        const p = (await wczytaj()).find((x) => x.id === id);
        if (!p) throw new Error('Nie ma takiej publikacji.');
        return p;
    };

    /**
     * Nowa publikacja: Kronikarz pisze metadane od razu (lokalny model — sekundy, nie godziny).
     * @param {{ plik:string, nazwa:string, kontekst?:string, wystawaId?:string|null, zrodlo?:object, jezyk?:'pl'|'en' }} z
     */
    async function przygotuj(z) {
        if (!z?.plik || !WIDEO.test(z.plik)) throw new Error('YouTube przyjmie tylko plik wideo (.mp4 / .mov / .webm).');
        await fs.access(z.plik).catch(() => { throw new Error(`Nie ma pliku: ${path.basename(z.plik)}`); });
        const l = await wczytaj();
        const otwarta = l.find((x) => x.plik === z.plik && ['przygotowuje', 'do_akceptacji', 'wysylanie', 'prywatna'].includes(x.etap));
        if (otwarta) return otwarta;   // drugi klik nie robi drugiego filmu na kanale
        const p = { id: `yt_${cfg.teraz().toString(36)}${Math.random().toString(36).slice(2, 6)}`, etap: 'przygotowuje', plik: z.plik, nazwa: String(z.nazwa ?? path.basename(z.plik)).slice(0, 160), wystawaId: z.wystawaId ?? null, zrodlo: z.zrodlo ?? null, ...(await kanalDla(z.zrodlo?.projekt)), utworzono: czas(), autor: 'Kronikarz', jezyk: z.jezyk === 'en' ? 'en' : 'pl' };
        l.unshift(p);
        await zapisz();
        try {
            const prompt = `Film: ${p.nazwa}\nPlik: ${path.basename(p.plik)}\n${z.kontekst ? `\nMateriał o filmie (jedyne źródło faktów):\n${String(z.kontekst).slice(0, 6000)}` : '\nBrak dodatkowego materiału — opieraj się na nazwie, nie zmyślaj szczegółów fabuły.'}`;
            const { tekst, silnik } = await cfg.pisz(systemKronikarza(p.jezyk), prompt);
            Object.assign(p, odczytajMetadane(tekst), { model: silnik ?? null, etap: 'do_akceptacji', blad: null });
            nadaj(`przygotował publikację „${p.tytul}” — czeka na ✓ Suwerena w Izbie`);
        } catch (e) {
            Object.assign(p, { etap: 'blad', blad: e.message });
        }
        await zapisz();
        return p;
    }

    /** Suweren poprawia tytuł / opis / tagi / kanał przed ✓. */
    async function zmien(id, { tytul, opis, tagi, kanalId } = {}) {
        const p = await znajdz(id);
        if (!['do_akceptacji', 'blad'].includes(p.etap)) throw new Error('Tę publikację już wysłano albo odrzucono.');
        if (typeof kanalId === 'string' && kanalId) {
            const k = (await kanalyKatedry()).kanaly.find((x) => x.id === kanalId);
            if (!k) throw new Error('Ten kanał nie jest połączony z Katedrą.');
            Object.assign(p, { kanalId: k.id, kanalNazwa: k.nazwa });
        }
        if (typeof tytul === 'string' && tytul.trim()) p.tytul = tytul.trim().slice(0, 100);
        if (typeof opis === 'string') p.opis = opis.slice(0, 4800);
        if (Array.isArray(tagi)) p.tagi = tagi.map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 20);
        if (p.etap === 'blad' && p.tytul && p.opis) { p.etap = 'do_akceptacji'; p.blad = null; }
        await zapisz();
        return p;
    }

    /** ✓ Suwerena → kolejka Impresariatu (niepubliczny). */
    async function zatwierdz(id) {
        const p = await znajdz(id);
        if (p.etap !== 'do_akceptacji') throw new Error(p.etap === 'blad' ? 'Kronikarz nie przygotował opisu — popraw ręcznie albo przygotuj ponownie.' : 'Ta publikacja nie czeka na akceptację.');
        if (!(await cfg.gotowyYouTube())) throw new Error('YouTube niepołączony — w Impresariacie kliknij „Połącz z YouTube”.');
        // Kanał musi dalej być połączony; bez wybranego — domyślny w chwili ✓.
        const { kanaly } = await kanalyKatedry();
        if (p.kanalId && kanaly.length && !kanaly.some((x) => x.id === p.kanalId)) throw new Error(`Kanał „${p.kanalNazwa ?? p.kanalId}” nie jest już połączony — wybierz inny kanał.`);
        if (!p.kanalId) Object.assign(p, await kanalDla(p.zrodlo?.projekt));
        const job = await cfg.impresariat.enqueuePublication(p.tytul, p.zrodlo?.projekt ?? null, ['youtube'], p.plik, { opis: p.opis, tagi: p.tagi, widocznosc: 'unlisted', publikacjaId: p.id, kanalId: p.kanalId });
        if (p.zrodlo?.projekt && p.kanalId) {   // projekt zapamiętuje kanał — następny odcinek pójdzie tam sam
            const mapa = await kanalyProjektow();
            mapa[p.zrodlo.projekt] = p.kanalId;
            await fs.mkdir(path.dirname(PLIK_KANALOW), { recursive: true });
            await fs.writeFile(PLIK_KANALOW, JSON.stringify(mapa, null, 1), 'utf8');
        }
        Object.assign(p, { etap: 'wysylanie', jobId: job.id, zatwierdzono: czas() });
        await zapisz();
        nadaj(`„${p.tytul}” zatwierdzona — Impresariat wysyła na YouTube${p.kanalNazwa ? ` (kanał „${p.kanalNazwa}”)` : ''}`);
        return p;
    }

    async function odrzuc(id) {
        const p = await znajdz(id);
        if (!['do_akceptacji', 'blad', 'przygotowuje'].includes(p.etap)) throw new Error('Tej publikacji nie da się już odrzucić.');
        Object.assign(p, { etap: 'odrzucona', odrzucono: czas() });
        await zapisz();
        return p;
    }

    /** Postęp: kolejka Impresariatu + prawdziwy status filmu. Woła pętla mostu i każdy odczyt listy. */
    async function sprawdz() {
        const l = await wczytaj();
        const czekajace = l.filter((p) => p.etap === 'wysylanie' || p.etap === 'prywatna');
        if (!czekajace.length) return l;
        const kolejka = await cfg.impresariat.getQueue().catch(() => []);
        let zmiana = false;
        for (const p of czekajace) {
            if (p.etap === 'wysylanie') {
                const job = kolejka.find((j) => j.id === p.jobId);
                if (!job) { Object.assign(p, { etap: 'blad', blad: 'Zlecenie zniknęło z kolejki Impresariatu.' }); zmiana = true; continue; }
                if (job.status === 'FAILED') { Object.assign(p, { etap: 'blad', blad: job.error ?? 'Wysyłka nieudana.' }); zmiana = true; continue; }
                if (job.status !== 'COMPLETE') continue;
                if (!job.youtubeVideoId) { Object.assign(p, { etap: 'blad', blad: 'YouTube nie oddał id filmu — sprawdź kanał.' }); zmiana = true; continue; }
                Object.assign(p, { videoId: job.youtubeVideoId, url: `https://youtu.be/${job.youtubeVideoId}`, wyslano: job.completedAt ?? czas() });
                zmiana = true;
            }
            let s;
            try { s = await cfg.statusFilmu(p.videoId, p.kanalId ?? null); } catch (e) { p.uwaga = `Nie sprawdziłem statusu: ${e.message}`; continue; }
            if (!s.istnieje) { Object.assign(p, { etap: 'blad', blad: 'Filmu nie ma już na YouTube.' }); zmiana = true; continue; }
            if (s.widocznosc === 'private') {
                if (p.etap !== 'prywatna') { Object.assign(p, { etap: 'prywatna', uwaga: 'YouTube trzyma film jako PRYWATNY (projekt API bez audytu). Zmień widoczność na „Niepubliczny” w YouTube Studio — Katedra sama wstawi link na Wystawę.' }); zmiana = true; }
                continue;
            }
            Object.assign(p, { etap: 'opublikowana', widocznosc: s.widocznosc, uwaga: null });
            if (p.wystawaId) { try { await cfg.naWystawe(p.wystawaId, p.url); p.naWystawie = true; } catch (e) { p.uwaga = `Link nie wszedł na Wystawę: ${e.message}`; } }
            nadaj(`„${p.tytul}” jest na YouTube (${s.widocznosc}): ${p.url}`);
            zmiana = true;
        }
        if (zmiana) await zapisz();
        return l;
    }

    async function wszystkie() { return [...(await wczytaj())]; }

    return { przygotuj, zmien, zatwierdz, odrzuc, sprawdz, wszystkie };
}

export default { utworzPublikacje, odczytajMetadane, SYSTEM_KRONIKARZA, ETAPY };
