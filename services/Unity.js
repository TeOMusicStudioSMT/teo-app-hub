/**
 * 🎲 Unity jako drugi silnik Game Studio — PRZYGOTOWANIE (Suweren 2026-10-20, po CoplayDev/unity-mcp).
 *
 * Gry Katedry są webowe (three.js). Unity przychodzi obok, nie zamiast: most wykrywa Unity Hub i edytory,
 * zakłada/otwiera projekty Unity w `_OtakOs_Unity/<id>`, buduje je z wiersza poleceń (-batchmode -quit
 * -executeMethod) w tle z dziennikiem i kopiuje bryły z Assetów 3D (model.glb + ruch-*.glb) do `Assets/OtakOs/Bryly/`.
 *
 * UCZCIWIE: w dniu powstania na tej maszynie NIE było Unity (sprawdzone: brak Hub/Editor na C/D/E/F i w rejestrze),
 * więc ścieżki CLI, skrypt budowy C# i import GLB nie przeszły przez prawdziwy edytor — testy idą na atrapie
 * ścieżek i procesów. Unity sam nie wczytuje GLB: potrzebny pakiet glTFast (com.unity.cloud.gltfast) — stan to mówi.
 *
 * Unity MCP (CoplayDev/unity-mcp, MIT): pakiet `https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main`
 * w Package Managerze (Unity 2021.3 LTS → 6.x, Python 3.10+ przez uv). Konfigurację klientów pisze okno pakietu
 * (Window → MCP for Unity → Configure All Detected Clients). Most NICZEGO nie pobiera — tylko mówi, czy pakiet jest.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';

export const ID = /^[a-z0-9-]{2,48}$/;
export const PAKIET_MCP = 'https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main';
export const PAKIET_GLTF = 'com.unity.cloud.gltfast';
/** Cele budowy → -buildTarget Unity i nazwa pliku wynikowego. */
export const CELE = {
    windows: { target: 'StandaloneWindows64', plik: (n) => `${n}.exe` },
    linux: { target: 'StandaloneLinux64', plik: (n) => n },
    webgl: { target: 'WebGL', plik: () => '' },
    android: { target: 'Android', plik: (n) => `${n}.apk` },
};
export const INSTRUKCJA = [
    'Zainstaluj Unity Hub: https://unity.com/download (Windows).',
    'W Hubie: Installs → Install Editor → Unity 6 LTS (moduły: Windows Build Support (IL2CPP), opcjonalnie WebGL / Android).',
    'Własna ścieżka: zmienne OTAKOS_UNITY_HUB (Unity Hub.exe) i OTAKOS_UNITY_EDITOR (Unity.exe albo katalog Editor), potem restart mostu.',
    `Unity MCP dla agentów: w projekcie Window → Package Manager → + → Add package from git URL → ${PAKIET_MCP}, potem Window → MCP for Unity → Configure All Detected Clients (wymaga uv i Pythona 3.10+).`,
    `Bryły z Katedry (GLB): Package Manager → Add package by name → ${PAKIET_GLTF}.`,
];

/** Skrypt budowy wkładany do projektu (Assets/Editor/OtakOs/OtakOsBudowa.cs) — woła go -executeMethod. */
export const SKRYPT_BUDOWY = `// Wygenerowane przez Katedrę OtakOS (services/Unity.js) — budowa z wiersza poleceń.
// Unity: -batchmode -quit -projectPath <projekt> -buildTarget <cel> -executeMethod OtakOs.Budowa.Buduj -otakosWyjscie <plik>
#if UNITY_EDITOR
using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;

namespace OtakOs
{
    public static class Budowa
    {
        public static void Buduj()
        {
            var args = Environment.GetCommandLineArgs();
            var i = Array.IndexOf(args, "-otakosWyjscie");
            var wyjscie = i >= 0 && i + 1 < args.Length ? args[i + 1] : "Build/gra";
            var sceny = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            if (sceny.Length == 0) { UnityEngine.Debug.LogError("[OtakOs] Brak scen w Build Settings — dodaj scenę (File > Build Settings)."); EditorApplication.Exit(2); return; }
            var raport = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = sceny, locationPathName = wyjscie, target = EditorUserBuildSettings.activeBuildTarget, options = BuildOptions.None });
            UnityEngine.Debug.Log("[OtakOs] wynik: " + raport.summary.result + ", bajtow: " + raport.summary.totalSize + ", bledow: " + raport.summary.totalErrors);
            EditorApplication.Exit(raport.summary.result == BuildResult.Succeeded ? 0 : 1);
        }
    }
}
#endif
`;

