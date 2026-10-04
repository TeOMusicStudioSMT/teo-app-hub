/**
 * 💬 Sceny dialogowe filmu — silnik Studia Podcastu, tylko bez studia i bez prowadzącego.
 *
 * PO CO. Suweren (2026-10-04), po pierwszym odcinku zrobionym w całości w Studiu Podcastu: „musimy zbudować takie
 * coś, ale tylko do scen dialogowych dla filmu… to w Story Studio”. Scena = 2–4 postacie z obsady 🎭 Aktorów
 * (ich głosy, zdjęcia/klipy, kolory) rozmawiają na tle KADRÓW PROJEKTU (ujęcia ComfyUI, obrazy, klipy). Model pisze
 * dialog z opisu sceny i kanonu Reżysera; Suweren poprawia kwestie i wskazuje, który kadr leci pod którą kwestią.
 * Gotowa scena ląduje w montażach projektu — Montażownia TeO Story Studio widzi ją od razu.
 *
 * Różnice wobec podcastu: nikt nie prowadzi (wszyscy równi), brak powitań i pożegnań — scena zaczyna się w środku
 * akcji; napisy jak w kinie (na dole, wyśrodkowane, bez paska studia); imię mówiącego i jego karta są opcjonalne.
 * Bez tła w kwestii: przy kilku kadrach każda postać ma „swój” (ujęcie–przeciwujęcie), przy jednym — ten jeden.
 *
 * Wspólne z podcastem: najazd na tło (`filtrTla`), styl rozmowy i 🌀 Pralka (temperatura), parser „IMIĘ: kwestia”,
 * schowek głosu (ponowne nagranie nie liczy gotowych kwestii drugi raz), podkład z biblioteki muzyki.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { CZCIONKI, zawin, kolorFf, jasniej } from './PowitanieDnia.js';
import { argumentyPodkladu } from './GlosZeStemu.js';
import { WIDEO, slug, odczytajScenariusz, czasBezGlosu, JEZYKI, jezykWywiadu, SZER, WYS, FPS } from './WywiadAktorow.js';
import { filtrTla, STYLE_WYWIADU, stylWywiadu, temperaturaZPralki } from './StudioPodcastu.js';

const OBRAZ = /\.(png|jpe?g|webp|bmp)$/i;
export const MAX_POSTACI = 4, MAX_KWESTII = 60, MAX_RUND = 5;

/** Prośba o scenę: dialog filmowy z opisu sytuacji i kanonu projektu — bez narratora, bez powitań. */
export function promptSceny({ postacie, opis, kanon = '', uwagi = '', jezyk = 'pl', styl = 'domyslny' }) {
    const obsada = postacie.map((a) => `- ${a.imie.toUpperCase()}: ${a.rola || 'postać filmu'}`).join('\n');
    const system = [
        `Jesteś scenarzystą filmu. Piszesz JEDNĄ scenę dialogową. ${JEZYKI[jezykWywiadu(jezyk)].piszesz}, naturalnie, jak mówią ludzie na ekranie — podtekst, emocje, krótkie zdania.`,
        'Postacie mówią W SWOICH ROLACH, każda swoim głosem i sposobem mówienia. Nikt nie prowadzi rozmowy, nikt nie wita widzów — scena zaczyna się w środku sytuacji i kończy mocnym akcentem (decyzją, zwrotem, ciszą po ostatnim zdaniu).',
        'Fakty o świecie bierzesz z KANONU i opisu ról; nie wymyślasz wydarzeń sprzecznych z kanonem.',
        'Format — każda kwestia w osobnej linii, nic poza tym:',
        'IMIĘ: tekst kwestii',
        'Zasady: 8–16 kwestii; każda najwyżej 2 zdania (do 200 znaków); bez didaskaliów, opisów akcji i nawiasów; każda postać mówi co najmniej dwa razy.',
        STYLE_WYWIADU[stylWywiadu(styl)].opis || null,
    ].filter(Boolean).join('\n');
    const user = [
        `SCENA: ${String(opis).slice(0, 800)}`,
        kanon ? `KANON PROJEKTU:\n${String(kanon).slice(0, 4000)}` : null,
        uwagi ? `UWAGI SUWERENA: ${String(uwagi).slice(0, 600)}` : null,
        `POSTACIE:\n${obsada}`,
    ].filter(Boolean).join('\n\n');
    return { system, user };
}

