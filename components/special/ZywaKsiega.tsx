/**
 * 📖 Żywa Księga — Iskra Suwerena (parę słów + nagranie twarzy znad stołu), stado dotwarza słowo i ilustrację,
 * a Suweren może dorysować żywą kreskę AniDoodle na pergaminie. Most: services/ZywaKsiega.js, trasy /api/zywa-ksiega*.
 *
 * Wygląd (pergamin z okuciami, sfera Ciała Świetlistego, drgająca kreska) z prototypu Gemini Canvas
 * (`_OtakOs_Components/zywa_ksi_ga_multimedialny_dziennik.tsx`); tam „chmura” była Firestore'em Canvasa,
 * nagranie się nie zapisywało, a „media Stada” dokładał ręcznie gość — tu dane i nagranie leżą w Katedrze.
 * Sfera w czasie nagrania oddycha głośnością Twojego głosu (AnalyserNode), nie zegarem.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';

interface Kreska { kolor: string; grubosc: number; punkty: [number, number][] }
interface Rysunek { id: string; kto: string; tytul: string | null; kiedy: string; klatki: Kreska[][] }
interface Dodatek { rodzaj: 'slowo' | 'ilustracja'; kto: string; stan: 'czeka' | 'robi' | 'gotowe' | 'blad'; tekst?: string | null; plik?: string | null; powod?: string | null; model?: string | null }
interface Wpis { id: string; kiedy: string; tekst: string; publiczny: boolean; zdjecie?: { plik: string; kiedy: string } | null; nagranie: { plik: string; kiedy: string; sekundy: number | null } | null; rysunki: Rysunek[]; stado: Dodatek[] }

const KTO: Record<string, string> = { kronikarz: '📜 Kronikarz', paleta: '🎨 Paleta', suweren: '👑 Suweren' };
const ATRAMENTY = [{ kolor: '#2c1810', nazwa: 'Sepia' }, { kolor: '#b45309', nazwa: 'Złoty ochra' }, { kolor: '#991b1b', nazwa: 'Karmin' }, { kolor: '#0e7490', nazwa: 'Cyjan' }];

async function zMostu<T>(sciezka: string, init?: RequestInit & { surowe?: boolean }): Promise<T> {
    let r: Response;
    try { r = await fetch(`${MOST}${sciezka}`, { ...init, headers: init?.body && !init.surowe ? { 'Content-Type': 'application/json' } : init?.headers }); }
    catch { throw new Error('Most (127.0.0.1:3001) milczy — odpal Katedrę.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.success === false) throw new Error(d?.message || `Most odpowiedział HTTP ${r.status}`);
    return d as T;
}
const plikUrl = (w: Wpis, plik: string) => `${MOST}/api/zywa-ksiega/${w.id}/plik/${plik}?v=${encodeURIComponent((plik === w.zdjecie?.plik ? w.zdjecie?.kiedy : w.nagranie?.kiedy) ?? w.kiedy)}`;
const wyslijZdjecie = (id: string, plik: File) => zMostu(`/api/zywa-ksiega/${id}/zdjecie`, { method: 'POST', body: plik, surowe: true, headers: { 'Content-Type': plik.type || 'image/jpeg' } });

/** 📷 Wybór zdjęcia: plik albo upuszczenie; most robi z niego JPEG bez metadanych (GPS nie wychodzi). */
function WyborZdjecia({ plik, ustaw }: { plik: File | null; ustaw: (f: File | null) => void }) {
    const url = React.useMemo(() => (plik ? URL.createObjectURL(plik) : null), [plik]);
    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
    const wez = (f?: File | null) => { if (f && f.type.startsWith('image/')) ustaw(f); };
    return (
        <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); wez(e.dataTransfer.files?.[0]); }}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-amber-700/50 bg-black/30 p-2 text-xs text-amber-200/80">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => wez(e.target.files?.[0])} />
            {url ? <img src={url} alt="Wybrane zdjęcie" className="h-16 w-16 rounded-lg object-cover" /> : <span className="text-2xl">📷</span>}
            <span>{plik ? `${plik.name} · ${(plik.size / 1024 / 1024).toFixed(1)} MB` : 'Zdjęcie do wpisu — kliknij albo upuść (EXIF i GPS zostaną zdjęte)'}</span>
            {plik && <button onClick={(e) => { e.preventDefault(); ustaw(null); }} className="ml-auto text-rose-300">✕</button>}
        </label>
    );
}

