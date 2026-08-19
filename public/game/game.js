import { CONFIG } from "./config.js";
import { Controls } from "./js/controls.js";
import { createPlayer, resetPlayer, updatePlayer, drawPlayer } from "./js/player.js";
import { TrafficSystem } from "./js/traffic.js";
import { checkTraffic } from "./js/collision.js";
import { Score } from "./js/score.js";
import { Settings, UI } from "./js/ui.js";
import { AudioEngine } from "./js/audio.js";
import { roundRect, clearSpriteCache } from "./js/draw.js";
import { PickupSystem } from "./js/pickups.js";
import { BulletSystem } from "./js/bullets.js";
import { GhostSystem } from "./js/ghost.js";
import { MirrorMode } from "./js/mirror.js";
import { RearWarning } from "./js/rearwarn.js";
import { Scenery } from "./js/scenery.js";

const MAX_PARTICLES = 260;

const MAX_LANES = 5;

const STATE = {
  MENU: "MENU",
  READY: "READY",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  CRASH: "CRASH",
  GAMEOVER: "GAMEOVER",
};

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

const WEATHERS = [
  { id: "day", label: "Day", sky: "#8fb9d8", asphalt: "#4a4e57", tint: null, rain: false },
  {
    id: "sunset",
    label: "Sunset",
    sky: "#e08a4e",
    asphalt: "#4b444a",
    tint: "rgba(255,140,60,0.14)",
    rain: false,
  },
  {
    id: "night",
    label: "Night",
    sky: "#141a2b",
    asphalt: "#2b2f38",
    tint: "rgba(10,15,40,0.42)",
    rain: false,
  },
  {
    id: "rain",
    label: "Rain",
    sky: "#5c6672",
    asphalt: "#3b414b",
    tint: "rgba(80,110,140,0.24)",
    rain: true,
  },
];

const EVENTS = [
  { id: "construction", label: "CONSTRUCTION ZONE AHEAD", duration: 11 },
  { id: "dense", label: "DENSE TRAFFIC", duration: 10 },
  { id: "police", label: "POLICE PURSUIT", duration: 9 },
  { id: "convoy", label: "TRUCK CONVOY", duration: 9 },
  { id: "oil", label: "OIL SPILL — LOW GRIP", duration: 8 },
];

class Game {
  constructor() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    this.settings = new Settings();
    this.audio = new AudioEngine(this.settings);
    this.controls = new Controls(this.canvas, this.settings);
    this.player = createPlayer();
    this.traffic = new TrafficSystem();
    this.score = new Score();
    this.pickups = new PickupSystem();
    this.bullets = new BulletSystem();
    this.ghost = new GhostSystem();
    this.mirror = new MirrorMode();
    this.rearWarn = new RearWarning();
    this.scenery = new Scenery();
    this.coins = 0;
    this.nitroCharges = 0;
    this.nitroTimer = 0;
    this.particles = [];
    this.particlePool = [];
    this.popups = [];
    this.cones = [];
    this.oilPatches = [];
    this.shake = 0;
    this.state = STATE.MENU;
    this.road = { width: 0, height: 0, laneW: 0, left: 0, laneToX: () => 0 };

    this.ui = new UI(this.settings, {
      play: () => this.requestPlay(),
      resume: () => this.setState(STATE.PLAYING),
      quit: () => this.toMenu(),
      enterFullscreen: () => this.enterFullscreenAndPlay(),
      settingsChanged: () => this.audio.applyVolumes(),
    });
    this.ui.setMenuBest(this.score.best);

    this.controls.onPause = () => {
      if (this.state === STATE.PLAYING) this.setState(STATE.PAUSED);
      else if (this.state === STATE.PAUSED) this.setState(STATE.PLAYING);
    };

    // ESC quits the run (the browser also uses it to leave fullscreen).
    this.controls.onEscape = () => {
      if (
        this.state === STATE.PLAYING ||
        this.state === STATE.PAUSED ||
        this.state === STATE.READY
      ) {
        this.exitFullscreen();
        this.toMenu();
      }
    };

