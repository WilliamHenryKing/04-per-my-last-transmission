import * as THREE from "three";
import type { Dock } from "./fixtures";
import { lamp } from "./materials";

// The only things in the miniature that glow, each with the real light it casts: the dock's
// café lamp and the parcel's tracking beacon. The lights live at scene level and dim to zero
// rather than hide, so the light count (and every compiled shader) never changes.

const DOCK = { colour: 0xffc98a, luminance: 7, candela: 0.3, range: 2.2 };
const BEACON = { colour: 0xff6a3d, luminance: 10, candela: 0.14, range: 1.6 };

export class Lamps {
  readonly dock = lamp(DOCK.colour, DOCK.luminance, DOCK.candela, DOCK.range);
  readonly beacon = lamp(BEACON.colour, BEACON.luminance, BEACON.candela, BEACON.range);
  private readonly at = new THREE.Vector3();
  private readonly cam = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    scene.add(this.dock.light, this.beacon.light);
  }

  update(dock: Dock | null, parcel: THREE.Object3D | null, camera: THREE.Camera) {
    if (dock) {
      dock.lampAt.getWorldPosition(this.at);
      this.dock.light.position.copy(this.at);
      this.dock.light.intensity = DOCK.candela;
      // The café sign turns (yaw only) to face whoever is looking.
      dock.group.getWorldPosition(this.at);
      camera.getWorldPosition(this.cam);
      dock.sign.rotation.y = Math.atan2(this.cam.x - this.at.x, this.cam.z - this.at.z);
    } else this.dock.light.intensity = 0;
    if (parcel?.visible) {
      parcel.getWorldPosition(this.at);
      this.beacon.light.position.copy(this.at).add(this.cam.set(0, 0.14, 0));
      this.beacon.light.intensity = BEACON.candela;
    } else this.beacon.light.intensity = 0;
  }
}
