# PER MY LAST TRANSMISSION

**Status:** v1 is complete and playable. It has eight authored orbital delivery missions, two parcel behaviours (fragile and robust), one launch, one mid-flight brake, a moving receiving dock, an honest trajectory guide, instant retry with the last attempt kept on the chart, saved progress, stamps and an ending memo. Everything runs locally in the browser, with no network calls, accounts or analytics. The app is not deployed.

## How to play

You work for a spectacularly unhelpful interplanetary parcel service. Launch a parcel from the depot so that gravity bends it into the moving receiving dock, and arrive gently enough for the contents to survive.

- **Aim:** drag on the chart away from the depot. Direction sets the angle; distance sets the power. You can also use the sliders or the keyboard (`←/→` or `A/D` for angle, `↑/↓` or `W/S` for power, `Shift` for bigger steps).
- **Read the guide:** the cream dots show the exact route the parcel will take, computed with the same physics as the real flight. The large dots are half a second apart. A brass ring shows where the dock will be when the route passes closest. A red cross means the route ends badly.
- **Launch:** `Space`, `Enter` or the **Launch** button. The planets keep moving while you aim, so timing matters.
- **Brake once:** `B`, `Space` or the **Brake** button during flight. The brass dots preview where braking right now would take you. A braked parcel keeps 40% of its speed.
- **Arrive:** a parcel is delivered when it enters the dock's brass ring more slowly, relative to the dock, than its limit. Fragile parcels (limit 1.3) break on debris. Robust parcels (limit 2.8) ricochet off it.
- **Retry:** `R` at any time, including mid-flight. The clock restarts, so the same inputs reproduce the same flight. Your last route stays on the chart as a red dashed line, with a ring marking where the dock was at your closest pass.
- **Stamps:** Delivered, Gentle (under half the limit), Frugal (within the fuel budget) and Uncorrected (no brake). `M` opens the manifest so you can replay any unlocked mission.

## Development

```sh
bun install --frozen-lockfile
bun run dev        # http://127.0.0.1:4514/
bun run check      # tsc, Biome, bun test, production build into dist/
bun scripts/solve.ts [missionId]   # authoring aid: grid-search a mission for routes
```

- `src/game/`: pure rules and state (physics, prediction, missions, judging, progress, session), covered by `tests/game.test.ts`
- `src/scene/`: the three.js miniature: stage, procedural props, guide paths, debris burst
- `src/ui/`: React HUD, panels and the controller that holds UI state
- `src/main.tsx`: wiring and the frame loop

Every mission has a reference route found by `scripts/solve.ts`, and a test confirms that it delivers.

## Credits

All geometry, textures and graphics are generated procedurally in code. No external assets are used. Libraries: three.js, React, GSAP, Tailwind CSS. Type uses the system font stack.
