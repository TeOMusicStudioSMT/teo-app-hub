/**
 * 🧭 Stan Katedry — fakty dla agentów: co jest zrobione w projektach, co leży na Stole, co zżera pamięć.
 *
 * Suweren (2026-09-29): „w samej Katedrze nasz główny Agent… po zapytaniu co jest zrobione w projektach lub ostatnie
 * działania… bo np. teraz po ostatnim resecie python coś trzyma… memory compression… i by można było to dokonać
 * z poziomu Katedry i Stołu". A na telefonie Kodeks na „stwórz model z planu wirtualnego umeblowania" odpalił harness
 * kodu — bo o projektach stada nie wiedział nic. Ten moduł daje im FAKTY (pliki projektów, Stół, lista procesów),
 * nie domysły modelu.
 *
 * PAMIĘĆ: lista procesów z PID i OPISEM, czym dany proces jest (python bywa ComfyUI, Kuźnią Soup, instalacją pip…),
 * zamykanie po PID tylko tych, które są na świeżej liście i nie są chronione. Linii poleceń NIE oddajemy — potrafi
 * nieść klucze i ścieżki; wychodzi tylko opis i nazwa skryptu.
 */
import { execFile } from 'child_process';
import os from 'os';
import path from 'path';

let cfg = {
    platforma: process.platform,
    /** (program, argumenty) → Promise<stdout> — podmienialne w testach */
    uruchom: (program, argumenty) => new Promise((resolve, reject) => {
        execFile(program, argumenty, { timeout: 12_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (e, out) => (e ? reject(e) : resolve(String(out))));
    }),
    /** zamknij proces (drzewo) po PID → Promise */
    zabij: null,
    wlasnyPid: process.pid,
    ram: () => ({ total: os.totalmem(), free: os.freemem() }),
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

// ─────────────────────────────────────────────────────────────────────────────
// PAMIĘĆ
// ─────────────────────────────────────────────────────────────────────────────

/** Systemowe i sama Katedra — tego się nie zamyka (most, powłoki, jądro Windows). */
const CHRONIONE = /^(system|idle|registry|memory compression|secure system|smss|csrss|wininit|winlogon|services|lsass|lsaiso|svchost|dwm|explorer|fontdrvhost|conhost|powershell|pwsh|cmd|wmiprvse|searchhost|startmenuexperiencehost|textinputhost|audiodg|spoolsv|sihost|ctfmon|runtimebroker|msmpeng|nissrv|securityhealthservice)(\.exe)?$/i;

/**
 * Czym jest proces — po nazwie i linii poleceń (linia NIE wychodzi na zewnątrz).
 * @returns {{ opis: string, chroniony: boolean, uwaga?: string }}
 */
export function rozpoznaj({ name = '', cmd = '', pid, wlasnyPid = cfg.wlasnyPid }) {
    const n = String(name).toLowerCase().replace(/\.exe$/, '');
    const c = String(cmd || '');
    if (pid === wlasnyPid || /wiesio-bridge/i.test(c)) return { opis: 'Most Katedry (wiesio-bridge)', chroniony: true };
    if (n === 'memory compression') return { opis: 'skompresowana pamięć Windows', chroniony: true, uwaga: 'Tego nie da się zamknąć — to RAM, który Windows ścisnął. Zmaleje sam, gdy zamkniesz to, co pamięć zjada (np. python, przeglądarki).' };
    if (CHRONIONE.test(n)) return { opis: 'proces systemowy', chroniony: true };
    if (/comfyui|comfy[\\/]main\.py|main\.py.*--listen/i.test(c)) return { opis: 'ComfyUI (obrazy, wideo, muzyka)', chroniony: false, uwaga: 'Zamknięcie przerwie render w toku.' };
    if (/[\\/]soup(\.exe)?\b|soup_cli|\bsoup\s+(train|export|deploy)/i.test(c) || n === 'soup') return { opis: 'Kuźnia Soup (trening modelu)', chroniony: false, uwaga: 'Zamknięcie przerwie kucie modelu.' };
    if (/-m\s+pip\b|[\\/]pip(3)?(\.exe)?\s+install/i.test(c)) return { opis: 'instalacja pip (np. środowisko Kuźni)', chroniony: false, uwaga: 'Zamknięcie przerwie instalację.' };
    if (/whisper/i.test(c)) return { opis: 'Whisper (rozpoznawanie mowy)', chroniony: false };
    if (/kokoro|piper|xtts|f5-?tts|chatterbox/i.test(c)) return { opis: 'głos Katedry (TTS)', chroniony: false };
    if (n.startsWith('ollama')) return { opis: 'Ollama (modele językowe)', chroniony: false, uwaga: 'Zamknięcie wyłączy stado do restartu Ollamy.' };
    if (/unrealeditor|ue4editor|ue5/i.test(n)) return { opis: 'Unreal Engine', chroniony: false, uwaga: 'Zapisz pracę w UE.' };
    if (/vite/i.test(c) && n === 'node') return { opis: 'Hub (vite)', chroniony: false };
    if (/^(chrome|msedge|brave|firefox|opera)$/.test(n)) return { opis: 'przeglądarka', chroniony: false, uwaga: 'Zapisz otwarte karty.' };
    if (n.startsWith('python')) return { opis: 'python — nierozpoznany skrypt', chroniony: false };
    if (n === 'node') return { opis: 'node — inny skrypt', chroniony: false };
    return { opis: '', chroniony: false };
}

/** Nazwa skryptu z linii poleceń (tylko nazwa pliku — bez ścieżki i argumentów). */
export function skrypt(cmd) {
    const m = String(cmd || '').match(/([\w.-]+\.(?:py|js|mjs|cjs|ts|bat|ps1))\b/i);
    return m ? m[1] : null;
}

/** Surowa lista → [{ pid, ppid, name, mb, cmd }] */
async function surowe() {
    if (cfg.platforma === 'win32') {
        const ps = 'Get-CimInstance Win32_Process | Sort-Object WorkingSetSize -Descending | Select-Object -First 25 ProcessId,ParentProcessId,Name,WorkingSetSize,CommandLine | ConvertTo-Json -Compress';
        const out = await cfg.uruchom('powershell', ['-NoProfile', '-Command', ps]);
        let d = [];
        try { d = JSON.parse(out || '[]'); } catch { d = []; }
        if (!Array.isArray(d)) d = [d];
        return d.map((p) => ({ pid: Number(p.ProcessId), ppid: Number(p.ParentProcessId), name: String(p.Name || ''), mb: Math.round(Number(p.WorkingSetSize || 0) / 1048576), cmd: String(p.CommandLine || '') }));
    }
    const out = await cfg.uruchom('ps', ['-axo', 'pid=,ppid=,rss=,comm=,args=']);
    return String(out).split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/)).filter(Boolean)
        .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), mb: Math.round(Number(m[3]) / 1024), name: path.basename(m[4]), cmd: m[5] }))
        .sort((a, b) => b.mb - a.mb).slice(0, 25);
}

