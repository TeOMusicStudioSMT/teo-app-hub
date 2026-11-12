/**
 * 💍 peaqRingService.ts — Integracja Pierścienia Suwerena (PEAQ PSR 100-SILVER 10)
 *
 * Bezpośrednie połączenie WebBluetooth (`navigator.bluetooth`) w przeglądarce
 * z inspekcją GATT na żywo, obsługą protokołu OEM 0xFEEA (0xFEE2, 0xFEE3),
 * watchdogiem Keep-Alive (8s przeciw uśpieniu radia po 18s),
 * cichym Auto-Reconnectem w tle (maks. 3 próby z odstępem 3s)
 * oraz Architekturą Przekaźnika Stołu Mobilnego (Telefon -> Katedra).
 */

const MOST_URL = 'http://127.0.0.1:3001';

export interface GattCharacteristicInfo {
    uuid: string;
    properties: {
        read?: boolean;
        write?: boolean;
        notify?: boolean;
        indicate?: boolean;
    };
}

export interface GattServiceInfo {
    uuid: string;
    characteristics: GattCharacteristicInfo[];
}

export interface RawPacketInfo {
    time: string;
    source: string;
    hex: string;
    length: number;
}

export interface PeaqRingState {
    supported: boolean;
    connected: boolean;
    isSimulated: boolean;
    isRelayed: boolean;
    source: 'BEZPOŚREDNIE_BLE' | 'STÓŁ_MOBILNY' | 'SYMULACJA' | 'BRAK';
    statusText: string;
    deviceName: string;
    ringModel: string;
    ringSize: number;
    bpm: number;
    spo2: number;
    battery: number;
    coherence: number;
    level: string;
    tempo: number;
    manaBonus: number;
    rrIntervals: number[];
    services: GattServiceInfo[];
    gattLogs: string[];
    rawPackets: RawPacketInfo[];
    lastUpdate: string | null;
    keepAliveActive: boolean;
    filterOnlyPeaq: boolean;
    autoReconnectCount: number;
    bridgePollingActive: boolean;
}

// Pełna pula UUID dla układów Smart Ring (w tym PEAQ PSR 100 i popularnych OEM)
export const PEAQ_UUIDS = {
    // Standard Bluetooth SIG
    HEART_RATE_SERVICE: '0000180d-0000-1000-8000-00805f9b34fb',
    HEART_RATE_MEASUREMENT: '00002a37-0000-1000-8000-00805f9b34fb',
    BATTERY_SERVICE: '0000180f-0000-1000-8000-00805f9b34fb',
    BATTERY_LEVEL: '00002a19-0000-1000-8000-00805f9b34fb',
    DEVICE_INFO_SERVICE: '0000180a-0000-1000-8000-00805f9b34fb',

    // Nordic UART & Custom Smart Ring
    NORDIC_UART_SERVICE: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    NORDIC_RX: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
    NORDIC_TX: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
    NORDIC_FFF0: '6e40fff0-b5a3-f393-e0a9-e50e24dcca9e',

    // PEAQ PSR 100 OEM Smart Ring Services & Characteristics
    OEM_FEEA: '0000feea-0000-1000-8000-00805f9b34fb',
    OEM_FEE1: '0000fee1-0000-1000-8000-00805f9b34fb',
    OEM_FEE2: '0000fee2-0000-1000-8000-00805f9b34fb', // [r:N w:Y n:Y] - Komendy & Odpowiedzi
    OEM_FEE3: '0000fee3-0000-1000-8000-00805f9b34fb', // [r:Y w:Y n:Y] - Telemetria & Pomiary
    OEM_FFE0: '0000ffe0-0000-1000-8000-00805f9b34fb',
    OEM_DE00: '0000de00-0000-1000-8000-00805f9b34fb',
};

class PeaqRingService {
    private state: PeaqRingState = {
        supported: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
        connected: false,
        isSimulated: false,
        isRelayed: false,
        source: 'BRAK',
        statusText: 'GOTOWY DO PAROWANIA',
        deviceName: 'PEAQ PSR 100-SILVER 10',
        ringModel: 'PSR 100-SILVER 10',
        ringSize: 10,
        bpm: 0,
        spo2: 0,
        battery: 100,
        coherence: 0,
        level: 'OCZEKIWANIE',
        tempo: 72,
        manaBonus: 1.0,
        rrIntervals: [],
        services: [],
        gattLogs: [],
        rawPackets: [],
        lastUpdate: null,
        keepAliveActive: false,
        filterOnlyPeaq: true,
        autoReconnectCount: 0,
        bridgePollingActive: false,
    };

