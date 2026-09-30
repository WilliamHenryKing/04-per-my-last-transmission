import { afterEach, beforeEach, expect, test } from "bun:test";
import * as THREE from "three";
import { MISSIONS } from "../src/game/missions";
import { Session } from "../src/game/session";
import { disposeAssets, pbrTexture, whenLoaded } from "../src/scene/assets";
import { Burst } from "../src/scene/burst";
import { makeDepot } from "../src/scene/fixtures";
import { homeView } from "../src/scene/framing";
import { releaseMaterials, sharedMaterials } from "../src/scene/materials";
import { DotPath, LinePath } from "../src/scene/paths";
import { Puff } from "../src/scene/puff";
import { disposeTree } from "../src/scene/resources";
import type { Stage } from "../src/scene/stage";
import { type Frame, missionExtents, World } from "../src/scene/world";

class ImageFixture extends EventTarget {
  static deferred = false;
  static pending: (() => void)[] = [];
  complete = false;
  set src(_url: string) {
    const complete = () => {
      this.complete = true;
      this.dispatchEvent(new Event("load"));
    };
    if (ImageFixture.deferred) ImageFixture.pending.push(complete);
    else queueMicrotask(complete);
  }
}

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const roots: THREE.Object3D[] = [];
const worlds: World[] = [];
beforeEach(() => {
  ImageFixture.deferred = false;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
      createElementNS: () => new ImageFixture(),
    },
  });
});
afterEach(async () => {
  for (const world of worlds.splice(0)) world.dispose();
  for (const root of roots.splice(0)) disposeTree(root, new Set(sharedMaterials()));
  releaseMaterials();
  disposeAssets();
  for (const complete of ImageFixture.pending.splice(0)) complete();
  await new Promise((done) => setTimeout(done, 0));
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

function fixture() {
  let resets = 0;
  const stage = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    aoHidden: [],
    fit() {},
    follow() {},
    nudge() {},
    setReducedMotion() {},
    resetMotion() {
      resets++;
    },
  };
  const world = new World(stage as unknown as Stage);
  worlds.push(world);
  return { stage, world, resets: () => resets };
}

function frame(session: Session, reducedMotion = false, dt = 0): Frame {
  return { session, reducedMotion, dt, guide: null, course: null, brakeGhost: null };
}

test("every mission releases its own planet/sign maps while retaining shared hardware", async () => {
  const { stage, world } = fixture();
  let sharedDisposed = 0;
  for (const material of sharedMaterials())
    material.addEventListener("dispose", () => sharedDisposed++);
  for (const mission of MISSIONS) {
    const previous: THREE.Mesh[] = [];
    stage.scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        !Array.isArray(object.material) &&
        (object.material as THREE.MeshStandardMaterial).map instanceof THREE.CanvasTexture
      )
        previous.push(object);
    });
    const counts: number[] = [];
    for (const mesh of previous) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const resources = [mesh.geometry, material, material.map, material.roughnessMap].filter(
        Boolean,
      );
      for (const resource of resources) {
        const index = counts.push(0) - 1;
        (resource as THREE.EventDispatcher<{ dispose: object }>).addEventListener("dispose", () => {
          counts[index] = (counts[index] ?? 0) + 1;
        });
      }
    }
    world.setMission(mission);
    expect(counts.every((count) => count === 1)).toBe(true);
    expect(sharedDisposed).toBe(0);
  }
  await whenLoaded();
  world.dispose();
  world.dispose();
  expect(stage.scene.children).toHaveLength(0);
  expect(sharedDisposed).toBe(0);
  releaseMaterials();
  expect(sharedDisposed).toBe(10);
});

