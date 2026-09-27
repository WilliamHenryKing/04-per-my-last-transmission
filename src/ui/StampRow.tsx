import { ALL_STAMPS, type Stamp } from "../game/rules";

const SHORT: Record<Stamp, string> = { DELIVERED: "D", GENTLE: "G", FRUGAL: "F" };
const NAME: Record<Stamp, string> = {
  DELIVERED: "Delivered",
  GENTLE: "Gentle",
  FRUGAL: "Frugal",
};

/** A mission's 1–3 stamp rating as tiny inked squares; empty ones are dashed outlines. */
export function StampRow({ earned }: { earned: Stamp[] }) {
  return (
    <span className="inline-flex gap-1">
      <span className="sr-only">
        {earned.length} of {ALL_STAMPS.length} stamps
        {earned.length ? `: ${earned.map((s) => NAME[s]).join(", ")}` : ""}
      </span>
      {ALL_STAMPS.map((s) => {
        const on = earned.includes(s);
        return (
          <span
            key={s}
            title={NAME[s]}
            aria-hidden="true"
            className={`grid h-5 w-5 place-items-center rounded-[3px] font-mono text-[10px] font-black ${
              on
                ? "-rotate-6 border-2 border-post text-post"
                : "border border-dashed border-ink/40 text-ink/30"
            }`}
          >
            {SHORT[s]}
          </span>
        );
      })}
    </span>
  );
}
