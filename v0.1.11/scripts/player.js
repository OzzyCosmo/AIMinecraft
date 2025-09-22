// --- Player controller ---------------------------------------------------------------------
import { CONFIG } from './config.js?v=0.1.11';
import { BLOCK_DEFS } from './blocks.js?v=0.1.11';
import { TMP_EULER, TMP_QUATERNION } from './utils.js?v=0.1.11';
const THREE = window.THREE;
if (!THREE) {
  throw new Error('THREE.js must be loaded before player.js');
}

export class PlayerController {
  constructor(camera, world, options) {
    const opts = options || {};
    this.camera = camera;
    this.world = world;
    this.position = new THREE.Vector3(0, 40, 0);
    this.velocity = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.3;
    this.height = 1.8;
    this.eyeHeight = 1.62;
    this.enabled = false;
    this.onGround = false;
    this.spawnPoint = new THREE.Vector3();
    this.lookSensitivity = 0.002;
    this.move = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      run: false,
      up: false,
      down: false
    };
    this.isFlying = false;
    this.tempVec = new THREE.Vector3();
    this.onFlightToggle = typeof opts.onFlightToggle == "function" ? opts.onFlightToggle : null;
  }

  setEnabled(value) {
    this.enabled = value;
    if (!value) {
      this.move.forward = this.move.backward = false;
      this.move.left = this.move.right = false;
      this.move.run = false;
      this.move.up = false;
      this.move.down = false;
    }
  }


  toggleFlight() {
    this.isFlying = !this.isFlying;
    this.move.up = false;
    this.move.down = false;
    if (this.isFlying) {
      this.onGround = false;
      this.velocity.set(0, 0, 0);
    }
    if (this.onFlightToggle) {
      this.onFlightToggle(this.isFlying);
    }
    return this.isFlying;
  }

  setSpawn(x, y, z) {
    this.spawnPoint.set(x, y, z);
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.updateCamera();
  }

  updateCamera() {
    this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );
  }

  onMouseMove(event) {
    if (!this.enabled) return;
    this.yaw -= event.movementX * this.lookSensitivity;
    this.pitch -= event.movementY * this.lookSensitivity;
    const limit = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  onKeyDown(event) {
    if (!this.enabled) return;
    switch (event.code) {
      case 'KeyW':
        this.move.forward = true;
        event.preventDefault();
        break;
      case 'KeyS':
        this.move.backward = true;
        event.preventDefault();
        break;
      case 'KeyA':
        this.move.left = true;
        event.preventDefault();
        break;
      case 'KeyD':
        this.move.right = true;
        event.preventDefault();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.move.run = true;
        event.preventDefault();
        break;
      case 'ControlLeft':
      case 'ControlRight':
        if (this.isFlying) {
          this.move.down = true;
          event.preventDefault();
        }
        break;
      case 'Space':
        if (this.isFlying) {
          this.move.up = true;
        } else if (this.onGround) {
          this.velocity.y = CONFIG.JUMP_VELOCITY;
          this.onGround = false;
        }
        event.preventDefault();
        break;
    }
  }


  onKeyUp(event) {
    switch (event.code) {
      case 'KeyW': this.move.forward = false; break;
      case 'KeyS': this.move.backward = false; break;
      case 'KeyA': this.move.left = false; break;
      case 'KeyD': this.move.right = false; break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.move.run = false;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        if (this.isFlying) {
          this.move.down = false;
        }
        break;
      case 'Space':
        if (this.isFlying) {
          this.move.up = false;
        }
        break;
    }
  }

  moveAlongAxis(axis, delta) {
    if (axis === 'x') {
      this.position.x += this.velocity.x * delta;
    } else if (axis === 'y') {
      this.position.y += this.velocity.y * delta;
    } else if (axis === 'z') {
      this.position.z += this.velocity.z * delta;
    }
    this.resolveCollisions(axis);
  }

  resolveCollisions(axis) {
    const radius = this.radius;
    const height = this.height;
    const epsilon = 0.0005;

    const playerMinX = this.position.x - radius;
    const playerMaxX = this.position.x + radius;
    const playerMinY = this.position.y;
    const playerMaxY = this.position.y + height;
    const playerMinZ = this.position.z - radius;
    const playerMaxZ = this.position.z + radius;

    const minX = Math.floor(playerMinX);
    const maxX = Math.floor(playerMaxX);
    const minY = Math.floor(playerMinY);
    const maxY = Math.floor(playerMaxY);
    const minZ = Math.floor(playerMinZ);
    const maxZ = Math.floor(playerMaxZ);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const blockId = this.world.getBlock(x, y, z);
          if (!BLOCK_DEFS[blockId].solid) continue;

          const blockMinX = x;
          const blockMaxX = x + 1;
          const blockMinY = y;
          const blockMaxY = y + 1;
          const blockMinZ = z;
          const blockMaxZ = z + 1;

          const intersects = (
            playerMaxX > blockMinX &&
            playerMinX < blockMaxX &&
            playerMaxY > blockMinY &&
            playerMinY < blockMaxY &&
            playerMaxZ > blockMinZ &&
            playerMinZ < blockMaxZ
          );

          if (!intersects) continue;

          if (axis === 'x') {
            if (this.velocity.x > 0) {
              this.position.x = blockMinX - radius - epsilon;
            } else if (this.velocity.x < 0) {
              this.position.x = blockMaxX + radius + epsilon;
            }
            this.velocity.x = 0;
            return;
          }

          if (axis === 'y') {
            if (this.velocity.y > 0) {
              this.position.y = blockMinY - height - epsilon;
              this.velocity.y = 0;
            } else if (this.velocity.y < 0) {
              this.position.y = blockMaxY + epsilon;
              this.velocity.y = 0;
              this.onGround = true;
            }
            return;
          }

          if (axis === 'z') {
            if (this.velocity.z > 0) {
              this.position.z = blockMinZ - radius - epsilon;
            } else if (this.velocity.z < 0) {
              this.position.z = blockMaxZ + radius + epsilon;
            }
            this.velocity.z = 0;
            return;
          }
        }
      }
    }
  }

  update(delta) {
    if (!this.enabled) {
      this.updateCamera();
      return;
    }

    if (this.isFlying) {
      const moveVec = this.tempVec;
      moveVec.set(0, 0, 0);
      if (this.move.forward) moveVec.z -= 1;
      if (this.move.backward) moveVec.z += 1;
      if (this.move.left) moveVec.x -= 1;
      if (this.move.right) moveVec.x += 1;

      const speed = CONFIG.FLY_SPEED * (this.move.run ? CONFIG.RUN_MULTIPLIER : 1);
      if (moveVec.lengthSq() > 0) {
        moveVec.normalize();
        TMP_EULER.set(0, this.yaw, 0);
        TMP_QUATERNION.setFromEuler(TMP_EULER);
        moveVec.applyQuaternion(TMP_QUATERNION);
        this.velocity.x = moveVec.x * speed;
        this.velocity.z = moveVec.z * speed;
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }

      let vertical = 0;
      if (this.move.up) vertical += 1;
      if (this.move.down) vertical -= 1;
      this.velocity.y = vertical !== 0 ? vertical * speed : 0;

      this.onGround = false;
      this.moveAlongAxis('x', delta);
      this.moveAlongAxis('z', delta);
      this.moveAlongAxis('y', delta);

      this.updateCamera();
      return;
    }

    // Integrate gravity and clamp downward speed.
    this.velocity.y -= CONFIG.GRAVITY * delta;
    if (this.velocity.y < -CONFIG.TERMINAL_VELOCITY) {
      this.velocity.y = -CONFIG.TERMINAL_VELOCITY;
    }

    // Build a movement vector from WASD input relative to camera yaw.
    const moveVec = this.tempVec;
    moveVec.set(0, 0, 0);
    if (this.move.forward) moveVec.z -= 1;
    if (this.move.backward) moveVec.z += 1;
    if (this.move.left) moveVec.x -= 1;
    if (this.move.right) moveVec.x += 1;

    if (moveVec.lengthSq() > 0) {
      moveVec.normalize();
      const speed = CONFIG.MOVE_SPEED * (this.move.run ? CONFIG.RUN_MULTIPLIER : 1);
      TMP_EULER.set(0, this.yaw, 0);
      TMP_QUATERNION.setFromEuler(TMP_EULER);
      moveVec.applyQuaternion(TMP_QUATERNION);
      this.velocity.x = moveVec.x * speed;
      this.velocity.z = moveVec.z * speed;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // Axis-separated collisions keep the player aligned to the voxel grid.
    this.onGround = false;
    this.moveAlongAxis('x', delta);
    this.moveAlongAxis('z', delta);
    this.moveAlongAxis('y', delta);

    // Simple fail-safe: respawn near spawn if we fall out of the world.
    if (this.position.y < -10 && this.spawnPoint) {
      this.setPosition(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z);
    }

    this.updateCamera();
  }


  intersectsBlock(x, y, z) {
    const radius = this.radius;
    const height = this.height;
    const blockMinX = x;
    const blockMaxX = x + 1;
    const blockMinY = y;
    const blockMaxY = y + 1;
    const blockMinZ = z;
    const blockMaxZ = z + 1;

    const playerMinX = this.position.x - radius;
    const playerMaxX = this.position.x + radius;
    const playerMinY = this.position.y;
    const playerMaxY = this.position.y + height;
    const playerMinZ = this.position.z - radius;
    const playerMaxZ = this.position.z + radius;

    return (
      playerMaxX > blockMinX && playerMinX < blockMaxX &&
      playerMaxY > blockMinY && playerMinY < blockMaxY &&
      playerMaxZ > blockMinZ && playerMinZ < blockMaxZ
    );
  }
}
