// 📰 Zebrra News — nagłówki z RSS (tylko tytuł/opis/link), dobór tematów bez dubli i z różnych dziedzin, powaga, scenariusz
// z liczbami tylko ze źródeł, trasy HTTP z prawdziwym nagraniem webm → mp4 → oprawa (Spawacz) → publikacja, automat dnia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { execFile as execFileCb } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import express from 'express';
import { utworzZebrraNews, zamontujTrasyZebrraNews, naglowkiZXml, wybierzTematy, podobne, czyPowazny, odczytajScenariusz, sprawdzLiczby, kwestieOdcinka, ktoMowiNews, promptScenariusza, promptObrazu, promptWyboru, odczytajWybor, WYBORY } from '../services/ZebrraNews.js';
import { spawaj as spawajNaprawde, zestawKlockow } from '../services/Spawacz.js';
import { opisz as opiszNaprawde } from '../services/Montazownia.js';
import { programZPliku } from '../services/Formaty.js';

const TERAZ = Date.parse('2026-10-19T09:00:00Z');
const rss = (tytuly) => `<?xml version="1.0"?><rss><channel><title>X</title>${tytuly.map(([t, o, h = 1]) => `<item><title><![CDATA[${t}]]></title><description><![CDATA[<p>${o}</p>]]></description><link>https://news.example/${encodeURIComponent(t)}</link><pubDate>${new Date(TERAZ - h * 3600_000).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
const RDF = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><item><title>Climate summit agrees 1.5 degree target</title><description>Leaders from 190 countries met.</description><link>https://dw.example/a</link><dc:date>2026-10-19T07:00:00Z</dc:date></item></rdf:RDF>`;

