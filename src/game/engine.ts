import * as THREE from "three";
import { makeFish, type FishRig } from "./fish3d";
import type { SpeciesDef } from "./data";

export interface SimFishLike { hunger: number; scale: number; dead: boolean; }
export interface SimBridge {
  getFish: (id: string) => SimFishLike | undefined;
  onPelletEaten: (fishId: string) => void;
  onPelletDecayed: () => void;
  onFishGone: (fishId: string) => void;
}

const TANK = { hx: 8.35, y0: 0.62, y1: 5.95, hz: 2.25 };

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function radialTex(): THREE.CanvasTexture {
  return canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, "rgba(255,255,255,0.95)");
    gr.addColorStop(0.4, "rgba(255,255,255,0.5)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });
}

interface FishV {
  id: string; def: SpeciesDef; rig: FishRig;
  pos: THREE.Vector3; vel: THREE.Vector3; yaw: number; phase: number;
  target: THREE.Vector3; retarget: number; dashT: number; dashCool: number;
  spawnT: number; floatT: number;
}
interface Pellet { mesh: THREE.Mesh; vel: THREE.Vector3; settled: boolean; life: number; wob: number; }
interface LeafSway { piv: THREE.Object3D; base: number; ph: number; sp: number; }

export class Engine {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private container: HTMLElement | null = null;
  private ro: ResizeObserver | null = null;

  private fishes: FishV[] = [];
  private pellets: Pellet[] = [];
  private leafSwayers: LeafSway[] = [];
  private persistSway = 0;
  private decors: THREE.Object3D[] = [];
  private bridge: SimBridge | null = null;

  private dirt = 8;
  private daylight = 1;
  private paused = false;
  private shakeT = 0; private shakeAmp = 0;
  private mx = 0; private my = 0; private camDist = 15.8;
  private t = 0;
  private pan = new THREE.Vector3(0, 3.35, 0);
  private keys = new Set<string>();
  private focusId: string | null = null;
  private hoverDirty = false;
  private hoverNdc = new THREE.Vector2();
  private drag = { on: false, x: 0, y: 0, sx: 0, sy: 0, moved: false };

  private sun!: THREE.DirectionalLight;
  private amb!: THREE.HemisphereLight;
  private shaftMats: THREE.MeshBasicMaterial[] = [];
  private bubblePts!: THREE.Points; private bubbleData: { x: number; y: number; z: number; sp: number; ph: number; act: boolean }[] = [];
  private detPts!: THREE.Points; private detBase: Float32Array = new Float32Array(0);
  private detMat!: THREE.PointsMaterial;
  private bubbleMat!: THREE.PointsMaterial;
  private pelGeo = new THREE.SphereGeometry(0.06, 6, 5);
  private pelMat = new THREE.MeshStandardMaterial({ color: "#7a5a34", roughness: 0.9 });
  private aeratorPos = new THREE.Vector3(7.4, 0.75, -1.4);
  private bubbleAcc = 0;
  private oxygen = 90;
  private decorBubblers: THREE.Vector3[] = [];

  onFrame: ((dt: number) => void) | null = null;
  onWaterClick: ((x: number, y: number) => void) | null = null;
  onFishClick: ((id: string) => void) | null = null;
  onFocusLost: (() => void) | null = null;
  onZoomChange: ((pct: number) => void) | null = null;

