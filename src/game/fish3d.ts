import * as THREE from "three";
import type { SpeciesDef } from "./data";

// ── small math helpers ────────────────────────────────────────────────────────
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hash2 = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const C = (hex: string) => new THREE.Color(hex);
const mix = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));
const gauss = (x: number, c: number, s: number) => Math.exp(-(((x - c) ** 2) / (2 * s * s)));
const angDiff = (a: number, b: number) => {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
};

export interface FishRig {
  group: THREE.Group;
  body: THREE.Mesh;
  update: (phase: number, speed01: number, dt: number, turn: number) => void;
  setDead: () => void;
  baseMat: THREE.MeshPhysicalMaterial;
}

// ── body cross-section profiles: the single source of anatomical truth ────────
// t: 0 = snout tip → 1 = tail. Returns half-height / half-width in scene units.
function dims(def: SpeciesDef, t: number) {
  const A = def.anatomy;
  const H = def.L * def.HR, W = H * def.WR;
  const forehead = A.forehead ?? 0.5;
  // Snout reach, hard-capped: a real roach's snout is ~5–7% of body length,
  // a pike's duckbill ~15%. Nothing else.
  const snL = Math.min(0.15, 0.055 + (1 - forehead) * 0.05 + A.snout * 0.08);
  // Ease-out rise: most of the head height is gained in the first half of the
  // snout, so the face is steep and rounded — no needle, no club.
  const xr = Math.min(1, t / snL);
  const rise = 1 - (1 - xr) * (1 - xr);
  const xw = Math.min(1, t / (snL * 0.85));
  const riseW = 1 - (1 - xw) * (1 - xw);
  const duck = A.snoutFlat * 0.3 * (1 - sstep(0.03, snL * 1.6, t)); // pike: depressed skull roof
  const arch = A.hump * 0.55 * gauss(t, 0.36, 0.15);               // crucian/bream dorsal arch
  const taper = 1 - A.taperAmt * sstep(A.taperStart, A.taperEnd, t);
  const ped = 1 - 0.32 * gauss(t, 0.9, 0.018);                     // caudal peduncle wrist
  // Tip is mouth-sized: ~12% of max depth / 25% of max width, reaching ~75%
  // of head height halfway along the snout and full height at snL.
  const hF = Math.min(1.22, Math.max(0.05, (0.12 + 0.83 * rise + arch - duck) * taper * ped));
  let wF = (0.25 + 0.75 * riseW)
    * (1 + (A.headWide - 1) * 0.85 * (1 - sstep(0.06, 0.42, t)))   // catfish broad skull
    * (1 + 0.45 * A.snoutFlat * A.snout * (1 - sstep(0, snL * 1.2, t))) // duckbill flares wide-flat
    * taper * ped;
  wF = Math.max(0.045, wF);
  const ventral = A.mouthVentral * 0.55 * (1 - sstep(0, snL, t))
    + A.snoutFlat * 0.25 * (1 - sstep(0, snL * 1.5, t));            // flat undersides
  const h = 0.5 * H * hF, w = 0.5 * W * wF;
  return { h, w, hF, ventral, yBot: -h * (1 - ventral * 0.5) };
}