test('RSS/RDF → nagłówki: tylko tytuł, opis bez HTML (≤ 300), link http(s), czas; treści artykułu nie ma', () => {
    const n = naglowkiZXml(rss([['Mars rover finds &amp; maps ice', 'NASA rover mapped 3 ice deposits <b>near</b> the pole.']]), { id: 'nasa', nazwa: 'NASA', region: 'kosmos', dziedzina: 'kosmos' });
    assert.equal(n[0].tytul, 'Mars rover finds & maps ice');
    assert.equal(n[0].opis, 'NASA rover mapped 3 ice deposits near the pole.');
    assert.match(n[0].link, /^https:\/\/news\.example\//);
    assert.equal(n[0].dziedzinaKanalu, 'kosmos');
    const d = naglowkiZXml(RDF, { id: 'dw', nazwa: 'DW', region: 'Europa' });
    assert.equal(d[0].czas, '2026-10-19T07:00:00.000Z', 'RDF z dc:date');
    assert.equal(naglowkiZXml('to nie xml', { id: 'x', nazwa: 'X' }).length, 0);
});

test('tematy dnia: bez dubli wydarzenia z kilku redakcji, różne dziedziny, ≤ 2 z kanału, stare odpadają; powaga', () => {
    const z = (id, nazwa, region, tytuly) => naglowkiZXml(rss(tytuly), { id, nazwa, region });
    const wszystkie = [
        ...z('a', 'Redakcja A', 'Europa', [['Earthquake kills 12 in mountain region', 'Rescue teams search for survivors.'], ['Parliament passes new budget law', 'The vote was 230 to 210.'], ['Startup unveils AI chip for phones', 'The chip is 2 times faster.'], ['Old story about trade', 'From last week.', 80]]),
        ...z('b', 'Redakcja B', 'Azja', [['Mountain region earthquake kills 12, rescue teams search', 'Survivors are being found.'], ['Central bank raises rates to fight inflation', 'Rates rise by 0.5 percent.'], ['Film festival opens with record crowd', 'The festival runs 10 days.']]),
        ...z('c', 'Redakcja C', 'Afryka', [['Vaccine trial shows strong results', 'The study included 4000 people.']]),
    ];
    assert.ok(podobne('Earthquake kills 12 in mountain region', 'Mountain region earthquake kills 12, rescue teams search') >= 0.34);
    const t = wybierzTematy(wszystkie, { ile: 6, teraz: TERAZ });
    assert.equal(t.length, 5, 'prośba o 6, ale ≤ 2 z kanału: A 2 + B 2 (dubel trzęsienia odpadł) + C 1');
    assert.equal(t.filter((x) => /earthquake/i.test(x.tytul)).length, 1, 'jedno trzęsienie, nie dwa');
    assert.ok(!t.some((x) => /Old story/.test(x.tytul)), 'starsze niż 36 h odpadają');
    assert.ok(new Set(t.map((x) => x.dziedzina)).size >= 4, `dziedziny: ${t.map((x) => x.dziedzina)}`);
    assert.ok(t.filter((x) => x.zrodloId === 'a').length <= 2);
    assert.equal(t.find((x) => /earthquake/i.test(x.tytul)).powaga, true);
    assert.equal(czyPowazny({ tytul: 'Film festival opens', opis: '' }), false);
    assert.equal(czyPowazny({ tytul: 'Nie żyją dwaj kierowcy', opis: 'Zginęli w wypadku' }), true);
});

const S = { dzien: '2026-10-19', jezyk: 'en', narrator: 'zebra', wspolprowadzacy: ['lew'], newsy: [
    { tytul: 'Earthquake kills 12 in mountain region', opis: 'Rescue teams search.', zrodlo: 'Redakcja A', region: 'Europa', dziedzina: 'klimat', powaga: true },
    { tytul: 'Central bank raises rates', opis: 'Rates rise by 0.5 percent.', zrodlo: 'Redakcja B', region: 'Azja', dziedzina: 'gospodarka', powaga: false },
    { tytul: 'Film festival opens', opis: 'The festival runs 10 days.', zrodlo: 'Redakcja B', region: 'Azja', dziedzina: 'kultura', powaga: false },
] };
const SC = 'INTRO: Good morning, this is Zebrra News.\nNEWS 1: An earthquake killed 12 people in a mountain region, reports Redakcja A.\nNEWS 2: A central bank raised rates by 0.5 percent, reports Redakcja B.\nNEWS 3: A film festival opens for 10 days, reports Redakcja B.\nOUTRO: That was Zebrra News.';

test('scenariusz: wszystkie linie, liczby tylko ze SWOJEGO newsa, skład i powaga w prompcie, ilustracja bez ludzi i logotypów', () => {
    const sc = odczytajScenariusz(SC, 3);
    assert.equal(sprawdzLiczby(sc, S), null);
    assert.match(sprawdzLiczby({ ...sc, newsy: [sc.newsy[0], 'Rates rose by 12 percent.', sc.newsy[2]] }, S), /NEWS 2 \(12\)/, '12 jest w innym newsie — tu nie wolno');
    assert.match(sprawdzLiczby({ ...sc, intro: 'Welcome to 2026!' }, S), /INTRO\/OUTRO \(2026\)/);
    const S24 = { ...S, newsy: S.newsy.map((n, i) => (i === 2 ? { ...n, zrodlo: 'France 24' } : n)) };
    assert.equal(sprawdzLiczby({ ...sc, newsy: [sc.newsy[0], sc.newsy[1], 'A film festival opens for 10 days, reports France 24.'] }, S24), null, 'liczba z nazwy redakcji jest dozwolona');
    assert.throws(() => odczytajScenariusz('INTRO: a\nNEWS 1: b\nOUTRO: c', 2), /NEWS 2/);
    assert.deepEqual([0, 1, 2, 3].map((i) => ktoMowiNews('news', S, i)), ['zebra', 'lew', 'zebra', 'lew']);
    assert.deepEqual(kwestieOdcinka({ ...S, scenariusz: sc }).map((k) => `${k.typ}${k.news ?? ''}:${k.kto}`), ['intro:zebra', 'news0:zebra', 'news1:lew', 'news2:zebra', 'outro:zebra']);
    const p = promptScenariusza(S);
    assert.match(p.user, /NEWS 1 \[climate & weather · Europa · POWAŻNY — bez żartów\] mówi: Gol Donna/);
    assert.match(p.system, /nie przepisuj zdań źródła/);
    assert.match(p.system, /Zlat Kadabra w serwisie mówi skromniej/);
    assert.match(promptObrazu(S.newsy[0]), /no people, no faces, no logos, no text.*not a photograph of a real event/);
});

test('trasy na prawdziwym ffmpeg: nagłówki z atrapy RSS → odcinek → scenariusz (zła liczba odrzucona) → ilustracje → nagranie → oprawa (tylko end) → publikacja; automat dnia', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'zebrra-news-'));
    try {
        const klocki = path.join(kat, '_OtakOs_Klocki');
        await fs.mkdir(path.join(klocki, 'Klocki News', 'end'), { recursive: true });
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=1920x1080:r=25:d=1.5', '-f', 'lavfi', '-i', 'sine=duration=1.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(klocki, 'Klocki News', 'end', 'end en.mp4')]);
        const obraz = path.join(kat, 'f.png');
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=purple:s=640x360:d=1', '-frames:v', '1', obraz]);
        const webm = path.join(kat, 'n.webm');
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=1280x720:r=30:d=2', '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'libvpx', '-b:v', '800k', '-c:a', 'libopus', '-shortest', webm]);
        const kanaly = {
            'https://a.example/rss': rss([['Earthquake kills 12 in mountain region', 'Rescue teams search.'], ['Central bank raises rates', 'Rates rise by 0.5 percent.']]),
            'https://b.example/rss': rss([['Film festival opens', 'The festival runs 10 days.'], ['Vaccine trial shows strong results', 'The study included 4000 people.']]),
        };
        const prosby = [], publikacje = [], rysunki = [];
        let teraz = TERAZ;
        const N = utworzZebrraNews({
            katalog: kat, ffmpeg: ffmpegPath, katalogMontazy: async (p) => path.join(kat, 'montaz', p), teraz: () => teraz,
            fetch: async (u) => (kanaly[u] ? { ok: true, text: async () => kanaly[u] } : { ok: false, status: 404 }),
            chat: async (_m, _s, user) => {
                prosby.push(user);
                const ile = (user.match(/NEWS \d+ \[/g) ?? []).length;
                const linie = ['INTRO: Good morning from Zebrra News.', ...Array.from({ length: ile }, (_, i) => `NEWS ${i + 1}: Story number in our own words, reports the source.`), `OUTRO: ${prosby.length === 1 ? 'See you at 7.' : 'See you tomorrow.'}`];
                return { tekst: linie.join('\n') };
            },
            rysuj: async (o) => { rysunki.push(o.prompt); return obraz; },
            mow: async () => ({ audio: execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=duration=0.4', '-f', 'wav', '-']), ext: 'wav' }),
            publikuj: async (z) => { publikacje.push(z); return { id: 'yt_news', etap: 'przygotowuje' }; },
            kanal: async () => 'UC-zebrra',
            klocki: () => zestawKlockow(klocki, 'News'),
            spawaj: (o) => spawajNaprawde({ ...o, opisz: opiszNaprawde, uruchom: promisify(execFileCb), ffmpeg: ffmpegPath }),
            opisz: (p) => opiszNaprawde(p),
        });
        const app = express(); app.use(express.json());
        zamontujTrasyZebrraNews(app, N, { raw: express.raw });
        const serwer = app.listen(0);
        const u = (p) => `http://127.0.0.1:${serwer.address().port}${p}`;
        const json = (p, metoda = 'GET', ciało) => fetch(u(p), { method: metoda, headers: { 'Content-Type': 'application/json' }, body: ciało ? JSON.stringify(ciało) : undefined }).then((r) => r.json());
        try {
            assert.match((await json('/api/zebrra-news/ustawienia', 'PUT', { zrodla: [{ nazwa: 'A', url: 'http://a.example/rss' }] })).message, /dwóch kanałów RSS \(https\)/);
            await json('/api/zebrra-news/ustawienia', 'PUT', { zrodla: [{ id: 'a', nazwa: 'Redakcja A', url: 'https://a.example/rss', region: 'Europa' }, { id: 'b', nazwa: 'Redakcja B', url: 'https://b.example/rss', region: 'Azja' }, { id: 'c', nazwa: 'Padnięta', url: 'https://c.example/rss' }], ile: 4 });
            const r = await json('/api/zebrra-news', 'POST', {});
            assert.equal(r.success, true, r.message);
            assert.equal(r.odcinek.newsy.length, 4);
            assert.equal(r.odcinek.raport.find((x) => x.nazwa === 'Padnięta').ok, false, 'padnięty kanał widać w raporcie');
            await N.czekaj();
            const st = await json(`/api/zebrra-news/${r.odcinek.id}/studio`);
            assert.equal(st.odcinek.stan, 'studio', st.odcinek.powod);
            assert.equal(prosby.length, 2, 'pierwsza wersja z liczbą 7 spoza źródeł odrzucona');
            assert.match(prosby[1], /liczby spoza źródeł: INTRO\/OUTRO \(7\)/);
            assert.equal(rysunki.length, 4);
            assert.ok(st.newsy.every((n) => /\/obraz\/news-\d\.png$/.test(n.obrazUrl)));
            assert.equal((await fetch(u(st.newsy[0].obrazUrl))).status, 200);
            assert.equal((await fetch(u(`/api/zebrra-news/${r.odcinek.id}/glos/2`))).status, 200);
            const n = await (await fetch(u(`/api/zebrra-news/${r.odcinek.id}/studio?prowadzacy=zebra,lew`), { method: 'POST', headers: { 'Content-Type': 'video/webm' }, body: await fs.readFile(webm) })).json();
            assert.equal(n.success, true, n.message);
            assert.equal(n.odcinek.stan, 'do_akceptacji');
            assert.match(path.basename(n.odcinek.plik), /^news_2026-10-1\d_en_[0-9a-f]{8}\.mp4$/);
            assert.deepEqual(n.odcinek.oprawa, { start: [], end: ['end en.mp4'] });
            assert.match(n.odcinek.uwagaOprawy, /brak klocków start/);
            assert.ok(n.odcinek.sekundy > 3.2 && n.odcinek.sekundy < 4.2, `${n.odcinek.sekundy}`);
            assert.equal(publikacje[0].kanalId, 'UC-zebrra');
            assert.match(publikacje[0].kontekst, /every story credits its source/);
            assert.match(publikacje[0].kontekst, /Redakcja A https:\/\/news\.example\//);
            assert.deepEqual(programZPliku(n.odcinek.plik), { id: 'zebrra-news', nazwa: '📰 Zebrra News' });
            // 🤖 automat: wyłączony → nic; włączony przed godziną → czeka; po godzinie → raz na dzień
            assert.equal((await N.krokAutomatu()).powod, 'automat wyłączony');
            await json('/api/zebrra-news/ustawienia', 'PUT', { auto: true, godzina: 23 });
            assert.match((await N.krokAutomatu()).powod, /czeka do 23:00/);
            await json('/api/zebrra-news/ustawienia', 'PUT', { godzina: 0 });
            const a1 = await N.krokAutomatu();
            assert.equal(a1.zrobione, true, a1.powod);
            assert.equal((await N.wczytaj(a1.odcinek)).auto, true);
            assert.match((await N.krokAutomatu()).powod, /już przygotowany/);
            await N.czekaj();
        } finally { serwer.close(); }
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('🤯 wybór zaskakujących: tylko numery z listy, bez dubli, ≤ 2 z redakcji, błąd wprost przy za małej liczbie', () => {
    const k = [
        { tytul: 'Ośmiornica otwiera słoik', zrodlo: 'BBC News', region: 'świat', opis: 'Nagranie z akwarium' },
        { tytul: 'Rekord głębokości', zrodlo: 'BBC News', region: 'świat' },
        { tytul: 'Trzeci z BBC', zrodlo: 'BBC News', region: 'świat' },
        { tytul: 'Nowa kometa', zrodlo: 'NASA', region: 'kosmos' },
        { tytul: 'Pszczoły liczą', zrodlo: 'DW', region: 'Europa' },
    ];
    const { user } = promptWyboru(k, 3);
    assert.match(user, /1\. \[BBC News · świat\] Ośmiornica otwiera słoik — Nagranie z akwarium/);
    assert.match(user, /3 różnych numerów/);
    assert.deepEqual(odczytajWybor('<think>9, 1</think>1, 2, 3, 2, 99, 4', k, 3), [0, 1, 3], 'trzeci z BBC odpada, 99 spoza listy');
    assert.throws(() => odczytajWybor('nie wiem', k, 3), /za mało tematów/);
    assert.deepEqual(Object.keys(WYBORY), ['roznorodne', 'zaskakujace']);
});
