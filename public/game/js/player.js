import { CONFIG } from "../config.js";
import { roundRect, getSprite, blitSprite } from "./draw.js";

export function createPlayer() {
  return {
    lane: 1.5, // continuous lane position (0..lanes-1)
    targetLane: 1,
    laneVel: 0,
    speed: CONFIG.speedIdle,
    braking: false,
    accelerating: false,
    grip: 1,
    brakeMul: 1,
    nitro: false,
  };
}

export function resetPlayer(p) {
  p.lane = 1.5;
  p.targetLane = 1;
  p.laneVel = 0;
  p.speed = CONFIG.speedIdle;
  p.braking = false;
  p.accelerating = false;
  p.grip = 1;
  p.brakeMul = 1;
  p.nitro = false;
}

export function updatePlayer(p, dt, controls, laneMax = CONFIG.lanes - 1) {
  if (controls.isMobileMode) {
    // Proportional tilt / swipe steering.
    const tilt = controls.analogSteer();
    p.targetLane = Math.max(0, Math.min(laneMax, p.targetLane + tilt * controls.steerRate * dt));
    controls.consumeLaneRequest();
  } else {
    const req = controls.consumeLaneRequest();
    if (req !== 0) {
      p.targetLane = Math.max(
        0,
        Math.min(Math.floor(laneMax + 0.001), Math.round(p.targetLane) + req),
      );
    }
  }
  if (p.targetLane > laneMax) p.targetLane = laneMax;

  p.accelerating = controls.accelerating;
  p.braking = controls.braking;

  const topSpeed = CONFIG.speedMax + (p.nitro ? CONFIG.nitroSpeedBonus : 0);
  if (p.nitro) p.speed += CONFIG.nitroAccel * dt;
  else if (p.braking) p.speed -= CONFIG.brake * (p.brakeMul ?? 1) * dt;
  else if (p.accelerating) p.speed += CONFIG.accel * dt;
  else if (p.speed > CONFIG.speedIdle) p.speed -= CONFIG.coastDrag * dt;
  else p.speed += CONFIG.coastDrag * 0.6 * dt;

  p.speed = Math.max(CONFIG.speedMin, Math.min(topSpeed, p.speed));

  // Smooth steering toward the target lane.
  const diff = p.targetLane - p.lane;
  p.laneVel += diff * CONFIG.steerAccel * dt * p.grip;
  p.laneVel *= Math.pow(CONFIG.steerDamp, dt * 60);
  p.laneVel = Math.max(-CONFIG.steerMaxVel, Math.min(CONFIG.steerMaxVel, p.laneVel));
  p.lane += p.laneVel * dt;

  const edge = 0.42;
  if (p.lane < -edge) {
    p.lane = -edge;
    p.laneVel = 0;
  }
  if (p.lane > laneMax + edge) {
    p.lane = laneMax + edge;
    p.laneVel = 0;
  }
}

export function drawPlayer(ctx, p, road, y, night) {
  const w = Math.round(Math.min(road.laneW * 0.52, 62));
  const h = 118;
  const opts = { nitro: p.nitro, braking: p.braking, lightsOn: night };
  const key = `f1:${p.nitro ? 1 : 0}:${p.braking ? 1 : 0}:${night ? 1 : 0}`;
  const sprite = getSprite(key, w, h, (sctx) => drawF1Car(sctx, w, h, opts));
  blitSprite(
    ctx,
    sprite,
    road.laneToX(p.lane),
    y,
    Math.max(-0.16, Math.min(0.16, p.laneVel * 0.05)),
  );
}

