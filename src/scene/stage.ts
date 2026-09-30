import * as THREE from "three";
import { disposeAssets, loadEnvironment } from "./assets";
import { GAME_FOV, homeView } from "./framing";
import { releaseMaterials, sharedMaterials } from "./materials";
import { PALETTE } from "./palette";
import { modestGpu, Pipeline, pickTier, type Tier } from "./pipeline";
import { disposeTree } from "./resources";
import { makeTable, TABLE_TOP } from "./table";

// Renderer, camera, lights and the enamel table the miniature sits on.
// Sim coordinates (x, y) map to world (x, 0, -y) so "up" in the plane is away from camera.

export interface Extents {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  tier: Tier;
  /** Flat overlays (guide dots, rings, signs) that ambient occlusion must not darken around. */
  aoHidden: THREE.Object3D[];
  camera: THREE.PerspectiveCamera;
  fit(extents: Extents): void;
  resize(): void;
  /** Draw a frame; `frameMs` (the real frame interval) feeds adaptive quality. */
  render(frameMs?: number): void;
  toGround(clientX: number, clientY: number): { x: number; y: number } | null;
  /** A short camera jolt, e.g. when a stamp slams down. */
  nudge(strength: number, delay?: number): void;
  /** Per frame: ease gently toward a point of interest (or back to rest when null). */
  follow(dt: number, focus: { x: number; y: number } | null): void;
  /** Visual-test override: a fixed camera shot, or null to return to the game camera. */
  setShot(shot: CameraShot | null): void;
  homeShot(): CameraShot;
  /** The governor's state, and one step down as a slow frame run would take (tests). */
  quality(): Record<string, unknown>;
  degrade(): boolean;
  resetMotion(): void;
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}

export interface CameraShot {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  shiftX?: number;
  shiftY?: number;
}

/** One key light: a warm studio softbox high to the left, shadowing the whole mission. */
function makeKey(tier: Tier): THREE.DirectionalLight {
  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.castShadow = true;
  const size = tier === "high" ? 2048 : 1024;
  key.shadow.mapSize.set(size, size);
  key.shadow.radius = 3;
  key.shadow.bias = -0.0002;
  return key;
}

