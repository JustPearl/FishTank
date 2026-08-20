// ── Greyline Aquarium: game data ──────────────────────────────────────────────

export interface FinDef { f: number; b: number; h: number; spiky?: boolean; blotch?: boolean; }

export interface Anatomy {
  back: string; side: string; belly: string;
  fin: string;        // unpaired fins (dorsal/anal/caudal)
  finPaired: string;  // paired fins (pectoral/pelvic)
  eye: string;
  eyeScale: number;
  pattern: "plain" | "bars" | "spots" | "toothbar" | "pikespots" | "mottle" | "lattice" | "xspots";
  bars?: number;      // perch-like vertical saddle bars
  pinkBand?: boolean; // rainbow trout's rose lateral stripe
  snout: number;      // 0 blunt .. 1 pike duckbill
  snoutFlat: number;  // vertical flattening of the snout
  hump: number;       // dorsal arch (bream/crucian deep bodies)
  headWide: number;   // catfish broad flat head
  taperStart: number; taperEnd: number; taperAmt: number; // caudal taper
  dorsal: FinDef;
  dorsal2?: FinDef;   // soft second dorsal (perch/bass)
  anal: FinDef;
  adipose: boolean;
  barbels: 0 | "catfish";
  jawBig?: boolean;   // largemouth gape + maxilla
  mouthVentral: number;
  tailFork: number;   // 0 rounded .. 1 deeply forked
  tailSize: number;
  roughness: number;  // scaleless slime vs ctenoid scales
}

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
  anatomy: Anatomy;
}

