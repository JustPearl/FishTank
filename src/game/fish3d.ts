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
  update: (phase: number, speed01: number) => void;
  setDead: () => void;
  baseMat: THREE.MeshStandardMaterial;
}

// ── body geometry with vertex-painted anatomy ────────────────────────────────
function buildBody(def: SpeciesDef): THREE.BufferGeometry {
  const { L, HR, WR } = def;
  const H = L * HR, W = H * WR;
  const A = def.anatomy;
  const back = C(A.back), side = C(A.side), belly = C(A.belly);
  const stripe = A.stripe ? C(A.stripe) : null;
  const elong = A.elongate ? 1 : 0;

  const geo = new THREE.SphereGeometry(0.5, 32, 22);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = 0.5 - x; // 0 snout → 1 tail
    const tailTaper = 1 - 0.74 * sstep(0.55, 0.97, t);
    const snoutTaper = (elong ? 0.5 : 0.7) + (elong ? 0.5 : 0.3) * sstep(0.0, 0.18, t);
    const s = tailTaper * snoutTaper;
    const X = x * L * (1 + 0.3 * elong * sstep(0.12, 0, t));
    const Y = y * H * s * (1 - 0.2 * t);
    const Z = z * W * s;
    pos.setXYZ(i, X, Y, Z);

    const yn = y * 2; // -1 belly → +1 back (pre-taper normal)
    // countershading
    let col = mix(belly, side, sstep(-0.75, 0.15, yn));
    col = mix(col, back, sstep(0.15, 0.85, yn));

    // patterns
    if (A.pattern === "bars") {
      const p = (X * 5.2 + Math.sin(Y * 9) * 0.15) % 1;
      const bar = (1 - sstep(0.3, 0.5, p < 0 ? p + 1 : p)) * sstep(-0.35, 0.0, yn) * 0.85;
      col = mix(col, C("#1d2a18"), bar);
    } else if (A.pattern === "blotch") {
      const band = Math.exp(-((Y + 0.02 * H) ** 2) / (2 * (0.2 * H) ** 2));
      const jag = vnoise(X * 2.1, Y * 6) > 0.42 ? 1 : 0;
      col = mix(col, C("#28331f"), band * jag * 0.8 * (1 - sstep(0.6, 0.9, t)));
    } else if (A.pattern === "speckle") {
      const n = hash2(Math.floor(X * 9), Math.floor(Y * 12));
      if (n > 0.9) col = mix(col, C("#20261c"), 0.7);
      if (hash2(Math.floor(X * 5 + 40), Math.floor(Y * 6)) > 0.955 && Math.abs(yn) < 0.4)
        col = mix(col, C("#b04a3c"), 0.55);
      if (stripe && Math.abs(Z) > W * 0.28)
        col = mix(col, stripe, Math.exp(-(Y * Y) / (2 * (0.17 * H) ** 2)) * 0.5);
    } else if (A.pattern === "pikespots") {
      const n = vnoise(X * 3.2, Y * 8.5);
      if (n > 0.6 && yn > -0.3) col = mix(col, C("#cfc9a2"), 0.75);
      col = mix(col, C("#39422a"), sstep(0.4, 0.95, yn) * 0.35);
    } else if (A.pattern === "mottle") {
      const v = vnoise(X * 1.3, Y * 2.4);
      if (v > 0.58 && yn > -0.5) col = mix(col, C("#2e363f"), 0.55);
    } else if (A.pattern === "xspots") {
      if (hash2(Math.floor(X * 6), Math.floor(Y * 8)) > 0.92 && yn > -0.1)
        col = mix(col, C("#222a30"), 0.8);
    }

    // operculum (gill plate) shading
    const gill = Math.exp(-(((X - 0.28 * L) ** 2) / (2 * (0.055 * L) ** 2)));
    const sideAmt = Math.abs(Z) / Math.max(0.001, W * 0.5 * s + 0.001);
    col.multiplyScalar(1 - 0.2 * gill * sstep(0.4, 0.9, sideAmt));
    // lateral line
    const ll = Math.exp(-(Y * Y) / (2 * (0.035 * H) ** 2)) * sstep(0.5, 0.95, sideAmt);
    col = mix(col, C("#dfe5dd"), ll * 0.16);

    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// ── fin shape builders ────────────────────────────────────────────────────────
function caudalGeo(L: number, H: number, fork: number): THREE.ShapeGeometry {
  const d = L * 0.3, h = H * 0.62 * (0.75 + 0.35 * fork);
  const notch = 0.35 + 0.5 * fork;
  const s = new THREE.Shape();
  s.moveTo(0, 0.1 * h);
  s.quadraticCurveTo(-d * 0.55, 0.5 * h, -d, h);
  s.quadraticCurveTo(-d * (0.45 + 0.2 * fork), 0.18 * h, -d * notch, 0);
  s.quadraticCurveTo(-d * (0.45 + 0.2 * fork), -0.18 * h, -d, -h);
  s.quadraticCurveTo(-d * 0.55, -0.5 * h, 0, -0.1 * h);
  s.closePath();
  return new THREE.ShapeGeometry(s, 6);
}

function dorsalGeo(L: number, H: number, x0: number, x1: number, hMul: number): THREE.ShapeGeometry {
  const h = H * hMul;
  const s = new THREE.Shape();
  s.moveTo(x0, 0);
  s.quadraticCurveTo(x0 * 0.6, h * 0.95, (x0 + x1) * 0.42, h);
  s.quadraticCurveTo(x1 * 0.8, h * 0.75, x1, 0);
  s.closePath();
  return new THREE.ShapeGeometry(s, 5);
}

function fanGeo(w: number, h: number): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(-w * 0.35, -h * 0.45, -w, -h * 0.62);
  s.quadraticCurveTo(-w * 0.5, -h * 0.1, -w * 0.35, -h * 0.02);
  s.quadraticCurveTo(-w * 0.15, h * 0.12, 0, 0);
  s.closePath();
  return new THREE.ShapeGeometry(s, 4);
}

