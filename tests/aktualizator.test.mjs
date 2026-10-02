// 🔄 Aktualizator: węzeł sprawdza nowszą Katedrę (otakos.wtf albo origin) i podmienia TYLKO kod — dane, sekrety i skille zostają.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as Akt from '../services/Aktualizator.js';

const tmp = (p = 'akt-') => fs.mkdtempSync(path.join(os.tmpdir(), p));
const zapisz = (dir, rel, tresc) => { const p = path.join(dir, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, tresc); };
const czytaj = (dir, rel) => fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
const czekaj = async (w) => { for (let i = 0; i < 1500 && !(await w()); i++) await new Promise((r) => setTimeout(r, 10)); };

test('Aktualizator: co wolno podmienić — kod tak; dane, sekrety, node_modules nie; skille tylko nowe; numery wersji po cyfrach', () => {
    for (const r of ['wiesio-bridge.js', 'services/Glowny.js', 'components/a/B.tsx', 'package.json', 'wersja.json', '.env.example', 'scripts/glowny/straz.mjs'])
        assert.equal(Akt.rodzaj(r), 'kod', r);
    for (const r of ['_OtakOs_Wymiar/stado.json', '_OtakOs_Klocki/a.mp4', '.env', '.env.local', 'media_secrets.json', 'identity.json', 'certs/klucz.pem',
        'node_modules/x/index.js', '.git/config', 'models/a.gguf', '../poza.js', 'a/../../b.js'])
        assert.equal(Akt.rodzaj(r), 'chroniony', r);
    assert.equal(Akt.rodzaj('TeO_Skille/moj/SKILL.md'), 'tylko-nowy');
    assert.equal(Akt.rodzaj('a\\b.js'), 'kod', 'ukośniki wsteczne ze starych paczek PowerShella');
    assert.ok(Akt.nowszy('2026.10.02.1430', '2026.09.21.1019'));
    assert.ok(Akt.nowszy('2026.10.02.1430', '2026.10.02.0959'));
    assert.ok(!Akt.nowszy('2026.10.02.1430', '2026.10.02.1430'));
    assert.ok(!Akt.nowszy('2026.09.30.2359', '2026.10.01.0000'));
});

/** Wydanie: katalog „paczki" (rozpakowany zip) + bajty zipa (dowolne — rozpakowanie podmienione w teście) i strona z wersja.json. */
function wydanie({ numer = '2026.10.02.1430', pliki, suma } = {}) {
    const paczka = tmp('akt-paczka-');
    const korzen = path.join(paczka, 'TeO_Genesis_V_ZERO');
    for (const [rel, t] of Object.entries(pliki)) zapisz(korzen, rel, t);
    const zip = Buffer.from(`ZIP-${numer}`);
    const sha = crypto.createHash('sha256').update(zip).digest('hex');
    const wersja = { wersja: 'V_ZERO', numer, data: '2026-10-02T14:30:00Z', commit: 'abc1234', katalogWPaczce: 'TeO_Genesis_V_ZERO', paczka: 'V_ZERO_archive.zip', sha256: suma ?? sha, bajtow: zip.length,
        zmiany: [{ data: '2026-10-02', tytul: 'Aktualizator' }, { data: '2026-09-25', tytul: 'Stół' }, { data: '2026-09-10', tytul: 'stare' }] };
    const pobrane = [];
    return {
        wersja, paczka,
        fetch: async (url) => {
            pobrane.push(url);
            if (url.endsWith('/wersja.json')) return { ok: true, status: 200, text: async () => JSON.stringify(wersja) };
            if (url.endsWith('/V_ZERO_archive.zip')) return { ok: true, status: 200, headers: { get: () => String(zip.length) }, body: (async function* () { yield zip; })() };
            return { ok: false, status: 404, text: async () => '' };
        },
        rozpakuj: async (_zip, dokad) => { fs.cpSync(paczka, dokad, { recursive: true }); },
        pobrane,
    };
}

