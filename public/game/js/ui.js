import { STORAGE_KEYS } from "../config.js";

const DEFAULTS = {
  handedness: "right",
  controlMode: "innovative",
  scrollSensitivity: 6,
  master: 0.8,
  sfx: 0.9,
  music: 0.5,
};

export class Settings {
  constructor() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}");
    } catch (_) {}
    this.data = { ...DEFAULTS, ...saved };
    const touch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0);
    if (touch && saved.controlMode === undefined) this.data.controlMode = "mobile";
  }
  get(k) {
    return this.data[k];
  }
  set(k, v) {
    this.data[k] = v;
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.data));
    } catch (_) {}
  }
  all() {
    return this.data;
  }
}

const $ = (id) => document.getElementById(id);

const SCREENS = ["menu", "controls", "settings", "pause", "gameover", "ready", "fullscreen"];

export class UI {
  constructor(settings, handlers) {
    this.settings = settings;
    this.h = handlers;
    this._cache = {};
    this.el = {
      menu: $("menu"),
      controls: $("controls-screen"),
      settings: $("settings-screen"),
      pause: $("pause-screen"),
      gameover: $("gameover-screen"),
      ready: $("ready-screen"),
      hud: $("hud"),
      score: $("hud-score"),
      speed: $("hud-speed"),
      distance: $("hud-distance"),
      combo: $("hud-combo"),
      best: $("hud-best"),
      event: $("event-banner"),
      weather: $("weather-tag"),
      menuBest: $("menu-best"),
      fullscreen: $("fullscreen-screen"),
      coins: $("hud-coins"),
      nitro: $("hud-nitro"),
      nitroBar: $("nitro-bar"),
      nitroFill: document.querySelector("#nitro-bar i"),
      ghost: $("ghost-hud"),
      ghostDelta: $("ghost-delta"),
      mirror: $("mirror-hud"),
      mirrorCount: $("mirror-count"),
      mirrorTint: $("mirror-tint"),
      warnLeft: $("warn-left"),
      warnRight: $("warn-right"),
      rainNote: $("rain-note"),
    };

    $("btn-play").onclick = () => this.h.play();
    $("btn-fullscreen").onclick = () => this.h.enterFullscreen();
    $("btn-controls").onclick = () => this.show("controls");
    $("btn-settings").onclick = () => this.show("settings");
    document.querySelectorAll("[data-back]").forEach((b) => {
      b.onclick = () => this.show("menu");
    });
    $("btn-resume").onclick = () => this.h.resume();
    $("btn-quit").onclick = () => this.h.quit();
    $("btn-again").onclick = () => this.h.play();
    $("btn-menu").onclick = () => this.h.quit();

    this.mode = $("mode-toggle");
    this.mode.value = settings.get("controlMode");
    this.mode.onchange = () => {
      settings.set("controlMode", this.mode.value);
      this.h.settingsChanged();
      this.renderControlHints();
    };

    this.hand = $("hand-toggle");
    this.hand.value = settings.get("handedness");
    this.hand.onchange = () => {
      settings.set("handedness", this.hand.value);
      this.h.settingsChanged();
      this.renderControlHints();
    };

    this.sens = $("scroll-sens");
    this.sens.value = String(settings.get("scrollSensitivity"));
    $("scroll-sens-val").textContent = this.sens.value;
    this.sens.oninput = () => {
      settings.set("scrollSensitivity", Number(this.sens.value));
      $("scroll-sens-val").textContent = this.sens.value;
      this.h.settingsChanged();
    };

    ["master", "sfx", "music"].forEach((key) => {
      const slider = $(`vol-${key}`);
      slider.value = String(Math.round(settings.get(key) * 100));
      $(`vol-${key}-val`).textContent = `${slider.value}%`;
      slider.oninput = () => {
        settings.set(key, Number(slider.value) / 100);
        $(`vol-${key}-val`).textContent = `${slider.value}%`;
        this.h.settingsChanged();
      };
    });

    this.renderControlHints();
  }

  renderControlHints() {
    const left = this.settings.get("handedness") === "left";
    document.querySelectorAll("[data-scroll-up]").forEach((e) => {
      e.textContent = left ? "Move left" : "Move right";
    });
    document.querySelectorAll("[data-scroll-down]").forEach((e) => {
      e.textContent = left ? "Move right" : "Move left";
    });
    document.querySelectorAll("[data-accel-btn]").forEach((e) => {
      e.textContent = left ? "Hold Right Click" : "Hold Left Click";
    });
    document.querySelectorAll("[data-brake-btn]").forEach((e) => {
      e.textContent = left ? "Hold Left Click" : "Hold Right Click";
    });
    document.querySelectorAll("[data-nitro-btn]").forEach((e) => {
      e.textContent = left ? "Double Right Click" : "Double Left Click";
    });
    const mode = this.settings.get("controlMode");
    $("mode-tag-standard").classList.toggle("hidden", mode !== "standard");
    $("mode-tag-innovative").classList.toggle("hidden", mode !== "innovative");
    const mobileTag = $("mode-tag-mobile");
    if (mobileTag) mobileTag.classList.toggle("hidden", mode !== "mobile");
    const swipeTag = $("mode-tag-swipe");
    if (swipeTag) swipeTag.classList.toggle("hidden", mode !== "swipe");
    $("sens-field").classList.toggle("hidden", mode !== "innovative");
  }

