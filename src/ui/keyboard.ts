export type KeyTarget = "text" | "range" | "button" | "scroll-button" | "scroll" | "other";
export type Command =
  | { type: "aim"; angle: number; power: number }
  | { type: "begin" | "mute" | "close" | "primary" | "brake" | "retry" | "next" | "missions" };

export interface KeyInput {
  key: string;
  target: KeyTarget;
  repeat?: boolean;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  defaultPrevented?: boolean;
}

/** Sliders keep native arrows; editable text and scrolling panels keep their own keys. */
export function commandForKey(
  input: KeyInput,
  opening: "title" | "glide" | "done",
  view: "play" | "missions" | "ending",
): Command | null {
  if (
    input.defaultPrevented ||
    input.ctrlKey ||
    input.metaKey ||
    input.altKey ||
    input.target === "text"
  )
    return null;
  const key = input.key.toLowerCase();
  if (opening !== "done") {
    return opening === "title" &&
      key === "enter" &&
      !input.repeat &&
      input.target !== "button" &&
      input.target !== "scroll-button"
      ? { type: "begin" }
      : null;
  }
  if (key === "m") return input.repeat ? null : { type: "mute" };
  if (view !== "play") {
    return (key === "escape" || key === "l") && !input.repeat ? { type: "close" } : null;
  }
  const step = input.shiftKey ? 5 : 1;
  if (input.target !== "range" && input.target !== "scroll" && input.target !== "scroll-button") {
    if (key === "arrowleft" || key === "a") return { type: "aim", angle: step, power: 0 };
    if (key === "arrowright" || key === "d") return { type: "aim", angle: -step, power: 0 };
    if (key === "arrowup" || key === "w") return { type: "aim", angle: 0, power: step };
    if (key === "arrowdown" || key === "s") return { type: "aim", angle: 0, power: -step };
  }
  if (input.repeat) return null;
  if (
    (key === " " || key === "enter") &&
    input.target !== "button" &&
    input.target !== "scroll-button" &&
    input.target !== "scroll"
  )
    return { type: "primary" };
  if (key === "b") return { type: "brake" };
  if (key === "r") return { type: "retry" };
  if (key === "n") return { type: "next" };
  if (key === "l") return { type: "missions" };
  return null;
}

export function keyTarget(target: EventTarget | null): KeyTarget {
  if (!(target instanceof HTMLElement)) return "other";
  if (
    target.isContentEditable ||
    target.closest(
      "textarea,select,input:not([type='range']):not([type='button']):not([type='submit'])",
    )
  )
    return "text";
  if (target.closest("input[type='range']")) return "range";
  if (target.closest("button,input[type='button'],input[type='submit']"))
    return target.closest(".keyboard-scroll") ? "scroll-button" : "button";
  if (target.closest(".keyboard-scroll")) return "scroll";
  return "other";
}
