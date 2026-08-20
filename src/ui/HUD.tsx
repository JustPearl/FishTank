import type { ReactNode } from "react";
import type { Snapshot, FishView } from "../game/sim";
import { SPECIES, UPGRADES, MILESTONES, FEED_BTN_COST, CLEAN_COST, fmt$, type SpeciesDef } from "../game/data";

// identifying field-guide tags derived from anatomy
function tagsFor(sp: SpeciesDef): string[] {
  const A = sp.anatomy, t: string[] = [];
  if (A.snout > 0.7) t.push("duck bill");
  if (A.pattern === "bars") t.push("saddle bars");
  if (A.dorsal.blotch) t.push("dorsal blotch");
  if (A.pinkBand) t.push("rose stripe");
  if (A.pattern === "toothbar") t.push("lateral band");
  if (A.jawBig) t.push("big gape");
  if (A.barbels) t.push("barbels");
  if (A.pattern === "lattice") t.push("big scales");
  if (A.pattern === "xspots") t.push("x-markings");
  if (A.pattern === "spots") t.push("black spots");
  if (A.pattern === "mottle") t.push("mottled");
  if (A.adipose) t.push("adipose fin");
  if (A.hump >= 0.45) t.push("deep body");
  if (A.eye === "#d8452b") t.push("red eye");
  return t.slice(0, 3);
}

// ── inline SVG icons ──────────────────────────────────────────────────────────
export const I = {
  fish: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><path d="M2 12s4-6 11-6c4.5 0 8 3 9 6-1 3-4.5 6-9 6-7 0-11-6-11-6zm11-2.2a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2zM2.5 12L6 8.6v6.8L2.5 12z" transform="rotate(180 12 12)" /></svg>
  ),
  coin: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" className="w-full h-full"><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10c0-1 1-1.8 2.5-1.8s2.5.7 2.5 1.7c0 2.4-5 1.8-5 4.2 0 1 1 1.7 2.5 1.7s2.5-.8 2.5-1.8" strokeWidth="1.4" /></svg>
  ),
  person: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><circle cx="12" cy="6" r="3.4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8v1H4v-1z" /></svg>
  ),
  star: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
  ),
  drop: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><path d="M12 2.7S5.5 10 5.5 14.5a6.5 6.5 0 0013 0C18.5 10 12 2.7 12 2.7z" /></svg>
  ),
  flake: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><circle cx="7" cy="6" r="2" /><circle cx="16" cy="4.5" r="1.6" /><circle cx="12" cy="11" r="2.2" /><circle cx="6.5" cy="16" r="1.7" /><circle cx="17" cy="15" r="2" /><circle cx="11.5" cy="20" r="1.5" /></svg>
  ),
  pause: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
  ),
  play: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><path d="M7 4l13 8-13 8z" /></svg>
  ),
  snd: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><path d="M4 9v6h4l6 5V4L8 9H4z" /><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
  ),
  mute: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><path d="M4 9v6h4l6 5V4L8 9H4z" /><path d="M16 9l6 6M22 9l-6 6" stroke={c} strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  check: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" className="w-full h-full"><path d="M4 12.5l5.5 5.5L20 6.5" /></svg>
  ),
  lock: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" stroke={c} strokeWidth="2" fill="none" /></svg>
  ),
  moon: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" /></svg>
  ),
  alert: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><path d="M12 3l10 18H2L12 3zm-1 7v5h2v-5h-2zm0 7v2h2v-2h-2z" /></svg>
  ),
  gift: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" className="w-full h-full"><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M4 9h16M12 9v11M12 9c-3 0-5-1.5-5-3.5S9 3 10.5 4 12 9 12 9zm0 0c3 0 5-1.5 5-3.5S15 3 13.5 4 12 9 12 9z" /></svg>
  ),
  leaf: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><path d="M5 19c0-8 5-14 14-14 0 9-6 14-12 14 0 0-1-4-2-6 1 3 1 6 0 6z" /></svg>
  ),
  wrench: (c = "currentColor") => (
    <svg viewBox="0 0 24 24" fill={c} className="w-full h-full"><path d="M21 6.5a5 5 0 01-6.6 4.7L7 18.6a2.1 2.1 0 01-3-3l7.4-7.4A5 5 0 0117.5 2l-2.8 2.8 2.5 2.5L20 4.5c.6.6 1 1.3 1 2z" /></svg>
  ),
};