  // Lines drawn on the 3-2-1 countdown so the player sees the active scheme.
  controlSummary() {
    const left = this.settings.get("handedness") === "left";
    if (this.settings.get("controlMode") === "swipe") {
      return {
        title: "MOBILE MODE — SWIPE",
        lines: [
          "Swipe right / left  Steer",
          "GO / BRAKE  Pedals",
          "NITRO  Speed burst",
          "No tilt used in this mode",
        ],
      };
    }
    if (this.settings.get("controlMode") === "mobile") {
      return {
        title: "MOBILE MODE — TILT",
        lines: [
          "Tilt left / right  Steer",
          "Swipe road  Steer (fallback)",
          "GO / BRAKE  Pedals",
          "Hold phone level — calibrating",
        ],
      };
    }

    if (this.settings.get("controlMode") === "standard") {
      return {
        title: "STANDARD MODE — KEYBOARD",
        lines: ["W / ↑  Accelerate", "S / ↓  Brake", "A / ←  Left", "D / →  Right"],
      };
    }
    return {
      title: "INNOVATIVE MODE — MOUSE",
      lines: [
        left ? "Right Click  Accelerate" : "Left Click  Accelerate",
        left ? "Left Click  Brake" : "Right Click  Brake",
        left ? "Scroll Up  Move left" : "Scroll Up  Move right",
        left ? "Scroll Down  Move right" : "Scroll Down  Move left",
      ],
    };
  }

  show(screen) {
    for (const key of SCREENS) {
      this.el[key].classList.toggle("hidden", key !== screen);
    }
    this.el.hud.classList.toggle("hidden", !(screen === "none" || screen === "ready"));
    if (screen === "none") {
      for (const key of SCREENS) {
        this.el[key].classList.add("hidden");
      }
      this.el.hud.classList.remove("hidden");
    }
  }

  setMenuBest(best) {
    this.el.menuBest.textContent = best.toLocaleString();
  }

  // Only touches the DOM when a value actually changed.
  _text(key, el, value) {
    if (this._cache[key] === value) return;
    this._cache[key] = value;
    el.textContent = value;
  }

  updateHUD(score, speed, extra = {}) {
    if (extra.coins !== undefined) this._text("coins", this.el.coins, String(extra.coins));
    if (extra.nitroCharges !== undefined) {
      this._text("nitro", this.el.nitro, String(extra.nitroCharges));
    }
    if (extra.nitroRatio !== undefined) {
      const active = extra.nitroRatio > 0;
      this.el.nitroBar.classList.toggle("hidden", !active);
      if (active) this.el.nitroFill.style.transform = `scaleX(${extra.nitroRatio.toFixed(3)})`;
    }
    const value = Math.floor(score.value);
    this._text("score", this.el.score, value.toLocaleString());
    this._text("speed", this.el.speed, String(Math.round(speed)));
    this._text("distance", this.el.distance, (score.distance / 1000).toFixed(2));
    this._text("best", this.el.best, Math.max(score.best, value).toLocaleString());
    if (score.combo > 1) {
      this.el.combo.classList.remove("hidden");
      this._text("combo", this.el.combo, `×${score.combo}`);
    } else {
      this.el.combo.classList.add("hidden");
    }
  }

  setGhost(visible, deltaMetres) {
    this.el.ghost.classList.toggle("hidden", !visible);
    if (!visible) return;
    const ahead = deltaMetres >= -0.5;
    const m = Math.round(Math.abs(deltaMetres));
    this._text("ghost", this.el.ghostDelta, ahead ? `🟢 +${m}m AHEAD` : `🔴 -${m}m BEHIND`);
    this.el.ghostDelta.classList.toggle("ahead", ahead);
    this.el.ghostDelta.classList.toggle("behind", !ahead);
  }

  setMirror(active, secondsLeft) {
    this.el.mirror.classList.toggle("hidden", !active);
    this.el.mirrorTint.classList.toggle("hidden", !active);
    if (active) {
      this._text("mirrorCount", this.el.mirrorCount, String(Math.max(0, Math.ceil(secondsLeft))));
    }
  }

  setRearWarning(left, right) {
    this.el.warnLeft.classList.toggle("hidden", left <= 0);
    this.el.warnRight.classList.toggle("hidden", right <= 0);
    if (left > 0) this.el.warnLeft.style.opacity = String(0.5 + left * 0.5);
    if (right > 0) this.el.warnRight.style.opacity = String(0.5 + right * 0.5);
  }

  clearRunOverlays() {
    this.setWeather("Day", false);
    this.setMirror(false, 0);
    this.setRearWarning(0, 0);
    this.el.ghost.classList.add("hidden");
  }

  banner(text) {
    this.el.event.textContent = text;
    this.el.event.classList.remove("hidden");
    this.el.event.classList.remove("pop");
    void this.el.event.offsetWidth;
    this.el.event.classList.add("pop");
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => this.el.event.classList.add("hidden"), 2600);
  }

  setWeather(label, rain = false) {
    this.el.weather.textContent = rain ? "\u{1F327} Rain" : label;
    this.el.weather.classList.toggle("rain", rain);
    if (this.el.rainNote) this.el.rainNote.classList.toggle("hidden", !rain);
  }

  showGameOver(score, finalValue) {
    $("go-distance").textContent = `${(score.distance / 1000).toFixed(2)} km`;
    $("go-score").textContent = finalValue.toLocaleString();
    $("go-near").textContent = String(score.nearMisses);
    $("go-combo").textContent = `×${score.bestCombo}`;
    $("go-best").textContent = score.best.toLocaleString();
    $("go-record").classList.toggle("hidden", !score.newRecord);
    this.show("gameover");
  }
}
