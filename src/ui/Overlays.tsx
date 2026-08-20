import type { ReactNode } from "react";
import type { Snapshot } from "../game/sim";
import { SPECIES, MILESTONES, fmt$ } from "../game/data";
import { I } from "./HUD";

function Placard({ children, tone = "cyan" }: { children: ReactNode; tone?: "cyan" | "amber" | "coral" }) {
  const border = tone === "amber" ? "border-amber2/60" : tone === "coral" ? "border-coral2/60" : "border-cyan2/50";
  return (
    <div className={`relative max-w-xl w-[92%] border ${border} bg-[#051d26f2] rounded-[5px] shadow-[0_30px_80px_rgba(0,0,0,0.7)] px-8 py-8 fade-up`}>
      <span className={`absolute -top-px -left-px w-5 h-5 border-t-2 border-l-2 ${border}`} />
      <span className={`absolute -top-px -right-px w-5 h-5 border-t-2 border-r-2 ${border}`} />
      <span className={`absolute -bottom-px -left-px w-5 h-5 border-b-2 border-l-2 ${border}`} />
      <span className={`absolute -bottom-px -right-px w-5 h-5 border-b-2 border-r-2 ${border}`} />
      {children}
    </div>
  );
}

function Btn({ onClick, children, kind = "amber", small }: { onClick: () => void; children: ReactNode; kind?: "amber" | "ghost"; small?: boolean }) {
  return (
    <button onClick={onClick} className={`${small ? "px-4 py-1.5 text-[12px]" : "px-7 py-3 text-[15px]"} font-disp font-bold tracking-[0.12em] rounded-[3px] border transition-all active:translate-y-px ${
      kind === "amber"
        ? "border-amber2 bg-amber2/15 text-amber2 hover:bg-amber2/30 shadow-[0_0_24px_rgba(244,184,63,0.15)]"
        : "border-line text-dim hover:text-ink2 hover:border-cyan2/50"}`}>
      {children}
    </button>
  );
}

function StatRow({ snap }: { snap: Snapshot }) {
  const s = snap.stats;
  const items: [string, string][] = [
    ["Days open", String(snap.day)],
    ["Fish housed", String(s.fishAdded)],
    ["Flakes eaten", String(s.pellets)],
    ["Tank cleans", String(s.cleans)],
    ["Peak visitors", String(s.peakVisitors)],
    ["Total earned", fmt$(s.earned)],
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5 my-5">
      {items.map(([k, v]) => (
        <div key={k} className="border border-line bg-[#07242e] rounded-[3px] px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-dim">{k}</div>
          <div className="text-[15px] font-bold text-ink2 tabular-nums">{v}</div>
        </div>
      ))}
    </div>
  );
}

