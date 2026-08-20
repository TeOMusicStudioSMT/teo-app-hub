/**
 * 🏢 YourBusinessPanel.tsx — moduł „Twoje Biznesy" (Etap 3).
 *
 * Szklany kokpit Cyber-Minimalizmu 0.00G, spinający cztery rzeczy:
 *   1. KARTY DZIAŁALNOŚCI — firmy, strony, usługi Suwerena + bilans GRV
 *      wypracowany Służbą (liczony z księgi zdarzeń po stronie mostu).
 *   2. VOICE & AGENT DISPATCHER — który sklonowany głos obsługuje którą firmę
 *      i czym ten głos jest liczony.
 *   3. LIVE ORDERS & AI DIAL CONSOLE — feed zdarzeń Służby oraz konsola
 *      autonomicznego połączenia.
 *   4. LIVE CALL MONITOR — Kwantowy Tunel, rozmowy w toku, transkrypcja na
 *      żywo, latencja, naliczone GRV i mikrofon Suwerena.
 *
 * ⚠️ TRZY MIEJSCA, W KTÓRYCH TEN PANEL CELOWO NIE ŁADNIE WYGLĄDA:
 *
 *  · Most nie odpowiada → czerwony ekran z powodem, NIE puste karty. Panel,
 *    który przy padniętym moście rysuje zera, kłamie w sprawie pieniędzy.
 *  · Przewód bez sterownika → szara plakietka „bez sterownika", nawet gdy klucz
 *    leży w Skarbcu. `podpiety` i `sterownik` to dwie różne rzeczy.
 *  · Konsola Dial → dwa osobne przyciski. „Próba" sprawdza wszystko i NIE
 *    dzwoni; realny telefon wymaga jeszcze zaznaczonej zgody, która gaśnie po
 *    każdym połączeniu. Jedno kliknięcie nie ma prawa zadzwonić do człowieka.
 *  · Monitor → gdy nic nie leci, pisze „cisza na linii", zamiast rysować
 *    atrapę rozmowy. Po przejęciu mikrofonu AI NIE wraca samo — powrót jest
 *    osobnym kliknięciem, bo bot wtrącający się w przejętą rozmowę to katastrofa.
 *
 * @author Klaudiusz 0.00G dla Suwerena
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
    Building2, Plus, RefreshCw, X, Wallet, Mic2, PhoneCall, Radio,
    Users, Zap, AlertTriangle, CheckCircle2, PlugZap, Volume2, Save,
    Trash2, Globe, Sparkles, ScrollText, Waves, Network, Hand, Bot,
} from 'lucide-react';

import {
    pobierzBiznesy, dodajBiznes, usunBiznes, przypiszGlos,
    zglosSluzbe, pobierzZdarzenia, zadzwon, stanTelefonii,
    type Biznes, type StanBiznesow, type ZdarzenieSluzby, type AkcjaSluzby, type RodzajBiznesu,
    type StanTelefonii, type WynikDial,
} from '../services/businessService';
import {
    stanPrzewodow, pobierzProfile, zapiszProfil, usunProfil,
    mowProfilem, renderujDoPliku, glosyElevenLabs,
    type ProfilGlosu, type StanPrzewodow, type GlosElevenLabs,
} from '../services/voiceMcpService';
import {
    sluchajLive, pobierzRozmowy, przejmijRozmowe, oddajRozmowe, rozlaczRozmowe,
    stanTunelu, ustawTunel, zdejmijTunel,
    type ZdarzenieLive, type StanRozmowy, type StanTunelu,
} from '../services/liveCallService';
import { AGENTS_COLLECTIVE } from '../services/mcpMarketService';

interface YourBusinessPanelProps {
    onClose?: () => void;
    embedded?: boolean;
}

const RODZAJE: { id: RodzajBiznesu; label: string; glyph: string }[] = [
    { id: 'usluga', label: 'Usługa', glyph: '🛠️' },
    { id: 'strona', label: 'Strona / portal', glyph: '🌐' },
    { id: 'sklep', label: 'Sklep', glyph: '🛒' },
    { id: 'lokal', label: 'Lokal / miejsce', glyph: '📍' },
    { id: 'studio', label: 'Studio / produkcja', glyph: '🎬' },
];

const AKCJE: { id: AkcjaSluzby; label: string; klasa: 'RUCH' | 'WYNIK' }[] = [
    { id: 'klient.obsluzony', label: 'Obsłużony klient', klasa: 'RUCH' },
    { id: 'oferta.wygenerowana', label: 'Wygenerowana oferta', klasa: 'RUCH' },
    { id: 'rozmowa.domknieta', label: 'Domknięta rozmowa AI', klasa: 'RUCH' },
    { id: 'zamowienie.zlozone', label: 'Złożone zamówienie', klasa: 'WYNIK' },
];

const glyphRodzaju = (r: string) => RODZAJE.find(x => x.id === r)?.glyph ?? '🏢';

const czas = (iso: string | null) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
};

// ── Kafel statystyki ──────────────────────────────────────────────────────────
const Kafel: React.FC<{ ikona: React.ReactNode; etykieta: string; wartosc: React.ReactNode; ton?: string }> =
    ({ ikona, etykieta, wartosc, ton = 'text-cyan-300' }) => (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/50 border border-white/5 backdrop-blur-md">
            <div className={`${ton} shrink-0`}>{ikona}</div>
            <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{etykieta}</div>
                <div className={`text-lg font-bold font-mono ${ton} leading-tight`}>{wartosc}</div>
            </div>
        </div>
    );

export const YourBusinessPanel: React.FC<YourBusinessPanelProps> = ({ onClose, embedded = false }) => {
    const [stan, setStan] = useState<StanBiznesow | null>(null);
    const [profile, setProfile] = useState<ProfilGlosu[]>([]);
    const [przewody, setPrzewody] = useState<StanPrzewodow | null>(null);
    const [zdarzenia, setZdarzenia] = useState<ZdarzenieSluzby[]>([]);

    const [ladowanie, setLadowanie] = useState(true);
    const [blad, setBlad] = useState<string | null>(null);
    const [wybrany, setWybrany] = useState<string | null>(null);

    // Formularze
    const [pokazDodaj, setPokazDodaj] = useState(false);
    const [nowy, setNowy] = useState({ nazwa: '', rodzaj: 'usluga' as RodzajBiznesu, opis: '', url: '', telefon: '' });
    const [nowyGlos, setNowyGlos] = useState({ nazwa: '', voiceId: 'suweren', przewod: 'klon-lokalny', jezyk: 'pl' });
    const [sluzba, setSluzba] = useState({ akcja: 'klient.obsluzony' as AkcjaSluzby, klucz: '', opis: '', klient: '' });

    // Konsola Dial (Etap 2)
    const [numer, setNumer] = useState('');
    const [tekstRozmowy, setTekstRozmowy] = useState('');
    const [telefonia, setTelefonia] = useState<StanTelefonii | null>(null);
    const [dial, setDial] = useState<WynikDial | null>(null);
    const [dzwonie, setDzwonie] = useState(false);
    /** Świadoma zgoda na REALNY telefon. Kasowana po każdym połączeniu. */
    const [zgodaNaTelefon, setZgodaNaTelefon] = useState(false);

    // Głosy ElevenLabs — dociągane na żądanie (każde pytanie to ruch do chmury).
    const [glosyEl, setGlosyEl] = useState<GlosElevenLabs[]>([]);

    // Live Call Monitor (Etap 3)
    const [tunel, setTunel] = useState<StanTunelu | null>(null);
    const [adresTunelu, setAdresTunelu] = useState('');
    const [rozmowy, setRozmowy] = useState<StanRozmowy[]>([]);
    const [feed, setFeed] = useState<ZdarzenieLive[]>([]);
    const [tekstPrzejecia, setTekstPrzejecia] = useState('');
    const [trybDial, setTrybDial] = useState<'zapowiedz' | 'rozmowa'>('zapowiedz');

    // ── Odczyt stanu ─────────────────────────────────────────────────────────
    const odswiez = useCallback(async () => {
        setLadowanie(true);
        try {
            // Przewody i profile wolno mieć puste; rejestr biznesów jest fundamentem,
            // więc jego błąd zatrzymuje cały panel (zamiast malować zera).
            const [s, z] = await Promise.all([pobierzBiznesy(), pobierzZdarzenia(null, 40)]);
            setStan(s);
            setZdarzenia(z);
            setBlad(null);
            try { setProfile(await pobierzProfile()); } catch { setProfile([]); }
            try { setPrzewody(await stanPrzewodow()); } catch { setPrzewody(null); }
            // Telefonia pyta konto Twilio — wolno jej nie odpowiedzieć, ale wtedy
            // konsola Dial pokazuje „stan nieznany", a nie zieloną gotowość.
            try { setTelefonia(await stanTelefonii()); } catch { setTelefonia(null); }
            try { setTunel(await stanTunelu()); } catch { setTunel(null); }
            try { setRozmowy((await pobierzRozmowy()).rozmowy); } catch { setRozmowy([]); }
        } catch (e: any) {
            setBlad(e?.message ?? 'Nieznany błąd mostu.');
            setStan(null);
        } finally {
            setLadowanie(false);
        }
    }, []);

    useEffect(() => { void odswiez(); }, [odswiez]);

    /**
     * Strumień rozmów. Zdarzenia lecą do feedu, ale STAN rozmów dociągamy
     * zapytaniem przy każdym starcie/końcu — SSE po zerwaniu wznawia się bez
     * historii, więc sam strumień nie jest źródłem prawdy o tym, co żyje.
     */
    useEffect(() => {
        const odepnij = sluchajLive((ev) => {
            setFeed(f => [ev, ...f].slice(0, 60));
            if (['start', 'stop', 'przejecie', 'oddanie', 'rozlaczenie', 'odmowa'].includes(ev.typ)) {
                pobierzRozmowy().then(d => setRozmowy(d.rozmowy)).catch(() => { /* most milczy */ });
            }
            if (ev.typ === 'start') toast(`🔴 Rozmowa: ${ev.biznes ?? 'bez działalności'} (${ev.kierunek ?? '—'})`, { duration: 5000 });
            if (ev.typ === 'stop') toast(`⏹️ Koniec rozmowy — ${ev.sekundy ?? 0}s, ${ev.tur ?? 0} tur.`, { duration: 5000 });
        });
        return odepnij;
    }, []);

    // Licznik czasu odświeżany co sekundę — inaczej „czas trwania" stałby
    // w miejscu między zdarzeniami, a to najgorszy możliwy wskaźnik na żywo.
    // `odMs` z mostu jest prawdą na moment pobrania, więc doliczamy to,
    // co upłynęło od tamtej chwili tutaj.
    const pobrano = useRef(Date.now());
    useEffect(() => { pobrano.current = Date.now(); }, [rozmowy]);

    const [, setTick] = useState(0);
    useEffect(() => {
        if (!rozmowy.some(r => r.zywa)) return;
        const t = setInterval(() => setTick(x => x + 1), 1000);
        return () => clearInterval(t);
    }, [rozmowy]);

    const trwanie = (r: StanRozmowy) => {
        const ms = r.zywa ? r.odMs + (Date.now() - pobrano.current) : r.odMs;
        const s = Math.max(0, Math.round(ms / 1000));
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };

    const biznesy = stan?.biznesy ?? [];
    const aktywnyBiznes = useMemo(
        () => biznesy.find(b => b.id === wybrany) ?? biznesy[0] ?? null,
        [biznesy, wybrany],
    );

    const profilBiznesu = (b: Biznes | null) =>
        b?.voiceProfile ? profile.find(p => p.id === b.voiceProfile) ?? null : null;

    // ── Akcje ────────────────────────────────────────────────────────────────
    const dodaj = async () => {
        if (!nowy.nazwa.trim()) { toast.error('Podaj nazwę działalności.'); return; }
        try {
            const b = await dodajBiznes(nowy as Partial<Biznes>);
            toast.success(`Działalność „${b.nazwa}" w rejestrze.`);
            setNowy({ nazwa: '', rodzaj: 'usluga', opis: '', url: '', telefon: '' });
            setPokazDodaj(false);
            await odswiez();
        } catch (e: any) { toast.error(e?.message ?? 'Nie udało się dodać.'); }
    };

    const skasuj = async (b: Biznes) => {
        try {
            const r = await usunBiznes(b.id);
            toast.success(`„${b.nazwa}" zdjęta z rejestru (zdarzeń zachowanych: ${r.zdarzenZachowanych}).`);
            await odswiez();
        } catch (e: any) { toast.error(e?.message ?? 'Nie udało się usunąć.'); }
    };

    const zapiszGlos = async () => {
        if (!nowyGlos.nazwa.trim()) { toast.error('Podaj nazwę profilu głosu.'); return; }
        try {
            const p = await zapiszProfil({ ...nowyGlos, biznesId: aktywnyBiznes?.id ?? null });
            toast.success(`Profil głosu „${p.nazwa}" zapisany.`);
            if (!p.probkaIstnieje) {
                toast(`Uwaga: próbki „${p.voiceId}.wav" nie ma jeszcze na dysku — sklonuj głos, zanim ten profil coś powie.`,
                    { icon: '⚠️', duration: 6000 });
            }
            setNowyGlos({ nazwa: '', voiceId: 'suweren', przewod: 'klon-lokalny', jezyk: 'pl' });
            setProfile(await pobierzProfile());
        } catch (e: any) { toast.error(e?.message ?? 'Zapis profilu nie wyszedł.'); }
    };

    const przypisz = async (b: Biznes, profilId: string) => {
        try {
            await przypiszGlos(b.id, profilId || null);
            toast.success(profilId ? 'Głos przypisany do działalności.' : 'Głos zdjęty z działalności.');
            await odswiez();
        } catch (e: any) { toast.error(e?.message ?? 'Nie udało się przypisać głosu.'); }
    };

    const probkaGlosu = async (b: Biznes) => {
        const p = profilBiznesu(b);
        const tekst = `Dzień dobry, tu ${b.nazwa}. W czym mogę pomóc?`;
        const zrodlo = await mowProfilem(tekst, p);
        if (zrodlo === 'clone') toast.success('Zabrzmiał lokalny klon głosu.');
        else if (zrodlo === 'browser') toast(`Klon niedostępny — mówi głos przeglądarki.`, { icon: '🌐' });
        else toast.error('Nie zabrzmiało nic. Przeglądarka blokuje mowę bez gestu — kliknij cokolwiek i spróbuj ponownie.');
    };

    const doPliku = async (b: Biznes) => {
        const p = profilBiznesu(b);
        try {
            const r = await renderujDoPliku(`Dzień dobry, tu ${b.nazwa}. W czym mogę pomóc?`, {
                profil: p?.id, nazwa: b.id,
            });
            toast.success(`Zapisane: ${r.plik} (${(r.bajty / 1024).toFixed(0)} kB).`);
            setPrzewody(await stanPrzewodow().catch(() => null));
        } catch (e: any) { toast.error(e?.message ?? 'Render nie wyszedł.'); }
    };

    const zglos = async () => {
        if (!aktywnyBiznes) return;
        if (!sluzba.klucz.trim()) {
            toast.error('Podaj klucz jednokrotności (np. numer zamówienia) — bez niego ta sama służba płaciłaby w kółko.');
            return;
        }
        try {
            const r = await zglosSluzbe({
                biznesId: aktywnyBiznes.id,
                akcja: sluzba.akcja,
                klucz: sluzba.klucz.trim(),
                opis: sluzba.opis || undefined,
                klient: sluzba.klient || undefined,
            });
            if (r.zdarzenie.przyznane) toast.success(`Służba zapisana: +${r.zdarzenie.grv} GRV z pieczęcią w księdze.`);
            else toast(`Służba zapisana, ale BEZ GRV: ${r.zdarzenie.powod ?? 'oddech trafił na wydech'}.`, { icon: '🫁', duration: 6000 });
            setSluzba({ akcja: sluzba.akcja, klucz: '', opis: '', klient: '' });
            await odswiez();
        } catch (e: any) { toast.error(e?.message ?? 'Zgłoszenie służby nie przeszło.'); }
    };

    /**
     * Jedna droga dla próby i dla realnego połączenia — różnica siedzi
     * w `naprawde`. Zgoda jest kasowana ZAWSZE po wyjściu z tej funkcji,
     * żeby drugie kliknięcie nie zadzwoniło „z rozpędu".
     */
    const dzwon = async (naprawde: boolean) => {
        if (!aktywnyBiznes) return;
        const cel = numer.trim() || aktywnyBiznes.telefon || '';
        if (!cel) { toast.error('Podaj numer albo uzupełnij telefon w karcie działalności.'); return; }
        if (naprawde && !zgodaNaTelefon) {
            toast.error('Zaznacz zgodę — to realny telefon do żywego człowieka i rachunek u operatora.');
            return;
        }

        setDzwonie(true);
        try {
            const w = await zadzwon({
                biznesId: aktywnyBiznes.id,
                numer: cel,
                tekst: tekstRozmowy.trim() || undefined,
                proba: !naprawde,
                potwierdzenie: naprawde,
                tryb: trybDial,
            });
            setDial(w);
            if (w.wykonane) toast.success(`Połączenie zestawione (${w.callSid ?? 'bez SID'}).`, { duration: 7000 });
            else if (w.proba) toast(`Próba przeszła — telefon NIE zadzwonił.`, { icon: '🧪', duration: 6000 });
            else toast.error(w.message ?? 'Połączenie nie zostało wykonane.', { duration: 7000 });
            await odswiez();
        } catch (e: any) {
            setDial({ wykonane: false, message: e?.message ?? 'Most milczy.' });
            toast.error(e?.message ?? 'Most milczy.');
        } finally {
            setZgodaNaTelefon(false);
            setDzwonie(false);
        }
    };

    // ── Kwantowy Tunel i mikrofon Suwerena (Etap 3) ──────────────────────────
    const wpnijTunel = async () => {
        if (!adresTunelu.trim()) { toast.error('Podaj adres publiczny tunelu (https://…).'); return; }
        try {
            const t = await ustawTunel(adresTunelu.trim());
            setTunel(t);
            setAdresTunelu('');
            toast.success(t.zywy ? 'Tunel wpięty i odpowiada.' : 'Tunel zapisany, ale NIE odpowiada — sprawdź, czy działa.');
            await odswiez();
        } catch (e: any) { toast.error(e?.message ?? 'Nie udało się wpiąć tunelu.'); }
    };

    const odepnijTunel = async () => {
        try {
            await zdejmijTunel();
            setTunel(await stanTunelu(false));
            toast('Tunel odpięty — rozmowy dwustronne wyłączone.', { icon: '🌀' });
            await odswiez();
        } catch (e: any) { toast.error(e?.message ?? 'Nie udało się odpiąć.'); }
    };

    const przejmij = async (r: StanRozmowy) => {
        if (!r.callSid) return;
        try {
            await przejmijRozmowe(r.callSid, tekstPrzejecia.trim() || undefined);
            setTekstPrzejecia('');
            toast.success('Mikrofon przejęty — AI milczy do odwołania.');
        } catch (e: any) { toast.error(e?.message ?? 'Przejęcie nie wyszło.'); }
    };

    const oddaj = async (r: StanRozmowy) => {
        if (!r.callSid) return;
        try { await oddajRozmowe(r.callSid); toast.success('Mikrofon oddany AI.'); }
        catch (e: any) { toast.error(e?.message ?? 'Nie udało się oddać.'); }
    };

    const rozlacz = async (r: StanRozmowy) => {
        if (!r.callSid) return;
        try { await rozlaczRozmowe(r.callSid); toast('Rozmowa rozłączona.', { icon: '⏹️' }); }
        catch (e: any) { toast.error(e?.message ?? 'Nie udało się rozłączyć.'); }
    };

    const pobierzGlosyEl = async () => {
        try {
            const g = await glosyElevenLabs();
            setGlosyEl(g);
            toast.success(`ElevenLabs: ${g.length} głosów na koncie.`);
        } catch (e: any) { toast.error(e?.message ?? 'Nie udało się pobrać głosów.'); }
    };

    // ── Widok ────────────────────────────────────────────────────────────────
    const powloka = embedded
        ? 'flex flex-col gap-5'
        : 'flex flex-col gap-5 p-5 md:p-7 rounded-3xl bg-slate-950/80 border border-white/10 backdrop-blur-xl';

    return (
        <div className={powloka}>
            {/* ── NAGŁÓWEK ───────────────────────────────────────────────── */}
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.35)]">
                        <Building2 className="w-6 h-6 text-slate-950" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-slate-100">TWOJE BIZNESY</h2>
                        <p className="text-[11px] text-slate-500 font-mono">
                            Rejestr · Służba w GRV · Głos agentów · Telefonia · Rozmowa na żywo (Etap 3)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
                        blad
                            ? 'bg-rose-950/70 text-rose-300 border-rose-800/60'
                            : 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60'
                    }`}>
                        {blad ? 'MOST MILCZY' : 'MOST 127.0.0.1:3001'}
                    </span>
                    <button
                        onClick={() => void odswiez()}
                        disabled={ladowanie}
                        className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        title="Odśwież stan z mostu"
                    >
                        <RefreshCw className={`w-4 h-4 ${ladowanie ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setPokazDodaj(v => !v)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>DZIAŁALNOŚĆ</span>
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-rose-950/50 border border-slate-700 text-slate-400 hover:text-rose-300 transition-all"
                            title="Zamknij"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── BŁĄD MOSTU — zamiast pustych kart ──────────────────────── */}
            {blad && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/50 backdrop-blur-md">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-rose-200">
                        <div className="font-bold">Rejestr biznesów nieosiągalny — nic tu nie pokazuję.</div>
                        <div className="text-rose-300/80 font-mono text-xs mt-1">{blad}</div>
                        <div className="text-rose-300/60 text-xs mt-2">
                            Zera i puste karty byłyby zmyśleniem. Odpal Katedrę i kliknij odświeżenie.
                        </div>
                    </div>
                </div>
            )}

            {/* ── PASEK PODSUMOWANIA ─────────────────────────────────────── */}
            {stan && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <Kafel ikona={<Building2 className="w-5 h-5" />} etykieta="Działalności"
                           wartosc={`${stan.podsumowanie.aktywnych}/${stan.podsumowanie.dzialalnosci}`} />
                    <Kafel ikona={<Wallet className="w-5 h-5" />} etykieta="GRV ze Służby"
                           wartosc={stan.podsumowanie.grvZeSluzby} ton="text-amber-300" />
                    <Kafel ikona={<Mic2 className="w-5 h-5" />} etykieta="Z głosem"
                           wartosc={stan.podsumowanie.zGlosem} ton="text-fuchsia-300" />
                    <Kafel ikona={<ScrollText className="w-5 h-5" />} etykieta="Zdarzeń Służby"
                           wartosc={stan.podsumowanie.zdarzen} ton="text-emerald-300" />
                    <Kafel ikona={<PlugZap className="w-5 h-5" />} etykieta="Przewody gotowe"
                           wartosc={przewody ? `${przewody.gotowych}/${przewody.wKatalogu}` : '—'}
                           ton="text-sky-300" />
                </div>
            )}

            {/* ── FORMULARZ NOWEJ DZIAŁALNOŚCI ───────────────────────────── */}
            <AnimatePresence>
                {pokazDodaj && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-900/50 border border-cyan-500/20 backdrop-blur-md">
                            <input
                                value={nowy.nazwa} onChange={e => setNowy({ ...nowy, nazwa: e.target.value })}
                                placeholder="Nazwa działalności (np. Café Martens)"
                                className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-sm outline-none focus:border-cyan-500"
                            />
                            <select
                                value={nowy.rodzaj} onChange={e => setNowy({ ...nowy, rodzaj: e.target.value as RodzajBiznesu })}
                                className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-sm outline-none focus:border-cyan-500"
                            >
                                {RODZAJE.map(r => <option key={r.id} value={r.id}>{r.glyph} {r.label}</option>)}
                            </select>
                            <input
                                value={nowy.url} onChange={e => setNowy({ ...nowy, url: e.target.value })}
                                placeholder="Adres www (opcjonalnie)"
                                className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-sm outline-none focus:border-cyan-500"
                            />
                            <input
                                value={nowy.telefon} onChange={e => setNowy({ ...nowy, telefon: e.target.value })}
                                placeholder="Telefon (dla Konsoli Dial)"
                                className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-sm outline-none focus:border-cyan-500"
                            />
                            <textarea
                                value={nowy.opis} onChange={e => setNowy({ ...nowy, opis: e.target.value })}
                                placeholder="Czym się zajmuje — to trafi do kontekstu agenta obsługującego."
                                rows={2}
                                className="md:col-span-2 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-sm outline-none focus:border-cyan-500 resize-none"
                            />
                            <div className="md:col-span-2 flex justify-end gap-2">
                                <button onClick={() => setPokazDodaj(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 text-xs font-bold hover:text-slate-200">
                                    Anuluj
                                </button>
                                <button onClick={() => void dodaj()}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold">
                                    <Save className="w-4 h-4" /> Zapisz w rejestrze
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── 1. KARTY DZIAŁALNOŚCI ──────────────────────────────────── */}
            {stan && (
                <section className="flex flex-col gap-3">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Sparkles className="w-4 h-4 text-cyan-400" /> Karty działalności
                    </h3>

                    {biznesy.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/5 text-center text-slate-500 text-sm">
                            Rejestr jest pusty. To nie błąd — po prostu żadna działalność nie została jeszcze wpisana.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {biznesy.map(b => {
                                const wybranyTen = aktywnyBiznes?.id === b.id;
                                const p = profilBiznesu(b);
                                return (
                                    <motion.div
                                        key={b.id} layout onClick={() => setWybrany(b.id)}
                                        className={`p-4 rounded-2xl border backdrop-blur-md cursor-pointer transition-all ${
                                            wybranyTen
                                                ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                                                : 'bg-slate-900/40 border-white/5 hover:border-cyan-500/30'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-center text-xl shrink-0">
                                                    {glyphRodzaju(b.rodzaj)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-100 truncate">{b.nazwa}</div>
                                                    <div className="text-[11px] text-slate-500 font-mono truncate">
                                                        {b.url || b.telefon || b.id}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                                    b.aktywny
                                                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                                                        : 'bg-slate-800/70 text-slate-400 border-slate-700'
                                                }`}>
                                                    {b.aktywny ? 'AKTYWNA' : 'UŚPIONA'}
                                                </span>
                                                <button
                                                    onClick={e => { e.stopPropagation(); void skasuj(b); }}
                                                    className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                                                    title="Zdejmij z rejestru (zdarzenia zostają w księdze)"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {b.opis && <p className="mt-2 text-xs text-slate-400 line-clamp-2">{b.opis}</p>}

                                        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                                            <div className="py-1.5 rounded-lg bg-slate-950/50 border border-white/5">
                                                <div className="text-sm font-bold font-mono text-amber-300">{b.bilans.grv}</div>
                                                <div className="text-[9px] uppercase text-slate-500">GRV</div>
                                            </div>
                                            <div className="py-1.5 rounded-lg bg-slate-950/50 border border-white/5">
                                                <div className="text-sm font-bold font-mono text-cyan-300">{b.bilans.klientow}</div>
                                                <div className="text-[9px] uppercase text-slate-500">Klienci</div>
                                            </div>
                                            <div className="py-1.5 rounded-lg bg-slate-950/50 border border-white/5">
                                                <div className="text-sm font-bold font-mono text-emerald-300">{b.bilans.zamowien}</div>
                                                <div className="text-[9px] uppercase text-slate-500">Zamów.</div>
                                            </div>
                                            <div className="py-1.5 rounded-lg bg-slate-950/50 border border-white/5">
                                                <div className="text-sm font-bold font-mono text-fuchsia-300">{b.bilans.rozmow}</div>
                                                <div className="text-[9px] uppercase text-slate-500">Rozmowy</div>
                                            </div>
                                        </div>

                                        {/* Agenci obsługujący — na razie deklaracja przypisania, nie żywe procesy. */}
                                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-slate-500" />
                                            {(b.agenci?.length ? b.agenci : ['klaudiusz']).map(a => {
                                                const def = AGENTS_COLLECTIVE.find(x => x.id === a);
                                                return (
                                                    <span key={a} className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-950/70 border border-slate-700 text-slate-300">
                                                        {def?.avatar ?? '🤖'} {def?.name ?? a}
                                                    </span>
                                                );
                                            })}
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-950/70 border border-slate-700 text-slate-500">
                                                {p ? `${p.nazwa} (${p.przewod})` : 'bez głosu'}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {/* ── 2. VOICE & AGENT DISPATCHER ────────────────────────────── */}
            {stan && (
                <section className="flex flex-col gap-3">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Mic2 className="w-4 h-4 text-fuchsia-400" /> Voice &amp; Agent Dispatcher
                        {aktywnyBiznes && <span className="text-slate-600 normal-case font-mono">· {aktywnyBiznes.nazwa}</span>}
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Profile głosowe */}
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                Profile głosu (_OtakOs_Voice)
                            </div>

                            {aktywnyBiznes && (
                                <select
                                    value={aktywnyBiznes.voiceProfile ?? ''}
                                    onChange={e => void przypisz(aktywnyBiznes, e.target.value)}
                                    className="px-3 py-2 rounded-xl bg-slate-950/70 border border-fuchsia-500/30 text-slate-200 text-sm outline-none focus:border-fuchsia-500"
                                >
                                    <option value="">— bez głosu —</option>
                                    {profile.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.nazwa} · {p.voiceId}{p.probkaIstnieje === false ? ' (brak próbki)' : ''}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                                {profile.length === 0 && (
                                    <div className="text-xs text-slate-600 italic">
                                        Brak profili. Sklonuj głos (panel Klonu Głosu) i zapisz profil poniżej.
                                    </div>
                                )}
                                {profile.map(p => (
                                    <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/50 border border-white/5">
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-200 truncate">{p.nazwa}</div>
                                            <div className="text-[10px] font-mono text-slate-500 truncate">
                                                {p.voiceId}.wav · {p.przewod} · {p.jezyk}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {p.probkaIstnieje === false && (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/70 text-amber-300 border border-amber-800/60">
                                                    BRAK PRÓBKI
                                                </span>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    try { await usunProfil(p.id); setProfile(await pobierzProfile()); toast.success('Profil usunięty.'); }
                                                    catch (e: any) { toast.error(e?.message ?? 'Nie udało się usunąć.'); }
                                                }}
                                                className="p-1 rounded text-slate-600 hover:text-rose-400"
                                                title="Usuń profil"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                                <input
                                    value={nowyGlos.nazwa} onChange={e => setNowyGlos({ ...nowyGlos, nazwa: e.target.value })}
                                    placeholder="Nazwa profilu"
                                    className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-fuchsia-500"
                                />
                                <input
                                    value={nowyGlos.voiceId} onChange={e => setNowyGlos({ ...nowyGlos, voiceId: e.target.value })}
                                    placeholder="voiceId próbki (np. suweren)"
                                    className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-fuchsia-500"
                                />
                                <select
                                    value={nowyGlos.przewod} onChange={e => setNowyGlos({ ...nowyGlos, przewod: e.target.value })}
                                    className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-fuchsia-500"
                                >
                                    {(przewody?.przewody ?? []).filter(p => p.rodzaj !== 'stt').map(p => (
                                        <option key={p.id} value={p.id}>{p.glyph} {p.nazwa}{p.sterownik ? '' : ' (bez sterownika)'}</option>
                                    ))}
                                    {!przewody && <option value="klon-lokalny">🗣️ Lokalny klon głosu</option>}
                                </select>
                                <button
                                    onClick={() => void zapiszGlos()}
                                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold"
                                >
                                    <Save className="w-3.5 h-3.5" /> Zapisz profil
                                </button>

                                {/* Tor chmurowy — głos wybieramy z konta, nie z pamięci.
                                    Ostrzeżenie o kredytach jest tu celowo, przy samym wyborze. */}
                                {nowyGlos.przewod === 'elevenlabs-mcp' && (
                                    <div className="col-span-2 flex flex-col gap-2 p-2 rounded-xl bg-slate-950/60 border border-amber-800/40">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                            <span className="text-[10px] text-amber-200 leading-snug">
                                                ElevenLabs to chmura — każde wypowiedzenie zużywa kredyty Suwerena.
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <select
                                                value={nowyGlos.voiceId}
                                                onChange={e => setNowyGlos({ ...nowyGlos, voiceId: e.target.value })}
                                                className="flex-1 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-amber-500"
                                            >
                                                <option value="">— wybierz głos z konta —</option>
                                                {glosyEl.map(g => (
                                                    <option key={g.id} value={g.id}>{g.nazwa}{g.kategoria ? ` (${g.kategoria})` : ''}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => void pobierzGlosyEl()}
                                                className="px-3 py-2 rounded-xl bg-slate-950/70 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-950/40"
                                            >
                                                Pobierz głosy
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {aktywnyBiznes && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => void probkaGlosu(aktywnyBiznes)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-950/70 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-bold hover:bg-fuchsia-950/40"
                                    >
                                        <Volume2 className="w-3.5 h-3.5" /> Powiedz próbkę
                                    </button>
                                    <button
                                        onClick={() => void doPliku(aktywnyBiznes)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-300 text-xs font-bold hover:border-fuchsia-500/40"
                                    >
                                        <Save className="w-3.5 h-3.5" /> Renderuj do pliku
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Przewody Voice/Audio MCP */}
                        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                Przewody Voice/Audio MCP
                            </div>
                            {!przewody && (
                                <div className="text-xs text-slate-600 italic">
                                    Stan przewodów nieznany — most nie odpowiedział na /api/voice/mcp.
                                </div>
                            )}
                            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                                {(przewody?.przewody ?? []).map(p => (
                                    <div key={p.id} className="px-3 py-2 rounded-xl bg-slate-950/50 border border-white/5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-base shrink-0">{p.glyph}</span>
                                                <span className="text-xs font-bold text-slate-200 truncate">{p.nazwa}</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {/* DWIE osobne plakietki — bo to dwa osobne fakty. */}
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                                    p.sterownik
                                                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                                                        : 'bg-slate-800/70 text-slate-400 border-slate-700'
                                                }`}>
                                                    {p.sterownik ? 'STEROWNIK' : 'BEZ STEROWNIKA'}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                                    p.podpiety
                                                        ? 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60'
                                                        : 'bg-slate-800/70 text-slate-500 border-slate-700'
                                                }`}>
                                                    {p.podpiety ? 'PODPIĘTY' : 'NIEPODPIĘTY'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-1 text-[10px] text-slate-500 leading-snug">{p.werdykt}</div>
                                        {p.czym && <div className="text-[10px] font-mono text-slate-600 truncate">{p.czym}</div>}
                                    </div>
                                ))}
                            </div>
                            {przewody && (
                                <div className="text-[10px] text-slate-600 leading-snug pt-1 border-t border-white/5">
                                    „Podpięty" ≠ „działa". Przewód bywa skonfigurowany, a i tak nic nie wykona,
                                    dopóki most nie ma jego sterownika.
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* ── 3. LIVE ORDERS & AI DIAL CONSOLE ───────────────────────── */}
            {stan && (
                <section className="flex flex-col gap-3">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Radio className="w-4 h-4 text-emerald-400" /> Live Orders &amp; AI Dial Console
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Feed zdarzeń */}
                        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                Księga Służby (ostatnie {zdarzenia.length})
                            </div>
                            <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                                {zdarzenia.length === 0 && (
                                    <div className="text-xs text-slate-600 italic">
                                        Pusto — żadna służba nie została jeszcze zgłoszona.
                                    </div>
                                )}
                                {zdarzenia.map(z => {
                                    const b = biznesy.find(x => x.id === z.biznesId);
                                    return (
                                        <div key={z.id} className="flex items-start justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/50 border border-white/5">
                                            <div className="min-w-0">
                                                <div className="text-xs text-slate-200 truncate">
                                                    <span className="font-bold">{b?.nazwa ?? z.biznesId}</span>
                                                    <span className="text-slate-500"> · {z.opis}</span>
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-600 truncate">
                                                    {czas(z.kiedy)}{z.klient ? ` · ${z.klient}` : ''}
                                                    {!z.przyznane && z.powod ? ` · ${z.powod}` : ''}
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono shrink-0 border ${
                                                z.przyznane
                                                    ? 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                                                    : 'bg-slate-800/70 text-slate-500 border-slate-700'
                                            }`}>
                                                {z.przyznane ? `+${z.grv} GRV` : 'BEZ GRV'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Zgłoszenie Służby + Dial */}
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                Zgłoś Służbę {aktywnyBiznes ? `· ${aktywnyBiznes.nazwa}` : ''}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={sluzba.akcja} onChange={e => setSluzba({ ...sluzba, akcja: e.target.value as AkcjaSluzby })}
                                    className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-emerald-500"
                                >
                                    {AKCJE.map(a => <option key={a.id} value={a.id}>{a.label} ({a.klasa})</option>)}
                                </select>
                                <input
                                    value={sluzba.klucz} onChange={e => setSluzba({ ...sluzba, klucz: e.target.value })}
                                    placeholder="Klucz jednokrotności (np. ZAM-1042)"
                                    className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-emerald-500"
                                />
                                <input
                                    value={sluzba.klient} onChange={e => setSluzba({ ...sluzba, klient: e.target.value })}
                                    placeholder="Klient (opcjonalnie)"
                                    className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-emerald-500"
                                />
                                <input
                                    value={sluzba.opis} onChange={e => setSluzba({ ...sluzba, opis: e.target.value })}
                                    placeholder="Opis (opcjonalnie)"
                                    className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-emerald-500"
                                />
                            </div>
                            <button
                                onClick={() => void zglos()}
                                disabled={!aktywnyBiznes}
                                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold"
                            >
                                <Zap className="w-3.5 h-3.5" /> Zapisz Służbę i policz GRV
                            </button>
                            <div className="text-[10px] text-slate-600 leading-snug">
                                GRV liczy most (Ekonomia Oddechu): limit dobowy i klucz jednokrotności są
                                pilnowane po stronie serwera — ten sam klucz zapłaci dokładnie raz.
                            </div>

                            <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                        AI Dial Console
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                        telefonia?.drozny
                                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                                            : 'bg-slate-800/70 text-slate-400 border-slate-700'
                                    }`}>
                                        {telefonia ? (telefonia.drozny ? 'PRZEWÓD DROŻNY' : 'PRZEWÓD NIEDROŻNY') : 'STAN NIEZNANY'}
                                    </span>
                                </div>

                                {telefonia && !telefonia.drozny && (
                                    <div className="text-[10px] text-slate-500 leading-snug">{telefonia.message}</div>
                                )}
                                {telefonia?.konto?.prubny && (
                                    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-950/30 border border-amber-800/40">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                        <div className="text-[10px] text-amber-200 leading-snug">
                                            Konto próbne Twilio: dodzwoni się TYLKO na numery zweryfikowane i doklei własną zapowiedź.
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <input
                                        value={numer} onChange={e => setNumer(e.target.value)}
                                        placeholder={aktywnyBiznes?.telefon ?? 'Numer w formacie +48…'}
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-amber-500"
                                    />
                                </div>
                                <textarea
                                    value={tekstRozmowy} onChange={e => setTekstRozmowy(e.target.value)}
                                    rows={2}
                                    placeholder={trybDial === 'rozmowa'
                                        ? 'Powitanie przed oddaniem głosu AI (puste = domyślne)'
                                        : 'Co ma powiedzieć (puste = domyślna zapowiedź działalności)'}
                                    className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-amber-500 resize-none"
                                />

                                {/* Tryb: jedno zdanie (Etap 2) czy pełna rozmowa (Etap 3, przez tunel). */}
                                <div className="flex gap-1 p-1 rounded-xl bg-slate-950/60 border border-white/5">
                                    {([
                                        ['zapowiedz', '📢 Zapowiedź', true],
                                        ['rozmowa', '🔴 Rozmowa dwustronna', !!tunel?.adres],
                                    ] as const).map(([id, etykieta, dostepny]) => (
                                        <button
                                            key={id}
                                            onClick={() => dostepny ? setTrybDial(id) : toast.error('Rozmowa dwustronna wymaga wpiętego Kwantowego Tunelu.')}
                                            className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                trybDial === id
                                                    ? 'bg-amber-600 text-white'
                                                    : dostepny ? 'text-slate-400 hover:text-slate-200' : 'text-slate-700 cursor-not-allowed'
                                            }`}
                                        >
                                            {etykieta}{!dostepny ? ' (brak tunelu)' : ''}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => void dzwon(false)}
                                        disabled={!aktywnyBiznes || dzwonie}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-950/70 border border-sky-500/40 text-sky-300 text-xs font-bold hover:bg-sky-950/40 disabled:opacity-40"
                                    >
                                        <PlugZap className="w-3.5 h-3.5" /> Próba (nie dzwoni)
                                    </button>
                                    <button
                                        onClick={() => void dzwon(true)}
                                        disabled={!aktywnyBiznes || dzwonie || !zgodaNaTelefon || !telefonia?.drozny}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold disabled:opacity-30"
                                    >
                                        <PhoneCall className="w-3.5 h-3.5" /> ZADZWOŃ NAPRAWDĘ
                                    </button>
                                </div>

                                {/* Zgoda jest osobnym gestem i gaśnie po każdym połączeniu. */}
                                <label className="flex items-start gap-2 text-[10px] text-slate-400 cursor-pointer">
                                    <input
                                        type="checkbox" checked={zgodaNaTelefon}
                                        onChange={e => setZgodaNaTelefon(e.target.checked)}
                                        className="mt-0.5 accent-rose-500"
                                    />
                                    <span>
                                        Wiem, że to zadzwoni do żywego człowieka i obciąży konto operatora.
                                        Zgoda gaśnie po każdym połączeniu.
                                    </span>
                                </label>

                                {dial && (
                                    <div className={`flex flex-col gap-1.5 p-3 rounded-xl border ${
                                        dial.wykonane
                                            ? 'bg-emerald-950/30 border-emerald-800/40'
                                            : 'bg-amber-950/30 border-amber-800/40'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            {dial.wykonane
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                                            <span className={`text-[11px] font-bold ${dial.wykonane ? 'text-emerald-200' : 'text-amber-200'}`}>
                                                {dial.wykonane
                                                    ? `POŁĄCZENIE ZESTAWIONE · ${dial.status ?? '—'} · ${dial.callSid ?? 'bez SID'}`
                                                    : dial.proba ? 'PRÓBA — TELEFON NIE ZADZWONIŁ' : 'POŁĄCZENIE NIE ZOSTAŁO WYKONANE'}
                                            </span>
                                        </div>
                                        {dial.message && <div className="text-[10px] text-slate-300 leading-snug">{dial.message}</div>}
                                        {dial.uwaga && <div className="text-[10px] text-amber-300 leading-snug">{dial.uwaga}</div>}
                                        {dial.twiml && (
                                            <pre className="text-[9px] font-mono text-slate-500 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                                                {dial.twiml}
                                            </pre>
                                        )}
                                    </div>
                                )}

                                {/* Co sterownik potrafi, a czego NIE — prosto z mostu. */}
                                {przewody?.telefonia && (
                                    <div className="flex flex-wrap gap-1">
                                        {[
                                            ['połączenie wychodzące', przewody.telefonia.polaczenieWychodzace],
                                            ['mowa Twilio', przewody.telefonia.mowaTwilio],
                                            ['odbiór tonów', przewody.telefonia.odbieranieTonow],
                                            ['rozmowa dwustronna', przewody.telefonia.rozmowaDwustronna],
                                            ['klon Suwerena w słuchawce', przewody.telefonia.klonSuwerenaWSluchawce],
                                            ['połączenia przychodzące', przewody.telefonia.polaczeniaPrzychodzace],
                                        ].map(([etykieta, ma]) => (
                                            <span key={String(etykieta)} className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                                                ma
                                                    ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50'
                                                    : 'bg-slate-800/60 text-slate-500 border-slate-700 line-through'
                                            }`}>
                                                {String(etykieta)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="text-[10px] text-slate-600 leading-snug">
                                    Etap 2 dzwoni i mówi głosem Twilio. Rozmowa dwustronna oraz klon Suwerena
                                    w słuchawce wymagają publicznego adresu (Media Streams) — Etap 3.
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ── 4. LIVE CALL MONITOR (Etap 3) ──────────────────────────── */}
            {stan && (
                <section className="flex flex-col gap-3">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Waves className="w-4 h-4 text-rose-400" /> Live Call Monitor
                        {rozmowy.some(r => r.zywa) && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-950/70 text-rose-300 border border-rose-800/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                NA ŻYWO
                            </span>
                        )}
                    </h3>

                    {/* Kwantowy Tunel */}
                    <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                <Network className="w-4 h-4 text-cyan-400" /> Kwantowy Tunel
                            </div>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                tunel?.adres
                                    ? (tunel.zywy
                                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                                        : 'bg-amber-950/70 text-amber-300 border-amber-800/60')
                                    : 'bg-slate-800/70 text-slate-400 border-slate-700'
                            }`}>
                                {tunel?.adres
                                    ? (tunel.zywy === null ? 'WPIĘTY (niesprawdzony)' : tunel.zywy ? 'WPIĘTY I ŻYWY' : 'WPIĘTY, NIE ODPOWIADA')
                                    : 'ODPIĘTY'}
                            </span>
                        </div>

                        {tunel?.adres ? (
                            <div className="flex flex-col gap-2">
                                <div className="font-mono text-[10px] text-slate-400 break-all">
                                    {tunel.adres}
                                    <span className="text-slate-600"> → {tunel.wss}/api/voice/stream</span>
                                </div>
                                {tunel.zywy === false && tunel.powod && (
                                    <div className="text-[10px] text-amber-300 leading-snug">{tunel.powod}</div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-600 font-mono">biletów w obiegu: {tunel.biletow ?? 0}</span>
                                    <button
                                        onClick={() => void odepnijTunel()}
                                        className="ml-auto px-3 py-1.5 rounded-lg bg-slate-950/70 border border-rose-500/30 text-rose-300 text-[10px] font-bold hover:bg-rose-950/40"
                                    >
                                        Odepnij tunel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="text-[10px] text-slate-500 leading-snug">
                                    Bez publicznego adresu Twilio nie ma dokąd oddać audio — rozmowa dwustronna
                                    i połączenia przychodzące są wyłączone. Wpnij adres tunelu (Cloudflare, ngrok, własna domena).
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={adresTunelu} onChange={e => setAdresTunelu(e.target.value)}
                                        placeholder="https://twoj-tunel.trycloudflare.com"
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs outline-none focus:border-cyan-500"
                                    />
                                    <button
                                        onClick={() => void wpnijTunel()}
                                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                                    >
                                        Wepnij
                                    </button>
                                </div>
                                <div className="text-[10px] text-slate-600 font-mono leading-snug">
                                    Webhook dla numeru przychodzącego: &lt;adres&gt;/api/voice/incoming (podpis Twilio WYMAGANY)
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Żywe rozmowy + mikrofon Suwerena */}
                        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                Rozmowy w toku ({rozmowy.filter(r => r.zywa).length})
                            </div>

                            {rozmowy.filter(r => r.zywa).length === 0 && (
                                <div className="text-xs text-slate-600 italic">
                                    Cisza na linii. Nic nie udaję — gdy rozmowa ruszy, pojawi się tutaj sama.
                                </div>
                            )}

                            {rozmowy.filter(r => r.zywa).map(r => (
                                <div key={r.callSid ?? 'x'} className="flex flex-col gap-2 p-3 rounded-xl bg-slate-950/60 border border-rose-900/40">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-200 truncate">
                                                {biznesy.find(b => b.id === r.biznesId)?.nazwa ?? r.biznesId ?? 'bez działalności'}
                                                <span className="text-slate-500 font-normal"> · {r.kierunek === 'przychodzace' ? '📞 przychodzące' : '☎️ wychodzące'}</span>
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-600 truncate">{r.callSid}</div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
                                            r.tryb === 'suweren' ? 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                                                : r.tryb === 'mowimy' ? 'bg-fuchsia-950/70 text-fuchsia-300 border-fuchsia-800/60'
                                                : r.tryb === 'myslimy' ? 'bg-sky-950/70 text-sky-300 border-sky-800/60'
                                                : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                                        }`}>
                                            {r.tryb === 'suweren' ? '✋ SUWEREN' : r.tryb.toUpperCase()}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        <div className="py-1 rounded-lg bg-slate-950/60 border border-white/5">
                                            <div className="text-xs font-bold font-mono text-slate-200">{trwanie(r)}</div>
                                            <div className="text-[9px] uppercase text-slate-600">Czas</div>
                                        </div>
                                        <div className="py-1 rounded-lg bg-slate-950/60 border border-white/5">
                                            <div className="text-xs font-bold font-mono text-amber-300">{r.minut * 5}</div>
                                            <div className="text-[9px] uppercase text-slate-600">GRV/min</div>
                                        </div>
                                        <div className="py-1 rounded-lg bg-slate-950/60 border border-white/5">
                                            <div className="text-xs font-bold font-mono text-cyan-300">{r.tur}</div>
                                            <div className="text-[9px] uppercase text-slate-600">Tury</div>
                                        </div>
                                        <div className="py-1 rounded-lg bg-slate-950/60 border border-white/5">
                                            <div className="text-xs font-bold font-mono text-sky-300">
                                                {r.latencje?.tura ? `${(r.latencje.tura / 1000).toFixed(1)}s` : '—'}
                                            </div>
                                            <div className="text-[9px] uppercase text-slate-600">Latencja</div>
                                        </div>
                                    </div>

                                    {r.latencje && (r.latencje.stt || r.latencje.llm || r.latencje.tts) && (
                                        <div className="flex gap-1 text-[9px] font-mono text-slate-500">
                                            <span>STT {r.latencje.stt ?? '—'}ms</span>
                                            <span>·</span>
                                            <span>LLM {r.latencje.llm ?? '—'}ms</span>
                                            <span>·</span>
                                            <span>TTS {r.latencje.tts ?? '—'}ms</span>
                                        </div>
                                    )}

                                    <input
                                        value={tekstPrzejecia} onChange={e => setTekstPrzejecia(e.target.value)}
                                        placeholder="Co powiedzieć po przejęciu (opcjonalnie)"
                                        className="px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-700 text-slate-200 text-[11px] outline-none focus:border-amber-500"
                                    />
                                    <div className="flex gap-2">
                                        {r.tryb === 'suweren' ? (
                                            <button
                                                onClick={() => void oddaj(r)}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-950/40"
                                            >
                                                <Bot className="w-3.5 h-3.5" /> Oddaj mikrofon AI
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => void przejmij(r)}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold"
                                            >
                                                <Hand className="w-3.5 h-3.5" /> Przejmij rozmowę
                                            </button>
                                        )}
                                        <button
                                            onClick={() => void rozlacz(r)}
                                            className="px-3 py-2 rounded-lg bg-slate-950/70 border border-rose-500/40 text-rose-300 text-[11px] font-bold hover:bg-rose-950/40"
                                        >
                                            Rozłącz
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Strumień zdarzeń */}
                        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                Transkrypcja i przebieg ({feed.length})
                            </div>
                            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                                {feed.length === 0 && (
                                    <div className="text-xs text-slate-600 italic">
                                        Strumień milczy. To nie awaria — po prostu nic się teraz nie dzieje.
                                    </div>
                                )}
                                {feed.map((ev, i) => {
                                    if (ev.typ === 'transkrypt') {
                                        const ai = ev.rola === 'ai';
                                        return (
                                            <div key={i} className={`px-3 py-2 rounded-xl border text-xs ${
                                                ai ? 'bg-fuchsia-950/20 border-fuchsia-900/40 text-fuchsia-100'
                                                   : 'bg-slate-950/60 border-white/5 text-slate-200'
                                            }`}>
                                                <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-wider mb-0.5 opacity-70">
                                                    {ai ? '🤖 asystent' : '🙋 klient'}
                                                    {ev.ms ? <span className="font-mono">· {ev.ms}ms</span> : null}
                                                </div>
                                                {ev.tekst}
                                            </div>
                                        );
                                    }
                                    const opisy: Record<string, string> = {
                                        start: '🔴 rozmowa ruszyła',
                                        stop: `⏹️ koniec (${ev.sekundy ?? 0}s, ${ev.tur ?? 0} tur)`,
                                        myslimy: '🧠 myśli…',
                                        mowimy: '🗣️ mówi',
                                        sluchamy: '👂 słucha',
                                        cisza: '… nic nie usłyszałem',
                                        przerwane: `✂️ przerwane (${ev.powod ?? '—'})`,
                                        minuta: `⏱️ minuta ${ev.minuta}`,
                                        grv: ev.grv ? `💰 +${ev.grv} GRV (min. ${ev.minuta})` : `💤 bez GRV: ${ev.powod ?? '—'}`,
                                        przejecie: '✋ Suweren przejął mikrofon',
                                        oddanie: '🤖 mikrofon wrócił do AI',
                                        rozlaczenie: `📴 rozłączone (${ev.powod ?? '—'})`,
                                        odmowa: `⛔ odmowa: ${ev.powod ?? '—'}`,
                                        blad: `⚠️ ${ev.message ?? 'błąd'}`,
                                        polaczono: '📡 podpięto strumień',
                                        latencja: `⚡ tura ${ev.latencje?.tura ?? '—'}ms`,
                                        dtmf: '☎️ ton',
                                    };
                                    return (
                                        <div key={i} className={`px-3 py-1 text-[10px] font-mono ${
                                            ev.typ === 'blad' || ev.typ === 'odmowa' ? 'text-rose-300' : 'text-slate-600'
                                        }`}>
                                            {opisy[ev.typ] ?? ev.typ}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="text-[10px] text-slate-600 leading-snug pt-1 border-t border-white/5">
                                GRV za minutę rozmowy nalicza most przez Ekonomię Oddechu (klucz z numerem minuty,
                                limit dobowy). Panel pokazuje, co realnie weszło do księgi — nie własny licznik.
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ── STOPKA STANU ───────────────────────────────────────────── */}
            {stan && (
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 pt-1">
                    <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Rejestr: _OtakOs_Wymiar/biznesy.json · Głos: _OtakOs_Voice/ · Tunel: _OtakOs_Wymiar/tunel.json
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Globe className="w-3 h-3" /> Etap 3 — rozmowa dwustronna przez Kwantowy Tunel
                    </span>
                </div>
            )}
        </div>
    );
};

export default YourBusinessPanel;
