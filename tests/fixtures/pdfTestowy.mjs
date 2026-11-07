// Minimalny PDF do testów Własnego Manuskryptu: strony z tekstem (Helvetica, WinAnsi) i obrazem JPEG (DCTDecode)
// albo surowym RGB (FlateDecode). Bez bibliotek — obiekty, xref, trailer.
import zlib from 'node:zlib';

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/**
 * @param {{ tekst: string[], jpeg?: Buffer, jpegW?: number, jpegH?: number, rgb?: {w:number, h:number, dane:Buffer} }[]} strony
 */
export function zrobPdf(strony) {
    const obj = [];   // [numer] = Buffer treści obiektu (bez "n 0 obj")
    const dodaj = (b) => { obj.push(Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1')); return obj.length; };
    const strumien = (slownik, dane) => Buffer.concat([Buffer.from(`<< ${slownik} /Length ${dane.length} >>\nstream\n`, 'latin1'), dane, Buffer.from('\nendstream', 'latin1')]);
    const katalog = dodaj('');   // 1 — uzupełniamy na końcu
    const strony_ = dodaj('');   // 2
    const font = dodaj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const kidy = [];
    for (const s of strony) {
        const xo = [];
        let rys = '';
        if (s.jpeg) {
            const n = dodaj(strumien(`/Type /XObject /Subtype /Image /Width ${s.jpegW} /Height ${s.jpegH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, s.jpeg));
            xo.push(`/Im${xo.length} ${n} 0 R`); rys += `q 300 0 0 200 150 380 cm /Im${xo.length - 1} Do Q\n`;
        }
        if (s.rgb) {
            const n = dodaj(strumien(`/Type /XObject /Subtype /Image /Width ${s.rgb.w} /Height ${s.rgb.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`, zlib.deflateSync(s.rgb.dane)));
            xo.push(`/Im${xo.length} ${n} 0 R`); rys += `q 200 0 0 200 200 360 cm /Im${xo.length - 1} Do Q\n`;
        }
        let y = 330;
        const linie = s.tekst.map((l) => { const t = `BT /F1 12 Tf 60 ${y} Td (${esc(l)}) Tj ET\n`; y -= 16; return t; }).join('');
        const tresc = dodaj(strumien('', Buffer.from(rys + linie, 'latin1')));
        kidy.push(dodaj(`<< /Type /Page /Parent ${strony_} 0 R /MediaBox [0 0 595 842] /Contents ${tresc} 0 R /Resources << /Font << /F1 ${font} 0 R >> ${xo.length ? `/XObject << ${xo.join(' ')} >>` : ''} >> >>`));
    }
    obj[katalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${strony_} 0 R >>`, 'latin1');
    obj[strony_ - 1] = Buffer.from(`<< /Type /Pages /Kids [${kidy.map((k) => `${k} 0 R`).join(' ')}] /Count ${kidy.length} >>`, 'latin1');
    const czesci = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
    const off = [];
    let dl = czesci[0].length;
    obj.forEach((b, i) => { off.push(dl); const c = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), b, Buffer.from('\nendobj\n', 'latin1')]); czesci.push(c); dl += c.length; });
    const xref = `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n${off.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${obj.length + 1} /Root 1 0 R >>\nstartxref\n${dl}\n%%EOF\n`;
    czesci.push(Buffer.from(xref, 'latin1'));
    return Buffer.concat(czesci);
}
