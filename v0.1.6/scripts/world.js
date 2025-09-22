// --- World & meshing -----------------------------------------------------------------------
import { CONFIG, BLOCK_SIZE, AO_LUT, AO_SKY_STEPS, SUN_LIGHT_DIRECTION } from './config.js';
import { BLOCK, BLOCK_DEFS, FACE_DATA, FACE_INDICES } from './blocks.js';
import { Chunk } from './chunk.js';
import { TerrainGenerator } from './terrain.js';
import { mod } from './utils.js';
const THREE = window.THREE;
if (!THREE) {
  throw new Error('THREE.js must be loaded before world.js');
}

export class World {
  constructor(scene, atlasInfo, settings) {
    this.scene = scene;
    this.settings = settings;
    this.sunDirection = SUN_LIGHT_DIRECTION;
    this.skyOcclusionSteps = AO_SKY_STEPS;
    this.generator = new TerrainGenerator(CONFIG.WORLD_SEED);
    this.chunks = new Map();
    this.chunkMeshes = new Set();
    this.chunkArray = [];
    this.chunkArrayDirty = false;
    this.renderDistance = CONFIG.RENDER_DISTANCE_DEFAULT;
    this.preferredRenderDistance = this.renderDistance;
    this.maxChunkY = Math.ceil(CONFIG.CHUNK_HEIGHT / CONFIG.CHUNK_SIZE);
    this.lastChunkUpdateTime = 0;
    this.forceRefresh = true;
    this.aoScratch = new Float32Array(4);

    this.textureAtlas = atlasInfo.texture;
    this.textureAtlas.wrapS = THREE.ClampToEdgeWrapping;
    this.textureAtlas.wrapT = THREE.ClampToEdgeWrapping;

    this.blockFaceUVs = BLOCK_DEFS.map(def => def.faces.map(face => face ? atlasInfo.uvs[face] : null));

    this.material = new THREE.MeshStandardMaterial({
      map: this.textureAtlas,
      vertexColors: true,
      flatShading: true,
      roughness: 1.0,
      metalness: 0.0,
      alphaTest: 0.45
    });
    this.material.side = THREE.FrontSide;
    this.material.needsUpdate = true;
  }

  chunkKey(cx, cy, cz) {
    return `${cx}|${cy}|${cz}`;
  }

