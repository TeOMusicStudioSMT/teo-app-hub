// 📺 YouTube: „Połącz” (state + PKCE, token do skarbca) i publikacje (Kronikarz → Izba → Impresariat → Wystawa).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { utworzKontoYouTube } from '../services/YouTubeKonto.js';
import { utworzPublikacje, odczytajMetadane } from '../services/PublikacjeYouTube.js';

const odp = (status, d) => ({ ok: status < 300, status, json: async () => d });

test('Połącz z YouTube: adres zgody z PKCE i state; zwrot sprawdza state, wymienia kod z weryfikatorem i zapisuje token', async () => {
    const skarbiec = { CLIENT_ID: 'id.apps.googleusercontent.com', CLIENT_SECRET: 'sekret', REFRESH_TOKEN: '' };
    const wymiany = [];
    const konto = utworzKontoYouTube({
        sekrety: async () => skarbiec,
        zapiszToken: async (t, k) => { skarbiec.KONTA = [...(skarbiec.KONTA ?? []).filter((x) => x.id !== k.id), { ...k, token: t }]; skarbiec.DOMYSLNY ??= k.id; },
        fetch: async (url, init = {}) => {
            if (url === 'https://oauth2.googleapis.com/token') { const b = new URLSearchParams(init.body); wymiany.push(b); return odp(200, { access_token: 'AT', refresh_token: 'RT-1' }); }
            if (url.includes('/channels?')) return odp(200, { items: [{ id: 'UCabc', snippet: { title: 'Art Of Soul TV', customUrl: '@artofsoultv' } }] });
            return odp(404, {});
        },
    });
    const u = new URL(await konto.adresZgody());
    assert.equal(u.searchParams.get('redirect_uri'), 'http://127.0.0.1:3001/api/impresario/youtube/zwrot');
    assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(u.searchParams.get('access_type'), 'offline');
    assert.match(u.searchParams.get('prompt'), /select_account/, 'drugi kanał = wybór innego konta Google');
    assert.match(u.searchParams.get('scope'), /youtube\.upload/);
    const state = u.searchParams.get('state');

    await assert.rejects(konto.przyjmijZwrot({ code: 'k', state: 'podrzucony' }), /nieważny/);
    const w = await konto.przyjmijZwrot({ code: 'KOD', state });
    assert.deepEqual(skarbiec.KONTA.map((k) => [k.id, k.token]), [['UCabc', 'RT-1']]);
    assert.equal(w.kanal.nazwa, 'Art Of Soul TV');
    // weryfikator PKCE pasuje do wyzwania z adresu zgody
    const ver = wymiany[0].get('code_verifier');
    assert.equal(crypto.createHash('sha256').update(ver).digest('base64url'), u.searchParams.get('code_challenge'));
    await assert.rejects(konto.przyjmijZwrot({ code: 'KOD', state }), /nieważny/, 'state jednorazowy');
    await assert.rejects(konto.przyjmijZwrot({ error: 'access_denied' }), /Odmówiono/);
});

test('bez klienta OAuth nie ma adresu zgody; wygasły token mówi, co zrobić', async () => {
    await assert.rejects(utworzKontoYouTube({ sekrety: async () => ({}), zapiszToken: async () => {} }).adresZgody(), /CLIENT_ID i CLIENT_SECRET/);
    const k = utworzKontoYouTube({ sekrety: async () => ({ CLIENT_ID: 'a', CLIENT_SECRET: 'b', REFRESH_TOKEN: 'r' }), zapiszToken: async () => {}, fetch: async () => odp(400, { error: 'invalid_grant' }) });
    await assert.rejects(k.statusFilmu('abcdefghijk'), /połącz ten kanał ponownie/);
    const s = await k.stan();
    assert.equal(s.polaczony, true);
    assert.match(s.blad, /wygasł/);
});

