import * as THREE from "three";
import { PALETTE } from "./palette";

// A handful of cardboard scraps flung outwards when a parcel meets something it shouldn't.

const COUNT = 14;

interface Scrap {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
}

export class Burst {
  readonly group = new THREE.Group();
  private readonly scraps: Scrap[] = [];
  private life = 0;

  constructor() {
    const geo = new THREE.BoxGeometry(0.07, 0.02, 0.06);
    const mats = [PALETTE.cardboard, PALETTE.red, PALETTE.tape].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true }),
    );
    for (let i = 0; i < COUNT; i++) {
      const mesh = new THREE.Mesh(geo, mats[i % mats.length]);
      this.group.add(mesh);
      this.scraps.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
    }
    this.group.visible = false;
  }

  fire(at: THREE.Vector3, reducedMotion: boolean) {
    this.group.visible = true;
    this.life = 1;
    this.scraps.forEach((s, i) => {
      const a = (i / COUNT) * Math.PI * 2 + Math.sin(i * 12.9) * 0.4;
      const speed = reducedMotion ? 0 : 1.2 + ((i * 7) % 5) * 0.3;
      s.mesh.position.copy(at);
      if (reducedMotion)
        s.mesh.position.add(new THREE.Vector3(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2));
      s.vel.set(Math.cos(a) * speed, 0.6 + (i % 3) * 0.4, Math.sin(a) * speed);
      s.spin.set(3 + (i % 4), 2 + (i % 3), 1);
    });
  }

  update(dt: number) {
    if (!this.group.visible) return;
    this.life -= dt * 0.8;
    if (this.life <= 0) {
      this.clear();
      return;
    }
    for (const s of this.scraps) {
      s.mesh.position.addScaledVector(s.vel, dt);
      s.vel.y -= 2.5 * dt;
      s.vel.multiplyScalar(1 - dt * 1.5);
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.z += s.spin.y * dt;
      (s.mesh.material as THREE.MeshStandardMaterial).opacity = Math.min(1, this.life * 2);
    }
  }

  clear() {
    this.group.visible = false;
    this.life = 0;
  }
}
