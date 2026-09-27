// Shared shapes for the pure game rules. Flight happens in a 2D plane (x, y);
// the scene maps y onto the 3D ground plane.

export interface Vec {
  x: number;
  y: number;
}

/** Where something is at time t: nailed down, or on a circular orbit around a body (or the origin). */
export type Motion =
  | { kind: "fixed"; at: Vec }
  | { kind: "orbit"; around: string | null; radius: number; omega: number; phase: number };

export type BodyLook = "moon" | "rust" | "gas" | "ice";

export interface Body {
  id: string;
  name: string;
  radius: number;
  /** Gravitational parameter: acceleration = gm / r². */
  gm: number;
  motion: Motion;
  look: BodyLook;
}

export interface Obstacle {
  id: string;
  radius: number;
  motion: Motion;
}

export interface Dock {
  name: string;
  motion: Motion;
  captureRadius: number;
}

export type ParcelKind = "fragile" | "robust";

export interface Aim {
  /** Degrees, counter-clockwise from +x. */
  angle: number;
  /** Percent, 0–100. */
  power: number;
}

export interface Solution {
  delayTicks: number;
  aim: Aim;
  /** Flight step at which the brake is pulled, or null for no correction. */
  brakeStep: number | null;
}

export interface Mission {
  id: string;
  title: string;
  client: string;
  item: string;
  parcel: ParcelKind;
  /** One line of dry humour. Must never delay a launch. */
  note: string;
  depot: Vec;
  bodies: Body[];
  obstacles: Obstacle[];
  dock: Dock;
  /** Seconds of flight the guide is allowed to reveal. */
  guideSeconds: number;
  maxFlightSeconds: number;
  /** Fuel budget for the FRUGAL stamp. */
  fuelPar: number;
  /** Half extents of the playable area; leaving it loses the parcel. */
  bounds: Vec;
  /** A known delivery, checked by the tests. */
  reference: Solution;
}

export type FlightEnd =
  | { kind: "arrived"; relSpeed: number }
  | { kind: "crashed"; into: string }
  | { kind: "lost"; reason: "bounds" | "timeout" };

export type StepEvent = FlightEnd | { kind: "bounce" } | { kind: "circled" };

export interface Closest {
  distance: number;
  parcel: Vec;
  dock: Vec;
}

export interface Flight {
  p: Vec;
  v: Vec;
  launchTick: number;
  step: number;
  braked: boolean;
  bounces: number;
  /** Signed angle swept around the dock's body, for "Just circling back". */
  swept: number;
  prevAngle: number;
  circled: boolean;
  closest: Closest;
}
