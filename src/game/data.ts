// ── Greyline Aquarium: game data ──────────────────────────────────────────────

export interface SpeciesDef {
  id: string;
  name: string;
  latin: string;
  fact: string;
  cost: number;
  appeal: number;      // visitor appeal at full size
  load: number;        // bioload units
  maxOf: number;       // max individuals allowed
  L: number;           // body length in scene units at full size
  HR: number;          // height ratio (H = L*HR)
  WR: number;          // width ratio (W = H*WR)
  startScale: number;  // fraction of full size when bought
  growth: number;      // scale units per second (well fed)
  speed: number;       // cruise speed units/s
  ai: "school" | "bottom" | "ambush" | "cruise";
  requiresCap?: number; // requires this bioload capacity
  anatomy: {
    back: string; side: string; belly: string; fin: string; stripe?: string;
    pattern: "plain" | "bars" | "blotch" | "speckle" | "pikespots" | "mottle" | "xspots";
    adipose?: boolean;   // adipose fin (trout/salmon/catfish)
    twoDorsal?: boolean; // perch-like spiny + soft dorsal
    barbels?: boolean;   // catfish whiskers
    elongate?: boolean;  // pike body
    tailFork: number;    // 0 rounded .. 1 deeply forked
  };
}

export const SPECIES: SpeciesDef[] = [
  {
    id: "roach", name: "Common Roach", latin: "Rutilus rutilus",
    fact: "A shoaling silver rough-fish with rust-red fins.",
    cost: 18, appeal: 1.6, load: 1, maxOf: 6, L: 0.85, HR: 0.34, WR: 0.4,
    startScale: 0.62, growth: 0.00055, speed: 1.35, ai: "school",
    anatomy: { back: "#3c4a39", side: "#9aa7a0", belly: "#dcd9c8", fin: "#b0563a", pattern: "plain", tailFork: 0.55 },
  },
  {
    id: "crucian", name: "Crucian Carp", latin: "Carassius carassius",
    fact: "Deep-bodied and bronze, a pond classic.",
    cost: 32, appeal: 2.2, load: 2, maxOf: 4, L: 1.2, HR: 0.46, WR: 0.42,
    startScale: 0.55, growth: 0.00042, speed: 0.95, ai: "cruise",
    anatomy: { back: "#5c4a28", side: "#9c7c44", belly: "#d9c494", fin: "#8a6a3c", pattern: "plain", tailFork: 0.6 },
  },
  {
    id: "perch", name: "Yellow Perch", latin: "Perca flavescens",
    fact: "Olive-gold flanks crossed by dark saddle bars.",
    cost: 46, appeal: 2.8, load: 1, maxOf: 6, L: 1.05, HR: 0.4, WR: 0.4,
    startScale: 0.58, growth: 0.0005, speed: 1.2, ai: "school",
    anatomy: { back: "#5f6234", side: "#a89a55", belly: "#e0d9b8", fin: "#7d7440", pattern: "bars", twoDorsal: true, tailFork: 0.45 },
  },
  {
    id: "trout", name: "Rainbow Trout", latin: "Oncorhynchus mykiss",
    fact: "Speckled olive silver with a rose-pink band.",
    cost: 68, appeal: 3.6, load: 2, maxOf: 4, L: 1.5, HR: 0.3, WR: 0.42,
    startScale: 0.52, growth: 0.0004, speed: 1.5, ai: "cruise",
    anatomy: { back: "#47503a", side: "#a7b0a8", belly: "#dad7c6", fin: "#6b7059", stripe: "#c9848a", pattern: "speckle", adipose: true, tailFork: 0.7 },
  },
  {
    id: "bass", name: "Largemouth Bass", latin: "Micropterus salmoides",
    fact: "A stout olive predator with a jagged side blotch.",
    cost: 96, appeal: 4.4, load: 2, maxOf: 3, L: 1.6, HR: 0.34, WR: 0.44,
    startScale: 0.5, growth: 0.00034, speed: 1.1, ai: "ambush",
    anatomy: { back: "#424d33", side: "#8b9465", belly: "#d8d4b8", fin: "#5a6244", pattern: "blotch", tailFork: 0.5 },
  },
  {
    id: "catfish", name: "Channel Catfish", latin: "Ictalurus punctatus",
    fact: "Slate-blue bottom dweller with trailing barbels.",
    cost: 130, appeal: 5, load: 3, maxOf: 2, L: 1.55, HR: 0.3, WR: 0.52,
    startScale: 0.5, growth: 0.00032, speed: 0.85, ai: "bottom",
    anatomy: { back: "#454f5c", side: "#7e8a94", belly: "#c8cdd0", fin: "#5a646e", pattern: "mottle", barbels: true, adipose: true, tailFork: 0.75 },
  },
  {
    id: "pike", name: "Northern Pike", latin: "Esox lucius",
    fact: "The freshwater ambush missile. One per tank.",
    cost: 205, appeal: 7.5, load: 3, maxOf: 1, L: 2.35, HR: 0.23, WR: 0.4,
    startScale: 0.5, growth: 0.0003, speed: 1.0, ai: "ambush",
    anatomy: { back: "#4c5634", side: "#77824c", belly: "#d3d0ae", fin: "#6c7444", pattern: "pikespots", elongate: true, tailFork: 0.6 },
  },
  {
    id: "salmon", name: "Atlantic Salmon", latin: "Salmo salar",
    fact: "Blue-steel flanks, scattered dark crosses.",
    cost: 290, appeal: 9, load: 3, maxOf: 2, L: 2.05, HR: 0.27, WR: 0.42,
    startScale: 0.48, growth: 0.00028, speed: 1.45, ai: "cruise", requiresCap: 24,
    anatomy: { back: "#3f4d58", side: "#9fadb2", belly: "#dfe3e0", fin: "#67747c", pattern: "xspots", adipose: true, tailFork: 0.8 },
  },
];

