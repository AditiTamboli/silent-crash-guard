// Mirror Mode — a rare event that only reverses the interpretation of the
// steering wheel input. Physics, traffic and pedals are untouched.
const DURATION = 10;
const FIRST_DELAY_MIN = 14;
const FIRST_DELAY_MAX = 24;
const DELAY_MIN = 35;
const DELAY_MAX = 60;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export class MirrorMode {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.time = 0;
    this.timer = rand(FIRST_DELAY_MIN, FIRST_DELAY_MAX);
  }

  get duration() {
    return DURATION;
  }

  // Returns "start" | "end" | null so the caller can drive UI + audio.
  update(dt) {
    if (this.active) {
      this.time -= dt;
      if (this.time <= 0) {
        this.active = false;
        this.time = 0;
        this.timer = rand(DELAY_MIN, DELAY_MAX);
        return "end";
      }
      return null;
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.active = true;
      this.time = DURATION;
      return "start";
    }
    return null;
  }
}