/** Dalszy ciąg sceny: bez powtórek, nowy zwrot, kończy się akcentem. */
export function promptDalszegoCiagu({ postacie, opis, kwestie, imie = (id) => id, jezyk = 'pl', styl = 'domyslny', runda = 1 }) {
    const system = [
        `Jesteś scenarzystą filmu. Dopisujesz DALSZY CIĄG trwającej sceny (część ${runda + 1}). ${JEZYKI[jezykWywiadu(jezyk)].piszesz}.`,
        'Nie powtarzasz tego, co padło: wprowadzasz nowy zwrot, napięcie albo odkrycie; postacie reagują na siebie W SWOICH ROLACH. Bez narratora i bez powitań.',
        'Format — każda kwestia w osobnej linii: IMIĘ: tekst kwestii. 6–10 kwestii, każda najwyżej 2 zdania, bez didaskaliów. Zakończ mocnym akcentem.',
        STYLE_WYWIADU[stylWywiadu(styl)].opis || null,
    ].filter(Boolean).join('\n');
    const user = [
        `SCENA: ${String(opis).slice(0, 800)}`,
        `POSTACIE:\n${postacie.map((a) => `- ${a.imie.toUpperCase()}: ${a.rola || 'postać filmu'}`).join('\n')}`,
        `DOTYCHCZAS:\n${kwestie.slice(-40).map((k) => `${imie(k.kto).toUpperCase()}: ${k.tekst}`).join('\n')}`,
        'DALSZY CIĄG:',
    ].join('\n\n');
    return { system, user };
}

const bezOgonkow = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/gi, 'l').toLowerCase().trim();
const html = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const MAX_PROPOZYCJI = 8;

/** Opis odcinka w kanonie sceny: numer, tytuł, streszczenie (Reżyser). */
export const opisOdcinka = (o) => (o ? `ODCINEK #${o.numer ?? '?'} „${o.tytul}”: ${String(o.streszczenie ?? '').slice(0, 1200)}` : '');

/**
 * 🎬 Plan scen dialogowych dla odcinka (Suweren 2026-10-04: „jak były te plany robione, możliwe że nie ma dialogów…
 * Rękopis tego nie zna”). Model dostaje streszczenie odcinka, kanon, fragment Rękopisu i obsadę — i proponuje sceny,
 * w których postacie ROZMAWIAJĄ. Tylko propozycje: scena powstaje dopiero, gdy Suweren ją przyjmie (przygotuj).
 */
export function promptPlanuScen({ odcinek, kanon = '', rekopis = '', obsada = [], juz = [], ile = 4, jezyk = 'pl' }) {
    const system = [
        `Jesteś scenarzystą serialu. Rozpisujesz odcinek na SCENY DIALOGOWE — momenty, w których postacie ze sobą rozmawiają. ${JEZYKI[jezykWywiadu(jezyk)].piszesz}.`,
        'Sceny budujesz z tego, co jest w streszczeniu odcinka, kanonie i rękopisie — nie wymyślasz wydarzeń sprzecznych z nimi. Kolejność = kolejność zdarzeń w odcinku.',
        'Każda scena: 2–4 postacie WYŁĄCZNIE z listy OBSADA (imiona dokładnie jak na liście), jedno-dwa zdania opisu: gdzie są, co się dzieje, o co toczy się rozmowa.',
        'Format — każda scena w osobnej linii, nic poza tym:',
        'SCENA: opis sceny | POSTACIE: Imię, Imię',
        `Scen ma być ${ile}.`,
    ].join('\n');
    const user = [
        opisOdcinka(odcinek),
        kanon ? `KANON PROJEKTU:\n${String(kanon).slice(0, 3000)}` : null,
        rekopis ? `RĘKOPIS (fragment):\n${String(rekopis).slice(0, 3000)}` : null,
        juz.length ? `TE SCENY JUŻ SĄ (nie powtarzaj):\n${juz.slice(0, 12).map((o) => `- ${String(o).slice(0, 160)}`).join('\n')}` : null,
        `OBSADA:\n${obsada.map((a) => `- ${a.imie}: ${a.rola || 'postać'}`).join('\n')}`,
    ].filter(Boolean).join('\n\n');
    return { system, user };
}

/** Odpowiedź modelu → propozycje {opis, postacie: [id]}; postacie spoza obsady odpadają, scena z < 2 postaciami też. */
export function odczytajPlanScen(tekst, obsada = [], ile = MAX_PROPOZYCJI) {
    const ktoTo = (nazwa) => {
        const n = bezOgonkow(nazwa).replace(/[^a-z0-9 -]/g, '').trim();
        if (n.length < 2) return null;
        return obsada.find((a) => bezOgonkow(a.imie) === n)?.id
            ?? obsada.find((a) => bezOgonkow(a.imie).split(/\s+/)[0] === n.split(/\s+/)[0])?.id ?? null;
    };
    const wynik = [];
    for (const linia of String(tekst ?? '').replace(/\r/g, '').split('\n')) {
        const m = linia.match(/scena\s*\d*\s*:\s*(.+?)\s*\|\s*postacie\s*:\s*(.+)$/i);
        if (!m) continue;
        const opis = m[1].replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);
        const postacie = [...new Set(m[2].split(/[,;/&]|\s+i\s+|\s+and\s+/).map(ktoTo).filter(Boolean))].slice(0, MAX_POSTACI);
        if (opis.length >= 5 && postacie.length >= 2) wynik.push({ opis, postacie });
        if (wynik.length >= ile) break;
    }
    return wynik;
}

