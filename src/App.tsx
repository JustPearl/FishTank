import { useEffect, useRef, useState } from "react";
import { Engine } from "./game/engine";
import { Sim, type Snapshot } from "./game/sim";
import { initAudio, setMuted, sfx } from "./game/audio";
import { Hud } from "./ui/HUD";
import { MenuScreen, PauseScreen, OverScreen, WinScreen } from "./ui/Overlays";

const INITIAL: Snapshot = {
  phase: "menu", cash: 120, income: 0, visitors: 0, rep: 46, day: 1, clock: "08:00", night: false,
  dirt: 8, avgHunger: 0, bioload: 0, cap: 10, fishCount: 0, speciesCount: {}, owned: [], claimed: [],
  cleanCd: 0, bankruptWarn: 0, toasts: [],
  stats: { pellets: 0, cleans: 0, earned: 0, deaths: 0, peakVisitors: 0, fishAdded: 0 },
  muted: false,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ engine: Engine; sim: Sim } | null>(null);
  const [snap, setSnap] = useState<Snapshot>(INITIAL);
  const [shopOpen, setShopOpen] = useState(true);
  const [opsOpen, setOpsOpen] = useState(true);

  const startGame = () => {
    initAudio();
    sfx.ui();
    gameRef.current?.sim.start();
    if (gameRef.current) setSnap(gameRef.current.sim.snapshot());
  };
  const restart = () => {
    initAudio();
    sfx.ui();
    gameRef.current?.sim.reset();
    if (gameRef.current) setSnap(gameRef.current.sim.snapshot());
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new Engine();
    engine.init(mountRef.current);
    const sim = new Sim(engine);
    gameRef.current = { engine, sim };
    const iv = window.setInterval(() => setSnap(sim.snapshot()), 150);
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "f") sim.feedSprinkle();
      else if (k === "c") sim.clean();
      else if (k === "p" || k === "escape") { sim.togglePause(); sfx.ui(); }
      else if (k === "m") { sim.toggleMute(); setMuted(sim.muted); }
      else if (k === "enter" && sim.phase === "menu") { initAudio(); sfx.ui(); sim.start(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("keydown", onKey);
      engine.dispose();
      gameRef.current = null;
    };
  }, []);

  const sim = gameRef.current?.sim;

  return (
    <div className="fixed inset-0 overflow-hidden bg-abyss font-body text-ink2 select-none">
      <div ref={mountRef} className="absolute inset-0 cursor-crosshair" />

      {/* murk tint scales with dirtiness */}
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{ opacity: Math.min(0.5, (snap.dirt / 100) * 0.55), background: "linear-gradient(rgba(40,66,26,0.55), rgba(30,52,24,0.7))" }} />
      {/* vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(1,8,11,0.6) 100%)" }} />

      {(snap.phase === "playing" || snap.phase === "paused") && sim && (
        <Hud
          snap={snap}
          shopOpen={shopOpen} opsOpen={opsOpen}
          onToggleShop={() => { setShopOpen((v) => !v); sfx.ui(); }}
          onToggleOps={() => { setOpsOpen((v) => !v); sfx.ui(); }}
          onBuy={(id) => sim.buySpecies(id)}
          onUpgrade={(id) => sim.buyUpgrade(id)}
          onFeed={() => sim.feedSprinkle()}
          onClean={() => sim.clean()}
          onPause={() => { sim.togglePause(); sfx.ui(); }}
          onMute={() => { sim.toggleMute(); setMuted(sim.muted); sfx.ui(); }}
        />
      )}

      {snap.phase === "menu" && <MenuScreen onStart={startGame} />}
      {snap.phase === "paused" && <PauseScreen onResume={() => { sim?.togglePause(); sfx.ui(); }} onRestart={restart} />}
      {snap.phase === "over" && <OverScreen snap={snap} onRestart={restart} />}
      {snap.phase === "won" && <WinScreen snap={snap} onContinue={() => { sim?.continueAfterWin(); sfx.ui(); }} onRestart={restart} />}
    </div>
  );
}
