/**
 * 🦎 Mame Leon Show — nocny talk-show Katedry (Suweren 2026-10-16: „nowe studio talk-show: kanapa dla gości,
 * prowadzący na swoim fotelu… goście = TeOgochi i bryły z Assetów 3D/Meshy… głosy z Głosów Stada”).
 *
 * Mame Leon to KAMELEON-gawędziarz (wybór Suwerena): ciepły, ciekawski, z łagodnym humorem — jego skóra zmienia
 * barwę z nastrojem rozmowy (każda jego linia ma nastrój z zamkniętej listy `NASTROJE`, studio barwi go tym kolorem).
 * Studio late-night: biurko i fotel prowadzącego po lewej, kanapa gości po prawej, nocne miasto za oknem
 * (apka `_OtakOs_Apki/studio-zebrra`, strona `mame-leon.html`).
 *
 * Odcinek: temat od Suwerena + do 3 gości (TeOgochi ze stada — imię i dziedzina z karty, XP ze stada; albo bryła
 * z Assetów 3D — imię i opis bryły). Model gospodarza pisze rozmowę TYLKO z tych faktów: każda liczba musi być
 * w temacie/uwagach/faktach gości (`liczbyPozaFaktami`), mówią tylko gospodarz i goście — inaczej jedna poprawka,
 * potem błąd wprost. Głosy: Głosy Stada (`kameleon` dla gospodarza, id TeOgochi dla gościa ze stada, dla bryły —
 * wskazana barwa). Nagranie apki → `produkcje/mame-leon-show/montaz/mameleon_<temat>_<jezyk>_<id>.mp4` → Kronikarz
 * → ✓ w Izbie (i 📱 Formaty widzą katalog montaży).
 */
import fsSync from 'fs';
import fsP from 'fs/promises';
import path from 'path';
import { liczbyPozaFaktami, bezpNazwa, utworzMagazyn, glosKwestii, nagranieDoMp4 } from './OdcinkiStudia.js';
import { klockiWJezyku } from './TeoGameShow.js';

export const PROGRAM = 'mame-leon';
export const PROJEKT = 'mame-leon-show';
export const NAZWA = 'Mame Leon Show';
export const MAX_GOSCI = 3;
export const JEZYKI = { en: 'English', pl: 'polski' };
const ID = /^m-[0-9a-f]{8}$/;
const ID_GLOSU = /^[a-z0-9][a-z0-9-]{1,30}$/;

export const GOSPODARZ = {
    id: 'kameleon', imie: 'Mame Leon', imieEn: 'Mame Leon', emoji: '🦎',
    temperament: 'ciepły gawędziarz nocnego talk-show, ciekawski i serdeczny, z łagodnym humorem; zadaje krótkie pytania, słucha gości, czasem żartuje, że jego skóra zdradza, co czuje',
    temperamentEn: 'a warm late-night storyteller, curious and kind, with gentle humour; asks short questions, lets guests talk, sometimes jokes that his skin gives away how he feels',
};
/** Nastroje gospodarza → barwa skóry kameleona (studio) i etykieta w scenariuszu (pl/en). */
export const NASTROJE = {
    cieply: { pl: 'ciepły', en: 'warm', kolor: '#22c55e' },
    ciekawy: { pl: 'ciekawy', en: 'curious', kolor: '#38bdf8' },
    rozbawiony: { pl: 'rozbawiony', en: 'amused', kolor: '#facc15' },
    zaskoczony: { pl: 'zaskoczony', en: 'surprised', kolor: '#f97316' },
    wzruszony: { pl: 'wzruszony', en: 'moved', kolor: '#e879f9' },
    skupiony: { pl: 'skupiony', en: 'focused', kolor: '#a78bfa' },
};
/** Etykieta nastroju (pl albo en, z polskimi znakami albo bez) → klucz; nieznana = null. */
export function nastrojZEtykiety(t) {
    const n = String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').trim();
    for (const [k, v] of Object.entries(NASTROJE)) if ([k, v.en, v.pl.normalize('NFD').replace(/[̀-ͯ]/g, '')].includes(n)) return k;
    return null;
}

/**
 * Imię gościa-bryły: pierwsza nazwa w cudzysłowie z opisu („Kot Tancerz”), inaczej nazwa assetu bez przedrostka
 * `mini-teogochi-` i myślników — „mini-teogochi-kot-tancerz-wariant-sy” nie jest imieniem do napisów.
 */