test('metadane Kronikarza: format TYTUŁ / OPIS / TAGI, inaczej błąd wprost', () => {
    const m = odczytajMetadane('TYTUŁ: „Rozpad Percepcji”\nOPIS:\nAkapit pierwszy.\n\nAkapit drugi.\nTAGI: ambient, #Katedra, otakos, ambient');
    assert.equal(m.tytul, 'Rozpad Percepcji');
    assert.equal(m.opis, 'Akapit pierwszy.\n\nAkapit drugi.');
    assert.deepEqual(m.tagi, ['ambient', 'katedra', 'otakos']);
    assert.throws(() => odczytajMetadane('Oto świetny opis filmu!'), /format/);
});

function swiat({ widocznosc = 'unlisted', gotowy = true } = {}) {
    const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-yt-'));
    const plik = path.join(katalog, 'rozpad.mp4');
    fs.writeFileSync(plik, 'wideo');
    const kolejka = [];
    const wystawa = {};
    const s = { katalog, plik, kolejka, wystawa, widocznosc };
    s.pub = utworzPublikacje({
        katalog,
        pisz: async (_sys, prompt) => ({ tekst: `TYTUŁ: Rozpad Percepcji\nOPIS:\nFilm z projektu.\n${prompt.includes('Gęstość') ? 'x' : ''}\nTAGI: ambient, otakos`, silnik: 'gemma4' }),
        impresariat: {
            enqueuePublication: async (title, album, platforms, filePath, opcje) => { const j = { id: `pub_${kolejka.length}`, title, platforms, filePath, status: 'PENDING', ...opcje }; kolejka.push(j); return j; },
            getQueue: async () => kolejka,
        },
        statusFilmu: async (id) => ({ id, istnieje: true, widocznosc: s.widocznosc }),
        naWystawe: async (filmId, url) => { wystawa[filmId] = url; },
        gotowyYouTube: async () => gotowy,
    });
    return s;
}

test('publikacja: Kronikarz → do akceptacji → ✓ → kolejka (niepubliczny) → link sam na Wystawie', async () => {
    const s = swiat();
    const p = await s.pub.przygotuj({ plik: s.plik, nazwa: 'rozpad-materii — Rozpad Percepcji', wystawaId: 'film-1', kontekst: 'opis z Wystawy' });
    assert.equal(p.etap, 'do_akceptacji');
    assert.equal(p.tytul, 'Rozpad Percepcji');
    assert.equal((await s.pub.przygotuj({ plik: s.plik, nazwa: 'x' })).id, p.id, 'drugi klik nie robi drugiej publikacji');

    await s.pub.zmien(p.id, { tytul: 'Rozpad Percepcji — teledysk' });
    const z = await s.pub.zatwierdz(p.id);
    assert.equal(z.etap, 'wysylanie');
    assert.equal(s.kolejka[0].widocznosc, 'unlisted');
    assert.equal(s.kolejka[0].title, 'Rozpad Percepcji — teledysk');
    assert.equal(s.kolejka[0].publikacjaId, p.id);
    await assert.rejects(s.pub.zmien(p.id, { tytul: 'za późno' }), /już wysłano/);

    await s.pub.sprawdz();
    assert.equal((await s.pub.wszystkie())[0].etap, 'wysylanie', 'Impresariat jeszcze nie skończył');
    Object.assign(s.kolejka[0], { status: 'COMPLETE', youtubeVideoId: 'abcdefghijk' });
    await s.pub.sprawdz();
    const po = (await s.pub.wszystkie())[0];
    assert.equal(po.etap, 'opublikowana');
    assert.equal(s.wystawa['film-1'], 'https://youtu.be/abcdefghijk');
});

