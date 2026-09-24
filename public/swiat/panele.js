/**
 * 🧩🎬🗣️🧊 Panele Świata Katedry — to, co się dzieje, gdy Suweren nie tylko patrzy:
 *
 *  · ROZMOWA   — w katalogu każdego TeOgochi: Delegat z jego kartą roli (POST /api/delegat/rozmowa, SSE).
 *  · SILNIK    — na jakim modelu pracuje; na maszynie Suwerena można go zmienić (POST /api/stado/model).
 *  · PROJEKTY  — wspólna praca stada nad wizją Suwerena (uniwersum: film, gra, moda, muzyka, merch).
 *  · FILM      — „film klockowy": odtworzenie dnia z szyny jako dymki nad płytkami.
 *  · RZEŹBA    — nowy klocek 3D z Assety3D (opis → bryła GLB na płytce Palety), tylko na maszynie.
 *
 * Zmiany (projekt, silnik, rzeźba) są tylko na maszynie Suwerena — Straż Mostu i tak odrzuci
 * je z telefonu; przyciski się wtedy nie pokazują zamiast udawać, że zadziałają.
 */
(() => {
  'use strict';
  const S = window.SwiatKatedry;
  const $ = (id) => document.getElementById(id);
  const esc = S.esc;
  const lokalne = () => !!S.dane?.lokalne;
  const json = (body) => ({ method: 'POST', headers: { ...S.naglowki, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const STAN = { czeka: '○', trwa: '◐', gotowe: '●', blad: '✕' };

  // ── Rozmowa + silnik + rzeźba: sekcje w katalogu agenta ────────────────────
  const rozmowy = new Map();   // id gatunku → { rozmowaId, tury: [{kto, tresc}] }
  let modeleLokalne = null;

  async function listaModeli() {
    if (modeleLokalne) return modeleLokalne;
    try {
      const d = await fetch('/api/ollama/models', { headers: S.naglowki }).then((r) => r.json());
      modeleLokalne = (d.models ?? d.modele ?? []).map((m) => (typeof m === 'string' ? m : m.name)).filter(Boolean);
    } catch { modeleLokalne = []; }
    return modeleLokalne;
  }

  S.rozszerzKatalog((g, kontener) => {
    const d = S.dane ?? {};
    const silnik = d.modele?.[g.id] || d.domyslnyModel || 'domyślny';
    const s = document.createElement('div');
    const r = rozmowy.get(g.id) ?? { rozmowaId: null, tury: [] };
    s.innerHTML = `
      <div class="sekcja">
        <h3>Silnik</h3>
        <p class="meta">${esc(g.imie)} myśli na: <b>${esc(silnik)}</b>${d.modele?.[g.id] ? '' : ' (domyślny Katedry)'}</p>
        ${lokalne() ? `<select id="silnik" aria-label="Model dla ${esc(g.imie)}"><option value="">— domyślny (${esc(d.domyslnyModel || '')}) —</option></select>` : ''}
      </div>
      ${g.wyklute ? `<div class="sekcja">
        <h3>Porozmawiaj z ${esc(g.imie)}</h3>
        <div id="rozmowa">${r.tury.map((t) => `<div class="odpowiedz ${t.kto}">${esc(t.tresc)}</div>`).join('')}</div>
        <textarea id="pytanie" placeholder="Napisz do ${esc(g.imie)}…"></textarea>
        <button class="guzik" id="wyslij" type="button">Wyślij</button>
      </div>` : ''}
      ${g.id === 'paleta' && lokalne() ? `<div class="sekcja">
        <h3>🧊 Wyrzeźbij nowy klocek</h3>
        <p class="meta">Opis → Assety3D (FLUX.2 → TRELLIS.2) → bryła GLB stanie na tej płytce. Kilka minut pracy karty graficznej.</p>
        <input type="text" id="rzezba" placeholder="np. tron z kości słoniowej ze złotymi okuciami">
        <button class="guzik" id="rzezbij" type="button">Wyrzeźbij</button>
        <p class="meta" id="rzezba-stan"></p>
      </div>` : ''}`;
    kontener.appendChild(s);

    if (lokalne()) {
      listaModeli().then((lista) => {
        const sel = s.querySelector('#silnik'); if (!sel) return;
        for (const m of [...new Set([...lista, d.modele?.[g.id]].filter(Boolean))]) sel.add(new Option(m, m, false, m === d.modele?.[g.id]));
        sel.addEventListener('change', async () => {
          const w = await fetch('/api/stado/model', json({ agent: g.id, model: sel.value })).then((x) => x.json()).catch((e) => ({ message: e.message }));
          if (w.success) { S.dane.modele = w.modele; s.querySelector('.meta b').textContent = sel.value || w.domyslnyModel; }
          else alertNaStronie(s, w.message || 'Nie udało się zmienić modelu.');
        });
      });
    }
    s.querySelector('#wyslij')?.addEventListener('click', () => rozmawiaj(g, s, r));
    s.querySelector('#rzezbij')?.addEventListener('click', () => rzezbij(s.querySelector('#rzezba').value, s.querySelector('#rzezba-stan')));
  });

  function alertNaStronie(kontener, tekst) {
    const p = document.createElement('p'); p.className = 'meta'; p.style.color = 'var(--blad)'; p.textContent = tekst;
    kontener.appendChild(p);
  }

  async function rozmawiaj(g, s, r) {
    const pole = s.querySelector('#pytanie'), guzik = s.querySelector('#wyslij'), okno = s.querySelector('#rozmowa');
    const tekst = pole.value.trim(); if (!tekst) return;
    pole.value = ''; guzik.disabled = true;
    r.tury.push({ kto: 'suweren', tresc: tekst });
    okno.insertAdjacentHTML('beforeend', `<div class="odpowiedz suweren">${esc(tekst)}</div><div class="odpowiedz">…</div>`);
    const odp = okno.lastElementChild;
    let calosc = '';
    try {
      const res = await fetch('/api/delegat/rozmowa', json({ delegat: g.id, tekst, rozmowaId: r.rozmowaId, strumien: true }));
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).message || `HTTP ${res.status}`);
      const czytnik = res.body.getReader(), dek = new TextDecoder();
      let bufor = '';
      for (;;) {
        const { value, done } = await czytnik.read(); if (done) break;
        bufor += dek.decode(value, { stream: true });
        let i;
        while ((i = bufor.indexOf('\n\n')) >= 0) {
          const ramka = bufor.slice(0, i); bufor = bufor.slice(i + 2);
          const dane = ramka.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
          if (!dane) continue;
          const z = JSON.parse(dane);
          if (z.typ === 'token') { calosc += z.tekst ?? z.token ?? ''; odp.textContent = calosc; }
          else if (z.typ === 'narzedzie') odp.textContent = `${calosc}\n⚙️ ${z.narzedzie}…`;
          else if (z.typ === 'koniec') { calosc = z.odpowiedz ?? calosc; r.rozmowaId = z.rozmowaId ?? r.rozmowaId; odp.textContent = calosc; }
          else if (z.typ === 'blad') throw new Error(z.message);
        }
      }
      r.tury.push({ kto: '', tresc: calosc || '(cisza)' });
    } catch (e) {
      odp.textContent = `⚠️ ${e.message}`;
      r.tury.push({ kto: '', tresc: `⚠️ ${e.message}` });
    } finally {
      rozmowy.set(g.id, r); guzik.disabled = false;
    }
  }

  async function rzezbij(opis, stan) {
    const tekst = String(opis || '').trim(); if (!tekst) return;
    stan.textContent = 'Zlecam Assety3D…';
    const w = await fetch('/api/assety3d/generuj', json({ tekst, nazwa: tekst.slice(0, 40) })).then((r) => r.json()).catch((e) => ({ message: e.message }));
    stan.textContent = w.success
      ? `Zlecone (${w.zadanie?.id ?? w.id ?? 'zadanie'}). Bryła stanie na płytce Palety, gdy TRELLIS.2 skończy — śledź dymki.`
      : `Assety3D odmówił: ${w.message}`;
  }

  // ── Projekty stada ─────────────────────────────────────────────────────────
  let panelProjektow = false, otwartyProjekt = null;

  function krokiHtml(p) {
    return `<div class="kroki">${p.kroki.map((k) => `<span class="krok ${k.stan}" title="${esc(k.zadanie)}">${STAN[k.stan] || ''} ${esc(k.imie)}${k.fala === 4 ? ' · scala' : ''}</span>`).join('')}</div>`;
  }

  async function pokazProjekty() {
    panelProjektow = true; otwartyProjekt = null;
    let lista = S.dane?.projekty ?? [];
    try { lista = (await fetch('/api/stado/projekty', { headers: S.naglowki }).then((r) => r.json())).projekty ?? lista; } catch { /* zostaje to, co w świecie */ }
    const wyklute = (S.dane?.gatunki ?? []).filter((g) => g.wyklute);
    const k = S.pokazPanel(`
      <div class="glowa"><div class="forma">🧩</div><div><h2>Wspólne projekty stada</h2>
        <div class="meta">Każdy TeOgochi wnosi swoją dziedzinę, na swoim modelu. Na końcu scalenie w Biblię projektu.</div></div></div>
      ${lokalne() ? `<div class="sekcja">
        <h3>Nowy projekt</h3>
        <input type="text" id="p-nazwa" placeholder="Nazwa, np. Uniwersum Teterhia">
        <textarea id="p-wizja" placeholder="Twoja wizja: świat, klimat, co ma powstać — film, gra, moda, muzyka, merch…"></textarea>
        <div class="uczestnicy">${wyklute.map((g) => `<label><input type="checkbox" value="${esc(g.id)}" checked> ${esc(g.forma)} ${esc(g.imie)}</label>`).join('') || '<span class="meta">Najpierw musi się ktoś wykluć.</span>'}</div>
        <button class="guzik" id="p-start" type="button" ${wyklute.length < 2 ? 'disabled' : ''}>Zacznijcie razem</button>
        <p class="meta" id="p-stan"></p>
      </div>` : '<p class="meta">Nowy projekt zakłada się przy Katedrze — tu widać postęp.</p>'}
      <h3>Projekty</h3>
      <div class="sekcja">${lista.length ? lista.map((p) => `<button class="projekt" data-id="${esc(p.id)}"><b>${esc(p.nazwa)}</b> <span class="meta">· ${p.gotowe}/${p.razem} · ${esc(p.stan)}</span>${krokiHtml(p)}</button>`).join('') : '<p class="cisza">Jeszcze żadnego.</p>'}</div>`);
    k.querySelectorAll('.projekt').forEach((b) => b.addEventListener('click', () => pokazProjekt(b.dataset.id)));
    k.querySelector('#p-start')?.addEventListener('click', async () => {
      const uczestnicy = [...k.querySelectorAll('.uczestnicy input:checked')].map((i) => i.value);
      const st = k.querySelector('#p-stan');
      const w = await fetch('/api/stado/projekt/nowy', json({ nazwa: k.querySelector('#p-nazwa').value, wizja: k.querySelector('#p-wizja').value, uczestnicy }))
        .then((r) => r.json()).catch((e) => ({ message: e.message }));
      if (!w.success) { st.textContent = `⚠️ ${w.message}`; return; }
      pokazProjekt(w.projekt.id);
    });
  }

  async function pokazProjekt(id) {
    panelProjektow = true; otwartyProjekt = id;
    const d = await fetch(`/api/stado/projekty/${encodeURIComponent(id)}`, { headers: S.naglowki }).then((r) => r.json()).catch(() => null);
    if (!d?.success) { S.pokazPanel(`<p class="cisza">Nie udało się wczytać projektu.</p>`); return; }
    const p = d.projekt;
    const k = S.pokazPanel(`
      <div class="glowa"><div class="forma">🧩</div><div><h2>${esc(p.nazwa)}</h2>
        <div class="meta">${esc(p.stan)} · od ${esc(S.kiedyTekst(p.od))}</div></div></div>
      <p class="teraz">${esc(p.wizja)}</p>
      ${krokiHtml(p)}
      ${p.kroki.map((kr) => `<div class="sekcja"><h3>${STAN[kr.stan] || ''} ${esc(kr.imie)} · ${esc(kr.zadanie.split(':')[0])} <span class="meta">· ${esc(kr.model)}</span></h3>
        ${kr.wklad ? `<div class="wklad">${esc(kr.wklad)}</div>` : kr.stan === 'blad' ? `<p class="meta" style="color:var(--blad)">${esc(kr.blad || 'błąd')}</p>` : `<p class="cisza">${kr.stan === 'trwa' ? 'Pracuje…' : 'Czeka na swoją kolej.'}</p>`}</div>`).join('')}
      ${d.obiekty3d?.length ? `<div class="sekcja"><h3>🧊 Obiekty Palety do wyrzeźbienia</h3>
        ${d.obiekty3d.map((o, i) => `<div><span>${esc(o)}</span> ${lokalne() ? `<button class="guzik maly" data-o="${i}" type="button">Wyrzeźbij</button>` : ''}</div>`).join('')}
        <p class="meta" id="o-stan"></p></div>` : ''}
      <button class="guzik maly" id="p-wstecz" type="button">← Wszystkie projekty</button>`);
    k.querySelector('#p-wstecz').addEventListener('click', pokazProjekty);
    k.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => rzezbij(d.obiekty3d[Number(b.dataset.o)], k.querySelector('#o-stan'))));
  }

  $('projekty').addEventListener('click', pokazProjekty);
  $('zamknij').addEventListener('click', () => { panelProjektow = false; otwartyProjekt = null; });

  // Projekt idzie naprzód → odśwież otwarty panel i klocki (nowy wkład = nowy klocek).
  let odswiezanie = 0;
  S.sluchaj((co, z) => {
    if (co !== 'szyna' || z?.rodzaj !== 'projekt') return;
    clearTimeout(odswiezanie);
    odswiezanie = setTimeout(() => {
      S.odswiez();
      if (panelProjektow && !$('katalog').hidden) (otwartyProjekt ? pokazProjekt(otwartyProjekt) : pokazProjekty());
    }, 400);
  });

  // ── Film klockowy ──────────────────────────────────────────────────────────
  const tasma = $('tasma'), graj = $('tasma-graj'), postep = $('tasma-postep'), czas = $('tasma-czas'), dzien = $('tasma-dzien');
  let klatki = [], i = 0, zegar = 0, gra = false;

  async function wczytajFilm() {
    stop(); czas.textContent = 'Wczytuję dzień…';
    const d = await fetch(`/api/stado/film?dzien=${encodeURIComponent(dzien.value)}`, { headers: S.naglowki }).then((r) => r.json()).catch(() => null);
    const znani = new Set((S.dane?.gatunki ?? []).flatMap((g) => [g.imie.toLowerCase(), g.id]));
    klatki = (d?.zdarzenia ?? []).filter((z) => znani.has(String(z.agent).toLowerCase()));
    i = 0; postep.max = String(Math.max(0, klatki.length - 1)); postep.value = '0';
    czas.textContent = klatki.length ? `${klatki.length} scen` : 'Tego dnia stado milczało.';
  }
  function scena() {
    const z = klatki[i]; if (!z) return;
    S.pokazDymek(z);
    postep.value = String(i);
    czas.textContent = `${new Date(z.kiedy).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} · ${i + 1}/${klatki.length}`;
  }
  function krok() {
    if (!gra) return;
    scena();
    const teraz = Date.parse(klatki[i]?.kiedy), dalej = Date.parse(klatki[i + 1]?.kiedy);
    i++;
    if (i >= klatki.length) { stop(); return; }
    // Czas dnia ściśnięty: przerwa między scenami ∝ realnej, ale 0,7–2,5 s — żeby film się oglądało.
    const przerwa = Math.min(2500, Math.max(700, (dalej - teraz) / 120));
    zegar = setTimeout(krok, Number.isFinite(przerwa) ? przerwa : 1200);
  }
  function stop() { gra = false; clearTimeout(zegar); graj.textContent = '▶'; graj.setAttribute('aria-label', 'Odtwarzaj'); }
  graj.addEventListener('click', () => {
    if (gra) return stop();
    if (!klatki.length) return;
    if (i >= klatki.length) i = 0;
    gra = true; graj.textContent = '⏸'; graj.setAttribute('aria-label', 'Pauza'); krok();
  });
  postep.addEventListener('input', () => { i = Number(postep.value); scena(); });
  dzien.addEventListener('change', wczytajFilm);
  $('film').addEventListener('click', () => {
    if (!tasma.hidden) { stop(); tasma.hidden = true; return; }
    dzien.value ||= new Date().toISOString().slice(0, 10);
    tasma.hidden = false; wczytajFilm();
  });
  $('tasma-zamknij').addEventListener('click', () => { stop(); tasma.hidden = true; });
})();
