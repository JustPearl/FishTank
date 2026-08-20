import {
  SPECIES, UPGRADES, MILESTONES, DAY_LENGTH, ADMISSION_BASE,
  FEED_BTN_COST, FEED_CLICK_COST, CLEAN_COST, CLEAN_COOLDOWN,
} from "./data";
import type { Engine } from "./engine";
import { sfx } from "./audio";

export type Phase = "menu" | "playing" | "paused" | "over" | "won";
export interface FishRecord { id: string; speciesId: string; hunger: number; health: number; scale: number; dead: boolean; }
export interface Toast { id: number; kind: "good" | "warn" | "info" | "money"; msg: string; until: number; }

export interface FishView { id: string; speciesId: string; hunger: number; health: number; scale: number; }
export interface Snapshot {
  phase: Phase;
  cash: number; income: number; visitors: number; rep: number;
  day: number; clock: string; night: boolean;
  dirt: number; avgHunger: number; bioload: number; cap: number;
  fishCount: number; fish: FishView[]; speciesCount: Record<string, number>;
  owned: string[]; claimed: string[];
  cleanCd: number; bankruptWarn: number;
  toasts: Toast[];
  stats: { pellets: number; cleans: number; earned: number; deaths: number; peakVisitors: number; fishAdded: number };
  muted: boolean;
}

