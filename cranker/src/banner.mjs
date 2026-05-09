// Generate a 1500x500 banner with 12 curated bulls in a 6x2 grid (no gaps).
// Each cell is 250x250; bulls are nearest-neighbor scaled from 24x24 to 250x250.
// Curated for visual variety - all 12 are intentionally distinct.
//
// Run: node bullpeg-sol/cranker/src/banner.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { encodePng, svgToPixels } from './svg_to_png.mjs';
import * as renderer from './renderer.mjs';

const BANNER_W = 1500;
const BANNER_H = 500;
const COLS = 6;
const ROWS = 2;
const CELL = BANNER_W / COLS; // 250 (also = BANNER_H/ROWS)
if (CELL !== BANNER_H / ROWS) throw new Error('cells must be square');

// 12 hand-curated bulls. Each row of the BULLS array is one cell, indexed
// against the *_NAMES arrays in renderer.mjs.
//
// BODY (9):   0 brown, 1 black, 2 white, 3 red, 4 golden, 5 cyan, 6 pink, 7 zombie, 8 holo
// HORN (5):   0 ivory, 1 dark, 2 gold, 3 crimson, 4 silver
// EYE (8):    0 normal, 1 golden, 2 void, 3 green, 4 closed, 5 angry, 6 crying, 7 ski_mask
// BG (7):     0 pasture, 1 sand, 2 sunset, 3 chart, 4 void, 5 sky, 6 crimson
// ACC (26):   0 none, 5 cowboy_hat, 6 dubai_hat, 7 strawberry_hat, 9 crown, 10 halo,
//             13 fire_aura, 19 sheriff_hat, 20 tiara, 21 halo_stars
// EYEWEAR(9): 0 none, 1 mog, 2 sunglasses_classic, 3 clout_shades, 5 3d_glasses
// MOUTH(11):  0 none, 1 cigarette, 4 smug, 5 bubblegum, 6 smile
const BULLS = [
  { body: 0, horn: 0, eye: 0, bg: 0, acc: 20, eyewear: 0, mouth: 0 }, // brown / tiara classic
  { body: 1, horn: 2, eye: 0, bg: 5, acc: 9,  eyewear: 1, mouth: 0 }, // black / crown / mog
  { body: 2, horn: 3, eye: 0, bg: 1, acc: 5,  eyewear: 0, mouth: 1 }, // white / cowboy / cigarette
  { body: 3, horn: 1, eye: 5, bg: 6, acc: 0,  eyewear: 0, mouth: 0 }, // red angry bull-market
  { body: 4, horn: 4, eye: 0, bg: 1, acc: 13, eyewear: 0, mouth: 0 }, // golden / fire_aura
  { body: 5, horn: 2, eye: 1, bg: 3, acc: 0,  eyewear: 5, mouth: 0 }, // cyan / 3d glasses
  { body: 6, horn: 4, eye: 0, bg: 5, acc: 10, eyewear: 0, mouth: 6 }, // pink / halo / smile
  { body: 7, horn: 1, eye: 2, bg: 4, acc: 19, eyewear: 0, mouth: 0 }, // zombie / sheriff
  { body: 8, horn: 4, eye: 4, bg: 4, acc: 21, eyewear: 0, mouth: 0 }, // holo / halo_stars (legendary stack)
  { body: 0, horn: 1, eye: 6, bg: 2, acc: 7,  eyewear: 3, mouth: 5 }, // brown / strawberry / clout / bubblegum
  { body: 1, horn: 0, eye: 7, bg: 3, acc: 0,  eyewear: 0, mouth: 0 }, // black / ski_mask
  { body: 4, horn: 2, eye: 0, bg: 0, acc: 6,  eyewear: 2, mouth: 0 }, // golden / dubai / sunglasses
];

// Current weights (must mirror renderer.mjs)
const W = {
  body:    [30, 25, 12, 10,  6,  6,  6,  4,  1],
  horn:    [55, 18, 15,  7,  5],
  eye:     [55,  3,  3,  3, 14, 12,  8,  1],
  bg:      [28, 22, 14, 12,  4, 16,  4],
  acc:     [36,  0,  6,  0,  6,  6,  2,  3,  3,  3,  2,  0,  2,  2,  3,  6,  3,  3,  3,  6,  3,  1,  3,  0,  0,  2],
  eyewear: [50,  6, 12, 12,  6, 12,  0,  0,  2],
  mouth:   [68,  6,  0,  2,  0,  6,  0,  6,  6,  6,  0],
};

