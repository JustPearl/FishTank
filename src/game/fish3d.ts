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
  baseMat: THREE.MeshStandardMaterial;
}

// ── body geometry with species-specific sculpt + vertex-painted anatomy ──────
function buildBody(def: SpeciesDef): THREE.BufferGeometry {
  const { L, HR, WR } = def;
  const H = L * HR, W = H * WR;
  const A = def.anatomy;
  const back = C(A.back), side = C(A.side), belly = C(A.belly);
  const darkPat = C("#222a1e");
  const isPike = A.snout > 0.7;

  const geo = new THREE.SphereGeometry(0.5, 36, 24);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = 0.5 - x; // 0 snout → 1 tail
    const yn = y * 2;  // -1 belly → +1 back

    // ── sculpt ──
    const snL = 0.1 + A.snout * 0.16;
    const sn = 0.3 + 0.7 * sstep(0, snL, t);                 // snout taper (radius fraction)
    const yCrush = 1 - A.snoutFlat * 0.55 * (1 - sstep(0, 0.3, t)); // pike duckbill flatten
    const zSn = 1 - (0.24 - A.snout * 0.12) * (1 - sstep(0, 0.18, t));
    const tt = 1 - A.taperAmt * sstep(A.taperStart, A.taperEnd, t); // caudal taper
    const hw = 1 + (A.headWide - 1) * (1 - sstep(0.04, 0.34, t));   // catfish broad head
    const hd = 1 - (A.headWide - 1) * 0.32 * (1 - sstep(0, 0.3, t));
    const bump = A.hump * H * 0.55 * Math.exp(-((t - 0.32) ** 2) / (2 * 0.15 ** 2)) * (1 - sstep(0.82, 0.96, t));

    const X = x * L;
    const Y = y * H * sn * tt * yCrush * hd + bump * (yn > 0 ? yn : 0.12 * yn);
    const Z = z * W * zSn * tt * hw;
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
      col = mix(col, darkPat, bar * 0.88);
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
      col = mix(col, C("#2e3a26"), band * rag * 0.85);
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
      if (Math.max(fx, fy) > 0.36 && yn > -0.7) col = col.multiplyScalar(0.8);
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
    const sideAmt = Math.abs(Z) / Math.max(0.001, W * 0.5 * tt * hw + 0.001);
    col.multiplyScalar(1 - 0.22 * gill * sstep(0.35, 0.9, sideAmt));
    // lateral line sheen
    const ll = Math.exp(-(Y * Y) / (2 * (0.035 * H) ** 2)) * sstep(0.5, 0.95, sideAmt);
    col = mix(col, C("#e6ece6"), ll * 0.18);
    // dorsal darkening seam
    col = mix(col, back, sstep(0.75, 0.95, yn) * 0.35);

    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  if (isPike) geo.computeBoundingSphere();
  return geo;
}

