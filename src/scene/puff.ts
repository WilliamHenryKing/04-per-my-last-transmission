import * as THREE from "three";

// A soft ring of little enamel beads that swells and fades: the launch puff and the brake burst.

const COUNT = 10;

export class Puff {
  readonly group = new THREE.Group();
  private readonly beads: THREE.Mesh[] = [];
  private readonly material: THREE.MeshBasicMaterial;
  private readonly dirs: THREE.Vector3[] = [];
  private life = 0;
  private spread = 1;

  constructor(color: number) {
    this.material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const geo = new THREE.SphereGeometry(0.06, 8, 6);
    for (let i = 0; i < COUNT; i++) {
      const bead = new THREE.Mesh(geo, this.material);
      this.beads.push(bead);
      this.group.add(bead);
      this.dirs.push(new THREE.Vector3());
    }
    this.group.visible = false;
  }

  /** Fire at a world point; `heading` (radians on the plane) biases the beads forwards. */
  fire(at: THREE.Vector3, heading: number | null, reducedMotion: boolean) {
    this.group.position.copy(at);
    this.group.visible = true;
    this.life = 1;
    this.spread = reducedMotion ? 0.25 : 1;
    this.dirs.forEach((d, i) => {
      const a = (i / COUNT) * Math.PI * 2;
      d.set(Math.cos(a), 0.15 + (i % 3) * 0.1, -Math.sin(a));
      if (heading !== null)
        d.add(new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading)).multiplyScalar(0.8));
    });
  }

  update(dt: number) {
    if (!this.group.visible) return;
    this.life -= dt * 2.2;
    if (this.life <= 0) {
      this.group.visible = false;
      return;
    }
    const grow = (1 - this.life) * 0.7 * this.spread;
    this.beads.forEach((b, i) => {
      b.position.copy(this.dirs[i] as THREE.Vector3).multiplyScalar(grow);
      b.scale.setScalar(0.6 + (1 - this.life) * 1.4);
    });
    this.material.opacity = this.life * 0.85;
  }
}