function findByte(weights, desired) {
  const total = weights.reduce((a, b) => a + b, 0);
  for (let b = 0; b < 256; b++) {
    let acc = 0;
    const r = (b / 256) * total;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (r < acc) {
        if (i === desired) return b;
        break;
      }
    }
  }
  return 255;
}

function forcedSeed(forced, idx) {
  const seed = crypto.createHash('sha256')
    .update('cryptobulls-banner-' + idx).digest();
  const patched = Buffer.from(seed);
  patched[0] = findByte(W.body,    forced.body);
  patched[1] = findByte(W.horn,    forced.horn);
  patched[2] = findByte(W.eye,     forced.eye);
  patched[3] = findByte(W.bg,      forced.bg);
  patched[4] = findByte(W.acc,     forced.acc);
  patched[5] = findByte(W.eyewear, forced.eyewear);
  patched[6] = findByte(W.mouth,   forced.mouth);
  return patched;
}

// Nearest-neighbor scale 24x24 RGB -> CELL x CELL (non-integer ratio).
function scaleNN(src24, dstW, dstH) {
  const out = Buffer.alloc(dstW * dstH * 3);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.floor((y * 24) / dstH);
    for (let x = 0; x < dstW; x++) {
      const sx = Math.floor((x * 24) / dstW);
      const si = (sy * 24 + sx) * 3;
      const di = (y * dstW + x) * 3;
      out[di + 0] = src24[si + 0];
      out[di + 1] = src24[si + 1];
      out[di + 2] = src24[si + 2];
    }
  }
  return out;
}

const OUT_DIR = path.resolve(import.meta.dirname, '..', '..', 'samples', 'banners');
fs.mkdirSync(OUT_DIR, { recursive: true });

const out = Buffer.alloc(BANNER_W * BANNER_H * 3);
console.log(`Composing ${BULLS.length} bulls into ${BANNER_W}x${BANNER_H} (${COLS}x${ROWS} grid, ${CELL}x${CELL} cells, no gaps)...`);

const tags = [];
for (let i = 0; i < BULLS.length; i++) {
  const seed = forcedSeed(BULLS[i], i);
  const { svg, names } = renderer.renderBullSvg(seed, 24);
  const { rgb: rgb24 } = svgToPixels(svg, 1); // 24x24
  const rgbCell = scaleNN(rgb24, CELL, CELL);

  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const ox = col * CELL;
  const oy = row * CELL;

  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const si = (y * CELL + x) * 3;
      const di = ((oy + y) * BANNER_W + (ox + x)) * 3;
      out[di + 0] = rgbCell[si + 0];
      out[di + 1] = rgbCell[si + 1];
      out[di + 2] = rgbCell[si + 2];
    }
  }
  const tag = `body=${names.body} horn=${names.horn} eye=${names.eye} bg=${names.bg} acc=${names.acc} eyewear=${names.eyewear} mouth=${names.mouth}`;
  tags.push(tag);
  console.log(`  #${i + 1}: ${tag}`);
}

const png = encodePng(BANNER_W, BANNER_H, out);
const outPath = path.join(OUT_DIR, 'banner_1500x500.png');
fs.writeFileSync(outPath, png);
console.log(`\nWrote ${BANNER_W}x${BANNER_H} banner to ${outPath} (${png.length} bytes)`);

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>CryptoBulls Banner Preview</title>
<style>
  body { background:#0a0a0c; color:#e8e4dc; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; padding:24px; margin:0; }
  h1 { color:#f0d028; }
  img { max-width:100%; height:auto; display:block; image-rendering:pixelated; border-radius:8px; box-shadow:0 8px 32px rgba(0,0,0,0.5); }
  .info { margin-top:16px; color:#888; font-size:13px; line-height:1.6; }
  .info span { color:#e8e4dc; }
  ul { padding-left:20px; }
  li { color:#888; font-size:12px; line-height:1.6; }
</style></head><body>
<h1>CryptoBulls Banner</h1>
<p class="info"><span>1500 x 500</span> &middot; 12 curated bulls &middot; 6 x 2 grid &middot; no gaps &middot; X / Twitter header ready</p>
<img src="banner_1500x500.png" alt="CryptoBulls banner">
<p class="info" style="margin-top:24px;">Bulls (left to right, top to bottom):</p>
<ul>
${tags.map((t, i) => `<li><span style="color:#f0d028">#${i + 1}</span> ${t}</li>`).join('\n')}
</ul>
</body></html>`;
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
console.log(`Open: ${path.join(OUT_DIR, 'index.html')}`);
