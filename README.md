# PER MY LAST TRANSMISSION

**Status:** v1 is complete and playable. It has eight authored orbital delivery missions, two parcel behaviours (fragile and robust), one launch, one mid-flight brake, a moving receiving dock, an honest trajectory guide, instant retry with the last attempt kept on the chart, saved progress, stamps, an ending memo and sound: hold music while you aim, a space ambience bed and effects for every meaningful event. Everything runs locally in the browser, with no network calls, accounts or analytics. The app is not deployed.

## How to play

You work for a spectacularly unhelpful interplanetary parcel service. Launch a parcel from the depot so that gravity bends it into the moving receiving dock, and arrive gently enough for the contents to survive.

- **Aim:** drag on the chart away from the depot. Direction sets the angle; distance sets the power. You can also use the sliders or the keyboard (`←/→` or `A/D` for angle, `↑/↓` or `W/S` for power, `Shift` for bigger steps).
- **Read the guide:** the cream dots show the exact route the parcel will take, computed with the same physics as the real flight. The large dots are half a second apart. A brass ring shows where the dock will be when the route passes closest. A red cross means the route ends badly.
- **Launch:** `Space`, `Enter` or the **Launch** button. The planets keep moving while you aim, so timing matters.
- **Brake once:** `B`, `Space` or the **Brake** button during flight. The brass dots preview where braking right now would take you. A braked parcel keeps 40% of its speed.
- **Arrive:** a parcel is delivered when it enters the dock's brass ring more slowly, relative to the dock, than its limit. Fragile parcels (limit 1.3) break on debris. Robust parcels (limit 2.8) ricochet off it.
- **Retry:** `R` at any time, including mid-flight. The clock restarts, so the same inputs reproduce the same flight. Your last route stays on the chart as a red dashed line, with a ring marking where the dock was at your closest pass.
- **Rating:** each mission earns 1–3 stamps: Delivered, Gentle (contents intact, under half the arrival limit) and Frugal (fuel within the budget). Your best is saved and shown in the manifest, and the ending memo summarises it. `L` opens the manifest so you can replay any unlocked mission.
- **Sound:** audio starts on your first click, tap or key press. `M` or the **Sound** button mutes, and the setting is remembered. Opening the manifest or hiding the tab pauses the audio.

## Development

```sh
bun install --frozen-lockfile
bun run dev        # http://127.0.0.1:4514/
bun run check      # tsc, Biome, bun test, production build into dist/
bun run test:e2e   # Playwright: builds, serves on 4614, delivers mission 1 via the real UI
bun scripts/solve.ts [missionId]   # authoring aid: grid-search a mission for routes
```

- `src/game/`: pure rules and state (physics, prediction, missions, judging, progress, session), covered by `tests/game.test.ts`
- `src/scene/`: the three.js miniature: stage, procedural props, guide paths, debris burst
- `src/audio/`: sound manifest and cue mapping (pure, tested) and the Web Audio engine
- `src/ui/`: React HUD, panels and the controller that holds UI state
- `src/main.tsx`: wiring and the frame loop

Every mission has a reference route found by `scripts/solve.ts`, and a test confirms that it delivers. The end-to-end test (`e2e/mission-one.e2e.ts`) runs headless with SwiftShader. It pauses the page clock and reads a read-only probe exposed only with `?e2e`, so its key presses land within the route's timing tolerance, then checks the delivered result card.

## Credits

All geometry, textures and graphics are generated procedurally in code. Libraries: three.js, React, GSAP, Tailwind CSS. Type uses the system font stack.

### Audio

All audio is in `public/audio/`, re-encoded to MP3 (about 2.5 MB in total). Every file is CC0 (public domain dedication: https://creativecommons.org/publicdomain/zero/1.0/), so attribution is not required but is given here.

| File(s) | Source | Author | Licence |
| --- | --- | --- | --- |
| `music-hold.mp3` ("Elevator Music") | https://opengameart.org/content/elevator-music | Pro Sensory | CC0 |
| `ambience-space.mp3` ("Observing The Star", from "Another space background track") | https://opengameart.org/content/another-space-background-track | yd | CC0 |
| `launch-whoosh`, `flight-hum`, `crashed` | Sci-fi Sounds, https://kenney.nl/assets/sci-fi-sounds | Kenney | CC0 |
| `launch-clunk`, `bounce`, `stamp`, `rejected` | Impact Sounds, https://kenney.nl/assets/impact-sounds | Kenney | CC0 |
| `ui-click`, `ui-tick`, `ui-open`, `ui-close`, `ui-toggle`, `ui-retry`, `ui-next`, `circled` | Interface Sounds, https://kenney.nl/assets/interface-sounds | Kenney | CC0 |
| `brake`, `lost` | Digital Audio, https://kenney.nl/assets/digital-audio | Kenney | CC0 |
| `delivered`, `ending` | Music Jingles, https://kenney.nl/assets/music-jingles | Kenney | CC0 |

The original file names are `ElevatorMusic.wav`, `ObservingTheStar.ogg`, `thrusterFire_000`, `spaceEngineLow_000`, `explosionCrunch_000`, `impactMetal_heavy_000`, `impactPlate_medium_000`, `impactWood_heavy_001`, `impactGlass_heavy_002`, `click_002`, `tick_002`, `open_001`, `close_001`, `switch_002`, `back_001`, `confirmation_001`, `question_001`, `phaserDown2`, `lowDown`, `jingles_STEEL00` and `jingles_SAX03`. Kenney's licence text is CC0 in each pack's `License.txt`. The OpenGameArt licences were read from each page's licence field.
