import { CONFIG } from "../config.js";

// Axis-aligned overlap in lane space (x) and pixel space (y).
export function checkTraffic(player, traffic, road, playerY, onNearMiss) {
  const pw = 0.62;
  const ph = 96;
  for (const v of traffic.active) {
    const dx = Math.abs(v.lane - player.lane);
    const dy = Math.abs(v.y - playerY);
    const overlapX = dx < (pw + v.wRatio) / 2;
    const overlapY = dy < (ph + v.h) / 2;

    if (overlapX && overlapY) return v;

    if (!v.nearMissed && overlapY && dx < CONFIG.nearMissLaneDist) {
      v.nearMissed = true;
      onNearMiss(v);
    }
  }
  return null;
}

export function offRoad(player) {
  return player.lane < -0.34 || player.lane > CONFIG.lanes - 1 + 0.34;
}