let uid = 1;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class Sim {
  phase: Phase = "menu";
  private engine: Engine;
  private fishes: FishRecord[] = [];
  private cash = 120;
  private dirt = 8;
  private rep = 46;
  private time = 0;
  private visitors = 0;
  private arrAcc = 0; private depAcc = 0;
  private owned = new Set<string>();
  private claimed = new Set<string>();
  private toasts: Toast[] = [];
  private cleanCd = 0;
  private lastAuto = -99;
  private bankruptT = 0;
  private incomeSamples: { t: number; amt: number }[] = [];
  private wonShown = false;
  muted = false;
  stats = { pellets: 0, cleans: 0, earned: 0, deaths: 0, peakVisitors: 0, fishAdded: 0 };

  constructor(engine: Engine) {
    this.engine = engine;
    engine.bindSim({
      getFish: (id) => this.fishes.find((f) => f.id === id),
      onPelletEaten: (id) => {
        const f = this.fishes.find((x) => x.id === id);
        if (!f || f.dead) return;
        f.hunger = Math.max(0, f.hunger - 26);
        f.scale = Math.min(1, f.scale + 0.004);
        this.dirt = clamp(this.dirt + 0.3, 0, 100);
        this.stats.pellets++;
        sfx.pop();
      },
      onPelletDecayed: () => { this.dirt = clamp(this.dirt + 0.7, 0, 100); },
      onFishGone: (id) => { this.fishes = this.fishes.filter((f) => f.id !== id); },
    });
    engine.onWaterClick = (x, y) => { if (this.phase === "playing") this.feedAt(x, y); };
    engine.onFrame = (dt) => { if (this.phase === "playing") this.step(dt); };
  }

  // ── public actions ────────────────────────────────────────────────────────
  start() { this.phase = "playing"; this.toast("info", "Grand opening day. Stock the tank!"); }
  togglePause() {
    if (this.phase === "playing") { this.phase = "paused"; this.engine.setPaused(true); }
    else if (this.phase === "paused") { this.phase = "playing"; this.engine.setPaused(false); }
  }
  continueAfterWin() { this.phase = "playing"; this.engine.setPaused(false); }
  reset() {
    this.engine.clearDynamic();
    this.engine.setPaused(false);
    this.fishes = []; this.cash = 120; this.dirt = 8; this.rep = 46; this.time = 0;
    this.visitors = 0; this.arrAcc = 0; this.depAcc = 0;
    this.owned = new Set(); this.claimed = new Set(); this.toasts = [];
    this.cleanCd = 0; this.lastAuto = -99; this.bankruptT = 0; this.incomeSamples = [];
    this.wonShown = false;
    this.stats = { pellets: 0, cleans: 0, earned: 0, deaths: 0, peakVisitors: 0, fishAdded: 0 };
    this.phase = "playing";
    this.engine.setDirt(this.dirt);
    this.toast("info", "Fresh water, fresh start.");
  }

  toggleMute() { this.muted = !this.muted; }

  get bioload() {
    return this.fishes.reduce((s, f) => {
      if (f.dead) return s;
      const d = SPECIES.find((x) => x.id === f.speciesId);
      return s + (d?.load ?? 0);
    }, 0);
  }
  get cap() { return this.owned.has("cap3") ? 24 : this.owned.has("cap2") ? 16 : 10; }

  buySpecies(id: string) {
    if (this.phase !== "playing") return;
    const def = SPECIES.find((s) => s.id === id);
    if (!def) return;
    const count = this.fishes.filter((f) => f.speciesId === id && !f.dead).length;
    if (def.requiresCap && this.cap < def.requiresCap) { this.deny("Locked — requires the Grand Tank."); return; }
    if (count >= def.maxOf) { this.deny(`${def.name}: tank limit reached.`); return; }
    if (this.bioload + def.load > this.cap) { this.deny("Bioload capacity full — expand the gallery."); return; }
    if (this.cash < def.cost) { this.deny("Not enough cash."); return; }
    this.cash -= def.cost;
    const rec: FishRecord = { id: "f" + uid++, speciesId: id, hunger: 35, health: 100, scale: def.startScale, dead: false };
    this.fishes.push(rec);
    this.stats.fishAdded++;
    this.engine.addFish(def, rec.id, rec.scale);
    sfx.splash();
    this.toast("good", `${def.name} released into the tank.`);
  }

  feedSprinkle() {
    if (this.phase !== "playing") return;
    if (this.cash < FEED_BTN_COST) { this.deny("Can't afford feed."); return; }
    this.cash -= FEED_BTN_COST;
    this.engine.dropPellets(6);
    sfx.plop();
  }

  feedAt(x: number, y: number) {
    if (this.cash < FEED_CLICK_COST) { this.deny("No cash for feed."); return; }
    this.cash -= FEED_CLICK_COST;
    this.engine.dropPellets(2, x, y);
    sfx.plop();
  }

  targetFeed(fishId: string) {
    if (this.phase !== "playing") return;
    const f = this.fishes.find((x) => x.id === fishId && !x.dead);
    if (!f) return;
    if (this.cash < FEED_BTN_COST) { this.deny("Can't afford feed."); return; }
    this.cash -= FEED_BTN_COST;
    this.engine.dropPelletsAt(fishId, 3);
    sfx.plop();
  }

  sellFish(fishId: string) {
    if (this.phase !== "playing") return;
    const f = this.fishes.find((x) => x.id === fishId);
    if (!f || f.dead) return;
    const def = SPECIES.find((s) => s.id === f.speciesId);
    const refund = Math.round((def?.cost ?? 10) * 0.5 * (0.5 + 0.5 * f.scale));
    this.cash += refund;
    this.fishes = this.fishes.filter((x) => x.id !== fishId);
    this.engine.removeFish(fishId);
    sfx.coin();
    this.toast("money", `${def?.name ?? "Fish"} rehomed  +$${refund}`);
  }

  clean() {
    if (this.phase !== "playing") return;
    if (this.cleanCd > 0) return;
    if (this.cash < CLEAN_COST) { this.deny("Can't afford a clean."); return; }
    this.cash -= CLEAN_COST;
    this.dirt = Math.max(0, this.dirt - 45);
    this.cleanCd = CLEAN_COOLDOWN;
    this.stats.cleans++;
    this.engine.setDirt(this.dirt);
    this.engine.shake(0.12);
    sfx.clean();
    this.toast("info", "Algae scrubbed, glass polished.");
  }

  buyUpgrade(id: string) {
    if (this.phase !== "playing") return;
    const up = UPGRADES.find((u) => u.id === id);
    if (!up || this.owned.has(id)) return;
    if (id === "filter3" && !this.owned.has("filter2")) { this.deny("Requires Filter Mk II."); return; }
    if (id === "cap3" && !this.owned.has("cap2")) { this.deny("Requires Gallery Expansion."); return; }
    if (id === "ad2" && !this.owned.has("ad1")) { this.deny("Requires Local Ads."); return; }
    if (this.cash < up.cost) { this.deny("Not enough cash."); return; }
    this.cash -= up.cost;
    this.owned.add(id);
    if (up.decor) this.engine.addDecor(up.decor);
    sfx.buy();
    this.toast("good", `Installed: ${up.name}.`);
  }

  private deny(msg: string) { sfx.error(); this.toast("warn", msg); }
  private toast(kind: Toast["kind"], msg: string) {
    this.toasts.push({ id: uid++, kind, msg, until: performance.now() + 4200 });
    if (this.toasts.length > 5) this.toasts.shift();
  }

  private earn(amt: number) {
    this.cash += amt;
    this.stats.earned += amt;
    this.incomeSamples.push({ t: this.time, amt });
    sfx.coin();
  }

  // ── economy tick ──────────────────────────────────────────────────────────
  private step(dt: number) {
    this.time += dt;
    this.cleanCd = Math.max(0, this.cleanCd - dt);
    const ph = (this.time % DAY_LENGTH) / DAY_LENGTH;
    const daylight = clamp(0.14 + sstep(0.03, 0.16, ph) * (1 - sstep(0.8, 0.94, ph)), 0.14, 1);
    this.engine.setDaylight(daylight);

    // water quality
    const filter = this.owned.has("filter3") ? 0.22 : this.owned.has("filter2") ? 0.13 : 0.05;
    this.dirt = clamp(this.dirt + (0.01 + this.bioload * 0.005 - filter) * dt, 0, 100);
    this.engine.setDirt(this.dirt);

    // fish vitals
    const alive = this.fishes.filter((f) => !f.dead);
    for (const f of alive) {
      const def = SPECIES.find((s) => s.id === f.speciesId)!;
      f.hunger = clamp(f.hunger + (0.7 + f.scale * 0.55) * dt, 0, 100);
      if (f.hunger >= 99.5) f.health -= 3.6 * dt;
      if (this.dirt > 65) f.health -= (this.dirt - 65) * 0.055 * dt;
      if (f.hunger < 80 && this.dirt < 72) f.health += 2.6 * dt;
      f.health = clamp(f.health, 0, 100);
      if (f.hunger < 85) f.scale = Math.min(1, f.scale + def.growth * dt * (1.15 - f.hunger / 120));
      if (f.health <= 0) {
        f.dead = true;
        this.stats.deaths++;
        this.rep = clamp(this.rep - 7, 0, 100);
        this.engine.markDead(f.id);
        this.engine.shake(0.18);
        sfx.die();
        this.toast("warn", `A ${def.name} has died. Visitors are upset.`);
      }
    }

    const avgHunger = alive.length ? alive.reduce((s, f) => s + f.hunger, 0) / alive.length : 0;
    const avgHealth = alive.length ? alive.reduce((s, f) => s + f.health, 0) / alive.length : 60;
    const variety = new Set(alive.map((f) => f.speciesId)).size;
    const appeal = alive.reduce((s, f) => {
      const d = SPECIES.find((x) => x.id === f.speciesId)!;
      return s + d.appeal * (0.45 + 0.55 * f.scale);
    }, 0) + (this.owned.has("wood") ? 2 : 0) + (this.owned.has("rocks") ? 3 : 0) + (this.owned.has("plants") ? 5 : 0);

    // satisfaction → reputation
    const sat = clamp(52 + (55 - this.dirt) * 0.65 + (avgHealth - 60) * 0.35 + variety * 3.5, 4, 100);
    this.rep = clamp(this.rep + (sat - this.rep) * Math.min(1, dt * 0.022), 0, 100);

    // visitors
    const marketing = (this.owned.has("ad1") ? 1.3 : 1) * (this.owned.has("ad2") ? 1.3 : 1);
    const target = Math.round((appeal * 0.55 + 0.7) * (0.45 + (this.rep / 100) * 0.9) * marketing * (0.25 + 0.75 * daylight));
    this.arrAcc += (target / 26) * dt;
    while (this.arrAcc >= 1) {
      this.arrAcc--;
      if (this.visitors < 40) {
        this.visitors++;
        this.stats.peakVisitors = Math.max(this.stats.peakVisitors, this.visitors);
        this.earn(ADMISSION_BASE * (0.55 + (this.rep / 100) * 0.9));
      }
    }
    this.depAcc += (this.visitors / 30) * dt;
    while (this.depAcc >= 1) { this.depAcc--; this.visitors = Math.max(0, this.visitors - 1); }

    // auto-feeder
    if (this.owned.has("feeder") && alive.length && avgHunger > 60 && this.cash >= 2 && this.time - this.lastAuto > 6) {
      this.lastAuto = this.time;
      this.cash -= 2;
      this.engine.dropPellets(4);
      sfx.plop();
    }

    // bankruptcy
    if (alive.length === 0 && this.cash < 18) {
      this.bankruptT += dt;
      if (this.bankruptT > 12) { this.phase = "over"; sfx.die(); }
    } else this.bankruptT = 0;

    // prune income samples
    this.incomeSamples = this.incomeSamples.filter((s) => this.time - s.t < 62);
    // prune toasts
    const now = performance.now();
    this.toasts = this.toasts.filter((t) => t.until > now);

    this.checkMilestones();
  }

  private checkMilestones() {
    const variety = new Set(this.fishes.filter((f) => !f.dead).map((f) => f.speciesId)).size;
    const conds: Record<string, boolean> = {
      stock1: this.fishes.some((f) => !f.dead),
      fed15: this.stats.pellets >= 15,
      clean3: this.stats.cleans >= 3,
      shoal: this.bioload >= 6,
      sp3: variety >= 3,
      crowd: this.stats.peakVisitors >= 8,
      sp5: variety >= 5,
      house: this.bioload >= 20,
      tycoon: this.cash >= 1500,
    };
    for (const m of MILESTONES) {
      if (!this.claimed.has(m.id) && conds[m.id]) {
        this.claimed.add(m.id);
        this.cash += m.reward;
        sfx.milestone();
        this.engine.shake(0.2);
        this.toast("money", `Milestone: ${m.name}  +$${m.reward}`);
      }
    }
    if (!this.wonShown && this.claimed.size >= MILESTONES.length) {
      this.wonShown = true;
      this.phase = "won";
      this.engine.setPaused(true);
      sfx.win();
    }
  }

  snapshot(): Snapshot {
    const ph = (this.time % DAY_LENGTH) / DAY_LENGTH;
    const mins = 8 * 60 + ph * 14 * 60;
    const hh = Math.floor(mins / 60) % 24, mm = Math.floor(mins % 60);
    const windowT = Math.min(62, Math.max(8, this.time));
    const income = this.incomeSamples.reduce((s, x) => s + x.amt, 0) * (60 / windowT);
    const speciesCount: Record<string, number> = {};
    for (const f of this.fishes) if (!f.dead) speciesCount[f.speciesId] = (speciesCount[f.speciesId] ?? 0) + 1;
    const alive = this.fishes.filter((f) => !f.dead);
    return {
      phase: this.phase, cash: this.cash, income, visitors: this.visitors, rep: this.rep,
      day: Math.floor(this.time / DAY_LENGTH) + 1,
      clock: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      night: ph > 0.82 || ph < 0.04,
      dirt: this.dirt,
      avgHunger: alive.length ? alive.reduce((s, f) => s + f.hunger, 0) / alive.length : 0,
      bioload: this.bioload, cap: this.cap,
      fishCount: alive.length,
      fish: alive.map((f) => ({ id: f.id, speciesId: f.speciesId, hunger: f.hunger, health: f.health, scale: f.scale })),
      speciesCount,
      owned: [...this.owned], claimed: [...this.claimed],
      cleanCd: this.cleanCd / CLEAN_COOLDOWN,
      bankruptWarn: this.bankruptT > 0 ? Math.max(0, 12 - this.bankruptT) : 0,
      toasts: [...this.toasts],
      stats: { ...this.stats },
      muted: this.muted,
    };
  }
}
