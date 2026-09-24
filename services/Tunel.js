/**
 * 🛰️ Tunel — Kwantowy Tunel Cloudflare uruchamiany JEDNYM PRZYCISKIEM z Katedry.
 *
 * Suweren (2026-09-17): „trycloudflare zmienia się przy każdym uruchomieniu — to
 * tam powinien być przycisk uruchom, ładuje cloudflared, jest link, kopiuje
 * i generuje kod automatycznie". Dotąd Suweren odpalał cloudflared ręcznie w
 * terminalu, przepisywał losowy adres do karty Tunelu, dopiero wtedy był QR.
 *
 * CO ROBI: spawn `cloudflared tunnel --url http://127.0.0.1:<port mostu>` (quick
 * tunnel, bez konta Cloudflare), łapie z jego logu adres `https://….trycloudflare.com`,
 * trzyma proces i stan. Front pyta o stan, bierze adres, zapisuje jako tunel i
 * rysuje QR — zero przepisywania.
 *
 * BINARKA: paczka npm `cloudflared` (JacobLinCool) daje ścieżkę `bin` i `install(bin)`
 * — pobiera oficjalne wydanie z github.com/cloudflare/cloudflared. Nie pobieramy
 * przy starcie mostu; ściąga się DOPIERO po kliknięciu „Uruchom tunel" przez
 * Suwerena (ok. 20 MB, raz). Jeśli `cloudflared` jest już na PATH albo w
 * OTAKOS_CLOUDFLARED — bierzemy tamten.
 *
 * ⚠️ TYLKO LOKALNIE: trasy /api/tunel/* są w SCIEZKI_TYLKO_LOKALNE — tunelu nie
 * odpala się z tunelu. Quick tunnel nie ma hasła po stronie Cloudflare — bramką
 * pozostaje klucz Straży (nagłówek x-teo-klucz) i jej ograniczenie zasięgu.
 */

import { spawn, execFileSync } from 'child_process';
import fsSync from 'fs';
import path from 'path';

let cfg = { portMostu: 3001, szyna: null };
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

/**
 * NAZWANY TUNEL (stały adres) — Suweren 2026-09-24: „moją osobistą możemy pod moje konto
 * cloudflare ustawić". Quick tunnel daje nowy adres przy każdym starcie i telefon co restart
 * dostaje „Failed to fetch"; nazwany tunel ma adres na stałe.
 *
 * MOST NICZEGO NIE LOGUJE I NIE TWORZY. Suweren robi u siebie raz:
 *   cloudflared tunnel login
 *   cloudflared tunnel create katedra
 *   cloudflared tunnel route dns katedra katedra.twojadomena.pl
 * i zapisuje w `_OtakOs_Wymiar/tunel.json`:
 *   { "nazwa": "katedra", "host": "katedra.twojadomena.pl", "poswiadczenia": "C:/Users/…/.cloudflared/<id>.json" }
 * Poświadczenia zostają tam, gdzie są — most tylko wskazuje na nie cloudflared, nigdy ich nie czyta
 * ani nie kopiuje.
 */
function konfiguracjaNazwanego() {
    try {
        const plik = path.join(cfg.katalogWymiaru ?? path.join(process.cwd(), '_OtakOs_Wymiar'), 'tunel.json');
        if (!fsSync.existsSync(plik)) return null;
        const j = JSON.parse(fsSync.readFileSync(plik, 'utf8'));
        if (!j?.nazwa || !j?.host) return null;
        if (j.poswiadczenia && !fsSync.existsSync(j.poswiadczenia)) {
            return { blad: `tunel.json wskazuje na plik poświadczeń, którego nie ma: ${j.poswiadczenia}` };
        }
        return { nazwa: String(j.nazwa), host: String(j.host), poswiadczenia: j.poswiadczenia ? String(j.poswiadczenia) : null };
    } catch (e) {
        return { blad: `tunel.json nie do odczytu: ${e.message}` };
    }
}

const stan = {
    stan: 'zatrzymany',   // zatrzymany | instaluje | startuje | dziala | blad
    adres: null,
    od: null,
    blad: null,
    binarka: null,
    tryb: 'quick',        // quick (trycloudflare, adres zmienny) | nazwany (stały adres z konta Suwerena)
    log: [],              // ostatnie linie cloudflared (bez sekretów — quick tunnel ich nie ma)
};
let proces = null;

function dopiszLog(linia) {
    const l = String(linia || '').trim();
    if (!l) return;
    stan.log.push(l.slice(0, 300));
    if (stan.log.length > 40) stan.log.shift();
}

/** Skąd wziąć cloudflared: env → PATH → paczka npm (z pobraniem na żądanie). */
async function znajdzBinarke({ pobierz = false } = {}) {
    if (process.env.OTAKOS_CLOUDFLARED && fsSync.existsSync(process.env.OTAKOS_CLOUDFLARED)) return process.env.OTAKOS_CLOUDFLARED;
    try {
        const gdzie = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['cloudflared'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/).find(Boolean);
        if (gdzie && fsSync.existsSync(gdzie.trim())) return gdzie.trim();
    } catch { /* nie ma na PATH */ }
    const m = await import('cloudflared');
    if (fsSync.existsSync(m.bin)) return m.bin;
    if (!pobierz) return null;
    stan.stan = 'instaluje';
    dopiszLog('Pobieram cloudflared (oficjalne wydanie Cloudflare, github.com/cloudflare/cloudflared)…');
    await m.install(m.bin);
    return m.bin;
}