  ensureChunk(cx, cy, cz) {
    if (cy < 0 || cy >= this.maxChunkY) return null;
    const key = this.chunkKey(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (chunk) {
      return chunk;
    }
    chunk = new Chunk(cx, cy, cz);
    chunk.generate(this.generator);
    this.chunks.set(key, chunk); // Store before meshing so neighbor lookups see voxel data.
    this.buildChunkMesh(chunk);
    return chunk;
  }

  rebuildChunkAt(cx, cy, cz) {
    const key = this.chunkKey(cx, cy, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    this.buildChunkMesh(chunk);
  }

  removeChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      this.chunkMeshes.delete(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    this.chunks.delete(key);
    this.chunkArrayDirty = true;
  }

  // Chunk meshing + baked ambient occlusion (AO):
  // Each visible face samples the three neighboring blocks touching its corners.
  // Additional directional + sky sampling darken faces opposite the sun or caught under canopies.
  // AO_LUT defines the base shadowing, blended by settings.aoStrength into vertex colors with directional and sky occlusion boosts.
  buildChunkMesh(chunk) {
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      this.chunkMeshes.delete(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }

    const positions = [];
    const normals = [];
    const uvs = [];
    const colors = [];
    const indices = [];
    let vertexOffset = 0;

    const size = CONFIG.CHUNK_SIZE;
    const originX = chunk.cx * size;
    const originY = chunk.cy * size;
    const originZ = chunk.cz * size;
    // Walk all voxels and emit quads only where a face is exposed.

    for (let ly = 0; ly < size; ly++) {
      for (let lz = 0; lz < size; lz++) {
        for (let lx = 0; lx < size; lx++) {
          const blockId = chunk.get(lx, ly, lz);
          if (blockId === BLOCK.AIR) continue; // Skip empty space quickly.
          const worldX = originX + lx;
          const worldY = originY + ly;
          const worldZ = originZ + lz;

          for (let faceIndex = 0; faceIndex < FACE_DATA.length; faceIndex++) {
            const face = FACE_DATA[faceIndex];
            const neighborId = this.getBlock(worldX + face.dir[0], worldY + face.dir[1], worldZ + face.dir[2]);
            const neighborDef = BLOCK_DEFS[neighborId] || BLOCK_DEFS[BLOCK.AIR];
            const hideFace = neighborDef.solid && !neighborDef.transparent;
            if (hideFace) continue; // Faces against opaque neighbors are never visible.

            const tile = this.blockFaceUVs[blockId][faceIndex];
            if (!tile) continue;

            const aoValues = this.computeFaceAO(worldX, worldY, worldZ, face);

            for (let i = 0; i < FACE_INDICES.length; i++) {
              indices.push(vertexOffset + FACE_INDICES[i]);
            }

            for (let i = 0; i < face.corners.length; i++) {
              const corner = face.corners[i];
              positions.push(
                (worldX + corner[0]) * BLOCK_SIZE,
                (worldY + corner[1]) * BLOCK_SIZE,
                (worldZ + corner[2]) * BLOCK_SIZE
              );
              normals.push(face.normal[0], face.normal[1], face.normal[2]);
              const ao = aoValues[i];
              colors.push(ao, ao, ao);
            }

            // UVs map into the stitched atlas with a touch of padding to avoid bleeding.
            uvs.push(tile.u1, tile.v1);
            uvs.push(tile.u0, tile.v1);
            uvs.push(tile.u0, tile.v0);
            uvs.push(tile.u1, tile.v0);

            vertexOffset += 4;
          }
        }
      }
    }

    if (positions.length === 0) {
      chunk.mesh = null;
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.chunk = chunk;
    mesh.frustumCulled = true;
    this.scene.add(mesh);
    this.chunkMeshes.add(mesh);
    this.chunkArrayDirty = true;
    chunk.mesh = mesh;
  }
  sampleOcclusion(x, y, z) {
    const blockId = this.getBlock(x, y, z);
    const def = BLOCK_DEFS[blockId];
    return def ? def.solid : false;
  }
  sampleSkyOcclusion(x, y, z) {
    const steps = this.skyOcclusionSteps;
    if (steps <= 0) return 0;
    let blocked = 0;
    for (let i = 1; i <= steps; i++) {
      if (this.sampleOcclusion(x, y + i, z)) {
        blocked++;
      } else {
      }
    }
    return blocked / steps;
  }

  computeFaceAO(worldX, worldY, worldZ, face) {
    const aoValues = this.aoScratch;
    const { ao } = face;
    const settings = this.settings;
    const strength = settings.aoStrength;

    if (!settings.aoEnabled || strength <= 0) {
      aoValues[0] = 1;
      aoValues[1] = 1;
      aoValues[2] = 1;
      aoValues[3] = 1;
      return aoValues;
    }

    const baseX = worldX + face.dir[0];
    const baseY = worldY + face.dir[1];
    const baseZ = worldZ + face.dir[2];
    const u = ao.u;
    const v = ao.v;
    const uAxis = ao.uAxis;
    const vAxis = ao.vAxis;

    const sunDir = this.sunDirection;
    const faceDot = face.normal[0] * sunDir.x + face.normal[1] * sunDir.y + face.normal[2] * sunDir.z;
    const directionalStrength = settings.aoDirectionalStrength * strength;
    const away = Math.max(0, -faceDot);
    const lightFacing = Math.max(0, faceDot);
    const directionalShade = Math.max(0.1, (1 - away * directionalStrength) * (1 + lightFacing * directionalStrength * 0.2));

    const skyOcclusion = this.sampleSkyOcclusion(worldX, worldY, worldZ);
    const skyInfluence = settings.aoSkyStrength * strength;
    const lateralFactor = 1 - Math.abs(face.normal[1]);
    const downwardFactor = Math.max(0, -face.normal[1]);
    const skyShade = Math.max(0.1, 1 - skyOcclusion * skyInfluence * (downwardFactor + lateralFactor * 0.4));

    for (let i = 0; i < face.corners.length; i++) {
      const corner = face.corners[i];
      const signU = corner[uAxis] === 1 ? 1 : -1;
      const signV = corner[vAxis] === 1 ? 1 : -1;

      const offsetUX = u[0] * signU;
      const offsetUY = u[1] * signU;
      const offsetUZ = u[2] * signU;
      const offsetVX = v[0] * signV;
      const offsetVY = v[1] * signV;
      const offsetVZ = v[2] * signV;

      const side1 = this.sampleOcclusion(baseX + offsetUX, baseY + offsetUY, baseZ + offsetUZ) ? 1 : 0;
      const side2 = this.sampleOcclusion(baseX + offsetVX, baseY + offsetVY, baseZ + offsetVZ) ? 1 : 0;
      const cornerOcc = this.sampleOcclusion(
        baseX + offsetUX + offsetVX,
        baseY + offsetUY + offsetVY,
        baseZ + offsetUZ + offsetVZ
      ) ? 1 : 0;

      const occlusion = (side1 && side2) ? 3 : (side1 + side2 + cornerOcc);
      const base = AO_LUT[occlusion];
      const occlusionShade = THREE.MathUtils.lerp(1, base, strength);
      aoValues[i] = Math.max(0.05, occlusionShade * directionalShade * skyShade);
    }

    return aoValues;
  }



  getBlock(x, y, z) {
    if (y < 0 || y >= CONFIG.CHUNK_HEIGHT) {
      return BLOCK.AIR;
    }
    const size = CONFIG.CHUNK_SIZE;
    const cx = Math.floor(x / size);
    const cy = Math.floor(y / size);
    const cz = Math.floor(z / size);
    const key = this.chunkKey(cx, cy, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) {
      return BLOCK.AIR;
    }
    const lx = mod(x, size);
    const ly = mod(y, size);
    const lz = mod(z, size);
    return chunk.get(lx, ly, lz);
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= CONFIG.CHUNK_HEIGHT) {
      return false;
    }
    const size = CONFIG.CHUNK_SIZE;
    const cx = Math.floor(x / size);
    const cy = Math.floor(y / size);
    const cz = Math.floor(z / size);
    const chunk = this.ensureChunk(cx, cy, cz);
    if (!chunk) return false;
    const lx = mod(x, size);
    const ly = mod(y, size);
    const lz = mod(z, size);
    const current = chunk.get(lx, ly, lz);
    if (current === id) return false;

    chunk.set(lx, ly, lz, id);
    this.buildChunkMesh(chunk);

    if (lx === 0) this.rebuildChunkAt(cx - 1, cy, cz);
    if (lx === size - 1) this.rebuildChunkAt(cx + 1, cy, cz);
    if (ly === 0) this.rebuildChunkAt(cx, cy - 1, cz);
    if (ly === size - 1) this.rebuildChunkAt(cx, cy + 1, cz);
    if (lz === 0) this.rebuildChunkAt(cx, cy, cz - 1);
    if (lz === size - 1) this.rebuildChunkAt(cx, cy, cz + 1);

    return true;
  }

  isSolid(blockId) {
    const def = BLOCK_DEFS[blockId];
    return def ? def.solid : false;
  }

  getRaycastObjects() {
    if (this.chunkArrayDirty) {
      this.chunkArray = Array.from(this.chunkMeshes);
      this.chunkArrayDirty = false;
    }
    return this.chunkArray;
  }

  refreshChunks(playerPosition, force = false) {
    const now = performance.now();
    if (!force && now - this.lastChunkUpdateTime < 200) {
      return;
    }
    this.lastChunkUpdateTime = now;

    const size = CONFIG.CHUNK_SIZE;
    const baseCx = Math.floor(playerPosition.x / size);
    const baseCz = Math.floor(playerPosition.z / size);
    const radius = this.renderDistance;
    const required = new Set();
    // Keep a ring of chunks around the player generated and retire distant ones.

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance > radius + 0.5) continue;
        const cx = baseCx + dx;
        const cz = baseCz + dz;
        for (let cy = 0; cy < this.maxChunkY; cy++) {
          const key = this.chunkKey(cx, cy, cz);
          required.add(key);
          if (!this.chunks.has(key)) {
            this.ensureChunk(cx, cy, cz);
          } else if (force) {
            this.rebuildChunkAt(cx, cy, cz);
          }
        }
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!required.has(key)) {
        const dx = chunk.cx - baseCx;
        const dz = chunk.cz - baseCz;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance > radius + CONFIG.REMOVAL_BUFFER) {
          this.removeChunk(key);
        }
      }
    }
  }

  update(playerPosition) {
    this.refreshChunks(playerPosition, this.forceRefresh);
    if (this.forceRefresh) {
      this.forceRefresh = false;
    }
  }

  toggleRenderDistance() {
    if (this.renderDistance === this.preferredRenderDistance) {
      const reduced = Math.max(1, CONFIG.RENDER_DISTANCE_REDUCED);
      this.renderDistance = reduced;
    } else {
      this.renderDistance = this.preferredRenderDistance;
    }
    this.forceRefresh = true;
    return this.renderDistance;
  }

  setRenderDistance(distance) {
    const parsed = Math.floor(distance);
    if (!Number.isFinite(parsed)) {
      return this.renderDistance;
    }
    const clamped = Math.max(1, parsed);
    this.preferredRenderDistance = clamped;
    this.renderDistance = clamped;
    this.forceRefresh = true;
    return this.renderDistance;
  }
}
