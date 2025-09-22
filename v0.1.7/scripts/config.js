// --- Core configuration ---------------------------------------------------------------------
export const CONFIG = {
  CHUNK_SIZE: 16,
  CHUNK_HEIGHT: 64,
  FIXED_TIME_STEP: 1 / 60,
  RENDER_DISTANCE_DEFAULT: 10,
  RENDER_DISTANCE_REDUCED: 2,
  REMOVAL_BUFFER: 1,
  RAYCAST_DISTANCE: 6,
  WATER_LEVEL: 18,
  WORLD_SEED: 1337,
  GRAVITY: 28,
  TERMINAL_VELOCITY: 48,
  MOVE_SPEED: 4.3,
  RUN_MULTIPLIER: 1.6,
  FLY_SPEED: 8,
  JUMP_VELOCITY: 8.5,
  ACTION_COOLDOWN_MS: 180,
  // Shadow tuning values keep contact shadows tight; tweak cautiously to avoid acne.
  SHADOW_MAP_SIZE: 3328,
  SHADOW_BIAS: -0.00018,
  SHADOW_NORMAL_BIAS: 0,
  SHADOW_RADIUS: 0.08,
  SHADOW_CAMERA_EXTENT: 100,
  SHADOW_CAMERA_NEAR: 4,
  SHADOW_CAMERA_FAR: 210
};
export const BLOCK_SIZE = 1;
export const CHUNK_AREA = CONFIG.CHUNK_SIZE * CONFIG.CHUNK_SIZE;
export const CHUNK_VOLUME = CHUNK_AREA * CONFIG.CHUNK_SIZE;

export const AO_LUT = [1.0, 0.62, 0.34, 0.08];
export const AO_STRENGTH_MAX = 1.5;
export const AO_DEFAULT_STRENGTH = AO_STRENGTH_MAX;
export const AO_DIRECTIONAL_STRENGTH = 0.85;
export const AO_SKY_STRENGTH = 0.65;
export const AO_SKY_STEPS = 5;
export const CLOUD_LAYER_BOUNDS = { min: 52, max: 78 };
export const CLOUD_QUALITY_PRESETS = {
  low: { steps: 24 },
  medium: { steps: 48 },
  high: { steps: 80 }
};
export const CLOUD_DEFAULTS = {
  enabled: true,
  coverage: 0.12,
  density: 0.6,
  windSpeed: 4.0,
  quality: 'high'
};
export const CLOUD_WIND_DIRECTION = (() => {
  const x = 0.62;
  const z = 0.34;
  const length = Math.hypot(x, z);
  return { x: x / length, z: z / length };
})();
export const CLOUD_WIND_SPEED_SCALE = 0.05;
export const SUN_LIGHT_DIRECTION = (() => {
  const length = Math.hypot(80, 120, 60);
  return { x: 80 / length, y: 120 / length, z: 60 / length };
})();
export const settings = {
  aoEnabled: true,
  aoStrength: AO_DEFAULT_STRENGTH,
  aoDirectionalStrength: AO_DIRECTIONAL_STRENGTH,
  aoSkyStrength: AO_SKY_STRENGTH,
  clouds: Object.assign({}, CLOUD_DEFAULTS)
};

