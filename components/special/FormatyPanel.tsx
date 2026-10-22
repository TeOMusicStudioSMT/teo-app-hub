/**
 * 📱 Formaty i sieci w Impresariacie (2026-10-15) — gotowe odcinki (Gol Dnia, Studio Zebrra, TeO Game Show, wywiady…)
 * → pion 1080×1920 dla YouTube Shorts / TikTok / Instagram Reels (services/Formaty.js), konta TikTok i Instagram
 * (services/KontaSieci.js). Każda wysyłka po ✓ Suwerena: Short — w „Publikacjach YouTube” (Izba), TikTok/Instagram — tutaj.
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import { ZDARZENIE_TEOSIM } from '../../lib/koherencja';

const MOST = 'http://127.0.0.1:3001';
async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}
const blad = (e: unknown) => String(e instanceof Error ? e.message : e);

/**
 * 📱 Opis szkicu TikTok na telefon (Suweren 2026-10-22: „muszę iść na YT, skopiować opis i wkleić na TikToka”).
 * API szkicu nie przyjmuje opisu (Direct Post z opisem — dopiero po audycie TikToka), więc opis Kronikarza idzie
 * kodem QR: aparat telefonu → „kopiuj tekst” → wklej w szkicu. Lokalnie, bez chmury.
 */
