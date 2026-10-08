/**
 * 🎼📜 Partytury Dyrygenta (Suweren 2026-10-08: „Dyrygent może mieć listy (katalogi) do roli produkcji — jaki model,
 * narzędzia budowy (TRELLIS, Unity…), jakie workflow, skille… te jego listy — partytury genialnych wykonań 🙂”).
 *
 * KATALOGI — co Katedra NAPRAWDĘ ma: cele produkcji (Silniki.CELE), modele (Dyrygent.katalog), silniki (baza
 * Dyrygenta), grafy ComfyUI (_OtakOs_AI/workflows), skille (TeO_Skille/<grupa>/<skill>/SKILL.md: nazwa + opis).
 * PARTYTURA — gotowy układ do celu: role (TeOgochi → model), narzędzia, workflow, skille, kroki. Trzy źródła:
 *   · `katedra`   — wzorcowe, z tego, co jest w Katedrze (bez oceny; punkt wyjścia),
 *   · `reczna`    — ułożona przez Suwerena,
 *   · `wykonanie` — GENIALNE WYKONANIE: projekt stada oceniony przez Sędziego-Jev na ≥ 9/10 zapisuje się sam
 *                   (kto na czym grał, jakie moduły ruszyły po ratyfikacji, ile rund, pętla).
 * DOPASOWANIE (Dyrygent ds. Kreatywnych): zadanie → najbliższe partytury. Embeddingi (Jev lokalny, EG2) → cosinus;
 * gdy nie wstają — Jev z chmury (choice); gdy i tego brak — wspólne słowa. Metoda zawsze w wyniku.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cosinus } from './JevLokalny.js';

export const PROG_GENIALNE = Number(process.env.OTAKOS_PARTYTURA_PROG) || 9;
const ID = /^[a-z0-9-]{3,60}$/;
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'partytura';
const lista = (x, n = 20, d = 160) => (Array.isArray(x) ? x : []).map((v) => String(v).trim().slice(0, d)).filter(Boolean).slice(0, n);

/** Partytury wzorcowe — tylko z tego, co Katedra ma (grafy w workflows, skille w TeO_Skille, silniki z modułów). */
export const WZORCOWE = [
    {
        id: 'katedra-gra-threejs', nazwa: 'Gra 3D w przeglądarce (Teterhia)', cel: 'gra', zrodlo: 'katedra',
        opis: 'Gra three.js budowana przez Kodeksa: GDD od Pionka, obrazy i bryły jako klocki, ruch brył, krajobrazy.',
        role: [{ agent: 'pionek', zadanie: 'GDD i linia GRA:' }, { agent: 'kodeks', zadanie: 'kod gry (Forge)' }, { agent: 'paleta', zadanie: 'styl i barwy' }],
        narzedzia: ['FLUX.2 klein (obrazy)', 'TRELLIS.2 (bryły 3D)', 'Blender (ruch brył)', 'three.js + GLTFLoader', 'puppeteer (sędziowie gry)'],
        workflow: ['flux2_klein_4b.json', 'trellis2_obraz_do_3d.json'],
        skille: ['web-engines/threejs-gltf-loading', 'web-engines/threejs-materials-lighting', 'disciplines/game-feel', 'workflows/prototype-fast'],
        kroki: ['Reżyser i GDD', 'Dyrygent gry', 'Obrazy (Pracownia)', 'Assety 3D', 'Ruch', 'Krajobrazy', 'Kodeks buduje'],
    },
    {
        id: 'katedra-film', nazwa: 'Film / odcinek (Story Studio)', cel: 'film', zrodlo: 'katedra',
        opis: 'Kadry i ruch Wan 2.2, sceny dialogowe z głosami aktorów, montaż i oprawa w Montażowni, publikacja przez Kronikarza.',
        role: [{ agent: 'rezyser', zadanie: 'plan odcinka' }, { agent: 'kronikarz', zadanie: 'opis i publikacja' }, { agent: 'aktor', zadanie: 'dialogi w roli' }, { agent: 'klatka', zadanie: 'kadry' }, { agent: 'spawacz', zadanie: 'montaż' }],
        narzedzia: ['Wan 2.2 TI2V-5B (kadr i ruch)', 'silnik klonu głosu (Chatterbox)', 'MuseTalk (usta)', 'Głębia kadru + Blender (2.5D)', 'ffmpeg (Montażownia)'],
        workflow: ['wan22_ti2v_5b.json', 'wan22_kontynuacja.json'],
        skille: [], kroki: ['Tablica Reżysera: kadr → ruch → montaż', 'Sceny dialogowe', 'Montażownia + oprawa', 'Publikacja YouTube (Izba)'],
    },
    {
        id: 'katedra-podcast', nazwa: 'Podcast (Studio Podcastu)', cel: 'podcast', zrodlo: 'katedra',
        opis: 'Odcinek z prowadzącym i gośćmi z obsady: scenariusz modelu aktora, głosy, usta, wstęp PL/EN, podkład.',
        role: [{ agent: 'kronikarz', zadanie: 'prowadzący' }, { agent: 'aktor', zadanie: 'goście i scenariusz' }],
        narzedzia: ['silnik klonu głosu (Chatterbox)', 'VoiceStudio', 'MuseTalk (usta)', 'Głębia kadru (ożywione ujęcia)', 'ffmpeg'],
        workflow: [], skille: [], kroki: ['Odcinek: przygotuj → zmień → goście → nagraj', 'Montażownia: oprawa', 'Publikacja'],
    },
    {
        id: 'katedra-muzyka', nazwa: 'Utwór (Music Studio)', cel: 'muzyka', zrodlo: 'katedra',
        opis: 'Utwór z opisu w ComfyUI, stemy Demucsem, głos ze stemu albo Joanna.',
        role: [{ agent: 'joanna', zadanie: 'brzmienie, tekst, nastrój' }, { agent: 'glosek', zadanie: 'głos' }],
        narzedzia: ['ACE-Step 1.5', 'YuE', 'MiniMax Music', 'Demucs (stemy)'],
        workflow: ['acestep15.json', 'yue2.json', 'minimax_music3.json'], skille: ['disciplines/audio-design'], kroki: ['Opis → utwór', 'Stemy', 'Głos'],
    },
    {
        id: 'katedra-fashion', nazwa: 'Kolekcja (Fashion Studio)', cel: 'fashion', zrodlo: 'katedra',
        opis: 'Kreacje jako obrazy FLUX, bryły ubrań z TRELLIS, obrót kreacji na Wan 2.2.',
        role: [{ agent: 'krawcowa', zadanie: 'kreacje' }, { agent: 'paleta', zadanie: 'barwy i styl' }],
        narzedzia: ['FLUX.2 klein', 'TRELLIS.2', 'Wan 2.2 (obrót kreacji)'], workflow: ['flux2_klein_4b.json', 'trellis2_obraz_do_3d.json', 'wan22_ti2v_5b.json'], skille: [], kroki: [],
    },
];

