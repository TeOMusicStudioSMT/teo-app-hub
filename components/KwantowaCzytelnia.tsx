/**
 * 📖 KwantowaCzytelnia.tsx — Pełnoekranowe Studio Teledysku
 *
 * v4 — poprawki krytyczne:
 *   ▶  Przycisk START — tekst i TTS nie startują automatycznie
 *   🔧 Fix typewritera — clearTimeout zamiast closure-cancelled (brak duplikacji)
 *   🧊 MediaPanel jako React.memo — wideo nie zacina się podczas pisania
 *   🖼  Nano Banana: PDF (iframe) + modal Fullscreen (Maximize)
 *   💾 "Zapisz Wnioski do Kuźni" — most echo → teo_kuznia_context
 *
 * @author BoB & TeO
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
    Sparkles, X, BookOpen,
    Volume2, VolumeX, Gauge,
    Circle, StopCircle,
    Image as ImageIcon, Video, FileVideo, FileAudio,
    Upload, Maximize2, ChevronDown, ChevronUp,
    NotebookPen, Save, FileText,
} from 'lucide-react';

// ── Pomocniki ──────────────────────────────────────────────────
function makeObjUrl(prev: string | null, file: File): string {
    if (prev) URL.revokeObjectURL(prev);
    return URL.createObjectURL(file);
}

// ═══════════════════════════════════════════════════════════════
// 🧊 MEDIA PANEL — React.memo, ZERO propsów od rodzica
//    Dzięki temu typewriter (setDisplayedText) nie powoduje
//    re-renderowania odtwarzaczy wideo/audio.
// ═══════════════════════════════════════════════════════════════
const MediaPanel = memo(() => {

    // ── Nano Banana 2 (obraz | PDF) ────────────────────────────
    const [nanaSrc, setNanaSrc]           = useState<string | null>(null);
    const [nanaName, setNanaName]         = useState('');
    const [nanaIsPdf, setNanaIsPdf]       = useState(false);
    const [nanaFull, setNanaFull]         = useState(false);
    const nanaRef = useRef<HTMLInputElement>(null);

    // ── Veo (wideo tło) ────────────────────────────────────────
    const [veoSrc, setVeoSrc]             = useState<string | null>(null);
    const [veoName, setVeoName]           = useState('');
    const veoRef = useRef<HTMLInputElement>(null);

    // ── Echo Akaszy — slot Audio ───────────────────────────────
    const [echoAudioSrc, setEchoAudioSrc] = useState<string | null>(null);
    const [echoAudioName, setEchoAudioName] = useState('');
    const echoAudioRef = useRef<HTMLInputElement>(null);

    // ── Echo Akaszy — slot Wideo ───────────────────────────────
    const [echoVideoSrc, setEchoVideoSrc] = useState<string | null>(null);
    const [echoVideoName, setEchoVideoName] = useState('');
    const echoVideoRef = useRef<HTMLInputElement>(null);

    // ── Notatki ────────────────────────────────────────────────
    const [notes, setNotes]               = useState('');
    const [notesOpen, setNotesOpen]       = useState(false);
    const [savedToKuznia, setSavedToKuznia] = useState(false);

    const handleSaveToKuznia = () => {
        if (!notes.trim()) return;
        localStorage.setItem('teo_kuznia_context', notes);
        setSavedToKuznia(true);
        setTimeout(() => setSavedToKuznia(false), 3000);
    };

    // ── Slot upload helper ─────────────────────────────────────
    const SlotUpload = ({
        label, accept, inputRef, accentCls, icon, onFile,
    }: {
        label: string; accept: string;
        inputRef: React.RefObject<HTMLInputElement>;
        accentCls: string; icon: React.ReactNode;
        onFile: (f: File) => void;
    }) => (
        <button
            onClick={() => inputRef.current?.click()}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed ${accentCls} transition-all cursor-pointer group/slot`}
        >
            <span className="opacity-50 group-hover/slot:opacity-100 transition-opacity">{icon}</span>
            <span className="text-[10px] text-slate-500 group-hover/slot:text-slate-300 transition-colors font-sans">{label}</span>
            <input ref={inputRef} type="file" accept={accept} className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
            />
        </button>
    );

    return (
        <>
            {/* ══ PRAWY PANEL ══════════════════════════════════ */}
            <div
                className="w-80 xl:w-96 bg-black/60 border-l border-purple-500/20 backdrop-blur-xl flex flex-col overflow-y-auto relative"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#8b5cf6 transparent' }}
            >
                <div className="absolute top-0 right-0 w-full h-48 bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none" />

                {/* Nagłówek panelu */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-purple-500/30 shrink-0">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                    <h2 className="text-sm font-sans font-bold tracking-wider text-purple-200 uppercase">Studio Wizualizacji</h2>
                </div>

                <div className="flex flex-col gap-4 p-4">

                    {/* ══ NANO BANANA 2 — Obraz / PDF ═══════════ */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] text-purple-400/70 uppercase tracking-widest font-sans font-semibold">Nano Banana 2</p>
                            <div className="flex items-center gap-2">
                                {nanaSrc && (
                                    <>
                                        <button onClick={() => setNanaFull(true)} className="text-[9px] text-slate-500 hover:text-purple-300 transition-colors font-sans flex items-center gap-0.5">
                                            <Maximize2 className="w-2.5 h-2.5" /> powiększ
                                        </button>
                                        <button onClick={() => { URL.revokeObjectURL(nanaSrc); setNanaSrc(null); setNanaName(''); setNanaIsPdf(false); }} className="text-[9px] text-slate-600 hover:text-red-400 transition-colors font-sans">usuń</button>
                                    </>
                                )}
                            </div>
                        </div>

                        {nanaSrc ? (
                            <div className="relative w-full rounded-xl overflow-hidden border border-purple-500/30 bg-black" style={{ aspectRatio: nanaIsPdf ? '3/4' : '1/1' }}>
                                {nanaIsPdf ? (
                                    <iframe src={nanaSrc} title={nanaName} className="w-full h-full border-0" />
                                ) : (
                                    <img src={nanaSrc} alt={nanaName} className="w-full h-full object-contain" />
                                )}
                                <button
                                    onClick={() => setNanaFull(true)}
                                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 border border-white/10 hover:bg-purple-600/40 transition-all"
                                >
                                    <Maximize2 className="w-3 h-3 text-white/70" />
                                </button>
                                <p className="absolute bottom-0 left-0 right-0 text-[8px] text-white/30 font-mono truncate text-center py-1 bg-black/40">{nanaName}</p>
                            </div>
                        ) : (
                            <div
                                onClick={() => nanaRef.current?.click()}
                                className="group relative w-full aspect-square rounded-xl border border-dashed border-purple-500/25 bg-purple-900/10 hover:bg-purple-900/20 hover:border-pink-500/40 overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all"
                            >
                                <ImageIcon className="w-8 h-8 text-purple-500/40 mb-2 group-hover:text-pink-400 transition-colors" />
                                <p className="font-sans text-[10px] text-purple-400/50 uppercase tracking-widest text-center px-4 group-hover:text-pink-300 transition-colors">
                                    Wczytaj obraz lub PDF<br />
                                    <span className="font-bold text-purple-300/50 normal-case">.jpg .png .webp .pdf</span>
                                </p>
                                <input
                                    ref={nanaRef} type="file" accept="image/*,application/pdf" className="hidden"
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (!f) return;
                                        setNanaSrc(makeObjUrl(nanaSrc, f));
                                        setNanaName(f.name);
                                        setNanaIsPdf(f.type === 'application/pdf');
                                        e.target.value = '';
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* ══ VEO — Wideo tło ════════════════════════ */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] text-indigo-400/70 uppercase tracking-widest font-sans font-semibold">Model Veo</p>
                            {veoSrc && (
                                <button onClick={() => { URL.revokeObjectURL(veoSrc); setVeoSrc(null); setVeoName(''); }} className="text-[9px] text-slate-600 hover:text-red-400 transition-colors font-sans">usuń</button>
                            )}
                        </div>
                        {veoSrc ? (
                            <div className="relative rounded-xl overflow-hidden border border-indigo-500/30 bg-black">
                                <video src={veoSrc} autoPlay loop muted playsInline className="w-full object-contain max-h-48" />
                                <div className="absolute top-1.5 left-2 flex items-center gap-1 bg-black/50 rounded px-1.5 py-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                    <span className="text-[8px] text-indigo-300 font-sans font-bold uppercase tracking-wider">LIVE</span>
                                </div>
                                <p className="text-[8px] text-white/30 font-mono truncate text-center py-1 px-2">{veoName}</p>
                            </div>
                        ) : (
                            <div
                                onClick={() => veoRef.current?.click()}
                                className="group w-full h-32 rounded-xl border border-dashed border-indigo-500/20 bg-indigo-900/10 hover:bg-indigo-900/20 hover:border-blue-500/40 flex flex-col items-center justify-center cursor-pointer transition-all"
                            >
                                <Video className="w-7 h-7 text-indigo-500/40 mb-2 group-hover:text-blue-400 transition-colors" />
                                <p className="font-sans text-[10px] text-indigo-400/50 uppercase tracking-widest text-center px-4 group-hover:text-blue-300 transition-colors">
                                    Wideo tło<br /><span className="font-bold text-indigo-300/50 normal-case">autoPlay loop muted</span>
                                </p>
                                <input ref={veoRef} type="file" accept="video/*" className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) { setVeoSrc(makeObjUrl(veoSrc, f)); setVeoName(f.name); } e.target.value = ''; }}
                                />
                            </div>
                        )}
                    </div>

                    {/* ══ ECHO AKASZY ════════════════════════════ */}
                    <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 to-black/40 overflow-hidden">
                        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-cyan-500/15">
                            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                                <FileAudio className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-cyan-300 font-sans tracking-wider uppercase">Echo Akaszy</p>
                                <p className="text-[9px] text-slate-500 font-sans">NotebookLM · 2 sloty</p>
                            </div>
                        </div>

                        <div className="p-3 flex flex-col gap-3">

                            {/* Slot Audio */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-sans">🎙 Podcast / Audio</p>
                                    {echoAudioSrc && <button onClick={() => { URL.revokeObjectURL(echoAudioSrc); setEchoAudioSrc(null); setEchoAudioName(''); }} className="text-[9px] text-slate-600 hover:text-red-400 transition-colors font-sans">usuń</button>}
                                </div>
                                {echoAudioSrc ? (
                                    <div className="space-y-1">
                                        <audio controls src={echoAudioSrc} className="w-full h-9 rounded-lg" style={{ colorScheme: 'dark' }} />
                                        <p className="text-[9px] text-cyan-400/60 font-mono truncate px-0.5">{echoAudioName}</p>
                                    </div>
                                ) : (
                                    <SlotUpload label="Wczytaj audio (.mp3 / .wav)" accept="audio/*" inputRef={echoAudioRef}
                                        accentCls="border-cyan-500/25 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-400/40"
                                        icon={<Upload className="w-4 h-4 text-cyan-400" />}
                                        onFile={f => { setEchoAudioSrc(makeObjUrl(echoAudioSrc, f)); setEchoAudioName(f.name); }}
                                    />
                                )}
                            </div>

                            {/* Slot Wideo */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-sans">🎬 Wideo Overview</p>
                                    {echoVideoSrc && <button onClick={() => { URL.revokeObjectURL(echoVideoSrc); setEchoVideoSrc(null); setEchoVideoName(''); }} className="text-[9px] text-slate-600 hover:text-red-400 transition-colors font-sans">usuń</button>}
                                </div>
                                {echoVideoSrc ? (
                                    <div className="space-y-1">
                                        <video controls src={echoVideoSrc} className="w-full rounded-lg object-contain max-h-44 bg-black" style={{ colorScheme: 'dark' }} />
                                        <p className="text-[9px] text-cyan-400/60 font-mono truncate px-0.5">{echoVideoName}</p>
                                    </div>
                                ) : (
                                    <SlotUpload label="Wczytaj wideo (.mp4 / .webm)" accept="video/*" inputRef={echoVideoRef}
                                        accentCls="border-cyan-500/25 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-400/40"
                                        icon={<FileVideo className="w-4 h-4 text-cyan-400" />}
                                        onFile={f => { setEchoVideoSrc(makeObjUrl(echoVideoSrc, f)); setEchoVideoName(f.name); }}
                                    />
                                )}
                            </div>

                            {/* Accordion Notatki */}
                            <div className="border border-white/5 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setNotesOpen(p => !p)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <NotebookPen className="w-3.5 h-3.5 text-cyan-400/70" />
                                        <span className="text-[10px] font-sans font-semibold text-slate-300 uppercase tracking-wider">Notatki / Analiza</span>
                                    </div>
                                    {notesOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                                </button>
                                {notesOpen && (
                                    <div className="px-3 pb-3 bg-black/20">
                                        <textarea
                                            value={notes} onChange={e => setNotes(e.target.value)}
                                            placeholder="Wklej tutaj notatki, analizę lub transkrypt z NotebookLM…"
                                            rows={7}
                                            className="w-full mt-3 p-3 rounded-lg text-xs font-sans bg-slate-900/60 border border-slate-700/40 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 resize-none leading-relaxed transition-colors duration-200"
                                            style={{ scrollbarWidth: 'thin', scrollbarColor: '#0e7490 transparent' }}
                                        />
                                        {notes && (
                                            <div className="flex justify-between items-center mt-1.5 px-0.5">
                                                <span className="text-[9px] text-slate-600 font-mono">{notes.length} znaków</span>
                                                <button onClick={() => setNotes('')} className="text-[9px] text-slate-600 hover:text-red-400 transition-colors font-sans">wyczyść</button>
                                            </div>
                                        )}
                                        {/* ── MOST DO KUŹNI ─────────────────── */}
                                        <button
                                            onClick={handleSaveToKuznia}
                                            disabled={!notes.trim()}
                                            className={`
                                                mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl
                                                text-xs font-sans font-semibold border transition-all duration-200
                                                ${savedToKuznia
                                                    ? 'bg-green-600/30 border-green-500/50 text-green-300'
                                                    : notes.trim()
                                                    ? 'bg-orange-600/20 border-orange-500/30 text-orange-300 hover:bg-orange-600/30 hover:border-orange-400/50'
                                                    : 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'}
                                            `}
                                        >
                                            <Save className="w-3.5 h-3.5" />
                                            {savedToKuznia ? '✓ Zapisano do Kuźni!' : '💾 Zapisz Wnioski (Do Kuźni)'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* ══ FULLSCREEN MODAL — Nano Banana ═══════════════════════ */}
            {nanaFull && nanaSrc && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center"
                    onClick={() => setNanaFull(false)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all z-10"
                        onClick={() => setNanaFull(false)}
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                    <div
                        className="relative max-w-5xl max-h-[90vh] w-full mx-4"
                        onClick={e => e.stopPropagation()}
                    >
                        {nanaIsPdf ? (
                            <iframe src={nanaSrc} title={nanaName} className="w-full rounded-xl border border-white/10" style={{ height: '85vh' }} />
                        ) : (
                            <img src={nanaSrc} alt={nanaName} className="w-full max-h-[85vh] object-contain rounded-xl" />
                        )}
                        <p className="text-center text-[10px] text-white/30 font-mono mt-2">{nanaName}</p>
                    </div>
                </div>
            )}
        </>
    );
});
MediaPanel.displayName = 'MediaPanel';

// ═══════════════════════════════════════════════════════════════
// 📖 GŁÓWNY KOMPONENT CZYTELNI
// ═══════════════════════════════════════════════════════════════
interface KwantowaCzytelniaProps {
    text: string;
    onClose: () => void;
}

const KwantowaCzytelnia: React.FC<KwantowaCzytelniaProps> = ({ text, onClose }) => {

    // ── Typewriter ─────────────────────────────────────────────
    const [displayedText, setDisplayedText]     = useState('');
    const [isTyping, setIsTyping]               = useState(false);
    const [hasStarted, setHasStarted]           = useState(false);
    const [typewriterSpeed, setTypewriterSpeed] = useState(30);
    const speedRef   = useRef(30);
    const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => { speedRef.current = typewriterSpeed; }, [typewriterSpeed]);
    const scrollRef  = useRef<HTMLDivElement>(null);

    // ── TTS ────────────────────────────────────────────────────
    const [isTtsEnabled, setIsTtsEnabled] = useState(false);

    // ── Kwantowy Rejestrator (REC) ─────────────────────────────
    const [isRecording, setIsRecording]   = useState(false);
    const [recError, setRecError]         = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef        = useRef<BlobPart[]>([]);
    const streamRef        = useRef<MediaStream | null>(null);

    // ── Słowa Mocy ─────────────────────────────────────────────
    const keywords = ['Istnienie', 'Gaja', 'SAM', 'Miłość', 'Przedwieczny', 'Krople Wiatru'];
    const highlightLore = (content: string) => {
        let out = content;
        keywords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'g');
            out = out.replace(regex,
                `<span class="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-orange-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">${word}</span>`
            );
        });
        return out;
    };

    // ── Typewriter — clearTimeout fix (brak duplikacji liter) ──
    //    Uruchamia się TYLKO gdy hasStarted = true.
    useEffect(() => {
        if (!text || !hasStarted) return;

        // Wyczyść poprzedni timer (jeśli jakiś biegł)
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        let idx = 0;
        setIsTyping(true);
        setDisplayedText('');

        const typeNext = () => {
            if (idx < text.length) {
                setDisplayedText(prev => prev + text.slice(idx, idx + 3));
                idx += 3;
                timerRef.current = setTimeout(typeNext, speedRef.current);
            } else {
                setIsTyping(false);
                timerRef.current = null;
            }
        };

        timerRef.current = setTimeout(typeNext, speedRef.current);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [text, hasStarted]);

    // ── Auto-scroll ────────────────────────────────────────────
    useEffect(() => {
        if (scrollRef.current && isTyping) {
            const { scrollHeight, clientHeight } = scrollRef.current;
            scrollRef.current.scrollTo({ top: scrollHeight - clientHeight, behavior: 'smooth' });
        }
    }, [displayedText, isTyping]);

    // ── TTS — tylko po starcie i gdy włączony ──────────────────
    useEffect(() => {
        if (!('speechSynthesis' in window)) return;
        if (isTtsEnabled && text && hasStarted) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(text);
            utt.lang = 'pl-PL'; utt.rate = 0.92; utt.pitch = 1.0;
            window.speechSynthesis.speak(utt);
        } else {
            window.speechSynthesis.cancel();
        }
    }, [isTtsEnabled, text, hasStarted]);

    // ── REC: start ─────────────────────────────────────────────
    const startRecording = useCallback(async () => {
        setRecError(null);
        try {
            const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true }) as MediaStream;
            streamRef.current = stream;
            chunksRef.current = [];
            const mimeType =
                MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
                : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                const ts   = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
                a.href = url; a.download = `Kronika_0.00G_${ts}.webm`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setIsRecording(false);
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            };
            stream.getVideoTracks()[0].onended = () => {
                if (recorder.state === 'recording') recorder.stop();
            };
            recorder.start(1000);
            setIsRecording(true);
        } catch (err: any) {
            if (err?.name !== 'NotAllowedError') setRecError('Błąd REC: ' + (err?.message ?? err));
            setIsRecording(false);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    }, []);

    // ── Zamknięcie ─────────────────────────────────────────────
    const handleClose = useCallback(() => {
        window.speechSynthesis?.cancel();
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
        streamRef.current?.getTracks().forEach(t => t.stop());
        onClose();
    }, [onClose]);

    // ── Etykieta tempa ─────────────────────────────────────────
    const speedLabel =
        typewriterSpeed <= 40  ? '⚡ Błysk'
        : typewriterSpeed <= 70  ? '▶ Normalnie'
        : typewriterSpeed <= 110 ? '🎬 Kino'
        :                          '🐢 Medytacja';

    // ─────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950/90 to-black text-gray-200 font-serif selection:bg-pink-500/30">

            {/* ══ GÓRNY PASEK KONTROLNY ══════════════════════════════ */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-black/50 border-b border-purple-500/20 backdrop-blur-xl z-50">

                {/* Zamknij */}
                <button onClick={handleClose} className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-red-600/30 hover:border-red-500/50 transition-all shrink-0" title="Zamknij">
                    <X className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-5 bg-purple-500/20 shrink-0" />

                {/* Suwak Tempa */}
                <div className="flex items-center gap-2 flex-1 max-w-[240px]">
                    <Gauge className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <div className="flex flex-col gap-0.5 flex-1">
                        <div className="flex justify-between">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-sans">Tempo</span>
                            <span className="text-[9px] text-purple-300 font-mono font-semibold">{speedLabel}</span>
                        </div>
                        <input type="range" min={20} max={150} step={5} value={typewriterSpeed}
                            onChange={e => setTypewriterSpeed(Number(e.target.value))}
                            className="w-full h-1.5 appearance-none rounded-full cursor-pointer bg-gradient-to-r from-purple-700/40 to-purple-400/40
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400
                                [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(168,85,247,0.8)] [&::-webkit-slider-thumb]:cursor-pointer
                                [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
                                [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-purple-400"
                        />
                    </div>
                </div>
                <div className="w-[1px] h-5 bg-purple-500/20 shrink-0" />

                {/* TTS Toggle */}
                <button
                    onClick={() => setIsTtsEnabled(p => !p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans font-semibold border transition-all shrink-0
                        ${isTtsEnabled ? 'bg-purple-600/40 border-purple-400/60 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200'}`}
                >
                    {isTtsEnabled ? <><Volume2 className="w-3.5 h-3.5" />Lektor: Wł</> : <><VolumeX className="w-3.5 h-3.5" />Lektor: Wył</>}
                </button>
                <div className="w-[1px] h-5 bg-purple-500/20 shrink-0" />

                {/* REC */}
                {isRecording ? (
                    <button onClick={stopRecording} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans font-bold bg-red-600/30 border border-red-500/60 text-red-300 hover:bg-red-600/50 transition-all shrink-0 shadow-[0_0_16px_rgba(239,68,68,0.5)] animate-pulse">
                        <StopCircle className="w-3.5 h-3.5" />⏹ Stop REC
                    </button>
                ) : (
                    <button onClick={startRecording} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans font-bold bg-white/5 border border-white/10 text-slate-400 hover:bg-red-600/20 hover:border-red-500/40 hover:text-red-300 transition-all shrink-0">
                        <Circle className="w-3 h-3 fill-red-500 text-red-500" />REC
                    </button>
                )}
                {recError && <span className="text-[9px] text-red-400 font-sans truncate max-w-[100px]" title={recError}>⚠ {recError}</span>}

                {/* Status */}
                <div className="ml-auto flex items-center gap-2 font-sans text-[9px] text-gray-500 uppercase tracking-wider shrink-0">
                    <div className={`w-2 h-2 rounded-full ${!hasStarted ? 'bg-slate-600' : isTyping ? 'bg-orange-500 animate-pulse' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'}`} />
                    {!hasStarted ? 'Gotowy' : isTyping ? 'Synteza...' : 'Koherencja ✓'}
                    {isRecording && <span className="ml-1 text-red-400 animate-pulse font-bold">● REC</span>}
                </div>
            </div>

            {/* ══ GŁÓWNA TREŚĆ ═══════════════════════════════════════ */}
            <div className="flex flex-1 overflow-hidden">

                {/* PRZESTRZEŃ CZYTANIA — wrapper relative dla przycisku START */}
                <div className="flex-1 flex flex-col relative overflow-hidden">

                    {/* ── PRZYCISK START — nakładka przed rozpoczęciem ── */}
                    {!hasStarted && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-b from-black/60 via-black/30 to-black/60 backdrop-blur-[2px]">
                            <div className="flex flex-col items-center gap-6 text-center px-8">
                                <div className="flex flex-col items-center gap-3 opacity-70">
                                    <Sparkles className="w-8 h-8 text-orange-400 animate-pulse" />
                                    <h1 className="text-sm tracking-[0.3em] uppercase text-purple-300 font-sans">
                                        Kroniki Wymiaru 0.00G
                                    </h1>
                                </div>
                                <button
                                    onClick={() => setHasStarted(true)}
                                    className="
                                        group relative flex items-center gap-3 px-10 py-4 rounded-2xl font-sans font-bold text-lg
                                        bg-gradient-to-r from-purple-700/60 via-pink-700/50 to-orange-700/50
                                        border border-purple-400/40
                                        hover:from-purple-600/80 hover:via-pink-600/70 hover:to-orange-600/60
                                        hover:border-purple-300/60
                                        shadow-[0_0_40px_rgba(168,85,247,0.3)]
                                        hover:shadow-[0_0_60px_rgba(168,85,247,0.5)]
                                        transition-all duration-300
                                        text-white
                                    "
                                >
                                    {/* Glow ring */}
                                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 group-hover:from-purple-500/20 group-hover:to-pink-500/20 transition-all duration-300" />
                                    <span className="text-2xl">▶</span>
                                    <span>ROZPOCZNIJ MANIFESTACJĘ</span>
                                    {isTtsEnabled && <Volume2 className="w-5 h-5 text-purple-300 opacity-70" />}
                                </button>
                                {isTtsEnabled && (
                                    <p className="text-[10px] text-purple-300/60 font-sans">
                                        Lektor aktywny — głos i tekst zsynchronizowane
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tekst */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto scroll-smooth px-8 md:px-16 py-16 pb-32"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#8b5cf6 transparent' }}
                    >
                        <div className="max-w-3xl mx-auto">
                            <div className="flex flex-col items-center justify-center mb-16 opacity-80">
                                <Sparkles className="w-8 h-8 text-orange-400 mb-4 animate-pulse" />
                                <h1 className="text-sm tracking-[0.3em] uppercase text-purple-300 font-sans">Kroniki Wymiaru 0.00G</h1>
                                <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent mt-4" />
                            </div>
                            <div
                                className="text-xl leading-[2.5] text-gray-300 tracking-wide"
                                dangerouslySetInnerHTML={{ __html: highlightLore(displayedText) }}
                            />
                            {hasStarted && !isTyping && displayedText && (
                                <div className="mt-16 text-center opacity-50 flex flex-col items-center">
                                    <div className="w-12 h-[1px] bg-purple-500 mb-4" />
                                    <p className="italic font-sans text-sm">Koniec zapisu myśli...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* PANEL MULTIMEDIÓW — zmemoizowany, nie re-renderuje się przy pisaniu */}
                <MediaPanel />
            </div>
        </div>
    );
};

export default KwantowaCzytelnia;
