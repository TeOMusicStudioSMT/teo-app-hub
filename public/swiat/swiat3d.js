/**
 * 🧊 Świat Katedry w 3D — ta sama scena co 2D (swiat.js), tylko prawdziwa bryła.
 *
 * three.js 0.170 z mostu (node_modules/three → /swiat/three/, jak Games Studio) — bez CDN.
 * Płytki LEGO z wypustkami, klocek za każde dzieło TeOgochi, a MODELE 3D z modułu Assety3D
 * (TRELLIS.2 → GLB) stoją na płytce Palety jako prawdziwe bryły — klocki generowane przez
 * moduły Katedry. Palcem: obrót, szczypanie: zoom, dwoma palcami: przesunięcie.
 * Stuknięcie w płytkę, figurkę albo klocek otwiera katalog (ten sam co w 2D).
 *
 * Rysujemy tylko wtedy, gdy coś się zmienia (ruch kamery, podskok, dymek) — telefon nie grzeje się.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const P = 6;                 // płytka 6×6 wypustek
const ODSTEP = 3;
const WYS_PLYTKI = 0.4;
const WYS_KLOCKA = 1.2;
/** Pola na klocki (jak w 2D): [x, z, szer, gł]; kolejne warstwy idą w górę. */
const MIEJSCA = [[0, 0, 2, 1], [3, 0, 1, 1], [4, 0, 2, 1], [0, 4, 1, 2], [5, 2, 1, 2], [0, 2, 1, 1], [4, 4, 2, 1], [2, 5, 2, 1]];
/** Pola na bryły GLB (większe, 2×2) — żeby model nie wchodził w figurkę na środku. */
const MIEJSCA_BRYL = [[0.2, 0.2], [3.8, 0.2], [0.2, 3.8], [3.8, 3.8]];
const ODCIEN = { utwor: 0, film: 0.15, odcinek: -0.2, kreacja: 0.25, apka: 0, gra: -0.25, model3d: 0.3, chip: 0.1, print: -0.1, wklad: 0.4 };

const loader = new GLTFLoader();
const pamiecGlb = new Map();   // url → Promise<THREE.Group>

function wczytajGlb(url) {
  if (!pamiecGlb.has(url)) pamiecGlb.set(url, loader.loadAsync(url).then((g) => g.scene));
  return pamiecGlb.get(url).then((s) => s.clone(true));
}

/** Bryła dopasowana do pudełka `rozmiar` i postawiona na y=0, środkiem w (0,0). */
function dopasuj(obiekt, rozmiar) {
  const box = new THREE.Box3().setFromObject(obiekt);
  const wym = box.getSize(new THREE.Vector3());
  const s = rozmiar / Math.max(wym.x, wym.y, wym.z, 1e-6);
  obiekt.scale.multiplyScalar(s);
  box.setFromObject(obiekt);
  const c = box.getCenter(new THREE.Vector3());
  obiekt.position.x -= c.x; obiekt.position.z -= c.z; obiekt.position.y -= box.min.y;
  obiekt.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.zGlb = true; } });
  return obiekt;
}

function kolorKlocka(baza, rodzaj) {
  const f = ODCIEN[rodzaj] ?? 0;
  const c = baza.clone();
  return f >= 0 ? c.lerp(new THREE.Color(1, 1, 1), f) : c.lerp(new THREE.Color(0, 0, 0), -f);
}

/**
 * Sprite z tekstem (emoji formy albo podpis) — CanvasTexture, ostry na ekranach retina.
 * `wysokosc` = wysokość jednej linii w jednostkach świata (kratka płytki = 1).
 */
