import * as THREE from "three";
import type { Cue, Session } from "../game/session";
import type { Depot } from "./fixtures";
import { PALETTE } from "./palette";
import { Puff } from "./puff";
import type { Stage } from "./stage";

// Feedback flourishes: cannon recoil and muzzle puff, the brake burst and a camera nudge
// when something lands. Reduced motion keeps each cue but shrinks or skips the movement.

const MUZZLE = 0.7;

export class Juice {
  private readonly launchPuff = new Puff(PALETTE.cream);
  private readonly brakePuff = new Puff(PALETTE.brass);
  private recoil = 0;
  private readonly at = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    scene.add(this.launchPuff.group, this.brakePuff.group);
  }

  react(cue: Cue, s: Session, depot: Depot, stage: Stage, reducedMotion: boolean) {
    const heading = (s.aim.angle * Math.PI) / 180;
    if (cue === "launch") {
      this.recoil = reducedMotion ? 0 : 1;
      const d = s.mission.depot;
      this.at.set(d.x + Math.cos(heading) * MUZZLE, 0.05, -(d.y + Math.sin(heading) * MUZZLE));
      this.launchPuff.fire(this.at, heading, reducedMotion);
    } else if (cue === "brake" && s.flight) {
      this.at.set(s.flight.p.x, 0.05, -s.flight.p.y);
      this.brakePuff.fire(this.at, null, reducedMotion);
    } else if (!reducedMotion && cue === "bounce") {
      stage.nudge(0.05);
    } else if (!reducedMotion && cue === "end") {
      // Lands with the result stamp's slam.
      stage.nudge(s.outcome?.verdict === "delivered" ? 0.1 : 0.16, 0.12);
    }
    this.aimBarrel(depot, heading);
  }

  update(dt: number, depot: Depot, angleDeg: number) {
    this.launchPuff.update(dt);
    this.brakePuff.update(dt);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 3.5);
    this.aimBarrel(depot, (angleDeg * Math.PI) / 180);
  }

  /** The barrel kicks back along its own axis, then eases home. */
  private aimBarrel(depot: Depot, heading: number) {
    const kick = this.recoil * this.recoil * 0.18;
    depot.barrel.rotation.y = heading;
    depot.barrel.position.set(-Math.cos(heading) * kick, 0.05, Math.sin(heading) * kick);
  }
}