export const CLOUD_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const CLOUD_FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 vUv;

  uniform vec2 iResolution;
  uniform float iTime;
  uniform vec3 camPos;
  uniform mat4 camMatrix;
  uniform mat4 projMatrixInv;
  uniform vec3 sunDir;
  uniform float coverage;
  uniform float density;
  uniform vec2 wind;
  uniform float quality;
  uniform float enableClouds;
  uniform vec2 layerHeights;

  const int MAX_STEPS = 96;
  const float BASE_NOISE_SCALE = 0.015;
  const float DETAIL_NOISE_SCALE = 0.055;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 39.425))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);
    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);
    return mix(nxy0, nxy1, u.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += noise(p * frequency) * amplitude;
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 skyGradient(vec3 dir) {
    float t = clamp(dir.y * 0.65 + 0.35, 0.0, 1.0);
    vec3 horizon = vec3(0.58, 0.72, 0.88);
    vec3 zenith = vec3(0.18, 0.34, 0.58);
    return mix(horizon, zenith, t);
  }

  float calcShadow(vec3 pos, vec3 lightDir, float coverageThreshold, float baseDensity, vec2 bounds, vec2 windOffset) {
    float shadow = 1.0;
    float stepLen = 3.0;
    vec3 samplePos = pos + lightDir * stepLen;
    for (int i = 0; i < 5; i++) {
      if (samplePos.y < bounds.x || samplePos.y > bounds.y) {
        break;
      }
      vec3 windSample = vec3(samplePos.x + windOffset.x, samplePos.y, samplePos.z + windOffset.y);
      float shape = fbm(windSample * BASE_NOISE_SCALE);
      float detail = fbm(windSample * DETAIL_NOISE_SCALE);
      float densitySample = smoothstep(coverageThreshold, 1.0, shape + detail * 0.45) * baseDensity;
      shadow -= densitySample * 0.15;
      samplePos += lightDir * stepLen;
    }
    return clamp(shadow, 0.25, 1.0);
  }

  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec4 clip = vec4(ndc, 1.0, 1.0);
    vec4 viewDir = projMatrixInv * clip;
    vec3 rd = normalize((camMatrix * vec4(viewDir.xyz, 0.0)).xyz);
    vec3 ro = camPos;

    vec3 skyColor = skyGradient(rd);

    if (enableClouds <= 0.001) {
      gl_FragColor = vec4(skyColor, 1.0);
      return;
    }

    float slabMin = layerHeights.x;
    float slabMax = layerHeights.y;

    float t0 = (slabMin - ro.y) / rd.y;
    float t1 = (slabMax - ro.y) / rd.y;
    float tNear = min(t0, t1);
    float tFar = max(t0, t1);

    if (tFar < 0.0) {
      gl_FragColor = vec4(skyColor, 1.0);
      return;
    }
    float start = max(tNear, 0.0);
    float end = max(start, tFar);
    float viewLimit = 400.0;
    end = min(end, viewLimit);
    if (end - start <= 0.0001) {
      gl_FragColor = vec4(skyColor, 1.0);
      return;
    }

    float steps = clamp(quality, 8.0, float(MAX_STEPS));
    float stepLength = (end - start) / steps;
    vec2 windOffset = wind * iTime;

    float coverageThreshold = mix(0.85, 0.2, clamp(coverage, 0.0, 1.0));
    float densityStrength = max(0.0, density);

    vec3 accumulatedColor = vec3(0.0);
    float accumulatedAlpha = 0.0;

    float t = start;
    for (int i = 0; i < MAX_STEPS; i++) {
      if (float(i) >= steps) {
        break;
      }
      vec3 samplePos = ro + rd * (t + stepLength * 0.5);
      t += stepLength;

      vec3 windSamplePos = vec3(samplePos.x + windOffset.x, samplePos.y, samplePos.z + windOffset.y);

      float baseShape = fbm(windSamplePos * BASE_NOISE_SCALE);
      float detailShape = fbm(windSamplePos * DETAIL_NOISE_SCALE);
      float cloudShape = baseShape + detailShape * 0.45;

      float baseDensity = smoothstep(coverageThreshold, 1.0, cloudShape);
      float verticalBlend = smoothstep(slabMin, slabMin + 6.0, samplePos.y) *
                            (1.0 - smoothstep(slabMax - 6.0, slabMax, samplePos.y));
      float localDensity = baseDensity * densityStrength * verticalBlend;

      if (localDensity <= 0.0005) {
        continue;
      }

      float lightBase = clamp(dot(normalize(vec3(0.0, 1.0, 0.0)), sunDir) * 0.4 + 0.6, 0.35, 1.0);
      float shadow = calcShadow(samplePos, sunDir, coverageThreshold, densityStrength, vec2(slabMin, slabMax), windOffset);
      float lighting = clamp(lightBase * shadow, 0.2, 1.0);

      float absorption = 1.0 - exp(-localDensity * stepLength * 1.2);
      absorption = clamp(absorption, 0.0, 1.0);

      vec3 sampleColor = mix(vec3(0.62, 0.67, 0.75), vec3(1.0, 0.97, 0.92), lighting);
      float transmittance = 1.0 - accumulatedAlpha;
      accumulatedColor += sampleColor * absorption * transmittance;
      accumulatedAlpha += absorption * transmittance;

      if (accumulatedAlpha >= 0.995) {
        break;
      }
    }

    accumulatedAlpha *= enableClouds;
    vec3 finalColor = mix(skyColor, accumulatedColor, accumulatedAlpha);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