/** Skille z TeO_Skille: <grupa>/<skill> + opis z frontmatter SKILL.md (pierwsze 200 znaków). */
export async function skilleZKatalogu(katalog) {
    const out = [];
    for (const g of await fs.readdir(katalog, { withFileTypes: true }).catch(() => [])) {
        if (!g.isDirectory()) continue;
        for (const s of await fs.readdir(path.join(katalog, g.name), { withFileTypes: true }).catch(() => [])) {
            if (!s.isDirectory()) continue;
            const t = await fs.readFile(path.join(katalog, g.name, s.name, 'SKILL.md'), 'utf8').catch(() => null);
            if (t === null) continue;
            const m = /description:\s*>?\s*\n?([\s\S]*?)\n[a-z_]+:/i.exec(t) ?? /description:\s*(.+)/i.exec(t);
            out.push({ id: `${g.name}/${s.name}`, grupa: g.name, opis: (m?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) });
        }
    }
    return out;
}

/** Projekt stada → partytura wykonania: kto na czym grał, moduły po ratyfikacji, rundy, pętla. */
export function zWykonania(p, wpis) {
    const role = [];
    for (const k of p.kroki ?? []) if (k.agent && k.model && k.stan === 'gotowe' && !role.some((r) => r.agent === k.agent)) role.push({ agent: k.agent, model: k.model, zadanie: String(k.zadanie ?? '').split(':')[0].slice(0, 80) });
    return {
        id: `wykonanie-${slug(p.nazwa)}-${String(p.id).slice(-6)}`.slice(0, 60), nazwa: `🌟 ${p.nazwa}`, cel: 'stol', zrodlo: 'wykonanie',
        opis: String(p.wizja ?? '').replace(/\s+/g, ' ').slice(0, 600),
        role, narzedzia: [...new Set((p.zlecenia ?? []).map((z) => z.modul).filter(Boolean))], workflow: [], skille: [],
        kroki: [`rundy: ${p.runda ?? 1} z ${p.rundy ?? 1}`, `pętla kreatywna ×${p.petla ?? 0}`],
        projekt: p.id, ocena: wpis.ocena, oceniajacy: wpis.kto, kiedy: new Date().toISOString(),
    };
}

