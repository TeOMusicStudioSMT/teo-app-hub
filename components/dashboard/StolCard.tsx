/**
 * 📱 StolCard — parowanie apki OtakOS-StoL (telefon) z tą Katedrą.
 *
 * StoL to okno OBSERWACJI: telefon widzi, co robią TeOgochi tej Katedry (migawka stada
 * z Domu TeOgochi + fakty z szyny), niczego nie zmienia. Most miał parowanie od dawna
 * (services/MostStada.js: kod 6 cyfr, 5 minut, jednorazowy → token urządzenia), ale żaden
 * ekran nie generował kodu — telefonu nie było jak sparować. Ta karta to domyka.
 *
 * Link parowania: otakos-stol://paruj?adres=<tunel>&k=<klucz Straży>&kod=<kod>
 * QR prowadzi jednak na stronę mostu <tunel>/stol/paruj.html#k=…&kod=… (public/stol/paruj.html):
 * aparaty z QR otwierają tylko https — własnego schematu otakos-stol:// nie przekazują do apki
 * (Suweren, 2026-09-27). Strona ma przycisk „Otwórz w StoL” (intencja Androida).
 *  · adres — telefon nie widzi 127.0.0.1 komputera, więc idzie Kwantowym Tunelem,
 *  · k     — Straż Mostu bez klucza odrzuca wszystko spoza maszyny,
 *  · kod   — wymieniany RAZ na token; zdjęcie ekranu po sparowaniu kodu już nie daje.
 * Klucz jest w QR tak samo jak w QR Delegata — kto sfotografuje ekran przed
 * sparowaniem, ma klucz. Dlatego zasięg zdalny w Straży: czytać tak, uruchamiać nie.
 */
import React, { useCallback, useEffect, useState } from 'react';
import DashboardCard from '../DashboardCard';
import { Smartphone, RefreshCw, Copy, Loader2, Radio, Unplug } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'react-hot-toast';
import { stanTunelu, uruchomTunel, type StanTunelu } from '../../lib/tunel';
import { otworzApke, wNowymOknie } from '../../lib/pierscien';

const MOST = 'http://127.0.0.1:3001';

interface Urzadzenie { nazwa: string; sparowane: number; ostatniKontakt: number | null; skrot: string }

/** Link parowania — ten sam format czyta LinkParowania.kt w OtakOS-StoL. */
export function linkParowaniaStol(adres: string, klucz: string, kod: string): string {
    const q = (s: string) => encodeURIComponent(s);
    return `otakos-stol://paruj?adres=${q(adres.replace(/\/+$/, ''))}&k=${q(klucz)}&kod=${q(kod)}`;
}

/**
 * Adres do QR: strona parowania na moście. Klucz i kod we fragmencie (#), którego przeglądarka
 * nie wysyła do serwera; `do` = koniec ważności kodu (strona odlicza).
 */
export function linkStronyParowaniaStol(adres: string, klucz: string, kod: string, wazneDo?: number): string {
    const q = (s: string) => encodeURIComponent(s);
    return `${adres.replace(/\/+$/, '')}/stol/paruj.html#k=${q(klucz)}&kod=${q(kod)}${wazneDo ? `&do=${wazneDo}` : ''}`;
}

/**
 * Apka StoL do pobrania: GitHub buduje ją po każdej zmianie w OtakOS-StoL (workflow „StoL APK”)
 * i podmienia plik w wydaniu „najnowszy”, więc ten adres zawsze daje aktualną wersję.
 * Repo jest publiczne — plik pobiera się bez logowania.
 */
export const ADRES_APKI_STOL = 'https://github.com/TeOMusicStudioSMT/OtakOS-StoL/releases/download/najnowszy/StoL.apk';

const kiedy = (ms: number | null) => (ms ? new Date(ms).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : 'jeszcze nie');

