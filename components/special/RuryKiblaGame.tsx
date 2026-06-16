/**
 * 🚽 RuryKiblaGame — zabawna mini-gra z TeO Arcade osadzona w Drożności Rur.
 *
 * "Flush Frenzy 0.00G": rury zapełniają się ciśnieniem, a Suweren musi spuszczać
 * wodę w odpowiednim momencie (SPACE / klik) zanim nastąpi przepełnienie. Klog (💩)
 * trzeba odklikać zanim zatka rurę. Czysto klientowa, sandbox iframe (jak Arcade).
 *
 * 🏆 Leaderboard: gra (sandbox) wysyła wynik przez postMessage do Reacta, który
 * trzyma TOP 5 w localStorage (iframe bez allow-same-origin nie ma własnego storage).
 */

import React, { useState, useEffect, useCallback } from 'react';

const LB_KEY = 'teo_rury_kibla_lb';

interface Score { score: number; date: string; }

const GAME_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rury Kibla</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-user-select:none;user-select:none}
body{background:#06080f;color:#e8dfc8;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;overflow:hidden}
#hud{display:flex;gap:18px;font-size:12px;letter-spacing:.15em;color:#22d3ee;margin-bottom:8px}
#hud b{color:#fbbf24}
canvas{border:1px solid rgba(34,211,238,.25);border-radius:10px;box-shadow:0 0 30px rgba(34,211,238,.12);background:#070a12;touch-action:none}
#msg{margin-top:8px;font-size:11px;color:#4ade80;min-height:16px;letter-spacing:.1em}
#hint{margin-top:4px;font-size:9px;color:rgba(255,255,255,.35)}
</style></head><body>
<div id="hud"><span>SPŁUKANIA: <b id="flush">0</b></span><span>CIŚNIENIE: <b id="pr">0</b>%</span><span>ŻYCIA: <b id="hp">3</b></span></div>
<canvas id="c" width="360" height="300"></canvas>
<div id="msg">Spuść wodę gdy ciśnienie wysokie — ale nie pozwól mu pęknąć!</div>
<div id="hint">[ SPACJA / KLIK ] = SPŁUCZKA &nbsp;·&nbsp; klik 💩 by odetkać</div>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
let pr=0,flush=0,hp=3,clogs=[],over=false,flash=0,t=0;
const rand=(a,b)=>a+Math.random()*(b-a);
function reset(){pr=0;flush=0;hp=3;clogs=[];over=false;upd();}
function upd(){flush_.textContent=flush;pr_.textContent=Math.floor(pr);hp_.textContent=hp;}
const flush_=document.getElementById('flush'),pr_=document.getElementById('pr'),hp_=document.getElementById('hp'),msg=document.getElementById('msg');
function doFlush(){
  if(over)return reset();
  if(pr>60){ flush++; const gain=Math.floor(pr); msg.textContent='✅ SPŁUKANE! +'+gain+' (ciśnienie '+Math.floor(pr)+'%)'; pr=0; flash=12; }
  else { msg.textContent='💨 Za słabe ciśnienie ('+Math.floor(pr)+'%) — czekaj!'; }
  upd();
}
function loseLife(reason){
  hp--; flash=18; pr=0; clogs=[]; msg.textContent=reason+' (-1 życie)';
  if(hp<=0){
    over=true; msg.textContent='💀 KONIEC! Spłukania: '+flush+' — klik by zagrać ponownie';
    try{ parent.postMessage({ type:'flush_score', flush:flush }, '*'); }catch(e){}
  }
  upd();
}
addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();doFlush();}});
c.addEventListener('pointerdown',e=>{
  if(over){reset();return;}
  const r=c.getBoundingClientRect(),mx=(e.clientX-r.left)*(360/r.width),my=(e.clientY-r.top)*(300/r.height);
  for(let i=0;i<clogs.length;i++){const k=clogs[i];if(Math.hypot(k.x-mx,k.y-my)<22){clogs.splice(i,1);msg.textContent='🧻 Odetkane!';return;}}
  doFlush();
});
function loop(){
  t++;
  if(!over){
    pr+=0.45+flush*0.04;
    if(pr>=100){loseLife('💥 RURA PĘKŁA!');}
    if(Math.random()<0.012+flush*0.001 && clogs.length<4){ clogs.push({x:rand(60,300),y:rand(70,230),born:t}); }
    for(const k of clogs){ if(t-k.born>360){ loseLife('🚫 Zator zatkał rurę!'); break; } }
  }
  draw();requestAnimationFrame(loop);
}
function draw(){
  x.clearRect(0,0,360,300);
  const cx=180; x.strokeStyle='rgba(34,211,238,.25)';x.lineWidth=34;
  x.beginPath();x.moveTo(cx,40);x.lineTo(cx,240);x.stroke();
  const top=240-(200*Math.min(pr,100)/100);
  const g=x.createLinearGradient(0,top,0,240);
  const danger=pr>85; g.addColorStop(0,danger?'#f87171':'#38bdf8');g.addColorStop(1,danger?'#ef4444':'#0ea5e9');
  x.strokeStyle=g;x.lineWidth=24;x.lineCap='round';
  x.beginPath();x.moveTo(cx,240);x.lineTo(cx,Math.max(top,42));x.stroke();
  x.font='34px serif';x.textAlign='center';x.fillText('🚽',cx,285);
  x.fillText('🛢️',cx,38);
  x.font='26px serif';
  for(const k of clogs){ const age=(t-k.born)/360; x.globalAlpha=age>0.7?(Math.sin(t*0.4)>0?1:.4):1; x.fillText('💩',k.x,k.y+9); x.globalAlpha=1; }
  if(flash>0){x.fillStyle='rgba(74,222,128,'+(flash/24)+')';x.fillRect(0,0,360,300);flash--;}
  x.fillStyle=pr>85?'#ef4444':pr>60?'#fbbf24':'#22d3ee';x.fillRect(10,294,(340*Math.min(pr,100)/100),4);
}
reset();loop();
</script></body></html>`;

export const RuryKiblaGame: React.FC = () => {
    const [board, setBoard] = useState<Score[]>(() => {
        try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch { return []; }
    });
    const [isNew, setIsNew] = useState(false);

    const handleMsg = useCallback((e: MessageEvent) => {
        const d = e?.data;
        if (!d || d.type !== 'flush_score' || typeof d.flush !== 'number' || d.flush <= 0) return;
        setBoard(prev => {
            const wasRecord = prev.length < 5 || d.flush > (prev[prev.length - 1]?.score ?? 0);
            const next = [...prev, { score: d.flush, date: new Date().toLocaleDateString('pl-PL') }]
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);
            try { localStorage.setItem(LB_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            if (wasRecord) { setIsNew(true); setTimeout(() => setIsNew(false), 4000); }
            return next;
        });
    }, []);

    useEffect(() => {
        window.addEventListener('message', handleMsg);
        return () => window.removeEventListener('message', handleMsg);
    }, [handleMsg]);

    const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

    return (
        <div style={{ width: '100%', maxWidth: 380, margin: '0 auto' }}>
            <iframe
                title="Rury Kibla — TeO Arcade"
                srcDoc={GAME_HTML}
                sandbox="allow-scripts"
                style={{ width: '100%', height: 380, border: '1px solid rgba(244,114,182,0.3)', borderRadius: 12, background: '#06080f' }}
            />

            {/* 🏆 Leaderboard */}
            <div style={{
                marginTop: 10, padding: '10px 12px',
                background: 'rgba(244,114,182,0.05)',
                border: '1px solid rgba(244,114,182,0.25)',
                borderRadius: 12, fontFamily: "'JetBrains Mono', monospace",
            }}>
                <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#f472b6', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>🏆 TABLICA REKORDÓW — RURY KIBLA</span>
                    {isNew && <span style={{ color: '#4ade80', animation: 'none' }}>✨ NOWY REKORD!</span>}
                </div>
                {board.length === 0 ? (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '6px 0' }}>
                        Brak rekordów — zostań pierwszym mistrzem spłuczki!
                    </div>
                ) : (
                    board.map((s, i) => (
                        <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontSize: 11, padding: '3px 0',
                            color: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.7)',
                            borderBottom: i < board.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}>
                            <span style={{ width: 28 }}>{medals[i]}</span>
                            <span style={{ flex: 1, fontWeight: i === 0 ? 700 : 400 }}>{s.score} spłukań</span>
                            <span style={{ fontSize: 9, opacity: 0.5 }}>{s.date}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RuryKiblaGame;
