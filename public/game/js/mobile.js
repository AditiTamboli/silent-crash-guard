// Mobile mode: tilt steering (with calibration + dead zone), touch/swipe
// fallback and on-screen ACCELERATE / BRAKE buttons.
const DEAD_ZONE = 0.06; // fraction of the tilt range ignored around neutral
const MAX_TILT_DEG = 30; // tilt angle that maps to full steering
const SWIPE_RANGE = 110; // px of horizontal drag that maps to full steering
const RAW_SMOOTH_HZ = 9; // low-pass on noisy sensor readings
const OUT_SMOOTH_HZ = 7; // low-pass on the final steering value


export function isTouchDevice() {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0)
  );
}

export class MobileInput {
  constructor(controls) {
    this.controls = controls;
    this.enabled = false;
    this.source = "none"; // "tilt" | "touch"
    this.raw = 0;
    this.rawSmooth = 0;
    this.neutral = 0;
    this.tilt = 0;
    this.out = 0;
    this.lastT = 0;
    this.touchStartX = null;
    this.touchTilt = 0;
    this.pad = null;
    this.swipeOnly = false;


    this._onOrientation = (e) => {
      if (e.gamma === null && e.beta === null) return;
      const portrait = Math.abs(window.orientation || 0) !== 90;
      const angle = portrait ? (e.gamma ?? 0) : -(e.beta ?? 0) * Math.sign(window.orientation || 1);
      this.raw = angle;
      if (this.source !== "tilt") {
        this.source = "tilt";
        this.calibrate();
      }
    };

  }

  mount() {
    this.pad = document.getElementById("mobile-pad");
    if (!this.pad) return;
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const down = (e) => {
        e.preventDefault();
        this.controls[key] = true;
        this.controls._syncPedals();
        el.classList.add("down");
      };
      const up = (e) => {
        e.preventDefault();
        this.controls[key] = false;
        this.controls._syncPedals();
        el.classList.remove("down");
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
    };
    bind("btn-accel-touch", "_touchAccel");
    bind("btn-brake-touch", "_touchBrake");
    const cal = document.getElementById("btn-calibrate");
    if (cal) {
      cal.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.calibrate();
      });
    }
    const nitro = document.getElementById("btn-nitro-touch");
    if (nitro) {
      nitro.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.controls.nitroRequest = true;
      });
    }

    // Touch / swipe steering fallback (also usable alongside tilt).
    const surface = document.getElementById("touch-steer");
    if (surface) {
      surface.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          this.touchStartX = e.touches[0].clientX;
          this.touchTilt = 0;
        },
        { passive: false },
      );
      surface.addEventListener(
        "touchmove",
        (e) => {
          e.preventDefault();
          if (this.touchStartX === null) return;
          const dx = e.touches[0].clientX - this.touchStartX;
          this.touchTilt = Math.max(-1, Math.min(1, dx / SWIPE_RANGE));
          if (this.source !== "tilt") this.source = "touch";
        },
        { passive: false },
      );
      const end = (e) => {
        e.preventDefault();
        this.touchStartX = null;
        this.touchTilt = 0;
      };
      surface.addEventListener("touchend", end, { passive: false });
      surface.addEventListener("touchcancel", end, { passive: false });
    }
  }

  async enable(opts = {}) {
    if (this.enabled) return;
    this.enabled = true;
    this.swipeOnly = !!opts.swipeOnly;
    this.source = "touch";
    const cal = document.getElementById("btn-calibrate");
    if (cal) cal.classList.toggle("hidden", this.swipeOnly);
    if (this.swipeOnly) return; // swipe-only mode: never listen to tilt
    try {
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res !== "granted") return; // touch fallback stays active
      }
      window.addEventListener("deviceorientation", this._onOrientation, true);
    } catch (_) {
      /* touch fallback */
    }
  }


  disable() {
    this.enabled = false;
    this.source = "none";
    this.tilt = 0;
    this.out = 0;
    this.rawSmooth = this.raw;
    this.touchTilt = 0;
    this.touchStartX = null;
    this.lastT = 0;
    window.removeEventListener("deviceorientation", this._onOrientation, true);
  }

  calibrate() {
    this.neutral = this.raw;
    this.rawSmooth = this.raw;
    this.tilt = 0;
    this.out = 0;
  }

  setVisible(v) {
    if (this.pad) this.pad.classList.toggle("hidden", !v);
  }

  // Smooth, proportional steering value in -1..1 (negative = left).
  value() {
    if (!this.enabled) return 0;

    // Frame-rate independent low-pass filters keep steering fluid instead of jittery.
    const now = performance.now();
    const dt = this.lastT ? Math.min(0.1, (now - this.lastT) / 1000) : 1 / 60;
    this.lastT = now;

    this.rawSmooth += (this.raw - this.rawSmooth) * (1 - Math.exp(-RAW_SMOOTH_HZ * dt));

    let v = 0;
    if (!this.swipeOnly && this.source === "tilt") {
      v = (this.rawSmooth - this.neutral) / MAX_TILT_DEG;
    }

    if (Math.abs(this.touchTilt) > Math.abs(v)) v = this.touchTilt;
    v = Math.max(-1, Math.min(1, v));

    let target = 0;
    if (Math.abs(v) >= DEAD_ZONE) {
      const sign = Math.sign(v);
      const norm = (Math.abs(v) - DEAD_ZONE) / (1 - DEAD_ZONE);
      // Gentler curve than squared: precise near centre, still reaches full lock.
      target = sign * Math.pow(norm, 1.4);
    }

    this.out += (target - this.out) * (1 - Math.exp(-OUT_SMOOTH_HZ * dt));
    if (Math.abs(this.out) < 0.004) this.out = 0;
    this.tilt = this.out;
    return this.tilt;
  }

}
