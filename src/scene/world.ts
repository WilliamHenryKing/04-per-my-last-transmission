import * as THREE from "three";
import { positionOf } from "../game/physics";
import type { Prediction } from "../game/predict";
import type { Cue, Session } from "../game/session";
import type { Mission, Motion } from "../game/types";
import { Burst } from "./burst";
import { type Dock, makeDepot, makeDock, makeParcel } from "./fixtures";
import { Juice } from "./juice";
import { Lamps } from "./lamps";
import { PALETTE } from "./palette";
import { DotPath, FadingLine, LinePath, makeCross, NearMiss } from "./paths";
import { makeInfluence, makeOrbitRing, makePlanet, makeRock } from "./props";
import type { Extents, Stage } from "./stage";

export interface Frame {
  session: Session;
  guide: Prediction | null;
  course: Prediction | null;
  brakeGhost: Prediction | null;
  dt: number;
  reducedMotion: boolean;
}

interface Mover {
  object: THREE.Object3D;
  motion: Motion;
  spin: number;
}

// Guide dots: one per 4 samples (0.1 s), a big one every 5 dots (0.5 s).
const DOT_EVERY = 4;
const DOT_MAJOR = 5;

export class World {
  private readonly stage: Stage;
  private mission: Mission | null = null;
  private missionGroup = new THREE.Group();
  private movers: Mover[] = [];
  private depot = makeDepot();
  private dock: Dock | null = null;
  private readonly lamps: Lamps;
  private readonly parcels: Record<"fragile" | "robust", THREE.Group>;
  private readonly guide = new DotPath(PALETTE.cream);
  private readonly course = new DotPath(PALETTE.cream, 260, 0.035);
  private readonly brakeGhost = new DotPath(PALETTE.brass, 260, 0.045);
  private readonly trail = new LinePath(PALETTE.cream, 0.9);
  private readonly wake = new FadingLine(PALETTE.cream);
  private readonly lastPath = new LinePath(PALETTE.red, 0.75, true);
  private readonly guideMiss = new NearMiss(PALETTE.brass, 0.42);
  private readonly lastMiss = new NearMiss(PALETTE.red, 0.42);
  private readonly guideEnd = makeCross(PALETTE.red);
  private readonly lastBrake = makeOrbitRing(0.12, PALETTE.brass, 0.9);
  private readonly burst = new Burst();
  private readonly v = new THREE.Vector3();
  private readonly juice: Juice;

  constructor(stage: Stage) {
    this.stage = stage;
    const s = stage.scene;
    this.lamps = new Lamps(s);
    const beacon = this.lamps.beacon.bulb;
    this.parcels = { fragile: makeParcel("fragile", beacon), robust: makeParcel("robust", beacon) };
    s.add(this.missionGroup, this.depot.group, this.parcels.fragile, this.parcels.robust);
    s.add(this.guide.mesh, this.course.mesh, this.brakeGhost.mesh, this.trail.line);
    s.add(this.lastPath.line, this.guideMiss.group, this.lastMiss.group, this.guideEnd);
    s.add(this.lastBrake, this.burst.group, this.wake.line);
    this.juice = new Juice(s);
  }

  /** Session cues that deserve a physical flourish in the miniature. */
  react(cue: Cue, session: Session, reducedMotion: boolean) {
    this.juice.react(cue, session, this.depot, this.stage, reducedMotion);
  }