    private listeners: Set<(state: PeaqRingState) => void> = new Set();
    private bluetoothDevice: any = null;
    private gattServer: any = null;
    private simInterval: any = null;
    private syncThrottleTimer: any = null;
    private keepAliveTimer: any = null;
    private autoReconnectTimer: any = null;
    private bridgePollingTimer: any = null;

    // Uchwyty do kluczowych charakterystyk
    private batteryChar: any = null;
    private heartRateChar: any = null;
    private fee2Char: any = null;
    private fee3Char: any = null;

    // Flagi sterujące
    private userDisconnected: boolean = false;
    private isReconnecting: boolean = false;

    constructor() {
        this.log('✨ [PEAQ Ring] Inicjalizacja modułu biometrii 0.00G.');
        // W tle startujemy nasłuch mostu na wypadek, gdyby Suweren parował pierścień na telefonie!
        this.startBridgePolling();
    }

    public getState(): PeaqRingState {
        return { ...this.state };
    }

    public setFilterMode(onlyPeaq: boolean) {
        this.state.filterOnlyPeaq = onlyPeaq;
        this.emit();
    }

    public subscribe(listener: (state: PeaqRingState) => void): () => void {
        this.listeners.add(listener);
        listener(this.getState());
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emit() {
        const snapshot = this.getState();
        this.listeners.forEach((fn) => {
            try {
                fn(snapshot);
            } catch (err) {
                console.error('[PEAQ Ring] Błąd listenera:', err);
            }
        });
    }

    private log(msg: string) {
        const time = new Date().toLocaleTimeString();
        const entry = `[${time}] ${msg}`;
        console.log(`[PEAQ] ${msg}`);
        this.state.gattLogs = [entry, ...this.state.gattLogs.slice(0, 59)];
        this.emit();
    }

    /**
     * Oblicza koherencję 0.00G w oparciu o dystans od złotego rytmu 68 BPM
     */
    private calculateCoherence(bpm: number, spo2: number = 98) {
        if (!bpm || bpm <= 30) {
            return { coherence: 0, level: 'BRAK SYGNAŁU', tempo: 72, manaBonus: 1.0 };
        }
        const delta = Math.abs(bpm - 68);
        let k = 1.0 - delta / 50.0;
        if (k < 0.2) k = 0.2;
        if (k > 1.0) k = 1.0;
        if (spo2 >= 98) k = Math.min(1.0, k + 0.05);

        k = +(k.toFixed(3));
        let level = 'ADAPTACJA';
        if (k >= 0.88) level = 'SZCZYTOWA 0.00G';
        else if (k >= 0.72) level = 'HARMONIJNA';
        else if (k >= 0.50) level = 'SPOKOJNA';
        else level = 'WZBURZENIE';

        const manaBonus = +(1.0 + k * 0.5).toFixed(2);
        const tempo = Math.min(140, Math.max(50, Math.round(bpm)));

        return { coherence: k, level, tempo, manaBonus };
    }

    /**
     * Synchronizacja z mostem wiesio-bridge
     */
    private syncWithBridge(bpm: number, spo2: number, battery: number) {
        if (this.syncThrottleTimer) return;
        this.syncThrottleTimer = setTimeout(() => {
            this.syncThrottleTimer = null;
        }, 1200);

        const payload = {
            bpm,
            spo2,
            battery,
            deviceName: this.state.deviceName,
            ringSize: this.state.ringSize,
            source: 'BEZPOŚREDNIE_BLE',
        };

        fetch(`${MOST_URL}/api/biometrics/pulse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
            .then((r) => r.json())
            .then((d) => {
                if (d?.biometria) {
                    this.state.coherence = d.biometria.koherencja;
                    this.state.level = d.biometria.poziom;
                    this.state.tempo = d.biometria.tempoMuzyczne;
                    this.state.manaBonus = d.biometria.manaBonus;
                    this.emit();
                }
            })
            .catch(() => {});
    }

    /**
     * KROK 3: Odbiór danych ze Stołu Mobilnego (Bridge Polling / Mobile Relay)
     */
    public startBridgePolling() {
        if (this.bridgePollingTimer) return;
        this.state.bridgePollingActive = true;
        this.emit();

        const checkBridge = async () => {
            // Jeśli PC ma aktywne bezpośrednie BLE lub symulację, nie nadpisujemy
            if (this.state.connected && !this.state.isRelayed && !this.state.isSimulated && this.gattServer?.connected) {
                return;
            }

            try {
                const res = await fetch(`${MOST_URL}/api/biometrics/status`);
                const d = await res.json();
                if (d?.success && d?.biometria) {
                    const b = d.biometria;
                    const isFromMobile = b.source === 'STÓŁ_MOBILNY';

                    if (b.online && (isFromMobile || b.bpm > 0)) {
                        const wasNotRelayed = !this.state.isRelayed;
                        this.state.connected = true;
                        this.state.isRelayed = isFromMobile;
                        this.state.source = isFromMobile ? 'STÓŁ_MOBILNY' : 'BEZPOŚREDNIE_BLE';
                        this.state.bpm = b.bpm;
                        this.state.spo2 = b.spo2;
                        this.state.battery = b.battery;
                        this.state.coherence = b.koherencja;
                        this.state.level = b.poziom;
                        this.state.tempo = b.tempoMuzyczne;
                        this.state.manaBonus = b.manaBonus;
                        this.state.lastUpdate = b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

                        if (isFromMobile) {
                            this.state.statusText = '📱 POŁĄCZONY PRZEZ STÓŁ MOBILNY (TELEFON -> KATEDRA)';
                            if (wasNotRelayed) {
                                this.log(`📱 [Stół Mobilny Relay] Otrzymano odczyt z telefonu: ${b.bpm} BPM | Koherencja ${(b.koherencja * 100).toFixed(0)}%`);
                            }
                        } else if (!this.gattServer?.connected && !this.state.isSimulated) {
                            this.state.statusText = 'ODBIÓR Z MOSTU KATEDRY (0.00G)';
                        }
                        this.emit();
                    } else if (!b.online && this.state.isRelayed) {
                        this.state.isRelayed = false;
                        this.state.connected = false;
                        this.state.statusText = 'Pierścień połączony z telefonem (Stół Mobilny) lub w uśpieniu';
                        this.emit();
                    }
                }
            } catch {
                // cicho
            }
        };

        void checkBridge();
        this.bridgePollingTimer = setInterval(checkBridge, 2500);
    }

    public stopBridgePolling() {
        if (this.bridgePollingTimer) {
            clearInterval(this.bridgePollingTimer);
            this.bridgePollingTimer = null;
        }
        this.state.bridgePollingActive = false;
        this.emit();
    }

    /**
     * KROK 1 & 2: Sparuj Pierścień Suwerena (PEAQ BLE) przez WebBluetooth API
     */
    public async pairRing(onlyPeaqFilter?: boolean): Promise<boolean> {
        if (this.state.isSimulated) {
            this.stopSimulation();
        }

        if (!this.state.supported) {
            this.log('❌ WebBluetooth niedostępne w tej przeglądarce (wymagane Chrome/Edge na https lub localhost).');
            return false;
        }

        const useFilter = onlyPeaqFilter !== undefined ? onlyPeaqFilter : this.state.filterOnlyPeaq;
        this.state.filterOnlyPeaq = useFilter;
        this.userDisconnected = false;
        this.state.autoReconnectCount = 0;

        try {
            this.log(`💍 Otwieram okno wyboru urządzenia Bluetooth (${useFilter ? 'FILTR: PSR / PEAQ' : 'WSZYSTKIE URZĄDZENIA'})...`);
            this.state.statusText = 'SZUKAM PIERŚCIENIA...';
            this.emit();

            // Pełna pula UUID układów Smart Ring
            const optionalServices: any[] = [
                'heart_rate',
                'battery_service',
                'device_information',
                PEAQ_UUIDS.HEART_RATE_SERVICE,
                PEAQ_UUIDS.BATTERY_SERVICE,
                PEAQ_UUIDS.DEVICE_INFO_SERVICE,
                PEAQ_UUIDS.NORDIC_UART_SERVICE,
                PEAQ_UUIDS.NORDIC_FFF0,
                PEAQ_UUIDS.OEM_FEEA,
                PEAQ_UUIDS.OEM_FEE1,
                PEAQ_UUIDS.OEM_FEE2,
                PEAQ_UUIDS.OEM_FEE3,
                PEAQ_UUIDS.OEM_FFE0,
                PEAQ_UUIDS.OEM_DE00,
            ];

            const nav = navigator as any;
            let options: any;

            if (useFilter) {
                options = {
                    filters: [
                        { namePrefix: 'PSR' },
                        { namePrefix: 'PEAQ' },
                        { namePrefix: 'psr' },
                        { namePrefix: 'peaq' },
                    ],
                    optionalServices,
                };
            } else {
                options = {
                    acceptAllDevices: true,
                    optionalServices,
                };
            }

            const device = await nav.bluetooth.requestDevice(options);

            this.bluetoothDevice = device;
            this.state.deviceName = device.name || 'PEAQ Smart Ring PSR 100';
            this.log(`✅ Wybrano urządzenie: ${this.state.deviceName} (${device.id})`);

            device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection();
            });

            return await this.connectGatt();
        } catch (err: any) {
            this.log(`❌ Błąd połączenia BLE: ${err.message || err}`);
            this.state.statusText = 'BŁĄD PAROWANIA';
            this.emit();
            return false;
        }
    }

    /**
     * Właściwe połączenie GATT i inicjalizacja usług
     */
    private async connectGatt(): Promise<boolean> {
        if (!this.bluetoothDevice) return false;

        try {
            this.log('⚡ Łączenie z serwerem GATT pierścienia PEAQ...');
            const server = await this.bluetoothDevice.gatt.connect();
            this.gattServer = server;

            this.state.connected = true;
            this.state.isRelayed = false;
            this.state.source = 'BEZPOŚREDNIE_BLE';
            this.state.statusText = 'POŁĄCZONY — ROZMIAR 10';
            this.state.autoReconnectCount = 0;
            this.log('🎉 Serwer GATT połączony! Status: POŁĄCZONY — ROZMIAR 10.');
            this.emit();

            // Inspekcja GATT na żywo
            await this.inspectGatt(server);

            // Włączenie watchdoga Keep-Alive (8s)
            this.startKeepAlive();

            // Wysłanie impulsu aktywacyjnego pomiar
            await this.sendActivationImpulse();

            return true;
        } catch (err: any) {
            this.log(`❌ Błąd łączenia z GATT: ${err.message}`);
            return false;
        }
    }

    /**
     * KROK 1: Naprawa pętli Auto-Reconnect (maksymalnie 3 próby z odstępem 3s)
     */
    private handleDisconnection() {
        this.stopKeepAlive();

        if (this.userDisconnected) {
            this.log('🛑 Pierścień rozłączony na żądanie Suwerena.');
            this.state.connected = false;
            this.state.statusText = 'ROZŁĄCZONY';
            this.emit();
            return;
        }

        // Samoczynne zerwanie sesji (np. timeout 18s lub pierścień zajęty przez telefon)
        this.log('⚠️ Wykryto rozłączenie BLE.');
        this.state.connected = false;
        this.emit();

        // Uruchomienie ograniczonego auto-reconnectu (maks. 3 próby)
        this.scheduleAutoReconnect();
    }

    /**
     * Harmonogram cichego wznawiania połączenia w tle (maks. 3 próby, co 3s)
     */
    private scheduleAutoReconnect() {
        if (this.autoReconnectTimer) {
            clearTimeout(this.autoReconnectTimer);
        }

        if (this.state.autoReconnectCount >= 3) {
            this.log('📱 Zatrzymano pętlę Auto-Reconnect po 3 próbach. Pierścień zajęty przez telefon (Stół Mobilny) lub w uśpieniu.');
            this.state.statusText = 'Pierścień połączony z telefonem (Stół Mobilny) lub w uśpieniu';
            this.state.autoReconnectCount = 0;
            this.startBridgePolling();
            this.emit();
            return;
        }

        this.autoReconnectTimer = setTimeout(async () => {
            if (this.userDisconnected || !this.bluetoothDevice || this.isReconnecting) return;
            this.isReconnecting = true;

            try {
                this.state.autoReconnectCount++;
                this.log(`🔄 [Auto-Reconnect] Cicha próba #${this.state.autoReconnectCount}/3 z ${this.state.deviceName}...`);
                this.state.statusText = `AUTO-RECONNECT (${this.state.autoReconnectCount}/3)...`;
                this.emit();

                const server = await this.bluetoothDevice.gatt.connect();
                this.gattServer = server;

                this.state.connected = true;
                this.state.isRelayed = false;
                this.state.source = 'BEZPOŚREDNIE_BLE';
                this.state.statusText = 'POŁĄCZONY — ROZMIAR 10';
                this.state.autoReconnectCount = 0;
                this.log('🎉 [Auto-Reconnect] Sesja BLE wznowiona automatycznie!');
                this.emit();

                await this.inspectGatt(server);
                this.startKeepAlive();
                await this.sendActivationImpulse();
            } catch (err: any) {
                this.log(`⏳ [Auto-Reconnect] Próba ${this.state.autoReconnectCount}/3 nie powiodła się (${err.message}).`);
                if (this.state.autoReconnectCount < 3) {
                    this.scheduleAutoReconnect();
                } else {
                    this.log('📱 Zakończono ciche próby. Przełączam na nasłuch Mostu Katedry (Stół Mobilny).');
                    this.state.statusText = 'Pierścień połączony z telefonem (Stół Mobilny) lub w uśpieniu';
                    this.startBridgePolling();
                    this.emit();
                }
            } finally {
                this.isReconnecting = false;
            }
        }, 3000); // odstęp 3 sekundy
    }

    /**
     * Watchdog Keep-Alive (co 8 sekund)
     */
    private startKeepAlive() {
        this.stopKeepAlive();
        this.state.keepAliveActive = true;
        this.emit();

        this.keepAliveTimer = setInterval(async () => {
            if (!this.state.connected || !this.gattServer?.connected) return;

            try {
                // 1. Odpytanie poziomu baterii
                if (this.batteryChar && this.batteryChar.properties?.read) {
                    const val = await this.batteryChar.readValue().catch(() => null);
                    if (val && val.byteLength > 0) {
                        const pct = val.getUint8(0);
                        if (pct > 0 && pct <= 100 && pct !== this.state.battery) {
                            this.state.battery = pct;
                            this.emit();
                        }
                    }
                }

                // 2. Odpytanie OEM fee3
                if (this.fee3Char && this.fee3Char.properties?.read) {
                    const val = await this.fee3Char.readValue().catch(() => null);
                    if (val && val.byteLength > 0) {
                        this.handleOemPacket('FEE3-KEEP-ALIVE', val);
                    }
                }

                // 3. Heartbeat impuls na fee2
                if (this.fee2Char && (this.fee2Char.properties?.write || this.fee2Char.properties?.writeWithoutResponse)) {
                    const pingPacket = new Uint8Array([0xaa, 0x00, 0x00, 0xaa]);
                    await this.writeToChar(this.fee2Char, pingPacket).catch(() => {});
                }

                this.log('💓 [Keep-Alive 8s] Impuls podtrzymania sesji wysłany do PSR 100.');
            } catch (err: any) {
                console.warn('[Keep-Alive] błąd odpytania:', err.message);
            }
        }, 8000);
    }

    private stopKeepAlive() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
        this.state.keepAliveActive = false;
    }

    /**
     * Bezpieczny zapis do charakterystyki
     */
    private async writeToChar(char: any, bytes: Uint8Array): Promise<boolean> {
        try {
            if (char.writeValueWithoutResponse) {
                await char.writeValueWithoutResponse(bytes);
                return true;
            } else if (char.writeValue) {
                await char.writeValue(bytes);
                return true;
            }
            return false;
        } catch {
            try {
                if (char.writeValue) {
                    await char.writeValue(bytes);
                    return true;
                }
            } catch {
                return false;
            }
            return false;
        }
    }

    /**
     * Wysłanie impulsu aktywacyjnego pomiar na 0000fee2 / 0000fee3
     */
    public async sendActivationImpulse(): Promise<void> {
        this.log('⚡ [Inicjalizacja OEM] Wysyłam komendy aktywacji pomiaru tętna...');

        const commands = [
            new Uint8Array([0xaa, 0x14, 0x01, 0xbf]),
            new Uint8Array([0xaa, 0x01, 0x01, 0x00]),
            new Uint8Array([0x01, 0x00]),
        ];

        let targetChar = this.fee2Char || this.fee3Char;
        if (targetChar) {
            for (const cmd of commands) {
                const hex = Array.from(cmd).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
                const ok = await this.writeToChar(targetChar, cmd);
                if (ok) {
                    this.log(`📤 [OEM Wysłano] Komenda aktywacji: ${hex}`);
                }
            }
        }

        if (this.fee3Char && this.fee3Char.properties?.read) {
            try {
                const initVal = await this.fee3Char.readValue();
                if (initVal && initVal.byteLength > 0) {
                    this.handleOemPacket('FEE3-INIT', initVal);
                }
            } catch (err: any) {
                this.log(`⚠️ Odczyt fee3: ${err.message}`);
            }
        }
    }

    /**
     * Inspektor GATT na żywo — skanowanie serwisów i charakterystyk
     */
    private async inspectGatt(server: any) {
        this.log('🔍 Rozpoczynam pełną inspekcję GATT na żywo...');
        const detectedServices: GattServiceInfo[] = [];

        this.batteryChar = null;
        this.heartRateChar = null;
        this.fee2Char = null;
        this.fee3Char = null;

        try {
            const services = await server.getPrimaryServices().catch(() => []);
            this.log(`📊 Znaleziono ${services.length} usług głównych.`);

            for (const s of services) {
                const sUuid = s.uuid.toLowerCase();
                this.log(`🔹 Serwis GATT: ${sUuid}`);
                const charList: GattCharacteristicInfo[] = [];

                try {
                    const characteristics = await s.getCharacteristics();
                    for (const c of characteristics) {
                        const cUuid = c.uuid.toLowerCase();
                        const props = {
                            read: c.properties.read,
                            write: c.properties.write || c.properties.writeWithoutResponse,
                            notify: c.properties.notify,
                            indicate: c.properties.indicate,
                        };
                        charList.push({ uuid: cUuid, properties: props });
                        this.log(`   🔸 Charakterystyka: ${cUuid} [R:${props.read ? '+' : '-'} W:${props.write ? '+' : '-'} N:${props.notify ? '+' : '-'}]`);

                        // 1. Standard Heart Rate Measurement (0x2a37)
                        if (cUuid.includes('2a37') || sUuid.includes('180d')) {
                            this.heartRateChar = c;
                            if (props.notify) {
                                await this.subscribeHeartRate(c);
                            }
                        }

                        // 2. Standard Battery Level (0x2a19)
                        if (cUuid.includes('2a19') || sUuid.includes('180f')) {
                            this.batteryChar = c;
                            await this.readBattery(c);
                            if (props.notify) {
                                await this.subscribeBattery(c);
                            }
                        }

                        // 3. OEM PEAQ PSR 100 — 0000fee2 (Write + Notify)
                        if (cUuid.includes('fee2')) {
                            this.fee2Char = c;
                            if (props.notify) {
                                await this.subscribeOemNotify(c, '0000fee2');
                            }
                        }

                        // 4. OEM PEAQ PSR 100 — 0000fee3 (Read + Write + Notify)
                        if (cUuid.includes('fee3')) {
                            this.fee3Char = c;
                            if (props.notify) {
                                await this.subscribeOemNotify(c, '0000fee3');
                            }
                        }
                    }
                } catch (cErr: any) {
                    this.log(`   ⚠️ Nie można odczytać charakterystyk serwisu ${sUuid}: ${cErr.message}`);
                }

                detectedServices.push({ uuid: sUuid, characteristics: charList });
            }

            this.state.services = detectedServices;
            this.emit();
        } catch (err: any) {
            this.log(`⚠️ Błąd inspekcji GATT: ${err.message}`);
        }
    }

    /**
     * Subskrypcja notyfikacji na charakterystykach OEM (fee2 / fee3)
     */
    private async subscribeOemNotify(char: any, label: string) {
        try {
            this.log(`📡 Włączam startNotifications() dla ${label}...`);
            await char.startNotifications();
            char.addEventListener('characteristicvaluechanged', (event: any) => {
                const value = event.target.value as DataView;
                if (!value || value.byteLength === 0) return;
                this.handleOemPacket(label, value);
            });
            this.log(`✅ Subskrypcja aktywna dla ${label}`);
        } catch (err: any) {
            this.log(`⚠️ Błąd subskrypcji ${label}: ${err.message}`);
        }
    }

    /**
     * Parser pakietów HEX z 0000fee2 / 0000fee3
     */
    private handleOemPacket(source: string, dataView: DataView) {
        const len = dataView.byteLength;
        const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, len);
        const hex = Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');

        const now = new Date().toLocaleTimeString();
        const packetInfo: RawPacketInfo = {
            time: now,
            source,
            hex,
            length: len,
        };

        this.state.rawPackets = [packetInfo, ...this.state.rawPackets.slice(0, 29)];
        this.log(`📦 [${source}] HEX: ${hex} (${len} B)`);

        let extractedBpm = 0;
        let extractedSpo2 = 0;

        if (bytes[0] === 0xaa || bytes[0] === 0x55) {
            for (let i = 1; i < len; i++) {
                const val = bytes[i];
                if (val >= 45 && val <= 190 && extractedBpm === 0) {
                    extractedBpm = val;
                } else if (val >= 92 && val <= 100 && extractedSpo2 === 0) {
                    extractedSpo2 = val;
                }
            }
        } else {
            for (let i = 0; i < len; i++) {
                const val = bytes[i];
                if (val >= 50 && val <= 185 && extractedBpm === 0) {
                    extractedBpm = val;
                } else if (val >= 93 && val <= 100 && extractedSpo2 === 0) {
                    extractedSpo2 = val;
                }
            }
        }

        if (extractedBpm >= 45 && extractedBpm <= 190) {
            const spo2 = extractedSpo2 || this.state.spo2 || 98;
            const coh = this.calculateCoherence(extractedBpm, spo2);

            this.state.bpm = extractedBpm;
            this.state.spo2 = spo2;
            this.state.coherence = coh.coherence;
            this.state.level = coh.level;
            this.state.tempo = coh.tempo;
            this.state.manaBonus = coh.manaBonus;
            this.state.lastUpdate = now;

            this.log(`💓 [Puls z OEM ${source}] ${extractedBpm} BPM | SpO2: ${spo2}% | Koherencja: ${(coh.coherence * 100).toFixed(0)}%`);
            this.syncWithBridge(extractedBpm, spo2, this.state.battery);
            this.emit();
        } else {
            this.emit();
        }
    }

    /**
     * Subskrypcja pulsu serca wg standardu Bluetooth SIG GATT (0x2a37)
     */
    private async subscribeHeartRate(char: any) {
        try {
            this.log('💓 Subskrybuję standardowe tętno 0x2A37 (startNotifications)...');
            await char.startNotifications();
            char.addEventListener('characteristicvaluechanged', (event: any) => {
                const value = event.target.value as DataView;
                if (!value || value.byteLength === 0) return;

                const flags = value.getUint8(0);
                const rate16Bits = (flags & 0x01) !== 0;
                let bpm = 0;
                let offset = 1;

                if (rate16Bits) {
                    bpm = value.getUint16(offset, true);
                    offset += 2;
                } else {
                    bpm = value.getUint8(offset);
                    offset += 1;
                }

                const rrIntervals: number[] = [];
                const rrPresent = (flags & 0x10) !== 0;
                if (rrPresent) {
                    while (offset + 1 < value.byteLength) {
                        const rrRaw = value.getUint16(offset, true);
                        const rrMs = Math.round((rrRaw / 1024) * 1000);
                        rrIntervals.push(rrMs);
                        offset += 2;
                    }
                }

                const spo2 = this.state.spo2 || 98;
                const coh = this.calculateCoherence(bpm, spo2);

                this.state.bpm = bpm;
                this.state.spo2 = spo2;
                this.state.rrIntervals = rrIntervals;
                this.state.coherence = coh.coherence;
                this.state.level = coh.level;
                this.state.tempo = coh.tempo;
                this.state.manaBonus = coh.manaBonus;
                this.state.lastUpdate = new Date().toLocaleTimeString();

                this.log(`💓 Puls ze standardu HRM: ${bpm} BPM | Koherencja: ${(coh.coherence * 100).toFixed(0)}%`);
                this.syncWithBridge(bpm, spo2, this.state.battery);
                this.emit();
            });
            this.log('✅ Subskrypcja 0x2A37 aktywna.');
        } catch (err: any) {
            this.log(`⚠️ Błąd subskrypcji tętna 0x2A37: ${err.message}`);
        }
    }

    /**
     * Odczyt poziomu baterii (0x2a19)
     */
    private async readBattery(char: any) {
        try {
            const val = await char.readValue();
            const pct = val.getUint8(0);
            this.state.battery = pct;
            this.log(`🔋 Poziom baterii pierścienia: ${pct}%`);
            this.emit();
        } catch (err: any) {
            this.log(`⚠️ Błąd odczytu baterii: ${err.message}`);
        }
    }

    /**
     * Subskrypcja zmian baterii (0x2a19)
     */
    private async subscribeBattery(char: any) {
        try {
            await char.startNotifications();
            char.addEventListener('characteristicvaluechanged', (e: any) => {
                const pct = e.target.value.getUint8(0);
                this.state.battery = pct;
                this.log(`🔋 Zmiana baterii pierścienia: ${pct}%`);
                this.emit();
            });
        } catch {}
    }

    /**
     * Tryb Symulacji / Kalibracji Rezonansu (Fallback)
     */
    public startSimulation() {
        if (this.simInterval) {
            clearInterval(this.simInterval);
        }

        this.disconnectDevice();
        this.state.isSimulated = true;
        this.state.connected = true;
        this.state.isRelayed = false;
        this.state.source = 'SYMULACJA';
        this.state.deviceName = 'PEAQ Smart Ring (PSR 100-SILVER 10) [Symulacja]';
        this.state.statusText = 'KALIBRACJA REZONANSU — ROZMIAR 10';
        this.state.battery = 98;
        this.state.spo2 = 99;

        this.log('⚗️ Aktywowano Tryb Symulacji / Kalibracji Rezonansu (0.00G Fallback).');

        let tick = 0;
        this.simInterval = setInterval(() => {
            tick++;
            const sinus = Math.sin(tick * 0.2);
            const microJitter = (Math.random() - 0.5) * 3;
            const simBpm = Math.round(68 + sinus * 5 + microJitter);
            const simSpo2 = 98 + (tick % 2 === 0 ? 1 : 0);

            const coh = this.calculateCoherence(simBpm, simSpo2);

            this.state.bpm = simBpm;
            this.state.spo2 = simSpo2;
            this.state.coherence = coh.coherence;
            this.state.level = coh.level;
            this.state.tempo = coh.tempo;
            this.state.manaBonus = coh.manaBonus;
            this.state.lastUpdate = new Date().toLocaleTimeString();

            if (tick % 5 === 0) {
                this.log(`💓 [Rezonans 0.00G] ${simBpm} BPM | Koherencja: ${(coh.coherence * 100).toFixed(0)}%`);
            }

            this.syncWithBridge(simBpm, simSpo2, this.state.battery);
            this.emit();
        }, 2000);

        this.emit();
    }

    public stopSimulation() {
        if (this.simInterval) {
            clearInterval(this.simInterval);
            this.simInterval = null;
        }
        this.state.isSimulated = false;
        if (!this.bluetoothDevice && !this.state.isRelayed) {
            this.state.connected = false;
            this.state.source = 'BRAK';
            this.state.statusText = 'GOTOWY DO PAROWANIA';
            this.state.bpm = 0;
            this.state.coherence = 0;
            this.state.level = 'OCZEKIWANIE';
        }
        this.log('🛑 Tryb symulacji wyłączony.');
        this.emit();
    }

    /**
     * Rozłączenie z inicjatywy użytkownika
     */
    public disconnect() {
        this.userDisconnected = true;
        this.stopSimulation();
        this.stopKeepAlive();
        if (this.autoReconnectTimer) {
            clearTimeout(this.autoReconnectTimer);
            this.autoReconnectTimer = null;
        }
        this.disconnectDevice();
    }

    private disconnectDevice() {
        if (this.gattServer && this.gattServer.connected) {
            try {
                this.gattServer.disconnect();
            } catch {}
        }
        this.gattServer = null;
        this.bluetoothDevice = null;
        this.batteryChar = null;
        this.heartRateChar = null;
        this.fee2Char = null;
        this.fee3Char = null;
        this.state.connected = false;
        this.state.source = 'BRAK';
        this.state.statusText = 'ROZŁĄCZONY';
        this.emit();
    }

    /**
     * Przekuj Oddech i Puls Suwerena w GRV (z pieczęcią mostu)
     */
    public async forgeGrv(): Promise<{ success: boolean; message: string; grv?: number }> {
        if (!this.state.bpm || this.state.bpm <= 0) {
            return {
                success: false,
                message: 'Brak aktywnego pulsu z pierścienia PEAQ. Załóż pierścień lub uruchom tryb symulacji!',
            };
        }

        try {
            const res = await fetch(`${MOST_URL}/api/biometrics/przekuj-grv`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (data.success && data.oddech?.przyznane) {
                this.log(`🪙 Przyznano nagrodę Oddechu: +${data.oddech.grv} GRV za rezonans pulsu!`);
                return {
                    success: true,
                    message: `✅ Przekuto puls w ${data.oddech.grv} GRV! ${data.oddech.opis}`,
                    grv: data.oddech.grv,
                };
            } else if (data.success && !data.oddech?.przyznane) {
                const powod = data.oddech?.powod || 'Limit dobowy lub rytm oddechu.';
                this.log(`⏳ Oddech na wydechu: ${powod}`);
                return {
                    success: false,
                    message: `⏳ ${powod}`,
                };
            } else {
                return {
                    success: false,
                    message: data.message || 'Nie udało się przekuć pulsu w GRV.',
                };
            }
        } catch (err: any) {
            return {
                success: false,
                message: `Błąd połączenia z mostem: ${err.message}`,
            };
        }
    }
}

export const peaqRingService = new PeaqRingService();
export default peaqRingService;