function Chip({ label, children, accent }: { label: string; children: ReactNode; accent?: string }) {
  return (
    <div className="flex items-center gap-2 border border-line bg-panel/80 px-2.5 py-1 rounded-[3px] shadow-[inset_0_1px_0_rgba(120,220,205,0.08)]">
      <span className="text-[9px] font-semibold tracking-[0.16em] text-dim uppercase">{label}</span>
      <span className={`text-[15px] leading-none font-semibold tabular-nums ${accent ?? "text-ink2"}`}>{children}</span>
    </div>
  );
}

function Bar({ label, value, hue, right }: { label: string; value: number; hue: number; right: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-dim uppercase tracking-wider">{label}</span>
        <span className="text-ink2 tabular-nums font-semibold">{right}</span>
      </div>
      <div className="h-[7px] bg-[#07242d] border border-line/70 rounded-[2px] overflow-hidden">
        <div className="h-full transition-[width] duration-300" style={{ width: `${v}%`, background: `hsl(${hue} 58% 46%)`, boxShadow: `0 0 8px hsl(${hue} 70% 45% / 0.6)` }} />
      </div>
    </div>
  );
}

export interface HudProps {
  snap: Snapshot;
  shopOpen: boolean; opsOpen: boolean;
  onToggleShop: () => void; onToggleOps: () => void;
  onBuy: (id: string) => void; onUpgrade: (id: string) => void;
  onFeed: () => void; onClean: () => void; onPause: () => void; onMute: () => void;
  inspectId: string | null; focusId: string | null; zoomPct: number;
  onZoom: (d: number) => void;
  onCloseInspect: () => void; onToggleFocus: (id: string) => void;
  onFeedFish: (id: string) => void; onSellFish: (id: string) => void;
  onEventChoice: (c: 0 | 1) => void;
}