/** Dialog sceny jako fragment rękopisu (HTML) — z markerem, żeby ponowny eksport podmienił, a nie dublował. */
export function blokRekopisu(s, imie = (id) => id) {
    const kw = (s.kwestie ?? []).map((k) => `<p><b>${html(String(imie(k.kto)).toUpperCase())}:</b> ${html(k.tekst)}</p>`).join('');
    return `<!--scena:${s.id}--><h3>${html(s.opis)}</h3>${kw}<p><i>— dialog: ${html(s.model ?? 'model')} · Sceny dialogowe [szkic AI]</i></p><!--/scena:${s.id}-->`;
}
export const tytulRozdzialuSceny = (s) => (s.odcinek ? `Odcinek ${s.odcinek.numer ?? '?'} — ${s.odcinek.tytul} · dialogi [szkic AI]` : 'Sceny dialogowe [szkic AI]');

/** Kadr pod kwestią: wskazany (`tlo` = indeks) albo — przy kilku tłach — „swój” kadr mówiącego (ujęcie–przeciwujęcie). */
export function tloKwestii(kw, tla, postacie) {
    if (!tla.length) return null;
    if (Number.isInteger(kw.tlo) && tla[kw.tlo]) return kw.tlo;
    if (tla.length === 1) return 0;
    const i = Math.max(0, postacie.findIndex((p) => p.id === kw.kto));
    return i % tla.length;
}

/**
 * Argumenty ffmpeg jednego ujęcia sceny. `tlo` = { plik, ox, oy } (obraz z najazdem albo klip zapętlony),
 * `karta` = zdjęcie/klip mówiącego w rogu (opcjonalnie), `imiePlik` = imię nad napisem (opcjonalnie).
 * Napisy jak w kinie: na dole, wyśrodkowane, biała czcionka z obwódką. Nazwy plików WZGLĘDNE do cwd.
 */
