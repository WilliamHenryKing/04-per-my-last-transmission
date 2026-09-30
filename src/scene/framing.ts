import { MathUtils, Vector3 } from "three";
import type { CameraShot, Extents } from "./stage";

export const GAME_FOV = 34;
const ELEVATION = MathUtils.degToRad(58);

/** The normal chart shot, fitted to the unobscured part of the canvas. */
export function homeView(
  extents: Extents,
  width: number,
  height: number,
  railWidth = 0,
): CameraShot {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const rail = MathUtils.clamp(railWidth, 0, w - 1);
  const usableAspect = (w - rail) / h;
  const portrait = usableAspect < 0.9;
  const across = extents.maxX - extents.minX;
  const deep = extents.maxY - extents.minY;
  const screenW = portrait ? deep : across;
  const screenH = (portrait ? across : deep) * Math.sin(ELEVATION);
  const vfov = MathUtils.degToRad(GAME_FOV);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * usableAspect);
  const hudShare = rail ? 0.94 : portrait ? 0.5 : 0.74;
  let distance =
    1.14 *
    Math.max(screenW / 2 / Math.tan(hfov / 2), screenH / 2 / (Math.tan(vfov / 2) * hudShare));
  const target = new Vector3(
    (extents.minX + extents.maxX) / 2,
    -0.4,
    -(extents.minY + extents.maxY) / 2,
  );
  const backDirection = new Vector3(
    portrait ? -Math.cos(ELEVATION) : 0,
    Math.sin(ELEVATION),
    portrait ? 0 : Math.cos(ELEVATION),
  );
  const right = new Vector3(portrait ? 0 : 1, 0, portrait ? 1 : 0);
  for (const x of [extents.minX, extents.maxX])
    for (const y of [extents.minY, extents.maxY]) {
      const delta = new Vector3(x, 0, -y).sub(target);
      // The near corners appear larger than a centred rectangle at the same distance.
      const edgeDistance =
        delta.dot(backDirection) + Math.abs(delta.dot(right)) / Math.tan(hfov / 2);
      distance = Math.max(distance, edgeDistance * 1.03);
    }
  const back = new Vector3(portrait ? -1 : 0, 0, portrait ? 0 : 1).multiplyScalar(
    Math.cos(ELEVATION) * distance,
  );
  return {
    position: target
      .clone()
      .add(back)
      .add(new Vector3(0, Math.sin(ELEVATION) * distance, 0)),
    target,
    fov: GAME_FOV,
    shiftX: rail / (2 * w),
    shiftY: rail ? 0 : portrait ? 0.07 : 0.03,
  };
}
