import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { MISSIONS } from "../game/missions";
import { totalStamps } from "../game/progress";
import type { Controller } from "./controller";
import { useFocusOnMount } from "./useFocusOnMount";

export function Ending({ game, reducedMotion }: { game: Controller; reducedMotion: boolean }) {
  const focusRef = useFocusOnMount<HTMLButtonElement>();
  const root = useRef<HTMLDivElement>(null);
  const stamps = totalStamps(game.progress);
  const max = MISSIONS.length * 4;

  useGSAP(
    () => {
      if (reducedMotion) return;
      gsap.from(".memo", { y: 40, opacity: 0, duration: 0.5, ease: "power2.out" });
      gsap.from(".stamp-big", {
        scale: 2.6,
        opacity: 0,
        rotation: 20,
        duration: 0.4,
        delay: 0.5,
        ease: "back.out(2)",
      });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className="pointer-events-auto fixed inset-0 grid place-items-center bg-night/80 p-3"
    >
      <div
        className="memo plate max-h-[92vh] w-full max-w-[520px] overflow-y-auto px-5 py-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ending-title"
      >
        <p className="label text-post">Internal memo · Re: your performance</p>
        <h2 id="ending-title" className="mt-1 text-xl font-extrabold">
          Per my last transmission
        </h2>
        <div className="mt-3 space-y-2 text-sm">
          <p>
            All eight parcels have been delivered. Head Office has received its own complaint about
            late deliveries, and has filed it.
          </p>
          <p>
            You are hereby named <strong>Employee of the Quarter (Provisional)</strong>. The
            provisional part is permanent.
          </p>
          <p className="italic opacity-80">
            This could have been a wormhole. It was, instead, you.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="stamp stamp-big text-enamel">Route closed</p>
          <p className="text-right font-mono text-sm">
            {stamps} / {max}
            <span className="label block text-[10px] opacity-70">stamps collected</span>
          </p>
        </div>
        <p className="mt-3 text-xs opacity-80">
          Every missing stamp is a gentler, cheaper or uncorrected route still waiting in the
          manifest.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={() => game.openMissions()}>
            Manifest
          </button>
          <button
            type="button"
            className="btn btn-post"
            onClick={() => game.select(0)}
            ref={focusRef}
          >
            Start the round again
          </button>
        </div>
      </div>
    </div>
  );
}
