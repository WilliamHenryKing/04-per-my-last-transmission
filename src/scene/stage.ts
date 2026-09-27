import * as THREE from "three";
import { PALETTE } from "./palette";

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
  camera: THREE.PerspectiveCamera;
  fit(extents: Extents): void;
  resize(): void;
  render(): void;
  toGround(clientX: number, clientY: number): { x: number; y: number } | null;
}

const ELEVATION = THREE.MathUtils.degToRad(58);

function makeStars(): THREE.Points {
  const n = 900;
  const pos = new Float32Array(n * 3);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * 90, u * 60 - 20, Math.sin(a) * s * 90], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: PALETTE.cream, size: 0.35, sizeAttenuation: true });
  return new THREE.Points(g, mat);
}

function makeTable(): THREE.Group {
  const group = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.6, 16),
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.table,
      roughness: 0.55,
      clearcoat: 0.5,
      clearcoatRoughness: 0.4,
    }),
  );
  slab.position.y = -1.9;
  slab.receiveShadow = true;
  group.add(slab);
  const grid = new THREE.GridHelper(24, 24, PALETTE.grid, PALETTE.grid);
  grid.position.y = -1.595;
  grid.scale.z = 16 / 24;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.55;
  group.add(grid);
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(24.4, 0.2, 16.4),
    new THREE.MeshStandardMaterial({ color: PALETTE.brass, metalness: 0.6, roughness: 0.35 }),
  );
  trim.position.y = -2.25;
  group.add(trim);
  return group;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.space);
  scene.add(makeStars(), makeTable());

  scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x3a2a36, 1.3));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.8);
  key.position.set(-6, 14, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -13;
  key.shadow.camera.right = 13;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.radius = 4;
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  let extents: Extents = { minX: -8, maxX: 8, minY: -5, maxY: 5 };

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
    camera.position
      .copy(target)
      .add(back)
      .add(new THREE.Vector3(0, Math.sin(ELEVATION) * dist, 0));
    camera.lookAt(target);
    // Nudge the view so the play area sits slightly above the control panel.
    camera.setViewOffset(w, h, 0, portrait ? h * 0.07 : h * 0.03, w, h);
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    place();
  }

  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  return {
    renderer,
    scene,
    camera,
    fit(next) {
      extents = next;
      place();
    },
    resize,
    render() {
      renderer.render(scene, camera);
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
