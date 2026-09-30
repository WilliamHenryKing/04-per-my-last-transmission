import { expect, test } from "bun:test";
import { commandForKey, type KeyInput, type KeyTarget } from "../src/ui/keyboard";

const play = (key: string, target: KeyTarget = "other", options: Partial<KeyInput> = {}) =>
  commandForKey({ key, target, ...options }, "done", "play");

test("held primary and discrete shortcuts cannot launch then brake, retry, or toggle sound twice", () => {
  for (const key of [" ", "Enter", "B", "R", "N", "L", "M"]) {
    expect(play(key)).not.toBeNull();
    expect(play(key, "other", { repeat: true })).toBeNull();
  }
  expect(play("ArrowLeft", "other", { repeat: true })).toEqual({
    type: "aim",
    angle: 1,
    power: 0,
  });
});

test("native buttons own Enter and Space, including buttons inside scrolling panels", () => {
  for (const target of ["button", "scroll-button"] as const) {
    for (const key of [" ", "Enter"]) expect(play(key, target)).toBeNull();
  }
});

test("guide, mission and result panels retain native arrows and Space scrolling", () => {
  for (const target of ["scroll", "scroll-button"] as const) {
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"]) {
      expect(play(key, target)).toBeNull();
      expect(play(key, target, { repeat: true })).toBeNull();
    }
  }
  expect(play("r", "scroll")).toEqual({ type: "retry" });
});

test("sliders retain native arrows and consume no typing or browser shortcuts", () => {
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
    expect(play(key, "range")).toBeNull();
  }
  for (const key of [" ", "Enter", "r", "m", "ArrowUp"]) {
    expect(play(key, "text")).toBeNull();
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "defaultPrevented"] as const) {
      expect(play(key, "other", { [modifier]: true })).toBeNull();
    }
  }
});

test("opening and modal panels isolate play commands while retaining sound and dismissal", () => {
  expect(commandForKey({ key: "Enter", target: "other" }, "title", "play")).toEqual({
    type: "begin",
  });
  for (const target of ["button", "scroll-button"] as const) {
    expect(commandForKey({ key: "Enter", target }, "title", "play")).toBeNull();
  }
  for (const key of ["Enter", " ", "ArrowUp", "m", "l"]) {
    expect(commandForKey({ key, target: "other" }, "glide", "play")).toBeNull();
  }
  for (const view of ["missions", "ending"] as const) {
    for (const key of [" ", "Enter", "r", "b", "n", "ArrowLeft"]) {
      expect(commandForKey({ key, target: "other" }, "done", view)).toBeNull();
    }
    for (const key of ["Escape", "L"]) {
      expect(commandForKey({ key, target: "other" }, "done", view)).toEqual({ type: "close" });
      expect(commandForKey({ key, target: "other", repeat: true }, "done", view)).toBeNull();
    }
    expect(commandForKey({ key: "M", target: "button" }, "done", view)).toEqual({ type: "mute" });
  }
});

test("chart aiming preserves direction and larger Shift increments", () => {
  expect(play("ArrowLeft")).toEqual({ type: "aim", angle: 1, power: 0 });
  expect(play("ArrowRight")).toEqual({ type: "aim", angle: -1, power: 0 });
  expect(play("W", "other", { shiftKey: true })).toEqual({ type: "aim", angle: 0, power: 5 });
  expect(play("S", "other", { shiftKey: true })).toEqual({ type: "aim", angle: 0, power: -5 });
  expect(play("A", "other", { shiftKey: true })).toEqual({ type: "aim", angle: 5, power: 0 });
  expect(play("D", "other", { shiftKey: true })).toEqual({ type: "aim", angle: -5, power: 0 });
});
