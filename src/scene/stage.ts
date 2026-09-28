import * as THREE from "three";
import { loadEnvironment } from "./assets";
import { PALETTE } from "./palette";
import { Pipeline, pickTier, type Tier } from "./pipeline";
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
  render(): void;
  toGround(clientX: number, clientY: number): { x: number; y: number } | null;
  /** A short camera jolt, e.g. when a stamp slams down. */
  nudge(strength: number, delay?: number): void;
  /** Per frame: ease gently toward a point of interest (or back to rest when null). */
  follow(dt: number, focus: { x: number; y: number } | null): void;
  /** Visual-test override: a fixed camera shot, or null to return to the game camera. */
  setShot(shot: CameraShot | null): void;
}

export interface CameraShot {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

const GAME_FOV = 34;

const ELEVATION = THREE.MathUtils.degToRad(58);

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
  const tier = pickTier();
  // Antialiasing lives in the pipeline (MSAA target + SMAA), so the canvas itself has none.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  const pixelRatio = Math.min(window.devicePixelRatio, tier === "high" ? 2 : 1.5);
  renderer.setPixelRatio(pixelRatio);
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
  loadEnvironment(renderer, scene);

  const key = makeKey(tier);
  scene.add(key, key.target);
  const aoHidden: THREE.Object3D[] = [];

  const camera = new THREE.PerspectiveCamera(GAME_FOV, 1, 0.05, 400);
  let extents: Extents = { minX: -8, maxX: 8, minY: -5, maxY: 5 };
  const pipeline = new Pipeline(renderer, scene, camera, tier, () => aoHidden);

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
    const portrait = aspect < 0.9;
    // Portrait screens look along the plane's long axis instead of across it.
    const across = extents.maxX - extents.minX;
    const deep = extents.maxY - extents.minY;
    const screenW = portrait ? deep : across;
    const screenH = (portrait ? across : deep) * Math.sin(ELEVATION);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    // Leave room for the HUD bands at the top and bottom of the screen.
    const hudShare = portrait ? 0.62 : 0.74;
    // Perspective enlarges the near edge, so allow a little extra room.
    const dist =
      1.14 *
      Math.max(screenW / 2 / Math.tan(hfov / 2), screenH / 2 / (Math.tan(vfov / 2) * hudShare));
    const cx = (extents.minX + extents.maxX) / 2;
    const cz = -(extents.minY + extents.maxY) / 2;
    const target = new THREE.Vector3(cx, -0.4, cz);
    const back = new THREE.Vector3(portrait ? -1 : 0, 0, portrait ? 0 : 1).multiplyScalar(
      Math.cos(ELEVATION) * dist,
    );
    baseTarget.copy(target);
    basePosition
      .copy(target)
      .add(back)
      .add(new THREE.Vector3(0, Math.sin(ELEVATION) * dist, 0));
    camera.fov = shot?.fov ?? GAME_FOV;
    aimCamera();
    // Nudge the view so the play area sits slightly above the control panel.
    if (shot) camera.clearViewOffset();
    else camera.setViewOffset(w, h, 0, portrait ? h * 0.07 : h * 0.03, w, h);
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h, pixelRatio);
    place();
  }

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
      extents = next;
      fitShadow();
      place();
    },
    resize,
    render() {
      pipeline.render();
    },
    setShot(next) {
      shot = next;
      place();
    },
    nudge(strength, delay = 0) {
      shakeStrength = strength;
      shakeLeft = 0.28;
      shakeWait = delay;
    },
    follow(dt, focus) {
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
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(ground, hit)) return null;
      return { x: hit.x, y: -hit.z };
    },
  };
}
