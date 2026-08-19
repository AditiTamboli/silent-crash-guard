import { CONFIG, STORAGE_KEYS } from "../config.js";

export class Score {
  constructor() {
    this.best = Number(localStorage.getItem(STORAGE_KEYS.best) || 0);
    this.reset();
  }

  reset() {
    this.value = 0;
    this.distance = 0; // metres
    this.nearMisses = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboTimer = 0;
    this.newRecord = false;
  }

  update(dt, speed) {
    this.distance += (speed / 3.6) * dt;
    // Faster driving scores faster.
    this.value += dt * (speed / 3.6) * (0.6 + speed / CONFIG.speedMax);
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  registerNearMiss(speed) {
    this.nearMisses++;
    this.combo = Math.min(this.combo + 1, 99);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = CONFIG.comboTimeout;
    const speedBonus = 0.6 + speed / CONFIG.speedMax;
    const gained = Math.round(CONFIG.nearMissPoints * this.combo * speedBonus);
    this.value += gained;
    return gained;
  }

  breakCombo() {
    this.combo = 0;
  }

  finalize() {
    const final = Math.floor(this.value);
    if (final > this.best) {
      this.best = final;
      this.newRecord = true;
      try {
        localStorage.setItem(STORAGE_KEYS.best, String(final));
      } catch (_) {}
    }
    return final;
  }
}
