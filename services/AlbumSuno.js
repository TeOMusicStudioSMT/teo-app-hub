/**
 * 🎵 Album Suno jako podkład do tańca (Suweren 2026-10-13: „w tym albumie będą wszelkie utwory, jakie stworzę online
 * w Suno, i mogą one być podkładem do tańca w grze… w choreografii czy pozostałych trybach”).
 *
 * Most czyta album (publiczne API Suno — album to playlista: `/api/playlist/<id>`, bez klucza) i każdy gotowy utwór
 * kładzie do biblioteki muzyki: `_OtakOs_Muzyka/Suno <nazwa albumu>/<tytuł> [<id8>].mp3`. Stamtąd biorą go wszystkie
 * tryby Tanecznego Starcia (`/api/rytm/utwory`, rytm liczy most) i reszta Katedry.
 *
 * ⚠️ UCZCIWIE: Suno oddaje plik tylko utworu PUBLICZNEGO (`cdn1.suno.ai/<id>.mp3`); prywatny ma ukryty adres (API:
 * „forbidden”, CDN 403). Taki utwór dostaje stan `prywatny` z radą: w Suno ustaw go jako publiczny ALBO pobierz
 * (Download → MP3) do katalogu albumu — plik o tej samej nazwie co tytuł most rozpozna sam (`na-dysku`).
 * Nic nie jest kasowane: utwór usunięty z albumu zostaje na dysku.
 */
import fs from 'fs/promises';
import path from 'path';

export const API = 'https://studio-api.prod.suno.com/api';
export const CDN = 'https://cdn1.suno.ai';
const AUDIO = /\.(mp3|wav|flac|ogg|m4a)$/i;

/** Id albumu / playlisty Suno z linku (suno.com/album/<uuid>, /playlist/<uuid>) albo samego uuid. */
export function idAlbumuSuno(wejscie) {
    const t = String(wejscie ?? '').trim();
    const m = t.match(/suno\.(?:com|ai)\/(?:album|playlist)\/([0-9a-f-]{36})/i) ?? t.match(/^([0-9a-f-]{36})$/i);
    return m ? m[1].toLowerCase() : null;
}