// ── fin textures: lepidotrichia rays (built once) ─────────────────────────────
let _rayPar: THREE.CanvasTexture | null = null;
function rayParTex(): THREE.CanvasTexture {
  if (_rayPar) return _rayPar;
  const S = 128;
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  for (let py = 0; py < S; py++) {
    const v = 1 - py / (S - 1);
    for (let px = 0; px < S; px++) {
      const u = px / (S - 1);
      const stripe = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 15 + Math.sin(v * 4) * 0.6);
      let a = 0.5 + 0.5 * stripe;
      a *= 1 - 0.4 * Math.pow(v, 1.6);
      a *= 0.72 + 0.28 * sstep(0, 0.12, v);
      const i = (py * S + px) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  _rayPar = new THREE.CanvasTexture(c);
  _rayPar.colorSpace = THREE.SRGBColorSpace;
  return _rayPar;
}

let _rayFan: THREE.CanvasTexture | null = null;
function rayFanTex(): THREE.CanvasTexture {
  if (_rayFan) return _rayFan;
  const S = 128;
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  for (let py = 0; py < S; py++) {
    const v = 1 - py / (S - 1);
    for (let px = 0; px < S; px++) {
      const u = px / (S - 1);
      const dx = Math.max(u, 0.001), dy = v - 0.5;
      const ang = Math.atan2(dy, dx);
      const stripe = 0.5 + 0.5 * Math.sin(ang * 26);
      const r = Math.sqrt(dx * dx + dy * dy);
      let a = 0.48 + 0.52 * stripe;
      a *= 1 - 0.3 * Math.min(1, r);
      a = Math.max(a, 0.85 * (1 - sstep(0, 0.1, u)));
      const i = (py * S + px) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  _rayFan = new THREE.CanvasTexture(c);
  _rayFan.colorSpace = THREE.SRGBColorSpace;
  return _rayFan;
}

// remap fin UVs: "parallel" rays run along v; "fan" radiates from base-center
function mapUVs(geo: THREE.BufferGeometry, mode: "parallel" | "fan") {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (let i = 0; i < pos.count; i++) {
    minx = Math.min(minx, pos.getX(i)); maxx = Math.max(maxx, pos.getX(i));
    miny = Math.min(miny, pos.getY(i)); maxy = Math.max(maxy, pos.getY(i));
  }
  const rx = Math.max(1e-5, maxx - minx), ry = Math.max(1e-5, maxy - miny);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    if (mode === "parallel") uv.setXY(i, (x - minx) / rx, (y - miny) / ry);
    else uv.setXY(i, (maxx - x) / rx, (y - miny) / ry);
  }
  uv.needsUpdate = true;
}

// ── painted eye texture (per species iris) ────────────────────────────────────
const _eyeTexCache = new Map<string, THREE.CanvasTexture>();
function makeEyeTex(irisHex: string): THREE.CanvasTexture {
  const cached = _eyeTexCache.get(irisHex);
  if (cached) return cached;
  const Wd = 256, Ht = 128;
  const c = document.createElement("canvas"); c.width = Wd; c.height = Ht;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e9e6d4";
  g.fillRect(0, 0, Wd, Ht);
  const iris = C(irisHex);
  const cx = Wd * 0.5, cy = Ht * 0.5;
  const ir = Ht * 0.36;
  const px = cx, py = cy + Ht * 0.02;
  const grad = g.createRadialGradient(px, py - ir * 0.2, ir * 0.2, px, py, ir);
  grad.addColorStop(0, "#" + iris.clone().lerp(C("#ffffff"), 0.4).getHexString());
  grad.addColorStop(0.6, "#" + iris.getHexString());
  grad.addColorStop(1, "#" + iris.clone().lerp(C("#000000"), 0.55).getHexString());
  g.fillStyle = grad;
  g.beginPath(); g.arc(px, py, ir, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(8,10,10,0.9)";
  g.lineWidth = Ht * 0.022;
  g.beginPath(); g.arc(px, py, ir * 0.985, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#060808";
  g.beginPath(); g.arc(px, py, ir * 0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.95)";
  g.beginPath(); g.arc(px, py - ir * 0.55, ir * 0.15, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.beginPath(); g.arc(px + ir * 0.3, py + ir * 0.3, ir * 0.08, 0, Math.PI * 2); g.fill();
  const sh = g.createLinearGradient(0, 0, Wd, 0);
  sh.addColorStop(0, "rgba(46,56,56,0.55)");
  sh.addColorStop(0.28, "rgba(46,56,56,0)");
  sh.addColorStop(0.72, "rgba(46,56,56,0)");
  sh.addColorStop(1, "rgba(46,56,56,0.55)");
  g.fillStyle = sh; g.fillRect(0, 0, Wd, Ht);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _eyeTexCache.set(irisHex, t);
  return t;
}

// ── body skin: painted albedo + matching scale-relief normal map ──────────────
// UV layout: u = along body (0 snout → 1 tail), v = around the cross-section
// (v=0 dorsal midline → v=0.5 belly → v=1 dorsal midline). Everything —
// countershading, patterns, operculum, gill slit, mouth — is painted in this
// anatomical space, so features land exactly where the geometry says they are.
const _skinCache = new Map<string, { map: THREE.CanvasTexture; normal: THREE.CanvasTexture }>();
function paintSkin(def: SpeciesDef): { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const hit = _skinCache.get(def.id);
  if (hit) return hit;
  const A = def.anatomy;
  const L = def.L, H = L * def.HR;
  const back = C(A.back), side = C(A.side), belly = C(A.belly);
  const darkPat = C("#222a1e");
  const Wd = 1024, Ht = 512;
  // per-column anatomy (depends only on station t)
  const dH = new Float32Array(Wd), dW = new Float32Array(Wd), dV = new Float32Array(Wd);
  for (let px = 0; px < Wd; px++) {
    const d = dims(def, px / Wd);
    dH[px] = d.h; dW[px] = d.w; dV[px] = d.ventral;
  }
  // scale grid sized to real dimensions (~0.8 cm plates)
  const heightCm = H * 44, lenCm = L * 44;
  const rowH = Math.max(7, Math.min(30, Ht / Math.max(6, heightCm / 0.8)));
  const scW = Math.max(5, Math.min(30, Wd / Math.max(8, lenCm / 0.8)));

  const c = document.createElement("canvas"); c.width = Wd; c.height = Ht;
  const g = c.getContext("2d")!;
  const img = g.createImageData(Wd, Ht);
  const hgt = new Float32Array(Wd * Ht);

  for (let py = 0; py < Ht; py++) {
    const vfrac = 1 - (py + 0.5) / Ht;            // = θ/2π
    const th = vfrac * Math.PI * 2;
    const sinT = Math.sin(th);                    // ±1 on the flanks
    const cosT = Math.cos(th);                    // 1 dorsal → −1 ventral
    const bellyAmt = (1 - cosT) / 2;              // 0 back → 1 belly
    const sideAmt = Math.abs(sinT);
    const yn = cosT;                              // legacy pattern coord (+1 back, −1 belly)
    for (let px = 0; px < Wd; px++) {
      const t = (px + 0.5) / Wd;
      const X = (0.5 - t) * L;
      const Y = yn * dH[px];

      // countershading
      let col = mix(belly, side, sstep(0.55, 0.34, bellyAmt));
      col = mix(col, back, sstep(0.34, 0.12, bellyAmt));
      // dorsal seam (both texture edges = the back)
      const seam = Math.max(1 - sstep(0, 0.06, bellyAmt), 1 - sstep(0.94, 1, bellyAmt));
      col = mix(col, back.clone().multiplyScalar(0.68), seam * 0.55);

      // ── species patterns (same proven formulas, now on crisp UVs) ──
      const P = A.pattern;
      if (P === "bars" && A.bars) {
        const u = (X / L + 0.55) * A.bars - Y * 0.85;
        const p = u - Math.floor(u);
        const bar = (1 - sstep(0.24, 0.52, p)) * sstep(-0.34, -0.02, yn) * sstep(0.07, 0.15, t) * (1 - sstep(0.85, 0.96, t));
        col = mix(col, darkPat, bar * 0.92);
      } else if (P === "spots") {
        const cxh = Math.floor(X * 6), cyh = Math.floor(Y * 13);
        if (hash2(cxh, cyh) > 0.875 && yn > -0.45) col = mix(col, C("#20261e"), 0.8);
        const rx = Math.floor(X * 4.6 + 31), ry = Math.floor(Y * 9 + 17);
        if (hash2(rx, ry) > 0.93 && yn > -0.15 && yn < 0.55) {
          col = mix(col, C("#d9c9a4"), 0.35);
          col = mix(col, C("#c04434"), 0.7);
        }
        if (A.pinkBand) {
          const band = gauss(Y, 0, 0.17 * H) * (1 - sstep(0.86, 0.97, t));
          col = mix(col, C("#d18a90"), band * 0.5);
        }
      } else if (P === "toothbar") {
        const s = Math.floor(X * 2.4);
        const jagY = -0.05 * H * (((s % 2) + 2) % 2 === 0 ? 1 : -1) * 0.7;
        const band = gauss(Y - jagY, 0, 0.13 * H) * sstep(0.05, 0.12, t) * (1 - sstep(0.9, 1.0, t));
        const rag = 0.55 + 0.45 * vnoise(X * 5, Y * 3 + X);
        col = mix(col, C("#2e3a26"), band * rag * 0.92);
        if (hash2(Math.floor(X * 5), Math.floor(Y * 8)) > 0.92 && yn > 0.2) col = mix(col, darkPat, 0.45);
      } else if (P === "pikespots") {
        const n = vnoise(X * 2.3, Y * 6.5);
        if (n > 0.63 && yn > -0.5) col = mix(col, C("#d2cfa6"), 0.72);
        const u = (X / L + 0.5) * 9;
        const p = u - Math.floor(u);
        const jbar = (1 - sstep(0.3, 0.55, p)) * 0.14 * (1 - sstep(0.72, 0.9, t)) * sstep(-0.4, 0.1, yn);
        col = mix(col, C("#cfd0a4"), jbar);
        col = mix(col, C("#39422a"), sstep(0.35, 0.9, yn) * 0.35);
      } else if (P === "mottle") {
        const v = vnoise(X * 1.4, Y * 2.6);
        if (v > 0.6 && yn > -0.4) col = mix(col, C("#333c46"), 0.42);
        if (hash2(Math.floor(X * 7), Math.floor(Y * 9)) > 0.93 && yn > 0.0) col = mix(col, C("#2b333c"), 0.4);
      } else if (P === "lattice") {
        const sy = Math.floor(Y * 9);
        const off = ((sy % 2) + 2) % 2 === 0 ? 0 : 0.5;
        const ux = X * 5.5 + off, uy = Y * 9;
        const fx = Math.abs(ux - Math.floor(ux) - 0.5), fy = Math.abs(uy - Math.floor(uy) - 0.5);
        if (Math.max(fx, fy) > 0.36 && yn > -0.7) col = col.multiplyScalar(0.72);
        col = col.multiplyScalar(0.96 + hash2(Math.floor(ux), sy) * 0.09);
      } else if (P === "xspots") {
        const ux = X * 4.5, uy = Y * 7;
        const fx = Math.abs(ux - Math.floor(ux) - 0.5), fy = Math.abs(uy - Math.floor(uy) - 0.5);
        const cross = Math.min(fx, fy) < 0.1;
        if (cross && hash2(Math.floor(ux), Math.floor(uy)) > 0.5 && yn > -0.15)
          col = mix(col, C("#222a30"), 0.75);
      } else {
        const lb = gauss(Y, 0, 0.1 * H);
        col = mix(col, C("#5a655c"), lb * 0.12);
      }

      // ── head anatomy (painted where the sculpt says it is) ──
      if (t < 0.42) {
        // operculum plate: broad soft shading behind the eye station
        const oper = gauss(t, 0.3, 0.045) * sstep(0.3, 0.7, sideAmt) * (bellyAmt > 0.12 && bellyAmt < 0.88 ? 1 : 0);
        col.multiplyScalar(1 - 0.16 * oper);
        // gill slit — a crisp dark arc at the plate's rear edge
        const slitT = 0.262 + 0.016 * Math.sin(yn * 2.4);
        const slit = gauss(t, slitT, 0.0042) * sstep(0.35, 0.75, sideAmt) * (1 - sstep(0.8, 0.95, bellyAmt));
        col = mix(col, C("#10161a"), slit * 0.8);
        // cheek highlight in front of the plate
        col = mix(col, side.clone().lerp(C("#ffffff"), 0.12), gauss(t, 0.2, 0.03) * sstep(0.4, 0.8, sideAmt) * 0.2);
        // snout crown darkens toward the back color
        col = mix(col, back, (1 - sstep(0.02, 0.14, t)) * (1 - bellyAmt) * 0.45);
      }
      // mouth: dark cleft on the lower snout face + pale lip line above it
      if (t < 0.07 && bellyAmt > 0.45) {
        const mv = A.mouthVentral ?? 0.12;
        const mouthBelly = 0.6 + mv * 0.22;
        const cleft = gauss(bellyAmt, mouthBelly, 0.055) * (1 - sstep(0.028, 0.06, t)) * sstep(0.45, 0.55, bellyAmt);
        col = mix(col, C("#0e1417"), cleft * 0.88);
        col = mix(col, C("#d8d8c6"), gauss(bellyAmt, mouthBelly - 0.09, 0.03) * (1 - sstep(0.02, 0.05, t)) * 0.3);
      }
      // bass: dark maxilla streak running back from the gape
      if (A.jawBig) {
        const mxl = gauss(t, 0.16, 0.028) * gauss(bellyAmt, 0.54, 0.05) * sstep(0.35, 0.7, sideAmt);
        col = mix(col, C("#232b24"), mxl * 0.6);
      }
      // lateral line sheen
      const ll = gauss(bellyAmt, 0.42, 0.02) * sstep(0.55, 0.9, sideAmt) * sstep(0.08, 0.2, t);
      col = mix(col, C("#e6ece6"), ll * 0.2);

      // ── scales: color arcs + relief height field ──
      const row = py / rowH, scol = px / scW;
      const r0 = Math.round(row), offR = ((r0 % 2) + 2) % 2 === 0 ? 0 : 0.5;
      let sh = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const rr = r0 + dr;
        const oy = rr * rowH;
        const oo = (((rr % 2) + 2) % 2 === 0 ? 0 : 0.5) + offR * 0; // own offset
        const c0 = Math.round(scol - oo);
        for (let dc = -1; dc <= 1; dc++) {
          const ccx = (c0 + dc + oo) * scW;
          const d = Math.sqrt((px - ccx) ** 2 + (py - oy) ** 2) - rowH * 0.66;
          const ang = Math.atan2(py - oy, px - ccx);
          if (ang < -2.7 || ang > -0.4) continue;
          const plate = Math.exp(-(d * d) / (2 * 2.2 * 2.2));
          const groove = Math.exp(-(((d + 1.5) ** 2) / (2 * 1.0 * 1.0)));
          sh += plate * 0.5 - groove * 0.62;
          if (plate > groove) {
            const tone = 0.94 + hash2(rr * 7 + 3, (c0 + dc) * 13 + 1) * 0.09;
            col.multiplyScalar(1 + (tone - 1) * plate * 0.8);
            col.multiplyScalar(1 + 0.05 * groove);
          } else {
            col.multiplyScalar(1 - 0.11 * groove);
          }
        }
      }
      hgt[py * Wd + px] = sh;

      // organic micro-mottle + cyprinid belly glitter
      col.multiplyScalar(1 + (hash2(Math.floor(X * 21 + 5), Math.floor(Y * 27 + px * 0.01)) - 0.5) * 0.06);
      if ((A.sheen ?? 0.3) > 0.5 && bellyAmt > 0.55 && hash2(px, py) > 0.965)
        col = mix(col, C("#f2f4ea"), 0.35);

      const i = (py * Wd + px) * 4;
      img.data[i] = Math.round(Math.min(1, col.r) * 255);
      img.data[i + 1] = Math.round(Math.min(1, col.g) * 255);
      img.data[i + 2] = Math.round(Math.min(1, col.b) * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  // normal map from the same relief field
  const nc = document.createElement("canvas"); nc.width = Wd; nc.height = Ht;
  const ng = nc.getContext("2d")!;
  const nimg = ng.createImageData(Wd, Ht);
  for (let py = 0; py < Ht; py++) {
    for (let px = 0; px < Wd; px++) {
      const l = hgt[py * Wd + ((px - 1 + Wd) % Wd)], r = hgt[py * Wd + ((px + 1) % Wd)];
      const u = hgt[((py - 1 + Ht) % Ht) * Wd + px], dn = hgt[((py + 1) % Ht) * Wd + px];
      const i = (py * Wd + px) * 4;
      nimg.data[i] = 128 + Math.max(-127, Math.min(127, (l - r) * 150));
      nimg.data[i + 1] = 128 + Math.max(-127, Math.min(127, (u - dn) * 150));
      nimg.data[i + 2] = 255;
      nimg.data[i + 3] = 255;
    }
  }
  ng.putImageData(nimg, 0, 0);
  const normal = new THREE.CanvasTexture(nc);
  normal.wrapT = THREE.RepeatWrapping;

  const out = { map, normal };
  _skinCache.set(def.id, out);
  return out;
}

// ── lofted body: elliptical cross-sections swept along the spine ──────────────
function buildLoft(def: SpeciesDef): THREE.BufferGeometry {
  const A = def.anatomy;
  const L = def.L;
  const ST = 44, SEG = 28;
  const eyeRl = Math.max(0.032, L * def.HR * 0.155 * (A.eyeScale ?? 1) * (0.85 + A.snout * 0.15));
  const exS = L * (0.34 - A.snout * 0.09);
  const eyS = L * def.HR * (0.11 - A.snoutFlat * 0.05);
  const dEye = dims(def, 0.5 - exS / L);
  const thetaEye = Math.acos(Math.max(-1, Math.min(1, eyS / Math.max(1e-4, dEye.h))));

  const pos = new Float32Array((ST + 1) * (SEG + 1) * 3);
  const uv = new Float32Array((ST + 1) * (SEG + 1) * 2);
  let vi = 0;
  for (let i = 0; i <= ST; i++) {
    const t = i / ST;
    const d = dims(def, t);
    const X0 = (0.5 - t) * L;
    // head sculpture amplitudes (fractions of local dims — kept subtle)
    const operB = 0.05 * (A.headWide > 1.1 ? 1.3 : 1) * gauss(t, 0.3, 0.045);
    const sockA = 0.5 * eyeRl * gauss(t, 0.5 - exS / L, 0.05);
    const browA = 0.05 * d.h * gauss(t, 0.24, 0.035);
    const cheekA = 0.035 * d.w * gauss(t, 0.34, 0.04);
    const lipA = (1 - A.snoutFlat) * (A.forehead ?? 0.5) * 0.5 * gauss(t, 0.012, 0.016);
    for (let j = 0; j <= SEG; j++) {
      const th = (j / SEG) * Math.PI * 2;       // 0 = dorsal midline
      const cy = Math.cos(th), sy = Math.sin(th);
      let y = cy * d.h * (cy < 0 ? (1 - d.ventral * 0.5) : 1);
      let z = sy * d.w;
      let x = X0;
      const flank = sstep(0.25, 0.6, Math.abs(sy));
      // opercular bulge on the flanks
      z += Math.sign(z || 1) * operB * d.w * flank;
      // brow ridge above the eye, cheek fullness below-behind it
      y += browA * gauss(angDiff(th, thetaEye), 0, 0.55) * flank
        + browA * gauss(angDiff(th, -thetaEye), 0, 0.55) * flank;
      z += Math.sign(z || 1) * cheekA * gauss(angDiff(Math.abs(th), thetaEye + 0.6), 0, 0.6) * flank;
      // eye sockets — shallow cups exactly where the eyes seat
      const sock = sockA * (gauss(angDiff(th, thetaEye), 0, 0.42) + gauss(angDiff(th, -thetaEye), 0, 0.42)) * gauss(t, 0.5 - exS / L, 0.05) * flank;
      z -= Math.sign(z || 1) * sock;
      // lower lip: push the front face forward just under the snout tip
      x += lipA * L * gauss(th - Math.PI, 0, 0.9) * (cy < 0.3 ? 1 : 0.2);
      pos[vi * 3] = x; pos[vi * 3 + 1] = y; pos[vi * 3 + 2] = z;
      uv[vi * 2] = t; uv[vi * 2 + 1] = th / (Math.PI * 2);
      vi++;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < ST; i++) {
    for (let j = 0; j < SEG; j++) {
      const a = i * (SEG + 1) + j, b = a + SEG + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // close the snout and tail with cap fans (no open holes at close-up)
  const grow = (arr: Float32Array, vals: number[]) => {
    const out = new Float32Array(arr.length + vals.length);
    out.set(arr); out.set(vals, arr.length);
    return out;
  };
  const nose = vi, tailc = vi + 1;
  const posF = grow(pos, [0.506 * L, 0, 0, -0.502 * L, 0, 0]);
  const uvF = grow(uv, [0, 0.5, 1, 0.5]);
  for (let j = 0; j < SEG; j++) {
    idx.push(nose, j, j + 1);                                        // +X facing
    const a = ST * (SEG + 1) + j;
    idx.push(tailc, a + 1, a);                                       // −X facing
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posF, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvF, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ── fins that ride the body curves ────────────────────────────────────────────
const tOf = (def: SpeciesDef, x: number) => 0.5 - x / def.L;
const backY = (def: SpeciesDef, x: number) => dims(def, tOf(def, x)).h * 0.97;
const bellyY = (def: SpeciesDef, x: number) => {
  const d = dims(def, tOf(def, x));
  return d.yBot * 0.97;
};

function finOnCurve(def: SpeciesDef, x0: number, x1: number, hMul: number, dorsal: boolean, spiky = false): THREE.ShapeGeometry {
  const H = def.L * def.HR;
  const N = 14;
  const base = (x: number) => dorsal ? backY(def, x) : bellyY(def, x);
  const dir = dorsal ? 1 : -1;
  const s = new THREE.Shape();
  // base edge, forward → rear
  for (let i = 0; i <= N; i++) {
    const x = x0 + ((x1 - x0) * i) / N;
    if (i === 0) s.moveTo(x, base(x)); else s.lineTo(x, base(x));
  }
  // crest, rear → forward
  if (spiky) {
    const n = 7;
    for (let i = n; i >= 1; i--) {
      const a = x0 + ((x1 - x0) * (i - 1)) / n;
      const b = x0 + ((x1 - x0) * i) / n;
      const ht = H * hMul * (0.72 + 0.28 * Math.sin((Math.PI * (i - 0.5)) / n));
      s.lineTo(b, base(b) + dir * ht * 0.6);
      s.lineTo((a + b) / 2, base((a + b) / 2) + dir * ht);
    }
  } else {
    for (let i = N; i >= 0; i--) {
      const x = x0 + ((x1 - x0) * i) / N;
      const u = i / N;
      const ht = H * hMul * (0.35 + 0.65 * Math.sin(Math.PI * Math.pow(u, 0.8)));
      s.lineTo(x, base(x) + dir * ht);
    }
  }
  s.closePath();
  const geo = new THREE.ShapeGeometry(s, 1);
  mapUVs(geo, "parallel");
  return geo;
}

function caudalGeo(L: number, Hh: number, fork: number, sizeMul: number): THREE.ShapeGeometry {
  const d = L * 0.3 * sizeMul, h = Hh * 0.62 * (0.7 + 0.4 * fork);
  const notch = 0.3 + 0.55 * fork;
  const s = new THREE.Shape();
  s.moveTo(0, 0.1 * h);
  s.quadraticCurveTo(-d * 0.55, 0.5 * h, -d, h);
  s.quadraticCurveTo(-d * (0.42 + 0.22 * fork), 0.18 * h, -d * notch, 0);
  s.quadraticCurveTo(-d * (0.42 + 0.22 * fork), -0.18 * h, -d, -h);
  s.quadraticCurveTo(-d * 0.55, -0.5 * h, 0, -0.1 * h);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s, 6);
  // cupped, swept lobes: tips recede and rake back like a real homocercal tail
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const n = Math.abs(y) / h;
    p.setZ(i, -(n * n) * L * 0.055);
    p.setX(i, x - n * L * 0.035);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  mapUVs(geo, "fan");
  return geo;
}

function fanGeo(w: number, h: number): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(-w * 0.35, -h * 0.45, -w, -h * 0.62);
  s.quadraticCurveTo(-w * 0.5, -h * 0.1, -w * 0.35, -h * 0.02);
  s.quadraticCurveTo(-w * 0.15, h * 0.12, 0, 0);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s, 4);
  mapUVs(geo, "parallel");
  return geo;
}

// ── full rig ──────────────────────────────────────────────────────────────────
export function makeFish(def: SpeciesDef): FishRig {
  const { L, HR, WR } = def;
  const H = L * HR, W = H * WR;
  const A = def.anatomy;

  const group = new THREE.Group();
  const tintMats: THREE.MeshPhysicalMaterial[] = [];

  // skin: painted albedo + scale-relief normal map, wet clearcoat
  const skin = paintSkin(def);
  const sheen = A.sheen ?? 0.3;
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: skin.map, normalMap: skin.normal, normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: A.roughness * (1 - sheen * 0.3), metalness: 0.08 + sheen * 0.3,
    clearcoat: 0.35 + sheen * 0.3, clearcoatRoughness: 0.4,
  });
  tintMats.push(bodyMat);
  const body = new THREE.Mesh(buildLoft(def), bodyMat);
  body.castShadow = true;
  group.add(body);

  const finMat = new THREE.MeshPhysicalMaterial({
    color: A.fin, map: rayParTex(), roughness: 0.55, metalness: 0,
    transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, clearcoat: 0.2,
  });
  const pairedMat = new THREE.MeshPhysicalMaterial({
    color: A.finPaired, map: rayParTex(), roughness: 0.55, metalness: 0,
    transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, clearcoat: 0.2,
  });
  const fanMat = new THREE.MeshPhysicalMaterial({
    color: A.fin, map: rayFanTex(), roughness: 0.55, metalness: 0,
    transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, clearcoat: 0.2,
  });
  tintMats.push(finMat, pairedMat, fanMat);

  // caudal (peduncle is part of the loft — no bolted spheres)
  const tailPivot = new THREE.Group();
  tailPivot.position.x = -L * 0.495;
  const tail = new THREE.Mesh(caudalGeo(L, H * A.tailSize, A.tailFork, A.tailSize), fanMat);
  tail.castShadow = true;
  tailPivot.add(tail);
  group.add(tailPivot);

  // dorsal fin(s), riding the actual back curve
  const flutter: THREE.Mesh[] = [];
  const D = A.dorsal;
  const dx0 = L * D.f, dx1 = -L * D.b;
  if (D.spiky) {
    const d = new THREE.Mesh(finOnCurve(def, dx0, dx1, D.h, true, true), finMat);
    group.add(d);
    if (D.blotch) {
      const bl = new THREE.Mesh(
        new THREE.CircleGeometry(L * 0.045, 12),
        new THREE.MeshStandardMaterial({ color: "#241f18", roughness: 0.7, side: THREE.DoubleSide })
      );
      bl.position.set(dx1 + L * 0.012, backY(def, dx1) + H * D.h * 0.55, 0);
      group.add(bl);
    }
  } else {
    const d = new THREE.Mesh(finOnCurve(def, dx0, dx1, D.h, true), finMat);
    group.add(d);
    flutter.push(d);
  }
  if (A.dorsal2) {
    const D2 = A.dorsal2;
    const d2 = new THREE.Mesh(finOnCurve(def, L * D2.f, -L * D2.b, D2.h, true), finMat);
    group.add(d2);
    flutter.push(d2);
  }

  // anal fin on the belly curve (long ribbon on catfish)
  const An = A.anal;
  const anal = new THREE.Mesh(finOnCurve(def, -L * An.f, -L * An.b, An.h, false), finMat);
  group.add(anal);
  flutter.push(anal);

  // adipose fin
  if (A.adipose) {
    const ad = new THREE.Mesh(finOnCurve(def, -L * 0.3, -L * 0.37, 0.09, true), finMat);
    group.add(ad);
  }

  // pectoral fins (animated sculling)
  const dPect = dims(def, 0.32);
  const mkPect = (sideZ: 1 | -1) => {
    const piv = new THREE.Group();
    piv.position.set(L * 0.18, -dPect.h * 0.18, sideZ * dPect.w * 0.96);
    const geo = fanGeo(L * 0.19, L * 0.13);
    const pp = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) {
      const xx = pp.getX(i);
      if (xx < 0) pp.setZ(i, Math.pow(-xx / (L * 0.19), 1.4) * L * 0.05);
    }
    pp.needsUpdate = true;
    geo.computeVertexNormals();
    const fin = new THREE.Mesh(geo, pairedMat);
    fin.rotation.y = sideZ * 0.5;
    piv.add(fin);
    piv.rotation.z = 0.7;
    group.add(piv);
    return piv;
  };
  const pectL = mkPect(1), pectR = mkPect(-1);

  // pelvic fins
  const dPelv = dims(def, 0.44);
  for (const sz of [1, -1]) {
    const pv = new THREE.Mesh(fanGeo(L * 0.1, L * 0.08), pairedMat);
    pv.position.set(L * 0.06, dPelv.yBot + L * 0.008, sz * dPelv.w * 0.55);
    pv.rotation.z = 1.2;
    pv.rotation.y = sz * 0.3;
    group.add(pv);
  }

  // eyes — textured spheres seated in the sculpted sockets
  const eyeScale = A.eyeScale ?? 1;
  const ex = L * (0.34 - A.snout * 0.09);
  const ey = H * (0.11 - A.snoutFlat * 0.05);
  const dEye = dims(def, 0.5 - ex / L);
  const eyeR = Math.min(Math.max(0.032, H * 0.155 * eyeScale * (0.85 + A.snout * 0.15)), dEye.w * 0.62);
  const ballC = dEye.w - eyeR * 0.38;
  const eyeMat = new THREE.MeshPhysicalMaterial({
    map: makeEyeTex(A.eye), roughness: 0.3, metalness: 0,
    clearcoat: 0.45, clearcoatRoughness: 0.3,
  });
  tintMats.push(eyeMat);
  const eyeGeo = new THREE.SphereGeometry(eyeR, 22, 16, -Math.PI / 2);
  for (const sz of [1, -1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(ex, ey, sz * ballC);
    if (sz < 0) eye.rotation.y = Math.PI;
    group.add(eye);
  }

  // barbels — curved whiskers (channel catfish)
  if (A.barbels === "catfish") {
    const bMat = new THREE.MeshStandardMaterial({ color: "#414a54", roughness: 0.8 });
    const dMouth = dims(def, 0.08);
    const mkB = (sx: number, sy: number, sz: number, len: number, outZ: number) => {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(sx, sy, sz),
        new THREE.Vector3(sx + len * 0.55, sy - len * 0.22, sz + outZ * 0.5),
        new THREE.Vector3(sx + len * 0.8, sy - len * 0.55, sz + outZ)
      );
      const b = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.008, 5), bMat);
      group.add(b);
    };
    const mx = L * 0.42, my = dMouth.yBot * 0.7;
    mkB(mx, my, W * 0.16, L * 0.42, W * 0.22);
    mkB(mx, my, -W * 0.16, L * 0.42, -W * 0.22);
    for (const s of [1, -1]) {
      mkB(L * 0.38, my - H * 0.02, s * W * 0.1, L * 0.16, s * W * 0.08);
      mkB(L * 0.36, my - H * 0.025, s * W * 0.05, L * 0.12, s * W * 0.05);
    }
  }

  let dead = false;
  let pectPh = Math.random() * 6;
  let tailAmp = 0.3;
  const update = (phase: number, speed01: number, dt: number, turn: number) => {
    if (dead) return;
    tailAmp += (0.1 + 0.62 * speed01 - tailAmp) * Math.min(1, dt * 4.2);
    tailPivot.rotation.y = Math.sin(phase) * tailAmp;
    body.rotation.y = Math.sin(phase) * (0.018 + 0.035 * speed01) + turn * 0.11;
    body.rotation.z = Math.sin(phase * 0.5) * 0.012;
    pectPh += dt * (2.4 + (1 - speed01) * 2.8);
    const pAmp = 0.5 - 0.32 * speed01;
    pectL.rotation.z = 0.75 + Math.sin(pectPh + 1.1) * pAmp;
    pectR.rotation.z = 0.75 + Math.sin(pectPh) * pAmp;
    for (let i = 0; i < flutter.length; i++)
      flutter[i].rotation.y = Math.sin(phase * 0.63 + i * 2.1) * 0.055 * (0.3 + speed01);
  };

  const setDead = () => {
    dead = true;
    for (const m of tintMats) { m.color.set("#8d9294"); m.opacity = Math.min(m.opacity, 0.75); }
    tailPivot.rotation.y = 0.25;
  };

  return { group, body, update, setDead, baseMat: bodyMat };
}
