// Shared canvas helpers: procedural shapes plus a sprite cache so repeated
// vehicles are rasterised once and blitted every frame.
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

const shadeCache = new Map();

function shade(hex, amount) {
  const key = hex + amount;
  let out = shadeCache.get(key);
  if (out) return out;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  out = `rgb(${r},${g},${b})`;
  shadeCache.set(key, out);
  return out;
}

const SPRITE_PAD = 18;
const SPRITE_LIMIT = 256;
const spriteCache = new Map();

// Rasterises a draw callback into a reusable canvas sized (w + pad, h + pad).
export function getSprite(key, w, h, paint, pad = SPRITE_PAD) {
  const cw = Math.ceil(w + pad * 2);
  const ch = Math.ceil(h + pad * 2);
  const cacheKey = `${key}|${cw}x${ch}`;
  const hit = spriteCache.get(cacheKey);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(cw * dpr);
  canvas.height = Math.ceil(ch * dpr);
  const sctx = canvas.getContext("2d");
  sctx.scale(dpr, dpr);
  sctx.translate(cw / 2, ch / 2);
  paint(sctx);

  const sprite = { canvas, w: cw, h: ch };
  if (spriteCache.size >= SPRITE_LIMIT) {
    spriteCache.delete(spriteCache.keys().next().value);
  }
  spriteCache.set(cacheKey, sprite);
  return sprite;
}

export function clearSpriteCache() {
  spriteCache.clear();
}

export function blitSprite(ctx, sprite, cx, cy, tilt) {
  if (tilt) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
    ctx.restore();
    return;
  }
  ctx.drawImage(sprite.canvas, cx - sprite.w / 2, cy - sprite.h / 2, sprite.w, sprite.h);
}

// Paints a top-down vehicle centred on the current origin, facing up.
function paintVehicle(ctx, w, h, type, color, lightsOn, braking) {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  roundRect(ctx, -w / 2 + 3, -h / 2 + 6, w, h, 10);
  ctx.fill();

  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  grad.addColorStop(0, shade(color, -38));
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, shade(color, -55));
  ctx.fillStyle = grad;
  roundRect(ctx, -w / 2, -h / 2, w, h, type === "moto" ? w / 2.4 : 10);
  ctx.fill();

  if (type === "moto") {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundRect(ctx, -w / 2 + 2, -h * 0.12, w - 4, h * 0.26, 4);
    ctx.fill();
  } else if (type === "truck") {
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    roundRect(ctx, -w / 2 + 4, -h / 2 + h * 0.26, w - 8, h * 0.6, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(160,205,235,0.85)";
    roundRect(ctx, -w / 2 + 6, -h / 2 + 8, w - 12, h * 0.13, 4);
    ctx.fill();
  } else if (type === "bus") {
    ctx.fillStyle = "rgba(160,205,235,0.8)";
    roundRect(ctx, -w / 2 + 5, -h / 2 + 7, w - 10, h * 0.1, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i < 4; i++) {
      roundRect(ctx, -w / 2 + 4, -h / 2 + h * (0.24 + i * 0.17), w - 8, h * 0.1, 3);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "rgba(150,200,235,0.9)";
    roundRect(ctx, -w / 2 + 5, -h / 2 + h * 0.16, w - 10, h * 0.16, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(120,170,210,0.75)";
    roundRect(ctx, -w / 2 + 5, h / 2 - h * 0.32, w - 10, h * 0.14, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    roundRect(ctx, -w / 2 + 6, -h * 0.1, w - 12, h * 0.2, 4);
    ctx.fill();
  }

  ctx.fillStyle = lightsOn ? "#fff6c9" : "rgba(255,246,201,0.55)";
  roundRect(ctx, -w / 2 + 4, -h / 2 + 2, w * 0.2, 5, 2);
  ctx.fill();
  roundRect(ctx, w / 2 - 4 - w * 0.2, -h / 2 + 2, w * 0.2, 5, 2);
  ctx.fill();

  ctx.fillStyle = braking ? "#ff3b2f" : "rgba(190,45,40,0.85)";
  roundRect(ctx, -w / 2 + 4, h / 2 - 7, w * 0.2, 5, 2);
  ctx.fill();
  roundRect(ctx, w / 2 - 4 - w * 0.2, h / 2 - 7, w * 0.2, 5, 2);
  ctx.fill();
  if (braking) {
    ctx.fillStyle = "rgba(255,60,45,0.28)";
    roundRect(ctx, -w / 2, h / 2 - 4, w, 18, 8);
    ctx.fill();
  }
}

// Cached top-down vehicle. Siren lights stay live so they can blink.
export function drawVehicle(ctx, cx, cy, w, h, opts = {}) {
  const {
    color = "#e34d4d",
    type = "car",
    braking = false,
    lightsOn = false,
    siren = 0,
    tilt = 0,
  } = opts;

  const rw = Math.round(w);
  const key = `v:${type}:${color}:${lightsOn ? 1 : 0}:${braking ? 1 : 0}`;
  const sprite = getSprite(key, rw, h, (sctx) =>
    paintVehicle(sctx, rw, h, type, color, lightsOn, braking),
  );

  if (siren <= 0) {
    blitSprite(ctx, sprite, cx, cy, tilt);
    return;
  }

  ctx.save();
  ctx.translate(cx, cy);
  if (tilt) ctx.rotate(tilt);
  ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
  ctx.fillStyle = Math.sin(siren * 12) > 0 ? "#3d7bff" : "#ff3b3b";
  roundRect(ctx, -rw * 0.28, -h * 0.05, rw * 0.56, 7, 3);
  ctx.fill();
  ctx.restore();
}
