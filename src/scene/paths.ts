import * as THREE from "three";
import type { Vec } from "../game/types";

// Everything drawn on the flight plane: guide dots, trails, the last attempt and markers.

const PLANE_Y = 0.02;
const tmp = new THREE.Object3D();

/** Dotted guide: one dot per sample stride, larger every half second. */
export class DotPath {
  readonly mesh: THREE.InstancedMesh;
  private readonly max: number;

  constructor(color: number, max = 260, size = 0.05) {
    this.max = max;
    const geo = new THREE.CircleGeometry(size, 12);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
      max,
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 3;
  }

  /** `every` samples per dot; `major` dots per enlarged dot. */
  set(points: Vec[], every: number, major: number) {
    let n = 0;
    for (let i = every, k = 1; i < points.length && n < this.max; i += every, k++) {
      const p = points[i] as Vec;
      const s = k % major === 0 ? 1.8 : 1;
      tmp.position.set(p.x, PLANE_Y, -p.y);
      tmp.scale.setScalar(s);
      tmp.updateMatrix();
      this.mesh.setMatrixAt(n++, tmp.matrix);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.mesh.count = 0;
  }
}

/** Continuous line, optionally dashed. */
export class LinePath {
  readonly line: THREE.Line;
  private readonly geo = new THREE.BufferGeometry();
  private readonly buffer: Float32Array;
  private readonly dashed: boolean;

  constructor(color: number, opacity: number, dashed = false, max = 4000) {
    this.buffer = new Float32Array(max * 3);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.buffer, 3));
    this.dashed = dashed;
    const material = dashed
      ? new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity,
          dashSize: 0.18,
          gapSize: 0.12,
        })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    this.line = new THREE.Line(this.geo, material);
    this.line.frustumCulled = false;
    this.line.renderOrder = 2;
  }

  set(points: Vec[]) {
    const n = Math.min(points.length, this.buffer.length / 3);
    for (let i = 0; i < n; i++) {
      const p = points[i] as Vec;
      this.buffer[i * 3] = p.x;
      this.buffer[i * 3 + 1] = PLANE_Y;
      this.buffer[i * 3 + 2] = -p.y;
    }
    this.geo.setDrawRange(0, n);
    (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    if (this.dashed && n > 1) this.line.computeLineDistances();
    this.line.visible = n > 1;
  }

  clear() {
    this.line.visible = false;
  }
}

/** A cross for "the flight ends here, badly". */
export function makeCross(color: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true });
  for (const r of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.08), mat);
    bar.rotation.y = r;
    bar.renderOrder = 6;
    group.add(bar);
  }
  group.position.y = PLANE_Y;
  return group;
}

/** A ghost of the dock at the moment the parcel passes closest, joined by a tether. */
export class NearMiss {
  readonly group = new THREE.Group();
  private readonly ghost: THREE.Mesh;
  private readonly tether: LinePath;

  constructor(color: number, radius: number) {
    this.ghost = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.55, radius * 0.7, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.ghost.rotation.x = -Math.PI / 2;
    this.ghost.renderOrder = 4;
    this.tether = new LinePath(color, 0.8, true, 2);
    this.group.add(this.ghost, this.tether.line);
  }

  set(parcel: Vec, dock: Vec) {
    this.group.visible = true;
    this.ghost.position.set(dock.x, PLANE_Y, -dock.y);
    this.tether.set([parcel, dock]);
  }

  hide() {
    this.group.visible = false;
  }
}

export function toWorld(p: Vec, target: THREE.Vector3, y = 0): THREE.Vector3 {
  return target.set(p.x, y, -p.y);
}
