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
    if (typeof v.unlocked !== "number" || typeof v.best !== "object" || v.best === null) {
      return EMPTY_PROGRESS;
    }
    // Keep only stamps this version awards (older saves had a fourth).
    const best: Record<string, Best> = {};
    for (const [id, b] of Object.entries(v.best as Record<string, Best>)) {
      if (!b || !Array.isArray(b.stamps)) continue;
      best[id] = { ...b, stamps: ALL_STAMPS.filter((s) => b.stamps.includes(s)) };
    }
    return { unlocked: Math.max(0, Math.floor(v.unlocked)), best, finished: !!v.finished };
  } catch {
    return EMPTY_PROGRESS;
  }
}