// ── pergamin i kreska ────────────────────────────────────────────────────────
function pergamin(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, '#f8ecd4'); g.addColorStop(0.75, '#e5cca0'); g.addColorStop(1, '#c4a168');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120, 75, 30, 0.07)'; ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}
function kreski(ctx: CanvasRenderingContext2D, lista: Kreska[], w: number, h: number, drganie = 0, alfa = 1) {
    ctx.save(); ctx.globalAlpha = alfa; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const k of lista) {
        if (k.punkty.length < 2) continue;
        ctx.beginPath(); ctx.strokeStyle = k.kolor; ctx.lineWidth = k.grubosc;
        k.punkty.forEach(([x, y], i) => {
            const jx = drganie ? Math.sin(i * 1.7 + drganie * 2.3) * 1.6 : 0;
            const jy = drganie ? Math.cos(i * 2.1 + drganie * 1.9) * 1.6 : 0;
            if (i === 0) ctx.moveTo(x * w + jx, y * h + jy); else ctx.lineTo(x * w + jx, y * h + jy);
        });
        ctx.stroke();
    }
    ctx.restore();
}
/** Żywa kreska: jedna klatka drga sama (boil), kilka klatek gra po kolei ~7 kl./s. */
function OdtwarzaczRysunku({ klatki }: { klatki: Kreska[][] }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const c = ref.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return;
        let id = 0, nr = 0, ostatnio = 0;
        const krok = (t: number) => {
            if (t - ostatnio > 140) {
                nr++; ostatnio = t;
                pergamin(ctx, c.width, c.height);
                if (klatki.length === 1) kreski(ctx, klatki[0], c.width, c.height, (nr % 3) + 1);
                else kreski(ctx, klatki[nr % klatki.length], c.width, c.height);
            }
            id = requestAnimationFrame(krok);
        };
        id = requestAnimationFrame(krok);
        return () => cancelAnimationFrame(id);
    }, [klatki]);
    return <canvas ref={ref} width={480} height={240} className="block h-40 w-full" />;
}