export async function stanTunelu() {
    const binarka = stan.binarka || (await znajdzBinarke().catch(() => null));
    return { ...stan, binarka, zainstalowany: !!binarka, port: cfg.portMostu };
}

/**
 * Uruchom quick tunnel. Zwraca, gdy adres jest znany (albo po 45 s z błędem).
 * Drugi start przy działającym tunelu oddaje ten sam adres — nie mnożymy procesów.
 */
export async function start() {
    if (proces && stan.stan === 'dziala' && stan.adres) return { ...stan };
    if (proces && stan.stan === 'startuje') throw new Error('Tunel właśnie startuje — poczekaj chwilę.');

    const binarka = await znajdzBinarke({ pobierz: true });
    stan.binarka = binarka;
    stan.stan = 'startuje'; stan.adres = null; stan.blad = null; stan.od = new Date().toISOString(); stan.log = [];

    const nazwany = konfiguracjaNazwanego();
    if (nazwany?.blad) dopiszLog(`nazwany tunel pominięty: ${nazwany.blad}`);
    stan.tryb = nazwany && !nazwany.blad ? 'nazwany' : 'quick';
    const args = stan.tryb === 'nazwany'
        ? ['tunnel', '--no-autoupdate', ...(nazwany.poswiadczenia ? ['--credentials-file', nazwany.poswiadczenia] : []), 'run', '--url', `http://127.0.0.1:${cfg.portMostu}`, nazwany.nazwa]
        : ['tunnel', '--url', `http://127.0.0.1:${cfg.portMostu}`, '--no-autoupdate'];
    if (stan.tryb === 'nazwany') { stan.adres = `https://${nazwany.host}`; dopiszLog(`nazwany tunel „${nazwany.nazwa}" → ${stan.adres}`); }

    const p = spawn(binarka, args, { windowsHide: true });
    proces = p;

    const adres = await new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), 45_000);
        const czytaj = (buf) => {
            for (const linia of String(buf).split(/\r?\n/)) {
                dopiszLog(linia);
                const m = linia.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
                if (m && !stan.adres) { stan.adres = m[0]; clearTimeout(t); resolve(m[0]); }
                // Nazwany tunel nie ogłasza adresu — ogłasza zarejestrowane połączenie.
                if (stan.tryb === 'nazwany' && /Registered tunnel connection|Connection .* registered/i.test(linia)) { clearTimeout(t); resolve(stan.adres); }
            }
        };
        p.stdout.on('data', czytaj);
        p.stderr.on('data', czytaj);   // cloudflared loguje na stderr
        p.on('error', (e) => { dopiszLog(`błąd procesu: ${e.message}`); clearTimeout(t); resolve(null); });
        p.on('exit', (kod) => {
            dopiszLog(`cloudflared zakończył się (kod ${kod})`);
            if (proces === p) { proces = null; stan.stan = stan.adres && kod === 0 ? 'zatrzymany' : 'blad'; if (!stan.adres) stan.blad = stan.blad || `cloudflared zakończył się z kodem ${kod}`; stan.adres = null; }
            clearTimeout(t); resolve(null);
        });
    });

    if (!adres) {
        stan.stan = 'blad';
        stan.blad = stan.blad || (stan.tryb === 'nazwany'
            ? 'Nazwany tunel nie zgłosił połączenia w 45 s — sprawdź nazwę tunelu, plik poświadczeń i wpis DNS (log poniżej).'
            : 'Nie dostałem adresu trycloudflare w 45 s — sprawdź internet i log poniżej.');
        try { p.kill(); } catch { /* już nie żyje */ }
        proces = null;
        throw new Error(stan.blad);
    }
    stan.stan = 'dziala';
    await cfg.szyna?.nadaj?.({ agent: 'Tunel', rodzaj: 'praca', tresc: `Kwantowy Tunel otwarty: ${adres}` }).catch(() => {});
    return { ...stan };
}

export async function stop() {
    if (!proces) { stan.stan = 'zatrzymany'; stan.adres = null; return { ...stan }; }
    const p = proces; proces = null;
    try { p.kill(); } catch { /* trudno */ }
    stan.stan = 'zatrzymany'; stan.adres = null; stan.blad = null;
    await cfg.szyna?.nadaj?.({ agent: 'Tunel', rodzaj: 'info', tresc: 'Kwantowy Tunel zamknięty.' }).catch(() => {});
    return { ...stan };
}

// Most gaśnie → tunel też, żeby nie został sierocy proces wskazujący na martwy port.
for (const s of ['SIGINT', 'SIGTERM', 'exit']) process.on(s, () => { try { proces?.kill(); } catch { /* — */ } });

export default { skonfiguruj, stanTunelu, start, stop };
