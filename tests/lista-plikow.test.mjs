// 📋 Podpisana lista plików gry: aktualizacja pobiera tylko zmienione pliki (sprawdzone sumą z listy), usuwa spoza listy;
// pliki na żywo ≠ lista, podszyty podpis listy albo manifest bez listy → cała paczka z powodem; złe ścieżki listy odrzucone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { utworzPaczkiGier, oczyscListe, skrotListy } from '../services/PaczkiGier.js';

const para = () => {
    const p = crypto.generateKeyPairSync('ed25519');
    return { pub: p.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), podpisz: async (t) => crypto.sign(null, Buffer.from(t, 'utf8'), p.privateKey).toString('base64') };
};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('oczyscListe: ścieżki bez ucieczek, sumy, kolejność i bez dubli', () => {
    const p = (sciezka) => ({ sciezka, sha256: sha(sciezka), bajtow: 1 });
    assert.equal(oczyscListe([p('a.js'), p('assety/b.glb')]).length, 2);
    for (const zla of ['../x', '/etc/passwd', 'a\\b', 'c:/x', 'a//b', './a']) assert.equal(oczyscListe([p(zla)]), null, zla);
    assert.equal(oczyscListe([p('b'), p('a')]), null, 'zła kolejność');
    assert.equal(oczyscListe([p('a'), p('a')]), null, 'dubel');
    assert.equal(oczyscListe([{ sciezka: 'a', sha256: 'x', bajtow: 1 }]), null);
    assert.notEqual(skrotListy([p('a')]), skrotListy([{ ...p('a'), bajtow: 2 }]));
});

