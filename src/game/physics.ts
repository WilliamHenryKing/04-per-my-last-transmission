import type { Aim, Body, Flight, Mission, Motion, StepEvent, Vec } from "./types";

// One fixed step for everything: world clock, real flight and prediction.
// The guide calls the very same step() the parcel uses, so it cannot lie.
export const DT = 1 / 120;
export const SOFTENING = 0.02;
export const PARCEL_RADIUS = 0.12;
export const LAUNCH_OFFSET = 0.55;
export const MIN_SPEED = 2;
export const MAX_SPEED = 6.5;
/** Fraction of velocity kept after the one-and-only brake. */
export const BRAKE_KEEP = 0.4;
export const RESTITUTION = 0.55;

const ORIGIN: Vec = { x: 0, y: 0 };

export function timeOf(tick: number): number {
  return tick * DT;
}

function bodyById(m: Mission, id: string): Body {
  const body = m.bodies.find((b) => b.id === id);
  if (!body) throw new Error(`Unknown body ${id} in ${m.id}`);
  return body;
}

export function positionOf(m: Mission, motion: Motion, t: number): Vec {
  if (motion.kind === "fixed") return motion.at;
  const base = motion.around ? positionOf(m, bodyById(m, motion.around).motion, t) : ORIGIN;
  const a = motion.phase + motion.omega * t;
  return { x: base.x + motion.radius * Math.cos(a), y: base.y + motion.radius * Math.sin(a) };
}

export function velocityOf(m: Mission, motion: Motion, t: number): Vec {
  const h = 1e-3;
  const a = positionOf(m, motion, t - h);
  const b = positionOf(m, motion, t + h);
  return { x: (b.x - a.x) / (2 * h), y: (b.y - a.y) / (2 * h) };
}

export function gravityAt(m: Mission, p: Vec, t: number): Vec {
  let ax = 0;
  let ay = 0;
  for (const body of m.bodies) {
    const c = positionOf(m, body.motion, t);
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    const r2 = dx * dx + dy * dy + SOFTENING;
    const inv = body.gm / (r2 * Math.sqrt(r2));
    ax += dx * inv;
    ay += dy * inv;
  }
  return { x: ax, y: ay };
}

export function launchSpeed(power: number): number {
  const p = Math.min(100, Math.max(0, power)) / 100;
  return MIN_SPEED + p * (MAX_SPEED - MIN_SPEED);
}

export function aimDirection(angleDeg: number): Vec {
  const a = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/** The body the dock orbits: circling it twice earns a remark. */
function circlingCentre(m: Mission, t: number): Vec {
  const motion = m.dock.motion;
  if (motion.kind === "orbit" && motion.around) {
    return positionOf(m, bodyById(m, motion.around).motion, t);
  }
  return ORIGIN;
}

export function launch(m: Mission, launchTick: number, aim: Aim): Flight {
  const dir = aimDirection(aim.angle);
  const speed = launchSpeed(aim.power);
  const p = { x: m.depot.x + dir.x * LAUNCH_OFFSET, y: m.depot.y + dir.y * LAUNCH_OFFSET };
  const t = timeOf(launchTick);
  const c = circlingCentre(m, t);
  const dock = positionOf(m, m.dock.motion, t);
  return {
    p,
    v: { x: dir.x * speed, y: dir.y * speed },
    launchTick,
    step: 0,
    braked: false,
    bounces: 0,
    swept: 0,
    prevAngle: Math.atan2(p.y - c.y, p.x - c.x),
    circled: false,
    closest: { distance: Math.hypot(p.x - dock.x, p.y - dock.y), parcel: { ...p }, dock },
  };
}

export function cloneFlight(f: Flight): Flight {
  return {
    ...f,
    p: { ...f.p },
    v: { ...f.v },
    closest: { ...f.closest, parcel: { ...f.closest.parcel }, dock: { ...f.closest.dock } },
  };
}

/** Pull the one-and-only brake. Returns false if it was already used. */
export function brake(f: Flight): boolean {
  if (f.braked) return false;
  f.braked = true;
  f.v = { x: f.v.x * BRAKE_KEEP, y: f.v.y * BRAKE_KEEP };
  return true;
}

/** Advance one fixed step (semi-implicit Euler). Mutates the flight. */
export function step(m: Mission, f: Flight): StepEvent | null {
  const t = timeOf(f.launchTick + f.step);
  const g = gravityAt(m, f.p, t);
  f.v.x += g.x * DT;
  f.v.y += g.y * DT;
  f.p.x += f.v.x * DT;
  f.p.y += f.v.y * DT;
  f.step += 1;
  const now = timeOf(f.launchTick + f.step);

  for (const body of m.bodies) {
    const c = positionOf(m, body.motion, now);
    if (Math.hypot(f.p.x - c.x, f.p.y - c.y) < body.radius + PARCEL_RADIUS) {
      return { kind: "crashed", into: body.name };
    }
  }

  let bounced = false;
  for (const ob of m.obstacles) {
    const c = positionOf(m, ob.motion, now);
    const dx = f.p.x - c.x;
    const dy = f.p.y - c.y;
    const d = Math.hypot(dx, dy);
    const reach = ob.radius + PARCEL_RADIUS;
    if (d >= reach) continue;
    if (m.parcel === "fragile") return { kind: "crashed", into: "debris" };
    const nx = dx / (d || 1);
    const ny = dy / (d || 1);
    const ov = velocityOf(m, ob.motion, now);
    const rvx = f.v.x - ov.x;
    const rvy = f.v.y - ov.y;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      f.v.x -= (1 + RESTITUTION) * vn * nx;
      f.v.y -= (1 + RESTITUTION) * vn * ny;
    }
    f.p.x = c.x + nx * reach;
    f.p.y = c.y + ny * reach;
    f.bounces += 1;
    bounced = true;
  }

  const dock = positionOf(m, m.dock.motion, now);
  const dd = Math.hypot(f.p.x - dock.x, f.p.y - dock.y);
  if (dd < f.closest.distance) {
    f.closest = { distance: dd, parcel: { ...f.p }, dock };
  }
  if (dd < m.dock.captureRadius) {
    const dv = velocityOf(m, m.dock.motion, now);
    return { kind: "arrived", relSpeed: Math.hypot(f.v.x - dv.x, f.v.y - dv.y) };
  }

  if (Math.abs(f.p.x) > m.bounds.x || Math.abs(f.p.y) > m.bounds.y) {
    return { kind: "lost", reason: "bounds" };
  }
  if (f.step * DT >= m.maxFlightSeconds) return { kind: "lost", reason: "timeout" };
  if (bounced) return { kind: "bounce" };

  const c = circlingCentre(m, now);
  const angle = Math.atan2(f.p.y - c.y, f.p.x - c.x);
  let delta = angle - f.prevAngle;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  f.swept += delta;
  f.prevAngle = angle;
  if (!f.circled && Math.abs(f.swept) > 2 * Math.PI) {
    f.circled = true;
    return { kind: "circled" };
  }
  return null;
}

export function isTerminal(
  e: StepEvent | null,
): e is Exclude<StepEvent, { kind: "bounce" | "circled" }> {
  return e !== null && e.kind !== "bounce" && e.kind !== "circled";
}