test("mission clones leave the shared scan maps alive, and lines/instances dispose once", () => {
  const sharedMap = new THREE.Texture();
  const shared = new THREE.MeshStandardMaterial({ map: sharedMap, normalMap: sharedMap });
  const cloned = shared.clone();
  const geometry = new THREE.BoxGeometry();
  const root = new THREE.Group();
  const instance = new THREE.InstancedMesh(geometry, cloned, 2);
  root.add(
    new THREE.Mesh(geometry, cloned),
    instance,
    new THREE.Line(geometry, new THREE.LineBasicMaterial()),
  );
  let mapCount = 0;
  let geometryCount = 0;
  let clonedCount = 0;
  let instanceCount = 0;
  sharedMap.addEventListener("dispose", () => mapCount++);
  geometry.addEventListener("dispose", () => geometryCount++);
  cloned.addEventListener("dispose", () => clonedCount++);
  instance.addEventListener("dispose", () => instanceCount++);
  disposeTree(root, new Set([shared]));
  expect([mapCount, geometryCount, clonedCount, instanceCount]).toEqual([0, 1, 1, 1]);
  shared.dispose();
  sharedMap.dispose();
});

test("late texture completion cannot refill the decoded-image cache after disposal", async () => {
  ImageFixture.deferred = true;
  const texture = pbrTexture("metal027", "normal", 2);
  expect(THREE.Cache.get("image:/textures/metal027/normal.webp")).toBeDefined();
  disposeAssets();
  let settled = false;
  void whenLoaded().then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(true);
  for (const complete of ImageFixture.pending.splice(0)) complete();
  await new Promise((done) => setTimeout(done, 0));
  expect(THREE.Cache.get("image:/textures/metal027/normal.webp")).toBeUndefined();
  const image = texture.image;
  if (!(image instanceof ImageFixture)) throw new Error("missing decoded image");
  expect(image.complete).toBe(true);
});

test("crash feedback uses the terminal flight point, then a live motion change freezes it", () => {
  const { stage, world } = fixture();
  const session = new Session();
  world.setMission(session.mission);
  session.launch();
  world.update(frame(session));
  if (!session.flight) throw new Error("missing flight");
  session.flight.p = { x: 4.75, y: -2 };
  session.phase = "result";
  world.react("end", session, false);
  world.shatter(false);
  const scraps = stage.scene.children.find((object) => object.children.length === 14);
  if (!scraps) throw new Error("missing scraps");
  const endpoint = new THREE.Vector3(4.75, 0.05, 2);
  expect(scraps.children.every((object) => object.position.equals(endpoint))).toBe(true);
  world.setReducedMotion(true);
  const poses = scraps.children.map((object) => ({
    p: object.position.clone(),
    q: object.quaternion.clone(),
  }));
  world.update(frame(session, true, 0.1));
  expect(
    scraps.children.every(
      (object, index) =>
        object.position.equals(poses[index]?.p as THREE.Vector3) &&
        object.quaternion.equals(poses[index]?.q as THREE.Quaternion),
    ),
  ).toBe(true);
});

test("retry removes old muzzle, brake and crash effects immediately", () => {
  const { stage, world, resets } = fixture();
  const session = new Session();
  world.setMission(session.mission);
  session.launch();
  world.react("launch", session, false);
  world.react("brake", session, false);
  world.shatter(false);
  world.update(frame(session, false, 0.1));
  const effects = stage.scene.children.filter(
    (object) => object.children.length === 10 || object.children.length === 14,
  );
  expect(effects.some((object) => object.visible)).toBe(true);
  session.reset();
  world.update(frame(session));
  expect(effects.every((object) => !object.visible)).toBe(true);
  expect(resets()).toBeGreaterThanOrEqual(3);
});

test("reduced-motion scraps remain static and a re-fired puff starts at its muzzle", () => {
  const burst = new Burst();
  const puff = new Puff(0xffffff);
  roots.push(burst.group, puff.group);
  burst.fire(new THREE.Vector3(1, 2, 3), true);
  const first = burst.group.children[0];
  if (!first) throw new Error("no scrap");
  const position = first.position.clone();
  burst.update(0.2);
  expect(first.position.equals(position)).toBe(true);
  expect(first.rotation.toArray()).toEqual([0, 0, 0, "XYZ"]);
  puff.fire(position, 0, false);
  puff.update(0.2);
  puff.fire(position, 0, false);
  expect(
    puff.group.children.every((object) => object.position.length() === 0 && object.scale.x === 0.6),
  ).toBe(true);
});

