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

export interface FishRig {
  group: THREE.Group;
  body: THREE.Mesh;
  update: (phase: number, speed01: number, dt: number, turn: number) => void;
  setDead: () => void;
  baseMat: THREE.MeshPhysicalMaterial;
}

/**
 * Lateral width multiplier of the body at station t (0 snout → 1 tail).
 * Shared by the body sculpt and the eye placement so the eye always knows
 * exactly where the flank surface is.
 */
function widthProfile(def: SpeciesDef, t: number): number {
  const A = def.anatomy;
  const zSn = 1 - (0.24 - A.snout * 0.12) * (1 - sstep(0, 0.18, t));
  const tt = 1 - A.taperAmt * sstep(A.taperStart, A.taperEnd, t);
  const ped = 1 - 0.2 * Math.exp(-(((t - 0.885) ** 2) / (2 * 0.028 ** 2)));
  const hw = 1 + (A.headWide - 1) * (1 - sstep(0.04, 0.34, t));
  return zSn * tt * ped * hw;
}

// ── shared procedural textures (built once) ───────────────────────────────────
let _rayPar: THREE.CanvasTexture | null = null;
function rayParTex(): THREE.CanvasTexture {
  if (_rayPar) return _rayPar;
  const S = 128;
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  for (let py = 0; py < S; py++) {
    const v = 1 - py / (S - 1); // uv v: 0 base → 1 tip
    for (let px = 0; px < S; px++) {
      const u = px / (S - 1);
      const stripe = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 15 + Math.sin(v * 4) * 0.6);
      let a = 0.5 + 0.5 * stripe;
      a *= 1 - 0.4 * Math.pow(v, 1.6);          // worn, softer tip
      a *= 0.72 + 0.28 * sstep(0, 0.12, v);      // solid membrane at the base
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
      a = Math.max(a, 0.85 * (1 - sstep(0, 0.1, u))); // solid at the peduncle
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

let _scales: THREE.CanvasTexture | null = null;
function scaleTex(): THREE.CanvasTexture {
  if (_scales) return _scales;
  const S = 256, rowH = 16, scW = 22;
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d")!;
  // OPAQUE light base — this texture multiplies the vertex paint, so any
  // transparent pixel would render the fish black.
  g.fillStyle = "#ededed";
  g.fillRect(0, 0, S, S);
  for (let row = -1; row < S / rowH + 1; row++) {
    const y0 = row * rowH + rowH * 0.5;
    const off = ((row % 2) + 2) % 2 === 0 ? 0 : scW * 0.5;
    for (let k = -1; k < S / scW + 1; k++) {
      const cx = k * scW + off;
      // per-scale tonal variation — no two plates quite alike
      const tone = 224 + Math.round(hash2(row * 7 + 3, k * 13 + 1) * 18);
      g.fillStyle = `rgb(${tone},${tone},${tone})`;
      g.beginPath(); g.arc(cx, y0, rowH * 0.72, -2.6, -0.5); g.fill();
      // specular glint on some scales
      if (((row * 31 + k * 17) % 5) === 0) {
        g.fillStyle = "rgba(255,255,255,0.5)";
        g.beginPath(); g.arc(cx - rowH * 0.18, y0 - rowH * 0.3, 1.4, 0, Math.PI * 2); g.fill();
      }
      // light rim above, dark groove under each exposed edge
      g.lineWidth = 1.1;
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.beginPath(); g.arc(cx, y0 + 1.5, rowH * 0.7, -2.6, -0.5); g.stroke();
      g.strokeStyle = "rgba(0,0,0,0.28)";
      g.beginPath(); g.arc(cx, y0, rowH * 0.7, -2.6, -0.5); g.stroke();
    }
  }
  _scales = new THREE.CanvasTexture(c);
  _scales.wrapS = _scales.wrapT = THREE.RepeatWrapping;
  _scales.colorSpace = THREE.SRGBColorSpace;
  return _scales;
}

/** tangent-space normal map derived from the scale relief — real bumpy plates under the lights */
let _scaleNorm: THREE.CanvasTexture | null = null;
function scaleNormalTex(): THREE.CanvasTexture {
  if (_scaleNorm) return _scaleNorm;
  const S = 256, rowH = 16, scW = 22;
  const hgt = new Float32Array(S * S);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let h = 0.5;
      for (let row = -1; row < S / rowH + 1; row++) {
        const y0 = row * rowH + rowH * 0.5;
        const off = ((row % 2) + 2) % 2 === 0 ? 0 : scW * 0.5;
        for (let k = -1; k < S / scW + 1; k++) {
          const cx = k * scW + off;
          const d = Math.sqrt((px - cx) ** 2 + (py - y0) ** 2) - rowH * 0.66;
          const ang = Math.atan2(py - y0, px - cx);
          if (ang < -2.7 || ang > -0.4) continue;
          h += 0.42 * Math.exp(-(d * d) / (2 * 2.4 * 2.4));   // raised plate
          h -= 0.5 * Math.exp(-((d + 1.6) ** 2) / (2 * 1.1 * 1.1)); // groove below the edge
        }
      }
      hgt[py * S + px] = h;
    }
  }
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const l = hgt[py * S + ((px - 1 + S) % S)], r = hgt[py * S + ((px + 1) % S)];
      const u = hgt[((py - 1 + S) % S) * S + px], dn = hgt[((py + 1) % S) * S + px];
      const i = (py * S + px) * 4;
      img.data[i] = 128 + Math.max(-127, Math.min(127, (l - r) * 260));
      img.data[i + 1] = 128 + Math.max(-127, Math.min(127, (u - dn) * 260));
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  _scaleNorm = new THREE.CanvasTexture(c);
  _scaleNorm.wrapS = _scaleNorm.wrapT = THREE.RepeatWrapping;
  return _scaleNorm;
}

