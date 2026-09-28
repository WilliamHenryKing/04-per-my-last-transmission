import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

// Sourced assets (see assets.manifest.json): CC0 PBR sets as WebP and one studio HDRI.
// Everything loads through one manager so the capture hook can wait for a complete frame.

export interface PbrSet {
  colour: THREE.Texture;
  normal: THREE.Texture;
  /** Packed R = ambient occlusion, G = roughness, B = metalness (linear). */
  arm: THREE.Texture;
}

export type PbrId =
  | "paintedmetal004"
  | "paintedmetal012"
  | "metal027"
  | "cardboard001"
  | "kitchen_wood"
  | "rough_linen"
  | "rock_face_03";

const base = () => import.meta.env?.BASE_URL ?? "/";

let idle = true;
const waiters: (() => void)[] = [];
const manager = new THREE.LoadingManager(() => {
  idle = true;
  for (const done of waiters.splice(0)) done();
});
manager.onStart = () => {
  idle = false;
};

/** Resolves once every texture and environment map requested so far has loaded. */
export function whenLoaded(): Promise<void> {
  return idle ? Promise.resolve() : new Promise((done) => waiters.push(done));
}

// Each tiling gets its own Texture (a clone made before its image arrives never uploads),
// but the cache means every file is fetched and decoded once.
THREE.Cache.enabled = true;
const textures = new THREE.TextureLoader(manager);
const sets = new Map<PbrId, PbrSet>();

function load(url: string, srgb: boolean): THREE.Texture {
  const t = textures.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** One shared copy of each set; callers clone when they need their own repeat. */
export function pbr(id: PbrId): PbrSet {
  const hit = sets.get(id);
  if (hit) return hit;
  const dir = `${base()}textures/${id}/`;
  const set = {
    colour: load(`${dir}colour.webp`, true),
    normal: load(`${dir}normal.webp`, false),
    arm: load(`${dir}arm.webp`, false),
  };
  sets.set(id, set);
  return set;
}

/** A set with its own tiling and offset (the image data is shared through the cache). */
export function pbrTiled(id: PbrId, repeat: number, offset = 0): PbrSet {
  const dir = `${base()}textures/${id}/`;
  const tile = (name: string, srgb: boolean) => {
    const t = load(`${dir}${name}.webp`, srgb);
    t.repeat.set(repeat, repeat);
    t.offset.set(offset, offset * 0.37);
    return t;
  };
  return { colour: tile("colour", true), normal: tile("normal", false), arm: tile("arm", false) };
}

/**
 * The studio HDRI, prefiltered for image-based lighting. The same map is shown, blurred and
 * dimmed, as the backdrop, so reflections always match what the viewer can see.
 */
export function loadEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  new HDRLoader(manager).load(`${base()}hdri/studio_small_09_1k.hdr`, (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const env = pmrem.fromEquirectangular(hdr).texture;
    scene.environment = env;
    scene.background = hdr;
    scene.backgroundBlurriness = 0.55;
    scene.backgroundIntensity = 0.07;
    scene.environmentIntensity = 0.85;
    // The backdrop turns so the studio's softboxes sit behind and above the camera.
    scene.backgroundRotation.set(0, 1.9, 0);
    scene.environmentRotation.set(0, 1.9, 0);
    pmrem.dispose();
  });
}
