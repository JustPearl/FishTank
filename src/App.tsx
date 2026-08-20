import { useEffect, useRef, useState } from "react";
import { Engine } from "./game/engine";
import { Sim, type Snapshot } from "./game/sim";
import { initAudio, setMuted, sfx } from "./game/audio";
import { Hud } from "./ui/HUD";
import { MenuScreen, PauseScreen, OverScreen, WinScreen } from "./ui/Overlays";

const INITIAL: Snapshot = {
  phase: "menu", cash: 120, income: 0, visitors: 0, rep: 46, day: 1, clock: "08:00", night: false,
  dirt: 8, oxygen: 90, avgHunger: 0, bioload: 0, cap: 10, fishCount: 0, fish: [], speciesCount: {}, owned: [], claimed: [],
  cleanCd: 0, bankruptWarn: 0, activeEvent: null, eventCountdown: 0, toasts: [],
  stats: { pellets: 0, cleans: 0, earned: 0, deaths: 0, peakVisitors: 0, fishAdded: 0, eventsResolved: 0 },
  muted: false,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ engine: Engine; sim: Sim } | null>(null);
  const inspectRef = useRef<string | null>(null);
  const [snap, setSnap] = useState<Snapshot>(INITIAL);
  const [shopOpen, setShopOpen] = useState(true);
  const [opsOpen, setOpsOpen] = useState(true);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [zoomPct, setZoomPct] = useState(100);
  inspectRef.current = inspectId;

  const startGame = () => {
    initAudio();
    sfx.ui();
    gameRef.current?.sim.start();
    if (gameRef.current) setSnap(gameRef.current.sim.snapshot());
  };
  const restart = () => {
    initAudio();
    sfx.ui();
    setInspectId(null);
    setFocusId(null);
    gameRef.current?.sim.reset();
    if (gameRef.current) setSnap(gameRef.current.sim.snapshot());
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new Engine();
    engine.init(mountRef.current);
    const sim = new Sim(engine);
    gameRef.current = { engine, sim };
    engine.onFishClick = (id) => { setInspectId(id); sfx.ui(); };
    engine.onFocusLost = () => setFocusId(null);
    engine.onZoomChange = (p) => setZoomPct(p);
    const iv = window.setInterval(() => setSnap(sim.snapshot()), 150);
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "f") sim.feedSprinkle();
      else if (k === "c") sim.clean();
      else if (k === "escape") {
        if (inspectRef.current) setInspectId(null);
        else { sim.togglePause(); sfx.ui(); }
      } else if (k === "p") { sim.togglePause(); sfx.ui(); }
      else if (k === "m") { sim.toggleMute(); setMuted(sim.muted); }
      else if (k === "+" || k === "=") engine.zoomBy(1.6);
      else if (k === "-" || k === "_") engine.zoomBy(-1.6);
      else if (k === "0") { engine.focusFish(null); setFocusId(null); setInspectId(null); }
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

  // close panel / unfocus if the fish dies or is sold
  useEffect(() => {
    if (inspectId && !snap.fish.some((f) => f.id === inspectId)) setInspectId(null);
    if (focusId && !snap.fish.some((f) => f.id === focusId)) {
      setFocusId(null);
      gameRef.current?.engine.focusFish(null);
    }
  }, [snap, inspectId, focusId]);

  const sim = gameRef.current?.sim;
  const engine = gameRef.current?.engine;

  const toggleFocus = (id: string) => {
    if (!engine) return;
    if (focusId === id) { engine.focusFish(null); setFocusId(null); }
    else { engine.focusFish(id); setFocusId(id); }
    sfx.ui();
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-abyss font-body text-ink2 select-none">
      <div ref={mountRef} className="absolute inset-0 cursor-crosshair" />

      {/* murk tint scales with dirtiness */}
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{ opacity: Math.min(0.42, (snap.dirt / 100) * 0.5), background: "linear-gradient(rgba(40,66,26,0.5), rgba(30,52,24,0.62))" }} />
      {/* vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 58%, rgba(1,8,11,0.42) 100%)" }} />

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
          inspectId={inspectId}
          focusId={focusId}
          zoomPct={zoomPct}
          onZoom={(d) => engine?.zoomBy(d)}
          onCloseInspect={() => { setInspectId(null); sfx.ui(); }}
          onToggleFocus={toggleFocus}
          onFeedFish={(id) => sim.targetFeed(id)}
          onSellFish={(id) => {
            sim.sellFish(id);
            setInspectId(null);
            if (focusId === id) { engine?.focusFish(null); setFocusId(null); }
          }}
          onEventChoice={(c) => sim.resolveEvent(c)}
        />
      )}

      {snap.phase === "menu" && <MenuScreen onStart={startGame} />}
      {snap.phase === "paused" && <PauseScreen onResume={() => { sim?.togglePause(); sfx.ui(); }} onRestart={restart} />}
      {snap.phase === "over" && <OverScreen snap={snap} onRestart={restart} />}
      {snap.phase === "won" && <WinScreen snap={snap} onContinue={() => { sim?.continueAfterWin(); sfx.ui(); }} onRestart={restart} />}
    </div>
  );
}
