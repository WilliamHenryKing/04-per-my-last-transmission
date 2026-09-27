import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { MISSIONS } from "../game/missions";
import type { Stamp, Verdict } from "../game/rules";
import type { Controller } from "./controller";
import { useFocusOnMount } from "./useFocusOnMount";

gsap.registerPlugin(useGSAP);

const BIG_STAMP: Record<Verdict, string> = {
  delivered: "Delivered · Officially",
  rejected: "Arrived with excessive enthusiasm",
  crashed: "Return to sender",
  lost: "Lost in transit",
};

const STAMP_NOTES: Record<Stamp, string> = {
  DELIVERED: "Signed for",
  GENTLE: "Under half the limit",
  FRUGAL: "Within fuel budget",
  UNCORRECTED: "No brake used",
};

export function ResultCard({ game, reducedMotion }: { game: Controller; reducedMotion: boolean }) {
  const focusRef = useFocusOnMount<HTMLButtonElement>();
  const s = game.session;
  const o = s.outcome;
  const root = useRef<HTMLDivElement>(null);
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
    { scope: root, dependencies: [o] },
  );

  if (!o) return null;
  const last = s.index === MISSIONS.length - 1;
  return (
    <div className="flex w-full justify-center">
      <div
        ref={root}
        className="plate pointer-events-auto w-full max-w-[480px] px-4 py-3 text-center"
        role="dialog"
        aria-modal="false"
        aria-labelledby="result-title"
      >
        <h2 id="result-title" className="sr-only">
          {o.headline}
        </h2>
        <p className={`stamp stamp-big ${good ? "text-enamel" : "text-post"}`}>
          {BIG_STAMP[o.verdict]}
        </p>
        <p className="mt-3 text-sm">{o.detail}</p>
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
        <p className="label mt-3 text-[10px] opacity-70">
          Fuel {o.fuel}
          {s.mission.fuelPar ? ` / budget ${s.mission.fuelPar}` : ""} ·{" "}
          {o.braked ? "Brake used" : "Brake unused"} · Attempt {s.attempts}
        </p>
        {!good && (
          <p className="mt-2 text-xs italic opacity-80">
            Your route stays on the chart in red, with a ring where the dock was at your closest
            pass.
          </p>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" className="btn" onClick={() => game.retry()}>
            Retry<span className="kbd">R</span>
          </button>
          {good && (
            <button
              type="button"
              className="btn btn-post"
              onClick={() => game.next()}
              ref={focusRef}
            >
              {last ? "File report" : "Next parcel"}
              <span className="kbd">N</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
