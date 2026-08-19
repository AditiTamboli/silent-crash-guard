import { CONFIG } from "../config.js";

// Coins and nitro canisters that scroll down the road with traffic.
export class PickupSystem {
  constructor() {
    this.items = [];
    this.coinTimer = CONFIG.coinSpawnInterval;
    this.nitroTimer = CONFIG.nitroSpawnInterval;
  }

  reset() {
    this.items.length = 0;
    this.coinTimer = 2;
    this.nitroTimer = CONFIG.nitroSpawnInterval;
  }

  spawnCoinRun() {
    const lane = (Math.random() * CONFIG.lanes) | 0;
    const n = 3 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      this.items.push({ kind: "coin", lane, y: -140 - i * 62, spin: Math.random() * 6 });
    }
  }

  spawnNitro() {
    this.items.push({
      kind: "nitro",
      lane: (Math.random() * CONFIG.lanes) | 0,
      y: -180,
      spin: 0,
    });
  }

  update(dt, scrollSpeed, road) {
    this.coinTimer -= dt;
    if (this.coinTimer <= 0) {
      this.coinTimer = CONFIG.coinSpawnInterval * (0.7 + Math.random() * 0.8);
      this.spawnCoinRun();
    }
    this.nitroTimer -= dt;
    if (this.nitroTimer <= 0) {
      this.nitroTimer = CONFIG.nitroSpawnInterval * (0.75 + Math.random() * 0.7);
      this.spawnNitro();
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.y += scrollSpeed * dt;
      it.spin += dt * 5;
      if (it.y > road.height + 120) this.items.splice(i, 1);
    }
  }

  // Returns the list of collected items and removes them.
  collect(playerLane, playerY) {
    const got = [];
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (Math.abs(it.y - playerY) < 56 && Math.abs(it.lane - playerLane) < 0.5) {
        got.push(it);
        this.items.splice(i, 1);
      }
    }
    return got;
  }

  draw(ctx, road) {
    for (const it of this.items) {
      const x = road.laneToX(it.lane);
      if (it.kind === "coin") {
        const w = 10 + Math.abs(Math.cos(it.spin)) * 8;
        ctx.fillStyle = "#f7c948";
        ctx.beginPath();
        ctx.ellipse(x, it.y, w, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,240,180,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(x, it.y);
        ctx.fillStyle = "#3ad2ff";
        ctx.beginPath();
        ctx.roundRect(-12, -20, 24, 40, 8);
        ctx.fill();
        ctx.fillStyle = "#062232";
        ctx.font = "700 18px 'Rajdhani', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("N", 0, 7);
        ctx.restore();
      }
    }
  }
}
