import { expect, test } from "bun:test";
import { bindChartInput } from "../src/chartInput";

function setup() {
  const view = new EventTarget();
  const doc = Object.assign(new EventTarget(), { defaultView: view, hidden: false });
  const captures = new Set<number>();
  const canvas = Object.assign(new EventTarget(), {
    ownerDocument: doc,
    setPointerCapture: (id: number) => captures.add(id),
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => captures.delete(id),
  });
  let allowed = true;
  let moves = 0;
  const binding = bindChartInput(
    canvas as unknown as HTMLCanvasElement,
    () => allowed,
    () => moves++,
  );
  const send = (type: string, id = 1, button = 0, isPrimary = true) =>
    canvas.dispatchEvent(
      Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button, isPrimary }),
    );
  return {
    view,
    doc,
    captures,
    binding,
    send,
    moves: () => moves,
    close: () => {
      allowed = false;
      binding.sync();
    },
  };
}

test("chart aiming belongs to one primary pointer and ignores secondary buttons/fingers", () => {
  const s = setup();
  s.send("pointerdown", 2, 2);
  s.send("pointerdown", 2, 0, false);
  expect(s.moves()).toBe(0);
  s.send("pointerdown");
  s.send("pointerdown", 2);
  s.send("pointermove", 2);
  s.send("pointerup", 2);
  s.send("pointermove");
  expect(s.moves()).toBe(2);
  expect(s.captures.has(1)).toBe(true);
  s.send("pointerup");
  expect(s.captures.size).toBe(0);
  s.binding.dispose();
});

test("a panel or cancelled/lost capture cannot leave an invisible aim drag active", () => {
  for (const kind of ["pointercancel", "lostpointercapture", "panel", "blur", "hidden"]) {
    const s = setup();
    s.send("pointerdown");
    if (kind === "panel") s.close();
    else if (kind === "blur") s.view.dispatchEvent(new Event("blur"));
    else if (kind === "hidden") {
      s.doc.hidden = true;
      s.doc.dispatchEvent(new Event("visibilitychange"));
    } else s.send(kind);
    s.send("pointermove");
    expect(s.moves()).toBe(1);
    expect(s.captures.size).toBe(0);
    s.binding.dispose();
  }
});

test("disposed chart bindings release capture and cannot receive another drag", () => {
  const s = setup();
  s.send("pointerdown");
  s.binding.dispose();
  s.send("pointermove");
  s.send("pointerdown");
  expect(s.moves()).toBe(1);
  expect(s.captures.size).toBe(0);
});