/**
 * RAM i procesy, które go zjadają — z PID, opisem i znacznikiem „chroniony".
 * @returns {Promise<{ totalGB:number, freeGB:number, usedGB:number, procesy:object[], blad?:string }>}
 */
export async function pamiec({ ile = 14 } = {}) {
    const { total, free } = cfg.ram();
    const baza = { totalGB: +(total / 1e9).toFixed(1), freeGB: +(free / 1e9).toFixed(1), usedGB: +((total - free) / 1e9).toFixed(1) };
    let lista = [];
    try { lista = await surowe(); } catch (e) { return { ...baza, procesy: [], blad: `Nie odczytałem listy procesów: ${e.message}` }; }
    const procesy = lista.slice(0, ile).map((p) => {
        const r = rozpoznaj(p);
        return { pid: p.pid, name: p.name, mb: p.mb, opis: r.opis, skrypt: skrypt(p.cmd), chroniony: r.chroniony, ...(r.uwaga ? { uwaga: r.uwaga } : {}) };
    });
    return { ...baza, procesy };
}

async function domyslneZabij(pid) {
    if (cfg.platforma === 'win32') await cfg.uruchom('taskkill', ['/PID', String(pid), '/T', '/F']);
    else process.kill(pid, 'SIGTERM');
}

/**
 * Zamknij procesy po PID. Tylko te z ŚWIEŻEJ listy i niechronione — stary PID mógł już dostać inny proces.
 * @returns {Promise<{ zamkniete: {pid:number,name:string,opis:string}[], odmowy: {pid:number,powod:string}[] }>}
 */
