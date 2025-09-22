// --- Block interaction (raycasting, build/break) --------------------------------------------
import { CONFIG } from './config.js?v=0.1.11';
import { BLOCK, BLOCK_DEFS, HOTBAR_ITEMS, HOTBAR_COLORS } from './blocks.js?v=0.1.11';
import { TMP_NORMAL_MATRIX } from './utils.js?v=0.1.11';
const THREE = window.THREE;
if (!THREE) {
  throw new Error('THREE.js must be loaded before blockInteraction.js');
}

export class BlockInteraction {
  constructor(camera, world, player, highlightMesh, damageOverlay, showMessage, hotbarSlots) {
    this.camera = camera;
    this.world = world;
    this.player = player;
    this.highlight = highlightMesh;
    this.damageOverlay = damageOverlay;
    this.showMessage = showMessage;
    this.hotbarSlots = hotbarSlots;
    this.hotbarItems = HOTBAR_ITEMS;
    this.selectedIndex = 0;
    this.currentTarget = null;
    this.enabled = false;
    this.lastActionTime = 0;
    this.breakState = null;
    this.mouseButtons = [false, false, false];
    this.raycaster = new THREE.Raycaster();
    this.rayDirection = new THREE.Vector3();

    this.updateHotbar();
  }

  setEnabled(value) {
    this.enabled = value;
    if (!value) {
      this.mouseButtons[0] = false;
      this.mouseButtons[1] = false;
      this.mouseButtons[2] = false;
      this.clearBreakingState();
      this.currentTarget = null;
      this.highlight.visible = false;
    }
  }

  clearBreakingState() {
    this.breakState = null;
    this.damageOverlay.hide();
  }

  cancelBreaking() {
    this.mouseButtons[0] = false;
    this.clearBreakingState();
  }

  updateHotbar() {
    this.hotbarSlots.forEach((slot, index) => {
      const blockId = this.hotbarItems[index];
      const label = slot.querySelector('.label');
      if (label) {
        label.textContent = BLOCK_DEFS[blockId].name;
      }
      slot.style.background = HOTBAR_COLORS[blockId] || '#777';
      slot.classList.toggle('selected', index === this.selectedIndex);
    });
  }

  setSelectedIndex(index) {
    if (index < 0) index = this.hotbarItems.length - 1;
    if (index >= this.hotbarItems.length) index = 0;
    if (this.selectedIndex === index) return;
    this.selectedIndex = index;
    this.updateHotbar();
    this.showMessage(`Selected ${BLOCK_DEFS[this.hotbarItems[this.selectedIndex]].name}`, 1400);
  }

  cycleSelection(step) {
    this.setSelectedIndex((this.selectedIndex + step + this.hotbarItems.length) % this.hotbarItems.length);
  }

  onNumberKey(code) {
    if (!this.enabled) return;
    const num = parseInt(code.replace('Digit', ''), 10);
    if (!Number.isNaN(num) && num >= 1 && num <= this.hotbarItems.length) {
      this.setSelectedIndex(num - 1);
    }
  }

  onWheel(deltaY) {
    if (!this.enabled) return;
    const step = deltaY > 0 ? 1 : -1;
    this.cycleSelection(step);
  }

  onMouseDown(event) {
    if (!this.enabled) return;
    if (typeof this.mouseButtons[event.button] === 'boolean') {
      this.mouseButtons[event.button] = true;
    }
    if (event.button === 0) {
      event.preventDefault();
      this.beginBreak(performance.now());
    } else if (event.button === 2) {
      event.preventDefault();
      const now = performance.now();
      if (now - this.lastActionTime < CONFIG.ACTION_COOLDOWN_MS) return;
      const acted = this.tryPlace();
      if (acted) {
        this.lastActionTime = now;
      }
    }
  }

  onMouseUp(event) {
    if (typeof this.mouseButtons[event.button] === 'boolean') {
      this.mouseButtons[event.button] = false;
    }
    if (event.button === 0) {
      this.clearBreakingState();
    }
  }

  beginBreak(now) {
    if (!this.mouseButtons[0]) return;
    const target = this.currentTarget;
    if (!target || target.blockId === BLOCK.AIR) {
      this.clearBreakingState();
      return;
    }
    const def = BLOCK_DEFS[target.blockId] || BLOCK_DEFS[BLOCK.AIR];
    if (def && def.breakable === false) {
      this.clearBreakingState();
      return;
    }
    const rawDuration = def && typeof def.breakTime === 'number' ? def.breakTime : CONFIG.DEFAULT_BREAK_TIME_MS;
    if (rawDuration <= 0) {
      if (this.tryDestroy(target)) {
        this.lastActionTime = now;
      }
      this.clearBreakingState();
      return;
    }
    const duration = Math.max(16, rawDuration);
    const key = `${target.position.x},${target.position.y},${target.position.z}`;
    this.breakState = {
      key,
      blockId: target.blockId,
      position: target.position.clone(),
      startedAt: now,
      duration
    };
    this.damageOverlay.setProgress(target.position, 0);
  }

