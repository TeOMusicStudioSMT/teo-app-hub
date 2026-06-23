/**
 * 📜 dziennikTemplate — generator Dziennika Pokładowego (styl infografiki 0.00G).
 *
 * Bierze ustrukturyzowane dane (z LLM po przemiale podcastu) i produkuje HTML
 * IDENTYCZNY w stylu jak gotowe Dzienniki (Orbitron + Share Tech Mono, paleta
 * Neon Cyber-Mystic, Chart.js: radar Rady / doughnut modułów / bar PEIE +
 * oś czasu Flash BoBa). Zero SVG — tylko HTML/Tailwind/Canvas.
 */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * @param {object} d  { title, cycle, architect, status, intro,
 *   council:[{name,role,color}], councilChart:{labels:[],data:[]},
 *   modules:[{icon,name,desc}], modulesChart:{labels:[],data:[]},
 *   economy:{intro, metricLabel, metricValue, barLabels:[], barData:[]},
 *   timeline:[{title,desc,color}], footer }
 * @returns {string} pełny HTML
 */
export function buildDziennikHtml(d = {}) {
  const C = { cyan: '#06b6d4', fuchsia: '#d946ef', amber: '#f59e0b', emerald: '#10b981', indigo: '#6366f1' };
  const council = Array.isArray(d.council) ? d.council : [];
  const modules = Array.isArray(d.modules) ? d.modules : [];
  const timeline = Array.isArray(d.timeline) ? d.timeline : [];
  const tlColors = [C.cyan, C.fuchsia, C.emerald, C.amber, C.indigo];

  const councilChart = d.councilChart || { labels: council.map(c => c.name), data: council.map(() => 90) };
  const modulesChart = d.modulesChart || { labels: modules.map(m => m.name), data: modules.map(() => 1) };
  const eco = d.economy || { intro: '', metricLabel: 'Redukcja Kosztów API', metricValue: '100%', barLabels: ['Chmura (Matrix)', 'Lokalnie (0.00G)'], barData: [100, 0] };

  const councilCards = council.map(c =>
    `<div class="bg-slate-800/50 p-3 rounded border border-slate-700"><span class="font-bold block" style="color:${c.color || C.fuchsia}">${esc(c.name)}</span> ${esc(c.role)}</div>`
  ).join('\n');

  const moduleItems = modules.map(m =>
    `<li class="flex items-start"><span class="text-2xl mr-3">${esc(m.icon || '✨')}</span><div><strong class="text-white">${esc(m.name)}:</strong> ${esc(m.desc)}</div></li>`
  ).join('\n');

  const timelineItems = timeline.map((t, i) => {
    const col = t.color || tlColors[i % tlColors.length];
    const left = i % 2 === 0;
    const text = `<h4 class="text-xl font-bold font-orbitron" style="color:${col}">${esc(t.title)}</h4><p class="text-slate-400 mt-2 text-sm">${esc(t.desc)}</p>`;
    return `<div class="relative flex items-center justify-between w-full mb-12">
      <div class="w-5/12 ${left ? 'text-right pr-6' : 'pr-6'}">${left ? text : ''}</div>
      <div class="z-10 w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center font-bold" style="border:4px solid ${col};color:${col};box-shadow:0 0 10px ${col}">${i + 1}</div>
      <div class="w-5/12 ${left ? 'pl-6' : 'pl-6 text-left'}">${left ? '' : text}</div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dziennik Pokładowy: ${esc(d.title || 'Katedra OtakOS')}</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
body{font-family:'Share Tech Mono',monospace;background-color:#020617;color:#e2e8f0}
h1,h2,h3,h4,.font-orbitron{font-family:'Orbitron',sans-serif}
.glow-text-cyan{text-shadow:0 0 10px rgba(6,182,212,.7)}
.card-glow{box-shadow:0 0 20px rgba(6,182,212,.1);border:1px solid rgba(6,182,212,.2)}
.chart-container{position:relative;width:100%;max-width:600px;margin:auto;height:300px;max-height:400px}
@media(min-width:768px){.chart-container{height:350px}}
</style></head>
<body class="antialiased min-h-screen p-4 md:p-8"><div class="max-w-7xl mx-auto space-y-12">

<header class="text-center space-y-4 py-12 border-b border-cyan-900/50">
  <div class="inline-block px-4 py-1 rounded-full border border-fuchsia-500/50 text-fuchsia-400 text-sm tracking-widest mb-4">[ STATUS: ${esc(d.status || 'PEŁNA SUWERENNOŚĆ TWÓRCZA')} ]</div>
  <h1 class="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 font-orbitron glow-text-cyan">🌌 ${esc(d.title || 'DZIENNIK POKŁADOWY KATEDRY OtakOS')}</h1>
  <p class="text-xl text-slate-400">Cykl: <span class="text-cyan-400">${esc(d.cycle || 'Era 0.00G')}</span></p>
  <p class="text-lg text-amber-400">Architekt Rzeczywistości: ${esc(d.architect || 'Suweren Arkadiusz')}</p>
</header>

<section class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
  <div class="card-glow bg-slate-900 rounded-2xl p-6 md:p-8">
    <h2 class="text-2xl font-bold text-cyan-400 mb-4 font-orbitron border-b border-cyan-900/50 pb-2">🔮 Bilans Energetyczny Rady</h2>
    <p class="text-slate-300 leading-relaxed mb-6">${esc(d.intro || '')}</p>
    <div class="grid grid-cols-2 gap-4 text-sm">${councilCards}</div>
  </div>
  <div class="card-glow bg-slate-900 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center">
    <h3 class="text-xl text-center text-slate-400 mb-4">Rozkład Rezonansu Rady (0.00G)</h3>
    <div class="chart-container"><canvas id="radar"></canvas></div>
  </div>
</section>

<section class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
  <div class="card-glow bg-slate-900 rounded-2xl p-6 md:p-8 lg:order-2">
    <h2 class="text-2xl font-bold text-fuchsia-400 mb-4 font-orbitron border-b border-fuchsia-900/50 pb-2">⚙️ Moduły / Wektory Cyklu</h2>
    <ul class="space-y-3 text-slate-300">${moduleItems}</ul>
  </div>
  <div class="card-glow bg-slate-900 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center lg:order-1">
    <h3 class="text-xl text-center text-slate-400 mb-4">Kompozycja Ekosystemu</h3>
    <div class="chart-container"><canvas id="doughnut"></canvas></div>
  </div>
</section>

<section class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
  <div class="card-glow bg-slate-900 rounded-2xl p-6 md:p-8">
    <h2 class="text-2xl font-bold text-emerald-400 mb-4 font-orbitron border-b border-emerald-900/50 pb-2">🎣 Prawo Ekonomiczne (PEIE)</h2>
    <p class="text-slate-300 leading-relaxed mb-6">${esc(eco.intro)}</p>
    <div class="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4 text-center">
      <p class="text-sm text-emerald-400 uppercase tracking-wider mb-1">${esc(eco.metricLabel)}</p>
      <p class="text-5xl font-black font-orbitron text-emerald-400 glow-text-cyan">${esc(eco.metricValue)}</p>
    </div>
  </div>
  <div class="card-glow bg-slate-900 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center">
    <h3 class="text-xl text-center text-slate-400 mb-4">Analiza Kosztów (Matrix vs 0.00G)</h3>
    <div class="chart-container"><canvas id="bar"></canvas></div>
  </div>
</section>

<section class="card-glow bg-slate-900 rounded-2xl p-6 md:p-12">
  <h2 class="text-3xl font-bold text-amber-400 mb-8 font-orbitron text-center border-b border-amber-900/50 pb-4">🛠️ Raport Techniczny / Oś Czasu</h2>
  <div class="relative max-w-4xl mx-auto">
    <div class="absolute inset-0 w-1 bg-cyan-900/50 left-1/2 transform -translate-x-1/2 rounded"></div>
    ${timelineItems}
  </div>
  <div class="mt-16 text-center"><div class="inline-block px-8 py-3 rounded border border-emerald-500 bg-emerald-900/20 text-emerald-400 font-bold tracking-widest font-orbitron" style="box-shadow:0 0 15px rgba(16,185,129,.3)">[ ${esc(d.footer || 'ZESPAWANE NA WIEKI - MOŻNA GASIĆ ŚWIATŁO')} ]</div></div>
</section>

</div>
<script>
Chart.defaults.color='#94a3b8';Chart.defaults.font.family="'Share Tech Mono',monospace";
new Chart(document.getElementById('radar'),{type:'radar',data:{labels:${JSON.stringify(councilChart.labels)},datasets:[{label:'Rezonans',data:${JSON.stringify(councilChart.data)},backgroundColor:'rgba(6,182,212,.2)',borderColor:'#06b6d4',pointBackgroundColor:'#d946ef',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,scales:{r:{angleLines:{color:'rgba(148,163,184,.2)'},grid:{color:'rgba(148,163,184,.2)'},pointLabels:{color:'#cbd5e1',font:{size:11}},ticks:{display:false,max:100,min:0}}},plugins:{legend:{display:false}}}});
new Chart(document.getElementById('doughnut'),{type:'doughnut',data:{labels:${JSON.stringify(modulesChart.labels)},datasets:[{data:${JSON.stringify(modulesChart.data)},backgroundColor:['#06b6d4','#d946ef','#f59e0b','#10b981','#6366f1','#a78bfa'],borderColor:'#020617',borderWidth:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{position:'right',labels:{color:'#cbd5e1',font:{size:11}}}}}});
new Chart(document.getElementById('bar'),{type:'bar',data:{labels:${JSON.stringify(eco.barLabels)},datasets:[{label:'Jednostki Kosztu',data:${JSON.stringify(eco.barData)},backgroundColor:['#f43f5e','#10b981'],borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,grid:{color:'rgba(148,163,184,.1)'}},x:{grid:{display:false}}},plugins:{legend:{display:false}}}});
</script></body></html>`;
}

export default { buildDziennikHtml };