export const StolCard: React.FC = () => {
    const [tunel, setTunel] = useState<(StanTunelu & { klucz?: string }) | null>(null);
    const [kod, setKod] = useState<{ kod: string; wazneDo: number } | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [urzadzenia, setUrzadzenia] = useState<Urzadzenie[]>([]);
    const [pracuje, setPracuje] = useState(false);
    const [blad, setBlad] = useState<string | null>(null);
    const [teraz, setTeraz] = useState(Date.now());
    const [qrApki, setQrApki] = useState<string | null>(null);
    useEffect(() => {
        QRCode.toDataURL(ADRES_APKI_STOL, { margin: 1, width: 140, color: { dark: '#0b1220', light: '#f8fafc' } }).then(setQrApki).catch(() => setQrApki(null));
    }, []);

    const odswiez = useCallback(async () => {
        try {
            const [t, u] = await Promise.all([
                stanTunelu(),
                fetch(`${MOST}/api/stado/urzadzenia`).then((r) => r.json()),
            ]);
            setTunel(t); setUrzadzenia(u.urzadzenia ?? []); setBlad(null);
        } catch (e) { setBlad(`Most nie odpowiada: ${(e as Error).message}`); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);

    // Odliczanie ważności kodu — po 5 minutach QR znika, zamiast kłamać, że działa.
    useEffect(() => {
        if (!kod) return;
        const t = setInterval(() => setTeraz(Date.now()), 1000);
        return () => clearInterval(t);
    }, [kod]);
    const zostalo = kod ? Math.max(0, Math.round((kod.wazneDo - teraz) / 1000)) : 0;
    const link = kod && zostalo > 0 && tunel?.stan === 'dziala' && tunel.adres && tunel.klucz
        ? linkParowaniaStol(tunel.adres, tunel.klucz, kod.kod) : null;
    const linkQr = link && tunel?.adres && tunel.klucz && kod ? linkStronyParowaniaStol(tunel.adres, tunel.klucz, kod.kod, kod.wazneDo) : null;

    useEffect(() => {
        if (!linkQr) { setQr(null); return; }
        QRCode.toDataURL(linkQr, { margin: 1, width: 220, color: { dark: '#0b1220', light: '#f8fafc' } }).then(setQr).catch(() => setQr(null));
    }, [linkQr]);
    // Po wygaśnięciu kodu sprawdź, czy telefon zdążył się sparować.
    useEffect(() => { if (kod && zostalo === 0) void odswiez(); }, [kod, zostalo, odswiez]);

    const generuj = async () => {
        setPracuje(true); setBlad(null);
        try {
            let t = tunel;
            if (t?.stan !== 'dziala') { t = await uruchomTunel(); setTunel(t); }
            const r = await fetch(`${MOST}/api/stado/parowanie`, { method: 'POST' });
            const d = await r.json();
            if (!r.ok || !d.kod) throw new Error(d.message || `HTTP ${r.status}`);
            setKod({ kod: d.kod, wazneDo: Date.now() + (d.wazneSekund ?? 300) * 1000 });
            setTeraz(Date.now());
        } catch (e) { setBlad((e as Error).message); }
        finally { setPracuje(false); }
    };

    const odlacz = async (skrot: string) => {
        const r = await fetch(`${MOST}/api/stado/odlacz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skrot }) });
        if (r.ok) { toast.success('Telefon odłączony'); void odswiez(); }
        else toast.error('Nie udało się odłączyć');
    };

    const kopiuj = async () => {
        if (!link) return;
        try { await navigator.clipboard.writeText(link); toast.success('Link parowania skopiowany'); }
        catch { toast.error('Skopiuj ręcznie z pola poniżej'); }
    };

    return (
        <DashboardCard
            title="StoL — Katedra w telefonie"
            icon={<Smartphone className="w-5 h-5 text-sky-400" />}
            extra={<button onClick={odswiez} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400" title="Odśwież"><RefreshCw className="w-3.5 h-3.5" /></button>}
        >
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5">
                <div className="flex flex-col items-center gap-2 min-w-[220px]">
                    {qr ? (
                        <>
                            <img src={qr} alt="QR parowania StoL" className="rounded-xl w-[220px] h-[220px]" />
                            <div className="text-xs font-mono text-slate-300">kod {kod?.kod} · {Math.floor(zostalo / 60)}:{String(zostalo % 60).padStart(2, '0')}</div>
                            <button onClick={kopiuj} className="flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200"><Copy className="w-3.5 h-3.5" /> Kopiuj link</button>
                        </>
                    ) : (
                        <button onClick={generuj} disabled={pracuje}
                            className="w-[220px] h-[220px] rounded-xl border border-dashed border-sky-500/40 text-sky-300 text-sm flex flex-col items-center justify-center gap-2 hover:bg-sky-500/5 disabled:opacity-60">
                            {pracuje ? <Loader2 className="w-6 h-6 animate-spin" /> : <Radio className="w-6 h-6" />}
                            {pracuje ? (tunel?.stan === 'dziala' ? 'Generuję kod…' : 'Otwieram tunel…') : kod ? 'Kod wygasł — nowy' : 'Paruj telefon'}
                        </button>
                    )}
                    {/* Krok 0: bez zainstalowanej apki link parowania ląduje w wyszukiwarce przeglądarki. */}
                    <div className="flex flex-col items-center gap-1 pt-2 border-t border-white/5 w-full">
                        {qrApki && <img src={qrApki} alt="QR do pobrania apki StoL" className="rounded-lg w-[140px] h-[140px]" />}
                        <a href={ADRES_APKI_STOL} target="_blank" rel="noopener" className="text-xs text-sky-300 hover:text-sky-200 text-center">📲 Nie masz StoL-a? Zeskanuj i zainstaluj</a>
                    </div>
                </div>
                <div className="flex flex-col gap-3 text-sm text-slate-300">
                    <p className="text-slate-400 text-xs leading-relaxed">
                        <b className="text-slate-300">1.</b> Zainstaluj StoL: zeskanuj mały QR pod spodem (pobiera się StoL.apk; na telefonie zaloguj się do GitHuba i pozwól na instalację z przeglądarki).{' '}
                        <b className="text-slate-300">2.</b> „Paruj telefon” i zeskanuj duży QR aparatem — otworzy się strona Katedry z przyciskiem „Otwórz w StoL” (albo skopiuj link i wklej w apce, zakładka „Katedra”).
                        Telefon obserwuje stado na żywo i może zlecić mu nowy wspólny projekt — nic więcej w Katedrze nie zmienia.
                        Kod działa 5 minut i tylko raz.
                    </p>
                    <a href={`${MOST}/swiat/`} target="_blank" rel="noopener" onClick={(e) => { if (e.ctrlKey || e.metaKey || e.button === 1 || wNowymOknie()) return; e.preventDefault(); otworzApke({ id: 'swiat', tytul: 'Świat klocków', url: `${MOST}/swiat/`, znak: '🧱', kolor: '#38bdf8' }); }} className="text-xs text-sky-300 hover:text-sky-200 w-fit">
                        🧱 Otwórz świat klocków na tym komputerze
                    </a>
                    {link && <input readOnly value={link} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-400" onFocus={(e) => e.currentTarget.select()} />}
                    <div>
                        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Sparowane telefony</div>
                        {urzadzenia.length ? urzadzenia.map((u) => (
                            <div key={u.skrot} className="flex items-center justify-between gap-2 py-1 border-b border-white/5">
                                <span className="truncate">📱 {u.nazwa} <span className="text-slate-500 text-xs">· ostatnio: {kiedy(u.ostatniKontakt)}</span></span>
                                <button onClick={() => odlacz(u.skrot)} className="p-1 rounded hover:bg-white/10 text-slate-400" title="Odłącz"><Unplug className="w-3.5 h-3.5" /></button>
                            </div>
                        )) : <div className="text-xs text-slate-500">Żaden telefon nie jest sparowany.</div>}
                    </div>
                    {blad && <div className="text-xs text-rose-400">⚠️ {blad}</div>}
                </div>
            </div>
        </DashboardCard>
    );
};

export default StolCard;