test('YouTube trzyma prywatnie (projekt bez audytu) → link NIE idzie na Wystawę, dopóki Suweren nie zmieni widoczności', async () => {
    const s = swiat({ widocznosc: 'private' });
    const p = await s.pub.przygotuj({ plik: s.plik, nazwa: 'Gęstość Ciszy', wystawaId: 'film-2' });
    await s.pub.zatwierdz(p.id);
    Object.assign(s.kolejka[0], { status: 'COMPLETE', youtubeVideoId: 'zzzzzzzzzzz' });
    await s.pub.sprawdz();
    assert.equal((await s.pub.wszystkie())[0].etap, 'prywatna');
    assert.equal(s.wystawa['film-2'], undefined);
    s.widocznosc = 'unlisted';   // Suweren przełączył w YouTube Studio
    await s.pub.sprawdz();
    assert.equal((await s.pub.wszystkie())[0].etap, 'opublikowana');
    assert.equal(s.wystawa['film-2'], 'https://youtu.be/zzzzzzzzzzz');
});

test('bez połączenia YouTube nie ma ✓; nieudana wysyłka i odrzucenie mówią prawdę', async () => {
    const s = swiat({ gotowy: false });
    const p = await s.pub.przygotuj({ plik: s.plik, nazwa: 'x' });
    await assert.rejects(s.pub.zatwierdz(p.id), /niepołączony/);
    await s.pub.odrzuc(p.id);
    assert.equal((await s.pub.wszystkie())[0].etap, 'odrzucona');
    await assert.rejects(s.pub.przygotuj({ plik: path.join(s.katalog, 'obraz.png'), nazwa: 'x' }), /tylko plik wideo/);

    const s2 = swiat();
    const p2 = await s2.pub.przygotuj({ plik: s2.plik, nazwa: 'y' });
    await s2.pub.zatwierdz(p2.id);
    Object.assign(s2.kolejka[0], { status: 'FAILED', error: 'Token YouTube wygasł' });
    await s2.pub.sprawdz();
    const b = (await s2.pub.wszystkie())[0];
    assert.equal(b.etap, 'blad');
    assert.match(b.blad, /wygasł/);
});

test('wiele kanałów: każdy z własnym tokenem; status filmu pyta tokenem jego kanału; stary pojedynczy token przechodzi na listę', async () => {
    const skarbiec = { CLIENT_ID: 'id.apps.googleusercontent.com', CLIENT_SECRET: 's', REFRESH_TOKEN: 'STARY' };
    const uzyte = [];
    const konto = utworzKontoYouTube({
        sekrety: async () => skarbiec,
        zapiszToken: async (t, k) => { skarbiec.KONTA = [...(skarbiec.KONTA ?? []).filter((x) => x.id !== k.id), { ...k, token: t }]; skarbiec.DOMYSLNY ??= k.id; },
        fetch: async (url, init = {}) => {
            if (url === 'https://oauth2.googleapis.com/token') { const rt = new URLSearchParams(init.body).get('refresh_token'); uzyte.push(rt); return odp(200, { access_token: `AT-${rt}` }); }
            const at = init.headers?.Authorization;
            if (url.includes('/channels?')) return odp(200, { items: [{ id: at === 'Bearer AT-STARY' ? 'UCstary' : 'UCinny', snippet: { title: at === 'Bearer AT-STARY' ? 'TeO Univers Studio' : 'Drugi' } }] });
            if (url.includes('/videos?')) return odp(200, { items: [{ status: { privacyStatus: at === 'Bearer AT-RT-2' ? 'unlisted' : 'private', uploadStatus: 'processed' } }] });
            return odp(404, {});
        },
    });
    const s = await konto.stan();
    assert.deepEqual(s.kanaly.map((k) => k.nazwa), ['TeO Univers Studio'], 'stary token przeniesiony na listę z nazwą kanału');
    assert.equal(s.domyslny, 'UCstary');
    skarbiec.KONTA.push({ id: 'UCdrugi', nazwa: 'Drugi', token: 'RT-2' });
    assert.equal((await konto.statusFilmu('abcdefghijk', 'UCdrugi')).widocznosc, 'unlisted');
    assert.equal(uzyte.at(-1), 'RT-2', 'token kanału, na który poszedł film');
    assert.equal((await konto.statusFilmu('abcdefghijk')).widocznosc, 'private', 'bez kanału = domyślny');
    await assert.rejects(konto.statusFilmu('abcdefghijk', 'UCnieznany'), /nie jest połączony/);
});

