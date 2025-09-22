// --- Main bootstrap ------------------------------------------------------------------------
import { CONFIG, settings, AO_STRENGTH_MAX, CLOUD_QUALITY_PRESETS, CLOUD_WIND_DIRECTION, CLOUD_WIND_SPEED_SCALE, CLOUD_LAYER_BOUNDS, CLOUD_VERTEX_SHADER, CLOUD_FRAGMENT_SHADER, SUN_LIGHT_DIRECTION, CLOUD_NOISE_TEXTURE_SIZE } from './config.js';
import { World } from './world.js';
import { PlayerController } from './player.js';
import { BlockInteraction } from './blockInteraction.js';
import { buildTextureAtlas } from './textureAtlas.js';
import { createHotbar, createMessageSystem, createDamageOverlay, createHighlightMesh } from './ui.js';
import { TMP_LIGHT_VEC, SUN_LIGHT_OFFSET } from './utils.js';
const THREE = window.THREE;
if (!THREE) {
  throw new Error('THREE.js must be loaded before bootstrap.js');
}

export function initialize() {
  // --- Main bootstrap ------------------------------------------------------------------------
  const overlay = document.getElementById('overlay');
  const startButton = document.getElementById('startButton');
  const hud = document.getElementById('hud');
  const messageElement = document.getElementById('message');
  const fpsElement = document.getElementById('fps');
  const hotbarElement = document.getElementById('hotbar');
  const renderToggleButton = document.getElementById('renderToggle');
  const settingsButton = document.getElementById('settingsButton');
  const settingsPanel = document.getElementById('settingsPanel');
  const renderDistanceInput = document.getElementById('renderDistanceInput');
  const renderDistanceApply = document.getElementById('renderDistanceApply');
  const aoToggle = document.getElementById('aoToggle');
  const aoStrengthInput = document.getElementById('aoStrengthInput');
  const aoStrengthValue = document.getElementById('aoStrengthValue');
  const settingsCloseButton = document.getElementById('settingsClose');
  const cloudToggle = document.getElementById('cloudToggle');
  const cloudQualitySelect = document.getElementById('cloudQuality');
  const cloudCoverageInput = document.getElementById('cloudCoverage');
  const cloudCoverageValue = document.getElementById('cloudCoverageValue');
  const cloudDensityInput = document.getElementById('cloudDensity');
  const cloudDensityValue = document.getElementById('cloudDensityValue');
  const cloudWindInput = document.getElementById('cloudWind');
  const cloudWindValue = document.getElementById('cloudWindValue');
  const defaultMessage = messageElement.textContent;

  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x87ceeb, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.width = '100vw';
  renderer.domElement.style.height = '100vh';
  renderer.domElement.id = 'voxel-canvas';
  renderer.domElement.tabIndex = 0;
  document.body.appendChild(renderer.domElement);

  const fract = (value) => value - Math.floor(value);
  const hash3 = (x, y, z) => fract(Math.sin(x * 12.9898 + y * 78.233 + z * 39.425) * 43758.5453);
  const lerp = THREE.MathUtils.lerp;

  const noise3 = (x, y, z) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fy = y - iy;
    const fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const uz = fz * fz * (3 - 2 * fz);

    const n000 = hash3(ix, iy, iz);
    const n100 = hash3(ix + 1, iy, iz);
    const n010 = hash3(ix, iy + 1, iz);
    const n110 = hash3(ix + 1, iy + 1, iz);
    const n001 = hash3(ix, iy, iz + 1);
    const n101 = hash3(ix + 1, iy, iz + 1);
    const n011 = hash3(ix, iy + 1, iz + 1);
    const n111 = hash3(ix + 1, iy + 1, iz + 1);

    const nx00 = lerp(n000, n100, ux);
    const nx10 = lerp(n010, n110, ux);
    const nx01 = lerp(n001, n101, ux);
    const nx11 = lerp(n011, n111, ux);
    const nxy0 = lerp(nx00, nx10, uy);
    const nxy1 = lerp(nx01, nx11, uy);
    return lerp(nxy0, nxy1, uz);
  };

  const sampleFbm = (x, y, z, octaves, offset) => {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
      value += noise3((x + offset[0]) * frequency, (y + offset[1]) * frequency, (z + offset[2]) * frequency) * amplitude;
      frequency *= 2;
      amplitude *= 0.5;
    }
    return value;
  };

  const createCloudDataTexture = (size, octaves, offset) => {
    const data = new Float32Array(size * size * size);
    const invSize = 1 / size;
    let index = 0;
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const px = (x + 0.5) * invSize;
          const py = (y + 0.5) * invSize;
          const pz = (z + 0.5) * invSize;
          const value = sampleFbm(px, py, pz, octaves, offset);
          data[index++] = Math.min(1, Math.max(0, value));
        }
      }
    }
    const texture = new THREE.Data3DTexture(data, size, size, size);
    texture.format = THREE.RedFormat;
    texture.type = THREE.FloatType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
  };

  const buildCloudNoiseTextures = (size) => {
    const base = createCloudDataTexture(size, 4, [0.0, 0.0, 0.0]);
    const detail = createCloudDataTexture(size, 3, [3.7, 7.3, 11.1]);
    return { base, detail };
  };

  const supportsCloudTextures = renderer.capabilities.isWebGL2 && typeof THREE.Data3DTexture === 'function';
  const cloudNoiseTextures = supportsCloudTextures ? buildCloudNoiseTextures(CLOUD_NOISE_TEXTURE_SIZE) : null;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x87ceeb, 70, 220);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xfff4d6, 0.9);
  sunLight.position.copy(SUN_LIGHT_OFFSET);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(CONFIG.SHADOW_MAP_SIZE, CONFIG.SHADOW_MAP_SIZE);
  sunLight.shadow.bias = CONFIG.SHADOW_BIAS;
  sunLight.shadow.normalBias = CONFIG.SHADOW_NORMAL_BIAS;
  sunLight.shadow.radius = CONFIG.SHADOW_RADIUS;
  const shadowExtent = CONFIG.SHADOW_CAMERA_EXTENT;
  sunLight.shadow.camera.near = CONFIG.SHADOW_CAMERA_NEAR;
  sunLight.shadow.camera.far = CONFIG.SHADOW_CAMERA_FAR;
  sunLight.shadow.camera.left = -shadowExtent;
  sunLight.shadow.camera.right = shadowExtent;
  sunLight.shadow.camera.top = shadowExtent;
  sunLight.shadow.camera.bottom = -shadowExtent;
  sunLight.shadow.camera.updateProjectionMatrix();
  scene.add(sunLight);
  const sunLightTarget = new THREE.Object3D();
  scene.add(sunLightTarget);
  sunLight.target = sunLightTarget;

  const atlasInfo = buildTextureAtlas();
  const world = new World(scene, atlasInfo, settings);
  const highlightMesh = createHighlightMesh();
  highlightMesh.castShadow = false;
  highlightMesh.receiveShadow = false;
  scene.add(highlightMesh);

  const damageOverlay = createDamageOverlay(CONFIG.BREAK_STAGE_COUNT);
  damageOverlay.mesh.castShadow = false;
  damageOverlay.mesh.receiveShadow = false;
  scene.add(damageOverlay.mesh);

  const player = new PlayerController(camera, world, { onFlightToggle: () => updateSunLight() });

  const cloudUniforms = {
    iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    iTime: { value: 0 },
    camPos: { value: new THREE.Vector3() },
    camMatrix: { value: new THREE.Matrix4() },
    projMatrixInv: { value: new THREE.Matrix4() },
    sunDir: { value: new THREE.Vector3(SUN_LIGHT_DIRECTION.x, SUN_LIGHT_DIRECTION.y, SUN_LIGHT_DIRECTION.z) },
    coverage: { value: settings.clouds.coverage },
    density: { value: settings.clouds.density },
    windOffset: { value: new THREE.Vector2() },
    quality: { value: (CLOUD_QUALITY_PRESETS[settings.clouds.quality] || CLOUD_QUALITY_PRESETS.medium).steps },
    enableClouds: { value: settings.clouds.enabled ? 1 : 0 },
    layerHeights: { value: new THREE.Vector2(CLOUD_LAYER_BOUNDS.min, CLOUD_LAYER_BOUNDS.max) }
  };

  if (cloudNoiseTextures) {
    cloudUniforms.cloudBaseTex = { value: cloudNoiseTextures.base };
    cloudUniforms.cloudDetailTex = { value: cloudNoiseTextures.detail };
  }

  const cloudShadowUniforms = {
    enable: { value: settings.clouds.enabled ? 1 : 0 },
    coverage: { value: settings.clouds.coverage },
    density: { value: settings.clouds.density },
    offset: { value: new THREE.Vector2() },
    sunDir: { value: new THREE.Vector3(SUN_LIGHT_DIRECTION.x, SUN_LIGHT_DIRECTION.y, SUN_LIGHT_DIRECTION.z) },
    layerHeights: { value: new THREE.Vector2(CLOUD_LAYER_BOUNDS.min, CLOUD_LAYER_BOUNDS.max) },
    intensity: { value: 0.85 }
  };

  if (cloudNoiseTextures) {
    cloudShadowUniforms.baseTex = { value: cloudNoiseTextures.base };
    cloudShadowUniforms.detailTex = { value: cloudNoiseTextures.detail };
  }

  const cloudScene = new THREE.Scene();
  const cloudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const cloudMaterial = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERTEX_SHADER,
    fragmentShader: CLOUD_FRAGMENT_SHADER,
    uniforms: cloudUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  if (cloudNoiseTextures) {
    cloudMaterial.defines = Object.assign({}, cloudMaterial.defines, { USE_CLOUD_TEXTURES: 1 });
    cloudMaterial.needsUpdate = true;
  }
  const cloudQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cloudMaterial);
  cloudQuad.frustumCulled = false;
  cloudScene.add(cloudQuad);

  const updateSunLight = () => {
    TMP_LIGHT_VEC.copy(player.position).add(SUN_LIGHT_OFFSET);
    sunLight.position.copy(TMP_LIGHT_VEC);
    sunLight.target.position.copy(player.position);
    sunLight.target.updateMatrixWorld();
  };


  const hotbarSlots = createHotbar(hotbarElement);
  const messageSystem = createMessageSystem(messageElement, defaultMessage);

  const showMessage = (text, duration) => messageSystem.show(text, duration);
  const blockInteraction = new BlockInteraction(camera, world, player, highlightMesh, damageOverlay, showMessage, hotbarSlots);

  hotbarSlots.forEach((slot, index) => {
    slot.addEventListener('click', () => blockInteraction.setSelectedIndex(index));
    slot.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  blockInteraction.updateHotbar();
  const clampAO = (value) => {
    if (!Number.isFinite(value)) return settings.aoStrength;
    return Math.min(AO_STRENGTH_MAX, Math.max(0, value));
  };
  const formatAO = (value) => value.toFixed(2);
  const syncAOControls = () => {
    aoToggle.checked = settings.aoEnabled;
    aoStrengthInput.max = String(AO_STRENGTH_MAX);
    aoStrengthInput.value = formatAO(settings.aoStrength);
    aoStrengthInput.disabled = !settings.aoEnabled;
    aoStrengthValue.textContent = formatAO(settings.aoStrength);
    aoStrengthValue.classList.toggle('disabled', !settings.aoEnabled);
  };
  const triggerAORebuild = () => {
    world.refreshChunks(player.position, true);
  };

  const attachCloudShadowMaterial = (material) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.cloudShadowEnable = cloudShadowUniforms.enable;
      shader.uniforms.cloudShadowCoverage = cloudShadowUniforms.coverage;
      shader.uniforms.cloudShadowDensity = cloudShadowUniforms.density;
      shader.uniforms.cloudShadowOffset = cloudShadowUniforms.offset;\r\n      shader.uniforms.cloudShadowSunDir = cloudShadowUniforms.sunDir;
      shader.uniforms.cloudShadowLayerHeights = cloudShadowUniforms.layerHeights;
      shader.uniforms.cloudShadowIntensity = cloudShadowUniforms.intensity;
      if (cloudNoiseTextures) {
        shader.uniforms.cloudShadowBaseTex = cloudShadowUniforms.baseTex;
        shader.uniforms.cloudShadowDetailTex = cloudShadowUniforms.detailTex;
        shader.defines = shader.defines || {};
        shader.defines.USE_CLOUD_TEXTURES = 1;
      }

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\n\nvarying vec3 vWorldPosition;'
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n  vWorldPosition = worldPosition.xyz;'
      );

      
const shadowChunk = `
varying vec3 vWorldPosition;
uniform float cloudShadowEnable;
uniform float cloudShadowCoverage;
uniform float cloudShadowDensity;
uniform vec2 cloudShadowOffset;
uniform vec3 cloudShadowSunDir;
uniform vec2 cloudShadowLayerHeights;
uniform float cloudShadowIntensity;
#ifdef USE_CLOUD_TEXTURES
uniform sampler3D cloudShadowBaseTex;
uniform sampler3D cloudShadowDetailTex;
#endif

const int CLOUD_SHADOW_STEPS = 12;
const float CLOUD_BASE_NOISE_SCALE = 0.015;
const float CLOUD_DETAIL_NOISE_SCALE = 0.055;

#ifdef USE_CLOUD_TEXTURES
float cloudSampleBase(vec3 p) {
  return texture(cloudShadowBaseTex, fract(p)).r;
}

float cloudSampleDetail(vec3 p) {
  return texture(cloudShadowDetailTex, fract(p)).r;
}
#else
float cloudHash3(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 39.425))) * 43758.5453);
}

float cloudNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = cloudHash3(i + vec3(0.0, 0.0, 0.0));
  float n100 = cloudHash3(i + vec3(1.0, 0.0, 0.0));
  float n010 = cloudHash3(i + vec3(0.0, 1.0, 0.0));
  float n110 = cloudHash3(i + vec3(1.0, 1.0, 0.0));
  float n001 = cloudHash3(i + vec3(0.0, 0.0, 1.0));
  float n101 = cloudHash3(i + vec3(1.0, 0.0, 1.0));
  float n011 = cloudHash3(i + vec3(0.0, 1.0, 1.0));
  float n111 = cloudHash3(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z);
}

float cloudSampleBase(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 4; i++) {
    value += cloudNoise3(p * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

float cloudSampleDetail(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 3; i++) {
    value += cloudNoise3(p * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
#endif

vec3 cloudApplyWind(vec3 p, vec2 offset) {
  return vec3(p.x + offset.x, p.y, p.z + offset.y);
}

float cloudSampleDensity(vec3 samplePos, vec2 offset, float coverageThreshold, float densityStrength, float slabMin, float slabMax) {
  vec3 windSamplePos = cloudApplyWind(samplePos, offset);
  float baseShape = cloudSampleBase(windSamplePos * CLOUD_BASE_NOISE_SCALE);
  float detailShape = cloudSampleDetail(windSamplePos * CLOUD_DETAIL_NOISE_SCALE);
  float cloudShape = baseShape + detailShape * 0.55;
  float baseDensity = smoothstep(coverageThreshold, 1.0, cloudShape);
  float verticalBlend = smoothstep(slabMin, slabMin + 6.0, samplePos.y) *
                        (1.0 - smoothstep(slabMax - 6.0, slabMax, samplePos.y));
  return baseDensity * densityStrength * verticalBlend;
}

float cloudRand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float computeCloudShadow(vec3 worldPos) {
  vec3 dir = normalize(cloudShadowSunDir);
  float slabMin = cloudShadowLayerHeights.x;
  float slabMax = cloudShadowLayerHeights.y;
  float t0 = (slabMin - worldPos.y) / dir.y;
  float t1 = (slabMax - worldPos.y) / dir.y;
  float tNear = min(t0, t1);
  float tFar = max(t0, t1);
  if (tFar <= 0.0) {
    return 1.0;
  }
  float start = max(tNear, 0.0);
  float end = max(start, tFar);
  if (end - start <= 0.0001) {
    return 1.0;
  }
  float steps = float(CLOUD_SHADOW_STEPS);
  float stepLength = (end - start) / steps;
  float coverageThreshold = mix(0.85, 0.2, clamp(cloudShadowCoverage, 0.0, 1.0));
  float densityStrength = max(0.0, cloudShadowDensity);
  if (densityStrength <= 0.001) {
    return 1.0;
  }
  float transmittance = 1.0;
  float t = start;
  float jitter = cloudRand(worldPos.xz * 0.02 + cloudShadowOffset * 0.35);
  for (int i = 0; i < CLOUD_SHADOW_STEPS; i++) {
    if (t >= end || float(i) >= steps) {
      break;
    }
    float progress = clamp(float(i) / max(1.0, steps - 1.0), 0.0, 1.0);
    float sampleOffset = mix(jitter, 0.5, progress);
    vec3 samplePos = worldPos + dir * (t + sampleOffset * stepLength);
    t += stepLength;
    jitter = fract(jitter + 0.61803398875);
    float densitySample = cloudSampleDensity(samplePos, cloudShadowOffset, coverageThreshold, densityStrength, slabMin, slabMax);
    if (densitySample <= 0.0005) {
      continue;
    }
    float absorption = densitySample * stepLength * 1.05;
    transmittance *= exp(-absorption);
    if (transmittance <= 0.08) {
      return max(0.05, transmittance);
    }
  }
  return clamp(transmittance, 0.05, 1.0);
}
`;


      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>\n\n${shadowChunk}`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_begin>',
        '#include <lights_fragment_begin>\n  float cloudShadowFactor = 1.0;\n  if (cloudShadowEnable > 0.001) {\n    float computedShadow = computeCloudShadow(vWorldPosition);\n    float softenedShadow = mix(1.0, computedShadow, cloudShadowIntensity);\n    cloudShadowFactor = mix(1.0, softenedShadow, cloudShadowEnable);\n  }\n  reflectedLight.directDiffuse *= cloudShadowFactor;\n  reflectedLight.directSpecular *= cloudShadowFactor;\n  reflectedLight.indirectDiffuse *= mix(1.0, cloudShadowFactor, 0.6);\n'
      );
    };
    material.needsUpdate = true;
  };

  attachCloudShadowMaterial(world.material);

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const clampRange = (value, min, max) => Math.min(max, Math.max(min, value));
  const parseNumber = (value, fallback) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const formatCloudValue = (value, decimals = 2) => value.toFixed(decimals);
  const normalizeCloudQuality = (key) => (CLOUD_QUALITY_PRESETS[key] ? key : 'medium');
  const getCloudQualityPreset = (key) => CLOUD_QUALITY_PRESETS[normalizeCloudQuality(key)];

  // Locate the first terrain column with grass for predictable spawning.
  const findGrassSpawn = (generator, maxRadius = 96) => {
    const grassThreshold = CONFIG.WATER_LEVEL + 1;
    for (let radius = 0; radius <= maxRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const candidateX = dx;
          const candidateZ = dz;
          const surfaceHeight = generator.getHeightAt(candidateX, candidateZ);
          if (surfaceHeight > grassThreshold) {
            return { x: candidateX, z: candidateZ, surfaceHeight };
          }
        }
      }
    }
    const fallbackHeight = generator.getHeightAt(0, 0);
    return { x: 0, z: 0, surfaceHeight: fallbackHeight };
  };
  const updateCloudUiState = () => {
    const enabled = settings.clouds.enabled;
    cloudQualitySelect.disabled = !enabled;
    cloudCoverageInput.disabled = !enabled;
    cloudDensityInput.disabled = !enabled;
    cloudWindInput.disabled = !enabled;
    cloudCoverageValue.classList.toggle('disabled', !enabled);
    cloudDensityValue.classList.toggle('disabled', !enabled);
    cloudWindValue.classList.toggle('disabled', !enabled);
  };

  const syncCloudControls = () => {
    const cloudSettings = settings.clouds;
    cloudSettings.quality = normalizeCloudQuality(cloudSettings.quality);
    cloudToggle.checked = cloudSettings.enabled;
    cloudQualitySelect.value = cloudSettings.quality;
    cloudCoverageInput.value = cloudSettings.coverage.toFixed(2);
    cloudCoverageValue.textContent = formatCloudValue(cloudSettings.coverage);
    cloudDensityInput.value = cloudSettings.density.toFixed(2);
    cloudDensityValue.textContent = formatCloudValue(cloudSettings.density);
    cloudWindInput.value = cloudSettings.windSpeed.toFixed(1);
    cloudWindValue.textContent = formatCloudValue(cloudSettings.windSpeed, 1);
    updateCloudUiState();
  };

  const updateRenderDistanceLabel = () => {
    renderToggleButton.textContent = `Render Distance: ${world.renderDistance}`;
  };

  const syncRenderDistanceInput = () => {
    renderDistanceInput.value = String(world.preferredRenderDistance ?? world.renderDistance);
  };

  const closeSettings = () => {
    settingsPanel.classList.remove('open');
    renderDistanceInput.blur();
  };

  const openSettings = () => {
    syncRenderDistanceInput();
    syncAOControls();
    syncCloudControls();
    settingsPanel.classList.add('open');
    renderDistanceInput.focus();
    renderDistanceInput.select();
  };

  const applyRenderDistance = () => {
    const parsed = parseInt(renderDistanceInput.value, 10);
    if (!Number.isFinite(parsed)) {
      syncRenderDistanceInput();
      return;
    }
    const updated = world.setRenderDistance(parsed);
    syncRenderDistanceInput();
    updateRenderDistanceLabel();
    world.refreshChunks(player.position, true);
    closeSettings();
    showMessage(`Render distance set to ${updated}`, 1500);
  };

  updateRenderDistanceLabel();
  syncRenderDistanceInput();
  syncAOControls();
  syncCloudControls();

  const spawnLocation = findGrassSpawn(world.generator);
  const spawnPoint = new THREE.Vector3(spawnLocation.x + 0.5, spawnLocation.surfaceHeight + 3, spawnLocation.z + 0.5);
  player.setSpawn(spawnPoint.x, spawnPoint.y, spawnPoint.z);
  player.setPosition(spawnPoint.x, spawnPoint.y, spawnPoint.z);
  updateSunLight();
  world.refreshChunks(player.position, true);

  const canvas = renderer.domElement;

  function toggleHud() {
    hud.classList.toggle('hidden');
    const visible = !hud.classList.contains('hidden');
    messageSystem.show(visible ? 'HUD shown' : 'HUD hidden', 1200);
  }

  startButton.addEventListener('click', () => {
    closeSettings();
    canvas.requestPointerLock();
  });

  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    overlay.style.display = locked ? 'none' : 'flex';
    player.setEnabled(locked);
    blockInteraction.setEnabled(locked);
    hud.style.opacity = locked ? 1 : 0.85;
    if (!locked) {
      highlightMesh.visible = false;
      messageSystem.reset();
      syncRenderDistanceInput();
    } else {
      closeSettings();
      showMessage('Pointer locked - have fun!', 1500);
    }
  });
  document.addEventListener('pointerlockerror', () => {
    overlay.style.display = 'flex';
    showMessage('Pointer lock failed - click Start again.', 2000);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    cloudUniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
  });

  document.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('mousemove', (event) => player.onMouseMove(event));
  canvas.addEventListener('mousedown', (event) => blockInteraction.onMouseDown(event));
  canvas.addEventListener('mouseup', (event) => blockInteraction.onMouseUp(event));
  window.addEventListener('mouseup', (event) => blockInteraction.onMouseUp(event));
  window.addEventListener('blur', () => blockInteraction.cancelBreaking());

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyE') {
      toggleHud();
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyR') {
      const current = world.toggleRenderDistance();
      updateRenderDistanceLabel();
      world.refreshChunks(player.position, true);
      showMessage(`Render distance: ${current}`, 1500);
      syncRenderDistanceInput();
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyN') {
      const flying = player.toggleFlight();
      showMessage(flying ? 'Flight mode enabled' : 'Flight mode disabled', 1500);
      event.preventDefault();
      return;
    }
    if (event.code.startsWith('Digit')) {
      blockInteraction.onNumberKey(event.code);
      return;
    }
    player.onKeyDown(event);
  });

  window.addEventListener('keyup', (event) => {
    player.onKeyUp(event);
  });

  window.addEventListener('wheel', (event) => {
    if (!blockInteraction.enabled) return;
    blockInteraction.onWheel(event.deltaY);
    event.preventDefault();
  }, { passive: false });

  settingsButton.addEventListener('click', () => {
    if (settingsPanel.classList.contains('open')) {
      closeSettings();
    } else {
      openSettings();
    }
  });

  settingsCloseButton.addEventListener('click', () => {
    closeSettings();
  });

  renderDistanceApply.addEventListener('click', () => {
    applyRenderDistance();
  });

  renderDistanceInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyRenderDistance();
    }
  });
  aoToggle.addEventListener('change', () => {
    settings.aoEnabled = aoToggle.checked;
    syncAOControls();
    triggerAORebuild();
  });

  aoStrengthInput.addEventListener('input', () => {
    settings.aoStrength = clampAO(parseFloat(aoStrengthInput.value));
    aoStrengthInput.value = formatAO(settings.aoStrength);
    aoStrengthValue.textContent = formatAO(settings.aoStrength);
  });

  aoStrengthInput.addEventListener('change', () => {
    settings.aoStrength = clampAO(parseFloat(aoStrengthInput.value));
    aoStrengthInput.value = formatAO(settings.aoStrength);
    aoStrengthValue.textContent = formatAO(settings.aoStrength);
    if (settings.aoEnabled) {
      triggerAORebuild();
    }
  });

  cloudToggle.addEventListener('change', () => {
    settings.clouds.enabled = cloudToggle.checked;
    updateCloudUiState();
  });

  cloudQualitySelect.addEventListener('change', () => {
    settings.clouds.quality = normalizeCloudQuality(cloudQualitySelect.value);
    cloudQualitySelect.value = settings.clouds.quality;
  });

  cloudCoverageInput.addEventListener('input', () => {
    const value = clamp01(parseNumber(cloudCoverageInput.value, settings.clouds.coverage));
    settings.clouds.coverage = value;
    cloudCoverageValue.textContent = formatCloudValue(value);
  });

  cloudDensityInput.addEventListener('input', () => {
    const value = clampRange(parseNumber(cloudDensityInput.value, settings.clouds.density), 0, 1.5);
    settings.clouds.density = value;
    cloudDensityValue.textContent = formatCloudValue(value);
  });

  cloudWindInput.addEventListener('input', () => {
    const value = clampRange(parseNumber(cloudWindInput.value, settings.clouds.windSpeed), 0, 12);
    settings.clouds.windSpeed = value;
    cloudWindValue.textContent = formatCloudValue(value, 1);
  });

  settingsPanel.addEventListener('click', (event) => {
    if (event.target === settingsPanel) {
      closeSettings();
    }
  });

  renderToggleButton.addEventListener('click', () => {
    const current = world.toggleRenderDistance();
    updateRenderDistanceLabel();
    world.refreshChunks(player.position, true);
    showMessage(`Render distance: ${current}`, 1500);
    syncRenderDistanceInput();
  });

  let fpsTimer = 0;
  let frameCount = 0;
  const clock = new THREE.Clock();
  let accumulator = 0;
  let cloudTime = 0;
  let cloudBlend = settings.clouds.enabled ? 1 : 0;

  function animate() {
    // Fixed-step physics update paired with an uncapped render loop for smooth visuals.
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);
    accumulator += delta;
    cloudTime += delta;

    while (accumulator >= CONFIG.FIXED_TIME_STEP) {
      player.update(CONFIG.FIXED_TIME_STEP);
      accumulator -= CONFIG.FIXED_TIME_STEP;
    }

    world.update(player.position);
    blockInteraction.update();

    updateSunLight();
    camera.updateMatrixWorld();

    const cloudSettings = settings.clouds;
    const qualityPreset = getCloudQualityPreset(cloudSettings.quality);
    const windScale = CLOUD_WIND_SPEED_SCALE;
    cloudUniforms.iTime.value = cloudTime;
    cloudUniforms.camPos.value.copy(camera.position);
    cloudUniforms.camMatrix.value.copy(camera.matrixWorld);
    cloudUniforms.projMatrixInv.value.copy(camera.projectionMatrixInverse);
    cloudUniforms.coverage.value = cloudSettings.coverage;
    cloudUniforms.density.value = cloudSettings.density;
    cloudShadowUniforms.coverage.value = cloudSettings.coverage;
    cloudShadowUniforms.density.value = cloudSettings.density;
    cloudUniforms.quality.value = qualityPreset.steps;
    const windX = CLOUD_WIND_DIRECTION.x * cloudSettings.windSpeed * windScale;
    const windZ = CLOUD_WIND_DIRECTION.z * cloudSettings.windSpeed * windScale;
    cloudWindOffset.x += windX * delta;\r\n    cloudWindOffset.y += windZ * delta;\r\n    cloudUniforms.windOffset.value.set(cloudWindOffset.x, cloudWindOffset.y);\r\n    cloudShadowUniforms.offset.value.set(cloudWindOffset.x, cloudWindOffset.y);

    const targetBlend = cloudSettings.enabled ? 1 : 0;
    const blendFactor = 1 - Math.exp(-5 * delta);
    cloudBlend += (targetBlend - cloudBlend) * blendFactor;
    if (Math.abs(cloudBlend - targetBlend) < 0.001) {
      cloudBlend = targetBlend;
    }
    cloudUniforms.enableClouds.value = cloudBlend;
    cloudShadowUniforms.enable.value = cloudBlend;

    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(cloudScene, cloudCamera);
    renderer.clearDepth();
    renderer.render(scene, camera);

    fpsTimer += delta;
    frameCount++;
    if (fpsTimer >= 0.5) {
      fpsElement.textContent = `FPS: ${(frameCount / fpsTimer).toFixed(0)}`;
      fpsTimer = 0;
      frameCount = 0;
    }
  }

  animate();

}

























