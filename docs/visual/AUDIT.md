# Visual audit: PER MY LAST TRANSMISSION

Evidence: `docs/visual/captures/<label>/`, rendered by `scripts/capture-visual.ts` from the production build with the `?e2e` capture hook (`window.__VISUAL_TEST__`), on headless Chromium with SwiftShader. Each `capture-info.json` records the renderer string (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`). Bookmarks are defined in `src/scene/bookmarks.ts`. Mission 1 is shown at t = 0 with the world frozen, except `hero-flight`, which is 1.3 s after launch.

Scale: 1 placeholder · 2 tech demo · 3 competent indie · 4 premium studio web piece · 5 reference quality.

## Baseline (`captures/baseline/`)

| Axis | wide | hero | closeup | grazing | phone-hero |
| --- | --- | --- | --- | --- | --- |
| Light plausibility | 2 | 2 | 2 | 2 | 2 |
| Materials | 2 | 2 | 1 | 2 | 2 |
| Detail density | 2 | 2 | 1 | 1 | 2 |
| Environment integration | 2 | 2 | 2 | 1 | 2 |
| Atmosphere and depth | 2 | 2 | 2 | 2 | 2 |
| Composition | 3 | 3 | 2 | 2 | 3 |
| Artefacts | 3 | 3 | 2 | 1 | 3 |
| Motion and UI integration | n/a | 3 | n/a | n/a | 3 |
| **Mean** | **2.3** | **2.4** | **1.7** | **1.6** | **2.4** |

Overall baseline: **2.1** (tech demo). The HUD is hidden in `wide`, `closeup` and `grazing`, so UI is scored only where it shows.

What the captures show:
- **Matte clay everywhere.** The planets use vertex colours with a clearcoat, but the only light is a hemisphere light plus one directional light, and there is no environment map. The clearcoat has nothing to reflect, so the enamel reads as unfired clay and the moon's crater blotches look like low-resolution camouflage (vertex-colour blocks).
- **Primitive props.** The dock is an untextured box on a cylinder, and the depot is three primitives. There are no bevels, wear or maps, so the closeup is a placeholder.
- **Flat table.** A navy box with a grid helper. Its star specks come from an emissive map, which is a lighting cheat, and the surface has no micro-detail or roughness response. At a grazing angle it reads as a grey plane.
- **Everything floats.** Planets, rocks, dock and depot hover above the table, with shadows detached far below them. Nothing touches the table.
- **Artefacts.** The dock sign is a sprite with `depthTest: false`, so it draws through the moon (grazing). There is no anti-aliasing beyond MSAA on the canvas, and the table edge shows a hard horizon against flat navy.
- **No post-processing:** no AO where things meet, no bloom on the things that glow (none glow), and no aerial perspective, so the far table is as crisp as the near.

## Ranked fix list

1. **One lighting model with a real environment.** A CC0 studio HDRI, prefiltered to a PMREM, as `scene.environment`; physically based key and fill intensities; AgX applied once in the output pass; exposure as the single brightness control. Remove the emissive star specks. *Fixes the clay look everywhere.*
2. **Enamel, ceramic and painted-metal materials** with sourced CC0 PBR maps (normal and roughness) and macro variation: glazed ceramic planets with clearcoat, worn painted metal on the depot and dock (edge wear), brass trim, a cardboard parcel with a sourced texture.
3. **Textured star-chart table:** a sourced surface (colour, normal and roughness maps) with the chart printed into the albedo, not emitted.
4. **Ground everything:** brass orrery stands from each planet, rock and dock to the table, and a pedestal under the depot, so contact shadows and AO read.
5. **Post chain:** GTAO, bloom with an HDR threshold (only the parcel beacon and the dock lamps, both carrying real point lights), SMAA, then OutputPass.
6. **A depth-tested dock sign** and shadows fitted to the mission extents and snapped to texels.
7. **Detailed dock and depot geometry:** bevelled parts, a lamp, and a café awning with scalloped edge.
8. **A lower quality tier for phones** (no GTAO, smaller shadow map, lower pixel ratio).

## After (`captures/after/`)

What changed:
- **One lighting model.** A CC0 studio HDRI (`studio_small_09`), prefiltered to a PMREM, is `scene.environment`. The same map, blurred and dimmed, is the backdrop. One warm key light gives shadows fitted to each mission and snapped to texels. AgX is applied once in OutputPass, with exposure as the single brightness control. The hemisphere light and emissive star specks are gone.
- **Materials.** Chipped postal-red enamel (ambientCG PaintedMetal004) on the depot. Cream and teal enamel with rust blooms (PaintedMetal012) on the café hut and pad. Black powder-coat (Metal027) on the barrel and stand feet. Scratched brass trim, stands and awning posts. Battered cardboard (Cardboard001) on the parcel. Scanned rock (Poly Haven rock_face_03) on the debris, each boulder with its own shape and ±10 % tone. Planets are glazed ceramic: painted equirect glaze and roughness maps under a satin clearcoat.
- **Table.** An oiled kitchen-wood frame with a linen sheet (Poly Haven maps) on top. The star chart is printed into the linen's albedo, so the weave's normal, roughness and AO shade it, finished with brass edging.
- **Detail and grounding.** Brass orrery stands with turned feet carry every planet, boulder, dock and the depot to the table. Depot and dock are turned and rounded forms. The café has a scalloped awning, a glazed window and a sign that turns to face the camera and is now depth-tested.
- **Post chain** (adapted from ODD TIDE): half-float MSAA target → GTAO (skipping flat overlays; no second shadow render) → bloom with an HDR threshold and energy clamp → SMAA → OutputPass. Only the café lamp and the parcel beacon exceed the threshold, and each carries a real point light. Aerial perspective uses physical 1 − e^(−σd) haze tinted to the backdrop.
- **Tiers.** Phones and coarse pointers get the low tier: no GTAO, no MSAA, a 1024 shadow map, pixel ratio ≤ 1.5. The high tier drops GTAO if frames stay above ~19 ms for 2 s. `?quality=low|high` forces a tier.

| Axis | wide | hero | closeup | grazing | phone-hero |
| --- | --- | --- | --- | --- | --- |
| Light plausibility | 4 | 4 | 4 | 3 | 4 |
| Materials | 3 | 3 | 3 | 3 | 3 |
| Detail density | 3 | 3 | 3 | 3 | 3 |
| Environment integration | 4 | 4 | 3 | 3 | 4 |
| Atmosphere and depth | 3 | 3 | 3 | 3 | 3 |
| Composition | 4 | 3 | 3 | 3 | 3 |
| Artefacts | 4 | 4 | 3 | 3 | 4 |
| Motion and UI integration | n/a | 3 | n/a | n/a | 3 |
| **Mean** | **3.6** | **3.4** | **3.1** | **3.0** | **3.4** |

Overall: **2.1 → 3.3** (competent indie, edging toward premium in the wide and hero shots).

### Luminance relationships (targets and measured)

Measured as mean sRGB luma (0–255) on `wide.png` crops:

| Region | Target | Baseline | After |
| --- | --- | --- | --- |
| Backdrop (top strip) | darkest, ≤ 0.7 × table | 23 (0.43×) | 50 (0.67×) |
| Chart table (centre) | mid-dark ink, 60–90 | 53 | 74 |
| Moon (hero object) | ≥ 2 × table | 176 (3.3×) | 170 (2.3×) |
| Depot drum | ≥ 2 × table | 179 | 192 (2.6×) |
| Emissive (lamp, beacon) | only pixels over the bloom threshold | none | café lamp and beacon only |

### Remaining flaws (three most visible per bookmark)

- **wide:** (1) The studio backdrop is a plain grey wall with a visible horizon where the blurred HDRI floor meets the wall. (2) The stands' black feet read as holes at this distance. (3) The flat overlay rings (orbits, influence) are unshaded lines that sit on the chart rather than in it. That is legible by design, but they look drawn on.
- **hero:** (1) The HUD's control bar covers the cannon drum. (2) At this distance the café sign is too small to read. (3) The moon's crater arcs repeat visibly (the same stroke shape at many sizes).
- **closeup:** (1) The PaintedMetal012 chips are scaled for a real wall, so on a 0.3-unit hut they read as large rust blotches. (2) The teal pad's clearcoat reads a little glassy. (3) The sign's posts are long and the board is cropped by the frame.
- **grazing:** (1) Behind the moon, the backdrop is a flat mid-grey. (2) The moon and dock stands overlap into twin legs from this angle. (3) There is no contact AO where the stand foot meets the linen at a grazing angle (GTAO radius too small at this scale).
- **phone-hero:** (1) HUD bands take about 35 % of the screen, and the table is squeezed between them. (2) The low tier drops GTAO, so contact under the feet is weaker. (3) The pixel-ratio cap softens the chart's star specks.

### Performance note

SwiftShader (CPU) renders the high tier at 1440×900 in several seconds a frame, and the low tier at 640×400 in about 0.3 s. The end-to-end test therefore uses `?quality=low` and a 300 s budget. On a real GPU both tiers are ordinary forward rendering plus the passes above; adaptive quality drops GTAO if the high tier cannot hold about 52 fps.
