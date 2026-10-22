// 🤖 Autopilot formatów — wysłane odcinki → piony (prawdziwy ffmpeg) → Shorts / TikTok / Reels bez ręcznego ✓ (atrapy sieci),
// każdy film raz na sieć (też po restarcie), limit dnia, konto niepodłączone = czeka, bez opisu Kronikarza nic nie wychodzi;
// 🔐 klucze aplikacji TikTok/Instagram w Skarbcu 0.00G z przeniesieniem z media_secrets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { opisz } from '../services/Montazownia.js';
import { utworzFormaty } from '../services/Formaty.js';
import { utworzAutopilotFormatow, wycinekDla } from '../services/AutopilotFormatow.js';
import { utworzKontoTikTok, utworzKontoInstagram } from '../services/KontaSieci.js';

const film = (plik, sek) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `testsrc=s=640x360:r=30:d=${sek}`, '-f', 'lavfi', '-i', `sine=frequency=440:duration=${sek}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', plik]);
const KRONIKARZ = async () => ({ tekst: 'TYTUŁ: Gol!\nOPIS:\nKrótko.\nTAGI: gol, ai art', silnik: 'atrapa' });

async function srodowisko() {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-'));
    const m1 = path.join(kat, 'produkcje', 'teo-game-show', 'montaz');
    const m2 = path.join(kat, 'produkcje', 'studio-podcast', 'montaz');
    await fs.mkdir(m1, { recursive: true }); await fs.mkdir(m2, { recursive: true });
    const show = path.join(m1, 'gameshow_Kot_en_0a1b2c3d.mp4'); film(show, 3);
    const podcast = path.join(m2, 'podcast_rozmowa_mabcdef1.mp4'); film(podcast, 4);
    const poza = path.join(kat, 'wystawa.mp4'); film(poza, 1);
    return { kat, show, podcast, poza };
}

/** Atrapy sieci: YouTube (przygotuj/zatwierdz/wszystkie), TikTok, Instagram — liczą wysyłki. */
function sieci({ tiktok = true, instagram = false, pisz = KRONIKARZ } = {}) {
    const wyslane = [], yt = [];
    const youtube = {
        przygotuj: async (z) => { const p = { id: `yt_${yt.length}`, etap: 'do_akceptacji', tytul: 'Short', opis: 'opis', ...z }; yt.push(p); return p; },
        zmien: async (id, { opis }) => Object.assign(yt.find((x) => x.id === id), { opis }),
        zatwierdz: async (id) => { const p = yt.find((x) => x.id === id); wyslane.push(['youtube', p.plik]); return Object.assign(p, { etap: 'wysylanie' }); },
        wszystkie: async () => yt,
    };
    const konto = (on, nazwa) => async () => (on ? { polaczony: true, konta: [{ id: 'k1', nazwa }], domyslny: 'k1' } : { polaczony: false, powod: 'niepodłączone: brak aplikacji' });
    const tt = { stan: konto(tiktok, '@teo_otakos'), wyslijSzkic: async (p) => { wyslane.push(['tiktok', p]); return { publishId: `p${wyslane.length}` }; }, stanWysylki: async () => ({ status: 'SEND_TO_USER_INBOX' }) };
    const ig = { stan: konto(instagram, '@teo_music_studio_s.m.t'), opublikujReel: async (p) => { wyslane.push(['instagram', p]); return { mediaId: 'm', url: 'https://www.instagram.com/reel/x/' }; } };
    return { youtube, tiktok: tt, instagram: ig, pisz, wyslane, stanSieci: async (s) => (s === 'youtube' ? { polaczony: true } : (s === 'tiktok' ? tt : ig).stan()) };
}
const opublikowane = ({ show, podcast, poza }) => async () => [
    { id: 'a', etap: 'opublikowana', plik: show, tytul: 'TeO Game Show: Kot', zrodlo: { projekt: 'teo-game-show' } },
    { id: 'a2', etap: 'opublikowana', plik: show, tytul: 'kopia na drugi kanał', kopiaZ: 'a', zrodlo: { projekt: 'teo-game-show' } },
    { id: 'b', etap: 'prywatna', plik: podcast, tytul: 'Podcast', zrodlo: { projekt: 'studio-podcast' } },
    { id: 'c', etap: 'do_akceptacji', plik: podcast, tytul: 'jeszcze nie wysłany' },
    { id: 'd', etap: 'opublikowana', plik: show, tytul: 'Short', zrodlo: { projekt: 'teo-game-show', format: 'shorts' } },
    { id: 'e', etap: 'opublikowana', plik: poza, tytul: 'Z Wystawy' },
];

test('wycinek: skrót, gdy się mieści → pierwszy pasujący gol → cały film → pierwsze N s', () => {
    const pr = [{ id: 'gol-1', od: 1, do: 20, tytul: 'G1' }, { id: 'skrot', od: 0, do: 75, tytul: 'S' }];
    assert.deepEqual(wycinekDla(pr, 75, 90), { propozycja: 'skrot', od: 0, do: 75, tytul: 'S' });
    assert.deepEqual(wycinekDla(pr, 75, 60), { propozycja: 'gol-1', od: 1, do: 20, tytul: 'G1' });
    assert.deepEqual(wycinekDla([], 42.3, 60), { propozycja: null, od: 0, do: 42.3, tytul: '' });
    assert.deepEqual(wycinekDla([], 300, 60), { propozycja: null, od: 0, do: 60, tytul: '' });
    // TikTok (do 10 min): cały taniec zamiast skrótu; za długi — jak dotąd
    assert.deepEqual(wycinekDla(pr, 420.5, 600, { caly: true }), { propozycja: null, od: 0, do: 420.5, tytul: '' });
    assert.deepEqual(wycinekDla(pr, 75, 600, { caly: true }), { propozycja: null, od: 0, do: 75, tytul: '' });
    assert.deepEqual(wycinekDla([], 900, 600, { caly: true }), { propozycja: null, od: 0, do: 600, tytul: '' });
});

test('autopilot: wysłane filmy → piony → Shorts i TikTok same, Reels czeka na konto; raz na sieć, też po restarcie', async () => {
    const e = await srodowisko();
    try {
        const s = sieci();
        const F = utworzFormaty({ katalog: e.kat, katalogMontazy: async (p) => path.join(e.kat, 'produkcje', p, 'montaz'), opisz, ffmpeg: ffmpegPath, ...s });
        const nowy = () => utworzAutopilotFormatow({ katalog: e.kat, formaty: F, publikacje: opublikowane(e), stanSieci: s.stanSieci, odstepTikTokMs: 0 });
        const A = nowy();
        const st0 = await A.stan();
        assert.equal(st0.filmow, 2, 'dwa filmy z montażu (bez kopii, Shortu, niewysłanego)');
        assert.equal(st0.pozaMontazem, 1);
        assert.equal(Object.values(st0.cele).some((c) => c.wlaczony), false, 'domyślnie wszystko wyłączone');
        await assert.rejects(A.przebieg({ reczny: true }), /wyłączone wszystkie/);
        assert.equal((await A.przebieg()).cele.length, 0);
        assert.equal(s.wyslane.length, 0);

        await A.ustaw({ wlaczone: { shorts: true, tiktok: true, reels: true } });
        const w = await A.przebieg();
        assert.deepEqual([w.cele.shorts.wyslane, w.cele.tiktok.wyslane, w.cele.reels.wyslane], [2, 2, 0]);
        assert.match(w.cele.reels.czeka, /niepodłączone/);
        assert.deepEqual(s.wyslane.map((x) => x[0]).sort(), ['tiktok', 'tiktok', 'youtube', 'youtube']);
        const klipy = (await F.wszystkie()).filter((k) => k.autopilot);
        assert.equal(klipy.length, 2, 'jeden pion na film — TikTok bierze ten sam klip co Short');
        for (const k of klipy) {
            const o = await opisz(k.plik);
            assert.deepEqual([o.szerokosc, o.wysokosc], [1080, 1920]);
            assert.equal(k.publikacje.tiktok.etap, 'w_skrzynce', 'stan szkicu dociągnięty z TikToka');
            assert.equal(k.publikacje.tiktok.auto, true);
        }
        const yt = await s.youtube.wszystkie();
        assert.ok(yt.every((p) => /#Shorts/.test(p.opis) && p.zrodlo.format === 'shorts'));

        assert.equal((await A.przebieg()).cele.shorts.wyslane, 0, 'drugi przebieg nic nie dubluje');
        const poRestarcie = nowy();
        const w3 = await poRestarcie.przebieg();
        assert.equal(w3.cele.tiktok.wyslane + w3.cele.shorts.wyslane, 0, 'rejestr na dysku — po restarcie bez dubli');
        const st = await poRestarcie.stan();
        assert.deepEqual([st.cele.shorts.wyslane, st.cele.tiktok.wyslane, st.cele.reels.doZrobienia, st.przerobione], [2, 2, 2, 2]);
        assert.equal(st.cele.reels.konto.polaczony, false);
    } finally { await fs.rm(e.kat, { recursive: true, force: true }); }
});

test('autopilot: limit dnia, bez opisu Kronikarza nic nie wychodzi (3 próby → porzucony), przerwany przebieg = porzucony', async () => {
    const e = await srodowisko();
    try {
        const s = sieci({ pisz: async () => ({ tekst: 'bez formatu' }) });
        const F = utworzFormaty({ katalog: e.kat, katalogMontazy: async (p) => path.join(e.kat, 'produkcje', p, 'montaz'), opisz, ffmpeg: ffmpegPath, ...s });
        const A = utworzAutopilotFormatow({ katalog: e.kat, formaty: F, publikacje: opublikowane(e), stanSieci: s.stanSieci, odstepTikTokMs: 0 });
        await assert.rejects(A.ustaw({ limit: { tiktok: 6 } }), /TikTok trzyma najwyżej 5/);
        await A.ustaw({ wlaczone: { shorts: true, tiktok: true }, limit: { shorts: 1 } });
        const w = await A.przebieg();
        assert.equal(w.cele.shorts.wyslane, 1);
        assert.match(w.cele.shorts.czeka, /limit dnia \(1\)/);
        assert.equal(w.cele.tiktok.wyslane, 0);
        assert.equal(w.cele.tiktok.bledy, 2);
        assert.equal(s.wyslane.filter((x) => x[0] === 'tiktok').length, 0, 'bez opisu Kronikarza nic nie idzie do TikToka');
        const k = (await F.wszystkie()).find((x) => x.publikacje?.tiktok);
        assert.equal(k.publikacje.tiktok.etap, 'do_akceptacji', 'czeka na ręczne ✓');
        await A.przebieg(); await A.przebieg();
        const st = await A.stan();
        assert.equal(st.cele.tiktok.porzucone, 2);
        assert.equal((await F.wszystkie()).filter((x) => x.autopilot).length, 2, 'ponowienia biorą ten sam pion — bez nowego ffmpeg');
        assert.match(st.bledy[0].powod, /Kronikarz nie napisał opisu/);
        // ↻ ponów zeruje próby
        await A.ponow(e.show, 'tiktok');
        assert.equal((await A.stan()).cele.tiktok.porzucone, 1);

        // przebieg przerwany restartem (stan „robi” na dysku) → porzucony, nie wysyła sam drugi raz
        const plik = path.join(e.kat, 'formaty', 'autopilot.json');
        const d = JSON.parse(await fs.readFile(plik, 'utf8'));
        d.rejestr[`${path.resolve(e.podcast)}|reels`] = { stan: 'robi', film: 'Podcast' };
        await fs.writeFile(plik, JSON.stringify(d));
        const B = utworzAutopilotFormatow({ katalog: e.kat, formaty: F, publikacje: opublikowane(e), stanSieci: s.stanSieci });
        const p = (await B.stan()).porzucone.find((x) => x.cel === 'reels');
        assert.match(p.powod, /przerwane restartem/);
    } finally { await fs.rm(e.kat, { recursive: true, force: true }); }
});

test('Skarbiec 0.00G: klucze aplikacji czytane ze Skarbca, stare z media_secrets przeniesione raz, zapis do Skarbca', async () => {
    const media = { tiktok: { CLIENT_KEY: 'awstarykey123', CLIENT_SECRET: 'stary-sekret', KONTA: [{ id: 'o1', nazwa: '@teo_otakos', token: 'r' }], DOMYSLNY: 'o1' }, instagram: {} };
    const skarb = {};
    const cfg = {
        sekrety: async (s) => structuredClone(media[s] ?? {}),
        zapiszSekrety: async (s, z) => { const o = structuredClone(media[s] ?? {}); z(o); media[s] = o; },
        skarbiec: {
            czytaj: async (u, p) => skarb[`${u}.${p}`] ?? null,
            zapisz: async (u, p, v) => { skarb[`${u}.${p}`] = v; },
            usun: async (u, p) => { delete skarb[`${u}.${p}`]; },
        },
    };
    const T = utworzKontoTikTok(cfg);
    const st = await T.stan();
    assert.equal(st.klient, true);
    assert.equal(st.klucze, 'skarbiec');
    assert.equal(skarb['tiktok.client_key'], 'awstarykey123', 'przeniesione do Skarbca');
    assert.equal(media.tiktok.CLIENT_KEY, undefined, 'i zdjęte z media_secrets');
    assert.equal(media.tiktok.KONTA[0].nazwa, '@teo_otakos', 'tokeny kont zostają w skarbcu Impresariatu');
    await T.zapiszKlienta({ clientKey: 'awnowykey4567', clientSecret: 'nowy-sekret' });
    assert.equal(skarb['tiktok.client_key'], 'awnowykey4567');
    assert.equal(new URL(await T.adresZgody()).searchParams.get('client_key'), 'awnowykey4567');
    const I = utworzKontoInstagram({ ...cfg, skarbiec: { ...cfg.skarbiec } });
    await I.zapiszKlienta({ appId: '1234567890', appSecret: '0123456789abcdef0123456789abcdef', configId: '' });
    assert.equal(skarb['instagram.app_id'], '1234567890');
    assert.equal(skarb['instagram.config_id'], undefined);
    assert.equal((await I.stan()).klient, true);
    assert.equal(JSON.stringify(await I.stan()).includes('0123456789abcdef'), false, 'stan bez sekretów');
});