// Aerial perspective (from ODD TIDE's rig): physical extinction 1 − e^(−σd) over the true view
// distance, instead of three's squared falloff, so depth reads as haze rather than a wall.
let fogPatched = false;
function patchFog() {
  if (fogPatched) return;
  fogPatched = true;
  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = length( mvPosition.xyz );
#endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}

const KEY_DIRECTION = new THREE.Vector3(-0.45, 1, 0.5).normalize();

export function createStage(canvas: HTMLCanvasElement): Stage {
  let disposed = false;
  let reducedMotion = false;
  const tier = pickTier();
  // Antialiasing lives in the pipeline (MSAA target + SMAA), so the canvas itself has none.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  // Within a pixel budget per tier (a high-density screen need not draw every device pixel),
  // times the governor's resolution scale.
  const pixelRatio = (w: number, h: number) =>
    Math.min(
      window.devicePixelRatio || 1,
      tier === "high" ? 2 : 1.5,
      Math.sqrt((tier === "high" ? 3.7e6 : 1.2e6) / Math.max(1, w * h)),
    ) * pipeline.scale;
  // One tone mapper (AgX), applied once by the pipeline's OutputPass; exposure is the one
  // brightness control.
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  patchFog();
  const scene = new THREE.Scene();
  // Haze tinted like the dimmed studio backdrop, in scene-linear units.
  scene.fog = new THREE.FogExp2(new THREE.Color(0.028, 0.03, 0.038), 0.009);
  scene.background = new THREE.Color(PALETTE.space);
  scene.add(makeTable());
  const disposeEnvironment = loadEnvironment(renderer, scene);

  const key = makeKey(tier);
  scene.add(key, key.target);
  const aoHidden: THREE.Object3D[] = [];

  const camera = new THREE.PerspectiveCamera(GAME_FOV, 1, 0.05, 400);
  let extents: Extents = { minX: -8, maxX: 8, minY: -5, maxY: 5 };
  const pipeline = new Pipeline(renderer, scene, camera, tier, () => aoHidden, modestGpu());
  const query = new URLSearchParams(window.location.search);
  pipeline.adaptive = !query.has("e2e") && !query.has("quality");

  // Shadows fitted to the mission and snapped to whole texels, so they never shimmer.
  function fitShadow() {
    const cx = (extents.minX + extents.maxX) / 2;
    const cz = -(extents.minY + extents.maxY) / 2;
    const radius = Math.hypot(extents.maxX - extents.minX, extents.maxY - extents.minY) / 2 + 1.5;
    const cam = key.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.5;
    cam.far = radius * 4 + 10;
    cam.updateProjectionMatrix();
    const texel = (2 * radius) / key.shadow.mapSize.x;
    const snap = (v: number) => Math.round(v / texel) * texel;
    const centre = new THREE.Vector3(snap(cx), TABLE_TOP, snap(cz));
    key.target.position.copy(centre);
    key.position.copy(centre).addScaledVector(KEY_DIRECTION, radius * 2 + 4);
    key.target.updateMatrixWorld();
    key.shadow.normalBias = texel * 0.8;
  }

  const baseTarget = new THREE.Vector3();
  const basePosition = new THREE.Vector3();
  const drift = new THREE.Vector3();
  const wanted = new THREE.Vector3();
  const shake = new THREE.Vector3();
  let shakeLeft = 0;
  let shakeStrength = 0;
  let shakeWait = 0;

  // The resting view plus a smoothed drift toward the action and a decaying shake.
  let shot: CameraShot | null = null;
  let shiftX = 0;
  let shiftY = 0;

  function aimCamera() {
    if (shot) {
      camera.position.copy(shot.position);
      camera.lookAt(shot.target);
      return;
    }
    camera.position.copy(basePosition).add(drift).add(shake);
    camera.lookAt(wanted.copy(baseTarget).add(drift));
  }

  function place() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const aspect = w / h;
    camera.aspect = aspect;
    const landscapeRail = w <= 720 && h <= 550 && w > h;
    const measuredRail = landscapeRail
      ? document.querySelector(".play-hud")?.getBoundingClientRect().width
      : 0;
    const rail = landscapeRail ? Math.min(w - 1, measuredRail || Math.min(320, w * 0.54)) : 0;
    const home = homeView(extents, w, h, rail);
    baseTarget.copy(home.target);
    basePosition.copy(home.position);
    camera.fov = shot?.fov ?? GAME_FOV;
    aimCamera();
    shiftX = home.shiftX ?? 0;
    shiftY = home.shiftY ?? 0;
    // Nudge the view so the play area sits slightly above the control panel.
    if (shot) camera.setViewOffset(w, h, w * (shot.shiftX ?? 0), h * (shot.shiftY ?? 0), w, h);
    else {
      camera.setViewOffset(w, h, w * shiftX, h * shiftY, w, h);
    }
    camera.updateProjectionMatrix();
  }

  let pendingResize = true;
  function resize() {
    if (disposed) return;
    pendingResize = true;
    place();
  }
  function resizeBuffer() {
    if (!pendingResize) return;
    pendingResize = false;
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    const ratio = pixelRatio(w, h);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h, ratio);
  }
  pipeline.onScale = resize;

  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  return {
    renderer,
    scene,
    camera,
    tier,
    aoHidden,
    fit(next) {
      if (disposed) return;
      extents = next;
      fitShadow();
      place();
    },
    resize,
    render(frameMs = 0) {
      if (disposed) return;
      pipeline.adapt(frameMs);
      resizeBuffer();
      pipeline.render();
    },
    setShot(next) {
      if (disposed) return;
      shot = next;
      place();
    },
    homeShot: () => ({
      position: basePosition.clone(),
      target: baseTarget.clone(),
      fov: GAME_FOV,
      shiftX,
      shiftY,
    }),
    quality: () => pipeline.state,
    degrade: () => pipeline.step(),
    nudge(strength, delay = 0) {
      if (disposed || reducedMotion) return;
      shakeStrength = strength;
      shakeLeft = 0.28;
      shakeWait = delay;
    },
    follow(dt, focus) {
      if (disposed) return;
      // Drift at most a fifth of the way toward the parcel: a hint of attention, not a chase.
      const goal = focus
        ? wanted.set((focus.x - baseTarget.x) * 0.2, 0, (-focus.y - baseTarget.z) * 0.2)
        : wanted.set(0, 0, 0);
      drift.lerp(goal, 1 - Math.exp(-dt * 2.5));
      if (shakeWait > 0) shakeWait -= dt;
      else if (shakeLeft > 0) {
        shakeLeft = Math.max(0, shakeLeft - dt);
        const k = shakeStrength * (shakeLeft / 0.28);
        shake.set(Math.sin(shakeLeft * 90) * k, -Math.abs(Math.cos(shakeLeft * 70)) * k, 0);
      } else shake.set(0, 0, 0);
      aimCamera();
    },
    toGround(clientX, clientY) {
      if (disposed) return null;
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      camera.updateMatrixWorld();
      const ndc = new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(ground, hit)) return null;
      return { x: hit.x, y: -hit.z };
    },
    resetMotion() {
      drift.set(0, 0, 0);
      shake.set(0, 0, 0);
      shakeLeft = 0;
      shakeWait = 0;
      shakeStrength = 0;
      aimCamera();
    },
    setReducedMotion(next) {
      reducedMotion = next;
      if (next) this.resetMotion();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pipeline.onScale = () => {};
      disposeEnvironment();
      scene.environment = null;
      scene.background = null;
      disposeTree(scene, new Set(sharedMaterials()));
      releaseMaterials();
      disposeAssets();
      aoHidden.length = 0;
      pipeline.dispose();
      renderer.dispose();
    },
  };
}
