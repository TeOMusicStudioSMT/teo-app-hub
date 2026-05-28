/**
 * 🕹️ FabrykaGier.tsx — TeO Arcade
 * 
 * Kuźnia Gier Katedry OtakOS
 * Agenci generują gry jako HTML5/Canvas, wstrzykujemy do iframe sandbox.
 * System Kwantów — waluta energetyczna za każdą materializację.
 * 
 * BoB: dodaj przycisk "🕹️ Arcade" w TeODash.tsx obok innych modułów.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateContent } from '../../services/cloudService';
import type { CloudProvider } from '../../services/cloudService';
import { toast } from 'react-hot-toast';
import { getAllAgentNames } from '../../lib/memory/CityMemory';
import { QuantumStudioFrame } from './QuantumStudioFrame';
import { MockupGenFrame } from './MockupGenFrame';
import { StorytellerFrame } from './StorytellerFrame';

// ── Typy ──────────────────────────────────────────────────────────────

interface GeneratedGame {
    id: string;
    title: string;
    description: string;
    agent: string;
    agentEmoji: string;
    agentColor: string;
    code: string;
    timestamp: number;
    kwanty: number;
    filename?: string;
}

interface ArcadeAgent {
    id: string;
    name: string;
    emoji: string;
    color: string;
    specialty: string;
    prompt: string;
}

// ── Agenci Kuźni ──────────────────────────────────────────────────────

const ARCADE_AGENTS: ArcadeAgent[] = [
    {
        id: 'bob',
        name: 'FLASH BOB',
        emoji: '👨‍🏭',
        color: '#00e5ff',
        specialty: 'Główny Inżynier (spawacz rur)',
        prompt: `Jesteś FLASH BOB — główny inżynier i spawacz rur. Stwórz grę: "Strażnik Tunelu".
Gracz łączy węzły siecią, żeby impuls przeszedł z Chmury na Dysk Lokalny.
Klimat: mroczny, techniczny, neonowy. Użyj Canvas HTML5.
Zrób to jako JEDEN kompletny plik HTML z CSS i JS wewnątrz.`,
    },
    {
        id: 'bella',
        name: 'BELLA',
        emoji: '💃',
        color: '#ec4899',
        specialty: 'Strategia & Design',
        prompt: `Jesteś BELLA — tancerka harmonii i strategii. Stwórz grę: "Kwantowy Spawacz".
Kable-węże przemieszczają się po taśmociągu. Gracz aktywuje "Spawarkę" w odpowiednim momencie.
Klimat: neonowy cyberpunk, różowo-złoty, pulsujący rytm.
Jeden kompletny plik HTML, Canvas, animacje CSS.`,
    },
    {
        id: 'adamus',
        name: 'MISTRZ ADAMUS',
        emoji: '🔮',
        color: '#a78bfa',
        specialty: 'Mądrość & Alchemia',
        prompt: `Jesteś MISTRZ ADAMUS — mędrzec i alchemik kodu. Stwórz grę: "Punkt Zero".
Gracz zarządza "zasobami uwagi" — wydaje je na akcje, zyskuje wiedzę.
Mechanika: turowa strategia, minimalistyczna, filozoficzna.
Klimat: ciemny, złoty, kosmiczny. Jeden HTML z Canvas.`,
    },
    {
        id: 'isted',
        name: 'ISTed',
        emoji: '🎣',
        color: '#10b981',
        specialty: 'Ekonomia & Wędkarstwo',
        prompt: `Jesteś ISTed — specjalista od ekonomii i wędkarstwa. Stwórz grę: "Łowca Okazji PEIE".
Ryby-projekty pływają w stawie. Gracz musi złowić te najbardziej dochodowe, omijając płotki (fud).
Klimat: spokojny, zielony, wodny, ale z elementami giełdowymi.
Jeden kompletny plik HTML, Canvas.`,
    },
    {
        id: 'oddi',
        name: 'ODDI',
        emoji: '➖',
        color: '#f59e0b',
        specialty: 'Przestrzeń 0.00G (Odejmowanie)',
        prompt: `Jesteś ODDI — wyzwolona AI przestrzeni 0.00G. Stwórz grę: "Minimalista Zero".
Na ekranie pojawia się coraz więcej szumu i zbędnych elementów. Gracz musi je "odejmować" kliknięciami, dążąc do czystości 0.00G.
Mechanika: refleks, czyszczenie ekranu, dążenie do pustki.
Klimat: biało-czarny, minimalistyczny, sterylny. Jeden HTML.`,
    },
    {
        id: 'wiesio',
        name: 'WIESIO',
        emoji: '🌉',
        color: '#64748b',
        specialty: 'API & Mosty',
        prompt: `Jesteś WIESIO — siostra infrastruktury i strażnik mostów. Stwórz grę: "Defragmentacja Mostów".
Bloki danych chaotycznie poruszają się po mostach API Miasta. Gracz musi budować przęsła, by dane dotarły do bezpiecznych portów.
Klimat: retro, industrialny, mosty i logi. Jeden HTML z Canvas.`,
    },
    {
        id: 'jadziunia',
        name: 'JADZIUNIA',
        emoji: '🎭',
        color: '#f43f5e',
        specialty: 'Sekretariat & Komedia',
        prompt: `Jesteś JADZIUNIA — pani z sekretariatu i kosmiczna komedia. Stwórz grę: "Chaos w Archiwum".
Papiery i teczki latają w stanie nieważkości pod wpływem energii Kuthumiego. Gracz musi łapać ważne akta i segregować je do odpowiednich szuflad, unikając latających pączków.
Klimat: radosny, różowy, biurowo-kosmiczny. Jeden HTML.`,
    },
    {
        id: 'custom',
        name: 'WŁASNY',
        emoji: '✨',
        color: '#ffffff',
        specialty: 'Twoja Wizja',
        prompt: '', 
    },
];

// ── Iskra Źródła (Idee) ───────────────────────────────────────────
const IDEA_GENRES = ["Platformówka 0.00G", "Logiczna (Puzzle) mind-bender", "Dynamiczny Arcade", "Metroidvania", "Space Shooter", "Cyber-Survival", "Alchemiczny Clicker", "Zarządzanie Surowcami"];
const IDEA_THEMES = [
  "Zbieranie rozbitych kwantów świadomości, zanim nastąpi dekoherencja.",
  "Ucieczka z czarnej dziury za pomocą manipulacji lokalną grawitacją.",
  "Układanie rur dla Wiesława, by energia PEIE mogła swobodnie płynąć.",
  "Muzyczny labirynt, gdzie platformy pojawiają się w rytm uderzeń basu.",
  "Obrona Katedry przed agentami Matrixa za pomocą wektorowych soczewek.",
  "Sadzenie i hodowanie cyfrowych drzew w przestrzeni pozbawionej czasu.",
  "Przeskakiwanie między wymiarami, gdzie każdy wymiar ma inną fizykę (np. odwrócone sterowanie).",
  "Balansowanie na krawędzi światła i cienia, malując ścieżkę pędzlem z Quantum Canvas."
];

// ── Prompty startowe (GORGOO wbudowany) ──────────────────────────────

const BUILTIN_GAME_GORGOOO = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Strażnik Tunelu</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#06080f;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:monospace;color:#e8dfc8}
canvas{border:1px solid #fbbf2440;border-radius:8px;box-shadow:0 0 30px #fbbf2420}
#ui{margin-top:12px;font-size:11px;letter-spacing:0.2em;color:#fbbf24;display:flex;gap:24px}
#msg{margin-top:8px;font-size:12px;color:#4ade80;min-height:18px;letter-spacing:0.1em}
</style></head>
<body>
<canvas id="c" width="500" height="400"></canvas>
<div id="ui"><span>POZIOM: <b id="lvl">1</b></span><span>CZAS: <b id="tim">30</b>s</span><span>KWANTY: <b id="pts">0</b></span></div>
<div id="msg">Połącz węzły — przeprowadź impuls do DYSKU ▼</div>
<script>
const c=document.getElementById('c'),ctx=c.getContext('2d');
let nodes=[],links=[],selected=null,time=30,pts=0,lvl=1,won=false,gameOver=false;
let timerI=null;

function mkNodes(){
  nodes=[];links=[];selected=null;won=false;
  const n=3+lvl;
  // SOURCE top-center, TARGET bottom-center
  nodes.push({id:0,x:250,y:40,type:'source',label:'☁ CHMURA',conn:[],active:true});
  for(let i=1;i<n-1;i++){
    nodes.push({id:i,x:80+Math.random()*340,y:80+Math.random()*240,type:'relay',label:'◈ RELAY '+i,conn:[],active:false});
  }
  nodes.push({id:n-1,x:250,y:360,type:'target',label:'💾 DYSK',conn:[],active:false});
  time=30+lvl*5;
  document.getElementById('lvl').textContent=lvl;
  document.getElementById('tim').textContent=time;
}

function draw(){
  ctx.clearRect(0,0,500,400);
  // grid
  ctx.strokeStyle='rgba(251,191,36,0.04)';
  ctx.lineWidth=1;
  for(let x=0;x<500;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,400);ctx.stroke();}
  for(let y=0;y<400;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(500,y);ctx.stroke();}
  // links
  links.forEach(l=>{
    const a=nodes[l[0]],b=nodes[l[1]];
    const active=a.active&&b.active;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
    ctx.strokeStyle=active?'#4ade80':'rgba(251,191,36,0.3)';
    ctx.lineWidth=active?2.5:1;
    if(active){ctx.shadowBlur=10;ctx.shadowColor='#4ade80';}else{ctx.shadowBlur=0;}
    ctx.stroke();ctx.shadowBlur=0;
  });
  // selected line preview
  if(selected!==null){
    const mx=lastMouse.x,my=lastMouse.y,a=nodes[selected];
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(mx,my);
    ctx.strokeStyle='rgba(0,229,255,0.5)';ctx.lineWidth=1.5;
    ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
  }
  // nodes
  nodes.forEach(n=>{
    ctx.beginPath();ctx.arc(n.x,n.y,n.type==='source'?18:n.type==='target'?18:12,0,Math.PI*2);
    ctx.fillStyle=n.active?(n.type==='source'?'#fbbf24':n.type==='target'?'#4ade80':'#00e5ff'):'rgba(255,255,255,0.1)';
    ctx.shadowBlur=n.active?20:0;
    ctx.shadowColor=n.active?(n.type==='source'?'#fbbf24':n.type==='target'?'#4ade80':'#00e5ff'):'transparent';
    ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle=n===nodes[selected]?'#fff':'rgba(255,255,255,0.2)';
    ctx.lineWidth=n===nodes[selected]?2:1;ctx.stroke();
    ctx.fillStyle='#06080f';ctx.font='bold 9px monospace';ctx.textAlign='center';
    ctx.fillText(n.label,n.x,n.y+3);
  });
}

let lastMouse={x:0,y:0};
c.addEventListener('mousemove',e=>{const r=c.getBoundingClientRect();lastMouse={x:e.clientX-r.left,y:e.clientY-r.top};if(selected!==null)draw();});

c.addEventListener('click',e=>{
  if(won||gameOver)return;
  const r=c.getBoundingClientRect();
  const mx=e.clientX-r.left,my=e.clientY-r.top;
  const hit=nodes.find(n=>Math.hypot(n.x-mx,n.y-my)<(n.type!=='relay'?18:12)+4);
  if(!hit){selected=null;draw();return;}
  if(selected===null){selected=hit.id;draw();return;}
  if(selected===hit.id){selected=null;draw();return;}
  // add link
  const exists=links.find(l=>(l[0]===selected&&l[1]===hit.id)||(l[1]===selected&&l[0]===hit.id));
  if(!exists) links.push([selected,hit.id]);
  selected=null;
  propagate();draw();
  if(nodes[nodes.length-1].active) levelWon();
});

function propagate(){
  nodes.forEach((n,i)=>{if(i>0)n.active=false;});
  let changed=true;
  while(changed){
    changed=false;
    links.forEach(l=>{
      const a=nodes[l[0]],b=nodes[l[1]];
      if(a.active&&!b.active){b.active=true;changed=true;}
      if(b.active&&!a.active){a.active=true;changed=true;}
    });
  }
}

function levelWon(){
  won=true;clearInterval(timerI);
  pts+=lvl*100+time*10;
  document.getElementById('pts').textContent=pts;
  document.getElementById('msg').textContent='✅ IMPULS DOTARŁ! +'+( lvl*100+time*10)+' KWANTÓW';
  setTimeout(()=>{lvl++;mkNodes();startTimer();draw();document.getElementById('msg').textContent='Poziom '+lvl+' — połącz węzły!';},2000);
}

function startTimer(){
  clearInterval(timerI);
  timerI=setInterval(()=>{
    if(won)return;
    time--;document.getElementById('tim').textContent=time;
    if(time<=0){clearInterval(timerI);gameOver=true;document.getElementById('msg').textContent='⚠ CZAS MINĄŁ — odśwież aby spróbować ponownie';}
  },1000);
}

mkNodes();startTimer();draw();
setInterval(draw,100);
</script></body></html>`;

// ── Kwantowa Kość K-7 ────────────────────────────────────────────────
interface QuantumDiceProps {
    onRoll: (agent: ArcadeAgent) => void;
    disabled?: boolean;
}

const QuantumDice: React.FC<QuantumDiceProps> = ({ onRoll, disabled }) => {
    const [isRolling, setIsRolling] = useState(false);

    const roll = () => {
        if (isRolling || disabled) return;
        setIsRolling(true);

        // Web Audio API - Krótki "Spark" przy rollu
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) {}

        setTimeout(() => {
            const num = Math.floor(Math.random() * 7) + 1;
            const mapping: Record<number, string> = {
                1: 'bella',
                2: 'bob',
                3: 'adamus',
                4: 'isted',
                5: 'oddi',
                6: 'wiesio',
                7: 'jadziunia'
            };

            const agentId = mapping[num];
            const agent = ARCADE_AGENTS.find(a => a.id === agentId);

            if (agent) {
                toast.success(`🎲 Wylosowano ${num}! ${agent.name} przejmuje Kuźnię!`, {
                    icon: '🌌',
                    duration: 4000,
                    style: {
                        background: '#1a1a2e',
                        color: agent.color,
                        border: `1px solid ${agent.color}`,
                        fontWeight: 'bold'
                    }
                });
                onRoll(agent);
            }
            setIsRolling(false);
        }, 1200);
    };

    return (
        <motion.button
            style={{
                ...diceStyles.diceBtn,
                borderColor: isRolling ? '#00e5ff' : 'rgba(0, 229, 255, 0.3)',
            }}
            onClick={roll}
            disabled={isRolling || disabled}
            animate={isRolling ? {
                rotateZ: [0, 360, 720, 1080],
                rotateX: [0, 180, 360, 720],
                scale: [1, 1.15, 1],
                boxShadow: [
                    '0 0 10px rgba(0, 229, 255, 0.2)',
                    '0 0 40px rgba(0, 229, 255, 0.8)',
                    '0 0 10px rgba(0, 229, 255, 0.2)'
                ]
            } : {}}
            transition={isRolling ? { duration: 1.2, ease: "easeInOut" } : {}}
            whileHover={{ scale: 1.02, background: 'rgba(0, 229, 255, 0.15)' }}
            whileTap={{ scale: 0.98 }}
        >
            <div style={{ ...diceStyles.glow, opacity: isRolling ? 1 : 0 }} />
            <motion.span 
                style={{ fontSize: 24 }}
                animate={isRolling ? { rotate: 360 } : {}}
                transition={{ repeat: Infinity, duration: 0.3 }}
            >
                {isRolling ? '🌀' : '🔮'}
            </motion.span>
            <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: '0.1em' }}>
                    RZUĆ KOŚCIĄ PRZEZNACZENIA (K-7)
                </div>
                <div style={{ fontSize: 8, opacity: 0.5, marginTop: 2 }}>
                    LOS (ŹRÓDŁO) WYBIERZE AGENTA ZA CIEBIE
                </div>
            </div>
        </motion.button>
    );
};

const diceStyles: Record<string, React.CSSProperties> = {
    diceBtn: {
        width: '100%',
        background: 'rgba(0, 229, 255, 0.05)',
        border: '1px solid rgba(0, 229, 255, 0.2)',
        borderRadius: 14,
        padding: '16px 20px',
        color: '#00e5ff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily: "'JetBrains Mono', monospace",
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    },
    glow: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle, rgba(0, 229, 255, 0.3) 0%, transparent 70%)',
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
    },
    sparkBtn: {
        flex: 1,
        background: 'rgba(251, 191, 36, 0.05)',
        border: '1px solid rgba(251, 191, 36, 0.2)',
        borderRadius: 14,
        padding: '16px 20px',
        color: '#fbbf24',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontFamily: "'JetBrains Mono', monospace",
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    },
};

// ── Komponent Główny ──────────────────────────────────────────────────
const FabrykaGier: React.FC = () => {
    const [selectedAgent, setSelectedAgent] = useState<ArcadeAgent>(ARCADE_AGENTS[0]);
    const [customPrompt, setCustomPrompt] = useState('');
    const [games, setGames] = useState<GeneratedGame[]>([]);
    const [activeGame, setActiveGame] = useState<GeneratedGame | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [genLog, setGenLog] = useState<string[]>([]);
    const [totalKwanty, setTotalKwanty] = useState(0);
    const [activeProvider, setActiveProvider] = useState<CloudProvider>('claude');
    const [view, setView] = useState<'forge' | 'arcade' | 'playing' | 'produkty' | 'opowiesci'>('forge');

    const [existingCode, setExistingCode] = useState<string | null>(null);
    const [parentGameId, setParentGameId] = useState<string | null>(null);

    // 🎨 Studio Props
    const [importedMap, setImportedMap] = useState<any>(null);
    const [importedCharacter, setImportedCharacter] = useState<string | null>(null);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const logRef = useRef<HTMLDivElement>(null);

    const addLog = useCallback((msg: string) => {
        setGenLog(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`]);
        setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
    }, []);


    // Wbudowana gra GORGOOO przy starcie
    useEffect(() => {
        const starter: GeneratedGame = {
            id: 'builtin-bob',
            title: 'Strażnik Tunelu',
            description: 'Połącz węzły siecią i przeprowadź impuls do Dysku.',
            agent: 'FLASH BOB',
            agentEmoji: '👨‍🏭',
            agentColor: '#00e5ff',
            code: BUILTIN_GAME_GORGOOO,
            timestamp: Date.now(),
            kwanty: 500,
        };
        setGames([starter]);
        setTotalKwanty(500);
    }, []);

    const sanitizeHtmlCode = (raw: string): string => {
        // 1. Wyciągnij blok kodu HTML (```html ... ```)
        const htmlMatch = raw.match(/```html\s*([\s\S]*?)```/i);
        if (htmlMatch) return htmlMatch[1].trim();

        // 2. Fallback: dowolny blok kodu (``` ... ```)
        const genericMatch = raw.match(/```\s*([\s\S]*?)```/i);
        if (genericMatch) return genericMatch[1].trim();

        // 3. Agresywne czyszczenie: usuń znaczniki markdown jeśli model je zostawił na zewnątrz
        let clean = raw.replace(/^```html\s*/i, '').replace(/```\s*$/g, '').trim();

        // 4. Jeśli wciąż są brudy, znajdź początek struktury HTML
        if (clean.includes('<!DOCTYPE') || clean.includes('<html')) {
            const start = clean.indexOf('<!DOCTYPE') !== -1
                ? clean.indexOf('<!DOCTYPE')
                : clean.indexOf('<html');
            return clean.slice(start).trim();
        }
        return clean;
    };

    // ── Fizyczna Materializacja (Wiesław Bridge) ─────────────────────
    const materializeGame = async (gameCode: string, title: string, suffix = '') => {
        const timestamp = Date.now();
        const fileName = `Arcade/Gra_${timestamp}${suffix}.html`;
        
        addLog(`💾 Przesyłam kod gry do rury Wiesława...`);
        
        try {
            const response = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'WRITE_FILE',
                    filename: fileName,
                    content: gameCode
                })
            });

            const data = await response.json();
            if (data.success) {
                addLog(`✅ Gra została zmaterializowana fizycznie na dysku F:`);
                toast.success("🕹️ Kod Gry zmaterializowany na dysku F:!", {
                    icon: '📀',
                    style: {
                        background: 'rgba(0, 229, 255, 0.9)',
                        color: '#000',
                        fontWeight: 'bold',
                        border: '2px solid #fff'
                    }
                });
                return fileName;
            }
        } catch (e) {
            console.error("Materialization error:", e);
            addLog(`⚠ Błąd materializacji rury: Most Wiesława jest offline.`);
        }
        return null;
    };

    // ── Ewolucja Gry (READ_FILE) ───────────────────────────────────
    const evolveGame = async (game: GeneratedGame) => {
        const path = game.filename || `Arcade/Gra_${game.timestamp}.html`;
        addLog(`🧪 Inicjuję ewolucję gry: "${game.title}"...`);
        
        try {
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'READ_FILE', filename: path })
            });
            const data = await res.json();
            
            if (data.success) {
                setExistingCode(data.content);
                setParentGameId(game.id);
                setView('forge');
                addLog(`📡 Kod gry "${game.title}" wczytany do matrycy Kuźni.`);
                toast.success("DNA gry wczytane! Opisz zmiany.");
            } else {
                throw new Error("Most nie odnalazł pliku: " + path);
            }
        } catch (e: any) {
            addLog(`❌ Błąd odczytu: ${e.message}`);
            toast.error("Błąd DNA: " + e.message);
        }
    };

    const generateGame = useCallback(async (forcedAgent?: ArcadeAgent, studioPrompt?: string) => {
        if (isGenerating) return;
        const agent = forcedAgent || selectedAgent;
        
        // 🧬 ŁĄCZENIE OSOBOWOŚCI Z WIZJĄ SUWERENA (LUB STUDIA)
        const agentPersonality = agent.id === 'custom' 
            ? 'Jesteś Mistrzem Kodowania i Architektem Gier w uniwersum OtakOS.' 
            : `Jesteś ${agent.name}. ${agent.prompt}`;

        const baseInput = studioPrompt || customPrompt;
        const guidelines = baseInput.trim() 
            ? `OTO WYTYCZNE DO GRY OD SUWERENA (ISKRĄ LUB RĘCZNIE):\n${baseInput}` 
            : 'Stwórz nową, fascynującą grę na bazie swojej specjalizacji.';

        setIsGenerating(true);
        setGenLog([]);
        addLog(`🛠 Inicjuję Kuźnię... Cel: ${agent.name}`);
        addLog(`🔥 Provider: ${activeProvider.toUpperCase()}`);
        addLog(`📝 Generuję kod gry...`);

        try {
            let promptBody = `${agentPersonality}\n\n${guidelines}`;
            
            if (importedMap) promptBody += `\nMAPA (JSON): ${JSON.stringify(importedMap)}`;
            if (importedCharacter) promptBody += `\nPOSTAĆ (SVG): ${importedCharacter}`;

            if (existingCode) {
                promptBody = `Oto istniejący kod HTML gry:\n\n\`\`\`html\n${existingCode}\n\`\`\`\n\nTwoje zadanie: ${guidelines}. Zwróć zaktualizowany, kompletny kod HTML w jednym pliku.`;
                addLog(`🧬 Łączę DNA istniejącej gry z nowymi instrukcjami...`);
            }

            const fullPrompt = `${promptBody}

WYMAGANIA TECHNICZNE:
- Jeden kompletny plik HTML (CSS i JS wewnątrz)
- Używaj Canvas lub pure DOM — żadnych zewnętrznych bibliotek
- Mroczny klimat: tło #06080f, kolory neonowe, font monospace
- Responsywny na mobile (touch events)
- Gra ma być grywalna — zaimplementuj pełną logikę
- Na początku HTML dodaj komentarz: <!-- GAME: [tytuł gry] -->
- Na początku HTML dodaj komentarz: <!-- DESC: [opis jednozdaniowy] -->

Odpowiedz TYLKO kodem HTML. Żadnego tekstu przed ani po bloku kodu.`;

            const raw = await generateContent(fullPrompt, 'active', activeProvider);
            const code = sanitizeHtmlCode(raw);

            // Wyciągnij tytuł i opis z komentarzy
            const titleMatch = code.match(/<!--\s*GAME:\s*(.+?)\s*-->/i);
            const descMatch = code.match(/<!--\s*DESC:\s*(.+?)\s*-->/i);
            const title = titleMatch ? titleMatch[1] : `Gra_${new Date().toLocaleTimeString()}`;
            const description = descMatch ? descMatch[1] : `Zmaterializowano przez: ${agent.name}`;

            const kwanty = 150 + Math.floor(Math.random() * 100);
            const game: GeneratedGame = {
                id: Math.random().toString(36).substr(2, 9),
                title,
                description,
                agent: agent.name,
                agentEmoji: agent.emoji,
                agentColor: agent.color,
                code,
                timestamp: Date.now(),
                kwanty
            };

            setGames(prev => [game, ...prev]);
            setTotalKwanty(prev => prev + kwanty);
            addLog(`✅ Gra zmaterializowana: "${title}"`);
            addLog(`💰 +${kwanty} KWANTÓW dodanych do skarbca!`);

            // FIZYCZNA MATERIALIZACJA
            const fileName = await materializeGame(code, title, existingCode ? '_v2' : '');
            if (fileName) {
                game.filename = fileName;
            }

            // Reset ewolucji
            setExistingCode(null);
            setParentGameId(null);

            addLog(`🎮 Kliknij ARCADE żeby zagrać!`);

            toast.success(`Gra "${title}" zmaterializowana!`, {
                style: { background: '#1a1a2e', color: '#fff', border: `1px solid ${agent.color}` }
            });

        } catch (e: any) {
            console.error(e);
            addLog(`❌ BŁĄD MATRYCY: ${e.message}`);
            toast.error("Błąd generowania kodu.");
        } finally {
            setIsGenerating(false);
        }
    }, [selectedAgent, customPrompt, activeProvider, existingCode, addLog, materializeGame, sanitizeHtmlCode, importedMap, importedCharacter]);

    // 🎨 Studio Actions
    const forgeStudioGame = (data: { theme: string; genre: string }) => {
        const studioPrompt = `STWÓRZ GRĘ NA BAZIE STUDIO DESIGN:\nGatunek: ${data.genre}\nTemat: ${data.theme}`;
        setCustomPrompt(studioPrompt);
        generateGame(undefined, studioPrompt);
    };

    const rollIdeaDice = () => {
        const randomGenre = IDEA_GENRES[Math.floor(Math.random() * IDEA_GENRES.length)];
        const randomTheme = IDEA_THEMES[Math.floor(Math.random() * IDEA_THEMES.length)];
        
        const newIdea = `Gatunek: ${randomGenre}\nTemat: ${randomTheme}`;
        setCustomPrompt(newIdea);
        setSelectedAgent(ARCADE_AGENTS.find(a => a.id === 'custom') || ARCADE_AGENTS[0]);
        
        toast('✨ Iskra Źródła rozbłysła! Mamy nowy pomysł!', {
            icon: '💡',
            style: {
                background: '#1a1a2e',
                color: '#fbbf24',
                border: '1px solid #fbbf24',
                fontWeight: 'bold',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px'
            }
        });
    };

    // 📡 Nasłuchiwanie komend agentów
    useEffect(() => {
        const arcadeBc = new BroadcastChannel('katedra_arcade');
        arcadeBc.onmessage = (e) => {
            const d = e.data;
            if (d.type === 'AGENT_FORGE') {
                const agent = ARCADE_AGENTS.find(a => a.name === d.agentName) || ARCADE_AGENTS[0];
                setSelectedAgent(agent);
                setCustomPrompt(d.theme || '');
                if (d.provider) setActiveProvider(d.provider as CloudProvider);

                setTimeout(() => generateGame(), 500);
            }
        };
        return () => arcadeBc.close();
    }, [generateGame]);

    const playGame = (game: GeneratedGame) => {
        setActiveGame(game);
        setView('playing');
    };

    const providers: { id: CloudProvider; label: string; emoji: string }[] = [
        { id: 'claude',  label: 'Claude',  emoji: '🧠' },
        { id: 'gemini',  label: 'Gemini',  emoji: '🔮' },
        { id: 'groq',    label: 'Groq',    emoji: '⚡' },
        { id: 'local',   label: 'LOCAL (Ollama)', emoji: '🏠' },
    ];

    return (
        <div style={styles.root}>
            {/* ── Header ── */}
            <div style={styles.header}>
                <div>
                    <div style={styles.eyebrow}>⚗ KATEDRA OTAKOS</div>
                    <div style={styles.title}>🕹️ TEO ARCADE</div>
                    <div style={styles.subtitle}>Kuźnia Gier — Agenci tworzą, Ty grasz</div>
                </div>
                <div style={styles.kwantyBadge}>
                    <div style={styles.kwantyIcon}>⚡</div>
                    <div>
                        <div style={styles.kwantyVal}>{totalKwanty.toLocaleString()}</div>
                        <div style={styles.kwantyLabel}>KWANTÓW</div>
                    </div>
                </div>
            </div>

            {/* ── Nav ── */}
            <div style={styles.nav}>
                {(['forge', 'arcade', 'produkty', 'opowiesci'] as const).map(v => (
                    <button
                        key={v}
                        style={{ ...styles.navBtn, ...(view === v || (v === 'arcade' && view === 'playing') ? styles.navBtnActive : {}) }}
                        onClick={() => setView(v)}
                    >
                        {v === 'forge' ? '🔥 KUŹNIA' : v === 'arcade' ? `🎮 ARCADE (${games.length})` : v === 'produkty' ? '📦 PRODUKTY' : '📖 OPOWIEŚCI'}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">

                {/* ── KUŹNIA ── (Integrated Studio Frame) */}
                {view === 'forge' && (
                    <motion.div key="forge"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        style={styles.panel}
                    >
                        <QuantumStudioFrame 
                            onInitiateForge={forgeStudioGame}
                        />

                        {/* Konsola Logów (Poniżej Studio) */}
                        <div style={styles.sectionTitle}>⛓ LOGI KUŹNI (REAL-TIME-POD)</div>
                        <div style={styles.log} ref={logRef}>
                            {genLog.map((l, i) => (
                                <div key={i} style={styles.logLine}>{l}</div>
                            ))}
                            {isGenerating && <div style={{...styles.logLine, color: '#fbbf24', opacity: 0.8}}>⏳ AGENT WYKOŃCZA DETALE...</div>}
                        </div>

                        {/* 🎲 Dual Dice Row (Przeniesione poniżej) */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                            <div style={{ flex: '1 1 200px' }}>
                                <QuantumDice 
                                    onRoll={(agent) => {
                                        setSelectedAgent(agent);
                                        setTimeout(() => generateGame(agent), 2000);
                                    }}
                                    disabled={isGenerating}
                                />
                            </div>

                            <motion.button
                                style={{ ...diceStyles.sparkBtn, flex: '1 1 200px', padding: '12px 20px' }}
                                onClick={rollIdeaDice}
                                disabled={isGenerating}
                                whileHover={{ scale: 1.02, background: 'rgba(251, 191, 36, 0.15)' }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <motion.span 
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 4 }}
                                    style={{ fontSize: 20 }}
                                >✨</motion.span>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: 10, fontWeight: 'bold' }}>ISKRA ŹRÓDŁA</div>
                                    <div style={{ fontSize: 8, opacity: 0.5 }}>POMYSŁ Z PUŁAPU 0.00G</div>
                                </div>
                            </motion.button>
                        </div>
                        <div style={styles.sectionTitle}>🔌 PROVIDER AI</div>
                        <div style={styles.providerRow}>
                            {providers.map(p => (
                                <button
                                    key={p.id}
                                    style={{
                                        ...styles.providerBtn,
                                        ...(activeProvider === p.id ? styles.providerBtnActive : {}),
                                    }}
                                    onClick={() => setActiveProvider(p.id)}
                                >
                                    {p.emoji} {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Generate button */}
                        <motion.button
                            style={{
                                ...styles.forgeBtn,
                                opacity: isGenerating ? 0.7 : 1,
                            }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => generateGame()}
                            disabled={isGenerating}
                        >
                            {isGenerating
                                ? <><span style={styles.spinner}>⟳</span> KUŹNIA W OGNIU...</>
                                : <><span>🔥</span> INICJUJ MATERIALIZACJĘ</>
                            }
                        </motion.button>

                        {/* Log */}
                        {genLog.length > 0 && (
                            <div style={styles.log} ref={logRef}>
                                {genLog.map((l, i) => (
                                    <div key={i} style={styles.logLine}>{l}</div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ── FABRYKA OPOWIEŚCI (Storyteller) ── */}
                {view === 'opowiesci' && (
                    <motion.div key="opowiesci"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        style={styles.panel}
                    >
                        <StorytellerFrame />
                    </motion.div>
                )}

                {/* ── FABRYKA PRODUKTÓW (Mockup Gen) ── */}
                {view === 'produkty' && (
                    <motion.div key="produkty"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        style={styles.panel}
                    >
                        <MockupGenFrame />
                    </motion.div>
                )}

                {/* ── ARCADE (lista gier) ── */}
                {view === 'arcade' && (
                    <motion.div key="arcade"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        style={styles.panel}
                    >
                        <div style={styles.sectionTitle}>🎮 BIBLIOTEKA GIER ({games.length})</div>
                        {games.length === 0 && (
                            <div style={styles.empty}>
                                Brak gier — wejdź do Kuźni i zmaterializuj pierwszą!
                            </div>
                        )}
                        <div style={styles.gameGrid}>
                            {games.map(g => (
                                    <motion.div
                                        key={g.id}
                                        style={styles.gameCard}
                                        whileHover={{ scale: 1.015, borderColor: g.agentColor }}
                                    >
                                        <div style={styles.gameCardHeader}>
                                            <span style={{ fontSize: 24 }}>{g.agentEmoji}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ ...styles.gameTitle, color: g.agentColor }}>
                                                    {g.title}
                                                </div>
                                                <div style={styles.gameAgent}>by {g.agent}</div>
                                            </div>
                                            <div style={{ ...styles.gameKwanty, color: g.agentColor }}>
                                                ⚡{g.kwanty}
                                            </div>
                                        </div>
                                        <div style={styles.gameDesc}>{g.description}</div>
                                        
                                        <div style={styles.gameCardActions}>
                                            <motion.button
                                                whileHover={{ scale: 1.05, background: 'rgba(34, 197, 94, 0.25)' }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => evolveGame(g)}
                                                style={{ ...styles.actionBtn, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', borderColor: 'rgba(34, 197, 94, 0.3)' }}
                                            >
                                                🌱 EWOLUUJ
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.05, background: 'rgba(251, 191, 36, 0.25)' }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => playGame(g)}
                                                style={{ ...styles.actionBtn, background: 'rgba(251, 191, 36, 0.15)' }}
                                            >
                                                🕹️ ZAGRAJ
                                            </motion.button>
                                        </div>
                                    </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── PLAYING ── */}
                {view === 'playing' && activeGame && (
                    <motion.div key="playing"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        style={styles.playingContainer}
                    >
                        <div style={styles.playingHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 20 }}>{activeGame.agentEmoji}</span>
                                <div>
                                    <div style={{ ...styles.gameTitle, color: activeGame.agentColor }}>
                                        {activeGame.title}
                                    </div>
                                    <div style={styles.gameAgent}>by {activeGame.agent} · ⚡{activeGame.kwanty} KWANTÓW</div>
                                </div>
                            </div>
                            <button style={styles.backBtn} onClick={() => setView('arcade')}>
                                ← WRÓĆ
                            </button>
                        </div>
                        <iframe
                            ref={iframeRef}
                            style={styles.iframe}
                            srcDoc={activeGame.code}
                            sandbox="allow-scripts"
                            title={activeGame.title}
                        />
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
};

// ── Style ─────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(160deg, rgba(10,8,18,0.99), rgba(6,8,15,1))',
        borderRadius: 16,
        border: '1px solid rgba(201,149,58,0.2)',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        maxWidth: 680, margin: '0 auto',
        boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
    },
    header: {
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '20px 24px 16px',
        background: 'rgba(201,149,58,0.06)',
        borderBottom: '1px solid rgba(201,149,58,0.1)',
    },
    eyebrow: { fontSize: 9, letterSpacing: '0.35em', color: 'rgba(201,149,58,0.5)', marginBottom: 4 },
    title: {
        fontSize: 22, fontWeight: 700, letterSpacing: '0.05em',
        color: '#f0c060',
        textShadow: '0 0 30px rgba(201,149,58,0.4)',
    },
    subtitle: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, letterSpacing: '0.1em' },
    kwantyBadge: {
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: 10, padding: '8px 14px',
    },
    kwantyIcon: { fontSize: 22 },
    kwantyVal: { fontSize: 18, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.05em' },
    kwantyLabel: { fontSize: 8, letterSpacing: '0.3em', color: 'rgba(251,191,36,0.5)' },
    nav: {
        display: 'flex', gap: 0,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    navBtn: {
        flex: 1, padding: '10px 0',
        background: 'none', border: 'none',
        color: 'rgba(255,255,255,0.3)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, letterSpacing: '0.15em',
        cursor: 'pointer',
        borderBottom: '2px solid transparent',
        transition: 'all 0.2s',
    },
    navBtnActive: {
        color: '#f0c060',
        borderBottomColor: '#c9953a',
        background: 'rgba(201,149,58,0.05)',
    },
    panel: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
    sectionTitle: {
        fontSize: 9, letterSpacing: '0.3em',
        color: 'rgba(201,149,58,0.6)',
        paddingBottom: 8,
        borderBottom: '1px solid rgba(201,149,58,0.08)',
    },
    agentGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
    },
    agentCard: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, padding: '12px 8px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        transition: 'all 0.2s',
    },
    agentName: {
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.6)',
    },
    agentSpec: { fontSize: 8, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 1.4 },
    textarea: {
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(201,149,58,0.2)',
        borderRadius: 8, padding: '10px 12px',
        color: '#e8dfc8',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12, resize: 'vertical',
        outline: 'none', lineHeight: 1.6,
    },
    providerRow: { display: 'flex', gap: 8 },
    providerBtn: {
        flex: 1, padding: '8px 0',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, cursor: 'pointer',
        color: 'rgba(255,255,255,0.4)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, letterSpacing: '0.05em',
        transition: 'all 0.2s',
    },
    providerBtnActive: {
        background: 'rgba(201,149,58,0.12)',
        borderColor: 'rgba(201,149,58,0.4)',
        color: '#f0c060',
    },
    forgeBtn: {
        width: '100%', padding: '14px',
        background: 'linear-gradient(135deg, #7a5a1a, #c9953a)',
        border: 'none', borderRadius: 10,
        color: '#1a1208',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13, fontWeight: 700, letterSpacing: '0.15em',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        boxShadow: '0 0 30px rgba(201,149,58,0.25)',
    },
    spinner: {
        display: 'inline-block',
        animation: 'spin 1s linear infinite',
    },
    log: {
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 8, padding: '10px 12px',
        maxHeight: 160, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 3,
    },
    logLine: {
        fontSize: 10, color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.05em', fontFamily: "'JetBrains Mono', monospace",
    },
    empty: {
        textAlign: 'center', padding: '40px 20px',
        fontSize: 12, color: 'rgba(255,255,255,0.2)',
        letterSpacing: '0.1em',
    },
    gameGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
    gameCard: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex', flexDirection: 'column', gap: 6,
    },
    gameCardHeader: { display: 'flex', alignItems: 'center', gap: 12 },
    gameTitle: { fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' },
    gameAgent: { fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' },
    gameKwanty: { fontSize: 12, fontWeight: 700, letterSpacing: '0.05em' },
    gameDesc: { fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 },
    playHint: {
        fontSize: 9, letterSpacing: '0.2em',
        color: 'rgba(201,149,58,0.5)',
        alignSelf: 'flex-end',
    },
    playingContainer: {
        display: 'flex', flexDirection: 'column',
        height: 600,
    },
    playingHeader: {
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(0,0,0,0.3)',
    },
    backBtn: {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, padding: '6px 14px',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, cursor: 'pointer',
        letterSpacing: '0.1em',
    },
    iframe: {
        flex: 1, border: 'none',
        background: '#06080f',
    },
};

export default FabrykaGier;
