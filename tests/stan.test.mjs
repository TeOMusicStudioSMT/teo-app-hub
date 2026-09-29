// Stan Katedry: fakty o projektach/Stole dla agentów, pamięć z PID i opisem, zamykanie po PID tylko niechronionych.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as StanKatedry from '../services/StanKatedry.js';
import * as Delegat from '../services/Delegat.js';

const WIN = [
    { ProcessId: 4100, ParentProcessId: 1, Name: 'python.exe', WorkingSetSize: 2425 * 1048576, CommandLine: 'F:\\Katedra\\ComfyUI\\python_embeded\\python.exe -s ComfyUI\\main.py --listen --api-key=SEKRET' },
    { ProcessId: 3000, ParentProcessId: 4, Name: 'Memory Compression', WorkingSetSize: 1799 * 1048576, CommandLine: null },
    { ProcessId: 5200, ParentProcessId: 1, Name: 'python.exe', WorkingSetSize: 649 * 1048576, CommandLine: 'F:\\K\\_OtakOs_AI\\kuznia-soup\\venv\\Scripts\\python.exe -m pip install soup-cli[train]' },
    { ProcessId: 777, ParentProcessId: 1, Name: 'node.exe', WorkingSetSize: 532 * 1048576, CommandLine: 'node wiesio-bridge.js' },
    { ProcessId: 6400, ParentProcessId: 1, Name: 'chrome.exe', WorkingSetSize: 364 * 1048576, CommandLine: '"C:\\chrome.exe" --type=renderer' },
];
const naWindowsie = (dodatkowo = {}) => StanKatedry.skonfiguruj({
    platforma: 'win32', wlasnyPid: 99999, ram: () => ({ total: 42.6e9, free: 15e9 }),
    uruchom: async (program) => { assert.equal(program, 'powershell'); return JSON.stringify(WIN); },
    ...dodatkowo,
});

test('Stan: pamięć — PID, opis czym jest proces, chronione; linia poleceń (z kluczem) nie wychodzi', async () => {
    naWindowsie();
    const m = await StanKatedry.pamiec();
    assert.deepEqual([m.freeGB, m.totalGB], [15, 42.6]);
    const po = Object.fromEntries(m.procesy.map((p) => [p.pid, p]));
    assert.equal(po[4100].opis, 'ComfyUI (obrazy, wideo, muzyka)');
    assert.equal(po[4100].skrypt, 'main.py');
    assert.equal(po[4100].mb, 2425);
    assert.equal(po[3000].chroniony, true);
    assert.match(po[3000].uwaga, /nie da się zamknąć/);
    assert.equal(po[5200].opis, 'instalacja pip (np. środowisko Kuźni)');
    assert.equal(po[777].chroniony, true, 'most chroniony');
    assert.ok(!JSON.stringify(m).includes('SEKRET'), 'linia poleceń nie wychodzi');
    assert.match(StanKatedry.tekstPamieci(m), /PID 4100 python\.exe 2425 MB — ComfyUI/);
});

test('Stan: zwolnij po PID — tylko ze świeżej listy i niechronione; reszta odmowa z powodem', async () => {
    const zabite = [];
    naWindowsie({ zabij: async (pid) => { zabite.push(pid); } });
    const w = await StanKatedry.zwolnij([5200, 3000, 777, 123456, 2]);
    assert.deepEqual(zabite, [5200]);
    assert.deepEqual(w.zamkniete.map((p) => p.pid), [5200]);
    const powody = Object.fromEntries(w.odmowy.map((o) => [o.pid, o.powod]));
    assert.match(powody[3000], /chroniony/);
    assert.match(powody[777], /Most Katedry/);
    assert.match(powody[123456], /nie ma go na liście/);
    assert.match(powody[2], /zły PID/);
});

test('Stan: Linux/mac — ps sortowane po RSS', async () => {
    StanKatedry.skonfiguruj({
        platforma: 'linux', wlasnyPid: 1, ram: () => ({ total: 8e9, free: 2e9 }),
        uruchom: async (program) => { assert.equal(program, 'ps'); return '  10     1  102400 python3 python3 -m pip install x\n  11     1 2048000 ollama ollama serve\n'; },
    });
    const m = await StanKatedry.pamiec();
    assert.deepEqual(m.procesy.map((p) => [p.pid, p.mb, p.opis]), [[11, 2000, 'Ollama (modele językowe)'], [10, 100, 'instalacja pip (np. środowisko Kuźni)']]);
});

