// --- Procedural textures -------------------------------------------------------------------
import { CONFIG } from './config.js?v=0.1.11';
import { BLOCK_DEFS, TILE } from './blocks.js?v=0.1.11';
import { createSeededRandom } from './utils.js?v=0.1.11';
const THREE = window.THREE;
if (!THREE) {
  throw new Error('THREE.js must be loaded before textureAtlas.js');
}

export function buildTextureAtlas() {
  // Build a small atlas of 16x16 procedural textures for each block face at runtime.
  const tileSize = 16;
  const tileSet = new Set();
  for (const def of BLOCK_DEFS) {
    if (!def) continue;
    for (const face of def.faces) {
      if (face) tileSet.add(face);
    }
  }
  const tiles = Array.from(tileSet);
  const cols = Math.ceil(Math.sqrt(tiles.length));
  const rows = Math.ceil(tiles.length / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * tileSize;
  canvas.height = rows * tileSize;
  const ctx = canvas.getContext('2d');
  const rng = createSeededRandom(CONFIG.WORLD_SEED * 977);

  const generators = {
    [TILE.GRASS_TOP]: (ctx, s) => {
      ctx.fillStyle = '#3d8b3d';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 100; i++) {
        const shade = 120 + Math.floor(rng() * 60);
        ctx.fillStyle = `rgb(${shade * 0.55}, ${shade}, ${shade * 0.55})`;
        ctx.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 1, 1);
      }
    },
    [TILE.GRASS_SIDE]: (ctx, s) => {
      const turfHeight = Math.floor(s * 0.35);
      ctx.fillStyle = '#6b4c2a';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#4b7a32';
      ctx.fillRect(0, 0, s, turfHeight);
      ctx.fillStyle = '#6b4c2a';
      ctx.fillRect(0, turfHeight, s, s - turfHeight);
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = `rgba(90, ${120 + Math.floor(rng() * 50)}, 70, 0.6)`;
        ctx.fillRect(Math.floor(rng() * s), turfHeight + Math.floor(rng() * (s - turfHeight)), 1, 1);
      }
    },
    [TILE.DIRT]: (ctx, s) => {
      ctx.fillStyle = '#6e4321';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 80; i++) {
        const shade = 70 + Math.floor(rng() * 50);
        ctx.fillStyle = `rgba(${shade}, ${shade * 0.7}, ${shade * 0.4}, 0.7)`;
        ctx.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 1, 1);
      }
    },
    [TILE.STONE]: (ctx, s) => {
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 120; i++) {
        const shade = 100 + Math.floor(rng() * 80);
        ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.6)`;
        ctx.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 1, 1);
      }
    },
    [TILE.WOOD_SIDE]: (ctx, s) => {
      ctx.fillStyle = '#8e6431';
      ctx.fillRect(0, 0, s, s);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#c29456';
      ctx.fillRect(0, 0, s, s);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(60, 36, 12, 0.7)';
      ctx.lineWidth = 1.5;
      for (let x = 1; x < s; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x + rng() * 0.6, 0);
        ctx.lineTo(x - rng() * 0.6, s);
        ctx.stroke();
      }
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(60, 35, 12, ${0.3 + rng() * 0.4})`;
        ctx.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 1, 1);
      }
    },
    [TILE.WOOD_TOP]: (ctx, s) => {
      ctx.fillStyle = '#b88f53';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#8f693d';
      ctx.lineWidth = 1;
      for (let r = s / 2; r > 2; r -= 3) {
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, r + rng() * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    [TILE.LEAVES]: (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      for (let i = 0; i < 160; i++) {
        const shade = 90 + Math.floor(rng() * 60);
        ctx.fillStyle = `rgba(${shade * 0.45}, ${shade}, ${shade * 0.45}, ${0.35 + rng() * 0.5})`;
        const x = rng() * s;
        const y = rng() * s;
        const r = rng() * 2 + 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [TILE.SAND]: (ctx, s) => {
      ctx.fillStyle = '#d9ca8f';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 80; i++) {
        const shade = 190 + Math.floor(rng() * 40);
        ctx.fillStyle = `rgba(${shade}, ${shade - 10}, ${shade - 30}, 0.6)`;
        ctx.fillRect(Math.floor(rng() * s), Math.floor(rng() * s), 1, 1);
      }
    }
  };

  const uvMap = {};
  tiles.forEach((name, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    ctx.save();
    ctx.translate(col * tileSize, row * tileSize);
    const generator = generators[name];
    if (generator) {
      generator(ctx, tileSize);
    } else {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(0, 0, tileSize, tileSize);
    }
    ctx.restore();

    const pad = 0.5;
    const u0 = (col * tileSize + pad) / canvas.width;
    const v0 = 1 - ((row + 1) * tileSize - pad) / canvas.height;
    const u1 = ((col + 1) * tileSize - pad) / canvas.width;
    const v1 = 1 - (row * tileSize + pad) / canvas.height;
    uvMap[name] = { u0, v0, u1, v1 };
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return { texture, uvs: uvMap };
}