// ── fin shape builders ────────────────────────────────────────────────────────
function caudalGeo(L: number, H: number, fork: number): THREE.ShapeGeometry {
  const d = L * 0.3, h = H * 0.62 * (0.7 + 0.4 * fork);
  const notch = 0.3 + 0.55 * fork;
  const s = new THREE.Shape();
  s.moveTo(0, 0.1 * h);
  s.quadraticCurveTo(-d * 0.55, 0.5 * h, -d, h);
  s.quadraticCurveTo(-d * (0.42 + 0.22 * fork), 0.18 * h, -d * notch, 0);
  s.quadraticCurveTo(-d * (0.42 + 0.22 * fork), -0.18 * h, -d, -h);
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
  return new THREE.ShapeGeometry(s, 1);
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
  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: A.roughness, metalness: 0.24,
  });
  const body = new THREE.Mesh(buildBody(def), bodyMat);
  body.castShadow = true;
  group.add(body);

  const finMat = new THREE.MeshStandardMaterial({
    color: A.fin, roughness: 0.5, metalness: 0.08, transparent: true, opacity: 0.92, side: THREE.DoubleSide,
  });
  const pairedMat = new THREE.MeshStandardMaterial({
    color: A.finPaired, roughness: 0.5, metalness: 0.08, transparent: true, opacity: 0.92, side: THREE.DoubleSide,
  });

  // caudal peduncle + tail
  const ped = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), bodyMat);
  ped.scale.set(L * 0.16, H * 0.16, W * 0.14);
  ped.position.x = -L * 0.46;
  group.add(ped);
  const tailPivot = new THREE.Group();
  tailPivot.position.x = -L * 0.5;
  const tail = new THREE.Mesh(caudalGeo(L, H * A.tailSize, A.tailFork), finMat);
  tail.castShadow = true;
  tailPivot.add(tail);
  group.add(tailPivot);

  // dorsal fin(s)
  const D = A.dorsal;
  const dx0 = L * D.f, dx1 = -L * D.b;
  const dorsalY = H * (0.3 + A.hump * 0.28);
  const flutter: THREE.Mesh[] = [];
  if (D.spiky) {
    const d = new THREE.Mesh(spinyDorsalGeo(L, H, dx0, dx1, D.h), finMat);
    d.position.y = dorsalY;
    group.add(d);
    flutter.push(d);
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

  // pectoral fins (animated)
  const mkPect = (sideZ: 1 | -1) => {
    const piv = new THREE.Group();
    piv.position.set(L * 0.18, -H * 0.02, sideZ * W * 0.4);
    const fin = new THREE.Mesh(fanGeo(L * 0.19, L * 0.13), pairedMat);
    fin.rotation.y = sideZ * 0.5;
    piv.add(fin);
    piv.rotation.z = 0.7;
    group.add(piv);
    return piv;
  };
  const pectL = mkPect(1), pectR = mkPect(-1);

  // pelvic fins
  for (const sz of [1, -1]) {
    const pv = new THREE.Mesh(fanGeo(L * 0.11, L * 0.09), pairedMat);
    pv.position.set(L * 0.08, -H * 0.32, sz * W * 0.2);
    pv.rotation.z = 1.2;
    pv.rotation.y = sz * 0.3;
    group.add(pv);
  }

  // eyes — roach has its signature crimson eye
  const eyeR = Math.max(0.018, H * 0.105 * A.eyeScale);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: A.eye, roughness: 0.2, metalness: 0.45,
    emissive: A.eye, emissiveIntensity: 0.22,
  });
  const pupilMat = new THREE.MeshStandardMaterial({ color: "#0a0c0d", roughness: 0.1 });
  const eyeX = L * (0.34 - A.snout * 0.07);
  const eyeY = H * (0.11 - A.snoutFlat * 0.06);
  for (const sz of [1, -1]) {
    const ez = sz * W * 0.33 * A.headWide * 0.92;
    const e = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 10, 8), eyeMat);
    e.position.set(eyeX, eyeY, ez);
    const p = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.55, 8, 6), pupilMat);
    p.position.set(eyeX + eyeR * 0.2, eyeY, ez + sz * eyeR * 0.6);
    group.add(e, p);
  }

  // mouth line (ventral on bream-type feeders, big gape on bass)
  const mouthMat = new THREE.MeshStandardMaterial({ color: "#1e242a", roughness: 0.9 });
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(L * 0.05 * (A.jawBig ? 1.9 : 1), H * 0.03, W * 0.34),
    mouthMat
  );
  mouth.position.set(L * (0.46 - A.snout * 0.13), -H * (0.1 + A.mouthVentral * 0.22), 0);
  group.add(mouth);
  if (A.jawBig) {
    // maxilla reaching behind the eye — the "largemouth"
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(L * 0.16, H * 0.018, W * 0.1), mouthMat);
    jaw.position.set(L * 0.3, -H * 0.16, 0);
    jaw.rotation.z = 0.28;
    group.add(jaw);
  }

  // barbels — channel catfish: 2 long maxillary + 4 chin whiskers
  if (A.barbels === "catfish") {
    const bMat = new THREE.MeshStandardMaterial({ color: "#414a54", roughness: 0.8 });
    const mkB = (x: number, y: number, z: number, len: number, tilt: number) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.004, len, 5), bMat);
      b.position.set(x + Math.cos(tilt) * len * 0.5, y - Math.sin(tilt) * len * 0.5, z);
      b.rotation.z = Math.PI / 2 - tilt;
      group.add(b);
    };
    const mx = L * (0.44 - A.snout * 0.1), my = -H * 0.16;
    mkB(mx, my, W * 0.14, L * 0.42, 0.5);
    mkB(mx, my, -W * 0.14, L * 0.42, 0.5);
    for (const sz of [1, -1]) {
      mkB(L * 0.36, -H * 0.26, sz * W * 0.1, L * 0.16, 0.9);
      mkB(L * 0.33, -H * 0.27, sz * W * 0.05, L * 0.12, 1.0);
    }
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
    bodyMat.color.set("#8d9294");
    finMat.opacity = 0.55;
    pairedMat.opacity = 0.55;
    tailPivot.rotation.y = 0.25;
  };

  return { group, body, update, setDead, baseMat: bodyMat };
}
