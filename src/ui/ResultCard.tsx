import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { MISSIONS } from "../game/missions";
import type { Stamp, Verdict } from "../game/rules";
import type { Controller } from "./controller";
import { usePanelFocus } from "./focus";

gsap.registerPlugin(useGSAP);

const BIG_STAMP: Record<Verdict, string> = {
  delivered: "Delivered · Officially",
  rejected: "Arrived with excessive enthusiasm",
  crashed: "Return to sender",
  lost: "Lost in transit",
};

const STAMP_NOTES: Record<Stamp, string> = {
  DELIVERED: "Signed for",
  GENTLE: "Contents intact: under half the limit",
  FRUGAL: "Within fuel budget",
};

export function ResultCard({ game, reducedMotion }: { game: Controller; reducedMotion: boolean }) {
  const root = usePanelFocus(false);
  const s = game.session;
  const o = s.outcome;
  const good = o?.verdict === "delivered";

  useGSAP(
    () => {
      if (reducedMotion || !o || !root.current) return;
      gsap.from(".stamp-big", {
        scale: 2.4,
        opacity: 0,
        rotation: -18,
        duration: 0.35,
        ease: "back.out(2)",
      });
      if (!root.current.querySelector(".stamp-small")) return;
      gsap.from(".stamp-small", {
        scale: 1.8,
        opacity: 0,
        duration: 0.25,
        stagger: 0.12,
        delay: 0.3,
      });
    },
    { scope: root, dependencies: [o, reducedMotion], revertOnUpdate: true },
  );

  if (!o) return null;
  const last = s.index === MISSIONS.length - 1;
  return (
    <div className="result-wrap flex w-full justify-center">
      <div
        ref={root}
        className="plate result-card keyboard-scroll pointer-events-auto w-full max-w-[480px] px-4 py-3 text-center"
        role="dialog"
        aria-modal="false"
        aria-labelledby="result-title"
        aria-describedby="result-detail result-meta"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: A bounded result needs a keyboard stop for reading and native scrolling.
        tabIndex={0}
      >
        <h2 id="result-title" className="sr-only">
          {o.headline}
        </h2>
        <p className={`stamp stamp-big ${good ? "text-enamel" : "text-post"}`}>
          {BIG_STAMP[o.verdict]}
        </p>
        <p id="result-detail" className="mt-3 text-sm">
          {o.detail}
        </p>
        {good && (
          <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Stamps earned">
            {o.stamps.map((st) => (
              <li
                key={st}
                className="stamp stamp-small text-post text-[11px]"
                title={STAMP_NOTES[st]}
              >
                {st}
              </li>
            ))}
          </ul>
        )}
        <p id="result-meta" className="label mt-3 text-[10px] opacity-70">
          Fuel {o.fuel}
          {s.mission.fuelPar ? ` / budget ${s.mission.fuelPar}` : ""} ·{" "}
          {o.braked ? "Brake used" : "Brake unused"} · Attempt {s.attempts}
        </p>
        {!good && (
          <p className="mt-2 text-xs italic opacity-80">
            Retry to compare your last route in red, with a ring where the dock was at your closest
            pass.
          </p>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => game.retry()}
            data-result-primary={!good || undefined}
            aria-keyshortcuts="R"
          >
            Retry<span className="kbd max-sm:hidden">R</span>
          </button>
          {good && (
            <button
              type="button"
              className="btn btn-post"
              onClick={() => game.next()}
              data-result-primary
              aria-keyshortcuts="N"
            >
              {last ? "File report" : "Next parcel"}
              <span className="kbd max-sm:hidden">N</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