export function argumentyUjecia({ tlo, karta = null, kolor = '#f4c84a', imiePlik = null, liniePliki, czcionka, czas, audio, wyjscie }) {
    const d = Number(czas).toFixed(2), klatek = Math.max(1, Math.round(czas * FPS));
    const tloWideo = WIDEO.test(tlo.plik);
    const wejscia = tloWideo ? ['-stream_loop', '-1', '-t', d, '-i', tlo.plik] : ['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', tlo.plik];
    if (karta) wejscia.push(...(WIDEO.test(karta) ? ['-stream_loop', '-1', '-t', d, '-i', karta] : ['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', karta]));
    wejscia.push(...(audio ? ['-i', audio] : ['-f', 'lavfi', '-t', d, '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']));
    const ia = karta ? 2 : 1;
    const tloF = tloWideo
        ? `[0:v]fps=${FPS},scale=${SZER}:${WYS}:force_original_aspect_ratio=increase,crop=${SZER}:${WYS},setsar=1[bg]`
        : `${filtrTla(0, { ox: tlo.ox ?? 0.5, oy: tlo.oy ?? 0.5, z0: 1.05, z1: 1.14, klatek })}[bg]`;
    const dol = WYS - 48 - liniePliki.length * 44;
    const rys = [
        `drawbox=x=0:y=${dol - (imiePlik ? 64 : 28)}:w=iw:h=${WYS - dol + (imiePlik ? 64 : 28)}:color=black@0.35:t=fill`,
        ...(imiePlik ? [`drawtext=fontfile=${czcionka}:textfile=${imiePlik}:expansion=none:fontsize=26:fontcolor=${jasniej(kolor)}:x=(w-text_w)/2:y=${dol - 40}:shadowcolor=black@0.8:shadowx=2:shadowy=2`] : []),
        ...liniePliki.map((p, i) => `drawtext=fontfile=${czcionka}:textfile=${p}:expansion=none:fontsize=34:fontcolor=white:borderw=2:bordercolor=black@0.85:x=(w-text_w)/2:y=${dol + i * 44}`),
        'fade=t=in:st=0:d=0.2', `fade=t=out:st=${Math.max(0, czas - 0.2).toFixed(2)}:d=0.2`, 'format=yuv420p',
    ].join(',');
    const wizja = karta
        ? `${tloF};[1:v]fps=${FPS},scale=260:300:force_original_aspect_ratio=decrease,pad=iw+8:ih+8:4:4:color=${kolorFf(kolor)}[k];[bg][k]overlay=x=W-w-40:y=40:shortest=0[bk];[bk]${rys}[v]`
        : `${tloF};[bg]${rys}[v]`;
    const filtr = `${wizja};[${ia}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${d}[a]`;
    return ['-y', ...wejscia, '-filter_complex', filtr, '-map', '[v]', '-map', '[a]', '-t', d, '-r', String(FPS),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', wyjscie];
}

/**
 * @param {{ katalog:string, aktorzy:()=>Promise<object[]>, katalogProjektu:(projekt:string)=>Promise<string>,
 *   chat:(model:string|null, system:string, user:string, opcje?:object)=>Promise<{tekst:string, silnik?:string}>,
 *   modelDla?:(id:string)=>Promise<string|null>, kontekst?:(projekt:string)=>Promise<{opis?:string}>,
 *   mow?:(o:{tekst:string, glos:object|null, jezyk:string})=>Promise<{audio:Buffer, ext:string}>,
 *   opisz:(p:string)=>Promise<{sekundy:number|null}>, katalogMontazy:(projekt:string)=>Promise<string>,
 *   ffmpeg?:string, szyna?:any, teraz?:()=>number, sciezkaPodkladu?:(plik:string)=>string }} o
 */
export function utworzSceny(o) {
    const cfg = { ffmpeg: 'ffmpeg', teraz: () => Date.now(), modelDla: async () => null, kontekst: async () => ({}), ...o };
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Aktor', rodzaj: 'praca', tresc })?.catch?.(() => {});
    const wRobocie = new Map();
    const czytaj = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
    const pisz = async (p, d) => { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(`${p}.tmp`, JSON.stringify(d, null, 1), 'utf8'); await fs.rename(`${p}.tmp`, p); };
    const ff = (args, cwd) => new Promise((ok, zle) => execFile(cfg.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { cwd, windowsHide: true, timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024 },
        (e, _o, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').slice(-3).join(' | ').slice(0, 400)}`)) : ok())));
    const czcionka = () => CZCIONKI.find((p) => fsSync.existsSync(p));
    const plikSceny = (id) => path.join(cfg.katalog, id, 'scena.json');
    const sprawdzId = (id) => { if (!/^s_[a-z0-9]+$/.test(String(id))) throw new Error('Złe id sceny.'); };

    async function wczytaj(id) {
        sprawdzId(id);
        const s = await czytaj(plikSceny(id), null);
        if (!s) throw new Error('Nie ma takiej sceny.');
        return { ...s, ...(wRobocie.has(id) ? { postep: wRobocie.get(id) } : {}) };
    }
    async function sceny(projekt = null) {
        const kat = await fs.readdir(cfg.katalog).catch(() => []);
        const l = [];
        for (const k of kat) if (/^s_[a-z0-9]+$/.test(k)) { const s = await czytaj(plikSceny(k), null); if (s && (!projekt || s.projekt === projekt)) l.push({ ...s, ...(wRobocie.has(k) ? { postep: wRobocie.get(k) } : {}) }); }
        return l.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    /** Kadry projektu do wyboru na tło: obrazy i klipy z katalogu produkcji (bez gotowych montaży), najnowsze pierwsze. */
    async function tlaProjektu(projekt) {
        const korzen = await cfg.katalogProjektu(projekt);
        const zebrane = [];
        const chodz = async (kat, gl) => {
            for (const w of await fs.readdir(kat, { withFileTypes: true }).catch(() => [])) {
                const p = path.join(kat, w.name);
                if (w.isDirectory()) { if (gl < 3 && !['montaz', 'praca', 'glos'].includes(w.name)) await chodz(p, gl + 1); continue; }
                if (!OBRAZ.test(w.name) && !WIDEO.test(w.name)) continue;
                const st = await fs.stat(p).catch(() => null);
                if (st) zebrane.push({ plik: p, nazwa: w.name, gdzie: path.relative(korzen, kat) || '.', wideo: WIDEO.test(w.name), czas: st.mtimeMs });
            }
        };
        await chodz(korzen, 0);
        return zebrane.sort((a, b) => b.czas - a.czas).slice(0, 300);
    }

    const normTla = (tla) => {
        const l = (Array.isArray(tla) ? tla : []).slice(0, 12).map((t) => (typeof t === 'string' ? { plik: t } : t)).map((t) => {
            const plik = String(t?.plik ?? '').trim();
            if (!plik || !(OBRAZ.test(plik) || WIDEO.test(plik)) || !fsSync.existsSync(plik)) throw new Error(`Tło sceny musi być istniejącym obrazem albo klipem: ${plik || '(puste)'}`);
            const n = (v, d) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : d);
            return { plik, ox: n(t.ox, 0.5), oy: n(t.oy, 0.5) };
        });
        return l;
    };

    async function obsadaSceny(ids) {
        const obsada = await cfg.aktorzy();
        const postacie = [...new Set(Array.isArray(ids) ? ids : [])].map((id) => obsada.find((a) => a.id === id)).filter(Boolean).slice(0, MAX_POSTACI);
        if (postacie.length < 2) throw new Error('Scena dialogowa potrzebuje co najmniej dwóch postaci z obsady (najwyżej czterech).');
        return postacie;
    }
    const kwestieZ = (tekst, postacie) => odczytajScenariusz(tekst, { goscie: postacie.slice(1), prowadzacy: postacie[0] });

    /** Odcinki projektu (Reżyser: serial = projekt) — tylko z tytułem. */
    async function odcinkiProjektu(projekt) {
        return ((await cfg.odcinki?.(projekt).catch(() => [])) ?? []).filter((o) => o?.id && o?.tytul);
    }
    async function odcinekProjektu(projekt, id) {
        const o = (await odcinkiProjektu(projekt)).find((x) => x.id === id);
        if (!o) throw new Error('Nie ma takiego odcinka w tym projekcie (Reżyser).');
        return o;
    }

    /** Odcinki z liczbą scen dialogowych — do wyboru „Sceny z odcinka”. */
    async function odcinkiZeScenami(projekt) {
        const p = String(projekt ?? '').trim();
        if (!p) throw new Error('Wybierz projekt.');
        const wszystkie = await sceny(p);
        return (await odcinkiProjektu(p)).map((o) => ({
            id: o.id, numer: o.numer ?? null, tytul: o.tytul, streszczenie: String(o.streszczenie ?? ''), status: o.status ?? null,
            scen: wszystkie.filter((s) => s.odcinek?.id === o.id).length,
        })).sort((a, b) => (a.numer ?? 0) - (b.numer ?? 0));
    }

    /** Propozycje scen dialogowych dla odcinka (nic nie zapisuje — Suweren wybiera, co napisać). */
    async function planZOdcinka({ projekt, odcinekId, ile = 4, jezyk = 'pl' } = {}) {
        const p = String(projekt ?? '').trim();
        if (!p) throw new Error('Wybierz projekt.');
        const odcinek = await odcinekProjektu(p, odcinekId);
        const obsada = (await cfg.aktorzy()).filter((a) => a.id !== 'kronikarz');
        if (obsada.length < 2) throw new Error('Obsada ma mniej niż dwie postacie — dodaj aktorów w zakładce 🎭 Aktorzy.');
        const n = Math.max(1, Math.min(MAX_PROPOZYCJI, Number(ile) || 4));
        const kanon = (await cfg.kontekst(p).catch(() => ({})))?.opis ?? '';
        const rekopis = (await cfg.rekopis?.tekst?.(p).catch(() => '')) ?? '';
        const juz = (await sceny(p)).filter((s) => s.odcinek?.id === odcinek.id).map((s) => s.opis);
        const { system, user } = promptPlanuScen({ odcinek, kanon, rekopis, obsada, juz, ile: n, jezyk: jezykWywiadu(jezyk) });
        const model = (await cfg.modelDla('aktor').catch(() => null)) ?? (await cfg.modelDla('kronikarz').catch(() => null));
        const { tekst, silnik } = await cfg.chat(model, system, user, {});
        const propozycje = odczytajPlanScen(tekst, obsada, n);
        if (!propozycje.length) throw new Error('Model nie rozpisał scen w formacie „SCENA: … | POSTACIE: …” z imionami z obsady — spróbuj ponownie albo innym modelem.');
        return { odcinek: { id: odcinek.id, numer: odcinek.numer ?? null, tytul: odcinek.tytul }, propozycje, model: silnik ?? model ?? null, rekopis: rekopis.length > 0 };
    }

    /** Dialog sceny do Rękopisu projektu: rozdział odcinka (albo „Sceny dialogowe”), ponowny eksport podmienia blok. */
    async function doRekopisu(id) {
        const s = await wczytaj(id);
        if (!cfg.rekopis?.wczytaj) throw new Error('Rękopis nie jest podłączony w tym moście.');
        const obsada = await cfg.aktorzy();
        const imie = (kid) => obsada.find((a) => a.id === kid)?.imie ?? kid;
        const blok = blokRekopisu(s, imie);
        const tytul = tytulRozdzialuSceny(s);
        const r = await cfg.rekopis.wczytaj(s.projekt);
        const roz = (r.rozdzialy ?? []).find((x) => x.tytul === tytul);
        let rozdzial, nowy = false, podmieniony = false;
        if (roz) {
            const wzor = new RegExp(`<!--scena:${s.id}-->[\\s\\S]*?<!--/scena:${s.id}-->`);
            podmieniony = wzor.test(roz.tresc);
            const tresc = podmieniony ? roz.tresc.replace(wzor, () => blok) : `${roz.tresc}${blok}`;
            await cfg.rekopis.zapisz(s.projekt, roz.id, tresc);
            rozdzial = roz.id;
        } else {
            rozdzial = (await cfg.rekopis.dodaj(s.projekt, { tytul, tresc: blok })).id;
            nowy = true;
        }
        const zap = { ...s };
        delete zap.postep;
        zap.rekopis = { rozdzial, tytul, kiedy: czas() };
        await pisz(plikSceny(id), zap);
        return { scena: zap, rozdzial, tytul, nowy, podmieniony };
    }

    /** Nowa scena: postacie (2–4 z obsady), opis sytuacji, tła (opcjonalnie), styl, Pralka, język → dialog modelu. */
    async function przygotuj({ projekt, postacie: ids = [], opis = '', uwagi = '', tla = [], jezyk = 'pl', styl = 'domyslny', pralka = 0, karty = false, imiona = false, odcinekId = null } = {}) {
        const p = String(projekt ?? '').trim();
        if (!p) throw new Error('Scena należy do projektu — wybierz projekt w Reżyserze.');
        const o = String(opis).trim();
        if (o.length < 5) throw new Error('Opisz scenę (kto, gdzie, o co chodzi).');
        const postacie = await obsadaSceny(ids);
        const tl = normTla(tla);
        const J = jezykWywiadu(jezyk), S = stylWywiadu(styl);
        const odc = odcinekId ? await odcinekProjektu(p, odcinekId) : null;
        const kanon = [(await cfg.kontekst(p).catch(() => ({})))?.opis ?? '', opisOdcinka(odc)].filter(Boolean).join('\n\n');
        const { system, user } = promptSceny({ postacie, opis: o, kanon, uwagi, jezyk: J, styl: S });
        const model = (await cfg.modelDla('aktor').catch(() => null)) ?? (await cfg.modelDla('kronikarz').catch(() => null));
        const temperatura = temperaturaZPralki(pralka);
        const { tekst, silnik } = await cfg.chat(model, system, user, { temperatura });
        const kwestie = kwestieZ(tekst, postacie);
        const id = `s_${cfg.teraz().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const s = {
            id, projekt: p, opis: o.slice(0, 800), uwagi: String(uwagi).slice(0, 600), postacie: postacie.map((a) => a.id), tla: tl, kwestie,
            jezyk: J, styl: S, pralka: Number(pralka) || 0, rundy: 1, karty: !!karty, imiona: !!imiona, model: silnik ?? model ?? null, etap: 'scenariusz', utworzono: czas(),
            ...(odc ? { odcinek: { id: odc.id, numer: odc.numer ?? null, tytul: odc.tytul } } : {}),
        };
        await pisz(plikSceny(id), s);
        nadaj(`scena dialogowa w projekcie ${p}: ${postacie.map((a) => a.imie).join(', ')} — ${kwestie.length} kwestii`);
        return s;
    }

    /** Poprawki Suwerena: kwestie (z przypisanym tłem), tła, opis, napisy z imionami, karty mówiących. */
    async function zmien(id, { kwestie, tla, opis, karty, imiona } = {}) {
        const s = await wczytaj(id);
        if (wRobocie.has(id)) throw new Error('Scena się nagrywa — poczekaj na koniec.');
        const zap = { ...s };
        delete zap.postep;
        if (tla !== undefined) zap.tla = normTla(tla);
        if (Array.isArray(kwestie)) {
            const dozwoleni = new Set(s.postacie);
            const nowe = kwestie.map((k) => ({ kto: String(k?.kto ?? ''), tekst: String(k?.tekst ?? '').replace(/\s+/g, ' ').trim().slice(0, 400), ...(Number.isInteger(k?.tlo) ? { tlo: k.tlo } : {}) }))
                .filter((k) => dozwoleni.has(k.kto) && k.tekst.length >= 2);
            if (nowe.length < 2) throw new Error('Scena potrzebuje co najmniej dwóch kwestii postaci z tej sceny.');
            zap.kwestie = nowe.slice(0, MAX_KWESTII);
        }
        if (zap.tla) zap.kwestie = zap.kwestie.map((k) => (Number.isInteger(k.tlo) && !zap.tla[k.tlo] ? (({ tlo, ...r }) => r)(k) : k));
        if (opis !== undefined) zap.opis = String(opis).trim().slice(0, 800) || zap.opis;
        if (karty !== undefined) zap.karty = !!karty;
        if (imiona !== undefined) zap.imiona = !!imiona;
        zap.zmieniono = czas();
        await pisz(plikSceny(id), zap);
        return zap;
    }

    /** Dalszy ciąg (1–3 części): model dopisuje nowy zwrot, licznik rund rośnie, limit kwestii pilnowany. */
    async function dalej(id, { rundy = 1, styl, pralka } = {}) {
        const s = await wczytaj(id);
        if (wRobocie.has(id)) throw new Error('Scena się nagrywa — poczekaj na koniec.');
        if ((s.rundy ?? 1) >= MAX_RUND) throw new Error(`Scena ma już ${s.rundy} części (limit ${MAX_RUND}).`);
        const postacie = await obsadaSceny(s.postacie);
        const imie = (kid) => postacie.find((a) => a.id === kid)?.imie ?? kid;
        const S = stylWywiadu(styl ?? s.styl), P = pralka ?? s.pralka;
        const model = (await cfg.modelDla('aktor').catch(() => null)) ?? (await cfg.modelDla('kronikarz').catch(() => null));
        const zap = { ...s };
        delete zap.postep;
        const ile = Math.max(1, Math.min(3, Number(rundy) || 1, MAX_RUND - (s.rundy ?? 1)));
        for (let r = 0; r < ile; r += 1) {
            if (zap.kwestie.length >= MAX_KWESTII) break;
            const { system, user } = promptDalszegoCiagu({ postacie, opis: s.opis, kwestie: zap.kwestie, imie, jezyk: s.jezyk, styl: S, runda: zap.rundy ?? 1 });
            const { tekst } = await cfg.chat(model, system, user, { temperatura: temperaturaZPralki(P) });
            zap.kwestie = [...zap.kwestie, ...kwestieZ(tekst, postacie)].slice(0, MAX_KWESTII);
            zap.rundy = (zap.rundy ?? 1) + 1;
        }
        Object.assign(zap, { styl: S, pralka: Number(P) || 0, zmieniono: czas() });
        await pisz(plikSceny(id), zap);
        return zap;
    }

    /** Nagranie w tle: na kwestię głos postaci (ze schowka, jeśli już był) i ujęcie na jej kadrze → sklejka → montaże projektu. */
    async function nagraj(id, { bezGlosu = false, podklad = null, glosnosc = 0.12 } = {}) {
        const s = await wczytaj(id);
        if (wRobocie.has(id)) throw new Error('Ta scena już się nagrywa.');
        if (!s.tla?.length) throw new Error('Scena nie ma tła — wybierz co najmniej jeden kadr projektu.');
        if (!bezGlosu && !cfg.mow) throw new Error('Katedra nie ma silnika głosu — nagraj „bez głosu” (same napisy).');
        const plikPodkladu = podklad ? cfg.sciezkaPodkladu?.(podklad) : null;
        if (podklad && (!plikPodkladu || !fsSync.existsSync(plikPodkladu))) throw new Error(`Nie ma podkładu: ${podklad}`);
        const postacie = await obsadaSceny(s.postacie);
        const mowca = (kid) => postacie.find((a) => a.id === kid) ?? { id: kid, imie: kid, kolor: '#f4c84a', glos: null };
        const zapis = { ...s, etap: 'nagrywa', blad: null };
        delete zapis.postep;
        await pisz(plikSceny(id), zapis);
        wRobocie.set(id, { etap: 'start', zrobione: 0, wszystkich: s.kwestie.length });
        (async () => {
            const praca = path.join(cfg.katalog, id, 'praca');
            const schowek = path.join(cfg.katalog, id, 'glos');
            try {
                await fs.rm(praca, { recursive: true, force: true });
                await fs.mkdir(praca, { recursive: true });
                await fs.mkdir(schowek, { recursive: true });
                const zrodlo = czcionka();
                if (!zrodlo) throw new Error('Nie znalazłem czcionki z polskimi znakami (OTAKOS_POWITANIE_CZCIONKA).');
                await fs.copyFile(zrodlo, path.join(praca, 'czcionka.ttf'));
                const jez = jezykWywiadu(s.jezyk);
                const tla = new Map(), segmenty = [];
                for (const [i, kw] of s.kwestie.entries()) {
                    const m = mowca(kw.kto);
                    wRobocie.set(id, { etap: `${m.imie}: ${bezGlosu ? 'ujęcie' : 'głos'}`, zrobione: i, wszystkich: s.kwestie.length });
                    let audio = null, dl = czasBezGlosu(kw.tekst);
                    if (!bezGlosu) {
                        const klucz = createHash('sha1').update(JSON.stringify([kw.tekst, m.glos ?? null, jez])).digest('hex').slice(0, 20);
                        const zSchowka = ['wav', 'mp3'].map((e) => path.join(schowek, `${klucz}.${e}`)).find((f) => fsSync.existsSync(f));
                        if (zSchowka) {
                            audio = `a-${String(i + 1).padStart(3, '0')}${path.extname(zSchowka)}`;
                            await fs.copyFile(zSchowka, path.join(praca, audio));
                        } else {
                            const g = await cfg.mow({ tekst: kw.tekst, glos: m.glos ?? null, jezyk: jez }).catch((e) => { throw new Error(`Głos „${m.imie}” (kwestia ${i + 1}/${s.kwestie.length}): ${e.message}`); });
                            audio = `a-${String(i + 1).padStart(3, '0')}.${g.ext || 'wav'}`;
                            await fs.writeFile(path.join(praca, audio), g.audio);
                            await fs.writeFile(path.join(schowek, `${klucz}.${g.ext || 'wav'}`), g.audio).catch(() => {});
                        }
                        const sek = (await cfg.opisz(path.join(praca, audio)).catch(() => null))?.sekundy;
                        if (sek) dl = Math.round((sek + 0.35) * 100) / 100;
                    }
                    const ti = tloKwestii(kw, s.tla, postacie);
                    const t = s.tla[ti];
                    if (!tla.has(ti)) { const n = `t-${ti}${path.extname(t.plik).toLowerCase()}`; await fs.copyFile(t.plik, path.join(praca, n)); tla.set(ti, n); }
                    let karta = null;
                    const zrKarty = s.karty ? [m.wideo, m.zdjecie].find((f) => f && fsSync.existsSync(f)) : null;
                    if (zrKarty) { karta = `k-${m.id}${path.extname(zrKarty).toLowerCase()}`; if (!fsSync.existsSync(path.join(praca, karta))) await fs.copyFile(zrKarty, path.join(praca, karta)); }
                    const nr = String(i + 1).padStart(3, '0');
                    let imiePlik = null;
                    if (s.imiona) { imiePlik = `i-${nr}.txt`; await fs.writeFile(path.join(praca, imiePlik), m.imie, 'utf8'); }
                    const linie = [];
                    for (const [j, l] of zawin(kw.tekst, 56, 3).entries()) { const n = `l-${nr}-${j}.txt`; await fs.writeFile(path.join(praca, n), l, 'utf8'); linie.push(n); }
                    await ff(argumentyUjecia({ tlo: { ...t, plik: tla.get(ti) }, karta, kolor: m.kolor || '#f4c84a', imiePlik, liniePliki: linie, czcionka: 'czcionka.ttf', czas: dl, audio, wyjscie: `u-${nr}.mp4` }), praca);
                    segmenty.push(`u-${nr}.mp4`);
                }
                wRobocie.set(id, { etap: 'sklejanie', zrobione: s.kwestie.length, wszystkich: s.kwestie.length });
                await fs.writeFile(path.join(praca, 'lista.txt'), segmenty.map((p) => `file '${p}'`).join('\n'), 'utf8');
                await ff(['-y', '-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', '-movflags', '+faststart', 'scena.mp4'], praca);
                let gotowy = 'scena.mp4';
                if (plikPodkladu) {
                    wRobocie.set(id, { etap: 'podkład', zrobione: s.kwestie.length, wszystkich: s.kwestie.length });
                    const ext = path.extname(plikPodkladu).toLowerCase();
                    await fs.copyFile(plikPodkladu, path.join(praca, `podklad${ext}`));
                    const dl = (await cfg.opisz(path.join(praca, 'scena.mp4')).catch(() => null))?.sekundy ?? 0;
                    await ff(argumentyPodkladu({ film: 'scena.mp4', podklad: `podklad${ext}`, wyjscie: 'scena-p.mp4', sekundy: dl, glosnosc }), praca);
                    gotowy = 'scena-p.mp4';
                }
                const katMontazy = await cfg.katalogMontazy(s.projekt);
                const cel = path.join(katMontazy, `scena_${slug(s.opis) || 'dialog'}${jez === 'pl' ? '' : `_${jez}`}_${id.slice(2)}.mp4`);
                await fs.copyFile(path.join(praca, gotowy), cel);
                const o2 = await cfg.opisz(cel).catch(() => null);
                Object.assign(zapis, { etap: 'gotowa', plik: cel, sekundy: o2?.sekundy ?? null, nagrano: czas() });
                await pisz(plikSceny(id), zapis);
                nadaj(`scena dialogowa nagrana (${postacie.map((a) => a.imie).join(', ')}) — w montażach projektu ${s.projekt}`);
                await fs.rm(praca, { recursive: true, force: true }).catch(() => {});
            } catch (e) {
                Object.assign(zapis, { etap: 'blad', blad: String(e.message || e).slice(0, 500) });
                await pisz(plikSceny(id), zapis).catch(() => {});
            } finally { wRobocie.delete(id); }
        })();
        return { ...zapis, postep: wRobocie.get(id) };
    }

    async function usun(id) {
        sprawdzId(id);
        if (wRobocie.has(id)) throw new Error('Scena się nagrywa — poczekaj na koniec.');
        await fs.rm(path.join(cfg.katalog, id), { recursive: true, force: true });
        return { id };
    }

    /** Plik do podglądu: gotowa scena albo tło z listy sceny (nic spoza niej). */
    async function plik(id, rodzaj = 'scena', nr = 0) {
        const s = await wczytaj(id);
        const p = rodzaj === 'tlo' ? s.tla?.[Number(nr)]?.plik : s.plik;
        if (!p || !fsSync.existsSync(p)) throw new Error('Nie ma takiego pliku.');
        return p;
    }

    return { sceny, scena: wczytaj, tlaProjektu, przygotuj, zmien, dalej, nagraj, usun, plik, odcinki: odcinkiZeScenami, planZOdcinka, doRekopisu, zajete: () => wRobocie.size > 0 };
}

export default { utworzSceny, promptSceny, promptDalszegoCiagu, promptPlanuScen, odczytajPlanScen, blokRekopisu, argumentyUjecia, tloKwestii, MAX_POSTACI, MAX_KWESTII, MAX_RUND };