// ── eye texture: sclera + iris + pupil + catchlight painted on the sphere ──
// Geometry-stacked pupils were sub-pixel at gameplay zoom; a painted eye is
// visible from every angle by construction. Texture centre (u=0.5) faces +Z
// via phiStart = -π/2, so the pupil looks straight out of the head.
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
  const cx = Wd * 0.5, cy = Ht * 0.5; // equator, facing outward
  const ir = Ht * 0.36;               // iris ≈ 72% of eye height — readable
  const px = cx, py = cy + Ht * 0.02;
  const grad = g.createRadialGradient(px, py - ir * 0.2, ir * 0.2, px, py, ir);
  grad.addColorStop(0, "#" + iris.clone().lerp(C("#ffffff"), 0.4).getHexString());
  grad.addColorStop(0.6, "#" + iris.getHexString());
  grad.addColorStop(1, "#" + iris.clone().lerp(C("#000000"), 0.55).getHexString());
  g.fillStyle = grad;
  g.beginPath(); g.arc(px, py, ir, 0, Math.PI * 2); g.fill();
  // iris rim
  g.strokeStyle = "rgba(8,10,10,0.9)";
  g.lineWidth = Ht * 0.022;
  g.beginPath(); g.arc(px, py, ir * 0.985, 0, Math.PI * 2); g.stroke();
  // pupil
  g.fillStyle = "#060808";
  g.beginPath(); g.arc(px, py, ir * 0.5, 0, Math.PI * 2); g.fill();
  // catchlights (offset upward — symmetric under the left-eye Y-flip)
  g.fillStyle = "rgba(255,255,255,0.95)";
  g.beginPath(); g.arc(px, py - ir * 0.55, ir * 0.15, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.beginPath(); g.arc(px + ir * 0.3, py + ir * 0.3, ir * 0.08, 0, Math.PI * 2); g.fill();
  // shade the rear of the eyeball (hidden inside the head, hides the u-seam too)
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

// remap a fin geometry's UVs: "parallel" rays run along v; "fan" radiates from base-center
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
    else uv.setXY(i, (maxx - x) / rx, (y - miny) / ry); // base at x=max → u=0
  }
  uv.needsUpdate = true;
}