test('Aktualizator (paczka): nowsza wersja → suma SHA-256 → podmiana kodu z kopią; dane, sekrety i skille Suwerena nietknięte; cofnij przywraca', async () => {
    const k = tmp();
    zapisz(k, 'wiesio-bridge.js', 'most v1');
    zapisz(k, 'services/Stary.js', 'zostaje');
    zapisz(k, '.env', 'KLUCZ=moj');
    zapisz(k, '_OtakOs_Wymiar/stado.json', '{"moje":1}');
    zapisz(k, 'TeO_Skille/moj/SKILL.md', 'moja wersja');
    zapisz(k, 'wersja.json', JSON.stringify({ wersja: 'V_ZERO', numer: '2026.09.21.1019', data: '2026-09-21T08:19:00Z' }));
    const w = wydanie({ pliki: {
        'wiesio-bridge.js': 'most v2', 'services/Nowy.js': 'nowy', '.env': 'KLUCZ=cudzy', '_OtakOs_Wymiar/stado.json': '{"cudze":1}',
        'TeO_Skille/moj/SKILL.md': 'wersja z paczki', 'TeO_Skille/nowy/SKILL.md': 'nowy skill', 'node_modules/x/i.js': 'x', 'wersja.json': '{"numer":"2026.10.02.1430"}',
    } });
    const szyna = [];
    let npm = 0;
    Akt.skonfiguruj({ katalog: k, robocze: path.join(k, '_OtakOs_Wymiar', 'aktualizacje'), url: 'https://otakos.test/wersja.json', fetch: w.fetch, rozpakuj: w.rozpakuj,
        npmInstall: async () => { npm++; }, szyna: { nadaj: async (z) => { szyna.push(z); } } });

    const s = await Akt.sprawdz();
    assert.equal(s.tryb, 'paczka');
    assert.equal(s.nowsza, true);
    assert.deepEqual(s.zmiany.map((z) => z.tytul), ['Aktualizator', 'Stół'], 'tylko zmiany po dacie lokalnej wersji');

    await Akt.zastosuj();
    await czekaj(() => Akt.stan().stan !== 'trwa');
    const st = Akt.stan();
    assert.equal(st.stan, 'gotowe', st.blad);
    assert.equal(czytaj(k, 'wiesio-bridge.js'), 'most v2');
    assert.equal(czytaj(k, 'services/Nowy.js'), 'nowy');
    assert.equal(czytaj(k, 'services/Stary.js'), 'zostaje', 'niczego nie kasujemy');
    assert.equal(czytaj(k, '.env'), 'KLUCZ=moj', 'sekrety nietknięte');
    assert.equal(czytaj(k, '_OtakOs_Wymiar/stado.json'), '{"moje":1}', 'dane stada nietknięte');
    assert.equal(czytaj(k, 'TeO_Skille/moj/SKILL.md'), 'moja wersja', 'istniejący skill Suwerena zostaje');
    assert.equal(czytaj(k, 'TeO_Skille/nowy/SKILL.md'), 'nowy skill', 'nowy skill dochodzi');
    assert.ok(!fs.existsSync(path.join(k, 'node_modules')), 'node_modules z paczki pominięte');
    assert.equal(JSON.parse(czytaj(k, 'wersja.json')).numer, '2026.10.02.1430');
    assert.equal(npm, 0, 'package.json bez zmian → bez npm install');
    assert.match(szyna.at(-1).tresc, /zaktualizowana .*2026\.09\.21\.1019 → 2026\.10\.02\.1430/);
    assert.equal((await Akt.sprawdz()).nowsza, false, 'po aktualizacji — aktualna');

    const c = await Akt.cofnij();
    assert.ok(c.przywrocone >= 2);
    assert.equal(czytaj(k, 'wiesio-bridge.js'), 'most v1', 'cofnięcie przywraca kod');
    assert.equal(JSON.parse(czytaj(k, 'wersja.json')).numer, '2026.09.21.1019', 'i poprzednią wersję');
    await assert.rejects(Akt.cofnij(), /Nie ma aktualizacji do cofnięcia/);
});

