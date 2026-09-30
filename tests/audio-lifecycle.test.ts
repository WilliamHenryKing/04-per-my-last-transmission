import { afterEach, beforeEach, expect, test } from "bun:test";
import { AudioEngine } from "../src/audio/engine";

class ParamFixture {
  value = 1;
  setValueAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime(value: number) {
    this.value = value;
  }
  setTargetAtTime(value: number) {
    this.value = value;
  }
  cancelScheduledValues() {}
}
class NodeFixture {
  disconnected = 0;
  connect<T>(node: T): T {
    return node;
  }
  disconnect() {
    this.disconnected++;
  }
}
class SourceFixture extends NodeFixture {
  playbackRate = new ParamFixture();
  onended: (() => void) | null = null;
  loop = false;
  started = 0;
  stopped = 0;
  start() {
    this.started++;
  }
  stop() {
    this.stopped++;
  }
}
class GainFixture extends NodeFixture {
  gain = new ParamFixture();
}
class ContextFixture {
  static made: ContextFixture[] = [];
  static decode: (() => Promise<AudioBuffer>) | null = null;
  state = "running";
  currentTime = 0;
  destination = new NodeFixture();
  sources: SourceFixture[] = [];
  gains: GainFixture[] = [];
  closed = 0;
  suspended = 0;
  resumed = 0;
  constructor() {
    ContextFixture.made.push(this);
  }
  createGain() {
    const node = new GainFixture();
    this.gains.push(node);
    return node;
  }
  createBufferSource() {
    const node = new SourceFixture();
    this.sources.push(node);
    return node;
  }
  decodeAudioData() {
    return ContextFixture.decode?.() ?? Promise.resolve(buffer());
  }
  async close() {
    this.closed++;
    this.state = "closed";
  }
  async suspend() {
    this.suspended++;
  }
  async resume() {
    this.resumed++;
  }
}
function buffer() {
  return {
    sampleRate: 100,
    getChannelData: () => new Float32Array([0, 0.5, -0.5, 0]),
  } as unknown as AudioBuffer;
}
async function flush() {
  for (let i = 0; i < 100; i++) await Promise.resolve();
}

const originals = new Map<string, PropertyDescriptor | undefined>();
const engines: AudioEngine[] = [];
let visibility: EventTarget & { hidden: boolean };
let requests: AbortSignal[];
beforeEach(() => {
  for (const name of ["window", "document", "fetch"])
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  ContextFixture.made = [];
  ContextFixture.decode = null;
  visibility = Object.assign(new EventTarget(), { hidden: false });
  requests = [];
  Object.defineProperty(globalThis, "document", { configurable: true, value: visibility });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      AudioContext: ContextFixture,
      localStorage: { getItem: () => null, setItem() {} },
    },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (_url: string, init: RequestInit) => {
      requests.push(init.signal as AbortSignal);
      return { arrayBuffer: async () => new ArrayBuffer(1) };
    },
  });
});
afterEach(async () => {
  for (const engine of engines.splice(0)) engine.dispose();
  await flush();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  originals.clear();
});
function engine() {
  const value = new AudioEngine();
  engines.push(value);
  return value;
}

test("disposing before unlock removes the visibility listener and cannot recreate audio", () => {
  const audio = engine();
  audio.dispose();
  audio.dispose();
  audio.unlock();
  visibility.dispatchEvent(new Event("visibilitychange"));
  expect(ContextFixture.made).toHaveLength(0);
  expect(requests).toHaveLength(0);
});

test("late decoded assets cannot start beds or request more files after teardown", async () => {
  let complete: ((value: AudioBuffer) => void) | null = null;
  ContextFixture.decode = () =>
    new Promise((done) => {
      complete = done;
    });
  const audio = engine();
  audio.unlock();
  await flush();
  expect(requests).toHaveLength(1);
  audio.dispose();
  if (!complete) throw new Error("decode not started");
  (complete as (value: AudioBuffer) => void)(buffer());
  await flush();
  const context = ContextFixture.made[0];
  expect(context?.sources).toHaveLength(0);
  expect(context?.closed).toBe(1);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.aborted).toBe(true);
});

test("beds, flight hum and scheduled effects stop and disconnect exactly once", async () => {
  const audio = engine();
  audio.setMood("flight");
  audio.unlock();
  await flush();
  audio.play("stamp", 0.3);
  const context = ContextFixture.made[0];
  if (!context) throw new Error("no context");
  expect(context.sources).toHaveLength(4);
  audio.dispose();
  audio.dispose();
  expect(
    context.sources.every(
      (source) => source.stopped === 1 && source.disconnected === 1 && source.onended === null,
    ),
  ).toBe(true);
  expect(context.gains.every((gain) => gain.disconnected === 1)).toBe(true);
  expect(context.closed).toBe(1);
  const total = context.sources.length;
  audio.unlock();
  audio.play("stamp");
  audio.setMood("aim");
  visibility.dispatchEvent(new Event("visibilitychange"));
  expect(context.sources).toHaveLength(total);
  expect(context.resumed).toBe(0);
});

test("naturally ended effects release their gain and are not stopped again on disposal", async () => {
  const audio = engine();
  audio.unlock();
  await flush();
  audio.play("ui-click");
  const context = ContextFixture.made[0];
  const ended = context?.sources.at(-1);
  const gain = context?.gains.at(-1);
  if (!ended) throw new Error("missing effect");
  ended.onended?.();
  expect(ended.disconnected).toBe(1);
  expect(gain?.disconnected).toBe(1);
  audio.dispose();
  expect(ended.stopped).toBe(0);
  expect(ended.disconnected).toBe(1);
  expect(gain?.disconnected).toBe(1);
});

test("a retry cancels future verdict sounds while retaining started sounds and beds", async () => {
  const audio = engine();
  audio.unlock();
  await flush();
  const context = ContextFixture.made[0];
  if (!context) throw new Error("no context");
  audio.play("stamp", 0.3);
  const future = context.sources.at(-1);
  audio.play("ui-click");
  const started = context.sources.at(-1);
  audio.cancelPending();
  expect(future?.stopped).toBe(1);
  expect(future?.disconnected).toBe(1);
  expect(started?.stopped).toBe(0);
  expect(started?.disconnected).toBe(0);
  expect(context.sources.slice(0, 2).every((source) => source.stopped === 0)).toBe(true);
  audio.play("stamp", 0.3);
  const elapsed = context.sources.at(-1);
  context.currentTime = 0.5;
  audio.cancelPending();
  expect(elapsed?.stopped).toBe(0);
  audio.dispose();
  expect(future?.stopped).toBe(1);
  expect(elapsed?.stopped).toBe(1);
});