// ── body geometry with species-specific sculpt + vertex-painted anatomy ──────
function buildBody(def: SpeciesDef): THREE.BufferGeometry {
  const { L, HR, WR } = def;
  const H = L * HR, W = H * WR;
  const A = def.anatomy;
  const back = C(A.back), side = C(A.side), belly = C(A.belly);
  const darkPat = C("#222a1e");
  const isPike = A.snout > 0.7;

  const geo = new THREE.SphereGeometry(0.5, 48, 32);
  // eye station — must match makeFish so the sculpted sockets line up
  const eyeRl = Math.max(0.032, H * 0.155 * (A.eyeScale ?? 1) * (0.85 + A.snout * 0.15));
  const exS = L * (0.34 - A.snout * 0.09);
  const eyS = H * (0.11 - A.snoutFlat * 0.05);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = 0.5 - x; // 0 snout → 1 tail
    const yn = y * 2;  // -1 belly → +1 back

    // ── sculpt ──
    const forehead = A.forehead ?? 0.5;
    const snL = 0.06 + (1 - forehead) * 0.16 + A.snout * 0.1; // steep cyprinid face vs drawn-out pike snout
    let sn = 0.3 + 0.7 * sstep(0, snL, t);                    // snout taper (radius fraction)
    // rounded lip bulge at the very snout tip (blunt-snouted species)
    sn *= 1 + 0.12 * (1 - A.snoutFlat) * Math.exp(-(((t - 0.02) ** 2) / (2 * 0.015 ** 2)));
    const yCrush = 1 - A.snoutFlat * 0.55 * (1 - sstep(0, 0.3, t)); // pike duckbill flatten
    const tt = 1 - A.taperAmt * sstep(A.taperStart, A.taperEnd, t); // caudal taper
    const ped = 1 - 0.2 * Math.exp(-(((t - 0.885) ** 2) / (2 * 0.028 ** 2))); // caudal peduncle wrist
    const hd = 1 - (A.headWide - 1) * 0.32 * (1 - sstep(0, 0.3, t));
    const bump = A.hump * H * 0.55 * Math.exp(-((t - 0.32) ** 2) / (2 * 0.15 ** 2)) * (1 - sstep(0.82, 0.96, t));

    const X = x * L;
    let Y = y * H * sn * tt * ped * yCrush * hd + bump * (yn > 0 ? yn : 0.12 * yn);
    // ventral mouth: flatten the underside of the snout (suction feeders)
    if (A.mouthVentral) Y *= 1 - A.mouthVentral * 0.4 * (1 - sstep(0, 0.15, t)) * (1 - sstep(-0.7, 0, yn));
    const wp = widthProfile(def, t);
    let Z = z * W * wp;
    // jawline: lower jaw narrows toward the snout tip
    Z *= 1 - 0.12 * (1 - sstep(0, 0.24, t)) * (1 - sstep(-1, -0.3, yn));
    const halfWv = W * 0.5 * wp;
    // eye sockets — shallow cups carved into the flanks where the eyes seat
    if (Math.abs(Z) > halfWv * 0.45) {
      const sock = 0.55 * eyeRl * Math.exp(-(((X - exS) ** 2) / (2 * (1.5 * eyeRl) ** 2)) - (((Y - eyS) ** 2) / (2 * (1.3 * eyeRl) ** 2)));
      Z -= Math.sign(Z) * sock * sstep(halfWv * 0.45, halfWv * 0.75, Math.abs(Z));
    }
    // opercular bulge — the gill-plate ridge behind the eye (replaces a bolted-on mesh)
    Z += Math.sign(Z) * 0.045 * W * Math.exp(-(((X - 0.18 * L) ** 2) / (2 * (0.05 * L) ** 2))) * sstep(0.35, 0.72, Math.abs(Z) / halfWv) * (1 - sstep(0.3, 0.42, t));
    pos.setXYZ(i, X, Y, Z);

    // ── color: countershading base ──
    let col = mix(belly, side, sstep(-0.8, 0.1, yn));
    col = mix(col, back, sstep(0.1, 0.8, yn));

    // ── species patterns ──
    const P = A.pattern;
    if (P === "bars" && A.bars) {
      const u = (X / L + 0.55) * A.bars - Y * 0.85;
      const p = u - Math.floor(u);
      const bar = (1 - sstep(0.24, 0.52, p)) * sstep(-0.34, -0.02, yn) * sstep(0.07, 0.15, t) * (1 - sstep(0.85, 0.96, t));
      col = mix(col, darkPat, bar * 0.93);
    } else if (P === "spots") {
      // trout: black spots + red spots with halo
      const cx = Math.floor(X * 6), cy = Math.floor(Y * 13);
      if (hash2(cx, cy) > 0.875 && yn > -0.45) col = mix(col, C("#20261e"), 0.8);
      const rx = Math.floor(X * 4.6 + 31), ry = Math.floor(Y * 9 + 17);
      if (hash2(rx, ry) > 0.93 && yn > -0.15 && yn < 0.55) {
        col = mix(col, C("#d9c9a4"), 0.35); // pale halo
        col = mix(col, C("#c04434"), 0.7);
      }
      if (A.pinkBand) {
        const band = Math.exp(-(Y * Y) / (2 * (0.17 * H) ** 2)) * (1 - sstep(0.86, 0.97, t));
        col = mix(col, C("#d18a90"), band * 0.5);
      }
    } else if (P === "toothbar") {
      // bass: horizontal jagged lateral blotch
      const s = Math.floor(X * 2.4);
      const jagY = -0.05 * H * (((s % 2) + 2) % 2 === 0 ? 1 : -1) * 0.7;
      const band = Math.exp(-((Y - jagY) ** 2) / (2 * (0.13 * H) ** 2)) * sstep(0.05, 0.12, t) * (1 - sstep(0.9, 1.0, t));
      const rag = 0.55 + 0.45 * vnoise(X * 5, Y * 3 + X);
      col = mix(col, C("#2e3a26"), band * rag * 0.92);
      if (hash2(Math.floor(X * 5), Math.floor(Y * 8)) > 0.92 && yn > 0.2) col = mix(col, darkPat, 0.45);
    } else if (P === "pikespots") {
      // bean-shaped light spots on olive + faint juvenile bars
      const n = vnoise(X * 2.3, Y * 6.5);
      if (n > 0.63 && yn > -0.5) col = mix(col, C("#d2cfa6"), 0.72);
      const u = (X / L + 0.5) * 9;
      const p = u - Math.floor(u);
      const jbar = (1 - sstep(0.3, 0.55, p)) * 0.14 * (1 - sstep(0.72, 0.9, t)) * sstep(-0.4, 0.1, yn);
      col = mix(col, C("#cfd0a4"), jbar);
      col = mix(col, C("#39422a"), sstep(0.35, 0.9, yn) * 0.35);
    } else if (P === "mottle") {
      const v = vnoise(X * 1.4, Y * 2.6);
      if (v > 0.6 && yn > -0.4) col = mix(col, C("#333c46"), 0.4);
      if (hash2(Math.floor(X * 7), Math.floor(Y * 9)) > 0.93 && yn > 0.0) col = mix(col, C("#2b333c"), 0.4);
    } else if (P === "lattice") {
      // crucian: visible scale rows, brick-offset
      const sy = Math.floor(Y * 9);
      const off = sy % 2 === 0 ? 0 : 0.5;
      const ux = X * 5.5 + off, uy = Y * 9;
      const fx = Math.abs(ux - Math.floor(ux) - 0.5), fy = Math.abs(uy - Math.floor(uy) - 0.5);
      if (Math.max(fx, fy) > 0.36 && yn > -0.7) col = col.multiplyScalar(0.72);
      col = col.multiplyScalar(0.96 + hash2(Math.floor(ux), sy) * 0.09);
    } else if (P === "xspots") {
      // salmon: dark x-crosses above the lateral line
      const ux = X * 4.5, uy = Y * 7;
      const fx = Math.abs(ux - Math.floor(ux) - 0.5), fy = Math.abs(uy - Math.floor(uy) - 0.5);
      const cross = Math.min(fx, fy) < 0.1;
      if (cross && hash2(Math.floor(ux), Math.floor(uy)) > 0.5 && yn > -0.15)
        col = mix(col, C("#222a30"), 0.75);
    } else {
      // plain silver (roach): faint lateral band
      const lb = Math.exp(-(Y * Y) / (2 * (0.1 * H) ** 2));
      col = mix(col, C("#5a655c"), lb * 0.12);
    }

    // operculum (gill plate) shading
    const gill = Math.exp(-(((X - 0.26 * L) ** 2) / (2 * (0.06 * L) ** 2)));
    const sideAmt = Math.abs(Z) / Math.max(0.001, W * 0.5 * widthProfile(def, t) + 0.001);
    col.multiplyScalar(1 - 0.22 * gill * sstep(0.35, 0.9, sideAmt));
    // sharp gill slit at the operculum's rear edge
    col.multiplyScalar(1 - 0.3 * Math.exp(-(((X - 0.235 * L) ** 2) / (2 * (0.011 * L) ** 2))) * sstep(0.4, 0.85, sideAmt) * (1 - sstep(0.32, 0.46, t)));
    // lateral line sheen
    const ll = Math.exp(-(Y * Y) / (2 * (0.035 * H) ** 2)) * sstep(0.5, 0.95, sideAmt);
    col = mix(col, C("#e6ece6"), ll * 0.18);
    // dorsal darkening seam
    col = mix(col, back, sstep(0.75, 0.95, yn) * 0.35);
    // organic micro-mottle: living skin is never a flat gradient
    const mot = (hash2(Math.floor(X * 21 + 5), Math.floor(Y * 27 + Z * 13)) - 0.5) * 0.07;
    col.multiplyScalar(1 + mot);

    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  if (isPike) geo.computeBoundingSphere();
  return geo;
}