test("dotted predictions include their terminal point between sampling strides", () => {
  const dots = new DotPath(0xffffff);
  roots.push(dots.mesh);
  dots.set(
    Array.from({ length: 10 }, (_, x) => ({ x, y: -x })),
    4,
    5,
  );
  const matrix = new THREE.Matrix4();
  dots.mesh.getMatrixAt(dots.mesh.count - 1, matrix);
  expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([
    9,
    expect.closeTo(0.02),
    9,
  ]);
});

test("dashed previous paths keep their buffer and compute only the visible distances", () => {
  const path = new LinePath(0xffffff, 1, true, 20);
  roots.push(path.line);
  const attribute = path.line.geometry.getAttribute("lineDistance");
  path.set([
    { x: 0, y: 0 },
    { x: 3, y: 4 },
    { x: 3, y: 8 },
  ]);
  expect(Array.from(attribute.array).slice(0, 3)).toEqual([0, 5, 9]);
  path.set([
    { x: 10, y: 10 },
    { x: 10, y: 13 },
  ]);
  expect(path.line.geometry.getAttribute("lineDistance")).toBe(attribute);
  expect(Array.from(attribute.array).slice(0, 2)).toEqual([0, 3]);
  expect(path.line.geometry.drawRange.count).toBe(2);
});

test("all normal chart shots fit the left landscape rail and project input onto the same plane", () => {
  for (const [width, height, rail] of [
    [1440, 900, 0],
    [390, 844, 0],
    [568, 320, 568 * 0.54],
  ] as const) {
    for (const mission of MISSIONS) {
      const extents = missionExtents(mission);
      const home = homeView(extents, width, height, rail);
      const camera = new THREE.PerspectiveCamera(home.fov, width / height, 0.05, 400);
      camera.position.copy(home.position);
      camera.lookAt(home.target);
      camera.setViewOffset(
        width,
        height,
        width * (home.shiftX ?? 0),
        height * (home.shiftY ?? 0),
        width,
        height,
      );
      camera.updateMatrixWorld();
      for (const x of [extents.minX, extents.maxX])
        for (const y of [extents.minY, extents.maxY]) {
          const projected = new THREE.Vector3(x, 0, -y).project(camera);
          const px = ((projected.x + 1) * width) / 2;
          expect(px).toBeGreaterThanOrEqual(0);
          expect(px).toBeLessThanOrEqual(width - rail);
          expect(Math.abs(projected.y)).toBeLessThan(1);
        }
      const target = new THREE.Vector3(mission.depot.x, 0, -mission.depot.y);
      const projected = target.clone().project(camera);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
      const hit = ray.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        new THREE.Vector3(),
      );
      expect(hit?.distanceTo(target)).toBeLessThan(1e-8);
    }
  }
});

test("portrait framing keeps the cannon's enamel hardware above the phone guide", () => {
  const mission = MISSIONS[0];
  if (!mission) throw new Error("no mission");
  const home = homeView(missionExtents(mission), 390, 844);
  const camera = new THREE.PerspectiveCamera(home.fov, 390 / 844, 0.05, 400);
  camera.position.copy(home.position);
  camera.lookAt(home.target);
  camera.setViewOffset(390, 844, 0, 844 * (home.shiftY ?? 0), 390, 844);
  camera.updateMatrixWorld();
  const depot = makeDepot();
  roots.push(depot.group);
  depot.group.position.set(mission.depot.x, 0, -mission.depot.y);
  depot.barrel.rotation.y = THREE.MathUtils.degToRad(new Session().aim.angle);
  depot.group.updateMatrixWorld(true);
  let bottom = 0;
  const vertex = new THREE.Vector3();
  for (const part of depot.group.children.slice(0, 4))
    part.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute("position");
      for (let index = 0; index < positions.count; index++) {
        vertex
          .fromBufferAttribute(positions, index)
          .applyMatrix4(object.matrixWorld)
          .project(camera);
        bottom = Math.max(bottom, ((1 - vertex.y) * 844) / 2);
      }
    });
  expect(bottom).toBeLessThan(556);
});
