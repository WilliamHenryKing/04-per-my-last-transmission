// PER MY LAST TRANSMISSION — studio recipes (docs/STUDIO-PIPELINE.md). Crisp miniature
// planets, enamel machinery, battered parcel surfaces. Units: metres at model scale.
import type { Recipes } from "./kit/build";
import {
  blend,
  box,
  lathe,
  capsule,
  carve,
  cylinder,
  displace,
  ellipsoid,
  fbm,
  type Mat,
  mat,
  mirrorX,
  move,
  paint,
  rng,
  rotate,
  sphere,
  subtract,
  torus,
  union,
  type Vec3,
} from "./kit/sdf";

const ENAMEL = [0xd9573f, 0x2f7f86, 0xf2c14e, 0x1f4e6b, 0xe8e0cc, 0x7aa66b, 0xc2415d, 0x5b4a8a];
const pick = <T>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)] as T;
const onSphere = (r: () => number): Vec3 => {
  const u = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(a), u, s * Math.sin(a)];
};

function planet(seed: number) {
  const r = rng(seed);
  const land = mat(pick(r, ENAMEL), 0.28);
  const sea = mat(pick(r, ENAMEL), 0.16);
  const ice = mat(0xf4f1e8, 0.2);
  const freq = 1.4 + r() * 1.8;
  const amp = 0.025 + r() * 0.05;
  let body = displace(sphere(1), amp, freq, 5, seed);
  const craters = Math.floor(r() * 9);
  for (let i = 0; i < craters; i++) {
    const p = onSphere(r);
    const s = 0.04 + r() * 0.09;
    const lift = 1 + s * 0.7;
    body = carve(0.025, body, move(sphere(s), [p[0] * lift, p[1] * lift, p[2] * lift]));
  }
  const cap = 0.72 + r() * 0.2;
  body = paint(body, (x, y, z): Mat => {
    const h = fbm(x * freq, y * freq, z * freq, 5, seed);
    const len = Math.hypot(x, y, z) || 1;
    if (Math.abs(y / len) > cap) return ice;
    return h > 0.02 ? land : sea;
  });
  if (r() < 0.35) {
    const ringColour = mat(pick(r, ENAMEL), 0.3);
    const ring = subtract(cylinder(1.75 + r() * 0.4, 0.018, 0.004, ringColour), cylinder(1.3, 0.1));
    return union(body, rotate(ring, [0.35 + r() * 0.4, r() * 3, r() * 0.3]));
  }
  if (r() < 0.3) {
    const moon = displace(sphere(0.16 + r() * 0.1, mat(0xcfc8b8, 0.5)), 0.02, 6, 3, seed + 3);
    return union(body, move(moon, [1.5 + r() * 0.3, 0.4 - r() * 0.8, 0.2]));
  }
  return body;
}

function parcel(seed: number) {
  const r = rng(seed);
  const sx = 0.18 + r() * 0.34;
  const sy = 0.1 + r() * 0.26;
  const sz = 0.16 + r() * 0.3;
  const paper = mat(pick(r, [0xb98b57, 0xc79a63, 0xa6794a, 0xd8c39a, 0x8e6a45]), 0.85);
  let body = displace(box(sx, sy, sz, 0.012 + r() * 0.01, paper), 0.0035, 14, 3, seed);
  const dents = Math.floor(r() * 5);
  for (let i = 0; i < dents; i++) {
    const s = 0.03 + r() * 0.05;
    const face = Math.floor(r() * 3);
    const c: Vec3 = [(r() - 0.5) * sx, (r() - 0.5) * sy, (r() - 0.5) * sz];
    c[face] = (r() < 0.5 ? -1 : 1) * (([sx, sy, sz][face] as number) * 0.5 + s * 0.75);
    body = carve(0.02, body, move(sphere(s), c));
  }
  const tape = mat(pick(r, [0xd8b778, 0x3d6f9e, 0xc84b3c, 0xe8e0cc]), 0.35);
  const parts = [body, move(box(sx + 0.004, 0.004, 0.05, 0.001, tape), [0, sy / 2, 0])];
  if (r() < 0.6) parts.push(move(box(0.05, sy + 0.004, sz + 0.004, 0.001, tape), [0, 0, 0]));
  if (r() < 0.4) parts.push(torus(Math.max(sx, sz) * 0.5, 0.004, mat(0xe9dcc0, 0.8)));
  parts.push(move(box(sx * 0.45, 0.003, sz * 0.3, 0.001, mat(0xf3eee2, 0.7)), [sx * 0.12, sy / 2 + 0.002, sz * 0.18]));
  return union(...parts);
}

