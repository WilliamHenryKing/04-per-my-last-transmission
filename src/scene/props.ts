import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { BodyLook } from "../game/types";
import { materials } from "./materials";
import { PALETTE } from "./palette";
import { planetMaps } from "./planetArt";
import { TABLE_TOP } from "./table";

// Orrery pieces: glazed planets, debris, and the brass stands that hold everything above the
// chart table (nothing floats). Plus the flat overlay rings drawn on the flight plane.

function hash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A brass orrery rod from `top` (local y) down to the table, with a turned foot and collar. */
export function makeStand(top: number, worldY = 0): THREE.Group {
  const m = materials();
  const group = new THREE.Group();
  const bottom = TABLE_TOP - worldY;
  const length = top - bottom;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, length, 12), m.brass);
  rod.position.y = bottom + length / 2;
  const foot = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.2, 0),
        new THREE.Vector2(0.2, 0.02),
        new THREE.Vector2(0.14, 0.05),
        new THREE.Vector2(0.06, 0.08),
        new THREE.Vector2(0.04, 0.12),
      ],
      24,
    ),
    m.powder,
  );
  foot.position.y = bottom;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.06, 16), m.brass);
  collar.position.y = top - 0.03;
  for (const part of [rod, foot, collar]) {
    part.castShadow = true;
    part.receiveShadow = true;
    group.add(part);
  }
  return group;
}

export function makePlanet(look: BodyLook, radius: number, seed: number): THREE.Group {
  const { map, roughnessMap } = planetMaps(look, seed);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 64),
    new THREE.MeshPhysicalMaterial({
      map,
      roughnessMap,
      roughness: 1,
      // A fired ceramic glaze: a satin coat over a softer body, not a glass mirror.
      clearcoat: 0.65,
      clearcoatRoughness: 0.16,
    }),
  );
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  sphere.rotation.z = 0.35;
  const group = new THREE.Group();
  group.add(sphere, makeStand(-radius + 0.02));
  if (look === "gas") {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.52, radius * 0.16, 4, 96),
      materials().brass,
    );
    ring.scale.set(1, 1, 0.12);
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

/** Debris: a lumpy scanned-rock boulder with its own scale, squash and tint, on a stand. */
export function makeRock(radius: number, seed: number): THREE.Group {
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(radius, 3);
  geo.deleteAttribute("normal");
  geo = mergeVertices(geo);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const lump =
      0.82 +
      hash(Math.round(x * 6) + seed, Math.round(y * 6), Math.round(z * 6)) * 0.16 +
      Math.sin(x * 9 + seed) * Math.cos(z * 7) * 0.05;
    pos.setXYZ(i, x * lump, y * lump * 0.82, z * lump);
  }
  geo.computeVertexNormals();
  const base = materials().rock;
  const mat = base.clone();
  // 15–25 % tonal jitter so no two boulders are clones.
  mat.color.offsetHSL((hash(seed, 1, 2) - 0.5) * 0.04, 0, (hash(seed, 3, 4) - 0.5) * 0.2);
  const rock = new THREE.Mesh(geo, mat);
  rock.rotation.set(seed * 1.3, seed * 2.1, seed * 0.7);
  rock.castShadow = true;
  rock.receiveShadow = true;
  const group = new THREE.Group();
  group.add(rock, makeStand(-radius * 0.7));
  return group;
}