test('publikacja: kanał domyślny, zmiana przed ✓, projekt zapamiętuje kanał; rozłączony kanał blokuje ✓', async () => {
    const s = swiat();
    const kanaly = { domyslny: 'UCa', kanaly: [{ id: 'UCa', nazwa: 'Główny' }, { id: 'UCb', nazwa: 'Projekt X' }] };
    const katalog = s.katalog;
    const pub = utworzPublikacje({
        katalog, pisz: async () => ({ tekst: 'TYTUŁ: T\nOPIS:\nO.\nTAGI: a' }),
        impresariat: { enqueuePublication: async (t, a, pl, f, o) => { const j = { id: `j${s.kolejka.length}`, status: 'PENDING', ...o }; s.kolejka.push(j); return j; }, getQueue: async () => s.kolejka },
        statusFilmu: async () => ({ istnieje: true, widocznosc: 'unlisted' }), naWystawe: async () => {}, gotowyYouTube: async () => true,
        kanaly: async () => kanaly,
    });
    const p = await pub.przygotuj({ plik: s.plik, nazwa: 'odc 1', zrodlo: { projekt: 'Serial' } });
    assert.equal(p.kanalId, 'UCa');
    await assert.rejects(pub.zmien(p.id, { kanalId: 'UCobcy' }), /nie jest połączony/);
    await pub.zmien(p.id, { kanalId: 'UCb' });
    await pub.zatwierdz(p.id);
    assert.equal(s.kolejka[0].kanalId, 'UCb');
    const plik2 = path.join(katalog, 'odc2.mp4'); fs.writeFileSync(plik2, 'w');
    const p2 = await pub.przygotuj({ plik: plik2, nazwa: 'odc 2', zrodlo: { projekt: 'Serial' } });
    assert.deepEqual([p2.kanalId, p2.kanalNazwa], ['UCb', 'Projekt X'], 'następny odcinek projektu idzie na jego kanał');
    kanaly.kanaly = kanaly.kanaly.filter((k) => k.id !== 'UCb');
    await assert.rejects(pub.zatwierdz(p2.id), /nie jest już połączony/);
});

test('publikacja po angielsku: Kronikarz dostaje prośbę PO ANGIELSKU, etykiety formatu bez zmian; domyślnie po polsku', async () => {
    const { systemKronikarza, SYSTEM_KRONIKARZA } = await import('../services/PublikacjeYouTube.js');
    assert.match(systemKronikarza('en'), /PO ANGIELSKU/);
    assert.match(systemKronikarza('en'), /TYTUŁ:[\s\S]*OPIS:[\s\S]*TAGI:/);
    assert.equal(SYSTEM_KRONIKARZA, systemKronikarza('pl'));
    const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-en-'));
    const plik = path.join(katalog, 'wywiad_elara_en_abc123.mp4');
    fs.writeFileSync(plik, 'wideo');
    const systemy = [];
    const pub = utworzPublikacje({
        katalog, impresariat: { enqueuePublication: async () => ({}), getQueue: async () => [] },
        pisz: async (sys) => { systemy.push(sys); return { tekst: 'TYTUŁ: The Architecture of Whispers — Interview\nOPIS:\nKael and Elara talk.\nTAGI: interview, otakos' }; },
    });
    const p = await pub.przygotuj({ plik, nazwa: 'Elara — interview', jezyk: 'en' });
    assert.equal(p.jezyk, 'en');
    assert.equal(p.tytul, 'The Architecture of Whispers — Interview');
    assert.match(systemy[0], /PO ANGIELSKU/);
});
