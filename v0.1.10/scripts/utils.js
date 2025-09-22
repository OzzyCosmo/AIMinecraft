// --- Shared scratch objects to avoid garbage ------------------------------------------------
const THREE = window.THREE;
if (!THREE) {
  throw new Error('THREE.js must be loaded before utils.js');
}

export const TMP_QUATERNION = new THREE.Quaternion();
export const TMP_EULER = new THREE.Euler();
export const TMP_NORMAL_MATRIX = new THREE.Matrix3();
export const TMP_VEC3 = new THREE.Vector3();
export const TMP_LIGHT_VEC = new THREE.Vector3();
export const SUN_LIGHT_OFFSET = new THREE.Vector3(80, 120, 60);

// --- Utility helpers -----------------------------------------------------------------------
export function createSeededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function seededRandom() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const lerp = (a, b, t) => a + t * (b - a);
export function grad(hash, x, y) {
  switch (hash & 3) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    default: return -x - y;
  }
}

export function mod(n, m) {
  const r = n % m;
  return r < 0 ? r + m : r;
}
