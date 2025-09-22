// --- Noise + terrain generation ------------------------------------------------------------
import { CONFIG } from './config.js';
import { createSeededRandom, fade, lerp, grad } from './utils.js';

export class PerlinNoise {
  constructor(seed) {
    this.permutation = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    const rand = createSeededRandom(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.permutation[i] = p[i & 255];
    }
  }

  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const tl = this.permutation[this.permutation[X] + Y + 1];
    const tr = this.permutation[this.permutation[X + 1] + Y + 1];
    const bl = this.permutation[this.permutation[X] + Y];
    const br = this.permutation[this.permutation[X + 1] + Y];

    const u = fade(xf);
    const v = fade(yf);

    const x1 = lerp(grad(bl, xf, yf), grad(br, xf - 1, yf), u);
    const x2 = lerp(grad(tl, xf, yf - 1), grad(tr, xf - 1, yf - 1), u);

    return lerp(x1, x2, v);
  }
}

export class TerrainGenerator {
  constructor(seed) {
    this.heightNoise = new PerlinNoise(seed);
    this.hillNoise = new PerlinNoise(seed + 1);
    this.detailNoise = new PerlinNoise(seed + 2);
    this.treeNoise = new PerlinNoise(seed + 3);
    this.heightCache = new Map();
    this.treeCache = new Map();
  }

  key(x, z) {
    return `${x},${z}`;
  }

  getHeightAt(x, z) {
    // Blend multiple noise octaves to get rolling hills with small detail.
    const key = this.key(x, z);
    if (this.heightCache.has(key)) {
      return this.heightCache.get(key);
    }
    const base = this.heightNoise.noise2D(x * 0.01, z * 0.01) * 12;
    const hills = this.hillNoise.noise2D(x * 0.004, z * 0.004) * 18 * 0.6;
    const detail = this.detailNoise.noise2D(x * 0.03, z * 0.03) * 5 * 0.5;
    let height = Math.round(CONFIG.WATER_LEVEL + base + hills + detail - 4);
    height = Math.max(4, Math.min(CONFIG.CHUNK_HEIGHT - 2, height));
    this.heightCache.set(key, height);
    return height;
  }

  getTreeHeightAt(x, z) {
    // Sample low-frequency noise to decide where trees spawn and prefer local peaks.
    const key = this.key(x, z);
    if (this.treeCache.has(key)) {
      return this.treeCache.get(key);
    }
    const noiseValue = (this.treeNoise.noise2D(x * 0.05, z * 0.05) + 1) * 0.5;
    let height = 0;
    if (noiseValue > 0.74) {
      let isPeak = true;
      for (let dx = -1; dx <= 1 && isPeak; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dz === 0) continue;
          const neighbor = (this.treeNoise.noise2D((x + dx) * 0.05, (z + dz) * 0.05) + 1) * 0.5;
          if (neighbor > noiseValue) {
            isPeak = false;
            break;
          }
        }
      }
      if (isPeak && this.getHeightAt(x, z) > CONFIG.WATER_LEVEL + 1) {
        height = 4 + Math.round(noiseValue * 2);
      }
    }
    this.treeCache.set(key, height);
    return height;
  }
}
