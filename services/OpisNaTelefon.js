/**
 * 📱📋 Opis na telefon linkiem (Suweren 2026-10-22: „aparat zamiast skopiować tekst z QR otwiera Brave z Leo AI…
 * a w TikToku opis przetłumaczony na polski”). QR niesie teraz LINK do małej strony z dużym przyciskiem „Kopiuj”
 * — nie zależy od tego, co aparat robi z czystym tekstem. Strona ma blokadę tłumaczenia (translate="no").
 *
 * Bezpieczeństwo: tylko tekst opisu (i tak idzie publicznie pod film), losowy token 24 hex, ważny `TTL_MS` (6 h),
 * trzymany W PAMIĘCI mostu (restart = linki wygasają), ≤ `MAX_OPISOW`. Link zakłada tylko maszyna Suwerena
 * (`/api/formaty/…` — Straż), stronę czyta telefon przez tunel (`SCIEZKA_OPISU` w Straży, tylko GET/HEAD).
 */
import crypto from 'crypto';

export const TTL_MS = 6 * 3600_000;
export const MAX_OPISOW = 50;
export const MAX_ZNAKOW = 6000;

export function utworzSchowekOpisow({ teraz = () => Date.now() } = {}) {
    const opisy = new Map();
    const sprzataj = () => {
        for (const [t, o] of opisy) if (o.wygasa <= teraz()) opisy.delete(t);
        while (opisy.size > MAX_OPISOW) opisy.delete(opisy.keys().next().value);   // najstarszy pierwszy (kolejność wstawiania)
    };
    return {
        dodaj(tekst) {
            const t = String(tekst ?? '').trim();
            if (!t) throw new Error('Pusty opis.');
            if (t.length > MAX_ZNAKOW) throw new Error(`Opis za długi (≤ ${MAX_ZNAKOW} znaków).`);
            const token = crypto.randomBytes(12).toString('hex');
            opisy.set(token, { tekst: t, wygasa: teraz() + TTL_MS });
            sprzataj();
            return { token, wygasa: new Date(opisy.get(token).wygasa).toISOString() };
        },
        odczytaj(token) {
            sprzataj();
            return /^[0-9a-f]{24}$/.test(String(token)) ? opisy.get(token)?.tekst ?? null : null;
        },
    };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Strona telefonu: tekst + duży „📋 Kopiuj” (clipboard API, zapas: zaznacz + execCommand). Bez tłumaczenia przeglądarki. */
export function stronaOpisu(tekst) {
    const t = tekst == null ? null : esc(tekst);
    return `<!doctype html><html lang="und" translate="no" class="notranslate"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google" content="notranslate"><meta name="robots" content="noindex">
<title>📋 Opis</title><style>body{margin:0;background:#0b1020;color:#e2e8f0;font:17px/1.45 system-ui,sans-serif;padding:16px}
textarea{width:100%;box-sizing:border-box;min-height:55vh;background:#111827;color:#f8fafc;border:1px solid #334155;border-radius:10px;padding:12px;font:inherit}
button{width:100%;margin:12px 0;padding:18px;font-size:22px;font-weight:700;border:0;border-radius:12px;background:#d946ef;color:#fff}
p{color:#94a3b8;font-size:14px}</style></head><body>
${t == null ? '<h2>⌛ Link wygasł</h2><p>Opis był ważny 6 godzin (albo most się zrestartował). Zrób nowy kod QR w Katedrze.</p>' : `
<button id="k">📋 Kopiuj opis</button>
<textarea id="t" readonly>${t}</textarea>
<p>Potem w TikToku: szkic → wklej opis. Strona z Katedry OtakOS — wygasa po 6 h.</p>
<script>const b=document.getElementById('k'),t=document.getElementById('t');
b.onclick=async()=>{try{await navigator.clipboard.writeText(t.value);}catch(e){t.focus();t.select();t.setSelectionRange(0,t.value.length);document.execCommand('copy');}
b.textContent='✓ Skopiowane';b.style.background='#16a34a';setTimeout(()=>{b.textContent='📋 Kopiuj opis';b.style.background='#d946ef';},2500);};</script>`}
</body></html>`;
}

/** Trasy: link (maszyna) i strona (publicznie przez tunel). `adresTunelu()` → https://… albo null. */
export function zamontujTrasyOpisu(app, schowek, { adresTunelu }) {
    app.post('/api/formaty/opis-link', async (req, res) => {
        try {
            const { token, wygasa } = schowek.dodaj(req.body?.tekst);
            const adres = await Promise.resolve().then(adresTunelu).catch(() => null);
            res.json({ success: true, url: adres ? `${String(adres).replace(/\/$/, '')}/wizytowka/opis/${token}` : null, wygasa,
                powod: adres ? null : 'Tunel nie działa — telefon nie dosięgnie strony. Włącz tunel (Katedra → 🌐) albo użyj QR z samym tekstem.' });
        } catch (e) { res.status(400).json({ success: false, message: e.message }); }
    });
    app.get('/wizytowka/opis/:token', (req, res) => {
        const tekst = schowek.odczytaj(req.params.token);
        res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' }).status(tekst == null ? 404 : 200).type('html').send(stronaOpisu(tekst));
    });
}

export default { utworzSchowekOpisow, zamontujTrasyOpisu, stronaOpisu, TTL_MS };