  // ── lifecycle ─────────────────────────────────────────────────────────────
  init(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2("#1d6d78", 0.008);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.camera.position.set(0, 3.45, this.camDist);
    this.camera.lookAt(0, 3.35, 0);

    this.buildLights();
    this.buildTank();
    this.buildParticles();
    this.bindInput();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    this.clock.start();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.paused) { this.t += dt; this.update(dt); }
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement === this.container) this.container?.removeChild(this.renderer.domElement);
  }

  bindSim(b: SimBridge) { this.bridge = b; }
  setPaused(p: boolean) { this.paused = p; this.clock.getDelta(); }
  setDirt(d: number) { this.dirt = d; }
  setDaylight(d: number) { this.daylight = d; }
  setOxygen(o: number) { this.oxygen = o; }
  shake(amp: number) { this.shakeT = 1; this.shakeAmp = Math.max(this.shakeAmp, amp); }

  clearDynamic() {
    for (const f of this.fishes) this.scene.remove(f.rig.group);
    for (const p of this.pellets) this.scene.remove(p.mesh);
    for (const d of this.decors) this.scene.remove(d);
    this.fishes = []; this.pellets = []; this.decors = []; this.decorBubblers = [];
    this.leafSwayers = this.leafSwayers.slice(0, this.persistSway);
    this.focusId = null;
    this.pan.set(0, 3.35, 0);
    this.camDist = 15.8;
    this.emitZoom();
  }

  private resize() {
    if (!this.container) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ── scene construction ────────────────────────────────────────────────────
  private buildLights() {
    this.amb = new THREE.HemisphereLight("#cdeee2", "#3d574a", 0.95);
    this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight("#f2f7e8", 1.45);
    this.sun.position.set(4, 11, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 9; sc.bottom = -2; sc.near = 1; sc.far = 32;
    this.scene.add(this.sun);
    const fill = new THREE.PointLight("#6fc2c8", 0.85, 36);
    fill.position.set(-6, 4.5, 5.5);
    this.scene.add(fill);
    const front = new THREE.DirectionalLight("#cfe9e2", 0.55);
    front.position.set(-2, 5, 13);
    this.scene.add(front);
  }

  private buildTank() {
    const sandTex = canvasTex(512, 256, (g) => {
      g.fillStyle = "#87806e"; g.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 5200; i++) {
        const v = 112 + Math.random() * 72;
        g.fillStyle = `rgba(${v},${v - 8},${v - 20},${0.25 + Math.random() * 0.3})`;
        g.fillRect(Math.random() * 512, Math.random() * 256, 1.4, 1.4);
      }
      for (let i = 0; i < 140; i++) {
        const v = 96 + Math.random() * 88;
        g.fillStyle = `rgba(${v},${v - 6},${v - 16},0.8)`;
        g.beginPath();
        g.ellipse(Math.random() * 512, Math.random() * 256, 1.5 + Math.random() * 2.5, 1 + Math.random() * 1.8, Math.random() * 3, 0, Math.PI * 2);
        g.fill();
      }
    });
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
    sandTex.repeat.set(3, 1.2);
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(17.2, 5.4),
      new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.96, metalness: 0 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = TANK.y0 - 0.06;
    sand.receiveShadow = true;
    this.scene.add(sand);
    for (const [bx, bz, bs] of [[-5.5, -0.8, 1.6], [3.5, 0.6, 1.2], [6.8, -1.1, 1]] as const) {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(bs, 12, 8), sand.material as THREE.Material);
      mound.scale.set(1.8, 0.22, 1.1);
      mound.position.set(bx, TANK.y0 - 0.1, bz);
      mound.receiveShadow = true;
      this.scene.add(mound);
    }

    const backTex = canvasTex(256, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, "#2e848d");
      gr.addColorStop(0.55, "#1a5f6b");
      gr.addColorStop(1, "#0e4150");
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      g.globalAlpha = 0.1;
      for (let i = 0; i < 26; i++) {
        g.fillStyle = i % 2 ? "#1e6d78" : "#0b2f3b";
        g.fillRect(0, Math.random() * 256, 256, 2 + Math.random() * 8);
      }
    });
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(17.2, 7),
      new THREE.MeshStandardMaterial({ map: backTex, roughness: 1 })
    );
    back.position.set(0, 3.4, -2.7);
    back.receiveShadow = true;
    this.scene.add(back);

    // side glass
    const glassMat = new THREE.MeshStandardMaterial({ color: "#c9ede7", transparent: true, opacity: 0.13, roughness: 0.15, metalness: 0.2 });
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 7), glassMat);
      side.rotation.y = -sx * Math.PI / 2;
      side.position.set(sx * 8.6, 3.4, 0);
      this.scene.add(side);
    }
    // front glass streaks
    const streakTex = canvasTex(256, 256, (g) => {
      g.clearRect(0, 0, 256, 256);
      for (let i = 0; i < 9; i++) {
        const x = Math.random() * 256;
        const gr = g.createLinearGradient(x - 14, 0, x + 14, 0);
        gr.addColorStop(0, "rgba(255,255,255,0)");
        gr.addColorStop(0.5, "rgba(255,255,255,0.5)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.globalAlpha = 0.05 + Math.random() * 0.08;
        g.fillRect(x - 14, 0, 28, 256);
      }
    });
    const frontGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(17.2, 7),
      new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    frontGlass.position.set(0, 3.4, 2.92);
    this.scene.add(frontGlass);

    // frame + cabinet
    const frameMat = new THREE.MeshStandardMaterial({ color: "#0e2129", roughness: 0.6, metalness: 0.35 });
    const mkBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      m.position.set(x, y, z);
      this.scene.add(m);
    };
    mkBox(18.1, 0.42, 6.3, 0, 7.02, 0);
    mkBox(18.1, 0.3, 6.3, 0, -0.02, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mkBox(0.34, 7.4, 0.34, sx * 8.72, 3.5, sz * 2.85);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(18.4, 2.4, 6.6), new THREE.MeshStandardMaterial({ color: "#0a161c", roughness: 0.8 }));
    cab.position.set(0, -1.4, 0);
    this.scene.add(cab);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(18.42, 0.12, 6.62), new THREE.MeshStandardMaterial({ color: "#1d4652", roughness: 0.4, metalness: 0.5 }));
    trim.position.set(0, -0.24, 0);
    this.scene.add(trim);

    // water surface line
    const surf = new THREE.Mesh(
      new THREE.BoxGeometry(17.2, 0.07, 5.4),
      new THREE.MeshBasicMaterial({ color: "#c2f2e2", transparent: true, opacity: 0.5 })
    );
    surf.position.y = 6.14;
    this.scene.add(surf);

    // light shafts
    const shaftTex = canvasTex(64, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, "rgba(210,255,244,0.85)");
      gr.addColorStop(1, "rgba(210,255,244,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
      const gr2 = g.createLinearGradient(0, 0, 64, 0);
      gr2.addColorStop(0, "rgba(0,0,0,0)");
      gr2.addColorStop(0.5, "rgba(255,255,255,1)");
      gr2.addColorStop(1, "rgba(0,0,0,0)");
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = gr2; g.fillRect(0, 0, 64, 256);
    });
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: shaftTex, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + i * 0.5, 7.4), mat);
      sh.position.set(-5.5 + i * 3.6, 3.2, -1.2 + (i % 2) * 1.6);
      sh.rotation.z = 0.16 - i * 0.06;
      this.shaftMats.push(mat);
      this.scene.add(sh);
    }

    // aerator
    const aer = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), new THREE.MeshStandardMaterial({ color: "#2a3d42", roughness: 0.7 }));
    aer.position.copy(this.aeratorPos).add(new THREE.Vector3(0, -0.25, 0));
    this.scene.add(aer);

    // starter rocks + plants (persist across restarts)
    this.spawnRocks(-7.2, 3, true);
    this.spawnRocks(7.3, 2, true);
    this.spawnPlantClump(-6.4, 0.9, 9, 2.6, true);
    this.spawnPlantClump(6.6, -1.3, 6, 1.4, true);
    this.persistSway = this.leafSwayers.length;
  }

  private spawnRocks(cx: number, n: number, persist = false) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const r = 0.35 + Math.random() * 0.55;
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 0),
        new THREE.MeshStandardMaterial({ color: new THREE.Color("#4d544e").offsetHSL(0, 0, (Math.random() - 0.5) * 0.08), roughness: 1, flatShading: true })
      );
      rock.scale.set(1 + Math.random() * 0.5, 0.7 + Math.random() * 0.3, 0.9 + Math.random() * 0.4);
      rock.position.set(cx + (Math.random() - 0.5) * 1.6, TANK.y0 + r * 0.45, (Math.random() - 0.5) * 2.4);
      rock.rotation.set(Math.random(), Math.random() * 3, Math.random());
      rock.castShadow = true; rock.receiveShadow = true;
      g.add(rock);
    }
    this.scene.add(g);
    if (!persist) this.decors.push(g);
  }

  private spawnPlantClump(cx: number, cz: number, leaves: number, maxLen: number, persist = false) {
    const g = new THREE.Group();
    g.position.set(cx, TANK.y0 - 0.02, cz);
    const greens = ["#3f5a3a", "#4c6a3e", "#57703f", "#5c6b42", "#44604a"];
    for (let i = 0; i < leaves; i++) {
      const len = maxLen * (0.55 + Math.random() * 0.45);
      const w = 0.06 + Math.random() * 0.09;
      const geo = new THREE.PlaneGeometry(w, len, 1, 6);
      geo.translate(0, len / 2, 0);
      const posA = geo.attributes.position as THREE.BufferAttribute;
      const curl = (Math.random() - 0.5) * 0.5;
      for (let v = 0; v < posA.count; v++) {
        const yy = posA.getY(v);
        posA.setX(v, posA.getX(v) + Math.pow(yy / len, 2) * curl);
      }
      posA.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({ color: greens[i % greens.length], roughness: 0.85, side: THREE.DoubleSide });
      const piv = new THREE.Object3D();
      piv.rotation.y = Math.random() * Math.PI * 2;
      piv.rotation.z = (Math.random() - 0.5) * 0.3;
      const leaf = new THREE.Mesh(geo, mat);
      piv.add(leaf);
      g.add(piv);
      this.leafSwayers.push({ piv, base: piv.rotation.z, ph: Math.random() * 9, sp: 0.7 + Math.random() * 0.8 });
    }
    this.scene.add(g);
    if (!persist) this.decors.push(g);
  }

  addDecor(kind: "wood" | "rocks" | "plants" | "aircurtain" | "lightbar" | "rowboat" | "pebbles") {
    if (kind === "rocks") { this.spawnRocks(0.5, 3); return; }
    if (kind === "plants") { this.spawnPlantClump(-2.8, -1.5, 10, 3.1); this.spawnPlantClump(3.2, 1.2, 7, 2.2); return; }
    if (kind === "aircurtain") {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 8),
        new THREE.MeshStandardMaterial({ color: "#3a5a60", roughness: 0.5, metalness: 0.4 }));
      bar.rotation.x = Math.PI / 2;
      bar.position.set(-3.4, TANK.y0 + 0.12, 0);
      const g = new THREE.Group(); g.add(bar);
      this.scene.add(g); this.decors.push(g);
      for (let i = 0; i < 5; i++) this.decorBubblers.push(new THREE.Vector3(-3.4, TANK.y0 + 0.2, -1.4 + i * 0.7));
      return;
    }
    if (kind === "lightbar") {
      const g = new THREE.Group();
      const housing = new THREE.Mesh(new THREE.BoxGeometry(10, 0.22, 0.5),
        new THREE.MeshStandardMaterial({ color: "#20343c", roughness: 0.4, metalness: 0.6 }));
      housing.position.set(0, 6.75, 2.3);
      g.add(housing);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 5.4, 6.4, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: "#cfe9e2", transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.set(0, 3.5, 1.2);
      g.add(cone);
      const glow = new THREE.PointLight("#d8efe6", 0.55, 22);
      glow.position.set(0, 6.2, 1.6);
      g.add(glow);
      this.scene.add(g); this.decors.push(g);
      return;
    }
    if (kind === "rowboat") {
      const g = new THREE.Group();
      const woodMat = new THREE.MeshStandardMaterial({ color: "#5a4630", roughness: 0.9 });
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 1.5), woodMat);
      hull.position.set(0, 0.45, 0);
      g.add(hull);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.16, 1.6), new THREE.MeshStandardMaterial({ color: "#6d573c", roughness: 0.9 }));
      rim.position.set(0, 0.95, 0);
      g.add(rim);
      for (const bx of [-1.2, 0, 1.2]) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 1.5), woodMat);
        plank.position.set(bx, 1.0, 0);
        g.add(plank);
      }
      g.position.set(2.4, TANK.y0 - 0.15, -0.8);
      g.rotation.set(0.08, 0.5, 0.14);
      g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      this.scene.add(g); this.decors.push(g);
      return;
    }
    if (kind === "pebbles") {
      const g = new THREE.Group();
      const cols = ["#7d7468", "#8a8072", "#6e6a5e", "#94897a", "#5f5b50"];
      for (let i = 0; i < 40; i++) {
        const r = 0.07 + Math.random() * 0.13;
        const peb = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6),
          new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.85, flatShading: true }));
        peb.scale.set(1 + Math.random() * 0.4, 0.55 + Math.random() * 0.25, 1 + Math.random() * 0.4);
        peb.position.set((Math.random() - 0.5) * 11, TANK.y0 + r * 0.35, (Math.random() - 0.5) * 3.4);
        peb.rotation.y = Math.random() * Math.PI;
        g.add(peb);
      }
      this.scene.add(g); this.decors.push(g);
      return;
    }
    // driftwood
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: "#4d3a28", roughness: 0.95 });
    const mk = (r: number, len: number, x: number, y: number, z: number, rz: number, ry: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, len, 8), mat);
      m.position.set(x, y, z);
      m.rotation.set(0, ry, rz);
      m.castShadow = true;
      g.add(m);
    };
    mk(0.16, 2.6, -0.4, 1.5, -0.6, 0.9, 0.3);
    mk(0.12, 1.9, 0.9, 1.1, -0.2, -1.1, -0.4);
    mk(0.09, 1.2, 0.1, 2.3, -0.4, 0.2, 0.8);
    g.position.set(0.6, 0, 0.3);
    this.scene.add(g);
    this.decors.push(g);
  }

  private buildParticles() {
    const tex = radialTex();
    // bubbles
    const N = 90;
    const bPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.bubbleData.push({ x: 0, y: -10, z: 0, sp: 0, ph: Math.random() * 9, act: false });
      bPos[i * 3 + 1] = -10;
    }
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    this.bubbleMat = new THREE.PointsMaterial({ map: tex, color: "#e6f9f1", size: 0.11, transparent: true, opacity: 0.85, depthWrite: false });
    this.bubblePts = new THREE.Points(bGeo, this.bubbleMat);
    this.scene.add(this.bubblePts);
    // detritus
    const M = 80;
    this.detBase = new Float32Array(M * 3);
    for (let i = 0; i < M; i++) {
      this.detBase[i * 3] = (Math.random() - 0.5) * 16;
      this.detBase[i * 3 + 1] = 0.8 + Math.random() * 5;
      this.detBase[i * 3 + 2] = (Math.random() - 0.5) * 4.4;
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute("position", new THREE.BufferAttribute(this.detBase.slice(), 3));
    this.detMat = new THREE.PointsMaterial({ map: tex, color: "#39503a", size: 0.07, transparent: true, opacity: 0, depthWrite: false });
    this.detPts = new THREE.Points(dGeo, this.detMat);
    this.scene.add(this.detPts);
  }

  private emitBubble(x: number, y: number, z: number, big = false) {
    const d = this.bubbleData.find((b) => !b.act);
    if (!d) return;
    d.act = true; d.x = x + (Math.random() - 0.5) * 0.25; d.y = y; d.z = z + (Math.random() - 0.5) * 0.25;
    d.sp = (big ? 1.6 : 0.9) + Math.random() * 0.8;
  }

  // ── fish management ───────────────────────────────────────────────────────
  addFish(def: SpeciesDef, id: string, scale: number) {
    const rig = makeFish(def);
    rig.group.rotation.order = "YXZ";
    const yBand = def.ai === "bottom" ? [0.9, 2.0] : def.ai === "ambush" ? [2.4, 5.0] : [1.3, 5.3];
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      yBand[0] + Math.random() * (yBand[1] - yBand[0]),
      (Math.random() - 0.5) * 3
    );
    rig.group.position.copy(pos);
    rig.group.scale.setScalar(0.001);
    this.scene.add(rig.group);
    const fv: FishV = {
      id, def, rig, pos, vel: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, 0),
      yaw: Math.random() * Math.PI * 2, phase: Math.random() * 9,
      target: pos.clone(), retarget: 0, dashT: 0, dashCool: 3 + Math.random() * 5, spawnT: 0, floatT: 0,
    };
    this.fishes.push(fv);
    rig.group.scale.setScalar(scale);
    this.spawnBurst(pos, 10);
    this.scaleTarget.set(id, scale);
    this.spawnAnim.set(id, 0);
  }

  private scaleTarget = new Map<string, number>();
  private spawnAnim = new Map<string, number>();

  markDead(id: string) {
    const f = this.fishes.find((x) => x.id === id);
    if (f && f.floatT === 0) { f.rig.setDead(); f.floatT = 0.001; }
  }

  dropPellets(n: number, atX?: number, atY?: number) {
    for (let i = 0; i < n; i++) {
      if (this.pellets.length >= 42) {
        const old = this.pellets.shift();
        if (old) this.scene.remove(old.mesh);
      }
      const mesh = new THREE.Mesh(this.pelGeo, this.pelMat);
      const x = atX !== undefined ? atX + (Math.random() - 0.5) * 1.1 : (Math.random() - 0.5) * 13;
      const y = atY !== undefined ? atY + Math.random() * 0.3 : 5.9;
      mesh.position.set(x, Math.min(y, 5.9), (Math.random() - 0.5) * 2.5);
      this.scene.add(mesh);
      this.pellets.push({
        mesh, vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.25 - Math.random() * 0.2, 0),
        settled: false, life: 26, wob: Math.random() * 9,
      });
    }
    if (atX !== undefined) this.spawnBurst(new THREE.Vector3(atX, Math.min(atY ?? 5.9, 5.9), 0), 4);
  }

  private spawnBurst(p: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) this.emitBubble(p.x, p.y, p.z, true);
  }

  // ── per-frame update ──────────────────────────────────────────────────────
  private update(dt: number) {
    const t = this.t;
    // environment
    const dl = this.daylight;
    this.sun.intensity = 0.85 + 0.85 * dl + Math.sin(t * 1.7) * 0.03;
    this.amb.intensity = 0.62 + 0.35 * dl;
    const murk = this.dirt / 100;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.density = 0.006 + murk * 0.015;
    const fogCol = new THREE.Color("#1d6d78").lerp(new THREE.Color("#33512f"), murk * 0.85).multiplyScalar(0.72 + 0.28 * dl);
    fog.color.copy(fogCol);
    this.renderer.setClearColor(new THREE.Color("#0e3d47").lerp(new THREE.Color("#123326"), murk * 0.7));
    this.shaftMats.forEach((m, i) => { m.opacity = (0.06 + 0.08 * Math.abs(Math.sin(t * 0.25 + i * 1.7))) * (0.45 + 0.55 * dl) * (1 - murk * 0.8); });
    for (const l of this.leafSwayers) l.piv.rotation.z = l.base + Math.sin(t * l.sp + l.ph) * 0.1;
    this.detMat.opacity = murk * 0.55;
    const dPos = this.detPts.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dPos.count; i++) {
      dPos.setX(i, this.detBase[i * 3] + Math.sin(t * 0.3 + i) * 0.3);
      dPos.setY(i, this.detBase[i * 3 + 1] + Math.sin(t * 0.22 + i * 2.2) * 0.25);
    }
    dPos.needsUpdate = true;

    // bubbles
    this.bubbleAcc += dt * 7;
    while (this.bubbleAcc > 1) { this.bubbleAcc--; this.emitBubble(this.aeratorPos.x, this.aeratorPos.y, this.aeratorPos.z); }
    for (const b of this.decorBubblers) if (Math.random() < dt * 9) this.emitBubble(b.x, b.y, b.z);
    if (this.oxygen < 32) for (const f of this.fishes) if (Math.random() < dt * 2.2) this.emitBubble(f.pos.x, f.pos.y + 0.15, f.pos.z);
    const bPos = this.bubblePts.geometry.attributes.position as THREE.BufferAttribute;
    this.bubbleData.forEach((b, i) => {
      if (!b.act) return;
      b.y += b.sp * dt;
      if (b.y > 6.05) { b.act = false; b.y = -10; }
      bPos.setXYZ(i, b.x + Math.sin(t * 3 + b.ph) * 0.05, b.y, b.z);
    });
    bPos.needsUpdate = true;

    // camera: follow / keys pan / drag pan (applied in input) / parallax / shake
    const zk = this.camDist / 15.8;
    if (this.focusId) {
      const f = this.fishes.find((x) => x.id === this.focusId);
      if (f) {
        const fx = Math.max(-7.4, Math.min(7.4, f.pos.x));
        const fy = Math.max(1.2, Math.min(5.6, f.pos.y));
        this.pan.x += (fx - this.pan.x) * Math.min(1, dt * 3.2);
        this.pan.y += (fy - this.pan.y) * Math.min(1, dt * 3.2);
      }
    }
    const pv = 6.5 * zk * dt;
    let km = false;
    if (this.keys.has("arrowleft") || this.keys.has("a")) { this.pan.x -= pv; km = true; }
    if (this.keys.has("arrowright") || this.keys.has("d")) { this.pan.x += pv; km = true; }
    if (this.keys.has("arrowup") || this.keys.has("w")) { this.pan.y += pv; km = true; }
    if (this.keys.has("arrowdown") || this.keys.has("s")) { this.pan.y -= pv; km = true; }
    if (km) {
      this.pan.x = Math.max(-7.4, Math.min(7.4, this.pan.x));
      this.pan.y = Math.max(1.2, Math.min(5.6, this.pan.y));
      this.cancelFollow();
    }

    const sh = this.shakeT > 0 ? this.shakeT : 0;
    this.shakeT = Math.max(0, this.shakeT - dt * 2.4);
    const ox = (Math.random() - 0.5) * this.shakeAmp * sh;
    const oy = (Math.random() - 0.5) * this.shakeAmp * sh;
    if (sh === 0) this.shakeAmp = 0;
    const tx = this.pan.x + this.mx * 0.9 * zk + ox;
    const ty = this.pan.y + this.my * 0.5 * zk + oy;
    this.camera.position.x += (tx - this.camera.position.x) * Math.min(1, dt * 3);
    this.camera.position.y += (ty - this.camera.position.y) * Math.min(1, dt * 3);
    this.camera.position.z += (this.camDist - this.camera.position.z) * Math.min(1, dt * 4);
    this.camera.lookAt(this.pan.x, this.pan.y, 0);

    // hover → pointer cursor over fish
    if (this.hoverDirty && !this.drag.on) {
      this.hoverDirty = false;
      this.ray.setFromCamera(this.hoverNdc, this.camera);
      const over = this.ray.intersectObjects(this.fishes.map((f) => f.rig.body), false).length > 0;
      this.renderer.domElement.style.cursor = over ? "pointer" : "crosshair";
    }

    this.updatePellets(dt);
    this.updateFishes(dt);
    this.onFrame?.(dt);
  }

  private updatePellets(dt: number) {
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      p.wob += dt * 4;
      if (!p.settled) {
        p.vel.y = Math.max(p.vel.y - 0.25 * dt, -0.55);
        p.mesh.position.x += (p.vel.x + Math.sin(p.wob) * 0.06) * dt;
        p.mesh.position.y += p.vel.y * dt;
        if (p.mesh.position.y <= TANK.y0 + 0.05) { p.settled = true; p.mesh.position.y = TANK.y0 + 0.05; }
      } else {
        p.life -= dt * 1.6;
      }
      p.life -= dt * 0.4;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.pellets.splice(i, 1);
        this.bridge?.onPelletDecayed();
        continue;
      }
      const sc = Math.min(1, p.life / 2);
      p.mesh.scale.setScalar(sc);
    }
  }

  private updateFishes(dt: number) {
    for (let i = this.fishes.length - 1; i >= 0; i--) {
      const f = this.fishes[i];
      const sim = this.bridge?.getFish(f.id);

      // spawn scale-in
      const sa = this.spawnAnim.get(f.id);
      if (sa !== undefined && sa < 1) {
        const ns = Math.min(1, sa + dt * 2.2);
        this.spawnAnim.set(f.id, ns);
        const tgt = this.scaleTarget.get(f.id) ?? sim?.scale ?? 1;
        f.rig.group.scale.setScalar(Math.max(0.001, tgt * (0.3 + 0.7 * ns)));
      } else if (sim) {
        this.scaleTarget.set(f.id, sim.scale);
        f.rig.group.scale.setScalar(sim.scale);
      }

      // ─ dead float ─
      if (sim?.dead || f.floatT > 0) {
        f.floatT += dt;
        const g = f.rig.group;
        g.position.y += (6.0 - g.position.y) * Math.min(1, dt * 0.5);
        g.position.x += Math.sin(t0(f.floatT)) * 0.15 * dt;
        g.rotation.z += (Math.PI - g.rotation.z) * Math.min(1, dt * 0.8);
        g.rotation.x += (0.35 - g.rotation.x) * Math.min(1, dt);
        if (f.floatT > 7) {
          this.scene.remove(g);
          this.fishes.splice(i, 1);
          if (this.focusId === f.id) { this.focusId = null; this.onFocusLost?.(); }
          this.bridge?.onFishGone(f.id);
        }
        continue;
      }
      if (!sim) continue;

      const size = sim.scale;
      const L = f.def.L * size;
      const hunger = sim.hunger;
      const yBand: [number, number] = f.def.ai === "bottom" ? [0.9, 2.1] : f.def.ai === "ambush" ? [2.3, 5.2] : [1.2, 5.4];
      const bx = TANK.hx - L * 0.6, bz = TANK.hz - L * 0.2;

      // retarget
      f.retarget -= dt;
      let seekPellet: Pellet | null = null;
      if (hunger > 38 && this.pellets.length) {
        let best = 1e9;
        for (const p of this.pellets) {
          const d = p.mesh.position.distanceToSquared(f.pos);
          if (d < best) { best = d; seekPellet = p; }
        }
        if (best > (hunger > 70 ? 120 : 42)) seekPellet = null;
      }
      if (seekPellet) {
        f.target.copy(seekPellet.mesh.position);
      } else if (f.retarget <= 0) {
        f.retarget = 2.5 + Math.random() * 4;
        let tx = (Math.random() - 0.5) * 2 * bx * 0.9;
        let ty = yBand[0] + Math.random() * (yBand[1] - yBand[0]);
        const tz = (Math.random() - 0.5) * 2 * bz * 0.85;
        if (f.def.ai === "school") {
          let cx = 0, cy = 0, cz = 0, n = 0;
          for (const o of this.fishes) if (o !== f && o.def.id === f.def.id && o.floatT === 0) { cx += o.pos.x; cy += o.pos.y; cz += o.pos.z; n++; }
          if (n > 0) { tx = tx * 0.45 + (cx / n) * 0.55; ty = ty * 0.45 + (cy / n) * 0.55; }
        }
        f.target.set(tx, ty, tz);
      }
      // ambush dashes
      let spdMul = 1 + Math.max(0, hunger - 40) * 0.006;
      if (f.def.ai === "ambush") {
        f.dashCool -= dt;
        if (f.dashCool <= 0 && f.dashT <= 0) { f.dashT = 0.55; f.dashCool = 5 + Math.random() * 6; this.emitBubble(f.pos.x, f.pos.y, f.pos.z, true); }
        if (f.dashT > 0) { f.dashT -= dt; spdMul *= 3.4; }
        else spdMul *= 0.45;
      }

      const cruise = f.def.speed * (0.6 + size * 0.4);
      const desired = f.target.clone().sub(f.pos);
      const dist = desired.length();
      if (dist > 0.05) desired.normalize().multiplyScalar(cruise * spdMul);
      else desired.set(0, 0, 0);
      f.vel.lerp(desired, Math.min(1, dt * (seekPellet ? 3.2 : 1.6)));
      const maxSp = cruise * spdMul * 1.4;
      if (f.vel.length() > maxSp) f.vel.setLength(maxSp);
      f.pos.addScaledVector(f.vel, dt);
      // soft clamp
      f.pos.x = Math.max(-bx, Math.min(bx, f.pos.x));
      f.pos.y = Math.max(yBand[0] - 0.3, Math.min(yBand[1] + 0.3, f.pos.y));
      f.pos.z = Math.max(-bz, Math.min(bz, f.pos.z));

      // orientation
      const horiz = Math.hypot(f.vel.x, f.vel.z);
      if (horiz > 0.03) {
        const tyaw = Math.atan2(-f.vel.z, f.vel.x);
        let dy = tyaw - f.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        f.yaw += dy * Math.min(1, dt * 3.2);
      }
      const pitch = Math.max(-0.5, Math.min(0.5, -Math.atan2(f.vel.y, Math.max(0.1, horiz)) * 0.55));
      const g = f.rig.group;
      g.position.copy(f.pos);
      g.rotation.y = f.yaw;
      g.rotation.x += (pitch - g.rotation.x) * Math.min(1, dt * 4);
      g.rotation.z = Math.max(-0.4, Math.min(0.4, -((f.target.x - f.pos.x) * 0.0 + (f.vel.z * Math.cos(f.yaw) + f.vel.x * Math.sin(f.yaw)) * 0.25)));

      // animation + eating
      const sp01 = Math.min(1, f.vel.length() / 2.2);
      f.phase += dt * (4.5 + sp01 * 7.5);
      f.rig.update(f.phase, sp01);

      const eatR = 0.22 + L * 0.28;
      if (this.pellets.length) {
        for (let pi = this.pellets.length - 1; pi >= 0; pi--) {
          const p = this.pellets[pi];
          if (p.mesh.position.distanceToSquared(f.pos) < eatR * eatR) {
            this.scene.remove(p.mesh);
            this.pellets.splice(pi, 1);
            this.spawnBurst(p.mesh.position, 2);
            this.bridge?.onPelletEaten(f.id);
            break;
          }
        }
      }
      if (Math.random() < dt * 0.05) this.emitBubble(f.pos.x + Math.cos(f.yaw) * L * 0.5, f.pos.y + 0.1, f.pos.z - Math.sin(f.yaw) * L * 0.5);
    }
  }

  // ── input ─────────────────────────────────────────────────────────────────
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private hit = new THREE.Vector3();

  private bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      this.mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.my = -(((e.clientY - r.top) / r.height) * 2 - 1);
      this.hoverNdc.set(this.mx, this.my);
      this.hoverDirty = true;
      if (this.drag.on && e.buttons > 0) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX; this.drag.y = e.clientY;
        if (!this.drag.moved && Math.hypot(e.clientX - this.drag.sx, e.clientY - this.drag.sy) > 5) this.drag.moved = true;
        if (this.drag.moved) {
          const k = this.camDist / 15.8;
          this.pan.x = Math.max(-7.4, Math.min(7.4, this.pan.x - dx * 0.012 * k));
          this.pan.y = Math.max(1.2, Math.min(5.6, this.pan.y + dy * 0.01 * k));
          this.cancelFollow();
        }
      }
    });
    el.addEventListener("pointerdown", (e) => {
      this.drag = { on: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    });
    el.addEventListener("pointerup", (e) => {
      const wasDrag = this.drag.on && this.drag.moved;
      this.drag.on = false;
      if (wasDrag) return;
      const r = el.getBoundingClientRect();
      this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      this.ray.setFromCamera(this.ndc, this.camera);
      const hits = this.ray.intersectObjects(this.fishes.filter((f) => f.floatT === 0).map((f) => f.rig.body), false);
      if (hits.length) {
        const fv = this.fishes.find((f) => f.rig.body === hits[0].object);
        if (fv) { this.onFishClick?.(fv.id); return; }
      }
      if (this.ray.ray.intersectPlane(this.plane, this.hit)) {
        const x = Math.max(-TANK.hx + 0.5, Math.min(TANK.hx - 0.5, this.hit.x));
        const y = Math.max(1.0, Math.min(5.8, this.hit.y));
        this.onWaterClick?.(x, y);
      }
    });
    el.addEventListener("pointerleave", () => { this.drag.on = false; });
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.camDist = Math.max(9.5, Math.min(24, this.camDist + e.deltaY * 0.011));
      this.emitZoom();
    }, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(k)) {
      this.keys.add(k);
      if (k.startsWith("arrow")) e.preventDefault();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };

  // ── camera API ────────────────────────────────────────────────────────────
  private emitZoom() { this.onZoomChange?.(Math.round((15.8 / this.camDist) * 100)); }
  zoomBy(d: number) {
    this.camDist = Math.max(9.5, Math.min(24, this.camDist - d));
    this.emitZoom();
  }
  focusFish(id: string | null) {
    this.focusId = id;
    if (id && this.camDist > 12.5) { this.camDist = 12.5; this.emitZoom(); }
  }
  private cancelFollow() {
    if (this.focusId) { this.focusId = null; this.onFocusLost?.(); }
  }

  removeFish(id: string) {
    const i = this.fishes.findIndex((f) => f.id === id);
    if (i >= 0) { this.scene.remove(this.fishes[i].rig.group); this.fishes.splice(i, 1); }
    if (this.focusId === id) { this.focusId = null; this.onFocusLost?.(); }
  }

  dropPelletsAt(id: string, n: number) {
    const f = this.fishes.find((x) => x.id === id);
    if (!f) return;
    this.dropPellets(n, f.pos.x, Math.min(5.9, f.pos.y + 1.1));
  }
}

function t0(x: number) { return x * 1.3; }