/**
 * @param {{ plik: string, katalogSkilli?: string, katalogWorkflow?: string, modele?: () => Promise<object[]>, silniki?: () => Promise<object>,
 *           cele?: object, jevLokalny?: object|null, jev?: object|null, szyna?: object|null }} o
 */
export function utworzPartytury({ plik, katalogSkilli = null, katalogWorkflow = null, modele = async () => [], silniki = async () => ({ silniki: [] }), cele = {}, jevLokalny = null, jev = null, szyna = null }) {
    let schowekWektorow = new Map();   // tekst partytury → wektor (embeddingi liczymy raz)

    async function czytaj() { try { return JSON.parse(await fs.readFile(plik, 'utf8')); } catch { return { partytury: [] }; } }
    async function zapisz(d) {
        await fs.mkdir(path.dirname(plik), { recursive: true });
        const tmp = `${plik}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(d, null, 2), 'utf8');
        await fs.rename(tmp, plik);
    }
    async function wszystkie() {
        const d = await czytaj();
        const wlasne = d.partytury ?? [];
        return [...wlasne, ...WZORCOWE.filter((w) => !wlasne.some((p) => p.id === w.id))];
    }

    /** Co Katedra ma — do układania partytur (UI) i do promptu Dyrygenta. */
    async function katalogi() {
        const [m, s, sk, wf] = await Promise.all([
            modele().catch(() => []), silniki().catch(() => ({ silniki: [] })),
            katalogSkilli ? skilleZKatalogu(katalogSkilli) : [], katalogWorkflow && fsSync.existsSync(katalogWorkflow) ? fs.readdir(katalogWorkflow) : [],
        ]);
        return {
            cele: Object.fromEntries(Object.entries(cele).map(([id, c]) => [id, c.etykieta ?? id])),
            modele: m.map((x) => ({ nazwa: x.nazwa, parametry: x.parametry ?? null })),
            silniki: (s.silniki ?? []).map((x) => ({ id: x.id, nazwa: x.nazwa, rodzaj: x.rodzaj, gotowy: x.gotowy })),
            workflow: wf.filter((f) => /\.json$/i.test(f)), skille: sk,
        };
    }

    function oczysc(p) {
        const nazwa = String(p?.nazwa ?? '').trim().slice(0, 120);
        if (nazwa.length < 3) throw new Error('Partytura potrzebuje nazwy.');
        return {
            id: ID.test(String(p.id ?? '')) ? p.id : `reczna-${slug(nazwa)}-${crypto.randomBytes(2).toString('hex')}`,
            nazwa, cel: String(p.cel ?? 'stol').slice(0, 30), zrodlo: 'reczna', opis: String(p.opis ?? '').slice(0, 1200),
            role: (Array.isArray(p.role) ? p.role : []).map((r) => ({ agent: String(r?.agent ?? '').toLowerCase().slice(0, 30), model: r?.model ? String(r.model).slice(0, 120) : null, zadanie: String(r?.zadanie ?? '').slice(0, 120) })).filter((r) => r.agent).slice(0, 24),
            narzedzia: lista(p.narzedzia), workflow: lista(p.workflow), skille: lista(p.skille, 30), kroki: lista(p.kroki, 20, 200),
            kiedy: new Date().toISOString(),
        };
    }

    async function dodaj(p) {
        const n = oczysc(p);
        const d = await czytaj();
        d.partytury = [...(d.partytury ?? []).filter((x) => x.id !== n.id), n];
        await zapisz(d);
        return n;
    }
    async function usun(id) {
        const d = await czytaj();
        const przed = (d.partytury ?? []).length;
        d.partytury = (d.partytury ?? []).filter((x) => x.id !== id);
        if (d.partytury.length === przed) return false;
        await zapisz(d);
        return true;
    }

    /** Wołane po ocenie projektu: Sędzia-Jev ≥ PROG_GENIALNE → partytura wykonania (raz na projekt, nowsza nadpisuje). */
    async function poOcenie(p, wpis) {
        if (!/^Jev\b/.test(String(wpis?.kto ?? '')) || !(Number(wpis?.ocena) >= PROG_GENIALNE)) return null;
        const n = zWykonania(p, wpis);
        const d = await czytaj();
        d.partytury = [...(d.partytury ?? []).filter((x) => x.projekt !== p.id), n];
        await zapisz(d);
        await szyna?.nadaj?.({ agent: 'Dyrygent', rodzaj: 'praca', tresc: `🌟 genialne wykonanie „${p.nazwa}” (${wpis.ocena}/10) zapisane jako partytura`, dane: { partytura: n.id, projekt: p.id } }).catch(() => {});
        return n;
    }

    const tekstPartytury = (p) => `${p.nazwa}. ${p.opis} Role: ${p.role.map((r) => `${r.agent}${r.zadanie ? ` (${r.zadanie})` : ''}`).join(', ')}. Narzędzia: ${p.narzedzia.join(', ')}.`;

    /** Dyrygent ds. Kreatywnych: zadanie → partytury od najbliższej. Metoda: embeddingi | jev | slowa. */
    async function dopasuj(zadanie, { n = 3 } = {}) {
        const z = String(zadanie ?? '').trim();
        if (z.length < 3) throw new Error('Opisz zadanie.');
        const ps = await wszystkie();
        if (!ps.length) return { metoda: null, wyniki: [] };
        if (jevLokalny && await jevLokalny.dostepny().catch(() => false)) {
            const brak = ps.filter((p) => !schowekWektorow.has(tekstPartytury(p)));
            const [wz, ...wp] = await jevLokalny.osadz([z, ...brak.map(tekstPartytury)]);
            brak.forEach((p, i) => schowekWektorow.set(tekstPartytury(p), wp[i]));
            if (schowekWektorow.size > 500) schowekWektorow = new Map([...schowekWektorow].slice(-200));
            const wyniki = ps.map((p) => ({ partytura: p, podobienstwo: Math.round(cosinus(wz, schowekWektorow.get(tekstPartytury(p))) * 1000) / 1000 }));
            return { metoda: 'embeddingi', wyniki: wyniki.sort((a, b) => b.podobienstwo - a.podobienstwo).slice(0, n) };
        }
        if (jev?.stan?.().maKlucz) {
            const d = await jev.zapytaj({ state: { zadanie: z.slice(0, 2000) }, questions: { p: { type: 'choice', instructions: 'Która partytura (gotowy układ produkcji Katedry) najlepiej pasuje do tego zadania?', criteria: Object.fromEntries(ps.slice(0, 255).map((p) => [p.id, tekstPartytury(p).slice(0, 320)])) } } });
            const pr = d.answers?.p?.probabilities ?? {};
            const wyniki = ps.map((p) => ({ partytura: p, podobienstwo: Math.round(Number(pr[p.id] ?? 0) * 1000) / 1000 }));
            return { metoda: 'jev', wyniki: wyniki.sort((a, b) => b.podobienstwo - a.podobienstwo).slice(0, n) };
        }
        const slowa = (t) => new Set(String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3));
        const sz = slowa(z);
        const wyniki = ps.map((p) => { const sp = slowa(tekstPartytury(p)); const wsp = [...sz].filter((w) => sp.has(w)).length; return { partytura: p, podobienstwo: sz.size ? Math.round((wsp / sz.size) * 1000) / 1000 : 0 }; });
        return { metoda: 'slowa', wyniki: wyniki.sort((a, b) => b.podobienstwo - a.podobienstwo).slice(0, n) };
    }

    return { wszystkie, katalogi, dodaj, usun, poOcenie, dopasuj, tekstPartytury };
}

export default { utworzPartytury, skilleZKatalogu, zWykonania, WZORCOWE, PROG_GENIALNE };
