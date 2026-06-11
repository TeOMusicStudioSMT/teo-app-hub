/**
 * 🧽 LaundryService — Pralka: Data Laundering & Scrubbing Service
 *
 * Moduł bezpieczeństwa klasy militarnej. Sterylizuje pliki graficzne
 * z metadanych i śladów telemetrycznych przed transmisją P2P:
 *   - JPEG: niszczy EXIF (APP1), ICC (APP2), XMP, COM i wszystkie segmenty APPn
 *   - PNG:  whitelist chunków — tEXt/zTXt/iTXt/eXIf/iCCP/tIME idą do prania
 *
 * Operacje czysto binarne (Buffer) — zero zewnętrznych bibliotek.
 * Singleton pattern · ESM standard
 */

// ─── Magic bytes ──────────────────────────────────────────────────────────────
const JPEG_SOI = Buffer.from([0xFF, 0xD8]);
const PNG_SIG  = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// PNG: chunki krytyczne + bezpieczne pomocnicze (renderowanie bez metadanych)
const PNG_CHUNK_WHITELIST = new Set([
    'IHDR', 'PLTE', 'IDAT', 'IEND', // krytyczne
    'tRNS', 'gAMA', 'sRGB', 'sBIT', // bezpieczne (kolory/alfa, zero telemetrii)
    'pHYs', 'bKGD',
]);

class LaundryService {
    constructor() {
        console.log('[LaundryService] 🧽 Pralka zainicjalizowana. Bęben gotowy.');
    }

    /**
     * Sterylizuje obraz Base64 (data URL lub surowe base64).
     * @returns { cleanBase64, report: { format, removed[], bytesBefore, bytesAfter, bytesRemoved } }
     */
    sanitizeImage(base64Data) {
        if (!base64Data || typeof base64Data !== 'string') {
            throw new Error('Brak danych obrazu do prania.');
        }

        // Rozszczep data URL prefix od ładunku
        let prefix = '';
        let rawB64 = base64Data;
        const commaIdx = base64Data.indexOf(',');
        if (base64Data.startsWith('data:') && commaIdx !== -1) {
            prefix = base64Data.slice(0, commaIdx + 1);
            rawB64 = base64Data.slice(commaIdx + 1);
        }

        const dirty = Buffer.from(rawB64, 'base64');
        let clean;
        let format;
        let removed;

        if (dirty.subarray(0, 2).equals(JPEG_SOI)) {
            format = 'JPEG';
            ({ clean, removed } = this._sanitizeJpeg(dirty));
        } else if (dirty.subarray(0, 8).equals(PNG_SIG)) {
            format = 'PNG';
            ({ clean, removed } = this._sanitizePng(dirty));
        } else {
            // Nieznany format — przepuść bez prania, ale zgłoś
            return {
                cleanBase64: base64Data,
                report: {
                    format: 'UNKNOWN',
                    removed: [],
                    bytesBefore: dirty.length,
                    bytesAfter:  dirty.length,
                    bytesRemoved: 0,
                    sterile: false,
                    note: 'Format nierozpoznany (nie JPEG/PNG) — plik przepuszczony bez prania.',
                },
            };
        }

        const report = {
            format,
            removed,
            bytesBefore:  dirty.length,
            bytesAfter:   clean.length,
            bytesRemoved: dirty.length - clean.length,
            sterile:      true,
        };

        console.log(`[LaundryService] 🧼 ${format} wyprany: usunięto ${removed.length} segmentów (${report.bytesRemoved} B).`);

        return { cleanBase64: prefix + clean.toString('base64'), report };
    }

    /**
     * Sterylizuje tekst — usuwa znaki zero-width (steganografia),
     * znaki sterujące i BOM (ślady edytorów / fingerprinting).
     */
    sanitizeText(text) {
        if (typeof text !== 'string') return { cleanText: '', removedChars: 0 };
        const clean = text
            .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')  // zero-width + bidi
            // eslint-disable-next-line no-control-regex
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''); // control chars
        return { cleanText: clean, removedChars: text.length - clean.length };
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PRIVATE — operacje binarne
    // ════════════════════════════════════════════════════════════════════════

    /**
     * JPEG: iteruje segmenty. Wycina APP1 (EXIF/XMP), APP2 (ICC),
     * wszystkie pozostałe APPn (telemetria producentów) oraz COM (komentarze).
     * Od markera SOS (0xFFDA) kopiuje resztę strumienia bez zmian.
     */
    _sanitizeJpeg(buf) {
        const parts   = [JPEG_SOI];
        const removed = [];
        let pos = 2;

        while (pos < buf.length - 1) {
            if (buf[pos] !== 0xFF) { pos++; continue; } // resync na marker

            const marker = buf[pos + 1];

            // SOS — początek skanu: kopiuj resztę (dane obrazu + EOI) verbatim
            if (marker === 0xDA) {
                parts.push(buf.subarray(pos));
                break;
            }

            // Markery bez długości (RST, EOI, TEM, padding)
            if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9) || marker === 0xFF) {
                parts.push(buf.subarray(pos, pos + 2));
                pos += 2;
                continue;
            }

            const segLen = buf.readUInt16BE(pos + 2); // długość zawiera 2 bajty pola
            const segEnd = pos + 2 + segLen;

            const isAppN = marker >= 0xE0 && marker <= 0xEF;
            const isCom  = marker === 0xFE;

            if ((isAppN && marker !== 0xE0) || isCom) {
                // APP1 = EXIF/XMP · APP2 = ICC · APP3-15 = telemetria · COM = komentarz
                const names = { 0xE1: 'EXIF/XMP (APP1)', 0xE2: 'ICC (APP2)', 0xFE: 'COM' };
                removed.push(names[marker] ?? `APP${marker - 0xE0}`);
            } else {
                // APP0 (JFIF) i segmenty strukturalne (DQT, SOF, DHT...) — zostają
                parts.push(buf.subarray(pos, segEnd));
            }

            pos = segEnd;
        }

        return { clean: Buffer.concat(parts), removed };
    }

    /**
     * PNG: iteruje chunki. Przepuszcza tylko whitelistę —
     * tEXt, zTXt, iTXt, eXIf, iCCP, tIME i inne nieznane idą do prania.
     */
    _sanitizePng(buf) {
        const parts   = [PNG_SIG];
        const removed = [];
        let pos = 8;

        while (pos + 8 <= buf.length) {
            const dataLen   = buf.readUInt32BE(pos);
            const chunkType = buf.toString('ascii', pos + 4, pos + 8);
            const chunkEnd  = pos + 12 + dataLen; // len(4) + type(4) + data + crc(4)

            if (chunkEnd > buf.length) break; // uszkodzony chunk — stop

            if (PNG_CHUNK_WHITELIST.has(chunkType)) {
                parts.push(buf.subarray(pos, chunkEnd));
            } else {
                removed.push(chunkType); // tEXt / zTXt / iTXt / eXIf / iCCP / tIME...
            }

            if (chunkType === 'IEND') break;
            pos = chunkEnd;
        }

        return { clean: Buffer.concat(parts), removed };
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _instance = null;

export default {
    getInstance() {
        if (!_instance) _instance = new LaundryService();
        return _instance;
    }
};
