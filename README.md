# 🖱️ MouseRush: Traffic Racer

A fast, top-down **endless traffic-dodging arcade game** built for the browser. Weave through five lanes of rush-hour traffic, chain near-misses for combo multipliers, grab nitro and coins, and chase your best score — all driven entirely by a single mouse.

> **Unique Selling Point:** No keyboard, no gamepad, no touch required. The whole game is playable with just a mouse — accelerate, brake, and steer without ever lifting your hand off it. One device, full control.

---

## ✨ Features

- **Mouse-only gameplay** — accelerate, brake, and steer using nothing but the mouse. The entire control surface is built around a single pointing device, so the game feels native on any desktop without needing a keyboard or controller.
- **Endless procedurally-spawning traffic** across a 5-lane highway with a smooth difficulty ramp that scales spawn rate and speed over time.
- **Physics-based steering** with acceleration, braking, coast-drag, and delta-time movement — no instant lane teleportation, just responsive momentum.
- **Near-miss combo system** — squeeze past traffic at speed to bank combo multipliers and rack up huge scores before the combo timer runs out.
- **Pickups & power-ups** — collect coins, trigger **nitro boosts** for a burst of top-speed and acceleration, and spend coins on the **coin cannon** to blast traffic out of your way.
- **Adaptive audio engine** — a procedural Web Audio soundtrack with engine drone, rush swells, pad layers, and melody that reacts to speed and game state, and mutes instantly on crash.
- **Mobile & tilt support** — frame-rate-independent low-pass-filtered tilt steering with calibration and a gentle steering curve, so phones and tablets get the same precise feel.
- **Polished HUD & visuals** — speed, score, best, and combo readouts, lane-accurate collision, scenery, mirrors, rear warnings, and ghost trails.
- **Best-score persistence** — your high score is saved locally and shown in the HUD and game-over screen.
- **Zero backend** — runs entirely client-side; no server, database, or external API. Deployable straight to GitHub Pages, Netlify, or Vercel.

---

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| **Rendering** | HTML5 Canvas + vanilla JavaScript (no game engine) |
| **Game logic** | ES modules, delta-time game loop, procedural Web Audio API |
| **Styling** | CSS3 (custom HUD, overlays, responsive layout) |
| **App shell / hosting** | TanStack Start (React 19 + Vite) — serves the static game |
| **Language** | TypeScript (shell) + JavaScript (game) |
| **Build tool** | Vite |
| **Deployment** | Static — GitHub Pages / Netlify / Vercel |

The game itself is framework-agnostic vanilla JS living under `public/game/`; the TanStack Start shell simply hosts and serves it.

---

## 🚀 Getting Started

```bash
# install dependencies
bun install

# run the dev server
bun run dev

# build for production
bun run build

# preview the production build
bun run preview
```

Then open the printed local URL in your browser and play.

---

## 🎮 The Idea

Most browser racing games force you to juggle a keyboard or on-screen buttons. **MouseRush** flips that: the mouse isn't just a pointer here — it *is* the controller. Hold to manage speed, scroll to steer, and stay in flow the whole time. The result is a racing feel that's uniquely tactile and instantly accessible to anyone with a mouse.

---

## 📁 Project Structure

```
public/game/
├── index.html        # Game markup, HUD, overlays
├── style.css         # HUD + overlay styling
├── config.js         # Centralized tuning (speed, steering, spawns, pickups)
└── js/
    ├── game.js       # Game loop, state machine, crash handling
    ├── player.js     # Player car physics
    ├── traffic.js    # Traffic spawning & AI
    ├── collision.js  # Lane-accurate collision detection
    ├── controls.js   # Mouse + scroll input handling
    ├── mobile.js     # Tilt steering with smoothing & calibration
    ├── audio.js      # Procedural Web Audio engine
    ├── score.js      # Scoring, combos, best-score persistence
    ├── pickups.js    # Coins, nitro, coin cannon
    ├── bullets.js    # Projectile system
    ├── scenery.js    # Roadside scenery
    ├── mirror.js     # Mirror / tint effects
    ├── rearwarn.js   # Rear proximity warnings
    ├── ghost.js      # Ghost trail rendering
    ├── draw.js       # Canvas rendering
    └── ui.js         # Menu, HUD, and overlay UI
```

---

## 🌐 Deployment

The game is fully static and can be deployed anywhere:

- **GitHub Pages** — push `public/` (or the built output) to the `gh-pages` branch.
- **Netlify / Vercel** — connect the repo and deploy; no special config needed.
- **Any static host** — serve the contents of `public/`.

---

Built with **[Lovable](https://lovable.dev)**.
