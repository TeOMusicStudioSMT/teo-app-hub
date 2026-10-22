// 📱 Formaty i sieci — pion 1080×1920 na prawdziwym ffmpeg (trzy układy, wycinek, napisy z kwestii), propozycje goli z segmentów
// Gola Dnia, publikacje z ✓ (atrapy kont), konta TikTok/Instagram na atrapie fetch, trasy za Strażą.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import express from 'express';
import { opisz } from '../services/Montazownia.js';
import { utworzFormaty, zamontujTrasyFormatow, propozycjeGolDnia, programZPliku, celeKlipu, filtrUkladu } from '../services/Formaty.js';
import { utworzKontoTikTok, utworzKontoInstagram, kawalkiTikTok } from '../services/KontaSieci.js';
import { strazMostu } from '../services/StrazMostu.js';

const ff = (...a) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...a]);
/** Film 16:9 z dźwiękiem (albo bez), `sek` sekund. */
const film = (plik, sek, dzwiek = true) => ff('-f', 'lavfi', '-i', `testsrc=s=640x360:r=30:d=${sek}`, ...(dzwiek ? ['-f', 'lavfi', '-i', `sine=frequency=440:duration=${sek}`] : []),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(dzwiek ? ['-c:a', 'aac'] : []), '-shortest', plik);

const MECZ = { gospodarze: 'Coventry City', goscie: 'Newcastle United', wynik: [1, 1], liga: 'EPL', data: '2026-10-12' };
const ODCINEK = (id, plik, segmenty) => ({
    id, jezyk: 'pl', narrator: 'pilkarka', mecz: MECZ, plik, segmenty, obrazy: null,
    gole: [{ minuta: '12', strzelec: 'Ellis Simms', druzyna: 'gospodarze', asysta: null }, { minuta: '55', strzelec: 'Alexander Isak', druzyna: 'goscie', asysta: 'Gordon' }],
    scenariusz: { intro: 'Cześć! 🎉 Dziś Coventry.', gole: [{ przed: 'To Simms.', okrzyk: 'Gooool!', po: 'Głową!' }, { przed: 'Teraz Isak.', okrzyk: 'Gol!', po: 'Płasko.' }], outro: 'Do jutra!' },
});

async function srodowisko() {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'formaty-'));
    const montaz = path.join(kat, 'produkcje', 'gol-dnia', 'montaz');
    await fs.mkdir(montaz, { recursive: true });
    // Gol Dnia z segmentów: 8 kwestii (intro, 2×[przed, okrzyk, po], outro) po 1 s → odcinek 8 s
    const id = `g-${crypto.randomBytes(4).toString('hex')}`;
    const praca = path.join(kat, 'gol-dnia', id, 'praca');
    await fs.mkdir(praca, { recursive: true });
    const segmenty = [];
    for (let i = 1; i <= 8; i++) { const n = `seg-${String(i).padStart(3, '0')}.mp4`; film(path.join(praca, n), 1); segmenty.push(n); }
    await fs.writeFile(path.join(praca, 'lista.txt'), segmenty.map((x) => `file '${x}'`).join('\n'));
    const plik = path.join(montaz, `gol_Coventry_City-Newcastle_United_pilkarka_pl_${id.slice(2)}.mp4`);
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', plik], { cwd: praca });
    await fs.writeFile(path.join(kat, 'gol-dnia', id, 'odcinek.json'), JSON.stringify(ODCINEK(id, plik, segmenty)));
    const show = path.join(kat, 'produkcje', 'teo-game-show', 'montaz');
    await fs.mkdir(show, { recursive: true });
    film(path.join(show, 'gameshow_Kot_en_0a1b2c3d.mp4'), 4, false);
    return { kat, id, plik, show: path.join(show, 'gameshow_Kot_en_0a1b2c3d.mp4') };
}

