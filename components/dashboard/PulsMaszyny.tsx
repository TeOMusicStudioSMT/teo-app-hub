/**
 * 🫀 PULS MASZYNY — RAM, VRAM i temperatura karty na żywo, z mostu.
 *
 * Suweren podrzucił benjitaylor/liveline (MIT, canvas, zero zależności poza
 * Reactem): „narzędzie do rysowania wykresów — jak mamy jakieś w Katedrze".
 * Mieliśmy: KineticChart z krzywą WPISANĄ NA SZTYWNO, usunięty 2026-09-11.
 * To jest jego uczciwy następca — każda kropka to pomiar z /api/system/pulse.
 *
 * ⚠️ DLACZEGO TO JEST NA EKRANIE STARTOWYM. Noc 2026-09-11: model 24,8 GB wszedł
 * do RAM, wolne spadło do 3,7 GB, plik wymiany 5,5 GB, most padł, komputer
 * „buczał". Nikt tego nie widział, dopóki nie padło. Trzy linie na dashboardzie
 * pokazałyby to pięć minut wcześniej.
 *
 * ⚠️ PROGI TO OSTRZEŻENIA, NIE DIAGNOZY. „RAM 90 %" mówi, że jest ciasno — nie
 * mówi, kto zajął. Winowajcę wskazuje Ollama (/api/ps) albo Menedżer zadań;
 * karta nie zgaduje.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Liveline, type LivelinePoint } from 'liveline';
import DashboardCard from '../DashboardCard';
import { Activity } from 'lucide-react';

const MOST = 'http://127.0.0.1:3001';
const CO_ILE_MS = 2000;
const OKNO_SEK = 300;

interface Puls {
    ram: { usedMB: number; totalMB: number; pct: number };
    cpu: { pct: number; cores: number };
    gpu: { vramUsedMB: number; vramTotalMB: number; tempC: number; utilPct: number } | null;
    at: number;
}

const PROGI = { ramPct: 88, vramPct: 92, tempC: 85 };

export const PulsMaszyny: React.FC = () => {
    const [puls, setPuls] = useState<Puls | null>(null);
    const [mostZyje, setMostZyje] = useState<boolean | null>(null);
    const ram = useRef<LivelinePoint[]>([]);
    const vram = useRef<LivelinePoint[]>([]);
    const temp = useRef<LivelinePoint[]>([]);
    const [, tik] = useState(0);

    useEffect(() => {
        let zywy = true;
        const pobierz = async () => {
            try {
                const r = await fetch(`${MOST}/api/system/pulse`);
                const d = (await r.json()) as Puls & { success?: boolean };
                if (!zywy || d.success === false) return;
                const t = d.at ?? Date.now();
                const dopisz = (lista: LivelinePoint[], v: number) => {
                    lista.push({ time: t, value: v });
                    const granica = t - OKNO_SEK * 1000 - 5000;
                    while (lista.length && lista[0].time < granica) lista.shift();
                };
                dopisz(ram.current, d.ram.pct);
                if (d.gpu) {
                    dopisz(vram.current, Math.round((d.gpu.vramUsedMB / d.gpu.vramTotalMB) * 100));
                    dopisz(temp.current, d.gpu.tempC);
                }
                setPuls(d);
                setMostZyje(true);
                tik((n) => n + 1);
            } catch {
                if (zywy) setMostZyje(false);
            }
        };
        void pobierz();
        const i = window.setInterval(() => void pobierz(), CO_ILE_MS);
        return () => { zywy = false; window.clearInterval(i); };
    }, []);

    const ostrzezenia: string[] = [];
    if (puls) {
        if (puls.ram.pct >= PROGI.ramPct) ostrzezenia.push(`RAM ${puls.ram.pct} % — blisko pliku wymiany; sprawdź, co Ollama trzyma (ollama ps)`);
        if (puls.gpu && (puls.gpu.vramUsedMB / puls.gpu.vramTotalMB) * 100 >= PROGI.vramPct) ostrzezenia.push(`VRAM prawie pełny — kolejny render albo model nie wejdzie`);
        if (puls.gpu && puls.gpu.tempC >= PROGI.tempC) ostrzezenia.push(`karta ${puls.gpu.tempC} °C — pod obciążeniem; nie dokładaj drugiego liczenia`);
    }

    const vramPct = puls?.gpu ? Math.round((puls.gpu.vramUsedMB / puls.gpu.vramTotalMB) * 100) : null;

    return (
        <DashboardCard title="Puls maszyny" icon={<Activity className="w-full h-full" />}>
            <div className="flex flex-col gap-3">
                {mostZyje === false && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-200">
                        Most (:3001) milczy — bez niego nie ma pomiaru. Karta nie wymyśla wartości.
                    </div>
                )}

                {/* ── Liczby teraz ── */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <Liczba etykieta="RAM" wartosc={puls ? `${puls.ram.pct} %` : '—'} pod={puls ? `${(puls.ram.usedMB / 1024).toFixed(1)} / ${(puls.ram.totalMB / 1024).toFixed(0)} GB` : ''} alarm={!!puls && puls.ram.pct >= PROGI.ramPct} kolor="#22d3ee" />
                    <Liczba etykieta="VRAM" wartosc={vramPct !== null ? `${vramPct} %` : '—'} pod={puls?.gpu ? `${(puls.gpu.vramUsedMB / 1024).toFixed(1)} / ${(puls.gpu.vramTotalMB / 1024).toFixed(0)} GB` : 'brak karty'} alarm={vramPct !== null && vramPct >= PROGI.vramPct} kolor="#a855f7" />
                    <Liczba etykieta="GPU" wartosc={puls?.gpu ? `${puls.gpu.tempC} °C` : '—'} pod={puls?.gpu ? `${puls.gpu.utilPct} % · CPU ${puls.cpu.pct} %` : ''} alarm={!!puls?.gpu && puls.gpu.tempC >= PROGI.tempC} kolor="#f59e0b" />
                </div>

                {/* ── Trzy linie, 5 minut ── */}
                <div className="h-40 rounded-xl bg-black/30 p-1">
                    <Liveline
                        data={ram.current}
                        value={puls?.ram.pct ?? 0}
                        series={[
                            { id: 'ram', data: ram.current, value: puls?.ram.pct ?? 0, color: '#22d3ee', label: 'RAM %' },
                            { id: 'vram', data: vram.current, value: vramPct ?? 0, color: '#a855f7', label: 'VRAM %' },
                            { id: 'temp', data: temp.current, value: puls?.gpu?.tempC ?? 0, color: '#f59e0b', label: 'GPU °C' },
                        ]}
                        theme="dark"
                        window={OKNO_SEK}
                        grid
                        badge={false}
                        momentum={false}
                        fill={false}
                        loading={mostZyje === null}
                        emptyText="czekam na pierwszy pomiar…"
                        referenceLine={{ value: PROGI.ramPct, label: `próg ${PROGI.ramPct}` }}
                        formatValue={(v) => `${Math.round(v)}`}
                        lineWidth={1.5}
                    />
                </div>

                {ostrzezenia.length > 0 && (
                    <ul className="space-y-1 text-[11px] text-amber-200">
                        {ostrzezenia.map((o) => <li key={o}>⚠️ {o}</li>)}
                    </ul>
                )}
                <div className="text-[10px] font-mono text-slate-600">
                    co {CO_ILE_MS / 1000} s z /api/system/pulse · okno {OKNO_SEK / 60} min · progi: RAM {PROGI.ramPct} %, VRAM {PROGI.vramPct} %, GPU {PROGI.tempC} °C
                </div>
            </div>
        </DashboardCard>
    );
};

const Liczba: React.FC<{ etykieta: string; wartosc: string; pod: string; alarm: boolean; kolor: string }> = ({ etykieta, wartosc, pod, alarm, kolor }) => (
    <div className={`rounded-lg border p-2 ${alarm ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-700/50 bg-slate-800/40'}`}>
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{etykieta}</div>
        <div className="text-xl font-bold" style={{ color: alarm ? '#fbbf24' : kolor }}>{wartosc}</div>
        <div className="text-[10px] text-slate-500">{pod}</div>
    </div>
);