export function Hud(p: HudProps) {
  const s = p.snap;
  const stars = Math.round((s.rep / 20) * 10) / 10;
  return (
    <>
      {/* top bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-2 px-2.5 h-[54px] bg-gradient-to-b from-[#03141acc] via-[#03141a99] to-transparent">
        <div className="flex items-center gap-2 mr-1 select-none">
          <div className="w-8 h-8 rounded-[3px] border border-cyan2/50 bg-cyan2/10 p-1.5 text-cyan2">{I.fish()}</div>
          <div className="leading-none">
            <div className="font-disp font-extrabold text-[15px] tracking-wide text-ink2">GREYLINE</div>
            <div className="text-[8px] tracking-[0.3em] text-cyan2/80 mt-0.5">AQUARIUM TYCOON</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-1 justify-center flex-wrap">
          <Chip label="Cash" accent="text-amber2"><span className="inline-flex items-center gap-1"><span className="w-3.5 h-3.5">{I.coin("#f4b83f")}</span>{fmt$(s.cash)}</span></Chip>
          <Chip label="Income" accent="text-cyan2">+{fmt$(s.income)}/m</Chip>
          <Chip label="Visitors"><span className="inline-flex items-center gap-1"><span className="w-3 h-3 text-cyan2">{I.person()}</span>{s.visitors}</span></Chip>
          <div className="flex items-center gap-2 border border-line bg-panel/80 px-2.5 py-1 rounded-[3px]">
            <span className="text-[9px] font-semibold tracking-[0.16em] text-dim uppercase">Rep</span>
            <span className="flex gap-[2px] w-3 h-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={`w-3 h-3 ${i < Math.round(stars) ? "text-amber2" : "text-[#1d4550]"}`}>{I.star()}</span>
              ))}
            </span>
            <span className="text-[12px] text-ink2 tabular-nums">{stars.toFixed(1)}</span>
          </div>
          <Chip label={`Day ${s.day}`}>
            <span className="inline-flex items-center gap-1.5">{s.clock}{s.night && <span className="w-3 h-3 text-[#7ea6c9]">{I.moon()}</span>}</span>
          </Chip>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={p.onMute} className="w-8 h-8 grid place-items-center border border-line bg-panel/80 rounded-[3px] text-dim hover:text-cyan2 hover:border-cyan2/50 transition-colors p-1.5" title="Mute [M]">
            {s.muted ? I.mute() : I.snd()}
          </button>
          <button onClick={p.onPause} className="w-8 h-8 grid place-items-center border border-line bg-panel/80 rounded-[3px] text-dim hover:text-cyan2 hover:border-cyan2/50 transition-colors p-1.5" title="Pause [P]">
            {s.phase === "paused" ? I.play() : I.pause()}
          </button>
        </div>
      </div>

      {/* bankruptcy warning */}
      {s.bankruptWarn > 0 && s.phase === "playing" && (
        <div className="absolute top-16 inset-x-0 z-30 flex justify-center pointer-events-none">
          <div className="animate-pulse border border-coral2/70 bg-[#3a0f0acc] text-coral2 font-disp font-bold tracking-widest text-sm px-5 py-2 rounded-[3px]">
            BANKRUPTCY IN {Math.ceil(s.bankruptWarn)}s — BUY A FISH!
          </div>
        </div>
      )}

      {/* shop */}
      <div className={`absolute left-2 top-[62px] bottom-[46px] z-20 flex transition-transform duration-200 ${p.shopOpen ? "" : "-translate-x-[248px]"}`}>
        <div className="w-60 flex flex-col bg-panel/92 border border-line rounded-[4px] shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-[#082833]">
            <span className="font-disp font-bold text-[12px] tracking-[0.14em] text-cyan2">COLDWATER STOCK</span>
            <span className="text-[10px] text-dim tabular-nums">load {s.bioload}/{s.cap}</span>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-1.5 space-y-1.5">
            {SPECIES.map((sp) => {
              const count = s.speciesCount[sp.id] ?? 0;
              const locked = !!sp.requiresCap && s.cap < sp.requiresCap;
              const maxed = count >= sp.maxOf;
              const full = s.bioload + sp.load > s.cap;
              const poor = s.cash < sp.cost;
              const off = locked || maxed || full;
              return (
                <div key={sp.id} className={`border rounded-[3px] p-2 transition-colors ${locked ? "border-line/50 opacity-55" : "border-line bg-[#07242e] hover:border-cyan2/40"}`}>
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[12.5px] font-semibold text-ink2">{sp.name}{count > 0 && <span className="text-dim text-[10px] ml-1">x{count}</span>}</span>
                    <span className="text-[12px] font-bold text-amber2 tabular-nums whitespace-nowrap">{fmt$(sp.cost)}</span>
                  </div>
                  <div className="text-[10px] italic text-[#5f8a8d] leading-tight">{sp.latin} — {sp.fact}</div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className="flex items-center -space-x-0.5 mr-1">
                      {[sp.anatomy.back, sp.anatomy.side, sp.anatomy.finPaired].map((c, i) => (
                        <span key={i} className="w-2.5 h-2.5 rounded-full border border-[#04161c]" style={{ background: c }} />
                      ))}
                    </span>
                    {tagsFor(sp).map((t) => (
                      <span key={t} className="text-[8px] tracking-wider uppercase px-1 py-px rounded-[2px] bg-cyan2/10 text-cyan2/80 border border-cyan2/20">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="flex items-center gap-1.5 text-[9.5px] text-dim">
                      <span className="flex gap-[1px]">{Array.from({ length: 3 }).map((_, i) => <span key={i} className={`w-1.5 h-1.5 rotate-45 ${i < Math.ceil(sp.appeal / 3) ? "bg-cyan2" : "bg-[#1d4550]"}`} />)}</span>
                      appeal {sp.appeal} · load {sp.load}
                    </span>
                    {locked ? (
                      <span className="flex items-center gap-1 text-[10px] text-dim"><span className="w-3 h-3">{I.lock()}</span>Grand Tank</span>
                    ) : (
                      <button
                        onClick={() => p.onBuy(sp.id)}
                        disabled={off || poor}
                        className={`text-[10.5px] font-bold tracking-wider px-2 py-[3px] rounded-[2px] border transition-all active:translate-y-px ${off ? "border-line text-dim opacity-40 cursor-not-allowed" : poor ? "border-coral2/50 text-coral2/70 cursor-not-allowed" : "border-amber2/70 text-amber2 bg-amber2/10 hover:bg-amber2/25 cursor-pointer"}`}
                      >
                        {maxed ? "MAX" : full ? "FULL" : "ADD"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button onClick={p.onToggleShop} className="self-center ml-1 w-5 h-16 border border-line bg-panel/92 rounded-r-[4px] text-dim hover:text-cyan2 grid place-items-center text-[10px]">{p.shopOpen ? "\u25C2" : "\u25B8"}</button>
      </div>

      {/* ops */}
      <div className={`absolute right-2 top-[62px] bottom-[46px] z-20 flex justify-end transition-transform duration-200 ${p.opsOpen ? "" : "translate-x-[248px]"}`}>
        <button onClick={p.onToggleOps} className="self-center mr-1 w-5 h-16 border border-line bg-panel/92 rounded-l-[4px] text-dim hover:text-cyan2 grid place-items-center text-[10px]">{p.opsOpen ? "\u25B8" : "\u25C2"}</button>
        <div className="w-60 flex flex-col bg-panel/92 border border-line rounded-[4px] shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="px-3 py-2 border-b border-line bg-[#082833]">
            <span className="font-disp font-bold text-[12px] tracking-[0.14em] text-cyan2">OPERATIONS</span>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-2.5 space-y-3">
            <div>
              <div className="text-[9px] tracking-[0.2em] text-dim uppercase mb-1.5">Tank vitals</div>
              <Bar label="Water quality" value={100 - s.dirt} hue={(100 - s.dirt) * 1.15} right={`${Math.round(100 - s.dirt)}%`} />
              <Bar label="Dissolved O₂" value={s.oxygen} hue={s.oxygen < 30 ? 0 : s.oxygen * 1.9} right={`${Math.round(s.oxygen)}%`} />
              <Bar label="Shoal satiety" value={100 - s.avgHunger} hue={(100 - s.avgHunger) * 1.15} right={`${Math.round(100 - s.avgHunger)}%`} />
              <Bar label="Bioload" value={(s.bioload / s.cap) * 100} hue={60 - (s.bioload / s.cap) * 60} right={`${s.bioload}/${s.cap}`} />
            </div>
            <div>
              <div className="text-[9px] tracking-[0.2em] text-dim uppercase mb-1.5">Actions</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={p.onFeed} className={`group border rounded-[3px] px-2 py-1.5 text-left transition-all active:translate-y-px ${s.cash < FEED_BTN_COST ? "border-line opacity-50" : "border-cyan2/50 bg-cyan2/8 hover:bg-cyan2/20"}`}>
                  <span className="flex items-center gap-1 text-cyan2 text-[11px] font-bold"><span className="w-3.5 h-3.5">{I.flake()}</span>FEED <span className="text-dim font-medium">[F]</span></span>
                  <span className="text-[10px] text-dim">{fmt$(FEED_BTN_COST)} · 6 flakes</span>
                </button>
                <button onClick={p.onClean} disabled={s.cleanCd > 0} className={`relative overflow-hidden border rounded-[3px] px-2 py-1.5 text-left transition-all active:translate-y-px ${s.cleanCd > 0 ? "border-line opacity-60" : s.cash < CLEAN_COST ? "border-line opacity-50" : "border-[#5fbf6a]/50 bg-[#5fbf6a]/8 hover:bg-[#5fbf6a]/20"}`}>
                  {s.cleanCd > 0 && <span className="absolute inset-y-0 left-0 bg-[#5fbf6a]/15" style={{ width: `${(1 - s.cleanCd) * 100}%` }} />}
                  <span className="relative flex items-center gap-1 text-[#7dd98a] text-[11px] font-bold"><span className="w-3.5 h-3.5">{I.drop()}</span>CLEAN <span className="text-dim font-medium">[C]</span></span>
                  <span className="relative text-[10px] text-dim">{fmt$(CLEAN_COST)} · scrub tank</span>
                </button>
              </div>
              <div className="text-[9.5px] text-dim mt-1 leading-snug">Tip: click the water to drop feed right where you want it ($1).</div>
            </div>
            <div>
              <div className="text-[9px] tracking-[0.2em] text-dim uppercase mb-1.5">Upgrades</div>
              <div className="space-y-1">
                {UPGRADES.map((u) => {
                  const has = s.owned.includes(u.id);
                  const prereq =
                    (u.id === "filter3" && !s.owned.includes("filter2")) ||
                    (u.id === "cap3" && !s.owned.includes("cap2")) ||
                    (u.id === "ad2" && !s.owned.includes("ad1"));
                  return (
                    <button key={u.id} onClick={() => p.onUpgrade(u.id)} disabled={has || prereq}
                      className={`w-full text-left border rounded-[3px] px-2 py-1 flex items-center justify-between gap-2 transition-colors ${has ? "border-line/60 bg-[#07242e] opacity-60" : prereq ? "border-line/60 opacity-45 cursor-not-allowed" : s.cash < u.cost ? "border-line hover:border-line" : "border-line hover:border-cyan2/50 bg-[#07242e]"}`}>
                      <span className="min-w-0">
                        <span className={`block text-[11px] font-semibold ${has ? "text-dim" : "text-ink2"}`}>{u.name}</span>
                        <span className="block text-[9.5px] text-dim leading-tight">{u.desc}</span>
                      </span>
                      {has ? <span className="w-3.5 h-3.5 text-[#7dd98a] shrink-0">{I.check()}</span>
                        : <span className={`text-[11px] font-bold tabular-nums shrink-0 ${s.cash < u.cost ? "text-coral2/70" : "text-amber2"}`}>{fmt$(u.cost)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[9px] tracking-[0.2em] text-dim uppercase mb-1.5">Certificates · {s.claimed.length}/{MILESTONES.length}</div>
              <div className="space-y-[3px]">
                {MILESTONES.map((m) => {
                  const got = s.claimed.includes(m.id);
                  return (
                    <div key={m.id} className={`flex items-center gap-1.5 text-[10px] ${got ? "text-amber2" : "text-dim"}`}>
                      <span className={`w-3 h-3 shrink-0 grid place-items-center border rounded-[2px] ${got ? "border-amber2/70 bg-amber2/15 p-[2.5px]" : "border-line"}`}>{got && I.check("#f4b83f")}</span>
                      <span className="flex-1 truncate">{m.name}</span>
                      <span className="tabular-nums opacity-70">+{m.reward}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* toasts */}
      <div className="absolute bottom-12 inset-x-0 z-30 flex flex-col items-center gap-1.5 pointer-events-none">
        {s.toasts.map((t) => (
          <div key={t.id} className={`toast-in border px-3.5 py-1.5 rounded-[3px] text-[12px] font-medium shadow-[0_6px_20px_rgba(0,0,0,0.5)] ${
            t.kind === "money" ? "border-amber2/70 bg-[#3a2c08ee] text-amber2" :
            t.kind === "good" ? "border-cyan2/60 bg-[#06303aee] text-cyan2" :
            t.kind === "warn" ? "border-coral2/70 bg-[#3a130cee] text-coral2" :
            "border-line bg-[#062430ee] text-ink2"}`}>{t.msg}</div>
        ))}
      </div>

      {/* visitor silhouettes */}
      <VisitorLayer n={s.phase === "playing" || s.phase === "paused" ? s.visitors : 0} />

      {/* hint bar */}
      {(() => {
        const rec = p.inspectId ? s.fish.find((f) => f.id === p.inspectId) : undefined;
        if (!rec) return null;
        return (
          <InspectPanel
            rec={rec}
            focused={p.focusId === rec.id}
            onFocus={() => p.onToggleFocus(rec.id)}
            onFeed={() => p.onFeedFish(rec.id)}
            onSell={() => p.onSellFish(rec.id)}
            onClose={p.onCloseInspect}
          />
        );
      })()}

      <ZoomCluster pct={p.zoomPct} onZoom={p.onZoom} />

      <div className="absolute bottom-0 inset-x-0 z-10 h-9 flex items-center justify-center gap-4 bg-gradient-to-t from-[#02101499] to-transparent text-[10px] text-dim tracking-wide pointer-events-none select-none">
        <span><b className="text-cyan2/80">CLICK FISH</b> inspect</span>
        <span><b className="text-cyan2/80">CLICK WATER</b> feed $1</span>
        <span><b className="text-cyan2/80">DRAG / WASD</b> move cam</span>
        <span><b className="text-cyan2/80">WHEEL / +−</b> zoom</span>
        <span><b className="text-cyan2/80">F</b> sprinkle</span>
        <span><b className="text-cyan2/80">C</b> clean</span>
        <span><b className="text-cyan2/80">P</b> pause</span>
      </div>

      {s.activeEvent && (
        <EventModal event={s.activeEvent} countdown={s.eventCountdown} onChoice={p.onEventChoice} />
      )}
    </>
  );
}

function EventModal({ event, countdown, onChoice }: { event: NonNullable<Snapshot["activeEvent"]>; countdown: number; onChoice: (c: 0 | 1) => void }) {
  const icon = event.icon === "gift" ? I.gift : event.icon === "leaf" ? I.leaf : event.icon === "wrench" ? I.wrench : event.icon === "star" ? I.star : event.icon === "person" ? I.person : I.alert;
  const urgent = event.icon === "alert" || event.icon === "wrench";
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#02090ccc] toast-in">
      <div className="w-[380px] max-w-[92vw] rounded-[6px] border border-line bg-panel shadow-[0_18px_50px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className={"flex items-center gap-2.5 px-4 py-2.5 border-b border-line " + (urgent ? "bg-[#3d2430]" : "bg-[#0d3140]")}>
          <span className={"w-5 h-5 shrink-0 " + (urgent ? "text-coral2" : "text-cyan2")}>{icon()}</span>
          <span className="font-disp font-extrabold text-[15px] tracking-wide text-ink2">{event.title}</span>
          <span className="ml-auto text-[10px] tabular-nums text-dim">auto in {Math.max(0, Math.ceil(countdown))}s</span>
        </div>
        <p className="px-4 pt-3 text-[12.5px] leading-relaxed text-ink2/90">{event.desc}</p>
        <div className="p-4 pt-3 grid gap-2">
          {event.choices.map((c, i) => (
            <button key={i} onClick={() => onChoice(i as 0 | 1)}
              className={"text-left px-3 py-2.5 rounded-[4px] border transition-all active:translate-y-px " +
                (i === 0 ? "border-amber2/60 bg-amber2/8 hover:bg-amber2/18" : "border-line bg-[#082833] hover:bg-[#0d3442]")}>
              <span className={"block font-disp font-bold text-[12.5px] tracking-wide " + (i === 0 ? "text-amber2" : "text-cyan2")}>{c.label}</span>
              <span className="block text-[10.5px] text-dim mt-0.5">
                {c.delta.cash ? (c.delta.cash > 0 ? `+$${c.delta.cash}` : `−$${-c.delta.cash}`) : ""}
                {c.delta.dirt ? ` · dirt ${c.delta.dirt > 0 ? "+" : ""}${c.delta.dirt}` : ""}
                {c.delta.rep ? ` · rep ${c.delta.rep > 0 ? "+" : ""}${c.delta.rep}` : ""}
                {c.delta.oxygen ? ` · O₂ ${c.delta.oxygen > 0 ? "+" : ""}${c.delta.oxygen}` : ""}
                {c.delta.visitors ? ` · visitors +${c.delta.visitors}` : ""}
                {!c.delta.cash && !c.delta.dirt && !c.delta.rep && !c.delta.oxygen && !c.delta.visitors ? "no immediate effect" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VisitorLayer({ n }: { n: number }) {
  const count = Math.min(7, n);
  return (
    <div className="absolute bottom-6 inset-x-0 z-10 h-16 pointer-events-none overflow-hidden opacity-70">
      {Array.from({ length: count }).map((_, i) => {
        const dur = 26 + ((i * 7) % 18);
        const sc = 0.7 + ((i * 13) % 5) * 0.09;
        const delay = -i * 5.7;
        return (
          <div key={i} className="absolute bottom-0 visitor-walk" style={{ animationDuration: dur + "s", animationDelay: delay + "s" }}>
            <div className="w-7 h-14 text-[#04181e]" style={{ transform: "scale(" + sc + ")" }}>{I.person()}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── fish inspect panel ────────────────────────────────────────────────────────
function MiniBar({ label, val }: { label: string; val: number }) {
  const col = val > 55 ? "#58c287" : val > 30 ? "#f4b83f" : "#ff7b5c";
  return (
    <div>
      <div className="flex justify-between text-[9px] tracking-wider text-dim mb-0.5">
        <span>{label.toUpperCase()}</span>
        <span className="tabular-nums text-ink2/80">{val}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#04161c] border border-line/50 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: Math.max(2, Math.min(100, val)) + "%", background: col }} />
      </div>
    </div>
  );
}

function InspectPanel({ rec, focused, onFocus, onFeed, onSell, onClose }: {
  rec: FishView; focused: boolean;
  onFocus: () => void; onFeed: () => void; onSell: () => void; onClose: () => void;
}) {
  const def = SPECIES.find((s) => s.id === rec.speciesId);
  if (!def) return null;
  const sell = Math.round(def.cost * 0.5 * (0.5 + 0.5 * rec.scale));
  const len = Math.round(def.L * rec.scale * 44);
  const sat = Math.round(100 - rec.hunger);
  return (
    <div className="absolute left-3 bottom-11 z-30 w-[266px] toast-in">
      <div className="rounded-[6px] border border-line bg-panel/95 shadow-[0_12px_34px_rgba(0,0,0,0.55)] overflow-hidden">
        <div className="flex items-start justify-between px-3 pt-2.5">
          <div>
            <div className="font-disp font-extrabold text-[15px] text-ink2 leading-tight">{def.name}</div>
            <div className="text-[10px] italic text-dim">{def.latin}</div>
          </div>
          <button onClick={onClose} aria-label="Close panel"
            className="w-6 h-6 grid place-items-center rounded-[4px] text-dim hover:text-ink2 hover:bg-cyan2/10 transition-colors">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="px-3 pt-2 space-y-1.5">
          <MiniBar label="Health" val={Math.round(rec.health)} />
          <MiniBar label="Satiety" val={sat} />
        </div>
        <div className="px-3 pt-2 grid grid-cols-3 gap-1 text-center">
          <div className="rounded-[4px] bg-[#04161c] border border-line/60 py-1">
            <div className="text-[8px] text-dim tracking-[0.15em]">LENGTH</div>
            <div className="font-disp font-bold text-[13px] text-cyan2">{len}<span className="text-[9px] font-body text-dim"> cm</span></div>
          </div>
          <div className="rounded-[4px] bg-[#04161c] border border-line/60 py-1">
            <div className="text-[8px] text-dim tracking-[0.15em]">GROWTH</div>
            <div className="font-disp font-bold text-[13px] text-cyan2">{Math.round(rec.scale * 100)}<span className="text-[9px] font-body text-dim"> %</span></div>
          </div>
          <div className="rounded-[4px] bg-[#04161c] border border-line/60 py-1">
            <div className="text-[8px] text-dim tracking-[0.15em]">VALUE</div>
            <div className="font-disp font-bold text-[13px] text-amber2">{fmt$(sell)}</div>
          </div>
        </div>
        <p className="px-3 pt-2 text-[10px] text-dim leading-snug">{def.fact}</p>
        <div className="px-3 py-2.5 flex gap-1.5">
          <button onClick={onFocus}
            className={"flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[4px] border font-disp font-bold text-[11px] tracking-wide transition-all active:scale-95 " +
              (focused
                ? "border-amber2 bg-amber2 text-[#241503] shadow-[0_0_14px_rgba(244,184,63,0.35)]"
                : "border-amber2/60 text-amber2 hover:bg-amber2/10")}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="6.5" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
            {focused ? "UNFOCUS" : "FOCUS CAM"}
          </button>
          <button onClick={onFeed}
            className="flex-1 h-8 rounded-[4px] border border-cyan2/60 text-cyan2 font-disp font-bold text-[11px] tracking-wide hover:bg-cyan2/10 transition-all active:scale-95">
            FEED {fmt$(FEED_BTN_COST)}
          </button>
          <button onClick={onSell}
            className="flex-1 h-8 rounded-[4px] border border-coral2/60 text-coral2 font-disp font-bold text-[11px] tracking-wide hover:bg-coral2/10 transition-all active:scale-95">
            SELL +{fmt$(sell)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── zoom cluster ──────────────────────────────────────────────────────────────
function ZoomCluster({ pct, onZoom }: { pct: number; onZoom: (d: number) => void }) {
  const btn = "w-8 h-8 grid place-items-center rounded-[5px] border border-line bg-panel/95 text-cyan2 hover:bg-cyan2/15 hover:text-ink2 active:scale-90 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.4)]";
  return (
    <div className="absolute right-3 bottom-11 z-20 flex flex-col items-center gap-1">
      <button className={btn} onClick={() => onZoom(1.6)} aria-label="Zoom in">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21M8 10.5h5M10.5 8v5" /></svg>
      </button>
      <div className="font-disp font-bold text-[10px] text-cyan2/90 tabular-nums px-1 py-0.5 rounded-[4px] bg-panel/90 border border-line/70">{pct}%</div>
      <button className={btn} onClick={() => onZoom(-1.6)} aria-label="Zoom out">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21M8 10.5h5" /></svg>
      </button>
    </div>
  );
}