export function imieBryly(b) {
    const z = /[„"“]([^”"„“]{2,40})[”"“]/.exec(String(b?.opis ?? ''))?.[1]?.trim();
    if (z) return z;
    const n = String(b?.nazwa ?? '').replace(/^mini-teogochi-/i, '').replace(/[-_]+/g, ' ').trim();
    return n ? (n[0].toUpperCase() + n.slice(1)).slice(0, 40) : 'Gość';
}

/**
 * 🪑 Przydział ruchów bryły w programie (Suweren 2026-10-16: „postacie na kanapie mają siedzieć… siedzenie + parę
 * gestykulacji… przypisać do programu na stałe, do każdego modelu dozwolone ruchy”): nazwy klipów z riga —
 * `siedzi` (spoczynek na siedząco, cała postać), `mowi` i `okrzyk` (gesty: studio bierze z nich TYLKO górę ciała,
 * nogi zostają w siedzeniu). Pusty przydział = studio dobiera samo z nazw klipów.
 */
export function oczyscPrzydzial(p) {
    const n = (x) => String(x ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 100);
    const lista = (x) => [...new Set((Array.isArray(x) ? x : []).map(n).filter(Boolean))].slice(0, 12);
    return { siedzi: n(p?.siedzi) || null, mowi: lista(p?.mowi), okrzyk: lista(p?.okrzyk) };
}
const ID_BRYLY = /^[a-z0-9][a-z0-9-]{0,99}$/;

/** Klucz imienia do porównań (bez wielkości liter i znaków diakrytycznych). */
const kluczImienia = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();

/** Wszystkie liczby, które rozmowa może wypowiedzieć: z tematu, uwag i faktów gości (+ liczba gości). */
export function liczbyFaktow(s) {
    const z = (t) => String(t ?? '').match(/\d+(?:[.,]\d+)?/g)?.map((x) => x.replace(',', '.')) ?? [];
    return [s.goscie.length, ...z(s.temat), ...z(s.uwagi), ...s.goscie.flatMap((g) => [g.xp ?? null, ...z(g.imie), ...z(g.opis), ...z(g.dziedzina)])].filter((x) => x !== null);
}

export function promptRozmowy(s) {
    const en = s.jezyk === 'en';
    const goscie = s.goscie.map((g, i) => `GOŚĆ ${i + 1}: ${g.imie} — ${g.rodzaj === 'teogochi' ? `TeOgochi ze stada Katedry, dziedzina: ${g.dziedzina || '—'}${g.xp != null ? `, ${g.xp} XP` : ''}` : `postać z Assetów 3D Katedry${g.opis ? `: ${g.opis}` : ''}`}`).join('\n');
    const etykiety = Object.values(NASTROJE).map((v) => (en ? v.en : v.pl)).join(', ');
    const system = [
        `Piszesz rozmowę do nocnego talk-show „${NAZWA}” Katedry OtakOS. Gospodarz: ${GOSPODARZ.imie}, kameleon — ${en ? GOSPODARZ.temperamentEn : GOSPODARZ.temperament}. Goście siedzą na kanapie.`,
        'ŻELAZNE ZASADY:',
        '1. Rozmowa TYLKO o temacie i faktach podanych niżej. Goście mówią o sobie wyłącznie to, co jest w ich faktach — nie wymyślasz im przeszłości, rodzin, nagród ani wydarzeń.',
        '2. Każda liczba, którą ktoś wypowie, musi być w temacie, uwagach albo faktach gości. Żadnych innych liczb ani dat.',
        '3. Mówią tylko gospodarz i podani goście. Każdy gość mówi co najmniej dwa razy. Gospodarz otwiera i zamyka program.',
        `4. 10–22 linie, każda 1–3 zdania mówione na głos. Bez emoji, bez markdown, bez opisów sceny. Język: ${en ? 'English' : 'polski'}.`,
        'FORMAT (każda linia osobno, nic poza tym):',
        `${GOSPODARZ.imie.toUpperCase()} [nastrój]: … — nastrój gospodarza z listy: ${etykiety}`,
        ...s.goscie.map((g) => `${g.imie}: …`),
    ].join('\n');
    const user = `TEMAT: ${s.temat}${s.uwagi ? `\nUWAGI SUWERENA: ${s.uwagi}` : ''}\n${goscie}`;
    return { system, user };
}