function PlotnoRysunku({ onZapisz, onAnuluj }: { onZapisz: (klatki: Kreska[][], tytul: string) => Promise<void>; onAnuluj: () => void }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const [klatki, setKlatki] = useState<Kreska[][]>([[], [], []]);
    const [nr, setNr] = useState(0);
    const [poklatkowo, setPoklatkowo] = useState(false);
    const [kolor, setKolor] = useState(ATRAMENTY[0].kolor);
    const [podglad, setPodglad] = useState(false);
    const [tytul, setTytul] = useState('');
    const [zapisuje, setZapisuje] = useState(false);
    const rysuje = useRef(false);
    const gotowe = poklatkowo ? klatki.filter((k) => k.length) : [klatki[0]].filter((k) => k.length);

    useEffect(() => {
        const c = ref.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return;
        if (podglad && gotowe.length) {
            let id = 0, i = 0, ost = 0;
            const krok = (t: number) => {
                if (t - ost > 140) { i++; ost = t; pergamin(ctx, c.width, c.height); if (gotowe.length === 1) kreski(ctx, gotowe[0], c.width, c.height, (i % 3) + 1); else kreski(ctx, gotowe[i % gotowe.length], c.width, c.height); }
                id = requestAnimationFrame(krok);
            };
            id = requestAnimationFrame(krok);
            return () => cancelAnimationFrame(id);
        }
        pergamin(ctx, c.width, c.height);
        if (poklatkowo && nr > 0) kreski(ctx, klatki[nr - 1], c.width, c.height, 0, 0.22);   // cień poprzedniej klatki
        kreski(ctx, klatki[nr], c.width, c.height);
    }, [klatki, nr, poklatkowo, podglad]); // eslint-disable-line react-hooks/exhaustive-deps

    const punkt = (e: React.PointerEvent): [number, number] => {
        const r = ref.current!.getBoundingClientRect();
        return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
    };
    const start = (e: React.PointerEvent) => {
        if (podglad) return;
        rysuje.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const p = punkt(e);
        setKlatki((k) => k.map((kl, i) => (i === nr ? [...kl, { kolor, grubosc: 3, punkty: [p] }] : kl)));
    };
    const ruch = (e: React.PointerEvent) => {
        if (!rysuje.current) return;
        const p = punkt(e);
        setKlatki((k) => k.map((kl, i) => (i === nr && kl.length ? [...kl.slice(0, -1), { ...kl[kl.length - 1], punkty: [...kl[kl.length - 1].punkty, p] }] : kl)));
    };

    return (
        <div className="space-y-2 rounded-2xl border-2 border-amber-700/60 bg-[#1a130c] p-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-bold text-amber-200">✒️ Karta pergaminu</span>
                <button onClick={() => { setPoklatkowo(false); setNr(0); }} className={`rounded-sm px-2 py-0.5 ${!poklatkowo ? 'bg-amber-600 text-slate-950' : 'text-amber-300/70'}`}>żywa kreska (1 szkic)</button>
                <button onClick={() => setPoklatkowo(true)} className={`rounded-sm px-2 py-0.5 ${poklatkowo ? 'bg-amber-600 text-slate-950' : 'text-amber-300/70'}`}>poklatkowo (3)</button>
                {poklatkowo && [0, 1, 2].map((i) => <button key={i} onClick={() => { setPodglad(false); setNr(i); }} className={`rounded-sm px-2 py-0.5 font-mono ${nr === i && !podglad ? 'bg-amber-500 text-slate-950' : 'border border-amber-800/40 text-amber-300'}`}>klatka {i + 1}</button>)}
                <span className="ml-auto flex items-center gap-1">{ATRAMENTY.map((a) => <button key={a.kolor} title={a.nazwa} onClick={() => setKolor(a.kolor)} className={`h-5 w-5 rounded-full border-2 ${kolor === a.kolor ? 'scale-125 border-amber-300' : 'border-transparent'}`} style={{ backgroundColor: a.kolor }} />)}</span>
            </div>
            <div className="relative mx-auto max-w-lg overflow-hidden rounded-xl border-4 border-[#5c3a21]">
                <canvas ref={ref} width={480} height={240} onPointerDown={start} onPointerMove={ruch} onPointerUp={() => { rysuje.current = false; }} className="block h-56 w-full cursor-crosshair touch-none" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <input value={tytul} onChange={(e) => setTytul(e.target.value)} maxLength={80} placeholder="tytuł rysunku (opcjonalnie)" className="min-w-0 flex-1 rounded-sm border border-amber-900/50 bg-black/40 px-2 py-1 text-xs text-amber-100" />
                <button onClick={() => setPodglad(!podglad)} disabled={!gotowe.length} className="rounded-sm border border-amber-500/40 px-2 py-1 text-xs text-amber-300 disabled:opacity-40">{podglad ? '⏸ stop' : '▶ ożyw'}</button>
                <button onClick={() => { setKlatki([[], [], []]); setPodglad(false); }} className="rounded-sm px-2 py-1 text-xs text-slate-400 hover:text-rose-300">↺ wyczyść</button>
                <button onClick={onAnuluj} className="rounded-sm px-2 py-1 text-xs text-slate-400">anuluj</button>
                <button disabled={!gotowe.length || zapisuje} onClick={async () => { setZapisuje(true); try { await onZapisz(gotowe, tytul); } finally { setZapisuje(false); } }}
                    className="rounded-sm bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 disabled:opacity-40">{zapisuje ? 'zapisuję…' : '💾 do wpisu'}</button>
            </div>
        </div>
    );
}