export const SPECIES: SpeciesDef[] = [
  {
    id: "roach", name: "Common Roach", latin: "Rutilus rutilus",
    fact: "Silver shoaler with crimson eyes and rust-red paired fins.",
    cost: 18, appeal: 1.6, load: 1, maxOf: 6, L: 0.85, HR: 0.34, WR: 0.4,
    startScale: 0.62, growth: 0.00055, speed: 1.35, ai: "school",
    anatomy: {
      back: "#3e4f3e", side: "#b9c2ba", belly: "#e8e8da",
      fin: "#8b918b", finPaired: "#c25e3e", eye: "#d8452b", eyeScale: 1.15,
      pattern: "plain", snout: 0.08, snoutFlat: 0.08, hump: 0.24, headWide: 1.0,
      taperStart: 0.55, taperEnd: 0.97, taperAmt: 0.72,
      dorsal: { f: 0.1, b: 0.16, h: 0.3 }, anal: { f: 0.14, b: 0.3, h: 0.2 },
      adipose: false, barbels: 0, mouthVentral: 0.12, tailFork: 0.6, tailSize: 1.0, roughness: 0.42,
    },
  },
  {
    id: "crucian", name: "Crucian Carp", latin: "Carassius carassius",
    fact: "Deep-backed bronze pond classic with visible scale rows.",
    cost: 32, appeal: 2.2, load: 2, maxOf: 4, L: 1.2, HR: 0.46, WR: 0.42,
    startScale: 0.55, growth: 0.00042, speed: 0.95, ai: "cruise",
    anatomy: {
      back: "#5a4a26", side: "#b08d4a", belly: "#e5d2a2",
      fin: "#967740", finPaired: "#a5803f", eye: "#c9a233", eyeScale: 1.0,
      pattern: "lattice", snout: 0.06, snoutFlat: 0.1, hump: 0.5, headWide: 1.0,
      taperStart: 0.5, taperEnd: 0.95, taperAmt: 0.78,
      dorsal: { f: 0.0, b: 0.26, h: 0.38 }, anal: { f: 0.08, b: 0.3, h: 0.26 },
      adipose: false, barbels: 0, mouthVentral: 0.2, tailFork: 0.55, tailSize: 0.95, roughness: 0.45,
    },
  },
  {
    id: "perch", name: "Yellow Perch", latin: "Perca flavescens",
    fact: "Brass flanks, dark saddle bars and a blotch on the spiny dorsal.",
    cost: 46, appeal: 2.8, load: 1, maxOf: 6, L: 1.05, HR: 0.4, WR: 0.4,
    startScale: 0.58, growth: 0.0005, speed: 1.2, ai: "school",
    anatomy: {
      back: "#5c5f30", side: "#b3a458", belly: "#e6deb8",
      fin: "#cf6b33", finPaired: "#d1652e", eye: "#d9b44a", eyeScale: 1.0,
      pattern: "bars", bars: 7, snout: 0.14, snoutFlat: 0.12, hump: 0.3, headWide: 1.0,
      taperStart: 0.55, taperEnd: 0.96, taperAmt: 0.72,
      dorsal: { f: 0.05, b: 0.1, h: 0.42, spiky: true, blotch: true },
      dorsal2: { f: -0.12, b: 0.28, h: 0.26 },
      anal: { f: 0.12, b: 0.26, h: 0.2 },
      adipose: false, barbels: 0, mouthVentral: 0.15, tailFork: 0.45, tailSize: 0.95, roughness: 0.55,
    },
  },
  {
    id: "trout", name: "Rainbow Trout", latin: "Oncorhynchus mykiss",
    fact: "Olive-silver with a rose-pink stripe and black spotting.",
    cost: 68, appeal: 3.6, load: 2, maxOf: 4, L: 1.5, HR: 0.3, WR: 0.42,
    startScale: 0.52, growth: 0.0004, speed: 1.5, ai: "cruise",
    anatomy: {
      back: "#47503a", side: "#b3bcb2", belly: "#eae6d6",
      fin: "#6b7059", finPaired: "#7d8068", eye: "#d9a441", eyeScale: 1.0,
      pattern: "spots", pinkBand: true, snout: 0.18, snoutFlat: 0.2, hump: 0.22, headWide: 1.0,
      taperStart: 0.55, taperEnd: 0.97, taperAmt: 0.72,
      dorsal: { f: 0.06, b: 0.16, h: 0.3 }, anal: { f: 0.12, b: 0.26, h: 0.2 },
      adipose: true, barbels: 0, mouthVentral: 0.1, tailFork: 0.7, tailSize: 1.05, roughness: 0.4,
    },
  },
  {
    id: "bass", name: "Largemouth Bass", latin: "Micropterus salmoides",
    fact: "Stout olive ambush hunter — the jaw reaches past the eye.",
    cost: 96, appeal: 4.4, load: 2, maxOf: 3, L: 1.6, HR: 0.34, WR: 0.44,
    startScale: 0.5, growth: 0.00034, speed: 1.1, ai: "ambush",
    anatomy: {
      back: "#425030", side: "#93a06b", belly: "#e0dbba",
      fin: "#5c6744", finPaired: "#66704c", eye: "#c9a63a", eyeScale: 1.0,
      pattern: "toothbar", jawBig: true, snout: 0.28, snoutFlat: 0.25, hump: 0.26, headWide: 1.05,
      taperStart: 0.52, taperEnd: 0.95, taperAmt: 0.72,
      dorsal: { f: 0.1, b: 0.12, h: 0.4, spiky: true },
      dorsal2: { f: -0.04, b: 0.22, h: 0.3 },
      anal: { f: 0.1, b: 0.26, h: 0.22 },
      adipose: false, barbels: 0, mouthVentral: 0.18, tailFork: 0.35, tailSize: 1.0, roughness: 0.5,
    },
  },
  {
    id: "catfish", name: "Channel Catfish", latin: "Ictalurus punctatus",
    fact: "Slate-blue, flat-skulled bottom dweller with a ribbon anal fin.",
    cost: 130, appeal: 5, load: 3, maxOf: 2, L: 1.55, HR: 0.3, WR: 0.52,
    startScale: 0.5, growth: 0.00032, speed: 0.85, ai: "bottom",
    anatomy: {
      back: "#454f5c", side: "#84909a", belly: "#cfd4d6",
      fin: "#5f6973", finPaired: "#6b747c", eye: "#d8c15c", eyeScale: 0.55,
      pattern: "mottle", snout: 0.15, snoutFlat: 0.3, hump: 0.12, headWide: 1.4,
      taperStart: 0.6, taperEnd: 0.97, taperAmt: 0.7,
      dorsal: { f: 0.14, b: 0.22, h: 0.16 }, anal: { f: 0.02, b: 0.4, h: 0.24 },
      adipose: true, barbels: "catfish", mouthVentral: 0.5, tailFork: 0.7, tailSize: 0.9, roughness: 0.28,
    },
  },
  {
    id: "pike", name: "Northern Pike", latin: "Esox lucius",
    fact: "The duck-billed ambush missile. One per tank, for everyone's sake.",
    cost: 205, appeal: 7.5, load: 3, maxOf: 1, L: 2.35, HR: 0.23, WR: 0.4,
    startScale: 0.5, growth: 0.0003, speed: 1.0, ai: "ambush",
    anatomy: {
      back: "#4c5634", side: "#7d8852", belly: "#dad7b4",
      fin: "#767e4e", finPaired: "#7d8252", eye: "#c9a63a", eyeScale: 0.95,
      pattern: "pikespots", snout: 1.0, snoutFlat: 0.8, hump: 0.06, headWide: 1.0,
      taperStart: 0.62, taperEnd: 0.97, taperAmt: 0.66,
      dorsal: { f: -0.06, b: 0.3, h: 0.28 }, anal: { f: 0.08, b: 0.34, h: 0.2 },
      adipose: false, barbels: 0, mouthVentral: 0.05, tailFork: 0.6, tailSize: 1.0, roughness: 0.45,
    },
  },
  {
    id: "salmon", name: "Atlantic Salmon", latin: "Salmo salar",
    fact: "Blue-steel flanks marked with scattered dark crosses.",
    cost: 290, appeal: 9, load: 3, maxOf: 2, L: 2.05, HR: 0.27, WR: 0.42,
    startScale: 0.48, growth: 0.00028, speed: 1.45, ai: "cruise", requiresCap: 24,
    anatomy: {
      back: "#3f4d58", side: "#aab8bd", belly: "#e6eae8",
      fin: "#6b7880", finPaired: "#77848a", eye: "#c9b23f", eyeScale: 1.0,
      pattern: "xspots", snout: 0.22, snoutFlat: 0.25, hump: 0.2, headWide: 1.0,
      taperStart: 0.55, taperEnd: 0.97, taperAmt: 0.7,
      dorsal: { f: 0.08, b: 0.16, h: 0.3 }, anal: { f: 0.1, b: 0.26, h: 0.22 },
      adipose: true, barbels: 0, mouthVentral: 0.1, tailFork: 0.85, tailSize: 1.1, roughness: 0.35,
    },
  },
];