export async function zwolnij(pidy) {
    const chciane = [...new Set((Array.isArray(pidy) ? pidy : [pidy]).map(Number))];
    const zle = chciane.filter((p) => !Number.isInteger(p) || p <= 4);
    const lista = await surowe();
    const zamkniete = [], odmowy = zle.map((pid) => ({ pid, powod: 'zły PID' }));
    for (const pid of chciane.filter((p) => !zle.includes(p))) {
        const p = lista.find((x) => x.pid === pid);
        if (!p) { odmowy.push({ pid, powod: 'nie ma go na liście największych procesów (już zamknięty albo mały)' }); continue; }
        const r = rozpoznaj(p);
        if (r.chroniony) { odmowy.push({ pid, powod: `${p.name}: ${r.opis} — chroniony${r.uwaga ? `. ${r.uwaga}` : ''}` }); continue; }
        try { await (cfg.zabij ?? domyslneZabij)(pid); zamkniete.push({ pid, name: p.name, opis: r.opis }); }
        catch (e) { odmowy.push({ pid, powod: `${p.name}: nie dał się zamknąć (${e.message})` }); }
    }
    return { zamkniete, odmowy };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJEKTY I STÓŁ
// ─────────────────────────────────────────────────────────────────────────────

const data = (iso) => (iso ? new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '?');
const STAN_PROJEKTU = { trwa: 'w toku', gotowy: 'gotowy', blad: 'z błędem', przerwany: 'przerwany (most restartował)' };
const ETAP_KARTY = { na_stole: 'czeka na przyjęcie', opracowuje: 'stado opracowuje', do_akceptacji: 'czeka na ratyfikację', zratyfikowane: 'zratyfikowane', utknela: 'utknęła', odrzucona: 'odrzucona' };

/** Projekt stada → jedno zdanie faktów (czysta funkcja). */
export function zdanieProjektu(p) {
    const kroki = p.kroki ?? [];
    const gotowe = kroki.filter((k) => k.stan === 'gotowe').length;
    const ocena = (p.oceny ?? []).filter((o) => o.ocena != null).at(-1);
    const braki = ocena?.braki?.length ? ` (braki: ${ocena.braki.slice(0, 3).join('; ')})` : '';
    const zlec = (p.zlecenia ?? []).map((z) => `${z.modul} ${z.stan}`);
    return `„${p.nazwa}" — ${STAN_PROJEKTU[p.stan] ?? p.stan}, runda ${p.runda ?? 1}/${p.rundy ?? 1}, kroki ${gotowe}/${kroki.length}` +
        (ocena ? `, Sędzia ${ocena.ocena}/10${braki}` : ', bez oceny Sędziego') +
        (zlec.length ? `, zlecenia: ${zlec.join(', ')}` : '') +
        `; od ${data(p.od)}${p.do ? `, koniec ${data(p.do)}` : ''}.`;
}

/**
 * Raport projektów i Stołu — fakty z plików, do odpowiedzi agenta.
 * @param {{ projekty: object[], karty?: object[], nocna?: object|null, szyna?: object[], ile?: number, szukaj?: string }} d
 */
export function raport({ projekty = [], karty = [], nocna = null, szyna = [], ile = 6, szukaj = '' }) {
    const s = String(szukaj || '').trim().toLowerCase();
    const wybrane = (s ? projekty.filter((p) => `${p.nazwa} ${p.wizja}`.toLowerCase().includes(s)) : projekty).slice(0, ile);
    const linie = [];
    linie.push(projekty.length ? `PROJEKTY STADA (${projekty.length}, najnowsze):` : 'PROJEKTY STADA: brak.');
    for (const p of wybrane) linie.push(`- ${zdanieProjektu(p)}`);
    if (s && !wybrane.length) linie.push(`- żaden projekt nie pasuje do „${szukaj}".`);
    if (karty.length) {
        linie.push(`STÓŁ (${karty.length} kart):`);
        for (const k of karty.slice(0, ile)) linie.push(`- „${k.tytul}" — ${ETAP_KARTY[k.etap] ?? k.etap}${k.projektSkrot?.oceny?.length ? `, ostatnia ocena ${k.projektSkrot.oceny.at(-1).ocena}/10` : ''}.`);
    }
    if (nocna) {
        const czeka = (nocna.zadania ?? []).filter((z) => z.stan === 'czeka');
        linie.push(`NOCNA ZMIANA: ${nocna.wlaczona ? 'włączona' : 'wyłączona'}${nocna.trwa ? `, teraz: ${nocna.trwa.rodzaj}` : ''}${czeka.length ? `, czeka: ${czeka.map((z) => z.rodzaj).join(', ')}` : ', kolejka pusta'}.`);
    }
    if (szyna.length) {
        linie.push('OSTATNIE DZIAŁANIA (szyna):');
        for (const z of szyna.slice(0, 10)) linie.push(`- ${data(z.kiedy ?? z.czas)} ${z.agent}: ${String(z.tresc).slice(0, 140)}`);
    }
    return {
        tekst: linie.join('\n'),
        projekty: wybrane.map((p) => ({ id: p.id, nazwa: p.nazwa, stan: p.stan, zdanie: zdanieProjektu(p) })),
        karty: karty.slice(0, ile).map((k) => ({ id: k.id, tytul: k.tytul, etap: k.etap })),
    };
}

/** Pamięć → tekst dla agenta. */
export function tekstPamieci(m) {
    if (!m) return '';
    const linie = [`PAMIĘĆ: wolne ${m.freeGB} GB z ${m.totalGB} GB.${m.blad ? ` ${m.blad}` : ''}`];
    for (const p of (m.procesy ?? []).slice(0, 10)) linie.push(`- PID ${p.pid} ${p.name} ${p.mb} MB${p.opis ? ` — ${p.opis}` : ''}${p.skrypt ? ` (${p.skrypt})` : ''}${p.chroniony ? ' [chroniony]' : ''}${p.uwaga ? ` · ${p.uwaga}` : ''}`);
    return linie.join('\n');
}

export default { skonfiguruj, pamiec, zwolnij, rozpoznaj, skrypt, raport, zdanieProjektu, tekstPamieci };
