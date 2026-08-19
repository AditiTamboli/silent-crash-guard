// Ghost Rival — records the player's best run locally and replays it as a
// semi-transparent, non-colliding car. Pure localStorage, no backend.
import { CONFIG, STORAGE_KEYS } from "../config.js";
import { drawVehicle } from "./draw.js";

// metres -> pixels (speed km/h * pxPerKmh px/s == (speed/3.6) m/s)
export const PX_PER_M = CONFIG.pxPerKmh * 3.6;

const SAMPLE_INTERVAL = 0.1; // seconds between recorded samples
const MAX_SAMPLES = 6000; // ~10 minutes of run

export class GhostSystem {
  constructor() {
    this.best = null; // { score, distance, samples: [t, lane, dist, speed][] }
    this.load();
    this.reset();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ghost);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.samples) && data.samples.length > 1) {
        this.best = data;
      }
    } catch (_) {
      this.best = null;
    }
  }

  reset() {
    this.samples = [];
    this.sampleTimer = 0;
    this.cursor = 0;
    this.active = false; // a ghost is being replayed
    this.lane = 1.5;
    this.dist = 0;
    this.finished = false; // ghost run ended (crashed earlier than player)
    this.beatAnnounced = false;
    this.delta = 0;
  }

  startRun() {
    this.reset();
    this.active = Boolean(this.best);
  }

  get bestScore() {
    return this.best ? this.best.score : 0;
  }

  // ------------------------------------------------------------- recording
  record(runTime, dt, lane, distance, speed) {
    this.sampleTimer -= dt;
    if (this.sampleTimer > 0 || this.samples.length >= MAX_SAMPLES) return;
    this.sampleTimer = SAMPLE_INTERVAL;
    this.samples.push([
      Math.round(runTime * 100) / 100,
      Math.round(lane * 1000) / 1000,
      Math.round(distance * 10) / 10,
      Math.round(speed),
    ]);
  }

  // --------------------------------------------------------------- replay
  update(runTime, playerDistance) {
    if (!this.active || !this.best) return;
    const s = this.best.samples;
    while (this.cursor < s.length - 2 && s[this.cursor + 1][0] <= runTime) this.cursor++;
    const a = s[this.cursor];
    const b = s[this.cursor + 1];
    if (!b) {
      this.finished = true;
      this.lane = a[1];
      this.dist = a[2];
    } else {
      const span = b[0] - a[0] || 1;
      const t = Math.max(0, Math.min(1, (runTime - a[0]) / span));
      this.lane = a[1] + (b[1] - a[1]) * t;
      this.dist = a[2] + (b[2] - a[2]) * t;
    }
    this.delta = playerDistance - this.dist;
  }

  // Screen Y for the ghost — ahead of the player when it has more distance.
  screenY(playerY, playerDistance) {
    return playerY - (this.dist - playerDistance) * PX_PER_M;
  }

  draw(ctx, road, playerY, playerDistance) {
    if (!this.active || this.finished) return;
    const y = this.screenY(playerY, playerDistance);
    if (y < -160 || y > road.height + 160) return;
    ctx.save();
    ctx.globalAlpha = 0.38;
    drawVehicle(ctx, road.laneToX(this.lane), y, road.laneW * 0.62, 96, {
      color: "#9fd8ff",
      type: "car",
      lightsOn: false,
      tilt: 0,
    });
    ctx.restore();
  }

  // Called at the end of a run. Returns true when a new ghost was stored.
  finalize(finalScore, distance) {
    if (this.samples.length < 2) return false;
    if (this.best && finalScore <= this.best.score) return false;
    const data = { score: finalScore, distance, samples: this.samples };
    try {
      localStorage.setItem(STORAGE_KEYS.ghost, JSON.stringify(data));
    } catch (_) {
      return false;
    }
    this.best = data;
    return true;
  }
}
