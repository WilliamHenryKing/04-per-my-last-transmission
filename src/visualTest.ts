import { DT } from "./game/physics";
import type { Session } from "./game/session";
import { BOOKMARKS, type Bookmark, shotFor } from "./scene/bookmarks";
import type { Stage } from "./scene/stage";

// window.__VISUAL_TEST__: deterministic capture for fidelity evidence (dev and ?e2e only).
//   await __VISUAL_TEST__.ready        first frame drawn and every texture/HDRI loaded
//   __VISUAL_TEST__.freeze(true)       stop game time and decorative motion
//   __VISUAL_TEST__.setBookmark(name)  fixed camera shot (null returns to the game camera)
//   await __VISUAL_TEST__.settle(n)    wait n rendered frames
//   __VISUAL_TEST__.advance(seconds)   step frozen game time exactly (fixed steps)

export interface VisualHooks {
  frozen: boolean;
  /** Time stepped by advance() while frozen, handed once to the next frame's animations. */
  takeDt(): number;
  /** Called by the frame loop after each render. */
  onFrame(): void;
}

export function installVisualTest(
  stage: Stage,
  session: Session,
  assetsReady: () => Promise<unknown>,
  firstFrame: Promise<void>,
): VisualHooks {
  const waiters: { left: number; done: () => void }[] = [];
  let banked = 0;
  const hooks: VisualHooks = {
    frozen: false,
    takeDt() {
      const dt = Math.min(banked, 0.1);
      banked = 0;
      return dt;
    },
    onFrame() {
      for (let i = waiters.length - 1; i >= 0; i--) {
        const w = waiters[i];
        if (!w) continue;
        w.left -= 1;
        if (w.left <= 0) {
          waiters.splice(i, 1);
          w.done();
        }
      }
    },
  };
  const api = {
    bookmarks: [...BOOKMARKS],
    ready: firstFrame.then(assetsReady).then(() => {
      api.isReady = true;
      return true;
    }),
    /** Synchronous view of `ready`, for drivers that run the page on a paused clock. */
    isReady: false,
    freeze(on = true) {
      hooks.frozen = on;
    },
    setBookmark(name: Bookmark | null) {
      document.documentElement.dataset.visualBookmark = name ?? "";
      stage.setShot(name ? shotFor(name, session.mission, session.time) : null);
    },
    advance(seconds: number) {
      const frozen = hooks.frozen;
      hooks.frozen = false;
      const steps = Math.round(seconds / DT);
      for (let i = 0; i < steps; i++) session.advance(DT);
      hooks.frozen = frozen;
      banked += steps * DT;
    },
    settle(frames = 3) {
      return new Promise<void>((done) => waiters.push({ left: frames, done }));
    },
    quality: () => stage.quality(),
    degrade: () => stage.degrade(),
  };
  Object.assign(window, { __VISUAL_TEST__: api });
  return hooks;
}
