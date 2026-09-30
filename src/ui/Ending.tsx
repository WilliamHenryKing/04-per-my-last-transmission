import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { MISSIONS } from "../game/missions";
import { totalStamps } from "../game/progress";
import { ALL_STAMPS } from "../game/rules";
import type { Controller } from "./controller";
import { trapPanelTab, usePanelFocus } from "./focus";
import { SoundButton } from "./SoundButton";
import { StampRow } from "./StampRow";

export function Ending({
  game,
  reducedMotion,
  onPlayFocus,
}: {
  game: Controller;
  reducedMotion: boolean;
  onPlayFocus: () => void;
}) {
  const focusRef = usePanelFocus(true);
  const root = useRef<HTMLDivElement>(null);
  const stamps = totalStamps(game.progress);
  const max = MISSIONS.length * ALL_STAMPS.length;

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
    { scope: root, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  return (
    <div
      ref={root}
      className="modal-backdrop pointer-events-auto fixed inset-0 grid place-items-center bg-night/80 p-3"
    >
      <div
        ref={focusRef}
        className="memo plate dialog-panel keyboard-scroll w-full max-w-[520px] px-5 py-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ending-title"
        aria-describedby="ending-copy"
        tabIndex={-1}
        onKeyDown={(event) => trapPanelTab(event, focusRef.current)}
      >
        <p className="label text-post">Internal memo · Re: your performance</p>
        <h2 id="ending-title" className="mt-1 text-xl font-extrabold">
          Per my last transmission
        </h2>
        <div id="ending-copy" className="mt-3 space-y-2 text-sm">
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
        <ol className="mt-3 grid gap-1 border-t border-dashed border-ink/40 pt-2 text-xs">
          {MISSIONS.map((m, i) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <span>
                <span className="text-post">{i + 1}.</span> {m.title}
              </span>
              <StampRow earned={game.progress.best[m.id]?.stamps ?? []} />
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs opacity-80">
          Every missing stamp is a gentler or cheaper route still waiting in the manifest.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <SoundButton game={game} />
          <button
            type="button"
            className="btn"
            onClick={() => game.closePanel()}
            aria-keyshortcuts="Escape"
          >
            Close report
          </button>
          <button type="button" className="btn" onClick={() => game.openMissions()}>
            Manifest
          </button>
          <button
            type="button"
            className="btn btn-post"
            onClick={() => {
              game.select(0);
              onPlayFocus();
            }}
          >
            Start the round again
          </button>
        </div>
      </div>
    </div>
  );
}