function dock(seed: number) {
  const r = rng(seed);
  const body = mat(pick(r, ENAMEL), 0.3);
  const trim = mat(0xe8e0cc, 0.35);
  const brass = mat(0xc49a4a, 0.35, 1);
  const base = cylinder(0.45 + r() * 0.2, 0.18, 0.03, body);
  const mast = move(cylinder(0.07, 0.8 + r() * 0.5, 0.01, trim), [0, 0.5, 0]);
  const dishR = 0.35 + r() * 0.2;
  const dish = move(rotate(lathe([[0, 0], [dishR * 0.3, dishR * 0.03], [dishR * 0.6, dishR * 0.12], [dishR, dishR * 0.3]], 0.008, body), [0.6 + r() * 0.4, r() * 6, 0]), [0, 1.1, 0]);
  const lamp = move(sphere(0.06, mat(0xffd27a, 0.2)), [0, 1.06, 0]);
  const arms = mirrorX(capsule([0.1, 0.35, 0], [0.45, 0.2, 0], 0.03, 0.02, brass));
  return blend(0.03, base, mast, dish, lamp, arms);
}

function satellite(seed: number) {
  const r = rng(seed);
  const shell = mat(pick(r, ENAMEL), 0.3);
  const panel = mat(0x1d2f5a, 0.25, 0.4);
  const foil = mat(0xd8b35a, 0.3, 1);
  const core = r() < 0.5 ? box(0.3, 0.34, 0.3, 0.03, shell) : cylinder(0.18, 0.38, 0.03, shell);
  const w = 0.5 + r() * 0.5;
  const wing = mirrorX(union(move(box(w, 0.012, 0.26, 0.004, panel), [0.2 + w / 2, 0, 0]), capsule([0.15, 0, 0], [0.22, 0, 0], 0.015, 0.015, foil)));
  const antenna = union(capsule([0, 0.17, 0], [0, 0.45, 0], 0.01, 0.006, foil), move(sphere(0.025, foil), [0, 0.46, 0]));
  return union(core, wing, antenna, move(rotate(subtract(sphere(0.12, shell), move(sphere(0.118), [0, 0.04, 0])), [Math.PI / 2, 0, 0]), [0, 0, -0.17]));
}

function mailSack(seed: number) {
  const r = rng(seed);
  const cloth = mat(pick(r, [0x8b7a5a, 0x6f7f5b, 0x9a8866]), 0.95);
  const sack = displace(ellipsoid(0.26, 0.34 + r() * 0.1, 0.22, cloth), 0.02, 7, 4, seed);
  const neck = move(cylinder(0.07, 0.12, 0.02, cloth), [0, 0.38, 0]);
  const tie = move(torus(0.075, 0.012, mat(0xc84b3c, 0.6)), [0, 0.36, 0]);
  return blend(0.05, sack, neck, tie);
}

export const project = { id: "04-per-my-last-transmission", name: "PER MY LAST TRANSMISSION", background: 0x22303d };
export const families: Recipes["families"] = [
  { id: "planet", count: 96, voxel: 0.012, keep: 0.25, hero: true, wear: 0.2, dirt: 0.25, build: planet },
  { id: "parcel", count: 96, voxel: 0.004, keep: 0.25, wear: 0.5, dirt: 0.3, build: parcel },
  { id: "receiver-dock", count: 20, voxel: 0.008, keep: 0.3, hero: true, build: dock },
  { id: "satellite", count: 48, voxel: 0.005, keep: 0.3, build: satellite },
  { id: "mail-sack", count: 16, voxel: 0.006, keep: 0.3, build: mailSack },
];
export const textures: Recipes["textures"] = [
  { id: "enamel-red", ramp: [0xb8452f, 0xd9573f, 0xe56a4f], layers: [{ kind: "fbm", scale: 24, octaves: 5 }], roughness: [0.18, 0.3], normal: 0.6 },
  { id: "enamel-chipped", ramp: [0x2b2b2b, 0x2f7f86, 0x2f7f86, 0x3a8f96], layers: [{ kind: "cells", count: 18, weight: 1 }, { kind: "fbm", scale: 32, weight: 0.4 }], roughness: [0.2, 0.7], normal: 2 },
  { id: "kraft-paper", ramp: [0x9a7447, 0xb98b57, 0xc79a63], layers: [{ kind: "fibres", scale: 32, stretch: 6 }, { kind: "fbm", scale: 8, weight: 0.5 }], roughness: [0.8, 0.95], normal: 1.2 },
  { id: "parcel-tape", ramp: [0xc9a767, 0xd8b778, 0xe3c68a], layers: [{ kind: "fibres", scale: 64, stretch: 12, weight: 0.4 }, { kind: "fbm", scale: 12, weight: 0.3 }], roughness: [0.3, 0.45], normal: 0.5 },
  { id: "brushed-brass", ramp: [0x9c7a36, 0xc49a4a, 0xd9b565], layers: [{ kind: "fibres", scale: 96, stretch: 20 }], roughness: [0.25, 0.4], normal: 0.4 },
  { id: "planet-crust", ramp: [0x3b2f2a, 0x7a5a45, 0xb58a60, 0xe0c9a0], layers: [{ kind: "fbm", scale: 6, octaves: 7 }, { kind: "cells", count: 10, weight: 0.4 }], roughness: [0.6, 0.9], normal: 3 },
];