/**
 * Rozmowa z tekstu modelu → kwestie [{ kto: 'kameleon' | 'g1'…, tekst, nastroj? }]. Linia nieznanego mówcy, brak
 * gościa albo zła długość = błąd. Kontynuacja bez etykiety dokleja się do poprzedniej kwestii.
 */
export function odczytajRozmowe(tekst, goscie, { min = 8, max = 30 } = {}) {
    const mowcy = new Map([[kluczImienia(GOSPODARZ.imie), 'kameleon'], ['mame leon', 'kameleon'], ['mameleon', 'kameleon']]);
    goscie.forEach((g, i) => mowcy.set(kluczImienia(g.imie), `g${i + 1}`));
    const out = [], obcy = [];
    for (const surowa of String(tekst ?? '').replace(/\r/g, '').split('\n')) {
        const l = surowa.replace(/^[\s*#>-]+/, '').replace(/\*\*/g, '').trim();
        if (!l) continue;
        const m = /^([^:：[\]]{1,40}?)\s*(?:\[([^\]]{1,20})\])?\s*[:：]\s*(.+)$/.exec(l);
        const kto = m ? mowcy.get(kluczImienia(m[1])) : null;
        // „To jest: coś” w środku wypowiedzi to nie mówca — za obcego mówcę uznajemy tylko krótką etykietę (≤ 3 słowa)
        if (m && !kto && m[1].trim().split(/\s+/).length <= 3) { obcy.push(m[1].trim()); continue; }
        if (m && kto) {
            const k = { kto, tekst: m[3].trim() };
            if (kto === 'kameleon') k.nastroj = nastrojZEtykiety(m[2]) ?? 'cieply';
            out.push(k);
        } else if (out.length) out[out.length - 1].tekst = `${out[out.length - 1].tekst} ${l}`.trim();
    }
    if (obcy.length) throw new Error(`mówią osoby spoza programu: ${[...new Set(obcy)].slice(0, 4).join(', ')}`);
    if (out.length < min || out.length > max) throw new Error(`rozmowa ma ${out.length} linii (potrzeba ${min}–${max})`);
    if (out[0].kto !== 'kameleon') throw new Error(`program otwiera ${GOSPODARZ.imie}`);
    if (out[out.length - 1].kto !== 'kameleon') throw new Error(`program zamyka ${GOSPODARZ.imie}`);
    const cisi = goscie.filter((_, i) => out.filter((k) => k.kto === `g${i + 1}`).length < 2).map((g) => g.imie);
    if (cisi.length) throw new Error(`gość mówi mniej niż dwa razy: ${cisi.join(', ')}`);
    return out;
}

export function sprawdzLiczby(kwestie, s) {
    const dozw = liczbyFaktow(s);
    const zle = kwestie.map((k, i) => [i + 1, liczbyPozaFaktami(k.tekst, dozw)]).filter(([, z]) => z.length);
    return zle.length ? `liczby spoza faktów: ${zle.map(([n, z]) => `linia ${n} (${z.join(', ')})`).join('; ')}` : null;
}

/** Kwestie dla Studia: numer, mówca, imię, barwa głosu (Głosy Stada), nastrój gospodarza. */
export function kwestieOdcinka(s) {
    return (s.rozmowa ?? []).map((k, i) => {
        const g = k.kto === 'kameleon' ? null : s.goscie[Number(k.kto.slice(1)) - 1];
        return { nr: i + 1, typ: k.kto === 'kameleon' ? 'host' : 'gosc', gol: null, kto: k.kto, imie: g ? g.imie : GOSPODARZ.imie, glos: g ? g.glos : GOSPODARZ.id, nastroj: k.nastroj ?? null, tekst: k.tekst, naglowek: '', obraz: null };
    });
}

export function kontekstKronikarza(s) {
    const en = s.jezyk === 'en';
    return `Late-night talk show "${NAZWA}" of Katedra OtakOS. Host: ${GOSPODARZ.imie}, an animated chameleon (${GOSPODARZ.temperamentEn}); his skin changes colour with his mood. Topic: ${s.temat}. Guests on the sofa: ${s.goscie.map((g) => `${g.imie} (${g.rodzaj === 'teogochi' ? `TeOgochi creature, ${g.dziedzina || 'Katedra'}` : '3D character from the Katedra asset studio'})`).join(', ')}. Everything is an original 3D studio recording with AI voices from Katedra. ${en ? 'Write the title, description and tags in English.' : 'Tytuł, opis i tagi po polsku.'}`;
}
export const nazwaPublikacji = (s) => `${NAZWA} — ${s.temat.slice(0, 80)} · ${s.goscie.map((g) => g.imie).join(', ')}`;

/**
 * @param {{ katalog: string, katalogMontazy: (projekt: string) => Promise<string>,
 *   stado: () => Promise<{ wyklute: string[], stany: Record<string, any> }>, karta?: (id: string) => Promise<any>,
 *   bryla?: (id: string) => Promise<{ nazwa?: string, opis?: string }|null>,
 *   chat?: (model: string|null, system: string, user: string) => Promise<{ tekst: string }>, modelDla?: (id: string) => Promise<string|null>,
 *   mow?: (o: { tekst: string, glos: string, jezyk: string }) => Promise<{ audio: Buffer, ext: string }>,
 *   publikuj?: Function, opisz?: Function, ffmpeg?: string, szyna?: any, teraz?: () => number }} o
 */
export function utworzMameLeon(o) {
    const cfg = { ffmpeg: 'ffmpeg', teraz: () => Date.now(), modelDla: async () => null, karta: async () => null, bryla: async () => null, opisz: async () => ({ sekundy: null }), ...o };
    const M = utworzMagazyn({ katalog: cfg.katalog, program: PROGRAM, wzorId: ID });
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: GOSPODARZ.imie, rodzaj: 'praca', tresc: `🦎 ${tresc}` })?.catch?.(() => {});
    const czyste = (t, max) => String(t ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

    /** Kandydaci na kanapę: wyklute TeOgochi (imię ze stada, dziedzina z karty). Bryły wybiera apka z /api/assety3d. */
    async function kandydaci() {
        const st = await cfg.stado().catch(() => ({ wyklute: [], stany: {} }));
        const out = [];
        for (const id of st.wyklute ?? []) {
            if (id === GOSPODARZ.id) continue;
            const k = await cfg.karta(id).catch(() => null);
            out.push({ id, imie: st.stany?.[id]?.name || k?.imie || id, dziedzina: k?.dziedzina ?? null, xp: Number.isFinite(st.stany?.[id]?.xp) ? Math.round(st.stany[id].xp) : null });
        }
        return out;
    }

    /** Gość z wyboru Suwerena → fakty: TeOgochi musi być wyklute, bryła musi istnieć. */
    async function gosc(g) {
        if (g?.rodzaj === 'teogochi') {
            const k = (await kandydaci()).find((x) => x.id === g.id);
            if (!k) throw new Error(`TeOgochi „${g.id}” nie jest wyklute w stadzie tej Katedry.`);
            return { rodzaj: 'teogochi', id: k.id, imie: czyste(g.imie, 40) || k.imie, dziedzina: k.dziedzina, xp: k.xp, opis: null, glos: k.id, bryla: g.bryla ? String(g.bryla).slice(0, 80) : null };
        }
        if (g?.rodzaj === 'bryla') {
            const b = await cfg.bryla(String(g.id ?? ''));
            if (!b) throw new Error(`Nie ma bryły „${g.id}” w Assetach 3D.`);
            const glos = ID_GLOSU.test(String(g.glos ?? '')) ? String(g.glos) : 'aktor';
            return { rodzaj: 'bryla', id: String(g.id), imie: czyste(g.imie, 40) || czyste(imieBryly(b), 40), dziedzina: null, xp: null, opis: czyste(b.opis, 300) || null, glos, bryla: String(g.id) };
        }
        throw new Error('Gość to TeOgochi ze stada albo bryła z Assetów 3D.');
    }

    async function napiszRozmowe(s) {
        const model = (await cfg.modelDla(GOSPODARZ.id).catch(() => null)) ?? (await cfg.modelDla('aktor').catch(() => null));
        const { system, user } = promptRozmowy(s);
        let blad = null;
        for (let proba = 0; proba < 2; proba++) {
            const r = await cfg.chat(model, system, proba ? `${user}\n\nPOPRZEDNIA WERSJA ODRZUCONA: ${blad}. Napisz całą rozmowę od nowa, w formacie i tylko z faktów.` : user);
            try {
                const rozmowa = odczytajRozmowe(r.tekst, s.goscie);
                const zle = sprawdzLiczby(rozmowa, s);
                if (zle) throw new Error(zle);
                return { rozmowa, model, proby: proba + 1 };
            } catch (e) { blad = e.message; }
        }
        throw new Error(`Rozmowa odrzucona dwa razy — ${blad}`);
    }

    async function przebieg(id) {
        const s = await M.wczytaj(id);
        try {
            if (!cfg.chat) throw new Error('Most nie ma modelu do rozmowy.');
            const w = await napiszRozmowe(s);
            Object.assign(s, { rozmowa: w.rozmowa, model: w.model, proby: w.proby, stan: 'studio', powod: null, napisano: czas() });
            nadaj(`rozmowa „${s.temat.slice(0, 60)}” gotowa — goście czekają na kanapie (nagranie w studiu)`);
        } catch (e) { Object.assign(s, { stan: 'blad', powod: String(e.message || e).slice(0, 600) }); }
        await M.pisz(s);
    }

    async function utworz({ temat, goscie, jezyk = 'pl', uwagi = '', wieczor = null } = {}) {
        const t = czyste(temat, 300);
        if (t.length < 3) throw new Error('Podaj temat rozmowy.');
        const lista = Array.isArray(goscie) ? goscie : [];
        if (!lista.length) throw new Error('Na kanapie musi usiąść co najmniej jeden gość.');
        if (lista.length > MAX_GOSCI) throw new Error(`Na kanapie mieści się najwyżej ${MAX_GOSCI} gości.`);
        const g = [];
        for (const x of lista) g.push(await gosc(x));
        const imiona = g.map((x) => kluczImienia(x.imie));
        if (new Set(imiona).size !== imiona.length || imiona.includes(kluczImienia(GOSPODARZ.imie))) throw new Error('Każdy gość potrzebuje innego imienia (i innego niż Mame Leon).');
        const s = { wersja: 1, id: M.noweId('m'), stan: 'robi', powod: null, temat: t, uwagi: czyste(uwagi, 600), jezyk: JEZYKI[jezyk] ? jezyk : 'pl', goscie: g, rozmowa: null, plik: null, publikacja: null, utworzono: czas(),
            // 🌙 część Wieczoru Tańca (services/WieczorTanca.js) — automat nagrywania studia bierze tylko takie
            ...(/^w-[0-9a-f]{8}$/.test(String(wieczor)) ? { wieczor: String(wieczor) } : {}) };
        await M.pisz(s);
        M.zakolejkuj(s.id, () => przebieg(s.id));
        return s;
    }

    async function ponow(id) {
        const s = await M.wczytaj(id);
        if (M.wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.');
        Object.assign(s, { stan: 'robi', powod: null, rozmowa: null, plik: null, publikacja: null });
        await M.pisz(s);
        M.zakolejkuj(id, () => przebieg(id));
        return s;
    }

    /** ✎ Poprawka Suwerena: kwestie [{ kto, tekst, nastroj? }] — tylko mówcy tego odcinka; nagranie zdejmowane. */
    async function popraw(id, kwestie) {
        const s = await M.wczytaj(id);
        if (M.wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.');
        if (!Array.isArray(kwestie) || !kwestie.length) throw new Error('Brak kwestii.');
        const mowcy = new Set(['kameleon', ...s.goscie.map((_, i) => `g${i + 1}`)]);
        const n = kwestie.slice(0, 40).map((k) => {
            if (!mowcy.has(k?.kto)) throw new Error(`Nieznany mówca: ${k?.kto}`);
            const tekst = String(k.tekst ?? '').trim().slice(0, 800);
            if (!tekst) throw new Error('Pusta kwestia.');
            return k.kto === 'kameleon' ? { kto: k.kto, tekst, nastroj: NASTROJE[k.nastroj] ? k.nastroj : 'cieply' } : { kto: k.kto, tekst };
        });
        Object.assign(s, { rozmowa: n, poprawiono: czas(), stan: 'studio', plik: null, publikacja: null });
        await M.pisz(s);
        return s;
    }

    async function glos(id, nr) {
        const s = await M.wczytaj(id);
        const k = kwestieOdcinka(s).find((x) => x.nr === Number(nr));
        if (!k) throw new Error('Nie ma takiej kwestii.');
        return { plik: await glosKwestii({ praca: M.praca(id), kwestia: k, glos: k.glos, jezyk: s.jezyk, mow: cfg.mow }), kto: k.kto };
    }

    /**
     * 🎬 Oprawa KAŻDEGO odcinka (Suweren 2026-10-16: „dodaj klocki start i end do końcowego montażu każdego odcinka
     * show”): `_OtakOs_Klocki/Klocki Mame Show/start|end` przez Spawacza (start → nagranie → end), język klocka z nazwy
     * pliku jak w Game Show („end en.mp4” = en; brak wersji w języku odcinka = en). Brak klocków = film bez nich +
     * uwaga wprost (nic nie udajemy).
     */
    async function oprawa(s, we, cel) {
        let z = null;
        try { z = cfg.klocki ? await cfg.klocki() : null; } catch { z = null; }
        const start = klockiWJezyku(z?.start ?? [], s.jezyk), end = klockiWJezyku(z?.end ?? [], s.jezyk);
        const brak = [!start.length && 'start', !end.length && 'end'].filter(Boolean);
        // osobne pole: `uwagi` odcinka to uwagi Suwerena do rozmowy
        s.uwagaOprawy = brak.length ? `brak klocków ${brak.join(' i ')} w ${z?.katalog ?? '_OtakOs_Klocki/Klocki Mame Show'}` : null;
        if (!cfg.spawaj || (!start.length && !end.length)) { await fsP.copyFile(we, cel); s.oprawa = null; return; }
        await cfg.spawaj({ klipy: [...start, we, ...end], wyjscie: cel, celWedlug: start.length });
        s.oprawa = { start: start.map((f) => path.basename(f)), end: end.map((f) => path.basename(f)) };
    }

    /** ↻ Oprawa jeszcze raz z zapisanego nagrania studia (po dodaniu/zmianie klocków) — ten sam plik, publikacja czeka dalej. */
    async function przeoprawa(id) {
        const s = await M.wczytaj(id);
        const studio = path.join(M.praca(id), 'studio.mp4');
        if (!s.plik || !fsSync.existsSync(studio)) throw new Error('Brak nagrania studia — nagraj odcinek.');
        if (s.publikacja?.etap && !['przygotowuje', 'do_akceptacji'].includes(s.publikacja.etap)) throw new Error('Film już poszedł na YouTube — nowa oprawa = nowe nagranie.');
        await oprawa(s, studio, s.plik);
        s.sekundy = (await cfg.opisz(s.plik).catch(() => null))?.sekundy ?? s.sekundy;
        await M.pisz(s);
        return s;
    }

    async function nagranie(id, bufor, { typ = 'video/webm' } = {}) {
        const s = await M.wczytaj(id);
        if (M.wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi — nagraj, gdy skończy.');
        if (!s.rozmowa?.length) throw new Error('Odcinek nie ma jeszcze rozmowy.');
        const kat = await cfg.katalogMontazy(PROJEKT);
        await fsP.mkdir(kat, { recursive: true });
        const cel = path.join(kat, `mameleon_${bezpNazwa(s.temat)}_${s.jezyk}_${s.id.slice(2)}.mp4`);
        // surowe nagranie studia zostaje w pracy odcinka — oprawę da się nałożyć jeszcze raz (np. po dodaniu klocków)
        const studio = path.join(M.praca(id), 'studio.mp4');
        await nagranieDoMp4({ bufor, typ, praca: M.praca(id), cel: studio, ffmpeg: cfg.ffmpeg });
        await oprawa(s, studio, cel);
        Object.assign(s, { plik: cel, nagrano: czas(), sekundy: (await cfg.opisz(cel).catch(() => null))?.sekundy ?? null, stan: 'nagrany', publikacja: null, powod: null });
        if (cfg.publikuj) {
            try {
                const p = await cfg.publikuj({ plik: cel, nazwa: nazwaPublikacji(s), jezyk: s.jezyk, kontekst: kontekstKronikarza(s), zrodlo: { projekt: PROJEKT, mameLeon: s.id } });
                s.publikacja = { id: p.id ?? null, etap: p.etap ?? null };
                s.stan = 'do_akceptacji';
            } catch (e) { s.powod = `publikacja: ${e.message}`; }
        }
        await M.pisz(s);
        nadaj(`nagranie „${s.temat.slice(0, 60)}” w Montażowni — Kronikarz pisze opis, potem ✓ w Izbie`);
        return s;
    }

    const plikRuchow = path.join(M.KAT, 'ruchy.json');
    const czytajRuchy = async () => { try { return JSON.parse(await fsP.readFile(plikRuchow, 'utf8')); } catch { return {}; } };
    /** 🪑 Ustal na stałe ruchy bryły w programie (null = zapomnij, studio dobierze samo). */
    async function ustawRuchy(bryla, p) {
        if (!ID_BRYLY.test(String(bryla))) throw new Error('Złe id bryły.');
        const r = await czytajRuchy();
        if (p) r[bryla] = { ...oczyscPrzydzial(p), zmieniono: czas() }; else delete r[bryla];
        await fsP.mkdir(M.KAT, { recursive: true });
        await fsP.writeFile(plikRuchow, JSON.stringify(r, null, 1), 'utf8');
        return r[bryla] ?? null;
    }

    return { lista: M.lista, wczytaj: M.wczytaj, usun: M.usun, utworz, ponow, popraw, glos, nagranie, przeoprawa, kandydaci, ruchy: czytajRuchy, ustawRuchy, czekaj: M.czekaj };
}

export function zamontujTrasyMameLeon(app, L, { raw = null, maxNagraniaMb = 600 } = {}) {
    const odp = (res, p, kod = 400) => p.then((w) => res.json({ success: true, ...w })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    app.get('/api/mame-leon', (_req, res) => odp(res, (async () => ({
        odcinki: await L.lista(), kandydaci: await L.kandydaci(), gospodarz: GOSPODARZ, nastroje: NASTROJE, jezyki: JEZYKI, maxGosci: MAX_GOSCI,
    }))(), 500));
    app.post('/api/mame-leon', (req, res) => odp(res, L.utworz(req.body ?? {}).then((odcinek) => ({ odcinek }))));
    // 🪑 ruchy brył w programie (przed /:id — inaczej „ruchy” udawałoby id odcinka)
    app.get('/api/mame-leon/ruchy', (_req, res) => odp(res, L.ruchy().then((ruchy) => ({ ruchy })), 500));
    app.put('/api/mame-leon/ruchy/:bryla', (req, res) => odp(res, L.ustawRuchy(req.params.bryla, req.body?.przydzial ?? null).then((przydzial) => ({ przydzial }))));
    app.get('/api/mame-leon/:id', (req, res) => odp(res, L.wczytaj(req.params.id).then((odcinek) => ({ odcinek })), 404));
    app.get('/api/mame-leon/:id/studio', (req, res) => odp(res, L.wczytaj(req.params.id).then((o) => ({ odcinek: o, kwestie: kwestieOdcinka(o), gospodarz: GOSPODARZ, nastroje: NASTROJE })), 404));
    app.get('/api/mame-leon/:id/wideo', async (req, res) => { try { const s = await L.wczytaj(req.params.id); return s.plik && fsSync.existsSync(s.plik) ? res.sendFile(s.plik) : res.status(404).end(); } catch { return res.status(404).end(); } });
    app.get('/api/mame-leon/:id/glos/:nr', (req, res) => L.glos(req.params.id, req.params.nr)
        .then(({ plik, kto }) => { res.set('X-Glos-Kto', kto); res.sendFile(plik); })
        .catch((e) => res.status(502).json({ success: false, message: e.message })));
    if (raw) app.post('/api/mame-leon/:id/studio', raw({ type: ['video/*', 'application/octet-stream'], limit: `${maxNagraniaMb}mb` }), (req, res) =>
        odp(res, L.nagranie(req.params.id, req.body, { typ: String(req.get('content-type') || '') }).then((odcinek) => ({ odcinek }))));
    app.post('/api/mame-leon/:id/oprawa', (req, res) => odp(res, L.przeoprawa(req.params.id).then((odcinek) => ({ odcinek }))));
    app.post('/api/mame-leon/:id/ponow', (req, res) => odp(res, L.ponow(req.params.id).then((odcinek) => ({ odcinek }))));
    app.put('/api/mame-leon/:id/rozmowa', (req, res) => odp(res, L.popraw(req.params.id, req.body?.kwestie).then((odcinek) => ({ odcinek }))));
    app.delete('/api/mame-leon/:id', (req, res) => odp(res, L.usun(req.params.id).then((usuniety) => ({ usuniety }))));
}

export default { utworzMameLeon, zamontujTrasyMameLeon, imieBryly, oczyscPrzydzial, GOSPODARZ, NASTROJE, odczytajRozmowe, promptRozmowy, sprawdzLiczby, kwestieOdcinka, nastrojZEtykiety, liczbyFaktow, kontekstKronikarza };
