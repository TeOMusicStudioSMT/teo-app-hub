// Minimalny DOCX do testów (zip „store” bez kompresji): akapity, nagłówek, obraz w treści.
import zlib from 'node:zlib';

const crcTab = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTab[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zrobZip(pliki) {
    const lokalne = [], centralne = [];
    let off = 0;
    for (const [nazwa, tresc] of Object.entries(pliki)) {
        const dane = Buffer.isBuffer(tresc) ? tresc : Buffer.from(tresc, 'utf8');
        const n = Buffer.from(nazwa, 'utf8');
        const crc = crc32(dane);
        const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
        lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(dane.length, 18); lh.writeUInt32LE(dane.length, 22); lh.writeUInt16LE(n.length, 26);
        lokalne.push(lh, n, dane);
        const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
        ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(dane.length, 20); ch.writeUInt32LE(dane.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
        centralne.push(ch, n);
        off += 30 + n.length + dane.length;
    }
    const cd = Buffer.concat(centralne);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(centralne.length / 2, 8); end.writeUInt16LE(centralne.length / 2, 10);
    end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
    void zlib;
    return Buffer.concat([...lokalne, cd, end]);
}

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** akapity: [{tekst, styl?, obraz?: true}] — obraz = image1.png z `png`. */
export function zrobDocx(akapity, { png = null, tytul = null } = {}) {
    const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
    const body = akapity.map((a) => `<w:p>${a.styl ? `<w:pPr><w:pStyle w:val="${a.styl}"/></w:pPr>` : ''}${a.obraz ? '<w:r><w:drawing><a:graphic><a:graphicData><a:blip r:embed="rId9"/></a:graphicData></a:graphic></w:drawing></w:r>' : ''}${a.tekst ? `<w:r><w:t xml:space="preserve">${xmlEsc(a.tekst)}</w:t></w:r>` : ''}</w:p>`).join('');
    const pliki = {
        '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
        'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document ${ns}><w:body>${body}</w:body></w:document>`,
        'word/_rels/document.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="image" Target="media/image1.png"/></Relationships>',
        ...(png ? { 'word/media/image1.png': png } : {}),
        ...(tytul ? { 'docProps/core.xml': `<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEsc(tytul)}</dc:title><dc:creator>Anna Testowa</dc:creator></cp:coreProperties>` } : {}),
    };
    return zrobZip(pliki);
}
