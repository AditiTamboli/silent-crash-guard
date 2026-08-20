const BLOCKED_KEYS = new Set([
  "F12",
  "F5",
  " ",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

const STEER_KEYS_LEFT = new Set(["a", "arrowleft"]);
const STEER_KEYS_RIGHT = new Set(["d", "arrowright"]);
const ACCEL_KEYS = new Set(["w", "arrowup"]);
const BRAKE_KEYS = new Set(["s", "arrowdown"]);

import { MobileInput, isTouchDevice } from "./mobile.js";

const MOBILE_STEER_RATE = 3.4; // lanes per second at full tilt

export class Controls {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.accelerating = false;
    this.braking = false;
    this.active = false;
    this.laneRequest = 0; // consumed by the player each frame
    this.fireRequest = 0;
    this.nitroRequest = false;
    this.mirrored = false; // Mirror Mode reverses only the steering input
    this._lastAccelDown = 0;
    this._wheelAccum = 0;
    this._keyAccel = false;
    this._keyBrake = false;
    this._mouseAccel = false;
    this._mouseBrake = false;
    this._touchAccel = false;
    this._touchBrake = false;
    this.mobile = new MobileInput(this);
    this.onPause = () => {};
    this.onEscape = () => {};

    const stop = (e) => {
      if (!this.active || this.isMobileMode) return false;
      e.preventDefault();
      e.stopPropagation();
      return true;
    };

    this._onContextMenu = (e) => {
      // Always kill the context menu on the game surface.
      e.preventDefault();
    };

    this._onMouseDown = (e) => {
      if (!stop(e)) return;
      if (e.button === this.accelButton) {
        this._mouseAccel = true;
        const now = performance.now();
        if (now - this._lastAccelDown < 320) {
          this.nitroRequest = true;
          this._lastAccelDown = 0;
        } else {
          this._lastAccelDown = now;
        }
      }
      if (e.button === this.brakeButton) this._mouseBrake = true;
      if (e.button === 1) this.fireRequest++;
      this._syncPedals();
    };

    this._onMouseUp = (e) => {
      if (this.active) e.preventDefault();
      if (e.button === this.accelButton) this._mouseAccel = false;
      if (e.button === this.brakeButton) this._mouseBrake = false;
      this._syncPedals();
    };

    // Resync from the real button bitmask so held buttons never get stuck and
    // both pedals + steering can be used at the same time.
    this._onMouseMove = (e) => {
      if (!this.active || this.isMobileMode) return;
      const leftDown = (e.buttons & 1) !== 0;
      const rightDown = (e.buttons & 2) !== 0;
      this._mouseAccel = this.accelButton === 0 ? leftDown : rightDown;
      this._mouseBrake = this.brakeButton === 0 ? leftDown : rightDown;
      this._syncPedals();
    };

    this._onWheel = (e) => {
      if (!stop(e)) return;
      if (this.mode !== "innovative") return;
      // Sensitivity 1 (slow) → 10 (twitchy): scroll delta needed per lane change.
      const sens = Math.max(1, Math.min(10, Number(this.settings.get("scrollSensitivity")) || 5));
      const threshold = 220 - sens * 20; // 200 … 20
      if (this._wheelAccum !== 0 && Math.sign(e.deltaY) !== Math.sign(this._wheelAccum)) {
        this._wheelAccum = 0;
      }
      this._wheelAccum += e.deltaY;
      while (Math.abs(this._wheelAccum) >= threshold) {
        const up = this._wheelAccum < 0;
        this._wheelAccum -= Math.sign(this._wheelAccum) * threshold;
        this.steer(up ? -1 : 1);
      }
    };

    this._onAux = (e) => {
      if (this.active) e.preventDefault();
    };

    this._onKeyDown = (e) => {
      if (e.key === "Escape") {
        this.onEscape();
        return;
      }
      if (e.key === "p" || e.key === "P" || (e.key === " " && this.active)) {
        if (this.active) e.preventDefault();
        this.onPause();
        return;
      }
      if (!this.active) return;
      if (BLOCKED_KEYS.has(e.key)) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && ["i", "j", "u", "s", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (this.mode !== "standard") return;
      const k = e.key.toLowerCase();
      if (ACCEL_KEYS.has(k)) {
        e.preventDefault();
        this._keyAccel = true;
        this._syncPedals();
      } else if (BRAKE_KEYS.has(k)) {
        e.preventDefault();
        this._keyBrake = true;
        this._syncPedals();
      } else if (STEER_KEYS_LEFT.has(k)) {
        e.preventDefault();
        if (!e.repeat) this.steer(-1, true);
      } else if (STEER_KEYS_RIGHT.has(k)) {
        e.preventDefault();
        if (!e.repeat) this.steer(1, true);
      }
    };

    this._onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (ACCEL_KEYS.has(k)) this._keyAccel = false;
      if (BRAKE_KEYS.has(k)) this._keyBrake = false;
      this._syncPedals();
    };

    this._onScrollBlock = (e) => {
      if (this.active) e.preventDefault();
    };

    this._release = () => this.releaseAll();

    const opts = { capture: true, passive: false };
    window.addEventListener("contextmenu", this._onContextMenu, opts);
    window.addEventListener("mousedown", this._onMouseDown, opts);
    window.addEventListener("mouseup", this._onMouseUp, opts);
    window.addEventListener("mousemove", this._onMouseMove, opts);
    window.addEventListener("wheel", this._onWheel, opts);
    window.addEventListener("auxclick", this._onAux, opts);
    window.addEventListener("keydown", this._onKeyDown, opts);
    window.addEventListener("keyup", this._onKeyUp, opts);
    window.addEventListener("scroll", this._onScrollBlock, opts);
    window.addEventListener("touchmove", this._onScrollBlock, opts);
    window.addEventListener("blur", this._release);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.releaseAll();
    });

    this.mobile.mount();
  }

  get mode() {
    const m = this.settings.get("controlMode");
    if (m === "standard" || m === "mobile" || m === "swipe") return m;
    return "innovative";
  }

  get isMobileMode() {
    return this.mode === "mobile" || this.mode === "swipe";
  }

  get isSwipeMode() {
    return this.mode === "swipe";
  }


  static touchDevice() {
    return isTouchDevice();
  }

  // Proportional steering (-1..1) used by mobile mode; mirror flips it too.
  analogSteer() {
    if (!this.isMobileMode) return 0;
    const v = this.mobile.value();
    return this.mirrored ? -v : v;
  }

  get steerRate() {
    return MOBILE_STEER_RATE;
  }

  get leftHanded() {
    return this.settings.get("handedness") === "left";
  }

  // Right-handed: LEFT click accelerates, RIGHT click brakes.
  // Left-handed:  RIGHT click accelerates, LEFT click brakes.
  get accelButton() {
    return this.leftHanded ? 2 : 0;
  }
  get brakeButton() {
    return this.leftHanded ? 0 : 2;
  }

  // raw: -1 = scroll up, +1 = scroll down.
  // Right-handed: scroll up → move right. Left-handed: scroll up → move left.
  steer(raw, literal = false) {
    let dir = raw;
    if (!literal && !this.leftHanded) dir = -dir;
    if (this.mirrored) dir = -dir;
    this.laneRequest += dir;
  }

  _syncPedals() {
    // Pedals never depend on handedness or mirror state.
    this.accelerating = this._mouseAccel || this._keyAccel || this._touchAccel;
    this.braking = this._mouseBrake || this._keyBrake || this._touchBrake;
  }

  setMirrored(value) {
    this.mirrored = value;
    this.laneRequest = 0;
    this._wheelAccum = 0;
  }

  setActive(value) {
    this.active = value;
    document.body.classList.toggle("playing", value);
    const mobile = value && this.isMobileMode;
    document.body.classList.toggle("mobile-play", mobile);
    this.mobile.setVisible(mobile);
    if (mobile) this.mobile.enable({ swipeOnly: this.isSwipeMode });
    else this.mobile.disable();
    if (!value) this.releaseAll();
  }

  releaseAll() {
    this._mouseAccel = false;
    this._mouseBrake = false;
    this._touchAccel = false;
    this._touchBrake = false;
    this._keyAccel = false;
    this._keyBrake = false;
    this.accelerating = false;
    this.braking = false;
    this.laneRequest = 0;
    this.fireRequest = 0;
    this.nitroRequest = false;
    this._wheelAccum = 0;
  }

  consumeLaneRequest() {
    const v = this.laneRequest;
    this.laneRequest = 0;
    return Math.max(-1, Math.min(1, v));
  }

  consumeFire() {
    const n = this.fireRequest;
    this.fireRequest = 0;
    return n;
  }

  consumeNitro() {
    const n = this.nitroRequest;
    this.nitroRequest = false;
    return n;
  }
}