  syncBreakState(now) {
    if (!this.mouseButtons[0]) {
      if (this.breakState) {
        this.clearBreakingState();
      } else {
        this.damageOverlay.hide();
      }
      return;
    }

    const target = this.currentTarget;
    if (!target || target.blockId === BLOCK.AIR) {
      this.clearBreakingState();
      return;
    }

    const key = `${target.position.x},${target.position.y},${target.position.z}`;
    if (!this.breakState || this.breakState.key !== key || this.breakState.blockId !== target.blockId) {
      this.beginBreak(now);
      return;
    }

    const elapsed = now - this.breakState.startedAt;
    const duration = Math.max(16, this.breakState.duration);
    const progress = elapsed / duration;
    this.damageOverlay.setProgress(target.position, progress);
    if (progress >= 1) {
      const completed = this.breakState;
      this.clearBreakingState();
      const destroyed = this.tryDestroy({ blockId: completed.blockId, position: completed.position });
      if (destroyed) {
        this.lastActionTime = now;
        this.currentTarget = null;
        this.highlight.visible = false;
      }
    }
  }

  tryDestroy(target = this.currentTarget) {
    if (!target) return false;
    const blockId = target.blockId;
    if (blockId === BLOCK.AIR) return false;
    const pos = target.position;
    const changed = this.world.setBlock(pos.x, pos.y, pos.z, BLOCK.AIR);
    if (changed) {
      this.showMessage(`Broke ${BLOCK_DEFS[blockId].name}`, 1400);
    }
    return changed;
  }

  tryPlace() {
    if (!this.currentTarget) return false;
    const blockId = this.hotbarItems[this.selectedIndex];
    if (blockId === BLOCK.AIR) return false;

    const placePos = this.currentTarget.position.clone().add(this.currentTarget.normal).round();
    if (placePos.y < 0 || placePos.y >= CONFIG.CHUNK_HEIGHT) return false;

    const existing = this.world.getBlock(placePos.x, placePos.y, placePos.z);
    if (existing !== BLOCK.AIR) return false;

    if (this.player.intersectsBlock(placePos.x, placePos.y, placePos.z)) {
      this.showMessage('Cannot place inside the player', 1200);
      return false;
    }

    const placed = this.world.setBlock(placePos.x, placePos.y, placePos.z, blockId);
    if (placed) {
      this.showMessage(`Placed ${BLOCK_DEFS[blockId].name}`, 1400);
    }
    return placed;
  }

  update() {
    const now = performance.now();
    if (!this.enabled) {
      this.highlight.visible = false;
      this.currentTarget = null;
      this.syncBreakState(now);
      return;
    }

    // Cast a ray from the camera to find the targeted block within reach.
    this.camera.getWorldDirection(this.rayDirection).normalize();
    this.raycaster.set(this.camera.position, this.rayDirection);
    this.raycaster.far = CONFIG.RAYCAST_DISTANCE;

    const hits = this.raycaster.intersectObjects(this.world.getRaycastObjects(), false);
    if (hits.length === 0) {
      this.highlight.visible = false;
      this.currentTarget = null;
      this.syncBreakState(now);
      return;
    }

    const hit = hits[0];
    const point = hit.point.clone();
    const normalMatrix = TMP_NORMAL_MATRIX;
    normalMatrix.getNormalMatrix(hit.object.matrixWorld);
    const faceNormal = hit.face.normal.clone().applyMatrix3(normalMatrix);
    faceNormal.set(Math.sign(faceNormal.x), Math.sign(faceNormal.y), Math.sign(faceNormal.z));
    point.addScaledVector(faceNormal, -0.01);

    const blockPos = new THREE.Vector3(
      Math.floor(point.x),
      Math.floor(point.y),
      Math.floor(point.z)
    );
    const blockId = this.world.getBlock(blockPos.x, blockPos.y, blockPos.z);
    if (blockId === BLOCK.AIR) {
      this.highlight.visible = false;
      this.currentTarget = null;
      this.syncBreakState(now);
      return;
    }

    this.highlight.visible = true;
    this.highlight.position.set(blockPos.x + 0.5, blockPos.y + 0.5, blockPos.z + 0.5);

    this.currentTarget = {
      position: blockPos,
      normal: faceNormal,
      blockId
    };

    this.syncBreakState(now);
  }
}