// ── fin shape builders ────────────────────────────────────────────────────────
function caudalGeo(L: number, H: number, fork: number, tailSize: number): THREE.ShapeGeometry {
  const d = L * 0.3 * (0.8 + 0.3 * tailSize), h = H * 0.62 * (0.7 + 0.4 * fork);
  const notch = 0.3 + 0.55 * fork;
  const s = new THREE.Shape();
  s.moveTo(0, 0.1 * h);
  s.quadraticCurveTo(-d * 0.55, 0.5 * h, -d, h);
  s.quadraticCurveTo(-d * (0.42 + 0.22 * fork), 0.18 * h, -d * notch, 0);
  s.quadraticCurveTo(-d * (0.42 + 0.22 * fork), -0.18 * h, -d, -h);
  s.quadraticCurveTo(-d * 0.55, -0.5 * h, 0, -0.1 * h);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s, 8);
  // cup the lobes & sweep the tips back — a real forked tail isn't a flat card
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = Math.abs(y) / h;
    pos.setZ(i, -Math.pow(k, 1.5) * L * 0.055);
    pos.setX(i, pos.getX(i) - k * k * L * 0.045);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  mapUVs(geo, "fan");
  return geo;
}

function dorsalGeo(L: number, H: number, x0: number, x1: number, hMul: number): THREE.ShapeGeometry {
  const h = H * hMul;
  const s = new THREE.Shape();
  s.moveTo(x0, 0);
  s.quadraticCurveTo(x0 * 0.6, h * 0.95, (x0 + x1) * 0.42, h);
  s.quadraticCurveTo(x1 * 0.8, h * 0.75, x1, 0);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s, 5);
  mapUVs(geo, "parallel");
  return geo;
}