/** Nazwa pliku/katalogu bez znaków, których Windows nie przyjmie. */
export const bezpiecznaNazwa = (s, max = 80) => String(s ?? '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, max) || 'utwor';
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\[[0-9a-f]{8}\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const nazwaPliku = (u) => `${bezpiecznaNazwa(u.tytul, 70)} [${u.id.slice(0, 8)}].mp3`;
/** BPM z tagów stylu Suno („driving 126 BPM…”) — podpowiedź, rytm i tak liczy most. */
export const bpmZTagow = (tagi) => { const m = String(tagi ?? '').match(/(\d{2,3})\s*bpm/i); return m ? Number(m[1]) : null; };

/** Plik tego utworu w katalogu albumu: po id8 w nazwie albo po tytule (ręczne pobranie z Suno = „<tytuł>.mp3”). Czysta. */
export function plikUtworu(u, pliki = []) {
    const audio = pliki.filter((f) => AUDIO.test(f));
    return audio.find((f) => f.includes(`[${u.id.slice(0, 8)}]`))
        ?? audio.find((f) => norm(f.replace(/\.[^.]+$/, '')) === norm(u.tytul))
        ?? null;
}

/**
 * @param {{ katalog:string, katalogMuzyki:string, fetch?:typeof fetch, teraz?:()=>number, szyna?:any }} o
 */
export function utworzAlbumSuno(o) {
    const cfg = { fetch: (...a) => fetch(...a), teraz: () => Date.now(), ...o };
    const PLIK = path.join(cfg.katalog, 'suno-album.json');
    const naglowki = { 'User-Agent': 'Mozilla/5.0 (Katedra OtakOS)' };
    let trwa = null;

    async function stan() { try { return JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { return { album: null }; } }
    async function zapisz(s) { await fs.mkdir(path.dirname(PLIK), { recursive: true }); await fs.writeFile(PLIK, JSON.stringify(s, null, 1), 'utf8'); }
    const katalogAlbumu = (nazwa) => path.join(cfg.katalogMuzyki, `Suno ${bezpiecznaNazwa(nazwa, 60)}`);

    /** Album z Suno: { nazwa, utwory: [{ id, tytul, sekundy, tagi, bpm, publiczny, okladka }] } (wszystkie strony). */
    async function czytajAlbum(id) {
        const utwory = [];
        let nazwa = '';
        for (let strona = 1; strona <= 20; strona++) {
            const r = await cfg.fetch(`${API}/playlist/${id}/?page=${strona}`, { headers: naglowki, signal: AbortSignal.timeout(15_000) });
            if (!r.ok) throw new Error(r.status === 404 ? 'Suno nie zna tego albumu (404) — sprawdź link.' : `Suno API HTTP ${r.status}`);
            const d = await r.json();
            nazwa ||= String(d.name ?? '');
            const klipy = (d.playlist_clips ?? []).map((x) => x.clip).filter(Boolean);
            for (const c of klipy) {
                if (c.status !== 'complete' || c.is_trashed) continue;
                utwory.push({ id: c.id, tytul: String(c.title || c.id).slice(0, 120), sekundy: Math.round(Number(c.metadata?.duration) || 0) || null, tagi: String(c.metadata?.tags ?? c.display_tags ?? '').slice(0, 200), bpm: bpmZTagow(c.metadata?.tags), publiczny: !!c.is_public, okladka: c.image_url ?? null, audio: c.audio_url && !/forbidden/.test(c.audio_url) ? c.audio_url : null });
            }
            if (!klipy.length || utwory.length >= Number(d.num_total_results ?? 0)) break;
        }
        return { nazwa: nazwa || 'Album', utwory };
    }

    async function pobierz(u, cel) {
        for (const url of [u.audio, `${CDN}/${u.id}.mp3`].filter(Boolean)) {
            const r = await cfg.fetch(url, { headers: naglowki, signal: AbortSignal.timeout(120_000) }).catch(() => null);
            if (!r?.ok) continue;
            const b = Buffer.from(await r.arrayBuffer());
            if (b.length < 20_000) continue;   // strona błędu zamiast dźwięku
            await fs.writeFile(`${cel}.tmp`, b);
            await fs.rename(`${cel}.tmp`, cel);
            return b.length;
        }
        return 0;
    }

    /** Synchronizacja: nowe utwory albumu → biblioteka muzyki. Jedna naraz. */
    function synchronizuj() {
        trwa ??= (async () => {
            const s = await stan();
            if (!s.album) throw new Error('Nie ustawiono albumu Suno.');
            const a = await czytajAlbum(s.album);
            const kat = katalogAlbumu(a.nazwa);
            await fs.mkdir(kat, { recursive: true });
            const pliki = await fs.readdir(kat).catch(() => []);
            const wynik = [];
            let nowe = 0;
            for (const u of a.utwory) {
                const jest = plikUtworu(u, pliki);
                if (jest) { wynik.push({ ...u, stan: 'na-dysku', plik: `${path.basename(kat)}/${jest}` }); continue; }
                const nazwa = nazwaPliku(u);
                const bajtow = await pobierz(u, path.join(kat, nazwa)).catch(() => 0);
                if (bajtow) { nowe++; wynik.push({ ...u, stan: 'pobrany', plik: `${path.basename(kat)}/${nazwa}`, bajtow }); }
                else wynik.push({ ...u, stan: 'prywatny', powod: u.publiczny ? 'Suno nie oddało pliku (spróbuj później).' : `Utwór jest prywatny w Suno — ustaw go jako publiczny albo pobierz (Download → MP3) do „${path.basename(kat)}”.` });
            }
            const zapis = { ...s, nazwa: a.nazwa, katalog: path.basename(kat), utwory: wynik.map(({ audio: _a, ...x }) => x), sprawdzono: new Date(cfg.teraz()).toISOString(), blad: null };
            await zapisz(zapis);
            if (nowe) cfg.szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `🎵 Album Suno „${a.nazwa}”: ${nowe} nowy(ch) utwór(ów) w bibliotece — gotowe do tańca` })?.catch?.(() => {});
            return zapis;
        })().catch(async (e) => { const s = await stan(); await zapisz({ ...s, blad: e.message, sprawdzono: new Date(cfg.teraz()).toISOString() }).catch(() => {}); throw e; })
            .finally(() => { trwa = null; });
        return trwa;
    }

    /** { album: link|uuid|null } — ustaw (od razu synchronizuje) albo odepnij. */
    async function ustaw(album) {
        if (!album) { await zapisz({ album: null }); return stan(); }
        const id = idAlbumuSuno(album);
        if (!id) throw new Error('To nie wygląda na link albumu Suno (https://suno.com/album/<uuid>).');
        await zapisz({ album: id });
        return synchronizuj();
    }

    let licznik = null;
    function startPetli(coMs = 30 * 60_000, poMs = 2 * 60_000) {
        if (licznik) return;
        const raz = () => stan().then((s) => (s.album ? synchronizuj() : null)).catch((e) => console.warn('[Album Suno]', e.message));
        setTimeout(raz, poMs).unref?.();
        licznik = setInterval(raz, coMs);
        licznik.unref?.();
    }

    return { stan, ustaw, synchronizuj, czytajAlbum, startPetli };
}

export default { utworzAlbumSuno, idAlbumuSuno, plikUtworu, nazwaPliku, bpmZTagow, bezpiecznaNazwa };
