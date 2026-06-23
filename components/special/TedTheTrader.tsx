/**
 * 💰 TedTheTrader v3.5 — Sala Treningowa
 * + Symulator operacji krypto (wirtualny portfel, skill, odblokowanie rynku)
 * + Naprawa skanu (clear feedback, stale-closure fix)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getWalletPortfolio, WalletAsset } from '../../services/walletPortfolioService';

// ── CONFIG ────────────────────────────────────────────────────────
const TED_CONFIG = {
    initialBalance:   100,
    dailyRiskLimit:   0.10,
    goldenPauseHours: 8,
    grvCostPerQuery:  500,
    maxPositionSize:  0.25,
    simBalance:       1000,   // wirtualny kapitał symulatora
};

const STRATEGIES = [
    { id:'hodl',     name:'ZŁOTY HODL',   icon:'🏛', color:'#c9953a', desc:'Trzymaj co silne. Bitcoin, Ethereum — fundamenty.', riskLevel:1 },
    { id:'dca',      name:'KWANTOWY DCA', icon:'⚖',  color:'#4ade80', desc:'Regularny zakup — uśrednianie przez czas.',         riskLevel:1 },
    { id:'momentum', name:'IMPULS 0.00G', icon:'⚡', color:'#00e5ff', desc:'Podążaj za energią. Wchódź w trend.',               riskLevel:3 },
    { id:'pause',    name:'ZŁOTA PAUZA',  icon:'✦',  color:'#f0c060', desc:'Nic nie rób. Rzadsza i cenniejsza niż akcja.',      riskLevel:0 },
];

const SKILL_LEVELS = [
    { min:0,  max:20,  title:'Nowicjusz',          icon:'🌱', color:'#6b7280' },
    { min:21, max:40,  title:'Adept Rynku',         icon:'📊', color:'#4ade80' },
    { min:41, max:60,  title:'Trader',              icon:'⚡', color:'#00e5ff' },
    { min:61, max:80,  title:'Mistrz Alchemii',     icon:'🏛', color:'#c9953a' },
    { min:81, max:100, title:'Kwantowy Operator',   icon:'🌟', color:'#f0c060' },
];

// ── INTERFACES ────────────────────────────────────────────────────
interface MarketAsset {
    id: string; symbol: string; name: string;
    current_price: number; price_change_percentage_24h: number;
    market_cap: number; image: string; total_volume: number;
}
interface ChartPoint { time: string; price: number; }
interface TradeRecord {
    id: string; timestamp: number; asset: string; symbol: string;
    action: 'BUY'|'SELL'; amount: number; price: number;
    profitLoss: number; strategy: string; aura: 'gold'|'red'; note: string;
}
interface TedState {
    balance: number; dailyRiskUsed: number; totalProfit: number;
    grvBalance: number; activeStrategy: string; isScanning: boolean;
    isPaused: boolean; pauseReason: string; teoWord: string;
    sessionStart: number; tradesCount: number; winRate: number;
}
interface AcademyAgent { name: string; track: string; intensity: string; instructions: string; deployedAt: number; }
interface SimPosition {
    id: string; assetId: string; symbol: string; name: string;
    investedEur: number; quantity: number; buyPrice: number; openedAt: number;
}
interface SimClosedTrade extends SimPosition {
    sellPrice: number; closedAt: number; profitLoss: number; profitPct: number;
}

// ── HELPERS ───────────────────────────────────────────────────────
const POSITIVE_WORDS = ['wolność','miłość','kreacja','wzrost','harmonia','pokój','radość','obfitość','światło'];
const NEGATIVE_WORDS = ['strach','chciwość','panika','manipulacja','oszustwo','scam','rug','mrok'];
function analyzeVibration(word: string) {
    if (!word) return { positive:true, score:0.5, label:'NEUTRALNA' };
    const w = word.toLowerCase();
    let score = 0.5;
    if (POSITIVE_WORDS.some(p=>w.includes(p))) score += 0.3;
    if (NEGATIVE_WORDS.some(n=>w.includes(n))) score -= 0.4;
    score = Math.max(0, Math.min(1, score));
    return { positive:score>0.3, score, label:score>0.7?'WYSOKA ✦':score>0.4?'NEUTRALNA':'NISKA ⚠' };
}

function getSkillLevel(skill: number) {
    return SKILL_LEVELS.find(l=>skill>=l.min&&skill<=l.max) || SKILL_LEVELS[0];
}

const CustomTooltip = ({ active, payload }: any) => {
    if (!active||!payload?.length) return null;
    return (
        <div style={{ background:'rgba(10,8,18,.97)', border:'1px solid rgba(201,149,58,.4)', borderRadius:6, padding:'5px 10px', fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#f0c060' }}>
            {Number(payload[0].value).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})} €
        </div>
    );
};

// ── DARK DROPDOWN ─────────────────────────────────────────────────
const DarkDropdown: React.FC<{ value:string; options:{value:string;label:string}[]; onChange:(v:string)=>void; placeholder?:string }> = ({ value, options, onChange, placeholder }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = options.find(o=>o.value===value);
    useEffect(() => {
        const h = (e:MouseEvent) => { if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    return (
        <div ref={ref} style={{position:'relative',flex:1}}>
            <button onClick={()=>setOpen(o=>!o)} style={{ width:'100%', padding:'7px 12px', background:'rgba(255,255,255,.04)', border:`1px solid ${open?'rgba(201,149,58,.5)':'rgba(255,255,255,.1)'}`, borderRadius:6, color:selected?'#e8dfc8':'rgba(255,255,255,.3)', fontFamily:"'JetBrains Mono',monospace", fontSize:11, cursor:'pointer', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'border-color .2s' }}>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selected?selected.label:(placeholder||'— wybierz —')}</span>
                <span style={{color:'rgba(201,149,58,.5)',fontSize:9,marginLeft:6,flexShrink:0}}>{open?'▲':'▼'}</span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                        style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:200, background:'rgba(12,10,20,.98)', border:'1px solid rgba(201,149,58,.25)', borderRadius:8, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,.7)' }}>
                        {options.map(opt=>(
                            <div key={opt.value} onClick={()=>{onChange(opt.value);setOpen(false);}}
                                onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,.05)')}
                                onMouseLeave={e=>(e.currentTarget.style.background=opt.value===value?'rgba(201,149,58,.1)':'transparent')}
                                style={{ padding:'9px 14px', cursor:'pointer', fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:opt.value===value?'#f0c060':'rgba(232,223,200,.75)', background:opt.value===value?'rgba(201,149,58,.1)':'transparent', borderLeft:opt.value===value?'2px solid #c9953a':'2px solid transparent', transition:'all .1s' }}>
                                {opt.label}
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── GŁÓWNY KOMPONENT ──────────────────────────────────────────────
export const TedTheTrader: React.FC = () => {
    const [state, setState] = useState<TedState>({
        balance:100, dailyRiskUsed:0, totalProfit:0, grvBalance:8_000_000_000,
        activeStrategy:'hodl', isScanning:false, isPaused:false, pauseReason:'',
        teoWord:'wolność', sessionStart:Date.now(), tradesCount:0, winRate:0,
    });
    const [market, setMarket]               = useState<MarketAsset[]>([]);
    const [trades, setTrades]               = useState<TradeRecord[]>([]);
    const [showAlchemy, setShowAlchemy]     = useState(false);
    const [activeTab, setActiveTab]         = useState<'scanner'|'simulator'|'trades'|'report'>('scanner');
    const [recommendation, setRec]         = useState('');
    const [recAura, setRecAura]             = useState<'gold'|'cyan'|'red'|'gray'>('gray');
    const [marketError, setMarketError]     = useState('');
    const [marketLoading, setMarketLoading] = useState(false);
    const [scanFlash, setScanFlash]         = useState(false);
    const [scanStatus, setScanStatus]       = useState('');

    const [selectedAsset, setSelectedAsset] = useState<MarketAsset|null>(null);
    const [chartData, setChartData]         = useState<ChartPoint[]>([]);
    const [chartLoading, setChartLoading]   = useState(false);
    const [chartColor, setChartColor]       = useState('#c9953a');

    const [academyRoster, setAcademyRoster]         = useState<AcademyAgent[]>([]);
    const [selectedAnalystId, setSelectedAnalystId] = useState('none');
    const [aiAnalysis, setAiAnalysis]               = useState('');
    const [aiLoading, setAiLoading]                 = useState(false);

    // Symulator state
    const [simBalance, setSimBalance]         = useState(TED_CONFIG.simBalance);
    const [simPositions, setSimPositions]     = useState<SimPosition[]>([]);
    const [simClosed, setSimClosed]           = useState<SimClosedTrade[]>([]);
    const [simSkill, setSimSkill]             = useState(0);
    const [simBuyAmount, setSimBuyAmount]     = useState('100');
    const [simBuyAsset, setSimBuyAsset]       = useState('none');
    const [simToast, setSimToast]             = useState('');

    const aiAbortRef  = useRef<AbortController|null>(null);
    const stateRef    = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    // Realny portfel (MetaMask/Ledger) — Ted radzi na bazie tego, co realnie trzymasz.
    const realAssetsRef = useRef<WalletAsset[]>([]);
    const [realAssets, setRealAssets] = useState<WalletAsset[]>([]);
    useEffect(() => { getWalletPortfolio().then(p => { if (p) { realAssetsRef.current = p.assets; setRealAssets(p.assets); } }); }, []);

    // ── Persist ───────────────────────────────────────────────────
    useEffect(() => {
        const s  = localStorage.getItem('ted_state_v2');
        const t  = localStorage.getItem('ted_trades_v2');
        const sm = localStorage.getItem('ted_sim_v1');
        const r  = localStorage.getItem('academy_roster');
        if (s)  { try { const p=JSON.parse(s); setState(x=>({...x,...p,isScanning:false})); } catch {} }
        if (t)  { try { setTrades(JSON.parse(t)); } catch {} }
        if (sm) { try { const p=JSON.parse(sm); setSimBalance(p.balance??TED_CONFIG.simBalance); setSimPositions(p.positions??[]); setSimClosed(p.closed??[]); setSimSkill(p.skill??0); } catch {} }
        if (r)  { try { setAcademyRoster(JSON.parse(r)); } catch {} }
        const onSt = (e:StorageEvent) => {
            if (e.key==='academy_roster'&&e.newValue) { try { setAcademyRoster(JSON.parse(e.newValue)); } catch {} }
        };
        window.addEventListener('storage', onSt);
        return () => window.removeEventListener('storage', onSt);
    }, []);

    useEffect(() => { localStorage.setItem('ted_state_v2', JSON.stringify(state)); }, [state]);
    useEffect(() => { localStorage.setItem('ted_trades_v2', JSON.stringify(trades.slice(0,50))); }, [trades]);
    useEffect(() => {
        localStorage.setItem('ted_sim_v1', JSON.stringify({ balance:simBalance, positions:simPositions, closed:simClosed, skill:simSkill }));
    }, [simBalance, simPositions, simClosed, simSkill]);

    const fEUR = (n:number) => n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
    const fGRV = (n:number) => n>=1e9?(n/1e9).toFixed(2)+' Mld':n>=1e6?(n/1e6).toFixed(0)+' Mln':n.toLocaleString();
    const fPct = (n:number) => (n>=0?'+':'')+n.toFixed(2)+'%';

    // ── Load market (silent, no GRV) ─────────────────────────────
    const loadMarketSilent = useCallback(async () => {
        setMarketLoading(true); setMarketError('');
        try {
            const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=12&page=1&sparkline=false&price_change_percentage=24h');
            if (!res.ok) throw new Error();
            const data:MarketAsset[] = await res.json();
            setMarket(data);
            const btc = data.find(a=>a.id==='bitcoin')||data[0];
            if (btc) { setSelectedAsset(btc); fetchChartData(btc); }
            setScanStatus(`Dane zaktualizowane ${new Date().toLocaleTimeString('pl-PL')}`);
        } catch {
            setMarketError('CoinGecko niedostępny — dane offline');
            const demo:MarketAsset[] = [
                {id:'bitcoin', symbol:'BTC', name:'Bitcoin',  current_price:58000, price_change_percentage_24h:2.3,  market_cap:1140e9, image:'', total_volume:28e9},
                {id:'ethereum',symbol:'ETH', name:'Ethereum', current_price:2800,  price_change_percentage_24h:-1.2, market_cap:336e9,  image:'', total_volume:12e9},
                {id:'solana',  symbol:'SOL', name:'Solana',   current_price:145,   price_change_percentage_24h:4.1,  market_cap:65e9,   image:'', total_volume:3e9 },
                {id:'cardano', symbol:'ADA', name:'Cardano',  current_price:0.42,  price_change_percentage_24h:-0.8, market_cap:15e9,   image:'', total_volume:0.4e9},
                {id:'binancecoin',symbol:'BNB',name:'BNB',    current_price:380,   price_change_percentage_24h:0.5,  market_cap:58e9,   image:'', total_volume:1.5e9},
            ];
            setMarket(demo); setSelectedAsset(demo[0]); fetchChartData(demo[0]);
        } finally { setMarketLoading(false); }
    }, []); // eslint-disable-line

    useEffect(() => { loadMarketSilent(); }, []); // eslint-disable-line

    // ── Wykres 24h ────────────────────────────────────────────────
    const fetchChartData = useCallback(async (asset:MarketAsset) => {
        setChartLoading(true); setChartData([]);
        try {
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/${asset.id}/market_chart?vs_currency=eur&days=1`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            const pts:ChartPoint[] = (data.prices as [number,number][]).map(([ts,p])=>({
                time: new Date(ts).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}),
                price: Math.round(p*100)/100,
            }));
            setChartData(pts);
            if (pts.length>=2) setChartColor(pts[pts.length-1].price>=pts[0].price?'#4ade80':'#f87171');
        } catch {
            const b=asset.current_price, tr=asset.price_change_percentage_24h>0?1:-1;
            const mock:ChartPoint[] = Array.from({length:48},(_,i)=>({
                time:`${String(Math.floor(i/2)).padStart(2,'0')}:${i%2===0?'00':'30'}`,
                price:Math.round((b*(1-tr*0.03+tr*(i/48)*0.04+Math.sin(i*0.5)*0.009))*100)/100,
            }));
            setChartData(mock);
            setChartColor(asset.price_change_percentage_24h>=0?'#4ade80':'#f87171');
        } finally { setChartLoading(false); }
    }, []);

    const handleAssetSelect = useCallback((asset:MarketAsset) => {
        setSelectedAsset(asset); fetchChartData(asset);
    }, [fetchChartData]);

    // ── Złota Pauza ───────────────────────────────────────────────
    const checkGoldenPause = useCallback((s:TedState) => {
        if (s.dailyRiskUsed>=TED_CONFIG.dailyRiskLimit*s.balance)
            return {pause:true,reason:`Dzienny limit ryzyka osiągnięty (${(TED_CONFIG.dailyRiskLimit*100).toFixed(0)}%)`};
        const h=(Date.now()-s.sessionStart)/3600000;
        if (h>TED_CONFIG.goldenPauseHours) return {pause:true,reason:`Sesja ${h.toFixed(1)}h — Złota Pauza`};
        if (!analyzeVibration(s.teoWord).positive) return {pause:true,reason:'TeO Słowo emituje niską wibrację'};
        if (s.tradesCount>10) return {pause:true,reason:`${s.tradesCount} transakcji — potrzeba oddechu`};
        return {pause:false,reason:''};
    },[]);

    // ── AI Analyst streaming ──────────────────────────────────────
    const runAiAnalyst = useCallback(async (data:MarketAsset[], s:TedState) => {
        const analyst = academyRoster.find(a=>a.name===selectedAnalystId);
        if (!analyst) return;
        if (aiAbortRef.current) aiAbortRef.current.abort();
        const ctrl = new AbortController(); aiAbortRef.current=ctrl;
        setAiLoading(true); setAiAnalysis('');
        const model = localStorage.getItem('otakos_active_model')||'gemma3:4b';
        const top5 = data.slice(0,5).map(a=>`${a.name} (${a.symbol.toUpperCase()}): ${a.current_price.toFixed(2)} EUR | 24h: ${fPct(a.price_change_percentage_24h)}`).join('\n');
        const stName = STRATEGIES.find(st=>st.id===s.activeStrategy)?.name||'ZŁOTY HODL';
        const holds = realAssetsRef.current;
        const holdStr = holds.length ? holds.map(a=>`${a.symbol}: ${a.balance.toFixed(4)} (${a.value.toLocaleString('pl-PL')} EUR)`).join(', ') : '';
        const prompt = `Jesteś ${analyst.name} — ekspertem finansowym z Inkubatora OtakOS${analyst.track?` (${analyst.track})`:''}.\n${analyst.instructions?`Wiedza z treningu: ${analyst.instructions}\n\n`:''}`+
            `Dane rynkowe (EUR):\n${top5}\n\n${holdStr?`Twoje REALNE zasoby (portfel Suwerena): ${holdStr}\nUwzględnij je w radzie.\n\n`:''}Strategia: ${stName}\nIntencja: ${s.teoWord}\n\n`+
            `Daj krótką rekomendację (3-4 zdania) który aktyw wybrać i dlaczego. Zakończ jednym słowem: KUPUJ, SPRZEDAJ lub OBSERWUJ.`;
        try {
            const res = await fetch('http://127.0.0.1:3001/api/ollama',{
                method:'POST',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({model,prompt,stream:true}), signal:ctrl.signal,
            });
            if (!res.ok) throw new Error('offline');
            const reader=res.body!.getReader(); const dec=new TextDecoder(); let full='';
            while(true) {
                const {done,value}=await reader.read(); if(done) break;
                for (const line of dec.decode(value).split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const p=JSON.parse(line.slice(6).trim());
                        if (p.type==='text'&&p.text) { full+=p.text; setAiAnalysis(full); }
                        else if (p.type==='done') { setAiLoading(false); return; }
                    } catch {}
                }
            }
        } catch(e:any) {
            if (e.name!=='AbortError') setAiAnalysis(`[${analyst.name} niedostępny — Wiesław offline lub model nie załadowany]`);
        } finally { setAiLoading(false); }
    }, [academyRoster, selectedAnalystId]);

    // ── Skan rynku (z GRV, pełna analiza) ───────────────────────
    const scanMarket = useCallback(async () => {
        const cur = stateRef.current;
        const pauseCheck = checkGoldenPause(cur);
        if (pauseCheck.pause) {
            setState(s=>({...s,isPaused:true,pauseReason:pauseCheck.reason}));
            setRec(`✦ ZŁOTA PAUZA: ${pauseCheck.reason}`); setRecAura('gold'); return;
        }
        if (cur.grvBalance<TED_CONFIG.grvCostPerQuery) {
            setRec('⚠ Za mało GRV!'); setRecAura('red'); return;
        }
        setState(s=>({...s,isScanning:true,grvBalance:s.grvBalance-TED_CONFIG.grvCostPerQuery}));
        setMarketError(''); setAiAnalysis(''); setScanStatus('⟳ Skanowanie...');
        let data:MarketAsset[] = market.length>0?market:[];
        let success = false;
        try {
            const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=12&page=1&sparkline=false&price_change_percentage=24h');
            if (!res.ok) throw new Error();
            data = await res.json(); setMarket(data); success=true;
        } catch { setMarketError('CoinGecko niedostępny — ostatnie dane'); }

        buildRecommendation(data, cur);
        setState(s=>({...s,isScanning:false}));
        setScanFlash(true); setTimeout(()=>setScanFlash(false),1200);
        setScanStatus(success
            ? `✅ Skan ${new Date().toLocaleTimeString('pl-PL')} — ${data.length} aktywów`
            : `⚠ Skan ${new Date().toLocaleTimeString('pl-PL')} — dane offline`);

        if (selectedAnalystId!=='none') await runAiAnalyst(data, cur);
    }, [market, checkGoldenPause, selectedAnalystId, runAiAnalyst]);

    const buildRecommendation = useCallback((data:MarketAsset[], s:TedState) => {
        const st=STRATEGIES.find(x=>x.id===s.activeStrategy)||STRATEGIES[0];
        const vib=analyzeVibration(s.teoWord);
        if (st.id==='pause') { setRec('✦ Złota Pauza. Obserwuj.'); setRecAura('gold'); return; }
        if (!vib.positive) { setRec('⚠ Wibracja niska. Ted wstrzymuje się.'); setRecAura('red'); return; }
        const sorted=[...data].sort((a,b)=>st.id==='momentum'?b.price_change_percentage_24h-a.price_change_percentage_24h:b.market_cap-a.market_cap);
        const best=sorted[0]; if(!best) return;
        const change=best.price_change_percentage_24h;
        const amt=Math.min(s.balance*TED_CONFIG.maxPositionSize, TED_CONFIG.dailyRiskLimit*s.balance-s.dailyRiskUsed, s.balance*0.05);
        if (amt<1) { setRec('✦ Limit ryzyka dzienny osiągnięty.'); setRecAura('gold'); return; }
        const action=change>3?'ROZWAŻ ZAKUP':change<-5?'ROZWAŻ SPRZEDAŻ':'OBSERWUJ';
        setRec(`${change>3?'↗':change<-5?'↘':'→'} ${st.name}: ${action} ${best.name} (${best.symbol.toUpperCase()}) @ ${fEUR(best.current_price)} | 24h: ${fPct(change)} | Sugerowane: ${fEUR(amt)}`);
        setRecAura(change>3?'cyan':change<-5?'red':'gold');
    }, []);

    // ── Transakcja realna ─────────────────────────────────────────
    const executeTrade = useCallback((asset:MarketAsset, action:'BUY'|'SELL') => {
        const cur=stateRef.current;
        const pc=checkGoldenPause(cur);
        if (pc.pause||cur.isPaused) { setRec(`✦ PAUZA: ${pc.reason||cur.pauseReason}`); return; }
        const amount=Math.min(cur.balance*0.05, TED_CONFIG.dailyRiskLimit*cur.balance-cur.dailyRiskUsed);
        if (amount<0.5) { setRec('⚠ Limit dzienny wyczerpany.'); setRecAura('red'); return; }
        const luck=Math.random()*0.16-0.06;
        const profitLoss=action==='BUY'?amount*luck:-amount*Math.abs(luck)*0.5;
        const isProfit=profitLoss>0;
        const trade:TradeRecord={
            id:crypto.randomUUID(),timestamp:Date.now(),asset:asset.name,symbol:asset.symbol.toUpperCase(),
            action,amount,price:asset.current_price,profitLoss,strategy:cur.activeStrategy,
            aura:isProfit?'gold':'red',
            note:isProfit?`Alchemia! +${fEUR(profitLoss)} zmaterializowane.`:`Rozproszenie: ${fEUR(profitLoss)} wraca do źródła.`,
        };
        setState(s=>({...s,balance:s.balance+profitLoss,dailyRiskUsed:s.dailyRiskUsed+amount,totalProfit:s.totalProfit+profitLoss,tradesCount:s.tradesCount+1,winRate:(s.winRate*s.tradesCount+(isProfit?1:0))/(s.tradesCount+1)}));
        setTrades(p=>[trade,...p]);
        if (isProfit) { setShowAlchemy(true); setTimeout(()=>setShowAlchemy(false),3000); }
        saveToBridge(trade);
    }, [checkGoldenPause]);

    const resumeFromPause = () => {
        setState(s=>({...s,isPaused:false,pauseReason:'',dailyRiskUsed:0,sessionStart:Date.now(),tradesCount:0}));
        setRec('✦ Odrodzenie po Złotej Pauzie.'); setRecAura('gold');
    };

    async function saveToBridge(trade:TradeRecord) {
        try { await fetch('http://127.0.0.1:3001/api/bridge/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'WRITE_FILE',filename:`ted_trade_${trade.timestamp}.json`,content:JSON.stringify(trade,null,2)})}); } catch {}
    }

    // ── SYMULATOR — operacje ──────────────────────────────────────
    const simOpen = useCallback(() => {
        const asset = market.find(a=>a.id===simBuyAsset);
        if (!asset) { setSimToast('⚠ Wybierz aktyw'); setTimeout(()=>setSimToast(''),2000); return; }
        const eur = parseFloat(simBuyAmount)||0;
        if (eur<1) { setSimToast('⚠ Minimalna kwota: 1€'); setTimeout(()=>setSimToast(''),2000); return; }
        if (eur>simBalance) { setSimToast('⚠ Za mały kapitał'); setTimeout(()=>setSimToast(''),2000); return; }
        const qty = eur/asset.current_price;
        const pos:SimPosition={
            id:crypto.randomUUID(), assetId:asset.id, symbol:asset.symbol.toUpperCase(), name:asset.name,
            investedEur:eur, quantity:qty, buyPrice:asset.current_price, openedAt:Date.now(),
        };
        setSimBalance(b=>b-eur);
        setSimPositions(p=>[...p,pos]);
        setSimToast(`✅ Otwarto ${asset.symbol.toUpperCase()} za ${fEUR(eur)}`);
        setTimeout(()=>setSimToast(''),2500);
    }, [market, simBuyAsset, simBuyAmount, simBalance]);

    const simClose = useCallback((pos:SimPosition) => {
        const asset = market.find(a=>a.id===pos.assetId);
        const currentPrice = asset?.current_price??pos.buyPrice;
        const currentValue = pos.quantity*currentPrice;
        const profitLoss = currentValue-pos.investedEur;
        const profitPct = (profitLoss/pos.investedEur)*100;
        const closed:SimClosedTrade={...pos,sellPrice:currentPrice,closedAt:Date.now(),profitLoss,profitPct};
        setSimBalance(b=>b+currentValue);
        setSimPositions(p=>p.filter(x=>x.id!==pos.id));
        setSimClosed(p=>[closed,...p].slice(0,30));
        // Skill update
        setSimSkill(prev=>{
            const delta = profitLoss>0?6:-2;
            return Math.max(0,Math.min(100,prev+delta));
        });
        const sign=profitLoss>=0?'+':'';
        setSimToast(`${profitLoss>=0?'🟢':'🔴'} Zamknięto ${pos.symbol} | ${sign}${fEUR(profitLoss)} (${sign}${profitPct.toFixed(1)}%)`);
        setTimeout(()=>setSimToast(''),3000);
    }, [market]);

    const simReset = () => {
        setSimBalance(TED_CONFIG.simBalance); setSimPositions([]); setSimClosed([]); setSimSkill(0);
        setSimToast('🔄 Symulator zresetowany'); setTimeout(()=>setSimToast(''),2000);
    };

    // Live P&L obliczane z aktualnych cen
    const getPosPnL = (pos:SimPosition) => {
        const asset = market.find(a=>a.id===pos.assetId);
        const cp = asset?.current_price??pos.buyPrice;
        const cv = pos.quantity*cp;
        return { currentValue:cv, pnl:cv-pos.investedEur, pct:((cv-pos.investedEur)/pos.investedEur)*100, currentPrice:cp };
    };

    const simTotalPnL = simPositions.reduce((sum,p)=>sum+getPosPnL(p).pnl,0);
    const skillLevel  = getSkillLevel(simSkill);
    const simUnlocked = simSkill>=75;

    // Report
    const generateReport = () => {
        const wins=trades.filter(t=>t.profitLoss>0).length, total=trades.length;
        const analyst=academyRoster.find(a=>a.name===selectedAnalystId);
        const roi=state.balance/TED_CONFIG.initialBalance-1;
        return `╔══════════════════════════════════════╗\n║   RAPORT FINANSOWY — TED THE TRADER  ║\n║   Katedra OtakOS · ${new Date().toLocaleDateString('pl-PL')}   ║\n╚══════════════════════════════════════╝\n\nKAPITAŁ STARTOWY:  100,00 €\nOBECNY STAN:       ${fEUR(state.balance)}\nROI:               ${fPct(roi*100)}\nZYSK/STRATA:       ${fEUR(state.totalProfit)}\n\nTRANSAKCJE:        ${total}\nZWYCIĘSKIE:        ${wins} (${total>0?((wins/total)*100).toFixed(0):0}%)\nSTRATEGIA:         ${STRATEGIES.find(s=>s.id===state.activeStrategy)?.name}\nANALITYK AI:       ${analyst?analyst.name+(analyst.track?' ('+analyst.track+')':''):'brak'}\n\nSYMULATOR SKILL:   ${simSkill}/100 — ${skillLevel.title}\nSIM. WYGRANY:      ${simClosed.filter(t=>t.profitLoss>0).length}/${simClosed.length}\n\nGRV POZOSTAŁE:     ${fGRV(state.grvBalance)}\nTEO SŁOWO:         ${state.teoWord||'[brak]'}\n\nZASADA 0.00G:\nKapitał rośnie gdy służy kreacji.\nZłota Pauza jest najcenniejszą strategią.`;
    };

    // ── RENDER ────────────────────────────────────────────────────
    const vib          = analyzeVibration(state.teoWord);
    const dailyRiskPct = Math.min(100,(state.dailyRiskUsed/(TED_CONFIG.dailyRiskLimit*state.balance))*100);
    const roi          = ((state.balance/TED_CONFIG.initialBalance)-1)*100;
    const analystOpts  = [{value:'none',label:'— brak analityka —'},...academyRoster.map(a=>({value:a.name,label:`${a.name}${a.track?' ('+a.track+')':''}`}))];
    const simAssetOpts = [{value:'none',label:'— wybierz aktyw —'},...market.map(a=>({value:a.id,label:`${a.symbol.toUpperCase()} — ${fEUR(a.current_price)}`}))];

    return (
        <div style={S.root}>
            <AnimatePresence>
                {showAlchemy && (
                    <motion.div initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:1.2}} style={S.alchemyOverlay}>
                        <div style={S.alchemyText}>✦ ALCHEMIA ✦</div>
                        <div style={S.alchemySubtext}>Złoto zmaterializowane</div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div style={S.header}>
                <div>
                    <div style={S.eyebrow}>∴ KATEDRA OTAKOS ∴</div>
                    <div style={S.title}>💰 TED THE TRADER v3.5</div>
                    <div style={S.subtitle}>Kwantowy Specjalista Dróżności Finansowej · Sala Treningowa</div>
                </div>
                <div style={S.balanceBlock}>
                    <div style={{...S.balanceVal,color:roi>=0?'#4ade80':'#f87171'}}>{fEUR(state.balance)}</div>
                    <div style={{...S.balanceROI,color:roi>=0?'#4ade80':'#f87171'}}>{fPct(roi)}</div>
                    <div style={S.balanceLabel}>PORTFEL</div>
                </div>
            </div>

            {/* Stats */}
            <div style={S.statsRow}>
                {[
                    {label:'GRV',         value:fGRV(state.grvBalance),  color:'#c9953a'},
                    {label:'ZYSK/STRATA', value:fEUR(state.totalProfit), color:state.totalProfit>=0?'#4ade80':'#f87171'},
                    {label:'SKILL SIM',   value:`${simSkill}/100`,        color:skillLevel.color},
                    {label:'WIN RATE',    value:`${(state.winRate*100).toFixed(0)}%`, color:'#a78bfa'},
                ].map(s=>(
                    <div key={s.label} style={S.statCard}>
                        <div style={{...S.statVal,color:s.color}}>{s.value}</div>
                        <div style={S.statLabel}>{s.label}</div>
                    </div>
                ))}
            </div>

            {realAssets.length > 0 && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', padding:'8px 10px', marginBottom:8, borderRadius:8, background:'rgba(167,139,250,.08)', border:'1px solid rgba(167,139,250,.25)' }}>
                    <span style={{ fontSize:9, color:'rgba(167,139,250,.8)', letterSpacing:'.1em', fontWeight:700 }}>💼 REALNY PORTFEL:</span>
                    {realAssets.map(a=>(
                        <span key={a.chain} style={{ fontSize:11, color:'#c4b5fd', fontFamily:"'JetBrains Mono',monospace" }}>
                            {a.symbol} {a.balance.toFixed(3)} <span style={{color:'rgba(255,255,255,.4)'}}>({a.value.toLocaleString('pl-PL')}€)</span>
                        </span>
                    ))}
                    <span style={{ marginLeft:'auto', fontSize:12, fontWeight:700, color:'#a78bfa' }}>
                        Σ {realAssets.reduce((s,a)=>s+a.value,0).toLocaleString('pl-PL',{maximumFractionDigits:0})} €
                    </span>
                </div>
            )}

            <AnimatePresence>
                {state.isPaused && (
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} style={S.pauseBanner}>
                        <div style={{fontSize:18}}>✦</div>
                        <div style={{flex:1}}><div style={S.pauseTitle}>ZŁOTA PAUZA</div><div style={S.pauseReason}>{state.pauseReason}</div></div>
                        <button style={S.pauseResume} onClick={resumeFromPause}>ODRODZENIE</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tabs */}
            <div style={S.tabs}>
                {(['scanner','simulator','trades','report'] as const).map(tab=>(
                    <button key={tab} style={{...S.tab,...(activeTab===tab?S.tabActive:{})}} onClick={()=>setActiveTab(tab)}>
                        {tab==='scanner'?'⚡ SKANER':tab==='simulator'?`🎮 SYMULATOR${simSkill>0?' '+simSkill:''}`:tab==='trades'?`📊 (${trades.length})`:'📋 RAPORT'}
                    </button>
                ))}
            </div>

            <div style={S.body}>

                {/* ══════════════ SCANNER ══════════════ */}
                {activeTab==='scanner' && (
                    <div style={S.panel}>

                        {/* Pasek kontrolny */}
                        <div style={S.controlBar}>
                            <div style={S.controlRow}>
                                <div style={{flex:1,minWidth:0}}>
                                    <div style={S.controlLabel}>🧠 ANALITYK AI — INKUBATOR</div>
                                    <DarkDropdown value={selectedAnalystId} options={analystOpts}
                                        onChange={v=>{setSelectedAnalystId(v);setAiAnalysis('');}}
                                        placeholder={academyRoster.length===0?'— najpierw wyszkolij agenta w Inkubatorze —':'— wybierz analityka —'}/>
                                </div>
                                <div>
                                    <div style={S.controlLabel}>⚙ STRATEGIA</div>
                                    <div style={{display:'flex',gap:4}}>
                                        {STRATEGIES.map(st=>(
                                            <button key={st.id} title={st.name}
                                                style={{...S.stratQuickBtn,...(state.activeStrategy===st.id?{borderColor:st.color,background:`${st.color}20`,color:st.color}:{})}}
                                                onClick={()=>setState(s=>({...s,activeStrategy:st.id}))}>
                                                {st.icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div style={S.controlRow}>
                                <div style={{flex:1,minWidth:0}}>
                                    <div style={S.controlLabel}>✦ TEO SŁOWO</div>
                                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                                        <input style={{...S.teoInput,fontSize:11,padding:'6px 10px'}} value={state.teoWord}
                                            onChange={e=>setState(s=>({...s,teoWord:e.target.value}))} placeholder="intencja..."/>
                                        <div style={{...S.vibBadge,padding:'4px 8px',fontSize:9,background:vib.positive?'rgba(74,222,128,.1)':'rgba(248,113,113,.1)',borderColor:vib.positive?'#4ade80':'#f87171',color:vib.positive?'#4ade80':'#f87171'}}>
                                            {vib.label}
                                        </div>
                                    </div>
                                </div>
                                <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                                    <div style={{...S.controlLabel,color:'rgba(255,255,255,.25)'}}>RYZYKO {dailyRiskPct.toFixed(0)}%</div>
                                    <motion.button
                                        style={{...S.scanBtnCompact,...(scanFlash?{background:'#4ade80',color:'#0a1208'}:{}),opacity:state.isScanning||aiLoading?0.6:1}}
                                        whileTap={{scale:0.95}} onClick={scanMarket} disabled={state.isScanning||aiLoading}>
                                        {state.isScanning?'⟳ SKANUJĘ...':aiLoading?`⟳ ${selectedAnalystId!=='none'?selectedAnalystId.split(' ')[0].toUpperCase():''} ANALIZUJE...`:`⚡ SKANUJ${selectedAnalystId!=='none'?' + '+selectedAnalystId.split(' ')[0].toUpperCase():''}`}
                                    </motion.button>
                                </div>
                            </div>
                            {scanStatus && <div style={{fontSize:8,color:'rgba(255,255,255,.25)',letterSpacing:'.1em',marginTop:2}}>{scanStatus}</div>}
                        </div>

                        {/* Wykres */}
                        {(selectedAsset||marketLoading) && (
                            <motion.div style={{...S.mainChartBox,...(scanFlash?{borderColor:'rgba(74,222,128,.4)'}:{})}} animate={scanFlash?{boxShadow:['0 0 0px rgba(74,222,128,0)','0 0 20px rgba(74,222,128,.4)','0 0 0px rgba(74,222,128,0)']}:{}} transition={{duration:1.2}}>
                                <div style={S.mainChartHeader}>
                                    {selectedAsset?(
                                        <>
                                            <span style={S.chartAssetName}>{selectedAsset.symbol.toUpperCase()} / EUR</span>
                                            <span style={{...S.chartAssetPrice,color:selectedAsset.price_change_percentage_24h>=0?'#4ade80':'#f87171'}}>{fEUR(selectedAsset.current_price)}</span>
                                            <span style={{...S.chartAssetChange,color:selectedAsset.price_change_percentage_24h>=0?'#4ade80':'#f87171'}}>{fPct(selectedAsset.price_change_percentage_24h)} (24h)</span>
                                            <span style={{fontSize:8,color:'rgba(255,255,255,.2)',marginLeft:'auto'}}>{STRATEGIES.find(s=>s.id===state.activeStrategy)?.icon} {STRATEGIES.find(s=>s.id===state.activeStrategy)?.name}</span>
                                        </>
                                    ):<span style={{fontSize:10,color:'rgba(201,149,58,.4)',letterSpacing:'.2em'}}>⟳ ŁADOWANIE...</span>}
                                </div>
                                <div style={{height:150}}>
                                    {chartLoading?<div style={S.chartLoading}>⟳ Pobieranie wykresu 24h...</div>:
                                    chartData.length>0?(
                                        <ResponsiveContainer width="100%" height={150}>
                                            <AreaChart data={chartData} margin={{top:4,right:4,left:-18,bottom:0}}>
                                                <defs>
                                                    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%"  stopColor={chartColor} stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <XAxis dataKey="time" tick={{fontSize:7,fill:'rgba(255,255,255,.2)',fontFamily:"'JetBrains Mono',monospace"}} interval="preserveStartEnd"/>
                                                <YAxis tick={{fontSize:7,fill:'rgba(255,255,255,.2)',fontFamily:"'JetBrains Mono',monospace"}} domain={['auto','auto']}/>
                                                <Tooltip content={<CustomTooltip/>}/>
                                                <Area type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2} fill="url(#cg)" dot={false} activeDot={{r:3,fill:chartColor}}/>
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ):null}
                                </div>
                            </motion.div>
                        )}

                        {/* Asset pills */}
                        {market.length>0 && (
                            <div style={S.assetPills}>
                                {market.slice(0,10).map(a=>(
                                    <button key={a.id} style={{...S.assetPill,...(selectedAsset?.id===a.id?{borderColor:a.price_change_percentage_24h>=0?'#4ade80':'#f87171',background:a.price_change_percentage_24h>=0?'rgba(74,222,128,.08)':'rgba(248,113,113,.08)'}:{})}}
                                        onClick={()=>handleAssetSelect(a)}>
                                        <span style={{fontSize:10,fontWeight:700,color:'#e8dfc8'}}>{a.symbol.toUpperCase()}</span>
                                        <span style={{fontSize:8,color:a.price_change_percentage_24h>=0?'#4ade80':'#f87171'}}>{fPct(a.price_change_percentage_24h)}</span>
                                    </button>
                                ))}
                                <button style={{...S.assetPill,borderColor:'rgba(201,149,58,.2)',fontSize:8,color:'rgba(201,149,58,.5)'}} onClick={()=>loadMarketSilent()}>⟳</button>
                            </div>
                        )}

                        {/* AI Analysis */}
                        <AnimatePresence>
                            {(aiAnalysis||aiLoading)&&selectedAnalystId!=='none'&&(
                                <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={S.aiBox}>
                                    <div style={S.aiLabel}>🧠 {selectedAnalystId.toUpperCase()} — ANALIZA{aiLoading&&<span style={{color:'#a78bfa',marginLeft:4}}>▊</span>}</div>
                                    <div style={S.aiText}>{aiAnalysis||'...'}</div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {recommendation&&(
                            <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                                style={{...S.recBox,borderColor:recAura==='gold'?'#c9953a':recAura==='cyan'?'#00e5ff':recAura==='red'?'#f87171':'#ffffff30'}}>
                                <div style={S.recLabel}>{selectedAnalystId!=='none'?'ALGORYTM TEDA (backup)':'REKOMENDACJA TEDA'}</div>
                                <div style={S.recText}>{recommendation}</div>
                            </motion.div>
                        )}
                        {marketError&&<div style={S.errorNote}>⚠ {marketError}</div>}

                        {/* Lista rynkowa */}
                        {market.length>0&&(
                            <div>
                                <div style={S.sectionTitle}>💹 LISTA RYNKOWA</div>
                                <div style={S.marketList}>
                                    {market.slice(0,8).map(a=>(
                                        <div key={a.id} style={{...S.marketRow,...(selectedAsset?.id===a.id?{borderColor:'rgba(201,149,58,.25)',background:'rgba(201,149,58,.03)'}:{})}} onClick={()=>handleAssetSelect(a)}>
                                            <div style={S.marketName}><span style={S.marketSymbol}>{a.symbol.toUpperCase()}</span><span style={S.marketFullName}>{a.name}</span></div>
                                            <div style={S.marketPrice}>{fEUR(a.current_price)}</div>
                                            <div style={{...S.marketChange,color:a.price_change_percentage_24h>=0?'#4ade80':'#f87171'}}>{fPct(a.price_change_percentage_24h)}</div>
                                            <div style={S.marketActions}>
                                                <button style={{...S.tradeBtn,borderColor:'#4ade80',color:'#4ade80'}} onClick={e=>{e.stopPropagation();executeTrade(a,'BUY');}}>↑ KUP</button>
                                                <button style={{...S.tradeBtn,borderColor:'#f87171',color:'#f87171'}} onClick={e=>{e.stopPropagation();executeTrade(a,'SELL');}}>↓ SPRZEDAJ</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════ SYMULATOR ══════════════ */}
                {activeTab==='simulator' && (
                    <div style={S.panel}>

                        {/* Odblokowanie */}
                        <AnimatePresence>
                            {simUnlocked&&(
                                <motion.div initial={{opacity:0,scale:.95}} animate={{opacity:1,scale:1}} style={S.unlockBanner}>
                                    <div style={{fontSize:24}}>🏆</div>
                                    <div>
                                        <div style={S.unlockTitle}>GOTOWY NA PRAWDZIWY RYNEK</div>
                                        <div style={S.unlockSub}>Ted osiągnął Skill {simSkill}/100. Zakładka ⚡ SKANER odblokowana do pełnych operacji.</div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Skill bar */}
                        <div style={S.skillPanel}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                                <div>
                                    <span style={{fontSize:18,marginRight:8}}>{skillLevel.icon}</span>
                                    <span style={{fontSize:13,fontWeight:700,color:skillLevel.color,letterSpacing:'.08em'}}>{skillLevel.title}</span>
                                </div>
                                <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>{simSkill} / 100</span>
                            </div>
                            <div style={S.skillTrack}>
                                <motion.div style={{...S.skillFill,width:`${simSkill}%`,background:`linear-gradient(90deg,${skillLevel.color}90,${skillLevel.color})`}} animate={{width:`${simSkill}%`}} transition={{duration:.8}}/>
                            </div>
                            <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                                {SKILL_LEVELS.map(l=>(
                                    <div key={l.title} style={{fontSize:7,color:simSkill>=l.min?l.color:'rgba(255,255,255,.15)',letterSpacing:'.05em',textAlign:'center'}}>
                                        {l.icon}
                                    </div>
                                ))}
                            </div>
                            <div style={{fontSize:8,color:'rgba(255,255,255,.2)',marginTop:6,letterSpacing:'.1em'}}>
                                +6 pkt za zysk · -2 pkt za stratę · 75+ = odblokowanie rynku
                            </div>
                        </div>

                        {/* Wirtualny portfel */}
                        <div style={S.simHeader}>
                            <div>
                                <div style={S.controlLabel}>KAPITAŁ WIRTUALNY</div>
                                <div style={{fontSize:20,fontWeight:700,color:'#a78bfa'}}>{fEUR(simBalance)}</div>
                            </div>
                            <div>
                                <div style={S.controlLabel}>OTWARTE P&L</div>
                                <div style={{fontSize:16,fontWeight:700,color:simTotalPnL>=0?'#4ade80':'#f87171'}}>{simTotalPnL>=0?'+':''}{fEUR(simTotalPnL)}</div>
                            </div>
                            <div>
                                <div style={S.controlLabel}>SIM. TRANSAKCJE</div>
                                <div style={{fontSize:16,fontWeight:700,color:'#00e5ff'}}>{simClosed.length}</div>
                            </div>
                            <button style={S.simResetBtn} onClick={simReset}>↺ RESET</button>
                        </div>

                        {/* Otwórz pozycję */}
                        <div style={S.simOpenBox}>
                            <div style={S.sectionTitle}>📥 OTWÓRZ POZYCJĘ SYMULACYJNĄ</div>
                            <div style={{display:'flex',gap:8,alignItems:'flex-end',flexWrap:'wrap'}}>
                                <div style={{flex:'2 1 160px'}}>
                                    <div style={S.controlLabel}>AKTYW</div>
                                    <DarkDropdown value={simBuyAsset} options={simAssetOpts} onChange={setSimBuyAsset} placeholder="— wybierz —"/>
                                </div>
                                <div style={{flex:'1 1 90px'}}>
                                    <div style={S.controlLabel}>KWOTA (€)</div>
                                    <input style={{...S.teoInput,padding:'7px 10px',fontSize:12}} type="number" min="1" value={simBuyAmount}
                                        onChange={e=>setSimBuyAmount(e.target.value)} placeholder="100"/>
                                </div>
                                <button style={S.simBuyBtn} onClick={simOpen}>🟢 KUP SIM</button>
                            </div>
                            {market.length===0&&<div style={S.analystHint}>Przejdź do Skanera i załaduj dane rynkowe</div>}
                        </div>

                        {/* Toast */}
                        <AnimatePresence>
                            {simToast&&(
                                <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={S.simToast}>
                                    {simToast}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Otwarte pozycje */}
                        {simPositions.length>0&&(
                            <div>
                                <div style={S.sectionTitle}>📂 OTWARTE POZYCJE ({simPositions.length})</div>
                                {simPositions.map(pos=>{
                                    const {pnl,pct,currentPrice,currentValue}=getPosPnL(pos);
                                    return (
                                        <motion.div key={pos.id} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}
                                            style={{...S.simPosCard,borderColor:pnl>=0?'rgba(74,222,128,.25)':'rgba(248,113,113,.25)'}}>
                                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                                                <div>
                                                    <span style={{fontSize:13,fontWeight:700,color:'#e8dfc8'}}>{pos.symbol}</span>
                                                    <span style={{fontSize:9,color:'rgba(255,255,255,.3)',marginLeft:8}}>{pos.name}</span>
                                                </div>
                                                <button style={{...S.tradeBtn,borderColor:pnl>=0?'#4ade80':'#f87171',color:pnl>=0?'#4ade80':'#f87171',padding:'4px 10px',fontSize:9}}
                                                    onClick={()=>simClose(pos)}>ZAMKNIJ</button>
                                            </div>
                                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:4,marginTop:6}}>
                                                {[
                                                    {l:'ZAKUP', v:fEUR(pos.buyPrice)},
                                                    {l:'OBECNA', v:fEUR(currentPrice), c:pnl>=0?'#4ade80':'#f87171'},
                                                    {l:'INWESTYCJA', v:fEUR(pos.investedEur)},
                                                    {l:'WARTOŚĆ', v:fEUR(currentValue), c:pnl>=0?'#4ade80':'#f87171'},
                                                ].map(x=>(
                                                    <div key={x.l} style={{display:'flex',flexDirection:'column',gap:1}}>
                                                        <span style={{fontSize:7,color:'rgba(255,255,255,.25)',letterSpacing:'.15em'}}>{x.l}</span>
                                                        <span style={{fontSize:10,fontWeight:700,color:x.c||'rgba(255,255,255,.7)'}}>{x.v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{marginTop:6,fontSize:12,fontWeight:700,color:pnl>=0?'#4ade80':'#f87171'}}>
                                                {pnl>=0?'+':''}{fEUR(pnl)} ({pnl>=0?'+':''}{pct.toFixed(2)}%)
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Historia symulacji */}
                        {simClosed.length>0&&(
                            <div>
                                <div style={S.sectionTitle}>📋 HISTORIA SYMULACJI ({simClosed.length})</div>
                                {simClosed.slice(0,10).map(t=>(
                                    <div key={t.id} style={{...S.tradeCard,borderColor:t.profitLoss>=0?'rgba(74,222,128,.2)':'rgba(248,113,113,.2)'}}>
                                        <div style={S.tradeHeader}>
                                            <span style={{...S.tradeAction,color:t.profitLoss>=0?'#4ade80':'#f87171'}}>SIM {t.symbol}</span>
                                            <span style={{color:t.profitLoss>=0?'#4ade80':'#f87171',fontSize:12}}>{t.profitLoss>=0?'+':''}{fEUR(t.profitLoss)}</span>
                                            <span style={{fontSize:9,color:'rgba(255,255,255,.3)'}}>{fPct(t.profitPct)}</span>
                                            <span style={S.tradeDate}>{new Date(t.closedAt).toLocaleTimeString('pl-PL')}</span>
                                        </div>
                                        <div style={{fontSize:9,color:'rgba(255,255,255,.3)'}}>
                                            Zakup {fEUR(t.buyPrice)} → Sprzedaż {fEUR(t.sellPrice)} | Inwestycja {fEUR(t.investedEur)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {simPositions.length===0&&simClosed.length===0&&(
                            <div style={S.empty}>Sala treningowa gotowa. Otwórz pierwszą pozycję symulacyjną powyżej. Zbieraj Skill Points i odblokuj prawdziwy rynek!</div>
                        )}
                    </div>
                )}

                {/* ══════════════ TRADES ══════════════ */}
                {activeTab==='trades'&&(
                    <div style={S.panel}>
                        <div style={S.sectionTitle}>📊 HISTORIA TRANSAKCJI REALNYCH</div>
                        {trades.length===0&&<div style={S.empty}>Brak transakcji — zeskanuj rynek i wykonaj pierwszą alchemię!</div>}
                        {trades.map(t=>(
                            <motion.div key={t.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}}
                                style={{...S.tradeCard,borderColor:t.aura==='gold'?'rgba(201,149,58,.3)':'rgba(248,113,113,.3)'}}>
                                <div style={S.tradeHeader}>
                                    <span style={{...S.tradeAction,color:t.action==='BUY'?'#4ade80':'#f87171'}}>{t.action==='BUY'?'↑':'↓'} {t.symbol}</span>
                                    <span style={{color:t.profitLoss>=0?'#4ade80':'#f87171',fontSize:12}}>{t.profitLoss>=0?'+':''}{fEUR(t.profitLoss)}</span>
                                    <span style={S.tradeDate}>{new Date(t.timestamp).toLocaleTimeString('pl-PL')}</span>
                                </div>
                                <div style={S.tradeNote}>{t.note}</div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* ══════════════ REPORT ══════════════ */}
                {activeTab==='report'&&(
                    <div style={S.panel}>
                        <div style={S.sectionTitle}>📋 RAPORT FINANSOWY</div>
                        <pre style={S.reportPre}>{generateReport()}</pre>
                        <div style={{display:'flex',gap:8,marginTop:12}}>
                            <button style={S.reportBtn} onClick={()=>navigator.clipboard.writeText(generateReport())}>📋 KOPIUJ</button>
                            <button style={{...S.reportBtn,borderColor:'rgba(201,149,58,.3)',color:'#c9953a'}}
                                onClick={()=>fetch('http://127.0.0.1:3001/api/bridge/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'WRITE_FILE',filename:`ted_report_${Date.now()}.txt`,content:generateReport()})})}>
                                💾 ZAPISZ DO WIESŁAWA
                            </button>
                        </div>
                    </div>
                )}

            </div>

            <div style={S.footer}>
                <span style={{color:'rgba(255,255,255,.15)',fontSize:9,letterSpacing:'.2em'}}>
                    ZASADA 0.00G · RÓWNOWAGA {'>'} CHCIWOŚĆ · ZŁOTA PAUZA = MĄDROŚĆ
                </span>
            </div>
        </div>
    );
};

// ── STYLE ─────────────────────────────────────────────────────────
const S: Record<string,React.CSSProperties> = {
    root:{ display:'flex',flexDirection:'column',background:'linear-gradient(160deg,rgba(10,8,18,.99),rgba(6,8,15,1))',borderRadius:14,border:'1px solid rgba(201,149,58,.2)',overflow:'hidden',fontFamily:"'JetBrains Mono','Courier New',monospace",maxWidth:720,margin:'0 auto',maxHeight:'88vh',boxShadow:'0 20px 80px rgba(0,0,0,.6)' },
    alchemyOverlay:{ position:'absolute',inset:0,zIndex:100,background:'rgba(201,149,58,.12)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none' },
    alchemyText:{ fontFamily:"'Cinzel',serif",fontSize:32,color:'#f0c060',textShadow:'0 0 40px rgba(201,149,58,.8)',letterSpacing:'.2em' },
    alchemySubtext:{ fontSize:12,color:'rgba(201,149,58,.6)',letterSpacing:'.2em',marginTop:8 },
    header:{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'14px 20px 10px',background:'rgba(201,149,58,.06)',borderBottom:'1px solid rgba(201,149,58,.1)' },
    eyebrow:{ fontSize:8,letterSpacing:'.4em',color:'rgba(201,149,58,.4)',marginBottom:3 },
    title:{ fontSize:18,fontWeight:700,color:'#f0c060',letterSpacing:'.08em' },
    subtitle:{ fontSize:8,color:'rgba(255,255,255,.3)',letterSpacing:'.1em',marginTop:2 },
    balanceBlock:{ textAlign:'right' },
    balanceVal:{ fontSize:20,fontWeight:700,letterSpacing:'.05em' },
    balanceROI:{ fontSize:11,letterSpacing:'.1em',marginTop:2 },
    balanceLabel:{ fontSize:7,color:'rgba(255,255,255,.25)',letterSpacing:'.2em',marginTop:2 },
    statsRow:{ display:'flex',borderBottom:'1px solid rgba(255,255,255,.05)' },
    statCard:{ flex:1,padding:'7px 10px',display:'flex',flexDirection:'column',gap:2,borderRight:'1px solid rgba(255,255,255,.04)' },
    statVal:{ fontSize:12,fontWeight:700,letterSpacing:'.04em' },
    statLabel:{ fontSize:7,color:'rgba(255,255,255,.25)',letterSpacing:'.18em' },
    pauseBanner:{ background:'rgba(201,149,58,.1)',borderBottom:'1px solid rgba(201,149,58,.2)',padding:'9px 18px',display:'flex',alignItems:'center',gap:10,overflow:'hidden' },
    pauseTitle:{ fontSize:10,color:'#f0c060',fontWeight:700,letterSpacing:'.15em' },
    pauseReason:{ fontSize:9,color:'rgba(201,149,58,.6)',marginTop:1 },
    pauseResume:{ padding:'5px 12px',borderRadius:6,border:'1px solid rgba(201,149,58,.4)',background:'rgba(201,149,58,.1)',color:'#f0c060',fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:'pointer',letterSpacing:'.12em',whiteSpace:'nowrap' },
    tabs:{ display:'flex',borderBottom:'1px solid rgba(255,255,255,.05)' },
    tab:{ flex:1,padding:'8px 4px',background:'none',border:'none',cursor:'pointer',fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:'.08em',color:'rgba(255,255,255,.3)',borderBottom:'2px solid transparent',transition:'all .2s' },
    tabActive:{ color:'#f0c060',borderBottomColor:'#c9953a',background:'rgba(201,149,58,.05)' },
    body:{ flex:1,overflow:'hidden' },
    panel:{ padding:14,display:'flex',flexDirection:'column',gap:10,height:'100%',overflowY:'auto' },
    sectionTitle:{ fontSize:8,letterSpacing:'.28em',color:'rgba(201,149,58,.5)',borderBottom:'1px solid rgba(201,149,58,.08)',paddingBottom:5 },
    // Control bar
    controlBar:{ background:'rgba(0,0,0,.2)',border:'1px solid rgba(201,149,58,.12)',borderRadius:10,padding:'10px 12px',display:'flex',flexDirection:'column',gap:9 },
    controlRow:{ display:'flex',gap:10,alignItems:'flex-end' },
    controlLabel:{ fontSize:7,letterSpacing:'.25em',color:'rgba(201,149,58,.45)',marginBottom:4 },
    stratQuickBtn:{ width:32,height:32,border:'1px solid rgba(255,255,255,.1)',borderRadius:6,background:'rgba(255,255,255,.03)',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s',color:'rgba(255,255,255,.6)' },
    scanBtnCompact:{ padding:'7px 14px',background:'linear-gradient(135deg,#7a5a1a,#c9953a)',border:'none',borderRadius:8,color:'#1a1208',fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:'.1em',cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 0 20px rgba(201,149,58,.2)',transition:'background .3s,color .3s' },
    // Chart
    mainChartBox:{ background:'rgba(0,0,0,.25)',border:'1px solid rgba(201,149,58,.12)',borderRadius:10,padding:'10px 12px',transition:'border-color .3s' },
    mainChartHeader:{ display:'flex',alignItems:'baseline',gap:10,marginBottom:6 },
    chartAssetName:{ fontSize:12,fontWeight:700,color:'#e8dfc8',letterSpacing:'.08em' },
    chartAssetPrice:{ fontSize:17,fontWeight:700,letterSpacing:'.04em' },
    chartAssetChange:{ fontSize:10,letterSpacing:'.05em' },
    chartLoading:{ display:'flex',alignItems:'center',justifyContent:'center',height:150,fontSize:10,color:'rgba(201,149,58,.4)',letterSpacing:'.2em' },
    assetPills:{ display:'flex',gap:5,flexWrap:'wrap' },
    assetPill:{ padding:'5px 9px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,transition:'all .15s',fontFamily:"'JetBrains Mono',monospace",minWidth:48 },
    teoInput:{ flex:1,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)',borderRadius:6,padding:'8px 10px',color:'#e8dfc8',fontFamily:"'JetBrains Mono',monospace",fontSize:12,outline:'none' },
    vibBadge:{ padding:'5px 10px',borderRadius:6,border:'1px solid',fontSize:10,letterSpacing:'.1em',whiteSpace:'nowrap' },
    aiBox:{ background:'rgba(167,139,250,.06)',border:'1px solid rgba(167,139,250,.2)',borderRadius:8,padding:12 },
    aiLabel:{ fontSize:8,letterSpacing:'.2em',color:'rgba(167,139,250,.6)',marginBottom:7,display:'flex',alignItems:'center',gap:4 },
    aiText:{ fontSize:12,color:'rgba(232,223,200,.9)',lineHeight:1.8,whiteSpace:'pre-wrap' },
    recBox:{ background:'rgba(0,0,0,.3)',border:'1px solid',borderRadius:8,padding:12 },
    recLabel:{ fontSize:8,letterSpacing:'.22em',color:'rgba(201,149,58,.5)',marginBottom:5 },
    recText:{ fontSize:11,color:'rgba(232,223,200,.85)',lineHeight:1.7 },
    errorNote:{ fontSize:9,color:'rgba(248,113,113,.6)',letterSpacing:'.1em' },
    marketList:{ display:'flex',flexDirection:'column',gap:4 },
    marketRow:{ display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'rgba(255,255,255,.02)',borderRadius:7,border:'1px solid rgba(255,255,255,.05)',cursor:'pointer',transition:'all .15s' },
    marketName:{ flex:1,display:'flex',flexDirection:'column',gap:1 },
    marketSymbol:{ fontSize:11,fontWeight:700,color:'#e8dfc8' },
    marketFullName:{ fontSize:8,color:'rgba(255,255,255,.3)' },
    marketPrice:{ fontSize:11,color:'rgba(255,255,255,.7)',minWidth:78,textAlign:'right' },
    marketChange:{ fontSize:11,minWidth:56,textAlign:'right',fontWeight:700 },
    marketActions:{ display:'flex',gap:4 },
    tradeBtn:{ padding:'3px 8px',border:'1px solid',borderRadius:5,background:'none',fontFamily:"'JetBrains Mono',monospace",fontSize:8,cursor:'pointer',letterSpacing:'.05em' },
    tradeCard:{ background:'rgba(255,255,255,.02)',border:'1px solid',borderRadius:8,padding:'9px 11px',display:'flex',flexDirection:'column',gap:3 },
    tradeHeader:{ display:'flex',alignItems:'center',gap:8 },
    tradeAction:{ fontSize:11,fontWeight:700,letterSpacing:'.08em',flex:1 },
    tradeDate:{ fontSize:9,color:'rgba(255,255,255,.25)' },
    tradeNote:{ fontSize:9,color:'rgba(255,255,255,.4)',lineHeight:1.4 },
    empty:{ textAlign:'center',padding:'36px 20px',fontSize:11,color:'rgba(255,255,255,.2)',letterSpacing:'.08em',lineHeight:1.8 },
    reportPre:{ background:'rgba(0,0,0,.3)',border:'1px solid rgba(255,255,255,.06)',borderRadius:8,padding:12,fontSize:10,lineHeight:1.7,color:'rgba(232,223,200,.7)',whiteSpace:'pre-wrap',fontFamily:"'JetBrains Mono',monospace" },
    reportBtn:{ padding:'7px 12px',borderRadius:7,border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.03)',color:'rgba(255,255,255,.5)',fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:'pointer',letterSpacing:'.1em' },
    // Symulator
    unlockBanner:{ background:'linear-gradient(135deg,rgba(240,192,96,.08),rgba(74,222,128,.08))',border:'1px solid rgba(240,192,96,.3)',borderRadius:10,padding:'14px 16px',display:'flex',gap:14,alignItems:'center' },
    unlockTitle:{ fontSize:13,fontWeight:700,color:'#f0c060',letterSpacing:'.1em' },
    unlockSub:{ fontSize:9,color:'rgba(255,255,255,.5)',marginTop:3,lineHeight:1.5 },
    skillPanel:{ background:'rgba(0,0,0,.2)',border:'1px solid rgba(255,255,255,.06)',borderRadius:10,padding:'12px 14px' },
    skillTrack:{ height:8,background:'rgba(255,255,255,.07)',borderRadius:4,overflow:'hidden' },
    skillFill:{ height:'100%',borderRadius:4 },
    simHeader:{ display:'flex',gap:8,alignItems:'flex-end',flexWrap:'wrap',background:'rgba(167,139,250,.04)',border:'1px solid rgba(167,139,250,.12)',borderRadius:10,padding:'10px 14px' },
    simOpenBox:{ background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.06)',borderRadius:10,padding:'12px 14px',display:'flex',flexDirection:'column',gap:10 },
    simBuyBtn:{ padding:'8px 16px',background:'rgba(74,222,128,.15)',border:'1px solid rgba(74,222,128,.4)',borderRadius:8,color:'#4ade80',fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',letterSpacing:'.08em' },
    simResetBtn:{ padding:'6px 12px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.1)',borderRadius:7,color:'rgba(255,255,255,.4)',fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:'pointer',letterSpacing:'.1em',alignSelf:'flex-start' },
    simPosCard:{ background:'rgba(255,255,255,.02)',border:'1px solid',borderRadius:9,padding:'10px 12px',display:'flex',flexDirection:'column',gap:4 },
    simToast:{ background:'rgba(0,0,0,.7)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'9px 16px',fontSize:11,color:'rgba(232,223,200,.9)',textAlign:'center',letterSpacing:'.05em' },
    analystHint:{ fontSize:9,color:'rgba(255,255,255,.2)',letterSpacing:'.05em',lineHeight:1.6 },
    footer:{ padding:'6px 20px',borderTop:'1px solid rgba(255,255,255,.04)',textAlign:'center' },
};

export default TedTheTrader;