export interface UpgradeDef {
  id: string; name: string; desc: string; cost: number; icon: "filter" | "tank" | "ad" | "feeder" | "decor";
  repeat?: number; // max purchases
  decor?: "wood" | "rocks" | "plants" | "aircurtain" | "lightbar" | "rowboat" | "pebbles";
}

export const UPGRADES: UpgradeDef[] = [
  { id: "filter2", name: "Filter Mk II", desc: "Doubles mechanical filtration.", cost: 150, icon: "filter" },
  { id: "filter3", name: "Filter Mk III", desc: "Industrial bio-filtration.", cost: 430, icon: "filter" },
  { id: "cap2", name: "Gallery Expansion", desc: "Bioload capacity 10 → 16.", cost: 260, icon: "tank" },
  { id: "cap3", name: "Grand Tank", desc: "Bioload capacity 16 → 24. Unlocks salmon.", cost: 640, icon: "tank" },
  { id: "ad1", name: "Local Ads", desc: "+30% visitor flow.", cost: 120, icon: "ad" },
  { id: "ad2", name: "TV Feature", desc: "A further +30% visitor flow.", cost: 320, icon: "ad" },
  { id: "feeder", name: "Auto-Feeder", desc: "Sprinkles flakes when the shoal pecks 60% hungry.", cost: 210, icon: "feeder" },
  { id: "uv", name: "UV Sterilizer", desc: "Cuts waste buildup by 40%. Green-water killer.", cost: 190, icon: "filter" },
  { id: "wood", name: "Driftwood Arch", desc: "+2 appeal. A real piece, installed in-tank.", cost: 70, icon: "decor", decor: "wood" },
  { id: "rocks", name: "Rockscape", desc: "+3 appeal. Granite arrangement.", cost: 110, icon: "decor", decor: "rocks" },
  { id: "plants", name: "Vallisneria Bed", desc: "+5 appeal, +0.4 aeration. A living plant wall.", cost: 160, icon: "decor", decor: "plants" },
  { id: "aircurtain", name: "Air Curtain", desc: "+3 appeal, +1.6 aeration. A shimmering bubble column.", cost: 140, icon: "decor", decor: "aircurtain" },
  { id: "lightbar", name: "LED Light Bar", desc: "+2 appeal, +10% visitors. Warm showcase glow.", cost: 180, icon: "decor", decor: "lightbar" },
  { id: "rowboat", name: "Sunken Dinghy", desc: "+4 appeal. A weathered wreck the shoal threads through.", cost: 240, icon: "decor", decor: "rowboat" },
  { id: "pebbles", name: "River Pebble Bed", desc: "+2 appeal. Tumbled granite scatter.", cost: 90, icon: "decor", decor: "pebbles" },
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
  { id: "decor1", name: "Interior Touch", desc: "Install a decoration", reward: 20 },
  { id: "decor3", name: "Aquascaper", desc: "Install 3 decorations", reward: 60 },
  { id: "event1", name: "Crisis Manager", desc: "Resolve a random event", reward: 30 },
  { id: "aerate", name: "Well Aerated", desc: "Install the Air Curtain", reward: 40 },
  { id: "week", name: "Open a Week", desc: "Reach day 5", reward: 80 },
  { id: "earn2k", name: "Big Earner", desc: "Earn $2,000 total", reward: 150 },
];