// ── sfera Ciała Świetlistego ─────────────────────────────────────────────────
function SferaSwiatla({ glosnosc, znakow }: { glosnosc: React.MutableRefObject<number>; znakow: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const c = ref.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return;
        let id = 0, t = 0, wygl = 0;
        const dopasuj = () => { const p = c.parentElement; if (p) { c.width = p.clientWidth; c.height = p.clientHeight; } };
        dopasuj(); addEventListener('resize', dopasuj);
        const krok = () => {
            wygl += (glosnosc.current - wygl) * 0.2;   // głos oddycha płynnie
            t += 0.015 * (1 + Math.min(znakow * 0.01, 1) + wygl * 4);
            const w = c.width, h = c.height, cx = w / 2, cy = h / 2, r0 = Math.min(cx, cy) * 0.42 * (1 + wygl * 0.35);
            ctx.clearRect(0, 0, w, h);
            const aura = ctx.createRadialGradient(cx, cy, r0 * 0.2, cx, cy, r0 * 2);
            aura.addColorStop(0, `rgba(245,158,11,${0.3 + wygl * 0.4})`); aura.addColorStop(0.5, 'rgba(6,182,212,0.15)'); aura.addColorStop(1, 'rgba(15,23,42,0)');
            ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, r0 * 2, 0, Math.PI * 2); ctx.fill();
            for (let ring = 0; ring < 4; ring++) {
                ctx.beginPath();
                for (let i = 0; i <= 120; i++) {
                    const a = (i / 120) * Math.PI * 2;
                    const r = r0 + Math.sin(a * (3 + ring) + t) * (8 + ring * 3) * (1 + wygl * 2) + Math.cos(a * (5 - ring) - t * 1.3) * 6 + (ring * 6 - 9);
                    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
                }
                ctx.closePath();
                ctx.strokeStyle = ring % 2 ? `rgba(34,211,238,${0.6 - ring * 0.12})` : `rgba(251,191,36,${0.7 - ring * 0.15})`;
                ctx.lineWidth = 2.5 - ring * 0.4; ctx.shadowBlur = 12; ctx.shadowColor = ctx.strokeStyle; ctx.stroke(); ctx.shadowBlur = 0;
            }
            const puls = Math.sin(t * 2) * 0.08 + 1;
            const rdzen = ctx.createRadialGradient(cx - r0 * 0.2, cy - r0 * 0.2, r0 * 0.05, cx, cy, r0 * 0.85 * puls);
            rdzen.addColorStop(0, '#ffffff'); rdzen.addColorStop(0.3, '#fde68a'); rdzen.addColorStop(0.7, '#f59e0b'); rdzen.addColorStop(1, 'rgba(6,182,212,0.2)');
            ctx.fillStyle = rdzen; ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.75 * puls, 0, Math.PI * 2); ctx.fill();
            id = requestAnimationFrame(krok);
        };
        krok();
        return () => { cancelAnimationFrame(id); removeEventListener('resize', dopasuj); };
    }, [glosnosc, znakow]);
    return <canvas ref={ref} className="block h-full w-full" />;
}

