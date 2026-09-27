import { MISSIONS } from "../game/missions";
import { EMPTY_PROGRESS, type Progress, parseProgress, record } from "../game/progress";
import { type Cue, Session } from "../game/session";
import type { Aim } from "../game/types";

/** What the controller needs from the sound system (kept abstract for the UI layer). */
export interface Sound {
  muted: boolean;
  play(
    id:
      | "ui-click"
      | "ui-tick"
      | "ui-open"
      | "ui-close"
      | "ui-toggle"
      | "ui-retry"
      | "ui-next"
      | "ending",
  ): void;
  setMuted(muted: boolean): void;
}

const SILENT: Sound = { muted: true, play() {}, setMuted() {} };

// UI-side glue: player actions, saved progress, toasts and which panel is open.
// React subscribes to `version`; the render loop calls frame() once per animation frame.

export type View = "play" | "missions" | "ending";

const PROGRESS_KEY = "pmlt.progress.v1";
const HINT_KEY = "pmlt.hint.v1";

function load(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows may refuse storage; progress simply is not remembered.
  }
}

const CUE_TOASTS: Partial<Record<Cue, string>> = {
  circled: "Just circling back.",
  bounce: "Ricochet. No charge for the dent.",
  brake: "Brake applied. That was the only one.",
};

export class Controller {
  readonly session: Session;
  progress: Progress;
  view: View = "play";
  hintOpen: boolean;
  toast: { text: string; id: number } | null = null;
  version = 0;
  private listeners = new Set<() => void>();
  private seenSession = -1;
  private seenClock = -1;
  private toastTimer = 0;

  private readonly sound: Sound;

  constructor(sound: Sound = SILENT) {
    this.sound = sound;
    this.progress = parseProgress(load(PROGRESS_KEY)) ?? EMPTY_PROGRESS;
    this.session = new Session(Math.min(this.progress.unlocked, MISSIONS.length - 1));
    this.hintOpen = load(HINT_KEY) !== "seen";
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = () => this.version;

  private bump() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  /** Called every animation frame after the session advanced. */
  frame(dt: number, cues: Cue[]) {
    for (const c of cues) {
      const text = CUE_TOASTS[c];
      if (text) this.showToast(text);
      if (c === "end") this.onEnd();
    }
    if (this.toast) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toast = null;
        this.bump();
      }
    }
    const clock = Math.floor(this.session.time * 10);
    if (this.session.version !== this.seenSession || clock !== this.seenClock) {
      this.seenSession = this.session.version;
      this.seenClock = clock;
      this.bump();
    }
  }

  private showToast(text: string) {
    this.toast = { text, id: (this.toast?.id ?? 0) + 1 };
    this.toastTimer = 2.2;
    this.bump();
  }

  private onEnd() {
    const s = this.session;
    if (!s.outcome) return;
    const next = record(this.progress, s.mission.id, s.index, MISSIONS.length, s.outcome);
    if (next !== this.progress) {
      this.progress = next;
      save(PROGRESS_KEY, JSON.stringify(next));
    }
  }

  dismissHint() {
    if (!this.hintOpen) return;
    this.hintOpen = false;
    this.sound.play("ui-click");
    save(HINT_KEY, "seen");
    this.bump();
  }

  setAim(aim: Partial<Aim>) {
    const before = this.session.version;
    this.session.setAim(aim);
    if (this.session.version === before) return;
    this.sound.play("ui-tick");
    this.bump();
  }

  nudgeAim(dAngle: number, dPower: number) {
    const a = this.session.aim;
    this.setAim({ angle: a.angle + dAngle, power: a.power + dPower });
  }

  launch() {
    if (this.view !== "play") return;
    if (!this.session.launch()) return;
    this.dismissHint();
    this.bump();
  }

  brake() {
    if (this.session.brake()) this.bump();
  }

  /** One action for the big button: launch while aiming, brake while flying. */
  primary() {
    if (this.session.phase === "aim") this.launch();
    else if (this.session.phase === "flight") this.brake();
  }

  retry() {
    if (this.view !== "play") return;
    if (this.session.phase === "aim" && !this.session.last) return;
    this.sound.play("ui-retry");
    this.session.reset();
  }

  next() {
    const s = this.session;
    if (s.outcome?.verdict !== "delivered") return;
    if (s.index === MISSIONS.length - 1) {
      this.view = "ending";
      this.sound.play("ending");
      this.bump();
      return;
    }
    this.sound.play("ui-next");
    s.select(s.index + 1);
  }

  select(index: number) {
    if (index > this.progress.unlocked) return;
    this.sound.play("ui-next");
    this.session.select(index);
    this.view = "play";
    this.bump();
  }

  openMissions() {
    if (this.view === "missions") return;
    this.sound.play("ui-open");
    this.view = "missions";
    this.bump();
  }

  closePanel() {
    if (this.view === "play") return;
    this.sound.play("ui-close");
    this.view = "play";
    this.bump();
  }

  get muted(): boolean {
    return this.sound.muted;
  }

  toggleMute() {
    this.sound.setMuted(!this.sound.muted);
    this.sound.play("ui-toggle");
    this.bump();
  }
}
