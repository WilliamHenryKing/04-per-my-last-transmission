import * as THREE from "three";
import type { BodyLook, ParcelKind } from "../game/types";
import { PALETTE } from "./palette";

// Procedural miniatures: enamel planets, the depot cannon, the receiving dock,
// a battered parcel and lumpy debris. No external assets.

function hash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

const LOOKS: Record<BodyLook, [number, number, number]> = {
  moon: [0xe8e0cc, 0xb9b09c, 0x8f8779],
  rust: [0xd8743e, 0xa4462c, 0xf0b27a],
  gas: [0x2f9c95, 0xf3ead7, 0x1f6d77],
  ice: [0xcfe4f0, 0x8fb8d4, 0xffffff],
};

export function makePlanet(look: BodyLook, radius: number, seed: number): THREE.Group {
  const geo = new THREE.SphereGeometry(radius, 48, 32);
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const [a, b, c] = LOOKS[look].map((h) => new THREE.Color(h)) as [
    THREE.Color,
    THREE.Color,
    THREE.Color,
  ];
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / radius;
    const y = pos.getY(i) / radius;
    const z = pos.getZ(i) / radius;
    if (look === "gas" || look === "rust") {
      const band = Math.sin(y * (look === "gas" ? 9 : 6) + Math.sin(x * 3 + seed) * 0.6);
      col.copy(a).lerp(band > 0.2 ? b : c, band > 0.2 ? 0.8 : 0.35 * Math.abs(band));
    } else {
      const n = hash(Math.floor(x * 5 + seed), Math.floor(y * 5), Math.floor(z * 5));
      col.copy(a).lerp(n > 0.72 ? c : b, n > 0.72 ? 0.9 : n * 0.35);
      if (look === "ice" && Math.abs(y) > 0.75) col.copy(c);
    }
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const sphere = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.5,
      clearcoat: 0.7,
      clearcoatRoughness: 0.25,
    }),
  );
  sphere.castShadow = true;
  sphere.rotation.z = 0.35;
  const group = new THREE.Group();
  group.add(sphere);
  if (look === "gas") {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.35, radius * 1.7, 64),
      new THREE.MeshStandardMaterial({
        color: PALETTE.brass,
        metalness: 0.5,
        roughness: 0.4,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2 + 0.25;
    ring.castShadow = true;
    group.add(ring);
  }
  return group;
}

/** Flat rings on the flight plane showing how far a body's pull reaches. */
export function makeInfluence(gm: number, radius: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: PALETTE.teal,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  for (const accel of [2, 0.8, 0.35]) {
    const r = Math.sqrt(gm / accel);
    if (r <= radius + 0.2) continue;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.02, r + 0.02, 96), mat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
  }
  return group;
}

export function makeOrbitRing(radius: number, color: number, opacity: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.015, radius + 0.015, 128),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

function enamel(color: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
  });
}

export interface Depot {
  group: THREE.Group;
  barrel: THREE.Group;
}

export function makeDepot(): Depot {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 32), enamel(PALETTE.red));
  base.position.y = -0.25;
  const trim = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.04, 8, 48),
    new THREE.MeshStandardMaterial({ color: PALETTE.brass, metalness: 0.7, roughness: 0.3 }),
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.y = -0.1;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    enamel(PALETTE.cream),
  );
  dome.position.y = -0.1;
  const barrel = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.7, 20), enamel(PALETTE.ink));
  tube.rotation.z = -Math.PI / 2;
  tube.position.x = 0.35;
  const muzzle = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.035, 8, 24),
    new THREE.MeshStandardMaterial({ color: PALETTE.brass, metalness: 0.7, roughness: 0.3 }),
  );
  muzzle.rotation.y = Math.PI / 2;
  muzzle.position.x = 0.7;
  barrel.add(tube, muzzle);
  barrel.position.y = 0.05;
  for (const m of [base, dome, tube]) m.castShadow = true;
  group.add(base, trim, dome, barrel);
  return { group, barrel };
}

function signTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#f3ead7";
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = "#d8432e";
    g.lineWidth = 10;
    g.strokeRect(8, 8, 496, 112);
    g.fillStyle = "#1b1f2e";
    g.font = "700 50px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text.toUpperCase(), 256, 66, 470);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeDock(name: string, captureRadius: number): THREE.Group {
  const group = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 24), enamel(PALETTE.teal));
  const hut = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.24), enamel(PALETTE.cream));
  hut.position.y = 0.15;
  const awning = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.3), enamel(PALETTE.red));
  awning.position.y = 0.29;
  for (const m of [pad, hut, awning]) m.castShadow = true;
  const sign = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: signTexture(name), depthTest: false, transparent: true }),
  );
  sign.scale.set(1.3, 0.325, 1);
  sign.position.y = 0.75;
  sign.renderOrder = 5;
  const zone = makeOrbitRing(captureRadius, PALETTE.brass, 0.85);
  zone.position.y = 0.01;
  group.add(pad, hut, awning, sign, zone);
  return group;
}

export function makeParcel(kind: ParcelKind): THREE.Group {
  const geo = new THREE.BoxGeometry(0.26, 0.2, 0.22, 3, 3, 3);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const d = (hash(pos.getX(i), pos.getY(i), pos.getZ(i)) - 0.5) * 0.025;
    pos.setXYZ(i, pos.getX(i) + d, pos.getY(i) - Math.abs(d), pos.getZ(i) + d);
  }
  geo.computeVertexNormals();
  const box = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: kind === "fragile" ? PALETTE.cardboard : PALETTE.steel,
      roughness: 0.9,
    }),
  );
  const tape = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.205, 0.06),
    new THREE.MeshStandardMaterial({ color: kind === "fragile" ? PALETTE.red : PALETTE.brass }),
  );
  box.castShadow = true;
  const group = new THREE.Group();
  group.add(box, tape);
  return group;
}

export function makeRock(radius: number, seed: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const k = 0.78 + hash(pos.getX(i) + seed, pos.getY(i), pos.getZ(i)) * 0.3;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.8, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: PALETTE.rock, roughness: 0.95, flatShading: true }),
  );
  rock.castShadow = true;
  return rock;
}
