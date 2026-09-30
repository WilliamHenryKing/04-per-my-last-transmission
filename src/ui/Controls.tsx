import { fuelUsed } from "../game/rules";
import type { Controller } from "./controller";

export function Controls({ game }: { game: Controller }) {
  const s = game.session;
  const aiming = s.phase === "aim";
  const flying = s.phase === "flight";
  const brakeLeft = flying && !s.flight?.braked;
  const fuel = fuelUsed(s.aim.power, !!s.flight?.braked);
  const angle = Math.round(s.aim.angle) % 360;
  return (
    <section
      className="plate launch-controls pointer-events-auto grid w-full max-w-[760px] grid-cols-2 items-end gap-x-4 gap-y-2 px-3 py-3 sm:grid-cols-[1fr_1fr_auto] sm:px-4"
      aria-label="Launch controls"
    >
      <label className="flex flex-col">
        <span className="label flex justify-between">
          Aim <output className="font-mono tabular-nums">{angle}°</output>
        </span>
        <input
          className="slider"
          type="range"
          min={0}
          max={359}
          step={1}
          value={angle}
          disabled={!aiming}
          onChange={(e) => game.setAim({ angle: Number(e.currentTarget.value) })}
          aria-label="Launch angle in degrees"
          aria-valuetext={`${angle} degrees`}
        />
      </label>
      <label className="flex flex-col">
        <span className="label flex justify-between">
          Power <output className="font-mono tabular-nums">{s.aim.power}%</output>
        </span>
        <input
          className="slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={s.aim.power}
          disabled={!aiming}
          onChange={(e) => game.setAim({ power: Number(e.currentTarget.value) })}
          aria-label="Launch power in percent"
          aria-valuetext={`${s.aim.power} percent`}
        />
      </label>
      <div className="launch-actions col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
        <p className="fuel-label label mr-1 text-[10px] opacity-70 sm:hidden">Fuel {fuel}</p>
        <button
          type="button"
          className="btn"
          onClick={() => game.retry()}
          aria-label="Retry mission (R)"
          aria-keyshortcuts="R"
        >
          Retry<span className="kbd max-sm:hidden">R</span>
        </button>
        {flying ? (
          <button
            type="button"
            className="btn btn-brass min-w-[132px]"
            onClick={() => game.brake()}
            disabled={!brakeLeft}
            aria-label={brakeLeft ? "Brake, one use (B)" : "Brake already used"}
            aria-keyshortcuts="B Space"
          >
            {brakeLeft ? "Brake ×1" : "Braked"}
            <span className="kbd max-sm:hidden">B</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-post min-w-[132px]"
            onClick={() => game.launch()}
            disabled={!aiming}
            aria-label="Launch parcel (Space)"
            aria-keyshortcuts="Space Enter"
          >
            Launch<span className="kbd max-sm:hidden">Space</span>
          </button>
        )}
      </div>
      <p className="launch-notes label col-span-2 hidden text-[10px] opacity-70 sm:col-span-3 sm:block">
        Fuel this attempt: {fuel} · Drag on the chart to aim · Arrows fine-tune · Shift for bigger
        steps
      </p>
    </section>
  );
}