export interface EventDelta { cash?: number; dirt?: number; rep?: number; oxygen?: number; visitors?: number; shake?: number; }
export interface EventChoice { label: string; msg: string; delta: EventDelta; }
export interface EventDef {
  id: string; title: string; desc: string;
  icon: "alert" | "gift" | "leaf" | "wrench" | "star" | "person";
  weight: number; minDay?: number;
  choices: [EventChoice, EventChoice];
}

export const EVENT_DEFS: EventDef[] = [
  {
    id: "inspector", title: "Health Inspector", desc: "An inspector taps the glass and frowns at the water clarity. This could go badly.",
    icon: "alert", weight: 3,
    choices: [
      { label: "Deep-clean on the spot", msg: "You scrubbed everything. The inspector nods.", delta: { cash: -25, dirt: -50, shake: 0.1 } },
      { label: "Plead your case", msg: "The inspector left unimpressed.", delta: { rep: -14 } },
    ],
  },
  {
    id: "bloom", title: "Algae Bloom", desc: "Overnight the water has turned the colour of pea soup. Something must give.",
    icon: "leaf", weight: 3,
    choices: [
      { label: "Dose algaecide", msg: "The bloom died back, but the water took a hit.", delta: { cash: -20, dirt: 12, oxygen: -12 } },
      { label: "Ride it out", msg: "You gambled on nature. The murk thickened.", delta: { dirt: 34 } },
    ],
  },
  {
    id: "tour", title: "School Tour", desc: "A teacher herds two dozen kids toward the entrance. They are loud and sticky.",
    icon: "person", weight: 3,
    choices: [
      { label: "Host the tour", msg: "The kids adored it. Word will spread.", delta: { visitors: 10, rep: 6 } },
      { label: "Turn them away", msg: "You kept the peace and lost the crowd.", delta: { rep: -5 } },
    ],
  },
  {
    id: "donor", title: "Quiet Donor", desc: "A retired keeper offers a grant — no strings, just love of fish.",
    icon: "gift", weight: 2,
    choices: [
      { label: "Accept the grant", msg: "A generous gift for the collection.", delta: { cash: 60 } },
      { label: "Decline politely", msg: "Your independence impressed the society.", delta: { rep: 8 } },
    ],
  },
  {
    id: "media", title: "Local TV Crew", desc: "A camera crew wants to feature the gallery on the evening news.",
    icon: "star", weight: 2, minDay: 2,
    choices: [
      { label: "Give the full tour", msg: "Prime-time fame — the crowds followed.", delta: { rep: 12, visitors: 8, dirt: 14 } },
      { label: "No comment", msg: "You kept things low-key.", delta: {} },
    ],
  },
  {
    id: "filter", title: "Filter Rattle", desc: "The filtration unit is making a sound like gravel in a tin can.",
    icon: "wrench", weight: 3,
    choices: [
      { label: "Emergency repair", msg: "Fixed before it failed. Money well spent.", delta: { cash: -40 } },
      { label: "Kick it and hope", msg: "It held... barely. Waste piled up.", delta: { dirt: 38, oxygen: -8 } },
    ],
  },
  {
    id: "heat", title: "Heatwave", desc: "A warm snap is pushing the coldwater tank toward the danger zone.",
    icon: "alert", weight: 2, minDay: 3,
    choices: [
      { label: "Buy ice blocks", msg: "The temperature held steady.", delta: { cash: -30, oxygen: 6 } },
      { label: "Let it ride", msg: "The fish gasped at the surface.", delta: { oxygen: -22 } },
    ],
  },
];

export const O2_LOW = 30;          // below this, fish health suffers
export const O2_BASE_AERATION = 1.1;
export const O2_CONSUMPTION_PER_LOAD = 0.085;

export const DAY_LENGTH = 75;      // seconds per in-game day
export const ADMISSION_BASE = 3.6; // $ per visitor at rep 50
export const FEED_BTN_COST = 3;
export const FEED_CLICK_COST = 1;
export const CLEAN_COST = 12;
export const CLEAN_COOLDOWN = 8;

export const fmt$ = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