test('aktualizacja po liście: tylko zmienione pliki; przebudowa bez paczki, podszyta lista i stary manifest → cała paczka', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lista-'));
    try {
        const A = { wymiar: path.join(root, 'a-wymiar'), apki: path.join(root, 'a-apki') };
        const dist = path.join(A.apki, 'teterhia', 'dist');
        await fs.mkdir(path.join(dist, 'assety'), { recursive: true });
        await fs.writeFile(path.join(dist, 'index.html'), '<div id="gra"></div><script src="./assets/main.js"></script>');
        await fs.mkdir(path.join(dist, 'assets'), { recursive: true });
        await fs.writeFile(path.join(dist, 'assets', 'main.js'), 'wersja 1');
        await fs.writeFile(path.join(dist, 'assety', 'kot.glb'), crypto.randomBytes(200_000));
        await fs.writeFile(path.join(dist, 'assety', 'stary.glb'), crypto.randomBytes(1000));
        const kA = para(), kB = para();
        let kluczWRejestrze = kA.pub;
        const autor = utworzPaczkiGier({ katalog: A.wymiar, katalogApek: A.apki, nick: async () => 'teo-mas', klucz: async () => kA.pub, podpisz: kA.podpisz, rejestr: 'x' });
        await autor.udostepnij('teterhia', { cenaGRV: 0 });
        const pobrane = [];
        let manifestBezListy = false, podszytaLista = false;
        const siec = async (url) => {
            if (url === 'https://rejestr/api/katedry') return new Response(JSON.stringify({ katedry: [{ nick: 'teo-mas', adres: 'https://teo.example', klucz: kluczWRejestrze }] }));
            const u = new URL(url);
            if (u.pathname === '/wizytowka/gra/teterhia.json') { const m = await autor.manifest('teterhia'); if (manifestBezListy) { delete m.pliki; delete m.podpisListy; } if (podszytaLista) m.pliki[0] = { ...m.pliki[0], sha256: 'f'.repeat(64) }; return new Response(JSON.stringify({ ...m, cenaGRV: 0 })); }
            if (u.pathname === '/wizytowka/gra/teterhia.zip') { pobrane.push('ZIP'); return new Response(await fs.readFile(await autor.sciezkaZip('teterhia'))); }
            const plik = u.pathname.match(/^\/wizytowka\/gra\/teterhia\/(.+)$/);
            if (plik) { pobrane.push(decodeURIComponent(plik[1])); const p = await autor.plikGoscia('teterhia', plik[1]); return p ? new Response(await fs.readFile(p)) : new Response('{}', { status: 404 }); }
            return new Response('{}', { status: 404 });
        };
        const kup = utworzPaczkiGier({ katalog: path.join(root, 'b-wymiar'), katalogApek: path.join(root, 'b-apki'), nick: async () => 'wyspa-ola', klucz: async () => kB.pub, podpisz: kB.podpisz, rejestr: 'https://rejestr/api/katedry', fetch: siec });
        const i1 = await kup.instaluj({ nick: 'teo-mas', gra: 'teterhia' });
        assert.deepEqual([i1.tryb, i1.powod], ['paczka', 'pierwsza instalacja']);
        assert.deepEqual(pobrane, ['ZIP']);
        const zainst = path.join(root, 'b-apki', 'teterhia-teo-mas', 'dist');

        // autor: zmienia kod, dokłada bryłę, usuwa starą — i udostępnia nową paczkę
        await fs.writeFile(path.join(dist, 'assets', 'main.js'), 'wersja 2 — dłuższa');
        await fs.writeFile(path.join(dist, 'assety', 'nowy.glb'), crypto.randomBytes(500));
        await fs.rm(path.join(dist, 'assety', 'stary.glb'));
        await new Promise((r) => setTimeout(r, 1100));   // inna wersja (minuta w nazwie może być ta sama — liczy się treść)
        await autor.udostepnij('teterhia', { cenaGRV: 0 });
        pobrane.length = 0;
        const i2 = await kup.instaluj({ nick: 'teo-mas', gra: 'teterhia' });
        assert.equal(i2.tryb, 'pliki', i2.powod);
        assert.deepEqual(pobrane.sort(), ['assets/main.js', 'assety/nowy.glb'], 'kot.glb (200 kB) nie pobrany drugi raz');
        assert.deepEqual([i2.zmienione, i2.usuniete], [2, 1]);
        assert.ok(i2.pobrano < 1000);
        assert.equal(await fs.readFile(path.join(zainst, 'assets', 'main.js'), 'utf8'), 'wersja 2 — dłuższa');
        assert.equal(fsSync.existsSync(path.join(zainst, 'assety', 'stary.glb')), false);
        assert.deepEqual(await fs.readFile(path.join(zainst, 'assety', 'kot.glb')), await fs.readFile(path.join(dist, 'assety', 'kot.glb')));
        assert.equal(fsSync.existsSync(path.join(root, 'b-apki', '.teterhia-teo-mas-aktualizacja')), false, 'katalog roboczy sprzątnięty');

        // autor przebudował grę BEZ nowej paczki: plik na żywo ≠ lista → cała paczka (zgodna z podpisem)
        await fs.writeFile(path.join(zainst, 'assets', 'main.js'), 'zepsute u kupującego');
        await fs.writeFile(path.join(dist, 'assets', 'main.js'), 'wersja 3 bez udostępnienia');
        pobrane.length = 0;
        const i3 = await kup.instaluj({ nick: 'teo-mas', gra: 'teterhia' });
        assert.equal(i3.tryb, 'paczka');
        assert.match(i3.powod, /różni się od podpisanej listy/);
        assert.equal(await fs.readFile(path.join(zainst, 'assets', 'main.js'), 'utf8'), 'wersja 2 — dłuższa', 'zawartość z podpisanej paczki');

        // podszyta lista (rejestr zna inny klucz): manifest odrzucony w całości — nic nie pobieramy
        kluczWRejestrze = para().pub;
        await assert.rejects(kup.instaluj({ nick: 'teo-mas', gra: 'teterhia' }), /Podpis manifestu/);
        kluczWRejestrze = kA.pub;

        // podpis paczki ważny, ale lista podmieniona w drodze → lista odrzucona, cała paczka
        podszytaLista = true;
        const i5 = await kup.instaluj({ nick: 'teo-mas', gra: 'teterhia' });
        assert.equal(i5.tryb, 'paczka');
        assert.match(i5.powod, /podpis listy plików nie zgadza się/);
        podszytaLista = false;

        // starszy most autora (manifest bez listy) → cała paczka z powodem
        manifestBezListy = true;
        const i4 = await kup.instaluj({ nick: 'teo-mas', gra: 'teterhia' });
        assert.equal(i4.tryb, 'paczka');
        assert.match(i4.powod, /bez listy plików/);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});
