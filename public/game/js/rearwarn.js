// Rear-view warning — derived entirely from the existing traffic array.
// Flags genuinely faster vehicles closing in from behind the player.
const MIN_SPEED_DELTA = 22; // km/h faster than the player
const MAX_TTC = 2.6; // seconds until it reaches the player
const CLEAR_TTC = 3.2; // hysteresis so the arrow doesn't flicker

export class RearWarning {
  constructor() {
    this.reset();
  }

  reset() {
    this.left = 0; // 0..1 intensity
    this.right = 0;
    this.soundCooldown = 0;
  }

  // Returns true when a fresh warning appeared (caller may play a sound).
  update(dt, traffic, player, playerY) {
    const prev = Math.max(this.left, this.right);
    let left = 0;
    let right = 0;

    for (const v of traffic.active) {
      const behind = v.y - playerY; // positive == behind the player
      if (behind < 30 || behind > 1100) continue;
      const delta = v.speed - player.speed;
      if (delta < MIN_SPEED_DELTA) continue;
      const closingPxPerSec = delta * 2.3; // CONFIG.pxPerKmh
      const ttc = (behind - 60) / closingPxPerSec;
      const limit = prev > 0 ? CLEAR_TTC : MAX_TTC;
      if (ttc < 0 || ttc > limit) continue;
      const intensity = Math.max(0.15, Math.min(1, 1 - ttc / limit));
      if (v.lane <= player.lane) left = Math.max(left, intensity);
      else right = Math.max(right, intensity);
    }

    this.left = left;
    this.right = right;
    this.soundCooldown = Math.max(0, this.soundCooldown - dt);

    const now = Math.max(left, right);
    if (now > 0 && prev === 0 && this.soundCooldown === 0) {
      this.soundCooldown = 1.6;
      return true;
    }
    return false;
  }
}
