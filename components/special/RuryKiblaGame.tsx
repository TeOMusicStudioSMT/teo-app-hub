/**
 * 🚽 RuryKiblaGame — zabawna mini-gra z TeO Arcade osadzona w Drożności Rur.
 *
 * "Flush Frenzy 0.00G": rury zapełniają się ciśnieniem — spuszczaj wodę
 * (SPACE/klik) zanim pęknie, odtykaj 💩. Tryby: 🧘 Chill / ⚙️ Normal / 🔥 Endless(×2).
 * Pauza [P]. Sandbox iframe (jak Arcade).
 *
 * 🏆 Leaderboard z INICJAŁAMI: gra → postMessage → React (TOP 5 w localStorage).
 */

import React, { useState, useEffect, useCallback } from 'react';

const LB_KEY = 'teo_rury_kibla_lb';

interface Score { initials: string; score: number; date: string; mode: string; }

const readBoard = (): Score[] => {
    try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch { return []; }
};

const MODE_TAG: Record<string, string> = { chill: '🧘', normal: '⚙️', endless: '🔥' };

const GAME_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rury Kibla</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-user-select:none;user-select:none}
body{background:#06080f;color:#e8dfc8;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;overflow:hidden}
#modes{display:flex;gap:6px;margin-bottom:6px}
.mb{font:inherit;font-size:10px;letter-spacing:.1em;padding:4px 8px;border-radius:8px;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.55)}
.mb.on{border-color:#f472b6;color:#f472b6;background:rgba(244,114,182,.12)}
#hud{display:flex;gap:14px;font-size:12px;letter-spacing:.12em;color:#22d3ee;margin-bottom:6px}
#hud b{color:#fbbf24}
canvas{border:1px solid rgba(34,211,238,.25);border-radius:10px;box-shadow:0 0 30px rgba(34,211,238,.12);background:#070a12;touch-action:none}
#msg{margin-top:8px;font-size:11px;color:#4ade80;min-height:16px;letter-spacing:.1em;text-align:center}
#hint{margin-top:4px;font-size:9px;color:rgba(255,255,255,.35)}
</style></head><body>
<div id="modes">
  <button class="mb" data-m="chill">🧘 CHILL</button>
  <button class="mb on" data-m="normal">⚙️ NORMAL</button>
  <button class="mb" data-m="endless">🔥 ENDLESS ×2</button>
</div>
<div id="hud"><span>SPŁUKANIA: <b id="flush">0</b></span><span>CIŚNIENIE: <b id="pr">0</b>%</span><span>ŻYCIA: <b id="hp">3</b></span></div>
<canvas id="c" width="360" height="290"></canvas>
<div id="msg">Spuść wodę gdy ciśnienie wysokie — ale nie pozwól pęknąć!</div>
<div id="hint">[ SPACJA/KLIK ] SPŁUCZKA · klik 💩 odetkaj · [ P ] pauza</div>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
const RAMP={chill:[0.30,0.020],normal:[0.45,0.040],endless:[0.65,0.060]};
let mode='normal',paused=false;
let pr=0,flush=0,hp=3,clogs=[],over=false,flash=0,t=0,lastT=performance.now();
const CLOG_MS={chill:7700,normal:6000,endless:6000};   // żywotność zatoru w MS (czas, nie klatki)
const rand=(a,b)=>a+Math.random()*(b-a);
const flush_=document.getElementById('flush'),pr_=document.getElementById('pr'),hp_=document.getElementById('hp'),msg=document.getElementById('msg');
function upd(){flush_.textContent=flush;pr_.textContent=Math.floor(pr);hp_.textContent=hp;}
function reset(){pr=0;flush=0;hp=3;clogs=[];over=false;paused=false;upd();}
document.querySelectorAll('.mb').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.mb').forEach(z=>z.classList.remove('on'));
  b.classList.add('on');mode=b.dataset.m;reset();
  msg.textContent='Tryb: '+b.textContent.trim()+' — start!';
}));
function doFlush(){
  if(over)return reset();
  if(paused)return;
  if(pr>60){flush++;const g=Math.floor(pr);msg.textContent='✅ SPŁUKANE! +'+g+' (ciśn. '+Math.floor(pr)+'%)';pr=0;flash=12;}
  else{msg.textContent='💨 Za słabe ciśnienie ('+Math.floor(pr)+'%) — czekaj!';}
  upd();
}
function loseLife(reason){
  hp--;flash=18;pr=0;clogs=[];msg.textContent=reason+' (-1 życie)';
  if(hp<=0){over=true;msg.textContent='💀 KONIEC! Spłukania: '+flush+' — klik by zagrać ponownie';
    try{parent.postMessage({type:'flush_score',flush:flush,mode:mode},'*');}catch(e){}}
  upd();
}
addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault();doFlush();}
  if(e.code==='KeyP'&&!over){paused=!paused;msg.textContent=paused?'⏸ PAUZA — [P] wznów':'▶ Wznowiono';}
});
c.addEventListener('pointerdown',e=>{
  if(over){reset();return;}
  if(paused){paused=false;msg.textContent='▶ Wznowiono';return;}
  const r=c.getBoundingClientRect(),mx=(e.clientX-r.left)*(360/r.width),my=(e.clientY-r.top)*(290/r.height);
  for(let i=0;i<clogs.length;i++){const k=clogs[i];if(Math.hypot(k.x-mx,k.y-my)<22){clogs.splice(i,1);msg.textContent='🧻 Odetkane!';return;}}
  doFlush();
});
function loop(now){
  now=now||performance.now();t++;
  const dt=Math.min(now-lastT,100);lastT=now;   // delta-time (cap 100ms po pauzie/refocusie)
  const f=dt/16.67;                             // 1.0 przy 60 FPS — fizyka niezależna od klatek
  if(!over&&!paused){
    pr+=(RAMP[mode][0]+flush*RAMP[mode][1])*f;
    if(pr>=100)loseLife('💥 RURA PĘKŁA!');
    const clogRate=((mode==='chill'?0.008:mode==='endless'?0.016:0.012)+flush*0.001)*f;
    if(Math.random()<clogRate&&clogs.length<4)clogs.push({x:rand(60,300),y:rand(70,225),born:now});
    for(const k of clogs){if(now-k.born>(CLOG_MS[mode]||6000)){loseLife('🚫 Zator zatkał rurę!');break;}}
  }
  draw();requestAnimationFrame(loop);
}
function draw(){
  x.clearRect(0,0,360,290);
  const cx=180;x.strokeStyle='rgba(34,211,238,.25)';x.lineWidth=34;
  x.beginPath();x.moveTo(cx,38);x.lineTo(cx,232);x.stroke();
  const top=232-(194*Math.min(pr,100)/100);
  const g=x.createLinearGradient(0,top,0,232),danger=pr>85;
  g.addColorStop(0,danger?'#f87171':'#38bdf8');g.addColorStop(1,danger?'#ef4444':'#0ea5e9');
  x.strokeStyle=g;x.lineWidth=24;x.lineCap='round';
  x.beginPath();x.moveTo(cx,232);x.lineTo(cx,Math.max(top,40));x.stroke();
  x.font='32px serif';x.textAlign='center';x.fillText('🚽',cx,276);x.fillText('🛢️',cx,36);
  x.font='25px serif';
  for(const k of clogs){const age=(performance.now()-k.born)/(CLOG_MS[mode]||6000);x.globalAlpha=age>0.7?(Math.sin(t*0.4)>0?1:.4):1;x.fillText('💩',k.x,k.y+9);x.globalAlpha=1;}
  if(flash>0){x.fillStyle='rgba(74,222,128,'+(flash/24)+')';x.fillRect(0,0,360,290);flash--;}
  x.fillStyle=pr>85?'#ef4444':pr>60?'#fbbf24':'#22d3ee';x.fillRect(10,285,(340*Math.min(pr,100)/100),4);
  if(paused){x.fillStyle='rgba(6,8,15,.72)';x.fillRect(0,0,360,290);x.fillStyle='#fbbf24';x.font='bold 20px monospace';x.fillText('⏸ PAUZA',180,150);}
}
reset();requestAnimationFrame(loop);
</script></body></html>`;

export const RuryKiblaGame: React.FC = () => {
    const [board, setBoard] = useState<Score[]>(readBoard);
    const [pending, setPending] = useState<{ score: number; mode: string } | null>(null);
    const [initials, setInitials] = useState('TEO');

    const handleMsg = useCallback((e: MessageEvent) => {
        const d = e?.data;
        if (!d || d.type !== 'flush_score' || typeof d.flush !== 'number') return;
        const mode = String(d.mode || 'normal');
        const score = mode === 'endless' ? d.flush * 2 : d.flush;   // 🔥 Endless ×2
        if (score <= 0) return;
        const cur = readBoard();
        const qualifies = cur.length < 5 || score > (cur[cur.length - 1]?.score ?? 0);
        if (qualifies) setPending({ score, mode });
    }, []);

    useEffect(() => {
        window.addEventListener('message', handleMsg);
        return () => window.removeEventListener('message', handleMsg);
    }, [handleMsg]);

    const commit = () => {
        if (!pending) return;
        const entry: Score = {
            initials: (initials.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'TEO'),
            score: pending.score,
            date: new Date().toLocaleDateString('pl-PL'),
            mode: pending.mode,
        };
        const next = [...readBoard(), entry].sort((a, b) => b.score - a.score).slice(0, 5);
        try { localStorage.setItem(LB_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        setBoard(next);
        setPending(null);
    };

    const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

    return (
        <div style={{ width: '100%', maxWidth: 380, margin: '0 auto' }}>
            <iframe
                title="Rury Kibla — TeO Arcade"
                srcDoc={GAME_HTML}
                sandbox="allow-scripts"
                style={{ width: '100%', height: 430, border: '1px solid rgba(244,114,182,0.3)', borderRadius: 12, background: '#06080f' }}
            />

            {/* 🏷️ Wpis rekordu z inicjałami */}
            {pending && (
                <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 12,
                    background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.4)',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    <div style={{ fontSize: 10, color: '#4ade80', letterSpacing: '0.15em', marginBottom: 6 }}>
                        ✨ NOWY REKORD: {pending.score} {MODE_TAG[pending.mode]} — wpisz inicjały!
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            value={initials}
                            onChange={e => setInitials(e.target.value.toUpperCase().slice(0, 3))}
                            onKeyDown={e => e.key === 'Enter' && commit()}
                            maxLength={3}
                            autoFocus
                            style={{
                                width: 70, textAlign: 'center', letterSpacing: '0.3em',
                                background: '#06080f', border: '1px solid rgba(74,222,128,0.4)',
                                borderRadius: 8, color: '#4ade80', padding: '6px', fontFamily: 'inherit', fontSize: 14, outline: 'none',
                            }}
                        />
                        <button onClick={commit} style={{
                            flex: 1, background: 'rgba(74,222,128,0.18)', border: '1px solid rgba(74,222,128,0.5)',
                            borderRadius: 8, color: '#4ade80', fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
                        }}>
                            🏆 ZAPISZ NA TABLICY
                        </button>
                    </div>
                </div>
            )}

            {/* 🏆 Leaderboard */}
            <div style={{
                marginTop: 10, padding: '10px 12px',
                background: 'rgba(244,114,182,0.05)', border: '1px solid rgba(244,114,182,0.25)',
                borderRadius: 12, fontFamily: "'JetBrains Mono', monospace",
            }}>
                <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#f472b6', marginBottom: 8 }}>
                    🏆 TABLICA REKORDÓW — RURY KIBLA
                </div>
                {board.length === 0 ? (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '6px 0' }}>
                        Brak rekordów — zostań pierwszym mistrzem spłuczki!
                    </div>
                ) : (
                    board.map((s, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', fontSize: 11, padding: '3px 0',
                            color: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.7)',
                            borderBottom: i < board.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}>
                            <span style={{ width: 26 }}>{medals[i]}</span>
                            <span style={{ width: 42, fontWeight: 700, letterSpacing: '0.15em', color: i === 0 ? '#fbbf24' : '#f472b6' }}>{s.initials || '???'}</span>
                            <span style={{ flex: 1, fontWeight: i === 0 ? 700 : 400 }}>{s.score} {MODE_TAG[s.mode] || ''}</span>
                            <span style={{ fontSize: 9, opacity: 0.5 }}>{s.date}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RuryKiblaGame;
