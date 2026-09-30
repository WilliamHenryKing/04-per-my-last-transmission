import * as THREE from "three";
import type { Mission } from "../game/types";
import type { Controller } from "../ui/controller";
import { shotFor } from "./bookmarks";
import type { CameraShot, Stage } from "./stage";

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** A travelling shot over the actual postal miniature; the rules clock stays stopped. */
export class Opening {
  private last: CameraShot | null = null;
  private departure: CameraShot | null = null;
  private active = false;
  constructor(private stage: Stage) {}

  update(game: Controller, mission: Mission, reduced: boolean) {
    if (game.opening === "done") {
      if (this.active) this.stage.setShot(null);
      this.active = false;
      return;
    }
    this.active = true;
    const portrait = this.stage.camera.aspect < 0.9;
    const home = this.stage.homeShot();
    let shot: CameraShot;
    if (game.opening === "title") {
      const start = shotFor(portrait ? "phone-hero" : "hero", mission, 0);
      const end = shotFor("wide", mission, 0);
      const t = reduced ? 1 : ease(game.openingClock / 10);
      end.position.set(6.5, 7.5, 10);
      end.target.set(-0.5, -0.3, 0);
      shot = {
        position: start.position.clone().lerp(end.position, t),
        target: start.target.clone().lerp(end.target, t),
        fov: portrait ? 58 : 43,
        shiftX: portrait ? 0 : -0.17,
        shiftY: portrait ? 0.19 : 0,
      };
      if (!reduced) shot.position.x += Math.sin(game.openingClock * 0.16) * 0.18;
      this.last = shot;
    } else {
      this.departure ??= this.last ?? home;
      const from = this.departure;
      const t = ease(game.openingClock / 2.8);
      shot = {
        position: from.position.clone().lerp(home.position, t),
        target: from.target.clone().lerp(home.target, t),
        fov: THREE.MathUtils.lerp(from.fov, home.fov, t),
        shiftX: THREE.MathUtils.lerp(from.shiftX ?? 0, 0, t),
        shiftY: THREE.MathUtils.lerp(from.shiftY ?? 0, home.shiftY ?? 0, t),
      };
      shot.position.y += Math.sin(Math.PI * t) * 0.65;
    }
    this.stage.setShot(shot);
  }
}
