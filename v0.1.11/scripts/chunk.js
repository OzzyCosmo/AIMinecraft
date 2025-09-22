// --- Chunk container -----------------------------------------------------------------------
import { CONFIG, CHUNK_AREA, CHUNK_VOLUME } from './config.js?v=0.1.11';
import { BLOCK } from './blocks.js?v=0.1.11';

export class Chunk {
  constructor(cx, cy, cz) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_VOLUME);
    this.mesh = null;
  }

  index(x, y, z) {
    return y * CHUNK_AREA + z * CONFIG.CHUNK_SIZE + x;
  }

  get(x, y, z) {
    return this.data[this.index(x, y, z)];
  }

  set(x, y, z, value) {
    this.data[this.index(x, y, z)] = value;
  }

  generate(generator) {
    const size = CONFIG.CHUNK_SIZE;
    const baseX = this.cx * size;
    const baseY = this.cy * size;
    const baseZ = this.cz * size;
    // Fill the chunk by sampling height and tree data for every column.

    for (let lx = 0; lx < size; lx++) {
      const worldX = baseX + lx;
      for (let lz = 0; lz < size; lz++) {
        const worldZ = baseZ + lz;
        const surfaceHeight = generator.getHeightAt(worldX, worldZ);
        const treeHeight = generator.getTreeHeightAt(worldX, worldZ);

        for (let ly = 0; ly < size; ly++) {
          const worldY = baseY + ly;
          let blockId = BLOCK.AIR;

          // Start with the solid ground under the surface.
          if (worldY <= surfaceHeight) {
            if (worldY === surfaceHeight) {
              blockId = surfaceHeight <= CONFIG.WATER_LEVEL + 1 ? BLOCK.SAND : BLOCK.GRASS;
            } else if (surfaceHeight <= CONFIG.WATER_LEVEL) {
              blockId = BLOCK.SAND;
            } else if (surfaceHeight - worldY <= 3) {
              blockId = BLOCK.DIRT;
            } else {
              blockId = BLOCK.STONE;
            }
          } else {
            // Vertical trunk for the tree's anchor column.
            if (treeHeight > 0 && worldY > surfaceHeight && worldY <= surfaceHeight + treeHeight) {
              blockId = BLOCK.WOOD;
            }

            // Scan nearby tree anchors so leaves spill across chunk boundaries.
            if (blockId === BLOCK.AIR && worldY > surfaceHeight && worldY <= surfaceHeight + 8) {
              let foundTreeBlock = false;
              for (let dx = -2; dx <= 2 && !foundTreeBlock; dx++) {
                for (let dz = -2; dz <= 2 && !foundTreeBlock; dz++) {
                  const anchorX = worldX + dx;
                  const anchorZ = worldZ + dz;
                  const anchorTreeHeight = generator.getTreeHeightAt(anchorX, anchorZ);
                  if (anchorTreeHeight <= 0) continue;
                  const anchorSurface = generator.getHeightAt(anchorX, anchorZ);
                  const relY = worldY - anchorSurface;
                  if (relY < 1 || relY > anchorTreeHeight + 1) continue;

                  const offsetX = worldX - anchorX;
                  const offsetZ = worldZ - anchorZ;

                  if (offsetX === 0 && offsetZ === 0 && relY <= anchorTreeHeight) {
                    blockId = BLOCK.WOOD;
                    foundTreeBlock = true;
                  } else if (relY >= anchorTreeHeight - 2 && relY <= anchorTreeHeight + 1) {
                    const canopyLayer = relY - (anchorTreeHeight - 2);
                    const radius = Math.max(1, 3 - canopyLayer);
                    if (Math.abs(offsetX) <= radius && Math.abs(offsetZ) <= radius) {
                      blockId = BLOCK.LEAVES;
                      foundTreeBlock = true;
                    }
                  }
                }
              }
            }
          }

          this.set(lx, ly, lz, blockId);
        }
      }
    }
  }
}