// ── nagranie twarzy ──────────────────────────────────────────────────────────
function useNagrywarka(glosnosc: React.MutableRefObject<number>) {
    const podgladRef = useRef<HTMLVideoElement>(null);
    const strumien = useRef<MediaStream | null>(null);
    const nagrywarka = useRef<MediaRecorder | null>(null);
    const kawalki = useRef<Blob[]>([]);
    const dzwiek = useRef<{ ctx: AudioContext; id: number } | null>(null);
    const [stan, setStan] = useState<'wyl' | 'podglad' | 'nagrywa' | 'gotowe'>('wyl');
    const [nagranie, setNagranie] = useState<Blob | null>(null);
    const [blad, setBlad] = useState('');

    const zatrzymajWszystko = useCallback(() => {
        strumien.current?.getTracks().forEach((t) => t.stop()); strumien.current = null;
        if (dzwiek.current) { cancelAnimationFrame(dzwiek.current.id); void dzwiek.current.ctx.close(); dzwiek.current = null; }
        glosnosc.current = 0;
    }, [glosnosc]);
    useEffect(() => zatrzymajWszystko, [zatrzymajWszystko]);

    const wlacz = async () => {
        setBlad('');
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            strumien.current = s;
            if (podgladRef.current) { podgladRef.current.srcObject = s; void podgladRef.current.play(); }
            const ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 512;
            ctx.createMediaStreamSource(s).connect(an);
            const buf = new Uint8Array(an.fftSize);
            const krok = () => { an.getByteTimeDomainData(buf); let suma = 0; for (const v of buf) suma += ((v - 128) / 128) ** 2; glosnosc.current = Math.min(1, Math.sqrt(suma / buf.length) * 4); dzwiek.current!.id = requestAnimationFrame(krok); };
            dzwiek.current = { ctx, id: requestAnimationFrame(krok) };
            setStan('podglad');
        } catch (e) { setBlad(`Brak dostępu do kamery/mikrofonu: ${(e as Error).message}. Wpis możesz zostawić bez nagrania i dograć je później.`); }
    };
    const nagrywaj = () => {
        if (!strumien.current) return;
        kawalki.current = [];
        const typ = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
        const r = new MediaRecorder(strumien.current, typ ? { mimeType: typ } : undefined);
        r.ondataavailable = (e) => { if (e.data.size) kawalki.current.push(e.data); };
        r.onstop = () => { setNagranie(new Blob(kawalki.current, { type: 'video/webm' })); setStan('gotowe'); zatrzymajWszystko(); };
        r.start(1000); nagrywarka.current = r; setStan('nagrywa');
    };
    const stop = () => nagrywarka.current?.state === 'recording' && nagrywarka.current.stop();
    const odrzuc = () => { zatrzymajWszystko(); setNagranie(null); setStan('wyl'); };
    return { podgladRef, stan, nagranie, blad, wlacz, nagrywaj, stop, odrzuc };
}

/** Panel nagrania: do nowej Iskry albo dogranie do istniejącego wpisu. */
function PanelNagrania({ n, glosnosc, znakow }: { n: ReturnType<typeof useNagrywarka>; glosnosc: React.MutableRefObject<number>; znakow: number }) {
    const url = n.nagranie ? URL.createObjectURL(n.nagranie) : null;
    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            <div className="relative h-56 overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-950/80">
                <SferaSwiatla glosnosc={glosnosc} znakow={znakow} />
                <span className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-amber-200/70">✨ Ciało Świetliste {n.stan === 'nagrywa' ? '· oddycha Twoim głosem' : ''}</span>
            </div>
            <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/20 bg-black">
                <video ref={n.podgladRef} muted playsInline className={`h-full w-full object-cover ${n.stan === 'podglad' || n.stan === 'nagrywa' ? '' : 'hidden'}`} />
                {n.stan === 'gotowe' && url && <video src={url} controls className="h-full w-full object-cover" />}
                {n.stan === 'wyl' && <button onClick={n.wlacz} className="rounded-xl border border-amber-500/40 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/10">🎥 Włącz kamerę znad stołu</button>}
                <div className="absolute bottom-2 right-2 flex gap-1">
                    {n.stan === 'podglad' && <button onClick={n.nagrywaj} className="rounded-sm bg-rose-600 px-2 py-1 text-[11px] font-bold text-white">⏺ Nagrywaj</button>}
                    {n.stan === 'nagrywa' && <button onClick={n.stop} className="animate-pulse rounded-sm bg-rose-700 px-2 py-1 text-[11px] font-bold text-white">⏹ Stop</button>}
                    {n.stan !== 'wyl' && n.stan !== 'nagrywa' && <button onClick={n.odrzuc} className="rounded-sm bg-black/60 px-2 py-1 text-[11px] text-slate-300">✕</button>}
                </div>
            </div>
            {n.blad && <div className="text-[11px] text-rose-300 sm:col-span-2">⚠ {n.blad}</div>}
        </div>
    );
}

