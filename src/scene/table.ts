import * as THREE from "three";
import { pbrTexture, pbrTiled } from "./assets";
import { makeChartAlbedo } from "./tableArt";

// The chart table: an oiled kitchen-wood frame (Poly Haven, CC0), a linen sheet stretched
// over it with the star chart printed into the cloth (linen maps: Poly Haven, CC0), and a
// brass edging strip. The sheet's top is the plane everything stands on.

export const TABLE_TOP = -1.6;
const W = 24;
const D = 16;

export function makeTable(): THREE.Group {
  const group = new THREE.Group();
  const wood = pbrTiled("kitchen_wood", 3);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.8, 0.7, D + 0.8),
    new THREE.MeshStandardMaterial({
      color: 0x8a6446,
      map: wood.colour,
      normalMap: wood.normal,
      roughnessMap: wood.arm,
      aoMap: wood.arm,
      roughness: 0.9,
    }),
  );
  frame.position.y = TABLE_TOP - 0.37;
  frame.receiveShadow = true;
  frame.castShadow = true;
  group.add(frame);

  const linen = {
    normal: pbrTexture("rough_linen", "normal", 9),
    arm: pbrTexture("rough_linen", "arm", 9),
  };
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({
      map: makeChartAlbedo(),
      normalMap: linen.normal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: linen.arm,
      aoMap: linen.arm,
      aoMapIntensity: 0.6,
      roughness: 1,
    }),
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = TABLE_TOP;
  sheet.receiveShadow = true;
  group.add(sheet);

  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a05a, metalness: 1, roughness: 0.32 });
  for (const [x, z, sx, sz] of [
    [0, D / 2, W + 0.3, 0.15],
    [0, -D / 2, W + 0.3, 0.15],
    [W / 2, 0, 0.15, D],
    [-W / 2, 0, 0.15, D],
  ] as const) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.05, sz), brass);
    strip.position.set(x, TABLE_TOP + 0.02, z);
    strip.receiveShadow = true;
    group.add(strip);
  }
  return group;
}