export function MenuScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[radial-gradient(ellipse_at_center,rgba(2,12,17,0.55)_0%,rgba(1,8,12,0.88)_100%)]">
      <Placard>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-[4px] border border-cyan2/60 bg-cyan2/10 p-2 text-cyan2">{I.fish()}</div>
          <div>
            <h1 className="font-disp font-extrabold text-[38px] leading-none tracking-tight text-ink2">GREYLINE <span className="text-cyan2">AQUARIUM</span></h1>
            <div className="text-[10px] tracking-[0.42em] text-amber2 mt-1.5">COLDWATER TYCOON</div>
          </div>
        </div>
        <p className="text-[13px] text-[#8fb4b2] leading-relaxed mt-3">
          Run a public aquarium of <b className="text-ink2">temperate freshwater species</b> — bronze carp, saddle-barred perch,
          speckled trout, a lurking pike. No neon tetras. No clownfish. Just honest coldwater anatomy and honest margins.
        </p>
        <div className="space-y-2 my-4 text-[12px] text-dim">
          <div className="flex items-center gap-2.5"><span className="w-5 h-5 shrink-0 text-cyan2">{I.fish()}</span><span><b className="text-ink2">Stock the tank</b> — every species adds appeal, bioload and appetite.</span></div>
          <div className="flex items-center gap-2.5"><span className="w-5 h-5 shrink-0 text-cyan2">{I.flake()}</span><span><b className="text-ink2">Click the water</b> to drop feed; keep shoals fed and the glass clean.</span></div>
          <div className="flex items-center gap-2.5"><span className="w-5 h-5 shrink-0 text-cyan2">{I.drop()}</span><span><b className="text-ink2">Click a fish</b> to inspect it and focus the camera — drag or WASD to move, scroll to zoom.</span></div>
          <div className="flex items-center gap-2.5"><span className="w-5 h-5 shrink-0 text-amber2">{I.coin()}</span><span><b className="text-ink2">Visitors pay admission</b> — reputation climbs with health, variety and clean water. Certificates pay bonuses.</span></div>
        </div>
        <div className="flex flex-wrap gap-1 mb-5">
          {SPECIES.map((sp) => (
            <span key={sp.id} className="text-[9.5px] px-1.5 py-0.5 border border-line rounded-[2px] text-[#7fa8a5] italic">{sp.latin}</span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Btn onClick={onStart}>OPEN THE GALLERY</Btn>
          <span className="text-[10.5px] text-dim leading-snug">starting fund $120<br />don't go bankrupt</span>
        </div>
      </Placard>
    </div>
  );
}

export function PauseScreen({ onResume, onRestart }: { onResume: () => void; onRestart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[#010a0ecc]">
      <Placard>
        <h2 className="font-disp font-extrabold text-[30px] tracking-tight text-ink2">PAUSED</h2>
        <p className="text-[12px] text-dim mt-1">The shoal hangs motionless in the current.</p>
        <div className="flex gap-2.5 mt-5">
          <Btn onClick={onResume}>RESUME</Btn>
          <Btn onClick={onRestart} kind="ghost">RESTART</Btn>
        </div>
        <div className="text-[10.5px] text-dim mt-4">F feed · C clean · click fish to inspect · drag/WASD move cam · scroll zoom · M mute</div>
      </Placard>
    </div>
  );
}

export function OverScreen({ snap, onRestart }: { snap: Snapshot; onRestart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[#160505d9]">
      <Placard tone="coral">
        <h2 className="font-disp font-extrabold text-[34px] tracking-tight text-coral2">GALLERY BANKRUPT</h2>
        <p className="text-[13px] text-[#c99a90] mt-1.5">The last tank stands empty, the filter hums for no one, and the till shows {fmt$(snap.cash)}.</p>
        <StatRow snap={snap} />
        <Btn onClick={onRestart}>TRY AGAIN</Btn>
      </Placard>
    </div>
  );
}

export function WinScreen({ snap, onContinue, onRestart }: { snap: Snapshot; onContinue: () => void; onRestart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[radial-gradient(ellipse_at_center,rgba(30,24,4,0.5)_0%,rgba(2,9,12,0.92)_100%)]">
      <Placard tone="amber">
        <div className="flex items-center gap-1.5 mb-2 w-fit">
          {[0, 1, 2, 3, 4].map((i) => <span key={i} className="w-5 h-5 text-amber2">{I.star()}</span>)}
        </div>
        <h2 className="font-disp font-extrabold text-[32px] leading-tight tracking-tight text-amber2">GRAND AQUARIUM<br />CERTIFIED</h2>
        <p className="text-[13px] text-[#c2b088] mt-2">
          All {MILESTONES.length} certificates on the wall, {fmt$(snap.cash)} in the till, and a pike that finally respects you.
          The coldwater collection is the finest in the country.
        </p>
        <StatRow snap={snap} />
        <div className="flex gap-2.5">
          <Btn onClick={onContinue}>KEEP RUNNING IT</Btn>
          <Btn onClick={onRestart} kind="ghost">NEW GAME</Btn>
        </div>
      </Placard>
    </div>
  );
}
