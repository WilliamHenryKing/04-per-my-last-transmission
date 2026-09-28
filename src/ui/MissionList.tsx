import { MISSIONS } from "../game/missions";
import type { Controller } from "./controller";
import { StampRow } from "./StampRow";
import { useFocusOnMount } from "./useFocusOnMount";

export function MissionList({ game }: { game: Controller }) {
  const focusRef = useFocusOnMount<HTMLButtonElement>();
  const p = game.progress;
  return (
    <div className="pointer-events-auto fixed inset-0 grid place-items-center bg-night/70 p-3">
      <div
        className="plate max-h-[90vh] w-full max-w-[520px] overflow-y-auto px-4 py-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="missions-title"
      >
        <div className="flex items-center justify-between">
          <h2 id="missions-title" className="text-lg font-extrabold">
            Delivery manifest
          </h2>
          <button
            type="button"
            className="btn px-3 py-2 text-xs"
            onClick={() => game.closePanel()}
            ref={focusRef}
          >
            Close<span className="kbd">Esc</span>
          </button>
        </div>
        <ol className="mt-3 flex flex-col gap-2">
          {MISSIONS.map((m, i) => {
            const locked = i > p.unlocked;
            const best = p.best[m.id];
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className="btn flex w-full items-center justify-between gap-2 text-left normal-case"
                  disabled={locked}
                  onClick={() => game.select(i)}
                  aria-label={`${i + 1}. ${locked ? "Locked" : m.title}, ${best?.stamps.length ?? 0} of 3 stamps`}
                >
                  <span className="tracking-normal">
                    <span className="text-post">{i + 1}.</span>{" "}
                    {locked ? "Sealed until further notice" : m.title}
                  </span>
                  <span aria-hidden="true">
                    <StampRow earned={best?.stamps ?? []} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="label mt-3 text-[10px] opacity-70">
          Stamps: D delivered · G gentle (contents intact) · F frugal (fuel under par)
        </p>
      </div>
    </div>
  );
}
