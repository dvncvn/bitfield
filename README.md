# mg

Generative pixel grid. Part visualizer, part instrument, part mood.

Black and white by default. Color if you want it. Text that glitches. Patterns that breathe. Everything loops. Everything is deterministic. Same seed, same world — always.

Auto-advances through seeds with variable timing. Calm interstitials surface between the chaos. A rotating metadata ring tracks the state. It runs itself, or you drive it.

---

Built in the spirit of constraint. Inspired by the formal language of artists like [Kim Asendorf](https://kimasendorf.com/) — the monochrome grid, the binary field, the aliveness in simplicity. Nothing here reproduces that work. The system, the rules, the rendering — all original. What's shared is a feeling: pixels doing something they shouldn't be able to do.

---

## Run

```bash
npm install
npm run dev
```

## Controls

Hidden by default. `Cmd + .` to open.

| | |
|---|---|
| `Space` | play / pause |
| `← →` | walk seeds |
| `↑ ↓` | resolution (shift: big steps) |
| `[ ]` | subdivision (shift: big steps) |
| `+ -` | zoom in / out |
| `0` | reset zoom |
| `A` | toggle auto-advance |
| `R` | randomize everything |
| `C` | randomize colors |
| `T` | toggle text overlay |
| `F` | toggle frame mode |
| `S` | save PNG |
| `Cmd + .` | show / hide UI |

Resolution, scale, subdivision, density, noise, warp, speed, period. BPM sync with tap tempo. Mouse lens (hover attracts, click repels). Auto-advance with interval + variance. Frame mode with aspect ratio, shape, and background. Generative text with glitch animation. All state in the URL.

## How It Works

A seed determines everything. The canvas subdivides into rectangles via binary space partitioning. Each rectangle gets a fill rule — noise, dither, automata, reaction-diffusion, lines, streaks, columns, dots, checkers, gradient. Time loops on a circle. Events fire at predetermined moments. A scanning warp displaces pixels. Mouse proximity distorts space. Zoom resamples the grid buffer from center.

~15% of seeds are calm interstitials — single rule, minimal subdivision, no events. Breathing room.

All randomness flows from a single 32-bit PRNG. No `Math.random()` in the render path. The canvas runs at grid resolution with CSS `image-rendering: pixelated` for that raw pixel aesthetic.

Text overlay generates cryptic words, symbols, and short messages from the seed, with character-level glitch animation using ASCII substitutions.

## Structure

```
src/
  prng.ts          deterministic randomness
  loop.ts          periodic time, looping noise
  subdivide.ts     recursive partitioning
  variant.ts       seed → configuration (+ calm interstitials)
  events.ts        scheduled disruptions
  renderer.ts      pixel-level blitting + zoom + mouse distortion
  gentext.ts       generative text + glitch animation
  ui.ts            controls, keyboard, auto-advance, frame mode
  export.ts        png + webm
  rules/
    noise.ts       threshold fields
    dither.ts      bayer patterns
    automata.ts    cellular life
    reaction.ts    diffusion approximation
    lines.ts       parallel lines
    streak.ts      scan-line banding
    columns.ts     vertical stripes
    dots.ts        dot grids
    checker.ts     checkerboard / brick
    gradient.ts    error-diffused gradient
```

## Build

```bash
npm run build
npm run preview
```