/** Wersja edytora z katalogu Hub (…/Hub/Editor/<wersja>/Editor/Unity.exe). */
const wersjaZeSciezki = (p) => /[\\/](\d{4}\.\d+\.[^\\/]+)[\\/]Editor[\\/]Unity(\.exe)?$/i.exec(p)?.[1] ?? null;

/** Wersja Unity z ProjectSettings/ProjectVersion.txt. */
export function wersjaProjektu(tekst) { return /m_EditorVersion:\s*(\S+)/.exec(String(tekst ?? ''))?.[1] ?? null; }

/** Pakiety z Packages/manifest.json → czy jest Unity MCP i glTFast. */
export function pakietyProjektu(manifest) {
    let deps = {};
    try { deps = JSON.parse(String(manifest ?? '{}')).dependencies ?? {}; } catch { /* zły JSON = brak */ }
    const wpisy = Object.entries(deps);
    return {
        mcp: wpisy.some(([k, v]) => k === 'com.coplaydev.unity-mcp' || /coplaydev\/unity-mcp/i.test(String(v))),
        gltf: wpisy.some(([k]) => k === PAKIET_GLTF || k === 'com.atteneder.gltfast'),
    };
}

/** Porównanie wersji Unity („6000.0.23f1”) — nowsza wyżej. */
const porownaj = (a, b) => String(b).localeCompare(String(a), undefined, { numeric: true });

/**
 * @param {{ katalog: string, katalogDziennikow: string, assety3d?: object, env?: object, istnieje?: Function,
 *           czytaj?: Function, listaKatalogow?: Function, uruchom?: Function, platforma?: string }} c
 */