  setMission(m: Mission) {
    this.mission = m;
    this.stage.scene.remove(this.missionGroup);
    this.missionGroup.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          (mat as THREE.MeshBasicMaterial).map?.dispose();
          mat.dispose();
        }
      }
    });
    this.missionGroup = new THREE.Group();
    this.movers = [];
    m.bodies.forEach((b, i) => {
      const planet = makePlanet(b.look, b.radius, i * 3.1);
      planet.add(makeInfluence(b.gm, b.radius));
      this.addMover(planet, b.motion, 0.15 + i * 0.05);
      this.addOrbit(b.motion, PALETTE.cream, 0.18);
    });
    m.obstacles.forEach((o, i) => {
      this.addMover(makeRock(o.radius, i * 1.7), o.motion, 0.4);
      this.addOrbit(o.motion, PALETTE.steel, 0.15);
    });
    this.dock = makeDock(m.dock.name, m.dock.captureRadius, this.lamps.dock.bulb);
    this.addMover(this.dock.group, m.dock.motion, 0);
    this.addOrbit(m.dock.motion, PALETTE.brass, 0.35);
    this.depot.group.position.set(m.depot.x, 0, -m.depot.y);
    this.stage.scene.add(this.missionGroup);
    this.stage.fit(missionExtents(m));
    this.collectOverlays();
    this.burst.clear();
  }

  private addMover(object: THREE.Object3D, motion: Motion, spin: number) {
    this.missionGroup.add(object);
    this.movers.push({ object, motion, spin });
  }

  private addOrbit(motion: Motion, color: number, opacity: number) {
    if (motion.kind !== "orbit") return;
    const ring = makeOrbitRing(motion.radius, color, opacity);
    // Orbit rings around moving parents are re-centred every frame.
    this.addMover(ring, parentMotion(this.mission, motion), 0);
  }

  update(f: Frame) {
    const m = this.mission;
    if (!m) return;
    const s = f.session;
    const t = s.time;
    for (const mv of this.movers) {
      const p = positionOf(m, mv.motion, t);
      mv.object.position.set(p.x, mv.object.position.y, -p.y);
      if (!f.reducedMotion) mv.object.rotation.y += mv.spin * f.dt;
    }
    this.juice.update(f.dt, this.depot, s.aim.angle);
    const focus = s.phase === "flight" && s.flight && !f.reducedMotion ? s.flight.p : null;
    this.stage.follow(f.dt, focus);

    const aiming = s.phase === "aim";
    const flying = s.phase === "flight";
    this.showPrediction(this.guide, aiming ? f.guide : null, 1);
    this.showPrediction(this.course, flying ? f.course : null, 1);
    this.showPrediction(this.brakeGhost, flying ? f.brakeGhost : null, 1);
    const miss = aiming ? f.guide : null;
    if (miss && miss.closest.distance < 3)
      this.guideMiss.set(miss.closest.parcel, miss.closest.dock);
    else this.guideMiss.hide();
    const badEnd = miss?.end && miss.end.kind !== "arrived" ? miss.endAt : null;
    this.guideEnd.visible = !!badEnd;
    if (badEnd) this.guideEnd.position.set(badEnd.x, 0.02, -badEnd.y);

    // In flight a short fading wake; once it lands, the whole route for study.
    if (flying) this.wake.set(s.trail);
    else this.wake.clear();
    if (s.phase === "result") this.trail.set(s.trail);
    else this.trail.clear();

    const last = s.phase === "result" ? null : s.last;
    if (last) {
      this.lastPath.set(last.path);
      if (last.outcome.verdict !== "delivered")
        this.lastMiss.set(last.closest.parcel, last.closest.dock);
      else this.lastMiss.hide();
    } else {
      this.lastPath.clear();
      this.lastMiss.hide();
    }
    const brakeMark = last?.brakeAt ?? (s.phase !== "aim" ? s.brakeAt : null);
    this.lastBrake.visible = !!brakeMark;
    if (brakeMark) this.lastBrake.position.set(brakeMark.x, 0.03, -brakeMark.y);

    this.updateParcel(f);
    const parcel = this.parcels[s.mission.parcel];
    this.lamps.update(this.dock, parcel.visible ? parcel : null, this.stage.camera);
    this.burst.update(f.dt);
  }

  private showPrediction(dots: DotPath, p: Prediction | null, every: number) {
    if (p) dots.set(p.points, DOT_EVERY * every, DOT_MAJOR);
    else dots.clear();
  }

  private updateParcel(f: Frame) {
    const s = f.session;
    const kind = s.mission.parcel;
    const parcel = this.parcels[kind];
    this.parcels[kind === "fragile" ? "robust" : "fragile"].visible = false;
    const flight = s.flight;
    const delivered = s.outcome?.verdict === "delivered";
    const gone =
      s.phase === "result" &&
      (s.outcome?.verdict === "crashed" || s.outcome?.verdict === "rejected");
    parcel.visible = !!flight && s.phase !== "aim" && !gone;
    if (!flight || !parcel.visible) return;
    if (delivered && this.dock) {
      parcel.position.copy(this.dock.group.position).add(this.v.set(0, 0.42, 0));
      parcel.rotation.set(0, this.dock.group.rotation.y, 0);
      return;
    }
    parcel.position.set(flight.p.x, 0.05, -flight.p.y);
    if (!f.reducedMotion && s.phase === "flight") {
      parcel.rotation.x += f.dt * 2.1;
      parcel.rotation.y += f.dt * 1.3;
    }
  }

  /** Flat, unlit overlays (guide dots, rings, trails) are kept out of ambient occlusion. */
  private collectOverlays() {
    const list = this.stage.aoHidden;
    list.length = 0;
    this.stage.scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (
        mat &&
        !Array.isArray(mat) &&
        (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.LineBasicMaterial)
      )
        list.push(o);
    });
  }

  /** Crash or rejection: scatter debris where the parcel ended. */
  shatter(reducedMotion: boolean) {
    const p = this.parcels.fragile.visible ? this.parcels.fragile : this.parcels.robust;
    this.burst.fire(p.position, reducedMotion);
  }
}

function parentMotion(m: Mission | null, motion: Motion): Motion {
  if (motion.kind !== "orbit" || !motion.around || !m) return { kind: "fixed", at: { x: 0, y: 0 } };
  const parent = m.bodies.find((b) => b.id === motion.around);
  return parent ? parent.motion : { kind: "fixed", at: { x: 0, y: 0 } };
}

function reach(m: Mission, motion: Motion): { x: number; y: number; r: number } {
  if (motion.kind === "fixed") return { ...motion.at, r: 0 };
  const parent = reach(m, parentMotion(m, motion));
  return { x: parent.x, y: parent.y, r: parent.r + motion.radius };
}

export function missionExtents(m: Mission): Extents {
  const e: Extents = {
    minX: m.depot.x - 1,
    maxX: m.depot.x + 1,
    minY: m.depot.y - 1,
    maxY: m.depot.y + 1,
  };
  const grow = (x: number, y: number, r: number) => {
    e.minX = Math.min(e.minX, x - r);
    e.maxX = Math.max(e.maxX, x + r);
    e.minY = Math.min(e.minY, y - r);
    e.maxY = Math.max(e.maxY, y + r);
  };
  for (const b of m.bodies) {
    const c = reach(m, b.motion);
    grow(c.x, c.y, c.r + b.radius + 0.4);
  }
  for (const o of m.obstacles) {
    const c = reach(m, o.motion);
    grow(c.x, c.y, c.r + o.radius + 0.3);
  }
  const d = reach(m, m.dock.motion);
  grow(d.x, d.y, d.r + 0.9);
  return e;
}
