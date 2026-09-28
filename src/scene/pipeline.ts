import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
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
  ) {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: tier === "high" ? 4 : 0,
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
      this.ao = ao;
    }

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

  setSize(width: number, height: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render() {
    this.composer.render();
  }
}
