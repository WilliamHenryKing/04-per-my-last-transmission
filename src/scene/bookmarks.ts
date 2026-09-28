import * as THREE from "three";
import { positionOf } from "../game/physics";
import type { Mission } from "../game/types";
import type { CameraShot } from "./stage";

// Camera bookmarks for visual evidence: the same five shots are captured before and after
// every fidelity change (scripts/capture-visual.ts). Coordinates follow the stage mapping
// sim (x, y) → world (x, 0, -y).

export const BOOKMARKS = ["wide", "hero", "closeup", "grazing", "phone-hero"] as const;
export type Bookmark = (typeof BOOKMARKS)[number];

const w = (p: { x: number; y: number }, y = 0) => new THREE.Vector3(p.x, y, -p.y);

export function shotFor(name: Bookmark, m: Mission, t: number): CameraShot {
  const depot = w(m.depot);
  const body = m.bodies[0];
  const well = body ? w(positionOf(m, body.motion, t)) : new THREE.Vector3();
  const radius = body?.radius ?? 1;
  const dock = w(positionOf(m, m.dock.motion, t));
  const toWell = well.clone().sub(depot).setY(0).normalize();
  const side = new THREE.Vector3(-toWell.z, 0, toWell.x);
  switch (name) {
    case "wide":
      // Establishing: the whole chart table from high and slightly behind.
      return {
        position: new THREE.Vector3(well.x * 0.3, 13, 11.5),
        target: new THREE.Vector3(well.x * 0.3, -1, -0.5),
        fov: 45,
      };
    case "hero":
    case "phone-hero": {
      // Over the cannon's shoulder toward the moon and its café.
      const back = name === "hero" ? 4.6 : 5.4;
      return {
        position: depot
          .clone()
          .addScaledVector(toWell, -back)
          .addScaledVector(side, -1.6)
          .setY(3.6),
        target: depot.clone().lerp(well, 0.58).setY(-0.6),
        fov: name === "hero" ? 40 : 54,
      };
    }
    case "closeup":
      // Arm's length at the dock: the hut, its sign and the capture ring.
      return {
        position: dock.clone().add(new THREE.Vector3(0.8, 0.55, 1.05)),
        target: dock.clone().add(new THREE.Vector3(0, 0.12, 0)),
        fov: 34,
      };
    case "grazing":
      // Low across the table so the moon's glaze and the table surface catch the light.
      return {
        position: well.clone().add(new THREE.Vector3(radius * 4.6, -1.05, radius * 3.9)),
        target: well.clone().add(new THREE.Vector3(0, -0.55, 0)),
        fov: 32,
      };
  }
}
