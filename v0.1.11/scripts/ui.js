// --- UI helpers -----------------------------------------------------------------------------
import { HOTBAR_ITEMS } from './blocks.js?v=0.1.11';
import { CONFIG } from './config.js?v=0.1.11';
import { createSeededRandom } from './utils.js?v=0.1.11';
const THREE = window.THREE;
if (!THREE) {
  throw new Error('THREE.js must be loaded before ui.js');
}

export function createHotbar(hotbarElement) {
  const slots = [];
  for (let i = 0; i < HOTBAR_ITEMS.length; i++) {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot';
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = 'Block';
    slot.appendChild(label);
    const indexBadge = document.createElement('span');
    indexBadge.className = 'index';
    indexBadge.textContent = `${i + 1}`;
    slot.appendChild(indexBadge);
    hotbarElement.appendChild(slot);
    slots.push(slot);
  }
  return slots;
}

export function createMessageSystem(element, defaultText) {
  let timeoutId = null;
  return {
    show(text, duration = 2000) {
      element.textContent = text;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        element.textContent = defaultText;
        timeoutId = null;
      }, duration);
    },
    reset() {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      element.textContent = defaultText;
    }
  };
}

export function createDamageTextures(stageCount) {
  const textures = [];
  const size = 32;
  const segments = [
    [16, 4, 16, 28],
    [16, 16, 6, 12],
    [16, 16, 26, 12],
    [16, 16, 8, 24],
    [16, 16, 24, 24],
    [12, 10, 6, 6],
    [20, 10, 26, 6],
    [12, 22, 6, 28],
    [20, 22, 26, 28],
    [10, 16, 4, 18],
    [22, 16, 28, 18],
    [16, 8, 12, 2],
    [16, 8, 20, 2]
  ];
  const rng = createSeededRandom(CONFIG.WORLD_SEED * 1337 + 42);
  for (let i = 0; i < stageCount; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const intensity = (i + 1) / stageCount;
    const segmentCount = Math.max(3, Math.floor(segments.length * intensity));
    ctx.strokeStyle = `rgba(18, 18, 18, ${0.25 + intensity * 0.65})`;
    ctx.lineWidth = 1.1 + intensity * 1.0;

    for (let j = 0; j < segmentCount; j++) {
      const seg = segments[j % segments.length];
      const jitter = (v) => v + (rng() - 0.5) * 3 * intensity;
      ctx.beginPath();
      ctx.moveTo(jitter(seg[0]), jitter(seg[1]));
      ctx.lineTo(jitter(seg[2]), jitter(seg[3]));
      ctx.stroke();
    }

    const shardCount = Math.floor(6 + intensity * 8);
    ctx.fillStyle = `rgba(12, 12, 12, ${0.18 + intensity * 0.45})`;
    for (let s = 0; s < shardCount; s++) {
      const x = 16 + (rng() - 0.5) * 18;
      const y = 16 + (rng() - 0.5) * 18;
      const radius = Math.max(0.5, 1.2 - intensity * 0.4);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    textures.push(texture);
  }
  return textures;
}

export function createDamageOverlay(stageCount) {
  const textures = createDamageTextures(stageCount);
  const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    opacity: 0,
    polygonOffset: true,
    polygonOffsetFactor: -0.6,
    polygonOffsetUnits: -0.6
  });
  material.map = textures[0];
  material.needsUpdate = true;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 9998;

  let currentStage = -1;

  return {
    mesh,
    setProgress(position, progress) {
      const clamped = Math.max(0, Math.min(1, progress));
      const scaled = Math.min(0.999, clamped);
      const stage = Math.floor(scaled * textures.length);
      if (stage !== currentStage) {
        material.map = textures[stage];
        material.needsUpdate = true;
        currentStage = stage;
      }
      material.opacity = 0.35 + clamped * 0.65;
      mesh.visible = true;
      mesh.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
    },
    hide() {
      if (!mesh.visible && currentStage === -1) return;
      mesh.visible = false;
      material.opacity = 0;
      currentStage = -1;
    }
  };
}

export function createHighlightMesh() {
  const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
  const material = new THREE.LineBasicMaterial({
    color: 0xffff88,
    transparent: true,
    opacity: 0.85,
    depthTest: false
  });
  const mesh = new THREE.LineSegments(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 9999;
  return mesh;
}
