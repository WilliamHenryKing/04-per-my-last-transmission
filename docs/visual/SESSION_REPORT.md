# Fidelity pass: session report

Branch `cloud-v1`. Nothing was pushed to `main` and nothing was deployed.

## Scores

| Bookmark | Baseline | After |
| --- | --- | --- |
| wide | 2.3 | 3.6 |
| hero | 2.4 | 3.4 |
| closeup | 1.7 | 3.1 |
| grazing | 1.6 | 3.0 |
| phone-hero | 2.4 | 3.4 |
| **Overall** | **2.1** | **3.3** |

Per-axis tables, luminance targets and three remaining flaws per bookmark are in [`AUDIT.md`](AUDIT.md). Evidence is in `captures/baseline/` and `captures/after/`, rendered by `scripts/capture-visual.ts` on headless Chromium with SwiftShader. The renderer string, `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`, is logged in each `capture-info.json`.

## Shipped assets

8.2 MB in total, recorded in `assets.manifest.json` (source URL, author, licence, retrieval date, processing and sha256 for every file):

- **Textures:** 4.0 MB. Seven CC0 PBR sets as 1K WebP (rock 512 px), each with colour (sRGB), normal (linear) and packed ARM (linear) maps: ambientCG PaintedMetal004, PaintedMetal012, Metal027 and Cardboard001; Poly Haven kitchen_wood, rough_linen and rock_face_03.
- **HDRI:** 1.6 MB. Poly Haven `studio_small_09`, 1k .hdr (CC0).
- **Audio:** 2.5 MB. Kenney and OpenGameArt CC0, from the earlier sound pass.

## What changed

- **Capture hook** (`src/visualTest.ts`, dev and `?e2e` only): `window.__VISUAL_TEST__` with `ready`, `isReady`, `freeze`, `setBookmark`, `settle` and `advance` (exact frozen-time steps whose time also drives the next frame's animations). There are five bookmarks in `src/scene/bookmarks.ts`: wide, hero, closeup, grazing and phone-hero.
- **One lighting model:** the studio HDRI (a PMREM as `scene.environment`, the same map blurred as the backdrop), one key light with shadows fitted to each mission and snapped to texels, AgX once in OutputPass, and exposure as the single brightness control. The hemisphere light and emissive star specks are gone.
- **Materials:** chipped enamel, powder-coat and cardboard scans; glazed ceramic planets (painted glaze and roughness maps under a satin clearcoat); scratched brass; scanned rock with per-boulder shape and tone jitter.
- **Table:** a wooden frame and linen sheet, with the star chart printed into the linen's albedo.
- **Detail:** brass orrery stands carry everything to the table, so nothing floats. Depot and dock are turned and rounded forms, with a scalloped awning, a glazed window, a depth-tested sign that faces the camera, and a lamp.
- **Glow:** only the café lamp and the parcel beacon glow, and each carries a real point light.
- **Render chain** (adapted from ODD TIDE's `pipeline.ts` and `rig.ts`): half-float MSAA target → GTAO (skips flat overlays and the second shadow render) → UnrealBloom with an HDR threshold and energy clamp → SMAA → OutputPass. Physical aerial perspective (1 − e^(−σd)) is tinted to the backdrop.
- **Tiers:** a low tier for phones and coarse pointers (no GTAO or MSAA, 1024 shadows, pixel ratio ≤ 1.5), adaptive quality on the high tier (GTAO drops after 2 s above ~19 ms a frame), and `?quality=low|high` to force a tier.
- **Loader:** the arrival veil still lifts after the first frame. Textures and the HDRI stream in behind it and never block the loader.
- **Tests:** `bun run check` passes (strict tsc, Biome, 40 unit tests, build). The Playwright e2e test passes on SwiftShader using `?quality=low` with a 300 s budget, because the CPU renderer takes about 0.3 s a frame for the full material set. On a GPU it runs as before.
- **README:** credits for the textures and HDRI, the lighting bullet updated, and refreshed `desktop.png`, `phone.png` and `preview.gif` (disposal method 1, "do not dispose", on every frame).

## ODD TIDE

The read-only clone of `WilliamHenryKing/01-odd-tide` succeeded (attached to this session, cloned outside this repository). From it I adapted:
- the post chain, including the GTAO shadow-redraw patch and the bloom high-pass energy clamp;
- the physical fog patch;
- the glazed-material approach.

I copied three Poly Haven texture sets (kitchen_wood, rough_linen, rock_face_03) with their manifest records carried over and re-encoded to WebP. Nothing is imported at runtime from that repository.

## Not done, and why

- **Not verified on a real GPU.** All evidence is SwiftShader. I could not measure frame time, so the adaptive step's thresholds are reasoned, not tuned. Please check the high tier holds 60 fps on the RTX 2060.
- **KTX2 and meshopt:** there is no KTX2 encoder here (textures ship as WebP, which the directive allows). No glTF models ship (all geometry is built in code), so meshopt and `@gltf-transform` had nothing to process.
- **Alpha-tested foliage:** there is no foliage in this game.
- **Remaining flaws** (full list in AUDIT.md): an over-scaled rust pattern on the café hut, a plain grey studio wall behind the table, the HUD covering the cannon in the hero framing, and crater strokes on the moon that repeat.
- **Scoring is my own judgement** from the captures. The luminance relationships are measured, from `wide.png` crops.

## Where this session stopped

The session stopped at the testing session's request because the cloud credit had run out. The fidelity pass was already complete and pushed when the stop arrived (`eaf2b6a`): there is no work in progress and no `WIP:` commit. At the stop, `bun run check` passed (strict tsc, Biome, 40 unit tests, production build), and the Playwright e2e test last passed on the final build (3.0 min on SwiftShader, `?quality=low`).

What is left, for the local session:
1. **Verify on a real GPU:** check that the high tier holds about 60 fps at 1440×900 on the RTX 2060, and tune `Pipeline.adapt` (the 19 ms / 2 s threshold in `src/scene/pipeline.ts`) from real frame times.
2. **Fix the remaining flaws listed in AUDIT.md**, in priority order:
   - Scale the PaintedMetal012 rust down on the café hut (texture repeat of about 3 there).
   - Add a darker, more characterful studio backdrop, or lower `backgroundIntensity` below 0.07 and re-measure the backdrop-to-table ratio.
   - Reframe the hero bookmark so the HUD bar does not cover the cannon.
   - Vary the moon's crater rim strokes (`src/scene/planetArt.ts`).
3. **Recapture and rescore:** after any visual change, run `bun run build && bun scripts/capture-visual.ts after`, rescore in AUDIT.md, and refresh the README media with `bun scripts/capture-readme.ts` (needs `ffmpeg` on PATH or `FFMPEG=/path/to/ffmpeg`).