// perch/bass spiny dorsal with serrated leading spines
function spinyDorsalGeo(L: number, H: number, x0: number, x1: number, hMul: number): THREE.ShapeGeometry {
  const h = H * hMul;
  const s = new THREE.Shape();
  s.moveTo(x0, 0);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n;
    const b = x0 + ((x1 - x0) * (i + 1)) / n;
    const ht = h * (0.72 + 0.28 * Math.sin((Math.PI * (i + 0.5)) / n));
    s.lineTo((a + b) / 2, ht);
    s.lineTo(b, ht * 0.6);
  }
  s.lineTo(x1, 0);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s, 1);
  mapUVs(geo, "parallel");
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

  // wet skin: subtle scale relief + clearcoat sheen over the vertex paint
  const sheen = A.sheen ?? 0.3;
  const sTex = scaleTex().clone();
  sTex.needsUpdate = true;
  // tile at real dimensions: ~2 cm per scale, rows following body height
  const rx = L / 0.045 / 12, ry = H / 0.05 / 16;
  sTex.repeat.set(Math.max(0.5, rx), Math.max(0.35, ry));
  sTex.anisotropy = 8;
  const nTex = scaleNormalTex().clone();
  nTex.needsUpdate = true;
  nTex.repeat.copy(sTex.repeat);
  nTex.anisotropy = 8;
  const bodyMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, map: sTex, normalMap: nTex, normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: Math.max(0.16, A.roughness - sheen * 0.12), metalness: 0.08 + sheen * 0.34,
    clearcoat: 0.5 + sheen * 0.25, clearcoatRoughness: 0.34,
  });
  tintMats.push(bodyMat);
  const body = new THREE.Mesh(buildBody(def), bodyMat);
  body.castShadow = true;
  group.add(body);

  // fin membranes with visible rays
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

  // caudal peduncle + tail
  const ped = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), bodyMat);
  ped.scale.set(L * 0.16, H * 0.16, W * 0.14);
  ped.position.x = -L * 0.46;
  group.add(ped);
  const tailPivot = new THREE.Group();
  tailPivot.position.x = -L * 0.5;
  const tail = new THREE.Mesh(caudalGeo(L, H * A.tailSize, A.tailFork, A.tailSize), fanMat);
  tail.castShadow = true;
  tailPivot.add(tail);
  group.add(tailPivot);

  // dorsal fin(s)
  const D = A.dorsal;
  const flutter: THREE.Mesh[] = [];
  const dx0 = L * D.f, dx1 = -L * D.b;
  const dorsalY = H * (0.3 + A.hump * 0.28);
  if (D.spiky) {
    const d = new THREE.Mesh(spinyDorsalGeo(L, H, dx0, dx1, D.h), finMat);
    d.position.y = dorsalY;
    group.add(d);
    if (D.blotch) {
      const bl = new THREE.Mesh(
        new THREE.CircleGeometry(L * 0.045, 12),
        new THREE.MeshStandardMaterial({ color: "#241f18", roughness: 0.7, side: THREE.DoubleSide })
      );
      bl.position.set(dx1 + L * 0.012, dorsalY + H * D.h * 0.5, 0);
      group.add(bl);
    }
  } else {
    const d = new THREE.Mesh(dorsalGeo(L, H, dx0, dx1, D.h), finMat);
    d.position.y = dorsalY;
    group.add(d);
    flutter.push(d);
  }
  if (A.dorsal2) {
    const D2 = A.dorsal2;
    const d2 = new THREE.Mesh(dorsalGeo(L, H, L * D2.f, -L * D2.b, D2.h), finMat);
    d2.position.y = dorsalY * 0.97;
    group.add(d2);
    flutter.push(d2);
  }

  // anal fin (long ribbon on catfish)
  const An = A.anal;
  const anal = new THREE.Mesh(dorsalGeo(L, H, -L * An.f, -L * An.b, An.h), finMat);
  anal.rotation.z = Math.PI;
  anal.position.y = -H * 0.3;
  group.add(anal);
  flutter.push(anal);

  // adipose fin (trout / salmon / catfish)
  if (A.adipose) {
    const ad = new THREE.Mesh(dorsalGeo(L, H, -L * 0.3, -L * 0.37, 0.09), finMat);
    ad.position.y = H * 0.3;
    group.add(ad);
  }

  // pectoral fins (animated, curved sweep)
  const mkPect = (sideZ: 1 | -1) => {
    const piv = new THREE.Group();
    piv.position.set(L * 0.18, -H * 0.02, sideZ * W * 0.4);
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
  for (const sz of [1, -1]) {
    const pv = new THREE.Mesh(fanGeo(L * 0.1, L * 0.08), pairedMat);
    pv.position.set(L * 0.08, -H * 0.32, sz * W * 0.18);
    pv.rotation.z = 1.25;
    pv.rotation.y = sz * 0.3;
    group.add(pv);
  }

  // the operculum is now sculpted into the body mesh (bulge + gill slit paint)

  // mouth line
  const mouthMat = new THREE.MeshStandardMaterial({ color: "#1c2226", roughness: 1 });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(L * 0.05, H * 0.02, W * (isPikeish(A) ? 0.22 : 0.34)), mouthMat);
  mouth.position.set(L * (0.44 + A.snout * 0.04), -H * (0.02 + A.mouthVentral * 0.14), 0);
  group.add(mouth);

  // eyes — ball + species iris + pupil + wet cornea + catchlight
  // eyes: one textured sphere per side. Slightly larger than life so they
  // read at gallery zoom; wet but not mirror-bright so the iris survives the
  // tank lighting. The pupil is painted on, so it cannot be occluded or
  // mis-oriented — it simply IS the surface.
  const ex = L * (0.34 - A.snout * 0.09);
  const ey = H * (0.11 - A.snoutFlat * 0.05);
  const halfW = W * 0.5 * widthProfile(def, 0.5 - ex / L);
  // socketed eyes: never wider than the skull allows, and the ball's centre
  // sits INSIDE the head so only the corneal dome pokes out (not on stalks)
  const eyeBase = H * 0.155 * A.eyeScale * (0.85 + A.snout * 0.15);
  const eyeR = Math.max(0.03, Math.min(eyeBase, halfW * 0.62));
  const eyeMat = new THREE.MeshPhysicalMaterial({
    map: makeEyeTex(A.eye), roughness: 0.3, metalness: 0,
    clearcoat: 0.45, clearcoatRoughness: 0.3,
  });
  tintMats.push(eyeMat);
  const eyeGeo = new THREE.SphereGeometry(eyeR, 22, 16, -Math.PI / 2);
  const ballC = halfW - 0.38 * eyeR; // centre buried in the skull, dome proud of the flank
  for (const sz of [1, -1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(ex, ey, sz * ballC);
    if (sz < 0) eye.rotation.y = Math.PI; // pupil faces outward on both sides
    group.add(eye);
  }

  // barbels — curved whiskers along tube curves (channel catfish)
  if (A.barbels === "catfish") {
    const bMat = new THREE.MeshStandardMaterial({ color: "#414a54", roughness: 0.8 });
    const mkB = (sx: number, sy: number, sz: number, len: number, outZ: number) => {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(sx, sy, sz),
        new THREE.Vector3(sx + len * 0.55, sy - len * 0.22, sz + outZ * 0.5),
        new THREE.Vector3(sx + len * 0.8, sy - len * 0.55, sz + outZ)
      );
      const b = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.008, 5), bMat);
      group.add(b);
    };
    const mx = L * (0.44 - A.snout * 0.1), my = -H * 0.16;
    mkB(mx, my, W * 0.14, L * 0.42, W * 0.2);
    mkB(mx, my, -W * 0.14, L * 0.42, -W * 0.2);
    for (const s of [1, -1]) {
      mkB(L * 0.36, -H * 0.26, s * W * 0.1, L * 0.16, s * W * 0.08);
      mkB(L * 0.33, -H * 0.27, s * W * 0.05, L * 0.12, s * W * 0.05);
    }
  }

  // largemouth: maxilla reaching behind the eye
  if (A.jawBig) {
    const mouthMat2 = new THREE.MeshStandardMaterial({ color: "#2a3230", roughness: 0.9 });
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(L * 0.16, H * 0.018, W * 0.1), mouthMat2);
    jaw.position.set(L * 0.3, -H * 0.16, 0);
    jaw.rotation.z = 0.28;
    group.add(jaw);
  }

  let dead = false;
  let pectPh = Math.random() * 6;
  let tailAmp = 0.3;
  const update = (phase: number, speed01: number, dt: number, turn: number) => {
    if (dead) return;
    // tail amplitude eases toward speed — power builds into a burst, collapses into a glide
    tailAmp += (0.1 + 0.62 * speed01 - tailAmp) * Math.min(1, dt * 4.2);
    tailPivot.rotation.y = Math.sin(phase) * tailAmp;
    // body pre-flexes into a turn on top of the beat sway
    body.rotation.y = Math.sin(phase) * (0.018 + 0.035 * speed01) + turn * 0.11;
    body.rotation.z = Math.sin(phase * 0.5) * 0.012;
    // pectorals scull slowly when holding station, fold away when sprinting
    pectPh += dt * (2.4 + (1 - speed01) * 2.8);
    const pAmp = 0.5 - 0.32 * speed01;
    pectL.rotation.z = 0.75 + Math.sin(pectPh + 1.1) * pAmp;
    pectR.rotation.z = 0.75 + Math.sin(pectPh) * pAmp;
    // unpaired fins ripple faintly, faster with speed
    for (let i = 0; i < flutter.length; i++)
      flutter[i].rotation.y = Math.sin(phase * 0.63 + i * 2.1) * 0.055 * (0.3 + speed01);
  };

  const setDead = () => {
    dead = true;
    const gray = new THREE.Color("#94999b");
    for (const m of tintMats) {
      if (m.vertexColors) m.color.copy(gray);
      else m.color.lerp(gray, 0.75);
      m.clearcoat = 0.05;
      m.opacity = Math.min(m.opacity, 0.7);
    }
    tailPivot.rotation.y = 0.25;
  };

  return { group, body, update, setDead, baseMat: bodyMat };
}

function isPikeish(A: SpeciesDef["anatomy"]) { return A.snout > 0.7; }
