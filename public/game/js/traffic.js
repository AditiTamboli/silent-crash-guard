import { CONFIG } from "../config.js";
import { drawVehicle } from "./draw.js";

const TYPES = ["car", "aggressive", "truck", "bus", "moto"];

function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

export class TrafficSystem {
  constructor() {
    this.pool = [];
    this.active = [];
    this.spawnTimer = 0.8;
    this.modifiers = { rateMul: 1, speedMul: 1, forceType: null, laneBlocked: -1 };
  }

  reset() {
    while (this.active.length) this.pool.push(this.active.pop());
    this.spawnTimer = 0.8;
    this.modifiers = { rateMul: 1, speedMul: 1, forceType: null, laneBlocked: -1 };
  }

  _obtain() {
    return this.pool.pop() || {};
  }

  _release(v) {
    const i = this.active.indexOf(v);
    if (i >= 0) this.active.splice(i, 1);
    this.pool.push(v);
  }

  pickType(difficulty) {
    if (this.modifiers.forceType) return this.modifiers.forceType;
    const pool = [];
    for (const t of TYPES) {
      let w = CONFIG.vehicles[t].weight;
      if (t === "aggressive") w *= 0.4 + difficulty * 1.4;
      if (t === "moto") w *= 0.5 + difficulty;
      for (let i = 0; i < Math.max(1, Math.round(w)); i++) pool.push(t);
    }
    return pick(pool);
  }

  // Returns true when a lane is clear enough for a new vehicle.
  laneIsFree(lane, y, height) {
    for (const v of this.active) {
      if (Math.abs(v.lane - lane) > 0.85) continue;
      const gap = Math.abs(v.y - y) - (v.h + height) / 2;
      if (gap < 150) return false;
    }
    return true;
  }

  countLanesOccupiedNear(y, band) {
    const set = new Set();
    for (const v of this.active) {
      if (Math.abs(v.y - y) < band) set.add(Math.round(v.lane));
    }
    return set;
  }

  spawn(type, lane, y, speed) {
    const def = CONFIG.vehicles[type];
    const v = this._obtain();
    v.type = type;
    v.lane = lane;
    v.targetLane = lane;
    v.laneVel = 0;
    v.y = y;
    v.h = def.h;
    v.wRatio = def.w;
    v.speed = speed ?? def.minSpeed + Math.random() * (def.maxSpeed - def.minSpeed);
    v.speed *= this.modifiers.speedMul;
    v.color = pick(CONFIG.palettes[type]);
    v.changeTimer = 2 + Math.random() * 5;
    v.scored = false;
    v.nearMissed = false;
    v.siren = type === "police" ? 0.001 : 0;
    this.active.push(v);
    return v;
  }

  trySpawn(difficulty, playerSpeed) {
    const spawnY = -260;
    const lanes = [];
    for (let l = 0; l < CONFIG.lanes; l++) {
      if (l === this.modifiers.laneBlocked) continue;
      if (this.laneIsFree(l, spawnY, 180)) lanes.push(l);
    }
    if (!lanes.length) return;

    // Fairness: never leave the player without an escape lane ahead.
    const occupied = this.countLanesOccupiedNear(spawnY, 320);
    if (this.modifiers.laneBlocked >= 0) occupied.add(this.modifiers.laneBlocked);
    if (occupied.size >= CONFIG.lanes - 1) return;

    const lane = pick(lanes);
    const type = this.pickType(difficulty);
    const v = this.spawn(type, lane, spawnY);
    // Keep traffic slower than a flat-out player so dodging stays possible.
    v.speed = Math.min(v.speed, playerSpeed * 0.95 + 30);
  }

  update(dt, difficulty, player, road) {
    const rate =
      CONFIG.spawnBaseInterval - (CONFIG.spawnBaseInterval - CONFIG.spawnMinInterval) * difficulty;
    this.spawnTimer -= dt * this.modifiers.rateMul;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = rate * (0.7 + Math.random() * 0.6);
      this.trySpawn(difficulty, player.speed);
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const v = this.active[i];
      v.y += (player.speed - v.speed) * CONFIG.pxPerKmh * dt;

      // Personalities
      if (v.type === "aggressive" || v.type === "moto" || v.type === "police") {
        v.changeTimer -= dt;
        if (v.changeTimer <= 0) {
          v.changeTimer = 2.5 + Math.random() * 4;
          const dir = Math.random() < 0.5 ? -1 : 1;
          const next = Math.max(0, Math.min(CONFIG.lanes - 1, Math.round(v.targetLane) + dir));
          if (next !== this.modifiers.laneBlocked && this.laneIsFree(next, v.y, v.h)) {
            v.targetLane = next;
          }
        }
      }
      const diff = v.targetLane - v.lane;
      v.laneVel += diff * 22 * dt;
      v.laneVel *= Math.pow(0.85, dt * 60);
      v.lane += v.laneVel * dt;
      if (v.siren) v.siren += dt;

      if (v.y > road.height + 320 || v.y < -1400) this._release(v);
    }
  }

  draw(ctx, road, night) {
    for (const v of this.active) {
      drawVehicle(ctx, road.laneToX(v.lane), v.y, road.laneW * v.wRatio, v.h, {
        color: v.color,
        type: v.type === "aggressive" || v.type === "police" ? "car" : v.type,
        lightsOn: night,
        siren: v.siren,
        tilt: Math.max(-0.12, Math.min(0.12, v.laneVel * 0.04)),
      });
    }
  }
}