const PROJEKTY = [
    { id: 'meble-a1', nazwa: 'Moduł do wirtualnego umeblowania', wizja: 'meble 3D', stan: 'gotowy', runda: 3, rundy: 3, od: '2026-09-29T08:00:00Z', do: '2026-09-29T09:30:00Z',
        kroki: [{ stan: 'gotowe' }, { stan: 'gotowe' }, { stan: 'blad' }], oceny: [{ runda: 3, ocena: 8, braki: ['brak katalogu mebli', 'brak eksportu'] }], zlecenia: [{ modul: 'gra', stan: 'gotowe' }] },
    { id: 'pomysl-b2', nazwa: 'Pomysł na nowy projekt', wizja: 'x', stan: 'trwa', runda: 1, rundy: 3, od: '2026-09-29T10:00:00Z', kroki: [{ stan: 'trwa' }], oceny: [], zlecenia: [] },
];

test('Stan: raport projektów, Stołu, Nocnej i szyny — fakty z plików, filtr po nazwie', () => {
    const r = StanKatedry.raport({
        projekty: PROJEKTY,
        karty: [{ id: 'k1', tytul: 'Umeblowanie', etap: 'do_akceptacji', projektSkrot: { oceny: [{ ocena: 8 }] } }],
        nocna: { wlaczona: true, trwa: null, zadania: [{ rodzaj: 'projekt-stada-rundy', stan: 'czeka' }] },
        szyna: [{ kiedy: '2026-09-29T10:05:00Z', agent: 'Kodeks', tresc: 'wkład gotowy' }],
    });
    assert.match(r.tekst, /„Moduł do wirtualnego umeblowania" — gotowy, runda 3\/3, kroki 2\/3, Sędzia 8\/10 \(braki: brak katalogu mebli; brak eksportu\), zlecenia: gra gotowe/);
    assert.match(r.tekst, /„Pomysł na nowy projekt" — w toku, runda 1\/3, kroki 0\/1, bez oceny Sędziego/);
    assert.match(r.tekst, /„Umeblowanie" — czeka na ratyfikację, ostatnia ocena 8\/10/);
    assert.match(r.tekst, /NOCNA ZMIANA: włączona, czeka: projekt-stada-rundy/);
    assert.match(r.tekst, /Kodeks: wkład gotowy/);
    assert.deepEqual(StanKatedry.raport({ projekty: PROJEKTY, szukaj: 'umebl' }).projekty.map((p) => p.id), ['meble-a1']);
    assert.match(StanKatedry.raport({ projekty: PROJEKTY, szukaj: 'zamek' }).tekst, /żaden projekt nie pasuje do „zamek"/);
});

test('Delegat: projekty.stan i system.pamiec u każdego; zamykanie tylko u Kodeksa i jako ciężkie (z tunelu nie)', async () => {
    Delegat.skonfiguruj({ stan: { raport: async ({ szukaj }) => StanKatedry.raport({ projekty: PROJEKTY, szukaj }), pamiec: async () => ({ freeGB: 1, totalGB: 2, procesy: [] }), zwolnij: async (p) => ({ zamkniete: p, odmowy: [] }) } });
    const w = await Delegat.NARZEDZIA['projekty.stan'].wykonaj({ szukaj: 'umebl' });
    assert.match(w.opis, /Sędzia 8\/10/);
    assert.deepEqual(w.projekty, ['Moduł do wirtualnego umeblowania']);
    for (const p of Object.values(Delegat.PROFILE)) assert.ok(p.narzedzia.includes('projekty.stan') && p.narzedzia.includes('system.pamiec'), p.id);
    assert.equal(Delegat.NARZEDZIA['system.zwolnij'].ciezkie, true);
    assert.deepEqual(Object.values(Delegat.PROFILE).filter((p) => p.narzedzia.includes('system.zwolnij')).map((p) => p.id), ['kodeks']);
    await assert.rejects(Delegat.NARZEDZIA['system.zwolnij'].wykonaj({}), /Podaj PID/);
    assert.deepEqual(await Delegat.NARZEDZIA['system.zwolnij'].wykonaj({ pidy: ['5200'] }), { zamkniete: [5200], odmowy: [] });
    Delegat.skonfiguruj({ pelnyTunel: false });
    const kodeks = (await Delegat.wszyscy()).find((d) => d.id === 'kodeks');
    assert.ok(kodeks.pelny && !kodeks.narzedzia.includes('system.zwolnij') && kodeks.narzedzia.includes('projekty.stan'), 'z tunelu bez zamykania');
});