// Top-down open-wheel Formula 1 car — used for the player only.
function drawF1Car(ctx, w, h, opts = {}) {
  const { nitro = false, braking = false, lightsOn = false } = opts;
  const body = nitro ? "#3ad2ff" : "#25d3a8";
  const dark = nitro ? "#0d6c92" : "#0e6f59";

  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  roundRect(ctx, -w / 2 + 3, -h / 2 + 7, w, h, 12);
  ctx.fill();

  const wheelW = w * 0.24;
  const frontWheelH = h * 0.19;
  const rearWheelH = h * 0.22;
  const frontAxle = -h * 0.26;
  const rearAxle = h * 0.24;
  const frontTrack = w * 0.5;
  const rearTrack = w * 0.44;

  const drawWheel = (x, yy, ww, hh) => {
    ctx.fillStyle = "#15171c";
    roundRect(ctx, x - ww / 2, yy - hh / 2, ww, hh, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x - ww / 2 + 1.5, yy - hh * 0.12, ww - 3, hh * 0.1);
    ctx.fillStyle = "rgba(210,215,225,0.5)";
    ctx.fillRect(x - ww / 2 + 2, yy - hh * 0.34, ww - 4, 2);
  };

  // suspension arms
  ctx.strokeStyle = "rgba(20,24,30,0.85)";
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * w * 0.06, frontAxle + 4);
    ctx.lineTo(s * frontTrack, frontAxle);
    ctx.moveTo(s * w * 0.07, rearAxle - 4);
    ctx.lineTo(s * rearTrack, rearAxle);
    ctx.stroke();
  }

  drawWheel(-frontTrack, frontAxle, wheelW, frontWheelH);
  drawWheel(frontTrack, frontAxle, wheelW, frontWheelH);
  drawWheel(-rearTrack, rearAxle, wheelW * 1.14, rearWheelH);
  drawWheel(rearTrack, rearAxle, wheelW * 1.14, rearWheelH);

  // front wing
  ctx.fillStyle = dark;
  roundRect(ctx, -w * 0.62, -h / 2, w * 1.24, h * 0.075, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(-w * 0.6, -h / 2 + 2, w * 1.2, 2);

  // nose cone + monocoque
  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  grad.addColorStop(0, dark);
  grad.addColorStop(0.4, body);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -h / 2 + h * 0.02);
  ctx.lineTo(w * 0.11, -h * 0.2);
  ctx.lineTo(w * 0.2, h * 0.06);
  ctx.lineTo(w * 0.17, h * 0.34);
  ctx.lineTo(-w * 0.17, h * 0.34);
  ctx.lineTo(-w * 0.2, h * 0.06);
  ctx.lineTo(-w * 0.11, -h * 0.2);
  ctx.closePath();
  ctx.fill();

  // sidepods
  ctx.fillStyle = dark;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * w * 0.18, -h * 0.02);
    ctx.lineTo(s * w * 0.36, h * 0.06);
    ctx.lineTo(s * w * 0.32, h * 0.3);
    ctx.lineTo(s * w * 0.17, h * 0.32);
    ctx.closePath();
    ctx.fill();
  }

  // cockpit + halo
  ctx.fillStyle = "rgba(12,16,22,0.9)";
  roundRect(ctx, -w * 0.1, -h * 0.09, w * 0.2, h * 0.19, 6);
  ctx.fill();
  ctx.fillStyle = "#e7edf5";
  ctx.beginPath();
  ctx.arc(0, -h * 0.015, w * 0.062, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(230,236,245,0.8)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, -h * 0.02, w * 0.115, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // airbox + engine cover stripe
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundRect(ctx, -w * 0.045, h * 0.1, w * 0.09, h * 0.2, 3);
  ctx.fill();

  // rear wing
  ctx.fillStyle = dark;
  roundRect(ctx, -w * 0.5, h / 2 - h * 0.1, w, h * 0.055, 3);
  ctx.fill();
  ctx.fillStyle = body;
  roundRect(ctx, -w * 0.5, h / 2 - h * 0.045, w, h * 0.05, 3);
  ctx.fill();

  // headlight glow (visual aid at night) + rain light
  if (lightsOn) {
    ctx.fillStyle = "rgba(255,246,201,0.85)";
    ctx.fillRect(-w * 0.16, -h / 2 + h * 0.08, w * 0.32, 3);
  }
  ctx.fillStyle = braking ? "#ff3b2f" : "rgba(190,45,40,0.85)";
  roundRect(ctx, -w * 0.06, h / 2 - h * 0.02, w * 0.12, 5, 2);
  ctx.fill();
  if (braking) {
    ctx.fillStyle = "rgba(255,60,45,0.3)";
    roundRect(ctx, -w * 0.5, h / 2 - h * 0.02, w, 16, 8);
    ctx.fill();
  }
}
