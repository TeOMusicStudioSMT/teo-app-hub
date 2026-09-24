/**
 * 🧱 Świat Katedry — płytki LEGO TeOgochi, rysowane izometrycznie na Canvas 2D.
 *
 * Każdy wykluty TeOgochi ma swoją płytkę, na niej swoją figurkę i swoje klocki —
 * jeden klocek = jedno PRAWDZIWE dzieło z dysku Katedry (/api/stado/swiat,
 * services/KlockiStada.js). Na żywo (strumień szyny) figurka podskakuje, a nad nią
 * pojawia się dymek z tym, co agent właśnie zrobił. Dotknięcie płytki otwiera
 * katalog: dzieła z podglądem i ślady na szynie.
 *
 * Bez bibliotek i bez sieci poza mostem — działa z USB i na słabym telefonie.
 * Klucz Straży i token telefonu przychodzą we fragmencie adresu (#k=…&t=…);
 * lokalnie (Hub na tej maszynie) ich nie trzeba.
 */
(() => {
  'use strict';

  // ── Połączenie ──────────────────────────────────────────────────────────────
  const frag = new URLSearchParams(location.hash.slice(1));
  const KLUCZ = frag.get('k') || '';
  const TOKEN = frag.get('t') || '';
  const naglowki = {};
  if (KLUCZ) naglowki['x-teo-klucz'] = KLUCZ;
  if (TOKEN) naglowki['X-Stado-Token'] = TOKEN;
  /** Adres pliku z mostu; dla <img>/<audio> klucz musi jechać parametrem (nagłówka się nie doda). */
  const zKluczem = (url) => (KLUCZ ? `${url}${url.includes('?') ? '&' : '?'}k=${encodeURIComponent(KLUCZ)}` : url);

  // ── Stan ────────────────────────────────────────────────────────────────────
  let swiat = null;              // odpowiedź /api/stado/swiat
  let plytki = [];               // { g, x, y, klocki[], razem } w siatce świata
  const dymki = new Map();       // id gatunku → { tekst, od }
  let otwarty = null;            // id gatunku w katalogu
  let tryb = '2d';               // '2d' (Canvas, lekki) albo '3d' (three.js, swiat3d.js)
  const sluchacze = new Set();   // tryb 3D i panele słuchają: ('dane'), ('zdarzenie', idGatunku, tekst), ('szyna', z)
  const rozszerzenia = new Set(); // panele.js dokłada sekcje do katalogu agenta (rozmowa, silnik, rzeźbienie)
  const powiadom = (...a) => sluchacze.forEach((f) => { try { f(...a); } catch (e) { console.error('[Świat]', e); } });

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ileTemu = (ms) => {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    return s < 60 ? 'przed chwilą' : s < 3600 ? `${Math.floor(s / 60)} min temu` : s < 86400 ? `${Math.floor(s / 3600)} h temu` : `${Math.floor(s / 86400)} dni temu`;
  };
  const dziel = (n) => { const d = n % 10, s = n % 100; return n === 1 ? 'dzieło' : d >= 2 && d <= 4 && (s < 12 || s > 14) ? 'dzieła' : 'dzieł'; };
  const kiedyTekst = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? ileTemu(t) : ''; };

  const IKONY = { utwor: '🎵', film: '🎬', odcinek: '📺', kreacja: '👗', apka: '🧩', gra: '🎮', model3d: '🧊', chip: '💠', print: '🖨️', wklad: '📜' };
  const NAZWY = { utwor: 'utwór', film: 'film', odcinek: 'odcinek', kreacja: 'kreacja', apka: 'apka', gra: 'gra', model3d: 'model 3D', chip: 'chip', print: 'print', wklad: 'wkład do projektu' };

  // ── Kolory ──────────────────────────────────────────────────────────────────
  function hexNaRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    const n = m ? parseInt(m[1], 16) : 0x94a3b8;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  const jasniej = (c, f) => c.map((v) => v + (255 - v) * f);
  const ciemniej = (c, f) => c.map((v) => v * (1 - f));
  /** Każdy rodzaj klocka to inny odcień koloru agenta — płytka jest „jego", a klocki się różnią. */
  const ODCIEN = { utwor: 0, film: 0.15, odcinek: -0.2, kreacja: 0.25, apka: 0, gra: -0.25, model3d: 0.3, chip: 0.1, print: -0.1, wklad: 0.4 };
  const kolorKlocka = (baza, rodzaj) => { const f = ODCIEN[rodzaj] ?? 0; return f >= 0 ? jasniej(baza, f) : ciemniej(baza, -f); };

  // ── Rzut izometryczny ───────────────────────────────────────────────────────
  const cv = $('scena');
  const ctx = cv.getContext('2d');
  let dpr = 1, W = 0, H = 0;
  const kam = { x: 0, y: 0, s: 1 };           // przesunięcie i skala
  const TW = 34, TH = 17, BH = 12;           // szerokość/wysokość rombu jednej kratki, wysokość klocka
  const P = 6;                                // płytka: 6×6 kratek
  const ODSTEP = 3;                           // kratki przerwy między płytkami

  const iso = (x, y, z = 0) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 - z * BH });
  const naEkran = (p) => ({ x: (p.x + kam.x) * kam.s + W / 2, y: (p.y + kam.y) * kam.s + H * 0.42 });

  function rozmiar() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    rysuj();
  }

  /** Prostopadłościan izometryczny (klocek albo płytka) od kratki (x,y,z) o wymiarach (w,d,h). */
  function prostopadloscian(x, y, z, w, d, h, kolor, wypustki = true) {
    const p = (a, b, c) => naEkran(iso(a, b, c));
    const g1 = p(x, y, z + h), g2 = p(x + w, y, z + h), g3 = p(x + w, y + d, z + h), g4 = p(x, y + d, z + h);
    const d2 = p(x + w, y, z), d3 = p(x + w, y + d, z), d4 = p(x, y + d, z);
    const wielokat = (pkt, styl) => { ctx.beginPath(); pkt.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fillStyle = styl; ctx.fill(); };
    wielokat([g4, g3, d3, d4], rgb(ciemniej(kolor, 0.28)));   // lewa ściana
    wielokat([g2, g3, d3, d2], rgb(ciemniej(kolor, 0.14)));   // prawa ściana
    wielokat([g1, g2, g3, g4], rgb(kolor));                    // wierzch
    ctx.strokeStyle = rgb(ciemniej(kolor, 0.45), 0.5); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y); ctx.lineTo(g3.x, g3.y); ctx.lineTo(g4.x, g4.y); ctx.closePath(); ctx.stroke();
    if (!wypustki) return;
    // Wypustki LEGO: po jednej na kratkę wierzchu.
    const rx = TW * 0.2 * kam.s, ry = TH * 0.2 * kam.s, hw = BH * 0.28 * kam.s;
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
      const c = p(x + i + 0.5, y + j + 0.5, z + h);
      ctx.fillStyle = rgb(ciemniej(kolor, 0.2));
      ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgb(jasniej(kolor, 0.18));
      ctx.beginPath(); ctx.ellipse(c.x, c.y - hw, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── Układ świata ────────────────────────────────────────────────────────────
  /** Klocki na płytce: pola 2×1 i 1×1 w stałej kolejności, stosami po 3 — jak budowla z dzieł. */
  const MIEJSCA = [[0, 0, 2, 1], [3, 0, 1, 1], [4, 0, 2, 1], [0, 4, 1, 2], [5, 2, 1, 2], [0, 2, 1, 1], [4, 4, 2, 1], [2, 5, 2, 1]];
  function ulozKlocki(lista) {
    return lista.map((k, i) => {
      const [mx, my, w, d] = MIEJSCA[i % MIEJSCA.length];
      return { k, x: mx, y: my, w, d, z: 1 + Math.floor(i / MIEJSCA.length) };
    });
  }

  function zbudujPlytki() {
    const gatunki = (swiat?.gatunki ?? []).slice().sort((a, b) => Number(b.wyklute) - Number(a.wyklute) || b.xp - a.xp);
    const kol = Math.max(1, Math.ceil(Math.sqrt(gatunki.length)));
    plytki = gatunki.map((g, i) => {
      const a = swiat?.agenci?.[g.id] ?? { klocki: [], razem: 0, slady: [] };
      return {
        g, x: (i % kol) * (P + ODSTEP), y: Math.floor(i / kol) * (P + ODSTEP),
        klocki: g.wyklute ? ulozKlocki(a.klocki) : [], razem: a.razem, kolor: hexNaRgb(g.kolor),
      };
    });
    // Kamera na środek świata przy pierwszym ułożeniu.
    if (plytki.length && !zbudujPlytki.bylo) {
      const maxX = Math.max(...plytki.map((p) => p.x)) + P, maxY = Math.max(...plytki.map((p) => p.y)) + P;
      const srodek = iso(maxX / 2, maxY / 2);
      kam.x = -srodek.x; kam.y = -srodek.y;
      const szer = (maxX + maxY) * TW / 2, wys = (maxX + maxY) * TH / 2 + 80;
      kam.s = Math.max(0.45, Math.min(1.6, Math.min(W / (szer + 40), (H * 0.8) / (wys + 40))));
      zbudujPlytki.bylo = true;
    }
  }

  // ── Rysowanie ───────────────────────────────────────────────────────────────
  function rysuj() {
    if (tryb === '3d') return;   // scenę rysuje wtedy swiat3d.js na własnym płótnie
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d1320'; ctx.fillRect(0, 0, W, H);
    const teraz = performance.now();
    // Malarz: płytki od tyłu (mniejsze x+y) do przodu. Podpisy i dymki w drugim przejściu —
    // inaczej płytka z przodu zasłania podpis płytki za nią.
    const naWierzch = [];
    for (const pl of plytki.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y))) {
      const wyk = pl.g.wyklute;
      const baza = wyk ? jasniej(pl.kolor, 0.1) : [70, 78, 96];
      prostopadloscian(pl.x, pl.y, 0, P, P, 1, ciemniej(baza, 0.35), true);
      for (const b of pl.klocki.slice().sort((a, c) => (a.x + a.y) - (c.x + c.y) || a.z - c.z)) {
        prostopadloscian(pl.x + b.x, pl.y + b.y, b.z, b.w, b.d, 1, kolorKlocka(pl.kolor, b.k.rodzaj), true);
      }
      // Figurka: postument 1×1 na środku + forma (emoji z Katedry), podskok przy zdarzeniu.
      const dymek = dymki.get(pl.g.id);
      const skok = dymek ? Math.max(0, Math.sin(Math.min(1, (teraz - dymek.od) / 600) * Math.PI)) * 14 : 0;
      prostopadloscian(pl.x + 2.5, pl.y + 2.5, 1, 1, 1, wyk ? 2 : 1, wyk ? pl.kolor : [110, 118, 136], false);
      const glowa = naEkran(iso(pl.x + 3, pl.y + 3, wyk ? 3 : 2));
      ctx.font = `${Math.round((wyk ? 30 : 22) * kam.s)}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.globalAlpha = wyk ? 1 : 0.55;
      ctx.fillText(pl.g.forma || '🥚', glowa.x, glowa.y - skok * kam.s);
      ctx.globalAlpha = 1;
      naWierzch.push({ pl, wyk, glowa, dymek, skok });
    }
    for (const { pl, wyk } of naWierzch) {
      // Podpis pod przednim rogiem płytki, na ciemnej podkładce — czytelny nad sąsiadami.
      const pod = naEkran(iso(pl.x + P, pl.y + P, 0));
      const l1 = pl.g.imie, l2 = wyk ? `${pl.g.etap} · ${pl.razem} ${dziel(pl.razem)}` : 'w jaju';
      const f1 = Math.max(10, Math.round(13 * kam.s)), f2 = Math.max(9, Math.round(11 * kam.s));
      ctx.font = `600 ${f1}px ui-rounded, system-ui, sans-serif`;
      const szer = Math.max(ctx.measureText(l1).width, (ctx.font = `${f2}px ui-rounded, system-ui, sans-serif`, ctx.measureText(l2).width)) + 14;
      ctx.fillStyle = 'rgba(13,19,32,0.82)';
      ctx.beginPath(); ctx.roundRect(pod.x - szer / 2, pod.y + 4 * kam.s, szer, f1 + f2 + 10, 7); ctx.fill();
      ctx.textBaseline = 'top';
      ctx.font = `600 ${f1}px ui-rounded, system-ui, sans-serif`;
      ctx.fillStyle = wyk ? '#eef1f6' : '#93a0b8';
      ctx.fillText(l1, pod.x, pod.y + 7 * kam.s);
      ctx.font = `${f2}px ui-rounded, system-ui, sans-serif`;
      ctx.fillStyle = '#93a0b8';
      ctx.fillText(l2, pod.x, pod.y + 7 * kam.s + f1 + 2);
    }
    for (const { pl, glowa, dymek, skok } of naWierzch) {
      if (dymek) rysujDymek(glowa.x, glowa.y - (40 + skok) * kam.s, dymek.tekst, pl.kolor);
    }
  }

  function rysujDymek(x, y, tekst, kolor) {
    const t = tekst.length > 64 ? `${tekst.slice(0, 63)}…` : tekst;
    ctx.font = '13px ui-rounded, system-ui, sans-serif';
    const szer = Math.min(W - 24, ctx.measureText(t).width + 20), wys = 28;
    const lx = Math.max(12, Math.min(W - 12 - szer, x - szer / 2));
    ctx.fillStyle = 'rgba(21,29,46,0.95)'; ctx.strokeStyle = rgb(kolor);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(lx, y - wys, szer, wys, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#eef1f6'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.beginPath(); ctx.rect(lx + 8, y - wys, szer - 16, wys); ctx.clip();
    ctx.fillText(t, lx + 10, y - wys / 2); ctx.restore();
    ctx.textAlign = 'center';
  }

  // Pętla tylko wtedy, gdy coś się rusza (dymki) — telefon nie grzeje się na pustej scenie.
  let petla = 0;
  function animuj() {
    const teraz = performance.now();
    for (const [id, d] of dymki) if (teraz - d.od > 7000) dymki.delete(id);
    rysuj();
    petla = dymki.size ? requestAnimationFrame(animuj) : 0;
  }
  const obudz = () => { if (!petla) petla = requestAnimationFrame(animuj); };

  // ── Dotyk: przesuwanie, powiększanie, stuknięcie w płytkę ──────────────────
  const wskazniki = new Map();
  let ruch = 0, szczypanie = null;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); wskazniki.set(e.pointerId, { x: e.clientX, y: e.clientY }); ruch = 0; cv.classList.add('ciagnie'); });
  cv.addEventListener('pointermove', (e) => {
    const p = wskazniki.get(e.pointerId); if (!p) return;
    if (wskazniki.size === 2) {
      const [a, b] = [...wskazniki.values()];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (szczypanie !== null && d0 > 0) kam.s = Math.max(0.35, Math.min(2.5, kam.s * d1 / d0));
      szczypanie = d1; ruch += 10; rysuj(); return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY; ruch += Math.abs(dx) + Math.abs(dy);
    kam.x += dx / kam.s; kam.y += dy / kam.s; rysuj();
  });
  const koniec = (e) => {
    const bylo = wskazniki.size; wskazniki.delete(e.pointerId); szczypanie = null;
    if (!wskazniki.size) cv.classList.remove('ciagnie');
    if (bylo === 1 && ruch < 8 && e.type === 'pointerup') stuknij(e.clientX, e.clientY);
  };
  cv.addEventListener('pointerup', koniec); cv.addEventListener('pointercancel', koniec);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); kam.s = Math.max(0.35, Math.min(2.5, kam.s * (e.deltaY < 0 ? 1.1 : 0.9))); rysuj(); }, { passive: false });

  /** Która płytka jest pod palcem: odwracamy rzut na płaszczyznę z=0 (i łapiemy też figurkę nad nią). */
  function stuknij(sx, sy) {
    for (const zOff of [0, 1.5, 3]) {
      const px = (sx - W / 2) / kam.s - kam.x, py = (sy - H * 0.42) / kam.s - kam.y + zOff * BH;
      const gx = (px / (TW / 2) + py / (TH / 2)) / 2, gy = (py / (TH / 2) - px / (TW / 2)) / 2;
      const pl = plytki.slice().reverse().find((p) => gx >= p.x && gx < p.x + P && gy >= p.y && gy < p.y + P);
      if (pl) { otworzKatalog(pl.g.id); return; }
    }
  }

  // ── Katalog ─────────────────────────────────────────────────────────────────
  function otworzKatalog(id) {
    otwarty = id;
    const pl = plytki.find((p) => p.g.id === id);
    if (!pl) return;
    const g = pl.g, a = swiat?.agenci?.[id] ?? { klocki: [], slady: [], razem: 0 };
    const kat = $('katalog');
    kat.style.setProperty('--akcent', rgb(pl.kolor));
    kat.style.setProperty('--akcent-tlo', rgb(pl.kolor, 0.16));
    const klocki = a.klocki ?? [];
    $('katalog-tresc').innerHTML = `
      <div class="glowa">
        <div class="forma">${esc(g.forma || '🥚')}</div>
        <div><h2>${esc(g.imie)}</h2>
          <div class="meta">${esc(g.dziedzina)} · ${esc(g.etap)} · ${g.xp} XP${g.wyklute ? '' : ' · jeszcze w jaju'}</div></div>
      </div>
      <p class="teraz">${g.robi ? `<b>Ostatnio:</b> ${esc(g.robi)}${g.robiOd ? ` <span class="meta">· ${ileTemu(g.robiOd)}</span>` : ''}` : 'Cisza — brak śladu na szynie.'}</p>
      <h3>Dzieła${a.razem ? ` · ${a.razem}` : ''}${a.razem > klocki.length ? ` (najnowsze ${klocki.length})` : ''}</h3>
      ${klocki.length ? `<div class="klocki" id="klocki">${klocki.map((k, i) => `
        <button class="klocek" data-i="${i}">
          <div class="miniatura">${k.media?.typ === 'obraz' ? `<img loading="lazy" alt="" src="${esc(zKluczem(k.media.url))}" onerror="this.replaceWith(document.createTextNode('${IKONY[k.rodzaj] || '🧱'}'))">` : (IKONY[k.rodzaj] || '🧱')}</div>
          <div class="opis"><div class="tytul">${esc(k.tytul)}</div><div class="rodzaj">${esc(NAZWY[k.rodzaj] || k.rodzaj)}${k.kiedy ? ` · ${esc(kiedyTekst(k.kiedy))}` : ''}</div></div>
        </button>`).join('')}</div>` : `<p class="cisza">${g.wyklute ? 'Jeszcze żadnego dzieła na dysku Katedry.' : 'Najpierw musi się wykluć.'}</p>`}
      <h3>Ślady na szynie</h3>
      ${(a.slady ?? []).length ? `<ul class="slady">${a.slady.map((s) => `<li><time>${esc(kiedyTekst(s.kiedy))} · ${esc(s.rodzaj)}</time>${esc(s.tresc)}</li>`).join('')}</ul>` : '<p class="cisza">Nic nie zameldował.</p>'}`;
    kat.hidden = false;
    for (const f of rozszerzenia) { try { f(g, $('katalog-tresc'), a); } catch (e) { console.error('[Świat] panel:', e); } }
    $('klocki')?.addEventListener('click', (e) => {
      const b = e.target.closest('.klocek'); if (!b) return;
      pokazKlocek(klocki[Number(b.dataset.i)], b);
    });
  }

  function pokazKlocek(k, przycisk) {
    document.querySelector('.podglad')?.remove();
    const d = document.createElement('div');
    d.className = 'podglad';
    const m = k.media ? zKluczem(k.media.url) : null;
    // Przy bryle 3D pokazujemy samą bryłę (niżej), nie miniaturę — a zepsuty obrazek po prostu znika.
    d.innerHTML = `${m && k.media.typ === 'obraz' && !(k.model && window.SwiatKatedry.podglad3d) ? `<img alt="${esc(k.tytul)}" src="${esc(m)}" onerror="this.remove()">` : ''}
      ${m && k.media.typ === 'audio' ? `<audio controls preload="none" src="${esc(m)}"></audio>` : ''}
      ${m && k.media.typ === 'wideo' ? `<video controls preload="metadata" playsinline src="${esc(m)}"></video>` : ''}
      ${k.rodzaj === 'wklad' ? `<p><b>${esc(k.tytul)}</b>${k.silnik ? ` <span class="meta">· ${esc(k.silnik)}</span>` : ''}</p><div class="wklad">${esc(k.opis)}</div>`
        : `<p><b>${esc(k.tytul)}</b>${k.opis ? ` — ${esc(k.opis)}` : ''}</p>`}
      ${k.otworz ? `<p><a href="${esc(zKluczem(k.otworz))}" target="_blank" rel="noopener">Otwórz ${esc(NAZWY[k.rodzaj])} ↗</a>${k.iteracji ? ` · ${k.iteracji} iteracji Kodeksa` : ''}</p>` : ''}
      ${k.model ? `<div class="model3d"></div><p>${window.SwiatKatedry.podglad3d ? 'Bryła z modułu Assety3D (GLB) — obracaj palcem.' : 'Bryła z modułu Assety3D (GLB) — obejrzysz ją w trybie 3D.'}</p>` : ''}`;
    // Podgląd pod rzędem klikniętego klocka (siatka — wstawiamy za ostatnim w wierszu).
    const siatka = przycisk.parentElement, dzieci = [...siatka.children].filter((c) => c.classList.contains('klocek'));
    const top = przycisk.offsetTop;
    const ostatniWRzedzie = dzieci.filter((c) => c.offsetTop === top).pop() || przycisk;
    ostatniWRzedzie.after(d);
    const miejsce = d.querySelector('.model3d');
    if (miejsce && window.SwiatKatedry.podglad3d) window.SwiatKatedry.podglad3d(miejsce, zKluczem(k.model));
    else miejsce?.remove();
  }

  $('zamknij').addEventListener('click', () => { $('katalog').hidden = true; otwarty = null; });

  // ── Dane i strumień ─────────────────────────────────────────────────────────
  function podpisz() {
    const w = swiat?.migawka?.wiekSekund;
    const wyk = (swiat?.gatunki ?? []).filter((g) => g.wyklute).length;
    $('podpis').textContent = swiat?.migawka
      ? `${wyk} wyklutych · migawka stada ${ileTemu(Date.now() - w * 1000)}${swiat.urzadzenie ? ` · ${swiat.urzadzenie}` : ''}`
      : (swiat?.powod || 'Katedra jeszcze nic nie opublikowała.');
    const pusto = $('pusto');
    pusto.hidden = !!(swiat?.gatunki ?? []).length;
    pusto.textContent = swiat?.powod || 'Stado jest puste. Otwórz Dom TeOgochi w Katedrze.';
  }

  async function wczytaj() {
    try {
      const r = await fetch('/api/stado/swiat', { headers: naglowki });
      const d = await r.json();
      if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
      swiat = d; zbudujPlytki(); podpisz(); rysuj(); powiadom('dane');
      if (otwarty) otworzKatalog(otwarty);
    } catch (e) {
      $('podpis').textContent = `Most nie odpowiada: ${e.message}`;
    }
  }

  function zywo(tak) { const z = $('zywo'); z.textContent = tak ? '● na żywo' : '○ łączę…'; z.classList.toggle('tak', tak); }

  /** Tylko dymek i podskok — bez zmiany stanu (film klockowy odtwarza przeszłość). */
  function pokazDymek(z) {
    const kto = String(z.agent || '').toLowerCase();
    const pl = plytki.find((p) => p.g.imie.toLowerCase() === kto || p.g.id.toLowerCase() === kto);
    if (!pl) return false;
    const tekst = `${pl.g.imie}: ${z.tresc || z.rodzaj}`;
    dymki.set(pl.g.id, { tekst, od: performance.now() });
    obudz();
    powiadom('zdarzenie', pl.g.id, tekst);
    return true;
  }

  function naZdarzenie(z) {
    powiadom('szyna', z);
    const kto = String(z.agent || '').toLowerCase();
    const pl = plytki.find((p) => p.g.imie.toLowerCase() === kto || p.g.id.toLowerCase() === kto);
    if (!pl) return;
    pl.g.robi = z.tresc || z.rodzaj; pl.g.robiOd = Date.parse(z.kiedy || '') || Date.now();
    const a = (swiat.agenci[pl.g.id] ||= { klocki: [], razem: 0, slady: [] });
    a.slady = [{ kiedy: z.kiedy, rodzaj: z.rodzaj, tresc: z.tresc }, ...(a.slady ?? [])].slice(0, 15);
    dymki.set(pl.g.id, { tekst: `${pl.g.imie}: ${z.tresc || z.rodzaj}`, od: performance.now() });
    obudz();
    powiadom('zdarzenie', pl.g.id, `${pl.g.imie}: ${z.tresc || z.rodzaj}`);
    if (otwarty === pl.g.id) otworzKatalog(otwarty);
  }

  function strumien() {
    // Telefon: strumień stada (token). Hub lokalnie: szyna wprost (bez tokenu nie ma strumienia stada).
    const q = new URLSearchParams();
    if (TOKEN) q.set('token', TOKEN);
    if (KLUCZ) q.set('k', KLUCZ);
    const es = new EventSource(TOKEN ? `/api/stado/strumien?${q}` : `/api/szyna/strumien`);
    es.onopen = () => zywo(true);
    es.onerror = () => zywo(false);   // EventSource sam wznawia połączenie
    es.addEventListener('stan', (e) => { try { const s = JSON.parse(e.data); swiat = { ...swiat, ...s, agenci: swiat?.agenci ?? {} }; zbudujPlytki(); podpisz(); rysuj(); powiadom('dane'); } catch { /* zła ramka */ } });
    const zd = (e) => { try { naZdarzenie(JSON.parse(e.data)); } catch { /* zła ramka */ } };
    es.addEventListener('szyna', zd);
    if (!TOKEN) es.onmessage = zd;    // /api/szyna/strumien wysyła zwykłe `data:` bez nazwy zdarzenia
    es.addEventListener('rozparowany', () => { es.close(); zywo(false); $('podpis').textContent = 'Ten telefon został odłączony w Katedrze. Sparuj go od nowa.'; });
  }

  // ── Tryb 2D / 3D ────────────────────────────────────────────────────────────
  window.SwiatKatedry = {
    get dane() { return swiat; },
    get plytki() { return plytki; },
    zKluczem, esc, otworzKatalog, naglowki, pokazDymek, ileTemu, kiedyTekst,
    odswiez: () => wczytaj(),
    rozszerzKatalog: (fn) => rozszerzenia.add(fn),
    /** Własna treść w szufladzie katalogu (projekty, film…). */
    pokazPanel: (html) => { otwarty = null; $('katalog-tresc').innerHTML = html; $('katalog').hidden = false; $('katalog').style.setProperty('--akcent', '#f4c84a'); $('katalog').style.setProperty('--akcent-tlo', 'rgba(244,200,74,0.14)'); return $('katalog-tresc'); },
    sluchaj: (fn) => { sluchacze.add(fn); return () => sluchacze.delete(fn); },
    podglad3d: null,   // swiat3d.js wstawia tu przeglądarkę pojedynczej bryły (katalog)
  };
  const przycisk = $('tryb');
  let modul3d = null;
  async function ustawTryb(nowy) {
    if (nowy === '3d') {
      try {
        modul3d ||= await import('./swiat3d.js').then((m) => m.start(window.SwiatKatedry));
        document.body.dataset.tryb = '3d';   // płótno 3D musi być widoczne, ZANIM policzy swój rozmiar
        modul3d.wlacz();
      } catch (e) {
        console.error('[Świat] 3D niedostępne:', e);
        $('podpis').textContent = `Tryb 3D niedostępny na tym urządzeniu (${e.message}). Zostaję w 2D.`;
        nowy = '2d';
      }
    } else modul3d?.wylacz();
    tryb = nowy;
    document.body.dataset.tryb = tryb;
    przycisk.textContent = tryb === '3d' ? '2D' : '3D';
    przycisk.setAttribute('aria-label', tryb === '3d' ? 'Przełącz na płaski widok 2D' : 'Przełącz na widok 3D');
    try { localStorage.setItem('swiat_tryb', tryb); } catch { /* bez pamięci wyboru */ }
    rysuj();
  }
  przycisk.addEventListener('click', () => ustawTryb(tryb === '3d' ? '2d' : '3d'));
  const maWebGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  let zapamietany = null;
  try { zapamietany = localStorage.getItem('swiat_tryb'); } catch { /* prywatne okno */ }
  const startowy = new URLSearchParams(location.hash.slice(1)).get('tryb') || zapamietany || (maWebGL ? '3d' : '2d');

  window.addEventListener('resize', rozmiar);
  rozmiar();
  ustawTryb(startowy === '3d' && maWebGL ? '3d' : '2d');
  wczytaj().then(strumien);
  setInterval(wczytaj, 120_000);   // nowe dzieła na dysku (klocki) — rzadko; zdarzenia i tak lecą strumieniem
})();
