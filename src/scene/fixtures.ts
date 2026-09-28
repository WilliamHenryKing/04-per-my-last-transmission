import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { ParcelKind } from "../game/types";
import { materials } from "./materials";
import { PALETTE } from "./palette";
import { makeOrbitRing, makeStand } from "./props";

// The postal hardware: the depot cannon, the receiving dock (a café kiosk) and the parcel.
// Turned (lathe) and rounded forms so edges catch light; painted parts use chipped scans.

const lathe = (points: [number, number][], segments = 40) =>
  new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    c.castShadow = true;
    c.receiveShadow = true;
  });
  return o;
}

export interface Depot {
  group: THREE.Group;
  barrel: THREE.Group;
}

export function makeDepot(): Depot {
  const m = materials();
  const group = new THREE.Group();
  // A bevelled enamel drum on a powder-coated column down to the table.
  const drum = new THREE.Mesh(
    lathe([
      [0, -0.42],
      [0.62, -0.42],
      [0.66, -0.38],
      [0.66, -0.2],
      [0.6, -0.14],
      [0.36, -0.12],
      [0, -0.12],
    ]),
    m.postalRed,
  );
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.03, 10, 64), m.brass);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = -0.17;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    m.ceramic,
  );
  dome.position.y = -0.13;
  const barrel = new THREE.Group();
  const tube = new THREE.Mesh(
    lathe(
      [
        [0.13, 0],
        [0.12, 0.5],
        [0.14, 0.62],
        [0.15, 0.7],
        [0.09, 0.7],
        [0.08, 0.1],
        [0.13, 0],
      ],
      32,
    ),
    m.powder,
  );
  tube.rotation.z = -Math.PI / 2;
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 10, 32), m.brass);
  muzzle.rotation.y = Math.PI / 2;
  muzzle.position.x = 0.68;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 24), m.brass);
  hub.rotation.x = Math.PI / 2;
  barrel.add(tube, muzzle, hub);
  barrel.position.y = 0.05;
  group.add(shadowed(drum), trim, shadowed(dome), shadowed(barrel), makeStand(-0.42));
  return { group, barrel };
}

function signTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#f3ead7";
    g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = "#d8432e";
    g.lineWidth = 18;
    g.strokeRect(14, 14, 996, 228);
    g.fillStyle = "#1b1f2e";
    g.font = "800 104px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text.toUpperCase(), 512, 134, 930);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface Dock {
  group: THREE.Group;
  /** Turned to face the camera each frame (yaw only). */
  sign: THREE.Object3D;
  /** Where the lamp's bulb sits, for the dock light World owns. */
  lampAt: THREE.Object3D;
}

export function makeDock(name: string, captureRadius: number, bulb: THREE.Material): Dock {
  const m = materials();
  const group = new THREE.Group();
  const pad = new THREE.Mesh(
    lathe([
      [0, -0.06],
      [0.3, -0.06],
      [0.33, -0.03],
      [0.33, 0.02],
      [0.3, 0.04],
      [0, 0.04],
    ]),
    m.teal,
  );
  const hut = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.24, 0.26, 3, 0.025), m.cream);
  hut.position.y = 0.16;
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.09),
    new THREE.MeshPhysicalMaterial({ color: 0x1b2140, roughness: 0.08, clearcoat: 1 }),
  );
  pane.position.set(0, 0.18, 0.131);
  // Striped awning: alternating red and cream scallops under a red enamel canopy.
  const awning = new THREE.Group();
  const canopy = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.035, 0.32, 2, 0.012), m.postalRed);
  canopy.rotation.x = 0.18;
  awning.add(canopy);
  for (let i = 0; i < 6; i++) {
    const scallop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.034, 0.012, 16, 1, false, 0, Math.PI),
      i % 2 ? m.cream : m.postalRed,
    );
    scallop.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    scallop.position.set(-0.17 + i * 0.068, -0.03, 0.17);
    awning.add(scallop);
  }
  awning.position.y = 0.31;
  const sign = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.18),
    new THREE.MeshStandardMaterial({ map: signTexture(name), roughness: 0.55 }),
  );
  board.position.y = 0.56;
  for (const x of [-0.24, 0.24]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), m.brass);
    post.position.set(x, 0.45, -0.01);
    sign.add(post);
  }
  sign.add(board);
  const lampAt = new THREE.Group();
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), bulb);
  const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), m.brass);
  bracket.rotation.x = Math.PI / 2;
  bracket.position.z = -0.035;
  lampAt.add(lampBulb, bracket);
  lampAt.position.set(0.12, 0.26, 0.17);
  const zone = makeOrbitRing(captureRadius, PALETTE.brass, 0.85);
  zone.position.y = 0.05;
  group.add(shadowed(pad), shadowed(hut), pane, shadowed(awning), shadowed(sign), lampAt, zone);
  group.add(makeStand(-0.06));
  return { group, sign, lampAt };
}

export function makeParcel(kind: ParcelKind, beacon: THREE.Material): THREE.Group {
  const m = materials();
  const fragile = kind === "fragile";
  const box = new THREE.Mesh(
    new RoundedBoxGeometry(0.26, 0.2, 0.22, 2, 0.02),
    fragile ? m.cardboard : m.powder,
  );
  const group = new THREE.Group();
  group.add(box);
  for (const z of fragile ? [0] : [-0.06, 0.06]) {
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(0.268, 0.206, fragile ? 0.06 : 0.025),
      fragile ? m.tapeRed : m.brass,
    );
    tape.position.z = z;
    group.add(tape);
  }
  // A tracking beacon on the lid: the one glowing part of the parcel.
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), beacon);
  led.position.set(0.07, 0.11, 0.06);
  group.add(led);
  return shadowed(group);
}
