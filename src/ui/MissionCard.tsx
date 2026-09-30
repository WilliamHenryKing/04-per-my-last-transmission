import { MISSIONS } from "../game/missions";
import { PARCELS } from "../game/rules";
import type { Controller } from "./controller";

export function MissionCard({ game }: { game: Controller }) {
  const s = game.session;
  const m = s.mission;
  const spec = PARCELS[m.parcel];
  const last = s.phase === "aim" ? s.last : null;
  return (
    <section
      className="plate mission-card keyboard-scroll pointer-events-auto w-full px-3 py-2 sm:w-auto sm:max-w-[min(440px,62vw)] sm:px-4 sm:py-3"
      aria-label="Mission"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: The bounded mission summary must support keyboard scrolling.
      tabIndex={0}
    >
      <p className="label text-post">
        Mission {s.index + 1} / {MISSIONS.length}
      </p>
      <h1 className="text-base leading-tight font-extrabold sm:text-xl">{m.title}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
        <span>
          {m.item} → {m.client}
        </span>
        <span
          className={`label rounded px-1.5 py-0.5 text-[10px] ${
            m.parcel === "fragile" ? "bg-post text-paper" : "bg-ink text-cream"
          }`}
          title={spec.blurb}
        >
          {spec.label} · max {spec.tolerance.toFixed(1)}
        </span>
      </p>
      <p className="mt-1 hidden text-xs italic opacity-80 sm:block">{m.note}</p>
      {last && (
        <p className="mt-2 border-t border-dashed border-ink/40 pt-1 font-mono text-[11px] leading-snug">
          <span className="text-post">Last attempt</span> T+{(last.launchTick / 120).toFixed(1)}s ·{" "}
          {last.aim.angle.toFixed(0)}° · {last.aim.power}% ·{" "}
          {last.outcome.verdict === "delivered"
            ? `arrived ${last.outcome.relSpeed?.toFixed(2)}`
            : last.outcome.verdict === "rejected"
              ? `too fast: ${last.outcome.relSpeed?.toFixed(2)}`
              : `missed by ${last.outcome.closestMiss.toFixed(2)}`}
        </p>
      )}
    </section>
  );
}