export function utworzUnity(c) {
    const cfg = {
        env: process.env, platforma: process.platform,
        istnieje: (p) => fsSync.existsSync(p),
        czytaj: (p) => fsSync.readFileSync(p, 'utf8'),
        listaKatalogow: (p) => { try { return fsSync.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; } },
        uruchom: (program, args, opcje) => spawn(program, args, { windowsHide: true, ...opcje }),
        ...c,
    };
    const zadania = new Map();

    function hub() {
        const env = cfg.env;
        const kandydaci = [env.OTAKOS_UNITY_HUB,
            env.ProgramFiles && path.win32.join(env.ProgramFiles, 'Unity Hub', 'Unity Hub.exe'),
            env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, 'Programs', 'Unity Hub', 'Unity Hub.exe'),
            cfg.platforma === 'darwin' ? '/Applications/Unity Hub.app/Contents/MacOS/Unity Hub' : null,
            cfg.platforma === 'linux' ? '/usr/bin/unityhub' : null].filter(Boolean);
        return kandydaci.find((p) => cfg.istnieje(p)) ?? null;
    }

    function edytory() {
        const env = cfg.env;
        const out = new Map();
        const dodaj = (exe, zrodlo, wersja = null) => { if (exe && cfg.istnieje(exe) && !out.has(exe)) out.set(exe, { sciezka: exe, wersja: wersja ?? wersjaZeSciezki(exe), zrodlo }); };
        if (env.OTAKOS_UNITY_EDITOR) {
            const e = env.OTAKOS_UNITY_EDITOR;
            dodaj(/unity(\.exe)?$/i.test(e) ? e : path.join(e, cfg.platforma === 'win32' ? 'Unity.exe' : 'Unity'), 'OTAKOS_UNITY_EDITOR');
        }
        const katalogi = [];
        if (cfg.platforma === 'win32') {
            for (const dysk of ['C', 'D', 'E', 'F']) katalogi.push(`${dysk}:\\Program Files\\Unity\\Hub\\Editor`);
            // Hub z własnym katalogiem instalacji zapisuje go jako napis JSON
            if (env.APPDATA) {
                try { const p = JSON.parse(cfg.czytaj(path.win32.join(env.APPDATA, 'UnityHub', 'secondaryInstallPath.json'))); if (p) katalogi.unshift(String(p)); } catch { /* brak pliku */ }
            }
        } else if (cfg.platforma === 'darwin') katalogi.push('/Applications/Unity/Hub/Editor');
        else if (env.HOME) katalogi.push(path.join(env.HOME, 'Unity', 'Hub', 'Editor'));
        for (const k of katalogi) {
            for (const w of cfg.listaKatalogow(k)) {
                dodaj(cfg.platforma === 'win32' ? path.win32.join(k, w, 'Editor', 'Unity.exe') : cfg.platforma === 'darwin' ? path.join(k, w, 'Unity.app', 'Contents', 'MacOS', 'Unity') : path.join(k, w, 'Editor', 'Unity'), 'Hub', w);
            }
        }
        return [...out.values()].sort((a, b) => porownaj(a.wersja ?? '', b.wersja ?? ''));
    }

    function projekty() {
        return cfg.listaKatalogow(cfg.katalog).filter((d) => ID.test(d)).map((id) => {
            const d = path.join(cfg.katalog, id);
            if (!cfg.istnieje(path.join(d, 'Assets'))) return null;
            let wersja = null, pakiety = { mcp: false, gltf: false };
            try { wersja = wersjaProjektu(cfg.czytaj(path.join(d, 'ProjectSettings', 'ProjectVersion.txt'))); } catch { /* nowy, nieotwarty */ }
            try { pakiety = pakietyProjektu(cfg.czytaj(path.join(d, 'Packages', 'manifest.json'))); } catch { /* — */ }
            return { id, katalog: d, wersja, ...pakiety, skryptBudowy: cfg.istnieje(path.join(d, 'Assets', 'Editor', 'OtakOs', 'OtakOsBudowa.cs')) };
        }).filter(Boolean);
    }

    function stan() {
        const h = hub(), e = edytory(), p = projekty();
        const powod = e.length ? null : h ? 'Unity Hub jest, ale bez edytora — w Hubie: Installs → Install Editor → Unity 6 LTS.' : 'Na tej maszynie nie ma Unity (ani Hub, ani edytora).';
        return {
            gotowy: e.length > 0, hub: h, edytory: e, projekty: p, katalog: cfg.katalog, powod, instrukcja: powod ? INSTRUKCJA : null,
            mcp: { pakiet: PAKIET_MCP, wProjektach: p.filter((x) => x.mcp).map((x) => x.id), uwaga: 'Konfigurację klientów (Claude Code, Gemini CLI…) pisze okno pakietu: Window → MCP for Unity → Configure All Detected Clients. Główny dostaje Unity MCP dopiero z OTAKOS_UNITY_MCP, gdy któryś projekt ma pakiet.' },
            cele: Object.keys(CELE), zadania: [...zadania.values()].slice(-10).reverse(),
        };
    }

    const dirProjektu = (id) => {
        if (!ID.test(String(id ?? ''))) throw new Error('Zły identyfikator projektu Unity (a–z, 0–9, „-”).');
        return path.join(cfg.katalog, id);
    };
    /** Edytor dla projektu: ta sama wersja, co w ProjectVersion.txt; inaczej najnowszy. */
    function edytorDla(wersja) {
        const e = edytory();
        if (!e.length) throw new Error(`Brak Unity na tej maszynie. ${INSTRUKCJA[0]} ${INSTRUKCJA[1]}`);
        return (wersja && e.find((x) => x.wersja === wersja)) || e[0];
    }

    function wTle(rodzaj, projekt, edytor, args, dziennik, poKoncu = null) {
        if ([...zadania.values()].some((z) => z.stan === 'trwa' && z.projekt === projekt)) throw new Error(`Unity już pracuje nad „${projekt}” — poczekaj na koniec.`);
        const id = `u-${crypto.randomBytes(4).toString('hex')}`;
        const z = { id, rodzaj, projekt, edytor: edytor.sciezka, wersja: edytor.wersja, stan: 'trwa', od: new Date().toISOString(), dziennik, kod: null, ogon: null };
        zadania.set(id, z);
        fsSync.mkdirSync(path.dirname(dziennik), { recursive: true });
        let p;
        try { p = cfg.uruchom(edytor.sciezka, [...args, '-logFile', dziennik], { stdio: 'ignore' }); }
        catch (e) { z.stan = 'blad'; z.ogon = e.message; return z; }
        p.on?.('error', (e) => { z.stan = 'blad'; z.ogon = e.message; z.koniec = new Date().toISOString(); });
        p.on?.('close', (kod) => {
            z.kod = kod; z.koniec = new Date().toISOString();
            try { z.ogon = cfg.czytaj(dziennik).split(/\r?\n/).filter((l) => /error|\[OtakOs\]|another Unity instance|Aborting batchmode/i.test(l)).slice(-12).join('\n') || null; } catch { /* brak dziennika */ }
            z.stan = kod === 0 ? 'gotowe' : 'blad';
            if (z.stan === 'blad' && /another Unity instance/i.test(z.ogon ?? '')) z.powod = 'Projekt jest otwarty w edytorze — zamknij go przed budową z wiersza poleceń.';
            poKoncu?.(z);
        });
        return z;
    }

    /** Nowy projekt Unity (Unity tworzy go sam: -createProject). */
    function utworz(id) {
        const d = dirProjektu(id);
        if (cfg.istnieje(d)) throw new Error(`Projekt „${id}” już jest.`);
        const e = edytorDla(null);
        return wTle('utworz', id, e, ['-batchmode', '-quit', '-createProject', d], path.join(cfg.katalogDziennikow, `${id}-utworz.log`));
    }

    /** Otwarcie projektu w edytorze (okno Unity; most nie czeka). */
    function otworz(id) {
        const d = dirProjektu(id);
        const p = projekty().find((x) => x.id === id);
        if (!p) throw new Error(`Nie ma projektu Unity „${id}” w ${cfg.katalog}.`);
        const e = edytorDla(p.wersja);
        const proc = cfg.uruchom(e.sciezka, ['-projectPath', d], { detached: true, stdio: 'ignore' });
        proc.unref?.();
        return { projekt: id, edytor: e.sciezka, wersja: e.wersja, ...(p.wersja && p.wersja !== e.wersja ? { uwaga: `Projekt jest z ${p.wersja}, otwieram ${e.wersja} — Unity zapyta o aktualizację.` } : {}) };
    }

    /** Budowa z wiersza poleceń: skrypt OtakOsBudowa.cs w projekcie + -executeMethod. */
    async function buduj(id, cel = 'windows') {
        const d = dirProjektu(id);
        const p = projekty().find((x) => x.id === id);
        if (!p) throw new Error(`Nie ma projektu Unity „${id}”.`);
        if (!CELE[cel]) throw new Error(`Cel budowy: ${Object.keys(CELE).join(', ')}.`);
        const e = edytorDla(p.wersja);
        const skrypt = path.join(d, 'Assets', 'Editor', 'OtakOs', 'OtakOsBudowa.cs');
        if (!cfg.istnieje(skrypt)) { await fs.mkdir(path.dirname(skrypt), { recursive: true }); await fs.writeFile(skrypt, SKRYPT_BUDOWY, 'utf8'); }
        const wyjscie = path.join(d, 'Build', cel, CELE[cel].plik(id));
        const z = wTle('buduj', id, e, ['-batchmode', '-quit', '-projectPath', d, '-buildTarget', CELE[cel].target, '-executeMethod', 'OtakOs.Budowa.Buduj', '-otakosWyjscie', wyjscie],
            path.join(cfg.katalogDziennikow, `${id}-${cel}-${Date.now()}.log`));
        z.cel = cel; z.wyjscie = wyjscie;
        return z;
    }

    /** Bryła z Assetów 3D → Assets/OtakOs/Bryly/<asset>/ (model.glb + ruch-*.glb + karta.json). */
    async function eksportuj(id, assetId, { ruchy = true } = {}) {
        const d = dirProjektu(id);
        if (!projekty().some((x) => x.id === id)) throw new Error(`Nie ma projektu Unity „${id}”.`);
        const m = await cfg.assety3d.meta(assetId);
        if (!m) throw new Error('Nie ma takiej bryły w Assetach 3D.');
        const zrodlo = cfg.assety3d.katalogAssetu(assetId);
        if (!cfg.istnieje(path.join(zrodlo, 'model.glb'))) throw new Error('Bryła nie ma model.glb (jeszcze się liczy albo padła).');
        const cel = path.join(d, 'Assets', 'OtakOs', 'Bryly', assetId);
        await fs.mkdir(cel, { recursive: true });
        const pliki = ['model.glb'];
        if (ruchy) for (const f of await fs.readdir(zrodlo)) if (/^ruch-[a-z][a-z0-9]*\.glb$/.test(f)) pliki.push(f);
        for (const f of pliki) await fs.copyFile(path.join(zrodlo, f), path.join(cel, f));
        const karta = { asset: assetId, nazwa: m.nazwa ?? assetId, opis: m.opis ?? '', pliki, ruchy: (m.ruchy ?? []).map((r) => r.ruch ?? r.id ?? r).filter(Boolean), tekstury: !!m.tekstury, zrodlo: 'Katedra OtakOS — Assety 3D' };
        await fs.writeFile(path.join(cel, 'karta.json'), JSON.stringify(karta, null, 2), 'utf8');
        const p = projekty().find((x) => x.id === id);
        return { projekt: id, katalog: cel, pliki, ...(p?.gltf ? {} : { uwaga: `Unity sam nie wczyta GLB — dodaj pakiet ${PAKIET_GLTF} (Package Manager → Add package by name).` }) };
    }

    return { stan, edytory, hub, projekty, utworz, otworz, buduj, eksportuj, zadanie: (id) => zadania.get(id) ?? null };
}