// ── karta wpisu ──────────────────────────────────────────────────────────────
function KartaWpisu({ w, odswiez, ustawBlad }: { w: Wpis; odswiez: () => void; ustawBlad: (b: string) => void }) {
    const [rysuje, setRysuje] = useState(false);
    const [dogrywa, setDogrywa] = useState(false);
    const [wysyla, setWysyla] = useState(false);
    const [fotka, setFotka] = useState<File | null>(null);
    const [zdjeciem, setZdjeciem] = useState(false);
    const glosnosc = useRef(0);
    const n = useNagrywarka(glosnosc);
    const slowo = w.stado.find((s) => s.rodzaj === 'slowo');
    const il = w.stado.find((s) => s.rodzaj === 'ilustracja');
    const akcja = async (f: () => Promise<unknown>) => { try { await f(); odswiez(); } catch (e) { ustawBlad((e as Error).message); } };
    const stanDodatku = (d?: Dodatek) => !d ? null : d.stan === 'gotowe' ? null : d.stan === 'blad' ? <span className="text-rose-300">⚠ {d.powod}</span> : <span className="animate-pulse text-amber-300/80">{d.stan === 'robi' ? 'tworzy…' : 'czeka w kolejce…'}</span>;
    return (
        <article className="relative overflow-hidden rounded-2xl border-4 border-[#3b2314] bg-[#1c120a] p-1 shadow-2xl">
            {['left-0 top-0 rounded-br-md', 'right-0 top-0 rounded-bl-md', 'bottom-0 left-0 rounded-tr-md', 'bottom-0 right-0 rounded-tl-md'].map((c) => <div key={c} className={`pointer-events-none absolute z-10 h-5 w-5 bg-gradient-to-br from-amber-300 to-amber-700 ${c}`} />)}
            <div className="rounded-xl bg-[#f3e4c4] p-4 text-[#2c1810]">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-[#7a5230]">
                    <span>📅 {new Date(w.kiedy).toLocaleString('pl-PL', { dateStyle: 'full', timeStyle: 'short' })}</span>
                    <button onClick={() => akcja(() => zMostu(`/api/zywa-ksiega/${w.id}`, { method: 'PUT', body: JSON.stringify({ publiczny: !w.publiczny }) }))} className="rounded-sm border border-[#b08a5a] px-1.5" title="🌍 = widać na otakos.wtf (przez tunel Katedry), 🔒 = tylko w tej Katedrze">{w.publiczny ? '🌍 dla świata' : '🔒 tylko ja'}</button>
                    <button onClick={() => { if (confirm('Wpis pójdzie do kosza Księgi (_kosz) — usunąć?')) void akcja(() => zMostu(`/api/zywa-ksiega/${w.id}`, { method: 'DELETE' })); }} className="ml-auto text-[#a0522d] hover:text-rose-700">🗑</button>
                </div>
                {w.zdjecie && <img src={plikUrl(w, w.zdjecie.plik)} alt="Zdjęcie Suwerena" className="float-right mb-2 ml-3 max-h-64 w-auto max-w-[45%] rounded-lg border-2 border-[#5c3a21] object-cover shadow-md" />}
                <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed">{w.tekst}</p>
                <div className="clear-both" />
                {w.nagranie && <video src={plikUrl(w, w.nagranie.plik)} controls className="mt-3 max-h-80 w-full rounded-lg border-2 border-[#5c3a21] bg-black" />}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#c4a168] bg-[#efdcb4] p-3 text-sm">
                        <div className="mb-1 text-[11px] font-bold text-[#7a5230]">{KTO.kronikarz} odpowiada</div>
                        {slowo?.stan === 'gotowe' ? <p className="font-serif italic">{slowo.tekst}</p> : <div className="text-[11px]">{stanDodatku(slowo)}</div>}
                    </div>
                    <div className="overflow-hidden rounded-lg border border-[#c4a168] bg-[#efdcb4]">
                        <div className="px-3 pt-2 text-[11px] font-bold text-[#7a5230]">{KTO.paleta} maluje</div>
                        {il?.stan === 'gotowe' && il.plik ? <img src={plikUrl(w, il.plik)} alt="Ilustracja stada" className="mt-1 w-full" /> : <div className="p-3 text-[11px]">{stanDodatku(il)}</div>}
                    </div>
                </div>
                {w.rysunki.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{w.rysunki.map((r) => (
                    <figure key={r.id} className="overflow-hidden rounded-lg border-2 border-[#5c3a21]"><OdtwarzaczRysunku klatki={r.klatki} /><figcaption className="bg-[#2a1a0e] px-2 py-1 text-[10px] text-amber-200">✒️ {r.tytul || 'żywa kreska'} · {KTO[r.kto] ?? r.kto}</figcaption></figure>
                ))}</div>}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    {w.stado.some((s) => s.stan === 'blad') && <button onClick={() => akcja(() => zMostu(`/api/zywa-ksiega/${w.id}/stado`, { method: 'POST' }))} className="rounded-sm border border-[#8b5a2b] px-2 py-0.5">↻ stado jeszcze raz</button>}
                    <button onClick={() => setRysuje(!rysuje)} className="rounded-sm border border-[#8b5a2b] px-2 py-0.5">✒️ dorysuj na pergaminie</button>
                    <button onClick={() => setZdjeciem(!zdjeciem)} className="rounded-sm border border-[#8b5a2b] px-2 py-0.5">📷 {w.zdjecie ? 'zmień zdjęcie' : 'dodaj zdjęcie'}</button>
                    {w.zdjecie && <button onClick={() => { if (confirm('Zdjąć zdjęcie z wpisu?')) void akcja(() => zMostu(`/api/zywa-ksiega/${w.id}/zdjecie`, { method: 'DELETE' })); }} className="rounded-sm border border-[#8b5a2b] px-2 py-0.5">✕ zdjęcie</button>}
                    <button onClick={() => setDogrywa(!dogrywa)} className="rounded-sm border border-[#8b5a2b] px-2 py-0.5">🎥 {w.nagranie ? 'nagraj ponownie' : 'dograj nagranie'}</button>
                </div>
            </div>
            {rysuje && <div className="p-2"><PlotnoRysunku onAnuluj={() => setRysuje(false)} onZapisz={async (klatki, tytul) => {
                await akcja(() => zMostu(`/api/zywa-ksiega/${w.id}/rysunek`, { method: 'POST', body: JSON.stringify({ tytul, rysunek: { klatki } }) })); setRysuje(false);
            }} /></div>}
            {zdjeciem && <div className="space-y-2 p-2">
                <WyborZdjecia plik={fotka} ustaw={setFotka} />
                {fotka && <button disabled={wysyla} onClick={async () => {
                    setWysyla(true); await akcja(() => wyslijZdjecie(w.id, fotka)); setWysyla(false); setZdjeciem(false); setFotka(null);
                }} className="rounded-sm bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">{wysyla ? 'zapisuję zdjęcie…' : '💾 dołóż zdjęcie do wpisu'}</button>}
            </div>}
            {dogrywa && <div className="space-y-2 p-2">
                <PanelNagrania n={n} glosnosc={glosnosc} znakow={0} />
                {n.nagranie && <button disabled={wysyla} onClick={async () => {
                    setWysyla(true);
                    await akcja(() => zMostu(`/api/zywa-ksiega/${w.id}/nagranie`, { method: 'POST', body: n.nagranie, surowe: true, headers: { 'Content-Type': 'video/webm' } }));
                    setWysyla(false); setDogrywa(false); n.odrzuc();
                }} className="rounded-sm bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">{wysyla ? 'zapisuję nagranie…' : '💾 dołóż nagranie do wpisu'}</button>}
            </div>}
        </article>
    );
}

export default function ZywaKsiega() {
    const [wpisy, setWpisy] = useState<Wpis[] | null>(null);
    const [tekst, setTekst] = useState('');
    const [publiczny, setPubliczny] = useState(true);
    const [zapisuje, setZapisuje] = useState('');
    const [blad, setBlad] = useState('');
    const [fotka, setFotka] = useState<File | null>(null);
    const glosnosc = useRef(0);
    const n = useNagrywarka(glosnosc);

    const odswiez = useCallback(async () => {
        try { setWpisy((await zMostu<{ wpisy: Wpis[] }>('/api/zywa-ksiega')).wpisy); setBlad(''); }
        catch (e) { setBlad((e as Error).message); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);
    // stado pracuje → odświeżaj co 5 s, aż skończy
    const pracuje = wpisy?.some((w) => w.stado.some((s) => s.stan === 'czeka' || s.stan === 'robi'));
    useEffect(() => { if (!pracuje) return; const t = setInterval(() => void odswiez(), 5000); return () => clearInterval(t); }, [pracuje, odswiez]);

    const zostaw = async () => {
        setBlad('');
        try {
            setZapisuje('zapisuję Iskrę…');
            const { wpis } = await zMostu<{ wpis: Wpis }>('/api/zywa-ksiega', { method: 'POST', body: JSON.stringify({ tekst, publiczny }) });
            if (fotka) { setZapisuje('zapisuję zdjęcie…'); await wyslijZdjecie(wpis.id, fotka); }
            if (n.nagranie) {
                setZapisuje('zapisuję nagranie (ffmpeg)…');
                await zMostu(`/api/zywa-ksiega/${wpis.id}/nagranie`, { method: 'POST', body: n.nagranie, surowe: true, headers: { 'Content-Type': 'video/webm' } });
            }
            setTekst(''); setFotka(null); n.odrzuc(); await odswiez();
        } catch (e) { setBlad((e as Error).message); } finally { setZapisuje(''); }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-4 text-amber-50">
            <header className="text-center">
                <h1 className="font-serif text-3xl text-amber-300 drop-shadow">📖 Żywa Księga</h1>
                <p className="text-xs text-amber-200/60">Twoja Iskra rano — stado dotwarza słowo i obraz. Wszystko leży w Twojej Katedrze.</p>
            </header>

            <section className="space-y-3 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-slate-950 to-[#160f08] p-4 shadow-[0_0_40px_rgba(245,158,11,0.08)]">
                <div className="text-sm font-bold text-amber-200">✨ Wrzutnia Iskry</div>
                <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} maxLength={4000} rows={4} placeholder="Parę słów z przepływu…"
                    className="w-full rounded-xl border border-amber-700/40 bg-black/40 p-3 font-serif text-base text-amber-50 placeholder:text-amber-200/30" />
                <WyborZdjecia plik={fotka} ustaw={setFotka} />
                <PanelNagrania n={n} glosnosc={glosnosc} znakow={tekst.length} />
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1 text-xs text-amber-200/80"><input type="checkbox" checked={publiczny} onChange={(e) => setPubliczny(e.target.checked)} /> 🌍 dla świata (otakos.wtf)</label>
                    <button disabled={!tekst.trim() || !!zapisuje || n.stan === 'nagrywa'} onClick={zostaw}
                        className="ml-auto rounded-xl bg-gradient-to-r from-amber-500 to-amber-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">
                        {zapisuje || `📖 Zostaw Iskrę w Księdze${[fotka && 'zdjęcie', n.nagranie && 'nagranie'].filter(Boolean).length ? ` (z: ${[fotka && 'zdjęcie', n.nagranie && 'nagranie'].filter(Boolean).join(', ')})` : ''}`}
                    </button>
                </div>
                {blad && <div className="text-xs text-rose-300">⚠ {blad}</div>}
            </section>

            {wpisy === null ? <div className="text-center text-xs text-amber-200/50">otwieram Księgę…</div>
                : wpisy.length === 0 ? <div className="text-center text-sm text-amber-200/60">Księga czeka na pierwszą Iskrę.</div>
                    : <div className="space-y-6">{wpisy.map((w) => <KartaWpisu key={w.id} w={w} odswiez={() => void odswiez()} ustawBlad={setBlad} />)}</div>}
        </div>
    );
}
