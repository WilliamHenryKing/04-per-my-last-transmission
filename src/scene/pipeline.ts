import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// Render chain (adapted from ODD TIDE's pipeline): the scene renders linear HDR into a
// half-float target; GTAO grounds contact; bloom takes only energy above an HDR threshold (the
// parcel beacon and dock lamps); SMAA cleans edges; OutputPass applies AgX and sRGB once.

export type Tier = "high" | "low";

/**
 * Phones and coarse pointers get the light tier: no GTAO, smaller shadows, lower density.
 * `?quality=low|high` overrides the guess (tests, captures, or a user on a slow laptop).
 */
export function pickTier(): Tier {
  if (typeof window === "undefined") return "high";
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "low" || forced === "high") return forced;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return small || coarse ? "low" : "high";
}

/**
 * Integrated or software graphics (from the GPU's name): the high tier then starts without
 * GTAO and multisampling, which the governor would otherwise drop within seconds.
 */
export function modestGpu(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = String(
      ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/nvidia|geforce|rtx|gtx|radeon (rx|pro)|amd radeon rx|apple m[2-9]/i.test(gpu);
  } catch {
    return true;
  }
}

/**
 * Zeroes NaN and infinity (all exponent bits set: immune to fast-math) and caps HDR values
 * before bloom. Some GPUs (Apple's) make NaN where others quietly don't, and bloom's blur
 * would spread one bad pixel over the whole frame.
 */
const FiniteShader = {
  name: "FiniteShader",
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    float finite(float x) {
      return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u ? 0.0 : clamp(x, 0.0, 16384.0);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(finite(c.r), finite(c.g), finite(c.b), 1.0);
    }`,
};

type VisibilityPatched = { _overrideVisibility(): void; _visibilityCache: THREE.Object3D[] };

export class Pipeline {
  readonly composer: EffectComposer;
  readonly ao: GTAOPass | null = null;
  readonly bloom: UnrealBloomPass;
  private readonly smaa: SMAAPass;

  constructor(
    readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    readonly tier: Tier,
    /** Objects the AO G-buffer must skip: flat overlays (guide dots, rings, sign). */
    aoHidden: () => THREE.Object3D[],
    /** Start without GTAO and multisampling (integrated graphics). */
    light = false,
  ) {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: tier === "high" && !light ? 4 : 0,
    });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    if (tier === "high") {
      const ao = new GTAOPass(scene, camera, 1, 1);
      ao.blendIntensity = 0.9;
      // GTAO's G-buffer pre-pass is a full render; the scene pass already drew the shadow map.
      const aoRender = ao.render.bind(ao);
      ao.render = ((...args: Parameters<GTAOPass["render"]>) => {
        const shadows = renderer.shadowMap;
        const auto = shadows.autoUpdate;
        shadows.autoUpdate = false;
        try {
          aoRender(...args);
        } finally {
          shadows.autoUpdate = auto;
        }
      }) as GTAOPass["render"];
      ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.6, thickness: 0.6, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2 });
      const patched = ao as unknown as VisibilityPatched;
      const original = patched._overrideVisibility.bind(ao);
      patched._overrideVisibility = () => {
        original();
        for (const o of aoHidden())
          if (o.visible) {
            o.visible = false;
            patched._visibilityCache.push(o);
          }
      };
      this.composer.addPass(ao);
      ao.enabled = !light;
      this.ao = ao;
    }
    this.composer.addPass(new ShaderPass(FiniteShader));

    // Only light above the threshold blooms, clamped so a beacon can glare but never flood.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.25, 2.2);
    const high = this.bloom.materialHighPassFilter;
    high.fragmentShader = high.fragmentShader.replace(
      "gl_FragColor = mix( outputColor, texel, alpha );",
      `vec3 above = texel.rgb * (max(v - luminosityThreshold, 0.0) / max(v, 1e-4));
        above *= min(1.0, 12.0 / max(luminance(above), 1e-4));
        gl_FragColor = vec4(above, 1.0);`,
    );
    high.needsUpdate = true;
    this.composer.addPass(this.bloom);
    this.smaa = new SMAAPass();
    this.composer.addPass(this.smaa);
    this.composer.addPass(new OutputPass());
  }

  private slowFor = 0;
  private ema = 16.7;
  private spent = false;
  /** Adaptation is off for tests and captures, which must render the full chain. */
  adaptive = true;
  /** Resolution scale the governor has reached (1 … 0.6); the stage applies it. */
  scale = 1;
  onScale: () => void = () => {};

  /**
   * Adaptive quality: whenever frames stay slower than ~52 fps for two seconds, take one step
   * lighter (see step). Nothing comes back mid-session, so quality never oscillates.
   */
  adapt(frameMs: number) {
    if (!this.adaptive || this.spent || frameMs <= 0 || frameMs > 250) return;
    this.ema += (frameMs - this.ema) * 0.1;
    this.slowFor = this.ema > 19 ? this.slowFor + frameMs : 0;
    if (this.slowFor <= 2000) return;
    this.slowFor = 0;
    this.ema = 16.7;
    if (!this.step()) this.spent = true;
  }

  /**
   * One step lighter: GTAO (the most expensive pass), then multisampling (SMAA still smooths
   * edges), then resolution in tenths down to 60 %. False when nothing is left.
   */
  step(): boolean {
    if (this.ao?.enabled) {
      this.ao.enabled = false;
      console.info("PMLT: frame time above budget; ambient occlusion disabled");
      return true;
    }
    const targets = [this.composer.renderTarget1, this.composer.renderTarget2];
    if (targets.some((t) => t.samples > 0)) {
      for (const t of targets) {
        t.samples = 0;
        t.dispose();
      }
      return true;
    }
    if (this.scale > 0.65) {
      this.scale = Math.max(0.6, this.scale - 0.1);
      this.onScale();
      return true;
    }
    return false;
  }

  /** Where the governor has got to, for evidence and tests. */
  get state() {
    return {
      tier: this.tier,
      ao: this.ao?.enabled ?? false,
      msaa: this.composer.renderTarget1.samples,
      pixelRatio: +this.renderer.getPixelRatio().toFixed(3),
      scale: +this.scale.toFixed(2),
    };
  }

  setSize(width: number, height: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render() {
    this.composer.render();
  }
}