function napis(tekst, { rozmiar = 64, wysokosc = 0.6, kolor = '#eef1f6', tlo = null, szer = null, pogrub = false } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `${pogrub ? '600 ' : ''}${rozmiar}px ui-rounded, system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.font = font;
  const linie = String(tekst).split('\n');
  const w = Math.ceil(szer ?? Math.max(...linie.map((l) => ctx.measureText(l).width)) + rozmiar * 0.6);
  const h = Math.ceil(rozmiar * 1.3 * linie.length + rozmiar * 0.3);
  c.width = w; c.height = h;
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (tlo) { ctx.fillStyle = tlo; ctx.beginPath(); ctx.roundRect(0, 0, w, h, rozmiar * 0.35); ctx.fill(); }
  linie.forEach((l, i) => {
    ctx.fillStyle = i === 0 ? kolor : '#93a0b8';
    if (i > 0) ctx.font = `${Math.round(rozmiar * 0.8)}px ui-rounded, system-ui, sans-serif`;
    ctx.fillText(l, w / 2, rozmiar * 0.15 + rozmiar * 1.3 * (i + 0.5));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  const skala = wysokosc / (rozmiar * 1.3);
  sp.scale.set(w * skala, h * skala, 1);
  sp.userData.dispose = () => { tex.dispose(); sp.material.dispose(); };
  return sp;
}

export function start(api) {
  const cv = document.getElementById('scena3d');
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scena = new THREE.Scene();
  scena.background = new THREE.Color('#0d1320');
  scena.fog = new THREE.Fog('#0d1320', 60, 140);
  const kamera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  const sterowanie = new OrbitControls(kamera, cv);
  sterowanie.enableDamping = true;
  sterowanie.maxPolarAngle = Math.PI * 0.46;   // nie schodzimy pod podłogę
  sterowanie.minDistance = 6; sterowanie.maxDistance = 120;

  scena.add(new THREE.HemisphereLight('#dbe7ff', '#1a2233', 1.1));
  const slonce = new THREE.DirectionalLight('#fff4e0', 1.6);
  slonce.position.set(20, 35, 15);
  slonce.castShadow = true;
  slonce.shadow.mapSize.set(1024, 1024);
  Object.assign(slonce.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
  scena.add(slonce);
  const podloga = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#10182a', roughness: 1 }));
  podloga.rotation.x = -Math.PI / 2; podloga.position.y = -0.01; podloga.receiveShadow = true;
  scena.add(podloga);

  // Wspólne geometrie: wypustka i klocki — jedna na rozmiar, żeby telefon nie liczył setek kopii.
  const wypustka = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 14);
  const geoKlocka = new Map();
  const wspolne = new Set([wypustka]);   // geometrie współdzielone — nie zwalniamy ich przy przebudowie
  const klocekGeo = (w, d) => {
    const k = `${w}x${d}`;
    if (!geoKlocka.has(k)) { const g = new THREE.BoxGeometry(w - 0.04, WYS_KLOCKA, d - 0.04); geoKlocka.set(k, g); wspolne.add(g); }
    return geoKlocka.get(k);
  };

  let swiatGrupa = null;
  const agenci = new Map();   // id → { figurka, glowa, x, z, dymek, skokOd }
  let aktywny = false, klatka = 0, dopasowano = false;

  function sprzataj(obj) {
    obj.traverse((o) => {
      o.userData?.dispose?.();
      // Bryły GLB dzielą geometrię z pamięcią wczytanych modeli — zostają; reszta idzie do zwolnienia.
      if ((o.isMesh || o.isInstancedMesh) && !o.userData.zGlb) {
        if (!wspolne.has(o.geometry)) o.geometry?.dispose?.();
        o.material?.dispose?.();
      }
    });
  }

  function wypustki(n, pozycje, kolor, y) {
    const im = new THREE.InstancedMesh(wypustka, new THREE.MeshStandardMaterial({ color: kolor, roughness: 0.45 }), n);
    const m = new THREE.Matrix4();
    pozycje.forEach(([x, z], i) => { m.makeTranslation(x, y + 0.09, z); im.setMatrixAt(i, m); });
    im.castShadow = true; im.receiveShadow = true;
    return im;
  }

  function zbuduj() {
    const plytki = api.plytki || [];
    if (swiatGrupa) { scena.remove(swiatGrupa); sprzataj(swiatGrupa); }
    swiatGrupa = new THREE.Group();
    agenci.clear();
    const kol = Math.max(1, Math.ceil(Math.sqrt(plytki.length)));
    const dane = api.dane;

    plytki.forEach((pl, i) => {
      const g = pl.g, wyk = g.wyklute;
      const ox = (i % kol) * (P + ODSTEP), oz = Math.floor(i / kol) * (P + ODSTEP);
      const baza = new THREE.Color(g.kolor || '#94a3b8');
      const grupa = new THREE.Group();
      grupa.position.set(ox, 0, oz);
      grupa.userData.gatunek = g.id;

      const kolorPlytki = wyk ? baza.clone().multiplyScalar(0.62) : new THREE.Color('#3a4254');
      const plyta = new THREE.Mesh(new THREE.BoxGeometry(P, WYS_PLYTKI, P), new THREE.MeshStandardMaterial({ color: kolorPlytki, roughness: 0.55 }));
      plyta.position.set(P / 2, WYS_PLYTKI / 2, P / 2);
      plyta.receiveShadow = true; plyta.castShadow = true;
      grupa.add(plyta);
      const pola = [];
      for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) pola.push([a + 0.5, b + 0.5]);
      grupa.add(wypustki(pola.length, pola, kolorPlytki, WYS_PLYTKI));

      // Figurka: postument + forma (emoji z Katedry) jako sprite.
      const postument = new THREE.Mesh(new THREE.BoxGeometry(1, wyk ? 2 : 1, 1), new THREE.MeshStandardMaterial({ color: wyk ? baza : new THREE.Color('#6e7688'), roughness: 0.4 }));
      postument.position.set(P / 2, WYS_PLYTKI + (wyk ? 1 : 0.5), P / 2);
      postument.castShadow = true;
      grupa.add(postument);
      const glowa = napis(g.forma || '🥚', { rozmiar: 96, wysokosc: wyk ? 1.3 : 0.9 });
      glowa.position.set(P / 2, WYS_PLYTKI + (wyk ? 2 : 1) + 0.9, P / 2);
      if (!wyk) glowa.material.opacity = 0.55;
      grupa.add(glowa);

      const podpis = napis(`${g.imie}\n${wyk ? `${g.etap} · ${pl.razem} ${pl.razem === 1 ? 'dzieło' : pl.razem % 10 >= 2 && pl.razem % 10 <= 4 && (pl.razem % 100 < 12 || pl.razem % 100 > 14) ? 'dzieła' : 'dzieł'}` : 'w jaju'}`,
        { rozmiar: 44, wysokosc: 0.62, pogrub: true, tlo: 'rgba(13,19,32,0.82)', kolor: wyk ? '#eef1f6' : '#93a0b8' });
      podpis.position.set(P / 2, 0.9, P + 0.9);
      grupa.add(podpis);

      // Klocki: dzieła; modele 3D jako prawdziwe bryły GLB (z zapasowym klockiem, gdyby GLB nie wczytał się).
      if (wyk) {
        const klocki = dane?.agenci?.[g.id]?.klocki ?? [];
        let iKlocka = 0, iBryly = 0;
        for (const k of klocki) {
          if (k.model && iBryly < MIEJSCA_BRYL.length) {
            const [bx, bz] = MIEJSCA_BRYL[iBryly++];
            const miejsce = new THREE.Group();
            miejsce.position.set(bx + 1, WYS_PLYTKI, bz + 1);
            miejsce.userData.gatunek = g.id;
            grupa.add(miejsce);
            wczytajGlb(api.zKluczem(k.model))
              .then((s) => { miejsce.add(dopasuj(s, 1.9)); zaznaczDoRysowania(); })
              .catch(() => {
                const zap = new THREE.Mesh(klocekGeo(2, 2), new THREE.MeshStandardMaterial({ color: kolorKlocka(baza, 'model3d'), roughness: 0.4 }));
                zap.position.y = WYS_KLOCKA / 2; zap.castShadow = true; miejsce.add(zap); zaznaczDoRysowania();
              });
            continue;
          }
          const [mx, mz, w, d] = MIEJSCA[iKlocka % MIEJSCA.length];
          const warstwa = Math.floor(iKlocka / MIEJSCA.length);
          iKlocka++;
          const kolor = kolorKlocka(baza, k.rodzaj);
          const klocek = new THREE.Mesh(klocekGeo(w, d), new THREE.MeshStandardMaterial({ color: kolor, roughness: 0.35 }));
          const y = WYS_PLYTKI + warstwa * WYS_KLOCKA;
          klocek.position.set(mx + w / 2, y + WYS_KLOCKA / 2, mz + d / 2);
          klocek.castShadow = true; klocek.receiveShadow = true;
          grupa.add(klocek);
          const pp = [];
          for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) pp.push([mx + a + 0.5, mz + b + 0.5]);
          grupa.add(wypustki(pp.length, pp, kolor, y + WYS_KLOCKA));
        }
      }
      swiatGrupa.add(grupa);
      agenci.set(g.id, { glowa, bazaY: glowa.position.y, grupa, dymek: null, skokOd: 0 });
    });
    scena.add(swiatGrupa);

    if (!dopasowano && plytki.length) {
      // Cały świat w kadrze — także na pionowym ekranie telefonu (węższy kąt poziomy).
      const box = new THREE.Box3().setFromObject(swiatGrupa);
      const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
      const pion = THREE.MathUtils.degToRad(kamera.fov) / 2;
      const poziom = Math.atan(Math.tan(pion) * kamera.aspect);
      const odl = r / Math.sin(Math.min(pion, poziom));
      sterowanie.target.copy(c);
      kamera.position.copy(c).add(new THREE.Vector3(0.5, 0.95, 0.85).normalize().multiplyScalar(odl));
      sterowanie.maxDistance = Math.max(120, odl * 2);
      dopasowano = true;
    }
    zaznaczDoRysowania();
  }

  function dymek(id, tekst) {
    const a = agenci.get(id); if (!a) return;
    if (a.dymek) { a.glowa.parent.remove(a.dymek); a.dymek.userData.dispose(); }
    const t = tekst.length > 60 ? `${tekst.slice(0, 59)}…` : tekst;
    a.dymek = napis(t, { rozmiar: 40, wysokosc: 0.55, tlo: 'rgba(21,29,46,0.95)' });
    a.dymek.position.set(P / 2, a.bazaY + 1.4, P / 2);
    a.dymek.renderOrder = 10;
    a.glowa.parent.add(a.dymek);
    a.skokOd = performance.now();
    zaznaczDoRysowania();
  }

  // ── Rysowanie na żądanie ──────────────────────────────────────────────────
  let doRysowania = true;
  function zaznaczDoRysowania() { doRysowania = true; if (aktywny && !klatka) klatka = requestAnimationFrame(petla); }
  function petla() {
    klatka = 0;
    if (!aktywny) return;
    const teraz = performance.now();
    let dalej = sterowanie.update();
    for (const a of agenci.values()) {
      if (!a.skokOd) continue;
      const t = (teraz - a.skokOd) / 700;
      a.glowa.position.y = a.bazaY + (t < 1 ? Math.sin(t * Math.PI) * 0.9 : 0);
      if (t < 1) dalej = true;
      if (a.dymek && teraz - a.skokOd > 7000) { a.glowa.parent.remove(a.dymek); a.dymek.userData.dispose(); a.dymek = null; a.skokOd = 0; dalej = true; }
      else if (a.dymek) dalej = true;
    }
    if (dalej || doRysowania) { renderer.render(scena, kamera); doRysowania = false; }
    if (dalej) klatka = requestAnimationFrame(petla);
  }
  sterowanie.addEventListener('change', zaznaczDoRysowania);

  function rozmiar() {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h; kamera.updateProjectionMatrix();
    zaznaczDoRysowania();
  }
  window.addEventListener('resize', rozmiar);

  // ── Stuknięcie → katalog ──────────────────────────────────────────────────
  const promien = new THREE.Raycaster();
  let start = null;
  cv.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointerup', (e) => {
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
    const r = cv.getBoundingClientRect();
    promien.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), kamera);
    const traf = promien.intersectObject(swiatGrupa ?? scena, true)[0];
    let o = traf?.object;
    while (o && !o.userData.gatunek) o = o.parent;
    if (o) api.otworzKatalog(o.userData.gatunek);
  });

  // ── Przeglądarka pojedynczej bryły (katalog → klocek „model 3D") ─────────
  api.podglad3d = (miejsce, url) => {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    miejsce.appendChild(r.domElement);
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight('#ffffff', '#223', 1.4));
    const sw = new THREE.DirectionalLight('#fff', 1.4); sw.position.set(3, 5, 4); s.add(sw);
    const k = new THREE.PerspectiveCamera(35, 4 / 3, 0.01, 100); k.position.set(2.2, 1.7, 2.6);
    const st = new OrbitControls(k, r.domElement); st.target.set(0, 0.8, 0); st.autoRotate = true; st.enableDamping = true;
    let zyje = true;
    const rysujPodglad = () => {
      if (!zyje || !miejsce.isConnected) { zyje = false; r.dispose(); return; }
      const w = miejsce.clientWidth, h = miejsce.clientHeight;
      if (r.domElement.width !== Math.round(w * r.getPixelRatio())) { r.setSize(w, h, false); k.aspect = w / h; k.updateProjectionMatrix(); }
      st.update(); r.render(s, k); requestAnimationFrame(rysujPodglad);
    };
    wczytajGlb(url).then((b) => { s.add(dopasuj(b, 1.8)); requestAnimationFrame(rysujPodglad); })
      .catch((e) => { miejsce.textContent = `Nie udało się wczytać bryły: ${e.message}`; });
  };

  api.sluchaj((co, id, tekst) => {
    if (co === 'dane') zbuduj();
    if (co === 'zdarzenie') dymek(id, tekst);
  });

  return {
    wlacz() { aktywny = true; rozmiar(); zbuduj(); zaznaczDoRysowania(); },
    wylacz() { aktywny = false; if (klatka) cancelAnimationFrame(klatka); klatka = 0; },
  };
}