test('czyste: program z nazwy, cele długości, filtry układów, propozycje goli z segmentów', () => {
    assert.equal(programZPliku('gol_A-B_studio_zebra+lew_en_0a1b2c3d.mp4').id, 'studio-zebrra');
    assert.equal(programZPliku('gol_A-B_pilkarka_pl_0a1b2c3d.mp4').id, 'gol-dnia');
    assert.equal(programZPliku('wywiad_x_en_abc123def.mp4').id, 'wywiad');
    assert.deepEqual(celeKlipu(75), { shorts: { ok: true }, reels: { ok: true }, tiktok: { ok: true } });
    assert.deepEqual(celeKlipu(200), { shorts: { ok: false, powod: '200 s > 180 s — skróć wycinek' }, reels: { ok: false, powod: '200 s > 180 s — skróć wycinek' }, tiktok: { ok: true } });
    assert.match(filtrUkladu('srodek', { kadrX: 0.2 }), /crop=1080:1920:\(iw-1080\)\*0\.200/);
    assert.throws(() => filtrUkladu('kwadrat'), /Nieznany układ/);
    const p = propozycjeGolDnia(ODCINEK('g-00000000', 'x', []), [1, 1.5, 1, 2, 1, 1, 1, 1.5]);
    assert.deepEqual(p.map((x) => [x.id, x.od, x.do]), [['gol-1', 1, 5.5], ['gol-2', 5.5, 8.5], ['skrot', 0, 10]]);
    assert.deepEqual(p[0].napisy.map((n) => [n.od, n.do, n.tekst]), [[0, 1.5, 'To Simms.'], [1.5, 2.5, 'Gooool!'], [2.5, 4.5, 'Głową!']]);
    assert.equal(p[1].tytul, "GOL 55' · Alexander Isak");
    assert.deepEqual(propozycjeGolDnia(ODCINEK('g-00000000', 'x', []), [1, 1]), [], 'segmenty nie pasują do kwestii = bez zgadywania');
});

