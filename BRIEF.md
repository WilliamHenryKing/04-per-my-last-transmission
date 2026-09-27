# PER MY LAST TRANSMISSION — v1 brief for a cloud build session

You are building this project's v1 in one focused session. Ship a small, polished, complete experience — not a prototype and not a sprawling one. Read this brief once, write a plan of 5–10 lines, then build. Stop when the definition of done is met.

## The idea

**04 — PER MY LAST TRANSMISSION.** Build aim/power/launch, a readable and honest path prediction, one limited correction, a moving receiving dock and arrival-speed consequences. Develop approximately eight short authored missions and two parcel behaviours. Use immediate retry, useful previous-attempt feedback and dry parcel-service humour. Finish a complete mission progression and ending. Begin with one gravity well and one moving receiver before adding complexity.

### G1. PER MY LAST TRANSMISSION

**Space, dry humour, orbital delivery puzzles.**

You work for a spectacularly unhelpful interplanetary parcel service. The planets keep moving; customer service insists this should not affect delivery.

**What you do:** aim a launch, choose its power and release a parcel into a small gravitational system. A limited mid-flight brake gives you one correction. Use gravity to bend its route towards a moving receiving dock and arrive gently enough for the contents.

The accessible presentation is a 3D miniature solar system, but the flight can initially be constrained to a readable plane. This keeps aiming understandable and the scope manageable.

**First playable moment:** deliver a mug to a café orbiting a small moon. A direct launch is pulled off course. Following the visible curved prediction puts the parcel on a useful trajectory. Launching at the right moment and braking before arrival earns an immensely officious delivery stamp.

**Depth:** launch timing, path, arrival speed and a limited correction interact. Start with one gravity well, then introduce a moving receiver, an obstruction and a second gravity influence. Fragile and robust parcels change what counts as a good arrival.

**Humour:** “Just circling back” appears on a second orbit. A rejected parcel is stamped “Arrived with excessive enthusiasm.” Mission notes insist that “This could have been a wormhole.”

**Why replay:** solve a route with less fuel, fewer corrections or a gentler arrival. Show the path of the last attempt so the player can learn rather than guess.

**Small complete version:** eight authored missions, two parcel types, one launch mechanic, one correction and clear retry controls. No explorable galaxy or full spacecraft simulation.

**What would ruin it:** unpredictable physics, an unreadable trajectory, long waits after a mistake, or prose that delays every launch.

**First proof:** one launch, one moon, one moving dock. The trajectory guide is honest, the near miss is legible and the reset is immediate.

Art direction: **PER MY LAST TRANSMISSION:** crisp miniature planets, enamel machinery, battered parcel surfaces and witty postal graphics.

## Definition of done (v1)

1. One focused scene delivering the idea above, with a complete loop: start → core interaction → a visible result or ending → replay. A short first-time hint teaches the controls in place.
2. Arrival loader: keep the veil in `index.html` and `src/loader.ts`; restyle the veil to the art direction and call `worldReady()` after the first rendered frame.
3. Desktop (1440×900) and phone (390×844) layouts; mouse, touch and keyboard; honour `prefers-reduced-motion`; visible focus and labelled controls.
4. `bun run check` passes: strict `tsc`, Biome, `bun test`, production build into `dist/`.
5. Unit tests of the game rules (pure TypeScript, no DOM) replace `tests/scaffold.test.ts`.
6. `README.md`: one status paragraph, how to play, and credits for any asset used.
No extra modes, settings screens, accounts, leaderboards, backends, analytics or network calls.

## Technical rules

- The stack is installed and pinned: Vite, React, strict TypeScript, three.js 0.186 (direct, no React Three Fiber), GSAP, Tailwind v4, Biome, Bun. Add a dependency only if essential, pinned exactly.
- `bun run dev` serves the real app (`index.html` → `src/main.tsx`); `bun run build` builds it into `dist/`. `development/` is old tooling: leave it alone.
- Single responsibility: `src/game/` pure rules and state (tested), `src/scene/` three.js scene, camera, lights and meshes, `src/ui/` React HUD and panels, `src/main.tsx` wiring. Files under ~300 lines.
- Visuals: author forms procedurally in code (geometry, instancing, small shaders where they clearly help), AgX or ACES tone mapping, one key light plus hemisphere or environment light, soft shadows where cheap, a cohesive palette and strong silhouettes. Type: a system font stack. External assets only if CC0 or public domain, with the source in README.
- Performance: 60 fps on a mid laptop; cap devicePixelRatio at 2.
- Do not change `wrangler.jsonc`, deploy or publish anything.

## Working method

- There is no GPU here. Do not loop on screenshots: at most two headless checks (desktop, phone) if Chromium is available (software WebGL is fine).
- Commit in small, clear steps. Finish with a message: what was built, how to play, known gaps.
