# Highway Hustle

Build: TRAFFIC RUSH

Create a polished, addictive 2D top-down endless traffic-dodging browser game using HTML5 Canvas + vanilla JavaScript + CSS. No backend, database, React, or unnecessary libraries. It must run entirely client-side and be deployable to GitHub Pages/Netlify/Vercel.

Core Gameplay

Player drives continuously forward on a 4-lane highway and tries to survive as long as possible while avoiding traffic.

Controls:

Right-handed:

Hold Right Click → Accelerate

Hold Left Click → Brake

Scroll UP → Move Left

Scroll DOWN → Move Right

Left-handed:

Hold Right Click → Accelerate

Hold Left Click → Brake

Scroll UP → Move Right

Scroll DOWN → Move Left

Steering must be smooth, not instant lane teleportation. Use acceleration/braking with delta-time and responsive movement.

The game is desktop/mouse-focused.

Browser Input Protection

During active gameplay:

Right click must NOT open the context menu.

Mouse wheel must NOT scroll the page.

Prevent default contextmenu and wheel behavior on the game canvas.

Use {passive:false} for wheel handling.

Prevent stuck acceleration/braking when the window loses focus, tab changes, game pauses, or game ends.

ESC pauses the game and releases gameplay input.

Restore normal browser behavior outside active gameplay.

Do NOT attempt to disable F12, DevTools, Ctrl+Shift+I, etc.; browser-level controls must remain normal.

Use overflow:hidden for the game page during gameplay.

Visuals

Stylized clean arcade graphics. Top-down road with:

Asphalt

Lane markings

Roadside environment

Player car

Traffic cars

Use lightweight Canvas/procedural graphics where possible. No copyrighted assets.

Keep player near the lower-middle while road/traffic move downward to simulate forward movement.

Traffic

Include at least:

Normal car

Fast/aggressive car

Truck

Bus

Motorcycle

Traffic should have slightly different speeds and simple personalities:

Normal cars mostly maintain lanes.

Aggressive cars occasionally change lanes.

Trucks/buses are slower and wider.

Motorcycles are fast and narrow.

Spawn traffic safely; never create impossible unavoidable situations. Always provide a reasonable escape route.

Difficulty

Gradually increase:

Traffic density

Traffic speed

Lane changes

Vehicle variety

Avoid unfair difficulty.

Near-Miss System

If the player passes very close to traffic without collision:

NEAR MISS +100

Consecutive near misses create:

×2 → ×3 → ×4 → ...

Show satisfying text/effects/sound. Reset combo after a crash or timeout.

Random Road Events

Occasionally trigger simple events such as:

Construction zone

Dense traffic

Police car

Truck convoy

Oil spill

Events should mostly modify existing traffic/spawn/speed behavior rather than introduce complex systems.

Weather & Time

Add lightweight visual variations:

Day

Sunset

Night

Rain

Use simple visual effects/background changes; no complex weather simulation.

Replay/Run Progression

After Game Over show:

Distance

Score

Near misses

Best combo

Best score

Store best score locally with localStorage.

Clearly show NEW RECORD! when appropriate and provide PLAY AGAIN for a fast restart.

The game should encourage a strong “one more run” loop.

Score

Score should depend on:

Distance

Speed

Near misses

Combo

Higher speed and risky near-misses should reward more points.

UI

Main menu:

TRAFFIC RUSH
How long can you survive?

Buttons:

Play

Controls

Settings

HUD:

Score

Speed

Distance

Combo

Best score

Settings:

Right/Left-handed controls

Master/SFX/music volume

Save settings locally.

Audio & Effects

Add lightweight:

Engine sound

Brake sound

Near-miss sound

Crash sound

UI sounds

Also add:

Speed lines

Brake lights

Small particles

Near-miss popup

Crash screen shake

Start audio only after user interaction.

Game States

Use:

MENU → READY → PLAYING → PAUSED → CRASH → GAME OVER

Keep state management clean.

Performance

Target 60 FPS on normal laptops.

Use:

requestAnimationFrame

Delta time

Object pooling

Efficient collision detection

Minimal DOM manipulation

Reusable traffic objects

Avoid unnecessary physics engines and expensive per-frame operations.

Code Structure

Keep code modular and beginner-friendly:

index.html
style.css
game.js
config.js
js/
  controls.js
  player.js
  traffic.js
  collision.js
  score.js
  ui.js
  audio.js


Use centralized configuration for speed, acceleration, traffic density, steering, near-miss distance, etc.

Development Process

Build incrementally and test after every stage:

Canvas + road + player + game loop

Mouse controls + handedness

Traffic + spawning

Collision + Game Over

Score + distance + near-miss combo

Difficulty + traffic personalities

Random events + weather/time

Menu + settings + high score

Audio + effects + polish

Performance testing + deployment

Do not build everything in one huge step. Fix console errors and test each milestone before continuing.

Final Requirement

The result should feel like a small finished arcade game, not a technical demo.

Core loop:

Accelerate → Dodge → Near Miss → Build Combo → Survive → Increasing Difficulty → Crash → See Score → Play Again

Prioritize:

Fun + responsiveness + fairness + performance + clean code.

Do not add multiplayer, accounts, backend, database, online leaderboard, 3D, or complex physics unless explicitly requested later.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2102d79d-eddf-45fb-876d-d30a0cc7f2ce).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
