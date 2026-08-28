/**
 * 🔌 McpStdioClient — pierwszy PRAWDZIWY klient MCP w Katedrze.
 *
 * Do tej pory „skille MCP" w Skillboardzie były albo handlerami wpisanymi wprost
 * w most (filesystem, terminal, puls), albo kartami, które nic nie robiły. Most
 * nie umiał mówić protokołem MCP — sprawdzone: w wiesio-bridge.js nie było ani
 * jednego `jsonrpc` w stronę serwera MCP.
 *
 * Ta klasa to nadrabia: uruchamia serwer MCP jako proces potomny i rozmawia z nim
 * po JSON-RPC 2.0 przez stdio, z ramkowaniem po znaku nowej linii.
 *
 * ŚWIADOME OGRANICZENIA (mówimy je wprost, zamiast udawać pełną implementację):
 *  · Ramkowanie liniowe, nie nagłówki Content-Length. Serwery, które piszą
 *    surowe ramki LSP, nie zadziałają — graphify pisze liniami, sprawdzone.
 *  · Bez powiadomień serwer→klient (notifications) i bez samplingu.
 *  · Jeden proces na skill, trzymany przy życiu. Padnie — wstaje przy następnym
 *    wywołaniu, a błąd idzie do Suwerena, nie do kosza.
 */
import { spawn } from 'child_process';

const CZAS_STARTU = 60000;      // zimny start serwera MCP potrafi trwać
const CZAS_WYWOLANIA = 180000;  // zapytania do grafu bywają ciężkie

class Polaczenie {
    constructor(exe, args = [], opcje = {}) {
        this.exe = exe;
        this.args = args;
        this.opcje = opcje;
        this.proc = null;
        this.bufor = '';
        this.oczekujace = new Map();
        this.nastepneId = 1;
        this.gotowe = null;
        this.narzedzia = null;
    }

    _wyslij(obj) {
        this.proc.stdin.write(JSON.stringify(obj) + '\n');
    }

    _zapytaj(method, params, timeout) {
        const id = this.nastepneId++;
        return new Promise((resolve, reject) => {
            const zegar = setTimeout(() => {
                this.oczekujace.delete(id);
                reject(new Error(`Serwer MCP nie odpowiedział na "${method}" w ${timeout / 1000}s.`));
            }, timeout);
            this.oczekujace.set(id, { resolve, reject, zegar });
            try { this._wyslij({ jsonrpc: '2.0', id, method, params }); }
            catch (e) { clearTimeout(zegar); this.oczekujace.delete(id); reject(e); }
        });
    }

    _obsluzLinie(linia) {
        let m;
        try { m = JSON.parse(linia); } catch { return; }   // serwery lubią plotkować po stdout
        if (m.id == null) return;                           // powiadomienie — nie obsługujemy
        const czeka = this.oczekujace.get(m.id);
        if (!czeka) return;
        clearTimeout(czeka.zegar);
        this.oczekujace.delete(m.id);
        if (m.error) czeka.reject(new Error(m.error.message || 'Błąd serwera MCP'));
        else czeka.resolve(m.result);
    }

    _padl(powod) {
        for (const [, czeka] of this.oczekujace) {
            clearTimeout(czeka.zegar);
            czeka.reject(new Error(powod));
        }
        this.oczekujace.clear();
        this.proc = null;
        this.gotowe = null;
        this.narzedzia = null;
    }

    async polacz() {
        if (this.gotowe) return this.gotowe;
        this.gotowe = (async () => {
            this.proc = spawn(this.exe, this.args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true,
                ...this.opcje,
            });
            this.proc.on('error', (e) => this._padl(`Serwer MCP nie wstał: ${e.message}`));
            this.proc.on('exit', (kod) => this._padl(`Serwer MCP zakończył się (kod ${kod}).`));
            this.proc.stdout.on('data', (d) => {
                this.bufor += d.toString();
                let i;
                while ((i = this.bufor.indexOf('\n')) >= 0) {
                    const linia = this.bufor.slice(0, i).trim();
                    this.bufor = this.bufor.slice(i + 1);
                    if (linia) this._obsluzLinie(linia);
                }
            });
            // stderr zbieramy do diagnozy — graphify wypisywał tam cały traceback,
            // gdy brakowało pakietu `mcp`. Bez tego błąd byłby niemy.
            this.ostatniStderr = '';
            this.proc.stderr.on('data', (d) => {
                this.ostatniStderr = (this.ostatniStderr + d.toString()).slice(-2000);
            });

            const info = await this._zapytaj('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'katedra-otakos', version: '0.00G' },
            }, CZAS_STARTU);
            this._wyslij({ jsonrpc: '2.0', method: 'notifications/initialized' });
            return info;
        })().catch((e) => {
            this.gotowe = null;
            const ogon = this.ostatniStderr ? ` — serwer powiedział: ${this.ostatniStderr.trim().split('\n').pop()}` : '';
            throw new Error(e.message + ogon);
        });
        return this.gotowe;
    }

    async listaNarzedzi() {
        await this.polacz();
        if (this.narzedzia) return this.narzedzia;
        const r = await this._zapytaj('tools/list', {}, CZAS_STARTU);
        this.narzedzia = r?.tools || [];
        return this.narzedzia;
    }

    async wywolaj(nazwa, argumenty) {
        await this.polacz();
        return this._zapytaj('tools/call', { name: nazwa, arguments: argumenty || {} }, CZAS_WYWOLANIA);
    }

    zamknij() {
        if (this.proc) { try { this.proc.kill(); } catch { /* już nie żyje */ } }
        this._padl('Zamknięte na żądanie.');
    }
}

const polaczenia = new Map();

/** Pobierz (lub utwórz) połączenie do serwera MCP o danym kluczu. */
export function mcpPolaczenie(klucz, exe, args = [], opcje = {}) {
    if (!polaczenia.has(klucz)) polaczenia.set(klucz, new Polaczenie(exe, args, opcje));
    return polaczenia.get(klucz);
}

/** Zamknij wszystkie — przydaje się przy zamykaniu mostu. */
export function mcpZamknijWszystkie() {
    for (const [, p] of polaczenia) p.zamknij();
    polaczenia.clear();
}

export default { mcpPolaczenie, mcpZamknijWszystkie };