test('Aktualizator (paczka): zła suma, brak sumy i HTML zamiast wersja.json → błąd wprost, kod nietknięty', async () => {
    const k = tmp();
    zapisz(k, 'wiesio-bridge.js', 'most v1');
    const zla = wydanie({ pliki: { 'wiesio-bridge.js': 'podmieniony' }, suma: 'a'.repeat(64) });
    Akt.skonfiguruj({ katalog: k, robocze: path.join(k, '_OtakOs_Wymiar', 'aktualizacje'), url: 'https://otakos.test/wersja.json', fetch: zla.fetch, rozpakuj: zla.rozpakuj, szyna: null });
    assert.equal((await Akt.sprawdz()).uwaga !== undefined, true, 'paczka bez wersja.json → uwaga');
    await Akt.zastosuj();
    await czekaj(() => Akt.stan().stan !== 'trwa');
    assert.equal(Akt.stan().stan, 'blad');
    assert.match(Akt.stan().blad, /Suma SHA-256 się nie zgadza/);
    assert.equal(czytaj(k, 'wiesio-bridge.js'), 'most v1');

    const bez = wydanie({ pliki: { 'wiesio-bridge.js': 'x' } });
    delete bez.wersja.sha256;
    Akt.skonfiguruj({ fetch: bez.fetch, rozpakuj: bez.rozpakuj });
    await Akt.zastosuj();
    await czekaj(() => Akt.stan().stan !== 'trwa');
    assert.match(Akt.stan().blad, /nie podaje sumy SHA-256/);

    Akt.skonfiguruj({ fetch: async () => ({ ok: true, status: 200, text: async () => '<!doctype html><html>' }) });
    await assert.rejects(Akt.sprawdz(), /stronę HTML zamiast wersja\.json/);
    assert.equal(czytaj(k, 'wiesio-bridge.js'), 'most v1');
});

test('Aktualizator (git): commity na origin → lista zmian; niezapisana praca blokuje; czyste drzewo → git pull --ff-only', async () => {
    const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();
    const baza = tmp('akt-git-');
    const origin = path.join(baza, 'origin.git');
    g(baza, 'init', '-q', '--bare', '-b', 'main', origin);
    const autor = path.join(baza, 'autor');
    g(baza, 'clone', '-q', origin, autor);
    zapisz(autor, 'wiesio-bridge.js', 'v1'); g(autor, 'add', '.'); g(autor, 'commit', '-q', '-m', 'start'); g(autor, 'push', '-q', 'origin', 'HEAD:main');
    const wezel = path.join(baza, 'wezel');
    g(baza, 'clone', '-q', origin, wezel);
    zapisz(autor, 'wiesio-bridge.js', 'v2'); g(autor, 'commit', '-q', '-am', 'feat: Aktualizator'); g(autor, 'push', '-q', 'origin', 'HEAD:main');

    let npm = 0;
    Akt.skonfiguruj({ katalog: wezel, robocze: path.join(wezel, '_OtakOs_Wymiar', 'aktualizacje'), npmInstall: async () => { npm++; }, szyna: null,
        uruchom: async (p, a, o) => ({ stdout: execFileSync(p, a, { ...o, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }) }) });
    assert.equal(Akt.tryb(), 'git');
    const s = await Akt.sprawdz();
    assert.equal(s.nowsza, true);
    assert.deepEqual(s.zmiany.map((z) => z.tytul), ['feat: Aktualizator']);

    zapisz(wezel, 'wiesio-bridge.js', 'moja poprawka');
    await Akt.zastosuj();
    await czekaj(() => Akt.stan().stan !== 'trwa');
    assert.equal(Akt.stan().stan, 'blad');
    assert.match(Akt.stan().blad, /niezapisane zmiany.*wiesio-bridge\.js/);
    assert.equal(czytaj(wezel, 'wiesio-bridge.js'), 'moja poprawka', 'praca Suwerena nietknięta');

    g(wezel, 'checkout', '--', 'wiesio-bridge.js');
    await Akt.zastosuj();
    await czekaj(() => Akt.stan().stan !== 'trwa');
    assert.equal(Akt.stan().stan, 'gotowe', Akt.stan().blad);
    assert.equal(czytaj(wezel, 'wiesio-bridge.js'), 'v2');
    assert.equal(npm, 0);
    assert.equal((await Akt.sprawdz()).nowsza, false);
    await assert.rejects(Akt.cofnij(), /cofasz gitem/);
});
