// Parallax roadside scenery. Every item is rasterised once into a cached
// sprite and blitted afterwards, so a busy frame stays cheap.
import { getSprite, blitSprite } from "./draw.js";

const LAYERS = [
  { kind: "tree", parallax: 0.62, spacing: 190, offset: 150, jitter: 60 },
  { kind: "tree", parallax: 0.78, spacing: 240, offset: 104, jitter: 26 },
  { kind: "pole", parallax: 0.9, spacing: 480, offset: 126, jitter: 0 },
  { kind: "light", parallax: 1.0, spacing: 520, offset: 52, jitter: 0 },
  { kind: "sign", parallax: 1.0, spacing: 560, offset: 86, jitter: 0 },
  { kind: "barrier", parallax: 1.06, spacing: 44, offset: 22, jitter: 0 },
];

const SIGNS = ["90", "SLOW", "⚠", "EXIT", "110"];
const TREE_SCALE_STEPS = 6;

function rand(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function tree(ctx, s, night) {
  ctx.fillStyle = night ? "#241b12" : "#5a3d24";
  ctx.fillRect(-4 * s, 0, 8 * s, 26 * s);
  const g = ctx.createRadialGradient(-8 * s, -26 * s, 4, 0, -14 * s, 40 * s);
  g.addColorStop(0, night ? "#1c4029" : "#5aa04c");
  g.addColorStop(1, night ? "#0e2418" : "#22522a");
  ctx.fillStyle = g;
  for (let i = 0; i < 3; i++) {
    const r = (26 - i * 5) * s;
    ctx.beginPath();
    ctx.ellipse(0, -(8 + i * 13) * s, r + 4 * s, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pole(ctx, night) {
  ctx.fillStyle = night ? "#3a3f47" : "#6f7681";
  ctx.fillRect(-3, -130, 6, 160);
  ctx.fillRect(-22, -126, 44, 5);
  ctx.fillRect(-18, -108, 36, 4);
  ctx.strokeStyle = night ? "rgba(30,34,40,0.8)" : "rgba(60,66,74,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-20, -124);
  ctx.quadraticCurveTo(-20, -90, -20, -60);
  ctx.stroke();
}

function streetLight(ctx, side, night) {
  const armDir = side < 0 ? 1 : -1;
  const top = -150;
  ctx.fillStyle = night ? "#454b55" : "#8d949f";
  ctx.fillRect(-3.5, top, 7, 172);
  ctx.beginPath();
  ctx.moveTo(0, top + 4);
  ctx.quadraticCurveTo(armDir * 34, top - 6, armDir * 56, top + 12);
  ctx.lineWidth = 6;
  ctx.strokeStyle = night ? "#454b55" : "#8d949f";
  ctx.stroke();

  const lx = armDir * 56;
  const ly = top + 14;
  ctx.fillStyle = night ? "#ffe9ad" : "#c9cdd4";
  ctx.fillRect(lx - 9, ly, 18, 6);
}

const GLOW_R = 150;

function lampGlow(ctx) {
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, GLOW_R);
  g.addColorStop(0, "rgba(255,230,160,0.20)");
  g.addColorStop(1, "rgba(255,230,160,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, GLOW_R, 0, Math.PI * 2);
  ctx.fill();
}

function sign(ctx, label, night) {
  ctx.fillStyle = night ? "#3c424b" : "#767d88";
  ctx.fillRect(-3, -40, 6, 70);
  ctx.fillStyle = night ? "#cdd5df" : "#f2f5f8";
  ctx.beginPath();
  ctx.arc(0, -56, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d33a33";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#1d2129";
  ctx.font = "700 15px 'Rajdhani', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, -55);
}

function barrier(ctx, night) {
  ctx.fillStyle = night ? "rgba(104,112,124,0.65)" : "rgba(150,158,170,0.9)";
  ctx.fillRect(-2, 8, 4, 18);
  ctx.fillStyle = night ? "rgba(150,158,170,0.6)" : "rgba(226,231,238,0.95)";
  ctx.fillRect(-5, -2, 10, 46);
  ctx.fillStyle = night ? "rgba(60,66,76,0.5)" : "rgba(120,128,140,0.35)";
  ctx.fillRect(-5, 18, 10, 3);
}

export class Scenery {
  constructor() {
    this.scroll = 0;
  }

  reset() {
    this.scroll = 0;
  }

  update(scrollSpeed, dt) {
    this.scroll += scrollSpeed * dt;
  }

  draw(ctx, road, weather) {
    const H = road.height;
    const night = weather.id === "night" || weather.id === "rain";
    const n = night ? 1 : 0;

    for (const layer of LAYERS) {
      const travel = this.scroll * layer.parallax;
      const off = travel % layer.spacing;
      let idx = 0;
      for (let y = -layer.spacing + off; y < H + layer.spacing; y += layer.spacing) {
        const row = Math.floor((travel + y) / layer.spacing);
        for (let side = -1; side <= 1; side += 2) {
          const seed = row * 7 + side * 3 + layer.parallax * 100 + idx;
          const jitter = layer.jitter ? (rand(seed) - 0.5) * layer.jitter : 0;
          const dist = layer.offset + Math.abs(jitter);
          const x = side < 0 ? road.left - dist : road.left + road.width + dist;
          this.blit(ctx, layer.kind, x, y, side, seed, n, H);
        }
        idx++;
      }
    }
  }

  blit(ctx, kind, x, y, side, seed, night, H) {
    let sprite = null;

    if (kind === "tree") {
      if (y < -120 || y > H + 120) return;
      const step = Math.round(rand(seed) * (TREE_SCALE_STEPS - 1));
      const s = 0.75 + (step / (TREE_SCALE_STEPS - 1)) * 0.6;
      sprite = getSprite(
        `tree:${step}:${night}`,
        81 * s,
        100 * s,
        (c) => tree(c, s, night),
        3,
      );
    } else if (kind === "pole") {
      if (y < -180 || y > H + 180) return;
      sprite = getSprite(`pole:${night}`, 48, 264, (c) => pole(c, night), 3);
    } else if (kind === "light") {
      if (y < -190 || y > H + 190) return;
      if (night) {
        const glow = getSprite("lampGlow", GLOW_R * 2, GLOW_R * 2, lampGlow, 1);
        const lx = side < 0 ? x + 56 : x - 56;
        blitSprite(ctx, glow, lx, y - 130, 0);
      }
      sprite = getSprite(`light:${side}:${night}`, 134, 348, (c) => streetLight(c, side, night), 3);
    } else if (kind === "sign") {
      if (rand(seed) <= 0.35) return;
      if (y < -120 || y > H + 120) return;
      const label = SIGNS[Math.floor(rand(seed + 11) * SIGNS.length)];
      sprite = getSprite(`sign:${label}:${night}`, 48, 152, (c) => sign(c, label, night), 3);
    } else if (kind === "barrier") {
      if (y < -80 || y > H + 80) return;
      sprite = getSprite(`barrier:${night}`, 10, 88, (c) => barrier(c, night), 2);
    }

    if (sprite) blitSprite(ctx, sprite, x, y, 0);
  }
}