function OpisNaTelefon({ opis }: { opis: string }) {
    const [qr, setQr] = useState<string | null>(null);
    const [pokaz, setPokaz] = useState(false);
    const [bladQr, setBladQr] = useState<string | null>(null);
    useEffect(() => {
        if (!pokaz || !opis) return;
        QRCode.toDataURL(opis, { margin: 1, width: 260, errorCorrectionLevel: 'L', color: { dark: '#0b1220', light: '#f8fafc' } })
            .then((u) => { setQr(u); setBladQr(null); }).catch((e) => { setQr(null); setBladQr(blad(e)); });
    }, [pokaz, opis]);
    if (!opis) return null;
    const kopiuj = () => navigator.clipboard.writeText(opis).then(() => toast.success('Opis w schowku.'), () => toast.error('Schowek niedostępny — zaznacz tekst ręcznie.'));
    return (
        <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setPokaz((x) => !x)} className="rounded border border-fuchsia-500/50 px-1.5 text-fuchsia-200">📱 opis na telefon (QR)</button>
                <button onClick={kopiuj} className="rounded border border-slate-600 px-1.5 text-slate-200">📋 kopiuj</button>
            </div>
            {pokaz && (
                <div className="flex flex-wrap items-start gap-2">
                    {qr ? <img src={qr} alt="QR z opisem" className="h-[130px] w-[130px] rounded bg-white" /> : <span className="text-rose-300">{bladQr ? `QR: ${bladQr} — użyj 📋` : '…'}</span>}
                    <div className="min-w-0 flex-1">
                        <p className="text-slate-500">Aparat telefonu → kod → „Kopiuj tekst”, potem w TikTok: powiadomienie / szkic → wklej opis.</p>
                        <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-1 text-slate-300">{opis}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}

interface Zrodlo { plik: string; nazwa: string; projekt: string; program: { id: string; nazwa: string }; jezyk: string; zmieniono: string }
interface Cel { ok: boolean; powod?: string }
interface Propozycja { id: string; nazwa: string; od: number; do: number; tytul: string; napisy: { tekst: string }[]; cele: Record<string, Cel> }
interface Propozycje { plik: string; nazwa: string; program: { nazwa: string }; opis: { sekundy: number | null } | null; propozycje: Propozycja[]; kwestie: boolean; uwaga: string | null }
interface PubSieci { etap: string; opis?: string; kontoId?: string; kontoNazwa?: string; blad?: string | null; uwaga?: string | null; url?: string | null; postep?: string | null; tytul?: string | null; kanalNazwa?: string | null }
interface Klip {
    id: string; nazwa: string; nazwaZrodla: string; program: { nazwa: string }; stan: string; powod?: string | null; plik: string | null; sekundy: number | null;
    uklad: string; napisy: string; cele: Record<string, Cel> | null; publikacje: Record<string, PubSieci>; utworzono: string;
}
interface Konto { id: string; nazwa: string; strona?: string | null; blad?: string | null }
interface StanSieci { siec: string; klient?: boolean; klucze?: string; polaczony: boolean; konta?: Konto[]; kanaly?: Konto[]; domyslny?: string | null; powod?: string | null; instrukcja?: string[]; zwrot?: string; tryb?: string; blad?: string | null }
interface CelAuto { nazwa: string; siec: string; wlaczony: boolean; limit: number; maxLimit: number; maxSekund: number; doZrobienia: number; wyslane: number; porzucone: number; dzisiaj: number; konto: { polaczony: boolean; powod: string | null }; uwaga: string }
interface Autopilot {
    cele: Record<string, CelAuto>; filmow: number; pozaMontazem: number; przerobione: number; trwa: boolean; petla: boolean;
    bledy: { kiedy: string; cel: string; film: string; powod: string }[]; porzucone: { plik: string; cel: string; film?: string; powod?: string; stan: string }[];
    ostatniPrzebieg: { kiedy: string; cele: Record<string, { wyslane: number; bledy: number; czeka: string | null }> } | null;
}
const CELE_AUTO = ['shorts', 'reels', 'tiktok'];
const otworzSkarbiec = () => window.dispatchEvent(new CustomEvent(ZDARZENIE_TEOSIM, { detail: 'vault' }));
interface Stan { klipy: Klip[]; cele: Record<string, { nazwa: string; max: number }>; uklady: Record<string, string>; napisy: Record<string, string>; maxKlipu: number }

const SIECI: [string, string, string][] = [['youtube', '📺 Short', 'shorts'], ['tiktok', '🎵 TikTok', 'tiktok'], ['instagram', '📸 Reels', 'reels']];
const STAN_KLIPU: Record<string, string> = { w_kolejce: '⏳ w kolejce', robi: '⏳ ffmpeg przerabia', gotowy: '✓ gotowy', blad: '⚠ błąd' };
const ETAP: Record<string, string> = {
    przygotowuje: '✍️ Kronikarz pisze', do_akceptacji: '⏸ czeka na Twoje ✓', wysylanie: '⏳ wysyłam', w_skrzynce: '📥 w skrzynce TikTok — dokończ w aplikacji',
    opublikowana: '✓ opublikowana', prywatna: '🔒 prywatna (YouTube)', limit: '⏳ limit dnia', odrzucona: '✕ odrzucona', blad: '⚠ błąd',
};
const sek = (x: number | null | undefined) => (x == null ? '?' : `${Math.round(x * 10) / 10} s`);

/** Konto sieci: klucze aplikacji → „Połącz” → konta (domyślne, rozłącz) + kroki dla Suwerena. */
const KontoSieci: React.FC<{ siec: 'tiktok' | 'instagram'; s: StanSieci | undefined; onZmiana: () => void }> = ({ siec, s, onZmiana }) => {
    const [a, setA] = useState(''); const [b, setB] = useState(''); const [c, setC] = useState('');
    const [kroki, setKroki] = useState(false);
    const nazwa = siec === 'tiktok' ? 'TikTok' : 'Instagram';
    const zapisz = async () => {
        try {
            await zMostu(`/api/impresario/${siec}/klient`, { method: 'POST', body: JSON.stringify(siec === 'tiktok' ? { clientKey: a, clientSecret: b } : { appId: a, appSecret: b, configId: c }) });
            setA(''); setB(''); setC(''); toast.success(`Klucze aplikacji ${nazwa} w skarbcu Impresariatu.`); onZmiana();
        } catch (e) { toast.error(blad(e), { duration: 8000 }); }
    };
    const wolaj = async (co: 'domyslne' | 'rozlacz', cialo: object) => { try { await zMostu(co === 'domyslne' ? `/api/impresario/${siec}/domyslne` : `/api/impresario/${siec}/rozlacz`, { method: 'POST', body: JSON.stringify(cialo) }); onZmiana(); } catch (e) { toast.error(blad(e)); } };
    return (
        <div className="rounded border border-slate-700/60 p-2">
            <div className="flex flex-wrap items-center gap-2">
                <b className="text-slate-200">{siec === 'tiktok' ? '🎵' : '📸'} {nazwa}</b>
                <span className={s?.polaczony ? 'text-emerald-300' : 'text-amber-300'}>{s?.polaczony ? `połączony (${s.tryb === 'szkic' ? 'szkice do skrzynki' : 'Reel publiczny po ✓'})` : (s?.powod ?? 'niepodłączone')}</span>
                <button onClick={() => setKroki((x) => !x)} className="ml-auto text-[10px] text-slate-400 hover:text-slate-200">{kroki ? 'zwiń' : 'co założyć?'}</button>
            </div>
            {(s?.konta ?? []).map((k) => (
                <div key={k.id} className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="text-slate-200">{k.id === s?.domyslny ? '⭐ ' : ''}{k.nazwa}</span>{k.strona && <span className="text-slate-500">strona: {k.strona}</span>}
                    {k.blad && <span className="text-rose-300">⚠ {k.blad}</span>}
                    {k.id !== s?.domyslny && <button onClick={() => void wolaj('domyslne', { kontoId: k.id })} className="text-slate-400 hover:text-amber-200">⭐ domyślne</button>}
                    <button onClick={() => confirm(`Rozłączyć ${k.nazwa}? Token zniknie z Katedry.`) && void wolaj('rozlacz', { kontoId: k.id })} className="text-slate-600 hover:text-rose-300">rozłącz</button>
                </div>
            ))}
            {s?.klient && <button onClick={() => window.open(`${MOST}/api/impresario/${siec}/polacz`, '_blank')} className="mt-1 rounded border border-cyan-500/40 px-2 py-0.5 text-[10px] text-cyan-200 hover:bg-cyan-900/30">{s.polaczony ? '➕ Dodaj konto' : `🔗 Połącz z ${nazwa}`}</button>}
            {kroki && (
                <div className="mt-2 space-y-1 text-[10px] text-slate-400">
                    <ol className="list-decimal space-y-0.5 pl-4">{(s?.instrukcja ?? []).map((x, i) => <li key={i}>{x}</li>)}</ol>
                    <p>Klucze aplikacji trzymam w <button onClick={otworzSkarbiec} className="text-amber-200 underline">🔐 Skarbcu 0.00G</button> (usługa „{nazwa}”){s?.klucze === 'impresariat' ? ' — most sprzed restartu trzyma je jeszcze w skarbcu Impresariatu' : ''}; tokeny kont — w skarbcu Impresariatu, obok kanałów YouTube.</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                        <input value={a} onChange={(e) => setA(e.target.value)} placeholder={siec === 'tiktok' ? 'Client key' : 'App ID'} className="w-36 rounded border border-slate-700 bg-black/60 px-1.5 py-0.5 text-slate-200" />
                        <input value={b} onChange={(e) => setB(e.target.value)} type="password" placeholder={siec === 'tiktok' ? 'Client secret' : 'App secret'} className="w-36 rounded border border-slate-700 bg-black/60 px-1.5 py-0.5 text-slate-200" />
                        {siec === 'instagram' && <input value={c} onChange={(e) => setC(e.target.value)} placeholder="Configuration ID (opcja)" className="w-40 rounded border border-slate-700 bg-black/60 px-1.5 py-0.5 text-slate-200" />}
                        <button disabled={!a || !b} onClick={() => void zapisz()} className="rounded border border-slate-600 px-2 text-slate-200 disabled:opacity-40">💾 zapisz klucze</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const FormatyPanel: React.FC = () => {
    const [s, setS] = useState<Stan | null>(null);
    const [sieci, setSieci] = useState<Record<string, StanSieci>>({});
    const [zrodla, setZrodla] = useState<Zrodlo[]>([]);
    const [plik, setPlik] = useState('');
    const [pr, setPr] = useState<Propozycje | null>(null);
    const [uklad, setUklad] = useState('rozmyte');
    const [kadrX, setKadrX] = useState(0.5);
    const [napisy, setNapisy] = useState('zachowane');
    const [tytul, setTytul] = useState('');
    const [od, setOd] = useState(0); const [doS, setDoS] = useState(30);
    const [teraz, setTeraz] = useState(0);
    const [problem, setProblem] = useState<string | null>(null);
    const [pokaz, setPokaz] = useState(false);
    const [opisy, setOpisy] = useState<Record<string, string>>({});
    const [auto, setAuto] = useState<Autopilot | null>(null);
    const [autoPokaz, setAutoPokaz] = useState(false);

    const odswiez = useCallback(async () => {
        try { setS(await zMostu<Stan>('/api/formaty')); setProblem(null); }
        catch (e) { setProblem(/HTTP 404/.test(blad(e)) ? 'Most sprzed restartu — zrestartuj Katedrę, żeby włączyć dział formatów.' : blad(e)); }
        try { const w = await zMostu<Record<string, StanSieci>>('/api/formaty/sieci'); setSieci(w); } catch { /* most sprzed restartu */ }
        try { setAuto((await zMostu<{ autopilot: Autopilot }>('/api/formaty/autopilot')).autopilot); } catch { setAuto(null); }
    }, []);
    useEffect(() => { void odswiez(); const t = setInterval(odswiez, 15_000); return () => clearInterval(t); }, [odswiez]);
    useEffect(() => { if (pokaz) zMostu<{ zrodla: Zrodlo[] }>('/api/formaty/zrodla').then((w) => setZrodla(w.zrodla)).catch(() => {}); }, [pokaz]);
    useEffect(() => {
        if (!plik) { setPr(null); return; }
        zMostu<Propozycje>(`/api/formaty/propozycje?plik=${encodeURIComponent(plik)}`).then((w) => { setPr(w); setOd(0); setDoS(Math.min(w.opis?.sekundy ?? 30, 30)); if (!w.kwestie) setNapisy('zachowane'); })
            .catch((e) => { setPr(null); toast.error(blad(e)); });
    }, [plik]);

    const zrob = async (cialo: object) => {
        try { await zMostu('/api/formaty', { method: 'POST', body: JSON.stringify({ plik, uklad, kadrX, napisy, ...(tytul ? { tytul } : {}), ...cialo }) }); toast.success('Klip w kolejce ffmpeg.'); await odswiez(); }
        catch (e) { toast.error(blad(e), { duration: 8000 }); }
    };
    const wolaj = async (sciezka: string, cialo: object, ok: string, metoda = 'POST') => {
        try { await zMostu(sciezka, { method: metoda, body: JSON.stringify(cialo) }); toast.success(ok); await odswiez(); }
        catch (e) { toast.error(blad(e), { duration: 9000 }); }
    };
    const programy = [...new Set(zrodla.map((z) => z.program.nazwa))];

    return (
        <div className="rounded-lg border border-fuchsia-500/25 p-3 text-[11px]">
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-fuchsia-300">📱 Formaty i sieci</span>
                <span className="text-[10px] text-slate-500">odcinki → pion 9:16 dla Shorts / TikTok / Reels · wysyłka po Twoim ✓ albo autopilotem (tylko włączone sieci)</span>
                <button onClick={() => setPokaz((x) => !x)} className="ml-auto text-[10px] text-slate-400 hover:text-fuchsia-200">{pokaz ? 'zwiń' : 'przerób odcinek'}</button>
            </div>
            {problem && <p className="text-[10px] text-amber-300">⚠ {problem}</p>}

            <div className="mb-2 flex flex-wrap gap-2 text-[10px]">
                <span className={sieci.youtube?.polaczony ? 'text-emerald-300' : 'text-amber-300'}>📺 YouTube: {sieci.youtube?.polaczony ? `${(sieci.youtube.kanaly ?? []).length} kanał(y)` : 'niepołączony (wyżej „Połącz z YouTube”)'}</span>
                {(['tiktok', 'instagram'] as const).map((sn) => { const st = sieci[sn]; const n = sn === 'tiktok' ? '🎵 TikTok' : '📸 Instagram'; return (
                    <span key={sn} className={st?.polaczony ? 'text-emerald-300' : 'text-slate-400'}>{n}: {st?.polaczony ? `połączony (${(st.konta ?? []).map((k) => k.nazwa).join(', ')})` : 'niepodłączone'}
                        {st?.klient && !st.polaczony && <button onClick={() => window.open(`${MOST}/api/impresario/${sn}/polacz`, '_blank')} className="ml-1.5 rounded border border-cyan-500/50 px-1.5 text-cyan-200 hover:bg-cyan-900/30">🔗 Połącz z {sn === 'tiktok' ? 'TikTok' : 'Instagramem'}</button>}
                        {!st?.klient && <button onClick={otworzSkarbiec} className="ml-1.5 text-amber-200 underline">klucze → Skarbiec</button>}
                    </span>
                ); })}
            </div>

            {auto && (
                <div className="mb-2 rounded border border-cyan-500/25 bg-cyan-950/10 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <b className="text-cyan-200">🤖 Autopilot</b>
                        <span className="text-[10px] text-slate-400">wysłane odcinki ({auto.filmow}{auto.pozaMontazem ? `, ${auto.pozaMontazem} spoza montażu pominięte` : ''}) → pion → wysyłka sama, raz na sieć · pionów: {auto.przerobione}{auto.trwa ? ' · ⏳ pracuje' : ''}</span>
                        <button disabled={auto.trwa} onClick={() => void wolaj('/api/formaty/autopilot/teraz', {}, 'Autopilot ruszył — przerabia i wysyła zaległe (minuty).')} className="ml-auto rounded border border-cyan-500/40 px-2 text-[10px] text-cyan-200 disabled:opacity-40">▶ przerób zaległe teraz</button>
                        <button onClick={() => setAutoPokaz((x) => !x)} className="text-[10px] text-slate-400">{autoPokaz ? 'zwiń' : 'błędy'}</button>
                    </div>
                    <div className="mt-1 grid gap-1 md:grid-cols-3">
                        {CELE_AUTO.map((c) => { const x = auto.cele[c]; if (!x) return null; return (
                            <div key={c} className={`rounded border p-1.5 text-[10px] ${x.wlaczony ? 'border-emerald-500/40' : 'border-slate-700/60'}`}>
                                <div className="flex items-center gap-1.5 text-slate-200">
                                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={x.wlaczony} onChange={(e) => { if (e.target.checked && !confirm(`Włączyć autopilota ${x.nazwa}? ${x.uwaga} Wysyłka pójdzie BEZ Twojego ✓ (do ${x.limit} na dobę).`)) return; void wolaj('/api/formaty/autopilot', { wlaczone: { [c]: e.target.checked } }, e.target.checked ? `${x.nazwa}: autopilot włączony.` : `${x.nazwa}: autopilot wyłączony.`, 'PUT'); }} />
                                    <b>{x.nazwa}</b></label><span className="text-slate-500">≤ {x.maxSekund} s</span>
                                    <span className="ml-auto text-slate-500">na dobę</span>
                                    <select value={x.limit} onChange={(e) => void wolaj('/api/formaty/autopilot', { limit: { [c]: Number(e.target.value) } }, `${x.nazwa}: limit ${e.target.value} na dobę.`, 'PUT')} className="rounded bg-black/60 px-1 text-slate-200">
                                        {Array.from({ length: x.maxLimit + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div className="text-slate-400">do zrobienia {x.doZrobienia} · wysłane {x.wyslane} · dziś {x.dzisiaj}/{x.limit}{x.porzucone ? ` · porzucone ${x.porzucone}` : ''}</div>
                                {!x.konto.polaczony && <div className="text-amber-300">⏸ {x.konto.powod ?? 'konto niepodłączone'} — czeka</div>}
                                {auto.ostatniPrzebieg?.cele?.[c]?.czeka && x.konto.polaczony && <div className="text-amber-200">⏸ {auto.ostatniPrzebieg.cele[c].czeka}</div>}
                                <div className="text-slate-500">{x.uwaga}</div>
                            </div>
                        ); })}
                    </div>
                    {autoPokaz && (
                        <div className="mt-1 space-y-0.5 text-[10px]">
                            {auto.ostatniPrzebieg && <div className="text-slate-500">ostatni przebieg: {new Date(auto.ostatniPrzebieg.kiedy).toLocaleString('pl-PL')}</div>}
                            {auto.bledy.slice(0, 6).map((b, i) => <div key={i} className="text-rose-300">⚠ {auto.cele[b.cel]?.nazwa ?? b.cel} · „{b.film}”: {b.powod}</div>)}
                            {auto.porzucone.map((p) => (
                                <div key={`${p.plik}|${p.cel}`} className="flex flex-wrap gap-2 text-amber-200">
                                    <span>{p.stan === 'porzucony' ? '✖ porzucony' : '↻ ponowi'} · {auto.cele[p.cel]?.nazwa ?? p.cel} · „{p.film}”: {p.powod}</span>
                                    {p.stan === 'porzucony' && <button onClick={() => void wolaj('/api/formaty/autopilot/ponow', { plik: p.plik, cel: p.cel }, 'Wraca do kolejki autopilota.')} className="text-cyan-200">↻ ponów</button>}
                                </div>
                            ))}
                            {!auto.bledy.length && !auto.porzucone.length && <div className="text-slate-500">bez błędów</div>}
                        </div>
                    )}
                </div>
            )}

            {pokaz && (
                <div className="mb-3 space-y-2">
                    <div className="grid gap-2 md:grid-cols-2">
                        <KontoSieci siec="tiktok" s={sieci.tiktok} onZmiana={odswiez} />
                        <KontoSieci siec="instagram" s={sieci.instagram} onZmiana={odswiez} />
                    </div>
                    <select value={plik} onChange={(e) => setPlik(e.target.value)} className="w-full rounded border border-slate-700 bg-black/60 px-1.5 py-1 text-slate-200">
                        <option value="">— wybierz odcinek z katalogów montaży —</option>
                        {programy.map((p) => <optgroup key={p} label={p}>{zrodla.filter((z) => z.program.nazwa === p).map((z) => <option key={z.plik} value={z.plik}>{z.projekt} · {z.nazwa}</option>)}</optgroup>)}
                    </select>
                    {pr && (
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <div>
                                <video src={`${MOST}/api/formaty/zrodlo?plik=${encodeURIComponent(pr.plik)}`} controls className="w-full rounded bg-black" onTimeUpdate={(e) => setTeraz((e.target as HTMLVideoElement).currentTime)} />
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                                    <span>{pr.program.nazwa} · {sek(pr.opis?.sekundy)} · teraz {sek(teraz)}</span>
                                    <button onClick={() => setOd(Math.round(teraz * 10) / 10)} className="rounded border border-slate-600 px-1.5 text-slate-200">od = teraz</button>
                                    <button onClick={() => setDoS(Math.round(teraz * 10) / 10)} className="rounded border border-slate-600 px-1.5 text-slate-200">do = teraz</button>
                                </div>
                                {pr.uwaga && <p className="mt-1 text-[10px] text-amber-300">{pr.uwaga}</p>}
                            </div>
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                                    Układ: <select value={uklad} onChange={(e) => setUklad(e.target.value)} className="rounded border border-slate-700 bg-black/60 px-1 text-slate-200">{Object.entries(s?.uklady ?? {}).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                                    {uklad === 'srodek' && <label className="flex items-center gap-1">kadr ←→ <input type="range" min={0} max={1} step={0.05} value={kadrX} onChange={(e) => setKadrX(Number(e.target.value))} /></label>}
                                    Napisy: <select value={napisy} onChange={(e) => setNapisy(e.target.value)} className="rounded border border-slate-700 bg-black/60 px-1 text-slate-200">
                                        {Object.entries(s?.napisy ?? {}).map(([k, n]) => <option key={k} value={k} disabled={k === 'z-kwestii' && !pr.kwestie}>{n}{k === 'z-kwestii' && !pr.kwestie ? ' (brak kwestii z czasem)' : ''}</option>)}
                                    </select>
                                </div>
                                <input value={tytul} onChange={(e) => setTytul(e.target.value)} placeholder="napis u góry pionu (opcja; propozycja ma własny)" className="w-full rounded border border-slate-700 bg-black/60 px-1.5 py-0.5 text-slate-200" />
                                {pr.propozycje.map((p) => (
                                    <div key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-800 px-2 py-1">
                                        <span className="text-slate-200">{p.nazwa}</span><span className="text-slate-500">{sek(p.od)}–{sek(p.do)} ({sek(p.do - p.od)})</span>
                                        {Object.entries(p.cele).map(([c, v]) => <span key={c} title={v.powod} className={v.ok ? 'text-emerald-400' : 'text-slate-600 line-through'}>{s?.cele[c]?.nazwa ?? c}</span>)}
                                        <button onClick={() => void zrob({ propozycja: p.id, ...(tytul ? {} : { tytul: p.tytul }) })} className="ml-auto rounded border border-fuchsia-500/40 px-2 text-fuchsia-200 hover:bg-fuchsia-900/30">✂️ zrób pion</button>
                                    </div>
                                ))}
                                <div className="flex flex-wrap items-center gap-2 rounded border border-slate-800 px-2 py-1 text-slate-400">
                                    wycinek: <input type="number" step={0.1} value={od} onChange={(e) => setOd(Number(e.target.value))} className="w-16 rounded bg-black/60 px-1 text-slate-200" />–
                                    <input type="number" step={0.1} value={doS} onChange={(e) => setDoS(Number(e.target.value))} className="w-16 rounded bg-black/60 px-1 text-slate-200" /> s ({sek(doS - od)})
                                    <button disabled={napisy === 'z-kwestii'} title={napisy === 'z-kwestii' ? 'napisy z kwestii mają czasy z propozycji — wybierz propozycję' : ''} onClick={() => void zrob({ od, do: doS, nazwa: `${sek(od)}–${sek(doS)}` })} className="ml-auto rounded border border-fuchsia-500/40 px-2 text-fuchsia-200 hover:bg-fuchsia-900/30 disabled:opacity-40">✂️ zrób wycinek</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {(s?.klipy ?? []).length === 0 && !problem && <p className="text-[10px] text-slate-500">Jeszcze żadnego klipu pionowego.</p>}
            <div className="space-y-2">
                {(s?.klipy ?? []).slice(0, 12).map((k) => (
                    <div key={k.id} className="flex gap-2 rounded border border-slate-800 p-2">
                        {k.stan === 'gotowy' && k.plik
                            ? <video src={`${MOST}/api/formaty/${k.id}/plik`} controls preload="metadata" className="h-40 w-[90px] shrink-0 rounded bg-black object-contain" />
                            : <div className="flex h-40 w-[90px] shrink-0 items-center justify-center rounded bg-black/50 text-[10px] text-slate-500">{STAN_KLIPU[k.stan] ?? k.stan}</div>}
                        <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <b className="text-slate-200">{k.nazwa}</b><span className="text-slate-500">{k.program.nazwa} · {k.nazwaZrodla}</span>
                                <span className="text-slate-400">{STAN_KLIPU[k.stan] ?? k.stan}{k.sekundy ? ` · ${sek(k.sekundy)}` : ''} · {s?.uklady[k.uklad] ?? k.uklad}</span>
                                {k.stan === 'blad' && <button onClick={() => void wolaj(`/api/formaty/${k.id}/ponow`, {}, 'Przerabiam ponownie.')} className="text-amber-200">↻ Przerób ponownie</button>}
                                <button onClick={() => confirm('Usunąć klip (plik pionu też)?') && void wolaj(`/api/formaty/${k.id}`, {}, 'Klip usunięty.', 'DELETE')} className="ml-auto text-slate-600 hover:text-rose-300">usuń</button>
                            </div>
                            {k.powod && <p className="text-[10px] text-rose-300">⚠ {k.powod}</p>}
                            {k.stan === 'gotowy' && SIECI.map(([siec, etykieta, cel]) => {
                                const p = k.publikacje?.[siec];
                                const c = k.cele?.[cel];
                                return (
                                    <div key={siec} className="flex flex-wrap items-start gap-2 text-[10px]">
                                        <span className="w-16 shrink-0 text-slate-300">{etykieta}</span>
                                        {!p || ['odrzucona', 'blad'].includes(p.etap) && siec === 'youtube' ? (
                                            <>
                                                {p && <span className="text-rose-300">{ETAP[p.etap]} {p.blad ?? ''}</span>}
                                                <button disabled={!c?.ok} title={c?.powod} onClick={() => void wolaj(`/api/formaty/${k.id}/publikuj`, { siec }, siec === 'youtube' ? 'Short czeka na ✓ w Publikacjach YouTube (Izba).' : 'Kronikarz napisał opis — czeka na Twoje ✓.')} className="rounded border border-slate-600 px-1.5 text-slate-200 disabled:opacity-40">→ do ✓</button>
                                                {!c?.ok && <span className="text-slate-500">{c?.powod}</span>}
                                            </>
                                        ) : siec === 'youtube' ? (
                                            <span className="text-slate-400">{ETAP[p.etap] ?? p.etap}{p.tytul ? ` · „${p.tytul}”` : ''}{p.kanalNazwa ? ` · ${p.kanalNazwa}` : ''}{p.etap === 'do_akceptacji' ? ' — ✓ w Publikacjach YouTube wyżej / Izbie' : ''}{p.url && <> · <a href={p.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">link</a></>}</span>
                                        ) : (
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <span className="text-slate-400">{ETAP[p.etap] ?? p.etap}{p.kontoNazwa ? ` · ${p.kontoNazwa}` : ''}{p.postep ? ` · ${p.postep}` : ''}{p.url && <> · <a href={p.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">link</a></>}</span>
                                                {p.blad && <p className="text-rose-300">⚠ {p.blad}</p>}
                                                {p.uwaga && <p className="text-amber-200">{p.uwaga}</p>}
                                                {['do_akceptacji', 'blad'].includes(p.etap) && (
                                                    <>
                                                        <textarea value={opisy[`${k.id}:${siec}`] ?? p.opis ?? ''} onChange={(e) => setOpisy((o) => ({ ...o, [`${k.id}:${siec}`]: e.target.value }))} rows={3} className="w-full rounded border border-slate-700 bg-black/60 px-1.5 py-0.5 text-slate-200" />
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {(sieci[siec]?.konta ?? []).length > 1 && (
                                                                <select value={p.kontoId} onChange={(e) => void wolaj(`/api/formaty/${k.id}/publikacja/${siec}/zmien`, { kontoId: e.target.value }, 'Konto zmienione.')} className="rounded border border-slate-700 bg-black/60 px-1 text-slate-200">
                                                                    {(sieci[siec]?.konta ?? []).map((x) => <option key={x.id} value={x.id}>{x.nazwa}</option>)}
                                                                </select>
                                                            )}
                                                            {opisy[`${k.id}:${siec}`] !== undefined && opisy[`${k.id}:${siec}`] !== p.opis && <button onClick={() => void wolaj(`/api/formaty/${k.id}/publikacja/${siec}/zmien`, { opis: opisy[`${k.id}:${siec}`] }, 'Opis zapisany.')} className="rounded border border-slate-600 px-1.5 text-slate-200">💾 opis</button>}
                                                            {p.etap === 'do_akceptacji' && <button onClick={() => confirm(siec === 'instagram' ? `Opublikować Reel PUBLICZNIE na ${p.kontoNazwa}? Instagram nie ma szkiców.` : `Wysłać szkic do skrzynki TikTok (${p.kontoNazwa})? Opis wkleisz w aplikacji.`) && void wolaj(`/api/formaty/${k.id}/publikacja/${siec}/zatwierdz`, {}, siec === 'instagram' ? 'Wysyłam Reel — przetwarzanie trwa minuty.' : 'Szkic poszedł do TikTok.')} className="rounded border border-emerald-500/50 px-2 text-emerald-200">✓ wyślij</button>}
                                                            <button onClick={() => void wolaj(`/api/formaty/${k.id}/publikacja/${siec}/odrzuc`, {}, 'Odrzucone.')} className="text-slate-500 hover:text-rose-300">✕</button>
                                                            {siec === 'tiktok' && <span className="text-slate-500">API szkicu nie bierze opisu — przeniesiesz go kodem QR niżej.</span>}
                                                        </div>
                                                    </>
                                                )}
                                                {siec === 'tiktok' && p.etap !== 'odrzucona' && <OpisNaTelefon opis={opisy[`${k.id}:${siec}`] ?? p.opis ?? ''} />}
                                                {p.etap === 'blad' && <button onClick={() => void wolaj(`/api/formaty/${k.id}/publikacja/${siec}/zmien`, { opis: opisy[`${k.id}:${siec}`] ?? p.opis ?? '' }, 'Znów czeka na Twoje ✓.')} className="text-amber-200">↻ wróć do ✓</button>}
                                                {p.etap === 'odrzucona' && <button onClick={() => void wolaj(`/api/formaty/${k.id}/publikuj`, { siec }, 'Znów do ✓.')} className="text-slate-400">↻ ponownie do ✓</button>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FormatyPanel;
