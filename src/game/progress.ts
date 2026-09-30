import { MISSIONS } from "./missions";
import type { Outcome, Stamp } from "./rules";
import { ALL_STAMPS } from "./rules";

export interface Best {
  stamps: Stamp[];
  fuel: number;
  relSpeed: number;
}

export interface Progress {
  /** Highest mission index the player may open. */
  unlocked: number;
  best: Record<string, Best>;
  finished: boolean;
}

export const EMPTY_PROGRESS: Progress = { unlocked: 0, best: {}, finished: false };

/** Fold a delivered outcome into progress. Pure: returns a new record. */
export function record(
  p: Progress,
  missionId: string,
  index: number,
  total: number,
  o: Outcome,
): Progress {
  if (o.verdict !== "delivered" || o.relSpeed === null) return p;
  const prev = p.best[missionId];
  const stamps = ALL_STAMPS.filter((s) => o.stamps.includes(s) || prev?.stamps.includes(s));
  const best: Best = {
    stamps,
    fuel: Math.min(prev?.fuel ?? Number.POSITIVE_INFINITY, o.fuel),
    relSpeed: Math.min(prev?.relSpeed ?? Number.POSITIVE_INFINITY, o.relSpeed),
  };
  return {
    unlocked: Math.min(total - 1, Math.max(p.unlocked, index + 1)),
    best: { ...p.best, [missionId]: best },
    finished: p.finished || index === total - 1,
  };
}

export function rating(p: Progress, missionId: string): number {
  return p.best[missionId]?.stamps.length ?? 0;
}

export function totalStamps(p: Progress): number {
  return Object.values(p.best).reduce((n, b) => n + b.stamps.length, 0);
}

/** Accept only a well-formed saved record; anything else starts fresh. */
export function parseProgress(raw: string | null): Progress {
  if (!raw) return EMPTY_PROGRESS;
  try {
    const v = JSON.parse(raw) as Partial<Progress>;
    if (
      typeof v.unlocked !== "number" ||
      !Number.isFinite(v.unlocked) ||
      typeof v.best !== "object" ||
      v.best === null ||
      Array.isArray(v.best)
    ) {
      return EMPTY_PROGRESS;
    }
    // Retain current missions and legacy stamps, but never merge invalid saved metrics.
    const best: Record<string, Best> = {};
    for (const mission of MISSIONS) {
      const b = v.best[mission.id];
      if (
        !b ||
        !Array.isArray(b.stamps) ||
        !b.stamps.includes("DELIVERED") ||
        typeof b.fuel !== "number" ||
        !Number.isFinite(b.fuel) ||
        b.fuel < 0 ||
        typeof b.relSpeed !== "number" ||
        !Number.isFinite(b.relSpeed) ||
        b.relSpeed < 0
      )
        continue;
      best[mission.id] = {
        stamps: ALL_STAMPS.filter((stamp) => b.stamps.includes(stamp)),
        fuel: b.fuel,
        relSpeed: b.relSpeed,
      };
    }
    return {
      unlocked: Math.min(MISSIONS.length - 1, Math.max(0, Math.floor(v.unlocked))),
      best,
      finished: v.finished === true,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}