    // Losing fullscreen mid-run ends the run — the game needs the mouse.
    document.addEventListener("fullscreenchange", () => {
      if (
        !isFullscreen() &&
        !this.controls.isMobileMode &&
        this.state !== STATE.MENU &&
        this.state !== STATE.GAMEOVER
      ) {
        this.toMenu();
      }
    });
    window.addEventListener("blur", () => {
      if (this.state === STATE.PLAYING) this.setState(STATE.PAUSED);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === STATE.PLAYING) this.setState(STATE.PAUSED);
    });

    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    window.addEventListener("orientationchange", this._onResize);
    document.addEventListener("pointerdown", () => {
      this.audio.init();
      this.audio.resume();
    });

    this.resize();
    this.resetWorld();
    this.lastTime = performance.now();
    this.hudTimer = 0;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const coarse = w * h > 1100 * 900;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.baseRoadWidth = Math.max(
      CONFIG.minRoadWidth,
      Math.min(CONFIG.maxRoadWidth, w * CONFIG.roadWidthRatio),
    );
    this.road = {
      width: this.baseRoadWidth,
      height: h,
      viewWidth: w,
      laneW: this.baseRoadWidth / MAX_LANES,
      left: (w - this.baseRoadWidth) / 2,
      laneToX: () => 0,
      laneMax: CONFIG.lanes - 1,
    };
    if (this.laneSpan == null) this.laneSpan = CONFIG.lanes;
    if (this.laneSpanTarget == null) this.laneSpanTarget = CONFIG.lanes;
    this.applyRoadGeometry();
    this.playerY = h * CONFIG.playerYRatio;
    this._grassGrad = null;
    this.rain = null;
    clearSpriteCache();
  }

  applyRoadGeometry() {
    const laneW = this.baseRoadWidth / MAX_LANES;
    const width = laneW * this.laneSpan;
    const left = (this.road.viewWidth - width) / 2;
    this.road.width = width;
    this.road.left = left;
    this.road.laneW = laneW;
    this.road.laneMax = this.laneSpan - 1;
    this.road.laneToX = (lane) => left + laneW * (lane + 0.5);
  }

  // Announces the next road shape; the width itself eases over several seconds.
  requestLaneCount(n) {
    if (this.laneSpanTarget === n) return;
    const shrinking = n < this.laneSpanTarget;
    this.laneSpanTarget = n;
    this.ui.banner(shrinking ? `⚠ ROAD NARROWS — ${n} LANES` : `${n} LANES OPEN`);
  }

  // Clamps everything on the road inward as the outer lane closes.
  clampToRoad() {
    const max = this.road.laneMax;
    const usable = Math.max(0, Math.floor(max + 0.001));
    CONFIG.lanes = usable + 1;
    const p = this.player;
    if (p.targetLane > max) p.targetLane = max;
    for (const v of this.traffic.active) {
      if (v.targetLane != null && v.targetLane > max) v.targetLane = max;
      if (v.lane > max) {
        v.lane = max;
        v.laneVel = Math.min(0, v.laneVel);
      }
    }
    for (const it of this.pickups.items) if (it.lane > max) it.lane = max;
    for (const c of this.cones) if (c.lane > max) c.lane = max;
    for (const o of this.oilPatches) if (o.lane > max - 1) o.lane = Math.max(0, max - 1);
    if (this.traffic.modifiers.laneBlocked > usable) this.traffic.modifiers.laneBlocked = usable;
  }

  updateRoadShape(dt) {
    this.shapeTimer -= dt;
    if (this.shapeTimer <= 0) {
      this.requestLaneCount(this.laneSpanTarget === MAX_LANES ? MAX_LANES - 1 : MAX_LANES);
      this.shapeTimer = 18 + Math.random() * 10;
    }
    // One lane's worth of width takes ~6s to open or close.
    const rate = dt / 6;
    if (this.laneSpan < this.laneSpanTarget)
      this.laneSpan = Math.min(this.laneSpanTarget, this.laneSpan + rate);
    else if (this.laneSpan > this.laneSpanTarget)
      this.laneSpan = Math.max(this.laneSpanTarget, this.laneSpan - rate);
    this.applyRoadGeometry();
    this.clampToRoad();

    this.markTimer -= dt;
    if (this.markTimer <= 0) {
      this.markOn = !this.markOn;
      this.markTimer = this.markOn ? 5 + Math.random() * 4 : 20 + Math.random() * 14;
    }
    // Linear progress toward the target, eased on read, so fades never flicker.
    const fadeRate = 1 / (this.markOn ? 1.2 : 1.8);
    const target = this.markOn ? 1 : 0;
    const delta = fadeRate * dt;
    if (this.markFade < target) this.markFade = Math.min(target, this.markFade + delta);
    else if (this.markFade > target) this.markFade = Math.max(target, this.markFade - delta);
    const f = this.markFade;
    this.markAlpha = f * f * (3 - 2 * f);
  }


  resetWorld() {
    resetPlayer(this.player);
    this.traffic.reset();
    this.score.reset();
    this.particles.length = 0;
    this.popups.length = 0;
    this.cones.length = 0;
    this.oilPatches.length = 0;
    this.pickups.reset();
    this.bullets.reset();
    this.coins = 0;
    this.nitroCharges = 0;
    this.nitroTimer = 0;
    this.player.nitro = false;
    this.shake = 0;
    this.runTime = 0;
    this.prevSpeed = CONFIG.speedIdle;
    this.roadScroll = 0;
    CONFIG.lanes = MAX_LANES;
    this.laneSpan = MAX_LANES;
    this.laneSpanTarget = MAX_LANES;
    this.shapeTimer = 16 + Math.random() * 8;
    this.markOn = true;
    this.markFade = 1;
    this.markAlpha = 1;
    this.markTimer = 8 + Math.random() * 4;


    this.applyRoadGeometry();
    this.weatherIndex = 0;
    this.weatherTimer = CONFIG.weatherDuration;
    this.weatherBlend = 1;
    this.event = null;
    this.eventTimer = CONFIG.eventMinDelay;
    this.ui.setWeather(WEATHERS[0].label, false);
    this.crashTimer = 0;
    this.ghost.reset();
    this.mirror.reset();
    this.rearWarn.reset();
    this.scenery.reset();
    this.controls.setMirrored(false);
    this.ui.clearRunOverlays();
  }

  get weather() {
    return WEATHERS[this.weatherIndex];
  }

  setState(next) {
    this.state = next;
    if (next !== STATE.CRASH) this.audio.unmute();
    const playing = next === STATE.PLAYING;
    this.controls.setActive(playing || next === STATE.READY);
    // Steering direction must always match the live Mirror Mode state.
    this.controls.setMirrored(playing && this.mirror.active);
    if (!playing) this.ui.setRearWarning(0, 0);
    if (!playing) {
      this.audio.setEngine(false, 0, "idle");
      this.audio.silence();
    } else this.audio.startMusic();
    if (next === STATE.PLAYING) this.ui.show("none");
    if (next === STATE.PAUSED) this.ui.show("pause");
    if (next === STATE.MENU) this.ui.show("menu");
    if (next === STATE.READY) this.ui.show("ready");
  }

  toMenu() {
    this.audio.ui();
    this.resetWorld();
    this.ui.setMenuBest(this.score.best);
    this.setState(STATE.MENU);
  }

  requestPlay() {
    // Mobile mode does not need the mouse, so fullscreen is optional there.
    if (!isFullscreen() && !this.controls.isMobileMode) {
      this.audio.ui();
      this.ui.show("fullscreen");
      return;
    }
    this.startRun();
  }

  async enterFullscreenAndPlay() {
    try {
      const el = document.documentElement;
      await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen());
    } catch (_) {
      /* ignore — checked below */
    }
    if (isFullscreen()) this.startRun();
    else this.ui.banner("FULLSCREEN BLOCKED — ALLOW IT TO PLAY");
  }

  exitFullscreen() {
    if (isFullscreen() && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  startRun() {
    if (this.controls.isMobileMode) this.controls.mobile.calibrate();
    this.audio.init();
    this.audio.resume();
    this.audio.start();
    this.resetWorld();
    this.ghost.startRun();
    this.setState(STATE.READY);
    this.readyTimer = 3.0;
  }

  get difficulty() {
    return Math.min(1, this.runTime / CONFIG.difficultyRamp);
  }

  // ---------------------------------------------------------------- events
  updateEvents(dt) {
    if (this.event) {
      this.event.time -= dt;
      if (this.event.time <= 0) this.endEvent();
      return;
    }
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) this.startEvent();
  }

  startEvent() {
    const def = EVENTS[(Math.random() * EVENTS.length) | 0];
    this.event = { ...def, time: def.duration };
    const m = this.traffic.modifiers;
    if (def.id === "construction") {
      const lane = (Math.random() * CONFIG.lanes) | 0;
      m.laneBlocked = lane;
      for (let i = 0; i < 16; i++) {
        this.cones.push({ lane, y: -200 - i * 90 });
      }
    } else if (def.id === "dense") {
      m.rateMul = 2.1;
    } else if (def.id === "police") {
      this.traffic.spawn("police", (Math.random() * CONFIG.lanes) | 0, -280);
    } else if (def.id === "convoy") {
      const lane = (Math.random() * CONFIG.lanes) | 0;
      for (let i = 0; i < 4; i++) this.traffic.spawn("truck", lane, -320 - i * 260, 74);
    } else if (def.id === "oil") {
      for (let i = 0; i < 7; i++) {
        this.oilPatches.push({
          lane: Math.random() * (CONFIG.lanes - 1),
          y: -200 - i * 260,
          r: 40 + Math.random() * 50,
        });
      }
    }
    this.ui.banner(def.label);
  }

  endEvent() {
    this.event = null;
    this.traffic.modifiers.rateMul = 1;
    this.traffic.modifiers.laneBlocked = -1;
    this.traffic.modifiers.forceType = null;
    this.eventTimer =
      CONFIG.eventMinDelay + Math.random() * (CONFIG.eventMaxDelay - CONFIG.eventMinDelay);
  }

  updateWeather(dt) {
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = CONFIG.weatherDuration;
      this.weatherIndex = (this.weatherIndex + 1) % WEATHERS.length;
      this.ui.setWeather(this.weather.label, this.weather.rain);
      this.ui.banner(
        this.weather.rain ? "\u{1F327} RAIN \u2014 BRAKING -15%" : this.weather.label.toUpperCase(),
      );
      if (this.weather.rain) this.initRain();
      else this.rain = null;
    }
  }

  initRain() {
    this.rain = [];
    const count = Math.max(
      70,
      Math.min(180, Math.round((this.road.viewWidth * this.road.height) / 12000)),
    );
    for (let i = 0; i < count; i++) {
      this.rain.push({
        x: Math.random() * this.road.viewWidth,
        y: Math.random() * this.road.height,
        len: 12 + Math.random() * 22,
        sp: 900 + Math.random() * 600,
      });
    }
  }

  // ------------------------------------------------------------- particles
  emit(x, y, count, color, spread = 90) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const p = this.particlePool.pop() || {};
      p.x = x;
      p.y = y;
      p.vx = (Math.random() - 0.5) * spread * 2;
      p.vy = (Math.random() - 0.5) * spread * 2;
      p.life = 0.4 + Math.random() * 0.6;
      p.max = p.life;
      p.color = color;
      p.size = 2 + Math.random() * 4;
      this.particles.push(p);
    }
  }

  popup(text, x, y, color) {
    this.popups.push({ text, x, y, life: 1.1, color });
  }

  // ------------------------------------------------------------------ loop
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (document.hidden) return;
    this.update(dt);
    this.render(dt);
  }

  update(dt) {
    if (this.state === STATE.READY) {
      this.readyTimer -= dt;
      this.roadScroll += this.player.speed * CONFIG.pxPerKmh * dt;
      this.scenery.update(this.player.speed * CONFIG.pxPerKmh, dt);
      if (this.readyTimer <= 0) this.setState(STATE.PLAYING);
      return;
    }

    if (this.state === STATE.CRASH) {
      this.crashTimer -= dt;
      this.shake = Math.max(0, this.shake - dt * 26);
      this.updateParticles(dt);
      if (this.crashTimer <= 0) {
        const final = this.score.finalize();
        const newGhost = this.ghost.finalize(final, this.score.distance);
        if (newGhost) this.ui.banner("🏆 NEW BEST RUN!");
        this.controls.setMirrored(false);
        this.ui.clearRunOverlays();
        this.ui.setMenuBest(this.score.best);
        this.ui.showGameOver(this.score, final);
        this.state = STATE.GAMEOVER;
      }
      return;
    }

    if (this.state !== STATE.PLAYING) {
      this.updateParticles(dt);
      return;
    }

    this.runTime += dt;
    const wasBraking = this.player.braking;

    // Oil spill grip
    let grip = 1;
    for (const o of this.oilPatches) {
      if (
        Math.abs(o.y - this.playerY) < o.r + 50 &&
        Math.abs(this.road.laneToX(o.lane + 0.5) - this.road.laneToX(this.player.lane)) < o.r + 30
      ) {
        grip = 0.42;
      }
    }
    this.player.grip = grip;
    // Rain reduces braking force by 15%; everything else stays the same.
    this.player.brakeMul = this.weather.rain ? CONFIG.rainBrakeMul : 1;

    updatePlayer(this.player, dt, this.controls, this.road.laneMax);
    if (!wasBraking && this.player.braking) this.audio.brake();

    const scrollSpeed = this.player.speed * CONFIG.pxPerKmh;
    this.roadScroll += scrollSpeed * dt;
    this.scenery.update(scrollSpeed, dt);
    this.updateRoadShape(dt);

    this.traffic.update(dt, this.difficulty, this.player, this.road);
    this.traffic.modifiers.speedMul = 1 + this.difficulty * 0.22;

    for (let i = this.cones.length - 1; i >= 0; i--) {
      this.cones[i].y += scrollSpeed * dt;
      if (this.cones[i].y > this.road.height + 100) this.cones.splice(i, 1);
    }
    for (let i = this.oilPatches.length - 1; i >= 0; i--) {
      this.oilPatches[i].y += scrollSpeed * dt;
      if (this.oilPatches[i].y > this.road.height + 200) this.oilPatches.splice(i, 1);
    }

    // Nitro
    if (this.controls.consumeNitro() && this.nitroTimer <= 0 && this.nitroCharges > 0) {
      this.nitroCharges--;
      this.nitroTimer = CONFIG.nitroDuration;
      this.ui.banner("NITRO!");
      this.audio.start();
    }
    if (this.nitroTimer > 0) {
      this.nitroTimer -= dt;
      this.player.nitro = this.nitroTimer > 0;
      if (this.player.nitro) {
        this.emit(this.road.laneToX(this.player.lane), this.playerY + 48, 2, "#3ad2ff", 60);
      }
    } else {
      this.player.nitro = false;
    }

    // Pickups
    this.pickups.update(dt, scrollSpeed, this.road);
    for (const it of this.pickups.collect(this.player.lane, this.playerY)) {
      const x = this.road.laneToX(it.lane);
      if (it.kind === "coin") {
        this.coins += CONFIG.coinValue;
        this.emit(x, it.y, 5, "#f7c948", 60);
        this.audio.nearMiss(1);
      } else {
        this.nitroCharges++;
        this.popup("NITRO READY", x, it.y, "#3ad2ff");
        this.emit(x, it.y, 10, "#3ad2ff", 90);
        this.audio.start();
      }
    }

    // Coin cannon
    let shots = this.controls.consumeFire();
    while (shots-- > 0) {
      if (this.coins >= CONFIG.bulletCost) {
        this.coins -= CONFIG.bulletCost;
        this.bullets.fire(this.player.lane, this.playerY - 60);
        this.audio.brake();
        this.emit(this.road.laneToX(this.player.lane), this.playerY - 60, 8, "#fff3c4", 80);
      } else {
        this.popup(
          "NEED 20 COINS",
          this.road.laneToX(this.player.lane),
          this.playerY - 90,
          "#ff8a6b",
        );
      }
    }
    this.bullets.update(dt, this.traffic, (v) => {
      const x = this.road.laneToX(v.lane);
      this.score.value += CONFIG.bulletKillPoints;
      this.popup(`+${CONFIG.bulletKillPoints}`, x, v.y, "#ffb347");
      this.emit(x, v.y, 26, "#ffb347", 200);
      this.emit(x, v.y, 12, "#ff5a2b", 240);
      this.shake = Math.min(16, this.shake + 6);
      this.audio.crash();
    });

    this.score.update(dt, this.player.speed);
    this.updateMirror(dt);
    this.updateGhost(dt);
    this.rearWarn.update(dt, this.traffic, this.player, this.playerY) && this.audio.warn();
    this.updateEvents(dt);
    this.updateWeather(dt);
    this.updateParticles(dt);

    // Cone collision (soft: breaks combo, sparks)
    for (const c of this.cones) {
      if (Math.abs(c.y - this.playerY) < 50 && Math.abs(c.lane - this.player.lane) < 0.42) {
        c.y = 99999;
        this.score.breakCombo();
        this.shake = Math.min(10, this.shake + 5);
        this.emit(this.road.laneToX(this.player.lane), this.playerY, 8, "#ff9c3c");
      }
    }

    const hit = checkTraffic(this.player, this.traffic, this.road, this.playerY, (v) => {
      const gained = this.score.registerNearMiss(this.player.speed);
      this.audio.nearMiss(this.score.combo);
      const label =
        this.score.combo > 1
          ? `NEAR MISS +${gained}  ×${this.score.combo}`
          : `NEAR MISS +${gained}`;
      this.popup(label, this.road.laneToX(v.lane), v.y, "#ffe45e");
      this.emit(this.road.laneToX(v.lane), v.y, 6, "#ffe45e", 40);
    });

    if (hit) this.crash(hit);

    // Engine audio reacts to driver input only: throttle, lift-off, brake.
    const decelerating = this.player.speed < this.prevSpeed - 0.4;
    const mode =
      this.player.accelerating || this.player.nitro
        ? "accel"
        : this.player.braking
          ? "brake"
          : decelerating
            ? "coast"
            : "idle";
    this.audio.setEngine(true, this.player.speed, mode);
    this.prevSpeed = this.player.speed;
  }

  updateMirror(dt) {
    const change = this.mirror.update(dt);
    if (change === "start") {
      this.controls.setMirrored(true);
      this.ui.banner("🪞 MIRROR MODE — STEERING REVERSED");
      this.audio.mirror();
    } else if (change === "end") {
      this.controls.setMirrored(false);
      this.ui.banner("MIRROR MODE ENDED");
      this.audio.ui();
    }
  }

  updateGhost(dt) {
    this.ghost.record(this.runTime, dt, this.player.lane, this.score.distance, this.player.speed);
    this.ghost.update(this.runTime, this.score.distance);
    if (
      !this.ghost.beatAnnounced &&
      this.ghost.best &&
      Math.floor(this.score.value) > this.ghost.bestScore
    ) {
      this.ghost.beatAnnounced = true;
      this.ui.banner("🏆 NEW BEST RUN!");
      this.audio.nearMiss(4);
    }
  }

  updateParticles(dt) {
    const list = this.particles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      if (p.life <= 0) {
        list[i] = list[list.length - 1];
        list.pop();
        if (this.particlePool.length < MAX_PARTICLES) this.particlePool.push(p);
      }
    }
    const pops = this.popups;
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.life -= dt;
      p.y -= 40 * dt;
      if (p.life <= 0) {
        pops[i] = pops[pops.length - 1];
        pops.pop();
      }
    }
  }

  crash(v) {
    this.audio.setEngine(false, 0, "idle");
    this.audio.silence();
    this.audio.hardMute();
    // Sound is fully off after a crash — no crash SFX, no music.
    this.shake = 26;
    this.crashTimer = 1.1;
    this.score.breakCombo();
    const x = this.road.laneToX(this.player.lane);
    this.emit(x, this.playerY, 46, "#ffb347", 220);
    this.emit(x, this.playerY, 22, "#ff5a2b", 260);
    this.controls.setActive(false);
    this.state = STATE.CRASH;
    this.crashedVehicle = v;
  }

  // ---------------------------------------------------------------- render
  render(dt) {
    const ctx = this.ctx;
    const { viewWidth: W, height: H } = this.road;
    const w = this.weather;

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= 0.92;
    }

    // Roadside environment
    ctx.fillStyle = w.sky;
    ctx.fillRect(-40, -40, W + 80, H + 80);
    if (!this._grassGrad || this._grassWeather !== w.id) {
      const grass = ctx.createLinearGradient(0, 0, 0, H);
      grass.addColorStop(0, w.id === "night" ? "#14301f" : "#3f6b3a");
      grass.addColorStop(1, w.id === "night" ? "#0f2418" : "#2f5730");
      this._grassGrad = grass;
      this._grassWeather = w.id;
    }
    ctx.fillStyle = this._grassGrad;
    ctx.fillRect(-40, -40, W + 80, H + 80);
    this.scenery.draw(ctx, this.road, w);

    // Asphalt
    ctx.fillStyle = w.asphalt;
    ctx.fillRect(this.road.left, -10, this.road.width, H + 20);

    // Shoulder lines
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(this.road.left - 4, 0, 5, H);
    ctx.fillRect(this.road.left + this.road.width - 1, 0, 5, H);

    // Lane markings: dashes stretch with speed so they never strobe backwards.
    const markAlpha = this.markAlpha ?? 0;
    if (markAlpha > 0.004) {
      const t = Math.max(0, Math.min(1, (this.player.speed - 90) / (CONFIG.speedMax - 90)));
      const dash = 52 + 170 * t;
      const gap = 46 - 20 * t;
      const period = dash + gap;
      const travel = this.roadScroll - (this._lastRoadScroll ?? this.roadScroll);
      this._lastRoadScroll = this.roadScroll;
      this._dashPhase = ((((this._dashPhase ?? 0) + travel / period) % 1) + 1) % 1;
      const offset = this._dashPhase * period;
      ctx.fillStyle = `rgba(255,255,255,${(0.72 * markAlpha).toFixed(3)})`;
      ctx.beginPath();
      for (let l = 1; l < this.laneSpan - 0.15; l++) {
        const x = this.road.left + this.road.laneW * l - 3;
        for (let y = -period + offset; y < H + period; y += period) {
          ctx.rect(x, y, 6, dash);
        }
      }
      ctx.fill();
    } else {
      this._lastRoadScroll = this.roadScroll;
    }

    // Oil patches
    ctx.fillStyle = "rgba(15,15,25,0.55)";
    for (const o of this.oilPatches) {
      if (o.y < -o.r || o.y > H + o.r) continue;
      ctx.beginPath();
      ctx.ellipse(this.road.laneToX(o.lane + 0.5), o.y, o.r, o.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cones
    ctx.fillStyle = "#ff7a1a";
    ctx.beginPath();
    for (const c of this.cones) {
      if (c.y < -30 || c.y > H + 30) continue;
      const x = this.road.laneToX(c.lane);
      ctx.moveTo(x, c.y - 14);
      ctx.lineTo(x + 11, c.y + 12);
      ctx.lineTo(x - 11, c.y + 12);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    for (const c of this.cones) {
      if (c.y < -30 || c.y > H + 30) continue;
      ctx.rect(this.road.laneToX(c.lane) - 7, c.y - 2, 14, 5);
    }
    ctx.fill();

    const night = w.id === "night" || w.id === "rain";
    this.traffic.draw(ctx, this.road, night);
    this.pickups.draw(ctx, this.road);
    this.bullets.draw(ctx, this.road);

    this.ghost.draw(ctx, this.road, this.playerY, this.score.distance);

    if (this.state !== STATE.CRASH || Math.floor(this.crashTimer * 12) % 2 === 0) {
      drawPlayer(ctx, this.player, this.road, this.playerY, night);
    }

    this.drawSpeedLines(ctx, W, H);

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Popups
    ctx.textAlign = "center";
    ctx.font = "700 22px 'Rajdhani', system-ui, sans-serif";
    for (const p of this.popups) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillText(p.text, p.x + 2, p.y + 2);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    if (w.rain) this.drawRain(ctx, dt, W, H);
    if (w.tint) {
      ctx.fillStyle = w.tint;
      ctx.fillRect(0, 0, W, H);
    }
    if (w.id === "night") this.drawHeadlightCone(ctx);

    ctx.restore();

    if (this.state === STATE.READY) this.drawReady(ctx, W, H);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0 && (this.state === STATE.PLAYING || this.state === STATE.READY)) {
      this.hudTimer = 0.08;
      this.ui.updateHUD(this.score, this.player.speed, {
        coins: this.coins,
        nitroCharges: this.nitroCharges,
        nitroRatio: Math.max(0, this.nitroTimer / CONFIG.nitroDuration),
      });
      this.ui.setGhost(this.ghost.active && !this.ghost.finished, this.ghost.delta);
      this.ui.setMirror(this.mirror.active, this.mirror.time);
      this.ui.setRearWarning(this.rearWarn.left, this.rearWarn.right);
    }
  }

  drawReady(ctx, W, H) {
    const n = Math.ceil(this.readyTimer);
    const info = this.ui.controlSummary();
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 120px 'Rajdhani', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;
    ctx.fillText(n > 0 ? String(n) : "GO!", W / 2, H / 2 - 40);

    const lines = info.lines;
    const boxW = 360;
    const boxH = 54 + lines.length * 30;
    const boxX = W / 2 - boxW / 2;
    const boxY = H / 2 + 20;
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(8,13,22,0.72)";
    roundRect(ctx, boxX, boxY, boxW, boxH, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.stroke();

    ctx.font = "700 16px 'Rajdhani', system-ui, sans-serif";
    ctx.fillStyle = "#25d3a8";
    ctx.fillText(info.title, W / 2, boxY + 30);
    ctx.font = "600 17px 'Rajdhani', system-ui, sans-serif";
    ctx.fillStyle = "rgba(234,242,255,0.9)";
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, boxY + 60 + i * 30);
    });
    ctx.restore();
  }

  drawSpeedLines(ctx, W, H) {
    const t = Math.max(0, (this.player.speed - 150) / (CONFIG.speedMax - 150));
    if (t <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = t * 0.5;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    const off = this.roadScroll % 160;
    for (let i = 0; i < 16; i++) {
      const x = ((i * 97) % W) + (i % 2) * 23;
      const y = ((i * 211 + off * 3) % (H + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 60 + t * 90);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRain(ctx, dt, W, H) {
    if (!this.rain) this.initRain();
    ctx.save();
    ctx.strokeStyle = "rgba(200,225,255,0.45)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const d of this.rain) {
      d.y += (d.sp + this.player.speed * 3) * dt;
      if (d.y > H) {
        d.y = -20;
        d.x = Math.random() * W;
      }
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 3, d.y + d.len);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawHeadlightCone(ctx) {
    const x = this.road.laneToX(this.player.lane);
    const y = this.playerY - 48;
    const g = ctx.createRadialGradient(x, y, 10, x, y, 340);
    g.addColorStop(0, "rgba(255,244,200,0.20)");
    g.addColorStop(1, "rgba(255,244,200,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 22, y);
    ctx.lineTo(x - 190, y - 340);
    ctx.lineTo(x + 190, y - 340);
    ctx.lineTo(x + 22, y);
    ctx.closePath();
    ctx.fill();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.__game = new Game();
});
