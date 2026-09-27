import type { FlightEnd, Mission, ParcelKind } from "./types";

export interface ParcelSpec {
  label: string;
  /** Highest relative arrival speed the contents survive. */
  tolerance: number;
  /** Robust parcels ricochet off debris; fragile ones do not survive it. */
  bounces: boolean;
  blurb: string;
}

export const PARCELS: Record<ParcelKind, ParcelSpec> = {
  fragile: {
    label: "Fragile",
    tolerance: 1.3,
    bounces: false,
    blurb: "Gentle arrival required. Debris is fatal.",
  },
  robust: {
    label: "Robust",
    tolerance: 2.8,
    bounces: true,
    blurb: "Takes a knock. Ricochets off debris.",
  },
};

export const BRAKE_FUEL = 25;

export function fuelUsed(power: number, braked: boolean): number {
  return Math.round(power) + (braked ? BRAKE_FUEL : 0);
}

export type Stamp = "DELIVERED" | "GENTLE" | "FRUGAL" | "UNCORRECTED";
export const ALL_STAMPS: Stamp[] = ["DELIVERED", "GENTLE", "FRUGAL", "UNCORRECTED"];

export type Verdict = "delivered" | "rejected" | "crashed" | "lost";

export interface Outcome {
  verdict: Verdict;
  headline: string;
  detail: string;
  stamps: Stamp[];
  relSpeed: number | null;
  fuel: number;
  braked: boolean;
  closestMiss: number;
}

export function judge(
  m: Mission,
  end: FlightEnd,
  power: number,
  braked: boolean,
  closestMiss: number,
): Outcome {
  const spec = PARCELS[m.parcel];
  const fuel = fuelUsed(power, braked);
  const base = { fuel, braked, closestMiss, relSpeed: null, stamps: [] as Stamp[] };
  if (end.kind === "arrived") {
    const rel = end.relSpeed;
    if (rel > spec.tolerance) {
      return {
        ...base,
        relSpeed: rel,
        verdict: "rejected",
        headline: "Arrived with excessive enthusiasm",
        detail: `Arrival ${rel.toFixed(2)} against a limit of ${spec.tolerance.toFixed(1)}. The customer has declined the ${m.item.toLowerCase()}. And the dent.`,
      };
    }
    const stamps: Stamp[] = ["DELIVERED"];
    if (rel <= spec.tolerance * 0.5) stamps.push("GENTLE");
    if (fuel <= m.fuelPar) stamps.push("FRUGAL");
    if (!braked) stamps.push("UNCORRECTED");
    return {
      ...base,
      relSpeed: rel,
      stamps,
      verdict: "delivered",
      headline: "Delivered",
      detail: `Arrival ${rel.toFixed(2)} (limit ${spec.tolerance.toFixed(1)}). Signed for by ${m.client}, with visible reluctance.`,
    };
  }
  const miss = `Closest pass: ${closestMiss.toFixed(2)} from the dock.`;
  if (end.kind === "crashed") {
    const into = end.into === "debris" ? "some debris" : end.into;
    return {
      ...base,
      verdict: "crashed",
      headline: "Returned to sender",
      detail: `Delivered to ${into}, which did not order it. ${miss}`,
    };
  }
  return {
    ...base,
    verdict: "lost",
    headline: end.reason === "bounds" ? "Lost in transit" : "Still in transit",
    detail:
      end.reason === "bounds"
        ? `Left the delivery zone. It is now someone else's problem. ${miss}`
        : `Customer service has closed for the day. ${miss}`,
  };
}
