import { CONFIG } from "../config.js";

// Straight-firing coin rounds that burst vehicles ahead in the lane.
export class BulletSystem {
  constructor() {
    this.list = [];
    this._trail = null;
  }

  reset() {
    this.list.length = 0;
  }

  fire(lane, y) {
    this.list.push({ lane, y, life: 2 });
  }

  update(dt, traffic, onKill) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.y -= CONFIG.bulletSpeed * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.y < -200;

      for (let j = traffic.active.length - 1; j >= 0; j--) {
        const v = traffic.active[j];
        if (Math.abs(v.lane - b.lane) > 0.55) continue;
        if (Math.abs(v.y - b.y) < v.h / 2 + 30) {
          onKill(v);
          traffic._release(v);
        }
      }

      if (dead) this.list.splice(i, 1);
    }
  }

  draw(ctx, road) {
    for (const b of this.list) {
      const x = road.laneToX(b.lane);
      ctx.save();
      ctx.translate(x, b.y);
      if (!this._trail) {
        const g = ctx.createLinearGradient(0, -60, 0, 30);
        g.addColorStop(0, "rgba(255,220,120,0)");
        g.addColorStop(1, "rgba(255,220,120,0.85)");
        this._trail = g;
      }
      ctx.fillStyle = this._trail;
      ctx.fillRect(-6, -60, 12, 90);
      ctx.restore();
      ctx.fillStyle = "#fff3c4";
      ctx.beginPath();
      ctx.ellipse(x, b.y, 7, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