// ── full rig ──────────────────────────────────────────────────────────────────
export function makeFish(def: SpeciesDef): FishRig {
  const { L, HR, WR } = def;
  const H = L * HR, W = H * WR;
  const A = def.anatomy;

  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.22 });
  const body = new THREE.Mesh(buildBody(def), bodyMat);
  body.castShadow = true;
  group.add(body);

  const finMat = new THREE.MeshStandardMaterial({
    color: A.fin, roughness: 0.5, metalness: 0.08, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const finMatDark = finMat.clone();
  finMatDark.color = C(A.fin).multiplyScalar(0.75);

  // caudal peduncle + tail
  const ped = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), bodyMat);
  ped.scale.set(L * 0.16, H * 0.16, W * 0.14);
  ped.position.x = -L * 0.46;
  group.add(ped);
  const tailPivot = new THREE.Group();
  tailPivot.position.x = -L * 0.5;
  const tail = new THREE.Mesh(caudalGeo(L, H, A.tailFork), finMat);
  tail.castShadow = true;
  tailPivot.add(tail);
  group.add(tailPivot);

  // dorsal(s)
  if (A.twoDorsal) {
    const d1 = new THREE.Mesh(dorsalGeo(L, H, L * 0.16, -L * 0.08, 0.42), finMatDark);
    d1.position.y = H * 0.34;
    const d2 = new THREE.Mesh(dorsalGeo(L, H, -L * 0.1, -L * 0.3, 0.3), finMat);
    d2.position.y = H * 0.32;
    group.add(d1, d2);
  } else {
    const dx0 = A.elongate ? -L * 0.12 : L * 0.14;
    const dx1 = A.elongate ? -L * 0.36 : -L * 0.22;
    const d = new THREE.Mesh(dorsalGeo(L, H, dx0, dx1, A.elongate ? 0.34 : 0.4), finMat);
    d.position.y = H * 0.34;
    group.add(d);
  }

  // anal fin
  const anal = new THREE.Mesh(dorsalGeo(L, H, -L * 0.14, -L * 0.32, 0.22), finMat);
  anal.rotation.z = Math.PI;
  anal.position.y = -H * 0.3;
  group.add(anal);

  // adipose fin
  if (A.adipose) {
    const ad = new THREE.Mesh(dorsalGeo(L, H, -L * 0.3, -L * 0.38, 0.1), finMatDark);
    ad.position.y = H * 0.32;
    group.add(ad);
  }

  // pectoral fins (animated)
  const mkPect = (sideZ: 1 | -1) => {
    const piv = new THREE.Group();
    piv.position.set(L * 0.2, -H * 0.02, sideZ * W * 0.4);
    const fin = new THREE.Mesh(fanGeo(L * 0.2, L * 0.14), finMat);
    fin.rotation.y = sideZ * 0.5;
    piv.add(fin);
    piv.rotation.z = 0.7;
    group.add(piv);
    return piv;
  };
  const pectL = mkPect(1), pectR = mkPect(-1);

  // pelvic fins
  for (const sz of [1, -1]) {
    const pv = new THREE.Mesh(fanGeo(L * 0.11, L * 0.09), finMat);
    pv.position.set(L * 0.1, -H * 0.34, sz * W * 0.2);
    pv.rotation.z = 1.2;
    pv.rotation.y = sz * 0.3;
    group.add(pv);
  }

  // eyes
  const eyeR = Math.max(0.028, H * 0.1);
  const eyeMat = new THREE.MeshStandardMaterial({ color: "#d8cfa8", roughness: 0.25, metalness: 0.4 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: "#0a0c0d", roughness: 0.1 });
  for (const sz of [1, -1]) {
    const ez = sz * W * 0.36 * (0.7 + 0.3 * (A.elongate ? 0.6 : 1));
    const ex = L * (A.elongate ? 0.36 : 0.34);
    const ey = H * (A.elongate ? 0.14 : 0.1);
    const e = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 10, 8), eyeMat);
    e.position.set(ex, ey, ez);
    const p = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.58, 8, 6), pupilMat);
    p.position.set(ex + eyeR * 0.25, ey, ez + sz * eyeR * 0.55);
    group.add(e, p);
  }

  // barbels (catfish whiskers)
  if (A.barbels) {
    const bMat = new THREE.MeshStandardMaterial({ color: "#3a424b", roughness: 0.8 });
    const mkB = (x: number, y: number, z: number, len: number, droop: number) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.004, len, 5), bMat);
      b.position.set(x + len * 0.3, y - droop, z);
      b.rotation.z = Math.PI / 2 - 0.5;
      group.add(b);
    };
    mkB(L * 0.44, -H * 0.06, W * 0.14, L * 0.26, 0.05);
    mkB(L * 0.44, -H * 0.06, -W * 0.14, L * 0.26, 0.05);
    mkB(L * 0.4, -H * 0.2, W * 0.1, L * 0.15, 0.04);
    mkB(L * 0.4, -H * 0.2, -W * 0.1, L * 0.15, 0.04);
  }

  let dead = false;
  const update = (phase: number, speed01: number) => {
    if (dead) return;
    tailPivot.rotation.y = Math.sin(phase) * (0.32 + 0.42 * speed01);
    body.rotation.y = Math.sin(phase) * 0.045;
    body.rotation.z = Math.sin(phase * 0.5) * 0.02;
    pectL.rotation.z = 0.7 + Math.sin(phase * 0.55 + 1) * 0.38;
    pectR.rotation.z = 0.7 + Math.sin(phase * 0.55 + 2) * 0.38;
  };

  const setDead = () => {
    dead = true;
    bodyMat.color.set("#8d9294");
    finMat.opacity = 0.55;
    finMatDark.opacity = 0.55;
    tailPivot.rotation.y = 0.25;
  };

  return { group, update, setDead, baseMat: bodyMat };
}