/** Trasy (Straż: `/api/unity` tylko maszyna). */
export function zamontujTrasyUnity(app, U) {
    const odp = (res, f) => Promise.resolve().then(f).then((d) => res.json({ success: true, ...d })).catch((e) => res.status(400).json({ success: false, message: e.message }));
    app.get('/api/unity/stan', (_req, res) => odp(res, () => U.stan()));
    app.post('/api/unity/projekty', (req, res) => odp(res, () => ({ zadanie: U.utworz(String(req.body?.projekt ?? '')) })));
    app.post('/api/unity/launch', (req, res) => odp(res, () => U.otworz(String(req.body?.projekt ?? ''))));
    app.post('/api/unity/build', (req, res) => odp(res, async () => ({ zadanie: await U.buduj(String(req.body?.projekt ?? ''), String(req.body?.cel ?? 'windows')) })));
    app.post('/api/unity/eksport', (req, res) => odp(res, () => U.eksportuj(String(req.body?.projekt ?? ''), String(req.body?.asset ?? ''), { ruchy: req.body?.ruchy !== false })));
    app.get('/api/unity/zadanie/:id', (req, res) => { const z = U.zadanie(req.params.id); return z ? res.json({ success: true, zadanie: z }) : res.status(404).json({ success: false, message: 'Nie ma takiego zadania (most mógł wystartować od nowa).' }); });
}

export default { utworzUnity, zamontujTrasyUnity, wersjaProjektu, pakietyProjektu, CELE, PAKIET_MCP, SKRYPT_BUDOWY };
