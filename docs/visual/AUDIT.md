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
| Motion and UI integration | 3 | 3 | n/a | n/a | 3 |
| **Mean** | **2.4** | **2.4** | **1.7** | **1.6** | **2.4** |

Overall baseline: **2.1** (tech demo).

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