export interface UpgradeDef {
  id: string; name: string; desc: string; cost: number; icon: "filter" | "tank" | "ad" | "feeder" | "decor";
  repeat?: number; // max purchases
  decor?: "wood" | "rocks" | "plants";
}

export const UPGRADES: UpgradeDef[] = [
  { id: "filter2", name: "Filter Mk II", desc: "Doubles mechanical filtration.", cost: 150, icon: "filter" },
  { id: "filter3", name: "Filter Mk III", desc: "Industrial bio-filtration.", cost: 430, icon: "filter" },
  { id: "cap2", name: "Gallery Expansion", desc: "Bioload capacity 10 → 16.", cost: 260, icon: "tank" },
  { id: "cap3", name: "Grand Tank", desc: "Bioload capacity 16 → 24. Unlocks salmon.", cost: 640, icon: "tank" },
  { id: "ad1", name: "Local Ads", desc: "+30% visitor flow.", cost: 120, icon: "ad" },
  { id: "ad2", name: "TV Feature", desc: "A further +30% visitor flow.", cost: 320, icon: "ad" },
  { id: "feeder", name: "Auto-Feeder", desc: "Sprinkles flakes when the shoal pecks 60% hungry.", cost: 210, icon: "feeder" },
  { id: "wood", name: "Driftwood Arch", desc: "+2 appeal. A real piece, installed in-tank.", cost: 70, icon: "decor", decor: "wood" },
  { id: "rocks", name: "Rockscape", desc: "+3 appeal. Granite arrangement.", cost: 110, icon: "decor", decor: "rocks" },
  { id: "plants", name: "Vallisneria Bed", desc: "+5 appeal. A living plant wall.", cost: 160, icon: "decor", decor: "plants" },
];

export interface MilestoneDef { id: string; name: string; desc: string; reward: number; }

export const MILESTONES: MilestoneDef[] = [
  { id: "stock1", name: "First Stocking", desc: "Own a fish", reward: 15 },
  { id: "fed15", name: "Keeper's Hand", desc: "15 pellets eaten", reward: 25 },
  { id: "clean3", name: "Crystal Water", desc: "Clean the tank 3 times", reward: 35 },
  { id: "shoal", name: "A Proper Shoal", desc: "Reach 6 bioload", reward: 50 },
  { id: "sp3", name: "Three Species", desc: "House 3 species at once", reward: 65 },
  { id: "crowd", name: "Busy Gallery", desc: "8 visitors at once", reward: 90 },
  { id: "sp5", name: "Coldwater Cabinet", desc: "House 5 species at once", reward: 130 },
  { id: "house", name: "Full House", desc: "Reach 20 bioload", reward: 170 },
  { id: "tycoon", name: "Aquarist Tycoon", desc: "Hold $1,500", reward: 220 },
];

export const DAY_LENGTH = 75;      // seconds per in-game day
export const ADMISSION_BASE = 3.6; // $ per visitor at rep 50
export const FEED_BTN_COST = 3;
export const FEED_CLICK_COST = 1;
export const CLEAN_COST = 12;
export const CLEAN_COOLDOWN = 8;

export const fmt$ = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
