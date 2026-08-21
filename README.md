# FishTank — *Greyline Aquarium: Coldwater Tycoon*

A 3D side-view aquarium **management tycoon** built on Three.js, starring temperate freshwater species with procedurally sculpted, anatomically authentic models — no neon tropicals, just roach, pike and honest grey water.

Run the public gallery, keep the water chemistry alive, stock coldwater species, and survive predation, algae blooms and bankruptcy long enough to earn the Coldwater Certification.

## Run it

```bash
npm install
npm run dev      # local preview
npm run build    # production bundle in dist/
```

**Stack:** React 18 · Vite · TypeScript · Tailwind v4 · three.js · WebAudio (all SFX synthesized — zero assets)

## Controls

| Input | Action |
|---|---|
| **Click water** | Target-feed at that point ($1) |
| **Click a fish** | Open specimen panel (inspect / feed / sell / focus camera) |
| **Drag** or **WASD / arrows** | Pan the camera |
| **Scroll wheel** / **+ −** | Zoom (60–165%) |
| **F** / **C** | Broadcast feed · Clean tank |
| **P** / **Esc** | Pause · Close panel |
| **M** | Mute |

## What's in the tank

**Eight species, real anatomy.** Bodies are vertex-sculpted per species (snout, hump, taper, head width) and vertex-painted with countershading, species patterns, gill shading and lateral-line sheen, then dressed with:

| Species | Latin | Signature |
|---|---|---|
| Common Roach | *Rutilus rutilus* | red eye, rust-red paired fins |
| Crucian Carp | *Carassius carassius* | arched bronze body, scale lattice |
| Yellow Perch | *Perca flavescens* | saddle bars, dorsal blotch, spiny fin |
| Rainbow Trout | *Oncorhynchus mykiss* | rose stripe, black + red spots, adipose fin |
| Largemouth Bass | *Micropterus salmoides* | toothed lateral band, big gape |
| Channel Catfish | *Ictalurus punctatus* | flat skull, whiskers, ribbon anal fin |
| Northern Pike | *Esox lucius* | duck-bill, rear-set dorsal, bean spots |
| Atlantic Salmon | *Salmo salar* | x-crosses, steel flanks |

Models carry scale-relief skin with clearcoat sheen, fin-ray membranes (radial fans on cupped, swept tails), operculum plates, layered eyes with iris/pupil/cornea/catchlight, mouth seams and curved barbels.

**Movement that obeys biology.** Turn-rate-limited yaw (no 180° snaps), no backward swimming, banked turns with body flex, burst-and-coast gliding, sink-and-correct hovering, feeding pecks, bottom-grazing with sand puffs, ambush sculling, nocturnal catfish, and low-oxygen surface gasping.

**An ecosystem, not a screensaver.** Pike and bass hunt tankmates under half their length (prey vanish in a bubble burst; shoals tighten and ripple panic outward two generations). Cyprinids detect alarm substance from deaths. Bass and perch chase off conspecific rivals; fish yield to larger dominants; feeding one fish draws a crowd via food signals.

**The tycoon loop.** Visitors pay admission scaled by appeal + reputation + day/night. Water dirties, oxygen depletes with bioload. Random events (inspector, algaecide bloom, school tours, TV crews, heatwaves) demand choices. 14 upgrades — filters, UV sterilizer, auto-feeder, expansions, ads — plus 7 in-tank decorations (driftwood arch, LED light bar, air curtain, sunken dinghy…). 15 milestones unlock the certification win; bankruptcy ends the run.

**A rendered gallery.** Caustics on sand and backdrop, light shafts, surface shimmer, volumetric LED beam with floor glow, drifting motes, crawling glass snails, pearling plants, a pike lithograph on the wall, and a warm floor lamp against the teal.

## Architecture

```
src/
├── App.tsx            # bootstrap, keyboard shortcuts, panel/focus state
├── game/
│   ├── data.ts        # species, upgrades, milestones, events, balance constants
│   ├── engine.ts      # three.js scene, fish AI, camera, particles, decorations
│   ├── fish3d.ts      # procedural fish models (sculpt + paint + rig)
│   ├── sim.ts         # economy, vitals, visitors, reputation, events, win/lose
│   └── audio.ts       # synthesized WebAudio SFX
└── ui/
    ├── HUD.tsx        # top bar, shop, ops, toasts, inspect panel, zoom, events
    └── Overlays.tsx   # start / pause / bankruptcy / certification screens
```

The engine and sim talk through a small `SimBridge` contract; the HUD polls a `Snapshot` at ~7 Hz. Everything is procedural — no textures, models or audio files are shipped.

## Status

Main branch: **green** — `npm run build` passes with zero type errors.
