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
let manager: THREE.LoadingManager;
function makeManager() {
  const next = new THREE.LoadingManager(() => {
    if (manager !== next) return;
    idle = true;
    for (const done of waiters.splice(0)) done();
  });
  next.onStart = () => {
    if (manager === next) idle = false;
  };
  return next;
}
manager = makeManager();

/** Resolves once every texture and environment map requested so far has loaded. */
export function whenLoaded(): Promise<void> {
  return idle ? Promise.resolve() : new Promise((done) => waiters.push(done));
}

// Each tiling gets its own Texture (a clone made before its image arrives never uploads),
// but the cache means every file is fetched and decoded once.
THREE.Cache.enabled = true;
let textures = new THREE.TextureLoader(manager);
const sets = new Map<PbrId, PbrSet>();
const ownedTextures = new Map<THREE.Texture, string>();
const ownedUrls = new Set<string>();

function load(url: string, srgb: boolean): THREE.Texture {
  const t = textures.load(url, (loaded) => {
    if (!ownedTextures.has(loaded) && ![...ownedTextures.values()].includes(url)) {
      THREE.Cache.remove(`image:${url}`);
    }
  });
  ownedTextures.set(t, url);
  ownedUrls.add(url);
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
  return {
    colour: pbrTexture(id, "colour", repeat, offset),
    normal: pbrTexture(id, "normal", repeat, offset),
    arm: pbrTexture(id, "arm", repeat, offset),
  };
}

export function pbrTexture(id: PbrId, name: keyof PbrSet, repeat: number, offset = 0) {
  const texture = load(`${base()}textures/${id}/${name}.webp`, name === "colour");
  texture.repeat.set(repeat, repeat);
  texture.offset.set(offset, offset * 0.37);
  return texture;
}

export function disposeTexture(texture: THREE.Texture) {
  ownedTextures.delete(texture);
  texture.dispose();
}

export function disposeAssets() {
  for (const texture of ownedTextures.keys()) texture.dispose();
  ownedTextures.clear();
  sets.clear();
  for (const url of ownedUrls) THREE.Cache.remove(`image:${url}`);
  ownedUrls.clear();
  idle = true;
  for (const done of waiters.splice(0)) done();
  manager = makeManager();
  textures = new THREE.TextureLoader(manager);
}

/**
 * The studio HDRI, prefiltered for image-based lighting. The same map is shown, blurred and
 * dimmed, as the backdrop, so reflections always match what the viewer can see.
 */
export function loadEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  let disposed = false;
  let generatorDisposed = false;
  let source: THREE.Texture | null = null;
  let target: THREE.WebGLRenderTarget | null = null;
  const releaseGenerator = () => {
    if (generatorDisposed) return;
    generatorDisposed = true;
    pmrem.dispose();
  };
  const url = `${base()}hdri/studio_small_09_1k.hdr`;
  new HDRLoader(manager).load(
    url,
    (hdr) => {
      if (disposed) {
        hdr.dispose();
        THREE.Cache.remove(`file:${url}`);
        return;
      }
      source = hdr;
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      target = pmrem.fromEquirectangular(hdr);
      scene.environment = target.texture;
      scene.background = hdr;
      scene.backgroundBlurriness = 0.55;
      scene.backgroundIntensity = 0.07;
      scene.environmentIntensity = 0.85;
      // The backdrop turns so the studio's softboxes sit behind and above the camera.
      scene.backgroundRotation.set(0, 1.9, 0);
      scene.environmentRotation.set(0, 1.9, 0);
      releaseGenerator();
    },
    undefined,
    releaseGenerator,
  );
  return () => {
    if (disposed) return;
    disposed = true;
    if (scene.environment === target?.texture) scene.environment = null;
    if (scene.background === source) scene.background = null;
    target?.dispose();
    source?.dispose();
    releaseGenerator();
    THREE.Cache.remove(`file:${url}`);
  };
}