test('prawdziwy ffmpeg: gol z odcinka → pion 1080×1920 z dźwiękiem i napisami z kwestii; trzy układy; film bez dźwięku; poza montażem = odmowa', async () => {
    const { kat, plik, show } = await srodowisko();
    try {
        const F = utworzFormaty({ katalog: kat, katalogMontazy: async (p) => path.join(kat, 'produkcje', p, 'montaz'), opisz, ffmpeg: ffmpegPath });
        const zr = await F.zrodla();
        assert.deepEqual(zr.map((z) => z.program.id).sort(), ['game-show', 'gol-dnia']);
        const pr = await F.propozycje(plik);
        assert.equal(pr.kwestie, true);
        assert.deepEqual(pr.propozycje.map((x) => x.id), ['gol-1', 'gol-2', 'skrot']);
        assert.ok(Math.abs(pr.propozycje[0].od - 1) < 0.1 && Math.abs(pr.propozycje[0].do - 4) < 0.1, JSON.stringify(pr.propozycje[0]));

        const klipy = [
            await F.utworz({ plik, propozycja: 'gol-1', napisy: 'z-kwestii' }),
            await F.utworz({ plik, od: 0, do: 2, uklad: 'letterbox' }),
            await F.utworz({ plik: show, od: 0.5, do: 3, uklad: 'srodek', kadrX: 0.3, tytul: 'Kot Tancerz 🐈' }),
        ];
        await F.czekaj();
        for (const k of klipy) {
            const o = await opisz(k.plik ?? '').catch((e) => assert.fail(`${k.id}: ${k.powod ?? e.message}`));
            assert.equal(k.stan, 'gotowy', k.powod);
            assert.deepEqual([o.szerokosc, o.wysokosc], [1080, 1920]);
            assert.ok(o.maAudio, 'zawsze ze ścieżką dźwięku (cisza, gdy źródło jej nie ma)');
            assert.ok(k.plik.includes(`${path.sep}produkcje${path.sep}`) && path.basename(path.dirname(k.plik)) === 'formaty');
        }
        assert.ok(Math.abs(klipy[0].sekundy - 3) < 0.2, `gol 1 = 3 s, jest ${klipy[0].sekundy}`);
        assert.equal(klipy[0].cele.shorts.ok, true);
        assert.match(path.basename(klipy[0].plik), /_gol-1_rozmyte_/);

        await assert.rejects(F.utworz({ plik: path.join(kat, 'gdzies.mp4'), od: 0, do: 1 }), /katalogu montaży/);
        await assert.rejects(F.utworz({ plik, od: 3, do: 2 }), /od < do/);
        await assert.rejects(F.utworz({ plik: show, od: 0, do: 2, napisy: 'z-kwestii' }), /nie ma kwestii z czasem/);
        // studio Zebrra: plik studia odcinka → bez granic kwestii, mówi to wprost
        const s = JSON.parse(await fs.readFile(path.join(kat, 'gol-dnia', `g-${plik.match(/_([0-9a-f]{8})\.mp4$/)[1]}`, 'odcinek.json'), 'utf8'));
        const studio = path.join(path.dirname(plik), `gol_A-B_studio_zebra_pl_${s.id.slice(2)}.mp4`);
        await fs.copyFile(plik, studio);
        await fs.writeFile(path.join(kat, 'gol-dnia', s.id, 'odcinek.json'), JSON.stringify({ ...s, studio: { plik: studio } }));
        const ps = await F.propozycje(studio);
        assert.match(ps.uwaga, /nie zapisuje granic kwestii/);
        assert.equal(ps.propozycje[0]?.id, 'calosc', 'krótki film w całości mieści się w Shorts');
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('publikacje: Short przez PublikacjeYouTube z #Shorts; TikTok/Instagram tylko po ✓ i tylko z połączonym kontem', async () => {
    const { kat, plik } = await srodowisko();
    try {
        const yt = [];
        const youtube = {
            przygotuj: async (z) => { const p = { id: 'yt_1', etap: 'do_akceptacji', tytul: 'Gol!', opis: 'Opis', kanalNazwa: '@ZebrraFootball', ...z }; yt.push(p); return p; },
            zmien: async (id, { opis }) => Object.assign(yt.find((x) => x.id === id), { opis }),
            wszystkie: async () => yt,
        };
        const wyslane = [];
        let tiktokPolaczony = false;
        const tiktok = {
            stan: async () => (tiktokPolaczony ? { polaczony: true, konta: [{ id: 'oid', nazwa: 'Zebrra TT' }], domyslny: 'oid' } : { polaczony: false, powod: 'niepodłączone: brak aplikacji TikTok' }),
            wyslijSzkic: async (p, konto) => { wyslane.push(['tiktok', p, konto]); return { publishId: 'pub1' }; },
            stanWysylki: async () => ({ status: 'SEND_TO_USER_INBOX' }),
        };
        const instagram = {
            stan: async () => ({ polaczony: true, konta: [{ id: '178', nazwa: '@zebrra' }], domyslny: '178' }),
            opublikujReel: async (p, o) => { wyslane.push(['instagram', p, o.opis]); return { mediaId: 'm1', url: 'https://www.instagram.com/reel/x/' }; },
        };
        const F = utworzFormaty({ katalog: kat, katalogMontazy: async (p) => path.join(kat, 'produkcje', p, 'montaz'), opisz, ffmpeg: ffmpegPath, youtube, tiktok, instagram,
            pisz: async () => ({ tekst: 'TYTUŁ: Simms głową!\nOPIS:\nPierwszy gol.\n\nDrugi akapit.\nTAGI: gol dnia, premier league, ai art', silnik: 'atrapa' }) });
        const k = await F.utworz({ plik, propozycja: 'gol-1' });
        await assert.rejects(F.doPublikacji(k.id, 'youtube'), /Najpierw gotowy klip/);
        await F.czekaj();

        const y = await F.doPublikacji(k.id, 'youtube', { kanalId: 'UCzebrra' });
        assert.equal(y.publikacje.youtube.etap, 'do_akceptacji');
        assert.match(yt[0].opis, /#Shorts/);
        assert.equal(yt[0].zrodlo.format, 'shorts');
        assert.equal(yt[0].kanalId, 'UCzebrra');
        await assert.rejects(F.zatwierdz(k.id, 'youtube'), /Izbie/);

        await assert.rejects(F.doPublikacji(k.id, 'tiktok'), /TikTok niepodłączone: brak aplikacji/);
        tiktokPolaczony = true;
        const t = await F.doPublikacji(k.id, 'tiktok');
        assert.equal(t.publikacje.tiktok.etap, 'do_akceptacji');
        assert.match(t.publikacje.tiktok.opis, /^Simms głową!\n\nPierwszy gol\.\n\n#goldnia #premierleague #aiart$/);
        assert.equal(wyslane.length, 0, 'nic nie wychodzi przed ✓');
        await F.zmienPublikacje(k.id, 'tiktok', { opis: 'Mój opis #gol' });
        await F.zatwierdz(k.id, 'tiktok');
        assert.deepEqual(wyslane[0], ['tiktok', k.plik ?? (await F.wszystkie())[0].plik, 'oid']);
        const poSpr = (await F.wszystkie()).find((x) => x.id === k.id);
        assert.equal(poSpr.publikacje.tiktok.etap, 'w_skrzynce');

        await F.doPublikacji(k.id, 'instagram');
        await F.zatwierdz(k.id, 'instagram');
        for (let i = 0; i < 50 && (await F.wszystkie())[0].publikacje.instagram.etap === 'wysylanie'; i++) await new Promise((r) => setTimeout(r, 10));
        const ig = (await F.wszystkie())[0].publikacje.instagram;
        assert.equal(ig.etap, 'opublikowana');
        assert.equal(ig.url, 'https://www.instagram.com/reel/x/');
        assert.equal(wyslane[1][2], ig.opis, 'Instagram dostaje opis zatwierdzony przez Suwerena');
        await assert.rejects(F.doPublikacji(k.id, 'instagram'), /już czeka/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

/** Atrapa skarbca Impresariatu (jak ImpresarioService.sekretySieci / zapiszSekretySieci). */
function skarbiec() {
    const s = {};
    return { s, sekrety: async (siec) => structuredClone(s[siec] ?? {}), zapiszSekrety: async (siec, z) => { const o = structuredClone(s[siec] ?? {}); z(o); s[siec] = o; } };
}
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });

test('TikTok: zgoda z PKCE (hex S256), token do skarbca, rotacja tokenu, szkic w kawałkach; bez kluczy = niepodłączone z powodem', async () => {
    assert.deepEqual(kawalkiTikTok(3_000_000), { chunk_size: 3_000_000, total_chunk_count: 1, zakresy: [[0, 2_999_999]] });
    const duzy = kawalkiTikTok(95 * 1024 * 1024);
    assert.equal(duzy.total_chunk_count, 9);
    assert.equal(duzy.zakresy.at(-1)[1], 95 * 1024 * 1024 - 1, 'reszta w ostatnim kawałku');

    const sk = skarbiec();
    const zapytania = [];
    const fetch = async (url, o = {}) => {
        zapytania.push({ url: String(url), o });
        if (String(url).endsWith('/v2/oauth/token/')) {
            const b = new URLSearchParams(o.body);
            if (b.get('grant_type') === 'authorization_code') return json({ access_token: 'a1', refresh_token: 'r1', open_id: 'oid-1', scope: 'user.info.basic,video.upload' });
            return json({ access_token: 'a2', refresh_token: 'r2' });
        }
        if (String(url).includes('/v2/user/info/')) return json({ data: { user: { display_name: 'Zebrra Football' } } });
        if (String(url).endsWith('/inbox/video/init/')) return json({ data: { publish_id: 'p-1', upload_url: 'https://open-upload.tiktokapis.com/up?x=1' }, error: { code: 'ok' } });
        if (String(url).startsWith('https://open-upload')) return new Response(null, { status: 201 });
        if (String(url).endsWith('/status/fetch/')) return json({ data: { status: 'SEND_TO_USER_INBOX' }, error: { code: 'ok' } });
        return json({}, 404);
    };
    const T = utworzKontoTikTok({ ...sk, fetch, czytajPlik: async () => Buffer.alloc(1234) });
    const s0 = await T.stan();
    assert.equal(s0.polaczony, false);
    assert.match(s0.powod, /niepodłączone: brak aplikacji TikTok/);
    assert.match(s0.instrukcja.join('\n'), /http:\/\/127\.0\.0\.1:3001\/api\/impresario\/tiktok\/zwrot/);
    await assert.rejects(T.adresZgody(), /Client key/);
    await assert.rejects(T.zapiszKlienta({ clientKey: 'x', clientSecret: '' }), /Client key/);
    await T.zapiszKlienta({ clientKey: 'awtestkey123', clientSecret: 'sekret-aplikacji' });
    const u = new URL(await T.adresZgody());
    assert.equal(u.origin + u.pathname, 'https://www.tiktok.com/v2/auth/authorize/');
    assert.equal(u.searchParams.get('scope'), 'user.info.basic,video.upload');
    assert.match(u.searchParams.get('code_challenge'), /^[0-9a-f]{64}$/, 'TikTok: SHA-256 w hex');
    await assert.rejects(T.przyjmijZwrot({ code: 'c', state: 'podrzucony' }), /nieważny/);
    const w = await T.przyjmijZwrot({ code: 'c', state: u.searchParams.get('state') });
    assert.deepEqual(w.konto, { id: 'oid-1', nazwa: 'Zebrra Football' });
    const wymiana = new URLSearchParams(zapytania.find((z) => z.url.endsWith('/v2/oauth/token/')).o.body);
    assert.ok(wymiana.get('code_verifier')?.length >= 43);
    assert.equal(crypto.createHash('sha256').update(wymiana.get('code_verifier')).digest('hex'), u.searchParams.get('code_challenge'));
    await assert.rejects(T.przyjmijZwrot({ code: 'c', state: u.searchParams.get('state') }), /nieważny/, 'state jednorazowy');
    assert.equal(sk.s.tiktok.KONTA[0].token, 'r1');
    const sz = await T.wyslijSzkic('klip.mp4');
    assert.equal(sz.publishId, 'p-1');
    assert.equal(sk.s.tiktok.KONTA[0].token, 'r2', 'nowy token odświeżania od TikTok zapisany');
    const put = zapytania.find((z) => z.o.method === 'PUT');
    assert.equal(put.o.headers['Content-Range'], 'bytes 0-1233/1234');
    assert.equal((await T.stanWysylki('p-1')).status, 'SEND_TO_USER_INBOX');
    assert.equal((await T.stan()).polaczony, true);
    assert.equal(JSON.stringify(await T.stan()).includes('r2'), false, 'stan bez tokenów');
});

test('Instagram: Facebook Login → token strony z kontem IG, Reel resumable → FINISHED → publish; strona bez IG = powód', async () => {
    const sk = skarbiec();
    const zapytania = [];
    let statusow = 0, bezIg = true;
    const fetch = async (url, o = {}) => {
        const u = String(url);
        zapytania.push({ url: u, o });
        if (u.includes('/oauth/access_token?') && u.includes('fb_exchange_token')) return json({ access_token: 'dlugi' });
        if (u.includes('/oauth/access_token?')) return json({ access_token: 'krotki' });
        if (u.includes('/me/accounts?')) return json({ data: bezIg ? [{ id: 'p1', name: 'Strona', access_token: 'tp' }] : [{ id: 'p1', name: 'Zebrra FB', access_token: 'tp', instagram_business_account: { id: '1784', username: 'zebrrafootball' } }] });
        if (u.endsWith('/1784/media')) return json({ id: 'kont-1', uri: 'https://rupload.facebook.com/ig-api-upload/v23.0/kont-1' });
        if (u.startsWith('https://rupload.facebook.com/')) return json({ success: true });
        if (u.includes('/kont-1?')) return json({ status_code: ++statusow < 2 ? 'IN_PROGRESS' : 'FINISHED' });
        if (u.endsWith('/1784/media_publish')) return json({ id: 'media-9' });
        if (u.includes('/media-9?')) return json({ permalink: 'https://www.instagram.com/reel/abc/' });
        return json({ error: { message: 'nie' } }, 400);
    };
    const I = utworzKontoInstagram({ ...sk, fetch, czytajPlik: async () => Buffer.alloc(77), czekaj: async () => {}, adresZwrotu: null });
    assert.match((await I.stan()).powod, /niepodłączone: brak aplikacji Meta/);
    await assert.rejects(I.zapiszKlienta({ appId: 'abc', appSecret: 'x' }), /App ID/);
    await I.zapiszKlienta({ appId: '1234567890', appSecret: '0123456789abcdef0123456789abcdef' });
    const u = new URL(await I.adresZgody());
    assert.equal(u.searchParams.get('redirect_uri'), 'http://localhost:3001/api/impresario/instagram/zwrot');
    assert.match(u.searchParams.get('scope'), /instagram_content_publish/);
    await assert.rejects(I.przyjmijZwrot({ code: 'c', state: u.searchParams.get('state') }), /PROFESJONALNEGO/);
    bezIg = false;
    const u2 = new URL(await I.adresZgody());
    const w = await I.przyjmijZwrot({ code: 'c', state: u2.searchParams.get('state') });
    assert.deepEqual(w.konta, [{ id: '1784', nazwa: '@zebrrafootball', strona: 'Zebrra FB' }]);
    assert.equal(sk.s.instagram.KONTA[0].token, 'tp', 'token STRONY (nie wygasa), nie użytkownika');
    const etapy = [];
    const r = await I.opublikujReel('klip.mp4', { opis: 'Gol! #shorts', postep: (e) => etapy.push(e) });
    assert.deepEqual(r, { mediaId: 'media-9', url: 'https://www.instagram.com/reel/abc/', konto: { id: '1784', nazwa: '@zebrrafootball' } });
    assert.deepEqual(etapy, ['kontener', 'wysylka', 'przetwarzanie', 'publikacja']);
    const kont = new URLSearchParams(zapytania.find((z) => z.url.endsWith('/1784/media')).o.body);
    assert.equal(kont.get('media_type'), 'REELS');
    assert.equal(kont.get('upload_type'), 'resumable');
    const up = zapytania.find((z) => z.url.startsWith('https://rupload'));
    assert.deepEqual([up.o.headers.Authorization, up.o.headers.offset, up.o.headers.file_size], ['OAuth tp', '0', '77']);
});

test('trasy: stan sieci bez sekretów, zdalnie bez klucza 401, powrót OAuth wpuszczony tylko z pętli', async () => {
    const { kat } = await srodowisko();
    const app = express();
    app.use(express.json());
    app.use(strazMostu({ klucz: () => 'k'.repeat(32) }));
    const sk = skarbiec();
    const T = utworzKontoTikTok({ ...sk });
    const F = utworzFormaty({ katalog: kat, katalogMontazy: async (p) => path.join(kat, 'produkcje', p, 'montaz'), opisz, ffmpeg: ffmpegPath });
    zamontujTrasyFormatow(app, F, { tiktok: T, youtubeStan: async () => ({ siec: 'youtube', polaczony: false }) });
    const serwer = app.listen(0, '127.0.0.1');
    await new Promise((r) => serwer.once('listening', r));
    const baza = `http://127.0.0.1:${serwer.address().port}`;
    try {
        const s = await (await fetch(`${baza}/api/formaty/sieci`)).json();
        assert.equal(s.tiktok.polaczony, false);
        assert.match(s.instagram.powod, /niepodłączone/);
        const lista = await (await fetch(`${baza}/api/formaty`)).json();
        assert.equal(lista.success, true);
        assert.deepEqual(lista.klipy, []);
        assert.equal(lista.cele.shorts.max, 180);
        const zr = await (await fetch(`${baza}/api/formaty/zrodla`)).json();
        assert.equal(zr.zrodla.length, 2);
        const zdalnie = await fetch(`${baza}/api/formaty`, { headers: { 'cf-connecting-ip': '8.8.8.8', 'x-forwarded-for': '8.8.8.8' } });
        assert.equal(zdalnie.status, 401);
        const zdalnieKlient = await fetch(`${baza}/api/impresario/tiktok/klient`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '8.8.8.8', 'cf-connecting-ip': '8.8.8.8' }, body: '{}' });
        assert.equal(zdalnieKlient.status, 401);
        // powrót z TikTok z Refererem TikTok (obca strona) — wpuszczony z pętli, odrzucony na `state`
        const zw = await fetch(`${baza}/api/impresario/tiktok/zwrot?code=x&state=zly`, { headers: { referer: 'https://www.tiktok.com/' } });
        assert.equal(zw.status, 200);
        assert.match(await zw.text(), /nieważny/);
        const zwZdalny = await fetch(`${baza}/api/impresario/tiktok/zwrot?code=x&state=zly`, { headers: { 'x-forwarded-for': '8.8.8.8', 'cf-connecting-ip': '8.8.8.8' } });
        assert.equal(zwZdalny.status, 401);
    } finally { serwer.close(); await fs.rm(kat, { recursive: true, force: true }); }
});
